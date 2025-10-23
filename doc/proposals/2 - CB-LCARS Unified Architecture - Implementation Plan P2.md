# CB-LCARS Unified Architecture - Implementation Phase 2

**Phase 2: Overlay & Control System Refactor**

**Goal:** Extract overlay/control system from MSD for use in standalone cards

**Priority:** High - Required for multimeter modernization

---

## Phase 2 Tasks Overview

```
Phase 2: Overlay & Control System Refactor
├─ 2.1: Extract BaseOverlay Class
├─ 2.2: Refactor Existing Overlays
├─ 2.3: Create OverlayRenderer Factory
├─ 2.4: Build Native Slider Control
├─ 2.5: Create ControlRenderer Factory
└─ 2.6: Test Overlays in Standalone Cards
```

---

## 2.1: Extract BaseOverlay Class

**Purpose:** Foundation for all overlays with loading states

**Current Location:** `src/msd/overlays/` (various overlay implementations)

**Target Location:** `src/components/overlays/base-overlay.js`

**Key Features:**
- Lifecycle management (initializing → pending → ready → error)
- Dependency waiting (data sources, entities, resources)
- Loading state visualization
- Error handling and display
- Update coordination

### Code: BaseOverlay Class

**File:** `src/components/overlays/base-overlay.js`

```javascript
/**
 * BaseOverlay - Foundation for All Overlays
 * 
 * Provides common functionality for overlay lifecycle:
 * - Dependency management (data sources, entities)
 * - Loading state visualization
 * - Error handling
 * - Update coordination
 * 
 * STATES:
 * - initializing: Setting up dependencies
 * - pending: Waiting for resources (shows loading indicator)
 * - ready: Fully operational (shows actual content)
 * - error: Failed to initialize (shows error message)
 * 
 * SUBCLASS REQUIREMENTS:
 * - Implement render() to create overlay content
 * - Optional: onInitialize() for custom setup
 * - Optional: onUpdate(data) for data updates
 * 
 * @example
 * class MyOverlay extends BaseOverlay {
 *   async onInitialize() {
 *     // Custom setup
 *   }
 *   
 *   render() {
 *     this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
 *     // ... create content
 *   }
 *   
 *   onUpdate(data) {
 *     // Update content
 *   }
 * }
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class BaseOverlay {
    /**
     * Create a new overlay
     * 
     * @param {Object} config - Overlay configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {string} config.entity - Entity ID (optional)
     * @param {string} config.data_source - Data source ID (optional)
     * @param {Object} pipeline - Pipeline reference (provides access to core systems)
     */
    constructor(config, pipeline) {
        this.config = config;
        this.pipeline = pipeline;
        this.element = null;
        
        // State management
        this._state = 'initializing';  // initializing, pending, ready, error
        this._pendingResources = new Set();
        this._errorMessage = null;
        
        // Animation tracking
        this._pendingAnimation = null;
        
        // Validation
        if (!config.id) {
            throw new Error('Overlay config must include id');
        }
    }

    /**
     * Initialize overlay
     * Handles data source dependencies and loading states
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        this._state = 'initializing';

        try {
            // Check for data source dependencies
            if (this.config.data_source) {
                await this._waitForDataSource(this.config.data_source);
            }

            // Check for entity dependencies
            if (this.config.entity) {
                await this._waitForEntity(this.config.entity);
            }

            // Subclass-specific initialization
            await this.onInitialize();

            this._state = 'ready';
            this._render();

        } catch (error) {
            this._state = 'error';
            this._errorMessage = error.message;
            this._renderError();
            cblcarsLog.error(`[BaseOverlay ${this.config.id}] Initialization failed:`, error);
        }
    }

    /**
     * Wait for data source to be available
     * @private
     * 
     * @param {string} dsId - Data source ID
     * @returns {Promise<void>}
     */
    async _waitForDataSource(dsId) {
        this._pendingResources.add(`data_source:${dsId}`);
        this._renderPending();

        const core = window.cblcars.core;
        
        // Check if data source exists
        if (!core._initializedDataSources.has(dsId)) {
            cblcarsLog.debug(`[${this.config.id}] Waiting for data source '${dsId}'...`);

            // Wait for data source to be declared and initialized
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    if (core._initializedDataSources.has(dsId)) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);

                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!core._initializedDataSources.has(dsId)) {
                        reject(new Error(`Data source '${dsId}' not available after 10s`));
                    }
                }, 10000);
            });
        }

        this._pendingResources.delete(`data_source:${dsId}`);
        cblcarsLog.debug(`[${this.config.id}] Data source '${dsId}' ready`);
    }

    /**
     * Wait for entity to be available
     * @private
     * 
     * @param {string} entityId - Entity ID
     * @returns {Promise<void>}
     */
    async _waitForEntity(entityId) {
        this._pendingResources.add(`entity:${entityId}`);
        this._renderPending();

        const hass = this.pipeline.systemsManager?.hass;
        if (!hass) {
            throw new Error('HASS not available');
        }

        // Check if entity exists
        if (!hass.states[entityId]) {
            cblcarsLog.warn(`[${this.config.id}] Entity '${entityId}' not found in HASS`);
            throw new Error(`Entity '${entityId}' not found`);
        }

        this._pendingResources.delete(`entity:${entityId}`);
    }

    /**
     * Render pending/loading state
     * @private
     */
    _renderPending() {
        if (!this.element) {
            this.element = this._createPendingElement();
        } else {
            this._updatePendingElement();
        }
    }

    /**
     * Create pending state element
     * @private
     * 
     * @returns {SVGElement} Pending indicator element
     */
    _createPendingElement() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-pending');
        g.setAttribute('data-state', 'pending');

        // Visual feedback for pending state
        const pendingText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pendingText.setAttribute('x', this.config.x || 0);
        pendingText.setAttribute('y', this.config.y || 0);
        pendingText.setAttribute('fill', 'var(--lcars-ui-tertiary)');
        pendingText.setAttribute('font-size', '12');
        pendingText.setAttribute('font-family', 'Antonio, sans-serif');
        pendingText.textContent = 'LOADING...';

        // Animated ellipsis
        this._animatePendingIndicator(pendingText);

        g.appendChild(pendingText);
        return g;
    }

    /**
     * Animate pending indicator
     * @private
     * 
     * @param {SVGElement} element - Text element to animate
     */
    _animatePendingIndicator(element) {
        const frames = ['LOADING', 'LOADING.', 'LOADING..', 'LOADING...'];
        let frameIndex = 0;

        this._pendingAnimation = setInterval(() => {
            element.textContent = frames[frameIndex];
            frameIndex = (frameIndex + 1) % frames.length;
        }, 400);
    }

    /**
     * Update pending element with current waiting resources
     * @private
     */
    _updatePendingElement() {
        if (!this.element) return;

        const text = this.element.querySelector('text');
        if (text && this._pendingResources.size > 0) {
            const resource = Array.from(this._pendingResources)[0];
            text.textContent = `WAITING: ${resource}`;
        }
    }

    /**
     * Render error state
     * @private
     */
    _renderError() {
        if (this._pendingAnimation) {
            clearInterval(this._pendingAnimation);
        }

        if (!this.element) {
            this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        }

        this.element.setAttribute('id', this.config.id);
        this.element.setAttribute('class', 'overlay-error');
        this.element.setAttribute('data-state', 'error');
        this.element.innerHTML = '';

        const errorText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        errorText.setAttribute('x', this.config.x || 0);
        errorText.setAttribute('y', this.config.y || 0);
        errorText.setAttribute('fill', 'var(--lcars-red)');
        errorText.setAttribute('font-size', '12');
        errorText.setAttribute('font-family', 'Antonio, sans-serif');
        errorText.textContent = `ERROR: ${this._errorMessage || 'Unknown error'}`;

        this.element.appendChild(errorText);
    }

    /**
     * Render ready state (actual overlay content)
     * @private
     */
    _render() {
        if (this._pendingAnimation) {
            clearInterval(this._pendingAnimation);
        }

        // Subclass implements actual rendering
        this.render();
        
        if (this.element) {
            this.element.setAttribute('data-state', 'ready');
        }
    }

    /**
     * Subclass hook for initialization
     * Override in subclasses for custom init logic
     * 
     * @returns {Promise<void>}
     */
    async onInitialize() {
        // Default: no-op
    }

    /**
     * Subclass hook for rendering
     * Override in subclasses to render actual content
     * 
     * MUST create and populate this.element
     * 
     * @abstract
     */
    render() {
        throw new Error('render() must be implemented by subclass');
    }

    /**
     * Update overlay with new data
     * 
     * @param {any} data - New data (entity state or data source data)
     */
    update(data) {
        if (this._state !== 'ready') {
            cblcarsLog.warn(`[${this.config.id}] Update called but state is '${this._state}'`);
            return;
        }

        this.onUpdate(data);
    }

    /**
     * Set HASS reference (for entity-based overlays)
     * 
     * @param {Object} hass - Home Assistant instance
     */
    setHass(hass) {
        // Can be overridden by subclasses if needed
    }

    /**
     * Subclass hook for updates
     * Override in subclasses to handle data updates
     * 
     * @param {any} data - New data
     */
    onUpdate(data) {
        // Default: no-op
    }

    /**
     * Get current overlay state
     * 
     * @returns {string} Current state (initializing, pending, ready, error)
     */
    getState() {
        return this._state;
    }

    /**
     * Check if overlay is ready
     * 
     * @returns {boolean} True if ready
     */
    isReady() {
        return this._state === 'ready';
    }

    /**
     * Cleanup overlay resources
     */
    destroy() {
        if (this._pendingAnimation) {
            clearInterval(this._pendingAnimation);
            this._pendingAnimation = null;
        }
        
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
        
        this.element = null;
        this._state = 'destroyed';
        
        cblcarsLog.debug(`[BaseOverlay ${this.config.id}] Destroyed`);
    }
}
```

