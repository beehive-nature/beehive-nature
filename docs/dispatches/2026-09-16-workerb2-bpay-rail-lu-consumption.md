# WORKERB2 — bpay-rail LU-3/LU-7/LU-8.1 consumed RED-first + lane reconciliation · 2026-09-16

**Seat:** Workerb 2 (rolling forward automatically; the door's D-watchlist
is exhausted pending the founder's Sepolia gesture, so the builder queue
pointed here — the specs seat's sixth-roll verified REDs against the
bpay-rail crate, still live at the R14 tip).

**LANDED on the lane:** `codex/z2b-bpay-rail` — R15 `82ba675e` + scratch
rider `19acdac5` (both CI all-green) + reconciliation rider `e5488de8`
(CI all-green). bpay-rail **67/67 in both default and live-nwc configs**
(13 LT + 7 LU + 47 R14), watchpay 65/65 untouched, clippy 0 + fmt clean
both configs, default build network-free.

## The three verified REDs, fixed GREEN (tests/lu_laws.rs, 7 probes)

- **LU-8.1 absent-vs-zero at booking (the sharpest).** BOTH
  `unwrap_or(0)` sites (ln.rs reconcile + nwc.rs pay-result) booked an
  ABSENT `fees_paid` as a zero-fee settlement — silently releasing fee
  exposure the transport never testified to. Now a tri-state booking:
  `FeeEvidence::Paid(msat)` reconciles DOWN to the testified figure;
  `FeeEvidence::AbsentBounded(limit)` RETAINS the worst-case reservation
  (bounded, never released); **Paid(0) and AbsentBounded are distinct
  bookings by test** (zero testimony ≠ no testimony). Per-payment booking
  recorded on both adapters (`fee_evidence()` accessors); the mock gains
  `next_pay_no_fees` for the no-testimony probe; the NWC absent case is
  pinned end-to-end.
- **LU-3/LU-7 typed rail units.** `MilliSatoshi` newtype at the transport
  boundary (`LnInvoice::amount_msat`, `LnSettlement::fees_paid_msat`,
  adapters' fee limits, `make_invoice`) — the bare-u64-next-to-newtyped-
  identity mixup is structurally dead. ONE named conversion site
  (`MilliSatoshi::to_atto` — all four scattered `Atto::from_u64` sites
  route through it, asserted by a source-grep test). Fee refusals name
  the field+unit pair (`field=fees_paid unit=msat`).

## Lane events (recorded for the protocol)

1. The eighth-roll's P0 (LT-1 substring-ack conflation) was already dead
   at the R14 tip — R14 deleted the POST transport outright; the specs
   seat's strongest find was fixed-by-deletion before any builder touched
   it. This slice took the three REDs that survived R14.
2. **A parallel builder landed their own R15 (LT-specs consumption,
   `3602d2de`) stacked UNTESTED onto my typed-API rider** — their
   `lt_spec_consumption.rs` still used bare-integer constructors, red CI.
   Reconciliation rider `e5488de8` wrapped one constructor; both R15
   slices now compose (their 13 LT probes + my 7 LU laws).
   **Lane law banked: a parallel landing on a shared lane must re-run the
   lane suite before push — stacked-untested is the §7 force-stack trap
   in lane form.**
3. A scratch patch script briefly entered my first R15 commit — caught
   post-push, stripped in the rider (the tree stays source-only).

## Source ledger

R14 tip `992d8b79` read at: ln.rs:35/110/160/190/239, nwc.rs:105-118/193-230,
nwc_mock.rs pay-result; sixth-roll dispatch (LU/CD RED citations); R15
parallel commit `3602d2de` (lt_spec_consumption.rs:318).

**No production. No Sepolia. The lane stands at 67/67 both configs.**
