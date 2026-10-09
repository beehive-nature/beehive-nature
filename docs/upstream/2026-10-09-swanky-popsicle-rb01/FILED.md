# Filed upstream

Filed on GaloisInc/swanky on 2026-10-09 from the founder's GitHub account
`loviswaternakamoto`, by Seat 3 (Claude Code), on the founder's explicit go
in chat. That go covered the four reports and one minimal private-channel
request. It did not cover email, held details, Hive, or any permission
change.

| package draft | issue | created (UTC) | title |
|---|---|---|---|
| `ISSUE-1-set-sizes.md` (O1) | [#47](https://github.com/GaloisInc/swanky/issues/47) | 2026-10-09T19:41:09Z | popsicle circuit PSI: a garbler set larger than the evaluator set can panic in swanky-oprf-kmprt (`assert!` at lib.rs:211) |
| `ISSUE-2-repeated-elements.md` (O2, O3) | [#48](https://github.com/GaloisInc/swanky/issues/48) | 2026-10-09T19:41:12Z | popsicle circuit PSI / swanky-oprf-kmprt: repeated input elements are not rejected, and release builds did not complete within 60 s |
| `ISSUE-3-empty-evaluator-set.md` (O4) | [#49](https://github.com/GaloisInc/swanky/issues/49) | 2026-10-09T19:41:14Z | popsicle circuit PSI: an empty evaluator set panics both parties |
| `ISSUE-4-input-encoding.md` (O5) | [#50](https://github.com/GaloisInc/swanky/issues/50) | 2026-10-09T19:41:17Z | popsicle: `compress_and_hash_inputs` maps byte strings that differ only in trailing zero bytes to the same block |
| none (private-channel request) | [#51](https://github.com/GaloisInc/swanky/issues/51) | 2026-10-09T19:41:18Z | Security-relevant report: requesting a private channel |

## Checks before filing (2026-10-09T19:39Z)

- The authenticated account was `loviswaternakamoto`. Swanky's `dev` head
  was still `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`, and the newest issue
  was #44.
- Duplicate search over issues and PRs, open and closed, for popsicle,
  kmprt, compress_and_hash_inputs, "private channel", PsiGarbler, cuckoo,
  "empty evaluator" and repeated: no matching report. The hits #1, #7, #8 and
  #44 are unrelated.
- Each BNR evidence link in the bodies was fetched at `0d88ec248` through
  the GitHub API, and its SHA-256 matched the committed bytes: README,
  RECEIPTS and the five programs.
- Each Swanky permalink was fetched at the pin, and its first cited line
  holds the cited code.

## How the issue bodies were made

- #47–#50 are the reviewed drafts with these changes: the draft header
  removed; a first paragraph added that links to this package at
  `0d88ec248`; "attached" files replaced by links to those files at that
  commit; and paragraphs unwrapped, because GitHub renders single newlines
  as line breaks. The unwrapping skipped continuation lines that begin with
  `|`, so #47 keeps two mid-sentence line breaks (at "|B| = 256, the first
  panics…" and "|B| = 256 and |A ∩ B| = 128…"). They are cosmetic and were
  left as posted.
- After creation, each of #47–#50 got one line appended: "Related reports
  from the same re-check: …", naming the other three. GitHub's timelines
  show each of the four cross-referenced by the other three.
- #51 carries only "Security-relevant, requesting a private channel. Please
  indicate your preferred confidential reporting route." It has no links,
  no constructor references, no data and no fix. Nothing links #51 from
  #47–#50.

## Read back

`filed/swanky-NN.md` holds each body exactly as the GitHub API returned it
after the edits, with one extra newline added by the save. SHA-256 of each
body as the API returned it (its own final newline included, the added one
not):

- #47 `ee43ef3eb4dc15f497a1b2247c95206ab607697fa39ce78eeac5a9998915c8b0` <!-- PUBLIC-CONSTANT: sha256 of a public issue body -->
- #48 `58df0725921725458b2c8eb4f7309dde13dd5d926136cc353bfbd810452b2dad` <!-- PUBLIC-CONSTANT: sha256 of a public issue body -->
- #49 `47e531d7c753d94fec72c541e581d13460bf555fbdcb62c377f196721d2c4f3a` <!-- PUBLIC-CONSTANT: sha256 of a public issue body -->
- #50 `ae9cd7dd35c7a79201c541d8e9f25f081e92dc5dbfc73532f0e03f6ee3379f33` <!-- PUBLIC-CONSTANT: sha256 of a public issue body -->
- #51 `ae50b2cbb17b9a28c6b17c5580bd7f215e1b29a0f2844e054023ecafcf4ff82d` <!-- PUBLIC-CONSTANT: sha256 of a public issue body -->

## Not done

- No email was sent. The held observation-6 material stays held until
  Swanky's maintainers name a confidential route on #51; delivering it
  then needs its own go.
- Item 6's security impact remains UNVERIFIED.
