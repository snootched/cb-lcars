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

//import EditorForm from '@marcokreeft/ha-editor-formbuilder';
//import { FormControlType } from '@marcokreeft/ha-editor-formbuilder/dist/interfaces.js';
//import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from '@marcokreeft/ha-editor-formbuilder/dist/utils/entities.js';
import EditorForm from 'ha-editor-formbuilder';
import { FormControlType } from 'ha-editor-formbuilder/dist/interfaces.js';
import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from 'ha-editor-formbuilder/dist/utils/entities.js';


// Call log banner function immediately when the script loads
cblcarsLogBanner();

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
    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
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

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}

class CBLCARSDPADCard extends CBLCARSBaseCard {
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
            grid_rows: 1,
            grid_columns: 4
        };
      }
}
        
class CBLCARSButtonPicardFilled extends CBLCARSBaseCard {
    setConfig(config) {
 
        const defaultTemplates = ['cb-lcars-button-picard-filled'];
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
            grid_min_rows: 1,
            grid_rows: 1,
            grid_columns: 1,
            grid_min_columns: 1
        };
      }
}


// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-gallery', CBLCARSViewStrategyGallery);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);

//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
customElements.define('cb-lcars-label-card',CBLCARSLabelCard);
customElements.define('cb-lcars-header-card',CBLCARSHeaderCard);
customElements.define('cb-lcars-multimeter-card',CBLCARSMultimeterCard);
customElements.define('cb-lcars-dpad-card',CBLCARSDPADCard);
customElements.define('cb-lcars-button-picard-filled-card',CBLCARSButtonPicardFilled);

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
window.customCards.push({
    type: 'cb-lcars-dpad-card',
    name: 'CB-LCARS D-Pad',
    preview: true,
    description: 'CB-LCARS D-Pad card',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});
window.customCards.push({
    type: 'cb-lcars-button-picard-filled-card',
    name: 'CB-LCARS Button (Picard)',
    preview: true,
    description: 'CB-LCARS Button from Picard',
    documentationURL: "https://cb-lcars.unimatrix01.ca",
});


    