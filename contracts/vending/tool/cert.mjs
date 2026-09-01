// cert.mjs — the birth certificate: compose, canonicalize, hash (SPEC-VENDING-2 §certificate)
//
// THE 1000-YEAR RULES (load-bearing, do not bend):
//   - plain UTF-8 JSON, every field named in plain English, no exotic encodings
//   - canonical form: JSON.stringify with keys sorted at every level, no whitespace
//   - content hash: sha256 over the canonical JSON of the record WITH hash.value
//     removed (the record says this itself — it is self-describing)
//   - size target ~2 KiB (Arweave Turbo free tier carries ≤105 KiB; we stay
//     far under so the certificate is always free to re-stand)
import { createHash } from "node:crypto";

export const CERT_VERSION = 1;

// deep-sort every object's keys (arrays keep order — order is data)
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]);
    return o;
  }
  return v;
}

export const canonicalJson = (record) => JSON.stringify(sortDeep(record));

export function contentHash(record) {
  const noHash = sortDeep(structuredClone(record));
  if (noHash.hash) delete noHash.hash.value;
  return createHash("sha256").update(JSON.stringify(noHash), "utf8").digest("hex");
}

// the five answers (SPEC-VENDING-1 §layers: bQueenBee's five answers + the recipe)
export function composeCertificate({ agentName, house, tongue, template,
                                     memberKeyHex, memberAccount, mintedIso,
                                     storeBinding, spec = "SPEC-VENDING-1",
                                     extra = {} }) {
  const record = {
    record: "agent-birth-certificate",
    version: CERT_VERSION,
    law: {
      spec,
      naming: "SPEC-A-NAMES-1: .a agents, suffixless names, 27-tongue charset",
      pointer_law: "location DERIVED from member-held inputs, never a curated list: the agent name resolves the vending contract's certs row (name road); the member ed25519 key locates the Arweave record by its Member-Key tag — and equals the AR owner when the ed25519 door signs the item (key road). Replication is not the mechanism.",
      fence: "ANT farming is participation not revenue; the tithe is the business (SPEC-VENDING-1 §fence — ruled, closed)",
    },
    answers: {
      what_is_this: "a member-owned AI agent minted by the skaists vending machine; it outlives the machine that made it",
      who_owns_it: { member_key_ed25519_hex: memberKeyHex, vaulta_account: memberAccount },
      when_minted_utc: mintedIso,
      where_memory_lives: storeBinding,
      how_to_make_another: "the recipe below re-stands the whole machine — the species survives the estate",
    },
    agent: { name: agentName, house, tongue, template },
    recipe: {
      machine: "the skaists member-agent vending machine (bQueenBee line)",
      layers: {
        arweave: { role: "this birth certificate AND this recipe — the permanent layer",
          door: "Arweave Turbo free tier (<=105 KiB; ed25519-signed so the OWNER equals the member key when that door is open, else Member-Key tag carries the key road)" },
        autonomi: { role: "private working memory under the member's own key",
          format: "a1-log v1: append-only hash-linked revisions, owner-signed; highest valid revision wins; deletable by the member",
          funded_write: "gated on the ANT custody review (storage-substrate-split item 8); never priced at zero (R3)" },
        vaulta: { role: "rate table + tithe + one bounded pointer row per agent",
          contract: "vending (contracts/vending/src/vending.cpp, cdt-cpp 4.x)",
          actions: "init setrate settithe mint update release" },
        base: { role: "the money: payments in; cash-out via the proven PYUSD door" },
      },
      restand_steps: [
        "1. compile vending (cdt-cpp) and deploy to a Vaulta chain seat",
        "2. init(admin, max_certs) — the RAM bound is law",
        "3. setrate vaulta 0.6000 A; settithe 1000bp -> tithe destination",
        "4. mint(agent_name, owner, member_key_hex, ar_id, sha256_hex, template, tongue)",
        "5. verify this record: canonical JSON (keys sorted, no whitespace), sha256, compare hash.value",
      ],
      source: "estate tree beehive-nature (github); SPEC-VENDING-1 is the spec of record",
    },
    ...extra,
    hash: {
      algorithm: "sha256",
      computed_over: "canonical JSON (UTF-8, keys sorted at every level, no whitespace) of this object with hash.value removed",
      value: "",
    },
  };
  record.hash.value = contentHash(record);
  return record;
}

export const certTags = ({ agentName, memberKeyHex, spec }) => [
  { name: "App-Name", value: "skaists-vending" },
  { name: "Type", value: "agent-birth-certificate" },
  { name: "Content-Type", value: "application/json" },
  { name: "Agent-Name", value: agentName },
  { name: "Member-Key", value: memberKeyHex },
  { name: "Spec", value: spec },
  { name: "Hash-Algorithm", value: "sha256" },
];

// verify: returns {ok, reason, hash} — the resurrection gate
export function verifyCertificate(record) {
  if (!record || record.record !== "agent-birth-certificate")
    return { ok: false, reason: "not a birth certificate" };
  if (!record.hash?.value || record.hash.algorithm !== "sha256")
    return { ok: false, reason: "missing/unknown hash block" };
  const h = contentHash(record);
  return { ok: h === record.hash.value, hash: h,
           reason: h === record.hash.value ? "authentic" : "HASH MISMATCH — forged or corrupted" };
}
