// Explicit opt-in public-network acceptance. Not included in the offline test suite.
// node e2e/bview-live.mjs --route direct --out /absolute/receipt.json [--candidate /absolute/bview.html]
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { route:{type:'string',default:'direct'},out:{type:'string'},candidate:{type:'string'} } });
if (!values.out || !['direct','direct-only','relay'].includes(values.route)) throw Error('Provide --out and a valid --route');
const root=new URL('../',import.meta.url), origin='https://skaists.dev/surfaces/bview.html';
const corpus=JSON.parse(await readFile(new URL('tools/video-trial/corpus-2026-10-09.json',root),'utf8'));
const fixture=corpus.files[0], output=resolve(values.out);
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
let pageErrors=0,relayRequests=0;
page.on('pageerror',()=>pageErrors++);
page.on('request',r=>{if(r.url().startsWith('https://relay.skaists.dev/ant/'))relayRequests++;});
await context.addInitScript(()=>{localStorage.setItem('blang','en');localStorage.setItem('bregister','cypherpunk');});
if(values.candidate)await context.route(origin,r=>r.fulfill({status:200,contentType:'text/html',path:resolve(values.candidate)}));
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
        playhead:e.playhead,duration:e.video?.duration,paused:e.video?.paused,directStatus:e.direct?.status}));
    }
    if(e.sha && receivedAtMs===null)receivedAtMs=Date.now()-started;
    if(e.video?.ended){endedAtMs=Date.now()-started;break;}
    if(e.direct?.stopped || (e.fail&&!e.video?.width))break;
  }
  const capture=await page.evaluate(()=>{bviewTrial.stop();return JSON.parse(bviewTrial.export());});
  const integrityMatches=e.sha?e.sha===fixture.sha256:null;
  const result={observedAt:new Date().toISOString(),origin,htmlSha256,browser:browser.version(),
    mode:values.candidate?'candidate HTML on public origin':'deployed public HTML',route:values.route,
    fixture:{source:corpus.source,name:fixture.name,size:fixture.size},
    boundary:'fresh Chrome context; address entry preopens the reader; engine timing and sampled transfer/playback endpoints are distinct; no physical-mobile claim',
    elapsedMs:Date.now()-started,receivedAtMs,endedAtMs,integrityMatches,
    ttffMs:e.ttffMs,ttfbMs:e.ttfbMs,source:e.source?.kind,actualSize:e.size,
    duration:e.video?.duration,playhead:e.playhead,ended:e.video?.ended,
    stalls:e.stalls,stallMs:e.stallMs,relayRequests,pageErrors,
    accepted:integrityMatches===true&&e.video?.ended===true&&e.video?.duration>0&&e.playhead>=e.video.duration-0.5&&pageErrors===0,
    capture,'PUBLIC-CONSTANT':'htmlSha256 is a public source digest; no addresses or private peer IDs in capture'};
  await writeFile(output,JSON.stringify(result)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,accepted:result.accepted,receivedAtMs,endedAtMs,integrityMatches,ttffMs:e.ttffMs,stalls:e.stalls,stallMs:e.stallMs,relayRequests,pageErrors}));
  if(!result.accepted)process.exitCode=1;
} finally {await context.close();await browser.close();}
