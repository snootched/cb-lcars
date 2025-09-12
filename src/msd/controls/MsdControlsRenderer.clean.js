/**
 * Clean v2 MsdControlsRenderer
 * Purpose: Render HA/custom cards ("control" overlays) positioned over MSD SVG.
 * Safe to import instead of legacy implementation.
 *
 * Usage (optional):
 *   import { MsdControlsRenderer } from './MsdControlsRenderer.clean.js';
 *   const controlsRenderer = new MsdControlsRenderer(pipelineRenderer);
 */
export class MsdControlsRenderer {
  static debug = true; // toggle to reduce console noise

  constructor(renderer) {
    this.renderer = renderer;
    this.hass = null;

    this.controlsContainer = null;          // DOM container for all control wrappers
    this.controlElements = new Map();       // id -> wrapper (wrapper contains the card element)
    this.lastRenderArgs = null;

    // Internal state
    this._rawOverlayIndex = null;
    this._pendingUpgrades = new Map();
    this._resizeBound = false;
    this._autoTried = false;

    this.registerControlOverlayType();

    if (typeof window !== 'undefined') {
      window._msdControlsRenderer = this;
    }
  }

  // ---------------------------------------------------------------------------
  // Overlay Type Registration
  // ---------------------------------------------------------------------------
  registerControlOverlayType() {
    const def = {
      render: () => null, // renderer proper defers to this controls renderer
      validate: (o) =>
        (!o.card || !o.card.type)
          ? { valid: false, error: 'Control overlay requires card.type' }
          : { valid: true }
    };

    if (this.renderer?.registerOverlayType) {
      this.renderer.registerOverlayType('control', def);
    } else if (this.renderer) {
      this.renderer.overlayTypes = this.renderer.overlayTypes || {};
      this.renderer.overlayTypes.control = def;
    } else {
      this._log('warn', 'No renderer present for overlay type registration');
    }
  }

