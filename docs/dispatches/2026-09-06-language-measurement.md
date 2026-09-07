# Shared Unicode translation measurement

Astra's bounded implementation lane from coordination issue #10; broader
wording and translation meaning remain in issue #7. Base product source:
`234e3b7d`. This dispatch accompanies the repair; merge, CI and deployment
receipts will be attached to the implementing PR after those events occur.

The picker and CLI previously duplicated a leaf census with a Latin/Cyrillic
letter range and minimum text length. Short labels and other scripts could
disappear from its denominator. The CLI's JSON branch also bypassed keyed
floor enforcement, and requested missing pages could be silently filtered.

`surfaces/lang.js::measureVisibleText` now counts lettered leaves using
Unicode letter detection with no minimum length. `summarizeCoverage` separates
unkeyed text, missing corpus keys and empty translation cells. The picker,
CLI and browser selftest use those same functions. Node imports only the pure
API; browser exports precede the duplicate-picker guard. Repeated rich-text
leaf occurrences retain their nearest key holder. The actual dock container
`#adWin` joins the existing chrome exclusions so opening it cannot inflate
the page census.

Rendering and measurement both require a non-empty string after trimming.
A whitespace-only or non-string cell leaves the source English visible.
English counts keyed source text even without a corpus fetch. No corpus
translations, language order, default/saved preferences or floor values are
changed by this lane.

`e2e/coverage-gate.mjs` validates non-empty, non-duplicate page sets with
canonical surface-relative HTML paths (so aliases cannot evade floors) and checks
measurement errors and keyed floors before report formatting. The CLI keeps
missing-page failures, checks HTTP success before and after reload, fails
when requested floors are unavailable, and does not advance floors or write
a markdown report after failed measurement. JSON includes the same gate
result and uses the same nonzero exit status. Tour/lang cache versions and
the generated atlas advance together.

## Verification at preparation

- 25 Node tests passed: existing atlas/dock checks plus eight new coverage
  cases, including all 29 docked language choices, one-letter and astral
  text, nested holders, absent/blank/invalid cells, English source behavior,
  the actual renderer at a DOM boundary, page-set errors and floor failures.
- JavaScript syntax checks and CI-shape lint passed. The new tests are wired
  into the existing static CI job with `if: always()`.
- Browser CI's selftest now invokes the actual exported measurement function
  against keyed and unkeyed short text in every docked language, nested rich
  leaves, hidden content and excluded chrome. It expects 31 keyed / 60 total
  leaves. Its execution result is pending at dispatch preparation.
- No manual browser inspection or visual QA was run for this measurement
  lane. The existing required browser workflow remains the browser gate.

## Limits

The unit is a laid-out leaf element containing a letter. It is not a sentence
count or a complete page-text inventory. Direct text beside child elements,
attributes/placeholders, generated text, canvas, shadow trees and embedded
documents are outside the count. A layout box does not prove viewport
intersection, visual readability or perceptibility. Rich markup can change
the number of leaves. Absolute keyed floors can be offset by new leaves;
they do not individually preserve every previous key.

The CLI still observes after a fixed 700 ms and summarizes against the local
corpus. The picker has asynchronous loading and withdrawal handling. Shared
functions align counting rules; they do not prove identical runtime state,
successful translation delivery, correct meaning or human attestation.
Published coverage must be described as structural corpus reach with these
limits. Remaining unkeyed prose and semantic review belong to the language
lane, not a claim of full translation from this repair.
