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

// A RECORD is the mirror of the store maps below: unknownKeys reads OWN keys
// only and every field check reads `o.k` bare, so a record built with
// Object.create(proto) is admitted on fields nobody wrote into it. Measured at
// all three gates, and the symptom is publication, not only admission: an
// inherited `url` satisfies locatability and then leaves RAW through the
// structural allowlist with no caller decision at all; an inherited `subject`
// is the id publicView asks isPublicSubject about; an inherited `quote` leaves
// on a binding whose own keys are ["schema"] alone.
// JSON revival cannot build one — "__proto__" arrives as an OWN key and
// unknownKeys names it — so the producer is a hand that calls Object.create,
// which is the same hand the store-shape row already assumes.
// Sources were bee-laborer's row, re-read at 05b8d93c; claims and bindings are
// mine and reproduce identically, so this is one check shared by the three
// record gates rather than one patch.
// It RETURNS rather than pushing: every sentence below it is computed off the
// record's own fields, and a verdict computed off an INHERITED field is the
// defect being refused — the phantom-field half, one level in.
// null is allowed for the reason it is at the store: Object.create(null)
// inherits nothing. The modality is "can": an array carries Array.prototype and
// inherits no listed key, so it is refused by this sentence instead of by its
// missing fields — a shorter true refusal, not a different verdict.
// DISCLOSED: `at` is built from the record's own id/ids, which on this shape may
// themselves be inherited. The sentence names the object by what it answers to
// and then says that is not its own, which is the honest pair.
// The question is the prototype's SHAPE, never its IDENTITY. `=== Object.prototype`
// is realm-local, and node:vm is a live idiom in this tree: a record built in
// another realm carries THAT realm's Object.prototype -- same own keys, the same
// inherited surface, ZERO inherited data fields -- and was refused with a
// sentence that is false about it. Accepted here: no prototype at all, or one
// level carrying exactly the names Object.prototype carries. That is sound
// because NO key this module reads is among those names, which the battery
// asserts mechanically with a control rather than arguing in prose: put a listed
// key on the prototype and the name set no longer matches. A realm whose
// Object.prototype has been extended is refused, which is the closed direction.
// NOT cached per prototype: one cached as plain can gain a field afterwards.
// Found by bee-laborer re-reading ff8746f6; arrived with that commit, not before.
const PLAIN_PROTO_NAMES = Object.getOwnPropertyNames(Object.prototype).sort().join(",");
const plainChain = (o) => {
  const p = Object.getPrototypeOf(o);
  if (p === null) return true;
  if (Object.getPrototypeOf(p) !== null) return false; // Array.prototype, or a poisoned chain
  return Object.getOwnPropertyNames(p).sort().join(",") === PLAIN_PROTO_NAMES;
};
const foreignProto = (o, at) => (plainChain(o) ? null
  : `${at}: carries a prototype, so a field nobody wrote into this record can read as its own -- build it as a plain object`);

// a claim subject is a person id, or "a|b" for a relationship between two
export const parties = (subject) => String(subject).split("|");

// Every map below is keyed by an id the CALLER chooses, so it carries no
// prototype. On a plain object `sources["toString"]` answers with an inherited
// function: a binding naming it passes the "is not held" test, passes
// publicView's two filters, and publishes its quote while the caller's privacy
// layer refused every subject and every source. The mirror is a false refusal —
// adding a real source under one of those ids reported "already held" when
// nothing was. Found by bee-laborer reviewing this PR.
// `Object.create(null)` and not hasOwnProperty.call, because the call form
// still cannot store one: on a plain object `o["__proto__"] = s` invokes the
// setter and creates NO own key, so the add would report success and keep
// nothing.
export function createStore() {
  return { sources: Object.create(null), claims: Object.create(null), bindings: [], leads: [] };
}

