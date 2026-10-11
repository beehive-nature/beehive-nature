// ── hint census → public corpus layer ─────────────────────────────────────
//   node hint-census.mjs <sweep-input.json> <sweep-results.ndjson> <out.json>
// Folds one authed record-matches sweep (v8 wire, private tier) into the
// public `skaists.hint-census/1` artifact. Hints are POSSIBILITY-tier
// evidence (provider-computed matches, not attached records): they never
// upgrade a person's evidence.support — the census layer names them per the
// corrective-receipt discipline (possibility ≠ support).
//
// Privacy law (corpus public layer): cohort persons are deceased-by-scope;
// extramural persons are nameable ONLY via the explicit dispatch-proven
// deceased allowlist below — every other extramural pid (living or
// unconfirmed) is redacted to a count stub, fsid withheld, match detail
// withheld (full fidelity lives in the private sweep files).

import { readFileSync, writeFileSync } from "node:fs";

// dispatch-proven deceased extramural persons (name + basis required)
export const DECEASED_EXTRAMURAL = {
  "MHRT-169": { name: "Christen Olsen", lifespan: "1806–1875", basis: "authed-wake dispatch 2026-10-06" },
  "LZDH-WYF": { name: "Maren Nielsdatter", lifespan: "1811–", basis: "authed-wake dispatch 2026-10-06" },
  "MLCS-MN5": { name: "Johanne Marie Christensen", lifespan: "1835–", basis: "authed-wake dispatch 2026-10-06" },
  "L1N9-S2L": { name: "Christen Olsen (census cluster)", lifespan: "1806–Deceased", basis: "authed-wake dispatch 2026-10-06" },
  "PNC6-GJQ": { name: "Nels Martinsen", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04 (father of b.1875 son)" },
  "PNCX-S8Q": { name: "unnamed mother of Martin Olaf Martinsen", lifespan: "–", basis: "tasks-harvest dispatch 2026-10-04" },
  "LBYC-QZ8": { name: "Martin Olaf Martinsen", lifespan: "1875–1952", basis: "NUMIDENT-anchored person" },
  "PNC5-R9G": { name: "Daniel L Briggs", lifespan: "1937–2025", basis: "hint-harvest dispatch 2026-10-06 (obit exact-vitals)" },
  "LJDF-JY4": { name: "Cook-line person", lifespan: "–", basis: "seed-attaches dispatch 2026-10-06 (pension attach)" },
  "L21W-9ZT": { name: "Chester Briggs", lifespan: "–", basis: "hint-harvest dispatch 2026-10-06 (obituary attach)" },
  "KWCT-391": { name: "Mary Ann Hadlock", lifespan: "–", basis: "authed-wake dispatch 2026-10-06 (19th-century ancestor)" },
};

const STATUS_MEANINGS = {
  410: "provider refusal — pid record gone (living-flag/private-space class)",
  401: "session lost mid-sweep",
  404: "person record absent",
};

export function buildCensus ({ input, results, generated, sessionProof, sweepMeta }) {
  const names = Object.fromEntries(input.map(r => [r.fsid, r]));
  const persons = {};
  let cohortOpen = 0, extramuralOpen = 0, cohortHinted = 0, extramuralHinted = 0;
  let redacted = 0, httpErrors = [];
  const byConfidence = {};

  for (const row of results) {
    if (row.error || (row.status && row.status !== 200)) {
      httpErrors.push({ pid: names[row.pid]?.tier === "cohort" ? row.pid : (DECEASED_EXTRAMURAL[row.pid] ? row.pid : "[redacted-extramural]"),
        status: row.status ?? null, error: row.error ?? null,
        meaning: STATUS_MEANINGS[row.status] ?? "unexpected" });
      continue;
    }
    const meta = names[row.pid];
    const open = row.n || 0;
    if (meta.tier === "cohort") {
      if (open > 0) {
        cohortHinted++;
        cohortOpen += open;
        persons[row.pid] = {
          name: meta.name, depth: meta.depth, tier: "cohort",
          openHints: (row.matches || []).map(m => ({
            ark: m.ark, personName: m.name, collection: m.coll,
            confidence: m.conf, score: m.score, hasImage: m.img,
            relations: m.rel ?? [], events: m.ev ?? "",
          })),
        };
        for (const m of row.matches || []) byConfidence[m.conf] = (byConfidence[m.conf] || 0) + 1;
      }
    } else {
      const deceased = DECEASED_EXTRAMURAL[row.pid];
      if (open > 0) {
        extramuralHinted++;
        extramuralOpen += open;
        for (const m of row.matches || []) byConfidence[m.conf] = (byConfidence[m.conf] || 0) + 1;
      }
      if (deceased) {
        if (open > 0) persons[row.pid] = {
          name: deceased.name, depth: null, tier: "extramural",
          openHints: (row.matches || []).map(m => ({
            ark: m.ark, personName: m.name, collection: m.coll,
            confidence: m.conf, score: m.score, hasImage: m.img,
            relations: m.rel ?? [], events: m.ev ?? "",
          })),
        };
      } else {
        redacted++;
        persons["[redacted-extramural-" + redacted + "]"] = {
          tier: "extramural", redacted: "living-or-unconfirmed extramural person",
          openHints: open, matchDetailWithheld: true,
          basis: "privacy law — corpus public layer drops the living; full fidelity in the private sweep files",
        };
      }
    }
  }

  const counted = results.length;
  return {
    schema: "skaists.hint-census/1",
    generated,
    scope: "outstanding (unattached) provider record hints across the 8 deceased blood generations (809 corpus persons, depths 2–9 from root L627-FH9) plus named extramural open-vein persons",
    root: "L627-FH9",
    provider: "FamilySearch record-matches wire (founder signed-in session, in-page fetch)",
    sessionProof,
    evidenceClass: "possibility-tier — provider-computed matches; attaching is the only upgrade path and happens in the linker with identity verification; this layer never upgrades evidence.support",
    sweepMeta,
    totals: {
      pidsSwept: counted,
      cohortPersons: input.filter(r => r.tier === "cohort").length,
      extramuralPersons: input.filter(r => r.tier !== "cohort").length,
      hintedPersons: cohortHinted + extramuralHinted,
      openHintsTotal: cohortOpen + extramuralOpen,
      cohortOpenHints: cohortOpen,
      extramuralOpenHints: extramuralOpen,
      byConfidence,
      redactedExtramuralPersons: redacted,
    },
    reconciliation: {
      counted, httpErrors,
      okCount: counted - httpErrors.length,
      policy: "every pid accounted for; provider refusals named, never dropped",
    },
    persons,
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1].replace(/\\/g, "/")).href) {
  const [inputPath, resultsPath, outPath] = process.argv.slice(2);
  if (!inputPath || !resultsPath || !outPath) {
    console.error("usage: node hint-census.mjs <sweep-input.json> <sweep-results.ndjson> <out.json>");
    process.exit(2);
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const results = readFileSync(resultsPath, "utf8").trim().split("\n")
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const census = buildCensus({
    input, results,
    generated: new Date().toISOString(),
    sessionProof: JSON.parse(readFileSync(new URL("./hint-census-session.json", import.meta.url), "utf8")),
    sweepMeta: JSON.parse(readFileSync(new URL("./hint-census-sweep.json", import.meta.url), "utf8")),
  });
  writeFileSync(outPath, JSON.stringify(census, null, 1) + "\n");
  console.log(JSON.stringify(census.totals, null, 1));
}
