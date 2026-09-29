import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Actual first page engine, with a small DOM boundary, controlled timers and
// same-origin storage/lock fixtures. This is not a browser or clipboard receipt.
const html=readFileSync(new URL('../surfaces/kandi.html',import.meta.url),'utf8');
const original=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(original);
const source=original.replace(/paint\(\); arms\(\); initializeStore\(\);\s*\}\)\(\);\s*$/,
  `paint(); arms();
  globalThis.api={state:()=>S,draft:()=>draft,giving:()=>giving,gift,openCross,encode,decode,fnv};
  globalThis.initialized=initializeStore();
  })();`);
assert.notEqual(source,original,'the actual first page engine and initialization must be extracted');
const clone=value=>JSON.parse(JSON.stringify(value));
const piece=(beads='AAA',ts=1000)=>({maker:'LoVis',madefor:'Sam',beads,ts});
const state=(right=[],cross=[],left=[],given=[])=>({v:1,right,cross,left,given});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Locks{
  active=false;paused=false;queue=[];
  request(name,{signal},fn){
    assert.equal(name,'bnr-kandi-store');assert.ok(signal);
    return new Promise((resolve,reject)=>{this.queue.push({fn,resolve,reject});this.drain();});
  }
  drain(){
    if(this.active||this.paused||!this.queue.length)return;
    this.active=true;const task=this.queue.shift();
    queueMicrotask(()=>{
      try{task.resolve(task.fn());}catch(e){task.reject(e);}finally{this.active=false;this.drain();}
    });
  }
}
const store=initial=>({raw:JSON.stringify(initial),locks:new Locks(),writes:0});
async function fixture(initial=state(),shared=store(initial)){
  const nodes=new Map(),timers=[],listeners={},copied=[];let blockWrite=false,execCalls=0;
  function node(tag='div',connected=false){
    const attrs=new Map();let classes=new Set(),children=[],text='',markup='';
    const n={tagName:tag.toUpperCase(),parentNode:null,dataset:{},style:{},value:'',disabled:false,open:false,children,
      get isConnected(){return connected||!!this.parentNode?.isConnected;},
      get className(){return [...classes].join(' ');},set className(v){classes=new Set(v.split(/\s+/).filter(Boolean));},
      classList:{add(...vs){vs.forEach(v=>classes.add(v));},remove(...vs){vs.forEach(v=>classes.delete(v));},contains:v=>classes.has(v)},
      get textContent(){return text+children.map(c=>c.textContent).join('');},
      set textContent(v){text=String(v);for(const c of children)c.parentNode=null;children.length=0;markup='';},
      get innerHTML(){return markup;},set innerHTML(v){this.textContent='';markup=String(v);},
      get readOnly(){return attrs.has('readonly');},set readOnly(v){if(v)attrs.set('readonly','');else attrs.delete('readonly');},
      setAttribute(k,v){attrs.set(k,String(v));if(k==='class')this.className=v;},getAttribute:k=>attrs.get(k)??null,
      removeAttribute(k){attrs.delete(k);},appendChild(c){children.push(c);c.parentNode=this;return c;},
      addEventListener(k,fn){this['on'+k]=fn;},select(){this.selected=true;},scrollIntoView(){},focus(){},
      click(){if(!this.disabled)return this.onclick?.call(this);}
    };return n;
  }
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
    const n=node(match[1],true),attributes=match[2];
    const cls=attributes.match(/\bclass="([^"]*)"/);if(cls)n.className=cls[1];
    n.readOnly=/\breadonly\b/.test(attributes);nodes.set(match[3],n);
  }
  const get=id=>nodes.get(id)||null;
  get('steps').children.push(...Array.from({length:4},()=>node()));
  const body=node('body',true);body.setAttribute('data-reg','bee');
  const document={getElementById:get,createElement:node,createTextNode:t=>{const n=node('#text');n.textContent=t;return n;},
    body,querySelectorAll:()=>[],addEventListener(){},execCommand(){execCalls++;return false;}};
  const navigator={clipboard:{writeText(text){copied.push(text);return Promise.resolve();}},locks:shared.locks};
  const context=vm.createContext({document,navigator,window:{
    addEventListener(k,fn){(listeners[k]??=[]).push(fn);},matchMedia:()=>({matches:true})
  },AbortSignal:{timeout(ms){assert.equal(ms,3000);return new AbortController().signal;}},
  localStorage:{getItem:()=>shared.raw,setItem(k,v){assert.equal(shared.locks.active,true);if(blockWrite)throw Error('quota');shared.raw=v;shared.writes++;}},
  location:{hash:'',search:'',href:'https://local.test/kandi.html'},setTimeout:fn=>timers.push(fn),console});
  vm.runInContext(source,context);assert.equal(await context.initialized,true);
  return {api:context.api,get,navigator,shared,copied,
    state:()=>clone(context.api.state()),saved:()=>JSON.parse(shared.raw),
    failWrite:()=>{blockWrite=true;},allowWrite:()=>{blockWrite=false;},execCalls:()=>execCalls,
    flush(){let count=0;while(timers.length){assert.ok(++count<100);timers.shift()();}},
    event(k,e={}){for(const fn of listeners[k]||[])fn(e);}
  };
}
const prepare=(f,p)=>{f.api.gift(p);f.flush();assert.equal(f.get('giftout').classList.contains('open'),true);};
function descendants(node){return node.children.flatMap(c=>[c,...descendants(c)]);}

