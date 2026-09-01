// a1.mjs — the A1 revision log: the agent's memory format on Autonomi
// (SPEC-VENDING-1 §layers layer 2, versioned by the A1 rule)
//
// A1 RULE: append-only, owner-signed, resolver takes the HIGHEST VALID
// revision. Autonomi 2.0 is immutable chunk storage (no mutable primitives —
// storage-substrate-split §2), so mutability lives HERE, in a hash-linked log
// each revision signs. Deletion is the member's right (memory law): deleting
// the member's datamap/access handles deletes the store — the log is the
// format, not a claim the data is undeletable.
//
// Revision shape (plain JSON, canonical like the certificate):
//   { v: 1, agent, rev, prev, body, sig_ed25519, ts }
//     prev = "" for genesis, else the prior revision's sha256
//     sig  = ed25519 (WebCrypto) over the canonical JSON without sig
//
// HONEST SCOPE: this module defines + proves the FORMAT. The funded Autonomi
// write is gated on the ANT custody review (storage-substrate-split item 8)
// and never priced at zero (R3). The certificate's store binding carries the
// a1 genesis head, so the day the store is funded it is verifiable against
// this record.
import { createHash } from "node:crypto";
import { webcrypto } from "node:crypto";
import { canonicalJson } from "./cert.mjs";

const A1_VERSION = 1;
const subtle = webcrypto.subtle;

export async function importMemberPub(rawHexOrBuf) {
  const raw = typeof rawHexOrBuf === "string" ? Buffer.from(rawHexOrBuf, "hex") : rawHexOrBuf;
  return subtle.importKey("raw", raw, { name: "Ed25519" }, true, ["verify"]);
}
export async function importMemberSeed(seedBuf) {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seedBuf]);
  return subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
}
export async function genMemberKey() {
  return subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
}
export async function rawPubOf(keyPair) {
  return Buffer.from(await subtle.exportKey("raw", keyPair.publicKey));
}

export function hashRevision(rev) {
  return createHash("sha256").update(canonicalJson(rev)).digest("hex");
}

async function signRevision(base, privateKey) {
  const sig = Buffer.from(await subtle.sign({ name: "Ed25519" }, privateKey,
    Buffer.from(canonicalJson(base), "utf8"))).toString("hex");
  return { ...base, sig_ed25519: sig };
}

export async function genesisRevision({ agent, body, memberPrivateKey, ts = new Date().toISOString() }) {
  return signRevision({ v: A1_VERSION, agent, rev: 0, prev: "", body, ts }, memberPrivateKey);
}

export async function appendRevision({ agent, prevRevision, body, memberPrivateKey, ts = new Date().toISOString() }) {
  return signRevision({ v: A1_VERSION, agent, rev: prevRevision.rev + 1,
    prev: hashRevision(prevRevision), body, ts }, memberPrivateKey);
}

// the resolver's law: highest VALID revision wins
export async function verifyChain(revisions, memberPublicKey) {
  const sorted = [...revisions].sort((a, b) => a.rev - b.rev);
  let expectedPrev = "";
  for (const r of sorted) {
    if (r.v !== A1_VERSION) return { ok: false, reason: "unknown a1 version at rev " + r.rev };
    if (r.prev !== expectedPrev)
      return { ok: false, reason: "hash chain breaks at rev " + r.rev };
    const { sig_ed25519, ...base } = r;
    const good = await subtle.verify({ name: "Ed25519" }, memberPublicKey,
      Buffer.from(sig_ed25519, "hex"), Buffer.from(canonicalJson(base), "utf8"));
    if (!good) return { ok: false, reason: "signature invalid at rev " + r.rev };
    expectedPrev = hashRevision(r);
  }
  const head = sorted[sorted.length - 1];
  return { ok: true, head, headHash: expectedPrev };
}

// self-test: node a1.mjs
if (process.argv[1].endsWith("a1.mjs")) {
  const kp = await genMemberKey();
  const r0 = await genesisRevision({ agent: "selftest", body: { note: "genesis" }, memberPrivateKey: kp.privateKey });
  const r1 = await appendRevision({ agent: "selftest", prevRevision: r0, body: { note: "learned a thing" }, memberPrivateKey: kp.privateKey });
  const r2 = await appendRevision({ agent: "selftest", prevRevision: r1, body: { note: "remembered more" }, memberPrivateKey: kp.privateKey });
  const ok = await verifyChain([r2, r0, r1], kp.publicKey); // shuffled on purpose
  const tampered = structuredClone(r1); tampered.body.note = "forged";
  const bad = await verifyChain([r0, tampered, r2], kp.publicKey);
  console.log("chain of 3 (shuffled):", ok.ok ? "VERIFIES, head rev " + ok.head.rev : ok.reason);
  console.log("tampered middle revision:", bad.ok ? "ACCEPTED (BUG)" : "REFUSED — " + bad.reason);
  process.exit(ok.ok && !bad.ok ? 0 : 1);
}
