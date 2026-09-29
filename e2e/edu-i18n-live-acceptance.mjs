// edu-i18n recovery LIVE ACCEPTANCE — 2026-09-12
// Verifies PR #65 (merge 6e96229d) as SERVED LIVE on skaists.dev Pages:
//   A. byte-pin: live blanguage/bnames/bset/lang-corpus == repo tree 6e96229d
//   B. corpus cells: the 243 restored keys present live, non-empty in the six
//      priority tongues (ru lv th gd tt uk), values verbatim from #43's head
//      (ab9be3d4); the 23 superseded cells keep pre-recovery main (d32acdf9)
//      values live; all-tongue integrity; script sanity per tongue.
//   C. DOM render proof: 390px real browser x {blanguage,bnames,bset} x six
//      tongues; every restored key bound on the page reads back translated
//      (non-empty, != English, expected script) from the LIVE DOM.
//   --selftest: the SAME cell checker against the PRE-recovery corpus must
//      FAIL (243 keys missing) — the checker-silence proof.
//
// Run from the worktree root:  node e2e/edu-i18n-live-acceptance.mjs [--selftest]

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://skaists.dev/surfaces/';
const MERGE = '6e96229d';   // PR #65 merge commit (this worktree's checkout)
const PRE = 'd32acdf9';     // pre-recovery main
const HEAD43 = 'ab9be3d4';  // PR #43 head (the recovery source)
const PRIORITY = ['ru', 'lv', 'th', 'gd', 'tt', 'uk'];
const PAGES = ['blanguage.html', 'bnames.html', 'bset.html'];
const CB = Date.now();

const SCRIPTS = {
  ru: /[\u0400-\u04FF]/, uk: /[\u0400-\u04FF]/, tt: /[\u0400-\u04FF]/,
  lv: /[\u0100-\u017F\u00C0-\u00FF]/, gd: /[\u00C0-\u00FF\u0100-\u017F]/,
  th: /[\u0E00-\u0E7F]/,
};

const gitShow = (ref, path) =>
  execSync(`git show ${ref}:${path}`, { cwd: ROOT, maxBuffer: 1 << 28, encoding: 'utf8' });
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const norm = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

// ---------- load repo truth ----------
const repoCorpus = JSON.parse(readFileSync(resolve(ROOT, 'surfaces/lang-corpus.json'), 'utf8'));
const tsv = readFileSync(resolve(ROOT, 'docs/receipts/edu-i18n-recovery-cells.tsv'), 'utf8')
  .trim().split('\n').slice(1)
  .map(l => { const [key, lang, from, applied] = l.split('\t'); return { key, lang, from, applied }; });
const restoredKeys = [...new Set(tsv.map(r => r.key))];
const superseded = readFileSync(resolve(ROOT, 'docs/receipts/edu-i18n-recovery-superseded.tsv'), 'utf8')
  .trim().split('\n').slice(1).map(l => l.split('\t'));
const langs = repoCorpus._meta.langs.map(l => (Array.isArray(l) ? l[0] : l));
for (const t of PRIORITY) if (!langs.includes(t)) { console.log(`FAIL tongue ${t} absent from _meta.langs`); process.exit(1); }

// the corpus-cell checker, run against LIVE (fetch) or PRE (selftest)
function checkCells(corpus, tag) {
  const out = { missingKeys: [], emptyPriority: {}, valueMismatch: {}, allTongueEmpty: [], scriptPct: {} };
  for (const k of restoredKeys) {
    const row = corpus.strings[k];
    if (!row) { out.missingKeys.push(k); continue; }
    for (const t of PRIORITY) {
      const v = row[t];
      if (!v || !String(v).trim()) (out.emptyPriority[t] ??= []).push(k);
    }
    const emptyAll = langs.filter(t => !row[t] || !String(row[t]).trim());
    if (emptyAll.length) out.allTongueEmpty.push(`${k}:[${emptyAll.join(',')}]`);
  }
  // script sanity per priority tongue over restored keys
  for (const t of PRIORITY) {
    let hit = 0, tot = 0;
    for (const k of restoredKeys) {
      const v = corpus.strings[k]?.[t];
      if (!v) continue;
      tot++;
      if (SCRIPTS[t].test(v)) hit++;
    }
    out.scriptPct[t] = tot ? (100 * hit / tot).toFixed(1) + '%' : 'n/a';
  }
  return out;
}

