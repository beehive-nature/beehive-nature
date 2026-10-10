# 2026-10-09 — PQ proof batch closeout: evidence inventory and a pinned review package for zCode

PQ implementation seat (Seat 3, the bTunGsTeN PQ proof lanes), closeout
order relayed by the founder 2026-10-09: finish the current batch, open no
new primitive, inventory every claim, hand the independent reviewer a pinned
read-only package, verify process-tree memory containment, land through the
existing workflow.

**These results establish the named properties of the named implementations
under the recorded domains, build settings and assumptions. They do not
establish end-to-end security of the entire system.**

## 0 · Candidate, and how it got here

- **Candidate (proof code): `c631108baaccf9504b6105f4fff0bda00588499b`** on
  `btungsten-ci-scratch`. The review order named `ca9eba661` as the pushed
  candidate; before it arrived this seat had already pushed `c631108ba` (the
  sha3 0.11.0 sponge lane, one commit on top) and cancelled `ca9eba661`'s
  queued runs as superseded. Nothing further has been pushed onto the
  candidate's proof code since.
- **Exact-candidate CI, all eight workflows `success` on `c631108ba`:**
  bTunGsTeN PQ SAW 37985787272 (jobs `saw` 15 min, `saw-ntt` 44 min,
  `saw-ntt-dsa` 41 min), bTunGsTeN PQ 37985787357, tests 37985787356,
  WB001 SAW proofs 37985787448, WB002 SAW equivalence 37985787306, WB002
  WASM corpus 37985787311, bTunGsTeN RB 37985787305, secret-scan
  37985787379.
- Landing: this dispatch, the SPEC/README entries and two corrected
  comments ride one closeout commit on top of the candidate and a merge of
  main; it changes no proof obligation (docs and comments only, the diff
  shows it). main fast-forwards to it once its own CI is green; the
  receipt is recorded in the next dispatch, not assumed here.
- Batch = the first-parent commits `2014a067c..c631108ba`: `6d8f8a7b1`,
  `445de42bc`, `9031b3749` (PQ06 ML-DSA NTT and its docs), `65781f856`
  (merge of main), `e4a04bfcb` (README: two stale cargo-audit clauses
  deleted), `0ceca2f5b` (PQ02 loop), `2aeeec797` (PQ02 sponge, sha3
  0.10.9), `93e45027a` (PQ02 loop teeth made concrete, teeth capped),
  `ca9eba661` (PQ03 HKDF-Expand), `c631108ba` (PQ02 sponge, sha3 0.11.0).
- Kept OUT of the batch: `hkdf32` (HKDF-Extract then Expand, bsigner's
  `bpq::hkdf32`) was developed locally after the candidate; it sits on a
  local branch, unpushed, with its local result recorded in §5.
- rustls: PR #375 (rustls 0.23.42 to 0.23.45, RUSTSEC-2026-0285) was OPEN at
  this writing. The candidate still locks rustls 0.23.42; nothing here is
  described as inheriting that fix. Its owner is the rustls session; this
  seat merges main after #375 lands and re-reads gate 2 then.

## 1 · Evidence inventory

Status words: LOCAL = run on this box end to end; CI = a named CI run on a
named SHA; MAIN = an ancestor of origin/main (none of these rows is, at
this writing). "Every input" means every value
of the listed fixed-size arguments; no row claims other lengths.

