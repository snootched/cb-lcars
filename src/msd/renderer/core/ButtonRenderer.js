/**
 * [ButtonRenderer] Individual button rendering with full LCARS styling support
 * 🔲 Provides comprehensive button rendering for both status grids and standalone buttons
 * 🎨 Supports individual border styling and corner radius control
 *
 * ✅ ENHANCED: Now includes provenance tracking (Phase 5.2A)
 */

import { BaseRenderer } from '../BaseRenderer.js';
import { OverlayUtils } from '../OverlayUtils.js';
import { RendererUtils } from '../RendererUtils.js';
import { DataSourceMixin } from '../DataSourceMixin.js';
import { BracketRenderer } from '../BracketRenderer.js';
import { ActionHelpers } from '../ActionHelpers.js';
import { TextRenderer as CoreTextRenderer } from './TextRenderer.js'; // Import core TextRenderer
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

export class ButtonRenderer extends BaseRenderer {
  constructor() {
    super();
    this.rendererName = 'ButtonRenderer';

    // Connect to theme manager from global context
    this.themeManager = this._resolveThemeManager();
    this.stylePresetManager = this._resolveStylePresetManager();
  }

  /**
   * Resolve style preset manager from various sources
   * @private
   * @returns {Object|null} Style preset manager instance
   */
  _resolveStylePresetManager() {
    // 1. Pipeline instance (preferred)
    const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.stylePresetManager) {
      return pipelineInstance.systemsManager.stylePresetManager;
    }

    // 2. Systems manager global reference
    const systemsManager = window.cblcars.debug.msd?.systemsManager;
    if (systemsManager?.stylePresetManager) {
      return systemsManager.stylePresetManager;
    }

