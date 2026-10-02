// ── sources.test.mjs — the 8-generation source-harvest layer ────────────────
// Synthetic, runtime-constructed fixtures ONLY (the fixture-refinement law):
// no real family data enters CI. Exercises the fs-adapter source half:
// parseEntityRefs, parseSourceDescriptions, publicSourceRecord redaction,
// and importSourceWalk's support-axis upgrade law.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntityRefs, parseSourceDescriptions, publicSourceRecord, importSourceWalk, harvestRecord, researchBasis } from "./fs-adapter.mjs";
import { createModel, addPerson, applyCorrection } from "./model.mjs";

const FSID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;
const fakePid = (tag) => {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const A = "ABCDEFGHJKLMNPRSTVWXY0123456789";
  const pick = (n, salt) => String(h + salt * 7919 % 1679616).padStart(4, "0")
    .split("").map((d) => A[+d % A.length]).join("");
  return `${pick(4, 1)}-${pick(3, 2)}`;
};

// runtime-constructed tf entityref response
const mkEntityRefs = (nSources, extras = []) => ({
  entityRefs: [
    ...Array.from({ length: nSources }, (_, i) => ({
      value: { type: "SOURCE", uri: fakePid("src" + i) },
      attribution: { modified: "170000000000" + i, contributorCisId: "cis.user.SYNTH" + i, changeMessage: "synthetic " + i },
      affectedConclusionTypes: ["http://gedcomx.org/Birth", "http://gedcomx.org/Name"],
      originallyAttachedTo: null,
    })),
    ...extras,
  ],
});

// runtime-constructed links/sources response
const mkSourceDescriptions = (records) => ({ sources: records });

test("parseEntityRefs extracts SOURCE refs with attribution and affected conclusions", () => {
  const dup = { value: { type: "DUPLICATE" }, attribution: {} };
  const parsed = parseEntityRefs(mkEntityRefs(3, [dup, dup]));
  assert.equal(parsed.refsTotal, 5);
  assert.equal(parsed.sources.length, 3);
  assert.equal(parsed.typeCounts.SOURCE, 3);
  assert.equal(parsed.typeCounts.DUPLICATE, 2);
  for (const s of parsed.sources) {
    assert.ok(FSID.test(s.id) || s.id.length > 0);
    assert.deepEqual(s.affected, ["Birth", "Name"]);
    assert.equal(s.contributor.startsWith("cis.user.SYNTH"), true);
    assert.ok(s.changeMessage.startsWith("synthetic"));
  }
});

test("parseEntityRefs tolerates empty/absent payloads honestly", () => {
  assert.deepEqual(parseEntityRefs({}), { sources: [], typeCounts: {}, refsTotal: 0 });
  assert.deepEqual(parseEntityRefs(null), { sources: [], typeCounts: {}, refsTotal: 0 });
  assert.deepEqual(parseEntityRefs({ entityRefs: [] }), { sources: [], typeCounts: {}, refsTotal: 0 });
});

test("parseSourceDescriptions keeps citation, urls, event, evidence facts, retrieval date", () => {
  const ark = "https://www.familysearch.org/ark:/61903/1:1:SYN-THET";
  const recs = parseSourceDescriptions(mkSourceDescriptions([{
    id: fakePid("rec1"),
    title: "Synthetic Census",
    citation: "\"Synthetic Census\", FamilySearch (" + ark + "), Entry for A Deceased Person.",
    urls: [{ url: ark, requiresLogin: false }, { url: "https://www.familysearch.org/x", requiresLogin: true }],
    event: { factType: "OTHER", eventPlace: "Synthetic, Place" },
    evidence: { facts: [{ factType: "Name", fieldType: "I0", value: "A Deceased Person" }] },
    notes: ["a private note"],
    about: "synthetic about",
  }]));
  assert.equal(recs.length, 1);
  assert.equal(recs[0].citation.includes(ark), true);
  assert.equal(recs[0].urls.length, 2);
  assert.equal(recs[0].evidence.length, 1);
  assert.equal(recs[0].retrieved, new Date().toISOString().slice(0, 10));
  assert.equal(recs[0].provider, "familysearch");
});

