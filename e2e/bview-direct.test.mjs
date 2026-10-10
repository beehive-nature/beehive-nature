import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MEDIA = await readFile(ROOT + 'fixtures/bview/vp9-opus-10s-faststart.mp4');
const ADDRESS = 'ab'.repeat(32);
const ORIGIN = 'http://127.0.0.1:8941';
let browser;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, ORIGIN).pathname;
  try {
    if (path === '/slow.mp4') {
      res.writeHead(200, {'content-type':'video/mp4','content-length':String(MEDIA.length),'access-control-allow-origin':'*'});
      for(let at=0;at<MEDIA.length&&!res.destroyed;at+=65536){res.write(MEDIA.subarray(at,at+65536));await new Promise(r=>setTimeout(r,85));}
      res.end();return;
    }
    const body = path === '/media.mp4' ? MEDIA : await readFile(path === '/surfaces/bview.html' && process.env.BVIEW_HTML ? process.env.BVIEW_HTML : ROOT + path);
    res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
before(async () => { await new Promise(r => server.listen(8941, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { await browser.close(); await new Promise(r => server.close(r)); });
// Mock only the network reader. Exercise the page's chunk lanes and progressive
// player with real VP9 frames, cancellation and relay fallback.
const mockSDK = `let client; export class AutonomiClient {
  static async connect() { window.connections=(window.connections||0)+1; if(window.hangDirect==='connect')return new Promise(()=>{}); return client={closed:false, close(){this.closed=true}, async openFile(address,{signal}) {
    if(window.rejectDirect) throw Error('network offline');
    const bytes=new Uint8Array(await (await fetch('/media.mp4',{signal})).arrayBuffer());
    const mode=window.hangDirect, big=mode?.startsWith('large-'), size=big?51*4190208+12345:bytes.length;
    const free=new Uint8Array(8);new DataView(free.buffer).setUint32(0,size-bytes.length);free.set([102,114,101,101],4);
    const attempts={}, active={};
    let closed=false; return {address,name:'fixture.mp4',size,contentType:'video/mp4',close(){closed=true;window.closedReaders=(window.closedReaders||0)+1},async read(start,length,{signal}={}){
      const attempt=attempts[start]=(attempts[start]||0)+1;
      window.attempts={...attempts}; active[start]=(active[start]||0)+1;
      window.peakSameRange=Math.max(window.peakSameRange||0,active[start]);
      window.activeReads=(window.activeReads||0)+1;window.peakReads=Math.max(window.peakReads||0,window.activeReads);
      try {
        if(mode==='read')return await new Promise((resolve,reject)=>{const abort=()=>{window.cancelledRead=true;reject(new DOMException('Cancelled','AbortError'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
        if(closed)throw Error('closed reader');
        if(mode==='ordered-stall'||mode==='ordered-ok'){const order=start===0?1:start<bytes.length/2?2:3;const delay=mode==='ordered-ok'?order*500:(order===1?1400:order===2?350:650);await new Promise(resolve=>setTimeout(resolve,delay));}
        if ((mode==='retry-once'&&start===0&&attempt===1) || (mode==='retry-exhaust'&&start===0) ||
          (mode==='large-retry'&&start===16*4190208&&attempt<3) || (mode==='large-budget'&&attempt===1)) throw Error('temporary read failure');
        if(mode==='retry-short'&&start===0&&attempt===1)return new Uint8Array(17);
        if(mode==='retry-cancel'&&start===0){
          setTimeout(()=>{window.cancelledInBackoff=window.__bviewEngine().direct.chunkReceipts[0].state==='backoff';dispatchEvent(new Event('pagehide'));},0);
          throw Error('temporary read failure');
        }
        if(mode==='retry-cancel'&&start!==0)await new Promise(resolve=>setTimeout(resolve,2000));
        window.ranges=(window.ranges||[]);window.ranges.push([start,length]);
        if(!big)return bytes.slice(start,start+length);
        const out=new Uint8Array(length);
        for(const [at,source] of [[0,bytes],[bytes.length,free]]){
          const lo=Math.max(start,at),hi=Math.min(start+length,at+source.length);
          if(hi>lo)out.set(source.subarray(lo-at,hi-at),lo-start);
        }
        return out;
      } finally {active[start]--;window.activeReads--;}
    }};
  }} }
}`;
async function open(reject = false, slow = false, hang = null, large = false, route = 'direct') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(reject => { window.rejectDirect=reject; localStorage.setItem('blang','en'); localStorage.setItem('bregister','bee'); }, reject);
  await ctx.addInitScript(hang => { window.hangDirect=hang; if(hang?.startsWith('ordered-')){const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===45000||ms===120000?800:ms,...args);} }, hang);
  const page=await ctx.newPage(), errors=[], relay=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await ctx.route('**/vendor/ant-browser-sdk/0.1.2/index.js', r=>r.fulfill({status:200,contentType:'text/javascript',body:mockSDK}));
  let relayBody=MEDIA;
  if(large){const free=Buffer.alloc(49<<20);free.writeUInt32BE(free.length,0);free.write('free',4);relayBody=Buffer.concat([MEDIA,free]);}
  await ctx.route('https://relay.skaists.dev/ant/v1/data/public/**', r=> { relay.push(r.request().url()); return slow ? r.fulfill({status:302,headers:{'access-control-allow-origin':ORIGIN,location:ORIGIN+'/slow.mp4'}}) : r.fulfill({status:200,headers:{'access-control-allow-origin':ORIGIN,'content-length':String(relayBody.length)},body:relayBody}); });
  await page.goto(ORIGIN+'/surfaces/bview.html');
  await page.selectOption('#playback-route',route); await page.fill('#addr',ADDRESS); await page.click('button[type=submit]');
  return {ctx,page,errors,relay};
}
test('direct: chunks read on their boundaries, real frames from a Blob, one connection, no relay', async () => {
  const {ctx,page,errors,relay}=await open();
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc',null,{timeout:20000});
    await page.waitForFunction(()=>!!window.__bviewEngine().sha,null,{timeout:20000});
    assert.match(await page.evaluate(()=>document.querySelector('#v').currentSrc),/^blob:/);
    assert.equal(relay.length,0);
    assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.length)),0,'direct playback registers no service worker');
    const third=Math.floor(MEDIA.length/3);
    const ranges=await page.evaluate(()=>window.ranges.slice().sort((x,y)=>x[0]-y[0]));
    assert.deepEqual(ranges,[[0,third],[third,third],[2*third,MEDIA.length-2*third]],'one read per chunk, on chunk boundaries');
    await page.evaluate(()=>{document.body.dataset.reg='cypherpunk';document.dispatchEvent(new Event('bregister'));});
    await page.waitForFunction(()=>document.querySelector('#etMethod').textContent.includes('WebRTC'));
    const facts=await page.evaluate(()=>{const e=window.__bviewEngine();return {e,receipt:document.querySelector('#etReceipt').textContent,pipe:document.querySelector('#etPipe').textContent,wide:document.documentElement.scrollWidth,vw:innerWidth};});
    assert.equal(facts.e.direct.chunks,3);assert.equal(facts.e.direct.completed,3);assert.equal(facts.e.direct.requests,3);assert.equal(facts.e.direct.failed,0);
    assert.equal(facts.e.direct.size,MEDIA.length);assert.equal(facts.e.direct.uniqueBytes,MEDIA.length);assert.ok(facts.e.bytes>0);
    assert.equal(facts.e.direct.startupBudgetMs,12000);assert.equal(facts.e.direct.startupCapMs,30000);
    assert.ok(facts.e.direct.firstReadMs>=0);assert.ok(facts.e.ttffMs>0);assert.equal(facts.e.direct.fallback,null);
    assert.match(facts.receipt,/chunk reads/);assert.match(facts.receipt,/unique plaintext/);assert.match(facts.receipt,/wire traffic(?=not measured · no WebRTC dial in this page)/);
    assert.match(facts.pipe,/chunk lanes/);assert.match(facts.pipe,/3 of 3 chunks/);
    assert.ok(facts.wide<=facts.vw+1,'direct metrics must fit the mobile cypherpunk front');
    await page.evaluate(()=>{window.ranges=[];});
    await page.fill('#addr','cd'.repeat(32)); await page.click('button[type=submit]');
    await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.path==='webrtc'&&e.direct&&e.direct.completed===3&&!!e.sha;},null,{timeout:20000});
    assert.equal(await page.evaluate(()=>window.connections),1);
    assert.equal(await page.evaluate(()=>window.__bviewEngine().direct.reused),true);
    assert.ok(await page.evaluate(()=>window.closedReaders>=2));
    assert.equal(relay.length,0); assert.deepEqual(errors,[]);
    const src=await page.evaluate(()=>({e:window.__bviewEngine(),receipt:document.querySelector('#etReceipt').textContent}));
    assert.equal(src.e.route,'direct');assert.equal(src.e.source.kind,'direct');assert.match(src.receipt,/source.*no relay bytes/);
    console.log('# direct chunk lanes: three boundary reads per file, Blob playback, no service worker, one connection across two addresses, readers closed, no relay');
  } finally {await ctx.close();}
});
test('direct setup rejection automatically uses the existing relay', async()=>{
  const {ctx,page,errors,relay}=await open(true);
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='stream',null,{timeout:20000});
    assert.equal(relay.length,1); assert.match(await page.locator('#playback-status').textContent(),/Using the relay/);
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(e.source.kind,'relay');assert.match(e.source.text,/direct gave up before the first frame \(network offline\)/);
    assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});
