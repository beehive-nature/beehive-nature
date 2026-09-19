// ── zGeneArchive · GUX-01 slice 1 — read-only archive graph access ──────────
// Whole-tree family atlas, trust layer. Wraps a PUBLISHED skaists.lineage/2
// corpus (+ its sidecars: identity registry, reconstructions, staged person
// objects) and answers the questions the atlas UI asks — without mutating
// anything and without inventing certainty.
//
// ONE RESOLVER, TWO ENVIRONMENTS (founder ruling bdf59735): the pure
// relationship resolver — relationshipPath, bloodlineSet, resolve,
// searchNames, cyclicAncestryOf — lives in surfaces/archive-core.mjs (zero
// imports: node AND browser). This wrapper is the ARCHIVE CONSTRUCTION
// LAYER: fs loaders, the F3 duplicate-provider-ref integrity law, staged
// objects, reconstructions, panels, inventory, and the privacy gate. It
// consumes the core and adds the filesystem around it — one implementation,
// zero resolver duplication.
//
// Laws carried here (from the sprint order + the model's own laws):
//  · bloodline() is PARENTWARD ancestry only. Whole-family reach needs
//    ancestors, available descendants, collaterals, spouses — classified.
//  · A spouse connection is AFFINITY, never a blood relationship.
//  · A missing branch is missing COVERAGE ("referenced, record not fetched"
//    or "not in this public projection"), never "this person had no children".
//  · Repeated ancestors keep ONE canonical identity (registry ids + aliases).
//  · Evidence era and support stay SEPARATE axes; counts are counts — a
//    source count or era label must never become a confidence score.
//  · Competing parentage reconstructions are inspectable side by side;
//    previewing one never overwrites the chosen reconstruction.
//  · Read-only: nothing here writes, nothing here re-issues identity.
//  · Provider-agnostic: no provider name lives in this file (adapter law).
//
// Zero dependencies beyond node builtins + the core. Node 18+.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { validate as modelValidate } from "./model.mjs";
import { createArchiveCore } from "../../surfaces/archive-core.mjs";

export const ARCHIVE_SCHEMA = "skaists.archive-access/1";

