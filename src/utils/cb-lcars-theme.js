import * as CBLCARS from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';

export async function loadFont() {
    try {
      const existingLink = document.querySelector(`link[href="${CBLCARS.font_url}"]`);
      if (!existingLink) {
        const link = document.createElement('link'); 
        link.href = CBLCARS.font_url; 
        link.rel = 'stylesheet'; 
        document.head.appendChild(link);
        cblcarsLog('info', `Loaded CB-LCARS required font from: ${CBLCARS.font_url}`);
      } else {
        console.log(`CB-LCARS font already loaded from: ${CBLCARS.font_url}`);
      }
    } catch (error) {
        cblcarsLog('error', `Failed to load font from: ${CBLCARS.font_url}: ${error.message}`);
    }
  }