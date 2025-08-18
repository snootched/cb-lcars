/* LCARS Dev HUD Utils
 *  - Generic helpers shared by core + panels (formatting, diff, event bus shim)
 *  - NO side‑effects besides attaching window.cblcars.hud.utils
 *
 * Forward‑looking notes (future graphical editor):
 *  - Keep pure / stateless so editor can import in isolation (e.g. to build
 *    preview of snapshots or to diff baseline vs edited config).
 */
(function(){
  if (!window.cblcars) window.cblcars = {};
  window.cblcars.hud = window.cblcars.hud || {};

  const utils = window.cblcars.hud.utils = window.cblcars.hud.utils || {};

  /* ---------- Number / formatting ---------- */
  function fmtNum(n){
    if(n==null || !Number.isFinite(n)) return '';
    if(Math.abs(n)>=1000) return n.toFixed(0);
    if(Math.abs(n)>=10) return n.toFixed(1);
    return n.toFixed(2);
  }

  function pctDelta(prev,cur){
    if(prev==null || cur==null || prev===0) return null;
    return ((cur-prev)/prev)*100;
  }

  /* ---------- Generic shallow equality ---------- */
  function shallowEqual(a,b){
    if(a===b) return true;
    if(!a || !b) return false;
    const ka=Object.keys(a), kb=Object.keys(b);
    if(ka.length!==kb.length) return false;
    for(const k of ka) if(a[k]!==b[k]) return false;
    return true;
  }

  /* ---------- Snapshot diff (routes totalCost only) ---------- */
  function diffRouteCosts(oldSnap,newSnap){
    const out=[];
    if(!oldSnap||!newSnap) return out;
    const a=oldSnap.routesById||{}, b=newSnap.routesById||{};
    const seen=new Set([...Object.keys(a),...Object.keys(b)]);
    for(const id of seen){
      if(!a[id] || !b[id]) continue;
      const pa=a[id].totalCost, pb=b[id].totalCost;
      if(pa!=null && pb!=null && pa!==pb){
        const pct=pctDelta(pa,pb);
        out.push({id,prev:pa,cur:pb,pct});
      }
    }
    out.sort((x,y)=>Math.abs(y.pct)-Math.abs(x.pct));
    return out;
  }

  /* ---------- Light event bus (panels can depend even before core fully ready) ---------- */
  const pendingEvents=[];
  function makeEventBus(target){
    const handlers=new Map();
    target.on=(ev,fn)=>{
      if(!handlers.has(ev)) handlers.set(ev,new Set());
      handlers.get(ev).add(fn);
    };
    target.off=(ev,fn)=>handlers.get(ev)?.delete(fn);
    target.emit=(ev,payload)=>{
      if(!target._busReady){
        pendingEvents.push([ev,payload]);
        return;
      }
      const set=handlers.get(ev);
      if(set) for(const fn of set){try{fn(payload);}catch(e){console.warn('[hud.bus]',ev,e);}}
    };
    target._flushBus=()=>{
      target._busReady=true;
      pendingEvents.splice(0).forEach(([ev,p])=>target.emit(ev,p));
    };
  }

  /* ---------- Misc ---------- */
  function escHtml(str){
    return String(str).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }

  utils.fmtNum=fmtNum;
  utils.diffRouteCosts=diffRouteCosts;
  utils.shallowEqual=shallowEqual;
  utils.makeEventBus=makeEventBus;
  utils.escHtml=escHtml;

})();