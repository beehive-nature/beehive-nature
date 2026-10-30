// Banked abort/close lifecycle cases (live network, real pinned SDKs).
// - 0.1.5 abort sequence closes cleanly.
// - 0.1.2 abort sequence reproduces the known WASM borrow defect
//   (expected failure signature, banked as evidence).
// - No-abort controls pass on both arms.
// Every case runs under explicit deadlines, writes its receipt before
// the verdict propagates, and releases resources in finally paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPins } from '../tools/video-trial/sdk-qualification.mjs';

const root = resolve(import.meta.dirname, '..');
const ADDR = '711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a'; // PUBLIC-CONSTANT: public photo fixture
const OP_MS = 90_000;

async function runCase(version, pins, { abort }) {
  const served = [];
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  const receipt = {
    script: 'e2e/bview-sdk-abort-close.test.mjs',
    runner: process.version,
    startedAt: new Date().toISOString(),
    version,
    abort,
    served: null,
    wasmVerified: false,
    entryVerified: false,
    ok: null,
    error: null,
    'PUBLIC-CONSTANT': 'public fixture address only; no key material',
  };
  try {
    await context.route('https://sdk-qual.local/**', async (route) => {
      const rel = new URL(route.request().url()).pathname.slice(1);
      try {
        const body = await readFile(join(root, 'vendor', 'ant-browser-sdk', version, rel));
        const { createHash } = await import('node:crypto');
        served.push({ rel, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
        return route.fulfill({ body, contentType: 'text/javascript' });
      } catch {
        return route.fulfill({ status: 404 });
      }
    });
    const page = await context.newPage();
    const withDeadline = (promise, ms, label) => Promise.race([promise, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(Error(`deadline: ${label} exceeded ${ms}ms`)), ms);
    if (timer.unref) timer.unref();
  })]);
  const t0 = performance.now();
    const outcome = await withDeadline(page.evaluate(`(async () => {
      const sdk = await import('https://sdk-qual.local/index.js');
      const client = await sdk.AutonomiClient.connect();
      try {
        const r0 = await client.openFile(${JSON.stringify(ADDR)});
        ${abort ? `const ctl = new AbortController();
        const pending = r0.read(0, 138931, { signal: ctl.signal });
        ctl.abort();
        try { await pending; } catch {}` : `await r0.read(0, 64);`}
        await r0.close();
        const r1 = await client.openFile(${JSON.stringify(ADDR)});
        await r1.close();
        const r2 = await client.openFile(${JSON.stringify(ADDR)});
        const head = await r2.read(0, 16);
        await r2.close();
        return 'ok:' + head.length;
      } finally { try { await client.close(); } catch {} }
    })()`), OP_MS, 'abort-close-case');
    receipt.ms = Math.round(performance.now() - t0);
    receipt.ok = true;
    receipt.outcome = outcome;
  } catch (error) {
    receipt.ok = false;
    receipt.error = String((error && error.message) || error).slice(0, 300);
  } finally {
    await context.close();
    await browser.close();
  }
  const table = pins[version];
  receipt.served = served.map((s) => {
    const pin = table[s.rel];
    if (!pin || s.bytes !== pin.bytes || s.sha256 !== pin.sha256) {
      throw Error(`served SDK mismatch on ${version}: ${s.rel}`);
    }
    return s;
  });
  receipt.entryVerified = receipt.served.some((d) => d.rel === 'index.js');
  receipt.wasmVerified = receipt.served.some((d) => d.rel === 'wasm/ant_core_bg.wasm');
  return receipt;
}

async function bank(t, name, receipt) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = join(root, 'docs', 'receipts', 'ant-sdk-015', `${name}-${stamp}.json`);
  await writeFile(out, JSON.stringify(receipt) + '\n', { flag: 'wx' });
  t.diagnostic(`receipt: ${out}`);
}

test('0.1.5 abort/close lifecycle closes cleanly', { timeout: 300_000 }, async (t) => {
  const receipt = await runCase('0.1.5', await loadPins(), { abort: true });
  await bank(t, 'abort-close-0.1.5', receipt);
  assert.equal(receipt.ok, true, receipt.error);
  assert.match(receipt.outcome, /^ok:16/);
  assert.equal(receipt.wasmVerified, true);
});

test('0.1.2 abort/close reproduces the known borrow defect', { timeout: 300_000 }, async (t) => {
  const receipt = await runCase('0.1.2', await loadPins(), { abort: true });
  await bank(t, 'abort-close-0.1.2', receipt);
  assert.equal(receipt.ok, false, 'defect unexpectedly absent — re-examine');
  assert.match(receipt.error, /borrowed/, 'expected WASM borrow signature');
});

for (const version of ['0.1.5', '0.1.2']) {
  test(`no-abort control on ${version}`, { timeout: 300_000 }, async (t) => {
    const receipt = await runCase(version, await loadPins(), { abort: false });
    await bank(t, `abort-close-control-${version}`, receipt);
    assert.equal(receipt.ok, true, receipt.error);
    assert.equal(receipt.wasmVerified, true);
  });
}
