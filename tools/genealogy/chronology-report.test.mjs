// Chronological consistency REPORTER for the published corpus.
//
// It reports. It repairs nothing, and it must never become a repair list —
// precedent is the cycle row, which reports and does not green itself by
// editing the corpus.
//
// THREE LISTS, THREE EPISTEMIC KINDS. They are separated because a reader who
// sees one number treats every row in it the same way, and these do not
// deserve the same treatment:
//
//   A  death before birth      CONTRADICTION, localises to ONE RECORD
//   C  child born before parent CONTRADICTION, localises to a PAIR
//   B  lifespan over a threshold HEURISTIC, localises to NOTHING
//
// A is the strongest class in the scan: a record that contradicts itself needs
// no external witness, and consistency is checkable where a genealogy claim is
// not. C is equally provable but says only that the edge or one of the two
// dates is wrong — never which. B is a chosen number: the oldest verified human
// reached 122, so these rows are improbable, not impossible.
//
// DENOMINATORS BELONG TO THE QUESTION, NOT TO THE PARSER. A birth-order
// violation is judged on BIRTH years; requiring a death year as well discards
// thousands of judgeable edges and the violations inside them. R4 asserts that
// difference rather than describing it.
//
// C IS CONTAMINATED UNTIL THE DATE CLASS IS REPAIRED. Some rows are a BC-marker
// encoding defect, not a genealogy defect: the child keeps its BC suffix and the
// parent loses it, so a real ancestor reads as centuries younger. Those edges
// can be correct — one of them is supported by named Egyptologists. R5 breaks
// them out so no repair pass can run off the C total while the date bug is open.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LINEAGE = new URL("../../assets/profile-archive/lineage/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const model = JSON.parse(readFileSync(LINEAGE + "remington-bloodline.json", "utf8"));
const P = model.persons, E = model.edges;

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
const birthTok = (p) => { const a = halves(p); return a ? a[0].trim() : ""; };

// ── the three lists, each with the denominator its own question needs
const classA = [];                 // one record contradicts itself
const classB = [];                 // heuristic threshold
const B_THRESHOLD_YEARS = 110;     // a CHOSEN number, not a law
let bothYears = 0, birthYears = 0, bcMarked = 0;
for (const [id, p] of Object.entries(P)) {
  const b = birth(p), d = death(p);
  if (b !== null) birthYears++;
  if (b !== null && d !== null) {
    bothYears++;
    if (d < b) classA.push({ id, name: p.name, lifespan: p.lifespan });
    if (d - b > B_THRESHOLD_YEARS) classB.push({ id, name: p.name, years: d - b });
  }
  if (typeof p.lifespan === "string" && /BC/i.test(p.lifespan)) bcMarked++;
}

const classC = [];
let cDenomBirth = 0, cDenomFullSpan = 0;
const classCFullSpanOnly = [];
for (const [child, parents] of Object.entries(E)) {
  const cb = birth(P[child]);
  if (cb === null) continue;
  for (const pid of parents) {
    const pb = birth(P[pid]);
    if (pb === null) continue;
    cDenomBirth++;
    const spanned = death(P[child]) !== null && death(P[pid]) !== null;
    if (spanned) cDenomFullSpan++;
    if (cb < pb) {
      const row = { child, parent: pid, childTok: birthTok(P[child]), parentTok: birthTok(P[pid]), gap: pb - cb };
      classC.push(row);
      if (spanned) classCFullSpanOnly.push(row);
    }
  }
}
const signFlip = classC.filter((r) => isBC(r.childTok) && !isBC(r.parentTok));
const bothBC = classC.filter((r) => isBC(r.childTok) && isBC(r.parentTok));
const bothAD = classC.filter((r) => !isBC(r.childTok) && !isBC(r.parentTok));

test("R1 non-vacuity: the parser parses, and BOTH date encodings exist in the corpus", () => {
  assert.ok(Object.keys(P).length > 1000, "the real corpus is loaded");
  assert.ok(birthYears > 1000, `birth years must parse, got ${birthYears}`);
  assert.ok(bothYears > 1000, `full spans must parse, got ${bothYears}`);
  // The control. Without it, "N sign flips" could be an artifact of a parser
  // that never sees a BC marker at all, which would report every BC record as
  // a positive year and manufacture the class it claims to find.
  assert.ok(bcMarked > 100, `records carrying an explicit BC marker must exist, got ${bcMarked}`);
});

