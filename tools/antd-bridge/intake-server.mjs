// Loopback intake edge for the keyless Rust bridge. No signer or payment code.
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,rename,rm,stat} from 'node:fs/promises';
import {resolve,join,basename,win32} from 'node:path';
import {pathToFileURL} from 'node:url';

export const MAX_BYTES=63*4190208;
const allowedOrigin=origin=>{try{const u=new URL(origin);return origin==='https://skaists.dev'||(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:');}catch{return false;}};
export function createIntakeServer({stateDir,upstream='http://127.0.0.1:8817',maxBytes=MAX_BYTES}){
  const root=resolve(stateDir);let queue=Promise.resolve();
  const serial=async fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
  return createServer(async(req,res)=>{
    const reply=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try{
      const host=new URL('http://'+req.headers.host).hostname;
      if(!['localhost','127.0.0.1'].includes(host))return reply(403,{error:'loopback host required'});
      const origin=req.headers.origin;
      if(origin&&!allowedOrigin(origin))return reply(403,{error:'origin refused'});
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS'){
        if(!origin)return reply(403,{error:'origin required'});
        res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-BData-Name, X-BData-Sha256','Access-Control-Allow-Private-Network':'true'});res.end();return;
      }
      if(req.url==='/health'&&req.method==='GET'){
        let network={connected:false};try{const r=await fetch(upstream+'/health',{signal:AbortSignal.timeout(1500)});if(r.ok)network=await r.json();}catch{}
        return reply(200,{...network,intake:{ready:true,max_bytes:maxBytes,local_only:true},service:'bdata-local-intake',version:1});
      }
      if(req.url==='/v1/intake'&&req.method==='POST'){
        if(!origin)return reply(403,{error:'origin required'});
        if(req.headers['content-type']!=='application/octet-stream')return reply(415,{error:'raw binary file required'});
        const sha=String(req.headers['x-bdata-sha256']||'').toLowerCase();
        let name;try{name=decodeURIComponent(String(req.headers['x-bdata-name']||''));}catch{return reply(400,{error:'invalid file name'});}
        if(!/^[a-f0-9]{64}$/.test(sha))return reply(400,{error:'valid SHA-256 required'});
        if(!name||name.length>240||basename(name)!==name||win32.basename(name)!==name||/[\x00-\x1f<>:"|?*]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))return reply(400,{error:'unsafe file name'});
        if(Number(req.headers['content-length'])>maxBytes)return reply(413,{error:'file exceeds intake byte ceiling'});
        const shelf=join(root,'intake');await mkdir(shelf,{recursive:true});
        const temporary=join(shelf,'.pending-'+randomUUID());const file=await open(temporary,'wx');let bytes=0;
        const hash=createHash('sha256');
        try{
          for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes){const e=Error('file exceeds intake byte ceiling');e.status=413;throw e;}hash.update(chunk);await file.writeFile(chunk);}
          await file.sync();await file.close();
          if(hash.digest('hex')!==sha){const e=Error('hash mismatch — no artifact registered');e.status=409;throw e;}
          const result=await serial(async()=>{
            const registry=join(root,'artifacts.json');let pins=[];
            try{pins=JSON.parse(await readFile(registry,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
            if(!Array.isArray(pins))throw Error('artifact registry is not an array');
            const existing=pins.find(p=>p.sha256===sha);
            if(existing){const s=await stat(existing.path);const h=createHash('sha256');for await(const part of createReadStream(existing.path))h.update(part);if(s.size!==bytes||existing.bytes!==bytes||h.digest('hex')!==sha)throw Error('existing artifact differs from its registry');return {sha256:sha,bytes,name:basename(existing.path),duplicate:true};}
            const dir=join(shelf,sha);await mkdir(dir,{recursive:true});const target=join(dir,name);
            await rename(temporary,target);pins.push({sha256:sha,bytes,path:target,note:'bData local intake; independent streamed SHA-256'});
            const next=registry+'.'+randomUUID()+'.tmp';await open(next,'wx').then(async h=>{try{await h.writeFile(JSON.stringify(pins,null,2)+'\n');await h.sync();}finally{await h.close();}});
            try{await rename(next,registry);}catch(e){await rm(next,{force:true});throw e;}
            return {sha256:sha,bytes,name};
          });reply(200,result);
        }catch(e){if(!res.headersSent)reply(e.status||500,{error:e.status?e.message:'local intake failed; no success receipt'});}
        finally{await file.close().catch(()=>{});await rm(temporary,{force:true});}
        return;
      }
      // Other routes remain the Rust bridge's responsibility. No mocked quote.
      try{
        const r=await fetch(upstream+req.url,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json'},...(req.method==='GET'||req.method==='HEAD'?{}:{body:req,duplex:'half'}),signal:AbortSignal.timeout(120000)});
        res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json'});for await(const chunk of r.body||[])res.write(chunk);res.end();
      }catch{reply(503,{error:'Autonomi quote bridge is not running on port 8817; local intake remains available'});}
    }catch{if(!res.headersSent)reply(500,{error:'local intake service error'});}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const stateDir=process.env.ANTD_BRIDGE_STATE;if(!stateDir)throw Error('ANTD_BRIDGE_STATE must name the existing bridge state directory');
  const port=Number(process.env.BDATA_INTAKE_PORT||8807);
  const server=createIntakeServer({stateDir});server.listen(port,'127.0.0.1',()=>console.log(`bData intake ready on loopback port ${port}; keyless, local only`));
}
