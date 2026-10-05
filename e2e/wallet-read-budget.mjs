// Fifty public accounts plus overlapping manual/token actions. No listener or live RPC.
import assert from 'node:assert/strict';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {installWalletFixture,WALLET_ORIGIN} from './lib/wallet-source-fixture.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch();await installWalletFixture(browser,root);
let checks=0;const check=(name,value)=>{assert.ok(value,name);console.log('PASS '+(++checks)+': '+name)};
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const entries=Array.from({length:50},(_,i)=>({chain:'base',address:'0x'+(i+1).toString(16).padStart(40,'0'),kind:i%2?'following':'mine',label:'Account '+String(i+1).padStart(2,'0')}));
 await context.addInitScript(entries=>{localStorage.setItem('bregister','bee');localStorage.setItem('bnr.wallet.public-accounts.v1',JSON.stringify({v:1,entries}));window.__credentials=0;navigator.credentials.get=async()=>{window.__credentials++;throw Error('credentials forbidden')};navigator.credentials.create=navigator.credentials.get;},entries);
 let release;const gate=new Promise(resolve=>release=resolve);let active=0,peak=0,total=0;const seen=[],errors=[];
 await context.route(/^https:\/\/(mainnet\.base\.org|base\.publicnode\.com|base-rpc\.publicnode\.com|1rpc\.io|base\.drpc\.org)(\/|$)/,async route=>{
  const req=route.request();let body;try{body=req.postDataJSON()}catch{return route.abort()}
  active++;peak=Math.max(peak,active);total++;
  await gate;await new Promise(resolve=>setTimeout(resolve,25));
  const respond=request=>{
   const address=request.params?.[0]?.to||request.params?.[0];
   if(typeof address==='string')seen.push(address);
   if(address===entries[24].address)return {id:request.id,error:{code:-32000,message:'fixture unavailable'}};
   const value=request.method==='eth_chainId'?'0x2105':request.method==='eth_blockNumber'?'0x100':request.method==='eth_getBalance'?'0xde0b6b3a7640000':'0x'+(request.params?.[0]?.data==='0x313ce567'?6n:1000000n).toString(16).padStart(64,'0');
   return {jsonrpc:'2.0',id:request.id,result:value};
  };
  active--;await route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(Array.isArray(body)?body.map(respond):respond(body))});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const start=Date.now();
 await page.goto(WALLET_ORIGIN+'/surfaces/wallet.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.BNRWALLET&&document.querySelectorAll('.wa-card').length===50);
 await page.waitForTimeout(100);
 check('opening the wallet home does not read fifty hidden accounts',total===0);
 await page.locator('#wallet-identity a[href="#wallet-accounts"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.wa-card[data-state="reading"]').length===3);
 check('all fifty accounts render while three reads are in flight',await page.locator('.wa-card').count()===50&&peak===3);
 await page.locator('#wa-search').fill('Account 50');
 const last=page.locator('.wa-card');
 await last.locator('[data-wa-action="refresh"]').click();
 await last.locator('[data-wa-action="coins"]').click();
 await last.locator('[data-wa-action="remove"]').click();
 check('search and removal remain usable during blocked reads',await page.locator('.wa-card').count()===0&&(await page.locator('#wa-status').innerText()).includes('removed'));
 release();
 await page.locator('#wa-search').fill('');
 await page.waitForFunction(()=>!document.querySelector('#wa-refresh').disabled,{},{timeout:30000});
 check('bulk and individual work share a three-request ceiling',peak===3);
 check('removed queued account never reaches a public endpoint',!seen.includes(entries[49].address));
 check('one failed account does not stop the other forty-eight',await page.locator('.wa-card[data-state="ready"]').count()===48&&await page.locator('.wa-card[data-state="failed"]').count()===1);
 check('failed read has no invented zero',await page.locator('.wa-card[data-state="failed"] .wa-amount').count()===0);
 check('public reads never request credentials',await page.evaluate(()=>window.__credentials)===0);
 check('no runtime errors under the bounded load',errors.length===0);
 console.log(JSON.stringify({fixtureOnly:true,accounts:50,remaining:49,peakRpcRequests:peak,totalRpcRequests:total,elapsedMs:Date.now()-start}));
 await context.close();
}finally{await browser.close()}
console.log('Wallet read budget: '+checks+' checks passed. This is a single-browser fixture, not production capacity.');
