// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
//script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
script.type = 'text/javascript'
document.head.appendChild(script);

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


    const url = '/hacsfiles/cb-lcars/cb-lcars-full.yaml';
    
    fetchYAML(url)
        .then(yaml => {
            const jsObject = jsyaml.load(yaml);
            cblcarsLog('info',`fetched and parsed yaml ${url}`);
            cblcarsLog('debug',jsObject);

            // Define the CustomStrategy class
            class CustomStrategy {
                static async generate(config, hass) {
                    const [areas, devices, entities] = await Promise.all([
                        hass.callWS({ type: "config/area_registry/list" }),
                        hass.callWS({ type: "config/device_registry/list" }),
                        hass.callWS({ type: "config/entity_registry/list" }),
                      ]);
                    console.log(areas);
                    console.log(devices);
                    console.log(entities);
                    
                    cblcarsLog('debug areas:',areas);
                    cblcarsLog('debug devices:',devices);
                    cblcarsLog('debug entities:',entities);

                    return {
                        title: 'CB-LCARS',
                        ...jsObject, // Use the parsed YAML content here
                        views: [
                            {
                                title: 'CB-LCARS Airlock',
                                icon: 'mdi:rocket-launch',
                                path: 'cb-lcars-airlock',
                                cards: [
                                    {
                                        type: 'markdown',
                                        content: `CB-LCARS Generated at ${(new Date).toLocaleString()}`
                                    },
                                    {
                                        type: 'custom:button-card',
                                        template: 'cb-lcars-defs',
                                        label: 'CB-LCARS init defaults',
                                        show_label: false
                                    }
                                ]
                            }
                        ]
                    };
                }
            }

            // Define the custom element
            customElements.define('ll-strategy-dashboard-cb-lcars', CustomStrategy);
        })
        .catch(error => console.error(error));
};