//import * as CBLCARS from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';
import jsyaml from 'js-yaml';

// Ensure global fallback for legacy callers expecting window.jsyaml
try {
  if (typeof window !== 'undefined' && !window.jsyaml) {
    window.jsyaml = { load: jsyaml.load, dump: jsyaml.dump };
  }
} catch {}

/**
 * Fetch YAML content from a given URL.
 * @param {string} url - The URL of the YAML file.
 * @returns {Promise<string>} - A promise that resolves to the YAML content as a string.
 */
export async function fetchYAML(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const yamlContent = await response.text();
            //cblcarsLog.debug(`Fetched yaml file ${url}`);

            return yamlContent;
        } //else {
          //  throw new Error(`Error fetching YAML: ${response.status} ${response.statusText}`);
        //}
    } catch (error) {
        cblcarsLog.error('[fetchYAML] Error fetching YAML file ',error);
        throw error;
    }
}

// Function to read and parse the YAML file
export async function readYamlFile(url) {
    try {
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response);
        //await cblcarsLog.info(`Processed YAML file: ${url}`);
        //await cblcarsLog.debug(jsObject);
        return jsObject;
    } catch (error) {
        cblcarsLog.error('[readYamlFile] Failed to parse YAML file',error.message);
        throw error; // Re-throw the error after logging it
    }
}

/**
 * Ensure the SVG cache exists on the window object.
 */
function ensureSVGCache() {
    window.cblcars = window.cblcars || {};
    window.cblcars.msd = window.cblcars.msd || {};
    window.cblcars.msd.svg_templates = window.cblcars.msd.svg_templates || {};
    return window.cblcars.msd.svg_templates;
}

/**
 * Load an SVG from a URL and cache it under the given key.
 * Returns a promise that resolves to the SVG string.
 */
export async function loadSVGToCache(key, url) {
    const cache = ensureSVGCache();
    if (cache[key]) {
        // Already cached
        return cache[key];
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            cblcarsLog.error(`[loadSVGToCache] Failed to fetch SVG [${url}] for key [${key}]: ${response.status} ${response.statusText}`);
            return undefined;
        }
        let svgText = await response.text();

        // Find the opening <svg> tag and its attributes.
        svgText = svgText.replace(/<svg([^>]*)>/i, (match, attributes) => {
            // Remove existing width and height attributes.
            let newAttributes = attributes.replace(/\s(width|height)=["'][^"']*["']/gi, '');
            // Add width="100%" and height="100%".
            return `<svg width="100%" height="100%"${newAttributes}>`;
        });

        cache[key] = svgText;
        cblcarsLog.debug(`[loadSVGToCache] Loaded SVG [${key}] from [${url}]`);
        return svgText;
    } catch (error) {
        cblcarsLog.error(`[loadSVGToCache] Error loading SVG [${key}] from [${url}]`, error);
        return undefined;
    }
}

/**
 * Get an SVG from the cache by key.
 */
export function getSVGFromCache(key) {
    const cache = ensureSVGCache();
    return cache[key];
}

/**
 * Preload a list of SVGs from a base path.
 * svgList: array of keys (filenames without .svg)
 * basePath: path to prepend (should end with /)
 * Returns a promise that resolves when all SVGs are loaded.
 */
export async function preloadSVGs(svgList, basePath) {
    const promises = svgList.map(key => {
        const url = `${basePath}${key}.svg`;
        return loadSVGToCache(key, url);
    });
    await Promise.all(promises);
    cblcarsLog.info(`[preloadSVGs] Preloaded SVGs: ${svgList.join(', ')} from ${basePath}`);
}
