
// Flag to check if the configuration has been merged
let isConfigMerged = false;

const fontUrl = 'https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap'; 

const templates_url = '/hacsfiles/cb-lcars/cb-lcars-full-new.yaml';
const airlock_url = '/hacsfiles/cb-lcars/cb-lcars-airlock.yaml';
const gallery_url = '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml';


/* old way.. 
// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
//script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
script.type = 'text/javascript';
document.head.appendChild(script);
*/

//change to promise to make sure js-yaml is loaded for functions that need it
const loadJsYaml = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
    script.type = 'text/javascript';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load js-yaml script'));
    document.head.appendChild(script);
});

async function loadFont() {
    try {
      const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
      if (!existingLink) {
        const link = document.createElement('link'); 
        link.href = fontUrl; 
        link.rel = 'stylesheet'; 
        document.head.appendChild(link);
        await cblcarsLog('info', `Loaded CB-LCARS required font from: ${fontUrl}`);
      } else {
        console.log(`CB-LCARS font already loaded from: ${fontUrl}`);
      }
    } catch (error) {
      await cblcarsLog('error', `Failed to load font from: ${fontUrl}: ${error.message}`);
    }
  }
  

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



async function cblcarsLog(level, message) {
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
    const newConfig = await readYamlFile(filePath);
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
                await cblcarsLog('info', 'CB-LCARS template configuration updated successfully in Lovelace');
                isConfigMerged = true;

            } else if (newVersion === 0) {
                await cblcarsLog('warn', 'New configuration version is not defined. Please set a version in your YAML file.');
            } else {
                await cblcarsLog('info', 'CB-LCARS dashboard templates configuration is up to date');
                isConfigMerged = true;
            }
        } else {
        await cblcarsLog('warn', 'Automatic configuration management of CB-LCARS templates is disabled. Set [cb-lcars.manage_config: true] in your Lovelace configuration to enable it.');
        }
    } else {
        await cblcarsLog('error', 'Failed to retrieve Lovelace configuration');
    }
}


// Function to initialize the configuration update
async function initializeConfigUpdate() {
    //await cblcarsLog('debug',`In initializeConfigUpdate() isConfigMerged = ${isConfigMerged}`);
    if (!isConfigMerged) {
        await cblcarsLog('info',`Will try to update lovelace config with contents of ${templates_url}`);
        await updateLovelaceConfig(templates_url);
    } else {
        await cblcarsLog('debug','isConfigMerged is true - bypassing config merge into lovelace');
    }
}

