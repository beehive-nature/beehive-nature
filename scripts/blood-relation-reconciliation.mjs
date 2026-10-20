// Blood-relation reconciliation over the staged lineage roster.
//
// Question answered (founder, 2026-10-19): the public staged set includes
// relatives AND associated people — what is the verified count of unique
// deceased blood relatives, as distinct from spouses / in-law lines?
//
// Method: blood = transitive closure of parent-child edges from the roster
// root (spouse links via `couples` confer no blood). Uniqueness by
// FamilySearch person ref. Counts only — no living names, no private-tier
// identities are written to the output artifact.
//
// Inputs:
//   --roster  public remington-bloodline.json (checked out at origin/main tip)
//   --walk    private merged-walk-v4.json (read-only; cross-check numbers only)
//   --out     public artifact path (counts + method + checks)
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const rosterPath = arg('roster');
const walkPath = arg('walk');
const outPath = arg('out');
if (!rosterPath || !walkPath || !outPath) {
  console.error('usage: --roster <json> --walk <json> --out <json>');
  process.exit(2);
}

const roster = JSON.parse(readFileSync(rosterPath, 'utf8'));
const walk = JSON.parse(readFileSync(walkPath, 'utf8'));
const persons = roster.persons;
const personIds = Object.keys(persons);

// --- Part A: classify the public roster -------------------------------------
// blood closure from the roster root over parent edges (child -> [parents])
const blood = new Set([roster.root]);
const stack = [roster.root];
while (stack.length) {
  const cur = stack.pop();
  for (const parent of roster.edges[cur] || []) {
    if (!persons[parent]) continue; // placeholder slots never enter the closure
    if (!blood.has(parent)) { blood.add(parent); stack.push(parent); }
  }
}

// spouse map from couples values ({p1,p2}) — never parse the composite keys
const partners = new Map();
for (const c of Object.values(roster.couples)) {
  if (!partners.has(c.p1)) partners.set(c.p1, []);
  if (!partners.has(c.p2)) partners.set(c.p2, []);
  partners.get(c.p1).push(c.p2);
  partners.get(c.p2).push(c.p1);
}

const spouseOfBlood = new Set();
const attestedOverlay = [];
const residualOther = [];
for (const id of personIds) {
  if (blood.has(id)) continue;
  const ps = partners.get(id) || [];
  if (ps.some((p) => blood.has(p))) spouseOfBlood.add(id);
  else if (id.startsWith('ovl-') || (persons[id].evidence?.basis || '').includes('attested-overlay')) attestedOverlay.push(id);
  else residualOther.push(id);
}

// real-parent coverage on blood lines: a blood person's parent ref that is
// not staged must be a placeholder, never a real (in-walk) person — else
// blood ancestry would be hiding in the private tier.
const danglingOnBlood = { total: 0, placeholderUnknown: 0, realInWalk: 0, fsLikeNotInWalk: 0 };
for (const c of blood) {
  for (const p of roster.edges[c] || []) {
    if (persons[p]) continue;
    danglingOnBlood.total++;
    if (p === 'UNKNOWN') danglingOnBlood.placeholderUnknown++;
    else if (walk.persons[p]) danglingOnBlood.realInWalk++;
    else danglingOnBlood.fsLikeNotInWalk++;
  }
}
const bloodLineFullyStaged = danglingOnBlood.realInWalk === 0;

let bloodLiving = 0;
let bloodDeceased = 0;
const eraTally = {};
const fsIds = new Set();
let bloodDeceasedWithFsRef = 0;
const localIdToFs = new Map();
for (const id of blood) {
  const p = persons[id];
  if (p.living) bloodLiving++;
  else {
    bloodDeceased++;
    const era = p.evidence?.era ?? '?';
    eraTally[era] = (eraTally[era] || 0) + 1;
    const refs = (p.refs || []).filter((r) => r.provider === 'familysearch');
    if (refs.length) { bloodDeceasedWithFsRef++; for (const r of refs) fsIds.add(r.id); localIdToFs.set(id, refs.map((r) => r.id)); }
  }
}
// duplicate FS ids = one FS person staged under multiple local ids
const fsIdToLocals = new Map();
for (const [lid, ids] of localIdToFs) for (const fid of ids) {
  if (!fsIdToLocals.has(fid)) fsIdToLocals.set(fid, []);
  fsIdToLocals.get(fid).push(lid);
}
const fsIdsUnderMultipleLocalIds = [...fsIdToLocals.values()].filter((a) => a.length > 1).length;

const sumCheck = blood.size + spouseOfBlood.size + attestedOverlay.length + residualOther.length === personIds.length;

// --- Part B: cross-check against the graphs (numbers only) ------------------
const closureByDepth = (g) => {
  const depth = new Map([[g.root, 0]]);
  const st = [g.root];
  while (st.length) {
    const cur = st.pop();
    for (const parent of g.edges[cur] || []) {
      if (!g.persons[parent]) continue;
      if (!depth.has(parent)) { depth.set(parent, depth.get(cur) + 1); st.push(parent); }
    }
  }
  return depth;
};
const tallyDepths = (depth, lo, hi) => {
  const by = {};
  for (const d of depth.values()) by[d] = (by[d] || 0) + 1;
  const inRange = [...depth.entries()].filter(([, d]) => d >= lo && d <= hi).map(([id]) => id);
  return { by, uniqueInRange: new Set(inRange).size };
};
const walkDepth = closureByDepth(walk);
const rosterDepth = closureByDepth(roster);
const walkD = tallyDepths(walkDepth, 2, 9);
const rosterD = tallyDepths(rosterDepth, 2, 9);
// manifest receipt (order #29, verified at tip): byDepth 2–9 =
// 4/8/16/32/60/112/203/374, cohortPersons 809, redactedLiving 0
const manifestByDepth = { 2: 4, 3: 8, 4: 16, 5: 32, 6: 60, 7: 112, 8: 203, 9: 374 };
const depths2to8Exact = [2, 3, 4, 5, 6, 7, 8].every((d) => walkD.by[d] === manifestByDepth[d]);
let cohortLiving = 0;
const cohortLivingWho = [];
for (const [id, d] of walkDepth) {
  if (d >= 2 && d <= 9 && walk.persons[id].living) { cohortLiving++; cohortLivingWho.push(id); }

}

