/**
 * Health / Provider Metrics Section
 * Depends on registerSectionProvider timing instrumentation (hud-schema patched).
 *
 * Exposes:
 *  sections.health = {
 *    providers: [{
 *        id,
 *        lastMs,
 *        avgMs,
 *        maxMs,
 *        builds,
 *        error,      // boolean
 *        lastError,  // message (if any)
 *        changed     // boolean (provider returned deep-changed value vs previous build)
 *    }],
 *    snapshotSeq: n
 *  }
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  const hud = window.cblcars.hud = window.cblcars.hud || {};

  function register(){
    if(!hud.registerSectionProvider){
      (hud._pendingProviders=hud._pendingProviders||[]).push(register);
      return;
    }
    hud.registerSectionProvider('health', ({prev, fullPrev})=>{
      const stats = window.cblcars.hud._providerStats || {};
      const out = Object.keys(stats).map(id=>{
        const s = stats[id];
        return {
          id,
            lastMs: s.lastMs||0,
          avgMs: s.builds ? (s.totalMs / s.builds) : 0,
          maxMs: s.maxMs||0,
          builds: s.builds||0,
          error: !!s.lastError,
          lastError: s.lastError||'',
          changed: !!s.lastChanged
        };
      }).sort((a,b)=>b.lastMs - a.lastMs);
      return {
        providers: out,
        snapshotSeq: (fullPrev?.sections?.health?.snapshotSeq||0)+1
      };
    }, { order: 170 }); // after config (160) before diff (900)
  }
  register();
})();