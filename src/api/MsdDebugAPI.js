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
      // ROOT UTILITY METHODS
      // ==========================================

      /**
       * Display help information about available API methods
       *
       * @param {string} [topic] - Optional namespace to get specific help (e.g., 'perf', 'routing', 'data')
       *
       * @example
       * // Show all available namespaces
       * window.cblcars.debug.msd.help();
       *
       * // Show methods in a specific namespace
       * window.cblcars.debug.msd.help('perf');
       */
      help(topic) {
        const namespaces = {
          perf: {
            desc: 'Performance profiling and analysis',
            methods: ['summary()', 'slowestOverlays(n)', 'byRenderer()', 'byOverlay(id)', 'warnings()', 'timeline()', 'compare()']
          },
          routing: {
            desc: 'Routing and resolution debugging',
            methods: ['inspect(guid)', 'trace(guid)', 'analyze(guid)', 'listActive()', 'testMatch()']
          },
          data: {
            desc: 'Data context and subscription inspection',
            methods: ['context()', 'subscriptions()', 'inspect(entityId)', 'entities()', 'refresh()', 'trace(entityId)', 'history()', 'validate()']
          },
          styles: {
            desc: 'Style computation and inspection',
            methods: ['computed(guid)', 'effective(guid)', 'overrides(guid)', 'inheritance(guid)', 'cascade(guid)', 'validate(guid)']
          },
          charts: {
            desc: 'Chart data processing inspection',
            methods: ['inspect(guid)', 'trace(guid)', 'validate(guid)', 'compareSnapshots()']
          },
          rules: {
            desc: 'Rule evaluation and validation',
            methods: ['listActive(options)', 'evaluate()', 'trace()', 'validate()']
          },
          animations: {
            desc: 'Animation state and playback control',
            methods: ['list()', 'inspect(id)', 'control(id, action)', 'registry()']
          },
          packs: {
            desc: 'Pack compilation and management',
            methods: ['list()', 'inspect(packId)', 'compile()', 'validate()']
          },
          visual: {
            desc: 'Visual debugging and overlay inspection',
            methods: ['hud()', 'highlight(guid)', 'inspect(guid)', 'snapshot()', 'diff(before, after)', 'validate(guid)', 'toggleBorders()']
          },
          overlays: {
            desc: 'Overlay management and bulk operations',
            methods: ['list(filter)', 'inspect(id)', 'create()', 'update(id, changes)', 'remove(id)', 'bulkUpdate(selector, changes)', 'bulkRemove(selector)', 'bulkApplyTags(selector, tags)', 'validate(id)', 'export(filter)', 'import(data)']
          },
          pipeline: {
            desc: 'Pipeline execution and lifecycle control',
            methods: ['status()', 'lifecycle()', 'trace()', 'rerun()', 'getInstance()']
          }
        };

        if (!topic) {
          console.log('%c CB-LCARS Debug API Help ', 'background: #ff9900; color: #000; font-weight: bold; padding: 4px 8px;');
          console.log('\n%cAvailable namespaces:', 'font-weight: bold; color: #ff9900;');
          Object.entries(namespaces).forEach(([name, info]) => {
            console.log(`  %c${name}%c - ${info.desc}`, 'color: #66ccff; font-weight: bold', 'color: inherit');
          });
          console.log('\n%cUsage:', 'font-weight: bold; color: #ff9900;');
          console.log('  window.cblcars.debug.msd.help("namespace") - Show methods in a namespace');
          console.log('  window.cblcars.debug.msd.usage("namespace") - Show usage examples');
          console.log('\n%cExample:', 'font-weight: bold; color: #ff9900;');
          console.log('  msd.help("perf")  // Show performance methods');
          return;
        }

        const ns = namespaces[topic];
        if (!ns) {
          console.error(`Unknown namespace: "${topic}". Available: ${Object.keys(namespaces).join(', ')}`);
          return;
        }

        console.log(`%c ${topic} Namespace `, 'background: #ff9900; color: #000; font-weight: bold; padding: 4px 8px;');
        console.log(`\n${ns.desc}\n`);
        console.log('%cMethods:', 'font-weight: bold; color: #ff9900;');
        ns.methods.forEach(method => {
          console.log(`  msd.${topic}.${method}`);
        });
        console.log(`\n%cFor examples:%c msd.usage("${topic}")`, 'font-weight: bold; color: #ff9900', 'color: inherit');
      },

      /**
       * Show usage examples for API methods
       *
       * @param {string} [namespace] - Optional namespace to show examples for
       *
       * @example
       * // Show examples for all namespaces
       * window.cblcars.debug.msd.usage();
       *
       * // Show examples for specific namespace
       * window.cblcars.debug.msd.usage('perf');
       */
      usage(namespace) {
        const examples = {
          perf: [
            '// Get performance summary',
            'const perf = msd.perf.summary();',
            'console.log("Render time:", perf.total_render_time_ms, "ms");',
            '',
            '// Find slowest overlays',
            'const slow = msd.perf.slowestOverlays(5);',
            'slow.forEach(o => console.log(o.overlay_id, o.duration_ms + "ms"));'
          ],
          routing: [
            '// Inspect routing for a GUID',
            'msd.routing.inspect("my-button-guid");',
            '',
            '// Trace full resolution path',
            'msd.routing.trace("my-button-guid");',
            '',
            '// List all active routes',
            'msd.routing.listActive();'
          ],
          data: [
            '// View data context',
            'const ctx = msd.data.context();',
            'console.log("Entities:", ctx.entities);',
            '',
            '// Inspect specific entity',
            'msd.data.inspect("sensor.temperature");',
            '',
            '// Refresh data sources',
            'msd.data.refresh();'
          ],
          styles: [
            '// Get computed styles for GUID',
            'const styles = msd.styles.computed("my-button-guid");',
            '',
            '// Check style inheritance chain',
            'msd.styles.inheritance("my-button-guid");',
            '',
            '// Validate style configuration',
            'msd.styles.validate("my-button-guid");'
          ],
          charts: [
            '// Inspect chart data processing',
            'msd.charts.inspect("my-chart-guid");',
            '',
            '// Trace data transformation',
            'msd.charts.trace("my-chart-guid");',
            '',
            '// Validate chart configuration',
            'msd.charts.validate("my-chart-guid");'
          ],
          rules: [
            '// List all active rules',
            'msd.rules.listActive();',
            '',
            '// List with disabled rules included',
            'msd.rules.listActive({ includeDisabled: true });',
            '',
            '// Evaluate rules for current context',
            'msd.rules.evaluate();'
          ],
          animations: [
            '// List all animations',
            'const anims = msd.animations.list();',
            '',
            '// Inspect specific animation',
            'msd.animations.inspect("fade-in-1");',
            '',
            '// Control animation playback',
            'msd.animations.control("fade-in-1", "pause");',
            'msd.animations.control("fade-in-1", "play");'
          ],
          packs: [
            '// List all packs',
            'const packs = msd.packs.list();',
            '',
            '// Inspect specific pack',
            'msd.packs.inspect("my-pack-id");',
            '',
            '// Validate pack configuration',
            'msd.packs.validate();'
          ],
          visual: [
            '// Toggle HUD display',
            'msd.visual.hud();',
            '',
            '// Highlight element by GUID',
            'msd.visual.highlight("my-button-guid");',
            '',
            '// Take visual snapshot',
            'const snapshot = msd.visual.snapshot();',
            '',
            '// Toggle debug borders',
            'msd.visual.toggleBorders();'
          ],
          overlays: [
            '// List all overlays',
            'const all = msd.overlays.list();',
            '',
            '// Filter overlays by tag',
            'const buttons = msd.overlays.list({ tags: ["button"] });',
            '',
            '// Bulk update matching overlays',
            'msd.overlays.bulkUpdate({ tags: ["button"] }, { label_color: "#ff9900" });',
            '',
            '// Bulk apply tags',
            'msd.overlays.bulkApplyTags({ row: 1 }, ["top-row"]);'
          ],
          pipeline: [
            '// Get pipeline status',
            'const status = msd.pipeline.status();',
            'console.log("State:", status.state);',
            '',
            '// View lifecycle state',
            'msd.pipeline.lifecycle();',
            '',
            '// Re-run pipeline',
            'msd.pipeline.rerun();'
          ]
        };

        if (!namespace) {
          console.log('%c CB-LCARS Debug API Usage Examples ', 'background: #ff9900; color: #000; font-weight: bold; padding: 4px 8px;');
          console.log('\n%cQuick Start:', 'font-weight: bold; color: #ff9900;');
          console.log('  const msd = window.cblcars.debug.msd;  // Shorthand');
          console.log('  msd.help();                             // List all namespaces');
          console.log('  msd.help("perf");                       // Show perf methods');
          console.log('  msd.usage("perf");                      // Show perf examples');
          console.log('\n%cAvailable namespaces:', 'font-weight: bold; color: #ff9900;');
          console.log('  ' + Object.keys(examples).join(', '));
          console.log('\n%cTip:%c Use msd.usage("namespace") for specific examples', 'font-weight: bold; color: #ff9900', 'color: inherit');
          return;
        }

        const ex = examples[namespace];
        if (!ex) {
          console.error(`Unknown namespace: "${namespace}". Available: ${Object.keys(examples).join(', ')}`);
          return;
        }

        console.log(`%c ${namespace} Usage Examples `, 'background: #ff9900; color: #000; font-weight: bold; padding: 4px 8px;');
        console.log('\n' + ex.join('\n'));
        console.log(`\n%cFor method details:%c msd.help("${namespace}")`, 'font-weight: bold; color: #ff9900', 'color: inherit');
      },

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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const comparison = window.cblcars.debug.msd.perf.compare();
         */
        compare(baseline) {
          cblcarsLog.warn('[DebugAPI] perf.compare() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will enable A/B performance comparison between configs');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Compare render times between two configs',
              'Identify performance regressions',
              'A/B test optimization changes'
            ]
          };
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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const viz = window.cblcars.debug.msd.routing.visualize('button_1');
         */
        visualize(overlayId) {
          cblcarsLog.warn('[DebugAPI] routing.visualize() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will draw routing paths directly on the MSD');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Visual overlay of routing paths on MSD',
              'Interactive path exploration',
              'Highlight data flow bottlenecks'
            ]
          };
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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const history = window.cblcars.debug.msd.data.history('sensor.temp', 5);
         */
        history(entityId, n = 10) {
          cblcarsLog.warn('[DebugAPI] data.history() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will show historical entity state changes');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Track entity state history locally',
              'Integration with HA history API',
              'Show state change timeline'
            ],
            suggestion: 'Use Home Assistant history panel or logbook for now'
          };
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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const result = window.cblcars.debug.msd.rules.evaluate('rule_1');
         */
        evaluate(ruleId) {
          cblcarsLog.warn('[DebugAPI] rules.evaluate() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will test rule evaluation against current state');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Test rule evaluation in isolation',
              'Preview rule outcomes',
              'Debug rule conditions'
            ]
          };
        },

        /**
         * List active rules
         *
         * Returns currently active/enabled rules with detailed information.
         * Filters out disabled rules and provides rule metadata.
         *
         * @param {Object} options - Filter options
         * @param {boolean} options.includeDisabled - Include disabled rules (default: false)
         * @param {boolean} options.verbose - Include full rule details (default: false)
         * @returns {Array} Active rules
         *
         * @example
         * // Get only enabled rules
         * const active = window.cblcars.debug.msd.rules.listActive();
         *
         * // Get all rules including disabled
         * const all = window.cblcars.debug.msd.rules.listActive({ includeDisabled: true });
         *
         * // Get detailed rule information
         * const detailed = window.cblcars.debug.msd.rules.listActive({ verbose: true });
         */
        listActive(options = {}) {
          try {
            const { includeDisabled = false, verbose = false } = options;
            const dbg = window.__msdDebug;
            const config = dbg?.pipelineInstance?.config;
            const rules = config?.rules || [];

            // Filter based on enabled state
            let filteredRules = rules;
            if (!includeDisabled) {
              filteredRules = rules.filter(rule => rule.enabled !== false);
            }

            // Return full details if verbose, otherwise just summaries
            if (verbose) {
              return filteredRules;
            }

            // Return compact summary
            return filteredRules.map(rule => ({
              id: rule.id,
              enabled: rule.enabled !== false,
              conditions: rule.conditions?.length || 0,
              actions: rule.actions?.length || 0,
              description: rule.description || rule.id
            }));
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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const result = window.cblcars.debug.msd.rules.debugRule('rule_1', testState);
         */
        debugRule(ruleId, state) {
          cblcarsLog.warn('[DebugAPI] rules.debugRule() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will enable step-by-step rule debugging with test state');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Test rules with mock state',
              'Step through rule evaluation',
              'Preview actions without executing'
            ]
          };
        }
      },

      // ==========================================
      // ANIMATIONS
      // ==========================================

      animations: {
        /**
         * Get active animations
         *
         * Returns list of currently running animations across all overlays.
         *
         * @returns {Array} Active animations with overlay, state, and progress info
         *
         * @example
         * const active = window.cblcars.debug.msd.animations.active();
         * active.forEach(anim => console.log(anim.overlayId, anim.state, anim.progress));
         */
        active() {
          try {
            const dbg = window.__msdDebug;
            const animationManager = dbg?.pipelineInstance?.systemsManager?.animationManager;

            if (!animationManager) {
              cblcarsLog.warn('[DebugAPI] AnimationManager not available');
              return [];
            }

            return animationManager.getActiveAnimations();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting active animations:', error);
            return [];
          }
        },

        /**
         * Dump all animation definitions
         *
         * Returns complete animation configuration including custom presets,
         * overlay animations, and timelines.
         *
         * @returns {Object} Animation definitions
         *
         * @example
         * const dump = window.cblcars.debug.msd.animations.dump();
         * console.log('Custom presets:', dump.customPresets);
         * console.log('Overlay animations:', dump.overlayAnimations);
         * console.log('Timelines:', dump.timelines);
         */
        dump() {
          try {
            const dbg = window.__msdDebug;
            const animationManager = dbg?.pipelineInstance?.systemsManager?.animationManager;

            if (!animationManager) {
              cblcarsLog.warn('[DebugAPI] AnimationManager not available');
              return null;
            }

            return animationManager.getAllAnimationDefinitions();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error dumping animations:', error);
            return null;
          }
        },

        /**
         * Get AnimationRegistry statistics
         *
         * Returns cache performance metrics, hit rates, and stored animations.
         *
         * @returns {Object} Registry statistics
         *
         * @example
         * const stats = window.cblcars.debug.msd.animations.registryStats();
         * console.log('Cache hit rate:', stats.hitRate);
         * console.log('Stored animations:', stats.size);
         */
        registryStats() {
          try {
            const dbg = window.__msdDebug;
            const registry = dbg?.pipelineInstance?.systemsManager?.animRegistry;

            if (!registry) {
              cblcarsLog.warn('[DebugAPI] AnimationRegistry not available');
              return null;
            }

            return registry.getStats();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting registry stats:', error);
            return null;
          }
        },

        /**
         * Inspect overlay animations
         *
         * Returns detailed animation state for a specific overlay including
         * scope info, active animations, and registered triggers.
         *
         * @param {string} overlayId - Overlay identifier
         * @returns {Object|null} Overlay animation state
         *
         * @example
         * const state = window.cblcars.debug.msd.animations.inspect('cpu_status');
         * console.log('Scope:', state.scope);
         * console.log('Active animations:', state.activeAnimations);
         * console.log('Triggers:', state.triggers);
         */
        inspect(overlayId) {
          try {
            const dbg = window.__msdDebug;
            const animationManager = dbg?.pipelineInstance?.systemsManager?.animationManager;

            if (!animationManager) {
              cblcarsLog.warn('[DebugAPI] AnimationManager not available');
              return null;
            }

            return animationManager.inspectOverlay(overlayId);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error inspecting overlay:', error);
            return null;
          }
        },

        /**
         * Get timeline details
         *
         * Returns details for a specific animation timeline.
         *
         * @param {string} timelineId - Timeline ID
         * @returns {Object|null} Timeline details
         *
         * @example
         * const timeline = window.cblcars.debug.msd.animations.timeline('startup_sequence');
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
         * Trigger animation manually
         *
         * Manually trigger an animation for testing.
         *
         * @param {string} overlayId - Overlay identifier
         * @param {string} presetName - Animation preset name
         * @param {Object} [params] - Additional animation parameters
         * @returns {Object} Result object
         *
         * @example
         * window.cblcars.debug.msd.animations.trigger('cpu_status', 'pulse', { duration: 500 });
         */
        trigger(overlayId, presetName, params = {}) {
          try {
            const dbg = window.__msdDebug;
            const animationManager = dbg?.pipelineInstance?.systemsManager?.animationManager;

            if (!animationManager) {
              cblcarsLog.warn('[DebugAPI] AnimationManager not available');
              return {
                error: 'NO_ANIMATION_MANAGER',
                message: 'Animation system not initialized'
              };
            }

            const result = animationManager.playAnimation(overlayId, {
              preset: presetName,
              ...params,
              trigger_source: 'debug_api'
            });

            if (result) {
              cblcarsLog.debug(`[DebugAPI] Animation triggered: ${overlayId} / ${presetName}`);
              return { success: true, overlayId, preset: presetName, params };
            } else {
              return {
                error: 'ANIMATION_FAILED',
                message: 'Failed to trigger animation',
                overlayId,
                preset: presetName
              };
            }
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error triggering animation:', error);
            return {
              error: 'EXCEPTION',
              message: error.message
            };
          }
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
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * const order = window.cblcars.debug.msd.packs.order();
         */
        order() {
          cblcarsLog.warn('[DebugAPI] packs.order() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[DebugAPI] This will show pack merge order and provenance');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            plannedFeatures: [
              'Show pack loading order',
              'Track configuration provenance',
              'Identify override sources'
            ]
          };
        }
      },

      // ==========================================
      // VISUAL DEBUG CONTROLS (Phase 2)
      // ==========================================

      visual: {
        /**
         * Enable visual debug feature
         *
         * Shows visual debug overlays for anchors, bounding boxes, routing,
         * or performance metrics. Use 'all' to enable all features.
         *
         * @param {string} feature - Feature name or 'all'
         * @returns {boolean} Success status
         *
         * @example
         * // Enable bounding boxes
         * window.cblcars.debug.msd.visual.enable('bounding_boxes');
         *
         * // Enable all debug visuals
         * window.cblcars.debug.msd.visual.enable('all');
         *
         * // Enable specific feature
         * window.cblcars.debug.msd.visual.enable('anchors');
         * window.cblcars.debug.msd.visual.enable('routing');
         * window.cblcars.debug.msd.visual.enable('performance');
         */
        enable(feature) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.debug?.enable) {
              cblcarsLog.warn('[DebugAPI] Visual debug not available');
              return false;
            }

            dbg.debug.enable(feature);
            cblcarsLog.debug(`[DebugAPI] Enabled visual debug: ${feature}`);
            return true;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error enabling visual debug:', error);
            return false;
          }
        },

        /**
         * Disable visual debug feature
         *
         * Hides visual debug overlays for specified feature or all features.
         *
         * @param {string} feature - Feature name or 'all'
         * @returns {boolean} Success status
         *
         * @example
         * // Disable bounding boxes
         * window.cblcars.debug.msd.visual.disable('bounding_boxes');
         *
         * // Disable all debug visuals
         * window.cblcars.debug.msd.visual.disable('all');
         */
        disable(feature) {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.debug?.disable) {
              cblcarsLog.warn('[DebugAPI] Visual debug not available');
              return false;
            }

            dbg.debug.disable(feature);
            cblcarsLog.debug(`[DebugAPI] Disabled visual debug: ${feature}`);
            return true;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error disabling visual debug:', error);
            return false;
          }
        },

        /**
         * Toggle visual debug feature on/off
         *
         * Convenient method to toggle a debug feature without checking current state.
         *
         * @param {string} feature - Feature name to toggle
         * @returns {boolean} New state (true = enabled, false = disabled)
         *
         * @example
         * const newState = window.cblcars.debug.msd.visual.toggle('bounding_boxes');
         * console.log('Bounding boxes now:', newState ? 'enabled' : 'disabled');
         */
        toggle(feature) {
          try {
            const status = this.status();
            if (!status) return false;

            const isEnabled = status[feature];
            if (isEnabled) {
              this.disable(feature);
              return false;
            } else {
              this.enable(feature);
              return true;
            }
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error toggling visual debug:', error);
            return false;
          }
        },

        /**
         * Get visual debug status
         *
         * Returns current state of all visual debug features.
         *
         * @returns {Object|null} Debug feature status
         *
         * @example
         * const status = window.cblcars.debug.msd.visual.status();
         * console.log('Anchors enabled:', status.anchors);
         * console.log('Bounding boxes enabled:', status.bounding_boxes);
         * console.table(status);
         */
        status() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.debug?.getStatus) {
              cblcarsLog.warn('[DebugAPI] Visual debug status not available');
              return null;
            }

            return dbg.debug.getStatus();
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting visual debug status:', error);
            return null;
          }
        },

        /**
         * Get list of active visual debug features
         *
         * Returns array of currently enabled debug feature names.
         *
         * @returns {Array<string>} Active feature names
         *
         * @example
         * const active = window.cblcars.debug.msd.visual.getActive();
         * console.log('Active debug features:', active);
         * // ['bounding_boxes', 'anchors']
         */
        getActive() {
          try {
            const status = this.status();
            if (!status) return [];

            return Object.entries(status)
              .filter(([key, value]) => value === true && key !== 'scale')
              .map(([key]) => key);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting active features:', error);
            return [];
          }
        },

        /**
         * Refresh visual debug overlays
         *
         * Forces re-render of debug overlays to reflect current state.
         *
         * @returns {boolean} Success status
         *
         * @example
         * window.cblcars.debug.msd.visual.refresh();
         */
        refresh() {
          try {
            const dbg = window.__msdDebug;
            if (!dbg?.debug?.refresh) {
              cblcarsLog.warn('[DebugAPI] Visual debug refresh not available');
              return false;
            }

            dbg.debug.refresh();
            return true;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error refreshing visual debug:', error);
            return false;
          }
        }
      },

      // ==========================================
      // OVERLAY INTROSPECTION (Phase 2)
      // ==========================================

      overlays: {
        /**
         * Inspect overlay details
         *
         * Returns comprehensive overlay information including config,
         * bounding box, type, and validation status.
         *
         * @param {string} overlayId - Overlay ID
         * @returns {Object|null} Overlay details
         *
         * @example
         * const overlay = window.cblcars.debug.msd.overlays.inspect('button_1');
         * console.log('Type:', overlay.type);
         * console.log('BBox:', overlay.bbox);
         * console.log('Config:', overlay.config);
         */
        inspect(overlayId) {
          try {
            const dbg = window.__msdDebug;
            const pipelineInstance = dbg?.pipelineInstance;
            if (!pipelineInstance) {
              cblcarsLog.warn('[DebugAPI] Pipeline instance not available');
              return null;
            }

            const model = pipelineInstance.getResolvedModel?.();
            if (!model) return null;

            const overlay = model.overlays.find(o => o.id === overlayId);
            if (!overlay) return null;

            // Get renderer to access mountEl
            const renderer = pipelineInstance.systemsManager?.renderer;
            const root = renderer?.mountEl;

            // Import MsdIntrospection dynamically to get bbox
            const MsdIntrospection = window.MsdIntrospection;
            const bbox = MsdIntrospection ?
              MsdIntrospection.getOverlayBBox(overlayId, root) : null;

            return {
              id: overlayId,
              type: overlay.type,
              bbox,
              config: overlay,
              position: overlay.position,
              size: overlay.size,
              route: overlay.route,
              visible: overlay.visible !== false
            };
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error inspecting overlay:', error);
            return null;
          }
        },

        /**
         * Get overlay bounding box
         *
         * Returns x, y, width, height of overlay in SVG coordinates.
         *
         * @param {string} overlayId - Overlay ID
         * @returns {Object|null} Bounding box {x, y, w, h}
         *
         * @example
         * const bbox = window.cblcars.debug.msd.overlays.getBBox('button_1');
         * console.log(`Position: (${bbox.x}, ${bbox.y})`);
         * console.log(`Size: ${bbox.w} x ${bbox.h}`);
         */
        getBBox(overlayId) {
          try {
            const dbg = window.__msdDebug;
            const renderer = dbg?.pipelineInstance?.systemsManager?.renderer;
            const root = renderer?.mountEl;

            if (!root) {
              cblcarsLog.warn('[DebugAPI] Mount element not available');
              return null;
            }

            const MsdIntrospection = window.MsdIntrospection;
            if (!MsdIntrospection) {
              cblcarsLog.warn('[DebugAPI] MsdIntrospection not available');
              return null;
            }

            return MsdIntrospection.getOverlayBBox(overlayId, root);
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting bbox:', error);
            return null;
          }
        },

        /**
         * Get overlay transform
         *
         * Returns transform attribute if present (e.g., translate values).
         *
         * @param {string} overlayId - Overlay ID
         * @returns {Object|null} Transform data
         *
         * @example
         * const transform = window.cblcars.debug.msd.overlays.getTransform('status_grid_1');
         * if (transform.translate) {
         *   console.log(`Translate: (${transform.translate.x}, ${transform.translate.y})`);
         * }
         */
        getTransform(overlayId) {
          try {
            const dbg = window.__msdDebug;
            const renderer = dbg?.pipelineInstance?.systemsManager?.renderer;
            const root = renderer?.mountEl;

            if (!root) return null;

            const MsdIntrospection = window.MsdIntrospection;
            const svg = MsdIntrospection?.getOverlaysSvg(root);
            if (!svg) return null;

            const el = svg.getElementById?.(overlayId) || svg.querySelector(`#${CSS.escape(overlayId)}`);
            if (!el) return null;

            const transform = el.getAttribute('transform');
            if (!transform) return null;

            // Parse transform string
            const result = { raw: transform };

            // Parse translate
            const translateMatch = transform.match(/translate\s*\(\s*([^,\s]+)[\s,]+([^)]+)\)/);
            if (translateMatch) {
              result.translate = {
                x: parseFloat(translateMatch[1]),
                y: parseFloat(translateMatch[2])
              };
            }

            // Parse scale
            const scaleMatch = transform.match(/scale\s*\(\s*([^)]+)\)/);
            if (scaleMatch) {
              const values = scaleMatch[1].split(/[\s,]+/).map(parseFloat);
              result.scale = values.length === 1
                ? { x: values[0], y: values[0] }
                : { x: values[0], y: values[1] };
            }

            // Parse rotate
            const rotateMatch = transform.match(/rotate\s*\(\s*([^)]+)\)/);
            if (rotateMatch) {
              const values = rotateMatch[1].split(/[\s,]+/).map(parseFloat);
              result.rotate = values[0];
              if (values.length === 3) {
                result.rotateCenter = { x: values[1], y: values[2] };
              }
            }

            return result;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting transform:', error);
            return null;
          }
        },

        /**
         * Get overlay state (from data source)
         *
         * Returns current data/state for an overlay.
         *
         * @param {string} overlayId - Overlay ID
         * @returns {*} Overlay state/data
         *
         * @example
         * const state = window.cblcars.debug.msd.overlays.getState('temp_display');
         */
        getState(overlayId) {
          try {
            const dbg = window.__msdDebug;
            const pipelineInstance = dbg?.pipelineInstance;
            const model = pipelineInstance?.getResolvedModel?.();

            if (!model) return null;

            const overlay = model.overlays.find(o => o.id === overlayId);
            if (!overlay) return null;

            // Return the resolved data if available
            return overlay.data || overlay.state || null;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting overlay state:', error);
            return null;
          }
        },

        /**
         * Find overlays by type
         *
         * Returns all overlays matching the specified type.
         *
         * @param {string} type - Overlay type (e.g., 'button', 'text', 'status_grid')
         * @returns {Array} Matching overlays
         *
         * @example
         * const buttons = window.cblcars.debug.msd.overlays.findByType('button');
         * console.log('Found buttons:', buttons.length);
         * buttons.forEach(btn => console.log(btn.id));
         */
        findByType(type) {
          try {
            const dbg = window.__msdDebug;
            const model = dbg?.pipelineInstance?.getResolvedModel?.();

            if (!model) return [];

            return model.overlays
              .filter(o => o.type === type)
              .map(o => ({
                id: o.id,
                type: o.type,
                position: o.position,
                size: o.size
              }));
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error finding overlays by type:', error);
            return [];
          }
        },

        /**
         * Find overlays using entity
         *
         * Returns all overlays that reference a specific entity ID.
         *
         * @param {string} entityId - Entity ID
         * @returns {Array} Overlays using this entity
         *
         * @example
         * const overlays = window.cblcars.debug.msd.overlays.findByEntity('sensor.temperature');
         */
        findByEntity(entityId) {
          try {
            const dbg = window.__msdDebug;
            const model = dbg?.pipelineInstance?.getResolvedModel?.();

            if (!model) return [];

            return model.overlays
              .filter(o => {
                const route = o.route || o._raw?.route;
                return route && JSON.stringify(route).includes(entityId);
              })
              .map(o => ({
                id: o.id,
                type: o.type,
                route: o.route
              }));
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error finding overlays by entity:', error);
            return [];
          }
        },

        /**
         * Get overlay tree (hierarchy)
         *
         * Returns overlay structure as hierarchical tree.
         *
         * @returns {Array} Overlay tree
         *
         * @example
         * const tree = window.cblcars.debug.msd.overlays.tree();
         */
        tree() {
          try {
            const dbg = window.__msdDebug;
            const model = dbg?.pipelineInstance?.getResolvedModel?.();

            if (!model) return [];

            // Group by type for simple tree
            const byType = {};
            model.overlays.forEach(o => {
              if (!byType[o.type]) byType[o.type] = [];
              byType[o.type].push({ id: o.id, type: o.type });
            });

            return Object.entries(byType).map(([type, overlays]) => ({
              type,
              count: overlays.length,
              overlays
            }));
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting overlay tree:', error);
            return [];
          }
        },

        /**
         * List all overlays
         *
         * Returns array of all overlays with basic info.
         *
         * @returns {Array} All overlays
         *
         * @example
         * const all = window.cblcars.debug.msd.overlays.list();
         * console.log('Total overlays:', all.length);
         */
        list() {
          try {
            const dbg = window.__msdDebug;
            const model = dbg?.pipelineInstance?.getResolvedModel?.();

            if (!model) return [];

            return model.overlays.map(o => ({
              id: o.id,
              type: o.type,
              visible: o.visible !== false
            }));
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error listing overlays:', error);
            return [];
          }
        }
      },

      // ==========================================
      // PIPELINE INTROSPECTION (Phase 2)
      // ==========================================

      pipeline: {
        /**
         * Get pipeline stages
         *
         * Returns list of pipeline stages with their status.
         *
         * @returns {Array} Pipeline stages
         *
         * @example
         * const stages = window.cblcars.debug.msd.pipeline.stages();
         * stages.forEach(stage => {
         *   console.log(`${stage.name}: ${stage.status}`);
         * });
         */
        stages() {
          try {
            const dbg = window.__msdDebug;
            const pipelineInstance = dbg?.pipelineInstance;

            if (!pipelineInstance) return [];

            // Define known pipeline stages
            const stages = [
              { name: 'PipelineCore', status: 'complete', component: pipelineInstance },
              { name: 'SystemsManager', status: 'complete', component: pipelineInstance.systemsManager },
              { name: 'ModelBuilder', status: 'complete', component: pipelineInstance.systemsManager?.modelBuilder },
              { name: 'AdvancedRenderer', status: 'complete', component: pipelineInstance.systemsManager?.renderer }
            ];

            return stages.map(stage => ({
              name: stage.name,
              status: stage.component ? 'initialized' : 'not_initialized',
              hasErrors: false,
              timing: null // Could extract from provenance
            }));
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pipeline stages:', error);
            return [];
          }
        },

        /**
         * Get pipeline timing
         *
         * Returns timing information for pipeline execution.
         *
         * @returns {Object|null} Pipeline timing
         *
         * @example
         * const timing = window.cblcars.debug.msd.pipeline.timing();
         * console.log('Total time:', timing.total_ms, 'ms');
         */
        timing() {
          try {
            const dbg = window.__msdDebug;
            const config = dbg?.pipelineInstance?.config;

            if (!config?.__provenance) return null;

            const provenance = config.__provenance;
            const timing = {
              pipeline_core: provenance.pipeline_core,
              systems_manager: provenance.systems_manager,
              model_builder: provenance.model_builder,
              advanced_renderer: provenance.advanced_renderer,
              total_ms: null
            };

            // Calculate total if individual timings exist
            const times = Object.values(timing).filter(t => t?.duration_ms);
            if (times.length > 0) {
              timing.total_ms = times.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
            }

            return timing;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pipeline timing:', error);
            return null;
          }
        },

        /**
         * Get pipeline configuration
         *
         * Returns merged pipeline configuration.
         *
         * @returns {Object|null} Pipeline config
         *
         * @example
         * const config = window.cblcars.debug.msd.pipeline.config();
         * console.log('Anchors:', config.anchors);
         * console.log('ViewBox:', config.viewBox);
         */
        config() {
          try {
            const dbg = window.__msdDebug;
            return dbg?.pipelineInstance?.config || null;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pipeline config:', error);
            return null;
          }
        },

        /**
         * Get pipeline errors
         *
         * Returns any errors encountered during pipeline execution.
         *
         * @returns {Array} Pipeline errors
         *
         * @example
         * const errors = window.cblcars.debug.msd.pipeline.errors();
         * if (errors.length > 0) {
         *   errors.forEach(err => console.error(err.message));
         * }
         */
        errors() {
          try {
            const dbg = window.__msdDebug;
            const config = dbg?.pipelineInstance?.config;

            // Check validation errors
            const validation = config?.__validation || {};
            const errors = [];

            if (validation.errors?.length > 0) {
              errors.push(...validation.errors.map(e => ({
                stage: 'validation',
                type: 'validation_error',
                message: e.message || e,
                overlayId: e.overlayId
              })));
            }

            // Check config issues
            const issues = config?.__issues || [];
            if (issues.length > 0) {
              errors.push(...issues.map(i => ({
                stage: 'config',
                type: 'config_issue',
                message: i.message || i
              })));
            }

            return errors;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pipeline errors:', error);
            return [];
          }
        },

        /**
         * Re-run pipeline (trigger re-render)
         *
         * Forces pipeline to re-execute from current config.
         *
         * @returns {boolean} Success status
         *
         * @example
         * window.cblcars.debug.msd.pipeline.rerun();
         */
        rerun() {
          try {
            const dbg = window.__msdDebug;
            const pipelineInstance = dbg?.pipelineInstance;

            if (!pipelineInstance?.reRender) {
              cblcarsLog.warn('[DebugAPI] Pipeline rerun not available');
              return false;
            }

            pipelineInstance.reRender();
            cblcarsLog.debug('[DebugAPI] Pipeline re-run triggered');
            return true;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error re-running pipeline:', error);
            return false;
          }
        },

        /**
         * Get pipeline instance
         *
         * Returns raw pipeline instance for advanced debugging.
         *
         * @returns {Object|null} Pipeline instance
         *
         * @example
         * const pipeline = window.cblcars.debug.msd.pipeline.getInstance();
         */
        getInstance() {
          try {
            const dbg = window.__msdDebug;
            return dbg?.pipelineInstance || null;
          } catch (error) {
            cblcarsLog.error('[DebugAPI] Error getting pipeline instance:', error);
            return null;
          }
        }
      }
    };
  }
}
