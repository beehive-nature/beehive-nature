import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const {createHosted}=createRequire(import.meta.url)('../surfaces/ant-pay.js');
const addr=n=>'0x'+n.repeat(40), hash=n=>'0x'+n.repeat(64);
const bytes=new TextEncoder().encode('Agent 20 storage fixture, no live funds.');
const artifact={name:'fixture.txt',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
const network={chainId:42161,paymentTokenAddress:addr('a'),paymentVaultAddress:addr('b')};
const quotes=[{quoteHash:hash('c'),rewardsAddress:addr('d'),amount:'100'}];
function fixture(options={}){
 const data=new Map(),txs=new Map();let time=1000,nonce=0,sends=0,failSend=false,account=addr('e'),chain='0xa4b1',mined=true,tamper=false,throwSave=false;
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(throwSave)throw Error('disk full');data.set(k,v);}};
 const rpc=async(method,p)=>{
  if(method==='eth_chainId')return '0xa4b1';
  if(method==='eth_call')return p[0].data.startsWith('0xdd62ed3e')?(options.approved?'0xffff':'0x0'):'0xffff';
  if(method==='eth_gasPrice')return '0x2';
  if(method==='eth_getBalance')return '0xffffffffff';
  if(method==='eth_estimateGas')return '0xc350';
  if(method==='eth_getTransactionCount')return '0x'+nonce.toString(16);
  if(method==='eth_blockNumber')return options.latestBlock||'0x65';
  if(method==='eth_getBlockByNumber')return {hash:hash('f'),transactions:[...txs.values()]};
  if(method==='eth_getTransactionByHash'){const tx=txs.get(p[0]);return tamper?{...tx,input:'0xdead'}:tx;}
  if(method==='eth_getTransactionReceipt')return mined?{transactionHash:p[0],blockNumber:'0x64',blockHash:hash('f'),status:options.revert?'0x0':'0x1',gasUsed:'0xc350',effectiveGasPrice:'0x2'}:null;
  throw Error(method);
 };
 const ethereum={request:async({method,params})=>{
  if(method==='eth_chainId')return chain;
  if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
  if(method==='eth_sendTransaction'){sends++;const tx={...params[0],input:params[0].data,hash:hash(String(sends))};txs.set(tx.hash,tx);nonce++;if(failSend)throw Error('connection lost after broadcast');return tx.hash;}
  throw Error(method);
 }};
 const cfg={artifact,network,storage,rpc,ethereum,now:()=>time,sleep:async()=>{}};
 let payer=createHosted(cfg);
 return {get payer(){return payer;},get sends(){return sends;},rpc,storage,cfg,txs,reload(){payer=createHosted(cfg);return payer;},time:n=>time=n,account:n=>account=n,chain:n=>chain=n,failSend:n=>failSend=n,mined:n=>mined=n,tamper:n=>tamper=n,throwSave:n=>throwSave=n};
}
async function authorized(f,q=quotes){const inv=await f.payer.invoice(network,q,'20000000');f.payer.authorize(inv);return inv;}
function nativeFixture(options={}){
 const f=fixture({approved:true}),base=f.cfg.rpc;let broadcasts=0;
 f.cfg.signer={address:()=>addr('e'),signTransaction:async(tx,bound)=>{
  assert.equal(bound.invoice.authorization.invoice,bound.invoice.id);
  if(options.refuse)throw Error('keychain locked');
  if(options.expire)f.time(bound.invoice.expiresAt);
  f.txs.set(hash('1'),{...tx,input:tx.data,hash:hash('1')});
  return {raw:'0x0201',hash:hash('1')}; // Stub envelope: real Rust signatures are tested in ant-hosted-browser.
 }};
 f.cfg.rpc=async(method,p)=>{
  if(method!=='eth_sendRawTransaction')return base(method,p);
  broadcasts++;
  const kept=JSON.parse(f.storage.getItem('bnr.ant.purchase.v1:'+artifact.sha256)).plans[0].txs[0];
  assert.equal(kept.raw,p[0]);assert.equal(kept.hash,hash('1'));assert.equal(kept.state,'sending');
  if(options.lostReply)throw Error('reply lost after broadcast');
  return hash('1');
 };
 f.reload();return {f,get broadcasts(){return broadcasts;}};
}
test('native signer persists envelope and hash before broadcast, then recovers a lost reply without another send',async()=>{
 const n=nativeFixture({lostReply:true}),inv=await authorized(n.f);
 await assert.rejects(n.f.payer.provider(inv.id).pay(network,quotes,{}),/reply lost/);
 assert.equal(n.broadcasts,1);assert.equal(n.f.sends,0);
 n.f.reload();await n.f.payer.provider(inv.id).recover(network,quotes,{},{});
 assert.equal(n.broadcasts,1);assert.equal(n.f.payer.snapshot().plans[0].txs[0].state,'confirmed');
});
test('native keychain refusal and expiry during signing never broadcast',async()=>{
 for(const options of [{refuse:true},{expire:true}]){
  const n=nativeFixture(options),inv=await authorized(n.f);
  await assert.rejects(n.f.payer.provider(inv.id).pay(network,quotes,{}));
  assert.equal(n.broadcasts,0);assert.equal(n.f.sends,0);
  if(options.refuse)assert.equal(n.f.payer.snapshot().plans[0].txs[0].state,'planned');
 }
});
test('invoice binds file, network, payer, quotes, separate gas; exact approval and verified retrieval',async()=>{
 const f=fixture(),inv=await authorized(f);const receipt=await f.payer.provider(inv.id).pay(network,quotes,{});assert.equal(f.sends,2);assert.equal(receipt.totalAmount,'100');assert.ok(f.payer.snapshot().plans[0].txs.every(t=>t.state==='confirmed'));f.payer.uploaded({file:{address:'fixture-only'}});const result=await f.payer.reconcile(bytes);assert.equal(result.retrievedSha256,artifact.sha256);assert.equal(result.gasWei,'200000');assert.equal(result.storageAtto,'100');
});
test('no authorization, expired authorization, cancellation all sign nothing',async()=>{
 for(const mode of ['none','expired','cancel']){const f=fixture();const inv=await f.payer.invoice(network,quotes,'20000000');if(mode!=='none')f.payer.authorize(inv);if(mode==='expired')f.time(inv.expiresAt);const signal=mode==='cancel'?AbortSignal.abort():undefined;await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{signal}));assert.equal(f.sends,0);}
});
test('tampered displayed invoice or changed quote, recipient, account and chain refuse before signing',async()=>{
 const f=fixture();const shown=await f.payer.invoice(network,quotes,'20000000');assert.throws(()=>f.payer.authorize({...shown,total:'101'}));f.payer.authorize(shown);
 await assert.rejects(f.payer.provider(shown.id).pay(network,[{...quotes[0],amount:'101'}],{}));
 await assert.rejects(f.payer.provider(shown.id).pay({...network,paymentVaultAddress:addr('0')},quotes,{}));
 f.account(addr('0'));await assert.rejects(f.payer.provider(shown.id).pay(network,quotes,{}));f.account(addr('e'));f.chain('0x1');await assert.rejects(f.payer.provider(shown.id).pay(network,quotes,{}));assert.equal(f.sends,0);
});
test('100 ANT total and separate aggregate gas ceilings refuse',async()=>{
 const f=fixture();await assert.rejects(f.payer.invoice(network,[{...quotes[0],amount:(101n*10n**18n).toString()}],'20000000'),/100 ANT/);await assert.rejects(f.payer.invoice(network,quotes,'1'),/above your limit/);assert.equal(f.sends,0);
});
test('receipt survives reload and retry reuses payment without signing',async()=>{
 const f=fixture(),inv=await authorized(f);await f.payer.provider(inv.id).pay(network,quotes,{});f.reload();f.time(inv.expiresAt+1000);await f.payer.provider(null).recover(network,quotes,{},{});assert.equal(f.sends,2);
});
test('unknown broadcast is discovered by payer nonce; no duplicate payment',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);f.failSend(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/connection lost/);assert.equal(f.sends,1);f.reload();assert.equal(f.payer.snapshot().plans[0].txs[0].state,'sending');await f.payer.provider(null).recover(network,quotes,{},{});assert.equal(f.sends,1);
});
test('unknown without transaction stays reserved and cannot be resubmitted',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);f.failSend(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}));f.txs.clear();f.reload();await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/unknown/);assert.equal(f.sends,1);assert.equal(f.payer.snapshot().plans[0].txs[0].reservedWei,'12000000');
});
test('pending receipt keeps gas reservation; late receipt reconciles',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);f.mined(false);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/pending/);assert.equal(f.sends,1);assert.equal(f.payer.snapshot().plans[0].txs[0].actualWei,undefined);f.mined(true);await f.payer.provider(null).recover(network,quotes,{},{});assert.equal(f.sends,1);
});
test('mismatched mined transaction never produces paid receipt',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);f.tamper(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/differs/);assert.equal(f.payer.snapshot().receipt,null);
});
test('reverted transaction retains actual gas and never auto retries',async()=>{
 const f=fixture({approved:true,revert:true}),inv=await authorized(f);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/reverted/);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/reverted/);assert.equal(f.sends,1);assert.equal(f.payer.snapshot().plans[0].txs[0].actualWei,'100000');
});
test('durable write failure prevents wallet request',async()=>{
 const f=fixture(),inv=await authorized(f);f.throwSave(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}),/disk full/);assert.equal(f.sends,0);
});
test('wrong retrieved bytes cannot be reconciled',async()=>{
 const f=fixture();f.payer.uploaded({file:{address:'fixture-only'}});await assert.rejects(f.payer.reconcile(new Uint8Array(bytes.length)),/do not match/);assert.equal(f.payer.snapshot().receipt,null);
});
test('partial overlap and second wave gas accumulation refuse duplicate/excess exposure',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);await f.payer.provider(inv.id).pay(network,quotes,{});await assert.rejects(f.payer.invoice(network,[...quotes,{...quotes[0],quoteHash:hash('d')}],'20000000'),/overlaps/);await assert.rejects(f.payer.invoice(network,[{...quotes[0],quoteHash:hash('d')}],'1'),/original aggregate/);assert.equal(f.sends,1);
});
test('interrupted approval-only plan reprices without losing gas or duplicating approval',async()=>{
 const options={approved:false},f=fixture(options);const inv=await authorized(f);f.payer.checkpoint({fixture:true});
 f.failSend(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}));assert.equal(f.sends,1);
 f.failSend(false);await f.payer.retryUnpaid();assert.equal(f.payer.snapshot().checkpoint,null);assert.equal(f.payer.snapshot().plans[0].txs[0].actualWei,'100000');assert.equal(f.sends,1);
 options.approved=true;const fresh=await authorized(f);await f.payer.provider(fresh.id).pay(network,quotes,{});f.payer.uploaded({file:{address:'fixture-only'}});assert.equal((await f.payer.reconcile(bytes)).gasWei,'200000');assert.equal(f.sends,2);
});
test('quote claims prevent a second file reusing the same quote',async()=>{
 const f=fixture({approved:true}),inv=await authorized(f);await f.payer.provider(inv.id).pay(network,quotes,{});
 const other=createHosted({...f.cfg,artifact:{...artifact,sha256:'a'.repeat(64)}});
 await assert.rejects(other.invoice(network,quotes,'20000000'),/another saved file/);assert.equal(f.sends,1);
});

test('delayed unknown-broadcast recovery searches the original blocks instead of refusing old history',async()=>{
 const options={approved:true},f=fixture(options),inv=await authorized(f);f.failSend(true);await assert.rejects(f.payer.provider(inv.id).pay(network,quotes,{}));options.latestBlock='0x9999';f.reload();await f.payer.provider(null).recover(network,quotes,{},{});assert.equal(f.sends,1);
});
