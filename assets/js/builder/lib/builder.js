(function ($) {
    "use strict";

    var builder = function(options)
    {
        var defaults = {
            fw: window,
            contentDocument: document,
            document: 'body',
            container: '#mp-layout-builder',
            overlay_select: '#overlay',
            overlay_hover: '#overlay-hover'
        };
        options = $.extend(defaults, options);

        this.overlayDisabled = false;

        // ability to pass an iframe's window
        this.fw = options.fw;

        // ability to pass an iframe's document
        this.fc = options.contentDocument;

        this.container = options.container;
        this.document = options.document;
        this.scope = typeof angular !== 'undefined' ? angular.element(this.container).scope() : false;

        this.scope.safeApply = function(fn) {
            var phase = this.$root.$$phase;
            if(phase == '$apply' || phase == '$digest') {
                if(fn && (typeof(fn) === 'function')) {
                    fn();
                }
            } else {
                this.$apply(fn);
            }
        };

        this.$ = this.fw.jQuery;
        this.overlay = this.$(options.overlay_select);
        this.overlays = {
            select: this.overlay,
            hover: this.$(options.overlay_hover)
        };
        this.mode = 'all';

        this.$(this.document)
            .attr('spellcheck', false)
            .disableSelection();

        this.init();
    };

    builder.prototype.init = function()
    {
        this.initJQExpr();
        this.initOverlays();
        this.makeSortables();
        this.initContainer();
        this.bindKeys();
        this.initComponents();
        this.initCodeEditor();
    };

    builder.prototype.initCodeEditor = function()
    {
        var builder = this;
        this.$(document).on("mousedown", ".CodeMirror .cm-mustache", function(event)
        {
            event.stopPropagation();
            event.preventDefault();

            var mustache = builder.$.trim(builder.$(event.target).text()),
                match = mustache.match(/\{\{([a-zA-Z0-9-._:, |]+)(options=[\"]([^\"]*)[\"])?\}\}/im),
                id = builder.$.trim(match[1]),
                options_str = match[3],
                options = builder.deserialize(options_str.replace(/&amp;/gm, "&")),
                t = builder.$('[data-component="' + id + '"]').filter(function(){
                    var t_template = builder.makeTemplate(builder.$('<div/>').html(builder.$(this).clone(true)), false);
                    return t_template == mustache;
                });

            if (t.length && !builder.isExcluded(t))
                builder.attachOverlay(t);
            else
                alert(id);
        });
    };

    builder.prototype.initComponents = function()
    {
        var builder = this;
        this.$('#gallery-components').on('click', '.bcomponent', function(e)
        {
            var c = builder.overlay.is(':visible') ?
                builder.getOverlayAttachment() :
                builder.container;

            builder.$(c).prepend(builder.$(this).clone());
            builder.applyComponent();
        });
    };

    builder.prototype.initJQExpr = function()
    {
        var builder = this;
        this.$.expr[':'].allowSortable = function(elem, index, match)
        {
            var t = builder.$(elem),
                t_parent_component = t.closest('[data-component]'),
                filterDivs = false;

            if (t.is('div'))
            {
                if (t.is('.pull-left') || t.is('.pull-right'))
                    filterDivs = true;
            }

            if (t.is('[data-component]'))
            {
                var t_options = builder.getOptions(t);
                if (typeof t_options.type == 'undefined' || (typeof t_options.type !== 'undefined' && t_options.type != 'template'))
                    filterDivs = true;
            }

            if (t_parent_component.length)
            {
                var tpc_options = builder.getOptions(t_parent_component);
                if (typeof tpc_options.type == 'undefined' || (typeof tpc_options.type !== 'undefined' && tpc_options.type != 'template'))
                    filterDivs = true;
            }

            return !t.is('.row')
                && !t.is('.ui-sortable')
                && !t.is('.widget')
                && !t.is('.widget-head')
                && !t.is('.clearfix')
                && !t.find('> .clearfix').length
                && !filterDivs
                && !t.is('[data-builder-exclude]')
                && !t.closest('[data-builder-exclude]').length
                && !t.parent().is('body')
                && (t.parents(builder.container).length || t.is(builder.container));
        };
    };

    builder.prototype.initContainer = function()
    {
        var builder = this;

        // @note: this.contents() refers to the iframe
        // probably wont work here, outside of a loaded iframe context
        // this.$(this).contents().find(this.container)
        this.$(this.container)
            .droppable(
            {
                accept: $(".bcomponent"),
                hoverClass: 'ui-highlight-drops',
                greedy: true,
                over: function(e, t)
                {
                    builder.overlayDisabled = true;
                    builder.hideOverlay();
                },
                drop: function( e, t )
                {
                    builder.overlayDisabled = false;

                    var d = t.draggable.clone(false);
                    d.uniqueId();

                    $(this).prepend(d);
                    $(this).parents('[data-component]').attr('data-builder-saveComponent', true);

                    if ($(this).is('[data-component]'))
                        $(this).attr('data-builder-saveComponent', true);

                    builder.applyComponent();
                    builder.saveComponent(true);
                }
            });
    };

    builder.prototype.initOverlays = function()
    {
        var builder = this;

        // since the overlay's are just before the </body> closing tag,
        // it's outside of the ng-app declaration and the angular module needs to be bootstraped manually
        angular.bootstrap(this.overlay.parent(), ['App']);

        this.$(this.document).add(this.overlays.select).add(this.overlays.hover)
            .on('mousemove.builder', function(event)
            {
                if (builder.$(builder.document).is(':empty'))
                    return;

                if (builder.overlayDisabled)
                    return;

                if (builder.scope.page.loading)
                    return false;

                if (builder.$(event.srcElement).closest('[id="overlay-label"]').length)
                    return;

                if (builder.$(event.srcElement).closest('[id*="overlay-menu"]').length)
                    return;

                var xy = builder.getXY(event.pageX, event.pageY),
                    x = xy.x,
                    y = xy.y,
                    t = builder.getElement(x, y);

                if (t && t.length)
                    builder.attachOverlay(t, builder.overlays.hover);
            });

        this.$(this.document).add(this.overlays.hover).add(this.overlays.select)
            .on('mousedown.builder', function(event)
            {
                if (builder.$(builder.document).is(':empty'))
                    return;

                if (builder.overlayDisabled)
                    return;

                if (builder.$(event.srcElement).closest('[contenteditable]').length)
                    return;

                if (builder.$(event.srcElement).closest('[id*=overlay-menu]').length)
                    return;

                event.stopPropagation();

                var xy = builder.getXY(event.pageX, event.pageY),
                    x = xy.x,
                    y = xy.y,
                    t = builder.getElement(x, y);

                if (t)
                    builder.attachOverlay(t);
                else
                {
                    builder.hideOverlay();
                    builder.updateEditor();
                }

            });

        this.overlay.draggable({
            iframeFix: true,
            // handle: '#overlay-move',
            revert: 'invalid',
            revertDuration: 0,
            scroll: true,
            zIndex: 1000000,
            opacity: .4,
            // refreshPositions: true,
            helper: function()
            {
                var c = builder.getOverlayAttachment().clone();
                return c.width(c.width());
            },
            start: function()
            {
                var t = builder.getOverlayAttachment();

                if (!t.parent().is('.row'))
                    t.parent().addClass('draggable-parent');
                else
                    t.hide();

                builder.overlayDisabled = true;
                builder.overlay.hide();
            },
            stop: function()
            {
                var t = builder.getOverlayAttachment();
                builder.$('.draggable-parent').removeClass('draggable-parent');
                builder.overlayDisabled = false;
                builder.overlay.add(t).show();
            }
        });

        this.$(window).resize(function()
        {
            if (builder.overlay.is(':visible'))
                builder.attachOverlay();
        });

        this.bindOverlayControls();
    };

    builder.prototype.getSelectionMode = function(t)
    {
        var builder = this,
            mode = this.mode;

        if (typeof t == 'undefined')
        {
            if (!this.overlay.is(':visible'))
                return mode;
            else
                var t = this.getOverlayAttachment();
        }

        if (t.is('.row')) mode = 'row';
        if (t.is('[class*="col-"]')) mode = 'column';
        if (t.is('[data-component]')) mode = 'component';
        if (t.parent().is('[data-component]') && t.parent().find('> *').filter(function()
        {
            return this.nodeType !== 8 && !builder.isExcluded(builder.$(this));
        }).length == 1) mode = 'component';

        return mode;
    }

    builder.prototype.attachOverlay = function(t, overlay)
    {
        overlay = typeof overlay == 'undefined' ? this.overlays.select : overlay;
        if (overlay.is(this.overlays.hover))
        {
            if (typeof t == 'undefined')
                return;

            var select_t = this.getOverlayAttachment();
            if (t.is(select_t))
                return;
        }
        else if (typeof t == 'undefined')
            var t = this.getOverlayAttachment();

        if (!t.length)
            return;

        var o_label,
            mode = this.getSelectionMode(t);

        if (mode == 'component' && !t.is('[data-component]'))
            t = t.parent();

        switch (mode)
        {
            default: o_label = t.get(0).tagName; break;
            case 'column':
                o_label = 'Column (' + (t.attr('class').match(/\bcol-([a-z]+)-([0-9]+)/g) || []).join(' ') + ')';
                break;

            case 'row': o_label = 'Row'; break;
            case 'component':
                options = this.getOptions(t);
                o_label = 'Component (' + options.view.label + ')';
                break;
        }

        t.uniqueId();
        overlay.attr('data-id', t.attr('id'));
        overlay.find('#overlay-label').text(o_label);

        if (overlay.is(this.overlays.select))
        {
            this.connectOverlayToSortables(t);
            this.hideOverlay(this.overlays.hover);
        }

        overlay
            .css({
                'top': t.offset().top - parseInt(jQuery('body, html').css('paddingTop')),
                'left': t.offset().left,
                'width': t.outerWidth(),
                'height': t.outerHeight()
            })
            .find('.btn-group.open > .dropdown-toggle').click()
            .end()
            .find('[id*="overlay-menu"]').show()
            .end()
            .show();

        if (t.outerWidth() < 100)
            overlay.find('[id*="overlay-menu"]').hide();

        if (overlay.is(this.overlays.select))
        {
            this.updateBreadcrumb();

            // code editor via angular
            if (this.scope && this.scope.toggleCodeEditor)
                this.updateEditor();

            // options
            var options = this.getOptions(t);
            this.toggleOverlayOptions(options);
        }

        // toggleCK('off');
    };

    builder.prototype.getOptions = function(t)
    {
        t = typeof t == 'undefined' ? this.getOverlayAttachment() : t;
        return t.data('options') ?
            (typeof t.data('options') == 'string' ?
                this.$.parseJSON(t.data('options').replace(/\\u0022/g, '"')) :
                t.data('options')) :
            false;
    };

    builder.prototype.setOptions = function(t,o)
    {
        t.data('options', o);
        this.changeComponent(false, t);
        this.saveComponent();
        return o;
    };

    builder.prototype.toggleOverlayOptions = function(options)
    {
        var eo = this.overlay.find('#overlay-edit-options');
        eo.hide();

        if (!( typeof options.form != 'undefined' && options.form.length ))
            return;

        if (options)
            eo.show();
    };

    builder.prototype.getOverlayAttachment = function(overlay)
    {
        overlay = typeof overlay == 'undefined' ? this.overlays.select : overlay;
        return this.$('#' + overlay.attr('data-id'));
    };

    builder.prototype.getOverlayComponent = function()
    {
        var a = this.getOverlayAttachment();
        var c = a.closest('[data-component]');
        return c.length ? c.attr('data-component') : false;
    };

    builder.prototype.connectOverlayToSortables = function(t)
    {
        t = typeof t == 'undefined' ? this.getOverlayAttachment() : t;

        var s = false,
            mode = this.getSelectionMode(t),
            disabled = this.overlay.draggable('option', 'disabled');

        switch (mode)
        {
            default:

                if (t.is('li'))
                {
                    s = t.closest('ul') || false;
                    if (!s.length) s = t.closest('ol') || false;
                }

                else if (t.is('div') && !t.is(this.container))
                    s = this.$('div.ui-sortable', this.container);

                else if (t.is('p'))
                    s = this.$('div.ui-sortable', this.container);

                else if (t.is(':header') && !t.parent().is('.widget-head'))
                    s = this.$('div.ui-sortable', this.container);

                else s = false;
                if (s && !s.length) s = false;
                break;

            case 'column': s = t.closest('.row') || false; break;
            case 'row': s = this.$(this.container); break;
            case 'component':
                s = this.$('div.ui-sortable', this.container);
                break;
        }

        this.overlay.draggable('option', 'connectToSortable', s);

        if (!s)
            this.overlay.draggable('disable').find('#overlay-move').hide();
        else if (s && disabled)
            this.overlay.draggable('enable').find('#overlay-move').show();
    };

    builder.prototype.getElement = function(x, y, searchDown, m)
    {
        var elem = this.fc.elementFromPoint(x, y),
            t = false,
            res = [];

        var mode = this.mode;

        if (typeof m != 'undefined')
            mode = m;

        searchDown = typeof searchDown == 'undefined' ? false : searchDown;

        while(elem)
        {
            if (!this.$(elem).is(this.overlays.select)
                && !this.$(elem).is(this.overlays.hover)
                && !this.$(elem).closest(this.overlays.select).length
                && !this.$(elem).closest(this.overlays.hover).length
                && !this.isExcluded(this.$(elem)))
            {
                t = this.$(elem);
                break;
            }

            if (elem.tagName == 'BODY')
                break;

            if (elem.tagName == 'HTML')
                break;

            res.push(elem);
            elem.style.visibility = "hidden";
            elem = this.fc.elementFromPoint(x, y);
        }

        for(var i = 0; i < res.length; i++)
            res[i].style.visibility = "visible";

        switch (mode)
        {
            default: break;

            case 'column':
                if (t && !t.is('[class*="col-"]')) t = t.closest('[class*="col-"]');
                break;

            case 'row':
                if (t && !t.is('.row')) t = t.closest('.row');
                break;

            case 'component':
                if (t && !t.is('[data-component]'))
                {
                    var tt = t.closest('[data-component]');

                    if (!tt.length && searchDown === true)
                        tt = t.find('[data-component]').first();

                    t = tt;
                }
                break;
        }

        return !t.length ? false : t;
    };

    builder.prototype.isExcluded = function(t)
    {
        if (typeof t == 'undefined')
            return true;

        var excludeElements = ['body', 'canvas', 'table', '[data-builder-exclude*="element"]', '[data-builder-exclude=""]'],
            excludeParents = ['canvas', 'table', '[data-builder-exclude*="children"]'],
            excludeDirectParents = ['body'],
            excluded = false;

        // common theme elements
        excludeElements.push('.widget-head', '.widget-body', 'i');

        // common bootstrap elements
        excludeElements.push('.clearfix', '.pull-left', '.pull-right');

        // bootstrap switch
        excludeParents.push('.make-switch');

        this.$.each(excludeElements, function(k,v)
        {
            if (t.is(v))
            {
                excluded = true;
                return false;
            }
        });

        this.$.each(excludeParents, function(k,v)
        {
            if (t.parents(v).length)
            {
                excluded = true;
                return false;
            }
        });

        this.$.each(excludeDirectParents, function(k,v)
        {
            if (t.parent(v).length)
            {
                excluded = true;
                return false;
            }
        });

        if (t.is(this.container) || !this.$(this.container).find(t).length) return true;

        var t_parent_component = t.closest('[data-component]');
        var t_options = t_parent_component.length ? this.getOptions(t_parent_component) : false;
        if (!t.is('[data-component]') && t_options !== false && typeof t_options.type !== 'undefined' && t_options.type != 'template') return true;

        return excluded;
    };

    builder.prototype.deleteElement = function()
    {
        if (!confirm('Are you sure you want to delete this selection?'))
            return;

        this.changeComponent();

        this.hideOverlay();

        var t = this.getOverlayAttachment(),
            p = t.parent();

        t.remove();

        if (!this.$.trim(p.text()).length && !p.children().length)
            p.empty();

        if (p.is('.row') && !p.children().length)
            p.remove();

        this.saveComponent();
    };

    builder.prototype.selectRow = function()
    {
        // mode = 'row';
        var xy = this.getXY(this.overlay.offset().left, this.overlay.offset().top),
            x = xy.x,
            y = xy.y;

        var t = this.getElement(x, y, false, 'row');
        t ? this.attachOverlay(t) : this.overlay.hide();
    };

    builder.prototype.selectColumn = function()
    {
        // mode = 'column';
        var xy = this.getXY(this.overlay.offset().left, this.overlay.offset().top),
            x = xy.x,
            y = xy.y;

        var t = this.getElement(x, y, false, 'column');
        t ? this.attachOverlay(t) : this.overlay.hide();
    };

    builder.prototype.selectComponent = function()
    {
        // mode = 'component';
        var xy = this.getXY(this.overlay.offset().left, this.overlay.offset().top),
            x = xy.x,
            y = xy.y;

        var t = this.getElement(x, y, true, 'component');
        t ? this.attachOverlay(t) : this.overlay.hide();
    };

    builder.prototype.hideOverlay = function(overlay)
    {
        overlay = typeof overlay == 'undefined' ? this.overlays.select : overlay;
        overlay.hide();

        if (overlay.is(this.overlays.select))
        {
            this.overlays.hover.hide();
            this.updateBreadcrumb();
        }
    };

    builder.prototype.getXY = function(x, y)
    {
        if (this.fw.pageXOffset > 0)
            x -= this.fw.pageXOffset;

        if (this.fw.pageYOffset > 0)
            y -= this.fw.pageYOffset;

        return { "x": x, "y": y };
    };

    builder.prototype.bindOverlayControls = function()
    {
        var builder = this;
        this.overlay
            .find('.deleteElement').on('click', function(e)
            {
                e.preventDefault();
                builder.deleteElement();
            })
            .end()
            .find('#closeOverlay').on('click', function(e)
            {
                e.preventDefault();
                builder.overlay.hide();
            })
            .end()
            .find('#selectAll').on('click', function(e)
            {
                e.preventDefault();
                if (builder.mode == 'column')
                    return builder.selectRow();

                builder.selectColumn();
            })
            .end();

        this.overlay.find('#toggleCodeEditor').on('click', function(e)
        {
            e.preventDefault();
            builder.toggleCodeEditor();
        });

        this.overlay.find('#toggleOptionsEditor').add(this.overlay.find('#overlay-edit-options')).on('click', function(e)
        {
            e.preventDefault();
            builder.toggleOptionsEditor();
        });

        this.overlay.on('dblclick', function(event)
        {
            event.stopPropagation();
            var xy = builder.getXY(event.pageX, event.pageY),
                x = xy.x,
                y = xy.y,
                t = builder.getOverlayAttachment(),
                mode = builder.getSelectionMode(t),
                text = builder.$.trim(t.text());

            if (mode == 'column')
                return builder.selectRow();

            var c =
                t.find("*")
                    .addBack()
                    .filter(function()
                    {
                        var $t = builder.$(this);
                        return !builder.isExcluded($t)
                            && builder.$.trim($t.text()).length > 0;
                    })
                    .first();

            // if (c.length) builder.toggleCK('on', c);
        });
    };

    builder.prototype.makeSortableRows = function()
    {
        var builder = this;
        var rows = this.$('.row', this.document).not('.ui-sortable');
        rows = rows
            .filter(function(index){
                return !builder.$(this).closest('[data-builder-exclude]').length;
            });

        rows.each(function()
        {
            builder.$(this).sortable(
                {
                    handle: '#someInexistentHandle',
                    items: '> [class*="col-"]',
                    tolerance: 'pointer',
                    axis: 'x',
                    placeholder: 'placeholder-draggable',
                    forceHelperSize: true,
                    forcePlaceholderSize: true,
                    over: function(e, ui)
                    {
                        var el = builder.getOverlayAttachment();
                        if (!el.is('[class*="col-"]'))
                            ui.placeholder.hide();
                    },
                    start: function(e, ui)
                    {
                        var helperClass = ui.helper.attr('class');
                        ui.placeholder.addClass(helperClass);
                        builder.changeComponent();
                    },
                    stop: function(e, ui)
                    {
                        var el = builder.getOverlayAttachment();
                        if (!el.is('[class*="col-"]'))
                            return ui.item.remove();

                        el.show();
                        ui.item.replaceWith(el).show();
                        builder.attachOverlay();
                        builder.changeComponent();
                        builder.saveComponent();
                    }
                });

        });
    };

    builder.prototype.makeSelectionSortable = function(selection)
    {
        var builder = this;
        selection.sortable(
            {
                handle: '#someInexistentHandle',
                items: '> *',
                tolerance: 'pointer',
                placeholder: 'placeholder-draggable',
                forceHelperSize: true,
                forcePlaceholderSize: true,
                connectWith: selection,
                start: function(e, ui)
                {
                    var t = builder.getOverlayAttachment();
                    builder.changeComponent();

                    ui.placeholder.css({
                        float: t.css('float'),
                        width: t.outerWidth(),
                        height: t.height()
                    });
                },
                stop: function(e, ui)
                {
                    var el = builder.getOverlayAttachment().show();
                    ui.item.replaceWith(el).show();
                    builder.attachOverlay();
                    builder.changeComponent();
                    builder.saveComponent();
                }
            });
    };

    builder.prototype.makeSortables = function()
    {
        this.makeSortableRows();

        var sortableDivs = this.$('div', this.document);
        if (this.$(this.document).is('div'))
            sortableDivs = sortableDivs.add(this.document);

        sortableDivs = sortableDivs.filter(':allowSortable');
        this.makeSelectionSortable(sortableDivs);

        var sortableLists = this.$('ul', this.document).filter(':allowSortable');
        this.makeSelectionSortable(sortableLists);

        var sortableOrderedLists = this.$('ol', this.document).filter(':allowSortable');
        this.makeSelectionSortable(sortableOrderedLists);
    };

    builder.prototype.bindKeys = function()
    {
        // check for dependency
        if (typeof this.fw.key == 'undefined')
            return;

        // bind keys
        this.bindKeysSave();
        this.bindKeysCode();
        this.bindKeysNavigation();
        this.bindKeysEscape();
        this.bindKeysOptions();
        this.bindKeysRemove();
        this.bindKeysDuplicate();
        this.bindKeysGrid();
    };

    builder.prototype.bindKeysCode = function()
    {
        var builder = this;
        this.fw.key('command+e', function(e, handler)
        {
            e.preventDefault();
            builder.toggleCodeEditor();
        });
    };

    builder.prototype.bindKeysNavigation = function()
    {
        var builder = this;

        this.fw.key('right', function(e, handler)
        {
            if (!builder.overlay.is(':visible'))
                return;

            var t = builder.getOverlayAttachment(),
                n = t.next().filter(function(){ return !builder.isExcluded(builder.$(this)); }),
                matches = false,
                mode = builder.getSelectionMode(t);

            if (mode == 'row')
                matches = builder.$('body').find('.row');

            else if (mode == 'column')
                matches = builder.$('body').find('[class*="col-"]');

            else if (mode == 'component')
                matches = builder.$('body').find('[data-component]');

            else
                matches = builder.$('body').find(t.get(0).nodeName);

            if (matches)
            {
                matches = matches
                    .filter(function(index){
                        return !builder.isExcluded(builder.$(this))
                            && builder.$(this).is(':visible');
                    });

                var t_index = matches.index(t) + 1;
                n = matches.eq(t_index).length ? matches.eq(t_index) : matches.eq(0);
            }

            if (typeof n != 'undefined' && n.length)
                builder.attachOverlay(n);
        });

        this.fw.key('left', function(e, handler)
        {
            if (!builder.overlay.is(':visible'))
                return;

            var t = builder.getOverlayAttachment(),
                n = t.prev().filter(function(){ return !builder.isExcluded(builder.$(this)); }),
                matches = false,
                mode = builder.getSelectionMode(t);

            if (mode == 'row')
                matches = builder.$('body').find('.row');

            else if (mode == 'column')
                matches = builder.$('body').find('[class*="col-"]');

            else if (mode == 'component')
                matches = builder.$('body').find('[data-component]');

            else
                matches = builder.$('body').find(t.get(0).nodeName);

            if (matches)
            {
                matches = matches
                    .filter(function(index){
                        return !builder.isExcluded(builder.$(this))
                            && builder.$(this).is(':visible');
                    });

                var t_index = matches.index(t);
                n = matches.eq(t_index - 1);
            }

            if (n.length)
                builder.attachOverlay(n);
        });
    };

    builder.prototype.bindKeysSave = function()
    {
        var builder = this;
        this.fw.key('command+s,ctrl+s', function(e, handler)
        {
            e.preventDefault();
            builder.scope.handleKeySave();
        });
    };

    builder.prototype.bindKeysEscape = function()
    {
        var builder = this;
        this.fw.key('escape', function(e, handler)
        {
            if (builder.overlay.is(':visible'))
            {
                e.preventDefault();
                builder.hideOverlay();
            }
            // builder.toggleCK('off');
            builder.toggleCodeEditor(false);
        });
    };

    builder.prototype.bindKeysOptions = function()
    {
        var builder = this;
        this.fw.key('o', function(e, handler)
        {
            if (builder.overlay.is(':visible'))
                builder.overlay.find('.btn-group > .dropdown-toggle').click();
        });
    };

    builder.prototype.bindKeysRemove = function()
    {
        var builder = this;
        this.fw.key('command+backspace, del', function(e, handler)
        {
            if (!builder.overlay.is(':visible'))
                return;

            e.preventDefault();
            builder.deleteElement();
        });
    };

    builder.prototype.bindKeysDuplicate = function()
    {
        var builder = this;
        this.fw.key('command+d', function(e, handler)
        {
            if (!builder.overlay.is(':visible'))
                return;

            e.preventDefault();
            var t = builder.getOverlayAttachment(),
                n = t.clone(),
                mode = builder.getSelectionMode(t);

            t.after(n);

            n.add(n.find('[class*="col-"], .row, [data-component]'))
                .removeUniqueId()
                .uniqueId();

            if (mode == 'row' || mode == 'column')
            {
                n.add(n.find('.row, [class*="col-"]')).removeClass('ui-sortable');
                builder.makeSortables();
            }

            builder.attachOverlay(n);
            builder.changeComponent();
            builder.saveComponent();
        });
    };

    builder.prototype.gridMake = function(cols_requested)
    {
        var cols_class,
            cols_total = 12,
            row_template = this.$('<div class="row"></div>');

        cols_class = 'col-md-' + (cols_total / cols_requested);

        for(var i=1;i<=cols_requested;i++)
            row_template.append('<div class="' + cols_class + '"></div>');

        return row_template;
    };

    builder.prototype.gridApply = function(grid)
    {
        grid.add(grid.find('[class*="col-"]')).uniqueId();

        this.makeSortables();
        this.attachOverlay(grid.children().first());
    };

    builder.prototype.bindKeysGrid = function()
    {
        var builder = this;

        // create grid
        this.fw.key('command+1, command+2, command+3, command+4', function(e, handler)
        {
            e.preventDefault();
            var t = builder.getOverlayAttachment(),
                mode = builder.getSelectionMode(t),
                p = (mode == 'column') ? t.closest('.row') : t,
                cols_requested,
                grid;

            switch (handler.shortcut)
            {
                default: break;
                case 'command+1': cols_requested = 1; break;
                case 'command+2': cols_requested = 2; break;
                case 'command+3': cols_requested = 3; break;
                case 'command+4': cols_requested = 4; break;
            }

            grid = builder.gridMake(cols_requested);

            if (builder.overlay.is(':visible'))
                p.after(grid);
            else
                builder.$(builder.container).prepend(grid);

            builder.gridApply(grid);

            builder.changeComponent();
            builder.saveComponent();
        });

        // change grid
        this.fw.key('1,2,3,4,5,6,7,8,9,ctrl+0,ctrl+1,ctrl+2', function(e, handler)
        {
            if (builder.overlay.is(':visible') && builder.getSelectionMode() == 'column')
            {
                e.preventDefault();
                var t = builder.getOverlayAttachment(),
                    r = t.closest('.row'),
                    cols_total = 12,
                    cols_remaining = 0,
                    cols = r.find('> [class*="col-"]'),
                    col_class = 0;

                switch (handler.shortcut)
                {
                    default:
                        cols_remaining = cols_total - handler.shortcut;
                        col_class = handler.shortcut;
                        break;

                    case 'ctrl+0':
                        cols_remaining = 2;
                        col_class = cols_total - cols_remaining;
                        break;

                    case 'ctrl+1':
                        cols_remaining = 1;
                        col_class = cols_total - cols_remaining;
                        break;

                    case 'ctrl+2':
                        cols_remaining = 12;
                        col_class = 12;
                        break;
                }

                t.removeClass (function (index, css) {
                    return (css.match (/\bcol-md-([0-9]+)/g) || []).join(' ');
                })
                    .addClass('col-md-' + col_class);

                if (cols.length == 2 || handler.shortcut == 'ctrl+2')
                {
                    cols.not(t)
                        .removeClass(function (index, css) {
                            return (css.match (/\bcol-md-([0-9]+)/g) || []).join(' ');
                        })
                        .addClass('col-md-' + cols_remaining);
                }

                builder.attachOverlay(t);
                builder.changeComponent();
                builder.saveComponent();
            }
        });
    };

    builder.prototype.toggleCodeEditor = function(m)
    {
        if (!this.scope)
            return false;

        var builder = this,
            e = this.scope.toggleCodeEditor,
            ee = (typeof m == 'undefined') ? !e : m;

        this.scope.safeApply(function()
        {
            builder.scope.toggleCodeEditor = ee;
            if (ee && builder.overlay.is(':visible')) builder.attachOverlay();
        });
    };

    builder.prototype.toggleOptionsEditor = function()
    {
        var iframe_data = {
                action: 'builder_editor',
                options: this.getOptions()
            },
            data = this.$.param(iframe_data);

        console.log(data);
        tb_show('', ajaxurl + '?' + data + '#TB_iframe');
    };

    builder.prototype.updateBreadcrumb = function()
    {
        if (!this.scope)
            return false;

        var builder = this;

        this.scope.safeApply(function(){
            builder.scope.breadcrumb = builder.getBreadcrumb();
        });
    };

    builder.prototype.getBreadcrumb = function()
    {
        var builder = this,
            a = this.getOverlayAttachment(),
            e = [];

        if (a.length && this.overlay.is(':visible'))
        {
            var b = a.parents(),
                c = b.get().reverse(),
                d = this.getOverlayAttachment().add(this.$(c));

            e = d
                .filter(function()
                {
                    return !builder.$(this).is('body, html')
                        && (builder.$(this).parents(builder.container).length);
                })
                .map(function(index)
                {
                    var t = builder.$(this),
                        id = t.uniqueId().attr('id'),
                        nn = t.get(0).nodeName,
                        m = builder.getSelectionMode(t),
                        name = ((typeof m == 'undefined') ? nn : m) + '(' + index + ')';

                    return {
                        name: name,
                        id: id
                    };

                })
                .get();
        }
        return e;
    };

    builder.prototype.selectBreadcrumb = function(id)
    {
        var t = this.$(this.container).find('#' + id);
        if (t && t.length)
            this.attachOverlay(t);
    };

    builder.prototype.makeTemplate = function(html, outer, display_options)
    {
        if (!html.length)
            return;

        var builder = this;

        outer = typeof outer == 'undefined' ? false : outer;
        display_options = typeof display_options == 'undefined' ? true : display_options;

        html.find('[id*="overlay"]').remove();
        html.find('*')
            .removeClass('column')
            .removeClass (function (index, css) {
            return (css.match (/\bui-\S+/g) || []).join(' ');
        })
        .removeAttr('style');

        html.find('style, script').remove();
        html.contents().filter(function(){
            return this.nodeType == 8;
        })
        .remove();

        html.find('[id*="ui-id-"]').removeUniqueId();
        html.find('[data-component]').each(function(k,v)
        {
            var c = builder.$(v),
                options = builder.getOptions(c),
                options_str = builder.$.param(options);

            var component = "{{" + c.attr('data-component');
            if (display_options && options_str.length)
                component += " options=\"" + options_str + "\"";
            component += "}}";

            c.after(component).remove();
        });

        // drag & drop cleanup
        html.find('.component').add(html.find('[data-id]:empty')).remove();

        html = outer ? html.prop('outerHTML') : html.html();
        html = html.replace(/(\r\n|\n|\r|\t)/gm,"");
        html = html.replace(/(\}\}\{\{)/gm,"}} {{");
        html = builder.beautify(html);

        return html;
    };

    builder.prototype.getTemplate = function(outer, display_options)
    {
        outer = typeof outer == 'undefined' ? true : outer;
        display_options = typeof display_options == 'undefined' ? true : display_options;

        var templateContent = this.$(this.container).clone(true),
            template = this.makeTemplate(templateContent, outer, display_options);

        return template;
    }

    builder.prototype.updateEditor = function()
    {
        if (!this.scope)
            return false;

        var a = this.getOverlayAttachment(),
            b = a.length && this.overlay.is(':visible') ?
                a.data('original') ? this.$('<div/>').html(a.data('original')) : a.clone(true) :
                false,
            c = !b ? b : a.is('[data-component]') ? b : this.$('<div/>').html(b.prop('outerHTML')).find('> *').first().html(b).end();

        var d = !c ? this.getTemplate(false) : this.makeTemplate(c, false),
            e = this.beautify(d),
            builder = this;

        this.scope.safeApply(function(){
            builder.scope.bodyEditor = e;
        });
    };

    builder.prototype.beautify = function (source)
    {
        if (typeof html_beautify == 'undefined')
            return source;

        var output,
            opts = {};

        opts.preserve_newlines = false;
        output = html_beautify(source, opts);
        return output;
    }

    builder.prototype.saveComponent = function(reload)
    {
        reload = typeof reload == 'undefined' ? false : reload;

        var builder = this,
            changes = builder.$('[data-builder-saveComponent]');

        if (changes.length)
        {
            var components = changes.map(function(){
                    return builder.$(this).attr('data-component');
                }).get().reverse(),
                components_str = components.join(', ');

            var sct = setInterval(function()
            {
                if (!components.length)
                {
                    sct = clearInterval(sct);
                    builder.ngSavePage(reload);
                }
                if (!builder.scope.saveComponent)
                {
                    var componentName = components.shift(),
                        t = changes.filter('[data-component*="' + componentName + '"]'),
                        id = builder.isGuid(componentName, ""),
                        template;

                    if (id && id.length)
                        id = id[0];
                    else
                    {
                        id = builder.guid();
                        t.attr('data-component', id);
                    }

                    if (t.data('original'))
                        template = builder.makeTemplate(builder.$('<div/>').html(t.data('original')));
                    else
                        template = builder.makeTemplate(t.clone());

                    var o = {
                        name: componentName,
                        template: template,
                        id: id
                    };

                    builder.ngSaveComponent(o);
                }
            }, 10);

            builder.changeComponent(true);
        }
        else
            builder.ngSavePage(reload);
    };

    builder.prototype.changeComponent = function(r,t)
    {
        r = typeof r == 'undefined' ? false : r;
        t = typeof t == 'undefined' ? this.getOverlayAttachment() : t;
        var builder = this;

        if (r === false)
        {
            var p = t.parents('[data-component]').addBack().filter(function()
            {
                var t_options = builder.getOptions(t);
                return typeof t_options.type !== 'undefined' && t_options.type == 'template';
            });
            if (p.length) p.attr('data-builder-saveComponent', true);
        }
        else
            this.$('[data-builder-saveComponent]').removeAttr('data-builder-saveComponent');
    };

    builder.prototype.ngSaveComponent = function(o)
    {
        var builder = this;
        this.scope.safeApply(function()
        {
            builder.scope.savePage = {};
            builder.scope.saveComponent = o;
        });
    };

    builder.prototype.ngSavePage = function(reload)
    {
        reload = typeof reload == 'undefined' ? false : reload;

        var template = this.getTemplate(false),
            searchId = this.scope.page.id,
            id = searchId ? this.isGuid(searchId) : false,
            builder = this;

        if (id && id.length)
            id = id[0];
        else
        {
            id = this.guid();
            this.scope.safeApply(function(){
                builder.scope.page.id = id;
            });
        }

        var o = {
            id: id,
            template: template,
            reload: reload
        };

        var builder = this;
        this.scope.safeApply(function()
        {
            builder.scope.page.saving = o;
            builder.scope.savePageRequest(o);
        });
    };

    builder.prototype.applyComponent = function(save)
    {
        save = typeof save == 'undefined' ? true : save;
        var components = this.$('[data-component]', this.container),
            builder = this;

        components = components.filter(function(){
            return !builder.$(this).data('apply');
        });

        if (!components.length)
            return;

        components.each(function()
        {
            var t = builder.$(this),
                component = t.data('component'),
                options = builder.getOptions(t);

            if (component.indexOf('grid-') >= 0)
            {
                var split = component.split('grid-');
                var cols = split[1];

                var grid = builder.gridMake(cols).data('apply', true);
                t.after(grid).remove();
                builder.gridApply(grid);
            }
            else
            {
                // create a container for the component
                var e = builder.$('<div></div>'),

                    // get the component default view options
                    e_options_view_default = builder.getComponentViewOptions(t),

                    // merge the component default view options with view options passed with data
                    e_options_view_data = t.data('view') ?
                        builder.$.extend({}, e_options_view_default, t.data('view')) :
                        e_options_view_default,

                    // merge the above view options with custom view options stored in the component's options data
                    // these view options are used in the template
                    e_options_view = typeof options.view == 'object' ?
                        builder.$.extend({}, e_options_view_data, options.view) :
                        e_options_view_data,

                    // merge the view options with the component's options for saving
                    e_options = builder.$.extend({}, options, {
                        'view': {
                            'id': e_options_view.id,
                            'label': e_options_view.label
                        }
                    }),

                    e_html =
                        typeof options.type !== 'undefined' && options.type == 'template' ? t.html() :
                        '<div class="media">'
                            + '<span class="fa fa-fw pull-left ' + e_options_view.icon + '"></span>'
                            + '<div class="media-body">'
                                + '<h5>' + e_options_view.label + '</h5>'
                                + '<p class="text-muted"><small>' + e_options_view.description + '</small></p>'
                            + '</div>'
                        + '</div>';

                e.addClass('component')
                    .attr('data-component', t.attr('data-component'))
                    .data('options', e_options)
                    .data('apply', true)
                    .html(e_html);

                builder.$(t.get(0).attributes).each(function()
                {
                    if (this.nodeName.indexOf('data-builder-') >= 0)
                        e.attr(this.nodeName, this.nodeValue);
                });

                t.after(e).remove();
                builder.makeSortables();

                if (save)
                    builder.changeComponent(false, e);
            }
        });

        if (save)
            builder.saveComponent();
    };

    builder.prototype.getComponentViewOptions = function(t)
    {
        var component = t.attr('data-component'),
            options_view_default = {
                'id': component,
                'label': component,
                'description': 'no description available',
                'icon': 'fa-2x fa-windows'
            },
            components_scope = angular.element('#gallery-components').scope(),
            components_list = components_scope.components,
            options_view = {};

        this.$.each(components_list, function(ck,cv){
            var view = cv.views.filter(function(o){ return o.component.id == component });
            if (view.length) {
                options_view = view[0].component;
                return false;
            }
        })

        return this.$.extend({}, options_view_default, options_view);
    };

    builder.prototype.isGuid = function(id, prefix)
    {
        if (typeof id == 'undefined')
            return false;

        if (!id.length)
            return false;

        // 47e8c425-8fda-d829-0e0b-1e89beb19935
        prefix = typeof prefix == 'undefined' ? '' : prefix;

        var regex = new RegExp(prefix + "([a-z0-9]+)-([a-z0-9]+)-([a-z0-9]+)-([a-z0-9]+)-([a-z0-9]+)", "ig");
        return id.match(regex);
    };

    builder.prototype.guid = function()
    {
        var S4 = function(){ return (((1+Math.random())*0x10000)|0).toString(16).substring(1); };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    };

    builder.prototype.locationSearchObj = function()
    {
        var search = location.search.substring(1);
        return this.deserialize(search);
    }

    builder.prototype.deserialize = function(str)
    {
        var obj = {};
        if (typeof str !== "string")
            return obj;

        parse_str(str, obj);
        return obj;
    };

    window.builder = builder;

})(jQuery);

function parse_str(str, array) {
    //       discuss at: http://phpjs.org/functions/parse_str/
    //      original by: Cagri Ekin
    //      improved by: Michael White (http://getsprink.com)
    //      improved by: Jack
    //      improved by: Brett Zamir (http://brett-zamir.me)
    //      bugfixed by: Onno Marsman
    //      bugfixed by: Brett Zamir (http://brett-zamir.me)
    //      bugfixed by: stag019
    //      bugfixed by: Brett Zamir (http://brett-zamir.me)
    //      bugfixed by: MIO_KODUKI (http://mio-koduki.blogspot.com/)
    // reimplemented by: stag019
    //         input by: Dreamer
    //         input by: Zaide (http://zaidesthings.com/)
    //         input by: David Pesta (http://davidpesta.com/)
    //         input by: jeicquest
    //             note: When no argument is specified, will put variables in global scope.
    //             note: When a particular argument has been passed, and the returned value is different parse_str of PHP. For example, a=b=c&d====c
    //             test: skip
    //        example 1: var arr = {};
    //        example 1: parse_str('first=foo&second=bar', arr);
    //        example 1: $result = arr
    //        returns 1: { first: 'foo', second: 'bar' }
    //        example 2: var arr = {};
    //        example 2: parse_str('str_a=Jack+and+Jill+didn%27t+see+the+well.', arr);
    //        example 2: $result = arr
    //        returns 2: { str_a: "Jack and Jill didn't see the well." }
    //        example 3: var abc = {3:'a'};
    //        example 3: parse_str('abc[a][b]["c"]=def&abc[q]=t+5');
    //        returns 3: {"3":"a","a":{"b":{"c":"def"}},"q":"t 5"}

    var strArr = String(str)
            .replace(/^&/, '')
            .replace(/&$/, '')
            .split('&'),
        sal = strArr.length,
        i, j, ct, p, lastObj, obj, lastIter, undef, chr, tmp, key, value,
        postLeftBracketPos, keys, keysLen,
        fixStr = function (str) {
            return decodeURIComponent(str.replace(/\+/g, '%20'));
        };

    if (!array) {
        array = this.window;
    }

    for (i = 0; i < sal; i++) {
        tmp = strArr[i].split('=');
        key = fixStr(tmp[0]);
        value = (tmp.length < 2) ? '' : fixStr(tmp[1]);

        while (key.charAt(0) === ' ') {
            key = key.slice(1);
        }
        if (key.indexOf('\x00') > -1) {
            key = key.slice(0, key.indexOf('\x00'));
        }
        if (key && key.charAt(0) !== '[') {
            keys = [];
            postLeftBracketPos = 0;
            for (j = 0; j < key.length; j++) {
                if (key.charAt(j) === '[' && !postLeftBracketPos) {
                    postLeftBracketPos = j + 1;
                } else if (key.charAt(j) === ']') {
                    if (postLeftBracketPos) {
                        if (!keys.length) {
                            keys.push(key.slice(0, postLeftBracketPos - 1));
                        }
                        keys.push(key.substr(postLeftBracketPos, j - postLeftBracketPos));
                        postLeftBracketPos = 0;
                        if (key.charAt(j + 1) !== '[') {
                            break;
                        }
                    }
                }
            }
            if (!keys.length) {
                keys = [key];
            }
            for (j = 0; j < keys[0].length; j++) {
                chr = keys[0].charAt(j);
                if (chr === ' ' || chr === '.' || chr === '[') {
                    keys[0] = keys[0].substr(0, j) + '_' + keys[0].substr(j + 1);
                }
                if (chr === '[') {
                    break;
                }
            }

            obj = array;
            for (j = 0, keysLen = keys.length; j < keysLen; j++) {
                key = keys[j].replace(/^['"]/, '')
                    .replace(/['"]$/, '');
                lastIter = j !== keys.length - 1;
                lastObj = obj;
                if ((key !== '' && key !== ' ') || j === 0) {
                    if (obj[key] === undef) {
                        obj[key] = {};
                    }
                    obj = obj[key];
                } else {
                    // To insert new dimension
                    ct = -1;
                    for (p in obj) {
                        if (obj.hasOwnProperty(p)) {
                            if (+p > ct && p.match(/^\d+$/g)) {
                                ct = +p;
                            }
                        }
                    }
                    key = ct + 1;
                }
            }
            lastObj[key] = value;
        }
    }
}