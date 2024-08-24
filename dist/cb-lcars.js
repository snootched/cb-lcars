// Load js-yaml from CDN.. see if this can be packaged and distributed locally
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
document.head.appendChild(script);

script.onload = () => {
    console.log('js-yaml loaded');

    // Function to fetch the YAML file from GitHub
    async function fetchYAML(url) {
        const response = await fetch(url);
        const text = await response.text();
        return text;
    }

    // Pull the full yaml from the GH repo
    const url = 'https://raw.githubusercontent.com/snootched/cb-lcars/main/cb-lcars-full.yaml';

    fetchYAML(url)
        .then(yaml => {
            const jsObject = jsyaml.load(yaml);
            console.log(jsObject);

            // Define the CustomStrategy class
            class CustomStrategy {
                static async generate(config, hass) {
                    return {
                        title: 'CB-LCARS Dashboard',
                        ...jsObject, // Use the parsed YAML content here
                        views: [
                            {
                                title: 'CB-LCARS Home',
                                path: 'cb-lcars-home',
                                cards: [
                                    {
                                        type: 'markdown',
                                        content: `Generated at ${(new Date).toLocaleString()}`
                                    },
                                    {
                                        type: 'custom:button-card',
                                        template: 'cb-lcars-label',
                                        label: 'dissdashit yo'
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
        .catch(error => console.error('Error fetching YAML:', error));
};
