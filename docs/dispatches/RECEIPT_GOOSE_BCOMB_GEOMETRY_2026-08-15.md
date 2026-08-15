# RECEIPT — bComb geometry verification for the Design-vs-shipped ruling (2026-08-15)
**From:** goose (Seat 1 hands) · **Purpose:** the founder's queued geometry call rests on
Seat 3's table; this receipt L-VERIFIES it at source so the ruling argues from the code, not
from a summary. Verification only — no proposals; the geometry question is Design's lane and
the ruling is the founder's.

## Seat 3's table vs the shipped codec — VERIFIED, cell for cell

`crates/bcomb/src/lib.rs` L11-23 is the rendering contract, verbatim:
- "6 rings, 127 cells, rendered white-on-black" (monochrome **by construction**, not by ruling
  retrofit — "a decoder that needs colour cannot work").
- ring 0 = 1 cell, **finder core — always lit**
- ring 1 = 6 cells, **finder collar — always dark**
- rings 2-5 = **84 data cells** (`cells.rs`: `data_index` 0..=83)
- ring 6 = 36 cells, **rim — always lit** ("the rim gives a decoder the [centre + scale]")
- "The core-inside-a-dark-collar is the anchor" — the collar IS the finder, as Seat 3 stated.

Arithmetic cross-check (counted programmatically this session): ring-1 entries = 6, ring-6
entries = 36, `data_index: -1` cells = 43 = 1 core + 6 collar + 36 rim; 1+6+84+36 = 127.

## The morning bug's fix is load-bearing and TESTED, not a comment

- `lib.rs` `lit_cell()` (L306-310) implements the paint rule; doc lines L116-122 pin
  ring 0 always lit / ring 1 always dark / rings 2-5 data / ring 6 always lit.
- Unit test `roles_are_exactly_the_rendering_contract()` (L449-457) asserts the counts
  (6, 36) **and that the collar stays dark even with ALL data bits set** — the exact
  regression that would return if ring 1 carried data.

## The oracle receipts are real

- `tests/golden.rs` header: "GENERATED FROM surfaces/blight/bcomb.js — The JS is the
  conformance oracle... A second implementation is not evidence for the first — it is a
  hostage." Exact 84-bit frame strings + multi-frame beams pinned in-repo.
- Design's proposal table therefore retires: 90 data cells (rings 1-5) minus 6 corner
  anchors = 84 payload — same payload, different finder. Seat 3's cost claim (re-derive
  golden vectors + new finder algorithm, QR-style corner anchors = different decoder)
  follows from the above by inspection.

## UNVERIFIED (labels kept honest)

- "crates/bcomb building for thumbv8m" — no thumbv8m string in `crates/bcomb`, root
  Cargo files, scripts, or workflows from this box. Plausibly done seat-side (WSL build);
  the receipt for it was not locatable here.
- "9/9 frames at T3W1 panel size, live browser at 100%" — the optical receipts of
  2026-08-14 were not grepped to that exact figure this session; the "9/9" hits found are
  Cowork's Merkle/R6 lane, a different 9/9. Seat 3's pointer to its own receipt stands
  unchallenged, just not independently re-read.

**Bottom line for the ruling:** the shipped geometry's finder role for ring 1 and scale role
for ring 6 are contract + test + oracle-pinned in-tree. Any alternative that makes ring 1
carry data must supply a different finder or re-prove the bullseye — the cost is real, and
the cheapest window to pay it is exactly where Seat 3 said: when the emulator renderer
lands.
