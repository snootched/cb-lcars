/**
 * [ApexChartsOverlayRenderer] Render ApexCharts as positioned HTML overlays on MSD
 * 📊 Uses absolute positioning over the MSD SVG instead of foreignObject
 *
 * Architecture:
 * - Charts render in separate HTML div layer above MSD SVG
 * - Position calculated from MSD viewBox coordinates → screen pixels
 * - Maintains MSD integration (DataSources, attachment points, styling)
 * - Syncs position on viewport changes (resize, pan, zoom)
 * - Handles shadowRoot boundaries and Home Assistant header offset
 *
 * Key Features:
 * - Real-time DataSource subscriptions for live updates
 * - Proper coordinate conversion accounting for SVG viewBox scaling
 * - Viewport synchronization for responsive layouts
 * - Tooltip support with correct positioning
 * - Debug helpers for troubleshooting
 *
 * ✅ ENHANCED: Now includes provenance tracking (Phase 5.2A)
 * ✅ ENHANCED: Now includes style resolution tracking (Phase 5.2B)
 *
 * @module ApexChartsOverlayRenderer
 * @requires ApexChartsAdapter
 * @requires OverlayUtils
 * @requires cblcars-logging
 * @requires ApexCharts
 */

import { OverlayUtils } from './OverlayUtils.js';
import { ApexChartsAdapter } from '../charts/ApexChartsAdapter.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import ApexCharts from 'apexcharts';
import { chartTemplateRegistry } from '../templates/ChartTemplateRegistry.js';

export class ApexChartsOverlayRenderer {
  constructor() {
    this.charts = new Map();
    this.subscriptions = new Map();
    this.overlayDivs = new Map();
    this.overlayConfigs = new Map();
    this.resizeObserver = null;
    this.isInitialized = false;
    this.elements = null;
    this.shadowRoot = null;
    this.mountElement = null;

    // ✅ NEW: Initialize tracking properties for provenance
    this._trackingInitialized = false;

    // Resolve ThemeManager for style resolution
    this.themeManager = this._resolveThemeManager();

    // ✅ NEW: Phase 6 - Resolve StyleResolverService
    this.styleResolver = this._resolveStyleResolver();

    // ✅ NEW: Phase 6 - Log StyleResolver availability
    if (this.styleResolver) {
      cblcarsLog.debug('[ApexChartsOverlayRenderer] ✅ StyleResolverService available');
    } else {
      cblcarsLog.warn('[ApexChartsOverlayRenderer] ⚠️ StyleResolverService not available - using fallback resolution');
      cblcarsLog.debug('[ApexChartsOverlayRenderer] Checked:', {
        hasGlobal: !!(typeof window !== 'undefined' && window.cblcars?.styleResolver),
        hasPipeline: !!(typeof window !== 'undefined' && window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.styleResolver)
      });
    }
  }

  /**
   * Resolve ThemeManager from various sources
   *
   * @private
   * @returns {Object|null} ThemeManager instance or null if not found
   */
  _resolveThemeManager() {
    // 1. Global CB-LCARS namespace (preferred)
    if (typeof window !== 'undefined' && window.cblcars?.theme) {
      return window.cblcars.theme;
    }

    // 2. Pipeline instance via systemsManager
    if (typeof window !== 'undefined') {
      const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.themeManager) {
        return pipelineInstance.systemsManager.themeManager;
      }

      // 3. Direct pipeline access
      if (pipelineInstance?.themeManager) {
        return pipelineInstance.themeManager;
      }

      // 4. Systems manager global reference
      const systemsManager = window.cblcars.debug.msd?.systemsManager;
      if (systemsManager?.themeManager) {
        return systemsManager.themeManager;
      }
    }

