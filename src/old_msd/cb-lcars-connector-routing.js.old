/* ----------------------------------------------------------------------------------
 * CB-LCARS Connector Routing Helper (v2.2 consolidated)
 *
 * This file is a fully patched, up‑to‑date version incorporating:
 *  - Global API attach (routeAutoConnector, smartGateEval, runtime config)
 *  - SMART mode instrumentation & invariant fixes
 *  - Correct aggressive mode detection (presence of attr no longer forces true)
 *  - Explicit skipped status + detailed skip reasons (no_obstacles | clear_path | no_attempt | hit)
 *  - Geometry readiness deferral (ONLY when target box is zero-sized; capped retries)
 *  - Direct obstacle injection via preObstacles (bypasses legacy collectObstacles placeholders)
 *  - Clearance inflation when using preObstacles
 *  - Tiny/noise obstacle filtering + optional “treat tiny as none” (no loop)
 *  - Telemetry attributes (see list below)
 *
 * Telemetry attributes stamped per connector path:
 *   data-cblcars-routing-helper="v2.2"
 *   data-cblcars-target-box="x,y,wxh" | "none"
 *   data-cblcars-collected-obstacles="x,y,wxh;..."
 *   data-cblcars-smart-obstacle-count
 *   data-cblcars-smart-obstacle-bboxes
 *   data-cblcars-smart-proximity
 *   data-cblcars-smart-hit            (true|false when mode=smart)
 *   data-cblcars-smart-hit-eval       (raw gating flag)
 *   data-cblcars-smart-hit-mode       (bbox|distance|none)
 *   data-cblcars-smart-attempt-grid   (true|false)
 *   data-cblcars-smart-skip-reason    (no_obstacles|clear_path|hit|no_attempt)
 *   data-cblcars-smart-aggressive     (only when true)
 *   data-cblcars-smart-aggressive-eval (true|false)
 *   data-cblcars-route-effective      (smart|grid|manhattan)
 *   data-cblcars-route-grid-status    (success|fallback|skipped|manhattan|geom_pending)
 *   data-cblcars-route-grid-reason    (ok|fail|clear_path|no_obstacles|no_attempt|geom_pending|<grid failure code>)
 *   data-cblcars-route-grid-attempts  (comma list "res:ok|fail")
 *
 * Runtime overrides (merged over globalCfg):
 *   setRoutingRuntimeConfig({ smart_aggressive:true, disable_geom_deferral:true })
 *
 * Return value:
 *   { d, mode, usedEndpoint, smartAttempted }
 * ---------------------------------------------------------------------------------- */
import { cblcarsLog } from './cb-lcars-logging.js';

/* ---------------- Runtime configuration (merged over globalCfg) ---------------- */
let __runtimeRoutingCfg = {};
export function setRoutingRuntimeConfig(patch){
  if (patch && typeof patch === 'object') Object.assign(__runtimeRoutingCfg, patch);
}
export function getRoutingRuntimeConfig(){
  return { ...__runtimeRoutingCfg };
}

/* ---------------- Utilities ---------------- */
function normalizeRect(o){
  if(!o) return null;
  const x = Number.isFinite(o.x)?o.x:(Number.isFinite(o.left)?o.left:0);
  const y = Number.isFinite(o.y)?o.y:(Number.isFinite(o.top)?o.top:0);
  const w = Number.isFinite(o.w)?o.w:
    (Number.isFinite(o.width)?o.width:
      (Number.isFinite(o.right)&&Number.isFinite(o.left)?(o.right-o.left):0));
  const h = Number.isFinite(o.h)?o.h:
    (Number.isFinite(o.height)?o.height:
      (Number.isFinite(o.bottom)&&Number.isFinite(o.top)?(o.bottom-o.top):0));
  return { x,y,w,h };
}


/**
 * Build a rounded orthogonal path (multi-segment) given ordered points.
 * Only rounds interior corners where both adjacent segments are ≥ 2*radius.
 * Falls back to simple L joins if corner_style not 'round' or radius <= 0.
 * Improved: computes the correct SVG arc sweep flag for each 90° corner.
 *
 * @param {[number,number][]} points
 * @param {number} radius
 * @param {'round'|'bevel'|'sharp'|'square'} cornerStyle
 * @returns {string} SVG path string
 */
