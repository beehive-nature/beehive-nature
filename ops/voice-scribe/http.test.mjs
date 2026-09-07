import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { generateSecretKey, finalizeEvent } from 'nostr-tools/pure';

function request(port, { method='GET', path='/healthz', headers={}, body }={}) {
  return new Promise((resolve,reject) => {
    const req=http.request({hostname:'127.0.0.1',port,path,method,headers},res=>{
      let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));
    });
    req.setTimeout(4000,()=>req.destroy(new Error('test request timeout')));
    req.on('error',reject);req.end(body);
  });
}

test('HTTP survives hostile Host, rejects invalid auth, releases failed spool jobs', async () => {
  const root=await mkdtemp(join(tmpdir(),'bnr-voice-test-'));
  const spool=join(root,'spool');
  const child=spawn(process.execPath,[fileURLToPath(new URL('./voice-scribe.mjs',import.meta.url))],{
    env:{...process.env,VOICE_BIND:'127.0.0.1',VOICE_PORT:'0',VOICE_SPOOL:spool,VOICE_MODEL:join(root,'model.bin'),VOICE_FFMPEG:'bnr-no-such-ffmpeg'},
    stdio:['ignore','pipe','pipe'],
  });
  try {
    const port=await new Promise((resolve,reject)=>{
      let text='';const timer=setTimeout(()=>reject(new Error('test server startup timed out')),5000);
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('test server exited before listening'));});
      child.stdout.on('data',chunk=>{
        text+=chunk;for(const line of text.split('\n')) {
          try { const row=JSON.parse(line);if(row.listening){clearTimeout(timer);resolve(Number(row.listening.split(':').pop()));} } catch {}
        }
      });
    });
    const bad=await request(port,{method:'POST',headers:{host:'[','content-type':'audio/wav'},body:Buffer.from('x')});
    assert.equal(bad.status,401);
    assert.equal((await request(port)).status,200);

    const body=Buffer.from('synthetic test input');
    const key=generateSecretKey();
    const auth=nonce=>{
      const event=finalizeEvent({kind:27235,created_at:Math.floor(Date.now()/1000),content:'',tags:[['u','https://skaists.buzz/voice'],['method','POST'],['payload',createHash('sha256').update(body).digest('hex')],['nonce',nonce]]},key);
      return 'Nostr '+Buffer.from(JSON.stringify(event)).toString('base64');
    };
    const headers={'content-type':'audio/wav',authorization:auth('test-one')};
    assert.equal((await request(port,{method:'POST',headers,body})).body.ok,false);
    assert.deepEqual(await readdir(spool),[]);
    assert.equal((await request(port)).body.queue,0);
    await rm(spool,{recursive:true});await writeFile(spool,'spool path unavailable');
    assert.equal((await request(port,{method:'POST',headers:{...headers,authorization:auth('test-two')},body})).body.ok,false);
    assert.equal((await request(port)).body.queue,0);
    key.fill(0);
  } finally {
    const stopped=new Promise(resolve=>child.once('close',resolve));child.kill();await stopped;
    await rm(root,{recursive:true,force:true});
  }
});
