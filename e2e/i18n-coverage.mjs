/* i18n-coverage.mjs — THE DENOMINATOR NOBODY HAD.
 *
 * The founder found hardware/lab.html rendering ONE Russian string on a page
 * where Russian was selected. Every gate we had was green, because every gate
 * measured the wrong thing:
 *
 *   estate-source  : every data-i18n key EXISTS in the corpus        ✔ green
 *   estate-source  : every tongue covers every corpus KEY            ✔ green
 *   the round-trip : the door keys SAY the right thing               ✔ green
 *
 * All three measure keys that exist. None of them can see a string that was
 * never keyed at all — an unkeyed paragraph is invisible to a checker that
 * only walks `[data-i18n]`. 100% of the keys can be perfect while 3% of the
 * page is translated.
 *
 * So this measures the PAGE, not the corpus: how much of what a reader can
 * actually see is reachable by a tongue.
 *
 * TWO FAILURE STATES, IDENTICAL TO A READER, SEPARATED HERE (founder, item 3):
 *   UNKEYED       — the text carries no data-i18n at all. No tongue can ever
 *                   reach it. It renders in English forever and no gate knows.
 *   EMPTY CELL    — the text is keyed, and the corpus has that key, but the
 *                   chosen tongue's cell is missing. lang.js falls back to
 *                   English visibly and counts it, which is the corpus law
 *                   working as designed.
 * A reader sees English either way. A report that conflates them sends the
 * next seat to fix the wrong thing, so this one never does — and NOTHING here
 * changes the render. No debug marker ever reaches a reader.
 *
 * Usage:  node e2e/i18n-coverage.mjs [lang]        (default ru)
 *         node e2e/i18n-coverage.mjs ru --json     (machine-readable)
 */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const LANG = process.argv.find(a => /^[a-z]{2}(-[a-z]{2})?$/.test(a)) || 'ru';
const AS_JSON = process.argv.includes('--json');
/* the language-lane extensions (2026-08-28):
   --set <file>      measure only the pages listed (paths relative to surfaces/)
   --selftest        the checker-silence proof: a known keyed string AND a known
                     unkeyed string through the SAME measurement path; exit 1 if
                     the instrument cannot tell them apart
   --floors          ratchet gate: fail any measured page below its recorded floor
                     (e2e/lang-coverage-floors.json, keyed% of visible). The deep
                     backlog stays a recorded number — floors hold the line, they
                     never demand the backlog be cleared.
   --set-floors      record the current keyed% as the floors (ratchet advance) */
const SET_ARG = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1] : null;
const SELFTEST = process.argv.includes('--selftest');
const USE_FLOORS = process.argv.includes('--floors');
const SET_FLOORS = process.argv.includes('--set-floors');

/* ── SELFTEST — the instrument must see both states before it reports anything ──
   A checker that has only ever met keyed strings passes keyed strings; one that
   has only ever met unkeyed strings passes unkeyed strings. Prove both, same path. */
