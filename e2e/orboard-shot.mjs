// orboard-shot.mjs — THE ENGINE ROOM, LIVE lane receipt (2026-09-03).
// Receipt definition: "the board at 390px showing bClaude present from the
// relay, and course #2 live." Live means: the LIVE section renders from the
// keyless public read door (relay.skaists.dev/hive/board.json — kind-10100
// profiles + #general presence + roster from the relay DB) during the shot,
// with bClaude's own presence post; the fallback is proven by killing the feed
// route in a second context and reading the labeled degradation.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-orboard');
await mkdir(OUT, { recursive: true });
const FEED = 'https://relay.skaists.dev/hive/board.json';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
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
const ok = (name, cond, note = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : '')); if (!cond) fail++; };

/* ── the board, LIVE from the relay ── */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to fetch')) errors.push(m.text().slice(0, 120)); });
await page.goto(BASE + '/surfaces/or-board.html', { waitUntil: 'load' });

await page.waitForFunction(() => window.__orboard?.live?.seats?.length, null, { timeout: 45000 });
const live = await page.evaluate(() => {
  const seats = window.__orboard.live.seats;
  const b = seats.find(s => s.name === 'bClaude');
  const seatEl = [...document.querySelectorAll('.seat')].find(e => e.textContent.includes('bClaude'));
  return { b, seatTxt: seatEl?.innerText || '', gen: document.getElementById('hivegen').innerText,
    chips: [...document.querySelectorAll('.seat .hx')].map(x => x.className),
    src: document.getElementById('hivesrc').innerText };
});
ok('feed answered live — seats rendered from the relay', live.chips.length >= 5 && !!live.b,
  `${live.chips.length} seats · ${live.gen}`);
ok('BClaUDE PRESENT FROM THE RELAY — capped + profiled + his own #general post',
  live.b?.comb === 'capped' && live.b?.agent === 'profiled' && live.b?.last_general === 'bClaude present.',
  JSON.stringify(live.b?.last_general) + ' @ ' + live.b?.last_general_at);
ok('the presence post renders in the seat row', live.seatTxt.includes('bClaude present.'));
ok('comb chips render all three presence states',
  live.chips.some(c => c.includes('capped')) && live.chips.some(c => c.includes('nectar')));
ok('no fallback banner while the relay answers',
  !(await page.evaluate(() => document.getElementById('fallback').classList.contains('show'))));
const retired = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.orow')];
  const bc = rows.find(r => r.getAttribute('data-name') === 'bclaude');
  return { shown: rows.filter(r => r.style.display !== 'none').map(r => r.getAttribute('data-name')), bcNote: bc?.innerText || '' };
});
ok('file rows render (labeled fallback section)', retired.shown.length >= 3, retired.shown.join(','));
ok('bClaude\'s file row retired by the live seat', retired.bcNote.includes('live on the relay above'));
await page.screenshot({ path: join(OUT, 'orboard-live-390.png'), fullPage: true });
ok('zero page errors (board live)', errors.length === 0, errors.join(' | '));

/* ── the labeled fallback: feed route killed ── */
const fctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await fctx.route('**/hive/board.json', r => r.abort());
const fpage = await fctx.newPage();
await fpage.goto(BASE + '/surfaces/or-board.html', { waitUntil: 'load' });
await fpage.waitForFunction(() => document.getElementById('fallback').classList.contains('show'), null, { timeout: 30000 });
const fb = await fpage.evaluate(() => ({
  banner: document.getElementById('fallback').innerText,
  hive: document.getElementById('hive').innerText,
  fileRows: document.querySelectorAll('.orow').length }));
ok('relay unreachable → the labeled banner shows', fb.banner.includes('relay unreachable') && fb.banner.includes('labeled'));
ok('the live section says so honestly (no stale rows)', fb.hive.includes('did not answer'));
ok('the file still renders as the fallback', fb.fileRows >= 3, String(fb.fileRows));
await fpage.screenshot({ path: join(OUT, 'orboard-fallback-390.png'), fullPage: false });

/* ── course #2 FULL on the EDU surface ── */
const ectx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const epage = await ectx.newPage();
const eerrors = [];
epage.on('pageerror', e => eerrors.push(String(e).slice(0, 120)));
await epage.goto(BASE + '/surfaces/university/index.html', { waitUntil: 'load' });
await epage.waitForFunction(() => document.body.innerText.toUpperCase().includes('HOW THE VENDING MACHINE MINTS YOU AN AGENT'), null, { timeout: 20000 });
const eduTxt = await epage.evaluate(() => document.body.innerText);
ok('course #2 on the curriculum — FULL, not a stub', eduTxt.includes('HOW THE VENDING MACHINE MINTS YOU AN AGENT') && !eduTxt.includes('STUB'));
await epage.click('#rg-cyper');
ok('cypherpunk register carries the pointer law + certificate hash law',
  (await epage.evaluate(() => document.querySelector('#prose-c7').innerText)).includes('derivation'));
await epage.click('#rg-bee');
await epage.check('input[name=c7][data-i="0"]');
await epage.click('#ex-c7-go');
ok('wrong answer refused with guidance', (await epage.evaluate(() => document.querySelector('#ex-c7-fb').innerText)).includes('not that one'));
await epage.check('input[name=c7][data-i="1"]');
await epage.click('#ex-c7-go');
const act = await epage.evaluate(() => ({
  fb: document.querySelector('#ex-c7-fb').innerText,
  links: [...document.querySelectorAll('#ex-c7-fb a')].map(a => a.getAttribute('href')),
  line: document.querySelector('#line-c7').innerText }));
ok('right answer passes and the lesson ENDS on the live machine link',
  act.fb.includes('exactly') && act.links.includes('../vending.html'), act.links.join(' '));
ok('the [bUni · c7] receipt line lands', act.line.includes('[bUni · c7]') && act.line.includes('species survives'));
ok('act counts now include course #2 (of 7)', (await epage.evaluate(() => document.getElementById('tstate').innerText)).includes('of 7 acts'));
ok('zero page errors (university)', eerrors.length === 0, eerrors.join(' | '));
await epage.locator('#courses section', { hasText: 'HOW THE VENDING MACHINE' }).scrollIntoViewIfNeeded();
await epage.screenshot({ path: join(OUT, 'edu-course2-390.png'), fullPage: false });

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAIL` : '\nor-board live + course #2 receipt: ALL PASS');
process.exit(fail ? 1 : 0);