test("R2 class A — death before birth: a CONTRADICTION localised to ONE record", () => {
  // Pinned on purpose, the way the cycle row is pinned: a repair turns this red
  // and the row gets re-ruled then. Do not edit the number to make it green.
  assert.equal(classA.length, 26, "class A count");
  for (const r of classA) {
    assert.ok(P[r.id], "every row names a real record");
    const b = birth(P[r.id]), d = death(P[r.id]);
    assert.ok(d < b, `${r.id} death ${d} precedes birth ${b}`);
  }
  // The localisation claim, asserted rather than described: A rows need no
  // second party, which is what makes them the strongest rows in the scan.
  assert.ok(classA.every((r) => typeof r.id === "string" && !("parent" in r)), "class A rows name exactly one record");
});

test("R3 class B — a HEURISTIC threshold, and it must not read as a defect list", () => {
  assert.equal(classB.length, 175, "class B count at the chosen threshold");
  assert.equal(B_THRESHOLD_YEARS, 110, "the threshold is a named chosen constant, not a law");
  // improbable is not impossible: the discriminating assertion is that B is NOT
  // a subset of the provable class. If every B row were also an A row, B would
  // be redundant; it is not, so B carries rows nothing proves defective.
  const aIds = new Set(classA.map((r) => r.id));
  const notProven = classB.filter((r) => !aIds.has(r.id));
  assert.ok(notProven.length > 0, "class B contains rows that no contradiction proves defective");
});

test("R4 class C — judged on BIRTH years, because that is what the question needs", () => {
  assert.equal(classC.length, 277, "class C count on the birth-year denominator");
  assert.equal(cDenomBirth, 9504, "edges judgeable on birth years alone");
  // THE FILTER LAW, as an assertion. Requiring a death year at both ends is a
  // filter chosen by what parses rather than by what a birth-order question
  // asks, and it silently discards judgeable edges AND the violations in them.
  assert.ok(cDenomBirth > cDenomFullSpan, "the birth-year denominator is strictly larger");
  assert.ok(
    classC.length > classCFullSpanOnly.length,
    `a full-span filter hides ${classC.length - classCFullSpanOnly.length} real violations`,
  );
  for (const r of classC) assert.ok(P[r.child] && P[r.parent], "every row names two real records");
});

test("R5 class C is CONTAMINATED: a BC-marker defect is mixed into it", () => {
  assert.equal(signFlip.length + bothBC.length + bothAD.length, classC.length, "the decomposition is exhaustive");
  assert.equal(signFlip.length, 34, "rows where the child keeps BC and the parent lost it");
  // These are DATE defects wearing an edge defect's clothes. At least one of
  // them is an edge that published scholarship supports, so a repair pass that
  // trusted the class C total would delete a correct relationship.
  for (const r of signFlip) {
    assert.ok(isBC(r.childTok), "child carries BC");
    assert.ok(!isBC(r.parentTok), "parent does not");
  }
  assert.ok(signFlip.length > 0, "the contamination is present and must be reported with the total");
});

test("R6 ordering: the date class outranks the edge class, and the report says so", () => {
  // The guard against the one thing this file could cause: a reader treating C
  // as a delete list. While sign-flip rows exist, no edge may be dropped on
  // class C's authority alone.
  const dateClassOpen = signFlip.length > 0 || classA.length > 0;
  assert.ok(dateClassOpen, "date-class defects are open");
  assert.ok(
    signFlip.length < classC.length,
    "class C is not ENTIRELY a date defect either — both kinds are really present",
  );
  console.log(
    `chronology report: A=${classA.length}/${bothYears} (contradiction, one record) · ` +
    `B=${classB.length}/${bothYears} (heuristic >${B_THRESHOLD_YEARS}y, proves nothing) · ` +
    `C=${classC.length}/${cDenomBirth} (contradiction, one pair) of which ${signFlip.length} are BC-marker defects. ` +
    `Repair the date class before the edge class.`,
  );
});
