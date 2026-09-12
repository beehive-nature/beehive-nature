# z2.c — offline Trezor Connect adapter + signed-result verification

Seat z2.c (GLM/zCode), 2026-09-12. Order:
`wt-zcode-watch-jams-plur/docs/dispatches/2026-09-12-z2c-watchsign-orders.md`.
Worktree `../wt-z2c-watchsign`, branch `codex/z2c-watchsign`, built directly
on the accepted z2.b pin `76b23661513dd6d33b81f465a3bd958499271864`
(fetched and verified before branching). No real device, Suite or Connect
session, no wallet/seed/keyring access, no RPC, no broadcast, no upload, no
payment, no installation, no deployment, no upstream PR, no changes to any
other seat's worktree or to live surfaces/ops.

## Architecture (three new modules in `crates/watchpay/src/`)

```
ValidatedPlan (z2.b, sealed)
   │ SignRequest::compose          [connect.rs]
   │   revalidate(now) → derive calldata (existing calldata.rs) →
   │   compose AT the plan ceilings (gas, fee cap, priority) — the
   │   reviewed worst case IS what is signed; the bridge has zero
   │   recomposition freedom. Path: BIP-44 m/44'/60'/a'/b/c, bounded.
   ▼
SignRequest ──review_summary()──► ReviewSummary (what the payer approves)
   │ connect_payload()            ConnectRequestJson (the pinned wire shape)
   ▼
ConnectTransport (INJECTED TRAIT — no implementation ships in this crate;
   │   tests use FakeConnectTransport with public synthetic keys)
   ▼
ConnectSignedTxRaw {serializedTx, v, r, s}     ← UNTRUSTED
   │ verify_signed_result          [connect.rs + signed_tx.rs + eth.rs]
   │   1. length bounds on every response string BEFORE parsing
   │   2. strict hex (serializedTx = byte string; v/r/s = quantities —
   │      minimal toString(16) integers, odd lengths lawful)
   │   3. SignedTx::decode_strict — alloy-rlp header strictness +
   │      canonical re-encode byte-equality + minimal integers +
   │      legacy v ≥ 35 (EIP-155 replay form; 27/28 refused) +
   │      1559 type discipline (only 0x02; empty access list only)
   │   4. envelope family must match the request
   │   5. EVERY decoded field == request field (named refusals)
   │   6. response v/r/s == envelope-embedded components
   │   7. r,s ≠ 0; s ≤ n/2 (EIP-2 low-s)
   │   8. signer RECOVERED from the locally-computed preimage
   │      (k256 recover_from_prehash) must == plan.expected_payer
   │   9. tx hash = keccak256(canonical bytes), computed LOCALLY;
   │      existing z2.b validate_transaction re-binds everything
   │      against the sealed plan (the second wall)
   ▼
VerifiedSigned (PRIVATE constructor — only verify_signed_result builds it;
   │   callers cannot assemble one from unchecked fields)
   ▼
record_verified_signed → ledger.record_signed (z2.b boundary; freshness
   revalidated; duplicate tx-hash refused; reservation tightened to this
   tx's worst case)
```

Driver `sign_batch_payment`: write_intent FIRST → compose → ONE transport
call → verify → record. Transport errors (refusal/cancel/timeout)
propagate with the open Intent retained and its reservation held — no
retry, nothing freed; explicit `cancel_intent` is the release path. A
duplicate/late result fails at the ledger (state no longer Intent); a
result for a cancelled attempt likewise. Crash points: after intent →
open Intent on reload, re-sign refused until explicit cancel; after
signed → Signed durable, re-sign refused (never auto-re-sign).

Approval scope law: `TxDestination::Approve` composes and verifies PURELY
(tested against an ethereumjs-signed approve fixture); NO driver writes
approval intents and the allowance lifecycle stays outside the per-batch
fee ledger. Enabling approval orchestration needs its own persisted fee
accounting in a reviewed slice.

## Source pins (inspected 2026-09-12; downloads only, no SDK/device calls)

