/* personpanel.test.mjs — the GUX-01 person-panel battery (zGenePerson seat).
   Node --test, zero dependencies, DOM-free: the adapter and the pure panel
   helpers carry the laws; the mounted journey is receipted in the browser
   (tools/genealogy/person-panel-demo.html + the screenshot run).

   Sections:
     A. resolve() law        — hit / ambiguous+candidates / null
     B. FIRST ACCEPTANCE     — Joseph Hadlock ambiguity → deliberate choice →
                               relationship to root → blood vs affinity →
                               attributed layers → back (stack semantics)
     C. required cases       — Donna · Rockwood · spouse-only · married
                               cousins · ghost frontier · cyclic person
     D. immutability law     — corpus never mutated; views frozen
     E. privacy law          — living stubs leak nothing (labels/refs/URLs)
     F. era ≠ support + citation wording law
     G. Archive-1.1 quarantine + wiring contract (text-scan, zGeneUI precedent)
     H. synthetic corpus     — law edges the real corpus cannot carry
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { buildArchive, upLabel, downLabel } from '../../surfaces/person-panel-corpus.mjs';
import { genContextText, ambiguityHeadline, relationshipSummary, hopArrow, layerAttributionLines, buildTeasers, kinshipTerm, descentTiers, hopWindow, esc } from '../../surfaces/person-panel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const L = join(ROOT, 'assets', 'profile-archive', 'lineage');

const corpusRaw = readFileSync(join(L, 'remington-bloodline.json'), 'utf8');
const corpus = JSON.parse(corpusRaw);
const overlay = JSON.parse(readFileSync(join(L, 'attested-overlays.json'), 'utf8'));
const packs = {};
for (const p of new Set(Object.values(corpus.meta.packs || {}))) {
  packs[p] = JSON.parse(readFileSync(join(L, p), 'utf8'));
}
const archive = buildArchive({ corpus, overlay, packs });

/* named persons (locked ids from the public corpus) */
const DONNA = 'p7b1078c886';
const APR = 'p72d226cedf';        /* Albert Perry Rockwood 1805–1879 — public entrance */
const FOUNDER = 'founder';
const LIV1 = 'liv-1', LIV2 = 'liv-2';
const SAMUEL = 'pb8e0a7cd75', MIRIAM = 'pccc17e8c97';
const EMMA = 'pcc15e1f57e';       /* cyclic component, on the founder line */
const JH = { 6: 'pd9181bfe85', 7: 'p254f9ddf59', 8: 'pdc0876ac81' }; /* Joseph Hadlock ×3 */

/* ── A. resolve() — hit / ambiguous / null ───────────────────────────────── */

test('A1 resolve hit: Donna Ruth Lawton resolves to exactly one person', () => {
  const r = archive.resolve('Donna Ruth Lawton');
  assert.equal(r.status, 'hit');
  assert.equal(r.person.id, DONNA);
  assert.equal(r.person.name, 'Donna Ruth Lawton');
});

test('A2 resolve is case/whitespace tolerant but never lax', () => {
  const r = archive.resolve('  donna   ruth lawton ');
  assert.equal(r.status, 'hit');
  assert.equal(r.person.id, DONNA);
});

test('A3 resolve null: no person by that name', () => {
  const r = archive.resolve('Zzzz Qux Nobody');
  assert.equal(r.status, 'null');
  assert.equal(r.query, 'Zzzz Qux Nobody');
});

test('A4 resolve ambiguous on exact duplicates: Joseph Hadlock ×3 with candidates, never a pick', () => {
  const r = archive.resolve('Joseph Hadlock');
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.exact, true, 'all three are EXACT name matches');
  assert.equal(r.candidates.length, 3);
  const lifespans = r.candidates.map(c => c.lifespan).sort();
  assert.deepEqual(lifespans, ['1700–1744', '1729–1776', '1777–1849']);
  /* no candidate is privileged: the result carries all three and no "chosen" */
  assert.equal('person' in r, false);
});

test('A5 resolve ambiguous on close names when no exact match exists', () => {
  const r = archive.resolve('Hadlock Zzz');
  assert.equal(r.status, 'null'); /* close-name matching is substring-per-name, this matches nothing */
  const r2 = archive.resolve('Miriam');
  assert.equal(r2.status, 'ambiguous');
  assert.equal(r2.exact, false);
  assert.ok(r2.candidates.length >= 1);
});

test('A6 resolve empty query → null, never a free pick', () => {
  assert.equal(archive.resolve('').status, 'null');
  assert.equal(archive.resolve('   ').status, 'null');
});

test('A7 search caps and orders exact-first', () => {
  const rows = archive.search('hadlock', 12);
  assert.ok(rows.length > 0 && rows.length <= 12);
  const firstExact = rows.findIndex(r => !r.exact);
  if (firstExact > 0) {
    for (let i = firstExact; i < rows.length; i++) assert.equal(rows[i].exact, false);
  }
});

/* ── B. FIRST ACCEPTANCE — the journey the founder ordered ───────────────── */

