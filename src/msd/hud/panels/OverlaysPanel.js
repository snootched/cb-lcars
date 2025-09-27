import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [OverlaysPanel] Overlays inspection panel
 * 🎯 Lists resolved overlays with quick highlight and structural info
 */
export class OverlaysPanel {
  captureData() {
    const overlays = [];
    const stats = { total: 0, byType: {} };

    try {
      const pipeline = window.__msdDebug?.pipelineInstance;
      const model = pipeline?.getResolvedModel?.();
      if (model?.overlays) {
        model.overlays.forEach(o => {
          stats.total++;
            stats.byType[o.type] = (stats.byType[o.type] || 0) + 1;
          overlays.push({
            id: o.id,
            type: o.type || 'unknown',
            anchor: o.anchor,
            attach_to: o.attach_to,
            profileCount: Array.isArray(o._profiles) ? o._profiles.length : 0,
            patchCount: Array.isArray(o._patches) ? o._patches.length : 0,
            styleSourceCount: Array.isArray(o._styleSources) ? o._styleSources.length : 0,
            finalStyle: o.finalStyle || o.style || {},
            smooth: o.smooth,
            channel: o.channel,
            meta: {
              fromPacks: o.__meta?.origin_pack,
              overridden: !!o.__meta?.overridden
            }
          });
        });
      }
    } catch (e) {
      cblcarsLog.warn('[OverlaysPanel] ⚠️ captureData failed:', e);
    }

    return { overlays, stats };
  }

  // REPLACED: Simplified, mount-scoped highlight with SVG-safe styling
  highlightOverlay(id) {
    try {
      if (!id) return;
      const mount = window.__msdDebug?.pipelineInstance?.mountElement ||
                    window.__msdDebug?.mountElement;
      if (!mount) {
        cblcarsLog.warn('[OverlaysPanel] ⚠️ No mountElement available for highlight');
        return;
      }

      this._ensureHighlightStyles();

      // ADDED: Get overlay type to handle controls differently
      const overlay = this._findOverlayModel(id);
      const isControlsType = overlay?.type === 'control'; // FIXED: singular 'control' not 'controls'

      cblcarsLog.debug(`[OverlaysPanel] 🎯 Overlay "${id}":`, overlay);
      cblcarsLog.debug(`[OverlaysPanel] 🏷️ Overlay type: "${overlay?.type}", isControlsType: ${isControlsType}`);

      // Search only inside mount (and shadow root if present)
      const roots = [mount];
      if (mount.shadowRoot) roots.push(mount.shadowRoot);

      const matches = [];
      const selectorExact = `[data-overlay-id="${CSS.escape(id)}"]`;
      const selectorId = `#${CSS.escape(id)}`;

      // ADDED: For controls type, search for the control containers (much simpler!)
      const controlsSelectors = isControlsType ? [
        `foreignObject[data-msd-control-id="${CSS.escape(id)}"]`,
        `div[data-msd-control-id="${CSS.escape(id)}"]`,
        `#msd-control-foreign-${CSS.escape(id)}`
      ] : [];

      roots.forEach(root => {
        cblcarsLog.debug(`[OverlaysPanel] 🔍 Searching in root:`, root);

        // Try standard selectors first
        const exactMatches = root.querySelectorAll(selectorExact);
        const byIdMatch = root.querySelector(selectorId);
        cblcarsLog.debug(`[OverlaysPanel] 🎯 Standard selectors for "${id}":`, {
          selectorExact: selectorExact,
          exactMatches: exactMatches.length,
          selectorId: selectorId,
          byIdMatch: !!byIdMatch
        });

        exactMatches.forEach(el => matches.push(el));
        if (byIdMatch && !matches.includes(byIdMatch)) matches.push(byIdMatch);

        // ADDED: Search for controls-specific elements
        if (isControlsType) {
          cblcarsLog.debug(`[OverlaysPanel] 🎮 Searching for controls overlay: ${id}`);
          cblcarsLog.debug(`[OverlaysPanel] 🎯 Controls selectors:`, controlsSelectors);
          controlsSelectors.forEach(selector => {
            try {
              const found = root.querySelectorAll(selector);
              cblcarsLog.debug(`[OverlaysPanel] 📋 Selector "${selector}" found ${found.length} elements:`, found);
              found.forEach(el => {
                if (!matches.includes(el)) matches.push(el);
              });
            } catch (e) {
              cblcarsLog.warn(`[OverlaysPanel] ⚠️ Invalid selector: ${selector}`, e);
            }
          });
        } else {
          cblcarsLog.debug(`[OverlaysPanel] 🚫 Not a controls type overlay, skipping controls selectors`);
        }
      });

      cblcarsLog.info(`[OverlaysPanel] 📊 Total matches found: ${matches.length}`, matches);

      if (matches.length === 0) {
        cblcarsLog.warn('[OverlaysPanel] ❌ No nodes found for overlay', id);
        this._toast(`Overlay not found: ${id}`, '#ff4444');
        return;
      }

      // Apply highlight to each match
      matches.forEach(node => {
        if (isControlsType) {
          // ADDED: Special highlighting for controls type
          this._applyControlsHighlight(node, '#ff66ff');
        } else {
          this._applyElementHighlight(node, '#ff66ff');
          // If group/container, highlight child paths too
          if (node.tagName && node.tagName.toLowerCase() === 'g') {
            node.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse').forEach(child => {
              this._applyElementHighlight(child, '#ff66ff', true);
            });
          }
        }
      });