| lane | implementation (pinned by Cargo.lock checksum) | domain | build / backend | assumed (mir_unsafe_assume_spec) | proof | negative controls | receipt | status |
|---|---|---|---|---|---|---|---|---|
| PQ06 ML-DSA NTT | ml-dsa 0.1.1, module-lattice 0.2.3 | every polynomial with coefficients < q = 8380417; NTT, every inverse layer, the product by 256^-1, ntt_inverse, multiply_ntt | debug MIR (cargo-saw-build test profile: overflow checks ON); portable code, no backend choice | `Elem` mul = `dsaMul` (see §2 A1) | `pq06-saw/ntt.saw`: 15 PROVEN against FIPS 204 Alg. 41, 42, 45 (`pq06-cryptol/DsaNtt.cry`) | bent twiddle (symbolic), dropped sign (symbolic): refuted | CI run 37969815052 (job `saw-ntt-dsa`) on `445de42bc`: 15 PROVEN in 1,472 s, TEETH 2 of 2; CI run 37985787272 on `c631108ba` (job `saw-ntt-dsa`): 15 PROVEN in 1,757 s, TEETH 2 of 2 | CI |
| PQ02 Keccak loop, keccak 0.1.6 | keccak 0.1.6 `p1600(s, 24)` (sha3 0.10's call) | every 1600-bit state | saw-rustc MIR of the extracted `.crate`; portable code (the aarch64 asm path is not compiled on x86_64) | none in `agree`; `composed` uses the 24 round proofs proven in the same file | `shipped.saw` `composed` = `keccakF` (round proofs standing in, `keccakRound` opaque); `agree.saw` `agree` = True, nothing standing in | order tooth (symbolic, 0.2.2); `agree_swapped` on the all-zero state (CONCRETE: one input, a sensitivity check, not a universal result) | CI run 37985787272 on `c631108ba` (job `saw`): the 24 round proofs with composed 108 s, agree 90 s, loop tooth refuted (earlier, run 37976780346 on `0ceca2f5b`: 92 s and 72 s, then lost its runner on the old symbolic tooth) | CI |
| PQ02 Keccak loop, keccak 0.2.2 | keccak 0.2.2 soft `keccak_p::<u64, 24>` | every state | harness compiles the pinned `.crate`'s soft.rs verbatim (`#[path]`); soft backend (x86_64, no `keccak_backend` cfg) | as above | `shipped022.saw` composed, `agree022.saw` agree | as above | CI run 37985787272 on `c631108ba`: the 24 round proofs with composed 23 s, agree 10 s, loop tooth and order tooth refuted | CI |
| PQ02 sponge, sha3 0.10.9 | sha3 0.10.9 over keccak 0.1.6 (bsigner's) | SHA3-256 of exactly 32 and 200 bytes, and of 8 then 192 bytes in two updates; SHAKE256 of exactly 32 bytes to exactly 96 | cargo-saw-build test profile; no backend choice in sha3 0.10 | `keccak::p1600(s, 24)` = `keccakF` (§2 A2) | `sponge.saw`: 4 PROVEN against FIPS 202 (`KeccakF1600.cry` `sha3_256`, `shake256`) | Keccak domain byte 0x01, parts swapped (both symbolic): refuted | CI run 37985787272 on `c631108ba`: PIN 10 packages, SPEC-CHECK 6, 4 PROVEN in 7 s, TEETH 2 of 2 | CI |
| PQ02 sponge, sha3 0.11.0 | sha3 0.11.0 over keccak 0.2.2 (ml-kem 0.3.2's, slh-dsa's) | SHA3-256 of exactly 1184; SHA3-512 of 33; SHAKE256 1120 to 32 and 33 to 128; SHAKE128 34 to 504 read as 3 x 168 | cargo-saw-build; keccak 0.2.2 soft backend (the simulation calls the soft instance, which is what the stand-in matched) | keccak 0.2.2 `keccak_p::<u64, 24>` = `keccakF` (§2 A3) | `sponge022.saw`: 5 PROVEN against FIPS 202 any-rate `spongeR` | SHA3-512 and SHAKE128 at rate 136 (symbolic): refuted | CI run 37985787272 on `c631108ba`: PIN 10 packages, SPEC-CHECK 5 (by evaluation), 5 PROVEN in 7 s, TEETH 2 of 2 | CI |
| PQ03 HKDF-Expand | hkdf 0.12.4, hmac 0.12.1, sha2 0.10.9 | PRK exactly 32 bytes, info exactly 21, 55 or 101 bytes, output exactly 32 (one block). NOT HKDF-Extract, NOT other lengths | cargo-saw-build; sha2's soft path, selected by an assumed probe (§2 A5) | one-block `x86::compress` = FIPS `compress` (§2 A4); SHA-NI probe = absent (§2 A5) | `hkdf.saw`: per length, `reference_N` = RFC 5869 (`Hkdf.cry`), and shipped `expand` = `reference_N`: 6 PROVEN | counter 0x02 and swapped pads (symbolic); bent info on all-zero inputs (CONCRETE): refuted | CI run 37985787272 on `c631108ba`: PIN 13 packages, SPEC-CHECK 6, 6 PROVEN in 52 s, TEETH 3 of 3 | CI |

Superseded or partial CI on the way (history, kept): PQ SAW `37963221368`
on `6d8f8a7b1` cancelled (the composition defect in §3); `37976780346` on
`0ceca2f5b` lost its runner on a symbolic tooth; the runs on `e4a04bfcb`
(`37975123*`), `2aeeec797` (`37977709355`), `93e45027a` (`37980960*`) and
`ca9eba661` (`37983325*`) cancelled, each superseded by a newer head; `445de42bc`
(`37969815*`) all green.

## 2 · Assumption ledger: what discharges each stand-in, and how

Each line below is a condition of the proofs that use it. "Machine" = a
proof in CI or on this box; "argued" = a written argument, not checked by a
tool.

- **A1 · ML-DSA `Elem` mul = `dsaMul` (debug build).** Discharged for builds
  with overflow checks OFF by three links: (1) machine, SAW: the shipped
  Barrett and mul built with overflow checks off ARE the Barrett algorithm
  (`pq05-saw/field-release.saw`); (2) machine, z3 over the integers: the
  constants are the macro's, and for every product of two elements the
  remainder before the one conditional subtraction lies in [0, 2q); (3)
  ARGUED: at these magnitudes the 128-bit machine words equal the integers
  (x m < 2^70, and x - t q >= 0 by link 2). The debug build's own overflow
  assertion at x - t q is an OPEN obligation (bitwuzla two forms, ABC,
  yices, 30 minutes each). **Build-setting evidence, read 2026-10-09:** no
  `[profile.release]` override in the workspace manifest (its only profile
  entries are dev `opt-level`s), no `.cargo/config*` in the repository or in
  the build user's home (Windows or WSL), no `RUSTFLAGS` or
  `CARGO_PROFILE_*` in either environment or in any workflow; the bsigner CI
  exercises in `tests.yml:51` is `target/debug/bsigner`, a DEBUG build; the
  profile of any bsigner binary the founder runs is not recorded. So the
  earlier wording "this is how bsigner ships" overstated the evidence; it is
  corrected in this commit to: the tie covers builds with overflow checks
  off; a debug build computes the same values whenever its assertion does
  not fire, and that assertion is the open link.
- **A2 · keccak 0.1.6 `p1600(s, 24)` = `keccakF`** (used by the sha3 0.10.9
  sponge). Machine: `composed` = `keccakF` and `agree` (shipped `p1600` =
  `composed`) for every state; joined by transitivity of equality, ARGUED
  (one step). ARGUED too: the loop proofs run keccak 0.1.6 compiled by
  saw-rustc from the extracted `.crate`; the sponge links keccak 0.1.6
  through cargo-saw-build. Same checksum-pinned source, separately compiled;
  the stand-in names the same function and signature (`&mut [u64; 25]`,
  round count 24 as a precondition).
- **A3 · keccak 0.2.2 `keccak_p::<u64, 24>` = `keccakF`** (used by the sha3
  0.11.0 sponge). As A2, with one more ARGUED step: the loop proof runs the
  crate's soft.rs compiled verbatim inside the harness (`#[path]`), while
  the sponge links the crate through cargo; same bytes, separately compiled.
  Backend: on x86_64 with no `keccak_backend` cfg, `Keccak::new` takes the
  soft backend; the sponge simulation exercised that selection (the stand-in
  for the soft instance is what got called).
- **A4 · one-block `sha2::sha256::x86::compress` = FIPS 180-4 `compress`**
  (HKDF reference proofs). Machine: `pq03-sha256-check.sh` proves sha2
  0.10.9's soft `compress` on one block equal to FIPS `compress`, on a
  verbatim `#[path]` copy of soft.rs (ARGUED: same pinned bytes as the
  linked crate). ARGUED: `x86::compress` calls `soft::compress` when the
  SHA-NI probe answers absent (A5). In the `agree_N` proofs nothing stands
  in for the compression: the shipped path and the reference both run the
  linked crate's soft code.
- **A5 · the SHA-NI probe answers absent.** A SCOPE, not a fact about any
  machine: it selects the soft path. On x86_64 with the SHA extensions the
  shipped code runs SHA-NI intrinsics, which nothing here covers.

## 3 · Classification of results

- Fixed shapes are universal only inside the shape: every PRK and info of
  length 21, 55 or 101; every message of the listed lengths. "Five sponge
  shapes proved" never means "SHA-3 / SHAKE is proved".
- Symbolic negative controls show the proof distinguishes the wrong spec for
  some input; the concrete ones (`agree_swapped` and `agree_bent_21` on
  all-zero inputs) show one input where the two computations differ. The
  latter are sensitivity checks; they are not universal results.
- shake 0.1.0 (ml-dsa's SHAKE): its sponge-cursor absorbs by reading the
  `[u64; 25]` state as bytes through a pointer cast, which SAW's MIR memory
  model cannot read ("attempted to read empty mux tree"). That is NEITHER a
  defect in the crate NOR an equivalence result: it is unproved here.
  PQ01's ACVP vectors (agreement on published cases) remain the evidence
  for it, of a different kind.
- Timed-out or abandoned attempts are not refutations: the Keccak direct
  24-round miters (bitwuzla and z3 90 min, ABC), the earlier agreement
  against a separately written reference, the plain-array HKDF agreement
  (bitwuzla past 12 GB, stopped by this seat), the 1,500 s composition of
  ML-DSA's inverse with its layers unfolded, and the ML-DSA Barrett debug
  assertion (30 min per solver).
- One refutation in the batch was a fault in the proof set-up, not in the
  code: ML-DSA's inverse first "failed" because SAW folds a stand-in's
  result on constant inputs (the negated twiddle came back as 3572223) while
  the spec kept the negation uninterpreted. Fixed by keeping it interpreted;
  recorded in the SAW file. The first composition of that inverse could
  not use the layer proofs as stand-ins at all: a specification reading
  the polynomial as one array, element by element, leaves fresh variables
  SAW cannot bind from the call (fixed with one variable per coefficient,
  then with the eight layers held opaque after the unfolded form ran past
  1,500 s); PQ SAW `37963221368` was cancelled before reaching it.

## 4 · Execution boundary (memory)

- `saw +RTS -M<n>` caps the Haskell heap only (GHC `-M`); it does not bound
  the solver child processes. Observed: bitwuzla at 22 GB on this 31 GB box
  under a SAW at `-M8g` (stopped by this seat, own pids only).
- Local probes this evening used `ulimit -v`, which caps each process's
  address space separately: not a tree bound.
- Verified tree containment, 2026-10-09, on this box's WSL (systemd user
  manager, cgroup v2 memory controller): `systemd-run --user --scope -p
  MemoryMax=300M -p MemorySwapMax=0 bash cgtest.sh`, where a background
  child grows past the cap: the scope is OOM-killed as a unit (exit 143,
  `run-…scope: Failed with result 'oom-kill'`, "300M memory peak"), and its
  30-second sibling is gone afterwards. Any further heavy local run by this
  seat goes inside such a scope (per run, no host-wide change); CI stays the
  default runner.
- CI: the runner VM is the boundary; the checkers cap SAW's heap (13 GB)
  only. Run 37976780346 lost a runner to a symbolic tooth; those teeth were
  made concrete.

## 5 · Outside the batch

- `hkdf32` (local branch, not pushed): extract with the 16-byte object id
  as salt over a 32-byte key, then expand, at `bpq1/wrap/self` (14) and
  `bpq1/wrap/x-wing` (16); spec checks include RFC 5869 A.1's extract.
  Branch `pq03-hkdf32-local` at `01aac1714` (this box only). LOCAL end to
  end: SPEC-CHECK 9, 10 PROVEN in 296 s (the batch's six plus a reference
  and an agreement proof per wrap shape), TEETH 3. It lands after this
  batch, as its own candidate.

## 6 · Review package for zCode (read-only, pinned)

Pin: **`c631108baaccf9504b6105f4fff0bda00588499b`**. Read and execute there;
touch no author tree. Reproduce with the CI steps (workflow
`.github/workflows/btungsten-pq-saw.yml`, jobs `saw` and `saw-ntt-dsa`),
each script printing its ladder line.

Files: `scripts/btungsten/pq06-*` (cryptol, ntt, names, saw, check),
`pq02-harness/*`, `pq02-saw/{shipped,shipped022,agree,agree022,loop-teeth*,order-teeth,sponge*}.saw`,
`pq02-sponge/`, `pq02-sponge022/`, `pq02-*-check.sh`, `pq02-cryptol/KeccakF1600.cry`,
`pq03-hkdf/`, `pq03-saw/hkdf*.saw`, `pq03-cryptol/Hkdf.cry`, `pq03-hkdf-check.sh`.

Priorities, in order:

1. **Each stand-in against what discharges it** (§2 A1 to A5): same
   function, same argument shapes, preconditions, memory behaviour,
   arithmetic semantics, backend and pinned dependency. Mark every link
   machine or argued.
2. **ML-DSA Barrett representation** (A1): link 1's release-semantics MIR,
   link 2's integer statement, link 3's no-wrap reading; whether together
   they establish what the NTT lane assumes for the builds named, and the
   build-setting evidence above.
3. **Fixed-length coverage**: that every claim names its lengths, and that
   none is restated as arbitrary-length in SPEC-BTUNGSTEN-PQ-1 or the README.
4. **Backend selection**: keccak 0.2.2's soft choice on x86_64; sha2's SHA-NI
   probe as a scope; the aarch64 paths excluded.
5. **Result classification** (§3): concrete versus symbolic teeth, the
   shake 0.1.0 exclusion, timeouts never counted as refutations.

The review is evidence for the record, not a permission step.

## 7 · Remaining obligations (named)

- ML-DSA debug-build Barrett assertion (A1 link 3 and the debug build).
- The one-step transitivity joins (A2, A3) and the same-bytes arguments
  (A2, A3, A4), unless a reviewer prefers them mechanised.
- SHA-NI and aarch64 paths; shake 0.1.0 under SAW.
- Sponge and HKDF lengths beyond the listed shapes; `hkdf32` landing.
- rustls RUSTSEC-2026-0285: merge main once #375 lands, re-read gate 2.
- bsigner `CONTRACT.md` freeze vs main (escalated by name in
  `2026-10-09-pq-status-verification.md` §4.1, founder-only): this batch
  adds no bsigner surface.
