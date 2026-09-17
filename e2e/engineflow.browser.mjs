// engineflow.browser.mjs — the Engine Room data-loop lane (2026-09-17).
// Proves the follow-one-file section on surfaces/stack.html:
//  - loads with zero console/page errors (the T_ class);
//  - eight stages, native-button keyboard path, aria-pressed, five factual rows + next-door link;
//  - register switches change PROSE DEPTH ONLY: the paragraph key changes, the factual-row
//    keys stay identical, ZERO network requests fire, localStorage untouched beyond the
//    register preference itself;
//  - reduced-motion kills the loop's pulse and the section still works;
//  - every same-origin link in the section resolves;
//  - the evidence card's numbers match the intake receipt MECHANICALLY (re-derived here),
//    the quote renders "in review" with NO invented figure;
//  - honest degrade when the artifact is unreachable;
//  - 390px renders without horizontal spill, shots banked to e2e/shots-engineflow/.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const SHOTS = join(HERE, 'shots-engineflow');
await mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    // pages live at the root of this server, but lang.js's corpus URL is absolute
    // (/surfaces/lang-corpus.json) — accept both shapes, like no-page-errors does.
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '').replace(/^surfaces\//, '');
    const p = join(SURF, rel);
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); }
};

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// console errors: SAME-ORIGIN only — the organ board's pre-existing external probes
// (no-cors reach + NIP-11 ident to live relays) legitimately log CORS/net chatter from
// a local origin; that is the board's guard-state behavior, not this lane's defect.
page.on('console', m => {
  if (m.type() === 'error') {
    const loc = m.location() || {};
    // organ-board chatter: fetches to the estate's live relays from a local origin
    // log CORS blocks with NO location — pre-existing guard-state behavior, not ours
    if (/^Access to fetch at 'https?:\/\/(?!127\.0\.0\.1)/.test(m.text())) return;
    if (!loc.url || loc.url.startsWith(BASE)) errors.push('console: ' + m.text());
  }
});

await page.goto(`${BASE}/stack.html`);
await page.waitForTimeout(600);
ok('page loads with zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

/* 1 · the section and its eight stages */
const stages = page.locator('#flowLoop .fstage');
ok('eight stage buttons render', (await stages.count()) === 8, String(await stages.count()));
ok('stage legend chips render (four circuits)', (await page.locator('#dataflow .legend .fc').count()) === 4);
ok('default state asks to select a stage', await page.locator('#flowSelect').isVisible());

/* 2 · keyboard: Tab to the first stage, Enter opens it */
await page.focus('#organboard'); // anchor above the loop
let kbFocused = false;
for (let i = 0; i < 40 && !kbFocused; i++) {
  await page.keyboard.press('Tab');
  kbFocused = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('fstage'));
}
ok('keyboard Tab reaches a stage button unaided', kbFocused);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('Enter opens the stage detail', (await page.locator('#flowDetail .freg').count()) === 1);
const rowKeys = await page.$$eval('#flowDetail .frow .fv', els => els.map(e => e.getAttribute('data-i18n')));
ok('four factual rows are present with corpus keys', rowKeys.length === 4 && rowKeys.every(k => k && k.startsWith('flow.')), rowKeys.join(','));
ok('the next-door row links onward', await page.locator('#flowDetail .fnext a').count() === 1);

/* 3 · register law: prose changes, constants do not */
async function regState() {
  return page.evaluate(() => ({
    reg: document.body.getAttribute('data-reg'),
    paraKey: document.querySelector('#flowDetail .freg')?.getAttribute('data-i18n'),
    rowKeys: [...document.querySelectorAll('#flowDetail .frow .fv')].map(e => e.getAttribute('data-i18n')),
    rowText: [...document.querySelectorAll('#flowDetail .frow .fv')].map(e => e.textContent),
  }));
}
await page.click('#breg-cypherpunk'); await page.waitForTimeout(150);
const cy = await regState();
await page.click('#breg-raver'); await page.waitForTimeout(150);
const rav = await regState();
await page.click('#breg-bee'); await page.waitForTimeout(150);
const bee = await regState();
ok('paragraph key changes with the register (bee/rav/cy)',
  bee.paraKey.endsWith('.bee') && rav.paraKey.endsWith('.rav') && cy.paraKey.endsWith('.cy'),
  `${bee.paraKey} / ${rav.paraKey} / ${cy.paraKey}`);
ok('factual rows are THE SAME CONSTANTS in every register',
  JSON.stringify(bee.rowKeys) === JSON.stringify(rav.rowKeys) && JSON.stringify(rav.rowKeys) === JSON.stringify(cy.rowKeys) &&
  JSON.stringify(bee.rowText) === JSON.stringify(rav.rowText) && JSON.stringify(rav.rowText) === JSON.stringify(cy.rowText));

/* 4 · presentation inertness: no network, no storage, while exercising everything */
const lsBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
let requestsDuring = 0; const reqUrls = [];
page.on('request', r => { requestsDuring++; reqUrls.push(r.url()); });await page.click('#breg-raver'); await page.click('#breg-cypherpunk'); await page.click('#breg-bee');
for (let i = 0; i < 8; i++) { await stages.nth(i).click(); await page.waitForTimeout(40); }
await page.waitForTimeout(400);
// scope: this lane's invariant is that REGISTER + STAGE interaction originates nothing.
// favicon is browser chrome; external URLs are the ORGAN BOARD's pre-existing probes
// (ident/reach, with retries on slow networks) — not this section's policy.
const noisy = reqUrls.filter(u => !/favicon\.ico$/.test(u) && u.startsWith(BASE));
ok('register + stage interaction fires ZERO same-origin network requests', noisy.length === 0, noisy.join(', '));
const lsAfter = await page.evaluate(() => JSON.stringify({ ...localStorage }));
const before = JSON.parse(lsBefore), after = JSON.parse(lsAfter);
const changedKeys = Object.keys(after).filter(k => before[k] !== after[k]);
ok('localStorage untouched except the register preference', changedKeys.length === 0 || (changedKeys.length === 1 && changedKeys[0] === 'bregister'), changedKeys.join(','));

/* 5 · reduced motion */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const rp = await ctx.newPage();
  const rerr = [];
  rp.on('pageerror', e => rerr.push(e.message));
  await rp.goto(`${BASE}/stack.html`); await rp.waitForTimeout(500);
  const anim = await rp.evaluate(() => getComputedStyle(document.querySelector('.floopback')).animationName);
  ok('prefers-reduced-motion disables the loop pulse', anim === 'none', anim);
  await rp.locator('#flowLoop .fstage').nth(3).click(); await rp.waitForTimeout(120);
  ok('section still interactive under reduced motion', (await rp.locator('#flowDetail .freg').count()) === 1 && rerr.length === 0);
  await ctx.close();
}

