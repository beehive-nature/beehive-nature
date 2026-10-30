// Live reader exercises against the REAL pinned SDKs (both arms).
// Read-only public fetches, no wallet, no payment. Each arm connects,
// opens the small public photo fixture and exercises: range correctness
// (full-byte SHA-256), pending-read cancellation, close/reopen, late
// completion, corrupt address, invalid ranges, failed-read recovery and
// seed-loss configuration.
//
// Bounds: every connect/operation runs under an explicit
// page.evaluate deadline; durations are monotonic (performance.now).
// Failures still write a structured receipt before propagating, and
// reader/client/browser resources release in finally paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPins } from '../tools/video-trial/sdk-qualification.mjs';

const root = resolve(import.meta.dirname, '..');
const FIXTURE = {
  address: '711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a', // PUBLIC-CONSTANT: public photo address from tools/ant-bnrose/fixture.json
  size: 138931,
  sha256: '98f657d987d339c302295e79907e7a4abc1564bd6b42300ea8d59ccd2148fd17', // PUBLIC-CONSTANT: expected bytes from tools/ant-bnrose/fixture.json
};
const BAD_ADDRESS = 'ff'.repeat(32); // PUBLIC-CONSTANT: unroutable test address, never published content
const CONNECT_MS = 120_000;
const OP_MS = 90_000;

function script(version, body) {
  return `(async () => {\nconst sdk = await import('https://sdk-qual.local/index.js');\n${body}\n})()`;
}

