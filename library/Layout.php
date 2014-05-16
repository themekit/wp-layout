<?php namespace Mosaicpro\WP\Plugins\Layout;

use Mosaicpro\Button\Button;
use Mosaicpro\ButtonGroup\ButtonGroup;
use Mosaicpro\ButtonGroup\ButtonToolbar;
use Mosaicpro\WpCore\FormBuilder;
use Mosaicpro\WpCore\MetaBox;
use Mosaicpro\WpCore\PluginGeneric;
use Mosaicpro\WpCore\PostType;
use Mosaicpro\WpCore\ThickBox;

/**
 * Class Layout
 * @package Mosaicpro\WP\Plugins\Layout
 */
class Layout extends PluginGeneric
{
    /**
     * Holds a Layout instance
     * @var
     */
    protected static $instance;

    /**
     * Initialize the plugin
     */
    public static function init()
    {
        $instance = self::getInstance();

        // i18n
        $instance->loadTextDomain();

        // Load Plugin Templates into the current Theme
        $instance->plugin->initPluginTemplates();

        // Initialize Layout Admin
        $instance->initAdmin();

        // Initialize Shared resources
        $instance->initShared();

        // Initialize Layout Shortcodes
        $instance->initShortcodes();
    }

    /**
     * Get a Singleton instance of Layout
     * @return static
     */
    public static function getInstance()
    {
        if (is_null(self::$instance))
        {
            self::$instance = new static();
        }

        return self::$instance;
    }

    public static function activate()
    {
        $instance = self::getInstance();
        $instance->post_types();
        flush_rewrite_rules();
    }

    /**
     * Initialize Admin only resources
     * @return bool
     */
    private function initAdmin()
    {
        if (!is_admin()) return false;
        $this->enqueueAdminAssets();
        $this->metaboxes();
        $this->handle_options_editor();
        $this->handle_save_page();
        $this->handle_get_page();
        $this->handle_parse_page();
    }

    private function initShared()
    {
        $this->post_types();
    }

    private function post_types()
    {
        PostType::make('page', $this->prefix)
            ->setOptions(['show_ui' => false, 'supports' => false])
            ->register();
    }

