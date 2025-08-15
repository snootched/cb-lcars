/* PHASE A (Auto Router) + prior phases (P2/P3/P4 + Phase C) +
   Adds:
   - route:auto for line connectors
   - Avoid list + route_mode (xy|yx|auto)
   - Perf counters: connectors.route.recomputed / connectors.route.skipped
   - Hash includes route signature & obstacle bbox footprints
   - Optional bridging call at end of render to auto refresh debug layer when perf or overlay flags set
*/

import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { resolveOverlayStyles, splitAttrsAndStyle, resolveAllDynamicValues, resolveStatePreset } from './cb-lcars-style-helpers.js';
import { cblcarsLog } from './cb-lcars-logging.js';
import { sliceWindow, computeYRange, mapToRect, pathFromPoints, areaPathFromPoints, mapToRectIndex } from './cb-lcars-sparkline-helpers.js';
import { resolveSize } from './cb-lcars-size-helpers.js';
import { parseTimeWindowMs } from './cb-lcars-time-utils.js';
import * as geo from './cb-lcars-geometry-utils.js';
import { validateOverlays } from './cb-lcars-validation.js';
import * as scheduler from './cb-lcars-scheduler.js';

/* ---------------- Connector diff infra ---------------- */
const CONNECTOR_CACHE_VERSION = 2; // bump for route:auto
const connectorMetaMap = new WeakMap();
function getDirtySet() {
  window.cblcars = window.cblcars || {};
  window.cblcars.connectors = window.cblcars.connectors || {};
  window.cblcars.connectors._dirty = window.cblcars.connectors._dirty || new Set();
  return window.cblcars.connectors._dirty;
}
function quickHash(str){let h=0,i=0,l=str.length;while(i<l){h=(h<<5)-h+str.charCodeAt(i++)|0;}return(h>>>0).toString(36);}
function buildConnectorHash(sig){return quickHash(JSON.stringify(sig));}
function roundBBoxValue(v){return Math.round(v*4)/4;}
function bboxHash(bb){if(!bb)return'none';return quickHash(`${roundBBoxValue(bb.x)},${roundBBoxValue(bb.y)},${roundBBoxValue(bb.w)},${roundBBoxValue(bb.h)}`);}

/* ---------------- Shared helpers ---------------- */
function resolveTargetBoxInViewBox(targetId, root, viewBox){
  if(!targetId || !root) return null;
  const el = root.getElementById?.(targetId);
  let primaryBox = null;

  function bboxFromEl(node) {
    if (!node) return null;
    const isSvgNode = !!node.namespaceURI && String(node.namespaceURI).includes('svg');
    if (isSvgNode && typeof node.getBBox === 'function') {
      try {
        const bb = node.getBBox();
        if (bb && (bb.width > 0 || bb.height > 0)) {
          return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
        }
        // Width/height zero => treat as invalid for our purposes
      } catch (_) {}
    }
    return null;
  }

  primaryBox = bboxFromEl(el);

  // Ribbon: fallback to backdrop rect if group empty
  if (!primaryBox) {
    const backdrop = root.getElementById?.(`${targetId}_backdrop`);
    primaryBox = bboxFromEl(backdrop);
  }

  // Config fallback (position + size) if still no bbox
  if (!primaryBox) {
    try {
      const cfg = root.__cblcars_overlayConfigsById?.[targetId];
      if (cfg && cfg.position && cfg.size) {
        const anchors = root.__cblcars_anchors || {};
        const vb = viewBox || geo.getViewBox(root, geo.getReferenceSvg(root)) || [0,0,100,100];
        const pos = (function resolvePos(p){
          if (typeof p === 'string' && anchors[p]) return anchors[p];
          if (Array.isArray(p) && p.length === 2) {
            const [minX,minY,vw,vh] = vb;
            const conv = (v, axis) =>
              typeof v === 'string' && v.endsWith('%')
                ? (axis==='x' ? minX + (parseFloat(v)/100)*vw : minY + (parseFloat(v)/100)*vh)
                : Number(v);
            const x = conv(p[0],'x'), y = conv(p[1],'y');
            if (Number.isFinite(x) && Number.isFinite(y)) return [x,y];
          }
          return null;
        })(cfg.position);
        const sz = (function resolveSz(s){
          if (Array.isArray(s) && s.length === 2) {
            const [, , vw, vh] = vb;
            const conv = (v, max) =>
              typeof v === 'string' && v.endsWith('%') ? (parseFloat(v)/100)*max : Number(v);
            const w = conv(s[0], vw);
            const h = conv(s[1], vh);
            if (Number.isFinite(w) && Number.isFinite(h)) return { w, h };
          }
          return null;
        })(cfg.size);
        if (pos && sz) {
          primaryBox = { x: pos[0], y: pos[1], w: sz.w, h: sz.h };
        }
      }
    } catch (_) {}
  }

  if (primaryBox) return primaryBox;

  // Final pixel-space fallback (original logic)
  const svg = geo.getReferenceSvg(root);
  const pxRect = el?.getBoundingClientRect?.();
  if (svg && pxRect && pxRect.width>0 && pxRect.height>0) {
    const vbRect = geo.screenRectToViewBox(svg, pxRect);
    if (vbRect) return vbRect;
  }

  return null;
}
function endpointOnBox(anchor, box, {side='auto',align='center',gap=12}={}){
  const cx=box.x+box.w/2, cy=box.y+box.h/2;
  let pick=side;
  if(pick==='auto'){
    const dx=anchor[0]-cx, dy=anchor[1]-cy;
    pick=Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'top':'bottom');
  }
  const alignStr=String(align||'center').toLowerCase().trim();
  let t=0.5;
  if(alignStr==='start') t=0;
  else if(alignStr==='end') t=1;
  else if(alignStr==='toward-anchor'){
    if(pick==='left'||pick==='right') t=Math.max(0,Math.min(1,(anchor[1]-box.y)/(box.h||1)));
    else t=Math.max(0,Math.min(1,(anchor[0]-box.x)/(box.w||1)));
  } else if(alignStr.startsWith('percent:')){
    const raw=Number(alignStr.split(':')[1]); t=Math.max(0,Math.min(1,Number.isFinite(raw)?raw:0.5));
  }
  let x,y;
  if(pick==='left'){x=box.x-gap;y=box.y+t*box.h;}
  else if(pick==='right'){x=box.x+box.w+gap;y=box.y+t*box.h;}
  else if(pick==='top'){y=box.y-gap;x=box.x+t*box.w;}
  else {y=box.y+box.h+gap;x=box.x+t*box.w;}
  return [x,y,pick];
}
function generateRightAnglePath(start,end,{radius=12,cornerStyle='round'}={}){
  const [x0,y0]=start,[x2,y2]=end,[x1,y1]=[x2,y0];
  if((x0===x1&&x1===x2)||(y0===y1&&y1===y2)||cornerStyle==='sharp'||cornerStyle==='square')
    return`M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
  const dx1=x1-x0, dy2=y2-y1;
  const r=Math.min(radius,Math.abs(dx1)/2,Math.abs(dy2)/2);
  const p1=[x1-r*Math.sign(dx1),y1];
  const p2=[x1,y1+r*Math.sign(dy2)];
  if(cornerStyle==='bevel'||cornerStyle==='miter')
    return`M${x0},${y0} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${x2},${y2}`;
  const sweep=(dx1>0)===(dy2>0)?1:0;
  return`M${x0},${y0} L${p1[0]},${p1[1]} A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]} L${x2},${y2}`;
}

/* ---------------- Auto Route Helper ---------------- */
/**
 * Compute an auto-routed connector path (simple Manhattan with optional obstacle avoidance).
 * @param {number} sx
 * @param {number} sy
 * @param {{x:number,y:number,w:number,h:number}} targetBox
 * @param {[number,number,'left'|'right'|'top'|'bottom']} endpointTriplet [ex, ey, side]
 * @param {object} opts { radius, cornerStyle, routeMode, obstacles: Array<{x,y,w,h}>, margin }
 * @returns {{d:string, signature:any}}
 */
function computeAutoRoute(sx, sy, targetBox, endpointTriplet, opts={}) {
  const { radius=12, cornerStyle='round', routeMode='auto', obstacles=[], margin=2 } = opts;
  const ex = endpointTriplet[0];
  const ey = endpointTriplet[1];

  // Two candidate elbow points
  const candXY = [ex, sy]; // horizontal then vertical
  const candYX = [sx, ey]; // vertical then horizontal

  const segBoxes = (start, elbow, end) => {
    // Represent segments as bounding boxes with a small thickness (so intersection test is easy).
    const thick = 0.0001;
    const a = {
      x: Math.min(start[0], elbow[0]) - thick,
      y: Math.min(start[1], elbow[1]) - thick,
      w: Math.abs(start[0] - elbow[0]) + thick*2,
      h: Math.abs(start[1] - elbow[1]) + thick*2
    };
    const b = {
      x: Math.min(elbow[0], end[0]) - thick,
      y: Math.min(elbow[1], end[1]) - thick,
      w: Math.abs(elbow[0] - end[0]) + thick*2,
      h: Math.abs(elbow[1] - end[1]) + thick*2
    };
    return [a,b];
  };
  const inflate = (bb, m) => ({ x: bb.x - m, y: bb.y - m, w: bb.w + m*2, h: bb.h + m*2 });
  const intersects = (a,b) => !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);

  const obstacleSet = obstacles.map(o => inflate(o, margin));

  function candidateValid(elbow) {
    const segs = segBoxes([sx,sy], elbow, [ex,ey]);
    return segs.every(sb => obstacleSet.every(ob => !intersects(sb, ob)));
  }

  const dist = (elbow) => Math.abs(sx - elbow[0]) + Math.abs(sy - elbow[1]) + Math.abs(elbow[0] - ex) + Math.abs(elbow[1] - ey);

  let chosen = null;
  let chosenMode = null;
  const wantXY = routeMode === 'xy' || routeMode === 'auto';
  const wantYX = routeMode === 'yx' || routeMode === 'auto';

  const validXY = wantXY && candidateValid(candXY);
  const validYX = wantYX && candidateValid(candYX);

  if (validXY && !validYX) { chosen = candXY; chosenMode='xy'; }
  else if (!validXY && validYX) { chosen = candYX; chosenMode='yx'; }
  else if (validXY && validYX) {
    chosen = dist(candXY) <= dist(candYX) ? candXY : candYX;
    chosenMode = (chosen === candXY) ? 'xy' : 'yx';
  }

  // Fallback: if both invalid, choose shorter ignoring obstacles
  if (!chosen) {
    if (wantXY && wantYX) {
      chosen = dist(candXY) <= dist(candYX) ? candXY : candYX;
      chosenMode = (chosen === candXY) ? 'xy' : 'yx';
    } else if (wantXY) { chosen = candXY; chosenMode='xy'; }
    else if (wantYX) { chosen = candYX; chosenMode='yx'; }
  }

  if (!chosen) {
    // Absolute fallback to direct right-angle
    return {
      d: generateRightAnglePath([sx,sy],[ex,ey],{radius,cornerStyle}),
      signature: { fallback:true }
    };
  }

  // Build multi-segment path with elbow smoothing similar to generateRightAnglePath logic but two segments.
  const points = [[sx,sy], chosen, [ex,ey]];
  // If corner style round/bevel/square apply at elbow
  let d = `M${sx},${sy}`;
  const [p0,p1,p2] = points;
  const dx1 = p1[0]-p0[0], dy1=p1[1]-p0[1], dx2=p2[0]-p1[0], dy2=p2[1]-p1[1];
  const useCorner = !(cornerStyle==='sharp'||cornerStyle==='square');
  const r = Math.min(radius, Math.abs(dx1||dy1)/2, Math.abs(dx2||dy2)/2);
  if (useCorner && r>0) {
    const pre = [p1[0]-Math.sign(dx1)*r, p1[1]-Math.sign(dy1)*r];
    const post= [p1[0]+Math.sign(dx2)*r, p1[1]+Math.sign(dy2)*r];
    d += ` L${pre[0]},${pre[1]}`;
    if (cornerStyle==='round'){
      const sweep = ((dx1>0&&dy2>0)||(dx1<0&&dy2<0)||(dy1>0&&dx2<0)||(dy1<0&&dx2>0))?1:0;
      d += ` A${r},${r} 0 0 ${sweep} ${post[0]},${post[1]}`;
    } else {
      d += ` L${post[0]},${post[1]}`;
    }
    d += ` L${p2[0]},${p2[1]}`;
  } else {
    d += ` L${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
  }

  return {
    d,
    signature: {
      sx,sy,ex,ey,
      elbow: chosen,
      mode: chosenMode,
      obstacles: obstacleSet.length,
      radius,cornerStyle
    }
  };
}

