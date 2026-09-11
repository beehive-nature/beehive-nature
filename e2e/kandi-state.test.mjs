import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Execute the actual page's state and codec functions without a browser or server.
const html=readFileSync(new URL('../surfaces/kandi.html',import.meta.url),'utf8');
const stateStart=html.indexOf('/* ---- state:');
const codecStart=html.indexOf('/* ---- codec:');
assert.ok(stateStart>0 && codecStart>stateStart);
const stateCode=html.slice(stateStart,codecStart);
assert.match(stateCode,/async function commitChange\(/,'the page must contain the locked transaction engine');
const prelude=html.slice(html.indexOf('var NAMEMAX='),stateStart);
const codec=html.slice(html.indexOf('function fnv('),html.indexOf('function braceSVG('));
const clone=value=>JSON.parse(JSON.stringify(value));
const piece=(beads='AAA',ts=1000)=>({maker:'LoVis',madefor:'Sam',beads,ts});
const state=(right=[],cross=[],left=[],given=[])=>({v:1,right,cross,left,given});

class Locks {
  active=false; paused=false; queue=[]; requests=[];
  request(name,{signal},callback){
    this.requests.push({name,signal});
    return new Promise((resolve,reject)=>{
      const job={callback,resolve,reject,signal,done:false};
      signal.addEventListener('abort',()=>{
        if(job.done)return;
        job.done=true;reject(new Error('storage lock wait expired'));
      },{once:true});
      if(signal.aborted){job.done=true;reject(new Error('storage lock wait expired'));return;}
      this.queue.push(job);this.drain();
    });
  }
  drain(){
    if(this.active||this.paused)return;
    const job=this.queue.shift();if(!job)return;
    if(job.done){this.drain();return;}
    this.active=true;
    queueMicrotask(()=>{
      try{if(!job.done){job.done=true;job.resolve(job.callback());}}
      catch(error){job.reject(error);}
      finally{this.active=false;this.drain();}
    });
  }
}
function store(initial=state()){
  return {raw:initial===null?null:typeof initial==='string'?initial:JSON.stringify(initial),writes:0,locks:new Locks()};
}
function fixture(shared=store(),options={}){
  const nodes=new Map(),listeners={},signals=[],timeouts=[];
  let blockWrite=false,blockRead=options.blockRead||false,renders=0;
  const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id)};
  const navigator=options.noLocks?{}:{locks:shared.locks};
  const context=vm.createContext({$:el,navigator,AbortSignal:{timeout(ms){
    timeouts.push(ms);const ctl=new AbortController();signals.push(ctl);return ctl.signal;
  }},localStorage:{
    getItem(key){assert.equal(key,'bkandi');if(blockRead)throw Error('storage read denied');return shared.raw;},
    setItem(key,value){
      assert.equal(key,'bkandi');assert.equal(shared.locks.active,true,'every write must hold the shared lock');
      if(blockWrite)throw Error('quota');shared.raw=value;shared.writes++;
    }
  },window:{addEventListener:(type,handler)=>{listeners[type]=handler;}},
  arms(){renders++;},console});
  vm.runInContext(prelude+'\n'+stateCode+'\n'+codec,context);
  return {context,shared,el,signals,timeouts,navigator,
    state:()=>clone(context.S),saved:()=>JSON.parse(shared.raw),renders:()=>renders,
    failWrite:()=>{blockWrite=true;},failRead:()=>{blockRead=true;},
    event:(newValue='intentionally-stale-event-bytes',key='bkandi')=>listeners.storage({key,newValue}),
    commit:mutator=>context.commitChange(mutator),initialize:()=>context.initializeStore()};
}
function moveBack(candidate,key,encode){
  const i=candidate.cross.findIndex(k=>encode(k)===key);
  if(i<0)throw Error('that piece is no longer on the crossing');
  candidate.right.push(candidate.cross.splice(i,1)[0]);
}
function retire(candidate,key,encode){
  const i=candidate.right.findIndex(k=>encode(k)===key);
  if(i<0)throw Error('that piece is no longer on this arm');
  const k=candidate.right.splice(i,1)[0];
  candidate.given.push({beads:k.beads,to:k.madefor,ts:2000,export:encode(k),maker:k.maker,madefor:k.madefor,pieceTs:k.ts});
}

