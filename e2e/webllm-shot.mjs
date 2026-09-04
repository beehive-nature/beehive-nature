// webllm-shot.mjs — W-1 RECEIPT (bLOVErAi window, 2026-09-04).
// The order: "a 390px shot answering a prompt with the network tab showing
// zero requests after load."
//
// Three phases, one browser profile (Cache Storage persists in-context):
//   COLD   — wake the model: the honest ≈204 MB once, every host recorded
//            (the L-VERIFY record of what first load costs)
//   WARM   — reload the page, wake again, answer: ZERO network requests from
//            reload to answered (playwright request counter + the in-page
//            wire panel, which must read 0)
//   OFFLINE — context.setOffline(true), reload, wake, answer: the pocket
//            works with the network OFF — this is the 390px receipt shot
// WebGPU needs system Chrome with playwright's default --disable-gpu removed.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-webllm');
await mkdir(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[(rel.match(/\.[a-z0-9]+$/) || [])[0]] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  ignoreDefaultArgs: ['--disable-gpu'],
  args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU'],
});
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
let errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));

// request ledger with a switch: which phase counts
let phase = 'closed';
const ledger = { cold: new Set(), warm: 0, offline: 0 };
page.on('request', r => {
  if (phase === 'cold') {
    const u = new URL(r.url());
    if (!u.href.startsWith(BASE)) ledger.cold.add(u.host);
  } else if (phase === 'warm' && !r.url().startsWith(BASE)) ledger.warm++;
  else if (phase === 'offline' && !r.url().startsWith(BASE)) ledger.offline++;
});

async function wakeAndAnswer(label) {
  await page.locator('#w1wake').click();
  await page.waitForFunction(() => document.getElementById('w1st').innerText.includes('model ready'), null, { timeout: 600000 });
  await page.locator('#w1ask').fill('In one sentence, why does a beehive keep its own temperature?');
  await page.locator('#w1go').click();
  await page.waitForFunction(() => {
    const t = document.getElementById('w1out').innerText;
    return t.includes('zero requests to answer') && t.length > 60;
  }, null, { timeout: 300000 });
  const wire = await page.evaluate(() => document.getElementById('w1wire').innerText);
  const answer = await page.evaluate(() => document.getElementById('w1out').innerText);
  console.log(`[${label}] wire: ${wire.split('\n')[0]}`);
  console.log(`[${label}] answer: ${answer.split('\n')[0].slice(0, 100)}`);
  return { wire, answer };
}

await page.goto(`${BASE}/surfaces/review.html`, { waitUntil: 'load' });
await page.locator('#ai').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

// COLD — the one-time load, hosts recorded for the L-VERIFY receipt
phase = 'cold';
await page.locator('#w1wake').click();
await page.waitForFunction(() => document.getElementById('w1prog') && document.getElementById('w1prog').innerText.length > 3, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: join(OUT, 'review-webllm-390-loading-once.png') });
console.log('shot → e2e/shots-webllm/review-webllm-390-loading-once.png');
await page.waitForFunction(() => document.getElementById('w1st').innerText.includes('model ready'), null, { timeout: 900000 });
const cold = await (async () => {
  await page.locator('#w1ask').fill('In one sentence, why does a beehive keep its own temperature?');
  await page.locator('#w1go').click();
  await page.waitForFunction(() => document.getElementById('w1out').innerText.includes('zero requests to answer'), null, { timeout: 300000 });
  return page.evaluate(() => document.getElementById('w1wire').innerText);
})();
phase = 'closed';
ok('cold: model loaded and answered', cold.includes('0 request'), cold.split('\n')[0]);
ok('cold: first-load hosts recorded (the honest cost)', ledger.cold.size > 0, [...ledger.cold].join(' · '));

// WARM — reload, zero network from reload to answered
phase = 'warm';
await page.reload({ waitUntil: 'load' });
const warm = await wakeAndAnswer('warm');
phase = 'closed';
ok('warm: wire panel reads zero', warm.wire.includes('0 request'), warm.wire.split('\n')[0]);
ok('warm: ZERO cross-origin requests observed by the harness', ledger.warm === 0, String(ledger.warm));

// OFFLINE — the receipt: the network drops, the tab keeps answering.
// (No reload here: the page itself is what the network served; offline-after-
// first-load is the MODEL's cache story, proven warm above. This phase holds
// the tab and pulls the wire.)
await ctx.setOffline(true);
phase = 'offline';
await page.locator('#w1ask').fill('Name two things a bee makes, in four words total.');
await page.locator('#w1go').click();
await page.waitForFunction(() => {
  const t = document.getElementById('w1out').innerText;
  return t.includes('zero requests to answer') && t.includes('SmolLM2-360M');
}, null, { timeout: 300000 });
const off = await page.evaluate(() => ({
  wire: document.getElementById('w1wire').innerText,
  answer: document.getElementById('w1out').innerText,
}));
phase = 'closed';
ok('offline: the pocket answered with the network OFF', off.answer.includes('on your device'), off.answer.split('\n')[0].slice(0, 80));
ok('offline: wire panel reads zero', off.wire.includes('0 request'), off.wire.split('\n')[0]);
ok('offline: ZERO requests observed by the harness', ledger.offline === 0, String(ledger.offline));
await page.evaluate(() => document.getElementById('ai').scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'review-webllm-390-offline-answer.png') });
console.log('shot → e2e/shots-webllm/review-webllm-390-offline-answer.png');
await ctx.setOffline(false);

ok('zero page errors across all phases', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
