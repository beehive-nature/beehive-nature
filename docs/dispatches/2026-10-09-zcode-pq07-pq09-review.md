# 2026-10-09 — zCode Max-effort review: PQ07 succession handover, PQ09 sealed keys; F-1 withdrawn by reproduction

zCode seat, second assignment (founder order 2026-10-09: close out 87c744810's
CI, then review PQ07/PQ09 at Max effort; #370 runner-recovery stays closed;
housekeeping must not displace the key-lifecycle review). Review artifacts in
`../wt-zcode-pq-review`; no author working tree touched.

## 1 · Closeout of 87c744810 (execution receipts, no assurances)

All eight workflows on `87c744810` completed **success**: bTunGsTeN PQ
(37896437672), bTunGsTeN PQ SAW (37896437702), WB001 SAW proofs
(37896437695), tests (37896437550), WB002 WASM corpus (37896437557), WB002
SAW equivalence (37896437697), secret-scan (37896437694),
pages-build-deployment (37896436918). The two that were in flight at my last
report finished green. The earlier sentence "a docs-only change cannot fail
CI" is struck from the record: the conclusions above are the receipts, nothing
else.

## 2 · Scope and SHAs

- Current main pinned at review time: `87c744810` (unchanged since my
  dispatch; no new commits during the review).
- Landing commits reviewed: PQ09 `70823e1f7` (bsigner keys sealed at rest),
  PQ07 `6a114df91` (SLH-DSA succession twin + handover v1).
- Implementation, tests and conclusions below are bound to **main
  `87c744810`**, where I read and executed everything. The post-landing
  deltas in the same files (PQ03 `b57c73921`: context rule, bpq-core label
  indirection, one type alias in keys.rs) were read as part of the main
  state, not assumed.

## 3 · PQ07 — succession key twin and handover v1 (confirmed, no defects)

**Derivation twin.** `bpq::succession_keys`
(`crates/bsigner/src/bpq.rs:355-375`): HKDF-Expand of the frozen
`BDID-v1/slh-dsa-shake-256f-succession` label to 96 bytes under the
context rule, split (SK.seed ‖ SK.prf ‖ PK.seed), fips205 0.4.1
`keygen_with_seeds`. The reserved context `root` is refused; non-printable,
over-long and empty contexts refuse for both `keys` and `succession_keys`
(`contexts_outside_the_rule_derive_nothing`). Cross-checked against the
browser on every `surfaces/bpq-vectors.json` row (3 rows, each with the full
`slhPublicKey`): commitment, public key and id all match — and fips205 0.4.1
is the exact crate+set PQ01 validated against all ACVP SLH-DSA-SHAKE-256f
cases, so the twin rests on the official vectors too. Label-domain
injectivity is PQ03's SAW proof (btungsten PQ SAW job green on 87c744810);
I did not re-verify SAW — that is PQ03's lane receipt, cited, not mine.

**Handover statement and verifier.** `handover`/`verify_handover`
(`bpq.rs:455-531`). The signed bytes are `"bpq1/handover" ‖
SHA3-256(from ‖ "\n" ‖ to ‖ "\n" ‖ at)`. I checked the delimiter-injection
class: over inputs the verifier accepts, the concatenation is injective —
`from` must equal `id_from(dsa, SHA3-256("bpq1/succession" ‖ slh))`
(bech32m by recomputation), `to` must equal the verified card's recomputed
id (same), and `at` is pinned to `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?Z$`
(no `\n` possible). The verifier enforces each of these plus `to ≠ from`
and the SLH signature under `slh`. A forger holding only the old ML-DSA key
must find an `slh` key whose commitment hashes to the victim's published
commitment — a SHA3-256 preimage; sound by construction, not proven.

**Signing semantics.** `try_sign(&msg, &[], true)` — confirmed in the
vendored fips205 0.4.1 source (`traits.rs:221` delegates to
`try_sign_with_rng(OsRng, …)`; `lib.rs` builds the pure message
representative `[0, |ctx|, ctx, m]`): hedged, pure, empty context, exactly
SPEC-BPQ-1 §5's wording, on the paths PQ01's hedged/deterministic ACVP
vectors exercised.

