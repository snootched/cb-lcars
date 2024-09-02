import * as cblcarsFormVars from './cb-lcars-form-vars.js'
import jsyaml from 'js-yaml';
import { html, css } from 'lit';
import { fireEvent } from "custom-card-helpers";
import EditorForm from '@marcokreeft/ha-editor-formbuilder';
import { FormControlType } from '@marcokreeft/ha-editor-formbuilder/dist/interfaces.js';
import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from '@marcokreeft/ha-editor-formbuilder/dist/utils/entities.js';



// Flag to check if the configuration has been merged
let isConfigMerged = false;

const fontUrl = 'https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap'; 

const templates_url = '/hacsfiles/cb-lcars/cb-lcars-full-new.yaml';
const airlock_url = '/hacsfiles/cb-lcars/cb-lcars-airlock.yaml';
const gallery_url = '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml';
const card_editor_url = '/hacsfiles/cb-lcars/cb-lcars-card-editor-forms.yaml'


async function cblcarsLogBanner() {
    let styles1 = [
        'color: white',
        'font-weight: bold',
        'padding: 2px 4px',
        'border-radius: 5em 5em 0 0', // Top left and right rounded, bottom left and right square
        'background-color: #37a6d1' // Blue
    ];

    let styles2 = [
        'color: white',
        'padding: 2px 4px',
        'border-radius: 0 0 5em 5em', // Top left and right square, bottom left and right rounded
        'background-color: #37a6d1' // Blue
    ];

    let invisibleStyle = [
        'color: transparent',
        'padding: 0',
        'border: none'
    ];

    console.info(`%c                    CB-LCARS v0.0.0 %c\n%c   https://cb-lcars.unimatrix01.ca  `, styles1.join(';'), invisibleStyle.join(';'), styles2.join(';'));
}

// Call log banner function immediately when the script loads
cblcarsLogBanner();


function cblcarsLog(level, message, obj = null) {
    
    const commonStyles = 'color: white; padding: 2px 4px; border-radius: 15px;';
    const levelStyles = {
      info: 'background-color: #37a6d1', // Blue
      warn: 'background-color: #ff6753', // Orange
      error: 'background-color: #ef1d10', // Red
      debug: 'background-color: #8e44ad', // Purple
      default: 'background-color: #6d748c', // Gray for unknown levels
    };
  
    // Capture the stack trace for caller information
    //const stack = new Error().stack;
    //const caller = stack.split('\n')[2].trim(); // Get the caller from the stack trace
    // Create a formatted log message with the specified level, caller, and message
    //const logMessage = `%c    CB-LCARS | ${level} | ${caller} `;
    //remove caller cuz of webpack..

    const logMessage = `%c    CB-LCARS | ${level} `;
    
    // Choose the appropriate style based on the level
    //const style = levelStyles[level] || levelStyles.default;
    const style = `${levelStyles[level] || levelStyles.default}; ${commonStyles}`;
  
    // Log the message using the chosen style and console method
    switch (level) {
      case 'info':
        console.log(logMessage, style, message, obj);
        break;
      case 'warn':
        console.warn(logMessage, style, message, obj);
        break;
      case 'error':
        console.error(logMessage, style, message, obj);
        break;
      case 'debug':
        console.debug(logMessage, style, message, obj);
        break;
      default:
        console.log(logMessage, style, message, obj);
        break;
    }
  }

    // Assuming cblcarsLog is defined elsewhere with appropriate styling
function cblcarsLogGroup(level, title) {
    console.groupCollapsed(); // Create a collapsed group
    cblcarsLog(level, `Group: ${title}`);
    }

function logImportStatus(importName, importedValue) {
if (importedValue === undefined) {
    cblcarsLog('error', `Import error: ${importName} is not imported correctly.`);
} else {
    console.debug(`${importName} imported successfully.`);
}
}

// Log import statuses for each import
console.groupCollapsed('CB-LCARS imports');
logImportStatus('cblcarsFormVars', cblcarsFormVars);
logImportStatus('jsyaml', jsyaml);
logImportStatus('html:', html);
logImportStatus('css', css);
logImportStatus('fireEvent:', fireEvent);
logImportStatus('FormControlType:', FormControlType);
logImportStatus('getEntitiesByDomain:', getEntitiesByDomain);
logImportStatus('getEntitiesByDeviceClass:', getEntitiesByDeviceClass);
logImportStatus('formatList:', formatList);
logImportStatus('getDropdownOptionsFromEnum:', getDropdownOptionsFromEnum);
console.groupEnd();






