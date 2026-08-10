import{y as d,r as T}from"./react-vendor-CFIUaLQ6.js";var At=Object.create,We=Object.defineProperty,Rt=Object.getOwnPropertyDescriptor,$e=Object.getOwnPropertyNames,Tt=Object.getPrototypeOf,zt=Object.prototype.hasOwnProperty,re=(e,t)=>function(){return t||(0,e[$e(e)[0]])((t={exports:{}}).exports,t),t.exports},Lt=(e,t,r,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of $e(t))!zt.call(e,n)&&n!==r&&We(e,n,{get:()=>t[n],enumerable:!(s=Rt(t,n))||s.enumerable});return e},Pt=(e,t,r)=>(r=e!=null?At(Tt(e)):{},Lt(!e||!e.__esModule?We(r,"default",{value:e,enumerable:!0}):r,e)),Mt=re({"node_modules/global/window.js"(e,t){var r;typeof window<"u"?r=window:typeof global<"u"?r=global:typeof self<"u"?r=self:r={},t.exports=r}}),Ot=re({"node_modules/is-function/index.js"(e,t){t.exports=s;var r=Object.prototype.toString;function s(n){if(!n)return!1;var a=r.call(n);return a==="[object Function]"||typeof n=="function"&&a!=="[object RegExp]"||typeof window<"u"&&(n===window.setTimeout||n===window.alert||n===window.confirm||n===window.prompt)}}}),_t=re({"node_modules/parse-headers/parse-headers.js"(e,t){var r=function(n){return n.replace(/^\s+|\s+$/g,"")},s=function(n){return Object.prototype.toString.call(n)==="[object Array]"};t.exports=function(n){if(!n)return{};for(var a={},l=r(n).split(`
`),u=0;u<l.length;u++){var f=l[u],c=f.indexOf(":"),v=r(f.slice(0,c)).toLowerCase(),A=r(f.slice(c+1));typeof a[v]>"u"?a[v]=A:s(a[v])?a[v].push(A):a[v]=[a[v],A]}return a}}}),It=re({"node_modules/xtend/immutable.js"(e,t){t.exports=s;var r=Object.prototype.hasOwnProperty;function s(){for(var n={},a=0;a<arguments.length;a++){var l=arguments[a];for(var u in l)r.call(l,u)&&(n[u]=l[u])}return n}}}),Bt=re({"node_modules/xhr/index.js"(e,t){var r=Mt(),s=Ot(),n=_t(),a=It();t.exports=c,t.exports.default=c,c.XMLHttpRequest=r.XMLHttpRequest||xt,c.XDomainRequest="withCredentials"in new c.XMLHttpRequest?c.XMLHttpRequest:r.XDomainRequest,l(["get","put","post","patch","head","delete"],function(o){c[o==="delete"?"del":o]=function(y,k,D){return k=f(y,k,D),k.method=o.toUpperCase(),v(k)}});function l(o,y){for(var k=0;k<o.length;k++)y(o[k])}function u(o){for(var y in o)if(o.hasOwnProperty(y))return!1;return!0}function f(o,y,k){var D=o;return s(y)?(k=y,typeof o=="string"&&(D={uri:o})):D=a(y,{uri:o}),D.callback=k,D}function c(o,y,k){return y=f(o,y,k),v(y)}function v(o){if(typeof o.callback>"u")throw new Error("callback argument missing");var y=!1,k=function(g,W,oe){y||(y=!0,o.callback(g,W,oe))};function D(){h.readyState===4&&setTimeout(Te,0)}function St(){var g=void 0;if(h.response?g=h.response:g=h.responseText||A(h),ze)try{g=JSON.parse(g)}catch{}return g}function ce(g){return clearTimeout(be),g instanceof Error||(g=new Error(""+(g||"Unknown XMLHttpRequest Error"))),g.statusCode=0,k(g,Le)}function Te(){if(!ae){var g;clearTimeout(be),o.useXDR&&h.status===void 0?g=200:g=h.status===1223?204:h.status;var W=Le,oe=null;return g!==0?(W={body:St(),statusCode:g,method:V,headers:{},url:fe,rawRequest:h},h.getAllResponseHeaders&&(W.headers=n(h.getAllResponseHeaders()))):oe=new Error("Internal XMLHttpRequest Error"),k(oe,W,W.body)}}var h=o.xhr||null;h||(o.cors||o.useXDR?h=new c.XDomainRequest:h=new c.XMLHttpRequest);var ie,ae,fe=h.url=o.uri||o.url,V=h.method=o.method||"GET",ge=o.body||o.data,O=h.headers=o.headers||{},me=!!o.sync,ze=!1,be,Le={body:void 0,headers:{},statusCode:0,method:V,url:fe,rawRequest:h};if("json"in o&&o.json!==!1&&(ze=!0,O.accept||O.Accept||(O.Accept="application/json"),V!=="GET"&&V!=="HEAD"&&(O["content-type"]||O["Content-Type"]||(O["Content-Type"]="application/json"),ge=JSON.stringify(o.json===!0?ge:o.json))),h.onreadystatechange=D,h.onload=Te,h.onerror=ce,h.onprogress=function(){},h.onabort=function(){ae=!0},h.ontimeout=ce,h.open(V,fe,!me,o.username,o.password),me||(h.withCredentials=!!o.withCredentials),!me&&o.timeout>0&&(be=setTimeout(function(){if(!ae){ae=!0,h.abort("timeout");var g=new Error("XMLHttpRequest timeout");g.code="ETIMEDOUT",ce(g)}},o.timeout)),h.setRequestHeader)for(ie in O)O.hasOwnProperty(ie)&&h.setRequestHeader(ie,O[ie]);else if(o.headers&&!u(o.headers))throw new Error("Headers cannot be set on an XDomainRequest object");return"responseType"in o&&(h.responseType=o.responseType),"beforeSend"in o&&typeof o.beforeSend=="function"&&o.beforeSend(h),h.send(ge||null),h}function A(o){try{if(o.responseType==="document")return o.responseXML;var y=o.responseXML&&o.responseXML.documentElement.nodeName==="parsererror";if(o.responseType===""&&!y)return o.responseXML}catch{}return null}function xt(){}}});function Se(e,t,...r){if(!e)throw new TypeError(Xe(t,r))}function Xe(e,t){let r=0;return e.replace(/%[os]/gu,()=>qe(t[r++]))}function qe(e){return typeof e!="object"||e===null?String(e):Object.prototype.toString.call(e)}var Dt;function Ft(e){try{let t=e instanceof Error?e:new Error(qe(e));if(typeof dispatchEvent=="function"&&typeof ErrorEvent=="function")dispatchEvent(new ErrorEvent("error",{error:t,message:t.message}));else if(typeof process<"u"&&typeof process.emit=="function"){process.emit("uncaughtException",t);return}console.error(t)}catch{}}var R=typeof window<"u"?window:typeof self<"u"?self:typeof global<"u"?global:typeof globalThis<"u"?globalThis:void 0,jt,j=class{constructor(e,t){this.code=e,this.message=t}warn(...e){var t;try{let r=((t=new Error().stack)!==null&&t!==void 0?t:"").replace(/^(?:.+?\n){2}/gu,`
`);console.warn(this.message,...e,r)}catch{}}},Ut=new j("W01","Unable to initialize event under dispatching."),Nt=new j("W02","Assigning any falsy value to 'cancelBubble' property has no effect."),Ht=new j("W03","Assigning any truthy value to 'returnValue' property has no effect."),Wt=new j("W04","Unable to preventDefault on non-cancelable events."),$t=new j("W05","Unable to preventDefault inside passive event listener invocation."),Xt=new j("W06","An event listener wasn't added because it has been added already: %o, %o"),ve=new j("W07","The %o option value was abandoned because the event listener wasn't added as duplicated."),Pe=new j("W08","The 'callback' argument must be a function or an object that has 'handleEvent' method: %o"),B=class{static get NONE(){return Me}static get CAPTURING_PHASE(){return Oe}static get AT_TARGET(){return _e}static get BUBBLING_PHASE(){return Ie}constructor(e,t){Object.defineProperty(this,"isTrusted",{value:!1,enumerable:!0});let r=t??{};Ce.set(this,{type:String(e),bubbles:!!r.bubbles,cancelable:!!r.cancelable,composed:!!r.composed,target:null,currentTarget:null,stopPropagationFlag:!1,stopImmediatePropagationFlag:!1,canceledFlag:!1,inPassiveListenerFlag:!1,dispatchFlag:!1,timeStamp:Date.now()})}get type(){return b(this).type}get target(){return b(this).target}get srcElement(){return b(this).target}get currentTarget(){return b(this).currentTarget}composedPath(){let e=b(this).currentTarget;return e?[e]:[]}get NONE(){return Me}get CAPTURING_PHASE(){return Oe}get AT_TARGET(){return _e}get BUBBLING_PHASE(){return Ie}get eventPhase(){return b(this).dispatchFlag?2:0}stopPropagation(){b(this).stopPropagationFlag=!0}get cancelBubble(){return b(this).stopPropagationFlag}set cancelBubble(e){e?b(this).stopPropagationFlag=!0:Nt.warn()}stopImmediatePropagation(){let e=b(this);e.stopPropagationFlag=e.stopImmediatePropagationFlag=!0}get bubbles(){return b(this).bubbles}get cancelable(){return b(this).cancelable}get returnValue(){return!b(this).canceledFlag}set returnValue(e){e?Ht.warn():Be(b(this))}preventDefault(){Be(b(this))}get defaultPrevented(){return b(this).canceledFlag}get composed(){return b(this).composed}get isTrusted(){return!1}get timeStamp(){return b(this).timeStamp}initEvent(e,t=!1,r=!1){let s=b(this);if(s.dispatchFlag){Ut.warn();return}Ce.set(this,{...s,type:String(e),bubbles:!!t,cancelable:!!r,target:null,currentTarget:null,stopPropagationFlag:!1,stopImmediatePropagationFlag:!1,canceledFlag:!1})}},Me=0,Oe=1,_e=2,Ie=3,Ce=new WeakMap;function b(e,t="this"){let r=Ce.get(e);return Se(r!=null,"'%s' must be an object that Event constructor created, but got another one: %o",t,e),r}function Be(e){if(e.inPassiveListenerFlag){$t.warn();return}if(!e.cancelable){Wt.warn();return}e.canceledFlag=!0}Object.defineProperty(B,"NONE",{enumerable:!0});Object.defineProperty(B,"CAPTURING_PHASE",{enumerable:!0});Object.defineProperty(B,"AT_TARGET",{enumerable:!0});Object.defineProperty(B,"BUBBLING_PHASE",{enumerable:!0});var ye=Object.getOwnPropertyNames(B.prototype);for(let e=0;e<ye.length;++e)ye[e]!=="constructor"&&Object.defineProperty(B.prototype,ye[e],{enumerable:!0});typeof R<"u"&&typeof R.Event<"u"&&Object.setPrototypeOf(B.prototype,R.Event.prototype);function qt(e){return R.DOMException?new R.DOMException(e,"InvalidStateError"):($==null&&($=class Ve extends Error{constructor(r){super(r),Error.captureStackTrace&&Error.captureStackTrace(this,Ve)}get code(){return 11}get name(){return"InvalidStateError"}},Object.defineProperties($.prototype,{code:{enumerable:!0},name:{enumerable:!0}}),Fe($),Fe($.prototype)),new $(e))}var $,De={INDEX_SIZE_ERR:1,DOMSTRING_SIZE_ERR:2,HIERARCHY_REQUEST_ERR:3,WRONG_DOCUMENT_ERR:4,INVALID_CHARACTER_ERR:5,NO_DATA_ALLOWED_ERR:6,NO_MODIFICATION_ALLOWED_ERR:7,NOT_FOUND_ERR:8,NOT_SUPPORTED_ERR:9,INUSE_ATTRIBUTE_ERR:10,INVALID_STATE_ERR:11,SYNTAX_ERR:12,INVALID_MODIFICATION_ERR:13,NAMESPACE_ERR:14,INVALID_ACCESS_ERR:15,VALIDATION_ERR:16,TYPE_MISMATCH_ERR:17,SECURITY_ERR:18,NETWORK_ERR:19,ABORT_ERR:20,URL_MISMATCH_ERR:21,QUOTA_EXCEEDED_ERR:22,TIMEOUT_ERR:23,INVALID_NODE_TYPE_ERR:24,DATA_CLONE_ERR:25};function Fe(e){let t=Object.keys(De);for(let r=0;r<t.length;++r){let s=t[r],n=De[s];Object.defineProperty(e,s,{get(){return n},configurable:!0,enumerable:!0})}}var de=class extends B{static wrap(e){return new(Ye(e))(e)}constructor(e){super(e.type,{bubbles:e.bubbles,cancelable:e.cancelable,composed:e.composed}),e.cancelBubble&&super.stopPropagation(),e.defaultPrevented&&super.preventDefault(),Ge.set(this,{original:e});let t=Object.keys(e);for(let r=0;r<t.length;++r){let s=t[r];s in this||Object.defineProperty(this,s,Ke(e,s))}}stopPropagation(){super.stopPropagation();let{original:e}=F(this);"stopPropagation"in e&&e.stopPropagation()}get cancelBubble(){return super.cancelBubble}set cancelBubble(e){super.cancelBubble=e;let{original:t}=F(this);"cancelBubble"in t&&(t.cancelBubble=e)}stopImmediatePropagation(){super.stopImmediatePropagation();let{original:e}=F(this);"stopImmediatePropagation"in e&&e.stopImmediatePropagation()}get returnValue(){return super.returnValue}set returnValue(e){super.returnValue=e;let{original:t}=F(this);"returnValue"in t&&(t.returnValue=e)}preventDefault(){super.preventDefault();let{original:e}=F(this);"preventDefault"in e&&e.preventDefault()}get timeStamp(){let{original:e}=F(this);return"timeStamp"in e?e.timeStamp:super.timeStamp}},Ge=new WeakMap;function F(e){let t=Ge.get(e);return Se(t!=null,"'this' is expected an Event object, but got",e),t}var he=new WeakMap;he.set(Object.prototype,de);typeof R<"u"&&typeof R.Event<"u"&&he.set(R.Event.prototype,de);function Ye(e){let t=Object.getPrototypeOf(e);if(t==null)return de;let r=he.get(t);return r==null&&(r=Vt(Ye(t),t),he.set(t,r)),r}function Vt(e,t){class r extends e{}let s=Object.keys(t);for(let n=0;n<s.length;++n)Object.defineProperty(r.prototype,s[n],Ke(t,s[n]));return r}function Ke(e,t){let r=Object.getOwnPropertyDescriptor(e,t);return{get(){let s=F(this).original,n=s[t];return typeof n=="function"?n.bind(s):n},set(s){let n=F(this).original;n[t]=s},configurable:r.configurable,enumerable:r.enumerable}}function Gt(e,t,r,s,n,a){return{callback:e,flags:(t?1:0)|(r?2:0)|(s?4:0),signal:n,signalListener:a}}function Yt(e){e.flags|=8}function Ze(e){return(e.flags&1)===1}function Qe(e){return(e.flags&2)===2}function Je(e){return(e.flags&4)===4}function Kt(e){return(e.flags&8)===8}function Zt({callback:e},t,r){try{typeof e=="function"?e.call(t,r):typeof e.handleEvent=="function"&&e.handleEvent(r)}catch(s){Ft(s)}}function et({listeners:e},t,r){for(let s=0;s<e.length;++s)if(e[s].callback===t&&Ze(e[s])===r)return s;return-1}function Qt(e,t,r,s,n,a){let l;a&&(l=tt.bind(null,e,t,r),a.addEventListener("abort",l));let u=Gt(t,r,s,n,a,l);return e.cow?(e.cow=!1,e.listeners=[...e.listeners,u]):e.listeners.push(u),u}function tt(e,t,r){let s=et(e,t,r);return s!==-1?rt(e,s):!1}function rt(e,t,r=!1){let s=e.listeners[t];return Yt(s),s.signal&&s.signal.removeEventListener("abort",s.signalListener),e.cow&&!r?(e.cow=!1,e.listeners=e.listeners.filter((n,a)=>a!==t),!1):(e.listeners.splice(t,1),!0)}function Jt(){return Object.create(null)}function er(e,t){var r;return(r=e[t])!==null&&r!==void 0?r:e[t]={attrCallback:void 0,attrListener:void 0,cow:!1,listeners:[]}}var pe=class{constructor(){st.set(this,Jt())}addEventListener(e,t,r){let s=Ee(this),{callback:n,capture:a,once:l,passive:u,signal:f,type:c}=tr(e,t,r);if(n==null||f!=null&&f.aborted)return;let v=er(s,c),A=et(v,n,a);if(A!==-1){sr(v.listeners[A],u,l,f);return}Qt(v,n,a,u,l,f)}removeEventListener(e,t,r){let s=Ee(this),{callback:n,capture:a,type:l}=rr(e,t,r),u=s[l];n!=null&&u&&tt(u,n,a)}dispatchEvent(e){let t=Ee(this)[String(e.type)];if(t==null)return!0;let r=e instanceof B?e:de.wrap(e),s=b(r,"event");if(s.dispatchFlag)throw qt("This event has been in dispatching.");if(s.dispatchFlag=!0,s.target=s.currentTarget=this,!s.stopPropagationFlag){let{cow:n,listeners:a}=t;t.cow=!0;for(let l=0;l<a.length;++l){let u=a[l];if(!Kt(u)&&(Je(u)&&rt(t,l,!n)&&(l-=1),s.inPassiveListenerFlag=Qe(u),Zt(u,this,r),s.inPassiveListenerFlag=!1,s.stopImmediatePropagationFlag))break}n||(t.cow=!1)}return s.target=null,s.currentTarget=null,s.stopImmediatePropagationFlag=!1,s.stopPropagationFlag=!1,s.dispatchFlag=!1,!s.canceledFlag}},st=new WeakMap;function Ee(e,t="this"){let r=st.get(e);return Se(r!=null,"'%s' must be an object that EventTarget constructor created, but got another one: %o",t,e),r}function tr(e,t,r){var s;return nt(t),typeof r=="object"&&r!==null?{type:String(e),callback:t??void 0,capture:!!r.capture,passive:!!r.passive,once:!!r.once,signal:(s=r.signal)!==null&&s!==void 0?s:void 0}:{type:String(e),callback:t??void 0,capture:!!r,passive:!1,once:!1,signal:void 0}}function rr(e,t,r){return nt(t),typeof r=="object"&&r!==null?{type:String(e),callback:t??void 0,capture:!!r.capture}:{type:String(e),callback:t??void 0,capture:!!r}}function nt(e){if(!(typeof e=="function"||typeof e=="object"&&e!==null&&typeof e.handleEvent=="function")){if(e==null||typeof e=="object"){Pe.warn(e);return}throw new TypeError(Xe(Pe.message,[e]))}}function sr(e,t,r,s){Xt.warn(Ze(e)?"capture":"bubble",e.callback),Qe(e)!==t&&ve.warn("passive"),Je(e)!==r&&ve.warn("once"),e.signal!==s&&ve.warn("signal")}var ke=Object.getOwnPropertyNames(pe.prototype);for(let e=0;e<ke.length;++e)ke[e]!=="constructor"&&Object.defineProperty(pe.prototype,ke[e],{enumerable:!0});typeof R<"u"&&typeof R.EventTarget<"u"&&Object.setPrototypeOf(pe.prototype,R.EventTarget.prototype);var nr=Pt(Bt()),Ae=30720,se=512e3,ne=256,ee=(e,{minChunkSize:t=ne,maxChunkSize:r=se}={})=>e==null||typeof e=="number"&&e>=256&&e%256===0&&e>=t&&e<=r,te=(e,{minChunkSize:t=ne,maxChunkSize:r=se}={})=>new TypeError(`chunkSize ${e} must be a positive number in multiples of 256, between ${t} and ${r}`),ir=class{constructor(e,t={}){this.readableStream=e;var r,s,n;if(!ee(t.defaultChunkSize,t))throw te(t.defaultChunkSize,t);this.defaultChunkSize=(r=t.defaultChunkSize)!=null?r:Ae,this.minChunkSize=(s=t.minChunkSize)!=null?s:ne,this.maxChunkSize=(n=t.maxChunkSize)!=null?n:se}get chunkSize(){var e;return(e=this._chunkSize)!=null?e:this.defaultChunkSize}set chunkSize(e){if(!ee(e,this))throw te(e,this);this._chunkSize=e}get chunkByteSize(){return this.chunkSize*1024}get error(){return this._error}async*[Symbol.asyncIterator](){let e,t=this.readableStream.getReader();try{for(;;){let{done:r,value:s}=await t.read();if(r){if(e){let a=e;e=void 0,yield a}break}let n=s instanceof Uint8Array?new Blob([s],{type:"application/octet-stream"}):s;for(e=e?new Blob([e,n]):n;e;)if(e.size===this.chunkByteSize){let a=e;e=void 0,yield a;break}else{if(e.size<this.chunkByteSize)break;{let a=e.slice(0,this.chunkByteSize);e=e.slice(this.chunkByteSize),yield a}}}}catch(r){this._error=r}finally{if(e){let r=e;e=void 0,yield r}t.releaseLock();return}}},ar=class{constructor(e,t={}){this.file=e;var r,s,n;if(!ee(t.defaultChunkSize,t))throw te(t.defaultChunkSize,t);this.defaultChunkSize=(r=t.defaultChunkSize)!=null?r:Ae,this.minChunkSize=(s=t.minChunkSize)!=null?s:ne,this.maxChunkSize=(n=t.maxChunkSize)!=null?n:se}get chunkSize(){var e;return(e=this._chunkSize)!=null?e:this.defaultChunkSize}set chunkSize(e){if(!ee(e,this))throw te(e,this);this._chunkSize=e}get chunkByteSize(){return this.chunkSize*1024}get error(){return this._error}async*[Symbol.asyncIterator](){let e=new FileReader,t=0,r=()=>new Promise(s=>{if(t>=this.file.size){s(void 0);return}let n=Math.min(this.chunkByteSize,this.file.size-t);e.onload=()=>{e.result!==null?s(new Blob([e.result],{type:"application/octet-stream"})):s(void 0)},e.readAsArrayBuffer(this.file.slice(t,t+n))});try{for(;;){let s=await r();if(s)t+=s.size,yield s;else break}}catch(s){this._error=s}}},or=[200,201,202,204,308],it=[408,502,503,504],lr=[308],at=(e,t)=>!!e&&or.includes(e.statusCode),ur=(e,{retryCodes:t=it})=>!e||t.includes(e.statusCode),hr=(e,t)=>t.attemptCount>=t.attempts||!(at(e)||ur(e,t)),dr=(e,t)=>{var r;if(!e||!lr.includes(e.statusCode)||!((r=e.headers)!=null&&r.range))return!1;let s=e.headers.range.match(/bytes=(\d+)-(\d+)/);return s?parseInt(s[2],10)<t.currentChunkEndByte:!1},ot=class{static createUpload(e){return new ot(e)}constructor(e){if(this.eventTarget=new pe,this.endpoint=e.endpoint,this.file=e.file,this.headers=e.headers||{},this.method=e.method||"PUT",this.attempts=e.attempts||5,this.delayBeforeAttempt=e.delayBeforeAttempt||1,this.retryCodes=e.retryCodes||it,this.dynamicChunkSize=e.dynamicChunkSize||!1,this.maxFileBytes=(e.maxFileSize||0)*1024,this.chunkCount=0,this.attemptCount=0,this._offline=typeof window<"u"&&!window.navigator.onLine,this._paused=!1,this.success=!1,this.nextChunkRangeStart=0,e.useLargeFileWorkaround){let t=r=>{this.chunkedIterable.error&&(console.warn(`Unable to read file of size ${this.file.size} bytes via a ReadableStream. Falling back to in-memory FileReader!`),r.stopImmediatePropagation(),this.chunkedIterable=new ar(this.file,{...e,defaultChunkSize:e.chunkSize}),this.chunkedIterator=this.chunkedIterable[Symbol.asyncIterator](),this.getEndpoint().then(()=>{this.sendChunks()}).catch(s=>{let n=s!=null&&s.message?`: ${s.message}`:"";this.dispatch("error",{message:`Failed to get endpoint${n}`})}),this.off("error",t))};this.on("error",t)}this.chunkedIterable=new ir(this.file.stream(),{...e,defaultChunkSize:e.chunkSize}),this.chunkedIterator=this.chunkedIterable[Symbol.asyncIterator](),this.totalChunks=Math.ceil(this.file.size/this.chunkByteSize),this.validateOptions(),this.getEndpoint().then(()=>this.sendChunks()).catch(t=>{let r=t!=null&&t.message?`: ${t.message}`:"";this.dispatch("error",{message:`Failed to get endpoint${r}`})}),typeof window<"u"&&(window.addEventListener("online",()=>{this.offline&&(this._offline=!1,this.dispatch("online"),this.sendChunks())}),window.addEventListener("offline",()=>{this.offline||(this._offline=!0,this.dispatch("offline"))}))}get maxChunkSize(){var e,t;return(t=(e=this.chunkedIterable)==null?void 0:e.maxChunkSize)!=null?t:se}get minChunkSize(){var e,t;return(t=(e=this.chunkedIterable)==null?void 0:e.minChunkSize)!=null?t:ne}get chunkSize(){var e,t;return(t=(e=this.chunkedIterable)==null?void 0:e.chunkSize)!=null?t:Ae}set chunkSize(e){this.chunkedIterable.chunkSize=e}get chunkByteSize(){return this.chunkedIterable.chunkByteSize}get totalChunkSize(){return Math.ceil(this.file.size/this.chunkByteSize)}on(e,t){this.eventTarget.addEventListener(e,t)}once(e,t){this.eventTarget.addEventListener(e,t,{once:!0})}off(e,t){this.eventTarget.removeEventListener(e,t)}get offline(){return this._offline}get paused(){return this._paused}abort(){var e;this.pause(),(e=this.currentXhr)==null||e.abort()}pause(){this._paused=!0}resume(){this._paused&&(this._paused=!1,this.sendChunks())}get successfulPercentage(){return this.nextChunkRangeStart/this.file.size}dispatch(e,t){let r=new CustomEvent(e,{detail:t});this.eventTarget.dispatchEvent(r)}validateOptions(){if(!this.endpoint||typeof this.endpoint!="function"&&typeof this.endpoint!="string")throw new TypeError("endpoint must be defined as a string or a function that returns a promise");if(!(this.file instanceof File))throw new TypeError("file must be a File object");if(this.headers&&typeof this.headers!="function"&&typeof this.headers!="object")throw new TypeError("headers must be null, an object, or a function that returns an object or a promise");if(!ee(this.chunkSize,{maxChunkSize:this.maxChunkSize,minChunkSize:this.minChunkSize}))throw te(this.chunkSize,{maxChunkSize:this.maxChunkSize,minChunkSize:this.minChunkSize});if(this.maxChunkSize&&(typeof this.maxChunkSize!="number"||this.maxChunkSize<256||this.maxChunkSize%256!==0||this.maxChunkSize<this.chunkSize||this.maxChunkSize<this.minChunkSize))throw new TypeError(`maxChunkSize must be a positive number in multiples of 256, and larger than or equal to both ${this.minChunkSize} and ${this.chunkSize}`);if(this.minChunkSize&&(typeof this.minChunkSize!="number"||this.minChunkSize<256||this.minChunkSize%256!==0||this.minChunkSize>this.chunkSize||this.minChunkSize>this.maxChunkSize))throw new TypeError(`minChunkSize must be a positive number in multiples of 256, and smaller than ${this.chunkSize} and ${this.maxChunkSize}`);if(this.maxFileBytes>0&&this.maxFileBytes<this.file.size)throw new Error(`file size exceeds maximum (${this.file.size} > ${this.maxFileBytes})`);if(this.attempts&&(typeof this.attempts!="number"||this.attempts<=0))throw new TypeError("retries must be a positive number");if(this.delayBeforeAttempt&&(typeof this.delayBeforeAttempt!="number"||this.delayBeforeAttempt<0))throw new TypeError("delayBeforeAttempt must be a positive number")}getEndpoint(){return typeof this.endpoint=="string"?(this.endpointValue=this.endpoint,Promise.resolve(this.endpoint)):this.endpoint(this.file).then(e=>{if(this.endpointValue=e,typeof e!="string")throw new TypeError("endpoint must return a string");return this.endpointValue})}xhrPromise(e){let t=r=>{r.upload.onprogress=s=>{var n;let a=this.totalChunks-this.chunkCount,l=(this.file.size-this.nextChunkRangeStart)/this.file.size/a,u=s.loaded/((n=s.total)!=null?n:this.chunkByteSize)*l;this.dispatch("progress",Math.min((this.successfulPercentage+u)*100,100))}};return new Promise((r,s)=>{this.currentXhr=(0,nr.default)({...e,beforeSend:t},(n,a)=>(this.currentXhr=void 0,n?s(n):r(a)))})}async sendChunk(e){let t=this.nextChunkRangeStart,r=t+e.size-1,s={...await(typeof this.headers=="function"?this.headers():this.headers),"Content-Type":this.file.type,"Content-Range":`bytes ${t}-${r}/${this.file.size}`};return this.dispatch("attempt",{chunkNumber:this.chunkCount,totalChunks:this.totalChunks,chunkSize:this.chunkSize}),this.xhrPromise({headers:s,url:this.endpointValue,method:this.method,body:e})}async sendChunkWithRetries(e){let t=async(l,u)=>{var f;let c=(new Date().getTime()-this.lastChunkStart.getTime())/1e3;if(this.dispatch("chunkSuccess",{chunk:this.chunkCount,chunkSize:this.chunkSize,attempts:this.attemptCount,timeInterval:c,response:l}),this.attemptCount=0,this.chunkCount=((f=this.chunkCount)!=null?f:0)+1,this.nextChunkRangeStart=this.nextChunkRangeStart+this.chunkByteSize,this.dynamicChunkSize){let v=this.chunkSize;c<10?v=Math.min(this.chunkSize*2,this.maxChunkSize):c>30&&(v=Math.max(this.chunkSize/2,this.minChunkSize)),this.chunkSize=Math.ceil(v/256)*256;let A=(this.file.size-this.nextChunkRangeStart)/this.chunkByteSize;this.totalChunks=Math.ceil(this.chunkCount+A)}return!0},r=async(l,u)=>(this.dispatch("progress",Math.min(this.successfulPercentage*100,100)),this.dispatch("error",{message:`Server responded with ${l.statusCode}. Stopping upload.`,chunk:this.chunkCount,attempts:this.attemptCount,response:l}),!1),s=async(l,u)=>(this.dispatch("attemptFailure",{message:`An error occured uploading chunk ${this.chunkCount}. ${this.attempts-this.attemptCount} retries left.`,chunkNumber:this.chunkCount,attemptsLeft:this.attempts-this.attemptCount,response:l}),new Promise(f=>{setTimeout(async()=>{if(this._paused||this.offline){this.pendingChunk=e,f(!1);return}let c=await this.sendChunkWithRetries(e);f(c)},this.delayBeforeAttempt*1e3)})),n;try{this.attemptCount=this.attemptCount+1,this.lastChunkStart=new Date,n=await this.sendChunk(e)}catch(l){typeof l?.statusCode=="number"&&(n=l)}let a={retryCodes:this.retryCodes,attemptCount:this.attemptCount,attempts:this.attempts,currentChunkEndByte:this.nextChunkRangeStart+e.size-1};return dr(n,a)?s(n):at(n)?t(n):hr(n,a)?r(n):s(n)}async sendChunks(){if(this.pendingChunk&&!(this._paused||this.offline)){let e=this.pendingChunk;this.pendingChunk=void 0;let t=await this.sendChunkWithRetries(e);this.success&&t&&this.dispatch("success")}for(;!(this.success||this._paused||this.offline);){let{value:e,done:t}=await this.chunkedIterator.next(),r=!e&&t;if(e&&(r=await this.sendChunkWithRetries(e)),this.chunkedIterable.error){r=!1,this.dispatch("error",{message:`Unable to read file of size ${this.file.size} bytes. Try loading from another browser.`});return}if(this.success=!!t,this.success&&r&&this.dispatch("success"),!r)return}}},pr=Object.defineProperty,lt=e=>{throw TypeError(e)},cr=(e,t)=>{for(var r in t)pr(e,r,{get:t[r],enumerable:!0})},ut=(e,t,r)=>t.has(e)||lt("Cannot "+r),i=(e,t,r)=>(ut(e,t,"read from private field"),r?r.call(e):t.get(e)),w=(e,t,r)=>t.has(e)?lt("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),C=(e,t,r,s)=>(ut(e,t,"write to private field"),t.set(e,r),r),ht={};cr(ht,{ProgressTypes:()=>q});var q={BAR:"bar",RADIAL:"radial",PERCENTAGE:"percentage"},xe={"Drop a video file here to upload":"Drop a video file here to upload",or:"or","Upload complete!":"Upload complete!",Retry:"Retry","Pausing...":"Pausing...",Resume:"Resume",Pause:"Pause","Upload a video":"Upload a video","No url or endpoint specified - cannot handle upload":"No url or endpoint specified - cannot handle upload"},fr={"Drop a video file here to upload":"Arrastra un archivo de video aquí para subir",or:"o","Upload complete!":"¡Subida completada!",Retry:"Reintentar","Pausing...":"Pausando...",Resume:"Reanudar",Pause:"Pausar","Upload a video":"Subir un video","No url or endpoint specified - cannot handle upload":"No se especificó URL o endpoint - no se puede manejar la subida"},gr={"Drop a video file here to upload":"Déposez un fichier vidéo ici pour le télécharger",or:"ou","Upload complete!":"Téléchargement terminé!",Retry:"Réessayer","Pausing...":"En pause...",Resume:"Reprendre",Pause:"Pause","Upload a video":"Télécharger une vidéo","No url or endpoint specified - cannot handle upload":"Aucune URL ou point de terminaison spécifié - impossible de gérer le téléchargement"},mr={"Drop a video file here to upload":"Legen Sie hier eine Videodatei zum Hochladen ab",or:"oder","Upload complete!":"Upload abgeschlossen!",Retry:"Wiederholen","Pausing...":"Pausiere...",Resume:"Fortsetzen",Pause:"Pausieren","Upload a video":"Video hochladen","No url or endpoint specified - cannot handle upload":"Keine URL oder Endpunkt angegeben - Upload kann nicht verarbeitet werden"},br={"Drop a video file here to upload":"Arraste um arquivo de vídeo aqui para fazer o upload",or:"ou","Upload complete!":"Upload completo!",Retry:"Tentar novamente","Pausing...":"Pausando...",Resume:"Retomar",Pause:"Pausar","Upload a video":"Fazer upload de um vídeo","No url or endpoint specified - cannot handle upload":"Nenhum URL ou endpoint especificado - não é possível processar o upload"},vr={"Drop a video file here to upload":"Trascina qui un file video per caricarlo",or:"o","Upload complete!":"Caricamento completato!",Retry:"Riprova","Pausing...":"In pausa...",Resume:"Riprendi",Pause:"Pausa","Upload a video":"Carica un video","No url or endpoint specified - cannot handle upload":"Nessun URL o endpoint specificato - impossibile gestire il caricamento"},yr={"Drop a video file here to upload":"将视频文件拖放到此处以上传",or:"或","Upload complete!":"上传完成！",Retry:"重试","Pausing...":"暂停...",Resume:"继续",Pause:"暂停","Upload a video":"上传视频","No url or endpoint specified - cannot handle upload":"未指定 URL 或 endpoint - 无法处理上传"},Er={en:xe,es:fr,fr:gr,de:mr,pt:br,it:vr,zh:yr},kr=()=>typeof globalThis.navigator>"u"||!globalThis.navigator.language?"en":globalThis.navigator.language.split("-")[0],je=["en","es","fr","de","pt","it","zh"],wr=e=>{if(e&&je.includes(e))return e;let t=kr();return je.includes(t)?t:"en"},P=(e,t)=>{let r=wr(t);return(Er[r]||xe)[e]||xe[e]},dt=class{addEventListener(){}removeEventListener(){}dispatchEvent(e){return!0}};if(typeof DocumentFragment>"u"){class e extends dt{}globalThis.DocumentFragment=e}var Re=class extends dt{},Cr={get(e){},define(e,t,r){},getName(e){return null},upgrade(e){},whenDefined(e){return Promise.resolve(Re)}};function xr(e,t){return new Re}var pt={document:{createElement:xr},customElements:Cr,HTMLElement:Re},ct=typeof window>"u"||typeof globalThis.customElements>"u",p=ct?pt:globalThis,M=ct?pt.document:globalThis.document,ft=(e,t)=>e?e.closest(t)||ft(e.getRootNode().host,t):null,U=e=>{let t=e.getAttribute("mux-uploader");return t?document.getElementById(t):ft(e,"mux-uploader")},gt=M.createElement("template");gt.innerHTML=`
<style>
  :host {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed #ccc;
    padding: 2.5rem 2rem;
    border-radius: .25rem;
  }

  slot[name='heading'] > * {
    margin-bottom: 0.75rem;
    font-size: 1.75rem;
    text-align: center;
  }

  slot[name='separator'] > * {
    margin-bottom: 0.75rem;
  }

  #overlay {
    display: none;
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    height: 100%;
    width: 100%;
  }

  :host([active][overlay]) > #overlay {
    background: var(--overlay-background-color, rgba(226, 253, 255, 0.95));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  :host([file-ready])::part(heading),
  :host([file-ready])::part(separator) {
    display: none;
  }
