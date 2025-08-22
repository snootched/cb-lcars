import { perfInc, perfTime } from '../perf/PerfCounters.js';

/**
 * M5.1 RouterCore
 * - Manhattan basic routing
 * - Caching
 * - Placeholders for obstacles & channels
 */
export class RouterCore {
  constructor(routingConfig, anchors, viewBox) {
    this.config = routingConfig || {};
    this.anchors = anchors || {};
    this.viewBox = viewBox;
    this._cache = new Map(); // key -> RouteResult
    this._cacheOrder = [];
    this._maxCache = 256;
    this._rev = 0; // increment to invalidate globally
    this._overlaysRef = null;
    this._obstacles = [];
    this._obsVersion = 0;
    this._gridCache = new Map(); // resolution|obsVersion -> occupancy grid
    this._channels = this._normalizeChannels(this.config.channels || []);
    this._channelForcePenalty = Number(this.config.channel_force_penalty || 800);
    this._channelAvoidMultiplier = Number(this.config.channel_avoid_multiplier || 1.0);
    // NEW (M5.4 shaping config)
    this._channelTargetCoverage = Number(this.config.channel_target_coverage ?? 0.6);
    this._channelShapingMaxAttempts = Number(this.config.channel_shaping_max_attempts ?? 12);
    this._channelShapingSpan = Number(this.config.channel_shaping_span ?? 32);
    this._channelMinCoverageGain = Number(this.config.channel_min_coverage_gain ?? 0.04);
  }

  invalidate(id='*') {
    if (id === '*' ) {
      this._cache.clear();
      this._cacheOrder.length = 0;
      this._rev++;
    } else {
      // Cache key includes overlay id only indirectly; brute force purge by scan.
      for (const k of Array.from(this._cache.keys())) {
        if (k.includes(`@${id}|`)) {
          this._cache.delete(k);
          const i = this._cacheOrder.indexOf(k);
          if (i >= 0) this._cacheOrder.splice(i,1);
        }
      }
    }
    perfInc('routing.invalidate.events', 1);
  }

  setOverlays(overlays) {
    if (!Array.isArray(overlays)) return;
    if (overlays === this._overlaysRef) return;
    this._overlaysRef = overlays;
    // Rebuild obstacle list (ribbon or obstacle:true)
    const obs = [];
    for (const ov of overlays) {
      if (!ov || !ov.id) continue;
      const raw = ov._raw || ov.raw || {};
      const isObstacle = raw.obstacle === true || ov.type === 'ribbon';
      if (!isObstacle) continue;
      // Determine bounds. Prefer size+position (raw.position / raw.size) else anchor if available.
      let x = 0, y = 0, w = 0, h = 0;
      if (Array.isArray(raw.position) && Array.isArray(raw.size)) {
        [x,y] = raw.position;
        [w,h] = raw.size;
      } else if (raw.anchor && this.anchors[raw.anchor]) {
        const [ax,ay] = this.anchors[raw.anchor];
        x = ax - 1; y = ay - 1; w = 2; h = 2;
      } else continue;
      if (!Number.isFinite(x+y+w+h) || w <= 0 || h <= 0) continue;
      obs.push({ id: ov.id, x1: x, y1: y, x2: x + w, y2: y + h });
    }
    this._obstacles = obs;
    this._obsVersion++;
    // Invalidate grids & route cache referencing old obstacles
    this._gridCache.clear();
    this.invalidate('*');
    perfInc('routing.obstacles.count', obs.length);
  }

  stats() {
    return {
      size: this._cache.size,
      max: this._maxCache,
      rev: this._rev,
      obstacles: this._obstacles.length,
      obsVersion: this._obsVersion
    };
  }