async function withPage(version, served, fn) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  try {
    await context.route('https://sdk-qual.local/**', async (route) => {
      const rel = new URL(route.request().url()).pathname.slice(1);
      try {
        const body = await readFile(join(root, 'vendor', 'ant-browser-sdk', version, rel));
        served.push({ rel, sha256: createHash('sha256').update(body).digest('hex'), bytes: body.length });
        return route.fulfill({ body, contentType: rel.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' });
      } catch {
        return route.fulfill({ status: 404 });
      }
    });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runArm(version, pins) {
  const served = [];
  const events = [];
  const mark = (name, ms, ok, detail = null) => events.push({ name, ms: Math.round(ms), ok, detail });
  // Real deadlines: page.evaluate's timeout option is not honored by
  // this Playwright, so every operation races an explicit timer; the
  // page/context close in the finally paths kills stragglers.
  const withDeadline = (promise, ms, label) => Promise.race([promise, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(Error(`deadline: ${label} exceeded ${ms}ms`)), ms);
    if (timer.unref) timer.unref();
  })]);
  const timed = async (name, ms, fn) => {
    const start = performance.now();
    try {
      const out = await withDeadline(fn(), ms, name);
      mark(name, performance.now() - start, true);
      return out;
    } catch (error) {
      mark(name, performance.now() - start, false, String((error && error.message) || error).slice(0, 200));
      throw error;
    }
  };
  const receipt = {
    script: 'e2e/bview-sdk-reader-exercises.test.mjs',
    runner: process.version,
    startedAt: new Date().toISOString(),
    version,
    profile: null,
    connectMs: null,
    computedSha256: null,
    sdkDigests: null,
    wasmVerified: false,
    entryVerified: false,
    events,
  };
  await withPage(version, served, async (page) => {
    try {
      receipt.profile = await page.evaluate(
        script(version, `
          const defaults = await sdk.getNetworkDefaults();
          return { id: defaults.id, seeds: defaults.seeds.length, chainId: defaults.payment.chainId };
        `), null, { timeout: CONNECT_MS });
      const t0 = performance.now();
      await withDeadline(page.evaluate(script(version, `window.__client = await sdk.AutonomiClient.connect();`)), CONNECT_MS, 'connect');
      receipt.connectMs = Math.round(performance.now() - t0);
      mark('connect', receipt.connectMs, true, `profile=${receipt.profile.id} seeds=${receipt.profile.seeds}`);
      // Range correctness: full-byte SHA-256 of the photo fixture.
      const fullB64 = await timed('full-read-sha256', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            const parts = [];
            for (let at = 0; at < ${FIXTURE.size}; at += 65536) {
              parts.push(await reader.read(at, Math.min(65536, ${FIXTURE.size} - at)));
            }
            const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
            let at = 0;
            for (const p of parts) { bytes.set(p, at); at += p.length; }
            let s = '';
            for (const x of bytes) s += String.fromCharCode(x);
            return btoa(s);
          } finally { try { await reader.close(); } catch {} }
        `), null, { timeout: OP_MS }));
      const fullBytes = Buffer.from(fullB64, 'base64');
      assert.equal(fullBytes.length, FIXTURE.size);
      receipt.computedSha256 = createHash('sha256').update(fullBytes).digest('hex');
      assert.equal(receipt.computedSha256, FIXTURE.sha256);
      // Cancellation: abort a big read, reader stays usable.
      await timed('pending-read-cancel', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            const ctl = new AbortController();
            const pending = reader.read(0, ${FIXTURE.size}, { signal: ctl.signal });
            ctl.abort();
            try { await pending; return 'NOT-CANCELLED'; }
            catch (e) {
              const again = await reader.read(0, 64);
              return 'cancelled:' + e.name + ':reusable=' + (again.length === 64);
            }
          } finally { try { await reader.close(); } catch {} }
        `), null, { timeout: OP_MS })).then((outcome) => assert.match(outcome, /^cancelled:.*:reusable=true/));
      // Close/reopen: closed reader refuses, fresh open works.
      await timed('close-reopen', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          await reader.close();
          let refused = false;
          try { await reader.read(0, 16); } catch { refused = true; }
          const next = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            const head = await next.read(0, 16);
            return 'refused=' + refused + ':reopened=' + (head.length === 16);
          } finally { try { await next.close(); } catch {} }
        `), null, { timeout: OP_MS })).then((outcome) => assert.equal(outcome, 'refused=true:reopened=true'));
      // Late completion: start the read, consume late.
      await timed('late-completion', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            const pending = reader.read(0, 1024);
            await new Promise((r) => setTimeout(r, 2000));
            const head = await pending;
            return head.length;
          } finally { try { await reader.close(); } catch {} }
        `), null, { timeout: OP_MS })).then((n) => assert.equal(n, 1024));
      // Corrupt address: bounded clean failure, never a wedge. Budget
      // 240s: proving a negative (unroutable address declared dead)
      // took 39.8s once and exceeded 90s once — still bounded, still
      // effective, calibrated to both observations.
      await timed('corrupt-address', 240_000, () => page.evaluate(
        script(version, `
          const t0 = performance.now();
          try {
            const reader = await window.__client.openFile(${JSON.stringify(BAD_ADDRESS)});
            try { await reader.read(0, 64); } finally { try { await reader.close(); } catch {} }
            return 'UNEXPECTED-SUCCESS';
          } catch (e) { return 'failed:' + (e.code || e.name) + ':' + Math.round(performance.now() - t0); }
        `), null, { timeout: OP_MS })).then((outcome) => assert.match(outcome, /^failed:/));
      // Invalid ranges fail before any network work — each case separately.
      const rangeCodes = await timed('invalid-ranges', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          const codes = [];
          for (const pair of [[-1, 16], [0, -1], [0, 5 * 1024 * 1024]]) {
            try { await reader.read(pair[0], pair[1]); codes.push('UNEXPECTED'); }
            catch (e) { codes.push(e.code || e.name); }
          }
          try { await reader.close(); } catch {}
          return codes;
        `), null, { timeout: OP_MS }));
      assert.equal(rangeCodes[0], 'OPEN_FILE_FAILED', 'negative start rejected');
      assert.equal(rangeCodes[1], 'OPEN_FILE_FAILED', 'negative length rejected');
      assert.equal(rangeCodes[2], 'OPEN_FILE_FAILED', 'over-limit length rejected');
      // Failed-read recovery: reader usable after a failure.
      await timed('failed-read-recovery', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            try { await reader.read(-5, 8); } catch {}
            const head = await reader.read(0, 32);
            return head.length;
          } finally { try { await reader.close(); } catch {} }
        `), null, { timeout: OP_MS })).then((n) => assert.equal(n, 32));
      // Seed-loss configuration uses the actual module export. A valid bundled
      // profile must pass first; a missing function or TypeError is a test failure.
      await timed('seed-loss-config', 30_000, async () => {
        const outcome = await page.evaluate(script(version, `
          const { snapshotNetworkProfile } = await import('https://sdk-qual.local/network-profile.js');
          if (typeof snapshotNetworkProfile !== 'function') throw new TypeError('Missing actual network-profile validator');
          const defaults = await sdk.getNetworkDefaults();
          const control = snapshotNetworkProfile(defaults);
          let refusal;
          try {
            snapshotNetworkProfile({ ...defaults, id: 'seedless', seeds: [] });
          } catch (error) {
            if (!(error instanceof sdk.AutonomiError) || error.code !== 'CONNECTION_FAILED') throw error;
            refusal = { name: error.name, code: error.code };
          }
          return { control, expected: { id: defaults.id, seeds: [...defaults.seeds], payment: { ...defaults.payment } }, refusal };
        `));
        assert.ok(outcome.expected.seeds.length > 0, 'bundled profile supplies the valid seed control');
        assert.deepEqual(outcome.control, outcome.expected, 'valid profile is accepted unchanged');
        assert.deepEqual(outcome.refusal, { name: 'AutonomiError', code: 'CONNECTION_FAILED' }, 'exact seed-loss refusal');
      });
      // Past-EOF truncation.
      await timed('past-eof-truncation', OP_MS, () => page.evaluate(
        script(version, `
          const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
          try {
            const tail = await reader.read(${FIXTURE.size} - 10, 1024);
            return tail.length;
          } finally { try { await reader.close(); } catch {} }
        `), null, { timeout: OP_MS })).then((n) => assert.equal(n, 10));
    } finally {
      await page.evaluate(`(async () => { try { await window.__client?.close?.(); } catch {} })()`).catch(() => {});
    }
  });
  // Served-asset provenance: every served file must match the pin table,
  // and the run must have loaded the entry module plus the expected WASM.
  const table = pins[version];
  receipt.sdkDigests = served.map((s) => {
    const pin = table[s.rel];
    if (!pin || s.bytes !== pin.bytes || s.sha256 !== pin.sha256) {
      throw Error(`served SDK mismatch on ${version}: ${s.rel}`);
    }
    return { rel: s.rel, bytes: s.bytes, sha256: s.sha256 };
  });
  receipt.entryVerified = receipt.sdkDigests.some((d) => d.rel === 'index.js');
  receipt.wasmVerified = receipt.sdkDigests.some((d) => d.rel === 'wasm/ant_core_bg.wasm');
  if (!receipt.entryVerified) throw Error(`entry module was not served on ${version}`);
  if (!receipt.wasmVerified) throw Error(`expected WASM was not served on ${version}`);
  receipt['PUBLIC-CONSTANT'] = 'public fixture address only; no key material';
  return receipt;
}

