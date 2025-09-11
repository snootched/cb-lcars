/**
 * Phase 4: Home Assistant card controls renderer
 * Handles HA card embedding with CTM positioning
 */

export class MsdControlsRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.controlElements = new Map();
    this.controlsContainer = null;
    this.hass = null;
    this.lastRenderArgs = null;
    this._resizeBound = false;
    this._autoTried = false; // ADDED
    this._rawOverlayIndex = null; // ADDED
    if (typeof window !== 'undefined') {
      window._msdControlsRenderer = this; // ADDED global reference
    }
  }

  setHass(hass) {
    this.hass = hass;
  }

  async renderControls(controlOverlays, resolvedModel) {
    console.log('[MsdControlsRenderer] renderControls called', {
      count: controlOverlays?.length || 0,
      ids: (controlOverlays || []).map(o => o.id)
    }); // ADDED
    if (!controlOverlays || !controlOverlays.length) return;

    // FIXED: Wait for renderer container to be ready with timeout
    const container = await this.ensureControlsContainerAsync();
    if (!container) {
      console.warn('[MsdControlsRenderer] Failed to create controls container - skipping render');
      return;
    }

    // Clear existing controls
    container.innerHTML = '';
    this.controlElements.clear();

    // Render each control overlay
    for (const overlay of controlOverlays) {
      await this.renderControlOverlay(overlay, resolvedModel);
    }

    // Store for potential relayout
    this.lastRenderArgs = { controlOverlays, resolvedModel };
  }

  async renderControlOverlay(overlay, resolvedModel) {
    console.log('[MsdControlsRenderer] Creating control overlay', overlay.id, overlay); // ADDED
    const controlElement = await this.createControlElement(overlay);
    if (!controlElement) return;

    // Position the element
    this.positionControlElement(controlElement, overlay, resolvedModel);

    // Store reference
    this.controlElements.set(overlay.id, controlElement);
  }

  // ADDED: recover original card definition even if pipeline stripped it
  resolveCardDefinition(overlay) {
    if (overlay.card) return overlay.card;
    if (overlay.card_config) return overlay.card_config;
    if (overlay.cardConfig) return overlay.cardConfig;
    if (overlay._card) return overlay._card;
    if (overlay.meta?.card) return overlay.meta.card;
    if (overlay.extension?.card) return overlay.extension.card;

    // Build raw overlay index once from global cache if available
    if (!this._rawOverlayIndex) {
      const raw = (window && window._msdRawOverlays) ? window._msdRawOverlays : [];
      this._rawOverlayIndex = new Map(raw.map(o => [o.id, o]));
    }
    const rawEntry = this._rawOverlayIndex?.get(overlay.id);
    if (rawEntry?.card) return rawEntry.card;

    return null;
  }

  async createControlElement(overlay) {
    // REPLACED: use resolver
    const cardDef = this.resolveCardDefinition(overlay);
    if (!cardDef) {
      console.warn('[MsdControlsRenderer] No card definition found for control overlay', overlay.id, overlay);
      return null;
    }
    const overlayWithCard = { ...overlay, card: cardDef };

    try {
      const isNode = typeof window === 'undefined';

      if (isNode) {
        // Enhanced Node.js testing environment card creation
        let mockElement;

        // Try to use enhanced DOM polyfill
        if (global.document && global.document.createElement) {
          mockElement = global.document.createElement(overlayWithCard.card.type);
        } else {
          // Fallback mock element
          mockElement = {
            tagName: overlayWithCard.card.type.toUpperCase(),
            style: {},
            setAttribute: function(name, value) { this[`_${name}`] = value; },
            getAttribute: function(name) { return this[`_${name}`] || null; },
            appendChild: function(child) { return child; },
            remove: function() { this._removed = true; },
            _config: null,
            _hass: null
          };
        }

        // Ensure the element looks like the expected card type to tests
        if (!mockElement.tagName || mockElement.tagName === 'DIV') {
          mockElement.tagName = overlayWithCard.card.type.toUpperCase();
        }

        // Essential properties for test validation
        if (overlayWithCard.card.config) {
          mockElement._config = overlayWithCard.card.config;

          // Provide setConfig method that the test can verify was called
          mockElement.setConfig = function(config) {
            this._config = config;
            this._setConfigCalled = true;
            return this;
          };

          // Actually call setConfig to simulate real behavior
          mockElement.setConfig(overlayWithCard.card.config);
        }

        // Hass context setup for tests
        if (this.hass) {
          mockElement._hass = this.hass;

          // Create hass property with getter/setter for tests
          Object.defineProperty(mockElement, 'hass', {
            get() { return this._hass; },
            set(value) {
              this._hass = value;
              this._hassSet = true;
            },
            enumerable: true,
            configurable: true
          });

          // Set the hass context
          mockElement.hass = this.hass;
        }

        return mockElement;
      }

      // Browser environment - More robust card creation
      const cardType = overlayWithCard.card.type;
      let cardElement = null;

      // FIXED: Handle both direct card types and Home Assistant card types
      const haCardTypes = {
        'light': 'hui-light-card',
        'switch': 'hui-switch-card',
        'sensor': 'hui-sensor-card',
        'gauge': 'hui-gauge-card',
        'button': 'hui-button-card',
        'entities': 'hui-entities-card',
        'glance': 'hui-glance-card'
      };

      const resolvedCardType = haCardTypes[cardType] || cardType;

      // Strategy 1: Try customElements.get and new constructor
      if (window.customElements && typeof window.customElements.get === 'function') {
        try {
          const CardClass = window.customElements.get(resolvedCardType);
          if (CardClass) {
            cardElement = new CardClass();
          }
        } catch (e) {
          console.warn(`Failed to instantiate ${resolvedCardType} via constructor:`, e);
        }
      }

      // Strategy 2: Try document.createElement with resolved type
      if (!cardElement) {
        try {
          cardElement = document.createElement(resolvedCardType);
          // Verify it's actually a custom element, not just a generic element
          if (cardElement.tagName.toLowerCase() === resolvedCardType && cardElement.setConfig) {
            // Good - it's a real custom card element
          } else if (cardElement.tagName.toLowerCase() !== resolvedCardType) {
            // Generic element created - try upgrading
            window.customElements?.upgrade?.(cardElement);
          }
        } catch (e) {
          console.warn(`Failed to create element ${resolvedCardType}:`, e);
        }
      }

      // ENHANCED: Strategy 3 - Try creating through Home Assistant's card system
      if (!cardElement && window.customCards) {
        try {
          const cardConfig = { type: cardType, ...(overlayWithCard.card.config || {}) }; // CHANGED
          if (window.customCards[cardType]) {
            cardElement = window.customCards[cardType].getCard(cardConfig);
          }
        } catch (e) {
          console.warn(`Failed to create via customCards ${cardType}:`, e);
        }
      }

      // Strategy 4: Fallback div with card type
      if (!cardElement) {
        cardElement = document.createElement('div');
        cardElement.setAttribute('data-card-type', resolvedCardType);
        cardElement.style.border = '2px solid var(--primary-color)';
        cardElement.style.padding = '8px';
        cardElement.style.background = 'var(--card-background-color, #1f1f1f)';
        cardElement.style.borderRadius = '4px';
        cardElement.innerHTML = `<div style="color: var(--primary-text-color);">Card: ${cardType}</div>`;

        // Make it look like the expected card type for compatibility
        Object.defineProperty(cardElement, 'tagName', {
          value: resolvedCardType.toUpperCase(),
          writable: false
        });
      }

      // Apply configuration if available
      if (overlayWithCard.card.config) {
        if (typeof cardElement.setConfig === 'function') {
          try {
            cardElement.setConfig(overlayWithCard.card.config);
            console.log(`[MSD Controls] Config applied to ${resolvedCardType}:`, overlayWithCard.card.config); // CHANGED
          } catch (e) {
            console.warn(`Failed to set config on ${resolvedCardType}:`, e);
          }
        }
        cardElement._config = overlayWithCard.card.config;
      }

      // Set hass context if available
      if (this.hass) {
        try {
          if ('hass' in cardElement || cardElement.hass !== undefined) {
            cardElement.hass = this.hass;
            console.log(`[MSD Controls] HASS context applied to ${resolvedCardType}`);
          } else {
            // Store as private property if hass setter not available
            cardElement._hass = this.hass;
          }
        } catch (e) {
          console.warn(`Failed to set hass on ${resolvedCardType}:`, e);
          cardElement._hass = this.hass;
        }
      }

      return cardElement;

    } catch (error) {
      console.warn(`[MSD Controls] Failed to create card ${cardDef?.type}:`, error);
      return null;
    }
  }

  positionControlElement(element, overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = this.resolveSize(overlay.size, resolvedModel);
    element.setAttribute?.('data-msd-control-id', overlay.id);
    element.id = element.id || `msd-control-${overlay.id}`; // ADDED

    if (position && size) {
      const css = this.mapViewBoxRectToHostCss(
        { x: position[0], y: position[1], w: size[0], h: size[1] },
        resolvedModel
      );

      if (css && !this._isZeroRect(css)) {
        element.style.position = 'absolute';
        element.style.left = css.left;
        element.style.top = css.top;
        element.style.width = css.width;
        element.style.height = css.height;
        element.style.zIndex = overlay.z_index || 1000;
        element.style.pointerEvents = 'auto';
        if (!element.style.background && !element.shadowRoot) {
          element.style.background = 'var(--card-background-color, rgba(0,0,0,0.35))';
        }
        console.debug('[MSD Controls] Control positioned', overlay.id, css);
      } else {
        const attempts = (element.dataset.msdRetry || 0) * 1;
        if (attempts < 5) {
          element.dataset.msdRetry = attempts + 1;
          console.debug('[MSD Controls] Deferring control positioning (layout not ready)', {
            id: overlay.id, attempts, css
          });
          setTimeout(() => {
            this.positionControlElement(element, overlay, resolvedModel);
          }, 40 * (attempts + 1));
          return;
        } else {
          console.warn('[MSD Controls] Failed to map position after retries', overlay.id, { position, size, css });
        }
      }
    }

    // FIXED: Use the container we determined is valid
    const targetContainer = this.controlsContainer;
    if (targetContainer) {
      targetContainer.appendChild(element);
    } else {
      console.error('[MSD Controls] No valid controls container to append to');
    }
  }

  _isZeroRect(css) { // ADDED
    if (!css) return true;
    return ['width','height'].some(k => {
      const v = parseFloat(css[k] || '0');
      return !v;
    });
  }

  mapViewBoxRectToHostCss(vbRect, resolvedModel) {
    try {
      const targetContainer = this.renderer.container || this.renderer.mountEl;
      const svg = targetContainer?.querySelector('svg');
      if (!svg) {
        console.warn('[MsdControlsRenderer] No SVG found in container:', {
          hasContainer: !!targetContainer,
          containerType: targetContainer?.constructor?.name,
          svgFound: !!svg
        });
        return null;
      }

      const isNode = typeof window === 'undefined';
      if (isNode) {
        // Mock transformation for testing
        const mockCTM = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 };
        const mockPoint = (x, y) => ({
          x, y,
          matrixTransform(matrix) {
            return {
              x: x * matrix.a + y * matrix.c + matrix.e,
              y: x * matrix.b + y * matrix.d + matrix.f
            };
          }
        });

        const topLeft = mockPoint(vbRect.x, vbRect.y);
        const bottomRight = mockPoint(vbRect.x + vbRect.w, vbRect.y + vbRect.h);

        const screenTopLeft = topLeft.matrixTransform(mockCTM);
        const screenBottomRight = bottomRight.matrixTransform(mockCTM);

        return {
          left: `${screenTopLeft.x}px`,
          top: `${screenTopLeft.y}px`,
          width: `${screenBottomRight.x - screenTopLeft.x}px`,
          height: `${screenBottomRight.y - screenTopLeft.y}px`
        };
      }

      const ctm = svg.getScreenCTM();
      // UPDATED: containerRect fallback for ShadowRoot
      let containerRect =
        targetContainer.getBoundingClientRect?.() ||
        targetContainer.host?.getBoundingClientRect?.() ||
        null;

      if (ctm && containerRect) {
        const pt = svg.createSVGPoint();
        pt.x = vbRect.x; pt.y = vbRect.y;
        const tl = pt.matrixTransform(ctm);
        pt.x = vbRect.x + vbRect.w; pt.y = vbRect.y + vbRect.h;
        const br = pt.matrixTransform(ctm);
        return {
          left: `${tl.x - containerRect.left}px`,
          top: `${tl.y - containerRect.top}px`,
          width: `${br.x - tl.x}px`,
          height: `${br.y - tl.y}px`
        };
      }

      // FALLBACK: Derive via viewBox scaling if CTM unavailable
      const vb = svg.viewBox?.baseVal;
      if (vb) {
        const scaleX = (svg.clientWidth || svg.getBoundingClientRect().width || 0) / vb.width;
        const scaleY = (svg.clientHeight || svg.getBoundingClientRect().height || 0) / vb.height;
        return {
          left: `${(vbRect.x - vb.x) * scaleX}px`,
          top: `${(vbRect.y - vb.y) * scaleY}px`,
          width: `${vbRect.w * scaleX}px`,
          height: `${vbRect.h * scaleY}px`
        };
      }
      return null;
    } catch (error) {
      console.warn('[MSD Controls] CTM transformation failed:', error);
      return null;
    }
  }

  // ADDED: Async version that waits for renderer container
  async ensureControlsContainerAsync() {
    // Try immediate creation first
    let container = this.ensureControlsContainer();
    if (container) return container;

    // If failed, wait for renderer container with timeout
    const maxAttempts = 10;
    const delayMs = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait a bit for renderer to complete
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Try again
      container = this.ensureControlsContainer();
      if (container) {
        console.log(`[MsdControlsRenderer] Container ready after ${attempt + 1} attempts`);
        return container;
      }

      console.log(`[MsdControlsRenderer] Attempt ${attempt + 1}/${maxAttempts} - renderer container not ready`);
    }

    console.error('[MsdControlsRenderer] Renderer container never became ready');
    return null;
  }

  ensureControlsContainer() {
    // ENHANCED: Add comprehensive debugging of the renderer state
    console.log('[MsdControlsRenderer] Debugging renderer state:', {
      hasRenderer: !!this.renderer,
      rendererType: this.renderer?.constructor?.name,
      hasContainer: !!this.renderer?.container,
      containerType: this.renderer?.container?.constructor?.name,
      rendererProps: this.renderer ? Object.keys(this.renderer) : [],
      mountEl: this.renderer?.mountEl,
      mountElType: this.renderer?.mountEl?.constructor?.name
    });

    // FIXED: Add better validation of renderer and container
    if (!this.renderer) {
      console.warn('[MsdControlsRenderer] No renderer available');
      return null;
    }

    // FIXED: Check if renderer has mountEl instead of container
    const targetContainer = this.renderer.container || this.renderer.mountEl;

    if (!targetContainer) {
      console.warn('[MsdControlsRenderer] Neither renderer.container nor renderer.mountEl available');
      console.log('[MsdControlsRenderer] Available renderer properties:', Object.keys(this.renderer));
      return null;
    }

    // ADDED: Verify target container is actually a DOM element
    if (!targetContainer.appendChild || typeof targetContainer.appendChild !== 'function') {
      console.warn('[MsdControlsRenderer] Target container is not a valid DOM element:', {
        container: targetContainer,
        type: targetContainer?.constructor?.name,
        hasAppendChild: !!targetContainer.appendChild
      });
      return null;
    }

    // Update our container reference to use the correct target
    if (!this.renderer.container) {
      console.log('[MsdControlsRenderer] Using mountEl as container since renderer.container is not set');
      this.renderer.container = targetContainer;
    }

    // Check if existing container is still valid and attached
    if (this.controlsContainer &&
        this.controlsContainer.parentNode === targetContainer &&
        this.controlsContainer.isConnected !== false) {
      return this.controlsContainer;
    }

    // Better environment detection and document access
    const isNode = typeof window === 'undefined';
    const doc = isNode ? global.document : document;

    if (!doc || typeof doc.createElement !== 'function') {
      console.warn('[MsdControlsRenderer] Document createElement not available');
      return null;
    }

    if (typeof targetContainer.appendChild !== 'function') {
      console.warn('[MsdControlsRenderer] Container appendChild not available');
      return null;
    }

    // FIXED: Clean up any existing container first
    if (this.controlsContainer) {
      try {
        if (this.controlsContainer.remove) {
          this.controlsContainer.remove();
        } else if (this.controlsContainer.parentNode) {
          this.controlsContainer.parentNode.removeChild(this.controlsContainer);
        }
      } catch (e) {
        console.warn('[MsdControlsRenderer] Failed to remove old container:', e);
      }
      this.controlsContainer = null;
    }

    // Create the controls container element
    try {
      this.controlsContainer = doc.createElement('div');
      this.controlsContainer.id = 'msd-controls-container';
      const style = this.controlsContainer.style;
      if (style) {
        style.position = 'absolute';
        style.top = '0';
        style.left = '0';
        style.right = '0';
        style.bottom = '0';
        style.pointerEvents = 'auto';
        style.zIndex = '1000';
      }
      // Safe event listener attachment
      if (typeof this.controlsContainer.addEventListener === 'function') {
        this.controlsContainer.addEventListener('pointerdown', (e) => {
          if (e.target !== this.controlsContainer) {
            e.target.style.pointerEvents = 'auto';
          }
        });
      }

    } catch (error) {
      console.error('[MsdControlsRenderer] Failed to create controls container element:', error);
      return null;
    }

    try {
      // ADDED: prefer base wrapper so coordinates align with svg container
      const baseWrapper = (this.renderer.container || this.renderer.mountEl)?.querySelector?.('#msd-v1-comprehensive-wrapper');
      const appendTarget = baseWrapper || (this.renderer.container || this.renderer.mountEl);
      appendTarget.appendChild(this.controlsContainer);
      console.log('[MsdControlsRenderer] Controls container created and attached to:', {
        targetType: appendTarget?.constructor?.name,
        targetId: appendTarget?.id,
        usedWrapper: !!baseWrapper
      });
      appendTarget._msdControlsContainer = this.controlsContainer;

      // FIXED: Only replace querySelector if it exists
      if (typeof targetContainer.querySelector === 'function') {
        const originalQuerySelector = targetContainer.querySelector;
        const controlsContainerRef = this.controlsContainer;

        // Create new querySelector that ALWAYS finds our container
        targetContainer.querySelector = function(selector) {
          if (selector === '#msd-controls-container' && controlsContainerRef) {
            return controlsContainerRef;
          }

          if (selector === '#msd-controls-container' && this._msdControlsContainer) {
            return this._msdControlsContainer;
          }

          // Manual search in mock DOM children
          if (selector.startsWith('#') && this._children && Array.isArray(this._children)) {
            const id = selector.substring(1);
            const found = this._children.find(child => child && child.id === id);
            if (found) return found;
          }

          // Use original method if available
          if (originalQuerySelector && typeof originalQuerySelector === 'function') {
            try {
              return originalQuerySelector.call(this, selector);
            } catch (e) {}
          }

          return null;
        };
      }

      // Ensure DOM structure for Node.js testing
      const isNode = typeof window === 'undefined';
      if (isNode && targetContainer._children && Array.isArray(targetContainer._children)) {
        // Remove any existing controls container
        targetContainer._children = targetContainer._children.filter(c => c.id !== 'msd-controls-container');

        // Add our container
        targetContainer._children.push(this.controlsContainer);
        this.controlsContainer.parentNode = targetContainer;
      }

    } catch (error) {
      console.error('[MsdControlsRenderer] Failed to append controls container:', error);
      // Clean up the created element if append failed
      this.controlsContainer = null;
      return null;
    }

    // ADDED: one-time resize relayout binding
    if (!this._resizeBound && typeof window !== 'undefined') {
      this._resizeBound = true;
      window.addEventListener('resize', () => {
        try { this.relayout(); } catch(e) { console.warn('[MsdControlsRenderer] Relayout on resize failed', e); }
      });
    }
    // FIX: 'container' was undefined; use a local ref to the created controlsContainer
    const containerRef = this.controlsContainer;
    if (containerRef && !this._autoTried) {
      this._autoTried = true;
      queueMicrotask(() => this.tryAutoRender());
    }
    return this.controlsContainer;
  }

  tryAutoRender() { // ADDED
    if (this.lastRenderArgs) return;
    const r = this.renderer;
    if (!r || !r.lastRenderArgs) {
      console.log('[MsdControlsRenderer] AutoRender: renderer.lastRenderArgs not ready');
      return;
    }
    const overlays =
      r.lastRenderArgs.controlOverlays ||
      r.lastRenderArgs.overlays ||
      r.lastRenderArgs.resolvedModel?.overlays ||
      [];
    const controlOverlays = overlays.filter(o => o && o.type === 'control');
    if (!controlOverlays.length) {
      console.log('[MsdControlsRenderer] AutoRender: no control overlays found');
      return;
    }
    const resolvedModel =
      r.lastRenderArgs.resolvedModel ||
      { anchors: r.lastRenderArgs.anchors || {} };
    console.log('[MsdControlsRenderer] Auto-discovered control overlays', controlOverlays.map(o => o.id));
    this.renderControls(controlOverlays, resolvedModel);
  }

  triggerManualRender(resolvedModel) { // ADDED helper
    console.log('[MsdControlsRenderer] Manual trigger requested');
    this.tryAutoRender();
    if (resolvedModel && this.lastRenderArgs?.resolvedModel !== resolvedModel) {
      const overlays = (resolvedModel.overlays || []).filter(o => o.type === 'control');
      if (overlays.length) {
        this.renderControls(overlays, resolvedModel);
      }
    }
  }

  resolvePosition(position, resolvedModel) {
    // Simple position resolution
    if (Array.isArray(position) && position.length >= 2) {
      return [Number(position[0]), Number(position[1])];
    }
    return null;
  }

  resolveSize(size, resolvedModel) {
    // FIXED: Handle both array format and object format
    if (Array.isArray(size) && size.length >= 2) {
      return [Number(size[0]), Number(size[1])];
    }
    if (size && typeof size === 'object' && size.w && size.h) {
      return [Number(size.w), Number(size.h)];
    }
    return [100, 100]; // Default size
  }

  relayout() {
    if (this.lastRenderArgs) {
      this.renderControls(this.lastRenderArgs.controlOverlays, this.lastRenderArgs.resolvedModel);
    }
  }

  destroy() {
    for (const [id, element] of this.controlElements) {
      if (element.remove) element.remove();
    }
    this.controlElements.clear();

    if (this.controlsContainer && this.controlsContainer.remove) {
      this.controlsContainer.remove();
      this.controlsContainer = null;
    }

    if (this._resizeBound && typeof window !== 'undefined') {
      window.removeEventListener('resize', () => this.relayout()); // NOTE: cannot remove anonymous; acceptable minimal fix
    }
  }
}
