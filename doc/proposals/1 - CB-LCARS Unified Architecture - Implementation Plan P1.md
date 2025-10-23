# CB-LCARS Unified Architecture - Implementation Phase 3

**Phase 3: Rules Engine & Style Library**

**Goal:** Extract rules engine and style library from MSD for use across all cards

**Priority:** Medium - Required for replacing button-card state blocks

---

## Phase 3 Tasks Overview

```
Phase 3: Rules Engine & Style Library
├─ 3.1: Extract Rules Engine from MSD
├─ 3.2: Build Condition Evaluator System
├─ 3.3: Create Style Library Infrastructure
├─ 3.4: Implement YAML Preset Format
├─ 3.5: Build Theme Manager
├─ 3.6: Integrate with CBLCARSBaseCard
└─ 3.7: Create Migration Helper for Legacy States
```

---

## 3.1: Extract Rules Engine from MSD

**Purpose:** Centralized rule evaluation system for all cards

**Current State:** Rules logic exists within MSD for overlay state management

**Target State:** Standalone rules engine usable by all CB-LCARS cards

### Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                     RulesEngine                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Condition Evaluator                         │ │
│  │  • state matching                                     │ │
│  │  • attribute ranges                                   │ │
│  │  • regex patterns                                     │ │
│  │  • logical operators (AND, OR, NOT)                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                          │                                  │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │           Style Resolver                             │ │
│  │  • preset lookup                                      │ │
│  │  • inline styles                                      │ │
│  │  • style merging                                      │ │
│  │  • animation triggers                                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                          │                                  │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │           Result Builder                             │ │
│  │  • match tracking                                     │ │
│  │  • priority resolution                                │ │
│  │  • custom data pass-through                          │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Code: RulesEngine Class

**File:** `src/core/rules-engine/index.js`

```javascript
/**
 * RulesEngine - Declarative State-Based Rule Evaluation
 * 
 * Replaces button-card state blocks with declarative YAML rules
 * Supports complex conditions, style presets, and animations
 * 
 * FEATURES:
 * - Multiple condition types (state, attribute, numeric, regex)
 * - Logical operators (AND, OR, NOT)
 * - Style preset application
 * - Animation triggers
 * - Priority-based rule matching
 * - Custom context variables
 * 
 * USAGE:
 * const engine = new RulesEngine(rules, styleLibrary, animPresets);
 * const result = engine.evaluate(entityState, customContext);
 * // result: { matched, stylePreset, inlineStyles, animation, customData }
 * 
 * @example
 * const rules = [
 *   {
 *     condition: { state: 'on', attribute: 'brightness', from: 200, to: 255 },
 *     apply: { style_preset: 'active_bright', animation: 'pulse' }
 *   },
 *   {
 *     condition: { state: 'off' },
 *     apply: { style_preset: 'inactive' }
 *   }
 * ];
 * 
 * const result = engine.evaluate(entityState);
 * if (result.matched) {
 *   applyStyles(element, result);
 * }
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { RuleMatcher } from './rule-matcher.js';

export class RulesEngine {
    /**
     * Create a rules engine instance
     * 
     * @param {Array<Object>} rules - Array of rule definitions
     * @param {StyleLibrary} styleLibrary - Style library reference (optional)
     * @param {AnimationPresets} animationPresets - Animation presets reference (optional)
     */
    constructor(rules = [], styleLibrary = null, animationPresets = null) {
        this.rules = rules;
        this.styleLibrary = styleLibrary;
        this.animationPresets = animationPresets;
        
        // Create condition evaluator
        this.conditionEvaluator = new ConditionEvaluator();
        
        // Create rule matcher
        this.ruleMatcher = new RuleMatcher(this.conditionEvaluator);
        
        // Cache for performance
        this._cache = new Map();
        this._cacheEnabled = true;
        
        cblcarsLog.debug(`[RulesEngine] Initialized with ${rules.length} rules`);
    }

    /**
     * Evaluate rules against entity state
     * 
     * @param {Object} entityState - Home Assistant entity state object
     * @param {Object} customContext - Custom context variables (optional)
     * @returns {RuleResult} Evaluation result
     */
    evaluate(entityState, customContext = {}) {
        if (!entityState) {
            return this._createEmptyResult();
        }

        // Check cache
        const cacheKey = this._getCacheKey(entityState, customContext);
        if (this._cacheEnabled && this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        // Find first matching rule
        const matchedRule = this.ruleMatcher.findFirstMatch(
            this.rules,
            entityState,
            customContext
        );

        // Build result
        const result = this._buildResult(matchedRule, entityState, customContext);

        // Cache result
        if (this._cacheEnabled) {
            this._cache.set(cacheKey, result);
            
            // Limit cache size
            if (this._cache.size > 1000) {
                const firstKey = this._cache.keys().next().value;
                this._cache.delete(firstKey);
            }
        }

        return result;
    }

    /**
     * Evaluate all rules and return all matches
     * (vs evaluate() which returns only first match)
     * 
     * @param {Object} entityState - Home Assistant entity state object
     * @param {Object} customContext - Custom context variables (optional)
     * @returns {Array<RuleResult>} Array of matching rule results
     */
    evaluateAll(entityState, customContext = {}) {
        if (!entityState) {
            return [];
        }

        const matches = this.ruleMatcher.findAllMatches(
            this.rules,
            entityState,
            customContext
        );

        return matches.map(rule => this._buildResult(rule, entityState, customContext));
    }

    /**
     * Build result object from matched rule
     * @private
     * 
     * @param {Object|null} rule - Matched rule or null
     * @param {Object} entityState - Entity state
     * @param {Object} customContext - Custom context
     * @returns {RuleResult} Result object
     */
    _buildResult(rule, entityState, customContext) {
        if (!rule) {
            return this._createEmptyResult();
        }

        const apply = rule.apply || {};
        const result = {
            matched: true,
            rule: rule,
            
            // Style information
            stylePreset: apply.style_preset || null,
            inlineStyles: apply.inline_styles || apply.styles || null,
            
            // Animation information
            animation: apply.animation || null,
            animationPreset: apply.animation_preset || null,
            
            // Custom data pass-through
            customData: apply.custom_data || null,
            
            // Rule metadata
            ruleId: rule.id || null,
            priority: rule.priority || 0
        };

        // Resolve style preset if provided and library available
        if (result.stylePreset && this.styleLibrary) {
            try {
                const presetStyles = this.styleLibrary.getPreset(result.stylePreset);
                
                // Merge preset styles with inline styles (inline takes precedence)
                if (presetStyles) {
                    result.resolvedStyles = {
                        ...presetStyles,
                        ...(result.inlineStyles || {})
                    };
                } else {
                    cblcarsLog.warn(`[RulesEngine] Style preset not found: ${result.stylePreset}`);
                    result.resolvedStyles = result.inlineStyles || {};
                }
            } catch (error) {
                cblcarsLog.error('[RulesEngine] Error resolving style preset:', error);
                result.resolvedStyles = result.inlineStyles || {};
            }
        } else {
            result.resolvedStyles = result.inlineStyles || {};
        }

        // Resolve animation preset if provided and library available
        if (result.animationPreset && this.animationPresets) {
            try {
                result.resolvedAnimation = this.animationPresets.getPreset(result.animationPreset);
            } catch (error) {
                cblcarsLog.error('[RulesEngine] Error resolving animation preset:', error);
            }
        }

        return result;
    }

    /**
     * Create empty result object
     * @private
     * 
     * @returns {RuleResult} Empty result
     */
    _createEmptyResult() {
        return {
            matched: false,
            rule: null,
            stylePreset: null,
            inlineStyles: null,
            resolvedStyles: {},
            animation: null,
            animationPreset: null,
            resolvedAnimation: null,
            customData: null,
            ruleId: null,
            priority: 0
        };
    }

    /**
     * Generate cache key for entity state and context
     * @private
     * 
     * @param {Object} entityState - Entity state
     * @param {Object} customContext - Custom context
     * @returns {string} Cache key
     */
    _getCacheKey(entityState, customContext) {
        // Create key from entity state and context
        const stateKey = `${entityState.entity_id}:${entityState.state}:${entityState.last_changed}`;
        const contextKey = Object.keys(customContext).length > 0 
            ? JSON.stringify(customContext) 
            : '';
        
        return `${stateKey}:${contextKey}`;
    }

    /**
     * Clear evaluation cache
     */
    clearCache() {
        this._cache.clear();
        cblcarsLog.debug('[RulesEngine] Cache cleared');
    }

    /**
     * Enable/disable caching
     * 
     * @param {boolean} enabled - Whether to enable caching
     */
    setCacheEnabled(enabled) {
        this._cacheEnabled = enabled;
        if (!enabled) {
            this.clearCache();
        }
    }

    /**
     * Add rules dynamically
     * 
     * @param {Array<Object>} newRules - Rules to add
     */
    addRules(newRules) {
        this.rules.push(...newRules);
        this.clearCache();
        cblcarsLog.debug(`[RulesEngine] Added ${newRules.length} rules (total: ${this.rules.length})`);
    }

    /**
     * Remove rules by ID
     * 
     * @param {Array<string>} ruleIds - Rule IDs to remove
     */
    removeRules(ruleIds) {
        const idSet = new Set(ruleIds);
        const before = this.rules.length;
        this.rules = this.rules.filter(rule => !idSet.has(rule.id));
        const removed = before - this.rules.length;
        this.clearCache();
        cblcarsLog.debug(`[RulesEngine] Removed ${removed} rules (remaining: ${this.rules.length})`);
    }

    /**
     * Get all rule IDs
     * 
     * @returns {Array<string>} Array of rule IDs
     */
    getRuleIds() {
        return this.rules.map(rule => rule.id).filter(id => id);
    }

    /**
     * Cleanup
     */
    destroy() {
        this.clearCache();
        this.rules = [];
        cblcarsLog.debug('[RulesEngine] Destroyed');
    }
}

/**
 * RuleResult - Result of rule evaluation
 * 
 * @typedef {Object} RuleResult
 * @property {boolean} matched - Whether a rule matched
 * @property {Object|null} rule - The matched rule object
 * @property {string|null} stylePreset - Name of style preset to apply
 * @property {Object|null} inlineStyles - Inline styles to apply
 * @property {Object} resolvedStyles - Resolved final styles (preset + inline)
 * @property {string|null} animation - Animation name to trigger
 * @property {string|null} animationPreset - Animation preset name
 * @property {Object|null} resolvedAnimation - Resolved animation config
 * @property {any} customData - Custom data from rule
 * @property {string|null} ruleId - ID of matched rule
 * @property {number} priority - Priority of matched rule
 */
```

