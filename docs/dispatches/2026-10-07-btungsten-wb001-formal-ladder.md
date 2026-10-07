# 2026-10-07 — WB001 formal ladder: TYPECHECK + CHECK-SAMPLED wired in CI, concrete accepted language, PROVE attempt honest

zCode seat, branch `zcode/btungsten-formal-2026-10-07` (base `3006cdd23`
= Beat 2 on main). Founder Beat 3 ruling (2026-10-07): narrow — TYPECHECK
on the CI Ubuntu runner with toolchain versions and obligation names
recorded; CHECK-SAMPLED with CONSTRUCTED valid pairs (boundary lengths,
astral Unicode, combining sequences, embedded replacement characters,
near-collision pairs); adversarial pairs deliberately OUTSIDE validIntent
proven rejected BEFORE any injectivity claim is evaluated; only then the
PROVE-UNIVERSAL attempt; the Rust/Node/Cryptol relationship is NOT
EQUIVALENCE — vectors establish sampled agreement only. Plus the
scrutiny: no canonical PROVE receipt while wellFormedUtf8 is an abstract
placeholder — the theorem must be about the deployed accepted language.

## The concrete accepted language (the scrutiny, closed in-model)

`wb001-cryptol/Intent.cry` now defines `wellFormedUtf8` as a REAL DFA
with exactly the transition law of the runtime validator
(`assertValidUtf8`): ground/continuation-count states plus the four
lead-specific first-continuation ranges that refuse overlongs, encoded
surrogates (CESU-8), >U+10FFFF and truncation. The scan runs over the
capacity array; that is exactly prefix validity because ground is a
fixed point for the canonical zero padding and a truncated prefix
leaves the DFA mid-sequence where padding cannot rescue it. The
runtime↔DFA agreement is sampled by the shared vectors today and belongs
to the future EQUIVALENCE class — never claimed from samples. One idiom
carries a TYPECHECK obligation marker (the lazy positional
self-reference in `scan`); the semantics are fixed by the equation and
the fallback idiom is named in the file. Per the ladder, the typecheck
RUN settles it — not this dispatch.

## The CI formal job (tests.yml, new `formal` job)

- Cryptol PINNED: 3.6.0, asset `cryptol-3.6.0-ubuntu-22.04-X64-with-
  solvers.tar.gz` (latest release, 2026-09-09, verified first-hand on
  the releases page this lane), sha256 printed in every run log.
- Runner script `scripts/btungsten/wb001-formal-check.sh` classifies
  honestly with exit codes:
  - TYPECHECK — `:load` must succeed; a module that does not load is a
    structural red.
  - CHECK-SAMPLED — three arms, all gating: adversarial
    (`adversarialRejected`: surrogate/overlong/0xff/beyond-10FFFF/
    truncated domains + length-beyond-capacity + non-canonical padding,
    all `validIntent == False`), constructed (`constructedValidPairs`:
    closed terms — boundary-shift twins, astral 🐝, legitimate U+FFFD,
    combining sequence, near-collision payload pair, all valid and
    wire-distinct), random (`:check wireInjective` over symbolic
    a, b). A counterexample in any arm is a REAL finding: red.
  - PROVE-UNIVERSAL — `:prove wireInjective` under a 300s budget;
    timeout prints NOT-PROVEN and exits green BY DESIGN (an open
    obligation is a recorded state; gating on it would wedge CI red
    forever — and the result-class law forbids calling it anything but
    NOT-PROVEN). A REFUTED verdict is red — a real finding.
  - EQUIVALENCE — not attempted; the script's final line says so.
- Workflow-edit law honored (the Beat 2 lesson): the diff is a pure
  31-line insertion, one new job-level key, `lint-ci-shape` 125/125
  guarded steps, the appended run-block extracted and `bash -n`'d, and
  the shell-chain lint passes on the new script.

## Boundaries not crossed

- No cryptol execution happened on this seat's box (Windows; the binary
  is Linux x86_64) — the CI run IS the typecheck receipt, expected on
  this PR. If an idiom reds, the iteration is part of the TYPECHECK
  class and is receipted, not hidden.
- No Rust twin, no SAW, no EQUIVALENCE claims. The vectors remain
  sampled agreement.
