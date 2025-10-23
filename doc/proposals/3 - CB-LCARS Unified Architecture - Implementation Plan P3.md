# CB-LCARS Unified Architecture - Implementation Phase 3

**Phase 3: Rules Engine & Style Library**

**Goal:** Extract rules engine and styling system from MSD for unified state management

**Priority:** Medium - Foundation for replacing legacy button-card state blocks

---

## Phase 3 Tasks Overview

```
Phase 3: Rules Engine & Style Library
├─ 3.1: Extract Rules Engine from MSD
├─ 3.2: Create Style Library System
├─ 3.3: Build YAML Preset Format
├─ 3.4: Implement Theme Manager
├─ 3.5: Create Condition Evaluator
├─ 3.6: Test Rules in Standalone Cards
└─ 3.7: Performance Optimization
```

---

## 3.1: Extract Rules Engine from MSD

**Purpose:** Centralize rule evaluation logic for all cards

**Current Location:** MSD overlay system has embedded rule evaluation

**Target Location:** `src/core/rules-engine/index.js`

**Key Features:**
- Declarative condition matching
- Multiple condition types (state, attribute, range, regex, logical operators)
- Style preset application
- Animation triggers
- Custom context variables
- Per-card instances with shared library references

### Code: Rules Engine

**File:** `src/core/rules-engine/index.js`

```javascript
/**
 * RulesEngine - Declarative State-Based Rule Evaluation
 * 
 * Replaces complex button-card state blocks with declarative YAML rules
 * Evaluates conditions and applies style presets, animations, and custom actions
 * 
 * ARCHITECTURE:
 * - Each card has its own RulesEngine instance
 * - Engine references shared StyleLibrary and AnimationPresets
 * - Rules evaluated on entity state changes
 * - Results applied to overlays/controls
 * 
 * USAGE:
 * const engine = new RulesEngine(rules, styleLibrary, animationPresets);
 * const result = engine.evaluate(entityState, customContext);
 * 
 * @example
 * // Rule configuration
 * rules: [
 *   {
 *     condition: { entity: 'light.desk', state: 'on' },
 *     apply: { style_preset: 'active', animation: 'pulse' }
 *   }
 * ]
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ConditionEvaluator } from './condition-evaluator.js';

export class RulesEngine {
    /**
     * Create a rules engine instance
     * 
     * @param {Array} rules - Array of rule definitions
     * @param {StyleLibrary} styleLibrary - Shared style library
     * @param {AnimationPresets} animationPresets - Shared animation presets
     */
    constructor(rules, styleLibrary, animationPresets) {
        this.rules = rules || [];
        this.styleLibrary = styleLibrary;
        this.animationPresets = animationPresets;
        
        // Condition evaluator
        this.conditionEvaluator = new ConditionEvaluator();
        
        // Cache for performance
        this._lastResult = null;
        this._lastStateSignature = null;
        
        cblcarsLog.debug('[RulesEngine] Initialized with', rules.length, 'rules');
    }

    /**
     * Evaluate all rules against current state
     * Returns first matching rule's actions
     * 
     * @param {Object} entityState - Current entity state object
     * @param {Object} customContext - Additional context variables
     * @returns {RuleResult} Evaluation result
     */
    evaluate(entityState, customContext = {}) {
        // Quick cache check (avoid re-evaluation for same state)
        const stateSignature = this._createStateSignature(entityState, customContext);
        if (stateSignature === this._lastStateSignature && this._lastResult) {
            return this._lastResult;
        }

        // Evaluate rules in order (first match wins)
        for (let i = 0; i < this.rules.length; i++) {
            const rule = this.rules[i];
            
            try {
                const matches = this._evaluateRule(rule, entityState, customContext);
                
                if (matches) {
                    cblcarsLog.debug('[RulesEngine] Rule matched:', i, rule);
                    
                    const result = this._buildResult(rule, entityState, customContext);
                    
                    // Cache result
                    this._lastStateSignature = stateSignature;
                    this._lastResult = result;
                    
                    return result;
                }
            } catch (error) {
                cblcarsLog.error(`[RulesEngine] Error evaluating rule ${i}:`, error);
            }
        }

        // No rules matched - return default result
        const defaultResult = {
            matched: false,
            stylePreset: null,
            inlineStyles: null,
            animation: null,
            customData: null
        };

        this._lastStateSignature = stateSignature;
        this._lastResult = defaultResult;
        
        return defaultResult;
    }

    /**
     * Evaluate a single rule
     * @private
     * 
     * @param {Object} rule - Rule definition
     * @param {Object} entityState - Entity state
     * @param {Object} customContext - Custom context
     * @returns {boolean} True if rule matches
     */
    _evaluateRule(rule, entityState, customContext) {
        if (!rule || !rule.condition) {
            return false;
        }

        const condition = rule.condition;
        const context = {
            entity: entityState,
            ...customContext
        };

        return this.conditionEvaluator.evaluate(condition, context);
    }

    /**
     * Build result object from matched rule
     * @private
     * 
     * @param {Object} rule - Matched rule
     * @param {Object} entityState - Entity state
     * @param {Object} customContext - Custom context
     * @returns {RuleResult} Result object
     */
    _buildResult(rule, entityState, customContext) {
        const apply = rule.apply || {};
        
        const result = {
            matched: true,
            stylePreset: apply.style_preset || null,
            inlineStyles: apply.inline_styles || apply.styles || null,
            animation: apply.animation || null,
            customData: apply.data || null,
            rulePriority: rule.priority || 0
        };

        // Resolve style preset if specified
        if (result.stylePreset && this.styleLibrary) {
            try {
                result.resolvedStyles = this.styleLibrary.getPreset(result.stylePreset);
            } catch (error) {
                cblcarsLog.error('[RulesEngine] Error resolving style preset:', error);
            }
        }

        // Resolve animation if specified
        if (result.animation && this.animationPresets) {
            try {
                result.resolvedAnimation = this.animationPresets.getPreset(result.animation);
            } catch (error) {
                cblcarsLog.error('[RulesEngine] Error resolving animation:', error);
            }
        }

        return result;
    }

    /**
     * Create state signature for caching
     * @private
     * 
     * @param {Object} entityState - Entity state
     * @param {Object} customContext - Custom context
     * @returns {string} State signature
     */
    _createStateSignature(entityState, customContext) {
        if (!entityState) return 'null';
        
        // Create minimal signature for cache comparison
        const sig = {
            state: entityState.state,
            attributes: entityState.attributes,
            context: customContext
        };
        
        return JSON.stringify(sig);
    }

    /**
     * Clear evaluation cache
     */
    clearCache() {
        this._lastResult = null;
        this._lastStateSignature = null;
    }

    /**
     * Add rule dynamically
     * 
     * @param {Object} rule - Rule definition
     * @param {number} priority - Optional priority (higher = earlier evaluation)
     */
    addRule(rule, priority = 0) {
        if (priority) {
            rule.priority = priority;
        }
        
        // Insert based on priority (higher priority first)
        const insertIndex = this.rules.findIndex(r => (r.priority || 0) < priority);
        if (insertIndex === -1) {
            this.rules.push(rule);
        } else {
            this.rules.splice(insertIndex, 0, rule);
        }
        
        this.clearCache();
        cblcarsLog.debug('[RulesEngine] Rule added, total rules:', this.rules.length);
    }

    /**
     * Remove rule by index
     * 
     * @param {number} index - Rule index
     */
    removeRule(index) {
        if (index >= 0 && index < this.rules.length) {
            this.rules.splice(index, 1);
            this.clearCache();
            cblcarsLog.debug('[RulesEngine] Rule removed, total rules:', this.rules.length);
        }
    }

    /**
     * Get all rules
     * 
     * @returns {Array} Array of rules
     */
    getRules() {
        return [...this.rules];
    }

    /**
     * Update rules
     * 
     * @param {Array} rules - New rules array
     */
    setRules(rules) {
        this.rules = rules || [];
        this.clearCache();
        cblcarsLog.debug('[RulesEngine] Rules updated, total rules:', this.rules.length);
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.rules = [];
        this.clearCache();
        cblcarsLog.debug('[RulesEngine] Destroyed');
    }
}

/**
 * Rule Result Interface
 * 
 * @typedef {Object} RuleResult
 * @property {boolean} matched - Whether a rule matched
 * @property {string|null} stylePreset - Style preset name
 * @property {Object|null} inlineStyles - Inline style object
 * @property {string|null} animation - Animation preset name
 * @property {any} customData - Custom data from rule
 * @property {Object|null} resolvedStyles - Resolved style object from library
 * @property {Object|null} resolvedAnimation - Resolved animation config
 * @property {number} rulePriority - Priority of matched rule
 */
```

