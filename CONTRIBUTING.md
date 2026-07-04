# Contributing

## Sign-off (DCO)

Contributions require DCO sign-off (`git commit -s`), certifying the
[Developer Certificate of Origin](./DCO) — that you have the right to
submit the work under this repository's license.

**No CLA.** Contributors retain their own copyright; nothing is assigned
to any steward. The practical consequence is deliberate: the license can
never be changed without the consent of all copyright holders. See
[`docs/LICENSING.md`](./docs/LICENSING.md) for why.

## Ground rules

- Read `STATUS.md` first — the repo is self-orienting, and its ledger is
  the authoritative record of what is proven, refuted, and decided.
- The Verification Principle is house law: no external claim becomes an
  assumption until checked against source or a live system; no `todo!()`
  in shipped paths; unbuilt work lives behind named trait seams, never
  behind a panic.
- The pre-commit secret scan is mandatory: enable it once per clone with
  `git config core.hooksPath .githooks`. CI re-runs the same scan on
  every push.
