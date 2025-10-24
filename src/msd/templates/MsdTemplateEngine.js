/**
 * [MsdTemplateEngine] Template processing system - processes template strings with HASS entity references
 * 🔧 Features template compilation, entity dependency tracking, real-time updates, and comprehensive formatting
 */

class MsdTemplateEngine {
    constructor() {
        this.templateCache = new Map();
        this.entitySubscriptions = new Map();
        this.compiledTemplates = new Map();

        // Performance tracking
        this.stats = {
            templatesCompiled: 0,
            evaluationsPerformed: 0,
            entityReferences: 0,
            cacheHits: 0,
            lastUpdate: Date.now()
        };

        // Expose debug interface
        if (typeof window !== 'undefined') {
            window.__msdTemplateEngine = this;
        }
    }

    /**
     * Compile template string and extract entity dependencies
     * @param {string} template - Template string like "Battery: {{states('sensor.battery')}}%"
     * @param {string} templateId - Unique identifier for caching
     */
    compileTemplate(template, templateId) {
        if (this.compiledTemplates.has(templateId)) {
            this.stats.cacheHits++;
            return this.compiledTemplates.get(templateId);
        }

        const compiled = {
            original: template,
            entityDependencies: [],
            segments: [],
            hasTemplates: false
        };

        // Parse template for {{...}} expressions
        const templateRegex = /\{\{([^}]+)\}\}/g;
        let lastIndex = 0;
        let match;

        while ((match = templateRegex.exec(template)) !== null) {
            // Add literal text before template
            if (match.index > lastIndex) {
                compiled.segments.push({
                    type: 'literal',
                    content: template.substring(lastIndex, match.index)
                });
            }

            // Parse template expression
            const expression = match[1].trim();
            const templateSegment = this.parseTemplateExpression(expression);
            compiled.segments.push(templateSegment);
            compiled.hasTemplates = true;

            // Track entity dependencies
            if (templateSegment.entityId) {
                if (!compiled.entityDependencies.includes(templateSegment.entityId)) {
                    compiled.entityDependencies.push(templateSegment.entityId);
                }
            }

            lastIndex = templateRegex.lastIndex;
        }

        // Add remaining literal text
        if (lastIndex < template.length) {
            compiled.segments.push({
                type: 'literal',
                content: template.substring(lastIndex)
            });
        }

        // If no templates found, treat entire string as literal
        if (!compiled.hasTemplates) {
            compiled.segments = [{
                type: 'literal',
                content: template
            }];
        }

        this.compiledTemplates.set(templateId, compiled);
        this.stats.templatesCompiled++;
        this.stats.entityReferences += compiled.entityDependencies.length;

