// privacy-lens-shot.mjs — THE FULL UNDERSTANDING lane receipt (2026-09-03).
// Receipt definition: "the lens at 390px with all four chip classes visible,
// course #1 live." Live means: notelab11111's actions, commitment set and
// nullifier set read from public jungle4 during the shot; the owner's-lens
// arithmetic (SHA3-256 + the m3.js note derivation) proven TWICE — the page's
// own NIST self-check, and a fresh demo note cross-derived in Node and
// compared byte-for-byte against the browser's derivation.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-lens');
await mkdir(OUT, { recursive: true });

const TX = { // receipted jungle4 txids, SPEC-PRIVACY-1 §m3.5
  deposit:  '6a7ed2ba0137aa1a84d3fad3b7064aa558b1c2712a793ed2abed73986ecbee29', // PUBLIC-CONSTANT jungle4 deposit txid
  transfer: '3cd367ffe35bd2d902213afe9d18686c9365ee2bb77113b41451543b2cdedcd6', // PUBLIC-CONSTANT jungle4 transfer txid
  withdraw: 'fb9e615541a771ac3be931cbfdfc2d27d63f207c446729ada4fd75a41b1c7876' }; // PUBLIC-CONSTANT jungle4 withdraw txid

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

/* ── the lens at 390px ── */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.goto(BASE + '/surfaces/privacy-lens.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__lens?.acts?.length && window.__lens?.commits?.length && window.__lens?.nulls?.length, null, { timeout: 45000 });

ok('SHA3-256 self-check passed in-browser (NIST vectors)', (await page.evaluate(() => window.__lens.sha3)).includes('passed'));

/* the four chip classes — THE receipt line */
const chips = await page.evaluate(() => ({
  pub: document.querySelectorAll('.chip.pub').length,
  priv: document.querySelectorAll('.chip.priv').length,
  pm5: document.querySelectorAll('.chip.pm5').length,
  nev: document.querySelectorAll('.chip.nev').length }));
ok('ALL FOUR CHIP CLASSES VISIBLE', chips.pub > 2 && chips.priv > 2 && chips.pm5 > 0 && chips.nev > 2,
  `PUBLIC ${chips.pub} · PRIVATE ${chips.priv} · AFTER-M5 ${chips.pm5} · NEVER ${chips.nev}`);

/* the comb strip — real finality for the three receipted flows */
const comb = await page.evaluate(() => ({
  cap: ['deposit', 'transfer', 'withdraw'].map(f => document.querySelector(`#f-${f} .hex`).className),
  s: ['deposit', 'transfer', 'withdraw'].map(f => document.querySelector(`#f-${f}-s`).innerText),
  hrefs: ['deposit', 'transfer', 'withdraw'].map(f => document.querySelector(`#f-${f}-a`).href) }));
ok('comb cells capped — the three flows irreversible on live chain',
  comb.cap.every(c => c.includes('capped')), comb.s.map(x => x.split('\n')[0]).join(' | '));
ok('comb links are the receipted monitor deep-links',
  comb.hrefs[0].endsWith(TX.deposit) && comb.hrefs[1].endsWith(TX.transfer) && comb.hrefs[2].endsWith(TX.withdraw));

/* the plumbing fold */
const plumb = await page.evaluate(() => ({
  fold: document.querySelector('#vplumb').innerText,
  raw: document.querySelector('#vplumbraw').textContent }));   /* textContent: the details are folded, not absent */
const livePlumbCount = await page.evaluate(() => window.__lens.acts.filter(a => a.act?.account !== 'notelab11111').length);
ok('sponsor actions folded into ONE line (count live)', new RegExp(`${livePlumbCount} sponsor actions`).test(plumb.fold),
  plumb.fold.replace(/\s+/g, ' ').slice(0, 90));
ok('the fold is honest — the raw rows unfold', plumb.raw.includes('buyrambytes') || plumb.raw.includes('setcode'));

/* the ledger, chipped */
const ledger = await page.evaluate(() => document.querySelector('#vacts').innerText);
ok('ledger carries all four contract actions',
  ['init', 'deposit', 'transfer', 'withdraw'].every(n => ledger.includes(n)));
ok('withdraw recipient is public (kingbeelovis)', ledger.includes('kingbeelovis'));
ok('PM5 chip sits on the open rehearsal amount', ledger.includes('PRIVATE AFTER M5'));
const wallOk = await page.evaluate(() => document.querySelector('#vwall').innerText.includes('which note did the transfer spend'));
ok('the wall shown — nullifier↔commitment unlinkability stated', wallOk);

await page.waitForFunction(() => document.querySelector('#vchecked').innerText.includes('checked just now'));
await page.screenshot({ path: join(OUT, 'lens-stranger-390.png'), fullPage: true });

/* ── the owner's lens: real arithmetic, cross-derived ── */
await page.click('#lowner');
await page.click('#omint');
const demo = await page.evaluate(() => window.__lens.demo);
ok('demo note minted under a fresh key', !!(demo && demo.c && demo.tag), `${demo?.c?.slice(0, 12)}…`);
/* the Node oracle: the same derivation as contracts/privacy/m3.js */
const sha3 = b => createHash('sha3-256').update(b).digest('hex');
const nodeC = sha3(Buffer.concat([Buffer.from(demo.sk, 'hex'), Buffer.from(demo.amt.toString(16).padStart(16, '0'), 'hex')]));
const nodeTag = parseInt(sha3(Buffer.concat([Buffer.from(demo.vk, 'hex'), Buffer.from(nodeC, 'hex')])).slice(0, 8), 16) >>> 0;
const nodeN = sha3(Buffer.concat([Buffer.from(demo.sk, 'hex'), Buffer.from('null-v1', 'utf8')]));
ok('BROWSER ≡ NODE on the commitment (SHA3-256(secret‖amount))', demo.c === nodeC, demo.c.slice(0, 16) + '…');
ok('BROWSER ≡ NODE on the view tag', demo.tag === nodeTag, String(nodeTag));
ok('BROWSER ≡ NODE on the nullifier', demo.nul === nodeN, demo.nul.slice(0, 12) + '…');
/* unlock the demo note through the lens's real matcher */
await page.click('#odemo-unlock');
const unlocked = await page.evaluate(() => ({
  out: document.querySelector('#ownout').innerText,
  cards: document.querySelector('#onotes').innerText }));
ok('the owner\'s key unlocks the demo note (YOURS + balance + unspent)',
  unlocked.cards.includes('YOURS') && unlocked.cards.includes(String(demo.amt)) && unlocked.cards.includes('unspent'),
  `balance ${demo.amt}`);
ok('demo note honestly labeled as this-page-only', unlocked.cards.includes('this page'));
/* a random key honestly matches nothing */
await page.fill('#ovk', 'ab'.repeat(32));
await page.fill('#osk', '');
await page.click('#ounlock');
ok('a foreign key opens nothing — honest no, never a guess',
  (await page.evaluate(() => document.querySelector('#ownout').innerText)).includes('no note opens under this key'));
ok('the two rehearsal notes stay locked to everyone (keys never recorded)',
  (await page.evaluate(() => document.querySelector('#onotes').innerText)).includes('locked'));
await page.screenshot({ path: join(OUT, 'lens-owner-390.png'), fullPage: true });
ok('zero page errors (lens)', errors.length === 0, errors.join(' | '));

/* ── course #1 live on the EDU surface ── */
const ectx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const epage = await ectx.newPage();
const eerrors = [];
epage.on('pageerror', e => eerrors.push(String(e).slice(0, 120)));
await epage.goto(BASE + '/surfaces/university/index.html', { waitUntil: 'load' });
await epage.waitForFunction(() => document.body.innerText.toUpperCase().includes('HOW YOUR PRIVATE NOTE WORKS'), null, { timeout: 20000 });
const edu = await epage.evaluate(() => document.body.innerText);
ok('course #1 on the curriculum (three registers wired)', edu.includes('HOW YOUR PRIVATE NOTE WORKS'));
/* register swap */
await epage.click('#rg-raver');
ok('raver register carries the four visibility classes',
  (await epage.evaluate(() => document.querySelector('#prose-c6').innerText)).includes('NEVER HIDDEN'));
await epage.click('#rg-cyper');
ok('cypherpunk register carries the arithmetic + live lens links',
  (await epage.evaluate(() => document.querySelector('#prose-c6').innerHTML)).includes('../privacy-lens.html?lens=owner'));
await epage.click('#rg-bee');
/* the act: wrong answer refused, right answer receipts + live links */
await epage.check('input[name=c6][data-i="0"]');
await epage.click('#ex-c6-go');
ok('wrong answer refused with guidance', (await epage.evaluate(() => document.querySelector('#ex-c6-fb').innerText)).includes('not that one'));
await epage.check('input[name=c6][data-i="1"]');
await epage.click('#ex-c6-go');
const act = await epage.evaluate(() => ({
  fb: document.querySelector('#ex-c6-fb').innerText,
  links: [...document.querySelectorAll('#ex-c6-fb a')].map(a => a.getAttribute('href')),
  line: document.querySelector('#line-c6').innerText }));
ok('right answer passes and the lesson ENDS on the live lens links',
  act.fb.includes('exactly') && act.links.includes('../privacy-lens.html?lens=stranger') && act.links.includes('../privacy-lens.html?lens=owner'),
  act.links.join(' '));
ok('the [bUni · c6] receipt line lands', act.line.includes('[bUni · c6]'));
ok('transcript collected the act', (await epage.evaluate(() => document.getElementById('tlines').innerText)).includes('[bUni · c6]'));
/* course #2 stub */
ok('course #2 STUB present with the vending link',
  edu.includes('HOW THE VENDING MACHINE MINTS YOU AN AGENT') && edu.includes('STUB'));
const stubLink = await epage.evaluate(() => [...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '../vending.html'));
ok('the stub links the live machine', stubLink);
ok('act counts now include course #1 (of 6)', (await epage.evaluate(() => document.getElementById('tstate').innerText)).includes('of 6 acts'));
ok('zero page errors (university)', eerrors.length === 0, eerrors.join(' | '));
await epage.locator('#courses section', { hasText: 'HOW YOUR PRIVATE NOTE WORKS' }).scrollIntoViewIfNeeded();
await epage.screenshot({ path: join(OUT, 'edu-course1-390.png'), fullPage: false });

await browser.close(); srv.close();
console.log(fail ? `\n${fail} FAIL` : '\nprivacy lens + course receipt: ALL PASS');
process.exit(fail ? 1 : 0);
