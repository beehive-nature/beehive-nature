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
// Mock only the network reader. Exercise the vendored SDK MediaBridge and real
// service worker with real VP9 frames, range seeks, cancellation and relay fallback.
const mockSDK = `import { MediaBridge } from '/vendor/ant-browser-sdk/0.1.1/internal/media.js';
let client; export class AutonomiClient {
  static async connect() { window.connections=(window.connections||0)+1; if(window.hangDirect==='connect')return new Promise(()=>{}); return client={closed:false, close(){this.closed=true},
    // Mirrors the SDK: open the reader, then hand it to the real MediaBridge.
    async createMediaSource(address,options){const reader=await this.openFile(address,options);this.media??=new MediaBridge();try{return await this.media.attach(reader,options);}catch(error){reader.close();throw error;}},
    async openFile(address,{signal}) {
    if(window.rejectDirect) throw Error('network offline');
    const bytes=new Uint8Array(await (await fetch('/media.mp4',{signal})).arrayBuffer());
    let closed=false; return {address,name:'fixture.mp4',size:bytes.length,contentType:'video/mp4',close(){closed=true;window.closedReaders=(window.closedReaders||0)+1},async read(start,length,{signal}={}){if(window.hangDirect==='read')return new Promise((resolve,reject)=>{const abort=()=>{window.cancelledRead=true;reject(new DOMException('Cancelled','AbortError'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});if(closed)throw Error('closed reader');window.ranges=(window.ranges||[]);window.ranges.push([start,length]);return bytes.slice(start,start+length)}};
  }} }
}`;
async function open(reject = false, slow = false, hang = null, large = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(reject => { window.rejectDirect=reject; localStorage.setItem('blang','en'); localStorage.setItem('bregister','bee'); }, reject);
  await ctx.addInitScript(hang => { window.hangDirect=hang; }, hang);
  if(hang==='play')await ctx.addInitScript(()=>{
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const started=play.call(this);
      if(!this.currentSrc.includes('__autonomi_stream'))return started;
      started.then(()=>{this.playbackRate=0;this.dispatchEvent(new Event('waiting'));window.playStall=setInterval(()=>this.dispatchEvent(new Event('waiting')),1000);}).catch(()=>{});
      return new Promise(()=>{});
    };
  });
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
test('direct: real frames, a stable range URL, seek and connection reuse; records only playback', async () => {
  const {ctx,page,errors,relay}=await open();
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc',null,{timeout:20000});
    await page.evaluate(async()=>{const v=document.querySelector('#v');v.muted=true;await v.play();});
    await page.waitForFunction(()=>document.querySelector('#v').currentTime>0.4);
    const src=await page.locator('#v').getAttribute('src');
    assert.match(src,/__autonomi_stream/); assert.equal(relay.length,0);
    await page.evaluate(()=>{document.querySelector('#v').currentTime=7;});
    await page.waitForFunction(()=>document.querySelector('#v').currentTime>7.2 && !document.querySelector('#v').seeking);
    assert.equal(await page.locator('#v').getAttribute('src'),src);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bnr.bview.playlist.v1')).videos.length),1);
    await page.evaluate(()=>{document.body.dataset.reg='cypherpunk';document.dispatchEvent(new Event('bregister'));});
    await page.waitForFunction(()=>document.querySelector('#etMethod').textContent.includes('WebRTC'));
    const facts=await page.evaluate(()=>{const e=window.__bviewEngine();return {direct:e.direct,video:e.video,receipt:document.querySelector('#etReceipt').textContent,pipe:document.querySelector('#etPipe').textContent,wide:document.documentElement.scrollWidth,vw:innerWidth};});
    assert.ok(facts.direct.completed>0);assert.ok(facts.direct.requests>=facts.direct.completed);
    assert.ok(facts.direct.readBytes>=facts.direct.uniqueBytes);assert.equal(facts.direct.size,MEDIA.length);
    assert.ok(facts.direct.firstReadMs>=0);assert.ok(facts.direct.firstFrameMs>=0);assert.equal(facts.video.srcChanges,1);
    assert.ok(facts.video.width>0);assert.ok(facts.video.ahead>=0);assert.ok(facts.video.quality.total>0);
    assert.match(facts.receipt,/unique plaintext/);assert.match(facts.receipt,/not measured · plaintext bytes are not network bandwidth/);
    assert.match(facts.pipe,/native ranges/);assert.doesNotMatch(facts.pipe,/rest ÷ rate/);
    assert.ok(facts.wide<=facts.vw+1,'direct metrics must fit the mobile cypherpunk front');
    await page.fill('#addr','cd'.repeat(32)); await page.click('button[type=submit]');
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc');
    assert.equal(await page.evaluate(()=>window.connections),1);
    assert.equal(await page.evaluate(()=>window.__bviewEngine().direct.reused),true);
    assert.ok(await page.evaluate(()=>window.closedReaders>=1));
    assert.equal(relay.length,0); assert.deepEqual(errors,[]);
    console.log('# direct range playback: frames advanced, seek >7.2s, stable src, one connection across two addresses, old reader closed, no relay');
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
for(const hang of ['connect','read'])test('one startup budget reaches relay even when direct '+hang+' never finishes',async()=>{
  const at=Date.now(),{ctx,page,errors,relay}=await open(false,false,hang);
  try{
    await page.waitForFunction(()=>/s \/ 8 s/.test(document.querySelector('#playback-status').textContent));
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0&&window.__bviewEngine().path==='stream',null,{timeout:12000});
    assert.ok(Date.now()-at<14000,'setup and first-frame waits share one budget');
    assert.equal(relay.length,1);assert.ok(await page.evaluate(()=>window.__bviewEngine().direct.fallback));
    if(hang==='read')assert.equal(await page.evaluate(()=>window.cancelledRead),true);
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
test('a pending direct play promise cannot prevent the stall watcher from recovering',async()=>{
  const {ctx,page,errors,relay}=await open(false,false,'play');
  try{
    await page.waitForFunction(()=>window.__bviewEngine().path==='stream',null,{timeout:15000});
    assert.equal(relay.length,1);assert.match(await page.locator('#playback-status').textContent(),/Direct playback stalled/);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('a direct decoder error falls back once and retains the playhead',async()=>{
  const {ctx,page,errors,relay}=await open(false,true);
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc');
    await page.evaluate(async()=>{const v=document.querySelector('#v');v.muted=true;await v.play();v.currentTime=4;});
    await page.waitForFunction(()=>document.querySelector('#v').currentTime>=4 && !document.querySelector('#v').seeking);
    await page.evaluate(()=>{const v=document.querySelector('#v');v.addEventListener('playing',()=>{if(window.__bviewEngine().path==='stream'&&window.firstRelayPlayhead===undefined)window.firstRelayPlayhead=v.currentTime;});v.dispatchEvent(new Event('error'));});
    await page.waitForFunction(()=>window.firstRelayPlayhead!==undefined,null,{timeout:20000});
    assert.ok(await page.evaluate(()=>window.firstRelayPlayhead>=4),'the first resumed frame must retain the playhead, not restart and eventually reach it');
    const receipt=await page.evaluate(()=>window.__bviewEngine().direct);
    assert.equal(receipt.fallback,'Direct media error');assert.ok(receipt.playhead>=4);assert.ok(receipt.firstFrameMs>=0);assert.ok(receipt.uniqueBytes>0);
    assert.equal(relay.length,1); assert.match(await page.locator('#playback-status').textContent(),/Continuing through the relay/); assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});
test('a sustained direct stall falls back, but a viewer pause cancels the stall timer',async()=>{
  const {ctx,page,errors,relay}=await open();
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc');
    // Keep this finite fixture from ending while testing the 15-second policy.
    await page.evaluate(async()=>{const v=document.querySelector('#v');v.muted=true;v.playbackRate=0.1;await v.play();v.dispatchEvent(new Event('waiting'));v.pause();});
    await page.waitForTimeout(15500);
    assert.equal(relay.length,0,'the viewer pause must never trigger fallback');
    await page.evaluate(async()=>{const v=document.querySelector('#v');await v.play();v.dispatchEvent(new Event('stalled'));});
    await page.waitForTimeout(15500);
    assert.equal(relay.length,0,'buffered playback progress must cancel a network-stalled event');
    await page.evaluate(async()=>{const v=document.querySelector('#v');v.playbackRate=0;await v.play();v.dispatchEvent(new Event('waiting'));window.stallNoise=setInterval(()=>v.dispatchEvent(new Event('waiting')),3000);});
    await page.waitForFunction(()=>window.__bviewEngine().path==='stream',null,{timeout:20000});
    assert.equal(relay.length,1); assert.match(await page.locator('#playback-status').textContent(),/Direct playback stalled/); assert.deepEqual(errors,[]);
  } finally {await ctx.close();}
});
