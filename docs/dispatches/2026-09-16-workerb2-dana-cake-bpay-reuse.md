# WORKERB2 — Dana × Cake Wallet: reusable bPay cross-platform/rail architecture · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"immediately review Dana + Cake
Wallet together for reusable bPay cross-platform/rail architecture."*
**Mode:** research/reuse review — RULE-vs-SOURCE dissection, no code, no wallets
touched, no implementation. **Baseline:** origin/main `8923635b` (recorded after
fetch, concurrency protocol). **Scope note:** "bPay" is the founder's coinage this
session — read here as the estate's pay layer (wallet.html PAY panel + adapter
workers, watchpay, vending/x402 meter, voucher-escrow rail, the W@tch/phone app
line, box doors). That scoping is my reading, marked as such.

**Rules honored:** crypto-language law (claims cap at "sound by construction",
cited); claims cite pinned sources read this session; ADOPT/ADAPT/WRAP/WATCH/BUILD
gate per the reuse-queue discipline; nothing below authorizes implementation.

---

## 0. The verdict, first

Both wallets converge on the SAME architecture the estate already practices at
the Rust layer — **one shared core, thin per-platform UIs, injectable backends** —
and they validate it at production scale in two different registers:

1. **Dana is the cross-platform seam proof for bPay's app tier (ADAPT, high
   value).** Flutter UI over a Rust core at a pinned tag (`spdk v0.7.0`) through
   `flutter_rust_bridge 2.13.0`, with all six platform folders present. The
   estate's Rust pay crates could ride ONE bridge into the existing
   W@tch/phone Flutter line instead of Dart re-ports — the Order D
   `join_by_address.dart` port is the receipt for what re-porting costs
   (canonical-origin signing had to be re-proven per platform).
2. **Cake Wallet is the rail-plugin pattern at scale (ADAPT the seam, REJECT
   the infra).** Fourteen per-rail packages over one `cw_core` abstraction,
   one tree building two products via pubspec overrides — but its defaults
   (Cake Labs nodes, KYC exchange aggregation, iCloud backup) are exactly the
   estate's banned shape. What carries is the package seam and the
   privacy-posture discipline, not the services.
3. **Both are MIT at today's pins** — clean for ADAPT-shaped learning; the
   estate's copy laws (never copy, build alongside) still govern any code
   proximity.
4. **Cake ships Base and Zano rails** (`cw_evm`, `cw_zano`) — two of the
   estate's live/modeled chains exist there as MIT reference
   implementations. WATCH-grade reuse, per-rail.

---

## 1. Source pins (all read this session, 2026-09-16)

| repo | state at read | license | role here |
|---|---|---|---|
| `cygnet3/dana` | default branch `dev`, pushed 2026-09-15T12:50Z, 62★, Dart | MIT (API spdx) | cross-platform receive wallet (SP) |
| `cygnet3/spdk` | `master`, pushed 2026-09-15T13:01Z, 16★, Rust | MIT (API spdx) | Dana's Rust core |
| `cake-tech/cake_wallet` | default branch `dev`, pushed 2026-09-15T22:05Z, 1,916★, Dart | MIT (API spdx; README © Cake Labs LLC) | multi-rail wallet at scale |

API snapshots via `api.github.com/repos/…` (metadata only). Dana's Rust wiring
pinned from its own manifest: `rust/Cargo.toml` on `dev` declares
`spdk-wallet = { git = "…/cygnet3/spdk", tag = "v0.7.0" }` — a TAG pin, the
estate's own preferred shape.

## 2. Dana dissection — the cross-platform seam (FACTs from source)

- **Shape:** "a flutter app used for accepting bitcoin donations" using silent
  payments (README). Experimental by its own words: "currently still considered
  'experimental'"; "Don't use funds you aren't willing to lose." Distribution
  Android-first (own F-Droid repo `fdroid.danawallet.app`, Zap Store, GitHub
  Releases) — but the repo carries **all six Flutter platform folders**
  (android, ios, linux, macos, windows, web; repo root listing).
- **The seam (the load-bearing fact):** `flutter_rust_bridge.yaml` at root +
  `rust/` (crate `rust_lib_danawallet`, cdylib+staticlib) + `rust_builder/`
  (local path package wired into `pubspec.yaml` as `rust_lib_danawallet`).
  `pubspec.yaml` pins `flutter_rust_bridge: 2.13.0` (exact pin). The Dart side
  holds ZERO protocol logic: no electrum, no bitcoin, no crypto deps beyond
  `crypto: ^3.0.5` — keys/scanning/signing live in Rust.
- **Rust core wiring (`rust/Cargo.toml`, FACT):** `spdk-wallet` @ tag `v0.7.0`
  (git dep), `bip39 2.0` (seed), `tokio` (rt-multi-thread), `pushtx 0.4.0`
  (broadcast client), serde/simplelog. spdk itself (README @ master):
  sub-crates `spdk-core` (defines the **`ChainBackend` trait** + `Updater`
  trait — consumers supply chain data), `backend-blindbit-v1` (BIP-352 light
  client, the default backend), `silentpayments` (passes the BIP's test
  vectors), `spdk-wallet` (`Client` + `Scanner`, create/sign transactions).
  Warning carried verbatim: "SPDK currently relies on cryptography that is not
  professionally reviewed."
