/* HUD Utils (extended for v4)
 *  - Formatting
 *  - Route cost diff
 *  - Safe access helpers
 *  - HTML escape
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  window.cblcars.hud = window.cblcars.hud || {};
  const utils = window.cblcars.hud.utils = window.cblcars.hud.utils || {};

  function fmtNum(n){
    if(n==null || !Number.isFinite(n)) return '';
    if(Math.abs(n)>=1000) return n.toFixed(0);
    if(Math.abs(n)>=10) return n.toFixed(1);
    return n.toFixed(2);
  }
  function pctDelta(prev,cur){
    if(prev==null||cur==null||prev===0) return null;
    return ((cur-prev)/prev)*100;
  }
  function diffRouteCosts(oldSnap,newSnap){
    const out=[];
    if(!oldSnap||!newSnap) return out;
    const a=(oldSnap.sections?.routes?.byId)||(oldSnap.routesById)||{};
    const b=(newSnap.sections?.routes?.byId)||(newSnap.routesById)||{};
    const ids=new Set([...Object.keys(a),...Object.keys(b)]);
    ids.forEach(id=>{
      if(!a[id]||!b[id]) return;
      const p=a[id].totalCost, c=b[id].totalCost;
      if(p!=null && c!=null && p!==c){
        const pct=pctDelta(p,c);
        out.push({id,prev:p,cur:c,pct});
      }
    });
    out.sort((x,y)=>Math.abs(y.pct)-Math.abs(x.pct));
    return out;
  }
  function escHtml(str){
    return String(str).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }
  function shallowEqual(a,b){
    if(a===b) return true;
    if(!a||!b) return false;
    const ka=Object.keys(a), kb=Object.keys(b);
    if(ka.length!==kb.length) return false;
    for(const k of ka) if(a[k]!==b[k]) return false;
    return true;
  }
  utils.fmtNum=fmtNum;
  utils.diffRouteCosts=diffRouteCosts;
  utils.escHtml=escHtml;
  utils.shallowEqual=shallowEqual;
})();