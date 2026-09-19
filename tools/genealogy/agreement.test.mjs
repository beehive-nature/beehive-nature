/* agreement.test.mjs — PANEL ↔ CORE AGREEMENT BATTERY (G1/G2 lock, red-first).
   Founder ruling 2026-09-19 (sprint thread dba361e0): the seam beat GATES
   PR #125. "The 29/29 browser journey is not sufficient while it lacks
   panel↔resolver agreement assertions."

   LAW under test — ONE truth, one resolver (Rule A):
     • After the seam beat, buildArchive({...}).relationship(a,b) DELEGATES to
       the archive-core relationshipPath (mounted panel + fallback + search
       disambiguation all consume the ONE resolver).
     • No surface may name a different common ancestor than the core for the
       same pair (G2: 110 blood-cousin pairs named different apexes).
     • No surface may say "none — a different branch" where the core sees a
       real connection (G1: 10,227 persons panel-none vs core-connected vs APR).
     - Married-cousin pairs keep BOTH truths - blood AND direct-spouse
       affinity (G3: 674 pairs at e962b6eb; the organ facet landed at tip
       54462935 - spouse.couple, schema skaists.archive-core/1.1 - so the
       facet locks run for real).

   These assertions run against the POST-BEAT state. RED until the seam beat
   + organ facet land — that red is the receipt that no journey beat asserts
   agreement today. Committed only as part of the beat (no red-test commit).

   Node --test, zero deps, DOM-free — same conventions as personpanel.test.mjs.
   */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { buildArchive } from '../../surfaces/person-panel-corpus.mjs';
import { createArchiveCore } from '../../surfaces/archive-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const L = join(ROOT, 'assets', 'profile-archive', 'lineage');

const corpus = JSON.parse(readFileSync(join(L, 'remington-bloodline.json'), 'utf8'));
const overlay = JSON.parse(readFileSync(join(L, 'attested-overlays.json'), 'utf8'));
const packs = {};
for (const p of new Set(Object.values(corpus.meta.packs || {}))) {
  packs[p] = JSON.parse(readFileSync(join(L, p), 'utf8'));
}

/* merged model exactly as blood.html boots it (probe-mirrored merge). */
const pa = buildArchive({ corpus, overlay, packs });
/* the reference core must see the EXACT model the page boots: overlay
 * parent refs resolved through refsIndex, exactly as buildArchive does it
 * (its merge law). A naive assign-merge drops those marriages and the two
 * surfaces diverge on pairs the resolution connects. */
const persons = Object.assign({}, corpus.persons, (overlay && overlay.persons) || {});
const refsIndex = corpus.refsIndex || {};
const edgesRaw = Object.assign({}, corpus.edges, (overlay && overlay.edges) || {});
const edges = {};
for (const ce of Object.keys(edgesRaw)) edges[ce] = edgesRaw[ce].map((p) => (persons[p] ? p : (refsIndex[p] || p)));
const core = createArchiveCore({ persons, edges, couples: corpus.couples, refsIndex: corpus.refsIndex });

/* named persons (locked ids from the public corpus — personpanel.test.mjs).
 * This block must stay ABOVE the stride sweep (APR is used there). */
const DONNA = 'p7b1078c886';
const APR = 'p72d226cedf';   /* Albert Perry Rockwood 1805–1879 — public entrance */
const FOUNDER = 'founder';
const EMMA = 'pcc15e1f57e';  /* cyclic component on the founder line (G2 exemplar pair) */

const nameOf = (id) => (persons[id] && persons[id].name) || id;

/* ONE stride sweep vs APR, both implementations, computed once at load and
 * shared by the lock tests (the battery must stay CI-affordable: the
 * full-corpus audit numbers — 10,227 panel-none / 110 apex disagreements /
 * 674 married-cousin pairs at e962b6eb — are receipted in
 * WORK_LOGS/ORDER5_G1_G4_VERIFICATION_2026-09-19.md, not re-proven here;
 * this sweep is the permanent agreement TRIPWIRE). Deterministic stride over
 * sorted ids → reproducible failures. */
const STRIDE = 10;
const sweep = [];
{
  const ids = Object.keys(persons).sort().filter((id) => id !== APR);
  for (let i = 0; i < ids.length; i += STRIDE) {
    const id = ids[i];
    let p = null, c = null;
    try { p = pa.relationship(id, APR); } catch { p = null; }
    try { c = core.relationshipPath(id, APR); } catch { c = null; }
    if (!p || !c) continue;
    sweep.push({
      id,
      pKind: p.kind,
      cKind: c.kind,
      pApex: p.blood ? p.blood.commonAncestor : null,
      cApex: c.commonAncestor || null,
    });
  }
}

