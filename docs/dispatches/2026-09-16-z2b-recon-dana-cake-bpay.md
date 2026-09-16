# Z2.B recon — Dana + Cake Wallet joint review for bPay (receipt)

Seat z2.b (GLM/zCode), 2026-09-16. Order (founder, rolls-forward board):
"Workerb 2: begin the joint Dana + Cake Wallet review now. Focus on what
bPay can reuse to maintain one Rust-centered wallet/payment core across
Android, desktop and web while supporting replaceable rails. Compare
Dana's BIP-352/BIP-353 implementation with Cake's modular cw_*
architecture, especially Zano/Monero/Zcash/Bitcoin. Verify the two
currently UNVERIFIED Cake claims at source. Research and test freely; do
not integrate yet."

Method: web-only source inspection (repo trees, Cargo.toml, CI, release
assets, official docs/blog/forum), 2026-09-16. No code executed, no
device, no network beyond public pages, nothing integrated. Every claim
below is source-pinned or marked UNVERIFIED.

## Verdicts at a glance

| question | verdict |
|---|---|
| Rust-centered core across platforms? | Dana proves it on NATIVE (Android et al.); **web unproven in BOTH** |
| Replaceable-rail architecture? | Cake proves it — but the rail seam is **Dart**, not Rust |
| Cake claim: Bitcoin Silent Payments | **VERIFIED** (send+receive, v4.18.0 May 2024, official docs) |
| Cake claim: Payjoin v2 | **VERIFIED** (async/serverless, May 2025, official blog+docs) |
| Cake claim: Zano/Zcash/Decred lag on Linux desktop | **VERIFIED two ways** (official forum thread + release assets) |

## Dana — one Rust core, one rail, protocol factored out

- `rust/` is a SINGLE crate (cdylib+staticlib), not a workspace. API
  surface is `src/api.rs`; modules: `api/ state/ wallet.rs stream.rs
  logger.rs lib.rs` — a deliberately thin core.
- `flutter_rust_bridge = "=2.13.0"` EXACT-pinned; bindings generated from
  the Rust side (`just gen`). One authority: the API is defined in Rust,
  Dart consumes.
- **BIP-352 lives OUTSIDE the app**: `spdk-wallet` git dep
  (`https://github.com/cygnet3/spdk`, tag v0.7.0) — their silent-
  payments SDK is a separate reusable crate. This is the single most
  bPay-relevant Dana fact: protocol logic as an independently consumable
  crate, app core stays thin.
- Other deps: `bip39 2.0`, `tokio 1` (rt-multi-thread), `pushtx 0.4`
  (broadcast), `serde*`, `rand 0.9`, `base64`. NO storage crate (wallet
  state rides the Flutter side), NO `bitcoin`/`secp256k1` direct deps
  (transitive via spdk), **NO wasm crates**.
- BIP-353: donate address `₿donate@danawallet.app` in the README — 353
  resolution exists at least at the identity level (depth unexamined).
- **Web target: scaffold only.** `web/` = index.html + manifest +
  icons; CI (`.github/workflows/flutter.yml`) is a FORMAT CHECK ONLY
  (`dart format --set-exit-if-changed lib`, single ubuntu job, no build
  matrix, no web/wasm step); README never mentions web and points to an
  (unexamined) Wiki for builds. No evidence the Rust core is wired to
  web. Status: UNVERIFIED-leaning-unwired.
- Receive-side wallet ("accepting bitcoin donations") — sender-side
  coverage must be read from spdk, not assumed from the app.

## Cake — many rails, one app, Dart seam

- Rail seam = the `cw_core` INTERFACE FAMILY (Dart):
  `wallet_base/wallet_service/wallet_credentials/wallet_addresses/
  wallet_keys_file`, `transaction_history/transaction_info/transaction_
  direction/transaction_priority/pending_transaction`, `balance`,
  `node/node_list`, `sync_status`, `crypto_currency/currency`,
  `wallet_type` (enum, Hive-persisted via `.part` adapters), token
  abstractions (`erc20_token/spl_token/tron_token/zano_asset`).
  Rails are sibling packages implementing them: cw_monero, cw_wownero,
  cw_bitcoin, cw_bitcoin_cash, cw_decred, cw_dogecoin, cw_evm, cw_nano,
  cw_solana, cw_tron, cw_zano, cw_zcash, cw_mweb (+ cw_core,
  cw_shared_external). LTC rides cw_bitcoin + cw_mweb.
- MIT. Rust sits at the EDGES (native libs via cw_shared_external); the
  rail polymorphism is Dart, not Rust.
- **No web target at all** (android/ios/linux/macos/windows only).

## The two UNVERIFIED claims — now VERIFIED at source

