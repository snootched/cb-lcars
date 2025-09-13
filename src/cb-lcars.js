import * as anime from 'animejs';

import * as CBLCARS from './cb-lcars-vars.js'
import { cblcarsSetGlobalLogLevel, cblcarsGetGlobalLogLevel, cblcarsLog, cblcarsLogBanner} from './utils/cb-lcars-logging.js';
import { readYamlFile } from './utils/cb-lcars-fileutils.js';
import { preloadSVGs, loadSVGToCache, getSVGFromCache } from './utils/cb-lcars-fileutils.js';
//import { CBLCARSDashboardStrategy, CBLCARSViewStrategy, CBLCARSViewStrategyAirlock } from './strategy/cb-lcars-strategy.js';
import { CBLCARSCardEditor } from './editor/cb-lcars-editor.js';
import { loadFont, loadCoreFonts, loadAllFontsFromConfig } from './utils/cb-lcars-theme.js';
import { getLovelace, checkLovelaceTemplates } from './utils/cb-helpers.js';
import { ButtonCard } from "./cblcars-button-card.js"
import { html } from 'lit';

import * as animHelpers from './utils/cb-lcars-anim-helpers.js';
import { animPresets } from './utils/cb-lcars-anim-presets.js';
import * as svgHelpers from './utils/cb-lcars-svg-helpers.js';
import * as anchorHelpers from './utils/cb-lcars-anchor-helpers.js';



// CHANGED: Side-effect import that initializes the MSD v1 pipeline
import './msd/index.js';


// Ensure global namespace
window.cblcars = window.cblcars || {};

// Promises for loading the templates and stub configuration
let templatesPromise;
let stubConfigPromise;
let themeColorsPromise;

// Load the templates from our yaml file
let templates = {};
let stubConfig = {};

// Ensure the cblcars object exists on the window object
//window.cblcars = window.cblcars || {};
window.cblcars.loadFont = loadFont;


// DEBUGGING: Add immediate global debugging when CB-LCARS loads
console.log('[CB-LCARS] File loaded, setting up debugging');

