<!--
STATUS: ADOPTED 2026-07-04 — reviewed through the one-door convention.
Integrity verified. The §6/§11 recovery contradiction flagged in review
was resolved concurrently by the research lane (§11 now marks the contest
window as the design in force; only its duration remains tunable).
Retires: brief §L0 open item "exact DID linkage proof format (signed attestation
stored on Autonomi, referenced from the DID doc)"; specifies the `identity.root`
reference implementation named in CONSTITUTION.md Appendix.
License: CC-BY-4.0 (publish; a spec others can verify against is anti-capture).
Step-zero sources read: CONSTITUTION.md (Art. II Identity invariants, Appendix),
docs/bnature-build-brief.md (L0 Identity), docs/architecture/handoff-v1.3.md
(SLIP-0010 derivation), W3C DID-Core 1.0.
-->

# The `did:autonomi` DID Method — v1 (draft)

A self-authenticating Decentralized Identifier method whose identifier is bound
to a **genesis key** and whose current state is derived by replaying an
**append-only, signed rotation log** stored in an Autonomi mutable register.
Conforms to W3C DID-Core 1.0.

It is the reference implementation of the kernel's `identity.root` capability.
Every kernel Identity invariant maps to a concrete rule below:

| CONSTITUTION invariant | Where enforced here |
|---|---|
| Records key off the **DID**, never raw keys; rotation never orphans data | §3 (stable id), §6 Resolve (state derived, data keyed to DID) |
| Rotation log records **key algorithm**, not just key material (crypto-agility) | §5 `keyAlg` mandatory per op; §7 algorithm migration by ordinary rotate |
| Attestation is **tiered, recorded as evidence not status** | §4 `verificationMethod` carries tier metadata; policy lives above the method |
| Cross-identity links verifiable only when **bidirectional** | §8 both-sided attestation, single-sided MUST be treated as unlinked |

---

## 1. Method name
The method name is `autonomi`. A conforming DID begins `did:autonomi:`.

## 2. Root of trust (out of method scope, referenced)
The controlling keypair is derived from the user's hardware-wallet seed
(Trezor, frozen SLIP-0010/1018 path, proto v0.3 — see `handoff-v1.3.md`). The
same root derives Zano wallet keys, Veilid/libp2p node identity, and Autonomi
client keys. This method governs only the *identifier and its key lifecycle*, not
the seed scheme.

## 3. Method-specific identifier (self-certifying, rotation-stable)
The identifier is bound to the **genesis operation**, never to the current key —
so keys rotate without changing the DID (the "never orphan data" invariant).

```
id  = base32-lower-nopad( SHA-256( canonical-CBOR( genesis_op ) ) )[0..24 chars]
DID = "did:autonomi:" + id
```

`genesis_op` is the `seq: 0` log entry (§5). The id is *self-certifying*: any
resolver recomputes `SHA-256(CBOR(genesis_op))` and checks it matches, so a host
cannot serve a genesis that doesn't hash to the DID it claims. (Mirrors the
`did:plc` genesis-hash pattern, but self-hosted on Autonomi rather than on a
directory operator.)

## 4. DID Document (derived, never stored raw)
The document is the **product of replaying the log** (§6), not a stored file.
Current shape:

```jsonc
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:autonomi:<id>",
  "verificationMethod": [{
    "id": "did:autonomi:<id>#<kid>",
    "type": "Multikey",
    "controller": "did:autonomi:<id>",
    "publicKeyMultibase": "z...",
    "bnAlg": "ed25519",          // explicit algorithm (crypto-agility)
    "bnTier": "hardware"         // software | passkey | hardware — EVIDENCE, not status
  }],
  "authentication":  ["did:autonomi:<id>#<kid>"],
  "assertionMethod": ["did:autonomi:<id>#<kid>"],
  "keyAgreement":    ["did:autonomi:<id>#<enc-kid>"],
  "alsoKnownAs":     ["did:plc:<p>"],   // present ONLY if §8 bidirectional link verifies
  "service": [
    { "id": "#storage", "type": "AutonomiRegister", "serviceEndpoint": "autonomi://<register-addr>" },
    { "id": "#persona", "type": "PersonaLink",       "serviceEndpoint": "autonomi://<link-attestation-addr>" }
  ]
}
```
`bnTier` records *which* attestor tier holds the key as evidence; the kernel
never decides what tier an action requires — application policy does.

