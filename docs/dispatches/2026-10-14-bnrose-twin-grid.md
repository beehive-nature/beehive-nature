# BNROSE twin-grid — the mechanically checked Rust↔Cryptol sampled-agreement grid (ZCode, 2026-10-14)

Lane: `zcode/bnrose-twin-grid-2026-10-14`, base `5c24bb044` (PR #425's merge).
The founder's qualification order: "Add the mechanically checked Rust/Cryptol
sampled-agreement grid. Test the named saturation corner and ensure the
counterexample controls remain effective. Treat sampled agreement as an
intermediate gate, not equivalent to full SAW implementation correspondence."

## What the grid is

- **Canonical inputs**: `scripts/bnrose-rust-001/cryptol/grid.list` — 29
  structured (recs, rows) masks over one step's 16 attempt slots (empty,
  single slots, admission prefixes, saturation 0xFFFF, only-slot-15,
  0-and-15, holes, alternating), each run under both policy flags = **58
  cells**. Deterministic and named, not random.
- **Rust half**: the `bnrose-grid-agreement` binary computes every field
  through the REAL single definitions the run path itself calls — three thin
  extractions now live in `opexec.rs` (`replacement_admissible`,
  `replacement_attempt`, `step_has_row_among`) with the call sites rewired to
  them (behavior-neutral; the battery stays 56/0) — plus the real
  `step_entity_attempt` and real `step_op_id` keys, with discrimination
  noise (other events, other roots, other steps) the scans must filter.
- **Cryptol half**: `grid-gen.py` embeds the Rust output as literals in a
  generated module and Cryptol `:prove`s per-cell agreement
  (`gridCellAgrees` over the [9] index space) and the composed conjunction.
  Q.E.D. = agreement; a counterexample names the first disagreeing cell
  (mapped back to its grid line). Silence (timeout/memory) is RED here —
  sampled agreement is a CHECK, not a ladder rung.
- **Comparator teeth**: the perturbation control flips cell 0's gate literal
  and MUST refute at index 0 exactly. Input echo: the Rust half's executed
  inputs are asserted equal to grid.list × both flags.
- **The named saturation corner**: a seventh obligation
  `saturationCornerReusesSlot15` pins the corner as the fact it is (max
  journaled attempt 15 ⇒ the replacement number stays 15 — slot 15's
  encoding is reused, by design), and the grid exercises it through the
  real functions (recs 0xFFFF/0x8000 cells read maxA=15, nextA=15 on both
  sides).

## The receipts the grid earned while being built (why it exists)

The boundary comparison caught **four real disagreements in sequence**, each
named by the prover at a cell index:

1. The generated pad cell's gate literal said False where `gate True zero`
   is True (index 0x100 — my own generator bug).
2. `cellAgrees` passed `recs` where the spec's `gate` takes **rows** — a
   comparator-side argument swap, exposed by the control refuting at 0x035
   instead of 0x000.
3. **The bit-order seam**: Cryptol sequences index element 0 as the most
   significant bit; the Rust names attempt a as `1<<a`. Two self-consistent
   halves, opposite conventions — exactly the class of seam a per-side
   proof can never see. The generator now bit-reverses the masks, with the
   convention named in the generated header.
4. A "noise" journal record with encoded `0x80|step` is NOT noise — its low
   nibble names the step, so it is a genuine admission of attempt 8, and
   the real `step_entity_attempt` correctly counted it (Rust right, my
   harness input wrong). Removed; the honest noise set is other events,
   other roots, other steps.

## Boundaries (unchanged, restated)

Sampled agreement binds the twin's definitions to the Rust definitions over
a named 58-cell grid — an **intermediate gate**, not SAW implementation
correspondence, not exhaustive over the 2^33 input space. The twin remains
not-a-proof-about-the-compiled-Rust; the SAW equivalence leg stays the named
follower. The governing law (founder, 2026-10-14): local exclusion protects
a process; destination idempotency protects an effect; consensus, when
required, must be established independently.

## Receipts (local, this head)

- Twin check: **7/7 obligations Q.E.D.** (incl. the saturation corner),
  both negative controls counterexampled, composed PROVEN (cryptol 3.6.0
  pinned, yices, WSL).
- Sampled agreement: **58/58 cells AGREED** (per-cell + composed Q.E.D.),
  control refutes at index 0, input echo exact.
- Battery: **56/0** (behavior-neutral refactor confirmed).
- CI: the lane job now carries the grid step (rust build + pinned cryptol
  install ≈ seconds on the runner); the cryptol-twin job keeps the seven
  obligations. CI verdict recorded on the PR.

NEXT OWNER: any merger. HUMAN INTERACTION: NONE.
