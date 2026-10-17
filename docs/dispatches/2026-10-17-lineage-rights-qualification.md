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

**Completion criteria for the Class-I gate (corrected 2026-10-17 — a founder ruling sets risk posture, it does not create redistribution rights):** (a) rights established through the FS/custodian channel (ToS §83 contemplates prior written permission); or (b) **omitted from the permanent-network edition — the recommended default**: the ANT edition is built from rights-qualified estate-authored facts and citations, so the facts survive in Class-F conclusions while the FS index-database dump does not ride the permanent network. GO files are per-file candidates, never blanket clearance.

## Custodian census (title-regex bucketing — this pass's own method, boundary named)

state-town-vital **4,571** · church-records (LDS Record of Members/Church Census; England/Denmark parish) **1,408** · partner-index-trees (Ancestry trees, Find A Grave, Geneanet, Millennium File, AGBI, American Ancestors, SAR) **1,223** · us-federal (census, NUMIDENT) **779** · published family histories **20** · **unresolved 5,248** — honest gap: the regex did not match these titles; a per-record pass completes the census if the founder ever wants custodian-exact accounting.

Notes: the us-federal bucket's UNDERLYING records are US public domain — that benefits a future re-source-from-NARA lane (founder-gated, not this lane), not redistribution of the FS-served scans. The partner-index-trees bucket is the most restriction-sensitive for index content; what is staged from it is facts-and-citations only, no prose.

## ANT state verified — the one-way door is still closed

- `ETERNALIZATION-RECEIPT.json`: quoted-not-purchased, purchased=null, uploaded=null.
- **Correction (descendant commit, founder order 2026-10-17):** the first push of this dispatch cited the shared checkout's stale 2026-10-02 copy of `zblood-storage-economics.json` — "2.76 ANT quote exceeded the 2.5 ANT ceiling → paid path code-disabled" — **withdrawn as superseded**. Main's current file carries the founder's **100 ANT storage cap** (ruling 2026-10-03, "that is like $0.25 cents. 100 ANT cap for now", banked by PR #326 + `ETERNALIZATION-EDITION-V2.json::separatedCeilings`; **reaffirmed by founder order today, "THE CEILING IS 100 ANT"**) and a 2026-10-11 quote of 5.009 ANT for the 286,801,920-byte edition — within bounds. Purchased/uploaded remain false. Spend approval is STANDING-GRANTED (founder 2026-10-02c, "approval always. never gate me"); the payment path is disabled for **capability, not price**: ant 0.3.9 exposes no atomic storage/gas ceilings, and the hosted purchase path caps files at 32 MiB. The one irreducible act stays the founder's key-holder signature.
- Image harvest terminal @dbe231eac (2026-10-16): 382 attempted = 314 downloaded / 84,055,524 B / 68 explicit denials; queue 376 entries 100% resolved.
- **Privacy gate — RECONCILED 2026-10-17 (stale at first push, corrected):** PRs **#346** (superseded) and **#347** (landed-through-main) are **CLOSED** — closures executed 2026-10-17T19:09Z via API with receipts, gh-verified this lane, after this lane's earlier same-day OPEN check; founder ratification **"RATIFY APPROVED, chat 2026-10-16"** recorded verbatim in the s7 instrument @8e5fa5d05 (nine-hash exception set in full, no founder-personal-authorship claim, no retroactive CI verdict, and a NO-EXPANSION clause: **no genealogy collection, no ANT publication**). ANT remains separately gated behind the rights + purchase gates below; this seat verified the repo record, not the original approval conversation.

## Provenance of the analysis

- Read-only: committed files in the shared checkout + `git show origin/main:` copies of the three main-only files (sources-sync ×2, hint-census) + main's images-summary (314-image terminal state; the shared checkout's copy is one state behind at 308 — named, not silently mixed).
- Scripts: `scripts/tmp/rights-audit/01-schema.cjs · 02-deep.cjs · 03-classify.cjs · 04-images.cjs` + `classification-counts.json` (seat scratch, uncommitted by design).
- Acquisition facts inherited from the lane's own receipts (manifest harvestMeta, dispatch 2026-09-18, commits de36ef416/dbe231eac): founder's signed-in session, the site's own wires, pacing ≥160 ms, guard-enforced queue law, explicit-denials-only outcomes.

## Boundaries NOT crossed

- No FamilySearch access of any kind this lane; no corpus mutations; nothing deleted (retain order); no GitHub writes before this branch; no money, no ANT.
- The Class-I content's standing git-history exposure is retained per the founder order — this qualification governs the future irreversible replication step, not the retained past.

## Reconciliation rider 2026-10-17 (descendant, after external review)

- **Privacy gate reconciled:** first push recorded #346/#347 OPEN (true at this lane's earlier gh check); the closures executed 2026-10-17T19:09Z after that check. Corrected above; the ratification commits (a2b2abf7d + aa5e366dd + 8e5fa5d05, with the no-expansion clause) now sit under this branch via the origin/main merge.
- **Quote-staleness law adopted:** the 2026-10-11 quote (5.009055375 ANT / 286,801,920 B) is historical affordability evidence under the 100 ANT cap — never a purchase authorization against a new edition hash; upload time requires a fresh quote bound to the exact artifact + destination, both ceilings enforced against the actual transaction, stop on any mismatch.
- **Class-I boundary sharpened:** rights are established through the custodian channel or the content is omitted — a founder ruling alone cannot create them (FS guidance distinguishes fact extraction for family history from wholesale index republication). Recommended default adopted: the ANT edition omits Class-I.
- **CI state named:** every hosted check on this branch was pending at rider-writing (fleet saturation continuing from the 10-16 watches); no verdict exists; no polling loop per estate discipline — the next push or wake re-checks once.
- No FS access, no corpus mutations, no money, no ANT, no merge of this PR by this seat.

## Next owners

- **Class-I disposition + ANT edition assembly** → zBlood/preservation seat (criteria above; privacy gate now CLOSED @8e5fa5d05; recommended composition = Class-I omitted; the payment-client capability blocker is owned there too).
- **Custodian census completion** (5,248 unresolved titles) → optional follow-up, needed only if custodian-exact accounting is ever required.
- **NARA re-source lane** (public-domain federal subset, if the founder ever wants image bytes on a permanent network) → new lane, founder-gated.