/* ---------------- Sparkline helpers (unchanged from previous phase) ---------------- */
function sanitizePoints(points){
  if(!Array.isArray(points)) return [];
  const out=[]; let lastX,lastY,have=false;
  for(const p of points){
    if(!p||p.length<2) continue;
    const x=Number(p[0]),y=Number(p[1]);
    if(!Number.isFinite(x)||!Number.isFinite(y)) continue;
    if(have&&x===lastX&&y===lastY) continue;
    out.push([x,y]); lastX=x; lastY=y; have=true;
  }
  return out;
}
function generateSmoothPath(pts,{tension=0.5}={}){
  let points=sanitizePoints(pts);
  if(points.length<2){try{return pathFromPoints(points);}catch{return'';}}
  const k=Math.max(0,Math.min(1,Number(tension)));
  const handle=(1-k)*0.5;
  let d=`M${points[0][0]},${points[0][1]}`;
  for(let i=0;i<points.length-1;i++){
    const p0=points[i-1]||points[i];
    const p1=points[i];
    const p2=points[i+1]||p1;
    const p3=points[i+2]||p2;
    const c1x=p1[0]+(p2[0]-p0[0])*handle;
    const c1y=p1[1]-(p0[1]-p2[1])*handle;
    const c2x=p2[0]-(p3[0]-p1[0])*handle;
    const c2y=p2[1]-(p1[1]-p3[1])*handle;
    if([c1x,c1y,c2x,c2y,p2[0],p2[1]].some(v=>!Number.isFinite(v))) d+=` L${p2[0]},${p2[1]}`;
    else d+=` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function generateMonotonePath(pts){
  const points=sanitizePoints(pts); const n=points.length;
  if(n<2) return pathFromPoints(points);
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const m=[]; const t=new Array(n);
  for(let i=0;i<n-1;i++) m[i]=(ys[i+1]-ys[i])/((xs[i+1]-xs[i])||1e-9);
  t[0]=m[0]; t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++) t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
  for(let i=0;i<n-1;i++){
    const a=t[i]/m[i], b=t[i+1]/m[i], s=a*a+b*b;
    if(s>9){
      const tau=3/Math.sqrt(s);
      t[i]=tau*a*m[i]; t[i+1]=tau*b*m[i];
    }
  }
  let d=`M${xs[0]},${ys[0]}`;
  for(let i=0;i<n-1;i++){
    const x0=xs[i], y0=ys[i], x1=xs[i+1], y1=ys[i+1], h=x1-x0||1e-9;
    d+=` C${x0+h/3},${y0+(t[i]*h)/3} ${x1-h/3},${y1-(t[i+1]*h)/3} ${x1},${y1}`;
  }
  return d;
}
function resolvePoint(point,{anchors,viewBox}){
  anchors=anchors||{};
  if(!point) return null;
  if(typeof point==='string'&&anchors&&anchors[point]) return anchors[point];
  if(Array.isArray(point)&&point.length===2){
    const [minX,minY,width,height]=viewBox;
    const rc=(val,axis)=>
      (typeof val==='string'&&val.endsWith('%'))
        ? (axis==='x'?minX+(parseFloat(val)/100)*width:minY+(parseFloat(val)/100)*height)
        : parseFloat(val);
    const x=rc(point[0],'x'), y=rc(point[1],'y');
    if(!isNaN(x)&&!isNaN(y)) return [x,y];
  }
  return null;
}
function generateWaypointsFromSteps(anchor,steps,context){
  let pos=resolvePoint(anchor,context);
  if(!pos) return [];
  const points=[pos.slice()];
  for(const step of steps){
    if(step.direction==='horizontal'&&step.to_x!==undefined) pos=[parseFloat(step.to_x),pos[1]];
    else if(step.direction==='vertical'&&step.to_y!==undefined) pos=[pos[0],parseFloat(step.to_y)];
    points.push(pos.slice());
  }
  return points;
}
function generateMultiSegmentPath(points,{cornerStyle='round',cornerRadius=12}={}){
  if(points.length<2) return '';
  let d=`M${points[0][0]},${points[0][1]}`;
  for(let i=1;i<points.length-1;i++){
    const [x0,y0]=points[i-1],[x1,y1]=points[i],[x2,y2]=points[i+1];
    const isRA=(x0===x1&&y1===y2)||(y0===y1&&x1===x2);
    if(!isRA||cornerStyle==='sharp'||cornerStyle==='square'){d+=` L${x1},${y1}`;continue;}
    const dx1=x1-x0, dy1=y1-y0, dx2=x2-x1, dy2=y2-y1;
    const r=Math.min(cornerRadius,Math.abs(dx1||dy1)/2,Math.abs(dx2||dy2)/2);
    const p1=[x1-Math.sign(dx1)*r,y1-Math.sign(dy1)*r];
    const p2=[x1+Math.sign(dx2)*r,y1+Math.sign(dy2)*r];
    d+=` L${p1[0]},${p1[1]}`;
    if(cornerStyle==='round'){
      const sweep=((dx1>0&&dy2>0)||(dx1<0&&dy2<0)||(dy1>0&&dx2<0)||(dy1<0&&dx2>0))?1:0;
      d+=` A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]}`;
    } else d+=` L${p2[0]},${p2[1]}`;
  }
  d+=` L${points[points.length-1][0]},${points[points.length-1][1]}`;
  return d;
}

/* ---------------- Error manager (unchanged) ---------------- */
class SvgOverlayErrorManager {
  constructor(){this.errors=[];this.containerId='cblcars-overlay-errors';this.viewBox=[0,0,400,200];this.root=null;}
  setRoot(r){this.root=r;}
  clear(){this.errors=[];this.render();}
  push(msg){if(!this.errors.includes(msg)){this.errors.push(msg);this.render();}}
  render(){
    const searchRoot=this.root||document;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{
      const c=searchRoot.querySelector(`#${this.containerId}`);
      if(!c)return;
      if(!this.errors.length){c.innerHTML='';return;}
      const [, , , vh]=this.viewBox;
      const fs=Math.max(8,Math.min(48,Math.round(vh*0.12)));
      c.innerHTML=`<text x="${this.viewBox[0]+10}" y="${this.viewBox[1]+fs}" fill="red" font-size="${fs}" font-family="monospace" opacity="0.8">
        ${this.errors.map((m,i)=>`<tspan x="${this.viewBox[0]+10}" dy="${i===0?0:'1.2em'}">${m}</tspan>`).join('')}
      </text>`;
    });});
  }
  setViewBox(vb){if(Array.isArray(vb)&&vb.length===4)this.viewBox=vb;}
}
export const svgOverlayManager = new SvgOverlayErrorManager();

