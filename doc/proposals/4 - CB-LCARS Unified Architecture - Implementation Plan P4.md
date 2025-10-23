# CB-LCARS Unified Architecture - Implementation Phase 4

**Phase 4: Modernize Multimeter Card**

**Goal:** Replace `my-slider-v2` dependency and modernize multimeter using new overlay/control system

**Priority:** Medium - First legacy card migration demonstrating unified architecture

---

## Phase 4 Tasks Overview

```
Phase 4: Modernize Multimeter Card
├─ 4.1: Analyze Current Multimeter Implementation
├─ 4.2: Design New Multimeter Architecture
├─ 4.3: Create Gauge Overlay
├─ 4.4: Integrate Native Slider Control
├─ 4.5: Implement Multimeter Modes
├─ 4.6: Add Visual Feedback & Animations
├─ 4.7: Create Migration Path
└─ 4.8: Testing & Validation
```

---

## 4.1: Analyze Current Multimeter Implementation

**Purpose:** Understand current multimeter to plan migration

### Current Architecture Analysis

**File:** `src/cb-lcars/cb-lcars-multimeter.yaml`

**Current Features:**
- Multiple modes: `gauge`, `slider`, `hybrid`
- Multiple styles: `basic`, `picard`
- Orientation: `horizontal`, `vertical`
- Entity integration with auto-detection of min/max
- Support for various entity types (light, fan, climate, input_number)
- Slider modes: brightness, temperature, saturation, hue, volume
- Visual elements: gauge with ticks, slider track, labels

**Current Dependencies:**
- ❌ `my-slider-v2` custom card (external)
- ✅ Complex SVG generation in YAML templates
- ✅ Button-card state blocks for styling

**Current Problems:**
1. **External dependency**: Users must install `my-slider-v2` separately
2. **Configuration mismatch**: Different config format than CB-LCARS conventions
3. **Limited customization**: Can't easily modify slider appearance
4. **No native LCARS styling**: Slider doesn't match LCARS aesthetic
5. **Complex YAML**: 800+ lines of template code
6. **Difficult maintenance**: Changes require updating multiple state blocks

### Migration Goals

**Functional Parity:**
- ✅ All current modes supported
- ✅ All entity types supported
- ✅ All slider modes supported
- ✅ Visual appearance maintained or improved

**Improvements:**
- ✅ Remove `my-slider-v2` dependency
- ✅ Use native slider control from Phase 2
- ✅ Use overlay system for gauge visualization
- ✅ Use rules engine for state management
- ✅ Reduce YAML complexity by 70%+
- ✅ Better performance
- ✅ More customizable

---

## 4.2: Design New Multimeter Architecture

**Purpose:** Define new multimeter structure using unified architecture

### New Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  CBLCARSMultimeterCardV2                         │
│                   (extends CBLCARSBaseCard)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─ Pipeline (from core)
                              │  ├─ SystemsManager (entity tracking)
                              │  ├─ RulesEngine (state evaluation)
                              │  └─ StyleLibrary (preset application)
                              │
                              ├─ Overlays (visual display)
                              │  ├─ GaugeOverlay (gauge visualization)
                              │  ├─ TextOverlay (value display)
                              │  ├─ LineOverlay (tick marks)
                              │  └─ LabelOverlay (min/max labels)
                              │
                              └─ Controls (interaction)
                                 └─ SliderControl (native slider)
```

### Component Responsibilities

#### GaugeOverlay
- Render gauge arc or bar
- Show current value position
- Display tick marks
- Handle vertical/horizontal orientations
- Support different gauge styles (basic, picard)
- Animate value changes

#### SliderControl
- Handle user interaction (drag, click, keyboard)
- Call Home Assistant services
- Support multiple modes (brightness, temperature, etc.)
- Auto-detect entity capabilities (min/max/step)
- Provide haptic/visual feedback

#### TextOverlay
- Display current value
- Show unit of measurement
- Format numbers (decimal places)
- Update on value changes

#### RulesEngine Integration
- State-based styling (on/off/unavailable)
- Mode-specific color schemes
- Range-based visual changes
- Error state handling

### Configuration Structure

**New YAML Format:**

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
variables:
  # Mode selection
  mode: gauge  # gauge, slider, hybrid
  orientation: vertical  # horizontal, vertical
  style: picard  # basic, picard
  
  # Slider configuration
  slider:
    mode: brightness  # brightness, temperature, volume, generic
    step: 1
    min: 0  # Optional override
    max: 100  # Optional override
  
  # Gauge configuration
  gauge:
    show_ticks: true
    tick_count: 10
    show_labels: true
    decimal_places: 0
  
  # Visual styling
  colors:
    active: var(--lcars-ui-secondary)
    inactive: var(--lcars-ui-tertiary)
    track: var(--lcars-card-button-off)
  
  # Rules for state-based styling
  rules:
    - condition: { state: "on" }
      apply: { style_preset: active }
    
    - condition: { state: "off" }
      apply: { style_preset: inactive }
```

**Acceptance Criteria:**
- ✅ Architecture diagram complete
- ✅ Component responsibilities defined
- ✅ Configuration format designed
- ✅ Backward compatibility considered

---

## 4.3: Create Gauge Overlay

**Purpose:** Build gauge visualization overlay for multimeter

**File:** `src/components/overlays/gauge-overlay.js`

