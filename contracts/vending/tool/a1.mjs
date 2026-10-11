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
// v1 revision (plain JSON, canonical like the certificate):
//   { v: 1, agent, rev, prev, body, sig_ed25519, ts }
//     prev = "" for genesis, else the prior revision's sha256
//     sig  = ed25519 (WebCrypto) over the canonical JSON without sig
//   v1 only asks for ed25519, so whoever can forge ed25519 (a large quantum
//   computer running Shor) can append the next revision and become the head.
//
// v2 revision (additive; v1 logs keep verifying exactly as before):
//   { v: 2, agent, rev, prev, body, ts, pq, sig_ed25519, sig_ml_dsa_65 }
//     pq at genesis   { alg: "ml-dsa-65", id, dsa, succ } — the PINNED key:
//                     id is the bzpq1 id of SPEC-BPQ-1 §2, dsa and succ are
//                     that id's public card fields (base64url). The key is
//                     BPQ.keys(member ed25519 seed, "a1:" + agent).
//     pq later        { alg: "ml-dsa-65", id } — must name the genesis id.
//     sig_ed25519     ed25519 over the canonical JSON without the two sig
//                     fields (hex, as v1)
//     sig_ml_dsa_65   ML-DSA-65 over UTF-8("a1/v2/pq") ‖ those SAME canonical
//                     bytes ‖ the 64 raw bytes of sig_ed25519 (base64url,
//                     3309 B decoded). Binding the classical signature in is
//                     load-bearing: a revision's hash covers both signatures,
//                     so without it whoever forges ed25519 could re-sign the
//                     same body with a fresh nonce, keep the owner's ML-DSA
//                     signature, and mint a second valid revision at every
//                     height (a fork that blocks the resolver forever).
//   A v2 revision counts only when every revision from genesis to it carries
//   a valid ed25519 AND a valid ML-DSA-65 signature from the genesis-pinned
//   key, revs run 0,1,2… and prev links hold. A chain never mixes versions.
//   A v2 chain is read against a PIN from the birth certificate (store
//   binding a1_genesis.sha256 or a1_genesis.pq_id): without one, whoever
//   forges ed25519 could stand up a whole new genesis under a PQ key of their
//   own. v2 has no key rotation: the succession commitment (SPEC-BPQ-1 §5) is
//   pinned through `succ`, and a rotation revision is not defined yet.
//   Why the member seed: a discrete-log break recovers ed25519's secret
//   scalar (cut from SHA-512 of the seed), not the seed, and the PQ key is
//   HKDF of the seed — that break alone does not yield the PQ key.
//
// HONEST SCOPE: this module defines + proves the FORMAT. The funded Autonomi
// write is gated on the ANT custody review (storage-substrate-split item 8)
// and never priced at zero (R3). The certificate's store binding carries the
// a1 genesis head, so the day the store is funded it is verifiable against
// this record.
import { createHash } from "node:crypto";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { canonicalJson } from "./cert.mjs";

const A1_VERSION = 1;
const A1_V2 = 2;
const PQ_ALG = "ml-dsa-65";
const PQ_DOMAIN = "a1/v2/pq";
const PQ_CONTEXT = (agent) => "a1:" + agent;
const subtle = webcrypto.subtle;

// the estate's PQ library (surfaces/bpq.js over bpq-lib.js), loaded only when
// a v2 record is made or read; v1 never touches it
const requireHere = createRequire(import.meta.url);
function pqlib() {
  if (!globalThis.BPQ || !globalThis.BPQ_LIB) {
    requireHere("../../../surfaces/onboarding/vendor/bpq-lib.js");
    requireHere("../../../surfaces/bpq.js");
  }
  if (!globalThis.BPQ || !globalThis.BPQ_LIB)
    throw new Error("a1 v2 needs the post-quantum library (surfaces/bpq.js); it did not load");
  return { B: globalThis.BPQ, L: globalThis.BPQ_LIB };
}

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

// the agent's PQ keys: BPQ.keys(member ed25519 seed, "a1:" + agent). The
// caller wipes them (keys.wipe()) when done; the seed re-derives them.
export function a1PqKeys(memberSeed32, agent) {
  if (typeof agent !== "string" || !agent) throw new Error("a1 v2: agent must be a non-empty string");
  return pqlib().B.keys(memberSeed32, PQ_CONTEXT(agent));
}

