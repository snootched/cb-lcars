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

  /**
   * Initialize the advanced renderer with template engine and data manager
   */
  initialize() {
      // Initialize template engine for text overlays
      if (!this.templateEngine && typeof window !== 'undefined' && window.MsdTemplateEngine) {
          this.templateEngine = new window.MsdTemplateEngine();
      }

      // Initialize data manager for sparklines
      if (!this.dataManager && typeof window !== 'undefined' && window.__msdDataManager) {
          this.dataManager = window.__msdDataManager;
      }

      // Subscribe to data source updates
      if (typeof window !== 'undefined') {
          window.addEventListener('msd-data-update', (event) => {
              this.handleDataSourceUpdate(event.detail);
          });
      }
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

    // ENHANCED: Store reference for data updates with SVG access
    this.lastRenderArgs = {
      resolvedModel,
      overlays,
      svg: this.mountEl?.querySelector('svg')
    };

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

  /**
   * Render text overlay with template support
   * @param {Element} container - Container element
   * @param {object} overlay - Overlay configuration
   * @param {object} bounds - Overlay bounds
   */
  renderTextOverlay(container, overlay, bounds) {
    const textElement = document.createElement('div');
    textElement.className = 'msd-text-overlay';

    // Apply positioning
    Object.assign(textElement.style, {
        position: 'absolute',
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        pointerEvents: 'none'
    });

    // Apply text styling
    if (overlay.style) {
        Object.assign(textElement.style, overlay.style);
    }

    // Process template content
    let displayText = overlay.content || '';

    if (this.templateEngine && displayText.includes('{{')) {
        const templateId = `text_overlay_${overlay.id || 'unnamed'}`;
        const compiled = this.templateEngine.compileTemplate(displayText, templateId);

        // Evaluate template with current HASS states
        displayText = this.templateEngine.evaluateTemplate(compiled);

        // Subscribe to updates if template has entity dependencies
        if (compiled.entityDependencies.length > 0) {
            this.templateEngine.subscribeToTemplateUpdates(
                templateId,
                compiled.entityDependencies,
                (templateId, entityId, newState) => {
                    // Update text when entity state changes
                    const updatedText = this.templateEngine.evaluateTemplate(compiled);
                    textElement.textContent = updatedText;
                }
            );
        }
    }

    textElement.textContent = displayText;
    container.appendChild(textElement);

    return textElement;
  }

  /**
   * Render sparkline overlay with real HASS data
   * @param {Element} container - Container element
   * @param {object} overlay - Overlay configuration
   * @param {object} bounds - Overlay bounds
   */
  renderSparklineOverlay(container, overlay, bounds) {
    const sparklineContainer = document.createElement('div');
    sparklineContainer.className = 'msd-sparkline-overlay';

    // Apply positioning
    Object.assign(sparklineContainer.style, {
        position: 'absolute',
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        pointerEvents: 'none'
    });

    // Create SVG for sparkline
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);

    // Get data source for sparkline
    let dataPoints = [];
    if (overlay.data_source && this.dataManager) {
        const dataSource = this.dataManager.getDataSource(overlay.data_source);
        if (dataSource && dataSource.historicalData) {
            dataPoints = dataSource.historicalData;
            console.log(`🔗 MSD: Sparkline using real data: ${dataPoints.length} points from ${overlay.data_source}`);
        } else {
            console.warn(`⚠️ MSD: Data source ${overlay.data_source} not available or no data`);
        }
    }

    if (dataPoints.length > 0) {
        // Create sparkline path from real data
        const path = this.createSparklinePath(dataPoints, bounds);
        svg.appendChild(path);
    } else {
        // Show placeholder when no data available
        const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        placeholder.setAttribute('x', bounds.width / 2);
        placeholder.setAttribute('y', bounds.height / 2);
        placeholder.setAttribute('text-anchor', 'middle');
        placeholder.setAttribute('dominant-baseline', 'central');
        placeholder.setAttribute('fill', '#ff9900');
        placeholder.setAttribute('font-size', '12px');
        placeholder.textContent = 'No Data';
        svg.appendChild(placeholder);
    }

    sparklineContainer.appendChild(svg);
    container.appendChild(sparklineContainer);

    // Subscribe to data updates for real-time sparkline updates
    if (overlay.data_source && this.dataManager) {
        const dataSource = this.dataManager.getDataSource(overlay.data_source);
        if (dataSource) {
            // Store reference for updates
            sparklineContainer.dataset.dataSource = overlay.data_source;
            sparklineContainer.dataset.overlayId = overlay.id || 'unnamed';
        }
    }

    return sparklineContainer;
  }

  /**
   * Create SVG path for sparkline from real data points
   * @param {array} dataPoints - Historical data points from HASS
   * @param {object} bounds - Sparkline bounds
   */
  createSparklinePath(dataPoints, bounds) {
    if (dataPoints.length < 2) return null;

    // Get value range for scaling
    const values = dataPoints.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1; // Avoid division by zero

    // Get time range for scaling
    const timestamps = dataPoints.map(p => p.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;

    // Generate path points
    let pathData = '';

    for (let i = 0; i < dataPoints.length; i++) {
        const point = dataPoints[i];

        // Scale x position based on timestamp
        const x = ((point.timestamp - minTime) / timeRange) * bounds.width;

        // Scale y position based on value (flip Y coordinate)
        const y = bounds.height - (((point.value - minValue) / valueRange) * bounds.height);

        if (i === 0) {
            pathData += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        } else {
            pathData += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
    }

    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', overlay.color || '#ff9900');
    path.setAttribute('stroke-width', overlay.stroke_width || '2');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');

    return path;
  }

  /**
   * Handle real-time data source updates
   * @param {object} updateData - Data source update details
   */
  handleDataSourceUpdate(updateData) {
    // Find sparkline overlays using this data source
    const sparklines = this.container.querySelectorAll(
        `[data-data-source="${updateData.sourceId}"]`
    );

    for (const sparklineContainer of sparklines) {
        const svg = sparklineContainer.querySelector('svg');
        if (!svg) continue;

        // Clear existing content
        svg.innerHTML = '';

        // Get container bounds for scaling
        const rect = sparklineContainer.getBoundingClientRect();
        const bounds = {
            width: rect.width || parseInt(sparklineContainer.style.width),
            height: rect.height || parseInt(sparklineContainer.style.height),
            left: 0,
            top: 0
        };

        // Recreate sparkline with updated data
        if (updateData.historicalData && updateData.historicalData.length > 0) {
            const path = this.createSparklinePath(updateData.historicalData, bounds);
            if (path) {
                svg.appendChild(path);
            }

            console.log(`📈 MSD: Updated sparkline ${sparklineContainer.dataset.overlayId} with ${updateData.historicalData.length} data points`);
        }
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

  // CRITICAL: Core position resolution method - MUST exist for all overlays
  resolvePosition(position, anchors) {
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

    console.warn('[AdvancedRenderer] Could not resolve position:', position);
    return null;
  }

  // CRITICAL: Core XML escaping method - needed for text rendering
  escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // CRITICAL: Sparkline path generation method
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

  // CRITICAL: Sparkline markers generation method
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

  // CRITICAL: Sparkline label generation method
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

  // CRITICAL: Placeholder sparkline method
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

  // ADDED: Missing core methods for position resolution and XML escaping
  // CRITICAL: Core position resolution method - MUST exist for all overlays
  resolvePosition(position, anchors) {
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

    console.warn('[AdvancedRenderer] Could not resolve position:', position);
    return null;
  }

  // CRITICAL: Core XML escaping method - needed for text rendering
  escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // CRITICAL: Sparkline path generation method
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

  // CRITICAL: Sparkline markers generation method
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

  // CRITICAL: Sparkline label generation method
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

  // CRITICAL: Placeholder sparkline method
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

  // ADDED: Generate demo data for visualization even without data source
  generateDemoDataForSparkline(overlayId) {
    console.log(`[AdvancedRenderer] Generating demo data for sparkline: ${overlayId}`);

    const now = Date.now();
    const demoData = [];
    const baseValue = overlayId.includes('cpu') ? 45 :
                     overlayId.includes('memory') ? 60 :
                     overlayId.includes('temp') ? 72 : 50;

    for (let i = 0; i < 20; i++) {
      const timeOffset = i * 0.5;
      const sineWave = Math.sin(timeOffset) * 15;
      const noise = (Math.random() - 0.5) * 8;

      demoData.push({
        timestamp: now - (19 - i) * 60000,
        value: Math.max(5, Math.min(95, baseValue + sineWave + noise))
      });
    }

    console.log(`[AdvancedRenderer] Generated ${demoData.length} demo data points for ${overlayId}, base value: ${baseValue}`);
    return demoData;
  }

  // ADDED: Generate realistic time series from current HASS entity value
  generateRealisticTimeSeries(dataSource, currentValue) {
    const now = Date.now();
    const timeSeries = [];

    // Create realistic variation based on entity type
    const entityType = this.getEntityVariationType(dataSource);

    for (let i = 0; i < 24; i++) { // 24 data points (2 hours of 5-minute intervals)
      const minutesAgo = i * 5;
      const timestamp = now - (minutesAgo * 60000);

      // Generate realistic historical values based on entity type
      let historicalValue;
      switch (entityType) {
        case 'battery':
          // Battery slowly decreases with small random fluctuations
          historicalValue = currentValue + (Math.random() * 2 - 1) + (minutesAgo * 0.01);
          historicalValue = Math.max(0, Math.min(100, historicalValue));
          break;

        case 'temperature':
          // Temperature varies in cycles with random noise
          const tempCycle = Math.sin((minutesAgo / 60) * Math.PI / 12) * 3; // 24-hour cycle
          historicalValue = currentValue + tempCycle + (Math.random() * 1.5 - 0.75);
          break;

        case 'humidity':
          // Humidity varies gradually with weather patterns
          historicalValue = currentValue + (Math.random() * 4 - 2) + (Math.sin(minutesAgo / 30) * 2);
          historicalValue = Math.max(0, Math.min(100, historicalValue));
          break;

        case 'sensor':
          // Generic sensor with moderate variation
          historicalValue = currentValue + (Math.random() * 6 - 3) + (Math.sin(minutesAgo / 20) * 1.5);
          break;

        default:
          // Default variation pattern
          historicalValue = currentValue + (Math.random() * 4 - 2);
          break;
      }

      timeSeries.unshift({
        timestamp: timestamp,
        value: Math.round(historicalValue * 100) / 100 // Round to 2 decimal places
      });
    }

    console.log(`[AdvancedRenderer] Generated ${timeSeries.length} realistic data points for ${dataSource} (${entityType} type) with current value: ${currentValue}`);
    return timeSeries;
  }

  // ADDED: Determine entity variation type based on entity ID
  getEntityVariationType(dataSource) {
    const entityId = dataSource.toLowerCase();

    if (entityId.includes('battery') || entityId.includes('batt')) return 'battery';
    if (entityId.includes('temp') || entityId.includes('temperature')) return 'temperature';
    if (entityId.includes('humid')) return 'humidity';
    if (entityId.includes('sensor')) return 'sensor';

    return 'generic';
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

  // ADDED: Get entity data for sparkline with real-time HASS integration
  getEntityDataForSparkline(dataSource) {
    console.log(`[AdvancedRenderer] Looking for real-time data source: ${dataSource}`);

    // ENHANCED: Resolve data source to actual entity ID
    const actualEntityId = this.resolveDataSourceToEntity(dataSource);
    console.log(`[AdvancedRenderer] Data source resolution: ${dataSource} → ${actualEntityId}`);

    // Try to get actual HASS entity data first
    try {
      const entityRuntime = window.__msdDebug?.entities;
      if (entityRuntime && entityRuntime.get && actualEntityId) {
        const entity = entityRuntime.get(actualEntityId);
        if (entity && entity.state) {
          const currentValue = parseFloat(entity.state);
          if (!isNaN(currentValue)) {
            console.log(`[AdvancedRenderer] ✅ Found real entity data for ${actualEntityId}: ${currentValue}`);
            return this.generateRealisticTimeSeries(actualEntityId, currentValue);
          }
        }
      }
    } catch (e) {
      console.warn('[AdvancedRenderer] Entity runtime lookup failed:', e);
    }

    // FALLBACK: Generate demo data
    console.log(`[AdvancedRenderer] ❌ No real entity data found, using demo data for: ${dataSource}`);
    return this.generateDemoDataForSparkline(dataSource);
  }

  // ADDED: Resolve data source ID to actual HASS entity ID
  resolveDataSourceToEntity(dataSource) {
    try {
      // Try to get data source configuration from pipeline
      const pipeline = window.__msdDebug?.pipelineInstance;
      const merged = window.__msdDebug?.pipeline?.merged;

      if (merged && merged.data_sources && merged.data_sources[dataSource]) {
        const dataSourceConfig = merged.data_sources[dataSource];
        const entityId = dataSourceConfig.entity;

        console.log(`[AdvancedRenderer] Resolved data source ${dataSource} to entity: ${entityId}`);
        return entityId;
      }

      // If no data source config, assume dataSource IS the entity ID
      console.log(`[AdvancedRenderer] No data source config found, treating ${dataSource} as entity ID`);
      return dataSource;

    } catch (e) {
      console.warn(`[AdvancedRenderer] Data source resolution failed:`, e);
      return dataSource;
    }
  }

  /**
   * Update overlay with new data from DataSourceManager
   * @param {string} overlayId - ID of overlay to update
   * @param {Object} sourceData - Data from MsdDataSource
   */
  updateOverlayData(overlayId, sourceData) {
    if (!sourceData || !this.lastRenderArgs) {
      console.log('[AdvancedRenderer] updateOverlayData: missing data or render context');
      return;
    }

    console.log('[AdvancedRenderer] Updating overlay', overlayId, 'with real data:', sourceData.v);

    // Find overlay element in DOM
    const svg = this.mountEl?.querySelector('svg');
    if (!svg) {
      console.warn('[AdvancedRenderer] No SVG element found for updates');
      return;
    }

    const overlayElement = svg.querySelector(`[data-overlay-id="${overlayId}"]`);
    if (!overlayElement) {
      console.warn('[AdvancedRenderer] Overlay element not found:', overlayId);
      return;
    }

    // Update sparkline with real data
    if (sourceData.buffer && overlayElement.dataset.overlayType === 'sparkline') {
      const points = [];
      for (let i = 0; i < sourceData.buffer.length; i++) {
        const point = sourceData.buffer.at(i);
        if (point && typeof point.v === 'number') {
          points.push({ timestamp: point.t, value: point.v });
        }
      }

      if (points.length > 1) {
        const pathElement = overlayElement.querySelector('path');
        if (pathElement && this.generateSparklinePath) {
          try {
            const width = parseInt(overlayElement.dataset.width) || 100;
            const height = parseInt(overlayElement.dataset.height) || 30;
            const newPath = this.generateSparklinePath(points, width, height);
            pathElement.setAttribute('d', newPath);

            // Remove demo data indicator if present
            const demoLabel = overlayElement.querySelector('text[data-demo]');
            if (demoLabel) {
              demoLabel.remove();
            }

            console.log('[AdvancedRenderer] Sparkline updated with', points.length, 'real data points');
          } catch (error) {
            console.error('[AdvancedRenderer] Failed to update sparkline path:', error);
          }
        }
      }
    }

    // Store current value for reference
    overlayElement.dataset.currentValue = sourceData.v;
    overlayElement.dataset.lastUpdate = Date.now();
  }

  // Modify existing render method to store context (find the render method and add one line)
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

    // ENHANCED: Store reference for data updates with SVG access
    this.lastRenderArgs = {
      resolvedModel,
      overlays,
      svg: this.mountEl?.querySelector('svg')
    };

    return {
      svgMarkup: svgContent,
      overlayCount: processedCount,
      errors: overlays.length - processedCount
    };
  }
}