**Acceptance Criteria:**
- ✅ BaseOverlay class created
- ✅ State machine implemented (initializing → pending → ready/error)
- ✅ Loading indicator displays while waiting
- ✅ Error states show descriptive messages
- ✅ Dependency waiting works for entities and data sources
- ✅ Subclass hooks properly defined

---

## 2.2: Refactor Existing Overlays

**Purpose:** Convert MSD overlays to use BaseOverlay foundation

### 2.2.1: Line Overlay

**File:** `src/components/overlays/line-overlay.js`

```javascript
/**
 * LineOverlay - Renders SVG lines
 * 
 * Supports horizontal, vertical, and angled lines
 * with configurable styling and animations
 * 
 * @extends BaseOverlay
 */

import { BaseOverlay } from './base-overlay.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class LineOverlay extends BaseOverlay {
    /**
     * Create a line overlay
     * 
     * @param {Object} config - Line configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x1 - Start X coordinate
     * @param {number} config.y1 - Start Y coordinate
     * @param {number} config.x2 - End X coordinate
     * @param {number} config.y2 - End Y coordinate
     * @param {string} config.stroke - Stroke color (default: var(--lcars-ui-secondary))
     * @param {number} config.stroke_width - Stroke width (default: 2)
     * @param {string} config.stroke_linecap - Line cap style (default: round)
     * @param {string} config.stroke_dasharray - Dash pattern (optional)
     * @param {Object} pipeline - Pipeline reference
     */
    constructor(config, pipeline) {
        super(config, pipeline);
        
        // Set defaults
        this.config.stroke = config.stroke || 'var(--lcars-ui-secondary)';
        this.config.stroke_width = config.stroke_width || 2;
        this.config.stroke_linecap = config.stroke_linecap || 'round';
    }

    /**
     * Render line element
     */
    render() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-line');

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', this.config.x1);
        line.setAttribute('y1', this.config.y1);
        line.setAttribute('x2', this.config.x2);
        line.setAttribute('y2', this.config.y2);
        line.setAttribute('stroke', this.config.stroke);
        line.setAttribute('stroke-width', this.config.stroke_width);
        line.setAttribute('stroke-linecap', this.config.stroke_linecap);
        
        if (this.config.stroke_dasharray) {
            line.setAttribute('stroke-dasharray', this.config.stroke_dasharray);
        }

        g.appendChild(line);
        this.element = g;
    }

    /**
     * Update line properties
     * 
     * @param {Object} data - Update data (can include new coordinates, colors, etc.)
     */
    onUpdate(data) {
        if (!this.element) return;

        const line = this.element.querySelector('line');
        if (!line) return;

        // Update coordinates if provided
        if (data.x1 !== undefined) line.setAttribute('x1', data.x1);
        if (data.y1 !== undefined) line.setAttribute('y1', data.y1);
        if (data.x2 !== undefined) line.setAttribute('x2', data.x2);
        if (data.y2 !== undefined) line.setAttribute('y2', data.y2);

        // Update styling if provided
        if (data.stroke) line.setAttribute('stroke', data.stroke);
        if (data.stroke_width) line.setAttribute('stroke-width', data.stroke_width);
        if (data.stroke_dasharray !== undefined) {
            if (data.stroke_dasharray) {
                line.setAttribute('stroke-dasharray', data.stroke_dasharray);
            } else {
                line.removeAttribute('stroke-dasharray');
            }
        }
    }
}
```