</style>

<slot name="heading" part="heading">
  <span id="drop-text">Drop a video file here to upload</span>
</slot>
<slot name="separator" part="separator">
  <span id="separator-text">or</span>
</slot>
<slot></slot>

<div id="overlay">
  <h1 id="overlay-label"></h1>
</div>
`;var we={MUX_UPLOADER:"mux-uploader",OVERLAY_TEXT:"overlay-text"},ue,x,G,Ue=class extends p.HTMLElement{constructor(){super(),w(this,ue),w(this,x),w(this,G);let e=this.attachShadow({mode:"open"});e.appendChild(gt.content.cloneNode(!0)),C(this,ue,e.getElementById("overlay-label"))}connectedCallback(){if(C(this,x,U(this)),C(this,G,new AbortController),i(this,x)){let e={signal:i(this,G).signal};i(this,x).addEventListener("file-ready",()=>this.toggleAttribute("file-ready",!0),e),i(this,x).addEventListener("uploadstart",()=>this.toggleAttribute("upload-in-progress",!0),e),i(this,x).addEventListener("success",()=>{this.toggleAttribute("upload-in-progress",!1),this.toggleAttribute("upload-complete",!0)},e),i(this,x).addEventListener("reset",()=>{this.toggleAttribute("file-ready",!1),this.toggleAttribute("upload-in-progress",!1),this.toggleAttribute("upload-complete",!1)},e),this.setupDragEvents(e),this.toggleAttribute("upload-in-progress",i(this,x).hasAttribute("upload-in-progress")),this.toggleAttribute("upload-complete",i(this,x).hasAttribute("upload-complete")),this.toggleAttribute("file-ready",i(this,x).hasAttribute("file-ready")),i(this,x).addEventListener("localechange",()=>this.updateText(),e),this.updateText()}}disconnectedCallback(){var e;(e=i(this,G))==null||e.abort()}attributeChangedCallback(e,t,r){e===we.OVERLAY_TEXT&&t!==r?i(this,ue).innerHTML=r??"":e==="active"&&this.hasAttribute("overlay")&&r!=null&&(this._currentDragTarget=this)}static get observedAttributes(){return[we.OVERLAY_TEXT,we.MUX_UPLOADER,"active"]}setupDragEvents(e){this.addEventListener("dragenter",t=>{this._currentDragTarget=t.target,t.preventDefault(),t.stopPropagation(),this.toggleAttribute("active",!0)},e),this.addEventListener("dragleave",t=>{this._currentDragTarget===t.target&&(this._currentDragTarget=void 0,this.toggleAttribute("active",!1))},e),this.addEventListener("dragover",t=>{t.preventDefault(),t.stopPropagation()},e),this.addEventListener("drop",t=>{var r;t.preventDefault(),t.stopPropagation();let{dataTransfer:s}=t,{files:n}=s,a=n[0];((r=i(this,x))!=null?r:this).dispatchEvent(new CustomEvent("file-ready",{composed:!0,bubbles:!0,detail:a})),this.removeAttribute("active")},e)}updateText(){var e,t,r;let s=(e=i(this,x))==null?void 0:e.locale,n=(t=this.shadowRoot)==null?void 0:t.getElementById("drop-text"),a=(r=this.shadowRoot)==null?void 0:r.getElementById("separator-text");n&&(n.textContent=P("Drop a video file here to upload",s)),a&&(a.textContent=P("or",s))}};ue=new WeakMap,x=new WeakMap,G=new WeakMap;p.customElements.get("mux-uploader-drop")||(p.customElements.define("mux-uploader-drop",Ue),p.MuxUploaderDropElement=Ue);function Sr(e){return`${Math.floor(e)}%`}var mt=M.createElement("template"),Ar="Media upload progress bar";mt.innerHTML=`
<style>
  :host {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  .bar-type {
    background: var(--progress-bar-background-color, #e6e6e6);
    border-radius: var(--progress-bar-border-radius, 100px);
    height: var(--progress-bar-height, 4px);
    width: 100%;
  }

  .radial-type,
  .bar-type,
  #percentage-type,
  :host([type="bar"][upload-error]) #percentage-type {
    display: none;
  }

  :host([type="radial"][upload-in-progress]) .radial-type,
  :host([type="bar"][upload-in-progress]) .bar-type {
    display: block;
  }

  :host([type="percentage"][upload-in-progress]) #percentage-type {
    display: var(--progress-percentage-display, block);
  }

  :host([type="bar"][upload-error]) .progress-bar {
    background: #e22c3e;
  }

  .progress-bar {
    box-shadow: var(--progress-bar-box-shadow, 0 10px 40px -10px #fff);
    border-radius: var(--progress-bar-border-radius, 100px);
    background: var(--progress-bar-fill-color, #000000);
    height: var(--progress-bar-height, 4px);
    width: 0%;
    transition: width 0.25s;
  }

  circle {
    stroke: var(--progress-radial-fill-color, black);
    stroke-width: 6;  /* Thickness of the circle */
    fill: transparent; /* Make inside of the circle see-through */

    /* Animation */
    transition: 0.35s;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    -webkit-transform-origin: 50% 50%;
    -moz-transform-origin: 50% 50%;
  }

  #percentage-type {
    font-size: inherit;
    margin: 0 0 1em;
  }
</style>

<slot></slot>

<p id="percentage-type"></p>
<div class="bar-type">
  <div role="progressbar" aria-valuemin="0" aria-valuemax="100" class="progress-bar" id="progress-bar" tabindex="0"></div>
</div>
<div class="radial-type">
  <svg
    width="120"
    height="120">
    <!-- To prevent overflow of the SVG wrapper, radius must be  (svgWidth / 2) - (circleStrokeWidth * 2)
      or use overflow: visible on the svg.-->
    <circle
      r="52"
      cx="60"
      cy="60"
    />
  <svg>
</div>
`;var z,Y,Rr=class extends p.HTMLElement{constructor(){var e,t,r,s;super(),w(this,z),w(this,Y),this.onUploadStart=()=>{var n;(n=this.progressBar)==null||n.focus(),this.toggleAttribute("upload-in-progress",!0)},this.onProgress=n=>{var a;let l=n.detail;switch((a=this.progressBar)==null||a.setAttribute("aria-valuenow",`${Math.floor(l)}`),this.getAttribute("type")){case q.BAR:{this.progressBar&&(this.progressBar.style.width=`${l}%`);break}case q.RADIAL:{if(this.svgCircle){let u=this.getCircumference()-l/100*this.getCircumference();this.svgCircle.style.strokeDashoffset=u.toString()}break}case q.PERCENTAGE:{this.uploadPercentage&&(this.uploadPercentage.innerHTML=Sr(l));break}}},this.onSuccess=()=>{this.toggleAttribute("upload-in-progress",!1),this.toggleAttribute("upload-complete",!0)},this.onReset=()=>{this.toggleAttribute("upload-in-progress",!1),this.uploadPercentage&&(this.uploadPercentage.innerHTML=""),this.svgCircle&&(this.svgCircle.style.strokeDashoffset=`${this.getCircumference()}`)},this.attachShadow({mode:"open"}).appendChild(mt.content.cloneNode(!0)),this.svgCircle=(e=this.shadowRoot)==null?void 0:e.querySelector("circle"),this.progressBar=(t=this.shadowRoot)==null?void 0:t.getElementById("progress-bar"),this.uploadPercentage=(r=this.shadowRoot)==null?void 0:r.getElementById("percentage-type"),(s=this.progressBar)==null||s.setAttribute("aria-description",Ar)}connectedCallback(){if(this.setDefaultType(),C(this,z,U(this)),C(this,Y,new AbortController),i(this,z)){let e={signal:i(this,Y).signal};i(this,z).addEventListener("uploadstart",this.onUploadStart,e),i(this,z).addEventListener("reset",this.onReset),i(this,z).addEventListener("progress",this.onProgress),i(this,z).addEventListener("success",this.onSuccess),this.toggleAttribute("upload-in-progress",i(this,z).hasAttribute("upload-in-progress")),this.toggleAttribute("upload-complete",i(this,z).hasAttribute("upload-complete"))}}disconnectedCallback(){var e;(e=i(this,Y))==null||e.abort()}getRadius(){var e;return Number((e=this.svgCircle)==null?void 0:e.getAttribute("r"))}getCircumference(){return this.getRadius()*2*Math.PI}setDefaultType(){let e=this.getAttribute("type");e||this.setAttribute("type",q.BAR),e===q.RADIAL&&this.svgCircle&&(this.svgCircle.style.strokeDasharray=`${this.getCircumference()} ${this.getCircumference()}`,this.svgCircle.style.strokeDashoffset=`${this.getCircumference()}`)}};z=new WeakMap,Y=new WeakMap;p.customElements.get("mux-uploader-progress")||p.customElements.define("mux-uploader-progress",Rr);var bt=M.createElement("template");bt.innerHTML=`
<style>

:host([upload-error]) {
  color: #e22c3e;
}
</style>

<span id="status-message" role="status" aria-live="polite"></span>
`;var E,K,Tr=class extends p.HTMLElement{constructor(){var e;super(),w(this,E),w(this,K),this.clearStatusMessage=()=>{this.toggleAttribute("upload-error",!1),this.statusMessage&&(this.statusMessage.innerHTML="")},this.onUploadError=t=>{this.toggleAttribute("upload-error",!0),this.statusMessage&&(this.statusMessage.innerHTML=t.detail.message)},this.onSuccess=()=>{var t;this.toggleAttribute("upload-error",!1);let r=(t=i(this,E))==null?void 0:t.locale,s=P("Upload complete!",r);this.statusMessage&&(this.statusMessage.innerHTML=s),console.info(s)},this.onOffline=()=>{this.toggleAttribute("upload-error",!1);let t="Currently offline. Upload will resume automatically when online.";this.statusMessage&&(this.statusMessage.innerHTML=t)},this.attachShadow({mode:"open"}).appendChild(bt.content.cloneNode(!0)),this.statusMessage=(e=this.shadowRoot)==null?void 0:e.getElementById("status-message")}connectedCallback(){if(C(this,E,U(this)),C(this,K,new AbortController),i(this,E)){let e={signal:i(this,K).signal};i(this,E).addEventListener("reset",this.clearStatusMessage,e),i(this,E).addEventListener("uploaderror",this.onUploadError,e),i(this,E).addEventListener("success",this.onSuccess,e),i(this,E).addEventListener("uploadstart",this.clearStatusMessage,e),i(this,E).addEventListener("offline",this.onOffline,e),i(this,E).addEventListener("online",this.clearStatusMessage,e),this.toggleAttribute("upload-in-progress",i(this,E).hasAttribute("upload-in-progress")),this.toggleAttribute("upload-complete",i(this,E).hasAttribute("upload-complete")),this.toggleAttribute("upload-error",i(this,E).hasAttribute("upload-error")),i(this,E).addEventListener("localechange",()=>{var t,r,s;if((t=this.statusMessage)!=null&&t.textContent&&(r=i(this,E))!=null&&r.hasAttribute("upload-complete")){let n=(s=i(this,E))==null?void 0:s.locale;this.statusMessage.innerHTML=P("Upload complete!",n)}},e)}}disconnectedCallback(){var e;(e=i(this,K))==null||e.abort()}};E=new WeakMap,K=new WeakMap;p.customElements.get("mux-uploader-status")||p.customElements.define("mux-uploader-status",Tr);var vt=M.createElement("template");vt.innerHTML=`
<style>
  #retry-button {
    color: #e22c3e;
    text-decoration-line: underline;
    cursor: pointer;
    position: relative;
    display: none;
  }

  :host([upload-error]) #retry-button {
    display: inline-block;
  }
