# Z2.A — W@tch / Autonomi / Trezor: the audit receipt + z2.b orders

> **⟳ CORRECTED 2026-09-12 (second edition, descendant of dfeaaddb).** The
> astra/codex review
> (`wt-zcode-watch-jams-plur/docs/dispatches/2026-09-12-z2a-trezor-review.md`)
> returned this audit with four blocking corrections. All four verified at
> source and folded in: §3's "Suite MCP cannot carry calldata" claim is
> **RETRACTED** (wrong at the installed source pin); the member-pay.mjs
> reference is **downgraded to a named defect** (not a proof); the payment-plan
> and retry design is replaced by the full contract in §5; the in-memory
> resume claim is corrected in §4. **The old §7 orders are SUPERSEDED — the
> only current authorization is the offline orders in §7 below.** z2.b has not
> started; nothing was signed, broadcast, uploaded, or changed in production
> by either edition of this audit.

Seat z2.a (GLM zCode seat), 2026-09-12. Order: audit hardware-held signing
for W@tch without any seed/private-key import; deliver a source-pinned
receipt and paste-ready z2.b orders. Worktree `../wt-z2a-trezor-audit`
(branch `z2a/trezor-audit-2026-09-12`); other sessions' worktrees read-only;
a disposable shallow clone of upstream sits at WSL `/home/travi/z2a-watch-src`
(HEAD `206da1d1` = the `v0.1.0-alpha.98` release commit — see §8 on pins).

## 1 · "Luna" — corrected verdict

**"Luna" is a model label supplied by the founder in the tasking, not a
git-verified agent name.** A negative name search (all-history git log,
dispatches, specs, dockets, memory, the fork's branches/PRs, six WSL
`wt-watch-*` worktrees, Downloads handoffs — all performed, all negative for
that name) **cannot establish that the session or its work did not exist**;
it establishes only that nothing is recorded under that name. What the search
did find, attributed as precisely as the records allow:

- The W@tch-fork Trezor slice (PR #8's `trezor_suite.dart` +
  `docs/TREZOR-INTEGRATION.md`) was pushed from the founder's GitHub account
  (`loviswaternakamoto`) on branch `codex/media-intake-visibility-2026-09-11`;
  the WSL worktree and branch naming carry the codex seat's convention, and
  the zCode credits/intake handoffs (`Downloads/Watch-TV-2026-09-10/`) show
  seats other than zCode working that line. **Exact author/session
  attribution: UNRESOLVED.** It may be the founder's "Luna" session; this
  audit does not assign it to any seat.
- No dispatch covers that desktop pass; its Trezor tests are mock-only (§2).
- If "Luna" is an external collaborator whose claims reached the founder:
  nothing banked under that name exists in our records, and this audit banks
  nothing on any external claim.

## 2 · Evidence table — observed / source-supported / mock-tested / live-tested / unverified

