// Opt-in actual-content acceptance, using a previously hash-verified local copy.
// node e2e/bview-file.mjs --media /path/original.mp4 --out /path/receipt.json
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const {values}=parseArgs({options:{media:{type:'string'},out:{type:'string'}}});
if(!values.media||!values.out)throw Error('Provide --media and --out');
const root=new URL('../',import.meta.url),media=await readFile(resolve(values.media));
const corpus=JSON.parse(await readFile(new URL('tools/video-trial/corpus-2026-10-10.json',root),'utf8'));
const sha=createHash('sha256').update(media).digest('hex');
assert.equal(sha,corpus.files[0].sha256,'acceptance uses the exact original video');
const server=createServer(async(req,res)=>{try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p.includes('..'))throw Error('invalid path');
  res.setHeader('content-type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream');
  res.end(p==='/media.mp4'?media:await readFile(new URL('.'+p,root)));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext(),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.name));
await context.route('**/vendor/ant-browser-sdk/0.1.2/index.js',r=>r.fulfill({contentType:'text/javascript',body:`export class AutonomiClient{static async connect(){window.connects=(window.connects||0)+1;return{close(){},async openFile(){const b=new Uint8Array(await(await fetch('/media.mp4')).arrayBuffer());return{size:b.length,close(){},async read(start,length){window.reads=(window.reads||0)+1;return b.slice(start,start+length)}}}}}}`}));
const take=()=>page.evaluate(()=>window.__bviewEngine());
try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/surfaces/bview.html');
  await page.selectOption('#playback-route','direct-only');await page.fill('#addr','ab'.repeat(32));await page.click('button[type=submit]');
  await page.waitForFunction(()=>window.__bviewEngine().playhead>.1,null,{timeout:20000});
  const start=await take();
  await page.evaluate(()=>document.querySelector('#v').pause());await page.waitForTimeout(500);
  const paused=await take();await page.waitForTimeout(1000);
  assert.equal((await take()).direct.emittedBytes,paused.direct.emittedBytes,'paused consumer stops fetching ahead');
  await page.evaluate(()=>document.querySelector('#v').play());
  await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.streaming?.fallback||(e.video.ended&&!!e.sha);},null,{timeout:120000});
  const end=await take();
  assert.equal(end.sha,sha);assert.equal(end.streaming?.fallback,undefined);assert.equal(end.video.srcChanges,1);assert.deepEqual(errors,[]);
  assert.ok(end.streaming.evictions>0);assert.equal(end.streaming.forwardBytes,0);
  const reads=await page.evaluate(()=>window.reads);
  await page.evaluate(()=>{const v=document.querySelector('#v');v.currentTime=1;v.play();});
  await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.streaming?.fallback&&e.video.srcChanges===2&&e.playhead>1.1&&!e.video.paused;},null,{timeout:15000});
  const seek=await take();assert.equal(await page.evaluate(()=>window.reads),reads);
  await page.waitForFunction(async()=>!!await(await caches.open('ant-bview-v1')).match(new URL('../__bview_cache/'+'ab'.repeat(32),location.href).href));
  await page.reload();await page.fill('#addr','ab'.repeat(32));await page.click('button[type=submit]');
  await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.path==='cache'&&e.playhead>.1&&!!e.sha;},null,{timeout:20000});
  const warm=await take();assert.equal(warm.sha,sha);assert.equal(await page.evaluate(()=>window.connects||0),0);assert.equal(await page.evaluate(()=>window.reads||0),0);
  const receipt={observedAt:new Date().toISOString(),browser:browser.version(),boundary:'exact original content over unthrottled local mock reads; includes a deliberate 1.5-second pause; not public-network throughput',start,end,seek,warm,warmConnections:0,warmReads:0,errors,'PUBLIC-CONSTANT':'public source integrity digest'};
  await writeFile(resolve(values.out),JSON.stringify(receipt)+'\n',{flag:'wx'});
  console.log(JSON.stringify({accepted:true,startupMs:start.playStartMs,stallMs:end.stallMs,srcChanges:end.video.srcChanges,peakForwardBytes:end.streaming.peakForwardBytes,backwardSeekRecovered:true,warmStartMs:warm.playStartMs,warmConnections:0,warmReads:0}));
}catch(e){const s=await take();console.log(JSON.stringify({streaming:s.streaming,video:s.video,playhead:s.playhead,received:!!s.sha,errors}));throw e;}
finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
