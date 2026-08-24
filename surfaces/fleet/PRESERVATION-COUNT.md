# PRESERVATION COUNT · the true number behind commit 482412f

Commit `482412f` — "fleet: preserve seven founder surfaces verbatim (no edits)" —
preserved **26 files, not seven**:

- **9** founder HTML surfaces (acid-cascade · blend-lab · bnr-dashboard ·
  edible-tracker · flower-lab · indigo-index · intake-tracker · resonance ·
  spliff-lab)
- **1** VALUE-LOOP-MAP.md
- **16** iq-wiki-entries/*.md — 15 numbered drafts (01–15) **plus
  00-MASTER-INDEX.md** (the master index is a real file; an earlier count of
  25 folded it into "15" by following the numbering — zA's independent recount
  of 26 is correct)

The "seven" in the subject came verbatim from ORDER FLEET-1, which named seven;
the directory held twenty-six files' worth of founder authorship. The seat
preserved everything and flagged the discrepancy in the commit body and its
report; the wrong subject number is the order's, not the commit's — and the
25-vs-26 in this note's first draft was the same class of error, counted by
label instead of by `ls`. Arithmetic cross-check: 26 preserved files + the
one-line `.gitattributes` pin = the "27 files changed" of commit 482412f.

History is NOT rewritten — merged history costs more than an imprecise subject.
This note is the correction of record, pointing at `482412f`.

Byte-exactness receipt: every file's sha256 verified against
`git show` of the COMMITTED BLOB (not the worktree copy) before and after
commit — the `surfaces/fleet/** -text` gitattributes pin was required because
all 26 files are CRLF against the repo-wide `eol=lf` law. Hashes in the FLEET-1
seat report of 2026-08-23.

History (folded from PRESERVATION-NOTE.md, 2026-08-24, so one subject has one
note): `482412f` stands as merged — by `28c1444`, gate-seat pass, hashes
re-verified at the merge; all nine surfaces were re-verified byte-identical to
their originals at each gate since. This directory also holds `lab/README.md`,
`gallery/README.md`, and `vendor/` (the chart.js 4.5.1 byte-record, b640450).
