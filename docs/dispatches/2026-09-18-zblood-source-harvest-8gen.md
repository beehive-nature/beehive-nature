# 2026-09-18 · zBlood — FamilySearch material-evidence harvest, 8 dead generations (grandparents on)

**Order:** founder, 2026-09-18 — "scrape every bit of familysearch.com material evidence for at least 8 dead (grandparents on) blood relative generations. we will stage it here and github and later ANT."

**Scope executed:** the 8 deceased blood generations from the grandparents on — depth 2 (Jack Benedum Sutphen · Donna Ruth Lawton · Don Ray Remington · Marilyn Lowry) through depth 9 (7×great-grandparents) from root `L627-FH9`, per the walked corpus. Living generations (founder, parents) excluded — no living-id leakage.

## What was harvested (the wires, from the founder's signed-in session)

The person page's own same-origin wire, cookie session, no credentials touched:

| wire | carries |
|---|---|
| `GET /service/tree/tree-data/v8/person/{pid}/details` | person summary + `sourceCount` + `parents[]` (used to REPAIR the walk's depth-9 frontier — see below) |
| `GET /service/tree/tf/person/{pid}/entityref?version=2` | every source REFERENCE: source id, who attached + when, **which conclusions it supports** (`affectedConclusionTypes`), change messages |
| `GET /service/tree/links/sources/{ids}?readExternalData=true` | the source records themselves: full citation line, ark record URL, title, event place, field-level transcription (`evidence.facts`), notes |

**The walk repair (honest accounting):** the 2026-09-16 pedigree walk (18,572 persons) stopped its 8-gen windows one generation short of this order's depth — **278 ancestor pids at depth 9 were referenced-but-never-fetched** ("danglers"), plus 79 parent slots never referenced. This harvest repaired the frontier live: v8 details per dangler + parent-closure from every cohort person's `parents[]`. Every repaired person entered the evidence phase; every provider refusal is named in the reconciliation, never silently dropped.

## Numbers (final, from `manifest.json` — harvest 2026-09-18 22:45–23:01 UTC, 16 minutes)

- **2,502 requests, 0 errors, 0 retries** (pacing ≥160ms, single worker, resumable)
- **809 cohort persons served** — depth 2:4 · 3:8 · 4:16 · 5:32 · 6:60 · 7:112 · 8:203 · 9:374
- **The frontier repair:** depth 9 grew 71 → 374 (278 danglers fetched + 25 new via parents-closure); **every** provider ref resolved — 0 missing, 0 refused
- **23,673 entity refs total · 13,589 SOURCE references · 13,249 unique source records** (340 shared across persons)
- **Cross-wire reconciliation: 0 mismatches** — every person's v8 `sourceCount` equals the harvested SOURCE-ref count (two independent wires agreeing person-by-person)

## Honest gaps (named, not hidden)

- **Don Ray Remington + Marilyn Lowry carry 0 attached sources on FamilySearch itself** (their private-space records are living-flagged, so nothing attaches). The provider reports sourceCount 0; the harvest reports the same. Their material evidence will need a records-search pass keyed to their documented facts — a founder-decision follow-up, not a harvest failure.
- Record IMAGES not downloaded (ark URLs staged as retrieval pointers).
- Corpus regeneration (folding sources into corpus-v2 + person objects) is the named next step; this lands the layer + importer without rewriting the frozen corpus.

## Staged layers (three-tier, per the doctrine)

| layer | where | content |
|---|---|---|
| PRIVATE full fidelity | `C:/Users/travi/family-lineage/sources-harvest/` (never committed) | raw dump + full transcription facts, notes, change messages, contributor ids |
| PUBLIC corpus layer | `assets/profile-archive/lineage/sources/` (this branch) | `manifest.json` (`skaists.sources-manifest/1`) · `index.json` (`skaists.sources/1`, per-person source lists keyed by internal iid) · `records.json` (`skaists.sources-records/1`, deduped public records) |
| Tooling | `tools/genealogy/fs-adapter.mjs` + `sources.test.mjs` | `PAGE_SOURCE_WALKER_SOURCE` (the resumable page runner) · `parseEntityRefs` / `parseSourceDescriptions` / `publicSourceRecord` (pure) · `importSourceWalk` (support-axis upgrade) — 6 new tests, genealogy suite 56/56 |

**ANT staging:** the sanctioned preservation path (approved snapshot discipline from the zBlood waves) takes this layer in the NEXT edition — the current frozen pkg3 edition is untouched. The public sources layer is deliberately structured to ride `preserve.mjs` declared-contents in that next edition.

## Privacy laws applied

- Living-flagged non-attested persons: unnamed, unkeyed (no fsid) in the public index.
- The four grandparents: NAMED per the grandparent law (founder-attested deceased; Don Ray + Marilyn carry the FS living-flag error as documented corrections, not overrides of the record).
- Citation/title/fact redaction: any string containing a living-flagged person's name is redacted (`[redacted-living]`) with `redactedLiving: true` — counted in the manifest.
- Raw transcription facts (census households etc. may name living people) stay in the PRIVATE layer only. Public records carry citation + ark URL + affected conclusions + attachment attribution.

## Evidence-layer doctrine compliance

- **Citations, not counts** (ninth-wave law): each source reference carries which conclusions it supports; `importSourceWalk` upgrades `evidence.support` → `"sourced"` with an honest basis string — era untouched, attested never downgraded, unsourced stays unsourced when no sources exist.
- **Attribution distinguishes:** contributor ids ride privately; the public layer keeps the citation's own attribution line.
- **Reconciliation:** manifest counts ok / provider-refused / no-refs — every cohort pid accounted for.

## Boundaries NOT crossed

- No money moved, no ANT upload ran — staging only, per the order ("later ANT" = the next approved edition; frozen pkg3 untouched).

## Provenance

- Session: founder-signed-in familysearch.org tab (IAB), founder's own account, his own family tree — the same wire the site's own UI uses.
- Runner: `PAGE_SOURCE_WALKER_SOURCE` in `tools/genealogy/fs-adapter.mjs` (verbatim the executed code, backticks flattened for embedding).
- Raw receipt: `C:/Users/travi/family-lineage/sources-harvest/raw-dump.json` (private).