function buildRoundedOrthPath(points, radius = 0, cornerStyle = 'round') {
  if (!Array.isArray(points) || points.length < 2) return 'M0,0 L0,0';

  const style = (cornerStyle || 'round').toLowerCase();
  // Fast path for styles that do not need trimming logic (sharp / square / invalid or no radius)
  if ((style !== 'round' && style !== 'bevel') || radius <= 0) {
    return 'M' + points.map(p => p.join(',')).join(' L');
  }

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], cur = points[i], next = points[i + 1];
    const v1 = [cur[0]-prev[0], cur[1]-prev[1]];
    const v2 = [next[0]-cur[0], next[1]-cur[1]];
    const len1 = Math.abs(v1[0]) + Math.abs(v1[1]);
    const len2 = Math.abs(v2[0]) + Math.abs(v2[1]);
    const isOrthTurn = (v1[0] === 0 && v2[1] === 0) || (v1[1] === 0 && v2[0] === 0);
    const r = Math.min(radius, Math.floor(len1/2), Math.floor(len2/2));

    if (!isOrthTurn || r <= 0) {
      d += ` L${cur[0]},${cur[1]}`;
      continue;
    }

    // Trim points
    const p1 = [
      cur[0] - (v1[0] === 0 ? 0 : Math.sign(v1[0]) * r),
      cur[1] - (v1[1] === 0 ? 0 : Math.sign(v1[1]) * r)
    ];
    const p2 = [
      cur[0] + (v2[0] === 0 ? 0 : Math.sign(v2[0]) * r),
      cur[1] + (v2[1] === 0 ? 0 : Math.sign(v2[1]) * r)
    ];

    if (style === 'bevel') {
      // Bevel: straight diagonal between trimmed points
      d += ` L${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
    } else {
      // Round corner (existing logic)
      let sweep;
      try {
        const cross = v1[0]*v2[1] - v1[1]*v2[0];
        sweep = cross > 0 ? 1 : 0;
      } catch(_) { sweep = 1; }
      d += ` L${p1[0]},${p1[1]} A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]}`;
    }
  }
  const last = points[points.length - 1];
  d += ` L${last[0]},${last[1]}`;
  return d;
}

/* ---------------- C1 Two-Elbow Detour Helpers ---------------- */
/**
 * Axis-aligned rectangle intersection test.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean}
 */
function rectsIntersect(a,b){
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Expand a segment (orthogonal) into a thin rectangle for intersection testing.
 * @param {[number,number]} p1
 * @param {[number,number]} p2
 * @param {number} pad
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function segmentToRect(p1,p2,pad=0){
  if (p1[0] === p2[0]) {
    const x = p1[0]-pad;
    const y = Math.min(p1[1],p2[1]) - pad;
    const h = Math.abs(p1[1]-p2[1]) + pad*2;
    return { x, y, w: pad*2, h };
  } else {
    const y = p1[1]-pad;
    const x = Math.min(p1[0],p2[0]) - pad;
    const w = Math.abs(p1[0]-p2[0]) + pad*2;
    return { x, y, w, h: pad*2 };
  }
}

/**
 * Test if any obstacle intersects an orthogonal segment (with padding).
 * @param {[number,number]} a
 * @param {[number,number]} b
 * @param {Array<{x:number,y:number,w:number,h:number}>} obstacles
 * @param {number} pad
 */
function segmentBlocked(a,b,obstacles,pad){
  const sr = segmentToRect(a,b,pad);
  for(const ob of obstacles){
    if(rectsIntersect(sr,ob)) return true;
  }
  return false;
}

/**
 * Determine if a Manhattan (one-elbow) XY or YX path is blocked.
 * @param {number} sx
 * @param {number} sy
 * @param {number} ex
 * @param {number} ey
 * @param {Array<object>} obstacles
 * @param {'xy'|'yx'} order
 * @param {number} pad
 * @returns {boolean}
 */
function manhattanBlocked(sx,sy,ex,ey,obstacles,order,pad){
  if(order==='xy'){
    const elbow = [ex,sy];
    return segmentBlocked([sx,sy], elbow, obstacles, pad) ||
           segmentBlocked(elbow, [ex,ey], obstacles, pad);
  } else {
    const elbow = [sx,ey];
    return segmentBlocked([sx,sy], elbow, obstacles, pad) ||
           segmentBlocked(elbow, [ex,ey], obstacles, pad);
  }
}

/**
 * Two-elbow detour heuristic.
 * Strategy: For each blocking obstacle, try wrapping LEFT / RIGHT (horizontal detour) and
 * TOP / BOTTOM (vertical detour) producing exactly 3 orthogonal segments (2 bends):
 *
 * Horizontal wrap candidate (xDet):
 *   start -> (xDet, sy) -> (xDet, ey) -> end
 *
 * Vertical wrap candidate (yDet):
 *   start -> (sx, yDet) -> (ex, yDet) -> end
 *
 * A candidate is valid if none of the three segments intersect any obstacle (with pad).
 * Cost = total Manhattan length. Picks lowest cost valid.
 *
 * This implementation respects a forcedElbowMode hint ('xy' or 'yx') by prioritizing
 * horizontal or vertical wrap candidates respectively.
 *
 * @param {{sx:number,sy:number,ex:number,ey:number,obstacles:Array<object>,pad:number,forcedElbowMode?:'xy'|'yx'}} args
 * @returns {{points:[number,number][],cost:number,candidatesTried:number,reason:string}|null}
 */
function twoElbowDetour({ sx, sy, ex, ey, obstacles, pad, forcedElbowMode } = {}) {
  if (!obstacles || !obstacles.length) return null;
  const candidates = [];
  const gap = pad;

  for (const ob of obstacles) {
    // Horizontal wraps (left & right of obstacle)
    const leftX = ob.x - gap;
    const rightX = ob.x + ob.w + gap;
    candidates.push({ kind:'h', x:leftX });
    candidates.push({ kind:'h', x:rightX });
    // Vertical wraps (above & below obstacle)
    const topY = ob.y - gap;
    const bottomY = ob.y + ob.h + gap;
    candidates.push({ kind:'v', y:topY });
    candidates.push({ kind:'v', y:bottomY });
  }

  // Prioritize based on forcedElbowMode if provided
  let orderedCandidates = candidates;
  if (forcedElbowMode === 'xy') {
    orderedCandidates = candidates.filter(c => c.kind === 'h').concat(candidates.filter(c => c.kind === 'v'));
  } else if (forcedElbowMode === 'yx') {
    orderedCandidates = candidates.filter(c => c.kind === 'v').concat(candidates.filter(c => c.kind === 'h'));
  }

  let best = null;
  let tried = 0;
  const uniq = new Set();
  for (const c of orderedCandidates) {
    // Deduplicate
    const key = c.kind === 'h' ? `h:${c.x}` : `v:${c.y}`;
    if (uniq.has(key)) continue;
    uniq.add(key);
    tried++;
    let points;
    if (c.kind === 'h') {
      const xDet = c.x;
      points = [
        [sx, sy],
        [xDet, sy],
        [xDet, ey],
        [ex, ey]
      ];
    } else {
      const yDet = c.y;
      points = [
        [sx, sy],
        [sx, yDet],
        [ex, yDet],
        [ex, ey]
      ];
    }
    // Validate sequential segments
    let blocked = false;
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentBlocked(points[i], points[i+1], obstacles, pad)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Cost (Manhattan)
    let dist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      dist += Math.abs(points[i+1][0]-points[i][0]) + Math.abs(points[i+1][1]-points[i][1]);
    }
    if (!best || dist < best.cost) {
      best = { points, cost: dist };
    }
  }
  if (!best) return { points:[], cost:Infinity, candidatesTried: tried, reason:'no_valid' };
  return { points: best.points, cost: best.cost, candidatesTried: tried, reason:'ok' };
}

/* PATCH: grid points orientation reordering
 * Ensures the first elbow follows the desired orientation (xy => horizontal-first, yx => vertical-first)
 */
function reorderGridPoints(points, mode) {
  if (!Array.isArray(points) || points.length < 3) return points;
  // NEW: compress consecutive collinear points to improve early-orientation detection (non‑destructive)
  const compact = [];
  for (let i=0;i<points.length;i++){
    const p = points[i];
    if (!compact.length) { compact.push(p); continue; }
    const prev = compact[compact.length-1];
    if ((p[0]===prev[0] && p[1]===prev[1])) continue;
    if (compact.length>=2){
      const p2 = compact[compact.length-2];
      const collinear =
        (p2[0]===prev[0] && prev[0]===p[0]) ||
        (p2[1]===prev[1] && prev[1]===p[1]);
      if (collinear){ compact[compact.length-1] = p; continue; }
    }
    compact.push(p);
  }
  const pts = compact;
  if (pts.length < 4) return points; // need at least start + elbow1 + elbow2 + end to safely swap
  const p0 = pts[0], p1 = pts[1], p2 = pts[2];
  const firstIsHoriz = p1[1] === p0[1] && p1[0] !== p0[0];
  const firstIsVert  = p1[0] === p0[0] && p1[1] !== p0[1];
  if (mode === 'xy' && firstIsHoriz) return points;
  if (mode === 'yx' && firstIsVert) return points;
  // Check that swapping p1 & p2 preserves orth sequence (both elbows orth to each other & connected)
  const p1p2Orth = (p1[0]===p2[0] || p1[1]===p2[1]);
  const p0p2Orth = (p0[0]===p2[0] || p0[1]===p2[1]);
  if (!p1p2Orth || !p0p2Orth) return points; // unsafe swap
  const reordered = [...points];
  // Find original indices of p1 & p2 (in case compaction changed them)
  const i1 = points.indexOf(p1);
  const i2 = points.indexOf(p2);
  if (i1>0 && i2>i1){
    reordered[i1] = p2;
    reordered[i2] = p1;
  }
  return reordered;
}

/* RESTORED: explicit endpoint parser (was removed inadvertently; its absence caused ReferenceError) */
function parseExplicitEndpoint(el){
  if(!el) return null;
  const raw = el.getAttribute('data-cblcars-endpoint');
  if(!raw) return null;
  const parts = raw.trim().split(/[, ]+/).map(Number).filter(n=>Number.isFinite(n));
  if(parts.length>=2) return [parts[0], parts[1]];
  return null;
}

/* NEW: Infer preferred elbow orientation (xy = horizontal first, yx = vertical first) */
function inferPreferredElbowMode(start, endPoint){
  const [sx,sy] = start;
  const ex = endPoint[0];
  const ey = endPoint[1];
  const dx = Math.abs(ex - sx);
  const dy = Math.abs(ey - sy);
  return dx >= dy ? 'xy' : 'yx';
}

/* NEW: Determine actual first-segment orientation of an orth path */
function detectFirstOrientation(points){
  if(!Array.isArray(points) || points.length < 2) return null;
  let prev = points[0];
  for(let i=1;i<points.length;i++){
    const cur = points[i];
    if(cur[0]===prev[0] && cur[1]===prev[1]) continue;
    if(cur[0]!==prev[0]) return 'xy'; // horizontal movement first
    if(cur[1]!==prev[1]) return 'yx'; // vertical movement first
    prev = cur;
  }
  return null;
}

/* ---------------- SMART Gating (exported) ---------------- */
export function smartGateEval({ sx, sy, ex, ey, obstacles, forcedOrientation, prox, debug }){
  const round2 = v=>Math.round(v*100)/100;
  const debugInfo = { elbows: [], corridors: [], obstacles: [], decision: 'none', mode:'none' };
  if (debug){
    try { debugInfo.obstacles = obstacles.map(o=>`${round2(o.x)},${round2(o.y)},${round2(o.w)},${round2(o.h)}`); } catch(_) {}
  }
  if(!obstacles.length) return { hit:false, mode:'none', debugInfo };

  const elbows=[];
  if(forcedOrientation==='xy') elbows.push([ex,sy]);
  else if(forcedOrientation==='yx') elbows.push([sx,ey]);
  else { elbows.push([ex,sy]); elbows.push([sx,ey]); }

  const EPS=0.0001;
  const overlaps=(a,b)=>!(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y);

  function segmentDistanceHit(start, mid, end, ob, p){
    const segs=[[start,mid],[mid,end]];
    for(const [A,B] of segs){
      if(A[0]===B[0]&&A[1]===B[1]) continue;
      const horiz=A[1]===B[1];
      if(horiz){
        const y=A[1]; const minX=Math.min(A[0],B[0]), maxX=Math.max(A[0],B[0]);
        const obX0=ob.x, obX1=ob.x+ob.w;
        const xOverlap=!(maxX<obX0||obX1<minX);
        const yDist=(y<ob.y)?(ob.y-y):(y>ob.y+ob.h?(y-(ob.y+ob.h)):0);
        if(xOverlap && yDist<=p) return true;
      } else {
        const x=A[0]; const minY=Math.min(A[1],B[1]), maxY=Math.max(A[1],B[1]);
        const obY0=ob.y, obY1=ob.y+ob.h;
        const yOverlap=!(maxY<obY0||obY1<minY);
        const xDist=(x<ob.x)?(ob.x-x):(x>ob.x+ob.w?(x-(ob.x+ob.w)):0);
        if(yOverlap && xDist<=p) return true;
      }
    }
    return false;
  }

  for(const elbow of elbows){
    if(debug) debugInfo.elbows.push(`${round2(elbow[0])},${round2(elbow[1])}`);
    const segs=[
      { x:Math.min(sx,elbow[0])-(EPS+prox), y:Math.min(sy,elbow[1])-(EPS+prox),
        w:Math.abs(sx-elbow[0])+(EPS+prox)*2, h:Math.abs(sy-elbow[1])+(EPS+prox)*2 },
      { x:Math.min(elbow[0],ex)-(EPS+prox), y:Math.min(elbow[1],ey)-(EPS+prox),
        w:Math.abs(elbow[0]-ex)+(EPS+prox)*2, h:Math.abs(elbow[1]-ey)+(EPS+prox)*2 }
    ];
    if(debug){
      debugInfo.corridors.push(segs.map(s=>`${round2(s.x)},${round2(s.y)},${round2(s.w)},${round2(s.h)}`).join('|'));
    }
    let bboxHit=false;
    for(const seg of segs){
      for(const ob of obstacles){ if(overlaps(seg,ob)){bboxHit=true;break;} }
      if(bboxHit) break;
    }
    if(bboxHit){ debugInfo.decision='hit'; debugInfo.mode='bbox'; return {hit:true,mode:'bbox',debugInfo}; }
    for(const ob of obstacles){
      if(segmentDistanceHit([sx,sy],elbow,[ex,ey],ob,prox)){
        debugInfo.decision='hit'; debugInfo.mode='distance'; return {hit:true,mode:'distance',debugInfo};
      }
    }
  }
  debugInfo.decision='clear';
  return { hit:false, mode:'none', debugInfo };
}

/* ---------------- Main Router ---------------- */
/**
 * @typedef {Object} RouteAutoConnectorOptions
 * @property {Element|ShadowRoot} root
 * @property {number[]} viewBox
 * @property {SVGPathElement} pathEl
 * @property {[number,number]} start
 * @property {[number,number,string?]} endpointOnTarget
 * @property {{x:number,y:number,w:number,h:number}} targetBox
 * @property {string[]} avoidList
 * @property {string|null} forcedElbowMode
 * @property {number|number[]|null} gridResolution
 * @property {number|null} routeClearance
 * @property {number|null} strokeWidth
 * @property {number|null} smartProximity
 * @property {Function} computeAutoRoute
 * @property {Function} selectMode
 * @property {Function} collectObstacles
 * @property {Function} registerResult
 * @property {Function} routeViaGrid
 * @property {Object} globalCfg
 * @property {[number,number]?} explicitEndpoint
 * @property {{x:number,y:number,w:number,h:number}[]=} preObstacles  Direct obstacle rects (preferred).
 */

/**
 * Route an auto connector (SMART / GRID / MANHATTAN).
 * @param {RouteAutoConnectorOptions} opts
 * @returns {{ d:string, mode:string, usedEndpoint:[number,number], smartAttempted:boolean }}
 */
export function routeAutoConnector(opts){
  const {
    root,
    viewBox,
    pathEl,
    start,
    endpointOnTarget,
    targetBox,
    avoidList = [],
    forcedElbowMode,
    gridResolution,
    routeClearance,
    strokeWidth,
    smartProximity,
    computeAutoRoute,
    selectMode,
    collectObstacles,
    registerResult,
    routeViaGrid,
    globalCfg = {},
    explicitEndpoint,
    preObstacles
  } = opts || {};

  if(!pathEl || !start){
    return { d:'M0,0 L0,0', mode:'invalid', usedEndpoint:null, smartAttempted:false };
  }

  /* Version marker + target box */
  try {
    if (!window.cblcars.__routingHelperV22Noted) {
      window.cblcars.__routingHelperV22Noted = true;
      console.info('[connector-routing] helper v2.2 active');
    }
    pathEl.setAttribute('data-cblcars-routing-helper','v2.2');
    if (targetBox) {
      pathEl.setAttribute('data-cblcars-target-box', `${targetBox.x},${targetBox.y},${targetBox.w}x${targetBox.h}`);
    } else {
      pathEl.setAttribute('data-cblcars-target-box','none');
    }
  } catch(_) {}

  /* Runtime merge */
  const runtimeCfg = getRoutingRuntimeConfig();
  const mergedGlobal = { ...globalCfg, ...runtimeCfg };
  const perf = window.cblcars?.perf;

  const [sx, sy] = start;

  /* Endpoint precedence */
  const attrEndpoint = parseExplicitEndpoint(pathEl);
  let endpoint = attrEndpoint || explicitEndpoint || endpointOnTarget;
  if(!endpoint){
    return { d:`M${sx},${sy} L${sx},${sy}`, mode:'invalid', usedEndpoint:null, smartAttempted:false };
  }

  /* NEW: infer elbow orientation unless user forced one */
  let inferredOrientation = null;
  try {
    if (!forcedElbowMode) {
      inferredOrientation = inferPreferredElbowMode(start, endpoint);
      pathEl.setAttribute('data-cblcars-elbow-mode-inferred', inferredOrientation);
    } else {
      pathEl.setAttribute('data-cblcars-elbow-mode-inferred', 'forced:'+forcedElbowMode);
    }
  } catch(_) {
    pathEl.setAttribute('data-cblcars-elbow-mode-inferred','error');
  }

  /* NEW: Nudge endpoint when a first‑axis move would be zero (prevents “flat” duplicates)
     Only when:
       - orientation (forced or inferred) requests that axis first
       - delta on that axis is 0
       - targetBox is valid
       - user did NOT disable (data-cblcars-no-nudge)
  */
  try {
    const want = forcedElbowMode || inferredOrientation;
    if (want && !pathEl.hasAttribute('data-cblcars-no-nudge') && targetBox && targetBox.w>0 && targetBox.h>0) {
      const [ex0, ey0] = endpoint;
      let ex = ex0, ey = ey0;
      const cx = targetBox.x + targetBox.w/2;
      const cy = targetBox.y + targetBox.h/2;
      const minStepX = Math.min(Math.max(targetBox.w*0.12, 12), Math.max(48, targetBox.w/2));
      const minStepY = Math.min(Math.max(targetBox.h*0.12, 12), Math.max(48, targetBox.h/2));
      let nudged = false;

      if (want === 'xy' && Math.abs(ey - sy) < 0.001) {
        // Need vertical motion second; ensure eventual vertical segment != 0 by nudging endpoint Y inside box away from start
        const dir = (sy <= cy) ? 1 : -1;
        ey = Math.min(targetBox.y + targetBox.h - 4, Math.max(targetBox.y + 4, ey + dir * minStepY));
        nudged = true;
      } else if (want === 'yx' && Math.abs(ex - sx) < 0.001) {
        // Need horizontal motion second; nudge X
        const dir = (sx <= cx) ? 1 : -1;
        ex = Math.min(targetBox.x + targetBox.w - 4, Math.max(targetBox.x + 4, ex + dir * minStepX));
        nudged = true;
      }
      if (nudged) {
        endpoint = [ex, ey, endpoint[2]];
        pathEl.setAttribute('data-cblcars-endpoint-nudged','true');
      } else {
        pathEl.removeAttribute('data-cblcars-endpoint-nudged');
      }
    }
  } catch(_) {}

  /* Forced full routing mode */
  const forcedFullRaw = (pathEl.getAttribute('data-cblcars-route-mode-full') || '').toLowerCase().trim();
  const forcedFull =
    forcedFullRaw === 'grid'      ? 'grid' :
    forcedFullRaw === 'smart'     ? 'smart' :
    forcedFullRaw === 'manhattan' ? 'manhattan' : '';
  const explicitMode = forcedFull || 'auto';

  /* Effective mode resolution */
  let effectiveMode;
  if (forcedFull) {
    effectiveMode = forcedFull;
  } else {
    try {
      effectiveMode = typeof selectMode === 'function'
        ? selectMode(explicitMode || 'auto', mergedGlobal.default_mode)
        : null;
    } catch { effectiveMode = null; }
    if (!effectiveMode || effectiveMode === 'auto') {
      effectiveMode = mergedGlobal.default_mode || 'manhattan';
    }
  }

  /* Obstacles:
   * 1. If preObstacles provided, use them (apply clearance).
   * 2. Else use collectObstacles (assumed to already apply clearance).
   * 3. Normalize + filter tiny (area < 4).
   */
  const clearance = routeClearance != null ? routeClearance : (mergedGlobal.clearance || 0);
  let rawObstacles = [];
  if (Array.isArray(preObstacles)) {
    rawObstacles = preObstacles.slice();
  } else {
    try {
      const { rects } = collectObstacles
        ? collectObstacles(root, avoidList, clearance)
        : { rects: [] };
      rawObstacles = Array.isArray(rects) ? rects : [];
    } catch { rawObstacles = []; }
  }

  let normObs = rawObstacles.map(normalizeRect).filter(o => o && o.w > 0 && o.h > 0 && (o.w * o.h) >= 4);
  if (Array.isArray(preObstacles) && clearance > 0) {
    normObs = normObs.map(o => ({
      x: o.x - clearance,
      y: o.y - clearance,
      w: o.w + clearance * 2,
      h: o.h + clearance * 2
    }));
  }

  /* Geometry readiness deferral (ONLY target; capped retries) */
  const targetInvalid = (!targetBox || targetBox.w === 0 || targetBox.h === 0);
  const disableGeomDefer = !!runtimeCfg.disable_geom_deferral;
  if (!disableGeomDefer && targetInvalid) {
    const retryAttr = pathEl.getAttribute('data-cblcars-geom-retry') || '0';
    const retryCount = parseInt(retryAttr, 10) || 0;
    const MAX_RETRIES = 6;

    if (retryCount < MAX_RETRIES) {
      try {
        pathEl.setAttribute('data-cblcars-route-effective', mergedGlobal.default_mode || 'manhattan');
        pathEl.setAttribute('data-cblcars-route-grid-status','geom_pending');
        pathEl.setAttribute('data-cblcars-route-grid-reason','geom_pending');
        pathEl.setAttribute('data-cblcars-geom-pending','true');
        pathEl.setAttribute('data-cblcars-collected-obstacles',
          normObs.length ? normObs.map(o=>`${o.x},${o.y},${o.w}x${o.h}`).join(';') : 'none');
        pathEl.setAttribute('data-cblcars-geom-retry', String(retryCount+1));
      } catch(_) {}
      const placeholderD = `M${sx},${sy} L${sx},${sy}`;
      pathEl.setAttribute('d', placeholderD);
      if (!pathEl.__cblcars_geom_retry_scheduled) {
        pathEl.__cblcars_geom_retry_scheduled = true;
        requestAnimationFrame(() => {
          setTimeout(() => {
            pathEl.__cblcars_geom_retry_scheduled = false;
            window.cblcars?.connectors?.invalidate && window.cblcars.connectors.invalidate(pathEl.id);
            window.cblcars?.overlayHelpers?.layoutPendingConnectors &&
              window.cblcars.overlayHelpers.layoutPendingConnectors(root, viewBox);
          }, 60);
        });
      }
      return {
        d: placeholderD,
        mode: 'geom_pending',
        usedEndpoint: endpoint,
        smartAttempted: false
      };
    } else {
      try { pathEl.setAttribute('data-cblcars-geom-pending','aborted'); } catch(_) {}
    }
  }

  /* Collected obstacles telemetry */
  try {
    pathEl.setAttribute('data-cblcars-collected-obstacles',
      normObs.length
        ? normObs.slice(0,6).map(o=>`${Math.round(o.x)},${Math.round(o.y)},${Math.round(o.w)}x${Math.round(o.h)}`).join(';')
        : 'none');
  } catch(_) {}

  /* SMART proximity calculations */
  const globalSmartProx = Number.isFinite(parseFloat(mergedGlobal.smart_proximity))
    ? parseFloat(mergedGlobal.smart_proximity) : 0;
  const strokeHalf = (strokeWidth && strokeWidth>0) ? strokeWidth/2 : 0;
  const effectiveSmartProx = Math.max(
    0,
    smartProximity != null ? smartProximity : globalSmartProx,
    strokeHalf
  );

  const smartDebugActive = !!(window.cblcars?._debugFlags?.smart || pathEl.hasAttribute('data-cblcars-smart-debug-force'));

  /* Aggressive detection (value, not mere presence) */
  const aggAttrRaw = pathEl.getAttribute('data-cblcars-smart-aggressive');
  const attrAggressive =
    aggAttrRaw === 'true' ||
    aggAttrRaw === '1' ||
    (aggAttrRaw === '' && pathEl.hasAttribute('data-cblcars-smart-aggressive'));
  const isAggressive = !!(attrAggressive || mergedGlobal.smart_aggressive);
  try {
    pathEl.setAttribute('data-cblcars-smart-aggressive-eval', isAggressive ? 'true' : 'false');
  } catch(_) {}

  /* SMART evaluation */
  let smartHit=false, smartHitMode='none', smartSkipped=false,
      smartSkipReason='none', smartAttempted=false;

  if (effectiveMode==='smart'){
    if(!normObs.length && !isAggressive){
      smartSkipped = true;
      smartSkipReason = 'no_obstacles';
    } else {
      smartAttempted = true;
      const res = smartGateEval({
        sx, sy, ex:endpoint[0], ey:endpoint[1],
        obstacles: normObs,
        forcedOrientation: forcedElbowMode,
        prox: effectiveSmartProx,
        debug: smartDebugActive
      });
      smartHit = res.hit;
      smartHitMode = res.mode;
      smartSkipReason = smartHit ? 'hit' : 'clear_path';
      smartSkipped = !smartHit && !isAggressive;

      if (res.debugInfo && smartDebugActive){
        try {
          pathEl.setAttribute('data-cblcars-smart-elbows', res.debugInfo.elbows.join(';'));
          pathEl.setAttribute('data-cblcars-smart-corridors', res.debugInfo.corridors.join(';'));
          pathEl.setAttribute('data-cblcars-smart-obstacles', res.debugInfo.obstacles.join('|'));
          pathEl.setAttribute('data-cblcars-smart-start', `${sx},${sy}`);
          pathEl.setAttribute('data-cblcars-smart-end', `${endpoint[0]},${endpoint[1]}`);
          pathEl.setAttribute('data-cblcars-smart-decision', res.debugInfo.decision);
        } catch(_) {}
      } else if (smartDebugActive){
        pathEl.setAttribute('data-cblcars-smart-start', `${sx},${sy}`);
        pathEl.setAttribute('data-cblcars-smart-end', `${endpoint[0]},${endpoint[1]}`);
      } else {
        pathEl.removeAttribute('data-cblcars-smart-elbows');
        pathEl.removeAttribute('data-cblcars-smart-corridors');
        pathEl.removeAttribute('data-cblcars-smart-obstacles');
        pathEl.removeAttribute('data-cblcars-smart-start');
        pathEl.removeAttribute('data-cblcars-smart-end');
        pathEl.removeAttribute('data-cblcars-smart-decision');
      }
    }
  } else {
    pathEl.removeAttribute('data-cblcars-smart-elbows');
    pathEl.removeAttribute('data-cblcars-smart-corridors');
    pathEl.removeAttribute('data-cblcars-smart-obstacles');
    pathEl.removeAttribute('data-cblcars-smart-start');
    pathEl.removeAttribute('data-cblcars-smart-end');
    pathEl.removeAttribute('data-cblcars-smart-decision');
  }

  /* Grid attempt gating */
  const baseResolution = gridResolution || mergedGlobal.grid_resolution || 56;
  const multipliers = Array.isArray(mergedGlobal.grid_resolution_multipliers)
    ? mergedGlobal.grid_resolution_multipliers
    : [1,1.5,2];
  const maxRes = mergedGlobal.grid_resolution_max || 400;

  const attemptGrid =
    (effectiveMode==='grid') ||
    (effectiveMode==='smart' && (smartHit || (isAggressive && normObs.length && !smartHit))) ||
    false;

  /* Instrument core SMART attempt data */
  try {
    pathEl.setAttribute('data-cblcars-smart-hit-eval', smartHit ? 'true':'false');
    pathEl.setAttribute('data-cblcars-smart-attempt-grid', attemptGrid ? 'true':'false');
    pathEl.setAttribute('data-cblcars-smart-obstacle-count', String(normObs.length));
    if (normObs.length) {
      pathEl.setAttribute('data-cblcars-smart-obstacle-bboxes',
        normObs.slice(0,8).map(o=>`${Math.round(o.x)},${Math.round(o.y)},${Math.round(o.w)}x${Math.round(o.h)}`).join(';'));
    } else {
      pathEl.removeAttribute('data-cblcars-smart-obstacle-bboxes');
    }
    if (isAggressive) pathEl.setAttribute('data-cblcars-smart-aggressive','true');
    else pathEl.removeAttribute('data-cblcars-smart-aggressive');
  } catch(_) {}

  // Channel preferences (only used inside grid attempts)
  let routeChannels = [];
  let routeChannelMode = 'allow';
  try {
    const rcAttr = pathEl.getAttribute('data-cblcars-route-channels');
    if (rcAttr) {
      routeChannels = rcAttr.split(',').map(s=>s.trim()).filter(Boolean);
    }
    const rcmAttr = pathEl.getAttribute('data-cblcars-route-channel-mode');
    if (rcmAttr) {
      const lc = rcmAttr.toLowerCase();
      if (['allow','prefer','require'].includes(lc)) routeChannelMode = lc;
    }
  } catch(_) {}

  const channelDefs = Array.isArray(globalCfg.channels)
    ? window.cblcars?.routing?.channels?.parseChannels(globalCfg.channels) : [];

  const resolutionsToTry = attemptGrid
    ? [...new Set(multipliers.map(m=>Math.round(baseResolution*m)))]
        .filter(r=>r>0 && r<=maxRes)
    : [];

  let gridAccepted=false, gridReason='not_tried', gridAttempts=[], chosenMeta=null;

  let detourUsed = false;
  let detourMeta = null;

  // C1 Two-elbow detour attempt (before grid) if enabled and both Manhattan variants blocked
  const enableDetour = !!(mergedGlobal?.fallback?.enable_two_elbow);
  if (enableDetour && attemptGrid) {
    const padForBlock = Math.max(0, clearance || 0);
    const blockedXY = manhattanBlocked(sx, sy, endpoint[0], endpoint[1], normObs, 'xy', padForBlock);
    const blockedYX = manhattanBlocked(sx, sy, endpoint[0], endpoint[1], normObs, 'yx', padForBlock);
    if (blockedXY && blockedYX) {
      const det = twoElbowDetour({
        sx, sy, ex: endpoint[0], ey: endpoint[1],
        obstacles: normObs,
        pad: padForBlock,
        forcedElbowMode: forcedElbowMode
      });
      if (det && det.points && det.points.length >= 2 && det.reason === 'ok') {
        detourUsed = true;
        detourMeta = det;
        gridAccepted = false;
        gridReason = 'detour';
        // Register detour now (telemetry stamping further below)
        try {
          registerResult(pathEl.id, {
            strategy:'detour',
            cost: { distanceCost: det.cost, bendCost: 2, total: det.cost + 2 * (mergedGlobal.cost_defaults?.bend || 12), bends: 2 },
            points: det.points
          });
        } catch(_) {}
      }
    }
  }


  if (attemptGrid && !detourUsed){
    for(const res of resolutionsToTry){
      const meta = routeViaGrid({
        root,
        viewBox,
        start:[sx,sy],
        end:[endpoint[0],endpoint[1]],
        obstacles: normObs,
        resolution: res,
        costParams: mergedGlobal.cost_defaults,
        connectorId: pathEl.id,
        channels: channelDefs,
        routeChannels,
        routeChannelMode
      });
      gridAttempts.push({
        res,
        failed: !!meta?.failed,
        reason: meta?.reason || (meta?.failed?'fail':'ok'),
        endDelta: meta?.endDelta
      });
      if(!meta || meta.failed){
        gridReason = meta?.reason || 'fail';
        continue;
      }
      chosenMeta = meta;
      gridAccepted = true;
      gridReason='ok';
      break;
    }
  }

  /* Path output (grid or fallback Manhattan) */
  let pathD = null;
  let usedPointsForOrientation = null; // NEW capture for telemetry

  // --- Build final path (detour > grid > fallback Manhattan) ---
  if (detourUsed && detourMeta?.points?.length >= 2) {
    // Try rounded orth corners if style allows
    const cornerStyleAttr = (pathEl.getAttribute('data-cblcars-corner-style') || 'round').toLowerCase();
    const radiusAttr = parseFloat(pathEl.getAttribute('data-cblcars-radius')) || 12;
    let detourPoints = detourMeta.points;

    if (forcedElbowMode) {
      detourPoints = reorderGridPoints(detourPoints, forcedElbowMode);
    } else if (inferredOrientation) {
      detourPoints = reorderGridPoints(detourPoints, inferredOrientation);
    }

    pathD = buildRoundedOrthPath(detourPoints, radiusAttr, cornerStyleAttr);
    usedPointsForOrientation = detourPoints; // NEW

    // Telemetry about detour geometry
    try {
      pathEl.setAttribute('data-cblcars-route-detour-elbows', String(detourPoints.length - 1));
      pathEl.setAttribute(
        'data-cblcars-route-detour-rounded',
        (cornerStyleAttr === 'round' && radiusAttr > 0) ? 'true' : 'false'
      );
    } catch(_) {}

  } else if (gridAccepted && chosenMeta?.points?.length >= 2) {
    const cornerStyleAttr = (pathEl.getAttribute('data-cblcars-corner-style') || 'round').toLowerCase();
    const radiusAttr = parseFloat(pathEl.getAttribute('data-cblcars-radius')) || 12;
    let gridPoints = chosenMeta.points;

    if (forcedElbowMode) {
      gridPoints = reorderGridPoints(gridPoints, forcedElbowMode);
    } else if (inferredOrientation) {
      gridPoints = reorderGridPoints(gridPoints, inferredOrientation);
    }

    pathD = buildRoundedOrthPath(gridPoints, radiusAttr, cornerStyleAttr);
    usedPointsForOrientation = gridPoints; // NEW

    try {
      registerResult(pathEl.id, {
        strategy: 'grid',
        expansions: chosenMeta.expansions,
        cost: chosenMeta.cost,
        bends: chosenMeta.cost?.bends,
        pathHash: chosenMeta.pathHash,
        endDelta: chosenMeta.endDelta,
        resolution: chosenMeta.resolution,
        channels: chosenMeta.hitChannels || [],
        channelMode: chosenMeta.routeChannelMode
      });
    } catch (_) {}
  }
  if(!pathD){
    const { d: autoD } = computeAutoRoute(
      sx,
      sy,
      targetBox,
      endpoint,
      {
        radius: parseFloat(pathEl.getAttribute('data-cblcars-radius')) || 12,
        cornerStyle: (pathEl.getAttribute('data-cblcars-corner-style') || 'round').toLowerCase(),
        routeMode: forcedElbowMode || 'auto',
        obstacles: [] // Manhattan fallback does not need inflated set
      }
    );
    pathD = autoD;
  }

  /* NEW: Degenerate tail cleanup (remove duplicate last segment Lx,y Lx,y) */
  try {
    if (typeof pathD === 'string') {
      const trimmed = pathD.replace(/(L\s*[-\d.]+\s*,\s*[-\d.]+)\s+L\s*([-.\d]+)\s*,\s*([-.\d]+)\s*$/i,
        (m, firstL, x, y) => {
          // If previous command already ends at same x,y keep single
          const coords = /L\s*([-.\d]+)\s*,\s*([-.\d]+)\s*$/.exec(firstL);
            if (coords && Math.abs(parseFloat(coords[1]) - parseFloat(x)) < 1e-6 &&
                Math.abs(parseFloat(coords[2]) - parseFloat(y)) < 1e-6) {
              return firstL; // drop duplicate
            }
          return m;
        });
      if (trimmed !== pathD) {
        pathD = trimmed;
        pathEl.setAttribute('data-cblcars-degenerate-trim','true');
      } else {
        pathEl.removeAttribute('data-cblcars-degenerate-trim');
      }
    }
  } catch(_) {}

  // Stamp final path + ALWAYS clear pending (safety)
  try {
    pathEl.setAttribute('d', pathD || `M${sx},${sy} L${sx},${sy}`);
    pathEl.removeAttribute('data-cblcars-pending');
  } catch(_) {}

  /* Telemetry stamping */
  try {
    pathEl.setAttribute('data-cblcars-route-effective', effectiveMode);

    if (detourUsed){
      pathEl.setAttribute('data-cblcars-route-detour','true');
      pathEl.setAttribute('data-cblcars-route-detour-candidates', String(detourMeta?.candidatesTried || 0));
      pathEl.setAttribute('data-cblcars-route-detour-cost', String(detourMeta?.cost || 0));
      pathEl.setAttribute('data-cblcars-route-grid-status','skipped');
      pathEl.setAttribute('data-cblcars-route-grid-reason','detour');
      pathEl.removeAttribute('data-cblcars-route-grid-attempts');
      // Clear any grid-specific channel attributes
      pathEl.removeAttribute('data-cblcars-route-channels-hit');
      pathEl.removeAttribute('data-cblcars-route-channels-miss');
      pathEl.removeAttribute('data-cblcars-route-channels');
      pathEl.removeAttribute('data-cblcars-route-channel-mode');
      pathEl.removeAttribute('data-cblcars-route-cost-distance');
      pathEl.removeAttribute('data-cblcars-route-cost-bends');
      pathEl.removeAttribute('data-cblcars-route-cost-total');
    }
    else if (effectiveMode==='grid'){
      pathEl.setAttribute('data-cblcars-route-grid-status', gridAccepted?'success':'fallback');
      pathEl.setAttribute('data-cblcars-route-grid-reason', gridReason);
      pathEl.setAttribute('data-cblcars-route-grid-attempts', gridAttempts.map(a=>`${a.res}:${a.reason}`).join(','));

      pathEl.removeAttribute('data-cblcars-smart-hit');
      pathEl.removeAttribute('data-cblcars-smart-proximity');
      pathEl.removeAttribute('data-cblcars-smart-hit-mode');
      pathEl.removeAttribute('data-cblcars-smart-skip-reason');

      if (routeChannels.length) {
        pathEl.setAttribute('data-cblcars-route-channels', routeChannels.join(','));
        pathEl.setAttribute('data-cblcars-route-channel-mode', routeChannelMode);
      } else {
        pathEl.removeAttribute('data-cblcars-route-channels');
        pathEl.removeAttribute('data-cblcars-route-channel-mode');
      }
      if (chosenMeta?.hitChannels?.length) {
        pathEl.setAttribute('data-cblcars-route-channels-hit', chosenMeta.hitChannels.join(','));
      } else {
        pathEl.removeAttribute('data-cblcars-route-channels-hit');
      }


      // Preferred channel miss warning (allow / prefer)
      if (routeChannels.length && ['allow','prefer'].includes(routeChannelMode)) {
        const hitSet = new Set(chosenMeta?.hitChannels || []);
        const satisfied = routeChannels.some(id => hitSet.has(id));
        if (!satisfied) pathEl.setAttribute('data-cblcars-route-channels-miss','true');
        else pathEl.removeAttribute('data-cblcars-route-channels-miss');
      } else {
        pathEl.removeAttribute('data-cblcars-route-channels-miss');
      }


      if (chosenMeta?.cost) {
        const c = chosenMeta.cost;
        pathEl.setAttribute('data-cblcars-route-cost-distance', String(c.distanceCost ?? 0));
        pathEl.setAttribute('data-cblcars-route-cost-bends', String(c.bendCost ?? 0));
        if (c.proximityCost != null) pathEl.setAttribute('data-cblcars-route-cost-proximity', String(c.proximityCost));
        if (c.channelFactorAvg != null) pathEl.setAttribute('data-cblcars-route-cost-channel-factor-avg', String(c.channelFactorAvg));
        pathEl.setAttribute('data-cblcars-route-cost-total', String(c.total ?? 0));
      }

    } else if (effectiveMode==='smart'){
      pathEl.setAttribute('data-cblcars-smart-proximity', String(effectiveSmartProx));
      pathEl.setAttribute('data-cblcars-smart-hit', smartHit?'true':'false');
      pathEl.setAttribute('data-cblcars-smart-hit-mode', smartHitMode);

      if (smartSkipped && !attemptGrid){
        const skipReason =
          smartSkipReason === 'no_obstacles'
            ? 'no_obstacles'
            : (smartSkipReason === 'clear_path' ? 'clear_path' : 'no_attempt');
        pathEl.setAttribute('data-cblcars-route-grid-status','skipped');
        pathEl.setAttribute('data-cblcars-route-grid-reason', skipReason);
        pathEl.setAttribute('data-cblcars-smart-skip-reason', smartSkipReason);
        pathEl.removeAttribute('data-cblcars-route-grid-attempts');
      } else {
        pathEl.setAttribute('data-cblcars-route-grid-status', gridAccepted?'success':'fallback');
        pathEl.setAttribute('data-cblcars-route-grid-reason', gridReason);
        if(gridAttempts.length){
          pathEl.setAttribute('data-cblcars-route-grid-attempts', gridAttempts.map(a=>`${a.res}:${a.reason}`).join(','));
        } else {
          pathEl.removeAttribute('data-cblcars-route-grid-attempts');
        }
        if(smartSkipped) pathEl.setAttribute('data-cblcars-smart-skip-reason', smartSkipReason);
        else pathEl.removeAttribute('data-cblcars-smart-skip-reason');
      }
    } else {
      pathEl.setAttribute('data-cblcars-route-grid-status','manhattan');
      pathEl.removeAttribute('data-cblcars-route-grid-reason');
      pathEl.removeAttribute('data-cblcars-route-grid-attempts');
      pathEl.removeAttribute('data-cblcars-smart-hit');
      pathEl.removeAttribute('data-cblcars-smart-proximity');
      pathEl.removeAttribute('data-cblcars-smart-hit-mode');
      pathEl.removeAttribute('data-cblcars-smart-skip-reason');

      pathEl.removeAttribute('data-cblcars-route-channels');
      pathEl.removeAttribute('data-cblcars-route-channels-hit');
      pathEl.removeAttribute('data-cblcars-route-channel-mode');
      pathEl.removeAttribute('data-cblcars-route-channels-miss');
    }

    if (!detourUsed) {
      pathEl.removeAttribute('data-cblcars-route-detour');
      pathEl.removeAttribute('data-cblcars-route-detour-candidates');
      pathEl.removeAttribute('data-cblcars-route-detour-cost');
    }

    if(attrEndpoint) pathEl.setAttribute('data-cblcars-endpoint-explicit','true');
    else pathEl.removeAttribute('data-cblcars-endpoint-explicit');
  } catch(e){
    cblcarsLog.debug('[connector-routing] telemetry update failed', e);
  }

  /* Perf counters */
  perf?.count && perf.count('connectors.route.recomputed');
  if (effectiveMode==='grid'){
    perf?.count && perf.count(gridAccepted ? 'connectors.route.grid.success' : 'connectors.route.grid.fallback');
  } else if (detourUsed){
    perf?.count && perf.count('connectors.route.detour.used');
  } else if (effectiveMode==='smart'){
    perf?.count && perf.count(
      smartHit ? 'connectors.route.smart.hit'
               : (attemptGrid ? 'connectors.route.smart.aggressive' : 'connectors.route.smart.skip')
    );
  }

  // FINAL elbow orientation telemetry (updated to use actual used points)
  try {
    if (usedPointsForOrientation && usedPointsForOrientation.length >= 2) {
      const finalMode = detectFirstOrientation(usedPointsForOrientation) || 'unknown';
      pathEl.setAttribute('data-cblcars-elbow-mode-final', finalMode);
    } else {
      pathEl.removeAttribute('data-cblcars-elbow-mode-final');
    }
  } catch(_) {}

  return {
    d: pathD,
    mode: detourUsed ? 'detour' : effectiveMode,
    usedEndpoint: endpoint,
    smartAttempted
  };
}

/* ----------------------------------------------------------------------------------
 * Global attach (diagnostics + runtime config control)
 * ---------------------------------------------------------------------------------- */
function attachConnectorRoutingGlobal(){
  try {
    window.cblcars = window.cblcars || {};
    const ns = window.cblcars.connectorRouting = window.cblcars.connectorRouting || {};
    if (!ns._attached_v22) {
      ns.routeAutoConnector = routeAutoConnector;
      ns.smartGateEval = smartGateEval;
      ns.setRoutingRuntimeConfig = setRoutingRuntimeConfig;
      ns.getRoutingRuntimeConfig = getRoutingRuntimeConfig;
      ns._version = 'v2.2';
      ns._attached_v22 = true;
      try { console.info('[connector-routing] global API attached v2.2'); } catch (_) {}
    }
  } catch (_) {}
}
attachConnectorRoutingGlobal();