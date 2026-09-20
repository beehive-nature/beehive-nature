# WORKERB2 — Cake `cw_zano` × our Zano rail, and `cw_evm` around Base · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"Deep-read Cake's `cw_zano`
implementation against our existing Zano rail. Identify reusable code/interfaces
and anything Cake has already solved that we haven't. Then do the same for
`cw_evm` specifically around Base. Produce concrete ADOPT / ADAPT / WRAP / WATCH
findings. Research/test freely; no integration yet. Do not spend time on
licensing, KYC, fiat, cloud backup, or other non-code third parties. Stay on
code and architecture."*
**Mode:** source-only dissection, no integration, no implementation. **Baseline:**
origin/main `85aa86a4` (recorded after fetch). Sources read at
`cake-tech/cake_wallet@dev` (HEAD at session read; repo pushed 2026-09-15),
plus `cake-tech/trezor_connect@trunk` (pinned `d1242cea` via cw_evm's pubspec,
repo state read this session). All quotes verbatim from fetched blobs.

---

## 0. Verdict map (details in §2/§3)

| finding | verdict |
|---|---|
| Zano derivation schism (Cake BIP39-128-BIP32 ≠ our SLIP-0010-1018; ≠ stock brainwallet) | **WATCH — record, do not adopt** |
| PlainWallet in-process embed (monero_c FFI) vs our external walletd view-only | **WATCH** (proof it ships cross-platform incl. Windows; our view-only stance stays) |
| Zano asset-whitelist + descriptor model (global/local/own, ticker, decimalPoint) | **ADAPT** (model, when the watcher grows a display tier) |
| Multi-asset transfer display model: `subtransfers_by_pid`, fee-leg collapse, `*TICKER` marker | **ADAPT** (heuristic + shape) |
| Wallet sync-status UX states (`get_wallet_status` fields) | **ADAPT** (state vocabulary) |
| `proxy_to_daemon` through the wallet engine | **WRAP-shaped later** (one connection, fewer surfaces) |
| Transfer privacy defaults (`hideReceiver: true`, `pushPayer: false`, mixin 10) | **ADAPT** (defaults law if we ever send) |
| Encrypted secrets sidecar (`zano-secrets.json.bin` via native `encrypt_data`) | **WATCH** (mirrors our at-rest-encryption open gap, b signer keys.rs:60) |
| EVM per-chain client subclassing; Base = `chainId 8453` + legacy-gasPrice shaping | **ADAPT** (the pattern; the quirk is a data point) |
| Etherscan-V2 history + spam/dust display filter | **ADAPT the heuristic; WATCH the dependency** |
| Token discovery: Moralis + node-direct fallback | **ADAPT the node-direct path only** (adapter-ring law) |
| Cake's `trezor_connect` platform wrapper + `m/44'/60'/i'/0/0` enumeration | **WATCH** — the production reference for our blocked device lane |
| OFT (LayerZero) minimal ABI + USDT0 config | **WATCH** (note: Cake's USDT0 map = 1/137/42161 — **Base absent**) |
| ABI selector-assert pattern (`dd62ed3e`/`095ea7b3` beside every call) | **ADAPT** (mirrors our hex/parity discipline) |

No ADOPT-as-is items: everything worth taking is a model or a pattern, not
drop-in code (and the estate's copy laws would require the build-alongside
path anyway).

## 1. What Cake's cw_zano IS (FACT, from source)

- **The engine is in-process, not an RPC service.** `cw_zano` binds Zano's own
  `PlainWallet` C++ through monero_c-generated FFI
  (`package:monero/zano.dart`, `generated_bindings_zano.g.dart`): direct calls
  (`PlainWallet_generate/open/closeWallet/init/getAddressInfo/getCurrentTxFee/resetWalletPassword`)
  plus a **generic JSON bridge** — `ZANO_PlainWallet_syncCall(method, hWallet,
  jsonParams)` run inside `Isolate.run`, with manual `ZANO_free` on returned
  strings. Wallet methods (`create_wallet`, `restore`, `restore_from_derivations`,
  `load_wallet`, `store`, `get_wallet_info`, `get_wallet_status`,
  `get_recent_txs_and_info`, `transfer`, `sign_message`, `get_restore_info`,
  `assets_whitelist_get/add/remove`, `proxy_to_daemon`, `reset_connection_url`,
  `run_wallet`) all ride that bridge as JSON method+params. Node config is
  `reset_connection_url` + `run_wallet` — the embedded engine dials the daemon
  itself.
- **Derivation (FACT, `lib/bip39_seed.dart`):** BIP39 mnemonic (+passphrase) →
  secp256k1-style **BIP32** `m/44'/128'/0'/0/0` → `privateKey` **reduced mod the
  Ed25519 order** (`100000…14DEF9DEA2F79CD65812631A5CF5D3ED`). Their own tests
  pin three vectors (`bip39_seed_test.dart`: `abandon…about` →
  `bfafd1eb0e43da200c5c11537d355e458e7c326b3bc1b19f4546573d6bac9d0f` <!-- PUBLIC-CONSTANT: Cake's published upstream test vector, cw_zano/test/bip39_seed_test.dart -->; with
  passphrase `TREZOR` → `674ba1ca…`; a second mnemonic → `8b2693e1…`).