</style>

<span id="retry-button" role="button" tabindex="0">Try again</span>
`;var L,Z,zr=class extends p.HTMLElement{constructor(){var e;super(),w(this,L),w(this,Z),this.handleKeyup=t=>{let r=["Enter"," "],{key:s}=t;r.includes(s)&&this.triggerReset()},this.triggerReset=()=>{var t;(t=i(this,L))==null||t.dispatchEvent(new CustomEvent("reset"))},this.attachShadow({mode:"open"}).appendChild(vt.content.cloneNode(!0)),this.retryButton=(e=this.shadowRoot)==null?void 0:e.getElementById("retry-button")}connectedCallback(){var e,t;if(C(this,L,U(this)),C(this,Z,new AbortController),i(this,L)){let r={signal:i(this,Z).signal};i(this,L).addEventListener("uploaderror",()=>this.toggleAttribute("upload-error",!0)),i(this,L).addEventListener("reset",()=>this.toggleAttribute("upload-error",!1)),(e=this.retryButton)==null||e.addEventListener("click",this.triggerReset,r),(t=this.retryButton)==null||t.addEventListener("keyup",this.handleKeyup,r),this.toggleAttribute("upload-error",i(this,L).hasAttribute("upload-error")),i(this,L).addEventListener("localechange",()=>this.updateText(),r),this.updateText()}}disconnectedCallback(){var e;(e=i(this,Z))==null||e.abort()}updateText(){var e;let t=(e=i(this,L))==null?void 0:e.locale;this.retryButton&&(this.retryButton.textContent=P("Retry",t))}};L=new WeakMap,Z=new WeakMap;p.customElements.get("mux-uploader-retry")||p.customElements.define("mux-uploader-retry",zr);var yt=M.createElement("template");yt.innerHTML=`
<style>
#pause-button {
  cursor: pointer;
  line-height: 16px;
  background: #fff;
  border: 1px solid #000;
  color: #000000;
  padding: 16px 24px;
  border-radius: 4px;
  -webkit-transition: all 0.2s ease;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: inherit;
  position: relative;
  display: none;
}

