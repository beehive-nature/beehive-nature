// ── zGeneArchive core · GUX-01 · the browser-importable pure resolver ───────
// ONE LAW (founder ruling bdf59735): "one relationship resolver, two
// environments" — NOT "move archive.mjs into surfaces". This file owns the
// relationship resolver and exactly what it genuinely needs; everything else
// stays in the node wrapper (tools/genealogy/archive.mjs), which remains the
// archive's construction layer: fs loaders, staged objects, reconstructions,
// the privacy/integrity gate, and the F3 duplicate-provider-ref construction
// law. The core TRUSTS ITS INPUT: it receives an already-validated, indexed
// model and never re-becomes a corpus loader.
//
// CONTRACT (founder-named): createArchiveCore(model) →
//   relationshipPath(a, b) — blood = monotone climb-then-descend through a
//     COMMON ANCESTOR; co-parent V-shapes are affinity, never blood; spouse
//     steps are affinity by definition; cycle-crossing paths carry disputed.
//   bloodlineSet() — the parentward bloodline from the model root (memoized).
//   resolve(query) — canonical lookup by internal id, provider ref, registry
//     alias, or exact name; ambiguity reported with candidates, never silent.
//   searchNames(q, limit) — included because its only data dependency is the
//     person table the resolver already owns (founder: "only if naturally
//     part of that same immutable core" — it is).
//   cyclicAncestryOf(id) — one read of the resolver's own cycle map (built
//     for disputed flags); exposed so the wrapper's panel consumes it instead
//     of owning a second Tarjan. Not an invitation to grow the surface.
//
// This file imports NOTHING (no node:*, no model.mjs, no peers) — it runs
// identically in node and in a browser page <script type="module">. The
// bloodline walk mirrors model.mjs's bloodline() law verbatim (the core
// cannot import it, so the law is ported, not reinvented). Read-only: nothing
// here writes, nothing here re-issues identity, no provider name lives here.

export const ARCHIVE_CORE_SCHEMA = "skaists.archive-core/1";

export function createArchiveCore(model, opts = {}) {
  if (!model || !model.persons) throw new Error("createArchiveCore: no lineage model (parsed model object required)");
  const registry = opts.registry ?? null;

  const P = model.persons;
  const E = model.edges || {};
  const C = model.couples || {};

  // provider-ref index — TRUSTED INPUT: corpus refsIndex if present, else the
  // persons' own refs. Duplicate-ref collisions are the CONSTRUCTION layer's
  // law (the wrapper's loadArchive throws on them before this core exists);
  // a model that reaches this core is already validated.
  const ref2id = new Map();
  if (model.refsIndex) for (const [ref, id] of Object.entries(model.refsIndex)) ref2id.set(ref, id);
  else for (const [id, p] of Object.entries(P)) for (const r of p.refs || []) ref2id.set(r.id ?? r, id);
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

  // memoized parentward bloodline (the model's own law, ported verbatim):
  // one compute per core.
  let _bloodlineSet = null;
  const bloodlineSet = () => (_bloodlineSet ??= bloodlineParentward(model));

  // ── canonical lookup ───────────────────────────────────────────────────────
  // One person, one identity: a repeated ancestor resolves to the same id
  // from every line. Ambiguity is REPORTED (with candidates), never silently
  // resolved.
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

  // ── relationship path — blood means a COMMON ANCESTOR, cycles safe ─────────
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

  // one read of the resolver's own cycle map (built for disputed flags) —
  // the wrapper's panel consumes this instead of owning a second Tarjan.
  function cyclicAncestryOf(id) {
    const compIdx = cycleMember.get(id);
    return compIdx === undefined ? null : { component: cyclic[compIdx], note: "this person sits inside a cyclic ancestry component — lineage here is disputed/unresolved upstream, not a settled fact" };
  }

  // name search — substring, case-insensitive, deterministic, capped. Its
  // only data dependency is the person table the resolver already owns.
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
    schema: ARCHIVE_CORE_SCHEMA,
    relationshipPath, bloodlineSet, resolve, searchNames, cyclicAncestryOf,
  };
}

// ── cycles: iterative Tarjan over child→parent edges (existing persons only).
// Same contract as the model's diagnostics; kept local and pure so the core
// works against any parsed model regardless of the model module's state.
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

// parentward bloodline — VERBATIM PORT of model.mjs's bloodline() law:
// every person reachable parent-ward from root (unresolved ghost targets are
// skipped naturally — only real persons join the set; the root is included).
function bloodlineParentward(model) {
  const out = new Set();
  if (!model.root || !model.persons[model.root]) return out;
  out.add(model.root);
  let frontier = [model.root];
  while (frontier.length) {
    const next = [];
    for (const id of frontier)
      for (const p of model.edges[id] || [])
        if (!out.has(p) && model.persons[p]) { out.add(p); next.push(p); }
    frontier = next;
  }
  return out;
}
