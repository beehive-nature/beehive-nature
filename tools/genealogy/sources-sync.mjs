#!/usr/bin/env node
// ── sources-sync: post-freeze attach transcription sync ────────────────────
//   The 2026-09-18 harvest is FROZEN and merged (founder freeze 2026-09-28:
//   no re-scrape). Every record the lane attached AFTER the freeze lives on
//   FamilySearch but not in the frozen public sources layer. This tool rides
//   the proven cookie-session wires (fs-adapter PAGE_SOURCE_WALKER: v8
//   details + tf entityref + batched links/sources?readExternalData=true) over
//   ONLY the touched persons, and folds the result into a NEW public artifact
//   — skaists.sources-sync/1 — without mutating the frozen manifest.
//
//   What counts as a "new" source:
//     cohort persons (the frozen 809): any attached source id present in the
//       fresh entityref walk but absent from the frozen index → the exact
//       sync debt, per person (ledger-matched or honestly "unattributed").
//     extramural persons: no frozen baseline exists, so ONLY ledger-known
//       post-freeze attaches are transcribed; the remaining standing sources
//       are reported as a count, never mixed in with our attaches.
//
//   Privacy law (same shape as hint-census): cohort persons are
//   deceased-by-scope; extramural persons are nameable ONLY via the explicit
//   dispatch-proven deceased allowlist below; anything else (or any walked
//   pid flagged living) is a redacted count stub with the fsid withheld.
//   Full fidelity (notes, contributor cis ids, raw responses) stays in the
//   private tier dump — publicSourceRecord() is the public projection.
//
// Usage:
//   node sources-sync.mjs payload <sources-index.json> <out-payload.json>
//     → emits the PAGE_SOURCE_WALKER payload for this pass (walked set as
//       cohort entries; extramural at dep 9 so parent-repair is suppressed
//       by the walker's own depth gate; `known` = all 809 frozen fsids).
//   node sources-sync.mjs build <dump.json> <ledger.json> <sources-index.json> <out.json> <redact-list.txt>
//     → folds a completed walk dump + the dispatch-derived ledger into the
//       public artifact. The redact list is the PRIVATE tier living-name file
//       (newline-separated, never committed); the build REFUSES to run
//       without it (fail-closed: an absent list must not mean "no names").
//
// Staged 2026-10-12 (order-23 wake, session signed out); execution rides the
// next authed wake per the standing SESSION-ORACLE law.

import { readFileSync, writeFileSync } from "node:fs";
import { publicSourceRecord, parseSourceDescriptions } from "./fs-adapter.mjs";

