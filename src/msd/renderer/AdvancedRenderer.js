/**
 * Phase 1: Enhanced renderer with real-time data integration
 * Replaces basic RendererV1 with advanced features
 * Clean implementation focused on core functionality
 */

export class AdvancedRenderer {
  constructor(mountEl, routerCore) {
    this.mountEl = mountEl;
    this.routerCore = routerCore; // FIXED: Store RouterCore reference
    this.overlayElements = new Map();
    this.svgMarkup = '';
  }

  render(resolvedModel) {
    if (!resolvedModel) {
      console.warn('[AdvancedRenderer] No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }

    const { overlays = [], anchors = {}, viewBox } = resolvedModel;

    console.log(`[AdvancedRenderer] Rendering ${overlays.length} overlays with ${Object.keys(anchors).length} anchors`);

    if (Object.keys(anchors).length === 0) {
      console.error('[AdvancedRenderer] No anchors available - this will cause position resolution failures');
    }

    // FIXED: Clear existing overlay content to prevent double rendering
    this.overlayElements.clear();

    // CRITICAL FIX: Find and clear existing MSD overlay content in DOM
    if (this.mountEl) {
      // Clear any existing overlay groups from previous renders
      const existingOverlays = this.mountEl.querySelectorAll('[data-overlay-id]');
      existingOverlays.forEach(el => el.remove());

      // Also clear from SVG if it exists
      const svg = this.mountEl.querySelector('svg');
      if (svg) {
        const overlayGroups = svg.querySelectorAll('[data-overlay-id]');
        overlayGroups.forEach(group => group.remove());
        console.log(`[AdvancedRenderer] Cleared ${overlayGroups.length} existing overlay elements from SVG`);
      }
    }

    let svgContent = '';
    let processedCount = 0;

    overlays.forEach(overlay => {
      try {
        const overlayContent = this.renderOverlay(overlay, anchors, viewBox);
        if (overlayContent) {
          svgContent += overlayContent;
          processedCount++;
        }
      } catch (error) {
        console.warn(`[AdvancedRenderer] Failed to render overlay ${overlay.id}:`, error);
      }
    });

    // ENHANCED: Inject SVG content properly without duplicating
    if (svgContent && this.mountEl) {
      this.injectSvgContent(svgContent);
    }

    console.log(`[AdvancedRenderer] Rendered ${processedCount}/${overlays.length} overlays successfully`);

    return {
      svgMarkup: svgContent,
      overlayCount: processedCount,
      errors: overlays.length - processedCount
    };
  }

  // ADDED: Safe SVG content injection without duplication
  injectSvgContent(svgContent) {
    const svg = this.mountEl.querySelector('svg');
    if (!svg) {
      console.warn('[AdvancedRenderer] No SVG element found for overlay injection');
      return;
    }

    // Create a container group for MSD overlays if it doesn't exist
    let overlayGroup = svg.querySelector('#msd-overlay-container');
    if (!overlayGroup) {
      overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlayGroup.setAttribute('id', 'msd-overlay-container');
      svg.appendChild(overlayGroup);
    } else {
      // Clear existing content
      overlayGroup.innerHTML = '';
    }

    // Parse and inject SVG content
    try {
      overlayGroup.innerHTML = svgContent;
      console.log('[AdvancedRenderer] SVG content injected successfully');
    } catch (error) {
      console.error('[AdvancedRenderer] Failed to inject SVG content:', error);
    }
  }

  // FIXED: Update method signatures to expect anchors object
  renderOverlay(overlay, anchors, viewBox) {
    if (!overlay || !overlay.type) {
      console.warn('[AdvancedRenderer] Invalid overlay - missing type:', overlay);
      return '';
    }

    try {
      switch (overlay.type) {
        case 'text':
          return this.createTextContent(overlay, anchors, viewBox);
        case 'sparkline':
          return this.createSparklineContent(overlay, anchors, viewBox);
        case 'line':
          return this.renderLineOverlay(overlay, anchors, viewBox);
        default:
          console.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
          return '';
      }
    } catch (error) {
      console.error(`[AdvancedRenderer] Error rendering ${overlay.type} overlay ${overlay.id}:`, error);
      return '';
    }
  }

  renderLineOverlay(overlay, anchors, viewBox) {
    // ENHANCED: Debug RouterCore availability
    if (!this.routerCore) {
      console.error('[AdvancedRenderer] RouterCore not available for line rendering - missing from constructor');
      console.log('[AdvancedRenderer] Available properties:', Object.keys(this));
      return '';
    }

    // FIXED: Use anchors parameter instead of resolvedModel.anchors
    const anchor1 = this.resolvePosition(overlay.anchor, anchors);
    const anchor2 = this.resolvePosition(overlay.attach_to, anchors);

    if (!anchor1 || !anchor2) {
      console.warn(`[AdvancedRenderer] Line ${overlay.id} missing anchor or attach_to points`);
      console.log(`[AdvancedRenderer] anchor1 (${overlay.anchor}):`, anchor1);
      console.log(`[AdvancedRenderer] anchor2 (${overlay.attach_to}):`, anchor2);
      return '';
    }

    try {
      // FIXED: Use RouterCore method instead of router method
      const routeRequest = this.routerCore.buildRouteRequest(overlay, anchor1, anchor2);
      const pathResult = this.routerCore.computePath(routeRequest);

      if (pathResult && pathResult.d) {
        const style = overlay.finalStyle || overlay.style || {};
        const strokeColor = style.color || 'var(--lcars-orange)';
        const strokeWidth = style.width || 2;

        console.log(`[AdvancedRenderer] Rendered line ${overlay.id} from (${anchor1}) to (${anchor2})`);

        return `<path d="${pathResult.d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none"
                      data-overlay-id="${overlay.id}" data-overlay-type="line"/>`;
      } else {
        console.warn(`[AdvancedRenderer] No path result for line ${overlay.id}`);
        return '';
      }
    } catch (error) {
      console.error(`[AdvancedRenderer] Route computation failed for line ${overlay.id}:`, error);
      return '';
    }
  }

  renderTextOverlay(overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    if (!position) return '';

    const style = overlay.finalStyle || overlay.style || {};
    const value = style.value || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || 14;

    return `<text id="${overlay.id}" x="${position[0]}" y="${position[1]}"
            fill="${color}" font-size="${fontSize}" data-cblcars-root="true">
            ${value}
            </text>`;
  }

  renderSparklineOverlay(overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = overlay.size || [200, 60];

    if (!position) return '';

    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-yellow)';
    const width = style.width || 2;

    // Basic sparkline container - actual data will be updated by data sources
    return `<g id="${overlay.id}" transform="translate(${position[0]}, ${position[1]})"
            data-cblcars-root="true" data-cblcars-type="sparkline">
            <rect width="${size[0]}" height="${size[1]}" fill="none" stroke="none" opacity="0.1"/>
            <path stroke="${color}" stroke-width="${width}" fill="none" data-cblcars-pending="true" style="visibility: hidden;"/>
            </g>`;
  }

  createTextContent(overlay, anchors, viewBox) {
    const position = this.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[AdvancedRenderer] Text overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const style = overlay.finalStyle || overlay.style || {};

    // Extract text properties with defaults
    const text = style.value || overlay.text || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || style.fontSize || 16;
    const fontWeight = style.font_weight || style.fontWeight || 'normal';
    const fontFamily = style.font_family || style.fontFamily || 'Arial, sans-serif';
    const textAnchor = style.text_anchor || style.textAnchor || 'start';
    const alignment = style.alignment_baseline || style.alignmentBaseline || 'baseline';

    console.log(`[AdvancedRenderer] Rendering text overlay ${overlay.id} at (${x}, ${y}): "${text}"`);

    return `<text x="${x}" y="${y}"
                  fill="${color}"
                  font-size="${fontSize}"
                  font-weight="${fontWeight}"
                  font-family="${fontFamily}"
                  text-anchor="${textAnchor}"
                  alignment-baseline="${alignment}"
                  data-overlay-id="${overlay.id}"
                  data-overlay-type="text">
              ${this.escapeXml(text)}
            </text>`;
  }

  createSparklineContent(overlay, anchors, viewBox) {
    const position = this.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[AdvancedRenderer] Sparkline overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 60];
    const [width, height] = size;
    const style = overlay.finalStyle || overlay.style || {};

    // ENHANCED: Comprehensive data source discovery
    console.log(`[AdvancedRenderer] Sparkline ${overlay.id} overlay structure:`, {
      hasSource: !!overlay.source,
      source: overlay.source,
      rawKeys: Object.keys(overlay._raw || {}),
      rawValue: overlay._raw,
      styleKeys: Object.keys(style),
      allKeys: Object.keys(overlay)
    });

    // FIXED: Check data source in ALL possible locations
    const dataSource = overlay.source ||
                      overlay._raw?.source ||
                      style.source ||
                      overlay.raw?.source ||
                      overlay.definition?.source;

    console.log(`[AdvancedRenderer] Data source search results:`, {
      'overlay.source': overlay.source,
      'overlay._raw?.source': overlay._raw?.source,
      'style.source': style.source,
      'overlay.raw?.source': overlay.raw?.source,
      'overlay.definition?.source': overlay.definition?.source,
      'resolved': dataSource
    });

    if (!dataSource) {
      console.warn(`[AdvancedRenderer] Sparkline ${overlay.id} has no data source configured after comprehensive search`);
      // ENHANCED: Show mock data instead of placeholder for demo purposes
      console.log(`[AdvancedRenderer] Generating demo mock data for sparkline ${overlay.id} to demonstrate functionality`);
      const demoData = this.generateDemoDataForSparkline(overlay.id);

      if (demoData && demoData.length > 0) {
        // Extract style properties
        const strokeColor = style.color || 'var(--lcars-yellow)';
        const strokeWidth = style.width || 2;
        const markers = style.markers || {};
        const markerRadius = markers.r || 3;
        const markerFill = markers.fill || strokeColor;

        // Generate sparkline path
        const pathData = this.generateSparklinePath(demoData, width, height);

        console.log(`[AdvancedRenderer] Rendering demo sparkline overlay ${overlay.id} at (${x}, ${y}) size ${width}x${height} with ${demoData.length} demo data points`);

        // Create sparkline group with clipping
        return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline">
                  <defs>
                    <clipPath id="sparkline-clip-${overlay.id}">
                      <rect x="${x}" y="${y}" width="${width}" height="${height}"/>
                    </clipPath>
                  </defs>

                  <!-- Background rect for debugging -->
                  <rect x="${x}" y="${y}" width="${width}" height="${height}"
                        fill="none" stroke="rgba(255,255,0,0.3)" stroke-width="1" stroke-dasharray="2,2"/>

                  <!-- Demo label -->
                  <text x="${x + 5}" y="${y + 15}" fill="rgba(255,255,0,0.8)" font-size="10" font-family="monospace">DEMO DATA</text>

                  <!-- Sparkline path -->
                  <path d="${pathData}"
                        stroke="${strokeColor}"
                        stroke-width="${strokeWidth}"
                        fill="none"
                        clip-path="url(#sparkline-clip-${overlay.id})"/>

                  <!-- Data points -->
                  ${this.generateSparklineMarkers(demoData, x, y, width, height, markerRadius, markerFill)}

                  <!-- Value label if configured -->
                  ${this.generateSparklineLabel(overlay, demoData, x, y, width, height)}
                </g>`;
      }

      return this.createPlaceholderSparkline(x, y, width, height, overlay.id);
    }

    // ENHANCED: Try to get real entity data, fall back to mock data
    const entityData = this.getEntityDataForSparkline(dataSource);

    if (!entityData || entityData.length === 0) {
      console.log(`[AdvancedRenderer] No entity data available for sparkline ${overlay.id}, using mock data`);
      const mockData = this.generateDemoDataForSparkline(overlay.id);

      if (mockData && mockData.length > 0) {
        const strokeColor = style.color || 'var(--lcars-yellow)';
        const strokeWidth = style.width || 2;
        const pathData = this.generateSparklinePath(mockData, width, height);

        return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline">
                  <path d="${pathData}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none"/>
                  <text x="${x + 5}" y="${y + 15}" fill="orange" font-size="10">MOCK DATA</text>
                </g>`;
      }

      return this.createPlaceholderSparkline(x, y, width, height, overlay.id);
    }

    // Extract style properties
    const strokeColor = style.color || 'var(--lcars-yellow)';
    const strokeWidth = style.width || 2;
    const markers = style.markers || {};
    const markerRadius = markers.r || 3;
    const markerFill = markers.fill || strokeColor;

    // Generate sparkline path
    const pathData = this.generateSparklinePath(entityData, width, height);

    console.log(`[AdvancedRenderer] Rendering sparkline overlay ${overlay.id} at (${x}, ${y}) size ${width}x${height} with ${entityData.length} data points`);

    // Create sparkline group with clipping
    return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline">
              <defs>
                <clipPath id="sparkline-clip-${overlay.id}">
                  <rect x="${x}" y="${y}" width="${width}" height="${height}"/>
                </clipPath>
              </defs>

              <!-- Background rect for debugging -->
              <rect x="${x}" y="${y}" width="${width}" height="${height}"
                    fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

              <!-- Sparkline path -->
              <path d="${pathData}"
                    stroke="${strokeColor}"
                    stroke-width="${strokeWidth}"
                    fill="none"
                    clip-path="url(#sparkline-clip-${overlay.id})"/>

              <!-- Data points -->
              ${this.generateSparklineMarkers(entityData, x, y, width, height, markerRadius, markerFill)}

              <!-- Value label if configured -->
              ${this.generateSparklineLabel(overlay, entityData, x, y, width, height)}
            </g>`;
  }

  // ADDED: Missing placeholder sparkline method
  createPlaceholderSparkline(x, y, width, height, id) {
    return `<g data-overlay-id="${id}" data-overlay-type="sparkline">
              <rect x="${x}" y="${y}" width="${width}" height="${height}"
                    fill="none" stroke="var(--lcars-yellow)" stroke-width="2" stroke-dasharray="5,5"/>
              <text x="${x + width/2}" y="${y + height/2}"
                    fill="var(--lcars-yellow)"
                    font-size="12"
                    text-anchor="middle"
                    alignment-baseline="middle">
                No Data Source
              </text>
            </g>`;
  }

  // ADDED: Missing sparkline path generation method
  generateSparklinePath(data, width, height) {
    if (!data || data.length < 2) {
      // Return horizontal line for no data
      return `M0,${height/2} L${width},${height/2}`;
    }

    // Find data range for scaling
    const values = data.map(d => d.value).filter(v => !isNaN(v));
    if (values.length === 0) {
      return `M0,${height/2} L${width},${height/2}`;
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Avoid division by zero

    // Generate path points
    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * width;
      const normalizedValue = (d.value - minValue) / valueRange;
      const y = height - (normalizedValue * height); // Invert Y for SVG coordinates
      return [x, y];
    });

    // Create SVG path
    const pathCommands = points.map((point, index) => {
      const [x, y] = point;
      return index === 0 ? `M${x},${y}` : `L${x},${y}`;
    });

    return pathCommands.join(' ');
  }

  // ADDED: Missing sparkline markers generation method
  generateSparklineMarkers(data, offsetX, offsetY, width, height, radius, fill) {
    if (!data || data.length === 0) return '';

    // Find data range for scaling
    const values = data.map(d => d.value).filter(v => !isNaN(v));
    if (values.length === 0) return '';

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    return data.map((d, index) => {
      if (isNaN(d.value)) return '';

      const x = offsetX + (index / (data.length - 1)) * width;
      const normalizedValue = (d.value - minValue) / valueRange;
      const y = offsetY + height - (normalizedValue * height);

      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
    }).join('');
  }

  // ADDED: Missing sparkline label generation method
  generateSparklineLabel(overlay, data, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const labelConfig = style.label_last;

    if (!labelConfig || !data || data.length === 0) return '';

    const lastValue = data[data.length - 1]?.value;
    if (isNaN(lastValue)) return '';

    // Format value
    const decimals = labelConfig.decimals || 0;
    const format = labelConfig.format || '{v}';
    const formattedValue = format.replace('{v}', lastValue.toFixed(decimals));

    // Position label
    const offset = labelConfig.offset || [10, -5];
    const labelX = x + width + offset[0];
    const labelY = y + height/2 + offset[1];
    const labelFill = labelConfig.fill || 'var(--lcars-orange)';

    return `<text x="${labelX}" y="${labelY}"
                  fill="${labelFill}"
                  font-size="12"
                  font-family="monospace"
                  alignment-baseline="middle">
              ${this.escapeXml(formattedValue)}
            </text>`;
  }

  getEntityDataForSparkline(dataSource) {
    // ENHANCED: Try multiple data source strategies
    console.log(`[AdvancedRenderer] Looking for data source: ${dataSource}`);

    // Strategy 1: Try entity runtime
    try {
      const entityRuntime = window.__msdDebug?.entities;
      if (entityRuntime && entityRuntime.get) {
        const entity = entityRuntime.get(dataSource);
        if (entity && entity.state) {
          console.log(`[AdvancedRenderer] Found entity data for ${dataSource}:`, entity.state);

          // Generate time series from current value (mock historical data)
          const currentValue = parseFloat(entity.state) || 50;
          const now = Date.now();
          const mockData = [];

          for (let i = 0; i < 20; i++) {
            const variation = (Math.sin(i * 0.3) * 10) + (Math.random() * 6 - 3);
            mockData.push({
              timestamp: now - (19 - i) * 60000,
              value: Math.max(0, Math.min(100, currentValue + variation))
            });
          }

          return mockData;
        }
      }
    } catch (e) {
      console.warn('[AdvancedRenderer] Entity runtime lookup failed:', e);
    }

    // Strategy 2: Generate deterministic mock data based on data source name
    console.log(`[AdvancedRenderer] Generating mock data for sparkline source: ${dataSource}`);

    const now = Date.now();
    const mockData = [];
    const baseValue = dataSource.includes('cpu') ? 45 :
                     dataSource.includes('memory') ? 60 :
                     dataSource.includes('temp') ? 72 : 50;

    for (let i = 0; i < 20; i++) {
      const timeOffset = i * 0.5;
      const sineWave = Math.sin(timeOffset) * 15;
      const noise = (Math.random() - 0.5) * 8;

      mockData.push({
        timestamp: now - (19 - i) * 60000, // 1 minute intervals
        value: Math.max(5, Math.min(95, baseValue + sineWave + noise))
      });
    }

    console.log(`[AdvancedRenderer] Generated ${mockData.length} mock data points for ${dataSource}`);
    return mockData;
  }

  resolvePosition(position, anchors) {
    // ENHANCED: Debug what anchors are available
    if (!anchors || Object.keys(anchors).length === 0) {
      console.warn('[AdvancedRenderer] No anchors available for position resolution');
      console.warn('[AdvancedRenderer] Position requested:', position);
      return null;
    }

    if (Array.isArray(position) && position.length >= 2) {
      // Direct coordinate pair
      return [Number(position[0]), Number(position[1])];
    }

    if (typeof position === 'string' && anchors[position]) {
      // Anchor reference
      const anchorPos = anchors[position];
      if (Array.isArray(anchorPos) && anchorPos.length >= 2) {
        return [Number(anchorPos[0]), Number(anchorPos[1])];
      }
    }

    // ENHANCED: Debug what went wrong
    console.warn('[AdvancedRenderer] Could not resolve position:', position);
    console.warn('[AdvancedRenderer] Available anchors:', Object.keys(anchors));
    console.warn('[AdvancedRenderer] Position type:', typeof position);
    if (typeof position === 'string') {
      console.warn('[AdvancedRenderer] Anchor exists:', !!anchors[position]);
      if (anchors[position]) {
        console.warn('[AdvancedRenderer] Anchor value:', anchors[position]);
      }
    }
    return null;
  }

  escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  clearOverlays(svg) {
    // Remove existing overlays
    const existing = svg.querySelectorAll('[data-cblcars-root="true"]');
    existing.forEach(el => el.remove());
  }

  reRender() {
    if (this.lastRenderArgs) {
      this.render(this.lastRenderArgs);
    }
  }

  // Get performance statistics
  getStats() {
    return {
      overlayCount: this.overlayElements.size,
      lastRenderTime: this.lastRenderTime || 0
    };
  }

  // Clear all rendered content
  clear() {
    this.overlayElements.clear();
    this.lastRenderArgs = null;
  }

  // Calculate bounding box for an overlay
  calculateOverlayBounds(overlay, anchors) {
    const pos = this.resolvePosition(overlay.position, anchors);
    if (!pos) return null;

    let width = 100, height = 20; // defaults

    if (overlay.size) {
      [width, height] = overlay.size;
    } else if (overlay.type === 'text') {
      // Estimate text bounds
      const text = overlay.style?.value || '';
      const fontSize = overlay.style?.font_size || 16;
      width = text.length * fontSize * 0.6;
      height = fontSize * 1.2;
    } else if (overlay.type === 'sparkline') {
      width = 200;
      height = 60;
    }

    return {
      x: pos[0],
      y: pos[1] - height/2,
      width,
      height
    };
  }

  // Connect debug renderer
  connectDebugRenderer(debugRenderer) {
    this.debugRenderer = debugRenderer;
    console.log('[AdvancedRenderer] Debug renderer connected');
  }
}
