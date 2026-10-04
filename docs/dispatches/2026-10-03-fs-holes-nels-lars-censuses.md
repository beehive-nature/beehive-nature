# FS AI-Assistant holes — Nels + mother created, Lars christening attached, censuses verified (2026-10-03)

Lane: zBlood/bGenealogy — FamilySearch live-tree enrichment (image-continuation
owner session, founder order "fill in the holes" / "keep going as long as
possible"). Fresh FS login this session ("logged back in"); all work done in
the authenticated browser pane; every attach verified by reload.

## CLAIM → EVIDENCE → BOUNDARY

### 1. Nels Martinsen CREATED and attached — PNC6-GJQ
- CLAIM: New tree person Nels Martinsen (Male, Deceased) created from the
  NUMIDENT record of son Martin Olaf Martinsen; the record (ark 6KQ4-CRGB) is
  attached to him with reason text.
- EVIDENCE: Source Linker post-reload shows `Nels Martinsen → DETACH →
  Nels Martinsen (Father) Male Deceased • PNC6-GJQ`; tree-data v8 details wire
  returns the person (contributor travis remington, this session's date).
- BOUNDARY: Person carries only record-derived data (name from record, sex =
  father slot, Deceased flag). No birth/death dates invented.

### 2. Unnamed mother CREATED and attached — PNCX-S8Q
- CLAIM: Person "UNKNOWN UNKNOWN" (Female, Deceased) created for the record's
  unnamed mother slot; NUMIDENT attached with reason.
- EVIDENCE: Post-reload linker `UNKNOWN UNKNOWN → DETACH → UNKNOWN UNKNOWN
  (Mother) Female Deceased • PNCX-S8Q`; v8 details wire `gender: "FEMALE"`,
  `fullLifespan: "Deceased"`.
- BOUNDARY: Name fields left exactly as FS's own creation panel pre-filled
  ("UNKNOWN"); the person exists to hold the parent relationship + source.

### 3. Lars christening attached to 3 persons — ark 1:1:QG8Q-GRKK
- CLAIM: Denmark, Church Records 1484-1941 entry "Lars Christensen, christened
  1839 Bakkendrup, Løve, Holbæk; father Christian Olsen, mother Maren Nielsdr"
  attached to Lars L1N9-SL2, Christian(Olesen) LW9Z-S11, Maren Nielsdatter
  LZDH-WYF, each with a reason string.
- EVIDENCE: The record was FS's OWN match served on L1N9-SL2's record-matches
  wire (confidence 4, christening 1839 Bakkendrup — the banked parish);
  post-reload linker shows all three rows DETACH.
- BOUNDARY: Attached via the linker FS pre-paired to the founder's hint-card
  cluster (LW9Z-S11 family). The father-principal view of the same register
  entry (ark QG8Q-KWM6, on LW9Z-S11's hint list) was deliberately LEFT
  UNATTACHED — same-event re-index, double-sourcing without founder say-so.

## FINDINGS (no action taken — founder decisions)

### 4. Censuses 1845 + 1850 already attached — to the OTHER cluster
- The 1845 census (QLRK-58ND) and 1850 census (QL6D-XQTF) are both fully
  attached to the L1N9/L1NZ duplicate cluster: father row → L1N9-S2L, mother →
  L1N9-N7Z, Johanne → L1N9-FK1, Niels → L1N9-4JC, Anne Sophie → L1N7-114,
  Karen → L1NZ-RC5, Dorthe Catrine → L1NZ-JLY; Lars L1N9-SL2 and Mette Kirstine
  L1NW-6M1 hold direct attaches.
- Karen (b.~1845), Dorthe Catrine (b.~1847) and Niels (b.~1837) ALREADY EXIST
  in the tree — the check prevented two duplicate creations this session.
- CORRECTED IN-SESSION CLAIM: I first stated the 1850 census was "attached
  nowhere" because it appeared as a hint on LW9Z-S11. Wrong: record-matches
  are PERSON-scoped (a hint on one person says nothing about attaches on
  other persons). The linker's "attached to someone else in Family Tree"
  notes were the decisive evidence. Lesson banked: check the linker's
  attach-notes before inferring global attach state from hint presence.

### 5. Father birth-year conflict — two censuses contradict the tree
- LW9Z-S11 (the founder's hint-card father) says born 1780.
- 1845 census: Christen Olsen born ~1806. 1850 census: age 46 → ~1804.
  Marriage 17 Oct 1834, Finderup, Sæbygård. Children born 1835-1847.
- A father born 1804-1806 fits the marriage-at-~28 and the children's window;
  1780 does not fit either well. The duplicate L1N9-S2L carries 1806.
- NO MERGE attempted: cluster merge (and which birth year wins) is a founder
  decision. Note: relationships survive FS merges, so today's attaches are
  merge-safe regardless of direction.

### 6. Parent-view hint vein — parked behind the cluster decision
- L1N9-S2L has 26 record hints, LZDH-WYF has 23 — mostly parent-principal
  re-indexes of the children's christenings plus marriages/confirmations.
- Attaching them would invest heavily in one side of a contested duplicate
  topology. PARKED until the founder rules on the merge.

## Method notes (styled-components FS linker, for the next seat)
- Row controls ADD/ATTACH render as `<p>` leaves (not buttons). Playwright
  role-based clicks time out; CUA needs FRESH coords read in the same breath
  (layout shifts constantly). The reliable primitive: synthetic `.click()` on
  the leaf/element (React root delegation receives it) — worked for every row
  ATTACH and dialog ATTACH where CUA was blocked by toast overlays.
- The client does NOT await async evaluates — in-page fetches must store to
  `window.__x` and be polled with a sync evaluate.
- Reason textarea is React-controlled: native value setter + input/change
  events, then submit.
- Dialog buttons get covered by success toasts and (at 1280×720) by a
  620px-wide tree-card overlay — synthetic `.click()` bypasses both.
- record-matches wire (authed, in-page):
  `/service/tree/tree-data/v8/record-matches/{pid}/all` — entries at
  `matches[]` with `recordUrl`, `confidence`, `events`, `relations`.
- Person details wire: `/service/tree/tree-data/v8/person/{pid}/details`
  (top-level `gender`, `fullLifespan`, `nameConclusion`; no source list).

## Totals this session
- 2 records newly attached (NUMIDENT → 2 new persons; christening QG8Q-GRKK →
  3 persons) = 5 person-attachments; 2 persons created; 0 duplicates created
  (2 prevented by linker attach-note checks); 1 in-session claim corrected.
- Arc totals (AI-assistant labor incl. earlier sessions): 6 records attached,
  9 person-attachments, 2 persons created, 1 false match refused
  (Benadum/Benedict, evidence-based skip).

## Open frontier (unchanged)
- 2 short-form arks (3QS7-89WB, 3QSQ-G983) — image queue, persistent
  binding-400.
- Eternalization v2: gate STANDING-GRANTED (approval law 2026-10-02), pkg4
  sha256 pinned in ETERNALALIZATION-EDITION-V2.json; settlement awaits only
  the founder's key-holder act.
