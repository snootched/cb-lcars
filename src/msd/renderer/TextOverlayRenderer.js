/**
 * [TextOverlayRenderer] Text overlay renderer - MSD integration layer
 * 📝 Handles MSD-specific concerns: positioning, DataSource, actions, lifecycle
 *
 * Responsibilities:
 * - Position resolution from anchors
 * - DataSource integration and template processing
 * - Action attachment coordination
 * - Style resolution with ThemeManager defaults
 * - Delegates pure rendering to core/TextRenderer
 */

import { DataSourceMixin } from './DataSourceMixin.js';
import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { ActionHelpers } from './ActionHelpers.js';
import { TextRenderer } from './core/TextRenderer.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class TextOverlayRenderer {
  constructor() {
    // Initialize ThemeManager reference
    this.themeManager = this._resolveThemeManager();
  }

  /**
   * Resolve theme manager from various sources
   * @private
   * @returns {Object|null} Theme manager instance
   */
  _resolveThemeManager() {
    // 1. Global CB-LCARS namespace (preferred)
    if (window.cblcars?.theme) {
      return window.cblcars.theme;
    }

    // 2. Pipeline instance via systemsManager
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.themeManager) {
      return pipelineInstance.systemsManager.themeManager;
    }

    // 3. Direct pipeline access
    if (pipelineInstance?.themeManager) {
      return pipelineInstance.themeManager;
    }

    // 4. Systems manager global reference
    const systemsManager = window.__msdDebug?.systemsManager;
    if (systemsManager?.themeManager) {
      return systemsManager.themeManager;
    }

    cblcarsLog.debug('[TextOverlayRenderer] ⚠️ No theme manager found');
    return null;
  }

  /**
   * Helper method to get default values with proper fallback chain
   * UPDATED: Now uses ThemeManager instead of DefaultsManager
   *
   * @private
   * @param {string} path - Dot-notation path (e.g., 'text.font_size')
   * @param {*} fallback - Fallback value if theme default not found
   * @returns {*} Resolved default value
   */
  _getDefault(path, fallback = null) {
    const themeManager = this._resolveThemeManager();

    if (!themeManager || !themeManager.initialized) {
      return fallback;
    }

    // Convert path from 'text.property' to ThemeManager format
    // ThemeManager expects: 'components.text.property'
    const pathParts = path.split('.');
    const componentType = pathParts[0];
    const property = pathParts.slice(1).join('.');

    try {
      const value = themeManager.getDefault(componentType, property, fallback);
      return value !== null ? value : fallback;
    } catch (error) {
      cblcarsLog.warn(`[TextOverlayRenderer] Error resolving theme default for ${path}:`, error);
      return fallback;
    }
  }

  /**
   * Render a text overlay with MSD integration
   * @param {Object} overlay - Text overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} { markup, actionInfo, overlayId }
   */
  static render(overlay, anchors, viewBox, svgContainer, cardInstance = null) {
    // FIXED: Create instance to access instance methods
    const instance = new TextOverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // Delegate to instance method
    return instance.renderText(overlay, anchors, viewBox, cardInstance);
  }

  /**
   * Instance method for comprehensive text rendering with MSD integration
   */
  renderText(overlay, anchors, viewBox, cardInstance = null) {
    // 1. MSD RESPONSIBILITY: Resolve position from anchors
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[TextOverlayRenderer] ⚠️ Text overlay position could not be resolved:', overlay.id);
      return { markup: '', actionInfo: null, overlayId: overlay.id };
    }

    const [x, y] = position;

    try {
      const style = overlay.finalStyle || overlay.style || {};

      // 2. MSD RESPONSIBILITY: Resolve styles with ThemeManager defaults AND TOKEN SYSTEM
      const textStyle = this._resolveTextStyles(style, overlay.id, viewBox);

      // Adopt computed font when 'inherit' to prevent initial fallback mismatch
      if (this.container && typeof window !== 'undefined') {
        try {
          const cs = getComputedStyle(this.container);
          if (cs) {
            if (textStyle.fontFamily === 'inherit' && cs.fontFamily) {
              textStyle.fontFamily = cs.fontFamily;
            }
            if ((!style.font_size && !style.fontSize) && cs.fontSize) {
              const px = parseFloat(cs.fontSize);
              if (!isNaN(px) && px > 0) textStyle.fontSize = `${px}px`;
            }
          }
        } catch (_) {}
      }

      // 3. MSD RESPONSIBILITY: Resolve text content from DataSource/templates
      const textContent = this._resolveTextContent(overlay, style);

      if (!textContent) {
        cblcarsLog.warn(`[TextOverlayRenderer] ⚠️ No text content for overlay ${overlay.id}`);
        return { markup: '', actionInfo: null, overlayId: overlay.id };
      }

      // 4. DELEGATE: Pure rendering to core/TextRenderer
      const renderResult = TextRenderer.render(
        {
          content: textContent,
          position,
          size: overlay.size
        },
        textStyle,
        {
          viewBox,
          container: this.container,
          overlayId: overlay.id,
          defaults: this._getDefaultsForRenderer()
        }
      );

      // FIXED: Check if renderResult has the expected structure
      if (!renderResult || !renderResult.markup) {
        cblcarsLog.warn(`[TextOverlayRenderer] Core renderer returned empty or invalid result for ${overlay.id}`);
        return this._renderFallbackText(overlay, position[0], position[1]);
      }

      // Check for actions
      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

      // Build text features string
      const textFeatures = [];
      if (textStyle.glow) textFeatures.push('glow');
      if (textStyle.status_indicator) textFeatures.push('status');
      const textFeaturesStr = textFeatures.join(',');

      // CRITICAL FIX: Extract bbox from renderResult.metadata for proper measurements
      const textBBox = renderResult.metadata?.bounds || null;
      const estimatedWidth = textBBox ? textBBox.width : 0;
      const estimatedHeight = textBBox ? textBBox.height : 0;

      cblcarsLog.debug(`[TextOverlayRenderer] Text bbox from renderer:`, {
        overlayId: overlay.id,
        bbox: textBBox,
        hasMetadata: !!renderResult.metadata
      });

      // FIXED: Use renderResult.markup directly with proper metadata attributes
      const overlayMarkup = `<g data-overlay-id="${overlay.id}"
                data-overlay-type="text"
                data-text-features="${textFeaturesStr}"
                data-animation-ready="${!!textStyle.animatable}"
                data-text-width="${estimatedWidth}"
                data-text-height="${estimatedHeight}"
                data-font-family="${textStyle.fontFamily || textStyle.font_family || 'Antonio'}"
                data-font-size="${textStyle.fontSize || textStyle.font_size || 16}"
                data-dominant-baseline="${textStyle.dominantBaseline || textStyle.dominant_baseline || 'central'}"
                data-text-anchor="${textStyle.textAnchor || textStyle.text_anchor || 'start'}"
                data-font-stabilized="0"
                ${hasActions ? 'data-has-actions="true"' : ''}
                style="pointer-events: ${hasActions ? 'all' : 'none'}; cursor: ${hasActions ? 'pointer' : 'default'};">
                ${renderResult.markup}
              </g>`;

      // Process actions if present
      let actionInfo = null;
      if (hasActions && cardInstance) {
        cblcarsLog.debug(`[TextOverlayRenderer] 🎯 Processing actions for ${overlay.id}`, {
          hasTapAction: !!overlay.tap_action,
          hasHoldAction: !!overlay.hold_action,
          hasDoubleTapAction: !!overlay.double_tap_action,
          hasCardInstance: !!cardInstance
        });

        // Process actions using ActionHelpers
        actionInfo = ActionHelpers.processOverlayActions(overlay, textStyle, cardInstance);

        cblcarsLog.debug(`[TextOverlayRenderer] 🎯 Action processing result for ${overlay.id}:`, {
          hasActionInfo: !!actionInfo,
          actionConfig: actionInfo?.config,
          overlayId: actionInfo?.overlay?.id
        });
      } else {
        cblcarsLog.debug(`[TextOverlayRenderer] ⏭️ Skipping actions for ${overlay.id}`, {
          hasActions,
          hasCardInstance: !!cardInstance
        });
      }

      // Return new structure
      cblcarsLog.debug(`[TextOverlayRenderer] 📦 Returning result for ${overlay.id}:`, {
        hasMarkup: !!overlayMarkup,
        hasActionInfo: !!actionInfo,
        overlayId: overlay.id
      });

      return {
        markup: overlayMarkup,
        actionInfo: actionInfo,
        overlayId: overlay.id,
        metadata: renderResult.metadata // ADDED: Pass through metadata for attachment points
      };

    } catch (error) {
      cblcarsLog.error(`[TextOverlayRenderer] ❌ Rendering failed for text overlay ${overlay.id}:`, error);
      return this._renderFallbackText(overlay, x, y);
    }
  }

  /**
   * Resolve comprehensive text styling from configuration
   * ENHANCED: Now integrates token system for theme-aware styling
   * @private
   */
  _resolveTextStyles(style, overlayId, fallbackViewBox = null) {
    let effectiveFallbackViewBox = fallbackViewBox;
    if (!this.viewBox && !fallbackViewBox) {
      try {
        const pipeline = window.__msdDebug?.pipelineInstance;
        const resolvedModel = pipeline?.getResolvedModel?.();
        if (resolvedModel?.viewBox && Array.isArray(resolvedModel.viewBox)) {
          effectiveFallbackViewBox = resolvedModel.viewBox;
        }
      } catch (e) {
        // Ignore errors, use hardcoded fallback
      }
    }

    const scalingContext = this._getScalingContext(effectiveFallbackViewBox);
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    // TOKEN INTEGRATION: Create component-scoped resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('text') : null;

    // Process font size with automatic pixel-perfect scaling
    let resolvedFontSize;
    const styleFontSize = style.font_size || style.fontSize;

    if (styleFontSize && typeof styleFontSize === 'object' && 'value' in styleFontSize) {
      const scaleMode = styleFontSize.scale || 'viewbox';

      if (scaleMode === 'viewbox' && this.container && this.viewBox) {
        try {
          const userPixels = styleFontSize.value;
          const containerRect = this.container.getBoundingClientRect();
          const svgToRealPixelRatio = containerRect.width / this.viewBox[2];
          const svgCoordinates = userPixels / svgToRealPixelRatio;
          resolvedFontSize = `${svgCoordinates}px`;
        } catch (e) {
          resolvedFontSize = `${styleFontSize.value}${styleFontSize.unit || 'px'}`;
        }
      } else {
        resolvedFontSize = `${styleFontSize.value}${styleFontSize.unit || 'px'}`;
      }
    } else if (styleFontSize && typeof styleFontSize === 'number') {
      if (this.container && this.viewBox) {
        try {
          const containerRect = this.container.getBoundingClientRect();
          const svgToRealPixelRatio = containerRect.width / this.viewBox[2];
          const svgCoordinates = styleFontSize / svgToRealPixelRatio;
          resolvedFontSize = `${svgCoordinates}px`;
        } catch (e) {
          resolvedFontSize = styleFontSize;
        }
      } else {
        resolvedFontSize = styleFontSize;
      }
    } else if (typeof styleFontSize === 'string') {
      // TOKEN INTEGRATION: Check if font size is a token reference
      if (resolveToken && this._isTokenReference(styleFontSize)) {
        resolvedFontSize = resolveToken(styleFontSize, 16, { viewBox: scalingContext.viewBox });
      } else {
        resolvedFontSize = styleFontSize;
      }
    } else {
      // TOKEN INTEGRATION: Use token for default size
      if (resolveToken) {
        resolvedFontSize = resolveToken('defaultSize', 16, { viewBox: scalingContext.viewBox });
      } else {
        resolvedFontSize = this._getDefault('text.font_size', 16);
      }
    }

    const textStyle = {
      // Core properties - TOKEN INTEGRATED
      color: this._resolveStyleProperty(
        standardStyles.text.textColor || style.fill || style.color,
        'defaultColor',
        resolveToken,
        this._getDefault('text.color', 'var(--lcars-orange)'),
        scalingContext
      ),
      fontSize: resolvedFontSize,
      fontFamily: this._resolveStyleProperty(
        standardStyles.text.fontFamily !== 'monospace' ? standardStyles.text.fontFamily : (style.font_family || style.fontFamily),
        'defaultFamily',
        resolveToken,
        this._getDefault('text.font_family', 'inherit'),
        scalingContext
      ),
      fontWeight: this._resolveStyleProperty(
        standardStyles.text.fontWeight,
        'typography.fontWeight.normal',
        resolveToken,
        'normal',
        scalingContext
      ),
      fontStyle: standardStyles.text.fontStyle,

      // Positioning and alignment
      textAnchor: (standardStyles.text.textAlign === 'left' ? 'start' :
                   standardStyles.text.textAlign === 'right' ? 'end' :
                   standardStyles.text.textAlign === 'center' ? 'middle' :
                   style.text_anchor || style.textAnchor || 'start').toLowerCase(),
      dominantBaseline: (standardStyles.text.verticalAlign === 'top' ? 'hanging' :
                        standardStyles.text.verticalAlign === 'bottom' ? 'text-after-edge' :
                        standardStyles.text.verticalAlign === 'middle' ? 'central' :
                        style.dominant_baseline || style.dominantBaseline || 'auto').toLowerCase(),
      alignmentBaseline: (style.alignment_baseline || style.alignmentBaseline || 'auto').toLowerCase(),

      // Advanced styling - TOKEN INTEGRATED
      letterSpacing: this._resolveStyleProperty(
        standardStyles.text.letterSpacing,
        'typography.letterSpacing.normal',
        resolveToken,
        '0',
        scalingContext
      ),
      wordSpacing: style.word_spacing || style.wordSpacing || 'normal',
      textDecoration: style.text_decoration || style.textDecoration || 'none',

      // Opacity/visibility - TOKEN INTEGRATED
      opacity: this._resolveStyleProperty(
        standardStyles.layout.opacity,
        'effects.opacity.base',
        resolveToken,
        1.0,
        scalingContext
      ),
      visibility: standardStyles.layout.visible ? 'visible' : 'hidden',

      // Stroke properties - TOKEN INTEGRATED for stroke width
      stroke: style.stroke || null,
      strokeWidth: this._resolveStyleProperty(
        style.stroke_width || style.strokeWidth,
        'borders.width.base',
        resolveToken,
        0,
        scalingContext
      ),
      strokeOpacity: Number(style.stroke_opacity || style.strokeOpacity || 1),
      strokeLinecap: (style.stroke_linecap || style.strokeLinecap || 'butt').toLowerCase(),
      strokeLinejoin: (style.stroke_linejoin || style.strokeLinejoin || 'miter').toLowerCase(),
      strokeDasharray: style.stroke_dasharray || style.strokeDasharray || null,
      strokeDashoffset: Number(style.stroke_dashoffset || style.strokeDashoffset || 0),

      // Advanced fills
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,

      // Effects
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // Multi-line support - TOKEN INTEGRATED for line height
      multiline: style.multiline || false,
      lineHeight: this._resolveStyleProperty(
        standardStyles.text.lineHeight,
        'typography.lineHeight.normal',
        resolveToken,
        1.2,
        scalingContext
      ),
      maxWidth: standardStyles.layout.maxWidth || Number(style.max_width || style.maxWidth || 0),
      textWrapping: style.text_wrapping || style.textWrapping || 'none',

      // Animation
      animatable: standardStyles.animation.animatable,
      pulseSpeed: Number(style.pulse_speed || standardStyles.animation.pulseOnChange ? 1 : 0),
      fadeSpeed: Number(style.fade_speed || 0),
      typewriterSpeed: Number(style.typewriter_speed || 0),

      // LCARS features - TOKEN INTEGRATED for bracket properties
      status_indicator: style.status_indicator || null,
      status_indicator_position: style.status_indicator_position || style.statusIndicatorPosition || 'left-center',
      status_indicator_size: typeof style.status_indicator_size === 'number' ? style.status_indicator_size : null,
      status_indicator_padding: typeof style.status_indicator_padding === 'number' ? style.status_indicator_padding : null,
      bracket_style: style.bracket_style || null,
      bracket_color: style.bracket_color || null,
      bracket_width: this._resolveStyleProperty(
        style.bracket_width,
        'borders.width.base',
        resolveToken,
        this._getDefault('text.bracket.width', 2),
        scalingContext
      ),
      bracket_gap: this._resolveStyleProperty(
        style.bracket_gap,
        'spacing.gap.base',
        resolveToken,
        this._getDefault('text.bracket.gap', 4),
        scalingContext
      ),
      bracket_extension: Number(style.bracket_extension || this._getDefault('text.bracket.extension', 8)),
      bracket_opacity: Number(style.bracket_opacity || this._getDefault('text.bracket.opacity', 1)),
      bracket_corners: style.bracket_corners || 'both',
      bracket_sides: style.bracket_sides || 'both',
      bracket_physical_width: Number(style.bracket_physical_width || style.bracket_width || this._getDefault('text.bracket.physical_width', 8)),
      bracket_height: style.bracket_height || this._getDefault('text.bracket.height', '70%'),
      bracket_radius: this._resolveStyleProperty(
        style.bracket_radius,
        'borders.radius.base',
        resolveToken,
        this._getDefault('text.bracket.radius', 4),
        scalingContext
      ),
      border_top: Number(style.border_top || 0),
      border_left: Number(style.border_left || 0),
      border_right: Number(style.border_right || 0),
      border_bottom: Number(style.border_bottom || 0),
      border_color: style.border_color || null,
      border_radius: this._resolveStyleProperty(
        style.border_radius,
        'borders.radius.lg',
        resolveToken,
        this._getDefault('text.bracket.border_radius', 8),
        scalingContext
      ),
      inner_factor: Number(style.inner_factor || this._getDefault('text.bracket.inner_factor', 2)),
      hybrid_mode: style.hybrid_mode || false,
      highlight: style.highlight || false,

      standardStyles,
      features: []
    };

    // Build feature list
    if (textStyle.gradient) textStyle.features.push('gradient');
    if (textStyle.pattern) textStyle.features.push('pattern');
    if (textStyle.stroke && textStyle.strokeWidth > 0) textStyle.features.push('stroke');
    if (textStyle.glow) textStyle.features.push('glow');
    if (textStyle.shadow) textStyle.features.push('shadow');
    if (textStyle.blur) textStyle.features.push('blur');
    if (textStyle.multiline) textStyle.features.push('multiline');
    if (textStyle.pulseSpeed > 0) textStyle.features.push('pulse');
    if (textStyle.fadeSpeed > 0) textStyle.features.push('fade');
    if (textStyle.typewriterSpeed > 0) textStyle.features.push('typewriter');
    if (textStyle.status_indicator) textStyle.features.push('status');
    if (textStyle.bracket_style) textStyle.features.push('brackets');
    if (textStyle.highlight) textStyle.features.push('highlight');

    return textStyle;
  }

  /**
   * Resolve a style property using token system with fallback to defaults
   * @private
   */
  _resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context) {
    // If style value is explicitly set, use it
    if (styleValue !== undefined && styleValue !== null) {
      // Check if it's a token reference
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
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Resolve text content from DataSource/templates
   * @private
   */
  _resolveTextContent(overlay, style) {
    let content = style.value || overlay.text || overlay.content || '';

    if (!content && overlay._raw?.content) content = overlay._raw.content;
    if (!content && overlay._raw?.text) content = overlay._raw.text;

    let dataSourceRef = overlay.data_source || overlay._raw?.data_source || style.data_source;

    if (!content && style.value_format && typeof style.value_format === 'string' && dataSourceRef) {
      const dataSourceContent = DataSourceMixin.resolveDataSourceContent(dataSourceRef, style, 'TextOverlayRenderer');
      if (dataSourceContent !== null) {
        const numericValue = parseFloat(dataSourceContent);
        if (!isNaN(numericValue) && String(numericValue) === String(dataSourceContent).trim()) {
          if (style.value_format.includes('{value')) {
            content = style.value_format.replace(/\{value(?::([^}]+))?\}/g, (match, formatSpec) => {
              if (formatSpec) {
                const dsManager = DataSourceMixin.getDataSourceManager();
                const dataSource = dsManager?.getSource(dataSourceRef.split('.')[0]);
                const unitOfMeasurement = dataSource?.getCurrentData()?.unit_of_measurement;
                return DataSourceMixin.applyNumberFormat(numericValue, formatSpec, unitOfMeasurement);
              }
              return String(numericValue);
            });
          } else {
            content = style.value_format.replace('{value}', String(numericValue));
          }
          return content;
        } else {
          content = dataSourceContent;
        }
        return content;
      } else {
        content = style.value_format.replace(/\{value[^}]*\}/g, '[Loading...]');
        return content;
      }
    }

    if (!content && style.value_format && typeof style.value_format === 'string') {
      content = style.value_format;
    }

    if (typeof content === 'string') {
      content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlayRenderer');
      return content;
    }

    if (content && typeof content === 'string' && content.includes('{')) {
      content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlayRenderer');
      return content;
    }

    if (content) return content;

    if (!dataSourceRef) {
      dataSourceRef = overlay.data_source || overlay._raw?.data_source || style.data_source;
    }
    if (dataSourceRef) {
      const dataSourceContent = DataSourceMixin.resolveDataSourceContent(dataSourceRef, style, 'TextOverlayRenderer');
      if (dataSourceContent !== null) {
        return dataSourceContent;
      } else {
        return `[Loading: ${dataSourceRef}]`;
      }
    }

    return content;
  }

  /**
   * Get ThemeManager instance (wrapper for _resolveThemeManager)
   * @private
   * @returns {Object|null} ThemeManager instance
   */
  _getThemeManager() {
    return this._resolveThemeManager();
  }

  /**
   * Get scaling context for responsive calculations
   * @private
   * @param {Array|null} fallbackViewBox - Fallback viewBox if not available
   * @returns {Object} Scaling context with viewBox and container
   */
  _getScalingContext(fallbackViewBox = null) {
    const viewBox = this.viewBox || fallbackViewBox || [0, 0, 400, 200];
    return {
      viewBox: viewBox,
      containerElement: this.container
    };
  }

  /**
   * Prepare animation attributes for anime.js integration
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Style configuration
   * @returns {Object} Animation attributes object
   */
  _prepareAnimationAttributes(overlay, style) {
    const standardStyles = RendererUtils.parseStandardAnimationStyles(style);

    const animationAttributes = {
      textAttributes: [],
      hasAnimations: false
    };

    const animationDataAttrs = RendererUtils.createAnimationDataAttributes(standardStyles);
    if (animationDataAttrs) {
      animationAttributes.textAttributes.push(animationDataAttrs);
      animationAttributes.hasAnimations = true;
    }

    if (style.pulse_speed || style.pulseSpeed) {
      animationAttributes.textAttributes.push(`data-pulse-speed="${style.pulse_speed || style.pulseSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.fade_speed || style.fadeSpeed) {
      animationAttributes.textAttributes.push(`data-fade-speed="${style.fade_speed || style.fadeSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.typewriter_speed || style.typewriterSpeed) {
      animationAttributes.textAttributes.push(`data-typewriter-speed="${style.typewriter_speed || style.typewriterSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Render fallback text when core rendering fails
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object} Fallback render result
   */
  _renderFallbackText(overlay, x, y) {
    const style = overlay.finalStyle || overlay.style || {};
    const text = style.value || overlay.text || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || style.fontSize || this._getDefault('text.font_size', 16);

    return {
      markup: `<g data-overlay-id="${overlay.id}" data-overlay-type="text" data-fallback="true">
                <text x="${x}" y="${y}"
                      fill="${color}"
                      font-size="${fontSize}"
                      text-anchor="start"
                      dominant-baseline="auto">
                  ${TextRenderer._escapeXml(text)}
                </text>
              </g>`,
      actionInfo: null,
      overlayId: overlay.id
    };
  }

  /**
   * Get default values for core TextRenderer
   * @private
   * @returns {Object} Default values object
   */
  _getDefaultsForRenderer() {
    return {
      highlight_padding: this._getDefault('text.highlight.padding', 2),
      highlight_opacity: this._getDefault('text.highlight.opacity', 0.3),
      status_indicator_size_ratio: this._getDefault('text.status_indicator.size_ratio', 0.3),
      status_indicator_color: this._getDefault('text.status_indicator.color', 'var(--lcars-green)'),
      status_indicator_padding: this._getDefault('text.status_indicator.padding', 8)
    };
  }

  /**
   * Update text overlay content dynamically
   * @static
   * @param {Element} overlayElement - DOM element for the overlay
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Updated source data
   * @returns {boolean} True if content was updated
   */
  static updateTextData(overlayElement, overlay, sourceData) {
    try {
      const textElement = overlayElement.querySelector('text');
      if (!textElement) return false;

      const renderer = new TextOverlayRenderer();
      const newContent = renderer._resolveTextContent(overlay, overlay.finalStyle || {});

      if (newContent && newContent !== textElement.textContent) {
        textElement.textContent = TextRenderer._escapeXml(newContent);
        return true;
      }

      return false;
    } catch (error) {
      cblcarsLog.error(`[TextOverlayRenderer] ❌ Error updating text overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Compute attachment points for line connectors
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Element} container - Container element
   * @param {Array|null} viewBox - ViewBox dimensions
   * @returns {Object|null} Attachment points object
   */
  static computeAttachmentPoints(overlay, anchors, container, viewBox = null) {
    if (!overlay || overlay.type !== 'text') return null;

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) return null;

    const instance = new TextOverlayRenderer();
    instance.container = container;
    instance.viewBox = viewBox;

    const style = overlay.finalStyle || overlay.style || {};
    const textStyle = instance._resolveTextStyles(style, overlay.id, viewBox);
    const textContent = instance._resolveTextContent(overlay, style);

    if (!textContent) return null;

    const renderResult = TextRenderer.render(
      { content: textContent, position },
      textStyle,
      {
        viewBox,
        container,
        overlayId: overlay.id,
        defaults: instance._getDefaultsForRenderer()
      }
    );

    if (!renderResult.metadata) return null;

    return {
      id: overlay.id,
      center: renderResult.metadata.attachmentPoints.center,
      points: renderResult.metadata.attachmentPoints,
      bbox: renderResult.metadata.bounds,
      textStyle,
      x: position[0],
      y: position[1]
    };
  }

  /**
   * Resolve container element from various sources as fallback
   * @private
   * @returns {Element|null} Container element for action attachment
   */
  _resolveContainerElement() {
    // Try to find a valid container element for action attachment

    // Method 1: From pipeline renderer (most reliable)
    const renderer = window.__msdDebug?.pipelineInstance?.systemsManager?.renderer;
    if (renderer?.mountEl) {
      cblcarsLog.debug(`[TextOverlayRenderer] Resolved container from pipeline renderer`);
      return renderer.mountEl;
    }

    // Method 2: From card instance shadow root
    const cardInstance = window.__msdDebug?.pipelineInstance?.cardInstance ||
                         window._msdCardInstance ||
                         window.cb_lcars_card_instance;

    if (cardInstance?.shadowRoot) {
      cblcarsLog.debug(`[TextOverlayRenderer] Resolved container from card instance shadow root`);
      return cardInstance.shadowRoot;
    }

    // Method 3: Try to find overlay container in document
    const overlayContainer = document.querySelector('#msd-overlay-container');
    if (overlayContainer) {
      cblcarsLog.debug(`[TextOverlayRenderer] Resolved container from document query`);
      return overlayContainer;
    }

    cblcarsLog.warn(`[TextOverlayRenderer] Could not resolve container element from any source`);
    return null;
  }
}

export default TextOverlayRenderer;