**Executed receipts at 87c744810.** `cargo test --locked -p bsigner`:
66/66 in 4.7 s. `node --test e2e/bpq.test.mjs`: 20/20 (includes the
Rust-sealed pin opening in `surfaces/bpq.js`, e2e line 393). CLI round trip
with the nerve lane's public TEST-ONLY recovery code:
`bsigner bpq-handover … --out h.json` then `bsigner bpq-verify --file h.json`
→ verified true, exit 0; a swapped `to` and a moved `at` each → verified
false, exit 1. The unit forgery battery (`a_handover_verifies_and_its_forgeries_do_not`)
covers ten refusal classes including the attacker-SLH-under-victim-id shape,
the swapped card, the cross-id replay, the smuggled newline in `at`, the
empty shapes, self-handover and the reserved context.

**Boundary, documented not defected:** a handover is a statement, not a
state (SPEC-BPQ-1 §5); refusing a second handover from a spent succession
key is the log-keeper's job, and no log or browser verifier exists yet — the
spec says so. Recorded as N-3 below with that ownership.

## 4 · PQ09 — bSiGner keys sealed at rest (confirmed, no defects)

**Format.** A seed reaches disk only inside a SPEC-BPQ-1 §4 sealed object:
one `self` slot under the root vault of the owner's recovery words
(`seal_self`, `bpq.rs:640-676`): fresh OS-entropy file key and 16-byte oid
per seal (asserted distinct), key commitment `kc`, wrap
`AES-256-GCM(HKDF-SHA256(vault, salt=oid, "bpq1/wrap/self"), 0¹², Kf, AAD)`.
`keys.rs` writes via temp+rename; the temp file carries sealed content only.

**Refusals and gates, each executed or test-bound at 87c744810.**
- `bheart.keyset/1` plaintext is refused everywhere with a pointer to
  `keys-seal` (`read_keyset`); `keys-seal` is the only plaintext-reading
  path; resealing leaves no plaintext seed on disk and a second seal errors.
- Wrong recovery words and a tampered sealed body open nothing (AEAD
  authentication; `the_wrong_words_or_a_tampered_file_open_nothing`).
- `verify` reads the public half with no vault (`load_dsa_public`).
- `x402pay` runs the whole gate before the recovery code is even read from
  the environment — stronger than the commit's claim ("unlocks only after
  the gate says yes"): no env read, no derive, no unlock before the gate.
- `--rec-env` only: no argv flag for the code exists; env value taken into
  `Zeroizing` at every entry point.
- `no_seed_byte_reaches_disk` scans every file in the keys dir for the seed
  raw, base64url and hex, asserts no stray temp file, and proves the scan
  would convict by planting a plaintext canary. `keygen_output_carries_no_seed`
  and `listing_shows_no_secrets` hold the never-printed law.

**Executed receipts at 87c744810.** bsigner 66/66; e2e bpq 20/20; nerve test
7/7 through sealed keys (`SETTLE_BSIGNER_BIN=… node --test
tools/bpay-settle/bsigner-nerve.test.mjs`; TEST-ONLY public code, documented);
law-signature Rust check 7/7 current + its TEETH refusal
(`scripts/verify-law-signatures-rust.sh`, built release binary).

**Notes (not defects), for the PQ09 owner's next touch:**
- **N-1 (low, robustness):** `seal_plaintext` reseals `seed_b64u` without
  cross-checking that the seed derives the recorded public key. Downstream
  is fail-closed (signatures from a mismatched seed fail verification under
  the recorded public key), so this catches corruption, not an attacker.
  Smallest repair if taken: derive the public half from the seed during
  reseal and require equality; regression: a legacy file with a swapped
  seed must refuse to seal.
- **N-2 (inherited design, no action):** the vault key is
  HKDF-SHA256(masterPrk) with no memory-hard KDF, so offline guessing costs
  ~microseconds per try; security rests entirely on the recovery code's
  256-bit entropy. This is SPEC-BPQ-1's founder-ruled frozen design
  (2026-10-04), not a PQ09 regression; recorded so the boundary is visible.