**Acceptance Criteria:**
- ✅ RulesEngine class created
- ✅ Per-card instances supported
- ✅ First-match rule evaluation
- ✅ Style preset resolution
- ✅ Animation preset resolution
- ✅ Caching for performance
- ✅ Dynamic rule addition/removal

---

## 3.2: Create Style Library System

**Purpose:** Centralized style definitions with preset system

**File:** `src/core/styling/style-library.js`

```javascript
/**
 * StyleLibrary - Centralized Style Management
 * 
 * Provides preset-based styling system with theme support
 * Loads style definitions from YAML and provides runtime access
 * Supports style inheritance and CSS variable resolution
 * 
 * ARCHITECTURE:
 * - One instance shared by all cards (via CBLCARSCore)
 * - Loads presets from YAML configuration
 * - Supports preset inheritance (extends)
 * - Resolves CSS variables at runtime
 * - Theme switching capability
 * 
 * USAGE:
 * const styles = styleLibrary.getPreset('active');
 * styleLibrary.setActiveTheme('red_alert');
 * 
 * @example
 * // YAML definition
 * presets:
 *   active:
 *     color: var(--lcars-ui-secondary)
 *     opacity: 1
 *   button_lozenge:
 *     extends: active
 *     border_radius: 30px
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { readYamlFile } from '../../utils/cb-lcars-fileutils.js';

export class StyleLibrary {
    constructor() {
        // Preset storage
        this._presets = new Map();  // Map<presetName, styleObject>
        this._themes = new Map();   // Map<themeName, themeObject>
        
        // Current theme
        this._activeTheme = null;
        
        // Loading state
        this._loaded = false;
        this._loadPromise = null;
        
        cblcarsLog.info('[StyleLibrary] Initialized');
    }

    /**
     * Load style definitions from YAML file
     * 
     * @param {string} url - URL to YAML file
     * @returns {Promise<void>}
     */
    async loadFromYAML(url) {
        if (this._loadPromise) {
            cblcarsLog.debug('[StyleLibrary] Already loading, returning existing promise');
            return this._loadPromise;
        }

        if (this._loaded) {
            cblcarsLog.debug('[StyleLibrary] Already loaded');
            return;
        }

        cblcarsLog.info('[StyleLibrary] Loading styles from:', url);
        
        this._loadPromise = this._doLoad(url);
        await this._loadPromise;
        
        this._loaded = true;
        this._loadPromise = null;
    }

    /**
     * Internal load implementation
     * @private
     * 
     * @param {string} url - URL to YAML file
     */
    async _doLoad(url) {
        try {
            const yaml = await readYamlFile(url);
            
            if (!yaml) {
                throw new Error('Failed to load YAML file');
            }

            // Load presets
            if (yaml.presets) {
                for (const [name, preset] of Object.entries(yaml.presets)) {
                    this._presets.set(name, preset);
                }
                cblcarsLog.info(`[StyleLibrary] Loaded ${this._presets.size} presets`);
            }

            // Load themes
            if (yaml.themes) {
                for (const [name, theme] of Object.entries(yaml.themes)) {
                    this._themes.set(name, theme);
                }
                cblcarsLog.info(`[StyleLibrary] Loaded ${this._themes.size} themes`);
            }

            // Set default theme if specified
            if (yaml.default_theme && this._themes.has(yaml.default_theme)) {
                this.setActiveTheme(yaml.default_theme);
            }

        } catch (error) {
            cblcarsLog.error('[StyleLibrary] Failed to load styles:', error);
            throw error;
        }
    }

    /**
     * Get a style preset
     * Resolves inheritance (extends) and CSS variables
     * 
     * @param {string} presetName - Preset name
     * @returns {Object} Resolved style object
     */
    getPreset(presetName) {
        if (!presetName) {
            return {};
        }

        const preset = this._presets.get(presetName);
        
        if (!preset) {
            cblcarsLog.warn(`[StyleLibrary] Preset '${presetName}' not found`);
            return {};
        }

        // Resolve inheritance
        const resolved = this._resolvePreset(presetName);
        
        // Resolve CSS variables
        return this._resolveCSSVariables(resolved);
    }

    /**
     * Resolve preset inheritance
     * @private
     * 
     * @param {string} presetName - Preset name
     * @param {Set} visited - Visited presets (circular reference detection)
     * @returns {Object} Resolved preset
     */
    _resolvePreset(presetName, visited = new Set()) {
        // Circular reference check
        if (visited.has(presetName)) {
            cblcarsLog.error(`[StyleLibrary] Circular reference detected: ${presetName}`);
            return {};
        }

        visited.add(presetName);

        const preset = this._presets.get(presetName);
        if (!preset) {
            return {};
        }

        // No inheritance
        if (!preset.extends) {
            return { ...preset };
        }

        // Resolve parent first
        const parent = this._resolvePreset(preset.extends, visited);
        
        // Merge with parent (child overrides parent)
        const { extends: _, ...childProps } = preset;  // Remove 'extends' property
        return {
            ...parent,
            ...childProps
        };
    }

    /**
     * Resolve CSS variables in style object
     * @private
     * 
     * @param {Object} styles - Style object
     * @returns {Object} Resolved styles
     */
    _resolveCSSVariables(styles) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(styles)) {
            if (typeof value === 'string' && value.includes('var(--')) {
                // CSS variable - resolve at runtime
                resolved[key] = this._resolveCSSVariable(value);
            } else if (typeof value === 'object' && value !== null) {
                // Nested object - recurse
                resolved[key] = this._resolveCSSVariables(value);
            } else {
                resolved[key] = value;
            }
        }
        
        return resolved;
    }

    /**
     * Resolve a single CSS variable
     * @private
     * 
     * @param {string} value - CSS variable string (e.g., "var(--color)")
     * @returns {string} Resolved value
     */
    _resolveCSSVariable(value) {
        // If active theme has override, use it
        if (this._activeTheme) {
            const themeData = this._themes.get(this._activeTheme);
            if (themeData) {
                // Extract variable name
                const match = value.match(/var\(--([^)]+)\)/);
                if (match) {
                    const varName = match[1];
                    if (themeData[varName]) {
                        return themeData[varName];
                    }
                }
            }
        }

        // Return as-is (browser will resolve)
        return value;
    }

    /**
     * Get a theme
     * 
     * @param {string} themeName - Theme name
     * @returns {Object|null} Theme object
     */
    getTheme(themeName) {
        return this._themes.get(themeName) || null;
    }

    /**
     * Set active theme
     * Updates CSS variables globally
     * 
     * @param {string} themeName - Theme name
     */
    setActiveTheme(themeName) {
        const theme = this._themes.get(themeName);
        
        if (!theme) {
            cblcarsLog.warn(`[StyleLibrary] Theme '${themeName}' not found`);
            return;
        }

        this._activeTheme = themeName;
        
        // Update CSS variables on document root
        for (const [varName, value] of Object.entries(theme)) {
            document.documentElement.style.setProperty(`--${varName}`, value);
        }
        
        cblcarsLog.info(`[StyleLibrary] Active theme set to: ${themeName}`);
        
        // Dispatch theme change event
        window.cblcars.eventBus?.publish('theme.changed', {
            theme: themeName,
            colors: theme
        });
    }

    /**
     * Get active theme name
     * 
     * @returns {string|null} Active theme name
     */
    getActiveTheme() {
        return this._activeTheme;
    }

    /**
     * Register a preset dynamically
     * 
     * @param {string} name - Preset name
     * @param {Object} styles - Style object
     */
    registerPreset(name, styles) {
        this._presets.set(name, styles);
        cblcarsLog.debug(`[StyleLibrary] Preset registered: ${name}`);
    }

    /**
     * Register a theme dynamically
     * 
     * @param {string} name - Theme name
     * @param {Object} colors - Theme colors
     */
    registerTheme(name, colors) {
        this._themes.set(name, colors);
        cblcarsLog.debug(`[StyleLibrary] Theme registered: ${name}`);
    }

    /**
     * Get all preset names
     * 
     * @returns {string[]} Array of preset names
     */
    getPresetNames() {
        return Array.from(this._presets.keys());
    }

    /**
     * Get all theme names
     * 
     * @returns {string[]} Array of theme names
     */
    getThemeNames() {
        return Array.from(this._themes.keys());
    }

    /**
     * Check if loaded
     * 
     * @returns {boolean} True if loaded
     */
    isLoaded() {
        return this._loaded;
    }

    /**
     * Clear all presets and themes
     */
    clear() {
        this._presets.clear();
        this._themes.clear();
        this._activeTheme = null;
        this._loaded = false;
        cblcarsLog.info('[StyleLibrary] Cleared');
    }
}
```

