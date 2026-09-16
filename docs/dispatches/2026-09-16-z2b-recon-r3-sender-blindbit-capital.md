# Z2.B recon round 3 — spdk sender at code level, Blindbit adapter, and the native-Rust-capital inventory

Seat z2.b (GLM/zCode), 2026-09-16. Founder order (rolls-forward):
"Continue the queued probes: verify spdk sender completeness at code
level (change, fees, transaction construction/signing/PSBT), then
inspect Blindbit as the optional BIP-352 scanning backend. Finish the
remaining cw_core bodies only where they sharpen the bPay Rust rail
interface. **Priority: determine what we can reuse rather than
porting/rebuilding it.** Do not start the WASM port yet. First establish
exactly what native Rust capital we already have and isolate the
smallest web-specific gap."

Method: web source reads (raw files) + LOCAL tree inventory of the
estate's own crates. Nothing executed, integrated, or ported.

## Probe A — spdk sender completeness: VERIFIED, with one custody-law gap

`spdk-wallet/src/client/` = `bip321_parsing.rs, client.rs, mod.rs,
spend.rs, structs.rs`. At `spend.rs`:

- **Change: explicit.** After selection, `coin_selector.drain(target,
  change_policy)`; positive drains append a change recipient using the
  wallet's own silent-payment code
  (`RecipientAddress::SpCode(self.sp_receiver.change_code())`); the
  drain-to-recipient path forces `ChangePolicy::min_value(…, 0)`.
- **Fees: dynamic, caller-supplied `FeeRate`**, embedded in coin
  selection via `TargetFee::from_feerate` inside `bdk_coin_select`'s
  `Target` — not a fixed amount.
- **Construction:** `bitcoin` crate `Transaction` directly (version 2,
  locktime 0); silent-payment outputs get a NUMS placeholder spk for
  size estimation, then real keys via
  `silentpayments::sending::generate_recipient_pubkeys`.
- **Signing:** taproot key-path Schnorr only; per-input key = spend key
  + the silent-payment tweak (`b_spend.add_tweak(&owned_output.tweak)`);
  sighashes via `taproot_key_spend_signature_hash`; signatures via
  `sign_schnorr_with_aux_rand`. Shared secret from
  `partial_secret_for_selected_utxos`.
- **Coin selection:** `bdk_coin_select` (not hand-rolled):
  `Candidate::new_tr_keyspend`, `TR_DUST_RELAY_MIN_VALUE` dust policy,
  `select_until_target_met` / `drain` / `select_all`.
- **PSBT: NONE — and that is the gap that matters to US.** The unsigned
  state is a custom `SilentPaymentUnsignedTransaction`; build and sign
  are coupled in-process with a hot software key. Our custody law
  (Trezor-native, btrezor/bsigner organs) needs the watchpay shape —
  compose-unsigned → validate → external sign. REUSE VERDICT: reuse the
  *machinery* (bdk_coin_select, silentpayments sending, fee/change
  logic as reference), but the compose/sign boundary must be ours; do
  not adopt `spend.rs`'s signing flow as-is.

## Probe B — Blindbit as the optional scanning backend

`backend-blindbit-v1/src/` = `api_structs.rs, backend.rs, client.rs,
lib.rs, structs.rs, utils.rs`. `backend.rs` implements spdk-core's
**`ChainBackend`** trait with three methods:
- `get_block_data_for_range` — per block: `tweaks(…)` (with cutthrough)
  or `tweak_index(…)`, plus `filter_new_utxos` and `filter_spent`,
  packaged as `BlindbitV1BlockData`; requests pipelined
  (`.buffered(200)`).
- `detect_spent_outpoints` — `spent_index(block_height)` + block-hash
  verification, intersected with the wallet's outpoints.
- `utxos` — per-height UTXO fetch.