export function hashRevision(rev) {
  return createHash("sha256").update(canonicalJson(rev)).digest("hex");
}

async function signRevision(base, privateKey) {
  const sig = Buffer.from(await subtle.sign({ name: "Ed25519" }, privateKey,
    Buffer.from(canonicalJson(base), "utf8"))).toString("hex");
  return { ...base, sig_ed25519: sig };
}

// what the ML-DSA-65 signature covers: domain ‖ canonical base ‖ ed25519 sig
function pqMessage(canon, edHex) {
  return Buffer.concat([Buffer.from(PQ_DOMAIN + canon, "utf8"), Buffer.from(edHex, "hex")]);
}

// v2: ed25519 over the canonical base, then ML-DSA-65 over that and the ed25519 signature
async function signRevisionV2(base, privateKey, pqKeys) {
  const { B } = pqlib();
  const canon = canonicalJson(base);
  const ed = Buffer.from(await subtle.sign({ name: "Ed25519" }, privateKey, Buffer.from(canon, "utf8"))).toString("hex");
  const ml = B.b64u(pqKeys.dsa.sign(pqMessage(canon, ed)));
  return { ...base, sig_ed25519: ed, sig_ml_dsa_65: ml };
}

function pqKeysFor(pqKeys, agent) {
  if (!pqKeys || !pqKeys.dsa || typeof pqKeys.dsa.sign !== "function" || !pqKeys.succession)
    throw new Error("a1 v2 needs the agent's PQ keys (a1PqKeys(member seed, agent))");
  if (pqKeys.context !== PQ_CONTEXT(agent))
    throw new Error("a1 v2: the PQ keys were derived for context " + JSON.stringify(pqKeys.context) +
      ", not " + JSON.stringify(PQ_CONTEXT(agent)));
  return pqKeys;
}

export async function genesisRevision({ agent, body, memberPrivateKey, ts = new Date().toISOString() }) {
  return signRevision({ v: A1_VERSION, agent, rev: 0, prev: "", body, ts }, memberPrivateKey);
}

export async function genesisRevisionV2({ agent, body, memberPrivateKey, pqKeys, ts = new Date().toISOString() }) {
  const k = pqKeysFor(pqKeys, agent);
  const { B } = pqlib();
  return signRevisionV2({ v: A1_V2, agent, rev: 0, prev: "", body, ts,
    pq: { alg: PQ_ALG, id: k.id, dsa: B.b64u(k.dsa.publicKey), succ: B.b64u(k.succession.commit) } },
    memberPrivateKey, k);
}

// the next revision keeps the chain's version: a v1 chain stays v1 (no PQ
// keys taken), a v2 chain needs the PQ keys its genesis pinned
export async function appendRevision({ agent, prevRevision, body, memberPrivateKey, pqKeys, ts = new Date().toISOString() }) {
  if (prevRevision.v === A1_V2) {
    const k = pqKeysFor(pqKeys, agent);
    if (prevRevision.agent !== agent) throw new Error("a1 v2: the chain belongs to agent " + JSON.stringify(prevRevision.agent));
    if (!prevRevision.pq || prevRevision.pq.id !== k.id)
      throw new Error("a1 v2: these PQ keys are not the key this chain pinned at genesis");
    return signRevisionV2({ v: A1_V2, agent, rev: prevRevision.rev + 1, prev: hashRevision(prevRevision),
      body, ts, pq: { alg: PQ_ALG, id: k.id } }, memberPrivateKey, k);
  }
  if (pqKeys !== undefined)
    throw new Error("a v1 chain stays v1; a post-quantum log starts from a v2 genesis");
  return signRevision({ v: A1_VERSION, agent, rev: prevRevision.rev + 1,
    prev: hashRevision(prevRevision), body, ts }, memberPrivateKey);
}

// ── v2 validity (shared by verifyChain and resolveHead) ─────────────────────
const keysOf = (o) => Object.keys(o).sort().join(",");
const V2_FIELDS = keysOf({ v: 0, agent: 0, rev: 0, prev: 0, body: 0, ts: 0, pq: 0, sig_ed25519: 0, sig_ml_dsa_65: 0 });
const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);

