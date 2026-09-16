# WORKERB2 — bpay-rail R16: LU-5 + LU-6 + CD consumed RED-first · 2026-09-16

**Seat:** Workerb 2 (single writer on the lane per the founder's
one-writer-per-branch rule). **Mission (founder, verbatim):** *"LU-5
first: model hold-invoice/MPP `upto` honestly so LN never silently turns a
maximum into an exact charge. Then LU-6: complete the NIP-47 error →
ledger-state vocabulary map. Then CD capability manifests: capabilities
must be explicit and bound before intent construction; no adapter may
silently claim semantics it cannot provide. Preserve the new
`MilliSatoshi` boundary and `Paid(0) ≠ AbsentBounded`. RED first → GREEN →
full lane suite before push. Live sends stay OFF."*

**LANDED:** `codex/z2b-bpay-rail` @ `6470309e`, CI all-green (test +
static + node). **Lane 81/81 in BOTH default and live-nwc configs**
(13 LT + 14 new + 7 LU + 47 R14), clippy 0 + fmt clean both configs,
live sends OFF (the unchanged named gate), default build network-free.

## LU-5 — hold/MPP upto, modeled honestly

`LnOffer` authorizes a **maximum**; the laws:

- **Settle-on-release ONLY** — paying an unreleased offer is refused as
  incomplete evidence naming `released_msat` (never an exact-charge
  guess).
- **The released amount is REQUIRED evidence, bounded by the authorized
  max** — an over-release is refused naming BOTH figures, before any
  booking.
- **The booking carries BOTH figures** — `UptoBooking { authorized,
  released }`, asserted distinct on a partial release: the maximum is
  never silently turned into an exact charge.
- **Hold-timeout = terminal Failed, ZERO fee, no replacement** — no fee
  evidence may ever book; the identity never re-opens; a LATE release is
  refused at the payee itself (both layers refuse).
- **MPP rides the identical evidence law** (mechanism-named, same
  bounds).

## LU-6 — the NIP-47 total map

`LedgerEffect { LeaveOpenAtIntent, MarkUnknownHumanGate,
TerminalFailedNoFee }` — **every one of the ten pinned codes has a
declared effect** (`NIP47_PINNED_CODES` iterated by test; all three
classes reached):

- RATE_LIMITED / QUOTA_EXCEEDED / RESTRICTED / INSUFFICIENT_BALANCE /
  NOT_IMPLEMENTED / UNSUPPORTED_ENCRYPTION / NOT_FOUND → **stay OPEN at
  Intent** (retryable, state untouched).
- INTERNAL / UNAUTHORIZED / **unmapped codes** → **Unknown + human
  gate** — the old catch-all silently classed uncertain codes as open;
  that laundering is dead. `TransportAmbiguous` joins this class by LT-0.
- PAYMENT_FAILED → the ONLY terminal class (zero fee).
- **send-disabled refusal leaves ZERO ledger residue** (state `None`).

## CD — capability manifests, bound before intent construction

`capabilities.rs`: `TransportIdentity` (Mock carrying its divergence
table | Live), `ResponseReadAxis` (PostReq | WsRequired | None),
`MechanismSet`, and a **versioned additive send gate**. The laws:

- **The blind-send law** — sends with NO response read is send-then-blind
  (the permanent-Unknown trap): refused at the manifest AND at every
  bump; `enable_sends_bump` validates the WOULD-BE state and versions
  nothing on refusal.
- **`NwcRail::new_with_manifest`** validates at construction; `pay_upto`
  gates on the bound mechanism **pre-mutation** (zero residue, refusal
  names the missing mechanism).
- **The lying-mock negative control** — a manifest claiming Hold while
  the mock never releases is CAUGHT BY LAW: the settlement refuses on
  missing release evidence, never a silently exact-charged booking.

## Source ledger

Lane base `1edc242a` read at: nwc.rs NwcError/from_code/pay-path,
ln.rs LnMockClient/LnSettlement, nwc_mock.rs pay-result; capabilities
module + lu5_lu6_cd suite authored this slice (RED at authoring: pay_upto
absent, no LedgerEffect, no manifest; GREEN as specified above).

**Live sends OFF. No Sepolia. Single-writer protocol honored (tip
verified unchanged before push).**