test('B1 ambiguity is SHOWN: the ambiguity headline names the count and the law', () => {
  const r = archive.resolve('Joseph Hadlock');
  const h = ambiguityHeadline(r);
  assert.match(h, /3 people share the exact name/);
  assert.match(h, /never picks for you/);
});

test('B2 each candidate carries distinguishing context (lifespan + era + position vs root)', () => {
  const r = archive.resolve('Joseph Hadlock');
  const byLifespan = {};
  for (const c of r.candidates) byLifespan[c.lifespan] = c;
  assert.ok(byLifespan['1777–1849'] && byLifespan['1729–1776'] && byLifespan['1700–1744']);
  /* position relative to the founder root distinguishes them: 6/7/8 above */
  assert.deepEqual(
    ['1777–1849', '1729–1776', '1700–1744'].map(l => genContextText(archive.genContext(byLifespan[l].id, FOUNDER), 'Living')),
    ['6 generations above the current root', '7 generations above the current root', '8 generations above the current root']
  );
});

test('B3 deliberate choice → relationship to current root is computable and honest', () => {
  /* the visitor picks the 1777–1849 Joseph while standing at the founder */
  const rel = archive.relationship(JH[6], FOUNDER);
  assert.equal(rel.a, JH[6]);
  assert.equal(rel.b, FOUNDER); /* endpoints always present */
  assert.equal(rel.kind, 'direct');
  assert.equal(rel.blood.mode, 'ancestor-of-root');
  assert.ok(rel.blood.hopsFromRoot.length >= 1);
  /* every hop is labeled and evidenced */
  for (const hop of rel.blood.hopsFromRoot) {
    assert.ok(hop.label);
    assert.ok(hop.evidence);
  }
});

test('B4 blood vs affinity on the same pair is stated separately (summary law)', () => {
  const s = relationshipSummary(archive.relationship(MIRIAM, SAMUEL), id => archive.getPerson(id).name);
  assert.match(s, /married AND share blood/);
  const sAff = relationshipSummary(archive.relationship(LIV2, LIV1), id => archive.getPerson(id).name);
  assert.match(sAff, /affinity, never blood/);
});

test('B5 records / tradition / testimony / meaning are separately attributed layers', () => {
  const apr = archive.getPerson(APR);
  /* Rockwood: records + tradition(3 claims) + testimony all present */
  assert.ok(apr.layers.records, 'records layer');
  assert.equal(apr.layers.tradition.claims.length, 3);
  assert.ok(apr.layers.tradition.attribution.length > 0, 'tradition carries its own attribution');
  assert.equal(apr.layers.testimony.length, 1);
  assert.match(apr.layers.testimony[0].author, /family testimony/);
  assert.equal(apr.layers.testimony[0].moneyOverlay, true, 'the account story rides the money-history overlay, its own layer');
  const lines = layerAttributionLines(apr).map(l => l.kind);
  for (const k of ['records', 'tradition', 'testimony']) assert.ok(lines.includes(k), k);
  /* meaning: the founder-authored symbolism attaches to the overlay Sigurd */
  const sig = archive.getPerson('ovl-sigurd-snake-eye');
  assert.equal(sig.layers.meaning.length, 1);
  assert.match(sig.layers.meaning[0].attribution, /parent-child claim/);
});

test('B6 back-stack semantics: the panel contract exposes back() and the view stack (wiring)', () => {
  const panelSrc = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  assert.match(panelSrc, /function back \(\)/);
  assert.match(panelSrc, /stack\.push\(\{ view, scroll: captureScroll\(\) \}\)/);
  assert.match(panelSrc, /restoreScroll\(prev\.scroll\)/);
  assert.match(panelSrc, /aria-live="polite"/);
});

/* ── C. required cases, corpus-locked ────────────────────────────────────── */

test('C1 Donna Ruth Lawton: 2 generations above the founder, labeled hops', () => {
  const rel = archive.relationship(DONNA, FOUNDER);
  assert.equal(rel.kind, 'direct');
  assert.equal(rel.blood.mode, 'ancestor-of-root');
  assert.equal(rel.blood.hopsFromRoot.length, 2);
  assert.deepEqual(rel.blood.hopsFromRoot.map(h => h.label), ['father', 'mother']);
  /* founder → liv-1 (father) → Donna (mother) — endpoints honest */
  assert.equal(rel.blood.hopsFromRoot[0].to, LIV1);
  assert.equal(rel.blood.hopsFromRoot[1].to, DONNA);
  assert.deepEqual(genContextText(archive.genContext(DONNA, FOUNDER), 'Living'), '2 generations above the current root');
});

test('C2 Albert Perry Rockwood: the public entrance, evidence-pack tradition, no leakage of living kin', () => {
  const apr = archive.getPerson(APR);
  assert.equal(apr.name, 'Albert Perry Rockwood');
  assert.equal(apr.lifespan, '1805–1879');
  assert.equal(apr.era, 'colonial');
  /* the founder hangs 5 generations below APR — the zGeneUI-verified number */
  const rel = archive.relationship(FOUNDER, APR);
  assert.equal(rel.kind, 'direct');
  assert.equal(rel.blood.mode, 'descendant-of-root');
  assert.equal(rel.blood.hopsFromRoot.length, 5);
  /* Donna vs APR-root = none — the honest boundary in the founder's own journey */
  const none = archive.relationship(DONNA, APR);
  assert.equal(none.kind, 'none');
  assert.match(none.note, /beyond the published frontier/);
  assert.match(none.note, /not a finding about anyone/);
});