function pinsOf(pins) {
  const p = pins == null ? {} : pins;
  if (!isObj(p)) throw new TypeError("pins must be an object { genesisHash?, pqId?, legacyV1Unpinned? }");
  if (p.legacyV1Unpinned !== undefined && p.legacyV1Unpinned !== true)
    throw new TypeError("pins.legacyV1Unpinned is either absent or true");
  if (p.genesisHash !== undefined && !(typeof p.genesisHash === "string" && /^[0-9a-f]{64}$/.test(p.genesisHash)))
    throw new TypeError("pins.genesisHash must be 64 lowercase hex characters");
  if (p.pqId !== undefined && !(typeof p.pqId === "string" && /^bzpq1[02-9ac-hj-np-z]+$/.test(p.pqId)))
    throw new TypeError("pins.pqId must be a bzpq1 id");
  return { genesisHash: p.genesisHash, pqId: p.pqId, legacyV1Unpinned: p.legacyV1Unpinned === true };
}

// the genesis-pinned key: { id, dsa } or a reason string
function pinnedKey(g) {
  const { B } = pqlib();
  const pq = g.pq;
  if (!isObj(pq)) return "the v2 genesis pins no post-quantum key";
  if (pq.alg !== PQ_ALG) return "unknown post-quantum algorithm " + JSON.stringify(pq.alg);
  if (keysOf(pq) !== "alg,dsa,id,succ") return "the v2 genesis pq block must hold exactly alg, id, dsa, succ";
  let dsa, succ;
  try { dsa = B.unb64u(pq.dsa); succ = B.unb64u(pq.succ); } catch { return "the pinned key is not base64url"; }
  if (dsa.length !== 1952 || succ.length !== 32) return "the pinned key has the wrong length";
  if (B.idFrom(dsa, succ) !== pq.id) return "the pinned pq id does not match its key";
  return { id: pq.id, dsa };
}

// one v2 revision against the chain's genesis context; null = valid
async function v2Reason(r, ctx, memberPublicKey) {
  const { B, L } = pqlib();
  if (keysOf(r) !== V2_FIELDS) return "a v2 revision holds exactly " + V2_FIELDS;
  if (r.agent !== ctx.agent) return "the revision names another agent";
  if (typeof r.ts !== "string") return "ts must be a string";
  if (r.rev !== 0 && !(isObj(r.pq) && keysOf(r.pq) === "alg,id")) return "after genesis the pq block holds exactly alg, id";
  if (r.pq.alg !== PQ_ALG) return "unknown post-quantum algorithm " + JSON.stringify(r.pq.alg);
  if (r.pq.id !== ctx.id) return "the revision names a pq id other than the one pinned at genesis";
  if (typeof r.sig_ed25519 !== "string" || !/^[0-9a-f]{128}$/.test(r.sig_ed25519)) return "sig_ed25519 must be 128 lowercase hex characters";
  let ml;
  try { ml = B.unb64u(r.sig_ml_dsa_65); } catch { return "sig_ml_dsa_65 is not base64url"; }
  if (ml.length !== 3309) return "sig_ml_dsa_65 has the wrong length";
  const { sig_ed25519, sig_ml_dsa_65, ...base } = r;
  const canon = canonicalJson(base);
  const edGood = await subtle.verify({ name: "Ed25519" }, memberPublicKey,
    Buffer.from(sig_ed25519, "hex"), Buffer.from(canon, "utf8"));
  if (!edGood) return "ed25519 signature invalid";
  if (!L.ml_dsa65.verify(ml, pqMessage(canon, sig_ed25519), ctx.dsa))
    return "ML-DSA-65 signature does not verify under the pinned key";
  return null;
}

