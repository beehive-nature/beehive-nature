/* Real rendered interactions for the shared reading rooms. Run from repo root:
   node e2e/reading-rooms.browser.mjs. No outbound requests or credentials. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const corpus=JSON.parse(readFileSync(resolve(root,'surfaces/lang-corpus.json'),'utf8'));
const pages=['bearth.html','bfood.html','bsymposium.html','blongevity.html','bigen.html','university/index.html','onboarding/index.html','review.html'];
const server=createServer(async(req,res)=>{
  try{
    let file=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+sep))throw Error('outside root');
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.css':'text/css'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const shots=resolve(tmpdir(),'bnr-reading-rooms');await mkdir(shots,{recursive:true});
let assertions=0;
function ok(condition,why){assert.ok(condition,why);assertions++;}
try{
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    const context=await browser.newContext({viewport:size});
    await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const path of pages){
      await page.goto(base+'/surfaces/'+path);await page.locator('[data-reading-room]').waitFor();
      await page.locator('#breg-bee').click();await page.locator('#blangsel').selectOption('en');
      ok(await page.locator('#first-bee').isVisible(),path+' New bee arrival');
      ok(!await page.locator('#instrument').isVisible(),path+' instrument waits');
      ok(!await page.locator('#tbar').isVisible(),path+' navigation waits');
      const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
      ok(await overflow(),path+' no New bee overflow '+size.width);
      await page.screenshot({path:resolve(shots,path.replaceAll('/','-')+'-bee-'+size.width+'.png')});
      await page.locator('#first-bee .primary').first().click();
      await page.waitForFunction(()=>document.activeElement.id.startsWith('layer-')||document.activeElement.id==='instrument');
      ok(!await page.locator('#first-bee').isVisible(),path+' first action advances');
      ok(await overflow(),path+' next beat fits '+size.width);
      await page.locator('[data-room-overview]').click();
      ok(await page.locator('#first-bee').isVisible(),path+' can return');
      await page.locator('#breg-raver').click();
      ok(await page.locator('#first-raver').isVisible(),path+' Raver arrival');
      await page.locator('[data-room-pause]').click();
      const pause=await page.locator('body').getAttribute('data-motion-paused');
      ok(await overflow(),path+' Raver fits '+size.width);
      await page.screenshot({path:resolve(shots,path.replaceAll('/','-')+'-raver-'+size.width+'.png')});
      await page.locator('#first-raver .primary').first().click();
      ok(!await page.locator('#first-raver').isVisible(),path+' Raver action advances');
      const beat=await page.locator('body').evaluate(b=>Array.from(b.attributes).find(a=>/^data-.*-beat$/.test(a.name)).value);
      await page.locator('#breg-cypherpunk').click();
      ok(await page.locator('#instrument').isVisible(),path+' Cypherpunk has full instrument');
      await page.locator('#breg-raver').click();
      ok(await page.locator('body').getAttribute('data-motion-paused')===pause,path+' pause retained');
      ok(beat===await page.locator('body').evaluate(b=>Array.from(b.attributes).find(a=>/^data-.*-beat$/.test(a.name)).value),path+' stage retained');
      await page.locator('[data-room-overview]').click();
      if(size.width===390){
        for(const lang of ['en',...corpus._meta.langs]){
          await page.locator('#blangsel').selectOption(lang);await page.waitForFunction(l=>document.documentElement.lang===l,lang);
          ok(await overflow(),path+' Raver language fits '+lang);
          const untranslated=await page.locator('#first-raver [data-i18n]').evaluateAll((nodes,rows)=>nodes.filter(n=>getComputedStyle(n).display!=='none').filter(n=>{const k=n.dataset.i18n;const row=rows.strings[k];return !row||!row[document.documentElement.lang]?.trim();}).map(n=>n.dataset.i18n),corpus);
          ok(!untranslated.length,path+' Raver language cells '+lang+': '+untranslated.join(','));
          const feelKey=await page.locator('#first-raver .feel').getAttribute('data-i18n');
          ok((await page.locator('#first-raver .feel').innerText()).trim()===corpus.strings[feelKey][lang].trim(),path+' rendered Raver translation '+lang);
          await page.locator('#breg-bee').click();ok(await overflow(),path+' New bee language fits '+lang);
          const calmKey=await page.locator('#first-bee .calm').getAttribute('data-i18n');
          ok((await page.locator('#first-bee .calm').innerText()).trim()===corpus.strings[calmKey][lang].trim(),path+' rendered New bee translation '+lang);
          await page.locator('#breg-raver').click();
        }
      }
      ok(!errors.length,path+' no script errors: '+errors.join('; '));
      console.log('PASS',path,size.width);
    }
    // Changed model values must update every headline and survive presentation switches.
    await page.goto(base+'/surfaces/bearth.html');await page.locator('#breg-cypherpunk').click();
    await page.locator('#gday').fill('30');await page.locator('#gday').dispatchEvent('input');
    const changed=await page.locator('[data-land-value]').first().textContent();
    await page.locator('#breg-bee').click();ok(await page.locator('#first-bee [data-land-value]').textContent()===changed,'model headline retained');
    await page.locator('#blangsel').selectOption('ru');ok(await page.locator('#gday').inputValue()==='30','language preserves inputs');
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#breg-raver').click();
    ok(await page.locator('[data-room-pause]').isDisabled(),'OS reduced motion respected');
    ok(await page.locator('body').getAttribute('data-motion-paused')==='true','reduced motion holds');
    await context.close();
  }
  const denied=await browser.newContext({viewport:{width:390,height:844}});
  await denied.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await denied.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('storage denied');};Storage.prototype.getItem=()=>{throw Error('storage denied');};});
  const local=await denied.newPage();await local.goto(base+'/surfaces/bearth.html');
  await local.locator('#breg-raver').click();await local.locator('#blangsel').selectOption('ru');
  await local.waitForFunction(()=>document.documentElement.lang==='ru');
  ok(await local.locator('[data-room-pause]').innerText()===corpus.strings['ux.pause'].ru,'dynamic labels follow current language when preference storage is denied');
  await local.locator('[data-room-pause]').click();ok(await local.locator('[data-room-pause]').innerText()===corpus.strings['ux.resume'].ru,'paused state remains usable without storage');
  await denied.close();
  console.log(`PASS ${assertions} assertions. Screenshots: ${shots}`);
}finally{await browser.close();await new Promise(done=>server.close(done));}