### 2.2.2: Text Overlay

**File:** `src/components/overlays/text-overlay.js`

```javascript
/**
 * TextOverlay - Renders SVG text
 * 
 * Supports dynamic text from entities or data sources
 * with configurable styling and formatting
 * 
 * @extends BaseOverlay
 */

import { BaseOverlay } from './base-overlay.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class TextOverlay extends BaseOverlay {
    /**
     * Create a text overlay
     * 
     * @param {Object} config - Text configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {string} config.text - Static text or template
     * @param {string} config.entity - Entity to get text from (optional)
     * @param {string} config.data_source - Data source to get text from (optional)
     * @param {string} config.data_path - Path to data in data source (e.g., "temperature")
     * @param {string} config.fill - Text color (default: var(--lcars-ui-secondary))
     * @param {number} config.font_size - Font size (default: 16)
     * @param {string} config.font_family - Font family (default: Antonio)
     * @param {string} config.font_weight - Font weight (default: normal)
     * @param {string} config.text_anchor - Text anchor (default: start)
     * @param {string} config.text_transform - Transform (uppercase, lowercase, capitalize)
     * @param {Object} pipeline - Pipeline reference
     */
    constructor(config, pipeline) {
        super(config, pipeline);
        
        // Set defaults
        this.config.fill = config.fill || 'var(--lcars-ui-secondary)';
        this.config.font_size = config.font_size || 16;
        this.config.font_family = config.font_family || 'Antonio, sans-serif';
        this.config.font_weight = config.font_weight || 'normal';
        this.config.text_anchor = config.text_anchor || 'start';
    }

    /**
     * Render text element
     */
    render() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-text');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', this.config.x);
        text.setAttribute('y', this.config.y);
        text.setAttribute('fill', this.config.fill);
        text.setAttribute('font-size', this.config.font_size);
        text.setAttribute('font-family', this.config.font_family);
        text.setAttribute('font-weight', this.config.font_weight);
        text.setAttribute('text-anchor', this.config.text_anchor);

        // Get initial text content
        const content = this._getTextContent();
        text.textContent = this._transformText(content);

        g.appendChild(text);
        this.element = g;
    }

    /**
     * Get text content from various sources
     * @private
     * 
     * @returns {string} Text content
     */
    _getTextContent() {
        // Priority: entity > data_source > static text
        
        // From entity
        if (this.config.entity) {
            const state = this.pipeline.getEntityState(this.config.entity);
            if (state) {
                return state.state;
            }
        }
        
        // From data source
        if (this.config.data_source) {
            const data = this.pipeline.getDataSource(this.config.data_source);
            if (data) {
                return this._resolveDataPath(data, this.config.data_path);
            }
        }
        
        // Static text
        return this.config.text || '';
    }

    /**
     * Resolve data path (e.g., "weather.temperature")
     * @private
     * 
     * @param {any} data - Data object
     * @param {string} path - Dot-notation path
     * @returns {any} Resolved value
     */
    _resolveDataPath(data, path) {
        if (!path) return data;
        
        return path.split('.').reduce((obj, key) => {
            return obj?.[key];
        }, data);
    }

    /**
     * Apply text transformation
     * @private
     * 
     * @param {string} text - Input text
     * @returns {string} Transformed text
     */
    _transformText(text) {
        if (!text || !this.config.text_transform) return text;
        
        switch (this.config.text_transform) {
            case 'uppercase':
                return text.toUpperCase();
            case 'lowercase':
                return text.toLowerCase();
            case 'capitalize':
                return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            default:
                return text;
        }
    }

    /**
     * Update text content
     * 
     * @param {any} data - New data (entity state or data source data)
     */
    onUpdate(data) {
        if (!this.element) return;

        const textElement = this.element.querySelector('text');
        if (!textElement) return;

        let content;
        
        // Data is entity state
        if (data && typeof data === 'object' && 'state' in data) {
            content = data.state;
        }
        // Data is from data source
        else if (this.config.data_path) {
            content = this._resolveDataPath(data, this.config.data_path);
        }
        // Data is direct value
        else {
            content = data;
        }

        textElement.textContent = this._transformText(String(content || ''));
    }
}
```

