// ── sources.test.mjs — the 8-generation source-harvest layer ────────────────
// Synthetic, runtime-constructed fixtures ONLY (the fixture-refinement law):
// no real family data enters CI. Exercises the fs-adapter source half:
// parseEntityRefs, parseSourceDescriptions, publicSourceRecord redaction,
// and importSourceWalk's support-axis upgrade law.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntityRefs, parseSourceDescriptions, publicSourceRecord, importSourceWalk } from "./fs-adapter.mjs";
import { createModel, addPerson } from "./model.mjs";

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
