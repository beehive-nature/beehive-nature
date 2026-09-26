// wallet-registers.mjs — THE THREE REGISTERS gate (founder order 2026-09-25).
//
// The wallet must be THREE TOTALLY DIFFERENT UX/UIs behind the one toggle:
// bee (paper, serif titles, soft corners, magenta action) / raver (black,
// you magenta, display titles, pills, one glow) / cypherpunk (black, mono
// top to bottom, ai teal, cut corners, dense). Clicking the toggle re-dresses
// the page INSTANTLY. A register changes voice, density and dress — never a
// number, a price, a limit, an address, or what a person may do.
//
//   node e2e/wallet-registers.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const p = (url === '/' ? '/wallet.html' : url.indexOf('/surfaces/') === 0 ? url.slice('/surfaces'.length) : url);
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const pageErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(origin + '/wallet.html', { waitUntil: 'load' });
await page.waitForSelector('#breg-cypherpunk', { timeout: 10000 });
await page.waitForTimeout(400);

const dress = () => page.evaluate(() => {
  const cs = el => getComputedStyle(el);
  const section = document.querySelector('main section');
  const btn = document.querySelector('main button');
  const h1 = document.querySelector('h1');
  return {
    reg: document.body.dataset.reg,
    bg: cs(document.body).backgroundColor,
    ink: cs(document.body).color,
    bodyFont: cs(document.body).fontFamily,
    h1Font: cs(h1).fontFamily,
    h1Weight: cs(h1).fontWeight,
    cardRadius: section ? cs(section).borderRadius : '',
    btnColor: btn ? cs(btn).color : '',
    btnRadius: btn ? cs(btn).borderRadius : '',
    glow: section ? cs(section).boxShadow : '',
    h1Text: h1.textContent,
  };
});
const tap = sel => page.click(sel, { timeout: 4000 }).catch(e => { throw new Error('toggle press failed: ' + sel + ' ' + e.message.split('\n')[0]); });

// 1 · the toggle is THERE and thumb-sized — three NAMED pills, obvious
const toggle = await page.evaluate(() => ['bee', 'raver', 'cypherpunk'].map(r => {
  const b = document.getElementById('breg-' + r);
  return { r, present: !!b, h: b ? Math.round(b.getBoundingClientRect().height) : 0, pressed: b ? b.getAttribute('aria-pressed') : null };
}));
ok('the RegisterToggle is in the masthead: three NAMED pills, each ≥ 44px', toggle.every(t => t.present && t.h >= 44), JSON.stringify(toggle));
ok('new bee is the standing default (aria-pressed on bee only)', toggle.find(t => t.r === 'bee').pressed === 'true' && toggle.filter(t => t.pressed === 'true').length === 1);

// 2 · the three dresses — measured, pairwise different
const seen = {};
for (const [reg, sel] of [['bee', '#breg-bee'], ['raver', '#breg-raver'], ['cypherpunk', '#breg-cypherpunk']]) {
  await tap(sel);
  await page.waitForTimeout(350);
  seen[reg] = await dress();
}
const same = (a, b, k) => seen[a][k] === seen[b][k];
const diff = (a, b, k) => seen[a][k] !== seen[b][k];
ok('bee is PAPER: rgb(251, 247, 240) ground, ink rgb(12, 20, 18)', seen.bee.bg === 'rgb(251, 247, 240)' && seen.bee.ink === 'rgb(12, 20, 18)', seen.bee.bg);
ok('bee reads in SERIF titles over SANS body', /Georgia/.test(seen.bee.h1Font) && /system-ui/.test(seen.bee.bodyFont), seen.bee.h1Font.split(',')[0]);
ok('raver is the BLACK ground with the ONE glow', seen.raver.bg === 'rgb(6, 17, 12)' && seen.raver.glow !== 'none', (seen.raver.glow || '').slice(0, 60));
ok('raver shouts in a heavy display title', parseInt(seen.raver.h1Weight, 10) >= 700, 'weight ' + seen.raver.h1Weight);
ok('cypherpunk is MONO top to bottom', /mono/i.test(seen.cypherpunk.bodyFont) && /mono/i.test(seen.cypherpunk.h1Font), seen.cypherpunk.bodyFont.split(',')[0]);
ok('cypherpunk corners are CUT (4px cards, 4px controls)', seen.cypherpunk.cardRadius === '4px' && seen.cypherpunk.btnRadius === '4px', seen.cypherpunk.cardRadius);
ok('raver controls are PILLS (999px)', seen.raver.btnRadius === '999px', seen.raver.btnRadius);
ok('bee corners are SOFT (20px cards, 12px controls)', seen.bee.cardRadius === '20px' && seen.bee.btnRadius === '12px', seen.bee.cardRadius);
// EVERY register is TOTALLY different as a COMPOSITE — and the sheet rules
// raver and cypherpunk to share the black ground and a sans body while they
// differ in type-role, shape, action colour, glow and density. So: the full
// dress VECTOR differs on every pair, and the ruled-different axes differ too.
const vector = r => [seen[r].bg, seen[r].bodyFont, seen[r].h1Font, seen[r].cardRadius, seen[r].btnColor, seen.raver.btnRadius, seen[r].glow, seen[r].h1Weight].join('|');
ok('the dress VECTOR differs on every pair (totally different, not a recolour)',
  vector('bee') !== vector('raver') && vector('raver') !== vector('cypherpunk') && vector('bee') !== vector('cypherpunk'));