**Acceptance Criteria:**
- ✅ RulesEngine class created
- ✅ Supports style preset resolution
- ✅ Supports animation preset resolution
- ✅ Caching implemented for performance
- ✅ Can add/remove rules dynamically
- ✅ Proper error handling

---

## 3.2: Build Condition Evaluator System

**Purpose:** Evaluate complex conditions against entity state

### Code: ConditionEvaluator Class

**File:** `src/core/rules-engine/condition-evaluator.js`

```javascript
/**
 * ConditionEvaluator - Evaluates Rule Conditions
 * 
 * Supports multiple condition types:
 * - State matching (equals, in, not_equals, not_in)
 * - Attribute values
 * - Numeric ranges (from/to)
 * - Regex patterns
 * - Logical operators (AND, OR, NOT)
 * - Template expressions
 * 
 * @example
 * const evaluator = new ConditionEvaluator();
 * 
 * // Simple state match
 * evaluator.evaluate({ state: 'on' }, entityState);
 * 
 * // Attribute range
 * evaluator.evaluate({ attribute: 'brightness', from: 100, to: 200 }, entityState);
 * 
 * // Logical operators
 * evaluator.evaluate({
 *   or: [
 *     { state: 'on' },
 *     { state: 'open' }
 *   ]
 * }, entityState);
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ConditionEvaluator {
    constructor() {
        // Condition type handlers
        this._handlers = {
            state: this._evaluateState.bind(this),
            attribute: this._evaluateAttribute.bind(this),
            regex: this._evaluateRegex.bind(this),
            template: this._evaluateTemplate.bind(this),
            and: this._evaluateAnd.bind(this),
            or: this._evaluateOr.bind(this),
            not: this._evaluateNot.bind(this)
        };
    }

    /**
     * Evaluate a condition against entity state
     * 
     * @param {Object} condition - Condition to evaluate
     * @param {Object} entityState - Entity state object
     * @param {Object} context - Additional context (optional)
     * @returns {boolean} True if condition matches
     */
    evaluate(condition, entityState, context = {}) {
        if (!condition || !entityState) {
            return false;
        }

        try {
            return this._evaluateCondition(condition, entityState, context);
        } catch (error) {
            cblcarsLog.error('[ConditionEvaluator] Error evaluating condition:', error);
            return false;
        }
    }

    /**
     * Internal condition evaluation with type detection
     * @private
     */
    _evaluateCondition(condition, entityState, context) {
        // Logical operators
        if (condition.and) return this._evaluateAnd(condition.and, entityState, context);
        if (condition.or) return this._evaluateOr(condition.or, entityState, context);
        if (condition.not) return this._evaluateNot(condition.not, entityState, context);

        // Template evaluation
        if (condition.template) return this._evaluateTemplate(condition.template, entityState, context);

        // Entity validation
        if (condition.entity && condition.entity !== entityState.entity_id) {
            return false; // Condition is for different entity
        }

        // State-based conditions
        let matches = true;

        // State matching
        if ('state' in condition || 'equals' in condition) {
            matches = matches && this._evaluateState(condition, entityState, context);
        }

        if ('not_equals' in condition) {
            matches = matches && this._evaluateNotEquals(condition, entityState, context);
        }

        if ('in' in condition) {
            matches = matches && this._evaluateIn(condition, entityState, context);
        }

        if ('not_in' in condition) {
            matches = matches && this._evaluateNotIn(condition, entityState, context);
        }

        // Attribute matching
        if ('attribute' in condition) {
            matches = matches && this._evaluateAttribute(condition, entityState, context);
        }

        // Regex matching
        if ('state_regex' in condition || 'regex' in condition) {
            matches = matches && this._evaluateRegex(condition, entityState, context);
        }

        return matches;
    }

    /**
     * Evaluate state equals condition
     * @private
     */
    _evaluateState(condition, entityState, context) {
        const targetState = condition.state || condition.equals;
        const currentState = entityState.state;

        // Array of possible states
        if (Array.isArray(targetState)) {
            return targetState.includes(currentState);
        }

        // Single state
        return currentState == targetState;
    }

    /**
     * Evaluate state not equals condition
     * @private
     */
    _evaluateNotEquals(condition, entityState, context) {
        const targetState = condition.not_equals;
        const currentState = entityState.state;

        if (Array.isArray(targetState)) {
            return !targetState.includes(currentState);
        }

        return currentState != targetState;
    }

    /**
     * Evaluate state in list condition
     * @private
     */
    _evaluateIn(condition, entityState, context) {
        const list = condition.in;
        const currentState = entityState.state;

        if (!Array.isArray(list)) {
            cblcarsLog.warn('[ConditionEvaluator] "in" condition must be an array');
            return false;
        }

        return list.includes(currentState);
    }

    /**
     * Evaluate state not in list condition
     * @private
     */
    _evaluateNotIn(condition, entityState, context) {
        const list = condition.not_in;
        const currentState = entityState.state;

        if (!Array.isArray(list)) {
            cblcarsLog.warn('[ConditionEvaluator] "not_in" condition must be an array');
            return false;
        }

        return !list.includes(currentState);
    }

    /**
     * Evaluate attribute condition
     * @private
     */
    _evaluateAttribute(condition, entityState, context) {
        const attrName = condition.attribute;
        const attrValue = entityState.attributes?.[attrName];

        if (attrValue === undefined) {
            return false;
        }

        // Numeric attribute value
        const numericValue = parseFloat(attrValue);
        const isNumeric = !isNaN(numericValue);

        // Check equals
        if ('equals' in condition) {
            return attrValue == condition.equals;
        }

        // Check range (from/to)
        if (isNumeric && ('from' in condition || 'to' in condition)) {
            const from = condition.from !== undefined ? condition.from : -Infinity;
            const to = condition.to !== undefined ? condition.to : Infinity;
            
            return numericValue >= from && numericValue <= to;
        }

        // Check in/not_in for attributes
        if ('in' in condition) {
            return Array.isArray(condition.in) && condition.in.includes(attrValue);
        }

        if ('not_in' in condition) {
            return Array.isArray(condition.not_in) && !condition.not_in.includes(attrValue);
        }

        return true;
    }

    /**
     * Evaluate regex condition
     * @private
     */
    _evaluateRegex(condition, entityState, context) {
        const pattern = condition.state_regex || condition.regex;
        const value = condition.attribute 
            ? entityState.attributes?.[condition.attribute]
            : entityState.state;

        if (!pattern || value === undefined) {
            return false;
        }

        try {
            const regex = new RegExp(pattern);
            return regex.test(String(value));
        } catch (error) {
            cblcarsLog.error('[ConditionEvaluator] Invalid regex pattern:', error);
            return false;
        }
    }

    /**
     * Evaluate template condition
     * @private
     */
    _evaluateTemplate(template, entityState, context) {
        // Template evaluation would use Home Assistant's template engine
        // For now, support simple JavaScript evaluation
        
        if (typeof template === 'function') {
            try {
                return Boolean(template(entityState, context));
            } catch (error) {
                cblcarsLog.error('[ConditionEvaluator] Template function error:', error);
                return false;
            }
        }

        if (typeof template === 'string') {
            // Simple variable substitution
            try {
                // Create safe evaluation context
                const evalContext = {
                    state: entityState.state,
                    attributes: entityState.attributes,
                    entity_id: entityState.entity_id,
                    context: context,
                    // Helper functions
                    includes: (arr, val) => arr.includes(val),
                    matches: (str, pattern) => new RegExp(pattern).test(str)
                };

                // Evaluate template (basic implementation)
                const result = new Function('ctx', `with(ctx) { return ${template}; }`)(evalContext);
                return Boolean(result);
            } catch (error) {
                cblcarsLog.error('[ConditionEvaluator] Template evaluation error:', error);
                return false;
            }
        }

        return false;
    }

    /**
     * Evaluate AND condition (all must match)
     * @private
     */
    _evaluateAnd(conditions, entityState, context) {
        if (!Array.isArray(conditions)) {
            cblcarsLog.warn('[ConditionEvaluator] AND condition must be an array');
            return false;
        }

        return conditions.every(cond => this._evaluateCondition(cond, entityState, context));
    }

    /**
     * Evaluate OR condition (any must match)
     * @private
     */
    _evaluateOr(conditions, entityState, context) {
        if (!Array.isArray(conditions)) {
            cblcarsLog.warn('[ConditionEvaluator] OR condition must be an array');
            return false;
        }

        return conditions.some(cond => this._evaluateCondition(cond, entityState, context));
    }

    /**
     * Evaluate NOT condition (must not match)
     * @private
     */
    _evaluateNot(condition, entityState, context) {
        return !this._evaluateCondition(condition, entityState, context);
    }
}
```