#pause-button:hover:not(:disabled) {
  color: #fff;
  background: #404040;
}

#pause-button:active {
  color: #fff;
  background: #000;
}

#pause-button:disabled {
  cursor: not-allowed;
}

:host([upload-in-progress]:not([upload-error], [upload-complete])) #pause-button {
  display: initial;
}
</style>

<button id="pause-button">Pause</span>
`;var m,Q,Lr=class extends p.HTMLElement{constructor(){super(),w(this,m),w(this,Q),this.triggerPause=()=>{if(!i(this,m)){console.warn("pausing before a mux-uploader element is associated is unsupported!");return}this.pauseButton.disabled||(i(this,m).paused=!i(this,m).paused)},this.attachShadow({mode:"open"}).appendChild(yt.content.cloneNode(!0))}connectedCallback(){if(C(this,m,U(this)),C(this,Q,new AbortController),i(this,m)){let e={signal:i(this,Q).signal};i(this,m).addEventListener("uploadstart",()=>this.toggleAttribute("upload-in-progress",!0),e),i(this,m).addEventListener("uploaderror",()=>{this.toggleAttribute("upload-error",!0),this.toggleAttribute("upload-complete",!1),this.toggleAttribute("upload-in-progress",!1)}),i(this,m).addEventListener("success",()=>{this.toggleAttribute("upload-complete",!0),this.toggleAttribute("upload-error",!1),this.toggleAttribute("upload-in-progress",!1)}),i(this,m).addEventListener("reset",()=>{this.toggleAttribute("upload-error",!1),this.toggleAttribute("upload-in-progress",!1),this.toggleAttribute("upload-complete",!1)}),i(this,m).addEventListener("pausedchange",()=>{var t;if(this.pauseButton.disabled=!1,!i(this,m))return;let r=(t=i(this,m).paused)!=null?t:!1;this.updateText(),r&&(this.pauseButton.disabled=!0,i(this,m).addEventListener("chunksuccess",()=>{this.updateText(),this.pauseButton.disabled=!1},{once:!0}))}),this.pauseButton.addEventListener("click",this.triggerPause,e),this.toggleAttribute("upload-in-progress",i(this,m).hasAttribute("upload-in-progress")),this.toggleAttribute("upload-complete",i(this,m).hasAttribute("upload-complete")),this.toggleAttribute("upload-error",i(this,m).hasAttribute("upload-error")),i(this,m).addEventListener("localechange",()=>this.updateText(),e),this.updateText()}}disconnectedCallback(){var e;(e=i(this,Q))==null||e.abort()}get pauseButton(){var e;return(e=this.shadowRoot)==null?void 0:e.getElementById("pause-button")}updateText(){var e,t,r,s;let n=(e=i(this,m))==null?void 0:e.locale,a=(r=(t=i(this,m))==null?void 0:t.paused)!=null?r:!1;(s=this.pauseButton)!=null&&s.disabled&&a?this.pauseButton.innerHTML=P("Pausing...",n):this.pauseButton.innerHTML=P(a?"Resume":"Pause",n)}};m=new WeakMap,Q=new WeakMap;p.customElements.get("mux-uploader-pause")||p.customElements.define("mux-uploader-pause",Lr);var Et=`
  <style>
  #file-select {
    cursor: pointer;
    line-height: 16px;
    background: #fff;
    border: 1px solid #000;
    color: #000000;
    padding: 16px 24px;
    border-radius: 4px;
    -webkit-transition: all 0.2s ease;
    transition: all 0.2s ease;
    font-family: inherit;
    font-size: inherit;
    position: relative;
  }

  #file-select:hover {
    color: #fff;
    background: #404040;
  }

  #file-select:active {
    color: #fff;
    background: #000;
  }

  </style>

  <button id="file-select" type="button" part="file-select-button">Upload a video</button>
