# Z2.B R12 — OP-stack receipt fields pinned, L1Surcharge harness + x402 door wired

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: pin the OP-stack
receipt fields evidencing the L1 surcharge; extend the R10 harness
around L1Surcharge (missing bound, underestimated bound, receipt
exceeding declared possibility, UNKNOWN/reconciliation); wire the x402
door into the EVM compose boundary on the existing bpay-rail trait —
no duplicate state machine; LIVE NWC wiring stays separate. Built on
`codex/z2b-bpay-rail` (descendant of e289e6e2). No network, no
signing, no deployment.

## Receipt fields pinned (three converging sources)

op-geth (the OP-stack execution engine) extends go-ethereum's
`types.Receipt` with **`L1GasUsed`, `L1GasPrice`, `L1Fee`,
`L1FeeScalar`** (JSON `l1_gas_used/l1_gas_price/l1_fee/
l1_fee_scalar`, hex quantities, OP-stack-only receipt extensions;
Base's own API reference documents the same set as "OP Stack L2
field"; `l1_fee` = the total L1 data fee; the scalar is versioned
post-Ecotone). Encoded as `OpStackReceiptFee` in the EVM member with
the pin in its doc comment.

## L1Surcharge implementation + probes

The EVM member now carries Base payments end-to-end:
`open_base_intent` REQUIRES a declared surcharge worst case (the R11
gate), reserves the COMBINED gas+surcharge worst case in the unified
ledger (class L1Surcharge), and keeps the split bounds per payment.
`reconcile_base` validates EACH component against its declared bound
BEFORE any mutation, then hands combined actuals to the ledger (which
re-checks possibility and reconciles DOWN).

Harness (all refusals name the field; healthy controls throughout):
- **missing bound** → `L1Surcharge` refusal (gate law) + control;
- **underestimated bound** → receipt `l1_fee` above the declared
  worst case refuses with "UNDERESTIMATED L1 SURCHARGE BOUND", state
  and reservation UNCHANGED (pre-mutation), then the in-bound control
  settles;
- **exceeding declared possibility (gas component)** → named
  `gas_paid` refusal; boundary control at exactly the bound passes;
- **UNKNOWN → reconciliation**: submitted → rpc-outage → Unknown
  (never auto-retry) → evidence arrives → settles through the
  evidence path (expiry blocks new intents, never old evidence);
  terminal immutability re-asserted afterward ("lifecycle … terminal
  states immutable").

## The x402 door wired into compose (one state machine)

New `x402` module — the estate's door (bsigner law, R9 read) as
POLICY EVALUATION + handoff, nothing more: `gate()` checks the
inseparability law (allowlist row must match pay_to AND seller_key_id
— a pinned destination cannot be paid under a stranger's signature),
the hard per-signature cap, and the window amount ceiling — all
member's-hand policy the gate READS and never writes; signature
verification and the one-signature split stay with bsigner/organ at
build time (documented scope law). `compose_from_offer` gates, derives
the payment identity as **keccak256 of the canonical offer bytes**,
and opens an intent in the UNIFIED ledger — the rail ledger is the
only state machine, no duplicate.

The identity choice closes R10-P4's x402 case by construction: the
same signed offer body always derives the same id, so a
double-submitted offer hits the ledger's idempotency law ("never
re-open — route to lookup") — proven in the harness, with a healthy
control composing a different offer beside it and an ungated offer
never reaching the ledger at all.

## Evidence

bpay-rail **24/24** (15 prior + 9 new: 4 surcharge probes + 5 x402
probes); watchpay **65/65 unchanged**; clippy clean; `cargo fmt
--check` clean; secret-scan clean. Receipt:
docs/dispatches/2026-09-16-z2b-r12-surcharge-harness-x402-door.md.

## Open / next

LIVE NWC adapter (same contract, our-relay transport) when authorized;
the one-signature split wiring at the organ (bsigner side) when that
lane builds; batch/multi_pay mock coverage still deferred; OP-stack
receipt field pin to be re-verified against a live Base receipt at
first integration (fields pinned from op-geth + two references, not
from a live RPC — honest limit).

## Sources

- op-geth fork-diff overview (op-geth.optimism.io) — Receipt extension
  fields; BaseHub eth_getTransactionReceipt reference; Chainstack
  Optimism receipt reference (converging); Ecotone scalar versioning
  (ethereum.stackexchange L1-fee calculation Q&A).
- R11 dispatch (surcharge finding); bsigner/x402.rs (in-tree, R9);
  bpay-rail R10 harness.
