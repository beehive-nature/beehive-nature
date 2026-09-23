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
//  · A binding names the entry it reads (`context`, e.g. a baptism entry) and
//    the assertion it extracts from it (`asserts`), which must equal the
//    claim's predicate. When the two differ, the binding quotes the words
//    that state it: a baptism entry that says "born 24 March" supports a
//    birth; a baptism entry alone never does.
//  · Proof is pinpoint-relocatable: a source scoped to one item (its record
//    id, ARK or URL resolves the exact entry) needs nothing more; a source
//    scoped to a collection (a register volume, a census roll, a book) needs
//    the binding's locator.
//  · Claim standing (unsupported | supported | contradicted | contested) is
//    not person support (sourced | attested | unsourced-entry, model.mjs).
//    One supported claim never makes a whole person sourced.
//  · A public subject is not a public-safe evidence payload. Who may appear
//    (isPublicSubject), which sources may appear (isPublicSource), what
//    opaque text may leave (projectText) and what claim payload may leave
//    (projectValue) are four separate decisions, all the caller's. The
//    projection is an allowlist: raw text and values never leave by
//    default, artifactRef never leaves, leads never leave.
//  · Identity is never decided here. Topology can open an investigation;
//    only a founder turns evidence into a merge.

export const SOURCE_SCHEMA = "skaists.source/1";
export const CLAIM_SCHEMA = "skaists.claim/1";
export const BINDING_SCHEMA = "skaists.source-binding/1";

export const SOURCE_TYPES = [
  "parish-register", "civil-register", "census", "probate", "obituary", "newspaper",
  "gravestone", "military", "immigration", "archive-scan", "book", "provider-record", "testimony",
];
// item: recordId/url/artifactRef resolves the exact entry; collection: the binding must locate it
export const SCOPES = ["item", "collection"];
// things that arrive looking like sources and are not
export const NOT_A_SOURCE = ["hint", "record-hint", "tree-link", "tree-person", "source-count", "ai-lead"];

export const EVENT_PREDICATES = ["birth", "baptism", "christening", "death", "burial", "marriage", "divorce", "residence", "immigration", "military-service", "probate"];
export const PREDICATES = [
  ...EVENT_PREDICATES,
  "name", "sex", "occupation", "parent-child", "spouse", "identity",
  "language", "people", "polity", "religion", "region", "house", "title",
];
export const RELATIONS = ["supports", "contradicts", "mentions"];
export const STANDINGS = ["unsupported", "supported", "contradicted", "contested"];

export const SOURCE_KEYS = ["schema", "id", "type", "scope", "provider", "title", "recordId", "url", "accessedAt", "digest", "artifactRef", "note"];
export const CLAIM_KEYS = ["schema", "id", "subject", "predicate", "value", "note"];
export const BINDING_KEYS = ["schema", "sourceId", "claimId", "relation", "context", "asserts", "quote", "locator", "note"];
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
  if (!SCOPES.includes(s.scope)) out.push(`${at}: scope must say whether it pins one item or a collection (got ${s.scope})`);
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
  // supports / contradicts: the entry read, the assertion extracted, and the claim must line up
  if (!PREDICATES.includes(b.context)) out.push(`${at}: context must name the entry read (got ${b.context})`);
  if (!PREDICATES.includes(b.asserts)) out.push(`${at}: asserts must name the assertion extracted (got ${b.asserts})`);
  else if (c && b.asserts !== c.predicate)
    out.push(`${at}: extracts ${b.asserts}; claim is ${c.predicate} — assertions never convert`);
  if (PREDICATES.includes(b.context) && PREDICATES.includes(b.asserts) && b.context !== b.asserts && !text(b.quote))
    out.push(`${at}: a ${b.context} entry does not imply ${b.asserts}; quote the words that state it`);
  if (s && s.scope !== "item" && !text(b.locator)) out.push(`${at}: ${s.type} collection proof needs a locator (page, entry, folio, image)`);
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

// One claim's standing (claim-level vocabulary). Fail-closed: an invalid
// store has no standings.
export function claimStanding(store, claimId) {
  refuse(validateStore(store));
  if (!store.claims[claimId]) refuse([`claim ${claimId} does not exist`]);
  const mine = store.bindings.filter((b) => b.claimId === claimId);
  const by = (r) => mine.filter((b) => b.relation === r);
  const supports = by("supports"), contradicts = by("contradicts"), mentions = by("mentions");
  const standing =
    supports.length && contradicts.length ? "contested"
    : supports.length ? "supported"
    : contradicts.length ? "contradicted"
    : "unsupported";
  return { claimId, standing, supports, contradicts, mentions };
}