**Acceptance Criteria:**
- ✅ StyleLibrary class created
- ✅ YAML loading functional
- ✅ Preset inheritance (extends) works
- ✅ CSS variable resolution
- ✅ Theme switching capability
- ✅ Dynamic preset/theme registration

---

## 3.3: Build YAML Preset Format

**Purpose:** Define standardized YAML format for styles

**File:** `/local/cb-lcars/styles.yaml` (example)

```yaml
# CB-LCARS Style Library
# Centralized style presets for all CB-LCARS cards

# Default theme
default_theme: green_alert

# ============================================================================
# PRESETS - Reusable Style Definitions
# ============================================================================
presets:
  # ----- Base Presets -----
  
  active:
    color: var(--lcars-ui-secondary)
    border_color: var(--lcars-ui-secondary)
    background: transparent
    opacity: 1
    transition: all 0.2s ease

  inactive:
    color: var(--lcars-ui-tertiary)
    border_color: var(--lcars-ui-tertiary)
    background: transparent
    opacity: 0.6
    transition: all 0.2s ease

  error:
    color: var(--lcars-red)
    border_color: var(--lcars-red)
    background: transparent
    opacity: 1
    transition: all 0.2s ease

  unavailable:
    color: var(--lcars-card-button-unavailable)
    border_color: var(--lcars-card-button-unavailable)
    background: transparent
    opacity: 0.5
    transition: all 0.2s ease

  # ----- Component-Specific Presets (with inheritance) -----

  button_lozenge:
    extends: active
    border_radius: 30px
    padding: 10px 20px
    font_size: 18px
    font_weight: bold
    text_transform: uppercase

  button_rectangle:
    extends: active
    border_radius: 5px
    padding: 10px 15px
    font_size: 16px
    font_weight: normal

  gauge_active:
    extends: active
    stroke_width: 3
    fill: none
    stroke_linecap: round

  gauge_inactive:
    extends: inactive
    stroke_width: 3
    fill: none
    stroke_linecap: round

  text_title:
    extends: active
    font_size: 24px
    font_weight: bold
    font_family: Antonio, sans-serif
    text_transform: uppercase

  text_body:
    extends: active
    font_size: 16px
    font_weight: normal
    font_family: Antonio, sans-serif

  text_small:
    extends: active
    font_size: 12px
    font_weight: normal
    font_family: Antonio, sans-serif

  line_accent:
    extends: active
    stroke_width: 2
    stroke_linecap: round

  line_separator:
    extends: inactive
    stroke_width: 1
    stroke_dasharray: 5 5

  # ----- State-Specific Presets -----

  state_on:
    extends: active

  state_off:
    extends: inactive

  state_heating:
    color: var(--lcars-orange)
    border_color: var(--lcars-orange)
    background: transparent
    opacity: 1

  state_cooling:
    color: var(--lcars-blue)
    border_color: var(--lcars-blue)
    background: transparent
    opacity: 1

  state_alert:
    extends: error
    animation: pulse

  # ----- Animation Presets -----

  animated_pulse:
    extends: active
    animation: pulse
    animation_duration: 1s
    animation_timing: ease-in-out
    animation_iteration: infinite

  animated_blink:
    extends: active
    animation: blink
    animation_duration: 0.5s
    animation_iteration: infinite

# ============================================================================
# THEMES - Alert Condition Colors
# ============================================================================
themes:
  green_alert:
    lcars-ui-primary: '#99ccff'
    lcars-ui-secondary: '#cc99cc'
    lcars-ui-tertiary: '#9999cc'
    lcars-card-button: '#ff9966'
    lcars-card-button-off: '#333333'
    lcars-orange: '#ff9900'
    lcars-blue: '#0099cc'
    lcars-green: '#99cc66'
    lcars-red: '#cc6666'

  yellow_alert:
    lcars-ui-primary: '#ffcc99'
    lcars-ui-secondary: '#ffff99'
    lcars-ui-tertiary: '#cc9966'
    lcars-card-button: '#ff9900'
    lcars-card-button-off: '#333333'
    lcars-orange: '#ff9900'
    lcars-blue: '#0099cc'
    lcars-green: '#99cc66'
    lcars-red: '#cc6666'

  red_alert:
    lcars-ui-primary: '#ff9999'
    lcars-ui-secondary: '#cc6666'
    lcars-ui-tertiary: '#996666'
    lcars-card-button: '#cc0000'
    lcars-card-button-off: '#330000'
    lcars-orange: '#ff6600'
    lcars-blue: '#336699'
    lcars-green: '#669933'
    lcars-red: '#cc0000'

  blue_alert:
    lcars-ui-primary: '#99ccff'
    lcars-ui-secondary: '#6699cc'
    lcars-ui-tertiary: '#336699'
    lcars-card-button: '#0066cc'
    lcars-card-button-off: '#003366'
    lcars-orange: '#cc6600'
    lcars-blue: '#0066cc'
    lcars-green: '#339966'
    lcars-red: '#993333'

  # Picard-era colors
  picard_normal:
    lcars-ui-primary: '#9999ff'
    lcars-ui-secondary: '#cc99ff'
    lcars-ui-tertiary: '#6666cc'
    lcars-card-button: '#ff9966'
    lcars-card-button-off: '#222222'
    lcars-orange: '#ff9933'
    lcars-blue: '#6699ff'
    lcars-green: '#66cc99'
    lcars-red: '#cc6699'
```

