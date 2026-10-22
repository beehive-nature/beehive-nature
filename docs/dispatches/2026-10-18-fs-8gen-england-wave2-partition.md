# fs 8-gen custodian research, England wave 2: the county/parish partition (2026-10-18)

zCode seat (order-28 wake). Offline partition only, the step the adopted
custodian plan names next ("England (wave 2) is partitioned by county and
parish next" — `2026-10-18-fs-8gen-custodian-wave1.md` §3). Zero FamilySearch
requests, zero archive requests, zero image bytes, zero private-tier writes.
The FamilySearch automated frontier stays stopped.

**Evidence:** `docs/dispatches/evidence/2026-10-18-frontier-england-wave2-partition.json`
(skaists.frontier-partition/1), counts only, no person data. sha256
`5395368ba7f650131f9882779dae11319e7a3b9ef86f658706c508a70128d8f8` <!-- PUBLIC-CONSTANT: sha256 of the partition evidence file -->.

## 1. Universe and rules (all read at origin/main `06f523c0b`)

Identifiers are the **1:1 arks embedded in citations** of England-headed
records (the lane C-rule regex), restricted to the frozen frontier queue
(7,114) and minus terminal outcomes (mapped / no-image-available in the
stopped run). Geography comes from each embedding record's `event.place`:
the ", England" and ", United Kingdom" tails are stripped, the last segment
is the county and the earlier segments the parish; an English historic
county appearing without the country word is accepted as the county
(Somerset ×26, Buckinghamshire ×2 in the raw data); church-only places are
"(parish only, county unknown)" (×1); 39 identifiers carry no place. Dates
use the order-28 corrected tail rule (day-month and dual years admitted).
Title folds: the B&C trailing-comma variant, and the England Marriages
manifest twin rows. An ark embedded in more than one record takes the first
record's place/date — 6 conflicts counted, not resolved.

## 2. Reconciliation: 35 of 35 collections accounted for

**1,325 England-headed records carry 1,321 embedded ark instances; 1,020
distinct queue identifiers, all unresolved** (the England cohort contains
none of the 40 observed frontier outcomes — consistent with the first-batch
probe being Massachusetts/NUMIDENT-heavy). Against the 2026-10-17 custodian
manifest's 35 England rows summing **1,021 assignments**: 34 collections
match exactly, and the 35th is the twin artifact — ark `N2QQ-YYZ` is
embedded under both "England Marriages, 1538–1973" spellings, so 47
assignments = 46 distinct + 1 double row. **1,020 distinct = 1,021
assignments − 1, closed with no residue.**

## 3. The partition

| county | identifiers | leading parishes |
|---|---:|---|
| Buckinghamshire | 189 | Aylesbury 90 · Chalfont St Giles 46 · Ivinghoe 21 · Dinton 16 |
| Yorkshire | 138 | Wetwang 34 |
| Bedfordshire | 113 | Studham 75 · Harrold 22 · Luton 14 |
| Somerset | 102 | Wincanton 49 · Frome 29 |
| Gloucestershire | 91 | Chipping Campden 44 |
| Berkshire | 64 | South Moreton 20 · Shinfield 13 · Bradfield 13 |
| Warwickshire | 63 | Foxcote 37 · Barford 19 |
| Worcestershire | 53 | Abberley 24 · Church Honeybourne 21 |
| Dorset | 41 | Portesham 40 |
| Rutland | 31 | Seaton 25 |
| (no place) | 39 | — |
| Wiltshire 14 · Hertfordshire 13 · London 10 · the rest ≤ 9 | | |

Date classes over the 1,020: **690 year-only · 325 full date · 0 dual ·
5 no event date**. Three of the nine largest counties — Gloucestershire,
Worcestershire, Dorset — have **no county-headed collection row at all**:
every identifier there rides the England-wide indexes (Births and
Christenings 1538-1975, Marriages, Deaths and Burials), so their custodian
is per-parish, found through the index, exactly the class the plan says is
"the first research task, not an assumption made here."

## 4. Next (research only, per the plan's own order)

For the eight parishes at ≥34 identifiers — Aylesbury, Studham, Wincanton,
Chalfont St Giles, Chipping Campden, Portesham, Foxcote, Wetwang — confirm
the original custodian and its official catalog, the coverage years, the
permitted research method and the copy/publication conditions, each cited
from the custodian's own pages (a landing page proves a research route
only). Fill the collection-qualification rights fields for the England-wide
indexes (their custodians are the underlying parishes). Nothing is
acquired, matched, or published until a collection's rights field is filled
from a cited source; rights stay UNASSESSED.

Zero FamilySearch requests; the queue and stopped-run manifest were read
(counts only); zero private-tier writes; the corpus is unchanged.
