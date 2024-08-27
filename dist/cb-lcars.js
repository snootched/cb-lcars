// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
//script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
script.type = 'text/javascript'
document.head.appendChild(script);


const templates_url = '/hacsfiles/cb-lcars/cb-lcars-full.yaml';
const airlock_url = '/hacsfiles/cb-lcars/cb-lcars-airlock.yaml';
const gallery_url = '/hacsfiles/cb-lcars/cb-lcars-gallery.yaml';



script.onload = () => {

    async function cblcarsLog(level, message) {
        let styles = [
            'color: white',
            'padding: 2px 4px',
            'border-radius: 15px'
        ];

        switch (level) {
            case 'info':
                styles.push('background-color: #37a6d1'); // Blue
                console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
                break;
            case 'warn':
                styles.push('background-color: #ff6753'); // Orange
                console.warn(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
                break;
            case 'error':
                styles.push('background-color: #ef1d10'); // Red
                console.error(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
                break;
            case 'debug':
                styles.push('background-color: #8e44ad'); // Purple
                console.debug(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
                break;
            default:
                styles.push('background-color: #6d748c'); // Gray for unknown levels
                console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
                break;
        }
    }
 

    async function fetchYAML(url) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const yamlContent = await response.text();
                return yamlContent;
            } else {
                throw new Error(`Error fetching YAML: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            throw new Error(`Error fetching YAML: ${error.message}`);
        }
    }


    
    fetchYAML(templates_url)
        .then(yaml => {
            const jsObject = jsyaml.load(yaml);
            cblcarsLog('info',`fetched and parsed yaml ${url}`);
            cblcarsLog('debug',jsObject);

            // Define the dashboard class
            class CBLCARSDashboardStrategy {
                static async generate(config, hass) {
                    const [areas, devices, entities] = await Promise.all([
                        hass.callWS({ type: "config/area_registry/list" }),
                        hass.callWS({ type: "config/device_registry/list" }),
                        hass.callWS({ type: "config/entity_registry/list" }),
                      ]);
                    
                    cblcarsLog('debug areas:',areas);
                    cblcarsLog('debug devices:',devices);
                    cblcarsLog('debug entities:',entities);

                    return {
                        title: 'CB-LCARS',
                        ...jsObject, // Use the parsed YAML content here

                        views: [
                            {
                                strategy: {
                                    type: 'custom:cb-lcars-airlock',
                                    options: config
                                }
                            },
                            {
                                strategy: {
                                    type: 'custom:cb-lcars-gallery',
                                    options: config
                                }
                            }
                        ]
            
                    };
                }
            }

            //define airlock view strategy
            class CBLCARSViewStrategyAirlock {
                static async generate(config, hass) {
                    try {
                        const yamlContent = await fetchYAML(airlock_url);
                        const jsObject = jsyaml.load(yamlContent);
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
                        const yamlContent = await fetchYAML(gallery_url);
                        const jsObject = jsyaml.load(yamlContent);
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
        })
        .catch(error => console.error(error));
};