// ── sources-sync.test.mjs — the post-freeze transcription sync layer ────────
// Synthetic, runtime-constructed fixtures ONLY (the fixture-refinement law):
// no real family data enters CI. Exercises: payload building (repair
// suppression), cohort sync-debt diffing against the frozen index, ledger
// provenance, ark matching across id/about/url forms, the extramural
// allowlist + redacted-stub privacy guards, living-name redaction through
// fs-adapter's publicSourceRecord, and the fail-closed redact-list law.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayload, buildSync, validateRedactInput,
  DECEASED_EXTRAMURAL_SYNC, WALKED_PIDS,
} from "./sources-sync.mjs";

const syntheticIndex = {
  schema: "skaists.sources/1",
  generated: "2026-09-18T00:00:00Z",
  uniqueRecords: 13249,
  persons: [
    { iid: "pSYN1", depth: 6, name: "Syn Cohort One", lifespan: "1810–1880", fsid: "LJDG-CYG", providerSourceCount: 3,
      sources: [{ id: "OLD1-AAA" }, { id: "OLD2-BBB" }, { id: "OLD3-CCC" }] },
    { iid: "pSYN2", depth: 7, name: "Syn Cohort Two", lifespan: "1780–1840", fsid: "GWXR-H2K", providerSourceCount: 1,
      sources: [{ id: "OLD4-DDD" }] },
    { iid: "pSYN3", depth: 8, name: "Syn Cohort Three", lifespan: "1750–1810", fsid: "SYN0-000", providerSourceCount: 0, sources: [] },
  ],
};

const syntheticLedger = {
  records: [
    { ark: "MCL8-D19", dispatch: "2026-10-10-fs-authed-wake-labor", attachedTo: ["LJDG-CYG"] },
    { ark: "6D9D-2ZCT", dispatch: "2026-10-10-fs-authed-wake-labor", attachedTo: ["GWXR-H2K"] },
    { ark: "QG8Q-V3C5", dispatch: "2026-10-10-fs-authed-wake-labor", attachedTo: ["LZDH-WYF", "MHRT-169"] },
  ],
};

// walker-dump shape: persons (v8 summaries), refs (entityref), src (links/sources)
const mkDump = (overrides = {}) => ({
  persons: {
    "LJDG-CYG": { id: "LJDG-CYG", name: "Syn Cohort One", living: false, sourceCount: 4 },
    "GWXR-H2K": { id: "GWXR-H2K", name: "Syn Cohort Two", living: false, sourceCount: 2 },
    "LZDH-WYF": { id: "LZDH-WYF", name: "Maren Nielsdatter", living: false, sourceCount: 12 },
    "MHRT-169": { id: "MHRT-169", name: "Christen Olsen", living: false, sourceCount: 9 },
    ...overrides.persons,
  },
  refs: {
    "LJDG-CYG": { sources: [{ id: "OLD1-AAA" }, { id: "OLD2-BBB" }, { id: "OLD3-CCC" }, { id: "MCL8-D19" }], refsTotal: 4 },
    "GWXR-H2K": { sources: [{ id: "OLD4-DDD" }, { id: "NEWX-ZZ9" }], refsTotal: 2 },
    "LZDH-WYF": { sources: [{ id: "QG8Q-V3C5" }, { id: "S1-AAA" }, { id: "S2-BBB" }], refsTotal: 3 },
    "MHRT-169": { sources: [{ id: "QG8Q-V3C5" }, { id: "S3-CCC" }], refsTotal: 2 },
    ...overrides.refs,
  },
  src: {
    "MCL8-D19": { id: "MCL8-D19", title: "Syn Census 1860", citation: "\"Syn Census, 1860\" (household of Syn Cohort One)",
      urls: [{ url: "https://www.familysearch.org/ark:/61903/1:1:MCL8-D19" }], about: "ark:/61903/1:1:MCL8-D19",
      evidence: [], notes: ["private note stays private"], retrieved: "2026-10-12", provider: "familysearch" },
    "NEWX-ZZ9": { id: "NEWX-ZZ9", title: "Syn Attributed Later", citation: "\"Syn Record\" mentioning Living Name",
      urls: [], about: null, evidence: [], notes: [], retrieved: "2026-10-12", provider: "familysearch" },
    "QG8Q-V3C5": { id: "QG8Q-V3C5", title: "Syn Church Record 1811", citation: "\"Syn Church Records\" (birth 1811)",
      urls: [{ url: "https://www.familysearch.org/ark:/61903/1:1:QG8Q-V3C5" }], about: "ark:/61903/1:1:QG8Q-V3C5",
      evidence: [], notes: [], retrieved: "2026-10-12", provider: "familysearch" },
    ...overrides.src,
  },
});

