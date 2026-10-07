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

**Input-boundary law (repair 2026-10-07, founder review of the genesis):**
text fields accept well-formed Unicode only. The genesis module accepted
unpaired UTF-16 surrogates, which `Buffer.from(value,'utf8')` silently
maps to the same replacement bytes (`efbfbd`) — so `'\uD800'`, `'\uD801'`
and `'\uFFFD'` were three distinct accepted strings sharing ONE
authorization, in every text field. Not an Ed25519 forgery: a many-to-one
conversion BEFORE signing. The twin gap sat in decode
(`toString('utf8')` replaces instead of refusing). Repair: refuse at
encode (`bt-wb01:utf16`), refuse at decode (`bt-wb01:utf8`); valid
international text, supplementary characters and a legitimate U+FFFD
stay accepted, byte-exact. Red-first receipt in
`docs/dispatches/2026-10-07-btungsten-wb001-boundary-repair.md`.

| artifact | status |
|---|---|
| `wb001-intent.mjs` — canonical TLV envelope + Ed25519 binding verifier, fails closed; UTF-16/UTF-8 boundary gates since the 2026-10-07 repair | RUNS — `node --test scripts/btungsten/*.test.mjs` |
| `wb001.test.mjs` — the genesis battery (retained byte-stable): injectivity corpus (25 intents incl. nested-envelope and boundary-shift twins), 21 field-move mutants, 1,640 one-bit envelope mutants (205 bytes × 8), 512 one-bit signature mutants, 5 structural forgeries (reorder / unknown tag / duplicate / length-splice / truncation), domain/nonce/epoch participation, cross-key, and the TEETH row convicting the naive length-free encoder on both adjacent-variable-field collision pairs | RUNS in CI — green 10/10 |
| `wb001-boundary.test.mjs` — the boundary suite (landed RED against the genesis module first): 32 lone-surrogate encodes refused (4 fields × 8 forms), 24 surrogate-class authorization crossings rejected, 8 valid-Unicode controls round-trip byte-exact, 9 malformed-UTF-8 decodes refused with the valid 4-byte and U+FFFD controls passing, malformed-wire verifyEnvelope refusal, and the pinned shared vectors | RUNS in CI — green 6/6 since the repair |
| `wb001-vectors.json` (+ `wb001-gen-vectors.mjs`) — the pinned shared vectors: 10 positives byte-for-byte, 9 refusals by exact code, including the surrogate/invalid-UTF-8 boundary rows. Every twin (Rust, Cryptol) must reproduce these BEFORE any equivalence claim | PINNED, re-derived and compared on every CI run |
| `wb001-cryptol/Intent.cry` — formal twin, ALIGNED 2026-10-07: meaningful lengths, valid-input constraints (canonical zero padding, wellFormedUtf8 as the pinned abstract predicate), padded wire whose meaningful prefix is exactly the deployed envelope, `wireInjective` for all VALID pairs | STAGED — written, not run; UNVERIFIED |
| `wb001-saw/intent.saw` — equivalence-proof plan against a future Rust twin, vector-first | STAGED — written, not run; UNVERIFIED |

### §result-classes (founder ruling 2026-10-07)

Four distinct results, recorded separately; NO one of them is ever
recorded as another:

| class | meaning | status |
|---|---|---|
| TYPECHECK | the .cry parses and typechecks | pending (CI ubuntu beat) |
| CHECK-SAMPLED | `:check` over sampled cases — with CONSTRUCTED related pairs (boundary twins, surrogate rows), not random sampling alone | pending |
| PROVE-UNIVERSAL | `:prove` across the stated input domain | pending |
| EQUIVALENCE | SAW: implementation == spec (vectors first, then the proof) | pending |

A missing tool, a skipped obligation or a solver timeout is NOT-RUN,
never success. `:check` is testing; `:prove` is the proof step.

### §next (named gaps, in order)

1. **Cryptol typecheck + `:check wireInjective`** — needs a Linux x86_64
   host with cryptol/SAW release binaries; the CI ubuntu runner is the
   qualified home (add a container step here when the beat lands).
   The check set must include CONSTRUCTED related pairs (boundary-shift
   twins, the surrogate-class rows), not random sampling alone; :check is
   recorded as CHECK-SAMPLED, never as the universal proof.
2. **Rust twin of `canonical`/`decode`** in this repo, reproducing
   `wb001-vectors.json` byte-for-byte (positives exact, refusals by code)
   BEFORE any equivalence claim (the bpq two-implementation precedent).
3. **SAW equivalence proof** (`wb001-saw/intent.saw`): implementation ==
   spec for all VALID intents; then the mutation leg is provable, not
   sampled.
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
