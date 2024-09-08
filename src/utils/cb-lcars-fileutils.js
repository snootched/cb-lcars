import * as CBLCARS from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';
import jsyaml from 'js-yaml';

export async function fetchYAML(url) {
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
export async function readYamlFile(url) {
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
