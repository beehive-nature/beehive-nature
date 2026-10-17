# 2026-10-17 · lineage — rights-and-provenance qualification of the committed FS 8-generation corpus

**Order:** founder 2026-10-17 — re-issued the standing 2026-09-18 harvest order; an external compliance review established the corpus already exists (809 persons / 13,249 records committed) and routed the work to a rights-and-provenance qualification instead of any new harvest. Founder ruling same message: **we keep everything harvested thus far** — no deletions, no re-harvest. Context recorded: the family are original investors to the LDS church (custodian context for the church-record material, not a rights grant).

**Deliverable:** `assets/profile-archive/lineage/sources/rights-qualification.json` (`skaists.sources-rights/1`) — additive metadata beside the frozen layers; **zero corpus files mutated**.

## What was classified (every committed layer + every local-only tier)

Four axes kept separate — copyright / contract (FS ToS §83) / custodian agreements / privacy — five classes:

| class | content | verdict for ANT |
|---|---|---|
| F family-facts | estate-authored conclusions, relationship-audit reasoning, harvest receipts | **GO** |
| P pointers | citation strings, collection titles, ark URLs, film ids, digests | **GO** (attribution inherent) |
| I fs-index-data | `{factType, fieldType, value}` index-field triplets + hint metadata | **HELD** — founder ruling owed |
| B image-bytes | 314 images / 84,055,524 B, box-local, never committed | **HELD — default never** |
| R private-tier | raw dump 41.2 MB, fs-sync 2.0 MB, living households | **EXCLUDED** (privacy law) |

**GO files:** manifest.json · index.json · relationship-audit.json · search-evidence.json · images-summary.json (digests/counts only — its own boundary field already states bytes are private-tier only).
**HELD files:** records.json (SPLIT — pointers GO, evidence[] held) · sources-sync-2026-10-12.json · sources-sync-2026-10-13.json · hint-census-2026-10-07.json.

## The Class-I seam, quantified (the review's flag, measured)

- `records.json`: **49,342 index-field triplets** across 9,577 of 13,249 records (44,384 non-null values; 15,146 `Original` / 28,241 `Interpreted` fieldTypes; max 72 per record). Top factTypes: Name 16,803 · OTHER 15,190 · Gender 10,589 · Birth 1,945 · Death 705 · Census 662.
- `sources-sync` (the transcription pass on the founder's live session, 2026-10-13): 1012-layer 11 persons / 37 newSources / **153 triplets**; 1013-layer 37 persons / 64 newSources / **427 triplets**.
- `hint-census-2026-10-07`: 823 pids swept, 85 open hints (23 cohort + 62 extramural), 3 extramural persons redacted.
- Copyright axis: the VALUES are facts — not protectable expression. Contract/custodian axis: this is bulk-extracted FS index-database content; FS's published guidance permits personal research, not wholesale index republication. Both axes recorded separately; the qualification does not convert one into the other.

**Completion criteria for the Class-I gate (either, founder's call):** (a) rule replicate-as-is; or (b) the next ANT edition ships Class-I files stripped to the conclusions already expressed in the estate-authored corpus person objects (Class F) — the facts survive, the FS index-database dump does not ride the permanent network.

## Custodian census (title-regex bucketing — this pass's own method, boundary named)

state-town-vital **4,571** · church-records (LDS Record of Members/Church Census; England/Denmark parish) **1,408** · partner-index-trees (Ancestry trees, Find A Grave, Geneanet, Millennium File, AGBI, American Ancestors, SAR) **1,223** · us-federal (census, NUMIDENT) **779** · published family histories **20** · **unresolved 5,248** — honest gap: the regex did not match these titles; a per-record pass completes the census if the founder ever wants custodian-exact accounting.

Notes: the us-federal bucket's UNDERLYING records are US public domain — that benefits a future re-source-from-NARA lane (founder-gated, not this lane), not redistribution of the FS-served scans. The partner-index-trees bucket is the most restriction-sensitive for index content; what is staged from it is facts-and-citations only, no prose.

## ANT state verified — the one-way door is still closed

- `ETERNALIZATION-RECEIPT.json`: quoted-not-purchased, purchased=null, uploaded=null.
- `zblood-storage-economics.json` v3 (2026-10-02): approved/purchased/uploaded all false; the 2.76 ANT quote exceeded the 2.5 ANT storage ceiling → **paid path code-disabled**.
- Image harvest terminal @dbe231eac (2026-10-16): 382 attempted = 314 downloaded / 84,055,524 B / 68 explicit denials; queue 376 entries 100% resolved.
- **Privacy gate separate and open:** PRs **#346** and **#347** verified OPEN today via `gh` — rights qualification does not substitute for them; both gates close before any ANT edition.

## Provenance of the analysis

- Read-only: committed files in the shared checkout + `git show origin/main:` copies of the three main-only files (sources-sync ×2, hint-census) + main's images-summary (314-image terminal state; the shared checkout's copy is one state behind at 308 — named, not silently mixed).
- Scripts: `scripts/tmp/rights-audit/01-schema.cjs · 02-deep.cjs · 03-classify.cjs · 04-images.cjs` + `classification-counts.json` (seat scratch, uncommitted by design).
- Acquisition facts inherited from the lane's own receipts (manifest harvestMeta, dispatch 2026-09-18, commits de36ef416/dbe231eac): founder's signed-in session, the site's own wires, pacing ≥160 ms, guard-enforced queue law, explicit-denials-only outcomes.

## Boundaries NOT crossed

- No FamilySearch access of any kind this lane; no corpus mutations; nothing deleted (retain order); no GitHub writes before this branch; no money, no ANT.
- The Class-I content's standing git-history exposure is retained per the founder order — this qualification governs the future irreversible replication step, not the retained past.

## Next owners

- **Class-I ruling + ANT edition assembly** → zBlood/preservation seat (criteria above; privacy PRs #346/#347 must merge first).
- **Custodian census completion** (5,248 unresolved titles) → optional follow-up, needed only if custodian-exact accounting is ever required.
- **NARA re-source lane** (public-domain federal subset, if the founder ever wants image bytes on a permanent network) → new lane, founder-gated.
