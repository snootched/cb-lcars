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

class CBLCARSBaseCard extends HTMLElement {
    constructor() {
        super();
        this.resizeObserver = null;
        this.isResizing = false;
        this._config = null;
        this._card = null;
        this.dependenciesLoaded = false;
        this.checkDependencies();
    }

    // Function to check if global dependencies are loaded
    checkDependencies() {
        cblcarsLog('debug', 'Checking dependencies...');
        const checkInterval = setInterval(() => {
            if (templatesLoaded && stubConfigLoaded) {
                this.dependenciesLoaded = true;
                clearInterval(checkInterval);
                cblcarsLog('debug', 'Dependencies loaded.');
                if (this._config) {
                    this.initializeCard();
                }
            }
        }, 100);
    }

    setConfig(config) {
        cblcarsLog('debug', 'setConfig called with config:', config);
        if (!config) {
            throw new Error("'cblcars_card_config:' section is required");
        }

        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.cblcars_card_config && config.cblcars_card_config.template) ? [...config.cblcars_card_config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const buttonCardConfig = {
            type: 'custom:cblcars-button-card',
            template: mergedTemplates,
            ...config.cblcars_card_config,
        };

        this._config = {
            ...config,
            cblcars_card_config: buttonCardConfig
        };

        if (this._config.entity && !this._config.cblcars_card_config.entity) {
            this._config.cblcars_card_config.entity = this._config.entity;
        }
        if (this._config.label && !this._config.cblcars_card_config.label) {
            this._config.cblcars_card_config.label = this._config.label;
        }

        // Poll for dependencies to be loaded
        this.pollForDependencies(() => {
            cblcarsLog('debug', 'Dependencies confirmed. Proceeding with card initialization.');
            if (this._card) {
                this._card.setConfig(this._config.cblcars_card_config);
            } else {
                this.initializeCard();
            }
        });
    }

    pollForDependencies(callback) {
        cblcarsLog('debug', 'Polling for dependencies...');
        const checkDependencies = () => {
            if (templatesLoaded && stubConfigLoaded) {
                this.dependenciesLoaded = true;
                callback();
            } else {
                setTimeout(checkDependencies, 100); // Check every 100ms
            }
        };
        checkDependencies();
    }

    initializeCard() {
        cblcarsLog('debug', 'Initializing card...');
        if (!this._card) {
            this._card = document.createElement('cblcars-button-card');
            this.appendChild(this._card);
        }

        if (this._config && this._card && this._card.setConfig) {
            this._card.setConfig(this._config.cblcars_card_config);
        } else if (this._config) {
            this.updateCard();
        }

        this.redrawChildCard();
    }

    updateCard() {
        cblcarsLog('debug', 'Updating card...');
        this.waitForCard().then(() => {
            if (this._card && this._card.setConfig) {
                this._card.setConfig(this._config.cblcars_card_config);
            }
        });
    }

    waitForCard() {
        return new Promise(resolve => {
            const checkCard = () => {
                if (this._card && this._card.setConfig) {
                    resolve();
                } else {
                    setTimeout(checkCard, 100); // Check every 100ms
                }
            };
            checkCard();
        });
    }

    connectedCallback() {
        cblcarsLog('debug', 'connectedCallback called.');
        this.checkDependencies();
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('load', this.handleLoad);
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this);
    }

    disconnectedCallback() {
        cblcarsLog('debug', 'disconnectedCallback called.');
        window.removeEventListener('resize', this.handleResize.bind(this));
        window.removeEventListener('load', this.handleLoad.bind(this));
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    update() {
        cblcarsLog('debug', 'update called.');
        if (this._card) {
            this._card.setConfig(this._config.cblcars_card_config);
        }
    }

    handleResize = this.debounce(() => {
        this.redrawChildCard();
    }, 200);

    handleLoad = () => {
        cblcarsLog('debug', 'Page loaded, updating child card...');
        this.redrawChildCard();
    }

    redrawChildCard() {
        cblcarsLog('debug', 'redrawChildCard called.');
        if (this._config) {
            if (this._card && this._card.setConfig) {
                this._card.setConfig(this._config.cblcars_card_config);
            } else {
                this.updateCard();
            }
        } else {
            console.error('No configuration found for the child card.');
        }
    }

    debounce(func, wait) {
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