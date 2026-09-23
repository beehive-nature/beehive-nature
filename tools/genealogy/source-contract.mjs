// source contract — the ONE evidence path every transport feeds. Standalone:
// model.mjs, pipeline.mjs and the skaists.evidence/1 packs are not touched or
// read here; wiring comes after the contract is proven on its own.
//
// Three objects, kept separate:
//   source  (skaists.source/1)          a held record: who keeps it, how to find it, when it was read
//   claim   (skaists.claim/1)           one assertion about one subject
//   binding (skaists.source-binding/1)  one source, one claim, one relation
// plus `leads`, which are not evidence: hints, tree links and source counts
// land there and nowhere else.
//
// Laws (transport may change; provenance semantics may not):
//  · A hint, a provider tree link, a source count or an AI lead creates NO
//    source. It may create a lead.
//  · A source with no binding upgrades nothing. A source can exist without
//    proving every field beside it.
//  · "supports" upgrades that one claim only. "contradicts" is retained beside
//    it and nothing silently wins. "mentions" is never proof.
//  · Event types are exact: a binding states what the source records there
//    (`asserts`) and that must equal the claim's predicate. A baptism never
//    binds to a birth; a burial never binds to a death.
//  · Private material does not become public because it has a source: the
//    public view is default-deny on anyone not known to be deceased.
//  · Identity is never decided here. Topology can open an investigation;
//    only a founder turns evidence into a merge.

export const SOURCE_SCHEMA = "skaists.source/1";
export const CLAIM_SCHEMA = "skaists.claim/1";
export const BINDING_SCHEMA = "skaists.source-binding/1";

export const SOURCE_TYPES = [
  "parish-register", "civil-register", "census", "probate", "obituary", "newspaper",
  "gravestone", "military", "immigration", "archive-scan", "book", "provider-record", "testimony",
];
// a source type whose entries must be located (page, entry, folio, line) when bound as proof
const LOCATED_TYPES = new Set(["parish-register", "civil-register", "census", "probate", "newspaper", "military", "immigration", "archive-scan", "book"]);
// things that arrive looking like sources and are not
export const NOT_A_SOURCE = ["hint", "record-hint", "tree-link", "tree-person", "source-count", "ai-lead"];

export const EVENT_PREDICATES = ["birth", "baptism", "christening", "death", "burial", "marriage", "divorce", "residence", "immigration", "military-service", "probate"];
export const PREDICATES = [
  ...EVENT_PREDICATES,
  "name", "sex", "occupation", "parent-child", "spouse", "identity",
  "language", "people", "polity", "religion", "region", "house", "title",
];
export const RELATIONS = ["supports", "contradicts", "mentions"];

const SOURCE_KEYS = ["schema", "id", "type", "provider", "title", "recordId", "url", "accessedAt", "digest", "artifactRef", "note"];
const CLAIM_KEYS = ["schema", "id", "subject", "predicate", "value", "note"];
const BINDING_KEYS = ["schema", "sourceId", "claimId", "relation", "asserts", "locator", "note"];
const DERIVED = /^\s*(inferred|derived|assumed|heuristic|guess|ai[\s-])/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

