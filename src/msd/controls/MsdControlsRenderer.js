/**
 * Phase 4: Home Assistant card controls renderer
 * Handles HA card embedding with SVG foreignObject positioning for proper scaling
 */

import { PositionResolver } from '../renderer/PositionResolver.js';

export class MsdControlsRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.controlElements = new Map();
    this.hass = null;
    this.lastRenderArgs = null;
    this._isRendering = false;
    this._lastSignature = null;
    if (typeof window !== 'undefined') {
      window._msdControlsRenderer = this;
    }

    // DEBUGGING: Log when MsdControlsRenderer is created
    console.log('[MsdControlsRenderer] Constructor called');
  }

  setHass(hass) {
    console.log('[MsdControlsRenderer] setHass called with:', {
      hasHass: !!hass,
      entityCount: hass?.states ? Object.keys(hass.states).length : 0,
      hasLightDesk: !!hass?.states?.['light.desk'],
      lightDeskState: hass?.states?.['light.desk']?.state,
      previousHass: !!this.hass,
      controlElementsCount: this.controlElements.size
    });

    this.hass = hass;

    // ADDED: Immediately update all existing control cards with new HASS context
    if (this.controlElements.size > 0) {
      console.log('[MsdControlsRenderer] Updating HASS context for', this.controlElements.size, 'control cards');
      this._updateAllControlsHass(hass);
    } else {
      console.log('[MsdControlsRenderer] No control elements to update');

      // Try to find and update any CB-LCARS cards that might exist but aren't tracked
      //this._updateUnmanagedCards(hass);
    }
  }

  // DEBUGGING: Try to update cards that exist but aren't managed by us
  /*
  _updateUnmanagedCards(hass) {
    console.log('[MsdControlsRenderer] Looking for unmanaged CB-LCARS cards to update');

    const unmanagedCards = document.querySelectorAll('cb-lcars-button-card, [data-card-type*="cb-lcars"]');
    console.log(`[MsdControlsRenderer] Found ${unmanagedCards.length} unmanaged cards`);

    unmanagedCards.forEach((card, index) => {
      try {
        const entity = card._config?.entity || card.entity;
        const currentState = card.hass?.states?.[entity]?.state;
        const newState = hass?.states?.[entity]?.state;

        console.log(`[MsdControlsRenderer] Unmanaged card ${index}:`, {
          entity,
          currentState,
          newState,
          stateChanged: currentState !== newState
        });

        this._applyHassToCard(card, hass, `unmanaged-${index}`);
      } catch (e) {
        console.warn(`[MsdControlsRenderer] Failed to update unmanaged card ${index}:`, e);
      }
    });
  }
  */

  // ADDED: Update HASS context for all existing control cards
  _updateAllControlsHass(hass) {
    console.log(`[MsdControlsRenderer] Updating HASS for ${this.controlElements.size} control cards`);

    for (const [overlayId, wrapperElement] of this.controlElements) {
      try {
        // Find the actual card element inside the wrapper
        const cardElement = wrapperElement.querySelector('[class*="card"], [data-card-type], cb-lcars-button-card, hui-light-card') ||
                           wrapperElement.firstElementChild;

        if (cardElement) {
          this._applyHassToCard(cardElement, hass, overlayId);
        }
      } catch (error) {
        console.warn('[MsdControlsRenderer] Failed to update HASS for control:', overlayId, error);
      }
    }
  }


  /**
   * Apply HASS context to a specific control card
   * @private
   * @param {Element} card - The card element
   * @param {Object} hass - Home Assistant object
   * @param {string} controlId - Control identifier for logging
   */
  _applyHassToCard(card, hass, controlId) {
      console.log(`[MsdControlsRenderer] Updating HASS for ${controlId}:`, {
          tagName: card.tagName,
          isCustomButtonCard: card.tagName.toLowerCase().includes('button-card'),
          hasConfig: !!card._config,
          hasSetConfig: typeof card.setConfig === 'function',
          currentHass: !!card.hass,
          hasSetHass: typeof card.setHass === 'function',
          entity: card._config?.entity || 'none'
      });

      try {
          const tagName = card.tagName ? card.tagName.toLowerCase() : '';

          // FIXED: Only CB-LCARS cards use property assignment
          const isCBLCARSCard = tagName.includes('cb-lcars');
          const isStandardHACard = tagName.includes('hui-') || (tagName.includes('button-card') && !tagName.includes('cb-lcars'));

          if (isCBLCARSCard) {
              console.log(`[MsdControlsRenderer] Using property assignment for CB-LCARS card: ${controlId}`);

              // Store old HASS for change detection
              const oldHass = card.hass;

              // CRITICAL: Update _stateObj BEFORE setting HASS to ensure proper state synchronization
              if (card._config?.entity && hass.states?.[card._config.entity]) {
                  const newStateObj = hass.states[card._config.entity];
                  console.log(`[MsdControlsRenderer] Updating _stateObj for ${controlId} entity: ${card._config.entity}`, {
                      oldState: card._stateObj?.state,
                      newState: newStateObj?.state,
                      stateChanged: card._stateObj?.state !== newStateObj?.state
                  });
                  card._stateObj = newStateObj;
              }

              // Use PROPERTY ASSIGNMENT (not method call) to trigger LitElement reactivity
              card.hass = hass;
              card._hass = hass;  // Also set internal property for compatibility

              // Trigger LitElement's reactive property system
              if (typeof card.requestUpdate === 'function') {
                  console.log(`[MsdControlsRenderer] Triggering LitElement property update for ${controlId}`);
                  card.requestUpdate('hass', oldHass);
                  card.requestUpdate('_hass', oldHass);

                  // Also trigger update for state object changes
                  if (card._config?.entity) {
                      card.requestUpdate('_stateObj');
                  }
              }
          } else if (isStandardHACard) {
              console.log(`[MsdControlsRenderer] Using setHass() method for standard HA card: ${controlId}`);

              // Standard HA cards: Use setHass method (their preferred approach)
              if (card.setHass && typeof card.setHass === 'function') {
                  card.setHass(hass);
              } else {
                  console.warn(`[MsdControlsRenderer] Standard HA card ${controlId} has no setHass method`);

                  // Fallback: property assignment
                  const oldHass = card.hass;
                  card.hass = hass;
                  card._hass = hass;

                  if (typeof card.requestUpdate === 'function') {
                      card.requestUpdate('hass', oldHass);
                  }
              }
          } else {
              console.log(`[MsdControlsRenderer] Using fallback approach for unknown card type: ${controlId}`);

              // Unknown card type: Try setHass first, then property assignment
              if (card.setHass && typeof card.setHass === 'function') {
                  card.setHass(hass);
              } else {
                  const oldHass = card.hass;
                  card.hass = hass;
                  card._hass = hass;

                  if (typeof card.requestUpdate === 'function') {
                      card.requestUpdate('hass', oldHass);
                  }
              }
          }          return true;

      } catch (error) {
          console.error(`[MsdControlsRenderer] ❌ Failed to update HASS for ${controlId}:`, error);
          return false;
      }
  }


  async renderControls(controlOverlays, resolvedModel) {
    // ADDED: More comprehensive safety checks
    if (this._isRendering) {
      console.log('[MsdControlsRenderer] renderControls skipped (in progress)');
      return;
    }

    if (!controlOverlays?.length) {
      console.log('[MsdControlsRenderer] No control overlays to render');
      return;
    }

    // ADDED: Validate resolved model
    if (!resolvedModel) {
      console.error('[MsdControlsRenderer] No resolved model provided');
      return;
    }

    // ADDED: Validate DOM environment
    if (typeof document === 'undefined') {
      console.error('[MsdControlsRenderer] Document not available');
      return;
    }

    const signature = controlOverlays.map(o => o.id).sort().join('|');
    if (
      this._lastSignature === signature &&
      this.controlElements.size === controlOverlays.length
    ) {
      console.log('[MsdControlsRenderer] renderControls skipped (unchanged signature)', signature);
      return;
    }

    this._isRendering = true;
    try {
      console.log('[MsdControlsRenderer] renderControls called', {
        count: controlOverlays.length,
        ids: controlOverlays.map(o => o.id),
        signature,
        hasHass: !!this.hass
      });

      // STEP 1: Ensure SVG container exists and clear existing controls
      const svgContainer = this.getSvgControlsContainer();
      if (!svgContainer) {
        console.error('[MsdControlsRenderer] No SVG container available; abort render');
        return;
      }

      console.log('[MsdControlsRenderer] SVG container found, clearing existing controls');
      svgContainer.innerHTML = '';
      this.controlElements.clear();

      // ADDED: Render controls with individual error handling
      for (const overlay of controlOverlays) {
        try {
          await this.renderControlOverlay(overlay, resolvedModel);
        } catch (overlayError) {
          console.error(`[MsdControlsRenderer] Failed to render control overlay ${overlay.id}:`, overlayError);
          // Continue with other overlays
        }
      }

      this.lastRenderArgs = { controlOverlays, resolvedModel };
      this._lastSignature = signature;

      console.log('[MsdControlsRenderer] renderControls completed successfully');

    } catch (error) {
      console.error('[MsdControlsRenderer] renderControls failed:', error);
      throw error; // Re-throw so caller knows it failed
    } finally {
      this._isRendering = false;
    }
  }

  async renderControlOverlay(overlay, resolvedModel) {
    // Remove any existing foreignObject for this overlay
    const existingForeignObject = document.querySelector(`#msd-control-foreign-${overlay.id}`);
    if (existingForeignObject) {
      console.log('[MsdControlsRenderer] Existing foreignObject found for', overlay.id, '- removing to avoid duplicates');
      try { existingForeignObject.remove(); } catch(_) {}
    }

    // If we somehow already have a control element instance registered, drop it (fresh rebuild model)
    if (this.controlElements.has(overlay.id)) {
      this.controlElements.delete(overlay.id);
    }

    console.log('[MsdControlsRenderer] Creating control overlay', overlay.id);
    const controlElement = await this.createControlElement(overlay);
    if (!controlElement) return;

    this.positionControlElement(controlElement, overlay, resolvedModel);
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

  // ADDED: Build the final config object passed to setConfig
  /* TO BE REMOVED - no longer needed
  buildCardConfig(cardObj) {
    if (!cardObj) return null;
    // If nested config key provided, that is authoritative
    if (cardObj.config && typeof cardObj.config === 'object') {
      return { ...cardObj.config }; // shallow clone
    }
    // Otherwise treat the card object (minus wrapper-only keys) as config
    const { type, config, ...rest } = cardObj;
    // Include type too (some built-in cards ignore, harmless if present)
    return { type, ...rest };
  }
  */

  // ADDED: Normalize card type to handle HA built-in cards
  _normalizeCardType(cardType) {
    if (!cardType) return null;

    // Handle custom cards
    if (cardType.startsWith('custom:')) {
      return cardType.slice(7); // Remove 'custom:' prefix
    }

    // ADDED: Map HA built-in card types to their actual element names
    const builtInCardMap = {
      'button': 'hui-button-card',
      'light': 'hui-light-card',
      'switch': 'hui-switch-card',
      'sensor': 'hui-sensor-card',
      'binary-sensor': 'hui-binary-sensor-card',
      'cover': 'hui-cover-card',
      'fan': 'hui-fan-card',
      'climate': 'hui-climate-card',
      'thermostat': 'hui-thermostat-card',
      'media-player': 'hui-media-control-card',
      'alarm-panel': 'hui-alarm-panel-card',
      'input-number': 'hui-input-number-card',
      'input-select': 'hui-input-select-card',
      'input-text': 'hui-input-text-card',
      'lock': 'hui-lock-card',
      'vacuum': 'hui-vacuum-card',
      'water-heater': 'hui-water-heater-card',
      'weather': 'hui-weather-forecast-card'
    };

    return builtInCardMap[cardType] || cardType;
  }

  // ADDED: normalize card type to an actual custom element tag name
  /* TO BE REMOVED - no longer needed
  normalizeCardTag(cardType) {
    if (!cardType) return null;
    if (cardType.startsWith('custom:')) return cardType.slice(7); // HA style -> real tag
    return cardType;
  }
  */

  // ADDED: schedule retries for setConfig / hass once element upgrades
  /* TO BE REMOVED - no longer needed
  _scheduleDeferredConfig(cardElement, finalConfig, overlayId, attempt = 0) {
    if (!finalConfig) return;
    const maxAttempts = 8;
    if (typeof cardElement.setConfig === 'function') {
      try {
        cardElement.setConfig(finalConfig);
        cardElement._config = finalConfig;
        if (this.hass) {
          try { cardElement.hass = this.hass; } catch { cardElement._hass = this.hass; }
        }
        console.debug('[MSD Controls] Deferred setConfig applied', overlayId, { attempt });
      } catch (e) {
        console.warn('[MSD Controls] Deferred setConfig failed', overlayId, e);
      }
      return;
    }
    if (attempt >= maxAttempts) {
      console.warn('[MSD Controls] Gave up waiting for setConfig', overlayId);
      return;
    }
    const delay = 150 * (attempt + 1);
    setTimeout(() => this._scheduleDeferredConfig(cardElement, finalConfig, overlayId, attempt + 1), delay);
  }
    */

  async createControlElement(overlay) {
    const cardDef = this.resolveCardDefinition(overlay);
    if (!cardDef) {
      console.warn('[MsdControlsRenderer] No card definition found for control overlay', overlay.id);
      return null;
    }

    try {
      const isNode = typeof window === 'undefined';

      /* TO BE REMOVED - no longer needed
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
      */


      // Browser environment - Fixed card creation and configuration
      const cardType = cardDef.type;
      let cardElement = null;

      // FIXED: Use the new normalization method
      const normalizedCardType = this._normalizeCardType(cardType);

      console.log('[MsdControls] Creating card element:', {
        originalType: cardType,
        normalizedType: normalizedCardType,
        overlayId: overlay.id
      });

      // ADDED: Special handling for HA built-in cards
      if (normalizedCardType.startsWith('hui-')) {
        cardElement = await this._createHomeAssistantCard(normalizedCardType, cardDef, overlay);
      } else {
        // Handle custom cards with existing logic
        cardElement = await this._createCustomCard(normalizedCardType, cardDef, overlay);
      }

      // Fallback: Create a placeholder
      if (!cardElement) {
        console.warn(`Could not create card element for type: ${cardType}, creating fallback`);
        cardElement = this._createFallbackCard(cardType, cardDef);
      }

      // FIXED: Apply HASS context BEFORE configuration
      console.log('[MsdControls] Applying HASS and config:', {
        overlayId: overlay.id,
        hasHass: !!this.hass,
        hasSetConfig: typeof cardElement.setConfig === 'function'
      });

      // Apply HASS context first
      if (this.hass) {
        await this._applyHassContext(cardElement, overlay.id);
      }

      // Then apply configuration
      await this._configureCard(cardElement, cardDef, overlay);

      // Create wrapper for positioning
      const wrapper = document.createElement('div');
      wrapper.className = 'msd-control-wrapper';
      wrapper.dataset.msdControlId = overlay.id;
      wrapper.style.position = 'absolute';
      wrapper.style.pointerEvents = 'auto';
      wrapper.style.touchAction = 'manipulation'; // ADDED: Better touch handling
      wrapper.appendChild(cardElement);

      // Event isolation
      this._setupEventIsolation(wrapper, cardElement, overlay);

      return wrapper;

    } catch (error) {
      console.error(`[MSD Controls] Failed to create card ${cardDef?.type}:`, error);
      return this._createFallbackCard(cardDef?.type || 'unknown', cardDef);
    }
  }

  // ADDED: Create Home Assistant built-in cards
  async _createHomeAssistantCard(normalizedCardType, cardDef, overlay) {
    console.log('[MsdControls] Creating HA built-in card:', normalizedCardType);

    try {
      // Wait for Home Assistant's card registry to be available
      if (!window.customCards && !document.querySelector('home-assistant')) {
        console.warn('[MsdControls] Home Assistant not fully loaded yet');
        return null;
      }

      // Try to get the card constructor from HA's registry
      let cardElement = null;

      // Strategy 1: Use HA's card creation helper if available
      if (window.customElements && window.customElements.get(normalizedCardType)) {
        const CardClass = window.customElements.get(normalizedCardType);
        cardElement = new CardClass();
      } else {
        // Strategy 2: Create via document and wait for upgrade
        cardElement = document.createElement(normalizedCardType);
        await this._waitForElementUpgrade(cardElement, 3000);
      }

      // ADDED: HA cards need different configuration approach
      if (cardElement && typeof cardElement.setConfig !== 'function') {
        // Some HA cards expose setConfig later or via different mechanism
        console.log('[MsdControls] HA card created but setConfig not available, trying alternative approach');

        // Wait a bit more for HA card to fully initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        if (typeof cardElement.setConfig !== 'function') {
          console.warn('[MsdControls] HA card does not have setConfig method:', normalizedCardType);
          return null;
        }
      }

      return cardElement;

    } catch (error) {
      console.warn('[MsdControls] HA card creation failed:', error);
      return null;
    }
  }

  // ADDED: Create custom cards (extracted from existing logic)
  async _createCustomCard(normalizedCardType, cardDef, overlay) {
    console.log('[MsdControls] Starting custom card creation strategies for:', normalizedCardType);
    let cardElement = null;

    // Strategy 1: Try direct custom element creation
    console.log('[MsdControls] Strategy 1: Attempting direct custom element creation for:', normalizedCardType);
    if (window.customElements && typeof window.customElements.get === 'function') {
      try {
        const CardClass = window.customElements.get(normalizedCardType);
        if (CardClass) {
          cardElement = new CardClass();
          console.log('[MsdControls] ✅ Strategy 1 SUCCESS: Created via constructor:', normalizedCardType);
        } else {
          console.log('[MsdControls] ❌ Strategy 1 FAILED: No custom element found for:', normalizedCardType);
        }
      } catch (e) {
        console.log('[MsdControls] ❌ Strategy 1 FAILED: Constructor error for', normalizedCardType, ':', e.message);
      }
    } else {
      console.log('[MsdControls] ❌ Strategy 1 SKIPPED: customElements not available');
    }

    // Strategy 2: Try document.createElement with normalized type
    if (!cardElement) {
      console.log('[MsdControls] Strategy 2: Attempting createElement with upgrade for:', normalizedCardType);
      try {
        cardElement = document.createElement(normalizedCardType);

        // Check if this is actually a custom element (not a generic div)
        if (cardElement.tagName.toLowerCase() === normalizedCardType.toLowerCase()) {
          console.log('[MsdControls] Strategy 2: Created element, waiting for upgrade:', normalizedCardType);
          // Wait for potential custom element upgrade
          await this._waitForElementUpgrade(cardElement);

          if (typeof cardElement.setConfig === 'function') {
            console.log('[MsdControls] ✅ Strategy 2 SUCCESS: Created via createElement with upgrade:', normalizedCardType);
          } else {
            console.log('[MsdControls] ❌ Strategy 2 FAILED: Element created but no setConfig after upgrade:', normalizedCardType);
            cardElement = null;
          }
        } else {
          console.log('[MsdControls] ❌ Strategy 2 FAILED: Generic element created, not custom card:', normalizedCardType);
          // Generic element created, not the custom card
          cardElement = null;
        }
      } catch (e) {
        console.log('[MsdControls] ❌ Strategy 2 FAILED: createElement error for', normalizedCardType, ':', e.message);
      }
    }

    // Strategy 3: Try creating in document body first (some cards need to be in DOM)
    if (!cardElement) {
      console.log('[MsdControls] Strategy 3: Attempting body attachment technique for:', normalizedCardType);
      try {
        cardElement = document.createElement(normalizedCardType);
        // Temporarily attach to body to trigger upgrade
        const tempParent = document.createElement('div');
        tempParent.style.position = 'absolute';
        tempParent.style.left = '-10000px';
        document.body.appendChild(tempParent);
        tempParent.appendChild(cardElement);

        console.log('[MsdControls] Strategy 3: Element attached to body, waiting for upgrade:', normalizedCardType);
        // Wait for upgrade
        await this._waitForElementUpgrade(cardElement, 5000);

        // Remove from temp parent
        cardElement.remove();
        tempParent.remove();

        if (typeof cardElement.setConfig === 'function') {
          console.log('[MsdControls] ✅ Strategy 3 SUCCESS: Created via body attachment:', normalizedCardType);
        } else {
          console.log('[MsdControls] ❌ Strategy 3 FAILED: Body attachment did not result in working card:', normalizedCardType);
          cardElement = null;
        }
      } catch (e) {
        console.log('[MsdControls] ❌ Strategy 3 FAILED: Body attachment error for', normalizedCardType, ':', e.message);
      }
    }

    if (cardElement) {
      console.log('[MsdControls] 🎉 Custom card creation SUCCESSFUL for:', normalizedCardType);
    } else {
      console.log('[MsdControls] 💥 ALL STRATEGIES FAILED for:', normalizedCardType);
    }

    return cardElement;
  }

  /**
   * Wait for custom element to be fully upgraded
   */
  async _waitForElementUpgrade(element, maxWait = 5000) {
    const startTime = Date.now();

    console.log('[MsdControls] Waiting for element upgrade:', {
      tagName: element.tagName,
      hasSetConfig: typeof element.setConfig === 'function'
    });

    while (Date.now() - startTime < maxWait) {
      // Check if element has been upgraded (has setConfig method)
      if (typeof element.setConfig === 'function') {
        console.log('[MsdControls] Element upgraded successfully:', element.tagName);
        return element;
      }

      // Check if element has upgrade promise
      if (element.updateComplete) {
        try {
          await element.updateComplete;
          if (typeof element.setConfig === 'function') {
            console.log('[MsdControls] Element upgraded via updateComplete:', element.tagName);
            return element;
          }
        } catch (e) {
          // Ignore update errors
        }
      }

      // Force upgrade attempt
      if (window.customElements && window.customElements.upgrade) {
        try {
          window.customElements.upgrade(element);
        } catch (e) {
          // Ignore upgrade errors
        }
      }

      // Short wait before next check
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.warn('[MsdControls] Element upgrade timeout:', {
      tagName: element.tagName,
      hasSetConfig: typeof element.setConfig === 'function',
      waitTime: Date.now() - startTime
    });

    return element;
  }

  /**
   * Configure the card with config and HASS context
   */
  async _configureCard(cardElement, cardDef, overlay) {
    // Build the final configuration
    const config = this._buildCardConfig(cardDef);

    console.log('[MsdControls] Configuring card:', {
      overlayId: overlay.id,
      cardType: cardDef.type,
      hasSetConfig: typeof cardElement.setConfig === 'function',
      hasHass: !!this.hass,
      config: config
    });

    // Apply configuration with retries
    if (config) {
      const success = await this._applyCardConfig(cardElement, config, overlay.id);
      if (!success) {
        // Try one more time after a longer delay
        setTimeout(async () => {
          console.log('[MsdControls] Retrying config application after delay:', overlay.id);
          await this._applyCardConfig(cardElement, config, overlay.id);
        }, 1000);
      }
    }

    // Force update if possible
    if (typeof cardElement.requestUpdate === 'function') {
      try {
        await cardElement.requestUpdate();
        console.log('[MsdControls] Requested update for:', overlay.id);
      } catch (e) {
        console.debug('[MsdControls] requestUpdate failed:', e);
      }
    }

    // ENHANCED: Additional update strategies for different card types
    if (cardElement.tagName) {
      const tagName = cardElement.tagName.toLowerCase();
      const isCustomButtonCard = tagName.includes('cb-lcars') ||
                                 tagName.includes('button-card') ||
                                 cardElement._isCustomButtonCard ||
                                 cardElement.constructor?.name?.includes('Button');

      if (isCustomButtonCard) {
        // CB-LCARS and custom-button-card specific updates
        console.log(`[MsdControls] Setting up custom-button-card updates for:`, overlay.id);

        setTimeout(() => {
          try {
            // Ensure HASS is set
            if (this.hass) {
              cardElement.hass = this.hass;
              cardElement._hass = this.hass;
            }

            // Force full re-evaluation to trigger state-based styling
            if (cardElement._config && typeof cardElement.setConfig === 'function') {
              const currentConfig = { ...cardElement._config };
              cardElement.setConfig(currentConfig);

              // Re-apply HASS after config
              if (this.hass) {
                cardElement.hass = this.hass;
              }
            }

            // LitElement update if available
            if (typeof cardElement.requestUpdate === 'function') {
              cardElement.requestUpdate();
            }

            console.debug('[MsdControls] ✅ Custom-button-card initial update completed for:', overlay.id);

          } catch (e) {
            console.debug('[MsdControls] Custom-button-card specific update failed:', e);
          }
        }, 100);

      } else if (tagName.startsWith('hui-')) {
        // Home Assistant built-in card updates
        setTimeout(() => {
          try {
            if (typeof cardElement.requestUpdate === 'function') {
              cardElement.requestUpdate();
            }
            // Force state update
            if (this.hass) {
              cardElement.hass = this.hass;
            }
          } catch (e) {
            console.debug('[MsdControls] HA card specific update failed:', e);
          }
        }, 200);
      }
    }
  }

  /**
   * Build card configuration from card definition
   */
  _buildCardConfig(cardDef) {
    if (!cardDef) return null;

    let finalConfig;

    // Handle nested config structure: { type: "light", config: { entity: "light.example" } }
    if (cardDef.config && typeof cardDef.config === 'object') {
      finalConfig = {
        type: cardDef.type,
        ...cardDef.config
      };
    } else {
      // Handle flat structure: { type: "light", entity: "light.example", name: "My Light" }
      const { type, config, card, card_config, cardConfig, ...otherProps } = cardDef;
      finalConfig = {
        type,
        ...otherProps
      };
    }

    // FIXED: More precise detection for CB-LCARS and custom-button-card based cards
    const cardType = finalConfig.type;
    const isCustomButtonCard = cardType === 'custom:cb-lcars-button-card' ||
                               cardType === 'cb-lcars-button-card' ||
                               cardType === 'custom:button-card' ||
                               cardType === 'button-card';

    // Do NOT treat regular HA built-in cards as custom-button-cards
    const isBuiltInCard = cardType === 'button' || cardType === 'light' || cardType === 'switch' ||
                          cardType.startsWith('hui-');

    if (isCustomButtonCard && !isBuiltInCard && finalConfig.entity) {
      console.log(`[MsdControlsRenderer] Adding triggers_update for CB-LCARS card with entity: ${finalConfig.entity}`);

      // Ensure triggers_update includes the entity
      if (isCustomButtonCard && !isBuiltInCard) {
        console.log(`[MsdControlsRenderer] Setting triggers_update to 'all' for CB-LCARS card: ${finalConfig.entity}`);

        // FIXED: Use 'all' so the card sees ALL HASS updates, not just specific entities
        finalConfig.triggers_update = 'all';

        console.log(`[MsdControlsRenderer] CB-LCARS card configured with triggers_update: 'all'`);
      }

      console.log(`[MsdControlsRenderer] CB-LCARS card configured with triggers_update:`, finalConfig.triggers_update);
    } else if (isBuiltInCard) {
      console.log(`[MsdControlsRenderer] Skipping triggers_update for built-in HA card: ${cardType}`);
    }    // Mark as MSD-generated
    finalConfig._msdGenerated = true;

    return finalConfig;
  }

  /**
   * Apply HASS context to card element with multiple strategies
   */
  async _applyHassContext(cardElement, overlayId) {
    if (!this.hass) {
      console.warn('[MsdControls] No HASS context available for:', overlayId);
      return false;
    }

    console.log('[MsdControls] Applying HASS context:', {
      overlayId: overlayId,
      hassKeys: Object.keys(this.hass)
    });

    const strategies = [
      // Strategy 1: Direct property assignment
      () => {
        cardElement.hass = this.hass;
        return cardElement.hass === this.hass;
      },

      // Strategy 2: Use property descriptor
      () => {
        Object.defineProperty(cardElement, 'hass', {
          value: this.hass,
          writable: true,
          configurable: true
        });
        return true;
      },

      // Strategy 3: Store in private property for later access
      () => {
        cardElement._hass = this.hass;
        // Also try setting via property if it exists
        if ('hass' in cardElement) {
          cardElement.hass = this.hass;
        }
        return true;
      }
    ];

    for (const [index, strategy] of strategies.entries()) {
      try {
        if (strategy()) {
          console.log(`[MsdControls] HASS applied via strategy ${index + 1} for:`, overlayId);
          return true;
        }
      } catch (e) {
        console.debug(`[MsdControls] HASS strategy ${index + 1} failed:`, e);
      }
    }

    console.warn('[MsdControls] All HASS application strategies failed for:', overlayId);
    return false;
  }

  /**
   * Apply card configuration with retry logic
   */
  async _applyCardConfig(cardElement, config, overlayId) {
    if (!config) return false;

    console.log('[MsdControls] Applying config:', {
      overlayId: overlayId,
      hasSetConfig: typeof cardElement.setConfig === 'function',
      cardType: config.type,
      entity: config.entity,
      triggersUpdate: config.triggers_update,
      config: config
    });

    const maxRetries = 8; // Increased retries

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (typeof cardElement.setConfig === 'function') {
          cardElement.setConfig(config);
          cardElement._config = config;

          // ADDED: Verify the config was applied correctly
          if (cardElement._config && cardElement._config.triggers_update) {
            console.log(`[MsdControls] ✅ Config applied with triggers_update:${cardElement._config.triggers_update} for:`, overlayId);
          } else {
            console.warn(`[MsdControls] ⚠️ Config applied but no triggers_update found for:`, overlayId);
          }

          console.log(`[MsdControls] ✅ Config applied on attempt ${attempt + 1} for:`, overlayId);
          return true;
        }

        // If setConfig not available yet, wait and retry
        if (attempt < maxRetries - 1) {
          const delay = 200 * (attempt + 1); // Increased delay
          console.log(`[MsdControls] Retrying config in ${delay}ms for:`, overlayId);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (e) {
        console.warn(`[MsdControls] setConfig attempt ${attempt + 1} failed for ${overlayId}:`, e);

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    }

    // Store config for later application
    cardElement._pendingConfig = config;
    console.warn('[MsdControls] ❌ Config stored for deferred application:', overlayId);

    // Set up a periodic retry
    const retryInterval = setInterval(() => {
      if (typeof cardElement.setConfig === 'function') {
        try {
          cardElement.setConfig(config);
          cardElement._config = config;
          console.log('[MsdControls] ✅ Deferred config finally applied:', overlayId);
          clearInterval(retryInterval);
        } catch (e) {
          console.warn('[MsdControls] Deferred config retry failed:', overlayId, e);
        }
      }
    }, 1000);

    // Clear interval after 10 seconds
    setTimeout(() => clearInterval(retryInterval), 10000);

    return false;
  }

  /**
   * Create fallback card when creation fails
   */
  _createFallbackCard(cardType, cardDef) {
    const fallback = document.createElement('div');
    fallback.className = 'msd-control-fallback';

    Object.assign(fallback.style, {
      border: '2px dashed var(--primary-color, #ffa500)',
      borderRadius: '8px',
      padding: '16px',
      background: 'var(--card-background-color, rgba(0,0,0,0.8))',
      color: 'var(--primary-text-color, #ffffff)',
      fontSize: '14px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80px'
    });

    const title = document.createElement('div');
    title.textContent = `Card: ${cardType}`;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';

    const subtitle = document.createElement('div');
    subtitle.textContent = '(Card failed to load)';
    subtitle.style.fontSize = '12px';
    subtitle.style.opacity = '0.7';

    fallback.appendChild(title);
    fallback.appendChild(subtitle);

    // Make it interactive for debugging
    fallback.addEventListener('click', () => {
      console.log('[MsdControls] Fallback card clicked:', { cardType, cardDef });
    });

    return fallback;
  }

  /**
   * Setup event isolation for control interactions
   */
  _setupEventIsolation(wrapper, cardElement, overlay) {
    // FIXED: Less aggressive event isolation - allow events to reach card, but prevent bubbling to MSD
    const events = [
      'click', 'dblclick', 'contextmenu',
      'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
      'touchstart', 'touchend', 'touchmove', 'touchcancel',
      'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
      'focus', 'blur', 'focusin', 'focusout',
      'keydown', 'keyup', 'keypress'
    ];

    events.forEach(eventType => {
      wrapper.addEventListener(eventType, (event) => {
        // FIXED: Only stop propagation if the event originated from our card
        // This prevents MSD from handling card events, but allows the card to work
        if (event.target === cardElement || cardElement.contains(event.target)) {
          // Allow the event to proceed to the card normally
          // Only stop it from bubbling further up to MSD
          event.stopPropagation();
          /*
          console.debug('[MsdControls] Event allowed to card but prevented from bubbling:', {
            type: event.type,
            overlayId: overlay.id,
            target: event.target.tagName,
            cardType: cardElement?.tagName
          });
          */
        }
      }, {
        capture: false,  // CHANGED: Use bubble phase so card gets events first
        passive: false   // Allow preventDefault if needed
      });
    });

    // ADDED: Set higher z-index and pointer events
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.position = 'absolute';
    wrapper.style.zIndex = '1000'; // Ensure it's above other layers
    wrapper.setAttribute('tabindex', '0');

    // ADDED: Ensure the card element itself can receive events
    if (cardElement) {
      cardElement.style.pointerEvents = 'auto';
      cardElement.style.position = 'relative';
      cardElement.style.zIndex = '1';

      // ADDED: Ensure card can receive all necessary events for hold actions
      cardElement.style.touchAction = 'manipulation'; // Improves touch responsiveness
    }

    // ADDED: Visual debugging (optional - can be removed)
    if (window.location.search.includes('debug=controls')) {
      wrapper.style.outline = '2px solid rgba(255, 0, 0, 0.5)';
      wrapper.title = `Control: ${overlay.id}`;
    }
  }

  positionControlElement(element, overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = this.resolveSize(overlay.size, resolvedModel);

    if (!position || !size) {
      console.warn('[MSD Controls] Invalid position or size for control:', overlay.id);
      return;
    }

    // Create SVG foreignObject wrapper to live in viewBox coordinate space
    const foreignObject = this.createSvgForeignObject(overlay.id, position, size);
    if (!foreignObject) {
      console.error('[MSD Controls] Failed to create SVG foreignObject for:', overlay.id);
      return;
    }

    // Configure the control element for SVG embedding
    this.configureControlForSvg(element, overlay, size);

    // Insert control into foreignObject
    foreignObject.appendChild(element);

    // Add to SVG container (this will scale automatically with viewBox)
    const svgContainer = this.getSvgControlsContainer();
    if (svgContainer && foreignObject.parentNode !== svgContainer) {
      svgContainer.appendChild(foreignObject);
      console.debug('[MSD Controls] Control positioned in SVG coordinates:', overlay.id, { position, size });
    }
  }

  /**
   * Create an SVG foreignObject element to embed HTML controls in viewBox space
   */
  createSvgForeignObject(overlayId, position, size) {
    const targetContainer = this.renderer.container || this.renderer.mountEl;
    const svg = targetContainer?.querySelector('svg');

    if (!svg) {
      console.warn('[MSD Controls] No SVG element found for foreignObject creation');
      return null;
    }

    try {
      const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

      // Position in viewBox coordinates
      foreignObject.setAttribute('x', position[0]);
      foreignObject.setAttribute('y', position[1]);
      foreignObject.setAttribute('width', size[0]);
      foreignObject.setAttribute('height', size[1]);

      // Add identification attributes
      foreignObject.setAttribute('data-msd-control-id', overlayId);
      foreignObject.setAttribute('id', `msd-control-foreign-${overlayId}`);

      // Ensure proper event handling
      foreignObject.style.pointerEvents = 'auto';
      foreignObject.style.overflow = 'visible';

      return foreignObject;

    } catch (error) {
      console.error('[MSD Controls] Failed to create foreignObject:', error);
      return null;
    }
  }

  /**
   * Configure control element for SVG embedding
   */
  configureControlForSvg(element, overlay, size) {
    // Remove any absolute positioning that would interfere with foreignObject
    element.style.position = 'relative';
    element.style.left = 'auto';
    element.style.top = 'auto';

    // Size the element to fill the foreignObject
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.boxSizing = 'border-box';

    // Ensure proper event handling
    element.style.pointerEvents = 'auto';
    element.style.zIndex = overlay.z_index || 'auto';

    // Maintain background if needed
    if (!element.style.background && !element.shadowRoot) {
      element.style.background = 'none';
    }

    console.debug('[MSD Controls] Configured element for SVG embedding:', overlay.id);
  }

  /**
   * Get or create the SVG controls container group
   */
  getSvgControlsContainer() {
    const targetContainer = this.renderer.container || this.renderer.mountEl;
    const svg = targetContainer?.querySelector('svg');

    if (!svg) {
      console.warn('[MSD Controls] No SVG element found for controls container');
      return null;
    }

    // Look for existing controls group
    let controlsGroup = svg.querySelector('#msd-controls-container');

    if (!controlsGroup) {
      // Create new controls group
      controlsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      controlsGroup.setAttribute('id', 'msd-controls-container');
      controlsGroup.style.pointerEvents = 'none'; // Group itself doesn't capture events

      // Insert after overlay container but before debug layer
      const overlayContainer = svg.querySelector('#msd-overlay-container');
      const debugLayer = svg.querySelector('#msd-debug-layer');

      if (debugLayer) {
        svg.insertBefore(controlsGroup, debugLayer);
      } else if (overlayContainer) {
        svg.insertBefore(controlsGroup, overlayContainer.nextSibling);
      } else {
        svg.appendChild(controlsGroup);
      }

      console.log('[MSD Controls] Created SVG controls container group');
    }

    return controlsGroup;
  }

  // Helper methods for position and size resolution
  resolvePosition(position, resolvedModel) {
    // Use the PositionResolver for consistency with other overlays
    const resolved = PositionResolver.resolvePosition(position, resolvedModel.anchors || {});
    if (resolved) {
      return resolved;
    }

    // Fallback: Return default position if resolution fails
    console.warn('[MSD Controls] Position resolution failed, using default [0, 0]');
    return [0, 0];
  }

  resolveSize(size, resolvedModel) {
    if (!size || !Array.isArray(size) || size.length < 2) {
      return [100, 100];
    }
    return [size[0], size[1]];
  }

  // Cleanup method
  cleanup() {
    console.log('[MsdControlsRenderer] Cleaning up controls renderer');

    // Clear control elements (now foreignObjects in SVG)
    for (const [id, element] of this.controlElements) {
      try {
        // Remove foreignObject wrapper from SVG
        const foreignObject = element.closest('foreignObject') ||
                             document.querySelector(`#msd-control-foreign-${id}`);
        if (foreignObject && foreignObject.remove) {
          foreignObject.remove();
        } else if (element && element.remove) {
          element.remove();
        }
      } catch (e) {
        console.warn(`Failed to remove control element ${id}:`, e);
      }
    }
    this.controlElements.clear();

    // Remove SVG controls container
    const targetContainer = this.renderer?.container || this.renderer?.mountEl;
    const svg = targetContainer?.querySelector('svg');
    const svgControlsContainer = svg?.querySelector('#msd-controls-container');
    if (svgControlsContainer) {
      try {
        svgControlsContainer.remove();
      } catch (e) {
        console.warn('Failed to remove SVG controls container:', e);
      }
    }

    // Clean up any legacy DOM container if it exists
    const legacyContainer = targetContainer?.querySelector('#msd-controls-container');
    if (legacyContainer && legacyContainer.tagName === 'DIV') {
      try {
        legacyContainer.remove();
        console.log('[MsdControlsRenderer] Removed legacy DOM controls container');
      } catch (e) {
        console.warn('Failed to remove legacy controls container:', e);
      }
    }

    // Clear HASS reference
    this.hass = null;
  }
}

