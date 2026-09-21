// ── Ancestry adapter — the ONLY file that knows Ancestry exists ──────────────
// Same shape as fs-adapter.mjs: a pure harvest of one provider payload into
// the provider-neutral model, plus an import for raw dumps. Provider refs are
// NAMESPACED provider+tree+pid so they can never collide with FS ids or
// internal ids. Hints and ThruLines are RESEARCH LEADS, never parentage.
//
// WIRE (recorded 2026-09-17 from the founder's signed-in session, survey
// dispatch for shapes):
//   GET /api/treeviewer/tree/newfamilyview/{treeId}?focusPersonId={pid}&genup=N&gendown=M
//   → { v:"3.0", Persons:[{ gid:"pid:dbid:treeId", Names:[{g,s}],
//       Genders:[{g:"f"|"m"}], Events:[{t:"Birth"|"Death", p, nps}],
//       Family:[{t:"F"|"M"|"H"|"W"|"C", tgid:{v}}], Identifiers:[...] }], focus }
// Family relation semantics: t is the role the TARGET (tgid) plays in this
// person's life — F father, M mother, H husband(->wife), W wife(->husband),
// C child (tgid is this person's child).
import { addPerson, addEdge, addCouple } from "./model.mjs";

// provider-ref namespace: provider:tree:pid (never bare)
export const ancestryRef = (treeId, pid) => `ancestry:${treeId}:${pid}`;
export const isAncestryRef = (ref) => String(ref).startsWith("ancestry:");

// pure: fold one newfamilyview payload into the model under namespaced ids.
// Preserves ORIGINAL values (name spellings, living flags, missing dates)
// beside normalized ones; never merges by name; never deletes a known parent
// because one provider lacks it (the model simply gains nothing).
export function harvestResponse(model, json, { treeId } = {}) {
  const tid = treeId || inferTreeId(json);
  if (!tid || !Array.isArray(json.Persons)) return { added: 0 };
  // pass 1: persons under namespaced ids — idOf records ONLY successfully
  // inserted persons, so relationship resolution can never reference a
  // nameless/skipped record
  let added = 0;
  const idOf = new Map(); // ancestry pid -> namespaced ref (inserted only)
  for (const p of json.Persons) {
    const pid = String(p.gid?.v || "").split(":")[0];
    if (!pid) continue;
    const ref = ancestryRef(tid, pid);
    const nm = p.Names?.[0] || {};
    const name = `${nm.g || ""} ${nm.s || ""}`.trim();
    if (!name) continue;
    const birth = p.Events?.find((e) => e.t === "Birth");
    const death = p.Events?.find((e) => e.t === "Death");
    // OBSERVATION LAW: absence of a death event is NEVER equivalent to
    // "living" — the payload carries no explicit living flag, so we record
    // only what was actually observed. The UI's Living label (a separate
    // Ancestry behavior) is recorded only if separately observed and receipted.
    if (addPerson(model, {
      id: ref, name,
      lifespan: null,
      gender: p.Genders?.[0]?.g === "f" ? "F" : p.Genders?.[0]?.g === "m" ? "M" : null,
      living: false, // the adapter never asserts living — observation only
      source: "ancestry", sourceId: ref,
      evidence: { era: "unrecorded", support: "unsourced-entry",
        basis: "provider observation (Ancestry) — source independence not yet assessed" },
    })) {
      added++;
      idOf.set(pid, ref); // only NOW is the ref usable as a relationship target
      model.persons[ref].providerObservation = {
        provider: "ancestry", treeId: tid, pid,
        nameOriginal: name,
        hasDeathEvent: !!death,            // what the payload carries
        livingFlagObserved: null,          // payload has NO explicit flag
        uiLivingLabelObserved: null,       // set ONLY from a separate UI receipt
        birthPlace: birth?.p || null,
        deathPlace: death?.p || null,
        hints: "hints and ThruLines are research leads, never verified parentage",
      };
    }
  }
  // pass 2: relationships — collect ALL parents per child first (addEdge
  // replaces, so per-family single calls would overwrite each other); targets
  // resolve ONLY against persons actually inserted into the model — a
  // nameless/skipped provider record must never leave a dangling parent ref
  for (const p of json.Persons) {
    const pid = String(p.gid?.v || "").split(":")[0];
    const myRef = idOf.get(pid);
    if (!myRef || !model.persons[myRef]) continue;
    const parents = [];
    for (const f of p.Family || []) {
      const tpid = String(f.tgid?.v || "").split(":")[0];
      const tRef = idOf.get(tpid);
      if (!tRef || !model.persons[tRef]) continue; // skipped target → no edge
      if (f.t === "F" || f.t === "M") parents.push(tRef);
      if (f.t === "H" || f.t === "W") addCouple(model, myRef, tRef);
    }
    if (parents.length) addEdge(model, myRef, parents);
  }
  return { added };
}

function inferTreeId(json) {
  const g = json.Persons?.[0]?.gid?.v;
  if (!g) return null;
  return String(g).split(":")[2] || null;
}

// reconciliation: associate a namespaced provider ref with an existing
// internal identity. CONFIRMED matches only — the caller supplies the match
// (founder ruling or explicit gid mapping); name similarity alone must never
// merge people. Records the association in the registry's aliases so both
// provider records point at one person without erasing either.
export function associateRef(registry, providerRef, internalId, { confirmedBy } = {}) {
  if (!registry.aliases) registry.aliases = {};
  if (!confirmedBy) throw new Error("ref association requires confirmedBy — name matching is never enough");
  registry.aliases[providerRef] = internalId;
  return registry;
}

// observation-label helper: the honest cross-provider line
export const appearsIn = (providers) =>
  `Appears in ${providers.join(" and ")} · underlying source independence not yet assessed`;
