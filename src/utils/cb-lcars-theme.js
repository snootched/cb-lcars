import { font_url } from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';

export async function loadFont() {
    try {
      const existingLink = document.querySelector(`link[href="${font_url}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.href = font_url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        cblcarsLog('info', `Loaded CB-LCARS required font from: ${font_url}`);
      } else {
        console.log(`CB-LCARS font already loaded from: ${font_url}`);
      }
    } catch (error) {
        cblcarsLog('error', `Failed to load font from: ${font_url}: ${error.message}`);
    }
  }