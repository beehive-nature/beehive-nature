# INTEGRATION FINDINGS QUEUE — from the GESTURE D stop (2026-09-17)

**Origin:** [2026-09-17-gesture-d-stop-at-boot-receipt.md](../dispatches/2026-09-17-gesture-d-stop-at-boot-receipt.md)
(PR #91, merged). Founder disposition: the boot deadlock goes to a fresh
builder mission
([ORDER](../dispatches/2026-09-17-ORDER-x402-door-boot-deadlock-builder-mission.md));
the four findings below are **separate queue items** — architecture
reconciliation BEFORE implementation, because they may change the ceremony's
assumptions. They are NOT part of the deadlock repair and must not be bundled
into it.

Each item: statement · evidence at source · why it matters · gate.

---

## IF-1 · Upto legs are live-wire incompatible with this door

**Statement.** The door's wire extraction (`ops/x402-door/src/wire.rs::extract_leg`
@ `0e1c22ec`) reads only EIP-3009-shaped payloads (`value`/`maxAmount` under
`paymentPayload.payload`); upstream x402-chain-eip155 2.0.2's V2 **upto**
facilitator accepts ONLY Permit2 payloads (its own module doc: "Only Permit2
is supported (EIP-3009 requires exact amounts at signing time)"). The shapes
are disjoint: an upto request is refused at the door's leg-extraction boundary
(400, missing path) before the scheme handler is reached.

**Why it matters.** If verified, the integration ceremony's upto assumption
was WRONG — not merely unfinished: no upto leg can pass this door's wire on
ANY chain, and the runbook's "upto settled at less than max → reconciled-down
row" beat cannot occur through this build.

**Gate.** Architecture seat verifies at source; rules one of: (a) door wire
learns the Permit2 payload shape (extraction + LegKey for permitted.amount),
(b) upto is re-scoped to an EIP-3009-with-ceiling variant if upstream ever
ships one, or (c) upto is explicitly OUT of this door's served surface and the
runbook/ledger say so. Only then does any builder implement.

## IF-2 · The actual charged amount is discarded at the imp seam

**Statement.** Upstream's `UptoSettleResponse::success(payer, tx, network,
amount)` carries the ACTUAL settled amount; the door's imp passes
`actual_amount: None` for every success, and `Door::settle` fills
`leg.amount_authorized` (the ceiling). The real figure never reaches the
journal.

**Why it matters.** This directly touches the truthful upto accounting law:
an upto leg would record the authorized maximum as its actual even when the
chain charged less — the evidence-gated reconcile-down could never fire from
facilitator evidence.

**Gate.** Architecture seat rules the seam contract (imp must surface
scheme-reported actuals; what to do for schemes that do not report one). Then
a bounded builder change + a journal test proving a reconciled-down row from
REAL facilitator evidence shape.

## IF-3 · Gas accounting books reserve-rate, not actual

**Statement.** The imp passes `gas_actual_wei: None`; the door fills
`reserved_gas_wei` (150000000000000) as `gas_actual_wei` for facilitator-settled
legs. One settled leg therefore books 75% of the 200000000000000 daily cap;
human-gate resolves (`resolve_unknown`/`resolve_reorg`) DO take real evidence
figures and restore truthful accounting.

**Why it matters.** The exposure ceiling becomes conservative — which can be
SAFE — but bounded loss and truthful accounting are different properties. A
conservative ceiling can also brick the drill budget (as it did the ceremony
sequencing). It deserves its own test, not a rider.

**Gate.** Architecture seat rules whether facilitator-settled legs may fill
reserve figures (and the ledger documents the conservatism) or whether the imp
must surface real receipt gas. Then: dedicated tests for the budget law under
both truthful and filled figures.

## IF-4 · AV-6a's retry ceiling is unreachable at the real seam

**Statement.** The ceiling (`settle_attempts >= max_settle_attempts_per_leg`,
refuse loud) counts only `FacilitatorSettle::Error` outcomes — `Ok(success:
false)` responses. Upstream 2.0.2 constructs NO error-shaped settle response
anywhere (every settle failure — including on-chain reverts — is `Err`), and
the imp maps every `Err` to `Ambiguous` → journal `Unknown` (never
auto-retried). The only live attempt-counting path is a facilitator verify
refusal, exactly once per leg (re-verify is refused at reserve before the
facilitator is called).

**Why it matters.** The integration battery proved a state the production
adapter cannot generate: "3 failing settles on one leg → 4th refused loud" is
structurally impossible through the live wiring. The Unknown law is itself a
stronger brake against retry storms — but the AV-6a bar as specified needs a
seam change (classify scheme errors into definitive Error outcomes) or a
re-spec of the bar. This is precisely the mock-vs-reality discrepancy Gesture
D exists to uncover.

**Gate.** Architecture seat reconciles the AV-6a ledger row with the upstream
error surface (options include: imp classification of `FacilitatorLocalError`
variants; a re-specified bar "first definitive failure parks the leg"; or
upstream engagement). Any change re-enters through the adversarial pipeline,
not silently.

---

**Standing note.** None of IF-1..IF-4 authorizes implementation. All four
precede the next ceremony attempt only to the extent the architecture seat
rules on them; the deadlock builder mission is unaffected by this queue.
