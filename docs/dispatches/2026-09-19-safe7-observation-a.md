# Safe 7 Observation A — backend slice close-out (bPay / Suite-MCP transport)

Mission: backend only; smallest honest path to a real Safe 7 device receipt
through Trezor Suite 26.9.2 experimental MCP. Branch
`zcode/bdata-phase-e-2026-09-19` (worktree `wt-zcode-bpay-e`), started at
`8a58e31a` (≥ fedb2095 as ordered).

## 1. What was verified BEFORE building (order: code → tests → receipts)

- Code: the signing boundary is `watchpay::connect::ConnectTransport`
  (`ethereum_sign_transaction(&ConnectRequestJson) -> ConnectSignedTxRaw`),
  driven by `sign_wave_slot`; the hot TESTNET key is one implementor. The 15
  binding laws, composer, wall, receipt grammar, two-slot shape — untouched
  (watchpay has ZERO source changes this slice; `git diff fedb2095 -- crates/
  watchpay` is empty).
- Tests: watchpay preserved suites all green (153 across targets, incl. wave
  32/32, adapter 50/50); bpay-sign gains 6/6 new.
- Receipts: phase-E dispatch + runbook + board rulings re-read; the lane was
  PARKED at exactly this experiment.

## 2. Suite MCP's EVM-signing interface — INSTALLED + RUNTIME evidence (no inference)

- Installed 26.9.2 (`savedCurrentVersion` in `%APPDATA%/@trezor/suite-desktop/
  config.json`); `mcpSettings: enabled, port 21340, token` — the founder had
  already enabled it.
- Runtime: plain JSON-RPC 2.0 at `POST /mcp?token=…`; root answers 404
  ("Use POST /mcp"); bad token answers 401 naming the token shapes; no
  initialize/SSE needed.
- Eight tools (live `tools/list` = asar strings): get_address,
  get_account_info, get_public_key, sign_message, verify_message,
  sign_typed_data, **send_transaction**, push_transaction. There is NO
  sign-only `trezor_sign_transaction`.
- `trezor_send_transaction` EVM branch (asar, read verbatim): explicit `path`,
  `nonce`, `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, `data`,
  `chainId` all pass through into `ethereumSignTransaction` (the SAME wire
  shape `ConnectRequestJson` models); auto-fill only when omitted; contract-
  call default gasLimit is 100000 (trap — the adapter always sends explicit
  ceilings); `broadcast` defaults TRUE and is a post-signing `pushTransaction`
  — with `broadcast:false` the payload is Connect's `EthereumSignedTx`
  `{serializedTx, v, r, s}` = exactly `ConnectSignedTxRaw`. Failures are
  HTTP-200 `content[0].text = "Error: {json}"`.
- Device: Safe 7 T3W1 on USB; firmware upgraded by the founder to stock 2.12.5
  immediately before the ceremony (changelog checked: Ethereum changes in
  2.12.4/2.12.5 do not touch `ethereumSignTransaction`; 2.12.4 optimized THP
  + host-disconnect fix).

## 3. The adapter (UNDER the boundary; nothing above changed)

`crates/bpay-sign/src/suite_mcp.rs` (+ `lib.rs`, `bin/safe7_preflight.rs`;
`main.rs` only switched to the lib's `rlp` module):
- `SuiteMcp` — minimal JSON-RPC client; token via env, never printed; error
  strings redact the token by construction (a leak was caught + scrubbed
  mid-session and the fix proven by the run-3/4 logs).
- `SuiteMcpTransport` — implements `ConnectTransport`; maps every 1559 field
  explicitly (hex-quantity → decimal wei strings), `broadcast:false` is a
  CONSTANT (no parameter exists to set it true; no `pushTransaction` code path
  exists in the crate).
- `safe7_preflight` binary — Observation A driver: tools/list → silent
  get_address → sign_message (rejection stage) → sign_message (approval) →
  local k256 recovery of the personal-message signer → match proof → receipt
  (exit 0 match / 1 mismatch / 2 incomplete; every outcome recorded, zero
  retries).
- Tests (6/6, ×5 runs, zero flakes): arg mapping incl. broadcast:false
  constant; wire round-trip through a mock MCP server (token-in-query asserted);
  tool-error → refusal; protocol-error; personal-message recovery round-trip in
  BOTH v forms (0/1 and 27/28 — the device returned v=28, so this mattered);
  checksummed-address acceptance.

## 4. Observation A — RESULT (banked, docs/receipts/bpay-safe7-preflight-2026-09-19.md)

- Preflight + silent derivation: `m/44'/60'/0'/0/0` →
  `0x8fd7252a29fb759755e30a15e966932eaad91b75` (after Suite's
  "Select your Trezor — MCP Agent" modal was confirmed; a Suite RESTART was
  needed first — my earlier never-answered probe calls left the MCP server's
  device queue wedged: tools/list answered, every device call hung).
- **Deliberate rejection: NOT EXERCISED** — the founder approved the first
  prompt in both passes (recorded honestly by the tool). Refusal path proven
  only at unit level + live transport-timeout refusals.
- Approval + recovery: signature recovered locally →
  `0x8fd7252a29fb759755e30a15e966932eaad91b75` = derived address = claimed
  address (both matches TRUE, v=28). Runs 4 and 5 returned the IDENTICAL
  signature — deterministic message signing; reproduction, not independence.

## 5. Observation B — NOT ATTEMPTED

Stop-for-inspection holds. No `trezor_send_transaction`/`push_transaction`
call was made in any run; no transaction composed/signed/broadcast; mainnet
untouched; no authorization records read or created; the bpay-sign SERVICE is
byte-identical in behavior (testnet-demo mode law unchanged — the new
transport is not yet wired into `/v1/sign/begin`; wiring it is the first act
of B's continuation slice if ordered).

## 6. Preserved permanently

- 2 signatures, not 57 (the two-slot count law; zero were spent here).
- measured gas FACT 3,117,489 vs minimum-envelope POLICY 600k + 50k×n —
  unchanged, organ-side, untouched.
- TESTNET-REPLICA ≠ public Sepolia — unchanged.
- mainnet untouched.
- no native Rust THP build (Suite-MCP path now DEVICE-PROVEN for
  get_address + sign_message; the transaction-signing hop specifically
  remains to be exercised in B).

## 7. Everything NOT proven (the honest list)

1. On-device deliberate rejection (founder approved twice).
2. `trezor_send_transaction` through the REAL device (B's hop) — schema and
   payload mapping are asar- and unit-proven, device-unexercised.
3. The wall (`verify_wave_signed`) against a REAL device-produced
   `EthereumSignedTx` — same hop.
4. Suite-version drift: pinned to 26.9.2's asar; the MCP surface is
   experimental and may change shape.
5. Whether the Suite permission modal re-prompts per capability on a fresh
   Suite boot (read-address and sign-message permissions were granted this
   session; a fresh boot may re-ask).
6. The wedged-MCP-queue cure (Suite restart) was observed once; root cause
   inside Suite is inferred from behavior, not read in source.

## 8. Runbook delta (ops/bpay-sign/README.md)

Added: Observation A result block + operational laws (restart cure,
device-select modal, checksummed addresses, deterministic signatures,
`v` both forms).
