// CLASS E — the records the chronology reporter cannot see, reported by SHAPE.
//
// WHY THIS FILE EXISTS. Classes A, B and C are all defined over records whose
// lifespan PARSES. 1,380 records do not, and until this file nothing anywhere
// counted them: they are absent from class A, from class B, from class C and
// from every denominator those three use. Unusable data and absent data are
// indistinguishable unless an instrument reports the residue separately.
//
// The cost of not having this was measured, not imagined. One record carried
// three U+FFFD replacement characters where an en-dash belonged (a UTF-8
// en-dash rejected one byte at a time), which silently removed its person from
// every chronological check. It was found by a hand reading records long after
// it landed, because no row anywhere said "this record was not judged".
// R-E4 is what would have named it on the day it arrived: the shape was not
// on the allow-list, so the row fails printing the shape. R-E2's sum would
// NOT have — a total partition is invariant under a record moving between
// buckets, and every defect of this class moves a record between buckets.
// That sentence stood here in the first candidate, was measured false in
// review (plant a shape: R-E2 green, R-E4 falls alone), and is deleted rather
// than patched. A refutation published in a message does not edit a file.
//
// IT REPORTS. It repairs nothing and it must never become a repair list —
// precedent is the cycle row and the chronology reporter beside it.
//
// AND MOST OF THE RESIDUE IS NOT A DEFECT. A death-only lifespan ("-1801") is
// valid data: we know when the person died and not when they were born. A bare
// "Deceased" is the corpus's own sanctioned placeholder. Counting either as a
// defect would inflate a backlog with work that has no fault to fix. What this
// file separates is the residue that is SANCTIONED from the residue that is a
// shape nobody has reviewed.
//
// WHY THE GATE IS AN ALLOW-LIST AND NOT A COUNT. A pinned residue total goes
// red the day a repair lands, which trains a reader to dismiss it — and an
// always-red gate is worse than no gate, because an empty slot does not lie.
// So the failing condition is a shape that is neither sanctioned nor already
// reviewed. A repair makes a known shape DISAPPEAR and the row stays green; a
// new unparseable shape appears and the row fails naming it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LINEAGE = new URL("../../assets/profile-archive/lineage/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const model = JSON.parse(readFileSync(LINEAGE + "remington-bloodline.json", "utf8"));
const P = model.persons, E = model.edges;

// the chronology reporter's parser, deliberately the SAME one: class E must be
// the complement of what THAT instrument can read, not of an idealised parser.
const DASH = /[–\-]/;
const isBC = (t) => /BC\s*$/i.test((t || "").trim());
const yr = (tok) => {
  if (!tok) return null;
  const t = tok.trim();
  const n = parseInt(t.replace(/BC\s*$/i, ""), 10);
  return Number.isFinite(n) ? (isBC(t) ? -n : n) : null;
};
const halves = (p) => {
  if (!p || typeof p.lifespan !== "string") return null;
  const a = p.lifespan.split(DASH);
  return a.length === 2 ? a : null;
};
const birth = (p) => { const a = halves(p); return a ? yr(a[0]) : null; };
const death = (p) => { const a = halves(p); return a ? yr(a[1]) : null; };

// ── the partition. SIX buckets, and the sixth is declared even though it is
// empty today: an omitted bucket is exactly how a sum silently stops summing.
const BUCKETS = {
  fullyDated: [],      // two parts, BOTH parse — everything A/B/C judge
  birthOnly: [],       // two parts, birth parses, death does not
  deathOnly: [],       // two parts, death parses, birth does not
  notTwoParts: [],     // lifespan present, does not split into two parts
  noLifespan: [],      // no lifespan field at all
  neitherParses: [],   // two parts, NEITHER parses — 0 today, declared anyway
};
for (const [id, p] of Object.entries(P)) {
  if (typeof p.lifespan !== "string" || p.lifespan.trim() === "") { BUCKETS.noLifespan.push(id); continue; }
  const a = halves(p);
  if (a === null) { BUCKETS.notTwoParts.push(id); continue; }
  const b = yr(a[0]), d = yr(a[1]);
  if (b !== null && d !== null) BUCKETS.fullyDated.push(id);
  else if (b !== null) BUCKETS.birthOnly.push(id);
  else if (d !== null) BUCKETS.deathOnly.push(id);
  else BUCKETS.neitherParses.push(id);
}
const POP = Object.keys(P).length;
const RESIDUE = [...BUCKETS.deathOnly, ...BUCKETS.notTwoParts, ...BUCKETS.noLifespan, ...BUCKETS.neitherParses];

