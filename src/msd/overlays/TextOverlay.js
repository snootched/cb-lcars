/**
 * [TextOverlay] Instance-based text overlay extending OverlayBase
 *
 * Phase 3B: First overlay migrated to instance-based pattern
 *
 * Responsibilities:
 * - Text rendering with positioning and styling
 * - DataSource integration and template processing
 * - Action attachment coordination
 * - Style resolution with ThemeManager defaults and token system
 * - Lifecycle management (initialize, render, update, destroy)
 *
 * Delegates pure rendering to core/TextRenderer
 */

import { OverlayBase } from './OverlayBase.js';
import { OverlayUtils } from '../renderer/OverlayUtils.js';
import { RendererUtils } from '../renderer/RendererUtils.js';
import { ActionHelpers } from '../renderer/ActionHelpers.js';
import { TextRenderer } from '../renderer/core/TextRenderer.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';
import { DataSourceMixin } from '../renderer/DataSourceMixin.js';

export class TextOverlay extends OverlayBase {
  constructor(overlay, systemsManager) {
    super(overlay, systemsManager);
    this.rendererName = 'TextOverlay';

    // Cache for performance
    this._cachedTextContent = null;
    this._cachedTextStyle = null;
    this._cachedPosition = null;
    this._lastRenderResult = null;

    // Store references for updates
    this.container = null;
    this.viewBox = null;
  }

  /**
   * Initialize the text overlay
   * Sets up subscriptions and prepares for rendering
   *
   * @param {Object} context - Initialization context
   * @returns {Object} Initialization result with metadata
   */
  initialize(context) {
    cblcarsLog.debug(`[TextOverlay] 🎬 Initializing text overlay: ${this.overlay.id}`);

    this.container = context.container;
    this.viewBox = context.viewBox;

    // Pre-resolve styles to cache them
    const style = this.overlay.finalStyle || this.overlay.style || {};
    this._cachedTextStyle = this._resolveTextStyles(style, this.overlay.id, this.viewBox);

    // Pre-resolve content
    this._cachedTextContent = this._resolveTextContent(this.overlay, style);

    this._initialized = true;

    return {
      success: true,
      overlayId: this.overlay.id,
      requiresSubscription: !!this.overlay.data_source,
      metadata: {
        hasTextContent: !!this._cachedTextContent,
        hasActions: !!(this.overlay.tap_action || this.overlay.hold_action || this.overlay.double_tap_action)
      }
    };
  }

