/**
 * CB-LCARS Dev HUD Split Loader (Deferred + Webpack Friendly)
 *
 * Changes (deferred version):
 *  - Load dev tools immediately (so developer helpers are available early)
 *  - Defer HUD (core + panels) until cb-lcars-msd-card is defined
 *    OR a fallback timeout fires (8s) – whichever comes first.
 *  - Prevents early warmup / snapshot churn before the MSD card infra exists.
 *
 * If ?lcarsDev is not present (and no CBLCARS_DEV_FORCE), this file is a no-op.
 */

(function(){
  const params = new URLSearchParams(location.search);
  const active = !window.CBLCARS_DEV_DISABLE &&
    (params.has('lcarsDev') || window.CBLCARS_DEV_FORCE === true);
  if(!active) return;

  if (window.cblcars?.hud?.__coreAttached) {
    console.info('[hud.loader] HUD already attached – abort secondary load.');
    return;
  }

  const log = (...a)=>console.info('[hud.loader]',...a);
  const warn = (...a)=>console.warn('[hud.loader]',...a);

  // Static import maps (Webpack sees literal paths)
  const DEV_TOOLS_LOADER = () =>
    import(/* webpackMode:"eager" */ './cb-lcars-dev-tools.js');

  const CORE_CHAIN = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-utils.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-tooltip.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-core.js')
  ];

  const PANELS = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-summary.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-issues.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-routing.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-channels.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-overlays.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-anchors.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-perf.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-scenarios.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-flags.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-actions.js')
  ];

  const OPTIONAL = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-dev-hud.js')
  ];

  async function runSeq(arr,label){
    for(const fn of arr){
      try { await fn(); }
      catch(e){
        warn(label,'module failed', e);
        if(label==='core') return false;
      }
    }
    return true;
  }

  async function runAll(){
    log('Starting modular HUD load (deferred)…');

    // 1. Dev tools first (early console helpers)
    try { await DEV_TOOLS_LOADER(); }
    catch(e){ warn('Dev tools failed (continuing without advanced helpers)', e); }

    // 2. Wait for MSD card definition or fallback
    const MAX_WAIT_MS = 8000;
    const start = performance.now();
    let resolvedWait = false;
    const waitPromise = new Promise(resolve=>{
      const done = (reason)=>{
        if(resolvedWait) return;
        resolvedWait = true;
        log('Proceeding with HUD load – reason:', reason);
        resolve();
      };
      if(customElements.get('cb-lcars-msd-card')) return done('already-defined');
      customElements.whenDefined('cb-lcars-msd-card').then(()=>done('whenDefined'));
      setTimeout(()=>done('timeout'), MAX_WAIT_MS);
    });
    await waitPromise;
    log('Wait elapsed =', (performance.now()-start).toFixed(0)+'ms');

    // 3. HUD core
    const coreOk = await runSeq(CORE_CHAIN,'core');
    if(!coreOk){
      warn('Core chain aborted – HUD unavailable.');
      return;
    }

    // 4. Panels in parallel, but wait so badges appear
    await Promise.all(PANELS.map(fn=>fn().catch(e=>warn('panel failed',e))));

    // 5. Optional tail
    await runSeq(OPTIONAL,'optional');

    if(window.cblcars?.hud?.api){
      log('HUD attached (version:', window.cblcars.hud.api.currentBuildVersion?.(), ')');
    } else if(window.cblcars?.hud?.__coreAttached){
      log('HUD core attached (panels may have partial errors)');
    } else {
      warn('HUD did not attach – check earlier console errors.');
    }
  }

  // Defer the heavy work off the main synchronous card init turn:
  // Use requestIdle if available, else setTimeout 0
  if('requestIdleCallback' in window){
    requestIdleCallback(()=>runAll());
  } else {
    setTimeout(()=>runAll(),0);
  }
})();