// ── the shape inventory for the TWO buckets whose contents are strings rather
// than dates. notTwoParts never split; neitherParses split into two halves and
// neither half is a year. Those are different defects, but they share ONE
// allow-list, because the question a reader asks of both is the same: has a
// human looked at this shape yet?
//
// "Deceased" is the corpus's own placeholder. The other two are reviewed
// defects. FFFD_ENDASH is now a DEAD matcher: the date-repair lane landed as
// c8751901 and no record carries that shape any more. It is kept deliberately
// — a subset check reports a dead entry never, which is exactly what lets a
// repair land green, and R-E5 uses it as a live fixture. That is the cost of
// the subset design, named here so it does not look free.
const SANCTIONED = new Set(["Deceased"]);
const FFFD_ENDASH = "0640" + "�".repeat(3) + "0709";   // built from codepoints
const REVIEWED_UNPARSEABLE = new Set([FFFD_ENDASH, "9th century (traditional)"]);
const shapeOf = (id) => (P[id].lifespan || "").trim();
const censusOf = (ids) => {
  const m = new Map();
  for (const id of ids) m.set(shapeOf(id), (m.get(shapeOf(id)) || 0) + 1);
  return m;
};
const unreviewedIn = (census) =>
  [...census.keys()].filter((s) => !SANCTIONED.has(s) && !REVIEWED_UNPARSEABLE.has(s));
const shapeCensus = censusOf(BUCKETS.notTwoParts);
const pairCensus = censusOf(BUCKETS.neitherParses);
const unreviewed = unreviewedIn(shapeCensus);
const unreviewedPairShapes = unreviewedIn(pairCensus);
const classify = (shape) => (SANCTIONED.has(shape) ? "sanctioned" : REVIEWED_UNPARSEABLE.has(shape) ? "reviewed" : "UNREVIEWED");

test("R-E1 non-vacuity: the real corpus, a parser that parses, and a residue that exists", () => {
  assert.ok(POP > 1000, `the real corpus is loaded, got ${POP} persons`);
  assert.ok(BUCKETS.fullyDated.length > 1000, `dates must parse, got ${BUCKETS.fullyDated.length} fully dated`);
  // Without this, every row below could be a statement about an empty set.
  assert.ok(RESIDUE.length > 0, "a residue exists; otherwise this file reports on nothing");
});

test("R-E2 THE PARTITION: six buckets, pairwise disjoint, covering the population exactly", () => {
  const names = Object.keys(BUCKETS);
  const sum = names.reduce((n, k) => n + BUCKETS[k].length, 0);
  // The sum alone is not enough: it balances just as well when one record is
  // counted twice and another is dropped. Assert the SET, then the sum.
  const union = new Set(names.flatMap((k) => BUCKETS[k]));
  assert.equal(union.size, POP, `the buckets must cover every one of ${POP} records, covered ${union.size}`);
  assert.equal(sum, POP, `the buckets must sum to ${POP}, summed ${sum}`);
  assert.equal(sum, union.size, "sum equals set size, so no record is in two buckets");
  for (const a of names)
    for (const b of names) {
      if (a === b) continue;
      const other = new Set(BUCKETS[b]);
      const both = BUCKETS[a].filter((id) => other.has(id));
      assert.equal(both.length, 0, `${a} and ${b} overlap on ${both.slice(0, 3).join(", ")}`);
    }
  // the empty bucket is DECLARED, not omitted — an omitted bucket is exactly
  // how a sum silently stops summing, and dropping this line is caught here.
  assert.ok(names.includes("neitherParses"), "the empty bucket is declared");
  // NOTHING ELSE. Every assertion in this row is an identity across a total
  // partition, so no corpus datum can move one: this row guards the INSTRUMENT
  // and cannot see a corpus defect. It used to pin neitherParses.length === 0,
  // which was the file's only pinned corpus count, fell on a realistic record
  // ("–Deceased", the intersection of two shapes the corpus already carries),
  // and failed with a bare 1 !== 0 — no id, no shape, nothing to grep. That
  // detector now lives in R-E4 where the allow-list can name what it found.
});

test("R-E3 the residue is INVISIBLE to every denominator the chronology reporter uses", () => {
  const res = new Set(RESIDUE);
  let birthYears = 0, bothYears = 0, resInBirth = 0, resInBoth = 0;
  for (const [id, p] of Object.entries(P)) {
    const b = birth(p), d = death(p);
    if (b !== null) { birthYears++; if (res.has(id)) resInBirth++; }
    if (b !== null && d !== null) { bothYears++; if (res.has(id)) resInBoth++; }
  }
  let cDenom = 0, contaminated = 0;
  for (const [child, parents] of Object.entries(E)) {
    if (birth(P[child]) === null) continue;
    for (const pid of parents) {
      if (!P[pid] || birth(P[pid]) === null) continue;
      cDenom++;
      if (res.has(child) || res.has(pid)) contaminated++;
    }
  }
  // THE FINDING, as an assertion rather than prose: these records contribute
  // nothing to A's denominator, nothing to B's, and no slot to C's.
  assert.equal(resInBirth, 0, "no residue record is inside the birth-year denominator");
  assert.equal(resInBoth, 0, "no residue record is inside the full-span denominator");
  assert.equal(contaminated, 0, "no edge slot in C's denominator involves a residue record");
  // and the denominators are real, so the three zeros above are not vacuous
  assert.ok(birthYears > 1000 && bothYears > 1000 && cDenom > 1000,
    `denominators must be non-trivial, got ${birthYears}/${bothYears}/${cDenom}`);
  assert.equal(birthYears + RESIDUE.length, POP,
    `birth-parseable ${birthYears} + residue ${RESIDUE.length} must be the population ${POP}`);
});