### 2.2.3: SVG Overlay

**File:** `src/components/overlays/svg-overlay.js`

```javascript
/**
 * SVGOverlay - Embeds external SVG content
 * 
 * Loads SVG from built-in cache or external URLs
 * Supports positioning, scaling, and coloring
 * 
 * @extends BaseOverlay
 */

import { BaseOverlay } from './base-overlay.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class SVGOverlay extends BaseOverlay {
    /**
     * Create an SVG overlay
     * 
     * @param {Object} config - SVG configuration
     * @param {string} config.id - Unique identifier
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {string} config.svg_source - SVG source (builtin:key or /local/path)
     * @param {number} config.width - Width (optional, preserves aspect if not set)
     * @param {number} config.height - Height (optional, preserves aspect if not set)
     * @param {number} config.scale - Scale factor (default: 1)
     * @param {string} config.color - Color to apply to SVG (optional)
     * @param {Object} pipeline - Pipeline reference
     */
    constructor(config, pipeline) {
        super(config, pipeline);
        
        this.config.scale = config.scale || 1;
        this._svgContent = null;
    }

    /**
     * Initialize - load SVG content
     * 
     * @returns {Promise<void>}
     */
    async onInitialize() {
        await this._loadSVG();
    }

    /**
     * Load SVG from source
     * @private
     * 
     * @returns {Promise<void>}
     */
    async _loadSVG() {
        const source = this.config.svg_source;
        
        if (!source) {
            throw new Error('svg_source is required');
        }

        // Built-in SVG
        if (source.startsWith('builtin:')) {
            const key = source.replace('builtin:', '');
            this._svgContent = window.cblcars.getSVGFromCache(key);
            
            if (!this._svgContent) {
                throw new Error(`Built-in SVG '${key}' not found in cache`);
            }
        }
        // External SVG
        else if (source.startsWith('/local/') || source.startsWith('http')) {
            const key = source.split('/').pop().replace('.svg', '');
            
            // Check cache first
            this._svgContent = window.cblcars.getSVGFromCache(key);
            
            // Load if not cached
            if (!this._svgContent) {
                await window.cblcars.loadUserSVG(key, source);
                this._svgContent = window.cblcars.getSVGFromCache(key);
                
                if (!this._svgContent) {
                    throw new Error(`Failed to load SVG from ${source}`);
                }
            }
        }
        else {
            throw new Error(`Invalid svg_source format: ${source}`);
        }
    }

    /**
     * Render SVG element
     */
    render() {
        if (!this._svgContent) {
            throw new Error('SVG content not loaded');
        }

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.setAttribute('class', 'overlay-svg');

        // Create SVG container
        const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Apply positioning
        svgContainer.setAttribute('transform', `translate(${this.config.x || 0}, ${this.config.y || 0}) scale(${this.config.scale})`);

        // Parse and insert SVG content
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(this._svgContent, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        // Copy children from parsed SVG
        Array.from(svgElement.children).forEach(child => {
            const imported = document.importNode(child, true);
            
            // Apply color if specified
            if (this.config.color) {
                this._applyColor(imported, this.config.color);
            }
            
            svgContainer.appendChild(imported);
        });

        g.appendChild(svgContainer);
        this.element = g;
    }

    /**
     * Apply color to SVG elements
     * @private
     * 
     * @param {SVGElement} element - Element to color
     * @param {string} color - Color to apply
     */
    _applyColor(element, color) {
        // Apply to current element
        if (element.hasAttribute('fill') && element.getAttribute('fill') !== 'none') {
            element.setAttribute('fill', color);
        }
        if (element.hasAttribute('stroke') && element.getAttribute('stroke') !== 'none') {
            element.setAttribute('stroke', color);
        }

        // Recursively apply to children
        Array.from(element.children).forEach(child => {
            this._applyColor(child, color);
        });
    }

    /**
     * Update SVG properties
     * 
     * @param {Object} data - Update data (can include color, scale, etc.)
     */
    onUpdate(data) {
        if (!this.element) return;

        const container = this.element.querySelector('g');
        if (!container) return;

        // Update color
        if (data.color) {
            Array.from(container.querySelectorAll('*')).forEach(el => {
                this._applyColor(el, data.color);
            });
        }

        // Update transform (position/scale)
        if (data.x !== undefined || data.y !== undefined || data.scale !== undefined) {
            const x = data.x !== undefined ? data.x : this.config.x || 0;
            const y = data.y !== undefined ? data.y : this.config.y || 0;
            const scale = data.scale !== undefined ? data.scale : this.config.scale;
            
            container.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
        }
    }
}
```

**Acceptance Criteria:**
- ✅ Line overlay refactored
- ✅ Text overlay refactored
- ✅ SVG overlay refactored
- ✅ All overlays extend BaseOverlay
- ✅ Loading states work
- ✅ Updates work
- ✅ MSD overlays continue functioning

---

## 2.3: Create OverlayRenderer Factory

**Purpose:** Factory pattern for creating overlay instances

**File:** `src/components/overlays/overlay-renderer.js`

