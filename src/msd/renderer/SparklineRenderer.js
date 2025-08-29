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
   * Get historical data with multiple fallback strategies
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
      // Try the real DataSourceManager through the pipeline
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        console.log(`[SparklineRenderer] 🔍 Checking DataSourceManager for '${dataSourceName}'`);

        // List all available sources for troubleshooting
        const availableSources = Array.from(dataSourceManager.sources.keys());
        console.log(`[SparklineRenderer] Available sources:`, availableSources);

        // Use exact source name only
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
      //console.warn(`[SparklineRenderer] ❌ DataSourceManager not available`);
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
   * @param {Object} overlay - Overlay configuration
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width of indicator
   * @param {number} height - Height of indicator
   * @param {Object} dataResult - Data result object
   * @param {string} color - Fallback color
   * @returns {string} SVG markup for status indicator
   */
  static renderStatusIndicator(overlay, x, y, width, height, dataResult, color) {
    const statusColors = {
      'NO_SOURCE': 'var(--lcars-red)',
      'MANAGER_NOT_AVAILABLE': 'var(--lcars-blue)',
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
      'MANAGER_NOT_AVAILABLE': 'LOADING',
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
    const loadingStates = ['INITIALIZING', 'STARTING', 'LOADING_HISTORY', 'MANAGER_NOT_AVAILABLE', 'INSUFFICIENT_DATA'];
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
    console.log(`[SparklineRenderer] updateSparklineData called for ${overlay.id}:`, {
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      hasHistoricalData: !!(sourceData?.historicalData),
      historicalDataLength: sourceData?.historicalData?.length || 0,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      currentStatus: sparklineElement.getAttribute('data-status'),
      elementFound: !!sparklineElement,
      currentValue: sourceData?.v
    });

    if (!sparklineElement || !overlay || !sourceData) {
      console.warn('[SparklineRenderer] updateSparklineData: Missing required parameters');
      return;
    }

    // Check if this is a status indicator that needs to be upgraded to a real sparkline
    const currentStatus = sparklineElement.getAttribute('data-status');
    const isStatusIndicator = currentStatus !== null; // Has data-status attribute

    if (isStatusIndicator && (sourceData.buffer || sourceData.historicalData)) {
      console.log(`[SparklineRenderer] Upgrading status indicator ${overlay.id} to real sparkline`);
      this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      return;
    }

    // Find the path element to update (for existing sparklines)
    const pathElement = sparklineElement.querySelector('path');
    if (!pathElement) {
      console.warn(`[SparklineRenderer] No path element found for ${overlay.id} - might still be a status indicator`);
      return;
    }

    try {
      // Extract dimensions from overlay config
      const bounds = {
        width: overlay.size?.[0] || 200,
        height: overlay.size?.[1] || 60
      };

      // Convert source data to sparkline format
      const historicalData = this._extractHistoricalData(sourceData);

      if (historicalData.length > 1) {
        const newPathData = this.createSparklinePath(historicalData, bounds);
        pathElement.setAttribute('d', newPathData);

        // Update status attributes
        sparklineElement.removeAttribute('data-status');
        sparklineElement.setAttribute('data-last-update', Date.now());

        console.log(`[SparklineRenderer] ✅ Updated sparkline ${overlay.id} with ${historicalData.length} points`);
      } else {
        console.warn(`[SparklineRenderer] Insufficient data for sparkline ${overlay.id}: ${historicalData.length} points`);

        // Set loading status if we don't have enough data yet
        if (historicalData.length === 0) {
          sparklineElement.setAttribute('data-status', 'NO_DATA');
        } else {
          sparklineElement.setAttribute('data-status', 'INSUFFICIENT_DATA');
        }
      }

    } catch (error) {
      console.error(`[SparklineRenderer] Error updating sparkline ${overlay.id}:`, error);
      sparklineElement.setAttribute('data-status', 'ERROR');
    }
  }

  /**
   * Upgrade a status indicator to a real sparkline
   * @private
   * @param {Element} sparklineElement - The status indicator element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Data from the data source
   */
  static _upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData) {
    console.log(`[SparklineRenderer] Upgrading status indicator ${overlay.id} to real sparkline`);

    const gTransform = sparklineElement.querySelector('g[transform]');
    if (!gTransform) {
      console.warn(`[SparklineRenderer] Could not find transform group for upgrade in ${overlay.id}`);
      return;
    }

    // Extract size from overlay
    const size = overlay.size || [200, 60];
    const [width, height] = size;
    const style = overlay.finalStyle || overlay.style || {};
    const strokeColor = style.color || 'var(--lcars-yellow)';

    // Get historical data
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length > 1) {
      // Generate new path data
      const pathData = this.createSparklinePath(historicalData, { width, height });

      console.log(`[SparklineRenderer] Generated path data for upgrade of ${overlay.id}`);

      // Replace status indicator content with real sparkline
      gTransform.innerHTML = `
        <path d="${pathData}"
              fill="none"
              stroke="${strokeColor}"
              stroke-width="${style.width || 2}"
              vector-effect="non-scaling-stroke"/>
      `;

      // Update element attributes to reflect new state
      sparklineElement.removeAttribute('data-status');
      sparklineElement.setAttribute('data-last-update', Date.now());

      console.log(`[SparklineRenderer] ✅ Upgraded status indicator ${overlay.id} to sparkline with ${historicalData.length} data points`);
    } else {
      console.warn(`[SparklineRenderer] Cannot upgrade ${overlay.id} - insufficient data: ${historicalData.length} points`);
      // Keep the status indicator but update the status
      if (historicalData.length === 0) {
        sparklineElement.setAttribute('data-status', 'NO_DATA');
      } else {
        sparklineElement.setAttribute('data-status', 'INSUFFICIENT_DATA');
      }
    }
  }

  /**
   * Extract historical data from various source data formats
   * @private
   * @param {Object} sourceData - Data from the data source
   * @returns {Array} Array of {timestamp, value} objects
   */
  static _extractHistoricalData(sourceData) {
    let historicalData = [];

    // Method 1: Use buffer data directly
    if (sourceData.buffer && typeof sourceData.buffer.getAll === 'function') {
      const bufferData = sourceData.buffer.getAll();
      historicalData = bufferData.map(point => ({
        timestamp: point.t,
        value: point.v
      }));
      console.log('[SparklineRenderer] Using buffer data:', historicalData.length, 'points');
    }
    // Method 2: Use pre-formatted historical data
    else if (sourceData.historicalData && Array.isArray(sourceData.historicalData)) {
      historicalData = sourceData.historicalData;
      console.log('[SparklineRenderer] Using pre-formatted historical data:', historicalData.length, 'points');
    }
    // Method 3: Generate from single current value (fallback for testing)
    else if (sourceData.v !== undefined && sourceData.t !== undefined) {
      console.log('[SparklineRenderer] Generating demo data from current value:', sourceData.v);
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        historicalData.push({
          timestamp: now - (19 - i) * 60000,
          value: sourceData.v + (Math.random() - 0.5) * (sourceData.v * 0.1) // ±10% variation
        });
      }
    }

    return historicalData;
  }

  /**
   * Debug method to check sparkline update status
   * Call from console: SparklineRenderer.debugSparklineUpdates()
   */
  static debugSparklineUpdates() {
    console.log('🔍 Sparkline Update Debug Report');
    console.log('================================');

    // Check data source manager
    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (dsm) {
      const stats = dsm.getStats();
      console.log('DataSourceManager stats:', stats);
      console.log('Note: Individual sparkline element scanning removed - use subscription callbacks for updates');
    } else {
      console.warn('DataSourceManager not accessible via debug interface');
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
}

// Expose SparklineRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.SparklineRenderer = SparklineRenderer;
}