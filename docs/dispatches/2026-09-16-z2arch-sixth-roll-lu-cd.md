# zArcheology SIXTH ROLL — LU/CD continued through the R13 transport seam · 2026-09-16

**Order (founder state correction, verbatim):** "State correction: do not sleep. The
Astra/Work verification gate is closed. Resume the current zArcheology roll-forward from
`ADVERSARIAL-BPAY-SPECS`: continue RS-5.4 and rail-capability discovery RED-first specs
against `bpay-rail`. No architecture waiting gate remains."

**Deliverable:** `docs/agents/ADVERSARIAL-BPAY-SPECS.md` § SIXTH ROLL — SPEC LU-5..LU-8 and
SPEC CD-7..CD-10, targets re-bound from the fifth roll's `@aa47b04b` to
`codex/z2b-bpay-rail` @`0ff70217` (R13 live-NWC + its dock rider). Tests designed only;
zero production code, zero network, nothing executed against live rails.

**Why this shape:** R13 landed the transport seam (`NwcTransport` trait, `NwcRail<T>`,
NIP-47 typed error vocabulary, `send_enabled` gate, NIP-44 v2 live transport) AFTER the
fifth roll was bound — the conflation law ("unify laws, not erase rail semantics") had not
yet been attacked THROUGH that seam, and R13's own receipts name open surface the specs
should own (the reader-door capability gap, the mock's fidelity duties).

**REDs verified by direct source read at `0ff70217` (not inferred):**
- `LnInvoice.amount_msat: u64` — bare-int money while identity IS newtyped
  (`PaymentHash`, ln.rs:30 vs ln.rs:35) → LU-3/LU-7 named RED.
- msat→Atto conversion scattered over two sites (ln.rs:160, ln.rs:190) → LU-7.2.
- `reconcile` coerces absent `fees_paid` to zero (`unwrap_or(0)`, ln.rs:239) → LU-8.1;
  R13 greened the IMPOSSIBILITY check but not the absent-vs-zero BOOKING distinction
  (RS-4.2 unfinished through the new adapter).
- No MPP/hold/negotiation/capability-manifest symbols anywhere in `src/` → LU-2, LU-4,
  LU-5, all of CD stand RED.

**New spec families (summaries; tables live in the specs doc):**
- **LU-5** hold-invoice modeled-upto (the other lawful LN upto path; MPP was LU-2) with
  mechanism-named upto in the manifest.
- **LU-6** NIP-47 error vocabulary → ledger-state TOTAL map (rate-limited stays OPEN at
  Intent; `TransportAmbiguous` reconciles by lookup only — never a fresh payment_hash;
  the live gate leaves zero ledger residue).
- **LU-7** typed rail units at the transport boundary (MilliSatoshi newtype; ONE named
  conversion site; refusals name field + unit pair).
- **LU-8** fees_paid absent-vs-zero at booking + mock-fidelity differential.
- **CD-7** transport capability discovery — R13's reader-door discovery made a
  BEFORE-construction axis (`response-read`), with reads staying lawful on read-only
  transports.
- **CD-8** the live-send gate as a versioned manifest axis.
- **CD-9** capability composition = INTERSECTION (rail × transport, derived never
  hand-written; EVM member's manifest derives from watchpay's proven 65/65 behavior).
- **CD-10** mock-vs-live manifest truth (explicit divergence table; lying-mock negative
  control).

**GREEN accounting recorded** so builders do not re-prove R13's wins: preimage-required
settlement (+ stripping probe), duplicate-hash→lookup, expiry-blocks-new-never-old,
unknown-never-auto-retry, fees_paid impossibility — all GREEN per R13 receipts.

**Pipeline law unchanged:** builder proves RED, fixes GREEN, CI arbitrates. Worktree
`wt-zarchaeology-recon`, branch `zarchaeology/handoff-banking-2026-09-16`, landing on main
as the fifth roll did.