1. **Bitcoin Silent Payments** — VERIFIED.
   [docs.cakewallet.com/features/privacy-and-security/silent-payments](https://docs.cakewallet.com/features/privacy-and-security/silent-payments):
   "Cake Wallet was the first wallet with full Silent Payments support —
   both sending and receiving"; scan-from-date/height + scan-one-block;
   requires a tweak-capable Electrum server (electrs with tweaks index),
   and **if the user's node can't serve tweaks "the scan runs against
   Cake Wallet's own server" (electrs.cakewallet.com:50001)**. Shipped
   v4.18.0, May 2024 (secondary: spark.money comparison, D-Central).
   ⚠ The scan-server fallback is a trust/privacy decision bPay must make
   explicitly — it conflicts with our first-party-only instinct.
2. **Payjoin v2** — VERIFIED. Official blog
   "Cake Wallet Introduces Payjoin v2" (May 2025) + docs: asynchronous,
   **serverless, no Tor** — sender and receiver need not be online
   simultaneously; tracked by Bitcoin Optech. (BIP-78 was the
   synchronous ancestor; v2 is the async/BIP-77-family shape.)
3. **Zano/Zcash/Decred lag on Linux desktop** — VERIFIED two ways:
   - Official forum thread, exact title: "Why are Zcash (ZEC), Decred
     (DCR), and Zano (ZANO) not supported on the linux desktop (Flatpak)
     version?" (forum.cakewallet.com/t/723) — desktop overhaul on the
     roadmap.
   - Independent asset evidence from GitHub releases: v6.4.0/v6.4.1
     (Zcash/Ironwood) and v6.4.3 (Zano hardfork) ship **Android APK
     hashes only — no Linux flatpak/tar.xz**, while adjacent releases
     (v6.4.4, v6.3.2, v6.2.x) do carry Linux assets.

## Synthesis for bPay

**The two references are complementary opposites, and NEITHER alone is
bPay's blueprint.** Dana proves the Rust-centered core on native
platforms and — via spdk — the factoring of protocol logic into a
reusable crate. Cake proves replaceable rails under one app — but with a
DART seam and Rust at the edges. Critically:

1. **The web leg is unproven by both.** No shipped Rust-core-to-web in
   Dana (scaffold + format-only CI, no wasm deps) and no web target at
   all in Cake. frb 2.x CAN target wasm in principle; nothing here
   demonstrates it in production. bPay's "…and web" must be proven by
   us, not assumed from either reference.
2. **A shared app shell does NOT eliminate rail×platform divergence.**
   Cake's Linux gaps cluster exactly on the rails with the heaviest
   native dependencies (Zcash trees, Zano, Decred) — divergence lives in
   per-rail native build/FFI/packaging, which the Dart seam papers over
   in the UI but cannot remove underneath. The counter-pattern (and our
   existing estate law): keep rails PURE-RUST where possible (our
   `chain-*` crates) so the cross-platform matrix is ONE Rust build, not
   rail×platform FFI combos. This recon CONFIRMS our architecture
   direction; it does not replace it.
3. **Reuse candidates (license-clean; both MIT):**
   - `spdk-wallet` (pin cygnet3/spdk v0.7.0) — the leading candidate to
     STUDY or CONSUME for bPay's BTC silent-payments rail; next probe =
     sender-side coverage + wasm capability (its wasm story decides
     whether Dana's stack could ever cover bPay's web leg).
   - frb `=2.x` pattern: API authored in Rust (`api.rs`), bindings
     generated — keeps exactly one authority; our watchpay crate's
     sealed-handle discipline ports naturally onto this.
   - Cake's cw_core interface family as the CHECKLIST for bPay's rail
     trait surface (service/credentials/addresses/keys/history/pending-
     tx/balance/node/sync-status/currency/tokens) — port the SHAPE to
     Rust traits; do not copy Dart.
   - `pushtx 0.4` for BTC broadcast; Cake's tweak-index scanning model
     (with the own-server-vs-tweak-electrum decision named).
4. **Decision flagged for the founder:** if bPay ever needs silent-
   payments RECEIVE, the scan-infrastructure question (own tweak-capable
   electrum on the box vs first-party server vs Cake-style fallback) is
   an infrastructure choice, not a code choice — Cake's fallback routes
   scan traffic to their infrastructure; our first-party-only law says
   that default is not ours to inherit.

## Limits (honest)

Dana's Wiki build docs unexamined; spdk-wallet internals (sender/receiver
split, wasm targets, its own deps) unexamined — both are the natural
next probes; Cake's `wallet_type` enum values not quoted (filename-level
only); release-asset evidence is from the releases front page; Zano/
Monero rail internals unexamined at code level. No integration, no
forks, no builds.

## Sources

- https://github.com/cygnet3/dana (tree, rust/Cargo.toml, rust/src, web/,
  .github/workflows/flutter.yml, README) @ dev, 2026-09-16
- https://github.com/cygnet3/spdk @ tag v0.7.0 (existence via Dana pin)
- https://github.com/cake-tech/cake_wallet (tree, cw_core/lib,
  releases) @ dev, 2026-09-16
- https://docs.cakewallet.com/features/privacy-and-security/silent-payments
- https://blog.cakewallet.com/bitcoin-privacy-takes-a-leap-forward-cake-wallet-introduces-payjoin-v2/
  (+ docs.cakewallet.com payjoin page)
- https://forum.cakewallet.com/t/why-are-zcash-zec-decred-dcr-and-zano-zano-not-supported-on-the-linux-desktop-flatpak-version/723
- Secondary: spark.money BIP-352 wallet comparison; D-Central; Bitcoin
  Optech payjoin topic; Bitcoin Magazine (May 2025).

Report-back (≤150 words): LANDED this dispatch (research-only, nothing
integrated). NEXT PROBES for the queue: spdk-wallet sender-side + wasm
capability; Dana Wiki build matrix; Cake wallet_type enum + cw_bitcoin
SP code. The bPay web leg remains UNPROVEN by both references — first
proof obligation is ours.
