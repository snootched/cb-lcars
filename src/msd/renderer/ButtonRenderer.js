/**
 * [ButtonRenderer] Individual button rendering with full LCARS styling support
 * 🔲 Provides comprehensive button rendering for both status grids and standalone buttons
 * 🎨 Supports individual border styling and corner radius control
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { ActionHelpers } from './ActionHelpers.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ButtonRenderer {
  constructor() {
    // Connect to defaults manager from global context
    this.defaultsManager = this._resolveDefaultsManager();
    this.stylePresetManager = this._resolveStylePresetManager();
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

    cblcarsLog.debug('[ButtonRenderer] ⚠️ No defaults manager found');
    return null;
  }

  /**
   * Resolve style preset manager from various sources
   * @private
   * @returns {Object|null} Style preset manager instance
   */
  _resolveStylePresetManager() {
    // 1. Pipeline instance (preferred)
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.stylePresetManager) {
      return pipelineInstance.systemsManager.stylePresetManager;
    }

    // 2. Systems manager global reference
    const systemsManager = window.__msdDebug?.systemsManager;
    if (systemsManager?.stylePresetManager) {
      return systemsManager.stylePresetManager;
    }

    cblcarsLog.debug('[ButtonRenderer] ⚠️ No style preset manager found');
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
   * Render a single button with full LCARS styling support
   * @param {Object} config - Button configuration
   * @param {Object} style - Resolved button styling
   * @param {Object} size - Button dimensions {width, height}
   * @param {Object} position - Button position {x, y}
   * @param {Object} options - Additional options {cellId, gridContext, etc}
   * @returns {Object} {markup, actions, metadata}
   * @static
   */
  static render(config, style, size, position, options = {}) {
    const instance = new ButtonRenderer();
    return instance.renderButton(config, style, size, position, options);
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

      // Process actions if available
      const actionInfo = this._processButtonActions(config, buttonStyle, options.cardInstance);

      // Check if button has actions
      const hasActions = !!(config.tap_action || config.hold_action || config.double_tap_action || buttonStyle.actions);

      // CRITICAL: Use 'visiblePainted' for grid cells with actions (matches working button pattern)
      const pointerEvents = hasActions ? 'visiblePainted' : 'none';
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

      // Render button text content
      buttonMarkup += this.renderButtonText(config, x, y, width, height, buttonStyle);

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
   * @private
   * @param {Object} style - Style configuration
   * @param {Object} standardStyles - Parsed standard styles
   * @returns {Object} Enhanced border configuration
   */
  _resolveBorderStyle(style, standardStyles) {
    // Global defaults
    const globalWidth = standardStyles.layout.borderWidth || style.border_width || this._getDefault('button.border_width', 1);
    const globalColor = standardStyles.colors.borderColor || style.border_color || this._getDefault('button.border_color', 'var(--lcars-gray)');
    const globalRadius = standardStyles.layout.borderRadius || style.border_radius || this._getDefault('button.border_radius', 8);

    // FIXED: More thorough individual border detection
    const hasIndividualSides = !!(
      style.border_top ||
      style.border_right ||
      style.border_bottom ||
      style.border_left ||
      (typeof style.border_top === 'object') ||
      (typeof style.border_right === 'object') ||
      (typeof style.border_bottom === 'object') ||
      (typeof style.border_left === 'object')
    );

    const hasIndividualRadius = !!(
      style.border_radius_top_left !== undefined ||
      style.border_radius_top_right !== undefined ||
      style.border_radius_bottom_right !== undefined ||
      style.border_radius_bottom_left !== undefined
    );

    return {
      // Global fallbacks
      width: globalWidth,
      color: globalColor,
      radius: globalRadius,

      // Individual side control - FIXED: Better object handling
      top: {
        width: (typeof style.border_top === 'object' ? style.border_top.width : style.border_top) || globalWidth,
        color: (typeof style.border_top === 'object' ? style.border_top.color : null) || globalColor,
        style: (typeof style.border_top === 'object' ? style.border_top.style : null) || 'solid'
      },
      right: {
        width: (typeof style.border_right === 'object' ? style.border_right.width : style.border_right) || globalWidth,
        color: (typeof style.border_right === 'object' ? style.border_right.color : null) || globalColor,
        style: (typeof style.border_right === 'object' ? style.border_right.style : null) || 'solid'
      },
      bottom: {
        width: (typeof style.border_bottom === 'object' ? style.border_bottom.width : style.border_bottom) || globalWidth,
        color: (typeof style.border_bottom === 'object' ? style.border_bottom.color : null) || globalColor,
        style: (typeof style.border_bottom === 'object' ? style.border_bottom.style : null) || 'solid'
      },
      left: {
        width: (typeof style.border_left === 'object' ? style.border_left.width : style.border_left) || globalWidth,
        color: (typeof style.border_left === 'object' ? style.border_left.color : null) || globalColor,
        style: (typeof style.border_left === 'object' ? style.border_left.style : null) || 'solid'
      },

      // Individual corner radius - FIXED: Check for undefined explicitly
      topLeft: style.border_radius_top_left !== undefined ? style.border_radius_top_left : globalRadius,
      topRight: style.border_radius_top_right !== undefined ? style.border_radius_top_right : globalRadius,
      bottomRight: style.border_radius_bottom_right !== undefined ? style.border_radius_bottom_right : globalRadius,
      bottomLeft: style.border_radius_bottom_left !== undefined ? style.border_radius_bottom_left : globalRadius,

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
        cblcarsLog.debug(`[ButtonRenderer] 📝 Preset set ${property}: ${value}`);
      } else {
        cblcarsLog.debug(`[ButtonRenderer] 🚫 User explicit value for ${property}, skipping preset`);
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
        cblcarsLog.debug(`[ButtonRenderer] ✅ Found preset ${presetName} via StylePresetManager`);
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
    const { topLeft, topRight, bottomRight, bottomLeft } = border;

    // Start from top-left corner, accounting for radius
    let path = `M ${topLeft} 0`;

    // Top edge to top-right corner
    path += ` L ${width - topRight} 0`;

    // Top-right corner curve
    if (topRight > 0) {
      path += ` Q ${width} 0 ${width} ${topRight}`;
    } else {
      path += ` L ${width} 0`;
    }

    // Right edge to bottom-right corner
    path += ` L ${width} ${height - bottomRight}`;

    // Bottom-right corner curve
    if (bottomRight > 0) {
      path += ` Q ${width} ${height} ${width - bottomRight} ${height}`;
    } else {
      path += ` L ${width} ${height}`;
    }

    // Bottom edge to bottom-left corner
    path += ` L ${bottomLeft} ${height}`;

    // Bottom-left corner curve
    if (bottomLeft > 0) {
      path += ` Q 0 ${height} 0 ${height - border.bottomLeft}`;
    } else {
      path += ` L 0 ${height}`;
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

    // Top border
    if (border.top.width > 0) {
      const topRadius = Math.min(border.topLeft, border.topRight);
      borderMarkup += `<path d="M ${border.topLeft} 0 L ${width - border.topRight} 0"
                        transform="translate(${x}, ${y})"
                        stroke="${border.top.color}"
                        stroke-width="${border.top.width}"
                        stroke-linecap="round"
                        fill="none" />`;
    }

    // Right border
    if (border.right.width > 0) {
      borderMarkup += `<path d="M ${width} ${border.topRight} L ${width} ${height - border.bottomRight}"
                        transform="translate(${x}, ${y})"
                        stroke="${border.right.color}"
                        stroke-width="${border.right.width}"
                        stroke-linecap="round"
                        fill="none" />`;
    }

    // Bottom border
    if (border.bottom.width > 0) {
      borderMarkup += `<path d="M ${width - border.bottomRight} ${height} L ${border.bottomLeft} ${height}"
                        transform="translate(${x}, ${y})"
                        stroke="${border.bottom.color}"
                        stroke-width="${border.bottom.width}"
                        stroke-linecap="round"
                        fill="none" />`;
    }

    // Left border
    if (border.left.width > 0) {
      borderMarkup += `<path d="M 0 ${height - border.bottomLeft} L 0 ${border.topLeft}"
                        transform="translate(${x}, ${y})"
                        stroke="${border.left.color}"
                        stroke-width="${border.left.width}"
                        stroke-linecap="round"
                        fill="none" />`;
    }

    // Corner arcs if we have individual radii
    if (border.hasIndividualRadius) {
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

    // Top-left corner
    if (border.topLeft > 0) {
      const topBorderColor = border.hasIndividualSides ? border.top.color : border.color;
      const leftBorderColor = border.hasIndividualSides ? border.left.color : border.color;
      // Use dominant color (top takes precedence)
      const cornerColor = topBorderColor;

      arcMarkup += `<path d="M 0 ${border.topLeft} Q 0 0 ${border.topLeft} 0"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${Math.max(border.top.width, border.left.width)}"
                     fill="none" />`;
    }

    // Top-right corner
    if (border.topRight > 0) {
      const topBorderColor = border.hasIndividualSides ? border.top.color : border.color;
      const rightBorderColor = border.hasIndividualSides ? border.right.color : border.color;
      const cornerColor = topBorderColor;

      arcMarkup += `<path d="M ${width - border.topRight} 0 Q ${width} 0 ${width} ${border.topRight}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${Math.max(border.top.width, border.right.width)}"
                     fill="none" />`;
    }

    // Bottom-right corner
    if (border.bottomRight > 0) {
      const rightBorderColor = border.hasIndividualSides ? border.right.color : border.color;
      const bottomBorderColor = border.hasIndividualSides ? border.bottom.color : border.color;
      const cornerColor = rightBorderColor;

      arcMarkup += `<path d="M ${width} ${height - border.bottomRight} Q ${width} ${height} ${width - border.bottomRight} ${height}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${Math.max(border.right.width, border.bottom.width)}"
                     fill="none" />`;
    }

    // Bottom-left corner
    if (border.bottomLeft > 0) {
      const bottomBorderColor = border.hasIndividualSides ? border.bottom.color : border.color;
      const leftBorderColor = border.hasIndividualSides ? border.left.color : border.color;
      const cornerColor = bottomBorderColor;

      arcMarkup += `<path d="M ${border.bottomLeft} ${height} Q 0 ${height} 0 ${height - border.bottomLeft}"
                     transform="translate(${x}, ${y})"
                     stroke="${cornerColor}"
                     stroke-width="${Math.max(border.bottom.width, border.left.width)}"
                     fill="none" />`;
    }

    return arcMarkup;
  }

  /**
   * Check if we can use simple rect rendering (optimization)
   * @private
   */
  _canUseSimpleRect(border) {
    // Check if all borders are the same
    const bordersSame = (
      border.top.width === border.right.width &&
      border.right.width === border.bottom.width &&
      border.bottom.width === border.left.width &&
      border.top.color === border.right.color &&
      border.right.color === border.bottom.color &&
      border.bottom.color === border.left.color
    );

    // Check if all radii are the same
    const radiiSame = (
      border.topLeft === border.topRight &&
      border.topRight === border.bottomRight &&
      border.bottomRight === border.bottomLeft
    );

    return bordersSame && radiiSame && !border.hasIndividualSides && !border.hasIndividualRadius;
  }

  /**
   * Apply SVG filter effects for button
   * @private
   */
  _applyFilterEffects(buttonElement, buttonStyle, buttonId) {
    // Remove existing filter effects
    const existingFilters = buttonElement.querySelectorAll(`[filter^="url(#filter-"]`);
    existingFilters.forEach(filter => filter.remove());

    const filterDefs = [];

    // Glow effect
    if (buttonStyle.glow) {
      const glowId = `glow-${buttonId}`;
      RendererUtils.renderGlowFilter(buttonStyle.glow, glowId);
      filterDefs.push(`url(#${glowId})`);
    }
    // Shadow effect
    if (buttonStyle.shadow) {
      const shadowId = `shadow-${buttonId}`;
      RendererUtils.renderShadowFilter(buttonStyle.shadow, shadowId);
      filterDefs.push(`url(#${shadowId})`);
    }
    // Blur effect
    if (buttonStyle.blur) {
      const blurId = `blur-${buttonId}`;
      RendererUtils.renderBlurFilter(buttonStyle.blur, blurId);
      filterDefs.push(`url(#${blurId})`);
    }

    // Apply filters to button element
    if (filterDefs.length > 0) {
      buttonElement.style.filter = filterDefs.join(' ');
    } else {
      buttonElement.style.filter = '';
    }
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
   * Render button text content with positioning and styling
   * @param {Object} config - Button configuration
   * @param {number} x - Button X coordinate
   * @param {number} y - Button Y coordinate
   * @param {number} width - Button width
   * @param {number} height - Button height
   * @param {Object} buttonStyle - Resolved button styling
   * @returns {string} SVG markup for button text
   */
  renderButtonText(config, x, y, width, height, buttonStyle) {
    let textMarkup = '';

    // CRITICAL: Text elements should use 'all' to ensure they receive click events
    const textPointerEvents = 'all';
    const textCursor = 'inherit';

    // Render button label if enabled
    if (buttonStyle.show_labels && config.label) {
      const labelPos = this._calculateEnhancedTextPosition(
        buttonStyle.label_position, x, y, width, height, buttonStyle, 'label'
      );

      textMarkup += `<text x="${labelPos.x}" y="${labelPos.y}"
                     text-anchor="${labelPos.anchor}" dominant-baseline="${labelPos.baseline}"
                     fill="${buttonStyle.label_color}"
                     font-size="${buttonStyle.label_font_size}"
                     font-family="${buttonStyle.font_family}"
                     font-weight="${buttonStyle.font_weight}"
                     style="pointer-events: ${textPointerEvents}; user-select: none; cursor: ${textCursor};"
                     data-button-label="${config.id}">
                     ${this._escapeXml(config.label)}
                   </text>`;
    }

    // Render button content/value if enabled
    if (buttonStyle.show_values && config.content) {
      const valuePos = this._calculateEnhancedTextPosition(
        buttonStyle.value_position, x, y, width, height, buttonStyle, 'value'
      );

      textMarkup += `<text x="${valuePos.x}" y="${valuePos.y}"
                     text-anchor="${valuePos.anchor}" dominant-baseline="${valuePos.baseline}"
                     fill="${buttonStyle.value_color}"
                     font-size="${buttonStyle.value_font_size}"
                     font-family="${buttonStyle.font_family}"
                     font-weight="${buttonStyle.font_weight}"
                     style="pointer-events: ${textPointerEvents}; user-select: none; cursor: ${textCursor};"
                     data-button-content="${config.id}">
                     ${this._escapeXml(config.content)}
                   </text>`;
    }

    return textMarkup;
  }

  /**
   * Calculate text position based on enhanced positioning system
   * @private
   */
  _calculateEnhancedTextPosition(position, x, y, width, height, buttonStyle, textType = 'label') {
    const basePadding = buttonStyle.text_padding || 8;
    const fontSize = textType === 'label' ? (buttonStyle.label_font_size || 18) : (buttonStyle.value_font_size || 16);

    // Handle LCARS presets
    if (buttonStyle.lcars_text_preset) {
      return this._calculateLCARSPresetPosition(buttonStyle.lcars_text_preset, x, y, width, height, buttonStyle, textType);
    }

    // Predefined position strings
    const positionMap = {
      'center': { x: '50%', y: '50%', anchor: 'middle', baseline: 'middle' },
      'center-top': { x: '50%', y: basePadding + 'px', anchor: 'middle', baseline: 'hanging' },
      'center-bottom': { x: '50%', y: (height - basePadding) + 'px', anchor: 'middle', baseline: 'baseline' },
      'top-left': { x: basePadding + 'px', y: basePadding + 'px', anchor: 'start', baseline: 'hanging' },
      'top-right': { x: (width - basePadding) + 'px', y: basePadding + 'px', anchor: 'end', baseline: 'hanging' },
      'bottom-left': { x: basePadding + 'px', y: (height - basePadding) + 'px', anchor: 'start', baseline: 'baseline' },
      'bottom-right': { x: (width - basePadding) + 'px', y: (height - basePadding) + 'px', anchor: 'end', baseline: 'baseline' }
    };

    const positionSpec = positionMap[position] || positionMap['center'];

    return {
      x: x + this._parsePositionValue(positionSpec.x, width, 0),
      y: y + this._parsePositionValue(positionSpec.y, height, 0),
      anchor: positionSpec.anchor,
      baseline: positionSpec.baseline
    };
  }

  /**
   * Calculate LCARS preset positions
   * @private
   */
  _calculateLCARSPresetPosition(preset, x, y, width, height, buttonStyle, textType) {
    const basePadding = buttonStyle.text_padding || 8;
    const fontSize = textType === 'label' ? (buttonStyle.label_font_size || 18) : (buttonStyle.value_font_size || 16);

    switch (preset) {
      case 'lozenge':
        if (textType === 'label') {
          return {
            x: x + basePadding,
            y: y + basePadding + fontSize * 0.8,
            anchor: 'start',
            baseline: 'hanging'
          };
        } else {
          return {
            x: x + width - basePadding,
            y: y + height * 0.85,
            anchor: 'end',
            baseline: 'baseline'
          };
        }

      case 'bullet':
        if (textType === 'label') {
          return {
            x: x + basePadding,
            y: y + height / 2,
            anchor: 'start',
            baseline: 'middle'
          };
        } else {
          return {
            x: x + width - basePadding,
            y: y + height / 2,
            anchor: 'end',
            baseline: 'middle'
          };
        }

      default:
        return {
          x: x + width / 2,
          y: y + height / 2,
          anchor: 'middle',
          baseline: 'middle'
        };
    }
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
   * Update button content dynamically
   * @param {Element} buttonElement - DOM element for the button
   * @param {Object} config - Button configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if updated
   */
  updateButton(buttonElement, config, sourceData) {
    try {
      // Get raw content and resolve it with new data
      const rawContent = this._getCellContentFromSources(config);
      const resolvedContent = this._resolveCellContent(rawContent, sourceData);

      // Update button content in DOM
      const contentElement = buttonElement.querySelector(`[data-button-content="${config.id}"]`);

      if (contentElement && resolvedContent !== undefined) {
        const oldContent = contentElement.textContent?.trim();
        let newContent = String(resolvedContent);

        if (newContent !== oldContent) {
          cblcarsLog.debug(`[ButtonRenderer] Updating button ${config.id}: "${oldContent}" → "${newContent}"`);
          contentElement.textContent = newContent;
          return true;
        }
      }

      return false;
    } catch (error) {
      cblcarsLog.error(`[ButtonRenderer] Error updating button ${config.id}:`, error);
      return false;
    }
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

