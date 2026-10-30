// Explicit opt-in public-network acceptance. Not included in the offline test suite.
// node e2e/bview-live.mjs --route direct --out /absolute/receipt.json [--candidate /absolute/bview.html] [--corpus /absolute/corpus.json] [--sdk 0.1.2|0.1.5]
import { chromium } from 'playwright';
import { readFile, writeFile, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPins, htmlWithSdk } from '../tools/video-trial/sdk-qualification.mjs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { route:{type:'string',default:'direct'},out:{type:'string'},candidate:{type:'string'},corpus:{type:'string'},'save-video':{type:'string'},warm:{type:'boolean',default:false},sdk:{type:'string'}} });
if (!values.out || !['direct','direct-only','relay'].includes(values.route)) throw Error('Provide --out and a valid --route');
if (values.sdk && !['0.1.2','0.1.5'].includes(values.sdk)) throw Error('Provide --sdk 0.1.2 or 0.1.5');
const sdkPins = values.sdk ? await loadPins() : null;
if (values.sdk && !sdkPins[values.sdk]) throw Error(`Unknown SDK arm ${values.sdk}`);
const root=new URL('../',import.meta.url), origin='https://skaists.dev/surfaces/bview.html';
const corpus=JSON.parse(await readFile(values.corpus ? resolve(values.corpus) : new URL('tools/video-trial/corpus-2026-10-09.json',root),'utf8'));
const fixture=corpus.files[0], output=resolve(values.out);
if (!fixture || !/^[0-9a-f]{64}$/i.test(fixture.address) || !/^[0-9a-f]{64}$/i.test(fixture.sha256) || !(fixture.size > 0)) throw Error('Corpus requires a public address, expected SHA256 and size');
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
let pageErrors=0,relayRequests=0,sdkRequests=0;
const assetReads=[],sdkReads=[];
page.on('response',response=>{
  const path=new URL(response.url()).pathname;
  if(path==='/tools/video-trial/direct-mse.mjs'||path.startsWith('/vendor/mp4box/'))assetReads.push((async()=>{
    try{const body=await response.body();return {path,status:response.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};}
    catch{return {path,status:response.status(),bytes:null,sha256:null};}
  })());
  if(path.startsWith('/vendor/ant-browser-sdk/'))sdkReads.push((async()=>{
    try{const body=await response.body();return {path,status:response.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};}
    catch{return {path,status:response.status(),bytes:null,sha256:null};}
  })());
});
page.on('pageerror',()=>pageErrors++);
page.on('request',r=>{if(r.url().startsWith('https://relay.skaists.dev/ant/'))relayRequests++;if(r.url().startsWith('https://skaists.dev/vendor/ant-browser-sdk/'))sdkRequests++;});
await context.addInitScript(()=>{localStorage.setItem('blang','en');localStorage.setItem('bregister','cypherpunk');});
if(values.candidate && !values.sdk){
  await context.route(origin,r=>r.fulfill({status:200,contentType:'text/html',path:resolve(values.candidate)}));
  await context.route('https://skaists.dev/vendor/mp4box/**',r=>r.fulfill({status:200,contentType:'text/javascript',path:resolve(new URL(r.request().url()).pathname.slice(1))}));
  await context.route('https://skaists.dev/tools/video-trial/direct-mse.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',path:resolve('tools/video-trial/direct-mse.mjs')}));
}
if(values.sdk){
  // Each comparison arm explicitly selects and serves its local pinned
  // SDK: any other version on the wire is refused, and every served
  // file is verified against the pin table before acceptance.
  await context.route('https://skaists.dev/vendor/ant-browser-sdk/**',async r=>{
    const pathname=new URL(r.request().url()).pathname;
    const match=pathname.match(/^\/vendor\/ant-browser-sdk\/([^/]+)\/(.+)$/);
    if(!match||match[1]!==values.sdk)throw Error(`refusing SDK ${pathname}: arm selects ${values.sdk}`);
    const body=await readFile(join(repoRoot,'vendor','ant-browser-sdk',values.sdk,match[2]));
    await r.fulfill({status:200,contentType:match[2].endsWith('.wasm')?'application/wasm':'text/javascript',body});
  });
  if(values.candidate){
    const candidateHtml=await readFile(resolve(values.candidate),'utf8');
    await context.route(origin,r=>r.fulfill({status:200,contentType:'text/html',body:htmlWithSdk(candidateHtml,values.sdk)}));
    await context.route('https://skaists.dev/vendor/mp4box/**',r=>r.fulfill({status:200,contentType:'text/javascript',path:resolve(new URL(r.request().url()).pathname.slice(1))}));
    await context.route('https://skaists.dev/tools/video-trial/direct-mse.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',path:resolve('tools/video-trial/direct-mse.mjs')}));
  }else{
    await context.route(origin,async r=>{
      const upstream=await r.fetch();
      await r.fulfill({status:upstream.status(),contentType:'text/html',body:htmlWithSdk(await upstream.text(),values.sdk)});
    });
  }
}
try {
  const response=await page.goto(origin);
  if(response.status()!==200)throw Error('Public page did not return HTTP 200');
  const htmlSha256=createHash('sha256').update(await response.body()).digest('hex');
  await page.addScriptTag({content:await readFile(new URL('tools/video-trial/capture.js',root),'utf8')});
  await page.selectOption('#playback-route',values.route);
  await page.fill('#addr',fixture.address);
  await page.evaluate(()=>bviewTrial.mark('play'));
  const started=Date.now();await page.click('button[type=submit]');
  let e,receivedAtMs=null,endedAtMs=null,lastProgress=0;
  while(Date.now()-started<600000) {
    await page.waitForTimeout(1000);
    e=await page.evaluate(()=>window.__bviewEngine());
    if(Date.now()-started-lastProgress>=15000){
      lastProgress=Date.now()-started;
      console.log(JSON.stringify({elapsedMs:lastProgress,source:e.source?.kind,received:!!e.sha,
        bytes:e.bytes,size:e.size,chunksCompleted:e.direct?.completed,chunksTotal:e.direct?.chunks,
        playhead:e.playhead,duration:e.video?.duration,paused:e.video?.paused,playStartMs:e.playStartMs,stalls:e.stalls,stallMs:e.stallMs,holds:e.holds,holdMs:e.holdMs,directStatus:e.direct?.status}));
    }
    if(e.sha && receivedAtMs===null)receivedAtMs=Date.now()-started;
    if(e.video?.ended && endedAtMs===null)endedAtMs=Date.now()-started;
    if(e.video?.ended && e.sha)break;
    if(e.direct?.stopped || (e.fail&&!e.video?.width))break;
  }
  const capture=await page.evaluate(()=>{bviewTrial.stop();return JSON.parse(bviewTrial.export());});
  const playMark=capture.marks.find(m=>m.label==='play');
  const firstPlaying=capture.rows.find(r=>!r.paused&&r.playhead>0);
  const playbackStartObservedMs=firstPlaying ? firstPlaying.atMs-(playMark?.atMs||0) : null;
  const integrityMatches=e.sha?e.sha===fixture.sha256:null;
  const transports=capture.rows.filter(r=>r.transport);
  const firstOpen=transports.find(r=>r.transport.opened>0);
  const lastTransport=transports.at(-1)?.transport;
  const transportSummary=lastTransport ? {...lastTransport,
    firstOpenObservedMs:firstOpen ? firstOpen.atMs-(playMark?.atMs||0) : null,
    peakSampledOpenChannels:Math.max(...transports.map(r=>r.transport.opened-r.transport.closed)),
    payloadToFileRatio:integrityMatches ? lastTransport.bytes/fixture.size : null} : null;
  const routeMatches=values.route==='direct-only' ? e.source?.kind==='direct'&&relayRequests===0
    : values.route==='relay' ? e.source?.kind==='relay' : ['direct','mixed','relay'].includes(e.source?.kind);
  let sdkDigests=[],sdkVerified=!values.sdk;
  if(values.sdk){
    // Refuse wrong version, mismatched bytes, failed responses and
    // stale assets: every served SDK file must match the pin table, and
    // the entry point must have been served fresh in this run.
    const served=await Promise.all(sdkReads);
    const verified=[];
    for(const r of served){
      if(r.bytes==null)throw Error(`SDK asset unreadable: ${r.path} HTTP ${r.status}`);
      const rel=r.path.replace('/vendor/ant-browser-sdk/'+values.sdk+'/','');
      const pin=sdkPins[values.sdk][rel];
      if(!pin)throw Error(`unexpected SDK asset ${r.path}`);
      if(r.status!==200||r.bytes!==pin.bytes||r.sha256!==pin.sha256)throw Error(`SDK mismatch: ${r.path} HTTP ${r.status} ${r.bytes} bytes sha256 ${r.sha256}`);
      verified.push({rel,bytes:r.bytes,sha256:r.sha256});
    }
    sdkDigests=verified;
    sdkVerified=verified.some(v=>v.rel==='index.js')&&verified.some(v=>v.rel==='wasm/ant_core_bg.wasm');
    if(!sdkVerified)throw Error(`SDK ${values.sdk} entry module or expected WASM was not served in this run`);
  }
  const result={observedAt:new Date().toISOString(),origin,htmlSha256,browser:browser.version(),
    mode:values.candidate?'candidate HTML on public origin':'deployed public HTML',route:values.route,sdk:values.sdk||null,sdkVerified,sdkDigests,
    fixture:{source:corpus.source,name:fixture.name,size:fixture.size},
    boundary:'fresh Chrome context; address entry preopens the reader; engine timing and sampled transfer/playback endpoints are distinct; no physical-mobile claim',
    elapsedMs:Date.now()-started,receivedAtMs,endedAtMs,playbackStartObservedMs,integrityMatches,
    ttffMs:e.ttffMs,ttfbMs:e.ttfbMs,source:e.source?.kind,actualSize:e.size,
    duration:e.video?.duration,playhead:e.playhead,ended:e.video?.ended,video:e.video,streaming:capture.rows.at(-1)?.streaming,
    stalls:e.stalls,stallMs:e.stallMs,playStartMs:e.playStartMs,holds:e.holds,holdMs:e.holdMs,relayRequests,pageErrors,transportSummary,routeMatches,
    accepted:integrityMatches===true&&routeMatches&&e.video?.ended===true&&e.video?.duration>0&&e.playhead>=e.video.duration-0.5&&pageErrors===0&&sdkVerified,
    assetDigests:await Promise.all(assetReads),capture,'PUBLIC-CONSTANT':'htmlSha256 and assetDigests are public source digests; no addresses or private peer IDs in capture'};
  if(values.warm && integrityMatches){
    await page.waitForFunction(async address=>!!await(await caches.open('ant-bview-v1')).match(new URL('../__bview_cache/'+address,location.href).href),fixture.address,{timeout:60000});
    const beforeSdk=sdkRequests,beforeRelay=relayRequests;
    await page.reload();await page.fill('#addr',fixture.address);await page.click('button[type=submit]');
    await page.waitForFunction(()=>{const e=window.__bviewEngine();return e.path==='cache'&&e.playhead>0.2&&!!e.sha;},null,{timeout:30000});
    const warm=await page.evaluate(()=>({e:window.__bviewEngine(),transport:window.__antTransport?.snapshot()}));
    result.warm={boundary:'reload in the same browser context after complete cold download',source:warm.e.source.kind,playStartMs:warm.e.playStartMs,ttffMs:warm.e.ttffMs,integrityMatches:warm.e.sha===fixture.sha256,sdkRequests:sdkRequests-beforeSdk,relayRequests:relayRequests-beforeRelay,dials:warm.transport?.dials||0,srcChanges:warm.e.video.srcChanges};
    result.accepted &&= result.warm.integrityMatches && result.warm.sdkRequests===0 && result.warm.relayRequests===0 && result.warm.dials===0;
  }
  await writeFile(output,JSON.stringify(result)+'\n',{flag:'wx'});
  if(values['save-video'] && integrityMatches){
    await page.waitForFunction(async address=>!!(await (await caches.open('ant-bview-v1')).match(new URL('../__bview_cache/'+address,location.href).href)),fixture.address,{timeout:60000});
    await page.evaluate(async address=>{const r=await (await caches.open('ant-bview-v1')).match(new URL('../__bview_cache/'+address,location.href).href);window.__savedVideo=await r.blob();},fixture.address);
    const target=await open(resolve(values['save-video']),'wx'),digest=createHash('sha256');
    try {
      for(let at=0;at<fixture.size;at+=1048576){
        const encoded=await page.evaluate(async at=>{const b=await window.__savedVideo.slice(at,at+1048576).arrayBuffer();let s='';for(const x of new Uint8Array(b))s+=String.fromCharCode(x);return btoa(s);},at);
        const bytes=Buffer.from(encoded,'base64');digest.update(bytes);await target.write(bytes);
      }
    } finally {await target.close();}
    if(digest.digest('hex')!==fixture.sha256)throw Error('Saved source digest mismatch');
    console.log('Saved independently verified source for repeatable local playback measurements');
  }
  console.log(JSON.stringify({output,accepted:result.accepted,receivedAtMs,endedAtMs,integrityMatches,ttffMs:e.ttffMs,stalls:e.stalls,stallMs:e.stallMs,relayRequests,pageErrors}));
  if(!result.accepted)process.exitCode=1;
} finally {await context.close();await browser.close();}