test('a direct connection that never opens reaches the relay after the quiet limit',async()=>{
  const at=Date.now(),{ctx,page,errors,relay}=await open(false,false,'connect');
  try{
    await page.waitForFunction(()=>/s \/ 12 s/.test(document.querySelector('#playback-status').textContent));
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0&&window.__bviewEngine().path==='stream',null,{timeout:18000});
    assert.ok(Date.now()-at<20000,'a silent direct start reaches the relay after one quiet limit');
    assert.equal(relay.length,1);assert.ok(await page.evaluate(()=>window.__bviewEngine().direct.fallback));
    assert.equal(await page.evaluate(()=>window.__bviewEngine().direct.status),'timeout');
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('an open file whose chunks never arrive reaches the relay and cancels the stuck reads',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'read');
  try{
    await page.waitForFunction(()=>window.__bviewEngine().path==='webrtc',null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0&&window.__bviewEngine().path==='stream',null,{timeout:60000});
    assert.equal(relay.length,1);assert.match(await page.evaluate(()=>window.__bviewEngine().direct.fallback),/stopped arriving/);
    assert.equal(await page.evaluate(()=>window.cancelledRead),true);
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('large-file relay startup records a first-frame receipt when early preview is skipped',async()=>{
  const {ctx,page,errors,relay}=await open(true,false,null,true);
  try{
    await page.waitForFunction(()=>window.__bviewEngine().ttffMs!=null&&document.querySelector('#v').videoWidth>0,null,{timeout:30000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(e.path,'stream');assert.ok(e.size>(48<<20));assert.ok(e.ttffMs>0);assert.equal(relay.length,1);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('direct only: a failed direct start stops, records why, and never asks the relay',async()=>{
  const {ctx,page,errors,relay}=await open(true,false,null,false,'direct-only');
  try{
    await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.direct&&e.direct.stopped&&e.fail;},null,{timeout:20000});
    await new Promise(r=>setTimeout(r,1500));
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(relay.length,0,'direct only never requests the relay');
    assert.equal(e.route,'direct-only');assert.equal(e.direct.only,true);assert.equal(e.direct.fallback,null);
    assert.match(e.direct.stopped,/network offline/);assert.match(e.source.text,/direct only · stopped: network offline.*relay not used/);
    assert.match(await page.locator('#playback-status').textContent(),/The relay was not used/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('bnr.bview.route')),'direct-only');
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('direct only: a clean run is labelled direct with no relay bytes',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,null,false,'direct-only');
  try{
    await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.path==='webrtc'&&!!e.sha;},null,{timeout:20000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(relay.length,0);assert.equal(e.source.kind,'direct');assert.equal(e.direct.stopped,null);
    assert.equal(e.direct.startupBudgetMs,30000);assert.equal(e.direct.startupCapMs,90000);
    assert.equal(e.direct.starveMs,120000);
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('relay only: every byte is labelled relay and no direct connection opens',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,null,false,'relay');
  try{
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0&&window.__bviewEngine().path==='stream',null,{timeout:20000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(relay.length,1);assert.equal(e.route,'relay');assert.equal(e.direct,null);
    assert.equal(e.source.text,'relay · every byte from relay.skaists.dev');
    assert.equal(await page.evaluate(()=>window.connections||0),0);
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});

// Only the 45/120-second network watchdog is accelerated to 800 ms. Other timers,
// decoded video frames, lane ordering, and the actual production page stay real.
test('later chunks cannot postpone recovery from a missing playable head',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'ordered-stall',false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().direct?.stopped,null,{timeout:5000});
    const d=await page.evaluate(()=>window.__bviewEngine().direct);
    assert.match(d.stopped,/waiting for chunk 0/);
    assert.equal(d.completed,2,'both later chunks arrived while the head was missing');
    assert.equal(d.emittedBytes,0);
    assert.ok(d.bufferedBytes>0);
    assert.equal(d.peakBufferedBytes,d.bufferedBytes);
    assert.ok(d.headWaitMs>=700 && d.headWaitMs<1300,'later arrivals did not restart the head deadline');
    assert.equal(d.waitingForChunk,null);
    assert.equal(relay.length,0,'direct-only still never uses the relay');
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>window.__bviewEngine().direct.completed),2,'late completion cannot mutate a stopped receipt');
    assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

test('head progress renews the next demand deadline and completes ordered delivery',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'ordered-ok',false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().sha,null,{timeout:10000});
    const e=await page.evaluate(()=>window.__bviewEngine());
    assert.equal(e.direct.stopped,null);
    assert.equal(e.direct.emittedBytes,MEDIA.length);
    assert.equal(e.direct.emittedChunks,3);
    assert.equal(e.direct.bufferedBytes,0);
    assert.ok(e.direct.headWaitMs>0);
    assert.ok(e.ttffMs>0);
    assert.equal(relay.length,0);
    assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

test('ordered starvation on the fallback route asks the relay exactly once',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'ordered-stall');
  try {
    await page.waitForFunction(()=>window.__bviewEngine().path==='stream'&&document.querySelector('#v').videoWidth>0,null,{timeout:10000});
    assert.match(await page.evaluate(()=>window.__bviewEngine().direct.fallback),/waiting for chunk 0/);
    assert.equal(relay.length,1);
    assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

for (const mode of ['retry-once','retry-short']) test(mode+': a settled failed head recovers without relay or duplicate bytes',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,mode,false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().sha,null,{timeout:12000});
    const e=await page.evaluate(()=>window.__bviewEngine()),d=e.direct;
    assert.equal(e.sha,createHash('sha256').update(MEDIA).digest('hex'));
    assert.equal(d.status,'complete');assert.equal(d.retries,1);assert.equal(d.recoveredChunks,1);
    assert.equal(d.requests,4);assert.equal(d.failed,1);assert.equal(d.uniqueBytes,MEDIA.length);
    assert.equal(d.readBytes,MEDIA.length+(mode==='retry-short'?17:0));
    assert.equal(d.chunkReceipts[0].attempts.length,2);assert.equal(d.chunkReceipts[0].state,'emitted');
    assert.equal(await page.evaluate(()=>window.peakSameRange),1);
    assert.equal(relay.length,0);assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

for (const route of ['direct-only','direct']) test('retry exhaustion is bounded on '+route,async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'retry-exhaust',false,route);
  try {
    await page.waitForFunction(()=>{const d=window.__bviewEngine().direct;return d?.stopped||d?.fallback;},null,{timeout:12000});
    const d=await page.evaluate(()=>window.__bviewEngine().direct);
    assert.equal(d.status,'failed');assert.equal(d.retries,2);assert.equal(d.failed,3);
    assert.equal(d.chunkReceipts[0].attempts.length,3);assert.equal(d.chunkReceipts[0].state,'failed');
    assert.match(d.stopped||d.fallback,/chunk 0 failed after 3 attempt/);
    if(route==='direct')await page.waitForFunction(()=>window.__bviewEngine().path==='stream');
    assert.equal(relay.length,route==='direct'?1:0);assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

test('cancelling during backoff launches no retry and late reads cannot change its receipt',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'retry-cancel',false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().direct?.stopped);
    await page.evaluate(()=>{window.stoppedReceipt=JSON.stringify(window.__bviewEngine().direct);});
    await page.waitForTimeout(2200);
    const d=await page.evaluate(()=>window.__bviewEngine().direct);
    assert.equal(await page.evaluate(()=>window.cancelledInBackoff),true);
    assert.equal(d.status,'cancelled');assert.equal(d.retries,0);
    assert.equal(d.chunkReceipts[0].attempts.length,1);assert.equal(d.completed,0);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__bviewEngine().direct)===window.stoppedReceipt),true);
    assert.equal(relay.length,0);assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});

test('52-chunk transfer recovers chunk 16 twice, preserves order and verifies every byte',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'large-retry',false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().sha,null,{timeout:60000});
    const e=await page.evaluate(()=>window.__bviewEngine()),d=e.direct;
    const free=Buffer.alloc(d.size-MEDIA.length);free.writeUInt32BE(free.length,0);free.write('free',4);
    assert.equal(e.sha,createHash('sha256').update(MEDIA).update(free).digest('hex'));
    assert.equal(d.chunks,52);assert.equal(d.completed,52);assert.equal(d.emittedChunks,52);
    assert.equal(d.requests,54);assert.equal(d.retries,2);assert.equal(d.recoveredChunks,1);
    assert.equal(d.uniqueBytes,d.size);assert.equal(d.emittedBytes,d.size);assert.equal(d.bufferedBytes,0);
    assert.equal(d.chunkReceipts[16].attempts.length,3);
    for(let i=0;i<52;i++){
      assert.equal(d.chunkReceipts[i].state,'emitted');
      if(i)assert.ok(d.chunkReceipts[i].emittedMs>=d.chunkReceipts[i-1].emittedMs);
    }
    assert.ok(d.peakBufferedBytes<=6*4190208);assert.ok(e.ttffMs>0);
    assert.ok(await page.evaluate(()=>window.peakReads<=3));assert.equal(await page.evaluate(()=>window.peakSameRange),1);
    assert.equal(relay.length,0);assert.deepEqual(errors,[]);
    console.log('# 52 chunks: 54 attempts, two settled failures, same-byte SHA-256, <=3 reads, no duplicate in-flight range');
  } finally {await ctx.close();}
});

test('a widespread failure cannot exceed the twelve-retry transfer budget',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'large-budget',false,'direct-only');
  try {
    await page.waitForFunction(()=>!!window.__bviewEngine().direct?.stopped,null,{timeout:20000});
    const d=await page.evaluate(()=>window.__bviewEngine().direct);
    assert.equal(d.status,'failed');assert.equal(d.retries,12);
    assert.equal(d.chunkReceipts.reduce((n,c)=>n+Math.max(0,c.attempts.length-1),0),12);
    assert.ok(d.chunkReceipts.every(c=>c.attempts.length<=3));
    assert.equal(await page.evaluate(()=>window.peakSameRange),1);
    assert.equal(relay.length,0);assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});