test('C3 spouse-only pair: liv-1/liv-2 — affinity and NOTHING else', () => {
  const rel = archive.relationship(LIV2, LIV1);
  assert.equal(rel.kind, 'affinity');
  assert.equal(rel.blood, null);
  assert.ok(rel.affinity);
  assert.equal(rel.affinity.hopsFromRoot.length, 1);
  assert.equal(rel.affinity.hopsFromRoot[0].dir, 'spouse');
  assert.match(rel.affinity.hopsFromRoot[0].evidence, /affinity, never blood/);
  assert.equal(archive.coupleOf(LIV1, LIV2), true);
  /* spouse rows never describe a marriage as blood: the summary says so */
  assert.match(relationshipSummary(rel, id => archive.getPerson(id).name), /affinity, never blood/);
});

test('C4 married cousins: Samuel ⚭ Miriam — blood AND affinity coexist via Joseph Hadlock 1700–1744', () => {
  const rel = archive.relationship(MIRIAM, SAMUEL);
  assert.equal(rel.kind, 'blood-and-affinity');
  assert.ok(rel.blood && rel.blood.mode === 'cousin-line');
  assert.equal(rel.blood.commonAncestor, JH[8]); /* the 1700–1744 Joseph — one of the three ambiguous namesakes */
  const ca = archive.getPerson(rel.blood.commonAncestor);
  assert.equal(ca.name, 'Joseph Hadlock');
  assert.equal(ca.lifespan, '1700–1744');
  assert.ok(rel.affinity, 'the marriage is ALSO carried — both true, separately labeled');
  assert.equal(rel.blood.commonAncestorIsEndpoint, false);
  /* both chains reach the CA and are non-empty */
  assert.ok(rel.blood.hopsFromRoot.length >= 1 && rel.blood.hopsFromPerson.length >= 1);
  assert.equal(rel.blood.hopsFromRoot[rel.blood.hopsFromRoot.length - 1].to, JH[8]);
  assert.equal(rel.blood.hopsFromPerson[rel.blood.hopsFromPerson.length - 1].to, JH[8]);
});

test('C5 ghost frontier: counts only, total locked at the published number, no raw ghost ids in views', () => {
  assert.equal(archive.frontierTotal(), 1959);
  /* someone demonstrably on the founder line holds ghost parents */
  const ghostHolders = [];
  for (const id of Object.keys(corpus.persons)) {
    const v = archive.getPerson(id);
    if (v && v.ghostParents > 0) ghostHolders.push(id);
  }
  assert.ok(ghostHolders.length > 1000, 'the frontier is distributed coverage, not one broken branch');
  /* the raw unpublished parent-ref strings never enter any view */
  const ghostIds = new Set();
  for (const [c, ps] of Object.entries(corpus.edges)) {
    for (const p of ps) if (!corpus.persons[p]) ghostIds.add(p);
  }
  const sample = ghostHolders.slice(0, 300);
  for (const id of sample) {
    const s = JSON.stringify(archive.getPerson(id));
    for (const g of ghostIds) assert.ok(!s.includes('"' + g + '"'), 'ghost ref leaked into a view');
  }
});

test('C6 cyclic person: Emma de Bois-l\'Evêque — path terminates, flagged cyclic', () => {
  const rel = archive.relationship(EMMA, FOUNDER);
  assert.equal(rel.kind, 'direct');
  assert.equal(rel.cyclic, true, 'the shortest line crosses the medieval loop — shown honestly');
  /* cycle-safety: every required relationship computes in bounded time (no hang = pass) */
  for (const [a, b] of [[EMMA, FOUNDER], [DONNA, APR], [JH[8], APR], [MIRIAM, SAMUEL]]) {
    const r = archive.relationship(a, b);
    assert.ok(r && r.kind);
  }
});

/* ── D. immutability — no mutation of archive-returned objects ───────────── */

test('D1 the corpus JSON is byte-identical after a full battery of archive use', () => {
  const pristine = JSON.parse(corpusRaw);
  /* exercise the whole surface */
  archive.resolve('Joseph Hadlock');
  archive.resolve('Donna Ruth Lawton');
  archive.search('hadlock', 12);
  archive.relationship(MIRIAM, SAMUEL);
  archive.relationship(EMMA, FOUNDER);
  archive.getPerson(APR);
  archive.getPerson('ovl-sigurd-snake-eye');
  for (const id of Object.keys(corpus.persons).slice(0, 400)) archive.getPerson(id);
  assert.deepEqual(JSON.parse(JSON.stringify(corpus)), pristine);
});

test('D2 views and relationships are frozen — mutation attempts throw (strict mode)', () => {
  const v = archive.getPerson(DONNA);
  assert.ok(Object.isFrozen(v));
  assert.throws(() => { v.name = 'x'; }, TypeError);
  assert.throws(() => { v.layers.records.providerRef = 'x'; }, TypeError);
  const r = archive.relationship(MIRIAM, SAMUEL);
  assert.ok(Object.isFrozen(r));
  assert.throws(() => { r.kind = 'none'; }, TypeError);
  const s = archive.search('hadlock', 3);
  assert.ok(Object.isFrozen(s));
});

