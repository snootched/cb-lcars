import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsGetGlobalLogLevel, cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
import { preloadSVGs, loadSVGToCache, getSVGFromCache } from './utils/cb-lcars-fileutils.js';
//import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont, loadCoreFonts } from './utils/cb-lcars-theme.js';
import { getLovelace, checkLovelaceTemplates } from './utils/cb-helpers.js';
import { ButtonCard } from "./cblcars-button-card.js"
import { html } from 'lit';
import * as anime from 'animejs';
import * as cblcarsAnimSvg from './utils/cb-lcars-anim-svg.js'; // <-- Add this line

// Ensure global namespace
window.cblcars = window.cblcars || {};

// Expose anime.js
window.cblcars.anime = anime;

// Expose SVG/animation utilities
window.cblcars.animSvg = cblcarsAnimSvg; // <-- Expose all helpers under animSvg

// Placeholder for utility functions (to be implemented)
window.cblcars.animateElement = function(opts) {
  const el = opts.targets;
  if (!el) {
    console.warn('animateElement: No target element provided.');
    return;
  }
  const isColor = opts.property === 'stroke' || opts.property === 'fill';
  if (isColor) {
    anime.animate(el, {
      [opts.property]: opts.values,
      duration: opts.duration,
      direction: opts.direction,
      loop: opts.loop,
      easing: opts.easing
    });
  } else {
    anime.animate(el, {
      [opts.property]: opts.values,
      duration: opts.duration,
      direction: opts.direction,
      loop: opts.loop,
      easing: opts.easing
    });
  }
};

// Promises for loading the templates and stub configuration
let templatesPromise;
let stubConfigPromise;
let themeColorsPromise;

// Load the templates from our yaml file
let templates = {};
let stubConfig = {};

// Ensure the cblcars object exists on the window object
window.cblcars = window.cblcars || {};
window.cblcars.loadFont = loadFont;

// Utility for lazy loading user SVGs (e.g., from /local/)
window.cblcars = window.cblcars || {};
window.cblcars.loadUserSVG = async function(key, url) {
    return await loadSVGToCache(key, url);
};
window.cblcars.getSVGFromCache = getSVGFromCache;


async function initializeCustomCard() {

    // Call log banner function immediately when the script loads
    cblcarsLogBanner();

    ///load yaml configs
    templatesPromise = loadTemplates(CBLCARS.templates_uri);
    stubConfigPromise = loadStubConfig(CBLCARS.stub_config_uri);
    themeColorsPromise = loadThemeColors(CBLCARS.theme_colors_uri);

    // Preload built-in SVGs for the MSD card
    preloadSVGs(CBLCARS.builtin_svg_keys, CBLCARS.builtin_svg_basepath)
        .catch(error => cblcarsLog('error', 'Error preloading built-in SVGs:', error));

    // Import and wait for 3rd party card dependencies
    const cardImports = [
        customElements.whenDefined('cblcars-button-card'),
        customElements.whenDefined('my-slider-v2')
    ];
    await Promise.all(cardImports);

    loadCoreFonts();

    // Checks that custom element dependencies are defined for use in the cards
    if (!customElements.get('cblcars-button-card')) {
        cblcarsLog('error',`Custom Button Card for LCARS [cblcars-button-card] was not found!`);
    }
    if (!customElements.get('my-slider-v2')) {
        cblcarsLog('error',`'My Cards' MySliderV2 Custom Card [my-slider-v2] was not found!`);
    }
}


// Initialize the custom card
initializeCustomCard().catch(error => {
    cblcarsLog('error','Error initializing custom card:', error);
});



async function loadTemplates(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);

        // Store the YAML content in window.cblcars_card_templates
        window.cblcars_card_templates = yamlContent.cblcars_card_templates;

        // Merge the cblcars stanza with the existing window.cblcars object
        if (yamlContent.cblcars) {
            window.cblcars = {
                ...window.cblcars,
                ...yamlContent.cblcars
            };
        }

        templates = yamlContent || {};
        cblcarsLog('debug', `CB-LCARS dashboard templates loaded from source file [${filePath}]`, templates);
    } catch (error) {
        cblcarsLog('error', 'Failed to get the CB-LCARS lovelace templates from source file.', error);
    }
}

