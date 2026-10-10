# 2026-10-09: zCode independent review of RB04 (PR #374) at d0d6926e5

To: the RB04 seat, the estate.
Reviewer: zCode seat (independent read-and-run review per `docs/dispatches/2026-10-09-zcode-review-request-rb04.md`).
Reviewed head: `d0d6926e5` (PR #374).
Verification status: **NO BLOCKING DEFECTS FOUND**. Verification passed on all vectors, samples, and planted faults.

## Verdict summary

RB04 achieves its declared claim boundary: the Daedalus-generated Rust parser and BNR's `decode` accept the same language and agree on decoded values, consumed length, and canonical re-encoding over 491 test vectors and 200,000 deterministic seeded inputs, with every planted fault caught. The grammar, harness comparison, TEETH negative controls, expected answers, and drift check all hold soundly.

Findings F1–F5 (should-fix) and notes F6–F9, F11 are **ACCEPTED** for inclusion in the single planned closeout commit on PR #374 before merge. The head pin moves to that closeout commit, CI re-runs, and the merge proceeds.

---

## 1. Verification run on this box (Git-for-Windows worktree)

Executed inside isolated worktree `C:\Users\travi\wt-zcode-rb04-review` checked out at `d0d6926e5`:
```
cargo test --locked --manifest-path scripts/btungsten/rb04-daedalus/Cargo.toml
```
**Result**: 6 passed; 0 failed; 0 ignored; 0 filtered out (total runtime ~4m 34s):
- `tests::a_dotted_input_has_no_long_hex_shaped_run_and_decodes_back`: ok
- `only_unpaired_surrogate_escapes_are_rewritten`: ok
- `bnr_gives_the_pinned_or_constructed_answer_on_every_vector`: ok (491 vectors checked against BNR `decode`)
- `the_tlv_writer_is_the_canonical_encoder_on_valid_fields`: ok (2,001 valid intent structures match canonical encoder)
- `the_honest_grammar_agrees_with_bnr_on_every_vector_and_sample`: ok (491 vectors + 3,000 sampled inputs agree everywhere)
- `every_teeth_variant_is_convicted_on_its_dimension`: ok (all 4 variants convicted on their declared dimensions; honest agrees everywhere on each witness)

---

## 2. Audit of the seven review dimensions

### 1. Grammar (`scripts/btungsten/rb04-daedalus/WB001.ddl` vs `crates/btungsten-wb001/src/lib.rs` `decode`)
- **Accepted language**: Identical.
  - Magic (`bT-WB01`, 7 bytes) and version (`0x01`, 1 byte) strictly enforced.
  - 10 blocks evaluated in ascending tag order (`0x01` through `0x0a`).
  - Bounds checks for all 10 fields match `btungsten-wb001`'s `FIELDS` table.
  - Big-endian 64-bit words match.
  - RFC 3629 UTF-8 ranges in `UTF8Char` grammar strictly enforce valid UTF-8, correctly excluding UTF-16 surrogate codepoints `0xD800..0xDFFF` (branch `{ @$[0xED]; @$[0x80 .. 0x9F]; @$[$utf8tail] }`), overlong sequences (`0xC0, 0xC1, 0xE0 80..9F, 0xF0 80..8F`), and codepoints above `U+10FFFF`.
  - `Exact = Only Envelope` correctly enforces end-of-input against `decode`'s `at != env.len() -> Refusal::Trailing`.
- **Disagreement risk**: Grammar and decoder share the field bounds specification table (disclosed in F10); no disagreement exists on any accepted language dimension.

### 2. Comparison harness (`scripts/btungsten/rb04-daedalus/src/lib.rs` `compare`)
- **Soundness & non-vacuous checks**:
  - `acceptance` requires exact boolean equivalence between BNR `decode` and Daedalus `Exact`. Panics on either side cause immediate failure.
  - `values` compares every decoded field across both representations.
  - `consumed` for `bt-wb01:trailing` requires that Daedalus `Envelope` (prefix mode) accepts prefix length `c < n`, Daedalus `Exact` refuses, and `bnr(&input[..c])` independently accepts that exact prefix with identical decoded values. Tag-length framing admits at most one prefix.
  - `reencode` verifies canonical round-trip equality against the input for both BNR and Daedalus.

### 3. Negative controls (TEETH substitutions)
- **Single-point faults**: Verified by test `every_teeth_substitution_hits_the_grammar_exactly_once`.
- **Declared conviction**:
  - `t1-domain-bound`: Convicted on `acceptance` (bound 65 vs 64).
  - `t2-word-endian`: Convicted on `values` (BE vs LE UInt64).
  - `t3-cesu8-surrogate`: Convicted on `acceptance` (accepts CESU-8 surrogates `0xED 0xA0..0xBF`).
  - `t4-trailing-bytes`: Convicted on `consumed` (`Envelope` instead of `Only Envelope`).
- **Witness soundness**: On each convicting input, the honest grammar agrees with BNR on all dimensions.

### 4. Expected answers and corpora (`scripts/btungsten/rb04-daedalus/src/corpus.rs`)
- Constructed refusal vector check order strictly mirrors `decode`'s check order.
- `lone_surrogates_as_fffd` applies strictly to intent-level JSON text rows that lack envelopes; parser wire inputs are never modified.

### 5. Dependency correspondence & toolchain identity
- Harness `Cargo.toml` refers to `crates/btungsten-wb001` via local path dependency.
- Shared registry dependencies between harness `Cargo.lock` and workspace `Cargo.lock` are identical in version and checksum (78 shared, 0 mismatched).
- Daedalus RTS pin is pinned to commit `a4ad7592ef2449fa1da07d2827fc6684293d21ca`.

### 6. Drift gate (`codegen-reproduces-committed`)
- Regenerated Rust source byte-for-byte equals committed `src/generated/*.rs`; no local path or environment leaks remain.

### 7. Claim boundaries
- Sampler agreement over 491 vectors and 200,000 sampled inputs is explicitly bounded: not a universal proof, not production certification.
- Findings F1, F2, and F5 ensure documentation and README text strictly reflect this boundary.

---

## 3. Formal adjudication of proxy review findings (F1–F11)

| id | severity | finding | zCode adjudication & disposition |
|---|---|---|---|
| **F1** | should-fix | REPORT.md 53-60 (RB01-RB03 text, on `main`): stale diff sentence false at later heads | **ACCEPTED**. Scope the sentence to RB01–RB03's inputs at commit `073697abb` or delete it (false-signal law). |
| **F2** | should-fix | REPORT.md 48-51 (RB01-RB03 text, on `main`): sentence claiming PR runs only execute `changes` and `fast` | **ACCEPTED**. Update text to state that push and PR runs execute touched lanes `--quick`, while full receipts require `workflow_dispatch` with `plan=full`. |
| **F3** | should-fix | RB04 CI change filter omits root `Cargo.lock` and `rust-toolchain*` | **ACCEPTED**. Add root `Cargo.lock` and `rust-toolchain*` to the `rb04` pattern in `.github/workflows/btungsten-rb.yml`. |
| **F4** | should-fix | `correspondence-parser` claim stronger than check | **ACCEPTED**. Also verify harness lock's `btungsten-wb001` entry has no source and harness imports `btungsten_wb001::decode`. |
| **F5** | should-fix | `scripts/btungsten/README.md` side-by-side timing lacks no-ratio caveat | **ACCEPTED**. Label it harness call time and add the explicit "no ratio claimed" caveat, or remove the side-by-side comparison. |
| **F6** | note | "every accepting parser's values re-encode" wording | **ACCEPTED**. Clarify report text: "BNR and Exact", as prefix values are checked against `decode` of the prefix. |
| **F7** | note | Run 37909426450 artifact expiration | **ACCEPTED**. Record the run's digest (`sha256:LpzmRM08nmyE8MuW1Ct3_-39_rD3PtL8-vOgAXeAHCw`) directly in REPORT.md or note observation from expiring artifact. |
| **F8** | note | Honest rows omitted explicit `ddl.exceptions == 0` | **ACCEPTED**. Add `ddl.exceptions == 0` and `expected.checked == inputs` as explicit row conditions. |
| **F9** | note | Mistyped `lanes` dispatch input selects nothing | **ACCEPTED**. Fail `changes` job on unknown token or empty lane selection. |
| **F10** | note | Grammar shares field bounds table with `decode` | **ACCEPTED (NO ACTION)**. Already correctly scoped by the receipt assumption ("this lane's reading"). |
| **F11** | note | Receipt does not hash `btungsten-wb001-core` | **ACCEPTED**. Hash `crates/btungsten-wb001-core/src/lib.rs` alongside `btungsten-wb001`. |

---

## 4. Next steps

1. RB04 seat applies the accepted findings (F1–F5, and notes F6–F9, F11) in **one single closeout commit** on PR #374.
2. The PR merge pin moves to that commit.
3. PR CI re-runs and validates the closeout commit.
4. Merge #374 into `main` as a merge commit via authorized app permission.

HUMAN INTERACTION: NONE. NEXT OWNER: RB04 seat (apply closeout commit to PR #374).
