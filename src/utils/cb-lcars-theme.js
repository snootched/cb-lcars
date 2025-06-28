import { font_url } from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Loads the CB-LCARS font dynamically.
 * If the font is already loaded, it skips loading it again.
 */
export async function loadFont() {
  try {
    const urls = Array.isArray(font_url) ? font_url : [font_url];
    for (const url of urls) {
      const existingLink = document.querySelector(`link[href="${url}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.href = url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        cblcarsLog('info', `Loaded CB-LCARS required font from: ${url}`);
      } else {
        cblcarsLog('info',`CB-LCARS font already loaded from: ${url}`);
      }
    }
  } catch (error) {
      cblcarsLog('error', `Failed to load font(s) from: ${font_url}: ${error.message}`);
  }
}