import { core_fonts, font_url } from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';



/**
 * Dynamically loads a CB-LCARS font based on font-family name.
 * Only loads if not already injected.
 */
/*
export function loadFont(fontName) {
  const href = `/hacsfiles/cb-lcars/fonts/${fontName}.css`;

  if (window.cblcars._loadedFonts?.has(fontName)) {
    cblcarsLog('debug', `Font already dynamically loaded: ${fontName}`);
    return;
  }

  const existingLink = document.querySelector(`link[href="${href}"]`);
  if (existingLink) {
    cblcarsLog('debug', `Font CSS already linked: ${href}`);
    window.cblcars._loadedFonts?.add(fontName);
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);

  window.cblcars._loadedFonts = window.cblcars._loadedFonts || new Set();
  window.cblcars._loadedFonts.add(fontName);
  cblcarsLog('info', `Dynamically loaded font: ${fontName}`);
}*/


/*
//single font
export function loadFont(fontInput) {
  const isUrl = fontInput.startsWith('http://') || fontInput.startsWith('https://');
  const href = isUrl ? fontInput : `/hacsfiles/cb-lcars/fonts/${fontInput}.css`;
  const fontKey = isUrl ? href : fontInput;

  if (window.cblcars._loadedFonts?.has(fontKey)) {
    cblcarsLog('debug', `Font already loaded: ${fontKey}`);
    return;
  }

  const existingLink = document.querySelector(`link[href="${href}"]`);
  if (existingLink) {
    cblcarsLog('debug', `Font CSS already linked: ${href}`);
    window.cblcars._loadedFonts?.add(fontKey);
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);

  window.cblcars._loadedFonts = window.cblcars._loadedFonts || new Set();
  window.cblcars._loadedFonts.add(fontKey);
  cblcarsLog('info', `Loaded font from: ${href}`);
}
*/


export function loadFont(fontInput) {
  window.cblcars._loadedFonts = window.cblcars._loadedFonts || new Set();

  const fontList = fontInput.split(',').map(f =>
    f.trim().replace(/^['"]|['"]$/g, '')
  );

  fontList.forEach(fontName => {
    // If it’s a URL, inject directly
    if (fontName.startsWith('http://') || fontName.startsWith('https://')) {
      const href = fontName;
      if (window.cblcars._loadedFonts.has(href)) return;
      if (document.querySelector(`link[href="${href}"]`)) {
        window.cblcars._loadedFonts.add(href);
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      window.cblcars._loadedFonts.add(href);
      cblcarsLog('info', `Loaded remote font from: ${href}`);
      return;
    }

    // Else assume local CB-LCARS font
    if (!fontName.startsWith('cb-lcars_')) return;

    const href = `/hacsfiles/cb-lcars/fonts/${fontName}.css`;
    const fontKey = fontName;

    if (window.cblcars._loadedFonts.has(fontKey)) return;
    if (document.querySelector(`link[href="${href}"]`)) {
      window.cblcars._loadedFonts.add(fontKey);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    window.cblcars._loadedFonts.add(fontKey);
    cblcarsLog('info', `Loaded local font: ${fontName}`);
  });
}


/**
 * Loads all core CB-LCARS fonts using the shared dynamic loader.
 */
export async function loadCoreFonts() {
  try {
    const fonts = Array.isArray(core_fonts) ? core_fonts : [core_fonts];
    for (const font of fonts) {
      window.cblcars.loadFont(font);
    }
  } catch (error) {
    cblcarsLog('error', `Failed to preload core fonts: ${error.message}`);
  }
}


/**
 * Loads the CB-LCARS font dynamically.
 * If the font is already loaded, it skips loading it again.
 */
/*
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
*/