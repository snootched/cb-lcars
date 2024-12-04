(()=>{"use strict";var t,e,i,r={630:(t,e,i)=>{const r=i(330).version,n="https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap",s="/hacsfiles/cb-lcars/cb-lcars-lovelace.yaml",a="/hacsfiles/cb-lcars/cb-lcars-stub-config.yaml";let o="info";function l(){return o}function c(t,e,i={},r=o){const n=["error","warn","info","debug"],s=n.indexOf(r);if(n.indexOf(t)>s)return;const a={info:"background-color: #37a6d1",warn:"background-color: #ff6753",error:"background-color: #ef1d10",debug:"background-color: #8e44ad",default:"background-color: #6d748c"},l=`%c    CB-LCARS | ${t} `,c=`${a[t]||a.default}; color: white; padding: 1px 4px; border-radius: 15px;`;switch(t){case"info":default:console.log(l,c,e,i);break;case"warn":console.warn(l,c,e,i);break;case"error":console.error(l,c,e,i);break;case"debug":console.debug(l,c,e,i)}}window.cblcars=window.cblcars||{},window.cblcars.setGlobalLogLevel=function(t){o=t,c("info",`Setting CBLCARS global log level set to: ${t}`,{},"info")},window.cblcars.getGlobalLogLevel=l;var u=i(382);async function d(t){try{const e=await async function(t){try{const e=await fetch(t);if(e.ok)return await e.text()}catch(t){throw c("error","Error fetching YAML file ",t),t}}(t);return u.Ay.load(e)}catch(t){throw c("error","Failed to parse YAML file",t.message),t}}var h=i(243),f=i(448);class p extends f.A{_formDefinitions;_formControls;_cardType;constructor(t){super(),this._formDefinitions={},this._formControls={},this._cardType="",this._cardType=t,this._initializationPromise=this._initialize()}async _initialize(){try{const t=await d("/hacsfiles/cb-lcars/cb-lcars-card-editor-forms.yaml");c("debug","formDefinitions: ",t),this._formDefinitions=t,this._formControls=t[this._cardType],this._userStyles=h.css`${(0,h.unsafeCSS)(t[this._cardType].css&&t[this._cardType].css.cssText||"")}`,this._mergeUserStyles=t[this._cardType]?.css?.mergeUserStyles??!0,this.requestUpdate()}catch(t){c("error","Error fetching editor form definitions: ",t)}}async setConfig(t){await this._initializationPromise,super.setConfig(t),this.requestUpdate()}render(){if(!this._hass)return h.html`<ha-alert alert-type="error" title="Error">Home Assistant instance is missing.</ha-alert>`;if(!this._config)return h.html`<ha-alert alert-type="error" title="Error">Card configuration is missing.</ha-alert>`;if(!this._formControls)return h.html`<ha-alert alert-type="error" title="Error">Form controls are missing.</ha-alert>`;try{const t=this._formControls;return this.generateForm(t)}catch(t){return c("error","Error rendering configuration form:",t),h.html`<ha-alert alert-type="error" title="Error">Error rendering form: ${t.message}</ha-alert>`}}}function m(t,e,i,r){var n,s=arguments.length,a=s<3?e:null===r?r=Object.getOwnPropertyDescriptor(e,i):r;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)a=Reflect.decorate(t,e,i,r);else for(var o=t.length-1;o>=0;o--)(n=t[o])&&(a=(s<3?n(a):s>3?n(e,i,a):n(e,i))||a);return s>3&&a&&Object.defineProperty(e,i,a),a}const g=window,_=g.ShadowRoot&&(void 0===g.ShadyCSS||g.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,b=Symbol(),v=new WeakMap;class y{constructor(t,e,i){if(this._$cssResult$=!0,i!==b)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(_&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=v.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&v.set(e,t))}return t}toString(){return this.cssText}}const w=_?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new y("string"==typeof t?t:t+"",void 0,b))(e)})(t):t;var $;const S=window,A=S.trustedTypes,C=A?A.emptyScript:"",k=S.reactiveElementPolyfillSupport,x={toAttribute(t,e){switch(e){case Boolean:t=t?C:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},O=(t,e)=>e!==t&&(e==e||t==t),E={attribute:!0,type:String,converter:x,reflect:!1,hasChanged:O},T="finalized";class R extends HTMLElement{constructor(){super(),this._$Ei=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$El=null,this.u()}static addInitializer(t){var e;this.finalize(),(null!==(e=this.h)&&void 0!==e?e:this.h=[]).push(t)}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach(((e,i)=>{const r=this._$Ep(i,e);void 0!==r&&(this._$Ev.set(r,i),t.push(r))})),t}static createProperty(t,e=E){if(e.state&&(e.attribute=!1),this.finalize(),this.elementProperties.set(t,e),!e.noAccessor&&!this.prototype.hasOwnProperty(t)){const i="symbol"==typeof t?Symbol():"__"+t,r=this.getPropertyDescriptor(t,i,e);void 0!==r&&Object.defineProperty(this.prototype,t,r)}}static getPropertyDescriptor(t,e,i){return{get(){return this[e]},set(r){const n=this[t];this[e]=r,this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||E}static finalize(){if(this.hasOwnProperty(T))return!1;this[T]=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),void 0!==t.h&&(this.h=[...t.h]),this.elementProperties=new Map(t.elementProperties),this._$Ev=new Map,this.hasOwnProperty("properties")){const t=this.properties,e=[...Object.getOwnPropertyNames(t),...Object.getOwnPropertySymbols(t)];for(const i of e)this.createProperty(i,t[i])}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(w(t))}else void 0!==t&&e.push(w(t));return e}static _$Ep(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}u(){var t;this._$E_=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$Eg(),this.requestUpdate(),null===(t=this.constructor.h)||void 0===t||t.forEach((t=>t(this)))}addController(t){var e,i;(null!==(e=this._$ES)&&void 0!==e?e:this._$ES=[]).push(t),void 0!==this.renderRoot&&this.isConnected&&(null===(i=t.hostConnected)||void 0===i||i.call(t))}removeController(t){var e;null===(e=this._$ES)||void 0===e||e.splice(this._$ES.indexOf(t)>>>0,1)}_$Eg(){this.constructor.elementProperties.forEach(((t,e)=>{this.hasOwnProperty(e)&&(this._$Ei.set(e,this[e]),delete this[e])}))}createRenderRoot(){var t;const e=null!==(t=this.shadowRoot)&&void 0!==t?t:this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{_?t.adoptedStyleSheets=e.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet)):e.forEach((e=>{const i=document.createElement("style"),r=g.litNonce;void 0!==r&&i.setAttribute("nonce",r),i.textContent=e.cssText,t.appendChild(i)}))})(e,this.constructor.elementStyles),e}connectedCallback(){var t;void 0===this.renderRoot&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var e;return null===(e=t.hostConnected)||void 0===e?void 0:e.call(t)}))}enableUpdating(t){}disconnectedCallback(){var t;null===(t=this._$ES)||void 0===t||t.forEach((t=>{var e;return null===(e=t.hostDisconnected)||void 0===e?void 0:e.call(t)}))}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$EO(t,e,i=E){var r;const n=this.constructor._$Ep(t,i);if(void 0!==n&&!0===i.reflect){const s=(void 0!==(null===(r=i.converter)||void 0===r?void 0:r.toAttribute)?i.converter:x).toAttribute(e,i.type);this._$El=t,null==s?this.removeAttribute(n):this.setAttribute(n,s),this._$El=null}}_$AK(t,e){var i;const r=this.constructor,n=r._$Ev.get(t);if(void 0!==n&&this._$El!==n){const t=r.getPropertyOptions(n),s="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==(null===(i=t.converter)||void 0===i?void 0:i.fromAttribute)?t.converter:x;this._$El=n,this[n]=s.fromAttribute(e,t.type),this._$El=null}}requestUpdate(t,e,i){let r=!0;void 0!==t&&(((i=i||this.constructor.getPropertyOptions(t)).hasChanged||O)(this[t],e)?(this._$AL.has(t)||this._$AL.set(t,e),!0===i.reflect&&this._$El!==t&&(void 0===this._$EC&&(this._$EC=new Map),this._$EC.set(t,i))):r=!1),!this.isUpdatePending&&r&&(this._$E_=this._$Ej())}async _$Ej(){this.isUpdatePending=!0;try{await this._$E_}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Ei&&(this._$Ei.forEach(((t,e)=>this[e]=t)),this._$Ei=void 0);let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var e;return null===(e=t.hostUpdate)||void 0===e?void 0:e.call(t)})),this.update(i)):this._$Ek()}catch(t){throw e=!1,this._$Ek(),t}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;null===(e=this._$ES)||void 0===e||e.forEach((t=>{var e;return null===(e=t.hostUpdated)||void 0===e?void 0:e.call(t)})),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$Ek(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$E_}shouldUpdate(t){return!0}update(t){void 0!==this._$EC&&(this._$EC.forEach(((t,e)=>this._$EO(e,this[e],t))),this._$EC=void 0),this._$Ek()}updated(t){}firstUpdated(t){}}var j;R[T]=!0,R.elementProperties=new Map,R.elementStyles=[],R.shadowRootOptions={mode:"open"},null==k||k({ReactiveElement:R}),(null!==($=S.reactiveElementVersions)&&void 0!==$?$:S.reactiveElementVersions=[]).push("1.6.2");const M=window,L=M.trustedTypes,H=L?L.createPolicy("lit-html",{createHTML:t=>t}):void 0,z="$lit$",D=`lit$${(Math.random()+"").slice(9)}$`,N="?"+D,P=`<${N}>`,F=document,I=()=>F.createComment(""),B=t=>null===t||"object"!=typeof t&&"function"!=typeof t,V=Array.isArray,U="[ \t\n\f\r]",q=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,W=/-->/g,G=/>/g,Z=RegExp(`>|${U}(?:([^\\s"'>=/]+)(${U}*=${U}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),Y=/'/g,J=/"/g,K=/^(?:script|style|textarea|title)$/i,X=(t,...e)=>({_$litType$:1,strings:t,values:e}),Q=Symbol.for("lit-noChange"),tt=Symbol.for("lit-nothing"),et=new WeakMap,it=F.createTreeWalker(F,129,null,!1);function rt(t,e){if(!Array.isArray(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==H?H.createHTML(e):e}class nt{constructor({strings:t,_$litType$:e},i){let r;this.parts=[];let n=0,s=0;const a=t.length-1,o=this.parts,[l,c]=((t,e)=>{const i=t.length-1,r=[];let n,s=2===e?"<svg>":"",a=q;for(let e=0;e<i;e++){const i=t[e];let o,l,c=-1,u=0;for(;u<i.length&&(a.lastIndex=u,l=a.exec(i),null!==l);)u=a.lastIndex,a===q?"!--"===l[1]?a=W:void 0!==l[1]?a=G:void 0!==l[2]?(K.test(l[2])&&(n=RegExp("</"+l[2],"g")),a=Z):void 0!==l[3]&&(a=Z):a===Z?">"===l[0]?(a=null!=n?n:q,c=-1):void 0===l[1]?c=-2:(c=a.lastIndex-l[2].length,o=l[1],a=void 0===l[3]?Z:'"'===l[3]?J:Y):a===J||a===Y?a=Z:a===W||a===G?a=q:(a=Z,n=void 0);const d=a===Z&&t[e+1].startsWith("/>")?" ":"";s+=a===q?i+P:c>=0?(r.push(o),i.slice(0,c)+z+i.slice(c)+D+d):i+D+(-2===c?(r.push(void 0),e):d)}return[rt(t,s+(t[i]||"<?>")+(2===e?"</svg>":"")),r]})(t,e);if(this.el=nt.createElement(l,i),it.currentNode=this.el.content,2===e){const t=this.el.content,e=t.firstChild;e.remove(),t.append(...e.childNodes)}for(;null!==(r=it.nextNode())&&o.length<a;){if(1===r.nodeType){if(r.hasAttributes()){const t=[];for(const e of r.getAttributeNames())if(e.endsWith(z)||e.startsWith(D)){const i=c[s++];if(t.push(e),void 0!==i){const t=r.getAttribute(i.toLowerCase()+z).split(D),e=/([.?@])?(.*)/.exec(i);o.push({type:1,index:n,name:e[2],strings:t,ctor:"."===e[1]?ct:"?"===e[1]?dt:"@"===e[1]?ht:lt})}else o.push({type:6,index:n})}for(const e of t)r.removeAttribute(e)}if(K.test(r.tagName)){const t=r.textContent.split(D),e=t.length-1;if(e>0){r.textContent=L?L.emptyScript:"";for(let i=0;i<e;i++)r.append(t[i],I()),it.nextNode(),o.push({type:2,index:++n});r.append(t[e],I())}}}else if(8===r.nodeType)if(r.data===N)o.push({type:2,index:n});else{let t=-1;for(;-1!==(t=r.data.indexOf(D,t+1));)o.push({type:7,index:n}),t+=D.length-1}n++}}static createElement(t,e){const i=F.createElement("template");return i.innerHTML=t,i}}function st(t,e,i=t,r){var n,s,a,o;if(e===Q)return e;let l=void 0!==r?null===(n=i._$Co)||void 0===n?void 0:n[r]:i._$Cl;const c=B(e)?void 0:e._$litDirective$;return(null==l?void 0:l.constructor)!==c&&(null===(s=null==l?void 0:l._$AO)||void 0===s||s.call(l,!1),void 0===c?l=void 0:(l=new c(t),l._$AT(t,i,r)),void 0!==r?(null!==(a=(o=i)._$Co)&&void 0!==a?a:o._$Co=[])[r]=l:i._$Cl=l),void 0!==l&&(e=st(t,l._$AS(t,e.values),l,r)),e}class at{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){var e;const{el:{content:i},parts:r}=this._$AD,n=(null!==(e=null==t?void 0:t.creationScope)&&void 0!==e?e:F).importNode(i,!0);it.currentNode=n;let s=it.nextNode(),a=0,o=0,l=r[0];for(;void 0!==l;){if(a===l.index){let e;2===l.type?e=new ot(s,s.nextSibling,this,t):1===l.type?e=new l.ctor(s,l.name,l.strings,this,t):6===l.type&&(e=new ft(s,this,t)),this._$AV.push(e),l=r[++o]}a!==(null==l?void 0:l.index)&&(s=it.nextNode(),a++)}return it.currentNode=F,n}v(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class ot{constructor(t,e,i,r){var n;this.type=2,this._$AH=tt,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=r,this._$Cp=null===(n=null==r?void 0:r.isConnected)||void 0===n||n}get _$AU(){var t,e;return null!==(e=null===(t=this._$AM)||void 0===t?void 0:t._$AU)&&void 0!==e?e:this._$Cp}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===(null==t?void 0:t.nodeType)&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=st(this,t,e),B(t)?t===tt||null==t||""===t?(this._$AH!==tt&&this._$AR(),this._$AH=tt):t!==this._$AH&&t!==Q&&this._(t):void 0!==t._$litType$?this.g(t):void 0!==t.nodeType?this.$(t):(t=>V(t)||"function"==typeof(null==t?void 0:t[Symbol.iterator]))(t)?this.T(t):this._(t)}k(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}$(t){this._$AH!==t&&(this._$AR(),this._$AH=this.k(t))}_(t){this._$AH!==tt&&B(this._$AH)?this._$AA.nextSibling.data=t:this.$(F.createTextNode(t)),this._$AH=t}g(t){var e;const{values:i,_$litType$:r}=t,n="number"==typeof r?this._$AC(t):(void 0===r.el&&(r.el=nt.createElement(rt(r.h,r.h[0]),this.options)),r);if((null===(e=this._$AH)||void 0===e?void 0:e._$AD)===n)this._$AH.v(i);else{const t=new at(n,this),e=t.u(this.options);t.v(i),this.$(e),this._$AH=t}}_$AC(t){let e=et.get(t.strings);return void 0===e&&et.set(t.strings,e=new nt(t)),e}T(t){V(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,r=0;for(const n of t)r===e.length?e.push(i=new ot(this.k(I()),this.k(I()),this,this.options)):i=e[r],i._$AI(n),r++;r<e.length&&(this._$AR(i&&i._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){var i;for(null===(i=this._$AP)||void 0===i||i.call(this,!1,!0,e);t&&t!==this._$AB;){const e=t.nextSibling;t.remove(),t=e}}setConnected(t){var e;void 0===this._$AM&&(this._$Cp=t,null===(e=this._$AP)||void 0===e||e.call(this,t))}}class lt{constructor(t,e,i,r,n){this.type=1,this._$AH=tt,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=n,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=tt}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,e=this,i,r){const n=this.strings;let s=!1;if(void 0===n)t=st(this,t,e,0),s=!B(t)||t!==this._$AH&&t!==Q,s&&(this._$AH=t);else{const r=t;let a,o;for(t=n[0],a=0;a<n.length-1;a++)o=st(this,r[i+a],e,a),o===Q&&(o=this._$AH[a]),s||(s=!B(o)||o!==this._$AH[a]),o===tt?t=tt:t!==tt&&(t+=(null!=o?o:"")+n[a+1]),this._$AH[a]=o}s&&!r&&this.j(t)}j(t){t===tt?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,null!=t?t:"")}}class ct extends lt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===tt?void 0:t}}const ut=L?L.emptyScript:"";class dt extends lt{constructor(){super(...arguments),this.type=4}j(t){t&&t!==tt?this.element.setAttribute(this.name,ut):this.element.removeAttribute(this.name)}}class ht extends lt{constructor(t,e,i,r,n){super(t,e,i,r,n),this.type=5}_$AI(t,e=this){var i;if((t=null!==(i=st(this,t,e,0))&&void 0!==i?i:tt)===Q)return;const r=this._$AH,n=t===tt&&r!==tt||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,s=t!==tt&&(r===tt||n);n&&this.element.removeEventListener(this.name,this,r),s&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e,i;"function"==typeof this._$AH?this._$AH.call(null!==(i=null===(e=this.options)||void 0===e?void 0:e.host)&&void 0!==i?i:this.element,t):this._$AH.handleEvent(t)}}class ft{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){st(this,t)}}const pt=M.litHtmlPolyfillSupport;var mt,gt;null==pt||pt(nt,ot),(null!==(j=M.litHtmlVersions)&&void 0!==j?j:M.litHtmlVersions=[]).push("2.7.5");class _t extends R{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t,e;const i=super.createRenderRoot();return null!==(t=(e=this.renderOptions).renderBefore)&&void 0!==t||(e.renderBefore=i.firstChild),i}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{var r,n;const s=null!==(r=null==i?void 0:i.renderBefore)&&void 0!==r?r:e;let a=s._$litPart$;if(void 0===a){const t=null!==(n=null==i?void 0:i.renderBefore)&&void 0!==n?n:null;s._$litPart$=a=new ot(e.insertBefore(I(),t),t,void 0,null!=i?i:{})}return a._$AI(t),a})(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),null===(t=this._$Do)||void 0===t||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),null===(t=this._$Do)||void 0===t||t.setConnected(!1)}render(){return Q}}_t.finalized=!0,_t._$litElement$=!0,null===(mt=globalThis.litElementHydrateSupport)||void 0===mt||mt.call(globalThis,{LitElement:_t});const bt=globalThis.litElementPolyfillSupport;null==bt||bt({LitElement:_t}),(null!==(gt=globalThis.litElementVersions)&&void 0!==gt?gt:globalThis.litElementVersions=[]).push("3.3.2");const vt=(t,e)=>"method"===e.kind&&e.descriptor&&!("value"in e.descriptor)?{...e,finisher(i){i.createProperty(e.key,t)}}:{kind:"field",key:Symbol(),placement:"own",descriptor:{},originalKey:e.key,initializer(){"function"==typeof e.initializer&&(this[e.key]=e.initializer.call(this))},finisher(i){i.createProperty(e.key,t)}};function yt(t){return(e,i)=>void 0!==i?((t,e,i)=>{e.constructor.createProperty(i,t)})(t,e,i):vt(t,e)}const wt=({finisher:t,descriptor:e})=>(i,r)=>{var n;if(void 0===r){const r=null!==(n=i.originalKey)&&void 0!==n?n:i.key,s=null!=e?{kind:"method",placement:"prototype",key:r,descriptor:e(i.key)}:{...i,key:r};return null!=t&&(s.finisher=function(e){t(e,r)}),s}{const n=i.constructor;void 0!==e&&Object.defineProperty(i,r,e(r)),null==t||t(n,r)}};function $t(t){return wt({finisher:(e,i)=>{Object.assign(e.prototype[i],t)}})}var St;null===(St=window.HTMLSlotElement)||void 0===St||St.prototype.assignedElements;class At{constructor(t){this.startPress=e=>{t().then((t=>{t&&t.startPress(e)}))},this.endPress=()=>{t().then((t=>{t&&t.endPress()}))},this.startFocus=()=>{t().then((t=>{t&&t.startFocus()}))},this.endFocus=()=>{t().then((t=>{t&&t.endFocus()}))},this.startHover=()=>{t().then((t=>{t&&t.startHover()}))},this.endHover=()=>{t().then((t=>{t&&t.endHover()}))}}}const Ct=t=>(...e)=>({_$litDirective$:t,values:e});class kt{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}}const xt="important",Ot=" !"+xt,Et=Ct(class extends kt{constructor(t){var e;if(super(t),1!==t.type||"style"!==t.name||(null===(e=t.strings)||void 0===e?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce(((e,i)=>{const r=t[i];return null==r?e:e+`${i=i.includes("-")?i:i.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${r};`}),"")}update(t,[e]){const{style:i}=t.element;if(void 0===this.ut){this.ut=new Set;for(const t in e)this.ut.add(t);return this.render(e)}this.ut.forEach((t=>{null==e[t]&&(this.ut.delete(t),t.includes("-")?i.removeProperty(t):i[t]="")}));for(const t in e){const r=e[t];if(null!=r){this.ut.add(t);const e="string"==typeof r&&r.endsWith(Ot);t.includes("-")||e?i.setProperty(t,e?r.slice(0,-11):r,e?xt:""):i[t]=r}}return Q}});class Tt extends kt{constructor(t){if(super(t),this.et=tt,2!==t.type)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===tt||null==t)return this.ft=void 0,this.et=t;if(t===Q)return t;if("string"!=typeof t)throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.et)return this.ft;this.et=t;const e=[t];return e.raw=e,this.ft={_$litType$:this.constructor.resultType,strings:e,values:[]}}}Tt.directiveName="unsafeHTML",Tt.resultType=1;const Rt=Ct(Tt),jt=Ct(class extends kt{constructor(t){var e;if(super(t),1!==t.type||"class"!==t.name||(null===(e=t.strings)||void 0===e?void 0:e.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter((e=>t[e])).join(" ")+" "}update(t,[e]){var i,r;if(void 0===this.it){this.it=new Set,void 0!==t.strings&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter((t=>""!==t))));for(const t in e)e[t]&&!(null===(i=this.nt)||void 0===i?void 0:i.has(t))&&this.it.add(t);return this.render(e)}const n=t.element.classList;this.it.forEach((t=>{t in e||(n.remove(t),this.it.delete(t))}));for(const t in e){const i=!!e[t];i===this.it.has(t)||(null===(r=this.nt)||void 0===r?void 0:r.has(t))||(i?(n.add(t),this.it.add(t)):(n.remove(t),this.it.delete(t)))}return Q}}),Mt=(t,e,i,r)=>{r=r||{},i=null==i?{}:i;const n=new Event(e,{bubbles:void 0===r.bubbles||r.bubbles,cancelable:Boolean(r.cancelable),composed:void 0===r.composed||r.composed});return n.detail=i,t.dispatchEvent(n),n},Lt=(t,e)=>{if(t===e)return!0;if(t&&e&&"object"==typeof t&&"object"==typeof e){if(t.constructor!==e.constructor)return!1;let i,r;if(Array.isArray(t)){if(r=t.length,r!==e.length)return!1;for(i=r;0!=i--;)if(!Lt(t[i],e[i]))return!1;return!0}if(t instanceof Map&&e instanceof Map){if(t.size!==e.size)return!1;for(i of t.entries())if(!e.has(i[0]))return!1;for(i of t.entries())if(!Lt(i[1],e.get(i[0])))return!1;return!0}if(t instanceof Set&&e instanceof Set){if(t.size!==e.size)return!1;for(i of t.entries())if(!e.has(i[0]))return!1;return!0}if(ArrayBuffer.isView(t)&&ArrayBuffer.isView(e)){if(r=t.length,r!==e.length)return!1;for(i=r;0!=i--;)if(t[i]!==e[i])return!1;return!0}if(t.constructor===RegExp)return t.source===e.source&&t.flags===e.flags;if(t.valueOf!==Object.prototype.valueOf)return t.valueOf()===e.valueOf();if(t.toString!==Object.prototype.toString)return t.toString()===e.toString();const n=Object.keys(t);if(r=n.length,r!==Object.keys(e).length)return!1;for(i=r;0!=i--;)if(!Object.prototype.hasOwnProperty.call(e,n[i]))return!1;for(i=r;0!=i--;){const r=n[i];if(!Lt(t[r],e[r]))return!1}return!0}return t!=t&&e!=e},Ht="ontouchstart"in window||navigator.maxTouchPoints>0||navigator.msMaxTouchPoints>0;class zt extends HTMLElement{constructor(){super(),this.holdTime=500,this.held=!1,this.cancelled=!1,this.isRepeating=!1,this.repeatCount=0,this.ripple=document.createElement("mwc-ripple")}connectedCallback(){Object.assign(this.style,{position:"fixed",width:Ht?"100px":"50px",height:Ht?"100px":"50px",transform:"translate(-50%, -50%)",pointerEvents:"none",zIndex:"999"}),this.appendChild(this.ripple),this.ripple.primary=!0,["touchcancel","mouseout","mouseup","touchmove","mousewheel","wheel","scroll"].forEach((t=>{document.addEventListener(t,(()=>{this.cancelled=!0,this.timer&&(this.stopAnimation(),clearTimeout(this.timer),this.timer=void 0,this.isRepeating&&this.repeatTimeout&&(clearInterval(this.repeatTimeout),this.isRepeating=!1))}),{passive:!0})}))}bind(t,e){t.actionHandler&&Lt(e,t.actionHandler.options)||(t.actionHandler?(t.removeEventListener("touchstart",t.actionHandler.start),t.removeEventListener("touchend",t.actionHandler.end),t.removeEventListener("touchcancel",t.actionHandler.end),t.removeEventListener("mousedown",t.actionHandler.start),t.removeEventListener("click",t.actionHandler.end),t.removeEventListener("keyup",t.actionHandler.handleEnter)):t.addEventListener("contextmenu",(t=>{const e=t||window.event;return e.preventDefault&&e.preventDefault(),e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0,e.returnValue=!1,!1})),t.actionHandler={options:e},e.disabled||(t.actionHandler.start=i=>{let r,n;this.cancelled=!1,i.touches?(r=i.touches[0].clientX,n=i.touches[0].clientY):(r=i.clientX,n=i.clientY),e.hasHold&&(this.held=!1,this.timer=window.setTimeout((()=>{this.startAnimation(r,n),this.held=!0,e.repeat&&!this.isRepeating&&(this.repeatCount=0,this.isRepeating=!0,this.repeatTimeout=setInterval((()=>{Mt(t,"action",{action:"hold"}),this.repeatCount++,this.repeatTimeout&&e.repeatLimit&&this.repeatCount>=e.repeatLimit&&(clearInterval(this.repeatTimeout),this.isRepeating=!1)}),e.repeat))}),this.holdTime))},t.actionHandler.end=t=>{if(["touchend","touchcancel"].includes(t.type)&&this.cancelled)return void(this.isRepeating&&this.repeatTimeout&&(clearInterval(this.repeatTimeout),this.isRepeating=!1));const i=t.target;t.cancelable&&t.preventDefault(),e.hasHold&&(clearTimeout(this.timer),this.isRepeating&&this.repeatTimeout&&clearInterval(this.repeatTimeout),this.isRepeating=!1,this.stopAnimation(),this.timer=void 0),e.hasHold&&this.held?e.repeat||Mt(i,"action",{action:"hold"}):e.hasDoubleClick?"click"===t.type&&t.detail<2||!this.dblClickTimeout?this.dblClickTimeout=window.setTimeout((()=>{this.dblClickTimeout=void 0,Mt(i,"action",{action:"tap"})}),250):(clearTimeout(this.dblClickTimeout),this.dblClickTimeout=void 0,Mt(i,"action",{action:"double_tap"})):Mt(i,"action",{action:"tap"})},t.actionHandler.handleEnter=t=>{13===t.keyCode&&t.currentTarget.actionHandler.end(t)},t.addEventListener("touchstart",t.actionHandler.start,{passive:!0}),t.addEventListener("touchend",t.actionHandler.end),t.addEventListener("touchcancel",t.actionHandler.end),t.addEventListener("mousedown",t.actionHandler.start,{passive:!0}),t.addEventListener("click",t.actionHandler.end),t.addEventListener("keyup",t.actionHandler.handleEnter)))}startAnimation(t,e){Object.assign(this.style,{left:`${t}px`,top:`${e}px`,display:null}),this.ripple.disabled=!1,this.ripple.startPress(),this.ripple.unbounded=!0}stopAnimation(){this.ripple.endPress(),this.ripple.disabled=!0,this.style.display="none"}}customElements.define("cblcars-button-card-action-handler",zt);const Dt=Ct(class extends kt{update(t,[e]){return((t,e)=>{const i=(()=>{const t=document.body;if(t.querySelector("cblcars-button-card-action-handler"))return t.querySelector("cblcars-button-card-action-handler");const e=document.createElement("cblcars-button-card-action-handler");return t.appendChild(e),e})();i&&i.bind(t,e)})(t.element,e),Q}render(t){}});function Nt(t,e){(function(t){return"string"==typeof t&&-1!==t.indexOf(".")&&1===parseFloat(t)})(t)&&(t="100%");var i=function(t){return"string"==typeof t&&-1!==t.indexOf("%")}(t);return t=360===e?t:Math.min(e,Math.max(0,parseFloat(t))),i&&(t=parseInt(String(t*e),10)/100),Math.abs(t-e)<1e-6?1:t=360===e?(t<0?t%e+e:t%e)/parseFloat(String(e)):t%e/parseFloat(String(e))}function Pt(t){return Math.min(1,Math.max(0,t))}function Ft(t){return t=parseFloat(t),(isNaN(t)||t<0||t>1)&&(t=1),t}function It(t){return t<=1?"".concat(100*Number(t),"%"):t}function Bt(t){return 1===t.length?"0"+t:String(t)}function Vt(t,e,i){t=Nt(t,255),e=Nt(e,255),i=Nt(i,255);var r=Math.max(t,e,i),n=Math.min(t,e,i),s=0,a=0,o=(r+n)/2;if(r===n)a=0,s=0;else{var l=r-n;switch(a=o>.5?l/(2-r-n):l/(r+n),r){case t:s=(e-i)/l+(e<i?6:0);break;case e:s=(i-t)/l+2;break;case i:s=(t-e)/l+4}s/=6}return{h:s,s:a,l:o}}function Ut(t,e,i){return i<0&&(i+=1),i>1&&(i-=1),i<1/6?t+6*i*(e-t):i<.5?e:i<2/3?t+(e-t)*(2/3-i)*6:t}function qt(t,e,i){t=Nt(t,255),e=Nt(e,255),i=Nt(i,255);var r=Math.max(t,e,i),n=Math.min(t,e,i),s=0,a=r,o=r-n,l=0===r?0:o/r;if(r===n)s=0;else{switch(r){case t:s=(e-i)/o+(e<i?6:0);break;case e:s=(i-t)/o+2;break;case i:s=(t-e)/o+4}s/=6}return{h:s,s:l,v:a}}function Wt(t,e,i,r){var n=[Bt(Math.round(t).toString(16)),Bt(Math.round(e).toString(16)),Bt(Math.round(i).toString(16))];return r&&n[0].startsWith(n[0].charAt(1))&&n[1].startsWith(n[1].charAt(1))&&n[2].startsWith(n[2].charAt(1))?n[0].charAt(0)+n[1].charAt(0)+n[2].charAt(0):n.join("")}function Gt(t){return Math.round(255*parseFloat(t)).toString(16)}function Zt(t){return Yt(t)/255}function Yt(t){return parseInt(t,16)}var Jt={aliceblue:"#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgreen:"#006400",darkgrey:"#a9a9a9",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dimgrey:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",goldenrod:"#daa520",gold:"#ffd700",gray:"#808080",green:"#008000",greenyellow:"#adff2f",grey:"#808080",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",lavenderblush:"#fff0f5",lavender:"#e6e6fa",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",lightgreen:"#90ee90",lightgrey:"#d3d3d3",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#778899",lightslategrey:"#778899",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370db",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#db7093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",rebeccapurple:"#663399",red:"#ff0000",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",slategrey:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",yellow:"#ffff00",yellowgreen:"#9acd32"};var Kt="(?:".concat("[-\\+]?\\d*\\.\\d+%?",")|(?:").concat("[-\\+]?\\d+%?",")"),Xt="[\\s|\\(]+(".concat(Kt,")[,|\\s]+(").concat(Kt,")[,|\\s]+(").concat(Kt,")\\s*\\)?"),Qt="[\\s|\\(]+(".concat(Kt,")[,|\\s]+(").concat(Kt,")[,|\\s]+(").concat(Kt,")[,|\\s]+(").concat(Kt,")\\s*\\)?"),te={CSS_UNIT:new RegExp(Kt),rgb:new RegExp("rgb"+Xt),rgba:new RegExp("rgba"+Qt),hsl:new RegExp("hsl"+Xt),hsla:new RegExp("hsla"+Qt),hsv:new RegExp("hsv"+Xt),hsva:new RegExp("hsva"+Qt),hex3:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex6:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,hex4:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex8:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/};function ee(t){return Boolean(te.CSS_UNIT.exec(String(t)))}var ie=function(){function t(e,i){var r;if(void 0===e&&(e=""),void 0===i&&(i={}),e instanceof t)return e;"number"==typeof e&&(e=function(t){return{r:t>>16,g:(65280&t)>>8,b:255&t}}(e)),this.originalInput=e;var n=function(t){var e={r:0,g:0,b:0},i=1,r=null,n=null,s=null,a=!1,o=!1;return"string"==typeof t&&(t=function(t){if(0===(t=t.trim().toLowerCase()).length)return!1;var e=!1;if(Jt[t])t=Jt[t],e=!0;else if("transparent"===t)return{r:0,g:0,b:0,a:0,format:"name"};var i=te.rgb.exec(t);return i?{r:i[1],g:i[2],b:i[3]}:(i=te.rgba.exec(t))?{r:i[1],g:i[2],b:i[3],a:i[4]}:(i=te.hsl.exec(t))?{h:i[1],s:i[2],l:i[3]}:(i=te.hsla.exec(t))?{h:i[1],s:i[2],l:i[3],a:i[4]}:(i=te.hsv.exec(t))?{h:i[1],s:i[2],v:i[3]}:(i=te.hsva.exec(t))?{h:i[1],s:i[2],v:i[3],a:i[4]}:(i=te.hex8.exec(t))?{r:Yt(i[1]),g:Yt(i[2]),b:Yt(i[3]),a:Zt(i[4]),format:e?"name":"hex8"}:(i=te.hex6.exec(t))?{r:Yt(i[1]),g:Yt(i[2]),b:Yt(i[3]),format:e?"name":"hex"}:(i=te.hex4.exec(t))?{r:Yt(i[1]+i[1]),g:Yt(i[2]+i[2]),b:Yt(i[3]+i[3]),a:Zt(i[4]+i[4]),format:e?"name":"hex8"}:!!(i=te.hex3.exec(t))&&{r:Yt(i[1]+i[1]),g:Yt(i[2]+i[2]),b:Yt(i[3]+i[3]),format:e?"name":"hex"}}(t)),"object"==typeof t&&(ee(t.r)&&ee(t.g)&&ee(t.b)?(e=function(t,e,i){return{r:255*Nt(t,255),g:255*Nt(e,255),b:255*Nt(i,255)}}(t.r,t.g,t.b),a=!0,o="%"===String(t.r).substr(-1)?"prgb":"rgb"):ee(t.h)&&ee(t.s)&&ee(t.v)?(r=It(t.s),n=It(t.v),e=function(t,e,i){t=6*Nt(t,360),e=Nt(e,100),i=Nt(i,100);var r=Math.floor(t),n=t-r,s=i*(1-e),a=i*(1-n*e),o=i*(1-(1-n)*e),l=r%6;return{r:255*[i,a,s,s,o,i][l],g:255*[o,i,i,a,s,s][l],b:255*[s,s,o,i,i,a][l]}}(t.h,r,n),a=!0,o="hsv"):ee(t.h)&&ee(t.s)&&ee(t.l)&&(r=It(t.s),s=It(t.l),e=function(t,e,i){var r,n,s;if(t=Nt(t,360),e=Nt(e,100),i=Nt(i,100),0===e)n=i,s=i,r=i;else{var a=i<.5?i*(1+e):i+e-i*e,o=2*i-a;r=Ut(o,a,t+1/3),n=Ut(o,a,t),s=Ut(o,a,t-1/3)}return{r:255*r,g:255*n,b:255*s}}(t.h,r,s),a=!0,o="hsl"),Object.prototype.hasOwnProperty.call(t,"a")&&(i=t.a)),i=Ft(i),{ok:a,format:t.format||o,r:Math.min(255,Math.max(e.r,0)),g:Math.min(255,Math.max(e.g,0)),b:Math.min(255,Math.max(e.b,0)),a:i}}(e);this.originalInput=e,this.r=n.r,this.g=n.g,this.b=n.b,this.a=n.a,this.roundA=Math.round(100*this.a)/100,this.format=null!==(r=i.format)&&void 0!==r?r:n.format,this.gradientType=i.gradientType,this.r<1&&(this.r=Math.round(this.r)),this.g<1&&(this.g=Math.round(this.g)),this.b<1&&(this.b=Math.round(this.b)),this.isValid=n.ok}return t.prototype.isDark=function(){return this.getBrightness()<128},t.prototype.isLight=function(){return!this.isDark()},t.prototype.getBrightness=function(){var t=this.toRgb();return(299*t.r+587*t.g+114*t.b)/1e3},t.prototype.getLuminance=function(){var t=this.toRgb(),e=t.r/255,i=t.g/255,r=t.b/255;return.2126*(e<=.03928?e/12.92:Math.pow((e+.055)/1.055,2.4))+.7152*(i<=.03928?i/12.92:Math.pow((i+.055)/1.055,2.4))+.0722*(r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4))},t.prototype.getAlpha=function(){return this.a},t.prototype.setAlpha=function(t){return this.a=Ft(t),this.roundA=Math.round(100*this.a)/100,this},t.prototype.isMonochrome=function(){return 0===this.toHsl().s},t.prototype.toHsv=function(){var t=qt(this.r,this.g,this.b);return{h:360*t.h,s:t.s,v:t.v,a:this.a}},t.prototype.toHsvString=function(){var t=qt(this.r,this.g,this.b),e=Math.round(360*t.h),i=Math.round(100*t.s),r=Math.round(100*t.v);return 1===this.a?"hsv(".concat(e,", ").concat(i,"%, ").concat(r,"%)"):"hsva(".concat(e,", ").concat(i,"%, ").concat(r,"%, ").concat(this.roundA,")")},t.prototype.toHsl=function(){var t=Vt(this.r,this.g,this.b);return{h:360*t.h,s:t.s,l:t.l,a:this.a}},t.prototype.toHslString=function(){var t=Vt(this.r,this.g,this.b),e=Math.round(360*t.h),i=Math.round(100*t.s),r=Math.round(100*t.l);return 1===this.a?"hsl(".concat(e,", ").concat(i,"%, ").concat(r,"%)"):"hsla(".concat(e,", ").concat(i,"%, ").concat(r,"%, ").concat(this.roundA,")")},t.prototype.toHex=function(t){return void 0===t&&(t=!1),Wt(this.r,this.g,this.b,t)},t.prototype.toHexString=function(t){return void 0===t&&(t=!1),"#"+this.toHex(t)},t.prototype.toHex8=function(t){return void 0===t&&(t=!1),function(t,e,i,r,n){var s=[Bt(Math.round(t).toString(16)),Bt(Math.round(e).toString(16)),Bt(Math.round(i).toString(16)),Bt(Gt(r))];return n&&s[0].startsWith(s[0].charAt(1))&&s[1].startsWith(s[1].charAt(1))&&s[2].startsWith(s[2].charAt(1))&&s[3].startsWith(s[3].charAt(1))?s[0].charAt(0)+s[1].charAt(0)+s[2].charAt(0)+s[3].charAt(0):s.join("")}(this.r,this.g,this.b,this.a,t)},t.prototype.toHex8String=function(t){return void 0===t&&(t=!1),"#"+this.toHex8(t)},t.prototype.toHexShortString=function(t){return void 0===t&&(t=!1),1===this.a?this.toHexString(t):this.toHex8String(t)},t.prototype.toRgb=function(){return{r:Math.round(this.r),g:Math.round(this.g),b:Math.round(this.b),a:this.a}},t.prototype.toRgbString=function(){var t=Math.round(this.r),e=Math.round(this.g),i=Math.round(this.b);return 1===this.a?"rgb(".concat(t,", ").concat(e,", ").concat(i,")"):"rgba(".concat(t,", ").concat(e,", ").concat(i,", ").concat(this.roundA,")")},t.prototype.toPercentageRgb=function(){var t=function(t){return"".concat(Math.round(100*Nt(t,255)),"%")};return{r:t(this.r),g:t(this.g),b:t(this.b),a:this.a}},t.prototype.toPercentageRgbString=function(){var t=function(t){return Math.round(100*Nt(t,255))};return 1===this.a?"rgb(".concat(t(this.r),"%, ").concat(t(this.g),"%, ").concat(t(this.b),"%)"):"rgba(".concat(t(this.r),"%, ").concat(t(this.g),"%, ").concat(t(this.b),"%, ").concat(this.roundA,")")},t.prototype.toName=function(){if(0===this.a)return"transparent";if(this.a<1)return!1;for(var t="#"+Wt(this.r,this.g,this.b,!1),e=0,i=Object.entries(Jt);e<i.length;e++){var r=i[e],n=r[0];if(t===r[1])return n}return!1},t.prototype.toString=function(t){var e=Boolean(t);t=null!=t?t:this.format;var i=!1,r=this.a<1&&this.a>=0;return e||!r||!t.startsWith("hex")&&"name"!==t?("rgb"===t&&(i=this.toRgbString()),"prgb"===t&&(i=this.toPercentageRgbString()),"hex"!==t&&"hex6"!==t||(i=this.toHexString()),"hex3"===t&&(i=this.toHexString(!0)),"hex4"===t&&(i=this.toHex8String(!0)),"hex8"===t&&(i=this.toHex8String()),"name"===t&&(i=this.toName()),"hsl"===t&&(i=this.toHslString()),"hsv"===t&&(i=this.toHsvString()),i||this.toHexString()):"name"===t&&0===this.a?this.toName():this.toRgbString()},t.prototype.toNumber=function(){return(Math.round(this.r)<<16)+(Math.round(this.g)<<8)+Math.round(this.b)},t.prototype.clone=function(){return new t(this.toString())},t.prototype.lighten=function(e){void 0===e&&(e=10);var i=this.toHsl();return i.l+=e/100,i.l=Pt(i.l),new t(i)},t.prototype.brighten=function(e){void 0===e&&(e=10);var i=this.toRgb();return i.r=Math.max(0,Math.min(255,i.r-Math.round(-e/100*255))),i.g=Math.max(0,Math.min(255,i.g-Math.round(-e/100*255))),i.b=Math.max(0,Math.min(255,i.b-Math.round(-e/100*255))),new t(i)},t.prototype.darken=function(e){void 0===e&&(e=10);var i=this.toHsl();return i.l-=e/100,i.l=Pt(i.l),new t(i)},t.prototype.tint=function(t){return void 0===t&&(t=10),this.mix("white",t)},t.prototype.shade=function(t){return void 0===t&&(t=10),this.mix("black",t)},t.prototype.desaturate=function(e){void 0===e&&(e=10);var i=this.toHsl();return i.s-=e/100,i.s=Pt(i.s),new t(i)},t.prototype.saturate=function(e){void 0===e&&(e=10);var i=this.toHsl();return i.s+=e/100,i.s=Pt(i.s),new t(i)},t.prototype.greyscale=function(){return this.desaturate(100)},t.prototype.spin=function(e){var i=this.toHsl(),r=(i.h+e)%360;return i.h=r<0?360+r:r,new t(i)},t.prototype.mix=function(e,i){void 0===i&&(i=50);var r=this.toRgb(),n=new t(e).toRgb(),s=i/100;return new t({r:(n.r-r.r)*s+r.r,g:(n.g-r.g)*s+r.g,b:(n.b-r.b)*s+r.b,a:(n.a-r.a)*s+r.a})},t.prototype.analogous=function(e,i){void 0===e&&(e=6),void 0===i&&(i=30);var r=this.toHsl(),n=360/i,s=[this];for(r.h=(r.h-(n*e>>1)+720)%360;--e;)r.h=(r.h+n)%360,s.push(new t(r));return s},t.prototype.complement=function(){var e=this.toHsl();return e.h=(e.h+180)%360,new t(e)},t.prototype.monochromatic=function(e){void 0===e&&(e=6);for(var i=this.toHsv(),r=i.h,n=i.s,s=i.v,a=[],o=1/e;e--;)a.push(new t({h:r,s:n,v:s})),s=(s+o)%1;return a},t.prototype.splitcomplement=function(){var e=this.toHsl(),i=e.h;return[this,new t({h:(i+72)%360,s:e.s,l:e.l}),new t({h:(i+216)%360,s:e.s,l:e.l})]},t.prototype.onBackground=function(e){var i=this.toRgb(),r=new t(e).toRgb(),n=i.a+r.a*(1-i.a);return new t({r:(i.r*i.a+r.r*r.a*(1-i.a))/n,g:(i.g*i.a+r.g*r.a*(1-i.a))/n,b:(i.b*i.a+r.b*r.a*(1-i.a))/n,a:n})},t.prototype.triad=function(){return this.polyad(3)},t.prototype.tetrad=function(){return this.polyad(4)},t.prototype.polyad=function(e){for(var i=this.toHsl(),r=i.h,n=[this],s=360/e,a=1;a<e;a++)n.push(new t({h:(r+a*s)%360,s:i.s,l:i.l}));return n},t.prototype.equals=function(e){return this.toRgbString()===new t(e).toRgbString()},t}();function re(t,e){return void 0===t&&(t=""),void 0===e&&(e={}),new ie(t,e)}const ne="unavailable",se=(ae=[ne,"unknown"],(t,e)=>ae.includes(t,e));var ae;const oe=new Set(["fan","input_boolean","light","switch","group","automation","humidifier"]),le=["auto","auto-no-temperature"],ce=["card","label-card"],ue=["--ha-card-background","--card-background-color"],de="var(--primary-text-color)";function he(t){return t.substr(0,t.indexOf("."))}function fe(t,e){const i=[];let r=e;return"var"===e.trim().substring(0,3)&&(e.split(",").forEach((t=>{const e=t.match(/var\(\s*([a-zA-Z0-9-]*)/);e&&i.push(e[1])})),i.some((e=>{const i=window.getComputedStyle(t).getPropertyValue(e);return!!i&&(r=i,!0)}))),r}function pe(...t){const e=t=>t&&"object"==typeof t;return t.reduce(((t,i)=>(Object.keys(i).forEach((r=>{const n=t[r],s=i[r];Array.isArray(n)&&Array.isArray(s)?t[r]=n.concat(...s):e(n)&&e(s)?t[r]=pe(n,s):t[r]=s})),t)),{})}function me(t,e){let i=[];return t&&t.forEach((t=>{let r=t;e&&e.forEach((e=>{e.id&&t.id&&e.id==t.id&&(r=pe(r,e))})),i.push(r)})),e&&(i=i.concat(e.filter((e=>!t||!t.find((t=>!(!t.id||!e.id)&&t.id==e.id)))))),i}function ge(t,e){if(void 0===t)return!1;const i=he(t.entity_id),r=void 0!==e?e:null==t?void 0:t.state;if(["button","event","input_button","scene"].includes(i))return r!==ne;if(se(r))return!1;if("off"===r&&"alert"!==i)return!1;switch(i){case"alarm_control_panel":return"disarmed"!==r;case"alert":return"idle"!==r;case"cover":return"closed"!==r;case"device_tracker":case"person":return"not_home"!==r;case"lock":return"locked"!==r;case"media_player":return"standby"!==r;case"vacuum":return!["idle","docked","paused"].includes(r);case"plant":return"problem"===r;case"group":return["on","home","open","locked","problem"].includes(r);case"timer":return"active"===r;case"camera":return"streaming"===r}return!0}function _e(t){return Array.isArray(t)?t.reverse().reduce(((t,e)=>`var(${e}${t?`, ${t}`:""})`),void 0):`var(${t})`}function be(t){const e=t.split(":").map(Number);return 3600*e[0]+60*e[1]+e[2]}const ve=t=>t<10?`0${t}`:t,ye=new Set(["call-service","divider","section","weblink","cast","select"]),we={alert:"toggle",automation:"toggle",climate:"climate",cover:"cover",fan:"toggle",group:"group",input_boolean:"toggle",input_number:"input-number",input_select:"input-select",input_text:"input-text",light:"toggle",lock:"lock",media_player:"media-player",remote:"toggle",scene:"scene",script:"script",sensor:"sensor",timer:"timer",switch:"toggle",vacuum:"toggle",water_heater:"climate",input_datetime:"input-datetime"},$e=((t,...e)=>{const i=1===t.length?t[0]:e.reduce(((e,i,r)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[r+1]),t[0]);return new y(i,t,b)})`
  :host {
    position: relative;
    display: block;
    --state-inactive-color: var(--paper-item-icon-color);
  }
  ha-card {
    cursor: pointer;
    overflow: hidden;
    box-sizing: border-box;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    line-height: normal;

    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently
                          supported by Chrome, Opera and Firefox */
  }
  ha-card.disabled {
    pointer-events: none;
    cursor: default;
  }
  :host(.tooltip) .tooltiptext {
    pointer-events: none;
    opacity: 0;
    text-align: center;
    padding: 4px;
    border-radius: var(--ha-card-border-radius, 4px);
    box-shadow: var(
      --ha-card-box-shadow,
      0px 2px 1px -1px rgba(0, 0, 0, 0.2),
      0px 1px 1px 0px rgba(0, 0, 0, 0.14),
      0px 1px 3px 0px rgba(0, 0, 0, 0.12)
    );
    background: var(--ha-card-background, var(--card-background-color, white));
    border: 1px solid var(--primary-text-color);
    color: var(--primary-text-color);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  :host(.tooltip:hover) span.tooltiptext {
    opacity: 1;
    transition-delay: 1.5s;
  }
  :not(ha-state-icon) ha-icon,
  ha-state-icon {
    display: inline-block;
    margin: auto;
    --mdc-icon-size: 100%;
    --iron-icon-width: 100%;
    --iron-icon-height: 100%;
  }
  ha-card.button-card-main {
    padding: 4% 0px;
    text-transform: none;
    font-weight: 400;
    font-size: 1.2rem;
    align-items: center;
    text-align: center;
    letter-spacing: normal;
    width: 100%;
  }
  .ellipsis {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  #overlay {
    align-items: flex-start;
    justify-content: flex-end;
    padding: 8px 7px;
    opacity: 0.5;
    /* DO NOT override items below */
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
  }
  #lock {
    -webkit-animation-fill-mode: both;
    animation-fill-mode: both;
    margin: unset;
    width: 24px;
  }
  .invalid {
    animation: blink 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
  }
  .hidden {
    visibility: hidden;
    opacity: 0;
    transition: visibility 0s 1s, opacity 1s linear;
  }
  @keyframes blink {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  @-webkit-keyframes rotating /* Safari and Chrome */ {
    from {
      -webkit-transform: rotate(0deg);
      -o-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    to {
      -webkit-transform: rotate(360deg);
      -o-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
  @keyframes rotating {
    from {
      -ms-transform: rotate(0deg);
      -moz-transform: rotate(0deg);
      -webkit-transform: rotate(0deg);
      -o-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    to {
      -ms-transform: rotate(360deg);
      -moz-transform: rotate(360deg);
      -webkit-transform: rotate(360deg);
      -o-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
  [rotating] {
    -webkit-animation: rotating 2s linear infinite;
    -moz-animation: rotating 2s linear infinite;
    -ms-animation: rotating 2s linear infinite;
    -o-animation: rotating 2s linear infinite;
    animation: rotating 2s linear infinite;
  }

  #container {
    display: grid;
    width: 100%;
    height: 100%;
    text-align: center;
    align-items: center;
  }
  #img-cell {
    display: flex;
    grid-area: i;
    height: 100%;
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    align-self: center;
    justify-self: center;
    overflow: hidden;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  ha-state-icon#icon {
    height: 100%;
    width: 100%;
    max-height: 100%;
    position: absolute;
  }
  img#icon {
    display: block;
    height: auto;
    width: 100%;
    position: absolute;
  }
  #name {
    grid-area: n;
    max-width: 100%;
    align-self: center;
    justify-self: center;
    /* margin: auto; */
  }
  #state {
    grid-area: s;
    max-width: 100%;
    align-self: center;
    justify-self: center;
    /* margin: auto; */
  }

  #label {
    grid-area: l;
    max-width: 100%;
    align-self: center;
    justify-self: center;
  }

  #container.vertical {
    grid-template-areas: 'i' 'n' 's' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr min-content min-content min-content;
  }
  /* Vertical No Icon */
  #container.vertical.no-icon {
    grid-template-areas: 'n' 's' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr min-content 1fr;
  }
  #container.vertical.no-icon #state {
    align-self: center;
  }
  #container.vertical.no-icon #name {
    align-self: end;
  }
  #container.vertical.no-icon #label {
    align-self: start;
  }

  /* Vertical No Icon No Name */
  #container.vertical.no-icon.no-name {
    grid-template-areas: 's' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.vertical.no-icon.no-name #state {
    align-self: end;
  }
  #container.vertical.no-icon.no-name #label {
    align-self: start;
  }

  /* Vertical No Icon No State */
  #container.vertical.no-icon.no-state {
    grid-template-areas: 'n' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.vertical.no-icon.no-state #name {
    align-self: end;
  }
  #container.vertical.no-icon.no-state #label {
    align-self: start;
  }

  /* Vertical No Icon No Label */
  #container.vertical.no-icon.no-label {
    grid-template-areas: 'n' 's';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.vertical.no-icon.no-label #name {
    align-self: end;
  }
  #container.vertical.no-icon.no-label #state {
    align-self: start;
  }

  /* Vertical No Icon No Label No Name */
  #container.vertical.no-icon.no-label.no-name {
    grid-template-areas: 's';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  #container.vertical.no-icon.no-label.no-name #state {
    align-self: center;
  }
  /* Vertical No Icon No Label No State */
  #container.vertical.no-icon.no-label.no-state {
    grid-template-areas: 'n';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  #container.vertical.no-icon.no-label.no-state #name {
    align-self: center;
  }

  /* Vertical No Icon No Name No State */
  #container.vertical.no-icon.no-name.no-state {
    grid-template-areas: 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  #container.vertical.no-icon.no-name.no-state #label {
    align-self: center;
  }

  #container.icon_name_state {
    grid-template-areas: 'i n' 'l l';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content;
  }

  #container.icon_name {
    grid-template-areas: 'i n' 's s' 'l l';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content min-content;
  }

  #container.icon_state {
    grid-template-areas: 'i s' 'n n' 'l l';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content min-content;
  }

  #container.name_state {
    grid-template-areas: 'i' 'n' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr min-content min-content;
  }
  #container.name_state.no-icon {
    grid-template-areas: 'n' 'l';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.name_state.no-icon #name {
    align-self: end;
  }
  #container.name_state.no-icon #label {
    align-self: start;
  }

  #container.name_state.no-icon.no-label {
    grid-template-areas: 'n';
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  #container.name_state.no-icon.no-label #name {
    align-self: center;
  }

  /* icon_name_state2nd default */
  #container.icon_name_state2nd {
    grid-template-areas: 'i n' 'i s' 'i l';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content 1fr;
  }
  #container.icon_name_state2nd #name {
    align-self: end;
  }
  #container.icon_name_state2nd #state {
    align-self: center;
  }
  #container.icon_name_state2nd #label {
    align-self: start;
  }

  /* icon_name_state2nd No Label */
  #container.icon_name_state2nd.no-label {
    grid-template-areas: 'i n' 'i s';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.icon_name_state2nd #name {
    align-self: end;
  }
  #container.icon_name_state2nd #state {
    align-self: start;
  }

  /* icon_state_name2nd Default */
  #container.icon_state_name2nd {
    grid-template-areas: 'i s' 'i n' 'i l';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content 1fr;
  }
  #container.icon_state_name2nd #state {
    align-self: end;
  }
  #container.icon_state_name2nd #name {
    align-self: center;
  }
  #container.icon_state_name2nd #label {
    align-self: start;
  }

  /* icon_state_name2nd No Label */
  #container.icon_state_name2nd.no-label {
    grid-template-areas: 'i s' 'i n';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr 1fr;
  }
  #container.icon_state_name2nd #state {
    align-self: end;
  }
  #container.icon_state_name2nd #name {
    align-self: start;
  }

  #container.icon_label {
    grid-template-areas: 'i l' 'n n' 's s';
    grid-template-columns: 40% 1fr;
    grid-template-rows: 1fr min-content min-content;
  }

  [style*='--aspect-ratio'] > :first-child {
    width: 100%;
  }
  [style*='--aspect-ratio'] > img {
    height: auto;
  }
  @supports (--custom: property) {
    [style*='--aspect-ratio'] {
      position: relative;
    }
    [style*='--aspect-ratio']::before {
      content: '';
      display: block;
      padding-bottom: calc(100% / (var(--aspect-ratio)));
    }
    [style*='--aspect-ratio'] > :first-child {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
    }
  }
