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
    const body = path === '/media.mp4' ? MEDIA : await readFile(ROOT + path);
    res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
before(async () => { await new Promise(r => server.listen(8941, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { await browser.close(); await new Promise(r => server.close(r)); });
// Mock only the network reader. Exercise the vendored SDK MediaBridge and real
// service worker with real VP9 frames, range seeks, cancellation and relay fallback.
const mockSDK = `let client; export class AutonomiClient {
  static async connect() { window.connections=(window.connections||0)+1; return client={closed:false, close(){this.closed=true}, async openFile(address,{signal}) {
    if(window.rejectDirect) throw Error('network offline');
    const bytes=new Uint8Array(await (await fetch('/media.mp4',{signal})).arrayBuffer());
    let closed=false; return {address,name:'fixture.mp4',size:bytes.length,contentType:'video/mp4',close(){closed=true;window.closedReaders=(window.closedReaders||0)+1},async read(start,length){if(closed)throw Error('closed reader');window.ranges=(window.ranges||[]);window.ranges.push([start,length]);return bytes.slice(start,start+length)}};
  }} }
}`;
async function open(reject = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(reject => { window.rejectDirect=reject; localStorage.setItem('blang','en'); localStorage.setItem('bregister','bee'); }, reject);
  const page=await ctx.newPage(), errors=[], relay=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await ctx.route('**/vendor/ant-browser-sdk/0.1.0/index.js', r=>r.fulfill({status:200,contentType:'text/javascript',body:mockSDK}));
  await ctx.route('https://relay.skaists.dev/ant/v1/data/public/**', r=> { relay.push(r.request().url()); return r.fulfill({status:200,headers:{'access-control-allow-origin':ORIGIN,'content-length':String(MEDIA.length)},body:MEDIA}); });
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
    await page.fill('#addr','cd'.repeat(32)); await page.click('button[type=submit]');
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc');
    assert.equal(await page.evaluate(()=>window.connections),1);
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
test('a direct decoder error falls back once and retains the playhead',async()=>{
  const {ctx,page,errors,relay}=await open();
  try {
    await page.waitForFunction(()=>document.querySelector('#v').videoWidth>0 && window.__bviewEngine().path==='webrtc');
    await page.evaluate(async()=>{const v=document.querySelector('#v');v.muted=true;await v.play();v.currentTime=4;});
    await page.waitForFunction(()=>document.querySelector('#v').currentTime>=4 && !document.querySelector('#v').seeking);
    await page.evaluate(()=>document.querySelector('#v').dispatchEvent(new Event('error')));
    await page.waitForFunction(()=>window.__bviewEngine().path==='stream' && document.querySelector('#v').currentTime>=4,null,{timeout:20000});
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
