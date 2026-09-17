# VV-1 founder ruling banked + the bounded builder order (fresh implementation workerb)

**The ruling** (founder, 2026-09-16, on the VV-1 result): VV-1 has done its
job; the six reds all point to ONE missing primitive — an open session has
no historical pricing commitment. Do not broaden into VV-2. The GREEN
builder fixes one concept, not six symptoms:

> An opened session binds an immutable `PricingCommitment`; settlement/
> charge never derives historical price semantics from the mutable
> governance table.

The commitment carries every field that can change the economic result — at
minimum the applicable rate/basis, asset/unit semantics, `tithe_bp`, and a
deterministic commitment/hash over the complete pricing input — stored at
`opensess`. Then: **governance table = price offered to new sessions;
session commitment = price authorized for this session.** R1→R2→R1 becomes
irrelevant to an existing session — its commitment never changed. `charge`
runs **snapshot execution** (not refuse-on-governance-change: updates must
not brick legitimately opened sessions); refusal is for
absent/corrupt/unverifiable commitments only. Tithe: the pinned equation
`total_charge = member_amount + tithe_amount`, `tithe_amount =
floor(total_charge × tithe_bp / 10_000)`, `member_amount = total_charge −
tithe_amount` — one rounding from the committed total; `tithe_bp` belongs
INSIDE the commitment. The R1→R2→R1 probe is permanent: same final state ≠
same history. The int64 overflow observation is a VV-2 lead — separate
failure class, must not contaminate this fix. `bnrapolltest` live = evidence
of the deployed vulnerable shape, NOT the RED harness: isolated tests first,
separately authorized Jungle4 upgrade/drill later.

**Battery response** (this seat, same lane, second commit): the VV-1 oracle
was tightened to the ruled bar so a builder GREEN means the founder's law —
an intact commitment now admits ONLY snapshot pricing (any refusal is
convicted as bricking, wording-independent); the drift-refusal shape is a
CONVICTED calibration; and a legacy session with no recorded commitment
must REFUSE as unprovable — never fall back to the live table (the
migration trap, convicted). Self-test now five calibrations, all green; all
four battery failure paths re-drilled with named causes. Six reds stand
(1.4a now also convicts the deletion-stranding of an open session).

**The order** (relayed to the fresh implementation workerb — NOT
zArcheology):

## Relay

```
VV-1 BUILDER ORDER (founder-ruled, bounded job for a fresh implementation
workerb — not zArcheology). Consume VV-1 only, RED→GREEN, ONE concept: an
opened session binds an immutable PricingCommitment — every field that can
change the economic result (rate/basis, asset/unit semantics, tithe_bp,
deterministic hash over the complete pricing input) — stored at opensess.
Governance table = price offered to NEW sessions; session commitment = price
authorized for THIS session. Every charge uses the commitment: SNAPSHOT
EXECUTION (drift-refusal is a convicted shape — governance updates must not
brick legitimately opened sessions; refusal only for absent/corrupt/
unverifiable commitments; legacy sessions without a commitment refuse as
unprovable, never live-fallback). Tithe conservation, single rounding:
tithe = floor(total × bp / 10_000), member = total − tithe; 0 and 10_000
lawful; >10_000 refuses before mutation; tithe_bp rides inside the
commitment. Re-run all nine VV-1 probes plus existing vending tests; the
battery is source-pinned so the fix flips the pin — re-derive from the new
sha, all six reds go green, three greens stay green, promote the ledger rows
in docs/agents/VV-SPECS.md, and add serialization/reopen coverage so the
commitment survives persistence. NO Jungle4 mutation (bnrapolltest is
evidence, not the harness). NO VV-2 implementation (int64 overflow is a
separate lane). Send the GREEN back to the zCode adversarial seat; only then
does zArcheology re-read the contract for VV-2 scoping. Full law:
docs/agents/VV-SPECS.md (THE FOUNDER RULING + THE BUILDER ORDER sections).
```
