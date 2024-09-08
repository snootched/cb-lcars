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
//define gallery view strategy
export class CBLCARSViewStrategyGallery {
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
