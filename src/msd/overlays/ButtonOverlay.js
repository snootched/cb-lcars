/**
 * ButtonOverlay.js
 * Instance-based button overlay with lifecycle management
 *
 * Phase 3B Step 2: Migration from static ButtonOverlayRenderer
 *
 * Architecture:
 * - Extends OverlayBase for lifecycle management
 * - Caches styles and content for efficient updates
 * - Delegates pure rendering to core/ButtonRenderer
 * - Manages DataSource subscriptions via OverlayBase
 * - Handles action registration and cleanup
 *
 * Lifecycle:
 * 1. Constructor: Initialize caches
 * 2. initialize(mountEl): Pre-resolve styles and content
 * 3. render(): Create button SVG markup with actions
 * 4. update(overlayElement, overlay, sourceData): Incremental DOM updates
 * 5. destroy(): Cleanup resources
 */

import { OverlayBase } from './OverlayBase.js';
import { ButtonRenderer } from '../renderer/core/ButtonRenderer.js';
import { OverlayUtils } from '../renderer/OverlayUtils.js';
import { RendererUtils } from '../renderer/RendererUtils.js';
import { DataSourceMixin } from '../renderer/DataSourceMixin.js';
import { ActionHelpers } from '../renderer/ActionHelpers.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

/**
 * ButtonOverlay - Instance-based button overlay
 *
 * Features:
 * - Button styles (color, border, radius, opacity)
 * - Text configuration (label, content, texts array)
 * - Actions (tap, hold, double_tap)
 * - Data source integration
 * - Template processing
 * - Theme token resolution
 * - Individual border/radius styling
 * - LCARS presets
 * - Effects (gradient, pattern, glow, shadow)
 * - Brackets
 */
export class ButtonOverlay extends OverlayBase {
  constructor(overlay, systemsManager) {
    super(overlay, systemsManager);

    // Caching for efficient updates
    this._cachedButtonStyle = null;
    this._cachedContent = null;
    this._cachedPosition = null;
    this._lastRenderResult = null;

    cblcarsLog.debug(`[ButtonOverlay] Created instance for overlay ${overlay.id}`);
  }

  /**
   * Initialize button overlay
   * Pre-resolves styles and content for efficient rendering
   *
   * @param {Element} mountEl - Mount element for the overlay
   * @returns {Promise<void>}
   */
  async initialize(mountEl) {
    await super.initialize(mountEl);

    try {
      // Pre-resolve button styles
      const style = this.overlay.style || {};
      this._cachedButtonStyle = this._resolveButtonOverlayStyles(style, this.overlay.id, this.overlay);

      // Pre-resolve content
      this._cachedContent = this._resolveButtonContent(this.overlay);

      cblcarsLog.debug(`[ButtonOverlay] Initialized overlay ${this.overlay.id}:`, {
        hasStyle: !!this._cachedButtonStyle,
        hasContent: !!this._cachedContent,
        hasLabel: !!this._cachedContent?.label,
        hasActions: !!(this.overlay.tap_action || this.overlay.hold_action || this.overlay.double_tap_action)
      });
    } catch (error) {
      cblcarsLog.error(`[ButtonOverlay] Error initializing overlay ${this.overlay.id}:`, error);
      throw error;
    }
  }

