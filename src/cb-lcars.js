import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsGetGlobalLogLevel, cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
//import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont } from './utils/cb-lcars-theme.js';

import { ButtonCard } from "./cblcars-button-card.js"
import { html } from 'lit';

// Promises for loading the templates and stub configuration
let templatesPromise;
let stubConfigPromise;
let themeColorsPromise;

// Load the templates from our yaml file
let templates = {};
let stubConfig = {};

// Ensure the cblcars object exists on the window object
window.cblcars = window.cblcars || {};



async function initializeCustomCard() {

    // Call log banner function immediately when the script loads
    cblcarsLogBanner();

    ///load yaml configs
    templatesPromise = loadTemplates(CBLCARS.templates_uri);
    stubConfigPromise = loadStubConfig(CBLCARS.stub_config_uri);
    themeColorsPromise = loadThemeColors(CBLCARS.theme_colors_uri);

    // Import and wait for 3rd party card dependencies
    const cardImports = [
        customElements.whenDefined('cblcars-button-card'),
        customElements.whenDefined('my-slider-v2')
    ];
    await Promise.all(cardImports);

    loadFont();

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

export function getLovelace() {
    let root = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver');
    root = (root && root.shadowRoot) || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    if (root) {
      const ll = root.lovelace;
      ll.current_view = root.___curView;
      return ll;
    }
    return null;
  }


class CBLCARSBaseCard extends ButtonCard {

    _isResizeObserverEnabled = false;
    _resizeObserver;
    _logLevel = cblcarsGetGlobalLogLevel();
    _resizeObserverTarget = 'this';
    _lastWidth = 0;
    _lastHeight = 0;
    _resizeObserverTolerance = 10;
    _isUsingLoveLaceTemplate = false;


    constructor () {
        super();
        this._resizeObserverTolerance = window.cblcars.resizeObserverTolerance || 10;
        this._resizeObserver = new ResizeObserver(() => {
            cblcarsLog('debug','Resize observer fired', this, this._logLevel);
            this._debouncedResizeHandler();
        });
        this._debouncedResizeHandler = this._debounce(() => this._updateCardSize(), 50);
    }


    setConfig(config) {
        if (!config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
        }

        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Create a new object to avoid modifying the original config
        this._config = {
            ...config,
            template: mergedTemplates,
        };

        // Set the _logLevel property from the config
        this._logLevel = config.cblcars_log_level || cblcarsGetGlobalLogLevel();

        // Set the _resizeObserverTarget property from the config
        this._resizeObserverTarget = config.resize_observer_target || 'this';
        // Set the _enableResizeObserver property from the config
        this._isResizeObserverEnabled = config.enable_resize_observer || false;
        // Set the _resizeObserverTolerance property from the config
        this._resizeObserverTolerance = config.resize_observer_tolerance || 10;

        // Enable the resize observer if the configuration option is enabled
        if (this._isResizeObserverEnabled) {
            this.enableResizeObserver();
        }


        // Check if the template exists in Lovelace configuration
        const ll = getLovelace();
        const lovelaceTemplates = ll && ll.config && ll.config.cblcars_card_templates ? ll.config.cblcars_card_templates : {};
        let isUsingLovelaceTemplate = false;
        let overriddenTemplates = [];

        for (const template of mergedTemplates) {
            if (lovelaceTemplates.hasOwnProperty(template)) {
                isUsingLovelaceTemplate = true;
                overriddenTemplates.push(template);
            }
        }
        // Remove duplicates and sort the array
        overriddenTemplates = [...new Set(overriddenTemplates)].sort();

        // Set the flag indicating if using Lovelace template
        this._isUsingLovelaceTemplate = isUsingLovelaceTemplate;

        if(isUsingLovelaceTemplate) {
            cblcarsLog('debug',`Using override template(s) from Lovelace dashboard yaml: ${overriddenTemplates.join(', ')}`, this, this._logLevel);
            // Add the flag to the card configuration - used by editors to display a warning
            this._config.isUsingLovelaceTemplate = isUsingLovelaceTemplate;
            this._config.overriddenTemplates = overriddenTemplates;
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
        cblcarsLog('debug',`${this.constructor.name}.disableResizeObserver() Resize observer disabled`, this, this._logLevel);
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

        // Check if the card type is 'cb-lcars-cascade' and set the enable_resize_observer flag to true
        if (config.cblcars_card_type === 'cb-lcars-cascade' && config.enable_resize_observer === undefined) {
            specialConfig.enable_resize_observer = true;
        }

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
    }
];

window.customCards.push(...CBLCARSCardClasses);