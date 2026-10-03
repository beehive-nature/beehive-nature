// Coins only. Exercises the shipped inline reader without a server/browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../surfaces/wallet.html',import.meta.url),'utf8');
const source=html.match(/<script id="wallet-coins">([\s\S]*?)<\/script>/)[1];
const registry=JSON.parse(readFileSync(new URL('../docs/receipts/deployments.json',import.meta.url),'utf8'));
const owner='0x'+'12'.repeat(20),custom='0x'+'34'.repeat(20);
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
function harness(mode={}){
  const requests=[];
  const context={window:{},location:{href:'https://skaists.dev/surfaces/wallet.html'},URL,AbortController,setTimeout,clearTimeout,console};
  context.fetch=async(url,options)=>{
    if(String(url).endsWith('/docs/receipts/deployments.json'))return {ok:true,json:async()=>registry};
    const batch=JSON.parse(options.body);requests.push({url,batch});
    assert.ok(batch.length<=16,'bounded batch size');
    let answer=batch.map(r=>{
      assert.ok(['eth_chainId','eth_blockNumber','eth_call'].includes(r.method),'read-only method');
      const chain=/ethereum|eth\.drpc/.test(url)?1:8453;
      if(r.method==='eth_chainId')return {id:r.id,result:mode.wrongChain?'0x99':'0x'+chain.toString(16)};
      if(r.method==='eth_blockNumber')return {id:r.id,result:'0x100'};
      assert.equal(r.params[1],'0x100','all token reads use observed block');
      const decimals=r.params[0].data==='0x313ce567';
      if(mode.error)return {id:r.id,error:{code:-32000,message:'reverted'}};
      if(mode.partial&&r.params[0].to===registry.deployments[0].address)return {id:r.id,error:{code:-32000}};
      return {id:r.id,result:mode.malformed?'0x1234':decimals?word(mode.badDecimals?256:6):word(mode.zero?0:9007199254740993123456789n)};
    }).reverse(); // JSON-RPC does not promise response ordering.
    if(mode.duplicate)answer[0]={...answer[1]};
    if(mode.missing)answer.pop();
    return {ok:true,text:async()=>JSON.stringify(answer)};
  };
  vm.runInNewContext(source,context);
  return {api:context.window.BNRCoins,requests};
}
test('complete measured family on its own chains; reordered replies keep exact units',async()=>{
  const {api,requests}=harness(),rows=await api.readHoldings(owner);
  assert.equal(rows.length,registry.deployments.length);
  assert.equal(rows.filter(r=>r.chain==='base').length,12);
  assert.equal(rows.filter(r=>r.chain==='ethereum').length,1);
  assert.ok(rows.every(r=>r.quantity==='9007199254740993123.456789'&&r.decimals===6&&r.block==='0x100'));
  for(const {url,batch} of requests)for(const r of batch.filter(r=>r.method==='eth_call')){
    const deployment=registry.deployments.find(d=>d.address===r.params[0].to);
    assert.equal(/ethereum|eth\.drpc/.test(url),deployment.chain==='ethereum');
  }
});
test('Base reads every registered Base token, not only the five art renderers',async()=>{
  const {api}=harness(),rows=await api.readHoldings(owner,{chain:'base'});
  for(const name of ['TRUFFI','JEDI','MiDi-1','MiDi-2','MiDi-3','Souli','NTNT'])assert.ok(rows.some(r=>r.name===name&&r.state==='held'));
});
test('additional contracts are deduplicated and do not replace the census',async()=>{
  const {api}=harness(),rows=await api.readHoldings(owner,{chain:'base',contracts:[custom,custom.toUpperCase().replace('0X','0x')]});
  assert.equal(rows.length,13);assert.equal(rows.filter(r=>r.address===custom).length,1);
});
for(const [name,mode] of Object.entries({wrongChain:{wrongChain:true},missing:{missing:true},duplicate:{duplicate:true},malformed:{malformed:true},badDecimals:{badDecimals:true},reverted:{error:true}})){
  test(name+' never becomes a zero or a successful balance',async()=>{
    const {api}=harness(mode),rows=await api.readHoldings(owner,{chain:'base'});
    assert.ok(rows.every(r=>r.state==='unavailable'&&r.quantity===undefined));
  });
}
test('partial failure is retained alongside successful token reads',async()=>{
  const {api}=harness({partial:true}),rows=await api.readHoldings(owner,{chain:'base'});
  assert.equal(rows[0].state,'unavailable');assert.ok(rows.slice(1).every(r=>r.state==='held'));
});
test('confirmed zero is explicitly empty',async()=>{
  const {api}=harness({zero:true}),rows=await api.readHoldings(owner,{chain:'base'});
  assert.ok(rows.every(r=>r.state==='empty'&&r.quantity==='0'));
});
test('bad public inputs are rejected before any RPC',async()=>{
  const {api,requests}=harness();
  await assert.rejects(api.readHoldings('private material'));
  await assert.rejects(api.readHoldings(owner,{chain:'unknown'}));
  await assert.rejects(api.readHoldings(owner,{chain:'base',contracts:['bad']}));
  await assert.rejects(api.readHoldings(owner,{chain:'base',contracts:Array(21).fill(custom)}));
  assert.equal(requests.length,0);
});
test('the coin reader has no art renderer or signing calls',()=>{
  assert.doesNotMatch(source,/LevelTruth|svgCallData|getSvg|eth_send|eth_sign|personal_sign/);
});
async function hiveBalance(account){
  let reply;
  const context={self:{},AbortController,setTimeout,clearTimeout,postMessage:value=>{reply=value},fetch:async()=>({ok:true,json:async()=>({result:[account]})})};
  vm.runInNewContext(readFileSync(new URL('../surfaces/wallet-adapter-hive.js',import.meta.url),'utf8'),context);
  await context.self.onmessage({data:{jsonrpc:'2.0',id:1,method:'balance',params:{address:'alice'}}});
  return reply;
}
test('Hive keeps exact HIVE and HBD quantities without floating-point conversion',async()=>{
  const reply=await hiveBalance({balance:'9007199254740993.123 HIVE',hbd_balance:'8.765 HBD'});
  assert.equal(reply.result.balances.join('|'),'9007199254740993.123 HIVE|8.765 HBD');
});
test('missing HBD is unavailable, not a invented zero',async()=>{
  const reply=await hiveBalance({balance:'1.000 HIVE'});
  assert.equal(reply.result.hbdAvailable,false);assert.equal(reply.result.balances.length,1);
});
test('malformed HIVE is an error, not a zero',async()=>{
  const reply=await hiveBalance({balance:'not a balance'});
  assert.ok(reply.error);assert.equal(reply.result,undefined);
});
