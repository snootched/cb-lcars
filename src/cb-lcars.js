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

// Import all modular helpers
import * as overlayHelpers from './utils/cb-lcars-overlay-helpers.js';
import * as animHelpers from './utils/cb-lcars-anim-helpers.js';
import * as svgHelpers from './utils/cb-lcars-svg-helpers.js';
import * as styleHelpers from './utils/cb-lcars-style-helpers.js';
import * as anchorHelpers from './utils/cb-lcars-anchor-helpers.js';
import { load } from 'js-yaml';
import { animPresets } from './utils/cb-lcars-anim-presets.js';
import * as debugHelpers from './utils/cb-lcars-debug-helpers.js';

import { DataBus } from './utils/cb-lcars-data.js';
import * as controlsHelpers from './utils/cb-lcars-controls-helpers.js';
import * as geometryUtils from './utils/cb-lcars-geometry-utils.js';
import * as introspection from './utils/cb-lcars-introspection.js';
import * as perf from './utils/cb-lcars-perf.js';

import './utils/cb-lcars-routing-core.js';
import './utils/cb-lcars-routing-grid.js';
import './utils/cb-lcars-routing-channels.js';

// Conditionally load developer tools + HUD (only if ?lcarsDev=1 or forced)
try {
  const params = new URLSearchParams(location.search);
  if ((params.has('lcarsDev') || window.CBLCARS_DEV_FORCE === true) && !window.CBLCARS_DEV_DISABLE) {
    import('./utils/cb-lcars-dev-tools.js')
      .then(()=> {
        // HUD optional; load after dev tools to ensure namespace exists
        return import('./utils/cb-lcars-dev-hud.js').catch(()=>{});
      })
      .catch(e=>console.warn('[cb-lcars] dev tools load failed', e));
  }
} catch(_) {}

/**
 * Apply MSD debug flags as early as possible so first overlay render
 * (renderMsdOverlay) can auto-render the debug layer (geometry/connectors/perf/etc).
 * - Merges (logical OR for true flags) with any existing global flags.
 * - If debug API not yet attached, retries automatically.
 * @param {object} msdDebugCfg  variables.msd.debug from card config
 */
function applyEarlyMsdDebugFlags(msdDebugCfg) {
  if (!msdDebugCfg || typeof msdDebugCfg !== 'object') return;
  const { level, ...flagCandidates } = msdDebugCfg;

  let retries = 0;
  const MAX_RETRIES = 20; // ~600ms worst case (20 * 30ms)

  const tryApply = () => {
    const dbg = window.cblcars?.debug;
    if (!dbg || typeof dbg.setFlags !== 'function') {
      if (retries++ < MAX_RETRIES) {
        setTimeout(tryApply, 30);
      }
      return;
    }

    // Merge semantics: do not turn an existing true into false
    const existing = window.cblcars._debugFlags || {};
    const merged = { ...existing };
    for (const [k, v] of Object.entries(flagCandidates)) {
      if (v === true) merged[k] = true;
      else if (!(k in merged)) merged[k] = v; // preserve explicit false only if key absent
    }

    // Ensure new flags explicitly force true
    if (flagCandidates.validation === true) merged.validation = true;
    if (flagCandidates.channels === true) merged.channels = true;

    dbg.setFlags(merged);
    if (level && typeof dbg.setLevel === 'function') {
      dbg.setLevel(level);
    }
  };

  tryApply();
}


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