### Code: RuleMatcher Class

**File:** `src/core/rules-engine/rule-matcher.js`

```javascript
/**
 * RuleMatcher - Finds Matching Rules
 * 
 * Handles rule matching with priority and ordering
 * Supports first-match and all-matches modes
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class RuleMatcher {
    /**
     * Create rule matcher
     * 
     * @param {ConditionEvaluator} conditionEvaluator - Condition evaluator instance
     */
    constructor(conditionEvaluator) {
        this.conditionEvaluator = conditionEvaluator;
    }

    /**
     * Find first matching rule
     * Rules are evaluated in order, first match wins
     * 
     * @param {Array<Object>} rules - Array of rules
     * @param {Object} entityState - Entity state
     * @param {Object} context - Custom context
     * @returns {Object|null} First matching rule or null
     */
    findFirstMatch(rules, entityState, context = {}) {
        if (!rules || rules.length === 0) {
            return null;
        }

        // Sort by priority (higher priority first)
        const sortedRules = this._sortByPriority(rules);

        for (const rule of sortedRules) {
            if (!rule.condition) {
                cblcarsLog.warn('[RuleMatcher] Rule missing condition:', rule);
                continue;
            }

            const matches = this.conditionEvaluator.evaluate(
                rule.condition,
                entityState,
                context
            );

            if (matches) {
                cblcarsLog.debug('[RuleMatcher] Rule matched:', rule.id || 'unnamed');
                return rule;
            }
        }

        return null;
    }

    /**
     * Find all matching rules
     * Returns all rules that match, in priority order
     * 
     * @param {Array<Object>} rules - Array of rules
     * @param {Object} entityState - Entity state
     * @param {Object} context - Custom context
     * @returns {Array<Object>} Array of matching rules
     */
    findAllMatches(rules, entityState, context = {}) {
        if (!rules || rules.length === 0) {
            return [];
        }

        const matches = [];

        for (const rule of rules) {
            if (!rule.condition) {
                cblcarsLog.warn('[RuleMatcher] Rule missing condition:', rule);
                continue;
            }

            const isMatch = this.conditionEvaluator.evaluate(
                rule.condition,
                entityState,
                context
            );

            if (isMatch) {
                matches.push(rule);
            }
        }

        // Sort by priority
        return this._sortByPriority(matches);
    }

    /**
     * Sort rules by priority
     * Higher priority comes first
     * @private
     * 
     * @param {Array<Object>} rules - Rules to sort
     * @returns {Array<Object>} Sorted rules
     */
    _sortByPriority(rules) {
        return [...rules].sort((a, b) => {
            const priorityA = a.priority || 0;
            const priorityB = b.priority || 0;
            return priorityB - priorityA; // Descending order
        });
    }
}
```