test('crossing an already-kept payload cannot retire the offered piece or duplicate the receiver arm',async()=>{
  const a=piece(),b={...piece('BBB',2000),rcv:true},f=await fixture(state([],[a],[b])),raw=f.shared.raw;
  f.api.openCross(a);f.get('xtheirs').value=f.api.encode(b);await f.get('xdo').click();
  assert.equal(f.shared.raw,raw);assert.deepEqual(f.state().cross,[a]);assert.deepEqual(f.state().left,[b]);
  assert.match(f.get('xerr').textContent,/already on your left arm/);assert.equal(f.get('xpanel').classList.contains('open'),true);
});
test('an alternate timestamp spelling cannot bypass self-crossing refusal',async()=>{
  const a=piece(),f=await fixture(state([],[a])),parts=f.api.encode(a).split('|');
  parts[3]=parts[3].toUpperCase();parts[5]=f.api.fnv(parts.slice(0,5).join('|'));
  assert.notEqual(parts.join('|'),f.api.encode(a));f.api.openCross(a);f.get('xtheirs').value=parts.join('|');
  await f.get('xdo').click();assert.equal(f.state().given.length,0);assert.equal(f.state().cross.length,1);
  assert.match(f.get('xerr').textContent,/own string|timestamp/);
});
for(const outcome of ['resolve','reject'])test(`late clipboard ${outcome} for A cannot rewrite or change the phase of B`,async()=>{
  const a=piece(),b=piece('BBB',2000),f=await fixture(state([a,b]));let settle;
  f.navigator.clipboard.writeText=()=>new Promise((resolve,reject)=>{settle=outcome==='resolve'?resolve:()=>reject(Error('denied'));});
  prepare(f,a);f.get('copygift').click();await tick();assert.equal(typeof settle,'function');
  prepare(f,b);const expected=f.api.encode(b);settle();await tick();
  assert.equal(f.get('giftstr').value,expected);assert.equal(f.get('giftstr').readOnly,true);
  assert.equal(f.get('giftphase').getAttribute('data-phase'),'prepared');assert.equal(f.execCalls(),0);
  await f.get('finishgift').click();assert.deepEqual(f.state().right,[a]);assert.equal(f.state().given[0].export,expected);
});
test('clipboard failure leaves canonical readonly text and a completed gift remains explicitly copyable',async()=>{
  const a=piece(),f=await fixture(state([a])),expected=f.api.encode(a);
  prepare(f,a);f.navigator.clipboard.writeText=()=>Promise.reject(Error('denied'));
  f.get('copygift').click();await tick();
  assert.equal(f.get('giftphase').getAttribute('data-phase'),'copy-needed');assert.equal(f.get('giftstr').readOnly,true);
  assert.equal(f.get('giftstr').value,expected);assert.equal(f.state().right.length,1);
  await f.get('finishgift').click();
  f.navigator.clipboard.writeText=text=>{f.copied.push(text);return Promise.resolve();};
  f.get('copygift').click();await tick();
  assert.equal(f.copied.at(-1),expected);assert.equal(f.get('giftphase').getAttribute('data-phase'),'completed');
});
test('failed handoff preserves the arm, export and recovery history, then permits retry',async()=>{
  const a=piece(),f=await fixture(state([a]));prepare(f,a);const raw=f.shared.raw,expected=f.get('giftstr').value;
  f.failWrite();await f.get('finishgift').click();
  assert.equal(f.shared.raw,raw);assert.deepEqual(f.state().right,[a]);assert.deepEqual(f.state().given,[]);
  assert.equal(f.get('giftstr').value,expected);assert.equal(f.get('finishgift').disabled,false);
  assert.notEqual(f.get('giftphase').getAttribute('data-phase'),'completed');assert.match(f.get('gerr').textContent,/would not save/);
  f.allowWrite();await f.get('finishgift').click();assert.equal(f.state().right.length,0);assert.equal(f.state().given[0].export,expected);
});
test('full gift text can be recovered and copied after reload without restoring the sender arm',async()=>{
  const a={...piece(),maker:'Jānis',madefor:'Анна'},f=await fixture(state([a]));prepare(f,a);const expected=f.get('giftstr').value;
  await f.get('finishgift').click();const reloaded=await fixture(null,f.shared),raw=f.shared.raw;
  const memory=reloaded.get('givenlog').children.find(n=>n.classList.contains('memory'));assert.ok(memory);
  const children=descendants(memory),out=children.find(n=>n.tagName==='TEXTAREA'),button=children.find(n=>n.tagName==='BUTTON');
  assert.equal(out.value,expected);assert.equal(out.readOnly,true);assert.equal(button.textContent,'Copy saved gift');
  button.click();await tick();assert.equal(reloaded.copied.at(-1),expected);
  assert.equal(f.shared.raw,raw);assert.deepEqual(reloaded.state().right,[]);assert.equal(reloaded.state().given.length,1);
});
test('legacy memories do not invent a recoverable export',async()=>{
  const f=await fixture(state([],[],[],[{beads:'PLUR',to:'Sam',ts:1000}]));
  const memory=f.get('givenlog').children[0];assert.match(memory.textContent,/no complete gift text/);
  assert.equal(descendants(memory).some(n=>n.tagName==='BUTTON'||n.tagName==='TEXTAREA'),false);
});
test('failed crossing keeps both local arms and the pasted incoming text',async()=>{
  const a=piece(),b=piece('BBB',2000),f=await fixture(state([],[a])),raw=f.shared.raw;
  f.api.openCross(a);const incoming=f.api.encode(b);f.get('xtheirs').value=incoming;f.failWrite();
  await f.get('xdo').click();assert.equal(f.shared.raw,raw);assert.deepEqual(f.state().cross,[a]);assert.deepEqual(f.state().left,[]);
  assert.equal(f.get('xtheirs').value,incoming);assert.equal(f.get('xpanel').classList.contains('open'),true);
});
test('receive previews before keeping and a repeated payload is idempotent',async()=>{
  const incoming=piece(),f=await fixture(),raw=f.api.encode(incoming);
  f.get('rcv').value=raw;f.get('rcvgo').click();assert.equal(f.state().left.length,0);
  await f.get('rcvkeep').click();assert.equal(f.state().left.length,1);
  f.get('rcv').value=raw;f.get('rcvgo').click();await f.get('rcvkeep').click();
  assert.equal(f.state().left.length,1);assert.match(f.get('rerr').textContent,/already/);
});
for(const action of ['gift','cross','receive'])test(`closing ${action} while waiting for the lock cancels its pending mutation`,async()=>{
  const a=piece(),b=piece('BBB',2000),f=await fixture(action==='gift'?state([a]):action==='cross'?state([],[a]):state());
  if(action==='gift')prepare(f,a);
  if(action==='cross'){f.api.openCross(a);f.get('xtheirs').value=f.api.encode(b);}
  if(action==='receive'){f.get('rcv').value=f.api.encode(b);f.get('rcvgo').click();}
  const raw=f.shared.raw;f.shared.locks.paused=true;
  const ids={gift:['finishgift','donegift'],cross:['xdo','xclose'],receive:['rcvkeep','rcvcancel']}[action];
  const pending=f.get(ids[0]).click();f.get(ids[1]).click();f.shared.locks.paused=false;f.shared.locks.drain();await pending;
  assert.equal(f.shared.raw,raw);assert.equal(f.get(ids[0]).disabled,false);
});
test('composer edits made while a save waits remain in the draft',async()=>{
  const f=await fixture();f.get('word').value='AAA';f.get('addword').click();f.get('maker').value='First';
  f.shared.locks.paused=true;const pending=f.get('stringit').click();
  f.get('word').value='BBB';f.get('addword').click();f.get('maker').value='Second';
  f.shared.locks.paused=false;f.shared.locks.drain();await pending;
  assert.equal(f.state().right[0].beads,'AAA');assert.equal(f.state().right[0].maker,'First');
  assert.equal(Array.from(f.api.draft()).join(''),'AAABBB');assert.equal(f.get('maker').value,'Second');
});
