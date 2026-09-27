#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { parseListen, streamXor, parseRange } from './first-chunk-cache.mjs';

const XOR = '7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78 PUBLIC-CONSTANT';
const TOTAL = 5 * 1024 * 1024;
const CHUNK = 2 * 1024 * 1024;
const HERE = path.dirname(fileURLToPath(import.meta.url));

test('parseListen / streamXor / parseRange', () => {
  assert.deepEqual(parseListen('127.0.0.1:8084'), { host: '127.0.0.1', port: 8084 });
  assert.equal(streamXor(`/v1/data/public/${XOR}/stream`), XOR);
  assert.equal(streamXor(`/ant/v1/data/public/${XOR}/stream`), XOR);
  assert.equal(streamXor(`/v1/data/public/${XOR}`), null);
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=100-', 1000), { start: 100, end: 999 });
  assert.equal(parseRange('bytes=5000-6000', 1000).unsatisfiable, true);
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function fetchBuf(url, { headers = {}, maxBytes = Infinity } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    http
      .get(url, { headers }, (res) => {
        const ttfbMs = performance.now() - t0;
        const marksMs = {};
        const want = [256 * 1024, 512 * 1024, 1024 * 1024, 2 * 1024 * 1024].filter(
          (n) => n <= maxBytes,
        );
        const chunks = [];
        let got = 0;
        res.on('data', (c) => {
          chunks.push(c);
          got += c.length;
          const elapsed = performance.now() - t0;
          for (const n of want) {
            if (marksMs[n] == null && got >= n) marksMs[n] = elapsed;
          }
          if (got >= maxBytes) res.destroy();
        });
        res.on('close', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            ttfbMs,
            marksMs,
            got,
            body: Buffer.concat(chunks).subarray(0, Math.min(got, maxBytes === Infinity ? got : maxBytes)),
          });
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

test('cold miss populates cache; warm hit ≤200ms class for first chunk', async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ant-fcc-'));
  const payload = Buffer.alloc(TOTAL, 0);
  payload.write('ftypisom', 0);
  for (let i = 64; i < TOTAL; i++) payload[i] = i & 0xff;

  const upstream = http.createServer((req, res) => {
    assert.match(req.url, new RegExp(`/v1/data/public/${XOR}/stream`));
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': String(TOTAL),
    });
    let off = 0;
    const tick = () => {
      if (off >= TOTAL) {
        res.end();
        return;
      }
      const n = Math.min(16 * 1024, TOTAL - off);
      res.write(payload.subarray(off, off + n));
      off += n;
      setTimeout(tick, 250); // ~64 KiB/s
    };
    tick();
  });
  await listen(upstream);
  const upPort = upstream.address().port;

  // free port for cache
  const probe = http.createServer();
  await listen(probe);
  const cachePort = probe.address().port;
  probe.close();
  await once(probe, 'close');

  const proc = spawn(process.execPath, [path.join(HERE, 'first-chunk-cache.mjs')], {
    env: {
      ...process.env,
      ANT_LISTEN: `127.0.0.1:${cachePort}`,
      ANT_UPSTREAM: `http://127.0.0.1:${upPort}`,
      ANT_FIRST_CHUNK_DIR: tmp,
      ANT_FIRST_CHUNK_BYTES: String(CHUNK),
      ANT_ALLOWED_ORIGIN: 'https://skaists.dev',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  t.after(async () => {
    proc.kill('SIGTERM');
    upstream.close();
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cache start timeout')), 5000);
    proc.stdout.on('data', (b) => {
      if (String(b).includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (b) => console.error('cache stderr', String(b)));
    proc.on('exit', (c) => reject(new Error('cache exited early ' + c)));
  });

  const url = `http://127.0.0.1:${cachePort}/v1/data/public/${XOR}/stream`;

  const cold = await fetchBuf(url, {
    headers: { Origin: 'https://skaists.dev' },
    maxBytes: 256 * 1024,
  });
  assert.equal(cold.status, 200);
  assert.equal(cold.headers['x-ant-first-chunk'], 'MISS');
  assert.equal(cold.headers['accept-ranges'], 'bytes');
  assert.equal(cold.headers['access-control-allow-origin'], 'https://skaists.dev');
  assert.ok(
    cold.marksMs[256 * 1024] > 1000,
    `cold 256KiB too fast: ${cold.marksMs[256 * 1024]}`,
  );

  // Fill cache to CHUNK (continue reading)
  const fill = await fetchBuf(url, {
    headers: { Origin: 'https://skaists.dev' },
    maxBytes: CHUNK,
  });
  assert.ok(fill.got >= Math.min(CHUNK, TOTAL));
  await new Promise((r) => setTimeout(r, 300));
  const bin = path.join(tmp, `${XOR}.bin`);
  assert.ok(fs.existsSync(bin), 'cache bin missing');
  const st = await fsp.stat(bin);
  assert.ok(st.size >= 256 * 1024, `cache too small: ${st.size}`);

  const warm = await fetchBuf(url, {
    headers: { Origin: 'https://skaists.dev' },
    maxBytes: Math.min(st.size, CHUNK),
  });
  assert.equal(warm.status, 200);
  assert.equal(warm.headers['x-ant-first-chunk'], 'HIT');
  assert.equal(warm.headers['accept-ranges'], 'bytes');
  assert.ok(warm.ttfbMs < 200, `warm TTFB ${warm.ttfbMs}ms not ≤200ms`);
  if (warm.marksMs[256 * 1024] != null) {
    assert.ok(
      warm.marksMs[256 * 1024] < 200,
      `warm to-256KiB ${warm.marksMs[256 * 1024]}ms not ≤200ms`,
    );
  }
  assert.equal(warm.body.subarray(0, 8).toString('ascii'), 'ftypisom');
  assert.ok(warm.body.equals(payload.subarray(0, warm.body.length)));

  const ranged = await new Promise((resolve, reject) => {
    http
      .get(url, { headers: { Range: 'bytes=0-1023', Origin: 'https://skaists.dev' } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      })
      .on('error', reject);
  });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers['x-ant-first-chunk'], 'HIT');
  assert.equal(ranged.body.length, 1024);
  assert.ok(ranged.body.equals(payload.subarray(0, 1024)));

  const receipt = {
    cold_ttfb_ms: Math.round(cold.ttfbMs),
    cold_to_256KiB_ms: Math.round(cold.marksMs[256 * 1024] || -1),
    warm_ttfb_ms: Math.round(warm.ttfbMs),
    warm_to_256KiB_ms: Math.round(warm.marksMs[256 * 1024] || warm.ttfbMs),
    warm_got: warm.got,
    cache_bytes: st.size,
    mock_upstream_rate: '~64KiB/s',
  };
  const receiptDir = process.env.ANT_FCC_RECEIPT_DIR || tmp;
  await fsp.mkdir(receiptDir, { recursive: true });
  await fsp.writeFile(
    path.join(receiptDir, 'local-cold-warm.json'),
    JSON.stringify(receipt, null, 2),
  );
  console.log('local cold/warm', receipt);
});