`,kt=M.createElement("template");kt.innerHTML=`
  <style>
    :host { display: inline-block; }

    :host([file-ready]) > slot  {
      display: none;
    }
  </style>

  <slot>
    ${Et}
  </slot>
`;var _,S,J,Pr=class extends p.HTMLElement{constructor(){var e,t,r;super(),w(this,_),w(this,S),w(this,J),this.attachShadow({mode:"open"}).appendChild(kt.content.cloneNode(!0)),this.handleFilePickerElClick=this.handleFilePickerElClick.bind(this),this.filePickerEl=(e=this.shadowRoot)==null?void 0:e.querySelector("button"),(r=(t=this.shadowRoot)==null?void 0:t.querySelector("slot"))==null||r.addEventListener("slotchange",s=>{let n=s.currentTarget;this.filePickerEl=n.assignedElements({flatten:!0}).filter(a=>!["STYLE"].includes(a.nodeName))[0],this.updateText()})}connectedCallback(){if(C(this,S,U(this)),C(this,J,new AbortController),i(this,S)){let e={signal:i(this,J).signal};i(this,S).addEventListener("file-ready",()=>{this.toggleAttribute("file-ready",!0)},e),i(this,S).addEventListener("uploadstart",()=>this.toggleAttribute("upload-in-progress",!0),e),i(this,S).addEventListener("success",()=>{this.toggleAttribute("upload-in-progress",!1),this.toggleAttribute("upload-complete",!0)},e),i(this,S).addEventListener("reset",()=>{this.toggleAttribute("file-ready",!1)},e),this.toggleAttribute("upload-in-progress",i(this,S).hasAttribute("upload-in-progress")),this.toggleAttribute("upload-complete",i(this,S).hasAttribute("upload-complete")),this.toggleAttribute("file-ready",i(this,S).hasAttribute("file-ready")),i(this,S).addEventListener("localechange",()=>this.updateText(),e),this.updateText()}}disconnectedCallback(){var e;(e=i(this,J))==null||e.abort()}get filePickerEl(){return i(this,_)}set filePickerEl(e){e!==i(this,_)&&(i(this,_)&&i(this,_).removeEventListener("click",this.handleFilePickerElClick),C(this,_,e),i(this,_)&&i(this,_).addEventListener("click",this.handleFilePickerElClick))}handleFilePickerElClick(){var e,t;let r=this.getAttribute("mux-uploader"),s=r?M.getElementById(r):this.getRootNode().host;(t=(e=s?.shadowRoot)==null?void 0:e.querySelector("#hidden-file-input"))==null||t.click()}updateText(){var e,t;let r=(e=i(this,S))==null?void 0:e.locale,s=P("Upload a video",r),n=(t=this.shadowRoot)==null?void 0:t.querySelector("#file-select");n&&(n.textContent=s)}};_=new WeakMap,S=new WeakMap,J=new WeakMap;p.customElements.get("mux-uploader-file-select")||p.customElements.define("mux-uploader-file-select",Pr);function le(e,t){return e?"":t}var Mr=(e,t)=>{if(t==null||t===!1)return"";let r=t===!0?"":`${t}`;return`${e}="${r}"`};function Or(e){let{noDrop:t,noProgress:r,noStatus:s,noRetry:n,pausable:a,type:l}=e,u=t?"div":'mux-uploader-drop overlay part="drop"',f=le(r,`
      <mux-uploader-progress part="progress progress-percentage" type="percentage"></mux-uploader-progress>
      <mux-uploader-progress part="progress progress-bar" ${Mr("type",l)}></mux-uploader-progress>
    `),c=le(s,'<mux-uploader-status part="status"></mux-uploader-status>'),v=le(n,'<mux-uploader-retry part="retry"></mux-uploader-retry>'),A=le(!a,'<mux-uploader-pause part="pause"></mux-uploader-pause>');return M.createRange().createContextualFragment(`
    <${u}>
      ${c}
      ${v}
      ${A}

      <mux-uploader-file-select part="file-select">
        <slot name="file-select">
          ${Et}
        </slot>
      </mux-uploader-file-select>

      ${f}
    </${u}>
  `)}var wt=M.createElement("template");wt.innerHTML=`