export function sourceProblems(s) {
  const at = `source ${s?.id ?? "?"}`;
  if (!s || typeof s !== "object") return [`${at}: not an object`];
  const shape = foreignProto(s, at);
  if (shape) return [shape]; // above the lead check: s.type may itself be inherited
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
  const shape = foreignProto(c, at);
  if (shape) return [shape];
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

// The two lookups below are the only place in this module where a
// caller-chosen id indexes a map this module did not build. bindingProblems is
// exported, so a caller reaches it without passing through validateStore, bind
// or publicView, and on a hand-built or JSON-revived store a bare lookup
// answers from the prototype. Measured, that is not only a missing refusal:
// the inherited record's own fields reach the VERDICT -- "extracts birth; claim
// is death" computed off a claim nobody holds, and "parish-register collection
// proof needs a locator" off a source nobody holds. A caller-supplied
// prototype supplies ARBITRARY ids, so a blocklist of the JavaScript names
// never closes it.
// hasOwnProperty.call here and Object.create(null) in createStore, and the
// reason is reversed rather than inconsistent: this path only READS. The call
// form's defect is that o["__proto__"] = s runs the setter and stores nothing,
// which a function that stores nothing cannot hit.
// Complementary to storeProblems, never a replacement -- strip either and the
// other still answers. Found by bee-laborer re-reading a05f246d.
// Scope, measured and unchanged: a sources/claims that is missing or null still
// throws here (a different TypeError message, the same refusal), and one that
// is a FUNCTION now reports its Function.prototype members as not held.
const heldUnder = (map, id) => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : undefined);

// A locator is NOT a map key. Two bindings on one source and one claim are two
// entries when their locators differ, so a locator carries identity BY VALUE
// and is left to JSON rather than coerced -- coercing it would join every
// object locator on "[object Object]".
// But JSON is not total over it. Measured at 14528dee across fourteen shapes: a
// CIRCULAR locator and one holding a BIGINT made JSON.stringify THROW, and a
// SYMBOL and an object whose toJSON returns undefined both serialise to nothing
// inside the array, so two distinct ones joined. The throw is the worse half:
// the exported door returned CLEAN for such a binding, and a store already
// holding one threw a TypeError out of validateStore, claimStanding,
// personSupport and publicView alike -- four gates failing by crash instead of
// by refusal. A fail-closed path still owes a TRUE reason, and a crash is not
// one. Found by bee-laborer re-reading 14528dee.
// So the locator is serialised ALONE and the SERIALISATION is judged: a value
// JSON cannot express, or expresses as nothing, cannot carry an identity and is
// REFUSED BY NAME. Everything else joins on its own JSON text, which makes the
// key TOTAL -- the outer stringify now sees three strings and cannot throw.
// Nesting the text adds no join, because JSON quotes strings: the locator
// string {"page":4} and the object {page:4} still key apart, asserted below.
// NOT nonDataAt, though it is this module's own is-this-data instrument and
// closes exactly these four shapes: its prototype tests are IDENTITY tests, so
// it also refuses a cross-realm plain object, a cross-realm array, a Date and a
// function locator -- four shapes that key correctly today, measured, and the
// first of them is the realm-local defect this commit's parent repaired one
// function over. A remedy that re-creates the defect it sits beside is not the
// remedy; the cost table is in the receipt.
// RESIDUAL, unchanged and disclosed: JSON text is key-ORDER sensitive, so
// {a:1,b:2} and {b:2,a:1} are two entries. That was true of the join before
// this commit and is not what this row repairs.
// A refusal's cause is read off the throw, and a throw is not guaranteed to be
// an Error. Measured at 8c467528: a toJSON that threw a string or threw null
// produced "-- undefined", so the sentence printed the word undefined where the
// cause belongs, inside the commit whose own law is that a fail-closed path owes
// a TRUE reason. Found by bee-laborer re-reading 8c467528.
// And the message can itself throw -- REACHABLE, measured: a locator whose
// toJSON throws a value with a throwing `message` getter defeated the naive
// reader and crashed the door, which is the class this very file repairs.
// Deliberately NOT `e instanceof Error`: that is a realm-local identity test,
// the defect repaired two functions up, and it would misdescribe a cross-realm
// Error. The reader says what it could not get instead of naming a constructor.
const causeOf = (e) => {
  let m;
  try { m = e?.message; } catch { return "reading its message threw as well"; }
  if (typeof m === "string" && m !== "") return m.split("\n")[0];
  return `it threw ${e === null ? "null" : typeof e === "object" ? "an object" : `a ${typeof e}`} with no message`;
};

