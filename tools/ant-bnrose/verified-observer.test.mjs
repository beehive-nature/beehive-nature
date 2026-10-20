import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createVerifiedDownloader} from './verified-observer.mjs';
const bytes=new TextEncoder().encode('verified local fixture');
const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
const fixture={address:'a'.repeat(64),sha256:hash,size:bytes.length};
const module=await WebAssembly.compile(await fs.readFile(new URL('./kernel.wasm',import.meta.url)));
const good={download:async()=>({bytes:bytes.slice()})};

test('same real Rust core admits independently verified reads; opt-out does no kernel work',async()=>{
  const on=await createVerifiedDownloader(good,fixture,{enabled:true,module});
  assert.equal((await on.download()).observation.status,'observed');
  const off=await createVerifiedDownloader(good,fixture,{enabled:false});
  assert.equal((await off.download()).observation.status,'disabled');
});
test('tampered bytes fail before observation and do not consume an observation sequence',async()=>{
  let corrupt=true;
  const reader=await createVerifiedDownloader({download:async()=>{
    const b=bytes.slice();if(corrupt)b[0]^=1;return {bytes:b};
  }},fixture,{enabled:true,module});
  await assert.rejects(reader.download(),/hash mismatch/);
  corrupt=false;
  assert.equal((await reader.download()).observation.sequence,1);
});
test('size mismatch, transport failure and cancellation cannot become observations',async()=>{
  for(const client of [{download:async()=>({bytes:new Uint8Array(1)})},
    {download:async()=>{throw Error('transport refused');}}]) {
    const r=await createVerifiedDownloader(client,fixture,{enabled:true,module});
    await assert.rejects(r.download());
  }
  const controller=new AbortController();
  const r=await createVerifiedDownloader({download:async()=>{controller.abort();return {bytes};}},
    fixture,{enabled:true,module});
  await assert.rejects(r.download({signal:controller.signal}));
});
test('concurrent out-of-order completions each receive bounded independent observations',async()=>{
  let call=0;
  const r=await createVerifiedDownloader({download:async()=>{
    const n=call++;await new Promise(resolve=>setTimeout(resolve,[20,1,10][n]));
    return {bytes:bytes.slice()};
  }},fixture,{enabled:true,module});
  const results=await Promise.all([r.download(),r.download(),r.download()]);
  assert.ok(results.every(r=>r.observation.status==='observed'));
  assert.deepEqual(results.map(r=>r.observation.sequence).sort(),[1,2,3]);
});
test('local policy is snapshotted and oversized inputs refuse before download',async()=>{
  const selected={...fixture};
  let address;
  const r=await createVerifiedDownloader({download:async a=>{address=a;return {bytes};}},
    selected,{enabled:true,module});
  selected.address='b'.repeat(64);selected.sha256='0'.repeat(64);
  await r.download();assert.equal(address,fixture.address);
  await assert.rejects(createVerifiedDownloader(good,{...fixture,size:3*1024*1024}));
});
