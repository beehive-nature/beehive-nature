# Z2.B recon round 2 — spdk deep-dive, Dana build truth, bPay rail checklist

Seat z2.b (GLM/zCode), 2026-09-16. Founder order (rolls-forward):
"Continue now: deeply evaluate `cygnet3/spdk` for sender-side BIP-352
coverage and WASM/web viability; verify Dana's actual native build
support; then translate Cake's `cw_core` interface family into a
technology-neutral checklist for bPay's Rust rail interface. Research/
test only—no integration." Plus a settled architecture ruling (banked,
not re-raisable): **bPay must not depend on Cake's Silent Payments
server fallback; hosted scanning may exist only as an optional adapter,
never required infrastructure.**

Method: web-only source inspection (repo trees, Cargo.tomls, CI, wiki),
2026-09-16. Nothing executed, integrated, or built.

## Probe 1 — cygnet3/spdk (MIT, workspace v0.7.1; Dana pins tag v0.7.0)

Workspace: `spdk-core`, `backend-blindbit-v1`, `silentpayments`,
`spdk-wallet`.

**Sender-side BIP-352: covered structurally.** `spdk-wallet` is the
high-level crate with a Client and Scanner for "scanning incoming
payments and creating and signing transactions". Sending machinery is
real, not aspirational: deps include `bdk_coin_select` (UTXO selection),
`bip321` (git dep — BIP-321 URI parsing), `bitcoin` + `secp256k1`
(workspace). Receive side: Scanner + spdk-core's `ChainBackend` trait
(chain data supply) and `Updater` trait (wallet state mutation during
scanning). Verdict: BOTH sides present at the crate-API level; exact
sender completeness (e.g., change handling, fee, PSBT interop) still
unread at code level — next probe if bPay adopts.

**WASM/web: NOT viable today — a port project, not a flag.** Evidence:
no wasm-bindgen/web-sys/gloo anywhere; `spdk-wallet` default features =
`backend-blindbit-v1` + `rayon` (rayon: no wasm threading); workspace
carries `reqwest` (native HTTP; wasm needs a dedicated build); the
blindbit backend is an HTTP client→server model; CI (`rust.yml`) is
`cargo build`/`cargo test`/`fmt` on ubuntu-latest only — NO target
matrix, NO wasm32. Crate-types lib+staticlib+cdylib (native FFI shape).
A port path exists in principle (drop rayon, wasm build of reqwest or a
fetch-based backend, secp256k1-to-wasm), but nothing demonstrates it —
**bPay's web leg cannot assume spdk; it would be our port, our proof
obligation.**

**The scanning-infrastructure answer got richer.** `backend-blindbit-v1`
implements a BIP-352 LIGHT CLIENT (per setavenger's
BIP0352-light-client-specification) — a third class beside "own
tweak-capable electrum" and "Cake's vendor-server fallback". Notably it
is an `optional = true` feature on spdk-wallet: consumers can build
WITHOUT any hosted-scanning backend. That is exactly the optional-
adapter shape the founder's ruling requires.

**Security honesty (their own words):** the `silentpayments` crypto
crate "passes BIP test vectors" but SPDK "currently relies on
cryptography that is not professionally reviewed" — treat as reference/
pre-audit; any bPay reuse inherits the audit obligation.

## Probe 2 — Dana's ACTUAL native build support (wiki, "Building Dana
from source")

- **Android**: the supported target — instructions, device flow
  (`fvm flutter devices`, `just prepare`/`just run`), distributed via
  F-Droid/Zap Store/releases.
- **Linux**: documented ("requires basically the same setup, except you
  don't need the Android SDK").
- **Windows/macOS/iOS**: verbatim — "should also be possible, but we
  haven't tried this ourselves." UNTESTED by maintainers.
- **Web**: absent from build documentation entirely.
- Toolchain: fvm (Flutter version manager), rustup (NOT Homebrew —
  "may lead to issues with Cargokit"), `cargo install
  flutter_rust_bridge_codegen`, `just`.

**Correction to round 1's framing:** the six platform directories in
the repo are Flutter scaffolding, not support. Dana's real support
surface = 2 platforms (Android tested+distributed, Linux documented),
3 untested guesses, web nothing. This makes Dana a STRONGER single-rail
reference (they kept it honest and thin) and a WEAKER cross-platform
one than the directory listing implied.

## Probe 3 — bPay's Rust rail interface: the technology-neutral checklist

Translated from Cake's `cw_core` member surface (verified at
`wallet_base.dart` + `crypto_currency.dart`, dev branch) — port the
SHAPE, never the Dart:

