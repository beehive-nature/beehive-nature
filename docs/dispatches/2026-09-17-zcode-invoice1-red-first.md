# INVOICE-1 red-first — the zGenealogy reconciliation + the generic invoice law attacked against it

**Order** (founder, 2026-09-17): re-SYNC + reconcile the zGenealogy reference
@`68fdae20` (`tools/genealogy/bpay.mjs`, `skaists.bpay-invoice/1`) before
implementing INVOICE-1; reference consumer, never canonical law; identify
the five; then proceed RED-first if GREEN. Verdict: **GREEN, non-colliding
— proceeded.**

**Re-SYNC observations**: lane tip `97f18945` banks the founder-relayed
wave acceptance and the routing for this seat verbatim (bpay.mjs STAYS in
genealogy as the first reference consumer; the PricingCommitment→Invoice
mapping is the economic seat's call). PR #95 confirmed MERGED (x402-door
boot deadlock repaired RED-first) — awareness only; Gesture-D execution
stays with its sleeping executor. VV-1 builder GREEN remains this seat's
priority interrupt when it occurs.

**The reconciliation** (full five identifications in
`docs/agents/BPAY-ECONOMIC-LIFECYCLE.md` §INVOICE-1):
(1) GENERIC: everything the reference proves transportable — per-asset
lines with separate bounds, receipt-from-evidence-only, measured-states
labeling, buyer-without-address, ceilings+stopConditions embedded,
conflation-refusing validators. (2) GENEALOGY/AUTONOMI-SPECIFIC: the
archive context, data_map_address, payment vault + payForQuotes + approve,
Trezor/ERC-7730 notes, chunk semantics, job-bound expiry, planDigest's
per-chunk inputs. (3) COMMITMENT WITHOUT R20: the invoice binds ECONOMICS
by value + content digest (VV-1 self-sufficiency); R20 binds AUTHORITY by
signature; one-way reference authorization→invoice; the invoice never
signs — immutability from content-addressing, not cryptography. (4)
MULTI-ASSET: one asset per line, no cross-asset total in canonical bytes,
fiat fields forbidden, display aggregates never canonical. (5) PERSISTENCE
INVARIANT: content-addressed identity + offline-verifiable commitment +
evidenced terminality — the reference's P1 recovery proves the
bridge-machine leg; the generic law extends durability beyond the machine.

**The battery** (`scripts/inv1-bpay-invoice.mjs`, CI-wired): attacks the
reference VENDORED BYTE-EXACT (`fixtures/inv1/` — the module AND the real
committed invoice artifact `invoice-up-1789627481303.json`, sha-pinned;
drift fails hard and forces re-reconciliation). **4/7 green, 3 registered
reds**:

- **GREEN INV-1.2/1.3/1.6/1.7** — the reference ACQUITTED multi-asset
  separation (aggregate/unit detectors, "never one dollar figure" as
  structure), receipt-from-evidence-only (every fabrication path refuses),
  measured-states labeling (token-native, states honest), and the oracle
  self-test (aggregate smuggler, weakened validator, id-reuser all
  convicted).
- **RED INV-1.1** commitment not retrievable: an amount tampered WITHIN
  the ceiling and a fabricated plan digest both PASS validateInvoice —
  the artifact carries neither the 24 quote hashes nor pricing inputs;
  the commitment's evidence lives only in the issuing bridge's local,
  never-committed job state. Yesterday's promise is provable only on
  yesterday's machine.
- **RED INV-1.4** void path unpoliced: state:"void" validates unchecked; a
  voided invoice resurrects to settled with a fabricated receipt id; no
  void evidence class — while the ceremony UI really voids plans via
  /v1/upload/abandon.
- **RED INV-1.5** identity not content-addressed: same invoiceId across
  different bytes; no canonical serialization, no self-digest. ADDITIVE
  charter — keep the job-bound id (the P1 proof stands on it), ADD the
  content digest.

**Fences held**: zGenealogy not refactored (byte-exact vendored copies
only); bpay-rail/R20 untouched; quote TTLs observed NOT normalized; IF-1..IF-4
not implemented; VV-2 not opened; Jungle4 untouched. Battery failure paths
(pin drift / unregistered red / stale row) drilled with named causes.

**Next**: the three charters bind the generic INVOICE-1 builder lane when
claimed; VOCAB-1 and RECON-1 remain queued on this seat's frontier.

## Relay

```
INVOICE-1 LANDED RED-FIRST (zCode economic seat): the generic bPay invoice
law attacked against zGenealogy's real skaists.bpay-invoice/1 — vendored
byte-exact, sha-pinned, never refactored. The reference consumer ACQUITTED
the transportable core: per-asset lines with separate bounds (never one
dollar figure, enforced by structural aggregate/unit detectors), receipts
ONLY from settlement evidence (every fabrication path refuses), measured-
states labeling (token-native, quote≠purchased, honest not-yets). Three
registered reds chart the generic advance: (1) the invoice is SELF-
UNVERIFIABLE offline — an amount tampered within the ceiling and a
fabricated plan digest both pass validation, because the commitment (the
24 quote hashes / pricing inputs) lives only in the bridge's local
never-committed job state: yesterday's promise is provable only on
yesterday's machine; (2) the void path is unpoliced — a voided invoice
resurrects to settled unchecked while the UI really voids plans;
(3) identity is job-bound, not content-addressed — same id across
different bytes; additive charter: keep the job id (the P1 24/24 recovery
proof stands on it), ADD canonical bytes + self-digest. Commitment binds
by VALUE+digest (VV-1 self-sufficiency); authority stays R20's signature
world — one-way reference, the invoice never signs. Battery in CI with
drilled failure paths; charters bind the builder lane.
```
