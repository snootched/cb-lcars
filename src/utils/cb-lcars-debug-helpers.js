/**
 * CB-LCARS Debug Helpers
 * Visual + console debugging for MSD geometry, connectors, anchors, perf (timers + counters), validation badge.
 *
 * Debug Flags (msd.debug YAML or window.cblcars.debug.setFlags):
 *   overlay: true       - anchor dots, overlay bbox rectangles, validation badge (E: W)
 *   connectors: true    - connector endpoint helper (dashed lines)
 *   perf: true          - perf HUD (Timers + Counters)
 *   geometry: true      - console geometry dump
 *   counters: false     - (optional) hide counters subsection in perf HUD
 *
 * Additions in this patched version:
 *  - Early panel render even if no timers/counters yet (“(none yet)” placeholders)
 *  - preseedPerfCounters() utility to create counter rows immediately
 *  - Exported logGeometry (to satisfy external imports)
 *  - Auto‑refresh recommended from callers; HUD tolerant to empty data
 */

import * as geo from './cb-lcars-geometry-utils.js';
import { cblcarsLog, cblcarsGetGlobalLogLevel } from './cb-lcars-logging.js';

/* -------------------------------------------------
 * Perf timer store (independent from window.cblcars.perf)
 * ------------------------------------------------- */
const PERF_STORE = (() => {
  window.cblcars = window.cblcars || {};
  window.cblcars._perfStats = window.cblcars._perfStats || { labels: {}, _active: {} };
  return window.cblcars._perfStats;
})();

/** Start a debug perf timer */
export function perfStart(label) {
  if (!label) return;
  PERF_STORE._active[label] = performance.now();
}

/** End a debug perf timer */
export function perfEnd(label) {
  const t0 = PERF_STORE._active[label];
  if (t0 == null) return;
  delete PERF_STORE._active[label];
  const dt = performance.now() - t0;
  const s = PERF_STORE.labels[label] || (PERF_STORE.labels[label] = {
    count: 0, totalMs: 0, lastMs: 0, maxMs: 0, avgMs: 0
  });
  s.count += 1;
  s.totalMs += dt;
  s.lastMs = dt;
  s.maxMs = Math.max(s.maxMs, dt);
  s.avgMs = s.totalMs / s.count;
  cblcarsLog.debug('[debug.perf]', {
    label, ms: Number(dt.toFixed(2)),
    count: s.count,
    avg: Number(s.avgMs.toFixed(2)),
    max: Number(s.maxMs.toFixed(2))
  });
  return dt;
}
export function perfGet(label) {
  return label ? PERF_STORE.labels[label] : PERF_STORE.labels;
}
export function perfReset(label) {
  if (label) delete PERF_STORE.labels[label];
  else PERF_STORE.labels = {};
}
export function perfClearActive() {
  PERF_STORE._active = {};
}

/* -------------------------------------------------
 * Internal helpers
 * ------------------------------------------------- */
function getFlags(root, explicit) {
  const globalFlags = window.cblcars?._debugFlags || {};
  const localFlags = root.__cblcars_debugFlags || {};
  return { ...globalFlags, ...localFlags, ...(explicit || {}) };
}
function ensureDebugGroup(root) {
  const svg = geo.getReferenceSvg(root);
  if (!svg) return null;
  let g = svg.querySelector('#cblcars-debug-layer');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'cblcars-debug-layer';
    g.style.pointerEvents = 'none';
    svg.appendChild(g);
  }
  return g;
}
function makeText(vb, lines, x, y, fill, fs, opacity) {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('fill', fill);
  text.setAttribute('font-size', String(fs));
  text.setAttribute('font-family', 'monospace');
  text.setAttribute('opacity', String(opacity));
  let span = '';
  const lh = Math.round(fs * 1.2);
  lines.forEach((ln, i) => {
    span += `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${ln}</tspan>`;
  });
  text.innerHTML = span;
  return { text, height: lh * (lines.length - 1) + fs };
}