## 5. Storage: the append-only rotation log
State lives as an ordered, hash-chained, signed log in **one Autonomi mutable
register** whose network address is a deterministic function of the DID, so a
resolver needs only the DID to locate it:

```
register_addr = blake3( "did:autonomi/v1/log/" || id )
```

Reads are public and trustless (integrity comes from the signature chain, not
from trusting the host); **writes are gated to the current authorized key** by
the register's ownership. Each entry:

```jsonc
{
  "seq": 0,
  "prev": null,                      // multibase SHA-256 of previous entry's canonical bytes; hash chain
  "op": "genesis",                   // genesis | rotate | update | recover | deactivate
  "keyAlg": "ed25519",               // MANDATORY — the algorithm of authKeys in THIS state
  "authKeys": [{ "kid": "key-1", "alg": "ed25519", "pubMultibase": "z...", "tier": "hardware" }],
  "recoveryCommit": "b...",          // SHA-256 of the NEXT recovery key (pre-rotation commitment)
  "services": [ /* optional; see §4 */ ],
  "created": "2026-07-04T00:00:00Z",
  "sig": "z..."                      // signature over the entry sans `sig`, by a key valid in the
                                     // PREVIOUS state (genesis self-signs with authKeys[0])
}
```

## 6. Operations (CRUD)
- **Create** — publish the `genesis` op to `register_addr`; derive `id` from it (§3). The genesis `sig` is a self-signature by `authKeys[0]`.
- **Resolve (Read)** — the trustless core:
  1. Locate `register_addr = blake3("did:autonomi/v1/log/" || id)`; fetch the full log.
  2. Verify `seq 0` is a `genesis` op and `id == base32(SHA-256(CBOR(entry0)))`. Reject otherwise.
  3. For each `seq n>0`: check `prev` equals `SHA-256(entry[n-1])` (unbroken chain), and verify `sig` against a key **authorized in state `n-1`** — or, for a `recover` op, against a key whose hash equals state `n-1`'s `recoveryCommit`.
  4. **Permanence cross-check.** Verify the current log-head hash against the most recent Arweave permanence anchor (§9). An inconsistency is a **hard failure** — resolution MUST error, not return a document. This is what makes append-only integrity independent of Autonomi register semantics: even a rewritable register cannot rewrite *undetectably*, because a rewrite that outruns the anchor fails this check.
  5. Fold ops into current state; emit the DID Document (§4). A trailing `deactivate` yields `deactivated: true` and an empty document.
- **Update / Rotate** — append a signed op changing keys, algorithm, `recoveryCommit`, or services. Signed by a **current** authorized key.
- **Recover** — append a `recover` op signed by the pre-committed recovery key. It does **not** take effect immediately: it opens a **contest window** (did:plc precedent: 72h, tunable) during which a higher-priority key — the pre-committed recovery key or an as-yet-unrevoked prior auth key — can override it with a counter-op. Rationale: recovery MUST be slower than theft-detection, because an instantly-effective recovery key is itself instant, uncontestable identity theft — recovery would *become* the attack surface. Only after the window closes uncontested does the `recover` op supersede the prior auth set.
- **Deactivate** — append a signed terminal `deactivate` op.

## 7. Crypto-agility (constitutional)
`keyAlg` is mandatory on every op, so the signature scheme is *data*, never a
hardcoded assumption. A `rotate` op MAY change `keyAlg` (e.g.
`ed25519 → ml-dsa-65` when post-quantum migration is due); the new key set is
signed by the **old** key — migration by ordinary rotation, exactly the
invariant. Resolvers MUST implement algorithm agility (dispatch verification on
`keyAlg`) and MUST reject ops in an algorithm they cannot verify rather than
skip them.

