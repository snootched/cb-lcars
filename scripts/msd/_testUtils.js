export function installWindowStub(){
  if (global.window) return;
  global.window = {
    __msdDebug: {
      hud: { publishIssue: (i)=> { (global.__issues ||= []).push(i); } }
    }
  };
}
export function getIssues(){ return global.__issues || []; }
export function assert(cond, msg){
  if (!cond){
    console.error('[ASSERT FAIL]', msg);
    process.exit(1);
  }
}
export function pass(msg){
  console.log('[PASS]', msg);
}
export function summarize(name){
  console.log(`[${name}] OK`);
}
export function hash(str){
  // simple non-crypto hash (for deterministic comparisons in tests)
  let h = 0, i=0, l=str.length;
  while(i<l){ h = (h*31 + str.charCodeAt(i++)) >>> 0; }
  return ('00000000'+h.toString(16)).slice(-8);
}
export function snapshot(obj, stableStringify){
  return hash(stableStringify(obj));
}
