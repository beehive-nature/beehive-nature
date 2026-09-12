# Z2.A — W@tch / Autonomi / Trezor: the audit receipt + z2.b orders

Seat z2.a, 2026-09-12. Order: audit hardware-held signing for W@tch without any
seed/private-key import; deliver a source-pinned receipt and paste-ready z2.b
orders. **This audit signed nothing, broadcast nothing, uploaded nothing, and
changed no production surface** — read-only passes over the tree, the fork, the
pinned ant-core, and official Trezor docs. Worktree `../wt-z2a-trezor-audit`
(branch `z2a/trezor-audit-2026-09-12`); other sessions' worktrees untouched; a
disposable shallow clone of upstream sits at WSL `/home/travi/z2a-watch-src`.

## 1 · "Luna" — the verdict first, because the order asked

**No seat, contributor, branch, commit, dispatch, or test named "Luna" exists
anywhere in this estate's records.** Searched: all branches + all-history git
log (case-insensitive), `docs/dispatches/`, `docs/specs/`, `dockets/`, `ops/`,
memory index, the W@tch fork (`aautonomicc/Watch-It` + `loviswaternakamoto`'s
branches/PRs), all six WSL `wt-watch-*` worktrees, and the Downloads handoff
folders. The only Luna in the tree is the museum entity (Virtuals Luna,
`docs/museum/PROPOSAL-VIRTUALS-LUNA-2026-08-28.md`) and base.eth name lore
(`luni`). If an external "Luna" claimed W@tch/Trezor work: **nothing by that
name exists — no claim of theirs is banked here.** The real existing work is
someone else's and is inventoried below, honestly.

## 2 · What actually exists (source-pinned)

**Estate side (this monorepo):**

- `docs/specs/SPEC-AUTONOMI-TREZOR-1.md` — Seat 3, 2026-08-21, DRAFT, gates
  AT-1…AT-5 open. The custody law (no seat holds/requests/transmits key
  material), the key map (EVM key = Trezor only · DataMap = separate custody ·
  public address = free), the no-vaults law, the confirmation-count law.
  Reconciled in §4 below; several load-bearing facts are now stale.
