#!/usr/bin/env node
// bLibrary search/index — priority 7. Read-only query over enriched records.
// usage: node search.mjs <corpusRoot> [--q text] [--subject S] [--source S]
//        [--provenance P] [--year Y] [--hash H] [--state CLEAN|CORRUPT|PARTIAL]
//        [--dupes-only] [--unprovenanced] [--value V] [--domain D] [--etype T]
//        [--limit N] [--json]
// Prefers routed-*.jsonl (enriched + routing labels) when present.
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const ROOT = path.resolve(argv[0] ?? "");
const REC = path.join(ROOT, "library-records");
const get = (k) => { const i = argv.indexOf(`--${k}`); return i > 0 ? argv[i + 1] : null; };
const flag = (k) => argv.includes(`--${k}`);
const LIMIT = Number(get("limit") ?? 50);

const all = fs.existsSync(REC) ? fs.readdirSync(REC) : [];
const routed = all.filter((f) => /^routed-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
const enr = all.filter((f) => /^enriched-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
if (!routed.length && !enr.length) { console.error("no enriched/routed jsonl — run enrich.mjs (and route.mjs) first"); process.exit(2); }
const useRouted = routed.length > 0;
const file = useRouted ? routed[routed.length - 1] : enr[enr.length - 1];
const records = fs.readFileSync(path.join(REC, file), "utf8").trim().split("\n").map(JSON.parse);

const q = get("q")?.toLowerCase();
const hits = records.filter((r) => {
  if (get("subject") && !r.subjects.includes(get("subject"))) return false;
  if (get("source") && r.source !== get("source")) return false;
  if (get("provenance") && !r.provenance.includes(get("provenance"))) return false;
  if (get("year") && r.year !== get("year")) return false;
  if (get("state") && r.parse_state !== get("state").toUpperCase()) return false;
  if (get("hash") && !r.sha256.startsWith(get("hash").toLowerCase())) return false;
  if (flag("dupes-only") && !r.duplicate_of) return false;
  if (flag("unprovenanced") && r.provenance !== "unknown") return false;
  if (get("value") && r.routing?.research_value !== get("value")) return false;
  if (get("domain") && !r.routing?.domain?.includes(get("domain"))) return false;
  if (get("etype") && r.routing?.evidence_type !== get("etype")) return false;
  if (q) {
    const hay = [r.title, r.author, r.original_filename, r.doi, r.harvest_topic, r.harvest_phase, ...(r.metadata_claims ?? []).map((c) => c.value)].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
});

console.error(`${hits.length} match(es) of ${records.length} (index ${file}${useRouted ? ", routed" : ""})`);
if (flag("json")) { console.log(JSON.stringify(hits.slice(0, LIMIT), null, 2)); process.exit(0); }
for (const r of hits.slice(0, LIMIT)) {
  const dupe = r.duplicate_of ? ` [dup of ${r.duplicate_of}]` : "";
  const rt = r.routing ? ` <${r.routing.research_value}/${r.routing.evidence_type}${r.routing.domain.length ? "/" + r.routing.domain.join("+") : ""}>` : "";
  console.log(`${r.id}${dupe}${rt} ${r.parse_state} ${r.year} "${r.title}" — ${r.author} | ${r.source} | ${r.subjects.join(",")} | ${r.current_path}`);
}
if (hits.length > LIMIT) console.error(`... ${hits.length - LIMIT} more (use --limit)`);