/* ---------------- Template evaluation ---------------- */
function evaluateTemplate(template, context={}){
  if(typeof template!=='string'||!template.startsWith('[[[')) return template;
  try{
    const code=template.substring(3,template.length-3);
    const fn=new Function(...Object.keys(context),`return ${code}`);
    return fn(...Object.values(context));
  }catch(e){
    cblcarsLog.error('[evaluateTemplate] Error evaluating template:',{template,context,error:e});
    return 'TEMPLATE_ERROR';
  }
}

/* ---------------- Actions binding (unchanged) ---------------- */
export function bindOverlayActions(opts){
  const { root=document, id, actions={}, hass, entity } = opts||{};
  if(!id||!root) return;
  const el=root.querySelector?.(`#${id}`); if(!el) return;
  const key=JSON.stringify(actions);
  if(el.__cblcars_actions_key===key) return;
  if(el.__cblcars_unbind_actions){try{el.__cblcars_unbind_actions();}catch{}}
  try{
    el.style.pointerEvents='auto';
    const hasTap=actions.tap_action&&actions.tap_action.action&&actions.tap_action.action!=='none';
    el.style.cursor=hasTap?'pointer':(el.style.cursor||'auto');
  }catch{}
  const a={ tap:actions.tap_action||null, hold:actions.hold_action||null, dbl:actions.double_tap_action||null };
  const exec=async(act)=>{
    if(!act||!act.action||act.action==='none') return;
    const ent=act.entity||entity;
    const service=act.service||(act.service_domain&&act.service_name?`${act.service_domain}.${act.service_name}`:null);
    switch(act.action){
      case'more-info':
        if(!ent)return; el.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:ent}})); break;
      case'toggle':
        if(ent&&hass?.callService) await hass.callService('homeassistant','toggle',{entity_id:ent}); break;
      case'call-service':
        if(service&&hass?.callService){const[domain,name]=service.split('.');await hass.callService(domain,name,act.service_data||{});} break;
      case'navigate':{
        const path=act.navigation_path||act.path||'/';
        try{history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'));}catch{location.assign(path);}break;}
      case'url':{
        const url=act.url_path||act.url; if(!url)return;
        const tgt=act.new_tab===true?'_blank':(act.new_tab===false?'_self':'_blank');
        window.open(url,tgt,'noopener,noreferrer'); break;}
      default:break;
    }
  };
  const stopAll=(e,prevent=false)=>{try{e.stopImmediatePropagation();e.stopPropagation();}catch{} if(prevent)try{e.preventDefault();}catch{}};
  let holdTo=null, held=false;
  const holdMs=Math.max(300,Number(a.hold?.hold_time)||500);
  const onPointerDown=e=>{stopAll(e);held=false;if(!a.hold)return;clearTimeout(holdTo);holdTo=setTimeout(async()=>{held=true;await exec(a.hold);},holdMs);};
  const onPointerUp=e=>{stopAll(e);clearTimeout(holdTo);};
  const onClick=async e=>{stopAll(e);if(held){held=false;return;} await exec(a.tap);};
  const onDblClick=async e=>{stopAll(e);await exec(a.dbl);};
  const onContextMenu=e=>{stopAll(e,true);};
  const onTouchStart=e=>{stopAll(e);onPointerDown(e);};
  const onTouchEnd=e=>{stopAll(e);onPointerUp(e);};
  el.addEventListener('pointerdown',onPointerDown,{passive:false,capture:true});
  el.addEventListener('pointerup',onPointerUp,{passive:false,capture:true});
  el.addEventListener('click',onClick,{passive:false,capture:true});
  el.addEventListener('dblclick',onDblClick,{passive:false,capture:true});
  el.addEventListener('contextmenu',onContextMenu,{passive:false,capture:true});
  el.addEventListener('touchstart',onTouchStart,{passive:false,capture:true});
  el.addEventListener('touchend',onTouchEnd,{passive:false,capture:true});
  el.__cblcars_actions_key=key;
  el.__cblcars_unbind_actions=()=>{
    el.removeEventListener('pointerdown',onPointerDown,{capture:true});
    el.removeEventListener('pointerup',onPointerUp,{capture:true});
    el.removeEventListener('click',onClick,{capture:true});
    el.removeEventListener('dblclick',onDblClick,{capture:true});
    el.removeEventListener('contextmenu',onContextMenu,{capture:true});
    el.removeEventListener('touchstart',onTouchStart,{capture:true});
    el.removeEventListener('touchend',onTouchEnd,{capture:true});
  };
}

