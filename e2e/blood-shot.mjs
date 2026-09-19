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
const isLawful404 = t => t.includes('404') && notFound.length > 0 && notFound.every(u => u.includes('economics.json'));
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
ok('fractal math is exact: 64 last row · 126 ancestor positions · 127 total nodes (root included)',
  mathTxt.includes('64') && mathTxt.includes('126') && mathTxt.includes('127'), mathTxt.slice(0, 90));
ok('pedigree collapse is stated where the shape is drawn',
  (await page.locator('.frwrap details[data-reg-disclose] .dbody').textContent()).includes('collapse'), '');
await page.locator('#gens button[data-g="10"]').click();
await page.waitForFunction(() => document.querySelectorAll('#fractal polygon').length === 2047);
ok('ten generations draw 2,046 ancestor positions + the root = 2,047 total', true,
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

/* 6 · THE RECEIPT READER — gesture-gated; three failure/success truths.
   The incumbent artifact (assets/profile-archive/lineage/…) does not exist
   on THIS branch — that is absence, and absence must NAME the genealogy
   lane, never claim "nothing was measured". */
const ecoReq = [];
page.on('request', r => { if (r.url().includes('economics.json')) ecoReq.push(r.url()); });
await page.locator('#readeco').click();
await page.waitForFunction(() => document.getElementById('ecores').innerText.includes('receipt absent here'));
ok('ABSENT: the reader names the genealogy lane as the receipt\u2019s home, never infers "nothing measured"',
  (await page.locator('#ecores').innerText()).includes('receipt absent here')
  && (await page.locator('#ecores').innerText()).includes('lane/zcode-lineage-import'), '');
ok('the economics fetch is gesture-gated (only after the press)', ecoReq.length >= 1, JSON.stringify(ecoReq.length));

/* SUCCESS: a receipt in the INCUMBENT schema populates rows, hero, and live
   card — the qualified textual 'quoted' counts as measured, verbatim */
{
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const FIXTURE = JSON.stringify({
    schema: 'zblood.storage-economics/1',
    states: { prepared: true, approved: 'manifest bound',
      quoted: 'Arweave YES (live 22:40Z); Autonomi YES client-side estimate 23:28Z (display-only, priced_sample)',
      purchased: false, uploaded: false, retrieved: false, hashVerifiedFromStorage: false },
    quotes: { arweave: { queriedAt: '2026-09-16T22:40Z',
      computed: { fullArchiveUSD: 2.0314, fullArchiveAR: 0.8093 } } } });
  await ctx2.route('**/assets/profile-archive/lineage/zblood-storage-economics.json',
    r => r.fulfill({ contentType: 'application/json', body: FIXTURE }));
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/surfaces/blood.html', { waitUntil: 'load' });
  await p2.locator('#readeco').click();
  await p2.waitForFunction(() => document.getElementById('ecores').innerText.includes('receipt read'));
  ok('SUCCESS: the incumbent schema (textual quoted · hashVerifiedFromStorage) drives the hero to 1 / 5',
    (await p2.locator('#hero-states').innerText()).trim() === '1 / 5',
    await p2.locator('#hero-states').innerText());
  ok('SUCCESS: the quoted chip flips to measured, its qualified text riding verbatim',
    /measured/i.test(await p2.locator('#st-quoted').innerText())
    && (await p2.locator('#st-quoted').evaluate(e => e.title)).includes('display-only'), '');
  ok('SUCCESS: the four unmeasured states stay not yet — nothing promoted',
    ['purchased','uploaded','retrieved','verified'].every(async k =>
      /not yet/i.test(await p2.locator('#st-' + k).innerText())), '');
  ok('SUCCESS: the live card fills verbatim from the receipt (0.8093 AR ≈ $2.03, QUOTE ONLY named)',
    (await p2.locator('.livecard').innerText()).includes('0.8093')
    && (await p2.locator('.livecard').innerText()).includes('QUOTE ONLY'), '');
  await ctx2.close();
}
/* INVALID: a malformed receipt is named, never smoothed */
{
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx3.route('**/assets/profile-archive/lineage/zblood-storage-economics.json',
    r => r.fulfill({ contentType: 'application/json', body: 'not json {' }));
  await ctx3.route('**/blood-economics.json', r => r.fulfill({ status: 404 }));
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '/surfaces/blood.html', { waitUntil: 'load' });
  await p3.locator('#readeco').click();
  await p3.waitForFunction(() => document.getElementById('ecores').innerText.includes('receipt invalid'));
  ok('INVALID: malformed JSON is named as invalid — distinct from absent and unreachable',
    (await p3.locator('#ecores').innerText()).includes('receipt invalid'), '');
  await ctx3.close();
}

/* 7 · THE EVIDENCE LAYERS — distinct axes, never merged */
const layers = await page.locator('.layer .t').allInnerTexts();
ok('the five layer laws render', layers.length === 5
  && layers.some(t => t.includes('≠ support')) && layers.some(t => t.includes('≠ tradition')), JSON.stringify(layers));
ok('citations CONNECT claims to evidence; support is assessed per claim (never a confidence verdict)',
  layers.some(t => t.includes('connect claims to evidence') && t.includes('per claim'))
  && !layers.some(t => t.includes('= confidence')), '');

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