  buildRouteRequest(overlay, a1, a2) {
    const raw = overlay._raw || overlay.raw || {};
    const fs = overlay.finalStyle || {};              // NEW: final style fallback
    let channelMode = (raw.route_channel_mode || raw.routeChannelMode || raw.channel_mode || 'prefer').toLowerCase();
    if (!['prefer','avoid','force'].includes(channelMode)) {
      perfInc && perfInc('routing.channel.mode.invalid', 1);
      channelMode = 'prefer';
    }
    let smoothingMode = (
      raw.smoothing_mode ||
      raw.corner_smoothing_mode ||
      fs.smoothing_mode ||
      this.config.smoothing_mode ||
      (this.config.smoothing && this.config.smoothing.mode) ||
      'none'
    ).toLowerCase();
    const allowedSmooth = ['none','chaikin'];
    if (!allowedSmooth.includes(smoothingMode)) {
      try { perfInc('routing.smooth.mode.invalid', 1); } catch(_) {}
      smoothingMode = 'none';
    }
    const smoothingIterations = Number(
      raw.smoothing_iterations ||
      raw.corner_smoothing_iterations ||
      fs.smoothing_iterations ||
      this.config.smoothing_iterations ||
      (this.config.smoothing && this.config.smoothing.iterations) ||
      0
    );
    const smoothingMaxPoints = Number(
      raw.smoothing_max_points ||
      fs.smoothing_max_points ||
      this.config.smoothing_max_points ||
      (this.config.smoothing && this.config.smoothing.max_points) ||
      160
    );
    return {
      id: overlay.id,
      a: a1,
      b: a2,
      modeFull: (raw.route_mode_full || raw.route_mode || 'manhattan').toLowerCase(),
      modeHint: (raw.route_mode || '').toLowerCase(), // xy / yx fallback
      avoidIds: Array.isArray(raw.avoid) ? raw.avoid.slice() : [],
      channels: (raw.route_channels || raw.routeChannels || []),
      channelMode,
      cornerRadius: Number(raw.corner_radius || raw.cornerRadius || fs.corner_radius || 0),
      cornerStyle: (raw.corner_style || raw.cornerStyle || fs.corner_style || 'miter').toLowerCase(),
      smoothingMode,
      smoothingIterations,
      smoothingMaxPoints: Number(
        raw.smoothing_max_points ||
        fs.smoothing_max_points ||
        this.config.smoothing_max_points ||
        (this.config.smoothing && this.config.smoothing.max_points) ||
        160
      ),
      clearance: Number(raw.clearance || this.config.clearance || 0),
      proximity: Number(raw.smart_proximity || this.config.smart_proximity || 0),
      // NEW smart tuning (with sane defaults)
      smart: {
        detourSpan: Number(this.config.smart_detour_span || 48),         // px shift each side
        maxExtraBends: Number(this.config.smart_max_extra_bends || 3),
        minImprovement: Number(this.config.smart_min_improvement || 4),  // cost units
        maxDetoursPerElbow: Number(this.config.smart_max_detours_per_elbow || 4)
      },
      _rev: this._rev
    };
  }

  _cacheKey(req) {
    const [x1,y1] = req.a;
    const [x2,y2] = req.b;
    const avoidKey = req.avoidIds.sort().join(',');
    const chanKey = req.channels.sort().join(',');
    return `${req.id}@${x1},${y1}-${x2},${y2}|${req.modeFull}|${req.modeHint}|A:${avoidKey}|C:${chanKey}|${req.channelMode}|R:${req._rev}|O:${this._obsVersion}|P:${req.proximity}|CR:${req.cornerRadius}|CS:${req.cornerStyle}|SM:${req.smoothingMode}|SI:${req.smoothingIterations}`;
  }

  computePath(req) {
    return perfTime('routing.compute.ms', () => {
      const key = this._cacheKey(req);
      const cached = this._cache.get(key);
      if (cached) {
        perfInc('routing.cache.hit', 1);
        return { ...cached, meta: { ...cached.meta, cache_hit: true } };
      }
      perfInc('routing.cache.miss', 1);
      let result;
      const mode = req.modeFull;
      try {
        if (mode === 'grid') {
          result = this._computeGrid(req);
        } else if (mode === 'smart') {
          perfInc('routing.strategy.smart', 1);
          // Phase 1: base grid
            const gridBase = this._computeGrid(req, { smart: true });
          if (gridBase) {
            result = this._refineSmart(req, gridBase);
          }
        }
      } catch (e) {
        console.warn('[MSD v1] smart/grid router error; fallback to manhattan', e);
      }
      if (!result) {
        if (mode === 'smart') perfInc('routing.strategy.smart', 1);
        result = this._computeManhattan(req);
      }

      if (result && req.cornerStyle === 'round' && req.cornerRadius > 0) {
        const arcApplied = this._applyCornerRounding(result, req.cornerRadius);
        if (arcApplied) result = arcApplied;
      }
      // NEW (M5.6) apply smoothing AFTER arcs (arcs preserved, path rebuilt as polyline if smoothing >0)
      if (result && req.smoothingMode !== 'none' && req.smoothingIterations > 0) {
        const smoothApplied = this._applySmoothing(result, req);
        if (smoothApplied) result = smoothApplied;
      }

      this._cache.set(key, result);
      this._cacheOrder.push(key);
      if (this._cacheOrder.length > this._maxCache) {
        const oldest = this._cacheOrder.shift();
        if (oldest) this._cache.delete(oldest);
      }
      return { ...result, meta: { ...result.meta, cache_hit: false } };
    });
  }