**A. Rail trait (from `WalletBase`) — a rail must provide:**
1. addresses: enumerate/derive (incl. auto-subaddress policy toggle)
2. balance: per-currency balance map + `update_balance()` refresh
3. keys: seed/private-key/passphrase accessors, `change_password`,
   `sign_message`/`verify_message` (address-optional)
4. history: transaction history object, `fetch_transactions`,
   `update_transactions_history`, `rescan(from_height)`
5. node: `connect_to_node(node)`, `check_node_health`, socket health
6. sync lifecycle: `sync_status` observable, `start/stop_sync`,
   background-sync on/off
7. fees: `calculate_estimated_fee(priority, amount)`,
   fee-param refresh
8. send: `create_transaction(credentials) -> PendingTransaction`

**B. Satellite contracts (the family around the trait):**
`WalletCredentials` (creation inputs), `WalletService` (create/restore/
open — the factory), `Node`/`NodeList` (endpoint + auth), `SyncStatus`
(state machine), `TransactionPriority` (enum), `PendingTransaction`
(amount/fee + commit/abort), `TransactionInfo`/`History` (direction,
height, confirmations), `Balance` (spendable/pending), `UnspentOutput`,
`CryptoCurrency` (name/title/tag/decimals + raw-unit parsing/formatting
— Cake: XMR 12, BTC 8, ETH 18, Nano 30; variant rails via tag), token
abstractions (`erc20/spl/tron/zano_asset` — one token layer per rail
family, not per token).

**C. What to do DIFFERENTLY in Rust (bPay deltas):**
- NO default no-op bodies on the trait — Cake's defaults
  (`stopSync` no-op, `updateEstimatedFeesParams` no-op) are how rail
  gaps get papered over; our law is fail-closed refusals (the watchpay
  crate's named-refusal pattern).
- Async surface: native `async fn` in trait (stable Rust) instead of
  Dart Futures; one error enum with per-field refusals.
- Observability: Dart's `ObservableMap`/`Observable` becomes an event
  stream (our event-bus crate) — status is PUSHED, not polled.
- Balance/currency types map onto our `Atto`-style canonical-decimal
  newtypes (strict string forms, JSON-number refusal) — Cake parses
  `Money` per-currency; we keep units explicit per rail.
- The `CryptoCurrency` registry becomes a const table; `isPotentialScam`
  / `enabled` flags are app-policy, not rail-trait members.
- Map to estate: node-on-the-box law keeps `Node` first-party;
  `create_transaction` returns OUR `PendingTransaction` bounded by
  watchpay-style ceilings (gas/fee/native caps) — the rail trait and
  the payment-contract module compose.

## Scoreboard update (round 1 → 2)

- Dana/spdk: Rust-centered BIP-352 BOTH sides (crate-level), native-only
  (2 real platforms), unaudited crypto, optional light-client scanning.
- Cake: mature multi-rail UX + verified SP/Payjoin v2; Dart seam; web
  absent; hosted-scan fallback banned for bPay by ruling.
- **Web: still solved by NOBODY. The gap stands and is now precisely
  scoped: a wasm port of a Rust BIP-352 core (spdk or ours) with a
  fetch-based backend — that proof obligation is ours, and it is the
  concrete next slice if bPay needs a web leg.**

## Limits

Sender-completeness at code level (change/fee/PSBT), blindbit protocol
details, Cargo.lock resolution of the `bip321` git dep, and Cake's
remaining cw_core files (node.dart, sync_status.dart bodies) unread —
all flagged for the next probe round if the rail decision advances. No
integration, no builds, no device.

## Sources

- https://github.com/cygnet3/spdk (README, workspace + spdk-wallet
  Cargo.toml, .github/workflows/rust.yml) @ master, 2026-09-16
- https://github.com/cygnet3/dana/wiki + "Building Dana from source"
- https://raw.githubusercontent.com/cake-tech/cake_wallet/dev/cw_core/lib/wallet_base.dart
  and crypto_currency.dart
- Round-1 dispatch: docs/dispatches/2026-09-16-z2b-recon-dana-cake-bpay.md