// a genesis's context { v, agent, id?, dsa? } or a reason string
async function genesisContext(g, gHash, memberPublicKey, pins) {
  if (!isObj(g) || g.rev !== 0 || g.prev !== "") return "not a genesis (rev 0, prev \"\")";
  if (pins.genesisHash !== undefined && gHash !== pins.genesisHash) return "not the pinned genesis";
  if (g.v === A1_VERSION) {
    if (pins.pqId !== undefined) return "a pq id is pinned, but a v1 genesis carries none";
    const { sig_ed25519, ...base } = g;
    const good = await subtle.verify({ name: "Ed25519" }, memberPublicKey,
      Buffer.from(sig_ed25519, "hex"), Buffer.from(canonicalJson(base), "utf8"));
    return good ? { v: A1_VERSION, agent: g.agent } : "signature invalid at rev 0";
  }
  if (g.v === A1_V2) {
    if (pins.genesisHash === undefined && pins.pqId === undefined)
      return "a v2 chain is read against the certificate's pin (a1_genesis.sha256 or pq_id); none was given";
    if (typeof g.agent !== "string" || !g.agent) return "agent must be a non-empty string";
    const key = pinnedKey(g);
    if (typeof key === "string") return key;
    if (pins.pqId !== undefined && key.id !== pins.pqId) return "the genesis pins a different pq id than the certificate";
    const ctx = { v: A1_V2, agent: g.agent, id: key.id, dsa: key.dsa };
    const why = await v2Reason(g, ctx, memberPublicKey);
    return why ? why + " at rev 0" : ctx;
  }
  return "unknown a1 version at rev 0";
}

// the whole given set must be ONE chain: v1 keeps its original rules byte for
// byte; v2 adds both signatures, the pinned key, the pin and runs 0,1,2…
export async function verifyChain(revisions, memberPublicKey, pins) {
  if (!Array.isArray(revisions) || !revisions.length) return { ok: false, reason: "no revisions" };
  const p = pinsOf(pins);
  const sorted = [...revisions].sort((a, b) => a.rev - b.rev);
  if (sorted[0] && sorted[0].v === A1_V2) return verifyChainV2(sorted, memberPublicKey, p);
  if (p.pqId !== undefined) return { ok: false, reason: "a pq id is pinned, but this is not a v2 chain" };
  if (p.genesisHash !== undefined && hashRevision(sorted[0]) !== p.genesisHash)
    return { ok: false, reason: "the genesis is not the pinned genesis" };
  let expectedPrev = "";
  for (const r of sorted) {
    if (r.v === A1_V2) return { ok: false, reason: "mixed chain: a v2 revision on a v1 genesis at rev " + r.rev };
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

async function verifyChainV2(sorted, memberPublicKey, pins) {
  const g = sorted[0];
  const ctx = await genesisContext(g, hashRevision(g), memberPublicKey, pins);
  if (typeof ctx === "string") return { ok: false, reason: ctx };
  let expectedPrev = hashRevision(g);
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.v === A1_VERSION) return { ok: false, reason: "mixed chain: a v1 revision on a v2 genesis at rev " + r.rev };
    if (r.v !== A1_V2) return { ok: false, reason: "unknown a1 version at rev " + r.rev };
    if (r.rev !== i) return { ok: false, reason: "revs must run 0,1,2… (fork or gap at rev " + r.rev + ")" };
    if (r.prev !== expectedPrev) return { ok: false, reason: "hash chain breaks at rev " + r.rev };
    const why = await v2Reason(r, ctx, memberPublicKey);
    if (why) return { ok: false, reason: why + " at rev " + r.rev };
    expectedPrev = hashRevision(r);
  }
  return { ok: true, head: sorted[sorted.length - 1], headHash: expectedPrev, pqId: ctx.id };
}

