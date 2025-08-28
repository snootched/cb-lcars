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
   * Get historical data from the real DataSourceManager
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
      // Access the real DataSourceManager through the pipeline
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        return {
          data: null,
          status: 'MANAGER_OFFLINE',
          message: 'Data Source Manager offline'
        };
      }

      // Get the data source instance
      const dataSource = dataSourceManager.getSource(dataSourceName);

      if (!dataSource) {
        return {
          data: null,
          status: 'SOURCE_NOT_FOUND',
          message: `Source '${dataSourceName}' not found`
        };
      }

      // Get the historical data from the buffer
      const currentData = dataSource.getCurrentData();
      if (!currentData?.buffer) {
        return {
          data: null,
          status: 'NO_BUFFER',
          message: 'No historical data buffer available'
        };
      }

      // Extract time series data from the buffer
      const bufferData = currentData.buffer.getAll();

      if (!bufferData || bufferData.length === 0) {
        return {
          data: null,
          status: 'NO_DATA',
          message: 'No historical data available'
        };
      }

      if (bufferData.length < 2) {
        return {
          data: null,
          status: 'INSUFFICIENT_DATA',
          message: 'Insufficient data for sparkline (need 2+ points)'
        };
      }

      // Convert buffer data to sparkline format
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

    } catch (error) {
      console.error(`[SparklineRenderer] Error getting data for '${dataSourceName}':`, error);
      return {
        data: null,
        status: 'ERROR',
        message: error.message
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
      'SOURCE_NOT_FOUND': 'var(--lcars-orange)',
      'NO_BUFFER': 'var(--lcars-orange)',
      'NO_DATA': 'var(--lcars-blue)',
      'INSUFFICIENT_DATA': 'var(--lcars-blue)',
      'ERROR': 'var(--lcars-red)'
    };

    const statusMessages = {
      'NO_SOURCE': 'NO SOURCE',
      'MANAGER_OFFLINE': 'OFFLINE',
      'SOURCE_NOT_FOUND': 'NOT FOUND',
      'NO_BUFFER': 'NO BUFFER',
      'NO_DATA': 'NO DATA',
      'INSUFFICIENT_DATA': 'STANDBY',
      'ERROR': 'ERROR'
    };

    const indicatorColor = statusColors[dataResult.status] || color;
    const indicatorText = statusMessages[dataResult.status] || 'UNKNOWN';
    const fontSize = Math.min(width / 8, height / 3, 14);

    return `
      <g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" data-source="${overlay.source || 'unknown'}" data-status="${dataResult.status}">
        <g transform="translate(${x}, ${y})">
          <!-- LCARS-style status border -->
          <rect width="${width}" height="${height}"
                fill="none"
                stroke="${indicatorColor}"
                stroke-width="2"
                stroke-dasharray="8,4"
                opacity="0.6">
            <animate attributeName="opacity"
                     values="0.3;0.8;0.3"
                     dur="2s"
                     repeatCount="indefinite"/>
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
}