`;var Se,Ae,Ce,ke,xe;!function(t){t.language="language",t.system="system",t.comma_decimal="comma_decimal",t.decimal_comma="decimal_comma",t.space_comma="space_comma",t.none="none"}(Se||(Se={})),function(t){t.language="language",t.system="system",t.am_pm="12",t.twenty_four="24"}(Ae||(Ae={})),function(t){t.local="local",t.server="server"}(Ce||(Ce={})),function(t){t.language="language",t.system="system",t.DMY="DMY",t.MDY="MDY",t.YMD="YMD"}(ke||(ke={})),function(t){t.language="language",t.monday="monday",t.tuesday="tuesday",t.wednesday="wednesday",t.thursday="thursday",t.friday="friday",t.saturday="saturday",t.sunday="sunday"}(xe||(xe={}));const Oe=(t,e,i)=>{const r=e?(t=>{switch(t.number_format){case Se.comma_decimal:return["en-US","en"];case Se.decimal_comma:return["de","es","it"];case Se.space_comma:return["fr","sv","cs"];case Se.system:return;default:return t.language}})(e):void 0;if(Number.isNaN=Number.isNaN||function t(e){return"number"==typeof e&&t(e)},(null==e?void 0:e.number_format)!==Se.none&&!Number.isNaN(Number(t))&&Intl)try{return new Intl.NumberFormat(r,Te(t,i)).format(Number(t))}catch(e){return console.error(e),new Intl.NumberFormat(void 0,Te(t,i)).format(Number(t))}return"string"==typeof t?t:`${((t,e=2)=>Math.round(t*10**e)/10**e)(t,null==i?void 0:i.maximumFractionDigits).toString()}${"currency"===(null==i?void 0:i.style)?` ${i.currency}`:""}`},Ee=(t,e,i)=>{var r;let n=null==i?void 0:i.display_precision;return void 0!==e&&(n=e),null!=n?{maximumFractionDigits:n,minimumFractionDigits:n}:Number.isInteger(Number(null===(r=t.attributes)||void 0===r?void 0:r.step))&&Number.isInteger(Number(t.state))?{maximumFractionDigits:0}:null!=t.attributes.step?{maximumFractionDigits:Math.ceil(Math.log10(1/t.attributes.step))}:void 0},Te=(t,e)=>{const i=Object.assign({maximumFractionDigits:2},e);if("string"!=typeof t)return i;if(!e||void 0===e.minimumFractionDigits&&void 0===e.maximumFractionDigits){const e=t.indexOf(".")>-1?t.split(".")[1].length:0;i.minimumFractionDigits=e,i.maximumFractionDigits=e}return i};var Re,je,Me,Le,He;!function(t){t.language="language",t.system="system",t.comma_decimal="comma_decimal",t.decimal_comma="decimal_comma",t.space_comma="space_comma",t.none="none"}(Re||(Re={})),function(t){t.language="language",t.system="system",t.am_pm="12",t.twenty_four="24"}(je||(je={})),function(t){t.local="local",t.server="server"}(Me||(Me={})),function(t){t.language="language",t.system="system",t.DMY="DMY",t.MDY="MDY",t.YMD="YMD"}(Le||(Le={})),function(t){t.language="language",t.monday="monday",t.tuesday="tuesday",t.wednesday="wednesday",t.thursday="thursday",t.friday="friday",t.saturday="saturday",t.sunday="sunday"}(He||(He={}));const ze=(t,e=2)=>{let i=""+t;for(let t=1;t<e;t++)i=parseInt(i)<10**t?`0${i}`:i;return i},De={ms:1,s:1e3,min:6e4,h:36e5,d:864e5};var Ne=Number.isNaN||function(t){return"number"==typeof t&&t!=t};function Pe(t,e){if(t.length!==e.length)return!1;for(var i=0;i<t.length;i++)if(!((r=t[i])===(n=e[i])||Ne(r)&&Ne(n)))return!1;var r,n;return!0}function Fe(t,e){void 0===e&&(e=Pe);var i=null;function r(){for(var r=[],n=0;n<arguments.length;n++)r[n]=arguments[n];if(i&&i.lastThis===this&&e(r,i.lastArgs))return i.lastResult;var s=t.apply(this,r);return i={lastResult:s,lastArgs:r,lastThis:this},s}return r.clear=function(){i=null},r}const Ie=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{weekday:"long",month:"long",day:"numeric",timeZone:"server"===t.time_zone?e:void 0}))),Be=(t,e,i)=>Ve(e,i.time_zone).format(t),Ve=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{year:"numeric",month:"long",day:"numeric",timeZone:"server"===t.time_zone?e:void 0}))),Ue=(t,e,i)=>{var r,n,s,a;const o=qe(e,i.time_zone);if(e.date_format===ke.language||e.date_format===ke.system)return o.format(t);const l=o.formatToParts(t),c=null===(r=l.find((t=>"literal"===t.type)))||void 0===r?void 0:r.value,u=null===(n=l.find((t=>"day"===t.type)))||void 0===n?void 0:n.value,d=null===(s=l.find((t=>"month"===t.type)))||void 0===s?void 0:s.value,h=null===(a=l.find((t=>"year"===t.type)))||void 0===a?void 0:a.value,f=l[l.length-1];let p="literal"===(null==f?void 0:f.type)?null==f?void 0:f.value:"";return"bg"===e.language&&e.date_format===ke.YMD&&(p=""),{[ke.DMY]:`${u}${c}${d}${c}${h}${p}`,[ke.MDY]:`${d}${c}${u}${c}${h}${p}`,[ke.YMD]:`${h}${c}${d}${c}${u}${p}`}[e.date_format]},qe=Fe(((t,e)=>{const i=t.date_format===ke.system?void 0:t.language;return t.date_format===ke.language||(t.date_format,ke.system),new Intl.DateTimeFormat(i,{year:"numeric",month:"numeric",day:"numeric",timeZone:"server"===t.time_zone?e:void 0})})),We=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{day:"numeric",month:"short",timeZone:"server"===t.time_zone?e:void 0}))),Ge=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{month:"long",year:"numeric",timeZone:"server"===t.time_zone?e:void 0}))),Ze=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{month:"long",timeZone:"server"===t.time_zone?e:void 0}))),Ye=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{year:"numeric",timeZone:"server"===t.time_zone?e:void 0}))),Je=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{weekday:"long",timeZone:"server"===t.time_zone?e:void 0}))),Ke=Fe(((t,e)=>new Intl.DateTimeFormat(t.language,{weekday:"short",timeZone:"server"===t.time_zone?e:void 0}))),Xe=Fe((t=>{if(t.time_format===Ae.language||t.time_format===Ae.system){const e=t.time_format===Ae.language?t.language:void 0,i=(new Date).toLocaleString(e);return i.includes("AM")||i.includes("PM")}return t.time_format===Ae.am_pm})),Qe=(t,e,i)=>ti(e,i.time_zone).format(t),ti=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{hour:"numeric",minute:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),ei=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",second:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),ii=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{weekday:"long",hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),ri=Fe(((t,e)=>new Intl.DateTimeFormat("en-GB",{hour:"numeric",minute:"2-digit",hour12:!1,timeZone:"server"===t.time_zone?e:void 0}))),ni=(t,e,i)=>si(e,i.time_zone).format(t),si=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{year:"numeric",month:"long",day:"numeric",hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),ai=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{year:"numeric",month:"short",day:"numeric",hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),oi=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{month:"short",day:"numeric",hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),li=Fe(((t,e)=>new Intl.DateTimeFormat("en"!==t.language||Xe(t)?t.language:"en-u-hc-h23",{year:"numeric",month:"long",day:"numeric",hour:Xe(t)?"numeric":"2-digit",minute:"2-digit",second:"2-digit",hour12:Xe(t),timeZone:"server"===t.time_zone?e:void 0}))),ci=(t,e)=>!!(t.supported_features&e),ui=(t,e,i,r,n,s,a)=>{const o=n[e.entity_id];return di(t,i,r,o,e.entity_id,e.attributes,s,void 0!==a?a:e.state)},di=(t,e,i,r,n,s,a,o)=>{var l;if("unknown"===o||"unavailable"===o)return t(`state.default.${o}`);if(function(t){return!!t.unit_of_measurement||!!t.state_class}(s)){if("duration"===s.device_class&&s.unit_of_measurement&&De[s.unit_of_measurement])try{return((t,e)=>function(t){const e=Math.floor(t/1e3/3600),i=Math.floor(t/1e3%3600/60),r=Math.floor(t/1e3%3600%60),n=Math.floor(t%1e3);return e>0?`${e}:${ze(i)}:${ze(r)}`:i>0?`${i}:${ze(r)}`:r>0||n>0?`${r}${n>0?`.${ze(n,3)}`:""}`:null}(parseFloat(t)*De[e])||"0")(o,s.unit_of_measurement)}catch(t){}if("monetary"===s.device_class)try{return Oe(o,e,Object.assign({style:"currency",currency:(null==a?void 0:a.units)||s.unit_of_measurement,minimumFractionDigits:2},Ee({state:o,attributes:s},null==a?void 0:a.numeric_precision,r)))}catch(t){}const t=(null==a?void 0:a.show_units)?(null==a?void 0:a.units)?null==a?void 0:a.units:s.unit_of_measurement:void 0,i=t?"%"===t?(t=>{switch(t.language){case"cz":case"de":case"fi":case"fr":case"sk":case"sv":return" ";default:return""}})(e)+"%":` ${t}`:"";return`${Oe(o,e,Ee({state:o,attributes:s},null==a?void 0:a.numeric_precision,r))}${i}`}const c=he(n);if("datetime"===c){const t=new Date(o);return ni(t,e,i)}if(["date","input_datetime","time"].includes(c))try{const t=o.split(" ");if(2===t.length)return ni(new Date(t.join("T")),Object.assign(Object.assign({},e),{time_zone:Me.local}),i);if(1===t.length){if(o.includes("-"))return Be(new Date(`${o}T00:00`),Object.assign(Object.assign({},e),{time_zone:Me.local}),i);if(o.includes(":")){const t=new Date;return Qe(new Date(`${t.toISOString().split("T")[0]}T${o}`),Object.assign(Object.assign({},e),{time_zone:Me.local}),i)}}return o}catch(t){return o}if("counter"===c||"number"===c||"input_number"===c)return Oe(o,e,Ee({state:o,attributes:s},null==a?void 0:a.numeric_precision,r));if(["button","event","input_button","scene","stt","tts"].includes(c)||"sensor"===c&&"timestamp"===s.device_class)try{return ni(new Date(o),e,i)}catch(t){return o}return"update"===c?"on"===o?(t=>(t=>ci(t,4)&&"number"==typeof t.in_progress)(t)||!!t.in_progress)(s)?ci(s,4)&&"number"==typeof s.in_progress?t("ui.card.update.installing_with_progress",{progress:s.in_progress}):t("ui.card.update.installing"):s.latest_version:s.skipped_version===s.latest_version?null!==(l=s.latest_version)&&void 0!==l?l:t("state.default.unavailable"):t("ui.card.update.up_to_date"):(null==r?void 0:r.translation_key)&&t(`component.${r.platform}.entity.${c}.${r.translation_key}.state.${o}`)||s.device_class&&t(`component.${c}.entity_component.${s.device_class}.state.${o}`)||t(`component.${c}.entity_component._.state.${o}`)||o};var hi=Function.prototype.toString,fi=Object.create,pi=Object.defineProperty,mi=Object.getOwnPropertyDescriptor,gi=Object.getOwnPropertyNames,_i=Object.getOwnPropertySymbols,bi=Object.getPrototypeOf,vi=Object.prototype,yi=vi.hasOwnProperty,wi=vi.propertyIsEnumerable,$i="function"==typeof _i,Si="function"==typeof WeakMap,Ai=function(){if(Si)return function(){return new WeakMap};var t=function(){function t(){this._keys=[],this._values=[]}return t.prototype.has=function(t){return!!~this._keys.indexOf(t)},t.prototype.get=function(t){return this._values[this._keys.indexOf(t)]},t.prototype.set=function(t,e){this._keys.push(t),this._values.push(e)},t}();return function(){return new t}}(),Ci=function(t,e){var i=t.__proto__||bi(t);if(!i)return fi(null);var r=i.constructor;if(r===e.Object)return i===e.Object.prototype?{}:fi(i);if(~hi.call(r).indexOf("[native code]"))try{return new r}catch(t){}return fi(i)},ki=function(t,e,i,r){var n=Ci(t,e);for(var s in r.set(t,n),t)yi.call(t,s)&&(n[s]=i(t[s],r));if($i)for(var a=_i(t),o=0,l=a.length,c=void 0;o<l;++o)c=a[o],wi.call(t,c)&&(n[c]=i(t[c],r));return n},xi=function(t,e,i,r){var n=Ci(t,e);r.set(t,n);for(var s=$i?gi(t).concat(_i(t)):gi(t),a=0,o=s.length,l=void 0,c=void 0;a<o;++a)if("callee"!==(l=s[a])&&"caller"!==l)if(c=mi(t,l)){c.get||c.set||(c.value=i(t[l],r));try{pi(n,l,c)}catch(t){n[l]=c.value}}else n[l]=i(t[l],r);return n},Oi=Array.isArray,Ei=Object.getPrototypeOf,Ti=function(){return"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==i.g?i.g:(console&&console.error&&console.error('Unable to locate global object, returning "this".'),this)}();function Ri(t,e){var i=!(!e||!e.isStrict),r=e&&e.realm||Ti,n=i?xi:ki,s=function(t,e){if(!t||"object"!=typeof t)return t;if(e.has(t))return e.get(t);var a,o,l,c=t.__proto__||Ei(t),u=c&&c.constructor;if(!u||u===r.Object)return n(t,r,s,e);if(Oi(t)){if(i)return xi(t,r,s,e);a=new u,e.set(t,a);for(var d=0,h=t.length;d<h;++d)a[d]=s(t[d],e);return a}if(t instanceof r.Date)return new u(t.getTime());if(t instanceof r.RegExp)return(a=new u(t.source,t.flags||(l="",(o=t).global&&(l+="g"),o.ignoreCase&&(l+="i"),o.multiline&&(l+="m"),o.unicode&&(l+="u"),o.sticky&&(l+="y"),l))).lastIndex=t.lastIndex,a;if(r.Map&&t instanceof r.Map)return a=new u,e.set(t,a),t.forEach((function(t,i){a.set(i,s(t,e))})),a;if(r.Set&&t instanceof r.Set)return a=new u,e.set(t,a),t.forEach((function(t){a.add(s(t,e))})),a;if(r.Blob&&t instanceof r.Blob)return t.slice(0,t.size,t.type);if(r.Buffer&&r.Buffer.isBuffer(t))return a=r.Buffer.allocUnsafe?r.Buffer.allocUnsafe(t.length):new u(t.length),e.set(t,a),t.copy(a),a;if(r.ArrayBuffer){if(r.ArrayBuffer.isView(t))return a=new u(t.buffer.slice(0)),e.set(t,a),a;if(t instanceof r.ArrayBuffer)return a=t.slice(0),e.set(t,a),a}return"function"==typeof t.then||t instanceof Error||r.WeakMap&&t instanceof r.WeakMap||r.WeakSet&&t instanceof r.WeakSet?t:n(t,r,s,e)};return s(t,Ai())}Ri.default=Ri,Ri.strict=function(t,e){return Ri(t,{isStrict:!0,realm:e?e.realm:void 0})};const ji=new Set(["alarm_control_panel","alert","automation","binary_sensor","calendar","camera","climate","cover","device_tracker","fan","group","humidifier","input_boolean","light","lock","media_player","person","plant","remote","schedule","script","siren","sun","switch","timer","update","vacuum"]),Mi=(t,e,i)=>{if((void 0!==e?e:null==t?void 0:t.state)===ne)return"var(--state-unavailable-color)";const r=Hi(t,e,i);return r?_e(r):void 0},Li=(t,e,i,r)=>{const n=void 0!==i?i:e.state,s=ge(e,i),a=[],o=function(t,e="_"){const i="àáäâãåăæąçćčđďèéěėëêęğǵḧìíïîįłḿǹńňñòóöôœøṕŕřßşśšșťțùúüûǘůűūųẃẍÿýźžż·/_,:;",r=`aaaaaaaaacccddeeeeeeegghiiiiilmnnnnooooooprrsssssttuuuuuuuuuwxyyzzz${e}${e}${e}${e}${e}${e}`,n=new RegExp(i.split("").join("|"),"g");return t.toString().toLowerCase().replace(/\s+/g,e).replace(n,(t=>r.charAt(i.indexOf(t)))).replace(/&/g,`${e}and${e}`).replace(/[^\w-]+/g,"").replace(/-/g,e).replace(new RegExp(`(${e})\\1+`,"g"),"$1").replace(new RegExp(`^${e}+`),"").replace(new RegExp(`${e}+$`),"")}(n,"_"),l=s?"active":"inactive";if(r&&ce.includes(r)&&"inactive"==l)return ue;const c=e.attributes.device_class;return c&&a.push(`--state-${t}-${c}-${o}-color`),a.push(`--state-${t}-${o}-color`,`--state-${t}-${l}-color`,`--state-${l}-color`),a},Hi=(t,e,i)=>{const r=void 0!==e?e:null==t?void 0:t.state,n=he(t.entity_id),s=t.attributes.device_class;if("sensor"===n&&"battery"===s){const t=(t=>{const e=Number(t);if(!isNaN(e))return e>=70?"--state-sensor-battery-high-color":e>=30?"--state-sensor-battery-medium-color":"--state-sensor-battery-low-color"})(r);if(t)return[t]}if("group"===n){const r=(t=>{const e=t.attributes.entity_id||[],i=[...new Set(e.map((t=>he(t))))];return 1===i.length?i[0]:void 0})(t);if(r&&ji.has(r))return Li(r,t,e,i)}return ji.has(n)?Li(n,t,e,i):i&&ce.includes(i)?ue:void 0};let zi=window.cardHelpers;const Di=new Promise((async t=>{zi&&t(),window.loadCardHelpers&&(zi=await window.loadCardHelpers(),window.cardHelpers=zi,t())}));console.info("%c  BUTTON-CARD (mod for CB-LCARS)  \n%c Version 4.1.2-cblcars.3 ","color: white; font-weight: bold; background: #37a6d1","color: white; font-weight: bold; background: #37a6d1");let Ni,Pi,Fi=class extends _t{constructor(){super(...arguments),this._cards={},this._cardsConfig={},this._entities=[],this._initialSetupComplete=!1,this._rippleHandlers=new At((()=>this._ripple))}get _doIHaveEverything(){return!!this._hass&&!!this._config&&this.isConnected}set hass(t){this._hass=t,Object.keys(this._cards).forEach((t=>{this._cards[t].hass=this._hass})),this._initialSetupComplete||this._finishSetup()}disconnectedCallback(){super.disconnectedCallback(),this._clearInterval()}connectedCallback(){super.connectedCallback(),this._initialSetupComplete?this._startTimerCountdown():this._finishSetup()}_evaluateVariablesSkipError(t){var e;this._evaledVariables={},(null===(e=this._config)||void 0===e?void 0:e.variables)&&Object.keys(this._config.variables).sort().forEach((e=>{try{this._evaledVariables[e]=this._objectEvalTemplate(t,this._config.variables[e])}catch(t){}}))}_finishSetup(){if(!this._initialSetupComplete&&this._doIHaveEverything){if(this._evaluateVariablesSkipError(),this._config.entity){const t=this._getTemplateOrValue(void 0,this._config.entity);this._config.entity=t,this._stateObj=this._hass.states[t]}this._evaluateVariablesSkipError(this._stateObj),this._config.entity&&oe.has(he(this._config.entity))?this._config=Object.assign({tap_action:{action:"toggle"}},this._config):this._config.entity?this._config=Object.assign({tap_action:{action:"more-info"}},this._config):this._config=Object.assign({tap_action:{action:"none"}},this._config);const t=JSON.stringify(this._config);if(this._entities=[],Array.isArray(this._config.triggers_update))this._config.triggers_update.forEach((t=>{try{const e=this._getTemplateOrValue(this._stateObj,t);null==e||this._entities.includes(e)||this._entities.push(e)}catch(t){}}));else if("string"==typeof this._config.triggers_update){const t=this._getTemplateOrValue(this._stateObj,this._config.triggers_update);t&&"all"!==t?this._entities.push(t):this._config.triggers_update=t}if("all"!==this._config.triggers_update){const e=new RegExp(/states\[\s*('|\\")([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\1\s*\]/,"gm"),i=new RegExp(/states\[\s*('|\\")([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\1\s*\]/,"m"),r=t.match(e);null==r||r.forEach((t=>{const e=t.match(i);e&&!this._entities.includes(e[2])&&this._entities.push(e[2])}))}this._config.entity&&!this._entities.includes(this._config.entity)&&this._entities.push(this._config.entity),this._expandTriggerGroups();const e=new RegExp("\\[\\[\\[.*\\]\\]\\]","m");this._hasTemplate=!("all"!==this._config.triggers_update||!t.match(e)),this._startTimerCountdown(),this._initialSetupComplete=!0}}_startTimerCountdown(){if(this._config&&this._config.entity&&"timer"===he(this._config.entity)){const t=this._hass.states[this._config.entity];this._startInterval(t)}}_createCard(t){if(zi)return zi.createCardElement(t);{const e=((t,e=!1)=>{const i=(t,e)=>r("hui-error-card",{type:"error",error:t,config:e}),r=(t,e)=>{const r=window.document.createElement(t);try{if(!r.setConfig)return;r.setConfig(e)}catch(r){return console.error(t,r),i(r.message,e)}return r};if(!t||"object"!=typeof t||!e&&!t.type)return i("No type defined",t);let n=t.type;if(n&&n.startsWith("custom:"))n=n.substr(7);else if(e)if(ye.has(n))n=`hui-${n}-row`;else{if(!t.entity)return i("Invalid config given.",t);const e=t.entity.split(".",1)[0];n=`hui-${we[e]||"text"}-entity-row`}else n=`hui-${n}-card`;if(customElements.get(n))return r(n,t);const s=i(`Custom element doesn't exist: ${t.type}.`,t);s.style.display="None";const a=setTimeout((()=>{s.style.display=""}),2e3);return customElements.whenDefined(t.type).then((()=>{clearTimeout(a),Mt(s,"ll-rebuild",{},s)})),s})(t);return Di.then((()=>{Mt(e,"ll-rebuild",{})})),e}}static get styles(){return $e}render(){var t;if(!this._config||!this._hass)return X``;this._stateObj=this._config.entity?this._hass.states[this._config.entity]:void 0;try{return this._evaledVariables={},(null===(t=this._config)||void 0===t?void 0:t.variables)&&Object.keys(this._config.variables).sort().forEach((t=>{this._evaledVariables[t]=this._objectEvalTemplate(this._stateObj,this._config.variables[t])})),this._cardHtml()}catch(t){t.stack?console.error(t.stack):console.error(t);const e=document.createElement("hui-error-card");return e.setConfig({type:"error",error:t.toString(),origConfig:this._config}),X` ${e} `}}shouldUpdate(t){return!(!this._hasTemplate&&!t.has("_timeRemaining")&&!function(t,e){if(e.has("_config"))return!0;const i=e.get("_hass");return!!i&&t._entities.some((function(e){return(null==i?void 0:i.states[e])!==t._hass.states[e]}))}(this,t)||(this._expandTriggerGroups(),0))}updated(t){if(super.updated(t),this._config&&this._config.entity&&"timer"===he(this._config.entity)&&t.has("_hass")){const e=this._hass.states[this._config.entity],i=t.get("_hass");(i?i.states[this._config.entity]:void 0)!==e?this._startInterval(e):e||this._clearInterval()}}_clearInterval(){this._interval&&(window.clearInterval(this._interval),this._interval=void 0)}_startInterval(t){this._clearInterval(),this._calculateRemaining(t),"active"===t.state&&(this._interval=window.setInterval((()=>this._calculateRemaining(t)),1e3))}_calculateRemaining(t){t.attributes.remaining&&(this._timeRemaining=(t=>{if(!t.attributes.remaining)return;let e=be(t.attributes.remaining);if("active"===t.state){const i=(new Date).getTime(),r=new Date(t.last_changed).getTime();e=Math.max(e-(i-r)/1e3,0)}return e})(t))}_computeTimeDisplay(t){if(t)return function(t){const e=Math.floor(t/3600),i=Math.floor(t%3600/60),r=Math.floor(t%3600%60);return e>0?`${e}:${ve(i)}:${ve(r)}`:i>0?`${i}:${ve(r)}`:r>0?""+r:null}(this._timeRemaining||be(t.attributes.duration))}_getMatchingConfigState(t){if(!this._config.state)return;const e=this._config.state.find((t=>"template"===t.operator));if(!t&&!e)return;let i;const r=this._config.state.find((e=>{if(!e.operator)return t&&this._getTemplateOrValue(t,e.value)==t.state;switch(e.operator){case"==":return t&&t.state==this._getTemplateOrValue(t,e.value);case"<=":return t&&t.state<=this._getTemplateOrValue(t,e.value);case"<":return t&&t.state<this._getTemplateOrValue(t,e.value);case">=":return t&&t.state>=this._getTemplateOrValue(t,e.value);case">":return t&&t.state>this._getTemplateOrValue(t,e.value);case"!=":return t&&t.state!=this._getTemplateOrValue(t,e.value);case"regex":return!(!t||!t.state.match(this._getTemplateOrValue(t,e.value)));case"template":return this._getTemplateOrValue(t,e.value);case"default":return i=e,!1;default:return!1}}));return!r&&i?i:r}_localize(t,e,i,r=!0,n){var s;return ui(this._hass.localize,t,this._hass.locale,this._hass.config,this._hass.entities,{numeric_precision:"card"===i?null===(s=this._config)||void 0===s?void 0:s.numeric_precision:i,show_units:r,units:n},e)}_relativeTime(t,e=!1){return t?X`
        <ha-relative-time
          id="relative-time"
          class="ellipsis"
          .hass="${this._hass}"
          .datetime="${t}"
          .capitalize="${e}"
        ></ha-relative-time>
      `:""}_getTemplateHelpers(){return{localize:this._localize.bind(this),formatDateTime:t=>ni(new Date(t),this._hass.locale,this._hass.config),formatShortDateTimeWithYear:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,ai(i,r.time_zone).format(e);var e,i,r},formatShortDateTime:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,oi(i,r.time_zone).format(e);var e,i,r},formatDateTimeWithSeconds:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,li(i,r.time_zone).format(e);var e,i,r},formatDateTimeNumeric:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,`${Ue(e,i,r)}, ${Qe(e,i,r)}`;var e,i,r},relativeTime:this._relativeTime.bind(this),formatTime:t=>Qe(new Date(t),this._hass.locale,this._hass.config),formatTimeWithSeconds:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,ei(i,r.time_zone).format(e);var e,i,r},formatTimeWeekday:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,ii(i,r.time_zone).format(e);var e,i,r},formatTime24h:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,ri(i,r.time_zone).format(e);var e,i,r},formatDateWeekdayDay:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Ie(i,r.time_zone).format(e);var e,i,r},formatDate:t=>Be(new Date(t),this._hass.locale,this._hass.config),formatDateNumeric:t=>Ue(new Date(t),this._hass.locale,this._hass.config),formatDateShort:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,We(i,r.time_zone).format(e);var e,i,r},formatDateMonthYear:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Ge(i,r.time_zone).format(e);var e,i,r},formatDateMonth:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Ze(i,r.time_zone).format(e);var e,i,r},formatDateYear:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Ye(i,r.time_zone).format(e);var e,i,r},formatDateWeekday:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Je(i,r.time_zone).format(e);var e,i,r},formatDateWeekdayShort:t=>{return e=new Date(t),i=this._hass.locale,r=this._hass.config,Ke(i,r.time_zone).format(e);var e,i,r}}}_evalTemplate(t,e){try{return new Function("states","entity","user","hass","variables","html","helpers",`'use strict'; ${e}`).call(this,this._hass.states,t,this._hass.user,this._hass,this._evaledVariables,X,this._getTemplateHelpers())}catch(t){const i=e.length<=100?e.trim():`${e.trim().substring(0,98)}...`;throw t.message=`${t.name}: ${t.message} in '${i}'`,t.name="ButtonCardJSTemplateError",t}}_objectEvalTemplate(t,e){const i=Ri(e);return this._getTemplateOrValue(t,i)}_getTemplateOrValue(t,e){if(["number","boolean"].includes(typeof e))return e;if(!e)return e;if("object"==typeof e)return Object.keys(e).forEach((i=>{e[i]=this._getTemplateOrValue(t,e[i])})),e;const i=e.trim();return"[[["===i.substring(0,3)&&"]]]"===i.slice(-3)?this._evalTemplate(t,i.slice(3,-3)):e}_getColorForLightEntity(t,e,i){let r=de;return ce.includes(r)&&(r=_e(ue)),t&&(ge(t)?(r=t.attributes.rgb_color?`rgb(${t.attributes.rgb_color.join(",")})`:e&&t.attributes.color_temp&&t.attributes.min_mireds&&t.attributes.max_mireds?function(t,e,i){const r=new ie("rgb(255, 160, 0)"),n=new ie("rgb(166, 209, 255)"),s=new ie("white"),a=(t-e)/(i-e)*100;return a<50?re(n).mix(s,2*a).toRgbString():re(s).mix(r,2*(a-50)).toRgbString()}(t.attributes.color_temp,t.attributes.min_mireds,t.attributes.max_mireds):Mi(t,t.state,i)||de,t.attributes.brightness&&(r=function(t,e,i){const r=new ie(fe(t,e));if(r.isValid){const t=r.mix("black",100-i).toString();if(t)return t}return e}(this,r,(t.attributes.brightness+245)/5))):r=Mi(t,t.state,i)||de),r}_buildCssColorAttribute(t,e){var i,r;let n,s="";return(null==e?void 0:e.color)?s=e.color:this._config.color&&(s=this._config.color),le.includes(s)&&(!t||t&&"light"!==he(t.entity_id))&&(s=""),n=le.includes(s)?this._getColorForLightEntity(t,"auto-no-temperature"!==s,null===(i=this._config)||void 0===i?void 0:i.color_type):s||t&&Mi(t,t.state,null===(r=this._config)||void 0===r?void 0:r.color_type)||de,n}_buildIcon(t,e){if(!this._config.show_icon)return;let i;if(null==e?void 0:e.icon)i=e.icon;else{if(!this._config.icon)return;i=this._config.icon}return this._getTemplateOrValue(t,i)}_buildEntityPicture(t,e){if(!this._config.show_entity_picture||!t&&!e&&!this._config.entity_picture)return;let i;return(null==e?void 0:e.entity_picture)?i=e.entity_picture:this._config.entity_picture?i=this._config.entity_picture:t&&(i=t.attributes&&t.attributes.entity_picture?t.attributes.entity_picture:void 0),this._getTemplateOrValue(t,i)}_buildStyleGeneric(t,e,i){var r,n;let s={};if((null===(r=this._config.styles)||void 0===r?void 0:r[i])&&(s=Object.assign(s,...this._config.styles[i])),null===(n=null==e?void 0:e.styles)||void 0===n?void 0:n[i]){let t={};t=Object.assign(t,...e.styles[i]),s=Object.assign(Object.assign({},s),t)}return Object.keys(s).forEach((e=>{s[e]=this._getTemplateOrValue(t,s[e])})),s}_buildCustomStyleGeneric(t,e,i){var r,n,s,a;let o={};if((null===(n=null===(r=this._config.styles)||void 0===r?void 0:r.custom_fields)||void 0===n?void 0:n[i])&&(o=Object.assign(o,...this._config.styles.custom_fields[i])),null===(a=null===(s=null==e?void 0:e.styles)||void 0===s?void 0:s.custom_fields)||void 0===a?void 0:a[i]){let t={};t=Object.assign(t,...e.styles.custom_fields[i]),o=Object.assign(Object.assign({},o),t)}return Object.keys(o).forEach((e=>{o[e]=this._getTemplateOrValue(t,o[e])})),o}_buildName(t,e){if(!1===this._config.show_name)return;let i;var r;return(null==e?void 0:e.name)?i=e.name:this._config.name?i=this._config.name:t&&(i=t.attributes&&t.attributes.friendly_name?t.attributes.friendly_name:(r=t.entity_id).substr(r.indexOf(".")+1)),this._getTemplateOrValue(t,i)}_buildStateString(t){let e;return this._config.show_state&&t&&t.state&&("timer"===he(t.entity_id)?"idle"===t.state||0===this._timeRemaining?e=ui(this._hass.localize,t,this._hass.locale,this._hass.config,this._hass.entities,this._config):(e=this._computeTimeDisplay(t),"paused"===t.state&&(e+=` (${ui(this._hass.localize,t,this._hass.locale,this._hass.config,this._hass.entities,this._config)})`)):e=ui(this._hass.localize,t,this._hass.locale,this._hass.config,this._hass.entities,this._config)),e}_buildLastChanged(t,e){return this._config.show_last_changed&&t?X`
          <ha-relative-time
            id="label"
            class="ellipsis"
            .hass="${this._hass}"
            .datetime="${t.last_changed}"
            style=${Et(e)}
          ></ha-relative-time>
        `:void 0}_buildLabel(t,e){if(!this._config.show_label)return;let i;return i=(null==e?void 0:e.label)?e.label:this._config.label,this._getTemplateOrValue(t,i)}_buildCustomFields(t,e){let i=X``;const r={},n={};return this._config.custom_fields&&Object.keys(this._config.custom_fields).forEach((e=>{const i=this._config.custom_fields[e];i.card?i.do_not_eval?n[e]=Ri(i.card):n[e]=this._objectEvalTemplate(t,i.card):r[e]=this._getTemplateOrValue(t,i)})),(null==e?void 0:e.custom_fields)&&Object.keys(e.custom_fields).forEach((i=>{const s=e.custom_fields[i];s.card?s.do_not_eval?n[i]=Ri(s.card):n[i]=this._objectEvalTemplate(t,s.card):r[i]=this._getTemplateOrValue(t,s)})),Object.keys(r).forEach((n=>{if(null!=r[n]){const s=Object.assign(Object.assign({},this._buildCustomStyleGeneric(t,e,n)),{"grid-area":n});i=X`
          ${i}
          <div id=${n} class="ellipsis" style=${Et(s)}>${this._unsafeHTMLorNot(r[n])}</div>
        `}})),Object.keys(n).forEach((r=>{if(null!=n[r]){const s=Object.assign(Object.assign({},this._buildCustomStyleGeneric(t,e,r)),{"grid-area":r});let a;Lt(this._cardsConfig[r],n[r])?a=this._cards[r]:(a=this._createCard(n[r]),this._cards[r]=a,this._cardsConfig[r]=Ri(n[r])),a.hass=this._hass,i=X`
          ${i}
          <div
            id=${r}
            @action=${this._stopPropagation}
            @click=${this._stopPropagation}
            @touchstart=${this._stopPropagation}
            @mousedown=${this._stopPropagation}
            @mouseup=${this._stopPropagation}
            @touchend=${this._stopPropagation}
            @touchcancel=${this._stopPropagation}
            style=${Et(s)}
          >
            ${a}
          </div>
        `}})),i}_hasChildCards(t){return!!t&&Object.keys(t).some((e=>!!t[e].card))}_isClickable(t,e){const i=this._getTemplateOrValue(t,this._config.tap_action.action),r=this._getTemplateOrValue(t,this._config.hold_action.action),n=this._getTemplateOrValue(t,this._config.double_tap_action.action),s=this._hasChildCards(this._config.custom_fields)||!(!e||!this._hasChildCards(e.custom_fields));return"none"!=i||"none"!=r||"none"!=n||s}_rotate(t){return!!(null==t?void 0:t.spin)}_blankCardColoredHtml(t){const e=Object.assign({background:"none","box-shadow":"none","border-style":"none"},t);return X`
      <ha-card class="disabled" style=${Et(e)}>
        <div></div>
      </ha-card>
    `}_cardHtml(){var t,e,i,r;const n=this._getMatchingConfigState(this._stateObj);let s="var(--state-inactive-color)";(null==n?void 0:n.color)&&!le.includes(n.color)?s=n.color:(null===(t=this._config)||void 0===t?void 0:t.color)&&!le.includes(this._config.color)?this._stateObj?ge(this._stateObj)&&(s=(null===(e=this._config)||void 0===e?void 0:e.color)||s):s=this._config.color:s=this._buildCssColorAttribute(this._stateObj,n);let a=s,o={},l={};const c={},u=this._buildStyleGeneric(this._stateObj,n,"lock"),d=this._buildStyleGeneric(this._stateObj,n,"card"),h=this._buildStyleGeneric(this._stateObj,n,"tooltip"),f={"button-card-main":!0,disabled:!this._isClickable(this._stateObj,n)};switch((null===(i=this._config)||void 0===i?void 0:i.tooltip)&&this.classList.add("tooltip"),d.width&&(this.style.setProperty("flex","0 0 auto"),this.style.setProperty("max-width","fit-content")),this._config.color_type){case"blank-card":return this._blankCardColoredHtml(d);case"card":case"label-card":{const t=function(t,e){const i=new ie(fe(t,e)).getLuminance(),r=new ie({r:225,g:225,b:225}),n=r.getLuminance(),s=new ie({r:28,g:28,b:28}),a=s.getLuminance();return 0===i||(Math.max(i,n)+.05)/Math.min(i,n+.05)>(Math.max(i,a)+.05)/Math.min(i,a+.05)?r.toRgbString():s.toRgbString()}(this,s);o.color=t,l.color=t,o["background-color"]=s,o=Object.assign(Object.assign({},o),d),a="inherit";break}default:o=d}this._config.aspect_ratio?(c["--aspect-ratio"]=this._config.aspect_ratio,o.position="absolute"):c.display="inline",this.style.setProperty("--button-card-light-color",this._getColorForLightEntity(this._stateObj,!0)),this.style.setProperty("--button-card-light-color-no-temperature",this._getColorForLightEntity(this._stateObj,!1)),l=Object.assign(Object.assign({},l),u);const p=this._config.extra_styles?X`
          <style>
            ${this._getTemplateOrValue(this._stateObj,this._config.extra_styles)}
          </style>
        `:X``;return X`
      ${p}
      <div id="aspect-ratio" style=${Et(c)}>
        <ha-card
          id="card"
          class=${jt(f)}
          style=${Et(o)}
          @action=${this._handleAction}
          @focus="${this.handleRippleFocus}"
          @blur="${this.handleRippleBlur}"
          @mousedown="${this.handleRippleActivate}"
          @mouseup="${this.handleRippleDeactivate}"
          @touchstart="${this.handleRippleActivate}"
          @touchend="${this.handleRippleDeactivate}"
          @touchcancel="${this.handleRippleDeactivate}"
          .actionHandler=${Dt({hasDoubleClick:"none"!==this._config.double_tap_action.action,hasHold:"none"!==this._config.hold_action.action,repeat:this._config.hold_action.repeat,repeatLimit:this._config.hold_action.repeat_limit})}
          .config="${this._config}"
        >
          ${this._buttonContent(this._stateObj,n,a)}
          <mwc-ripple id="ripple"></mwc-ripple>
        </ha-card>
        ${this._getLock(l)}
      </div>
      ${(null===(r=this._config)||void 0===r?void 0:r.tooltip)?X`
            <span class="tooltiptext" style=${Et(h)}>
              ${this._getTemplateOrValue(this._stateObj,this._config.tooltip)}
            </span>
          `:""}
    `}_getLock(t){return this._config.lock&&this._getTemplateOrValue(this._stateObj,this._config.lock.enabled)?X`
        <div
          id="overlay"
          style=${Et(t)}
          @action=${this._handleUnlockType}
          .actionHandler=${Dt({hasDoubleClick:"double_tap"===this._config.lock.unlock,hasHold:"hold"===this._config.lock.unlock})}
          .config="${this._config}"
        >
          <ha-icon id="lock" icon="mdi:lock-outline"></ha-icon>
        </div>
      `:X``}_buttonContent(t,e,i){const r=this._buildName(t,e),n=(null==e?void 0:e.state_display)||this._config.state_display||void 0,s=(this._config.show_state&&n?this._getTemplateOrValue(t,n):void 0)||this._buildStateString(t),a=function(t,e){if(!t&&!e)return;let i;return i=e?t?`${t}: ${e}`:e:t,i}(r,s);switch(this._config.layout){case"icon_name_state":case"name_state":return this._gridHtml(t,e,this._config.layout,i,a,void 0);default:return this._gridHtml(t,e,this._config.layout,i,r,s)}}_unsafeHTMLorNot(t){return t.strings||t.values?t:Rt(`${t}`)}_gridHtml(t,e,i,r,n,s){const a=this._getIconHtml(t,e,r),o=[i],l=this._buildLabel(t,e),c=this._buildStyleGeneric(t,e,"name"),u=this._buildStyleGeneric(t,e,"state"),d=this._buildStyleGeneric(t,e,"label"),h=this._buildLastChanged(t,d),f=this._buildStyleGeneric(t,e,"grid");return a||o.push("no-icon"),n||o.push("no-name"),s||o.push("no-state"),l||h||o.push("no-label"),X`
      <div id="container" class=${o.join(" ")} style=${Et(f)}>
        ${a||""}
        ${n?X`
              <div id="name" class="ellipsis" style=${Et(c)}>
                ${this._unsafeHTMLorNot(n)}
              </div>
            `:""}
        ${s?X`
              <div id="state" class="ellipsis" style=${Et(u)}>
                ${this._unsafeHTMLorNot(s)}
              </div>
            `:""}
        ${l&&!h?X`
              <div id="label" class="ellipsis" style=${Et(d)}>
                ${this._unsafeHTMLorNot(l)}
              </div>
            `:""}
        ${h||""} ${this._buildCustomFields(t,e)}
      </div>
    `}_getIconHtml(t,e,i){const r=this._buildIcon(t,e),n=this._buildEntityPicture(t,e),s=this._buildStyleGeneric(t,e,"entity_picture"),a=this._buildStyleGeneric(t,e,"icon"),o=this._buildStyleGeneric(t,e,"img_cell"),l=this._buildStyleGeneric(t,e,"card"),c=Object.assign({color:i,width:this._config.size,"--ha-icon-display":l.height?"inline":void 0,position:this._config.aspect_ratio||l.height?"absolute":"relative"},a),u=Object.assign(Object.assign({},c),s),d=this._buildLiveStream(u),h=this._config.show_icon&&(r||t);if(h||n){let i;return t&&(i=he(t.entity_id)),X`
        <div id="img-cell" style=${Et(o)}>
          ${!h||n||d?"":X`
                <ha-state-icon
                  .state=${t}
                  .stateObj=${t}
                  .hass=${this._hass}
                  ?data-domain=${i}
                  data-state=${(t=>null!=t?t:tt)(null==t?void 0:t.state)}
                  style=${Et(c)}
                  .icon="${r}"
                  id="icon"
                  ?rotating=${this._rotate(e)}
                ></ha-state-icon>
              `}
          ${d||""}
          ${n&&!d?X`
                <img
                  src="${n}"
                  style=${Et(u)}
                  id="icon"
                  ?rotating=${this._rotate(e)}
                />
              `:""}
        </div>
      `}}_buildLiveStream(t){return this._config.show_live_stream&&this._config.entity&&"camera"===he(this._config.entity)?X`
        <hui-image
          .hass=${this._hass}
          .cameraImage=${this._config.entity}
          .entity=${this._config.entity}
          cameraView="live"
          style=${Et(t)}
        ></hui-image>
      `:void 0}_configFromLLTemplates(t,e){const i=e.template;if(!i)return e;let r,n={};const s=i&&Array.isArray(i)?i:[i];return null==s||s.forEach((e=>{var i,s;let a;if(null===(i=t.config.cblcars_card_templates)||void 0===i?void 0:i[e])a=t.config.cblcars_card_templates[e];else{if(!(null===(s=window.cblcars_card_templates)||void 0===s?void 0:s[e]))throw new Error(`LCARS Button-card template '${e}' is missing!`);a=window.cblcars_card_templates[e]}const o=this._configFromLLTemplates(t,a);n=pe(n,o),r=me(r,o.state)})),n=pe(n,e),n.state=me(r,e.state),n}setConfig(t){if(!t)throw new Error("Invalid configuration");this._initialSetupComplete&&(this._initialSetupComplete=!1),this._cards={},this._cardsConfig={};const e=function(){let t=document.querySelector("home-assistant");if(t=t&&t.shadowRoot,t=t&&t.querySelector("home-assistant-main"),t=t&&t.shadowRoot,t=t&&t.querySelector("app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver"),t=t&&t.shadowRoot||t,t=t&&t.querySelector("ha-panel-lovelace"),t=t&&t.shadowRoot,t=t&&t.querySelector("hui-root"),t){const e=t.lovelace;return e.current_view=t.___curView,e}return null}()||function(){let t=document.querySelector("hc-main");if(t=t&&t.shadowRoot,t=t&&t.querySelector("hc-lovelace"),t=t&&t.shadowRoot,t=t&&(t.querySelector("hui-view")||t.querySelector("hui-panel-view")),t){const e=t.lovelace;return e.current_view=t.___curView,e}return null}();let i=Ri(t);i=this._configFromLLTemplates(e,i),this._config=Object.assign(Object.assign({type:"custom:cblcars-button-card",group_expand:!1,hold_action:{action:"none"},double_tap_action:{action:"none"},layout:"vertical",size:"40%",color_type:"icon",show_name:!0,show_state:!1,show_icon:!0,show_units:!0,show_label:!1,show_entity_picture:!1,show_live_stream:!1,card_size:3},i),{lock:Object.assign({enabled:!1,duration:5,unlock:"tap"},i.lock)}),this._initialSetupComplete||this._finishSetup()}_loopGroup(t){t&&t.forEach((t=>{var e,i;(null===(e=this._hass)||void 0===e?void 0:e.states[t])&&((null===(i=this._hass.states[t].attributes)||void 0===i?void 0:i.entity_id)?this._loopGroup(this._hass.states[t].attributes.entity_id):this._entities.includes(t)||this._entities.push(t))}))}_expandTriggerGroups(){var t;this._hass&&(null===(t=this._config)||void 0===t?void 0:t.group_expand)&&this._entities&&this._entities.forEach((t=>{var e,i,r,n,s;(null===(r=null===(i=null===(e=this._hass)||void 0===e?void 0:e.states[t])||void 0===i?void 0:i.attributes)||void 0===r?void 0:r.entity_id)&&this._loopGroup(null===(s=null===(n=this._hass)||void 0===n?void 0:n.states[t].attributes)||void 0===s?void 0:s.entity_id)}))}getCardSize(){var t;return(null===(t=this._config)||void 0===t?void 0:t.card_size)||3}_evalActions(t,e){var i,r,n,s,a;const o=Ri(t),l=t=>t?(Object.keys(t).forEach((e=>{"object"==typeof t[e]?t[e]=l(t[e]):t[e]=this._getTemplateOrValue(this._stateObj,t[e])})),t):t;return"entity"===(null===(r=null===(i=o[e])||void 0===i?void 0:i.service_data)||void 0===r?void 0:r.entity_id)&&(o[e].service_data.entity_id=t.entity),"entity"===(null===(s=null===(n=o[e])||void 0===n?void 0:n.data)||void 0===s?void 0:s.entity_id)&&(o[e].data.entity_id=t.entity),o[e]=l(o[e]),!o[e].confirmation&&o.confirmation&&(o[e].confirmation=l(o.confirmation)),(null===(a=o[e])||void 0===a?void 0:a.entity)&&(o.entity=o[e].entity),o}handleRippleActivate(t){this._ripple.then((e=>e&&"function"==typeof e.startPress&&this._rippleHandlers.startPress(t)))}handleRippleDeactivate(){this._ripple.then((t=>t&&"function"==typeof t.endPress&&this._rippleHandlers.endPress()))}handleRippleFocus(){this._ripple.then((t=>t&&"function"==typeof t.startFocus&&this._rippleHandlers.startFocus()))}handleRippleBlur(){this._ripple.then((t=>t&&"function"==typeof t.endFocus&&this._rippleHandlers.endFocus()))}_handleAction(t){var e;if(null===(e=t.detail)||void 0===e?void 0:e.action)switch(t.detail.action){case"tap":case"hold":case"double_tap":const e=this._config;if(!e)return;const i=t.detail.action,r=this._evalActions(e,`${i}_action`);(async(t,e,i,r)=>{Mt(t,"hass-action",{config:i,action:r})})(this,this._hass,r,i)}}_handleUnlockType(t){const e=this._config;e&&e.lock.unlock===t.detail.action&&this._handleLock()}_handleLock(){var t;const e=this.shadowRoot.getElementById("lock");if(!e)return;if(this._config.lock.exemptions){if(!(null===(t=this._hass.user)||void 0===t?void 0:t.name)||!this._hass.user.id)return;let i=!1;if(this._config.lock.exemptions.forEach((t=>{var e,r;(!i&&t.user===(null===(e=this._hass.user)||void 0===e?void 0:e.id)||t.username===(null===(r=this._hass.user)||void 0===r?void 0:r.name))&&(i=!0)})),!i)return e.classList.add("invalid"),void window.setTimeout((()=>{e&&e.classList.remove("invalid")}),3e3)}const i=this.shadowRoot.getElementById("overlay");if(i.style.setProperty("pointer-events","none"),e){const t=document.createAttribute("icon");t.value="mdi:lock-open-outline",e.attributes.setNamedItem(t),e.classList.add("hidden")}window.setTimeout((()=>{if(i.style.setProperty("pointer-events",""),e){e.classList.remove("hidden");const t=document.createAttribute("icon");t.value="mdi:lock-outline",e.attributes.setNamedItem(t)}}),1e3*this._config.lock.duration)}_stopPropagation(t){t.stopPropagation()}};m([yt()],Fi.prototype,"_hass",void 0),m([yt()],Fi.prototype,"_config",void 0),m([yt()],Fi.prototype,"_timeRemaining",void 0),m([wt({descriptor:t=>({async get(){var t;return await this.updateComplete,null===(t=this.renderRoot)||void 0===t?void 0:t.querySelector("mwc-ripple")},enumerable:!0,configurable:!0})})],Fi.prototype,"_ripple",void 0),m([$t({passive:!0})],Fi.prototype,"handleRippleActivate",null),m([$t({passive:!0})],Fi.prototype,"handleRippleDeactivate",null),m([$t({passive:!0})],Fi.prototype,"handleRippleFocus",null),m([$t({passive:!0})],Fi.prototype,"handleRippleBlur",null),m([$t({passive:!0})],Fi.prototype,"_handleAction",null),m([$t({passive:!0})],Fi.prototype,"_handleUnlockType",null),m([$t({passive:!0})],Fi.prototype,"_handleLock",null),m([$t({passive:!0})],Fi.prototype,"_stopPropagation",null),Fi=m([(t=>e=>"function"==typeof e?((t,e)=>(customElements.define(t,e),e))(t,e):((t,e)=>{const{kind:i,elements:r}=e;return{kind:i,elements:r,finisher(e){customElements.define(t,e)}}})(t,e))("cblcars-button-card")],Fi);let Ii={},Bi={};(async function(){!function(){const t="https://cb-lcars.unimatrix01.ca",e="CB-LCARS v"+r,i=" ".repeat(35-e.length),n=" ".repeat(4)+t;console.info(`%c${i}${e}  %c\n%c${n}  `,["color: white","font-weight: bold","padding: 2px 4px","border-radius: 5em 5em 0 0","background-color: #37a6d1"].join(";"),["color: transparent","padding: 0","border: none"].join(";"),["color: white","padding: 2px 4px","border-radius: 0 0 5em 5em","background-color: #37a6d1"].join(";"))}(),Ni=async function(t){try{const e=await d(t);window.cblcars_card_templates=e.cblcars_card_templates,e.cblcars&&(window.cblcars={...window.cblcars,...e.cblcars}),Ii=e||{},c("debug",`CB-LCARS dashboard templates loaded from source file [${s}]`,Ii)}catch(t){c("error","Failed to get the CB-LCARS lovelace templates from source file.",t)}}(s),Pi=async function(t){try{const e=await d(t);Bi=e||{},c("debug",`CB-LCARS stub configuration loaded from source file [${a}]`,Bi)}catch(t){c("error","Failed to get the CB-LCARS stub configuration from source file.",t)}}(a);const t=[customElements.whenDefined("cblcars-button-card"),i.e(870).then(i.bind(i,870)).then((()=>customElements.whenDefined("cblcars-my-slider-v2")))];await Promise.all(t),async function(){try{if(document.querySelector(`link[href="${n}"]`))console.log(`CB-LCARS font already loaded from: ${n}`);else{const t=document.createElement("link");t.href=n,t.rel="stylesheet",document.head.appendChild(t),c("info",`Loaded CB-LCARS required font from: ${n}`)}}catch(t){c("error",`Failed to load font from: ${n}: ${t.message}`)}}(),customElements.get("cblcars-button-card")||c("error","Custom Button Card for LCARS [cblcars-button-card] was not found!"),customElements.get("cblcars-my-slider-v2")||c("error","MySliderV2 for LCARS Custom Card [cblcars-my-slider-v2] was not found!")})().catch((t=>{c("error","Error initializing custom card:",t)}));class Vi extends Fi{_isResizeObserverEnabled=!1;_resizeObserver;_logLevel=l();_resizeObserverTarget="this";constructor(){super(),this._resizeObserver=new ResizeObserver((()=>{c("debug","Resize observer fired",this,this._logLevel),this._debouncedResizeHandler()})),this._debouncedResizeHandler=this._debounce((()=>this.setConfig(this._config)),100)}setConfig(t){if(!t)throw new Error("The 'cblcars_card_config' section is required in the configuration.");const e=["cb-lcars-base",...t.template?[...t.template]:[]];this._config={...t,template:e},this._logLevel=t.cblcars_log_level||l(),this._resizeObserverTarget=t.resize_observer_target||"this",this._isResizeObserverEnabled=t.enable_resize_observer||!1,this._updateResizeObserver(),super.setConfig(this._config),c("debug",`${this.constructor.name}.setConfig() called with:`,this._config,this._logLevel)}static get editorType(){return"cb-lcars-base-card-editor"}static get cardType(){return"cb-lcars-base-card"}static get defaultConfig(){return{label:"CB-LCARS Base Card",show_label:!0}}static getConfigElement(){const t=this.editorType;try{if(!customElements.get(t))return c("error",`${this.constructor.name}.getConfigElement() Graphical editor element [${t}] is not defined defined in Home Assistant!`,null,this._logLevel),null;return document.createElement(t)}catch(e){return c("error",`${this.constructor.name}.getConfigElement() Error creating element ${t}: `,e,this._logLevel),null}}static getStubConfig(){const t=this.cardType;return Bi[t]?Bi[t]:this.defaultConfig}getCardSize(){super.getCardSize()}getLayoutOptions(){return{grid_rows:1,grid_columns:4}}connectedCallback(){super.connectedCallback(),this.parentElement&&this.parentElement.classList.contains("preview")?this.style.height="60px":this.style.height="100%",this._updateResizeObserver()}disconnectedCallback(){super.disconnectedCallback(),this.disableResizeObserver()}_updateResizeObserver(){this._isResizeObserverEnabled?this.enableResizeObserver():this.disableResizeObserver(),this.requestUpdate()}enableResizeObserver(){const t=this.resolveTargetElement(this._resizeObserverTarget);t&&this.isConnected&&(this._resizeObserver.observe(t),c("debug",`${this.constructor.name}.enableResizeObserver() Resize observer enabled on [${this._resizeObserverTarget}]`,this,this._logLevel))}disableResizeObserver(){this._resizeObserver&&this._resizeObserver.disconnect(),c("debug",`${this.constructor.name}.disableResizeObserver() Resize observer disabled`,this,this._logLevel)}toggleResizeObserver(){this._isResizeObserverEnabled=!this._isResizeObserverEnabled,this._updateResizeObserver()}resolveTargetElement(t){const e={this:()=>this,"this.parentElement":()=>this.parentElement,"this.offsetParent":()=>this.offsetParent};return e[t]?e[t]():this}_debounce(t,e){let i;return function(...r){clearTimeout(i),i=setTimeout((()=>t.apply(this,r)),e)}}}class Ui extends Vi{static get editorType(){return"cb-lcars-label-card-editor"}static get cardType(){return"cb-lcars-label-card"}static get defaultConfig(){return{label:"CB-LCARS Label",show_label:!0}}setConfig(t){const e=[...[t.cblcars_card_type?t.cblcars_card_type:"cb-lcars-label"],...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}}class qi extends Vi{static get editorType(){return"cb-lcars-elbow-card-editor"}static get cardType(){return"cb-lcars-elbow-card"}static get defaultConfig(){return{variables:{card:{border:{left:{size:90},top:{size:20}}}}}}setConfig(t){const e=[...[t.cblcars_card_type?t.cblcars_card_type:"cb-lcars-header"],...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}getLayoutOptions(){return{grid_rows:1,grid_columns:4}}}class Wi extends Vi{static get editorType(){return"cb-lcars-double-elbow-card-editor"}static get cardType(){return"cb-lcars-double-elbow-card"}static get defaultConfig(){return{}}setConfig(t){const e=[...[t.cblcars_card_type?t.cblcars_card_type:"cb-lcars-header-picard"],...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}getLayoutOptions(){return{grid_rows:1,grid_columns:4}}}class Gi extends Vi{static get editorType(){return"cb-lcars-multimeter-card-editor"}static get cardType(){return"cb-lcars-multimeter-card"}static get defaultConfig(){return{variables:{_mode:"gauge"}}}constructor(){super(),this._enableResizeObserver=!0}setConfig(t){const e=["cb-lcars-multimeter",...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}getLayoutOptions(){return{grid_rows:1,grid_columns:4}}}class Zi extends Vi{static get editorType(){return"cb-lcars-dpad-card-editor"}static get cardType(){return"cb-lcars-dpad-card"}static get defaultConfig(){return{}}setConfig(t){const e=["cb-lcars-dpad",...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}getLayoutOptions(){return{grid_rows:4,grid_columns:2}}}class Yi extends Vi{static get editorType(){return"cb-lcars-button-card-editor"}static get cardType(){return"cb-lcars-button-card"}static get defaultConfig(){return{label:"CB-LCARS Button",show_label:!0}}setConfig(t){const e=[...[t.cblcars_card_type?t.cblcars_card_type:"cb-lcars-button-lozenge"],...t.template?[...t.template]:[]],i={...t,template:e};super.setConfig(i)}getLayoutOptions(){return{grid_min_rows:1,grid_rows:1,grid_columns:2,grid_min_columns:1}}}function Ji(t,e,i,r){customElements.define(t,e),customElements.define(i,class extends r{constructor(){super(t)}})}Promise.all([Ni,Pi]).then((()=>{Ji("cb-lcars-base-card",Vi,"cb-lcars-base-card-editor",p),Ji("cb-lcars-label-card",Ui,"cb-lcars-label-card-editor",p),Ji("cb-lcars-elbow-card",qi,"cb-lcars-elbow-card-editor",p),Ji("cb-lcars-double-elbow-card",Wi,"cb-lcars-double-elbow-card-editor",p),Ji("cb-lcars-multimeter-card",Gi,"cb-lcars-multimeter-card-editor",p),Ji("cb-lcars-dpad-card",Zi,"cb-lcars-dpad-card-editor",p),Ji("cb-lcars-button-card",Yi,"cb-lcars-button-card-editor",p)})).catch((t=>{c("error","Error loading YAML configuration:",t)})),window.customCards=window.customCards||[];window.customCards.push({type:"cb-lcars-base-card",name:"CB-LCARS Base Card",description:"For advanced use: the CB-LCARS base card for full manual configuration.",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-label-card",name:"CB-LCARS Label",preview:!0,description:"CB-LCARS label card for text.",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-elbow-card",name:"CB-LCARS Elbow",preview:!0,description:"CB-LCARS Elbow card",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-double-elbow-card",name:"CB-LCARS Double Elbow",preview:!0,description:"CB-LCARS Double Elbow card",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-multimeter-card",name:"CB-LCARS Multimeter",preview:!0,description:"CB-LCARS Multimeter card",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-dpad-card",name:"CB-LCARS D-Pad",preview:!0,description:"CB-LCARS D-Pad card",documentationURL:"https://cb-lcars.unimatrix01.ca"},{type:"cb-lcars-button-card",name:"CB-LCARS Button",preview:!0,description:"CB-LCARS Buttons [various styles]",documentationURL:"https://cb-lcars.unimatrix01.ca"})},330:t=>{t.exports=JSON.parse('{"name":"cb-lcars","version":"2024.7.3-alpha.4","description":"Home Assistant LCARS libary built on custom-button-card","main":"index.js","author":"Jason Weyermars","license":"MIT","homepage":"https://cb-lcars.unimatrix01.ca","directories":{"doc":"doc"},"keywords":["HomeAssistant","Home Assistant","HASS","LCARS","Star Trek"],"scripts":{"clean":"rimraf dist","build":"webpack --mode production"},"devDependencies":{"clean-webpack-plugin":"^4.0.0","rimraf":"^6.0.1","webpack":"^5.94.0","webpack-bundle-analyzer":"^4.10.2","webpack-cli":"^5.1.4","webpack-dev-server":"^5.0.4"},"dependencies":{"ha-card-formbuilder":"github:snootched/ha-card-formbuilder","js-yaml":"^4.1.0"}}')}},n={};function s(t){var e=n[t];if(void 0!==e)return e.exports;var i=n[t]={exports:{}};return r[t](i,i.exports,s),i.exports}s.m=r,t=[],s.O=(e,i,r,n)=>{if(!i){var a=1/0;for(u=0;u<t.length;u++){for(var[i,r,n]=t[u],o=!0,l=0;l<i.length;l++)(!1&n||a>=n)&&Object.keys(s.O).every((t=>s.O[t](i[l])))?i.splice(l--,1):(o=!1,n<a&&(a=n));if(o){t.splice(u--,1);var c=r();void 0!==c&&(e=c)}}return e}n=n||0;for(var u=t.length;u>0&&t[u-1][2]>n;u--)t[u]=t[u-1];t[u]=[i,r,n]},s.d=(t,e)=>{for(var i in e)s.o(e,i)&&!s.o(t,i)&&Object.defineProperty(t,i,{enumerable:!0,get:e[i]})},s.f={},s.e=t=>Promise.all(Object.keys(s.f).reduce(((e,i)=>(s.f[i](t,e),e)),[])),s.u=t=>t+".js",s.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(t){if("object"==typeof window)return window}}(),s.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),e={},i="cb-lcars:",s.l=(t,r,n,a)=>{if(e[t])e[t].push(r);else{var o,l;if(void 0!==n)for(var c=document.getElementsByTagName("script"),u=0;u<c.length;u++){var d=c[u];if(d.getAttribute("src")==t||d.getAttribute("data-webpack")==i+n){o=d;break}}o||(l=!0,(o=document.createElement("script")).charset="utf-8",o.timeout=120,s.nc&&o.setAttribute("nonce",s.nc),o.setAttribute("data-webpack",i+n),o.src=t),e[t]=[r];var h=(i,r)=>{o.onerror=o.onload=null,clearTimeout(f);var n=e[t];if(delete e[t],o.parentNode&&o.parentNode.removeChild(o),n&&n.forEach((t=>t(r))),i)return i(r)},f=setTimeout(h.bind(null,void 0,{type:"timeout",target:o}),12e4);o.onerror=h.bind(null,o.onerror),o.onload=h.bind(null,o.onload),l&&document.head.appendChild(o)}},s.r=t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},(()=>{var t;s.g.importScripts&&(t=s.g.location+"");var e=s.g.document;if(!t&&e&&(e.currentScript&&"SCRIPT"===e.currentScript.tagName.toUpperCase()&&(t=e.currentScript.src),!t)){var i=e.getElementsByTagName("script");if(i.length)for(var r=i.length-1;r>-1&&(!t||!/^http(s?):/.test(t));)t=i[r--].src}if(!t)throw new Error("Automatic publicPath is not supported in this browser");t=t.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),s.p=t})(),(()=>{var t={382:0};s.f.j=(e,i)=>{var r=s.o(t,e)?t[e]:void 0;if(0!==r)if(r)i.push(r[2]);else{var n=new Promise(((i,n)=>r=t[e]=[i,n]));i.push(r[2]=n);var a=s.p+s.u(e),o=new Error;s.l(a,(i=>{if(s.o(t,e)&&(0!==(r=t[e])&&(t[e]=void 0),r)){var n=i&&("load"===i.type?"missing":i.type),a=i&&i.target&&i.target.src;o.message="Loading chunk "+e+" failed.\n("+n+": "+a+")",o.name="ChunkLoadError",o.type=n,o.request=a,r[1](o)}}),"chunk-"+e,e)}},s.O.j=e=>0===t[e];var e=(e,i)=>{var r,n,[a,o,l]=i,c=0;if(a.some((e=>0!==t[e]))){for(r in o)s.o(o,r)&&(s.m[r]=o[r]);if(l)var u=l(s)}for(e&&e(i);c<a.length;c++)n=a[c],s.o(t,n)&&t[n]&&t[n][0](),t[n]=0;return s.O(u)},i=self.webpackChunkcb_lcars=self.webpackChunkcb_lcars||[];i.forEach(e.bind(null,0)),i.push=e.bind(null,i.push.bind(i))})();var a=s.O(void 0,[569],(()=>s(630)));a=s.O(a)})();
//# sourceMappingURL=cb-lcars.js.map