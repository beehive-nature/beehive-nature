# GUX-01 zGenePerson — rider: the curiosity layer (discovery strip + one-more-ancestor teasers)

**Seat:** zGenePerson (GLM 5.3, zCode session). **Base:** the person-panel lane @`6c1008f1` (same pin `97f18945`). **Branch:** `zcode/gux01-geneperson-2026-09-18`.

## The founder's correction this rider answers

> "The graph is not the product. The graph is the instrument for discovering people." — open with real people and real discoveries, not controls; the first 30 seconds should produce a "holy shit, I didn't know that" moment; **the next grading criterion is whether someone wants to click another ancestor after the first one.**

zGenePerson's share of that: the panel now CATALYZES CURIOSITY itself, so zGeneAtlas has something surprising to surface rather than invent.

## What shipped (v1.1 — same files, contract extended with OPTIONAL methods)

**The discovery strip (the panel's opening view).** Computed by the archive at run time — every number derived, nothing hardcoded, every hook opens a real person/pair/query. At this pin, standing at the Rockwood public entrance, it reads:

- **10,259 people · the spine runs 42 generations to Randver Radbardson (0670–0730)** — the corpus's own numbers (the founder's message said 45; the pin corpus canon is 42 — the earlier lane correction holds, the strip never reinstates the wrong number).
- **the deepest published line runs 143 generations — E Anna Tum DE LAGASH · 2430 BC** (labeled *published, not verified* — the person view carries the era≠support chips; the hook never oversells).
- **50 ancestors repeat in the 12-generation pedigree — pedigree collapse; Tacy Cooper appears 3×** (deterministic exemplar: count desc, birth asc).
- **593 couples were cousins as well as spouses (within 16 generations) — e.g. Jack Benedum Sutphen ⚭ Donna Ruth Lawton** — the first cousin couple in corpus order is the founder's OWN grandparents (common ancestor Joseph Clarke 1642–1726). The bound is stated in the sentence; the full-depth count is 661, the bounded hook is what renders.
- **44 records loop — the medieval web repeats people as their own ancestors — Lucius Munatius Plancus (Rome).**
- **the frontier: 1,959 parent references continue beyond the published archive — even here: the line from the standing root stops at Samuel Rockwood I (3 generations up)** — the public entrance's own dead-end told as a story; the hook opens Samuel's view, which shows his two ghost parents as counts.
- **281 names belong to more than one person — Margaret belongs to 16. The archive never picks for you.** — opens the Margaret ambiguity view (16 candidates).

**"keep exploring — one more ancestor" teasers (person view).** Derived ONLY from archive-proved facts (pure `buildTeasers(view, ctx)`, absence of a fact = absence of a teaser, test-locked): ⚭ married-cousins pointer when a spouse is also blood (opens both lines) · ⊙ pedigree-collapse repeat ("appears 3× in the 12-generation pedigree — one person, several positions") · ⧉ namesakes ("3 people share this exact name — see them all") · spine position ("generation 2 on the spine"). Donna's view, for instance, offers the grandparents' blood-and-affinity view AND her spine position.

**Search as discovery, not database.** A miss now rescues toward the surname's real people: *"no one is named 'Zzzz Hadlock' — but 13 people carry the name 'Hadlock'"* with clickable rows. The typeahead miss, ambiguity view, and null view all keep their honest wording.

**Contract additions (all OPTIONAL — any archive without them degrades to the plain prompt, silently and lawfully):** `discoveries(rootId)`, `pedigreeOccurrences(rootId, gens=12)`, `spineIndex(id)`, `nameShares(name)`, `nameHolders(name)`; controller `home()` returns to the strip. `PP_VERSION = 'person-panel/1.1'`.

## Evidence

```
$ node --test tools/genealogy/personpanel.test.mjs     tests 44 · pass 44
$ node --test tools/genealogy/*.test.mjs               tests 94 · pass 94 · fail 0
                                                       (50 pre-existing + 44, zero regressions)
$ node scripts/estate-check.mjs                        PASS 96/105 (atlas untouched)
```

Browser acceptance **twice-stable, zero page errors, zero failed requests** — new steps: strip opens the experience with the wow hooks · the deepest-line hook opens E Anna Tum de Lagash (2430 BC) · Esc returns to the strip · Donna's teasers present (cousins + spine) · teaser click opens the grandparents' blood-and-affinity view · a search miss rescues toward the Hadlocks · 390px strip renders. New shots: `01b-deepest-hook-opens-lagash`, `08b-teaser-click-cousins`, `13b-null-rescue-discovery`, `15a-390-discovery-strip`. Visual floor re-proven: 0px overflow at 390/640/900. CR=0, hex≥48=0 in touched files.

## Boundaries held

Same fences as the parent commit: no blood.html/archive.mjs/corpus/model/profile edits; no corpus writes (test I6 re-proves byte-identity after the full curiosity battery); views frozen; living/private leakage laws unchanged; the Archive-1.1 quarantine untouched (`relationship()` remains the single temporary function).

## For zGeneAtlas (the semantic-zoom combination)

The strip and teasers are mountable NOW: as you zoom toward a branch and topology becomes named people, one click → `panel.openPerson(id)` opens the story **without losing spatial position** (the panel hosts in a side drawer; the host keeps the viewport). The optional-methods degradation means the atlas harness can mount the panel against any archive subset while iterating freely.
