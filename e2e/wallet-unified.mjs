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
try {
 for(const reg of ['bee','raver','cypherpunk']){
  for(const width of [320,390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   const errors=[],localRequests=[];let quoteMode='ok',antPosts=0; const label=reg+' '+width;
   await ctx.addInitScript(reg=>{localStorage.setItem('bregister',reg);window.__credentialCalls=0;navigator.credentials.get=async()=>{window.__credentialCalls++;throw Error('credential use forbidden by test');};navigator.credentials.create=navigator.credentials.get;},reg);
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(['localhost','127.0.0.1','[::1]'].includes(u.hostname))localRequests.push(u.href);
    if(u.hostname==='relay.skaists.dev'&&u.pathname==='/ant/v1/upload/prepare'){
     const request=route.request(),headers={'access-control-allow-origin':'*'};
     if(request.method()==='GET')return route.fulfill({status:quoteMode==='closed'?503:200,headers,contentType:'application/json',body:JSON.stringify({max_bytes:1048576})});
     antPosts++;
     return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({upload_id:'test-file',payment_type:'wave_batch',total_atto:quoteMode==='bad'?'1':'123456789012345678',chunks:{total:1},quotes:[{quote_hash:'1'.repeat(64),amount_atto:'123456789012345678',rewards_address:'0x'+'3'.repeat(40)}],data_map_address:'2'.repeat(64)})});
    }
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
   await upload(publicRows);await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('Imported'));
   check(label+' public backup imports both lists',await page.locator('.wa-card').count()===2);
   await page.locator('#wa-search').fill('hive');
   check(label+' network search preserves following distinction',await page.locator('#wa-mine .wa-card').count()===0&&await page.locator('#wa-following .wa-card').count()===1);
   await page.locator('#wa-search').fill('');
   await upload([...publicRows,{chain:'base',address:'private key is invalid',label:'bad',kind:'mine'}]);
   await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('Import refused'));
   check(label+' malformed import is atomic',await page.locator('.wa-card').count()===2);
   await upload(publicRows);await page.waitForFunction(()=>document.querySelector('#wa-status').textContent.startsWith('Imported'));
   check(label+' reimport does not duplicate accounts',await page.locator('.wa-card').count()===2);
   const downloading=page.waitForEvent('download');await page.locator('#wa-export').click();const download=await downloading;
   const backup=JSON.parse(await readFile(await download.path(),'utf8'));
   check(label+' export contains public account records only',backup.v===1&&backup.entries.length===2&&backup.entries.every(r=>Object.keys(r).every(k=>['chain','address','label','kind'].includes(k))));
   await page.locator('[data-wallet-store]').click();
   check(label+' store reveals both networks',await page.locator('#wallet-storage').isVisible()&&await page.locator('#wallet-storage a').count()===2);
   await page.locator('#wallet-storage a[href="#bpay-sec"]').click();
   check(label+' Autonomi action opens its panel',await page.locator('#bpay-sec').isVisible());
   if(width===390){
    await page.locator('[data-audience="public"]').click();
    await page.locator('#ant-quote-file').setInputFiles({name:'public-fixture.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});
    check(label+' choosing a file sends no bytes',antPosts===0);
    await page.locator('#ant-quote-go').click();
    await page.waitForFunction(()=>!document.querySelector('#ant-quote-go').disabled);
    check(label+' Autonomi exact quote uses the shared adapter',(await page.locator('#ant-quote-status').innerText()).includes('0.123456789012345678 ANT')&&antPosts===1);
    quoteMode='bad';await page.locator('#ant-quote-go').click();await page.waitForFunction(()=>!document.querySelector('#ant-quote-go').disabled);
    check(label+' mismatched quote clears the old price',(await page.locator('#ant-quote-status').innerText()).startsWith('Quote unavailable')&&!(await page.locator('#ant-quote-status').innerText()).includes('0.123456789'));
    await page.evaluate(()=>{window.__spawn=window.BnrSeam.spawn;window.BnrSeam.spawn=()=>{throw Error('Worker unavailable');};});
    await page.locator('#ant-quote-go').click();
    check(label+' worker startup failure restores controls',await page.locator('#ant-quote-go').isEnabled()&&await page.locator('#ant-quote-file').isEnabled()&&(await page.locator('#ant-quote-status').innerText()).includes('Worker unavailable'));
    await page.evaluate(()=>{window.BnrSeam.spawn=window.__spawn;});
    quoteMode='closed';const sent=antPosts;await page.locator('#ant-quote-go').click();await page.waitForFunction(()=>!document.querySelector('#ant-quote-go').disabled);
    check(label+' closed service refuses before uploading bytes',antPosts===sent&&(await page.locator('#ant-quote-status').innerText()).includes('Your file was not sent.'));
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
