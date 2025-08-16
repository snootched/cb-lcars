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
function parseExplicitEndpoint(el){
  if(!el) return null;
  const raw = el.getAttribute('data-cblcars-endpoint');
  if(!raw) return null;
  const parts = raw.trim().split(/[, ]+/).map(Number);
  if(parts.length>=2 && parts.slice(0,2).every(n=>Number.isFinite(n))) return [parts[0], parts[1]];
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

  /* Grid routing attempts (use normObs as obstacles) */
  const resolutionsToTry = attemptGrid
    ? [...new Set(multipliers.map(m=>Math.round(baseResolution*m)))]
        .filter(r=>r>0 && r<=maxRes)
    : [];

  let gridAccepted=false, gridReason='not_tried', gridAttempts=[], chosenMeta=null;
  if (attemptGrid){
    for(const res of resolutionsToTry){
      const meta = routeViaGrid({
        root,
        viewBox,
        start:[sx,sy],
        end:[endpoint[0],endpoint[1]],
        obstacles: normObs,
        resolution: res,
        costParams: mergedGlobal.cost_defaults,
        connectorId: pathEl.id
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
  if(gridAccepted && chosenMeta?.points?.length>=2){
    pathD = `M${chosenMeta.points[0][0]},${chosenMeta.points[0][1]}`;
    for(let i=1;i<chosenMeta.points.length;i++){
      const pt = chosenMeta.points[i];
      pathD += ` L${pt[0]},${pt[1]}`;
    }
    try {
      registerResult(pathEl.id,{
        strategy:'grid',
        expansions:chosenMeta.expansions,
        cost:chosenMeta.cost,
        bends:chosenMeta.cost?.bends,
        pathHash:chosenMeta.pathHash,
        endDelta:chosenMeta.endDelta,
        resolution:chosenMeta.resolution
      });
    } catch(_) {}
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

  /* Telemetry stamping */
  try {
    pathEl.setAttribute('data-cblcars-route-effective', effectiveMode);
    if (effectiveMode==='grid'){
      pathEl.setAttribute('data-cblcars-route-grid-status', gridAccepted?'success':'fallback');
      pathEl.setAttribute('data-cblcars-route-grid-reason', gridReason);
      pathEl.setAttribute('data-cblcars-route-grid-attempts', gridAttempts.map(a=>`${a.res}:${a.reason}`).join(','));
      pathEl.removeAttribute('data-cblcars-smart-hit');
      pathEl.removeAttribute('data-cblcars-smart-proximity');
      pathEl.removeAttribute('data-cblcars-smart-hit-mode');
      pathEl.removeAttribute('data-cblcars-smart-skip-reason');
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
  } else if (effectiveMode==='smart'){
    perf?.count && perf.count(
      smartHit ? 'connectors.route.smart.hit'
               : (attemptGrid ? 'connectors.route.smart.aggressive' : 'connectors.route.smart.skip')
    );
  }

  return {
    d: pathD,
    mode: effectiveMode,
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