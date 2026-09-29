# WORKERB2 — Cake `cw_bitcoin`: BIP-352 / Payjoin v2 reuse, backend boundaries · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"Look first for code we can
reuse for BIP-352 sending/scanning and Payjoin v2 without inheriting
Cake-hosted infrastructure. Then compare its Electrum/Mempool backend
boundaries with our replaceable-adapter law. Preserve our current BTC
display-only state until evidence supports changing it."*
**Mode:** source-only dissection; no integration; no implementation.
**Baseline:** origin/main `60befce6` (recorded after fetch). Sources:
`cake-tech/cake_wallet@dev` (cw_bitcoin tree + files below),
`cake-tech/sp_scanner@sp_v4.0.1`, `konstantinullrich/payjoin-flutter`
(pinned `b28c825` via cw_bitcoin's pubspec).

> **⚠ STANDING TRAP (founder ruling, preserved from the cw_zano mission):**
> Cake's Zano derivation `m/44'/128'/0'/0/0` (secp256k1-BIP32 reduced mod l,
> coin type 128) is **NOT a test vector for our `m/44'/1018'` SLIP-0010
> path** — different master construction, different coin type, structurally
> different hardening. No worker may treat any Cake Zano key material as an
> oracle for the estate's SLIP-0010-1018 lane or its held
> seed→view_public test. See `2026-09-16-workerb2-cw-zano-cw-evm-deep-read.md` §2.

---

## 0. Verdict map

| finding | verdict |
|---|---|
| BIP-352 scanning architecture (Rust core behind C-ABI, per-txid incremental scan, labels array) | **ADAPT the shape — via MIT-clean `cygnet3/spdk`, NOT Cake's stack (license-blocked, §1)** |
| BIP-352 send-side living in the `bitcoin_base` fork | **WATCH** (same license caveat; spdk covers send+sign) |
| BIP-352 derivation path constants in Cake (`m/352'/0'/0'/1'/0` scan / `…/0'/0` spend) | cross-confirmation only — matches BIP-352 + our wallet's existing law |
| Payjoin v2: Rust PDK + session persistence + poller workers | **WATCH-ADAPT** (Rust crates are the reuse unit; Cake-hosted relay simply excluded) |
| OHTTP relay pool as swappable constants (community relays exist beside Cake's) | **ADAPT the pool-of-relays pattern** (curated constants, self-host option on the box) |
| Electrum client (own 877-line raw-socket implementation, Tor socks, subscriptions) | **WATCH** — but its `btc-electrum`→plaintext heuristic is the anti-pattern our adapter law forbids |
| Mempool = Cake's SELF-HOSTED `mempool.cakewallet.com` mirror (fees, block-height, timestamps; default-on, toggleable) | **ADAPT the self-host pattern** — mempool.space is self-hostable; a box mirror satisfies nodes-on-the-box |
| Samourai-style segregation derivations in their table (Bad Bank / Pre/Post Mix) | noted, no action |
| BTC display-only law | **UNCHANGED — evidence reinforced, not moved** (§4) |

## 1. BIP-352 in Cake's tree (FACT)

Cake splits SP across three packages, none inside `cw_bitcoin` itself:

- **Scanning — `cake-tech/sp_scanner@sp_v4.0.1`** (pubspec git pin): a
  cargokit Flutter plugin shipping **two prebuilt Android `.so` images per
  ABI** (`libsilentpayments.so`, `libsp_scanner.so`) from a Rust core whose
  manifest is minimal: `silentpayments = { git =
  "…/cake-tech/rust-silentpayments", branch = master }` + `serde_json` +
  `cbindgen = 0.24.3` (C-ABI generation). The Dart-facing API (from the
  checked-in example, `bin/sp_scanner.dart`) is **per-txid and incremental**:
  `callApiScanOutputs([[txid…]], scanPubKey, Receiver(spendPub…, scanPub…,
  isTestnet?, [labels], 1))` → `interpretBytesVec(…)` — the wallet hands the
  scanner candidate txids and receiver keys, the Rust side returns matched
  outputs. **License: the repo's LICENSE file is literally "TODO: Add your
  license here."** and the `rust-silentpayments` fork's license was not read
  this session — stated once as a constraint, per mission scope: **no code
  reuse from this stack is lawful until that is resolved.**
- **Wiring — `cw_bitcoin/lib/electrum_derivations.dart`** pins the constants:
  `SILENT_PAYMENTS_SCAN_PATH = "m/352'/0'/0'/1'/0"`,
  `SILENT_PAYMENTS_SPEND_PATH = "m/352'/0'/0'/0'/0"` (testnet coin'`1'`) —
  byte-identical to the BIP-352 paths our wallet's derive contexts already
  carry (Dana blueprint §2). Cross-confirmation, nothing to adopt.
- **Sending — the `bitcoin_base` override** (pubspec
  `dependency_overrides → cake-tech/bitcoin_base@4e41f96f`): SP output
  creation rides their fork of the BTC crypto library; the send path is
  inside the fork, not `cw_bitcoin`. Fork license not read this session —
  same constraint as above.
- **How candidate txs reach the scanner upstream (electrum scripthash?
  block walk?) — UNKNOWN this session** (the wallet-side scan loop was not
  read); recorded as a hole, not guessed.

**The lawful reuse route for the estate (ADAPT, via our existing orbit):**
`cygnet3/spdk` — MIT, `silentpayments` crate passes the BIP's own test
vectors, `spdk-core` gives `ChainBackend`/`Updater` injection (BlindBit
default, self-hostable "My Scanner" shape), `spdk-wallet` creates and signs
sends — already receipted in the Dana blueprint and the Dana×Cake bPay
review. Cake's stack contributes the **architecture proof** (Rust scan core
behind a C-ABI + per-txid incremental API + label arrays + electrum-fed
candidates) and nothing else, pending licenses.

## 2. Payjoin v2 in Cake's tree (FACT)

- **Core: `konstantinullrich/payjoin-flutter@b28c825`** — a THIRD-PARTY
  Alpha-stage Flutter-Rust-Bridge wrapper around the **Rust Payjoin Dev Kit**
  (payjoindevkit.org); its README carries the Alpha/real-funds caution. The
  estate's reuse unit is therefore the **Rust PDK crates directly** (into our
  Rust core — same posture as watchpay consuming alloy-rlp/k256), with
  Cake's Dart layer as orchestration reference only.
- **Orchestration (`cw_bitcoin/lib/payjoin/`)**: `PayjoinManager` +
  `PayjoinStorage` + receive/send workers in Isolates + a per-wallet
  `payjoin.log`. The v2 requirements are visibly solved:
  - **Durable sessions** — `resumeSessions()` re-spawns from
    `readAllOpenSessions(walletId)` (sender and receiver session records);
  - **OHTTP relay pool as swappable constants** —
    `ohttpRelayUrls = ['https://pj.bobspacebkk.com',
    'https://ohttp.achow101.com', 'https://ohttp.cakewallet.com']` with
    `randomOhttpRelayUrl()` — two COMMUNITY relays beside Cake's own: the
    Cake-hosted one is simply an entry in a list, excludable by deletion;
  - **Public directory** — `payjoinDirectoryUrl = 'https://payjo.in'`
    (public, untrusted-by-design posting point);
  - PSBT plumbing through their own `psbt/` stack (v0 deserialize/finalize,
    signer) — the same wallet-to-wallet object class our laws keep out of
    pages.
- **Verdict: WATCH-ADAPT.** If a BTC send lane is ever ruled, the take is:
  Rust PDK crates + the session-persistence model + a curated/self-hosted
  relay pool. Nothing here changes anything today.

## 3. Backend boundaries vs our replaceable-adapter law (FACT)

- **Electrum (`cw_bitcoin/lib/electrum.dart`, 877 lines, their own
  implementation):** raw socket over a `ProxySocket` abstraction (Tor/i2p
  socks capable), hand-rolled `\n`-framed JSON-RPC with a task map of
  Completers (requests) and BehaviorSubjects (subscriptions), connection
  status enum + alive timer. Nodes are user-selectable — the replaceable
  seam exists and is real. **Anti-pattern, caught in their own code:** the
  TLS decision `ssl = !(useSSL == false || (useSSL == null &&
  uri.toString().contains("btc-electrum")))` — hosts whose name contains
  `btc-electrum` default to PLAINTEXT. Infrastructure identity is baked
  into a generic client — exactly what our adapter-ring law forbids (the
  adapter must not know who it is talking to). Recorded as the
  negative-space confirmation of our law.
- **Mempool (`cw_bitcoin/lib/electrum_wallet.dart`, 4,568 lines):** fee
  recommendation, block-height lookups, and block timestamps all route to
  **`https://mempool.cakewallet.com/api/v1/...`** — Cake's SELF-HOSTED
  mempool.space mirror — behind a default-ON pref
  (`use_mempool_fee_api`). Electrum proper carries balance/history
  (`blockchain.scripthash.get` + subscriptions). **The pattern, not the
  host, is the finding:** a production wallet chose to self-host its read
  infra rather than hit public APIs — convergent with nodes-on-the-box.
  mempool.space is self-hostable open source; a box mirror would satisfy
  our first-party-only + adapter laws exactly the way Cake's mirror
  serves theirs (with our box in place of Cake Labs).
- **Boundary law comparison, stated once:** Cake = replaceable electrum
  nodes (✓ our law) + Cake-default electrum endpoints and a Cake-hosted
  mempool mirror as defaults (✗ for us, fine for them) + infra naming
  inside client code (✗, see above). Our law stands unrefuted; Cake's
  seams are evidence it scales to production.

## 4. The display-only law — explicitly preserved

Nothing in `cw_bitcoin` moves it. The SP stack that exists is license-holed
at the scanner layer, Alpha at the payjoin layer, and wired to
Cake-hosted defaults at the backend layer; the MIT-clean alternative (spdk
+ official BIP vectors + self-hostable backends) is already receipted in
our orbit for the day a founder rules the receive lane. Until then:
wallet.html's `not_carried: silentPaymentScan, buildSend, mintOffer`
posture and the profile card's display-only law are exactly right.
**(This section is the mission's third deliverable, answered: evidence
reinforces the current state.)**

## 5. Source ledger (read this session, 2026-09-16)

- `cake-tech/cake_wallet@dev`: `cw_bitcoin/` tree listing; `pubspec.yaml`
  (full dependency map incl. overrides); `lib/electrum.dart`;
  `lib/electrum_wallet.dart` (greps at cited lines);
  `lib/electrum_derivations.dart`; `lib/payjoin/manager.dart`.
- `cake-tech/sp_scanner@sp_v4.0.1`: repo API pin (license NOASSERTION,
  pushed 2026-09-10), tree (cargokit + android jniLibs `.so` images),
  `LICENSE` ("TODO"), `rust/Cargo.toml`, `bin/sp_scanner.dart`.
- `konstantinullrich/payjoin-flutter` (README; pinned `b28c825` via
  cw_bitcoin pubspec).
- In-tree at `60befce6`: prior dispatches (Dana blueprint §2, bPay review,
  cw_zano/cw_evm deep-read) + `surfaces/wallet-adapter-bitcoin.js` law.

**No integration, no code changed, no wallets/chains/indexers touched.
Research only; every claim carries its file.**