      this._toast(`Overlay: ${id} (${overlay?.type || 'unknown'})`, '#ff66ff');
    } catch (e) {
      cblcarsLog.warn('[OverlaysPanel] ⚠️ highlightOverlay failed:', e);
    }
  }

  // NEW: Special highlighting for controls type overlays (HA cards)
  _applyControlsHighlight(node, color) {
    const DURATION = 3000;

    // Store originals for restoration
    if (!node.dataset._msdCtrlHl) {
      node.dataset._msdCtrlHl = '1';
      node.dataset._msdPrevBoxShadow = node.style.boxShadow || '';
      node.dataset._msdPrevZIndex = node.style.zIndex || '';
      node.dataset._msdPrevOutline = node.style.outline || '';
      node.dataset._msdPrevFilter = node.style.filter || '';
    }

    // FIXED: Apply glow/pulse highlighting without scaling to avoid position shifts
    node.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}, inset 0 0 15px rgba(255,102,255,0.2)`;
    node.style.zIndex = '999999';
    node.style.outline = `2px solid ${color}`;
    node.style.outlineOffset = '2px';
    node.style.filter = `drop-shadow(0 0 8px ${color}) brightness(1.1)`;
    node.classList.add('msd-overlay-highlighted', 'msd-controls-highlighted');

    // Enhanced pulsing animation without transform scaling
    const pulseStyle = document.createElement('style');
    pulseStyle.id = `msd-pulse-${node.dataset._msdCtrlHl}`;
    pulseStyle.textContent = `
      .msd-controls-highlighted {
        animation: msdControlsPulse 1.2s ease-in-out infinite alternate;
      }
      @keyframes msdControlsPulse {
        0% {
          filter: drop-shadow(0 0 8px ${color}) brightness(1.1) saturate(1);
          box-shadow: 0 0 15px ${color}, 0 0 30px ${color}, inset 0 0 15px rgba(255,102,255,0.2);
        }
        100% {
          filter: drop-shadow(0 0 12px ${color}) brightness(1.3) saturate(1.2);
          box-shadow: 0 0 20px ${color}, 0 0 40px ${color}, inset 0 0 20px rgba(255,102,255,0.3);
        }
      }
    `;
    document.head.appendChild(pulseStyle);

    setTimeout(() => {
      // Restore original styles
      if (node.dataset._msdPrevBoxShadow !== undefined) {
        if (node.dataset._msdPrevBoxShadow) node.style.boxShadow = node.dataset._msdPrevBoxShadow;
        else node.style.removeProperty('box-shadow');
      }
      if (node.dataset._msdPrevZIndex !== undefined) {
        if (node.dataset._msdPrevZIndex) node.style.zIndex = node.dataset._msdPrevZIndex;
        else node.style.removeProperty('z-index');
      }
      if (node.dataset._msdPrevOutline !== undefined) {
        if (node.dataset._msdPrevOutline) node.style.outline = node.dataset._msdPrevOutline;
        else node.style.removeProperty('outline');
      }
      if (node.dataset._msdPrevFilter !== undefined) {
        if (node.dataset._msdPrevFilter) node.style.filter = node.dataset._msdPrevFilter;
        else node.style.removeProperty('filter');
      }
      node.style.removeProperty('outline-offset');
      node.classList.remove('msd-overlay-highlighted', 'msd-controls-highlighted');

      // Remove pulse animation
      const pulse = document.getElementById(`msd-pulse-${node.dataset._msdCtrlHl}`);
      if (pulse) pulse.remove();
    }, DURATION);
  }

  // NEW: Apply highlight with restoration
  _applyElementHighlight(node, color, isChild = false) {
    const tag = (node.tagName || '').toLowerCase();
    const isSvg =
      ['path','g','line','polyline','polygon','rect','circle','ellipse'].includes(tag) ||
      node instanceof SVGElement;

    const DURATION = 3000;

    if (isSvg) {
      // Store originals only once
      if (!node.dataset._msdHl) {
        node.dataset._msdHl = '1';
        node.dataset._msdPrevStroke = node.getAttribute('stroke') || node.style.stroke || '';
        node.dataset._msdPrevStrokeW = node.getAttribute('stroke-width') || node.style.strokeWidth || '';
        node.dataset._msdPrevFilter = node.style.filter || '';
      }
      // Emphasize
      node.style.stroke = color;
      if (tag !== 'g') {
        node.style.strokeWidth = '4';
      }
      node.style.filter = 'drop-shadow(0 0 6px ' + color + ')';
      node.classList.add('msd-overlay-highlighted');

      setTimeout(() => {
        // Restore
        if (node.dataset._msdPrevStroke !== undefined) {
          if (node.dataset._msdPrevStroke) node.style.stroke = node.dataset._msdPrevStroke;
          else node.style.removeProperty('stroke');
        }
        if (node.dataset._msdPrevStrokeW !== undefined) {
            if (node.dataset._msdPrevStrokeW) node.style.strokeWidth = node.dataset._msdPrevStrokeW;
            else node.style.removeProperty('stroke-width');
        }
        if (node.dataset._msdPrevFilter !== undefined) {
          if (node.dataset._msdPrevFilter) node.style.filter = node.dataset._msdPrevFilter;
          else node.style.removeProperty('filter');
        }
        node.classList.remove('msd-overlay-highlighted');
      }, DURATION);

    } else {
      // Non-SVG element highlight
      if (!node.dataset._msdHlBox) {
        node.dataset._msdHlBox = '1';
        node.dataset._msdPrevOutline = node.style.outline || '';
        node.dataset._msdPrevBoxShadow = node.style.boxShadow || '';
        node.dataset._msdPrevFilter = node.style.filter || '';
      }
      node.style.outline = `3px solid ${color}`;
      node.style.boxShadow = `0 0 10px ${color}`;
      node.style.filter = `drop-shadow(0 0 6px ${color})`;
      node.classList.add('msd-overlay-highlighted');

      setTimeout(() => {
        if (node.dataset._msdPrevOutline !== undefined) {
          if (node.dataset._msdPrevOutline) node.style.outline = node.dataset._msdPrevOutline;
          else node.style.removeProperty('outline');
        }
        if (node.dataset._msdPrevBoxShadow !== undefined) {
          if (node.dataset._msdPrevBoxShadow) node.style.boxShadow = node.dataset._msdPrevBoxShadow;
          else node.style.removeProperty('box-shadow');
        }
        if (node.dataset._msdPrevFilter !== undefined) {
          if (node.dataset._msdPrevFilter) node.style.filter = node.dataset._msdPrevFilter;
          else node.style.removeProperty('filter');
        }
        node.classList.remove('msd-overlay-highlighted');
      }, DURATION);
    }
  }

  // UPDATED: ensure styles (kept minimal)
  _ensureHighlightStyles() {
    if (document.getElementById('msd-overlay-highlight-style')) return;
    const style = document.createElement('style');
    style.id = 'msd-overlay-highlight-style';
    style.textContent = `
      .msd-overlay-highlighted {
        transition: outline .15s, box-shadow .15s;
      }
    `;
    document.head.appendChild(style);
  }

  analyzeOverlay(id) {
    try {
      const pipeline = window.__msdDebug?.pipelineInstance;
      const model = pipeline?.getResolvedModel?.();
      const overlay = model?.overlays?.find(o => o.id === id);
      if (!overlay) {
        cblcarsLog.warn('[OverlaysPanel] ❌ analyzeOverlay: overlay not found', id);
        this._toast('Overlay not found', '#ff4444');
        return;
      }

      // Console diagnostics
      console.group(`🛰 Overlay Analysis: ${id}`);
      console.table([{
        id: overlay.id,
        type: overlay.type,
        anchor: overlay.anchor,
        attach_to: overlay.attach_to,
        channel: overlay.channel,
        smooth: overlay.smooth,
        profiles: (overlay._profiles || []).length,
        patches: (overlay._patches || []).length,
        styleSources: (overlay._styleSources || []).length
      }]);
      if (overlay.finalStyle || overlay.style) {
        console.log('Final Style:', overlay.finalStyle || overlay.style);
      }
      if (overlay._styleSources) {
        console.log('Style Sources (detailed):', overlay._styleSources);
        // ADDED: Log each source individually for debugging
        overlay._styleSources.forEach((source, i) => {
          cblcarsLog.debug(`[OverlaysPanel] 📋 Source ${i}:`, source);
        });
      }
      if (overlay._patches) {
        cblcarsLog.debug('[OverlaysPanel] 🔄 Rule Patches:', overlay._patches);
      }
      if (overlay.__meta) {
        cblcarsLog.debug('[OverlaysPanel] 🏷️ Metadata:', overlay.__meta);
      }
      // ADDED: Log full overlay object for debugging
      cblcarsLog.debug('[OverlaysPanel] 📊 Full Overlay Object:', overlay);
      console.groupEnd();

      // Popup
      this._showOverlayPopup(overlay);
    } catch (e) {
      cblcarsLog.warn('[OverlaysPanel] ⚠️ analyzeOverlay failed:', e);
    }
  }

  _showOverlayPopup(overlay) {
    const existing = document.getElementById('msd-overlay-popup');
    if (existing) existing.remove();

    // ADDED: Get proportional font sizes for popup
    const baseFontSize = window.__msdDebug?.hud?.manager?.state?.fontSize || 14;
    const sectionFontSize = Math.round(baseFontSize * 1.0); // 12px when base is 12px
    const metricFontSize = Math.round(baseFontSize * 0.92); // 11px when base is 12px
    const controlsFontSize = Math.round(baseFontSize * 0.83); // 10px when base is 12px
    const smallFontSize = Math.round(baseFontSize * 0.75); // 9px when base is 12px
    const tinyFontSize = Math.round(baseFontSize * 0.67); // 8px when base is 12px

    const popup = document.createElement('div');
    popup.id = 'msd-overlay-popup';
    popup.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);color:#ff66ff;
      border:2px solid #ff66ff;border-radius:8px;
      padding:14px 16px;z-index:1000003;
      font-family:monospace;font-size:${sectionFontSize}px;
      max-width:480px;max-height:70vh;overflow:auto;
      box-shadow:0 4px 18px rgba(255,102,255,0.4);
    `;

    const stylePreview = (() => {
      try {
        const s = JSON.stringify(overlay.finalStyle || overlay.style || {}, null, 2);
        return s.length > 520 ? s.slice(0, 517) + '...' : s;
      } catch { return '{}'; }
    })();

    const sources = (overlay._styleSources || []).map(s => `${s.kind}:${s.id}`).join(', ') || 'none';
    const patches = (overlay._patches || []).map(p => p.ruleId || p.id).join(', ') || 'none';
    const profiles = (overlay._profiles || []).map(p => p.id || p).join(', ') || 'none';

    // ADDED: Enhanced sources breakdown showing properties from each source
    const sourcesDetail = (() => {
      if (!overlay._styleSources || overlay._styleSources.length === 0) return 'none';

      try {
        const finalStyleProps = overlay.finalStyle ? Object.keys(overlay.finalStyle) : [];
        cblcarsLog.debug('[OverlaysPanel] 🎨 Final style properties:', finalStyleProps);
        cblcarsLog.debug('[OverlaysPanel] 🔢 Number of sources:', overlay._styleSources.length);

        // FIXED: Show each property individually with its source
        const propertyMappings = [];

        overlay._styleSources.forEach((source, index) => {
          const sourceLabel = `${source.kind || 'unknown'}:${source.id || `source-${index}`}`;

          // Match source index to property index
          if (index < finalStyleProps.length) {
            const property = finalStyleProps[index];
            propertyMappings.push(`${property} <span style="color:#ffaa00;font-weight:bold;font-size:${Math.round(controlsFontSize * 1.3)}px;"> ◀ </span> ${sourceLabel}`);
            cblcarsLog.debug(`[OverlaysPanel] 🔗 Source ${index} (${sourceLabel}) → ${property}`);
          }
        });

        // If we have more properties than sources, the remaining might be from defaults
        if (finalStyleProps.length > overlay._styleSources.length) {
          const remainingProps = finalStyleProps.slice(overlay._styleSources.length);
          remainingProps.forEach(prop => {
            propertyMappings.push(`${prop} <span style="color:#ffaa00;font-weight:bold;font-size:${Math.round(controlsFontSize * 1.3)}px;"> ◀ </span> default:computed`);
          });
        }

        // Format as individual property lines
        return propertyMappings.join('<br>') || 'none';
      } catch (e) {
        cblcarsLog.warn('[OverlaysPanel] ⚠️ Error processing sources:', e);
        // Fallback to simple list
        return overlay._styleSources.map((s, i) => `property${i} <span style="color:#ffaa00;font-weight:bold;font-size:${Math.round(controlsFontSize * 1.3)}px;"> ◀ </span> ${s.kind || 'unknown'}:${s.id || 'unnamed'}`).join('<br>');
      }
    })();    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h3 style="margin:0;color:#ffaaee;">Overlay: ${overlay.id}</h3>
        <button style="background:#331133;color:#fff;border:1px solid #553366;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:${metricFontSize}px;"
          onclick="document.getElementById('msd-overlay-popup')?.remove()">
          Close
        </button>
      </div>
      <div style="font-size:${metricFontSize}px;line-height:1.4;color:#ddd;">
        <strong>Type:</strong> ${overlay.type || 'n/a'}<br>
        <strong>Anchor:</strong> ${overlay.anchor || 'none'} → <strong>Attach:</strong> ${overlay.attach_to || 'none'}<br>
        <strong>Channel:</strong> ${overlay.channel || 'none'} | <strong>Smooth:</strong> ${overlay.smooth ? 'yes':'no'}<br>
        <strong>Profiles:</strong> ${profiles}<br>
        <strong>Sources:</strong><br>
        <div style="margin-left:12px;font-size:${controlsFontSize}px;color:#bbb;line-height:1.3;">
          ${sourcesDetail}
        </div>
        <strong>Patches:</strong> ${patches}<br>
        <strong>Meta:</strong> ${overlay.__meta ? Object.keys(overlay.__meta).join(', ') : 'none'}
      </div>
      <div style="margin-top:8px;">
        <div style="color:#ffaaee;font-size:${metricFontSize}px;margin-bottom:4px;">Final Style</div>
        <pre style="margin:0;background:#111;color:#ccc;padding:8px;border:1px solid #552255;border-radius:4px;font-size:${controlsFontSize}px;max-height:200px;overflow:auto;">${stylePreview}</pre>
      </div>
      <div style="margin-top:8px;text-align:right;">
        <button
          style="background:#552255;color:#fff;border:1px solid #aa55aa;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:${metricFontSize}px;"
          onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(overlay.finalStyle || overlay.style || {})},null,2))">
          Copy Style
        </button>
        <button
          style="background:#331133;color:#fff;border:1px solid #553366;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:${metricFontSize}px;margin-left:6px;"
          onclick="document.getElementById('msd-overlay-popup')?.remove()">
          Done
        </button>
      </div>
    `;

    document.body.appendChild(popup);
    setTimeout(() => {
      if (popup.parentElement) popup.style.opacity = '1';
    }, 10);

    // REMOVED: Auto-close timeout - let users close manually
    // setTimeout(() => popup.parentElement && popup.remove(), 25000);
  }

  // NEW: analyzeOverlay remains (unchanged) above/below if already present

  // NEW helper: ensure CSS
  _ensureHighlightStyles() {
    if (document.getElementById('msd-overlay-highlight-style')) return;
    const style = document.createElement('style');
    style.id = 'msd-overlay-highlight-style';
    style.textContent = `
      .msd-overlay-highlighted {
        transition: outline .15s, box-shadow .15s;
      }
    `;
    document.head.appendChild(style);
  }

  // NEW helper: locate overlay model object
  _findOverlayModel(id) {
    try {
      const model = window.__msdDebug?.pipelineInstance?.getResolvedModel?.();
      return model?.overlays?.find(o => o.id === id);
    } catch {
      return null;
    }
  }

  // NEW helper: create bounding box from overlay anchor + attach_to if anchors exist
  _highlightBoundingBoxFromModel(overlay, id) {
    try {
      const anchorId = overlay.anchor;
      const attachId = overlay.attach_to;
      const mount =
        window.__msdDebug?.pipelineInstance?.mountElement ||
        window.__msdDebug?.mountElement ||
        document;

      const anchorEl = anchorId ? mount.querySelector(`[data-anchor-id="${CSS.escape(anchorId)}"],#${CSS.escape(anchorId)}`) : null;
      const attachEl = attachId ? mount.querySelector(`[data-anchor-id="${CSS.escape(attachId)}"],#${CSS.escape(attachId)}`) : null;

      if (!anchorEl && !attachEl) {
        // fallback to mount bounding box
        const rect = mount.getBoundingClientRect();
        this._spawnBoundingBox(rect, id, '#ff66ff');
        return;
      }

      // Compute combined rect
      const rects = [];
      if (anchorEl) rects.push(anchorEl.getBoundingClientRect());
      if (attachEl) rects.push(attachEl.getBoundingClientRect());

      const minX = Math.min(...rects.map(r => r.left));
      const minY = Math.min(...rects.map(r => r.top));
      const maxR = Math.max(...rects.map(r => r.right));
      const maxB = Math.max(...rects.map(r => r.bottom));

      this._spawnBoundingBox(
        { left: minX, top: minY, width: maxR - minX, height: maxB - minY },
        id,
        '#ff66ff'
      );
    } catch (e) {
      cblcarsLog.warn('[OverlaysPanel] ⚠️ _highlightBoundingBoxFromModel failed:', e);
    }
  }

  // NEW helper: spawn absolute box
  _spawnBoundingBox(rect, id, color) {
    if (!rect) return;
    const box = document.createElement('div');
    box.className = 'msd-overlay-box-highlight';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    box.dataset.overlayBoxFor = id;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3000);
    this._toast(`Overlay (bbox): ${id}`, color);
  }

  _toast(msg, color = '#ff66ff') {
    // ADDED: Get proportional font size for toast
    const baseFontSize = window.__msdDebug?.hud?.manager?.state?.fontSize || 14;
    const controlsFontSize = Math.round(baseFontSize * 0.83); // 10px when base is 12px

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:18px;right:18px;
      background:#000;padding:4px 10px;
      border:1px solid ${color};color:${color};
      font:${controlsFontSize}px monospace;z-index:1000002;
      border-radius:4px;opacity:.95;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  renderHtml(data) {
    const { overlays = [], stats = {} } = data;

    // ADDED: Get font size from HUD manager context for proportional scaling
    const baseFontSize = window.__msdDebug?.hud?.manager?.state?.fontSize || 14;
    const metricFontSize = Math.round(baseFontSize * 0.92); // 11px when base is 12px
    const controlsFontSize = Math.round(baseFontSize * 0.83); // 10px when base is 12px
    const smallFontSize = Math.round(baseFontSize * 0.75); // 9px when base is 12px
    const tinyFontSize = Math.round(baseFontSize * 0.67); // 8px when base is 12px

    let html = '<div class="msd-hud-panel"><h3>Overlays</h3>';
    html += `<style>
      .msd-overlay-highlighted { outline:3px solid #ff66ff !important; }
    </style>`;
    html += '<div class="msd-hud-section"><h4>Stats</h4>';
    html += `<div class="msd-hud-metric"><span class="msd-hud-metric-name">Total</span><span class="msd-hud-metric-value">${stats.total || 0}</span></div>`;
    Object.entries(stats.byType || {}).slice(0,6).forEach(([type,count]) => {
      html += `<div class="msd-hud-metric" style="font-size:${controlsFontSize}px;">
        <span class="msd-hud-metric-name">${type}</span>
        <span class="msd-hud-metric-value">${count}</span>
      </div>`;
    });
    html += '</div>';

    if (!overlays.length) {
      html += '<div class="msd-hud-section">No overlays</div></div>';
      return html;
    }

    html += '<div class="msd-hud-section"><h4>Overlay List</h4>';
    overlays.slice(0,25).forEach(o => {
      const shortId = o.id.length > 22 ? o.id.slice(0,19)+'...' : o.id;
      const badge = o.meta.overridden ? ' • mod' : '';
      const stylePreview = (() => {
        try {
          const json = JSON.stringify(o.finalStyle);
          return json.length > 50 ? json.slice(0,47)+'...' : json;
        } catch { return ''; }
      })();
      html += `<div
        data-select-type="overlay"
        data-select-id="${o.id}"
        style="cursor:pointer;border:1px solid #222;padding:4px;border-radius:4px;margin:4px 0;"
        onclick="__msdHudBus('select:set',{type:'overlay',id:'${o.id}',source:'overlays'});__msdHudBus('overlay:highlight',{id:'${o.id}'})"
      >
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#aaa;">${shortId}${badge}</span>
          <span style="color:#ff66ff;font-size:${metricFontSize}px;">${o.type}</span>
        </div>
        <div style="font-size:${controlsFontSize}px;color:#888;margin-top:2px;">
          ${o.anchor ? `Anchor: ${o.anchor}` : 'No anchor'} ${o.attach_to ? `<span style="color:#ffaa00;font-weight:bold;font-size:${Math.round(controlsFontSize * 1.2)}px;"> ➤ </span>${o.attach_to}` : ''} ${o.channel ? `• Channel: ${o.channel}` : ''} ${o.smooth ? '• Smooth' : ''}
        </div>
        <div style="font-size:${controlsFontSize}px;color:#666;margin-top:2px;">
          Sources: ${o.styleSourceCount} • Profiles: ${o.profileCount} • Patches: ${o.patchCount}
        </div>
        <div style="font-size:${smallFontSize}px;color:#555;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">
          ${stylePreview}
        </div>
        <div style="margin-top:4px;text-align:right;">
          <button
            onclick="event.stopPropagation();__msdHudBus('overlay:highlight',{id:'${o.id}'});__msdHudBus('overlay:analyze',{id:'${o.id}'})"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#331133;color:#ffccff;border:1px solid #553355;border-radius:3px;cursor:pointer;">
            Analyze
          </button>
        </div>
      </div>`;
    });
    if (overlays.length > 25) {
      html += `<div style="font-size:${smallFontSize}px;opacity:.6;text-align:center;margin-top:4px;">... ${overlays.length - 25} more</div>`;
    }
    html += '</div></div>';
    return html;
  }
}