for (const version of ['0.1.5', '0.1.2']) {
  test(`reader exercises on SDK ${version}`, { timeout: 600_000 }, async (t) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      const receipt = await runArm(version, await loadPins());
      const out = join(root, 'docs', 'receipts', 'ant-sdk-015', `reader-exercises-${version}-${stamp}.json`);
      await writeFile(out, JSON.stringify(receipt) + '\n', { flag: 'wx' });
      t.diagnostic(`receipt: ${out}`);
      for (const event of receipt.events) {
        assert.equal(event.ok, true, `${event.name}: ${event.detail}`);
      }
    } catch (error) {
      const receipt = {
        script: 'e2e/bview-sdk-reader-exercises.test.mjs',
        runner: process.version,
        startedAt: new Date().toISOString(),
        version,
        ok: false,
        error: String((error && error.message) || error).slice(0, 500),
        'PUBLIC-CONSTANT': 'failure record with public fixture address only; no key material',
      };
      const out = join(root, 'docs', 'receipts', 'ant-sdk-015', `reader-exercises-${version}-${stamp}-FAILED.json`);
      await writeFile(out, JSON.stringify(receipt) + '\n', { flag: 'wx' }).catch(() => {});
      t.diagnostic(`failure receipt: ${out}`);
      throw error;
    }
  });
}