/* ── E. privacy — no living/private leakage ──────────────────────────────── */

test('E1 living views carry no refs, no record URLs, no real names', () => {
  for (const id of Object.keys(corpus.persons)) {
    const p = corpus.persons[id];
    if (!p.living) continue;
    const v = archive.getPerson(id);
    assert.equal(v.refs.length, 0, id + ' leaks refs');
    assert.equal(v.layers.records, null, id + ' leaks a record URL');
    assert.ok(!/fsid|familysearch\.org/i.test(JSON.stringify(v)), id + ' leaks provider data');
  }
});

test('E2 searching for the living returns only anonymous stubs — nothing private surfaces', () => {
  const r = archive.resolve('Living');
  assert.equal(r.status, 'ambiguous');
  for (const c of r.candidates) {
    assert.ok(c.living);
    assert.equal(c.name, 'Living');
    assert.equal(c.refs.length, 0);
  }
});

test('E3 the panel module itself adds no URLs or ids of its own (contract law)', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  /* the ONLY url the panel can produce is the staged person page path pattern */
  const urls = [...src.matchAll(/https?:\/\/[^'"\s]+/g)].map(m => m[0]);
  assert.deepEqual(urls, [], 'the panel constructs no external URLs; every link comes from the archive');
  assert.doesNotMatch(src, /console\./, 'the panel logs nothing — no log leakage');
});

/* ── F. era ≠ support + citation wording ─────────────────────────────────── */

test('F1 era and support travel as separate fields and neither derives the other', () => {
  const v = archive.getPerson(APR);
  assert.equal(v.era, 'colonial');
  assert.equal(v.support, 'unsourced-entry'); /* era≠support: a dated record with no harvested sources */
  const sig = archive.getPerson('ovl-sigurd-snake-eye');
  assert.ok(sig.era !== sig.support);
});

test('F2 the wording law: citations CONNECT; support is assessed per claim — the banned phrase never appears', () => {
  for (const f of ['person-panel.mjs', 'person-panel-corpus.mjs']) {
    const src = readFileSync(join(ROOT, 'surfaces', f), 'utf8');
    assert.doesNotMatch(src, /citations\s*=\s*confidence/, f + ' carries the banned equation');
  }
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  assert.match(src, /citations connect the claim to its evidence; support is assessed per claim/);
});

/* ── G. Archive-1.1 quarantine + wiring contract ─────────────────────────── */

test('G1 the panel never re-derives paths — no BFS/edges inside person-panel.mjs', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  assert.doesNotMatch(src, /\.edges/, 'the panel must not traverse corpus edges');
  assert.doesNotMatch(src, /upMap|visited|breadth/i, 'no traversal machinery in the panel');
  assert.match(src, /archive\.relationship\(/, 'all relationship text flows through the injected archive');
});

test('G2 the temporary implementation is quarantined in ONE adapter function, marked for Archive 1.1', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel-corpus.mjs'), 'utf8');
  assert.match(src, /TEMPORARY PRE-ARCHIVE-1\.1 IMPLEMENTATION/);
  assert.match(src, /relationshipPath/);
  const relIdx = src.indexOf('function relationship (aId, bId)');
  assert.ok(relIdx > 0);
  /* exactly one relationship implementation lives in the adapter */
  assert.equal(src.split('function relationship (').length - 1, 1);
});

test('G3 wiring contract: mount markers, keyboard, and the no-silent-choice UI strings exist', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  for (const marker of [
    'export function mountPersonPanel',
    'data-ppgo', 'data-pprel', 'data-pproot', 'data-pparchive',
    "e.key === '/'", "e.key === 'Escape'", 'ArrowDown', 'ArrowUp',
    'never picks for you', 'no silent choice', 'married cousins',
    'affinity, never blood', 'common ancestor', 'the frontier',
    'era ≠ support', 'PP_VERSION'
  ]) {
    assert.ok(src.includes(marker), 'missing wiring marker: ' + marker);
  }
  const css = readFileSync(join(ROOT, 'surfaces', 'person-panel.css'), 'utf8');
  for (const cls of ['.pp-res', '.pp-chain', '.pp-layer', '.pp-coexist', '.pp-cyclic', '@media (max-width:640px)', 'prefers-reduced-motion']) {
    assert.ok(css.includes(cls), 'missing css: ' + cls);
  }
});

test('G4 the demo harness exists and mounts exactly these modules', () => {
  const demo = readFileSync(join(HERE, 'person-panel-demo.html'), 'utf8');
  assert.match(demo, /person-panel\.mjs/);
  assert.match(demo, /person-panel-corpus\.mjs/);
  assert.match(demo, /person-panel\.css/);
});

/* ── H. hop labels + synthetic-corpus law edges ──────────────────────────── */

