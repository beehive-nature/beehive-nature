# bTunGsTeN PQ: execute the battery and reach x0x's implementations

Local execution on 2026-10-14, x86_64 Linux. BNR baseline `25258d564`
(descendant of the reviewed `7e653693ca`); x0x **v0.48.0 at `32bf552808`**.
This is fresh execution, not a repository-only review. Full-system
qualification remains **UNESTABLISHED**.

## What changed

`crates/btungsten-x0x-pq` is an isolated test workspace, not a runtime
dependency. It tests the exact **saorsa-pqc 0.5.1 / fips203 0.4.3 /
fips204 0.4.6** implementations in the reviewed x0x lock. Its inventory binds
the x0x source snapshots, implementation checksums, SHA/RNG dependency pins,
parameter sets, selected call sites, executed evidence classes and gaps.

PQ01's existing official-vector gates now accept explicitly named test
adapters without changing the existing default RustCrypto/libcrux battery.
`Report::json` retains result classes, implementation names, counts,
failures and NOT RUN reasons. The new runner drives FIPS203 ML-KEM-768 and
FIPS204 ML-DSA-65 through those gates, then tests the real Saorsa API and
legacy signing wrappers. The wrappers' hardcoded OsRng means their signing
and encapsulation comparisons are **DIFFERENTIAL**, not deterministic KAT.
The supplied-randomness KAT runs on the underlying pinned FIPS crates.

`scripts/btungsten/x0x-pq-check.py` verifies source/dependency pins, builds
with `--locked`, runs the battery, convicts an altered expected public-key
byte, refuses an empty coverage run, and executes both dependency audit
gates. The PQ workflow runs the same command as a separate job and uploads
its receipts even on failure. No surface or deployed node changed.

## Fresh results

The x0x-specific lane: **752 executed, 752 passed, zero failures;
37 required rows, zero missing**. By class: **515 KAT, 164 DIFFERENTIAL,
73 TEETH**. Controls: the altered expected byte produces **two real
failures** with no load error or missing row; the empty run executes zero
cases and refuses **all 37** missing obligations. Both fail with native
exit 1, as the controller requires. Changing a KEM ciphertext returns a
different shared secret (implicit rejection), not an expected error.

The complete existing PQ01 runner was rebuilt and rerun after the shared
harness changes: **2,729/2,729**, all **86/86** required rows present, zero
load errors. PQ00 convicted both zero-opening verifier shapes and the
suffix-hash collision against the pinned Vortex specimen; Vortex remains
absent from BNR's default build.

Also executed: 1,485 Rust classical-vector checks and 27 browser checks;
the three X-Wing draft vectors on both implementations; 7/7 current law
signatures on both implementations and the changed-file refusal control;
the pinned BIP-341/BIP-174/BIP-371 cases, including the 20 Taproot teeth;
the authorized 2-of-3 FROST test and its refusal cases, plus ChillDKG's 64
upstream tests; 32 browser PQ/sealing/authorization tests; and Plonky3's
native tests, forgery battery and both true claims at n=64, 1024 and 16384.
The preregistered LEAK studies were not rerun.

x0x itself was built with its pinned **Rust 1.95.0** and unmodified lock:
**12/12** group KEM/AEAD tests, **11/11** upgrade-signature tests, and
**68/68** identity/certificate/introduction tests passed (**91/91**, zero
skipped). The selectors were inspected as inert local crypto/serialization/
temporary-file tests, so they meet AGENTS.md's inert-selector exception.
The full 4,547-test x0x suite and public mesh were not run.

BNR and the standalone lane used **Rust 1.98.1**. Rust unit suites,
formatting, the new lane's clippy with `-D warnings`, and installed-hook
positive/refusal controls passed. Receipts bind the final Rust/Python source
hashes and lock, not just the checkout's baseline commit.

## Formal replay and boundaries