/* panrel: the post-beat panel answer - delegation to the ONE core
   (Rule A seam beat). The battery's agreement locks are the gate. */
const panrel = (a, b) => pa.relationship(a, b);
const corerel = (a, b) => core.relationshipPath(a, b);

/* ────────────────────────────────────────────────────────────────────────
 * G1 — the explanation surface never contradicts the resolver on KIND.
 * ──────────────────────────────────────────────────────────────────────── */

test('G1-lock donna→APR: panel kind agrees with core (affinity, never "none")', () => {
  const c = corerel(DONNA, APR);
  assert.equal(c.kind, 'affinity', 'core must still see the Lowry–Rockwood marriage');
  assert.equal(c.spouseSteps, 1);
  assert.equal(c.sharedDescendant, true);
  const p = panrel(DONNA, APR);
  assert.equal(p.kind, 'affinity', 'panel must speak the resolver truth, not the stale BFS "none"');
});

test('G1-lock sweep vs APR (stride 10): no person reads "none" on the panel where the core sees a connection', () => {
  const bad = sweep.filter((s) => s.pKind === 'none' && s.cKind !== 'none');
  assert.equal(bad.length, 0,
    `G1: ${bad.length} stride members stale-none vs the resolver (first: ${bad[0] ? nameOf(bad[0].id) : '-'})`);
});

/* ────────────────────────────────────────────────────────────────────────
 * G2 — one common ancestor per pair, on every surface that names one.
 * ──────────────────────────────────────────────────────────────────────── */

test('G2-lock sweep vs APR (stride 10): panel and core name the SAME common ancestor for every blood-cousin pair', () => {
  const bad = sweep.filter((s) => s.cKind === 'blood' && s.pApex !== s.cApex);
  assert.equal(bad.length, 0,
    `G2: ${bad.length} apex disagreements (first: ${bad[0] ? nameOf(bad[0].id) + ' panel=' + nameOf(bad[0].pApex) + ' core=' + nameOf(bad[0].cApex) : '-'})`);
});

test('G2-lock exemplar (the named pair): Jack Benedum Sutphen vs APR - one truth on both surfaces', () => {
  const jack = Object.keys(persons).find((id) => /jack benedum sutphen/i.test(persons[id].name || ''));
  assert.ok(jack, 'Jack Benedum Sutphen must exist in the merged model');
  const c = corerel(jack, APR);
  const p = panrel(jack, APR);
  /* page truth at this pin (the model the page boots, overlay marriages
   * resolved): Jack married INTO the Lawton line - the resolver answers
   * AFFINITY vs the Rockwood entrance. The e962b6eb-era "panel Joseph
   * Clarke vs core Rev. John Maxson Sr" contradiction was an artifact of
   * two derivations; one resolver ends it. */
  assert.equal(c.kind, 'affinity', 'the canonical answer for the named pair');
  assert.equal(p.kind, 'affinity', 'panel speaks the same truth');
  assert.equal(p.blood, null);
  assert.ok(p.affinity && p.affinity.hopsFromRoot.length >= 1, 'the marriage line renders');
});

test('G2-lock exemplar 2: Elizabeth Perry (pad36104af0) names the core apex, not James Perry', () => {
  const ELIZABETH = 'pad36104af0';
  const c = corerel(ELIZABETH, APR);
  assert.equal(c.kind, 'blood');
  const p = panrel(ELIZABETH, APR);
  assert.ok(p.blood, 'panel must carry the blood truth');
  assert.equal(p.blood.commonAncestor, c.commonAncestor,
    'panel apex must equal core apex (core: Elizabeth Death, panel-BFS said James Perry at e962b6eb)');
});

/* ────────────────────────────────────────────────────────────────────────
 * G3 — married cousins keep BOTH truths (facet cases; Rule A shape).
 * PENDING-FACET: the core blood shape does not yet carry the optional
 * spouse facet (organ tip e1948156 predates the founder ruling). These
 * cases are SKIPPED at the pre-beat tree and MUST run once the facet
 * lands — they are the acceptance lock for the organ half of the beat.
 * ──────────────────────────────────────────────────────────────────────── */

const marriedCousinPairs = () => {
  const out = [];
  for (const cp of Object.values(corpus.couples || {})) {
    if (!persons[cp.p1] || !persons[cp.p2]) continue;
    const c = core.relationshipPath(cp.p1, cp.p2);
    if (c.kind === 'blood' || c.kind === 'blood-and-affinity') out.push([cp.p1, cp.p2]);
  }
  return out;
};

test('G3-lock count: the corpus still carries its married-cousin population (674 at e962b6eb)', () => {
  const pairs = marriedCousinPairs();
  assert.ok(pairs.length >= 600, `married-cousin population collapsed: ${pairs.length}`);
});