  /**
   * Render the text overlay
   * Generates complete SVG markup for initial render
   *
   * @param {Object} context - Rendering context with container, viewBox, etc.
   * @returns {Object} Render result with markup and metadata
   */
  render(context) {
    try {
      cblcarsLog.debug(`[TextOverlay] 🎨 Rendering text overlay: ${this.overlay.id}`);

      const overlay = this.overlay;
      const style = overlay.finalStyle || overlay.style || {};
      const viewBox = context.viewBox || this.viewBox;

      this.container = context.container;
      this.viewBox = viewBox;

      // 1. Resolve position
      const position = overlay.position || [0, 0];
      this._cachedPosition = position;
      const [x, y] = position;

      // 2. Resolve text styling (with caching)
      if (!this._cachedTextStyle) {
        this._cachedTextStyle = this._resolveTextStyles(style, overlay.id, viewBox);
      }
      const textStyle = this._cachedTextStyle;

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

      // 3. Resolve text content from DataSource/templates
      if (!this._cachedTextContent) {
        this._cachedTextContent = this._resolveTextContent(overlay, style);
      }
      const textContent = this._cachedTextContent;

      // Runtime check: Verify resolved content
      if (!textContent) {
        cblcarsLog.warn(`[TextOverlay] ⚠️ No text content for overlay ${overlay.id} - DataSource or template resolved to empty`);
        return { markup: '', actionInfo: null, overlayId: overlay.id };
      }

      // 4. Delegate pure rendering to core/TextRenderer
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

      // Check if renderResult has the expected structure
      if (!renderResult || !renderResult.markup) {
        cblcarsLog.warn(`[TextOverlay] Core renderer returned empty or invalid result for ${overlay.id}`);
        return this._renderFallbackText(overlay, x, y);
      }

      // Cache the render result for updates
      this._lastRenderResult = renderResult;

      // Check for actions
      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

      // Build text features string
      const textFeatures = [];
      if (textStyle.glow) textFeatures.push('glow');
      if (textStyle.status_indicator) textFeatures.push('status');
      const textFeaturesStr = textFeatures.join(',');

      // Extract bbox from renderResult.metadata for proper measurements
      const textBBox = renderResult.metadata?.bounds || null;
      const estimatedWidth = textBBox ? textBBox.width : 0;
      const estimatedHeight = textBBox ? textBBox.height : 0;

      cblcarsLog.debug(`[TextOverlay] Text bbox from renderer:`, {
        overlayId: overlay.id,
        bbox: textBBox,
        hasMetadata: !!renderResult.metadata
      });

      // Build overlay markup
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
                ${hasActions ? 'style="pointer-events: all; cursor: pointer;"' : ''}>
${renderResult.markup}
              </g>`;

      // 5. Handle actions if present
      let actionInfo = null;
      if (hasActions) {
        actionInfo = this._processActions(overlay, context);
      }

      return {
        markup: overlayMarkup,
        actionInfo,
        overlayId: overlay.id,
        metadata: {
          renderer: 'TextOverlay',
          version: '3.0',
          bbox: textBBox,
          attachmentPoints: renderResult.metadata?.attachmentPoints || null,
          hasActions,
          textFeatures: textFeaturesStr
        }
      };

    } catch (error) {
      cblcarsLog.error(`[TextOverlay] ❌ Render failed for text overlay ${this.overlay.id}:`, error);
      return {
        markup: '',
        actionInfo: null,
        overlayId: this.overlay.id,
        error: error.message
      };
    }
  }

  /**
   * Update the text overlay with new data
   * Handles incremental updates without full re-render
   *
   * @param {Element} overlayElement - The DOM element to update
   * @param {Object} overlay - Updated overlay configuration
   * @param {Object} sourceData - Data from Home Assistant for template processing
   * @returns {boolean} Success status
   */
  update(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.debug(`[TextOverlay] 🔄 Updating text overlay: ${overlay.id}`, {
        hasSourceData: !!sourceData,
        sourceDataKeys: sourceData ? Object.keys(sourceData) : []
      });

      // Invalidate cached content to force re-resolution with new data
      this._cachedTextContent = null;

      // Re-resolve content with new data
      const style = overlay.finalStyle || overlay.style || {};
      const textContent = this._resolveTextContent(overlay, style, sourceData);

      if (!textContent) {
        cblcarsLog.warn(`[TextOverlay] ⚠️ Update produced empty content for ${overlay.id}`);
        return false;
      }

      // Update the text content in the DOM
      const textElement = overlayElement.querySelector('text');
      if (textElement) {
        // Simply update the text content - templates have been processed
        textElement.textContent = textContent;

        cblcarsLog.debug(`[TextOverlay] ✅ Updated text overlay ${overlay.id} with processed content`);
        return true;
      }

      cblcarsLog.warn(`[TextOverlay] ⚠️ No text element found in overlay ${overlay.id}`);
      return false;

    } catch (error) {
      cblcarsLog.error(`[TextOverlay] ❌ Update failed for text overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Compute attachment points for this text overlay
   * Used by line overlays to connect to text overlays
   *
   * @param {Object} overlay - Text overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element
   * @returns {Object|null} Attachment points object
   */
  computeAttachmentPoints(overlay, anchors, container) {
    try {
      // Get the actual DOM element for this overlay
      const overlayElement = container.querySelector(`[data-overlay-id="${overlay.id}"]`);
      if (!overlayElement) {
        cblcarsLog.debug(`[TextOverlay] No DOM element found for attachment points: ${overlay.id}`);
        return null;
      }

      // Get the text element bbox
      const textElement = overlayElement.querySelector('text');
      if (!textElement) {
        return null;
      }

      try {
        const bbox = textElement.getBBox();

        // Get data attributes for status indicator position
        const statusPos = overlayElement.getAttribute('data-status-pos') || 'left';

        // Calculate attachment points including status indicator
        const attachmentPoints = OverlayUtils.computeTextAttachmentPoints(
          bbox,
          overlay.position || [bbox.x, bbox.y],
          statusPos,
          overlay.id
        );

        return attachmentPoints;

      } catch (bboxError) {
        cblcarsLog.debug(`[TextOverlay] Could not get bbox for ${overlay.id}:`, bboxError.message);
        return null;
      }

    } catch (error) {
      cblcarsLog.warn(`[TextOverlay] Error computing attachment points for ${overlay.id}:`, error);
      return null;
    }
  }

  /**
   * Clean up resources when overlay is destroyed
   */
  destroy() {
    cblcarsLog.debug(`[TextOverlay] 🗑️ Destroying text overlay: ${this.overlay.id}`);

    // Clear caches
    this._cachedTextContent = null;
    this._cachedTextStyle = null;
    this._cachedPosition = null;
    this._lastRenderResult = null;

    // Call parent cleanup
    super.destroy();
  }

  // ===================================================================
  // Private helper methods
  // ===================================================================

  /**
   * Resolve text content from various sources
   * Matches TextOverlayRenderer behavior for backward compatibility
   * @private
   */
    /**
   * Resolve text content from DataSource/templates
   * FIXED: Now uses DataSourceMixin properly like working TextOverlayRenderer
   * @private
   */
  _resolveTextContent(overlay, style, sourceData = null) {
    let content = style.value || overlay.text || overlay.content || '';

    if (!content && overlay._raw?.content) content = overlay._raw.content;
    if (!content && overlay._raw?.text) content = overlay._raw.text;

    let dataSourceRef = overlay.data_source || overlay._raw?.data_source || style.data_source;

    // Handle value_format with data source (same as working TextOverlayRenderer)
    if (!content && style.value_format && typeof style.value_format === 'string' && dataSourceRef) {
      const dataSourceContent = DataSourceMixin.resolveDataSourceContent(dataSourceRef, style, 'TextOverlay');
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

    // If we have value_format but no data source, use it as template
    if (!content && style.value_format && typeof style.value_format === 'string') {
      content = style.value_format;
    }

    // ✅ KEY FIX: Use DataSourceMixin.processTemplateForInitialRender like working version
    if (typeof content === 'string') {
      content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlay');
      return content;
    }

    // Handle templates in content
    if (TemplateProcessor.hasTemplates(content)) {
      content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlay');
      return content;
    }

    // Return content if we have it
    if (content) return content;

    // Try data source as last resort
    if (!dataSourceRef) {
      dataSourceRef = overlay.data_source || overlay._raw?.data_source || style.data_source;
    }
    if (dataSourceRef) {
      const dataSourceContent = DataSourceMixin.resolveDataSourceContent(dataSourceRef, style, 'TextOverlay');
      if (dataSourceContent !== null) {
        return dataSourceContent;
      } else {
        return `[Loading: ${dataSourceRef}]`;
      }
    }

    // No content found
    return content;
  }

  /**
   * Process templates in content with sourceData
   * Handles MSD template syntax: {data_source_name} or {data_source_name.key:format}
   * @private
   */
  _processTemplates(content, sourceData, overlayId) {
    if (!content || !sourceData) return content;

    try {
      // Replace each template: {data_source_name} or {data_source_name.key:format}
      const processed = content.replace(/\{([^}]+)\}/g, (match, template) => {
        try {
          // Parse template: data_source_name or data_source_name.key or data_source_name.key:format
          const [pathPart, formatPart] = template.split(':');
          const parts = pathPart.trim().split('.');
          const dataSourceName = parts[0];
          const key = parts.slice(1).join('.');

          // Look up value in sourceData
          const dataSourceValue = sourceData[dataSourceName];
          if (dataSourceValue === undefined) {
            cblcarsLog.debug(`[TextOverlay] Data source not found: ${dataSourceName}`);
            return match; // Keep template as-is
          }

          // Get the value (with optional key path)
          let value = dataSourceValue;
          if (key) {
            const keyParts = key.split('.');
            for (const part of keyParts) {
              if (value && typeof value === 'object') {
                value = value[part];
              } else {
                break;
              }
            }
          }

          // Apply format if specified
          if (formatPart && value !== null && value !== undefined) {
            value = this._applyFormat(value, formatPart.trim());
          }

          return value !== null && value !== undefined ? String(value) : match;
        } catch (e) {
          cblcarsLog.warn(`[TextOverlay] Error processing template ${match}:`, e);
          return match;
        }
      });

      return processed;
    } catch (error) {
      cblcarsLog.error(`[TextOverlay] Template processing failed for ${overlayId}:`, error);
      return content;
    }
  }

  /**
   * Apply format specification to a value
   * @private
   */
  _applyFormat(value, format) {
    try {
      const num = parseFloat(value);
      if (isNaN(num)) return value;

      // Handle common format specs
      if (format === '%') {
        return `${Math.round(num)}%`;
      } else if (format.match(/^\.\df$/)) {
        // .1f, .2f, etc - decimal places
        const decimals = parseInt(format.charAt(1));
        return num.toFixed(decimals);
      } else if (format === 'int') {
        return Math.round(num).toString();
      }

      return value;
    } catch (e) {
      return value;
    }
  }

  /**
   * Resolve content from data source
   * Helper method for _resolveTextContent
   * @private
   */
  _resolveDataSourceContent(dataSourceRef, style) {
    // This is a simplified version - full implementation would use DataSourceMixin
    // For now, return null to indicate data source resolution should happen elsewhere
    try {
      // Check if DataSourceMixin is available
      if (typeof DataSourceMixin !== 'undefined' && DataSourceMixin.resolveDataSourceContent) {
        return DataSourceMixin.resolveDataSourceContent(dataSourceRef, style, 'TextOverlay');
      }
    } catch (error) {
      cblcarsLog.debug(`[TextOverlay] Could not resolve data source ${dataSourceRef}:`, error);
    }
    return null;
  }

  /**
   * Resolve comprehensive text styling from configuration
   * Integrates token system for theme-aware styling
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
    const resolveToken = (themeTokenResolver && typeof themeTokenResolver.forComponent === 'function')
      ? themeTokenResolver.forComponent('text')
      : null;

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
      features: [] // Will be populated by _trackFeature calls
    };

    return textStyle;
  }

  /**
   * Resolve a style property with token support
   * @private
   */
  _resolveStyleProperty(value, tokenPath, resolveToken, defaultValue, scalingContext) {
    if (value === undefined || value === null) {
      // No value provided, use token or default
      if (resolveToken) {
        return resolveToken(tokenPath, defaultValue, scalingContext);
      }
      return defaultValue;
    }

    // Value provided - check if it's a token reference
    if (typeof value === 'string' && resolveToken && this._isTokenReference(value)) {
      return resolveToken(value, defaultValue, scalingContext);
    }

    // Use provided value as-is
    return value;
  }

  /**
   * Get scaling context for token resolution
   * @private
   */
  _getScalingContext(fallbackViewBox) {
    const effectiveViewBox = this.viewBox || fallbackViewBox || [0, 0, 1920, 1080];
    return {
      viewBox: effectiveViewBox,
      containerWidth: this.container ? this.container.getBoundingClientRect().width : effectiveViewBox[2]
    };
  }

  /**
   * Get default values for the renderer
   * @private
   */
  _getDefaultsForRenderer() {
    return {
      fontSize: 16,
      fontFamily: 'Antonio',
      color: 'var(--lcars-orange)',
      textAnchor: 'start',
      dominantBaseline: 'central'
    };
  }

  /**
   * Process actions for the text overlay
   * @private
   */
  _processActions(overlay, context) {
    try {
      const cardInstance = context.cardInstance || window.__msdCardInstance;

      if (!cardInstance) {
        cblcarsLog.debug(`[TextOverlay] No card instance available for actions`);
        return null;
      }

      cblcarsLog.debug(`[TextOverlay] 🎯 Processing actions for ${overlay.id}`, {
        hasTapAction: !!overlay.tap_action,
        hasHoldAction: !!overlay.hold_action,
        hasDoubleTapAction: !!overlay.double_tap_action,
        hasCardInstance: !!cardInstance
      });

      const actionConfig = ActionHelpers.buildActionConfig(overlay, cardInstance);

      cblcarsLog.debug(`[TextOverlay] 🎯 Action processing result for ${overlay.id}:`, {
        hasActionInfo: !!actionConfig,
        actionConfig,
        overlayId: overlay.id
      });

      return actionConfig;

    } catch (error) {
      cblcarsLog.warn(`[TextOverlay] Error processing actions for ${overlay.id}:`, error);
      return null;
    }
  }

  /**
   * Check if a string is a token reference
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    // Token references don't start with 'var(' or contain CSS variable syntax
    return !value.startsWith('var(') && !value.includes('--');
  }

  /**
   * Get a default value from configuration
   * @private
   */
  _getDefault(path, fallback) {
    // Simple default lookup - could be enhanced with ThemeManager integration
    const defaults = {
      'text.color': 'var(--lcars-orange)',
      'text.font_size': 16,
      'text.font_family': 'Antonio'
    };

    return defaults[path] || fallback;
  }

  /**
   * Render fallback text when core renderer fails
   * @private
   */
  _renderFallbackText(overlay, x, y) {
    const content = this._cachedTextContent || overlay.text || overlay.content || '[No Content]';
    const color = overlay.style?.color || 'var(--lcars-orange)';
    const fontSize = overlay.style?.font_size || overlay.style?.fontSize || 16;

    return {
      markup: `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}px">${content}</text>`,
      actionInfo: null,
      overlayId: overlay.id,
      isFallback: true
    };
  }
}