**Usage in Card Config:**

```yaml
type: cb-lcars-button-card
entity: light.desk
variables:
  rules:
    - condition: { state: "on" }
      apply: { style_preset: button_lozenge }
    
    - condition: { state: "off" }
      apply: 
        style_preset: button_lozenge
        inline_styles:
          opacity: 0.5
    
    - condition: { state: "unavailable" }
      apply: { style_preset: unavailable }
```

**Acceptance Criteria:**
- ✅ YAML format defined and documented
- ✅ Base presets created
- ✅ Component-specific presets created
- ✅ Theme definitions included
- ✅ Inheritance examples provided
- ✅ Usage examples documented

---

## 3.4: Implement Theme Manager

**Purpose:** Runtime theme switching and CSS variable management

**File:** `src/core/styling/theme-manager.js`

```javascript
/**
 * ThemeManager - Runtime Theme Management
 * 
 * Manages active theme and CSS variable updates
 * Provides smooth transitions between themes
 * Integrates with StyleLibrary for theme definitions
 * 
 * USAGE:
 * themeManager.setTheme('red_alert');
 * themeManager.transitionTheme('green_alert', { duration: 1000 });
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ThemeManager {
    constructor(styleLibrary) {
        this.styleLibrary = styleLibrary;
        this._currentTheme = null;
        this._transitionInProgress = false;
        
        cblcarsLog.info('[ThemeManager] Initialized');
    }

    /**
     * Set theme immediately
     * 
     * @param {string} themeName - Theme name
     */
    setTheme(themeName) {
        if (this._transitionInProgress) {
            cblcarsLog.warn('[ThemeManager] Transition in progress, cancelling');
        }

        const theme = this.styleLibrary.getTheme(themeName);
        if (!theme) {
            cblcarsLog.error(`[ThemeManager] Theme '${themeName}' not found`);
            return;
        }

        // Apply CSS variables
        this._applyCSSVariables(theme);
        
        this._currentTheme = themeName;
        
        cblcarsLog.info(`[ThemeManager] Theme set to: ${themeName}`);
        
        // Publish event
        window.cblcars.eventBus?.publish('theme.changed', {
            theme: themeName,
            transition: false
        });
    }

    /**
     * Transition to theme with animation
     * 
     * @param {string} themeName - Theme name
     * @param {Object} options - Transition options
     * @param {number} options.duration - Duration in ms (default: 1000)
     * @param {string} options.easing - Easing function (default: 'linear')
     */
    async transitionTheme(themeName, options = {}) {
        if (this._transitionInProgress) {
            cblcarsLog.warn('[ThemeManager] Transition already in progress');
            return;
        }

        const theme = this.styleLibrary.getTheme(themeName);
        if (!theme) {
            cblcarsLog.error(`[ThemeManager] Theme '${themeName}' not found`);
            return;
        }

        const duration = options.duration || 1000;
        const easing = options.easing || 'linear';

        this._transitionInProgress = true;

        try {
            // Get current values
            const currentValues = this._getCurrentCSSVariables(theme);
            
            // Animate transition
            await this._animateTransition(currentValues, theme, duration, easing);
            
            this._currentTheme = themeName;
            
            cblcarsLog.info(`[ThemeManager] Transitioned to theme: ${themeName}`);
            
            // Publish event
            window.cblcars.eventBus?.publish('theme.changed', {
                theme: themeName,
                transition: true,
                duration
            });
            
        } finally {
            this._transitionInProgress = false;
        }
    }

    /**
     * Apply CSS variables to document root
     * @private
     * 
     * @param {Object} theme - Theme object
     */
    _applyCSSVariables(theme) {
        for (const [varName, value] of Object.entries(theme)) {
            document.documentElement.style.setProperty(`--${varName}`, value);
        }
    }

    /**
     * Get current CSS variable values
     * @private
     * 
     * @param {Object} theme - Theme to get variables for
     * @returns {Object} Current values
     */
    _getCurrentCSSVariables(theme) {
        const current = {};
        const computedStyle = getComputedStyle(document.documentElement);
        
        for (const varName of Object.keys(theme)) {
            const value = computedStyle.getPropertyValue(`--${varName}`).trim();
            current[varName] = value;
        }
        
        return current;
    }

    /**
     * Animate CSS variable transition
     * @private
     * 
     * @param {Object} fromValues - Starting values
     * @param {Object} toValues - Target values
     * @param {number} duration - Duration in ms
     * @param {string} easing - Easing function
     */
    async _animateTransition(fromValues, toValues, duration, easing) {
        // Use anime.js for color interpolation
        const targets = { progress: 0 };
        
        await window.cblcars.anim.anime(targets, {
            progress: 1,
            duration,
            easing,
            update: () => {
                const progress = targets.progress;
                
                for (const [varName, toValue] of Object.entries(toValues)) {
                    const fromValue = fromValues[varName];
                    if (!fromValue) continue;
                    
                    // Interpolate color
                    const color = this._interpolateColor(fromValue, toValue, progress);
                    document.documentElement.style.setProperty(`--${varName}`, color);
                }
            }
        }).finished;
    }

    /**
     * Interpolate between two colors
     * @private
     * 
     * @param {string} from - Starting color (hex)
     * @param {string} to - Target color (hex)
     * @param {number} progress - Progress (0-1)
     * @returns {string} Interpolated color (hex)
     */
    _interpolateColor(from, to, progress) {
        // Parse hex colors
        const fromRGB = this._hexToRGB(from);
        const toRGB = this._hexToRGB(to);
        
        if (!fromRGB || !toRGB) {
            return to;  // Fallback
        }
        
        // Interpolate RGB channels
        const r = Math.round(fromRGB.r + (toRGB.r - fromRGB.r) * progress);
        const g = Math.round(fromRGB.g + (toRGB.g - fromRGB.g) * progress);
        const b = Math.round(fromRGB.b + (toRGB.b - fromRGB.b) * progress);
        
        // Convert back to hex
        return this._rgbToHex(r, g, b);
    }

    /**
     * Convert hex color to RGB
     * @private
     * 
     * @param {string} hex - Hex color
     * @returns {Object|null} RGB object or null
     */
    _hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Convert RGB to hex color
     * @private
     * 
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {string} Hex color
     */
    _rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Get current theme name
     * 
     * @returns {string|null} Current theme name
     */
    getCurrentTheme() {
        return this._currentTheme;
    }

    /**
     * Check if transition is in progress
     * 
     * @returns {boolean} True if transitioning
     */
    isTransitioning() {
        return this._transitionInProgress;
    }
}
```