/** Validation badge (E: W) */
function renderValidationBadge(g, viewBox, counts) {
  const e = Number(counts?.errors || 0);
  const w = Number(counts?.warnings || 0);
  if (e + w <= 0) return;
  const [, , vw, vh] = viewBox;
  const fs = Math.max(8, Math.round(vh * 0.018));
  const padX = 8;
  const padY = 6;
  const textStr = `E:${e} W:${w}`;
  const charW = fs * 0.6;
  const width = padX * 2 + textStr.length * charW;
  const height = fs + padY * 2;
  const xRight = viewBox[0] + vw - width - 6;
  const yTop = viewBox[1] + 6;

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(xRight));
  bg.setAttribute('y', String(yTop));
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('rx', String(Math.round(fs * 0.4)));
  bg.setAttribute('ry', String(Math.round(fs * 0.4)));
  bg.setAttribute('fill', 'rgba(20,0,0,0.6)');
  bg.setAttribute('stroke', e > 0 ? '#ff0033' : '#ffaa33');
  bg.setAttribute('stroke-width', '1.5');

  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', String(xRight + padX));
  t.setAttribute('y', String(yTop + fs + (padY - 2)));
  t.setAttribute('fill', '#ffccaa');
  t.setAttribute('font-size', String(fs));
  t.setAttribute('font-family', 'monospace');
  t.textContent = textStr;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-layer', 'validation-badge');
  group.appendChild(bg);
  group.appendChild(t);
  g.appendChild(group);
}

/**
 * Perf HUD (Timers + Counters) – always shows panel when perf flag is set.
 */
function renderPerfHUD(g, viewBox) {
  const flags = window.cblcars?._debugFlags || {};
  const showCounters = flags.counters !== false; // default true

  const timers = perfGet();
  const timerLabels = Object.keys(timers);
  const counters = showCounters && window.cblcars?.perf?.dump ? window.cblcars.perf.dump() : {};
  const counterKeys = Object.keys(counters);

  const haveTimers = timerLabels.length > 0;
  const haveCounters = counterKeys.length > 0;

  const [, , , vh] = viewBox;
  const fs = Math.max(8, Math.round(vh * 0.017));
  const lines = [];

  if (haveTimers) {
    lines.push('Timers');
    timerLabels.forEach(label => {
      const s = timers[label];
      lines.push(`${label}: last=${s.lastMs.toFixed(2)}ms avg=${s.avgMs.toFixed(2)} max=${s.maxMs.toFixed(1)} n=${s.count}`);
    });
  } else {
    lines.push('Timers', '(none yet)');
  }

  if (showCounters) {
    if (haveCounters) {
      lines.push('Counters');
      counterKeys
        .sort((a, b) => {
          const aa = counters[a];
          const bb = counters[b];
          const ta = aa.totalMs || 0;
          const tb = bb.totalMs || 0;
            if (ta !== tb) return tb - ta;
          return (bb.count || 0) - (aa.count || 0);
        })
        .slice(0, 40)
        .forEach(k => {
          const c = counters[k];
          const timePart = c.count && c.totalMs ? ` avg=${c.avgMs.toFixed(1)}ms` : '';
          lines.push(`${k}: c=${c.count}${timePart}`);
        });
      if (counterKeys.length > 40) lines.push(`(+${counterKeys.length - 40} more)`);
    } else {
      lines.push('Counters', '(none yet)');
    }
  }

  const x = viewBox[0] + 6;
  const y = viewBox[1] + 8;
  const { text, height } = makeText(viewBox, lines, x + 8, y + fs + 4, '#ffd5ff', fs, 0.92);
  const panel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const widthPx = Math.max(
    220,
    Math.min(
      520,
      lines.reduce((m, ln) => Math.max(m, ln.length), 0) * fs * 0.6 + 24
    )
  );
  panel.setAttribute('x', String(viewBox[0] + 4));
  panel.setAttribute('y', String(viewBox[1] + 4));
  panel.setAttribute('width', String(widthPx));
  panel.setAttribute('height', String(height + fs + 16));
  panel.setAttribute('fill', 'rgba(30,0,40,0.55)');
  panel.setAttribute('stroke', '#ff00ff');
  panel.setAttribute('stroke-width', '1');

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-layer', 'perf');
  group.appendChild(panel);
  group.appendChild(text);
  g.appendChild(group);
}

/** Console geometry log */
export function logGeometry(root) {
  const svg = geo.getReferenceSvg(root);
  const vb = geo.getViewBox(root, svg);
  const pair = svg ? geo.getCtmPair(svg) : null;
  const wrapper = root.querySelector?.('#cblcars-msd-wrapper');
  const host = root.getElementById?.('cblcars-controls-layer');
  cblcarsLog.debug('[debug.geometry] viewBox:', vb);
  cblcarsLog.debug('[debug.geometry] CTM:', pair?.ctm || null);
  cblcarsLog.debug('[debug.geometry] wrapper rect:', wrapper?.getBoundingClientRect?.());
  cblcarsLog.debug('[debug.geometry] controls host rect:', host?.getBoundingClientRect?.());
}