- **Dart-side surface:** `flutter_secure_storage ^10` (secrets), `sqflite`
  (wallet DB), `dart_bip353` (own package — BIP-353 name resolution separated
  exactly the way bnr:// resolution is its own surface here),
  `bitcoin_ui` (own fork), `mobile_scanner`, provider state. Reproducible dev
  env: `shell.nix` + `justfile` + `.fvmrc` (pinned Flutter) — the estate's
  pin-parity culture, mirrored.
- **BIP-353 identity:** donations to `₿donate@danawallet.app`; wiki (prior
  lane, 09-12): names re-resolved per send, mismatch blocks the send.

## 3. Cake Wallet dissection — the rail-plugin pattern (FACTs from source)

- **Shape:** "open-source, non-custodial, and private multi-currency crypto
  wallet for Android, iOS, macOS, and Linux" (+ Windows build guides under
  `docs/builds/`); 13 listed chains including **Base**, Ethereum, Solana,
  Tron, **Zano**, Monero, BTC/LTC/BCH/Nano/Decred. Two products from one
  repo: Cake Wallet (multi) and Monero.com (Monero-only).
- **The seam (load-bearing):** a per-rail package family at repo root —
  `cw_core`, `cw_bitcoin`, `cw_bitcoin_cash`, `cw_decred`, `cw_dogecoin`,
  `cw_evm`, `cw_monero`, `cw_mweb`, `cw_nano`, `cw_solana`, `cw_tron`,
  `cw_wownero`, `cw_zano`, `cw_zcash`, plus `cw_shared_external` and
  `cw_custom_lints`. `cw_core/lib/` holds the abstraction: `wallet_base.dart`,
  `wallet_type.dart`, `crypto_currency.dart` (34 KB currency/seed map),
  `node.dart` + `node_list.dart` (+ `n2_node.dart`), `sync_status.dart`,
  `transaction_history/info`, `pending_transaction.dart`,
  `unspent_transaction_output.dart`, per-chain token types (`erc20_token`,
  `spl_token`, `tron_token`, **`zano_asset`**), `lnurl.dart`,
  **`payjoin_session.dart`**, Hive persistence (`cake_hive`,
  `encryption_file_utils`), a `hardware/` dir, and native-binding stubs.
- **Product-line mechanism (FACT from listing + script names; mechanics
  INFERENCE):** `pubspec_base.yaml` + a 56 KB `pubspec_overrides.yaml` +
  `configure_cake_wallet.sh` — one tree configures into the two shipped
  products. Dockerfile + `com.cakewallet.CakeWallet.yml` (Flatpak) +
  `cakewallet.bat`/`run-android.sh` give containerized/reproducible builds.
  Rust enters via **cargokit** (`cargokit_options.yaml`).
- **Privacy posture (PRIVACY.md, quoted faithfully):** "Usage Data … is NOT
  collected by Cake Labs"; keys/funds data "remains on your device at ALL
  times" and is "not received, collected, or stored by Cake Labs … for any
  reason." Cake Labs nodes see IP + sync height transiently and are said not
  to store it; users can pick third-party or self-hosted nodes
  (self-hosting recommended); error reports are opt-in and editable before
  sending. Third-party exchange/buy services (ChangeNOW, Onramper, MoonPay
  named) apply their own KYC. No Tor claims in the policy (README mentions
  Tor/i2p proxy compatibility). APK signing hash published for verification;
  same key across distribution channels.

## 4. What this means for bPay — mapped onto estate seams