    cblcarsLog.debug('[ButtonRenderer] ⚠️ No style preset manager found');
    return null;
  }

  /**
   * Render a single button with full LCARS styling support
   *
   * ✅ ENHANCED: Now includes provenance tracking
   *
   * @param {Object} config - Button configuration
   * @param {Object} style - Resolved button styling
   * @param {Object} size - Button dimensions {width, height}
   * @param {Object} position - Button position {x, y}
   * @param {Object} options - Additional options {cellId, gridContext, etc}
   * @returns {Object} {markup, actions, metadata, provenance}
   * @static
   */
  static render(config, style, size, position, options = {}) {
    const instance = new ButtonRenderer();

    // ✅ NEW: Start tracking
    instance._resetTracking();
    instance._startRenderTiming();

    const result = instance.renderButton(config, style, size, position, options);

    // ✅ NEW: Add provenance to result
    if (result && result.markup) {
      result.provenance = instance._getRendererProvenance(config.id, {
        button_type: options.gridContext ? 'grid_cell' : 'standalone',
        has_actions: !!result.needsActionAttachment,
        has_texts: !!(config.texts && config.texts.length > 0),
        has_label: !!config.label,
        has_content: !!config.content,
        preset: style.lcars_button_preset || null,
        text_preset: style.lcars_text_preset || null
      });
    }

    return result;
  }

  /**
   * Update button content dynamically
   * @param {Element} buttonElement - DOM element for the button
   * @param {Object} config - Button configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if updated
   * @static
   */
  static updateButtonData(buttonElement, config, sourceData) {
    const instance = new ButtonRenderer();
    return instance.updateButton(buttonElement, config, sourceData);
  }

  /**
   * Instance method for comprehensive button rendering
   * @param {Object} config - Button configuration
   * @param {Object} style - Resolved button styling
   * @param {Object} size - Button dimensions {width, height}
   * @param {Object} position - Button position {x, y}
   * @param {Object} options - Additional options
   * @returns {Object} {markup, actions, metadata}
   */
  renderButton(config, style, size, position, options = {}) {
    const { width, height } = size;
    const { x, y } = position;
    const cellId = options.cellId || config.id || 'button';

    try {
      // Resolve complete button styling with enhanced border support
      const buttonStyle = this.resolveButtonStyle(config, style, width, height);

      // ✅ NEW: Track button features
      if (buttonStyle.gradient) this._trackFeature('gradient');
      if (buttonStyle.pattern) this._trackFeature('pattern');
      if (buttonStyle.glow) this._trackFeature('glow');
      if (buttonStyle.shadow) this._trackFeature('shadow');
      if (buttonStyle.bracket_style) this._trackFeature('brackets');
      if (buttonStyle.lcars_button_preset) this._trackFeature(`preset_${buttonStyle.lcars_button_preset}`);
      if (buttonStyle.lcars_text_preset) this._trackFeature(`text_preset_${buttonStyle.lcars_text_preset}`);
      if (buttonStyle.border.hasIndividualSides) this._trackFeature('individual_borders');
      if (buttonStyle.border.hasIndividualRadius) this._trackFeature('individual_radius');

      // ARCHITECTURAL CHANGE: Convert legacy label/content to texts array
      const textsArray = this._normalizeTextsConfiguration(config, buttonStyle);

      // ✅ NEW: Track text configuration
      if (textsArray.length > 0) {
        this._trackFeature('has_texts');
        textsArray.forEach(text => {
          if (text.textType) this._trackFeature(`text_${text.textType}`);
        });
      }

      // Process actions if available
      const actionInfo = this._processButtonActions(config, buttonStyle, options.cardInstance);

      // ✅ NEW: Track actions
      if (actionInfo) this._trackFeature('actions');

      // Check if button has actions
      const hasActions = !!(config.tap_action || config.hold_action || config.double_tap_action || buttonStyle.actions);

      // Always enable pointer events to support:
      // 1. Explicit actions (tap, hold, double_tap)
      // 2. Animation triggers (on_hover, on_tap, etc.) - animations are registered separately in AnimationManager
      // Using 'visiblePainted' allows events to pass through to filled areas
      const pointerEvents = 'visiblePainted';
      const cursor = hasActions ? 'pointer' : 'default';

      // Start building the button SVG
      let buttonMarkup = `<g data-button-id="${cellId}"`;

      if (options.gridContext) {
        buttonMarkup += ` data-cell-id="${cellId}"
                         data-cell-row="${config.row || 0}"
                         data-cell-col="${config.col || 0}"
                         data-has-cell-actions="${hasActions}"`;
      }

      // CRITICAL: Use same pattern as working button overlay
      buttonMarkup += ` style="pointer-events: ${pointerEvents}; cursor: ${cursor};">`;

      // Render button background with enhanced border support
      buttonMarkup += this.renderButtonBackground(x, y, width, height, buttonStyle, config);

      // NEW: Render button text using texts array and core/TextRenderer
      buttonMarkup += this.renderButtonTexts(textsArray, x, y, width, height, buttonStyle, config);

      buttonMarkup += '</g>';

      return {
        markup: buttonMarkup,
        actions: actionInfo,
        needsActionAttachment: !!actionInfo
      };

    } catch (error) {
      cblcarsLog.error(`[ButtonRenderer] ❌ Rendering failed for button ${cellId}:`, error);
      return {
        markup: this._renderFallbackButton(config, x, y, width, height),
        actions: null,
        needsActionAttachment: false
      };
    }
  }

  /**
   * ARCHITECTURAL CHANGE: Normalize button configuration to texts array
   * Handles backward compatibility: legacy label/content → new texts array
   * @private
   */
  _normalizeTextsConfiguration(config, buttonStyle) {
    // NEW FORMAT: Check if texts array is provided
    if (config.texts && Array.isArray(config.texts)) {
      return config.texts.map(textConfig => ({
        content: textConfig.content || textConfig.text || '',
        position: textConfig.position || 'center',
        fontSize: textConfig.font_size || textConfig.fontSize || buttonStyle.font_size,
        fontFamily: textConfig.font_family || textConfig.fontFamily || buttonStyle.font_family,
        fontWeight: textConfig.font_weight || textConfig.fontWeight || buttonStyle.font_weight,
        color: textConfig.color || textConfig.fill || buttonStyle.label_color,
        textAnchor: textConfig.text_anchor || textConfig.textAnchor || null,
        dominantBaseline: textConfig.dominant_baseline || textConfig.dominantBaseline || null,
        opacity: textConfig.opacity || 1,
        textType: textConfig.text_type || 'custom', // NEW: Track text type
        _originalContent: textConfig.content || textConfig.text
      }));
    }

    // LEGACY FORMAT: Convert label/content to texts array for backward compatibility
    const legacyTexts = [];

    if (buttonStyle.show_labels && config.label) {
      legacyTexts.push({
        content: config.label,
        position: buttonStyle.label_position || 'center-top', // FIXED: Correct fallback
        fontSize: buttonStyle.label_font_size,
        fontFamily: buttonStyle.font_family,
        fontWeight: buttonStyle.font_weight,
        color: buttonStyle.label_color,
        textAnchor: null,
        dominantBaseline: null,
        opacity: 1,
        textType: 'label', // NEW: Mark as label
        _originalContent: config.label
      });
    }

    if (buttonStyle.show_values && config.content) {
      legacyTexts.push({
        content: config.content,
        position: buttonStyle.value_position || 'center-bottom', // FIXED: Correct fallback
        fontSize: buttonStyle.value_font_size,
        fontFamily: buttonStyle.font_family,
        fontWeight: buttonStyle.font_weight,
        color: buttonStyle.value_color,
        textAnchor: null,
        dominantBaseline: null,
        opacity: 1,
        textType: 'value', // NEW: Mark as value
        _originalContent: config.content
      });
    }

    return legacyTexts;
  }

  /**
   * NEW METHOD: Render button texts using array configuration and core/TextRenderer
   * @param {Array} textsArray - Array of text configurations
   * @param {number} x - Button X coordinate
   * @param {number} y - Button Y coordinate
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @param {Object} buttonStyle - Resolved button styling
   * @param {Object} config - Button configuration
   * @returns {string} SVG markup for all button texts
   */
  renderButtonTexts(textsArray, x, y, width, height, buttonStyle, config) {
    if (!textsArray || textsArray.length === 0) return '';

    const textMarkups = [];

    textsArray.forEach((textConfig, index) => {
      try {
        // Calculate absolute position within button bounds
        const textPosition = this._calculateTextPositionInButton(
          textConfig.position,
          x, y, width, height,
          buttonStyle,
          textConfig.textType // FIXED: Pass text type for LCARS presets
        );

        // CRITICAL FIX: Infer alignment ONLY if not explicitly provided
        const inferredTextAnchor = this._inferTextAnchor(textConfig.position);
        const inferredDominantBaseline = this._inferDominantBaseline(textConfig.position);

        // Use explicit values if provided, otherwise use inferred values
        const finalTextAnchor = textConfig.textAnchor || inferredTextAnchor;
        const finalDominantBaseline = textConfig.dominantBaseline || inferredDominantBaseline;

        // REMOVED DUPLICATE: Single consolidated debug log
        cblcarsLog.trace(`[ButtonRenderer] ✅ Text for ${config.id}:`, {
          position: textConfig.position,
          textType: textConfig.textType,
          calculatedPosition: textPosition,
          textAnchor: finalTextAnchor,
          dominantBaseline: finalDominantBaseline
        });

        // Prepare text style for rendering
        const textStyle = {
          color: textConfig.color,
          fontSize: textConfig.fontSize,
          fontFamily: textConfig.fontFamily,
          fontWeight: textConfig.fontWeight,
          textAnchor: finalTextAnchor,
          dominantBaseline: finalDominantBaseline,
          opacity: textConfig.opacity,
          stroke: textConfig.stroke || null,
          strokeWidth: textConfig.strokeWidth || 0,
          letterSpacing: textConfig.letterSpacing || 'normal'
        };

        // CRITICAL FIX: Render directly with exact coordinates
        const [textX, textY] = textPosition;

        const textMarkup = `<text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}"
                                  fill="${textStyle.color}"
                                  fill-opacity="${textStyle.opacity}"
                                  font-size="${textStyle.fontSize}"
                                  font-family="${textStyle.fontFamily}"
                                  ${textStyle.fontWeight !== 'normal' ? `font-weight="${textStyle.fontWeight}"` : ''}
                                  text-anchor="${textStyle.textAnchor}"
                                  dominant-baseline="${textStyle.dominantBaseline}"
                                  style="pointer-events: inherit; cursor: inherit; user-select: none;"
                                  data-button-text="${config.id}-${index}">${this._escapeXml(textConfig.content)}</text>`;

        // Wrap in group with data attributes for updates
        const wrappedMarkup = `<g data-button-text-index="${index}"
                                  data-button-text-position="${textConfig.position}"
                                  data-button-text-type="${textConfig.textType}"
                                  data-button-id="${config.id}">
                                 ${textMarkup}
                               </g>`;
        textMarkups.push(wrappedMarkup);

      } catch (error) {
        cblcarsLog.warn(`[ButtonRenderer] Error rendering text ${index} for button ${config.id}:`, error);
      }
    });

    return textMarkups.join('\n');
  }

  /**
   * Calculate text position within button bounds
   * Supports both legacy position strings (center-top) and smart positioning
   * @private
   */
  _calculateTextPositionInButton(position, buttonX, buttonY, buttonWidth, buttonHeight, buttonStyle, textType = 'label') {
    const padding = buttonStyle.text_padding || 8;

    // Parse position string or use smart positioning
    const positionMap = {
      'center': [buttonX + buttonWidth / 2, buttonY + buttonHeight / 2],
      'center-top': [buttonX + buttonWidth / 2, buttonY + padding],
      'center-bottom': [buttonX + buttonWidth / 2, buttonY + buttonHeight - padding],
      'top-left': [buttonX + padding, buttonY + padding],
      'top-right': [buttonX + buttonWidth - padding, buttonY + padding],
      'bottom-left': [buttonX + padding, buttonY + buttonHeight - padding],
      'bottom-right': [buttonX + buttonWidth - padding, buttonY + buttonHeight - padding],
      'left': [buttonX + padding, buttonY + buttonHeight / 2],
      'right': [buttonX + buttonWidth - padding, buttonY + buttonHeight / 2],
      'top': [buttonX + buttonWidth / 2, buttonY + padding],
      'bottom': [buttonX + buttonWidth / 2, buttonY + buttonHeight - padding]
    };

    // Check if position is a predefined string (explicit configuration)
    if (typeof position === 'string' && positionMap[position]) {
      return positionMap[position];
    }

    // ONLY use LCARS presets if position is NOT explicitly configured
    if (buttonStyle.lcars_text_preset) {
      return this._calculateLCARSPresetPositionInButton(
        buttonStyle.lcars_text_preset,
        buttonX, buttonY, buttonWidth, buttonHeight,
        buttonStyle,
        textType // FIXED: Pass text type
      );
    }

    // Handle numeric array: [x, y] relative to button bounds (0-100%)
    if (Array.isArray(position) && position.length === 2) {
      const [relX, relY] = position;
      return [
        buttonX + (buttonWidth * relX / 100),
        buttonY + (buttonHeight * relY / 100)
      ];
    }

    // Handle object format: {x: value, y: value}
    if (typeof position === 'object' && position.x !== undefined && position.y !== undefined) {
      return [
        buttonX + this._parsePositionValue(position.x, buttonWidth, 0),
        buttonY + this._parsePositionValue(position.y, buttonHeight, 0)
      ];
    }

    // Default to center
    return [buttonX + buttonWidth / 2, buttonY + buttonHeight / 2];
  }

  /**
   * Calculate LCARS preset positions within button bounds
   * @private
   */
  _calculateLCARSPresetPositionInButton(preset, buttonX, buttonY, buttonWidth, buttonHeight, buttonStyle, textType = 'label') {
    const padding = buttonStyle.text_padding || 8;
    const fontSize = buttonStyle.font_size || 18;

    switch (preset) {
      case 'lozenge':
        // Different positions for label vs value
        if (textType === 'label') {
          return [buttonX + padding, buttonY + padding + fontSize * 0.8];
        } else {
          // Value in bottom-right corner
          return [buttonX + buttonWidth - padding, buttonY + buttonHeight - padding];
        }

      case 'bullet':
        // Different positions for label vs value
        if (textType === 'label') {
          return [buttonX + padding, buttonY + buttonHeight / 2];
        } else {
          // Value on right side
          return [buttonX + buttonWidth - padding, buttonY + buttonHeight / 2];
        }

      default:
        return [buttonX + buttonWidth / 2, buttonY + buttonHeight / 2];
    }
  }

  /**
   * Infer text-anchor from position string
   * @private
   */
  _inferTextAnchor(position) {
    if (typeof position !== 'string') return 'middle';

    const lowerPos = position.toLowerCase();

    // CRITICAL FIX: Check exact position strings and endings more carefully
    if (lowerPos === 'left') return 'start';
    if (lowerPos === 'right') return 'end';

    // For compound positions, check what side they're on
    if (lowerPos.endsWith('-left') || lowerPos.startsWith('left-')) return 'start';
    if (lowerPos.endsWith('-right') || lowerPos.startsWith('right-')) return 'end';

    return 'middle';
  }

  /**
   * Infer dominant-baseline from position string
   * @private
   */
  _inferDominantBaseline(position) {
    if (typeof position !== 'string') return 'middle';

    const lowerPos = position.toLowerCase();

    // CRITICAL FIX: For compound positions
    if (lowerPos === 'top') return 'hanging';
    if (lowerPos === 'bottom') return 'baseline';

    if (lowerPos.startsWith('top-') || lowerPos.endsWith('-top')) return 'hanging';
    if (lowerPos.startsWith('bottom-') || lowerPos.endsWith('-bottom')) return 'baseline';

    return 'middle';
  }

  /**
   * Resolve comprehensive button styling with enhanced border support
   * @param {Object} config - Button configuration
   * @param {Object} style - Base button styling
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @returns {Object} Complete button styling
   */
  resolveButtonStyle(config, style, width, height) {
    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    const buttonStyle = {
      // Basic appearance
      color: standardStyles.colors.primaryColor || style.color || this._getDefault('button.color', 'var(--lcars-blue)'),
      opacity: standardStyles.layout.opacity || style.opacity || this._getDefault('button.opacity', 1.0),

      // Enhanced border system with individual control
      border: this._resolveBorderStyle(style, standardStyles),

      // Text styling
      label_color: standardStyles.text.labelColor || style.label_color || this._getDefault('button.label_color', 'var(--lcars-white)'),
      value_color: standardStyles.text.valueColor || style.value_color || this._getDefault('button.value_color', 'var(--lcars-white)'),
      font_size: Number(style.font_size) || Math.max(standardStyles.text.fontSize || 12, this._getDefault('button.font_size', 18)),
      font_family: standardStyles.text.fontFamily || style.font_family || this._getDefault('button.font_family', 'var(--lcars-font-family, Antonio)'),
      font_weight: standardStyles.text.fontWeight || style.font_weight || this._getDefault('button.font_weight', 'normal'),

      // Enhanced text sizing
      label_font_size: Number(style.label_font_size) || Number(style.font_size) || this._getDefault('button.label_font_size', 18),
      value_font_size: Number(style.value_font_size) || (Number(style.font_size) ? Number(style.font_size) * 0.9 : this._getDefault('button.value_font_size', 16)),

      // Text positioning
      label_position: style.label_position || 'center-top',
      value_position: style.value_position || 'center-bottom',
      text_padding: Number(style.text_padding || this._getDefault('button.text_padding', 8)),

      // Control visibility
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false,

      // CB-LCARS presets
      lcars_button_preset: style.lcars_button_preset || null,
      lcars_text_preset: style.lcars_text_preset || null,

      // Effects
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features
      bracket_style: style.bracket_style || false,
      bracket_color: style.bracket_color || standardStyles.colors.primaryColor,

      // Interaction
      hover_enabled: standardStyles.interaction.hoverEnabled,
      hover_color: standardStyles.colors.hoverColor,

      // Actions
      actions: style.actions || null,

      // Store standard styles for reference
      standardStyles
    };

    // Apply CB-LCARS Button Preset if specified
    if (buttonStyle.lcars_button_preset) {
      this._applyButtonPreset(buttonStyle, buttonStyle.lcars_button_preset, style);
    }

    return buttonStyle;
  }

  /**
   * Resolve enhanced border styling with individual control
   * ✅ UPDATED: Now handles nested border format from standardStyles
   * @private
   * @param {Object} style - Style configuration
   * @param {Object} standardStyles - Parsed standard styles
   * @returns {Object} Enhanced border configuration
   */
  _resolveBorderStyle(style, standardStyles) {
    // ✅ NEW: Use standardStyles.border if available (normalized nested format)
    const borderConfig = style.border || {};

    // Global defaults - check both nested and flat formats for backward compatibility
    const globalWidth = standardStyles.border?.width || borderConfig.width || standardStyles.layout?.borderWidth || style.border_width || this._getDefault('button.border_width', 1);
    const globalColor = standardStyles.border?.color || borderConfig.color || standardStyles.colors?.borderColor || style.border_color || this._getDefault('button.border_color', 'var(--lcars-gray)');
    const globalRadius = standardStyles.border?.radius || borderConfig.radius || standardStyles.layout?.borderRadius || style.border_radius || this._getDefault('button.border_radius', 8);

    // ✅ UPDATED: Check for individual border properties in both nested and flat formats
    const hasIndividualSides = !!(
      borderConfig.top !== undefined ||
      borderConfig.right !== undefined ||
      borderConfig.bottom !== undefined ||
      borderConfig.left !== undefined ||
      style.border_top !== undefined ||
      style.border_right !== undefined ||
      style.border_bottom !== undefined ||
      style.border_left !== undefined
    );

    const hasIndividualRadius = !!(
      borderConfig.radiusTopLeft !== undefined ||
      borderConfig.radiusTopRight !== undefined ||
      borderConfig.radiusBottomRight !== undefined ||
      borderConfig.radiusBottomLeft !== undefined ||
      borderConfig.radius_top_left !== undefined ||
      borderConfig.radius_top_right !== undefined ||
      borderConfig.radius_bottom_right !== undefined ||
      borderConfig.radius_bottom_left !== undefined ||
      style.border_radius_top_left !== undefined ||
      style.border_radius_top_right !== undefined ||
      style.border_radius_bottom_right !== undefined ||
      style.border_radius_bottom_left !== undefined
    );

    // FIXED: Safe resolution of individual border sides with proper fallbacks
    const resolveBorderSide = (sideValue, fallbackWidth = globalWidth, fallbackColor = globalColor) => {
      if (sideValue === undefined || sideValue === null) {
        // No individual side specified - use global defaults
        return {
          width: Number(fallbackWidth) || 1,
          color: fallbackColor || 'var(--lcars-gray)',
          style: 'solid'
        };
      }

      if (typeof sideValue === 'object') {
        // Object format: { width: 2, color: 'red', style: 'dashed' }
        return {
          width: Number(sideValue.width !== undefined ? sideValue.width : fallbackWidth) || 1,
          color: sideValue.color !== undefined ? sideValue.color : fallbackColor,
          style: sideValue.style !== undefined ? sideValue.style : 'solid'
        };
      }

      if (typeof sideValue === 'number') {
        // Number format: just width, use global color
        return {
          width: Number(sideValue) || 1,
          color: fallbackColor,
          style: 'solid'
        };
      }

      // String or other - treat as width
      const numericWidth = parseFloat(sideValue);
      return {
        width: !isNaN(numericWidth) ? numericWidth : (Number(fallbackWidth) || 1),
        color: fallbackColor,
        style: 'solid'
      };
    };

    return {
      // Global fallbacks - ensure they're numbers
      width: Number(globalWidth) || 1,
      color: globalColor || 'var(--lcars-gray)',
      radius: Number(globalRadius) || 0,

      // ✅ UPDATED: Individual side control - check nested format first, then flat format
      top: resolveBorderSide(borderConfig.top || style.border_top),
      right: resolveBorderSide(borderConfig.right || style.border_right),
      bottom: resolveBorderSide(borderConfig.bottom || style.border_bottom),
      left: resolveBorderSide(borderConfig.left || style.border_left),

      // ✅ UPDATED: Individual corner radius - check nested format first (camelCase and snake_case), then flat format
      topLeft: Number(
        borderConfig.radiusTopLeft !== undefined ? borderConfig.radiusTopLeft :
        borderConfig.radius_top_left !== undefined ? borderConfig.radius_top_left :
        style.border_radius_top_left !== undefined ? style.border_radius_top_left :
        globalRadius
      ) || 0,
      topRight: Number(
        borderConfig.radiusTopRight !== undefined ? borderConfig.radiusTopRight :
        borderConfig.radius_top_right !== undefined ? borderConfig.radius_top_right :
        style.border_radius_top_right !== undefined ? style.border_radius_top_right :
        globalRadius
      ) || 0,
      bottomRight: Number(
        borderConfig.radiusBottomRight !== undefined ? borderConfig.radiusBottomRight :
        borderConfig.radius_bottom_right !== undefined ? borderConfig.radius_bottom_right :
        style.border_radius_bottom_right !== undefined ? style.border_radius_bottom_right :
        globalRadius
      ) || 0,
      bottomLeft: Number(
        borderConfig.radiusBottomLeft !== undefined ? borderConfig.radiusBottomLeft :
        borderConfig.radius_bottom_left !== undefined ? borderConfig.radius_bottom_left :
        style.border_radius_bottom_left !== undefined ? style.border_radius_bottom_left :
        globalRadius
      ) || 0,

      // Convenience flags
      hasIndividualSides,
      hasIndividualRadius
    };
  }

  /**
   * Apply CB-LCARS button preset using StylePresetManager
   * @private
   * @param {Object} buttonStyle - Button style object to modify
   * @param {string} presetName - Name of the button preset
   * @param {Object} originalStyle - Original user style for checking explicit values
   */
  _applyButtonPreset(buttonStyle, presetName, originalStyle = {}) {
    cblcarsLog.debug(`[ButtonRenderer] 🎨 Applying CB-LCARS button preset: ${presetName}`);

    // Load preset from StylePresetManager
    const presetStyles = this._loadPresetFromStylePresetManager('button', presetName);

    if (!presetStyles) {
      // Try status_grid presets for backward compatibility
      const gridPresetStyles = this._loadPresetFromStylePresetManager('status_grid', presetName);
      if (gridPresetStyles) {
        this._applyPresetStyles(buttonStyle, gridPresetStyles, originalStyle);
        return;
      }

      cblcarsLog.warn(`[ButtonRenderer] ⚠️ Button preset '${presetName}' not found in StylePresetManager`);
      return;
    }

    // Apply preset properties with user override protection
    this._applyPresetStyles(buttonStyle, presetStyles, originalStyle);

    cblcarsLog.debug(`[ButtonRenderer] ✅ Applied preset ${presetName} with ${Object.keys(presetStyles).length} properties`);
  }

  /**
   * Apply preset styles with user override protection
   * @private
   */
  _applyPresetStyles(buttonStyle, presetStyles, originalStyle = {}) {
    Object.entries(presetStyles).forEach(([property, value]) => {
      // Only set value if user didn't explicitly provide it
      if (originalStyle[property] === undefined) {
        buttonStyle[property] = value;
        cblcarsLog.trace(`[ButtonRenderer] 📝 Preset set ${property}: ${value}`);
      } else {
        cblcarsLog.trace(`[ButtonRenderer] 🚫 User explicit value for ${property}, skipping preset`);
      }
    });
  }

  /**
   * Load preset from StylePresetManager
   * @private
   * @param {string} overlayType - Type of overlay (e.g., 'button', 'status_grid')
   * @param {string} presetName - Name of the preset
   * @returns {Object|null} Preset configuration or null if not found
   */
  _loadPresetFromStylePresetManager(overlayType, presetName) {
    if (this.stylePresetManager) {
      const preset = this.stylePresetManager.getPreset(overlayType, presetName);
      if (preset) {
        cblcarsLog.trace(`[ButtonRenderer] ✅ Found preset via StylePresetManager`);
        return preset;
      }
    }
    return null;
  }

  /**
   * Render button background with enhanced border support
   * @param {number} x - Button X coordinate
   * @param {number} y - Button Y coordinate
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @param {Object} buttonStyle - Resolved button styling
   * @param {Object} config - Button configuration
   * @returns {string} SVG markup for button background
   */
  renderButtonBackground(x, y, width, height, buttonStyle, config) {
    let backgroundMarkup = '';
    const buttonId = config.id || 'button';

    // Add gradient definition if needed
    if (buttonStyle.gradient) {
      backgroundMarkup += RendererUtils.renderGradientDef(buttonStyle.gradient, `gradient-${buttonId}`);
    }

    // Add pattern definition if needed
    if (buttonStyle.pattern) {
      backgroundMarkup += RendererUtils.renderPatternDef(buttonStyle.pattern, `pattern-${buttonId}`);
    }

    // Determine fill
    let fill = buttonStyle.color;
    if (buttonStyle.gradient) {
      fill = `url(#gradient-${buttonId})`;
    } else if (buttonStyle.pattern) {
      fill = `url(#pattern-${buttonId})`;
    }

    // Check if we need complex border rendering
    const needsComplexBorder = buttonStyle.border.hasIndividualSides || buttonStyle.border.hasIndividualRadius;

    if (needsComplexBorder) {
      // Use SVG path for complex borders
      backgroundMarkup += this._renderComplexButtonBackground(x, y, width, height, buttonStyle, fill, buttonId);
    } else {
      // Use simple rect for uniform borders
      backgroundMarkup += this._renderSimpleButtonBackground(x, y, width, height, buttonStyle, fill, buttonId);
    }

    // Add brackets if enabled
    if (buttonStyle.bracket_style) {
      const bracketConfig = {
        enabled: true,
        style: buttonStyle.bracket_style,
        color: buttonStyle.bracket_color,
        width: buttonStyle.bracket_width || 2,
        gap: buttonStyle.bracket_gap || 4,
        extension: buttonStyle.bracket_extension || 8,
        opacity: buttonStyle.bracket_opacity || 1
      };

      backgroundMarkup += BracketRenderer.render(width, height, bracketConfig, buttonId, x, y);
    }

    return backgroundMarkup;
  }

  /**
   * Render simple button background using rect element
   * @private
   */
  _renderSimpleButtonBackground(x, y, width, height, buttonStyle, fill, buttonId) {
    // CRITICAL: For buttons with actions, use 'all' on the background rect to ensure
    // the entire cell area is clickable, not just the painted pixels
    const hasActions = buttonStyle.actions || buttonStyle.standardStyles?.interaction?.hasActions;
    const rectPointerEvents = hasActions ? 'all' : 'inherit';

    let markup = `<rect x="${x}" y="${y}"
                   width="${width}" height="${height}"
                   fill="${fill}"
                   stroke="${buttonStyle.border.color}"
                   stroke-width="${buttonStyle.border.width}"
                   rx="${buttonStyle.border.radius}"
                   opacity="${buttonStyle.opacity}"
                   style="pointer-events: ${rectPointerEvents};"`;

    // Add filter effects
    const filters = this._buildFilterEffects(buttonStyle, buttonId);
    if (filters.length > 0) {
      markup += ` filter="${filters.join(' ')}"`;
    }

    markup += ` />`;

    return markup;
  }

  /**
   * Render complex button background using SVG path for individual borders
   * @private
   */
  _renderComplexButtonBackground(x, y, width, height, buttonStyle, fill, buttonId) {
    const border = buttonStyle.border;

    // CRITICAL: For buttons with actions, use 'all' on the background path
    const hasActions = buttonStyle.actions || buttonStyle.standardStyles?.interaction?.hasActions;
    const pathPointerEvents = hasActions ? 'all' : 'inherit';

    // Generate complex SVG path for individual borders/radii
    const path = this._generateComplexBorderPath(width, height, border);

    let markup = `<path d="${path}"
                   transform="translate(${x}, ${y})"
                   fill="${fill}"
                   opacity="${buttonStyle.opacity}"
                   style="pointer-events: ${pathPointerEvents};"`;

    // Add individual border strokes if needed
    if (border.hasIndividualSides) {
      // Render separate paths for each border side with individual colors/widths
      markup += ` stroke="none"`;
      markup += ` />`;

      // Add individual border paths
      markup += this._renderIndividualBorderPaths(width, height, border, x, y, buttonId);
    } else {
      markup += ` stroke="${border.color}" stroke-width="${border.width}"`;

      // Add filter effects
      const filters = this._buildFilterEffects(buttonStyle, buttonId);
      if (filters.length > 0) {
        markup += ` filter="${filters.join(' ')}"`;
      }

      markup += ` />`;
    }

    return markup;
  }

  /**
   * Generate complex SVG path for individual borders and radii
   * @private
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @param {Object} border - Border configuration with individual settings
   * @returns {string} SVG path string
   */
  _generateComplexBorderPath(width, height, border) {
    // FIXED: Ensure all radius values are valid numbers
    const topLeft = Number(border.topLeft) || 0;
    const topRight = Number(border.topRight) || 0;
    const bottomRight = Number(border.bottomRight) || 0;
    const bottomLeft = Number(border.bottomLeft) || 0;

    // FIXED: Ensure width and height are valid numbers
    const w = Number(width) || 100;
    const h = Number(height) || 40;

    // Start from top-left corner, accounting for radius
    let path = `M ${topLeft} 0`;

    // Top edge to top-right corner
    path += ` L ${w - topRight} 0`;

    // Top-right corner curve
    if (topRight > 0) {
      path += ` Q ${w} 0 ${w} ${topRight}`;
    } else {
      path += ` L ${w} 0`;
    }

    // Right edge to bottom-right corner
    path += ` L ${w} ${h - bottomRight}`;

    // Bottom-right corner curve
    if (bottomRight > 0) {
      path += ` Q ${w} ${h} ${w - bottomRight} ${h}`;
    } else {
      path += ` L ${w} ${h}`;
    }

    // Bottom edge to bottom-left corner
    path += ` L ${bottomLeft} ${h}`;

    // Bottom-left corner curve
    if (bottomLeft > 0) {
      path += ` Q 0 ${h} 0 ${h - bottomLeft}`;
    } else {
      path += ` L 0 ${h}`;
    }

    // Left edge to top-left corner
    path += ` L 0 ${topLeft}`;

    // Top-left corner curve
    if (topLeft > 0) {
      path += ` Q 0 0 ${topLeft} 0`;
    } else {
      path += ` L 0 0`;
    }

    path += ` Z`;

    return path;
  }

  /**
   * Render individual border paths for complex borders
   * @private
   */
  _renderIndividualBorderPaths(width, height, border, x, y, buttonId) {
    let borderMarkup = '';

    // FIXED: Safe access to border properties with fallbacks and ensure numeric values
    const safeGetBorderWidth = (side, fallback = 1) => {
      const sideWidth = (side && typeof side === 'object' && side.width !== undefined) ? side.width : (side || fallback);
      return Number(sideWidth) || fallback;
    };

    const safeGetBorderColor = (side, fallback = 'var(--lcars-gray)') => {
      return (side && typeof side === 'object' && side.color !== undefined) ? side.color : (border.color || fallback);
    };

    // FIXED: Ensure radius values are numbers
    const topLeft = Number(border.topLeft) || 0;
    const topRight = Number(border.topRight) || 0;
    const bottomRight = Number(border.bottomRight) || 0;
    const bottomLeft = Number(border.bottomLeft) || 0;

    // FIXED: Ensure width and height are numbers
    const w = Number(width) || 100;
    const h = Number(height) || 40;

    // FIXED: Determine line cap style based on corner radius
    // Use square caps when radius is 0, round caps when radius > 0
    const hasAnyRadius = topLeft > 0 || topRight > 0 || bottomRight > 0 || bottomLeft > 0;
    const lineCap = hasAnyRadius ? 'round' : 'square';

    // Top border - safe access
    const topWidth = safeGetBorderWidth(border.top, border.width);
    if (topWidth > 0) {
      const topColor = safeGetBorderColor(border.top, border.color);
      borderMarkup += `<path d="M ${topLeft} 0 L ${w - topRight} 0"
                        transform="translate(${x}, ${y})"
                        stroke="${topColor}"
                        stroke-width="${topWidth}"
                        stroke-linecap="${lineCap}"
                        fill="none" />`;
    }

    // Right border - safe access
    const rightWidth = safeGetBorderWidth(border.right, border.width);
    if (rightWidth > 0) {
      const rightColor = safeGetBorderColor(border.right, border.color);
      borderMarkup += `<path d="M ${w} ${topRight} L ${w} ${h - bottomRight}"
                        transform="translate(${x}, ${y})"
                        stroke="${rightColor}"
                        stroke-width="${rightWidth}"
                        stroke-linecap="${lineCap}"
                        fill="none" />`;
    }

    // Bottom border - safe access
    const bottomWidth = safeGetBorderWidth(border.bottom, border.width);
    if (bottomWidth > 0) {
      const bottomColor = safeGetBorderColor(border.bottom, border.color);
      borderMarkup += `<path d="M ${w - bottomRight} ${h} L ${bottomLeft} ${h}"
                        transform="translate(${x}, ${y})"
                        stroke="${bottomColor}"
                        stroke-width="${bottomWidth}"
                        stroke-linecap="${lineCap}"
                        fill="none" />`;
    }

    // Left border - safe access
    const leftWidth = safeGetBorderWidth(border.left, border.width);
    if (leftWidth > 0) {
      const leftColor = safeGetBorderColor(border.left, border.color);
      borderMarkup += `<path d="M 0 ${h - bottomLeft} L 0 ${topLeft}"
                        transform="translate(${x}, ${y})"
                        stroke="${leftColor}"
                        stroke-width="${leftWidth}"
                        stroke-linecap="${lineCap}"
                        fill="none" />`;
    }

    // Corner arcs if we have individual radii
    if (border.hasIndividualRadius && hasAnyRadius) {
      borderMarkup += this._renderCornerArcs(width, height, border, x, y);
    }

    return borderMarkup;
  }

  /**
   * Render corner arc paths for individual corner radii
   * @private
   */
  _renderCornerArcs(width, height, border, x, y) {
    let arcMarkup = '';

    // FIXED: Safe access to border properties for corner colors and ensure numeric values
    const safeGetBorderColor = (side, fallback = border.color || 'var(--lcars-gray)') => {
      return (side && typeof side === 'object' && side.color !== undefined) ? side.color : fallback;
    };

    const safeGetBorderWidth = (side, fallback = border.width || 1) => {
      const sideWidth = (side && typeof side === 'object' && side.width !== undefined) ? side.width : (typeof side === 'number' ? side : fallback);
      return Number(sideWidth) || fallback;
    };

    // FIXED: Ensure all radius and dimension values are numbers
    const topLeft = Number(border.topLeft) || 0;
    const topRight = Number(border.topRight) || 0;
    const bottomRight = Number(border.bottomRight) || 0;
    const bottomLeft = Number(border.bottomLeft) || 0;
    const w = Number(width) || 100;
    const h = Number(height) || 40;

    // FIXED: Use square line caps for corner arcs too - they should match the straight borders
    const lineCap = 'square';

    // Top-left corner
    if (topLeft > 0) {
      const topColor = safeGetBorderColor(border.top);
      const leftColor = safeGetBorderColor(border.left);
      const cornerColor = topColor; // Use top color as primary

      const topWidth = safeGetBorderWidth(border.top);
      const leftWidth = safeGetBorderWidth(border.left);
      const cornerWidth = Math.max(topWidth, leftWidth);

      arcMarkup += `<path d="M 0 ${topLeft} Q 0 0 ${topLeft} 0"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${cornerWidth}"
                     stroke-linecap="${lineCap}"
                     fill="none" />`;
    }

    // Top-right corner
    if (topRight > 0) {
      const topColor = safeGetBorderColor(border.top);
      const rightColor = safeGetBorderColor(border.right);
      const cornerColor = topColor;

      const topWidth = safeGetBorderWidth(border.top);
      const rightWidth = safeGetBorderWidth(border.right);
      const cornerWidth = Math.max(topWidth, rightWidth);

      arcMarkup += `<path d="M ${w - topRight} 0 Q ${w} 0 ${w} ${topRight}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${cornerWidth}"
                     stroke-linecap="${lineCap}"
                     fill="none" />`;
    }

    // Bottom-right corner
    if (bottomRight > 0) {
      const rightColor = safeGetBorderColor(border.right);
      const bottomColor = safeGetBorderColor(border.bottom);
      const cornerColor = rightColor;

      const rightWidth = safeGetBorderWidth(border.right);
      const bottomWidth = safeGetBorderWidth(border.bottom);
      const cornerWidth = Math.max(rightWidth, bottomWidth);

      arcMarkup += `<path d="M ${w} ${h - bottomRight} Q ${w} ${h} ${w - bottomRight} ${h}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${cornerWidth}"
                     stroke-linecap="${lineCap}"
                     fill="none" />`;
    }

    // Bottom-left corner
    if (bottomLeft > 0) {
      const bottomColor = safeGetBorderColor(border.bottom);
      const leftColor = safeGetBorderColor(border.left);
      const cornerColor = bottomColor;

      const bottomWidth = safeGetBorderWidth(border.bottom);
      const leftWidth = safeGetBorderWidth(border.left);
      const cornerWidth = Math.max(bottomWidth, leftWidth);

      arcMarkup += `<path d="M ${bottomLeft} ${h} Q 0 ${h} 0 ${h - bottomLeft}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${cornerWidth}"
                     stroke-linecap="${lineCap}"
                     fill="none" />`;
    }

    return arcMarkup;
  }

  /**
   * Build filter effects for button
   * @private
   */
  _buildFilterEffects(buttonStyle, buttonId) {
    const filters = [];

    if (buttonStyle.glow) {
      const glowId = `glow-${buttonId}`;
      RendererUtils.renderGlowFilter(buttonStyle.glow, glowId);
      filters.push(`url(#${glowId})`);
    }
    if (buttonStyle.shadow) {
      const shadowId = `shadow-${buttonId}`;
      RendererUtils.renderShadowFilter(buttonStyle.shadow, shadowId);
      filters.push(`url(#${shadowId})`);
    }
    if (buttonStyle.blur) {
      const blurId = `blur-${buttonId}`;
      RendererUtils.renderBlurFilter(buttonStyle.blur, blurId);
      filters.push(`url(#${blurId})`);
    }

    return filters;
  }

  /**
   * Update button content dynamically
   * @param {Element} buttonElement - DOM element for the button
   * @param {Object} config - Button configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if updated
   */
  updateButton(buttonElement, config, sourceData) {
    try {
      // ✅ SIMPLIFIED APPROACH: Query DOM for all text elements and update them
      // Don't rely on show_labels/show_values - if DOM elements exist, update them

      let anyUpdated = false;
      const textGroups = buttonElement.querySelectorAll('[data-button-text-index], [data-button-text-type]');

      cblcarsLog.debug(`[ButtonRenderer] � Found ${textGroups.length} text group(s) in button ${config.id}`, {
        hasLabel: !!config.label,
        hasContent: !!config.content,
        hasTextsArray: !!(config.texts && config.texts.length)
      });

      textGroups.forEach((textGroup) => {
        try {
          const textElement = textGroup.querySelector('text');
          if (!textElement) return;

          // Determine what content this text element should display
          const textIndex = textGroup.getAttribute('data-button-text-index');
          const textType = textGroup.getAttribute('data-button-text-type');

          let rawContent = '';

          // Priority: texts array > textType (label/content)
          if (textIndex !== null && config.texts && config.texts[textIndex]) {
            rawContent = config.texts[textIndex].content || config.texts[textIndex]._originalContent || '';
          } else if (textType === 'label') {
            rawContent = config.label || '';
          } else if (textType === 'value') {
            rawContent = config.content || '';
          }

          if (!rawContent) {
            cblcarsLog.debug(`[ButtonRenderer] ⏭️ No content for text (index: ${textIndex}, type: ${textType})`);
            return;
          }

          // Resolve content with current datasource values
          const resolvedContent = this._resolveCellContent(rawContent, sourceData);

          if (resolvedContent !== undefined) {
            const oldContent = textElement.textContent?.trim();
            const newContent = String(resolvedContent);

            if (newContent !== oldContent) {
              // Preserve text alignment attributes
              const textAnchor = textElement.getAttribute('text-anchor');
              const dominantBaseline = textElement.getAttribute('dominant-baseline');

              textElement.textContent = this._escapeXml(newContent);

              if (textAnchor) textElement.setAttribute('text-anchor', textAnchor);
              if (dominantBaseline) textElement.setAttribute('dominant-baseline', dominantBaseline);

              cblcarsLog.debug(`[ButtonRenderer] ✅ Updated text (index: ${textIndex}, type: ${textType}) for ${config.id}: "${oldContent}" → "${newContent}"`);
              anyUpdated = true;
            }
          }
        } catch (error) {
          cblcarsLog.warn(`[ButtonRenderer] Error updating text element:`, error);
        }
      });

      return anyUpdated;
    } catch (error) {
      cblcarsLog.error(`[ButtonRenderer] Error updating button ${config.id}:`, error);
      return false;
    }
  }

  /**
   * Update button style dynamically (for rules engine patches)
   * @param {Element} buttonElement - DOM element for the button
   * @param {Object} newStyle - New resolved button style
   * @param {Object} size - Button dimensions {width, height}
   * @returns {boolean} True if style was updated
   * @static
   */
  static updateButtonStyle(buttonElement, newStyle, size = null) {
    const instance = new ButtonRenderer();
    return instance._updateButtonStyle(buttonElement, newStyle, size);
  }

  /**
   * Internal method to update button style
   * Updates visual styling without full re-render
   * @private
   */
  _updateButtonStyle(buttonElement, newStyle, size = null) {
    try {
      const buttonId = buttonElement.getAttribute('data-button-id');
      // Removed excessive per-button debug logging (was logging 670+ times for large grids)

      let styleUpdated = false;

      // Find the background element (rect or path)
      const rectElement = buttonElement.querySelector('rect');
      const pathElement = buttonElement.querySelector('path');
      const backgroundElement = rectElement || pathElement;

      // ============================================================================
      // GEOMETRY CHANGE DETECTION: Check if this update requires path regeneration
      // ============================================================================
      // For path-based buttons (individual borders/corners), we cannot incrementally
      // update geometry. Detect these cases and return false to trigger fallback.
      if (pathElement && newStyle.border) {
        const hasIndividualCornerRadii =
          newStyle.border.radius_top_left !== undefined ||
          newStyle.border.radius_top_right !== undefined ||
          newStyle.border.radius_bottom_left !== undefined ||
          newStyle.border.radius_bottom_right !== undefined;

        const hasIndividualBorderSides =
          newStyle.border.top !== undefined ||
          newStyle.border.right !== undefined ||
          newStyle.border.bottom !== undefined ||
          newStyle.border.left !== undefined;

        const hasUniformRadius = newStyle.border.radius !== undefined;

        // Path-based rendering means geometry changes need full re-render
        if (hasIndividualCornerRadii || hasIndividualBorderSides || hasUniformRadius) {
          cblcarsLog.debug(`[ButtonRenderer] ⚠️ Button has path-based geometry changes - triggering full re-render`, {
            hasIndividualCornerRadii,
            hasIndividualBorderSides,
            hasUniformRadius,
            borderKeys: Object.keys(newStyle.border)
          });
          return false;  // Trigger fallback to full re-render
        }
      }

      if (backgroundElement) {
        // Update fill color
        if (newStyle.color !== undefined) {
          let fill = newStyle.color;

          // Handle gradient/pattern (would need re-render for these, so just use solid color)
          if (newStyle.gradient) {
            cblcarsLog.debug(`[ButtonRenderer] Gradient change detected, using solid color fallback`);
            fill = newStyle.color || 'var(--lcars-blue)';
          }
          if (newStyle.pattern) {
            cblcarsLog.debug(`[ButtonRenderer] Pattern change detected, using solid color fallback`);
            fill = newStyle.color || 'var(--lcars-blue)';
          }

          backgroundElement.setAttribute('fill', fill);
          styleUpdated = true;
        }

        // Update opacity
        if (newStyle.opacity !== undefined) {
          backgroundElement.setAttribute('opacity', newStyle.opacity);
          styleUpdated = true;
        }

        // Update border/stroke color
        if (newStyle.border?.color !== undefined) {
          backgroundElement.setAttribute('stroke', newStyle.border.color);
          styleUpdated = true;
        }

        // Update border width (only uniform width on path-based buttons)
        if (newStyle.border?.width !== undefined) {
          backgroundElement.setAttribute('stroke-width', newStyle.border.width);
          styleUpdated = true;
        }

        // Update border radius (rect only - paths already handled above)
        if (rectElement && newStyle.border?.radius !== undefined) {
          rectElement.setAttribute('rx', newStyle.border.radius);
          rectElement.setAttribute('ry', newStyle.border.radius);
          styleUpdated = true;
        }
      }

      // Update bracket colors if present
      if (newStyle.bracket_color !== undefined) {
        const bracketPaths = buttonElement.querySelectorAll('[data-bracket]');
        bracketPaths.forEach(path => {
          path.setAttribute('stroke', newStyle.bracket_color);
          styleUpdated = true;
        });
      }

      // Update text colors if present
      if (newStyle.label_color !== undefined || newStyle.value_color !== undefined) {
        const textElements = buttonElement.querySelectorAll('text');
        textElements.forEach((textEl, index) => {
          const textGroup = textEl.closest('[data-button-text-index]');
          if (textGroup) {
            const textIndex = parseInt(textGroup.getAttribute('data-button-text-index'));

            // First text is usually label, second is value (legacy format)
            if (textIndex === 0 && newStyle.label_color !== undefined) {
              textEl.setAttribute('fill', newStyle.label_color);
              styleUpdated = true;
            } else if (textIndex === 1 && newStyle.value_color !== undefined) {
              textEl.setAttribute('fill', newStyle.value_color);
              styleUpdated = true;
            }
          }
        });
      }

      if (styleUpdated) {
        cblcarsLog.debug(`[ButtonRenderer] ✅ Style updated for button ${buttonId} (${Object.keys(newStyle).length} properties checked)`);
      } else {
        // Debug why no update happened
        cblcarsLog.debug(`[ButtonRenderer] ℹ️ No style changes for button ${buttonId}`, {
          hasColor: newStyle.color !== undefined,
          hasOpacity: newStyle.opacity !== undefined,
          hasBorder: newStyle.border !== undefined,
          hasBracketColor: newStyle.bracket_color !== undefined,
          hasLabelColor: newStyle.label_color !== undefined,
          hasValueColor: newStyle.value_color !== undefined,
          styleKeys: Object.keys(newStyle)
        });
      }

      return styleUpdated;

    } catch (error) {
      cblcarsLog.error(`[ButtonRenderer] Error updating button style:`, error);
      return false;
    }
  }

  /**
   * Update button texts array (new approach using core/TextRenderer)
   * @private
   */
  _updateButtonTextsArray(buttonElement, config, sourceData) {
    let anyUpdated = false;

    config.texts.forEach((textConfig, index) => {
      try {
        // Find the text group for this index
        const textGroup = buttonElement.querySelector(`[data-button-text-index="${index}"]`);
        if (!textGroup) return;

        // Find the actual text element within the group
        const textElement = textGroup.querySelector('text');
        if (!textElement) return;

        // Resolve new content with templates
        const rawContent = textConfig.content || textConfig._originalContent || '';
        const resolvedContent = this._resolveCellContent(rawContent, sourceData);

        if (resolvedContent !== undefined) {
          const oldContent = textElement.textContent?.trim();
          const newContent = String(resolvedContent);

          if (newContent !== oldContent) {
            // CRITICAL FIX: Preserve text alignment attributes when updating
            const textAnchor = textElement.getAttribute('text-anchor');
            const dominantBaseline = textElement.getAttribute('dominant-baseline');

            textElement.textContent = this._escapeXml(newContent);

            // CRITICAL: Re-apply alignment attributes (they might get lost)
            if (textAnchor) textElement.setAttribute('text-anchor', textAnchor);
            if (dominantBaseline) textElement.setAttribute('dominant-baseline', dominantBaseline);

            cblcarsLog.debug(`[ButtonRenderer] Updated text ${index} for button ${config.id}: "${oldContent}" → "${newContent}"`);
            anyUpdated = true;
          }
        }
      } catch (error) {
        cblcarsLog.warn(`[ButtonRenderer] Error updating text ${index} for button ${config.id}:`, error);
      }
    });

    return anyUpdated;
  }

  /**
   * Get raw content from various sources with consistent priority
   * @private
   */
  _getCellContentFromSources(config) {
    return config._originalContent ||
           config._raw?.content ||
           config._raw?.label ||
           config.content ||
           config.label ||
           '';
  }

  /**
   * Resolve content for both initial render and updates
   * @private
   */
  _resolveCellContent(content, updateDataSourceData = null) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // Quick exit if no template markers
    const hasMSD = content.includes('{');
    const hasHA = content.includes('{{') && content.includes('}}');
    if (!hasMSD && !hasHA) {
      return content;
    }

    // Use DataSourceMixin for unified processing
    return DataSourceMixin.processUnifiedTemplateStrings(content, 'ButtonRenderer');
  }

  /**
   * Process action configuration for button
   * @private
   */
  _processButtonActions(config, buttonStyle, cardInstance) {
    // Try to get card instance from various sources
    if (!cardInstance) {
      cardInstance = ActionHelpers.resolveCardInstance();
    }

    // Create overlay-like structure for ActionHelpers compatibility
    const overlayLike = {
      id: config.id,
      tap_action: config.tap_action,
      hold_action: config.hold_action,
      double_tap_action: config.double_tap_action
    };

    // Use the generic ActionHelpers method for consistency
    return ActionHelpers.processOverlayActions(overlayLike, buttonStyle, cardInstance);
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXml(text) {
    if (typeof text !== 'string') return String(text);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Parse position value (percentage, pixel, or relative)
   * @private
   */
  _parsePositionValue(value, dimension, offset = 0) {
    dimension = Number(dimension) || 100;

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    const stringValue = String(value);

    if (stringValue.includes('%')) {
      const percentage = parseFloat(stringValue.replace('%', ''));
      const result = (dimension * percentage) / 100;
      return isNaN(result) ? 0 : result;
    }

    if (stringValue.includes('px')) {
      const result = parseFloat(stringValue.replace('px', ''));
      return isNaN(result) ? 0 : result;
    }

    const numValue = parseFloat(stringValue);
    return isNaN(numValue) ? 0 : numValue;
  }

  /**
   * Render fallback button for error cases
   * @private
   */
  _renderFallbackButton(config, x, y, width, height) {
    const color = 'var(--lcars-gray)';

    cblcarsLog.warn(`[ButtonRenderer] ⚠️ Using fallback rendering for button ${config.id}`);

    return `<g data-button-id="${config.id}" data-fallback="true">
              <rect x="${x}" y="${y}" width="${width}" height="${height}"
                    fill="none" stroke="${color}" stroke-width="2"/>
              <text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle"
                    fill="${color}" font-size="12" dominant-baseline="middle"
                    font-family="var(--lcars-font-family, Antonio)">
                Button Error
              </text>
            </g>`;
  }
}

// Expose ButtonRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.ButtonRenderer = ButtonRenderer;
}