**Acceptance Criteria:**
- ✅ ThemeManager class created
- ✅ Immediate theme switching works
- ✅ Animated theme transitions work
- ✅ Color interpolation functional
- ✅ Event publishing on theme change
- ✅ Transition state tracking

---

## 3.5: Create Condition Evaluator

**Purpose:** Evaluate rule conditions with complex logic

**File:** `src/core/rules-engine/condition-evaluator.js`

```javascript
/**
 * ConditionEvaluator - Rule Condition Evaluation Logic
 * 
 * Evaluates various condition types:
 * - Simple state matching
 * - Attribute comparisons
 * - Numeric ranges
 * - Regular expressions
 * - Logical operators (AND, OR, NOT)
 * - Custom predicates
 * 
 * USAGE:
 * const evaluator = new ConditionEvaluator();
 * const matches = evaluator.evaluate(condition, context);
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ConditionEvaluator {
    /**
     * Evaluate a condition
     * 
     * @param {Object} condition - Condition definition
     * @param {Object} context - Evaluation context (entity, custom vars, etc.)
     * @returns {boolean} True if condition matches
     */
    evaluate(condition, context) {
        if (!condition) {
            return false;
        }

        // Logical operators
        if (condition.and) {
            return this._evaluateAND(condition.and, context);
        }
        if (condition.or) {
            return this._evaluateOR(condition.or, context);
        }
        if (condition.not) {
            return !this.evaluate(condition.not, context);
        }

        // Get entity state
        const entity = this._resolveEntity(condition.entity, context);
        if (!entity) {
            cblcarsLog.debug('[ConditionEvaluator] Entity not found:', condition.entity);
            return false;
        }

        // Get value to evaluate (state or attribute)
        let value;
        if (condition.attribute) {
            value = entity.attributes?.[condition.attribute];
            
            // Special handling for brightness (convert 0-255 to 0-100)
            if (condition.attribute === 'brightness' && value !== undefined && value !== null) {
                value = (value / 256) * 100;
            }
        } else {
            value = entity.state;
        }

        // Evaluate condition types
        
        // 1. Exact match (equals)
        if ('equals' in condition) {
            return value == condition.equals;
        }

        // 2. Not equals
        if ('not_equals' in condition) {
            return value != condition.not_equals;
        }

        // 3. Simple state match (shorthand for equals)
        if ('state' in condition) {
            if (Array.isArray(condition.state)) {
                return condition.state.includes(value);
            }
            return value == condition.state;
        }

        // 4. Numeric range (from/to)
        if ('from' in condition || 'to' in condition) {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return false;
            }
            
            const from = 'from' in condition ? condition.from : -Infinity;
            const to = 'to' in condition ? condition.to : Infinity;
            
            return numValue >= from && numValue <= to;
        }

        // 5. In array
        if ('in' in condition && Array.isArray(condition.in)) {
            return condition.in.includes(value);
        }

        // 6. Not in array
        if ('not_in' in condition && Array.isArray(condition.not_in)) {
            return !condition.not_in.includes(value);
        }

        // 7. Regular expression
        if ('regex' in condition) {
            try {
                const regex = new RegExp(condition.regex);
                return regex.test(String(value));
            } catch (error) {
                cblcarsLog.error('[ConditionEvaluator] Invalid regex:', error);
                return false;
            }
        }

        // 8. State regex (shorthand)
        if ('state_regex' in condition) {
            try {
                const regex = new RegExp(condition.state_regex);
                return regex.test(String(value));
            } catch (error) {
                cblcarsLog.error('[ConditionEvaluator] Invalid state_regex:', error);
                return false;
            }
        }

        // 9. Greater than
        if ('greater_than' in condition) {
            const numValue = parseFloat(value);
            return !isNaN(numValue) && numValue > condition.greater_than;
        }

        // 10. Less than
        if ('less_than' in condition) {
            const numValue = parseFloat(value);
            return !isNaN(numValue) && numValue < condition.less_than;
        }

        // 11. Custom predicate function
        if (typeof condition.predicate === 'function') {
            try {
                return condition.predicate(value, entity, context);
            } catch (error) {
                cblcarsLog.error('[ConditionEvaluator] Error in predicate function:', error);
                return false;
            }
        }

        // No recognized condition
        cblcarsLog.warn('[ConditionEvaluator] Unrecognized condition format:', condition);
        return false;
    }

    /**
     * Evaluate AND conditions (all must match)
     * @private
     * 
     * @param {Array} conditions - Array of conditions
     * @param {Object} context - Context
     * @returns {boolean} True if all match
     */
    _evaluateAND(conditions, context) {
        if (!Array.isArray(conditions)) {
            return false;
        }
        
        return conditions.every(cond => this.evaluate(cond, context));
    }

    /**
     * Evaluate OR conditions (any must match)
     * @private
     * 
     * @param {Array} conditions - Array of conditions
     * @param {Object} context - Context
     * @returns {boolean} True if any match
     */
    _evaluateOR(conditions, context) {
        if (!Array.isArray(conditions)) {
            return false;
        }
        
        return conditions.some(cond => this.evaluate(cond, context));
    }

    /**
     * Resolve entity from condition or context
     * @private
     * 
     * @param {string} entityRef - Entity reference
     * @param {Object} context - Context
     * @returns {Object|null} Entity state
     */
    _resolveEntity(entityRef, context) {
        // If entity specified in condition, use it
        if (entityRef && context.hass?.states?.[entityRef]) {
            return context.hass.states[entityRef];
        }
        
        // Otherwise use context entity
        return context.entity || null;
    }
}
```