test('H1 hop labels follow recorded gender, uncertain stays uncertain', () => {
  assert.equal(upLabel('FEMALE'), 'mother');
  assert.equal(upLabel('MALE'), 'father');
  assert.equal(upLabel('F'), 'mother');
  assert.equal(upLabel('M'), 'father');
  assert.equal(upLabel(null), 'parent');
  assert.equal(upLabel('X'), 'parent');
  assert.equal(downLabel('FEMALE'), 'daughter');
  assert.equal(downLabel('MALE'), 'son');
  assert.equal(downLabel(undefined), 'child');
});

test('H2 synthetic corpus: a nameless person is never a search hit; unknown person handled', () => {
  const syn = buildArchive({
    corpus: {
      schema: 'skaists.lineage/2', root: 'a1',
      persons: { a1: { name: 'Alpha One', lifespan: '1000–1070', gender: 'MALE', living: false, evidence: { era: 'medieval', support: 'unsourced-entry', class: 'medieval' }, refs: [] },
                 nn: { name: '', living: false, evidence: { class: 'unrecorded' }, refs: [] } },
      edges: { a1: [] }, couples: {}, spine: [], refsIndex: {}
    },
    overlay: null, packs: {}
  });
  assert.equal(syn.resolve('Alpha One').status, 'hit');
  assert.equal(syn.getPerson('nope'), null);
  assert.equal(syn.relationship('a1', 'nope').kind, 'none'); /* unknown person never throws */
  const rows = syn.search('a', 12);
  assert.ok(rows.every(r => r.person.name && r.person.name.length > 0), 'nameless rows never surface');
});

test('H3 synthetic corpus: self relationship and empty-family honesty', () => {
  const syn = buildArchive({
    corpus: {
      schema: 'x', root: 'a1',
      persons: { a1: { name: 'Alone Person', lifespan: '1000–1070', living: false, evidence: { era: 'medieval', support: 'unsourced-entry', class: 'medieval' }, refs: [] } },
      edges: {}, couples: {}, spine: [], refsIndex: {}
    },
    overlay: null, packs: {}
  });
  const rel = syn.relationship('a1', 'a1');
  assert.equal(rel.kind, 'self');
  const v = syn.getPerson('a1');
  assert.deepEqual(v.parents, []);
  assert.deepEqual(v.spouses, []);
  assert.equal(v.ghostParents, 0);
});

test('H4 synthetic corpus: a two-hop cycle terminates and still answers', () => {
  const syn = buildArchive({
    corpus: {
      schema: 'x', root: 'c1',
      persons: {
        c1: { name: 'Cy One', lifespan: '0900–0950', living: false, evidence: { class: 'medieval' }, refs: [] },
        c2: { name: 'Cy Two', lifespan: '0905–0975', gender: 'FEMALE', living: false, evidence: { class: 'medieval' }, refs: [] },
        c3: { name: 'Cy Three', lifespan: '1000–1060', gender: 'MALE', living: false, evidence: { class: 'medieval' }, refs: [] }
      },
      edges: { c3: ['c2'], c2: ['c1'], c1: ['c2'] }, /* c1 ↔ c2 loop */
      couples: {}, spine: [], refsIndex: {}
    },
    overlay: null, packs: {}
  });
  const rel = syn.relationship('c3', 'c1');
  assert.ok(['direct', 'shared'].includes(rel.kind));
  assert.equal(rel.cyclic, true);
});

test('H5 esc() neutralizes markup in names — no injection through archive data', () => {
  assert.equal(esc('<b>x&y</b>"\''), '&lt;b&gt;x&amp;y&lt;/b&gt;&quot;&#39;');
  assert.equal(esc(null), '');
});

test('H6 genContextText covers every honest position', () => {
  assert.match(genContextText({ rel: 'self', depth: 0 }, 'Rockwood'), /the current root — Rockwood/);
  assert.match(genContextText({ rel: 'above', depth: 1 }, ''), /1 generation above/);
  assert.match(genContextText({ rel: 'below', depth: 3 }, ''), /3 generations below/);
  assert.match(genContextText({ rel: 'off', depth: null }, ''), /not on the current line/);
  assert.match(genContextText(null, ''), /not on the current line/);
});

test('H7 hopArrow maps directions to arrows', () => {
  assert.equal(hopArrow({ dir: 'up' }), '↑');
  assert.equal(hopArrow({ dir: 'down' }), '↓');
  assert.equal(hopArrow({ dir: 'spouse' }), '⚭');
});

/* ── I. curiosity layer — discovery hooks + teasers (v1.1) ─────────────────
   The founder's grading criterion: whether someone wants to click another
   ancestor after the first one. Every hook below is COMPUTED from the real
   corpus at run time and locked to the numbers measured at this pin. */

