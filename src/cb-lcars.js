import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsGetGlobalLogLevel, cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import { property, customElement, state } from 'lit/decorators.js';
import { ButtonCard } from "./cblcars-button-card.js"

// WIP - do we want to make a panel for this?
import { CBLCARSPanel } from './panel/cb-lcars-panel.js';

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
        customElements.whenDefined('cblcars-button-card'),
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

        // Merge the cblcars stanza with the existing window.cblcars object
        if (yamlContent.cblcars) {
            window.cblcars = {
                ...window.cblcars,
                ...yamlContent.cblcars
            };
        }

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


class CBLCARSBaseCard extends ButtonCard {

    @property({ type: Boolean }) _enableResizeObserver = false;
    @property({ type: String }) _logLevel = cblcarsGetGlobalLogLevel();
    @property({ type: String }) _resizeObserverTarget = 'this';

    constructor () {
        super();
        this._resizeObserver = new ResizeObserver(() => {
            cblcarsLog('debug','Resize observer fired', this, this._logLevel);
            this._debouncedResizeHandler();
        });
        this._debouncedResizeHandler = this._debounce(() => this.setConfig(this._config), 100);
    }


    setConfig(config) {
        if (!config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
        }

        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Create a new object to avoid modifying the original config
        this._config = {
            ...config,
            template: mergedTemplates,
        };

        // Set the _logLevel property from the config
        this._logLevel = config.cblcars_log_level || cblcarsGetGlobalLogLevel();

        // Set the _resizeObserverTarget property from the config
        this._resizeObserverTarget = config.resize_observer_target || 'this';
        // Set the _enableResizeObserver property from the config
        this._enableResizeObserver = config.enable_resize_observer || false;


        super.setConfig(this._config);
        cblcarsLog('debug',`${this.constructor.name}.setConfig() called with:`, this._config, this._logLevel);

        // Enable or disable the resize observer based on the config
        if (this._enableResizeObserver) {
            this.enableResizeObserver();
        } else {
            this.disableResizeObserver();
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
            label: "CB-LCARS Base Card",
            show_label: true
        };
    }

    static getConfigElement() {

        const editorType = this.editorType;

        try {
            if (!customElements.get(editorType)) {
                cblcarsLog('error',`${this.constructor.name}.getConfigElement() Graphical editor element [${editorType}] is not defined defined in Home Assistant!`,null ,this._logLevel);
                return null;
            }
            const element = document.createElement(editorType);
            //console.log('Element created:', element);
            return element;
        } catch (error) {
            cblcarsLog('error',`${this.constructor.name}.getConfigElement() Error creating element ${editorType}: `,error, this._logLevel);
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
        //return this._card ? this._card.getCardSize() : 4;
        super.getCardSize();
    }

    getLayoutOptions() {
        return {
          grid_rows: 1,
          grid_columns: 4
        };
      }

    connectedCallback() {
        super.connectedCallback();

        // Check if the parent element has the class 'preview'
        if (this.parentElement && this.parentElement.classList.contains('preview')) {
            this.style.height = '60px';
        } else {
            this.style.height = '100%';
        }

        if (this._enableResizeObserver) {
            this.enableResizeObserver();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.disableResizeObserver();
    }

    enableResizeObserver() {
        const targetElement = this.resolveTargetElement(this._resizeObserverTarget);

        if (targetElement && this.isConnected) {
            this._resizeObserver.observe(targetElement);
            cblcarsLog('debug',`${this.constructor.name}.enableResizeObserver() Resize observer enabled on [${targetElement}]`, this, this._logLevel);
        }
    }

    disableResizeObserver() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        cblcarsLog('debug',`${this.constructor.name}.disableResizeObserver() Resize observer disabled`, this, this._logLevel);
    }

    // Method to update the _enableResizeObserver property and trigger the observer
    updateResizeObserver(enable) {
        this._enableResizeObserver = enable;
        if (enable) {
            this.enableResizeObserver();
        } else {
            this.disableResizeObserver();
        }
    }
    resolveTargetElement(target) {
        const targetMapping = {
            'this': () => this,
            'this.parentElement': () => this.parentElement,
            'this.offsetParent': () => this.offsetParent,
            // Add more mappings as needed
        };

        return targetMapping[target] ? targetMapping[target]() : this;
    }
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
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
            label: "CB-LCARS Label",
            show_label: true
        };
    }

    setConfig(config) {
        const defaultCardType = 'cb-lcars-label';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
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
            variables: {
                card: {
                    border: {
                        left: { size: 90 },
                        top: { size: 20 }
                    }
                }
            }
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-header';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
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
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
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
            variables: {
                _mode: 'gauge'
            }
        };
    }

    constructor() {
        super();
        this._enableResizeObserver = true;
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-multimeter'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
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
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
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
            label: "CB-LCARS Button",
            show_label: true
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-button-lozenge';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
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


// delay registration of custom elements until the templates and stub configuration are loaded
Promise.all([templatesPromise, stubConfigPromise])
  .then(() => {
    defineCustomElement('cb-lcars-base-card', CBLCARSBaseCard, 'cb-lcars-base-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-label-card', CBLCARSLabelCard, 'cb-lcars-label-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-elbow-card', CBLCARSElbowCard, 'cb-lcars-elbow-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-double-elbow-card', CBLCARSDoubleElbowCard, 'cb-lcars-double-elbow-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-multimeter-card', CBLCARSMultimeterCard, 'cb-lcars-multimeter-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-dpad-card', CBLCARSDPADCard, 'cb-lcars-dpad-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-button-card', CBLCARSButtonCard, 'cb-lcars-button-card-editor', CBLCARSCardEditor);
  })
  .catch(error => {
    cblcarsLog('error', 'Error loading YAML configuration:', error);
  });



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
        name: 'CB-LCARS Button',
        preview: true,
        description: 'CB-LCARS Buttons [various styles]',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    }
];

window.customCards.push(...CBLCARSCardClasses);