  _computeGrid(req, flags={}) {
    perfInc('routing.strategy.grid', 1);
    const vb = this.viewBox || [0,0,400,200];
    const width = vb[2];
    const height = vb[3];
    const baseRes = Number(this.config.grid_resolution || 64);
    const res = baseRes > 4 ? baseRes : 32;
    const cols = Math.max(2, Math.ceil(width / res));
    const rows = Math.max(2, Math.ceil(height / res));
    const clearance = Math.max(0, req.clearance || this.config.clearance || 0);

    const gridKey = `${res}|${this._obsVersion}|${clearance}`;
    let occ = this._gridCache.get(gridKey);
    if (!occ) {
      occ = this._buildOccupancy(cols, rows, res, clearance);
      this._gridCache.set(gridKey, occ);
    }

    const w2c = (x)=>Math.min(cols-1, Math.max(0, Math.round(x / res)));
    const h2c = (y)=>Math.min(rows-1, Math.max(0, Math.round(y / res)));
    const c2x = (c)=> c * res;
    const c2y = (r)=> r * res;

    const start = { c: w2c(req.a[0]), r: h2c(req.a[1]) };
    const goal  = { c: w2c(req.b[0]), r: h2c(req.b[1]) };

    // A* (4-direction)
    const open = new MinHeap();
    const key = (c,r)=>`${c},${r}`;
    const gScore = new Map();
    const came = new Map();
    const h = (c,r)=> Math.abs(c-goal.c)+Math.abs(r-goal.r);

    gScore.set(key(start.c,start.r),0);
    open.push({ c:start.c, r:start.r, f:h(start.c,start.r) });

    const blocked = (c,r)=> occ[r] && occ[r][c] === 1;

    const maxIterations = cols*rows * 4; // guard
    let iterations = 0;
    let found = false;

    while(!open.isEmpty() && iterations++ < maxIterations) {
      const cur = open.pop();
      if (cur.c === goal.c && cur.r === goal.r) { found = true; break; }
      const gCur = gScore.get(key(cur.c,cur.r));
      for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nc = cur.c+dc, nr = cur.r+dr;
        if (nc<0||nr<0||nc>=cols||nr>=rows) continue;
        if (blocked(nc,nr)) continue;
        const nk = key(nc,nr);
        const gNew = gCur + 1;
        if (gNew < (gScore.get(nk) ?? Infinity)) {
            gScore.set(nk,gNew);
            came.set(nk, [cur.c,cur.r]);
            const f = gNew + h(nc,nr);
            open.push({ c:nc, r:nr, f });
        }
      }
    }

    if (!found) {
      return null; // caller will fallback
    }

    // Reconstruct
    const pathCells = [];
    let cc = goal.c, cr = goal.r;
    while(true) {
      pathCells.push([cc,cr]);
      if (cc === start.c && cr === start.r) break;
      const prev = came.get(key(cc,cr));
      if (!prev) break;
      [cc,cr] = prev;
    }
    pathCells.reverse();

    // Compress straight runs into polyline world coords
    const pts = [];
    let lastDir = null;
    for (let i=0;i<pathCells.length;i++) {
      const [pc,pr] = pathCells[i];
      const wx = c2x(pc);
      const wy = c2y(pr);
      if (i===0) { pts.push([wx,wy]); continue; }
      const [pcPrev,prPrev] = pathCells[i-1];
      const dir = [pc-pcPrev, pr-prPrev].join(',');
      if (dir !== lastDir) {
        // new direction, keep previous cell as corner (if not already added)
        pts.push([wx,wy]);
        lastDir = dir;
      } else {
        // same direction – update last point to current (extend segment)
        pts[pts.length-1] = [wx,wy];
      }
    }
    // Ensure final destination snapping
    pts[0] = [req.a[0], req.a[1]];
    pts[pts.length-1] = [req.b[0], req.b[1]];

    // NEW (M5.2 fix): If compression produced a single diagonal segment, insert a Manhattan elbow.
    if (pts.length === 2) {
      const [sx, sy] = pts[0];
      const [tx, ty] = pts[1];
      if (sx !== tx && sy !== ty) {
        const mode = (req.modeHint === 'yx') ? 'yx' : 'xy';
        if (mode === 'yx') {
          pts.splice(1, 0, [sx, ty]);
        } else {
          pts.splice(1, 0, [tx, sy]);
        }
      }
    }