test('G3-lock facet: blood + direct-spouse => both surfaces carry blood AND affinity (spouse.couple, Rule A)', () => {
  const pairs = marriedCousinPairs();
  assert.ok(pairs.length > 0);
  for (const [a, b] of pairs) {
    const c = core.relationshipPath(a, b);
    assert.equal(c.kind, 'blood-and-affinity', `the facet classifies ${nameOf(a)} + ${nameOf(b)}`);
    assert.ok(c.spouse && c.spouse.couple, `core dropped the spouse facet for ${nameOf(a)} + ${nameOf(b)}`);
    assert.ok(corpus.couples[c.spouse.couple], 'the facet names a real couple record, verbatim');
    assert.match(c.spouse.note, /affinity, never blood/);
    assert.ok(c.commonAncestor, 'the blood truth is retained whole');
    const p = panrel(a, b);
    assert.equal(p.kind, 'blood-and-affinity', `panel kind for ${nameOf(a)} + ${nameOf(b)}`);
    assert.ok(p.blood && p.affinity, `panel must keep both truths for ${nameOf(a)} + ${nameOf(b)}`);
    assert.equal(p.blood.commonAncestor, c.commonAncestor, 'panel apex IS the core apex');
  }
});

/* ────────────────────────────────────────────────────────────────────────
 * G4 — no second Tarjan: the panel consumes cyclicAncestryOf.
 * Text-scan lock (zGeneUI precedent, section G of personpanel.test.mjs):
 * once the swap lands, the adapter file must not carry its own SCC pass.
 * ──────────────────────────────────────────────────────────────────────── */

test('G4-lock: person-panel-corpus.mjs owns no second Tarjan once the swap lands', () => {
  const src = readFileSync(join(ROOT, 'surfaces', 'person-panel-corpus.mjs'), 'utf8');
  const tarjanMarkers = src.match(/onstk|strongly connected components/g) || [];
  assert.equal(tarjanMarkers.length, 0, 'G4: cyclicAncestryOf must be the only cycle authority');
});

/* ────────────────────────────────────────────────────────────────────────
 * delegation lock — the panel's relationship() IS the core's, or a thin
 * presentation mapping over it; never a second derivation.
 * ──────────────────────────────────────────────────────────────────────── */

test('delegation lock: panel.relationship delegates to the ONE resolver', () => {
  /* the panel's frozen render vocabulary maps onto the core's kinds:
   * direct/shared = blood lines, blood-and-affinity = the facet kind */
  const VOCAB = { direct: 'blood', shared: 'blood', 'blood-and-affinity': 'blood', affinity: 'affinity', none: 'none' };
  for (const [a, b] of [[DONNA, APR], [FOUNDER, APR], [APR, FOUNDER], [EMMA, APR]]) {
    const p = panrel(a, b), c = corerel(a, b);
    assert.equal(VOCAB[p.kind] || p.kind, c.kind, `${nameOf(a)} -> ${nameOf(b)}: panel ${p.kind} vs core ${c.kind}`);
  }
});

/* ==================================================================
 * D1-lock (ORDER5-R2 finding by bFUzZ, verified by own zGeneUI probe at
 * 24c64060): the PAGE'S overlay merge must resolve provider refs through
 * refsIndex exactly as buildArchive does. The raw assign that lived at
 * blood.html:337 orphaned the Norse island (ovl-sigurd-snake-eye,
 * ovl-blaeja-of-northumbria, ovl-harthacnut-i): page model TWO components
 * [10,256+3] vs resolved ONE [10,259]; 3,078/3,078 sampled islander pairs
 * page-core none vs panel truth (16 blood / 3,062 affinity). The corpus
 * itself already carried the RESOLVED row - the raw assign destroyed a
 * working corpus link in the page model only. One merge law, two sites.
 * ================================================================== */