/* Endpoint helper reused for connector debug */
function endpointOnBox(anchor, box, { side = 'auto', align = 'center', gap = 12 } = {}) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let pick = side;
  if (pick === 'auto') {
    const dx = anchor[0] - cx;
    const dy = anchor[1] - cy;
    pick = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom');
  }
  const alignStr = String(align || 'center').toLowerCase().trim();
  let t = 0.5;
  if (alignStr === 'start') t = 0;
  else if (alignStr === 'end') t = 1;
  else if (alignStr === 'toward-anchor') {
    if (pick === 'left' || pick === 'right') t = Math.max(0, Math.min(1, (anchor[1] - box.y) / (box.h || 1)));
    else t = Math.max(0, Math.min(1, (anchor[0] - box.x) / (box.w || 1)));
  } else if (alignStr.startsWith('percent:')) {
    const raw = Number(alignStr.split(':')[1]);
    t = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0.5));
  }
  let x, y;
  if (pick === 'left') { x = box.x - gap; y = box.y + t * box.h; }
  else if (pick === 'right') { x = box.x + box.w + gap; y = box.y + t * box.h; }
  else if (pick === 'top') { y = box.y - gap; x = box.x + t * box.w; }
  else { y = box.y + box.h + gap; x = box.x + t * box.w; }
  return [x, y];
}
function targetBoxInViewBox(root, id, viewBox) {
  const el = root.getElementById?.(id);
  if (!el) return null;
  const isSvg = !!el.namespaceURI && String(el.namespaceURI).includes('svg');
  if (isSvg && typeof el.getBBox === 'function') {
    try {
      const bb = el.getBBox();
      return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    } catch (_) {}
  }
  const svg = geo.getReferenceSvg(root);
  const pxRect = el.getBoundingClientRect?.();
  if (svg && pxRect && pxRect.width > 0 && pxRect.height > 0) {
    const vbRect = geo.screenRectToViewBox(svg, pxRect);
    if (vbRect) return vbRect;
  }
  const host = root.getElementById?.('cblcars-controls-layer');
  const hostRect = host?.getBoundingClientRect?.();
  if (hostRect && pxRect && hostRect.width > 0 && hostRect.height > 0) {
    const [minX, minY, vw, vh] = viewBox || [0, 0, 100, 100];
    return {
      x: minX + ((pxRect.left - hostRect.left) / hostRect.width) * vw,
      y: minY + ((pxRect.top - hostRect.top) / hostRect.height) * vh,
      w: (pxRect.width / hostRect.width) * vw,
      h: (pxRect.height / hostRect.height) * vh
    };
  }
  return null;
}

/* -------------------------------------------------
 * Main renderer
 * ------------------------------------------------- */
