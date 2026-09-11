# Connect + Store: synthetic payment/admission gate

Authorized by the founder's direction after the x0x #622 lane closed (David's
#641-era help landed via merged upstream #651; our fork PR superseded; no
outstanding request). Base: receiver head `f6547244` on
`codex/connect-store-receiver-2026-09-11` — itself unmerged and awaiting
review. Worktree `wt-zcode-cs-admission`; the shared checkout, the accepted
integration worktrees, production relays, apps, wallet and paid Autonomi
paths untouched.

## The slice

`tools/connect-store/admission.mjs` + a Channel admission hook + 10 new
tests (40/40 total in `tools/connect-store`; process-loss proof re-run
`passed: true` with unchanged honest network flags).

- **`AntdQuoteSource`** drives the REAL antd 0.12.0 cost caller
  (`POST /v1/data/cost`, `{data: base64, payment_mode}` → string
  `cost`/`estimated_gas_cost_wei`, `chunk_count`, `file_size`), exercised in
  tests against a capturing loopback server — no antd daemon, no network.
  Quotes are sampled extrapolations by antd's own documentation, so a quote
  alone decides nothing. Malformed amounts fail closed as
  `invalid-quote-response` (non-decimal strings included — `BigInt()` never
  leaks a raw SyntaxError).
- **`SyntheticQuoteSource`** is deterministic offline math: per-byte rate,
  per-chunk overhead, per-record overhead. Content-independent by design.
- **`PaymentAdmissionGate`** is the enforcer the README demanded before any
  funded write: each mutation's COMPLETE cost is budgeted — the exact sealed
  snapshot bytes (files ride inside the encrypted snapshot, so uploads are
  covered) plus the checkpoint and x0x notice at their validated 16 KiB caps,
  multiplied by an explicit admitted-retry factor (default none) — and
  reserved against a cumulative lifetime ledger under a hard ceiling
  (`0 < ceiling ≤ 10^15`, validated). Over-ceiling ⇒ `payment-admission-
  refused` (429) with a full deficit receipt, BEFORE any store write: the
  store directory stays empty, the pin stays null, the ledger untouched.
  Refused requests reserve nothing; reservations are not refunded on later
  failure. A dead quote source fails closed as `quote-unavailable` (502)
  without consuming a sequence.
- **Channel hook**: `new Channel({ ..., admission: gate })`; `#commit` seals
  the next state, asks the gate, and only then writes. Admitted results
  carry the receipt: `payment: "synthetic-quote"`, `funds_spent: "0"`,
  `signed: false`, `approval: "pending-trezor-downstream"`.

## Explicitly NOT done (by order)

Real Autonomi writes stay disabled (`AutonomiReadStore.put` still refuses
before any request); Trezor signing stays downstream and unimplemented — the
gate records the pending approval and signs nothing. The manifest's
`payment: "disabled"` stands. No funds, no paid requests, no public mesh, no
production relay or app contact. The gate is process state, not a persistent
b-meter — restarts reset the ledger exactly like the existing process write
budget; that boundary is documented and unchanged.

## Receipts

Windows Node, `tools/connect-store`: `npm ci --ignore-scripts` (0
vulnerabilities), `npm test` → **40/40 pass** (10 new admission tests:
synthetic math, over-ceiling zero-write refusal with empty store, synthetic
receipt shape, cumulative ledger second-mutation refusal, retry-factor
budgeting, upload-path admission, real `/v1/data/cost` caller against the
capturing server, malformed-quote fail-closed ×4, dead-source fail-closed,
invalid construction). `npm run prove` → `passed: true`.

## Boundary and next

This closes the synthetic admission boundary the receiver dispatch named as
the next slice. It does NOT clear the network canary gates: a funded run
needs this gate in front of a real paid store, a second x0x participant
receiving a checkpoint, a separate recovery provider, client-held pins,
writer fencing, policy/key rotation. Branch `zcode/cs-admission-gate`
stacked on the unmerged receiver branch, returned for review.
