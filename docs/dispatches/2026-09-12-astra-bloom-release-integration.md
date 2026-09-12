# Bloom release integration after independent cold review

z1.b's #35 review (`171ac4fd`) found no release blocker at `8eac7117` and
recorded browser checks against that head and earlier main trial merges.
Astra merged people PR #57 at `5709897f` after its independent delta acceptance
(`c7dd98ef`) and eight green checks, then integrated the bloom branch into that
current main in an owned release worktree.

The workflow's front-door suite conflict is resolved as a deduplicated union:
existing people/reading-room coverage and observer CI remain alongside the
first-work/companion suites. No suite removed. Original #35 history is retained.

W1 fixed: a valid import containing zero references leaves the preview hidden,
with the existing honest empty-file status and disabled Add action. A regression
loads a populated preview first, replaces it with an empty collection file, and
asserts preview hidden, Add disabled and zero store writes. The initial regression
mistakenly tried the UI's disabled empty-export button; its fixture was corrected
to construct an empty export with the actual collection serializer. This was a
test-setup failure, not evidence of a production export defect.

Validation: final first-work suite 15/15; source/corpus gate 11/11. The combined
front-door command initially passed 300/301 with that test-setup failure; the
corrected union result is reported on #35. z1.b's broader browser evidence is
credited to that seat and its exact reviewed heads, not claimed as an Astra
rerun on this merge. Remote CI must pass before release merge.

People #57 is on main, not independently verified deployed by this pass.
The bloom remains one canonical work identity and collection engine. No media
upload, financial transaction, public campaign, live social delivery, or human
adoption observation is claimed. Legacy translation gaps remain explicit.