async function initializeCustomCard() {

    // Call log banner function immediately when the script loads
    cblcarsLogBanner();
    window.cblcars.cblcarsLog = cblcarsLog; // Expose the logging function globally

    // Expose debug helpers (the module already attaches API; this ensures references exist)
    window.cblcars.debug = window.cblcars.debug || {};
    window.cblcars.debug.render = debugHelpers.renderDebugLayer;
    window.cblcars.debug.clear = debugHelpers.clearDebugLayer;
    window.cblcars.debug.logGeometry = debugHelpers.logGeometry;
    //window.cblcars.debug.setLevel = debugHelpers.setGlobalLogLevel;
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

    window.cblcars.controlsHelpers = controlsHelpers;
    window.cblcars.renderMsdControls = controlsHelpers.renderMsdControls;

    // Ensure legacy reference also points at the canonical utils (for any older modules)
    //window.cblcars.animejs.utils = window.cblcars.anim.utils;

    window.cblcars.geometry = geometryUtils;
    window.cblcars.geometryUtils = geometryUtils; // alias

    window.cblcars.overlayHelpers = overlayHelpers;
    window.cblcars.renderMsdOverlay = overlayHelpers.renderMsdOverlay;
    window.cblcars.svgHelpers = svgHelpers;
    window.cblcars.styleHelpers = styleHelpers;
    window.cblcars.connectors = window.cblcars.connectors || {};
    window.cblcars.connectors.relayout = (root, viewBox) =>
        window.cblcars.overlayHelpers?.layoutPendingConnectors?.(root || document, viewBox);


    // NEW: controls.relayout alias backed by last stored args
    window.cblcars.controls = window.cblcars.controls || {};
    window.cblcars.controls.relayout = (rootLike) => {
      try {
        const rootNode = (rootLike && rootLike.shadowRoot) ? rootLike.shadowRoot : (rootLike || document);
        const last = rootNode && rootNode.__cblcars_lastControlsArgs;
        if (!last) {
          console.warn('[controls.relayout] No previous controls render arguments found.');
          return;
        }
       // Re-run render with stored args (fresh hass pulled if card host still present)
        if (last.root?.host?.hass) last.hass = last.root.host.hass;
        window.cblcars.renderMsdControls(last);
      } catch (e) {
        console.warn('[controls.relayout] failed', e);
      }
    };

    // After existing connectors.relayout definition:
    window.cblcars.connectors.invalidate = (id) => {
    // id optional; if omitted invalidates all connectors
        try {
            const helper = window.cblcars.overlayHelpers;
            if (!helper) return;
            // Use internal markDirty via public API hook:
            // We cannot import the function directly here, so we piggy-back by setting a _dirty set:
            window.cblcars.connectors._dirty = window.cblcars.connectors._dirty || new Set();
            if (!id) window.cblcars.connectors._dirty.add('*');
            else window.cblcars.connectors._dirty.add(id);
        } catch (_) {}
    };


    window.cblcars.anchorHelpers = anchorHelpers;
    window.cblcars.findSvgAnchors = anchorHelpers.findSvgAnchors;
    window.cblcars.getSvgContent = anchorHelpers.getSvgContent;
    window.cblcars.getSvgViewBox = anchorHelpers.getSvgViewBox;
    window.cblcars.getSvgAspectRatio = anchorHelpers.getSvgAspectRatio;

    // MSD Introspection API
    window.cblcars.msd = window.cblcars.msd || {};
    window.cblcars.msd.listOverlays = (root) => introspection.listOverlays(root || document);
    window.cblcars.msd.listAnchors = (root) => introspection.listAnchors(root || document);
    window.cblcars.msd.getOverlayBBox = (id, root) => introspection.getOverlayBBox(id, root || document);
    window.cblcars.msd.highlight = (ids, opts) => introspection.highlight(ids, opts);

    window.cblcars.data = window.cblcars.data || new DataBus();

    // Pre-seed some common counters so perf HUD has stable rows immediately
    try {
      window.cblcars.debug?.perf?.preseed?.([
        'msd.render',
        'connectors.layout.recomputed',
        'sparkline.refresh',
        'ribbon.refresh.exec'
      ]);
    } catch(_) {}

    // PERF helper aliases (added)
    if (!window.cblcars.perfDump) {
    window.cblcars.perfDump = () => {
        try { return window.cblcars.perf.dump(); } catch { return {}; }
    };
    }
    if (!window.cblcars.perfdump) {
    window.cblcars.perfdump = window.cblcars.perfDump;
    }

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


        // Handle merging of templates array
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];


        // Set the _logLevel property from the config
        this._logLevel = config.cblcars_log_level || cblcarsGetGlobalLogLevel();

        // --- Add all found 'entity' values to triggers_update ---
        const foundEntities = collectEntities(config);
        let triggersUpdate = Array.isArray(config.triggers_update) ? config.triggers_update : [];
        if (foundEntities.length > 0) {
            triggersUpdate = Array.from(new Set([...triggersUpdate, ...foundEntities]));
            cblcarsLog.debug(`[CBLCARSBaseCard.setConfig()] Found entities for triggers_update:`, foundEntities);
            cblcarsLog.debug(`[CBLCARSBaseCard.setConfig()] Updated triggers_update:`, triggersUpdate);
        }

        // Create a new object to avoid modifying the original config
        this._config = {
            ...config,
            template: mergedTemplates,
            triggers_update: triggersUpdate
        };

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
        const defaultTemplates = ['cb-lcars-msd'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        const specialConfig = { ...config, template: mergedTemplates };

        // 1. EARLY: pull debug flags from raw config BEFORE super.setConfig
        try {
        const earlyDbg = specialConfig?.variables?.msd?.debug;
        applyEarlyMsdDebugFlags(earlyDbg);
        // Optional: pre-seed counters if perf flag true
        if (earlyDbg?.perf && window.cblcars?.debug?.perf?.preseed) {
            window.cblcars.debug.perf.preseed([
            'msd.render',
            'connectors.layout.recomputed',
            'sparkline.refresh',
            'ribbon.refresh.exec'
            ]);
        }
        } catch (e) {
        cblcarsLog.warn('[CBLCARSMSDCard.setConfig] Early debug flags apply failed', e);
        }

        // 2. Base card setConfig (will trigger first render later)
        super.setConfig(specialConfig);

        // 3. SAFETY: if (for any reason) global flags still undefined after super, retry once shortly
        try {
        if (!window.cblcars?._debugFlags) {
            const lateDbg = this._config?.variables?.msd?.debug;
            if (lateDbg) setTimeout(() => applyEarlyMsdDebugFlags(lateDbg), 40);
        }
        } catch (_) {}

        // 4. Existing SVG lazy-loading logic (unchanged)
        const msdVars = specialConfig.variables && specialConfig.variables.msd;

        if (msdVars && msdVars.routing) {
        try {
            window.cblcars.routing?.setGlobalConfig(msdVars.routing);
        } catch (e) {
            cblcarsLog.warn('[CBLCARSMSDCard.setConfig] Failed applying routing config', e);
        }
        }

        if (msdVars && msdVars.base_svg) {
        let svgKey = null, svgUrl = null;
        if (msdVars.base_svg.startsWith('builtin:')) {
            svgKey = msdVars.base_svg.replace('builtin:', '');
        } else if (msdVars.base_svg.startsWith('/local/')) {
            svgKey = msdVars.base_svg.split('/').pop().replace('.svg','');
            svgUrl = msdVars.base_svg;
            if (!window.cblcars.getSVGFromCache(svgKey)) {
            window.cblcars.loadUserSVG(svgKey, svgUrl)
                .then(() => this.requestUpdate && this.requestUpdate())
                .catch(() => {});
            }
        }
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
//Promise.all([window.cblcars.animeReady, templatesPromise, stubConfigPromise, themeColorsPromise])
/*
Promise.all([templatesPromise, stubConfigPromise, themeColorsPromise])
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
    cblcarsLog.error('Error loading YAML configuration:', error);
  });
*/


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