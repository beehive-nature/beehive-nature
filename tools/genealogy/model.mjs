// ── the Beehive genealogy model · skaists.lineage/2 ─────────────────────────
// Pure data model. NO FamilySearch knowledge lives here (that is fs-adapter.mjs),
// no GEDCOM syntax (gedcom.mjs), no UI. The model carries three things the
// founder ordered carried EXPLICITLY: provenance (source ids), evidence class
// (saga is never equal to documented), and privacy (living-person redaction).
//
// Person:  { name, lifespan, gender:"M"|"F"|null, living:boolean,
//            source?:string, sourceId?:string,
//            evidence:{ era:"recorded"|"colonial"|"medieval"|"saga"|"living"|"unrecorded",
//                       support:"sourced"|"attested"|"unsourced-entry",
//                       basis:string } }
// Edges:   childId -> [parent1Id, parent2Id?]   (blood-parent links only)
// Couples: "p1|p2" -> { marriage?:string }
//
// EVIDENCE LAW v2.1 — era and support are SEPARATE AXES:
//  · era is a historical-period label (derived from dates) — descriptive only;
//  · support is evidential standing — NEVER derived from a date. It upgrades
//    only when sources are actually harvested ("sourced") or the founder
//    attests ("attested"). Default "unsourced-entry" says so honestly.
// A date or source count must not silently become a confidence verdict.

export const SCHEMA = "skaists.lineage/2";
export const FSID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;

export function createModel({ root, source } = {}) {
  return {
    schema: SCHEMA,
    root: root ?? null,
    source: source ?? null,
    persons: {},
    edges: {},
    couples: {},
    meta: { generated: new Date().toISOString().slice(0, 10) },
  };
}

// A lifespan reads "<birth>–<death>"; either end may be absent
// ("–1187BC", "1931–Deceased") and a year is 1-4 digits with an optional
// BC suffix. BC is carried as a negative integer: sign only, with no
// astronomical year zero, so -1 is 1 BC and the next year is +1. 123
// lifespans in the public bloodline cross that boundary (6 are born
// 0001BC); none of the three consumers subtracts the two years - they
// compare (evidenceClass, the spine reduce) and export (gedcom). A future
// caller that measures a duration across the boundary must add one.
const signed = (m) => (m[2] ? -parseInt(m[1], 10) : parseInt(m[1], 10));
export function birthYear(lifespan) {
  const m = String(lifespan || "").match(/^(\d{1,4})(BC)?/);
  return m ? signed(m) : null;
}
export function deathYear(lifespan) {
  const m = String(lifespan || "").match(/–\s*(\d{1,4})(BC)?/);
  return m ? signed(m) : null;
}

// era heuristic — the honest default until sources are harvested
export function evidenceClass(person) {
  if (person.living) return "living";
  const b = birthYear(person.lifespan);
  if (b === null) return "unrecorded";
  if (b >= 1850) return "recorded";
  if (b >= 1550) return "colonial";
  if (b >= 1000) return "medieval";
  return "saga";
}

const PERSON_KNOWN_KEYS = ["id", "name", "lifespan", "gender", "living", "source", "sourceId", "evidence", "note"];

export function addPerson(model, p) {
  if (!p || typeof p.id !== "string" || !p.name) return false;
  const prev = model.persons[p.id];
  const ev = p.evidence || {};
  const entry = {
    name: p.name,
    lifespan: p.lifespan ?? null,
    gender: p.gender ?? null,
    living: !!p.living,
    ...(p.source ? { source: p.source } : {}),
    ...(p.sourceId ? { sourceId: p.sourceId } : {}),
    evidence: {
      era: ev.era || evidenceClass(p),           // historical-period label
      support: ev.support || "unsourced-entry",  // evidential standing — never date-derived
      basis: ev.basis || "era label from dates; support unsourced until sources are harvested",
      // `class` kept as a read-only alias of era for existing renderers
      class: ev.era || evidenceClass(p),
      ...(ev.upgradedBy ? { upgradedBy: ev.upgradedBy } : {}),
    },
    ...((prev?.note || p.note) ? { note: prev?.note || p.note } : {}),
  };
  // layer fields ride along untouched: evidencePack, relation, corrected, …
  for (const k of Object.keys(p))
    if (!PERSON_KNOWN_KEYS.includes(k) && p[k] !== undefined && p[k] !== null) entry[k] = p[k];
  model.persons[p.id] = entry;
  return true;
}

export function addEdge(model, childId, parentIds) {
  // parent targets MAY be ids not yet present as persons — the adapter's
  // "ghost frontier" depends on dangling-but-recorded references so the walker
  // knows who to expand next. validate() reports these as unresolved:, never
  // silently drops them.
  const ps = [...new Set(parentIds)].filter((x) => typeof x === "string" && x);
  if (childId && model.persons[childId] && ps.length) model.edges[childId] = ps;
}

export function addCouple(model, p1, p2, marriage) {
  if (!model.persons[p1] || !model.persons[p2]) return;
  const key = [p1, p2].sort().join("|");
  if (!model.couples[key]) model.couples[key] = { p1, p2, ...(marriage ? { marriage } : {}) };
}