// Create a global debugging function to manually trigger updates
window.cbLcarsDebugForceUpdate = function() {
    console.log('[CB-LCARS Debug] Manually triggering updates');

    // Strategy 1: Find all CB-LCARS cards in the main document
    const mainDocCards = document.querySelectorAll('cb-lcars-button-card');
    console.log(`[CB-LCARS Debug] Found ${mainDocCards.length} CB-LCARS cards in main document`);

    // Strategy 2: Find cards in shadow roots by searching all shadow hosts
    const shadowCards = [];
    function findInShadowRoots(root = document) {
        const allElements = root.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) {
                // Search inside this shadow root
                const cardsInShadow = el.shadowRoot.querySelectorAll('cb-lcars-button-card, hui-button-card, [data-card-type*="cb-lcars"]');
                cardsInShadow.forEach(card => shadowCards.push(card));

                // Recursively search nested shadow roots
                findInShadowRoots(el.shadowRoot);
            }
        });
    }

    findInShadowRoots();
    console.log(`[CB-LCARS Debug] Found ${shadowCards.length} cards in shadow roots`);

    // Strategy 3: Access MSD-managed cards directly
    let msdCards = [];
    if (window._msdControlsRenderer) {
        const controlsRenderer = window._msdControlsRenderer;
        console.log(`[CB-LCARS Debug] Found MSD controls renderer with ${controlsRenderer.controlElements.size} managed cards`);

        for (const [id, wrapper] of controlsRenderer.controlElements) {
            const card = wrapper.querySelector('cb-lcars-button-card, hui-button-card, [data-card-type*="cb-lcars"]') || wrapper.firstElementChild;
            if (card) {
                msdCards.push({ id, card, wrapper });
            }
        }
        console.log(`[CB-LCARS Debug] Found ${msdCards.length} MSD-managed cards`);
    } else {
        console.log('[CB-LCARS Debug] No MSD controls renderer found');
    }

    // Combine all found cards but avoid duplicates
    const cardSet = new Set();
    const allCardInfo = [];

    // Add main document cards
    mainDocCards.forEach(card => {
        if (!cardSet.has(card)) {
            cardSet.add(card);
            allCardInfo.push({ card, source: 'main-document', msdInfo: null });
        }
    });

    // Add shadow root cards
    shadowCards.forEach(card => {
        if (!cardSet.has(card)) {
            cardSet.add(card);
            allCardInfo.push({ card, source: 'shadow-root', msdInfo: null });
        }
    });

    // Add MSD-managed cards (but check for duplicates)
    msdCards.forEach(msdInfo => {
        if (!cardSet.has(msdInfo.card)) {
            cardSet.add(msdInfo.card);
            allCardInfo.push({ card: msdInfo.card, source: 'msd-managed', msdInfo });
        } else {
            // This card was already found, just update its MSD info
            const existing = allCardInfo.find(info => info.card === msdInfo.card);
            if (existing) {
                existing.msdInfo = msdInfo;
                existing.source += '+msd-managed';
            }
        }
    });

    console.log(`[CB-LCARS Debug] Total unique cards found: ${allCardInfo.length}`);

    allCardInfo.forEach((cardInfo, index) => {
        const { card, source, msdInfo } = cardInfo;
        console.log(`[CB-LCARS Debug] Card ${index}:`, {
            tagName: card.tagName,
            hasHass: !!card.hass,
            hasConfig: !!card._config,
            entity: card._config?.entity || card.entity,
            msdId: msdInfo?.id,
            source: source
        });

        // Try to get HASS from multiple sources
        const hass = card.hass || card._hass || window.hass || window._msdControlsRenderer?.hass;
        if (hass && card.setHass) {
            console.log(`[CB-LCARS Debug] Forcing setHass on card ${index}`);
            card.setHass(hass);
        }

        // Try to manually trigger update
        if (card.requestUpdate) {
            console.log(`[CB-LCARS Debug] Forcing requestUpdate on card ${index}`);
            card.requestUpdate();
        }

        // For MSD-managed cards, also try the MSD update mechanism
        if (msdInfo && window._msdControlsRenderer) {
            console.log(`[CB-LCARS Debug] Forcing MSD update on card ${msdInfo.id}`);
            try {
                window._msdControlsRenderer._applyHassToCard(card, hass, msdInfo.id);
            } catch (e) {
                console.warn(`[CB-LCARS Debug] MSD update failed for ${msdInfo.id}:`, e);
            }
        }

        // ADDED: Try the new forceStateUpdate method for CB-LCARS cards
        if (card.tagName && card.tagName.toLowerCase().includes('cb-lcars') && typeof card.forceStateUpdate === 'function') {
            console.log(`[CB-LCARS Debug] Forcing state update on CB-LCARS card ${index}`);
            try {
                card.forceStateUpdate();
            } catch (e) {
                console.warn(`[CB-LCARS Debug] forceStateUpdate failed for card ${index}:`, e);
            }
        }
    });

    // Also log current HASS state for the entities we care about
    const mainHass = window.hass;
    const msdHass = window._msdControlsRenderer?.hass;
    const systemsManagerHass = window._msdControlsRenderer?.systemsManager?._currentHass;

    console.log(`[CB-LCARS Debug] HASS comparison:`, {
        'main window.hass light.desk': mainHass?.states?.['light.desk']?.state,
        'MSD renderer HASS light.desk': msdHass?.states?.['light.desk']?.state,
        'SystemsManager HASS light.desk': systemsManagerHass?.states?.['light.desk']?.state,
        'Are they the same object?': {
            'main === msd': mainHass === msdHass,
            'main === systems': mainHass === systemsManagerHass,
            'msd === systems': msdHass === systemsManagerHass
        }
    });

    if (mainHass && mainHass.states) {
        console.log(`[CB-LCARS Debug] Main window HASS entities:`, {
            'light.desk': mainHass.states['light.desk']?.state,
            entityCount: Object.keys(mainHass.states).length
        });
    }
};

