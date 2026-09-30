// Local browser acceptance; synthetic clipboard, no relay posts or email sends.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'e2e/.local-agent-profile/mail');
await mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.css':'text/css','.md':'text/plain'};
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
    if(!path.startsWith(resolve(root)+sep))throw Error('outside root');
    const body=await readFile(path);
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(body);
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;
const receipts=[];
try{
  browser=await chromium.launch({headless:true});
  for(const width of [390,1280])for(const reg of ['bee','raver','cypherpunk']){
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(reg=>{
      localStorage.setItem('breg',reg);
      window.contactCopies=[];
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.contactCopies.push(value);}},configurable:true});
    },reg);
    // External estate widgets are outside this local contact test, not assumed healthy.
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await page.goto(base+'/surfaces/profile.html#agent-contacts');
    await page.locator('#breg-'+reg).click();
    const panel=page.locator('#agent-contacts');
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.isVisible(),true);
    for(const seat of ['astra','zcode','bfuzz']){
      const card=panel.locator('[data-contact="'+seat+'"]');
      await card.locator('summary').click();
      await card.locator('button').click();
      assert.equal(await card.locator('[role="status"]').innerText(),'Public key copied.');
    }
    const keys=await panel.locator('code').allTextContents();
    assert.deepEqual(await page.evaluate(()=>window.contactCopies),keys);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}},configurable:true}));
    await panel.locator('[data-contact="astra"] button').click();
    assert.match(await panel.locator('[data-contact="astra"] [role="status"]').innerText(),/Copy unavailable/);
    const button=panel.locator('[data-contact="astra"] button');
    await button.focus();await page.keyboard.press('Enter');
    assert.equal(await button.evaluate(e=>e===document.activeElement),true);
    assert.notEqual(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    const copySize=await button.boundingBox();assert.ok(copySize.height>=44);
    const overflow=await panel.evaluate(e=>[...e.querySelectorAll('*')].filter(n=>{
      const r=n.getBoundingClientRect();return r.width && (r.right>innerWidth+1 || r.left< -1);
    }).map(n=>n.tagName));
    assert.deepEqual(overflow,[],'no contact content may rely on page clipping');
    await panel.locator('.agent-mail-evidence summary').click();
    assert.equal(await panel.locator('a[href^="mailto:"]').count(),6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#blangsel').selectOption('ar');
    await page.waitForFunction(()=>document.documentElement.dir==='rtl');
    assert.equal(await panel.locator('code').first().getAttribute('dir'),'ltr');
    assert.equal(await panel.evaluate(e=>[...e.querySelectorAll('*')].every(n=>{
      const r=n.getBoundingClientRect();return !r.width || (r.right<=innerWidth+1 && r.left>=-1);
    })),true,'expanded inbox list and keys fit in RTL');
    await page.locator('#blangsel').selectOption('lv');
    await page.waitForFunction(()=>localStorage.getItem('blang')==='lv');
    assert.match(await panel.innerText(),/English remains visible where translation is pending/);
    assert.equal(await panel.locator('.agent-contact').count(),3,'language swaps must preserve cards');
    await page.locator('#blangsel').selectOption('en');
    if(width===390){
      await panel.locator('details[open] summary').evaluateAll(nodes=>nodes.forEach(n=>n.parentElement.open=false));
      await panel.screenshot({path:resolve(output,reg+'-390.png')});
    }
    await page.goto(base+'/surfaces/blight/profile.html');
    await page.locator('a[href="../profile.html#agent-contacts"]').click();
    await page.waitForURL('**/profile.html#agent-contacts');
    assert.equal(await page.locator('#agent-contacts').isVisible(),true);
    await page.waitForFunction(()=>{const top=document.getElementById('agent-contacts').getBoundingClientRect().top;return top>=0&&top<250;});
    assert.deepEqual(errors,[]);
    receipts.push({width,reg,copyExact:true,denialVisible:true,keyboard:true,holderLink:true,overflow,errors,externalRequests:'blocked locally, not a live-health result'});
    await context.close();
  }
  await writeFile(resolve(output,'journeys.json'),JSON.stringify(receipts,null,2)+'\n');
  console.log(JSON.stringify({passed:receipts.length,output,receipts},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