| # | claim / artifact | status | pin |
|---|---|---|---|
| E1 | W@tch upstream α.98 has zero Trezor code; one hot-wallet path (BIP-39 generate or key/phrase import → OS keychain/file → `with_wallet` → `PaymentMode::Auto` inside ant-core); quotes via `POST /upload/estimate`; no external-signer mode | **observed** (source read) | release commit `206da1d1` (tag `v0.1.0-alpha.98`): `app/lib/screens/wallet_screen.dart`, `native/watchit_core/src/wallet.rs`, `engine.rs:324-338`, `upload.rs` (`start_upload` refuses without wallet; `file_upload_public_with_progress(..., Auto, ...)`), `server.rs:576` |
| E2 | ant-core at the app's pin exposes the external-signer split: `file_prepare_upload_with_mode` → `ExternalPaymentInfo::{WaveBatch, Merkle}` → per-batch on-chain call → `finalize_upload_merkle_multi`; vendor example + ADR-0003 | **source-supported** | WithAutonomi/ant-client rev `dbc01ce8`: `ant-core/src/data/client/file.rs:1232-1256, 1302-1335, 1887+`, `client/merkle.rs:168-176` (`PaymentMode::{Auto, Merkle, Single}`; Merkle forces merkle, min 2 chunks), `examples/external-merkle-large.rs` |
| E3 | prepare can still return a **WaveBatch** after the already-stored preflight even when Merkle was requested (remainder below threshold) | **source-supported** | `file.rs:1302-1309` (`payment_info` doc: "may be wave-batch even when the original chunk count was merkle-eligible") |
| E4 | `FinalizeResume` is an **in-process** handle; dropping it abandons the upload (merkle path **removes its spill directory from disk**) | **source-supported** | `file.rs:1357-1370` (enum + "Dropping it abandons the upload… removes its spill directory"), `:716-738` (`require_fully_paid_for_resumable`) |
| E5 | evmlib v0.9.1 `Wallet` methods all sign+broadcast from a private key (no unsigned-tx method on Wallet) | **source-supported** | docs.rs `ant_protocol::evm::Wallet` v0.9.1 |
| E6 | evmlib v0.9.1 **ships key-less calldata builders** in `src/external_signer.rs`: `approve_to_spend_tokens_calldata`, `transfer_tokens_calldata`, `pay_for_quotes_calldata`, `pay_for_merkle_tree_calldata` — **but ant-protocol 2.3.5 does not re-export `external_signer`** (its `evm` module exposes only `contract`, `testnet`, `utils`) | **source-supported** (crate-level; unreachable through the app's pin without a direct evmlib dep — skew-warned — or an ant-protocol re-export) | WithAutonomi/evmlib tag `v0.9.1` `src/external_signer.rs`; docs.rs ant-protocol 2.3.5 `evm` index |
| E7 | evmlib's own merkle builder returns `approve_amount = Amount::MAX` (**unlimited**) because winner-pool selection uses `msg.sender` as entropy | **source-supported** — collides with our exact-approve law (SPEC §2); our composer must derive a bounded ceiling from the plan instead | evmlib v0.9.1 `external_signer.rs` (`pay_for_merkle_tree_calldata` doc) |
| E8 | Vault contract ABI at the pin: `payForMerkleTree(uint8, PoolCommitment[], uint64) returns (bytes32 winnerPoolHash, uint256 totalAmount)`; `PoolCommitment = {bytes32 poolHash; CandidateNode[16] candidates}`, `CandidateNode = {address rewardsAddress; uint256 amount}`; event **`MerklePaymentMade(bytes32 indexed winnerPoolHash, uint8 depth, uint256 totalAmount, uint64 merklePaymentTimestamp)`**; error `PaymentAlreadyExists(bytes32)`; read-back `getCompletedMerklePayment(bytes32)` | **source-supported** (the contracts live in evmlib) | evmlib v0.9.1 `contracts/IPaymentVaultV2.sol:25-30`, `contracts/Types.sol` |
| E9 | evmlib decodes the winner from the receipt's `MerklePaymentMade` (all four fields) and exposes the completed-payment read-back | **source-supported** | evmlib v0.9.1 `src/contract/payment_vault/handler.rs:103-114, 144-171, 182+` |
| E10 | **`member-pay.mjs` is defective, not a proof**: its `VAULT_ABI` has one function and **no event fragment** (so `parseLog` cannot decode `MerklePaymentMade`), it regex-matches `/merkle/i` and **falls back to the transaction hash as "winner"** — and its `(address,uint96)[]` commitment encoding does not match the v0.9.1 `PoolCommitment` shape (E8). The executed devnet leg used the evmlib Rust wallet directly; the JS script was never run | **defect identified** (mock-tested: never; live-tested: never). Do not use as the calldata/receipt reference | `ops/ant-extsig/member-pay.mjs` @ dfeaaddb; README ("the devnet leg used the evmlib standalone wallet directly") |
| E11 | The ant-extsig harness proved, **on a local devnet, with a software signer**: wallet-less client prepare → external payment → client destroyed → fresh-client finalize, no re-quote; both arms priced (4-chunk file → wave) | **live-tested (devnet only; software key; not a Trezor; not the JS payer)** | `ops/ant-extsig/src/main.rs` + README, @147854c2 |
| E12 | Trezor Suite MCP server exists (experimental, localhost:21340, bearer token); `trezor_send_transaction` schema includes **`data`** ("Contract call data hex string (EVM only)"), `chainId`, fee fields, and `broadcast`; it reaches `ethereumSignTransaction` | **source-supported at the installed version's source** — the founder's Suite 26.6.1 reports commitHash `f658f2cf` in its own log, and that commit's `mcp-server.ts` carries the schema (lines ~354-466); also present at the review's pin `aee3f9e8`. **Live behavior on 26.6.1 with this device: UNVERIFIED** (no session run) | trezor/trezor-suite `f658f2cf…`/`aee3f9e8…` `packages/suite-desktop-core/src/modules/mcp-server.ts`; `Downloads/trezor-suite-log.txt` (26.6.1 + commit) |
| E13 | The Suite skill/agent guidance page describes a stablecoin-transfer usage pattern and tells agents not to show users calldata | **observed (docs)** — that is vendor *guidance*, not a capability limit; do not conflate the two, and do not read it as founder authorization | docs.trezor.io trezor-mcp SKILL page |
| E14 | Fork PR #8's `trezor_suite.dart` (read-only Suite MCP client: initialize, `trezor_get_address`, session-only token, no signing) | **mock-tested only** (2 tests against a fake MCP HTTP client); **no real-device or real-Suite session**; PR #8 CLOSED by the maintainer for bundling/intake/copyright — not a Trezor rejection; the maintainer invited a separate discussion for the read-only bridge | PR #8 diff + `app/test/trezor_suite_test.dart` |
| E15 | `surfaces/bantfarm.html` Connect wing: gesture-only disclosed load, `ethereumGetAddress(showOnTrezor)`, Sepolia+mainnet RPC failover, AT-1 zero-value bench, prepare-output decoder | **observed (code in tree), live-tested: NOT for the AT-1 bench** — no dispatch claims a real-device run; **UNVERIFIED** | `surfaces/bantfarm.html` |
| E16 | connect-store admission gate holds Trezor/Autonomi writes disabled | **observed (in tree)** | @d5866964 |
| E17 | Watch-It desktop α.98 build present on this machine; Suite 26.6.1 installed and previously run | **observed (artifacts)** | `Downloads/Watch-It-0.1.0-alpha.98-windows-x64*`, `trezor-suite-log.txt` |

## 3 · The corrected boundary statement

Retraction first: **the first edition's §3.1 ("Suite MCP cannot carry
Autonomi payments — no calldata parameter") was wrong** and is withdrawn. The
installed version's source carries `data` (E12). What remains true, each at
its evidence level:

1. **Capability ≠ deployment ≠ authorization.** Suite MCP *may* be able to
   carry `approve`/`payForMerkleTree` (source-supported, E12), but its live
   behavior on the founder's 26.6.1 + device is UNVERIFIED, and **the
   founder's standing preference is our own Connect signing surface** (SPEC
   §2 amendment, 2026-08-21). Support in Suite does not change that
   preference; this audit does not propose changing it. Any Suite-MCP payment
   experiment would be its own later, separately-authorized slice.