export function renderDebugLayer(root, viewBox = [0, 0, 100, 100], opts = {}) {
  const flags = getFlags(root, opts.flags);
  if (!flags || (!flags.connectors && !flags.overlay && !flags.geometry && !flags.perf)) return;
  const g = ensureDebugGroup(root);
  if (!g) return;
  g.innerHTML = '';

  // Overlay anchors + bboxes + badge
  if (flags.overlay) {
    try {
      const anchors = opts.anchors || root.__cblcars_anchors || {};
      let aHtml = '';
      const r = Math.max(2, Math.round(viewBox[3] * 0.007));
      for (const [name, pt] of Object.entries(anchors)) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        aHtml += `<circle cx="${pt[0]}" cy="${pt[1]}" r="${r}" fill="none" stroke="#00ff88" stroke-width="2" opacity="0.9">
          <title>anchor: ${name}</title>
        </circle>`;
      }
      if (aHtml) {
        const ag = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        ag.setAttribute('data-layer', 'anchors');
        ag.innerHTML = aHtml;
        g.appendChild(ag);
      }
      const svg = geo.getReferenceSvg(root);
      if (svg) {
        let nodes = Array.from(svg.querySelectorAll('[id][data-cblcars-root="true"]'));
        if (!nodes.length) {
          nodes = Array.from(svg.querySelectorAll('[id]'))
            .filter(n => n.id && n.id !== 'cblcars-debug-layer' && n.id !== 'cblcars-overlay-errors');
        }
        let html = '';
        for (const n of nodes) {
          if (typeof n.getBBox === 'function') {
            try {
              const bb = n.getBBox();
              html += `<rect x="${bb.x}" y="${bb.y}" width="${bb.width}" height="${bb.height}" fill="none" stroke="#33aaff" stroke-width="1.5" opacity="0.35">
                <title>${n.id}</title>
              </rect>`;
            } catch (_) {}
          }
        }
        if (html) {
          const bg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          bg.setAttribute('data-layer', 'overlay-bboxes');
          bg.innerHTML = html;
          g.appendChild(bg);
        }
      }
      try {
        renderValidationBadge(g, viewBox, root.__cblcars_validationCounts || { errors: 0, warnings: 0 });
      } catch (e) {
        cblcarsLog.warn('[debug] validation badge failed', e);
      }
    } catch (e) {
      cblcarsLog.warn('[debug] overlay debug render failed', e);
    }
  }

  // Connectors
  if (flags.connectors) {
    try {
      const paths = Array.from(root.querySelectorAll?.('path[data-cblcars-attach-to]') || []);
      if (paths.length) {
        const vb = viewBox || geo.getViewBox(root, geo.getReferenceSvg(root)) || [0, 0, 100, 100];
        let html = '';

        // Helper: parse last coordinate from an existing path 'd'
        const parseLastPoint = (dStr) => {
          if (!dStr || typeof dStr !== 'string') return null;
            const cmdRegex = /[ML]\s*(-?\d+(?:\.\d+)?)\s*[ ,]\s*(-?\d+(?:\.\d+)?)/ig;
          let match, last = null;
          while ((match = cmdRegex.exec(dStr))) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            if (Number.isFinite(x) && Number.isFinite(y)) last = [x, y];
          }
          return last;
        };

        for (const p of paths) {

          const isPending = p.getAttribute('data-cblcars-pending') === 'true';

          const targetId = p.getAttribute('data-cblcars-attach-to');
          const sx = parseFloat(p.getAttribute('data-cblcars-start-x'));
          const sy = parseFloat(p.getAttribute('data-cblcars-start-y'));
          if (!targetId || !isFinite(sx) || !isFinite(sy)) continue;
          const side = (p.getAttribute('data-cblcars-side') || 'auto').toLowerCase();
          const align = (p.getAttribute('data-cblcars-align') || 'center').toLowerCase();
          let gapRaw = p.getAttribute('data-cblcars-gap') || '12';
          let gap = parseFloat(gapRaw);
          if (String(gapRaw).trim().endsWith('px')) {
            const conv = geo.pxGapToViewBox(root, gap);
            if (Number.isFinite(conv)) gap = conv;
          }
          if (!isFinite(gap)) gap = 12;
          const box = targetBoxInViewBox(root, targetId, vb);

          if (!box || box.w === 0 && box.h === 0) {
            // If pending and box not ready yet, skip silently
            if (isPending) continue;
            continue;
          }

          // If the path already has real geometry, prefer its actual last coordinate.
          let end = null;
          const dAttr = p.getAttribute('d') || '';
          const isZeroLen = /^M\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*L\s*\1\s*,\s*\2\s*$/i.test(dAttr);
          if (dAttr && !isZeroLen) {
            const lastPt = parseLastPoint(dAttr);
            if (lastPt) end = lastPt;
          }
          if (!end) {
            end = endpointOnBox([sx, sy], box, { side, align, gap });
          }

          const dash = isPending ? '3,4' : '6,6';
          const lineOpacity = isPending ? 0.30 : 0.55;
          const boxOpacity = isPending ? 0.32 : 0.55;
          const circleOpacity = isPending ? 0.55 : 0.9;
          html += `
            <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="#ff00ff" stroke-width="2" opacity="${boxOpacity}">
              <title>#${targetId}</title>
            </rect>
            <line x1="${sx}" y1="${sy}" x2="${end[0]}" y2="${end[1]}" stroke="#ff00ff" stroke-dasharray="${dash}" stroke-width="2" opacity="${lineOpacity}">
              <title>${p.id || '(connector)'} ${isPending ? '[pending] ' : ''}start→endpoint</title>
            </line>
            <circle cx="${end[0]}" cy="${end[1]}" r="${Math.max(2, Math.round(vb[3] * 0.006))}" fill="#ff00ff" opacity="${circleOpacity}">
              <title>end (${side}, ${align}) actual:${!isZeroLen} pending:${isPending}</title>
            </circle>`;
        }
        if (html) {
          const cg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          cg.setAttribute('data-layer', 'connectors');
          cg.innerHTML = html;
          g.appendChild(cg);
        }
      }
    } catch (e) {
      cblcarsLog.warn('[debug] connectors layer render failed', e);
    }
  }

  // Perf HUD
  if (flags.perf) {
    try { renderPerfHUD(g, viewBox); } catch (e) { cblcarsLog.warn('[debug] perf HUD render failed', e); }
  }

  if (flags.geometry) logGeometry(root);
}

