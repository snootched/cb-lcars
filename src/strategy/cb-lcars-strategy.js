// Define the dashboard class

import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { readYamlFile } from '../utils/cb-lcars-fileutils.js';

export class CBLCARSDashboardStrategy {
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

            cblcarsLog('info','Generating CB-LCARS dashboard strategy...');

            // Load the main CB-LCARS button card templates
            //const buttonTemplates = await readYamlFile(CBLCARS.templates_uri);

            // Array of file paths for gallery views
            const galleryPaths = CBLCARS.gallery_views_uris || [];

            // Generate gallery views from the array of file paths
            const galleryViews = await Promise.all(galleryPaths.map(async (filePath) => {
                const fileName = filePath.split('/').pop().split('.')[0];
                return {
                    title: `Gallery-${fileName}`,
                    strategy: {
                        type: 'custom:cb-lcars-view',
                        options: { path: filePath }
                    },
                    subview: true
                };
            }));

            return {

                //'cb-lcars': {
                //    manage_config: true
                //},
                //...buttonTemplates,

                title: 'CB-LCARS',
                views: [
                    {
                        title: 'CB-LCARS Airlock',
                        strategy: {
                            type: 'custom:cb-lcars-airlock',
                            options: config
                        }
                    },
                    ...galleryViews
                ]

            };
        } catch (error) {
            cblcarsLog('error', `Error generating CB-LCARS dashboard strategy: ${error.message}`);
            throw error;
        }
    }
}

//define airlock view strategy
export class CBLCARSViewStrategyAirlock {
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

export class CBLCARSViewStrategy {
    static async generate(config, hass) {
        try {
            const { path } = config;
            cblcarsLog('info',`Generating CB-LCARS strategy view from path: ${path}...`);
            const jsObject = await readYamlFile(path);

            return {
                ...jsObject
            };
        } catch (error) {
            cblcarsLog('error', `Error loading CB-LCARS strategy view: ${error.message}`);
            throw error;
        }
    }
}


// define the strategies in HA
customElements.define('ll-strategy-view-cb-lcars-airlock', CBLCARSViewStrategyAirlock);
customElements.define('ll-strategy-view-cb-lcars-view', CBLCARSViewStrategy);
customElements.define('ll-strategy-dashboard-cb-lcars', CBLCARSDashboardStrategy);
