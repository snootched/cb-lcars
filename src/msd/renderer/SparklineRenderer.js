/**
 * Sparkline Renderer - Handles sparkline creation and data processing
 */

import { PositionResolver } from './PositionResolver.js';
import { DataSourceManager } from './DataSourceManager.js';

export class SparklineRenderer {
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

    console.log(`[SparklineRenderer] Rendering sparkline overlay ${overlay.id} at (${x}, ${y}) size ${width}x${height}`);

    // Get data - try real data first, fall back to demo
    const entityData = DataSourceManager.getEntityDataForSparkline(overlay.source);
    const strokeColor = style.color || 'var(--lcars-yellow)';
    const strokeWidth = style.width || 2;

    if (entityData && entityData.length > 1) {
      const pathData = this.generateSparklinePath(entityData, width, height);

      return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" transform="translate(${x}, ${y})">
                <rect x="0" y="0" width="${width}" height="${height}"
                      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                <path d="${pathData}"
                      stroke="${strokeColor}"
                      stroke-width="${strokeWidth}"
                      fill="none"/>
                <text x="5" y="15" fill="orange" font-size="10">REAL DATA</text>
              </g>`;
    } else {
      return this.createPlaceholderSparkline(x, y, width, height, overlay.id);
    }
  }

  static generateSparklinePath(data, width, height) {
    if (!data || data.length < 2) {
      return `M0,${height/2} L${width},${height/2}`;
    }

    const values = data.map(d => d.value).filter(v => !isNaN(v));
    if (values.length === 0) {
      return `M0,${height/2} L${width},${height/2}`;
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * width;
      const normalizedValue = (d.value - minValue) / valueRange;
      const y = height - (normalizedValue * height);
      return [x, y];
    });

    const pathCommands = points.map((point, index) => {
      const [x, y] = point;
      return index === 0 ? `M${x},${y}` : `L${x},${y}`;
    });

    return pathCommands.join(' ');
  }

  static createPlaceholderSparkline(x, y, width, height, id) {
    return `<g data-overlay-id="${id}" data-overlay-type="sparkline" transform="translate(${x}, ${y})">
              <rect x="0" y="0" width="${width}" height="${height}"
                    fill="none" stroke="var(--lcars-yellow)" stroke-width="2" stroke-dasharray="5,5"/>
              <text x="${width/2}" y="${height/2}"
                    fill="var(--lcars-yellow)"
                    font-size="12"
                    text-anchor="middle"
                    alignment-baseline="middle">
                No Data
              </text>
            </g>`;
  }

  static updateSparklineData(overlayElement, overlay, sourceData) {
    if (!sourceData.buffer) return;

    const points = [];
    for (let i = 0; i < sourceData.buffer.length; i++) {
      const point = sourceData.buffer.at(i);
      if (point && point.v !== undefined) {
        points.push({ timestamp: point.t, value: point.v });
      }
    }

    if (points.length === 0) return;

    const pathElement = overlayElement.querySelector('path');
    if (!pathElement) return;

    const [width, height] = overlay.size || [200, 50];
    const newPath = this.generateSparklinePath(points, width, height);
    pathElement.setAttribute('d', newPath);

    console.log(`[SparklineRenderer] Updated sparkline ${overlay.id} with ${points.length} data points`);
  }
}
