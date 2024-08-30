// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
//script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
script.type = 'text/javascript';
document.head.appendChild(script);

// Flag to check if the configuration has been merged
let isConfigMerged = false;

const templates_url = '/hacsfiles/cb-lcars/cb-lcars-full-new.yaml';
const airlock_url = '/hacsfiles/cb-lcars/cb-lcars-airlock.yaml';
const gallery_url = '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml';


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

    switch (level) {
        case 'info':
            styles.push('background-color: #37a6d1'); // Blue
            await console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
            break;
        case 'warn':
            styles.push('background-color: #ff6753'); // Orange
            await console.warn(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
            break;
        case 'error':
            styles.push('background-color: #ef1d10'); // Red
            await console.error(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
            break;
        case 'debug':
            styles.push('background-color: #8e44ad'); // Purple
            await console.debug(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
            break;
        default:
            styles.push('background-color: #6d748c'); // Gray for unknown levels
            await console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
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
                await cblcarsLog('info', 'Lovelace configuration updated successfully');
                isConfigMerged = true;

            } else if (newVersion === 0) {
                await cblcarsLog('warn', 'New configuration version is not defined. Please set a version in your YAML file.');
            } else {
                await cblcarsLog('info', 'Configuration is up to date');
                isConfigMerged = true;
            }
        } else {
        await cblcarsLog('warn', 'Configuration management is disabled. Set cb-lcars.manage_config to true in your Lovelace configuration to enable it.');
        }
    } else {
        await cblcarsLog('error', 'Failed to retrieve Lovelace configuration');
    }
}


// Function to initialize the configuration update
async function initializeConfigUpdate() {
    cblcarsLog('info',`In initializeConfigUpdate() isConfigMerged = ${isConfigMerged}`);
    if (!isConfigMerged) {
        cblcarsLog('info',`Will try to update lovelace config with contents of ${templates_url}`);
        await updateLovelaceConfig(templates_url);
    } else {
        cblcarsLog('info','isConfigMerged is true - bypassing merge');
    }
}

async function fetchYAML(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const yamlContent = await response.text();
            cblcarsLog('info',`fetched yaml file ${url}`);
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
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response);
        cblcarsLog('debug', jsObject);
        return jsObject;
    } catch (error) {
        cblcarsLog('error', `Failed to read or parse YAML file: ${error.message}`);
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

            cblcarsLog('warn',"dumping dash strategy after readYamlFile function...");
            cblcarsLog('debug',jsObject);

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
            cblcarsLog('error', `Error loading strategy: ${error.message}`);
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
            cblcarsLog('warn',"dumping airlock strategy after readYamlFile function...");
            cblcarsLog('debug',jsObject);
            
            return {
                ...jsObject
            };
        } catch (error) {
            cblcarsLog('error', `Error loading airlock view: ${error.message}`);
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
            cblcarsLog('warn',"dumping gallery strategy after readYamlFile function...");
            cblcarsLog('debug',jsObject);

            return {
                ...jsObject
            };
        } catch (error) {
            cblcarsLog('error', `Error loading gallery view: ${error.message}`);
            throw error;
        }
    }
}

// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-gallery', CBLCARSViewStrategyGallery);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);



class CBLCARSWrapperCard extends HTMLElement {
    setConfig(config) {
      if (!config || !config.cblcars_card_config) {
        throw new Error("You need to define cblcars_card_config");
      }
  
      // Create a new object to avoid modifying the original config
      const buttonCardConfig = {
        type: 'custom:button-card',
        show_label: true,
        label: 'wrapper',
        ...config.cblcars_card_config,
      };
  
      this._config = { ...config, cblcars_card_config: buttonCardConfig };
  
      if (!this._card) {
        this._card = document.createElement('button-card');
        this.appendChild(this._card);
      }
  
      this._card.setConfig(this._config.cblcars_card_config);
    }
  
    set hass(hass) {
      if (this._card) {
        this._card.hass = hass;
      }
    }
  
    getCardSize() {
      return this._card ? this._card.getCardSize() : 1;
    }

    connectedCallback() {
        cblcarsLog("info","in connectedCallback()");
        initializeConfigUpdate();
    }
}


 
customElements.define('cb-lcars-wrapper-card', CBLCARSWrapperCard);

// Register the card for the GUI editor
window.customCards = window.customCards || [];
window.customCards.push({
type: 'cb-lcars-wrapper-card',
name: 'CB-LCARS Wrapper Card',
description: 'A wrapper card for testing CB-LCARS configuration.',
});

// Call log banner function immediately when the script loads
cblcarsLogBanner();

// Use DOMContentLoaded event to initialize configuration update
document.addEventListener('DOMContentLoaded', initializeConfigUpdate);


/*

look at this later...

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