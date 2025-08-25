/**
 * Elbow Orientation Scenario
 *
 * Creates connectors to validate:
 *  - Inferred XY (dx > dy)
 *  - Inferred YX (dy > dx)
 *  - Forced XY (route_mode=xy)
 *  - Forced YX (route_mode=yx)
 *  - Tie case (dx == dy) => should infer 'xy' per inferPreferredElbowMode rule (dx >= dy)
 *  - Reorder (multi-bend path still reports 'xy')
 *  - Nudge (zero first-axis delta triggers endpoint nudge attr + orientation still 'xy')
 *
 * Usage:
 *   await cblcars.dev.api.scenarios.run('elbow_orientation_matrix')
 *   // To preserve lines for visual inspection:
 *   window.cblcars.dev.flags = window.cblcars.dev.flags || {};
 *   window.cblcars.dev.flags.keepElbowScenario = true;
 */
(function initElbowOrientationScenario(){
  const FLAG = '__elbowOrientationScenarioLoaded';
  const SCN = 'elbow_orientation_matrix';
  const MAX_ATTEMPTS = 80;
  const RETRY_MS = 60;

  const rootNS = (window.cblcars = window.cblcars || {});
  rootNS.__elbowOrientationAttempts = rootNS.__elbowOrientationAttempts || 0;

  if (rootNS.dev && rootNS.dev[FLAG]) return;
  if (!rootNS.dev || !rootNS.dev.api || !rootNS.dev.api.scenarios){
    if (rootNS.__elbowOrientationAttempts < MAX_ATTEMPTS){
      rootNS.__elbowOrientationAttempts++;
      return setTimeout(initElbowOrientationScenario, RETRY_MS);
    } else {
      console.warn('[scenarios][elbow_orientation] dev.api.scenarios not available; aborting');
      return;
    }
  }

  const dev = rootNS.dev;
  const existing = (dev.api.scenarios.list() || []).some(s=>s.name===SCN);
  if (existing){
    dev[FLAG] = true;
    return;
  }
  dev[FLAG] = true;

  const { add: addScenario } = dev.api.scenarios;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  addScenario({
    name: SCN,
    group: 'routing',
    stability: 'exp',
    description: 'Validate elbow orientation inference / forced / tie / reorder / nudge behaviors',
    async setup(ctx){
      // Target box
      const targetId = 'elbow_target_box';
      dev.api.overlays.add({
        id: targetId,
        type:'ribbon',
        position:[1100,400],
        size:[260,220],
        on_color:'rgba(0,0,0,0)',
        off_color:'rgba(0,0,0,0)',
        source:'binary_sensor.dummy_elbow_target'
      });

      // Anchors (chosen to exercise orientation logic)
      const anchors = [
        ['anchor_xy_infer',        200, 480],  // dx > dy
        ['anchor_yx_infer',       1180, 820],  // dy > dx (placed below target)
        ['anchor_forced_xy',       220, 700],
        ['anchor_forced_yx',      1180, 220],
        ['anchor_tie_xy',          500, 100],  // dx == dy tie -> 'xy'
        ['anchor_reorder_xy',      180, 300],  // path expected multi-bend grid
        ['anchor_nudge_xy',        200, 510]   // same initial Y as (approx) target center to force nudge
      ];
      ctx.anchors = anchors.map(a=>a[0]);
      anchors.forEach(a=>dev.api.anchors.set(a[0], a[1], a[2]));

      // Obstacles to encourage extra bends for reorder case & ensure some vertical/horizontal detours
      dev.api.overlays.add({
        id:'elbow_obstacle_reorder_mid',
        type:'ribbon',
        position:[640,340],
        size:[140,180],
        on_color:'rgba(255,160,0,0.20)',
        off_color:'rgba(255,160,0,0.14)',
        source:'binary_sensor.dummy_elbow_obstacle1'
      });
      dev.api.overlays.add({
        id:'elbow_obstacle_reorder_far',
        type:'ribbon',
        position:[880,520],
        size:[110,140],
        on_color:'rgba(180,80,255,0.18)',
        off_color:'rgba(180,80,255,0.12)',
        source:'binary_sensor.dummy_elbow_obstacle2'
      });
      ctx.obstacles = ['elbow_obstacle_reorder_mid','elbow_obstacle_reorder_far', targetId];

      // Connectors (grid for multi-bend, some with explicit route_mode)
      const lines = [
        { id:'elbow_line_xy_infer',    anchor:'anchor_xy_infer',      route_mode_full:'grid' },
        { id:'elbow_line_yx_infer',    anchor:'anchor_yx_infer',      route_mode_full:'grid' },
        { id:'elbow_line_forced_xy',   anchor:'anchor_forced_xy',     route_mode_full:'grid', route_mode:'xy' },
        { id:'elbow_line_forced_yx',   anchor:'anchor_forced_yx',     route_mode_full:'grid', route_mode:'yx' },
        { id:'elbow_line_tie_xy',      anchor:'anchor_tie_xy',        route_mode_full:'grid' },
        { id:'elbow_line_reorder_xy',  anchor:'anchor_reorder_xy',    route_mode_full:'grid', avoid:['elbow_obstacle_reorder_mid','elbow_obstacle_reorder_far'] },
        // nudge: start Y near target vertical center -> zero initial vertical delta for an inferred 'xy'
        { id:'elbow_line_nudge_xy',    anchor:'anchor_nudge_xy',      route_mode_full:'grid' }
      ];
      ctx.lines = lines.map(l=>l.id);

      lines.forEach(l=>{
        dev.api.overlays.add({
          id:l.id,
          type:'line',
          anchor:l.anchor,
          attach_to:'elbow_target_box',
          route:'auto',
          route_mode_full:l.route_mode_full,
          route_mode:l.route_mode,
          avoid:l.avoid,
          corner_style:'round',
          corner_radius:32,
          stroke:'var(--lcars-blue)',
          width:10
        });
      });

      // Layout passes (allow geometry + retries)
      await sleep(140);
      dev.api.layout.relayout('*');
      await sleep(240);
      dev.api.layout.relayout('*');
      await sleep(240);
    },
    async expect(ctx){
      const dump = dev.api.layout.dumpRoutes(undefined,{silent:true}) || [];
      const needed = {
        elbow_line_xy_infer:   { expect:'xy' },
        elbow_line_yx_infer:   { expect:'yx' },
        elbow_line_forced_xy:  { expect:'xy' },
        elbow_line_forced_yx:  { expect:'yx' },
        elbow_line_tie_xy:     { expect:'xy' },
        elbow_line_reorder_xy: { expect:'xy' },
        elbow_line_nudge_xy:   { expect:'xy', nudge:true }
      };
      const byId = {};
      dump.forEach(r=>{ if (r.id) byId[r.id]=r; });

      const failures = [];
      Object.entries(needed).forEach(([id, spec])=>{
        const r = byId[id];
        if (!r){
          failures.push(`${id}:missing`);
          return;
        }
        const finalMode = r['data-cblcars-elbow-mode-final'];
        if (finalMode !== spec.expect){
          failures.push(`${id}:final=${finalMode||'none'}!=${spec.expect}`);
        }
        if (spec.nudge){
          const nudged = r['data-cblcars-endpoint-nudged']==='true';
            if (!nudged) failures.push(`${id}:expected_nudged`);
        }
      });

      if (failures.length){
        return { ok:false, details:'Orientation mismatches: '+failures.join(', ') };
      }
      return { ok:true, details:'All elbow orientations match expected' };
    },
    async teardown(ctx){
      if (window.cblcars?.dev?.flags?.keepElbowScenario){
        console.info('[elbow_orientation_matrix] keepElbowScenario flag set - skipping teardown');
        return;
      }
      (ctx.lines||[]).forEach(id=>dev.api.overlays.remove(id));
      (ctx.obstacles||[]).forEach(id=>dev.api.overlays.remove(id));
      (ctx.anchors||[]).forEach(id=>dev.api.anchors.remove(id));
      await sleep(120);
      dev.api.layout.relayout('*');
    }
  });

  console.info('[scenarios] elbow_orientation_matrix registered (attempts:',
    rootNS.__elbowOrientationAttempts,')');
})();

// Export token to prevent tree-shake removal
export const __elbowOrientationScenarioToken = true;