- **Secrets:** mnemonic/passphrase/creation_timestamp stored as an encrypted
  sidecar `zano-secrets.json.bin` (native `encrypt_data`/`decrypt_data`).
- **Transfers:** `TransferParams{destinations, fee, mixin: 10, paymentId,
  comment, pushPayer: false, hideReceiver: true}`; result carries `txHash`.
- **Assets:** whitelist model with `global_whitelist` / `local_whitelist` /
  `own_assets` lists + per-asset descriptors (ticker, fullName, decimalPoint);
  unknown assets resolve via `proxy_to_daemon` → daemon `get_asset_info`.

## 2. cw_zano vs OUR rail (crates/chain-zano + zano-watcher, at baseline)

**Architecture inversion (the headline).** We run an external walletd over
JSON-RPC, **view-only**, polling `getbalance` and the HF6 read path
(`get_recent_txs_and_info3`) into `RawChainAction`s; spend capability exists
nowhere host-side by law (Trezor-native spend model, `chain-zano/src/lib.rs`
module boundary). Cake embeds the full stock engine **with spend** in every
app build. Trade-off, honestly: theirs buys stock-engine parity for free and
works offline from any node topology; it costs shipping a C++ engine + the
monero_c supply chain per platform, and carries spend keys on general-purpose
devices. Our stance stays lawful for us; Cake's embed is **WATCH-grade proof**
that PlainWallet ships cross-platform (incl. the Windows path their
`closeWallet` branches on) — relevant only if a founder ever rules a
device-resident Zano engine lane (it would interact with the standing btrezor
THP blocker).

**The derivation schism (FACT, load-bearing for interop).** Three universes
now documented for Zano key derivation:

| universe | derivation | oracle status |
|---|---|---|
| stock brainwallet (25-word → 32-byte seed → `s = sc_reduce(seed)`, `v = keccak256(s) mod l`) | our `view.rs` port of `keys_from_default`/`dependent_key` | **stock-vector-proven** (`testvec.rs`, simplewallet v2.2.1.501, S/V via CN-base58+Keccak address decode) |
| Cake BIP39 | BIP32(secp256k1) `m/44'/128'/0'/0/0` → mod-reduce | pinned by Cake's own test vectors |
| SLIP-0010 Ed25519 `m/44'/1018'/a'` (all-hardened) | our `slip0010.rs` (Trezor-shaped) | **held test still waits on a stock-tool vector** |

The schism is structural, not parameter-level: Cake's path ends in
non-hardened `0/0`, which **cannot exist** in SLIP-0010 Ed25519 (all levels
hardened by construction), and starts from a different master (BIP32
"Bitcoin seed" HMAC vs SLIP-0010 "ed25519 seed"). Consequences: (1) Cake
mnemonics do not restore into stock Zano software or a Trezor/SLIP-0010
wallet, and none of the three restore into each other; (2) **Cake provides
NO oracle for our held `seed→view_public` test** — their vectors prove their
own universe only; (3) coin-type **128** is the old SLIP-0044 Zano
registration (1018 is the current one) — this dual registration belongs in
`keys.rs`'s "VERIFY before production" note as a recorded trap. (This row is
the direct answer to "anything Cake solved that we haven't": the inverse —
they quantify a trap we had only half-named.)