<style>
  :host {
    display: flex;
    flex-direction: column;
  }

  mux-uploader-drop {
    flex-grow: 1;
  }

  input[type="file"] {
    display: none;
  }
</style>

<input id="hidden-file-input" type="file" accept="video/*, audio/*" />
<mux-uploader-sr-text></mux-uploader-sr-text>
`;var Ne=class extends p.HTMLElement{static get observedAttributes(){return["pausable","type","no-drop","no-progress","no-status","no-retry","max-file-size","use-large-file-workaround","locale"]}constructor(){var e;super(),this.attachShadow({mode:"open"}).appendChild(wt.content.cloneNode(!0)),this.updateLayout(),(e=this.hiddenFileInput)==null||e.addEventListener("change",()=>{var t,r;let s=(r=(t=this.hiddenFileInput)==null?void 0:t.files)==null?void 0:r[0];this.toggleAttribute("file-ready",!!s),s&&this.dispatchEvent(new CustomEvent("file-ready",{composed:!0,bubbles:!0,detail:s}))})}connectedCallback(){this.addEventListener("file-ready",this.handleUpload),this.addEventListener("reset",this.resetState)}disconnectedCallback(){this.removeEventListener("file-ready",this.handleUpload,!1),this.removeEventListener("reset",this.resetState)}attributeChangedCallback(e,t,r){e==="locale"&&t!==r?this.dispatchEvent(new CustomEvent("localechange",{detail:{locale:r}})):e!=="locale"&&this.updateLayout()}get hiddenFileInput(){var e;return(e=this.shadowRoot)==null?void 0:e.querySelector("#hidden-file-input")}get endpoint(){var e;return(e=this.getAttribute("endpoint"))!=null?e:this._endpoint}set endpoint(e){e!==this.endpoint&&(typeof e=="string"?this.setAttribute("endpoint",e):e==null&&this.removeAttribute("endpoint"),this._endpoint=e)}get type(){var e;return(e=this.getAttribute("type"))!=null?e:void 0}set type(e){e!=this.type&&(e?this.setAttribute("type",e):this.removeAttribute("type"))}get noDrop(){return this.hasAttribute("no-drop")}set noDrop(e){this.toggleAttribute("no-drop",!!e)}get noProgress(){return this.hasAttribute("no-progress")}set noProgress(e){this.toggleAttribute("no-progress",!!e)}get noStatus(){return this.hasAttribute("no-status")}set noStatus(e){this.toggleAttribute("no-status",!!e)}get noRetry(){return this.hasAttribute("no-retry")}set noRetry(e){this.toggleAttribute("no-retry",!!e)}get pausable(){return this.hasAttribute("pausable")}set pausable(e){this.toggleAttribute("pausable",!!e)}get dynamicChunkSize(){return this.hasAttribute("dynamic-chunk-size")}set dynamicChunkSize(e){e!==this.hasAttribute("dynamic-chunk-size")&&(e?this.setAttribute("dynamic-chunk-size",""):this.removeAttribute("dynamic-chunk-size"))}get useLargeFileWorkaround(){return this.hasAttribute("use-large-file-workaround")}set useLargeFileWorkaround(e){e!=this.useLargeFileWorkaround&&this.toggleAttribute("use-large-file-workaround",!!e)}get maxFileSize(){let e=this.getAttribute("max-file-size");return e!==null?parseInt(e):void 0}set maxFileSize(e){e?this.setAttribute("max-file-size",e.toString()):this.removeAttribute("max-file-size")}get chunkSize(){let e=this.getAttribute("chunk-size");return e!==null?parseInt(e):void 0}set chunkSize(e){e?this.setAttribute("chunk-size",e.toString()):this.removeAttribute("chunk-size")}get locale(){return this.getAttribute("locale")}set locale(e){e!==this.locale&&(e?this.setAttribute("locale",e):this.removeAttribute("locale"))}get upload(){return this._upload}get paused(){var e,t;return(t=(e=this.upload)==null?void 0:e.paused)!=null?t:!1}set paused(e){if(!this.upload){console.warn("Pausing before an upload has begun is unsupported");return}let t=!!e;t!==this.paused&&(t?this.upload.pause():this.upload.resume(),this.toggleAttribute("paused",t),this.dispatchEvent(new CustomEvent("pausedchange",{detail:t})))}updateLayout(){var e,t;let r=(e=this.shadowRoot)==null?void 0:e.querySelector("mux-uploader-drop, div");r&&r.remove();let s=Or(this);(t=this.shadowRoot)==null||t.appendChild(s)}setError(e){this.setAttribute("upload-error",""),this.dispatchEvent(new CustomEvent("uploaderror",{detail:{message:e}}))}resetState(){this.removeAttribute("upload-error"),this.removeAttribute("upload-in-progress"),this.removeAttribute("upload-complete"),this.hiddenFileInput.value=""}handleUpload(e){let t=this.endpoint,r=this.dynamicChunkSize;if(t)this.removeAttribute("upload-error");else{this.setError(P("No url or endpoint specified - cannot handle upload",this.locale));return}try{let s=ot.createUpload({endpoint:t,dynamicChunkSize:r,file:e.detail,maxFileSize:this.maxFileSize,chunkSize:this.chunkSize,useLargeFileWorkaround:this.useLargeFileWorkaround});this._upload=s,this.dispatchEvent(new CustomEvent("uploadstart",{detail:{file:s.file,chunkSize:s.chunkSize}})),this.setAttribute("upload-in-progress",""),s.offline&&this.dispatchEvent(new CustomEvent("offline")),s.on("attempt",n=>{this.dispatchEvent(new CustomEvent("chunkattempt",n))}),s.on("chunkSuccess",n=>{this.dispatchEvent(new CustomEvent("chunksuccess",n))}),s.on("error",n=>{this.setAttribute("upload-error",""),console.error("error handler",n.detail.message),this.dispatchEvent(new CustomEvent("uploaderror",n))}),s.on("progress",n=>{this.dispatchEvent(new CustomEvent("progress",n))}),s.on("success",n=>{this.removeAttribute("upload-in-progress"),this.setAttribute("upload-complete",""),this.dispatchEvent(new CustomEvent("success",n))}),s.on("offline",n=>{this.dispatchEvent(new CustomEvent("offline",n))}),s.on("online",n=>{this.dispatchEvent(new CustomEvent("online",n))})}catch(s){s instanceof Error&&this.setError(s.message)}}};p.customElements.get("mux-uploader")||(p.customElements.define("mux-uploader",Ne),p.MuxUploaderElement=Ne);var Ct=M.createElement("template");Ct.innerHTML=`
<style>