// THE RESOLVER — the A1 rule as ruled (A1_LAYER1_AMENDMENT_2026-08-07): the
// store is an append-only SET anyone may add to, so it can hold forks,
// replays and forgeries. A revision counts only if its whole chain back to a
// genesis is valid under that genesis's version (v1 rules for v1, both
// signatures and the pinned key for v2, never mixed) and its rev is its
// parent's plus one; the head is the highest revision that counts. Revisions
// that do not count are ignored, never fatal. Two distinct revisions that
// count at the top height are a fork: the ruling breaks ties "by content-hash
// order" but names no direction, so this resolver reports the fork and picks
// neither. The resolver always reads against the certificate's pin: without
// one, an ed25519 forger could drop a v1 genesis of their own into a v2
// agent's store and be resolved as its head. Only a reader of a v1-only store
// may opt out, explicitly, with { legacyV1Unpinned: true }.
export async function resolveHead(revisions, memberPublicKey, pins) {
  const p = pinsOf(pins);
  if (p.genesisHash === undefined && p.pqId === undefined && !p.legacyV1Unpinned)
    return { ok: false, reason: "resolveHead reads against the certificate's pin (genesisHash or pqId); a v1-only reader may pass { legacyV1Unpinned: true }", ignored: [] };
  const byHash = new Map();
  for (const r of Array.isArray(revisions) ? revisions : []) {
    if (!isObj(r)) continue;
    let h; try { h = hashRevision(r); } catch { continue; }
    if (!byHash.has(h)) byHash.set(h, r);
  }
  const children = new Map();
  for (const [h, r] of byHash) {
    if (typeof r.prev !== "string") continue;
    if (!children.has(r.prev)) children.set(r.prev, []);
    children.get(r.prev).push(h);
  }
  const ignored = [];
  let level = [];
  for (const h of children.get("") || []) {
    let ctx;
    try { ctx = await genesisContext(byHash.get(h), h, memberPublicKey, p); } catch (e) { ctx = e.message; }
    if (typeof ctx === "string") ignored.push({ hash: h, why: ctx });
    else level.push({ h, r: byHash.get(h), ctx });
  }
  if (!level.length) return { ok: false, reason: "no valid genesis", ignored };
  let top = level;
  while (level.length) {
    const next = [];
    for (const node of level) {
      for (const h of children.get(node.h) || []) {
        const r = byHash.get(h);
        let why;
        try {
          if (r.v !== node.ctx.v) why = "mixed chain: a v" + r.v + " revision on a v" + node.ctx.v + " genesis";
          else if (r.rev !== node.r.rev + 1) why = "rev must be its parent's plus one";
          else if (r.v === A1_V2) why = await v2Reason(r, node.ctx, memberPublicKey);
          else {
            const { sig_ed25519, ...base } = r;
            const good = await subtle.verify({ name: "Ed25519" }, memberPublicKey,
              Buffer.from(sig_ed25519, "hex"), Buffer.from(canonicalJson(base), "utf8"));
            why = good ? null : "signature invalid";
          }
        } catch (e) { why = e.message; }
        if (why) ignored.push({ hash: h, why });
        else next.push({ h, r, ctx: node.ctx });
      }
    }
    if (next.length) top = next;
    level = next;
  }
  if (top.length > 1)
    return { ok: false, reason: "fork at rev " + top[0].r.rev + ": " + top.length +
      " valid revisions; the A1 rule breaks ties by content-hash order but the ruling names no direction",
      fork: top.map((n) => n.h).sort(), ignored };
  const head = top[0];
  return { ok: true, head: head.r, headHash: head.h, version: head.ctx.v,
    ...(head.ctx.v === A1_V2 ? { pqId: head.ctx.id } : {}), ignored };
}

// the certificate's store binding for a genesis (the page's twin is
// surfaces/vending-cert.js storeBinding; e2e/vending-cert.test.mjs holds them
// equal). v1 text is unchanged byte for byte.
const FUNDED_WRITE_STATUS = "GATED on the ANT custody review (storage-substrate-split item 8); the binding is derivable from this certificate the day it is funded";
export function storeBinding(genesis, genesisHash) {
  if (genesis.v === A1_VERSION) return { store: "autonomi",
    binding: "a1-log v1 — append-only hash-linked revisions, owner-signed ed25519 (this member key); resolver takes the highest valid revision; deletable by the member",
    a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts },
    funded_write_status: FUNDED_WRITE_STATUS };
  if (genesis.v === A1_V2) return { store: "autonomi",
    binding: "a1-log v2 — append-only hash-linked revisions, each signed twice: ed25519 (this member key) over the canonical bytes, and ML-DSA-65 (the post-quantum key pinned at genesis, a1_genesis.pq_id) over those bytes and the ed25519 signature; a revision counts only if every revision back to this genesis carries both; resolver takes the highest valid revision; deletable by the member",
    a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts, pq_id: genesis.pq.id },
    funded_write_status: FUNDED_WRITE_STATUS };
  throw new Error("unknown a1 version " + JSON.stringify(genesis.v));
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