test("publicSourceRecord redacts living names in citation/title/facts and says so", () => {
  const livingName = "Zyx" + "Qvu" + "Livingperson"; // constructed, never a real name
  const rec = {
    id: fakePid("rec2"),
    title: "Record mentioning " + livingName,
    citation: "Entry for " + livingName + " and A Deceased Person.",
    urls: [{ url: "https://www.familysearch.org/ark:/61903/1:1:SYN-TWO", requiresLogin: false }],
    event: null,
    evidence: [{ factType: "Name", fieldType: "I1", value: livingName }],
    retrieved: "2026-09-18",
    provider: "familysearch",
  };
  const pub = publicSourceRecord(rec, { redactNames: [livingName] });
  assert.equal(pub.redactedLiving, true);
  assert.equal(pub.citation.includes(livingName), false);
  assert.equal(pub.title.includes(livingName), false);
  assert.equal(pub.evidence[0].value, "[redacted-living]");
  // non-matching names pass untouched
  const clean = publicSourceRecord(rec, { redactNames: ["Someone Else Entirely"] });
  assert.equal(clean.redactedLiving, false);
  assert.equal(clean.citation.includes(livingName), true);
});

test("publicSourceRecord drops login-gated urls from the public layer", () => {
  const pub = publicSourceRecord({
    id: "AAAA-BBB", title: "t", citation: "c", urls: [
      { url: "https://www.familysearch.org/ark:/61903/1:1:SYN-THR", requiresLogin: false },
      { url: "https://www.familysearch.org/private", requiresLogin: true },
    ], event: null, evidence: [], retrieved: "2026-09-18", provider: "familysearch",
  }, {});
  assert.deepEqual(pub.urls, ["https://www.familysearch.org/ark:/61903/1:1:SYN-THR"]);
});

test("importSourceWalk upgrades unsourced→sourced, never downgrades attested, basis recorded", () => {
  const model = createModel({ root: fakePid("root") });
  const pUn = fakePid("unsourced");
  const pAt = fakePid("attested");
  const pNoSrc = fakePid("nosources");
  addPerson(model, { id: pUn, name: "U", lifespan: "1800–1850", source: "familysearch", sourceId: pUn });
  addPerson(model, { id: pAt, name: "A", lifespan: "1800–1850", source: "familysearch", sourceId: pAt,
    evidence: { era: "recorded", support: "attested", basis: "founder word" } });
  addPerson(model, { id: pNoSrc, name: "N", lifespan: "1800–1850", source: "familysearch", sourceId: pNoSrc });
  const raw = { refs: {
    [pUn]: { sources: [{ id: fakePid("s1") }, { id: fakePid("s2") }] },
    [pAt]: { sources: [{ id: fakePid("s3") }] },
    [pNoSrc]: { sources: [] },
  } };
  const { upgraded } = importSourceWalk(model, raw, { date: "2026-09-18" });
  assert.equal(upgraded, 1);
  assert.equal(model.persons[pUn].evidence.support, "sourced");
  assert.match(model.persons[pUn].evidence.basis, /2 FamilySearch sources \(harvested 2026-09-18\)/);
  assert.equal(model.persons[pAt].evidence.support, "attested"); // never downgraded
  assert.match(model.persons[pAt].evidence.basis, /founder word; 1 FamilySearch source/);
  assert.equal(model.persons[pNoSrc].evidence.support, "unsourced-entry"); // no sources → no upgrade, honest default stands
});

test("harvestRecord reads only the record importSourceWalk writes — a correction's cited-source ARRAY is not one", () => {
  const model = createModel({ root: fakePid("root") });
  const pH = fakePid("harvested");
  const pC = fakePid("corrected");
  addPerson(model, { id: pH, name: "H", lifespan: "1800–1850", source: "familysearch", sourceId: pH });
  addPerson(model, { id: pC, name: "C", lifespan: "1900–1990", source: "familysearch", sourceId: pC });
  /* the correction layer applies first: the documents it cites land in `cited` */
  model.persons[pC] = applyCorrection(model.persons[pC], { patch: { cited: [{ title: "an obituary", read: "2026-09-22" }] } });
  const raw = { refs: {
    [pH]: { sources: [{ id: fakePid("s1") }, { id: fakePid("s2") }, { id: fakePid("s3") }] },
    [pC]: { sources: [] }, /* nothing attached on the provider: the harvest leaves pC alone */
  } };
  importSourceWalk(model, raw, { date: "2026-09-18" });

  /* PRECONDITION: pC really carries cited documents and no harvest record. */
  assert.ok(Array.isArray(model.persons[pC].cited) && model.persons[pC].cited.length === 1);
  assert.equal(model.persons[pC].sources, undefined);

  assert.deepEqual(harvestRecord(model.persons[pH]), { count: 3, harvested: "2026-09-18", provider: "familysearch" });
  assert.equal(researchBasis(model.persons[pH]), "3 attached FamilySearch sources (harvested 2026-09-18)");

  assert.equal(harvestRecord(model.persons[pC]), null);
  const basis = researchBasis(model.persons[pC]);
  assert.doesNotMatch(basis, /undefined/, "a missing count was templated into the sentence");
  assert.doesNotMatch(basis, /\battached FamilySearch source/, "the sentence claims a FamilySearch count nobody recorded");
  assert.equal(basis, "no FamilySearch harvest count recorded; 1 source cited on this record");

  /* no sources of any kind: the standing default */
  assert.equal(researchBasis({}), "no attached sources harvested for this person; era-heuristic only");
});