test('two first visits bootstrap exactly one welcome under the shared lock',async()=>{
  const shared=store(null),a=fixture(shared),b=fixture(shared);
  assert.equal(shared.raw,null);assert.equal(shared.writes,0);
  assert.deepEqual(await Promise.all([a.initialize(),b.initialize()]),[true,true]);
  assert.equal(shared.writes,1);assert.equal(a.saved().left.length,1);
  assert.deepEqual(a.state(),b.state());
  for(const f of [a,b])assert.deepEqual(f.timeouts,[3000]);
  assert.ok(shared.locks.requests.every(r=>r.name==='bnr-kandi-store'));
});
test('stale tabs add against the latest committed state without losing either action',async()=>{
  const shared=store(state([piece()])),a=fixture(shared),b=fixture(shared);
  assert.equal(await a.commit(c=>{c.right.push(piece('BBB',2000));}),true);
  assert.equal(await b.commit(c=>{c.right.push(piece('CCC',3000));}),true);
  assert.deepEqual(b.saved().right.map(k=>k.beads),['AAA','BBB','CCC']);
});
test('Take back survives a delivered stale storage event and the other tab next save',async()=>{
  const p=piece(),shared=store(state([], [p])),a=fixture(shared),b=fixture(shared);
  assert.equal(await a.commit(c=>moveBack(c,a.context.encode(p),a.context.encode)),true);
  b.event();assert.equal(b.state().cross.length,0);assert.equal(b.state().right.length,1);
  await b.commit(c=>{c.right.push(piece('BBB',2000));});
  assert.deepEqual(b.saved().right.map(k=>k.beads),['AAA','BBB']);assert.deepEqual(b.saved().cross,[]);
});
test('two stale completions retire the chosen identity only once',async()=>{
  const p=piece(),other=piece('BBB',2000),shared=store(state([p,other])),a=fixture(shared),b=fixture(shared);
  const key=a.context.encode(p);
  assert.deepEqual(await Promise.all([
    a.commit(c=>retire(c,key,a.context.encode)),b.commit(c=>retire(c,key,b.context.encode))
  ]),[true,false]);
  assert.deepEqual(a.saved().right,[other]);assert.equal(a.saved().given.length,1);
  assert.equal(a.saved().given[0].export,key);assert.match(b.el('armerr').textContent,/no longer/);
});
test('quota failure leaves committed bytes and published state intact',async()=>{
  const p=piece(),f=fixture(store(state([p]))),raw=f.shared.raw,before=f.state();
  f.failWrite();
  assert.equal(await f.commit(c=>retire(c,f.context.encode(p),f.context.encode)),false);
  assert.equal(f.shared.raw,raw);assert.deepEqual(f.state(),before);assert.equal(f.renders(),0);
  assert.equal(f.context.isStoreBusy(),false);assert.match(f.el('armerr').textContent,/quota/);
});
test('a failed stale Take back cannot duplicate its target or pop an unrelated piece',async()=>{
  const a=piece(),b=piece('BBB',2000),c=piece('CCC',3000),shared=store(state([b],[a])),old=fixture(shared),fresh=fixture(shared);
  await fresh.commit(s=>{s.right.push(c);});const saved=shared.raw,before=old.state();old.failWrite();
  assert.equal(await old.commit(s=>moveBack(s,old.context.encode(a),old.context.encode)),false);
  assert.deepEqual(old.state(),before);assert.equal(shared.raw,saved);
  old.event();assert.deepEqual(old.state().right,[b,c]);assert.deepEqual(old.state().cross,[a]);
});
test('legacy absent cross, stranded piece and short memories migrate without a module-load write',async()=>{
  const stranded={...piece(),rcv:false},received={...piece('BBB',2000),rcv:true};
  const legacy={v:1,right:[],left:[stranded,received],given:[{beads:'PLUR',to:'Sam',ts:500}]};
  const f=fixture(store(legacy));
  assert.equal(f.shared.writes,0);assert.equal(f.context._rescued,1);assert.equal(f.state().right.length,1);
  assert.equal(await f.initialize(),true);
  assert.deepEqual(f.saved().cross,[]);assert.equal(f.saved().right[0].rcv,undefined);
  assert.deepEqual(f.saved().left,[received]);assert.deepEqual(f.saved().given,legacy.given);
});
const invalids=[
  ['malformed JSON','%%%existing-arms%%%'],['null','null'],['wrong version',{...state(),v:2}],
  ['null piece',state([null])],['invalid name',state([{...piece(),maker:'Ann|a'}])],
  ['invalid bead',state([{...piece(),beads:'a'}])],['unsafe timestamp',state([{...piece(),ts:2**53}])],
  ['invalid flag',state([{...piece(),rcv:'true'}])],['invalid cross shape',{...state(),cross:{}}],
  ['invalid memory',state([],[],[],[{beads:'PLUR',to:'Sam',ts:2000,export:'KND1|bad'}])]
];
for(const [name,value] of invalids)test(`invalid saved ${name} is never replaced by welcome or an action`,async()=>{
  const f=fixture(store(value)),raw=f.shared.raw;
  assert.equal(f.shared.writes,0);assert.match(f.el('armerr').textContent,/cannot be read/);
  assert.equal(await f.initialize(),false);assert.equal(await f.commit(c=>{c.right.push(piece());}),false);
  assert.equal(f.shared.raw,raw);assert.equal(f.shared.writes,0);
});
test('current Unicode and legacy ASCII full exports retain their exact bytes',async()=>{
  const f=fixture();
  for(const name of ['LoVis','Jānis','Анна','ليلى','漢字','A\u0301']){
    const k={...piece(),maker:name};const text=f.context.encode(k);
    assert.equal(f.context.encode(f.context.decode(text)),text);
    assert.equal(await f.commit(c=>{c.right.push(k);}),true);
    assert.equal(await f.commit(c=>retire(c,text,f.context.encode)),true);
    assert.equal(f.saved().given.at(-1).export,text);
  }
});
test('an invalid or mismatched recovery record refuses the whole candidate',async()=>{
  const f=fixture(store(state([piece()]))),raw=f.shared.raw;
  assert.equal(await f.commit(c=>{retire(c,f.context.encode(piece()),f.context.encode);c.given[0].maker='different';}),false);
  assert.equal(f.shared.raw,raw);assert.equal(f.state().right.length,1);
});
test('unsupported locks retain reads and reject writes without running the mutator',async()=>{
  const f=fixture(store(state([piece()])),{noLocks:true});let ran=false;
  assert.equal(await f.commit(()=>{ran=true;}),false);assert.equal(ran,false);
  assert.equal(f.state().right.length,1);assert.equal(f.shared.writes,0);assert.match(f.el('armerr').textContent,/read-only/);
});
test('a denied storage read is not treated as an empty store',async()=>{
  const f=fixture(store(state([piece()])),{blockRead:true}),raw=f.shared.raw;
  assert.equal(await f.initialize(),false);assert.equal(f.shared.raw,raw);assert.equal(f.shared.writes,0);
  assert.match(f.el('armerr').textContent,/read denied/);
});
test('one pending action per page rejects reentry immediately without growing the lock queue',async()=>{
  const shared=store(),f=fixture(shared);shared.locks.paused=true;let secondRan=false;
  const first=f.commit(c=>{c.right.push(piece());});
  assert.equal(f.context.isStoreBusy(),true);
  assert.equal(await f.commit(()=>{secondRan=true;}),false);assert.equal(secondRan,false);
  assert.equal(shared.locks.requests.length,1);shared.locks.paused=false;shared.locks.drain();
  assert.equal(await first,true);assert.equal(f.context.isStoreBusy(),false);
});
test('an expired queued lock performs no mutation and permits a later retry',async()=>{
  const shared=store(),f=fixture(shared);shared.locks.paused=true;let ran=false;
  const pending=f.commit(()=>{ran=true;});f.signals[0].abort();
  assert.equal(await pending,false);assert.equal(ran,false);assert.equal(shared.writes,0);
  assert.equal(f.context.isStoreBusy(),false);shared.locks.paused=false;shared.locks.drain();
  assert.equal(await f.commit(c=>{c.right.push(piece());}),true);
});
test('mutator refusal, exceptions, async work and invalid results cannot leak private candidate changes',async()=>{
  for(const mutate of [c=>{c.right.push(piece());return false;},c=>{c.right.push(piece());throw Error('refused');},
    async c=>{c.right.push(piece());throw Error('async refused');},c=>{c.right.push(null);}] ){
    const f=fixture(),raw=f.shared.raw;
    assert.equal(await f.commit(mutate),false);assert.equal(f.shared.raw,raw);assert.deepEqual(f.state().right,[]);
  }
});
test('published state is detached from a retained private candidate reference',async()=>{
  const f=fixture();let retained;
  await f.commit(c=>{retained=c;c.right.push(piece());});retained.right.length=0;
  assert.equal(f.state().right.length,1);assert.equal(f.saved().right.length,1);
});
test('storage events replace from fresh bytes, preserve unreadable bytes and never write',()=>{
  const f=fixture(store(state([piece()]))),before=f.state();
  f.shared.raw='unreadable';f.event();assert.deepEqual(f.state(),before);assert.equal(f.shared.raw,'unreadable');
  f.shared.raw=null;f.event(null,null);assert.deepEqual(f.state().right,[]);
  assert.equal(f.shared.raw,null);assert.equal(f.shared.writes,0);
});
