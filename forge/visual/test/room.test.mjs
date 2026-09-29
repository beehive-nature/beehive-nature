/* Room runtime regression fixtures: real pinned Yjs, fake DOM/canvas and an
   asynchronous, non-replaying channel bus. No browser or network calls.
   Run: node --test forge/visual/test/room.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as Y from 'yjs';
import {createSharedPiece} from '../shared.js';

const html=readFileSync(new URL('../../../surfaces/forge/room.html',import.meta.url),'utf8');
const modules=[...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(modules.length,1,'exercise the actual room module');
const dependencies=[];
const source=modules[0][1].replace(/\bimport\((['"])([^'"]+)\1\)/g,(_,quote,specifier)=>{
 dependencies.push(specifier);return '__import('+JSON.stringify(specifier)+')';
});
const yjsUrl='https://cdn.jsdelivr.net/npm/yjs@13.6.20/+esm';
const sharedUrl='../../forge/visual/shared.js?v=2';
assert.deepEqual(dependencies.slice().sort(),[yjsUrl,sharedUrl].sort(),'all imports must be explicitly injected');
const pinned=JSON.parse(readFileSync(new URL('node_modules/yjs/package.json',import.meta.url),'utf8'));
assert.equal(pinned.version,'13.6.20','fixtures use the same Yjs version as the page');
const controlIds=['seed','roll','pDensity','pHue','pDrift','pSym'];
const requiredIds=[...controlIds,'stage','meta','peers','err','room-bar','room-status'];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

function channelBus(){
 const channels=new Set(),queue=[];let nextTab=0;
 return {
  channels,
  nextId(){return ++nextTab;},
  channelClass(owner,failure){
   return class BroadcastChannel {
    constructor(name){
     const mode=typeof failure==='function'?failure():failure;
     if(mode==='all'||(mode==='presence'&&name.endsWith('-presence')))throw Error('Channel unavailable');
     this.name=name;this.owner=owner;this.closed=false;this.onmessage=null;channels.add(this);
    }
    postMessage(data){
     assert.equal(this.closed,false,'closed channels cannot send');
     // Capture only currently connected recipients. A later tab receives no
     // historical deltas unless the actual engine requests a snapshot.
     for(const peer of channels)if(peer!==this&&peer.name===this.name&&!peer.closed)
      queue.push({peer,data:structuredClone(data)});
    }
    close(){this.closed=true;channels.delete(this);}
   };
  },
  flush(){let deliveries=0;while(queue.length){assert.ok(++deliveries<1000,'no channel echo loop');const {peer,data}=queue.shift();if(!peer.closed)peer.onmessage?.({data});}},
  owned(owner){return [...channels].filter(c=>c.owner===owner);}
 };
}

function fakeClock(){
 let id=0;const tasks=new Map();
 return {
  tasks,
  setTimeout(fn,delay){tasks.set(++id,{fn,delay,interval:false});return id;},
  setInterval(fn,delay){tasks.set(++id,{fn,delay,interval:true});return id;},
  clear(key){tasks.delete(key);},
  fireTimeouts(){for(const [key,t] of [...tasks])if(!t.interval){tasks.delete(key);t.fn();}},
  intervals(){return [...tasks.values()].filter(t=>t.interval).length;}
 };
}

function roomTab(bus,{imports=null,failImport=null,channelFailure=null,noChannel=false}={}){
 const id=bus.nextId(),ids=new Map(),windowEvents=new Map(),clock=fakeClock(),importCalls=[];
 const brush={trace:[],frames:0,fillStyle:'',strokeStyle:'',lineWidth:1,
  fillRect(...args){this.frames++;this.trace=[['fillRect',...args,this.fillStyle]];},
  beginPath(){this.trace.push(['begin']);},moveTo(...args){this.trace.push(['move',...args]);},
  lineTo(...args){this.trace.push(['line',...args]);},closePath(){this.trace.push(['close']);},
  fill(){this.trace.push(['fill',this.fillStyle]);},stroke(){this.trace.push(['stroke',this.strokeStyle,this.lineWidth]);}};
 let document;
 function element(tag='div',attrs={}){
  let value=attrs.value||'';const listeners=new Map();
  const e={tagName:tag.toUpperCase(),id:attrs.id||'',dataset:{},style:{},children:[],parentElement:null,
   disabled:Object.hasOwn(attrs,'disabled'),hidden:Object.hasOwn(attrs,'hidden'),textContent:'',className:'',
   width:Number(attrs.width)||0,height:Number(attrs.height)||0,
   addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
   dispatch(type,event={}){for(const fn of listeners.get(type)||[])fn({target:e,...event});e['on'+type]?.({target:e,...event});},
   appendChild(child){child.parentElement=e;e.children.push(child);return child;},
   replaceChildren(...children){e.children=[];for(const child of children)e.appendChild(child);},
   focus(){const old=document.activeElement;document.activeElement=e;if(old!==e){old?.dispatch?.('blur');e.dispatch('focus');}},
   setAttribute(name,v){attrs[name]=String(v);},getAttribute(name){return attrs[name]??null;},
   getContext(kind){assert.equal(kind,'2d');return brush;}
  };
  Object.defineProperty(e,'value',{get:()=>value,set:v=>{value=String(v);}});
  return e;
 }
 for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
  const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';
  assert.ok(!ids.has(match[3]),'unique id: '+match[3]);ids.set(match[3],element(match[1],attrs));
 }
 for(const name of requiredIds)assert.ok(ids.has(name),'fixture needs actual #'+name);
 const documentEvents=new Map();
 document={body:element('body'),activeElement:null,getElementById:name=>ids.get(name),createElement:tag=>element(tag),
  addEventListener(type,fn){if(!documentEvents.has(type))documentEvents.set(type,[]);documentEvents.get(type).push(fn);}};
 document.activeElement=document.body;
 const fakeMath=Object.create(Math);fakeMath.random=()=>.5;
 const context={document,Math:fakeMath,Date,Uint8Array,ArrayBuffer,console,
  crypto:{randomUUID:()=>String(id).padStart(8,'0')+'-0000-0000-0000-000000000000'},
  setTimeout:clock.setTimeout,setInterval:clock.setInterval,clearTimeout:clock.clear,clearInterval:clock.clear,
  addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);},
  __import:async specifier=>{
   importCalls.push(specifier);
   if(imports)await imports.promise;
   if((failImport==='yjs'&&specifier===yjsUrl)||(failImport==='shared'&&specifier===sharedUrl))throw Error('Dependency unavailable');
   if(specifier===yjsUrl)return Y;
   if(specifier===sharedUrl)return {createSharedPiece};
   throw Error('Unexpected import: '+specifier);
  }
 };
 if(!noChannel)context.BroadcastChannel=bus.channelClass(id,channelFailure);
 context.window=context;vm.createContext(context);
 const execution=new vm.Script('(async()=>{\n'+source+'\n})()',{filename:'room.html:module'}).runInContext(context);
 const tab={id,ids,document,brush,clock,importCalls,
  async settle(){await execution;for(let i=0;i<12;i++){await Promise.resolve();bus.flush();}},
  event(type,event={}){for(const fn of windowEvents.get(type)||[])fn(event);},
  input(name,value,type='input'){const n=ids.get(name);assert.equal(n.disabled,false,name+' is usable');n.value=value;n.dispatch(type);},
  seed(value){this.input('seed',value,'change');},
  roll(){assert.equal(ids.get('roll').disabled,false);ids.get('roll').dispatch('click');},
  art(){return JSON.stringify(brush.trace);},
  dispose(){this.event('pagehide',{persisted:false});}
 };
 return tab;
}

function fixture(t){const bus=channelBus(),tabs=[];t.after(()=>{for(const tab of tabs)tab.dispose();});return {bus,tab:options=>{const tab=roomTab(bus,options);tabs.push(tab);return tab;}};}
function usable(tab){for(const id of controlIds)assert.equal(tab.ids.get(id).disabled,false,id+' enabled');}
function sameField(a,b){assert.equal(a.ids.get('meta').textContent,b.ids.get('meta').textContent);assert.equal(a.art(),b.art(),'identical canvas commands for the shared field');}

test('late join gets existing causal history, then subsequent edits converge both ways',async t=>{
 const f=fixture(t),a=f.tab();await a.settle();
 a.seed('established-before-join');a.input('pDensity',17);a.input('pHue',240);f.bus.flush();
 const expected=a.art(),b=f.tab();await b.settle();
 assert.equal(b.ids.get('seed').value,'established-before-join');assert.equal(b.ids.get('pDensity').value,'17');assert.equal(b.ids.get('pHue').value,'240');
 assert.equal(a.art(),expected,'a joining tab must not overwrite the established seed');sameField(a,b);
 a.input('pDrift',35);f.bus.flush();assert.equal(b.ids.get('pDrift').value,'35');sameField(a,b);
 b.input('pSym',0);b.seed('edited-in-second-tab');f.bus.flush();assert.equal(a.ids.get('pSym').value,'0');assert.equal(a.ids.get('seed').value,'edited-in-second-tab');sameField(a,b);
});

test('simultaneous startup and concurrent different-knob edits retain both authors',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();await a.settle();await b.settle();
 a.input('pDensity',8);b.input('pHue',310);f.bus.flush();
 for(const tab of [a,b]){assert.equal(tab.ids.get('pDensity').value,'8');assert.equal(tab.ids.get('pHue').value,'310');}
 sameField(a,b);
});

test('warmup disables controls while still rendering the local default',async t=>{
 const f=fixture(t),gate=deferred(),a=f.tab({imports:gate});
 for(const id of controlIds)assert.equal(a.ids.get(id).disabled,true,id+' disabled during warmup');
 assert.ok(a.brush.frames>0,'the initial canvas is not blank during imports');assert.equal(f.bus.owned(a.id).length,0);
 gate.resolve();await a.settle();usable(a);assert.equal(f.bus.owned(a.id).length,2);
});

for(const failure of [{failImport:'yjs'},{failImport:'shared'},{noChannel:true},{channelFailure:'all'},{channelFailure:'presence'}]){
 test('dependency/channel failure keeps a working local field: '+JSON.stringify(failure),async t=>{
  const f=fixture(t),a=f.tab(failure);await a.settle();usable(a);
  assert.equal(a.ids.get('err').style.display,'block');assert.equal(a.ids.get('room-bar').hidden,true);
  assert.equal(f.bus.owned(a.id).length,0,'partial channels are closed');assert.equal(a.clock.intervals(),0);
  const original=a.art();a.input('pDensity',18);assert.notEqual(a.art(),original);
  a.seed('local-only');assert.match(a.ids.get('meta').textContent,/local-only/);a.roll();assert.equal(a.ids.get('seed').value,'500000000');
 });
}

test('import timeout falls back locally and late import completion cannot reconnect it',async t=>{
 const f=fixture(t),gate=deferred(),a=f.tab({imports:gate});a.clock.fireTimeouts();await a.settle();usable(a);
 a.seed('kept-after-timeout');gate.resolve();await a.settle();
 assert.equal(a.ids.get('seed').value,'kept-after-timeout');assert.equal(f.bus.owned(a.id).length,0);assert.equal(a.ids.get('err').style.display,'block');
});

test('remote values update controls without overwriting an active seed draft; blur reconciles',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();await a.settle();await b.settle();
 const seed=b.ids.get('seed');seed.focus();seed.value='unfinished draft';a.seed('remote-seed');a.input('pHue',80);f.bus.flush();
 assert.equal(seed.value,'unfinished draft');assert.equal(b.ids.get('pHue').value,'80');assert.match(b.ids.get('meta').textContent,/remote-seed/);
 b.document.body.focus();assert.equal(seed.value,'remote-seed');sameField(a,b);
 seed.focus();seed.value='committed draft';seed.dispatch('change');b.document.body.focus();f.bus.flush();
 assert.equal(a.ids.get('seed').value,'committed draft');sameField(a,b);
});

test('Roll updates the visible seed and the other tab without a manual text change',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();await a.settle();await b.settle();a.roll();f.bus.flush();
 for(const tab of [a,b])assert.equal(tab.ids.get('seed').value,'500000000');sameField(a,b);
});

test('persisted pagehide closes channels and pageshow catches up through a fresh snapshot',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();await a.settle();await b.settle();a.seed('before-away');f.bus.flush();
 b.event('pagehide',{persisted:true});assert.equal(f.bus.owned(b.id).length,0);assert.equal(b.clock.intervals(),0);
 const stopped=b.art();a.seed('while-away');a.input('pDensity',7);f.bus.flush();assert.equal(b.art(),stopped,'hidden tab gets no replayed deltas');
 b.event('pageshow',{persisted:true});await b.settle();usable(b);assert.equal(f.bus.owned(b.id).length,2);assert.equal(b.clock.intervals(),1);
 assert.equal(b.ids.get('seed').value,'while-away');assert.equal(b.ids.get('pDensity').value,'7');sameField(a,b);
 b.input('pDrift',100);f.bus.flush();sameField(a,b);
 a.event('pagehide',{persisted:false});b.event('pagehide',{persisted:false});assert.equal(f.bus.channels.size,0);assert.equal(a.clock.intervals()+b.clock.intervals(),0);
});

test('warmup completion while hidden is ignored and persisted return starts exactly one connection',async t=>{
 const f=fixture(t),gate=deferred(),a=f.tab({imports:gate});a.event('pagehide',{persisted:true});gate.resolve();await a.settle();
 assert.equal(f.bus.owned(a.id).length,0);a.event('pageshow',{persisted:true});await a.settle();
 usable(a);assert.equal(f.bus.owned(a.id).length,2);assert.equal(a.clock.intervals(),1);
});

test('a local fallback composition survives persisted return when channels remain unavailable',async t=>{
 const f=fixture(t),a=f.tab({channelFailure:'presence'});await a.settle();
 a.seed('my-local-composition');a.input('pDensity',16);a.input('pHue',290);const saved=a.art();
 a.event('pagehide',{persisted:true});a.event('pageshow',{persisted:true});await a.settle();
 usable(a);assert.equal(f.bus.owned(a.id).length,0);
 assert.equal(a.ids.get('seed').value,'my-local-composition');assert.equal(a.ids.get('pDensity').value,'16');
 assert.equal(a.ids.get('pHue').value,'290');assert.equal(a.art(),saved,'retrying unavailable sharing must not discard local edits');
});

test('persisted return keeps an established local-only composition even if sharing becomes available',async t=>{
 const f=fixture(t);let failure='presence';const a=f.tab({channelFailure:()=>failure});await a.settle();
 a.seed('deliberately-local');a.input('pDensity',15);const saved=a.art(),imports=a.importCalls.length;
 a.event('pagehide',{persisted:true});failure=null;
 const b=f.tab();await b.settle();b.seed('another-live-room');f.bus.flush();
 a.event('pageshow',{persisted:true});await a.settle();usable(a);
 assert.equal(a.importCalls.length,imports,'a local-only return does not silently restart dependency setup');
 assert.equal(f.bus.owned(a.id).length,0,'local work is not silently promoted into the shared room');
 assert.equal(a.ids.get('seed').value,'deliberately-local');assert.equal(a.art(),saved);
 assert.equal(b.ids.get('seed').value,'another-live-room');
 a.input('pHue',25);f.bus.flush();assert.equal(b.ids.get('pHue').value,'168');
});