async function initializeCustomCard() {

    // Call log banner function immediately when the script loads
    cblcarsLogBanner();
    window.cblcars.cblcarsLog = cblcarsLog; // Expose the logging function globally

    // Expose debug helpers (the module already attaches API; this ensures references exist)
    window.cblcars.debug = window.cblcars.debug || {};
    window.cblcars.debug.setLevel = cblcarsSetGlobalLogLevel;

    // Animation namespace organization
    window.cblcars.anim = {
        animejs: anime,                // full animejs module
        anime: anime.animate,          // shortcut for anime.animate
        utils: anime.utils,            // CENTRAL canonical utils reference
        animateElement: animHelpers.animateElement,
        animateWithRoot: animHelpers.animateWithRoot,
        waitForElement: animHelpers.waitForElement,
        presets: animPresets,
        scopes: new Map(),
    };

    // Backward-compatible shortcuts (to be deprecated)
    window.cblcars.animejs = window.cblcars.anim.animejs;
    window.cblcars.anime = window.cblcars.anim.anime;
    window.cblcars.animateElement = window.cblcars.anim.animateElement;
    window.cblcars.animateWithRoot = window.cblcars.anim.animateWithRoot;
    window.cblcars.waitForElement = window.cblcars.anim.waitForElement;


    window.cblcars.svgHelpers = svgHelpers;
    window.cblcars.anchorHelpers = anchorHelpers;
    window.cblcars.findSvgAnchors = anchorHelpers.findSvgAnchors;
    window.cblcars.getSvgContent = anchorHelpers.getSvgContent;
    window.cblcars.getSvgViewBox = anchorHelpers.getSvgViewBox;
    window.cblcars.getSvgAspectRatio = anchorHelpers.getSvgAspectRatio;


    window.cblcars.loadFont = loadFont;
    window.cblcars.loadUserSVG = async function(key, url) {
        return await loadSVGToCache(key, url);
    };
    window.cblcars.getSVGFromCache = getSVGFromCache;

    ///load yaml configs
    // Await YAML configs
    templatesPromise = loadTemplates(CBLCARS.templates_uri);
    stubConfigPromise = loadStubConfig(CBLCARS.stub_config_uri);
    themeColorsPromise = loadThemeColors(CBLCARS.theme_colors_uri);

    // Await SVG preload
    await preloadSVGs(CBLCARS.builtin_svg_keys, CBLCARS.builtin_svg_basepath)
        .catch(error => cblcarsLog.error('[initializeCustomCard] Error preloading built-in SVGs:', error));

    // Await card dependencies
    const cardImports = [
        customElements.whenDefined('cblcars-button-card'),
        customElements.whenDefined('my-slider-v2')
    ];
    await Promise.all(cardImports);

    // Await font loading if loadCoreFonts is async
    await loadCoreFonts();

    // Await YAML config loading
    await Promise.all([templatesPromise, stubConfigPromise, themeColorsPromise]);

    // Checks that custom element dependencies are defined for use in the cards
    if (!customElements.get('cblcars-button-card')) {
        cblcarsLog.error(`[initializeCustomCard] Custom Button Card for LCARS [cblcars-button-card] was not found!`);
    }
    if (!customElements.get('my-slider-v2')) {
        cblcarsLog.error(`[initializeCustomCard] 'My Cards' MySliderV2 Custom Card [my-slider-v2] was not found!`);
    }
}


// Initialize the custom card and register elements only after setup is complete
initializeCustomCard()
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
        cblcarsLog.error('[initializeCustomCard.then()] Error initializing custom card:', error);
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
        cblcarsLog.debug(`[loadTemplates] CB-LCARS dashboard templates loaded from source file [${filePath}]`, templates);
    } catch (error) {
        cblcarsLog.error('[loadTemplates] Failed to get the CB-LCARS lovelace templates from source file.', error);
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
        cblcarsLog.info(`[loadThemeColors] CB-LCARS theme colors loaded from source file [${filePath}]`, yamlContent);
        setThemeColors(window.cblcars.themes, 'green');
    } catch (error) {
        cblcarsLog.error('[loadThemeColors] Failed to get the CB-LCARS theme colors from source file.', error);
    }
}

