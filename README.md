# Beehive Nature Reserve Kernel — Zano × Trezor host stack

[![tests](https://github.com/beehive-nature/beehive-nature/actions/workflows/tests.yml/badge.svg)](https://github.com/beehive-nature/beehive-nature/actions/workflows/tests.yml)
[![secret-scan](https://github.com/beehive-nature/beehive-nature/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/beehive-nature/beehive-nature/actions/workflows/secret-scan.yml)
[![license: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](./LICENSE)

Host-side cryptography, wire contract, and architecture for a **Trezor-native**
Zano integration, built as the identity/settlement layer of the **Beehive
Nature Reserve Kernel**.

> **Status:** cryptographic design source-confirmed; wire contract frozen (proto
> v0.3); host-side derivation **proven against stock Zano** — *reproducible*: run
> `cargo test -p chain-zano` (committed vector, `src/testvec.rs`). Firmware and
> legal review are the unstarted work between here and anything a user touches.
> See [`STATUS.md`](./STATUS.md).

## The one rule everything depends on

**The Zano spend secret `s` never exists in host RAM.** It is derived and used
only inside the Trezor firmware; the host is an untrusted coordinator that
handles public ring data and receives public signature outputs. Any code or flow
that puts `s` on the host is a bug, not a feature.

Corollary for this repo: **never commit a real spend secret.** The `#[ignore]`d
compatibility tests will need a `(spend_secret -> public_key)` vector — use a
**dedicated throwaway testnet key**, treat it as burned, and prefer keeping it
out of version control (see `.gitignore`).

## Layout

```
.
├── Cargo.toml                    workspace
├── STATUS.md                     honest done / not-done ledger — read this first
├── proto/
│   └── messages-zano.proto       FROZEN wire contract (v0.3) for on-device signing
├── crates/
│   └── chain-zano/               host-side derivation + firmware-spec modules
│       └── src/
│           ├── lib.rs            module safety boundary (host-safe vs firmware-spec)
│           ├── view.rs           HOST-SAFE view-only restore (never returns s)
│           ├── keys.rs           FIRMWARE-SPEC: s -> {v,S,V} math (prototype only)
│           └── slip0010.rs       FIRMWARE-SPEC: SLIP-0010 Ed25519 (DANGER header)
└── docs/architecture/
    ├── handoff-v1.3.md           canonical handoff (source-confirmed crypto)
    ├── integration-plan.md       firmware project plan
    ├── protocol-proposal.md      Monero-style signing protocol proposal
    ├── crypto-delta-spec.md      trezor-crypto reuse vs new-port mapping
    └── handoff-v1.2-superseded.md kept for history
```

The **Trezor firmware app** (the on-device `CLSAG_GGX` implementation) is a
separate future effort — a fork of `trezor-firmware` — and does **not** live in
this repo. This repo is the host side.

## Quickstart

```bash
git config core.hooksPath .githooks   # one-time per clone: local secret-scan hook (CI re-runs the same scan on every push)
# Windows/GNU toolchain note: crates using raw-dylib (tokio deps) need full
# mingw binutils. WinLibs is installed via winget; put its bin dir and
# ~/.cargo/bin on PATH (neither is added automatically):
#   $LOCALAPPDATA/Microsoft/WinGet/Packages/BrechtSanders.WinLibs.POSIX.UCRT_*/mingw64/bin
cargo build           # whole workspace (six crates) builds clean
cargo test            # passing tests are internal-consistency only
cargo test -- --ignored   # compatibility tests: RED until a real Zano vector is pasted
```

The compatibility tests being green is the milestone that converts "compiles" to
"proven Zano-compatible." See `STATUS.md` for exactly how to get there.

## Confirmed crypto facts (from Zano source)

- `s = sc_reduce(seed[0..32])` (`keys_from_default`)
- `v = keccak256(s) mod ℓ` (`dependent_key`; Keccak256, **not** Sha3_256)
- `I = s·Hp(P)`, `Hp(P) = mul8(ge_fromfe_frombytes_vartime(keccak256(P)))`
- SLIP-44 coin type `1018` (verified against the registry)
- `generate_CLSAG_GGX` is single-pass; returns `{c, r_g[], r_x[], K1, K2}`

## For reviewers

This repo is built to be audited. The fastest orientation:

1. **[`STATUS.md`](./STATUS.md)** — the authoritative ledger: every claim
   is dated and staked to a commit, a source citation, or captured live
   output. What's proven, what was refuted, what's decided, what's gated.
2. **Run it** (the count is a command, not a claim):
   `git config core.hooksPath .githooks && cargo test --workspace` →
   **`179 passed; 1 ignored`** (the ignored test is the firmware-gated
   `slip0010` end-to-end, and says so).
3. **The claims most worth attacking:** the escrow state machine's
   dual-balance funding check ([escrow-core](./crates/escrow-core)), the
   stock-Zano derivation vector proof ([chain-zano](./crates/chain-zano),
   vector provenance in `src/testvec.rs`), the provenance-weighted
   adjudication ([dispute-engine](./crates/dispute-engine) — popularity
   must never auto-enforce), and the SHIP wire codec ([chain-eos](./crates/chain-eos)
   — reproducible against a mock SHIP server via `cargo test -p chain-eos`;
   also dev-chain observed against a local nodeos, per `STATUS.md`).
4. House rules and scope boundary: [REVIEWING.md](./REVIEWING.md). Anything
   exploitable goes through the private channel in [SECURITY.md](./SECURITY.md),
   never a public issue. Contributions → [CONTRIBUTING.md](./CONTRIBUTING.md)
   (DCO sign-off, one-door review, no CLA).

## License

Code: **AGPL-3.0-only** ([LICENSE](./LICENSE)) — copyleft at the kernel,
by design; see [docs/LICENSING.md](./docs/LICENSING.md) for the
anti-capture rationale and the standing intent that client SDK crates
ship MIT OR Apache-2.0 when split out.

Documents: `CONSTITUTION.md` and `docs/` are **CC-BY-4.0**.

Contributions: DCO sign-off (`git commit -s`), no CLA — see
[CONTRIBUTING.md](./CONTRIBUTING.md).