**What Cake HAS solved that we haven't (ADAPT-grade):**
1. **The multi-asset display model.** Same wire we parse —
   `subtransfers_by_pid[].subtransfers[]` — but they keep the whole transfer
   envelope (`remote_addresses/aliases`, `show_sender`, `is_mining`,
   `is_mixing`, `is_service`, `tx_type`, `unlock_time`, `tx_blob_size`,
   `employed_entries`) and run a **fee-leg collapse**: a two-subtransfer tx
   whose ZANO leg is outgoing and equals the fee displays as the OTHER
   asset's single movement; anything else shows `*TICKER` (complex marker).
   Our `hf6.rs` keeps `{payment_id, asset_id, amount, is_income}` per atom —
   audit-shaped (deposit `credited = in − out`, saturating) — which is
   correct for our job; their collapse heuristic is the missing piece for
   any future human-facing transfer list on the Zano rail.
2. **Sync-status vocabulary.** `get_wallet_status` → `isDaemonConnected`,
   `isInLongRefresh`, `progress`, `walletState`, wallet/daemon heights — a
   ready-made state machine for scanner UX; our watcher is binary
   (last-poll-ok / error).
3. **Asset whitelist/descriptor tier** (global/local/own + ticker +
   decimalPoint + daemon `get_asset_info` fallback) — our watcher knows raw
   `asset_id`s, nothing about what they name.
4. **Birthday estimation** (`get_height_by_date.dart`, 16 KB table) for
   restore-height selection.
5. **Open-retry lifecycle**: "already connected" wallet error → close+reopen,
   ≤5 attempts, 500 ms apart — a real-world lock-recovery shape for walletd
   handles (our watcher reconnect story is single-shot).
6. **Transfer privacy defaults as constants** (`hideReceiver: true`,
   `pushPayer: false`, mixin 10) — if the estate ever sends Zano, these are
   a shipping wallet's chosen defaults, citable.

Not adopted (stated, no relitigating): their derivation, their spend-capable
embed, `get_recent_txs_and_info` (non-3, offset/count paging) — our HF6 lane
already pinned the `…3` variant with named refusals; pagination shape noted
for a future large-history need (`last_item_index`/`total_transfers` cursor
model).

## 3. cw_evm around Base (FACT, from source)

- **Structure:** one `EVMChainClient` core + per-chain subclasses
  (`ethereum`, **`base`**, `polygon`, `arbitrum`, `bsc`). **BaseClient is 45
  lines**: `chainId 8453` and ONE behavioral delta —
  `createTransaction` maps EIP-1559 inputs to a **legacy gasPrice** (when
  `gasPrice == null && maxFeePerGas != null` → `gasPrice = maxFeePerGas`;
  the 1559 fields are passed commented-out). Data point, not law: a
  production wallet ships Base txs legacy-shaped; our `watchpay` composes
  BOTH envelope families under strict 1559 discipline with evmlib byte-parity
  (main @28116f4a) — both shapes are network-legal on Base; Cake's choice is
  one quirk worth knowing when diagnosing third-party Base txs.
- **EVM library:** `web3dart ^2.7.1` + handwritten `ERC20` generated-contract
  wrapper whose every method asserts its 4-byte selector before calling
  (`dd62ed3e` allowance, `095ea7b3` approve) — the same
  pin-every-selector discipline our `watchpay/src/abi.rs` practices; nice
  convergence to cite. `eth_sig_util` (EIP-712) present for typed-data.
- **History:** Etherscan **V2 multichain** API
  (`api.etherscan.io/v2/api?chainid=…`, `txlist`/`tokentx`), plus a
  **display-layer spam filter**: drop zero-value entries and incoming native
  dust < 0.00001 ETH (`spamThresholdWei = 10000000000000`) — a
  dust-poisoning defense at the rendering boundary. ADAPT the filter for any
  future estate tx-history surface (our person-scan lane's transfer-history
  discovery faces the same adversary); the Etherscan key dependency itself
  is WATCH (our rails are keyless-RPC / Blockscout-shaped by law and
  practice).