2. **The app still has no external-signer mode** (E1) — an upload cannot be
   prepared, priced, and finalized around an out-of-band payer in W@tch
   today. That is the genuine app-side gap.
3. **The composing layer is reachable but not free:** evmlib's key-less
   builders exist (E6) yet are not re-exported through ant-protocol 2.3.5 —
   the fork either composes through the re-exported
   `ant_protocol::evm::contract` payment-vault bindings, takes a direct
   evmlib dep (version-skew warning stands), or asks ant-protocol to
   re-export `external_signer` (the narrow upstream ask). And wherever
   composed, our own bounded approve ceiling must replace the vendor's
   `Amount::MAX` default (E7) — exact-amount approval is our law, and the
   vendor helper violates it by design.
4. **The estate has no strict receipt decoder and no durable payment state**
   — the only in-tree decoder is defective (E10); evmlib's own decode (E9) is
   the pattern to mirror. This is the §5 contract's job.
5. **Process-death recovery does not exist** (E4): paid-but-unfinished after
   a crash remains a real loss class. #140's fix is same-process only.

## 4 · SPEC-AUTONOMI-TREZOR-1 reconciliation — corrected

- **KEEP as law:** custody key-map + no-vaults; exact/bounded approvals,
  never unlimited (now with the E7 collision named); confirmation-count
  print before the device is touched; addresses re-derived from the pinned
  binary at build time, never trusted from a document; Connect as the web
  bridge (founder preference); one-Trezor-one-app (close Suite first).
- **AMEND — stranded payments (§4 of the SPEC):** the position is now
  three-tier, replacing my first edition's over-broad "#140 fixed, rule
  retires": (a) same-process partial-finalize retry EXISTS
  (`FinalizeResume`, E4) — exercise it in tests; (b) fresh-client finalize
  while retaining prepared state is devnet-proven (E11); (c) **process-death
  recovery does not exist** — the spill directory is deleted on drop, a
  re-prepare buys new quotes, and the paid batch stands unfinished. **The
  paid-but-unfinished risk is RETAINED in the SPEC** until (c) is implemented
  and tested upstream or by us; receipts-before-finalize stay mandatory.