  // ---------------------------------------------------------------------------
  // Home Assistant context
  // ---------------------------------------------------------------------------
  setHass(hass) {
    this.hass = hass;
    for (const [, wrapper] of this.controlElements) {
      const card = wrapper.firstElementChild;
      if (!card) continue;
      try {
        if ('hass' in card || card.hass !== undefined) {
          if (card.hass !== hass) card.hass = hass;
        } else {
          card._hass = hass;
        }
      } catch (e) {
        this._log('warn', 'Failed to propagate hass', e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public render entry
  // ---------------------------------------------------------------------------
  async renderControls(controlOverlays, resolvedModel) {
    if (!controlOverlays?.length) return;
    const container = await this.ensureControlsContainerAsync();
    if (!container) return;
    await this._diffRender(controlOverlays, resolvedModel);
    this.lastRenderArgs = { controlOverlays, resolvedModel };
  }

  // Diff-based reconciliation
  async _diffRender(overlays, resolvedModel) {
    const nextIds = new Set(overlays.map(o => o.id));
    const currentIds = new Set(this.controlElements.keys());

    // Remove stale
    for (const id of currentIds) {
      if (!nextIds.has(id)) {
        try { this.controlElements.get(id)?.remove(); } catch(_) {}
        this.controlElements.delete(id);
      }
    }

    // Create / update
    for (const ov of overlays) {
      const existing = this.controlElements.get(ov.id);
      if (existing && existing.isConnected && this.controlsContainer?.contains(existing)) {
        this.positionControlElement(existing, ov, resolvedModel);
      } else {
        if (existing) this.controlElements.delete(ov.id);
        await this._createAndAttach(ov, resolvedModel);
      }
    }

    // Attachment audit (safety net)
    if (this.controlElements.size &&
        this.controlsContainer &&
        this.controlsContainer.children.length === 0) {
      for (const [id, el] of this.controlElements) {
        if (!el.parentNode) {
          try {
            this.controlsContainer.appendChild(el);
            const ov = overlays.find(o => o.id === id);
            if (ov) this.positionControlElement(el, ov, resolvedModel);
          } catch (e) {
            this._log('warn', 'Reattach failed', id, e);
          }
        }
      }
    }
  }

  // Create wrapper + card, append and position
  async _createAndAttach(overlay, resolvedModel) {
    const wrapper = await this.createControlElement(overlay);
    if (!wrapper) return;

    const container = await this.ensureControlsContainerAsync();
    if (container && !wrapper.parentNode) {
      try { container.appendChild(wrapper); } catch (e) { this._log('warn', 'append failed', e); }
    }

    this.positionControlElement(wrapper, overlay, resolvedModel);
    this.controlElements.set(overlay.id, wrapper);

    // Reattachment safety
    queueMicrotask(() => this._ensureAttached(overlay.id, wrapper, overlay, resolvedModel));
    setTimeout(() => this._ensureAttached(overlay.id, wrapper, overlay, resolvedModel), 120);
  }

  _ensureAttached(id, wrapper, overlay, resolvedModel, attempt = 0) {
    if (!this.controlsContainer) return;
    if (wrapper.parentNode === this.controlsContainer) return;
    if (attempt > 4) return;
    try {
      this.controlsContainer.appendChild(wrapper);
      this.positionControlElement(wrapper, overlay, resolvedModel);
    } catch (e) {
      this._log('warn', 'ensureAttached failed', id, e);
    }
    if (wrapper.parentNode !== this.controlsContainer) {
      setTimeout(() => this._ensureAttached(id, wrapper, overlay, resolvedModel, attempt + 1), 40 * (attempt + 1));
    }
  }

  // ---------------------------------------------------------------------------
  // Card / Wrapper creation
  // ---------------------------------------------------------------------------
  async createControlElement(overlay) {
    const cardDef = this._resolveCardDefinition(overlay);
    if (!cardDef) return null;

    const isNode = typeof window === 'undefined';
    if (isNode) {
      // Test env mock
      const mock = {
        tagName: (cardDef.type || 'div').toUpperCase(),
        style: {},
        appendChild() {},
        remove() {},
        setConfig(cfg) { this._config = cfg; this._setConfigCalled = true; },
        _config: null
      };
      if (cardDef.config) mock.setConfig(cardDef.config);
      if (this.hass) mock.hass = this.hass;
      return mock;
    }

    const normalized = this._normalizeCardType(cardDef.type);
    if (!normalized) return null;

    let card;
    const defined = normalized.includes('-') && window.customElements?.get(normalized);
    if (defined) {
      try { card = new (window.customElements.get(normalized))(); } catch(_) {}
    }
    if (!card) {
      try { card = document.createElement(normalized); } catch(_) {}
    }
    if (!card) {
      card = this._fallbackCard(normalized, cardDef.type);
    }

    const wrapper = this._makeWrapper(card, overlay);

    // Off-screen init container
    const temp = document.createElement('div');
    Object.assign(temp.style, { position: 'absolute', left: '-10000px', top: '-10000px' });
    document.body.appendChild(temp);
    temp.appendChild(wrapper);

    // hass before config
    if (this.hass) {
      try { card.hass = this.hass; } catch { card._hass = this.hass; }
    }

    if (cardDef.config && typeof card.setConfig === 'function') {
      try { card.setConfig(cardDef.config); } catch (e) { this._log('warn', 'setConfig error', e); }
      card._config = cardDef.config;
    }

    // Wait for updateComplete if Lit-based
    await new Promise(res => {
      if (card.updateComplete) card.updateComplete.then(() => res());
      else setTimeout(res, 10);
    });

    // Trigger updates
    if (typeof card.requestUpdate === 'function') {
      try { card.requestUpdate(); } catch(_) {}
    }
    if (card.tagName?.toLowerCase() === 'cb-lcars-button-card') {
      setTimeout(() => { try { card.requestUpdate?.(); } catch(_) {} }, 40);
    }

    temp.remove();
    this._addEventSuppression(wrapper);
    return wrapper;
  }

  // Resolve possible card definitions in overlay or raw overlay cache
  _resolveCardDefinition(overlay) {
    if (overlay.card) return overlay.card;
    if (overlay.card_config) return overlay.card_config;
    if (overlay.cardConfig) return overlay.cardConfig;
    if (overlay._card) return overlay._card;
    if (overlay.meta?.card) return overlay.meta.card;
    if (overlay.extension?.card) return overlay.extension.card;

    if (!this._rawOverlayIndex) {
      const raw = (typeof window !== 'undefined' && window._msdRawOverlays) || [];
      this._rawOverlayIndex = new Map(raw.map(o => [o.id, o]));
    }
    const rawEntry = this._rawOverlayIndex.get(overlay.id);
    return rawEntry?.card || null;
  }

  _normalizeCardType(type) {
    return this.normalizeCardType(type); // delegate to public method for consistency
  }

  _fallbackCard(normalized, original) {
    const el = document.createElement('div');
    el.style.padding = '8px';
    el.style.fontSize = '12px';
    el.style.color = 'var(--primary-text-color)';
    el.textContent = `Card: ${original}`;
    el.setAttribute('data-card-type', normalized);
    return el;
  }

  _makeWrapper(cardElement, overlay) {
    const wrapper = document.createElement('div');
    wrapper.className = 'msd-control-wrapper';
    wrapper.id = `msd-control-${overlay.id}`;
    wrapper.dataset.msdControlId = overlay.id;
    Object.assign(wrapper.style, {
      position: 'absolute',
      pointerEvents: 'auto',
      overflow: 'hidden',
      borderRadius: 'var(--ha-card-border-radius, var(--button-card-border-radius,12px))'
    });
    wrapper.appendChild(cardElement);
    return wrapper;
  }

  _addEventSuppression(node) {
    ['click','pointerdown','pointerup','touchstart','touchend'].forEach(ev =>
      node.addEventListener(ev, e => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, { capture: true })
    );
  }

  // ---------------------------------------------------------------------------
  // Positioning
  // ---------------------------------------------------------------------------
  positionControlElement(wrapper, overlay, resolvedModel) {
    const pos = this.resolvePosition(overlay.position, resolvedModel);
    const size = this.resolveSize(overlay.size, resolvedModel);
    if (!pos || !size) return;

    const rect = this._mapViewBoxRectToCss({ x: pos[0], y: pos[1], w: size[0], h: size[1] });
    if (rect && !this._isZeroRect(rect)) {
      Object.assign(wrapper.style, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: String(overlay.z_index || overlay.zIndex || 20),
        visibility: 'visible',
        display: 'block'
      });
    } else {
      const retry = (wrapper.dataset.msdRetry || 0) * 1;
      if (retry < 4) {
        wrapper.dataset.msdRetry = retry + 1;
        setTimeout(() => this.positionControlElement(wrapper, overlay, resolvedModel), 40 * (retry + 1));
      }
    }
  }

  _mapViewBoxRectToCss(vbRect) {
    try {
      const host = this.renderer?.container || this.renderer?.mountEl;
      const svg = host?.querySelector?.('svg');
      if (!svg) return null;

      const ctm = svg.getScreenCTM?.();
      const containerRect =
        host.getBoundingClientRect?.() ||
        host.host?.getBoundingClientRect?.() ||
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

      // Fallback via viewBox scaling
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
    } catch (e) {
      this._log('warn', 'CTM mapping failed', e);
      return null;
    }
  }

  _isZeroRect(r) {
    if (!r) return true;
    return ['width','height'].some(k => parseFloat(r[k] || '0') === 0);
  }

  // ---------------------------------------------------------------------------
  // Container creation
  // ---------------------------------------------------------------------------
  async ensureControlsContainerAsync() {
    let c = this.ensureControlsContainer();
    if (c) return c;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 40));
      c = this.ensureControlsContainer();
      if (c) return c;
    }
    return null;
  }

