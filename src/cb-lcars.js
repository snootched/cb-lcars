//import { ButtonCard } from 'button-card';
//import { mergeDeep, mergeStatesById,} from './custom-button-card/button-card.js';
import "./cblcars-button-card.js";

// Function to wait for button-card to be defined
async function waitForButtonCard() {
    await customElements.whenDefined('cblcars-button-card');
}
// Call the function to wait for button-card to be defined
await waitForButtonCard();


import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsLog, logImportStatus, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { fetchYAML, readYamlFile } from './utils/cb-lcars-fileutils.js';
import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock, CBLCARSViewStrategyGallery } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import { CBLCARSPanel } from './panel/cb-lcars-panel.js';

import jsyaml from 'js-yaml';
import { html, css } from 'lit';
import { fireEvent } from "custom-card-helpers";
import semver from 'semver';


// Call log banner function immediately when the script loads
cblcarsLogBanner();

// Log import statuses for each import
/*
console.groupCollapsed('CB-LCARS imports');
logImportStatus('CBLCARS', CBLCARS);
logImportStatus('jsyaml', jsyaml);
logImportStatus('html:', html);
logImportStatus('css', css);
logImportStatus('fireEvent:', fireEvent);
console.groupEnd();
*/

// Check for custom element dependencies
if (!customElements.get('cblcars-button-card')) {
    cblcarsLog('error',`Custom Button Card for LCARS [cblcars-button-card] was not found!`);
}

// check for installation of my-slider-v2 and if not registerd, include it from local file?
// Check for custom element dependencies
if (!customElements.get('my-slider-v2')) {
    cblcarsLog('error',`MySliderV2 Custom Card [my-slider-v2] was not found!  Please install from HACS.`);
}

loadFont();

// Flag to check if the configuration has been merged (this was for lovelace config)
let isConfigMerged = false;

// Flag to check if the templates have been loaded
let templatesLoaded = false;

// Flag to check if the stub configuration has been loaded
let stubConfigLoaded = false;

// Load the templates from our yaml file
let templates = {};
async function loadTemplates(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);

        // Store the YAML content in window.cblcars_card_templates
        if (!window.cblcars_card_templates) {
            window.cblcars_card_templates = [];
        }
        window.cblcars_card_templates.push(yamlContent.cblcars_card_templates);

        templates = yamlContent || {};
        templatesLoaded = true;
        cblcarsLog('debug', `CB-LCARS dashboard templates loaded from source file [${CBLCARS.templates_uri}]`, templates);
    } catch (error) {
        cblcarsLog('error', 'Failed to get the CB-LCARS lovelace templates from source file.', error);
    }
}
const templatesPromise = loadTemplates(CBLCARS.templates_uri);

// Load the stub configuration from our yaml file
let stubConfig = {};
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
const stubConfigPromise = loadStubConfig(CBLCARS.stub_config_uri);


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



// Function to initialize the configuration update
async function initializeConfigUpdate() {

    if(!templatesLoaded) {
        await templatesPromise;
    }

    if(!stubConfigLoaded) {
        await stubConfigPromise;
    }

    // Use a promise to ensure only one update happens at a time
    if (!isConfigMerged) {
        const updatePromise = new Promise(async (resolve) => {
        // Update Lovelace config
        await updateLovelaceConfig(CBLCARS.templates_uri);
        resolve();
        });

        await updatePromise;
        isConfigMerged = true;
    }
}

/*
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
*/

class CBLCARSBaseCard extends HTMLElement {

    constructor () {
        super();
        //this.attachShadow({ mode: 'open' });

        this.resizeObserver = null; // Define resizeObserver as a class property

        this.isResizing = false;

        initializeConfigUpdate();

        ////////
        //this._initialize();
        // Obtain the default configuration from getStubConfig
        //const defaultConfig = this.constructor.getStubConfig();
        // Pre-process the default configuration
        //this.preprocessedConfig = this.configFromTemplates(defaultConfig.cblcars_card_config);
    }


    /*
    async _initialize() {
        await templatesPromise;
        this.initialized = true;
    }
    */

    /*

    mergeDeep(...objects) {
        const isObject = (obj) => obj && typeof obj === 'object';

        return objects.reduce((prev, obj) => {
            Object.keys(obj).forEach((key) => {
                const pVal = prev[key];
                const oVal = obj[key];

                if (Array.isArray(pVal) && Array.isArray(oVal)) {

                    prev[key] = pVal.concat(...oVal);
                } else if (isObject(pVal) && isObject(oVal)) {
                    prev[key] = this.mergeDeep(pVal, oVal);
                } else {
                    prev[key] = oVal;
                }
            });

            return prev;
        }, {});
    }
    */

    /*
    mergeStatesById(intoStates, fromStates) {
        let resultStateConfigs = [];
        if (intoStates) {
            intoStates.forEach((intoState) => {
                let localState = intoState;
                if (fromStates) {
                    fromStates.forEach((fromState) => {
                        if (fromState.id && intoState.id && fromState.id == intoState.id)
                            localState = this.mergeDeep(localState, fromState);
                    });
                }
                resultStateConfigs.push(localState);
            });
        }
        if (fromStates) {

            resultStateConfigs = resultStateConfigs.concat(
                fromStates.filter((x) => (!intoStates ? true : !intoStates.find((y) => (y.id && x.id ? y.id == x.id : false)))),
            );
        }
        return resultStateConfigs;
    }
    */
    /*
    configFromTemplates(config) {
        const tpl = config.template;
        if (!tpl) return config;
        let result = {};
        let mergedStateConfig;
        const tpls = Array.isArray(tpl) ? tpl : [tpl];
        tpls.forEach((template) => {
            if (!templates[template]) throw new Error(`CB-LCARS Template ['${template}'] is missing!`);
            const res = this.configFromTemplates(templates[template]);
            result = this.mergeDeep(result, res);
            mergedStateConfig = this.mergeStatesById(mergedStateConfig, res.state);
        });
        result = this.mergeDeep(result, config);
        result.state = this.mergeStatesById(mergedStateConfig, config.state);
        return result;
    }
    */