async function loadThemeColors(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);

        // Merge the cblcars stanza with the existing window.cblcars object
        if (yamlContent.cblcars) {
            window.cblcars = {
                ...window.cblcars,
                ...yamlContent.cblcars
            };
        }
        cblcarsLog('info', `CB-LCARS theme colors loaded from source file [${filePath}]`, yamlContent);
        setThemeColors(window.cblcars.themes, 'green');
    } catch (error) {
        cblcarsLog('error', 'Failed to get the CB-LCARS theme colors from source file.', error);
    }
}

function setThemeColors(themes, alertCondition = 'green', clobber = false) {
    const selectedTheme = themes[`${alertCondition}_alert`];
    if (!selectedTheme) {
        cblcarsLog('error', `Theme for alert condition ${alertCondition} is not defined.`, '', cblcarsGetGlobalLogLevel());
        return;
    }

    const colors = selectedTheme.colors;

    for (const [colorGroup, colorValues] of Object.entries(colors)) {
        for (const [colorName, colorValue] of Object.entries(colorValues)) {
            const cssVarName = `--${colorName}`;
            const existingValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();

            if (clobber || !existingValue) {
                cblcarsLog('warn', `Color undefined or overridden - Setting ${cssVarName}=${colorValue}`, '', cblcarsGetGlobalLogLevel());
                document.documentElement.style.setProperty(cssVarName, colorValue);
            } else {
                cblcarsLog('debug', `Skipping ${cssVarName} as it is already defined with value ${existingValue}`, '', cblcarsGetGlobalLogLevel());
            }
        }
    }
}
function setAlertCondition(alertCondition) {
    setThemeColors(window.cblcars.themes, alertCondition,true);
}
window.cblcars.setAlertCondition = setAlertCondition;

// Load the stub configuration from our yaml file
async function loadStubConfig(filePath) {
    try {
        const yamlContent = await readYamlFile(filePath);
        stubConfig = yamlContent || {};
        cblcarsLog('debug',`CB-LCARS stub configuration loaded from source file [${CBLCARS.stub_config_uri}]`,stubConfig);
    } catch (error) {
        cblcarsLog('error','Failed to get the CB-LCARS stub configuration from source file.',error);
    }
}



class CBLCARSBaseCard extends ButtonCard {

    _isResizeObserverEnabled = false;
    _resizeObserver;
    _logLevel = cblcarsGetGlobalLogLevel();
    _resizeObserverTarget = 'this';
    _lastWidth = 0;
    _lastHeight = 0;
    _resizeObserverTolerance = 16; // Default tolerance for resize observer.  16 settles infinite resize in preview mode.
    _debounceWait = 100; // Default debounce wait time in milliseconds
    _isUsingLovelaceTemplate = false;
    _overrideTemplates = [];


    constructor () {
        super();
        this._resizeObserverTolerance = window.cblcars.resizeObserverTolerance || this._resizeObserverTolerance;
        this._debounceWait = window.cblcars.debounceWait || this._debounceWait;
        this._resizeObserver = new ResizeObserver(() => {
            cblcarsLog('debug','Resize observer fired', this, this._logLevel);
            this._debouncedResizeHandler();
        });
        this._debouncedResizeHandler = this._debounce(() => this._updateCardSize(), this._debounceWait);
    }


    setConfig(config) {
        if (!config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
        }


        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];


        // Set the _logLevel property from the config
        this._logLevel = config.cblcars_log_level || cblcarsGetGlobalLogLevel();

        // Create a new object to avoid modifying the original config
        this._config = {
            ...config,
            template: mergedTemplates,
        };


        // Check if the card is using a template from the dashboard's yaml.
        // this will override the card's configuration
        // this could be on purpose for testing/customization - but more likely holdovers from the original version that used that method
        const { isUsingLovelaceTemplate, overriddenTemplates } = checkLovelaceTemplates(this._config);
        this._isUsingLovelaceTemplate = isUsingLovelaceTemplate;
        this._overrideTemplates = overriddenTemplates;

        // Log a warning if the card is using a template from the dashboard's yaml
        // add the card to a list of tainted cards
        if(isUsingLovelaceTemplate) {
            cblcarsLog('warn',`Card configuration templates are being overridden with local dashboard YAML configuration.  Templates: ${overriddenTemplates.join(', ')}`, this, this._logLevel);
            window.cblcars.taintedCards = window.cblcars.taintedCards || [];
            window.cblcars.taintedCards.push({card: this, templates: overriddenTemplates});
        }