// bloodline = every person reachable parent-ward from root (unresolved ghost
// targets are skipped naturally — only real persons join the set)
export function bloodline(model) {
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

export function depths(model, fromId) {
  const start = fromId && model.persons[fromId] ? fromId : model.root;
  const d = start ? { [start]: 0 } : {};
  let frontier = start ? [start] : [];
  while (frontier.length) {
    const next = [];
    for (const id of frontier)
      for (const p of (model.edges[id] || []))
        if (d[p] === undefined && model.persons[p]) { d[p] = d[id] + 1; next.push(p); }
    frontier = next;
  }
  return d;
}

// shortest root→target parent-chain (ids, root first). Null when unreachable.
// viaIds: optional waypoint chain — each via must be an ancestor of the next —
// pinning the route when the collapsed medieval web offers several
// equal-length shortest paths (the founder's canonical line is a CHOICE).
export function spine(model, targetId, viaIds) {
  const vias = Array.isArray(viaIds) ? viaIds.filter((v) => model.persons[v]) : [];
  const waypoints = [...vias, targetId];
  const segments = [];
  let covered = [model.root];
  for (let i = 0; i < waypoints.length; i++) {
    const seg = segment(model, waypoints[i], i === 0 ? model.root : waypoints[i - 1]);
    if (!seg) return null;
    segments.push(seg);
    covered = covered.concat(seg);
  }
  // stitch: root + [root..W1) + (W1..W2] + … — each segment excludes its start
  return [model.root, ...segments.flat()];
}
function segment(model, targetId, startId) {
  const d = depths(model, startId);
  if (d[targetId] === undefined) return null;
  if (targetId === startId) return [];
  const chain = [];
  let cur = targetId;
  while (cur !== startId) {
    chain.push(cur);
    cur = towardRoot(model, d, cur);
    if (cur === undefined) return null;
  }
  return chain.reverse();
}
// edges point child→parents, so one step toward root = the child (depth-1)
// whose parent list includes the current person
function towardRoot(model, d, id) {
  for (const [c, ps] of Object.entries(model.edges))
    if (d[c] === d[id] - 1 && ps.includes(id) && model.persons[c]) return c;
  return undefined;
}

// ── privacy: redact the living. In a PUBLIC artifact, living persons on the
// ROOT'S OWN LINE survive as anonymous "Living" stubs (name only — no dates,
// no source ids) so the bloodline remains climbable from the founder to the
// deceased generations; living persons OFF the root line are dropped entirely.
export function privatize(model) {
  const out = createModel({ root: model.root, source: model.source });
  out.meta = { ...model.meta, privacy: "living redacted to anonymous stubs on the root line; all other living dropped — no names, dates, or source ids" };
  const onRootLine = new Set();
  if (model.root) {
    let frontier = [model.root];
    while (frontier.length) {
      const next = [];
      for (const id of frontier) {
        if (onRootLine.has(id)) continue;
        onRootLine.add(id);
        for (const p of (model.edges[id] || [])) if (model.persons[p]) next.push(p);
      }
      frontier = next;
    }
  }
  let redacted = 0;
  for (const [id, p] of Object.entries(model.persons)) {
    if (!p.living) { addPerson(out, { ...p, id }); continue; }
    if (onRootLine.has(id)) {
      out.persons[id] = { name: "Living", lifespan: null, gender: p.gender ?? null,
        living: true, evidence: { era: "living", support: "unsourced-entry", class: "living", basis: "redacted stub" } };
    } else redacted++;
  }
  for (const [child, ps] of Object.entries(edgesWithin(model, out)))
    addEdge(out, child, ps);
  for (const [k, c] of Object.entries(model.couples))
    if (out.persons[c.p1] && out.persons[c.p2]) addCouple(out, c.p1, c.p2, c.marriage);
  out.meta.livingRedacted = redacted;
  out.meta.livingStubs = [...onRootLine].filter((id) => model.persons[id]?.living).length;
  return out;
}
function edgesWithin(model, filtered) {
  const out = {};
  for (const [child, ps] of Object.entries(model.edges))
    if (filtered.persons[child]) out[child] = ps;
  return out;
}

// ── validation: structural invariants. Returns array of problems (empty = ok).
// { public:true } additionally enforces the privacy law (living persons must
// not exist at all in a public artifact); raw models may carry living persons
// WITH source ids at full fidelity — they live outside the repo.
export function validate(model, { public: isPublic = false } = {}) {
  const problems = [];
  const P = model.persons;
  if (model.schema !== SCHEMA) problems.push(`schema mismatch: ${model.schema}`);
  if (!model.root) problems.push("no root");
  else if (!P[model.root]) problems.push(`root ${model.root} missing from persons`);
  for (const [id, p] of Object.entries(P)) {
    if (!p.name) problems.push(`person ${id}: no name`);
    if (!p.evidence?.era && !p.evidence?.class) problems.push(`person ${id}: no evidence era`);
    if (!p.evidence?.support) problems.push(`person ${id}: no evidence support`);
    if (isPublic && p.living && (p.name !== "Living" || p.lifespan || p.sourceId))
      problems.push(`person ${id}: living in a public artifact must be an anonymous root-line stub (no dates, no source id)`);
    if (isPublic && p.living && FSID.test(id))
      problems.push(`person ${id}: living stub retains a provider identifier (leak)`);
  }
  for (const [child, ps] of Object.entries(model.edges)) {
    if (!P[child]) problems.push(`edge from non-person ${child}`);
    for (const p of ps) if (!P[p]) problems.push(`unresolved: edge ${child} -> ${p} (parent referenced, record not fetched)`);
  }
  for (const [k, c] of Object.entries(model.couples)) {
    if (k !== [c.p1, c.p2].sort().join("|")) problems.push(`couple key mismatch ${k}`);
    if (!P[c.p1] || !P[c.p2]) problems.push(`couple ${k} references missing person`);
  }
  return problems;
}