async function fetchYAML(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const yamlContent = await response.text();
            await cblcarsLog('debug',`Fetched yaml file ${url}`);
            
            return yamlContent;
        } else {
            throw new Error(`Error fetching YAML: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        throw new Error(`Error fetching YAML: ${error.message}`);
    }
}

// Function to read and parse the YAML file
async function readYamlFile(url) {
    try {
        await loadJsYaml; // Wait for the js-yaml script to load
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response);
        await cblcarsLog('info',`Processed YAML file: ${url}`);
        await cblcarsLog('debug', jsObject);
        return jsObject;
    } catch (error) {
        await cblcarsLog('error', `Failed to read or parse YAML file: ${error.message}`);
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

            await cblcarsLog('info','Generating CB-LCARS dashboard strategy');
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
            await cblcarsLog('error', `Error generating CB-LCARS dashboard strategy: ${error.message}`);
            throw error;
        }
    }
}

//define airlock view strategy
class CBLCARSViewStrategyAirlock {
    static async generate(config, hass) {
        try {
            //const yamlContent = await fetchYAML(airlock_url);
            //const jsObject = jsyaml.load(yamlContent);
            //cblcarsLog('info',`fetched and parsed yaml ${airlock_url}`);
            //cblcarsLog('debug',jsObject);

            const jsObject = await readYamlFile(airlock_url);
            //cblcarsLog('warn',"dumping airlock strategy after readYamlFile function...");
            //cblcarsLog('debug',jsObject);

            await cblcarsLog('info','Generating CB-LCARS Airlock strategy view');
            return {
                ...jsObject
            };
        } catch (error) {
            await cblcarsLog('error', `Error loading CB-LCARS Airlock strategy view: ${error.message}`);
            throw error;
        }
    }
}
//define gallery view strategy
class CBLCARSViewStrategyGallery {
    static async generate(config, hass) {
        try {
            //const yamlContent = await fetchYAML(gallery_url);
            //const jsObject = jsyaml.load(yamlContent);
            //cblcarsLog('info',`fetched and parsed yaml ${gallery_url}`);
            //cblcarsLog('debug',jsObject);
            
            const jsObject = await readYamlFile(gallery_url);
            //cblcarsLog('warn',"dumping gallery strategy after readYamlFile function...");
            //cblcarsLog('debug',jsObject);
            await cblcarsLog('info','Generating CB-LCARS Gallery strategy view');
            return {
                ...jsObject
            };
        } catch (error) {
            await cblcarsLog('error', `Error loading CB-LCARS Gallery strategy view: ${error.message}`);
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
        if (!config || !config.cblcars_card_config) {
        throw new Error("You need to define cblcars_card_config:");
        }

        // Ensure cblcars_card_config is an object
        config.cblcars_card_config = config.cblcars_card_config || {};

        // Check if 'entity' or 'label' is defined in the main config and copy it to cblcars_card_config if not already present.  user may not remember to that the button-card config is in cblcars_card_config
        if (config.entity && !config.cblcars_card_config.entity) {
        config.cblcars_card_config.entity = config.entity;
        }
        if (config.label && !config.cblcars_card_config.label) {
            config.cblcars_card_config.label = config.label;
        }
    
        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = config.cblcars_card_config.template || [];
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
    static getStubConfig() {
        return { 
            cb_lcars_card_config: {
                label: 'cb-lcars-base',
                show_label: true,
                template: ['cb-lcars-base']
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
        cblcarsLog('debug','connectedcallback called');
        try {
            // Attempt to render the card - the templates may not be loaded into lovelace yet, so we'll have to try initialize if this fails
            if (!this._card) {
                cblcarsLog('debug','creating new button-card element');
                this._card = document.createElement('button-card');
                this.appendChild(this._card);
            }
            cblcarsLog('debug','setting config on button-card element');
            this._card.setConfig(this._config.cblcars_card_config);
        } catch (error) {
            cblcarsLog('error',`Error rendering card: ${error}`);
        } finally {
            cblcarsLog('debug','Attempting to initialize config')
            // Ensure initializeConfigUpdate runs even if rendering fails
            initializeConfigUpdate();
        }
    }
}


class CBLCARSLabelCard extends CBLCARSBaseCard {
    setConfig(config) {
        const specialConfig = {
            ...config,
            cblcars_card_config: {
                ...config.cblcars_card_config,
                template: ['cb-lcars-label', ...(config.cblcars_card_config.template || [])],
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
        // Ensure cblcars_card_config is an object
        config.cblcars_card_config = config.cblcars_card_config || {};

        // Merge templates only if they exist
        const defaultTemplates = ['cb-lcars-header'];
        const userTemplates = config.cblcars_card_config.template ? [...config.cblcars_card_config.template] : [];
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
//Define the cards for Home Assistant usage
customElements.define('cb-lcars-base-card',CBLCARSBaseCard);
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



// Call log banner function immediately when the script loads
cblcarsLogBanner();
//loadFont();

// Use DOMContentLoaded event to initialize configuration update
document.addEventListener('DOMContentLoaded', initializeConfigUpdate);
// load the font if it's not already available
document.addEventListener('DOMContentLoaded', loadFont);
    
    

/*

look at this later maybe...

// Use MutationObserver to watch for changes in the DOM and reinitialize if necessary
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length || mutation.removedNodes.length) {
            initializeConfigUpdate();
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });
*/