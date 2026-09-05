/* sw.js — THE SRI GATE for the local agent (z3.2, 2026-09-05).
   Subresource Integrity for fetch()-loaded artifacts: the <script>
   integrity= attribute cannot reach model shards or wasm the engine
   fetches itself, so this worker IS the pin. Seventeen sha256 pins; no
   artifact crosses the network unverified.

   TWO VERDICT CLASSES (both real, stated on-page):
   · SMALL artifacts and the ONLY EXECUTABLE (the engine bundle, the
     model-lib wasm, every config/tokenizer/manifest file) — buffered and
     hashed BEFORE a byte is served. A mismatch is refused (410) and the
     engine never sees the file at all.
   · THE EIGHT WEIGHT SHARDS (30–65 MB, pure data, never executed) —
     streamed THROUGH to the engine while an incremental SHA-256 runs on
     the tee'd copy (a whole-shard buffer ×8 inside one worker is what
     kills the worker mid-flight; measured 2026-09-05). The page receives
     the live verdict per shard and REFUSES inference if any final hash
     disagrees — a tampered mind never answers.

   The pins are PUBLIC CONSTANTS — content-addressed artifact hashes from
   the estate's own custody copies (surfaces/local-agent/qwen05/ + the
   vendored engine) and the box mirror's sha256sum receipt. */
const PINS = {
  'web-llm.mjs': '8b7a58eaf5a3722f822e4e4e6a4697af28182919cdad892ec7c50758bf7418c2', // PUBLIC-CONSTANT — vendored @mlc-ai/web-llm 0.2.84 ESM (Apache-2.0), estate custody copy
  'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm': '611b584fd44af2789416395603965a6bc074f2127188af597f4dda016fbdab19', // PUBLIC-CONSTANT — model-lib wasm, mlc-ai binary-mlc-llm-libs v0_2_84
  'mlc-chat-config.json': '5439c03bdf4ee7cfe0f8a97a6588018b0144dc1280c71bbaea2853cdbab874b9', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'ndarray-cache.json': '23a54b5e9b271204561901b513c5b359498733429ee219ccc907eb1cd0790e3f', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'tensor-cache.json': '23a54b5e9b271204561901b513c5b359498733429ee219ccc907eb1cd0790e3f', // PUBLIC-CONSTANT — same manifest shipped under its compat name (byte-identical)
  'tokenizer.json': 'c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'tokenizer_config.json': '5214600ee45ca2f887ce2eede8910378a0111ea99d657428bcbce94778e65a92', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'vocab.json': 'ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'merges.txt': '599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC artifact sha256
  'params_shard_0.bin': '9f309954d310dc63adfaf3ef6aa987c681b8aa6d1b9686aa2525b454b0d058d5', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_1.bin': '6d174758dd299d9ef4222b1ad4283be832ebd43853951da25b50501ab1b75ba7', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_2.bin': '83e0b530bf5c44cbead1a6c220af81040a975f7c81fb708977a02e3ac8d7ffa7', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_3.bin': '5ff16197c197d8783d398d0c35fa9641e606e6e2dc1d53b9f26a0c9c17a97921', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_4.bin': 'a7a3d2b02aa9258154f250a714d1743672e423c5c7c8e5c5eefcb9bf337aa0fd', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_5.bin': '19dfd7a3064b84082915575c0e5a57fc1cd7108828e1ce9fbbbaf9db4b63b9af', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_6.bin': '192576d43956aa977ec60848b8a7fc8483b5fe38ca9669aa9a3ca2ba795a7a33', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
  'params_shard_7.bin': '1ee25c2a41dad6833e000b7e3ec13a5a1761c32ffbed0ad8a98a6ad313338dc0', // PUBLIC-CONSTANT — Qwen2.5-0.5B-Instruct-q4f16_1-MLC weight shard sha256
};
const STREAMED = f => /^params_shard_\d+\.bin$/.test(f);   /* the weight class */

const MODEL_DOOR = 'https://relay.skaists.dev/model/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/';
const ENGINE_PATH = '/surfaces/blight/web-llm.mjs';
const QWEN05_PATH = '/surfaces/local-agent/qwen05/';
const CACHE = 'local-agent-sri-v1';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

async function sha256hex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function report(msg) {
  self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage(msg)));
}

