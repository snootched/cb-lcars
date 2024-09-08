import * as CBLCARS from './cb-lcars-vars.js'
import jsyaml from 'js-yaml';
import { html, css } from 'lit';
import { fireEvent } from "custom-card-helpers";
import semver from 'semver';

//import EditorForm from '@marcokreeft/ha-editor-formbuilder';
//import { FormControlType } from '@marcokreeft/ha-editor-formbuilder/dist/interfaces.js';
//import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from '@marcokreeft/ha-editor-formbuilder/dist/utils/entities.js';
import EditorForm from 'ha-editor-formbuilder';
import { FormControlType } from 'ha-editor-formbuilder/dist/interfaces.js';
import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from 'ha-editor-formbuilder/dist/utils/entities.js';


// Flag to check if the configuration has been merged
let isConfigMerged = false;



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

    const version = CBLCARS.CBLCARS_VERSION;
    const url = CBLCARS.project_url;
    const baseString = "CB-LCARS v" + version;
    const padding = 4;

    // Calculate the total length including padding
    const totalLength = url.length + padding;
    const spacesNeeded = totalLength - baseString.length;

    // Create strings with the required number of spaces
    const spaces = ' '.repeat(spacesNeeded);
    const paddedUrl = ' '.repeat(padding) + url;

    console.info(`%c${spaces}${baseString}  %c\n%c${paddedUrl}  `, styles1.join(';'), invisibleStyle.join(';'), styles2.join(';'));
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
logImportStatus('CBLCARS', CBLCARS);
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
      const existingLink = document.querySelector(`link[href="${CBLCARS.font_url}"]`);
      if (!existingLink) {
        const link = document.createElement('link'); 
        link.href = CBLCARS.font_url; 
        link.rel = 'stylesheet'; 
        document.head.appendChild(link);
        cblcarsLog('info', `Loaded CB-LCARS required font from: ${CBLCARS.font_url}`);
      } else {
        console.log(`CB-LCARS font already loaded from: ${CBLCARS.font_url}`);
      }
    } catch (error) {
      await cblcarsLog('error', `Failed to load font from: ${CBLCARS.font_url}: ${error.message}`);
    }
  }
  

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

                    // Apply the updated configuration
                    await lovelaceConfig.saveConfig(updatedConfig);
                    cblcarsLog('info', `CB-LCARS dashboard templates updated v${newLovelaceVersion} (from v${currentLovelaceVersion})`);
                    isConfigMerged = true;

                } else if (newLovelaceVersion === 0) {
                    cblcarsLog('warn', 'CB-LCARS templates version is not defined - please set a version in the source YAML file.');
                } else {
                    cblcarsLog('info', `CB-LCARS dashboard templates are up to date (v${currentLovelaceVersion})`);
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
        //cblcarsLog('debug',`Check (and update) lovelace config against: ${CBLCARS.templates_uri}`);
        await updateLovelaceConfig(CBLCARS.templates_uri);
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

            //const yamlContent = await fetchYAML(CBLCARS.templates_uri);
            //const jsObject = jsyaml.load(yamlContent);
            //cblcarsLog('info',`fetched and parsed yaml ${CBLCARS.templates_uri}`);
            //cblcarsLog('debug',jsObject);
            const jsObject = await readYamlFile(CBLCARS.templates_uri);

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
            const jsObject = await readYamlFile(CBLCARS.airlock_uri);

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
            const jsObject = await readYamlFile(CBLCARS.gallery_uri);

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

    constructor () {
        super();
        //this.attachShadow({ mode: 'open' });

        initializeConfigUpdate();

        this.observer = null;

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
            cblcars_card_config: {
                label: 'cb-lcars-base',
                show_label: true
            }
        }
      }
  
    getCardSize() {
        return this._card ? this._card.getCardSize() : 1;
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
            this.observer = new MutationObserver(this.handleMutations.bind(this));
            if (this.parentElement) {
                cblcarsLog("warn","creating mutation observer")
                this.observer.observe(this.parentElement, { attributes: true, childList: true, subtree: true });
            }
            //this.observer.observe(this._card, { attributes: true });


            //causes inifinite loop
            //this.observer = new MutationObserver(this.handleMutations.bind(this));
            //this.observer.observe(this, { childList: true, subtree: true, attributes: true });
            
            //const observer = new MutationObserver(this.handleMutations);
            //observer.observe(this, { attributes: true, childList: true, subtree: true });



        } catch (error) {
            cblcarsLog('error',`Error rendering card: ${error}`);
        } finally {
            cblcarsLog('debug','Unable to create and render card',this);
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
        if (this.observer) {
            this.observer.disconnect();
        }   }
    

    
    handleResize() {
        cblcarsLog('debug','Window resized, updating child card...');
        this.redrawChildCard();
    }

    handleLoad() {
        cblcarsLog('debug', 'Page loaded, updating child card...');
        this.redrawChildCard();
    }
    handleMutations(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                cblcarsLog('debug', 'DOM mutation observed, updating child card...');
                this.redrawChildCard();
                break;
            }
        }
    }
    /*
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

        if (this._card.requestUpdate) {
            // If the child card uses LitElement, this will schedule an update
            cblcarsLog('debug', "doing this._card.requestUpdate()");
            this._card.requestUpdate();
        }

        // Re-read the configuration and re-render the card
        if (this._config) {
            cblcarsLog('debug', "doing a this._card.setConfig() on the child");
            this._card.setConfig(this._config.cblcars_card_config);
        } else {
            console.error('No configuration found for the child card.');
        }



        /*
        //requestUpdate for lit-based cards
        if (this._card.requestUpdate) {
            cblcarsLog('debug', "doing this._card.requestUpdater()");
            this._card.requestUpdate();
        } else {
            cblcarsLog('debug', "requestUpdate doesn't exist - doing alternate method");
            //remove drom the DOM and and reinsert forcing non-lit elements to re-render
            let parent = this._card.parentNode;
            let next = this._card.nextSibling;
            parent.removeChild(this._card);
            parent.insertBefore(this._card, next);
        }
        */
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

class CBLCARSMultimeterCard extends CBLCARSBaseCard {
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

        readFormEditorYamlFile(CBLCARS.card_editor_uri)
            .then(formDefinitions => {
                cblcarsLog('debug','formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                //console.debug('this._formDefinitions: ',this._formDefinitions)
                this._formContent = formDefinitions[cardType].render_form;
                //console.debug('this._formContent: ',this._formContent)
                this._formStyles = formDefinitions[cardType].css || {};
                //console.debug('this._formStyles: ',this._formStyles)
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
        if (!!this._formStyles) {
            //cblcarsLog('debug','No editor form styles found for this card - returning blank css.');
            return css``;
        }

        //cblcarsLog('debug',"formStyles: ",this._formStyles)
        return css`
            ${this._formStyles}
        `;
    }

}    
        





//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-header-card',CBLCARSHeaderCard);
customElements.define('cb-lcars-multimeter-card',CBLCARSMultimeterCard);

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
window.customCards.push({
    type: 'cb-lcars-multimeter-card',
    name: 'CB-LCARS Multimeter',
    preview: true,
    description: 'CB-LCARS Multimeter card',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});


loadFont();

// Use DOMContentLoaded event to initialize configuration update
//document.addEventListener('DOMContentLoaded', initializeConfigUpdate);
// load the font if it's not already available
//document.addEventListener('DOMContentLoaded', loadFont);
    
    