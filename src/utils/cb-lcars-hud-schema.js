/* Snapshot v4 Schema & Section Provider Registry
 *  - Central definition of snapshot structure
 *  - Providers can be registered before HUD core attaches (queued)
 *  - buildSnapshot() invoked by HUD core will iterate deterministic provider order
 *
 *  sections.<id> contract (initial set):
 *    routes:   { summary, byId, raw }
 *    perf:     { timers, counters, thresholds, violations }
 *    overlays: { list, summary, validation }
 *    anchors:  { list }
 *    channels: { current, previous }
 *    scenarios:{ results }
 *    config:   { flags, pinnedPerf, watchRoutes, routingFilters, selectedProfile }
 *    diff:     { routes:{ cost:[] } }    (secondary provider runs after routes)
 *
 * Backward compatibility shim (optional) produced by HUD core:
 *  - routesSummary -> sections.routes.summary
 *  - routesById    -> sections.routes.byId
 *  - perfTimers    -> sections.perf.timers
 *  - perfCounters  -> sections.perf.counters
 *  - overlaysBasic -> sections.overlays.list (list stripped)
 *  - overlaysSummary -> sections.overlays.summary
 *  - anchors -> sections.anchors.list
 *  - anchorsSummary -> sections.anchors.summary (computed)
 *  - channels -> sections.channels.current
 *  - previous.channels -> sections.channels.previous
 *  - scenarioResults -> sections.scenarios.results
 *  - flags -> sections.config.flags
 */
(function(){
  if(!window.cblcars) window.cblcars = {};
  window.cblcars.hud = window.cblcars.hud || {};

  const REG = {
    providers: new Map(),               // id -> fn(ctxPrev, lastFullSnapshot) => sectionData
    order: [],                          // deterministic order list of ids
    pending: []                         // queued registrations before core
  };

  function registerSectionProvider(id, buildFn, opts={}){
    if(!id || typeof buildFn!=='function') return;
    if(window.cblcars.hud.__providersFrozen){
      console.warn('[hud.schema] Provider registration after freeze ignored', id);
      return;
    }
    if(REG.providers.has(id)){
      console.warn('[hud.schema] Duplicate provider id ignored',id);
      return;
    }
    REG.providers.set(id, { id, buildFn, order: opts.order ?? 1000 });
    REG.order = [...REG.providers.values()].sort((a,b)=>a.order-b.order).map(p=>p.id);
  }

  // Public API (exposed early)
  window.cblcars.hud.registerSectionProvider = registerSectionProvider;
  window.cblcars.hud._listSectionProviders = () => REG.order.slice();

  // Core build function (called by hud-core)
  function buildSnapshotV4(ctx){
    // ctx: { now, prevSnapshot, env:{ dev, hudVersion, perfThresholds, pinnedPerf, watchRoutes,
    //       routingFilters, selectedProfile, flags } }
    const { prevSnapshot } = ctx;
    const sections = {};
    for(const id of REG.order){
      try{
        const provider = REG.providers.get(id);
        if(!provider) continue;
        sections[id] = provider.buildFn({
          prev: prevSnapshot?.sections?.[id],
          fullPrev: prevSnapshot,
          env: ctx.env,
          now: ctx.now
        }) || null;
      }catch(e){
        console.warn('[hud.schema] provider failed', id, e);
        sections[id] = { error:true, message:String(e) };
      }
    }
    return {
      meta:{
        schema:4,
        timestamp:ctx.now,
        iso:new Date(ctx.now).toISOString(),
        buildMs:0,
        hudVersion:ctx.env.hudVersion,
        interval:ctx.env.interval,
        paused:ctx.env.paused,
        capabilities:Object.keys(sections)
      },
      sections
    };
  }

  window.cblcars.hud._buildSnapshotV4 = buildSnapshotV4;

})();