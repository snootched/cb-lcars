import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsLog, logImportStatus, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { fetchYAML, readYamlFile } from './utils/cb-lcars-fileutils.js';
import { CBLCARSDashboardStrategy, CBLCARSViewStrategyAirlock, CBLCARSViewStrategyGallery } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import jsyaml from 'js-yaml';
import { html, css } from 'lit';
import { fireEvent } from "custom-card-helpers";
import semver from 'semver';

import { ButtonCard } from 'button-card';

// Call log banner function immediately when the script loads
cblcarsLogBanner();

// Log import statuses for each import
console.groupCollapsed('CB-LCARS imports');
logImportStatus('CBLCARS', CBLCARS);
logImportStatus('jsyaml', jsyaml);
logImportStatus('html:', html);
logImportStatus('css', css);
logImportStatus('fireEvent:', fireEvent);
console.groupEnd();



class CBLCARSCustomButtonCard extends ButtonCard {
    constructor() {
        super();
    }
}
customElements.define('cb-lcars-custom-button-card', CBLCARSCustomButtonCard);
if (!customElements.get('cb-lcars-custom-button-card')) {
    cblcarsLog('error',`CBLCARS Custom Button Card [cb-lcars-custom-button-card] was not found!`);
} else {
    cblcarsLog('info',`CBLCARS Custom Button Card [cb-lcars-custom-button-card] loaded successfully!`);
}


// Check for custom element dependencies
if (!customElements.get('button-card')) {
    cblcarsLog('error',`Custom Button Card [button-card] was not found!  Please install from HACS.`);
}

//prepare for HA-LCARS card support
if (!customElements.get('html-card')) {
    cblcarsLog('error',`Lovelace HTML Card [html-card] was not found!  Please install from HACS.`);
}


loadFont();

// Flag to check if the configuration has been merged
let isConfigMerged = false;



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

