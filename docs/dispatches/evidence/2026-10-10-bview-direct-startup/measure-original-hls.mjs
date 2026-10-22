// Run from repository root: node PATH --kbps 700 --out NEW_RECEIPT.json
// Local original-content derivative measurement; no public media is published.
import { chromium, devices } from 'playwright';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { createServer } from 'node:https';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { kbps: { type:'string', default:'700' }, out:{type:'string'} } });
if (!values.out) throw Error('--out required');
const kbps=Number(values.kbps), root=process.cwd(), packageRoot=resolve(root,'.tmp-shu003/original-adaptive');
if (!Number.isFinite(kbps)||kbps<=0) throw Error('positive kbps required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pkg=JSON.parse(await readFile(resolve(packageRoot,'package.json')));
const sourceSha256=sha(await readFile(resolve(root,'.tmp-shu003/original-autonomi-video.mp4')));
const htmlSha256=sha(await readFile(resolve(root,'surfaces/bview.html')));
const expected=new Map(pkg.files.map(f=>[f.path,f.sha256]));
expected.set('master.m3u8',sha(await readFile(resolve(packageRoot,'master.m3u8'))));
const certificateDir=await mkdtemp(resolve(tmpdir(),'bview-original-tls-'));
const key=resolve(certificateDir,'key.pem'),cert=resolve(certificateDir,'cert.pem');
execFileSync(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl',
 ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore',windowsHide:true});
const requests=[],errors=[],stray=[],assets=[],checks=[];
let browser,context,activeMedia=0,peakConcurrentMedia=0;
const server=createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{
 let counted=false;
 try {
  const u=new URL(req.url,'https://localhost'),media=u.pathname.startsWith('/media/');
  const base=media?packageRoot:root, name=decodeURIComponent(u.pathname.slice(media?7:1));
  const file=resolve(base,name);
  if (!file.startsWith(base+sep)) {res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  const contentType=name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':/\.(m?js)$/.test(name)?'text/javascript':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'video/mp4';
  res.writeHead(200,{'content-type':contentType,'content-length':body.length,'access-control-allow-origin':'*'});
  if (media) requests.push({name,bytes:body.length,at:Date.now()});
  if (media&&name.endsWith('.m4s')) {
   counted=true;activeMedia++;peakConcurrentMedia=Math.max(peakConcurrentMedia,activeMedia);
   res.flushHeaders();
   for(let at=0;at<body.length&&!res.destroyed;at+=8192){
    const chunk=body.subarray(at,at+8192);
    await new Promise(r=>setTimeout(r,chunk.length*8/kbps));
    res.write(chunk);
   }
   res.end();
  } else res.end(body);
 } catch { if(!res.headersSent)res.writeHead(404);res.end(); }
 finally {if(counted)activeMedia--;}
});
try {
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`https://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
 context=await browser.newContext({...devices['Pixel 7'],ignoreHTTPSErrors:true});
 await context.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();stray.push(route.request().url());return route.abort();});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',response=>{
  if(!response.url().startsWith(origin+'/media/'))return;
  const name=response.url().slice((origin+'/media/').length);
  checks.push(response.body().then(body=>assets.push({name,bytes:body.length,matches:sha(body)===expected.get(name)})).catch(()=>assets.push({name,matches:false})));
 });
 await page.goto(origin+'/surfaces/bview.html');
 await page.fill('#addr',origin+'/media/master.m3u8');await page.locator('#f button').click();
 const deadline=Date.now()+120000;
 while(Date.now()<deadline){
  await page.waitForTimeout(1000);
  if(await page.locator('#tap').isVisible())await page.locator('#tap').click();
  if(await page.evaluate(()=>{const e=window.__bviewEngine();return e.video.ended||e.fail;}))break;
 }
 await Promise.all(checks);
 const e=await page.evaluate(()=>window.__bviewEngine());
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 const accepted=e.video.ended&&e.playhead>=52&&e.video.srcChanges===1&&!e.fail&&e.adaptive.errors===0&&assets.length>0&&assets.every(a=>a.matches)&&errors.length===0&&stray.length===0&&layout.width===layout.scrollWidth;
 const result={observedAt:new Date().toISOString(),browser:browser.version(),boundary:'one local Chrome viewer with Pixel 7 emulation; per-response paced segment bodies; not public delivery, a physical phone, quality equivalence or a capacity test',kbpsPerMediaResponse:kbps,peakConcurrentMedia,sourceSha256,htmlSha256,bundleId:pkg.bundleId,accepted,layout,errors,stray,startupMs:e.playStartMs,previewMs:e.ttffMs,stalls:e.stalls,stallMs:e.stallMs,video:e.video,adaptive:e.adaptive,assets,requests,'PUBLIC-CONSTANT':'immutable source and rendition digests'};
 await writeFile(resolve(values.out),JSON.stringify(result)+'\n',{flag:'wx'});
 console.log(JSON.stringify({accepted,kbps,startupMs:result.startupMs,stalls:result.stalls,stallMs:result.stallMs,adaptive:result.adaptive,peakConcurrentMedia,errors,stray}));
 if(!accepted)process.exitCode=1;
} finally {
 await context?.close();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 await unlink(key);await unlink(cert);await rmdir(certificateDir);
}
