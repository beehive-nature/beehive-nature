// Real H264/AAC decode; all network requests intercepted, no external load.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
let origin, media;
let browser, server, port, certificateDir;
before(async () => {
  // Ephemeral local TLS only. No private key is printed, checked in or reused.
  certificateDir = await mkdtemp(resolve(tmpdir(), 'bview-tls-'));
  const key = resolve(certificateDir, 'key.pem'), cert = resolve(certificateDir, 'cert.pem');
  execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore', windowsHide: true });
  server = createServer({ key: await readFile(key), cert: await readFile(cert) }, async (req, res) => {
    const u = new URL(req.url, 'https://localhost');
    const path = u.pathname.replace(/^\/media/, '');
    if (!/^\/v(240|360)\/segment-\d{5}\.m4s$/.test(path)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(resolve(root, 'fixtures/bview/adaptive' + path));
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': data.length, 'access-control-allow-origin': '*' });
    res.flushHeaders();
    for (let at = 0; at < data.length && !res.destroyed; at += 16384) {
      res.write(data.subarray(at, at + 16384));
      await new Promise(r => setTimeout(r, 16384 * 8 / 700)); // 700 kb/s body, not delayed headers
    }
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port;
  origin = `https://127.0.0.1:${port}`; media = origin + '/media/';
  browser = await chromium.launch({ channel: process.env.BVIEW_BROWSER_CHANNEL || 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(r => server.close(r));
  if (certificateDir) { await unlink(resolve(certificateDir, 'key.pem')); await unlink(resolve(certificateDir, 'cert.pem')); await rmdir(certificateDir); }
});
async function open({ broken = false, slow = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage(), errors = [], hits = [], stray = [];
  page.on('requestfailed', request => console.log('# request failure ' + request.failure()?.errorText));
  page.on('console', msg => { if (msg.type() === 'error') console.log('# browser ' + msg.text().slice(0, 400)); });
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (!u.href.startsWith(origin) && !u.href.startsWith(media)) { stray.push(u.href); return route.abort(); }
    const isMedia = u.href.startsWith(media), path = isMedia ? 'fixtures/bview/adaptive' + u.pathname.slice('/media'.length) : u.pathname.slice(1);
    if (isMedia) {
      hits.push({ path: u.pathname, at: Date.now() });
      if (broken && u.pathname.endsWith('.m3u8')) return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } });
    }
    try {
      if (slow && isMedia && u.pathname.endsWith('.m4s')) return route.continue();
      const data = await readFile(resolve(root, path));
      await route.fulfill({ status: 200, body: data, contentType: u.pathname.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : u.pathname.endsWith('.js') ? 'text/javascript' : u.pathname.endsWith('.html') ? 'text/html' : u.pathname.endsWith('.css') ? 'text/css' : 'video/mp4', headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
    } catch { await route.fulfill({ status: 404 }); }
  });
  await page.goto(origin + '/surfaces/bview.html');
  assert.equal(await page.evaluate(() => !!window.Hls), false, 'ordinary visits do not load the adaptive library');
  return { context, page, errors, hits, stray, setSlow: value => { slow = value; } };
}
async function watch(page) { await page.fill('#addr', media + 'master.m3u8'); await page.locator('#f button').click(); }
const snapshot = page => page.evaluate(() => window.__bviewEngine());

test('adaptive route decodes, upgrades, evicts old buffers, seeks and completes without file copies', { timeout: 80000 }, async () => {
  const { context, page, errors, hits, stray } = await open();
  try {
    await watch(page);
    await page.waitForFunction(() => document.getElementById('v').currentTime > 1, null, { timeout: 20000 });
    const first = await snapshot(page);
    assert.equal(first.source.kind, 'https'); assert.equal(first.adaptive.mode, 'mse');
    assert.equal(first.direct, null); assert.equal(first.sha, null);
    assert.ok(first.playStartMs > 0); assert.ok(first.ttffMs > 0);
    assert.ok(first.ttfbMs > 0 && first.ttfbMs <= first.ttffMs);
    assert.ok(first.adaptive.mediaBytes > 200000, 'transferred-to-worker segments retain byte receipts');
    assert.ok(hits.find(x => /v240\/segment/.test(x.path)), 'starts at the smallest rendition');
    await page.evaluate(() => { document.getElementById('v').playbackRate = 2; });
    await page.waitForFunction(() => document.getElementById('v').currentTime > 29, null, { timeout: 25000 });
    const middle = await snapshot(page);
    assert.ok(middle.adaptive.switches > 0, 'measured fast delivery upgrades quality');
    assert.ok(middle.video.buffered[0][0] >= 8, 'old media has been evicted');
    assert.ok(middle.video.ahead <= 25, 'forward target plus one 4-second segment');
    await page.evaluate(() => { const v = document.getElementById('v'); v.currentTime = 10; });
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v.currentTime > 11 && v.currentTime < 15; });
    await page.waitForFunction(() => document.getElementById('v').ended, null, { timeout: 25000 });
    const final = await snapshot(page);
    assert.ok(final.playhead >= 47.5); assert.equal(final.video.srcChanges, 1);
    assert.equal(final.fail, false); assert.equal(final.adaptive.errors, 0);
    assert.equal(await page.locator('#saved-videos li').count(), 0, 'remote playlist URLs are not saved as Autonomi addresses');
    assert.deepEqual(errors, []); assert.deepEqual(stray, []);
    const receipt = { browser: browser.version(), boundary: 'one browser; intercepted local fixture; no external capacity test', first, middle, final, requests: hits.length };
    console.log('# adaptive receipt ' + JSON.stringify(receipt));
    if (process.env.BVIEW_SCALE_RECEIPT) await writeFile(process.env.BVIEW_SCALE_RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
  } finally { await context.close(); }
});

test('paused and cancelled streams stop demand; replacement ignores old callbacks', { timeout: 30000 }, async () => {
  const { context, page, errors, hits, stray } = await open({ slow: true });
  try {
    await watch(page); await page.waitForFunction(() => document.getElementById('v').currentTime > 1, null, { timeout: 20000 });
    await page.evaluate(() => document.getElementById('v').pause());
    await page.waitForTimeout(500); const pausedRequests = hits.length;
    await page.waitForTimeout(2200); assert.equal(hits.length, pausedRequests, 'paused playback does not keep fetching');
    await page.fill('#addr', 'bad'); await page.locator('#f button').click();
    const cancelledRequests = hits.length; await page.waitForTimeout(2200);
    assert.equal(hits.length, cancelledRequests); assert.equal((await snapshot(page)).adaptive, null);
    assert.deepEqual(errors, []); assert.deepEqual(stray, []);
  } finally { await context.close(); }
});

test('quality falls when measured segment delivery slows', { timeout: 60000 }, async () => {
  const { context, page, setSlow, errors, stray } = await open();
  try {
    await watch(page);
    await page.waitForFunction(() => window.__bviewEngine().adaptive?.level === 1, null, { timeout: 20000 });
    setSlow(true);
    // Leave seven segments for the throughput estimator; three tail segments can
    // finish downloading before a conservative EWMA has enough evidence to switch.
    await page.evaluate(() => { document.getElementById('v').currentTime = 20; });
    await page.waitForFunction(() => { const e = window.__bviewEngine(); return e.adaptive?.level === 0 && e.adaptive.switches >= 2; }, null, { timeout: 35000 });
    assert.ok((await snapshot(page)).adaptive.bandwidth < 2000000);
    await page.waitForFunction(() => document.getElementById('v').ended, null, { timeout: 20000 });
    assert.deepEqual(errors, []); assert.deepEqual(stray, []);
  } finally { await context.close(); }
});

test('unavailable playlist has bounded retries and an actionable failure', { timeout: 20000 }, async () => {
  const { context, page, errors, hits, stray } = await open({ broken: true });
  try {
    await watch(page); await page.waitForFunction(() => window.__bviewEngine().fail, null, { timeout: 12000 });
    assert.ok(hits.length >= 1 && hits.length <= 3, `bounded requests: ${hits.length}`);
    const count = hits.length; await page.waitForTimeout(2500); assert.equal(hits.length, count);
    assert.deepEqual(errors, []); assert.deepEqual(stray, []);
  } finally { await context.close(); }
});