const REDACT = ["Living Name"];

test("buildPayload: walked set present, cohort depths real, extramural at 9 (repair suppressed by the depth gate)", () => {
  const p = buildPayload(syntheticIndex);
  const by = new Map(p.cohort.map((c) => [c.pid, c.dep]));
  assert.equal(by.get("LJDG-CYG"), 6, "cohort depth comes from the frozen index");
  assert.equal(by.get("GWXR-H2K"), 7);
  for (const pid of ["LZDH-WYF", "MHRT-169", "MLCS-MN5"]) {
    assert.equal(by.get(pid), 9, `${pid} walks at dep 9 so parent-repair is suppressed`);
  }
  assert.equal(p.danglers.length, 0);
  assert.ok(p.known.includes("SYN0-000"), "all frozen fsids are passed as known");
  assert.equal(p.cohort.length, WALKED_PIDS.length);
});

test("cohort sync debt: fresh id outside the frozen baseline is transcribed with ledger provenance", () => {
  const art = buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  const p = art.persons["LJDG-CYG"];
  assert.equal(p.tier, "cohort");
  assert.deepEqual(p.providerSourceCount, { freeze: 3, now: 4 });
  const mcl = p.newSources.find((s) => s.ark === "MCL8-D19");
  assert.equal(mcl.status, "attached");
  assert.equal(mcl.dispatch, "2026-10-10-fs-authed-wake-labor");
  assert.match(mcl.citation, /Syn Census, 1860/);
  assert.equal(mcl.notes, undefined, "public projection drops notes");
  assert.equal(art.reconciliation.cohortSyncDebt["LJDG-CYG"], 1);
});

test("cohort unattributed delta: an ark the ledger does not know is named honestly, never dropped", () => {
  const art = buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  const p = art.persons["GWXR-H2K"];
  const un = p.newSources.find((s) => s.id === "NEWX-ZZ9");
  assert.ok(un, "unattributed delta transcribed");
  assert.match(un.dispatch, /unattributed/);
  assert.equal(art.reconciliation.unattributedDelta, 1);
});

