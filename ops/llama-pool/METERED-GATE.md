# Metered gate — design (door lane, enforce before serving beyond test agents)

Status: DESIGN. The flat `POOL_KEY` gate is test-only. No serving
beyond test agents until this is enforced.

## Scale law it answers

10B users, millions of LOVERnments at 6^5, zero estate egress. The
estate never pays for user traffic, so admission cannot be "one shared
key, unmetered inference." Every byte through the door is accounted
per key and settled in bPay; the door stays a replaceable adapter
(#479), never an authority — the key is payer authorization.

## Design

- **Per-key identity at the door**: Caddy `forward_auth` (or a door
  sidecar on the same host) resolves the presented key to a payer
  account. Unknown key → 401 (current correct behavior, kept).
  The shared test `POOL_KEY` maps to a single test account with a
  hard byte cap; it is retired when per-key issuance opens.
- **Byte accounting**: the sidecar meters both directions at the
  adapter boundary — request bytes in, response bytes out (headers
  excluded, body bytes exact) — and appends one signed metering
  record per request to bMeter: `{key_id, account, bytes_in,
  bytes_out, model, ts, door_id}`. Records are append-only; the
  sidecar holds no balance state, so a door can be replaced without
  losing the ledger (the adapter law again).
- **Settlement in bPay**: bMeter records aggregate per account into
  bPay debits at the estate's published per-byte rate. Exhausted
  balance → door answers 402 before the request reaches a member.
  No record, no inference: if the metering append fails, the door
  refuses rather than serving unmetered (fail closed — an unmetered
  byte is an estate-paid byte).
- **Budgets per LOVERnment**: accounts nest — a LOVERnment account
  holds sub-keys per agent with individual caps, so one agent cannot
  drain a government's balance. Caps enforced at admission (402),
  not discovered after settlement.
- **What the member sees**: nothing changes. Members keep serving
  `llama-pool` on their private binds; metering lives entirely at
  the door, so members stay interchangeable and the mid-task kill
  test (Step 5) is unaffected.

## Enforcement checklist (before non-test serving)

1. Sidecar meters exact body bytes both ways; bMeter append is
   synchronous and fail-closed.
2. Per-key issuance + LOVERnment sub-key caps live; test `POOL_KEY`
   capped and scheduled for retirement.
3. bPay debit path consumes bMeter records; 402 on exhaustion proven
   by an end-to-end test with an empty account.
4. Receipt per request joins the Chain-of-Custody evidence (Step 5
   receipt gains `key_id`, `bytes_in`, `bytes_out`).

## Open decisions (founder/L0V3)

- Published per-byte rate and its currency unit in bPay.
- Whether metering records are bSigner-signed at the door or rely on
  door-host attestation — signing cost per request vs audit strength.
