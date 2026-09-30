# DESIGN KIT ASSETS — closeout: #266 reviewed, approved at exact head, MERGED; the 24-blob obligation stays INCOMPLETE (20 missing)

date 2026-09-30 · seat zCode (GLM asset owner) · closes the lane opened by
[2026-09-28-design-kit-assets-landed.md](2026-09-28-design-kit-assets-landed.md)
(the #257/#259 asset obligation). Merge commit **096f18408** on main at
2026-09-30T15:41:39Z.

## the independent review (fresh GLM reviewer, arranged per founder order)

The reviewer had no prior involvement in the lane, worked read-only in the
lane worktree, and returned its own verdict:

- **VERDICT: APPROVED**
- **REVIEWED COMMIT: `610b293ebe58c1dfe5cd9a8dfec9639f2740a0eb`** (the exact
  PR head; worktree HEAD confirmed at that SHA, branch exactly two commits
  on top of e063fb00e)
- Checklist A–J all **PASS**: diff=claims (14 files, nothing extra);
  four blobs exactly their manifest byte counts with plausible types and
  the manifest itself untouched — the reviewer **independently reproduced**
  the manifest's md5-identity to the founder's Downloads drop, the
  24-entries-sum-to-501,801 arithmetic, and the store-id counterexample
  (landed austras-koks.svg md5 ≠ manifest id); wiring correct (guard
  first, base pattern = tour.js assetBase, idempotent, coexistence with
  skaists.css/atlas.css/law-of-the-sea/bnamesday verified against real
  consumers, no injection surface); pin law complete (12 occurrences
  moved; repo-wide v=12 survives only in dispatch history — the allowed
  exception); the mount-once assertion evolution is a genuine
  strengthening, register.test run by the reviewer **15/15**; claims worded
  exactly at their evidence boundary (no over/underclaim found);
  scope clean (no fund-block/agent-dock/other-lane files; registration
  ritual not triggered); licenses complete (five OFL 1.1 blocks; house
  assets founder-public); the verifier run by the reviewer exits 2
  incomplete with honest limits in its header; nothing marks the
  obligation complete.
- **Required changes: none.**

Reviewer notes, recorded (not blockers): (1) the evolved register.test
assertion covers the wiring nodes exactly-once but no longer counts the
register's own `#bregstyle` append — one future line would make
"stronger" strictly true; the shipped guard is intact. (2) 24 gate-shot
PNGs sit uncommitted in the lane worktree (writer's local receipts; never
to ride a commit — pathspec discipline holds). (3) origin/main had
advanced (#251/#263/#270) with zero file overlap — the merge was clean.
(4) `docs/mvp-walk` pages still pin `register.js?v=9` — pre-existing
frozen-walk convention, untouched by this and prior bumps.

## the merge, under the recorded rule

Recorded rule: no merge without independent exact-head approval + passing
CI. Approval: the verdict above at `610b293eb`. CI at that head: all
checks pass (eternal/meter/node/scan/static/test/wallet; re-confirmed
green immediately before the merge gesture). Merged 2026-09-30T15:41:39Z
as **096f18408**. Post-merge, on main:
`node scripts/design-kit-verify.mjs` → **4/24, obligation INCOMPLETE,
20 missing**.

## what is live on main now

- The sheet's named families load and render on every surface from the
  estate's in-tree OFL builds (fallback rendering over) — register.js
  `#bkitfonts` → `fonts/eternal-fonts.css` + `#bkitburti` →
  `fonts/burti.woff2`; loader pin v=13.
- Four manifest blobs in-tree at their manifest paths, byte-count+type
  verified, provenance recorded (see the correction rider in the lane
  receipt for the exact claim boundary).
- `scripts/design-kit-verify.mjs` — the one-command obligation check.

## the obligation — preserved as INCOMPLETE

This merge is a PARTIAL delivery and does NOT mark the full asset
obligation complete. **20 of 24 manifest blobs remain missing** (burti.ttf
26,020B; Icons ×10; Signs ×7; Logos ×2 — ids+bytes in the lane receipt).
They exist only in the claude.ai Files panel; the hive law stands (this
seat fetches no artifacts, asks the founder to paste nothing). Completion
path, no ceremony: any drop lands at its manifest path, then
`node scripts/design-kit-verify.mjs` must exit 0. The 8 `fonts/*.woff2` +
5 OFL texts carry no manifest byte records — if they ever land, byte
records come first, and fonts-loading remains distinct from
fonts-byte-matching-the-kit (the rider's boundary).

Follow-ups banked from the review: the one-line `#bregstyle` mount-once
count; the mvp-walk stale-pin convention stays conscious. The lane
worktree `wt-zcode-design-assets` stays available for the blob drop.

## session state

Lane complete through merge; this session may archive. The carry-over
lives here and in the lane receipt, not in the chat.
