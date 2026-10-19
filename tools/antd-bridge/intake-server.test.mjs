import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {runInNewContext} from 'node:vm';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createIntakeServer,MAX_BYTES} from './intake-server.mjs';

test('local ceiling is configured independently and malformed limits refuse startup',()=>{
  assert.equal(MAX_BYTES,1024*1024*1024);
  for(const maxBytes of [0,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>createIntakeServer({stateDir:tmpdir(),maxBytes}),/positive safe integer/);
  }
});

test('a file above the Autonomi wave limit stays locally usable after restart without payment',async()=>{
  const bytes=59*4190208+1,chunk=Buffer.alloc(64*1024,0x5a);
  function* parts(){for(let left=bytes;left>0;left-=chunk.length)yield chunk.subarray(0,Math.min(left,chunk.length));}
  const hash=createHash('sha256');for(const part of parts())hash.update(part);const sha=hash.digest('hex');
  const root=await mkdtemp(join(tmpdir(),'bdata-intake-large-'));let server;
  const start=async()=>{server=createIntakeServer({stateDir:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
  const stop=async()=>{server.closeIdleConnections();await new Promise(r=>server.close(r));};
  let url=await start();
  const send=()=>fetch(url+'/v1/intake',{method:'POST',headers:{Origin:'https://skaists.dev','Content-Type':'application/octet-stream','Content-Length':String(bytes),'X-BData-Name':'large.bin','X-BData-Sha256':sha},body:Readable.from(parts()),duplex:'half'});
  try{
    let r=await send();assert.equal(r.status,200);assert.deepEqual(await r.json(),{sha256:sha,bytes,name:'large.bin'});
    await stop();url=await start();
    const pins=JSON.parse(await readFile(join(root,'artifacts.json'),'utf8'));assert.equal(pins.length,1);assert.equal(pins[0].bytes,bytes);
    assert.equal((await stat(pins[0].path)).size,bytes);
    const recovered=createHash('sha256');for await(const part of createReadStream(pins[0].path))recovered.update(part);
    assert.equal(recovered.digest('hex'),sha,'restart must recover the real bytes, not only a receipt');
    r=await send();assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true,'restart duplicate must independently rehash the existing bytes');

    // Exercise the unchanged shipped payer, not a surrogate payment guard.
    const context={module:{exports:{}}};runInNewContext(await readFile(new URL('../../surfaces/ant-pay.js',import.meta.url),'utf8'),context);
    let network=0,signer=0,confirmed=0;
    const payer=context.module.exports.create({fetch:async()=>{network++;throw Error('network must not be reached');},signer:{address:async()=>{signer++;},send:async()=>{signer++;}}});
    await assert.rejects(payer.pay({prepare:{upload_id:'large-local-proof',payment_type:'merkle'},authorization:{state:'authorized-for-signing'},confirmPlan:async()=>{confirmed++;return true;}}),e=>e.refusal==='merkle-not-built');
    assert.deepEqual({network,signer,confirmed},{network:0,signer:0,confirmed:0});
  }finally{await stop();assert.equal(dirname(root),resolve(tmpdir()));assert.match(basename(root),/^bdata-intake-large-/);await rm(root,{recursive:true,force:true});}
});

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