    /*
    loadDefaultConfig() {
        const defaultConfig = {
            type: 'custom:cblcars-button-card',
            template: ['cb-lcars-base'],
            // Add other default configurations as needed
        };

        this._config = {
            cblcars_card_config: defaultConfig
        };

        if (this._card) {
            this._card.setConfig(this._config.cblcars_card_config);
        }
    }
    */

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

        //cblcarsLog('debug','new card config: ',this._config);

        //instantiate the button-card
        if (!this._card) {
            this._card = document.createElement('cblcars-button-card');
            this.appendChild(this._card);
        }

        ////may not need this since in connectedCallback
        //set our config on the button-card we just stood up
        //this._card.setConfig(this._config.cblcars_card_config);

        // Set the config on the button-card after it's attached to the DOM
        this._card.addEventListener('hass-card-element', () => {
            this._card.setConfig(this._config.cblcars_card_config);
        });
    }

    /*  this one is messed up trying to pre-merge templates
    async setConfig(config) {

        ///////
        if (!this.initialized) {
            await this._initialize();
            this.initialized = true;
        }

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

        //////////////////////////
        // Merge the templates into buttonCardConfig
        //buttonCardConfig = this.configFromTemplates(buttonCardConfig);
        let buttonCardConfigCopy = { ...buttonCardConfig };
        buttonCardConfigCopy = this.configFromTemplates(buttonCardConfigCopy);

        // Remove the template array from the config as we have pre-processed it
        delete buttonCardConfigCopy.template;

        //merge the button_card_config into config
        this._config = {
            ...config,
            cblcars_card_config: buttonCardConfigCopy
            //cblcars_card_config: buttonCardConfig
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
    */

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

    connectedCallback() {
        //cblcarsLog('debug','connectedcallback called');
        try {
            // Attempt to render the card - the templates may not be loaded into lovelace yet, so we'll have to try initialize if this fails
            if (!this._card) {
            //    //cblcarsLog('debug','creating new button-card element');
                this._card = document.createElement('cblcars-button-card');
                this.appendChild(this._card);
            }

            // Ensure the configuration is loaded and set it on the card
            /*
            if (this._config) {
                // Set the config on the button-card after it's attached to the DOM
                this._card.addEventListener('hass-card-element', () => {
                    this._card.setConfig(this._config.cblcars_card_config);
                });
            }
            */

            if (this._config) {
                // Ensure the _card element is defined and initialized
                customElements.whenDefined('cblcars-button-card').then(() => {
                    if (this._card) {
                        // Set the config on the button-card after it's attached to the DOM
                        this._card.addEventListener('hass-card-element', () => {
                            try {
                                this._card.setConfig(this._config.cblcars_card_config);
                            } catch (error) {
                                cblcarsLog('error','Error setting config on cblcars-button-card:', error);
                            }
                        });
                    } else {
                        cblcarsLog('error','Error: _card element is not initialized.');
                    }
                }).catch(error => {
                    cblcarsLog('error','Error: cblcars-button-card custom element is not defined.', error);
                });
            }

            // Force a redraw on the first instantiation
            this.redrawChildCard();

            // Add event listeners
            window.addEventListener('resize', this.handleResize.bind(this));
            //window.addEventListener('resize', this.handleResize);
            window.addEventListener('load', this.handleLoad.bind(this));

            try {
                // Create a ResizeObserver to handle resizing of the card
                this.resizeObserver = new ResizeObserver(entries => {
                    //cblcarsLog('debug', 'Element resized, updating child card...');
                    //this.redrawChildCard();
                    for (let entry of entries) {
                        //console.log('ResizeObserver entry for this:', entry);
                        //let width = entry.contentRect.width || entry.target.offsetWidth;
                        //let height = entry.contentRect.height || entry.target.offsetHeight;
                        //console.log('This dimensions:', width, height);
                        //this.handleResize(width, height);
                        this.handleResize();
                    }

                });
                this.resizeObserver.observe(this);

            } catch (error) {
                cblcarsLog('error',`Error creating ResizeObserver: ${error}`);
            }

        } catch (error) {
            cblcarsLog('error',`Error in connectedCallback: ${error}`);
        }
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

//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-elbow-card',CBLCARSElbowCard);
customElements.define('cb-lcars-double-elbow-card',CBLCARSDoubleElbowCard);
customElements.define('cb-lcars-multimeter-card',CBLCARSMultimeterCard);
customElements.define('cb-lcars-dpad-card',CBLCARSDPADCard);
customElements.define('cb-lcars-button-card',CBLCARSButtonCard);

//deprecated - moved into new multimeter card
//customElements.define('cb-lcars-slider-card',CBLCARSSliderCard);

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
    /*
    {
        type: 'cb-lcars-slider-card',
        name: 'CB-LCARS Sliders [deprecated]',
        preview: true,
        description: 'CB-LCARS Sliders and Gauges [no decorations]',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    */
];

window.customCards.push(...CBLCARSCardClasses);