    private function enqueueAdminAssets()
    {
        add_action('admin_footer', function()
        {
            echo $this->getBuilderOverlay();
        });
        add_action('admin_enqueue_scripts', function()
        {
            wp_enqueue_style('mp-layout-admin', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/css/layout-admin.css');

            // dependencies
            wp_enqueue_script('mp-keymaster', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/keymaster/keymaster.js', ['jquery'], false, true);

            // Angular libraries
            wp_enqueue_script('mp-angular', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/angular/angular.min.js', ['jquery'], false);
            wp_enqueue_script('mp-angular-animate', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/angular/angular-animate.js', ['mp-angular'], false);

            // Beautify
            wp_enqueue_script('mp-beautify', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/beautify/beautify.js', ['jquery'], false);
            wp_enqueue_script('mp-beautify-html', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/beautify/beautify-html.js', ['mp-beautify'], false);

            // CodeMirror
            wp_enqueue_style('mp-codemirror', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/codemirror/lib/codemirror.css');
            wp_enqueue_script('mp-codemirror', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/codemirror/lib/codemirror.js', ['mp-angular'], false, true);
            wp_enqueue_script('mp-codemirror-ng', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/directives/ui-codemirror.js', ['mp-codemirror'], false, true);
            wp_enqueue_script('mp-codemirror-xml', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/codemirror/mode/xml/xml.js', ['mp-codemirror'], false, true);
            wp_enqueue_script('mp-codemirror-overlay', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/codemirror/addon/mode/overlay.js', ['mp-codemirror'], false, true);
            wp_enqueue_script('mp-codemirror-mustache', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/codemirror.mode.mustache.js', ['mp-codemirror'], false, true);

            // Builder Library
            wp_enqueue_script('mp-builder', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/lib/builder.js', ['mp-keymaster', 'mp-angular', 'mp-angular-animate'], false, true);

            // Builder Angular App
            wp_enqueue_script('mp-builder-ng-app', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/app/ng.builder.app.js', ['mp-angular'], false, true);

            // Button Checkbox Toggle Directive
            wp_enqueue_script('mp-builder-ng-directive-buttons-checkbox', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/directives/ng.directive.buttons.checkbox.js', ['mp-angular'], false, true);

            // CoreMirror Refresh Directive
            wp_enqueue_script('mp-codemirror-refresh', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/directives/ui-codemirror-refresh.js', ['mp-codemirror'], false, true);

            // Common Filters
            // js.ng.filter.isarray = 1
            wp_enqueue_script('mp-builder-ng-filter-isarray', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/filters/ng.filter.isarray.js', ['mp-angular'], false, true);

            // Components directive
            wp_enqueue_script('mp-builder-directive-components', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/directives/ng.builder.directive.components.js', ['mp-angular'], false, true);

            // iframe Directive
            // wp_enqueue_script('mp-builder-ng-directive-iframe', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/builder/angular/directives/ng.builder.directive.iframe.js', ['mp-angular'], false, true);

            // sidr
            // wp_enqueue_style('mp-sidr', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/lib/sidr/css/jquery.sidr.css');
            // wp_enqueue_script('mp-sidr', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/lib/sidr/js/jquery.sidr.js', ['jquery'], false, true);

            // Initialize Builder
            wp_enqueue_script('mp-builder-init', plugin_dir_url(plugin_dir_path(__FILE__)) . 'assets/js/layout-admin.js', ['mp-builder'], false, true);

            // jQuery UI Droppable
            wp_enqueue_script('jquery-ui-droppable');
        });
    }

    private function metaboxes()
    {
        // Layout Meta Box
        MetaBox::make($this->prefix, 'layout', $this->__('Layout'))
            ->setPostType(null)
            ->setDisplay($this->getMetaboxDisplay())
            ->setPriority('high')
            ->setContext('normal')
            ->register();
    }

    private function getMetaboxDisplay()
    {
        $formbuilder = new FormBuilder();
        return [
            '<div ng-app="App" ng-controller="AppCtrl">',

                ButtonToolbar::make()
                    ->add(
                        ButtonGroup::make()
                            ->isSm()
                            ->add(Button::regular('<i class="fa fa-fw fa-folder-open"></i> Load')->addClass('mp-layout-add-row'))
                            ->add(Button::regular('<i class="fa fa-fw fa-save"></i> Save as ..')->addAttributes([
                                'ng-click' => 'displayPageOptions=!displayPageOptions',
                                'button-checkbox' => '',
                            ])->isButton())
                    )
                    ->add(
                        $formbuilder->get_checkbox_buttons('displayComponents', null, false,
                            ['true' => '<i class="fa fa-fw fa-windows"></i> Components'],
                            ['buttons-checkbox' => '', 'ng-model' => 'displayComponents'])
                    ),

                $this->getBuilderPage(),
                $this->getBuilderComponents(),
                '<div id="mp-layout-builder" ng-show="!page.loading && !page.saving" class="animate-show ng-hide"></div>',
                $this->getBuilderFooter(),
            '</div>'
        ];
    }

    private function getBuilderPage()
    {
        $formbuilder = new FormBuilder();
        $content =
            '<div ng-show="displayPageOptions == true" class="animate-show ng-hide">
                <hr/>
                ' . $formbuilder->get_input('page.id', 'Page ID', '//page.id//') . '
            </div>';

        return $content;
    }

    private function getBuilderComponents()
    {
        $content =
            '<div id="gallery-components" class="bootstrap" ng-controller="ComponentsCtrl">
                <tree collection="components" search="search"></tree>
            </div>';

        $iframe = ThickBox::register_inline('builder-components', false, $content)->render();
        return $iframe;
    }

    private function getBuilderFooter()
    {
        $content =
            '<div id="builder-menu-bottom">' .
                $this->getBuilderBreadcrumb() .
				$this->getBuilderToggleCodeEditor() .
			'</div>' .
            $this->getBuilderCodeEditor();

        return $content;
    }

    private function handle_save_page()
    {
        $action = 'wp_ajax_builder_save_page';
        add_action($action, function()
        {
            $id = !empty($_REQUEST['id']) ? $_REQUEST['id'] : false;
            $is_post = !empty($_POST);

            if ($is_post)
            {
                // @todo: verify nonce
                // check_ajax_referer( $this->prefix . '_' . $related_item . '_nonce', 'nonce' );
                // if ( false ) wp_send_json_error( 'Security error' );

                $post_id = false;
                $related_save = [];

                $query = new \WP_Query([
                    'post_type' => $this->getPrefix('page'),
                    'meta_query' => [
                        'key' => 'page_id',
                        'value' => $id
                    ]
                ]);
                if ($query->have_posts())
                {
                    while ($query->have_posts())
                    {
                        $query->the_post();
                        $post_id = get_the_ID();
                    }
                }
                else
                {
                    $related_save = (array) @get_default_post_to_edit($this->getPrefix('page'), true);
                    update_post_meta($related_save['ID'], 'page_id', $id);
                }
                wp_reset_query();

                $related_save['post_status'] = 'publish';
                $related_save['post_content'] = $_POST['template'];

                if ($post_id) $related_save['ID'] = $post_id;
                $saved = @wp_update_post($related_save, true);

                if (is_a($saved, 'WP_Error')) wp_send_json_error($saved->get_error_messages());
                wp_send_json_success();
                die();
            }
        });
    }

    private function handle_get_page()
    {
        $action = 'wp_ajax_builder_get_page';
        add_action($action, function()
        {
            $id = !empty($_REQUEST['id']) ? $_REQUEST['id'] : false;
            $is_post = isset($_POST);

            if ($is_post)
            {
                // @todo: verify nonce
                // check_ajax_referer( $this->prefix . '_' . $related_item . '_nonce', 'nonce' );
                // if ( false ) wp_send_json_error( 'Security error' );

                $template = '';
                $query = new \WP_Query([
                    'post_type' => $this->getPrefix('page'),
                    'meta_query' => [
                        'key' => 'page_id',
                        'value' => $id
                    ]
                ]);
                if ($query->have_posts())
                {
                    while ($query->have_posts())
                    {
                        $query->the_post();
                        $template = get_the_content();
                    }
                }
                else
                    wp_send_json_error( 'Not found' );

                wp_reset_query();

                wp_send_json_success($template);
                die();
            }
        });
    }

    private function handle_parse_page()
    {
        $action = 'wp_ajax_builder_parse_page';
        add_action($action, function()
        {
            $template = !empty($_REQUEST['template']) ? $_REQUEST['template'] : false;
            $is_post = !empty($_POST);

            if ($is_post)
            {
                // @todo: verify nonce
                // check_ajax_referer( $this->prefix . '_' . $related_item . '_nonce', 'nonce' );
                // if ( false ) wp_send_json_error( 'Security error' );

                $template = stripslashes($template);
                $template = $this->parseTemplateTags($template);

                wp_send_json_success( $template );
                die();
            }
        });
    }

    private function parseTemplateTags($content)
    {
        $templateTagsMatch = '/{{([a-zA-Z0-9-._:, |]+)(options=[\"]([^\"]*)[\"])?}}/is';

        preg_match_all($templateTagsMatch, $content, $matches);
        $template_tags = $matches[1];
        $options = $matches[3];

        foreach($template_tags as $k => $template_tag)
        {
            $template_tag = trim($template_tag);
            $tag_options = isset($options[$k]) ? $options[$k] : false;
            $tag_replace = '{{' . $template_tag . ($tag_options ? ' options="'.$tag_options.'"' : '') . '}}';

            $componentContent = '<div data-component="' . $template_tag . '"';
            if ($tag_options)
            {
                $tag_options_obj = [];
                parse_str(htmlspecialchars_decode($tag_options), $tag_options_obj);
                $tag_options_obj = str_replace('"', '\\u0022', json_encode($tag_options_obj));
                $componentContent .= ' data-options="' . $tag_options_obj . '"';
            }
            $componentContent .= '>' . $template_tag . '</div>';

            $content = str_replace($tag_replace, $componentContent, $content);
        }

        return $content;
    }

    private function handle_options_editor()
    {
        $action = 'wp_ajax_builder_editor';
        add_action($action, function()
        {
            $options = $_REQUEST['options'];
            $form = isset($options) && !empty($options['form']) ? $options['form'] : false;

            wp_enqueue_script('ajax_options_editor', plugin_dir_url(__DIR__) . 'assets/js/builder/lib/ajax_options_editor.js', ['jquery'], '1.0', true);

            ThickBox::getHeader();
            ?>
            <div class="col-md-12">
                <h3>Edit Options</h3>
            </div>
            <hr/>
            <form action="" method="post">
                <div class="col-md-12">

                    <?php
                    if ($form !== false)
                    {
                        foreach($form as $formControl)
                        {

                            $formType = isset($formControl['type']) ? $formControl['type'] : "input";
                            FormBuilder::$formType($formControl['name'], $formControl['label'], $options[$formControl['name']]);

                        }
                    }
                    ?>

                    <button type="submit" class="btn btn-success">Save</button>

                </div>
            </form>
            <?php
            ThickBox::getFooter();
            die();
        });
    }

    private function getBuilderCodeEditor()
    {
        $content =
            '<div id="builder-editor" ng-show="!saveComponent && !page.loading && !page.saving && toggleCodeEditor == true" class="animate-show ng-hide">
				<textarea ng-model="bodyEditor" ui-codemirror="codemirrorOptions" ui-refresh="toggleCodeEditor" id="" class="form-control"></textarea>
				<div class="btn-group btn-group-xs pull-right">
					<a class="btn btn-primary" ng-click="codeEditorSave()" ng-show="bodyEditor">Save</a>
					<a class="btn btn-inverse" ng-click="toggleCodeEditor=false">Close</a>
				</div>
				<div class="clearfix"></div>
			</div>';

        return $content;
    }

    private function getBuilderToggleCodeEditor()
    {
        $content =
            '<div class="btn-group btn-group-xs ng-hide" data-toggle="buttons" ng-show="page.template && !page.loading">
                <label class="btn btn-inverse">
                    <input type="checkbox" name="codeEditor" buttons-checkbox ng-model="toggleCodeEditor" id="toggle-code-editor"> Code Editor <i class="fa fa-code"></i>
                </label>
            </div>';

        return $content;
    }

    private function getBuilderBreadcrumb()
    {
        $content =
            '<div ng-show="breadcrumb">
                <ul id="builder-breadcrumb" class="breadcrumb">
                    <li ng-repeat="item in breadcrumb"><a ng-click="selectBreadcrumb(item.id)">//item.name//</a></li>
                    <!-- <li class="divider" ng-repeat-end></li> -->
                </ul>
                <hr/>
            </div>';

        return $content;
    }

    private function getBuilderOverlay()
    {
        $contentDataOverlay =
            '<div class="bootstrap ng-hide" ng-controller="AppCtrl" ng-show="!page.saving && !page.loading && page.template">
                <div id="overlay-hover">
                    <span id="overlay-label">Hover Overlay</span>
                </div>
                <div id="overlay">
                    <div id="overlay-menu">
                        <div class="btn-group btn-group-xs">
                            <span class="btn btn-inverse" id="overlay-move"><i class="fa fa-arrows"></i></span>
                            <span class="btn btn-primary" id="overlay-edit-options"><i class="fa fa-pencil"></i></span>
                            <span class="btn btn-danger deleteElement"><i class="fa fa-times"></i></span>
                        </div>
                    </div>
                    <div class="btn-group btn-group-xs dropdown" id="overlay-menu-right">
                          <span type="button" class="btn btn-inverse dropdown-toggle" data-toggle="dropdown">
                            <i class="fa fa-cog"></i>
                          </span>
                          <ul class="dropdown-menu pull-right" role="menu">
                            <li><a href="#" id="closeOverlay"><span class="pull-right strong">(ESC)</span>Close</a></li>
                            <li><a href="#" id="selectAll"><span class="pull-right strong">(&#8984;+A)</span>Toggle selection</a></li>
                            <li class="divider">Edit</li>
                            <li><a href="#" id="toggleOptionsEditor"><span class="pull-right strong">(&#8984;+O)</span>Edit options</a></li>
                            <li><a href="#" id="toggleCodeEditor"><span class="pull-right strong">(&#8984;+E)</span>Code edit</a></li>
                            <li><a href="#" id="cloneElement"><span class="pull-right strong">(&#8984;+D)</span>Duplicate</a></li>
                            <li><a href="#" class="deleteElement"><span class="pull-right strong">(&#8984;+&#8592;, DEL)</span>Remove</a></li>
                          </ul>
                    </div>
                    <span id="overlay-label">Select Overlay</span>
                </div>
            </div>';

        return $contentDataOverlay;
    }

    /**
     * Initialize Sidebar Shortcodes
     */
    private function initShortcodes()
    {
        add_action('init', function()
        {
            $shortcodes = [
                'Grid_Row',
                'Grid_Column'
            ];

            foreach ($shortcodes as $sc)
            {
                require_once realpath(__DIR__) . '/Shortcodes/' . $sc . '.php';
                forward_static_call([__NAMESPACE__ . '\\' . $sc . '_Shortcode', 'init']);
            }
        });
    }
}