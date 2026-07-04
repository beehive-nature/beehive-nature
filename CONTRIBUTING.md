# Contributing

## Sign-off (DCO)

Contributions require DCO sign-off (`git commit -s`), certifying the
[Developer Certificate of Origin](./DCO) — that you have the right to
submit the work under this repository's license.

**No CLA.** Contributors retain their own copyright; nothing is assigned
to any steward. The practical consequence is deliberate: the license can
never be changed without the consent of all copyright holders. See
[`docs/LICENSING.md`](./docs/LICENSING.md) for why.

## Findings handoff (one door)

Research findings enter the repo through exactly one door:

1. The research lane writes **drafts** — untracked files under `docs/`
   (or clearly draft-marked). A draft on disk is not yet a finding.
2. The builder session **reviews before committing**: consistency with
   the brief/constitution, no contradictions with the ledger, and a
   byte-integrity check (large external writes have truncated before —
   verify the file ends where it should).
3. Every committed finding gets its own `STATUS.md` ledger line naming
   the question it retires or the mechanism it adds.

4. **Single writer per draft.** The research lane owns a file until it
   is submitted for review; the builder owns it during review. Edits
   wanted from the other lane travel as notes, never as concurrent
   writes — two lanes editing one file in the same minute is a merge
   conflict wearing a process costume, even when it happens to land.
5. **External references are cited and pinned, never vendored.** Design
   documents under other licenses (e.g. GPL-3.0 specs) stay out of this
   CC-BY-4.0 tree; cite them by repo + commit hash (or dated URL) so
   the reference cannot drift. The one-door rule governs findings this
   project authors; provenance honesty governs everything it reads.

The repo stays the single source of truth only if things enter it
through one door.

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
