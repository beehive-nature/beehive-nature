# Solana tungsten: local proof boundary, no settlement claim

Serves BNRoSe Charter L2 (job identity) and L3 (compute evidence). Built from
`origin/main` at `fd423f3fa` in the owned `../wt-codex-solana-tungsten`
worktree, branch `codex/solana-tungsten-2026-10-03`. Shared checkout untouched.

The founder selected **Build the smallest local experiment**. The result lives
in `tools/solana-tungsten/`: a real Rust Groth16 proof for a square job, the
pinned Solana verifier's host path, a second arkworks reference verifier,
bounded local authority, and the existing INVOICE-1 / RECON-1 reconciliation.
The measured conclusion is **OPEN**, with zero value movement.

## The architecture result

The same job and proof produce equal local observation envelopes after changing
only the proof-adapter and dry-run rail labels. Job identity, recipient, assets,
amount, fee, commitment, output and key hash stay the same. An authorization
cannot be used twice in one local ledger, even across rail labels or with newly
generated valid proof bytes. A proof for a different recipient verifies as a
computation and is refused as an authorization. Proof validity is not spending
authority.

The real verifier calls are `tools/solana-tungsten/src/lib.rs:SolanaHost::verify`
and `ArkworksHost::verify`; the statement is `SquareJob::generate_constraints`;
the authority checks are `LocalGate::plan`. Upstream dependency pin:
`solana-program/groth16-verifier-program@8bd06b4fb07f636c1872993a99f1a296b23b69fa`.
`Worker::new` makes an ephemeral single-party setup. No production setup or
cryptographic audit claim. Both host paths share arkworks ancestry.

The proposed Vaulta comparison needed correction. The current route uses
`contracts/privacy/payment.circom`, `note.cpp:payment_gate` and `plonk_verify.hpp:plonk_verify`,
following `SPEC-PRIVACY-1` M2 ruling and M4/M7 implementation. It does not prove
this square job. The experiment reports `Vaulta same-job proof adapter not
implemented`; it never calls the arkworks reference result a Vaulta result.

## Acceptance receipts

Measured on Windows using Git-for-Windows, Cargo/rustc 1.98.1:

| Command | Result |
| --- | --- |
| `cargo test --locked --manifest-path tools/solana-tungsten/Cargo.toml` | 8 passed, 0 failed, 0 ignored; boundary tests 2.22 s; exit 0 |
| `node tools/solana-tungsten/run.mjs` | Envelope equality asserted; RECON-1 OPEN asserted; exit 0 |
| `cargo clippy --locked --manifest-path tools/solana-tungsten/Cargo.toml --all-targets -- -D warnings` | Pass, exit 0 |
| `cargo fmt --manifest-path tools/solana-tungsten/Cargo.toml --check` | Pass, exit 0 |

The eight tests exercise real proof verification and serialization; all ten job
fields altered individually; a valid unauthorized-recipient proof; different
proof bytes replayed across rail labels; amount, fee, expiry and rail refusal;
forged/truncated/wrong-output proofs without consumption; wrong key and
unsupported Vaulta refusal; and maximum-u32 worker input without u64 overflow.
The local output is `tools/solana-tungsten/observation.local.json` (ignored;
rerun the command to reproduce the observation with a fresh ephemeral setup).

Build failures were repaired before the passing run. Initial compiler output:
`error[E0432]: unresolved import ark_relations::r1cs` and
`no OsRng in rngs`; arkworks 0.6 uses `gr1cs`, and the explicit rand dependency
enables OS randomness. The next compile reported
`error[E0277]: expected an FnOnce() closure, found LinearCombination`;
`enforce_r1cs_constraint` now receives closures as required by that version.

The hook installer refused with:
`install-hooks: REFUSING - .../.githooks/pre-commit exists and was not written by this installer`.
Inspection found the active custom hook already delegates to
`scripts/secret-scan.sh diff` and `scripts/identity-check.sh`; preserved it.
`e2e/hooks-installed.test.sh` exited 0, but its advertised refusal arm printed
`nothing added to commit`. That arm is not evidence of secret blocking; no such
claim is made. The lane does not repair unrelated hook-test code.

## Upstream priority checked before building

Read the current #622, #504 and #505 discussions through GitHub, not merely their
closed badges. David's [2026-09-30 #622 reply](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
moves outstanding work **back to #504**. His
[current #504 order](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5906795696)
keeps S1 unicast caps/DM hedges, S3 consume-only Leaves, then S4 enforced
shedding with revocation exemptions; each must pass E-D17 delivered/published
acceptance. Per-pair counters and timing remain material. No mesh change or new
capture was performed by this lane.

#505 has explicit [field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210)
from David on 2026-09-15 for the OCI fragment-filtering rerun. That is upstream
accepted evidence, not a new independent host measurement here. The old
September 10 handoff's tracker/blocked descriptions are historical.

## Unrun boundaries

Solana SBF/on-chain verification, actual Vaulta same-job verification, x0x
transport, production authorization, durable replay protection, settlement and
finality are **UNVERIFIED by this lane**. Dry-run rail labels do not implement
settlement adapters. The runner has no network client or spending key and
creates no payment receipt. The README lists the concrete steps to extend it.
The standalone Cargo workspace leaves the kernel manifest/lockfile and privacy
contracts unchanged. A path-filtered CI workflow covers the experiment; its
remote result is separate from these local receipts.