**Acceptance Criteria:**
- ✅ ConditionEvaluator supports all condition types
- ✅ State matching works (equals, in, not_equals, not_in)
- ✅ Attribute matching works (equals, range, in, not_in)
- ✅ Regex matching works
- ✅ Logical operators work (AND, OR, NOT)
- ✅ Template evaluation works
- ✅ RuleMatcher finds first match correctly
- ✅ Priority sorting works

---

## 3.3: Create Style Library Infrastructure

**Purpose:** Centralized style definition and preset system

### Code: StyleLibrary Class

**File:** `src/core/styling/style-library.js`

```javascript
/**
 * StyleLibrary - Centralized Style Management
 * 
 * Manages style presets, themes, and runtime style resolution
 * Loads definitions from YAML configuration
 * Supports preset inheritance (extends) and overrides
 * 
 * FEATURES:
 * - YAML-defined presets
 * - Preset inheritance/extension
 * - Theme variants (alert conditions)
 * - Runtime theme switching
 * - Style merging and resolution
 * 
 * @example
 * const library = new StyleLibrary();
 * await library.loadFromYAML('/local/cb-lcars/styles.yaml');
 * 
 * const styles = library.getPreset('active');
 * // { color: 'var(--lcars-ui-secondary)', border_color: '...', ... }
 * 
 * library.setActiveTheme('red_alert');
 * const alertStyles = library.getPreset('active'); // Now with red theme colors
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { readYamlFile } from '../../utils/cb-lcars-fileutils.js';

export class StyleLibrary {
    constructor() {
        // Preset definitions
        this._presets = new Map();
        
        // Theme definitions
        this._themes = new Map();
        this._activeTheme = null;
        
        // Resolution cache
        this._cache = new Map();
        
        cblcarsLog.info('[StyleLibrary] Initialized');
    }

    /**
     * Load style definitions from YAML file
     * 
     * @param {string} url - URL to YAML file
     * @returns {Promise<void>}
     */
    async loadFromYAML(url) {
        try {
            cblcarsLog.info(`[StyleLibrary] Loading styles from ${url}`);
            
            const yaml = await readYamlFile(url);
            
            if (!yaml) {
                throw new Error('Failed to load YAML file');
            }

            // Load presets
            if (yaml.presets) {
                this._loadPresets(yaml.presets);
            }

            // Load themes
            if (yaml.themes) {
                this._loadThemes(yaml.themes);
            }

            // Set default theme
            if (yaml.default_theme) {
                this.setActiveTheme(yaml.default_theme);
            }

            cblcarsLog.info(`[StyleLibrary] Loaded ${this._presets.size} presets and ${this._themes.size} themes`);
            
        } catch (error) {
            cblcarsLog.error('[StyleLibrary] Error loading from YAML:', error);
            throw error;
        }
    }

    /**
     * Load preset definitions
     * @private
     * 
     * @param {Object} presets - Preset definitions from YAML
     */
    _loadPresets(presets) {
        for (const [name, definition] of Object.entries(presets)) {
            this._presets.set(name, definition);
        }
        
        // Clear cache when presets change
        this._cache.clear();
    }

    /**
     * Load theme definitions
     * @private
     * 
     * @param {Object} themes - Theme definitions from YAML
     */
    _loadThemes(themes) {
        for (const [name, definition] of Object.entries(themes)) {
            this._themes.set(name, definition);
        }
    }

    /**
     * Get a style preset by name
     * Resolves inheritance (extends) and applies active theme
     * 
     * @param {string} presetName - Name of preset to retrieve
     * @returns {Object|null} Resolved style object or null if not found
     */
    getPreset(presetName) {
        if (!presetName) {
            return null;
        }

        // Check cache
        const cacheKey = `${presetName}:${this._activeTheme || 'default'}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        // Resolve preset
        const resolved = this._resolvePreset(presetName);

        // Cache result
        if (resolved) {
            this._cache.set(cacheKey, resolved);
        }

        return resolved;
    }

    /**
     * Resolve a preset with inheritance
     * @private
     * 
     * @param {string} presetName - Preset name
     * @param {Set} visited - Set of visited presets (for cycle detection)
     * @returns {Object|null} Resolved preset
     */
    _resolvePreset(presetName, visited = new Set()) {
        // Prevent infinite loops
        if (visited.has(presetName)) {
            cblcarsLog.error(`[StyleLibrary] Circular dependency detected in preset: ${presetName}`);
            return null;
        }

        visited.add(presetName);

        const preset = this._presets.get(presetName);
        if (!preset) {
            cblcarsLog.warn(`[StyleLibrary] Preset not found: ${presetName}`);
            return null;
        }

        // No inheritance - return as is
        if (!preset.extends) {
            return this._applyThemeToPreset({ ...preset });
        }

        // Resolve parent preset
        const parent = this._resolvePreset(preset.extends, visited);
        if (!parent) {
            cblcarsLog.warn(`[StyleLibrary] Parent preset not found: ${preset.extends}`);
            return this._applyThemeToPreset({ ...preset });
        }

        // Merge parent and child (child overrides parent)
        const merged = {
            ...parent,
            ...preset
        };

        // Remove 'extends' from final result
        delete merged.extends;

        return this._applyThemeToPreset(merged);
    }

    /**
     * Apply active theme to preset
     * @private
     * 
     * @param {Object} preset - Preset object
     * @returns {Object} Preset with theme applied
     */
    _applyThemeToPreset(preset) {
        if (!this._activeTheme) {
            return preset;
        }

        const theme = this._themes.get(this._activeTheme);
        if (!theme) {
            return preset;
        }

        // Clone preset to avoid mutation
        const result = { ...preset };

        // Replace theme color variables
        // e.g., ${theme.primary} -> var(--lcars-red)
        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'string') {
                result[key] = this._replaceThemeVariables(value, theme);
            }
        }

        return result;
    }

    /**
     * Replace theme variables in string
     * @private
     * 
     * @param {string} str - String with variables
     * @param {Object} theme - Theme object
     * @returns {string} String with variables replaced
     */
    _replaceThemeVariables(str, theme) {
        return str.replace(/\$\{theme\.(\w+)\}/g, (match, varName) => {
            return theme[varName] || match;
        });
    }

    /**
     * Set active theme
     * 
     * @param {string} themeName - Theme name
     */
    setActiveTheme(themeName) {
        if (!this._themes.has(themeName)) {
            cblcarsLog.warn(`[StyleLibrary] Theme not found: ${themeName}`);
            return;
        }

        this._activeTheme = themeName;
        this._cache.clear(); // Clear cache when theme changes
        
        cblcarsLog.info(`[StyleLibrary] Active theme set to: ${themeName}`);
    }

    /**
     * Get active theme name
     * 
     * @returns {string|null} Active theme name or null
     */
    getActiveTheme() {
        return this._activeTheme;
    }

    /**
     * Get all available preset names
     * 
     * @returns {Array<string>} Array of preset names
     */
    getPresetNames() {
        return Array.from(this._presets.keys());
    }

    /**
     * Get all available theme names
     * 
     * @returns {Array<string>} Array of theme names
     */
    getThemeNames() {
        return Array.from(this._themes.keys());
    }

    /**
     * Register a preset programmatically
     * 
     * @param {string} name - Preset name
     * @param {Object} definition - Preset definition
     */
    registerPreset(name, definition) {
        this._presets.set(name, definition);
        this._cache.clear();
        cblcarsLog.debug(`[StyleLibrary] Registered preset: ${name}`);
    }

    /**
     * Register a theme programmatically
     * 
     * @param {string} name - Theme name
     * @param {Object} definition - Theme definition
     */
    registerTheme(name, definition) {
        this._themes.set(name, definition);
        cblcarsLog.debug(`[StyleLibrary] Registered theme: ${name}`);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this._cache.clear();
        cblcarsLog.debug('[StyleLibrary] Cache cleared');
    }

    /**
     * Cleanup
     */
    destroy() {
        this._presets.clear();
        this._themes.clear();
        this._cache.clear();
        cblcarsLog.info('[StyleLibrary] Destroyed');
    }
}
```

**Acceptance Criteria:**
- ✅ StyleLibrary class created
- ✅ YAML loading works
- ✅ Preset inheritance works (extends)
- ✅ Theme variables resolve
- ✅ Theme switching works
- ✅ Caching implemented
- ✅ Can register presets/themes programmatically

---

## 3.4: Implement YAML Preset Format

**Purpose:** Define standard YAML format for style presets

### Example: Style Presets YAML

**File:** `www/cb-lcars/styles.yaml` (user-configurable)

```yaml
# CB-LCARS Style Presets
# User-configurable style definitions

