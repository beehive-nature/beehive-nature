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
- The PR's own `formal` job run is the first TYPECHECK receipt — if it
  reds on an idiom, the fix belongs to this seat in this PR (the ladder
  working as designed).
- WB002 lane (PR #351) remains its owner's; the ladder applies to it
  the same way when its formal leg runs.
