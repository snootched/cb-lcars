/**
 * HUD Loader (Pass 4 patched: adds health & channel trend providers/panels)
 */
(function(){
  const params=new URLSearchParams(location.search);
  const active=!window.CBLCARS_DEV_DISABLE && (params.has('lcarsDev')||window.CBLCARS_DEV_FORCE===true);
  if(!active) return;
  if(window.cblcars?.hud?.__coreAttachedV4 || window.cblcars?.hud?.__coreAttached){
    console.info('[hud.loader] HUD already attached – abort secondary load.');
    return;
  }

  const log=(...a)=>console.info('[hud.loader]',...a);
  const warn=(...a)=>console.warn('[hud.loader]',...a);

  const DEV_TOOLS = () => import(/* webpackMode:"eager" */ './cb-lcars-dev-tools.js');

  const CORE_CHAIN = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-schema.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-providers-core.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-providers-health.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-providers-channel-trend.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-utils.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-tooltip.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-core.js')
  ];

  const FEATURE_CHAIN = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-overlay-schema.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-overlay-editor.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-routing-log-provider.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-diff.js')
  ];

  const PANELS = [
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-summary.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-issues.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-routing.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-channels.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-channel-trend.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-overlays.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-anchors.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-perf.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-scenarios.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-flags.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-actions.js'),
    () => import(/* webpackMode:"eager" */ './cb-lcars-hud-panels-providers.js')
  ];

  async function runSeq(list,label){
    for(const fn of list){
      try{ await fn(); }catch(e){
        warn(label,'module failed',e);
        if(label==='core') return false;
      }
    }
    return true;
  }

  async function runAll(){
    log('Starting modular HUD load…');
    try{ await DEV_TOOLS(); }catch(e){ warn('Dev tools load failed',e); }
    const MAX_WAIT_MS=8000;
    let resolved=false;
    await new Promise(resolve=>{
      const done=reason=>{
        if(resolved) return; resolved=true; log('Proceeding with HUD load – reason:',reason); resolve();
      };
      if(customElements.get('cb-lcars-msd-card')) return done('already-defined');
      customElements.whenDefined('cb-lcars-msd-card').then(()=>done('whenDefined'));
      setTimeout(()=>done('timeout'),MAX_WAIT_MS);
    });

    if(!await runSeq(CORE_CHAIN,'core')){
      warn('Core load aborted.');
      return;
    }
    await runSeq(FEATURE_CHAIN,'features');
    await Promise.all(PANELS.map(p=>p().catch(e=>warn('panel failed',e))));

    if(window.cblcars?.hud?.api){
      log('HUD attached (version:', window.cblcars.hud.api.currentBuildVersion?.(), ')');
    }else{
      warn('HUD did not attach – check earlier console errors.');
    }
  }

  if('requestIdleCallback' in window) requestIdleCallback(()=>runAll());
  else setTimeout(()=>runAll(),0);
})();