const text = (v) => typeof v === "string" && v.trim() !== "";
const realDay = (v) => {
  const m = typeof v === "string" && v.match(DAY);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const unknownKeys = (o, keys, at) => Object.keys(o).filter((k) => !keys.includes(k)).map((k) => `${at}: unknown key ${k}`);

// a claim subject is a person id, or "a|b" for a relationship between two
export const parties = (subject) => String(subject).split("|");

export function createStore() {
  return { sources: {}, claims: {}, bindings: [], leads: [] };
}

export function sourceProblems(s) {
  const at = `source ${s?.id ?? "?"}`;
  if (!s || typeof s !== "object") return [`${at}: not an object`];
  if (NOT_A_SOURCE.includes(s.type) || NOT_A_SOURCE.includes(s.kind))
    return [`${at}: a ${s.type ?? s.kind} is a lead, not a source`];
  const out = unknownKeys(s, SOURCE_KEYS, at);
  if (s.schema !== SOURCE_SCHEMA) out.push(`${at}: schema must be ${SOURCE_SCHEMA}`);
  if (!text(s.id)) out.push(`${at}: no id`);
  if (!SOURCE_TYPES.includes(s.type)) out.push(`${at}: unknown type ${s.type}`);
  if (!text(s.provider)) out.push(`${at}: no provider (who holds the record)`);
  if (!text(s.title)) out.push(`${at}: no title`);
  for (const k of ["provider", "title"])
    if (text(s[k]) && DERIVED.test(s[k])) out.push(`${at}: ${k} "${s[k]}" is a derivation, not a source`);
  if (!realDay(s.accessedAt)) out.push(`${at}: accessedAt must be a real YYYY-MM-DD day`);
  if (![s.recordId, s.url, s.artifactRef].some(text)) out.push(`${at}: not locatable (needs recordId, url or artifactRef)`);
  if (s.digest !== undefined && !DIGEST.test(s.digest)) out.push(`${at}: digest must be sha256:<64 hex>`);
  if (s.digest !== undefined && !text(s.artifactRef)) out.push(`${at}: a digest claims bytes are held; name them with artifactRef`);
  return out;
}

export function claimProblems(c) {
  const at = `claim ${c?.id ?? "?"}`;
  if (!c || typeof c !== "object") return [`${at}: not an object`];
  const out = unknownKeys(c, CLAIM_KEYS, at);
  if (c.schema !== CLAIM_SCHEMA) out.push(`${at}: schema must be ${CLAIM_SCHEMA}`);
  if (!text(c.id)) out.push(`${at}: no id`);
  if (!text(c.subject) || parties(c.subject).some((p) => !text(p))) out.push(`${at}: no subject`);
  if (!PREDICATES.includes(c.predicate)) out.push(`${at}: unknown predicate ${c.predicate}`);
  const two = text(c.subject) && parties(c.subject).length === 2;
  if (["parent-child", "spouse", "identity"].includes(c.predicate) && !two)
    out.push(`${at}: ${c.predicate} needs a two-party subject "a|b"`);
  if (c.value === undefined || c.value === null || c.value === "") out.push(`${at}: no value`);
  return out;
}

export function bindingProblems(b, store) {
  const at = `binding ${b?.sourceId ?? "?"}→${b?.claimId ?? "?"}`;
  if (!b || typeof b !== "object") return [`${at}: not an object`];
  const out = unknownKeys(b, BINDING_KEYS, at);
  if (b.schema !== BINDING_SCHEMA) out.push(`${at}: schema must be ${BINDING_SCHEMA}`);
  if (!RELATIONS.includes(b.relation)) out.push(`${at}: unknown relation ${b.relation}`);
  const s = store.sources[b.sourceId], c = store.claims[b.claimId];
  if (!s) out.push(`${at}: source ${b.sourceId} is not held`);
  if (!c) out.push(`${at}: claim ${b.claimId} does not exist`);
  if (b.relation === "mentions") return out;
  // supports / contradicts: the event the source records must be the claim's own
  if (!PREDICATES.includes(b.asserts)) out.push(`${at}: asserts must name what the source records (got ${b.asserts})`);
  else if (c && b.asserts !== c.predicate)
    out.push(`${at}: source records ${b.asserts}; claim is ${c.predicate} — event types never convert`);
  if (s && LOCATED_TYPES.has(s.type) && !text(b.locator)) out.push(`${at}: ${s.type} proof needs a locator (page, entry, folio)`);
  return out;
}

export function validateStore(store) {
  const out = [];
  for (const [k, s] of Object.entries(store.sources)) {
    out.push(...sourceProblems(s));
    if (s?.id !== k) out.push(`source ${k}: keyed under a different id`);
  }
  for (const [k, c] of Object.entries(store.claims)) {
    out.push(...claimProblems(c));
    if (c?.id !== k) out.push(`claim ${k}: keyed under a different id`);
  }
  const seen = new Set();
  for (const b of store.bindings) {
    out.push(...bindingProblems(b, store));
    const key = `${b?.sourceId}|${b?.claimId}|${b?.locator ?? ""}`;
    if (seen.has(key)) out.push(`binding ${b?.sourceId}→${b?.claimId}: duplicate (one entry counted twice is not two sources)`);
    seen.add(key);
  }
  return out;
}

// adders refuse rather than store something invalid
const refuse = (problems) => { if (problems.length) throw new Error(problems.join("; ")); };
export function addSource(store, s) {
  refuse(sourceProblems(s));
  if (store.sources[s.id]) refuse([`source ${s.id}: already held`]);
  store.sources[s.id] = s;
}
export function addClaim(store, c) {
  refuse(claimProblems(c));
  if (store.claims[c.id]) refuse([`claim ${c.id}: already exists`]);
  store.claims[c.id] = c;
}
export function bind(store, b) {
  const probe = { ...store, bindings: [...store.bindings, b] };
  refuse(validateStore(probe).filter((p) => p.startsWith("binding ")));
  store.bindings.push(b);
}

// What a transport hands over. Only a harvested source becomes one; every
// other observation becomes a lead (or nothing) and never touches evidence.
export function admit(store, obs) {
  if (obs?.kind === "harvested-source") {
    addSource(store, obs.source);
    return { admitted: "source", id: obs.source.id };
  }
  if (NOT_A_SOURCE.includes(obs?.kind)) {
    const lead = { kind: obs.kind, subjects: [...(obs.subjects || [])], ...(obs.count !== undefined ? { count: obs.count } : {}), ...(obs.note ? { note: obs.note } : {}) };
    store.leads.push(lead);
    return { admitted: "lead", lead };
  }
  throw new Error(`admit: unknown observation kind ${obs?.kind}`);
}

// One claim's standing. Fail-closed: an invalid store has no standings.
export function claimStanding(store, claimId) {
  refuse(validateStore(store));
  if (!store.claims[claimId]) refuse([`claim ${claimId} does not exist`]);
  const mine = store.bindings.filter((b) => b.claimId === claimId);
  const by = (r) => mine.filter((b) => b.relation === r);
  const supports = by("supports"), contradicts = by("contradicts"), mentions = by("mentions");
  const standing =
    supports.length && contradicts.length ? "contested"
    : supports.length ? "sourced"
    : contradicts.length ? "contradicted"
    : "unsourced-entry";
  return { claimId, standing, supports, contradicts, mentions };
}

// A person is "sourced" only through claims a source actually supports; each
// of those claims is named, and every other claim about them stays as it was.
export function personSupport(store, personId) {
  refuse(validateStore(store));
  const claims = Object.values(store.claims).filter((c) => parties(c.subject).includes(personId));
  const standings = claims.map((c) => claimStanding(store, c.id));
  const sourcedClaims = standings.filter((s) => s.supports.length).map((s) => s.claimId);
  return {
    personId,
    support: sourcedClaims.length ? "sourced" : "unsourced-entry",
    sourcedClaims,
    contestedClaims: standings.filter((s) => s.standing === "contested").map((s) => s.claimId),
  };
}

// Two tree records that may be one person. Topology opens an investigation;
// only an uncontested, supported identity claim reaches the founder; nothing
// here ever returns "merge".
export function duplicateAssessment(store, a, b, topology = {}) {
  refuse(validateStore(store));
  const signals = ["sharedParents", "pairedSpouses", "similarName"].filter((k) => topology[k]);
  const idClaims = Object.values(store.claims).filter(
    (c) => c.predicate === "identity" && [a, b].every((p) => parties(c.subject).includes(p)));
  const st = idClaims.map((c) => claimStanding(store, c.id));
  const status = signals.length || idClaims.length ? "lead/investigate" : "no-lead";
  const decision =
    st.some((s) => s.standing === "contested") ? "contested — founder review"
    : st.some((s) => s.standing === "sourced") ? "founder review"
    : "NONE";
  return {
    pair: [a, b], status, signals, decision,
    support: { a: personSupport(store, a).support, b: personSupport(store, b).support },
    identityEvidence: st,
  };
}

// The public projection. Default-deny: a claim is public only when every party
// is known to be deceased. Sources appear only through a kept binding and
// never carry their private artifact pointer. Leads are never public.
export function publicView(store, persons) {
  refuse(validateStore(store));
  const deceased = (id) => persons?.[id] && persons[id].living === false;
  const claims = Object.fromEntries(
    Object.entries(store.claims).filter(([, c]) => parties(c.subject).every(deceased)));
  const bindings = store.bindings.filter((b) => claims[b.claimId]);
  const sources = {};
  for (const b of bindings) {
    const { artifactRef, ...rest } = store.sources[b.sourceId];
    sources[b.sourceId] = rest;
  }
  return { sources, claims, bindings, leads: [] };
}
