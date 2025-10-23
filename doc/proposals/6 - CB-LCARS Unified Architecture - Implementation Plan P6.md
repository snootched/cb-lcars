# CB-LCARS Unified Architecture - Implementation Phase 6

**Phase 6: Legacy Card Migration**

**Goal:** Migrate remaining legacy cards to unified architecture

**Priority:** Ongoing - Complete modernization of all card types

---

## Phase 6 Tasks Overview

```
Phase 6: Legacy Card Migration
├─ 6.1: Migration Strategy & Prioritization
├─ 6.2: Migrate Button Cards
├─ 6.3: Migrate Elbow Cards
├─ 6.4: Migrate Label Cards
├─ 6.5: Migrate D-Pad Card
├─ 6.6: Migrate Double Elbow Card
├─ 6.7: Deprecate Legacy Templates
└─ 6.8: Migration Tools & Automation
```

---

## 6.1: Migration Strategy & Prioritization

**Purpose:** Plan systematic migration of all legacy cards

### Current Card Inventory

```
CB-LCARS Card Types (as of Phase 6 start)
├─ ✅ MSD Card (Already using unified architecture)
├─ ✅ Multimeter Card (Migrated in Phase 4)
├─ ⏳ Button Card (800+ lines YAML, highest priority)
├─ ⏳ Elbow Card (500+ lines YAML)
├─ ⏳ Label Card (300+ lines YAML)
├─ ⏳ D-Pad Card (600+ lines YAML)
├─ ⏳ Double Elbow Card (700+ lines YAML)
└─ ✅ Base Card (Infrastructure - no migration needed)
```

### Migration Priority Matrix

| Card Type | Complexity | Usage | Priority | Estimated Effort |
|-----------|------------|-------|----------|------------------|
| Button Card | High | Very High | **P0** | 2-3 weeks |
| Elbow Card | Medium | High | **P1** | 1-2 weeks |
| Label Card | Low | High | **P1** | 1 week |
| D-Pad Card | High | Medium | **P2** | 2 weeks |
| Double Elbow | Medium | Low | **P3** | 1-2 weeks |

### Migration Principles

**Must Maintain:**
- ✅ Backward compatibility (old configs work)
- ✅ Visual parity (cards look the same)
- ✅ Feature parity (all functions preserved)
- ✅ Performance (equal or better)

**Improvements Expected:**
- ✅ 70%+ reduction in YAML template code
- ✅ Rules engine replaces state blocks
- ✅ Overlay system for visual elements
- ✅ Better customization
- ✅ Easier maintenance

**Migration Pattern:**

```javascript
// Phase 1: Dual mode support
class CBLCARSButtonCard extends CBLCARSBaseCard {
    setConfig(config) {
        if (config.use_modern || this._shouldAutoMigrate(config)) {
            // Use new overlay/rules architecture
            this._useModernArchitecture(config);
        } else {
            // Use legacy button-card templates
            this._useLegacyArchitecture(config);
        }
    }
}

// Phase 2: Default to modern (opt-out legacy)
// Phase 3: Deprecate legacy (show warnings)
// Phase 4: Remove legacy (breaking change, major version bump)
```

### Migration Validation Checklist

For each card type:
- ✅ All visual styles reproduced
- ✅ All entity types supported
- ✅ All tap/hold/double-tap actions work
- ✅ State-based styling equivalent
- ✅ Animations preserved or improved
- ✅ Custom configurations migrate cleanly
- ✅ Performance benchmarks met
- ✅ Unit tests passing
- ✅ Integration tests passing
- ✅ User documentation updated
- ✅ Migration guide written

**Acceptance Criteria:**
- ✅ Migration strategy documented
- ✅ Priority order defined
- ✅ Validation checklist created
- ✅ Timeline estimated

---

## 6.2: Migrate Button Cards

**Purpose:** Modernize button cards (highest priority - most used)

### Current Button Card Analysis

**File:** `src/cb-lcars/cb-lcars-button.yaml`

**Current Implementation:**
- 800+ lines of YAML template
- 15+ button styles (lozenge, rectangle, pill, cap, etc.)
- Complex state blocks (50+ lines per state)
- Duplicated styling logic
- Embedded SVG generation

