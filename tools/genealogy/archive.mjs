// ── zGeneArchive · GUX-01 slice 1 — read-only archive graph access ───────────
// Whole-tree family atlas, trust layer. Wraps a PUBLISHED skaists.lineage/2
// corpus (+ its sidecars: identity registry, reconstructions, staged person
// objects) and answers the questions the atlas UI asks — without mutating
// anything and without inventing certainty.
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
// Zero dependencies. Node 18+.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { validate as modelValidate, bloodline } from "./model.mjs";

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

  // provider-ref index: corpus refsIndex if present, else built from persons
  // provider-ref index: corpus refsIndex if present, else built from persons.
  // Guard: a provider ref must never resolve to two different persons --
  // collisions fail the load (named, capped) instead of last-wins silently.
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
  // name index (case-insensitive) — lazily built exact map
  const name2ids = new Map();
  for (const [id, p] of Object.entries(P)) {
    const k = String(p.name || "").toLowerCase();
    if (!k) continue;
    if (!name2ids.has(k)) name2ids.set(k, []);
    name2ids.get(k).push(id);
  }

  // child index (who names X as a parent) — reversed edges, sorted for determinism
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

  const cyclic = cyclicComponents(model); // [[ids]] — own Tarjan, cycle-safe
  const cycleMember = new Map(); // id -> component index
  cyclic.forEach((comp, i) => comp.forEach((id) => cycleMember.set(id, i)));

  // memoized parentward bloodline (the model's own law): one compute per
  // archive; personPanel().onBloodline and inventory() share it.
  let _bloodlineSet = null;
  const bloodlineSet = () => (_bloodlineSet ??= bloodline(model));

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

  // ── canonical lookup ──────────────────────────────────────────────────────
  // Accepts: internal id, provider ref, or exact name. One person, one
  // identity: a repeated ancestor resolves to the same id from every line.
  // Ambiguity is REPORTED (with candidates), never silently resolved.
  function resolve(query) {
    const q = String(query ?? "").trim();
    if (!q) return null;
    if (P[q]) return { id: q, person: P[q], matched: "id" };
    if (ref2id.has(q)) { const id = ref2id.get(q); return P[id] ? { id, person: P[id], matched: "provider-ref" } : null; }
    // registry alias: a changed provider ref redirecting to its canonical entry
    if (registry?.aliases && registry.aliases[q]) {
      const canonical = registry.aliases[q];
      const id = registry.issued?.[canonical] ?? (P[canonical] ? canonical : null);
      if (id && P[id]) return { id, person: P[id], matched: "registry-alias" };
    }
    const byName = name2ids.get(q.toLowerCase());
    if (byName) {
      if (byName.length === 1) return { id: byName[0], person: P[byName[0]], matched: "name" };
      return { ambiguous: true, matched: "name", candidates: byName.slice().sort().map((id) => ({ id, name: P[id].name, lifespan: P[id].lifespan ?? null })) };
    }
    return null;
  }

  // ── relatives — classified, deduplicated, honest about coverage ──────────
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
    const compIdx = cycleMember.get(id);
    return {
      id,
      parents, ghostParents: ghosts, children, siblings, spouses, grandparents,
      oneParentRecord: parents.length === 1 && ghosts.length === 0,
      cyclicAncestry: compIdx === undefined ? null : { component: cyclic[compIdx], note: "this person sits inside a cyclic ancestry component — lineage here is disputed/unresolved upstream, not a settled fact" },
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
        : "no published children — either none recorded, or the branch lives outside this public projection (in-law deep lines and living persons are private-side). A missing branch is not \u201cthis person had no children\u201d.",
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

  // ── relationship path — blood means a COMMON ANCESTOR, cycles safe ───────
  // Blood kinship = a monotone climb-then-descend path A ↑ X ↓ B where X is
  // an ancestor of BOTH. A path that descends to a shared descendant (V
  // shape: A ↓ C ↑ B) makes the pair CO-PARENTS — partnership, not
  // consanguinity — and is reported as affinity, never blood. Spouse steps
  // are affinity by definition. Paths crossing a cyclic ancestry component
  // carry a disputed flag rather than pretending to be settled fact.
  function relationshipPath(aId, bId) {
    if (!P[aId] || !P[bId]) return { kind: "unknown-person", a: aId, b: bId };
    const blood = bloodPath(aId, bId);
    if (blood) return blood;
    const aff = bfs(aId, bId, true);
    if (aff) {
      const spouseSteps = aff.filter((s) => s.via === "spouse").length;
      let sharedDescendant = false, sawChild = false;
      for (const s of aff.slice(1)) { if (s.via === "child") sawChild = true; else if (s.via === "parent" && sawChild) { sharedDescendant = true; break; } }
      return {
        kind: "affinity", path: aff, spouseSteps, sharedDescendant,
        note: "connected by marriage/partnership — NOT a blood relationship",
        ...(crossesCycle(aff) ? { disputed: true, disputedNote: "path crosses a cyclic ancestry component — unsettled lineage upstream" } : {}),
      };
    }
    return {
      kind: "none", a: aId, b: bId,
      note: "no connection in this public projection" + ((ghostParents(aId).length || ghostParents(bId).length) ? " — ghost-frontier references exist; coverage, not kinship, is the limit" : ""),
      ghostFrontier: { a: ghostParents(aId), b: ghostParents(bId) },
    };
  }
  // climb: BFS upward, cycle-safe, deterministic. Returns Map id -> {dist, prev(child id)}.
  function climb(start) {
    const m = new Map([[start, { dist: 0, prev: null }]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const v of frontier) {
        for (const p of resolvedParents(v).slice().sort()) {
          if (!m.has(p)) { m.set(p, { dist: m.get(v).dist + 1, prev: v }); next.push(p); }
        }
      }
      frontier = next;
    }
    return m;
  }
  function bloodPath(aId, bId) {
    const upA = climb(aId), upB = climb(bId);
    const common = [...upA.keys()].filter((x) => upB.has(x));
    if (!common.length) return null;
    let best = null;
    for (const x of common) {
      const total = upA.get(x).dist + upB.get(x).dist;
      if (!best || total < best.total || (total === best.total && x < best.apex)) best = { apex: x, total };
    }
    // reconstruct: a ↑…apex…↓ b
    const upChain = (from, to) => { const ids = []; let cur = to; while (cur !== from) { ids.push(cur); cur = upMapGet(from === aId ? upA : upB, cur); } return ids.reverse(); };
    const path = [{ id: aId, via: null }];
    for (const id of upChain(aId, best.apex)) path.push({ id, via: "parent" });
    // descent apex -> ... -> b: upChain(bId, apex) ENDS at the apex (already
    // pushed by the climb), so drop its last entry and append b itself. When
    // b IS the apex the climb already ended there -- nothing to descend.
    if (best.apex !== bId) {
      const downSide = upChain(bId, best.apex).slice(0, -1).reverse();
      for (const id of downSide) path.push({ id, via: "child" });
      path.push({ id: bId, via: "child" });
    }
    return {
      kind: "blood", path, commonAncestor: best.apex,
      note: best.apex === aId || best.apex === bId ? "direct blood line" : "blood relationship through a shared ancestor",
      ...(crossesCycle(path) ? { disputed: true, disputedNote: "path crosses a cyclic ancestry component — unsettled lineage upstream" } : {}),
    };
  }
  const upMapGet = (m, id) => m.get(id).prev;
  function crossesCycle(path) {
    return path.some((s) => cycleMember.has(s.id));
  }
  function bfs(start, goal, allowSpouses) {
    const prev = new Map([[start, null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const v of frontier) {
        const steps = [];
        for (const p of (E[v] || [])) if (P[p]) steps.push([p, "parent"]);
        for (const c of (childIndexOf.get(v) || [])) if (P[c]) steps.push([c, "child"]);
        if (allowSpouses) for (const k of (spouseKeysOf.get(v) || [])) {
          const cp = C[k]; const other = cp.p1 === v ? cp.p2 : cp.p1;
          if (P[other]) steps.push([other, "spouse"]);
        }
        steps.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)); // deterministic
        for (const [to, via] of steps) {
          if (prev.has(to)) continue;
          prev.set(to, [v, via]);
          if (to === goal) { // reconstruct
            const path = []; let cur = goal;
            while (cur !== start) { const [from, via] = prev.get(cur); path.push({ id: cur, via }); cur = from; }
            path.push({ id: start, via: null });
            return path.reverse();
          }
          next.push(to);
        }
      }
      frontier = next;
    }
    return null;
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
      onBloodline: bloodlineSet().has(id), // parentward ancestry from the root (memoized)
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
    let livingStubs = 0, livingLeaks = [];
    for (const id of ids) {
      const p = P[id];
      if (!p.living) continue;
      livingStubs++;
      if (p.name !== "Living" || p.lifespan || p.sourceId || (p.refs || []).length) livingLeaks.push(id);
    }
    let noEdge = 0, one = 0, two = 0, dangling = 0; const danglingTargets = new Set();
    for (const id of ids) {
      const ps = E[id] || [];
      if (!ps.length) noEdge++;
      else if (ps.length === 1) one++;
      else two++;
      for (const t of ps) if (!P[t]) { dangling++; danglingTargets.add(t); }
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
        bloodlineParentward: bloodlineSet().size, // the OLD reach — ancestors only
        livingStubs,
        cyclicComponents: cyclic.length,
        cyclicPersonIds: cyclic.reduce((a, x) => a + x.length, 0),
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
  // against this module's own dangling count, and never treated as a privacy
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

  // name search — substring, case-insensitive, deterministic, capped.
  // Published corpus only; living persons appear as anonymous stubs.
  function searchNames(query, limit = 25) {
    const q = String(query ?? "").trim().toLowerCase();
    if (q.length < 2) return { query, results: [] };
    const out = [];
    for (const id of Object.keys(P).sort()) {
      const n = String(P[id].name || "").toLowerCase();
      if (n.includes(q)) {
        out.push({ id, name: P[id].name, lifespan: P[id].lifespan ?? null, living: !!P[id].living, exact: n === q });
        if (out.length >= limit) break;
      }
    }
    return { query, results: out, truncatedTo: limit };
  }

  return {
    schema: ARCHIVE_SCHEMA,
    model,
    resolve, relativesOf, coverage, relationshipPath,
    personPanel, inventory, validatePublic, searchNames,
    bloodlineSet,
  };
}

// ── cycles: iterative Tarjan over child→parent edges (existing persons only).
// Same contract as the model's diagnostics; kept local so this module works
// against the lane pin regardless of the G1 patch state.
function cyclicComponents(model) {
  const P = model.persons, E = model.edges || {};
  const par = (id) => (E[id] || []).filter((p) => P[p]);
  const index = new Map(), low = new Map(), on = new Set(), stack = [], out = [];
  let n = 0;
  for (const start of Object.keys(P).sort()) {
    if (index.has(start)) continue;
    const work = [[start, 0]];
    index.set(start, n); low.set(start, n); n++;
    stack.push(start); on.add(start);
    while (work.length) {
      const frame = work[work.length - 1];
      const [v, i] = frame;
      const ps = par(v);
      if (i < ps.length) {
        frame[1]++;
        const w = ps[i];
        if (!index.has(w)) { index.set(w, n); low.set(w, n); n++; stack.push(w); on.add(w); work.push([w, 0]); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      if (low.get(v) === index.get(v)) {
        const comp = []; let w;
        do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1 || par(v).includes(v)) out.push(comp.sort());
      }
    }
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
