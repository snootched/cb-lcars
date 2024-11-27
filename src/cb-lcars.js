import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import { CBLCARSPanel } from './panel/cb-lcars-panel.js';

import { LitElement, html, css } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';


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


class CBLCARSBaseCard extends LitElement {

    @property({ type: Object }) _config;
    @property({ type: Object }) hass;


    /*
    @state() _lastWidth = 0;
    @state() _lastHeight = 0;
    _resizeObserver = null;
    _initialSetupComplete = false;
    _rebuildDispatched = false;
    */

    constructor () {
        super();
    }


    setConfig(config) {
        if (!config || !config.cblcars_card_config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
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

        if (config.entity && !buttonCardConfig.entity) {
            buttonCardConfig.entity = config.entity;
          }
        if (config.label && !buttonCardConfig.label) {
            buttonCardConfig.label = config.label;
        }

        this._config = {
            ...config,
            cblcars_card_config: buttonCardConfig,
        };

        console.log('CBLCARSBaseCard setConfig called with:', this._config);

        const buttonCard = this.querySelector('cblcars-button-card');
        if (buttonCard && this._config && this._config.cblcars_card_config) {
            console.log('Forcing child card to update with setConfig:', this._config.cblcars_card_config);
            buttonCard.setConfig(this._config.cblcars_card_config);
        }
    }

    /*
    requestUpdate(name, oldValue) {
        super.requestUpdate(name, oldValue);
        const buttonCard = this.querySelector('cblcars-button-card');
        if (buttonCard && this._config) {
            console.log('Forcing child card to update with setConfig:', this._config.cblcars_card_config);
            buttonCard.setConfig(this._config.cblcars_card_config);
        }
    }
    */

    /*
    updated(changedProps) {

        console.debug('CBLCARSBaseCard updated called with changedProps:', changedProps);

        if (changedProps.has('hass')) {
            const buttonCard = this.querySelector('cblcars-button-card');

            if (buttonCard) {
                console.log('Setting hass on child card:', this.hass);
                buttonCard.hass = this.hass;
            } else {
                console.log('changedProps hass - buttonCard not found:',buttonCard);
            }
        }

        if (changedProps.has('_config')) {
            const buttonCard = this.querySelector('cblcars-button-card');

            if (buttonCard) {
                console.log('Setting config on child card:', this._config.cblcars_card_config);
                buttonCard.setConfig(this._config.cblcars_card_config);
            } else {
                console.log('changedProps _config - buttonCard not found:',buttonCard);
            }
        }
    }
    */

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

    connectedCallback() {
        super.connectedCallback();

        this.style.display = 'contents';
        this.style.minHeight = '50px';

        /*
        this._debouncedResizeHandler = this._debounce(() => this._updateCardSize(), 200);

        this._resizeObserver = new ResizeObserver(() => {
        this._debouncedResizeHandler();
        });
        //this._resizeObserver.observe(this);
        this._resizeObserver.observe(this.parentElement);

        // Force an update when the layout changes
        window.addEventListener('resize', this._debouncedResizeHandler);
        */
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        /*
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
          }
        // Force an update when the layout changes
        window.removeEventListener('resize', this._debouncedResizeHandler);
        */
    }

    /*
    firstUpdated() {
        this._updateCardSize();
        // Delay the dispatch of the 'll-rebuild' event to ensure the card has settled
        setTimeout(() => {
            if (!this._initialSetupComplete && !this._rebuildDispatched && !window.llRebuildFired) { // Check if the initial setup is not complete and the call has not been made
                this._initialSetupComplete = true; // Set the flag to true after the initial setup is complete
                this._rebuildDispatched = true; // Set the flag to true to indicate that the call has been made
                window.llRebuildFired = true; // Set the global flag to indicate that the event has been fired
                this.dispatchEventToChildCard('ll-rebuild'); // Dispatch the 'll-rebuild' event to the child card
            }
        }, 1000);
    }
    */
    /*
    requestUpdateOnChildCard() {
        const buttonCard = this.querySelector('cblcars-button-card');
        if (buttonCard) {
            buttonCard.requestUpdate();
            console.log('Called requestUpdate on child card');
        } else {
            console.log('Child card not found to call requestUpdate');
        }
    }
    */

    /*
    _updateCardSize() {

        //const parentClientWidth = this.parentElement.clientWidth;
        //const parentClientHeight = this.parentElement.clientHeight;
        const offsetWidth = this.offsetWidth;
        const offsetHeight = this.offsetHeight;

        //console.log("Parent client width:", parentClientWidth, " Parent client height:", parentClientHeight);
        console.log("_updateCardSize: Offset width:", offsetWidth, " Offset height:", offsetHeight);

        let width, height;

        // Determine which set of dimensions to use
        //if (parentClientWidth > 0 && parentClientHeight > 0 && (parentClientWidth < offsetWidth || parentClientHeight < offsetHeight)) {
        //  width = parentClientWidth;
        //  height = parentClientHeight;
        //} else
        if (offsetWidth > 0 && offsetHeight > 0) {
          width = offsetWidth;
          height = offsetHeight;
        } else {

          console.log("Returning because both dimension sets are invalid");
          return;
        }

        console.log('Updating card size:', width, height);

        const significantChange = 10;

        if (
            Math.abs(width - this._lastWidth) > significantChange ||
            Math.abs(height - this._lastHeight) > significantChange
          ) {
            this._lastWidth = width;
            this._lastHeight = height;

            if (this._config && this._config.cblcars_card_config) {
                const newConfig = {
                    ...this._config,
                    cblcars_card_config: {
                        ...this._config.cblcars_card_config,
                        variables: {
                            ...this._config.cblcars_card_config.variables,
                        card: {
                            ...this._config.cblcars_card_config.variables?.card,
                            width: `${width}px`,
                            height: `${height}px`,
                            },
                        },
                    },
                };
                console.log('in _updateCardSize Setting new config:', newConfig);
                this._config = newConfig;

                // Call setConfig on the child card with the updated configuration
                const buttonCard = this.querySelector('cblcars-button-card');
                if (buttonCard) {
                    console.log('Updating config on child card in _updateCardSize:', newConfig.cblcars_card_config);
                    buttonCard.style.setProperty('--button-card-width', `${width}px`);
                    buttonCard.style.setProperty('--button-card-height', `${height}px`);
                    buttonCard.setConfig(newConfig.cblcars_card_config);
                } else {
                    console.log('in _updateCardSize trying to run setConfig on button card - buttonCard not found in _updateCardSize');
                }
            }

            this.requestUpdate();
        } else {
            console.log('in _updateCardSize - no significant change: width:', width, ' height:', height, ' lastWidth:', this._lastWidth, ' lastHeight:',this._lastHeight);
        }
    }
    */

    /*
    dispatchEventToChildCard(eventName) {
        const buttonCard = this.querySelector('cblcars-button-card');
        if (buttonCard) {
            const event = new CustomEvent(eventName, {
                bubbles: false,
                composed: true,
            });
            buttonCard.dispatchEvent(event);
            console.log(`Dispatched ${eventName} event to child card`);
        } else {
            console.log(`Child card not found to dispatch ${eventName} event`);
        }
    }
    */


    createRenderRoot() {
        console.log('createRenderRoot called');
        return this;
      }


    render() {
        if (!this._config) {
            console.log('in render() No config found');
            // Show a placeholder or nothing if config is not set
            return html``;
        }

        console.log('CBLCARSBaseCard render called with config:', this._config);

        return html`
            <cblcars-button-card
                .hass="${this.hass}"
                .config="${this._config.cblcars_card_config}"
            ></cblcars-button-card>
        `;
    }

    /*
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    */

    static styles = css`
        :host {
            display: contents;
        }
        `;
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