async function loadFont() {
    try {
      const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
      if (!existingLink) {
        const link = document.createElement('link'); 
        link.href = fontUrl; 
        link.rel = 'stylesheet'; 
        document.head.appendChild(link);
        cblcarsLog('info', `Loaded CB-LCARS required font from: ${fontUrl}`);
      } else {
        console.log(`CB-LCARS font already loaded from: ${fontUrl}`);
      }
    } catch (error) {
      await cblcarsLog('error', `Failed to load font from: ${fontUrl}: ${error.message}`);
    }
  }
  

/*
async function cblcarsLogOld(level, message) {
    let styles = [
        'color: white',
        'padding: 2px 4px',
        'border-radius: 15px'
    ];

    // Capture the stack trace to find out the caller and add it to the log so we can follow this mess better
    const stack = new Error().stack;
    const caller = stack.split('\n')[2].trim(); // Get the caller from the stack trace
    //const functionName = caller.match(/at (\w+)/)[1]; // Extract the function name

    switch (level) {
        case 'info':
            styles.push('background-color: #37a6d1'); // Blue
            await console.log(`%c    CB-LCARS | ${level} | ${caller} `, styles.join(';'), message);
            break;
        case 'warn':
            styles.push('background-color: #ff6753'); // Orange
            await console.warn(`%c    CB-LCARS | ${level} | ${caller} `, styles.join(';'), message);
            break;
        case 'error':
            styles.push('background-color: #ef1d10'); // Red
            await console.error(`%c    CB-LCARS | ${level} | ${caller} `, styles.join(';'), message);
            break;
        case 'debug':
            styles.push('background-color: #8e44ad'); // Purple
            await console.debug(`%c    CB-LCARS | ${level} | ${caller} `, styles.join(';'), message);
            break;
        default:
            styles.push('background-color: #6d748c'); // Gray for unknown levels
            await console.log(`%c    CB-LCARS | ${level} | ${caller} `, styles.join(';'), message);
            break;
    }
}
*/

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
                const currentVersion = cbLcarsConfig.version || 0;
                const newVersion = newCbLcarsConfig.version || 0;

                if (newVersion > currentVersion) {
                    // Merge the cb-lcars configurations
                    const updatedCbLcarsConfig = { ...cbLcarsConfig, ...newCbLcarsConfig };

                    // Create a new configuration object by copying the existing one and updating cb-lcars
                    const updatedConfig = { ...lovelaceConfig.config, ...newConfig, 'cb-lcars': updatedCbLcarsConfig };

                    // Apply the updated configuration
                    await lovelaceConfig.saveConfig(updatedConfig);
                    cblcarsLog('info', 'CB-LCARS templates have been updated in dashboard configuration.');
                    isConfigMerged = true;

                } else if (newVersion === 0) {
                    cblcarsLog('warn', 'CB-LCARS templates version is not defined - please set a version in the source YAML file.');
                } else {
                    cblcarsLog('info', 'CB-LCARS dashboard templates are up to date.');
                    isConfigMerged = true;
                }
            } else {
            cblcarsLog('warn', 'CB-LCARS automatic dashboard management of templates is disabled. Set [cb-lcars.manage_config: true] in your Lovelace dashboard YAML to enable it.');
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
        //cblcarsLog('debug',`Check (and update) lovelace config against: ${templates_url}`);
        await updateLovelaceConfig(templates_url);
    } else {
        //await cblcarsLog('debug','isConfigMerged is true - bypassing config merge into lovelace');
    }
}

async function fetchYAML(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const yamlContent = await response.text();
            cblcarsLog('debug',`Fetched yaml file ${url}`);
            
            return yamlContent;
        } //else {
          //  throw new Error(`Error fetching YAML: ${response.status} ${response.statusText}`);
        //}
    } catch (error) {
        cblcarsLog('error', 'Error fetching YAML file ',error);
        throw error;
    }
}