## 8. Bidirectional persona link (`did:plc`) — the format this spec closes
The brief's open item. A link between `did:autonomi:<a>` and `did:plc:<p>` is
verified **only when both directions exist and reference each other** — a single
side is an unverified claim and MUST NOT populate `alsoKnownAs`.

**Direction A — autonomi → plc** (stored on Autonomi, referenced from the DID doc `#persona` service):
```jsonc
{
  "type": "PersonaLink/v1",
  "iss": "did:autonomi:<a>",
  "subject": "did:plc:<p>",
  "created": "2026-07-04T00:00:00Z",
  "nonce": "<random>",
  "proof": { "alg": "ed25519", "verificationMethod": "did:autonomi:<a>#key-1", "sig": "z..." }
}
```

**Direction B — plc → autonomi**: the `did:plc` operation log carries
`alsoKnownAs: ["did:autonomi:<a>"]` (or an equivalent attestation), signed by a
`did:plc` rotation key per the PLC method.

**Verification (both required):**
1. Resolve A; verify `proof.sig` against `did:autonomi:<a>`'s current auth key.
2. Resolve `did:plc:<p>`; confirm its `alsoKnownAs` contains `did:autonomi:<a>` under a valid PLC signature.
3. Confirm A.subject == the plc DID and B's back-reference == the autonomi DID (mutual).
4. Only then MAY resolvers surface the `alsoKnownAs` link. Revocation = either side removes its reference by an ordinary signed op.

## 9. Security considerations
- **Log availability, censorship, AND append-only integrity.** The register is
  the single source of live state. Anchor the **log-head hash** into the daily
  Arweave bundle (`crates/adapter-arweave`) so the log's integrity — and
  last-known head — survive even if the Autonomi register is lost or withheld.
  This does double duty: it also **removes the dependency on whether Autonomi
  registers are truly append-only.** Whether an owner *could* rewrite a register
  no longer has to be trusted, because §6 step 4 checks the head against the
  anchor and hard-fails on inconsistency — a rewrite is detectable regardless of
  register semantics. Defense-in-depth substituting for an unverified vendor
  claim, which is the Verification Principle's favorite move.
- **Equivocation / forking.** One owner + a hash chain makes a fork *evident*
  (two entries sharing a `prev`); the Arweave head-anchor gives an
  independent witness of the canonical head. Optional hardening: anchor the head
  to a ledger for total ordering.
- **Key compromise.** The `recoveryCommit` pre-commitment lets an owner recover
  from a stolen signing key without pre-sharing the recovery key material.
- **Genesis binding.** The self-certifying id (§3) prevents a host from
  substituting a different genesis under the same DID.

## 10. Privacy considerations
The DID is pseudonymous; DID Documents MUST NOT carry PII. Persona correlation
to `did:plc` is opt-in and gated on the bidirectional proof (§8), so linkage is
always a deliberate, revocable act by the identity owner — never inferred.

## 11. Open items for review (not blockers)
- **(Downgraded: load-bearing → nice-to-know.)** Whether Autonomi registers
  guarantee append-only history is no longer a dependency — the hash chain plus
  the daily permanence-anchor cross-check (§6 step 4, §9) detect any rewrite
  regardless. Confirming the exact Autonomi type (Register vs Pointer vs
  Scratchpad) for `register_addr` remains an ordinary implementation choice for
  Code against the Autonomi client API.
- Confirm the multicodec/`bnAlg` string table for the algorithms in scope
  (ed25519, p256, ml-dsa-65) against the W3C Multikey registry.
- **(Resolved — see §6 Recover.)** `recover` adopts a did:plc-style contest
  window rather than taking effect immediately; the only remaining choice is
  tuning the duration (72h is the starting point).

---
_This is a method specification, not legal or security advice; it is intended for
implementation review and public verification._
