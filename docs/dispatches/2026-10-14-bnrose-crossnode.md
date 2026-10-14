# 2026-10-14 — BNROSE cross-node execution: the first independent-sovereigns beat (dual acceptance characterized, destination-side enforcement proven load-bearing)

The review disposition (post-#421) named two evidence-bearing beats:
the Cryptol formal twin (taken by this lane's sibling seat as PR #424
— reviewed independently below) and independent cross-node execution.
This dispatch delivers the cross-node beat:
`crates/bnrose-exec-host/tests/crossnode.rs`, branch
`zcode/bnrose-crossnode-2026-10-14`, cut from main `0f3071905`.

## The boundary, held explicit

The OS-atomic supervisor.claim proves LOCAL process exclusivity on
ONE node. It is not a global P2P exclusivity mechanism and not
consensus. The suite's first finding IS the boundary: two sovereign
nodes (independent state directories, independent roots, independent
receipt authorities) independently ACCEPT the same (authority, nonce)
intent — nothing in the crates prevents it, because the journals that
dedup (authority, nonce) are local to each node. No cross-node
exclusivity is claimed.

## What makes dual dispatch safe: the destination

The named coordination mechanism for this topology is the
DESTINATION's op-keyed idempotency — `EffectLedger::apply`. The
suite proves it load-bearing:

- The same intent yields the IDENTICAL op id and effect digest on
  both sovereigns (determinism across independent executions — the
  precondition for destination-side dedup).
- A destination enforcing idempotency observes EXACTLY ONE effect:
  first apply = `Applied`, the sovereign's re-apply = `Already`,
  one row total.
- Partition-then-reconcile converges without double effect in
  EITHER arrival order (two destinations, A-first and B-first).
- Each sovereign's receipt verifies under ITS OWN public key alone
  (and NOT under the other's — the authorities are independent); the
  destination validates each receipt independently.
- TEETH (negative control): a naive destination without enforcement
  lands BOTH effects — the enforcement is the mechanism, not
  decoration. External-chain destinations (Arbitrum/Hive adapters)
  carry this obligation destination-side; that wiring is a named
  follower, not claimed here.

Local receipt: 6/6 green; full battery with the suite riding:
**17 suites, 56 passed, 0 failed** (the count grows again — 50 → 56).

## Independent review note on the sibling's PR #424 (posted on the PR)

The twin's obligation structure is sound and honestly bounded (six
:prove obligations, two controls that must counterexample, the
saturation corner named, equivalence-with-compiled-Rust correctly
declined as a SAW class). The gap against the disposition's
requirement that "the implementation must be checked against it":
the correspondence is a manual definition-by-definition reading with
no mechanical sampled-agreement leg — the estate's own formal law
for WB001/WB002 gates on TYPECHECK + CHECK-SAMPLED, sampling the
implementation. Suggested cure (non-blocking): a CHECK-SAMPLED leg —
the Rust emits its replacement-gate decision over an (optIn × rows)
fixture grid and Cryptol `:eval gate` agrees — or an equivalent
Rust-side truth-table test recomputing the model's function.

## Boundaries not crossed

- No cross-node exclusivity claim, no consensus claim, no
  global-coordination mechanism invented in this beat.
- Network-level partitioning (actual wire cuts) is not simulated —
  the suite exercises the RECONCILIATION semantics (both arrival
  orders at a shared destination); a multi-process/multi-host
  harness with real partitions is the named next depth.
- The destination here is the crate's own EffectLedger; external
  destinations are named followers with destination-side enforcement.

Next natural depths: multi-process cross-node harness (real
concurrent supervisors, arrival-order races under load), external
destination adapters, and the SAW-class implementation↔model
equivalence once #424's sampled binding lands.