# ============================================================
# BASE PRESETS
# ============================================================

presets:
  # Base active state
  active:
    color: var(--lcars-ui-secondary)
    border_color: var(--lcars-ui-secondary)
    background: transparent
    opacity: 1
    font_weight: normal
    
  # Base inactive state
  inactive:
    color: var(--lcars-ui-tertiary)
    border_color: var(--lcars-ui-tertiary)
    background: transparent
    opacity: 0.6
    font_weight: normal
    
  # Base error/unavailable state
  error:
    color: var(--lcars-red)
    border_color: var(--lcars-red)
    background: transparent
    opacity: 1
    font_weight: normal
    
  # ============================================================
  # COMPONENT-SPECIFIC PRESETS (Extend base presets)
  # ============================================================
  
  # Button presets
  button_lozenge:
    extends: active
    border_radius: 30px
    padding: 10px 20px
    min_width: 80px
    
  button_pill:
    extends: active
    border_radius: 50%
    padding: 15px
    min_width: 60px
    min_height: 60px
    
  # Gauge presets
  gauge_active:
    extends: active
    stroke_width: 3
    fill: none
    
  gauge_inactive:
    extends: inactive
    stroke_width: 3
    fill: none
    stroke_dasharray: 5 5
    
  # Text presets
  text_header:
    extends: active
    font_size: 24px
    font_weight: bold
    text_transform: uppercase
    letter_spacing: 2px
    
  text_label:
    extends: active
    font_size: 16px
    font_weight: normal
    text_transform: uppercase
    
  text_value:
    extends: active
    font_size: 20px
    font_weight: bold
    
  # Alert presets
  alert_warning:
    color: var(--lcars-orange)
    border_color: var(--lcars-orange)
    background: rgba(255, 153, 0, 0.1)
    opacity: 1
    font_weight: bold
    
  alert_critical:
    color: var(--lcars-red)
    border_color: var(--lcars-red)
    background: rgba(204, 51, 51, 0.1)
    opacity: 1
    font_weight: bold
    animation: pulse_error
    
