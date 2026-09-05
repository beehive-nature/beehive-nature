// local-agent-shot.mjs — ORDER B RECEIPT (the local agent, z3.2, 2026-09-05).
// The order's gate: "the page answers a prompt with the network tab showing
// only estate rails; no-page-errors gate; register via surface-count.mjs."
// Proven three ways, one system-Chrome profile (W-1's WebGPU recipe):
//   COLD  — wake, answer: EVERY host the tab touched is counted and must be
//           estate (the test origin + relay.skaists.dev); HuggingFace,
//           jsdelivr or githubusercontent anywhere = FAIL. The SRI census
//           must show every fetched artifact VERIFIED (refused = 0).
//   WARM  — reload, wake, answer: the SW cache carries it; ZERO requests to
//           the estate door from reload to answered.
//   OFFLINE — the network drops, the tab keeps answering.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-local-agent');
await mkdir(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));

/* the harness's own network tab — every request, every host, by phase */
let phase = 'closed';
const hosts = { cold: new Set(), warm: new Set(), offline: new Set() };
page.on('request', r => {
  if (phase === 'closed') return;
  try { hosts[phase].add(new URL(r.url()).host); } catch {}
});

await page.goto(`${BASE}/surfaces/local-agent/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(500);

/* the route fork must have picked local on this WebGPU machine */
const route = await page.evaluate(() => window.__localAgent.route);
ok('route A chosen on a WebGPU machine (the fallback stays for the rest)', route === 'local', String(route));

/* COLD — the one-time load: estate rails ONLY, SRI all verified, an answer */
phase = 'cold';
await page.locator('#wake').click();
await page.waitForFunction(() => {
  const b = document.getElementById('wake');
  return b && (b.innerText.includes('awake') || b.innerText.includes('try again'));
}, null, { timeout: 1500000 });
const wakeText = await page.locator('#wake').innerText();
if (!wakeText.includes('awake')) {
  const why = await page.evaluate(() => document.getElementById('answer').innerText);
  console.log('[cold] WAKE FAILED: ' + why.slice(0, 300));
}
ok('cold: the mind woke from the estate door', wakeText.includes('awake'), wakeText.slice(0, 60));
await page.waitForFunction(() => {
  const a = document.getElementById('answer');
  return a && a.classList.contains('show') && a.innerText.length > 40;
}, null, { timeout: 300000 });
const coldAnswer = await page.evaluate(() => document.getElementById('answer').innerText);
console.log('[cold] answer: ' + coldAnswer.split('\n')[0].slice(0, 110));
ok('cold: the page ANSWERED a prompt', coldAnswer.length > 40 && !/refused|unreadable/i.test(coldAnswer), coldAnswer.slice(0, 60));

const banned = [...hosts.cold].filter(h => /huggingface|jsdelivr|githubusercontent/i.test(h));
ok('cold: ZERO banned hosts (hf · jsdelivr · githubusercontent)', banned.length === 0, banned.join(' | ') || 'none');
const foreign = [...hosts.cold].filter(h => h !== 'relay.skaists.dev' && !h.startsWith('127.0.0.1'));
ok('cold: every host is an estate rail', foreign.length === 0, [...hosts.cold].join(' · '));

await page.waitForTimeout(800);
const sri = await page.evaluate(() => window.__localAgent.sriCensus);
ok('cold: the SRI gate verified every fetched artifact (refused = 0)',
  !!sri && sri.refused === 0 && sri.verified >= 8, JSON.stringify(sri));
const wireCold = await page.evaluate(() => window.__localAgent.wireState);
ok('cold: the in-page wire agrees — estate rails only', wireCold && wireCold.estateOnly, (wireCold && wireCold.hosts || []).join(' · '));
await page.screenshot({ path: join(OUT, 'local-agent-390-cold-answer.png'), fullPage: false });
console.log('shot → e2e/shots-local-agent/local-agent-390-cold-answer.png');
phase = 'closed';

/* WARM — reload, wake, answer: the door is NOT touched again */
phase = 'warm';
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(600);
await page.locator('#wake').click();
await page.waitForFunction(() => {
  const a = document.getElementById('answer');
  return a && a.classList.contains('show') && a.innerText.length > 40;
}, null, { timeout: 600000 });
const warmAnswer = await page.evaluate(() => document.getElementById('answer').innerText);
console.log('[warm] answer: ' + warmAnswer.split('\n')[0].slice(0, 90));
ok('warm: answered after reload', warmAnswer.length > 40, warmAnswer.slice(0, 50));
ok('warm: the estate door was NOT touched again (SW cache carries the mind)',
  !hosts.warm.has('relay.skaists.dev'), [...hosts.warm].join(' · ') || 'no hosts');
phase = 'closed';

/* OFFLINE — the network drops, the tab keeps answering */
await ctx.setOffline(true);
phase = 'offline';
await page.locator('#prompt').fill('name two things a bee makes, in four words.');
await page.locator('#wake').click();          /* awake already → re-ask path */
await page.waitForFunction(() => {
  const a = document.getElementById('answer');
  return a && a.innerText.length > 40 && !/did not wake|refused/i.test(a.innerText);
}, null, { timeout: 300000 });
const offAnswer = await page.evaluate(() => document.getElementById('answer').innerText);
ok('offline: the tab answered with the network OFF', offAnswer.length > 40, offAnswer.split('\n')[0].slice(0, 70));
phase = 'closed';
await ctx.setOffline(false);

ok('zero page errors across all phases', errors.length === 0, errors.join(' | '));
await page.screenshot({ path: join(OUT, 'local-agent-390-offline-answer.png') });
console.log('shot → e2e/shots-local-agent/local-agent-390-offline-answer.png');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