```javascript
/**
 * GaugeOverlay - Gauge Visualization for Multimeter
 * 
 * Renders gauge in various styles (arc, bar, picard)
 * Supports horizontal and vertical orientations
 * Displays current value, tick marks, and labels
 * Animates value changes with anime.js v4
 * 
 * @extends BaseOverlay
 */

import { BaseOverlay } from './base-overlay.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class GaugeOverlay extends BaseOverlay {
    /**
     * Create a gauge overlay
     * 
     * @param {Object} config - Gauge configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {number} config.width - Gauge width
     * @param {number} config.height - Gauge height
     * @param {string} config.entity - Entity ID
     * @param {string} config.style - Gauge style (basic, picard, arc)
     * @param {string} config.orientation - horizontal or vertical
     * @param {number} config.min - Minimum value
     * @param {number} config.max - Maximum value
     * @param {boolean} config.show_ticks - Show tick marks
     * @param {number} config.tick_count - Number of ticks
     * @param {boolean} config.show_labels - Show value labels
     * @param {number} config.decimal_places - Decimal places for value
     * @param {Object} config.colors - Color configuration
     * @param {Object} pipeline - Pipeline reference
     */
    constructor(config, pipeline) {
        super(config, pipeline);
        
        // Set defaults
        this.config.style = config.style || 'basic';
        this.config.orientation = config.orientation || 'vertical';
        this.config.min = config.min || 0;
        this.config.max = config.max || 100;
        this.config.show_ticks = config.show_ticks !== false;
        this.config.tick_count = config.tick_count || 10;
        this.config.show_labels = config.show_labels !== false;
        this.config.decimal_places = config.decimal_places || 0;
        
        this.config.colors = {
            active: config.colors?.active || 'var(--lcars-ui-secondary)',
            inactive: config.colors?.inactive || 'var(--lcars-ui-tertiary)',
            background: config.colors?.background || 'var(--lcars-card-button-off)'
        };
        
        // Current value
        this._currentValue = 0;
        this._currentPercentage = 0;
        
        // Animation scope
        this._animScope = null;
    }

    /**
     * Initialize gauge
     */
    async onInitialize() {
        // Get initial value from entity
        if (this.config.entity) {
            const state = this.pipeline.getEntityState(this.config.entity);
            if (state) {
                this._currentValue = this._extractValue(state);
                this._currentPercentage = this._valueToPercentage(this._currentValue);
            }
        }
        
        // Create animation scope
        const scopeId = `gauge-${this.config.id}`;
        this._animScope = window.cblcars.anim.animejs.createScope();
        
        cblcarsLog.debug(`[GaugeOverlay ${this.config.id}] Initialized with value:`, this._currentValue);
    }

    /**
     * Render gauge based on style
     */
    render() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-gauge');
        g.setAttribute('transform', `translate(${this.config.x}, ${this.config.y})`);

        // Render based on style
        switch (this.config.style) {
            case 'picard':
                this._renderPicardGauge(g);
                break;
            case 'arc':
                this._renderArcGauge(g);
                break;
            case 'basic':
            default:
                this._renderBasicGauge(g);
                break;
        }

        this.element = g;
    }

    /**
     * Render basic bar gauge
     * @private
     * 
     * @param {SVGElement} container - Container element
     */
    _renderBasicGauge(container) {
        const isVertical = this.config.orientation === 'vertical';
        const width = this.config.width;
        const height = this.config.height;

        // Background track
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        track.setAttribute('class', 'gauge-track');
        track.setAttribute('x', 0);
        track.setAttribute('y', 0);
        track.setAttribute('width', width);
        track.setAttribute('height', height);
        track.setAttribute('fill', this.config.colors.background);
        track.setAttribute('rx', 2);
        container.appendChild(track);

        // Value fill
        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fill.setAttribute('class', 'gauge-fill');
        fill.setAttribute('x', 0);
        fill.setAttribute('fill', this.config.colors.active);
        fill.setAttribute('rx', 2);
        
        if (isVertical) {
            const fillHeight = (height * this._currentPercentage) / 100;
            fill.setAttribute('y', height - fillHeight);
            fill.setAttribute('width', width);
            fill.setAttribute('height', fillHeight);
        } else {
            const fillWidth = (width * this._currentPercentage) / 100;
            fill.setAttribute('y', 0);
            fill.setAttribute('width', fillWidth);
            fill.setAttribute('height', height);
        }
        
        container.appendChild(fill);

        // Tick marks
        if (this.config.show_ticks) {
            this._renderTickMarks(container);
        }

        // Value label
        if (this.config.show_labels) {
            this._renderValueLabel(container);
        }
    }

    /**
     * Render Picard-style gauge
     * @private
     * 
     * @param {SVGElement} container - Container element
     */
    _renderPicardGauge(container) {
        const isVertical = this.config.orientation === 'vertical';
        const width = this.config.width;
        const height = this.config.height;

        // Picard style has colored border frame
        const borderWidth = 10;
        const innerWidth = width - borderWidth * 2;
        const innerHeight = height - borderWidth * 2;

        // Outer border
        const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        border.setAttribute('class', 'gauge-border');
        border.setAttribute('x', 0);
        border.setAttribute('y', 0);
        border.setAttribute('width', width);
        border.setAttribute('height', height);
        border.setAttribute('fill', 'none');
        border.setAttribute('stroke', this.config.colors.active);
        border.setAttribute('stroke-width', borderWidth);
        border.setAttribute('rx', 5);
        container.appendChild(border);

        // Inner track
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        track.setAttribute('class', 'gauge-track');
        track.setAttribute('x', borderWidth);
        track.setAttribute('y', borderWidth);
        track.setAttribute('width', innerWidth);
        track.setAttribute('height', innerHeight);
        track.setAttribute('fill', this.config.colors.background);
        container.appendChild(track);

        // Segmented fill (Picard style uses segments)
        const segmentCount = 10;
        const segmentGap = 2;
        
        if (isVertical) {
            const segmentHeight = (innerHeight - (segmentCount - 1) * segmentGap) / segmentCount;
            const filledSegments = Math.floor((this._currentPercentage / 100) * segmentCount);
            
            for (let i = 0; i < segmentCount; i++) {
                const segment = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                segment.setAttribute('class', `gauge-segment segment-${i}`);
                segment.setAttribute('x', borderWidth);
                segment.setAttribute('y', borderWidth + innerHeight - (i + 1) * (segmentHeight + segmentGap));
                segment.setAttribute('width', innerWidth);
                segment.setAttribute('height', segmentHeight);
                
                // Color based on filled state
                if (i < filledSegments) {
                    segment.setAttribute('fill', this.config.colors.active);
                } else {
                    segment.setAttribute('fill', this.config.colors.inactive);
                    segment.setAttribute('opacity', 0.3);
                }
                
                container.appendChild(segment);
            }
        } else {
            const segmentWidth = (innerWidth - (segmentCount - 1) * segmentGap) / segmentCount;
            const filledSegments = Math.floor((this._currentPercentage / 100) * segmentCount);
            
            for (let i = 0; i < segmentCount; i++) {
                const segment = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                segment.setAttribute('class', `gauge-segment segment-${i}`);
                segment.setAttribute('x', borderWidth + i * (segmentWidth + segmentGap));
                segment.setAttribute('y', borderWidth);
                segment.setAttribute('width', segmentWidth);
                segment.setAttribute('height', innerHeight);
                
                if (i < filledSegments) {
                    segment.setAttribute('fill', this.config.colors.active);
                } else {
                    segment.setAttribute('fill', this.config.colors.inactive);
                    segment.setAttribute('opacity', 0.3);
                }
                
                container.appendChild(segment);
            }
        }

        // Value label
        if (this.config.show_labels) {
            this._renderValueLabel(container, borderWidth);
        }
    }

    /**
     * Render arc-style gauge
     * @private
     * 
     * @param {SVGElement} container - Container element
     */
    _renderArcGauge(container) {
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const radius = Math.min(this.config.width, this.config.height) / 2 - 20;
        const strokeWidth = 20;

        // Background arc
        const bgArc = this._createArc(centerX, centerY, radius, 0, 100, strokeWidth);
        bgArc.setAttribute('stroke', this.config.colors.background);
        bgArc.setAttribute('fill', 'none');
        container.appendChild(bgArc);

        // Value arc
        const valueArc = this._createArc(centerX, centerY, radius, 0, this._currentPercentage, strokeWidth);
        valueArc.setAttribute('class', 'gauge-arc');
        valueArc.setAttribute('stroke', this.config.colors.active);
        valueArc.setAttribute('fill', 'none');
        valueArc.setAttribute('stroke-linecap', 'round');
        container.appendChild(valueArc);

        // Tick marks
        if (this.config.show_ticks) {
            this._renderArcTicks(container, centerX, centerY, radius);
        }

        // Value label in center
        if (this.config.show_labels) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('class', 'gauge-value-label');
            label.setAttribute('x', centerX);
            label.setAttribute('y', centerY);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('fill', this.config.colors.active);
            label.setAttribute('font-size', '24');
            label.setAttribute('font-family', 'Antonio, sans-serif');
            label.setAttribute('font-weight', 'bold');
            label.textContent = this._formatValue(this._currentValue);
            container.appendChild(label);
        }
    }

    /**
     * Create SVG arc path
     * @private
     * 
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Radius
     * @param {number} startPercent - Start percentage
     * @param {number} endPercent - End percentage
     * @param {number} strokeWidth - Stroke width
     * @returns {SVGElement} Arc path element
     */
    _createArc(cx, cy, radius, startPercent, endPercent, strokeWidth) {
        const startAngle = -90 + (startPercent / 100) * 270;  // Start at top, go 270 degrees
        const endAngle = -90 + (endPercent / 100) * 270;

        const start = this._polarToCartesian(cx, cy, radius, endAngle);
        const end = this._polarToCartesian(cx, cy, radius, startAngle);

        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        const d = [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke-width', strokeWidth);
        return path;
    }

    /**
     * Convert polar coordinates to cartesian
     * @private
     */
    _polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    }

    /**
     * Render tick marks
     * @private
     * 
     * @param {SVGElement} container - Container element
     */
    _renderTickMarks(container) {
        const isVertical = this.config.orientation === 'vertical';
        const width = this.config.width;
        const height = this.config.height;
        const tickCount = this.config.tick_count;

        for (let i = 0; i <= tickCount; i++) {
            const percent = (i / tickCount) * 100;
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('class', `gauge-tick tick-${i}`);
            tick.setAttribute('stroke', this.config.colors.inactive);
            tick.setAttribute('stroke-width', 1);

            if (isVertical) {
                const y = height - (height * percent) / 100;
                tick.setAttribute('x1', 0);
                tick.setAttribute('y1', y);
                tick.setAttribute('x2', 5);
                tick.setAttribute('y2', y);
            } else {
                const x = (width * percent) / 100;
                tick.setAttribute('x1', x);
                tick.setAttribute('y1', 0);
                tick.setAttribute('x2', x);
                tick.setAttribute('y2', 5);
            }

            container.appendChild(tick);
        }
    }

    /**
     * Render arc tick marks
     * @private
     */
    _renderArcTicks(container, cx, cy, radius) {
        const tickCount = this.config.tick_count;

        for (let i = 0; i <= tickCount; i++) {
            const percent = (i / tickCount) * 100;
            const angle = -90 + (percent / 100) * 270;
            
            const inner = this._polarToCartesian(cx, cy, radius - 15, angle);
            const outer = this._polarToCartesian(cx, cy, radius - 5, angle);

            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('class', `gauge-tick tick-${i}`);
            tick.setAttribute('x1', inner.x);
            tick.setAttribute('y1', inner.y);
            tick.setAttribute('x2', outer.x);
            tick.setAttribute('y2', outer.y);
            tick.setAttribute('stroke', this.config.colors.inactive);
            tick.setAttribute('stroke-width', 2);

            container.appendChild(tick);
        }
    }

    /**
     * Render value label
     * @private
     * 
     * @param {SVGElement} container - Container element
     * @param {number} offset - Offset for positioning (used in Picard style)
     */
    _renderValueLabel(container, offset = 0) {
        const isVertical = this.config.orientation === 'vertical';
        const width = this.config.width;
        const height = this.config.height;

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('class', 'gauge-value-label');
        label.setAttribute('fill', this.config.colors.active);
        label.setAttribute('font-size', '16');
        label.setAttribute('font-family', 'Antonio, sans-serif');
        label.setAttribute('font-weight', 'bold');
        label.textContent = this._formatValue(this._currentValue);

        if (isVertical) {
            label.setAttribute('x', width / 2);
            label.setAttribute('y', height + 20);
            label.setAttribute('text-anchor', 'middle');
        } else {
            label.setAttribute('x', width + 10);
            label.setAttribute('y', height / 2);
            label.setAttribute('dominant-baseline', 'middle');
        }

        container.appendChild(label);
    }

    /**
     * Extract value from entity state
     * @private
     * 
     * @param {Object} state - Entity state
     * @returns {number} Extracted value
     */
    _extractValue(state) {
        const domain = this.config.entity.split('.')[0];
        const mode = this.config.slider_mode || 'brightness';

        if (domain === 'light') {
            switch (mode) {
                case 'brightness':
                    return ((state.attributes.brightness || 0) / 256) * 100;
                case 'temperature':
                    return state.attributes.color_temp || 0;
                case 'saturation':
                    return state.attributes.hs_color?.[1] || 0;
                case 'hue':
                    return state.attributes.hs_color?.[0] || 0;
                default:
                    return parseFloat(state.state) || 0;
            }
        }

        return parseFloat(state.state) || 0;
    }

    /**
     * Convert value to percentage
     * @private
     * 
     * @param {number} value - Value
     * @returns {number} Percentage (0-100)
     */
    _valueToPercentage(value) {
        return ((value - this.config.min) / (this.config.max - this.config.min)) * 100;
    }

    /**
     * Format value for display
     * @private
     * 
     * @param {number} value - Value to format
     * @returns {string} Formatted value
     */
    _formatValue(value) {
        return value.toFixed(this.config.decimal_places);
    }

    /**
     * Update gauge with new value
     * 
     * @param {Object} state - Entity state
     */
    onUpdate(state) {
        const newValue = this._extractValue(state);
        const newPercentage = this._valueToPercentage(newValue);

        if (newValue === this._currentValue) {
            return;  // No change
        }

        cblcarsLog.debug(`[GaugeOverlay ${this.config.id}] Updating:`, this._currentValue, '→', newValue);

        this._animateValueChange(newValue, newPercentage);
        
        this._currentValue = newValue;
        this._currentPercentage = newPercentage;
    }

    /**
     * Animate value change
     * @private
     * 
     * @param {number} targetValue - Target value
     * @param {number} targetPercentage - Target percentage
     */
    _animateValueChange(targetValue, targetPercentage) {
        if (!this.element) return;

        const style = this.config.style;

        if (style === 'picard') {
            this._animatePicardSegments(targetPercentage);
        } else if (style === 'arc') {
            this._animateArc(targetPercentage);
        } else {
            this._animateBasicFill(targetPercentage);
        }

        // Animate value label
        const label = this.element.querySelector('.gauge-value-label');
        if (label) {
            const animTargets = { value: this._currentValue };
            
            window.cblcars.anim.anime(animTargets, {
                value: targetValue,
                duration: 300,
                easing: 'easeOutQuad',
                update: () => {
                    label.textContent = this._formatValue(animTargets.value);
                }
            });
        }
    }

    /**
     * Animate basic gauge fill
     * @private
     */
    _animateBasicFill(targetPercentage) {
        const fill = this.element.querySelector('.gauge-fill');
        if (!fill) return;

        const isVertical = this.config.orientation === 'vertical';
        const width = this.config.width;
        const height = this.config.height;

        if (isVertical) {
            const targetHeight = (height * targetPercentage) / 100;
            
            window.cblcars.anim.anime(fill, {
                height: targetHeight,
                y: height - targetHeight,
                duration: 300,
                easing: 'easeOutQuad'
            });
        } else {
            const targetWidth = (width * targetPercentage) / 100;
            
            window.cblcars.anim.anime(fill, {
                width: targetWidth,
                duration: 300,
                easing: 'easeOutQuad'
            });
        }
    }

    /**
     * Animate Picard segments
     * @private
     */
    _animatePicardSegments(targetPercentage) {
        const segments = this.element.querySelectorAll('.gauge-segment');
        if (!segments || segments.length === 0) return;

        const targetSegments = Math.floor((targetPercentage / 100) * segments.length);

        segments.forEach((segment, i) => {
            const shouldBeActive = i < targetSegments;
            const currentlyActive = segment.getAttribute('fill') === this.config.colors.active;

            if (shouldBeActive && !currentlyActive) {
                // Activate segment
                window.cblcars.anim.anime(segment, {
                    fill: this.config.colors.active,
                    opacity: 1,
                    duration: 200,
                    delay: i * 20,
                    easing: 'easeOutQuad'
                });
            } else if (!shouldBeActive && currentlyActive) {
                // Deactivate segment
                window.cblcars.anim.anime(segment, {
                    fill: this.config.colors.inactive,
                    opacity: 0.3,
                    duration: 200,
                    delay: i * 20,
                    easing: 'easeOutQuad'
                });
            }
        });
    }

    /**
     * Animate arc gauge
     * @private
     */
    _animateArc(targetPercentage) {
        const arc = this.element.querySelector('.gauge-arc');
        if (!arc) return;

        // Re-create arc with new percentage (anime.js can't interpolate SVG paths directly)
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;
        const radius = Math.min(this.config.width, this.config.height) / 2 - 20;
        const strokeWidth = 20;

        const animTargets = { percentage: this._currentPercentage };

        window.cblcars.anim.anime(animTargets, {
            percentage: targetPercentage,
            duration: 300,
            easing: 'easeOutQuad',
            update: () => {
                const newArc = this._createArc(centerX, centerY, radius, 0, animTargets.percentage, strokeWidth);
                arc.setAttribute('d', newArc.getAttribute('d'));
            }
        });
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this._animScope) {
            // Cleanup animations
            this._animScope = null;
        }
        
        super.destroy();
    }
}
```

