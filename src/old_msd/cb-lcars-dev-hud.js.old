/* Aggregator / Loader
 * Usage (Home Assistant resources order):
 *   - Include utils, tooltip, core, then all panel files (any order after core).
 * OR simply include this file AFTER all split files and it will:
 *   - Ensure core attached (core self-attaches when dev tools ready)
 *   - Expose window.cblcars.hud.api when ready
 *
 * If you load this file FIRST, it does nothing harmful (core has its own bootstrap).
 *
 * Future: Could dynamically lazy-load panels based on user config.
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  window.cblcars.hud = window.cblcars.hud || {};
  // No-op: all logic lives in individual modules.
  // Provide a small helper to print status.
  window.cblcars.hud.printStatus = function(){
    if(window.cblcars.hud.api) console.info('[hud] status', window.cblcars.hud.api.status());
    else console.info('[hud] API not ready yet.');
  };
})();