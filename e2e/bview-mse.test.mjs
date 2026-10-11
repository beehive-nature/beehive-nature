import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const root = new URL('../',import.meta.url), media = await readFile(new URL('fixtures/bview/vp9-opus-10s-faststart.mp4',root));
let origin,browser;
const server = createServer(async(req,res)=>{
  try { const path = new URL(req.url,origin).pathname;
    const body = path==='/media.mp4'?media:await readFile(new URL('.'+path,root));
    res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch();});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
const sdk=`export class AutonomiClient { static async connect(){window.testConnects=(window.testConnects||0)+1;return {close(){},async openFile(){
window.testOpens=(window.testOpens||0)+1;
const bytes=new Uint8Array(await(await fetch('/media.mp4')).arrayBuffer());
return {size:bytes.length,close(){},async read(start,length){window.testReads=(window.testReads||0)+1;
if(start)await new Promise(r=>setTimeout(r,start<bytes.length/2?5000:7000));return bytes.slice(start,start+length);}};
}}}}`;
for(const dryPressure of [false,true])test(dryPressure?'a dry MSE player reads the next chunk even when estimated forward bytes exceed its target':'direct MSE starts from the first chunk, retains one source through gaps, and caches a genuine warm replay',async()=>{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/vendor/ant-browser-sdk/0.1.2/index.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
  try{
    await page.goto(origin+'/surfaces/bview.html');await page.selectOption('#playback-route','direct-only');await page.fill('#addr','ab'.repeat(32));
    await page.click('button[type=submit]');
    await page.waitForFunction(()=>window.__bviewEngine().playhead>0.1,null,{timeout:4500});
    const first=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(first.streaming?.mode,'mse');assert.ok(first.bytes<media.length);assert.ok(first.playStartMs<4000);assert.equal(first.video.srcChanges,1);
    if(dryPressure)await page.evaluate(()=>window.__bviewEngine().streaming.bufferTargetBytes=1);
    await page.waitForFunction(()=>window.__bviewEngine().video.ended&&!!window.__bviewEngine().sha,null,{timeout:25000});
    const end=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(end.video.srcChanges,1);assert.equal(end.streaming.fallback,undefined);assert.equal(end.streaming.errors,0);
    assert.ok(end.stallMs>0,'slow chunk arrival is counted as rebuffering rather than hidden');
    assert.ok(end.streaming.appendedBytes>0);assert.equal(end.direct.completed,3);
    await page.waitForFunction(async()=>!!await(await caches.open('ant-bview-v1')).match(new URL('../__bview_cache/'+'ab'.repeat(32),location.href).href));
    const reads=await page.evaluate(()=>window.testReads);
    await page.click('button[type=submit]');
    await page.waitForFunction(()=>window.__bviewEngine().path==='cache'&&window.__bviewEngine().playhead>0.1);
    assert.equal(await page.evaluate(()=>window.testReads),reads,'warm replay performs no file reads');
    await page.reload();
    await page.fill('#addr','ab'.repeat(32));await page.click('button[type=submit]');
    await page.waitForFunction(()=>window.__bviewEngine().path==='cache'&&window.__bviewEngine().playhead>0.1);
    assert.equal(await page.evaluate(()=>window.testConnects||0),0,'cached reload does not connect to Autonomi');
    assert.equal(await page.evaluate(()=>window.testOpens||0),0,'cached reload does not resolve the file');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({startupMs:first.playStartMs,stallMs:end.stallMs,srcChanges:end.video.srcChanges,fragments:end.streaming.fragments,warmReads:0}));
  }catch(error){console.log(await page.evaluate(()=>({engine:window.__bviewEngine(),log:document.querySelector('#log').textContent,mediaError:document.querySelector('#v').error?.message})));throw error;}finally{await context.close();}
});

for(const quota of [false,true])test(quota?'MSE quota pressure retries the same bytes once after freeing history':'MSE append failure recovers at the same playhead from retained bytes without another read',async()=>{
  const context=await browser.newContext(),page=await context.newPage();
  await context.route('**/vendor/ant-browser-sdk/0.1.2/index.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
  await context.addInitScript(quota=>{
    const append=SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer=function(bytes){if(window.failAppend){window.failAppend=false;throw new DOMException('fixture append failure',quota?'QuotaExceededError':'OperationError');}return append.call(this,bytes);};
  },quota);
  try{
    await page.goto(origin+'/surfaces/bview.html');await page.selectOption('#playback-route','direct-only');await page.fill('#addr','ac'.repeat(32));await page.click('button[type=submit]');
    await page.waitForFunction(()=>window.__bviewEngine().playhead>0.1);
    await page.evaluate(()=>window.failAppend=true);
    await page.waitForFunction(()=>window.__bviewEngine().video.ended&&!!window.__bviewEngine().sha,null,{timeout:25000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(e.streaming.fallback,quota?undefined:true);assert.equal(e.video.srcChanges,quota?1:2);assert.equal(e.direct.requests,3);assert.equal(e.direct.fallback,null);assert.equal(e.direct.stopped,null);
    assert.equal(e.streaming.quotaRecoveries,quota?1:0);
    assert.equal(await page.evaluate(()=>window.testReads),3);
    if(!quota)assert.ok(e.holds>0);assert.ok(e.playhead>9.5);
  }finally{await context.close();}
});

test('unsupported MSE codec keeps the file player and performs one set of reads',async()=>{
  const context=await browser.newContext(),page=await context.newPage();
  await context.route('**/vendor/ant-browser-sdk/0.1.2/index.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
  await context.addInitScript(()=>MediaSource.isTypeSupported=()=>false);
  try{
    await page.goto(origin+'/surfaces/bview.html');await page.selectOption('#playback-route','direct-only');await page.fill('#addr','ad'.repeat(32));await page.click('button[type=submit]');
    await page.waitForFunction(()=>window.__bviewEngine().video.ended&&!!window.__bviewEngine().sha,null,{timeout:30000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(e.streaming,null);assert.equal(e.direct.requests,3);assert.equal(e.direct.stopped,null);assert.equal(await page.evaluate(()=>window.testReads),3);
  }finally{await context.close();}
});