test("harvestRecord refuses a half-formed record by shape, not by truthiness", () => {
  for (const bad of [{}, { count: "3", harvested: "2026-09-18" }, { count: 3 }, { count: 3, harvested: null }, []]) {
    assert.equal(harvestRecord({ sources: bad }), null, `accepted ${JSON.stringify(bad)}`);
  }
  /* control: the well-formed record is accepted, singular form included */
  assert.equal(researchBasis({ sources: { count: 1, harvested: "2026-09-18" } }), "1 attached FamilySearch source (harvested 2026-09-18)");
});

/* The pipeline applies corrections FIRST and the harvest AFTER (pipeline.mjs).
 * When `sources` carried both meanings, a harvest that found anything for a
 * corrected person replaced the correction's cited-document array with the
 * harvest record, and the cited documents left the person entirely. */
test("a corrected person with cited documents gets a harvest and keeps both", () => {
  const model = createModel({ root: fakePid("root") });
  const pC = fakePid("corrected-and-harvested");
  addPerson(model, { id: pC, name: "C", lifespan: "1931–2025", source: "familysearch", sourceId: pC });
  const doc = { title: "an obituary", url: "https://example.invalid/obit", supports: ["death 2025"] };
  model.persons[pC] = applyCorrection(model.persons[pC], { patch: { living: false, cited: [doc] }, attested: "founder" });
  importSourceWalk(model, { refs: { [pC]: { sources: [{ id: fakePid("s1") }, { id: fakePid("s2") }] } } }, { date: "2026-09-29" });

  /* PRECONDITION: the harvest really ran for this person, so it had the chance to overwrite */
  assert.equal(model.persons[pC].evidence.basis.includes("2 FamilySearch sources (harvested 2026-09-29)"), true);
  assert.deepEqual(model.persons[pC].cited, [doc], "the correction's cited documents were lost to the harvest");
  assert.deepEqual(harvestRecord(model.persons[pC]), { count: 2, harvested: "2026-09-29", provider: "familysearch" });
  assert.equal(researchBasis(model.persons[pC]), "2 attached FamilySearch sources (harvested 2026-09-29)");
});

test("applyCorrection refuses a patch that writes `sources`, by name, whatever its shape", () => {
  const base = { name: "P", lifespan: "1931–2025", living: true, evidence: { era: "living", class: "living", support: "unsourced-entry", basis: "b" } };
  for (const sources of [[{ title: "an obituary" }], [], { count: 1, harvested: "2026-09-18" }, null, undefined]) {
    let err = null;
    try { applyCorrection(base, { patch: { living: false, sources } }); } catch (e) { err = e; }
    assert.ok(err, `accepted a patch writing sources=${JSON.stringify(sources)}`);
    assert.ok(err instanceof Error && !(err instanceof TypeError), `crashed instead of refusing: ${err}`);
    assert.match(err.message, /may not write `sources`/);
    assert.match(err.message, /`cited`/);
  }
  /* control: the same patch without `sources` applies, and the era is recomputed */
  const fixed = applyCorrection(base, { patch: { living: false, cited: [] }, attested: "founder", note: "n" });
  assert.equal(fixed.living, false);
  assert.equal(fixed.evidence.era, "recorded");
  assert.deepEqual(fixed.corrected, { attested: "founder", note: "n" });
  assert.equal(base.living, true, "the walked person was mutated in place");
});