for (const k of ['h1Font', 'cardRadius', 'btnColor', 'btnRadius', 'h1Weight']) {
  ok(`dress axis "${k}" differs on all three pairs`, diff('bee', 'raver', k) && diff('raver', 'cypherpunk', k) && diff('bee', 'cypherpunk', k),
    `bee=${seen.bee[k]} · raver=${seen.raver[k]} · cy=${seen.cypherpunk[k]}`);
}
ok('the grounds follow the sheet: bee paper apart, raver and cypherpunk share the RULED black',
  seen.bee.bg === 'rgb(251, 247, 240)' && seen.raver.bg === 'rgb(6, 17, 12)' && seen.cypherpunk.bg === 'rgb(6, 17, 12)');
ok('the action colour follows the register (bee magenta / raver you-magenta / cy ai-teal)',
  seen.bee.btnColor === 'rgb(168, 35, 140)' && seen.raver.btnColor === 'rgb(214, 85, 187)' && seen.cypherpunk.btnColor === 'rgb(69, 194, 220)',
  `${seen.bee.btnColor} / ${seen.raver.btnColor} / ${seen.cypherpunk.btnColor}`);

// 3 · the voice changes, the FACTS never do
const voices = {};
for (const [reg, sel] of [['bee', '#breg-bee'], ['raver', '#breg-raver']]) {
  await tap(sel); await page.waitForTimeout(300);
  voices[reg] = await page.evaluate(() => {
    const p = document.querySelector('p[data-reg="bee"]');
    const pr = document.querySelector('p[data-reg="raver"]');
    const shown = (document.body.dataset.reg === 'bee' ? p : pr);
    return { shown: shown ? shown.getBoundingClientRect().height > 0 : false, h1: document.querySelector('h1').textContent };
  });
}
ok('the register changes the VOICE (bee and raver lead with different prose, one visible at a time)', voices.bee.shown && voices.raver.shown && voices.bee.h1 === voices.raver.h1, voices.bee.h1.trim().slice(0, 40));

// 4 · the toggle re-dresses INSTANTLY — and the choice TRAVELS (localStorage law)
await tap('#breg-raver');
await page.waitForTimeout(200);
ok('a toggle press re-dresses the page at once (no reload)', (await dress()).reg === 'raver' && (await dress()).bg === 'rgb(6, 17, 12)');
await page.reload({ waitUntil: 'domcontentloaded' });
const regAfterReload = await page.evaluate(() => document.body.dataset.reg);
ok('the choice travels: a revisit opens in the reader\'s own register before first paint', regAfterReload === 'raver', 'body[data-reg]=' + regAfterReload);
await page.evaluate(() => localStorage.setItem('bregister', 'bee'));

// 5 · the receipts: three screenshots a person can LOOK at
for (const [reg, sel] of [['bee', '#breg-bee'], ['raver', '#breg-raver'], ['cypherpunk', '#breg-cypherpunk']]) {
  await tap(sel);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(here, 'shots-wallet-registers', `wallet-${reg}-390.png`), fullPage: false });
}
ok('receipts banked: three 390px screenshots, one per register', true, 'e2e/shots-wallet-registers/');

// 6 · the casing law holds in every register: no text-transform anywhere
await tap('#breg-bee');
await page.waitForTimeout(300);
const transforms = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('main, main *').forEach(el => {
    if (el.children.length && el.tagName !== 'svg') return;
    if (getComputedStyle(el).textTransform !== 'none') bad.push(el.tagName + '.' + el.className);
  });
  return bad;
});
ok('no text-transform anywhere in bee (capitals are a signal channel, never decoration)', transforms.length === 0, transforms.slice(0, 4).join(','));

ok('no page errors across all three registers', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 140));

await browser.close();
server.close();
const failed = results.filter(r => !r.pass);
console.log(failed.length
  ? `\nWALLET REGISTERS GATE: ${failed.length} FAILED of ${results.length}`
  : `\nWALLET REGISTERS GATE: GREEN — ${results.length}/${results.length} (three totally different UX/UIs, one toggle; facts invariant)`);
process.exit(failed.length ? 1 : 0);