- `ops/ant-extsig/` (@147854c2, 2026-09-04) — **the proven external-signer
  harness**: 8-node LocalDevnet + embedded Anvil; client prepares with NO
  wallet (`file_prepare_upload_with_mode`, Merkle mode requested); a standalone
  member wallet pays; client destroyed mid-flight; a FRESH client finalizes
  with no new quote. Both arms carried (the 4-chunk genesis priced WAVE by the
  network's own Auto law). `member-pay.mjs` is the mainnet shape in ethers:
  ERC-20 `approve(vault, exactTotal)` + vault
  `payForMerkleTree(uint8,(address,uint96)[],uint64) returns (bytes32)`,
  winner hash parsed from the receipt's MerklePayment event. Devnet-proven
  only; the mainnet leg never run.
- `surfaces/bantfarm.html` — the SPEC §2 signing wing, **already wired**:
  Trezor Connect loads on gesture only (dependency disclosed on its face),
  `ethereumGetAddress` with on-device verification, Arbitrum Sepolia (421614)
  + mainnet RPC failover, the AT-1 zero-value self-transfer bench
  (compose → device signs → page broadcasts keylessly), and a prepare-output
  decoder that prints per-tx kind/amount before the device is touched.
  **AT-1 completion is UNVERIFIED** — no dispatch claims a real-device run.
- `crates/btrezor` (zano lane @0b50c814/@ee132b07) — real Trezor wire-proto
  experience in-tree (frozen v0.3 proto, A64 discipline); different chain,
  proves seat capability only.
- Connect-store admission gate @d5866964 — **Trezor/Autonomi writes disabled
  by name**, awaiting exactly this lane; the in-tree consumer.

**W@tch side (fork `loviswaternakamoto/Watch-It`, upstream `aautonomicc/Watch-It`):**

- Upstream v0.1.0-alpha.98 (56819f24, released 2026-09-12T16:39Z) contains
  **zero Trezor code** (code search: 0 hits) and its only payment path is the
  hot wallet: `wallet_screen.dart` (generate BIP-39 or import key/phrase),
  `native/watchit_core/src/wallet.rs` (key in OS keychain, file fallback),
  `engine.rs:324-338` (`EvmWallet::new_from_private_key(EvmNetwork::ArbitrumOne, …)`
  → `client.with_wallet(w)`), `upload.rs` (`file_upload_public_with_progress(…,
  PaymentMode::Auto, …)` — quoting, paying, storing all inside ant-core).
  Quote surface: `POST /upload/estimate` (server.rs:576, live per-chunk quotes).
- Fork branch `codex/media-intake-visibility-2026-09-11` = **PR #8, CLOSED
  unmerged 2026-09-11T15:30Z by the maintainer** — for bundling + intake
  policy + YouTube copyright, **not** a Trezor rejection. Its Trezor content:
  `app/lib/services/trezor_suite.dart` (read-only Suite MCP client:
  `http://127.0.0.1:21340/mcp`, bearer token, `initialize` +
  `trezor_get_address` at m/44'/60'/0'/0/0, token session-only, signing
  deliberately not wrapped), a read-only-labelled wallet card, and
  `docs/TREZOR-INTEGRATION.md` (the 7-step handoff plan). Tests: **2 mock
  tests against a fake MCP HTTP client — no real-device session ever ran**
  (the PR body admits fake-MCP coverage; Flutter tests never executed in that
  checkout). Lives in WSL `wt-watch-voice-ui`; last commit 9448033 2026-09-11.
  **No BNR dispatch covers this desktop pass.** Ownership: the codex seat's
  W@tch line, currently idle.
- PR #10 (public XOR-address import) CLOSED 2026-09-12T02:43Z — reverses a
  deliberate upstream design decision; do not resurrect as-is.
- Founder desktop: Trezor Suite 26.6.1 installed and run
  (`Downloads/trezor-suite-log.txt` — real env, arb among enabled networks);
  Watch-It alpha.98 Windows build downloaded. Evidence of a device on this
  desk, not of any signed W@tch transaction.

## 3 · The actual missing boundary — three facts, each pinned

1. **Trezor Suite's MCP server cannot carry Autonomi payments.** Official
   tools reference (docs.trezor.io, suite-desktop skills/trezor-mcp): 8 tools;
   `trezor_send_transaction` takes `to`/`value` (+ whitelist-encoded stablecoin
   ERC-20 transfers) and **has no calldata/`data` parameter** — by design
   ("agents … never show users contract addresses, hex, or calldata").
   Autonomi needs `approve(vault, exact)` and `payForMerkleTree(…)` — arbitrary
   calldata. **`TREZOR-INTEGRATION.md` step 4 ("ask Trezor Suite to send the
   approval/payment transaction through its MCP tool") is unimplementable
   against the documented surface.** Read-only address discovery (step done in
   PR #8) remains its only lawful use.
2. **evmlib 0.9.1 (the only payment API the pinned ant-core exposes) signs and
   broadcasts internally.** docs.rs `ant_protocol::evm::Wallet`: every payment
   method (`pay_for_merkle_tree`, `pay_for_quotes`, `approve_to_spend_tokens`)
   requires the private key and returns tx hashes — **no unsigned-transaction
   or calldata method exists** (escape hatch: `to_provider()` + the public
   `ant_protocol::evm::contract` vault bindings). So W@tch's existing wallet
   calls cannot be "routed" to a device; a separate compose-and-delegate path
   is mandatory.
3. **W@tch alpha.98 has no external-signer upload mode.** `upload.rs`
   hardwires `PaymentMode::Auto` + attached hot wallet; a wallet-less client
   refuses to start an upload (`start_upload`, upload.rs:96-98).

What is NOT missing (proven lawful already): the prepare/pay/finalize split
itself (ant-core rev `dbc01ce` — `file_prepare_upload_with_mode` →
`ExternalPaymentInfo::Merkle{prepared_batches}` → per-batch
`pay_for_merkle_tree` → `finalize_upload_merkle_multi`; the vendor's own
`external-merkle-large` example + ADR-0003); calldata from public inputs only
(`ops/ant-extsig/member-pay.mjs`); winner hash from the receipt event
(same file); arbitrary-data EVM signing on the web (bantfarm's Connect wing).

## 4 · SPEC-AUTONOMI-TREZOR-1 reconciliation — keep / amend / strike

- **KEEP as law:** custody key-map + no-vaults; exact-amount approvals (never
  unlimited); confirmation-count print before the device is touched
  (shape + expected presses); addresses re-derived from the installed binary,
  never trusted from a document; Connect as the web bridge (founder ruling,
  2026-08-21 amendment) with the disclosed on-gesture load.
- **AMEND — the stranded-payment rule (§4) is STALE:** ant-client issue #140
  is fixed at the pinned rev — `finalize_upload_merkle_multi_resumable` /
  `FinalizeResume` store the remainder "against the same on-chain payment
  without re-quoting or re-signing (issue #140)" (file.rs:1326-1335, rev
  dbc01ce). The "every finalize is non-retryable" rule can retire once the
  resumable path is exercised on our side; until then keep receipting
  tx-hashes-before-finalize.
- **AMEND — wave is now avoidable:** `PaymentMode::Merkle` forces the merkle
  shape (min 2 chunks — merkle.rs:168-176). BUT prepare may still return a
  WaveBatch after the already-stored preflight when the remainder falls below
  the merkle threshold (file.rs:1302-1309) — the harness must read the
  returned `payment_info` arm and REFUSE or explicitly count per-quote
  confirmations before any device prompt. The SPEC's ~2-presses/GiB table
  stays the planning number.
- **STRIKE (superseded by upstream reality):** the antd REST `/v1/upload/prepare`
  flow (§1) — W@tch embeds ant-core in-process, no daemon; the daemon shape
  remains the box-lane's pattern only. `payForMerkleTree2` naming — the vault
  ABI at the pinned rev is `payForMerkleTree(uint8,(address,uint96)[],uint64)`
  (member-pay.mjs VAULT_ABI). AT-1's "Arbitrum Sepolia" bench — the payment
  vault does not live on Sepolia; the zero-money bench is the LocalDevnet/Anvil
  shape (ant-extsig) and the first real-device ceremony is mainnet with a
  forced-merkle **2-chunk** upload (the floor), not a Sepolia session.
- **NEW FACT to absorb:** Suite MCP (experimental, localhost:21340, token)
  exists and is lawful for READ-ONLY discovery; it cannot pay (§3.1). One
  Trezor serves one app at a time — close Suite before a Connect session
  (already printed on bantfarm).

## 5 · The smallest implementable slice (z2.b's shape)

Architecture law honored verbatim: **the device apps stay independent; SKAISTS
web companions integrate through explicit adapters.** No seed import anywhere;
payment-key custody (Trezor) stays separate from DataMap custody (the device
that uploaded); admission + human-readable summary precede any device prompt.

Two files-of-record change, one new one — everything else already exists:

1. **Fork, `native/watchit_core` + app (small, upstreamable, ONE PR — the
   PR #8 bundling lesson):** an opt-in `external-signer` upload mode:
   `POST /upload/external` starts a job that (a) refuses if a hot wallet is
   configured (no dual-custody ambiguity), (b) prepares with
   `PaymentMode::Merkle` on the wallet-less client, (c) exports a
   **payment-plan JSON** via the existing localhost job surface — batches
   (depth, commitment count, per-batch atto total, timestamp), token + vault
   addresses read from the pinned `EvmNetwork::ArbitrumOne` at build time,
   chain id 42161, DataMap address, expected device-press count — and (d)
   WAITS (in-process; no cross-process serialization of `PreparedUpload`
   needed) for pasted winner hashes, then
   `finalize_upload_merkle_multi(prepared, winners)`. WaveBatch arm ⇒ export
   refuses with the per-quote count printed, per §4.
2. **Estate, extend `surfaces/bantfarm.html` (no new surface ⇒ no registration
   ritual): a "W@tch pay-desk" panel** beside the AT-1 bench — paste the
   payment-plan JSON; the panel re-derives and prints the summary (token,
   vault, chain, per-batch amounts, total, press count) AND the calldata
   selectors; compose `approve(vault, exactTotal)` + per-batch
   `payForMerkleTree` with `TrezorConnect.ethereumSignTransaction` (arbitrary
   data — the wing already proves this seam); broadcast keylessly via the
   existing public-RPC failover; parse MerklePayment events from receipts →
   winner-hash JSON for paste-back into W@tch. Cross-check the plan's
   token/vault/chain against page-side constants; refuse on mismatch
   (wrong-chain/account guard). Declined-on-device ⇒ nothing broadcast, plan
   reusable (cancellation). Nonce drawn per tx from the mempool so a re-press
   after a failure cannot double-pay a batch already mined (receipt-checked
   before each sign).
3. **Bench receipt:** LocalDevnet end-to-end (ant-extsig pattern) with the
   pay-desk pointed at Anvil's RPC — proves compose/sign-parse/finalize for
   zero money; the founder's first mainnet ceremony is a forced-merkle
   2-chunk public upload (SPEC AT-2's rehearsal-first law).

**Upstream asks to file (non-blocking; do not wait on them):** (i) evmlib —
expose unsigned calldata + winner-from-receipt helpers so external signers
don't duplicate ABI encoding; (ii) ant-core — serializable `PreparedUpload`
for cross-restart resume; (iii) Trezor Suite MCP — a calldata parameter is
the maker's call to make; their docs deliberately withhold it from agents, so
Connect stays the road and no claim may rest on Suite MCP paying.

## 6 · Regression tests z2.b must land

- **Fork (Rust + Dart):** external mode refuses with a configured hot wallet;
  WaveBatch export refusal (prepare a <threshold file, assert refusal text);
  payment-plan JSON schema (golden, incl. chainId 42161 + press count);
  finalize-from-pasted-winners happy path on LocalDevnet (both arms: paid →
  interrupt → fresh-client finalize, the ant-extsig move); kill-mid-finalize
  resume (the #140 fix actually exercised); Dart summary widget prints
  press-count = batches + (allowance shortfall ? 1 : 0).
- **Estate (pay-desk):** calldata vectors — page-composed approve +
  payForMerkleTree encodings byte-equal to `member-pay.mjs` ethers encodings
  on fixed vectors (cross-implementation check); wrong-chain/changed-quote
  (amount or timestamp drift ⇒ refuse); double-payment guard (batch already
  has a receipt ⇒ refuse re-sign); cancellation path (declined ⇒ no RPC
  broadcast call, plan intact); no-page-errors + 390px shots (design law);
  i18n keys if any visible string lands (language lane floors).
- **Honesty gates:** the surface must label Suite-MCP read-only as its own
  thing; nothing may render "Trezor integrated" until the founder's real
  mainnet ceremony is receipted. Mock/fake-MCP tests stay allowed ONLY for
  unit seams, named as mocks in test names.

## 7 · Z2.B ORDERS (paste-ready)

```
SEND TO: z2.b
SEAT z2.b · LANE watch/autonomi/trezor · READ FIRST:
docs/dispatches/2026-09-12-z2a-watch-autonomi-trezor-audit.md (this file) +
docs/specs/SPEC-AUTONOMI-TREZOR-1.md (custody law; §4 amendments above) +
ops/ant-extsig/ (the proven harness — reuse its shapes, do not redesign).

Order A — FORK: external-signer upload mode. From WSL /home/travi/z2a-watch-src
(disposable z2.a clone — make your own worktree; NEVER touch other seats'
wt-watch-* trees). Branch off upstream main (>= 56819f24, alpha.98). ONE PR,
one feature (the PR #8 bundling lesson): POST /upload/external → prepare
PaymentMode::Merkle on wallet-less client (REFUSE if hot wallet configured) →
payment-plan JSON export (schema §5.1; addresses from pinned
EvmNetwork::ArbitrumOne, chainId 42161, press count) → wait for pasted winner
hashes → finalize_upload_merkle_multi; WaveBatch ⇒ refuse with per-quote
count. Tests §6-fork. Draft PR to aautonomicc/Watch-It; do not bundle intake
or anything else. No signing, no broadcast, no paid upload from your seat.

Order B, no stop between — ESTATE: the pay-desk panel on surfaces/bantfarm.html
(extend; no new surface). Paste plan → summary + press count printed BEFORE
any device call → approve(exact) + payForMerkleTree composed in-page (vectors
byte-equal to member-pay.mjs) → TrezorConnect.ethereumSignTransaction (Connect
already wired there) → keyless broadcast via existing failover → MerklePayment
parse → winner-hash JSON out. Guards: wrong chain/account/changed-quote/
double-payment/cancellation per §6-estate. LocalDevnet bench receipted
end-to-end (Anvil RPC), zero mainnet act. Tests + 390px shots + no-page-errors.

REPORT-BACK ≤150 words: LANDED (sha + CI) · RECEIPT (link/shot) · NUMBERS
(batches, presses, atto on devnet) · FLAGS only if blocking · NEXT.
Standing law: keys never requested/held/exported; crypto claims cite
file+function or UNVERIFIED; language ≤ "sound by construction"; mock-tested
seams named as mocks; connect-store Trezor/Autonomi writes STAY disabled.
```

## 8 · What this audit did NOT do

No device session, no Connect call, no Suite MCP call, no transaction composed
or signed, nothing broadcast, no upload (paid or free), no fork push, no
production change, no other seat's worktree entered except read-only `git log`
/ `grep`. The shallow clone and this worktree are the only filesystem writes.
