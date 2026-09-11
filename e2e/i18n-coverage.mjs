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
 * This measures translation reach for laid-out lettered leaf elements, not
 * sentences, every page label, visibility or delivered translation quality.
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
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { validatePageSet, inspectCoverage } from './coverage-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const {measureVisibleText,summarizeCoverage}=createRequire(import.meta.url)('../surfaces/lang.js');
const censusScript='('+measureVisibleText.toString()+')(document)';
const corpus = JSON.parse(readFileSync(join(SURF, 'lang-corpus.json'), 'utf8'));
const LANG = process.argv.find(a => /^[a-z]{2}(-[a-z]{2})?$/.test(a)) || 'ru';
const AS_JSON = process.argv.includes('--json');
/* the language-lane extensions (2026-08-28):
   --set <file>      measure only the pages listed (paths relative to surfaces/)
   --selftest        the checker-silence proof: a known keyed string AND a known
                     unkeyed string through the SAME measurement path; exit 1 if
                     the instrument cannot tell them apart
   --floors          ratchet gate: fail any measured page below its recorded floor
                     (e2e/lang-coverage-floors.json, ABSOLUTE keyed count per page — the carrier changed 2026-08-29: a percentage regresses when other lanes land new UI; the law protects keys, not ratios). The deep
                     backlog stays a recorded number — floors hold the line, they
                     never demand the backlog be cleared.
   --set-floors      advance absolute keyed-count floors after successful measurement */
const SET_ARG = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1] : null;
if(process.argv.includes('--set') && (!SET_ARG || SET_ARG.startsWith('--')))
  throw new Error('--set requires a page-set file');
const SELFTEST = process.argv.includes('--selftest');
const USE_FLOORS = process.argv.includes('--floors');
const SET_FLOORS = process.argv.includes('--set-floors');
const EMIT = process.argv.includes('--emit-md');

/* ── SELFTEST — the instrument must see both states before it reports anything ──
   A checker that has only ever met keyed strings passes keyed strings; one that
   has only ever met unkeyed strings passes unkeyed strings. Prove both, same path. */
if (SELFTEST) {
  const examples={en:'I',ru:'Я',lv:'Ā',th:'ก',gd:'À',tt:'Ә',uk:'Ї',cs:'Č',zh:'中',ko:'말',ar:'ع',
    'nl-be':'Ja',es:'Sí',nl:'Ja',de:'Ö',fr:'À',he:'ב',hi:'क',bn:'ক',fa:'ژ',ur:'ژ',ja:'字',
    da:'Å',nb:'Ø',sv:'Ö',fi:'Ö',tr:'İ',hu:'Ő',sa:'क'};
  const languages=['en',...corpus._meta.langs];
  if(languages.some(lang=>!examples[lang])) throw new Error('A docked language needs a selftest example');
  const fixture = '<!doctype html><html><head><meta charset="utf-8"></head><body>'+languages.map(lang=>
    '<p data-i18n="selftest.'+lang+'">'+examples[lang]+'</p><p>'+examples[lang]+'</p>').join('')+
    '<p data-i18n="selftest.rich"><span>中</span><em>ก</em></p>'+
    '<p hidden data-i18n="selftest.hidden">hidden words</p>'+
    '<div id="tbar"><span data-i18n="selftest.chrome">navigation words</span></div>'+
    '<p>12345 · —</p></body></html>';
  const srv = createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(fixture); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser=await chromium.launch();
    const p=await browser.newPage();
    await p.goto(`http://127.0.0.1:${srv.address().port}/fixture.html`,{waitUntil:'load'});
    // Exactly the function the language picker uses; no second test-only walker.
    const m=await p.evaluate(censusScript);
    const expectedKeys=languages.map(lang=>'selftest.'+lang).concat(['selftest.rich','selftest.rich']);
    const good=m.visible===languages.length*2+2 && m.keyed===languages.length+2 &&
      JSON.stringify(m.keys)===JSON.stringify(expectedKeys) && m.unkeyedSamples.length===3;
    console.log((good?'PASS':'FAIL')+' i18n-coverage selftest — '+languages.length+
      ' languages, short labels, keyed/unkeyed and nested holders: '+m.keyed+'/'+m.visible);
    if(!good) console.error(JSON.stringify({charset:await p.evaluate(()=>document.characterSet),expectedKeys,measured:m}));
    process.exitCode=good?0:1;
  } finally {if(browser) await browser.close();srv.close();}
  process.exit(process.exitCode||0);
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
  ? validatePageSet(JSON.parse(readFileSync(existsSync(join(ROOT, SET_ARG)) ? join(ROOT, SET_ARG) : join(HERE, SET_ARG), 'utf8')))
  : validatePageSet((await walk(SURF)).sort());
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let browser;
try {browser=await chromium.launch();} catch(error){server.close();throw error;}
const rows = [];

for (const page of pages) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    if(!existsSync(join(SURF,page))) throw new Error('Requested surface does not exist');
    const response=await p.goto(`${BASE}/${page}`, { waitUntil: 'load' });
    if(!response || !response.ok()) throw new Error('Surface did not load successfully');
    await p.evaluate(l => { try { localStorage.setItem('blang', l); } catch (e) {} }, LANG);
    const reloaded=await p.reload({ waitUntil: 'load' });
    if(!reloaded || !reloaded.ok()) throw new Error('Surface reload did not succeed');
    await p.waitForTimeout(700);

    const m = await p.evaluate(censusScript);

    /* Of the keyed strings, how many can this tongue actually fill? Split the
       two states the reader cannot tell apart. */
    const counts=summarizeCoverage(m,corpus.strings,LANG);
    rows.push({
      page,
      ...counts,
      pct: m.visible ? Math.round((counts.filled / m.visible) * 100) : null,
      keysUsed: m.keys,
      unkeyedSamples: m.unkeyedSamples,
    });
  } catch (e) {
    rows.push({ page, error: String(e).slice(0, 80) });
  }
  await p.close();
}