**Register in ComponentRegistry:**

```javascript
// In src/components/registry.js
import { GaugeOverlay } from './overlays/gauge-overlay.js';

// In registerDefaults() method
registry.registerOverlay('gauge', GaugeOverlay);
```

**Acceptance Criteria:**
- ✅ GaugeOverlay class created
- ✅ Multiple styles supported (basic, picard, arc)
- ✅ Horizontal and vertical orientations
- ✅ Tick marks and labels
- ✅ Smooth value animations
- ✅ Entity integration
- ✅ Registered in component registry

---

## 4.4: Integrate Native Slider Control

**Purpose:** Use Phase 2 slider control in multimeter

**Implementation:** Connect slider control to gauge overlay

**Code: Multimeter Card Configuration Helper**

```javascript
// Add to CBLCARSMultimeterCard class

/**
 * Build multimeter configuration
 * Translates legacy config to new overlay/control structure
 * @private
 */
_buildMultimeterConfig(config) {
    const mode = config.variables?._mode || 'gauge';
    const orientation = config.variables?._vertical ? 'vertical' : 'horizontal';
    const style = config.variables?._gauge_style || 'basic';
    const sliderMode = config.variables?._slider_mode || 'brightness';
    
    const enhancedConfig = {
        ...config,
        variables: {
            ...config.variables,
            
            // Define overlays
            overlays: [],
            
            // Define controls
            controls: []
        }
    };
    
    // Add gauge overlay (if mode includes gauge)
    if (mode === 'gauge' || mode === 'hybrid') {
        enhancedConfig.variables.overlays.push({
            id: 'gauge',
            type: 'gauge',
            x: 0,
            y: 0,
            width: orientation === 'vertical' ? 40 : 200,
            height: orientation === 'vertical' ? 200 : 40,
            entity: config.entity,
            style: style,
            orientation: orientation,
            min: config.variables.entity_min,
            max: config.variables.entity_max,
            show_ticks: config.variables.gauge?.show_ticks !== false,
            tick_count: config.variables.gauge?.tick_count || 10,
            show_labels: config.variables.gauge?.show_labels !== false,
            decimal_places: config.variables._show_decimal_places || 0,
            slider_mode: sliderMode,
            colors: {
                active: config.variables.card?.color?.active || 'var(--lcars-ui-secondary)',
                inactive: config.variables.card?.color?.inactive || 'var(--lcars-ui-tertiary)',
                background: config.variables.card?.color?.background?.default || 'var(--lcars-card-button-off)'
            }
        });
    }
    
    // Add slider control (if mode includes slider)
    if (mode === 'slider' || mode === 'hybrid') {
        enhancedConfig.variables.controls.push({
            id: 'slider',
            type: 'slider',
            entity: config.entity,
            mode: sliderMode,
            orientation: orientation,
            min: config.variables.entity_min,
            max: config.variables.entity_max,
            step: config.variables._slider_step || 1
        });
    }
    
    // Add value label overlay
    enhancedConfig.variables.overlays.push({
        id: 'value_label',
        type: 'text',
        x: orientation === 'vertical' ? 45 : 205,
        y: orientation === 'vertical' ? 210 : 25,
        entity: config.entity,
        text: '${state}',
        fill: config.variables.card?.color?.active || 'var(--lcars-ui-secondary)',
        font_size: 16,
        font_family: 'Antonio, sans-serif'
    });
    
    // Add rules for state-based styling
    enhancedConfig.variables.rules = [
        {
            condition: { state: ['on', 'open', 'locked'] },
            apply: { style_preset: 'active' }
        },
        {
            condition: { state: ['off', 'closed', 'unlocked'] },
            apply: { style_preset: 'inactive' }
        },
        {
            condition: { state: ['unavailable', 'unknown'] },
            apply: { style_preset: 'unavailable' }
        }
    ];
    
    return enhancedConfig;
}
```

