/**
 * Routing Stress / Matrix Scenario
 * Exercises: grid success, grid fallback, smart(clear), smart(blocked->grid),
 * detour (two-elbow), channel require hit, channel require miss, manhattan baseline.
 *
 * Categories validated (all must be observed at least once):
 *  - grid_success
 *  - grid_fallback
 *  - smart_clear (smart mode, smart-hit=false, no grid attempt OR skip reason)
 *  - smart_hit (smart-hit=true leading to grid attempt/route)
 *  - detour (data-cblcars-route-detour=true)
 *  - channel_hit (data-cblcars-route-channels-hit present)
 *  - channel_miss (data-cblcars-route-channels-miss=true)
 *  - manhattan (data-cblcars-route-grid-status=manhattan)
 */

// REPLACED immediate IIFE with deferred retry loader (waits for dev.api.scenarios)
(function initRoutingStressScenario(){
  const SCN_FLAG = '__routingStressScenarioLoaded';
  const SCN_NAME = 'routing_stress_matrix';
  const MAX_ATTEMPTS = 80; // ~4.8s at 60ms
  const RETRY_MS = 60;

  // Attempt counter stored globally so multiple script loads share it
  const rootNS = (window.cblcars = window.cblcars || {});
  rootNS.__routingStressAttempts = rootNS.__routingStressAttempts || 0;

  // If already loaded, bail
  if (rootNS.dev && rootNS.dev[SCN_FLAG]) return;

  // Not ready? retry
  if (!rootNS.dev || !rootNS.dev.api || !rootNS.dev.api.scenarios) {
    if (rootNS.__routingStressAttempts < MAX_ATTEMPTS) {
      rootNS.__routingStressAttempts++;
      return setTimeout(initRoutingStressScenario, RETRY_MS);
    } else {
      console.warn('[scenarios][routing_stress] dev.api.scenarios not available; giving up');
      return;
    }
  }

  const dev = rootNS.dev;
  const existingNames = (dev.api.scenarios.list()?.map(s=>s.name)) || [];
  if (existingNames.includes(SCN_NAME)) {
    dev[SCN_FLAG] = true;
    console.info('[scenarios][routing_stress] already present (external registration)');
    return;
  }

  dev[SCN_FLAG] = true;

  const { add: addScenario } = dev.api.scenarios;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  addScenario({
    name:SCN_NAME,
    group:'routing',
    stability:'exp',
    description:'Comprehensive routing mode / outcome presence validation',
    async setup(ctx){
      // Anchors (tuned positions)
      const A = [
        ['stress_anchor_grid',             180, 520], // normal grid success
        ['stress_anchor_grid_fallback',    180, 900], // forces grid fallback (channel require unreachable)
        ['stress_anchor_smart_clear',      180, 240], // smart clear (far from obstacles)
        ['stress_anchor_smart_blocked',    180, 470], // smart hit (near obstacle)
        ['stress_anchor_detour',           180, 650], // detour (both Manhattan orders blocked)
        ['stress_anchor_channel_hit',      180, 360], // channel require hit (inside main bus)
        ['stress_anchor_channel_miss',     180, 860], // channel prefer miss (path avoids channels)
        ['stress_anchor_manhattan',        120, 110]  // manhattan baseline
      ];
      ctx.anchors = A.map(a=>a[0]);
      A.forEach(a=>dev.api.anchors.set(a[0],a[1],a[2]));

      // Patch global routing config (ensure channels & fallback detour)
      try {
        const existing = window.cblcars.routing?.getGlobalConfig?.() || {};
        window.cblcars.routing?.setGlobalConfig?.({
          ...existing,
          channels: [
            { id:'stress_bus_main', rect:[420,300,780,110], weight:0.6 }, // x 420-1200, y 300-410
            { id:'stress_bus_aux',  rect:[420,660,780,110], weight:0.7 }  // x 420-1200, y 660-770
          ],
          fallback: { enable_two_elbow:true }
        });
      } catch(_) {}

      const targetId='stress_target_box';
      dev.api.overlays.add({
        id:targetId,type:'ribbon',
        position:[1500,460],size:[260,200],
        on_color:'rgba(0,0,0,0)',off_color:'rgba(0,0,0,0)',
        source:'binary_sensor.dummy_stress_target'
      });

      // Obstacles
      dev.api.overlays.add({
        id:'stress_obstacle_mid',type:'ribbon',
        position:[700,440],size:[180,160], // covers y 440-600
        on_color:'rgba(255,120,0,0.18)',off_color:'rgba(255,120,0,0.14)',
        source:'binary_sensor.dummy_mid'
      });
      dev.api.overlays.add({
        id:'stress_obstacle_vertical',type:'ribbon',
        position:[900,120],size:[120,820], // tall vertical blocker
        on_color:'rgba(0,180,255,0.18)',off_color:'rgba(0,180,255,0.10)',
        source:'binary_sensor.dummy_vert'
      });
      dev.api.overlays.add({
        id:'stress_obstacle_detour_block',type:'ribbon',
        position:[700,600],size:[160,170], // y 600-770
        on_color:'rgba(180,0,255,0.18)',off_color:'rgba(180,0,255,0.10)',
        source:'binary_sensor.dummy_detour'
      });
      // NEW: start-side blocker to force YX Manhattan blockage for detour anchor
      dev.api.overlays.add({
        id:'stress_obstacle_start_block',type:'ribbon',
        position:[140,500],size:[140,220], // x 140-280 (covers start x 180), y 500-720
        on_color:'rgba(255,0,120,0.18)',off_color:'rgba(255,0,120,0.12)',
        source:'binary_sensor.dummy_start'
      });

      ctx.overlayIds = [
        targetId,'stress_obstacle_mid','stress_obstacle_vertical',
        'stress_obstacle_detour_block','stress_obstacle_start_block'
      ];

      // Connectors (tuned)
      const lines = [
        // Grid success
        { id:'stress_line_grid', anchor:'stress_anchor_grid', route_mode_full:'grid',
          avoid:['stress_obstacle_mid'], stroke:'var(--lcars-green)', width:10 },

        // Grid fallback: require aux channel but geometry avoids channel spans (start y=900; vertical segment x=1500 outside channel x-range)
        { id:'stress_line_grid_fallback', anchor:'stress_anchor_grid_fallback', route_mode_full:'grid',
          route_channels:['stress_bus_aux'], route_channel_mode:'require',
          avoid:['stress_obstacle_mid','stress_obstacle_vertical'], stroke:'var(--lcars-red)', width:10 },

        // Smart clear: no avoids; obstacles exist elsewhere but corridors clear
        { id:'stress_line_smart_clear', anchor:'stress_anchor_smart_clear', route_mode_full:'smart',
          stroke:'var(--lcars-yellow)', width:10 },

        // Smart blocked: obstacle mid triggers smart hit (proximity)
        { id:'stress_line_smart_blocked', anchor:'stress_anchor_smart_blocked', route_mode_full:'smart',
          avoid:['stress_obstacle_mid'], smart_proximity:24, stroke:'var(--lcars-blue)', width:12 },

        // Detour: both XY & YX Manhattan blocked by combination of mid + detour_block + start_block
        { id:'stress_line_detour', anchor:'stress_anchor_detour', route_mode_full:'grid',
          avoid:['stress_obstacle_mid','stress_obstacle_detour_block','stress_obstacle_start_block'],
          stroke:'var(--lcars-african-violet)', width:12 },

        // Channel require hit (inside main bus bounds)
        { id:'stress_line_channel_hit', anchor:'stress_anchor_channel_hit', route_mode_full:'grid',
          route_channels:['stress_bus_main'], route_channel_mode:'require',
          avoid:['stress_obstacle_mid'], stroke:'var(--lcars-orange)', width:12 },

        // Channel miss (prefer): anchor at y 860; path vertical x=1500 outside channel x-range so miss recorded
        { id:'stress_line_channel_miss', anchor:'stress_anchor_channel_miss', route_mode_full:'grid',
          route_channels:['stress_bus_main'], route_channel_mode:'prefer',
          avoid:['stress_obstacle_vertical','stress_obstacle_mid'], stroke:'var(--lcars-purple)', width:12 },

        // Manhattan baseline
        { id:'stress_line_manhattan', anchor:'stress_anchor_manhattan', route_mode_full:'manhattan',
          stroke:'var(--lcars-teal)', width:8 }
      ];
      ctx.lineIds = lines.map(l=>l.id);

      lines.forEach(l=>{
        dev.api.overlays.add({
          id:l.id,type:'line',anchor:l.anchor,attach_to:targetId,route:'auto',
          route_mode_full:l.route_mode_full,
          route_channels:l.route_channels, route_channel_mode:l.route_channel_mode,
          avoid:l.avoid, smart_proximity:l.smart_proximity,
          stroke:l.stroke, width:l.width, corner_style:'round', corner_radius:40
        });
      });

      // Layout passes
      await sleep(140);
      dev.api.layout.relayout('*');
      await sleep(260);
      dev.api.layout.relayout('*');
      await sleep(260);
    },
    async expect(ctx){
      const sleep = ms => new Promise(r=>setTimeout(r,ms));
      const needPredicates = {
        grid_success: r => r['data-cblcars-route-grid-status']==='success',
        grid_fallback: r => r['data-cblcars-route-grid-status']==='fallback',
        smart_clear: r =>
          r['data-cblcars-route-effective']==='smart' &&
          r['data-cblcars-smart-hit']==='false' &&
          (r['data-cblcars-smart-skip-reason']==='clear_path' ||
           r['data-cblcars-route-grid-status']==='skipped'),
        smart_hit: r => r['data-cblcars-route-effective']==='smart' && r['data-cblcars-smart-hit']==='true',
        detour: r => r['data-cblcars-route-detour']==='true',
        channel_hit: r => !!r['data-cblcars-route-channels-hit'],
        channel_miss: r => r['data-cblcars-route-channels-miss']==='true',
        manhattan: r => r['data-cblcars-route-grid-status']==='manhattan'
      };

      // Retry loop: allow late geometry / async routing passes
      const MAX_TRIES = 6;
      for (let attempt=0; attempt<MAX_TRIES; attempt++){
        const rs = dev.api.layout.dumpRoutes(undefined,{silent:true});
        const missing = Object.keys(needPredicates)
          .filter(k => !rs.some(needPredicates[k]));
        if (!missing.length){
          return { ok:true, details:`All categories observed (attempt ${attempt+1})` };
        }
        // On final attempt break with details
        if (attempt === MAX_TRIES-1){
          // Collect brief per-route summary for debugging
            const summaries = rs.map(r=>{
              return `${r.id||'?'}::gs=${r['data-cblcars-route-grid-status']}|eff=${r['data-cblcars-route-effective']}|smartHit=${r['data-cblcars-smart-hit']}|detour=${r['data-cblcars-route-detour']||'false'}|chHit=${r['data-cblcars-route-channels-hit']||'none'}|chMiss=${r['data-cblcars-route-channels-miss']||'false'}`;
            }).slice(0,20).join(';');
          return { ok:false, details:`Missing: ${missing.join(', ')} | attempts=${MAX_TRIES} | routes=${summaries}` };
        }
        // Extra routing stabilization between attempts
        dev.api.layout.relayout('*');
        await sleep(220);
      }
    },
    async teardown(ctx){
      // NEW: optional debug hold
      if (window.cblcars?.dev?.flags?.keepStressScenario){
        console.info('[routing_stress_matrix] keepStressScenario flag set - skipping teardown (test artifacts retained)');
        return;
      }
      (ctx.lineIds||[]).forEach(id=>dev.api.overlays.remove(id));
      (ctx.overlayIds||[]).forEach(id=>dev.api.overlays.remove(id));
      (ctx.anchors||[]).forEach(id=>dev.api.anchors.remove(id));
      await sleep(120);
      dev.api.layout.relayout('*');
    }
  });

  console.info('[scenarios] routing_stress_matrix registered (attempts:',
    rootNS.__routingStressAttempts,')');
})();

// EXPORT TOKEN: prevents aggressive tree shaking from dropping this file
export const __routingStressScenarioToken = true;

// NOTE:
// - This scenario fabricates anchors/obstacles/connectors; it does NOT rely on YAML.
// - External user overlays/obstacles CAN influence outcomes (e.g. remove a fallback, block detour).
// - Set window.cblcars.dev.flags.keepStressScenario = true before running to skip teardown
//   and inspect the generated connector SVG paths manually.