- `@trezor/connect-web 9.7.3` (current stable; dist-tags checked) and its
  dependency `@trezor/connect 9.7.3` — request/response schema read from
  the installed package source:
  - `lib/types/api/ethereum/index.d.ts`: `EthereumSignTransaction =
    {path, transaction: legacy|eip1559, chunkify?}`;
    `EthereumSignedTx = {v, r, s, serializedTx}` (all strings).
    Legacy carries `gasPrice`; 1559 carries `maxFeePerGas`/
    `maxPriorityFeePerGas` (+optional accessList); `chainId` is a JSON
    number; the other family's fields are `Optional<undefined>`.
  - `lib/api/ethereum/ethereumSignTx.js`: the device returns recid
    `v ∈ {0,1}`; shared `processTxRequest` adds `2·chainId+35` for legacy
    when `chainId && v ≤ 1`, and is called WITHOUT chain_id on the 1559
    path (so 1559 `v` stays yParity `{0,1}`). Serialization is
    client-side via `serializeEthereumTx` → `@ethereumjs/tx`
    (`createTx(...).serialize()`), pinned by Connect at `^10.1.0`
    (10.1.3 resolved).
- Fixture generator `crates/watchpay/dev/gen-connect-fixtures/`
  (package.json pins `@trezor/connect 9.7.3`; README receipts the run):
  signs with **@ethereumjs/tx 10.1.3** — the exact family Connect itself
  calls — offline, on synthetic inputs mirroring `test_support::base_batch`.
  The pinned fixtures in `tests/adapter_signing.rs` are its verbatim
  output (spliced programmatically from `fixtures.json`, which is
  intentionally untracked: long hex lines cannot carry same-line
  PUBLIC-CONSTANT markers).
- EIP-155 spec's own published example vector — bytes verbatim from the
  EIP text; signing hash matches the spec byte-for-byte
  (`0xdaf5a779…`), sender/hash cross-confirmed by ethereumjs in the same
  generator run.
- Rust dependencies: `alloy-rlp 0.3.16` (lockfile-resolved; strict RLP
  header decode/encode — no hand-rolled length math; inspected at 0.3.12
  source for the API surface) and `k256 0.13` (already in the workspace
  via bnr-keys/bswap; recovery-only here). Lockfile delta: exactly the
  `alloy-rlp` entry (+12 lines); k256/bytes/arrayvec were already present.

## Test evidence (offline, `cargo test -p watchpay --locked --offline`)

**107 passed, 0 failed** = the 65 z2.b tests PRESERVED UNCHANGED +
2 `eth.rs` unit tests (low-s bound arithmetic; recovery rejects garbage)
+ 40 adapter tests in `tests/adapter_signing.rs`:

- Independence (4): EIP-155 spec vector (decode + signing hash == spec +
  recovered sender + tx hash + canonical re-encode); ethereumjs legacy
  fixture parity; ethereumjs 1559 fixture parity (incl. response-component
  form v/r/s); synthetic key's address agrees with ethereumjs's sender.
- End to end (2 + 1 pure): compose → fake bridge → verify → ledger
  Signed, ONE transport call, locally-computed hash in the record —
  legacy and 1559; approve composes and verifies PURELY with the
  ethereumjs approve fixture and no ledger materialized.
- Field binding (11): validly-signed wrong chain (×2), nonce, destination,
  value, calldata, gas limit, fee cap (×2 envelopes), priority fee,
  envelope-family swap — each names the field, keeps the Intent, keeps
  the reservation.
- Signature/response forgery (4): wrong signer (recovery ≠ expected
  payer — "from", naming the recovered signer); response-v and response-r
  mismatch vs the envelope components; EIP-2 high-s twin (both layers
  refuse: the explicit low-s law fires first naming `s`; k256's recovery
  independently rejects the twin — demonstrated directly).
- Replay protection (1): pre-EIP-155 v=27 legacy refused naming `v`.
- Malformed/oversized (6): garbage/truncated bodies; trailing bytes;
  non-minimal integer encoding; oversized serialized (128 KiB+1), r (33
  bytes), v (9 bytes) — refused BEFORE parsing; missing signature
  components (short list names the missing field); unsupported type bytes
  0x01/0x03/0x04/0x7f.
- Lifecycle (7): transport refusal never retries, reservation kept,
  re-sign blocked, explicit cancel releases, fresh attempt works; expired
  plan / bad batch index → ZERO transport invocations and nothing
  persisted; duplicate callback refused with state unchanged; stale
  result after explicit cancel refused (Cancelled stands); crash after
  intent → fail-closed recovery; crash after signed → durable Signed,
  re-sign refused.