- The genesis battery and boundary suite are untouched this beat
  (16/16 still green locally); the sibling WB002 lane (PR #351, open)
  is untouched — this beat's files are disjoint except append-oriented
  edits to README and SPEC.

## Canon

SPEC-BTUNGSTEN-1 §workbench gains, per the ruling: the **right-language
law** (a universal proof receipt is canonical only if the theorem is
about the deployed accepted language — concrete predicate in-model or a
separately proved refinement) and the **formal-assurance ladder** as the
default sequence for every workbench:
`RED counterexample → accepted-language repair → shared vectors → formal
wire alignment → TYPECHECK → CHECK-SAMPLED → PROVE-UNIVERSAL →
eventually EQUIVALENCE`. Also banked as the three reusable laws of
Beat 2 (founder wording): cryptographic correctness begins at the
accepted-input boundary; the formal model must describe the deployed
wire language, not an easier capacity model; and the four result
classes cannot substitute for one another.

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI merge of this PR on green: this seat (no-stall law).
- WB002 lane (PR #351) remains its owner's; the ladder applies to it
  the same way when its formal leg runs.

## APPENDIX (final push): the typecheck iterations, the counterexample that was mine, and Q.E.D.

The ladder ran to its top rung inside this PR. Every iteration is a
commit on this branch; the receipts:

- **Rounds 1-13 (install + language idioms):** release tag carries no
  `v` prefix and ubuntu-latest wants the 24.04 asset; cryptol CLI is
  `-c COMMAND` (batch `-b` takes a SCRIPT FILE, not stdin); cryptol
  needs z3 on PATH and `$GITHUB_PATH` — not a step-local export — is how
  it reaches the next step's shell; Cryptol 3 takes no where-semicolon,
  no let-expressions, no return annotation on `property`, no abstract
  signatures without bindings, no unparenthesized comparisons in boolean
  combinations, no String value type, no literal broadcasting to byte
  sequences, no variable range bounds (positions come from
  `take`{cap} [0 ...]`), no Nat-kinded value signatures (MaxEnv is a
  type synonym), and record update `{a = .., b = ..}` parses as
  application — full literals carry explicit `Field N` annotations.
- **Round 14 (TYPECHECK: PASS; adversarial arm: PASS; a REAL
  counterexample):** `constructedValidPairs = False` on a closed term.
  The split into named obligations (round 15) pointed at `validIBase`,
  the per-field split (round 16) named `validDest_iBase`, and the model
  was RIGHT: my literal said `"vault:0xBEEF"` had length 11 — it is 12
  bytes — so byte 11 sat beyond the claimed length and the canonical
  padding law refused it (`"skaists.bpay/1"` was off by one the other
  way, passing only because the extra claimed byte happened to be
  zero). The concrete accepted language caught a lying length word in
  its own author's fixture — the exact class of thing it exists to
  catch — and the adversarial arm could never have seen it (it passes
  vacuously when a validity conjunct is too strict; only the VALID arm
  can name that).
- **Round 17 (the top rung):** with honest literals, CI prints:
  `FORMAL-PROVE-UNIVERSAL wireInjective: … Q.E.D. (Total Elapsed Time:
  23.677s, using "Z3")` — **the universal injectivity of the canonical
  wire over the valid domain is PROVEN**, on the first honest attempt,
  23.7 seconds. The first classifier recorded NOT-PROVEN because it
  grepped for `Valid.` and Cryptol prints `Q.E.D.` — the classifier now
  records what the tool printed, not what we guessed it would; the
  lesson is the result-class law applied to the runner itself.

**Final ladder state (this PR's formal job):** TYPECHECK: PASS ·
CHECK-SAMPLED: PASS (adversarial + 8 per-field + constructed twins +
near-collision + random `:check wireInjective`) · **PROVE-UNIVERSAL:
PROVEN (Q.E.D., z3, 23.7s)** · EQUIVALENCE: NOT ATTEMPTED — the shared
vectors remain sampled agreement between the JS implementation and this
model; universal implementation/model equivalence is SAW's future class
and nothing here claims it.

Toolchain of record: Cryptol 3.6.0 (Git commit 61dd17b0c45ddf8c5c1e952
afd5e789c4dc4ec4b), z3 4.8.14 (the bundle's own pin, build df8f9d7dcb8b
9f9b3de1072017b7c2b7f63f0af8), tarball sha256 621860aa1dedc037e8fc8355
bef3edf023e41e78efb7177146126f5a87309962, ubuntu-24.04 asset.
