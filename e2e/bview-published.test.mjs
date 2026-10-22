// Real published-content decode; isolated loopback delivery, no public traffic.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const corpus=JSON.parse(await readFile(resolve(root,'tools/video-trial/corpus-2026-10-10.json')));
const address=corpus.files[0].address;
const html=await readFile(resolve(root,'surfaces/bview.html'),'utf8');
const bundle=html.match(new RegExp("'"+address+"':'([a-f0-9]{64})'"))[1];
const base='media/bview/'+bundle+'/';
const pkg=JSON.parse(await readFile(resolve(root,base+'package.json')));
const publication=JSON.parse(await readFile(resolve(root,base+'publication.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
let browser,origin,server;
before(async()=>{
 server=createServer(async(req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));
   const file=resolve(root,name);if(!file.startsWith(resolve(root)+sep))throw Error('outside root');
   const body=await readFile(file);
   const type=name.endsWith('.html')?'text/html':/\.m?js$/.test(name)?'text/javascript':name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':name.endsWith('.css')?'text/css':'video/mp4';
   res.writeHead(200,{'content-type':type,'content-length':body.length});res.end(body);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
});
after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
async function open({route,saved,query=''}={}){
 const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],hits=[],stray=[];
 await context.addInitScript(saved=>{localStorage.setItem('bregister','bee');if(saved)localStorage.setItem('bnr.bview.route',saved);},saved);
 await context.route('**/*',r=>{
  const url=r.request().url();
  if(url.includes('/vendor/ant-browser-sdk/'))return r.fulfill({contentType:'text/javascript',body:'export class AutonomiClient {static async connect(){throw Error("offline fixture");}}'});
  if(!url.startsWith(origin+'/')){stray.push(url);return r.abort();}
  if(url.includes('/media/bview/'))hits.push(url);
  return r.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/surfaces/bview.html'+query);
 if(route)await page.selectOption('#playback-route',route);
 return {context,page,errors,hits,stray};
}
test('published package is bound to the verified original and every immutable byte',{timeout:10000},async()=>{
 assert.equal(publication.source.address,address);assert.equal(publication.source.sha256,corpus.files[0].sha256);assert.equal(publication.source.bytes,corpus.files[0].size);
 assert.equal(publication.bundleId,bundle);assert.equal(pkg.bundleId,bundle);
 const master=await readFile(resolve(root,base+'master.m3u8'),'utf8');
 assert.equal(sha(master),publication.masterSha256);assert.equal(sha(master+JSON.stringify(pkg.files)),bundle);
 assert.equal(sha(await readFile(resolve(root,base+'package.json'))),publication.packageSha256);
 assert.equal(pkg.variants.length,4);
 for(const f of pkg.files){const b=await readFile(resolve(root,base+f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
});
test('original address defaults to adaptive copy, completes, and retains the saved original address',{timeout:50000},async()=>{
 const {context,page,errors,hits,stray}=await open();
 try{
  assert.equal(await page.inputValue('#playback-route'),'adaptive');
  await page.fill('#addr',address);await page.locator('#f button').click();
  await page.waitForFunction(()=>window.__bviewEngine().playStartMs>0,null,{timeout:15000});
  await page.evaluate(()=>document.getElementById('v').playbackRate=2);
  await page.waitForFunction(()=>window.__bviewEngine().video.ended,null,{timeout:35000});
  const e=await page.evaluate(()=>window.__bviewEngine());
  assert.equal(await page.inputValue('#addr'),address);assert.equal(e.route,'adaptive');assert.equal(e.source.kind,'https');
  assert.equal(e.adaptive.published,true);assert.equal(e.adaptive.bundleId,bundle);
  assert.equal(e.direct,null);assert.equal(e.sha,null);assert.equal(e.video.srcChanges,1);assert.equal(e.fail,false);
  assert.equal(e.stalls,0);assert.equal(e.adaptive.errors,0);assert.ok(e.playhead>=52);
  assert.ok(hits.some(x=>x.endsWith('master.m3u8')));assert.ok(hits.some(x=>x.endsWith('.m4s')));
  assert.equal(await page.locator('#saved-videos li').count(),1);
  assert.match(await page.locator('#playback-status').innerText(),/Published adaptive copy/);
  assert.deepEqual(errors,[]);assert.deepEqual(stray,[]);
 }finally{await context.close();}
});
test('explicit direct-only and saved transport choice never fetch a published copy',{timeout:15000},async()=>{
 const {context,page,hits,stray,errors}=await open({saved:'direct-only'});
 try{
  assert.equal(await page.inputValue('#playback-route'),'direct-only');
  await page.fill('#addr',address);await page.locator('#f button').click();
  await page.waitForFunction(()=>window.__bviewEngine().fail,null,{timeout:10000});
  const e=await page.evaluate(()=>window.__bviewEngine());
  assert.equal(e.route,'direct-only');assert.equal(e.adaptive,null);assert.equal(e.direct.only,true);
  assert.deepEqual(hits,[]);assert.deepEqual(stray,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('adaptive share link selects this viewing mode without overwriting a saved original route',{timeout:10000},async()=>{
 const {context,page,stray,hits}=await open({saved:'direct-only',query:'?route=adaptive#'+address});
 try{
  assert.equal(await page.inputValue('#playback-route'),'adaptive');
  assert.equal(await page.evaluate(()=>localStorage.getItem('bnr.bview.route')),'direct-only');
  await page.waitForFunction(()=>window.__bviewEngine().playhead>0.2,null,{timeout:7000});
  assert.equal((await page.evaluate(()=>window.__bviewEngine())).adaptive.published,true);
  assert.ok(hits.some(x=>x.endsWith('master.m3u8')));
  assert.deepEqual(stray,[]);
 }finally{await context.close();}
});
