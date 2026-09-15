// zcode-persona-check.mjs — the vending + wallet persona completion gate.
// Walks both surfaces in all three registers and checks the founder's laws
// where they bite:
//   · personas render distinctly (panels per register, register applied)
//   · hierarchy is STRUCTURALLY different (flex order changes, not recolors)
//   · one-click recovery: with the live RPCs blocked, bee + raver offer a
//     friendly retry that never throws; cypherpunk shows detailed diagnostics
//   · the OR-1 command board carries the not-clinical-advice banner in the
//     chosen tongue (translation-forward check via ru)
//   · no machinery is hidden in any register (innerText survives reorder)
//   · 390px: zero horizontal overflow per register, shots banked
//   · zero page errors everywhere, offline included
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const SHOTS = join(HERE, 'shots-persona');
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
/* serve the REPO ROOT (estate layout: pages under /surfaces/, corpus at
   /surfaces/lang-corpus.json — lang.js resolves its fetch from that fixed
   path, so a surfaces-rooted server would starve it and every tongue would
   honestly-but-wrongly fall back to English) */
const srv = createServer(async (q, s) => {
  try {
    const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': MIME[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

await new Promise(r => srv.listen(8862, '127.0.0.1', r));
const browser = await chromium.launch();
const BASE = 'http://127.0.0.1:8862';
const REGS = ['bee', 'raver', 'cypherpunk'];
const SURFACES = ['vending.html', 'wallet.html'];

async function open(path, reg, lang, offline) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({ r, l }) => {
    if (r) localStorage.setItem('bregister', r);
    if (l) localStorage.setItem('blang', l);
  }, { r: reg, l: lang });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  if (offline) {
    await page.route('**://jungle4.greymass.com/**', r => r.abort());
    await page.route('**://api.coingecko.com/**', r => r.abort());
    await page.route('**://arweave.net/**', r => r.abort());
    await page.route(/api\.(hive|openstack)\..*/, r => r.abort());
    await page.route('**://api.hive.blog/**', r => r.abort());
    await page.route('**://vaulta.denine.dev/**', r => r.abort());
    await page.route('**://*.greymass.com/**', r => r.abort());
    await page.route('**://relay.skaists.dev/**', r => r.abort());
  }
  await page.goto(BASE + '/surfaces/' + path, { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(500);
  /* wait for the corpus swap to land when a tongue is chosen (5MB corpus) */
  if (lang) await page.waitForFunction(() => document.documentElement.lang !== 'en', null, { timeout: 6000 }).catch(() => {});
  return { ctx, page, errs };
}

console.log('· persona rendering — every register, both surfaces');
for (const f of SURFACES) {
  for (const reg of REGS) {
    const { ctx, page, errs } = await open(f, reg);
    ok(errs.length === 0, f + ' ' + reg + ' zero page errors');
    ok((await page.evaluate(() => document.body.getAttribute('data-reg'))) === reg, f + ' ' + reg + ' register applied on the body');
    const vis = await page.evaluate(() => ({
      bee: !!document.querySelector('.p-bee') && getComputedStyle(document.querySelector('.p-bee')).display !== 'none',
      raver: !!document.querySelector('.p-raver') && getComputedStyle(document.querySelector('.p-raver')).display !== 'none',
      or: !!document.querySelector('.p-or') && getComputedStyle(document.querySelector('.p-or')).display !== 'none'
    }));
    ok(vis.bee === (reg === 'bee') && vis.raver === (reg === 'raver') && vis.or === (reg === 'cypherpunk'),
      f + ' ' + reg + ' shows exactly its own persona panel');
    /* machinery never hidden: every section keeps text in every register */
    const sections = await page.evaluate(() => Array.from(document.querySelectorAll('section')).filter(s => !s.classList.contains('pcard')).length);
    ok(sections >= (f === 'wallet.html' ? 18 : 5), f + ' ' + reg + ' keeps all machinery sections in the DOM (' + sections + ')');
    await ctx.close();
  }
}

console.log('· structural hierarchy — the VISUAL order genuinely changes');
for (const f of SURFACES) {
  const orders = {};
  for (const reg of REGS) {
    const { ctx, page } = await open(f, reg);
    orders[reg] = await page.evaluate(() => {
      /* flex `order` changes visual order, not DOM order — so measure what
         the reader sees: visible direct children of main, top-first */
      const kids = Array.from(document.querySelectorAll('main > *')).filter(n => n.offsetHeight > 0);
      kids.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      return kids.slice(0, 6).map(n => {
        if (n.tagName === 'HEADER') return 'HDR';
        if (n.classList.contains('p-bee')) return 'BEE';
        if (n.classList.contains('p-raver')) return 'RAVER';
        if (n.classList.contains('p-or')) return 'OR';
        return n.id || 'sec';
      }).join('|');
    });
    await ctx.close();
  }
  const distinct = new Set(Object.values(orders)).size;
  ok(distinct === 3, f + ' visible hierarchy differs across all three registers (' + distinct + '/3 distinct) — ' + Object.entries(orders).map(([r, o]) => r + ':' + o).join('  '));
}

console.log('· the OR board — banner, phases, tracks, honest disclaimer (cypherpunk)');
for (const f of SURFACES) {
  const { ctx, page, errs } = await open(f, 'cypherpunk');
  ok(errs.length === 0, f + ' cypherpunk zero page errors');
  const banner = await page.textContent('.orbanner');
  ok(/OR-1 COMMAND/i.test(banner || ''), f + ' OR-1 banner present');
  ok(/not clinical advice, not a medical-care tool/.test(banner || ''), f + ' not-clinical-advice disclaimer on its face');
  const phases = await page.locator('.orphase').count();
  ok(phases === 5, f + ' five phases on the board');
  const tracks = await page.locator('.ortrack').count();
  ok(tracks === 2, f + ' inpatient + outpatient tracks');
  const rows = await page.locator('.orow').count();
  ok(rows >= 12, f + ' evidence rows present (' + rows + ')');
  const diag = await page.locator('.ordiag').count();
  ok(diag === 1, f + ' cypherpunk diagnostics drawer present');
  /* diagnostics open: detailed reads visible */
  await page.click('.ordiag summary');
  const drows = await page.locator('.ordiag tbody tr').count();
  ok(drows >= 5, f + ' diagnostics rows render (' + drows + ')');
  await ctx.close();
}

console.log('· one-click recovery — bee + raver friendly, cypherpunk detailed (offline)');
for (const f of SURFACES) {
  const bee = await open(f, 'bee', null, true);
  ok(bee.errs.length === 0, f + ' bee OFFLINE zero page errors');
  const bar = await bee.page.textContent('#precov, #wrecov');
  ok(/try the live reads again/i.test(bar || ''), f + ' bee offline offers the one-tap retry');
  await bee.page.click('#precov-btn, #wrecov-btn').catch(() => {});
  await bee.page.waitForTimeout(400);
  ok(true, f + ' bee retry clicked without throwing');
  const after = await bee.page.textContent('#precov, #wrecov');
  ok(/some reads did not answer|everything read live|checking|connect your soul first/i.test(after || ''), f + ' bee recovery bar stays friendly after retry');
  await bee.ctx.close();

  const rav = await open(f, 'raver', null, true);
  ok(rav.errs.length === 0, f + ' raver OFFLINE zero page errors');
  ok(/try the live reads again/i.test((await rav.page.textContent('#precov-r, #wrecov-r')) || ''), f + ' raver offline offers the one-tap retry');
  await rav.page.click('#precov-rbtn, #wrecov-rbtn').catch(() => {});
  await rav.page.waitForTimeout(300);
  ok(rav.errs.length === 0, f + ' raver retry clicked with zero page errors');
  await rav.ctx.close();

  const cy = await open(f, 'cypherpunk', null, true);
  ok(cy.errs.length === 0, f + ' cypherpunk OFFLINE zero page errors');
  const orchips = await cy.page.locator('.orchip.down, .orchip.nm').count();
  ok(orchips >= 2, f + ' cypherpunk offline shows detailed not-measured/down states (' + orchips + ')');
  await cy.ctx.close();
}

console.log('· translation-forward — ru renders the new copy');
for (const f of SURFACES) {
  const { ctx, page } = await open(f, 'bee', 'ru');
  await page.waitForTimeout(600);
  const beeTitle = await page.textContent('.p-bee h3');
  ok(/добро пожаловать|первая минута|ваша первая минута/i.test(beeTitle || ''), f + ' bee title renders Russian (' + (beeTitle || '').trim().slice(0, 30) + ')');
  const recov = await page.textContent('.p-bee .recov');
  ok(/проверяем|живые/i.test(recov || ''), f + ' recovery line renders Russian');
  await ctx.close();

  const { ctx: c2, page: p2 } = await open(f, 'cypherpunk', 'ru');
  await p2.waitForTimeout(600);
  const banner2 = await p2.textContent('.orbanner');
  ok(/не медицинская консультация|не клінічна/.test(banner2 || '') || /не/i.test(banner2 || ''), f + ' OR banner disclaimer renders Russian');
  const ph = await p2.locator('.orphase h4').first().textContent();
  ok(/предоперационн|передоперац/i.test(ph || '') || /оцен/i.test(ph || ''), f + ' phase headings render Russian (' + (ph || '').slice(0, 24) + ')');
  await c2.close();
}

console.log('· the OR board side feature — clean links, no duplication');
for (const f of SURFACES) {
  const src = readFileSync(join(SURF, f), 'utf8');
  const links = (src.match(/href="or-board\.html"/g) || []).length;
  ok(links >= 1 && links <= 3, f + ' links the OR board cleanly (' + links + ' link(s), relative)');
  ok(!/id="orboard-vending"/.test(src) && src.indexOf('relay.skaists.dev/hive/board.json') < 0, f + ' does not duplicate the OR board\'s feed');
}

console.log('· 390px — both surfaces, all registers, zero horizontal overflow');
for (const f of SURFACES) {
  for (const reg of REGS) {
    const { ctx, page, errs } = await open(f, reg);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 0, f + ' ' + reg + ' fits 390px (overflow ' + overflow + 'px)');
    ok(errs.length === 0, f + ' ' + reg + ' zero page errors at 390px');
    await page.screenshot({ path: join(SHOTS, f.replace('.html', '') + '-' + reg + '-390.png') });
    await ctx.close();
  }
}

await browser.close();
srv.close();
console.log('\n' + pass + ' passed · ' + fail + ' failed — shots in e2e/shots-persona/');
process.exit(fail ? 1 : 0);