// ── loading ─────────────────────────────────────────────────────────────────
// loadArchive({ corpusPath } | { model }) — path form reads sidecars relative
// to the corpus file; object form takes them as { registry, recon, personsDir }.
export function loadArchive(opts = {}) {
  let model = opts.model ?? null;
  let registry = opts.registry ?? null;
  let recon = opts.recon ?? null;
  let personsDir = opts.personsDir ?? null;
  if (opts.corpusPath) {
    model = JSON.parse(readFileSync(opts.corpusPath, "utf8"));
    const dir = dirname(opts.corpusPath);
    const regP = join(dir, "identity-registry.json");
    const recP = join(dir, "reconstructions.json");
    const perD = join(dir, "persons");
    if (existsSync(regP)) registry = JSON.parse(readFileSync(regP, "utf8"));
    if (existsSync(recP)) recon = JSON.parse(readFileSync(recP, "utf8"));
    if (existsSync(perD)) personsDir = perD;
  }
  if (!model || !model.persons) throw new Error("loadArchive: no lineage model (corpusPath or model required)");

  const P = model.persons;
  const E = model.edges || {};
  const C = model.couples || {};

  // ── archive CONSTRUCTION law (F3 lives HERE, not in the browser core) ─────
  // Provider-ref index: corpus refsIndex if present, else built from persons.
  // Guard: a provider ref must never resolve to two different persons —
  // collisions fail the load (named, capped) instead of last-wins silently.
  // The pure core receives the model only after this law has passed.
  const ref2id = new Map();
  if (model.refsIndex) {
    for (const [ref, id] of Object.entries(model.refsIndex)) ref2id.set(ref, id);
  } else {
    const refCollisions = [];
    for (const [id, p] of Object.entries(P)) for (const r of p.refs || []) {
      const ref = r.id ?? r;
      const prev = ref2id.get(ref);
      if (prev === undefined || prev === id) ref2id.set(ref, id);
      else if (refCollisions.length < 10 && !refCollisions.includes(ref)) refCollisions.push(ref);
    }
    if (refCollisions.length)
      throw new Error("loadArchive: provider ref resolves to multiple persons (last-wins disabled): " + refCollisions.join(", ") + (refCollisions.length >= 10 ? " ..." : ""));
  }

  // the ONE resolver (shared with the browser surface) — constructed only
  // after the construction-layer integrity law has passed.
  const core = createArchiveCore(model, { registry });

  // wrapper-side indexes for the panel read model (relatives/coverage are
  // archive API, not resolver machinery — they stay here per the ruling)
  const childIndexOf = new Map(); // parentId -> [childIds]
  for (const [child, ps] of Object.entries(E)) {
    for (const parent of ps) {
      if (!childIndexOf.has(parent)) childIndexOf.set(parent, []);
      childIndexOf.get(parent).push(child);
    }
  }
  for (const arr of childIndexOf.values()) arr.sort();

  const resolvedParents = (id) => (E[id] || []).filter((x) => P[x]);
  const ghostParents = (id) => (E[id] || []).filter((x) => !P[x]);
  const spouseKeysOf = new Map(); // id -> [coupleKeys]
  for (const [k, cp] of Object.entries(C)) {
    for (const m of [cp.p1, cp.p2]) {
      if (!spouseKeysOf.has(m)) spouseKeysOf.set(m, []);
      spouseKeysOf.get(m).push(k);
    }
  }

  const ev = (id) => {
    const e = P[id]?.evidence || {};
    return { era: e.era ?? e.class ?? null, support: e.support ?? null, basis: e.basis ?? null };
  };
  const rel = (id, relation, blood, extra = {}) =>
    P[id] ? { id, name: P[id].name, lifespan: P[id].lifespan ?? null, relation, blood, evidence: ev(id), ...extra } : null;
  const dedupeById = (arr) => {
    const seen = new Set(), out = [];
    for (const x of arr) { if (x && !seen.has(x.id)) { seen.add(x.id); out.push(x); } }
    return out;
  };
  const staged = (id) => {
    if (!personsDir) return null;
    const p = join(personsDir, id + ".json");
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
  };

  // ── relatives — classified, deduplicated, honest about coverage ────────────
  function relativesOf(id) {
    if (!P[id]) return null;
    const parents = resolvedParents(id).map((x) => rel(x, "parent", true));
    const ghosts = ghostParents(id).map((ref) => ({ ref, relation: "parent", status: "referenced-not-fetched" }));
    const children = dedupeById((childIndexOf.get(id) || []).filter((c) => P[c]).map((c) => rel(c, "child", true)));
    const sibSet = new Map();
    for (const par of resolvedParents(id)) {
      for (const c of (childIndexOf.get(par) || [])) {
        if (c !== id && P[c] && !sibSet.has(c)) sibSet.set(c, par);
      }
    }
    const siblings = dedupeById([...sibSet.keys()].sort().map((s) => rel(s, "sibling", true, { sharedParent: sibSet.get(s) })));
    const spouses = dedupeById((spouseKeysOf.get(id) || []).map((k) => {
      const cp = C[k]; const other = cp.p1 === id ? cp.p2 : cp.p1;
      return rel(other, "spouse", false, { marriage: cp.marriage ?? null, affinity: "marriage — not a blood relationship" });
    }));
    // grandparents deduped: pedigree collapse keeps ONE entry per ancestor
    const gp = [];
    for (const par of resolvedParents(id)) for (const g of resolvedParents(par)) gp.push(rel(g, "grandparent", true, { viaParent: par }));
    const grandparents = dedupeById(gp);
    return {
      id,
      parents, ghostParents: ghosts, children, siblings, spouses, grandparents,
      oneParentRecord: parents.length === 1 && ghosts.length === 0,
      cyclicAncestry: core.cyclicAncestryOf(id), // the resolver's own cycle map — one Tarjan, no duplicate
    };
  }

  // coverage honesty — distinguishes "no children recorded" from "not in this
  // public projection". The public corpus publishes the bloodline + first
  // spouses only; in-law deep lines and living persons stay private-side.
  function coverage(id) {
    if (!P[id]) return null;
    const childCount = (childIndexOf.get(id) || []).filter((c) => P[c]).length;
    return {
      publishedChildren: childCount,
      childCoverage: childCount ? "published-children" : "none-published",
      childNote: childCount
        ? null
        : "no published children — either none recorded, or the branch lives outside this public projection (in-law deep lines and living persons are private-side). A missing branch is not “this person had no children”.",
      ghostParentRefs: ghostParents(id),
      parentRecordState: parentsState(id),
    };
  }
  function parentsState(id) {
    const ps = E[id] || [];
    const resolved = ps.filter((x) => P[x]).length;
    if (ps.length === 0) return { state: "no-parent-record", note: "no parent record imported for this person — absence of a record is not a statement about the family" };
    if (resolved < ps.length) return { state: "partially-resolved", resolved, referenced: ps.length, note: "some parent records are referenced but not fetched (ghost frontier)" };
    return { state: "resolved", resolved };
  }

  // ── person panel data — records and attributed family material ────────────
  // The panel is the archive read model for one person: identity, evidence,
  // relatives, coverage, and the attribution-separated layers (records /
  // tradition / testimony / meaning) from the staged object when present.
  // Reconstructions ride along read-only; preview() never mutates current.
  function personPanel(id) {
    if (!P[id]) return null;
    const so = staged(id);
    const r = relativesOf(id);
    const panel = {
      schema: ARCHIVE_SCHEMA,
      id,
      identity: {
        internalId: so?.internalId ?? id,
        name: so?.identity?.name ?? P[id].name,
        lifespan: so?.identity?.lifespan ?? P[id].lifespan ?? null,
        gender: P[id].gender ?? null,
        bnr: so?.bnr ?? null,
        refs: (P[id].refs || (so?.refs ?? [])),
      },
      evidence: ev(id), // era and support stay separate; no confidence score exists here
      research: so?.research ?? P[id].research ?? null,
      publication: so?.publication ?? P[id].publication ?? null,
      onSpine: so?.onSpine ?? null,
      living: !!P[id].living,
      relatives: r,
      coverage: coverage(id),
      onBloodline: core.bloodlineSet().has(id), // parentward ancestry from the root (memoized, shared with the core)
      layers: so?.layers ?? null, // records / tradition / testimony / meaning — attribution intact
      layersSource: so ? "staged-object" : "corpus-only",
      reconstruction: reconstructionFor(id),
      generatedFrom: so?.generatedFrom ?? "corpus",
    };
    return panel;
  }
  function reconstructionFor(id) {
    if (!recon) return null;
    const touches = (obj) => Object.keys(obj?.choices || {}).some((k) => k.split("|").includes(id));
    if (!touches(recon.current) && !(recon.versions || []).some(touches)) return null;
    return {
      disputed: true,
      law: recon.law ?? null,
      current: { id: recon.current.id, date: recon.current.date, author: recon.current.author, choices: { ...recon.current.choices }, note: recon.current.note ?? null },
      versions: (recon.versions || []).map((v) => ({ id: v.id, date: v.date, author: v.author, note: v.note ?? null })),
      // read-only preview of a competing version — choosing stays a founder act
      preview: (versionId) => {
        const v = (recon.versions || []).find((x) => x.id === versionId);
        if (!v) return null;
        return { versionId: v.id, date: v.date, author: v.author, choices: { ...v.choices }, note: v.note ?? null, note2: "PREVIEW ONLY — previewing does not change the chosen reconstruction" };
      },
    };
  }

  // ── inventory — every count derived from the actual loaded corpus ─────────
  function inventory() {
    const ids = Object.keys(P);
    let livingStubs = 0;
    for (const id of ids) if (P[id].living) livingStubs++;
    let noEdge = 0, one = 0, two = 0, dangling = 0; const danglingTargets = new Set();
    for (const id of ids) {
      const ps = E[id] || [];
      if (!ps.length) noEdge++;
      else if (ps.length === 1) one++;
      else two++;
      for (const t of ps) if (!P[t]) { dangling++; danglingTargets.add(t); }
    }
    // cyclic counts read from the resolver's own cycle map — one Tarjan total
    let cyclicComponentsN = 0, cyclicPersonIdsN = 0;
    const seenComps = new Set();
    for (const id of ids) {
      const ca = core.cyclicAncestryOf(id);
      if (!ca) continue;
      cyclicPersonIdsN++;
      const key = ca.component.join(",");
      if (!seenComps.has(key)) { seenComps.add(key); cyclicComponentsN++; }
    }
    let stagedCount = null;
    if (personsDir) { try { stagedCount = readdirSync(personsDir).filter((f) => f.endsWith(".json")).length; } catch { stagedCount = null; } }
    return {
      schema: model.schema,
      root: model.root,
      counts: {
        persons: ids.length,
        edges: Object.keys(E).length,
        couples: Object.keys(C).length,
        bloodlineParentward: core.bloodlineSet().size, // the OLD reach — ancestors only
        livingStubs,
        cyclicComponents: cyclicComponentsN,
        cyclicPersonIds: cyclicPersonIdsN,
      },
      parentShape: { noParentRecord: noEdge, oneParentRecord: one, twoPlusParentRecord: two },
      ghostFrontier: { danglingReferences: dangling, distinctUnfetchedTargets: danglingTargets.size },
      identity: registry
        ? { registrySchema: registry.schema, issued: Object.keys(registry.issued || {}).length, aliases: Object.keys(registry.aliases || {}).length }
        : { registrySchema: null, issued: ref2id.size, aliases: 0 },
      stagedObjects: stagedCount,
      reconciliation: model.meta?.reconciliation ?? null, // why each non-public person is absent — nobody silently disappears
      claimPolicy: model.meta?.claimPolicy ?? null,
    };
  }

  // ── public-artifact privacy + integrity gate ──────────────────────────────
  // model.validate({public:true}) + archive-level leak checks (provider refs
  // must never ride a living person; every ref index target must resolve).
  // The ghost frontier (parents referenced but not fetched) is a DESIGNED,
  // published coverage state — reported here as its own count, cross-checked
  // against the resolver's own dangling count, and never treated as a privacy
  // failure. Nothing is silenced; the classes just never get conflated.
  function validatePublic() {
    const raw = modelValidate(model, { public: true });
    const ghostReported = raw.filter((p) => p.startsWith("unresolved:"));
    const problems = raw.filter((p) => !p.startsWith("unresolved:"));
    let danglingHere = 0;
    for (const ps of Object.values(E)) for (const t of ps) if (!P[t]) danglingHere++;
    for (const id of Object.keys(P)) {
      const p = P[id];
      if (p.living) {
        if ((p.refs || []).length) problems.push(`archive: living person ${id} carries provider refs (leak)`);
        if (p.sourceId) problems.push(`archive: living person ${id} carries a source id (leak)`);
      }
    }
    for (const [ref, id] of ref2id.entries()) {
      if (!P[id]) problems.push(`archive: ref ${ref} points at missing person ${id}`);
      else if (P[id].living) problems.push(`archive: ref ${ref} resolves to a living person (leak)`);
    }
    for (const child of Object.keys(E)) if (!P[child]) problems.push(`archive: edge child ${child} is not a person`);
    if (ghostReported.length !== danglingHere)
      problems.push(`archive: ghost-frontier disagreement — model reports ${ghostReported.length}, archive counts ${danglingHere}`);
    return { ok: problems.length === 0, problems, ghostFrontier: { reportedByModel: ghostReported.length, countedHere: danglingHere } };
  }

  return {
    schema: ARCHIVE_SCHEMA,
    model,
    resolve: core.resolve, relationshipPath: core.relationshipPath,
    relativesOf, coverage,
    personPanel, inventory, validatePublic,
    searchNames: core.searchNames,
    bloodlineSet: core.bloodlineSet,
  };
}