/* ---------------- Connector layout with diff + auto-route ---------------- */
export function layoutPendingConnectors(root, viewBox=[0,0,100,100]){
  const dbgPerf = window.cblcars?.debug?.perf;
  const dbgEnd = dbgPerf?.start ? dbgPerf.start('connectors.layout.timer') : null;
  const perf=window.cblcars?.perf;
  const endPerf=perf?.timeStart?perf.timeStart('connectors.layout.exec'):null;
  const paths=Array.from(root.querySelectorAll('path[data-cblcars-attach-to]'));
  if(!paths.length){endPerf&&endPerf();return;}
  const dirty=getDirtySet(); const forceAll=dirty.has('*');
  let recomputed=0, skipped=0, routeRecomputed=0, routeSkipped=0;
  const debug=!!(window.cblcars?._debugFlags?.connectors||root.__cblcars_debugFlags?.connectors);

  // Collect obstacle bboxes once (for route:auto) – only id-based overlays
  const obstacleMap = new Map();
  const obstacleEls = Array.from(root.querySelectorAll('[data-cblcars-root="true"]'));
  for (const el of obstacleEls) {
    if (!el.id) continue;
    try {
      if (typeof el.getBBox === 'function') {
        const bb = el.getBBox();
        obstacleMap.set(el.id, { x: bb.x, y: bb.y, w: bb.width, h: bb.height });
      }
    } catch(_) {}
  }

  for(const p of paths){
    perf?.count&&perf.count('connectors.layout.considered');
    const targetId=p.getAttribute('data-cblcars-attach-to');
    const sx=parseFloat(p.getAttribute('data-cblcars-start-x'));
    const sy=parseFloat(p.getAttribute('data-cblcars-start-y'));
    if(!targetId||!isFinite(sx)||!isFinite(sy)){skipped++;continue;}
    const side=(p.getAttribute('data-cblcars-side')||'auto').toLowerCase();
    const align=(p.getAttribute('data-cblcars-align')||'center').toLowerCase();
    let gapRaw=p.getAttribute('data-cblcars-gap')||'12';
    let gap=parseFloat(gapRaw);
    if(String(gapRaw).trim().endsWith('px')){
      const conv=geo.pxGapToViewBox(root,gap);
      if(Number.isFinite(conv)) gap=conv;
    }
    if(!isFinite(gap)) gap=12;
    const radius=Math.max(0,parseFloat(p.getAttribute('data-cblcars-radius'))||12);
    const cornerStyle=(p.getAttribute('data-cblcars-corner-style')||'round').toLowerCase();
    const routeModeAttr = p.getAttribute('data-cblcars-route') || ''; // '' or 'auto'
    const routeMode = routeModeAttr === 'auto' ? 'auto' : null;
    const forcedRouteMode = p.getAttribute('data-cblcars-route-mode'); // xy|yx|auto
    let avoidList = [];
    try {
      const rawAvoid = p.getAttribute('data-cblcars-avoid');
      if (rawAvoid) avoidList = rawAvoid.split(',').map(s=>s.trim()).filter(Boolean);
    } catch(_){}

    const box=resolveTargetBoxInViewBox(targetId,root,viewBox);
    if(!box){skipped++;continue;}

    // Build route signature base
    const obstaclesSignature = avoidList
      .map(id => {
        const ob = obstacleMap.get(id);
        return ob ? bboxHash(ob) : 'missing';
      });

    const cfgSig={
      id:p.id||null,targetId,
      sx:roundBBoxValue(sx),sy:roundBBoxValue(sy),
      side,align,gap:roundBBoxValue(gap),
      radius:roundBBoxValue(radius),
      style:cornerStyle,
      rmode: routeMode || 'none',
      rforced: forcedRouteMode || 'none',
      avoid: avoidList.join('|'),
      obs: obstaclesSignature.join(',')
    };
    const cfgHash=buildConnectorHash(cfgSig);
    const bbHash=bboxHash(box);
    const meta=connectorMetaMap.get(p);
    const isDirtyId=(!forceAll && p.id && dirty.has(p.id))||forceAll;
    const needs = isDirtyId || !meta || meta.version!==CONNECTOR_CACHE_VERSION || meta.hash!==cfgHash || meta.bboxHash!==bbHash;

    if(!needs){
      perf?.count&&perf.count('connectors.layout.skipped');
      skipped++;
      if(routeMode) {
        perf?.count&&perf.count('connectors.route.skipped');
        routeSkipped++;
      }
      continue;
    }

    try{
      const endpoint = endpointOnBox([sx,sy],box,{side,align,gap});
      let d;
      if (routeMode === 'auto') {
        const obstacles = avoidList.map(id => obstacleMap.get(id)).filter(Boolean);
        const { d: autoD } = computeAutoRoute(sx,sy,box,endpoint,{
          radius, cornerStyle,
            routeMode: forcedRouteMode || 'auto',
          obstacles
        });
        d = autoD;
        perf?.count&&perf.count('connectors.route.recomputed');
        routeRecomputed++;
      } else {
        d=generateRightAnglePath([sx,sy],[endpoint[0],endpoint[1]],{radius,cornerStyle});
      }
      p.setAttribute('d',d);
      connectorMetaMap.set(p,{hash:cfgHash,bboxHash:bbHash,version:CONNECTOR_CACHE_VERSION});
      perf?.count&&perf.count('connectors.layout.recomputed'); recomputed++;
    }catch(e){
      try{
        const endpoint = endpointOnBox([sx,sy],box,{side,align,gap});
        p.setAttribute('d',generateRightAnglePath([sx,sy],[endpoint[0],endpoint[1]],{radius,cornerStyle}));
      }catch(_) {}
      perf?.count&&perf.count('connectors.layout.recomputed'); recomputed++;
      if(debug) cblcarsLog.warn('[connectors] recompute failed fallback',{id:p.id,error:e});
    }
  }
  if(dirty.size) dirty.clear();
  perf?.count&&perf.count('connectors.layout');
  if(debug) cblcarsLog.info('[connectors] layout pass',{
    considered:paths.length,recomputed,skipped,
    routeRecomputed,routeSkipped
  });
  endPerf&&endPerf();
  if (dbgEnd) window.cblcars.debug.perf.end('connectors.layout.timer');
  // Auto-refresh debug layer if connectors flag active
  try {
    if (window.cblcars?._debugFlags &&
        (window.cblcars._debugFlags.connectors ||
         window.cblcars._debugFlags.overlay ||
         window.cblcars._debugFlags.perf ||
         window.cblcars._debugFlags.geometry)) {
      requestAnimationFrame(() => window.cblcars.debug.render(root, viewBox, { anchors: root.__cblcars_anchors }));
    }
  } catch (_) {}
}

