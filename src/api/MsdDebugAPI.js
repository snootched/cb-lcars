/**
 * MsdDebugAPI - Debug and introspection API for CB-LCARS MSD
 *
 * Provides advanced debugging, introspection, and analysis tools for developers.
 * Accessible via window.cblcars.debug.msd namespace.
 *
 * Phase 1: Core debug functionality (performance, routing, data, styles, charts)
 *
 * @module api/MsdDebugAPI
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class MsdDebugAPI {
  /**
   * Create Debug API instance
   * @returns {Object} Debug API methods
   */
  static create() {
    return {
      // ==========================================
      // PERFORMANCE INTROSPECTION
      // ==========================================

      perf: {
        /**
         * Get comprehensive performance summary from last render
         *
         * Returns detailed breakdown of render stages, overlay timings,
         * and performance metrics.
         *
         * @returns {Object|null} Performance summary with stage breakdowns
         *
         * @example
         * const perf = window.cblcars.debug.msd.perf.summary();
         * console.log('Total render time:', perf.total_render_time_ms, 'ms');
         * console.log('Overlays:', perf.overlay_count);
         * console.log('Slowest:', perf.slowest_overlays);
         */
        summary() {
          try {
            // Delegate to existing DebugInterface method
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getPerformanceSummary !== 'function') {
              cblcarsLog.warn('[DebugAPI] Performance summary not available');
              return null;
            }

            return dbg.getPerformanceSummary();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting performance summary:', error);
            return null;
          }
        },

        /**
         * Get slowest overlays from last render
         *
         * Returns the N slowest rendering overlays with timing details.
         *
         * @param {number} [n=5] - Number of slowest overlays to return
         * @returns {Array|null} Array of slowest overlay performance data
         *
         * @example
         * const slowest = window.cblcars.debug.msd.perf.slowestOverlays(10);
         * slowest.forEach(ov => {
         *   console.log(`${ov.overlay_id}: ${ov.duration_ms}ms`);
         * });
         */
        slowestOverlays(n = 5) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getSlowestOverlays !== 'function') {
              cblcarsLog.warn('[DebugAPI] Slowest overlays not available');
              return null;
            }

            return dbg.getSlowestOverlays(n);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting slowest overlays:', error);
            return null;
          }
        },

        /**
         * Get performance breakdown by renderer/overlay type
         *
         * Groups performance data by overlay type (text, button, status_grid, etc.)
         * showing count, total time, average time per type.
         *
         * @returns {Object|null} Performance data grouped by type
         *
         * @example
         * const byType = window.cblcars.debug.msd.perf.byRenderer();
         * console.log('Status grids:', byType.status_grid);
         * console.log('Text overlays:', byType.text);
         */
        byRenderer() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getRendererPerformance !== 'function') {
              cblcarsLog.warn('[DebugAPI] Renderer performance not available');
              return null;
            }

            return dbg.getRendererPerformance();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting renderer performance:', error);
            return null;
          }
        },

        /**
         * Get performance data for a specific overlay
         *
         * Returns detailed timing information for a single overlay.
         *
         * @param {string} overlayId - Overlay ID to get performance for
         * @returns {Object|null} Performance data for the overlay
         *
         * @example
         * const perf = window.cblcars.debug.msd.perf.byOverlay('title_overlay');
         * console.log('Duration:', perf.duration_ms, 'ms');
         * console.log('Percentage:', perf.percentage_of_total, '%');
         */
        byOverlay(overlayId) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getOverlayPerformance !== 'function') {
              cblcarsLog.warn('[DebugAPI] Overlay performance not available');
              return null;
            }

            return dbg.getOverlayPerformance(overlayId);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting overlay performance:', error);
            return null;
          }
        },

        /**
         * Get performance warnings for slow overlays
         *
         * Identifies overlays that are rendering slower than recommended
         * thresholds and provides warnings.
         *
         * @returns {Object|null} Performance warnings with details
         *
         * @example
         * const warnings = window.cblcars.debug.msd.perf.warnings();
         * if (warnings.has_warnings) {
         *   console.log('Warnings:', warnings.count);
         *   warnings.warnings.forEach(w => console.warn(w.message));
         * }
         */
        warnings() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getPerformanceWarnings !== 'function') {
              cblcarsLog.warn('[DebugAPI] Performance warnings not available');
              return null;
            }

            return dbg.getPerformanceWarnings();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting performance warnings:', error);
            return null;
          }
        },

        /**
         * Get render timeline (stage-by-stage breakdown)
         *
         * Returns timing breakdown for each render stage:
         * preparation, overlay rendering, DOM injection, action attachment.
         *
         * @returns {Object|null} Timeline of render stages
         *
         * @example
         * const timeline = window.cblcars.debug.msd.perf.timeline();
         * console.log('Stages:', timeline.stages);
         */
        timeline() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg || typeof dbg.getRenderTimeline !== 'function') {
              cblcarsLog.warn('[DebugAPI] Render timeline not available');
              return null;
            }

            return dbg.getRenderTimeline();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting render timeline:', error);
            return null;
          }
        },

        /**
         * Compare performance between renders (placeholder)
         *
         * @param {string} [baseline] - Baseline render identifier
         * @returns {Object|null} Comparison data
         *
         * @example
         * const comparison = window.cblcars.debug.msd.perf.compare();
         */
        compare(baseline) {
          cblcarsLog.warn('[DebugAPI] perf.compare() not yet implemented');
          return null;
        }
      },

      // ==========================================
      // ROUTING INTROSPECTION
      // ==========================================

      routing: {
        /**
         * Inspect routing resolution for an overlay
         *
         * Returns detailed routing path resolution showing how data flows
         * from entities to the overlay.
         *
         * @param {string} overlayId - Overlay ID to inspect
         * @returns {Object|null} Routing inspection data
         *
         * @example
         * const routing = window.cblcars.debug.msd.routing.inspect('button_1');
         * console.log('Route mode:', routing.route_mode);
         * console.log('Paths:', routing.paths);
         */
        inspect(overlayId) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.routing?.inspect) {
              cblcarsLog.warn('[DebugAPI] Routing inspect not available');
              return null;
            }

            return dbg.routing.inspect(overlayId);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error inspecting routing:', error);
            return null;
          }
        },

        /**
         * Get routing statistics
         *
         * Returns cache hits, paths computed, invalidations, and other
         * routing performance metrics.
         *
         * @returns {Object|null} Routing statistics
         *
         * @example
         * const stats = window.cblcars.debug.msd.routing.stats();
         * console.log('Cache hits:', stats.cacheHits);
         * console.log('Paths computed:', stats.pathsComputed);
         */
        stats() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.routing?.stats) {
              cblcarsLog.warn('[DebugAPI] Routing stats not available');
              return null;
            }

            return dbg.routing.stats();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting routing stats:', error);
            return null;
          }
        },

        /**
         * Invalidate routing cache
         *
         * Forces recomputation of routing paths. Use '*' to invalidate all,
         * or provide specific overlay ID to invalidate just that overlay.
         *
         * @param {string} [id='*'] - Overlay ID or '*' for all
         * @returns {boolean} Success status
         *
         * @example
         * // Invalidate all routing
         * window.cblcars.debug.msd.routing.invalidate();
         *
         * // Invalidate specific overlay
         * window.cblcars.debug.msd.routing.invalidate('button_1');
         */
        invalidate(id = '*') {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.routing?.invalidate) {
              cblcarsLog.warn('[DebugAPI] Routing invalidate not available');
              return false;
            }

            dbg.routing.invalidate(id);
            cblcarsLog.debug(`[DebugAPI] Invalidated routing cache: ${id}`);
            return true;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error invalidating routing:', error);
            return false;
          }
        },

        /**
         * Inspect overlay routing with different mode
         *
         * Temporarily changes the route_mode_full for an overlay and
         * inspects how it would be routed. Restores original mode after.
         *
         * @param {string} overlayId - Overlay ID to inspect
         * @param {string} [mode='smart'] - Route mode to test ('smart', 'full', 'minimal')
         * @returns {Object|null} Routing inspection with tested mode
         *
         * @example
         * const routing = window.cblcars.debug.msd.routing.inspectAs('button_1', 'full');
         * console.log('Full mode routing:', routing);
         */
        inspectAs(overlayId, mode = 'smart') {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.routing?.inspectAs) {
              cblcarsLog.warn('[DebugAPI] Routing inspectAs not available');
              return null;
            }

            return dbg.routing.inspectAs(overlayId, mode);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error in inspectAs:', error);
            return null;
          }
        },

        /**
         * Visualize routing paths (future enhancement)
         *
         * Will render visual representation of data flow paths.
         *
         * @param {string} [overlayId] - Overlay to visualize, or all if omitted
         * @returns {Object|null} Visualization data
         *
         * @example
         * const viz = window.cblcars.debug.msd.routing.visualize('button_1');
         */
        visualize(overlayId) {
          cblcarsLog.warn('[DebugAPI] routing.visualize() not yet implemented');
          return null;
        }
      },

      // ==========================================
      // DATA SOURCE INTROSPECTION
      // ==========================================

      data: {
        /**
         * Get data source statistics
         *
         * Returns statistics for all data sources including entity counts,
         * cache hits, updates, and source-specific metrics.
         *
         * @returns {Object|null} Data source statistics
         *
         * @example
         * const stats = window.cblcars.debug.msd.data.stats();
         * console.log('Sources:', stats.sources);
         * console.log('Total entities:', stats.totalEntities);
         */
        stats() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.dataSources?.stats) {
              cblcarsLog.warn('[DebugAPI] Data source stats not available');
              return null;
            }

            return dbg.dataSources.stats();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting data stats:', error);
            return null;
          }
        },

        /**
         * List all data source names
         *
         * Returns array of data source names (e.g., 'hass', 'manual', 'computed').
         *
         * @returns {Array<string>} Array of data source names
         *
         * @example
         * const sources = window.cblcars.debug.msd.data.list();
         * console.log('Available sources:', sources);
         */
        list() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.dataSources?.list) {
              cblcarsLog.warn('[DebugAPI] Data source list not available');
              return [];
            }

            return dbg.dataSources.list();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing data sources:', error);
            return [];
          }
        },

        /**
         * Get data source details by name
         *
         * Returns statistics and details for a specific data source.
         *
         * @param {string} sourceName - Data source name
         * @returns {Object|null} Data source details
         *
         * @example
         * const hass = window.cblcars.debug.msd.data.get('hass');
         * console.log('HASS entities:', hass.entityCount);
         */
        get(sourceName) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.dataSources?.get) {
              cblcarsLog.warn('[DebugAPI] Data source get not available');
              return null;
            }

            return dbg.dataSources.get(sourceName);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting data source:', error);
            return null;
          }
        },

        /**
         * Dump all data source information
         *
         * Returns comprehensive dump of all data sources with full details.
         *
         * @returns {Object|null} Complete data source dump
         *
         * @example
         * const dump = window.cblcars.debug.msd.data.dump();
         * console.log('Full data dump:', dump);
         */
        dump() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.dataSources?.dump) {
              cblcarsLog.warn('[DebugAPI] Data source dump not available');
              return null;
            }

            return dbg.dataSources.dump();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error dumping data sources:', error);
            return null;
          }
        },

        /**
         * Trace entity usage across overlays
         *
         * Shows which overlays reference a specific entity and how.
         *
         * @param {string} entityId - Entity ID to trace
         * @returns {Object|null} Entity trace data
         *
         * @example
         * const trace = window.cblcars.debug.msd.data.trace('sensor.temperature');
         * console.log('Used by overlays:', trace.overlays);
         */
        trace(entityId) {
          try {
            const dbg = window.__msdDebug;
            const dataManager = dbg?.pipelineInstance?.systemsManager?.dataSourceManager;

            if (!dataManager) {
              cblcarsLog.warn('[DebugAPI] DataSourceManager not available');
              return null;
            }

            // Get entity data
            const entity = dataManager.getEntity(entityId);
            if (!entity) {
              return { entityId, found: false, message: 'Entity not found' };
            }

            // Find overlays using this entity
            const model = dbg?.pipelineInstance?.getResolvedModel?.();
            const overlays = model?.overlays.filter(ov => {
              const route = ov.route || ov._raw?.route;
              return route && JSON.stringify(route).includes(entityId);
            }) || [];

            return {
              entityId,
              found: true,
              entity,
              usedByOverlays: overlays.map(ov => ({
                id: ov.id,
                type: ov.type,
                route: ov.route || ov._raw?.route
              }))
            };
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error tracing entity:', error);
            return null;
          }
        },

        /**
         * Get entity state history
         *
         * Returns recent state changes for an entity (if available).
         *
         * @param {string} entityId - Entity ID
         * @param {number} [n=10] - Number of history entries
         * @returns {Array|null} History entries
         *
         * @example
         * const history = window.cblcars.debug.msd.data.history('sensor.temp', 5);
         */
        history(entityId, n = 10) {
          cblcarsLog.warn('[DebugAPI] data.history() not yet fully implemented');
          // Would need integration with HA history or local state tracking
          return null;
        }
      },

      // ==========================================
      // STYLE INTROSPECTION
      // ==========================================

      styles: {
        /**
         * Get style resolution details for an overlay
         *
         * Shows how each style property was resolved (from theme tokens,
         * overlays, defaults, etc.) with full provenance.
         *
         * @param {string} overlayId - Overlay ID
         * @returns {Object|null} Style resolution data
         *
         * @example
         * const styles = window.cblcars.debug.msd.styles.resolutions('button_1');
         * console.log('Total properties:', styles.total);
         * console.log('By source:', styles.by_source);
         */
        resolutions(overlayId) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.getStyleResolutions) {
              cblcarsLog.warn('[DebugAPI] Style resolutions not available');
              return null;
            }

            return dbg.getStyleResolutions(overlayId);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting style resolutions:', error);
            return null;
          }
        },

        /**
         * Find overlays using a specific theme token
         *
         * Searches all overlays to find which ones reference a given
         * theme token path.
         *
         * @param {string} tokenPath - Token path (e.g., 'colors.primary')
         * @returns {Array|null} Overlays using this token
         *
         * @example
         * const overlays = window.cblcars.debug.msd.styles.findByToken('colors.primary');
         * overlays.forEach(ov => console.log(ov.overlayId, ov.properties));
         */
        findByToken(tokenPath) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.findOverlaysByToken) {
              cblcarsLog.warn('[DebugAPI] findOverlaysByToken not available');
              return null;
            }

            return dbg.findOverlaysByToken(tokenPath);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error finding overlays by token:', error);
            return null;
          }
        },

        /**
         * Get global style resolution summary
         *
         * Returns aggregate statistics across all overlays showing
         * resolution sources, renderer breakdown, and overlay type analysis.
         *
         * @returns {Object|null} Global style summary
         *
         * @example
         * const summary = window.cblcars.debug.msd.styles.provenance();
         * console.log('Total overlays:', summary.total_overlays);
         * console.log('By source:', summary.by_source);
         */
        provenance() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.getGlobalStyleSummary) {
              cblcarsLog.warn('[DebugAPI] Global style summary not available');
              return null;
            }

            return dbg.getGlobalStyleSummary();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting style provenance:', error);
            return null;
          }
        },

        /**
         * List all theme tokens (future enhancement)
         *
         * Will return all available theme tokens with their paths.
         *
         * @returns {Array|null} Theme tokens
         *
         * @example
         * const tokens = window.cblcars.debug.msd.styles.listTokens();
         */
        listTokens() {
          try {
            const theme = window.cblcars?.theme;
            if (!theme) {
              cblcarsLog.warn('[DebugAPI] Theme manager not available');
              return null;
            }

            // Get active theme and extract token paths
            const activeTheme = theme.getActiveTheme?.();
            if (!activeTheme) return null;

            // Recursively collect token paths
            const collectPaths = (obj, prefix = '') => {
              const paths = [];
              for (const [key, value] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  paths.push(...collectPaths(value, path));
                } else {
                  paths.push({ path, value });
                }
              }
              return paths;
            };

            return collectPaths(activeTheme);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing tokens:', error);
            return null;
          }
        },

        /**
         * Get resolved value for a theme token
         *
         * Returns the current resolved value for a token path.
         *
         * @param {string} tokenPath - Token path (e.g., 'colors.primary')
         * @returns {*} Token value
         *
         * @example
         * const color = window.cblcars.debug.msd.styles.getTokenValue('colors.primary');
         */
        getTokenValue(tokenPath) {
          try {
            const theme = window.cblcars?.theme;
            if (!theme) {
              cblcarsLog.warn('[DebugAPI] Theme manager not available');
              return null;
            }

            const activeTheme = theme.getActiveTheme?.();
            if (!activeTheme) return null;

            // Navigate token path
            const parts = tokenPath.split('.');
            let value = activeTheme;
            for (const part of parts) {
              if (value && typeof value === 'object') {
                value = value[part];
              } else {
                return null;
              }
            }

            return value;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting token value:', error);
            return null;
          }
        }
      },

      // ==========================================
      // CHART VALIDATION
      // ==========================================

      charts: {
        /**
         * Validate a specific chart overlay
         *
         * Validates ApexChart data format, series structure, and
         * data source compatibility.
         *
         * @param {string} overlayId - Chart overlay ID
         * @returns {Object|null} Validation result with errors/warnings
         *
         * @example
         * const result = window.cblcars.debug.msd.charts.validate('chart_1');
         * if (!result.valid) {
         *   result.errors.forEach(err => console.error(err.message));
         * }
         */
        validate(overlayId) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.charts?.validate) {
              cblcarsLog.warn('[DebugAPI] Chart validation not available');
              return null;
            }

            return dbg.charts.validate(overlayId);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error validating chart:', error);
            return null;
          }
        },

        /**
         * Validate all chart overlays
         *
         * Runs validation on all ApexChart overlays and returns
         * summary of results.
         *
         * @returns {Object|null} Validation summary
         *
         * @example
         * const summary = window.cblcars.debug.msd.charts.validateAll();
         * console.log(`Valid: ${summary.validCount}, Invalid: ${summary.invalidCount}`);
         */
        validateAll() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.charts?.validateAll) {
              cblcarsLog.warn('[DebugAPI] Chart validateAll not available');
              return null;
            }

            return dbg.charts.validateAll();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error validating all charts:', error);
            return null;
          }
        },

        /**
         * Get format specification for chart type
         *
         * Returns expected data format and structure requirements
         * for a specific chart type.
         *
         * @param {string} chartType - Chart type (e.g., 'line', 'area', 'bar')
         * @returns {Object|null} Format specification
         *
         * @example
         * const spec = window.cblcars.debug.msd.charts.getFormatSpec('line');
         */
        getFormatSpec(chartType) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.charts?.getFormatSpec) {
              cblcarsLog.warn('[DebugAPI] Chart getFormatSpec not available');
              return null;
            }

            return dbg.charts.getFormatSpec(chartType);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting format spec:', error);
            return null;
          }
        },

        /**
         * List supported chart types
         *
         * Returns array of supported ApexChart types.
         *
         * @returns {Array<string>} Chart types
         *
         * @example
         * const types = window.cblcars.debug.msd.charts.listTypes();
         */
        listTypes() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.charts?.listTypes) {
              // Return known types as fallback
              return ['line', 'area', 'bar', 'scatter', 'heatmap', 'candlestick',
                      'boxplot', 'radar', 'radialBar', 'pie', 'donut', 'polarArea'];
            }

            return dbg.charts.listTypes();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing chart types:', error);
            return [];
          }
        }
      },

      // ==========================================
      // RULES ENGINE
      // ==========================================

      rules: {
        /**
         * Get rules execution trace
         *
         * Returns trace of rules evaluation showing which rules fired,
         * conditions checked, and actions taken.
         *
         * @returns {Object|null} Rules trace data
         *
         * @example
         * const trace = window.cblcars.debug.msd.rules.trace();
         * console.log('Rules evaluated:', trace.evaluated);
         * console.log('Rules fired:', trace.fired);
         */
        trace() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.rules?.trace) {
              cblcarsLog.warn('[DebugAPI] Rules trace not available');
              return null;
            }

            return dbg.rules.trace();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting rules trace:', error);
            return null;
          }
        },

        /**
         * Evaluate specific rule (future enhancement)
         *
         * Test a rule against current state.
         *
         * @param {string} ruleId - Rule ID
         * @returns {Object|null} Evaluation result
         *
         * @example
         * const result = window.cblcars.debug.msd.rules.evaluate('rule_1');
         */
        evaluate(ruleId) {
          cblcarsLog.warn('[DebugAPI] rules.evaluate() not yet implemented');
          return null;
        },

        /**
         * List active rules (future enhancement)
         *
         * Returns currently active/enabled rules.
         *
         * @returns {Array} Active rules
         *
         * @example
         * const active = window.cblcars.debug.msd.rules.listActive();
         */
        listActive() {
          try {
            const dbg = window.__msdDebug;
            const config = dbg?.pipelineInstance?.config;
            return config?.rules || [];
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing active rules:', error);
            return [];
          }
        },

        /**
         * Debug specific rule with test state (future enhancement)
         *
         * @param {string} ruleId - Rule ID
         * @param {Object} state - Test state
         * @returns {Object|null} Debug result
         *
         * @example
         * const result = window.cblcars.debug.msd.rules.debugRule('rule_1', testState);
         */
        debugRule(ruleId, state) {
          cblcarsLog.warn('[DebugAPI] rules.debugRule() not yet implemented');
          return null;
        }
      },

      // ==========================================
      // ANIMATIONS
      // ==========================================

      animations: {
        /**
         * Get active animations
         *
         * Returns list of currently running or registered animations.
         *
         * @returns {Array|null} Active animations
         *
         * @example
         * const active = window.cblcars.debug.msd.animations.active();
         * active.forEach(anim => console.log(anim.id, anim.state));
         */
        active() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.animations?.active) {
              cblcarsLog.warn('[DebugAPI] Animations active not available');
              return null;
            }

            return dbg.animations.active();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting active animations:', error);
            return null;
          }
        },

        /**
         * Dump animation registry (future enhancement)
         *
         * Returns complete animation registry state.
         *
         * @returns {Object|null} Animation registry dump
         *
         * @example
         * const dump = window.cblcars.debug.msd.animations.dump();
         */
        dump() {
          try {
            const dbg = window.__msdDebug;
            const systemsManager = dbg?.pipelineInstance?.systemsManager;
            return systemsManager?.animRegistry || null;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error dumping animations:', error);
            return null;
          }
        },

        /**
         * Get timeline details (future enhancement)
         *
         * Returns details for a specific animation timeline.
         *
         * @param {string} timelineId - Timeline ID
         * @returns {Object|null} Timeline details
         *
         * @example
         * const timeline = window.cblcars.debug.msd.animations.timeline('tl_1');
         */
        timeline(timelineId) {
          try {
            const dbg = window.__msdDebug;
            const config = dbg?.pipelineInstance?.config;
            const timelines = config?.timelines || [];
            return timelines.find(tl => tl.id === timelineId) || null;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting timeline:', error);
            return null;
          }
        },

        /**
         * Trigger animation manually (future enhancement)
         *
         * Manually trigger an animation for testing.
         *
         * @param {string} animId - Animation ID
         * @returns {boolean} Success status
         *
         * @example
         * window.cblcars.debug.msd.animations.trigger('anim_1');
         */
        trigger(animId) {
          cblcarsLog.warn('[DebugAPI] animations.trigger() not yet implemented');
          return false;
        }
      },

      // ==========================================
      // PACKS (Configuration Packs)
      // ==========================================

      packs: {
        /**
         * List packs by type
         *
         * Returns count/list of configuration packs (animations, overlays,
         * rules, profiles, timelines).
         *
         * @param {string} [type] - Pack type or omit for counts
         * @returns {Object|Array} Pack counts or specific pack list
         *
         * @example
         * // Get counts
         * const counts = window.cblcars.debug.msd.packs.list();
         * console.log('Overlays:', counts.overlays);
         *
         * // Get specific type
         * const overlays = window.cblcars.debug.msd.packs.list('overlays');
         */
        list(type) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.packs?.list) {
              cblcarsLog.warn('[DebugAPI] Packs list not available');
              return type ? [] : {};
            }

            return dbg.packs.list(type);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing packs:', error);
            return type ? [] : {};
          }
        },

        /**
         * Get specific pack item
         *
         * Returns a specific item from a pack by type and ID.
         *
         * @param {string} type - Pack type (e.g., 'overlays', 'rules')
         * @param {string} id - Item ID
         * @returns {Object|null} Pack item
         *
         * @example
         * const overlay = window.cblcars.debug.msd.packs.get('overlays', 'button_1');
         */
        get(type, id) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.packs?.get) {
              cblcarsLog.warn('[DebugAPI] Packs get not available');
              return null;
            }

            return dbg.packs.get(type, id);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pack item:', error);
            return null;
          }
        },

        /**
         * Get configuration issues
         *
         * Returns validation issues found in configuration packs.
         *
         * @returns {Array|null} Configuration issues
         *
         * @example
         * const issues = window.cblcars.debug.msd.packs.issues();
         * issues.forEach(issue => console.error(issue.message));
         */
        issues() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.packs?.issues) {
              cblcarsLog.warn('[DebugAPI] Packs issues not available');
              return null;
            }

            return dbg.packs.issues();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pack issues:', error);
            return null;
          }
        },

        /**
         * Get pack loading order (future enhancement)
         *
         * Returns the order in which packs were loaded/merged.
         *
         * @returns {Array} Pack loading order
         *
         * @example
         * const order = window.cblcars.debug.msd.packs.order();
         */
        order() {
          cblcarsLog.warn('[DebugAPI] packs.order() not yet implemented');
          return [];
        }
      }
    };
  }
}
