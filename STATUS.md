# STATUS — honest done / not-done ledger

The one-line summary for any new reader or AI:

> **The cryptographic design is source-confirmed and the wire contract is frozen.
> The firmware, the compatibility proof, and the legal review are the unstarted
> work between here and anything a user touches.**

Do not let AI-to-AI review re-open the items under "Done." If you believe one is
wrong, cite the Zano source file/line and stop — do not rewrite it.

## Repo state — last known good

One line per milestone; newest first. This section, not any AI's memory, is the
authoritative record of where `origin/main` sits.

- `2026-07-03` — **§6 stretch: action extraction + name codec + bus proof.**
  chain-eos now *produces* actions, not just counts: EOSIO name codec
  (u64 ↔ "lovismarket", verified against the known `eosio` vector) and
  `extract_actions()` → account/name/tx_id(sha256)/raw data, sharing one
  receipt walker with the summary (4 new tests, 12 total). Integration
  test `normalizer/tests/pipeline_to_bus.rs` proves the nervous system
  end-to-end: RawChainAction → normalize → event-bus → two independent
  consumers see the same CanonicalEvent; chain noise never enters the bus.
  **The one unglued seam is now precisely the ABI decoder** (binary action
  data → JSON fields) — everything on either side of it is built and
  tested. Machine note: no WSL/Docker on this host; the local-SHIP-node
  option needs `wsl --install` + reboot (owner action).
