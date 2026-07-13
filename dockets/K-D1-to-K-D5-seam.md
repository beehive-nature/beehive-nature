# DOCKETS K-D1 → K-D5 — BIND-1 §11 Seam Implementation

Authority: BIND-1 v0.1 (docs/BIND-1.md @ kernel main `5a1f30ba`, sha c5025945…) · CONSTITUTION.md primitives · ORDERS-1 v0.7.
Repo: **beehive-nature/beehive-nature** (the kernel — separate tree from LOVErnment-DAO).
Executor: Seat 4, **own kernel clone** (`C:\Users\travi\lobster\beehive-nature` — PREREQUISITE: clone + verify `remote -v` points at github.com/beehive-nature, not the local seed folder, before any dispatch). Delivery law: branch `seat4/kNNN` off kernel `main`, push branch only, Seat 3 sole merger, red-first, digests after commit via Git Bash sha256sum on stdin.

These five run **in parallel with the voice endgame** — different repo, no tree contention. Sequential among themselves (each builds on the last's types). All offline; no network, no credentials anywhere in this bundle.

---

## K-D1 — Promote `Evidence` to `shared-types` (K-6)

**Files:** `crates/shared-types/src/evidence.rs` (new) + tests. Wire into the crate.
Per K-6: `Evidence` moves from its dispute-engine home to `shared-types` as the **general primitive** — `provenance, confidence, signed, verified, payload_hash` + the seam extensions `subject_did, source_ref, validator_digest, view_grade`. `Provenance` enum gains `SignedSelfAttestation`; `AiInference` stays as-is. Dispute-engine then **wraps** the general primitive, restoring its `favors: Side` as a domain field — that wrapper edit is part of this docket (dispute-engine must still compile and its tests stay green).
**Red-first:** existing dispute-engine tests must pass against the wrapped type (red if the wrap breaks them); new tests pin the seam extension fields and the `SignedSelfAttestation` variant. **This is the load-bearing docket — every later one depends on these types.**

## K-D2 — `EventType` + `SourceChain` variants (K-6)

**Files:** `crates/shared-types/src/events.rs` + tests.
`SourceChain::AtProto` added. `EventType` gains, **additively, under `#[non_exhaustive]` discipline**: `PerformanceSetPublished`, `SocialRecordRetracted`, `CircleConcluded`, `EmissionMinted`, `AgentPublicationLogged`. `source_ref` convention documented as `at://<did>/<collection>/<rkey>#<cid>`; `canonicalized_by` = `"sense-atproto"`.
**Red-first:** a test pinning that all existing `EventType` matches still compile (non_exhaustive discipline holds); new variants round-trip through serde. No existing variant renamed or removed — versioned by addition only.

## K-D3 — `sense-atproto` crate skeleton + the predicate (K-4)

**Files:** new crate `crates/sense-atproto` + its negative suite.
The K-4 four-step predicate as pure, offline logic over injected inputs (commit facts, pinned cid, validator hook, allowlist): **(1)** commit-signature-verified flag checked; **(2)** bytes re-hashed vs pinned cid; **(3)** product-validator green with its digest recorded into the Evidence provenance; **(4)** type on the allowlist; **default-deny.** `normalize()` is pure — same inputs, same Events.
**Red-first — the marquee negatives (MUST NOT cross):** unsigned/invalid-sig commit; cid mismatch; validator-red; unlisted type; and **instruction-shaped text in a signed record's string fields** quoted as inert data, never interpreted (Q-8's lesson at ingest — *signed proves provenance, never benignity*). Positive: a valid signed allowlisted record → correct Event+Evidence pair. No network; the "fetch" is an injected trait.

## K-D4 — `IndependentSocialView` type boundary (K-5)

**Files:** in `sense-atproto` (or `shared-types` if the DRO view lives there — match the existing `IndependentChainView` home).
The type-level sibling of R-004's `IndependentChainView`: a settlement-grade read requires N-of-M disjoint sources or a direct PDS read-back, and the **grade only rises** (K-7). Model the grade enum (informational/confirmed/settlement) and the constructor that refuses to mint `settlement` from a single source or without the bidirectional `did:plc ↔ did:autonomi` binding.
**Red-first:** single-source → cannot construct settlement; two disjoint sources → confirmed; the PLC-op-log-≥2-views + did:autonomi bind → settlement; a downgrade attempt fails (grades are monotonic).

## K-D5 — Retraction wiring + idempotent `event_id` (K-7)

**Files:** `sense-atproto` retraction path + property tests.
`SocialRecordRetracted` emission referencing the original; the original Event/Evidence **stand immutable** (retraction informs confidence, never erases). Deterministic `event_id` from `(source_chain, source_ref)` so the same publication witnessed twice — replay, backfill, second source — **collapses to one Event**, and re-witness **raises `view_grade`**.
**Red-first + property test:** for any interleaving of (original, retraction, duplicate-sighting), the Event set is idempotent on `event_id` and the original is never mutated; a deletion of a never-crossed record emits nothing.

---

## Acceptance (each docket)

Red witnessed at commit A; commit B green across the kernel `cargo test --workspace`; digests declared post-commit against the commit's own objects. Push `seat4/kNNN` only; Seat 3 reviews per standing law and merges `--no-ff`, pruning the branch on merge. K-D1 first (types), then K-D2..K-D5 in order.

**Scope discipline:** these implement BIND-1 as ratified. Any schema question BIND-1 did not settle is out of scope — surface it to Seat 1 as a docket note, never resolve it in code. Adapter classes and allowlist additions remain founder gates (K-4/Q-8).
