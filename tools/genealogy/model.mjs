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
//
// CULTURE LAW — cultureClaims is an optional layer field (it rides through
// addPerson untouched): [{ kind, value, from?, to?, source, sourceId?, note? }].
// Every claim is bound to ONE person and, when dated, to an interval inside
// that person's life — never a modern flattening. A claim is an assertion a
// record makes, so it carries its own source; language is never inferred
// from nationality, surname, place, or modern borders, and a source that
// names itself a derivation is refused as no source at all.

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

// the one year reader lives in surfaces/lifespan.mjs (shared with the panel)
import { birthYear, deathYear } from "../../surfaces/lifespan.mjs";
export { birthYear, deathYear };

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

export const CLAIM_KINDS = ["language", "people", "polity", "religion", "region", "house", "title"];
const CLAIM_KEYS = ["kind", "value", "from", "to", "source", "sourceId", "note"];
const DERIVED_SOURCE = /^\s*(inferred|derived|assumed|heuristic|guess)/i;

// Problems with one person's cultureClaims (empty = ok). from/to are signed
// years (BC negative, as birthYear). Unsourced claims are tolerated in a raw
// working model and refused in a public one.
export function claimProblems(id, person, { public: isPublic = false } = {}) {
  const claims = person.cultureClaims;
  if (claims === undefined) return [];
  if (!Array.isArray(claims)) return [`person ${id}: cultureClaims must be an array`];
  const out = [];
  const b = birthYear(person.lifespan), d = deathYear(person.lifespan);
  claims.forEach((c, i) => {
    const at = `person ${id}: cultureClaims[${i}]`;
    if (!c || typeof c !== "object") { out.push(`${at} is not an object`); return; }
    for (const k of Object.keys(c)) if (!CLAIM_KEYS.includes(k)) out.push(`${at}: unknown key ${k}`);
    if (!CLAIM_KINDS.includes(c.kind)) out.push(`${at}: unknown kind ${c.kind}`);
    if (typeof c.value !== "string" || !c.value.trim()) out.push(`${at}: no value`);
    for (const k of ["from", "to"])
      if (c[k] !== undefined && !Number.isInteger(c[k])) out.push(`${at}: ${k} must be an integer year`);
    if (Number.isInteger(c.from) && Number.isInteger(c.to) && c.from > c.to) out.push(`${at}: from ${c.from} after to ${c.to}`);
    if (Number.isInteger(c.from) && d !== null && c.from > d) out.push(`${at}: begins ${c.from}, after the person's death ${d}`);
    if (Number.isInteger(c.to) && b !== null && c.to < b) out.push(`${at}: ends ${c.to}, before the person's birth ${b}`);
    const sourced = typeof c.source === "string" && c.source.trim() && !DERIVED_SOURCE.test(c.source);
    if (typeof c.source === "string" && DERIVED_SOURCE.test(c.source)) out.push(`${at}: source "${c.source}" is a derivation, not a source`);
    else if (isPublic && !sourced) out.push(`${at}: unsourced claim in a public artifact`);
  });
  if (isPublic && person.living && claims.length) out.push(`person ${id}: living stub carries cultureClaims (leak)`);
  return out;
}

const PERSON_KNOWN_KEYS =["id", "name", "lifespan", "gender", "living", "source", "sourceId", "evidence", "note"];

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

// ── lines: one graph, several starting roots. model.roots is the PRIVATE
// mapping { founder, "spouse-1", … } → person id; it never ships. A public
// artifact carries `lines` instead: a neutral label, the root stub, and the
// first deceased ancestors each line emerges at — the labels are derived from
// the key, so no spouse can be named by a label until this law changes.
export const LINE_KEY = /^(founder|spouse-[1-9]\d*)$/;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export function lineLabel(key) {
  if (key === "founder") return "Founder line";
  const n = parseInt(key.slice(7), 10);
  return `Spouse line ${ROMAN[n - 1] ?? n}`;
}
export function roots(model) {
  const out = model.root ? { founder: model.root } : {};
  for (const [k, id] of Object.entries(model.roots || {})) if (k !== "founder") out[k] = id;
  return out;
}
// every person reachable parent-ward from start, start included
function lineFrom(model, start) {
  const seen = new Set();
  let frontier = model.persons[start] ? [start] : [];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const p of (model.edges[id] || [])) if (model.persons[p]) next.push(p);
    }
    frontier = next;
  }
  return seen;
}
// where a line leaves the living: the nearest deceased ancestor on every
// parent path, and how many living generations the widest path crosses first
export function emergence(model, start) {
  const entries = [], seen = new Set();
  let bridge = 0, depth = 0;
  let frontier = model.persons[start] ? [start] : [];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!model.persons[id].living) { entries.push(id); continue; }
      bridge = Math.max(bridge, depth + 1);
      for (const p of (model.edges[id] || [])) if (model.persons[p]) next.push(p);
    }
    frontier = next;
    depth++;
  }
  return { entries: entries.sort(), bridge };
}