        return compiled;
    }

    /**
     * Parse individual template expression
     * @param {string} expression - Expression like "states('sensor.battery')"
     */
    parseTemplateExpression(expression) {
        // Handle states('entity.id') function
        const statesMatch = expression.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (statesMatch) {
            return {
                type: 'entity_state',
                entityId: statesMatch[1],
                expression: expression,
                format: null
            };
        }

        // Handle states('entity.id') | format function
        const statesFormatMatch = expression.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\|\s*(\w+)(?:\s*\(\s*([^)]*)\s*\))?/);
        if (statesFormatMatch) {
            return {
                type: 'entity_state',
                entityId: statesFormatMatch[1],
                expression: expression,
                format: {
                    function: statesFormatMatch[2],
                    args: statesFormatMatch[3] ? statesFormatMatch[3].split(',').map(s => s.trim().replace(/['"]/g, '')) : []
                }
            };
        }

        // NEW: state_attr('entity.id','attribute') | format function
        const stateAttrFormatMatch = expression.match(/state_attr\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\|\s*(\w+)(?:\s*\(\s*([^)]*)\s*\))?/);
        if (stateAttrFormatMatch) {
            return {
                type: 'entity_attribute',
                entityId: stateAttrFormatMatch[1],
                attribute: stateAttrFormatMatch[2],
                expression,
                format: {
                    function: stateAttrFormatMatch[3],
                    args: stateAttrFormatMatch[4] ? stateAttrFormatMatch[4].split(',').map(s => s.trim().replace(/['"]/g, '')) : []
                }
            };
        }

        // Handle state_attr('entity.id', 'attribute')
        const attrMatch = expression.match(/state_attr\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
        if (attrMatch) {
            return {
                type: 'entity_attribute',
                entityId: attrMatch[1],
                attribute: attrMatch[2],
                expression: expression,
                format: null
            };
        }

        // NEW: is_state('entity.id','state')
        const isStateMatch = expression.match(/is_state\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
        if (isStateMatch) {
            return {
                type: 'is_state_check',
                entityId: isStateMatch[1],
                expectedState: isStateMatch[2],
                expression
            };
        }

        // NEW: has_value('entity.id')
        const hasValueMatch = expression.match(/has_value\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (hasValueMatch) {
            return {
                type: 'has_value_check',
                entityId: hasValueMatch[1],
                expression
            };
        }

        // NEW: simple math "X op Y" where X/Y can be states()/state_attr() or numbers
        const mathMatch = expression.match(/(.+?)\s*([+\-*/])\s*(.+)/);
        if (mathMatch && !expression.includes('?')) {
            return {
                type: 'mathematical_operation',
                leftExpression: mathMatch[1].trim(),
                operator: mathMatch[2],
                rightExpression: mathMatch[3].trim(),
                expression
            };
        }

        // NEW: very simple conditional "LHS OP RHS and 'A' or 'B'"
        const conditionalMatch = expression.match(/(.+?)\s*(==|!=|>=|<=|>|<)\s*['"]?([^'"]*?)['"]?\s+and\s+['"](.+?)['"]\s+or\s+['"](.+?)['"]/);
        if (conditionalMatch) {
            return {
                type: 'conditional_expression',
                leftExpression: conditionalMatch[1].trim(),
                operator: conditionalMatch[2],
                rightValue: conditionalMatch[3],
                trueValue: conditionalMatch[4],
                falseValue: conditionalMatch[5],
                expression
            };
        }

        // Handle simple entity reference (just entity.id)
        const entityMatch = expression.match(/^(['"]?)([a-zA-Z_][a-zA-Z0-9_.]*)\1$/);
        if (entityMatch && entityMatch[2].includes('.')) {
            return {
                type: 'entity_state',
                entityId: entityMatch[2],
                expression: expression,
                format: null
            };
        }

        // Fallback - treat as literal expression
        return {
            type: 'literal_expression',
            content: expression,
            expression: expression
        };
    }

    /**
     * Evaluate compiled template with current HASS states
     * @param {object} compiledTemplate - Compiled template object
     * @param {object} hassStates - HASS states object
     */
    evaluateTemplate(compiledTemplate, hassStates = null) {
        if (!compiledTemplate || !compiledTemplate.segments) {
            return '';
        }

        // Get HASS states if not provided
        if (!hassStates) {
            hassStates = this.getHassStates();
        }

        if (!hassStates) {
            console.warn('MSD Template: ⚠️ HASS states not available');
            return compiledTemplate.original; // Return original template as fallback
        }

        let result = '';

        for (const segment of compiledTemplate.segments) {
            switch (segment.type) {
                case 'literal':
                    result += segment.content;
                    break;

                case 'entity_state':
                    const stateValue = this.getEntityState(segment.entityId, hassStates);
                    const formattedState = this.formatValue(stateValue, segment.format);
                    result += formattedState;
                    break;

                case 'entity_attribute':
                    const attrValue = this.getEntityAttribute(segment.entityId, segment.attribute, hassStates);
                    const formattedAttr = this.formatValue(attrValue, segment.format);
                    result += formattedAttr;
                    break;

                case 'literal_expression':
                    result += segment.content;
                    break;

                case 'is_state_check': {
                    const currentState = this.getEntityState(segment.entityId, hassStates);
                    result += (currentState === segment.expectedState) ? 'true' : 'false';
                    break;
                }

                case 'has_value_check': {
                    const currentState = this.getEntityState(segment.entityId, hassStates);
                    result += (currentState !== 'unavailable' && currentState !== 'unknown' && currentState != null) ? 'true' : 'false';
                    break;
                }

                case 'mathematical_operation': {
                    const left = this._evaluateSubExpression(segment.leftExpression, hassStates);
                    const right = this._evaluateSubExpression(segment.rightExpression, hassStates);
                    const ln = parseFloat(left);
                    const rn = parseFloat(right);
                    if (isNaN(ln) || isNaN(rn)) {
                        result += '0';
                        break;
                    }
                    let v = ln;
                    switch (segment.operator) {
                        case '+': v = ln + rn; break;
                        case '-': v = ln - rn; break;
                        case '*': v = ln * rn; break;
                        case '/': v = rn !== 0 ? ln / rn : 0; break;
                    }
                    result += String(v);
                    break;
                }

                case 'conditional_expression': {
                    const left = this._evaluateSubExpression(segment.leftExpression, hassStates);
                    const cond = this._evaluateCondition(left, segment.operator, segment.rightValue);
                    result += cond ? segment.trueValue : segment.falseValue;
                    break;
                }

                default:
                    console.warn(`Unknown template segment type: ${segment.type}`);
                    result += segment.expression || '';
            }
        }

        this.stats.evaluationsPerformed++;
        this.stats.lastUpdate = Date.now();

        return result;
    }

    /**
     * Evaluate a sub-expression used by math/condition segments.
     * Supports states('id'), state_attr('id','attr'), raw numbers/strings.
     */
    _evaluateSubExpression(expr, hassStates) {
        const trimmed = (expr || '').trim();

        // states('entity')
        const s = trimmed.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (s) return this.getEntityState(s[1], hassStates);

        // state_attr('entity','attr')
        const a = trimmed.match(/state_attr\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
        if (a) return this.getEntityAttribute(a[1], a[2], hassStates);

        // numeric literal
        const n = parseFloat(trimmed);
        if (!isNaN(n)) return String(n);

        // raw string literal 'x' or "x"
        const q = trimmed.match(/^['"](.+)['"]$/);
        if (q) return q[1];

        // fallback: return as-is
        return trimmed;
    }

    /**
     * Compare left against right using operator (left could be string or numeric)
     */
    _evaluateCondition(left, operator, rightRaw) {
        const ln = parseFloat(left);
        const rn = parseFloat(rightRaw);
        const bothNumbers = !isNaN(ln) && !isNaN(rn);
        const L = bothNumbers ? ln : String(left);
        const R = bothNumbers ? rn : String(rightRaw);

        switch (operator) {
            case '==': return L == R;
            case '!=': return L != R;
            case '>':  return bothNumbers ? ln > rn : String(L) > String(R);
            case '<':  return bothNumbers ? ln < rn : String(L) < String(R);
            case '>=': return bothNumbers ? ln >= rn : String(L) >= String(R);
            case '<=': return bothNumbers ? ln <= rn : String(L) <= String(R);
            default:   return false;
        }
    }

    /**
     * Get entity state value from HASS states
     * @param {string} entityId - Entity ID
     * @param {object} hassStates - HASS states object
     */
    getEntityState(entityId, hassStates) {
        const entity = hassStates[entityId];
        if (!entity) {
            console.warn(`MSD Template: ⚠️ Entity ${entityId} not found`);
            return 'unavailable';
        }

        return entity.state;
    }

    /**
     * Get entity attribute value from HASS states
     * @param {string} entityId - Entity ID
     * @param {string} attribute - Attribute name
     * @param {object} hassStates - HASS states object
     */
    getEntityAttribute(entityId, attribute, hassStates) {
        const entity = hassStates[entityId];
        if (!entity || !entity.attributes) {
            console.warn(`MSD Template: ⚠️ Entity ${entityId} or attributes not found`);
            return 'unavailable';
        }

        return entity.attributes[attribute] || 'unavailable';
    }

    /**
     * Format value with optional format function
     * @param {any} value - Value to format
     * @param {object} format - Format specification
     */
    formatValue(value, format) {
        if (!format) {
            return value;
        }

        switch (format.function) {
            case 'round': {
                const decimals = format.args[0] ? parseInt(format.args[0]) : 0;
                const numValue = parseFloat(value);
                return isNaN(numValue) ? value : numValue.toFixed(decimals);
            }
            case 'float': {
                const numValue = parseFloat(value);
                return isNaN(numValue) ? value : String(numValue);
            }
            case 'upper':
                return String(value).toUpperCase();
            case 'lower':
                return String(value).toLowerCase();
            case 'title':
                return String(value).replace(/\w\S*/g, (txt) =>
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            case 'unit': {
                const unit = format.args[0] || '';
                return `${value}${unit}`;
            }
            default:
                console.warn(`MSD Template: ⚠️ Unknown template format function: ${format.function}`);
                return value;
        }
    }

    /**
     * Get HASS states from various sources
     */
    getHassStates() {
        // Try multiple ways to get HASS states
        if (typeof window !== 'undefined') {
            // Custom button card context
            if (window._customButtonCardHass && window._customButtonCardHass.states) {
                return window._customButtonCardHass.states;
            }

            // HA frontend context
            if (window.hass && window.hass.states) {
                return window.hass.states;
            }

            // CB-LCARS card instance context
            const card = window.cb_lcars_card_instance;
            if (card && (card.hass || card._hass)) {
                const hass = card.hass || card._hass;
                if (hass && hass.states) {
                    return hass.states;
                }
            }

            // MSD data manager context
            if (window.__msdDataManager && window.__msdDataManager.cardContext) {
                const hass = window.__msdDataManager.cardContext.hass;
                if (hass && hass.states) {
                    return hass.states;
                }
            }
        }

        return null;
    }

    /**
     * Subscribe to entity state changes for template updates
     * @param {string} templateId - Template identifier
     * @param {array} entityIds - Entity IDs to watch
     * @param {function} callback - Update callback
     */
    subscribeToTemplateUpdates(templateId, entityIds, callback) {
        const hass = this.getHassInstance();
        if (!hass || !hass.connection) {
            console.warn('MSD Template: ⚠️ Cannot subscribe to updates, HASS connection unavailable');
            return null;
        }

        const subscriptions = [];

        for (const entityId of entityIds) {
            try {
                const unsubscribe = hass.connection.subscribeEvents(
                    (event) => {
                        if (event.data.entity_id === entityId) {
                            callback(templateId, entityId, event.data.new_state);
                        }
                    },
                    'state_changed',
                    { entity_id: entityId }
                );

                subscriptions.push({ entityId, unsubscribe });

            } catch (error) {
                console.warn(`MSD Template: ⚠️ Failed to subscribe to ${entityId}:`, error);
            }
        }

        this.entitySubscriptions.set(templateId, subscriptions);

        return () => {
            // Unsubscribe from all entities
            const subs = this.entitySubscriptions.get(templateId);
            if (subs) {
                subs.forEach(sub => {
                    if (typeof sub.unsubscribe === 'function') {
                        sub.unsubscribe();
                    }
                });
                this.entitySubscriptions.delete(templateId);
            }
        };
    }

    /**
     * Get HASS instance for subscriptions
     */
    getHassInstance() {
        if (typeof window !== 'undefined') {
            if (window._customButtonCardHass) {
                return window._customButtonCardHass;
            }
            if (window.hass) {
                return window.hass;
            }
            const card = window.cb_lcars_card_instance;
            if (card && (card.hass || card._hass)) {
                return card.hass || card._hass;
            }
            if (window.__msdDataManager && window.__msdDataManager.cardContext) {
                return window.__msdDataManager.cardContext.hass;
            }
        }
        return null;
    }

    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalTemplates: this.compiledTemplates.size,
            activeSubscriptions: this.entitySubscriptions.size
        };
    }

    /**
     * Cleanup all subscriptions and cache
     */
    destroy() {
        // Unsubscribe from all entity updates
        for (const [templateId, subscriptions] of this.entitySubscriptions) {
            subscriptions.forEach(sub => {
                if (typeof sub.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            });
        }

        this.entitySubscriptions.clear();
        this.compiledTemplates.clear();
        this.templateCache.clear();
    }
}

// Dual export system for CommonJS and ES modules compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MsdTemplateEngine };
} else if (typeof window !== 'undefined') {
    window.MsdTemplateEngine = MsdTemplateEngine;
}

// ES module export
export { MsdTemplateEngine };