// Function to update the Lovelace configuration
async function updateLovelaceConfig(filePath) {
    let newConfig;
    try {
        newConfig = await readYamlFile(filePath);
    } catch (error) {
        cblcarsLog('error','Failed to get the CB-LCARS lovelace template source file.',error);
        //throw error;
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


// Function to initialize the configuration update
async function initializeConfigUpdate() {
    //await cblcarsLog('debug',`In initializeConfigUpdate() isConfigMerged = ${isConfigMerged}`);
    if (!isConfigMerged) {
        //cblcarsLog('debug',`Check (and update) lovelace config against: ${CBLCARS.templates_uri}`);
        await updateLovelaceConfig(CBLCARS.templates_uri);
    } else {
        //await cblcarsLog('debug','isConfigMerged is true - bypassing config merge into lovelace');
    }
}



class CBLCARSBaseCard extends HTMLElement {

    constructor () {
        super();
        //this.attachShadow({ mode: 'open' });

        this.resizeObserver = null; // Define resizeObserver as a class property

        initializeConfigUpdate();

        //this.observer = null;
        // Bind event handlers
        //this.handleResize = this.handleResize.bind(this);
        //this.handleResize = this.handleLoad.bind(this);
        //this.handleClick = this.handleClick.bind(this);
        //this.handleInput = this.handleInput.bind(this);
        //this.handleMouseOver = this.handleMouseOver.bind(this);
        //this.handleMouseOut = this.handleMouseOut.bind(this);
        //this.handleMutations = this.handleMutations.bind(this);
        //this.handleCustomEvent = this.handleCustomEvent.bind(this);
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
            type: 'custom:button-card',
            template: mergedTemplates,
            ...config.cblcars_card_config,
        };

        //merge the button_card_config into config
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

        cblcarsLog('debug','new card config: ',this._config);

        //instantiate the button-card
        if (!this._card) {
            this._card = document.createElement('button-card');
            this.appendChild(this._card);
        }

        //set our config on the button-card we just stood up
        this._card.setConfig(this._config.cblcars_card_config);
    }

    set hass(hass) {
        if (this._card) {
        this._card.hass = hass;
        }
    }


    static get editorType() {
        return 'cb-lcars-base-card-editor';
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
        return {
            cblcars_card_config: {
                label: 'cb-lcars-base',
                show_label: true
            }
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

    connectedCallback() {

        //cblcarsLog('debug','connectedcallback called');
        try {
            // Attempt to render the card - the templates may not be loaded into lovelace yet, so we'll have to try initialize if this fails
            if (!this._card) {
                //cblcarsLog('debug','creating new button-card element');
                this._card = document.createElement('button-card');
                this.appendChild(this._card);
            }
            //cblcarsLog('debug','setting config on button-card element');
            this._card.setConfig(this._config.cblcars_card_config);

            // Force a redraw on the first instantiation
            this.redrawChildCard();

            // Add event listeners
            window.addEventListener('resize', this.handleResize.bind(this));
            window.addEventListener('load', this.handleLoad.bind(this));
            //this.addEventListener('click', this.handleClick);
            //this.addEventListener('input', this.handleInput);
            //this.addEventListener('mouseover', this.handleMouseOver);
            //this.addEventListener('mouseout', this.handleMouseOut);

            // Set up MutationObserver
            //this.observer = new MutationObserver(this.handleMutations.bind(this));
            //if (this.parentElement) {
            //    cblcarsLog("warn","creating mutation observer")
            //    this.observer.observe(this.parentElement, { attributes: true, childList: true, subtree: true });
            //}
            //this.observer.observe(this._card, { attributes: true });

            try {
                this.resizeObserver = new ResizeObserver(() => {
                    //cblcarsLog('debug', 'Element resized, updating child card...');
                    this.redrawChildCard();
                });

                this.resizeObserver.observe(this.parentElement);
            } catch (error) {
                cblcarsLog('error',`Error creating ResizeObserver: ${error}`);
            }


        } catch (error) {
            cblcarsLog('error',`Error rendering card: ${error}`);
        } finally {
            //cblcarsLog('debug','Unable to create and render card',this);
            //cblcarsLog('warning','commenting out initializeConfigUpdate for now....')
            // Ensure initializeConfigUpdate runs even if rendering fails
            //nitializeConfigUpdate();
        }
    }


    disconnectedCallback() {

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        window.removeEventListener('load', this.handleLoad.bind(this));
        //this.removeEventListener('click', this.handleClick);
        //this.removeEventListener('input', this.handleInput);
        //this.removeEventListener('mouseover', this.handleMouseOver);
        //this.removeEventListener('mouseout', this.handleMouseOut);
        //if (this.observer) {
        //    this.observer.disconnect();
       // }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }


    handleResize() {
        //cblcarsLog('debug','Window resized, updating child card...');
        this.redrawChildCard();
    }

    handleLoad() {
        cblcarsLog('debug', 'Page loaded, updating child card...');
        this.redrawChildCard();
    }
    /*
    handleMutations(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                cblcarsLog('debug', 'DOM mutation observed, updating child card...');
                this.redrawChildCard();
                break;
            }
        }
    }
    handleClick(event) {
        console.log('Element clicked:', event.target);
    }

    handleInput(event) {
        console.log('Input changed:', event.target.value);
    }

    handleMouseOver(event) {
        console.log('Mouse over:', event.target);
    }

    handleMouseOut(event) {
        console.log('Mouse out:', event.target);
    }

    handleCustomEvent(event) {
        console.log('Custom event triggered:', event.detail);
    }
    */
    redrawChildCard() {

        // Re-read the configuration and re-render the card
        if (this._config) {
            //cblcarsLog('debug', "doing a this._card.setConfig() on the child");
            this._card.setConfig(this._config.cblcars_card_config);
        } else {
            console.error('No configuration found for the child card.');
        }
        // If the child card uses LitElement, this will schedule an update
        if (this._card.requestUpdate) {
            //cblcarsLog('debug', "doing this._card.requestUpdate()");
            this._card.requestUpdate();
        }

    }
}

class CBLCARSLabelCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-label-card-editor';
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-label'];
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

    static getStubConfig() {
        return {
            cblcars_card_config: {
                label: "CB-LCARS Label",
                show_label: true,
                variables: {
                    text: {
                        label: {
                            font_size: "40px",
                            font_weight: "lighter",
                            color: {
                                default: "var(--picard-yellow)"
                            },
                            justify: "right",
                            padding: {
                                right: "15px",
                                bottom: "5px"
                            }
                        }
                    },
                    card: {
                        height: "45px",
                        border: {
                            left: {
                                size: "60px"
                            },
                            right: {
                                size: "40px"
                            },
                            color: "var(--picard-dark-gray)"
                        }
                    }
                }
            }
        }
    }
}

class CBLCARSElbowCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-elbow-card-editor';
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
    static getStubConfig() {
        return {
            cblcars_card_config: {
                variables: {
                    card: {
                        border: {
                            left: {
                                size: 90
                            },
                            top: {
                                size: 20
                            }
                        }
                    }
                }
            }
        }
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
    static getStubConfig() {
        return {};
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
    static getStubConfig() {
        return {};
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
    static getStubConfig() {
        return {
            cblcars_card_config: {
                label: "CB-LCARS Button",
                show_label: true
            }
        }
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
    static getStubConfig() {
        return {
            cblcars_card_type: 'cb-lcars-slider-horizontal'
        };
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
// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-gallery', CBLCARSViewStrategyGallery);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);

//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-elbow-card',CBLCARSElbowCard);
customElements.define('cb-lcars-multimeter-card',CBLCARSMultimeterCard);
customElements.define('cb-lcars-dpad-card',CBLCARSDPADCard);
customElements.define('cb-lcars-button-card',CBLCARSButtonCard);
customElements.define('cb-lcars-slider-card',CBLCARSSliderCard);

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

customElements.define('cb-lcars-slider-card-editor', class extends CBLCARSCardEditor {
    constructor() {
        super('cb-lcars-slider-card');
    }
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
    },
    {
        type: 'cb-lcars-slider-card',
        name: 'CB-LCARS Sliders',
        preview: true,
        description: 'CB-LCARS Sliders and Gauges [no decorations]',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
];

window.customCards.push(...CBLCARSCardClasses);


