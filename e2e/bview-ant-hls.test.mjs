// Production-origin source interception; real H264/AAC; SDK storage is a fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packDirectory } from '../tools/autonomous-delivery/pack.mjs';
const root = resolve(import.meta.dirname, '..');
const bundle = 'd020828d0f3feca7123581fb71ed00c2d37350ff3eb3a3f88f5c068aa284e8af'; // PUBLIC-CONSTANT
const address = 'ab'.repeat(32); // Fixture address, never a published ANT address.
const sourceAddress = '7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78'; // PUBLIC-CONSTANT
const { bytes, receipt } = await packDirectory(resolve(root, 'media/bview', bundle), sourceAddress);
const sdk = `export class AutonomiClient { static async connect() { window.fixtureConnections=(window.fixtureConnections||0)+1; return { close(){}, async openFile(){window.fixtureOpens=(window.fixtureOpens||0)+1;return {size:${bytes.length},close(){},async read(start,length,{signal}){if(signal.aborted)throw new DOMException('Cancelled','AbortError');const raw=await window.fixtureRange({start,length});return Uint8Array.from(atob(raw),c=>c.charCodeAt(0));}}}} } }`;
test('ANT pack: actual video decodes, seeks and ends using one reader and no media host', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ranges = [], stray = [], errors = [];
  try {
    await context.exposeBinding('fixtureRange', async (_, range) => { ranges.push(range); return bytes.subarray(range.start, range.start + range.length).toString('base64'); });
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin !== 'https://skaists.dev' || u.pathname.startsWith('/media/')) { stray.push(u.href); return route.abort(); }
      if (u.pathname === '/vendor/ant-browser-sdk/0.1.2/index.js') return route.fulfill({ body: sdk, contentType: 'text/javascript' });
      try { const data = await readFile(resolve(root, '.' + u.pathname)); return route.fulfill({ body: data, contentType: /\.m?js$/.test(u.pathname) ? 'text/javascript' : u.pathname.endsWith('.html') ? 'text/html' : u.pathname.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404 }); }
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://skaists.dev/surfaces/bview.html#' + encodeURIComponent('ant-hls://' + address));
    await page.waitForFunction(() => document.querySelector('#v').currentTime > 1, null, { timeout: 20000 });
    const first = await page.evaluate(() => window.__bviewEngine());
    assert.equal(first.path, 'ant-hls'); assert.equal(first.adaptive.transport, 'autonomi'); assert.equal(first.source.kind, 'direct');
    await page.evaluate(() => { document.querySelector('#v').playbackRate = 2; });
    await page.waitForFunction(() => document.querySelector('#v').ended, null, { timeout: 35000 });
    const complete = await page.evaluate(() => window.__bviewEngine());
    assert.equal(complete.stalls, 0); assert.equal(complete.adaptive.errors, 0);
    await page.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 30; });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const v = document.querySelector('#v'); v.playbackRate = 2; return v.play(); });
    await page.waitForFunction(() => document.querySelector('#v').currentTime > 32, null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#v').ended, null, { timeout: 20000 });
    const final = await page.evaluate(() => window.__bviewEngine());
    assert.equal(final.fail, false); assert.equal(final.adaptive.errors, 0);
    assert.equal(final.adaptive.delivery.opens, 1); assert.equal(await page.evaluate(() => window.fixtureOpens), 1);
    assert.equal(final.adaptive.delivery.paid, false); assert.ok(final.adaptive.delivery.peakConcurrent <= 3);
    assert.ok(final.adaptive.delivery.cacheBytes <= 24 * 1024 * 1024); assert.deepEqual(errors, []); assert.deepEqual(stray, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const output = { schema: 'bview-ant-hls-browser/1', constant: 'PUBLIC-CONSTANT',
      boundary: 'actual video decoded in Chrome at 390px; simulated ANT reads, no payment, public upload or live capacity claim',
      browser: browser.version(), pack: receipt, first, complete, final, reads: ranges.length };
    if (process.env.BVIEW_ANT_RECEIPT) await writeFile(process.env.BVIEW_ANT_RECEIPT, JSON.stringify(output) + '\n');
    console.log(JSON.stringify({ firstFrameMs: first.ttffMs, readBytes: final.adaptive.delivery.readBytes, opens: final.adaptive.delivery.opens, errors: final.adaptive.errors }));
  } finally { await context.close(); await browser.close(); }
});
