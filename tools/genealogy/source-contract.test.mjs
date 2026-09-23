/* source-contract.test.mjs — the battery for the independent reader.
 *
 * Three things are being proven here, and they are different things:
 *
 *  I  INDEPENDENCE. source-contract.mjs imports nothing from the genealogy
 *     implementation. An import would make it a third copy of the reading it
 *     exists to cross. The scanner is proven capable of finding an import by
 *     running it over a file that HAS them.
 *
 *  R  THE REAL ARCHIVE. Every clause is non-vacuous on the published corpus
 *     (it inspected something), and the finding set equals a declared
 *     BASELINE — both directions. A new finding fails by name; a repaired
 *     finding ALSO fails, by name, and the fix is to delete its baseline line
 *     in the same commit. A subset-only gate reports a dead entry never, and
 *     a dead entry is how a reviewer inherits a reading nobody re-measured.
 *
 *  M  THE MUTATIONS. A clean synthetic fixture yields zero findings — that is
 *     the CONTROL, and without it a battery of refusals proves nothing. Then
 *     each clause is broken in turn and must fire ALONE. A mutation may make
 *     several coordinated edits (breaking one law while keeping a declared
 *     count honest); what is asserted is the set of codes that appear, never
 *     that "something changed".
 *
 * Node --test, zero deps, DOM-free.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { checkSourceContract, findingKey, CLAUSE_CODES, declaredTiers } from './source-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const L = join(ROOT, 'assets', 'profile-archive', 'lineage');

/* ========================================================================
 * BASELINE — the findings the published archive carries at this pin, each
 * with the judgement attached. A line here is a KNOWN-OPEN row, never a
 * dismissal: the checker keeps reporting it and the gate keeps both
 * directions honest.
 * ===================================================================== */
const BASELINE = [
  ['SRC-EDGE-OVERSTATED :: ovl-sigurd-snake-eye->pf5d40516b8',
    'OPEN. attested-overlays.edgeNotes calls this edge "parents per tradition"; the staged person object and the person PAGE a stranger reads both label it "walked provider link" — the strongest tag in the hop vocabulary. person-panel-corpus.mjs:217 computes the honest "overlay — tradition-carried" at render time, so the panel reader and the archive-door reader disagree about the same fact. Not repaired here: the staged objects are pipeline.mjs output and this lane may not touch it.'],
  ['SRC-EDGE-OVERSTATED :: ovl-sigurd-snake-eye->p8bfb696a4b', 'OPEN. Same edge class, second parent (Queen Aslaug).'],
  ['SRC-EDGE-OVERSTATED :: ovl-harthacnut-i->ovl-blaeja-of-northumbria',
    'OPEN. Sharper than the other two: the overlay\'s own relationshipEvidence disputes the claim "Harthacnut is the son of Sigurd AND Blaeja", and the Sigurd half is staged "disputed — inspect in the comb" while the Blaeja half of the SAME disputed claim is staged "walked provider link". One claim, two provenance labels.'],
  ['CLM-TIER-UNDECLARED :: unrecorded',
    'OPEN, and narrower than it reads. "unrecorded" is a real sixth tier — blood.html, profile.html, person-panel-corpus.mjs and the GUX-01 frontier dispatch all name it. What is missing is the CORPUS\'S OWN sentence: meta.confidenceTiers declares four classes and the corpus publishes 1,800 persons in a fifth. The defect is the declaration, not the data.'],
  ['LNK-COUPLE-AND-EDGE :: p0b2a91a835|p59ca207357', 'OPEN — Probus Ferreolus di Roma / Syagria Papianilla, 4th c. Gaul.'],
  ['LNK-COUPLE-AND-EDGE :: p59ca207357|p7b4ce90388', 'OPEN — Syagria Papianilla / Flavius Afranius Syagrius II. Syagria stands in two of the seven.'],
  ['LNK-COUPLE-AND-EDGE :: p13f145e0f0|p41e853380c', 'OPEN — Menkare / Netikereti, 7th dynasty.'],
  ['LNK-COUPLE-AND-EDGE :: p329cac0c1e|pd69d747cb1', 'OPEN — Bintanath / Ramesses II. A consanguineous marriage the historical record itself carries; the corpus is being faithful, not wrong.'],
  ['LNK-COUPLE-AND-EDGE :: p321780663d|pe58481281a', 'OPEN — Cleopatra V Tryphaena / Ptolemy XII Auletes.'],
  ['LNK-COUPLE-AND-EDGE :: p7c4314f0bf|p854fa8143e', 'OPEN — Eglon ben Balak / Orfa bat Eglon.'],
  ['LNK-COUPLE-AND-EDGE :: p48d02fc52a|pebab1efcae', 'OPEN — "Mrs Aksumay Ramissu of Ethiopia" / "Aksumay Ramissu of ETHIOPIA": two provider records that read like one person, which is the OTHER way into this class. Whether each of the seven is a faithful marriage or a duplicate record is unresolved here and the row does not claim it.'],
  ['LNK-FRONTIER-UNDISCLOSED :: meta.reconciliation',
    'OPEN. 1,959 staged parent references point at persons the corpus did not publish. meta.reconciliation accounts for the raw walk minus the published corpus and says nothing about references the published corpus still carries INTO that excluded population. PR #222 adds the disclosure; this lane is ordered not to touch #222\'s changes, so the row is reported and left standing.'],
];
const BASELINE_KEYS = new Set(BASELINE.map(([k]) => k));

