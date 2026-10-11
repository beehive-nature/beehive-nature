// Opt-in: one real public viewer, complete original-content adaptive playback.
// --profile desktop|phone [--kbps 700] --out NEW_RECEIPT.json
import {chromium,devices} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
const {values}=parseArgs({options:{out:{type:'string'},profile:{type:'string',default:'desktop'},kbps:{type:'string'}}});
if(!values.out||!['desktop','phone'].includes(values.profile))throw Error('--out and desktop/phone profile required');
const kbps=values.kbps===undefined?null:Number(values.kbps);
if(kbps!==null&&(!Number.isFinite(kbps)||kbps<=0))throw Error('--kbps must be positive');
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const html=await readFile(new URL('surfaces/bview.html',root));
const source=JSON.parse(await readFile(new URL('tools/video-trial/corpus-2026-10-10.json',root))).files[0];
const bundle=html.toString().match(new RegExp("'"+source.address+"':'([a-f0-9]{64})'"))[1];
const path='media/bview/'+bundle+'/',base='https://skaists.dev/'+path;
const pkg=JSON.parse(await readFile(new URL(path+'package.json',root)));
const publication=JSON.parse(await readFile(new URL(path+'publication.json',root)));
if(publication.source.sha256!==source.sha256||publication.source.address!==source.address)throw Error('Source binding mismatch');
const expected=new Map(pkg.files.map(f=>[f.path,f.sha256]));
for(const name of ['master.m3u8','package.json','publication.json'])expected.set(name,sha(await readFile(new URL(path+name,root))));
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext(values.profile==='phone'?{...devices['Pixel 7']}:{viewport:{width:1280,height:900}});
const page=await context.newPage(),assets=[],checks=[],errors=[],samples=[],failedRequests=[];
let sdkRequests=0,relayRequests=0,webRtcDials=0;
await context.addInitScript(()=>{localStorage.setItem('bregister','bee');localStorage.setItem('blang','en');localStorage.setItem('bnr.bview.route','direct-only');});
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{const u=r.url();if(u.includes('/vendor/ant-browser-sdk/'))sdkRequests++;if(u.startsWith('https://relay.skaists.dev/ant/'))relayRequests++;});
page.on('requestfailed',r=>{if(r.url().startsWith(base))failedRequests.push({name:r.url().slice(base.length),failure:r.failure()?.errorText});});
page.on('response',response=>{
 if(!response.url().startsWith(base))return;
 const name=response.url().slice(base.length);
 checks.push(response.body().then(body=>assets.push({name,status:response.status(),bytes:body.length,sha256:sha(body),matches:sha(body)===expected.get(name),cacheControl:response.headers()['cache-control']||null,cache:response.headers()['x-cache']||null,age:response.headers().age||null})).catch(()=>assets.push({name,status:response.status(),matches:false})));
});
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(kbps!==null)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:kbps*1000/8,uploadThroughput:kbps*1000/8,connectionType:'cellular3g'});
 const response=await page.goto('https://skaists.dev/surfaces/bview.html?route=adaptive',{waitUntil:'domcontentloaded'});
 const htmlSha256=sha(await response.body()),htmlMatches=htmlSha256===sha(html);
 if(!htmlMatches)throw Error('Hosted player differs from this tested checkout');
 await page.waitForFunction(()=>typeof window.__bviewEngine==='function');
 await page.fill('#addr',source.address);
 const started=Date.now();await page.locator('#f button').click();
 while(Date.now()-started<120000){
  await page.waitForTimeout(500);
  if(await page.locator('#tap').isVisible())await page.locator('#tap').click();
  const e=await page.evaluate(()=>window.__bviewEngine());
  samples.push({elapsedMs:Date.now()-started,playhead:e.playhead,playStartMs:e.playStartMs,stallMs:e.stallMs,stalls:e.stalls,bytes:e.bytes,ahead:e.video.ahead,level:e.adaptive?.level??null,bandwidth:e.adaptive?.bandwidth??null,paused:e.video.paused,ended:e.video.ended});
  if(e.video.ended||e.fail)break;
 }
 await Promise.all(checks);
 const e=await page.evaluate(()=>window.__bviewEngine());
 webRtcDials=await page.evaluate(()=>window.__antTransport?.snapshot()?.dials||0);
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 const droppedFraction=e.video.quality?.total?e.video.quality.dropped/e.video.quality.total:null;
 const integrity=assets.length>=16&&assets.every(a=>a.status===200&&a.matches)&&assets.some(a=>a.name==='master.m3u8');
 const complete=e.video.ended&&e.playhead>=52&&!e.fail;
 const sourceMatches=e.source?.kind==='https'&&e.route==='adaptive'&&e.adaptive?.published&&e.adaptive.bundleId===bundle&&e.sha===null&&e.direct===null;
 const budgets={startupMs:kbps!==null?10000:3000,stallMs:0,maxDroppedFraction:0.01};
 const smooth=complete&&e.playStartMs>0&&e.playStartMs<=budgets.startupMs&&e.stalls===0&&e.stallMs===0&&droppedFraction!==null&&droppedFraction<=budgets.maxDroppedFraction;
 const accepted=htmlMatches&&integrity&&sourceMatches&&smooth&&e.video.srcChanges===1&&e.adaptive.errors===0&&errors.length===0&&failedRequests.length===0&&sdkRequests===0&&relayRequests===0&&webRtcDials===0&&layout.width===layout.scrollWidth;
 const result={observedAt:new Date().toISOString(),browser:browser.version(),profile:values.profile,kbps,latencyMs:kbps!==null?80:null,
  boundary:'one public Chrome viewer, fresh context, HTTP browser cache disabled; phone profile is Pixel 7 emulation; edge caches may be warm; not a physical phone or audience-capacity test',
  htmlSha256,htmlMatches,source,publication,bundleId:bundle,accepted,integrity,complete,sourceMatches,smooth,budgets,layout,
  startupMs:e.playStartMs,previewMs:e.ttffMs,firstMediaByteMs:e.ttfbMs,endedObservedMs:Date.now()-started,stalls:e.stalls,stallMs:e.stallMs,
  droppedFraction,mediaBytes:e.adaptive.mediaBytes,assetBodyBytes:assets.reduce((n,a)=>n+(a.bytes||0),0),payloadReduction:1-e.adaptive.mediaBytes/source.size,video:e.video,adaptive:e.adaptive,
  sdkRequests,relayRequests,webRtcDials,errors,failedRequests,assets,samples,'PUBLIC-CONSTANT':'public original and immutable rendition hashes'};
 await writeFile(resolve(values.out),JSON.stringify(result)+'\n',{flag:'wx'});
 console.log(JSON.stringify({accepted,profile:values.profile,kbps,startupMs:result.startupMs,stallMs:result.stallMs,mediaBytes:result.mediaBytes,droppedFraction,integrity,errors,failedRequests}));
 if(!accepted)process.exitCode=1;
}finally{await context.close();await browser.close();}