.sr-only {
  position:absolute;
  left:-10000px;
  top:auto;
  width:1px;
  height:1px;
  overflow:hidden;
}
</style>

<div class="sr-only" id="sr-only" aria-live="polite"></div>
`;var I,_r=class extends p.HTMLElement{constructor(){var e;super(),w(this,I),this.attachShadow({mode:"open"}).appendChild(Ct.content.cloneNode(!0)),this.srOnlyText=(e=this.shadowRoot)==null?void 0:e.getElementById("sr-only")}connectedCallback(){C(this,I,U(this)),i(this,I)&&(i(this,I).addEventListener("success",this.updateText.bind(this)),i(this,I).addEventListener("localechange",()=>{var e;(e=this.srOnlyText)!=null&&e.textContent&&this.updateText()}))}disconnectedCallback(){i(this,I)&&i(this,I).removeEventListener("success",this.updateText.bind(this))}updateText(){var e;if(this.srOnlyText){let t=(e=i(this,I))==null?void 0:e.locale;this.srOnlyText.textContent=P("Upload complete!",t)}}};I=new WeakMap;p.customElements.get("mux-uploader-sr-text")||p.customElements.define("mux-uploader-sr-text",_r);var He={className:"class",classname:"class",htmlFor:"for",crossOrigin:"crossorigin",viewBox:"viewBox",playsInline:"playsinline",autoPlay:"autoplay"},Ir=e=>e==null,Br=(e,t)=>Ir(t)?!1:e in t,Dr=e=>e.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`),Fr=(e,t)=>{if(!(typeof t=="boolean"&&!t)){if(Br(e,He))return He[e];if(typeof t!=null)return/[A-Z]/.test(e)?Dr(e):e}},jr=(e,t)=>typeof e=="boolean"?"":e,N=(e={})=>Object.entries(e).reduce((t,[r,s])=>{let n=Fr(r,s);if(!n)return t;let a=jr(s);return t[n]=a,t},{}),H=(...e)=>{let t=T.useRef(null);return T.useEffect(()=>{e.forEach(r=>{r&&(typeof r=="function"?r(t.current):r.current=t.current)})},[e]),t},Ur=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-drop",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement(Ur,{ref:s,...e})});var Nr=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-file-select",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement(Nr,{ref:s,...e})});var Hr=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-progress",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement(Hr,{ref:s,...e})});var Wr=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-retry",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement(Wr,{ref:s,...e})});var $r=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-pause",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement($r,{ref:s,...e})});var Xr=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader-status",N({...t,ref:r}),e));d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t);return d.createElement(Xr,{ref:s,...e})});var qr=Object.prototype.hasOwnProperty,Vr=(e,t)=>{if(Object.is(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;if(Array.isArray(e))return!Array.isArray(t)||e.length!==t.length?!1:e.some((n,a)=>t[a]===n);let r=Object.keys(e),s=Object.keys(t);if(r.length!==s.length)return!1;for(let n=0;n<r.length;n++)if(!qr.call(t,r[n])||!Object.is(e[r[n]],t[r[n]]))return!1;return!0},Gr=(e,t,r)=>!Vr(t,e[r]),Yr=(e,t,r)=>{e[r]=t},Kr=(e,t,r,s=Yr,n=Gr)=>T.useEffect(()=>{let a=r?.current;a&&n(a,t,e)&&s(a,t,e)},[r?.current,t]),Zr=Kr;ht.ProgressTypes;var Qr=d.forwardRef(({children:e,...t},r)=>d.createElement("mux-uploader",N({...t,ref:r}),e)),X=(e,t,r)=>T.useEffect(()=>{let s=t?.current;if(!(!s||!r))return s.addEventListener(e,r),()=>{s.removeEventListener(e,r)}},[t?.current,r]),Jr=(e,t)=>{let{onUploadStart:r,onChunkAttempt:s,onChunkSuccess:n,onUploadError:a,onProgress:l,onSuccess:u,endpoint:f,...c}=t;return Zr("endpoint",f,e),X("uploadstart",e,r),X("chunkattempt",e,s),X("chunksuccess",e,n),X("uploaderror",e,a),X("progress",e,l),X("success",e,u),[c]},es=d.forwardRef((e,t)=>{let r=T.useRef(null),s=H(r,t),[n]=Jr(r,e);return d.createElement(Qr,{ref:s,...n})}),rs=es;export{rs as s};