/* ---------------------------------------------------------------- loaders */
function loadArchive() {
  const corpus = JSON.parse(readFileSync(join(L, 'remington-bloodline.json'), 'utf8'));
  const overlay = JSON.parse(readFileSync(join(L, 'attested-overlays.json'), 'utf8'));
  const packPaths = new Set(Object.values((corpus.meta && corpus.meta.packs) || {}));
  for (const p of Object.values(overlay.persons || {})) if (p && p.evidencePack) packPaths.add(p.evidencePack);
  const packs = {};
  for (const p of packPaths) if (existsSync(join(L, p))) packs[p] = JSON.parse(readFileSync(join(L, p), 'utf8'));
  const staged = {};
  for (const f of readdirSync(join(L, 'persons'))) {
    if (f.endsWith('.json')) staged[f.slice(0, -5)] = JSON.parse(readFileSync(join(L, 'persons', f), 'utf8'));
  }
  return { corpus, overlay, packs, staged, packExists: (p) => existsSync(join(L, p)) };
}

const archive = loadArchive();
const real = checkSourceContract(archive);

/* ========================================================================
 * I — INDEPENDENCE
 * ===================================================================== */

/* every static/dynamic import or require, whatever it points at. */
const IMPORT_SCANNER = /(^|\n)\s*import\s|(^|[^\w.])require\s*\(|(^|[^\w.])import\s*\(/g;

function importHits(src) {
  const out = [];
  for (const m of src.matchAll(IMPORT_SCANNER)) out.push(src.slice(m.index, m.index + 60).split('\n')[0].trim());
  return out;
}

test('I1: the scanner can find an import — control on a file that has them', () => {
  const control = readFileSync(join(HERE, 'agreement.test.mjs'), 'utf8');
  const hits = importHits(control);
  assert.ok(hits.length >= 5, `the import scanner found ${hits.length} imports in agreement.test.mjs — a scanner that finds nothing cannot report an absence`);
});

test('I2: source-contract.mjs imports nothing at all', () => {
  const src = readFileSync(join(HERE, 'source-contract.mjs'), 'utf8');
  const hits = importHits(src);
  assert.deepEqual(hits, [], `the independent reader imports: ${JSON.stringify(hits)}`);
});

test('I3: source-contract.mjs names no implementation module, even in prose-free code', () => {
  const src = readFileSync(join(HERE, 'source-contract.mjs'), 'utf8');
  /* strip block and line comments: the header QUOTES these filenames on
   * purpose, and a scan that cannot tell a citation from a dependency would
   * fail on its own documentation. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)\s*\/\/[^\n]*/g, '');
  for (const mod of ['model.mjs', 'pipeline.mjs', 'person-panel-corpus.mjs', 'archive-core.mjs', 'fs-adapter.mjs', 'gedcom.mjs']) {
    assert.ok(!code.includes(mod), `${mod} is named in the CODE of the independent reader`);
  }
  /* non-vacuity: the same strip leaves real code behind. */
  assert.ok(code.includes('checkSourceContract'), 'the comment strip removed the code as well as the comments');
});

test('I4: the reader is pure — checking the real archive twice gives the same answer, and does not move the archive', () => {
  const before = JSON.stringify(archive.corpus.meta) + JSON.stringify(archive.overlay.law);
  const again = checkSourceContract(archive);
  assert.deepEqual(again.findings.map(findingKey).sort(), real.findings.map(findingKey).sort());
  assert.equal(JSON.stringify(archive.corpus.meta) + JSON.stringify(archive.overlay.law), before);
});

/* ========================================================================
 * R — THE REAL ARCHIVE
 * ===================================================================== */

test('R1: no clause is vacuous — every one of them inspected something', () => {
  const vacuous = CLAUSE_CODES.filter((c) => !real.inspected[c]);
  assert.deepEqual(vacuous, [], `clauses that inspected nothing (a clean verdict from these means nothing): ${vacuous.join(', ')}`);
  /* and the sweep is the size of the archive, not of a sample */
  assert.ok(real.inspected['LNK-RECIPROCITY'] > 20000, `reciprocity inspected ${real.inspected['LNK-RECIPROCITY']} rows`);
  assert.ok(real.inspected['SRC-NO-PROVENANCE'] > 10000, `provenance inspected ${real.inspected['SRC-NO-PROVENANCE']} persons`);
});

test('R2: no finding outside the baseline', () => {
  const extra = real.findings.filter((f) => !BASELINE_KEYS.has(findingKey(f)));
  assert.deepEqual(extra.map((f) => `${findingKey(f)} — ${f.detail}`), [],
    'the published archive carries a source/claim/linking finding this baseline does not declare');
});

test('R3: no dead baseline entry — a repaired row must be deleted from the baseline, not left standing', () => {
  const live = new Set(real.findings.map(findingKey));
  const dead = [...BASELINE_KEYS].filter((k) => !live.has(k));
  assert.deepEqual(dead, [],
    'these baseline rows are no longer produced — if the repair landed, delete the line in the same commit');
});

test('R4: the declared tier vocabulary is parsed out of the corpus, not hard-coded', () => {
  const tiers = declaredTiers(archive.corpus.meta.confidenceTiers);
  assert.deepEqual([...tiers].sort(), ['colonial', 'medieval', 'recorded', 'saga']);
  /* the parser must be able to return a different answer, or it is a constant */
  assert.deepEqual([...declaredTiers('era heuristic (saga <1000)')], ['saga']);
  assert.deepEqual([...declaredTiers('')], []);
});

/* ========================================================================
 * M — THE MUTATIONS
 * ===================================================================== */

function cleanFixture() {
  const person = (over) => Object.assign({
    name: 'Somebody', lifespan: '1900–1980', gender: 'MALE', living: false, source: 'familysearch',
    evidence: { era: 'recorded', support: 'unsourced-entry', class: 'recorded', basis: 'era label from dates; support unsourced until sources are harvested' },
    refs: [{ provider: 'familysearch', id: 'AAA-000' }],
    research: { status: 'incomplete', basis: 'per-person source counts not yet harvested' },
    publication: { status: 'public' },
  }, over);
  const ovlPerson = (id) => person({
    name: id, living: false, source: undefined,
    evidence: { era: 'saga', support: 'attested', class: 'saga', basis: 'attested-overlay: tradition' },
    refs: [{ provider: 'attested-overlay', id }],
    research: { status: 'tradition-entered', basis: 'per-person source counts not yet harvested' },
    evidencePack: 'evidence/f.json',
  });
  const stagedOf = (id, parents, children, over) => Object.assign({
    schema: 'skaists.person/1', internalId: id,
    identity: { name: id, living: false },
    refs: [{ provider: 'familysearch', id: 'AAA-000' }],
    evidence: { era: 'recorded', support: 'unsourced-entry', class: 'recorded', basis: 'era label from dates' },
    research: { status: 'incomplete', basis: 'per-person source counts not yet harvested' },
    publication: { status: 'public' },
    relationships: { parents, children, spouses: [] },
    layers: { records: null, tradition: null, testimony: [], meaning: [] },
  }, over);

  const corpus = {
    persons: {
      pRoot: person({ name: 'Root', refs: [{ provider: 'familysearch', id: 'AAA-111' }] }),
      pDad: person({
        name: 'Dad', refs: [{ provider: 'familysearch', id: 'AAA-222' }],
        corrected: { attested: 'founder order', note: 'attested deceased' },
        research: { status: 'corrected-attested', basis: 'per-person source counts not yet harvested' },
      }),
      pMom: person({ name: 'Mom', refs: [{ provider: 'familysearch', id: 'AAA-333' }] }),
      'ovl-a': ovlPerson('ovl-a'),
      'ovl-b': ovlPerson('ovl-b'),
      stub: person({
        name: 'Living', living: true, refs: [], source: undefined,
        evidence: { era: 'living', support: 'unsourced-entry', class: 'living', basis: 'redacted stub' },
        publication: { status: 'private-stub', reason: 'living' },
      }),
    },
    edges: { pRoot: ['pDad', 'pMom'], 'ovl-a': ['pDad'], 'ovl-b': ['ovl-a'] },
    couples: { 'pDad|pMom': { p1: 'pDad', p2: 'pMom' } },
    refsIndex: { 'AAA-111': 'pRoot', 'AAA-222': 'pDad', 'AAA-333': 'pMom' },
    meta: {
      stats: { deceasedPublished: 6 },
      privacy: 'living persons redacted; root-line living survive as anonymous stubs',
      confidenceTiers: 'era heuristic (recorded ≥1850 · colonial 1550–1850 · medieval 1000–1550 · saga <1000)',
      claimPolicy: 'every person carries its evidence class',
      packs: { 'ovl-a': 'evidence/f.json' },
      reconciliation: { rawPersons: 9, published: 6 },
      correctionsApplied: 1,
      overlayPersons: 2,
      stagedPersons: {
        store: 'persons/', publicStaged: 6,
        researchCounts: { incomplete: 3, 'corrected-attested': 1, 'tradition-entered': 2 },
        publicationCounts: { public: 5, 'private-stub': 1 },
      },
    },
  };

  const overlay = {
    schema: 'skaists.lineage-overlay/1',
    persons: {
      'ovl-a': { name: 'ovl-a', living: false, evidence: { class: 'saga', basis: 'attested-overlay: tradition' }, evidencePack: 'evidence/f.json' },
      'ovl-b': { name: 'ovl-b', living: false, evidence: { class: 'saga', basis: 'attested-overlay: tradition' }, evidencePack: 'evidence/f.json' },
    },
    edges: { 'ovl-a': ['AAA-222'], 'ovl-b': ['ovl-a'] },
    edgeNotes: { 'ovl-a': 'parents per tradition', 'ovl-b': 'parents per tradition' },
    corrections: { 'AAA-222': { patch: { living: false }, note: 'attested deceased', attested: 'founder order' } },
    relationshipEvidence: {
      'ovl-b|ovl-a': {
        claim: 'ovl-b is the child of ovl-a', status: 'disputed',
        hypotheses: [{ id: 'h1', label: 'one' }, { id: 'h2', label: 'two' }],
        contradictions: 'the two traditions are a century apart',
        sources: ['https://example.invalid/a'],
      },
    },
    testimony: [{ id: 't1', lens: 'testimony', subject: 'the line', author: 'family testimony', text: 'a story', status: 'attributed testimony — records pending' }],
    moneyHistory: { law: 'never confused with parentage', entries: [{ ref: 't1', via: 'testimony' }] },
    symbolicLinks: [{ id: 'sym-1', symbol: 'a crest', meaning: 'a meaning', connects: ['pRoot'], kind: 'meaning', attribution: 'founder-authored symbolism' }],
    law: 'Overlay ids use the ovl- prefix',
  };

  const packs = {
    'evidence/f.json': {
      schema: 'skaists.evidence/1',
      person: { name: 'Dad', lifespan: '1900–1980', fsid: 'AAA-222', tier: 'recorded', tierBasis: 'era label' },
      summary: 'the pack',
      claims: [{ claim: 'Record: Dad, provider person AAA-222, retrieved 2026-09-16.', source: 'FamilySearch Family Tree record', url: 'https://example.invalid/AAA-222' }],
      law: 'This pack ATTRIBUTES the provider record. It does not assert independent verification.',
    },
  };

  const staged = {
    pRoot: stagedOf('pRoot', [{ id: 'pDad', name: 'Dad', evidence: 'walked provider link' }, { id: 'pMom', name: 'Mom', evidence: 'walked provider link' }], []),
    pDad: stagedOf('pDad', [], [{ id: 'pRoot', name: 'Root' }, { id: 'ovl-a', name: 'ovl-a' }], { research: { status: 'corrected-attested', basis: 'per-person source counts not yet harvested' } }),
    pMom: stagedOf('pMom', [], [{ id: 'pRoot', name: 'Root' }]),
    'ovl-a': stagedOf('ovl-a', [{ id: 'pDad', name: 'Dad', evidence: 'overlay — tradition-carried' }], [{ id: 'ovl-b', name: 'ovl-b' }], {
      refs: [{ provider: 'attested-overlay', id: 'ovl-a' }],
      research: { status: 'tradition-entered', basis: 'per-person source counts not yet harvested' },
      layers: { records: null, tradition: { pack: 'evidence/f.json' }, testimony: [], meaning: [] },
    }),
    'ovl-b': stagedOf('ovl-b', [{ id: 'ovl-a', name: 'ovl-a', evidence: 'disputed — inspect in the comb' }], [], {
      refs: [{ provider: 'attested-overlay', id: 'ovl-b' }],
      research: { status: 'tradition-entered', basis: 'per-person source counts not yet harvested' },
      layers: { records: null, tradition: { pack: 'evidence/f.json' }, testimony: [], meaning: [] },
    }),
    stub: stagedOf('stub', [], [], {
      identity: { name: 'Living', living: true }, refs: [],
      publication: { status: 'private-stub', reason: 'living' },
    }),
  };

  return { corpus, overlay, packs, staged, packExists: (p) => Object.prototype.hasOwnProperty.call(packs, p) };
}

function runFixture(mutate) {
  const fx = cleanFixture();
  /* packExists must follow the MUTATED pack map, not the one captured at build */
  const state = { corpus: fx.corpus, overlay: fx.overlay, packs: fx.packs, staged: fx.staged };
  if (mutate) mutate(state);
  return checkSourceContract({
    ...state,
    packExists: (p) => Object.prototype.hasOwnProperty.call(state.packs, p),
  });
}

test('M0 CONTROL: the clean fixture yields zero findings and no vacuous clause', () => {
  const r = runFixture(null);
  assert.deepEqual(r.findings.map((f) => `${findingKey(f)} — ${f.detail}`), [],
    'the control fixture is not contract-clean, so every refusal below would be meaningless');
  const vacuous = CLAUSE_CODES.filter((c) => !r.inspected[c]);
  assert.deepEqual(vacuous, [], `the fixture never reaches these clauses, so their mutations prove nothing: ${vacuous.join(', ')}`);
});

const MUTATIONS = [
  ['SRC-PACK-UNDECLARED', (s) => { delete s.overlay.persons['ovl-a'].evidencePack; }],
  ['SRC-PACK-MISSING', (s) => { s.overlay.persons['ovl-a'].evidencePack = 'evidence/gone.json'; }],
  ['SRC-OVERLAY-CLASS', (s) => { s.overlay.persons['ovl-a'].evidence.class = 'recorded'; }],
  ['SRC-PACK-NO-LAW', (s) => { delete s.packs['evidence/f.json'].law; }],
  ['SRC-PACK-CLAIM-UNSOURCED', (s) => { s.packs['evidence/f.json'].claims[0].source = ''; }],
  ['SRC-PACK-FSID-UNRESOLVED', (s) => { s.packs['evidence/f.json'].person.fsid = 'ZZZ-999'; }],
  ['SRC-META-PACK-UNKNOWN', (s) => { s.corpus.meta.packs.pGhost = 'evidence/f.json'; }],
  ['SRC-NO-PROVENANCE', (s) => { s.staged.pRoot.refs = []; }],
  ['SRC-STUB-CARRIES-REFS', (s) => { s.staged.stub.refs = [{ provider: 'familysearch', id: 'AAA-444' }]; }],
  ['SRC-EDGE-OVERSTATED', (s) => { s.staged['ovl-a'].relationships.parents[0].evidence = 'walked provider link'; }],
  ['CLM-VERIFICATION-LANGUAGE', (s) => { s.packs['evidence/f.json'].claims[0].claim += ' The descent is independently verified.'; }],
  ['CLM-TIER-UNDECLARED', (s) => { s.corpus.persons.pRoot.evidence.class = 'unrecorded'; }],
  ['CLM-ERA-AS-SUPPORT', (s) => { s.corpus.persons.pRoot.evidence.support = 'recorded'; }],
  ['CLM-SUPPORT-OVERSTATED', (s) => { s.corpus.persons.pRoot.evidence.support = 'sourced'; }],
  ['CLM-SYMBOL-UNATTRIBUTED', (s) => { s.overlay.symbolicLinks[0].attribution = ''; }],
  ['CLM-SYMBOL-DANGLING', (s) => { s.overlay.symbolicLinks[0].connects = ['pNobody']; }],
  ['CLM-SYMBOL-AS-EDGE', (s) => { s.overlay.symbolicLinks[0].id = 'pRoot'; }],
  ['CLM-MONEY-AS-BLOOD', (s) => { s.overlay.moneyHistory.entries[0].ref = 'pRoot'; }],
  ['CLM-TESTIMONY-UNATTRIBUTED', (s) => { s.overlay.testimony[0].author = ''; }],
  ['CLM-DISPUTE-THIN', (s) => { s.overlay.relationshipEvidence['ovl-b|ovl-a'].hypotheses = [{ id: 'h1' }]; }],
  /* NOT 'walked provider link': that would also break SRC-EDGE-OVERSTATED and
   * the mutation would stop discriminating. The honest overlay tag is exactly
   * the wrong answer here — the edge IS tradition-carried AND disputed. */
  ['CLM-DISPUTE-UNDISCLOSED', (s) => { s.staged['ovl-b'].relationships.parents[0].evidence = 'overlay — tradition-carried'; }],
  ['LNK-OVERLAY-PREFIX', (s) => {
    s.overlay.persons.oa = { name: 'oa', living: false, evidence: { class: 'saga', basis: 'tradition' }, evidencePack: 'evidence/f.json' };
    s.corpus.meta.overlayPersons = 3; /* keep the declared count honest so META-COUNT-DIVERGE stays silent */
  }],
  ['LNK-OVERLAY-EDGE-UNRESOLVED', (s) => { s.overlay.edges['ovl-a'] = ['NOPE-1']; }],
  ['LNK-CORRECTION-UNRESOLVED', (s) => {
    s.overlay.corrections['ZZZ-000'] = s.overlay.corrections['AAA-222'];
    delete s.overlay.corrections['AAA-222'];
  }],
  ['LNK-CORRECTION-NOT-APPLIED', (s) => { delete s.corpus.persons.pDad.corrected; }],
  ['LNK-SELF-PARENT', (s) => { s.corpus.edges.pRoot.push('pRoot'); }],
  ['LNK-EDGE-ORPHAN', (s) => { s.corpus.edges.pGhost = ['pDad']; }],
  ['LNK-COUPLE-BROKEN', (s) => { s.corpus.couples['pDad|pMom'].p2 = 'pNobody'; }],
  ['LNK-COUPLE-AND-EDGE', (s) => { s.corpus.edges.pDad = ['pMom']; }],
  ['LNK-RECIPROCITY', (s) => { s.staged.pDad.relationships.children = []; }],
  ['LNK-STAGED-CORPUS-DIVERGE', (s) => {
    s.staged.pExtra = JSON.parse(JSON.stringify(s.staged.pMom));
    s.staged.pExtra.internalId = 'pExtra';
    s.staged.pExtra.relationships = { parents: [], children: [], spouses: [] };
    s.corpus.meta.stagedPersons.publicStaged = 7;
    s.corpus.meta.stagedPersons.researchCounts.incomplete = 4;
    s.corpus.meta.stagedPersons.publicationCounts.public = 6;
  }],
  ['LNK-FRONTIER-UNDISCLOSED', (s) => {
    s.staged.pRoot.relationships.parents.push({ id: 'pGhost', name: 'unpublished', evidence: 'walked provider link' });
  }],
  ['META-COUNT-DIVERGE', (s) => { s.corpus.meta.stats.deceasedPublished = 99; }],
];

assert.equal(MUTATIONS.length, CLAUSE_CODES.length,
  `every clause owes a mutation: ${CLAUSE_CODES.length} clauses, ${MUTATIONS.length} mutations`);

for (const [code, mutate] of MUTATIONS) {
  test(`M ${code}: breaking this clause fires it, and fires nothing else`, () => {
    const r = runFixture(mutate);
    const codes = [...new Set(r.findings.map((f) => f.code))].sort();
    assert.deepEqual(codes, [code],
      `expected ${code} alone; got ${JSON.stringify(r.findings.map((f) => `${findingKey(f)} — ${f.detail}`))}`);
  });
}

test('M-REMEDY LNK-FRONTIER-UNDISCLOSED: declaring the frontier clears it — the row reads the DISCLOSURE, not the dangling ref', () => {
  const withGhost = runFixture((s) => {
    s.staged.pRoot.relationships.parents.push({ id: 'pGhost', name: 'unpublished', evidence: 'walked provider link' });
  });
  assert.deepEqual([...new Set(withGhost.findings.map((f) => f.code))], ['LNK-FRONTIER-UNDISCLOSED']);
  const disclosed = runFixture((s) => {
    s.staged.pRoot.relationships.parents.push({ id: 'pGhost', name: 'unpublished', evidence: 'walked provider link' });
    s.corpus.meta.reconciliation.frontier = { unresolvedParentReferences: 1, note: 'the line stops here and the corpus says so' };
  });
  assert.deepEqual(disclosed.findings.map(findingKey), [],
    'the clause must accept a stated frontier, or it is a ban on the archive having edges rather than a disclosure law');
});

test('M-REMEDY SRC-EDGE-OVERSTATED: the honest tag clears it, and a missing row is not silently a pass', () => {
  const overstated = runFixture((s) => { s.staged['ovl-a'].relationships.parents[0].evidence = 'walked provider link'; });
  assert.deepEqual([...new Set(overstated.findings.map((f) => f.code))], ['SRC-EDGE-OVERSTATED']);
  const honest = runFixture((s) => { s.staged['ovl-a'].relationships.parents[0].evidence = 'overlay — tradition-carried'; });
  assert.deepEqual(honest.findings.map(findingKey), []);
  /* and the inspected count must fall when the row disappears, or "clean"
   * would be indistinguishable from "never looked" */
  const absent = runFixture((s) => { s.staged['ovl-a'].relationships.parents = []; });
  assert.ok(absent.inspected['SRC-EDGE-OVERSTATED'] < runFixture(null).inspected['SRC-EDGE-OVERSTATED'],
    'removing the staged row left the inspected count unchanged — the clause is counting something else');
});

test('M-REMEDY META-COUNT-DIVERGE: a DELETED census declaration fires by name — the clause used to fail open on exactly this', () => {
  /* PRECONDITION: the fixture must actually publish a census under both
   * fields, or a "fires" assertion below would be asserting the fixture. */
  const clean = cleanFixture();
  const sp = clean.corpus.meta.stagedPersons;
  for (const key of ['researchCounts', 'publicationCounts']) {
    const total = Object.values(sp[key]).reduce((n, v) => n + v, 0);
    assert.ok(total > 0, `the fixture declares an EMPTY ${key}, so deleting it proves nothing`);
  }

  for (const key of ['researchCounts', 'publicationCounts']) {
    const r = runFixture((s) => { delete s.corpus.meta.stagedPersons[key]; });
    assert.deepEqual(r.findings.map(findingKey), [`META-COUNT-DIVERGE :: meta.stagedPersons.${key}`],
      `deleting meta.stagedPersons.${key} must be reported BY NAME; a silent skip turns three real comparisons off and every gate stays green`);
  }

  /* the OTHER direction: a declaration that is present and honest stays silent,
   * so the row above is not a ban on the field existing. */
  assert.deepEqual(runFixture(null).findings.map(findingKey), []);

  /* and the inspected count is not the instrument: it FALLS on the deletion,
   * which is precisely why a truthiness test on it could not see the fail-open. */
  const base = runFixture(null).inspected['META-COUNT-DIVERGE'];
  const cut = runFixture((s) => { delete s.corpus.meta.stagedPersons.researchCounts; }).inspected['META-COUNT-DIVERGE'];
  assert.ok(cut < base, `inspected did not fall (${base} -> ${cut}); the deletion never reached the clause`);
});

test('M-REMEDY META-COUNT-DIVERGE: an absent census over an EMPTY field is silent — the escape hatch owes a row too', () => {
  /* Nothing is published under `research`, so there is no census to declare
   * and an absent declaration states nothing false. Without this arm the
   * `total === 0` branch is an untested off-switch. */
  const r = runFixture((s) => {
    delete s.corpus.meta.stagedPersons.researchCounts;
    for (const obj of Object.values(s.staged)) delete obj.research;
    for (const p of Object.values(s.corpus.persons)) delete p.research;
  });
  const metaRows = r.findings.filter((f) => f.code === 'META-COUNT-DIVERGE');
  assert.deepEqual(metaRows.map(findingKey), [],
    'an absent census over a field nobody publishes must not be reported — that would be a ban on the field being unused');
  /* non-vacuity: the clause still ran. */
  assert.ok(r.inspected['META-COUNT-DIVERGE'] > 0, 'the clause never executed, so its silence means nothing');
});
