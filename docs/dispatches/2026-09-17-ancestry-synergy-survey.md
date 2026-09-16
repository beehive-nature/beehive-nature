# ANCESTRY SYNERGY SURVEY — three providers, one family, one archive · 2026-09-17

**Seat:** zBlood (`lane/zcode-lineage-import`). **Session:** founder-signed-in Ancestry tab. **Order context:** "my church owns this site now too. i am interested in what kind of synergy we can get ancestry/familysearch/BNR."

## What the founder's Ancestry account holds

**TWO trees, complementary halves of the same family:**

| | Tree 211708694 (older) | Tree 212520723 "Remington Sutphen Family Tree" (newer) |
|---|---|---|
| founder's name form | **loVis waTer nakamoto** | **Travis Mark Remington Sutphen** (the accurate name the founder opened) |
| side | REMINGTON/LOWRY — Kim's line | SUTPHEN/LAWTON — Mark's line |
| persons (familyview window) | 14: Don Ray Remington, Marilyn Remington, Ardella R Lowry, Hyrum Deronda Lowry, John H Lowry, Joyce Lowry, Fuller Rasmussen Remington, Edith Leoma Hadlock, Lyn Remington ×2, Mark, Kim, Jack… | 7: Travis, Mark, Kim, Jack Sutphen, donna, Rollin Eugune Lawton (1894-1974, North Loup NE), Lora Ann Humes (1901-1986, Heber City UT) |
| Kim's parents | present (Don Ray + Marilyn) | EMPTY ("Add father/mother") |
| Donna's parents | — | present (Rollin + Lora) |

**Cross-provider findings:**
- **The same Donna living-flag error appears in Ancestry too** ("donna " lowercase, no death date, flagged Living) — the error the founder already corrected in BNR. Two providers, same wrong flag, one founder attestation.
- **Name-form variants:** FS "Travis Mark Sutphen Remington" vs Ancestry "Travis Mark Remington Sutphen" (surname choice); FS "Rollin Eugene Lawton" vs Ancestry "Rollin Eugune Lawton" (misspelling); the third form "loVis waTer nakamoto" is the estate identity. **One person, multiple name forms — exactly what the internal-identity + refs model holds.**
- **No structural conflict found** between Ancestry and FS on shared persons — the trees agree on relationships; they differ in coverage (Ancestry: shallow, hand-curated; FS: 18,575 persons deep).

## The wire (readable from the founder's session — same principle as FS)

```
GET /api/treeviewer/tree/newfamilyview/{treeId}?focusPersonId={pid}&view=family&genup=N&gendown=M
  → { v: "3.0", Persons: [...], focus: {...} }
```
Person shape: `gid` ("pid:dbid:treeId"), `Names[{g, s}]`, `Genders[{g}]`, `Events[{t:"Birth"|"Death", p: place, nps: normalized place}]`, `Family[{t:"F"|"M"|"H"|"W"|"C", tgid}]` (Father/Mother/Husband/Wife/Child with target gid), `Identifiers[{t:"AncestryPersistentId"}]`. Also observed in the wire: `newpersonhints`, `thrulinesConsolidated` (DNA), tree info/layers.

## The synergy map (BNR as the reconciliation layer)

1. **One identity, many provider records** — the internal-identity model already holds this: Ancestry gids and FS ids become `refs` on the same person; name forms become provider-attested variants, never conflated.
2. **Per-relationship evidence per provider** — where both providers carry the same parent-link, that's TWO independent attestations (evidence layer records each); where they differ, the relationship-evidence model carries the conflict for a founder ruling.
3. **Each provider's unique material as layers** — FS: depth (18,575 walked); Ancestry: record hints, DNA ThruLines, photos/memories, normalized places. None of these is parentage by itself; all preserve with attribution.
4. **An Ancestry adapter is the same shape as fs-adapter** — `harvestResponse(json)` on the newfamilyview payload; `Family[t:"F"/"M"]` → parent edges; the walker runs inside a signed-in tab. Not built this turn — this survey records the wire and the shape.
5. **The church connection** (founder: "my church owns this site now too") — Ancestry's LDS ownership is the historical bridge to FamilySearch's ecosystem; for BNR it means the two major genealogy providers share institutional lineage, which makes cross-provider reconciliation a family conversation, not a custody battle.

## What BNR already has that makes this synergy cheap

- provider-neutral model (proven: GEDCOM round-trips, FS walks, overlays)
- internal identities with refs (proven: stable across re-imports)
- relationship-evidence objects with hypotheses and versioned reconstruction
- research/publication statuses per person
- the corrections layer (founder attestations override provider flags — Donna's living-flag is already corrected in BNR while still wrong in BOTH providers)

**Next step when the founder calls it:** `ancestry-adapter.mjs` — the same harvest/walk/import triple, tested against the wire shapes recorded here.
