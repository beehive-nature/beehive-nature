/* scan-clean-verify.mjs — the salvage lane's live verification (lane/zB-scan-clean).
   Three pages, one law each:
   1. gallery — the default wing is STILL the founder's garden (0xfbd20147…),
      live-rendered from the chain (pieces > 0), resolver fallback intact.
   2. explorer — the Purse rides as a NAMED EXHIBIT (button + holders-ladder
      rung TWO), while rung one stays the founder's garden. Never a default.
   3. profile — the person-scan engine is present, its Multicall3 codec is
      byte-honest (agg3Data word-for-word against an independently constructed
      vector; agg3Decode against a hand-built return), and aggregate3 answers
      LIVE with the purse vector: FROGGI in [52, 53) whole, FUNGI 0, dead
      contract → failure → '0x'. The founder chip resolves the garden and
      renders its tokens.
   Served from the repo root so ../tour.js resolves exactly as Pages serves it. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.setHeader('content-type', MIME[extname(rel)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('nf'); }
}).listen(8894);

const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const PURSE  = '0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479';
const FROGGI = '0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE';
const FUNGI  = '0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F';
const results = [];
const check = (name, ok, detail='') => { results.push({name, ok, detail}); console.log((ok?'PASS':'FAIL')+'  '+name+(detail?'  — '+detail:'')); };

const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });

/* ---------- 1. gallery: the default wing is the founder's garden, live ---------- */
try {
  await page.goto('http://127.0.0.1:8894/surfaces/blight/gallery.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForFunction(() => Array.isArray(window.__garden) && window.__garden.length > 0, null, { timeout:60000 });
  const wing = await page.textContent('#wing');
  check('gallery default wing label', /founder's garden/.test(wing), JSON.stringify(wing));
  const n = await page.evaluate(() => window.__garden.length);
  check('gallery default renders live pieces', n > 0, n + ' piece(s) from ' + GARDEN.slice(0,10) + '…');
  await page.screenshot({ path: join(HERE, 'shots-zb-visual', 'gallery-salvage.png'), fullPage:false });
} catch (e) { check('gallery default wing (live)', false, String(e).slice(0,160)); }

/* ---------- 2. explorer: the Purse is a named exhibit, never the default ---------- */
try {
  await page.goto('http://127.0.0.1:8894/surfaces/blight/inscription-explorer.html', { waitUntil:'domcontentloaded', timeout:30000 });
  const btn = await page.$eval('button[data-a="0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479"]', b => b.textContent.trim());
  check('explorer purse exhibit button (address-pinned)', /Lost Purse/.test(btn), JSON.stringify(btn));
  const noName = await page.$$eval('button[data-a="bqueenbee.base.eth"]', bs => bs.length);
  check('explorer purse never points at the name', noName === 0, 'found ' + noName);
  const ladder = await page.evaluate(() => HOLDERS_LADDER.map(r => [r[0], r[1]]));
  check('explorer ladder rung 1 = founder garden', ladder[0][0] === GARDEN, JSON.stringify(ladder[0]));
  check('explorer ladder rung 2 = the Purse', ladder[1][0] === PURSE && /Lost Purse/.test(ladder[1][1]), JSON.stringify(ladder[1]));
  await page.screenshot({ path: join(HERE, 'shots-zb-visual', 'explorer-salvage.png'), fullPage:false });
} catch (e) { check('explorer purse exhibit', false, String(e).slice(0,160)); }

/* ---------- 3. profile: engine present, codec byte-honest, aggregate3 live ---------- */
try {
  await page.goto('http://127.0.0.1:8894/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
  const chip = await page.textContent('#chip-founder');
  check('profile chip label = bloverai garden', /bloverai\.base\.eth/.test(chip), JSON.stringify(chip));

  const fns = await page.evaluate(() => ['scanPerson','scanDeeper','agg3Data','agg3Decode','aggregate3'].map(f => typeof window[f] === 'function' || typeof eval(f) === 'function'));
  check('profile engine functions present', fns.every(Boolean), JSON.stringify(fns));
  const mc = await page.evaluate(() => MULTICALL3);
  check('profile MULTICALL3 constant', mc.toLowerCase() === '0xca11bde05977b3631167028862be2a173976ca11', mc);

  /* agg3Data oracle — expected hex built INDEPENDENTLY here, word by word:
     selector, 0x20, N, offset table (from length word), tuples (target, allowFailure=1, bytesOff=0x60, len, padded data) */
  const encOk = await page.evaluate(() => {
    const w = n => BigInt(n).toString(16).padStart(64, '0');
    const a1 = '1111111111111111111111111111111111111111'.padStart(64, '0'), a2 = '2222222222222222222222222222222222222222'.padStart(64, '0');
    const got = agg3Data([{to:'0x1111111111111111111111111111111111111111', data:'0xdeadbeef'}, {to:'0x2222222222222222222222222222222222222222', data:'0xabcdef'}]).slice(2);
    const exp = '82ad56cb' + w(0x20) + w(2) + w(64) + w(224)
      + a1 + w(1) + w(96) + w(4) + 'deadbeef' + '0'.repeat(56)
      + a2 + w(1) + w(96) + w(3) + 'abcdef' + '0'.repeat(58);
    return got === exp;
  });
  check('profile agg3Data word-for-word oracle', encOk);

  /* agg3Decode oracle — return shape hand-built to the decoder's chain-verified
     layout: [0x20][N][offsets from array body][elem: success, bytesOff(0x40 →
     bytes right after the two head words), len, data]. Data comes back at
     EXACTLY len bytes — unpadded. Failure flag forces '0x' regardless of data. */
  const decOk = await page.evaluate(() => {
    const w = n => BigInt(n).toString(16).padStart(64, '0');
    const hx = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const hex = w(0x20) + w(2) + w(64) + w(192)
      + w(1) + w(0x40) + w(5) + hx('hello').padEnd(64, '0')
      + w(0) + w(0x40) + w(3) + hx('abc').padEnd(64, '0');
    const out = agg3Decode('0x' + hex);
    return Array.isArray(out) && out.length === 2
      && out[0] === '0x' + hx('hello')
      && out[1] === '0x';
  });
  check('profile agg3Decode success-flag oracle', decOk);

  /* aggregate3 LIVE — the purse vector: FROGGI in [52,53), FUNGI 0, dead → '0x' */
  const live = await page.evaluate(async ({ PURSE, FROGGI, FUNGI }) => {
    return await aggregate3([
      {to: FROGGI, data: '0x70a08231' + PURSE.slice(2).padStart(64, '0')},
      {to: FUNGI,  data: '0x70a08231' + PURSE.slice(2).padStart(64, '0')},
      {to: '0x000000000000000000000000000000000000dEaD', data: '0x70a08231' + PURSE.slice(2).padStart(64, '0')},
    ]);
  }, { PURSE, FROGGI, FUNGI });
  const froggiBal = live && live[0] ? BigInt(live[0]) : null;
  const fungiBal  = live && live[1] ? BigInt(live[1]) : null;
  check('profile aggregate3 live: purse FROGGI ~52', froggiBal !== null && froggiBal >= 52n*10n**9n && froggiBal < 53n*10n**9n, froggiBal === null ? 'null' : (Number(froggiBal)/1e9).toFixed(4) + ' FROGGI');
  check('profile aggregate3 live: purse FUNGI = 0', fungiBal === 0n, fungiBal === null ? 'null' : fungiBal.toString());
  check('profile aggregate3 live: dead contract → failure → 0x', live && live[2] === '0x', JSON.stringify(live && live[2]));

  /* the founder chip resolves the garden and renders its tokens, live */
  await page.click('#chip-founder');
  await page.waitForFunction(() => /rendered from chain|holds nothing/.test(document.getElementById('msg').textContent), null, { timeout:60000 });
  const msg = await page.textContent('#msg');
  const tokens = await page.textContent('#st-tokens');
  check('profile founder chip → live garden render', /rendered from chain/.test(msg) && parseInt(tokens) > 0, 'tokens=' + tokens + ' · ' + msg);
  await page.screenshot({ path: join(HERE, 'shots-zb-visual', 'profile-salvage.png'), fullPage:false });
} catch (e) { check('profile engine + live aggregate3', false, String(e).slice(0,200)); }

await browser.close(); server.close();
const failed = results.filter(r => !r.ok).length;
console.log('\n' + (failed ? failed + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASS'));
process.exit(failed ? 1 : 0);