// Function to read and parse the YAML file
async function readYamlFile(url) {
    try {
        //await loadJsYaml; // Wait for the js-yaml script to load
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response);
        //await cblcarsLog('info',`Processed YAML file: ${url}`);
        //await cblcarsLog('debug', jsObject);
        return jsObject;
    } catch (error) {
        cblcarsLog('error', 'Failed to parse YAML file',error.message);
        throw error; // Re-throw the error after logging it
    }
}
 

//custom yaml schema for the FormControlType
async function readFormEditorYamlFile(url) {
    try {
       // Define the FormControlType enum as per the renderer's code
        const FormControlType = {
            Dropdown: 'dropdown',
            Checkbox: 'checkbox',
            Checkboxes: 'checkboxes',
            Radio: 'radio',
            Switch: 'switch',
            Textbox: 'textbox',
            Filler: 'filler',
            EntityDropdown: 'entity-dropdown'
        };
        
        // Custom YAML type for FormControlType
        const FormControlTypeYamlType = new jsyaml.Type('!FormControlType', {
            kind: 'scalar',
            resolve: function (data) {
              return FormControlType.hasOwnProperty(data);
            },
            construct: function (data) {
              return FormControlType[data];
            },
            instanceOf: String,
            represent: function (data) {
              return data;
            }
          });
        
        // Create a schema that includes the custom type
        const SCHEMA = jsyaml.DEFAULT_SCHEMA.extend([FormControlTypeYamlType]);
  

        //await loadJsYaml; // Wait for the js-yaml script to load
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response, { schema: SCHEMA });
        cblcarsLog('debug',`Processed YAML file: ${url}`);
        cblcarsLog('debug','FormEditor object from custom schema:' ,jsObject);
        return jsObject;
    } catch (error) {
        cblcarsLog('error', 'Failed to parse YAML file',error.message);
        throw error; // Re-throw the error after logging it
    }
}

// Define the dashboard class
class CBLCARSDashboardStrategy {
    static async generate(config, hass) {
        try {
            const [areas, devices, entities] = await Promise.all([
                hass.callWS({ type: "config/area_registry/list" }),
                hass.callWS({ type: "config/device_registry/list" }),
                hass.callWS({ type: "config/entity_registry/list" }),
                ]);
            
            //cblcarsLog('debug areas:',areas);
            //cblcarsLog('debug devices:',devices);
            //cblcarsLog('debug entities:',entities);

            //const yamlContent = await fetchYAML(templates_url);
            //const jsObject = jsyaml.load(yamlContent);
            //cblcarsLog('info',`fetched and parsed yaml ${templates_url}`);
            //cblcarsLog('debug',jsObject);
            const jsObject = await readYamlFile(templates_url);

            //cblcarsLog('warn',"dumping dash strategy after readYamlFile function...");
            //cblcarsLog('debug',jsObject);

            cblcarsLog('info','Generating CB-LCARS dashboard strategy...');
            return {
                'cb-lcars': {
                    manage_config: true
                },
                title: 'CB-LCARS',
                ...jsObject, // Use the parsed YAML content here

                views: [
                    {
                        title: 'CB-LCARS Airlock',
                        strategy: {
                            type: 'custom:cb-lcars-airlock',
                            options: config
                        }
                    },
                    {
                        title: 'CB-LCARS Gallery',
                        strategy: {
                            type: 'custom:cb-lcars-gallery',
                            options: config
                        }
                    }
                ]
    
            };
        } catch (error) {
            cblcarsLog('error', `Error generating CB-LCARS dashboard strategy: ${error.message}`);
            throw error;
        }
    }
}

//define airlock view strategy
class CBLCARSViewStrategyAirlock {
    static async generate(config, hass) {
        try {
            cblcarsLog('info','Generating CB-LCARS Airlock strategy view...');
            const jsObject = await readYamlFile(airlock_url);

            return {
                ...jsObject
            };
        } catch (error) {
            cblcarsLog('error', `Error loading CB-LCARS Airlock strategy view: ${error.message}`);
            throw error;
        }
    }
}
//define gallery view strategy
class CBLCARSViewStrategyGallery {
    static async generate(config, hass) {
        try {
            cblcarsLog('info','Generating CB-LCARS Gallery strategy view...');
            const jsObject = await readYamlFile(gallery_url);

            return {
                ...jsObject
            };
        } catch (error) {
            cblcarsLog('error', `Error loading CB-LCARS Gallery strategy view: ${error.message}`);
            throw error;
        }
    }
}

// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-gallery', CBLCARSViewStrategyGallery);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);





class CBLCARSBaseCard extends HTMLElement {
    setConfig(config) {
        if (!config) {
            throw new Error("'cblcars_card_config:' section is required");
        }

        // Check if 'entity' or 'label' is defined in the main config and copy it to cblcars_card_config if not already present.  user may not remember to that the button-card config is in cblcars_card_config
        if (config.entity && !config.cblcars_card_config.entity) {
        config.cblcars_card_config.entity = config.entity;
        }
        if (config.label && !config.cblcars_card_config.label) {
            config.cblcars_card_config.label = config.label;
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
        this._config = { ...config, cblcars_card_config: buttonCardConfig };

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

    static getConfigElement() {
        //console.log('Attempting to create element: cb-lcars-card-editor');
        try {
            if (!customElements.get('cb-lcars-card-editor')) {
                cblcarsLog('error','Custom element cb-lcars-card-editor is not defined!');
                return null;
            }
            const element = document.createElement('cb-lcars-card-editor');
            //console.log('Element created:', element);
            return element;
        } catch (error) {
            cblcarsLog('error',`Error creating element cb-lcars-card-editor: `,error);
            return null;
        }
    }
    
    static getStubConfig() {
        return { 
            cb_lcars_card_config: {
                label: 'cb-lcars-base',
                show_label: true
            }
        }
      }
  
    getCardSize() {
        return this._card ? this._card.getCardSize() : 1;
    }

    constructor () {
        super();
        initializeConfigUpdate();
    }
    connectedCallback() {
        //cblcarsLog('debug','connectedcallback called');
        try {
            // Attempt to render the card - the templates may not be loaded into lovelace yet, so we'll have to try initialize if this fails
            if (!this._card) {
                cblcarsLog('debug','creating new button-card element');
                this._card = document.createElement('button-card');
                this.appendChild(this._card);
            }
            //cblcarsLog('debug','setting config on button-card element');
            this._card.setConfig(this._config.cblcars_card_config);
        } catch (error) {
            cblcarsLog('error',`Error rendering card: ${error}`);
        } finally {
            cblcarsLog('debug','Unable to create and render card - Attempting to re-initialize config')
            // Ensure initializeConfigUpdate runs even if rendering fails
            initializeConfigUpdate();
        }
    }
}


class CBLCARSLabelCard extends CBLCARSBaseCard {
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

        /*
        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: ['cb-lcars-label', ...(config.cblcars_card_config.template || [])],
            }
        };
        super.setConfig(specialConfig);
        */
    }
    static getStubConfig() {
        return { 
            cblcars_card_config: {
                label: "CB-LCARS Label",
                show_label: true
            }
        }
      }
}

class CBLCARSHeaderCard extends CBLCARSBaseCard {
    setConfig(config) {
 
        const defaultTemplates = ['cb-lcars-header'];
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
}



class CBLCARSCardEditor extends EditorForm {

    constructor() {
        super();
        //load the editor form yaml here or die
        }

