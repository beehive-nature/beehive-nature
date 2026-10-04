# FS tasks-page harvest — 9 records / 20 person-attachments / 2 persons created (2026-10-04)

Lane: zBlood/bGenealogy — FamilySearch live-tree enrichment (image-continuation
owner session, standing orders "approval always / never gate me", "keep going
as long as possible — the stronger seed"). Fresh founder login this wake
("logged back in"). Every attach reload-verified (DETACH chip).

## CLAIM → EVIDENCE → BOUNDARY

### ATTACHED (9 records, 20 person-attachments, all reload-verified)
1. **LDS Record of Members 62XG-3FTR** (Walter Dow baptism, 2 Apr 1910 Vernal)
   ×3: Mary Ann Hadlock KWCT-391 (mother named), Walter Dwight Dow LCZ5-8QV
   (father Dwight), Walter John Dow KWJZ-YG2 (baptismal subject). This was the
   10-03f-verified match, attached this wake after the page rendered healthy.
2. **1950 US Census 6XBC-99QD** ×2: Irving Albert Cook LJDF-JY4 + Beulah Ida
   Benidem L49V-3DJ (FS conf-5 pairing; census ages 1880/1891 vs tree
   1879/1888 = normal census-year rounding, noted not overwritten).
3. **Ohio Deaths and Burials F6DZ-8TB** ×1: Irving A. Cook LJDF-JY4 (burial
   1952 matches tree death year).
4. **GenealogyBank obituary X3J9-XF11** (Daniel L Briggs's obituary, Portland
   Press Herald 6 June 2025) ×5: Chester Arthur Briggs L21W-9ZT (father),
   David Arthur Briggs LL4G-322 (son), **Daniel L Briggs CREATED = PNC5-R9G**
   (full record vitals: b. 2 Feb 1937 Pontiac MI, d. 1 June 2025), **Jim
   Briggs CREATED = PNCP-RDN** (Male, marked Living protectively — no death
   evidence, born-context <110y per FS guidance). Theodora's wife row was
   already attached (someone else's earlier work). Identity proven by the
   tree's own spouse: Theodora BELL LAWTON = the record's "Theodora Lawton
   Briggs".
5. **Utah WWI County Draft Board Registers Q57B-6Z9J** ×1: Rollin Eugene
   Lawton KWCL-VJS — the founder's GREAT-GRANDFATHER (Donna Ruth Lawton's
   father). Indexed "Rowlin Lawton" (variant), Duchesne County 1917-18 =
   exactly his unsourced draft-registration event; FS's own record page
   already associated the record with KWCL-VJS. His task cleared from the
   rail after attach (task-list confirmation the attach registered).
6. **BillionGraves Index VRX7-KLP** ×1: Cleo Remington LFT4-DTM — the stone
   of her husband Lee Clawson Atkin KWZ7-YMT (marriage 20 Mar 1953 IDENTICAL
   on tree and index; spouse name indexed UNKNOWN/unreadable; v8 details wire
   confirms her Atkin spouse conclusions). Reason string states the
   association honestly.
7. **US Obituary Records 61FV-SF96** (LaVaun Whitney Worthen obit, SLC 2018)
   ×1: Lewis Frederick Rockwood KWZR-P2T — named as husband of "Muriel
   Rockwood (Lewis)"; tree wife Muriel Whitney KWZR-P2Y already carried the
   wife-row attach; the tree's own census notes say "Lewis and Muriel living
   in SLC 1940".
8. **1920 US Census MD15-G6P** ×4 (Newark, Licking, Ohio): Clara D Daseler
   GC86-D18 (mother/head), Oscar Fredric Schneider GC86-FL9 (15, b. Indiana —
   husband of Helen Maria SUTPHEN L1K1-P6X, the founder's Sutphen line),
   Maree M Schneider GC86-D1K, Claire Elizabeth Schneider GBKX-TGP.
9. **1930 US Census X74W-2X8** (Rifle, Garfield, Colorado) ×2: Marion Cecil
   Draper LCJS-38R + Rubey P Johnson LVXM-WHK (indexed "Ruby M" — spelling
   variants, both b. ~1896; tree also carries his later wife Doris Katherine
   LAWTON LH12-2WT — the Lawton intermarriage again).

### REFUSED (3, evidence-based skips)
- **Lloyd Luzerne Lawton × NY 1925 State Census KSSD-JGC**: name+age match,
  but the record places a 19-y-o "son" in an Alexandria, Jefferson, NEW YORK
  household while the family's documented 1910/1920/1930 residences run
  Utah→Utah→Colorado. Geographic contradiction (FS itself marked it weaker).
- **Charles C Benadum × F6VY-27T** (Charles BENEDICT death record): standing
  refusal re-issued — different surname, source attached to his own person.
- **Henry Carroll McMillan × Q2Q1-F3HM** (Joseph McMillan's 1984 Chico
  obituary): garbled index ("Harold Giles" appears as BOTH M and F, no
  readable obit body, no Henry/Carroll McMillan anywhere in the entry);
  nothing ties the record to the tree person.

### SKIPPED as same-event re-index (2, consistency with the parked QG8Q-KWM6)
- Theodora Bell Lawton's task (X3R1-XZLG) = her own index-view of the SAME
  GenealogyBank obituary already attached to her via the family view.
- Phylena Eliza Lawton's task (VP18-DX2, "Phylena E" divorce) = a third index
  variant of her 1978 Orange CA divorce already cited via the "Phylena E
  Dutton" entry (record page's own Similar-Records shows it attached).

## Method notes (tasks page, for the next seat)
- The portal "Record Hints" rail virtualizes: only near-viewport cards are
  real DOM; the full list lives at **/en/home/tasks/** (SHOW ALL (11) link).
- Expanding an entry: the hint icon is an empty-text BUTTON in the entry row.
  Reliable primitive = climb from the person-NAME LEAF (loose contains-match;
  exact-trim fails on split markup) up to the node whose text has VIEW
  RELATIONSHIP + the birth year + <500 chars, then click its empty button;
  the expanded entry then exposes the record via a Review link
  `/ark:/61903/1:1:{ark}?...&treeref={pid}`. Expanded entries STAY expanded.
  pid copy-buttons virtualize away between renders — do not depend on them.
- After attach, the task clears on next page load (Rollin's did).
- The record-matches wire (/record-matches/{pid}/all) stays EMPTY for many
  rail-listed persons — the tasks rail and that wire are DIFFERENT systems;
  the tasks page is the hub for rail hints.
- Census/obit person-create panels pre-fill names; sex radios sometimes
  pre-check (Daniel M) sometimes not (Jim needed Living selection —
  scrollIntoView FIRST or the click silently misses an off-viewport radio).

## Totals
- This wake: 9 records / 20 person-attachments / 2 persons created / 3
  refusals / 2 same-event skips. Zero duplicates created (match-over-create
  everywhere; every pre-pairing read before clicking).
- Combined arc (10-03 + 10-04): 15 records attached, 29 person-attachments,
  4 persons created, 4 false matches refused, 3 same-event re-indexes parked.

## Open frontier (unchanged)
- 2-ark image queue: closed at 366/366 (10-03). Eternalization: PR #336
  (codex seat) + ceiling-atomic payment client. New-person hints (PNC6-GJQ,
  PNCX-S8Q, PNC5-R9G) still computing async — re-check next wake.