# ============================================================
# THEMES (Alert Conditions)
# ============================================================

themes:
  # Green Alert (Normal Operations)
  green_alert:
    primary: var(--lcars-green)
    secondary: var(--lcars-blue)
    tertiary: var(--lcars-ui-tertiary)
    accent: var(--lcars-ui-secondary)
    background: var(--picard-dark-gray)
    
  # Yellow Alert (Caution)
  yellow_alert:
    primary: var(--lcars-orange)
    secondary: var(--lcars-gold)
    tertiary: var(--lcars-ui-tertiary)
    accent: var(--lcars-orange)
    background: var(--picard-dark-gray)
    
  # Red Alert (Danger)
  red_alert:
    primary: var(--lcars-red)
    secondary: var(--lcars-orange)
    tertiary: var(--lcars-ui-tertiary)
    accent: var(--lcars-red)
    background: var(--picard-darkest-gray)
    
  # Blue Alert (Informational)
  blue_alert:
    primary: var(--lcars-blue)
    secondary: var(--lcars-ui-secondary)
    tertiary: var(--lcars-ui-tertiary)
    accent: var(--lcars-blue)
    background: var(--picard-dark-gray)

# Default theme
default_theme: green_alert

# ============================================================
# PRESET VARIANTS WITH THEME VARIABLES
# ============================================================

# These presets use ${theme.variable} syntax
# They will resolve based on active theme

presets_themed:
  primary_button:
    extends: button_lozenge
    color: ${theme.primary}
    border_color: ${theme.primary}
    
  secondary_button:
    extends: button_lozenge
    color: ${theme.secondary}
    border_color: ${theme.secondary}
    
  accent_text:
    extends: text_label
    color: ${theme.accent}
```

**Acceptance Criteria:**
- ✅ YAML format defined
- ✅ Base presets included
- ✅ Component-specific presets included
- ✅ Theme definitions included
- ✅ Theme variable syntax documented
- ✅ Preset inheritance works
- ✅ Example configurations provided

---

## 3.5: Build Theme Manager

**Purpose:** Runtime theme switching and alert condition management

### Code: ThemeManager Class

**File:** `src/core/styling/theme-manager.js`

```javascript
/**
 * ThemeManager - Runtime Theme Management
 * 
 * Manages alert condition themes (green, yellow, red alert)
 * Applies theme colors to CSS variables
 * Coordinates with StyleLibrary for preset resolution
 * 
 * FEATURES:
 * - Alert condition switching
 * - CSS variable injection
 * - Theme persistence (optional)
 * - Event notifications
 * 
 * @example
 * const manager = new ThemeManager(styleLibrary);
 * manager.setAlertCondition('red_alert');
 * // All cards update with red alert theme
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ThemeManager {
    /**
     * Create theme manager
     * 
     * @param {StyleLibrary} styleLibrary - Style library reference
     */
    constructor(styleLibrary) {
        this.styleLibrary = styleLibrary;
        this._currentTheme = null;
        this._cssPrefix = 'cblcars-theme';
        
        cblcarsLog.info('[ThemeManager] Initialized');
    }

    /**
     * Set alert condition theme
     * 
     * @param {string} alertCondition - Alert condition name (green_alert, yellow_alert, red_alert)
     * @param {boolean} persistState - Whether to persist to localStorage (default: true)
     */
    setAlertCondition(alertCondition, persistState = true) {
        const themeName = alertCondition.endsWith('_alert') 
            ? alertCondition 
            : `${alertCondition}_alert`;

        // Validate theme exists
        const themes = this.styleLibrary.getThemeNames();
        if (!themes.includes(themeName)) {
            cblcarsLog.warn(`[ThemeManager] Theme not found: ${themeName}`);
            return;
        }

        cblcarsLog.info(`[ThemeManager] Setting alert condition: ${alertCondition}`);

        // Update style library
        this.styleLibrary.setActiveTheme(themeName);
        this._currentTheme = themeName;

        // Apply CSS variables
        this._applyCSSVariables(themeName);

        // Persist if requested
        if (persistState) {
            this._persistTheme(themeName);
        }

        // Notify via event bus
        this._notifyThemeChange(themeName);

        // Dispatch DOM event
        window.dispatchEvent(new CustomEvent('cblcars-theme-changed', {
            detail: { theme: themeName, alertCondition }
        }));
    }

    /**
     * Apply theme CSS variables to document
     * @private
     * 
     * @param {string} themeName - Theme name
     */
    _applyCSSVariables(themeName) {
        // Get theme definition from style library
        const themes = this.styleLibrary._themes;
        const theme = themes.get(themeName);

        if (!theme) {
            cblcarsLog.warn(`[ThemeManager] Cannot apply CSS - theme not found: ${themeName}`);
            return;
        }

        // Apply each theme variable as CSS custom property
        for (const [key, value] of Object.entries(theme)) {
            const cssVarName = `--${this._cssPrefix}-${key}`;
            document.documentElement.style.setProperty(cssVarName, value);
            cblcarsLog.debug(`[ThemeManager] Set ${cssVarName} = ${value}`);
        }
    }

    /**
     * Persist theme to localStorage
     * @private
     * 
     * @param {string} themeName - Theme name
     */
    _persistTheme(themeName) {
        try {
            localStorage.setItem('cblcars-active-theme', themeName);
        } catch (error) {
            cblcarsLog.warn('[ThemeManager] Failed to persist theme:', error);
        }
    }

    /**
     * Load persisted theme from localStorage
     * 
     * @returns {string|null} Persisted theme name or null
     */
    loadPersistedTheme() {
        try {
            const themeName = localStorage.getItem('cblcars-active-theme');
            if (themeName) {
                cblcarsLog.info(`[ThemeManager] Loaded persisted theme: ${themeName}`);
                this.setAlertCondition(themeName.replace('_alert', ''), false);
                return themeName;
            }
        } catch (error) {
            cblcarsLog.warn('[ThemeManager] Failed to load persisted theme:', error);
        }
        return null;
    }

    /**
     * Notify theme change via event bus
     * @private
     * 
     * @param {string} themeName - Theme name
     */
    _notifyThemeChange(themeName) {
        if (window.cblcars?.eventBus) {
            window.cblcars.eventBus.publish(
                'system.theme_changed',
                { theme: themeName },
                { source: 'ThemeManager' }
            );
        }
    }

    /**
     * Get current theme
     * 
     * @returns {string|null} Current theme name
     */
    getCurrentTheme() {
        return this._currentTheme;
    }

    /**
     * Get available alert conditions
     * 
     * @returns {Array<string>} Array of alert condition names (without _alert suffix)
     */
    getAlertConditions() {
        return this.styleLibrary.getThemeNames()
            .filter(name => name.endsWith('_alert'))
            .map(name => name.replace('_alert', ''));
    }

    /**
     * Cleanup
     */
    destroy() {
        this._currentTheme = null;
        cblcarsLog.info('[ThemeManager] Destroyed');
    }
}
```

**Acceptance Criteria:**
- ✅ ThemeManager class created
- ✅ Alert condition switching works
- ✅ CSS variables applied to document
- ✅ Theme persistence to localStorage works
- ✅ Event bus notifications work
- ✅ Can load persisted theme on init

---

## 3.6: Integrate with CBLCARSBaseCard

**Purpose:** Connect rules engine and style library to base card

### Updated CBLCARSBaseCard Integration

**File:** `src/cb-lcars.js` (CBLCARSBaseCard class - updated excerpt)

```javascript
class CBLCARSBaseCard extends ButtonCard {
    async setConfig(config) {
        // ... existing config setup ...

        // Create pipeline (which includes rules engine)
        await this._createPipeline(isMSDCard);

        // Apply rules to card styling
        if (this._config.variables?.rules && this._pipeline?.rulesEngine) {
            await this._applyRulesBasedStyling();
        }

        // ... rest of setConfig ...
    }