await browser.close();
server.close();

/* Gate before choosing a report format. Errors and JSON cannot bypass floors. */
const FLOORFILE=join(HERE,'lang-coverage-floors.json');
const floors=(USE_FLOORS||SET_FLOORS) && existsSync(FLOORFILE)
  ? JSON.parse(readFileSync(FLOORFILE,'utf8')) : {};
const gate=inspectCoverage(rows,floors,USE_FLOORS||SET_FLOORS);
if(USE_FLOORS && !existsSync(FLOORFILE)) {
  gate.errors.push('Coverage floor file is missing');gate.passed=false;
}
if(!gate.passed) process.exitCode=1;
if(SET_FLOORS && gate.passed) {
  for(const row of rows)
    if(!(row.page in floors) || row.keyed>floors[row.page]) floors[row.page]=row.keyed;
  writeFileSync(FLOORFILE,JSON.stringify(floors,null,1)+'\n');
}

if (AS_JSON) {
  console.log(JSON.stringify({ lang: LANG, rows, gate }, null, 1));
} else {
  const ok = rows.filter(r => !r.error);
  const totV = ok.reduce((a, r) => a + r.visible, 0);
  const totF = ok.reduce((a, r) => a + r.filled, 0);
  const totU = ok.reduce((a, r) => a + r.unkeyed, 0);
  const totE = ok.reduce((a, r) => a + r.emptyCell, 0);
  const totM = ok.reduce((a, r) => a + r.missingKey, 0);
  const totK = ok.reduce((a, r) => a + r.keyed, 0);

  console.log(`i18n COVERAGE — structural corpus reach for ${LANG} (laid-out lettered leaves)`);
  console.log(`surfaces measured : ${ok.length}${SET_ARG ? ' (from ' + SET_ARG + ')' : ''}`);
  console.log(`visible strings   : ${totV}`);
  console.log(`keyed             : ${totK}  (${totV ? Math.round(totK / totV * 100)+'%' : 'n/a'} of measured leaves)`);
  console.log(`reach ${LANG}          : ${totF}  (${totV ? Math.round(totF / totV * 100)+'%' : 'n/a'})`);
  console.log(`UNKEYED           : ${totU}  — no tongue can ever reach these`);
  console.log(`keyed, EMPTY CELL : ${totE}  — falls back to English visibly, by the corpus law`);
  console.log(`MISSING CORPUS KEY: ${totM}  — keyed leaf has no corpus entry`);

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
        const n = [...usedKeys].filter(k => typeof corpus.strings[k]?.[L]==='string' && corpus.strings[k][L].trim()).length;
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

  if (EMIT && gate.passed) {
    const lines = [];
    lines.push('# LANG COVERAGE — generated ' + new Date().toISOString().slice(0, 10) + ' by e2e/i18n-coverage.mjs --emit-md (lang=' + LANG + ')');
    lines.push('');
    lines.push('## per surface — visible strings vs keyed');
    lines.push('');
    lines.push('| surface | visible | keyed | keyed% |');
    lines.push('|---|---|---|---|');
    ok.sort((a, b) => b.visible - a.visible).forEach(r => lines.push('| ' + r.page + ' | ' + r.visible + ' | ' + r.keyed + ' | ' + (r.visible ? Math.round(r.keyed / r.visible * 100)+'%' : 'n/a') + ' |'));
    lines.push('');
    lines.push('## per tongue — corpus cells non-empty');
    lines.push('');
    lines.push('| tongue | cells non-empty |');
    lines.push('|---|---|');
    const langs = corpus._meta.langs;
    let totalCells = 0, filledCells = 0;
    langs.forEach(L => {
      let f = 0, t = 0;
      for (const k of Object.keys(corpus.strings)) { t++; if (typeof corpus.strings[k][L]==='string' && corpus.strings[k][L].trim()) f++; }
      totalCells = t; filledCells = f;
      lines.push('| ' + L + ' | ' + f + ' / ' + t + ' |');
    });
    lines.push('');
    lines.push('the ratchet law: keyed counts may never fall (enforced in CI). unkeyed prose is the recorded backlog — honest absence, English fallback visible, counted by the picker.');
    writeFileSync(join(ROOT,'docs/LANG-COVERAGE.md'), lines.join(String.fromCharCode(10)) + String.fromCharCode(10));
    console.log('coverage table written: docs/LANG-COVERAGE.md');
  }

  if(SET_FLOORS && gate.passed) console.log('\nfloors advanced (absolute keyed counts; ratchet only rises)');
  if(USE_FLOORS||SET_FLOORS) console.log('\n'+(gate.passed?'PASS':'FAIL')+' coverage measurement and keyed-count floors');
  for(const error of gate.errors) console.error('FAIL measurement — '+error);
  for(const row of gate.breaches) console.error('FAIL floor — '+row.page+': '+row.keyed+' keyed, floor '+row.floor);
}
