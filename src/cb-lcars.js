import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import { CBLCARSPanel } from './panel/cb-lcars-panel.js';

import semver from 'semver';


// Promises for loading the templates and stub configuration
let templatesPromise;
let stubConfigPromise;

// Flag to check if the templates have been loaded
let templatesLoaded = false;

// Flag to check if the stub configuration has been loaded
let stubConfigLoaded = false;

// Load the templates from our yaml file
let templates = {};
let stubConfig = {};



async function initializeCustomCard() {

    // Call log banner function immediately when the script loads
    cblcarsLogBanner();

    ///load yaml configs
    templatesPromise = loadTemplates(CBLCARS.templates_uri);
    stubConfigPromise = loadStubConfig(CBLCARS.stub_config_uri);


    // Import and wait for 3rd party card dependencies
    const cardImports = [
        import("./cblcars-button-card.js").then(() => customElements.whenDefined('cblcars-button-card')),
        import("./cblcars-my-slider-v2.js").then(() => customElements.whenDefined('cblcars-my-slider-v2'))
    ];
    await Promise.all(cardImports);

    loadFont();

    // Checks that custom element dependencies are defined for use in the cards
    if (!customElements.get('cblcars-button-card')) {
        cblcarsLog('error',`Custom Button Card for LCARS [cblcars-button-card] was not found!`);
    }
    if (!customElements.get('cblcars-my-slider-v2')) {
        cblcarsLog('error',`MySliderV2 for LCARS Custom Card [cblcars-my-slider-v2] was not found!`);
    }
}


// Initialize the custom card
initializeCustomCard().catch(error => {
    cblcarsLog('error','Error initializing custom card:', error);
});



async function loadTemplates(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);

        // Store the YAML content in window.cblcars_card_templates
        window.cblcars_card_templates = yamlContent.cblcars_card_templates;

        templates = yamlContent || {};
        templatesLoaded = true;
        cblcarsLog('debug', `CB-LCARS dashboard templates loaded from source file [${CBLCARS.templates_uri}]`, templates);
    } catch (error) {
        cblcarsLog('error', 'Failed to get the CB-LCARS lovelace templates from source file.', error);
    }
}


// Load the stub configuration from our yaml file
async function loadStubConfig(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);
        stubConfig = yamlContent || {};
        stubConfigLoaded = true;
        cblcarsLog('debug',`CB-LCARS stub configuration loaded from source file [${CBLCARS.stub_config_uri}]`,stubConfig);
    } catch (error) {
        cblcarsLog('error','Failed to get the CB-LCARS stub configuration from source file.',error);
    }
}