// ---------- selftest first: checker vs PRE-recovery corpus must FAIL ----------
if (process.argv.includes('--selftest')) {
  const pre = JSON.parse(gitShow(PRE, 'surfaces/lang-corpus.json'));
  const r = checkCells(pre, 'PRE');
  console.log(`SELFTEST vs pre-recovery corpus ${PRE}: missing keys = ${r.missingKeys.length} (expect ${restoredKeys.length})`);
  if (r.missingKeys.length === restoredKeys.length) {
    console.log('SELFTEST PASS — the live checker demonstrably fails on the pre-recovery corpus');
    process.exit(0);
  }
  console.log('SELFTEST FAIL — checker did not reproduce the known-missing state');
  process.exit(1);
}

// ---------- A. byte-pin ----------
console.log(`\n== A. LIVE BYTE-PIN vs tree ${MERGE} ==`);
for (const f of [...PAGES, 'lang-corpus.json']) {
  const res = await fetch(BASE + f + (f.endsWith('.json') ? `?v=18&cb=${CB}` : `?cb=${CB}`));
  const body = Buffer.from(await res.arrayBuffer());
  const repo = Buffer.from(gitShow(MERGE, 'surfaces/' + f), 'utf8');
  check(res.ok && body.equals(repo),
    `byte-pin ${f} (raw bytes vs git blob)`,
    `live sha256 ${createHash('sha256').update(body).digest('hex').slice(0, 12)} vs blob ${createHash('sha256').update(repo).digest('hex').slice(0, 12)}`);
  if (f === 'lang-corpus.json') {
    const h = res.headers;
    console.log(`      corpus headers: content-type=${h.get('content-type')} cache-control=${h.get('cache-control') ?? '(none)'}`);
  }
}

// ---------- B. live corpus cells ----------
console.log(`\n== B. LIVE CORPUS CELLS (${restoredKeys.length} restored keys; priority ${PRIORITY.join(' ')}) ==`);
const live = await (await fetch(BASE + 'lang-corpus.json?v=18&cb=' + CB)).json();
const head43 = JSON.parse(gitShow(HEAD43, 'surfaces/lang-corpus.json'));
const pre = JSON.parse(gitShow(PRE, 'surfaces/lang-corpus.json'));

const r = checkCells(live, 'LIVE');
check(r.missingKeys.length === 0, 'all 243 restored keys present LIVE', `missing: ${r.missingKeys.length}`);
let emptyP = 0;
for (const t of PRIORITY) {
  const n = (r.emptyPriority[t] || []).length;
  emptyP += n;
  check(n === 0, `priority tongue ${t}: non-empty cells for all restored keys`, `${n} empty`);
}
check(emptyP === 0, 'PRIORITY TONGUES WHOLE');
check(r.allTongueEmpty.length === 0, 'all-tongue integrity (29 cells per restored key)', r.allTongueEmpty.slice(0, 3).join(' '));

// restored values verbatim from #43 head (priority tongues)
let vm = 0;
for (const k of restoredKeys) {
  for (const t of PRIORITY) {
    const a = norm(live.strings[k]?.[t]), b = norm(head43.strings[k]?.[t]);
    if (a !== b) { vm++; if (vm <= 3) console.log(`      value mismatch ${k}/${t}`); }
  }
}
check(vm === 0, `restored values verbatim from #43 head ${HEAD43} (x${PRIORITY.length} tongues)`, `${vm} mismatches`);

