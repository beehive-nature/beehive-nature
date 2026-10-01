import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createIntakeServer} from './intake-server.mjs';

test('real intake persists independently hashed bytes, refuses bad requests, and survives restart',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bdata-intake-'));let server;
  const start=async()=>{server=createIntakeServer({stateDir:root,maxBytes:128});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
  const stop=async()=>{server.closeIdleConnections();await new Promise(r=>server.close(r));};
  let url=await start();const body=Buffer.from('bData independent local intake proof'),sha=createHash('sha256').update(body).digest('hex');
  const send=(bytes=body,hash=sha,name='proof.txt',origin='https://skaists.dev')=>fetch(url+'/v1/intake',{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream','X-BData-Name':encodeURIComponent(name),'X-BData-Sha256':hash},body:bytes});
  try{
    let r=await fetch(url+'/v1/intake',{method:'OPTIONS',headers:{Origin:'https://skaists.dev','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-bdata-name,x-bdata-sha256,content-type','Access-Control-Request-Private-Network':'true'}});
    assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://skaists.dev');assert.equal(r.headers.get('access-control-allow-private-network'),'true');
    assert.equal((await send(body,sha,'proof.txt','https://evil.example')).status,403);
    assert.equal((await send(body,sha,'../escape.txt')).status,400);
    assert.equal((await send(body,'aa'.repeat(32))).status,409);
    assert.equal((await send(Buffer.alloc(129))).status,413);
    r=await send();assert.equal(r.status,200);assert.deepEqual(await r.json(),{sha256:sha,bytes:body.length,name:'proof.txt'});
    let pins=JSON.parse(await readFile(join(root,'artifacts.json'),'utf8'));assert.equal(pins.length,1);assert.deepEqual(await readFile(pins[0].path),body);
    await stop();url=await start();r=await send();assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);assert.equal(JSON.parse(await readFile(join(root,'artifacts.json'),'utf8')).length,1);
    const other=Buffer.from('second concurrent file'),otherHash=createHash('sha256').update(other).digest('hex');
    const results=await Promise.all([send(),send(other,otherHash,'other.txt')]);assert.ok(results.every(r=>r.status===200));
    pins=JSON.parse(await readFile(join(root,'artifacts.json'),'utf8'));assert.equal(pins.length,2);assert.equal((await readdir(join(root,'intake'))).filter(n=>n.startsWith('.pending')).length,0);
    await writeFile(pins.find(p=>p.sha256===sha).path,Buffer.alloc(body.length));assert.equal((await send()).status,500,'duplicate receipt must not bless corrupt disk bytes');
    await writeFile(join(root,'artifacts.json'),'broken');assert.equal((await send(other,otherHash,'other.txt')).status,500);assert.equal(await readFile(join(root,'artifacts.json'),'utf8'),'broken','never overwrite a broken registry');
  }finally{await stop();assert.equal(dirname(root),resolve(tmpdir()));assert.match(basename(root),/^bdata-intake-/);await rm(root,{recursive:true,force:true});}
});