test("R-E4 every unparseable SHAPE, in EITHER unparseable bucket, is sanctioned or already reviewed — a new one fails here naming it", () => {
  assert.ok(shapeCensus.size > 0, "the shape census is non-empty");
  assert.ok([...shapeCensus.keys()].some((s) => SANCTIONED.has(s)),
    "the sanctioned placeholder is present, so the allow-list is not dead weight");
  // A SUBSET check, not an equality: a repair removes a reviewed shape and this
  // row stays green, while an unreviewed shape fails it by name. Pinning the
  // count instead would go red the day the U+FFFD record is repaired.
  assert.deepEqual(unreviewed, [],
    `unreviewed unparseable lifespan shape(s) in notTwoParts: ${unreviewed.map((s) => JSON.stringify(s)).join(", ")} — review the record, then add the shape here or repair it`);
  // THE SIXTH BUCKET, on the same allow-list. It is empty today, so this arm
  // cannot get its non-vacuity from the corpus — R-E5 proves unreviewedIn can
  // return a non-empty list on a fixture instead. A criterion that needs the
  // corpus to stay dirty is a criterion that cannot stay passing.
  assert.deepEqual(unreviewedPairShapes, [],
    `unreviewed two-part lifespan shape(s) whose halves are both unreadable: ${unreviewedPairShapes.map((s) => JSON.stringify(s)).join(", ")} — review the record, then add the shape here or repair it`);
  for (const id of [...BUCKETS.notTwoParts, ...BUCKETS.neitherParses]) assert.ok(P[id], `${id} is a real record`);
});

test("R-E5 the shape classifier can return BOTH answers — on fixtures, not on the corpus", () => {
  // Non-vacuity that does NOT require the corpus to stay dirty. If R-E4's
  // non-vacuity came from "an unreviewed shape exists", the row would fail the
  // day the corpus became clean, which is the mirror of a criterion that
  // cannot fail.
  assert.equal(classify("Deceased"), "sanctioned", "the placeholder classifies as sanctioned");
  assert.equal(classify(FFFD_ENDASH), "reviewed", "the U+FFFD record classifies as reviewed");
  const planted = "sometime in the reign of ��";  // minted here, absent from the corpus
  assert.equal(classify(planted), "UNREVIEWED", "an unknown shape classifies as UNREVIEWED");
  assert.ok(![...shapeCensus.keys()].includes(planted), "the planted fixture is not a real corpus shape");
  // NON-VACUITY FOR R-E4'S SIXTH-BUCKET ARM. pairCensus is empty today, so
  // assert.deepEqual(unreviewedPairShapes, []) would pass on an empty set no
  // matter what unreviewedIn did. Exercise the same function on a fixture
  // census built from "–Deceased" — the exact realistic plant that broke the
  // old pinned count — and require it to return that shape and not "Deceased".
  const fixtureCensus = new Map([["–Deceased", 1], ["Deceased", 3], [FFFD_ENDASH, 1]]);
  assert.deepEqual(unreviewedIn(fixtureCensus), ["–Deceased"],
    "unreviewedIn returns the unknown shape, skips the sanctioned and the reviewed — the sixth-bucket arm can fail");
  // and NOT assert.equal(pairCensus.size, 0): that is the pinned corpus count
  // this commit removes, moved one row down. The fixture above is the guard.
});

test("R-E6 the report: residue by shape, with the sum that makes it checkable", () => {
  const render = (census) => census.size === 0 ? "(none)" : [...census.entries()].sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${n}x ${JSON.stringify(s)} [${classify(s)}]`).join(" · ");
  const byShape = render(shapeCensus);
  const byPairShape = render(pairCensus);
  console.log(
    `date residue report: population ${POP} = fullyDated ${BUCKETS.fullyDated.length} + ` +
    `birthOnly ${BUCKETS.birthOnly.length} + deathOnly ${BUCKETS.deathOnly.length} + ` +
    `notTwoParts ${BUCKETS.notTwoParts.length} + noLifespan ${BUCKETS.noLifespan.length} + ` +
    `neitherParses ${BUCKETS.neitherParses.length}. ` +
    `RESIDUE ${RESIDUE.length} records are judged by NO chronological class. ` +
    `Shapes in notTwoParts: ${byShape}. ` +
    `Shapes in neitherParses (two halves, neither readable): ${byPairShape}. ` +
    `A death-only lifespan is valid data, not a defect; an UNREVIEWED shape is a defect.`,
  );
  assert.ok(RESIDUE.length < POP, "the residue is a minority of the corpus, not the whole of it");
});
