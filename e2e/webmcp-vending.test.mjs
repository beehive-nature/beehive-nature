/* WEBML raid S4 — execute the shipped WebMCP block (extracted from vending.html between
   the WEBMCP markers) in three worlds: no document.modelContext (inert), a refusing
   permissions policy (silence, no throw), and a recording agent host (one read-only tool
   whose payload is the FIXED WHITELIST — the reader's typed name never crosses the door). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../surfaces/vending.html',import.meta.url),'utf8');
const start=page.indexOf('/*WEBMCP-START*/'), end=page.indexOf('/*WEBMCP-END*/');
assert.ok(start!==-1&&end!==-1,'the WEBMCP block is marker-bounded in vending.html');
const block=page.slice(start,end);

const TYPED_STATE=()=>({ /* the eternal front's live data — includes reader-private fields */
  raw:'FOUNDERS-TYPED-NAME', canonical:'founders-typed-name', changed:false, tongue:'en',
  taken:true, key:'1234567890', keyHex:'0x1', error:'', locale:'en',
  /* …and the public sheet the tool MAY return: */
  updated:'2026-09-30', count:12, max:7776, basisTxt:'0.6000 A', basisA:0.6, ramA:0.4,
  titheBp:1000, titheA:0.06, totalA:1.06, totalUsd:3.39, price:3.2, priceKind:'coingecko',
  chainRead:true, lawRead:true, certs:5 });

function run({modelContext=null, eternal=null}={}){
  const sandbox={ document:{ }, console:{ } , __eternal:eternal, __vending:eternal?undefined:undefined };
  if(modelContext) sandbox.document.modelContext=modelContext;
  sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
  vm.runInNewContext(block,sandbox);
  return sandbox;
}
const drain=()=>new Promise(r=>setImmediate(r));

test('no document.modelContext → inert, no throw', ()=>{
  const sandbox=run({modelContext:null, eternal:{data:TYPED_STATE}});
  assert.equal(sandbox.document.modelContext,undefined,'nothing registered, page unchanged');
});

test('Permissions-Policy refusal (NotAllowedError) → silence, no throw', async()=>{
  let attempted=0;
  const sandbox=run({ modelContext:{ registerTool(){ attempted++; return Promise.reject(new Error('NotAllowedError')); } },
                      eternal:{data:TYPED_STATE} });
  await drain();
  assert.equal(attempted,1,'one attempt, its rejection swallowed by design');
});

test('recording host → ONE read-only tool, spec shape, whitelist payload', async()=>{
  const registered=[];
  const sandbox=run({ modelContext:{ registerTool(t){ registered.push(t); return Promise.resolve(); } },
                      eternal:{data:TYPED_STATE} });
  await drain();
  assert.equal(registered.length,1);
  const tool=registered[0];
  assert.equal(tool.name,'read_vending_state');
  assert.equal(tool.inputSchema.type,'object');
  assert.equal(tool.inputSchema.additionalProperties,false,'empty, closed input schema');
  const out=await tool.execute({});
  assert.equal(out.content.length,1); assert.equal(out.content[0].type,'text');
  const payload=JSON.parse(out.content[0].text);
  /* the whitelist — public sheet only */
  assert.equal(payload.count,12); assert.equal(payload.max,7776);
  assert.equal(payload.basisTxt,'0.6000 A'); assert.equal(payload.price,3.2);
  assert.equal(payload.lawRead,true); assert.ok(payload.note.indexOf('read-only')!==-1);
  /* the reader's typed name and its derivations NEVER cross the machine door */
  for(const forbidden of ['raw','canonical','tongue','taken','key','keyHex','locale','changed','error'])
    assert.equal(payload[forbidden],undefined,'opacity: '+forbidden+' must not leak');
});

test('chain not yet read → the tool says so in the page\'s own honest words', async()=>{
  const registered=[];
  run({ modelContext:{ registerTool(t){ registered.push(t); return Promise.resolve(); } },
        eternal:{ data:()=>({ chainRead:false, lawRead:false, certs:0 }) } });
  await drain();
  const payload=JSON.parse((await registered[0].execute({})).content[0].text);
  assert.equal(payload.lawRead,false);
  assert.ok(payload.note.indexOf('not read yet')!==-1,'no value the chain has not given');
});

test('no __eternal at all → the tool still answers from window.__vending, whitelist-only', async()=>{
  const registered=[];
  const sandbox={ document:{}, console:{}, __vending:{ law:null, certs:[], price:null } };
  sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
  sandbox.document.modelContext={ registerTool(t){ registered.push(t); return Promise.resolve(); } };
  vm.runInNewContext(block,sandbox);
  await drain();
  const payload=JSON.parse((await registered[0].execute({})).content[0].text);
  assert.ok(payload.note.indexOf('not read yet')!==-1);
  assert.equal(payload.count,undefined,'nothing invented');
});
