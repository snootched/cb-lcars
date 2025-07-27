import { core_fonts, font_url } from '../cb-lcars-vars.js';
import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Process card configurations to load all fonts.
 */
export function loadAllFontsFromConfig(config) {
  const fonts = new Set();
  function scan(obj) {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key === 'font_family' && typeof obj[key] === 'string') {
          fonts.add(obj[key]);
        } else if (typeof obj[key] === 'object') {
          scan(obj[key]);
        }
      }
    }
  }
  scan(config);
  fonts.forEach(font => window.cblcars.loadFont(font));
}

/**
 * Dynamically loads a CB-LCARS font based on font-family name.
 * Only loads if not already injected.
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
      cblcarsLog.info(`[loadFont] Loaded remote font from: ${href}`);
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
    cblcarsLog.info(`[loadFont] Loaded local font: ${fontName}`);
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
    cblcarsLog.error(`[loadCoreFonts] Failed to preload core fonts: ${error.message}`);
  }
}