- **AMEND — wave is avoidable but must be checked, not assumed**
  (`PaymentMode::Merkle` forces merkle ≥2 chunks; preflight can still flip to
  WaveBatch, E3): the harness reads the returned arm and refuses or
  explicitly prices the wave confirmation count before any device prompt.
- **STRIKE (stale):** the antd-REST flow as the W@tch shape (in-process
  ant-core instead; the daemon pattern remains the box lane's);
  `payForMerkleTree2` naming and member-pay.mjs's `(address,uint96)`
  encoding (the v0.9.1 ABI is E8 — **all calldata work re-binds to E8/E9**);
  the SPEC's "~2 confirmations per GiB" planning number stays planning-only.
- **GATES — corrected split (replacing my first edition's Sepolia strike
  with a proper ladder):** (i) **emulator/devnet ceremonies** (LocalDevnet +
  Anvil, zero money) prove compose/decode/finalize including strict receipt
  checks and negative fixtures; (ii) a **device/Connect preflight** — a
  testnet (e.g. Arbitrum Sepolia 421614) zero/low-value `data`-carrying
  signature through our own Connect surface, proving the device renders and
  signs our calldata shape with no vault involvement; (iii) **funded mainnet
  ceremony** — founder's hand only, first payload a forced-merkle 2-chunk
  public upload (the floor), rehearsed on (i)+(ii) first. Mainnet is never
  the default first device test. **Transaction-signature counts and
  firmware-dependent physical button presses are reported separately** — the
  plan computes signatures; the press count is device-state-dependent and
  only observed.

## 5 · The payment-plan and receipt/state contract (z2.b's build target)

### 5.1 Plan envelope (versioned, bounded, public-inputs-only)

```jsonc
{
  "schema": "watch-pay-plan/1",
  "job_id": "string ≤64, immutable, generated by the app",
  "created_unix": "u64",
  "expires_unix": "u64 — ≤ created + MERKLE_PAYMENT_EXPIRATION window (evmlib v0.9.1 constant); expired plans are refused everywhere",
  "network": { "chain_id": 42161, "rpc_hint": "advisory only", "payment_token": "0x…", "payment_vault": "0x…" },
  "expected_payer": "0x… — required; winner-pool selection uses msg.sender as entropy (E7/E8), so the plan is payer-bound",
  "upload": { "visibility": "public", "data_map_address": "0x…32B — the PUBLIC address only" },
  "arm": "merkle | wave — the arm actually returned by prepare (E3 law)",
  "batches": [ {
      "batch_index": "u32, ordered",
      "depth": "u8 ≤ contract max",
      "merkle_payment_timestamp": "u64",
      "commitments": [ { "pool_hash": "0x…32B",
                         "candidates": [ { "rewards_address": "0x…", "amount": "u256 string, decimal" } ×16 ] } ],
      "batch_amount_ceiling": "u256 string = Σ all candidates' amounts (the deterministic upper bound)",
      "batch_id": "keccak256(chain_id ‖ vault ‖ depth ‖ timestamp ‖ keccak256(canonical commitments encoding)) — the immutable per-batch identity"
  } ],
  "approve_ceiling_total": "u256 string = Σ batch ceilings — the ONLY amount the payer may ever approve to the vault for this plan; never U256::MAX (E7 law)",
  "gas_ceilings": { "per_tx_gas_limit": "u64", "max_total_gas": "u64" },
  "plan_hash": "keccak256 over the canonical serialization of everything above — the reviewed-plan commitment"
}
```

Laws: everything in the envelope is PUBLIC payment input; **DataMaps,
decryption capabilities, chunk bodies, and any private-retrieval material are
forbidden** — a public upload address is a public reference, not a
capability. All integers bounded and unit-explicit (atto). The payer UI
renders: arm, batch count, per-batch ceiling, approve ceiling total, expected
payer, chain, expiry, and the signature count (= batches + approve-if-needed)
— before any device interaction.

### 5.2 Signature/transaction validation (before ANY broadcast)

The adapter must validate what the signer/bridge returns against the plan
before broadcasting: decoded destination ∈ {token, vault}; calldata
selector+args byte-identical to the plan-derived calldata for exactly one
unpaid batch (or the bounded approve); chainId = plan; payer = expected_payer;
nonce/gas within ceilings; serialized-tx hash ≠ any already-recorded tx for
this plan. A mismatch refuses with the field named. No validation, no
broadcast — even for a device-signed object.

### 5.3 Receipt validation (strict; no fallbacks)

A batch counts as paid **only** when a transaction receipt shows: status=1;
`to` = the plan's vault; `from` = expected payer; chain/contract per plan;
**exactly one `MerklePaymentMade` event from the vault address** whose
`depth`, `merklePaymentTimestamp` match the batch and whose `totalAmount` ≤
batch ceiling; winner = that event's indexed `winnerPoolHash`. **Missing
event, wrong contract, malformed/ambiguous logs, or multiple candidates ⇒
REFUSE — no tx-hash fallback, ever** (the E10 defect class). Cross-check:
`getCompletedMerklePayment(winnerPoolHash)` read-back matches depth+timestamp
(E9). For the wave arm: per-quote `DataPaymentMade` events bound to the
plan's quote hashes under the same strictness.

### 5.4 Durable per-batch payment state machine

Per batch, durably recorded (app-local, atomic write) BEFORE any sign
attempt: `unpaid → signing(tx_hash, nonce) → broadcast(tx_hash) →
mined(receipt, winner) | reverted(tx_hash) | replaced_by_fee(tx_hash') |
unknown(tx_hash)`. Reconciliation on every launch/resume and before any
re-sign: `unknown` never auto-triggers re-signing — it requires an explicit
human choice after RPC reconciliation (receipt lookup by hash, by
(`from`,nonce), mempool check). On-chain assists: the vault's
`PaymentAlreadyExists` revert (E8) and the completed-payment read-back bound
to the batch_id make accidental double-payment refuse loudly — but they are
the fence, not the mechanism; the durable ledger is the mechanism. A new
pending nonce per attempt is NOT an idempotency guard (first edition's error)
— an earlier tx can confirm after a timeout; only the state machine +
reconciliation prevents paying the same batch twice. Approve is tracked as
its own ledger entry (allowance read-back on-chain, exact ceiling).

### 5.5 Watch-It-side integration laws (for the later fork slice)

The app retains ALL private state locally (prepared upload, spill, DataMap —
never in the payment envelope). Any localhost mutation API for the external
flow is authenticated (loopback alone is not authorization; the existing
shared-secret guard pattern in `server.rs` applies). External mode selects a
wallet-less client WITHOUT altering or erasing an existing hot wallet;
both-custody states are refused/flagged. The connect-store admission gate
stays closed throughout (E16); token+gas ceilings ride every order.

## 6 · The member-pay.mjs defect — regression requirements (not patched here)

Per the correction order, `ops/ant-extsig` is another lane's code and is NOT
patched in this audit. The defect record for its owner: (1) `VAULT_ABI` must
carry the v0.9.1 `PoolCommitment` shape and the `MerklePaymentMade` event
fragment (E8); (2) the `/merkle/i` regex + tx-hash fallback must be deleted —
strict decode per §5.3; (3) required regressions: a real decoded devnet
receipt (via the Rust leg or a fixed script) as a checked fixture; negative
fixtures for missing-event, wrong-contract, and ambiguous-log cases, each
asserting refusal; an ABI-encoding cross-check (ethers-encoded calldata
byte-equal to evmlib's `pay_for_merkle_tree_calldata` output on fixed
vectors). Until landed, nothing may cite member-pay.mjs as a payment
reference.

## 7 · Z2.B ORDERS — REPLACEMENT EDITION (offline; the 2026-09-12 first-edition orders in dfeaaddb are SUPERSEDED and carry no authorization)

```
SEND TO: z2.b
SEAT z2.b · LANE watch/autonomi/trezor · PHASE: OFFLINE CONTRACT SLICE ONLY.
READ FIRST: this receipt (both editions + review), SPEC-AUTONOMI-TREZOR-1
(custody law; §4 amendments above), ops/ant-extsig README (shapes only — its
member-pay.mjs is a named defect, §6, do not copy from it).

Scope of THIS order — synthetic inputs, no real device, no Suite MCP call,
no Connect call, no broadcast, no upload, no wallet change, no production
edit, no upstream PR yet:

Order A — THE CONTRACT MODULE (pure code + tests): implement the §5 schema
as a versioned, bounded, canonical-serializing module (Rust in the estate
tree — proposed: crates/watchpay or ops/watch-pay/; z2.a leaves placement to
review): plan canonicalization + plan_hash + batch_id; strict receipt
validator per §5.3 (MerklePaymentMade binding, getCompletedMerklePayment
cross-check shape, wave arm's DataPaymentMade) with NO fallback path; the
§5.4 state machine with durable transitions and unknown-state refusal;
§5.2 signature/tx validation; bounded approve-ceiling derivation (never
U256::MAX; document the E7 collision in the module docs). Calldata composing
MUST bind to the pinned ABI (E8) — encode against
ant_protocol::evm::contract bindings at the app's pin (evmlib 0.9.1 via
ant-protocol 2.3.5), and cross-check byte-equality against evmlib v0.9.1
pay_for_merkle_tree_calldata output vectors (generated offline; record the
generator). Flag for review (do not decide alone): direct evmlib dep vs
ant-protocol re-export ask.

Order B — SYNTHETIC EVIDENCE + NEGATIVE FIXTURES: a checked-in fixture set
covering: valid merkle receipt (synthetic log crafted to E8's event with
plausible values); missing event; wrong contract; ambiguous twin events;
reverted tx; replaced-by-fee; unknown-after-timeout (assert: no auto re-sign,
human gate required); PaymentAlreadyExists revert path; expired plan; wrong
payer; wrong chain; wave-arm plan; tampered plan_hash; allowance short/long.
Every refusal must name the failing field. Unit tests all offline; the
receipt-validator's event decode cross-checked against a known-good ABI
decoder on the same fixtures.

Order C — LOCALDEVNET REHEARSAL (no Trezor, no mainnet): extend/reuse the
ant-extsig harness SHAPE in a NEW harness (do not modify ops/ant-extsig):
prepare with PaymentMode::Merkle on a wallet-less client; export the §5 plan
envelope; pay with the devnet evmlib wallet; run the §5.3 validator against
the REAL devnet receipts (this is the live decode proof the JS script never
gave); fresh-client finalize with validated winners; then NEGATIVE runs:
kill-after-payment (record the retained-risk state honestly per §4 tier c),
double-submit the same batch (expect PaymentAlreadyExists / refusal), resume
via FinalizeResume in-process (tier a). Receipt everything (atto figures,
event bindings, state transitions).

REPORT-BACK ≤150 words: LANDED (sha + tests-passed counts + fixture counts)
· RECEIPT (paths) · FLAGS (placement, evmlib dep question) · NEXT (proposed
Connect-adapter slice for separate review). STANDING LAW: keys never
requested/held/exported; crypto claims cite file+function or UNVERIFIED;
language ≤ "sound by construction"; mocks named as mocks; connect-store
Trezor/Autonomi writes stay disabled; founder's Connect preference unchanged;
no SKAISTS branding in stock W@tch; one feature per future upstream PR.
```

Deferred (each its own reviewed order, NOT authorized here): the Watch-It
fork external-mode PR (§5.5 laws, maintainer invited only the read-only
bridge discussion); the Connect adapter slice; any Suite-MCP live probe; any
device session; any funded ceremony.

## 8 · Record corrections

- **Release pin:** tag `v0.1.0-alpha.98` = `206da1d15f9657c9…` (the WSL clone
  HEAD confirms); `56819f24` is the documentation commit AFTER the tag (my
  first edition cited it as the release — wrong). All α.98 source cites in
  this receipt bind to `206da1d1`; the dependency pin stays rev `dbc01ce8`
  (ant-core) → ant-protocol 2.3.5 → evmlib 0.9.1.
- **Attribution:** dfeaaddb recorded founder as author and committer with no
  seat trailer — not the standing shape (cf. e1a8d3c6: founder author +
  `Co-authored-by: zCode <zcode@skaists.dev>` + `Signed-off-by`). The history
  is not rewritten; THIS descendant restores the trailer shape and this
  section records the earlier mismatch.
- **Hosted checks:** four checks succeed on dfeaaddb; per the review, passing
  hosted checks verify no claim in this document — the evidence table (§2) is
  the claim authority.
- **Remaining uncertainties (honest list):** live Suite-MCP 26.6.1 behavior
  with `data` on this device (E12); whether ant-protocol will re-export
  `external_signer`; press-count behavior of the device for vault calldata
  (blind-signing posture) — untestable without a device session, which this
  phase forbids; the exact MERKLE_PAYMENT_EXPIRATION window value at the pin
  (constant name verified, value to be read at z2.b build time and pinned in
  the module).
- **What this correction did NOT do:** no device session, no Suite MCP or
  Connect call, nothing signed or broadcast, no upload, no wallet change, no
  production edit, no patch to ops/ant-extsig or any other seat's code, no
  force push (descendant only), no z2.b start.
