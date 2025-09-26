/**
 * Phase 4: Home Assistant card controls renderer
 * Handles HA card embedding with SVG foreignObject positioning for proper scaling
 */

import { PositionResolver } from '../renderer/PositionResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

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
    cblcarsLog.debug('[MsdControlsRenderer] Constructor called');
  }

  setHass(hass) {
    cblcarsLog.debug('[MsdControlsRenderer] setHass called with:', {
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
      cblcarsLog.debug('[MsdControlsRenderer] Updating HASS context for', this.controlElements.size, 'control cards');
      this._updateAllControlsHass(hass);
    } else {
      cblcarsLog.debug('[MsdControlsRenderer] No control elements to update');

      // Try to find and update any CB-LCARS cards that might exist but aren't tracked
      //this._updateUnmanagedCards(hass);
    }
  }

  // ADDED: Update HASS context for all existing control cards
  _updateAllControlsHass(hass) {
    cblcarsLog.debug(`[MsdControlsRenderer] Updating HASS for ${this.controlElements.size} control cards`);

    for (const [overlayId, wrapperElement] of this.controlElements) {
      try {
        // Find the actual card element inside the wrapper
        const cardElement = wrapperElement.querySelector('[class*="card"], [data-card-type], cb-lcars-button-card, hui-light-card') ||
                           wrapperElement.firstElementChild;

        if (cardElement) {
          this._applyHassToCard(cardElement, hass, overlayId);
        }
      } catch (error) {
        cblcarsLog.warn('[MsdControlsRenderer] Failed to update HASS for control:', overlayId, error);
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
      cblcarsLog.debug(`[MsdControlsRenderer] Updating HASS for ${controlId}:`, {
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
              cblcarsLog.debug(`[MsdControlsRenderer] Using property assignment for CB-LCARS card: ${controlId}`);

              // Store old HASS for change detection
              const oldHass = card.hass;

              // CRITICAL: Update _stateObj BEFORE setting HASS to ensure proper state synchronization
              if (card._config?.entity && hass.states?.[card._config.entity]) {
                  const newStateObj = hass.states[card._config.entity];
                  cblcarsLog.debug(`[MsdControlsRenderer] Updating _stateObj for ${controlId} entity: ${card._config.entity}`, {
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
                  cblcarsLog.debug(`[MsdControlsRenderer] Triggering LitElement property update for ${controlId}`);
                  card.requestUpdate('hass', oldHass);
                  card.requestUpdate('_hass', oldHass);

                  // Also trigger update for state object changes
                  if (card._config?.entity) {
                      card.requestUpdate('_stateObj');
                  }
              }
          } else if (isStandardHACard) {
              cblcarsLog.debug(`[MsdControlsRenderer] Using setHass() method for standard HA card: ${controlId}`);

              // Standard HA cards: Use setHass method (their preferred approach)
              if (card.setHass && typeof card.setHass === 'function') {
                  card.setHass(hass);
              } else {
                  cblcarsLog.warn(`[MsdControlsRenderer] Standard HA card ${controlId} has no setHass method`);

                  // Fallback: property assignment
                  const oldHass = card.hass;
                  card.hass = hass;
                  card._hass = hass;

                  if (typeof card.requestUpdate === 'function') {
                      card.requestUpdate('hass', oldHass);
                  }
              }
          } else {
              cblcarsLog.debug(`[MsdControlsRenderer] Using fallback approach for unknown card type: ${controlId}`);

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
          cblcarsLog.error(`[MsdControlsRenderer] ❌ Failed to update HASS for ${controlId}:`, error);
          return false;
      }
  }


  async renderControls(controlOverlays, resolvedModel) {
    // ADDED: More comprehensive safety checks
    if (this._isRendering) {
      cblcarsLog.debug('[MsdControlsRenderer] renderControls skipped (in progress)');
      return;
    }

    if (!controlOverlays?.length) {
      cblcarsLog.debug('[MsdControlsRenderer] No control overlays to render');
      return;
    }

    // ADDED: Validate resolved model
    if (!resolvedModel) {
      cblcarsLog.error('[MsdControlsRenderer] No resolved model provided');
      return;
    }

    // ADDED: Validate DOM environment
    if (typeof document === 'undefined') {
      cblcarsLog.error('[MsdControlsRenderer] Document not available');
      return;
    }

    const signature = controlOverlays.map(o => o.id).sort().join('|');
    if (
      this._lastSignature === signature &&
      this.controlElements.size === controlOverlays.length
    ) {
      cblcarsLog.debug('[MsdControlsRenderer] renderControls skipped (unchanged signature)', signature);
      return;
    }

    this._isRendering = true;
    try {
      cblcarsLog.debug('[MsdControlsRenderer] renderControls called', {
        count: controlOverlays.length,
        ids: controlOverlays.map(o => o.id),
        signature,
        hasHass: !!this.hass
      });

      // STEP 1: Ensure SVG container exists and clear existing controls
      const svgContainer = this.getSvgControlsContainer();
      if (!svgContainer) {
        cblcarsLog.error('[MsdControlsRenderer] No SVG container available; abort render');
        return;
      }

      cblcarsLog.debug('[MsdControlsRenderer] SVG container found, clearing existing controls');
      svgContainer.innerHTML = '';
      this.controlElements.clear();

      // ADDED: Render controls with individual error handling
      for (const overlay of controlOverlays) {
        try {
          await this.renderControlOverlay(overlay, resolvedModel);
        } catch (overlayError) {
          cblcarsLog.error(`[MsdControlsRenderer] Failed to render control overlay ${overlay.id}:`, overlayError);
          // Continue with other overlays
        }
      }

      this.lastRenderArgs = { controlOverlays, resolvedModel };
      this._lastSignature = signature;

      cblcarsLog.debug('[MsdControlsRenderer] renderControls completed successfully');

    } catch (error) {
      cblcarsLog.error('[MsdControlsRenderer] renderControls failed:', error);
      throw error; // Re-throw so caller knows it failed
    } finally {
      this._isRendering = false;
    }
  }

  async renderControlOverlay(overlay, resolvedModel) {
    // Remove any existing foreignObject for this overlay
    const existingForeignObject = document.querySelector(`#msd-control-foreign-${overlay.id}`);
    if (existingForeignObject) {
      cblcarsLog.debug('[MsdControlsRenderer] Existing foreignObject found for', overlay.id, '- removing to avoid duplicates');
      try { existingForeignObject.remove(); } catch(_) {}
    }

    // If we somehow already have a control element instance registered, drop it (fresh rebuild model)
    if (this.controlElements.has(overlay.id)) {
      this.controlElements.delete(overlay.id);
    }

    cblcarsLog.debug('[MsdControlsRenderer] Creating control overlay', overlay.id);
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
        cblcarsLog.debug('[MSD Controls] Deferred setConfig applied', overlayId, { attempt });
      } catch (e) {
        cblcarsLog.warn('[MSD Controls] Deferred setConfig failed', overlayId, e);
      }
      return;
    }
    if (attempt >= maxAttempts) {
      cblcarsLog.warn('[MSD Controls] Gave up waiting for setConfig', overlayId);
      return;
    }
    const delay = 150 * (attempt + 1);
    setTimeout(() => this._scheduleDeferredConfig(cardElement, finalConfig, overlayId, attempt + 1), delay);
  }
    */

  async createControlElement(overlay) {
    const cardDef = this.resolveCardDefinition(overlay);
    if (!cardDef) {
      cblcarsLog.warn('[MsdControlsRenderer] No card definition found for control overlay', overlay.id);
      return null;
    }

    try {
      // Browser environment - Fixed card creation and configuration
      const cardType = cardDef.type;
      let cardElement = null;

      // FIXED: Use the new normalization method
      const normalizedCardType = this._normalizeCardType(cardType);

      cblcarsLog.debug('[MsdControls] Creating card element:', {
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
        cblcarsLog.warn(`Could not create card element for type: ${cardType}, creating fallback`);
        cardElement = this._createFallbackCard(cardType, cardDef);
      }

      // FIXED: Apply HASS context BEFORE configuration
      cblcarsLog.debug('[MsdControls] Applying HASS and config:', {
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
      cblcarsLog.error(`[MSD Controls] Failed to create card ${cardDef?.type}:`, error);
      return this._createFallbackCard(cardDef?.type || 'unknown', cardDef);
    }
  }

  // ADDED: Create Home Assistant built-in cards
  async _createHomeAssistantCard(normalizedCardType, cardDef, overlay) {
    cblcarsLog.debug('[MsdControls] Creating HA built-in card:', normalizedCardType);

    try {
      // Wait for Home Assistant's card registry to be available
      if (!window.customCards && !document.querySelector('home-assistant')) {
        cblcarsLog.warn('[MsdControls] Home Assistant not fully loaded yet');
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
        cblcarsLog.debug('[MsdControls] HA card created but setConfig not available, trying alternative approach');

        // Wait a bit more for HA card to fully initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        if (typeof cardElement.setConfig !== 'function') {
          cblcarsLog.warn('[MsdControls] HA card does not have setConfig method:', normalizedCardType);
          return null;
        }
      }

      return cardElement;

    } catch (error) {
      cblcarsLog.warn('[MsdControls] HA card creation failed:', error);
      return null;
    }
  }

  // ADDED: Create custom cards (extracted from existing logic)
  async _createCustomCard(normalizedCardType, cardDef, overlay) {
    cblcarsLog.debug('[MsdControls] Starting custom card creation strategies for:', normalizedCardType);
    let cardElement = null;

    // Strategy 1: Try direct custom element creation
    cblcarsLog.debug('[MsdControls] Strategy 1: Attempting direct custom element creation for:', normalizedCardType);
    if (window.customElements && typeof window.customElements.get === 'function') {
      try {
        const CardClass = window.customElements.get(normalizedCardType);
        if (CardClass) {
          cardElement = new CardClass();
          cblcarsLog.debug('[MsdControls] ✅ Strategy 1 SUCCESS: Created via constructor:', normalizedCardType);
        } else {
          cblcarsLog.debug('[MsdControls] ❌ Strategy 1 FAILED: No custom element found for:', normalizedCardType);
        }
      } catch (e) {
        cblcarsLog.debug('[MsdControls] ❌ Strategy 1 FAILED: Constructor error for', normalizedCardType, ':', e.message);
      }
    } else {
      cblcarsLog.debug('[MsdControls] ❌ Strategy 1 SKIPPED: customElements not available');
    }

    // Strategy 2: Try document.createElement with normalized type
    if (!cardElement) {
      cblcarsLog.debug('[MsdControls] Strategy 2: Attempting createElement with upgrade for:', normalizedCardType);
      try {
        cardElement = document.createElement(normalizedCardType);

        // Check if this is actually a custom element (not a generic div)
        if (cardElement.tagName.toLowerCase() === normalizedCardType.toLowerCase()) {
          cblcarsLog.debug('[MsdControls] Strategy 2: Created element, waiting for upgrade:', normalizedCardType);
          // Wait for potential custom element upgrade
          await this._waitForElementUpgrade(cardElement);

          if (typeof cardElement.setConfig === 'function') {
            cblcarsLog.debug('[MsdControls] ✅ Strategy 2 SUCCESS: Created via createElement with upgrade:', normalizedCardType);
          } else {
            cblcarsLog.debug('[MsdControls] ❌ Strategy 2 FAILED: Element created but no setConfig after upgrade:', normalizedCardType);
            cardElement = null;
          }
        } else {
          cblcarsLog.debug('[MsdControls] ❌ Strategy 2 FAILED: Generic element created, not custom card:', normalizedCardType);
          // Generic element created, not the custom card
          cardElement = null;
        }
      } catch (e) {
        cblcarsLog.debug('[MsdControls] ❌ Strategy 2 FAILED: createElement error for', normalizedCardType, ':', e.message);
      }
    }

    // Strategy 3: Try creating in document body first (some cards need to be in DOM)
    if (!cardElement) {
      cblcarsLog.debug('[MsdControls] Strategy 3: Attempting body attachment technique for:', normalizedCardType);
      try {
        cardElement = document.createElement(normalizedCardType);
        // Temporarily attach to body to trigger upgrade
        const tempParent = document.createElement('div');
        tempParent.style.position = 'absolute';
        tempParent.style.left = '-10000px';
        document.body.appendChild(tempParent);
        tempParent.appendChild(cardElement);

        cblcarsLog.debug('[MsdControls] Strategy 3: Element attached to body, waiting for upgrade:', normalizedCardType);
        // Wait for upgrade
        await this._waitForElementUpgrade(cardElement, 5000);

        // Remove from temp parent
        cardElement.remove();
        tempParent.remove();

        if (typeof cardElement.setConfig === 'function') {
          cblcarsLog.debug('[MsdControls] ✅ Strategy 3 SUCCESS: Created via body attachment:', normalizedCardType);
        } else {
          cblcarsLog.debug('[MsdControls] ❌ Strategy 3 FAILED: Body attachment did not result in working card:', normalizedCardType);
          cardElement = null;
        }
      } catch (e) {
        cblcarsLog.debug('[MsdControls] ❌ Strategy 3 FAILED: Body attachment error for', normalizedCardType, ':', e.message);
      }
    }

    if (cardElement) {
      cblcarsLog.debug('[MsdControls] 🎉 Custom card creation SUCCESSFUL for:', normalizedCardType);
    } else {
      cblcarsLog.debug('[MsdControls] 💥 ALL STRATEGIES FAILED for:', normalizedCardType);
    }

    return cardElement;
  }

  /**
   * Wait for custom element to be fully upgraded
   */
  async _waitForElementUpgrade(element, maxWait = 5000) {
    const startTime = Date.now();

    cblcarsLog.debug('[MsdControls] Waiting for element upgrade:', {
      tagName: element.tagName,
      hasSetConfig: typeof element.setConfig === 'function'
    });

    while (Date.now() - startTime < maxWait) {
      // Check if element has been upgraded (has setConfig method)
      if (typeof element.setConfig === 'function') {
        cblcarsLog.debug('[MsdControls] Element upgraded successfully:', element.tagName);
        return element;
      }

      // Check if element has upgrade promise
      if (element.updateComplete) {
        try {
          await element.updateComplete;
          if (typeof element.setConfig === 'function') {
            cblcarsLog.debug('[MsdControls] Element upgraded via updateComplete:', element.tagName);
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

    cblcarsLog.warn('[MsdControls] Element upgrade timeout:', {
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

    cblcarsLog.debug('[MsdControls] Configuring card:', {
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
          cblcarsLog.debug('[MsdControls] Retrying config application after delay:', overlay.id);
          await this._applyCardConfig(cardElement, config, overlay.id);
        }, 1000);
      }
    }

    // Force update if possible
    if (typeof cardElement.requestUpdate === 'function') {
      try {
        await cardElement.requestUpdate();
        cblcarsLog.debug('[MsdControls] Requested update for:', overlay.id);
      } catch (e) {
        cblcarsLog.debug('[MsdControls] requestUpdate failed:', e);
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
        cblcarsLog.debug(`[MsdControls] Setting up custom-button-card updates for:`, overlay.id);

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

            cblcarsLog.debug('[MsdControls] ✅ Custom-button-card initial update completed for:', overlay.id);

          } catch (e) {
            cblcarsLog.debug('[MsdControls] Custom-button-card specific update failed:', e);
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
            cblcarsLog.debug('[MsdControls] HA card specific update failed:', e);
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
      cblcarsLog.debug(`[MsdControlsRenderer] Adding triggers_update for CB-LCARS card with entity: ${finalConfig.entity}`);

      // Ensure triggers_update includes the entity
      if (isCustomButtonCard && !isBuiltInCard) {
        cblcarsLog.debug(`[MsdControlsRenderer] Setting triggers_update to 'all' for CB-LCARS card: ${finalConfig.entity}`);

        // FIXED: Use 'all' so the card sees ALL HASS updates, not just specific entities
        finalConfig.triggers_update = 'all';

        cblcarsLog.debug(`[MsdControlsRenderer] CB-LCARS card configured with triggers_update: 'all'`);
      }

      cblcarsLog.debug(`[MsdControlsRenderer] CB-LCARS card configured with triggers_update:`, finalConfig.triggers_update);
    } else if (isBuiltInCard) {
      cblcarsLog.debug(`[MsdControlsRenderer] Skipping triggers_update for built-in HA card: ${cardType}`);
    }    // Mark as MSD-generated
    finalConfig._msdGenerated = true;

    return finalConfig;
  }

  /**
   * Apply HASS context to card element with multiple strategies
   */
  async _applyHassContext(cardElement, overlayId) {
    if (!this.hass) {
      cblcarsLog.warn('[MsdControls] No HASS context available for:', overlayId);
      return false;
    }

    cblcarsLog.debug('[MsdControls] Starting HASS application strategies for:', overlayId);

    const strategies = [
      // Strategy 1: Direct property assignment
      () => {
        cblcarsLog.debug('[MsdControls] HASS Strategy 1: Attempting direct property assignment for:', overlayId);
        try {
          cardElement.hass = this.hass;
          const success = cardElement.hass === this.hass;
          if (success) {
            cblcarsLog.debug('[MsdControls] ✅ HASS Strategy 1 SUCCESS: Direct property assignment for:', overlayId);
          } else {
            cblcarsLog.debug('[MsdControls] ❌ HASS Strategy 1 FAILED: Property assignment did not stick for:', overlayId);
          }
          return success;
        } catch (e) {
          cblcarsLog.debug('[MsdControls] ❌ HASS Strategy 1 FAILED: Property assignment error for', overlayId, ':', e.message);
          return false;
        }
      },

      // Strategy 2: Use property descriptor
      () => {
        cblcarsLog.debug('[MsdControls] HASS Strategy 2: Attempting property descriptor for:', overlayId);
        try {
          Object.defineProperty(cardElement, 'hass', {
            value: this.hass,
            writable: true,
            configurable: true
          });
          cblcarsLog.debug('[MsdControls] ✅ HASS Strategy 2 SUCCESS: Property descriptor applied for:', overlayId);
          return true;
        } catch (e) {
          cblcarsLog.debug('[MsdControls] ❌ HASS Strategy 2 FAILED: Property descriptor error for', overlayId, ':', e.message);
          return false;
        }
      },

      // Strategy 3: Store in private property for later access
      () => {
        cblcarsLog.debug('[MsdControls] HASS Strategy 3: Attempting private property fallback for:', overlayId);
        try {
          cardElement._hass = this.hass;
          // Also try setting via property if it exists
          if ('hass' in cardElement) {
            cardElement.hass = this.hass;
            cblcarsLog.debug('[MsdControls] HASS Strategy 3: Also set public hass property for:', overlayId);
          }
          cblcarsLog.debug('[MsdControls] ✅ HASS Strategy 3 SUCCESS: Private property fallback for:', overlayId);
          return true;
        } catch (e) {
          cblcarsLog.debug('[MsdControls] ❌ HASS Strategy 3 FAILED: Private property error for', overlayId, ':', e.message);
          return false;
        }
      }
    ];

    for (const [index, strategy] of strategies.entries()) {
      if (strategy()) {
        cblcarsLog.debug(`[MsdControls] 🎉 HASS application SUCCESSFUL via strategy ${index + 1} for:`, overlayId);
        return true;
      }
    }

    cblcarsLog.debug('[MsdControls] 💥 ALL HASS STRATEGIES FAILED for:', overlayId);
    return false;
  }

  /**
   * Apply card configuration with retry logic
   */
  async _applyCardConfig(cardElement, config, overlayId) {
    if (!config) return false;

    cblcarsLog.debug('[MsdControls] Applying config:', {
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
            cblcarsLog.debug(`[MsdControls] ✅ Config applied with triggers_update:${cardElement._config.triggers_update} for:`, overlayId);
          } else {
            cblcarsLog.warn(`[MsdControls] ⚠️ Config applied but no triggers_update found for:`, overlayId);
          }

          cblcarsLog.debug(`[MsdControls] ✅ Config applied on attempt ${attempt + 1} for:`, overlayId);
          return true;
        }

        // If setConfig not available yet, wait and retry
        if (attempt < maxRetries - 1) {
          const delay = 200 * (attempt + 1); // Increased delay
          cblcarsLog.debug(`[MsdControls] Retrying config in ${delay}ms for:`, overlayId);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (e) {
        cblcarsLog.warn(`[MsdControls] setConfig attempt ${attempt + 1} failed for ${overlayId}:`, e);

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    }

    // Store config for later application
    cardElement._pendingConfig = config;
    cblcarsLog.warn('[MsdControls] ❌ Config stored for deferred application:', overlayId);

    // Set up a periodic retry
    const retryInterval = setInterval(() => {
      if (typeof cardElement.setConfig === 'function') {
        try {
          cardElement.setConfig(config);
          cardElement._config = config;
          cblcarsLog.debug('[MsdControls] ✅ Deferred config finally applied:', overlayId);
          clearInterval(retryInterval);
        } catch (e) {
          cblcarsLog.warn('[MsdControls] Deferred config retry failed:', overlayId, e);
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
      cblcarsLog.debug('[MsdControls] Fallback card clicked:', { cardType, cardDef });
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
          cblcarsLog.debug('[MsdControls] Event allowed to card but prevented from bubbling:', {
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
  }

  positionControlElement(element, overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = this.resolveSize(overlay.size, resolvedModel);

    if (!position || !size) {
      cblcarsLog.warn('[MSD Controls] Invalid position or size for control:', overlay.id);
      return;
    }

    // Create SVG foreignObject wrapper to live in viewBox coordinate space
    const foreignObject = this.createSvgForeignObject(overlay.id, position, size);
    if (!foreignObject) {
      cblcarsLog.error('[MSD Controls] Failed to create SVG foreignObject for:', overlay.id);
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
      cblcarsLog.debug('[MSD Controls] Control positioned in SVG coordinates:', overlay.id, { position, size });
    }
  }

  /**
   * Create an SVG foreignObject element to embed HTML controls in viewBox space
   */
  createSvgForeignObject(overlayId, position, size) {
    const targetContainer = this.renderer.container || this.renderer.mountEl;
    const svg = targetContainer?.querySelector('svg');

    if (!svg) {
      cblcarsLog.warn('[MSD Controls] No SVG element found for foreignObject creation');
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
      cblcarsLog.error('[MSD Controls] Failed to create foreignObject:', error);
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

    cblcarsLog.debug('[MSD Controls] Configured element for SVG embedding:', overlay.id);
  }

  /**
   * Get or create the SVG controls container group
   */
  getSvgControlsContainer() {
    const targetContainer = this.renderer.container || this.renderer.mountEl;
    const svg = targetContainer?.querySelector('svg');

    if (!svg) {
      cblcarsLog.warn('[MSD Controls] No SVG element found for controls container');
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

      cblcarsLog.debug('[MSD Controls] Created SVG controls container group');
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
    cblcarsLog.warn('[MSD Controls] Position resolution failed, using default [0, 0]');
    return [0, 0];
  }

  resolveSize(size, resolvedModel) {
    if (!size || !Array.isArray(size) || size.length < 2) {
      return [100, 100];
    }
    return [size[0], size[1]];
  }

  /**
   * Compute attachment points for control overlay
   * @param {Object} overlay - Control overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    const size = overlay.size || [100, 80];

    if (!position || !size || !Array.isArray(size) || size.length < 2) {
      cblcarsLog.debug(`[MsdControlsRenderer] Cannot compute attachment points for ${overlay.id}: missing position or size`);
      return null;
    }

    const [x, y] = position;
    const [width, height] = size;

    // Calculate bounding box in SVG coordinate space (where foreignObject is positioned)
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return {
      id: overlay.id,
      center: [centerX, centerY],
      bbox: {
        left,
        right,
        top,
        bottom,
        width,
        height,
        x,
        y
      },
      points: {
        center: [centerX, centerY],
        top: [centerX, top],
        bottom: [centerX, bottom],
        left: [left, centerY],
        right: [right, centerY],
        topLeft: [left, top],
        topRight: [right, top],
        bottomLeft: [left, bottom],
        bottomRight: [right, bottom],
        // Aliases for common naming conventions
        'top-left': [left, top],
        'top-right': [right, top],
        'bottom-left': [left, bottom],
        'bottom-right': [right, bottom]
      }
    };
  }

  // Cleanup method
  cleanup() {
    cblcarsLog.debug('[MsdControlsRenderer] Cleaning up controls renderer');

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
        cblcarsLog.warn(`Failed to remove control element ${id}:`, e);
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
        cblcarsLog.warn('Failed to remove SVG controls container:', e);
      }
    }

    // Clean up any legacy DOM container if it exists
    const legacyContainer = targetContainer?.querySelector('#msd-controls-container');
    if (legacyContainer && legacyContainer.tagName === 'DIV') {
      try {
        legacyContainer.remove();
        cblcarsLog.debug('[MsdControlsRenderer] Removed legacy DOM controls container');
      } catch (e) {
        cblcarsLog.warn('Failed to remove legacy controls container:', e);
      }
    }

    // Clear HASS reference
    this.hass = null;
  }
}