/*
// Function to get the Lovelace configuration
function getLovelace() {
        let root = document.querySelector('home-assistant');
        root = root && root.shadowRoot;
        root = root && root.querySelector('home-assistant-main');
        root = root && root.shadowRoot;
        root = root && root.querySelector('app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver');
        root = (root && root.shadowRoot) || root;
        root = root && root.querySelector('ha-panel-lovelace');
        root = root && root.shadowRoot;
        root = root && root.querySelector('hui-root');
    if (root) {
        const ll = root.lovelace;
        ll.current_view = root.___curView;
        return ll;
    }
    return null;
}
*/
/*
// Function to update the Lovelace configuration
async function updateLovelaceConfig(filePath) {

    let newConfig;
    if(!templatesLoaded) {
        cblcarsLog('debug','Templates not loaded yet - attempting to load from source file.');
        try {
            //newConfig = await readYamlFile(filePath);
            await loadTemplates(filePath);
            newConfig = templates;
        } catch (error) {
            cblcarsLog('error','Failed to get the CB-LCARS lovelace template source file.',error);
            //throw error;
        }
    } else {
        newConfig = templates;
    }

    //cblcarsLog('debug','updateLoveLaceConfig.newConfig: ',newConfig);

    if (newConfig === undefined || newConfig === null || newConfig === 'undefined') {
        cblcarsLog('error','The CB-LCARS lovelace template failed and is not availalbe for processing.');
        //throw error;
    } else {
        const lovelaceConfig = getLovelace();

        if (lovelaceConfig) {
            const cbLcarsConfig = lovelaceConfig.config['cb-lcars'] || {};
            const newCbLcarsConfig = newConfig['cb-lcars'] || {};

            // Check if the cb-lcars.manage_config flag is set
            if (cbLcarsConfig.manage_config) {
                // Check if the new configuration version is different
                const currentLovelaceVersion = cbLcarsConfig.version || '0.0.0';
                const newLovelaceVersion = newCbLcarsConfig.version || '0.0.0';

                if (semver.gt(newLovelaceVersion, currentLovelaceVersion)) {
                    // Merge the cb-lcars configurations
                    const updatedCbLcarsConfig = { ...cbLcarsConfig, ...newCbLcarsConfig };

                    // Create a new configuration object by copying the existing one and updating cb-lcars
                    const updatedConfig = { ...lovelaceConfig.config, ...newConfig, 'cb-lcars': updatedCbLcarsConfig };

                    cblcarsLog('debug','original lovelace config: ',lovelaceConfig.config);
                    cblcarsLog('debug','new lovelace config: ',newConfig);


                    // Apply the updated configuration
                    await lovelaceConfig.saveConfig(updatedConfig);
                    cblcarsLog('info', `CB-LCARS dashboard templates updated (v${currentLovelaceVersion} --> v${newLovelaceVersion})`);
                    isConfigMerged = true;

                } else if (newLovelaceVersion === 0) {
                    cblcarsLog('warn', 'CB-LCARS templates version is not defined - please set a version in the source YAML file.');
                } else {
                    cblcarsLog('info', `CB-LCARS dashboard templates are up to date (v${currentLovelaceVersion})`);
                    isConfigMerged = true;
                }
            } else {
            cblcarsLog('warn', 'CB-LCARS automatic dashboard management of templates is disabled. Set [cb-lcars.manage_config: true] in your Lovelace dashboard YAML to enable it.');
            //lovelaceConfig.config = { ...lovelaceConfig.config, ...newConfig };
            //cblcarsLog('info', 'CB-LCARS dashboard templates loaded into running Lovelace configuration only - changes will not be saved.',lovelaceConfig);
            }
        } else {
            cblcarsLog('error', 'Failed to retrieve the current Lovelace dashboard configuration');
        }
    }
}
*/





class CBLCARSBaseCard extends HTMLElement {

    constructor () {
        super();
        //this.attachShadow({ mode: 'open' });

        this.resizeObserver = null; // Define resizeObserver as a class property
        this.isResizing = false;

        this._config = null;
        this._card = null;
    }

    // Function to initialize the configuration update
    async ensureDependenciesLoaded() {
        if(!templatesLoaded) {
        await templatesPromise;
       }

        if(!stubConfigLoaded) {
            await stubConfigPromise;
        }
    }


    setConfig(config) {
        if (!config) {
            throw new Error("'cblcars_card_config:' section is required");
        }

        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Create a new object to avoid modifying the original config
        const buttonCardConfig = {
            type: 'custom:cblcars-button-card',
            template: mergedTemplates,
            ...config.cblcars_card_config,
        };

        // Merge the button_card_config into config
        this._config = {
            ...config,
            cblcars_card_config: buttonCardConfig
        };

        // If the entity or label is defined in the parent config, pass it to the child config
        if (this._config.entity && !this._config.cblcars_card_config.entity) {
            this._config.cblcars_card_config.entity = this._config.entity;
        }
        if (this._config.label && !this._config.cblcars_card_config.label) {
            this._config.cblcars_card_config.label = this._config.label;
        }

        // If the card is already initialized, update its config
        if (this._card) {
            this._card.setConfig(this._config.cblcars_card_config);
        }
    }

    set hass(hass) {
        if (this._card) {
        this._card.hass = hass;
        }
    }