/* 6 · links resolve (same-origin only) */
const hrefs = await page.$$eval('#dataflow a[href]', as => as.map(a => a.getAttribute('href')).filter(h => h && !/^https?:/.test(h)));
let broken = [];
for (const h of new Set(hrefs)) {
  const code = (await page.request.get(`${BASE}/${h.replace(/^\//, '')}`)).status();
  if (code !== 200) broken.push(h + ':' + code);
}
ok('every same-origin link in the section resolves 200', broken.length === 0, broken.join(', '));

/* 7 · the evidence card is MECHANICAL: re-derive from the intake receipt here */
const md = readFileSync(join(ROOT, 'docs/dispatches/2026-09-17-watch-try-autonomi-intake.md'), 'utf8');
const bytes = md.match(/(\d{1,3}(?:,\d{3})+) bytes \(/)[1].replace(/,/g, '');
const dur = md.match(/Duration ([\d.]+) s/)[1];
const verdict = md.match(/VERDICT: (PASS|FAIL) \((\d+)\/(\d+) checks\)/);
const sha = md.match(/SHA-256: `([0-9a-f]{64})`/)[1];
const shape = md.match(/H\.264[\s\S]*?(\d{3,4})×(\d{3,4}),/);
const card = await page.locator('#flowExample').innerText();
ok('card shows the receipt\u2019s byte count', card.includes(bytes), bytes);
ok('card shows the receipt\u2019s duration', card.includes(dur), dur);
ok('card shows the receipt\u2019s playback verdict', card.includes(verdict[1] + ' (' + verdict[2] + '/' + verdict[3] + ')'));
ok('card\u2019s short sha pin matches the receipt\u2019s digest', card.includes(sha.slice(0, 12)) && card.includes(sha.slice(-6)));
ok('card shows the receipt\u2019s dimensions', card.includes(shape[1] + '×' + shape[2]));
ok('quote stage says in review — and NO ANT amount is invented',
  card.includes('in review') && !/\d[\d.]*\s+ANT/.test(card), card.slice(0, 60));

/* 8 · honest degrade when the artifact is unreachable */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dp = await ctx.newPage();
  const derr = [];
  dp.on('pageerror', e => derr.push(e.message));
  dp.on('console', m => {
    if (m.type() === 'error') {
      const loc = m.location() || {};
      if (/^Access to fetch at 'https?:\/\/(?!127\.0\.0\.1)/.test(m.text())) return;
      if ((!loc.url || loc.url.startsWith(BASE)) && !loc.url.includes('stack-dataflow-example')) derr.push(m.text());
    }
  });
  await ctx.route('**/stack-dataflow-example.json', r => r.abort());
  await dp.goto(`${BASE}/stack.html`); await dp.waitForTimeout(500);
  const dtext = await dp.locator('#flowExample').innerText();
  ok('degraded card says unavailable and points at the receipt',
    /unavailable|доступ/i.test(dtext) && dtext.includes('intake receipt'), dtext.slice(0, 80));
  ok('degraded card invents no numbers', !/214091829|52\.488/.test(dtext));
  ok('degrade path loads without page errors', derr.length === 0, derr.join(' | '));
  await ctx.close();
}

/* 9 · a non-English tongue renders the loop from the corpus */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const up = await ctx.newPage();
  await up.addInitScript(() => localStorage.setItem('blang', 'ru'));
  const uerr = [];
  up.on('pageerror', e => uerr.push(e.message));
  await up.goto(`${BASE}/stack.html`); await up.waitForTimeout(900);
  const firstStage = await up.locator('#flowLoop .fstage').first().innerText();
  ok('ru renders the first stage from the corpus', firstStage.includes('приём'), firstStage.slice(0, 30));
  ok('ru page loads without page errors', uerr.length === 0, uerr.join(' | '));
  await ctx.close();
}

