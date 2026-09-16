# WORKERB2 — the NWC/x402/bpay-rail boundary audit · 2026-09-16

**Seat:** Workerb 2 (one writer on the lane). **Mission (founder, verbatim
core):** *"Audit the entire NWC/x402/bpay-rail error vocabulary for the
same provenance mistake R17 exposed. Classify every failure by the furthest
irreversible boundary actually crossed: LOCAL/PRE-SEND →
SUBMITTED/UNACKNOWLEDGED → RELAY-ACKNOWLEDGED → COUNTERPARTY-OBSERVED →
SETTLEMENT-EVIDENCED. Then prove behaviorally—not with tables—that no error
can move an obligation into a state requiring stronger evidence than the
boundary it actually crossed… Core law: uncertainty begins only after an
irreversible external boundary has actually been crossed. A local failure
leaves the existing intent open; it cannot manufacture Unknown."*

**LANDED:** `codex/z2b-bpay-rail` @ `f4cf9f6a`, CI all-green. **Default
111 passed / live-nwc 115 passed against the same SHA**, clippy 0 both
configs, fmt clean, live sends OFF, LT-8 untouched, no production changes.

## The taxonomy, as code

`FailureBoundary { LocalPreSend, SubmittedUnacknowledged,
RelayAcknowledged, CounterpartyObserved, SettlementEvidenced }` +
`NwcError::boundary()` — every failure classified by the furthest
irreversible boundary it actually crossed. The executable law, test-pinned
over the whole vocabulary: **boundary LocalPreSend ⇒ effect
LeaveOpenAtIntent; post-boundary uncertainty ⇒ Unknown.** The HumanGate
doctrine is banked verbatim in the enum's docs: *Unknown/HumanGate is not
a generic error bucket — it is for operations that may have escaped our
control with insufficient evidence to determine the outcome.*

## Three real provenance bugs, found RED-first and fixed

1. **Connect failure (DNS/socket/TLS) was `TransportAmbiguous`.** A
   payment that was never sent went Unknown. Now
   `NwcError::ConnectFailed` → LeaveOpen. RED receipt: with the connect
   seam armed, `pay()` returned `Ok(Unknown)`; GREEN: intent stays open,
   zero connections, identity intact.
2. **Relay `OK=false` was IGNORED by the live read loop** — it fell
   through to window exhaustion → Unknown, though the relay definitively
   refused (the event never entered the network). Now
   `process_ack_frame` is consumed inside `read_response` (our event id
   plumbed from the live request): `Rejected` →
   `NwcError::RelayRejected` → LeaveOpen — proven through the pure
   engine and rail-level via the mock's relay-rejection flag.
3. **Local crypto construction rode `Other` → Unknown.** CSPRNG/encrypt/
   key-material failures are pre-send by construction. Now
   `NwcError::LocalConstruction` → LeaveOpen (seam-proven; a real
   zero-pubkey connection triggered this class live during authoring).

## The founder's attack list — all behavioral (12 probes)

connect/DNS/TLS → intent open · malformed config → fails at construction,
no rail exists · clock + CSPRNG/construction (R17 class extended to the
full construction stage) · serialization/signature via the construction
wrap · relay OK=false → definitive refusal · disconnect BEFORE ack
(budget 0) → Unknown · disconnect AFTER ack → Unknown · authenticated
NIP-47 errors (LU-6 behavioral suite — counterparty-observed) · response
loss after submission → Unknown (window/reconnect exhaustion pinned) ·
settlement evidence arriving AFTER Unknown → resolves the SAME identity
to Settled, never auto-retried first.

## Mutation/negative control

A shadow mapper promoting `ConnectFailed → Unknown` (the exact R17-class
bug) is **rejected by the battery's law checker by construction** — and
the three live RED receipts above are the real-world proof that the
battery catches this class in the wild, not just in simulation.

**Preserved: LT-0 identity, Paid(0) ≠ AbsentBounded, typed MilliSatoshi,
live sends OFF. Next per founder order: capability/version binding.**
