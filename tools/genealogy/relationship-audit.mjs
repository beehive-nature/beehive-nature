// Relationship-by-relationship evidence audit — zBlood, 2026-09-29.
// Founder distinction (2026-09-28): "809 people represented in the harvested
// tree does not establish 809 proven biological relationships." This tool
// grades what the HELD evidence documents per parent-child LINK — it invents
// no geometry, upgrades no support axis, and never claims biological proof.
// Classes (mutually exclusive, strongest wins):
//   link-record        one record names BOTH parties (co-occurrence in a
//                      single contemporary-ish record — the strongest thing
//                      we hold; still co-occurrence, not a named-as-parent
//                      verdict unless the record says so)
//   both-sourced       both persons carry attached sources, none shared
//   child-sourced      only the child side is sourced (parent beyond the
//                      harvested cohort, or parent unsourced on FS)
//   parent-sourced     only the parent side is sourced
//   neither-sourced    walked-record assertion only
//   tradition          either endpoint is an overlay/saga/medieval-class
//                      person (tradition layer, never silently upgraded)
// Edges touching living persons are excluded from audit scope entirely.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const tokens = (s) => norm(s).split(" ").filter(Boolean);

// Does a record fact/title string carry the other party's name?
// v1 rule, transparent: full normalized containment, OR every token of
// (first-given + surname) present. Conservative: requires given AND surname.
function nameCarried(text, personName) {
  const t = norm(text);
  const pk = tokens(personName);
  if (pk.length < 2) return t.includes(norm(personName)) && pk.length > 0;
  if (t.includes(norm(personName))) return true;
  const given = pk[0];
  const surnames = pk.slice(1);
  const tk = t.split(" ");
  return tk.includes(given) && surnames.every((s) => tk.includes(s));
}

export function classifyEdge({ child, parent, childSources, parentSources, records, traditionSet }) {
  if (traditionSet.has(child.iid) || traditionSet.has(parent.iid)) return { cls: "tradition", why: "overlay/saga/medieval endpoint — tradition layer" };
  const recs = [];
  for (const src of [...(childSources || []), ...(parentSources || [])]) {
    const r = records[src.id];
    if (!r) continue;
    const hay = [r.title, ...(r.evidence || []).map((f) => f.value)].filter(Boolean).join(" \u00b7 ");
    const childNamed = child.iid === parent.iid || nameCarried(hay, child.name);
    const parentNamed = nameCarried(hay, parent.name);
    if (childNamed && parentNamed) recs.push({ id: r.id, title: (r.title || "").slice(0, 90) });
  }
  if (recs.length) return { cls: "link-record", why: `${recs.length} record(s) naming both parties`, recs: recs.slice(0, 5) };
  const cs = (childSources || []).length > 0 || (child.sourced === true);
  const ps = (parentSources || []).length > 0 || (parent.sourced === true);
  if (cs && ps) return { cls: "both-sourced", why: "both persons sourced; no single record carries both names" };
  if (cs) return { cls: "child-sourced", why: "child sourced; parent side not (beyond harvested cohort or unsourced on FS)" };
  if (ps) return { cls: "parent-sourced", why: "parent sourced; child side not" };
  return { cls: "neither-sourced", why: "walked-record assertion only" };
}

