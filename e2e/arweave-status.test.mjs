import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../surfaces/arweave.js',import.meta.url),'utf8');
const txid='A'.repeat(43),valid={block_height:641606,block_indep_hash:'B'.repeat(64),number_of_confirmations:12};
function fixture(answer){
 const calls=[];
 const context={crypto:globalThis.crypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,setTimeout,clearTimeout,atob,btoa,fetch:async(url,options)=>{calls.push({url,options});const reply=answer(calls.length);return {status:reply.status,ok:reply.status>=200&&reply.status<300,text:async()=>JSON.stringify(reply.body)}}};
 context.self=context;vm.runInNewContext(source,context);return {api:context.BNRAR,calls};
}
test('documented status evidence produces a confirmation and exact block receipt',async()=>{
 const f=fixture(()=>({status:200,body:valid}));const result=await f.api.txStatus(txid);
 assert.equal(result.tx,'confirmed');assert.equal(result.confirmations,12);assert.equal(result.block_height,641606);assert.equal(result.block_indep_hash,valid.block_indep_hash);assert.ok(f.calls[0].url.endsWith('/tx/'+txid+'/status'));
});
for(const body of [{status:'confirmed',confirmations:20},{...valid,number_of_confirmations:0},{...valid,number_of_confirmations:'12'},{...valid,block_height:-1},{...valid,block_indep_hash:'wrong'},null]){
 test('HTTP 200 cannot invent confirmation from '+JSON.stringify(body),async()=>{const f=fixture(()=>({status:200,body}));assert.equal((await f.api.txStatus(txid)).tx,'unreachable');assert.equal(f.calls.length,f.api.GATEWAYS.length);});
}
test('pending and not-found remain nonterminal',async()=>{for(const status of [202,404,410]){const f=fixture(()=>({status,body:'pending'}));const result=await f.api.txStatus(txid);assert.notEqual(result.tx,'confirmed');assert.equal(result.confirmations,0);}});
test('rate-limited gateway rotates to a valid status reader',async()=>{const f=fixture(n=>n===1?{status:429,body:'rate limit'}:{status:200,body:valid});assert.equal((await f.api.txStatus(txid)).tx,'confirmed');assert.equal(f.calls.length,2);});
test('invalid transaction ID never reaches a gateway',async()=>{const f=fixture(()=>({status:200,body:valid}));await assert.rejects(f.api.txStatus('../status'));assert.equal(f.calls.length,0);});
test('transfer fee uses the documented path separator',async()=>{const f=fixture(()=>({status:200,body:'123'}));await f.api.fee(0,txid);assert.ok(f.calls[0].url.endsWith('/price/0/'+txid));});