// Summary into the person-level vocabulary model.mjs owns. "sourced" here
// means at least one claim has a supporting source; supportedClaims names
// exactly which, and every other claim about the person keeps its standing.
export function personSupport(store, personId) {
  refuse(validateStore(store));
  const claims = Object.values(store.claims).filter((c) => parties(c.subject).includes(personId));
  const standings = claims.map((c) => claimStanding(store, c.id));
  const supportedClaims = standings.filter((s) => s.supports.length).map((s) => s.claimId);
  return {
    personId,
    support: supportedClaims.length ? "sourced" : "unsourced-entry",
    supportedClaims,
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
    : st.some((s) => s.standing === "supported") ? "founder review"
    : "NONE";
  return {
    pair: [a, b], status, signals, decision,
    support: { a: personSupport(store, a).support, b: personSupport(store, b).support },
    identityEvidence: st,
  };
}

// ── the public projection: an allowlist, never clone-then-delete ─────────────
// A public subject is not a public-safe evidence payload. Four decisions are
// separate and all belong to the caller:
//   isPublicSubject(id)                    may this genealogy subject appear?
//   isPublicSource(id, source)             may this source's metadata appear? (a
//                                          deceased subject does not make a family
//                                          letter, subscription record or signed URL public)
//   projectText(text, { object, field, id })   the only way opaque human-authored
//                                          text leaves; only a returned string publishes
//   projectValue(value, { claimId, subject, predicate })  the only way a claim's
//                                          payload leaves; null/undefined omits it
// Every schema key has exactly one disposition below; a key without one
// cannot be added (the test suite checks the lists against *_KEYS).
export const PUBLIC_FIELDS = {
  source: {
    structural: ["schema", "id", "type", "scope", "provider", "accessedAt", "digest", "recordId", "url"],
    text: ["title", "note"],
    never: ["artifactRef"],
  },
  claim: {
    structural: ["schema", "id", "subject", "predicate"],
    value: ["value"],
    text: ["note"],
  },
  binding: {
    structural: ["schema", "sourceId", "claimId", "relation", "context", "asserts"],
    text: ["locator", "quote", "note"],
  },
};

export function publicView(store, { isPublicSubject, isPublicSource, projectText, projectValue } = {}) {
  for (const [name, fn] of Object.entries({ isPublicSubject, isPublicSource }))
    if (typeof fn !== "function") throw new Error(`publicView: the caller's privacy layer must supply ${name}`);
  for (const [name, fn] of Object.entries({ projectText, projectValue }))
    if (fn !== undefined && typeof fn !== "function") throw new Error(`publicView: ${name} must be a function when given`);
  refuse(validateStore(store));

  const project = (obj, object, id, valueContext) => {
    const spec = PUBLIC_FIELDS[object], out = {};
    for (const k of spec.structural) if (obj[k] !== undefined) out[k] = obj[k];
    for (const k of spec.text) {
      if (obj[k] === undefined || !projectText) continue;
      const t = projectText(obj[k], { object, field: k, id });
      if (typeof t === "string") out[k] = t;
    }
    for (const k of spec.value || []) {
      if (obj[k] === undefined || !projectValue) continue;
      const v = projectValue(obj[k], valueContext);
      if (v === undefined || v === null) continue;
      const json = JSON.stringify(v); // a detached copy: nothing aliases the private store
      if (json === undefined) throw new Error(`publicView: projectValue for claim ${id} returned something that is not data`);
      out[k] = JSON.parse(json);
    }
    return out;
  };

  const claims = {};
  for (const [id, c] of Object.entries(store.claims))
    if (parties(c.subject).every((p) => isPublicSubject(p) === true))
      claims[id] = project(c, "claim", id, { claimId: id, subject: c.subject, predicate: c.predicate });
  const publicSource = {};
  for (const [id, s] of Object.entries(store.sources)) publicSource[id] = isPublicSource(id, s) === true;
  // a binding appears only when both its claim and its source may
  const bindings = store.bindings
    .filter((b) => claims[b.claimId] && publicSource[b.sourceId])
    .map((b) => project(b, "binding", `${b.sourceId}→${b.claimId}`));
  const sources = {};
  for (const b of bindings) sources[b.sourceId] ??= project(store.sources[b.sourceId], "source", b.sourceId);
  return { sources, claims, bindings, leads: [] };
}
