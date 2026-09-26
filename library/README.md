# bLibrary — corpus records lane

The document corpus lives OUTSIDE the repo at `~/Downloads/hemp-research/` (the
Bio-Alchemist harvest rail), filed per the standing subject-folders law as
`blibrary/<subject>/`. This directory holds lane law and pointers, never corpus
files. Records with full digests are written to `<corpusRoot>/library-records/`
(kept out of git: the pre-commit hex law blocks 48+ hex runs, and record files
are data, not source).

## Charter (FRESH-SEAT ORDER, founder, 2026-09-26)

Bounded executor, not policymaker. Preserve first, index second, interpret
later, never delete source evidence. No UI/UX work. No agent-created safety,
legal, acceptable-source, or document-removal policy becomes part of Beehive
without an explicit founder ruling.

**Absolute document law:** never delete or quarantine a document; never label a
document "illegal"/"prohibited"/"unauthorized" — uncertain provenance is
recorded as `provenance: unknown`. Documents are evidence/artifacts; the job is
preservation, organization, retrieval, and technical integrity.

**Dedupe is by record, never by deletion:** identical files are grouped as
`canonical` + `aliases`/`copies`; every acquisition path is preserved.

**Damaged files:** marked `CORRUPT` or `PARTIAL`, original bytes preserved,
only non-destructive repair COPIES allowed, never overwriting the original.

**Metadata conflicts:** preserve both claims with provenance; no silent
correction.

## DocumentRecord

Exactly the schema from the founder's order; `scanned_at`/`scanner`/`scan_root`
are additive tool metadata. Mechanical fields are filled by
`scripts/library/inventory.mjs`; title/author/year/source/provenance default to
`unknown` until the metadata (priority 4) and provenance (priority 6) passes.

Routing labels (`subjects[]` from the standing folder taxonomy, plus
`domain`/`evidence_type`/`research_value` in later passes) are routing labels —
never truth judgments.

## Priorities

1. inventory — `scripts/library/inventory.mjs <root>`
2. hash — sha256 per document (same tool)
3. dedupe — content-hash groups, canonical + aliases/copies (same tool)
4. metadata (title/author/year) — OPEN
5. subject classification cross-check vs `blibrary-subjects.mjs` — OPEN
6. provenance — OPEN
7. search/indexing — OPEN
8. research-priority routing — OPEN
9. preservation receipts — `docs/dispatches/` per run

## Access boundary

Ordinary available access paths only; no bypassing captchas, DRM,
authentication, paywalls, or technical access restrictions. Blocked
acquisition is logged as a blocker with the exact cause, then the next item.
Already-held documents are never downgraded because a future path is
unavailable.