test('I1 discoveries() — every hook computed, locked to the pin corpus (founder root)', () => {
  const D = archive.discoveries(FOUNDER);
  assert.ok(Object.isFrozen(D));
  assert.equal(D.personsCount, 10259);
  assert.deepEqual(D.spine, { gens: 42, terminus: 'p980ac0fa0b' });
  assert.equal(archive.getPerson(D.spine.terminus).name, 'Randver Radbardson');
  assert.deepEqual(D.deepest, { id: 'pc996e1efee', depth: 143, from: 'founder', descent: ['living', 'recorded', 'colonial', 'medieval', 'saga', 'unrecorded', 'saga', 'unrecorded', 'saga', 'unrecorded', 'saga', 'unrecorded', 'medieval', 'colonial', 'recorded', 'unrecorded', 'recorded', 'unrecorded', 'recorded'] });
  assert.equal(archive.getPerson(D.deepest.id).name, 'E Anna Tum DE LAGASH');
  assert.deepEqual(D.collapse, { gens: 12, repeaters: 50, top: { id: 'p240410e903', n: 3 } });
  assert.equal(archive.getPerson(D.collapse.top.id).name, 'Tacy Cooper');
  /* the first cousin couple in corpus order whose members are BOTH ancestors
   * of the standing root — the founder's own grandparents */
  assert.deepEqual(D.cousins.exemplar, { a: 'p3d44ccaffd', b: 'p7b1078c886' });
  assert.equal(archive.getPerson(D.cousins.exemplar.a).name, 'Jack Benedum Sutphen');
  assert.equal(D.cousins.count, 593);
  assert.equal(D.cousins.bound, 16, 'the cousin count states its generation bound honestly');
  assert.equal(D.cycles.count, 44);
  assert.equal(archive.getPerson(D.cycles.exemplar).name, 'Lucius Munatius Plancus De Rome');
  assert.equal(D.frontier.total, 1959);
  assert.deepEqual(D.frontier.entrance, { stopId: 'pbcdbe03844', steps: 13, atFrontier: false }); /* the founder's father-line simply ends at depth 13 — no parents at all */
  assert.deepEqual(D.ambiguousNames, { count: 281, topName: { name: 'margaret', holders: 16 } });
});

test('I2 pedigreeOccurrences — collapse measured, bounded, frozen', () => {
  const ped = archive.pedigreeOccurrences(FOUNDER, 12);
  assert.ok(Object.isFrozen(ped));
  let rep = 0;
  for (const k of Object.keys(ped.occurrences)) if (ped.occurrences[k] > 1) rep++;
  assert.equal(rep, 50, '50 ancestors repeat in the founder-root 12-generation pedigree');
  assert.equal(ped.occurrences[JH[8]], 3, 'the 1700–1744 Joseph Hadlock occupies three slots');
  const apr = archive.pedigreeOccurrences(APR, 8);
  let repA = 0;
  for (const k of Object.keys(apr.occurrences)) if (apr.occurrences[k] > 1) repA++;
  assert.equal(repA, 0, 'the Rockwood entrance pedigree holds no collapse within 8 generations');
});

test('I3 nameShares / nameHolders — the shared-name discovery law', () => {
  assert.equal(archive.nameShares('Joseph Hadlock'), 3);
  assert.equal(archive.nameHolders('Joseph Hadlock').length, 3);
  assert.equal(archive.nameShares('joseph   hadlock'), 3, 'normalized');
  assert.equal(archive.nameShares('Margaret'), 16);
  assert.equal(archive.nameShares('Donna Ruth Lawton'), 1);
  assert.equal(archive.nameShares('Nobody Qux'), 0);
});

test('I4 buildTeasers — derived only from archive-proved facts (real corpus)', () => {
  /* Jack Sutphen: spouse Donna is ALSO blood — the cousins teaser must fire */
  const jack = archive.getPerson('p3d44ccaffd');
  const ctxJ = {
    cousinSpouses: [{ id: DONNA, name: 'Donna Ruth Lawton' }],
    pedigreeN: 1, pedigreeGens: 12, rootShort: 'Living', nameShareCount: 1
  };
  const tj = buildTeasers(jack, ctxJ);
  assert.ok(tj.some(t => t.kind === 'cousins' && /married cousins/.test(t.text)));
  /* the 1700–1744 Joseph: collapse ×3 + namesakes ×3 */
  const tjh = buildTeasers(archive.getPerson(JH[8]), {
    pedigreeN: 3, pedigreeGens: 12, rootShort: 'Living', nameShareCount: 3
  });
  assert.ok(tjh.some(t => t.kind === 'collapse' && /appears 3×/.test(t.text) && /pedigree collapse/.test(t.text)));
  assert.ok(tjh.some(t => t.kind === 'namesakes' && /3 people/.test(t.text)));
  /* Donna: spine position */
  const td = buildTeasers(archive.getPerson(DONNA), { spineIdx: 2 });
  assert.ok(td.some(t => t.kind === 'spine' && /generation 2 on the spine/.test(t.text)));
});

test('I5 buildTeasers never invents — absence of a fact is absence of a teaser', () => {
  assert.deepEqual(buildTeasers(archive.getPerson(DONNA), {}), []);
  assert.deepEqual(buildTeasers(archive.getPerson(DONNA), null), []);
  const one = buildTeasers(archive.getPerson(DONNA), { pedigreeN: 1, nameShareCount: 1 });
  assert.equal(one.length, 0, 'n=1 and one-holder names carry no teaser');
  assert.deepEqual(buildTeasers(null, { pedigreeN: 3 }), []);
});

