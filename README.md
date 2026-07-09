<p align="center">
  <img src="assets/bnature-logo.jpg" alt="Beehive Nature mandala — purple through blue to a green center" width="220">
</p>

# 🐝 Beehive Nature Reserve Kernel

*A coordination core for private, honest commerce — a small, unmoving heart with everything else swappable around it.*

[![tests](https://github.com/beehive-nature/beehive-nature/actions/workflows/tests.yml/badge.svg)](https://github.com/beehive-nature/beehive-nature/actions/workflows/tests.yml)
[![secret-scan](https://github.com/beehive-nature/beehive-nature/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/beehive-nature/beehive-nature/actions/workflows/secret-scan.yml)
[![license: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](./LICENSE)

It lets two strangers complete a trade without trusting each other or a
middleman: the payment waits in a Zano escrow that only a **Trezor** can
co-sign to release, disputes are settled on evidence, and standing is earned
by acting well — never bought.

That's one application of a general shape. The kernel is a **coordination core
in Rust** that knows almost nothing on purpose — identity, settlement, escrow,
disputes, reputation, and one canonical event log — with everything specific
plugged in around it: **chains enter as adapters, applications as dApps, whole
self-governing communities on top**, none of which the core has to understand.
Swap Zano for another settlement chain, add a marketplace or a festival
economy, and the heart doesn't change. The first community built on it,
[**skaists**](https://github.com/skaists/LOVErnment-DAO), consumes this repo as
a pinned dependency — never a fork.

> **Status — honest by policy.** Cryptographic design source-confirmed; wire
> contract frozen (proto v0.3); host-side Zano derivation **proven against
> stock Zano** — *reproducible*: run `cargo test -p chain-zano` (committed
> vector, `src/testvec.rs`). Firmware and legal review are the unstarted work
> between here and anything a user touches. The ledger that never rounds up:
> [`STATUS.md`](./STATUS.md).

## The one rule everything depends on

**The Zano spend secret `s` never exists in host RAM.** It is derived and used
only inside the Trezor firmware; the host is an untrusted coordinator that
handles public ring data and receives public signature outputs. Any code or flow
that puts `s` on the host is a bug, not a feature.

Corollary for this repo: **never commit a real spend secret.** The `#[ignore]`d
compatibility test needs a `(spend_secret -> public_key)` vector — use a
**dedicated throwaway testnet key**, treat it as burned, and prefer keeping it
out of version control (see `.gitignore`). The secret-scan hook and CI enforce
this on every commit and push.

## What's in here

Fourteen crates over one event bus. `cargo test --workspace` →
**180 passed / 0 failed / 1 ignored** (the ignored test is the firmware-gated
`slip0010` end-to-end, and says so). The kernel is deliberately layered:

- **Settlement & escrow** — `escrow-core` (the state machine + funding check),
  `escrow-engine` (the bus consumer that drives it), `dro-signer`
  (settlement-intent authority + hardware-signer seam)
- **Disputes & reputation** — `dispute-engine` (provenance-weighted; popularity
  never auto-enforces), `reputation-engine` (emergent and earned — never a
  single written score)
- **Chains, ingest & schema** — `chain-zano` (host-side derivation + firmware
  spec; `view.rs` is host-safe, `keys.rs`/`slip0010.rs` are firmware-spec and
  never run on the host), `chain-eos`, `zano-watcher`, `normalizer`,
  `event-bus`, `shared-types` (the canonical `CanonicalEvent` schema)
- **Adapters & runtime** — `adapter-carrier`, `adapter-arweave`, `composition`
  (the daemon that wires ingest → bus → escrow → settlement → reputation)

The wire contract lives in [`proto/messages-zano.proto`](./proto) (frozen,
v0.3); the architecture and firmware plan in [`docs/architecture/`](./docs/architecture).
The **Trezor firmware app** (the on-device `CLSAG_GGX` implementation) is a
separate future effort — a fork of `trezor-firmware` — and does not live here.
This repo is the host side.

## Quickstart

```bash
git config core.hooksPath .githooks   # one-time per clone: local secret-scan hook (CI re-runs the same scan on every push)
# Windows/GNU toolchain note: crates using raw-dylib (tokio deps) need full
# mingw binutils. WinLibs is installed via winget; put its bin dir and
# ~/.cargo/bin on PATH (neither is added automatically):
#   $LOCALAPPDATA/Microsoft/WinGet/Packages/BrechtSanders.WinLibs.POSIX.UCRT_*/mingw64/bin
cargo test --workspace       # 180 passed / 0 failed / 1 ignored
cargo test -p chain-zano     # the stock-Zano derivation proof (committed vector)
```

The `chain-zano` vector is what converts "compiles" to "proven
Zano-compatible." The single `--ignored` test is the `slip0010` end-to-end,
gated on the firmware track. See `STATUS.md` for exactly what each tier of
evidence means.

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
   **`180 passed; 1 ignored`** (the ignored test is the firmware-gated
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