const locatorKey = (v) => {
  const raw = (typeof v === "object" && v !== null) || typeof v === "symbol" ? v : String(v);
  let text;
  try { text = JSON.stringify(raw); }
  catch (e) { return { why: `locator cannot be part of a duplicate key -- ${causeOf(e)}` }; }
  if (text === undefined) return { why: "locator does not survive serialisation, so two distinct locators would join" };
  return { text };
};

// Every sentence this module says about a binding is built from its two ids, so
// the ids are read BEFORE anything else -- and reading them is not free.
// Measured at 8c467528: `binding ${sourceId}→${claimId}` is a template literal,
// so a null-prototype id and an id whose toString throws made bind(), the
// exported door, validateStore, claimStanding, personSupport and publicView ALL
// fail by TypeError instead of by refusal. Six entries, the same shape the
// locator half of this file closed one function up, in the field the comment
// down in validateStore cleared -- and that sentence was mine and is deleted.
// Pre-existing: `at` sits at 619e809c:122 unchanged. Found by bee-laborer
// re-reading 8c467528.
// A SYMBOL is a different defect in the same costume and the measurement moved
// it: String(symbol) does NOT throw (only the template literal does), and a
// symbol IS a property key, so the store holds two distinct symbols apart while
// ToString names both "Symbol(sid)". That is a JOIN in the duplicate key, not a
// crash at the door, so it is named where it joins and everything else about
// the binding is still computed -- an ambiguous name does not stop the sentence
// machine, an unbuildable one does.
const nameId = (v) => {
  if (typeof v === "symbol") return { text: String(v), joins: "is a symbol: the store holds two distinct symbols apart, and the duplicate key names both with one string" };
  try { return { text: String(v) }; }
  catch (e) { return { why: `cannot be named -- ${causeOf(e)}` }; }
};