    static get editorType() {
        return 'cb-lcars-base-card-editor';
    }
    static get cardType() {
        return 'cb-lcars-base-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_config: {
                label: "CB-LCARS Base Card",
                show_label: true
            }
        };
    }

    static getConfigElement() {

        const editorType = this.editorType;

        try {
            if (!customElements.get(editorType)) {
                cblcarsLog('error',`Graphical editor element [${editorType}] is not defined defined in Home Assistant!`);
                return null;
            }
            const element = document.createElement(editorType);
            //console.log('Element created:', element);
            return element;
        } catch (error) {
            cblcarsLog('error',`Error creating element ${editorType}: `,error);
            return null;
        }
    }

    static getStubConfig() {
        const cardType = this.cardType;
        if (stubConfig[cardType]) {
            return stubConfig[cardType];
        } else {
            return this.defaultConfig;
        }
    }

    getCardSize() {
        return this._card ? this._card.getCardSize() : 4;
    }

    getLayoutOptions() {
        return {
          grid_rows: 1,
          grid_columns: 4
        };
      }

    async connectedCallback() {

        await this.ensureDependenciesLoaded();

        //cblcarsLog('debug','connectedcallback called');

        // Initialize the card
        this.initializeCard();

        // Add event listeners
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('load', this.handleLoad.bind(this));

        // Create a ResizeObserver to handle resizing of the card
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this);
    }

    initializeCard() {
        // Attempt to render the card - the templates may not be loaded into lovelace yet, so we'll have to try initialize if this fails
        if (!this._card) {
            this._card = document.createElement('cblcars-button-card');
            this.appendChild(this._card);
        }

        // Ensure the configuration is loaded and set it on the card
        if (this._config && this._card) {
            this._card.setConfig(this._config.cblcars_card_config);
        } else {
            cblcarsLog('error', 'Error: _card element or configuration is not initialized.');
        }

        // Force a redraw on the first instantiation
        this.redrawChildCard();
    }

    disconnectedCallback() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        window.removeEventListener('load', this.handleLoad.bind(this));

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    handleResize() {
        //cblcarsLog('debug','Window resized, updating child card...');
        if (this.isResizing) {
            return;
        } else {
            this.isResizing = true;
            this.redrawChildCard();
            this.isResizing = false;
        }
    }

    handleLoad() {
        cblcarsLog('debug', 'Page loaded, updating child card...');
        this.redrawChildCard();
    }

    redrawChildCard() {
        // Re-read the configuration and re-render the card
        if (this._config) {
            //cblcarsLog('debug', "doing a this._card.setConfig() on the child");
            this._card.setConfig(this._config.cblcars_card_config);
        } else {
            console.error('No configuration found for the child card.');
        }
        // If the child card uses LitElement, this will schedule an update
        //if (this._card.requestUpdate) {
            //cblcarsLog('debug', "doing this._card.requestUpdate()");
        //    this._card.requestUpdate();
        //}
    }
}

class CBLCARSLabelCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-label-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-label-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_config: {
                label: "CB-LCARS Label",
                show_label: true
            }
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-label';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }
}

class CBLCARSElbowCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-elbow-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-elbow-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_config: {
                variables: {
                    card: {
                        border: {
                            left: { size: 90 },
                            top: { size: 20 }
                        }
                    }
                }
            }
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-header';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        //const defaultTemplates = ['cb-lcars-header'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}

class CBLCARSDoubleElbowCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-double-elbow-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-double-elbow-card';
    }

    static get defaultConfig() {
        return {
            };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-header-picard';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        //const defaultTemplates = ['cb-lcars-header'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}

class CBLCARSMultimeterCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-multimeter-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-multimeter-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_config: {
                variables: {
                    _mode: 'gauge'
                }
            }
        };
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-multimeter'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}

class CBLCARSDPADCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-dpad-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-dpad-card';
    }

    static get defaultConfig() {
        return {};
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-dpad'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 4,
            grid_columns: 2
        };
      }
}

class CBLCARSButtonCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-button-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-button-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_config: {
                label: "CB-LCARS Button",
                show_label: true
            }
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-button-lozenge';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };

        //cblcarsLog('debug','button card specialConfig: ',specialConfig);

        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_min_rows: 1,
            grid_rows: 1,
            grid_columns: 2,
            grid_min_columns: 1
        };
      }
}

class CBLCARSSliderCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-slider-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-slider-card';
    }

    static get defaultConfig() {
        return {
            cblcars_card_type: 'cb-lcars-slider-horizontal'
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-slider-horizontal';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: mergedTemplates,
            }
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        if (this._config.cblcars_card_type && this._config.cblcars_card_type.includes('horizontal')) {
            return {
                grid_rows: 1,
                grid_columns: 4
            };
        } else {
            return {
                grid_rows: 1,
                grid_columns: 4
            };
        }
    }
}


// define test panel
customElements.define("cb-lcars-panel", CBLCARSPanel);

// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-view', CBLCARSViewStrategy);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);



// Helper function to define custom elements and their editors
function defineCustomElement(cardType, cardClass, editorType, editorClass) {
    customElements.define(cardType, cardClass);
    customElements.define(editorType, class extends editorClass {
        constructor() {
            super(cardType);
        }
    });
}

// Define custom elements and their editors
defineCustomElement('cb-lcars-base-card', CBLCARSBaseCard, 'cb-lcars-base-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-label-card', CBLCARSLabelCard, 'cb-lcars-label-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-elbow-card', CBLCARSElbowCard, 'cb-lcars-elbow-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-double-elbow-card', CBLCARSDoubleElbowCard, 'cb-lcars-double-elbow-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-multimeter-card', CBLCARSMultimeterCard, 'cb-lcars-multimeter-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-dpad-card', CBLCARSDPADCard, 'cb-lcars-dpad-card-editor', CBLCARSCardEditor);
defineCustomElement('cb-lcars-button-card', CBLCARSButtonCard, 'cb-lcars-button-card-editor', CBLCARSCardEditor);

/*
//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-elbow-card',CBLCARSElbowCard);
customElements.define('cb-lcars-double-elbow-card',CBLCARSDoubleElbowCard);
customElements.define('cb-lcars-multimeter-card',CBLCARSMultimeterCard);
customElements.define('cb-lcars-dpad-card',CBLCARSDPADCard);
customElements.define('cb-lcars-button-card',CBLCARSButtonCard);

customElements.define('cb-lcars-base-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-base-card');
    }
});

customElements.define('cb-lcars-label-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-label-card');
    }
});

customElements.define('cb-lcars-elbow-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-elbow-card');
    }
});

customElements.define('cb-lcars-double-elbow-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-double-elbow-card');
    }
});

customElements.define('cb-lcars-multimeter-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-multimeter-card');
    }
});

customElements.define('cb-lcars-dpad-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-dpad-card');
    }
});

customElements.define('cb-lcars-button-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-button-card');
    }
});
*/

// Register the cards to be available in the GUI editor
window.customCards = window.customCards || [];
const CBLCARSCardClasses = [
    {
        type: 'cb-lcars-base-card',
        name: 'CB-LCARS Base Card',
        description: 'For advanced use: the CB-LCARS base card for full manual configuration.',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-label-card',
        name: 'CB-LCARS Label',
        preview: true,
        description: 'CB-LCARS label card for text.',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-elbow-card',
        name: 'CB-LCARS Elbow',
        preview: true,
        description: 'CB-LCARS Elbow card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-double-elbow-card',
        name: 'CB-LCARS Double Elbow',
        preview: true,
        description: 'CB-LCARS Double Elbow card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-multimeter-card',
        name: 'CB-LCARS Multimeter',
        preview: true,
        description: 'CB-LCARS Multimeter card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-dpad-card',
        name: 'CB-LCARS D-Pad',
        preview: true,
        description: 'CB-LCARS D-Pad card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-button-card',
        name: 'CB-LCARS Buttons',
        preview: true,
        description: 'CB-LCARS Buttons [various styles]',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    }
];

window.customCards.push(...CBLCARSCardClasses);