**Usage Examples:**

```yaml
# Simple state match
condition: { state: "on" }

# Multiple states
condition: { state: [on, open, locked] }

# Attribute range
condition:
  attribute: brightness
  from: 50
  to: 100

# Regex match
condition:
  state_regex: "^(on|open)$"

# Logical AND
condition:
  and:
    - { state: "on" }
    - { attribute: brightness, from: 200 }

# Logical OR
condition:
  or:
    - { state: "unavailable" }
    - { state: "unknown" }

# Logical NOT
condition:
  not: { state: "off" }

# Complex logic
condition:
  and:
    - { state: "on" }
    - or:
        - { attribute: brightness, from: 0, to: 50 }
        - { attribute: color_temp, from: 400, to: 500 }
```

**Acceptance Criteria:**
- ✅ ConditionEvaluator class created
- ✅ All condition types supported
- ✅ Logical operators (AND, OR, NOT) work
- ✅ Attribute evaluation functional
- ✅ Numeric range comparisons work
- ✅ Regex matching functional
- ✅ Entity resolution correct

---

## 3.6: Test Rules in Standalone Cards

**Purpose:** Verify rules engine works outside of MSD

### Test Configurations

#### Test 1: Simple Button with Rules

```yaml
type: cb-lcars-button-card
entity: light.desk
variables:
  rules:
    - condition: { state: "on" }
      apply:
        style_preset: active
        animation: pulse
    
    - condition: { state: "off" }
      apply:
        style_preset: inactive
    
    - condition: { state: "unavailable" }
      apply:
        style_preset: error
```