/* ---------------- Main Renderer (only line section changed for route:auto) ---------------- */
export function renderMsdOverlay({
  overlays,
  anchors,
  styleLayers,
  hass,
  root=document,
  viewBox=[0,0,400,200],
  timelines={},
  animations=[],
  dataSources={}
}){
  const dbgPerf = window.cblcars?.debug?.perf;
  const dbgEnd = dbgPerf?.start ? dbgPerf.start('msd.render') : null;
  let svgElements=[]; let animationsToRun=[];
  const presets=styleLayers||{}; const defaultPreset=presets.default||{};
  if(!anchors||typeof anchors!=='object'){cblcarsLog.warn('[renderMsdOverlay] anchors invalid',anchors); anchors={};}
  if(!Array.isArray(overlays)){cblcarsLog.warn('[renderMsdOverlay] overlays is not array'); return {svgMarkup:'',animationsToRun:[]};}
  svgOverlayManager.setRoot(root); svgOverlayManager.clear(); svgOverlayManager.setViewBox(viewBox);
  try{
    const {errors,warnings,detailsById}=validateOverlays({overlays,anchors,viewBox});
    warnings?.forEach(w=>cblcarsLog.warn(`[validation] ${w}`));
    errors?.forEach(e=>svgOverlayManager.push(e));
    try{
      root.__cblcars_validationCounts={errors:errors?.length||0,warnings:warnings?.length||0};
      root.__cblcars_validationById=detailsById||{};
    }catch{}
  }catch(e){cblcarsLog.warn('[renderMsdOverlay] validation failed',e);}

  const timelineTargets=new Set();
  if(timelines&&typeof timelines==='object'){
    Object.values(timelines).forEach(tl=>{
      if(Array.isArray(tl.steps)){
        tl.steps.forEach(step=>{
          const t=step.targets;
          const add=sel=>{if(typeof sel==='string'&&sel.startsWith('#')) timelineTargets.add(sel.slice(1));};
          if(!t) return; Array.isArray(t)?t.forEach(add):add(t);
        });
      }
    });
  }

  overlays.forEach((overlay,idx)=>{
    if(!overlay) return;
    const elementId=overlay.id;
    const overlayPreset=(overlay.preset&&presets[overlay.preset])?presets[overlay.preset]:{};
    const overlayCopy={...overlay}; delete overlayCopy.preset; delete overlayCopy.state_resolver;

    let stateOverridesRaw=resolveStatePreset(overlay,presets,hass);
    let stateOverrides=stateOverridesRaw&&typeof stateOverridesRaw==='object'?{...stateOverridesRaw}:{};
    if(overlay.type && stateOverrides && typeof stateOverrides==='object'){
      const typeKey=overlay.type;
      if(stateOverrides[typeKey]&&typeof stateOverrides[typeKey]==='object'){
        stateOverrides={...stateOverrides,...stateOverrides[typeKey]};
        delete stateOverrides[typeKey];
      }
    }
    const type=overlay.type;
    const defaultTypePreset=(defaultPreset&&defaultPreset[type])?defaultPreset[type]:{};
    const overlayTypePreset=(overlayPreset&&overlayPreset[type])?overlayPreset[type]:{};
    let computed = resolveOverlayStyles({
      defaults: defaultTypePreset,
      preset: overlayTypePreset,
      customPreset: {},
      overlay: overlayCopy,
      stateOverrides,
      dataSources: {}
    });
    computed = resolveAllDynamicValues(computed, hass);

    const entity=overlay.entity&&hass?.states?.[overlay.entity]?hass.states[overlay.entity]:null;
    const templateContext={entity,hass,overlay,computed};
    if(computed.visible!==undefined){
      const vis=(typeof computed.visible==='string')?evaluateTemplate(computed.visible,templateContext):computed.visible;
      if(vis===false) return;
    }

    const pointContext={anchors,viewBox};
    const isSparkline=computed.type==='sparkline';
    const isRibbon=computed.type==='ribbon';
    const isText=computed.type==='text';
    const isLine=computed.type==='line';
    const isFree=computed.type==='free';


    /* --------------- SPARKLINE (with min_change_pct addition) --------------- */
    if(isSparkline){
      const srcName=computed.source;
      if(!srcName){svgOverlayManager.push(`Sparkline "${computed.id||`spark_${idx}`}" requires "source".`);return;}
      const posPt=resolvePoint(computed.position,pointContext);
      const sizeAbs=resolveSize(computed.size,viewBox);
      if(!posPt||!sizeAbs){svgOverlayManager.push(`Sparkline "${computed.id||`spark_${idx}`}" requires position and size.`);return;}
      const rect={x:Number(posPt[0]),y:Number(posPt[1]),w:Number(sizeAbs.w),h:Number(sizeAbs.h)};
      const elementId=computed.id||`spark_${idx}`;
      const stroke=computed.color||computed.stroke||'var(--lcars-yellow)';
      const strokeWidth=computed.width||computed['stroke-width']||2;
      const areaFill=computed.area_fill||null;

      let msWindow=parseTimeWindowMs(computed.windowSeconds);
      if(!Number.isFinite(msWindow)){
        const ws=typeof computed.windowSeconds==='number'?computed.windowSeconds:3600;
        msWindow=ws*1000;
      }
      msWindow=Math.max(1000,msWindow);

      const yRangeCfg=Array.isArray(computed.y_range)?computed.y_range:null;
      const xMode=computed.x_mode==='index'?'index':'time';
      const extendToEdges=computed.extend_to_edges===true||computed.extend_to_edges==='both';
      const extendLeft=extendToEdges||computed.extend_to_edges==='left';
      const extendRight=extendToEdges||computed.extend_to_edges==='right';
      const ignoreZeroForScale=computed.ignore_zero_for_scale===true;
      const stairStep=computed.stair_step===true;
      const smooth=computed.smooth===true;
      const smoothTension=Number.isFinite(computed.smooth_tension)?Math.max(0,Math.min(1,computed.smooth_tension)):0.5;
      const minChangeCfg=Number.isFinite(computed.min_change)?Number(computed.min_change):null;
      const minIntervalMsCfg=Number.isFinite(computed.min_interval_ms)?Number(computed.min_interval_ms):0;
      const minChangePctCfg=Number.isFinite(computed.min_change_pct)?Math.max(0,Number(computed.min_change_pct)):null; // NEW

      const gridCfg = computed.grid && typeof computed.grid==='object'?computed.grid:null;
      if(gridCfg){
        const gx=Math.max(0,Number(gridCfg.x??0));
        const gy=Math.max(0,Number(gridCfg.y??0));
        const gStroke=gridCfg.color||'rgba(255,255,255,0.12)';
        const gOpacity=gridCfg.opacity??0.5;
        const gWidth=gridCfg.width??1;
        let grid=`<g id="${elementId}_grid" data-cblcars-owned="sparkline" opacity="${gOpacity}" stroke="${gStroke}" stroke-width="${gWidth}" style="pointer-events:none;">`;
        if(gx>0){
          const dx=rect.w/gx;
            for(let i=1;i<gx;i++){const x=rect.x+i*dx;grid+=`<line x1="${x}" y1="${rect.y}" x2="${x}" y2="${rect.y+rect.h}" />`;}
        }
        if(gy>0){
          const dy=rect.h/gy;
          for(let i=1;i<gy;i++){const y=rect.y+i*dy;grid+=`<line x1="${rect.x}" y1="${y}" x2="${rect.x+rect.w}" y2="${y}" />`;}
        }
        grid+='</g>'; svgElements.push(grid);
      }

      svgElements.push(`<path id="${elementId}" data-cblcars-type="sparkline" data-cblcars-root="true" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" d="" style="pointer-events:none;" />`);
      if(areaFill) svgElements.push(`<path id="${elementId}_area" data-cblcars-owned="sparkline" fill="${areaFill}" stroke="none" d="" style="pointer-events:none;" />`);
      svgElements.push(`<g id="${elementId}_markers" data-cblcars-owned="sparkline" style="pointer-events:none;"></g>`);

      if(computed.animation && computed.animation.type && !timelineTargets.has(elementId)){
        window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.overlay');
        animationsToRun.push({...computed.animation,targets:`#${elementId}`,root});
      }

      const labelCfg=computed.label_last&&typeof computed.label_last==='object'?computed.label_last:null;
      if(labelCfg){
        const labelFill=labelCfg.fill||stroke;
        const labelFontSize=labelCfg.font_size||14;
        svgElements.push(`<text id="${elementId}_label" data-cblcars-owned="sparkline" x="${rect.x}" y="${rect.y}" fill="${labelFill}" font-size="${labelFontSize}" font-family="Antonio" dominant-baseline="central" style="pointer-events:none;"></text>`);
      }

      const tracerCfg=(computed.tracer&&typeof computed.tracer==='object')?computed.tracer:null;
      const motionpathHasTracer=computed.animation && computed.animation.type==='motionpath' && computed.animation.tracer;
      if(!motionpathHasTracer && tracerCfg && (tracerCfg.r??0)>0){
        svgElements.push(`<circle id="${elementId}_tracer" data-cblcars-owned="sparkline" cx="${rect.x+rect.w}" cy="${rect.y+rect.h/2}" r="${tracerCfg.r}" fill="${tracerCfg.fill||stroke}" style="pointer-events:none;"></circle>`);
        if(tracerCfg.animation && tracerCfg.animation.type){
          animationsToRun.push({...tracerCfg.animation,targets:`#${elementId}_tracer`,root});
        }
      }

      requestAnimationFrame(()=>{requestAnimationFrame(()=>{
        try{
          const pathEl=root.querySelector?.(`#${elementId}`);
          const areaEl=areaFill?root.querySelector?.(`#${elementId}_area`):null;
          const labelEl=labelCfg?root.querySelector?.(`#${elementId}_label`):null;
          const markersEl=root.querySelector?.(`#${elementId}_markers`)||null;
          if(!pathEl) return;
          const baselineY=rect.y+rect.h;
          pathEl.setAttribute('d',`M${rect.x},${baselineY} L${rect.x+rect.w},${baselineY}`);
          pathEl.setAttribute('data-cblcars-pending','true');
          pathEl.style.visibility='hidden';
          if(areaEl) areaEl.style.visibility='hidden';
          if(labelEl) labelEl.style.visibility='hidden';
          if(markersEl) markersEl.style.visibility='hidden';

          (async ()=>{
            try{
              if(window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length){
                window.cblcars.data.ensureSources(dataSources,hass).catch(()=>{});
              }
            }catch{}
            const start=performance.now();
            const timeoutMs=20000;
            let subscribed=false;
            const trySubscribe=()=>{
              if(subscribed) return;
              const src=window.cblcars?.data?.getSource?.(srcName);
              if(src && src.buffer){subscribed=true; wireUpSource(src); return;}
              if(performance.now()-start<timeoutMs) setTimeout(trySubscribe,300);
              else{
                pathEl.removeAttribute('data-cblcars-pending');
                pathEl.style.visibility='';
                if(areaEl) areaEl.style.visibility='hidden';
              }
            };
            trySubscribe();
          })();

          function wireUpSource(src){
            const toStairPoints=pts=>{
              if(!pts||pts.length<2) return pts||[];
              const out=[]; for(let i=0;i<pts.length-1;i++){const [x1,y1]=pts[i];const [x2]=pts[i+1];out.push([x1,y1],[x2,y1]);}
              out.push(pts[pts.length-1]); return out;
            };
            const areaPathFromSmooth=(lineD,firstPt,lastPt)=>{
              if(!lineD||!firstPt||!lastPt)return'';
              const baseY=rect.y+rect.h;
              const body=lineD.startsWith('M')?lineD.slice(1):lineD;
              return `M${firstPt[0]},${baseY} L${firstPt[0]},${firstPt[1]} ${body} L${lastPt[0]},${baseY} Z`;
            };

            const refresh=()=>{
              const perf=window.cblcars?.perf;
              const endPerf=perf?.timeStart?perf.timeStart('sparkline.refresh.exec'):null;
              try{
                const slice=src.buffer.sliceSince?src.buffer.sliceSince(msWindow):sliceWindow(src.buffer,msWindow);
                const t=slice.t||[], v=slice.v||[];
                if(!t.length){
                  perf?.count&&perf.count('sparkline.refresh.empty');
                  endPerf&&endPerf(); return;
                }

                pathEl.removeAttribute('data-cblcars-pending');
                pathEl.style.visibility='';
                if(areaEl) areaEl.style.visibility='';
                if(labelEl) labelEl.style.visibility='';
                if(markersEl) markersEl.style.visibility='';

                const lastTs=t[t.length-1];
                const lastVal=v[v.length-1];
                const meta=pathEl.__cblcars_meta||{};
                const now=performance.now();

                // Compute thresholds
                let dynamicYr=null;
                let effectiveMinChange=minChangeCfg;
                if(effectiveMinChange==null){
                  const vScale=ignoreZeroForScale?v.filter(n=>n!==0):v;
                  dynamicYr=computeYRange(vScale.length?vScale:v,yRangeCfg);
                  const span=(dynamicYr.max-dynamicYr.min)||1;
                  effectiveMinChange=span*1e-4;
                }
                // NEW: min_change_pct applies as span * pct
                if(minChangePctCfg!=null){
                  const yrForPct = dynamicYr || (()=> {
                    const vScale=ignoreZeroForScale?v.filter(n=>n!==0):v;
                    return computeYRange(vScale.length?vScale:v,yRangeCfg);
                  })();
                  const span=(yrForPct.max-yrForPct.min)||1;
                  const pctAbs=span*minChangePctCfg;
                  effectiveMinChange=Math.max(effectiveMinChange,pctAbs);
                }

                const intervalOk=!meta.lastRenderTime || (minIntervalMsCfg<=0) || (now-meta.lastRenderTime>=minIntervalMsCfg);
                const valueDelta=meta.lastVal==null?Infinity:Math.abs(lastVal-meta.lastVal);

                let canSkip=false;
                if(meta.hasDrawn && !pathEl.hasAttribute('data-cblcars-pending')){
                  const sameTime=lastTs===meta.lastTs;
                  if(sameTime && valueDelta<effectiveMinChange){
                    canSkip=true;
                  } else if(!sameTime && valueDelta<effectiveMinChange && !intervalOk){
                    canSkip=true;
                  }
                }
                if(canSkip){
                  perf?.count&&perf.count('sparkline.refresh.skipped');
                  endPerf&&endPerf();
                  return;
                }

                const vScale2=ignoreZeroForScale?v.filter(n=>n!==0):v;
                const yr = dynamicYr || computeYRange(vScale2.length?vScale2:v,yRangeCfg);

                let pts = xMode==='index'?mapToRectIndex(v,rect,yr):mapToRect(t,v,rect,msWindow,yr);
                if(stairStep) pts=toStairPoints(pts);
                if(pts.length){
                  const firstY=pts[0][1];
                  const lastYp=pts[pts.length-1][1];
                  if(extendLeft && pts[0][0]>rect.x) pts.unshift([rect.x,firstY]);
                  if(extendRight && pts[pts.length-1][0]<rect.x+rect.w) pts.push([rect.x+rect.w,lastYp]);
                }
                pts=sanitizePoints(pts);
                if(!pts.length){endPerf&&endPerf();return;}

                if(smooth && pts.length>1){
                  const dSmooth=(computed.smooth_method==='monotone')
                    ? generateMonotonePath(pts)
                    : generateSmoothPath(pts,{tension:smoothTension});
                  pathEl.setAttribute('d',dSmooth);
                  if(areaEl) areaEl.setAttribute('d',areaPathFromSmooth(dSmooth,pts[0],pts[pts.length-1]));
                }else{
                  const d=pathFromPoints(pts);
                  pathEl.setAttribute('d',d);
                  if(areaEl) areaEl.setAttribute('d',areaPathFromPoints(pts,rect));
                }

                if(markersEl){
                  const markerRadius=Number(computed.markers?.r ?? 0);
                  const markerFill=computed.markers?.fill||stroke;
                  const markersMax=Number.isFinite(computed.markers?.max)?Math.max(1,computed.markers.max):200;
                  const effectiveCount=Math.min(pts.length,markersMax);
                  let needUpdate=false;
                  if(markerRadius<=0){
                    if(markersEl.__cblcars_markerCount && markersEl.innerHTML) markersEl.innerHTML='';
                    markersEl.__cblcars_markerCount=0;
                    perf?.count&&perf.count('sparkline.markers.skipped');
                  }else{
                    if(markersEl.__cblcars_markerCount!==effectiveCount) needUpdate=true;
                    else if(meta.lastPtsLastX!==pts[pts.length-1][0]||meta.lastPtsLastY!==pts[pts.length-1][1]) needUpdate=true;
                    if(needUpdate){
                      let circles='';
                      for(let i=pts.length-effectiveCount;i<pts.length;i++){
                        const [cx,cy]=pts[i];
                        circles+=`<circle cx="${cx}" cy="${cy}" r="${markerRadius}" fill="${markerFill}" />`;
                      }
                      markersEl.innerHTML=circles;
                      markersEl.__cblcars_markerCount=effectiveCount;
                      perf?.count&&perf.count('sparkline.markers.updated');
                    }else{
                      perf?.count&&perf.count('sparkline.markers.skipped');
                    }
                  }
                }

                if(labelEl){
                  const decimals=Number.isFinite(labelCfg.decimals)?labelCfg.decimals:1;
                  const format=labelCfg.format||null;
                  const offset=Array.isArray(labelCfg.offset)?labelCfg.offset:[8,-8];
                  const formatted=format?String(format).replace('{v}',Number(lastVal).toFixed(decimals)):Number(lastVal).toFixed(decimals);
                  if(labelEl.__cblcars_lastText!==formatted){
                    labelEl.textContent=formatted;
                    labelEl.__cblcars_lastText=formatted;
                    perf?.count&&perf.count('sparkline.label.updated');
                  }else{
                    perf?.count&&perf.count('sparkline.label.skipped');
                  }
                  const lastPt=pts[pts.length-1];
                  labelEl.setAttribute('x',String(lastPt[0]+(offset[0]??0)));
                  labelEl.setAttribute('y',String(lastPt[1]+(offset[1]??0)));
                }

                pathEl.__cblcars_meta={
                  lastTs,lastVal,lastRenderTime:now,
                  hasDrawn:true,
                  lastPtsLastX:pts[pts.length-1][0],
                  lastPtsLastY:pts[pts.length-1][1]
                };
                perf?.count&&perf.count('sparkline.refresh');
                endPerf&&endPerf();
              }catch(_){endPerf&&endPerf();}
            };

            refresh();
            if(pathEl.__cblcars_unsub_spark){try{pathEl.__cblcars_unsub_spark();}catch{}}
            pathEl.__cblcars_unsub_spark=src.subscribe(()=>{scheduler.queue('sparkline',()=>refresh()); window.cblcars?.perf?.count&&window.cblcars.perf.count('sparkline.refresh.sched');});
            scheduler.queue('sparkline',()=>refresh());
            setTimeout(()=>{scheduler.queue('sparkline',()=>refresh()); window.cblcars?.perf?.count&&window.cblcars.perf.count('sparkline.refresh.sched');},50);
            setTimeout(()=>{scheduler.queue('sparkline',()=>refresh()); window.cblcars?.perf?.count&&window.cblcars.perf.count('sparkline.refresh.sched');},250);
          }
        }catch{}
      });});

      return;
    }

    /* --------------- RIBBON (now diff-skipping HTML) --------------- */
    if(isRibbon){
      const posPt=resolvePoint(computed.position,pointContext);
      const sizeAbs=resolveSize(computed.size,viewBox);
      if(!posPt||!sizeAbs){svgOverlayManager.push(`Ribbon "${computed.id||`ribbon_${idx}`}" requires position and size.`);return;}
      const rect={x:Number(posPt[0]),y:Number(posPt[1]),w:Number(sizeAbs.w),h:Number(sizeAbs.h)};
      const elementId=computed.id||`ribbon_${idx}`;
      const sourcesArr=Array.isArray(computed.sources)&&computed.sources.length?computed.sources:(computed.source?[computed.source]:[]);
      if(!sourcesArr.length){svgOverlayManager.push(`Ribbon "${elementId}" requires "source" or "sources".`);return;}
      let msWindow=parseTimeWindowMs(computed.windowSeconds);
      if(!Number.isFinite(msWindow)){
        const ws=typeof computed.windowSeconds==='number'?computed.windowSeconds:3600;
        msWindow=ws*1000;
      }
      msWindow=Math.max(1000,msWindow);
      const onColor=computed.on_color||'var(--lcars-yellow)';
      const offColor=computed.off_color||null;
      const opacity=computed.opacity??1;
      const rx=Number.isFinite(computed.rx)?Number(computed.rx):0;
      const ry=Number.isFinite(computed.ry)?Number(computed.ry):rx;
      const threshold=Number.isFinite(computed.threshold)?Number(computed.threshold):1;
      const laneGap=Math.max(0,Number(computed.lane_gap??2));

      if(offColor){
        svgElements.push(`<rect id="${elementId}_backdrop" data-cblcars-owned="ribbon" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${offColor}" opacity="${opacity}" rx="${rx}" ry="${ry}" style="pointer-events:none;" />`);
      }
      svgElements.push(
        `<g id="${elementId}" data-cblcars-type="ribbon" data-cblcars-root="true" opacity="${opacity}" style="pointer-events:none;">
          <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="none" opacity="0" data-cblcars-owned="ribbon" data-cblcars-placeholder="true" />
        </g>`
      );
      requestAnimationFrame(()=>{requestAnimationFrame(async()=>{
        try{
          if(window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length){
            await window.cblcars.data.ensureSources(dataSources,hass);
          }
          const groupEl=root.querySelector?.(`#${elementId}`);
          if(!groupEl) return;
          const laneCount=sourcesArr.length;
          const laneHeight=laneCount>0?(rect.h-laneGap*(laneCount-1))/laneCount:rect.h;
          const mapTimeToX=(ts,rect,windowMs)=>{
            const now=Date.now(); const dt=now-ts;
            const frac=Math.max(0,Math.min(1,1-dt/windowMs));
            return rect.x+frac*rect.w;
          };
          const buildOnSegments=(tArr,vArr,windowMs,th)=>{
            const segs=[]; let inSeg=false; let startTs=null;
            for(let i=0;i<tArr.length;i++){
              const on=Number(vArr[i])>=th;
              if(on && !inSeg){inSeg=true; startTs=tArr[i];}
              else if(!on && inSeg){inSeg=false; segs.push([startTs,tArr[i]]);}
            }
            if(inSeg) segs.push([startTs,tArr[tArr.length-1]]);
            return segs;
          };

          const refresh=()=>{
            let html='';
            for(let lane=0;lane<laneCount;lane++){
              const srcName=sourcesArr[lane];
              const src=window.cblcars?.data?.getSource?.(srcName);
              if(!src) continue;
              const slice=src.buffer.sliceSince?src.buffer.sliceSince(msWindow):sliceWindow(src.buffer,msWindow);
              const t=slice.t||[], v=slice.v||[];
              if(!t.length) continue;
              const segs=buildOnSegments(t,v,msWindow,threshold);
              const yTop=rect.y+lane*(laneHeight+laneGap);
              for(const [ts0,ts1] of segs){
                const x0=mapTimeToX(ts0,rect,msWindow);
                const x1=mapTimeToX(ts1,rect,msWindow);
                const w=Math.max(0,x1-x0);
                if(w<=0) continue;
                html+=`<rect x="${x0}" y="${yTop}" width="${w}" height="${laneHeight}" fill="${onColor}" rx="${rx}" ry="${ry}" />`;
              }
            }
            if(groupEl.__cblcars_lastHtml===html){
              window.cblcars?.perf?.count&&window.cblcars.perf.count('ribbon.refresh.skipped');
              return;
            }
            groupEl.__cblcars_lastHtml=html;
            groupEl.innerHTML=html;


            // Invalidate connectors if first meaningful geometry (placeholder was present)
            try {
              if (!groupEl.__cblcars_geom_ready) {
                groupEl.__cblcars_geom_ready = true;
                window.cblcars?.connectors?.invalidate && window.cblcars.connectors.invalidate(); // invalidate all
                // Schedule relayout next frame
                requestAnimationFrame(() => {
                  window.cblcars?.overlayHelpers?.layoutPendingConnectors?.(root, viewBox);
                });
              }
            } catch (_) {}

            window.cblcars?.perf?.count&&window.cblcars.perf.count('ribbon.refresh.exec');
          };

          refresh();
          const unsubs=[];
          for(const sName of sourcesArr){
            const s=window.cblcars?.data?.getSource?.(sName);
            if(s) unsubs.push(s.subscribe(()=>refresh()));
          }
          if(groupEl.__cblcars_unsub_ribbon){try{groupEl.__cblcars_unsub_ribbon.forEach(fn=>fn&&fn());}catch{}}
          groupEl.__cblcars_unsub_ribbon=unsubs;

          setTimeout(refresh,0);
          setTimeout(refresh,100);
        }catch{}
      });});

      return;
    }

    /* --------------- TEXT --------------- */
    if(isText){
      const posPt=resolvePoint(computed.position,pointContext);
      if(!posPt){svgOverlayManager.push(`Text overlay "${elementId||`text_${idx}`}" invalid position.`);return;}
      const xOff=Number(computed.x_offset??0);
      const yOff=Number(computed.y_offset??0);
      const x=posPt[0]+xOff, y=posPt[1]+yOff;
      const textValue=evaluateTemplate(computed.value,templateContext)??'';
      const {attrs,style}=splitAttrsAndStyle(computed,'text');
      attrs['dominant-baseline']=attrs['dominant-baseline']||'middle';
      if(!attrs['text-anchor']&&computed.align) attrs['text-anchor']=computed.align;
      const hasActions=!!(overlay.tap_action||overlay.hold_action||overlay.double_tap_action||overlay.actions);
      style['pointer-events']=hasActions?'auto':'none';
      if(hasActions) style.cursor='pointer';
      attrs['data-cblcars-type']='text';
      attrs['data-cblcars-root']='true';
      svgElements.push(svgHelpers.drawText({x,y,text:textValue,id:elementId,attrs,style}));
      if(computed.animation && computed.animation.type && !timelineTargets.has(elementId)){
        window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.overlay');
        animationsToRun.push({...computed.animation,targets:`#${elementId}`,root});
      }
      return;
    }

    /* --------------- LINE (route:auto integration) --------------- */
    if(isLine){
      const thisId=elementId||`line_${idx}`;
      let d='';
      const cornerStyle=(computed.corner_style||'round').toLowerCase();
      const cornerRadius=Number.isFinite(computed.corner_radius)?Number(computed.corner_radius):12;
      const routeAuto = String(computed.route||'').toLowerCase()==='auto';
      const routeMode = computed.route_mode ? String(computed.route_mode).toLowerCase() : undefined;
      const avoid = Array.isArray(computed.avoid)?computed.avoid:[];

      if(Array.isArray(computed.points)&&computed.points.length>=2 && !routeAuto){
        const pts=computed.points.map(p=>resolvePoint(p,pointContext)).filter(Boolean);
        if(pts.length>=2) d=generateMultiSegmentPath(pts,{cornerStyle,cornerRadius});
      }else if(Array.isArray(computed.steps)&&computed.steps.length>0 && !routeAuto){
        const pts=generateWaypointsFromSteps(computed.anchor??overlay.anchor,computed.steps,pointContext);
        if(pts.length>=2) d=generateMultiSegmentPath(pts,{cornerStyle,cornerRadius});
      }else{
        const start=resolvePoint(computed.anchor??overlay.anchor,pointContext);
        let end=resolvePoint(computed.attach_to??overlay.attach_to,pointContext);
        const attachRaw=computed.attach_to??overlay.attach_to;
        const attachIsId=!end && typeof attachRaw==='string' && attachRaw.trim().length>0;
        if(!start){svgOverlayManager.push(`Line "${thisId}" requires valid "anchor".`);return;}
        if(end && !routeAuto){
          d=generateRightAnglePath(start,end,{radius:cornerRadius,cornerStyle});
        }else if(attachIsId){
          // Defer layout via data attributes; include route flags
          const {attrs,style}=splitAttrsAndStyle(computed,'line');
          attrs.fill='none';
          if(!attrs.stroke&&computed.color) attrs.stroke=computed.color;
          if(!attrs['stroke-width']&&computed.width) attrs['stroke-width']=computed.width;
          const hasActions=!!(overlay.tap_action||overlay.hold_action||overlay.double_tap_action||overlay.actions);
          style['pointer-events']=hasActions?'auto':'none';
          if(hasActions) style.cursor='pointer';
          attrs['data-cblcars-attach-to']=String(attachRaw);
          attrs['data-cblcars-start-x']=String(start[0]);
          attrs['data-cblcars-start-y']=String(start[1]);
          if(computed.attach_side) attrs['data-cblcars-side']=String(computed.attach_side);
          if(computed.attach_align) attrs['data-cblcars-align']=String(computed.attach_align);
          if(computed.attach_gap!==undefined) attrs['data-cblcars-gap']=String(computed.attach_gap);
          attrs['data-cblcars-radius']=String(cornerRadius);
          attrs['data-cblcars-corner-style']=cornerStyle;
          if(routeAuto) {
            attrs['data-cblcars-route']='auto';
            if(routeMode) attrs['data-cblcars-route-mode']=routeMode;
            if(avoid.length) attrs['data-cblcars-avoid']=avoid.join(',');
          }
          attrs['data-cblcars-type']='line';
          attrs['data-cblcars-root']='true';
          svgElements.push(svgHelpers.drawPath({d:'',id:thisId,attrs,style}));
          if(computed.animation && computed.animation.type && !timelineTargets.has(thisId)){
            window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.overlay');
            animationsToRun.push({...computed.animation,targets:`#${thisId}`,root});
          }
          return;
        }else if(routeAuto && end){
          // If route:auto but direct endpoint provided as coords, just do normal path (rare)
          d=generateRightAnglePath(start,end,{radius:cornerRadius,cornerStyle});
        } else {
          svgOverlayManager.push(`Line "${thisId}" requires valid "attach_to".`);
          return;
        }
      }
      if(!d){svgOverlayManager.push(`Line "${thisId}" failed to compute path.`);return;}
      const {attrs,style}=splitAttrsAndStyle(computed,'line');
      attrs.fill='none';
      if(!attrs.stroke&&computed.color) attrs.stroke=computed.color;
      if(!attrs['stroke-width']&&computed.width) attrs['stroke-width']=computed.width;
      const hasActions=!!(overlay.tap_action||overlay.hold_action||overlay.double_tap_action||overlay.actions);
      style['pointer-events']=hasActions?'auto':'none';
      if(hasActions) style.cursor='pointer';
      attrs['data-cblcars-type']='line';
      attrs['data-cblcars-root']='true';
      svgElements.push(svgHelpers.drawPath({d,id:thisId,attrs,style}));
      if(computed.animation && computed.animation.type && !timelineTargets.has(thisId)){
        window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.overlay');
        animationsToRun.push({...computed.animation,targets:`#${thisId}`,root});
      }
      return;
    }

    /* FREE unchanged */
    if(isFree){
      if(computed.animation && computed.animation.type && computed.targets && !timelineTargets.has(elementId)){
        window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.overlay');
        animationsToRun.push({...computed.animation,targets:computed.targets,root,id:elementId});
      }
      return;
    }
  });

  svgElements.push(`<g id="${svgOverlayManager.containerId}"></g>`);
  const svgMarkup=`<svg viewBox="${viewBox.join(' ')}" width="100%" height="100%" style="pointer-events:auto;">${svgElements.join('')}</svg>`;

  if(Array.isArray(animations)){
    animations.forEach(anim=>{
      let animCfg={...anim};
      if(!animCfg.type && animCfg.animation?.type){
        animCfg={...animCfg.animation,targets:animCfg.targets??animCfg.animation.targets,id:animCfg.id??animCfg.animation.id};
      }
      try{
        const overrides=resolveStatePreset(animCfg,presets,hass);
        if(overrides && typeof overrides==='object') Object.assign(animCfg,overrides);
      }catch{}
      animCfg=resolveAllDynamicValues(animCfg,hass);
      let targetsArr=[];
      if(animCfg.targets) targetsArr=Array.isArray(animCfg.targets)?animCfg.targets:[animCfg.targets];
      else if(animCfg.id) targetsArr=[`#${animCfg.id}`];
      const filtered=targetsArr.filter(sel=>{
        if(typeof sel==='string'&&sel.startsWith('#')) return !timelineTargets.has(sel.slice(1));
        return true;
      });
      if(filtered.length){
        window.cblcars?.perf?.count&&window.cblcars.perf.count('animation.enqueue.standalone');
        const finalTargets=filtered.length===1?filtered[0]:filtered;
        animationsToRun.push({...animCfg,targets:finalTargets,root});
      }
    });
  }

  // Optional: auto-refresh debug layer if flags active (perf / overlay)
  try {
  if (window.cblcars?._debugFlags && (
        window.cblcars._debugFlags.perf ||
        window.cblcars._debugFlags.overlay ||
        window.cblcars._debugFlags.connectors ||
        window.cblcars._debugFlags.geometry
      )) {
        requestAnimationFrame(() => {
          window.cblcars.debug?.render?.(root, viewBox, { anchors });
        });
    }
  } catch (_) {}
  if (dbgEnd) window.cblcars.debug.perf.end('msd.render');
  return { svgMarkup, animationsToRun };
}