function setThemeColors(themes, alertCondition = 'green', clobber = false) {
    const selectedTheme = themes[`${alertCondition}_alert`];
    if (!selectedTheme) {
        cblcarsLog.error(`[setThemeColors] Theme for alert condition ${alertCondition} is not defined.`, '', cblcarsGetGlobalLogLevel());
        return;
    }

    const colors = selectedTheme.colors;

    for (const [colorGroup, colorValues] of Object.entries(colors)) {
        for (const [colorName, colorValue] of Object.entries(colorValues)) {
            const cssVarName = `--${colorName}`;
            const existingValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();

            if (clobber || !existingValue) {
                cblcarsLog.warn(`[setThemeColors] Color undefined or overridden - Setting ${cssVarName}=${colorValue}`, '', cblcarsGetGlobalLogLevel());
                document.documentElement.style.setProperty(cssVarName, colorValue);
            } else {
                cblcarsLog.debug(`[setThemeColors] Skipping ${cssVarName} as it is already defined with value ${existingValue}`, '', cblcarsGetGlobalLogLevel());
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
        cblcarsLog.debug(`[loadStubConfig] CB-LCARS stub configuration loaded from source file [${CBLCARS.stub_config_uri}]`, stubConfig);
    } catch (error) {
        cblcarsLog.error('[loadStubConfig] Failed to get the CB-LCARS stub configuration from source file.', error);
    }
}



// --- Anime.js v4 Scopes Manager ---
class CBLCARSAnimationScope {
    constructor(id) {
        this.id = id;
        this.scope = window.cblcars.animejs.createScope(); // anime.js v4 syntax
        this.animations = []; // Array to hold animation instances for inspection
        this._runningByTarget = new Map(); // Map<targetId, animation>
    }

    // Resolve the root for DOM operations
    _getRoot(options) {
        return (options && options.root) || document;
    }

    // Normalize targets into Element[]
    _resolveTargets(options) {
        const root = this._getRoot(options);
        const t = options && options.targets;
        if (!t) return [];
        if (t instanceof Element) return [t];
        if (Array.isArray(t)) return t.filter(Boolean);
        if (typeof t === 'string') {
            // Prefer ID fast-path
            if (t.startsWith('#')) {
                const el = root.querySelector(t);
                return el ? [el] : [];
            }
            return Array.from(root.querySelectorAll(t));
        }
        return [];
    }

    // Remove artifacts created by previous animation runs for a given baseId
    _cleanupArtifactsForTargetId(root, baseId) {
        if (!baseId) return;
        // Only remove preset-owned artifacts
        const trails = root.querySelectorAll(`#${baseId}_trail[data-cblcars-owned]`);
        trails.forEach(n => n.parentElement && n.parentElement.removeChild(n));
        const tracers = root.querySelectorAll(`#${baseId}_tracer[data-cblcars-owned]`);
        tracers.forEach(n => n.parentElement && n.parentElement.removeChild(n));

        // Clear CSS animation residue on the base element (e.g., march)
        const baseEl = root.getElementById(baseId);
        if (baseEl) {
            if (baseEl.style) baseEl.style.animation = '';
            baseEl.removeAttribute('data-march-anim-id');
        }
    }
    // Stop anime.js animations for the given targets and cleanup artifacts
    _cancelAndCleanupTargets(options) {
        const root = this._getRoot(options);
        const targets = this._resolveTargets(options);
        targets.forEach(el => {
            const id = el && el.id;
            if (!id) return;

            // Stop prior animations on this element (if any)
            if (this.scope && typeof this.scope.remove === 'function') {
                try { this.scope.remove(el); } catch (_) {}
            }

            // Remove previously created artifacts for this target
            this._cleanupArtifactsForTargetId(root, id);

            // Clear inline CSS animation remnants
            el.style && (el.style.animation = '');

            // Forget previous tracking entry
            this._runningByTarget.delete(id);
        });
        return targets;
    }

    /**
     * Adds an animation to the scope using the v4 `scope.add()` pattern.
     * De-duplicates by target: cancels prior animations and removes artifacts before starting a new one.
     * @param {object} options - The animation options for animateElement.
     * @param {object} hass - The Home Assistant hass object.
     */
    animate(options, hass = null) {
        const targets = this._cancelAndCleanupTargets(options);

        // Call the global animateElement helper, passing this instance as the scope.
        const animation = window.cblcars.anim.animateElement(this, options, hass);
        if (animation) {
            this.animations.push({ config: options, animation: animation, targets });
            // Track per-target so future runs can be canceled/cleaned deterministically
            targets.forEach(el => el && el.id && this._runningByTarget.set(el.id, animation));
        }
    }

    destroy() {
        // Stop and remove all animations associated with this scope.
        if (this.scope && typeof this.scope.remove === 'function') {
            try {
                const activeAnimations = window.cblcars.animejs.get(this.scope);
                if (activeAnimations) {
                    this.scope.remove(activeAnimations.map(anim => anim.targets).flat());
                }
            } catch (_) {}
        }

        // Cleanup artifacts for all tracked targets
        try {
            this.animations.forEach(entry => {
                const root = this._getRoot(entry.config);
                (entry.targets || []).forEach(el => {
                    if (el && el.id) {
                        this._cleanupArtifactsForTargetId(root, el.id);
                        el.style && (el.style.animation = '');
                    }
                });
            });
        } catch (_) {}

        // Clear internal tracking
        this._runningByTarget.clear();
        this.animations = [];
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
            cblcarsLog.debug('[CBLCARSBaseCard.constructor()] Resize observer fired', this, this._logLevel);
            this._debouncedResizeHandler();
        });
        this._debouncedResizeHandler = this._debounce(() => this._updateCardSize(), this._debounceWait);
    }


    setConfig(config) {
        if (!config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
        }

        // DEBUGGING: Log the incoming config to see what MSD is passing
        console.log('[CBLCARSBaseCard.setConfig()] Called with config:', {
            type: config.type,
            entity: config.entity,
            triggersUpdate: config.triggers_update,
            hasSetConfigFromMSD: config._msdGenerated || false,
            fullConfig: config
        });

        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Set the _logLevel property from the config
        this._logLevel = config.cblcars_log_level || cblcarsGetGlobalLogLevel();

        // ENHANCED: Skip entity collection entirely for MSD cards
        let triggersUpdate = [];
        const isMSDCard = config.type === 'cb-lcars-msd-card' ||
                        this.constructor.cardType === 'cb-lcars-msd-card' ||
                        mergedTemplates.includes('cb-lcars-msd');

        if (isMSDCard) {
            // MSD cards: NO entity tracking at all
            triggersUpdate = [];
            console.log(`[CBLCARSBaseCard.setConfig()] MSD card detected: Completely disabling triggers_update`);
        } else {
            // Non-MSD cards: Normal entity collection
            const foundEntities = collectEntities(config);
            triggersUpdate = Array.isArray(config.triggers_update) ? config.triggers_update : [];

            if (config.triggers_update === 'all') {
                triggersUpdate = 'all';
            } else if (foundEntities.length > 0) {
                triggersUpdate = Array.from(new Set([...triggersUpdate, ...foundEntities]));
                console.log(`[CBLCARSBaseCard.setConfig()] Found entities for triggers_update:`, foundEntities);
            }
        }


        // Create a new object to avoid modifying the original config
        this._config = {
            ...config,
            template: mergedTemplates,
            triggers_update: triggersUpdate  // FIXED: Re-enabled triggers_update
        };

        console.log('[CBLCARSBaseCard.setConfig()] Final config triggers_update:', this._config.triggers_update);

        // Load all fonts from the config (dynamically loads fonts based on the config)
        loadAllFontsFromConfig(this._config);

        // Check if the card is using a template from the dashboard's yaml.
        // this will override the card's configuration
        // this could be on purpose for testing/customization - but more likely holdovers from the original version that used that method
        const { isUsingLovelaceTemplate, overriddenTemplates } = checkLovelaceTemplates(this._config);
        this._isUsingLovelaceTemplate = isUsingLovelaceTemplate;
        this._overrideTemplates = overriddenTemplates;

        // Log a warning if the card is using a template from the dashboard's yaml
        // add the card to a list of tainted cards
        if(isUsingLovelaceTemplate) {
            cblcarsLog.warn(`[CBLCARSBaseCard.setConfig()] Card configuration templates are being overridden with local dashboard YAML configuration.  Templates: ${overriddenTemplates.join(', ')}`, this, this._logLevel);
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
        console.log('[CBLCARSBaseCard.setConfig()] Called super.setConfig with final config:', {
            triggersUpdate: this._config.triggers_update,
            entity: this._config.entity,
            type: this._config.type
        });

        // ADDED: Force state re-evaluation for CB-LCARS cards after config change
        if (this.hass && this._config.entity) {
            console.log('[CBLCARSBaseCard.setConfig()] Forcing state re-evaluation after setConfig');

            // Force the card to re-evaluate its state-based styling
            setTimeout(() => {
                try {
                    // Try multiple methods to force state update

                    // Method 1: Trigger a HASS update
                    if (typeof this.setHass === 'function') {
                        console.log('[CBLCARSBaseCard.setConfig()] Forcing setHass call');
                        this.setHass(this.hass);
                    }

                    // Method 2: Force render update
                    if (typeof this.requestUpdate === 'function') {
                        console.log('[CBLCARSBaseCard.setConfig()] Forcing requestUpdate');
                        this.requestUpdate();
                    }

                    // Method 3: Force property update (LitElement pattern)
                    if (this.hass && this._config.entity) {
                        const entity = this._config.entity;
                        const state = this.hass.states[entity];
                        if (state) {
                            console.log('[CBLCARSBaseCard.setConfig()] Triggering state property update for:', entity, state.state);

                            // Force the card to think the state changed
                            const oldState = this._stateObj;
                            this._stateObj = state;

                            if (typeof this.updated === 'function') {
                                this.updated(new Map([['hass', this.hass]]));
                            }
                        }
                    }

                } catch (e) {
                    console.warn('[CBLCARSBaseCard.setConfig()] Failed to force state re-evaluation:', e);
                }
            }, 100);
        }

        cblcarsLog.debug(`[CBLCARSBaseCard.setConfig()] called with:`, this._config, this._logLevel);
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
                cblcarsLog.error(`[CBLCARSBaseCard.getConfigElement()] Graphical editor element [${editorType}] is not defined defined in Home Assistant!`, null, this._logLevel);
                return null;
            }
            const element = document.createElement(editorType);
            //console.log('Element created:', element);
            return element;
        } catch (error) {
            cblcarsLog.error(`[CBLCARSBaseCard.getConfigElement()] Error creating element ${editorType}: `, error, this._logLevel);
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
        // --- Anime.js Scope creation ---
        this._animationScopeId = `card-${this.id || this.cardType || Math.random().toString(36).slice(2)}`;
        this._animationScope = new CBLCARSAnimationScope(this._animationScopeId);
        window.cblcars.anim.scopes.set(this._animationScopeId, this._animationScope);

        // CLEANUP: Stop previous timelines if any
        if (this._timelines && Array.isArray(this._timelines)) {
            this._timelines.forEach(tl => tl && typeof tl.pause === 'function' && tl.pause());
            this._timelines = null;
        }

        // NEW: Timelines now live under this._config.variables.msd.timelines
        // Build overlay config map from variables.msd.overlays for element-level merge
        const msdVars = this._config?.variables?.msd || {};
        const timelinesCfg = msdVars.timelines || null;
        const overlaysArr = Array.isArray(msdVars.overlays) ? msdVars.overlays : [];
        const overlayConfigsById = overlaysArr.reduce((acc, o) => {
            if (o && o.id) acc[o.id] = o;
            return acc;
        }, {});

        // Defer timeline creation until after the SVG/overlays have been stamped into the shadowRoot
        if (timelinesCfg) {
            requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                try {
                this._timelines = await animHelpers.createTimelines(
                    timelinesCfg,
                    this._animationScopeId,
                    this.shadowRoot,
                    overlayConfigsById,
                    this.hass || null,
                    msdVars.presets || {}      // <-- pass presets for state_resolver in timeline steps
                );
                // Do not force play(); let autoplay govern start/paused state
                } catch (e) {
                cblcarsLog.error('[CBLCARSBaseCard.connectedCallback] Error creating timelines:', e);
                }
            });
            });
        }

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

    connectedCallback2() {
        super.connectedCallback();
        // --- Anime.js Scope creation ---
        this._animationScopeId = `card-${this.id || this.cardType || Math.random().toString(36).slice(2)}`;
        this._animationScope = new CBLCARSAnimationScope(this._animationScopeId);
        window.cblcars.anim.scopes.set(this._animationScopeId, this._animationScope);

        // CLEANUP: Stop previous timelines if any
        if (this._timelines && Array.isArray(this._timelines)) {
            this._timelines.forEach(tl => tl && typeof tl.pause === 'function' && tl.pause());
            this._timelines = null;
        }

        // NEW: Timelines now live under this._config.variables.msd.timelines
        // Build overlay config map from variables.msd.overlays for element-level merge
        const msdVars = this._config?.variables?.msd || {};
        const timelinesCfg = msdVars.timelines || null;
        cblcarsLog.debug('connectedCallback timelines:', timelinesCfg);
        const overlaysArr = Array.isArray(msdVars.overlays) ? msdVars.overlays : [];
        const overlayConfigsById = overlaysArr.reduce((acc, o) => {
            if (o && o.id) acc[o.id] = o;
            return acc;
        }, {});

        if (timelinesCfg) {
            (async () => {
                try {
                    this._timelines = await animHelpers.createTimelines(
                        timelinesCfg,
                        this._animationScopeId,
                        this.shadowRoot,
                        overlayConfigsById,
                        this.hass || null
                    );
                } catch (e) {
                    cblcarsLog.error('[CBLCARSBaseCard.connectedCallback] Error creating timelines:', e);
                }
            })();
        }

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
        // --- Anime.js Scope cleanup ---
        const animationScope = window.cblcars.anim.scopes.get(this._animationScopeId);
        if (animationScope) {
            //animationScope.destroy();
            animationScope.destroy();
            window.cblcars.anim.scopes.delete(this._animationScopeId);
        }
        this.disableResizeObserver();
        window.removeEventListener('resize', this._debouncedResizeHandler)
    }

    _updateCardSize() {

        //cblcarsLog('debug',`this.offset* dimensions: ${this.offsetWidth} x ${this.offsetHeight}`, this, this._logLevel);
        //cblcarsLog('debug',`this.offsetParent.offset* dimensions: ${this.offsetParent.offsetWidth} x ${this.offsetParent.offsetHeight}`, this, this._logLevel);
        //cblcarsLog('debug',`this.parentElement.offset* dimensions: ${this.parentElement.offsetWidth} x ${this.parentElement.offsetHeight}`, this, this._logLevel);

        const parentWidth = this.parentElement.offsetWidth;
        const parentHeight = this.parentElement.offsetHeight;
        //cblcarsLog.debug(`Going with dimensions: ${parentWidth} x ${parentHeight}`, this, this._logLevel);

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
                cblcarsLog.debug('[CBLCARSBaseCard._updateCardSize()] Config is not defined. Skipping resize handling.', this, this._logLevel);
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
            cblcarsLog.debug(`[CBLCARSBaseCard.enableResizeObserver()] Resize observer enabled on [${this._resizeObserverTarget}]`, this, this._logLevel);
        }
    }

    disableResizeObserver() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        cblcarsLog.debug(`[CBLCARSBaseCard.disableResizeObserver()] Resize observer disabled`, this._logLevel);
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

    /**
     * Rebuild timelines for this card instance.
     * Safe to call after overlays have been stamped; uses double-rAF for DOM availability.
     * @param {object} timelinesCfg
     * @param {object} overlayConfigsById
     * @param {object} presets
     */
    _rebuildTimelines(timelinesCfg, overlayConfigsById = {}, presets = {}) {
        if (!timelinesCfg) return;

        // Stop previous timelines
        if (this._timelines && Array.isArray(this._timelines)) {
        this._timelines.forEach(tl => tl && typeof tl.pause === 'function' && tl.pause());
        this._timelines = null;
        }

        // Defer to next paints to ensure DOM is present
        requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
            try {
            this._timelines = await window.cblcars.anim.createTimelines
                ? window.cblcars.anim.createTimelines(
                    timelinesCfg,
                    this._animationScopeId,
                    this.shadowRoot,
                    overlayConfigsById,
                    this.hass || null,
                    presets || {}
                )
                : (await import('./utils/cb-lcars-anim-helpers.js')).createTimelines(
                    timelinesCfg,
                    this._animationScopeId,
                    this.shadowRoot,
                    overlayConfigsById,
                    this.hass || null,
                    presets || {}
                );
            } catch (e) {
            cblcarsLog.error('[CBLCARSBaseCard._rebuildTimelines] Error creating timelines:', e);
            }
        });
        });
    }
}