test("ark matching: 4-4 record arks match through about/urls when the id differs", () => {
  const dump = mkDump();
  // entityref id is a 4-3 tree-source id; the ledger ark appears only in about/urls
  dump.refs["GWXR-H2K"].sources = [{ id: "OLD4-DDD" }, { id: "TRE1-EEE" }];
  dump.src["TRE1-EEE"] = { id: "TRE1-EEE", title: "Somerset church record", citation: "\"Somestead, Somerset\"",
    urls: [{ url: "https://www.familysearch.org/ark:/61903/1:1:6D9D-2ZCT" }], about: "ark:/61903/1:1:6D9D-2ZCT",
    evidence: [], notes: [], retrieved: "2026-10-12", provider: "familysearch" };
  const art = buildSync({ dump, index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  const p = art.persons["GWXR-H2K"];
  const som = p.newSources.find((s) => s.ark === "6D9D-2ZCT");
  assert.ok(som, "ledger ark matched via about/urls");
  assert.equal(som.status, "attached");
  // and it must NOT double-count as an unattributed delta (this scenario
  // replaced NEWX-ZZ9 with the ark-matched TRE1-EEE row)
  assert.equal(art.reconciliation.unattributedDelta, 0, "the matched ledger row is the only delta on GWXR-H2K");
});

test("extramural allowlisted: only ledger-proven attaches transcribed; standing sources counted, never mixed in", () => {
  const art = buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  const p = art.persons["LZDH-WYF"];
  assert.equal(p.tier, "extramural");
  assert.equal(p.name, DECEASED_EXTRAMURAL_SYNC["LZDH-WYF"].name);
  assert.equal(p.newSources.length, 1, "QG8Q-V3C5 only");
  assert.equal(p.standingNotTranscribed, 2, "S1/S2 counted not transcribed");
  assert.equal(art.reconciliation.unattributedDelta, 1, "extramural never contributes unattributed deltas");
});

test("extramural NOT on the allowlist: redacted stub, fsid withheld even as the map key", () => {
  const dump = mkDump();
  dump.persons["ZZZZ-ZZZ"] = { id: "ZZZZ-ZZZ", name: "Syn Stranger", living: false, sourceCount: 2 };
  dump.refs["ZZZZ-ZZZ"] = { sources: [{ id: "A1-BBB" }, { id: "A2-CCC" }], refsTotal: 2 };
  const art = buildSync({ dump, index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT, walkedPids: [...WALKED_PIDS, "ZZZZ-ZZZ"] });
  const key = Object.keys(art.persons).find((k) => k.startsWith("[redacted-extramural-"));
  assert.ok(key, "stub present under a redacted key");
  assert.ok(!Object.keys(art.persons).includes("ZZZZ-ZZZ"), "fsid never appears as a key");
  assert.equal(art.persons[key].sourcesAttached, 2);
  assert.equal(art.reconciliation.redactedStubs, 1);
});

test("living flag on a walked record: withheld even when allowlisted", () => {
  const dump = mkDump({ persons: { "MLCS-M2Q": { id: "MLCS-M2Q", name: "Oline Christensen", living: true, sourceCount: 2 } },
    refs: { "MLCS-M2Q": { sources: [{ id: "B1-BBB" }, { id: "B2-CCC" }], refsTotal: 2 } } });
  const art = buildSync({ dump, index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  assert.ok(!Object.keys(art.persons).includes("MLCS-M2Q"), "living pid withheld as a key");
  const stub = Object.values(art.persons).find((p) => p.status === "redacted");
  assert.match(stub.reason, /living flag/);
});

test("living-name redaction flows through the public projection", () => {
  const art = buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  const p = art.persons["GWXR-H2K"];
  const un = p.newSources.find((s) => s.id === "NEWX-ZZ9");
  assert.match(un.citation, /\[redacted-living\]/);
  assert.equal(un.redactedLiving, true);
});

test("fail-closed: no redact list, no build", () => {
  assert.throws(() => buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "x" }),
    /redactNames required/);
  assert.equal(validateRedactInput("").ok, false);
  assert.equal(validateRedactInput("# comment only\n").ok, false);
  const v = validateRedactInput("# names\nLiving Name\n");
  assert.deepEqual(v, { ok: true, names: ["Living Name"] });
});

test("missing-from-dump pid is named, never silently skipped", () => {
  const dump = mkDump();
  delete dump.persons["MLCS-MKV"];
  const art = buildSync({ dump, index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  assert.equal(art.persons["MLCS-MKV"].tier, "missing");
});

test("frozen manifest provenance rides the artifact header", () => {
  const art = buildSync({ dump: mkDump(), index: syntheticIndex, ledger: syntheticLedger, generated: "2026-10-12T00:00Z", redactNames: REDACT });
  assert.equal(art.schema, "skaists.sources-sync/1");
  assert.equal(art.provenance.freeze.uniqueRecords, 13249);
  assert.match(art.provenance.method, /PAGE_SOURCE_WALKER/);
});