// ── privacy: redact the living. In a PUBLIC artifact, living persons on a
// ROOT'S OWN LINE survive as anonymous "Living" stubs (name only — no dates,
// no source ids) so the bloodline remains climbable from each root to the
// deceased generations; living persons OFF every root line are dropped
// entirely. A couple of two living stubs on different lines is dropped too:
// spouse lines are separate rooted trees, never silently joined in public.
export function privatize(model) {
  const out = createModel({ root: model.root, source: model.source });
  out.meta = { ...model.meta, privacy: "living redacted to anonymous stubs on the root lines; all other living dropped — no names, dates, or source ids" };
  const lineSets = Object.entries(roots(model)).map(([key, id]) => [key, id, lineFrom(model, id)]);
  const onRootLine = new Set(lineSets.flatMap(([, , s]) => [...s]));
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
  const sameLine = (a, b) => lineSets.some(([, , s]) => s.has(a) && s.has(b));
  for (const [k, c] of Object.entries(model.couples)) {
    if (!out.persons[c.p1] || !out.persons[c.p2]) continue;
    if (out.persons[c.p1].living && out.persons[c.p2].living && !sameLine(c.p1, c.p2)) continue;
    addCouple(out, c.p1, c.p2, c.marriage);
  }
  if (model.roots)
    out.lines = lineSets.map(([key, id]) => ({ key, label: lineLabel(key), root: id, ...emergence(model, id) }));
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
// { public:true } additionally enforces the privacy law (a living person may
// appear only as an anonymous root-line stub — no name, dates, provider id or
// claims), refuses unsourced culture claims, and refuses the private roots
// mapping; raw models may carry living persons
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
    problems.push(...claimProblems(id, p, { public: isPublic }));
  }
  if (model.roots !== undefined) {
    if (isPublic) problems.push("roots is the private line mapping — a public artifact carries lines");
    for (const [k, id] of Object.entries(model.roots || {})) {
      if (!LINE_KEY.test(k)) problems.push(`roots: bad line key ${k}`);
      if (!P[id]) problems.push(`roots: ${k} -> ${id} missing from persons`);
      if (k === "founder" && id !== model.root) problems.push(`roots: founder ${id} is not the model root ${model.root}`);
    }
  }
  for (const [i, l] of (model.lines || []).entries()) {
    if (!LINE_KEY.test(l.key || "")) { problems.push(`lines[${i}]: bad line key ${l.key}`); continue; }
    if (l.label !== lineLabel(l.key)) problems.push(`lines[${i}]: label "${l.label}" is not the neutral "${lineLabel(l.key)}"`);
    if (!P[l.root]) problems.push(`lines[${i}]: root ${l.root} missing from persons`);
    for (const e of l.entries || [])
      if (!P[e] || P[e].living) problems.push(`lines[${i}]: entry ${e} is not a deceased person`);
  }
  for (const [child, ps] of Object.entries(model.edges)) {
    if (!P[child]) problems.push(`edge from non-person ${child}`);
    for (const p of ps) if (!P[p]) problems.push(`unresolved: edge ${child} -> ${p} (parent referenced, record not fetched)`);
  }
  for (const [k, c] of Object.entries(model.couples)) {
    if (k !== [c.p1, c.p2].sort().join("|")) problems.push(`couple key mismatch ${k}`);
    if (!P[c.p1] || !P[c.p2]) problems.push(`couple ${k} references missing person`);
  }
  for (const comp of cyclicComponents(model)) {
    problems.push(`cycle-component: ${comp.join(",")}`);
    const w = cycleWitness(model, comp);
    if (w) problems.push(`witness: ${w.join(" -> ")}`);
  }
  return problems;
}

// ── parent-graph cycles. A person can never be their own ancestor, so every
// strongly connected component of the child→parent graph with more than one
// member (or a self-edge) is a defect. Only edges between existing persons
// count — dangling parents are already reported as unresolved:.
// Returns components as sorted id arrays, ordered by their lowest id.
function parentsOf(model, id) {
  return (model.edges[id] || []).filter((p) => model.persons[p]);
}
function cyclicComponents(model) {
  // iterative Tarjan — the medieval web is deep enough to threaten recursion
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], out = [];
  let next = 0;
  for (const start of Object.keys(model.persons).sort()) {
    if (index.has(start)) continue;
    const work = [[start, 0]];
    index.set(start, next); low.set(start, next); next++;
    stack.push(start); onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1];
      const [v, i] = frame;
      const ps = parentsOf(model, v);
      if (i < ps.length) {
        frame[1]++;
        const w = ps[i];
        if (!index.has(w)) {
          index.set(w, next); low.set(w, next); next++;
          stack.push(w); onStack.add(w);
          work.push([w, 0]);
        } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
        continue;
      }
      work.pop();
      if (work.length) {
        const u = work[work.length - 1][0];
        low.set(u, Math.min(low.get(u), low.get(v)));
      }
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1 || parentsOf(model, v).includes(v)) out.push(comp.sort());
      }
    }
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
// A real cycle through the component's lowest id, walked child→parent over
// existing edges only: breadth-first (shortest), parents tried lowest first.
// Returns [start, …, start], or null rather than a fabricated chain.
function cycleWitness(model, comp) {
  const inComp = new Set(comp);
  const start = comp[0];
  const prev = new Map();
  let frontier = [start];
  while (frontier.length) {
    const nextFrontier = [];
    for (const v of frontier) {
      for (const p of parentsOf(model, v).filter((x) => inComp.has(x)).sort()) {
        if (p === start) {
          const chain = [start];
          for (let c = v; c !== start; c = prev.get(c)) chain.push(c);
          return [start, ...chain.slice(1).reverse(), start];
        }
        if (!prev.has(p)) { prev.set(p, v); nextFrontier.push(p); }
      }
    }
    frontier = nextFrontier;
  }
  return null;
}