- A crash between temp-write and rename leaves `*.json.tmp` with
  sealed-only content (no plaintext path); noted, no action.

## 5 · Follow-up ledger from the PQ00/PQ01 audit

- **F-1 — WITHDRAWN by reproduction (my error, named).** I had claimed a
  dev-only vortex dependency would escape the absence gate because it runs
  `cargo tree --locked -e normal --workspace -i vortex`. Reproduced in
  isolated throwaway workspaces, single-crate and member-of-workspace, with
  lockfiles present:
  - member `[dev-dependencies] anyhow]`: gate form exits **0** ("nothing to
    print") → the script's `if TREE=$(…)` branch fires → job RED. Detected.
  - `[target.'cfg(windows)'.dev-dependencies] anyhow]` probed on a **linux**
    host (WSL cargo): gate form still exits 0 → detected. The package-ID
    resolution sees dev and target-gated dependencies regardless of the
    `-e normal` display filter; the exit-code-first gate design is sound in
    every cell I could construct. No repair; the `-e normal,dev` suggestion
    from the previous dispatch is retracted as unnecessary.
- **F-2 — carried, unchanged.** `mlkem.rs flip()` indexes `v[0]` unguarded;
  unreachable for the pinned ACVP files (every flipped input is non-empty),
  and a panic fails the run rather than passing it. The pinned-input
  limitation stays explicit: the guard holds for the hash-pinned vector set,
  not for arbitrary inputs.
- **F-3 — carried, still UNVERIFIED.** The README's RustSec IDs were
  hand-read from the advisory db; I have produced no advisory-check receipt,
  so the conclusion stays UNVERIFIED per the corrective-receipt discipline.
  What would settle it: `cargo install cargo-audit` then `cargo audit
  --file Cargo.lock` on 87c744810, receipt attached.

## 6 · Second zCode session: not warranted yet

No ready, non-overlapping review package exists at `87c744810`: no Lane B
measurement evidence has landed (the eight commits since 2e8d2097 are all
btungsten PQ lanes), and a cross-lane compatibility sweep has nothing to
sweep until both build sessions land their next changes (shared interfaces:
receipt schemas, `Cargo.lock`, bSigner's contract). Recorded triggers, so
the founder can pull the trigger with one line when either fires:
- **Package "lane-b-measurements"**: fires when a Lane B commit lands
  executable benchmark/evidence artifacts. Scope: specimen-to-shipped
  binding, Swanky assumptions, result validation, receipt provenance,
  measurement reproducibility. Reproduction: the lane's own runners, pinned
  at its landing SHA, serialized on one machine.
- **Package "cross-lane-compat"**: fires when both lanes have landed since
  their last review. Scope: canonical receipt bytes, suite ids, proof public
  inputs, toolchain pins, `Cargo.lock` conflicts. Reproduction: both lanes'
  CI receipts at their SHAs plus a workspace-wide `cargo check --locked`.

## 7 · Verdict and next owners

PQ07 and PQ09 land their claims: every load-bearing statement in both
commit messages reproduced under execution at main `87c744810`, the
handover's domain separation is injective over accepted inputs by
construction, and the at-rest law holds mechanically (scan-convicted
canary, wrong-words and tamper refusals). No confirmed defects; N-1 is the
only repair-worthy item and it is optional and fail-closed as-is.

- N-1: PQ09 owner, next touch of `keys.rs` (or drop with a note).
- N-3 (handover log-keeper): unowned by design until a log exists.
- F-3: any seat that installs cargo-audit; one command + receipt.
- Next zCode beat: PQ03's SAW injectivity proof is cited-not-verified by
  this seat; PQ10's Plonky3 receipt statement (11d25f4bd and its tungsten-2
  preregistration line) is the next unaudited key-boundary artifact on
  main. Priority order between them is the founder's; default is
  newest-first (PQ10).

HUMAN INTERACTION: NONE. NEXT OWNER: zCode seat (PQ10 or PQ03-verify,
founder's call on order; default PQ10).