#### Test 2: Complex Rules with Attributes

```yaml
type: cb-lcars-button-card
entity: light.desk
variables:
  rules:
    # Bright
    - condition:
        state: "on"
        attribute: brightness
        from: 200
        to: 255
      apply:
        style_preset: button_lozenge
        inline_styles:
          color: var(--lcars-orange)
          font_weight: bold
    
    # Dim
    - condition:
        state: "on"
        attribute: brightness
        from: 0
        to: 199
      apply:
        style_preset: button_lozenge
        inline_styles:
          opacity: 0.7
    
    # Off
    - condition: { state: "off" }
      apply:
        style_preset: inactive
```

#### Test 3: Multi-Card Theme Switching

```yaml
# Button 1 - Changes theme
- type: cb-lcars-button-card
  name: "RED ALERT"
  tap_action:
    action: call-service
    service: script.set_theme
    service_data:
      theme: red_alert
  variables:
    event_subscriptions:
      - event_type: theme.changed
        callback: handleThemeChange

# Button 2 - Reacts to theme
- type: cb-lcars-button-card
  entity: light.desk
  variables:
    rules:
      - condition: { state: "on" }
        apply:
          style_preset: active
          # Color comes from active theme
```

### Testing Checklist

- ✅ Rules evaluate correctly in standalone cards
- ✅ Style presets applied
- ✅ Inline style overrides work
- ✅ Animation triggers functional
- ✅ Complex conditions (AND/OR/NOT) work
- ✅ Attribute-based rules work
- ✅ Theme switching affects all cards
- ✅ Event bus integration functional
- ✅ Performance acceptable

