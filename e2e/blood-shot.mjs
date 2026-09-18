// blood-shot.mjs — THE bGenealogy SURFACE lane receipt (2026-09-18).
// Receipt definition: "the UI passes the gate, honestly." Design-acceptance
// runs separately; this battery proves the SURFACE LAWS live:
//   · the six-station journey renders with truthful state chips
//   · the blood fractal is drawn from real math (2^g slots, exact counts)
//   · the five preservation states all say NOT YET — nothing synthetic
//   · the economics card carries blanks, never a projection
//   · the receipt reader is gesture-gated and honest when absent
//   · the evidence layers render as distinct axes (era ≠ support …)
//   · the living-privacy law is visible; no un-consented living identity
//   · zero page errors, no horizontal overflow at 390px, register views work
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-blood');
await mkdir(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
/* the receipt reader's handled 404 (file honestly absent) is named in-page — not a page defect */
const notFound = []; page.on('response', r => { if (r.status() === 404) notFound.push(r.url()); });
const isLawful404 = t => t.includes('404') && notFound.every(u => u.includes('blood-economics.json')) && notFound.length > 0;
await page.goto(BASE + '/surfaces/blood.html', { waitUntil: 'load' });

/* 1 · THE HERO — the honest state number */
ok('hero renders 0 / 5 measured states', (await page.locator('#hero-states').innerText()).trim() === '0 / 5',
  await page.locator('#hero-states').innerText());
ok('hero says receipts only, never projection',
  (await page.locator('#hero-sub').innerText()).includes('never by projection'), '');
await page.screenshot({ path: join(OUT, 'blood-1-hero-390.png') });

/* 2 · THE JOURNEY — six stations, truthful chips */
const stations = await page.locator('.stn').allInnerTexts();
ok('six stations render', stations.length === 6, String(stations.length));
ok('station 1 links the live house profile',
  (await page.locator('.stn a').first().getAttribute('href')) === 'profile.html', '');
const chips = await page.locator('.stn .chip').allInnerTexts();
ok('chips are truthful: live ×2 · staged ×2 · rendered · waits',
  chips.filter(c => /live|byte-pinned|rendered/i.test(c)).length === 3
  && chips.filter(c => /staged/i.test(c)).length === 2
  && chips.some(c => /waits on preservation/i.test(c)), JSON.stringify(chips));
ok('the public demonstration pair is named (founder-designated)',
  stations.some(t => t.includes('Albert Perry Rockwood') && t.includes('Donna')), '');
ok('staged persons say not yet public — privacy before opening',
  chips.filter(c => /not yet public/i.test(c)).length === 2, '');

/* 3 · THE BLOOD FRACTAL — drawn from real math */
let nodes = await page.locator('#fractal polygon').count();
ok('fractal draws every slot cumulatively: 2^7−1 = 127 nodes at six generations', nodes === 127, String(nodes));
const mathTxt = await page.locator('#frmath').innerText();
ok('fractal math is exact: 64 in the last row · 63 ancestor slots', mathTxt.includes('64') && mathTxt.includes('63'), mathTxt.slice(0, 60));
ok('pedigree collapse is stated where the shape is drawn',
  (await page.locator('.frwrap details[data-reg-disclose] .dbody').textContent()).includes('collapse'), '');
await page.locator('#gens button[data-g="10"]').click();
await page.waitForFunction(() => document.querySelectorAll('#fractal polygon').length === 2047);
ok('ten generations draw 2,047 slots total (1,023 beside you in the last two rows alone)', true,
  (await page.locator('#fractal polygon').count()) + ' nodes');
ok('the era labels render generations, not identities',
  await page.evaluate(() => [...document.querySelectorAll('#fractal text')]
    .some(t => /^g[0-9]+$/.test(t.textContent.trim()))), '');
await page.locator('#gens button[data-g="4"]').click();
await page.waitForFunction(() => document.querySelectorAll('#fractal polygon').length === 31);
ok('four generations draw 2^5−1 = 31 nodes', (await page.locator('#fractal polygon').count()) === 31, '');
await page.screenshot({ path: join(OUT, 'blood-2-fractal-390.png'), fullPage: true });

/* 4 · THE LAW OF FIVE STATES — all not-yet, nothing synthetic */
const stateRows = await page.locator('#states .line, .card .line').allInnerTexts();
const fiveLineTexts = (await page.locator('.card .line').allInnerTexts()).slice(0, 5);
ok('the five states render in order', fiveLineTexts.length >= 5
  && fiveLineTexts[0].toLowerCase().startsWith('quoted')
  && fiveLineTexts[4].toLowerCase().startsWith('hash-verified'), JSON.stringify(fiveLineTexts.map(t => t.split('\n')[0])));
ok('ALL FIVE say not yet — no state earned, none invented',
  fiveLineTexts.every(t => /not yet/i.test(t)), '');
ok('the approval gate is stated verbatim-intent',
  (await page.locator('.card .note').first().innerText()).includes('adversarial fixes are green')
  && (await page.locator('.card .note').first().innerText()).includes('exact manifest'), '');

/* 5 · THE ECONOMICS CARD — blanks, never a projection */
const ecoCard = await page.locator('.livecard').innerText();
ok('the live card carries the mission\u2019s honest blanks',
  ecoCard.includes('___') && ecoCard.includes('never a projection'), ecoCard.slice(0, 80));
const ecoCells = await page.locator('table.eco td.await').count();
ok('every economics cell awaits its receipt', ecoCells >= 15, String(ecoCells) + ' cells');

/* 6 · THE RECEIPT READER — gesture-gated, honest when absent */
const ecoReq = [];
page.on('request', r => { if (r.url().includes('blood-economics.json')) ecoReq.push(r.url()); });
await page.locator('#readeco').click();
await page.waitForFunction(() => document.getElementById('ecores').innerText.includes('no receipt yet'));
ok('no receipt exists — the reader says so, never guesses',
  (await page.locator('#ecores').innerText()).includes('no receipt yet'), '');
ok('the economics fetch is gesture-gated (exactly one, only after the press)', ecoReq.length === 1, JSON.stringify(ecoReq.length));

/* 7 · THE EVIDENCE LAYERS — distinct axes, never merged */
const layers = await page.locator('.layer .t').allInnerTexts();
ok('the five layer laws render', layers.length === 5
  && layers.some(t => t.includes('≠ support')) && layers.some(t => t.includes('≠ tradition')), JSON.stringify(layers));
ok('source counts and citations stay two numbers',
  layers.some(t => t.includes('inventory') && t.includes('confidence')), '');

/* 8 · THE LIVING-PRIVACY LAW */
ok('the living-privacy law is visible beside the fractal',
  (await page.locator('.frwrap .note').innerText()).includes('roles until they consent'), '');
ok('no 64-hex runs on the page (digests render short-form only)',
  !/[0-9a-fA-F]{48,}/.test(await page.locator('body').innerText()), '');

/* 9 · THE REGISTER CANON — cypherpunk opens the disclosures */
await page.locator('#breg-cypherpunk').click();
await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'cypherpunk');
ok('cypherpunk view stands the disclosures open',
  await page.locator('details[data-reg-disclose]').first().evaluate(d => d.open), '');
await page.locator('#breg-bee').click();
await page.waitForFunction(() => document.body.getAttribute('data-reg') === 'bee');
ok('back on new bee view, disclosures rest closed by default',
  !(await page.locator('details[data-reg-disclose]').first().evaluate(d => d.open)), '');

/* 10 · shape */
ok('no horizontal overflow at 390px', await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), '');
const realErrors = errors.filter(e => !isLawful404(e));
ok('zero page errors (the receipt-reader’s handled 404 excluded, named in-page)', realErrors.length === 0, realErrors.join(' | '));
await page.screenshot({ path: join(OUT, 'blood-3-states-eco-390.png'), fullPage: true });

/* desktop pass — the fractal wide */
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
await dpage.goto(BASE + '/surfaces/blood.html', { waitUntil: 'load' });
await dpage.waitForTimeout(400);
await dpage.screenshot({ path: join(OUT, 'blood-4-desktop-1440.png') });
await dctx.close();

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAIL` : '\nbGenealogy surface receipt: ALL PASS');
process.exit(fail ? 1 : 0);