    /**
     * Apply rules-based styling to card
     * Replaces legacy button-card state blocks
     * @private
     */
    async _applyRulesBasedStyling() {
        if (!this._config.entity || !this._pipeline) return;

        // Get current entity state
        const entityState = this.pipeline.getEntityState(this._config.entity);
        if (!entityState) return;

        // Evaluate rules
        const result = this._pipeline.rulesEngine.evaluate(entityState);

        if (result.matched) {
            cblcarsLog.debug(`[CBLCARSBaseCard] Rule matched for ${this._config.entity}:`, result.ruleId);

            // Apply resolved styles to card
            this._applyStylesToCard(result.resolvedStyles);

            // Trigger animation if specified
            if (result.animation) {
                this._triggerAnimation(result.animation);
            }
        }
    }

    /**
     * Apply styles to card element
     * @private
     * 
     * @param {Object} styles - Style object to apply
     */
    _applyStylesToCard(styles) {
        if (!styles || !this.shadowRoot) return;

        const cardElement = this.shadowRoot.querySelector('ha-card') || this;

        for (const [property, value] of Object.entries(styles)) {
            // Convert property name (e.g., border_color -> border-color)
            const cssProperty = property.replace(/_/g, '-');
            
            try {
                cardElement.style.setProperty(cssProperty, value);
            } catch (error) {
                cblcarsLog.warn(`[CBLCARSBaseCard] Failed to apply style ${cssProperty}:`, error);
            }
        }
    }

    /**
     * Trigger animation from rule
     * @private
     * 
     * @param {string} animationName - Animation name or preset
     */
    _triggerAnimation(animationName) {
        // Check if animation preset exists
        if (this._pipeline.animationPresets) {
            const animConfig = this._pipeline.animationPresets.getPreset(animationName);
            
            if (animConfig) {
                // Trigger animation via animation scope
                if (this._animationScope) {
                    this._animationScope.animate({
                        targets: this,
                        ...animConfig
                    });
                }
            }
        }
    }

    /**
     * Entity update callback - re-evaluate rules
     * @private
     */
    _onEntityUpdate(entityId, state, oldState) {
        // ... existing overlay/control updates ...

        // Re-evaluate rules for this card's entity
        if (entityId === this._config.entity && this._pipeline?.rulesEngine) {
            const result = this._pipeline.rulesEngine.evaluate(state);
            
            if (result.matched) {
                this._applyStylesToCard(result.resolvedStyles);
                
                if (result.animation) {
                    this._triggerAnimation(result.animation);
                }
            }
        }
    }
}
```

**Acceptance Criteria:**
- ✅ Rules engine integrated into CBLCARSBaseCard
- ✅ Rules evaluated on entity state changes
- ✅ Styles applied to card element
- ✅ Animations triggered from rules
- ✅ No breaking changes to existing functionality

---

## 3.7: Create Migration Helper for Legacy States

**Purpose:** Tool to convert legacy button-card state blocks to new rules format

### Code: Migration Helper

**File:** `src/utils/cb-lcars-migrate-states.js`

```javascript
/**
 * Migration Helper - Convert Legacy State Blocks to Rules
 * 
 * Converts button-card state blocks to modern rules engine format
 * Helps users migrate existing card configurations
 * 
 * USAGE:
 * const rules = migrateStatesToRules(legacyConfig);
 * 
 * @example
 * // Legacy
 * state:
 *   - id: state_on
 *     value: on
 *     styles:
 *       card:
 *         - background-color: red
 * 
 * // Migrated
 * rules:
 *   - condition: { state: 'on' }
 *     apply:
 *       inline_styles:
 *         background_color: red
 */