**The convergence (the review's core finding).** All three architectures —
Dana, Cake, and the estate's own Rust layer — sit on the same law: *protocol
logic in a shared, testable core; platforms as thin windows; chain/network
access behind injectable traits.* The estate already practices it in Rust
(`chain-*` adapters trait-fronted and read-only by design; `watchpay`'s
`ConnectTransport` with no shipped implementation; `bnr-keys` as a WASM seam
into web) and in JS (`wallet-adapter-*.js` workers under the adapter-ring
rule). Dana and Cake prove the pattern survives app-store distribution,
multi-rail growth, and (Cake) a decade-shaped product line.

**Per-seam verdicts:**

| # | pattern | source | verdict | estate anchor |
|---|---|---|---|---|
| 1 | Flutter-over-Rust via `flutter_rust_bridge` at a **tag-pinned** core | Dana | **ADAPT (top value)** | the W@tch/phone Flutter line (PR #4/#5, APKs verified) + the Rust pay crates already on main (watchpay, voucher-escrow, bsigner, bnr-keys). One bridge = zero per-platform protocol ports. |
| 2 | `ChainBackend`/`Updater` trait split with swappable light-client backends | spdk | **ADAPT** (already estate law — adapter-ring; spdk receipts that it ships in a real wallet) | any future SP/indexer lane stays founder-gated (display-only law stands); "My Scanner on the box" remains the self-hosted shape if ever ruled. |
| 3 | Per-rail packages over one core abstraction (`cw_*` over `cw_core`) | Cake | **ADAPT at the package level** — when bPay outgrows wallet.html, rails become packages, not sections | PAY panel's 4 rails + watchpay + vending/x402 are already separate crates/doors; the lesson is the *product* seam, not new abstraction. |
| 4 | One tree → multiple products via pubspec overrides | Cake | **ADAPT** | a receive-only "artist/phone" build vs the full bPay build — matches the display-only card law as a *product*, not a code path. |
| 5 | `cw_evm` / `cw_zano` as MIT reference implementations | Cake | **WATCH** (read paths first) | Base is our live USDC rail; Zano is modeled unsigned (chain-zano, zano-watcher view-only). Reference-grade reading, never copy. |
| 6 | `payjoin_session.dart`, `lnurl.dart` in core | Cake | **WATCH** | payjoin/LNURL are send-side privacy/UX rails bPay does not carry today; revisit with any real BTC send lane. |
| 7 | Privacy posture as a shipped artifact (PRIVACY.md with receipts, opt-in error reports, self-host recommendation) | Cake | **ADAPT the discipline** | first-party-only law + read-only doors already comply; the missing piece is the *published* posture document. |
| 8 | Hosted-node defaults, KYC exchange aggregation, iCloud backup, fiat rails | Cake | **REJECT for the estate** (recorded, not judgment of Cake) | nodes-on-the-box law; VPN-never-a-step onboarding law; no third-party endpoint in a page (adapter-ring). |
| 9 | BIP-353 name resolution as a separate package | Dana | **WRAP-shaped later** | bnr:// resolver surface is the estate analog; BIP-353 stays display-only text until a DNSSEC lane is ever ruled (prior blueprint's open question stands). |

**The Order D receipt as the cost model (why #1 matters).** Order D built
`join_by_address.dart` as a full protocol port into the phone app; the
canonical-origin signing law had to be re-proven in Dart, and flutter CI had
to gate it because this seat carries no flutter toolchain. With an FRB seam,
that class of work becomes "expose the already-tested Rust function" — the
watchpay merge (28116f4a) put exactly such tested protocol logic on main the
same hour this mission began. (This paragraph is INFERENCE from receipts, not
a build proposal — no implementation is authorized here.)

**Ecosystem freshness rider (raid law: rows >30 days are stale by default).**
The SP blueprint (09-12) said libsecp SP module "in progress PR #1765"; the
09-13 raid corrected it to shipped in v0.8.0 — still the freshest word, no
change this session. Dana's own pins today: spdk tag `v0.7.0`, BIP test
vectors passing per spdk README, "not professionally reviewed" warning
standing. The estate's prepared pin list (libsecp 0.8.0, Frigate, BlindBit)
needs no update from this review.

## 5. Open questions for the founder (no action implied)

1. Does bPay's app tier formally adopt "Rust core + FRB bridge + Flutter" as
   its cross-platform law (verdict #1)? That is a product-architecture
   ruling, not a code change — it would steer the W@tch line's next slices.
2. Should the estate ever publish a PRIVACY.md-grade posture document for
   skaists.dev surfaces (verdict #7)? Cake's artifact is the shape.
3. Cake's `cw_zano` — worth a read-lane raid against our chain-zano/zano-
   watcher modeling before any Zano signing decision lands (interacts with
   the standing btrezor THP blocker)?
4. Nothing here touches the standing SP receive-lane ruling (display-only
   stands) or the reconciliation gate's protocol-reuse queue discipline —
   this dispatch is evidence for those seats, not a queue jump.

## Source ledger (read 2026-09-16, this session)

- `api.github.com/repos/{cygnet3/dana, cygnet3/spdk, cake-tech/cake_wallet}` — pins
- `raw.githubusercontent.com/cygnet3/dana/dev/README.md` · `pubspec.yaml` · `rust/Cargo.toml` · repo root listing
- `raw.githubusercontent.com/cygnet3/spdk/master/README.md`
- `raw.githubusercontent.com/cake-tech/cake_wallet/dev/README.md` · `PRIVACY.md` · repo root + `cw_core/lib/` listings
- In-tree anchors: `docs/dispatches/2026-09-12-bnr-sp-dana-profile-blueprint.md`
  (untracked in shared checkout at baseline; content read there),
  `docs/dispatches/2026-09-13-raid-sp-discord-general.md`, watchpay crate on
  main @ `28116f4a`, wallet.html adapter workers, `docs/agents/CONCURRENCY-PROTOCOL.md`.

**No keys, wallets, transactions, or production systems touched. No code
written into the estate. Research only, receipts above.**