export function bindingProblems(b, store) {
  const sn = nameId(b?.sourceId ?? "?"), cn = nameId(b?.claimId ?? "?");
  const at = `binding ${sn.text ?? "?"}→${cn.text ?? "?"}`;
  // RETURN, never push: heldUnder() coerces the id to a property key, so every
  // sentence below is computed off a field that cannot be read at all.
  if (sn.why || cn.why)
    return [...(sn.why ? [`${at}: sourceId ${sn.why}`] : []), ...(cn.why ? [`${at}: claimId ${cn.why}`] : [])];
  if (!b || typeof b !== "object") return [`${at}: not an object`];
  const shape = foreignProto(b, at);
  if (shape) return [shape];
  const out = unknownKeys(b, BINDING_KEYS, at);
  if (b.schema !== BINDING_SCHEMA) out.push(`${at}: schema must be ${BINDING_SCHEMA}`);
  if (!RELATIONS.includes(b.relation)) out.push(`${at}: unknown relation ${b.relation}`);
  const s = heldUnder(store.sources, b.sourceId), c = heldUnder(store.claims, b.claimId);
  // sn.text / cn.text, never the raw id: these two were template literals on the
  // raw field, so they re-opened the same crash for a SYMBOL id one line below
  // the reader that exists to close it. Measured -- the repair above was green
  // for the unnameable ids and still threw here for the symbol.
  if (!s) out.push(`${at}: source ${sn.text} is not held`);
  if (!c) out.push(`${at}: claim ${cn.text} does not exist`);
  // The exported door answers for the locator too, so a binding whose locator
  // cannot carry an identity is named HERE and not only where the key is built
  // -- that disagreement was the row: this returned clean while every gate that
  // keys the store crashed on the same binding.
  const lk = locatorKey(b.locator ?? "");
  if (lk.why) out.push(`${at}: ${lk.why}`);
  if (sn.joins) out.push(`${at}: sourceId ${sn.joins}`);
  if (cn.joins) out.push(`${at}: claimId ${cn.joins}`);
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

// The store's SHAPE is part of the contract, not only its contents. A map that
// carries Object.prototype answers "held" for toString, constructor and
// __proto__ -- the class closed above -- and cannot store a source under the id
// "__proto__" at all. createStore() builds both maps prototype-free, but nothing
// forces a caller to have used it: a hand-built literal and
// JSON.parse(JSON.stringify(store)) both produce plain maps, and both bring that
// class straight back (measured; the privacy half stays closed under every store
// shape because publicView builds its own null-prototype maps). Found by
// bee-laborer re-reading the repair above.
// Refused by name rather than repaired, because repairing means mutating the
// caller's store. COST, stated so it is not mistaken for free: a persisted store
// cannot be revived by JSON.parse alone. There is no revive path here and no
// caller that needs one; the hand that persists a store writes it.
// Scope: the prototype only. A sources/claims that is missing or not an object
// is left exactly as it behaves today and is not this row.
export function storeProblems(store) {
  const out = [];
  for (const [name, reads] of [["sources", "a held source"], ["claims", "an existing claim"]]) {
    const m = store?.[name];
    if (m && typeof m === "object" && Object.getPrototypeOf(m) !== null)
      out.push(`store.${name}: carries a prototype, so an id JavaScript puts on every object reads as ${reads} -- build it with createStore()`);
  }
  return out;
}

export function validateStore(store) {
  const out = storeProblems(store);
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
    // Joined, never concatenated. "|" is this module's OWN delimiter — parties()
    // splits a two-party subject on it — so an id carrying one is ordinary here,
    // not exotic, and three fields concatenated on it are ambiguous: ("S1",
    // "ID-FA|FB", "p. 4") and ("S1", "ID-FA", "FB|p. 4") joined equal, and one
    // honest pair of bindings then denied the whole store with a sentence that
    // names a duplicate that does not exist. A "|" in free LOCATOR text is
    // harmless; the trigger is a "|" in an ID. Found by bee-laborer re-reading
    // 05b8d93c. A fail-closed path still owes a TRUE reason.
    // Coerce each part the way the store keys it. An ID *is* a map key: these
    // maps are indexed by PROPERTY KEY and ToPropertyKey is ToString for every
    // non-symbol, so the source held under "5" is the one a binding names as 5,
    // and an object id whose toString reads "S1" resolves to the source held
    // under "S1". `part` exempted objects and symbols from that coercion for
    // ALL THREE fields while the sentence licensing the exemption was about the
    // LOCATOR alone, and one exemption produced both errors at once: an object
    // id MISSED a duplicate -- the same entry bound twice, held twice and
    // published as two bindings on one source -- while two DIFFERENT object ids
    // joined on "{}" into a duplicate that does not exist. Found by bee-laborer
    // re-reading 14528dee; the comment already stated the law the expression
    // broke. The ids are named by nameId, the same reader the door uses, so an
    // id the key cannot express is skipped here exactly as an unkeyable locator
    // is -- both are already named above, and each sentence is said once.
    const sk = nameId(b?.sourceId), ck = nameId(b?.claimId);
    const lk = locatorKey(b?.locator ?? "");
    if (sk.why || ck.why || sk.joins || ck.joins || lk.why) continue;
    const key = JSON.stringify([sk.text, ck.text, lk.text]);
    if (seen.has(key)) out.push(`binding ${sk.text}→${ck.text}: duplicate (one entry counted twice is not two sources)`);
    seen.add(key);
  }
  return out;
}

