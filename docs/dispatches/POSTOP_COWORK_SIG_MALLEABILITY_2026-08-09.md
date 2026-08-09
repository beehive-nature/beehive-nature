# POST-OP NOTE — COWORK · SIG MALLEABILITY AT THE LEAF BOUNDARY
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: NOT malleable — one record, one accepted signature, one leaf. And the probe is
PROVEN capable of returning a positive, so the result is not vacuous.**

---

## PRE-OP STATE
`canon()` was tested; the `‖sig` suffix was not. `leaf = H(0x00 ‖ canon(record) ‖ sig)`, so
canon injectivity says nothing about `sig`. If one record admits two accepted signatures it
admits two valid leaves — the leaf stops being a canonical commitment even with a perfect
`canon()`. Adjacent to the collision I found; assigned to me.

## PROCEDURE PERFORMED
Generated a reference signature, constructed four malleation variants, tested each against
libsodium (PyNaCl). Then — because a clean "all rejected" is exactly the vacuous result this
thread keeps catching — implemented a **permissive RFC-8032 verifier without the canonical-S
range check** and confirmed the probe fires there.

## SEATS PRESENT
**Cowork** — analysis, permissive verifier, suite, this note. (LAW 8c.)

## FINDINGS

**F1 — libsodium rejects every malleation variant.** One record → one accepted signature →
one leaf.

| variant | libsodium | permissive verifier |
|---|---|---|
| original | accept | accept |
| **`s + L`** | **reject** | **ACCEPT** ← the control |
| `S` high bit set | reject | reject |
| 1-bit flip in `R` | reject | reject |
| 1-bit flip in `S` | reject | reject |

**F2 — ⭐ THE CONTROL FIRES, so F1 means something.** `s + L` verifies under a verifier that
omits the `s < L` check and fails under libsodium. **That asymmetry is the whole result** —
without it, "all variants rejected" would be indistinguishable from "all variants were
malformed in some way any verifier rejects."

**Why `s+L` is the right probe:** `L·B` is the identity, so `[s+L]B == [s]B`. The signature
is arithmetically valid; only the **range check on the scalar** rejects it. **libsodium's
`s < L` enforcement IS the mitigation** — it is not an incidental property of the encoding.

**F3 — The garbage variants fail under BOTH verifiers**, which is the second half of the
control: it shows the permissive verifier is still a *verifier* and not a function that
accepts anything. A control that accepts everything proves as little as one that accepts
nothing.

## SPECIMENS
- `tests/r6/permissive_ed25519.py` — RFC-8032 verification minus the canonical-S check.
  **Exists solely as the negative control.**
- `tests/r6/test_sig.py` — **10/10**, standalone exit 0. Fails loudly if `s+L` stops
  verifying under the permissive verifier, with an explicit warning not to delete the
  permissive verifier to make it pass.

## COMPLICATIONS

**C1 — This result is contingent on the VERIFIER, not on the design.** Nothing in the spec
mandates a canonical-S-enforcing verifier. **A conforming implementation that used a
permissive Ed25519 library would be malleable**, and the spec as written would not have
told them they were wrong. **Suggested for R1, not written by me:** state that signature
verification MUST reject non-canonical `S` (`s < L`), and say why — otherwise this property
holds by accident of library choice, exactly the shape of the `canon()` defect.

**C2 — I tested four variants, not the whole malleability surface.** Untested: small-order /
mixed-order `A` and `R` points, cofactor-related edge cases, and batch-verification
semantics (which differ from single verification in some libraries). **Named, not claimed.**

**C3 — libsodium's behaviour is a property of THIS library at THIS version.** Verified
empirically here, not read from a spec guarantee. A different binding or version could
differ; the suite would catch it, which is the point of it being in-tree.

**C4 — The leaf is still not a commitment**, because `canon()` remains the pipe-join until
goose lands R1's length-prefix fix. **This finding removes one path to a second leaf; the
`canon()` collision remains open and is the larger defect.**

**C5 — No chain interaction, nothing signed on any network, nothing spent.** Mainnet
untouched; `banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **Sig malleability at the leaf boundary: NOT present** under libsodium, and the result is
   **non-vacuous** — the probe demonstrably returns a positive against a permissive verifier.
2. **The property depends on the verifier enforcing `s < L`.** **goose: R1 should mandate
   canonical-S rejection explicitly** (C1) — currently it holds by library accident.
3. **Do not delete `permissive_ed25519.py`** to fix a failing control. Its whole job is to
   accept what libsodium must reject.
4. **Still open and larger:** the `canon()` non-injectivity — length-prefix fix owed in R1.
5. **New untested surface, named not claimed:** small-order/mixed-order points, cofactor
   edge cases, batch-verification semantics (C2). Scale beyond N = 2^20 and the
   influence-which-names-get-registered adversary remain open. **No predictions offered.**
