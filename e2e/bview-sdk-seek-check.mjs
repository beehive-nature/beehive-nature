// Bounded matched seek check on both pinned SDK arms (live network).
// Same corpus, direct-only route, defined forward/backward targets.
// Records decoded-frame recovery, integrity, transport snapshot and
// failures without converting the outcome into a speed claim.
// Usage: node e2e/bview-sdk-seek-check.mjs --sdk 0.1.2|0.1.5 --out <receipt> [--fwd 200 --bwd 10]
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadPins, htmlWithSdk } from '../tools/video-trial/sdk-qualification.mjs';

const { values } = parseArgs({ options: {
  sdk: { type: 'string' }, out: { type: 'string' }, corpus: { type: 'string' },
  fwd: { type: 'string', default: '200' }, bwd: { type: 'string', default: '10' },
} });
if (!['0.1.2', '0.1.5'].includes(values.sdk)) throw Error('Provide --sdk 0.1.2 or 0.1.5');
if (!values.out) throw Error('Provide --out');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://skaists.dev/surfaces/bview.html';
const corpus = JSON.parse(await readFile(values.corpus ? resolve(values.corpus) : join(repoRoot, 'tools', 'video-trial', 'corpus-2026-10-09.json'), 'utf8'));
const fixture = corpus.files[0];
const output = resolve(values.out);
const fwdTarget = Number(values.fwd), bwdTarget = Number(values.bwd);
if (!fixture || !/^[0-9a-f]{64}$/i.test(fixture.address) || !/^[0-9a-f]{64}$/i.test(fixture.sha256)) throw Error('Corpus requires a public address and expected SHA256');
const pins = await loadPins();
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const sdkServed = [];
const receipt = {
  script: 'e2e/bview-sdk-seek-check.mjs',
  runner: process.version,
  startedAt: new Date().toISOString(),
  sdk: values.sdk,
  route: 'direct-only',
  fwdTarget,
  bwdTarget,
  fixture: { size: fixture.size },
  sdkVerified: false,
  ok: false,
  error: null,
  'PUBLIC-CONSTANT': 'public artifact digests only; no key material',
};
async function bank() {
  await writeFile(output, JSON.stringify(receipt) + '\n', { flag: 'wx' }).catch(() => {});
}
try {
  await context.route('https://skaists.dev/vendor/ant-browser-sdk/**', async (r) => {
    const pathname = new URL(r.request().url()).pathname;
    const match = pathname.match(/^\/vendor\/ant-browser-sdk\/([^/]+)\/(.+)$/);
    if (!match || match[1] !== values.sdk) throw Error(`refusing SDK ${pathname}: arm selects ${values.sdk}`);
    const body = await readFile(join(repoRoot, 'vendor', 'ant-browser-sdk', values.sdk, match[2]));
    sdkServed.push({ rel: match[2], bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
    await r.fulfill({ status: 200, contentType: match[2].endsWith('.wasm') ? 'application/wasm' : 'text/javascript', body });
  });
  await context.route(origin, async (r) => {
    const upstream = await r.fetch();
    await r.fulfill({ status: upstream.status(), contentType: 'text/html', body: htmlWithSdk(await upstream.text(), values.sdk) });
  });
  page.on('pageerror', (e) => { receipt.pageErrors = [...(receipt.pageErrors || []), String(e.message).slice(0, 200)]; });
  await page.goto(origin);
  await page.selectOption('#playback-route', 'direct-only');
  await page.fill('#addr', fixture.address);
  await page.click('button[type=submit]');
  const t0 = performance.now();
  await page.waitForFunction(() => { const e = window.__bviewEngine(); return e.playhead > 15; }, null, { timeout: 420_000 });
  receipt.playStartMs = Math.round(performance.now() - t0);
  const snap = () => page.evaluate(() => {
    const e = window.__bviewEngine();
    const v = document.querySelector('#v');
    const t = window.__antTransport ? window.__antTransport.snapshot() : null;
    return {
      playhead: e.playhead, stalls: e.stalls,
      videoTime: v ? v.currentTime : null, bytes: e.bytes, dials: t ? t.dials : null,
    };
  });
  const before = await snap();
  receipt.preSeek = before;
  // Forward seek: defined target near the end.
  const fwd0 = performance.now();
  await page.evaluate((t) => { document.querySelector('#v').currentTime = t; }, fwdTarget);
  await page.waitForFunction((t) => { const v = document.querySelector('#v'); return v.currentTime > t && !v.seeking; }, fwdTarget, { timeout: 120_000 });
  receipt.fwdRecoveryMs = Math.round(performance.now() - fwd0);
  // Backward seek: defined target near the start.
  const bwd0 = performance.now();
  await page.evaluate((t) => { document.querySelector('#v').currentTime = t; }, bwdTarget);
  await page.waitForFunction((t) => { const v = document.querySelector('#v'); return v.currentTime > t && v.currentTime < t + 20 && !v.seeking; }, bwdTarget, { timeout: 120_000 });
  receipt.bwdRecoveryMs = Math.round(performance.now() - bwd0);
  const after = await page.evaluate(() => {
    const e = window.__bviewEngine();
    const v = document.querySelector('#v');
    const t = window.__antTransport ? window.__antTransport.snapshot() : null;
    return { playhead: e.playhead, sha: e.sha, stalls: e.stalls, bytes: e.bytes, dials: t ? t.dials : null, width: v ? v.videoWidth : null };
  });
  receipt.postSeek = { playhead: after.playhead, stalls: after.stalls, bytes: after.bytes, dials: after.dials, videoWidth: after.width };
  // Integrity is only knowable at full completion: play through to the end.
  await page.waitForFunction(() => {
    const e = window.__bviewEngine();
    return e.video && e.video.ended === true && e.playhead >= e.video.duration - 0.5;
  }, null, { timeout: 420_000 });
  const done = await page.evaluate(() => {
    const e = window.__bviewEngine();
    return { sha: e.sha, stalls: e.stalls, bytes: e.bytes };
  });
  receipt.postSeek = { playhead: after.playhead, stalls: done.stalls, bytes: done.bytes, dials: after.dials, videoWidth: after.width };
  receipt.integrityAfterSeek = done.sha === fixture.sha256;
  receipt.stallDelta = after.stalls - (before.stalls || 0);
  const table = pins[values.sdk];
  for (const s of sdkServed) {
    const pin = table[s.rel];
    if (!pin || s.bytes !== pin.bytes || s.sha256 !== pin.sha256) throw Error(`served SDK mismatch: ${s.rel}`);
  }
  receipt.sdkDigests = sdkServed;
  receipt.sdkVerified = sdkServed.some((s) => s.rel === 'index.js') && sdkServed.some((s) => s.rel === 'wasm/ant_core_bg.wasm');
  if (!receipt.sdkVerified) throw Error('entry module or expected WASM was not served');
  receipt.ok = receipt.integrityAfterSeek === true && (receipt.pageErrors || []).length === 0;
  await bank();
  console.log(JSON.stringify({ output, ok: receipt.ok, fwdRecoveryMs: receipt.fwdRecoveryMs, bwdRecoveryMs: receipt.bwdRecoveryMs, integrityAfterSeek: receipt.integrityAfterSeek }));
  if (!receipt.ok) process.exitCode = 1;
} catch (error) {
  receipt.error = String((error && error.message) || error).slice(0, 300);
  await bank();
  throw error;
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