    return null;
  }

  /**
   * Resolve StyleResolverService from various sources
   * ✅ NEW: Phase 6 - StyleResolverService resolution
   *
   * @private
   * @returns {Object|null} StyleResolverService instance or null
   */
  _resolveStyleResolver() {
    // Priority 1: Global CB-LCARS namespace
    if (typeof window !== 'undefined' && window.cblcars?.styleResolver) {
      return window.cblcars.styleResolver;
    }

    // Priority 2: Pipeline instance
    if (typeof window !== 'undefined') {
      const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.styleResolver) {
        return pipelineInstance.systemsManager.styleResolver;
      }
    }

    return null;
  }

  /**
   * Initialize the renderer with SVG and container elements
   * Must be called before any rendering operations
   * @param {Object} elements - {svg, overlayGroup, container}
   * @returns {Promise<void>}
   */
  async initialize(elements) {
    if (this.isInitialized) {
      cblcarsLog.debug('[ApexChartsOverlayRenderer] Already initialized');
      return;
    }

    if (this.initPromise) {
      cblcarsLog.debug('[ApexChartsOverlayRenderer] Initialization in progress, waiting...');
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Validate required elements
        if (!elements) {
          throw new Error('Elements object is required for initialization');
        }
        if (!elements.svg) {
          throw new Error('SVG element is required in elements object');
        }

        this.elements = elements;
        this.isInitialized = true;

        cblcarsLog.info('[ApexChartsOverlayRenderer] ✅ Initialized successfully', {
          hasSvg: !!elements.svg,
          hasOverlayGroup: !!elements.overlayGroup,
          hasContainer: !!elements.container
        });
      } catch (error) {
        cblcarsLog.error('[ApexChartsOverlayRenderer] ❌ Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Render ApexCharts overlay (returns empty SVG markup - actual rendering happens in DOM)
   * This returns a placeholder rect in the SVG for attachment point computation,
   * while the actual chart renders in an HTML div overlay
   *
   * ✅ ENHANCED: Now includes provenance tracking (Phase 5.2A)
   * ✅ ENHANCED: Now includes style resolution tracking (Phase 5.2B)
   *
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [x, y, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   * @returns {Object} {markup, provenance} - Placeholder markup and rendering metadata
   */
  static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const instance = ApexChartsOverlayRenderer._getInstance();

    // ✅ NEW: Initialize tracking if not already done (singleton pattern)
    if (!instance._trackingInitialized) {
      instance._defaultsAccessed = [];
      instance._renderStartTime = null;
      instance._featuresUsed = new Set();
      instance._styleResolutions = []; // ✅ NEW: Phase 5.2B
      instance._trackingInitialized = true;
    }

    // Reset tracking for this render
    instance._defaultsAccessed = [];
    instance._featuresUsed = new Set();
    instance._styleResolutions = []; // ✅ NEW: Phase 5.2B
    instance._renderStartTime = performance.now();

    // NEW: Apply chart template if specified (BEFORE any other processing)
    if (overlay.template) {
      const overlayWithTemplate = chartTemplateRegistry.applyTemplate(overlay);

      if (overlayWithTemplate !== overlay) {
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Applied template '${overlay.template}' to overlay ${overlay.id}`);
        overlay = overlayWithTemplate;

        // ✅ Track template usage
        instance._featuresUsed.add('chart_template');
      }
    }

    // ✅ Track data source usage
    if (overlay.source || overlay.data_source || overlay.sources) {
      instance._featuresUsed.add('data_source');
    }

    // ✅ Track chart type
    if (overlay.chart_type) {
      instance._featuresUsed.add(`chart_${overlay.chart_type}`);
    }

    // ✅ Track series configuration
    const sourceRef = overlay.source || overlay.data_source || overlay.sources;
    const isMultiSeries = Array.isArray(sourceRef);
    if (isMultiSeries) {
      instance._featuresUsed.add('multi_series');
    }

    // SAFETY CHECK: Lazy initialize on first render
    if (!instance.elements) {
      const svg = svgContainer?.tagName === 'svg' ? svgContainer : svgContainer?.querySelector('svg');
      if (!svg) {
        cblcarsLog.error('[ApexChartsOverlayRenderer] Cannot initialize: SVG not found');
        return {
          markup: '',
          provenance: {
            renderer: 'ApexChartsOverlayRenderer',
            extends_base: false,
            overlay_type: 'apexchart',
            error: 'svg_not_found',
            timestamp: Date.now()
          }
        };
      }

      // CRITICAL: Get shadowRoot and mountElement from pipeline
      const pipelineInstance = cardInstance?._config?.__msdDebug?.pipelineInstance ||
                               window.cblcars.debug.msd?.pipelineInstance;

      const shadowRoot = pipelineInstance?.shadowRoot ||
                        cardInstance?.shadowRoot ||
                        svg.getRootNode();

      const mountElement = pipelineInstance?.mountElement ||
                          shadowRoot?.host ||
                          svg.closest('ha-card');

      instance.elements = {
        svg,
        svgContainer,
        viewBox
      };
      instance.shadowRoot = shadowRoot;
      instance.mountElement = mountElement;
      instance.isInitialized = true;

      cblcarsLog.debug('[ApexChartsOverlayRenderer] ✅ Elements initialized on first render', {
        hasShadowRoot: !!shadowRoot,
        hasMountElement: !!mountElement
      });
    }

    // CRITICAL FIX: Check if chart already exists - UPDATE instead of CREATE
    const existingChart = instance.charts.get(overlay.id);
    const existingDiv = instance.overlayDivs.get(overlay.id);

    if (existingChart && existingDiv) {
      cblcarsLog.debug(`[ApexChartsOverlayRenderer] 🔄 Chart ${overlay.id} already exists - updating instead of creating`);

      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        ApexChartsOverlayRenderer.updateChartStyle(overlay.id, overlay, dataSourceManager);
      }

      const position = OverlayUtils.resolvePosition(overlay.position, anchors);
      if (!position) {
        return {
          markup: '',
          provenance: instance._buildProvenance(overlay.id, {
            error: 'invalid_position',
            existing_chart: true
          })
        };
      }

      const [x, y] = position;
      const size = overlay.size || [300, 150];
      const [width, height] = size;

      return {
        markup: `<g id="${overlay.id}"
                   data-overlay-id="${overlay.id}"
                   data-overlay-type="apexchart"
                   data-overlay-layer="html"
                   class="msd-apexchart-placeholder">
                  <rect x="${x}" y="${y}"
                        width="${width}" height="${height}"
                        fill="none" stroke="none"
                        pointer-events="none"
                        opacity="0"/>
                </g>`,
        provenance: instance._buildProvenance(overlay.id, {
          existing_chart: true,
          updated: true
        })
      };
    }

    // NEW CHART: Schedule creation
    cblcarsLog.debug(`[ApexChartsOverlayRenderer] 📊 Creating NEW chart for ${overlay.id}`);
    instance._scheduleChartCreation(overlay, anchors, viewBox, svgContainer, cardInstance);

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      return {
        markup: '',
        provenance: instance._buildProvenance(overlay.id, {
          error: 'invalid_position'
        })
      };
    }

    const [x, y] = position;
    const size = overlay.size || [300, 150];
    const [width, height] = size;

    return {
      markup: `<g id="${overlay.id}"
                 data-overlay-id="${overlay.id}"
                 data-overlay-type="apexchart"
                 data-overlay-layer="html"
                 class="msd-apexchart-placeholder">
                <rect x="${x}" y="${y}"
                      width="${width}" height="${height}"
                      fill="none" stroke="none"
                      pointer-events="none"
                      opacity="0"/>
              </g>`,
      provenance: instance._buildProvenance(overlay.id, {
        chart_type: overlay.chart_type,
        series_count: isMultiSeries ? sourceRef.length : 1,
        size: [width, height]
      })
    };
  }

  /**
   * ✅ NEW: Track style resolution for provenance (Phase 5.2B)
   * @private
   * @param {string} property - Property name being resolved
   * @param {Object} resolution - Resolution tracking object
   */
  _trackStyleResolution(property, resolution) {
    if (!this._styleResolutions) {
      this._styleResolutions = [];
    }

    this._styleResolutions.push({
      property,
      source: resolution.source,
      value: resolution.resolved,
      explicitValue: resolution.explicitValue,
      themeDefault: resolution.themeDefault,
      adapterDefault: resolution.adapterDefault,
      timestamp: performance.now()
    });
  }

  /**
   * Resolve chart style property with StyleResolverService
   * ✅ ENHANCED: Phase 6 - Now uses StyleResolverService when available
   *
   * @private
   * @param {string} property - Property name
   * @param {*} explicitValue - Explicit value from overlay config
   * @param {*} themeDefault - Default from theme
   * @param {*} adapterDefault - Fallback from ApexChartsAdapter
   * @returns {*} Resolved value
   */
  _resolveChartStyleProperty(property, explicitValue, themeDefault, adapterDefault) {
    // ✅ NEW: Phase 6 - Use StyleResolverService if available
    if (this.styleResolver) {
      try {
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] 🎨 Resolving '${property}' via StyleResolver for overlay ${this._currentOverlayId || 'unknown'}`);

        const result = this.styleResolver.resolveProperty({
          property,
          value: explicitValue,
          tokenPath: `components.chart.${property}`,
          defaultValue: adapterDefault,
          context: {
            overlayId: this._currentOverlayId,
            componentType: 'apexchart'
          }
        });

        // Track for provenance
        this._trackStyleResolution(property, {
          source: result.source,
          value: result.value,
          explicitValue,
          themeDefault,
          adapterDefault
        });
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Resolved '${property}' = ${result.value} (source: ${result.source})`);

        return result.value;

      } catch (error) {
        cblcarsLog.warn('[ApexChartsOverlayRenderer] StyleResolver error, using fallback:', error);
        // Fall through to manual resolution
      }
    } else {
      cblcarsLog.debug(`[ApexChartsOverlayRenderer] ⚠️ Using fallback resolution for '${property}' (no StyleResolver)`);
    }

    // ✅ FALLBACK: Original manual resolution logic
    const resolution = {
      property,
      explicitValue,
      themeDefault,
      adapterDefault,
      resolved: null,
      source: null
    };

    // Priority 1: Explicit value from overlay config
    if (explicitValue !== undefined && explicitValue !== null) {
      resolution.resolved = explicitValue;
      resolution.source = 'explicit';
      this._trackStyleResolution(property, resolution);
      return explicitValue;
    }

    // Priority 2: Theme default
    if (themeDefault !== undefined && themeDefault !== null) {
      resolution.resolved = themeDefault;
      resolution.source = 'theme';
      this._trackStyleResolution(property, resolution);
      return themeDefault;
    }

    // Priority 3: Adapter default
    resolution.resolved = adapterDefault;
    resolution.source = 'adapter_default';
    this._trackStyleResolution(property, resolution);
    return adapterDefault;
  }

  /**
   * ✅ FIXED: Get chart style defaults from theme (Phase 5.2B)
   * Now directly accesses theme.components.chart instead of using getDefault
   *
   * @private
   * @returns {Object} Theme defaults for charts
   */
  _getChartStyleDefaults() {
    if (!this.themeManager || !this.themeManager.initialized) {
      cblcarsLog.debug('[ApexChartsOverlayRenderer] ThemeManager not initialized');
      return this._getFallbackChartDefaults();
    }

    try {
      const theme = this.themeManager.getActiveTheme();

      if (!theme) {
        cblcarsLog.debug('[ApexChartsOverlayRenderer] No active theme');
        return this._getFallbackChartDefaults();
      }

      // ✅ TIER 1: Try theme.components.chart (when you add it to tokens)
      if (theme.components && theme.components.chart) {
        cblcarsLog.debug('[ApexChartsOverlayRenderer] ✅ Using theme.components.chart');
        return {
          strokeColor: theme.components.chart.strokeColor,
          gridColor: theme.components.chart.gridColor,
          backgroundColor: theme.components.chart.backgroundColor,
          primaryColor: theme.components.chart.primaryColor,
          secondaryColor: theme.components.chart.secondaryColor,
          defaultColors: theme.components.chart.defaultColors,
          defaultStrokeWidth: theme.components.chart.defaultStrokeWidth
        };
      }

      // ✅ TIER 2: Use theme.colors.chart (works now)
      if (theme.colors && theme.colors.chart) {
        cblcarsLog.debug('[ApexChartsOverlayRenderer] ✅ Using theme.colors.chart (fallback)');
        return {
          strokeColor: theme.colors.chart.axis,
          gridColor: theme.colors.chart.gridMuted || theme.colors.chart.grid,
          backgroundColor: 'transparent',
          defaultColors: theme.colors.chart.series,
          primaryColor: 'var(--lcars-orange, #FF9900)',
          secondaryColor: 'var(--lcars-blue, #9999FF)'
        };
      }

      // ✅ TIER 3: Explicit fallbacks
      cblcarsLog.debug('[ApexChartsOverlayRenderer] ⚠️ Using fallback defaults');
      return this._getFallbackChartDefaults();

    } catch (error) {
      cblcarsLog.warn('[ApexChartsOverlayRenderer] Error getting theme defaults:', error);
      return this._getFallbackChartDefaults();
    }
  }

  /**
   * ✅ NEW: Summarize style resolutions by source (Phase 5.2B)
   * @private
   * @returns {Object} Style resolution summary
   */
  _summarizeStyleResolutions() {
    if (!this._styleResolutions || this._styleResolutions.length === 0) {
      return {
        total: 0,
        by_source: {},
        properties: []
      };
    }

    const bySource = {};
    const properties = [];

    this._styleResolutions.forEach(resolution => {
      // Count by source
      if (!bySource[resolution.source]) {
        bySource[resolution.source] = 0;
      }
      bySource[resolution.source]++;

      // Track property details
      properties.push({
        property: resolution.property,
        source: resolution.source,
        value: resolution.value
      });
    });

    return {
      total: this._styleResolutions.length,
      by_source: bySource,
      properties: properties
    };
  }

  /**
   * ✅ ENHANCED: Build provenance object with style resolution (Phase 5.2B)
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Provenance object
   */
  _buildProvenance(overlayId, metadata = {}) {
    const renderDuration = this._renderStartTime ? performance.now() - this._renderStartTime : 0;

    // ✅ NEW: Summarize style resolutions
    const styleResolutionSummary = this._summarizeStyleResolutions();

    return {
      renderer: 'ApexChartsOverlayRenderer',
      extends_base: false, // Singleton pattern, doesn't extend BaseRenderer
      overlay_id: overlayId,
      overlay_type: 'apexchart',
      chart_type: metadata.chart_type || null,
      has_data_source: this._featuresUsed.has('data_source'),
      series_count: metadata.series_count || 0,
      features_used: Array.from(this._featuresUsed),
      style_resolution: styleResolutionSummary, // ✅ NEW: Phase 5.2B
      rendering_time_ms: renderDuration,
      timestamp: Date.now(),
      note: 'Chart renders in HTML overlay, not SVG',
      ...metadata
    };
  }

  /**
   * Calculate the actual rendered SVG content area within letterboxed container
   * When SVG uses preserveAspectRatio, it may be letterboxed (pillarbox or letterbox)
   * @private
   * @param {SVGElement} svg - SVG element
   * @returns {Object} {offsetX, offsetY, renderWidth, renderHeight}
   */
  _calculateSVGRenderArea(svg) {
    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    // Calculate aspect ratios
    const viewBoxAspect = viewBox.width / viewBox.height;
    const containerAspect = svgRect.width / svgRect.height;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (Math.abs(viewBoxAspect - containerAspect) < 0.01) {
      // No letterboxing - aspect ratios match
      renderWidth = svgRect.width;
      renderHeight = svgRect.height;
      offsetX = 0;
      offsetY = 0;
    } else if (containerAspect > viewBoxAspect) {
      // Pillarboxed (vertical black bars on sides) - width constrained
      // Height fills container, width is scaled down
      renderHeight = svgRect.height;
      renderWidth = renderHeight * viewBoxAspect;
      offsetX = (svgRect.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      // Letterboxed (horizontal black bars top/bottom) - height constrained
      // Width fills container, height is scaled down
      renderWidth = svgRect.width;
      renderHeight = renderWidth / viewBoxAspect;
      offsetX = 0;
      offsetY = (svgRect.height - renderHeight) / 2;
    }

    cblcarsLog.debug('[ApexChartsOverlayRenderer] SVG render area calculated:', {
      viewBox: { width: viewBox.width, height: viewBox.height, aspect: viewBoxAspect },
      container: { width: svgRect.width, height: svgRect.height, aspect: containerAspect },
      letterboxed: Math.abs(viewBoxAspect - containerAspect) >= 0.01,
      renderArea: { width: renderWidth, height: renderHeight },
      offset: { x: offsetX, y: offsetY },
      letterboxType: containerAspect > viewBoxAspect ? 'pillarbox' :
                     containerAspect < viewBoxAspect ? 'letterbox' : 'none'
    });

    return {
      offsetX,
      offsetY,
      renderWidth,
      renderHeight
    };
  }

  /**
   * Convert viewBox coordinates to screen coordinates relative to overlay container
   * CRITICAL FIX: Account for letterboxing when SVG aspect ratio doesn't match container
   * @private
   */
  _viewBoxToScreen(svg, viewBox, vbX, vbY, vbWidth, vbHeight) {
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = viewBox ||
      [0, 0, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height];

    // CRITICAL: Get actual render area accounting for letterboxing
    const renderArea = this._calculateSVGRenderArea(svg);

    // Calculate scale factors using ACTUAL render dimensions, not container dimensions
    const scaleX = renderArea.renderWidth / viewBoxWidth;
    const scaleY = renderArea.renderHeight / viewBoxHeight;

    // Position within viewBox, scaled to screen pixels, PLUS letterbox offset
    const screenLeft = ((vbX - viewBoxX) * scaleX) + renderArea.offsetX;
    const screenTop = ((vbY - viewBoxY) * scaleY) + renderArea.offsetY;
    const screenWidth = vbWidth * scaleX;
    const screenHeight = vbHeight * scaleY;

    cblcarsLog.debug('[ApexChartsOverlayRenderer] ViewBox to screen conversion:', {
      input: {
        viewBox: { x: vbX, y: vbY, w: vbWidth, h: vbHeight },
        viewBoxOrigin: { x: viewBoxX, y: viewBoxY, w: viewBoxWidth, h: viewBoxHeight }
      },
      renderArea: {
        width: renderArea.renderWidth,
        height: renderArea.renderHeight,
        offsetX: renderArea.offsetX,
        offsetY: renderArea.offsetY
      },
      scale: {
        x: scaleX,
        y: scaleY,
        match: Math.abs(scaleX - scaleY) < 0.01
      },
      output: {
        left: screenLeft,
        top: screenTop,
        width: screenWidth,
        height: screenHeight
      }
    });

    return {
      left: screenLeft,
      top: screenTop,
      width: screenWidth,
      height: screenHeight
    };
  }

  /**
   * Schedule chart creation in HTML overlay div
   * Uses retry logic to wait for DOM to be ready
   * ✅ ENHANCED: Now tracks style resolutions during chart creation (Phase 5.2B)
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   *
   */

_scheduleChartCreation(overlay, anchors, viewBox, svgContainer, cardInstance) {
  // Set current overlay ID for style resolution
  this._currentOverlayId = overlay.id;

  // ✅ IMMEDIATE: No retries, no waiting
  const attemptCreation = () => {
    // Basic validation
    if (!this.isInitialized || !this.elements) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] Not initialized`);
      return;
    }

    if (this.charts.has(overlay.id)) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] ⚠️ Chart ${overlay.id} already exists`);
      return;
    }

    const svg = this.elements.svg;
    if (!svg) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] SVG not found`);
      return;
    }

    // Get DataSourceManager
    const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                              window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

    if (!dataSourceManager) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] DataSourceManager not available`);
      return;
    }

    // Resolve position
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] Position could not be resolved: ${overlay.id}`);
      return;
    }

    const [vbX, vbY] = position;
    const size = overlay.size || [300, 150];
    const [vbWidth, vbHeight] = size;

    // Store overlay config for position updates
    this.overlayConfigs.set(overlay.id, {
      x: vbX,
      y: vbY,
      width: vbWidth,
      height: vbHeight,
      viewBox,
      overlay
    });

    try {
      const sourceRef = overlay.source || overlay.data_source || overlay.sources;
      const style = overlay.finalStyle || overlay.style || {};
      const isMultiSeries = Array.isArray(sourceRef);

      // Get theme defaults
      const themeDefaults = this._getChartStyleDefaults();

      // Resolve chart styles
      const resolvedChartStyles = {
        strokeColor: this._resolveChartStyleProperty(
          'strokeColor',
          style.color || style.stroke_color,
          themeDefaults.strokeColor,
          null
        ),
        gridColor: this._resolveChartStyleProperty(
          'gridColor',
          style.grid_color,
          themeDefaults.gridColor,
          '#e0e0e0'
        ),
        backgroundColor: this._resolveChartStyleProperty(
          'backgroundColor',
          style.background_color,
          themeDefaults.backgroundColor,
          'transparent'
        ),
        defaultColors: this._resolveChartStyleProperty(
          'defaultColors',
          style.colors,
          themeDefaults.defaultColors,
          null
        ),
        defaultStrokeWidth: this._resolveChartStyleProperty(
          'defaultStrokeWidth',
          style.stroke_width,
          themeDefaults.defaultStrokeWidth,
          2
        )
      };

      // Convert DataSource to series
      let series;
      if (isMultiSeries) {
        series = ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          seriesNames: style.series_names || style.seriesNames
        });
      } else {
        series = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          name: style.name
        });
      }

      // Validate series (validation happens in adapter now, but double-check)
      if (!series || series.length === 0) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] No valid series data for ${overlay.id}`);
        // Create empty chart placeholder
        series = [{ name: 'No Data', data: [] }];
      }

      // Calculate screen position
      const screenCoords = this._viewBoxToScreen(svg, viewBox, vbX, vbY, vbWidth, vbHeight);

      // Create overlay div
      const overlayDiv = this._createOverlayDiv(overlay.id, screenCoords, svg);
      if (!overlayDiv) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Failed to create overlay div for ${overlay.id}`);
        return;
      }

      // Merge resolved styles
      const enhancedStyle = {
        ...style,
        stroke_color: resolvedChartStyles.strokeColor || style.stroke_color,
        grid_color: resolvedChartStyles.gridColor || style.grid_color,
        background_color: resolvedChartStyles.backgroundColor || style.background_color,
        colors: resolvedChartStyles.defaultColors || style.colors,
        stroke_width: resolvedChartStyles.defaultStrokeWidth || style.stroke_width
      };

      // Check if we have actual data
      const hasData = series && series.length > 0 && series.some(s =>
        s.data && Array.isArray(s.data) && s.data.length > 0
      );

      // Generate ApexCharts options
      const options = ApexChartsAdapter.generateOptions(
        enhancedStyle,
        [Math.round(screenCoords.width), Math.round(screenCoords.height)],
        { hasData }
      );

      // Create chart
      const chart = new ApexCharts(overlayDiv, {
        ...options,
        series
      });

      // Render chart
      chart.render()
        .then(() => {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Chart rendered: ${overlay.id}`);

          // Store references
          this.charts.set(overlay.id, chart);
          this.overlayDivs.set(overlay.id, {
            div: overlayDiv,
            svg: svg,
            viewBox: viewBox,
            vbCoords: { x: vbX, y: vbY, width: vbWidth, height: vbHeight }
          });

          // Setup viewport sync
          this._setupViewportSync(overlay.id);

          // Register for debugging
          this._registerChartForDebugging(overlay.id, chart, overlayDiv, svg);

          // Subscribe to updates (no delay needed - chart is stable after render promise)
          this._subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay);
        })
        .catch(renderError => {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] ❌ Chart render failed for ${overlay.id}:`, renderError);

          if (overlayDiv) {
            overlayDiv.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff6666; font-family: Antonio, sans-serif; text-align: center; padding: 20px;">
                <div>
                  <div style="font-size: 18px; margin-bottom: 10px;">❌ Render Failed</div>
                  <div style="font-size: 12px; opacity: 0.8;">${renderError.message}</div>
                </div>
              </div>
            `;
          }

          this.charts.delete(overlay.id);
        });

    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] ❌ Chart creation failed: ${overlay.id}`, error);
    }
  };

  // Execute immediately (no setTimeout)
  attemptCreation();
}
  /**
   * Validate series data structure before chart creation
   * Prevents ApexCharts path morphing errors from undefined data
   *
   * @private
   * @param {Array} series - Series data array
   * @param {string} overlayId - Overlay ID for logging
   * @returns {Object} {valid: boolean, errors: Array<string>}
   */
  _validateSeriesData(series, overlayId) {
    const errors = [];

    // Check series exists
    if (!series || !Array.isArray(series)) {
      errors.push('Series must be an array');
      return { valid: false, errors };
    }

    if (series.length === 0) {
      errors.push('Series array is empty');
      return { valid: false, errors };
    }

    // Check each series
    series.forEach((s, index) => {
      if (!s) {
        errors.push(`Series[${index}] is null or undefined`);
        return;
      }

      if (!s.data) {
        errors.push(`Series[${index}] has no 'data' property`);
        return;
      }

      if (!Array.isArray(s.data)) {
        errors.push(`Series[${index}].data is not an array (type: ${typeof s.data})`);
        return;
      }

      // Check data points
      if (s.data.length === 0) {
        // Empty data is OK, just warn
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Series[${index}] has empty data array for ${overlayId}`);
        return;
      }

      // Validate first few data points
      const sampleSize = Math.min(3, s.data.length);
      for (let i = 0; i < sampleSize; i++) {
        const point = s.data[i];

        if (!point || typeof point !== 'object') {
          errors.push(`Series[${index}].data[${i}] is not an object (type: ${typeof point})`);
          continue;
        }

        if (point.x === undefined || point.x === null) {
          errors.push(`Series[${index}].data[${i}] has undefined/null 'x' value`);
        }

        if (point.y === undefined || point.y === null) {
          errors.push(`Series[${index}].data[${i}] has undefined/null 'y' value`);
        }

        if (typeof point.y !== 'number' || isNaN(point.y) || !isFinite(point.y)) {
          errors.push(`Series[${index}].data[${i}].y is not a valid number (value: ${point.y}, type: ${typeof point.y})`);
        }
      }
    });

    const valid = errors.length === 0;

    if (!valid) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] ⚠️ Series validation failed for ${overlayId}:`, {
        seriesCount: series.length,
        errors: errors,
        sampleData: series.slice(0, 2).map(s => ({
          name: s.name,
          dataLength: s.data?.length,
          firstPoints: s.data?.slice(0, 3)
        }))
      });
    }

    return { valid, errors };
  }

  /**
   * Create overlay container div for ApexCharts
   * CRITICAL FIX: Position container to match SVG exactly, accounting for parent positioning
   * @private
   */
  _createOverlayDiv(overlayId, screenCoords, svg) {
    // VALIDATION: Check initialization
    if (!this.isInitialized || !this.elements) {
      throw new Error('[ApexChartsOverlayRenderer] Not initialized - cannot create overlay div');
    }

    // CRITICAL: Use shadowRoot for querySelector instead of global document
    const root = this.shadowRoot || svg.getRootNode();

    // Get or create the overlay container
    let overlayContainer = svg.parentElement?.querySelector('.msd-apexchart-overlay-container');

    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'msd-apexchart-overlay-container';

      // CRITICAL FIX: Get SVG and parent positions
      const svgRect = svg.getBoundingClientRect();
      const parentElement = svg.parentElement;

      // Get parent's content box (excludes padding/border)
      const parentStyle = window.getComputedStyle(parentElement);
      const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
      const parentPaddingTop = parseFloat(parentStyle.paddingTop) || 0;
      const parentBorderLeft = parseFloat(parentStyle.borderLeftWidth) || 0;
      const parentBorderTop = parseFloat(parentStyle.borderTopWidth) || 0;

      // Calculate where SVG is within parent's content box
      const parentRect = parentElement.getBoundingClientRect();
      const svgOffsetLeft = (svgRect.left - parentRect.left) - parentPaddingLeft - parentBorderLeft;
      const svgOffsetTop = (svgRect.top - parentRect.top) - parentPaddingTop - parentBorderTop;

      overlayContainer.style.cssText = `
        position: absolute;
        left: ${svgOffsetLeft}px;
        top: ${svgOffsetTop}px;
        width: ${svgRect.width}px;
        height: ${svgRect.height}px;
        pointer-events: none;
        z-index: 100;
        overflow: visible;
      `;

      parentElement.appendChild(overlayContainer);

      cblcarsLog.debug('[ApexChartsOverlayRenderer] Created overlay container', {
        svgOffset: { left: svgOffsetLeft, top: svgOffsetTop },
        svgSize: { width: svgRect.width, height: svgRect.height },
        svgRect: {
          left: svgRect.left,
          top: svgRect.top
        },
        parentRect: {
          left: parentRect.left,
          top: parentRect.top
        },
        parentPadding: {
          left: parentPaddingLeft,
          top: parentPaddingTop
        },
        parentBorder: {
          left: parentBorderLeft,
          top: parentBorderTop
        },
        calculation: {
          rawOffset: {
            left: svgRect.left - parentRect.left,
            top: svgRect.top - parentRect.top
          },
          adjustedOffset: {
            left: svgOffsetLeft,
            top: svgOffsetTop
          }
        }
      });
    }

    // Create individual chart div
    const chartDiv = document.createElement('div');
    chartDiv.id = `apex-chart-overlay-${overlayId}`;
    chartDiv.className = 'msd-apexchart-overlay';
    chartDiv.style.cssText = `
      position: absolute;
      left: ${screenCoords.left}px;
      top: ${screenCoords.top}px;
      width: ${screenCoords.width}px;
      height: ${screenCoords.height}px;
      pointer-events: auto;
      z-index: 1;
    `;

    overlayContainer.appendChild(chartDiv);

    // ADDED: Detailed logging after chart div is in DOM
    setTimeout(() => {
      const chartRect = chartDiv.getBoundingClientRect();
      const containerRect = overlayContainer.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      cblcarsLog.debug('[ApexChartsOverlayRenderer] Chart div position verification', {
        overlayId,
        chartDiv: {
          computedStyle: {
            position: window.getComputedStyle(chartDiv).position,
            left: window.getComputedStyle(chartDiv).left,
            top: window.getComputedStyle(chartDiv).top,
            width: window.getComputedStyle(chartDiv).width,
            height: window.getComputedStyle(chartDiv).height
          },
          boundingRect: {
            left: chartRect.left,
            top: chartRect.top,
            right: chartRect.right,
            bottom: chartRect.bottom,
            width: chartRect.width,
            height: chartRect.height
          }
        },
        container: {
          computedStyle: {
            position: window.getComputedStyle(overlayContainer).position,
            left: window.getComputedStyle(overlayContainer).left,
            top: window.getComputedStyle(overlayContainer).top
          },
          boundingRect: {
            left: containerRect.left,
            top: containerRect.top,
            right: containerRect.right,
            bottom: containerRect.bottom
          }
        },
        svg: {
          boundingRect: {
            left: svgRect.left,
            top: svgRect.top,
            right: svgRect.right,
            bottom: svgRect.bottom
          }
        },
        offsets: {
          chartRelativeToContainer: {
            left: chartRect.left - containerRect.left,
            top: chartRect.top - containerRect.top
          },
          chartRelativeToSvg: {
            left: chartRect.left - svgRect.left,
            top: chartRect.top - svgRect.top
          },
          containerRelativeToSvg: {
            left: containerRect.left - svgRect.left,
            top: containerRect.top - svgRect.top
          }
        }
      });
    }, 50);

    return chartDiv;
  }

  /**
   * Setup viewport synchronization (resize, pan, zoom)
   * FIXED: Also update container position on viewport changes
   * @private
   */
  _setupViewportSync(overlayId) {
    const overlayInfo = this.overlayDivs.get(overlayId);
    if (!overlayInfo) return;

    const { svg } = overlayInfo;

    // Create resize observer if it doesn't exist
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        // CRITICAL FIX: Update container position first, then all charts
        this._updateOverlayContainerPosition();

        this.overlayDivs.forEach((info, id) => {
          this._updateOverlayPosition(id);
        });
      });
    }

    // Observe the SVG for size changes
    this.resizeObserver.observe(svg);

    // ADDED: Also observe the SVG's parent for layout changes (sidebar toggle)
    if (svg.parentElement) {
      this.resizeObserver.observe(svg.parentElement);
    }

    // Also listen for window resize
    const resizeHandler = () => {
      this._updateOverlayContainerPosition();
      this._updateOverlayPosition(overlayId);
    };
    window.addEventListener('resize', resizeHandler);

    if (!this._resizeHandlers) this._resizeHandlers = new Map();
    this._resizeHandlers.set(overlayId, resizeHandler);
  }

  /**
   * Update overlay container position when layout changes
   * CRITICAL: This must run before updating individual chart positions
   * @private
   */
  _updateOverlayContainerPosition() {
    if (!this.isInitialized || !this.elements || !this.elements.svg) {
      return;
    }

    const { svg } = this.elements;
    const overlayContainer = svg.parentElement?.querySelector('.msd-apexchart-overlay-container');

    if (!overlayContainer) {
      return;
    }

    // Recalculate container position based on current SVG position
    const svgRect = svg.getBoundingClientRect();
    const parentElement = svg.parentElement;
    const parentRect = parentElement.getBoundingClientRect();

    // Get parent's padding/border
    const parentStyle = window.getComputedStyle(parentElement);
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
    const parentPaddingTop = parseFloat(parentStyle.paddingTop) || 0;
    const parentBorderLeft = parseFloat(parentStyle.borderLeftWidth) || 0;
    const parentBorderTop = parseFloat(parentStyle.borderTopWidth) || 0;

    // Calculate where SVG is within parent's content box
    const svgOffsetLeft = (svgRect.left - parentRect.left) - parentPaddingLeft - parentBorderLeft;
    const svgOffsetTop = (svgRect.top - parentRect.top) - parentPaddingTop - parentBorderTop;

    // ADDED: Check if container position/size actually changed
    const currentLeft = parseFloat(overlayContainer.style.left) || 0;
    const currentTop = parseFloat(overlayContainer.style.top) || 0;
    const currentWidth = parseFloat(overlayContainer.style.width) || 0;
    const currentHeight = parseFloat(overlayContainer.style.height) || 0;

    const positionChanged = Math.abs(svgOffsetLeft - currentLeft) > 0.5 ||
                           Math.abs(svgOffsetTop - currentTop) > 0.5;
    const sizeChanged = Math.abs(svgRect.width - currentWidth) > 0.5 ||
                       Math.abs(svgRect.height - currentHeight) > 0.5;

    if (!positionChanged && !sizeChanged) {
      // No significant change, skip update
      return;
    }

    // Update container position and size
    overlayContainer.style.left = `${svgOffsetLeft}px`;
    overlayContainer.style.top = `${svgOffsetTop}px`;
    overlayContainer.style.width = `${svgRect.width}px`;
    overlayContainer.style.height = `${svgRect.height}px`;

    // ADDED: Enhanced logging with aspect ratio check
    const svgViewBox = svg.viewBox.baseVal;
    const viewBoxAspect = svgViewBox.width / svgViewBox.height;
    const rectAspect = svgRect.width / svgRect.height;
    const aspectMatch = Math.abs(viewBoxAspect - rectAspect) < 0.01;

    cblcarsLog.debug('[ApexChartsOverlayRenderer] Updated overlay container', {
      positionChanged,
      sizeChanged,
      svgOffset: { left: svgOffsetLeft, top: svgOffsetTop },
      svgSize: { width: svgRect.width, height: svgRect.height },
      svgViewBox: {
        x: svgViewBox.x,
        y: svgViewBox.y,
        width: svgViewBox.width,
        height: svgViewBox.height
      },
      aspectRatio: {
        viewBox: viewBoxAspect,
        rendered: rectAspect,
        match: aspectMatch,
        warning: !aspectMatch ? '⚠️ ASPECT RATIO MISMATCH - SVG may be letterboxed!' : null
      },
      changes: {
        left: svgOffsetLeft - currentLeft,
        top: svgOffsetTop - currentTop,
        width: svgRect.width - currentWidth,
        height: svgRect.height - currentHeight
      }
    });
  }

  /**
   * Update overlay position (called on resize, etc.)
   * FIXED: Also update chart dimensions when scale changes
   * @private
   */
  _updateOverlayPosition(overlayId) {
    const config = this.overlayConfigs.get(overlayId);
    if (!config) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] No config found for overlay: ${overlayId}`);
      return;
    }

    // CRITICAL: Use shadowRoot for querySelector instead of document.getElementById
    const root = this.shadowRoot || this.elements?.svg?.getRootNode() || document;
    const div = root.getElementById ?
                root.getElementById(`apex-chart-overlay-${overlayId}`) :
                root.querySelector(`#apex-chart-overlay-${overlayId}`);

    if (!div) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] No div found for overlay: ${overlayId}`);
      return;
    }

    // VALIDATION: Ensure elements initialized
    if (!this.isInitialized || !this.elements || !this.elements.svg) {
      cblcarsLog.error('[ApexChartsOverlayRenderer] Cannot update position: not initialized');
      return;
    }

    const { svg } = this.elements;

    // Convert viewBox coords to screen coords
    const viewBox = svg.viewBox.baseVal;
    const coords = this._viewBoxToScreen(
      svg,
      [viewBox.x, viewBox.y, viewBox.width, viewBox.height],
      config.x,
      config.y,
      config.width,
      config.height
    );

    // CRITICAL FIX: Check if dimensions changed significantly (scale change)
    const currentWidth = parseFloat(div.style.width) || 0;
    const currentHeight = parseFloat(div.style.height) || 0;
    const widthDiff = Math.abs(coords.width - currentWidth);
    const heightDiff = Math.abs(coords.height - currentHeight);
    const dimensionsChanged = widthDiff > 1 || heightDiff > 1; // More than 1px difference

    // Position div relative to the overlay container
    div.style.left = `${coords.left}px`;
    div.style.top = `${coords.top}px`;
    div.style.width = `${coords.width}px`;
    div.style.height = `${coords.height}px`;

    // Add extra height for x-axis labels if needed
    const minHeight = 177;
    if (coords.height < minHeight) {
      div.style.minHeight = `${minHeight}px`;
    }

    // CRITICAL FIX: If dimensions changed, update the ApexCharts instance
    if (dimensionsChanged) {
      const chart = this.charts.get(overlayId);
      if (chart) {
        try {
          // Update chart dimensions using ApexCharts API
          chart.updateOptions({
            chart: {
              width: Math.round(coords.width),
              height: Math.round(coords.height)
            }
          }, false, false); // Don't redraw, don't animate

          cblcarsLog.debug('[ApexChartsOverlayRenderer] Updated chart dimensions:', {
            overlayId,
            oldDimensions: { width: currentWidth, height: currentHeight },
            newDimensions: { width: coords.width, height: coords.height },
            diff: { width: widthDiff, height: heightDiff }
          });
        } catch (error) {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] Failed to update chart dimensions for ${overlayId}:`, error);
        }
      }
    }

    cblcarsLog.debug('[ApexChartsOverlayRenderer] Updated chart position:', {
      overlayId,
      coords,
      dimensionsChanged,
      finalStyle: {
        left: div.style.left,
        top: div.style.top,
        width: div.style.width,
        height: div.style.height
      }
    });
  }

  /**
   * Subscribe to DataSource updates for real-time chart updates
   * @private
   * @param {string|Array<string>} sourceRef - DataSource reference(s)
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} chart - ApexCharts instance
   * @param {Object} overlay - Overlay configuration
   */

  _subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay) {
    const sources = Array.isArray(sourceRef) ? sourceRef : [sourceRef];
    const unsubscribers = [];

    sources.forEach((source) => {
      if (!source) return;

      const { dataSource } = ApexChartsAdapter._resolveDataSourcePath(source, dataSourceManager);

      if (!dataSource) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] DataSource not found: ${source}`);
        return;
      }

      const unsubscribe = dataSource.subscribe(() => {
        try {
          const style = overlay.finalStyle || overlay.style || {};

          const newSeries = Array.isArray(sourceRef) ?
            ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
              time_window: style.time_window,
              max_points: style.max_points || 500,
              seriesNames: style.series_names || style.seriesNames
            }) :
            ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
              time_window: style.time_window,
              max_points: style.max_points || 500,
              name: style.name
            });

          if (newSeries && newSeries.length > 0) {
            // Validation already happened in convertToSeries
            chart.updateSeries(newSeries, true);
            cblcarsLog.debug(`[ApexChartsOverlayRenderer] 🔄 Updated chart ${overlay.id}`);
          }
        } catch (error) {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] ❌ Update failed for ${overlay.id}:`, error);
        }
      });

      unsubscribers.push(unsubscribe);
    });

    this.subscriptions.set(overlay.id, () => {
      unsubscribers.forEach(unsub => unsub());
    });
  }

  /**
   * Register chart for debugging
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} chart - ApexCharts instance
   * @param {HTMLElement} div - Overlay div element
   * @param {SVGElement} svg - SVG element
   */
  _registerChartForDebugging(overlayId, chart, div, svg) {
    if (typeof window === 'undefined') return;

    window.cblcars = window.cblcars || {};
    window.cblcars.debug = window.cblcars.debug || {};
    window.cblcars.debug.msd = window.cblcars.debug.msd || {};

    // ✅ PHASE 4: Move to _internal namespace
    if (!window.cblcars.debug.msd.pipelineInstance) {
      window.cblcars.debug.msd.pipelineInstance = {};
    }
    if (!window.cblcars.debug.msd.pipelineInstance._internal) {
      window.cblcars.debug.msd.pipelineInstance._internal = {};
    }
    if (!window.cblcars.debug.msd.pipelineInstance._internal.apexCharts) {
      window.cblcars.debug.msd.pipelineInstance._internal.apexCharts = {};
    }

    // ✅ PHASE 4: Deprecated - use pipelineInstance._internal.apexCharts
    window.cblcars.debug.msd.apexCharts = window.cblcars.debug.msd.apexCharts || {};

    const instance = this;

    const chartDebugInfo = {
      chart: chart,
      overlayDiv: div,
      svg: svg,
      overlayId: overlayId,
      getDimensions: () => {
        const overlayInfo = instance.overlayDivs.get(overlayId);
        return {
          viewBoxCoords: overlayInfo?.vbCoords,
          screenCoords: {
            left: parseFloat(div.style.left),
            top: parseFloat(div.style.top),
            width: parseFloat(div.style.width),
            height: parseFloat(div.style.height),
            rect: div.getBoundingClientRect()
          },
          apexInternal: {
            svgWidth: chart.w.globals.svgWidth,
            svgHeight: chart.w.globals.svgHeight,
            gridWidth: chart.w.globals.gridWidth,
            gridHeight: chart.w.globals.gridHeight
          },
          parentInfo: {
            tag: div.parentElement?.tagName,
            class: div.parentElement?.className,
            position: div.parentElement ? window.getComputedStyle(div.parentElement).position : null
          }
        };
      }
    };

    // ✅ PHASE 4: Assign to both old (deprecated) and new (_internal) locations
    window.cblcars.debug.msd.pipelineInstance._internal.apexCharts[overlayId] = chartDebugInfo;
    window.cblcars.debug.msd.apexCharts[overlayId] = chartDebugInfo;
  }

  /**
   * Compute attachment points for MSD overlay system
   * Returns viewBox coordinate points for connecting lines/overlays
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Element} container - Container element (unused for HTML overlays)
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @returns {Object|null} Attachment points in viewBox coordinates
   */
  static computeAttachmentPoints(overlay, anchors, container, viewBox = null) {
    if (!overlay || overlay.type !== 'apexchart') return null;

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) return null;

    const size = overlay.size || [300, 150];
    const [x, y] = position;
    const [width, height] = size;

    return {
      id: overlay.id,
      center: [x + width / 2, y + height / 2],
      bbox: {
        left: x,
        right: x + width,
        top: y,
        bottom: y + height,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2
      },
      points: {
        center: [x + width / 2, y + height / 2],
        left: [x, y + height / 2],
        right: [x + width, y + height / 2],
        top: [x + width / 2, y],
        bottom: [x + width / 2, y + height],
        topLeft: [x, y],
        topRight: [x + width, y],
        bottomLeft: [x, y + height],
        bottomRight: [x + width, y + height]
      },
      x,
      y
    };
  }

  /**
   * Cleanup chart instance and subscriptions
   * FIXED: Use shadowRoot for DOM cleanup
   * @static
   */
  static cleanup(overlayId) {
    const chart = ApexChartsOverlayRenderer._getInstance().charts.get(overlayId);
    if (chart) {
      try {
        chart.destroy();
        ApexChartsOverlayRenderer._getInstance().charts.delete(overlayId);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error destroying chart ${overlayId}:`, error);
      }
    }

    // Remove overlay div - use shadowRoot
    const overlayInfo = ApexChartsOverlayRenderer._getInstance().overlayDivs.get(overlayId);
    if (overlayInfo) {
      try {
        overlayInfo.div.remove();
        ApexChartsOverlayRenderer._getInstance().overlayDivs.delete(overlayId);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error removing overlay div ${overlayId}:`, error);
      }
    }

    // Unsubscribe from DataSource
    const unsubscribe = ApexChartsOverlayRenderer._getInstance().subscriptions.get(overlayId);
    if (unsubscribe) {
      try {
        unsubscribe();
        ApexChartsOverlayRenderer._getInstance().subscriptions.delete(overlayId);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error unsubscribing ${overlayId}:`, error);
      }
    }

    // Remove resize handler
    const handler = ApexChartsOverlayRenderer._getInstance()._resizeHandlers?.get(overlayId);
    if (handler) {
      window.removeEventListener('resize', handler);
      ApexChartsOverlayRenderer._getInstance()._resizeHandlers.delete(overlayId);
    }

    // Cleanup overlay config
    ApexChartsOverlayRenderer._getInstance().overlayConfigs.delete(overlayId);

    // Cleanup debug registry (both old and new locations)
    if (window.cblcars.debug.msd?.pipelineInstance?._internal?.apexCharts?.[overlayId]) {
      delete window.cblcars.debug.msd.pipelineInstance._internal.apexCharts[overlayId];
    }
    if (window.cblcars.debug.msd?.apexCharts?.[overlayId]) {
      delete window.cblcars.debug.msd.apexCharts[overlayId];
    }
  }

  /**
   * Cleanup all charts (called when card is removed)
   * FIXED: Use shadowRoot for querySelectorAll
   * @static
   */
  static cleanupAll() {
    const instance = ApexChartsOverlayRenderer._getInstance();

    const overlayIds = Array.from(instance.charts.keys());
    overlayIds.forEach(id => ApexChartsOverlayRenderer.cleanup(id));

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
      instance.resizeObserver = null;
    }

    // CRITICAL: Use shadowRoot for querySelectorAll instead of document
    const root = instance.shadowRoot || document;
    const containers = root.querySelectorAll ?
                      root.querySelectorAll('.msd-apexchart-overlay-container') :
                      [];

    containers.forEach(el => el.remove());

    // Reset shadow DOM references
    instance.shadowRoot = null;
    instance.mountElement = null;
  }

  /**
   * Update chart with new style configuration (called by rules engine)
   * This method is called when rules engine applies overlay patches
   * FIXED: Don't update dimensions on style patches - only update visual styling
   * @static
   * @param {string} overlayId - Overlay ID
   * @param {Object} overlay - Updated overlay configuration with finalStyle
   * @param {Object} dataSourceManager - DataSourceManager instance
   */
  static updateChartStyle(overlayId, overlay, dataSourceManager) {
    const instance = ApexChartsOverlayRenderer._getInstance();
    const chart = instance.charts.get(overlayId);

    if (!chart) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] Chart instance not found for update: ${overlayId}`);
        return;
    }

    try {
        // DEBUG: Log the entire overlay object to see what we're receiving
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] 📦 Full overlay object for ${overlayId}:`, {
          hasFinalStyle: !!overlay.finalStyle,
          hasStyle: !!overlay.style,
          finalStyleKeys: overlay.finalStyle ? Object.keys(overlay.finalStyle) : [],
          styleKeys: overlay.style ? Object.keys(overlay.style) : [],
          overlayKeys: Object.keys(overlay)
        });

        const style = overlay.finalStyle || overlay.style || {};
        const sourceRef = overlay.source || overlay.data_source || overlay.sources;

        // DEBUG: Log the incoming style patch to see what colors are being applied
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] 🎨 Style being used for ${overlayId}:`, {
          color: style.color,
          stroke_colors: style.stroke_colors,
          fill_colors: style.fill_colors,
          grid_color: style.grid_color,
          axis_color: style.axis_color,
          legend_color: style.legend_color,
          fill_opacity: style.fill_opacity,
          styleSource: overlay.finalStyle ? 'finalStyle' : (overlay.style ? 'style' : 'empty')
        });

        // FIXED: Get original size from stored overlayInfo, don't recalculate from DOM
        // This prevents cumulative rounding errors that cause chart growth
        const overlayInfo = instance.overlayDivs.get(overlayId);
        const size = overlayInfo?.vbCoords
          ? [Math.round(overlayInfo.vbCoords.width), Math.round(overlayInfo.vbCoords.height)]
          : (overlay.size || [300, 150]);

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Updating chart ${overlayId} with style:`, {
          size,
          styleKeys: Object.keys(style),
          hasColor: !!style.color,
          hasStrokeWidth: !!style.stroke_width,
          hasGridSettings: !!(style.show_grid || style.grid_lines),
          usingStoredSize: !!overlayInfo?.vbCoords
        });

        // Get current data in series format
        const isMultiSeries = Array.isArray(sourceRef);
        const series = isMultiSeries ?
          ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
            time_window: style.time_window,
            max_points: style.max_points || 500,
            seriesNames: style.series_names || style.seriesNames
          }) :
          ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
            time_window: style.time_window,
            max_points: style.max_points || 500,
            name: style.name
          });

        // Generate new options from updated style
        const updatedOptions = ApexChartsAdapter.generateOptions(style, size, {});

        // CRITICAL FIX: Remove chart dimensions from the update options
        // Chart dimensions should only be set during initial creation or viewport resize
        // Rule-based style updates should NOT change dimensions
        const optionsOnly = { ...updatedOptions };
        delete optionsOnly.series; // Remove series from options object

        // ADDED: Remove chart dimensions to prevent growth on style updates
        if (optionsOnly.chart) {
          delete optionsOnly.chart.width;
          delete optionsOnly.chart.height;
        }

        // Update chart options with redraw enabled
        // ApexCharts updateOptions() parameters:
        // 1. options - The options to update (will be deep-merged with existing)
        // 2. redrawPaths - true to redraw, false to skip
        // 3. animate - true to animate the update
        // 4. updateSyncedCharts - true to update synced charts (we don't use this)
        //
        // KEY: ApexCharts internally merges the options, so we only pass what changed
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] 📤 Calling updateOptions with:`, {
          optionKeys: Object.keys(optionsOnly),
          hasColors: !!optionsOnly.colors,
          hasStroke: !!optionsOnly.stroke,
          hasFill: !!optionsOnly.fill,
          hasMarkers: !!optionsOnly.markers,
          actualColors: optionsOnly.colors,
          actualStrokeColors: optionsOnly.stroke?.colors,
          actualFillColors: optionsOnly.fill?.colors,
          actualMarkerColors: optionsOnly.markers?.colors
        });

        // Call updateOptions with redraw=true to force visual update
        // animate=false to make the change instant (no animation delay)
        chart.updateOptions(optionsOnly, true, false);

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ updateOptions completed`);

        // Step 2: Update the series separately (only if series data changed)
        // For style-only updates, we can skip this step
        // chart.updateSeries(series, true); // Animate the series update

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Chart style updated: ${overlayId}`, {
          optionsUpdated: Object.keys(optionsOnly).length,
          seriesCount: series.length,
          seriesDataPoints: series[0]?.data?.length,
          dimensionsPreserved: true
        });

    } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Failed to update chart style for ${overlayId}:`, error);
    }
  }

  /**
   * Pre-flight validation for ApexCharts overlay requirements
   *
   * NOTE: This performs a quick static check for absolute minimum requirements
   * before expensive chart creation. For comprehensive schema validation,
   * use ValidationService which validates against the full overlay schema.
   *
   * This method exists because:
   * - It runs BEFORE chart instantiation (performance optimization)
   * - It checks renderer-specific requirements (data source, size)
   * - It provides immediate feedback without full validation overhead
   *
   * @static
   * @param {Object} overlay - Overlay configuration
   * @returns {Array<string>} Array of error messages (empty if valid)
   */
  static validateConfig(overlay) {
    const errors = [];

    if (!overlay.source && !overlay.data_source) {
      errors.push('Missing required field: source or data_source');
    }

    if (!overlay.size || !Array.isArray(overlay.size) || overlay.size.length !== 2) {
      errors.push('Invalid size: must be [width, height]');
    }

    if (!overlay.position || !Array.isArray(overlay.position) || overlay.position.length !== 2) {
      errors.push('Invalid position: must be [x, y]');
    }

    return errors;
  }

  /**
   * ✅ INCREMENTAL UPDATE SUPPORT
   * Indicates that this renderer supports incremental updates
   * @static
   * @returns {boolean} True if incremental updates are supported
   */
  static supportsIncrementalUpdate() {
    return true;
  }

  /**
   * ✅ INCREMENTAL UPDATE SUPPORT
   * Update an ApexChart overlay without full re-render
   *
   * This method updates only the visual styling (colors, stroke, grid, etc.)
   * without recreating the chart instance or resetting its state.
   *
   * @static
   * @param {Object} overlay - Updated overlay configuration with finalStyle/style changes
   * @param {HTMLElement} overlayElement - The HTML div containing the ApexChart
   * @param {Object} context - Update context with dataSourceManager, hass, patch
   * @returns {boolean} True if update succeeded, false if fallback needed
   */
  static updateIncremental(overlay, overlayElement, context) {
    const { dataSourceManager, patch } = context;

    cblcarsLog.debug('[ApexChartsOverlayRenderer] 🔄 Incremental update requested:', {
      overlayId: overlay.id,
      hasPatch: !!patch,
      patchStyleKeys: patch?.style ? Object.keys(patch.style) : [],
      overlayType: overlay.type
    });

    if (!dataSourceManager) {
      cblcarsLog.warn('[ApexChartsOverlayRenderer] ⚠️ No dataSourceManager in context - cannot update');
      return false;
    }

    try {
      // Use the existing updateChartStyle method
      ApexChartsOverlayRenderer.updateChartStyle(overlay.id, overlay, dataSourceManager);

      cblcarsLog.debug('[ApexChartsOverlayRenderer] ✅ Incremental update succeeded:', overlay.id);
      return true;

    } catch (error) {
      cblcarsLog.error('[ApexChartsOverlayRenderer] ❌ Incremental update failed:', overlay.id, error);
      return false;
    }
  }

  // Singleton pattern
  static _instance = null;

  static _getInstance() {
    if (!ApexChartsOverlayRenderer._instance) {
      ApexChartsOverlayRenderer._instance = new ApexChartsOverlayRenderer();
    }
    return ApexChartsOverlayRenderer._instance;
  }

  /**
   * Setup global debug helpers
   * FIXED: Use shadowRoot in debug helpers
   * @static
   */
  static setupGlobalHelpers() {
    if (typeof window === 'undefined') return;

    window.msdCharts = window.msdCharts || {};

    window.msdCharts.dimensions = (overlayId) => {
      const chartDebug = window.cblcars.debug.msd?.apexCharts?.[overlayId];
      if (!chartDebug) {
        console.error(`❌ Chart not found: ${overlayId}`);
        return null;
      }

      const dims = chartDebug.getDimensions();
      console.log('📊 Chart Dimensions for', overlayId, ':', dims);
      return dims;
    };

    window.msdCharts.list = () => {
      const charts = window.cblcars.debug.msd?.apexCharts || {};
      const chartIds = Object.keys(charts);
      console.log('📊 Available ApexCharts overlays:', chartIds);
      return chartIds;
    };

    window.msdCharts.findDiv = (overlayId) => {
      const instance = ApexChartsOverlayRenderer._getInstance();
      const root = instance.shadowRoot || document;

      // CRITICAL: Use shadowRoot for querySelector
      const div = root.getElementById ?
                  root.getElementById(`apex-chart-overlay-${overlayId}`) :
                  root.querySelector(`#apex-chart-overlay-${overlayId}`);

      if (div) {
        console.log('✅ Found div:', div);
        console.log('Parent:', div.parentElement);
        console.log('Computed style:', window.getComputedStyle(div));
        console.log('Bounding rect:', div.getBoundingClientRect());
        console.log('Root node:', div.getRootNode());
        console.log('Is in shadow DOM:', div.getRootNode() !== document);
      } else {
        console.error('❌ Div not found in shadowRoot');
        console.log('SearchRoot:', root);
      }
      return div;
    };

    console.log('✅ MSD Charts diagnostic tools loaded (HTML overlay mode)');
  }
}

// Auto-setup global helpers
if (typeof window !== 'undefined') {
  ApexChartsOverlayRenderer.setupGlobalHelpers();
}

export default ApexChartsOverlayRenderer;