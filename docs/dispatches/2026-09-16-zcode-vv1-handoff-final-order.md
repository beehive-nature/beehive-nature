# VV-1 FROZEN @ 59b02491 — final builder order with the founder's self-sufficiency invariant

**The freeze** (founder, 2026-09-16): VV-1 specification work stops at
`59b02491`. The frozen artifacts, byte-exact: `scripts/vv1-vending-pricing.mjs`
(the battery + ruled-bar oracle), `docs/agents/VV-SPECS.md` (the law, ledger,
charters, builder order), `.github/workflows/tests.yml` (the CI step). This
dispatch adds NO specification — it banks the handoff ruling and the final
order text for relay to the fresh implementation workerb.

**Why the freeze holds** (founder, verbatim substance): the oracle tightening
removed the last architectural escape hatch — "refuse when governance
changed" is no longer an acceptable substitute for preserving the economic
promise of an already-open session. Once a valid `PricingCommitment` exists,
mutable governance state is irrelevant to that session's charge semantics.

**The implementation invariant** (founder-emphasized, rides with the order):

> **The `PricingCommitment` must be self-sufficient.**
> After `opensess`, take a conceptual snapshot of the governed rate table
> and throw the table away. If the session cannot still calculate its lawful
> charge and tithe from its own persisted commitment, the commitment is
> incomplete.
>
> Therefore test:
> `open R1 → delete rate row → serialize/reopen session → charge → same R1 result`
> and:
> `open R1 → mutate R2 → restart → mutate R3 → charge → still R1`.
>
> Neither path may consult today's governed rate row to determine the
> historical economics.

That gives the serialization test real teeth: don't merely prove the new
struct round-trips — prove a **reopened session remains economically
executable without its originating rate row**.

Coverage note for the workerb: the in-memory analogs of both tests are
already frozen probes (VV-1.4a leg 1 = delete-then-charge stranding
conviction; VV-1.1/VV-1.4c = mutation and multi-regime repricing
convictions); the persistence/restart legs are the builder's re-derivation
obligation — the source pin flips the moment `vending.cpp` changes, and the
re-derived battery must carry the two named tests as probes.

**Tithe** (exact single-rounding identity, receipt shows smallest-unit
conservation at the boundary values already in the battery — 0 and 10,000):

`total = member + tithe` where `tithe = floor(total × committed_tithe_bp /
10,000)` and `member = total − tithe`.

**Legacy migration trap** (equally binding): no commitment = no historical
pricing evidence — those sessions refuse typed. Never "helpfully"
reconstruct a commitment from today's table, even when today's values
happen to equal what someone thinks the old values were.

**Return discipline** (unchanged): fresh workerb implements VV-1 → GREEN
report returns → zArcheology independently verifies actual contract
semantics → only then re-read VV-2. No Jungle4 mutation during
implementation; `bnrapolltest` remains evidence of the old live-read
behavior until a separately receipted upgrade occurs.

**The boundary law**: governance may change tomorrow's offer. It cannot
change yesterday's promise.

## Relay — the final order for the workerb

```
VV-1 BUILDER ORDER — FINAL (spec FROZEN @59b02491; consume exactly that).
Fresh implementation workerb — NOT zArcheology. ONE concept: an opened
session binds an immutable PricingCommitment (rate/basis, asset/unit
semantics, tithe_bp, deterministic hash over the complete pricing input),
stored at opensess; the governance table prices NEW sessions only; every
charge is SNAPSHOT EXECUTION of the commitment (drift-refusal is a
convicted shape — governance updates must not brick open sessions;
refusal only for absent/corrupt/unverifiable commitments; legacy sessions
without a commitment refuse typed — NEVER reconstruct one from today's
table, even if the values seem to match). IMPLEMENTATION INVARIANT
(founder-emphasized): THE COMMITMENT MUST BE SELF-SUFFICIENT — after
opensess, conceptually throw the rate table away; the session must still
compute its lawful charge and tithe from its own persisted commitment.
Prove: (A) open R1 → delete rate row → serialize/reopen session → charge
→ same R1; (B) open R1 → mutate R2 → restart → mutate R3 → charge → still
R1. The serialization test has teeth: a REOPENED session stays
economically executable WITHOUT its originating rate row — not just a
struct round-trip. Tithe single-rounding identity: total = member + tithe;
tithe = floor(total × committed_bp / 10,000); member = total − tithe;
receipt shows smallest-unit conservation at the battery's boundary values
(0 and 10,000). The battery is source-pinned: the fix flips the pin —
re-derive from the new sha, all six reds go green + three greens held,
promote the ledger rows in docs/agents/VV-SPECS.md, existing vending tests
keep passing. NO Jungle4 mutation (bnrapolltest stays evidence of the old
shape until a separately receipted upgrade). NO VV-2 implementation. GREEN
returns → zArcheology independently verifies actual contract semantics →
only then VV-2 scoping. Boundary law: governance may change tomorrow's
offer. It cannot change yesterday's promise. 🐝
```