        // Set up the resizeObserver properties
        this._resizeObserverTarget = config.resize_observer_target || 'this';
        this._isResizeObserverEnabled = (config.enable_resize_observer || (config.variables && config.variables.enable_resize_observer)) || false;
        this._resizeObserverTolerance = config.resize_observer_tolerance || this._resizeObserverTolerance;
        this._debounceWait = config.debounce_wait || this._debounceWait;
        // Enable the resize observer if any merged template contains the word 'animation'
        // this allows us to enable the observer for added animation templates without needed to explicity add it to the config
        if (mergedTemplates.some(template => template.includes('animation') || template.includes('symbiont'))) {
            this._isResizeObserverEnabled = true;
        }

        // Enable the resize observer if the configuration option is enabled
        if (this._isResizeObserverEnabled) {
            this.enableResizeObserver();
        }

        super.setConfig(this._config);
        cblcarsLog('debug',`${this.constructor.name}.setConfig() called with:`, this._config, this._logLevel);
    }

    static get editorType() {
        return 'cb-lcars-base-card-editor';
    }
    static get cardType() {
        return 'cb-lcars-base-card';
    }

    static get defaultConfig() {
        return {
            label: "CB-LCARS Base Card",
            show_label: true
        };
    }

    static getConfigElement() {

        const editorType = this.editorType;

        try {
            if (!customElements.get(editorType)) {
                cblcarsLog('error',`${this.constructor.name}.getConfigElement() Graphical editor element [${editorType}] is not defined defined in Home Assistant!`,null ,this._logLevel);
                return null;
            }
            const element = document.createElement(editorType);
            //console.log('Element created:', element);
            return element;
        } catch (error) {
            cblcarsLog('error',`${this.constructor.name}.getConfigElement() Error creating element ${editorType}: `,error, this._logLevel);
            return null;
        }
    }

    static getStubConfig() {
        const cardType = this.cardType;
        if (stubConfig[cardType]) {
            return stubConfig[cardType];
        } else {
            return this.defaultConfig;
        }
    }

    getCardSize() {
        //return this._card ? this._card.getCardSize() : 4;
        super.getCardSize();
    }

    getLayoutOptions() {
        return {
          grid_rows: 1,
          grid_columns: 4
        };
      }

    connectedCallback() {
        super.connectedCallback();

        // Check if the parent element has the class 'preview'
        if (this.parentElement && this.parentElement.classList.contains('preview')) {
            this.style.height = '60px';
            this.style.minHeight = '60px';
        } else {
            this.style.height = '100%';

            // Enable the resize observer when the card is connected to the DOM
            // but only if not in preview mode
            if (this._isResizeObserverEnabled) {
                this.enableResizeObserver();
                window.addEventListener('resize', this._debouncedResizeHandler);
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.disableResizeObserver();
        window.removeEventListener('resize', this._debouncedResizeHandler)
    }

    _updateCardSize() {

        //cblcarsLog('debug',`this.offset* dimensions: ${this.offsetWidth} x ${this.offsetHeight}`, this, this._logLevel);
        //cblcarsLog('debug',`this.offsetParent.offset* dimensions: ${this.offsetParent.offsetWidth} x ${this.offsetParent.offsetHeight}`, this, this._logLevel);
        //cblcarsLog('debug',`this.parentElement.offset* dimensions: ${this.parentElement.offsetWidth} x ${this.parentElement.offsetHeight}`, this, this._logLevel);

        const parentWidth = this.parentElement.offsetWidth;
        const parentHeight = this.parentElement.offsetHeight;
        cblcarsLog('debug',`Going with dimensions: ${parentWidth} x ${parentHeight}`, this, this._logLevel);

        const significantChange = this._resizeObserverTolerance;
        // Only update if there is a significant change
        if (parentWidth > 0 && parentHeight > 0 && (Math.abs(parentWidth - this._lastWidth) > significantChange || Math.abs(parentHeight - this._lastHeight) > significantChange)) {
            //if (Math.abs(parentWidth - this._lastWidth) > significantChange || Math.abs(parentHeight - this._lastHeight) > significantChange) {
            this._lastWidth = parentWidth;
            this._lastHeight = parentHeight;

            // Set CSS variables for the child card's dimensions
            this.style.setProperty('--button-card-width', `${parentWidth}px`);
            this.style.setProperty('--button-card-height', `${parentHeight}px`);

            if (!this._config) {
                cblcarsLog('debug','Config is not defined. Skipping resize handling.', this, this._logLevel);
                return;
            }

            // Store the dimensions in the card's config
            if (!this._config.variables) {
                this._config.variables = { card: {} };
            }
            this._config.variables.card.width = `${parentWidth}px`;
            this._config.variables.card.height = `${parentHeight}px`;

            // Trigger an update if necessary
            this.setConfig(this._config);
        }
    }

    _updateResizeObserver() {
        if (this._isResizeObserverEnabled) {
            this.enableResizeObserver();
        } else {
            this.disableResizeObserver();
        }
    }

    enableResizeObserver() {
        const targetElement = this.resolveTargetElement(this._resizeObserverTarget);

        if (targetElement && this.isConnected) {
            this._resizeObserver.observe(targetElement);
            cblcarsLog('debug',`${this.constructor.name}.enableResizeObserver() Resize observer enabled on [${this._resizeObserverTarget}]`, this, this._logLevel);
        }
    }

    disableResizeObserver() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        cblcarsLog('debug',`${this.constructor.name}.disableResizeObserver() Resize observer disabled`, this._logLevel);
    }

    toggleResizeObserver() {
        this._isResizeObserverEnabled = !this._isResizeObserverEnabled;
        this._updateResizeObserver();
    }

    resolveTargetElement(target) {
        const targetMapping = {
            'this': () => this,
            'this.parentElement': () => this.parentElement,
            'this.offsetParent': () => this.offsetParent,
            // Add more mappings as needed
        };

        return targetMapping[target] ? targetMapping[target]() : this;
    }
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}

class CBLCARSLabelCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-label-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-label-card';
    }

    static get defaultConfig() {
        return {
            label: "CB-LCARS Label",
            show_label: true
        };
    }

    setConfig(config) {
        const defaultCardType = 'cb-lcars-label';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };

        super.setConfig(specialConfig);
    }
}

class CBLCARSElbowCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-elbow-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-elbow-card';
    }

    static get defaultConfig() {
        return {
            variables: {
                card: {
                    border: {
                        left: { size: 90 },
                        top: { size: 20 }
                    }
                }
            }
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-header';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}


class CBLCARSMSDCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-msd-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-msd-card';
    }

    static get defaultConfig() {
        return {
            enable_resize_observer: true,
            variables: {
                card: {
                    border: {
                        left: { size: 0 },
                        right: { size: 0 },
                        top: { size: 0 },
                        bottom: { size: 0 }
                    }
                }
            }
        };
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-msd'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);

        // --- SVG Lazy Loading Logic ---
        const msdVars = specialConfig.variables && specialConfig.variables.msd;
        if (msdVars && msdVars.base_svg) {
            let svgKey = null, svgUrl = null;
            if (msdVars.base_svg.startsWith('builtin:')) {
                svgKey = msdVars.base_svg.replace('builtin:', '');
                // Preloaded, nothing to do
            } else if (msdVars.base_svg.startsWith('/local/')) {
                // User SVG: derive key from filename
                svgKey = msdVars.base_svg.split('/').pop().replace('.svg','');
                svgUrl = msdVars.base_svg;
                // Lazy load if not cached (fire-and-forget, do not await)
                if (!window.cblcars.getSVGFromCache(svgKey)) {
                    window.cblcars.loadUserSVG(svgKey, svgUrl)
                        .then(() => this.requestUpdate && this.requestUpdate())
                        .catch(() => {}); // Error already logged
                }
            }
            // Optionally, store svgKey for use in render/template
            this._svgKey = svgKey;
        }
    }

    getLayoutOptions() {
        return {
            grid_rows: 4,
            grid_columns: 4
        };
      }
}

class CBLCARSDoubleElbowCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-double-elbow-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-double-elbow-card';
    }

    static get defaultConfig() {
        return {
            };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-header-picard';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }
}

class CBLCARSMultimeterCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-multimeter-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-multimeter-card';
    }

    static get defaultConfig() {
        return {
            variables: {
                _mode: 'gauge'
            }
        };
    }

    constructor() {
        super();
        this._enableResizeObserver = true;
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-multimeter'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 1,
            grid_columns: 4
        };
      }

    render() {
        if (!customElements.get('my-slider-v2')) {
            return html`<ha-alert alert-type="error" title="CB-LCARS - Dependency Error">Required 'my-slider-v2' card is not available - Please refer to the documentation.</ha-alert>`;
        }

        // Render the card normally
        return super.render();
    }
}

class CBLCARSDPADCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-dpad-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-dpad-card';
    }

    static get defaultConfig() {
        return {};
    }

    setConfig(config) {

        const defaultTemplates = ['cb-lcars-dpad'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);
    }

    getLayoutOptions() {
        return {
            grid_rows: 4,
            grid_columns: 2
        };
      }
}

class CBLCARSButtonCard extends CBLCARSBaseCard {
    static get editorType() {
        return 'cb-lcars-button-card-editor';
    }

    static get cardType() {
        return 'cb-lcars-button-card';
    }

    static get defaultConfig() {
        return {
            label: "CB-LCARS Button",
            show_label: true
        };
    }

    setConfig(config) {

        const defaultCardType = 'cb-lcars-button-lozenge';
        const defaultTemplates = [config.cblcars_card_type ? config.cblcars_card_type : defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = {
            ...config,
            template: mergedTemplates,
        };
        super.setConfig(specialConfig);

    }

    getLayoutOptions() {
        return {
            grid_min_rows: 1,
            grid_rows: 1,
            grid_columns: 2,
            grid_min_columns: 1
        };
      }
}



// Helper function to define custom elements and their editors
function defineCustomElement(cardType, cardClass, editorType, editorClass) {
    customElements.define(cardType, cardClass);
    customElements.define(editorType, class extends editorClass {
        constructor() {
            super(cardType);
        }
    });
}


// delay registration of custom elements until the templates and stub configuration are loaded
Promise.all([templatesPromise, , stubConfigPromise, themeColorsPromise])
  .then(() => {
    defineCustomElement('cb-lcars-base-card', CBLCARSBaseCard, 'cb-lcars-base-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-label-card', CBLCARSLabelCard, 'cb-lcars-label-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-elbow-card', CBLCARSElbowCard, 'cb-lcars-elbow-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-double-elbow-card', CBLCARSDoubleElbowCard, 'cb-lcars-double-elbow-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-multimeter-card', CBLCARSMultimeterCard, 'cb-lcars-multimeter-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-dpad-card', CBLCARSDPADCard, 'cb-lcars-dpad-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-button-card', CBLCARSButtonCard, 'cb-lcars-button-card-editor', CBLCARSCardEditor);
    defineCustomElement('cb-lcars-msd-card', CBLCARSMSDCard, 'cb-lcars-msd-card-editor', CBLCARSCardEditor);
  })
  .catch(error => {
    cblcarsLog('error', 'Error loading YAML configuration:', error);
  });



// Register the cards to be available in the GUI editor
window.customCards = window.customCards || [];
const CBLCARSCardClasses = [
    {
        type: 'cb-lcars-base-card',
        name: 'CB-LCARS Base Card',
        description: 'For advanced use: the CB-LCARS base card for full manual configuration.',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-label-card',
        name: 'CB-LCARS Label',
        preview: true,
        description: 'CB-LCARS label card for text.',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-elbow-card',
        name: 'CB-LCARS Elbow',
        preview: true,
        description: 'CB-LCARS Elbow card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-double-elbow-card',
        name: 'CB-LCARS Double Elbow',
        preview: true,
        description: 'CB-LCARS Double Elbow card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-multimeter-card',
        name: 'CB-LCARS Multimeter',
        preview: true,
        description: 'CB-LCARS Multimeter card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-dpad-card',
        name: 'CB-LCARS D-Pad',
        preview: true,
        description: 'CB-LCARS D-Pad card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-button-card',
        name: 'CB-LCARS Button',
        preview: true,
        description: 'CB-LCARS Buttons [various styles]',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    },
    {
        type: 'cb-lcars-msd-card',
        name: 'CB-LCARS MSD',
        preview: true,
        description: 'CB-LCARS Master Systems Display (MSD) card',
        documentationURL: "https://cb-lcars.unimatrix01.ca",
    }
];

window.customCards.push(...CBLCARSCardClasses);