/* incremental SHA-256 over stream chunks — no whole-body buffer */
function sha256inc() {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  let buf = new Uint8Array(0), len = 0;
  const block = new Uint32Array(64), w = new Uint32Array(64);
  function absorb(chunk) {
    const n = new Uint8Array(buf.length + chunk.length);
    n.set(buf); n.set(chunk, buf.length); buf = n;
    while (buf.length >= 64) {
      for (let i = 0; i < 16; i++) block[i] = (buf[i*4]<<24) | (buf[i*4+1]<<16) | (buf[i*4+2]<<8) | buf[i*4+3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(block[i-15],7) ^ rotr(block[i-15],18) ^ (block[i-15] >>> 3);
        const s1 = rotr(block[i-2],17) ^ rotr(block[i-2],19) ^ (block[i-2] >>> 10);
        block[i] = (block[i-16] + s0 + block[i-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + block[i]) | 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
      buf = buf.subarray(64);
    }
  }
  return {
    update(chunk) { absorb(chunk); len += chunk.length; },
    hex() {
      const bits = len * 8;
      absorb(new Uint8Array([0x80]));
      while (buf.length !== 56) absorb(new Uint8Array(1));
      const tail = new Uint8Array(8);
      let x = bits;
      for (let i = 7; i >= 0; i--) { tail[i] = x % 256; x = Math.floor(x / 256); }
      absorb(tail);
      const out = [h0,h1,h2,h3,h4,h5,h6,h7].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
      return out;
    }
  };
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  let file = null;
  if (url.origin === self.location.origin && url.pathname === ENGINE_PATH) file = 'web-llm.mjs';
  else if (url.origin === self.location.origin && url.pathname.startsWith(QWEN05_PATH)) file = url.pathname.slice(QWEN05_PATH.length);
  else if (url.href.startsWith(MODEL_DOOR)) {
    file = url.href.slice(MODEL_DOOR.length);
    /* the engine appends the HF repo shape `resolve/main/` to the model base —
       the door answers it with a symlink; the pin keys on the FILE name */
    file = file.replace(/^resolve\/main\//, '');
  }
  if (!file || file.includes('/') || !PINS[file]) return;   /* not ours to gate */

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url.href);
    if (hit) { report({ type: 'sri', file, ok: true, cached: true }); return hit; }
    let res;
    try { res = await fetch(req); } catch (err) {
      report({ type: 'sri', file, ok: false, why: 'door unreachable — ' + String(err && err.message || err) });
      return new Response('SRI: the estate door is unreachable for ' + file + ' — the panel rests, never guesses', { status: 502 });
    }
    if (!res.ok) {
      report({ type: 'sri', file, ok: false, why: 'door HTTP ' + res.status });
      return new Response('SRI: the door refused ' + file + ' (HTTP ' + res.status + ')', { status: 502 });
    }

    const headers = new Headers();
    res.headers.forEach((v, k) => { if (!/content-encoding|content-length/i.test(k)) headers.set(k, v); });

    if (!STREAMED(file)) {
      /* strict: hash the WHOLE body before any byte is served */
      const buf = await res.arrayBuffer();
      const got = await sha256hex(buf);
      if (got !== PINS[file]) {
        report({ type: 'sri', file, ok: false, why: 'HASH MISMATCH — pinned ' + PINS[file].slice(0, 12) + '… got ' + got.slice(0, 12) + '…' });
        return new Response('SRI REFUSED: ' + file + ' does not match its pin — nothing unverified runs', { status: 410 });
      }
      const fresh = new Response(buf, { status: 200, headers });
      await cache.put(url.href, fresh.clone());
      report({ type: 'sri', file, ok: true, cached: false });
      return fresh.clone();
    }

    /* the weight class: stream through, hash the tee as it flows. The page
       refuses inference if the final hash disagrees — a tampered mind never
       answers. Warm loads ride the engine's own cache; any network refetch
       passes this same gate. */
    const [toEngine, toHash] = res.body.tee();
    const verdict = (async () => {
      const rd = toHash.getReader(), h = sha256inc();
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        h.update(value);
      }
      const got = h.hex();
      report(got === PINS[file]
        ? { type: 'sri', file, ok: true, streamed: true }
        : { type: 'sri', file, ok: false, why: 'HASH MISMATCH (streamed) — pinned ' + PINS[file].slice(0, 12) + '… got ' + got.slice(0, 12) + '…' });
    })().catch(err => report({ type: 'sri', file, ok: false, why: 'verify stream broke — ' + String(err && err.message || err) }));
    return new Response(toEngine, { status: 200, headers });
  })());
});