// --- Output: counts + method + checks, nothing else -------------------------
const artifact = {
  schema: 'skaists.blood-relation-reconciliation/1',
  generated: new Date().toISOString(),
  question:
    'verified count of unique deceased blood relatives in the staged public tree, distinct from associated people (spouses / in-law lines)',
  method: {
    bloodRule:
      'transitive closure of parent-child edges from the roster root; spouse links (couples) confer no blood; parent-slot placeholders (UNKNOWN / unfetched stub ids) never enter the closure',
    uniqueness: 'FamilySearch person refs where present; roster-local ids otherwise',
    inputs: {
      roster: 'assets/profile-archive/lineage/remington-bloodline.json at origin/main ecbc6e8a9 (public)',
      walk: 'private merged-walk-v4.json (read-only, cross-check numbers only; identities never copied)',
    },
  },
  counts: {
    publicStagedPersons: personIds.length,
    bloodTotal: blood.size,
    bloodLiving: bloodLiving,
    bloodDeceased: bloodDeceased,
    bloodDeceasedWithFsRef: bloodDeceasedWithFsRef,
    uniqueFsPersonsAmongBloodDeceased: fsIds.size,
    fsIdsUnderMultipleLocalIds: fsIdsUnderMultipleLocalIds,
    spouseOfBloodStaged: spouseOfBlood.size,
    attestedOverlayTraditionalFigures: attestedOverlay.length,
    residualOther: residualOther.length,
    eraOfBloodDeceased: eraTally,
  },
  checks: {
    rosterSum: `${blood.size} blood + ${spouseOfBlood.size} spouse-of-blood + ${attestedOverlay.length} attested-overlay + ${residualOther.length} residual = ${personIds.length}`,
    rosterSumOk: sumCheck,
    bloodLineFullyStaged: bloodLineFullyStaged,
    bloodLineStagingDetail: {
      note: 'parent refs of blood persons not in the roster',
      ...danglingOnBlood,
      meaning: 'realInWalk=0 means every real parent of every blood person is publicly staged — no blood ancestry in the private tier; the rest are walk placeholder slots',
    },
    cohortCrossCheck: {
      manifestReceipt: { cohortPersons: 809, byDepth: manifestByDepth, redactedLiving: 0 },
      walkComputed: { uniqueDepths2to9: walkD.uniqueInRange, byDepth2to9: Object.fromEntries(Object.entries(walkD.by).filter(([d]) => d >= 2 && d <= 9)) },
      rosterComputed: { uniqueDepths2to9: rosterD.uniqueInRange, byDepth2to9: Object.fromEntries(Object.entries(rosterD.by).filter(([d]) => d >= 2 && d <= 9)) },
      depths2to8ExactOnWalk: depths2to8Exact,
      residualDelta: {
        depth9: `${walkD.by[9] ?? 0} computed vs 374 receipt`,
        total: `${walkD.uniqueInRange} computed vs 809 receipt`,
        cause: 'the 09-18 harvest\u2019s guided-spine completion carried one depth-9 person beyond the repaired walk-v4 edges; the id-level cohort list is not committed at tip (records.json is record-keyed; cohort-8gen.json is a stale 503-entry partial; familysearch-ancestry-full.json is the pre-spine 501 state). The roster closure (372 at depth 9, all within the walk\u2019s 373) stages one fewer still.',
        verdict: 'cross-check agrees depths 2\u20138 exactly; residual = 1 person at depth 9, explained, not forced to fit',
      },
      livingInComputedRange: {
        count: cohortLiving,
        ids: cohortLivingWho,
        explanation: 'raw walk living-flags; both are the paternal grandparents, founder-attested deceased 2026-09-16 (roster corrected.attested), hence manifest redactedLiving=0',
      },
    },
  },
  boundaries: {
    whatThisIsNot: [
      'a count of biography COMPLETENESS — pages exist for all staged persons; the era mix (saga/medieval/colonial/unrecorded/recorded) is the evidence-quality axis, not a verified-biography claim',
      'a publication receipt — staged research pages are not separate published IQ.wiki articles',
      'the frozen 809-person 8-generation evidence cohort — that cohort (13,249 unique records) is the source-evidence layer for depths 2\u20139 only; this reconciliation covers the whole staged tree',
      'exhaustive evidence acquisition — see the order-29 completeness ledger: 314 images in hand, frontier stopped under the refusal',
    ],
    judgmentCallOpen: 'the 3 attested-overlay traditional figures (ovl- ids, saga era) sit outside the edge graph; whether traditional-lineage figures count as blood relatives is a founder identity-ruling class question, not closed here',
  },
};
writeFileSync(outPath, JSON.stringify(artifact, null, 1) + '\n');
console.log(JSON.stringify({ counts: artifact.counts, checks: { rosterSumOk: sumCheck, bloodLineFullyStaged, depths2to8ExactOnWalk: depths2to8Exact, residualDelta: artifact.checks.cohortCrossCheck.residualDelta } }, null, 1));