/** Clear debug layer */
export function clearDebugLayer(root) {
  const svg = geo.getReferenceSvg(root);
  const g = svg?.querySelector?.('#cblcars-debug-layer');
  if (g) g.innerHTML = '';
}

/**
 * OPTIONAL: Pre-seed counters so HUD shows stable rows before first activity.
 * keys: array of counter identifiers to increment once.
 */
export function preseedPerfCounters(keys = []) {
  try {
    if (!Array.isArray(keys)) return;
    const perf = window.cblcars?.perf;
    if (!perf || !perf.count) return;
    keys.forEach(k => perf.count(k));
  } catch (_) {}
}

/* -------------------------------------------------
 * Public API attach
 * ------------------------------------------------- */
export function attachDebugAPI() {
  window.cblcars = window.cblcars || {};
  window.cblcars.debug = window.cblcars.debug || {};
  window.cblcars.debug._version = 6; // bumped

  window.cblcars.debug.setFlags = (flags = {}) => {
    window.cblcars._debugFlags = { ...(window.cblcars._debugFlags || {}), ...flags };
    cblcarsLog.info('[debug] Flags updated', window.cblcars._debugFlags);

    // Force an immediate debug render on all MSD cards (double rAF so SVG + overlays are stamped)
    try {
      const cards = Array.from(document.querySelectorAll('cb-lcars-msd-card'));
      if (cards.length) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cards.forEach(card => {
              const root = card.shadowRoot;
              if (!root) return;
              // Try to get viewBox from cached config or live SVG
              let vb = card._config?.variables?.msd?._viewBox;
              if (!vb) {
                const svg = root.querySelector('#msd_svg_overlays svg') || root.querySelector('#cblcars-msd-wrapper svg');
                if (svg) {
                  const vbAttr = svg.getAttribute('viewBox');
                  if (vbAttr) {
                    const parts = vbAttr.trim().split(/\s+/).map(Number);
                    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) vb = parts;
                  }
                }
              }
              vb = vb || [0,0,100,100];
              try {
                window.cblcars.debug.render(root, vb, { anchors: root.__cblcars_anchors });
              } catch (e) {
                cblcarsLog.warn('[debug] Forced debug render failed', e);
              }
            });
          });
        });
      }
    } catch (e) {
      cblcarsLog.warn('[debug] setFlags re-render pass failed', e);
    }
  };

  window.cblcars.debug.setLevel = (level) => {
    if (typeof window.cblcars.setGlobalLogLevel === 'function') {
      window.cblcars.setGlobalLogLevel(level);
      cblcarsLog.info('[debug] Global log level set', { level });
    }
  };
  window.cblcars.debug.render = (root, viewBox, { anchors, flags } = {}) => {
    if (flags) root.__cblcars_debugFlags = flags;
    renderDebugLayer(root, viewBox, { anchors, flags });
  };
  window.cblcars.debug.clear = (root) => clearDebugLayer(root);
  window.cblcars.debug.logGeometry = (root) => logGeometry(root);

  // Perf timer API
  window.cblcars.debug.perf = window.cblcars.debug.perf || {};
  window.cblcars.debug.perf.start = perfStart;
  window.cblcars.debug.perf.end = perfEnd;
  window.cblcars.debug.perf.get = perfGet;
  window.cblcars.debug.perf.reset = perfReset;
  window.cblcars.debug.perf.clearActive = perfClearActive;
  window.cblcars.debug.perf.preseed = preseedPerfCounters;

  cblcarsLog.info('[debug] Debug API attached', { level: cblcarsGetGlobalLogLevel?.() });
}


// Idempotent attach
attachDebugAPI();