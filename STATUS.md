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
- [ ] **`cargo build` pass.** Resolve exact `curve25519-dalek` 4.x API spellings
      (basepoint mul, `Scalar` constructors) — modules were written against v4
      but not compiled here.

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