```javascript
/**
 * OverlayRenderer - Factory for Creating Overlays
 * 
 * Provides centralized overlay creation with type registration
 * Handles overlay instantiation, initialization, and lifecycle
 * 
 * USAGE:
 * const overlay = OverlayRenderer.create(config, pipeline);
 * await overlay.initialize();
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { LineOverlay } from './line-overlay.js';
import { TextOverlay } from './text-overlay.js';
import { SVGOverlay } from './svg-overlay.js';

export class OverlayRenderer {
    /**
     * Registry of overlay types
     * @private
     */
    static _types = new Map();

    /**
     * Register default overlay types
     * Called automatically on first use
     * @private
     */
    static _registerDefaults() {
        if (this._types.size > 0) return; // Already registered

        this.register('line', LineOverlay);
        this.register('text', TextOverlay);
        this.register('svg', SVGOverlay);

        cblcarsLog.info('[OverlayRenderer] Default overlay types registered');
    }

    /**
     * Register an overlay type
     * 
     * @param {string} type - Overlay type identifier
     * @param {Class} OverlayClass - Overlay class (extends BaseOverlay)
     */
    static register(type, OverlayClass) {
        if (this._types.has(type)) {
            cblcarsLog.warn(`[OverlayRenderer] Overwriting existing overlay type: ${type}`);
        }

        this._types.set(type, OverlayClass);
        cblcarsLog.debug(`[OverlayRenderer] Registered overlay type: ${type}`);
    }

    /**
     * Create an overlay instance
     * 
     * @param {Object} config - Overlay configuration
     * @param {string} config.type - Overlay type (line, text, svg, etc.)
     * @param {string} config.id - Unique identifier
     * @param {Object} pipeline - Pipeline reference
     * @returns {BaseOverlay} Overlay instance
     * @throws {Error} If type not found or creation fails
     */
    static create(config, pipeline) {
        // Ensure defaults are registered
        this._registerDefaults();

        if (!config || !config.type) {
            throw new Error('Overlay config must include type');
        }

        const OverlayClass = this._types.get(config.type);

        if (!OverlayClass) {
            throw new Error(`Unknown overlay type: ${config.type}. Available types: ${Array.from(this._types.keys()).join(', ')}`);
        }

        try {
            const overlay = new OverlayClass(config, pipeline);
            cblcarsLog.debug(`[OverlayRenderer] Created ${config.type} overlay: ${config.id}`);
            return overlay;
        } catch (error) {
            cblcarsLog.error(`[OverlayRenderer] Failed to create overlay:`, error);
            throw error;
        }
    }

    /**
     * Get registered overlay types
     * 
     * @returns {string[]} Array of registered type names
     */
    static getTypes() {
        this._registerDefaults();
        return Array.from(this._types.keys());
    }

    /**
     * Check if a type is registered
     * 
     * @param {string} type - Type to check
     * @returns {boolean} True if registered
     */
    static hasType(type) {
        this._registerDefaults();
        return this._types.has(type);
    }
}
```

**Acceptance Criteria:**
- ✅ OverlayRenderer factory created
- ✅ Type registration works
- ✅ Default types auto-register
- ✅ Create method instantiates overlays
- ✅ Error handling for unknown types
- ✅ Can query available types

---

## 2.4: Build Native Slider Control

**Purpose:** Replace `my-slider-v2` dependency with native implementation

**Key Features:**
- Horizontal and vertical orientation
- Touch/mouse drag support
- Snap to steps
- Multiple modes (brightness, temperature, volume, etc.)
- Entity-aware (auto-detects min/max from attributes)
- Anime.js v4 animations
- LCARS styling
- Accessible (keyboard support)

### Code: Native Slider Control

**File:** `src/components/controls/slider-control.js`