import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Migrate legacy state blocks to rules format
 * 
 * @param {Object} config - Card configuration with legacy state blocks
 * @returns {Array<Object>} Array of rule definitions
 */
export function migrateStatesToRules(config) {
    const stateBlocks = config.state || [];
    const rules = [];

    for (const block of stateBlocks) {
        try {
            const rule = _convertStateBlockToRule(block);
            if (rule) {
                rules.push(rule);
            }
        } catch (error) {
            cblcarsLog.error('[MigrateStates] Error converting state block:', error);
        }
    }

    cblcarsLog.info(`[MigrateStates] Converted ${rules.length} state blocks to rules`);
    return rules;
}

/**
 * Convert a single state block to rule
 * @private
 * 
 * @param {Object} block - State block definition
 * @returns {Object|null} Rule definition or null
 */
function _convertStateBlockToRule(block) {
    const rule = {
        id: block.id || `migrated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        condition: null,
        apply: {}
    };

    // Convert condition
    rule.condition = _extractCondition(block);
    if (!rule.condition) {
        cblcarsLog.warn(`[MigrateStates] Could not extract condition from state block:`, block);
        return null;
    }

    // Convert styles
    if (block.styles) {
        rule.apply.inline_styles = _convertStyles(block.styles);
    }

    return rule;
}

/**
 * Extract condition from state block
 * @private
 * 
 * @param {Object} block - State block
 * @returns {Object|null} Condition object
 */
function _extractCondition(block) {
    // Direct value match
    if (block.value !== undefined) {
        return { state: block.value };
    }

    // Template operator
    if (block.operator === 'template' && block.value) {
        // Try to parse template for simple cases
        const templateStr = String(block.value);
        
        // Simple state match: return entity.state === 'on'
        const simpleMatch = templateStr.match(/states?\[.*?\]\.state\s*===?\s*['"](\w+)['"]/);
        if (simpleMatch) {
            return { state: simpleMatch[1] };
        }

        // Array includes: ['on', 'open'].includes(state)
        const arrayMatch = templateStr.match(/\[(.*?)\]\.includes\(/);
        if (arrayMatch) {
            const states = arrayMatch[1].match(/['"](\w+)['"]/g).map(s => s.replace(/['"]/g, ''));
            return { state: states };
        }

        // Fallback: use template evaluation
        return { template: block.value };
    }

    // Regex operator
    if (block.operator === 'regex') {
        return { state_regex: block.value };
    }

    // Default operator (equals)
    if (block.operator === '==' || !block.operator) {
        return { state: block.value };
    }

    cblcarsLog.warn('[MigrateStates] Unknown operator:', block.operator);
    return null;
}

/**
 * Convert styles object
 * @private
 * 
 * @param {Object} styles - Legacy styles object
 * @returns {Object} Converted styles
 */
function _convertStyles(styles) {
    const converted = {};

    // card styles
    if (styles.card && Array.isArray(styles.card)) {
        for (const styleEntry of styles.card) {
            if (typeof styleEntry === 'object') {
                for (const [key, value] of Object.entries(styleEntry)) {
                    // Extract actual value from template if needed
                    const cleanValue = _extractStyleValue(value);
                    if (cleanValue) {
                        // Convert kebab-case to snake_case for consistency
                        const propertyName = key.replace(/-/g, '_');
                        converted[propertyName] = cleanValue;
                    }
                }
            }
        }
    }

    return converted;
}

/**
 * Extract style value from template string
 * @private
 * 
 * @param {any} value - Style value (may be template string)
 * @returns {string|null} Extracted value
 */
function _extractStyleValue(value) {
    if (typeof value !== 'string') {
        return value;
    }

    // If it's a template string with [[[ ]]], try to extract static value
    if (value.includes('[[[') && value.includes(']]]')) {
        // Try to extract variable references
        const varMatch = value.match(/variables\.([\w.]+)/);
        if (varMatch) {
            // Return reference to variable
            return `\${variables.${varMatch[1]}}`;
        }

        // If too complex, return as template
        return value;
    }

    return value;
}

/**
 * Generate migration report
 * 
 * @param {Object} config - Original config
 * @param {Array<Object>} rules - Migrated rules
 * @returns {Object} Migration report
 */
export function generateMigrationReport(config, rules) {
    const report = {
        original_state_blocks: (config.state || []).length,
        migrated_rules: rules.length,
        success_rate: 0,
        warnings: [],
        recommendations: []
    };

    report.success_rate = (report.migrated_rules / report.original_state_blocks) * 100;

    // Check for complex templates
    const complexTemplates = rules.filter(r => r.condition?.template);
    if (complexTemplates.length > 0) {
        report.warnings.push({
            type: 'complex_templates',
            count: complexTemplates.length,
            message: 'Some rules use template evaluation which may need manual review'
        });
    }

    // Recommend preset usage
    if (rules.length > 5) {
        report.recommendations.push({
            type: 'use_presets',
            message: 'Consider creating style presets to reduce duplication'
        });
    }

    return report;
}
```

**Example Usage:**

```javascript
// In console or migration script
const legacyConfig = {
    type: 'cb-lcars-button-card',
    entity: 'light.desk',
    state: [
        {
            id: 'state_on',
            value: 'on',
            styles: {
                card: [
                    { 'background-color': 'var(--lcars-ui-secondary)' },
                    { 'border-color': 'var(--lcars-ui-secondary)' }
                ]
            }
        },
        {
            id: 'state_off',
            value: 'off',
            styles: {
                card: [
                    { 'background-color': 'var(--lcars-ui-tertiary)' },
                    { 'border-color': 'var(--lcars-ui-tertiary)' }
                ]
            }
        }
    ]
};

// Migrate
const rules = migrateStatesToRules(legacyConfig);
const report = generateMigrationReport(legacyConfig, rules);

console.log('Migration Report:', report);
console.log('Migrated Rules:', rules);

// New config
const modernConfig = {
    type: 'cb-lcars-button