**Updated CBLCARSMultimeterCard:**

```javascript
class CBLCARSMultimeterCard extends CBLCARSBaseCard {
    static get cardType() {
        return 'cb-lcars-multimeter-card';
    }

    setConfig(config) {
        // Check for my-slider-v2 dependency
        if (!customElements.get('my-slider-v2') && !config.use_native_slider) {
            cblcarsLog.warn('[CBLCARSMultimeterCard] my-slider-v2 not found, using native slider');
            config.use_native_slider = true;
        }

        const defaultTemplates = ['cb-lcars-multimeter'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Use new architecture if native slider enabled
        const useNewArch = config.use_native_slider || config.variables?.use_native_slider;
        
        let specialConfig;
        if (useNewArch) {
            // Build modern config with overlays/controls
            specialConfig = this._buildMultimeterConfig({
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

    render() {
        // Check if native slider should be used
        const useNative = this._config.use_native_slider || this._config.variables?.use_native_slider;
        
        if (!useNative && !customElements.get('my-slider-v2')) {
            return html`
                <ha-alert alert-type="warning" title="CB-LCARS Multimeter - Migration Notice">
                    Required 'my-slider-v2' card is not available. 
                    <br><br>
                    <strong>Recommendation:</strong> Use native slider by adding to your config:
                    <br>
                    <code>use_native_slider: true</code>
                    <br><br>
                    Or install my-slider-v2 from HACS.
                </ha-alert>
            `;
        }

        return super.render();
    }

    // Helper method (defined above)
    _buildMultimeterConfig(config) {
        // ... implementation from above
    }
}
```

