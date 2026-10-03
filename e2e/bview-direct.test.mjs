import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
    const body = path === '/media.mp4' ? MEDIA : await readFile(ROOT + path);
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
    let closed=false; return {address,name:'fixture.mp4',size:bytes.length,contentType:'video/mp4',close(){closed=true;window.closedReaders=(window.closedReaders||0)+1},async read(start,length,{signal}={}){if(window.hangDirect==='read')return new Promise((resolve,reject)=>{const abort=()=>{window.cancelledRead=true;reject(new DOMException('Cancelled','AbortError'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});if(closed)throw Error('closed reader');window.ranges=(window.ranges||[]);window.ranges.push([start,length]);return bytes.slice(start,start+length)}};
  }} }
}`;
async function open(reject = false, slow = false, hang = null, large = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(reject => { window.rejectDirect=reject; localStorage.setItem('blang','en'); localStorage.setItem('bregister','bee'); }, reject);
  await ctx.addInitScript(hang => { window.hangDirect=hang; }, hang);
  const page=await ctx.newPage(), errors=[], relay=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await ctx.route('**/vendor/ant-browser-sdk/0.1.1/index.js', r=>r.fulfill({status:200,contentType:'text/javascript',body:mockSDK}));
  let relayBody=MEDIA;
  if(large){const free=Buffer.alloc(49<<20);free.writeUInt32BE(free.length,0);free.write('free',4);relayBody=Buffer.concat([MEDIA,free]);}
  await ctx.route('https://relay.skaists.dev/ant/v1/data/public/**', r=> { relay.push(r.request().url()); return slow ? r.fulfill({status:302,headers:{'access-control-allow-origin':ORIGIN,location:ORIGIN+'/slow.mp4'}}) : r.fulfill({status:200,headers:{'access-control-allow-origin':ORIGIN,'content-length':String(relayBody.length)},body:relayBody}); });
  await page.goto(ORIGIN+'/surfaces/bview.html');
  await page.selectOption('#playback-route','direct'); await page.fill('#addr',ADDRESS); await page.click('button[type=submit]');
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
    assert.ok(facts.e.direct.firstReadMs>=0);assert.ok(facts.e.ttffMs>0);assert.equal(facts.e.direct.fallback,null);
    assert.match(facts.receipt,/chunk reads/);assert.match(facts.receipt,/unique plaintext/);assert.match(facts.receipt,/not measured · plaintext bytes are not network bandwidth/);
    assert.match(facts.pipe,/chunk lanes/);assert.match(facts.pipe,/3 of 3 chunks/);
    assert.ok(facts.wide<=facts.vw+1,'direct metrics must fit the mobile cypherpunk front');
    await page.evaluate(()=>{window.ranges=[];});
    await page.fill('#addr','cd'.repeat(32)); await page.click('button[type=submit]');
    await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.path==='webrtc'&&e.direct&&e.direct.completed===3&&!!e.sha;},null,{timeout:20000});
    assert.equal(await page.evaluate(()=>window.connections),1);
    assert.equal(await page.evaluate(()=>window.__bviewEngine().direct.reused),true);
    assert.ok(await page.evaluate(()=>window.closedReaders>=2));
    assert.equal(relay.length,0); assert.deepEqual(errors,[]);
    console.log('# direct chunk lanes: three boundary reads per file, Blob playback, no service worker, one connection across two addresses, readers closed, no relay');
  } finally {await ctx.close();}
});
test('direct setup rejection automatically uses the existing relay', async()=>{
  const {ctx,page,errors,relay}=await open(true);
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='stream',null,{timeout:20000});
    assert.equal(relay.length,1); assert.match(await page.locator('#playback-status').textContent(),/Using the relay/);
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
