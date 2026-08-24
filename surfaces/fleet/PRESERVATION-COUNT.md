# PRESERVATION COUNT · the true number behind commit 482412f

Commit `482412f` — "fleet: preserve seven founder surfaces verbatim (no edits)" —
preserved **25 files, not seven**:

- **9** founder HTML surfaces (acid-cascade · blend-lab · bnr-dashboard ·
  edible-tracker · flower-lab · indigo-index · intake-tracker · resonance ·
  spliff-lab)
- **1** VALUE-LOOP-MAP.md
- **15** iq-wiki-entries/*.md drafts

The "seven" in the subject came verbatim from ORDER FLEET-1, which named seven;
the directory held twenty-five files' worth of founder authorship. The seat
preserved everything and flagged the discrepancy in the commit body and its
report; the wrong number is the order's, not the commit's.

History is NOT rewritten — merged history costs more than an imprecise subject.
This note is the correction of record, pointing at `482412f`.

Byte-exactness receipt: every file's sha256 verified against
`git show` of the COMMITTED BLOB (not the worktree copy) before and after
commit — the `surfaces/fleet/** -text` gitattributes pin was required because
all 25 files are CRLF against the repo-wide `eol=lf` law. Hashes in the FLEET-1
seat report of 2026-08-23.
