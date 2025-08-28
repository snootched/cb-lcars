/**
 * Sparkline Renderer - Handles sparkline creation and data processing
 */

import { PositionResolver } from './PositionResolver.js';

export class SparklineRenderer {
  /**
   * Render a sparkline overlay with real data or status indicator
   * @param {Object} overlay - Sparkline overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} SVG markup for the sparkline
   */
  static render(overlay, anchors, viewBox) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[SparklineRenderer] Sparkline overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 60];
    const [width, height] = size;
    const style = overlay.finalStyle || overlay.style || {};
    const strokeColor = style.color || 'var(--lcars-yellow)';

    console.log(`[SparklineRenderer] Rendering sparkline overlay ${overlay.id} at (${x}, ${y}) size ${width}x${height}`);

    const dataResult = this.getHistoricalDataForSparkline(overlay.source);

    if (dataResult.status === 'OK' && dataResult.data) {
      const pathData = this.createSparklinePath(dataResult.data, { width, height });

      return `
        <g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" data-source="${overlay.source}">
          <g transform="translate(${x}, ${y})">
            <path d="${pathData}"
                  fill="none"
                  stroke="${strokeColor}"
                  stroke-width="${style.width || 2}"
                  vector-effect="non-scaling-stroke"/>
          </g>
        </g>
      `;
    } else {
      // Render LCARS-style status indicator
      return this.renderStatusIndicator(overlay, x, y, width, height, dataResult, strokeColor);
    }
  }

  /**
   * Generate fallback sparkline data when real data isn't available
   * @param {string} dataSourceName - Name of the data source
   * @returns {Array} Array of {timestamp, value} objects
   */
  static generateFallbackSparklineData(dataSourceName) {
    console.log(`[SparklineRenderer] 🔄 Generating fallback data for '${dataSourceName}'`);

    const now = Date.now();
    const demoData = [];
    const baseValue = dataSourceName.includes('cpu') ? 45 :
                     dataSourceName.includes('memory') ? 60 :
                     dataSourceName.includes('temp') ? 72 : 50;

    for (let i = 0; i < 20; i++) {
      const timeOffset = i * 0.5;
      const sineWave = Math.sin(timeOffset) * 15;
      const noise = (Math.random() - 0.5) * 8;

      demoData.push({
        timestamp: now - (19 - i) * 60000,
        value: Math.max(5, Math.min(95, baseValue + sineWave + noise))
      });
    }

    return demoData;
  }

  /**
   * ENHANCED: Get historical data with multiple fallback strategies
   * @param {string} dataSourceName - Name of the data source
   * @returns {Object} {data: Array|null, status: string, message: string}
   */
  static getHistoricalDataForSparkline(dataSourceName) {
    if (!dataSourceName) {
      return {
        data: null,
        status: 'NO_SOURCE',
        message: 'No data source specified'
      };
    }

    try {
      // Method 1: Try the real DataSourceManager through the pipeline
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        console.log(`[SparklineRenderer] 🔍 Checking DataSourceManager for '${dataSourceName}'`);

        // DEBUG: List all available sources for troubleshooting
        const availableSources = Array.from(dataSourceManager.sources.keys());
        console.log(`[SparklineRenderer] Available sources:`, availableSources);

        // FIXED: Use exact source name only - no variations
        const dataSource = dataSourceManager.getSource(dataSourceName);

        if (dataSource) {
          const currentData = dataSource.getCurrentData();
          console.log(`[SparklineRenderer] Source data for '${dataSourceName}':`, {
            bufferSize: currentData?.bufferSize || 0,
            historyReady: currentData?.historyReady,
            started: currentData?.started,
            historyLoaded: currentData?.stats?.historyLoaded || 0
          });

          if (currentData?.buffer) {
            const bufferData = currentData.buffer.getAll();
            console.log(`[SparklineRenderer] Raw buffer data for '${dataSourceName}':`, bufferData);

            if (bufferData && bufferData.length >= 2) {
              const historicalData = bufferData.map(point => ({
                timestamp: point.t,
                value: point.v
              }));

              console.log(`[SparklineRenderer] ✅ Found ${historicalData.length} data points for '${dataSourceName}'`);
              return {
                data: historicalData,
                status: 'OK',
                message: `${historicalData.length} data points`
              };
            } else if (bufferData && bufferData.length === 1) {
              console.log(`[SparklineRenderer] ⚠️ Only 1 data point available for '${dataSourceName}'`);
              return {
                data: null,
                status: 'INSUFFICIENT_DATA',
                message: 'Only 1 data point available (need 2+ for sparkline)'
              };
            } else {
              console.log(`[SparklineRenderer] ⚠️ Buffer exists but is empty for '${dataSourceName}'`);
              return {
                data: null,
                status: 'EMPTY_BUFFER',
                message: 'Buffer exists but contains no data'
              };
            }
          }

          // Data source exists but no buffer data
          console.log(`[SparklineRenderer] ⚠️ Data source '${dataSourceName}' found but no buffer`);
          return {
            data: null,
            status: 'NO_BUFFER',
            message: 'Data source found but no buffer available'
          };
        }

        // Data source not found in manager
        console.warn(`[SparklineRenderer] ❌ Source '${dataSourceName}' not found in DataSourceManager`);
        console.warn(`[SparklineRenderer] Available sources:`, availableSources);
        return {
          data: null,
          status: 'SOURCE_NOT_FOUND',
          message: `Source '${dataSourceName}' not found. Available: ${availableSources.join(', ')}`
        };
      }

      // DataSourceManager not available
      console.warn(`[SparklineRenderer] ❌ DataSourceManager not available`);
      return {
        data: null,
        status: 'MANAGER_NOT_AVAILABLE',
        message: 'DataSourceManager not available'
      };

    } catch (error) {
      console.error(`[SparklineRenderer] Error getting data for '${dataSourceName}':`, error);
      return {
        data: null,
        status: 'ERROR',
        message: `Error occurred: ${error.message}`
      };
    }
  }

  /**
   * Render LCARS-style status indicator for unavailable data
   */
  static renderStatusIndicator(overlay, x, y, width, height, dataResult, color) {
    const statusColors = {
      'NO_SOURCE': 'var(--lcars-red)',
      'MANAGER_OFFLINE': 'var(--lcars-red)',
      'INITIALIZING': 'var(--lcars-blue)',
      'STARTING': 'var(--lcars-blue)',
      'LOADING_HISTORY': 'var(--lcars-blue)',
      'SOURCE_NOT_FOUND': 'var(--lcars-orange)',
      'NO_BUFFER': 'var(--lcars-orange)',
      'NO_DATA': 'var(--lcars-blue)',
      'INSUFFICIENT_DATA': 'var(--lcars-blue)',
      'HISTORY_DISABLED': 'var(--lcars-orange)',
      'ERROR': 'var(--lcars-red)'
    };

    const statusMessages = {
      'NO_SOURCE': 'NO SOURCE',
      'MANAGER_NOT_AVAILABLE': 'OFFLINE',
      'SOURCE_NOT_FOUND': 'NOT FOUND',
      'NO_BUFFER': 'NO BUFFER',
      'EMPTY_BUFFER': 'NO DATA',
      'INSUFFICIENT_DATA': 'LOADING',
      'ERROR': 'ERROR'
    };

    const indicatorColor = statusColors[dataResult.status] || color;
    const indicatorText = statusMessages[dataResult.status] || 'UNKNOWN';
    const fontSize = Math.min(width / 8, height / 3, 14);

    // Add pulsing animation for loading states
    const loadingStates = ['INITIALIZING', 'STARTING', 'LOADING_HISTORY'];
    const isLoading = loadingStates.includes(dataResult.status);
    const animationProps = isLoading ? `
      <animate attributeName="opacity"
               values="0.3;1.0;0.3"
               dur="1s"
               repeatCount="indefinite"/>
    ` : `
      <animate attributeName="opacity"
               values="0.3;0.8;0.3"
               dur="2s"
               repeatCount="indefinite"/>
    `;

    return `
      <g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" data-source="${overlay.source || 'unknown'}" data-status="${dataResult.status}">
        <g transform="translate(${x}, ${y})">
          <!-- LCARS-style status border -->
          <rect width="${width}" height="${height}"
                fill="none"
                stroke="${indicatorColor}"
                stroke-width="2"
                stroke-dasharray="${isLoading ? '4,2' : '8,4'}"
                opacity="0.6">
            ${animationProps}
          </rect>

          <!-- Status text -->
          <text x="${width/2}" y="${height/2}"
                fill="${indicatorColor}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-family="var(--lcars-font-family, monospace)"
                font-size="${fontSize}"
                font-weight="bold">
            ${indicatorText}
          </text>

          <!-- Optional: small diagnostic text -->
          ${width > 120 ? `
          <text x="${width/2}" y="${height/2 + fontSize + 4}"
                fill="${indicatorColor}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-family="var(--lcars-font-family, monospace)"
                font-size="${Math.max(8, fontSize * 0.6)}"
                opacity="0.7">
            ${overlay.source || 'NO SOURCE ID'}
          </text>` : ''}
        </g>
      </g>
    `;
  }

  /**
   * Create SVG path data from historical data points
   * @param {Array} data - Array of {timestamp, value} objects
   * @param {Object} bounds - {width, height} of the sparkline area
   * @returns {string} SVG path data string
   */
  static createSparklinePath(data, bounds) {
    if (!data || data.length < 2) {
      return `M 0 ${bounds.height/2} L ${bounds.width} ${bounds.height/2}`;
    }

    const { width, height } = bounds;

    // Find data range
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Prevent division by zero

    // Create path
    const pathSegments = [];

    data.forEach((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((point.value - minValue) / valueRange) * height;

      if (index === 0) {
        pathSegments.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
      } else {
        pathSegments.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
    });

    return pathSegments.join(' ');
  }

  /**
   * Update sparkline data dynamically when data source changes
   * @param {Element} sparklineElement - The sparkline SVG element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New data from the data source
   */
  static updateSparklineData(sparklineElement, overlay, sourceData) {
    try {
      const pathElement = sparklineElement.querySelector('path');
      if (!pathElement) {
        console.warn('[SparklineRenderer] No path element found for update');
        return;
      }

      // Extract dimensions from the sparkline container
      const gElement = sparklineElement.querySelector('g[transform]');
      if (!gElement) {
        console.warn('[SparklineRenderer] No container element found for dimensions');
        return;
      }

      // Use overlay size as fallback
      const bounds = {
        width: overlay.size?.[0] || 200,
        height: overlay.size?.[1] || 60
      };

      // Convert source data to sparkline format
      let historicalData = [];

      if (sourceData.buffer && typeof sourceData.buffer.getAll === 'function') {
        // Real buffer data
        const bufferData = sourceData.buffer.getAll();
        historicalData = bufferData.map(point => ({
          timestamp: point.t,
          value: point.v
        }));
      } else if (sourceData.historicalData) {
        // Pre-formatted historical data
        historicalData = sourceData.historicalData;
      }

      if (historicalData.length > 1) {
        const newPathData = this.createSparklinePath(historicalData, bounds);
        pathElement.setAttribute('d', newPathData);

        console.log(`[SparklineRenderer] ✅ Updated sparkline ${overlay.id} with ${historicalData.length} points`);
      }

    } catch (error) {
      console.error('[SparklineRenderer] Error updating sparkline data:', error);
    }
  }

  /**
   * Debug method to diagnose data source and buffer issues
   * Call from console: SparklineRenderer.debugDataSource('your_source_name')
   */
  static debugDataSource(dataSourceName) {
    console.log(`🔍 Debugging data source: ${dataSourceName}`);
    console.log('================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dsm) {
      console.error('❌ DataSourceManager not available');
      return;
    }

    const source = dsm.getSource(dataSourceName);
    if (!source) {
      console.error(`❌ Source '${dataSourceName}' not found`);
      console.log('Available sources:', Array.from(dsm.sources.keys()));
      return;
    }

    console.log('✅ Source found:', source);

    // Handle different source object structures
    const config = source.config || source.cfg || source._config;
    const hassConnection = source.hass || window.hass;

    console.log('📋 Source config:', config);
    console.log('🏷️ Entity ID:', config?.entity);
    console.log('📊 History config:', config?.history);
    console.log('🔧 Source properties:', Object.keys(source));

    // Check current data - try different methods
    let currentData = null;
    if (typeof source.getCurrentData === 'function') {
      currentData = source.getCurrentData();
    } else if (typeof source.currentData !== 'undefined') {
      currentData = source.currentData;
    } else if (source.data) {
      currentData = source.data;
    }

    console.log('📈 Current data:', currentData);

    // Check buffer - might be directly on source or in currentData
    let buffer = null;
    if (currentData?.buffer) {
      buffer = currentData.buffer;
    } else if (source.buffer) {
      buffer = source.buffer;
    } else if (source._buffer) {
      buffer = source._buffer;
    }

    if (buffer) {
      console.log('🗂️ Buffer info:', {
        capacity: buffer.capacity,
        size: buffer._size || buffer.size,
        head: buffer._head || buffer.head,
        full: buffer._full || buffer.full,
        stats: buffer._stats || buffer.stats,
        lastPushTime: buffer._lastPushTime || buffer.lastPushTime,
        lastPushTimeFormatted: (buffer._lastPushTime || buffer.lastPushTime) ?
          new Date(buffer._lastPushTime || buffer.lastPushTime).toISOString() : 'Never',
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(buffer))
      });

      // Try to get data using different methods
      let bufferData = null;
      if (typeof buffer.getAll === 'function') {
        bufferData = buffer.getAll();
      } else if (typeof buffer.getData === 'function') {
        bufferData = buffer.getData();
      } else if (buffer.data) {
        bufferData = buffer.data;
      }

      console.log('📊 Buffer data:', bufferData);

      if (bufferData && bufferData.length > 0) {
        console.log('🎯 Sample data points:', bufferData.slice(0, 5));
      }
    } else {
      console.warn('⚠️ No buffer found');
    }

    // Check for different preload method names
    const preloadMethods = [
      'preloadHistory',
      'loadHistory',
      'startHistoryPreload',
      'initHistory'
    ];

    const foundPreloadMethods = preloadMethods.filter(method =>
      typeof source[method] === 'function'
    );

    if (foundPreloadMethods.length > 0) {
      console.log('🔄 History preload methods found:', foundPreloadMethods);
    } else {
      console.warn('⚠️ No preload methods found. Available methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(source))
          .filter(name => typeof source[name] === 'function')
      );
    }

    // Check Home Assistant connection
    if (hassConnection) {
      console.log('🏠 Home Assistant connected:', !!hassConnection.connected);
      console.log('🏠 HASS states available:', Object.keys(hassConnection.states || {}).length);

      const entityId = config?.entity;
      if (entityId && hassConnection.states?.[entityId]) {
        console.log(`🎯 Entity '${entityId}' current state:`, hassConnection.states[entityId]);
      } else if (entityId) {
        console.warn(`⚠️ Entity '${entityId}' not found in HASS states`);
      }
    } else {
      console.warn('⚠️ Home Assistant connection not available');
    }

    // Additional debugging - check if this is a real MsdDataSource
    console.log('🔍 Source constructor:', source.constructor.name);
    console.log('🔍 Source prototype methods:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(source))
        .filter(name => typeof source[name] === 'function')
    );

    return { source, currentData, buffer, config, hassConnection };
  }

  /**
   * Manually trigger history preload for a data source
   * Call from console: SparklineRenderer.triggerHistoryPreload('your_source_name')
   */
  static async triggerHistoryPreload(dataSourceName) {
    console.log(`🔄 Triggering history preload for: ${dataSourceName}`);
    console.log('==============================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dsm) {
      console.error('❌ DataSourceManager not available');
      return;
    }

    const source = dsm.getSource(dataSourceName);
    if (!source) {
      console.error(`❌ Source '${dataSourceName}' not found`);
      return;
    }

    const config = source.config || source.cfg;
    console.log('📋 Config:', config);

    // Check if history preload is enabled
    if (!config?.history?.preload) {
      console.warn('⚠️ History preload not enabled in config');
      return;
    }

    try {
      // Try to call the internal preload method
      if (typeof source._preloadHistory === 'function') {
        console.log('🚀 Calling _preloadHistory...');
        await source._preloadHistory();
        console.log('✅ _preloadHistory completed');
      } else if (typeof source.preloadHistory === 'function') {
        console.log('🚀 Calling preloadHistory...');
        await source.preloadHistory();
        console.log('✅ preloadHistory completed');
      } else {
        console.warn('⚠️ No preload method found');
      }

      // Check buffer after preload
      const buffer = source.buffer || source.getCurrentData()?.buffer;
      if (buffer) {
        console.log('📊 Buffer after preload:', {
          capacity: buffer.capacity,
          size: buffer._size || buffer.size || (typeof buffer.size === 'function' ? buffer.size() : 'unknown'),
          hasData: buffer.getAll ? !!buffer.getAll() : 'no getAll method'
        });

        if (buffer.getAll) {
          const data = buffer.getAll();
          console.log('📈 Buffer data after preload:', data?.length || 'null/empty');
          if (data && data.length > 0) {
            console.log('🎯 First few points:', data.slice(0, 3));
            console.log('🎯 Last few points:', data.slice(-3));
          }
        }
      }

      // Check getCurrentData
      const currentData = source.getCurrentData();
      console.log('📊 getCurrentData after preload:', currentData);

    } catch (error) {
      console.error('❌ Error during preload:', error);
    }

    return source;
  }

  /**
   * Test the sparkline data retrieval after attempting preload
   * Call from console: SparklineRenderer.testSparklineAfterPreload('your_source_name')
   */
  static async testSparklineAfterPreload(dataSourceName) {
    console.log(`🧪 Testing sparkline data for: ${dataSourceName}`);
    console.log('===============================================');

    // First trigger preload
    await this.triggerHistoryPreload(dataSourceName);

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test sparkline data retrieval
    const result = this.getHistoricalDataForSparkline(dataSourceName);
    console.log('🎯 Sparkline data result:', result);

    return result;
  }

  /**
   * Debug Home Assistant services and history availability
   * Call from console: SparklineRenderer.debugHomeAssistantServices()
   */
  static debugHomeAssistantServices() {
    console.log('🏠 Debugging Home Assistant Services');
    console.log('====================================');

    const hass = window.hass;
    if (!hass) {
      console.error('❌ Home Assistant not available');
      return;
    }

    console.log('✅ Home Assistant connected:', hass.connected);
    console.log('📋 Available services:');

    // Check for recorder and history related services
    const services = hass.services || {};
    const historyRelated = [];

    Object.keys(services).forEach(domain => {
      const domainServices = services[domain];
      console.log(`  ${domain}:`, Object.keys(domainServices));

      if (domain === 'recorder' || domain === 'history' || domain.includes('history')) {
        historyRelated.push({ domain, services: Object.keys(domainServices) });
      }
    });

    console.log('📊 History-related services:', historyRelated);

    // Check if recorder is configured
    const recorderServices = services.recorder;
    if (recorderServices) {
      console.log('✅ Recorder services available:', Object.keys(recorderServices));
    } else {
      console.warn('⚠️ No recorder services found - this is likely the issue');
    }

    // Check for alternative history methods
    const alternatives = {
      'hass.callWS': typeof hass.callWS === 'function',
      'hass.callApi': typeof hass.callApi === 'function',
      'hass.callService': typeof hass.callService === 'function',
      'fetch from /api/history': 'Can try direct API call'
    };

    console.log('🔧 Alternative history methods:', alternatives);

    // Try to get current entity state to verify basic connectivity
    const testEntity = 'sensor.bathroom_dial_battery';
    if (hass.states[testEntity]) {
      console.log(`✅ Test entity '${testEntity}' accessible:`, {
        state: hass.states[testEntity].state,
        last_changed: hass.states[testEntity].last_changed,
        last_updated: hass.states[testEntity].last_updated
      });
    }

    return { services, historyRelated, hass };
  }

  /**
   * Try alternative history retrieval methods
   * Call from console: SparklineRenderer.tryAlternativeHistory('entity_id', hours)
   */
  static async tryAlternativeHistory(entityId, hours = 24) {
    console.log(`🔍 Trying alternative history retrieval for: ${entityId}`);
    console.log('======================================================');

    const hass = window.hass;
    if (!hass) {
      console.error('❌ Home Assistant not available');
      return null;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

    console.log('📅 Time range:', {
      start: startTime.toISOString(),
      end: endTime.toISOString()
    });

    const methods = [
      {
        name: 'Direct API Call (/api/history/period)',
        async execute() {
          const startParam = startTime.toISOString();
          const url = `/api/history/period/${startParam}?filter_entity_id=${entityId}`;

          console.log('🌐 Trying URL:', url);

          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${hass.auth?.accessToken || 'no-token'}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        }
      },
      {
        name: 'WebSocket Call (history/history_during_period)',
        async execute() {
          if (typeof hass.callWS !== 'function') {
            throw new Error('callWS not available');
          }

          return await hass.callWS({
            type: 'history/history_during_period',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            entity_ids: [entityId],
            minimal_response: true,
            no_attributes: true
          });
        }
      },
      {
        name: 'Service Call (recorder.get_history) with return_response',
        async execute() {
          if (!hass.services?.recorder?.get_history) {
            throw new Error('recorder.get_history service not available');
          }

          return await hass.callService('recorder', 'get_history', {
            entity_ids: [entityId],
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
          }, true); // return_response = true
        }
      }
    ];

    const results = {};

    for (const method of methods) {
      try {
        console.log(`🔄 Trying: ${method.name}`);
        const result = await method.execute();
        console.log(`✅ ${method.name} succeeded:`, result);
        results[method.name] = { success: true, data: result };

        // If we got data, try to parse it
        if (result && (Array.isArray(result) || Array.isArray(result[0]))) {
          const historyData = Array.isArray(result) ? result[0] : result;
          if (historyData && historyData.length > 0) {
            console.log(`📊 ${method.name} returned ${historyData.length} data points`);
            console.log('🎯 Sample points:', historyData.slice(0, 3));

            // Convert to sparkline format
            const sparklineData = historyData.map(point => ({
              timestamp: new Date(point.last_changed || point.last_updated).getTime(),
              value: parseFloat(point.state)
            })).filter(point => !isNaN(point.value));

            console.log(`🎨 Converted to sparkline format: ${sparklineData.length} points`);
            results[method.name].sparklineData = sparklineData;
          }
        }

        break; // If one method works, use it
      } catch (error) {
        console.warn(`❌ ${method.name} failed:`, error.message);
        results[method.name] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Generate test sparkline with alternative history data
   * Call from console: SparklineRenderer.testWithAlternativeHistory('entity_id')
   */
  static async testWithAlternativeHistory(entityId) {
    console.log(`🧪 Testing sparkline with alternative history: ${entityId}`);
    console.log('=======================================================');

    const historyResults = await this.tryAlternativeHistory(entityId, 24);

    // Find the first successful method with data
    const successfulMethod = Object.entries(historyResults).find(([name, result]) =>
      result.success && result.sparklineData?.length > 1
    );

    if (successfulMethod) {
      const [methodName, result] = successfulMethod;
      console.log(`✅ Using data from: ${methodName}`);
      console.log(`📊 Data points: ${result.sparklineData.length}`);

      // Test sparkline path generation
      const pathData = this.createSparklinePath(result.sparklineData, { width: 200, height: 60 });
      console.log('🎨 Generated SVG path:', pathData);

      return {
        method: methodName,
        data: result.sparklineData,
        pathData: pathData
      };
    } else {
      console.error('❌ No working history method found');
      return null;
    }
  }

  /**
   * Retry sparkline data loading after initialization delay
   * Call this method to attempt re-rendering after pipeline initialization
   */
  static async retrySparklineAfterInit(overlayId, maxRetries = 5, delayMs = 1000) {
    console.log(`[SparklineRenderer] 🔄 Retrying sparkline data for overlay: ${overlayId}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[SparklineRenderer] Retry attempt ${attempt}/${maxRetries} for ${overlayId}`);

      // Check if MSD infrastructure is available
      const hasMsdDebug = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
      const hasMsdPipeline = window.msdPipelineInstance?.systemsManager?.dataSourceManager;

      if (hasMsdDebug || hasMsdPipeline) {
        console.log(`[SparklineRenderer] ✅ MSD infrastructure available on attempt ${attempt}`);

        // Find the sparkline element and trigger re-render
        const sparklineElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (sparklineElement) {
          // Trigger a re-render by dispatching a custom event
          const event = new CustomEvent('msd:sparkline-retry', {
            detail: { overlayId }
          });
          sparklineElement.dispatchEvent(event);
          console.log(`[SparklineRenderer] Dispatched retry event for ${overlayId}`);
        }

        return true; // Success
      }

      if (attempt < maxRetries) {
        console.log(`[SparklineRenderer] Waiting ${delayMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.warn(`[SparklineRenderer] ❌ Failed to initialize after ${maxRetries} attempts`);
    return false;
  }
}

// Expose SparklineRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.SparklineRenderer = SparklineRenderer;
}