test('I6 the corpus stays byte-identical after the full curiosity battery', () => {
  const pristine = JSON.parse(corpusRaw);
  archive.discoveries(FOUNDER);
  archive.discoveries(APR);
  archive.pedigreeOccurrences(FOUNDER, 12);
  archive.pedigreeOccurrences(APR, 8);
  archive.nameShares('Joseph Hadlock');
  archive.nameHolders('Margaret');
  archive.spineIndex(DONNA);
  assert.deepEqual(JSON.parse(JSON.stringify(corpus)), pristine);
});

test('I7 curiosity wiring — strip, teasers, rescue, and home() exist as text law', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  for (const marker of [
    'discoveriesHtml', 'teasersHtml', 'buildTeasers',
    'keep exploring — one more ancestor', 'data-ppq',
    'home ()', "archive.discoveries", 'pp-strip', 'pp-hook', 'pp-teaser', 'pp-rescue',
    'published, not verified', 'pedigree collapse: one person, several positions',
    "people carry the name"
  ]) {
    assert.ok(src.includes(marker), 'missing curiosity marker: ' + marker);
  }
  const css = readFileSync(join(ROOT, 'surfaces', 'person-panel.css'), 'utf8');
  for (const cls of ['.pp-strip', '.pp-hook', '.pp-teasers', '.pp-teaser', '.pp-rescue']) {
    assert.ok(css.includes(cls), 'missing css: ' + cls);
  }
});

/* ── J. rider 2+3 — contextual discoveries, epistemic descent, formal
   kinship, and the descendant-side frontier ─────────────────────────────── */

test('J1 formal kinship naming — computed, never prose (the founder’s correction locked)', () => {
  assert.equal(kinshipTerm(5, 'up', 'MALE'), '3rd-great-grandfather'); /* Albert Perry Rockwood — THE correction */
  assert.equal(kinshipTerm(5, 'up', 'FEMALE'), '3rd-great-grandmother'); /* Juliane Sophie Olsen */
  assert.equal(kinshipTerm(2, 'up', 'FEMALE'), 'grandmother'); /* Donna at the founder root */
  assert.equal(kinshipTerm(1, 'up', 'M'), 'father');
  assert.equal(kinshipTerm(3, 'up', 'F'), 'great-grandmother'); /* Ardella from the founder */
  assert.equal(kinshipTerm(4, 'up', 'M'), '2nd-great-grandfather'); /* Julius from the founder */
  assert.equal(kinshipTerm(5, 'down', 'FEMALE'), '3rd-great-granddaughter');
  assert.equal(kinshipTerm(1, 'down', 'M'), 'son');
  assert.equal(kinshipTerm(2, 'down', null), 'grandchild'); /* uncertain gender stays generic */
  assert.equal(kinshipTerm(0, 'up', 'M'), null);
  assert.equal(kinshipTerm(2, 'sideways', 'M'), null);
  /* the ordinal law (rider-3 fix): 11/12/13 exception + mod-10 suffixing —
   * a millennia-scale archive must never ship 21th-great- */
  assert.equal(kinshipTerm(13, 'up', 'M'), '11th-great-grandfather');
  assert.equal(kinshipTerm(14, 'up', 'M'), '12th-great-grandfather');
  assert.equal(kinshipTerm(15, 'up', 'M'), '13th-great-grandfather');
  assert.equal(kinshipTerm(23, 'up', 'M'), '21st-great-grandfather');
  assert.equal(kinshipTerm(24, 'up', 'M'), '22nd-great-grandfather');
  assert.equal(kinshipTerm(25, 'up', 'M'), '23rd-great-grandfather');
  assert.equal(kinshipTerm(103, 'up', 'M'), '101st-great-grandfather');
  assert.equal(kinshipTerm(111, 'up', 'M'), '109th-great-grandfather');
  assert.equal(kinshipTerm(113, 'up', 'M'), '111th-great-grandfather'); /* the 11-13 exception holds past 100 */
  assert.equal(kinshipTerm(123, 'up', 'M'), '121st-great-grandfather');
  assert.equal(kinshipTerm(143, 'up', 'M'), '141st-great-grandfather'); /* the Lagash depth */
});

test('J2 descentTiers — CONSECUTIVE transitions, the texture the line actually walks', () => {
  /* a return to earlier ground is itself texture — kept, not erased */
  assert.deepEqual(descentTiers(['living', 'living', 'recorded', 'colonial', 'medieval', 'colonial', 'saga', 'saga']), ['living', 'recorded', 'colonial', 'medieval', 'colonial', 'saga']);
  assert.deepEqual(descentTiers([null, '', 'saga']), ['saga']);
  assert.deepEqual(descentTiers([]), []);
  assert.deepEqual(descentTiers(['recorded', 'recorded']), ['recorded']); /* uniform runs collapse */
});

test('J3 hopWindow — long chains compress with the elided count stated', () => {
  const mk = n => Array.from({ length: n }, (_, i) => ({ to: 'p' + i, dir: 'up', label: 'parent', evidence: 'walked provider link' }));
  const short = hopWindow(mk(5), 10, 3);
  assert.equal(short.elided, 0);
  assert.equal(short.render.length, 5);
  assert.equal(short.total, 5);
  const deep = hopWindow(mk(143), 10, 3);
  assert.equal(deep.total, 143);
  assert.equal(deep.elided, 130);
  assert.equal(deep.render.length, 14); /* 10 head + 1 ellipsis + 3 tail */
  assert.equal(deep.render[10], null, 'the ellipsis sentinel rides at the seam');
});