Ten fresh BNR SAW lanes completed: derivation, byte layouts, BIP-39,
X-Wing glue, SHA-256's software path, HKDF, base fields, both shipped Keccak
permutations, and both SHA-3 sponge versions. Their pin/build/spec/equivalence/
property/teeth results and assumptions remain separate in the retained logs.
The toolchain is SAW 1.6 (release digest checked), mir-json at `8cbf9af1`,
and nightly-2026-03-21 with translated standard libraries.

The two complete transform replays are pending in CI. The first local
workers stopped without completion receipts; no OOM kill was recorded and
the cause is UNVERIFIED. A second local replay printed all 15 ML-DSA
equivalence obligations PROVEN, but environment reattachment coincided with
loss of both workers and execution cell 4 before the controls completed.
Both local attempts remain INCONCLUSIVE as complete lanes. Their transcripts
are retained; completed equivalence results are not promoted into missing
teeth results. The hosted SAW run is `38598493065` at `e246b7954`.

The hosted PQ workflow `38598493201` at `e246b7954` completed successfully:
all seven jobs, including the new x0x lane. Its console prints the original
PQ01 **2,729/2,729** and classical **1,485/1,485 + 27/27** counts. The x0x
artifact download returned HTTP 403 at the storage endpoint, so its hosted
machine receipt was not independently retrieved here. The controller now
also prints each honest/control tally, coverage count and result-class count
to the CI console; its fresh local replay and source/log hash checks pass.

These BNR proofs are about BNR's actual pinned RustCrypto/glue functions,
under their stated domains and assumptions. They do not silently become
proofs of Saorsa's FIPS wrappers. The new lane does not complete the full
Cryptol comparison, FIPS/Saorsa L3-L5 proofs, entropy/failure assurance,
every crypto algorithm, call-site composition or transport handshake.
No ten-billion-user or full-system qualification is claimed.

## Dependency audit findings

The isolated lane's gate 1 passed: saorsa-pqc is absent from BNR's default
workspace. Gate 2 scanned **222** locked dependencies: **no vulnerabilities,
two maintenance warnings** (atomic-polyfill, proc-macro-error2). Nothing is
ignored. FROST also remains absent from bsigner's default graph.

The broader audited locks are not green:

- x0x's recorded application lock has **four rustls 0.23.45 advisories**:
  RUSTSEC-2026-0346/0347/0348/0349, plus five warnings. The normal dependency
  tree confirms paths through ant-quic and reqwest.
- BNR's recorded lock has **ten advisories**: five quinn-proto, four
  rustls, one rsa; three warnings. Six registry HTTP 503 errors also left
  part of the yanked-package lookup incomplete. Raw output is retained.

These inherited lock findings are recorded, not suppressed or repaired by
changing the implementation version under test.

## Evidence and upstream context

- `docs/receipts/x0x-pq-2026-10-14/`: honest, expected-byte and empty-run
  machine receipts; exact source inventory; build/unit/audit logs; runner
  receipt with source/lock/log hashes.
- `docs/receipts/pq-battery-2026-10-14/`: the broader native and formal
  execution outputs, app composition tests and full-lock audit findings.
- `crates/btungsten-x0x-pq/README.md`: repeatable command and exact coverage.

The first standalone controller attempts correctly failed at audit-tool
readiness/version checks; the pinned tool was installed and its version
probe corrected, then the complete controller passed. Those development
attempts remain under `/workspace/pq-artifacts/`, not merged into the final
positive receipt. The x0x release test compile completed; no test-run result
was inferred from a successful build alone.

Standing-law upstream check: read x0x #622 and #505, including current
comments. David's 2026-09-30 #622 comment returns Leaf egress to **#504**
under E-D6/E-D17's delivery matrix; the issue's closed badge does not retire
that work. #505's handshake-fragmentation half has David's 2026-09-15 field
acceptance. This PQ lane neither repeats nor replaces those field results.
No upstream message was sent.