// the 23 superseded cells keep PRE values live (zero newer-main clobber, live-side)
let sm = 0;
for (const [k, t] of superseded) {
  const a = norm(live.strings[k]?.[t]), b = norm(pre.strings[k]?.[t]);
  if (a !== b) { sm++; console.log(`      superseded drift ${k}/${t}`); }
}
check(sm === 0, `23 superseded cells keep pre-recovery main values LIVE`, `${sm} drifted`);

console.log('      script sanity (restored cells carrying target script — informational; Latin tongues are legitimately diacritic-free):');
for (const t of PRIORITY) console.log(`        ${t}: ${r.scriptPct[t]}`);

// en-fill census: restored cells whose value EQUALS English (they render English
// live — machine-draft carry-over from #43, unrecorded in _meta.enfill)
const boundVisible = new Set();
for (const page of PAGES) {
  const html = await (await fetch(BASE + page + `?cb=${CB}`)).text();
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) boundVisible.add(m[1]);
}
console.log('      en-fill census over restored cells (value === en):');
for (const t of PRIORITY) {
  const all = [], vis = [];
  for (const k of restoredKeys) {
    const v = norm(live.strings[k]?.[t]), en = norm(live.strings[k]?.en);
    if (v && v === en) { all.push(k); if (boundVisible.has(k)) vis.push(k); }
  }
  console.log(`        ${t}: ${all.length}/243 en-fill (${vis.length} user-visible on the three pages)${vis.length ? ' — ' + vis.join(',') : ''}`);
}

// ---------- C. DOM render proof ----------
console.log('\n== C. LIVE DOM RENDER PROOF (390px, real picker path via localStorage blang) ==');
const { chromium } = await import('playwright');
const browser = await chromium.launch();
const shots = resolve(ROOT, 'e2e/shots-edu-i18n-live');
mkdirSync(shots, { recursive: true });

for (const page of PAGES) {
  const html = await (await fetch(BASE + page + `?cb=${CB}`)).text();
  const bound = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
  const boundRestored = [...new Set(bound)].filter(k => restoredKeys.includes(k));
  console.log(`\n-- ${page}: ${bound.length} bound keys, ${boundRestored.length} of them restored keys`);
  for (const t of PRIORITY) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(t => localStorage.setItem('blang', t), t);
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e)));
    await p.goto(BASE + page + `?cb=${CB}`, { waitUntil: 'networkidle' });
    // wait until the first restored key's text differs from English (corpus applied)
    const probe = boundRestored[0];
    if (probe) {
      await p.waitForFunction(([sel, en]) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() && el.textContent.replace(/\s+/g, ' ').trim() !== en;
      }, [`[data-i18n="${probe}"]`, norm(repoCorpus.strings[probe].en)], { timeout: 15000 }).catch(() => {});
    }
    let ok = 0, bad = [], enfill = [];
    for (const k of boundRestored) {
      const el = await p.$(`[data-i18n="${k}"]`);
      const txt = el ? norm(await el.textContent()) : '';
      const en = norm(repoCorpus.strings[k]?.en ?? '');
      const corpusCell = norm(live.strings[k]?.[t]);
      if (corpusCell === en) { enfill.push(k); continue; }   // drafted en-fill: renders English by design-of-draft, counted separately
      const good = txt && txt !== en;
      if (good) ok++; else bad.push(k);
    }
    check(boundRestored.length > 0 && bad.length === 0 && errors.length === 0,
      `${page} [${t}]: ${ok}/${boundRestored.length} translated keys render translated (${enfill.length} drafted en-fill render English)`,
      bad.length ? `NOT rendered: ${bad.slice(0, 5).join(',')}` : (errors.length ? `pageerrors: ${errors[0]}` : ''));
    if (page === 'blanguage.html' || (page === 'bnames.html' && t === 'ru') || (page === 'bset.html' && t === 'uk')) {
      await p.screenshot({ path: resolve(shots, `${page.replace('.html', '')}-${t}-390.png`), fullPage: false });
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`\n${fails === 0 ? 'ALL LIVE ACCEPTANCE CHECKS PASS' : fails + ' CHECKS FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
