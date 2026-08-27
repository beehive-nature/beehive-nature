/* inscription-fidelity-verify.mjs — the walls must render EXACTLY what the
   contracts answer. Method: node independently calls each collection's degree
   record (sporesDegree / polypsDegree / dynamicInscription) and enumeration
   for the garden, decodes the SVGs, then compares BYTE-FOR-BYTE against the
   page's window.__rawPieces. Also asserts JELLI + FROGGI enumerated pieces
   now appear (their dialects were never spoken before). */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8912';
const PAGE = process.env.PAGE || '/surfaces/blight/inscription-explorer.html';
const RPC = 'https://base-rpc.publicnode.com';
const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const COLS = {
  FUNGI:  { c:'0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F', sel:'422b9e23', deg:'a775188a', cnt:'9c216508', idx:'0fd9587e' },
  JELLI:  { c:'0xA1b9d812926a529D8B002E69FCd070c8275eC73c', sel:'422b9e23', deg:'68b77feb', cnt:'3ebccc57', idx:'e5100df8' },
  FROGGI: { c:'0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE', sel:'422b9e23', deg:'2bd1a011', cnt:'fb700e5b', idx:'c7218d5b' },
  PEPIv2: { c:'0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', sel:'a435130b', deg:'a775188a', cnt:'9c216508', idx:'0fd9587e' },
  TRUFFI: { c:'0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38', sel:'a62f5b1b', deg:'2bd1a011', cnt:'fb700e5b', idx:'c7218d5b' },
};
const results = [];
const check = (name, ok, detail='') => { results.push({name, ok}); console.log((ok?'PASS':'FAIL')+'  '+name+(detail?'  — '+detail:'')); };
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
async function call(to, data) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result !== undefined ? j.result : null;
}
function decodeStr(hex) {
  const h = hex.replace(/^0x/, '');
  if (h.length < 192 || parseInt(h.slice(0, 64), 16) !== 0x20) return null;
  const len = parseInt(h.slice(64, 128), 16);
  if (!(len > 0 && len <= 65536) || h.length < 128 + len * 2) return null;
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(h.slice(128 + i*2, 130 + i*2), 16));
  return s;
}
const words = ret => (ret.replace(/^0x/, '').match(/.{64}/g) || []);

/* expected: degree piece per collection + up to 2 enumerated each */
const expected = {};
for (const [sym, col] of Object.entries(COLS)) {
  const deg = await call(col.c, '0x' + col.deg + ad(GARDEN));
  if (deg && deg !== '0x') {
    const rec = words(deg);
    if (rec.length >= 2) {
      const svg = await call(col.c, col.sel + w(0x20) + rec.slice(0, 3).join(''));
      const s = decodeStr(svg || '');
      if (s) expected[sym + ':degree'] = s;
    }
  }
  const cnt = await call(col.c, '0x' + col.cnt + ad(GARDEN));
  const n = cnt && cnt !== '0x' ? Number(BigInt(cnt)) : 0;
  for (let i = 0; i < Math.min(n, 2); i++) {
    const rec = await call(col.c, '0x' + col.idx + ad(GARDEN) + w(i));
    if (!rec || rec === '0x') continue;
    const rw = words(rec);
    if (rw.length < 2) continue;
    const svg = await call(col.c, col.sel + w(0x20) + rw.slice(0, 3).join(''));
    const s = decodeStr(svg || '');
    if (s) expected[sym + ':enum' + i] = s;
  }
}
console.log('independent chain answers:', Object.keys(expected).map(k => k + '(' + expected[k].length + 'B)').join(' '));

const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 100)));
await page.goto(BASE + PAGE, { waitUntil:'domcontentloaded', timeout:30000 });

if (PAGE.includes('inscription-explorer')) {
  await page.fill('#addr', GARDEN);
  await page.click('#frm button');
} else {
  await page.click('#chip-founder');
}
await page.waitForFunction(() => Array.isArray(window.__rawPieces) && window.__rawPieces.length > 0, null, { timeout:90000 });
/* the walk pushes pieces sequentially per collection — wait for it to settle
   (two identical counts 2.5s apart) before comparing */
let prev = -1, stable = 0;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2500);
  const n = await page.evaluate(() => (window.__rawPieces || []).length);
  if (n === prev) stable++; else stable = 0;
  prev = n;
  if (stable >= 1 && n > 3) break;
}
await page.waitForTimeout(1000);

const raw = await page.evaluate(() => window.__rawPieces || []);
const rawSet = new Map();
for (const p of raw) if (!rawSet.has(p.sym)) rawSet.set(p.sym, []);
for (const p of raw) rawSet.get(p.sym).push(p.svg);

let matches = 0, misses = [];
for (const [key, svg] of Object.entries(expected)) {
  const sym = key.split(':')[0];
  const pool = rawSet.get(sym === 'PEPIv2' ? 'PEPI v2' : sym === 'FROGGI' ? '$FROGGI' : sym) || [];
  if (pool.includes(svg)) matches++;
  else misses.push(key);
}
check('byte-for-byte fidelity: every chain answer renders verbatim', matches === Object.keys(expected).length && matches > 0,
  matches + '/' + Object.keys(expected).length + (misses.length ? ' MISSING: ' + misses.join(',') : ''));
check('JELLI pieces on the wall (medusa dialect)', (rawSet.get('JELLI') || []).length >= 2, (rawSet.get('JELLI') || []).length + ' JELLI SVGs');
check('FROGGI pieces on the wall (inscription dialect)', (rawSet.get('$FROGGI') || []).length >= 2, (rawSet.get('$FROGGI') || []).length + ' FROGGI SVGs');
check('FUNGI degree piece present (the canonical record)', (rawSet.get('FUNGI') || []).some(s => s === expected['FUNGI:degree']));
check('no page errors', errors.length === 0, errors[0] || 'clean');
await page.screenshot({ path:'e2e/shots-zb-visual/fidelity-' + (PAGE.includes('explorer') ? 'explorer' : 'profile') + '-390.png' });
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log('\n' + (failed ? failed + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASS'));
process.exit(failed ? 1 : 0);