**Acceptance Criteria:**
- ✅ Native slider integrated
- ✅ Slider control connects to gauge
- ✅ Configuration helper translates legacy format
- ✅ Backward compatibility maintained
- ✅ Migration warning for missing my-slider-v2

---

## 4.5: Implement Multimeter Modes

**Purpose:** Support all multimeter modes (gauge, slider, hybrid)

### Mode Configurations

#### Gauge Only Mode

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true
variables:
  _mode: gauge
  _vertical: true
  _gauge_style: picard
  _slider_mode: brightness
```

**Behavior:**
- Shows gauge visualization only
- No user interaction
- Updates automatically with entity state
- Good for display-only scenarios

#### Slider Only Mode

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true
variables:
  _mode: slider
  _vertical: true
  _slider_mode: brightness
  _slider_step: 5
```

**Behavior:**
- Shows slider control only
- User can adjust value by dragging
- Minimal visual feedback (no gauge)
- Good for space-constrained layouts

#### Hybrid Mode

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true
variables:
  _mode: hybrid
  _vertical: true
  _gauge_style: picard
  _slider_mode: brightness
```

**Behavior:**
- Shows both gauge and slider
- Slider overlays on gauge
- Visual feedback from gauge
- Full-featured interaction
- Best user experience

### Layout Calculations

**Code: Layout Helper**

```javascript
/**
 * Calculate multimeter layout
 * @private
 * 
 * @param {Object} config - Configuration
 * @returns {Object} Layout dimensions
 */
