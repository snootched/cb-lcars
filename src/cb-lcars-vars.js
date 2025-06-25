//CB-LCARS main verson from package.json
const packageJson = require('../package.json');
export const CBLCARS_VERSION = packageJson.version;
export const project_url = "https://cb-lcars.unimatrix01.ca";

export const font_url = [
        'https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap',
        '/hacsfiles/cb-lcars/fonts/fontface-jeffries.css',
        '/hacsfiles/cb-lcars/fonts/fontface-microgramma-ext.css'
    ]

//CB-LARS yaml configuration files (templates, strategies, editor forms, etc.)
export const templates_uri = '/hacsfiles/cb-lcars/cb-lcars-lovelace.yaml';
export const stub_config_uri = '/hacsfiles/cb-lcars/cb-lcars-stub-config.yaml';
export const theme_colors_uri = '/hacsfiles/cb-lcars/cb-lcars-themes.yaml';
export const airlock_uri = '/hacsfiles/cb-lcars/cb-lcars-airlock.yaml';
export const gallery_uri = '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml';
export const card_editor_uri = '/hacsfiles/cb-lcars/cb-lcars-card-editor-forms.yaml'
export const gallery_views_uris = [
        '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml',
        '/hacsfiles/cb-lcars/cb-lcars-gallery-buttons.yaml',
        '/hacsfiles/cb-lcars/cb-lcars-gallery-elbows.yaml',
        '/hacsfiles/cb-lcars/cb-lcars-gallery-multimeter.yaml'
    ]