test('J4 discoveries are CONTEXTUAL — the same archive tells a different story per standing root', () => {
  const Df = archive.discoveries(FOUNDER);
  const Da = archive.discoveries(APR);
  /* founder root: the whole medieval web */
  assert.equal(Df.deepest.depth, 143);
  assert.equal(Df.tiers.total, 10097);
  assert.deepEqual(Df.tiers.order, ['saga', 'medieval', 'colonial', 'unrecorded', 'recorded', 'living']);
  assert.equal(Df.tiers.counts.saga, 3153, 'more saga-tier than recorded-tier — the thinning is countable');
  /* Rockwood root: a small colonial world with its own frontier story */
  assert.equal(Da.deepest.depth, 3);
  assert.equal(Da.deepest.id, 'p92dc6be4f8');
  assert.equal(archive.getPerson(Da.deepest.id).name, 'Samuel Rockwood I');
  assert.deepEqual(Da.tiers, { total: 15, counts: { colonial: 15 }, order: ['colonial'] });
  assert.equal(Da.cousins.exemplar, null, 'no cousin couple lives inside the Rockwood root’s family — the hook honestly hides');
  assert.equal(Da.collapse.repeaters, 0);
  assert.deepEqual(Da.frontier.entrance, { stopId: 'p92dc6be4f8', steps: 3, atFrontier: true });
});

test('J5 descendant-side frontier — broader family renders ONLY from attributed archive data', () => {
  /* without the `broader` input: no numbers, ever */
  const apr = archive.getPerson(APR);
  assert.equal(apr.broaderFamily, null);
  /* with attributed staging: carried, frozen, attributed */
  const a2 = buildArchive({ corpus, overlay, packs, broader: { [APR]: { spousesTotal: 5, childrenTotal: 22, attribution: 'family testimony + cited biography (test)' } } });
  const v = a2.getPerson(APR);
  assert.ok(Object.isFrozen(v.broaderFamily));
  assert.deepEqual(v.broaderFamily, { spousesTotal: 5, childrenTotal: 22, attribution: 'family testimony + cited biography (test)' });
  /* the staged numbers are NOT written back into any corpus structure */
  assert.equal(JSON.parse(corpusRaw).persons[APR].name, 'Albert Perry Rockwood');
  assert.equal(a2.getPerson(APR).children.length, 1, 'the walked record still carries exactly one child on the line');
});

test('J6 teasers v2 — the medieval experience speaks its own texture', () => {
  /* cyclic */
  const emma = archive.getPerson(EMMA);
  const te = buildTeasers(emma, {});
  assert.ok(te.some(t => t.kind === 'cyclic' && /participates in a loop/.test(t.text)));
  /* disputed parent-link */
  const hc = archive.getPerson('ovl-harthacnut-i');
  const th = buildTeasers(hc, {});
  assert.ok(th.some(t => t.kind === 'disputed' && /disputed/.test(t.text)));
  /* legendary tier */
  const rag = archive.getPerson('pf5d40516b8');
  const tr = buildTeasers(rag, {});
  assert.ok(tr.some(t => t.kind === 'legendary' && /does not upgrade to documented/.test(t.text)));
  /* none of these fire on plain modern persons */
  const donna = buildTeasers(archive.getPerson(DONNA), {});
  assert.ok(!donna.some(t => t.kind === 'cyclic' || t.kind === 'disputed' || t.kind === 'legendary'));
});

test('J7 wiring v1.3 — descent, kinship, coverage, broader, locked rows exist as text law', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel.mjs'), 'utf8');
  for (const marker of [
    'kinshipTerm', 'descentTiers', 'hopWindow', 'the evidence texture changes as the line climbs',
    'pp-t-', 'pp-kinship', 'formally:', 'known broader family', 'archive coverage:',
    'fan sideways into the rest of the family', 'locked, not hidden',
    'coverage, not contradiction', 'standing at {r}'
  ]) {
    assert.ok(src.includes(marker), 'missing v1.3 marker: ' + marker);
  }
  const css = readFileSync(join(ROOT, 'surfaces', 'person-panel.css'), 'utf8');
  for (const cls of ['.pp-t-recorded', '.pp-t-colonial', '.pp-t-medieval', '.pp-t-saga', '.pp-descent', '.pp-kinship', '.pp-coverage', '.pp-broader', '.pp-locked']) {
    assert.ok(css.includes(cls), 'missing css: ' + cls);
  }
});

test('J8 the corpus stays byte-identical after the v1.3 battery', () => {
  const pristine = JSON.parse(corpusRaw);
  archive.discoveries(FOUNDER);
  archive.discoveries(APR);
  archive.getPerson(EMMA);
  archive.getPerson('ovl-harthacnut-i');
  archive.relationship('pc996e1efee', FOUNDER); /* the 143-hop line compresses, never corrupts */
  assert.deepEqual(JSON.parse(JSON.stringify(corpus)), pristine);
});