_calculateLayout(config) {
    const mode = config.variables?._mode || 'gauge';
    const orientation = config.variables?._vertical ? 'vertical' : 'horizontal';
    const style = config.variables?._gauge_style || 'basic';
    
    const layout = {
        mode,
        orientation,
        style,
        gauge: null,
        slider: null,
        label: null
    };
    
    if (orientation === 'vertical') {
        // Vertical layout
        if (mode === 'gauge' || mode === 'hybrid') {
            layout.gauge = {
                x: 0,
                y: 0,
                width: style === 'picard' ? 60 : 40,
                height: 200
            };
        }
        
        if (mode === 'slider' || mode === 'hybrid') {
            if (mode === 'hybrid') {
                // Overlay slider on gauge
                layout.slider = {
                    x: style === 'picard' ? 25 : 14,
                    y: 5,
                    width: 12,
                    height: 190
                };
            } else {
                // Standalone slider
                layout.slider = {
                    x: 0,
                    y: 0,
                    width: 20,
                    height: 200
                };
            }
        }
        
        // Value label below
        layout.label = {
            x: mode === 'slider' ? 10 : (style === 'picard' ? 30 : 20),
            y: 215,
            anchor: 'middle'
        };
        
    } else {
        // Horizontal layout
        if (mode === 'gauge' || mode === 'hybrid') {
            layout.gauge = {
                x: 0,
                y: 0,
                width: 200,
                height: style === 'picard' ? 60 : 40
            };
        }
        
        if (mode === 'slider' || mode === 'hybrid') {
            if (mode === 'hybrid') {
                // Overlay slider on gauge
                layout.slider = {
                    x: 5,
                    y: style === 'picard' ? 25 : 14,
                    width: 190,
                    height: 12
                };
            } else {
                // Standalone slider
                layout.slider = {
                    x: 0,
                    y: 0,
                    width: 200,
                    height: 20
                };
            }
        }
        
        // Value label to right
        layout.label = {
            x: mode === 'slider' ? 205 : 205,
            y: mode === 'slider' ? 10 : (style === 'picard' ? 30 : 20),
            anchor: 'start'
        };
    }
    
    return layout;
}
```

**Acceptance Criteria:**
- ✅ Gauge-only mode works
- ✅ Slider-only mode works
- ✅ Hybrid mode works
- ✅ Layout calculations correct for all modes
- ✅ Vertical and horizontal orientations
- ✅ Picard and basic styles

---

## 4.6: Add Visual Feedback & Animations

**Purpose:** Enhance user experience with animations and feedback

### Animation Features

#### 1. Value Change Animation

Already implemented in GaugeOverlay `_animateValueChange()` method.

**Features:**
- Smooth gauge fill transition
- Animated value label counting
- Segment activation in Picard mode
- Arc interpolation in arc mode

#### 2. Interaction Feedback

**Code: Slider Interaction Feedback**

```javascript
// Add to SliderControl class

/**
 * Add visual feedback for interaction
 * @private
 */
_addInteractionFeedback() {
    const thumb = this.shadowRoot.querySelector('.slider-thumb');
    const fill = this.shadowRoot.querySelector('.slider-fill');
    
    if (!thumb || !fill) return;
    
    // Pulse effect on drag
    thumb.addEventListener('pointerdown', () => {
        window.cblcars.anim.anime(thumb, {
            scale: 1.3,
            duration: 150,
            easing: 'easeOutQuad'
        });
        
        // Brighten fill
        window.cblcars.anim.anime(fill, {
            opacity: 1,
            duration: 150,
            easing: 'easeOutQuad'
        });
    });
    
    document.addEventListener('pointerup', () => {
        window.cblcars.anim.anime(thumb, {
            scale: 1,
            duration: 150,
            easing: 'easeOutQuad'
        });
        
        window.cblcars.anim.anime(fill, {
            opacity: 0.9,
            duration: 150,
            easing: 'easeOutQuad'
        });
    });
}
```

#### 3. State Change Animations

**Pulse animation for alert states:**

```yaml
variables:
  rules:
    - condition:
        state: "on"
        attribute: brightness
        from: 250
        to: 255
      apply:
        style_preset: active
        animation: pulse  # Trigger pulse animation
```

**Implementation:**

```javascript
// In CBLCARSMultimeterCard or animation helper

/**
 * Apply state-based animations
 * @private
 */
_applyStateAnimation(animationName) {
    if (!animationName) return;
    
    const animPreset = this.pipeline.animationPresets.getPreset(animationName);
    if (!animPreset) return;
    
    // Apply to gauge
    const gauge = this._overlays.find(o => o.config.id === 'gauge');
    if (gauge && gauge.element) {
        window.cblcars.anim.anime(gauge.element, {
            ...animPreset,
            loop: true
        });
    }
}
```

#### 4. Startup Animation

**Gauge appearing animation:**

```javascript
// In GaugeOverlay.render()

/**
 * Animate gauge appearance
 * @private
 */
_animateAppearance() {
    if (!this.element) return;
    
    // Start invisible
    this.element.style.opacity = '0';
    
    // Fade in with scale
    window.cblcars.anim.anime(this.element, {
        opacity: 1,
        scale: [0.8, 1],
        duration: 600,
        easing: 'easeOutElastic',
        elasticity: 400
    });
}

// Call in render() after element created
render() {
    // ... create element ...
    
    this.element = g;
    
    // Animate appearance
    requestAnimationFrame(() => {
        this._animateAppearance();
    });
}
```

**Acceptance Criteria:**
- ✅ Value changes animate smoothly
- ✅ Slider interaction has visual feedback
- ✅ State changes trigger animations
- ✅ Startup animation on card load
- ✅ All animations use anime.js v4
- ✅ Performance maintained

---

## 4.7: Create Migration Path

**Purpose:** Provide smooth transition from old to new multimeter

### Migration Strategy

#### Phase 1: Opt-in Native Slider

Users can test new system by adding `use_native_slider: true`:

```yaml
# Old config (still works)
type: cb-lcars-multimeter-card
entity: light.desk
variables:
  _mode: gauge
  _vertical: true

