// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
//script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
script.src = '/hacsfiles/cb-lcars/js-yaml.min.js';
script.type = 'text/javascript'
document.head.appendChild(script);

script.onload = () => {


    let styles = [
        'color: white',
        'padding: 2px 4px',
        'border-radius: 15px',
        'background-color: #37a6d1'
    ];

    console.log(`%c    CB-LCARS | info `, styles.join(';'), 'js-yaml.min loaded');

    // Read the YAML file directly from the local path
    const yamlFilePath = '/hacsfiles/cb-lcars/cb-lcars-full.yaml';
    try {
        const response = await fetch(yamlFilePath);
        if (response.ok) {
            const yamlContent = await response.text();
            const jsObject = jsyaml.load(yamlContent);
            console.log(jsObject);

            // Define the CustomStrategy class
            class CustomStrategy {
                static async generate(config, hass) {
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
        } else {
            console.error('Error fetching YAML:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error fetching YAML:', error);
    }
};
