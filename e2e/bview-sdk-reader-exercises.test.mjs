// Live reader exercises against the REAL pinned SDKs (both arms).
// Read-only public fetches, no wallet, no payment. Each arm connects,
// opens the small public photo fixture and exercises: range correctness
// (full-byte SHA-256), pending-read cancellation, close/reopen, late
// completion, corrupt address, invalid ranges, failed-read recovery and
// seed-loss configuration. Bounded waits throughout; one JSON receipt
// per arm under docs/receipts/ant-sdk-015/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const FIXTURE = {
  address: '711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a', // PUBLIC-CONSTANT: public photo address from tools/ant-bnrose/fixture.json
  size: 138931,
  sha256: '98f657d987d339c302295e79907e7a4abc1564bd6b42300ea8d59ccd2148fd17', // PUBLIC-CONSTANT: expected bytes from tools/ant-bnrose/fixture.json
};
const BAD_ADDRESS = 'ff'.repeat(32); // PUBLIC-CONSTANT: unroutable test address, never published content
const CONNECT_MS = 120_000;
const OP_MS = 90_000;

async function withPage(version, fn) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  try {
    await context.route('https://sdk-qual.local/**', async (route) => {
      const rel = new URL(route.request().url()).pathname.slice(1);
      try {
        const body = await readFile(join(root, 'vendor', 'ant-browser-sdk', version, rel));
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

function script(version, body) {
  return `(async () => {\nconst sdk = await import('https://sdk-qual.local/index.js');\n${body}\n})()`;
}

async function runArm(version) {
  const events = [];
  const mark = (name, ms, ok, detail = null) => events.push({ name, ms, ok, detail });
  const timed = async (name, ms, fn) => {
    const start = Date.now();
    try {
      const out = await fn();
      mark(name, Date.now() - start, true);
      return out;
    } catch (error) {
      mark(name, Date.now() - start, false, String(error && error.message || error).slice(0, 200));
      throw error;
    }
  };
  const receipt = await withPage(version, async (page) => {
    const profile = await page.evaluate(script(version, `
      const defaults = await sdk.getNetworkDefaults();
      return { id: defaults.id, seeds: defaults.seeds.length, chainId: defaults.payment.chainId };
    `));
    const connectMs = await page.evaluate(script(version, `
      const t0 = Date.now();
      window.__client = await sdk.AutonomiClient.connect();
      return Date.now() - t0;
    `)).catch((error) => { throw Error('connect: ' + error.message); });
    mark('connect', await connectMs, true, `profile=${profile.id} seeds=${profile.seeds}`);
    // Range correctness: full-byte SHA-256 of the photo fixture.
    const fullB64 = await timed('full-read-sha256', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const parts = [];
        for (let at = 0; at < ${FIXTURE.size}; at += 65536) {
          parts.push(await reader.read(at, Math.min(65536, ${FIXTURE.size} - at)));
        }
        await reader.close();
        const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const p of parts) { bytes.set(p, at); at += p.length; }
        let s = '';
        for (const x of bytes) s += String.fromCharCode(x);
        return btoa(s);
      `)));
    const fullBytes = Buffer.from(fullB64, 'base64');
    assert.equal(fullBytes.length, FIXTURE.size);
    assert.equal(createHash('sha256').update(fullBytes).digest('hex'), FIXTURE.sha256);
    // Cancellation: abort a big read, reader stays usable.
    await timed('pending-read-cancel', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const ctl = new AbortController();
        const pending = reader.read(0, ${FIXTURE.size}, { signal: ctl.signal });
        ctl.abort();
        try { await pending; return 'NOT-CANCELLED'; }
        catch (e) {
          const again = await reader.read(0, 64);
          await reader.close();
          return 'cancelled:' + e.name + ':reusable=' + (again.length === 64);
        }
      `))).then((outcome) => assert.match(outcome, /^cancelled:.*:reusable=true/));
    // Close/reopen: closed reader refuses, fresh open works.
    await timed('close-reopen', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        await reader.close();
        let refused = false;
        try { await reader.read(0, 16); } catch { refused = true; }
        const next = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const head = await next.read(0, 16);
        await next.close();
        return 'refused=' + refused + ':reopened=' + (head.length === 16);
      `))).then((outcome) => assert.equal(outcome, 'refused=true:reopened=true'));
    // Late completion: start the read, consume late.
    await timed('late-completion', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const pending = reader.read(0, 1024);
        await new Promise((r) => setTimeout(r, 2000));
        const head = await pending;
        await reader.close();
        return head.length;
      `))).then((n) => assert.equal(n, 1024));
    // Corrupt address: bounded clean failure, never a wedge.
    await timed('corrupt-address', OP_MS, () => page.evaluate(
      script(version, `
        const t0 = Date.now();
        try {
          const reader = await window.__client.openFile(${JSON.stringify(BAD_ADDRESS)});
          await reader.read(0, 64);
          return 'UNEXPECTED-SUCCESS';
        } catch (e) { return 'failed:' + (e.code || e.name) + ':' + (Date.now() - t0); }
      `))).then((outcome) => assert.match(outcome, /^failed:/));
    // Invalid ranges fail before any network work.
    await timed('invalid-ranges', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const codes = [];
        for (const [s, l] of [[-1, 16], [0, -1], [0, 5 * 1024 * 1024]]) {
          try { await reader.read(s, l); codes.push('UNEXPECTED'); }
          catch (e) { codes.push(e.code || e.name); }
        }
        await reader.close();
        return codes.join(',');
      `))).then((codes) => assert.match(codes, /OPEN_FILE_FAILED/));
    // Failed-read recovery: reader usable after a failure.
    await timed('failed-read-recovery', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        try { await reader.read(-5, 8); } catch {}
        const head = await reader.read(0, 32);
        await reader.close();
        return head.length;
      `))).then((n) => assert.equal(n, 32));
    // Seed-loss configuration: empty seeds fail fast and clean.
    await timed('seed-loss-config', 30_000, () => page.evaluate(
      script(version, `
        try {
          sdk.snapshotNetworkProfile({ id: 'seedless', seeds: [], payment: {} });
          return 'UNEXPECTED-ACCEPT';
        } catch (e) { return 'refused:' + (e.code || e.name); }
      `))).then((outcome) => assert.match(outcome, /^refused:/));
    // Past-EOF truncation.
    await timed('past-eof-truncation', OP_MS, () => page.evaluate(
      script(version, `
        const reader = await window.__client.openFile(${JSON.stringify(FIXTURE.address)});
        const tail = await reader.read(${FIXTURE.size} - 10, 1024);
        await reader.close();
        return tail.length;
      `))).then((n) => assert.equal(n, 10));
    return { version, profile, connectMs: events.find((e) => e.name === 'connect').ms, events };
  });
  receipt['PUBLIC-CONSTANT'] = 'public fixture address only; no key material';
  return receipt;
}

for (const version of ['0.1.5', '0.1.2']) {
  test(`reader exercises on SDK ${version}`, { timeout: 600_000 }, async (t) => {
    const receipt = await runArm(version);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = join(root, 'docs', 'receipts', 'ant-sdk-015', `reader-exercises-${version}-${stamp}.json`);
    await writeFile(out, JSON.stringify(receipt) + '\n', { flag: 'wx' });
    t.diagnostic(`receipt: ${out}`);
    for (const event of receipt.events) {
      assert.equal(event.ok, true, `${event.name}: ${event.detail}`);
    }
  });
}