// dispatch-proven deceased extramural persons (name + basis required — same
// law as hint-census DECEASED_EXTRAMURAL). Marginal cases (1920-census
// children, living-flagged creations, unknown-death spouses) are deliberately
// NOT listed — buildSync redacts them to count stubs; the provider living
// flag overrides this list in either direction.
export const DECEASED_EXTRAMURAL_SYNC = {
  "MHRT-169": { name: "Christen Olsen", lifespan: "1806–1875", basis: "authed-wake dispatch 2026-10-06 (linker-canonical cluster husband)" },
  "LZDH-WYF": { name: "Maren Nielsdatter", lifespan: "1811–1877", basis: "authed-wake dispatch 2026-10-06; death sourced 2026-10-07 (QG83-1487, d. 4 Oct 1877 Bakkendrup)" },
  "MLCS-MN5": { name: "Johanne Marie Christensen", lifespan: "1835–", basis: "authed-wake dispatch 2026-10-06 (confirmation attach)" },
  "MLCS-M2L": { name: "Ane Marie Christensen", lifespan: "1837–", basis: "authed-wake dispatch 2026-10-10 (child-event vein, 19th-century Danish church records)" },
  "MLCS-M2Q": { name: "Oline Christensen", lifespan: "1850–", basis: "hint-census dispatch 2026-10-07 + authed-wake dispatch 2026-10-10 (christening vein)" },
  "MLCS-MVB": { name: "Karen Christensen", lifespan: "1845–", basis: "hint-census dispatch 2026-10-07 + authed-wake dispatch 2026-10-10 (christening vein)" },
  "MLCS-MKV": { name: "Dorthe Catherine Christensen", lifespan: "1847–", basis: "hint-census dispatch 2026-10-07 + authed-wake dispatch 2026-10-10 (christening vein)" },
  "LZDH-WB1": { name: "Ane Sophie Christensen", lifespan: "1841–", basis: "assistant dispatch 2026-10-03 (baptism attach); hint-census 2026-10-07 (christening attach)" },
  "L1NW-6M1": { name: "Mette Kirstine Christensen", lifespan: "1843–", basis: "assistant dispatch 2026-10-03 (baptism attach); birth year per the record citation (H2S7-W1MM, 1843)" },
  "LBYC-QZ8": { name: "Martin Olaf Martinsen", lifespan: "1875–1952", basis: "NUMIDENT-anchored person (hint-census allowlist precedent; assistant dispatch 2026-10-03)" },
  "PNC6-GJQ": { name: "Nels Martinsen", lifespan: "–", basis: "assistant dispatch 2026-10-03g (father of the b.1875 son; 19th-century, deceased-by-age)" },
  "PNCX-S8Q": { name: "unnamed mother of Martin Olaf Martinsen", lifespan: "–", basis: "assistant dispatch 2026-10-03g (created Deceased)" },
  "L1N9-SL2": { name: "Lars Christensen", lifespan: "1839–", basis: "assistant dispatch 2026-10-03 (Lars, christened 1839 Bakkendrup; the census-cluster father is L1N9-S2L); transcription-only — attach work stays parked behind the founder merge call" },
  "LW9Z-S11": { name: "Christen Olsen (1780 contested cluster)", lifespan: "1780–", basis: "assistant dispatch 2026-10-03g attach target; transcription-only, contested cluster" },
  "KWCT-391": { name: "Mary Ann Hadlock", lifespan: "1885–1927", basis: "tasks-harvest dispatch 2026-10-04" },
  "LCZ5-8QV": { name: "Dwight Dow", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (father in the 1910 baptism record of his b.1902 son; deceased-by-age)" },
  "KWJZ-YG2": { name: "Walter John Dow", lifespan: "1902–", basis: "tasks-harvest dispatch 2026-10-04 (baptized 1910 age 8; deceased-by-age >110y)" },
  "LJDF-JY4": { name: "Irving Albert Cook", lifespan: "–1959", basis: "tasks-harvest dispatch 2026-10-04 (Ohio Death Index attach)" },
  "L49V-3DJ": { name: "Beulah Cook", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (1920-census adult; deceased-by-age)" },
  "PNC5-R9G": { name: "Daniel L Briggs", lifespan: "1937–2025", basis: "hint-harvest dispatch 2026-10-06 (obit exact-vitals)" },
  "L21W-9ZT": { name: "Chester Briggs", lifespan: "1911–2014", basis: "hint-harvest dispatch 2026-10-06 (obituary attach)" },
  "KWCL-VJS": { name: "Rollin Eugene Lawton", lifespan: "1894–1974", basis: "v8 provider-deceased, read this wake 2026-10-13 (Donna Ruth Lawton's father); tasks-harvest 2026-10-04 attach" },
  "KWZ7-YMT": { name: "Lee Atkin", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (BillionGraves gravestone record)" },
  "GC86-D18": { name: "Clara Schneider", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (1920-census adult; deceased-by-age)" },
  "GC86-FL9": { name: "Oscar Schneider", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (1920-census adult husband; deceased-by-age)" },
  "LCJS-38R": { name: "Marion Draper", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (1930-census adult; deceased-by-age)" },
  "LVXM-WHK": { name: "Rubey P Johnson", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (1930-census adult spouse; deceased-by-age)" },
};

// Deliberate stubs (never allowlisted — obit/census households of possibly-
// living persons ride private tier only, the Don/Marilyn obit precedent):
// PNCP-RDN (Jim Briggs, living-flagged creation), LL4G-322 (David Briggs),
// KCN3-1P6 (Theodora Bell Lawton), KWZR-P2Y (Muriel Whitney),
// GC86-D1K (Maree Schneider, 1920-census child), GBKX-TGP (Claire, same).

// The walked set: EVERY person the lane attached records to after the
// 2026-09-18 freeze (dispatches 10-03 assistant + 10-03g holes + 10-04 tasks +
// 10-04b seed-attaches + 10-06 hint-harvest + 10-06d authed + 10-07 census +
// 10-10 labor). Cleo Remington's pid is unresolved (her BillionGraves attach
// VRX7-KLP is dispatch-named, not ledger'd) — named, never guessed.
export const WALKED_PIDS = [
  "LJDG-CYG", "LN5V-3N2", "GWXR-H2K", "GWXR-3TD",
  "LZDH-WYF", "MHRT-169", "MLCS-MN5", "MLCS-M2L", "MLCS-M2Q", "MLCS-MVB", "MLCS-MKV",
  "LZDH-WB1", "L1NW-6M1", "LBYC-QZ8", "PNC6-GJQ", "PNCX-S8Q", "L1N9-SL2", "LW9Z-S11",
  "KWCT-391", "LCZ5-8QV", "KWJZ-YG2", "LJDF-JY4", "L49V-3DJ",
  "PNC5-R9G", "PNCP-RDN", "L21W-9ZT", "LL4G-322", "KCN3-1P6",
  "KWCL-VJS", "KWZ7-YMT", "KWZR-P2Y",
  "GC86-D18", "GC86-FL9", "GC86-D1K", "GBKX-TGP", "LCJS-38R", "LVXM-WHK",
];

export function buildPayload(index) {
  const persons = Array.isArray(index.persons) ? index.persons : Object.values(index.persons);
  const byFsid = new Map(persons.map((p) => [p.fsid, p]));
  const cohort = [];
  for (const pid of WALKED_PIDS) {
    const frozen = byFsid.get(pid);
    // extramural persons walk at dep 9: the walker's qRepair depth gate
    // (dep > 9 suppressed) then refuses their parent-repair, keeping the
    // pass exactly on the walked set.
    cohort.push({ pid, dep: frozen ? frozen.depth : 9 });
  }
  return {
    cohort,
    danglers: [],
    known: persons.map((p) => p.fsid),
    note: "sources-sync pass: evidence-only walk of the post-freeze touched set; repair suppressed (all frozen fsids known, extramural at dep 9)",
  };
}

const ARK_IN = (hay) => (typeof hay === "string" ? hay : "");

// the walker dump's src values are RAW links/sources payloads — parse them
// through the proven fs-adapter parser before any projection/matching (the
// original staging pipeline law: parseSourceDescriptions → publicSourceRecord;
// raw records may lack urls/evidence entirely)
function parseRawSrc(dump) {
  const parsed = {};
  for (const [sid, raw] of Object.entries(dump.src || {})) {
    const recs = parseSourceDescriptions({ sources: [raw] });
    if (recs.length) parsed[sid] = recs[0];
  }
  return parsed;
}

// does a parsed links/sources record correspond to a ledger ark? Live-wire
// proof (2026-10-12): the record bodies carry NO about/urls — the ark rides
// inside the citation prose ("…/ark:/61903/1:1:MCL8-D19 : …") and the uri
// field; tree-source ids are a different universe (WFP3/WFPS-style), so id
// equality only helps when the ledger ark IS the id form.
function recordMatchesArk(rec, ark) {
  if (!rec) return false;
  if (rec.id === ark) return true;
  const urls = Array.isArray(rec.urls) ? rec.urls : [];
  const hays = [
    ARK_IN(rec.about),
    ARK_IN(rec.uri),
    ARK_IN(rec.citation),
    ...urls.map((u) => ARK_IN(typeof u === "string" ? u : u.url)),
  ];
  return hays.some((h) => h.includes(ark));
}

export function validateRedactInput(text) {
  if (typeof text !== "string") return { ok: false, reason: "redact list file unreadable — build refuses (fail-closed)" };
  const names = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (!names.length) return { ok: false, reason: "redact list empty — an absent list must not mean 'no living names' (fail-closed)" };
  return { ok: true, names };
}

export function buildSync({ dump, index, ledger, generated, redactNames, walkedPids = WALKED_PIDS }) {
  if (!Array.isArray(redactNames) || !redactNames.length) {
    throw new Error("redactNames required — the build is fail-closed without the private-tier living-name list");
  }
  const persons = Array.isArray(index.persons) ? index.persons : Object.values(index.persons);
  const byFsid = new Map(persons.map((p) => [p.fsid, p]));
  const src = parseRawSrc(dump);
  const ledgerByArk = new Map();
  for (const r of ledger.records || []) {
    ledgerByArk.set(r.ark, r);
  }

  const out = {
    schema: "skaists.sources-sync/1",
    generated,
    scope: "post-freeze attach transcription sync — full citations + transcriptions for records attached after the 2026-09-18 harvest freeze, on the touched persons",
    provenance: {
      freeze: { generated: index.generated ?? null, uniqueRecords: index.uniqueRecords ?? null, schema: index.schema ?? null },
      method: "fs-adapter PAGE_SOURCE_WALKER (v8 details + tf entityref + links/sources readExternalData), cookie session",
      ledger: "dispatch-derived post-freeze attach ledger (tools/genealogy/sources-sync-ledger.json)",
    },
    persons: {},
    reconciliation: null,
  };

  let newSourcesTotal = 0, unattributed = 0, cohortDebtTotal = 0, redactedStubs = 0;
  const cohortSyncDebt = {};

  for (const pid of walkedPids) {
    const person = dump.persons?.[pid];
    const refs = dump.refs?.[pid];
    if (!person || !refs) {
      out.persons[pid] = { tier: "missing", reason: "not in walk dump" };
      continue;
    }
    const frozen = byFsid.get(pid);
    const tier = frozen ? "cohort" : "extramural";
    const livingFlag = person.living === true;
    const allow = DECEASED_EXTRAMURAL_SYNC[pid];

    // redacted stubs never carry the fsid — not even as the map key
    const redactStub = (reason) => {
      redactedStubs++;
      out.persons[`[redacted-extramural-${redactedStubs}]`] = { tier, status: "redacted", sourcesAttached: refs.sources.length, reason };
    };
    if (tier === "extramural" && !allow) {
      redactStub("extramural, not on the dispatch-proven deceased allowlist — fsid withheld");
      continue;
    }
    if (livingFlag && tier === "extramural") {
      redactStub("living flag on the walked record — fsid withheld");
      continue;
    }
    if (livingFlag && tier === "cohort") {
      redactStub("living flag contradicts the deceased-by-scope cohort — withheld pending reconciliation");
      continue;
    }

    const currentIds = new Set(refs.sources.map((s) => s.id));
    const frozenIds = tier === "cohort"
      ? new Set((frozen.sources || []).map((s) => s.id))
      : new Set();

    // records to transcribe: ledger-known arks matched against the walk dump
    const ledgerRows = (ledger.records || []).filter((r) => (r.attachedTo || []).includes(pid));
    const newSources = [];
    for (const row of ledgerRows) {
      const rec = Object.values(src).find((s) => recordMatchesArk(s, row.ark));
      const inRef = [...currentIds].some((id) => id === row.ark);
      if (!rec && !inRef) {
        newSources.push({ ark: row.ark, status: "ledger-expected-not-found", dispatch: row.dispatch });
        continue;
      }
      const pub = rec ? publicSourceRecord(rec, { redactNames }) : null;
      newSources.push({
        ...(pub || { id: row.ark, title: null, citation: null }),
        ark: row.ark,
        dispatch: row.dispatch,
        status: "attached",
      });
      newSourcesTotal++;
    }
    // cohort-only: unattributed deltas (fresh ids outside the frozen baseline
    // and outside the ledger) are named honestly, never silently dropped
    if (tier === "cohort") {
      const ledgerArks = new Set(ledgerRows.map((r) => r.ark));
      for (const id of currentIds) {
        if (frozenIds.has(id)) continue;
        const matched = [...ledgerArks].some((ark) => recordMatchesArk({ id, urls: [], about: null }, ark)) ||
          (src[id] && [...ledgerArks].some((ark) => recordMatchesArk(src[id], ark)));
        if (matched) continue;
        const rec = src[id];
        const pub = rec ? publicSourceRecord(rec, { redactNames }) : { id, title: null, citation: null };
        newSources.push({ ...pub, status: "attached", dispatch: "post-freeze delta (unattributed to a dispatch)" });
        unattributed++;
        newSourcesTotal++;
      }
      const debt = newSources.filter((s) => s.status === "attached").length;
      if (debt) { cohortSyncDebt[pid] = debt; cohortDebtTotal += debt; }
    }

    out.persons[pid] = {
      tier,
      ...(tier === "cohort"
        ? { iid: frozen.iid, depth: frozen.depth, name: frozen.name, lifespan: frozen.lifespan,
            providerSourceCount: { freeze: frozen.providerSourceCount ?? null, now: refs.sources.length } }
        : { name: allow.name, lifespan: allow.lifespan, allowlistBasis: allow.basis,
            sourcesAttachedNow: refs.sources.length,
            standingNotTranscribed: refs.sources.length - newSources.filter((s) => s.status === "attached").length }),
      newSources,
    };
  }

  out.reconciliation = {
    pidsWalked: walkedPids.length,
    newSourcesTranscribed: newSourcesTotal,
    unattributedDelta: unattributed,
    cohortSyncDebt,
    cohortDebtTotal,
    redactedStubs,
    countingNote: "manifest-derived only; extramural standing sources are counted, never transcribed without ledger provenance",
  };
  return out;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
if (cmd === "payload") {
  const [indexFile, outFile] = args;
  const index = JSON.parse(readFileSync(indexFile, "utf8"));
  writeFileSync(outFile, JSON.stringify(buildPayload(index)));
  console.log(`payload written: ${outFile} (walked ${WALKED_PIDS.length} pids)`);
} else if (cmd === "build") {
  const [dumpFile, ledgerFile, indexFile, outFile, redactFile] = args;
  const dump = JSON.parse(readFileSync(dumpFile, "utf8"));
  const ledger = JSON.parse(readFileSync(ledgerFile, "utf8"));
  const index = JSON.parse(readFileSync(indexFile, "utf8"));
  const v = validateRedactInput(readFileSync(redactFile, "utf8"));
  if (!v.ok) { console.error(v.reason); process.exit(1); }
  const artifact = buildSync({
    dump, index, ledger, redactNames: v.names,
    generated: new Date().toISOString().slice(0, 16) + "Z",
  });
  writeFileSync(outFile, JSON.stringify(artifact));
  console.log(JSON.stringify(artifact.reconciliation, null, 1));
  console.log(`artifact written: ${outFile}`);
} else if (cmd) {
  console.error("usage: sources-sync.mjs payload <index.json> <out> | build <dump> <ledger> <index> <out> <redact-list>");
  process.exit(1);
}