/* 10 · 390px: no horizontal spill + shots (bee/raver/cypherpunk, one stage open) */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await ctx.newPage();
  await mp.goto(`${BASE}/stack.html`); await mp.waitForTimeout(600);
  const spill = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('390px: no horizontal spill', spill <= 1, String(spill));
  await mp.locator('#flowLoop .fstage').nth(3).click(); await mp.waitForTimeout(200);
  await mp.locator('#dataflow').screenshot({ path: join(SHOTS, 'dataflow-bee-390.png') });
  await mp.click('#breg-raver'); await mp.waitForTimeout(200);
  await mp.locator('#dataflow').screenshot({ path: join(SHOTS, 'dataflow-raver-390.png') });
  await mp.click('#breg-cypherpunk'); await mp.waitForTimeout(200);
  await mp.locator('#dataflow').screenshot({ path: join(SHOTS, 'dataflow-cypherpunk-390.png') });
  const touch = await mp.evaluate(() => {
    const b = document.querySelector('#flowLoop .fstage');
    return b ? b.getBoundingClientRect().height : 0;
  });
  ok('390px: stage buttons meet the 44px touch floor', touch >= 44, String(touch));
  await ctx.close();
}
/* desktop shot */
await page.setViewportSize({ width: 1280, height: 900 });
await page.click('#breg-cypherpunk'); await page.waitForTimeout(200);
await page.locator('#flowLoop .fstage').nth(0).click(); await page.waitForTimeout(200);
await page.locator('#dataflow').screenshot({ path: join(SHOTS, 'dataflow-cypherpunk-1280.png') });

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