  /**
   * Render button overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [minX, minY, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object} {markup, actionInfo, overlayId, metadata, provenance}
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    // Resolve position
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn(`[ButtonOverlay] ⚠️ Button overlay position could not be resolved:`, overlay.id);
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: 'position_unresolved' }
      };
    }

    const [x, y] = position;
    this._cachedPosition = position;

    // Get size
    const size = overlay.size || [100, 40]; // Default button size
    const [width, height] = size;

    try {
      // Use finalStyle if available (from rules/patches), otherwise use style
      // This ensures re-renders after selective re-render use the patched styles
      const styleToUse = overlay.finalStyle || overlay.style || {};

      // Use cached styles or resolve fresh
      const buttonStyle = this._cachedButtonStyle || this._resolveButtonOverlayStyles(
        styleToUse,
        overlay.id,
        overlay
      );

      // Use cached content or resolve fresh
      const buttonContent = this._cachedContent || this._resolveButtonContent(overlay);

      // Check for actions at overlay level
      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

      // Resolve card instance
      if (!cardInstance) {
        cardInstance = this._resolveCardInstance();
      }

      // Create button configuration for ButtonRenderer
      const buttonConfig = {
        id: overlay.id,
        label: overlay.label || buttonContent.label,
        content: buttonContent.content,
        texts: overlay.texts || overlay._raw?.texts,
        tap_action: overlay.tap_action,
        hold_action: overlay.hold_action,
        double_tap_action: overlay.double_tap_action,
        // Store raw content for updates
        _raw: overlay._raw || overlay,
        _originalContent: buttonContent.originalContent
      };

      // Delegate to ButtonRenderer for pure rendering
      const result = ButtonRenderer.render(
        buttonConfig,
        buttonStyle,
        { width, height },
        { x, y },
        {
          cellId: overlay.id,
          gridContext: false,
          cardInstance: cardInstance
        }
      );

      // Process actions using ActionHelpers
      let actionInfo = null;
      if (hasActions && cardInstance) {
        actionInfo = ActionHelpers.processOverlayActions(overlay, buttonStyle, cardInstance);

        cblcarsLog.debug(`[ButtonOverlay] 🎯 Processed actions for overlay ${overlay.id}:`, {
          hasTap: !!overlay.tap_action,
          hasHold: !!overlay.hold_action,
          hasDoubleTap: !!overlay.double_tap_action
        });
      } else if (hasActions && !cardInstance) {
        cblcarsLog.warn(`[ButtonOverlay] ⚠️ Overlay ${overlay.id} has actions but no cardInstance available`);
      }

      // Wrap in overlay group with proper data attributes
      // Always enable pointer-events to support animation triggers (hover, tap, etc.)
      // Even if no explicit actions are defined, animations may need pointer events
      const overlayMarkup = `<g id="${overlay.id}"
                data-overlay-id="${overlay.id}"
                data-overlay-type="button"
                ${hasActions ? 'data-has-actions="true"' : ''}
                data-animation-ready="${!!buttonStyle.animatable}"
                style="pointer-events: all; cursor: ${hasActions ? 'pointer' : 'default'};">
                ${result.markup}
              </g>`;

      // Cache render result
      this._lastRenderResult = {
        markup: overlayMarkup,
        actionInfo: actionInfo,
        overlayId: overlay.id,
        metadata: {
          hasActions,
          hasLabel: !!buttonContent.label,
          hasContent: !!buttonContent.content,
          hasTexts: !!(overlay.texts || overlay._raw?.texts),
          preset: buttonStyle.lcars_button_preset
        },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'button',
          has_data_source: !!(overlay.data_source || overlay._raw?.data_source),
          has_actions: hasActions,
          has_texts: !!(overlay.texts || overlay._raw?.texts),
          has_label: !!buttonContent.label,
          button_style: buttonStyle.lcars_button_preset || 'default'
        })
      };

      return this._lastRenderResult;

    } catch (error) {
      cblcarsLog.error(`[ButtonOverlay] ❌ Rendering failed for overlay ${overlay.id}:`, error);
      return {
        markup: this._renderFallbackButton(overlay, x, y, width, height),
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: error.message },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'button',
          error: true
        })
      };
    }
  }

  /**
   * Update button overlay with new data
   * Performs incremental DOM updates instead of full re-render
   *
   * ✅ ENHANCED: Now detects and applies both content AND style changes
   *
   * @param {Element} overlayElement - The overlay's DOM element
   * @param {Object} overlay - Updated overlay configuration
   * @param {*} sourceData - New data from data source
   * @returns {boolean} Success status
   */
  update(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.trace(`[ButtonOverlay] Updating overlay ${overlay.id} with data:`, sourceData);

      // Update cached overlay reference
      this.overlay = overlay;

      let updated = false;

      // CRITICAL: Coordinate with AnimationManager to handle content updates during animations
      const animationManager = this.systemsManager?.animationManager;
      let hadActiveAnimations = false;

      if (animationManager) {
        const scopeData = animationManager.scopes?.get(overlay.id);
        if (scopeData && scopeData.runningInstances) {
          let totalRunning = 0;
          scopeData.runningInstances.forEach(instances => {
            totalRunning += instances.filter(inst => inst && !inst.completed).length;
          });

          if (totalRunning > 0) {
            hadActiveAnimations = true;
            cblcarsLog.debug(`[ButtonOverlay] 🎬 Pausing ${totalRunning} active animations for content update on ${overlay.id}`);
            animationManager.stopAnimations(overlay.id);
          }
        }
      }

      // 1. Check for CONTENT changes
      const newContent = this._resolveButtonContent(overlay);
      const contentChanged = this._cachedContent?.label !== newContent.label ||
                            this._cachedContent?.content !== newContent.content;

      if (contentChanged) {
        cblcarsLog.debug(`[ButtonOverlay] Content changed for ${overlay.id}`);
        this._cachedContent = newContent;

        // ✅ FIX: Create proper config object with label/content for ButtonRenderer
        const updateConfig = {
          id: overlay.id,
          label: overlay._raw?.label || overlay.label,
          content: overlay._raw?.content || overlay.content,
          texts: overlay.texts, // Also pass texts array if present
          _raw: overlay._raw || overlay,
          _originalContent: newContent.originalContent
        };

        // Update button content/text
        const contentUpdated = ButtonRenderer.updateButtonData(overlayElement, updateConfig, sourceData);
        if (contentUpdated) updated = true;
      }

      // 2. Check for STYLE changes
      const newStyle = this._resolveButtonOverlayStyles(
        overlay.style || {},
        overlay.id,
        overlay
      );

      const styleChanged = this._hasStyleChanged(this._cachedButtonStyle, newStyle);

      if (styleChanged) {
        cblcarsLog.debug(`[ButtonOverlay] Style changed for ${overlay.id}`, {
          old: this._cachedButtonStyle,
          new: newStyle
        });
        this._cachedButtonStyle = newStyle;

        // Get button size for style update
        const size = overlay.size || [100, 40];
        const [width, height] = size;

        // Update button style
        const styleUpdated = ButtonRenderer.updateButtonStyle(overlayElement, newStyle, { width, height });
        if (styleUpdated) updated = true;
      }

      if (!updated) {
        cblcarsLog.debug(`[ButtonOverlay] No changes detected for overlay ${overlay.id}`);
      }

      if (hadActiveAnimations) {
        cblcarsLog.debug(`[ButtonOverlay] 🎬 Content updated, animations will restart on next trigger`);
      }

      return updated;

    } catch (error) {
      cblcarsLog.error(`[ButtonOverlay] Error updating overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Check if button style has changed
   * Compares relevant style properties to detect changes
   * @private
   */
  _hasStyleChanged(oldStyle, newStyle) {
    if (!oldStyle || !newStyle) return true;

    // Check key style properties that affect rendering
    const keys = [
      'color', 'opacity',
      'bracket_color',
      'label_color', 'value_color'
    ];

    for (const key of keys) {
      if (oldStyle[key] !== newStyle[key]) {
        return true;
      }
    }

    // Check border properties
    if (oldStyle.border && newStyle.border) {
      const borderKeys = ['color', 'width', 'radius'];
      for (const key of borderKeys) {
        if (oldStyle.border[key] !== newStyle.border[key]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Compute attachment points for this button overlay
   *
   * @param {Object} anchors - Available anchor positions
   * @returns {Object|null} Attachment points
   */
  computeAttachmentPoints(anchors) {
    return OverlayUtils.computeAttachmentPoints(this.overlay, anchors);
  }

  /**
   * Destroy button overlay
   * Cleanup resources and subscriptions (handled by OverlayBase)
   */
  destroy() {
    cblcarsLog.debug(`[ButtonOverlay] Destroying overlay ${this.overlay.id}`);

    // Clear caches
    this._cachedButtonStyle = null;
    this._cachedContent = null;
    this._cachedPosition = null;
    this._lastRenderResult = null;

    // Call parent destroy (handles DataSource cleanup)
    super.destroy();
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Resolve comprehensive button overlay styling from configuration
   * Integrates theme token system for theme-aware styling
   *
   * @private
   * @param {Object} style - Style configuration
   * @param {string} overlayId - Overlay ID for logging
   * @param {Object} overlay - Full overlay configuration
   * @returns {Object} Resolved button styles
   */
  _resolveButtonOverlayStyles(style, overlayId, overlay = null) {
    // Create component-scoped token resolver
    const resolveToken = (themeTokenResolver && typeof themeTokenResolver.forComponent === 'function')
      ? themeTokenResolver.forComponent('button')
      : null;

    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    // Get viewBox for context
    const viewBox = this.systemsManager?.rendererSystem?.viewBox || [0, 0, 800, 600];

    const buttonStyle = {
      // Basic appearance via tokens
      color: this._resolveStyleProperty(
        overlay?.color || style?.color || standardStyles.colors.primaryColor,
        'defaultColor',
        resolveToken,
        this._getDefault('button.color', 'var(--lcars-blue)'),
        { viewBox }
      ),

      opacity: this._resolveStyleProperty(
        style.opacity || standardStyles.layout.opacity,
        'effects.opacity.base',
        resolveToken,
        this._getDefault('button.opacity', 1.0),
        { viewBox }
      ),

      // Border styling - use normalized border object from standardStyles
      // RendererUtils.parseStandardBorderStyles() already normalized both old and new formats
      border: {
        color: this._resolveStyleProperty(
          standardStyles.border.color,
          'colors.ui.border',
          resolveToken,
          this._getDefault('button.border_color', 'var(--lcars-gray)'),
          { viewBox }
        ),

        width: this._resolveStyleProperty(
          standardStyles.border.width,
          'borders.width.base',
          resolveToken,
          this._getDefault('button.border_width', 1),
          { viewBox }
        ),

        radius: this._resolveStyleProperty(
          standardStyles.border.radius,
          'borders.radius.lg',
          resolveToken,
          this._getDefault('button.border_radius', 8),
          { viewBox }
        ),

        style: standardStyles.border.style,

        // Individual sides (if specified)
        top: standardStyles.border.top,
        right: standardStyles.border.right,
        bottom: standardStyles.border.bottom,
        left: standardStyles.border.left,

        // Individual corners (if specified)
        radiusTopLeft: standardStyles.border.radiusTopLeft,
        radiusTopRight: standardStyles.border.radiusTopRight,
        radiusBottomRight: standardStyles.border.radiusBottomRight,
        radiusBottomLeft: standardStyles.border.radiusBottomLeft
      },

      // Text styling via tokens
      label_color: this._resolveStyleProperty(
        standardStyles.text.labelColor || style.label_color,
        'colors.ui.foreground',
        resolveToken,
        this._getDefault('button.label_color', 'var(--lcars-white)'),
        { viewBox }
      ),

      value_color: this._resolveStyleProperty(
        standardStyles.text.valueColor || style.value_color,
        'colors.ui.foreground',
        resolveToken,
        this._getDefault('button.value_color', 'var(--lcars-white)'),
        { viewBox }
      ),

      font_size: Number(style.font_size) || Math.max(standardStyles.text.fontSize || 12, this._getDefault('button.font_size', 18)),

      font_family: this._resolveStyleProperty(
        standardStyles.text.fontFamily || style.font_family,
        'typography.fontFamily.primary',
        resolveToken,
        this._getDefault('button.font_family', 'var(--lcars-font-family, Antonio)'),
        { viewBox }
      ),

      font_weight: standardStyles.text.fontWeight || style.font_weight || this._getDefault('button.font_weight', 'normal'),

      // Enhanced text sizing
      label_font_size: Number(style.label_font_size) || Number(style.font_size) || this._getDefault('button.label_font_size', 18),
      value_font_size: Number(style.value_font_size) || (Number(style.font_size) ? Number(style.font_size) * 0.9 : this._getDefault('button.value_font_size', 16)),

      // Text positioning and layout
      label_position: style.label_position || this._getDefault('button.label_position', 'center-top'),
      value_position: style.value_position || this._getDefault('button.value_position', 'center-bottom'),
      text_padding: Number(style.text_padding || this._getDefault('button.text_padding', 8)),

      // Control visibility
      show_labels: style.show_labels !== false, // Default true
      show_values: style.show_values !== false, // Default true

      // CB-LCARS presets
      lcars_button_preset: style.lcars_button_preset || null,
      lcars_text_preset: style.lcars_text_preset || null,

      // Effects (using standardized effect parsing)
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features
      bracket_style: style.bracket_style || false,
      bracket_color: style.bracket_color || standardStyles.colors.primaryColor,
      bracket_width: Number(style.bracket_width || 2),
      bracket_gap: Number(style.bracket_gap || 4),
      bracket_extension: Number(style.bracket_extension || 8),
      bracket_opacity: Number(style.bracket_opacity || 1),

      // Interaction (using standardized interaction styles)
      hover_enabled: standardStyles.interaction.hoverEnabled,
      hover_color: standardStyles.colors.hoverColor,
      hover_scale: standardStyles.interaction.hoverScale,

      // Animation (using standardized animation styles)
      animatable: standardStyles.animation.animatable,
      reveal_animation: standardStyles.animation.revealAnimation,
      pulse_on_change: standardStyles.animation.pulseOnChange,

      // Actions
      actions: style.actions || null,

      // Store parsed standard styles for reference
      standardStyles
    };

    cblcarsLog.debug(`[ButtonOverlay] 🔲 Resolved button style for ${overlayId}:`, {
      color: buttonStyle.color,
      preset: buttonStyle.lcars_button_preset,
      border_width: buttonStyle.border_width,
      border_color: buttonStyle.border_color,
      border_radius: buttonStyle.border_radius,
      border_bottom: buttonStyle.border_bottom,
      label_color: buttonStyle.label_color,
      value_color: buttonStyle.value_color,
      hasIndividualBorders: !!(style.border_top || style.border_right || style.border_bottom || style.border_left),
      hasIndividualRadius: !!(style.border_radius_top_left || style.border_radius_top_right ||
                             style.border_radius_bottom_right || style.border_radius_bottom_left)
    });

    return buttonStyle;
  }

  /**
   * Resolve a style property using token system with fallback
   *
   * @private
   * @param {*} styleValue - Explicit style value from configuration
   * @param {string} tokenPath - Token path to resolve
   * @param {Function} resolveToken - Token resolver function
   * @param {*} fallback - Fallback value
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value
   */
  _resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context = {}) {
    // If style value is explicitly set, check if it's a token reference
    if (styleValue !== undefined && styleValue !== null) {
      if (resolveToken && typeof styleValue === 'string' && this._isTokenReference(styleValue)) {
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    // Otherwise resolve from token system
    if (resolveToken) {
      return resolveToken(tokenPath, fallback, context);
    }

    // Final fallback
    return fallback;
  }

  /**
   * Check if a value is a token reference
   *
   * @private
   * @param {*} value - Value to check
   * @returns {boolean} True if token reference
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Resolve button content with template processing
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @returns {Object} {label, content, originalContent}
   */
  _resolveButtonContent(overlay) {
    // Get raw content from various sources
    const rawLabel = overlay._raw?.label || overlay.label || '';
    const rawContent = overlay._raw?.content || overlay.content || overlay.label || '';

    // Process templates using DataSourceMixin
    const processedLabel = this._processContentTemplate(rawLabel);
    const processedContent = this._processContentTemplate(rawContent);

    return {
      label: processedLabel,
      content: processedContent,
      // Store original for updates
      originalContent: rawContent !== processedContent ? rawContent : null
    };
  }

  /**
   * Process content template using DataSourceMixin
   *
   * @private
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  _processContentTemplate(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    if (!TemplateProcessor.hasTemplates(content)) {
      return content;
    }

    return DataSourceMixin.processUnifiedTemplateStrings(content, 'ButtonOverlay');
  }

  /**
   * Resolve card instance for action handling
   *
   * @private
   * @returns {Object|null} Card instance
   */
  _resolveCardInstance() {
    if (window.cblcars.debug.msd?.pipelineInstance?.cardInstance) {
      return window.cblcars.debug.msd.pipelineInstance.cardInstance;
    }

    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    return null;
  }

  /**
   * Render fallback button for error cases
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @returns {string} Fallback SVG markup
   */
  _renderFallbackButton(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-gray)';

    cblcarsLog.warn(`[ButtonOverlay] ⚠️ Using fallback rendering for overlay ${overlay.id}`);

    return `<g id="${overlay.id}" data-overlay-id="${overlay.id}" data-overlay-type="button" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2" rx="4"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle"
                      font-family="var(--lcars-font-family, Antonio)">
                  Button Error
                </text>
              </g>
            </g>`;
  }

  /**
   * Get default value for a property
   *
   * @private
   * @param {string} path - Property path (e.g., 'button.color')
   * @param {*} fallback - Fallback value
   * @returns {*} Default value
   */
  _getDefault(path, fallback) {
    // In the future, this could pull from a centralized defaults registry
    // For now, just return the fallback
    return fallback;
  }

  /**
   * Get renderer provenance information
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Provenance information
   */
  _getRendererProvenance(overlayId, metadata = {}) {
    return {
      renderer: 'ButtonOverlay',
      version: '3.0.0',
      timestamp: Date.now(),
      overlayId,
      metadata
    };
  }

  // ============================================================================
  // ANIMATION TARGETING API
  // ============================================================================

  /**
   * Get the default animation target for button overlays
   * Buttons default to animating the entire button group
   *
   * @returns {Element} The button element (entire group)
   */
  getDefaultAnimationTarget() {
    // Default: animate the entire button element
    return this.element;
  }

  /**
   * Get a specific animation target within the button
   *
   * Supported targets:
   * - 'overlay' or 'self' - The entire button group
   * - 'label' - The label text element
   * - 'content' or 'value' - The content/value text element
   * - 'texts[n]' - Specific text by index (e.g., 'texts[0]', 'texts[1]')
   * - Any CSS selector - Queried within button element
   *
   * @param {string} targetSpec - Target specification
   * @returns {Element|null} The target element or null if not found
   */
  getAnimationTarget(targetSpec) {
    cblcarsLog.debug(`[ButtonOverlay] getAnimationTarget called for ${this.overlay.id}:`, {
      targetSpec,
      hasElement: !!this.element,
      elementId: this.element?.id,
      elementTag: this.element?.tagName
    });

    if (!this.element) {
      cblcarsLog.warn(`[ButtonOverlay] No element available for target resolution: ${this.overlay.id}`);
      return null;
    }

    // No spec or explicit self-reference = entire button
    if (!targetSpec || targetSpec === 'overlay' || targetSpec === 'self') {
      return this.element;
    }

    // Named targets for button text elements
    if (targetSpec === 'label') {
      const el = this.element.querySelector('[data-button-text-type="label"]');
      cblcarsLog.debug(`[ButtonOverlay] Label target search result:`, { found: !!el, element: el });
      return el;
    }

    if (targetSpec === 'content' || targetSpec === 'value') {
      const el = this.element.querySelector('[data-button-text-type="value"]');
      cblcarsLog.debug(`[ButtonOverlay] Content/value target search result:`, { found: !!el, element: el });
      return el;
    }

    // Array index syntax: texts[0], texts[1], etc.
    const arrayMatch = targetSpec.match(/^texts\[(\d+)\]$/);
    if (arrayMatch) {
      const idx = parseInt(arrayMatch[1], 10);
      const el = this.element.querySelector(`[data-button-text-index="${idx}"]`);
      cblcarsLog.debug(`[ButtonOverlay] Array index target search result:`, { idx, found: !!el, element: el });
      return el;
    }

    // Fallback: CSS selector within button element
    cblcarsLog.debug(`[ButtonOverlay] Using CSS selector fallback: ${targetSpec}`);
    return super.getAnimationTarget(targetSpec);
  }

  // ============================================================================
  // STATIC METHODS FOR INCREMENTAL UPDATE SYSTEM (Phase 3)
  // ============================================================================

  /**
   * Declare support for incremental updates
   * @static
   * @returns {boolean} True if this renderer supports incremental updates
   */
  static supportsIncrementalUpdate() {
    return true;
  }

  /**
   * Perform incremental update on existing button overlay
   * Updates button styles without full rebuild
   *
   * @static
   * @param {Object} overlay - Overlay configuration with updated finalStyle
   * @param {Element} overlayElement - Existing DOM element (the <g> wrapper)
   * @param {Object} context - Update context { dataSourceManager, systemsManager, hass }
   * @returns {boolean} True if update succeeded
   */
  static updateIncremental(overlay, overlayElement, context) {
    cblcarsLog.debug(`[ButtonOverlay] 🎨 INCREMENTAL UPDATE: ${overlay.id}`);

    try {
      // Get updated style (already patched by SystemsManager)
      const style = overlay.finalStyle || overlay.style || {};

      // DEBUG: Log what we received
      cblcarsLog.debug(`[ButtonOverlay] 📥 Input style for ${overlay.id}:`, {
        hasFinalStyle: !!overlay.finalStyle,
        hasBorder: !!style.border,
        borderColor: style.border?.color,
        borderWidth: style.border?.width,
        borderRadius: style.border?.radius,
        label_color: style.label_color,
        value_color: style.value_color
      });

      // Get button size
      const size = overlay.size || [100, 40];
      const [width, height] = size;

      // Find the button element within the overlay group
      // The button markup is nested inside the <g data-overlay-id> wrapper
      const buttonElement = overlayElement.querySelector('[data-button-id]');
      if (!buttonElement) {
        cblcarsLog.warn(`[ButtonOverlay] ⚠️ Button element not found for ${overlay.id}`);
        return false;
      }

      // Create temporary instance to resolve styles
      const tempInstance = new ButtonOverlay(overlay, context.systemsManager);
      const resolvedStyle = tempInstance._resolveButtonOverlayStyles(style, overlay.id, overlay);

      // resolvedStyle now has correct nested border format from _resolveButtonOverlayStyles()
      // No transformation needed - RendererUtils.parseStandardBorderStyles() already normalized it

      // Update button style using ButtonRenderer
      const styleUpdated = ButtonRenderer.updateButtonStyle(
        buttonElement,
        resolvedStyle,
        { width, height }
      );

      // ButtonRenderer returns:
      // - true: Successfully updated attributes incrementally
      // - false: Geometry changes detected, needs full re-render (will trigger fallback)
      if (styleUpdated === false) {
        cblcarsLog.debug(`[ButtonOverlay] ⚠️ Geometry changes detected - returning false to trigger selective re-render: ${overlay.id}`);
        return false;  // Trigger fallback to selective re-render
      }

      if (styleUpdated) {
        cblcarsLog.debug(`[ButtonOverlay] ✅ INCREMENTAL UPDATE SUCCESS: ${overlay.id}`);
        return true;
      } else {
        // This shouldn't happen anymore, but keep for safety
        cblcarsLog.debug(`[ButtonOverlay] ℹ️ No style changes for ${overlay.id}`);
        return true;
      }

    } catch (error) {
      cblcarsLog.error(`[ButtonOverlay] ❌ INCREMENTAL UPDATE ERROR for ${overlay.id}:`, error);
      return false;
    }
  }
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.ButtonOverlay = ButtonOverlay;
}