    const bendW = (this.config?.cost_defaults?.bend ?? 10);
    const proxW = (this.config?.cost_defaults?.proximity ?? 4);
    const { penalty: proxPenalty } = this._segmentProximityPenalty(pts, req.clearance, req.proximity, proxW);
    let channelInfo = this._channelDelta(pts, req);
    let shapingMeta = null;
    if (req.channels?.length && (req.channelMode === 'prefer' || req.channelMode === 'force')) {
      const desired = (req.channelMode === 'force') ? 1.0 : this._channelTargetCoverage;
      if (channelInfo.coverage < desired) {
        const shapeRes = this._shapeForChannels(req, pts, channelInfo, desired);
        if (shapeRes && shapeRes.accepted) {
          pts = shapeRes.pts;
          channelInfo = this._channelDelta(pts, req); // recompute
          shapingMeta = shapeRes.meta;
          perfInc('routing.channel.shape.accept', 1);
        } else if (shapeRes) {
          shapingMeta = shapeRes.meta;
        }
      }
    }
    const totalCost = this._costComposite(pts, bendW, proxW, proxPenalty, channelInfo.delta);
    const d = this._polylineToPath(pts);
    return {
      d,
      pts,
      meta: {
        strategy: flags.smart ? 'grid-smart-preface' : 'grid',
        cost: totalCost,
        segments: pts.length - 1,
        bends: Math.max(0, pts.length - 2),
        grid: { resolution: res, iterations },
        ...(req.channels?.length ? {
          channel: {
            mode: channelInfo.mode,
            insidePx: channelInfo.inside,
            outsidePx: channelInfo.outside,
            coveragePct: Number((channelInfo.coverage*100).toFixed(1)),
            deltaCost: channelInfo.delta,
            forcedOutside: channelInfo.forcedOutside,
            ...(shapingMeta ? { shaping: shapingMeta } : {})
          }
        } : {})
      }
    };
  }

  _buildOccupancy(cols, rows, res, clearance) {
    // 0 = free, 1 = blocked
    const occ = Array.from({ length: rows }, () => new Uint8Array(cols));
    if (!this._obstacles.length) return occ;
    for (const ob of this._obstacles) {
      const x1 = ob.x1 - clearance;
      const y1 = ob.y1 - clearance;
      const x2 = ob.x2 + clearance;
      const y2 = ob.y2 + clearance;
      const c0 = Math.max(0, Math.floor(x1 / res));
      const r0 = Math.max(0, Math.floor(y1 / res));
      const c1 = Math.min(cols-1, Math.ceil(x2 / res));
      const r1 = Math.min(rows-1, Math.ceil(y2 / res));
      for (let r=r0; r<=r1; r++) {
        const row = occ[r];
        for (let c=c0; c<=c1; c++) {
          row[c] = 1;
        }
      }
    }
    return occ;
  }

  _computeManhattan(req) {
    const [x1,y1] = req.a;
    const [x2,y2] = req.b;
    const mode = (req.modeHint === 'yx') ? 'yx' : 'xy';
    let pts;
    if (x1 === x2 || y1 === y2) {
      pts = [[x1,y1],[x2,y2]];
    } else if (mode === 'yx') {
      pts = [[x1,y1],[x1,y2],[x2,y2]];
    } else {
      pts = [[x1,y1],[x2,y1],[x2,y2]];
    }
    const d = this._polylineToPath(pts);
    return {
      d,
      pts,
      meta: {
        strategy: 'manhattan-basic',
        cost: this._costSimple(pts),
        segments: pts.length - 1,
        bends: Math.max(0, pts.length - 2)
      }
    };
  }

  _polylineToPath(pts) {
    if (!pts.length) return '';
    let p = `M${pts[0][0]},${pts[0][1]}`;
    for (let i=1;i<pts.length;i++) {
      p += ` L${pts[i][0]},${pts[i][1]}`;
    }
    return p;
  }

  _costSimple(pts) {
    let dist = 0;
    for (let i=1;i<pts.length;i++) {
      const dx = pts[i][0]-pts[i-1][0];
      const dy = pts[i][1]-pts[i-1][1];
      dist += Math.abs(dx)+Math.abs(dy);
    }
    const bends = Math.max(0, pts.length-2);
    const bendWeight = (this.config?.cost_defaults?.bend ?? 10);
    return dist + bends * bendWeight;
  }

  _costComposite(pts, bendsWeight, proximityWeight, proximityPenalty, channelDelta = 0) {
    // distance + bendsWeight*bends + proximityWeight*penalty
    let dist = 0;
    for (let i=1;i<pts.length;i++) {
      dist += Math.abs(pts[i][0]-pts[i-1][0]) + Math.abs(pts[i][1]-pts[i-1][1]);
    }
    const bends = Math.max(0, pts.length - 2);
    return dist + bends * bendsWeight + proximityPenalty * proximityWeight + channelDelta;
  }

  _segmentProximityPenalty(pts, clearance, proximity, proximityWeightRaw) {
    if (!proximity || !this._obstacles.length) return { penalty: 0, detail: [] };
    const band = clearance + proximity;
    let total = 0;
    const detail = [];
    for (let i=1;i<pts.length;i++) {
      const a = pts[i-1], b = pts[i];
      const segPenalty = this._nearestObstacleBandOverlap(a, b, band);
      if (segPenalty > 0) {
        total += segPenalty;
        detail.push({ i, segPenalty });
      }
    }
    return { penalty: total, detail };
  }

  _nearestObstacleBandOverlap(a, b, band) {
    // Axis-aligned segments only
    const vertical = a[0] === b[0];
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    let worst = 0;
    for (const ob of this._obstacles) {
      // Quick reject bounding box enlarged by band
      if (x2 < ob.x1 - band || x1 > ob.x2 + band || y2 < ob.y1 - band || y1 > ob.y2 + band) continue;
      let d;
      if (vertical) {
        // Distance from line x=a.x to obstacle horizontal span
        if (a[0] < ob.x1) d = ob.x1 - a[0];
        else if (a[0] > ob.x2) d = a[0] - ob.x2;
        else d = 0;
      } else {
        if (a[1] < ob.y1) d = ob.y1 - a[1];
        else if (a[1] > ob.y2) d = a[1] - ob.y2;
        else d = 0;
      }
      if (d < band) {
        const p = (band - d); // linear penalty (could square later)
        if (p > worst) worst = p;
      }
    }
    return worst;
  }

  _normalizeChannels(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(c => c && Array.isArray(c.rect) && c.rect.length === 4)
      .map(c => {
        const [x,y,w,h] = c.rect;
        return {
          id: c.id || `chan_${x}_${y}`,
          x1: x, y1: y, x2: x + w, y2: y + h,
          weight: Number(c.weight || c.w || 0.5)
        };
      });
  }

  _channelDelta(pts, req) {
    if (!this._channels.length || !req.channels || !req.channels.length) return { delta: 0, inside: 0, outside: 0, coverage: 0, forcedOutside: false, mode: req.channelMode };
    // Filter to requested channel IDs (ignore unknown)
    const chanSet = new Set(req.channels);
    const chans = this._channels.filter(c => chanSet.has(c.id));
    if (!chans.length) return { delta: 0, inside: 0, outside: 0, coverage: 0, forcedOutside: false };

    let inside = 0;
    let outside = 0;
    // Forcing: a point is "inside preferred set" if midpoint is inside ANY requested channel rect.
    for (let i=1;i<pts.length;i++) {
      const a = pts[i-1], b = pts[i];
      const segLen = Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]);
      if (segLen === 0) continue;
      // Midpoint (orthogonal so pick center)
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const inChan = chans.some(c => mx >= c.x1 && mx <= c.x2 && my >= c.y1 && my <= c.y2);
      if (inChan) inside += segLen;
      else outside += segLen;
    }
    const coverage = inside / (inside + outside || 1);
    let delta = 0;
    const mode = (req.channelMode || 'prefer').toLowerCase();
    let forcedOutside = false;
    if (mode === 'prefer') {
      // Reward inside (subtract)
      const weightAvg = chans.reduce((s,c)=>s+c.weight,0)/chans.length;
      delta -= inside * weightAvg;
    } else if (mode === 'avoid') {
      const weightAvg = chans.reduce((s,c)=>s+c.weight,0)/chans.length;
      delta += inside * weightAvg * this._channelAvoidMultiplier;
    } else if (mode === 'force') {
      if (outside > 0) {
        forcedOutside = true;
        delta += this._channelForcePenalty;
      } else {
        const weightAvg = chans.reduce((s,c)=>s+c.weight,0)/chans.length;
        delta -= inside * weightAvg; // full reward when fully inside
      }
    }
    if (delta !== 0) perfInc('routing.channel.applied', 1);
    if (forcedOutside) perfInc('routing.channel.force.penalty', 1);
    return { delta, inside, outside, coverage, forcedOutside, mode: req.channelMode };
  }

  _refineSmart(req, gridBase) {
    if (!gridBase || !Array.isArray(gridBase.pts) || gridBase.pts.length < 2) return gridBase;
    const bendW = (this.config?.cost_defaults?.bend ?? 10);
    const proxW = (this.config?.cost_defaults?.proximity ?? 4);
    const { penalty: penaltyBefore } = this._segmentProximityPenalty(gridBase.pts, req.clearance, req.proximity, proxW);
    let bestPts = gridBase.pts.slice();
    let bestPenalty = penaltyBefore;
    let bestCost = this._costComposite(bestPts, bendW, proxW, bestPenalty);
    let detoursTried = 0;
    let detoursAccepted = 0;

    if (req.proximity > 0 && bestPts.length > 2) {
      // Try shifting each elbow (not endpoints)
      const span = req.smart.detourSpan;
      const maxExtraBends = req.smart.maxExtraBends;
      const minImprove = req.smart.min_improvement;
      for (let i=1;i<bestPts.length-1;i++) {
        const elbow = bestPts[i];
        const prev = bestPts[i-1];
        const next = bestPts[i+1];
        const verticalIn = prev[0] === elbow[0]; // incoming dir
        const horizontalOut = elbow[1] === next[1]; // outgoing dir
        // Only elbows where both dirs present (true elbow)
        if ((verticalIn && horizontalOut) || (!verticalIn && !horizontalOut)) {
          // Determine orthogonal shift axis (shift elbow along one axis to widen clearance)
          const candidates = [];
          if (verticalIn && horizontalOut) {
            // elbow shape └ or ┌ etc. shift in a box: along x and y
            candidates.push([elbow[0] + span, elbow[1]]);
            candidates.push([elbow[0] - span, elbow[1]]);
            candidates.push([elbow[0], elbow[1] + span]);
            candidates.push([elbow[0], elbow[1] - span]);
          } else {
            candidates.push([elbow[0] + span, elbow[1]]);
            candidates.push([elbow[0] - span, elbow[1]]);
            candidates.push([elbow[0], elbow[1] + span]);
            candidates.push([elbow[0], elbow[1] - span]);
          }
          let tries = 0;
          for (const c of candidates) {
            if (tries++ >= req.smart.maxDetoursPerElbow) break;
            detoursTried++;
            const newPts = bestPts.slice();
            newPts[i] = c;
            // Prevent duplicate successive collinear points (basic)
            const compact = this._compactPolyline(newPts);
            if (compact.length - bestPts.length > maxExtraBends) continue;
            const { penalty: p2 } = this._segmentProximityPenalty(compact, req.clearance, req.proximity, proxW);
            const cost2 = this._costComposite(compact, bendW, proxW, p2);
            if (cost2 + minImprove <= bestCost) {
              bestCost = cost2;
              bestPts = compact;
              bestPenalty = p2;
              detoursAccepted++;
            }
          }
        }
      }
    }

    const channelInfo = this._channelDelta(bestPts, req);
    // Channel shaping (only prefer/force & if coverage below target)
    let shapingMeta = null;
    if (req.channels?.length && (req.channelMode === 'prefer' || req.channelMode === 'force')) {
      const desired = (req.channelMode === 'force') ? 1.0 : this._channelTargetCoverage;
      if (channelInfo.coverage < desired) {
        const shapeRes = this._shapeForChannels(req, bestPts, channelInfo, desired);
        if (shapeRes && shapeRes.accepted) {
          bestPts = shapeRes.pts;
          // recompute penalties
          const newChan = this._channelDelta(bestPts, req);
          const { penalty: newProx } = this._segmentProximityPenalty(bestPts, req.clearance, req.proximity, proxW);
            bestPenalty = newProx; // proximity might change slightly (rare) – reassign
          shapingMeta = shapeRes.meta;
          // recompute cost with new channel delta
          bestCost = this._costComposite(bestPts, bendW, proxW, bestPenalty, newChan.delta);
          // overwrite channelInfo for meta
          channelInfo.inside = newChan.inside;
          channelInfo.outside = newChan.outside;
          channelInfo.coverage = newChan.coverage;
          channelInfo.delta = newChan.delta;
          channelInfo.forcedOutside = newChan.forcedOutside;
          perfInc('routing.channel.shape.accept', 1);
        } else if (shapeRes) {
          shapingMeta = shapeRes.meta;
        }
      }
    }
    // REPLACED duplicate const bestCost decl with in-place update earlier
    bestCost = this._costComposite(bestPts, bendW, proxW, bestPenalty, channelInfo.delta);
    const d = this._polylineToPath(bestPts);
    const baseMeta = gridBase.meta || {};
    baseMeta.strategy = 'smart';
    baseMeta.cost = bestCost;
    baseMeta.bends = Math.max(0, bestPts.length - 2);
    baseMeta.segments = bestPts.length - 1;
    baseMeta.smart = {
      penaltyBefore,
      penaltyAfter: bestPenalty,
      detoursTried,
      detoursAccepted
    };
    if (req.channels?.length) {
      baseMeta.channel = {
        mode: channelInfo.mode,
        insidePx: channelInfo.inside,
        outsidePx: channelInfo.outside,
        coveragePct: Number((channelInfo.coverage*100).toFixed(1)),
        deltaCost: channelInfo.delta,
        forcedOutside: channelInfo.forcedOutside,
        ...(shapingMeta ? { shaping: shapingMeta } : {})
      };
    }
    perfInc('routing.smart.refine.attempt', detoursTried);
    perfInc('routing.smart.refine.accept', detoursAccepted);
    return { d, pts: bestPts, meta: baseMeta };
  }

  _compactPolyline(pts) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    for (let i=1;i<pts.length-1;i++) {
      const a = out[out.length-1];
      const b = pts[i];
      const c = pts[i+1];
      // If a->b and b->c are collinear, skip b
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) continue;
      out.push(b);
    }
    out.push(pts[pts.length-1]);
    return out;
  }

  _shapeForChannels(req, pts, channelInfo, desiredCoverage) {
    perfInc('routing.channel.shape.attempt', 1);
    const attemptsMax = this._channelShapingMaxAttempts;
    const span = this._channelShapingSpan;
    const minGain = this._channelMinCoverageGain;
    const chanIds = new Set(req.channels);
    const chans = this._channels.filter(c => chanIds.has(c.id));
    if (!chans.length) return null;

    const coverage0 = channelInfo.coverage;
    let bestPts = pts.slice();
    let bestCoverage = coverage0;
    let accepted = false;
    let attempts = 0;
    let coverageHistory = [Number(coverage0.toFixed(4))];
    const forceMode = (req.channelMode === 'force');

    function midpoint(a,b){ return [(a[0]+b[0])/2,(a[1]+b[1])/2]; }
    const inAny = (x,y)=>chans.some(c=> x>=c.x1 && x<=c.x2 && y>=c.y1 && y<=c.y2);

    const segsOutside = () => {
      const list = [];
      for (let i=1;i<bestPts.length;i++){
        const a=bestPts[i-1], b=bestPts[i];
        const len=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
        if(!len) continue;
        const [mx,my]=midpoint(a,b);
        if(!inAny(mx,my)) list.push({i,len,a,b,mx,my});
      }
      return list.sort((x,y)=>y.len-x.len);
    };

    while (attempts < attemptsMax) {
      attempts++;
      const outsideSegs = segsOutside();
      if (!outsideSegs.length) break; // fully inside
      // pick the largest outside segment
      const seg = outsideSegs[0];
      // Try shifting its interior elbow(s) if any
      // Identify candidate elbow indices around this segment
      const elbowIndices = [];
      if (seg.i-1 > 0) elbowIndices.push(seg.i-1);
      if (seg.i < bestPts.length-1) elbowIndices.push(seg.i);

      let improved = false;
      for (const ei of elbowIndices) {
        const copy = bestPts.map(p=>p.slice());
        // shift target elbow towards nearest channel center
        const e = copy[ei];
        // Compute shortest move vector to enter any channel (axis aligned)
        let bestMove = null;
        let bestMoveDist = Infinity;
        chans.forEach(c => {
          // For a point outside, compute minimal axis step into rect
            const dx = (e[0] < c.x1) ? (c.x1 - e[0]) :
                       (e[0] > c.x2) ? (c.x2 - e[0]) : 0;
            const dy = (e[1] < c.y1) ? (c.y1 - e[1]) :
                       (e[1] > c.y2) ? (c.y2 - e[1]) : 0;
          // Only consider moving along one axis per attempt (choose smaller non-zero)
          if (dx !==0 && dy !==0) {
            // pick smaller
            if (Math.abs(dx) < Math.abs(dy)) {
              if (Math.abs(dx) < bestMoveDist) { bestMoveDist = Math.abs(dx); bestMove = [dx,0]; }
            } else {
              if (Math.abs(dy) < bestMoveDist) { bestMoveDist = Math.abs(dy); bestMove = [0,dy]; }
            }
          } else if (dx !==0 || dy !==0) {
            const d = Math.abs(dx||dy);
            if (d < bestMoveDist) { bestMoveDist = d; bestMove = [dx,dy]; }
          }
        });
        if (!bestMove) continue;
        // scale move to span (limit)
        const mv = [
          bestMove[0] === 0 ? 0 : Math.sign(bestMove[0]) * Math.min(Math.abs(bestMove[0]), span),
          bestMove[1] === 0 ? 0 : Math.sign(bestMove[1]) * Math.min(Math.abs(bestMove[1]), span)
        ];
        copy[ei] = [e[0] + mv[0], e[1] + mv[1]];
        // Compact polyline if collinear introduced
        const compact = this._compactPolyline(copy);
        const newChan = this._channelDelta(compact, req);
        const gain = newChan.coverage - bestCoverage;
        if (gain >= minGain) {
          bestPts = compact;
          bestCoverage = newChan.coverage;
          coverageHistory.push(Number(bestCoverage.toFixed(4)));
          improved = true;
          if (forceMode && bestCoverage >= 0.999) break;
          if (!forceMode && bestCoverage >= desiredCoverage) break;
        }
      }
      if (!improved) break;
      if ((forceMode && bestCoverage >= 0.999) || (!forceMode && bestCoverage >= desiredCoverage)) {
        accepted = true;
        break;
      }
    }

    // Force downgrade if still outside & force mode
    let downgraded = false;
    if (forceMode && bestCoverage < 0.999) {
      downgraded = true;
      // mark but caller meta will keep mode=force + forcedOutside flag (HUD can show downgrade)
      perfInc('routing.channel.shape.downgrade', 1);
    }

    return {
      accepted,
      pts: bestPts,
      meta: {
        attempts,
        coverageBefore: Number(coverage0.toFixed(4)),
        coverageAfter: Number(bestCoverage.toFixed(4)),
        coverageHistory,
        accepted,
        downgraded
      }
    };
  }

  _applyCornerRounding(routeResult, radiusGlobal) {
    const pts = routeResult.pts;
    if (!Array.isArray(pts) || pts.length < 3) {
      perfInc('routing.arc.none', 1);
      return null;
    }
    const arcMin = 1;
    let arcCount = 0;
    let totalTrim = 0;
    const parts = [];
    let lastOut = pts[0].slice();
    parts.push(`M${lastOut[0]},${lastOut[1]}`);
    for (let i = 1; i < pts.length - 1; i++) {
      const pPrev = pts[i - 1];
      const p = pts[i];
      const pNext = pts[i + 1];
      const vIn = [p[0] - pPrev[0], p[1] - pPrev[1]];
      const vOut = [pNext[0] - p[0], pNext[1] - p[1]];
      const isOrth = (vIn[0] === 0 || vIn[1] === 0) && (vOut[0] === 0 || vOut[1] === 0) && !(vIn[0] === 0 && vIn[1] === 0) && !(vOut[0] === 0 && vOut[1] === 0) && !(Math.sign(vIn[0]) === Math.sign(vOut[0]) && vIn[0] !== 0) && !(Math.sign(vIn[1]) === Math.sign(vOut[1]) && vIn[1] !== 0);
      if (!isOrth) {
        // Just connect full corner
        if (p[0] !== lastOut[0] || p[1] !== lastOut[1]) {
          parts.push(`L${p[0]},${p[1]}`);
          lastOut = p.slice();
        }
        continue;
      }
      const lenIn = Math.abs(vIn[0]) + Math.abs(vIn[1]);
      const lenOut = Math.abs(vOut[0]) + Math.abs(vOut[1]);
      let r = Math.min(radiusGlobal, lenIn / 2, lenOut / 2);
      if (r < arcMin) {
        if (p[0] !== lastOut[0] || p[1] !== lastOut[1]) {
          parts.push(`L${p[0]},${p[1]}`);
          lastOut = p.slice();
        }
        continue;
      }
      // Trim points
      let pInTrim = p.slice();
      if (vIn[0] !== 0) {
        pInTrim[0] = p[0] - Math.sign(vIn[0]) * r;
      } else {
        pInTrim[1] = p[1] - Math.sign(vIn[1]) * r;
      }
      let pOutTrim = p.slice();
      if (vOut[0] !== 0) {
        pOutTrim[0] = p[0] + Math.sign(vOut[0]) * r;
      } else {
        pOutTrim[1] = p[1] + Math.sign(vOut[1]) * r;
      }
      // Line to trimmed incoming point
      if (pInTrim[0] !== lastOut[0] || pInTrim[1] !== lastOut[1]) {
        parts.push(`L${pInTrim[0]},${pInTrim[1]}`);
      }
      // Determine sweep flag (clockwise vs counter-clockwise) using z of 2D cross
      const cross = vIn[0] * vOut[1] - vIn[1] * vOut[0];
      const sweep = cross < 0 ? 0 : 1;
      // Use small arc (90°) => large-arc-flag = 0
      parts.push(`A${r},${r} 0 0 ${sweep} ${pOutTrim[0]},${pOutTrim[1]}`);
      totalTrim += 2 * r;
      arcCount++;
      lastOut = pOutTrim;
    }
    // Last point
    const pEnd = pts[pts.length - 1];
    if (pEnd[0] !== lastOut[0] || pEnd[1] !== lastOut[1]) {
      parts.push(`L${pEnd[0]},${pEnd[1]}`);
    }
    // If no arcs applied, skip
    if (!arcCount) {
      perfInc('routing.arc.none', 1);
      return null;
    }
    perfInc('routing.arc.apply', 1);
    const newResult = {
      ...routeResult,
      d: parts.join(' '),
      meta: {
        ...routeResult.meta,
        arc: {
          count: arcCount,
          trimPx: Math.round(totalTrim)
        }
      }
    };
    return newResult;
  }

  _applySmoothing(routeResult, req) {
    const mode = req.smoothingMode;
    if (mode === 'none' || req.smoothingIterations <= 0) return null;
    let iters = Math.min(5, Math.max(1, req.smoothingIterations|0));
    if (!Array.isArray(routeResult.pts) || routeResult.pts.length < 3) return null;
    if (mode !== 'chaikin') return null; // only mode supported now
    let pts = routeResult.pts.map(p=>[p[0],p[1]]);
    // If arcs already applied we try to reconstruct polyline from original pts (already available)
    // Chaikin corner cutting
    for (let k=0; k<iters; k++) {
      const next = [pts[0]];
      for (let i=0;i<pts.length-1;i++){
        const p=pts[i], q=pts[i+1];
        const Q=[0.75*p[0]+0.25*q[0], 0.75*p[1]+0.25*q[1]];
        const R=[0.25*p[0]+0.75*q[0], 0.25*p[1]+0.75*q[1]];
        next.push(Q,R);
        if (next.length >= req.smoothingMaxPoints) break;
      }
      next.push(pts[pts.length-1]);
      pts = next;
      if (pts.length >= req.smoothingMaxPoints) break;
    }
    // Build path (polyline with many short segments)
    const d = pts.reduce((acc,p,i)=> acc + (i?` L${p[0]},${p[1]}`:`M${p[0]},${p[1]}`),'');
    const newMeta = {
      ...routeResult.meta,
      smooth: {
        mode,
        iterations: iters,
        points: pts.length,
        addedPoints: pts.length - routeResult.pts.length
      }
    };
    perfInc('routing.smooth.apply',1);
    return { ...routeResult, d, pts, meta: newMeta };
  }
}

// Simple min-heap for A*
class MinHeap {
  constructor(){ this.a=[]; }
  push(n){ this.a.push(n); this._up(this.a.length-1); }
  pop(){
    if(!this.a.length) return null;
    const top=this.a[0];
    const last=this.a.pop();
    if(this.a.length){ this.a[0]=last; this._down(0); }
    return top;
  }
  isEmpty(){ return this.a.length===0; }
  _up(i){
    while(i>0){
      const p=(i-1)>>1;
      if(this.a[p].f <= this.a[i].f) break;
      [this.a[p],this.a[i]]=[this.a[i],this.a[p]];
      i=p;
    }
  }
  _down(i){
    const n=this.a.length;
    while(true){
      let l=i*2+1, r=l+1, m=i;
      if(l<n && this.a[l].f < this.a[m].f) m=l;
      if(r<n && this.a[r].f < this.a[m].f) m=r;
      if(m===i) break;
      [this.a[m],this.a[i]]=[this.a[i],this.a[m]];
      i=m;
    }
  }
}
