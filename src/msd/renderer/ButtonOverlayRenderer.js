/**
 * [ButtonOverlayRenderer] Individual LCARS button overlay
 * 🔲 Standalone button with full preset and styling support
 * Follows the exact MSD overlay integration pattern
 */

import { ButtonRenderer } from './core/ButtonRenderer.js';
import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { ActionHelpers } from './ActionHelpers.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ButtonOverlayRenderer {
  constructor() {
    // Connect to defaults manager from global context
    this.defaultsManager = this._resolveDefaultsManager();
  }

  /**
   * Resolve defaults manager from various sources
   * @private
   * @returns {Object|null} Defaults manager instance
   */
  _resolveDefaultsManager() {
    // 1. Global CB-LCARS namespace (preferred)
    if (window.cblcars?.defaults) {
      return window.cblcars.defaults;
    }

    // 2. Pipeline instance
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.defaultsManager) {
      return pipelineInstance.systemsManager.defaultsManager;
    }

    // 3. Direct pipeline access
    if (pipelineInstance?.defaultsManager) {
      return pipelineInstance.defaultsManager;
    }

    // 4. Systems manager global reference
    const systemsManager = window.__msdDebug?.systemsManager;
    if (systemsManager?.defaultsManager) {
      return systemsManager.defaultsManager;
    }

    cblcarsLog.debug('[ButtonOverlayRenderer] ⚠️ No defaults manager found');
    return null;
  }

  /**
   * Get default value from defaults manager with fallback
   * @private
   * @param {string} path - Dot-notation path to the default
   * @param {any} fallback - Fallback value if default not found
   * @returns {any} Default value or fallback
   */
  _getDefault(path, fallback = null) {
    if (this.defaultsManager && typeof this.defaultsManager.resolve === 'function') {
      const resolved = this.defaultsManager.resolve(path);
      return resolved !== null ? resolved : fallback;
    }
    return fallback;
  }

  /**
   * Render a button overlay with full styling support
   * @param {Object} overlay - Button overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element for measurements
   * @returns {Object} Complete result object with markup, actionInfo, and overlayId
   * @static
   */
  static render(overlay, anchors, viewBox, svgContainer) {
    // Return full result object for AdvancedRenderer to process actions
    return ButtonOverlayRenderer.renderWithActions(overlay, anchors, viewBox, svgContainer);
  }

  /**
   * Render button overlay with action metadata
   * @param {Object} overlay - Button overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element for measurements
   * @returns {Object} Object with markup, actionInfo, and overlayId
   * @static
   */
  static renderWithActions(overlay, anchors, viewBox, svgContainer) {
    // Create instance for non-static methods
    const instance = new ButtonOverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // CRITICAL: Pass systemsManager if available for DataSource access
    instance.systemsManager = svgContainer?.systemsManager || window.__msdSystemsManager;

    return instance.renderButton(overlay, anchors, viewBox);
  }

  /**
   * Update button overlay data when DataSource changes
   * @param {Element} overlayElement - Cached DOM element for the overlay
   * @param {Object} overlay - Overlay configuration object
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated
   * @static
   */
  static updateButtonData(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.debug(`[ButtonOverlayRenderer] Updating button overlay ${overlay.id} with DataSource data`);

      // Delegate to ButtonRenderer for actual update
      return ButtonRenderer.updateButtonData(overlayElement, overlay, sourceData);
    } catch (error) {
      cblcarsLog.error(`[ButtonOverlayRenderer] Error updating button overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Instance method for comprehensive button overlay rendering
   * @param {Object} overlay - Button overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {Object} {markup, actionInfo, overlayId}
   */
  renderButton(overlay, anchors, viewBox) {
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[ButtonOverlayRenderer] ⚠️ Button overlay position could not be resolved:', overlay.id);
      return { markup: '', actionInfo: null, overlayId: overlay.id };
    }

    const [x, y] = position;
    const size = overlay.size || [100, 40]; // Default button size
    const [width, height] = size;

    try {
      // Resolve button styling using consistent pattern
      const style = overlay.style || {};
      const buttonStyle = this._resolveButtonOverlayStyles(style, overlay.id, overlay);

      // Check for actions at OVERLAY level BEFORE rendering
      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);
      const cardInstance = this._resolveCardInstance();

      // Process button content - handle templates and DataSource references
      const buttonContent = this._resolveButtonContent(overlay);

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

      // Delegate to ButtonRenderer for actual rendering
      const result = ButtonRenderer.render(
        buttonConfig,
        buttonStyle,
        { width, height },
        { x, y },
        {
          cellId: overlay.id,
          gridContext: false, // Not in a grid context
          cardInstance: cardInstance
        }
      );

      // Process actions using ActionHelpers
      let actionInfo = null;
      if (hasActions && cardInstance) {
        actionInfo = ActionHelpers.processOverlayActions(overlay, buttonStyle, cardInstance);

        cblcarsLog.debug(`[ButtonOverlayRenderer] 🎯 Processed actions for button overlay ${overlay.id}:`, {
          hasTap: !!overlay.tap_action,
          hasHold: !!overlay.hold_action,
          hasDoubleTap: !!overlay.double_tap_action,
          hasCardInstance: !!cardInstance
        });
      } else if (hasActions && !cardInstance) {
        cblcarsLog.warn(`[ButtonOverlayRenderer] ⚠️ Button overlay ${overlay.id} has actions but no cardInstance available`);
      }

      // Wrap in overlay group with proper data attributes
      const overlayMarkup = `<g data-overlay-id="${overlay.id}"
                data-overlay-type="button"
                ${hasActions ? 'data-has-actions="true"' : ''}
                data-animation-ready="${!!buttonStyle.animatable}"
                style="pointer-events: ${hasActions ? 'all' : 'none'}; cursor: ${hasActions ? 'pointer' : 'default'};">
                ${result.markup}
              </g>`;

      return {
        markup: overlayMarkup,
        actionInfo: actionInfo,
        overlayId: overlay.id
      };

    } catch (error) {
      cblcarsLog.error(`[ButtonOverlayRenderer] ❌ Rendering failed for button overlay ${overlay.id}:`, error);
      return {
        markup: this._renderFallbackButton(overlay, x, y, width, height),
        actionInfo: null,
        overlayId: overlay.id
      };
    }
  }

  /**
   * Resolve comprehensive button overlay styling from configuration
   * @private
   */
  _resolveButtonOverlayStyles(style, overlayId, overlay = null) {
    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    const buttonStyle = {
      // Basic appearance - prioritize overlay direct properties, then overlay.style, then defaults
      color: overlay?.color || style?.color || standardStyles.colors.primaryColor || this._getDefault('button.color', 'var(--lcars-blue)'),
      opacity: style.opacity || standardStyles.layout.opacity || this._getDefault('button.opacity', 1.0),

      // Border styling - enhanced individual control
      border_width: style.border_width || standardStyles.layout.borderWidth || this._getDefault('button.border_width', 1),
      border_color: style.border_color || standardStyles.colors.borderColor || this._getDefault('button.border_color', 'var(--lcars-gray)'),
      border_radius: style.border_radius || standardStyles.layout.borderRadius || this._getDefault('button.border_radius', 8),

      // Individual border control
      border_top: style.border_top || null,
      border_right: style.border_right || null,
      border_bottom: style.border_bottom || null,
      border_left: style.border_left || null,

      // Individual corner radius
      border_radius_top_left: style.border_radius_top_left || null,
      border_radius_top_right: style.border_radius_top_right || null,
      border_radius_bottom_right: style.border_radius_bottom_right || null,
      border_radius_bottom_left: style.border_radius_bottom_left || null,

      // Text styling (using standardized text styles with defaults manager fallbacks)
      label_color: standardStyles.text.labelColor || style.label_color || this._getDefault('button.label_color', 'var(--lcars-white)'),
      value_color: standardStyles.text.valueColor || style.value_color || this._getDefault('button.value_color', 'var(--lcars-white)'),
      font_size: Number(style.font_size) || Math.max(standardStyles.text.fontSize || 12, this._getDefault('button.font_size', 18)),
      font_family: standardStyles.text.fontFamily || style.font_family || this._getDefault('button.font_family', 'var(--lcars-font-family, Antonio)'),
      font_weight: standardStyles.text.fontWeight || style.font_weight || this._getDefault('button.font_weight', 'normal'),

      // Enhanced text sizing
      label_font_size: Number(style.label_font_size) || Number(style.font_size) || this._getDefault('button.label_font_size', 18),
      value_font_size: Number(style.value_font_size) || (Number(style.font_size) ? Number(style.font_size) * 0.9 : this._getDefault('button.value_font_size', 16)),

      // Text positioning and layout
      label_position: style.label_position || this._getDefault('button.label_position', 'center-top'),
      value_position: style.value_position || this._getDefault('button.value_position', 'center-bottom'),
      text_padding: Number(style.text_padding || this._getDefault('button.text_padding', 8)),

      // Control visibility
      show_labels: style.show_labels !== false, // Default true unless explicitly set to false
      show_values: style.show_values !== false, // For standalone buttons, default to true

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

    cblcarsLog.debug(`[ButtonOverlayRenderer] 🔲 Resolved button overlay style for ${overlayId}:`, {
      color: buttonStyle.color,
      preset: buttonStyle.lcars_button_preset,
      hasIndividualBorders: !!(style.border_top || style.border_right || style.border_bottom || style.border_left),
      hasIndividualRadius: !!(style.border_radius_top_left || style.border_radius_top_right || style.border_radius_bottom_right || style.border_radius_bottom_left)
    });

    return buttonStyle;
  }

  /**
   * Resolve button content with template processing
   * @private
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
   * @private
   */
  _processContentTemplate(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    const hasMSD = content.includes('{');
    const hasHA = content.includes('{{') && content.includes('}}');
    if (!hasMSD && !hasHA) {
      return content;
    }

    return DataSourceMixin.processUnifiedTemplateStrings(content, 'ButtonOverlayRenderer');
  }

  /**
   * Resolve card instance for action handling
   * @private
   */
  _resolveCardInstance() {
    if (window.__msdDebug?.pipelineInstance?.cardInstance) {
      return window.__msdDebug.pipelineInstance.cardInstance;
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
   * @private
   */
  _renderFallbackButton(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-gray)';

    cblcarsLog.warn(`[ButtonOverlayRenderer] ⚠️ Using fallback rendering for button overlay ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="button" data-fallback="true">
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
   * Compute attachment points for button overlay
   * @param {Object} overlay - Button overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    return OverlayUtils.computeAttachmentPoints(overlay, anchors);
  }
}

// Expose ButtonOverlayRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.ButtonOverlayRenderer = ButtonOverlayRenderer;
}