Verdict: a clean PULL-style, per-block adapter over a server protocol
(light-client class per setavenger's spec), feature-optional in
spdk-wallet — precisely the optional-adapter shape the founder ruling
requires. HTTP endpoint details live in `client.rs` (unread — flagged;
no URLs appear in backend.rs). Scanning stays a box/node-side concern
under our nodes-on-the-box law; nothing here needs to run in a browser.

## Probe C — cw_core bodies only where they sharpen the interface

`pending_transaction.dart`: abstract `id`, `amount` (Money), `fee`,
`commit()`, `commitUR()`; defaults for `additionalCost`/`feeRate`/
`change`; **no reject/abort at all** — and a duplicated declaration wart
in their own file. Checklist delta: bPay's `PendingTransaction` needs
an explicit **abort/discard** (our watchpay ledger's cancel + unknown-
never-free semantics already model it), and amount/fee as canonical-
decimal units, not per-currency `Money`. `node.dart`/`sync_status.dart`
bodies deliberately skipped — nothing interface-sharpening at the
signature level we didn't already capture.

## The priority probe — native Rust capital inventory + the smallest web gap

**Already in the estate (verified in-tree today):**
- **`bnr-keys` — the web precedent we didn't remember we had.** "Rust→
  WASM … owns the keys, the digest, the signature, and the transaction
  envelope": `crate-type = ["lib","cdylib"]`, ALL deps
  `default-features = false` with **pure-Rust k256** (deliberately not
  C-backed secp256k1), raw **extern-C wasm exports with NO wasm-bindgen
  ("the estate keeps the glue minimal")**, release profile
  `opt-level = "z"` + LTO. The first-party-only law already has a
  wasm-boundary implementation law in-tree.
- `btrezor` (Trezor HID + chain-id-verifying registry) and `bsigner`
  (the deciding organ) — the custody organs the rail trait must compose
  with, not replace.
- `bswap` — BTC script-side adaptor signatures: existing BTC UTXO
  fluency in-estate.
- `escrow-core`/`escrow-engine` (pure state machines replaying
  canonical events), `event-bus` + `shared-types` (the push-status and
  lingua-franca the rail checklist calls for), `chain-exsat-evm`
  (hand-rolled EVM log decode), `chain-zano` (Zano derivation),
  `denomination` (units), `watchpay` (bounded payment contracts with
  named refusals).
- **No BIP-352 code in-estate** — `silentpay-reference/` is an empty
  placeholder (consistent with the archaeology lane).

**External, reusable as-is (MIT):** the `silentpayments` crate
(feature-gated `sending`/`receiving`/`encode`, pure-arithmetic, no
threading/async deps — the wasm-shaped part of spdk), `bdk_coin_select`,
`bip321`; spdk-wallet's client/scanner as native-only reference.

**REUSE-vs-PORT verdict (the deliverable):**
- REUSE natively: `silentpayments` (both sides), `bdk_coin_select`,
  `bip321`; Blindbit backend as an OPTIONAL adapter (its trait shape,
  or our own backend implementing spdk-core's `ChainBackend`).
- RE-ARCHITECT, don't adopt: the sender flow (split compose/sign at the
  custody boundary — the watchpay pattern).
- PORT: nothing whole.
- **The smallest web-specific gap is now precise:** one
  `bnr-keys`-shaped wasm core exposing BIP-352 arithmetic + URI/amount
  envelope (optionally bip321 parse) — the open sub-decision is
  secp256k1-compiled-to-wasm (C toolchain, known-good) vs pure-Rust
  k256-based BIP-352 arithmetic (estate precedent, audit cost). No
  scanning, no backends, no wallet state on the web side. That is a
  bounded slice — NOT the "cross-platform wallet" mega-problem.

## Status of the scoreboard

Web is no longer vague: it is ONE bounded adapter (arithmetic core to
wasm, bnr-keys law) + the custody split. Native rails: reuse the three
MIT crates + our organs. Next roll-forward (queued, not started): the
secp-vs-k256 wasm sub-decision memo; blindbit client.rs endpoints;
optional: a throwaway cargo wasm target smoke of the silentpayments
crate alone (research/test only — still not "the port").

## Sources

- https://raw.githubusercontent.com/cygnet3/spdk/master/spdk-wallet/src/client/spend.rs
  (+ src/client listing), backend-blindbit-v1/src listing +
  backend.rs, silentpayments/Cargo.toml — @ master, 2026-09-16
- https://raw.githubusercontent.com/cake-tech/cake_wallet/dev/cw_core/lib/pending_transaction.dart
- Local tree: crates/bnr-keys (Cargo.toml + src/wasm.rs extern-C note),
  crate descriptions for btrezor/bsigner/bswap/escrow-*/event-bus/
  shared-types/chain-*/denomination; crates/silentpay-reference (empty).
- Rounds 1–2: 954708ed, this file's predecessors.