- `2026-07-03` — **tests now gate every push (CI `tests` workflow).** Build +
  test + fmt on ubuntu runners. Motivated by a real failure: Windows Smart
  App Control intermittently blocks freshly built unsigned test exes
  (os error 4551), so local verification on the dev machine is best-effort
  and **CI is authoritative** for test state. (SAC fix is a one-way door —
  owner's call, undecided.)
- `2026-07-03` — **§6 prereq check answered: no public SHIP endpoint exists
  for jungle4.** Verified against the Jungle Monitor, the testnet install
  docs (State History section is empty), and every producer's on-chain
  bp.json (`ship_disclosure` there means *ownership*, not SHIP). Options,
  cheapest first: (a) local single-node Antelope chain with
  `state_history_plugin` via Docker/WSL — full SHIP handshake, zero testnet
  dependency; (b) ask in the Jungle Telegram — operators share SHIP URLs on
  request; (c) paid SHIP (EOS USA) or Pinax substreams (different protocol,
  needs an adapter). Note for (b)/(c): endpoints will be wss:// — add
  tokio-tungstenite's `native-tls` feature (schannel on Windows, no cmake).
- `2026-07-03` — **chain-zano compiles; internal tests green (7 + 3 ignored).**
  The STATUS "do first" `cargo build` item resolved with ZERO code changes —
  the curve25519-dalek 4.x spellings were right all along. Doc-comment lint
  fixes + rustfmt only (semantics untouched per the no-reopening rule). The
  full six-crate workspace now builds clean; README quickstart is literally
  true. The three `#[ignore]`d vector tests remain the reality gate.
- `2026-07-03` — **event-bus: in-memory CanonicalEvent fan-out green.**
  `crates/event-bus` — `EventBus` over `tokio::sync::broadcast`:
  publish/subscribe, no-subscriber publishes drop silently, laggards get
  `Lagged` and skip ahead without blocking anyone, late subscribers see
  only future events (all pinned by 6 tests). `BusError` is an empty enum
  — the in-memory bus has no failure modes; the type keeps `publish`'s
  contract stable for a networked backend (bus choice = Phase 3 per §6).
  Runtime nervous system is now complete in pure logic: chain-eos →
  normalizer → event-bus → consumers. **Pivot point: reality.** Next work
  requires a live SHIP endpoint or Zano testnet, not more logic crates.
- `2026-07-03` — **normalizer: raw actions → CanonicalEvents green (§9.3).**
  `crates/normalizer` — `RawChainAction` + `normalize()` with the two §9.3
  mappings (`lovismarket:addlisting → ProductListed`, `zano:transfer →
  OrderFunded`). Unmapped actions `Ok(None)` by design; recognized-but-
  malformed payloads are typed errors (missing field / bad type), never
  guesses. 7 tests: both mappings, ignore path, both malformed paths,
  timestamp default, serde round-trip. Ingestion pipeline is now complete
  end-to-end in pure logic: SHIP bytes → decode (chain-eos) → normalize →
  CanonicalEvent (shared-types). Next: wire chain-eos action unpacking to
  RawChainAction against a real SHIP endpoint, or Zano findings follow-up.
- `2026-07-02` — **chain-eos Phase 1: SHIP ingest + block decode green (§6).**
  `crates/chain-eos` — hand-rolled minimal SHIP codec (Verification
  Principle: crates.io check showed the `eosio` crate is a contract SDK
  dead since 2020-02, `eosio-shipper` nonexistent). Decodes result
  envelope, block_position, signed_block walk → tx + action counts (block
  num cross-derived from header `previous`). Binary: tokio-tungstenite
  handshake (ABI → status → stream), retry/backoff, `SHIP_WS_URL` env.
  ws:// only (rustls needs cmake/NASM on windows-gnu — TLS deferred).
  8 tests vs synthetic blobs inc. truncation + bad-flag paths. No live
  node tonight → mock path per §6 prereq. Toolchain note: raw-dylib deps
  need mingw binutils — WinLibs installed; add its bin + ~/.cargo/bin to
  PATH (see README). Next: run vs real SHIP endpoint, then normalizer.
- `2026-07-02` — **shared-types: canonical event schema green (§9.3).**
  `crates/shared-types` — `CanonicalEvent` envelope, `SourceChain`, flat
  `EventType` (16 variants, `DIDLinked` JSON rename), family `EventPayload`
  (adjacently tagged `{"type","data"}`). DIDs not raw keys; `(amount,
  asset_id)` never a hardcoded currency; message content never on the bus
  (Autonomi ref only). 5 tests: full round-trips + mock Vaulta
  `lovismarket:addlisting → ProductListed`. Next: normalizer or chain-eos
  Phase 1 (§6), or Zano findings follow-up.
- `2026-07-02` — **escrow-core: state machine + exhaustive tests green.**
  `crates/escrow-core` per brief §9.1–9.2: `EscrowState`, `Escrow` (with
  `fee_buffer_zano` and dual-balance funding check), `transition()` enforcing
  the full table + timeouts, time only via events (hermetic tests). 27 tests:
  every valid transition, exhaustive 9×7 state/event rejection matrix,
  timeout boundaries, partial-funding rejection, dispute-window edge, serde.
  clippy + fmt clean. First `Cargo.lock` committed (tracked per decision).
  Brief + CONSTITUTION now versioned in `docs/`. Next: canonical event types
  (§9.3) or Zano findings follow-up.
- `2026-07-02` — secret scan is now remote-enforced: shared rules live in
  `scripts/secret-scan.sh` (hook delegates in `diff` mode; CI runs `tree` mode
  on every push/PR via `.github/workflows/secret-scan.yml`). Fresh clones that
  skip hook setup are caught server-side. Exemptions: `Cargo.lock` (public
  sha256 checksums), and a **same-line `TESTNET-ONLY` marker** — the sanctioned
  path for the future compat-test vector (an unmarked vector fails CI even if
  committed with `--no-verify`).
- `2026-07-02` — pre-commit secret guard: `.githooks/pre-commit` blocks 48+ char
  hex runs, PEM private-key blocks, and secret-extension files (even `add -f`)
  from entering history. Enable per clone: `git config core.hooksPath .githooks`
  (in README Quickstart). Deliberate exceptions: eyeball, then `--no-verify`.
- `2026-07-02` — `8797d66` initial commit (16 files: chain-zano, docs, proto,
  workspace config) pushed to private `github.com/beehive-nature/beehive-nature`,
  `main` tracking `origin/main`. Staged diff scanned for secret material before
  commit (grep + long-hex pass): clean. **Next file: escrow-core.**

## Done — source-confirmed (staked against `hyle-team/zano/src/crypto`)

- **Key derivation, end to end**
  - `s = sc_reduce(seed[0..32])` — `crypto.cpp keys_from_default`
  - `v = keccak256(s) mod ℓ` — `crypto.cpp dependent_key` (Keccak256, not Sha3_256)
  - `I = s·Hp(P)`, `Hp(P) = mul8(ge_fromfe_frombytes_vartime(keccak256(P)))` — `generate_key_image`
  - Address `{S, V}`, both derivation paths, view-only restore
  - SLIP-44 coin type **1018** (verified against the SLIP-0044 registry by hand)
- **Wire contract — `proto/messages-zano.proto` v0.3 (frozen)**
  - Staged flow; `s` and secret scalars never on the wire
  - `CLSAG_GGX_signature` `{c, r_g[], r_x[], K1, K2}` — matches `clsag.h`
  - `bppe_signature` `{L[], R[], A0, A, B, r, s, δ1, δ2}` — matches `range_proof_bppe.h`
  - `generate_CLSAG_GGX` confirmed **single-pass** (K1/K2 before challenge, no BP+ read) — `clsag.cpp` 189–330
  - `1/8` rule pinned per field (host sends RAW; firmware scales internally)
- **Architecture**
  - Trezor-native decision (`s` never on host)
  - Kernel / adapter separation; identity-less-settlement privacy invariant

## Not done — the real remaining work

### Highest value, cheapest, do first
- [ ] **Un-ignore the compatibility tests.** Generate one keypair in the stock
      Zano CLI, export `(spend_secret -> spend_public, view_public)`, paste hex
      into the `#[ignore]`d tests in `keys.rs` / `view.rs`, remove `#[ignore]`,
      run `cargo test`. Green = every derivation claim here is PROVEN, not
      asserted. **Use a throwaway testnet key; never commit a real secret.**
- [x] **`cargo build` pass.** DONE 2026-07-03: compiled clean on the first
      attempt — the dalek 4.x spellings were correct as written; zero code
      changes needed. 7 internal-consistency tests green, 3 vector tests
      still `#[ignore]`d awaiting reality (correct). Full workspace builds.

### Known, scoped, larger
- [ ] **Trezor firmware app** — on-device `CLSAG_GGX` implementing the proto.
      This is what makes "`s` never leaves the device" *true* rather than
      *specified*. Separate repo (fork of `trezor-firmware`). Unstarted.
- [ ] **Two unread crypto bodies** (fill-in, not architecture):
      balance proof `generate_double_schnorr_sig` (`zarcanum.cpp`) and the
      tx-prefix serialization contract (byte-exactness / vector test).
- [ ] **`mnemonic_encoding` port** — 25-word phrase → 32-byte seed, for full
      stock-wallet restore. Plain encoding, no crypto risk. `common/mnemonic-encoding.h`.
- [ ] **RPC scanner** (`chain-zano` adapter) — reads the chain, emits
      identity-less `CanonicalEvent`s. Pure I/O; needs no firmware.

### Not an engineering task — do not defer indefinitely
- [ ] **Legal review.** Hemp-seed futures as a regulated venue; and keeping any
      "conceal a regulated medical treatment" framing OUT of the design thesis.
      Flagged, not resolved. Needs a lawyer, not another model.

## Known minor cleanups (non-blocking)
- `ZANO_SLIP44_COIN_TYPE` and the `s→v` hash are defined in both `keys.rs` and
  (respectively) `slip0010.rs` / `view.rs`. Harmless duplication; centralize later.
- `slip0010.rs` still exposes `derive_spend_secret` (walk + reduce in one). An
  optional refactor splits out `derive_slip0010_leaf` (raw leaf) from the
  Zano-specific `mod ℓ` step for a cleaner standard/Zano boundary.

## Process note
The multi-model relay was productive early (it caught the ECDH split-brain, the
HMAC-pubkey error, SLIP-0010 misconceptions) but drifts toward re-litigating
settled ground once the design is locked. From here, point the tooling at the
**compiler and the source**, not at another generate/review lap.