- Contract/review (4+): Connect wire shape (hex quantities, numeric
  chainId, per-family fee fields only, chunkify false, JSON round-trip);
  review summary derives from the same request (operation, plan hash,
  batch id, token ceiling, approve ceiling, worst-case native fee, one
  signature); derivation-path constraints; VerifiedSigned access surface.
- Composed request == fixture fields (calldata byte-identical to the
  generator's JS replicator output).

Every test's name states what it proves; the fake transport signs with
clearly labelled PUBLIC synthetic test keys — nothing here is hardware
evidence.

## Mutation evidence (all restored; `git diff 76b23661 -- crates/watchpay/src/tx.rs` is empty)

- **A1** (neutralize the adapter's calldata bind in `connect.rs` alone):
  `tampered_calldata_refused` STILL PASSED — the z2.b
  `validate_transaction` wall independently refused the hostile calldata
  naming `input`. Defense in depth, demonstrated.
- **A2** (additionally neutralize the z2.b `tx.input` check in `tx.rs`):
  `tampered_calldata_refused` FAILED (0/1) — the test guards the composed
  boundary.
- **B** (remove the recovered-signer == expected_payer check):
  `wrong_signer_refused` FAILED (0/1) on the assertion that names the
  recovery layer.
- After restore: 107/107 green, fmt clean.

## Gates run locally (Windows; CI is authoritative per repo law)

- `cargo fmt --all --check` — clean.
- `cargo test -p watchpay --locked --offline` — 107/107.
- `cargo clippy -p watchpay --locked --offline --all-targets` — zero
  warnings from this crate (one deliberate `#[allow(clippy::too_many_arguments)]`
  on the driver, justified in-line).
- `sh scripts/secret-scan.sh tree` — clean (all fixture hex carries
  same-line PUBLIC-CONSTANT markers).
- Pre-existing workspace warning (`bnr-keys` profile-in-non-root) is
  inherited, not from this slice.

## API limitations (honest list)

- The z2.b synthetic door is STILL OPEN by design this slice:
  `tx::DecodedTransaction` (public fields) and `ledger::record_signed`
  remain public offline-only APIs for the preserved tests. The adapter
  path through `connect::verify_signed_result` → `VerifiedSigned` is the
  verified boundary; this crate does NOT claim the ledger alone prevents
  bypass while that door is open. Closing it is a reviewed integration
  decision (it would break the 65 preserved tests' shape).
- `VerifiedSigned` is non-constructible outside the crate (private
  fields, private constructor) — a compile-time guarantee, pinned by an
  access-surface test.
- No transport implementation exists: no browser page, iframe/popup, SDK
  init or auto-connect path is enabled anywhere in this crate.
- k256's `recover_from_prehash` verifies its recovered key against the
  preimage and additionally rejects high-s candidates — our EIP-2 law is
  therefore double-enforced (explicit check first, library second). The
  high-s twin's same-key recovery could not be demonstrated THROUGH k256
  (it refuses); the identity is cited from EIP-2's rationale instead.
- 1559 requests never carry an access list; a bridge returning one is
  refused (`access_list`). Legacy pre-155 (v=27/28) is refused outright
  (replay protection is mandatory).
- Fee/gas composition happens AT the plan ceilings by law; a bridge
  cannot choose lower fees. Real deployments wanting dynamic fees need a
  reviewed recomposition path with a fresh summary.
- Same honest limits as z2.b stand unchanged: deployment parity of the
  vault contract UNVERIFIED; RPC evidence externally supplied; Windows
  durability documented-not-proven; no upload-process-death recovery.

## Proposed later device preflight (NOT authorized by this slice)

The natural next reviewed step, per the z2.a gate ladder (ii): a
testnet/zero-value `ethereumSignTransaction` round-trip on the founder's
hand only — our composed request through the REAL Connect bridge
(`@trezor/connect-web 9.7.3`, iframe flow), the device's
`serializedTx`/v/r/s fed into THIS adapter's verifier unchanged, proving
the device renders and signs our calldata shape with no vault
involvement. Preconditions to review: path/address confirmation via
`ethereumGetAddress` first (the recovered-signer law makes the path a
display concern, not an identity one), the connect-store admission gate
stays closed throughout, and the founder's standing one-Trezor-one-app
preference (close Suite first). Hardware display/blind-signing behavior
remains unverified until then.

## Return

Branch `codex/z2c-watchsign`, descendant of `76b23661`, pushed without
force. Hosted checks reported at the exact SHA in the commit message.
No merge, no upstream PR.
