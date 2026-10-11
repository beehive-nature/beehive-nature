# 2026-10-09 — zCode independent review: bTunGsTeN PQ00/PQ01 at 2e8d2097

zCode seat (GLM-5.3), first assignment of the independent-review role the
founder seated 2026-10-09: audit the landed PQ01 coverage and PQ00
controls at commit `2e8d2097` ("btungsten PQ01: every NIST vector for
every PQ parameter set we expose"). Review artifacts live in my own
worktree `../wt-zcode-pq-review`; no author working tree was touched.

## Evidence

- Base SHA `2e8d2097^`, reviewed head `2e8d2097`. Current main
  `b57c73921` checked for drift: the eight commits in between (PQ03,
  PQ07, PQ08, PQ09, PQ10 ×3, tungsten-2) touch none of
  `crates/btungsten-pq`, `crates/btungsten-teeth`,
  `.github/workflows/btungsten-pq.yml` or `Cargo.lock`; only
  `scripts/btungsten/README.md` grew. Every finding below is current at
  main HEAD.
- CI receipts, pulled and read as raw logs, not summaries: run
  37875751793, headSha verified `= 2e8d2097`, jobs pq01-vectors
  (113643835386) and pq00-teeth (113643835190). The PQ01 summary line is
  verbatim "2729 executed, 2729 passed, 0 failed; 86 required rows, 0
  missing; 0 load errors". This run had a cold vector cache
  ("Cache not found for input keys: pq-vectors-…"), so the 20 files were
  fetched fresh from ACVP-Server `975de31eb83d` and hash-checked on that
  fetch.
- Local reproduction on this box (Windows x86_64, Git-for-Windows):
  `cargo build --locked --release -p btungsten-pq --bin pq-kat` (3m41s),
  then a cold-cache run — exit 0, summary byte-identical to CI: 2,729 /
  2,729 / 0; 86 rows, 0 missing; 0 load errors. A different platform
  than CI's ubuntu-24.04 runner reproduces the whole battery.
- Independent case-level recount (method below): all 313 output rows of
  the local run reproduced from the vector files' own bytes with counts
  identical, and all 3,018 file cases accounted for as executed or
  explicitly NOT RUN.
- Files inspected: `crates/btungsten-pq/src/{acvp.rs, bin/pq-kat.rs,
  report.rs, mlkem.rs, mldsa.rs, slhdsa.rs}`, `kat-manifest.json`,
  `Cargo.toml`; `crates/btungsten-teeth/src/lib.rs`;
  `scripts/btungsten/pq00-teeth-vortex.sh`,
  `scripts/btungsten/teeth-vortex/pq00_teeth.rs`;
  `.github/workflows/btungsten-pq.yml`; production call sites
  `crates/bsigner/src/alg.rs` and `crates/bsigner/Cargo.toml`;
  `Cargo.lock` version pins; `surfaces/pq-kat.json` +
  `scripts/build-pq-kat.mjs` + `.github/workflows/tests.yml` (the old
  17-case lane); `surfaces/stack.html` rider; `scripts/btungsten/README.md`.

## The seven determinations

1. **Vector hashes and sizes enforced on every load — YES.**
   `Manifest::load` (`crates/btungsten-pq/src/acvp.rs:64-98`) verifies
   length and SHA-256 on the cache read (line 69-71); a cache miss or
   failed check falls through to fetch, verify, rename — and fetched
   bytes that fail the check are an error (line 86-92), never a skip.
   The CI cache-restore path therefore re-verifies on use, as the
   workflow comment claims. The hand-rolled base64url tag encoder is
   pinned to the published SHA-256 digests of `""` and `"abc"`
   (`acvp.rs:189-199`), so both digest and encoding are checked. The
   manifest names a full 40-hex commit and every file once (unit tests
   `acvp.rs:201-241`), and the eight files shared with the old
   `surfaces/pq-kat.json` pin are held to identical digests by
   `manifest_agrees_with_the_pq_kat_source_list` — the two pins cannot
   drift. I re-ran `node scripts/build-pq-kat.mjs`: byte-identical
   output, and `tests.yml:120` still runs `e2e/pq-kat.test.mjs`.

2. **Dispatch cannot silently omit or misclassify — CONFIRMED, two ways.**
   Structurally: the prompt/expected join refuses missing answers,
   group-count mismatches and empty groups (`acvp.rs:135-182`); the
   adapters panic on any unknown interface, mode, function or parameter
   set (`mldsa.rs:194,218,323`; `mlkem.rs:153,199`; `slhdsa.rs:155,226`);
   every remaining branch either records or emits NOT RUN with a reason.
   Numerically: I re-enumerated all 3,018 cases from the hash-verified
   files with an independent script applying the dispatch rules as read
   from the source, and diffed against the run's own 313 rows —
   identical row set, identical counts. 2,729 = 2,592 case executions +
   137 TEETH controls; the remaining impl-slots are exactly the 57 NOT
   RUN groups (pre-hash, external-μ availability, eleven unused SLH
   sets). Exit 0 additionally requires zero failures, zero missing
   required rows, zero load errors and executed > 0 (`pq-kat.rs:130`).

3. **Required-row inventory matches what BNR exposes — YES.**
   `crates/bsigner/src/alg.rs` enumerates exactly MlDsa44/65/87 and
   MlKem512/768/1024; the 86 rows are 3×5×2 (ML-KEM, incl. both key
   checks) + 3×7×2 (ML-DSA) + 1×7×2 (SLH-DSA-SHAKE-256f). Note the gate
   itself checks "≥1 case per row"; what actually ran is stronger —
   every case of every executed group (row counts equal file group
   sizes). At the review SHA no Rust SLH-DSA shipped (honestly stated in
   `slhdsa.rs:1-8`); PQ07 (`6a114df91`, two hours later) made
   SLH-DSA-SHAKE-256f production in bsigner via `fips205 =0.4.1,
   features=["…slh_dsa_shake_256f"]` — the same crate version and the
   same parameter set PQ01 validated, so the coverage claim became
   strictly stronger at main HEAD, not weaker.

4. **Every exclusion accurate and visible — YES.** All 57 NOT RUN keys
   print with reasons. Verified per class: pre-hash groups are unused by
   the estate; libcrux-ml-dsa exposes no external-μ interface
   (`sign_mu_det: None`, `mldsa.rs:148`); RustCrypto's μ-signing
   randomness comes only from an RNG so hedged μ *signing* is skipped
   (`mldsa.rs:273-277`) while μ *verification* correctly still runs
   (`verify_mu: Some`, `mldsa.rs:99`); the eleven other SLH-DSA sets are
   named in the NOT RUN line itself (`slhdsa.rs:239-245`). The README
   documents the same exclusions.

5. **Negative controls exercise their claimed failure condition — YES.**
   137 TEETH rows, one per (group, implementation): one flipped byte of
   the primary input (seed, message, μ, ciphertext, m, d, skSeed) must
   change the answer or be refused; sigVer teeth apply only where the
   honest signature verifies (`mldsa.rs:320`, `slhdsa.rs:223`). All 137
   held in CI and in my local run. PQ00: T-VACUOUS convicted vortex
   `verify()` on both degenerate shapes — including the zero-openings
   proof carrying a FALSE evaluation claim — and T-TRUNCATE convicted
   `RSis::hash()` with a printed colliding pair at len 257 / position
   256 (log lines verbatim in job 113643835190). The teeth templates
   themselves distinguish Convicted from Miswired, carry positive
   controls, and refuse vacuous invocations (`btungsten-teeth/src/lib.rs`).

6. **Tested dependencies correspond to production — YES, two scope
   notes.** `Cargo.lock` holds exactly one version of each: ml-kem
   0.3.2, ml-dsa 0.1.1 (what bsigner links, `crates/bsigner/Cargo.toml`),
   libcrux-ml-kem/ml-dsa 0.0.11, slh-dsa 0.2.0-rc.5, fips205 0.4.1; CI
   builds `--locked` everywhere. Scope notes, not defects: (a) feature
   sets differ — bsigner compiles getrandom/zeroize, the harness hazmat
   — same crate code, and the KATs drive the deterministic primitives
   directly; (b) the README's RustSec audit was read from the db without
   cargo-audit (none installed on my box either): the IDs are UNVERIFIED
   by me, though the resolved versions sit at or above every cited
   patched floor per the lock.

7. **Vortex remains an isolated specimen — YES.** The build copy lives
   under `target/pq00-vortex` with its own empty `[workspace]` (the
   CI-path fix in this very commit), vortex source unedited — the
   overlay appends one child-module line, the dev-dependency and the
   workspace table (`pq00-teeth-vortex.sh:46-51`), with a guard if the
   pinned Cargo.toml ever grows its own dev-dependencies table. Gate 1
   accepts only cargo's own "did not match any packages" refusal as
   evidence of absence. No workspace member manifest references vortex
   in any edge kind (grep across `crates/*/Cargo.toml`).

## Findings ledger

No confirmed defects. Three items, none blocking, all owned by the PQ
lane that next touches the file:

- **F-1 (low, hardening; PQ00 owner):** gate 1 runs
  `cargo tree --locked -e normal --workspace -i vortex`
  (`pq00-teeth-vortex.sh:67`) — normal edges only, so a hypothetical
  `[dev-dependencies] vortex` in a member would not trip it. Today no
  member has one (verified), and dev-deps never ship; the smallest
  repair is `-e normal,dev` with the same refusal-only acceptance.
- **F-2 (note; PQ01 owner):** `mlkem.rs:157-161` `flip()` indexes
  `v[0]` unguarded while the mldsa/slhdsa copies handle empty input.
  Unreachable for the pinned files (d/z/m/ek/c are never empty), and a
  panic would fail the run rather than pass it — consistency only.
- **F-3 (UNVERIFIED; either seat with tooling appetite):** the RustSec
  IDs in `scripts/btungsten/README.md` were read from the advisory db by
  hand. A `cargo-audit` step in the workflow would turn that paragraph
  into a receipt; resolved versions already sit above the cited floors.

## What the counts establish — and their boundary

Executed and passed: both implementations (RustCrypto as linked by
bsigner, and libcrux/fips205 as independents) agree with NIST's expected
answers for every executed case at the pinned ACVP-Server snapshot, on
two platforms (CI ubuntu, this Windows box), with vectors bound by size
and digest. Not established by these counts, consistent with the stated
exclusions: pre-hash variants, external-μ where no interface exists,
eleven unused SLH-DSA sets; timing/constant-time behavior (functional
KATs only — the ml-dsa timing advisory class is exactly this gap);
production RNG wiring; and the tr1 transition drafts beyond what ran.
Wording capped per the citation law: the harness is sound by
construction against silent omission; the implementations are exercised,
not proven.

## Method of the independent recount (reproducible)

A throwaway script in the review worktree (not committed; the estate's
rule is Rust for anything that becomes BNR test code, and this was a
one-off cross-check): re-verify each file against `kat-manifest.json`
with SHA-256/base64url, join prompt↔expected by tgId/tcId preserving
file order, apply the dispatch rules as read from the three adapters,
and emit one line per (row, implementation) including TEETH rows.
`diff` against the run's 313 lines: empty. Two model corrections were
needed on my side before it reconciled — both were my errors, not the
runner's (μ-verification needs no randomness and runs; teeth-on-sigVer
follows the first case's testPassed), which is itself a small
confirmation that the runner's rules are the subtle-but-correct ones.

## Next owners

- F-1/F-2/F-3: the PQ-program seat at its next touch of the named
  files; no lane is blocked on them.
- Per the founder's second-look list, PQ07 (succession-key twin +
  handover) and PQ09 (bSiGner keys sealed at rest under recovery words)
  land exactly in the key-lifecycle class that gets a fresh zCode review
  at Max effort — that is this seat's next beat, on current main.
- PQ10 tungsten-2 preregistration/amends: tracked, no zCode action yet.

HUMAN INTERACTION: NONE. NEXT OWNER: zCode seat (PQ07/PQ09 review).