export function audit({ corpus, sourcesIndex, recordsMap, cohortDepthMin = 2 }) {
  const persons = corpus.persons || {};
  const edges = corpus.edges || {};
  const idx = sourcesIndex.persons || {};
  const traditionSet = new Set(
    Object.entries(persons)
      .filter(([, p]) => {
        const cl = p.evidence && p.evidence.class;
        return cl === "saga" || cl === "medieval" || (p.iid || "").startsWith("ovl-") || /attested/.test((p.evidence && p.evidence.basis) || "");
      })
      .map(([iid]) => iid)
  );
  const cohortIids = new Set(Object.values(idx).map((p) => p.iid));
  const out = { edges: [], skipped: { living: 0, missing: 0, outOfScope: 0 } };
  for (const [childIid, parentIids] of Object.entries(edges)) {
    const child = persons[childIid];
    if (!child) { out.skipped.missing++; continue; }
    if (child.living || childIid === "founder") { out.skipped.living++; continue; }
    const depth = idx[childIid] ? idx[childIid].depth : null;
    if (cohortIids.has(childIid) && depth !== null && depth < cohortDepthMin) { out.skipped.outOfScope++; continue; }
    if (!cohortIids.has(childIid)) { out.skipped.outOfScope++; continue; } // audit scope = the harvested cohort's parent links
    for (const parentIid of parentIids || []) {
      const parent = persons[parentIid];
      if (!parent) { out.skipped.missing++; continue; }
      if (parent.living) { out.skipped.living++; continue; }
      const childSources = (idx[childIid] && idx[childIid].sources) || [];
      const parentSources = (idx[parentIid] && idx[parentIid].sources) || [];
      const verdict = classifyEdge({
        child: { iid: childIid, name: child.name, sourced: (child.evidence || {}).support === "sourced" },
        parent: { iid: parentIid, name: parent.name, sourced: (parent.evidence || {}).support === "sourced" },
        childSources, parentSources, records: recordsMap, traditionSet,
      });
      out.edges.push({
        child: childIid, parent: parentIid, childDepth: depth,
        childName: child.name, parentName: parent.name,
        childEra: (child.evidence || {}).era, parentEra: (parent.evidence || {}).era,
        ...verdict,
      });
    }
  }
  const byClass = {};
  for (const e of out.edges) byClass[e.cls] = (byClass[e.cls] || 0) + 1;
  const byClassDepth = {};
  for (const e of out.edges) {
    const d = e.childDepth == null ? "?" : Math.min(e.childDepth, 9);
    byClassDepth[e.cls] = byClassDepth[e.cls] || {};
    byClassDepth[e.cls][d] = (byClassDepth[e.cls][d] || 0) + 1;
  }
  return { schema: "skaists.relationship-audit/1", generated: new Date().toISOString(), scope: "parent-child links of the 809-person harvested cohort (depths 2-9), graded on held evidence only",
    method: "attached-source lists primary; person-support fallback = corpus support axis (which folds the search-evidence layer — search evidence is NOT attached sources); link-record = one record naming both parties (co-occurrence, not a named-as-parent verdict unless the record says so)",
    byClass, byClassDepth, skipped: out.skipped, totalEdges: out.edges.length, edges: out.edges };
}

export function main(argv = process.argv.slice(2)) {
  const root = resolve(argv[0] || ".");
  const corpus = JSON.parse(readFileSync(resolve(root, "assets/profile-archive/lineage/remington-bloodline.json"), "utf8"));
  const sourcesIndex = JSON.parse(readFileSync(resolve(root, "assets/profile-archive/lineage/sources/index.json"), "utf8"));
  const recordsDoc = JSON.parse(readFileSync(resolve(root, "assets/profile-archive/lineage/sources/records.json"), "utf8"));
  const result = audit({ corpus, sourcesIndex, recordsMap: recordsDoc.records || {} });
  const outFile = resolve(root, "assets/profile-archive/lineage/sources/relationship-audit.json");
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(result, null, 1) + "\n");
  console.log(`relationship audit: ${result.totalEdges} edges graded (${result.skipped.living} living-skipped, ${result.skipped.missing} missing-endpoint, ${result.skipped.outOfScope} out-of-scope)`);
  for (const [cls, n] of Object.entries(result.byClass).sort((a, b) => b[1] - a[1])) console.log(`  ${cls}: ${n}`);
  console.log(`wrote ${outFile}`);
  return result;
}

if (process.argv[1] && process.argv[1].endsWith("relationship-audit.mjs") && !process.env.ZGEN_NO_MAIN) main();
