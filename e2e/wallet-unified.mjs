// Browser acceptance without an HTTP listener or a local preview.
// Source files are fulfilled in-memory at the production URL; all other requests
// are blocked. This is a source test, never a deployment or live-chain receipt.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const shots=resolve(root,'e2e/shots-wallet-unified'); await mkdir(shots,{recursive:true});
const origin='https://skaists.dev';
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const browser=await chromium.launch(); let checks=0;
function check(label,value){assert.ok(value,label);console.log('PASS '+(++checks)+': '+label);}
// A stand-in for the Autonomi browser kit's index.js (vendor/ant-browser-sdk/0.1.1).
// It mirrors the kit's manual payment flow: the upload pauses at the payment step
// and hands the page a request with totalAmountAtto, pay() and cancel(). pay()
// is counted and refused; the real limits.js is served from the repo unchanged.
const mockAntKit=`const S=()=>window.__ant;
export const SDK_LIMITS=Object.freeze({minFileBytes:3,maxFileBytes:1000000000});
function review(options,fields,context){
 let status='pending',reject;const settled=new Promise((_,r)=>{reject=r;});
 const request=Object.freeze({...fields,get status(){return status;},
  pay(){S().pays++;status='paying';return Promise.reject(Error('the test forbids payment'));},
  cancel(reason){if(status!=='pending')return false;status='cancelled';S().cancels++;reject(reason instanceof Error?reason:Error(String(reason)));return true;}});
 context.signal?.addEventListener('abort',()=>request.cancel(context.signal.reason),{once:true});
 options.onRequest(request);return settled;
}
export function createManualPaymentProvider(options){return{
 pay(network,quotes,context){return review(options,{network,quotes,totalAmountAtto:quotes.reduce((s,q)=>s+BigInt(q.amount),0n).toString()},context);},
 payMerkle(network,merkle,context){return review(options,{network,quotes:[],totalAmountAtto:merkle.maximumAmount,merkle},context);}};}
export class AutonomiClient{
 static async connect(){const s=S();s.connects++;if(s.mode==='offline')throw Object.assign(Error('Could not connect to Autonomi: no bootstrap answered'),{code:'CONNECTION_FAILED'});return new AutonomiClient();}
 closed=false;close(){this.closed=true;}
 async upload(input,options={}){
  const s=S(),{signal,payment,onProgress}=options;s.uploads++;
  s.last={file:input instanceof File,size:input.size,visibility:options.visibility,retain:options.retainOnFailure,checkpoint:typeof options.onCheckpoint};
  if(s.mode==='hang')return new Promise((_,reject)=>signal.addEventListener('abort',()=>{s.aborted++;reject(signal.reason);},{once:true}));
  if(s.mode==='stored'){for(let i=1;i<=3;i++)onProgress?.({message:'Already present record '+i+'/3'});return{storageCostAtto:'0',payments:[]};}
  const total=s.mode==='partial'?100:3,wave=s.mode==='partial'?64:3;
  for(let i=1;i<=wave;i++)onProgress?.({message:'Quoted record '+i+'/'+total});
  const network={chainId:42161,paymentTokenAddress:'0x'+'a'.repeat(40),paymentVaultAddress:'0x'+'b'.repeat(40)};
  try{
   if(s.mode==='merkle')await payment.payMerkle(network,{maximumAmount:'2000000000000000000',depth:2,poolHashes:[]},{signal});
   else await payment.pay(network,Array.from({length:wave},(_,i)=>({quoteHash:String(i),rewardsAddress:'0x'+'c'.repeat(40),amount:s.mode==='partial'?'1000000000000000':'41152263004115226'})),{signal});
  }catch(error){throw Object.assign(Error('File upload failed: Storage payment failed: '+error.message),{code:'UPLOAD_FAILED'});}
  s.stored++;return{storageCostAtto:'1'};
 }
}`;
try {
 for(const reg of ['bee','raver','cypherpunk']){
  for(const width of [320,390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   const errors=[],localRequests=[];let kitLoads=0,kitMissing=false,relayUploads=0; const label=reg+' '+width;
   await ctx.addInitScript(reg=>{localStorage.setItem('bregister',reg);window.__credentialCalls=0;navigator.credentials.get=async()=>{window.__credentialCalls++;throw Error('credential use forbidden by test');};navigator.credentials.create=navigator.credentials.get;window.__ant={mode:'ok',connects:0,uploads:0,cancels:0,pays:0,aborted:0,stored:0};},reg);
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(['localhost','127.0.0.1','[::1]'].includes(u.hostname))localRequests.push(u.href);
    if(u.hostname==='relay.skaists.dev'&&u.pathname.startsWith('/ant/v1/upload'))relayUploads++;
    if(u.origin===origin&&u.pathname==='/vendor/ant-browser-sdk/0.1.1/index.js'){kitLoads++;return kitMissing?route.fulfill({status:404,body:'not found'}):route.fulfill({contentType:'text/javascript',body:mockAntKit});}
    if(u.origin!==origin)return route.abort();
    const path=resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!path.startsWith(root+sep))return route.abort();
    try{return route.fulfill({body:await readFile(path),contentType:mime[extname(path)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:'not found'});}
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/surfaces/wallet.html');
   await page.waitForFunction(()=>window.BNRWALLET&&document.querySelector('#bpay-card').textContent.includes('Choose'),null,{timeout:15000});
   check(label+' form controls have explicit accessible names',await page.evaluate(()=>[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].every(e=>e.labels?.length||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.title)));
   check(label+' exact wallet identity',await page.locator('.wallet-brand').innerText()==='skaists heART WALLet');
   check(label+' one global presentation selector',await page.locator('[data-inspection]').count()===0);
   check(label+' art remains on a separate surface',await page.locator('#insc-sec').count()===0&&await page.locator('footer a[href="museum.html"]').count()===1);
   await page.screenshot({path:resolve(shots,label.replace(' ','-')+'-home.png'),fullPage:false});
   await page.locator('#wallet-identity a[href="#wallet-accounts"]').click();
   check(label+' account action reveals account book',await page.locator('#wallet-accounts').isVisible());
   const publicRows=[{chain:'vaulta',address:'alice',label:'Savings',kind:'mine'},{chain:'hive',address:'alice',label:'Creator',kind:'following'}];
   const upload=entries=>page.locator('#wa-import-file').setInputFiles({name:'accounts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({v:1,entries}))});
   await upload(publicRows);await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('added 2 accounts.'));
   check(label+' public backup imports both lists',await page.locator('.wa-card').count()===2);
   await page.locator('#wa-search').fill('hive');
   check(label+' network search preserves following distinction',await page.locator('#wa-mine .wa-card').count()===0&&await page.locator('#wa-following .wa-card').count()===1);
   await page.locator('#wa-search').fill('');
   await upload([...publicRows,{chain:'base',address:'private key is invalid',label:'bad',kind:'mine'}]);
   await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('that file could not be imported'));
   check(label+' malformed import is atomic',await page.locator('.wa-card').count()===2);
   await upload(publicRows);await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('those accounts are already in your list'));
   check(label+' reimport does not duplicate accounts',await page.locator('.wa-card').count()===2);
   const downloading=page.waitForEvent('download');await page.locator('#wa-export').click();const download=await downloading;
   const backup=JSON.parse(await readFile(await download.path(),'utf8'));
   check(label+' export contains public account records only',backup.v===1&&backup.entries.length===2&&backup.entries.every(r=>Object.keys(r).every(k=>['chain','address','label','kind'].includes(k))));
   await page.locator('[data-wallet-store]').click();
   check(label+' store reveals both networks',await page.locator('#wallet-storage').isVisible()&&await page.locator('#wallet-storage a').count()===2);
   await page.locator('#wallet-storage a[href="#bpay-sec"]').click();
   check(label+' Autonomi action opens its panel',await page.locator('#bpay-sec').isVisible());
   if(width===390){
    const ant=()=>page.evaluate(()=>({...window.__ant}));
    const status=()=>page.locator('#ant-quote-status').innerText();
    const mode=m=>page.evaluate(m=>{window.__ant.mode=m;},m);
    const quote=async()=>{await page.locator('#ant-quote-go').click();await page.waitForFunction(()=>!document.querySelector('#ant-quote-go').disabled);};
    const idle=async()=>await page.locator('#ant-quote-go').isEnabled()&&await page.locator('#ant-quote-file').isEnabled()&&await page.locator('#ant-quote-cancel').isHidden();
    await page.locator('[data-audience="public"]').click();
    const fileLabel=await page.locator('label[for="ant-quote-file"]').innerText();
    check(label+' file limit comes from the Autonomi browser kit '+JSON.stringify(fileLabel),fileLabel.includes('3 bytes to 1 GB')&&fileLabel.includes("the Autonomi browser kit's limits")&&!/MiB/.test(fileLabel));
    check(label+' quote words name only addresses and sizes leaving',(await page.locator('#bpay-card').innerText()).includes('asks Autonomi storage nodes for a price using only addresses and sizes'));
    await page.locator('#ant-quote-file').setInputFiles({name:'tiny.txt',mimeType:'text/plain',buffer:Buffer.from('ab')});
    await page.locator('#ant-quote-go').click();
    check(label+' a file below the kit minimum is refused before any Autonomi call',(await status())==='Choose Public and a file from 3 bytes to 1 GB.'&&kitLoads===0&&(await ant()).uploads===0&&await idle());
    await page.evaluate(()=>Object.defineProperty(document.querySelector('#ant-quote-file'),'files',{configurable:true,value:[{name:'huge.bin',size:1000000001,type:''}]}));
    await page.locator('#ant-quote-go').click();
    check(label+' a file above the kit maximum is refused before any Autonomi call',(await status())==='Choose Public and a file from 3 bytes to 1 GB.'&&kitLoads===0&&(await ant()).connects===0);
    await page.evaluate(()=>delete document.querySelector('#ant-quote-file').files);
    await page.locator('#ant-quote-file').setInputFiles({name:'public-fixture.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});
    check(label+' choosing a file loads no kit and opens no connection',kitLoads===0&&(await ant()).connects===0);
    await mode('offline');await quote();
    check(label+' unreachable Autonomi is one plain sentence',(await status())==='Quote unavailable: could not reach Autonomi storage nodes from this browser. Nothing was paid.'&&await idle());
    await mode('ok');await quote();
    let said=await status(),seen=await ant();
    check(label+' Autonomi price comes from the kit '+JSON.stringify(said),said.startsWith('0.123456789012345678 ANT · 7 bytes · quoted ')&&said.includes(' · from Autonomi storage nodes. ')&&said.endsWith('Quote only; nothing was stored on Autonomi or paid.'));
    check(label+' the quote cancels the payment request and never pays',seen.cancels===1&&seen.pays===0&&seen.stored===0);
    check(label+' the kit receives the chosen File as Public with nothing retained',seen.last.file&&seen.last.size===7&&seen.last.visibility==='public'&&seen.last.retain===false&&seen.last.checkpoint==='function');
    await mode('merkle');await quote();said=await status();
    check(label+' a merkle batch is shown as its maximum',said.startsWith('up to 2 ANT · 7 bytes · quoted ')&&(await ant()).pays===0);
    await mode('partial');await quote();said=await status();
    check(label+' a price for part of a file says so',said.startsWith('0.064 ANT for 64 of 100 chunks of this file · ')&&said.includes('the full price is not known here'));
    await mode('stored');await quote();said=await status();
    check(label+' a file Autonomi already holds costs nothing',said.startsWith('0 ANT · 7 bytes · checked ')&&said.includes('already hold every chunk'));
    seen=await ant();
    check(label+' one Autonomi connection serves every quote after the failed one',seen.connects===2&&seen.cancels===3&&seen.pays===0&&seen.stored===0);
    await mode('hang');await page.locator('#ant-quote-go').click();
    await page.waitForFunction(n=>window.__ant.uploads>n,seen.uploads);
    await page.locator('#ant-quote-cancel').click();
    check(label+' stop aborts the Autonomi request',(await status())==='Request stopped. Nothing was paid.'&&(await ant()).aborted===1&&await idle());
    check(label+' no request reaches the Autonomi relay upload door',relayUploads===0);
    kitMissing=true;
    const bare=await ctx.newPage();bare.on('pageerror',e=>errors.push(e.message));
    await bare.goto(origin+'/surfaces/wallet.html');
    await bare.waitForFunction(()=>window.BNRWALLET&&document.querySelector('#ant-quote-file'),null,{timeout:15000});
    await bare.locator('[data-wallet-store]').click();await bare.locator('#wallet-storage a[href="#bpay-sec"]').click();
    await bare.locator('#ant-quote-file').setInputFiles({name:'public-fixture.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});
    await bare.locator('#ant-quote-go').click();await bare.waitForFunction(()=>!document.querySelector('#ant-quote-go').disabled);
    check(label+' a kit that does not load restores the controls',(await bare.locator('#ant-quote-status').innerText())==='Quote unavailable: the Autonomi browser kit did not load. Reload and try again.'&&await bare.locator('#ant-quote-file').isEnabled());
    await bare.close();kitMissing=false;
   }
   await page.locator('[data-wallet-store]').click();
   await page.screenshot({path:resolve(shots,label.replace(' ','-')+'-storage.png'),fullPage:false});
   await page.locator('#wallet-storage a[href="#arw-sec"]').click();
   check(label+' Arweave action opens its panel',await page.locator('#arw-sec').isVisible());
   check(label+' no localhost service touched',localRequests.length===0);
   check(label+' navigation requests no credentials',await page.evaluate(()=>window.__credentialCalls)===0);
   check(label+' no runtime errors: '+errors.join('; '),errors.length===0);
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({id:e.id,tag:e.tagName,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))}));
   check(label+' no horizontal page overflow '+JSON.stringify(overflow),overflow.scroll<=overflow.width+1);
   await ctx.close();
  }
 }
}finally{await browser.close();}
console.log('Wallet unification: '+checks+' checks passed; source fixture only, no server, no live funds.');
