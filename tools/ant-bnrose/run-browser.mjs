// Dedicated headless test browser, with its normal Chromium sandbox enabled.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const [arm,load,fault,output]=process.argv.slice(2);
if(!['baseline','shadow'].includes(arm)||!['1','4'].includes(load)||!['steady','churn'].includes(fault)||!output)
  throw Error('Usage: run-browser.mjs baseline|shadow 1|4 steady|churn output.json');
await fs.access(output).then(()=>{throw Error('Receipt exists');},e=>{if(e.code!=='ENOENT')throw e;});
const root=path.resolve(import.meta.dirname,'../..');
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'bnrose-browser-'));
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>ANT observation experiment</title><script type="module" src="/tools/ant-bnrose/trial.mjs"></script>');return;}
    if(!pathname.startsWith('/tools/ant-bnrose/')&&!pathname.startsWith('/vendor/ant-browser-sdk/0.1.2/'))
      throw Error('path outside fixture');
    const target=path.resolve(root,'.'+pathname);
    if(!target.startsWith(root+path.sep)) throw Error('path escape');
    const data=await fs.readFile(target);
    res.setHeader('Content-Type',target.endsWith('.wasm')?'application/wasm':/\.(js|mjs)$/.test(target)?'text/javascript':'application/json');
    res.setHeader('Cache-Control','no-store');res.end(data);
  } catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=spawn(process.env.CHROMIUM??'chromium',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--disable-background-networking','--disable-component-update','--disable-sync',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{stdio:['ignore','ignore','pipe']});
let stderr='', ws, sequence=0;
browser.stderr.on('data',b=>{if(stderr.length<20000)stderr+=b.toString();});
const pending=new Map();
const command=(method,params={},timeoutMs=220000)=>new Promise((resolve,reject)=>{
  const id=++sequence;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},timeoutMs);
  pending.set(id,{resolve,reject,timer}); ws.send(JSON.stringify({id,method,params}));
});
let result;
try {
  let port;
  for(let i=0;i<100;i++) {
    if(browser.exitCode!==null) throw Error(`Chromium exited ${browser.exitCode}: ${stderr.slice(-1500)}`);
    try {port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}
  }
  if(!port) throw Error('Chromium debug endpoint unavailable');
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab=tabs.find(t=>t.type==='page');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const reply=JSON.parse(event.data), p=pending.get(reply.id);
    if(p){pending.delete(reply.id);clearTimeout(p.timer);reply.error?p.reject(Error(reply.error.message)):p.resolve(reply.result);}
  };
  await command('Runtime.enable');
  const version=await command('Browser.getVersion');
  await command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  let ready=false;
  for(let i=0;i<100;i++) {
    const r=await command('Runtime.evaluate',{expression:'typeof runTrial === "function"',returnByValue:true});
    if(r.result?.value){ready=true;break;} await delay(100);
  }
  if(!ready) throw Error('Experiment module did not initialize');
  const reply=await command('Runtime.evaluate',{
    expression:`runTrial(${JSON.stringify({shadow:arm==='shadow',concurrency:Number(load),churn:fault==='churn'})})`,
    awaitPromise:true,returnByValue:true,
  });
  if(reply.exceptionDetails) throw Error('Experiment evaluation failed');
  result={...reply.result.value,browser:version.product,observedAt:new Date().toISOString()};
} catch(error) {
  result={schema:'bnrose.ant-webrtc.launch-failure.v1',error:String(error.message),observedAt:new Date().toISOString()};
  process.exitCode=1;
} finally {
  if(ws?.readyState===WebSocket.OPEN) {try{await command('Browser.close',{},1000);}catch{} ws.close();}
  for(const p of pending.values()) {clearTimeout(p.timer);p.reject(Error('Browser closed'));}
  browser.kill('SIGTERM');
  server.closeAllConnections();server.close();
  // Profile is a fresh private temporary directory owned by this process.
  await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
}