```javascript
/**
 * SliderControl - Native Slider Implementation
 * 
 * Replaces my-slider-v2 with native CB-LCARS slider
 * Supports drag interaction, entity integration, and LCARS styling
 * Uses anime.js v4 for smooth animations
 * 
 * @extends HTMLElement
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class SliderControl extends HTMLElement {
    /**
     * Observed attributes for reactivity
     */
    static get observedAttributes() {
        return ['value', 'min', 'max', 'step', 'orientation', 'disabled'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // State
        this._value = 0;
        this._min = 0;
        this._max = 100;
        this._step = 1;
        this._orientation = 'horizontal';
        this._disabled = false;
        this._isDragging = false;

        // Entity integration
        this._entity = null;
        this._mode = 'generic';  // brightness, temperature, volume, generic
        this._hass = null;

        // Animation scope
        this._animScope = null;
    }

    /**
     * Initialize control
     * 
     * @param {Object} config - Control configuration
     * @param {string} config.entity - Entity ID
     * @param {string} config.mode - Control mode (brightness, temperature, etc.)
     * @param {string} config.orientation - horizontal or vertical
     * @param {number} config.min - Minimum value (optional, auto-detected from entity)
     * @param {number} config.max - Maximum value (optional, auto-detected from entity)
     * @param {number} config.step - Step size (default: 1)
     * @param {Object} config.style - Style overrides
     * @param {Object} pipeline - Pipeline reference
     */
    initialize(config, pipeline) {
        this.config = config;
        this.pipeline = pipeline;

        // Set properties from config
        this._entity = config.entity;
        this._mode = config.mode || 'generic';
        this._orientation = config.orientation || 'horizontal';
        this._step = config.step || 1;

        // Override min/max if provided
        if (config.min !== undefined) this._min = config.min;
        if (config.max !== undefined) this._max = config.max;

        // Create animation scope
        const scopeId = `slider-${config.id || Math.random().toString(36).slice(2)}`;
        this._animScope = window.cblcars.anim.animejs.createScope();

        // Render
        this._render();
        this._attachEventListeners();

        // Get initial value from entity
        if (this._entity && this.pipeline) {
            this._updateFromEntity();
        }
    }

    connectedCallback() {
        if (!this.shadowRoot.innerHTML) {
            this._render();
            this._attachEventListeners();
        }
    }

    disconnectedCallback() {
        this._cleanup();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'value':
                this._value = parseFloat(newValue) || 0;
                this._updateVisuals();
                break;
            case 'min':
                this._min = parseFloat(newValue) || 0;
                break;
            case 'max':
                this._max = parseFloat(newValue) || 100;
                break;
            case 'step':
                this._step = parseFloat(newValue) || 1;
                break;
            case 'orientation':
                this._orientation = newValue;
                this._render();
                break;
            case 'disabled':
                this._disabled = newValue !== null;
                this._updateDisabledState();
                break;
        }
    }

    /**
     * Render slider HTML
     * @private
     */
    _render() {
        const isVertical = this._orientation === 'vertical';

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    ${isVertical ? 'width: 20px; height: 100%;' : 'width: 100%; height: 20px;'}
                }

                .slider-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    cursor: pointer;
                }

                .slider-container.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .slider-track {
                    position: absolute;
                    background: var(--lcars-card-button-off, #444);
                    border-radius: 2px;
                    ${isVertical ? 'width: 12px; height: 100%; left: 50%; transform: translateX(-50%);' : 'height: 12px; width: 100%; top: 50%; transform: translateY(-50%);'}
                }

                .slider-fill {
                    position: absolute;
                    background: var(--lcars-card-button, var(--lcars-ui-secondary));
                    border-radius: 2px;
                    transition: all 0.1s ease;
                    ${isVertical ? 'width: 100%; bottom: 0; left: 0;' : 'height: 100%; left: 0; top: 0;'}
                }

                .slider-thumb {
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border: 3px solid black;
                    border-radius: 50%;
                    cursor: grab;
                    transition: transform 0.1s ease;
                    ${isVertical ? 'left: 50%; transform: translate(-50%, 50%);' : 'top: 50%; transform: translate(-50%, -50%);'}
                }

                .slider-thumb:active {
                    cursor: grabbing;
                    transform: ${isVertical ? 'translate(-50%, 50%) scale(1.2)' : 'translate(-50%, -50%) scale(1.2)'};
                }

                .slider-thumb.disabled {
                    cursor: not-allowed;
                }

                /* Keyboard focus */
                .slider-container:focus-within .slider-thumb {
                    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
                }
            </style>

            <div class="slider-container" tabindex="0" role="slider" 
                 aria-valuemin="${this._min}" 
                 aria-valuemax="${this._max}" 
                 aria-valuenow="${this._value}">
                <div class="slider-track">
                    <div class="slider-fill"></div>
                </div>
                <div class="slider-thumb"></div>
            </div>
        `;

        this._updateVisuals();
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEventListeners() {
        const container = this.shadowRoot.querySelector('.slider-container');
        const thumb = this.shadowRoot.querySelector('.slider-thumb');
        const track = this.shadowRoot.querySelector('.slider-track');

        if (!container || !thumb || !track) return;

        // Mouse/touch drag on thumb
        thumb.addEventListener('pointerdown', this._onDragStart.bind(this));

        // Click on track
        track.addEventListener('click', this._onTrackClick.bind(this));

        // Keyboard support
        container.addEventListener('keydown', this._onKeyDown.bind(this));
    }

    /**
     * Handle drag start
     * @private
     * 
     * @param {PointerEvent} e - Pointer event
     */
    _onDragStart(e) {
        if (this._disabled) return;

        this._isDragging = true;
        e.target.setPointerCapture(e.pointerId);

        const onMove = (e) => this._onDragMove(e);
        const onEnd = (e) => {
            this._isDragging = false;
            e.target.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            this._dispatchChange();
            this._callService();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);

        e.preventDefault();
    }

    /**
     * Handle drag move
     * @private
     * 
     * @param {PointerEvent} e - Pointer event
     */
    _onDragMove(e) {
        if (!this._isDragging || this._disabled) return;

        const track = this.shadowRoot.querySelector('.slider-track');
        const rect = track.getBoundingClientRect();
        const isVertical = this._orientation === 'vertical';

        let percentage;
        if (isVertical) {
            percentage = 1 - ((e.clientY - rect.top) / rect.height);
        } else {
            percentage = (e.clientX - rect.left) / rect.width;
        }

        percentage = Math.max(0, Math.min(1, percentage));
        
        // Calculate value with step
        let rawValue = this._min + (this._max - this._min) * percentage;
        this._value = Math.round(rawValue / this._step) * this._step;
        this._value = Math.max(this._min, Math.min(this._max, this._value));

        this._updateVisuals();
        this._dispatchInput();
    }

    /**
     * Handle track click
     * @private
     * 
     * @param {MouseEvent} e - Mouse event
     */
    _onTrackClick(e) {
        if (this._disabled) return;

        const track = this.shadowRoot.querySelector('.slider-track');
        const rect = track.getBoundingClientRect();
        const isVertical = this._orientation === 'vertical';

        let percentage;
        if (isVertical) {
            percentage = 1 - ((e.clientY - rect.top) / rect.height);
        } else {
            percentage = (e.clientX - rect.left) / rect.width;
        }

        percentage = Math.max(0, Math.min(1, percentage));
        
        let rawValue = this._min + (this._max - this._min) * percentage;
        this._value = Math.round(rawValue / this._step) * this._step;
        this._value = Math.max(this._min, Math.min(this._max, this._value));

        this._updateVisuals();
        this._dispatchChange();
        this._callService();
    }

    /**
     * Handle keyboard input
     * @private
     * 
     * @param {KeyboardEvent} e - Keyboard event
     */
    _onKeyDown(e) {
        if (this._disabled) return;

        const isVertical = this._orientation === 'vertical';
        let handled = false;

        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                this._value = Math.min(this._max, this._value + this._step);
                handled = true;
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                this._value = Math.max(this._min, this._value - this._step);
                handled = true;
                break;
            case 'Home':
                this._value = this._min;
                handled = true;
                break;
            case 'End':
                this._value = this._max;
                handled = true;
                break;
            case 'PageUp':
                this._value = Math.min(this._max, this._value + this._step * 10);
                handled = true;
                break;
            case 'PageDown':
                this._value = Math.max(this._min, this._value - this._step * 10);
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
            this._updateVisuals();
            this._dispatchChange();
            this._callService();
        }
    }

    /**
     * Update visual representation
     * @private
     */
    _updateVisuals() {
        const percentage = ((this._value - this._min) / (this._max - this._min)) * 100;
        const fill = this.shadowRoot.querySelector('.slider-fill');
        const thumb = this.shadowRoot.querySelector('.slider-thumb');
        const container = this.shadowRoot.querySelector('.slider-container');
        const isVertical = this._orientation === 'vertical';

        if (!fill || !thumb || !container) return;

        if (isVertical) {
            fill.style.height = `${percentage}%`;
            thumb.style.bottom = `${percentage}%`;
        } else {
            fill.style.width = `${percentage}%`;
            thumb.style.left = `${percentage}%`;
        }

        // Update ARIA
        container.setAttribute('aria-valuenow', this._value);
    }

    /**
     * Update from entity state
     * @private
     */
    _updateFromEntity() {
        if (!this._entity || !this.pipeline) return;

        const state = this.pipeline.getEntityState(this._entity);
        if (!state) return;

        // Get value based on mode
        let value = 0;
        let min = this._min;
        let max = this._max;

        const domain = this._entity.split('.')[0];

        if (domain === 'light') {
            switch (this._mode) {
                case 'brightness':
                    value = ((state.attributes.brightness || 0) / 256) * 100;
                    min = 0;
                    max = 100;
                    break;
                case 'temperature':
                    value = state.attributes.color_temp || 0;
                    min = state.attributes.min_mireds || 153;
                    max = state.attributes.max_mireds || 500;
                    break;
                default:
                    value = parseFloat(state.state) || 0;
            }
        } else {
            value = parseFloat(state.state) || 0;
        }

        // Update min/max if not explicitly set in config
        if (this.config.min === undefined) this._min = min;
        if (this.config.max === undefined) this._max = max;

        this._value = value;
        this._updateVisuals();
    }

    /**
     * Call Home Assistant service
     * @private
     */
    async _callService() {
        if (!this._entity || !this._hass) return;

        const domain = this._entity.split('.')[0];
        let service, data;

        if (domain === 'light') {
            service = 'turn_on';
            switch (this._mode) {
                case 'brightness':
                    data = { brightness: Math.round((this._value / 100) * 256) };
                    break;
                case 'temperature':
                    data = { color_temp: Math.round(this._value) };
                    break;
                default:
                    return;
            }
        } else if (domain === 'input_number') {
            service = 'set_value';
            data = { value: this._value };
        } else if (domain === 'number') {
            service = 'set_value';
            data = { value: this._value };
        } else {
            cblcarsLog.warn(`[SliderControl] Unsupported entity domain: ${domain}`);
            return;
        }

        try {
            await this._hass.callService(domain, service, {
                entity_id: this._entity,
                ...data
            });
        } catch (error) {
            cblcarsLog.error('[SliderControl] Error calling service:', error);
        }
    }

    /**
     * Dispatch input event (during drag)
     * @private
     */
    _dispatchInput() {
        this.dispatchEvent(new CustomEvent('input', {
            detail: { value: this._value },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Dispatch change event (on release/commit)
     * @private
     */
    _dispatchChange() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this._value },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Update disabled state
     * @private
     */
    _updateDisabledState() {
        const container = this.shadowRoot.querySelector('.slider-container');
        const thumb = this.shadowRoot.querySelector('.slider-thumb');

        if (this._disabled) {
            container?.classList.add('disabled');
            thumb?.classList.add('disabled');
        } else {
            container?.classList.remove('disabled');
            thumb?.classList.remove('disabled');
        }
    }

    /**
     * Set HASS reference
     * 
     * @param {Object} hass - Home Assistant instance
     */
    setHass(hass) {
        this._hass = hass;
        this._updateFromEntity();
    }

    /**
     * Update control
     * 
     * @param {Object} state - New entity state
     */
    update(state) {
        this._updateFromEntity();
    }

    /**
     * Get current value
     * 
     * @returns {number} Current value
     */
    getValue() {
        return this._value;
    }

    /**
     * Set value programmatically
     * 
     * @param {number} value - New value
     */
    setValue(value) {
        this._value = Math.max(this._min, Math.min(this._max, value));
        this._updateVisuals();
    }

    /**
     * Cleanup resources
     * @private
     */
    _cleanup() {
        if (this._animScope) {
            // Cleanup animations if needed
            this._animScope = null;
        }
    }
}

// Register custom element
customElements.define('cb-lcars-slider', SliderControl);
```

**Acceptance Criteria:**
- ✅ Slider control implemented as Web Component
- ✅ Horizontal and vertical orientations work
- ✅ Drag interaction functional
- ✅ Keyboard support implemented
- ✅ Entity integration working
- ✅ Multiple modes supported (brightness, temperature, etc.)
- ✅ LCARS styling applied
- ✅ Accessible (ARIA attributes, keyboard nav)

---

## 2.5: Create ControlRenderer Factory

**Purpose:** Factory pattern for creating control instances

**File:** `src/components/controls/control-renderer.js`

```javascript
/**
 * ControlRenderer - Factory for Creating Controls
 * 
 * Provides centralized control creation with type registration
 * Handles control instantiation, initialization, and lifecycle
 * 
 * USAGE:
 * const control = ControlRenderer.create(config, pipeline);
 * await control.initialize();
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { SliderControl } from './slider-control.js';

export class ControlRenderer {
    /**
     * Registry of control types
     * @private
     */
    static _types = new Map();

    /**
     * Register default control types
     * Called automatically on first use
     * @private
     */
    static _registerDefaults() {
        if (this._types.size > 0) return; // Already registered

        this.register('slider', SliderControl);

        cblcarsLog.info('[ControlRenderer] Default control types registered');
    }

    /**
     * Register a control type
     * 
     * @param {string} type - Control type identifier
     * @param {Class} ControlClass - Control class (extends HTMLElement or BaseControl)
     */
    static register(type, ControlClass) {
        if (this._types.has(type)) {
            cblcarsLog.warn(`[ControlRenderer] Overwriting existing control type: ${type}`);
        }

        this._types.set(type, ControlClass);
        cblcarsLog.debug(`[ControlRenderer] Registered control type: ${type}`);
    }

    /**
     * Create a control instance
     * 
     * @param {Object} config - Control configuration
     * @param {string} config.type - Control type (slider, button, etc.)
     * @param {string} config.id - Unique identifier
     * @param {Object} pipeline - Pipeline reference
     * @returns {HTMLElement} Control instance
     * @throws {Error} If type not found or creation fails
     */
    static create(config, pipeline) {
        // Ensure defaults are registered
        this._registerDefaults();

        if (!config || !config.type) {
            throw new Error('Control config must include type');
        }

        const ControlClass = this._types.get(config.type);

        if (!ControlClass) {
            throw new Error(`Unknown control type: ${config.type}. Available types: ${Array.from(this._types.keys()).join(', ')}`);
        }

        try {
            const control = new ControlClass();
            
            // Initialize if method exists
            if (control.initialize) {
                control.initialize(config, pipeline);
            }
            
            cblcarsLog.debug(`[ControlRenderer] Created ${config.type} control: ${config.id}`);
            return control;
        } catch (error) {
            cblcarsLog.error(`[ControlRenderer] Failed to create control:`, error);
            throw error;
        }
    }

    /**
     * Get registered control types
     * 
     * @returns {string[]} Array of registered type names
     */
    static getTypes() {
        this._registerDefaults();
        return Array.from(this._types.keys());
    }

    /**
     * Check if a type is registered
     * 
     * @param {string} type - Type to check
     * @returns {boolean} True if registered
     */
    static hasType(type) {
        this._registerDefaults();
        return this._types.has(type);
    }
}
```

**Acceptance Criteria:**
- ✅ ControlRenderer factory created
- ✅ Type registration works
- ✅ Default types auto-register
- ✅ Create method instantiates controls
- ✅ Error handling for unknown types
- ✅ Can query available types

---

## 2.6: Test Overlays in Standalone Cards

**Purpose:** Verify overlays/controls work outside of MSD

### Test Configuration Examples

#### Test 1: Button Card with Line Overlay

```yaml
type: cb-lcars-button-card
entity: light.desk
variables:
  overlays:
    - id: underline
      type: line
      x1: 0
      y1: 30
      x2: 200
      y2: 30
      stroke: var(--lcars-ui-secondary)
      stroke_width: 3
```

#### Test 2: Button Card with Text Overlay (Data Source)

```yaml
type: cb-lcars-button-card
entity: light.desk
variables:
  # Card declares data source
  data_sources:
    - id: weather
      type: rest
      url: https://api.weather.com/...
      refresh: 60
      transform: |
        (data) => ({ temp: data.main.temp, condition: data.weather[0].main })
  
  overlays:
    - id: weather_display
      type: text
      x: 10
      y: 20
      data_source: weather
      data_path: temp
      text: "${data.temp}°F"
      fill: var(--lcars-ui-secondary)
      font_size: 14
```

#### Test 3: Multimeter Card with Native Slider

```yaml
type: cb-lcars-multimeter-card
entity: light.desk
variables:
  controls:
    - id: brightness_slider
      type: slider
      entity: light.desk
      mode: brightness
      orientation: vertical
      step: 1
```

### Testing Checklist

- ✅ Overlays render in standalone cards
- ✅ Loading states appear while waiting for data sources
- ✅ Error states show when dependencies missing
- ✅ Overlays update when data changes
- ✅ Controls render and are interactive
- ✅ Slider control calls HA services correctly
- ✅ Multiple overlays/controls work together
- ✅ No conflicts with MSD system
- ✅ Performance acceptable

---

## Phase 2 Completion Criteria

### Functional Requirements
- ✅ BaseOverlay class with state management
- ✅ Line, Text, and SVG overlays refactored
- ✅ OverlayRenderer factory functional
- ✅ Native slider control complete
- ✅ ControlRenderer factory functional
- ✅ Overlays work in standalone cards
- ✅ Loading states provide visual feedback
- ✅ Error handling robust

### Technical Requirements
- ✅ All code follows anime.js v4 syntax
- ✅ Proper use of shadowRoot for DOM operations
- ✅ JSDoc documentation complete
- ✅ No external dependencies added
- ✅ MSD system continues functioning
- ✅ Backward compatibility maintained

### Testing Requirements
- ✅ Unit tests for BaseOverlay states
- ✅ Integration tests for overlay types
- ✅ Slider control interaction tests
- ✅ Data source dependency tests
- ✅ Cross-card functionality tests
- ✅ Performance benchmarks acceptable

---

**End of Phase 2**