  ensureControlsContainer() {
    const target = this.renderer?.container || this.renderer?.mountEl;
    if (!target || typeof target.appendChild !== 'function') return null;

    if (this.controlsContainer &&
        this.controlsContainer.parentNode === target &&
        this.controlsContainer.isConnected) {
      return this.controlsContainer;
    }

    if (!this.controlsContainer) {
      const doc = (typeof window === 'undefined') ? global.document : document;
      if (!doc?.createElement) return null;
      const div = doc.createElement('div');
      div.id = 'msd-controls-container';
      Object.assign(div.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'auto',
        zIndex: '20',
        width: '100%',
        height: '100%',
        display: 'block',
        overflow: 'visible'
      });
      this._addEventSuppression(div);

      try {
        const wrapper = target.querySelector?.('#msd-v1-comprehensive-wrapper');
        (wrapper || target).appendChild(div);
      } catch (e) {
        this._log('warn', 'Append controls container failed', e);
        return null;
      }
      this.controlsContainer = div;
    }

    if (!this._resizeBound && typeof window !== 'undefined') {
      this._resizeBound = true;
      window.addEventListener('resize', () => {
        try { this.relayout(); } catch(e) { this._log('warn','Relayout failed on resize', e); }
      });
    }

    if (!this._autoTried) {
      this._autoTried = true;
      queueMicrotask(() => this.tryAutoRender());
    }
    return this.controlsContainer;
  }

  // ---------------------------------------------------------------------------
  // Auto-render & lifecycle
  // ---------------------------------------------------------------------------
  tryAutoRender() {
    if (this.lastRenderArgs) return;
    const r = this.renderer;
    if (!r?.lastRenderArgs) return;
    const overlays =
      r.lastRenderArgs.controlOverlays ||
      r.lastRenderArgs.overlays ||
      r.lastRenderArgs.resolvedModel?.overlays ||
      [];
    const controls = overlays.filter(o => o?.type === 'control');
    if (!controls.length) return;
    const resolvedModel =
      r.lastRenderArgs.resolvedModel ||
      { anchors: r.lastRenderArgs.anchors || {} };
    this.controlElements.clear();
    this.renderControls(controls, resolvedModel);
  }

  triggerManualRender(resolvedModel) {
    this.tryAutoRender();
    if (resolvedModel && this.lastRenderArgs?.resolvedModel !== resolvedModel) {
      const overlays = (resolvedModel.overlays || []).filter(o => o.type === 'control');
      if (overlays.length) this.renderControls(overlays, resolvedModel);
    }
  }

  relayout() {
    if (this.lastRenderArgs) {
      this.renderControls(this.lastRenderArgs.controlOverlays, this.lastRenderArgs.resolvedModel);
    }
  }

  destroy() {
    for (const [, el] of this.controlElements) {
      try { el.remove?.(); } catch(_) {}
    }
    this.controlElements.clear();
    try { this.controlsContainer?.remove?.(); } catch(_) {}
    this.controlsContainer = null;
  }

  // ---------------------------------------------------------------------------
  // Logging helper
  // ---------------------------------------------------------------------------
  _log(level, ...args) {
    if (!MsdControlsRenderer.debug && level !== 'warn' && level !== 'error') return;
    const fn = console[level] || console.log;
    fn.call(console, '[MsdControlsRenderer]', ...args);
  }
}