**Button Styles:**
- `cb-lcars-button-lozenge` - Rounded ends
- `cb-lcars-button-rectangle` - Square corners
- `cb-lcars-button-pill` - Full rounded
- `cb-lcars-button-cap` - Left/right caps
- `cb-lcars-button-picard` - Picard-era style
- Custom shapes via SVG

### New Button Architecture

**Component Breakdown:**

```
CBLCARSButtonCard
├─ Pipeline (core integration)
├─ Overlays
│  ├─ ButtonShapeOverlay (SVG background)
│  ├─ IconOverlay (optional icon)
│  ├─ TextOverlay (label/name)
│  └─ BadgeOverlay (optional badge/counter)
├─ Controls
│  └─ TapControl (interaction handling)
└─ Rules
   ├─ State-based styling
   ├─ Animation triggers
   └─ Visual feedback
```

### Implementation

#### Step 1: Create ButtonShapeOverlay

**File:** `src/components/overlays/button-shape-overlay.js`

```javascript
/**
 * ButtonShapeOverlay - Button Background Shape
 * 
 * Renders various LCARS button shapes as SVG overlays
 * Supports all legacy button styles with rules-based styling
 * 
 * SUPPORTED SHAPES:
 * - lozenge: Rounded ends (classic LCARS)
 * - rectangle: Square corners
 * - pill: Fully rounded (capsule)
 * - cap-left: Rounded left end only
 * - cap-right: Rounded right end only
 * - picard: Picard-era chamfered corners
 * - custom: User-defined SVG path
 * 
 * @extends BaseOverlay
 */

import { BaseOverlay } from './base-overlay.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ButtonShapeOverlay extends BaseOverlay {
    /**
     * Create a button shape overlay
     * 
     * @param {Object} config - Button shape configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {number} config.width - Button width
     * @param {number} config.height - Button height
     * @param {string} config.shape - Shape type (lozenge, rectangle, pill, etc.)
     * @param {number} config.border_radius - Border radius (for shapes that support it)
     * @param {string} config.fill - Fill color
     * @param {string} config.stroke - Stroke color (optional)
     * @param {number} config.stroke_width - Stroke width (optional)
     * @param {Object} config.padding - Internal padding { top, right, bottom, left }
     * @param {string} config.custom_path - Custom SVG path (for custom shape)
     * @param {Object} pipeline - Pipeline reference
     */
    constructor(config, pipeline) {
        super(config, pipeline);
        
        // Set defaults
        this.config.shape = config.shape || 'lozenge';
        this.config.width = config.width || 200;
        this.config.height = config.height || 40;
        this.config.border_radius = config.border_radius || 20;
        this.config.fill = config.fill || 'var(--lcars-card-button)';
        this.config.stroke = config.stroke || null;
        this.config.stroke_width = config.stroke_width || 0;
        this.config.padding = config.padding || { top: 10, right: 20, bottom: 10, left: 20 };
    }

    /**
     * Render button shape
     */
    render() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-button-shape');
        g.setAttribute('transform', `translate(${this.config.x || 0}, ${this.config.y || 0})`);

        // Create shape based on type
        let shape;
        switch (this.config.shape) {
            case 'lozenge':
                shape = this._createLozengeShape();
                break;
            case 'rectangle':
                shape = this._createRectangleShape();
                break;
            case 'pill':
                shape = this._createPillShape();
                break;
            case 'cap-left':
                shape = this._createCapShape('left');
                break;
            case 'cap-right':
                shape = this._createCapShape('right');
                break;
            case 'picard':
                shape = this._createPicardShape();
                break;
            case 'custom':
                shape = this._createCustomShape();
                break;
            default:
                shape = this._createLozengeShape();
        }

        // Apply styling
        shape.setAttribute('fill', this.config.fill);
        
        if (this.config.stroke && this.config.stroke_width > 0) {
            shape.setAttribute('stroke', this.config.stroke);
            shape.setAttribute('stroke-width', this.config.stroke_width);
        }

        g.appendChild(shape);
        this.element = g;
    }

    /**
     * Create lozenge shape (rounded ends)
     * @private
     * 
     * @returns {SVGElement} Path element
     */
    _createLozengeShape() {
        const width = this.config.width;
        const height = this.config.height;
        const radius = Math.min(this.config.border_radius, height / 2);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Lozenge path: rounded left and right ends
        const d = [
            `M ${radius} 0`,                           // Start at top-left (after curve)
            `L ${width - radius} 0`,                   // Line to top-right
            `A ${radius} ${radius} 0 0 1 ${width} ${height / 2}`,  // Right curve (top half)
            `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,  // Right curve (bottom half)
            `L ${radius} ${height}`,                   // Line to bottom-left
            `A ${radius} ${radius} 0 0 1 0 ${height / 2}`,  // Left curve (bottom half)
            `A ${radius} ${radius} 0 0 1 ${radius} 0`,      // Left curve (top half)
            `Z`                                        // Close path
        ].join(' ');

        path.setAttribute('d', d);
        path.setAttribute('class', 'button-shape-lozenge');
        
        return path;
    }

    /**
     * Create rectangle shape
     * @private
     * 
     * @returns {SVGElement} Rect element
     */
    _createRectangleShape() {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', this.config.width);
        rect.setAttribute('height', this.config.height);
        rect.setAttribute('rx', this.config.border_radius || 0);
        rect.setAttribute('ry', this.config.border_radius || 0);
        rect.setAttribute('class', 'button-shape-rectangle');
        
        return rect;
    }

    /**
     * Create pill shape (fully rounded)
     * @private
     * 
     * @returns {SVGElement} Rect element
     */
    _createPillShape() {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const radius = this.config.height / 2;
        
        rect.setAttribute('width', this.config.width);
        rect.setAttribute('height', this.config.height);
        rect.setAttribute('rx', radius);
        rect.setAttribute('ry', radius);
        rect.setAttribute('class', 'button-shape-pill');
        
        return rect;
    }

    /**
     * Create cap shape (rounded one end only)
     * @private
     * 
     * @param {string} side - 'left' or 'right'
     * @returns {SVGElement} Path element
     */
    _createCapShape(side) {
        const width = this.config.width;
        const height = this.config.height;
        const radius = Math.min(this.config.border_radius, height / 2);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        let d;
        if (side === 'left') {
            // Rounded left, square right
            d = [
                `M ${radius} 0`,
                `L ${width} 0`,
                `L ${width} ${height}`,
                `L ${radius} ${height}`,
                `A ${radius} ${radius} 0 0 1 0 ${height / 2}`,
                `A ${radius} ${radius} 0 0 1 ${radius} 0`,
                `Z`
            ].join(' ');
        } else {
            // Square left, rounded right
            d = [
                `M 0 0`,
                `L ${width - radius} 0`,
                `A ${radius} ${radius} 0 0 1 ${width} ${height / 2}`,
                `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
                `L 0 ${height}`,
                `Z`
            ].join(' ');
        }

        path.setAttribute('d', d);
        path.setAttribute('class', `button-shape-cap-${side}`);
        
        return path;
    }

    /**
     * Create Picard-era shape (chamfered corners)
     * @private
     * 
     * @returns {SVGElement} Path element
     */
    _createPicardShape() {
        const width = this.config.width;
        const height = this.config.height;
        const chamfer = this.config.border_radius || 8;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Chamfered rectangle: diagonal corners
        const d = [
            `M ${chamfer} 0`,                    // Start at top-left (after chamfer)
            `L ${width - chamfer} 0`,            // Top edge
            `L ${width} ${chamfer}`,             // Top-right chamfer
            `L ${width} ${height - chamfer}`,    // Right edge
            `L ${width - chamfer} ${height}`,    // Bottom-right chamfer
            `L ${chamfer} ${height}`,            // Bottom edge
            `L 0 ${height - chamfer}`,           // Bottom-left chamfer
            `L 0 ${chamfer}`,                    // Left edge
            `Z`                                  // Close
        ].join(' ');

        path.setAttribute('d', d);
        path.setAttribute('class', 'button-shape-picard');
        
        return path;
    }

    /**
     * Create custom shape from SVG path
     * @private
     * 
     * @returns {SVGElement} Path element
     */
    _createCustomShape() {
        if (!this.config.custom_path) {
            cblcarsLog.warn(`[ButtonShapeOverlay ${this.config.id}] Custom shape requires custom_path`);
            return this._createRectangleShape();
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', this.config.custom_path);
        path.setAttribute('class', 'button-shape-custom');
        
        return path;
    }

    /**
     * Update button shape styling
     * 
     * @param {Object} data - Update data (fill, stroke, etc.)
     */
    onUpdate(data) {
        if (!this.element) return;

        const shape = this.element.querySelector('path, rect');
        if (!shape) return;

        // Update fill
        if (data.fill) {
            shape.setAttribute('fill', data.fill);
        }

        // Update stroke
        if (data.stroke !== undefined) {
            if (data.stroke) {
                shape.setAttribute('stroke', data.stroke);
                shape.setAttribute('stroke-width', data.stroke_width || this.config.stroke_width);
            } else {
                shape.removeAttribute('stroke');
            }
        }

        // Update opacity
        if (data.opacity !== undefined) {
            shape.setAttribute('opacity', data.opacity);
        }
    }

    /**
     * Animate button press
     * Visual feedback for tap interaction
     */
    animatePress() {
        if (!this.element) return;

        const shape = this.element.querySelector('path, rect');
        if (!shape) return;

        // Quick scale down/up animation
        window.cblcars.anim.anime(shape, {
            scale: [1, 0.95, 1],
            duration: 150,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Animate button state change
     * 
     * @param {string} fromColor - Starting color
     * @param {string} toColor - Target color
     * @param {number} duration - Animation duration (ms)
     */
    animateColorChange(fromColor, toColor, duration = 300) {
        if (!this.element) return;

        const shape = this.element.querySelector('path, rect');
        if (!shape) return;

        // Use anime.js color interpolation
        window.cblcars.anim.anime(shape, {
            fill: [fromColor, toColor],
            duration,
            easing: 'easeOutQuad'
        });
    }
}
```

**Register in ComponentRegistry:**

```javascript
// In src/components/registry.js
import { ButtonShapeOverlay } from './overlays/button-shape-overlay.js';

// In registerDefaults() method
registry.registerOverlay('button_shape', ButtonShapeOverlay);
```

#### Step 2: Create TapControl

**File:** `src/components/controls/tap-control.js`

```javascript
/**
 * TapControl - Button Interaction Handler
 * 
 * Handles tap, hold, and double-tap interactions for buttons
 * Integrates with Home Assistant action system
 * Provides visual feedback through overlays
 * 
 * @extends HTMLElement
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class TapControl extends HTMLElement {
    constructor() {
        super();
        
        // Interaction state
        this._isPressed = false;
        this._holdTimer = null;
        this._holdDuration = 500;  // ms
        this._lastTapTime = 0;
        this._doubleTapWindow = 300;  // ms
        
        // Configuration
        this.config = null;
        this.pipeline = null;
        
        // Visual feedback overlay reference
        this._buttonShapeOverlay = null;
    }

    /**
     * Initialize control
     * 
     * @param {Object} config - Control configuration
     * @param {string} config.entity - Entity ID
     * @param {Object} config.tap_action - Tap action config
     * @param {Object} config.hold_action - Hold action config
     * @param {Object} config.double_tap_action - Double tap action config
     * @param {number} config.hold_duration - Hold duration threshold (ms)
     * @param {Object} pipeline - Pipeline reference
     */
    initialize(config, pipeline) {
        this.config = config;
        this.pipeline = pipeline;
        
        this._holdDuration = config.hold_duration || 500;
        
        // Render (transparent overlay for hit detection)
        this._render();
        this._attachEventListeners();
        
        cblcarsLog.debug(`[TapControl ${config.id}] Initialized`);
    }

    /**
     * Set button shape overlay reference (for visual feedback)
     * 
     * @param {ButtonShapeOverlay} overlay - Button shape overlay
     */
    setButtonShapeOverlay(overlay) {
        this._buttonShapeOverlay = overlay;
    }

    /**
     * Render control (transparent hit area)
     * @private
     */
    _render() {
        this.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEventListeners() {
        // Pointer events (unified mouse/touch)
        this.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.addEventListener('pointercancel', this._onPointerCancel.bind(this));
        
        // Keyboard support
        this.addEventListener('keydown', this._onKeyDown.bind(this));
        this.addEventListener('keyup', this._onKeyUp.bind(this));
        
        // Accessibility
        this.setAttribute('role', 'button');
        this.setAttribute('tabindex', '0');
    }

    /**
     * Handle pointer down
     * @private
     * 
     * @param {PointerEvent} e - Pointer event
     */
    _onPointerDown(e) {
        e.preventDefault();
        this._isPressed = true;
        
        // Visual feedback
        this._showPressedState();
        
        // Start hold timer
        this._holdTimer = setTimeout(() => {
            this._handleHold();
        }, this._holdDuration);
    }

    /**
     * Handle pointer up
     * @private
     * 
     * @param {PointerEvent} e - Pointer event
     */
    _onPointerUp(e) {
        e.preventDefault();
        
        if (!this._isPressed) return;
        
        this._isPressed = false;
        
        // Clear hold timer
        if (this._holdTimer) {
            clearTimeout(this._holdTimer);
            this._holdTimer = null;
        }
        
        // Visual feedback
        this._showNormalState();
        
        // Check for double-tap
        const now = Date.now();
        const timeSinceLastTap = now - this._lastTapTime;
        
        if (timeSinceLastTap < this._doubleTapWindow) {
            // Double tap
            this._handleDoubleTap();
            this._lastTapTime = 0;  // Reset
        } else {
            // Single tap
            this._handleTap();
            this._lastTapTime = now;
        }
    }

    /**
     * Handle pointer cancel
     * @private
     */
    _onPointerCancel() {
        this._isPressed = false;
        
        if (this._holdTimer) {
            clearTimeout(this._holdTimer);
            this._holdTimer = null;
        }
        
        this._showNormalState();
    }

    /**
     * Handle keyboard down
     * @private
     * 
     * @param {KeyboardEvent} e - Keyboard event
     */
    _onKeyDown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            
            if (!this._isPressed) {
                this._isPressed = true;
                this._showPressedState();
                
                // Start hold timer
                this._holdTimer = setTimeout(() => {
                    this._handleHold();
                }, this._holdDuration);
            }
        }
    }

    /**
     * Handle keyboard up
     * @private
     * 
     * @param {KeyboardEvent} e - Keyboard event
     */
    _onKeyUp(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            
            if (this._isPressed) {
                this._isPressed = false;
                
                if (this._holdTimer) {
                    clearTimeout(this._holdTimer);
                    this._holdTimer = null;
                }
                
                this._showNormalState();
                this._handleTap();
            }
        }
    }

    /**
     * Handle tap action
     * @private
     */
    _handleTap() {
        const action = this.config.tap_action || { action: 'toggle' };
        
        cblcarsLog.debug(`[TapControl ${this.config.id}] Tap action:`, action);
        
        // Trigger press animation
        if (this._buttonShapeOverlay) {
            this._buttonShapeOverlay.animatePress();
        }
        
        // Execute action via button-card action bridge
        this._executeAction(action);
    }

    /**
     * Handle hold action
     * @private
     */
    _handleHold() {
        const action = this.config.hold_action || { action: 'more-info' };
        
        cblcarsLog.debug(`[TapControl ${this.config.id}] Hold action:`, action);
        
        this._executeAction(action);
    }

    /**
     * Handle double-tap action
     * @private
     */
    _handleDoubleTap() {
        const action = this.config.double_tap_action || { action: 'none' };
        
        cblcarsLog.debug(`[TapControl ${this.config.id}] Double-tap action:`, action);
        
        if (action.action !== 'none') {
            this._executeAction(action);
        }
    }

    /**
     * Execute Home Assistant action
     * @private
     * 
     * @param {Object} action - Action configuration
     */
    _executeAction(action) {
        if (!action || action.action === 'none') {
            return;
        }

        const entity = this.config.entity;
        const hass = this.pipeline?.systemsManager?.hass;

        if (!hass) {
            cblcarsLog.error(`[TapControl ${this.config.id}] HASS not available`);
            return;
        }

        // Execute action based on type
        switch (action.action) {
            case 'toggle':
                if (entity) {
                    this._toggleEntity(hass, entity);
                }
                break;

            case 'turn_on':
                if (entity) {
                    this._turnOnEntity(hass, entity);
                }
                break;

            case 'turn_off':
                if (entity) {
                    this._turnOffEntity(hass, entity);
                }
                break;

            case 'call-service':
                this._callService(hass, action);
                break;

            case 'navigate':
                this._navigate(action.navigation_path);
                break;

            case 'url':
                this._openUrl(action.url_path);
                break;

            case 'more-info':
                if (entity) {
                    this._showMoreInfo(entity);
                }
                break;

            case 'fire-dom-event':
                this._fireDomEvent(action);
                break;

            default:
                cblcarsLog.warn(`[TapControl ${this.config.id}] Unknown action type:`, action.action);
        }
    }

    /**
     * Toggle entity
     * @private
     */
    async _toggleEntity(hass, entityId) {
        const domain = entityId.split('.')[0];
        await hass.callService(domain, 'toggle', { entity_id: entityId });
    }

    /**
     * Turn on entity
     * @private
     */
    async _turnOnEntity(hass, entityId) {
        const domain = entityId.split('.')[0];
        await hass.callService(domain, 'turn_on', { entity_id: entityId });
    }

    /**
     * Turn off entity
     * @private
     */
    async _turnOffEntity(hass, entityId) {
        const domain = entityId.split('.')[0];
        await hass.callService(domain, 'turn_off', { entity_id: entityId });
    }

    /**
     * Call Home Assistant service
     * @private
     */
    async _callService(hass, action) {
        const [domain, service] = action.service.split('.');
        await hass.callService(domain, service, action.service_data || {});
    }

    /**
     * Navigate to path
     * @private
     */
    _navigate(path) {
        window.history.pushState(null, '', path);
        window.dispatchEvent(new CustomEvent('location-changed'));
    }

    /**
     * Open URL
     * @private
     */
    _openUrl(url) {
        window.open(url, '_blank');
    }

    /**
     * Show more info dialog
     * @private
     */
    _showMoreInfo(entityId) {
        const event = new CustomEvent('hass-more-info', {
            detail: { entityId },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    /**
     * Fire DOM event
     * @private
     */
    _fireDomEvent(action) {
        const event = new CustomEvent('ll-custom', {
            detail: action,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    /**
     * Show pressed visual state
     * @private
     */
    _showPressedState() {
        // Could add visual feedback here
        // For now, the button shape overlay handles it
    }

    /**
     * Show normal visual state
     * @private
     */
    _showNormalState() {
        // Could add visual feedback here
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._holdTimer) {
            clearTimeout(this._holdTimer);
        }
    }
}

// Register custom element
customElements.define('cb-lcars-tap-control', TapControl);
```

#### Step 3: Update CBLCARSButtonCard

**File:** `src/cb-lcars.js` (CBLCARSButtonCard class)

```javascript
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
        // Determine if should use modern architecture
        const useModern = config.use_modern || 
                         config.variables?.use_modern || 
                         this._shouldAutoMigrate(config);

        const defaultCardType = config.cblcars_card_type || 'cb-lcars-button-lozenge';
        const defaultTemplates = useModern ? [] : [defaultCardType];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        let specialConfig;
        if (useModern) {
            // Build modern config with overlays/controls
            specialConfig = this._buildModernButtonConfig({
                ...config,
                template: mergedTemplates
            });
        } else {
            // Use legacy YAML template
            specialConfig = {
                ...config,
                template: mergedTemplates
            };
        }

        super.setConfig(specialConfig);
    }

    /**
     * Check if should auto-migrate to modern architecture
     * @private
     * 
     * @param {Object} config - Card configuration
     * @returns {boolean} True if should migrate
     */
    _shouldAutoMigrate(config) {
        // Auto-migrate if using new-style config (overlays/controls/rules)
        if (config.variables?.overlays || config.variables?.controls || config.variables?.rules) {
            return true;
        }

        // Auto-migrate if legacy templates not available
        // (This would be true in future versions where templates are deprecated)
        // For now, default to false
        return false;
    }

    /**
     * Build modern button configuration
     * Translates legacy config to overlay/control/rules structure
     * @private
     * 
     * @param {Object} config - Legacy configuration
     * @returns {Object} Modern configuration
     */
    _buildModernButtonConfig(config) {
        // Extract button style from card type
        const cardType = config.cblcars_card_type || 'cb-lcars-button-lozenge';
        const shape = this._extractShapeFromCardType(cardType);
        
        // Calculate button dimensions
        const width = config.variables?.card?.width || 200;
        const height = config.variables?.card?.height || 40;
        const borderRadius = config.variables?.card?.border_radius || 20;

        const enhancedConfig = {
            ...config,
            variables: {
                ...config.variables,
                
                // Define overlays
                overlays: [
                    // Button background shape
                    {
                        id: 'button_shape',
                        type: 'button_shape',
                        x: 0,
                        y: 0,
                        width,
                        height,
                        shape,
                        border_radius: borderRadius,
                        fill: config.variables?.card?.color?.default || 'var(--lcars-card-button)',
                        stroke: config.variables?.card?.border?.color,
                        stroke_width: config.variables?.card?.border?.width || 0
                    },
                    
                    // Label text
                    {
                        id: 'label_text',
                        type: 'text',
                        x: width / 2,
                        y: height / 2,
                        text: config.label || config.name || '',
                        fill: config.variables?.text?.label?.color?.default || 'black',
                        font_size: config.variables?.text?.label?.font_size || 18,
                        font_family: config.variables?.text?.label?.font_family || 'Antonio, sans-serif',
                        font_weight: config.variables?.text?.label?.font_weight || 'bold',
                        text_anchor: 'middle',
                        dominant_baseline: 'middle',
                        text_transform: config.variables?.text?.label?.transform || 'uppercase'
                    }
                ],
                
                // Define controls
                controls: [
                    {
                        id: 'tap_control',
                        type: 'tap',
                        entity: config.entity,
                        tap_action: config.tap_action || { action: 'toggle' },
                        hold_action: config.hold_action || { action: 'more-info' },
                        double_tap_action: config.double_tap_action || { action: 'none' },
                        hold_duration: config.hold_duration || 500
                    }
                ]
            }
        };

        // Add rules for state-based styling
        enhancedConfig.variables.rules = this._buildButtonRules(config);

        return enhancedConfig;
    }

    /**
     * Extract shape type from legacy card type
     * @private
     * 
     * @param {string} cardType - Legacy card type
     * @returns {string} Shape type
     */
    _extractShapeFromCardType(cardType) {
        if (cardType.includes('lozenge')) return 'lozenge';
        if (cardType.includes('rectangle')) return 'rectangle';
        if (cardType.includes('pill')) return 'pill';
        if (cardType.includes('cap-left')) return 'cap-left';
        if (cardType.includes('cap-right')) return 'cap-right';
        if (cardType.includes('picard')) return 'picard';
        return 'lozenge';  // Default
    }

    /**
     * Build rules for button styling
     * @private
     * 
     * @param {Object} config - Configuration
     * @returns {Array} Rules array
     */
    _buildButtonRules(config) {
        const rules = [];
        
        // Active state (on, open, locked, etc.)
        rules.push({
            condition: {
                entity: config.entity,
                state_regex: '^(on|open|locked|home|playing)$'
            },
            apply: {
                style_preset: 'active',
                inline_styles: {
                    fill: config.variables?.card?.color?.active || 'var(--lcars-ui-secondary)',
                    text_color: config.variables?.text?.label?.color?.active || 'black'
                }
            }
        });
        
        // Inactive state (off, closed, unlocked, etc.)
        rules.push({
            condition: {
                entity: config.entity,
                state_regex: '^(off|closed|unlocked|away|idle|paused)$'
            },
            apply: {
                style_preset: 'inactive',
                inline_styles: {
                    fill: config.variables?.card?.color?.inactive || 'var(--lcars-ui-tertiary)',
                    text_color: config.variables?.text?.label?.color?.inactive || 'black',
                    opacity: 0.6
                }
            }
        });
        
        // Unavailable state
        rules.push({
            condition: {
                entity: config.entity,
                state: ['unavailable', 'unknown']
            },
            apply: {
                style_preset: 'unavailable',
                inline_styles: {
                    fill: config.variables?.card?.color?.unavailable || 'var(--lcars-card-button-unavailable)',
                    text_color: config.variables?.text?.label?.color?.unavailable || 'gray',
                    opacity: 0.5
                }
            }
        });

        // HVAC-specific states (if entity is climate)
        if (config.entity && config.entity.startsWith('climate.')) {
            rules.push({
                condition: {
                    entity: config.entity,
                    attribute: 'hvac_action',
                    equals: 'heating'
                },
                apply: {
                    inline_styles: {
                        fill: config.variables?.card?.color?.hvac_heat || 'var(--lcars-orange)',
                        animation: 'pulse'
                    }
                }
            });

            rules.push({
                condition: {
                    entity: config.entity,
                    attribute: 'hvac_action',
                    equals: 'cooling'
                },
                apply: {
                    inline_styles: {
                        fill: config.variables?.card?.color?.hvac_cool || 'var(--lcars-blue)',
                        animation: 'pulse'
                    }
                }
            });
        }

        return rules;
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
```

#### Step 4: Configuration Examples

**Legacy Configuration (Still Works):**

```yaml
type: cb-lcars-button-card
entity: light.desk
cblcars_card_type: cb-lcars-button-lozenge
label: "DESK LIGHT"
tap_action:
  action: toggle
variables:
  card:
    color:
      active: var(--lcars-ui-secondary)
      inactive: var(--lcars-ui-tertiary)
```

**Modern Configuration (Recommended):**

```yaml
type: cb-lcars-button-card
entity: light.desk
use_modern: true
label: "DESK LIGHT"
variables:
  # Button shape
  card:
    width: 200
    height: 40
  
  # Overlays (visual elements)
  overlays:
    - id: button_shape
      type: button_shape
      shape: lozenge  # lozenge, rectangle, pill, picard, etc.
      fill: var(--lcars-card-button)
  
  # Rules (state-based styling)
  rules:
    - condition: { state: "on" }
      apply:
        style_preset: active
        inline_styles:
          fill: var(--lcars-ui-secondary)
    
    - condition: { state: "off" }
      apply:
        style_preset: inactive
```

**Simplified Modern Configuration (Defaults):**

```yaml
type: cb-lcars-button-card
entity: light.desk
use_modern: true
label: "DESK LIGHT"
# Uses all defaults - lozenge shape, standard colors, toggle action
```

**Acceptance Criteria:**
- ✅ ButtonShapeOverlay created with all shapes
- ✅ TapControl created with all actions
- ✅ CBLCARSButtonCard updated for dual mode
- ✅ Legacy configs still work
- ✅ Modern configs work
- ✅ Auto-migration logic implemented
- ✅ Visual parity achieved
- ✅ All entity types supported
- ✅ All tap actions work
- ✅ Rules engine integration
- ✅ State-based styling equivalent

---

Due to the extensive length of the remaining tasks, I'll provide a summary structure for the remaining card migrations:

## 6.3: Migrate Elbow Cards
- Extract elbow shape generation to ElbowShapeOverlay
- Support all orientations (TL, TR, BL, BR)
- Support Picard and basic styles
- Preserve border sizing logic
- Similar dual-mode pattern as button

## 6.4: Migrate Label Cards
- Simpler migration (primarily text overlays)
- LabelTextOverlay with all formatting options
- Background shape overlay (optional)
- Rules for text color/styling

## 6.5: Migrate D-Pad Card
- Complex SVG generation to DPadOverlay
- Four TapControls (up, down, left, right)
- Center button optional
- Preserve directional action configuration

## 6.6: Migrate Double Elbow Card
- Two ElbowShapeOverlays combined
- Gap spacing configuration
- Coordinated styling
- Similar to elbow but more complex layout

## 6.7: Deprecate Legacy Templates
- Mark all YAML templates as deprecated
- Add migration warnings
- Create automated migration tool
- Set timeline for removal

## 6.8: Migration Tools & Automation
- Config migration script
- Bulk dashboard migration tool
- Validation tool
- Rollback capability

---

## Phase 6 Completion Criteria

### Functional Requirements
- ✅ All card types migrated
- ✅ Backward compatibility maintained
- ✅ Visual parity achieved
- ✅ Feature parity achieved
- ✅ Performance equal or better
- ✅ Migration tools provided

### Technical Requirements
- ✅ 70%+ YAML reduction
- ✅ Rules engine everywhere
- ✅ Overlay system everywhere
- ✅ Control system everywhere
- ✅ Unified architecture
- ✅ JSDoc complete

### Testing Requirements
- ✅ All cards tested
- ✅ Migration tested
- ✅ Backward compatibility verified
- ✅ Performance benchmarks met
- ✅ Cross-card tests pass

### Documentation Requirements
- ✅ Migration guides for each card
- ✅ Modern config examples
- ✅ Troubleshooting guides
- ✅ API documentation
- ✅ Best practices

---

**End of Phase 6**