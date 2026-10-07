# bTunGsTeN workbenches

The executable arm of SPEC-BTUNGSTEN-1: every claimed property of the
standard reduces to a reproducible adversarial test with explicit
assumptions, pass/fail criteria, evidence, and a machine-verifiable
receipt. A workbench is where a property stops being prose.

```
Foundation (Cryptol + SAW)      → prove the formal invariant
Emissary-style hostile workflow → attack the living distribution
Autonomi / x0x / BNR stack      → the sovereign substrate under test
bTunGsTeN receipt               → verdict computed from observations only
```

All three tool rows are REPLACEABLE test infrastructure, never
dependencies of the standard (SPEC-BTUNGSTEN-1 §toolchain): if NSA
deletes Foundation or SAW disappears, the workbench migrates to whatever
formal system replaces them — the ≥1000-year clause applies to bTunGsTeN's
own tooling first.

## WB001 — the intent-binding invariant (CURRENT)

**Invariant:** no valid signature may authorize any intent other than the
exact intent that was committed to. One bit of drift in domain, nonce,
epoch, action, destination, capability, amount, expiry, payer or payload
must break verification.

| artifact | status |
|---|---|
| `wb001-intent.mjs` — canonical TLV envelope + Ed25519 binding verifier, fails closed | RUNS — `node --test scripts/btungsten/wb001.test.mjs` |
| `wb001.test.mjs` — the battery: injectivity corpus (25 intents incl. nested-envelope and boundary-shift twins), 21 field-move mutants, 1,640 one-bit envelope mutants (205 bytes × 8), 512 one-bit signature mutants, 5 structural forgeries (reorder / unknown tag / duplicate / length-splice / truncation), domain/nonce/epoch participation, cross-key, and the TEETH row convicting the naive length-free encoder on both adjacent-variable-field collision pairs | RUNS in CI (globbed step, tests.yml static job) — green 2026-10-06: 10/10 tests, 2,178 mutants rejected |
| `wb001-cryptol/Intent.cry` — formal twin; P2 injectivity for ALL pairs; P3 binding over an assumed signature primitive | STAGED — written, not run; UNVERIFIED |
| `wb001-saw/intent.saw` — equivalence-proof plan against a future Rust twin | STAGED — written, not run; UNVERIFIED |

### §next (named gaps, in order)

1. **Cryptol typecheck + `:check canonicalInjective`** — needs a Linux
   x86_64 host with cryptol/SAW release binaries; the CI ubuntu runner is
   the qualified home (add a container step here when the beat lands).
   The `.cry` file models variable fields at capacity with explicit u32
   length words mirroring the wire format.
2. **Rust twin of `canonical`/`decode`** in this repo, byte-identical to
   the JS twin, proven against shared pinned vectors (the bpq
   two-implementation precedent).
3. **SAW equivalence proof** (`wb001-saw/intent.saw`): implementation ==
   spec for all intents; then the mutation leg is provable, not sampled.
4. **Distributed leg (WB002):** the bounded BNR job through a hostile
   P2P workflow — kill services, reroute, replay, fake peer, partition,
   heal — final result must still satisfy this invariant and produce the
   same meter-verifiable outcome (Emissary as sacrificial specimen, not
   dependency).
5. **Scale/century legs (WB003+):** progressively larger physical runs
   and simulated century transitions per SPEC §axes 5-6.

### Founding receipts

- Origin: founder order 2026-10-06 (bTunGsTeN formalization, six hard
  properties, Workbench 001 design). Dispatch:
  `docs/dispatches/2026-10-06-btungsten-lane.md`.
- Toolchain posture, with precision: NSA's `Foundation` repo (Apache-2.0)
  provides Cryptol specifications + SAW assurance machinery and a
  primitives corpus (AES, ECDSA specs, HMAC, SHA2/3…). It does NOT ship
  an ECDSA SAW proof artifact today — checked 2026-10-06, and we do not
  claim otherwise. We apply the machinery ourselves; anything not yet run
  by us carries UNVERIFIED.
- Precedent instances already in-tree: `tools/net-doxx/` (the tungsten
  test harness — verdict-from-observations receipts, live FAILs
  published) and SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten (the ZK lane's
  four-receipt coupling gate). bTunGsTeN-1 names the umbrella those
  gates instantiate.