test('D1-lock: blood.html overlay merge resolves parent refs (no raw assign)', () => {
  const page = readFileSync(join(ROOT, 'surfaces', 'blood.html'), 'utf8');
  assert.ok(/S\.edges\[ce\]=ov\.edges\[ce\]\.map\(/.test(page), 'the page merge must map overlay parent refs, not assign raw rows');
  assert.ok(page.includes('S.refsIndex[p]||p'), 'resolution vocabulary present: S.persons[p]?p:(S.refsIndex[p]||p)');
  assert.ok(!/S\.edges\[ce\]=ov\.edges\[ce\];/.test(page), 'D1: the raw overlay-row assign must not return');
  assert.ok(!/ov\.edges\[ce\]\.forEach\(p=>addChild/.test(page), 'addChild must receive RESOLVED parents, never raw fsids');
});

test('D1-lock: one merge law, two sites (page merge == battery/adapter merge)', () => {
  const adapterSrc = readFileSync(join(ROOT, 'surfaces', 'person-panel-corpus.mjs'), 'utf8');
  assert.ok(adapterSrc.includes('refsIndex[p] || p'), 'adapter merge law vocabulary unchanged (person-panel-corpus.mjs:142)');
  /* replicate the FIXED page merge exactly as blood.html:337 now does it */
  const pageEdges = Object.assign({}, corpus.edges);
  for (const ce of Object.keys(overlay.edges || {})) pageEdges[ce] = overlay.edges[ce].map((p) => (persons[p] ? p : (refsIndex[p] || p)));
  assert.deepEqual(pageEdges, edges, 'the page merge and the battery merge must produce the same tables');
});

test('D1-lock: the Norse island stays connected (D1 regression lock)', () => {
  const KINDS = {
    'ovl-sigurd-snake-eye': 'blood',
    'ovl-blaeja-of-northumbria': 'affinity',
    'ovl-harthacnut-i': 'blood',
  };
  for (const [id, want] of Object.entries(KINDS)) {
    const r = core.relationshipPath(id, FOUNDER);
    assert.equal(r && r.kind, want, `${nameOf(id)} vs root: expected ${want}, got ${r && r.kind} (D1 orphan regression)`);
  }
});

test('D1-lock: every overlay parent ref resolves on the shipping corpus pair', () => {
  for (const [ce, ps] of Object.entries(overlay.edges || {})) {
    for (const p of ps) {
      assert.ok(persons[p] || refsIndex[p], `${ce}: parent ref ${p} must resolve (persons or refsIndex) - an unresolved ref is the D1 class`);
    }
  }
});

/* ==================================================================
 * ORDER5-R2 pre-attack fold-in (bFUzZ items 1-3, verified by own
 * boot-sim .scratch/d1verify/probe3.mjs):
 *  - item 2: corpus pass (:332) and overlay pass (:337) BOTH feed
 *    addChild with the same ovl rows -> duplicate children (head:
 *    Harthacnut x2 under Sigurd/Blaeja; naive resolve fix extends it:
 *    Sigurd x2 under Ragnar/Aslaug). addChild now dedups; the lock
 *    simulates the page boot and asserts ZERO dup parents tree-wide.
 *  - item 3: ghostCount (blood.html:365-366, computed post-merge) must
 *    not carry a FALSE frontier for the Norse island - Ragnar/Aslaug
 *    ARE published; the raw assign ghosted them (head: ghostCount
 *    [ovl-sigurd-snake-eye]=2 -> ghost slots :731/:1109 + the ":922
 *    N further parent references" line). Post-fix: absent.
 * ================================================================== */

test('D1-lock: children lists unique per parent (addChild dedup, page-boot sim)', () => {
  const page = readFileSync(join(ROOT, 'surfaces', 'blood.html'), 'utf8');
  assert.ok(page.includes('if(a.indexOf(c)<0)a.push(c)'), 'addChild must dedup: both merge passes feed it');
  /* replicate the page boot exactly: corpus pass, then the resolved overlay pass */
  const children = {};
  const addChild = (p, c) => { const a = (children[p] = children[p] || []); if (a.indexOf(c) < 0) a.push(c); };
  for (const e of Object.keys(corpus.edges)) corpus.edges[e].forEach((p) => addChild(p, e));
  for (const ce of Object.keys(overlay.edges || {})) overlay.edges[ce].map((p) => (persons[p] ? p : (refsIndex[p] || p))).forEach((p) => addChild(p, ce));
  let dupParents = 0; const named = [];
  for (const [p, l] of Object.entries(children)) { if (new Set(l).size !== l.length) { dupParents++; if (named.length < 4) named.push(`${nameOf(p)}: ${l.filter((x, i) => l.indexOf(x) !== i).join(',')}`); } }
  assert.equal(dupParents, 0, `parents with duplicate children: ${dupParents} (${named.join(' | ')}) - head had 2 (Harthacnut x2), a naive resolve fix has 4`);
});

test('D1-lock: no false ghost frontier for the Norse island (ghostCount sim)', () => {
  /* replicate blood.html:365-366 on the FIXED merge (edges is the resolved merge) */
  const ghostCount = {};
  for (const gk of Object.keys(edges)) { let gn = 0; (edges[gk] || []).forEach((p) => { if (!persons[p]) gn++; }); if (gn) ghostCount[gk] = gn; }
  for (const id of ['ovl-sigurd-snake-eye', 'ovl-blaeja-of-northumbria', 'ovl-harthacnut-i']) {
    assert.equal(ghostCount[id], undefined, `${nameOf(id)} must carry no ghost frontier - Ragnar/Aslaug ARE published (head: ghostCount=2 -> false ':922 not yet published' claim + ghost slots :731/:1109)`);
  }
});