    setConfig(config) {
        //let's get our this._config setup..
        super.setConfig(config);

        cblcarsLog('debug','CBLCARSCardEditor.setConfig()  this._config:',this._config);

        // Remove "custom:" prefix if it exists
        const cardType = config.type.replace(/^custom:/, '');

        cblcarsLog('debug',`cardType key for YAML config: ${cardType}`);

        readFormEditorYamlFile(card_editor_url)
            .then(formDefinitions => {
                console.debug('formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                console.debug('this._formDefinitions: ',this._formDefinitions)
                this._formContent = formDefinitions[cardType].render_form;
                console.debug('this._formContent: ',this._formContent)
                this._formStyles = formDefinitions[cardType].css || {};
                console.debug('this._formStyles: ',this._formStyles)
                this.requestUpdate();
            })
            .catch(error => {
                cblcarsLog('error','Error fetching editor form definitions: ', error);
            });    
    }
    render() {
        //console.log("in CBLCARSCardEditor.render()");
        //console.log('this._hass:', this._hass);
        //console.log('this._config:', this._config);
        if (!this._hass || !this._config || !this._formDefinitions) {
            cblcarsLog('debug','Unable to setup form rendering - returning blank');
            return html``;
        }


        const formContent = this._formContent;
        cblcarsLog('debug',`Editor formContent: `,formContent);

        try {
            const returnForm = this.renderForm(formContent);
            //console.log('returnForm:', returnForm);
            return returnForm;
        } catch (error) {
            console.error('Error in renderForm:', error);
            return html`<p>Error rendering form</p>`;
        }
    }

    styles() {
        if (!!this._form_formStyles) {
            cblcarsLog('debug','No editor form styles found for this card - returning blank css.');
            return css``;
        }

        /*
        return css`
            ${this._formStyles}
            // ... (other custom styles)
            .form-row {
                margin-bottom: 10px;
            }
        `;
        */

        return css`
            ${this._formStyles}
        `;
    }



   /*
    //this one should check and create the key in yaml if it doesn't exist
    _valueChanged(ev) {
        if (!this._config || !this._hass) {
            return;
        }
        const target = ev.target;
        const detail = ev.detail;
        //console.debug('target:', target);
        //console.debug('detail:', detail);
        //.debug('target.configValue:', target.configValue);

        if (target.tagName === "HA-CHECKBOX") {
            // Add or remove the value from the array
            const index = this._config[target.configValue]?.indexOf(target.value) ?? -1;
            if (target.checked && index < 0) {
                this._config[target.configValue] = [...(this._config[target.configValue] || []), target.value];
            } else if (!target.checked && index > -1) {
                this._config[target.configValue] = [
                    ...this._config[target.configValue].slice(0, index),
                    ...this._config[target.configValue].slice(index + 1)
                ];
            }
        } else if (target.configValue) {
            const keys = target.configValue.split(".");
            let config = this._config;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!config[keys[i]]) {
                    config[keys[i]] = {};
                    console.debug(`Created nested key: ${keys.slice(0, i + 1).join('.')}`);
                }
                config = config[keys[i]];
            }
            config[keys[keys.length - 1]] = target.checked !== undefined || !(detail?.value) ? target.value || target.checked : target.checked || detail.value;
            cblcarsLog('debug',`Updating key: ${target.configValue} with value: ${config[keys[keys.length - 1]]}`);

            this._config = { ...this._config };
            cblcarsLog('debug','form updated config: ',this._config);
        }

         // Fire the config-changed event
        (0, fireEvent)(this, "config-changed", {
            config: this._config,
        }, {
            bubbles: true,
            composed: true,
        });

        // Request an update to reflect the changes
        this.requestUpdate("_config");
    }
    */
}    
        


//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);


//console.log('Does class exist before define..CBLCARSCardEditor:', CBLCARSCardEditor);
if (!customElements.get('cb-lcars-card-editor')) {
    try {
        //console.log('Attempting to define custom element: cb-lcars-card-editor');
        customElements.define('cb-lcars-card-editor', CBLCARSCardEditor);
        //console.log('Custom element cb-lcars-card-editor defined successfully');
    } catch (error) {
        console.error('Error defining custom element cb-lcars-card-editor:', error);
    }
} else {
    console.log('Custom element cb-lcars-card-editor is already defined');
}


customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-header-card',CBLCARSHeaderCard);

// Register the cards to be available in the GUI editor
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'cb-lcars-base-card',
    name: 'CB-LCARS Base Card',
    description: 'For advanced use: the CB-LCARS base card for full manual configuration.',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});
window.customCards.push({
    type: 'cb-lcars-label-card',
    name: 'CB-LCARS Label',
    preview: true,
    description: 'CB-LCARS label card for text.',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});
window.customCards.push({
    type: 'cb-lcars-header-card',
    name: 'CB-LCARS Header',
    preview: true,
    description: 'CB-LCARS header card',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});



//loadFont();

// Use DOMContentLoaded event to initialize configuration update
document.addEventListener('DOMContentLoaded', initializeConfigUpdate);
// load the font if it's not already available
document.addEventListener('DOMContentLoaded', loadFont);
    
    