- **Token discovery:** dual path — Moralis API (`fetchWalletTokensFromMoralis`,
  `getErc20TokenFromMoralis`) with a **node-direct fallback**
  (`getErcTokenInfoFromNode`: name/symbol/decimals read from the node) and
  curated per-chain lists (`tokens/base_tokens.dart`). The node-direct path
  is exactly our adapter-ring-lawful shape; adopt THAT path's precedence if
  token metadata ever enters a surface.
- **Hardware signing (the estate-relevant seam):**
  `hardware/evm_chain_{trezor,ledger,bitbox}_service.dart` over
  `cake-tech/trezor_connect` (MIT, `trunk`, pinned `d1242cea`, stub README —
  "ToDo(Konsti): Add more docs"; last push 2025-10-29). Address enumeration
  batches `TrezorGetAddressParams` at `m/44'/60'/i'/0/0` via
  `ethereumGetAddressBundle`, unharden by `path[2] - 0x80000000`. This is
  the shipping production reference for exactly the bridge our `watchpay`
  `connect.rs` models as a trait with no implementation (pinned there
  against `@trezor/connect-web 9.7.3`): Cake's transport is a platform
  channel; ours is injectable-and-absent by law until the founder opens the
  device-preflight slice (z2.c's proposed-later slice —
  `ethereumGetAddress` confirmation first, founder's hand only). WATCH both
  together when that lane opens.
- **Cross-chain tokens:** `contract/oft.dart` — a minimal hand-written
  LayerZero OFT ABI (`quoteSend(SendParam, payInLzToken) →
  MessagingFee{nativeFee, lzTokenFee}`, `send(...)` payable; slippage via
  `minAmountLD`) — and `usdt0/usdt0_config.dart` pinning USDT0 deployments
  **for chains 1/137/42161 only: Base (8453) is absent from their USDT0
  map.** So Cake's Base support is native-rail only — they have NOT solved
  USDT0-on-Base; if the estate ever moves stablecoins cross-chain from Base
  it would be treading where Cake hasn't. WATCH; no current estate need
  (USDC-on-Base rail is live and single-chain by design; bnri-xbtc verdict
  already ruled v3-exSAT/v4-Base shapes).

## 4. Concrete next-step candidates this dispatch feeds (no authorization implied)

1. The fee-leg collapse + spam/dust filter are the two smallest ADAPTs with a
   home the day the Zano rail or person-scan gains any human-facing list.
2. The 128-vs-1018 dual-registration note belongs in `chain-zano/keys.rs`'s
   verify comment whenever that file is next touched — one line, rider-grade.
3. When the device-preflight lane opens (z2.c's later slice), read
   `cake-tech/trezor_connect@trunk` beside `@trezor/connect 9.7.3` before
   choosing the transport shape — two production references, same problem.

## Source ledger (read this session, 2026-09-16)

- `cake-tech/cake_wallet@dev` (repo read state 2026-09-15T22:05Z): `cw_zano/`
  (tree listing; `lib/bip39_seed.dart`, `test/bip39_seed_test.dart`,
  `lib/zano_wallet_api.dart` full, `lib/api/model/{transfer,subtransfer}.dart`,
  `pubspec.yaml`), `cw_evm/` (tree listing; `pubspec.yaml`,
  `lib/clients/{evm_chain_client,base_client}.dart`,
  `lib/contract/{erc20,oft}.dart`, `lib/hardware/evm_chain_trezor_service.dart`,
  `lib/usdt0/usdt0_config.dart`).
- `cake-tech/trezor_connect` (API pin + README).
- In-tree at `85aa86a4`: `crates/chain-zano/src/{lib,keys,view,testvec}.rs`,
  `crates/zano-watcher/src/{lib,hf6}.rs`.

**No integration, no code changes, no wallets or chains touched. Research
only; every claim above carries its file.**