if (SELFTEST) {
  const fixture = `<!doctype html><html><body>
<p data-i18n="selftest.keyed">the keyed sentence lives here</p>
<p>the unkeyed sentence lives here too</p>
</body></html>`;
  const srv = createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(fixture); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/fixture.html`, { waitUntil: 'load' });
  const m = await p.evaluate(() => {
    const CHROME = '#tbar, #adOrb, #adPanel, #tbarMore, #railsbadge, #bregctl, #blangctl, #veil, #bandwrap';
    const out = { visible: 0, keyed: 0, keys: [], unkeyedSamples: [] };
    for (const n of document.querySelectorAll('body *')) {
      if (n.children.length) continue;
      if (n.closest(CHROME)) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'SVG', 'PATH', 'OPTION'].includes(n.tagName)) continue;
      const t = (n.textContent || '').trim();
      if (t.length < 3) continue;
      if (!/[A-Za-zА-Яа-яЀ-ӿ]/.test(t)) continue;
      const r = n.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.visible++;
      const holder = n.closest('[data-i18n]');
      if (holder) { out.keyed++; out.keys.push(holder.getAttribute('data-i18n')); }
      else if (out.unkeyedSamples.length < 3) out.unkeyedSamples.push(t.slice(0, 60));
    }
    return out;
  });
  const good = m.visible === 2 && m.keyed === 1 && m.unkeyedSamples.length === 1 &&
    m.keys[0] === 'selftest.keyed' && /unkeyed sentence/.test(m.unkeyedSamples[0]);
  console.log((good ? 'PASS' : 'FAIL') + ' i18n-coverage selftest — the same path counts a keyed string (' +
    m.keyed + ') and an unkeyed string (' + m.unkeyedSamples.length + ') differently');
  await browser.close(); srv.close();
  process.exit(good ? 0 : 1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const orig = rel;
    rel = rel.replace(/^surfaces\//, '');
    const p = join(SURF, rel);
    let body;
    try { body = await readFile(extname(p) ? p : join(p, 'index.html')); }
    catch { const q = join(ROOT, orig); body = await readFile(extname(q) ? q : join(q, 'index.html')); }
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const corpus = JSON.parse(readFileSync(join(SURF, 'lang-corpus.json'), 'utf8'));

async function walk(dir, base = '') {
  let out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name === 'fleet' && !base) continue;
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(await walk(join(dir, e.name), rel));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
const pages = SET_ARG
  ? JSON.parse(readFileSync(existsSync(join(ROOT, SET_ARG)) ? join(ROOT, SET_ARG) : join(HERE, SET_ARG), 'utf8')).filter(f => existsSync(join(SURF, f)))
  : (await walk(SURF)).sort();

const browser = await chromium.launch();
const rows = [];

for (const page of pages) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await p.goto(`${BASE}/${page}`, { waitUntil: 'load' });
    await p.evaluate(l => { try { localStorage.setItem('blang', l); } catch (e) {} }, LANG);
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(700);

    const m = await p.evaluate(() => {
      /* A VISIBLE STRING is a leaf element carrying real words that a reader
         can see. Leaves only, so a paragraph is not counted again for every
         ancestor; the estate's injected chrome is excluded because the tour
         bar and the dock are not this page's content. */
      const CHROME = '#tbar, #adOrb, #adPanel, #tbarMore, #railsbadge, #bregctl, #blangctl, #veil, #bandwrap';
      const out = { visible: 0, keyed: 0, keys: [], unkeyedSamples: [] };
      for (const n of document.querySelectorAll('body *')) {
        if (n.children.length) continue;
        if (n.closest(CHROME)) continue;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'SVG', 'PATH', 'OPTION'].includes(n.tagName)) continue;
        const t = (n.textContent || '').trim();
        if (t.length < 3) continue;                 // glyphs and separators are not strings
        if (!/[A-Za-zА-Яа-яЀ-ӿ]/.test(t)) continue;   // pure numbers/punctuation
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        out.visible++;
        const holder = n.closest('[data-i18n]');
        if (holder) { out.keyed++; out.keys.push(holder.getAttribute('data-i18n')); }
        else if (out.unkeyedSamples.length < 3) out.unkeyedSamples.push(t.slice(0, 60));
      }
      return out;
    });

    /* Of the keyed strings, how many can this tongue actually fill? Split the
       two states the reader cannot tell apart. */
    let filled = 0, emptyCell = 0, missingKey = 0;
    const emptySamples = [];
    for (const k of m.keys) {
      const e = corpus.strings[k];
      if (!e) { missingKey++; continue; }
      if (e[LANG] && String(e[LANG]).trim()) filled++;
      else { emptyCell++; if (emptySamples.length < 3) emptySamples.push(k); }
    }
    const unkeyed = m.visible - m.keyed;
    rows.push({
      page,
      visible: m.visible,
      keyed: m.keyed,
      filled,
      unkeyed,
      emptyCell,
      missingKey,
      pct: m.visible ? Math.round((filled / m.visible) * 100) : 100,
      keysUsed: m.keys,
      unkeyedSamples: m.unkeyedSamples,
      emptySamples,
    });
  } catch (e) {
    rows.push({ page, error: String(e).slice(0, 80) });
  }
  await p.close();
}

await browser.close();
server.close();

if (AS_JSON) {
  console.log(JSON.stringify({ lang: LANG, rows }, null, 1));
} else {
  const ok = rows.filter(r => !r.error);
  const totV = ok.reduce((a, r) => a + r.visible, 0);
  const totF = ok.reduce((a, r) => a + r.filled, 0);
  const totU = ok.reduce((a, r) => a + r.unkeyed, 0);
  const totE = ok.reduce((a, r) => a + r.emptyCell, 0);
  const totK = ok.reduce((a, r) => a + r.keyed, 0);

  console.log(`i18n COVERAGE — what a ${LANG} reader can actually read`);
  console.log(`surfaces measured : ${ok.length}${SET_ARG ? ' (from ' + SET_ARG + ')' : ''}`);
  console.log(`visible strings   : ${totV}`);
  console.log(`keyed             : ${totK}  (${totV ? Math.round(totK / totV * 100) : 100}% of visible — the axis every tongue can reach)`);
  console.log(`reach ${LANG}          : ${totF}  (${totV ? Math.round(totF / totV * 100) : 100}%)`);
  console.log(`UNKEYED           : ${totU}  — no tongue can ever reach these`);
  console.log(`keyed, EMPTY CELL : ${totE}  — falls back to English visibly, by the corpus law`);

  /* the per-tongue axis: of every key the measured set actually uses, which
     tongues hold a non-empty cell. The corpus-side half of the measure. */
  {
    const usedKeys = new Set();
    for (const r of ok) for (const k of (r.keysUsed || [])) usedKeys.add(k);
    const langs = corpus._meta.langs;
    if (usedKeys.size) {
      console.log('');
      console.log(`PER TONGUE — non-empty cells for the ${usedKeys.size} keys this set uses:`);
      const per = langs.map(L => {
        const n = [...usedKeys].filter(k => corpus.strings[k] && corpus.strings[k][L] && String(corpus.strings[k][L]).trim()).length;
        return { L, pct: Math.round(n / usedKeys.size * 100) };
      }).sort((a, b) => a.pct - b.pct);
      console.log('  ' + per.map(x => x.L + ' ' + x.pct + '%').join(' · '));
    }
  }

  console.log('');
  console.log('TEN WORST BY PERCENTAGE (of surfaces with 10+ visible strings):');
  console.log('  ' + 'pct'.padStart(4) + '  ' + 'vis'.padStart(4) + ' ' + 'keyed'.padStart(5) + ' ' + 'key%'.padStart(4) + ' ' + 'fill'.padStart(4) + ' ' + 'unkey'.padStart(5) + ' ' + 'empty'.padStart(5) + '  page');
  ok.filter(r => r.visible >= 10).sort((a, b) => a.pct - b.pct || b.visible - a.visible).slice(0, 10)
    .forEach(r => console.log('  ' + String(r.pct + '%').padStart(4) + '  ' + String(r.visible).padStart(4) + ' ' +
      String(r.keyed).padStart(5) + ' ' + String((r.visible ? Math.round(r.keyed / r.visible * 100) : 100) + '%').padStart(4) + ' ' +
      String(r.filled).padStart(4) + ' ' +
      String(r.unkeyed).padStart(5) + ' ' + String(r.emptyCell).padStart(5) + '  ' + r.page));
  const errs = rows.filter(r => r.error);
  if (errs.length) { console.log('\nnot measured:'); errs.forEach(r => console.log('  ' + r.page + ' — ' + r.error)); }

  /* the ratchet: floors hold the recorded line; the deep backlog is a number
     here, not a demand. The ratchet only ever rises. */
  if (USE_FLOORS || SET_FLOORS) {
    const FLOORFILE = join(HERE, 'lang-coverage-floors.json');
    const floors = existsSync(FLOORFILE) ? JSON.parse(readFileSync(FLOORFILE, 'utf8')) : {};
    if (SET_FLOORS) {
      for (const r of ok) {
        const pct = r.visible ? Math.round(r.keyed / r.visible * 100) : 100;
        if (!(r.page in floors) || pct > floors[r.page]) floors[r.page] = pct;
      }
      writeFileSync(FLOORFILE, JSON.stringify(floors, null, 1) + '\n');
      console.log('\nfloors advanced: ' + ok.length + ' pages recorded (ratchet only rises)');
    } else {
      const breaches = ok.filter(r => r.visible >= 10 && floors[r.page] !== undefined &&
        (r.visible ? Math.round(r.keyed / r.visible * 100) : 100) < floors[r.page]);
      console.log('\n' + (breaches.length ? 'FAIL floors — keyed% regressed below the recorded line:' : 'PASS floors — no measured page fell below its recorded keyed%'));
      breaches.forEach(r => console.log('  ' + r.page + ' — now ' + Math.round(r.keyed / r.visible * 100) + '%, floor ' + floors[r.page] + '%'));
      if (breaches.length) process.exitCode = 1;
    }
  }
}