// Helper: Recursively collect all 'entity' and 'entity_id' values in an object
function collectEntities(obj, entities = []) {
    if (Array.isArray(obj)) {
        obj.forEach(item => collectEntities(item, entities));
    } else if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            if ((key === 'entity' || key === 'entity_id') && typeof value === 'string') {
                entities.push(value);
            } else {
                collectEntities(value, entities);
            }
        }
    }
    return entities;
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

        console.log('[MSD DEBUG] 🔧 CBLCARSMSDCard.setConfig() CALLED:', {
            timestamp: new Date().toISOString(),
            hasExistingConfig: !!this._config,
            configType: config.type,
            configEntity: config.entity,
            msdAlreadyBooted: !!this._msdV1ComprehensiveBoot,
            stackTrace: new Error().stack.split('\n').slice(1, 6).map(line => line.trim()).join(' → ')
        });

        const defaultTemplates = ['cb-lcars-msd'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // ENHANCED: Completely prevent any entity tracking for MSD cards
        const specialConfig = {
            ...config,
            template: mergedTemplates,
            // CRITICAL: Remove all entity references to prevent HA from tracking changes
            entity: undefined,
            entities: undefined,
            triggers_update: [], // Force empty array
            // Disable all button-card entity behaviors
            show_state: false,
            show_icon: false,
            show_name: false,
            show_label: true, // Keep label for display
            // Prevent any state-based interactions
            state: undefined,
            tap_action: { action: 'none' },
            hold_action: { action: 'none' },
            double_tap_action: { action: 'none' }
        };

        const msdConfig = specialConfig?.msd;

        // Call parent setConfig with sanitized config
        super.setConfig(specialConfig);

        // ENHANCED: Initialize MSD v1 pipeline for this card instance
        // This ensures the pipeline is ready when the card renders
        try {
            if (msdConfig && window.__msdDebug?.initMsdPipeline) {
                // Store the MSD config for later pipeline initialization in the template
                this._msdConfig = msdConfig;
                console.log('[CBLCARSMSDCard] MSD v1 config prepared for pipeline initialization');
            }
        } catch (e) {
            console.warn('[CBLCARSMSDCard] Failed to prepare MSD v1 pipeline:', e);
        }

        // PRESERVED: SVG handling logic for proper MSD initialization
        console.log('[CBLCARSMSDCard] msdConfig:', msdConfig);
        if (msdConfig && msdConfig.base_svg?.source) {
            console.log('[CBLCARSMSDCard] Found base SVG:', msdConfig.base_svg.source);
            let svgKey = null, svgUrl = null;

            if (msdConfig.base_svg.source.startsWith('builtin:')) {
                svgKey = msdConfig.base_svg.source.replace('builtin:', '');
            } else if (msdConfig.base_svg.source.startsWith('/local/')) {
                svgKey = msdConfig.base_svg.source.split('/').pop().replace('.svg','');
                svgUrl = msdConfig.base_svg.source;

                // Load user SVG if not already cached
                if (!window.cblcars.getSVGFromCache(svgKey)) {
                    window.cblcars.loadUserSVG(svgKey, svgUrl)
                        .then(() => {
                            // MODIFIED: Only request update if not blocked by our overrides
                            console.log('[CBLCARSMSDCard] SVG loaded, scheduling safe update');
                            // Use setTimeout to avoid immediate re-render during setConfig
                            setTimeout(() => {
                                if (this.requestUpdate && !this._blockUpdates) {
                                    this.requestUpdate();
                                }
                            }, 100);
                        })
                        .catch((error) => {
                            console.warn('[CBLCARSMSDCard] Failed to load user SVG:', error);
                        });
                }
            }

            this._svgKey = svgKey;
            console.log('[CBLCARSMSDCard] SVG key stored:', svgKey);
        }

        console.log('[CBLCARSMSDCard] Config set with disabled entity tracking and SVG handling preserved');
    }

    getLayoutOptions() {
        return {
            grid_rows: 4,
            grid_columns: 4
        };
    }

   /**
     * Override setHass to prevent MSD system re-renders that cause disappearing
     * MSD system manages its own HASS updates internally
     */
    setHass(hass) {
        console.log('[MSD DEBUG] 🏠 CBLCARSMSDCard.setHass() CALLED:', {
            timestamp: new Date().toISOString(),
            hasHass: !!hass,
            stackTrace: new Error().stack.split('\n').slice(1, 4).map(line => line.trim()).join(' → ')
        });

        // Store HASS reference but don't call parent setHass which triggers re-renders
        this.hass = hass;

        // Forward HASS to the MSD system directly instead of re-rendering the card
        if (this._msdPipeline && typeof this._msdPipeline.ingestHass === 'function') {
            console.log('[MSD DEBUG] 📤 Forwarding HASS to MSD pipeline');
            this._msdPipeline.ingestHass(hass);
        }

        // DO NOT call super.setHass(hass) - this is what causes the re-render problem
        console.log('[MSD DEBUG] ✅ CBLCARSMSDCard.setHass() COMPLETED - prevented super.setHass()');
    }

    /**
     * Force the card to re-evaluate its state and update styling
     * Useful for debugging state-based style issues
     */
    forceStateUpdate() {
        console.log('[CBLCARSBaseCard.forceStateUpdate()] Forcing state re-evaluation');

        if (!this.hass || !this._config?.entity) {
            console.warn('[CBLCARSBaseCard.forceStateUpdate()] No HASS or entity configured');
            return;
        }

        const entity = this._config.entity;
        const state = this.hass.states[entity];

        if (!state) {
            console.warn('[CBLCARSBaseCard.forceStateUpdate()] Entity not found:', entity);
            return;
        }

        console.log('[CBLCARSBaseCard.forceStateUpdate()] Current state:', {
            entity,
            state: state.state,
            attributes: state.attributes
        });

        try {
            // Force complete re-evaluation by simulating a HASS change
            const oldHass = this.hass;
            this.hass = null;
            this.hass = oldHass;

            // Force setHass call
            if (typeof this.setHass === 'function') {
                this.setHass(this.hass);
            }

            // Force render
            if (typeof this.requestUpdate === 'function') {
                this.requestUpdate('hass', oldHass);
            }

            console.log('[CBLCARSBaseCard.forceStateUpdate()] ✅ State update forced');

        } catch (e) {
            console.error('[CBLCARSBaseCard.forceStateUpdate()] ❌ Failed to force update:', e);
        }
    }

    /**
     * Override updated to prevent re-renders
     */
    updated(changedProperties) {
        console.log('[MSD DEBUG] 🔄 CBLCARSMSDCard.updated() CALLED:', {
            timestamp: new Date().toISOString(),
            changedProperties: Array.from(changedProperties.keys()),
            stackTrace: new Error().stack.split('\n').slice(1, 4).map(line => line.trim()).join(' → ')
        });

        // Only call super.updated for non-HASS changes (check both 'hass' and '_hass')
        if (!changedProperties.has('hass') && !changedProperties.has('_hass')) {
            console.log('[MSD DEBUG] 🔄 Calling super.updated() for non-HASS changes');
            super.updated(changedProperties);
        } else {
            console.log('[MSD DEBUG] ⏭️ BLOCKED super.updated() for HASS change to prevent re-render');
        }
    }

    /**
     * Override requestUpdate to be more selective
     */
    requestUpdate(name, oldValue, options) {
        console.log('[MSD DEBUG] 🔃 CBLCARSMSDCard.requestUpdate() CALLED:', {
            timestamp: new Date().toISOString(),
            name,
            hasOldValue: oldValue !== undefined,
            stackTrace: new Error().stack.split('\n').slice(1, 4).map(line => line.trim()).join(' → ')
        });

        // Prevent updates triggered by HASS changes (both 'hass' and '_hass' properties)
        if (name === 'hass' || name === '_hass') {
            console.log('[MSD DEBUG] 🚫 BLOCKED requestUpdate() for HASS change:', name);
            return Promise.resolve();
        }

        console.log('[MSD DEBUG] ✅ Allowing requestUpdate() for:', name);
        return super.requestUpdate(name, oldValue, options);
    }


    connectedCallback() {
        console.log('[CBLCARSMSDCard.connectedCallback] MSD card connected to DOM');
        super.connectedCallback();
    }

    disconnectedCallback() {
        console.log('[CBLCARSMSDCard.disconnectedCallback] MSD card disconnected from DOM');
        if (this.msdSystem) {
            console.log('[CBLCARSMSDCard.disconnectedCallback] Cleaning up MSD system');
            // Don't destroy the MSD system here in case it's just a temporary disconnect
        }
        super.disconnectedCallback();
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