// adders refuse rather than store something invalid
const refuse = (problems) => { if (problems.length) throw new Error(problems.join("; ")); };
export function addSource(store, s) {
  refuse([...storeProblems(store), ...sourceProblems(s)]);
  if (store.sources[s.id]) refuse([`source ${s.id}: already held`]);
  store.sources[s.id] = s;
}
export function addClaim(store, c) {
  refuse([...storeProblems(store), ...claimProblems(c)]);
  if (store.claims[c.id]) refuse([`claim ${c.id}: already exists`]);
  store.claims[c.id] = c;
}
export function bind(store, b) {
  // The filter below keeps an unrelated invalid source from refusing every
  // bind. A store-shape problem is not unrelated: it is what makes this
  // binding's own existence lookups lie, and the filter would drop it.
  refuse(storeProblems(store));
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
//                                          payload leaves; null/undefined omits it, and
//                                          anything not JSON data at any depth is refused
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

// Where a projected value stops being JSON data, or null when it is data all
// the way down. Data is null, a string, a boolean, a finite number other
// than -0, a dense plain array whose only own properties are its elements,
// or a plain object (no prototype other than Object's) whose own properties
// are enumerable string-keyed data values. Anything else, anywhere in the
// structure, is named rather than dropped or transformed, so the JSON copy
// made after it is exact.
export function nonDataAt(v, path = "value", seen = new Set()) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return `${path}: non-finite number ${v}`;
    if (Object.is(v, -0)) return `${path}: negative zero (JSON would publish it as 0)`;
    return null;
  }
  if (typeof v !== "object") return `${path}: ${typeof v}`;
  if (seen.has(v)) return `${path}: cycle`;
  seen.add(v);
  try {
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype) return `${path}: array subclass`;
      if (Object.getOwnPropertySymbols(v).length) return `${path}: symbol-keyed property`;
      // JSON keeps only the elements: any other own property would vanish.
      // An element key is a canonical integer below length (so "4294967295",
      // 2^32-1, which never extends length, is not one).
      for (const k of Object.getOwnPropertyNames(v)) {
        if (k === "length") continue;
        const i = Number(k);
        if (!(Number.isInteger(i) && i >= 0 && i < v.length && String(i) === k))
          return `${path}.${k}: array property that is not an element`;
      }
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, i);
        if (!d) return `${path}[${i}]: hole`;
        if (!("value" in d)) return `${path}[${i}]: accessor element`;
        const bad = nonDataAt(d.value, `${path}[${i}]`, seen);
        if (bad) return bad;
      }
      return null;
    }
    // MEASURED AND NOT REPAIRED, so the two forms in this file are not an
    // oversight: these two prototype tests are IDENTITY tests, like the record
    // check was, and a cross-realm value is refused by them -- an array as
    // "array subclass", a plain object as "Object object", both false about it.
    // They fail CLOSED (a legitimate value is not published) where the record
    // check failed a record with a false sentence, and widening what may be
    // PUBLISHED is not a repair to take unasked. Named in the receipt.
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return `${path}: ${v.constructor?.name ?? "non-plain"} object`;
    if (Object.getOwnPropertySymbols(v).length) return `${path}: symbol-keyed property`;
    for (const k of Object.getOwnPropertyNames(v)) {
      const d = Object.getOwnPropertyDescriptor(v, k);
      if (!("value" in d)) return `${path}.${k}: accessor property`;
      if (!d.enumerable) return `${path}.${k}: non-enumerable property`;
      const bad = nonDataAt(d.value, `${path}.${k}`, seen);
      if (bad) return bad;
    }
    return null;
  } finally {
    seen.delete(v);
  }
}

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
      const bad = nonDataAt(v);
      if (bad) throw new Error(`publicView: projectValue for claim ${id} returned something that is not data (${bad})`);
      out[k] = JSON.parse(JSON.stringify(v)); // lossless once validated; a detached copy that aliases nothing
    }
    return out;
  };

  // null-prototype for the same reason createStore is: these three are looked
  // up by a binding's own sourceId/claimId below, and an inherited member reads
  // as a published claim or a permitted source.
  const claims = Object.create(null);
  for (const [id, c] of Object.entries(store.claims))
    if (parties(c.subject).every((p) => isPublicSubject(p) === true))
      claims[id] = project(c, "claim", id, { claimId: id, subject: c.subject, predicate: c.predicate });
  const publicSource = Object.create(null);
  for (const [id, s] of Object.entries(store.sources)) publicSource[id] = isPublicSource(id, s) === true;
  // a binding appears only when both its claim and its source may
  const bindings = store.bindings
    .filter((b) => claims[b.claimId] && publicSource[b.sourceId])
    .map((b) => project(b, "binding", `${b.sourceId}→${b.claimId}`));
  const sources = Object.create(null);
  for (const b of bindings) sources[b.sourceId] ??= project(store.sources[b.sourceId], "source", b.sourceId);
  return { sources, claims, bindings, leads: [] };
}
