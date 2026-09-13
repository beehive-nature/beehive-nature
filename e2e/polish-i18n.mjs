// polish-i18n.mjs — surface polish lane (2026-09-13), rendered-side proof.
// Mirrors profile-i18n.mjs: corpus-exact cells under a live tongue, the
// data-key twin renderer on plur, the one-click recoverable failures with
// cypherpunk retaining diagnostics, and honest page-error silence.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const corpus = JSON.parse(readFileSync(join(SURF, 'lang-corpus.json'), 'utf8'));
const cell = (k, l) => corpus.strings[k] && corpus.strings[k][l];

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); }
};

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    if (!s.headersSent) s.writeHead(200, { 'content-type': ct });
    s.end(body);
  } catch { if (!s.headersSent) s.writeHead(404); s.end(); }
});

await new Promise(r => srv.listen(8847, '127.0.0.1', r));
const b = await chromium.launch();

async function pageAt(path, { lang = 'ru', reg = 'bee' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addInitScript(([l, r]) => {
    try { localStorage.setItem('blang', l); localStorage.setItem('bregister', r); } catch (e) {}
  }, [lang, reg]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8847/surfaces/' + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(900);
  return { ctx, p, errs };
}

/* 1 · wallet — register prose renders corpus-exact in ru across all three registers */
{
  const { ctx, p, errs } = await pageAt('wallet.html', { lang: 'ru', reg: 'bee' });
  ok('wallet bee register renders ru corpus-exact',
    await p.locator('[data-i18n="wl.reg.connect.bee"]').textContent() === cell('wl.reg.connect.bee', 'ru'));
  ok('wallet h1arg ru', (await p.locator('[data-i18n="wl.h1arg"]').textContent()).includes('одна душа'));
  ok('wallet zero page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{
  const { ctx, p } = await pageAt('wallet.html', { lang: 'ru', reg: 'cypherpunk' });
  ok('wallet cypher register renders ru corpus-exact',
    await p.locator('[data-i18n="wl.reg.connect.cypher"]').textContent() === cell('wl.reg.connect.cypher', 'ru'));
  await ctx.close();
}

/* 2 · plur — the data-key twin renderer activates the reserved keys, and the
       dock line keeps both links through the swap */
{
  const { ctx, p, errs } = await pageAt('plur.html', { lang: 'ru', reg: 'bee' });
  ok('plur data-key renders ru (talk sub)', await p.locator('[data-key="d.plur.talk.sub"]').textContent() === cell('d.plur.talk.sub', 'ru'));
  ok('plur novoice renders ru', (await p.locator('[data-i18n="plur.novoice"]').first().textContent()) === cell('plur.novoice', 'ru'));
  const dock = p.locator('.dock');
  const dockTxt = await dock.textContent();
  ok('plur dock line translated', dockTxt.includes(cell('d.plur.stone.dock3', 'ru').split(' · ')[0]));
  ok('plur dock keeps both links after swap', await dock.locator('a').count() === 2);
  ok('plur zero page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 3 · vending — step chrome + care block in ru */
{
  const { ctx, p, errs } = await pageAt('vending.html', { lang: 'ru', reg: 'raver' });
  ok('vending step header ru', await p.locator('#s1').textContent() === cell('v.s1', 'ru'));
  ok('vending care raver line ru', (await p.locator('[data-i18n="v.care.ravers"]').textContent()).includes('говорит'));
  ok('vending zero page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 4 · or-board — one-click recoverable failure: bee gets the calm line and a
       Try-now button; cypherpunk keeps the technical detail; retry refetches */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('blang', 'en'); localStorage.setItem('bregister', 'bee'); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/hive/board.json', route => route.abort('connectionrefused'));
  await p.goto('http://127.0.0.1:8847/surfaces/or-board.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  const hiveText = await p.locator('#hive').textContent();
  ok('or-board bee sees friendly failure', /live board did not answer/i.test(hiveText), hiveText.slice(0, 80));
  ok('or-board bee has Try now button', await p.locator('#hive-retry').count() === 1);
  ok('or-board no raw feed URL for bee', !hiveText.includes('https://relay'));
  await p.locator('#breg-cypherpunk').click();
  await p.waitForTimeout(600);
  const cpText = await p.locator('#hive').textContent();
  ok('or-board cypherpunk keeps diagnostics', /read door did not answer/i.test(cpText) && cpText.includes('https://relay'));
  ok('or-board zero page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 5 · watch — the example manifest fetch refused: bee gets one click; retry
       with the fetch restored lands on shape-checked */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('blang', 'en'); localStorage.setItem('bregister', 'bee'); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  let block = true;
  const fixture = readFileSync(join(ROOT, 'fixtures/connect-store-manifest-envelope-v1.json'));
  await p.route('**/connect-store-manifest-envelope-v1.json', route => {
    if (block) route.abort('failed');
    else route.fulfill({ status: 200, contentType: 'application/json', body: fixture });
  });
  await p.goto('http://127.0.0.1:8847/surfaces/watch.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.locator('#room-details > summary').click(); // the room-details card is a closed disclosure
  await p.waitForTimeout(300);
  const state1 = await p.locator('#manifest-state').textContent();
  ok('watch bee friendly refusal', state1 === 'did not load', state1);
  ok('watch bee retry button visible', !(await p.locator('#manifest-retry').isHidden()));
  ok('watch bee copy is calm, not technical', (await p.locator('#manifest-copy').textContent()).includes('nothing about the room changed'));
  block = false;
  await p.locator('#manifest-retry').click();
  await p.waitForTimeout(900);
  ok('watch retry recovers to shape checked', (await p.locator('#manifest-state').textContent()) === 'shape checked');
  await p.locator('#breg-cypherpunk').click();
  await p.waitForTimeout(500);
  ok('watch register switch keeps page sound', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* 6 · RTL reach — arabic renders on watch without errors */
{
  const { ctx, p, errs } = await pageAt('watch.html', { lang: 'ar', reg: 'bee' });
  ok('watch arabic routes heading renders', (await p.locator('[data-i18n="watch.routes"]').textContent()) === cell('watch.routes', 'ar'));
  ok('watch rtl dir set', await p.evaluate(() => document.documentElement.dir === 'rtl'));
  ok('watch arabic zero page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await b.close();
srv.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