---

## 3.7: Performance Optimization

**Purpose:** Ensure rules engine performs well with many cards

### Optimization Strategies

#### 1. Result Caching

Already implemented in RulesEngine via `_lastResult` and `_lastStateSignature`.

**Test:** Verify cache hit rate is high for rapid state updates.

#### 2. Lazy Preset Resolution

```javascript
// In RulesEngine._buildResult()
// Only resolve presets when actually needed
if (result.stylePreset && this.styleLibrary) {
    // Lazy evaluation - only on first access
    Object.defineProperty(result, 'resolvedStyles', {
        get: () => {
            if (!this._cachedResolvedStyles) {
                this._cachedResolvedStyles = this.styleLibrary.getPreset(result.stylePreset);
            }
            return this._cachedResolvedStyles;
        },
        enumerable: true
    });
}
```

#### 3. Condition Short-Circuiting

Already implemented via `&&` and `||` operators.

**Test:** Verify OR conditions stop at first match.

#### 4. Debounced Evaluation

For high-frequency updates (e.g., brightness slider):

```javascript
// In card update handler
this._debouncedEvaluateRules = this._debounce(() => {
    const result = this._pipeline.evaluateRules(this._config.entity);
    this._applyRuleResult(result);
}, 50);  // 50ms debounce
```

### Performance Benchmarks

**Target Metrics:**
- Rule evaluation: < 1ms per card
- Style preset resolution: < 0.5ms
- Theme switching: < 100ms for 50 cards
- Memory overhead: < 10KB per card

**Testing Methodology:**
```javascript
// Performance test
console.time('Rule Evaluation');
for (let i = 0; i < 1000; i++) {
    engine.evaluate(entityState, context);
}
console.timeEnd('Rule Evaluation');
// Target: < 1000ms for 1000 evaluations
```

**Acceptance Criteria:**
- ✅ Evaluation time < 1ms per card
- ✅ Cache hit rate > 90%
- ✅ No memory leaks
- ✅ Theme switching smooth
- ✅ Dashboard responsive with 50+ cards

---

## Phase 3 Completion Criteria

### Functional Requirements
- ✅ RulesEngine extracted and working
- ✅ StyleLibrary with preset system functional
- ✅ YAML format defined and documented
- ✅ ThemeManager with transitions working
- ✅ ConditionEvaluator supporting all condition types
- ✅ Rules working in standalone cards
- ✅ Performance optimized

### Technical Requirements
- ✅ Per-card RulesEngine instances
- ✅ Shared StyleLibrary reference
- ✅ Preset inheritance (extends) works
- ✅ CSS variable resolution functional
- ✅ Theme switching doesn't break state
- ✅ Event bus integration complete
- ✅ JSDoc documentation complete

### Testing Requirements
- ✅ Unit tests for ConditionEvaluator
- ✅ Integration tests for rules + presets
- ✅ Theme switching tests
- ✅ Performance benchmarks passing
- ✅ Memory leak testing
- ✅ Cross-card coordination tests

### Migration Requirements
- ✅ Legacy button-card state blocks still work
- ✅ New rule format available as alternative
- ✅ Migration guide written
- ✅ Example configurations provided
- ✅ Backward compatibility maintained

---

**End of Phase 3**