# New config (opt-in)
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true  # ← Add this
variables:
  _mode: gauge
  _vertical: true
```

#### Phase 2: Automatic Migration

**Code: Auto-Migration Helper**

```javascript
/**
 * Migrate legacy multimeter config
 * @param {Object} config - Legacy config
 * @returns {Object} Migrated config
 */
function migrateMult imeterConfig(config) {
    // Check if already using new format
    if (config.variables?.overlays || config.variables?.controls) {
        return config;  // Already migrated
    }
    
    // Check if my-slider-v2 is available
    const hasMySlider = customElements.get('my-slider-v2');
    
    // Auto-migrate if no my-slider-v2
    if (!hasMySlider) {
        cblcarsLog.info('[Migration] Auto-migrating multimeter to native slider');
        config.use_native_slider = true;
    }
    
    return config;
}
```

#### Phase 3: Deprecation Notice

**Display notice in card:**

```javascript
render() {
    const useNative = this._config.use_native_slider;
    const hasMySlider = customElements.get('my-slider-v2');
    
    if (!useNative && hasMySlider) {
        // Show deprecation notice
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            background: var(--warning-color);
            color: white;
            padding: 4px 8px;
            font-size: 10px;
            border-radius: 4px;
            z-index: 999;
        `;
        notice.textContent = 'Legacy Mode';
        notice.title = 'Using my-slider-v2 (deprecated). Add use_native_slider: true to upgrade.';
        
        this.shadowRoot.appendChild(notice);
    }
    
    return super.render();
}
```

### Migration Documentation

**File:** `docs/migration/multimeter-v2.md`

````markdown
# Multimeter Card Migration Guide

## Overview

The CB-LCARS Multimeter card is being modernized to remove the `my-slider-v2` dependency and use native CB-LCARS components.

## Why Migrate?

- ✅ Remove external dependency
- ✅ Better LCARS styling
- ✅ Improved performance
- ✅ More customization options
- ✅ Future-proof architecture

## Migration Steps

### Step 1: Test New System (Optional)

Add `use_native_slider: true` to your existing config:

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true  # ← Add this line
variables:
  _mode: gauge
  _vertical: true
  _gauge_style: picard
```

### Step 2: Verify Functionality

Test all features:
- [ ] Gauge displays correctly
- [ ] Slider interaction works
- [ ] Values update properly
- [ ] Styling matches expectations

### Step 3: Update All Multimeters

Once verified, update all multimeter cards in your dashboard.

## Configuration Changes

### Old Format (Legacy)

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
variables:
  _mode: gauge
  _slider_mode: brightness
  _vertical: true
  _gauge_style: picard
```

### New Format (Recommended)

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
use_native_slider: true
variables:
  _mode: gauge
  _slider_mode: brightness
  _vertical: true
  _gauge_style: picard
```

**Note:** All existing variables are supported!

## Breaking Changes

**None!** The new system is backward compatible.

## Troubleshooting

### Slider not responding

Make sure `use_native_slider: true` is set at the card level (not under variables).

### Visual differences

The native slider has slightly different styling. This is intentional and matches LCARS design better.

### Missing features

If you find any missing features, please report an issue on GitHub.

## Timeline

- **Current (v2.0):** Opt-in native slider
- **v2.1 (Q2 2025):** Auto-migration if my-slider-v2 not installed
- **v3.0 (Q3 2025):** Native slider becomes default
- **v4.0 (Q4 2025):** Legacy mode removed, my-slider-v2 no longer supported

## Support

For help with migration:
- Join our [Discord server](https://discord.gg/cblcars)
- Open an [issue on GitHub](https://github.com/snootched/cb-lcars/issues)
- Check the [documentation](https://cb-lcars.unimatrix01.ca/docs/multimeter)
````

**Acceptance Criteria:**
- ✅ Opt-in migration available
- ✅ Auto-migration logic implemented
- ✅ Deprecation notices shown
- ✅ Migration documentation written
- ✅ Timeline communicated
- ✅ Support channels listed

---

## 4.8: Testing & Validation

**Purpose:** Comprehensive testing of new multimeter

### Test Matrix

| Mode | Orientation | Style | Entity Type | Slider Mode | Status |
|------|-------------|-------|-------------|-------------|--------|
| gauge | vertical | basic | light | brightness | ⏳ |
| gauge | vertical | picard | light | brightness | ⏳ |
| gauge | horizontal | basic | light | brightness | ⏳ |
| gauge | horizontal | picard | light | brightness | ⏳ |
| slider | vertical | - | light | brightness | ⏳ |
| slider | horizontal | - | light | brightness | ⏳ |
| hybrid | vertical | picard | light | brightness | ⏳ |
| hybrid | horizontal | picard | light | brightness | ⏳ |
| gauge | vertical | arc | light | brightness | ⏳ |
| gauge | vertical | basic | light | temperature | ⏳ |
| gauge | vertical | basic | fan | percentage | ⏳ |
| gauge | vertical | basic | input_number | generic | ⏳ |
| gauge | vertical | basic | climate | temperature | ⏳ |

### Test Scenarios

#### Test 1: Basic Functionality

```yaml
type: cb-lcars-multimeter-card
entity: light.test_light
use_native_slider: true
variables:
  _mode: hybrid
  _vertical: true
  _gauge_style: picard
  _slider_mode: brightness
```

**Verify:**
- ✅ Gauge displays correctly
- ✅ Slider responds to drag
- ✅ Value updates in Home Assistant
- ✅ Visual feedback on interaction
- ✅ State changes reflect immediately

#### Test 2: Entity Type Coverage

```yaml
# Light entity
- type: cb-lcars-multimeter-card
  entity: light.desk
  use_native_slider: true
  variables:
    _slider_mode: brightness

# Fan entity
- type: cb-lcars-multimeter-card
  entity: fan.bedroom
  use_native_slider: true
  variables:
    _slider_mode: percentage

# Input number
- type: cb-lcars-multimeter-card
  entity: input_number.test
  use_native_slider: true

# Climate (temperature)
- type: cb-lcars-multimeter-card
  entity: climate.hvac
  use_native_slider: true
  variables:
    _slider_mode: temperature
```

**Verify:**
- ✅ Each entity type works
- ✅ Min/max auto-detected correctly
- ✅ Step values appropriate
- ✅ Units displayed correctly

#### Test 3: Performance

```yaml
# Dashboard with 20 multimeters
views:
  - cards:
    - type: grid
      cards:
        # 20x multimeter cards
```

**Verify:**
- ✅ Initial load < 3 seconds
- ✅ Interaction responsive (< 50ms)
- ✅ No memory leaks
- ✅ Smooth animations
- ✅ CPU usage acceptable

#### Test 4: Edge Cases

```yaml
# Unavailable entity
- type: cb-lcars-multimeter-card
  entity: light.nonexistent
  use_native_slider: true

# Entity with no brightness
- type: cb-lcars-multimeter-card
  entity: light.non_dimmable
  use_native_slider: true
  variables:
    _slider_mode: brightness

# Very large range
- type: cb-lcars-multimeter-card
  entity: input_number.huge
  use_native_slider: true
  variables:
    _min: 0
    _max: 1000000
```

**Verify:**
- ✅ Graceful error handling
- ✅ Appropriate error messages
- ✅ No JavaScript errors
- ✅ Card doesn't break dashboard

#### Test 5: Migration

```yaml
# Legacy config (no use_native_slider)
- type: cb-lcars-multimeter-card
  entity: light.desk
  variables:
    _mode: gauge
    _vertical: true
```

**Verify:**
- ✅ Auto-migration notice shown
- ✅ my-slider-v2 fallback works if installed
- ✅ Native slider works if my-slider-v2 missing
- ✅ No breaking changes to existing dashboards

### Automated Tests

**File:** `tests/multimeter-v2.test.js`

```javascript
describe('Multimeter Card V2', () => {
    let card;
    let hass;

    beforeEach(() => {
        card = document.createElement('cb-lcars-multimeter-card');
        hass = createMockHass();
        card.hass = hass;
    });

    test('renders gauge overlay', async () => {
        card.setConfig({
            type: 'cb-lcars-multimeter-card',
            entity: 'light.test',
            use_native_slider: true,
            variables: { _mode: 'gauge' }
        });

        await card.updateComplete;

        const gauge = card.shadowRoot.querySelector('.overlay-gauge');
        expect(gauge).toBeTruthy();
    });

    test('renders slider control', async () => {
        card.setConfig({
            type: 'cb-lcars-multimeter-card',
            entity: 'light.test',
            use_native_slider: true,
            variables: { _mode: 'slider' }
        });

        await card.updateComplete;

        const slider = card.shadowRoot.querySelector('cb-lcars-slider');
        expect(slider).toBeTruthy();
    });

    test('updates gauge on entity change', async () => {
        card.setConfig({
            type: 'cb-lcars-multimeter-card',
            entity: 'light.test',
            use_native_slider: true,
            variables: { _mode: 'gauge' }
        });

        await card.updateComplete;

        // Change entity state
        hass.states['light.test'] = {
            state: 'on',
            attributes: { brightness: 200 }
        };

        card.setHass(hass);
        await card.updateComplete;

        // Verify gauge updated
        const gauge = card._overlays.find(o => o.config.id === 'gauge');
        expect(gauge._currentValue).toBeCloseTo(78.13, 1);  // 200/256 * 100
    });

    test('calls service on slider change', async () => {
        const callServiceSpy = jest.spyOn(hass, 'callService');

        card.setConfig({
            type: 'cb-lcars-multimeter-card',
            entity: 'light.test',
            use_native_slider: true,
            variables: { _mode: 'slider', _slider_mode: 'brightness' }
        });

        await card.updateComplete;

        const slider = card.shadowRoot.querySelector('cb-lcars-slider');
        slider.setValue(50);

        expect(callServiceSpy).toHaveBeenCalledWith(
            'light',
            'turn_on',
            expect.objectContaining({
                entity_id: 'light.test',
                brightness: 128  // 50% of 256
            })
        );
    });

    test('migrates legacy config', () => {
        const legacyConfig = {
            type: 'cb-lcars-multimeter-card',
            entity: 'light.test',
            variables: {
                _mode: 'gauge',
                _vertical: true
            }
        };

        const migrated = card._buildMultimeterConfig(legacyConfig);

        expect(migrated.variables.overlays).toBeDefined();
        expect(migrated.variables.overlays.length).toBeGreaterThan(0);
    });
});
```

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ Edge cases handled gracefully
- ✅ Performance benchmarks met
- ✅ Automated tests written
- ✅ No regressions in existing functionality
- ✅ Migration tested thoroughly

---

## Phase 4 Completion Criteria

### Functional Requirements
- ✅ GaugeOverlay implemented with all styles
- ✅ Native slider control integrated
- ✅ All multimeter modes working (gauge, slider, hybrid)
- ✅ All entity types supported
- ✅ All slider modes supported
- ✅ Visual feedback and animations
- ✅ Migration path defined and tested

### Technical Requirements
- ✅ Removes my-slider-v2 dependency
- ✅ Uses unified architecture (overlays + controls)
- ✅ Uses rules engine for state management
- ✅ Anime.js v4 for all animations
- ✅ Proper shadowRoot usage
- ✅ JSDoc documentation complete
- ✅ No breaking changes

### Performance Requirements
- ✅ Initial render < 100ms
- ✅ Interaction latency < 50ms
- ✅ Animation framerate > 30fps
- ✅ Memory footprint < 2MB per card
- ✅ No memory leaks

### Testing Requirements
- ✅ All test matrix scenarios pass
- ✅ Edge cases handled
- ✅ Performance benchmarks met
- ✅ Automated tests written and passing
- ✅ Manual testing complete
- ✅ Migration tested

### Documentation Requirements
- ✅ Migration guide