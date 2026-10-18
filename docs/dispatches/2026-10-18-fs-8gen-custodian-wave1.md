# fs 8-gen custodian research, wave 1 set-up (2026-10-18)

Seat 3 (Claude Code). Documentation and offline partition only. It follows
the adopted custodian plan (`114fcff90`). Zero FamilySearch requests, zero
archive requests, zero image bytes, no outreach. The FamilySearch automated
frontier stays stopped.

## 1. Collection qualification records (12 largest)

`docs/dispatches/evidence/2026-10-18-frontier-collection-qualification.json`
carries one record per collection, with the seven fields required before any
acquisition: custodian, catalog URL, coverage, permitted research method,
bulk-access policy, publication rights and supporting source.

The routes come from the founder-relayed desk research (chat 2026-10-18).
**This seat has not fetched or verified any of them**, so each one is labelled
`relayed`, and everything not stated there is `UNASSESSED`. Publication
rights are UNASSESSED for every collection. Two relayed restrictions are
recorded as given: Denmark asks for contact before more than a few image
downloads, and the Church History Library may restrict records or require a
request for bulk digitization or publication. Find a Grave and the LDS
membership records sit in separate rights-review tracks.

The 12 collections hold 3,997 of the 7,108 collection assignments.

## 2. Wave 1 partition: Massachusetts + Connecticut

`docs/dispatches/evidence/2026-10-18-frontier-ma-ct-partition.json`, built
offline from the public `records.json` (sha in `114fcff90`) against the frozen
frontier manifest. It holds counts only, no person data.

| cohort | collections (unresolved) | distinct identifiers | towns |
|---|---|---|---|
| MA | Births and Christenings 814 · Town Clerk 551 | 1,365 | 81 |
| CT | Births and Christenings 353 · Vital Records prior to 1850 158 | 511 | 37 |

The collection counts match the custodian manifest exactly, and wave 1
totals 1,876. Neither state's two collections share an identifier.

- **MA:** Middlesex 510, Worcester 243, Suffolk 136, Essex 122, Hampshire
  86, Berkshire 81, Bristol 67. The top towns are Holliston 164, Chelmsford 112,
  Sherborn 86, Pittsfield 79, Lancaster 68 and Norton 63. The records are
  mostly births (1,001), then marriages 150, christenings 100, deaths 52 and
  baptisms 44. They peak 1700s to 1760s. 570 citations carry no trailing year.
- **CT:** Hartford 175, New London 86, Litchfield 85, Windham 44, Middlesex
  41, Tolland 35. The top towns are Suffield 76, Salisbury 50, and Saybrook and
  Coventry at 28 each. Births are 467 of the records, peaking 1720s to 1750s.
- Colonial place strings ("Massachusetts Bay Colony, British Colonial
  America") are read as the state. Without that rule, 701 MA identifiers
  fell outside the state; one MA and one CT place remain unplaced.

Because the originals are town registers, one town clerk or state archive
catalog can serve identifiers from both index collections. The partition is
grouped by town for that reason.

## 3. Next, research only

For each wave-1 town: confirm the original custodian and its official catalog,
the coverage years, and the permitted research method. Fill the qualification
fields from the custodian's own pages, citing each one. England (wave 2) is
partitioned by county and parish next. Nothing is acquired, matched at
volume, or published until a collection's rights field is filled from a cited
source.

## 4. Addendum: first verification pass (founder word, chat 2026-10-18)

This seat read the official pages read-only on 2026-10-18. Each qualification
record now has a `verification` block with this seat's URL, check date and
outcome, kept apart from the founder-relayed second pass. **Rule recorded in the
file:** a landing page proves a research route only. It never verifies a
collection, an original image or a publication right. Publication rights stay
UNASSESSED for all 12. The Find a Grave record carries only a relayed
contributor-permission note, also unverified.

| collection | this seat's check | disposition |
|---|---|---|
| MA (both) | sec.state.ma.us page **unreadable** (empty body, fetch and pane) | not qualified; relayed: links largely return to FamilySearch; go per town |
| CT (both) | Barbour guide **read** | originals at town halls + State Library microfilm; Coventry slips cite a published book, not the manuscript; Saybrook/Suffield/Windham have published + bound volumes; Salisbury not named; no copy terms on the page |
| Rhode Island | **read** | open records online to print or download (access, not a licence); pre-1853 = town clerks, microfilm at the Archives |
| Denmark | **read** | personal-use single downloads; contact before more than a few; pre-1892 colour images from Ancestry need Ancestry's written permission for more than a few |
| Utah | **read** | registration by period (none before 1898; county 1898-1905; state 1905-1976); this guide states no reproduction terms; the relayed series-level permission is not confirmed here and never extends to FamilySearch-produced images |
| Sweden | **read** | catalog of digitised church books; cost, bulk and reuse terms on linked pages not read |
| LDS members | fetch failed | relayed only |
| New Hampshire | HTTP 503 | unchecked; never circumvent |
| England, Find a Grave | not checked here | relayed only (Find a Grave refused the relaying seat with 403) |

Next research order: original-record repositories for Holliston (164),
Chelmsford (112), Sherborn (86), Suffield (76) and Salisbury (50). For each,
record the repository, the catalog or microfilm identifier, the coverage dates
and the copy and publication conditions. Keep originals-holder distinct from
any third-party host of copies. No downloads, no FamilySearch requests, no
outreach.

## 5. Addendum: five priority towns, routes and date match (2026-10-18)

Founder rule, chat 2026-10-18: no more approval gates. Authorized research
proceeds and is reported. These are official public pages, read-only, with no
FamilySearch session. Evidence:
`docs/dispatches/evidence/2026-10-18-frontier-town-match.json` (counts only).
Town counts here cover **every** collection citing an event in the town, so
they run slightly above the two-collection partition (Holliston 182 vs 164).

| town | route this seat read | unresolved ids | event years | date match |
|---|---|---|---|---|
| Holliston, MA | Historical Society "Births, Marriages, and Deaths from 1729 to 1843", assembled from the Town Clerk's vital records (hollistonhistoricalsociety.org/births-marriages-and-deaths-1729-to-1843/); current custodian of the originals not stated | 182 | 1726–1856 | 85 in 1729–1843 · 2 before · 3 after · 92 citations carry no year |
| Chelmsford, MA | town Historic Records page (chelmsfordma.gov/570/Historic-Records) links vital-record indexes and a "Historic Town Records" document, but states no early year ranges; the relayed 1650–1750 / 1710–1774 volumes are **not confirmed here** | 117 | 1679–1767 | all 94 dated ids fall inside the relayed 1650–1774 span · 23 no year |
| Sherborn, MA | Town Clerk page states no historical holdings; Sherborn Library listed | 99 | 1688–1750 | no volume span known · 34 no year |
| Suffield, CT | Town Clerk: public search stations, copies $1/page, land indexes 1700s–1983; vital years not stated; Barbour + published Suffield VR per the State Library guide | 76 | 1684–1790 | 62 dated ids fall within the Barbour pre-1850 scope · 14 no year |
| Salisbury, CT | Town Clerk vault holds birth, marriage and death records; open for research; appointments recommended; land index vol. 1 1741–1844 | 56 | 1748–1791 | all 42 dated ids after the 1741 start · 14 no year |

Readings, all to be verified at the custodian before any match is claimed:
- **Holliston / Sherborn:** relayed fact, set off from Sherborn in 1724.
  Holliston's earliest unresolved event is 1726, so none of its identifiers
  predate the split. Sherborn's 99 (1688–1750) are mostly pre-1724 and are
  Sherborn's own records. The two 1726–1728 Holliston events fall between
  the split and the compilation's 1729 start.
- **Suffield:** general historical knowledge, not cited here. Suffield was a
  Massachusetts town until 1749, so its 1684–1748 events may sit in
  Massachusetts-era records as well as Connecticut's Barbour/published set.
  It needs a custodian check.
- **Undated citations** (92 + 23 + 34 + 14 + 14) need the record's own date
  from the index entry before they can be placed against a volume.

What this is: five verified or partly verified research routes and a date
fit. What it is not: 530 individual-record matches, or permission to copy or
publish anything. Rights stay UNASSESSED. Next: read each town's linked index
documents (Chelmsford Historic Town Records, Holliston compilation) and match
dated identifiers to volume and page, offline, from the published indexes.

## 6. Correction + five-town reconciliation landed (2026-10-18)

**Correction of §5, my own claim:** "177 citations carry no year" was
**wrong**. The 92 / 23 / 34 / 14 / 14 "no year" figures came from my rule
`/,\s*(\d{4})\.\s*$/`. That rule reads only citations ending in ", YYYY." and
misses endings like ", 9 June 1805." and ", 31 Jan 1730/1.". I re-counted
the same 530 identifiers from the public `records.json` with a rule that
admits day-month dates and dual years:
`/,\s*(?:(\d{1,2})\s+([A-Za-z]{3,9})\s+)?(\d{4})(?:\/(\d{1,2}))?\.\s*$/`.
It gives **353 year-only, 169 full date, 1 dual year, 7 without an event
date**:

| town | ids | year-only | full | dual | none |
|---|---|---|---|---|---|
| Holliston | 182 | 90 | 88 | 1 | 3 |
| Chelmsford | 117 | 94 | 23 | 0 | 0 |
| Sherborn | 99 | 65 | 32 | 0 | 2 |
| Suffield | 76 | 62 | 12 | 0 | 2 |
| Salisbury | 56 | 42 | 14 | 0 | 0 |

The undated seven are QVGY-PXXB, QVKB-1PFT, QVK2-LBK3, QVMZ-BNWJ, QGN3-6XYX,
QPMC-VHGG and QPMC-X18R. They match the delivered file identifier for
identifier, with the same 530 and no extras on either side. The §5 in-span
counts used only year-ending citations and are superseded by the delivered
assessments.

**Landed as evidence:**
`docs/dispatches/evidence/2026-10-18-five-town-reconciliation.json`. This is
another seat's reconciliation pass, delivered by the founder. It is a one-line
re-serialization with a provenance header and is otherwise content-identical
(checked by code). The delivered file's sha256 is
`ef0b0ef989698ede1ad46a8b9f584988de74180208cb1a1cd0db4ca3b064ca60` <!-- PUBLIC-CONSTANT: sha256 of the delivered evidence file -->,
and its original bytes are kept on the private tier. It holds 530 identifier
assessments, 659 role rows, and 129 printed-page event groups across the
Holliston (1908), Chelmsford (1914) and Sherborn (1911) published vital
records. Of the 398 Massachusetts identifiers, 387 have printed-page
candidates; 11 have none, and Connecticut's 132 are not yet page-assessed.

This seat spot-checked two candidates against the archive.org OCR:
- Holliston p. 129 reads "Albert Perry, s. Luther and Ruth, June 9, 1805."
  under the header "HOLLISTON BIRTHS. 129" (`FHP5-TD4`).
- Sherborn p. 73 reads "Perry, Jeams, s. of Joseph and Martha, May 15,
  1703." under the header "SHERBORN BIRTHS. 73" (`Q29L-B4ZD`).

Both match. These are **printed-book pages**, not manuscript volume and page;
no manuscript match and no page image is verified. The conflicts stay
explicit as delivered. The frozen Rockwood/Haven marriage claims ("4 February
1427", "31 December 1904") stand against the compilation's intention of 4 Feb
1827 and church record of 3 Apr 1827, and Meriam M. Rockwood's 11 vs 16 Feb
1834 and Albert T. vs P. stand too. Nothing in the corpus is changed.

The delivered pass also corrects §5's coverage readings. Holliston's births
volume runs 1725–1844, its marriages 1729–1843 and its deaths 1725–1843, so
1729 is no blanket start. Chelmsford's 1650–1750 and 1710–1774 town books
are now confirmed on the town inventory as general town records, not
established vital volumes. Sherborn event places can differ from the
collection town. Suffield was annexed from Massachusetts in May 1749 (CT
register table). Salisbury births, marriages and deaths run 1740–1905 on
CSL microfilm 3966.

Next: page-assess Connecticut's 132 identifiers against the published
Suffield vital records and the Barbour volumes, and place the 11 unassigned
Massachusetts identifiers. Rights stay UNASSESSED.

## 7. Connecticut page pass landed (2026-10-18)

**Evidence:**
`docs/dispatches/evidence/2026-10-18-connecticut-vital-record-candidates.json`.
This is another seat's pass, delivered by the founder. It is a one-line
re-serialization with a provenance header and is otherwise content-identical
(checked by code). The delivered sha256 is
`1ee01c243b56b2d1395d19afbb0418e54ba89b7e34c7655e445ab3c51873fd42` <!-- PUBLIC-CONSTANT: sha256 of the delivered evidence file -->,
the stated digest, and the original bytes are kept on the private tier. Its
132 identifiers equal this lane's Connecticut set exactly, with 159 role rows.

| result | ids |
|---|---|
| Salisbury, published-page candidate, date-compatible | 55 |
| Salisbury, published-page lead, year conflict (`F73G-8BD`: 1748 cited, 1749 printed) | 1 |
| Suffield, family-genealogy lead, page number seen in retrieved text | 71 |
| Suffield, family-genealogy lead, page inferred | 2 |
| Suffield, passage found, page unconfirmed | 2 |
| Suffield, no passage (`F7WV-H4N`) | 1 |

This seat spot-checked two leads against the sources:
- **Salisbury** *Historical Collections* Vol. I has Catharen White, 25 April
  1749, on p. 73 and Hermon White, 5 Feb 1753, on p. 74. The mirror itself
  states its text "was generated using artificial intelligence so there may
  be some errors."
- The **Granger** genealogy (1893, archive.org OCR) reads "David, b. 25 Jan.,
  1718-19" and "Jonathan, b. 25 Jan., 1718-19" after the printed page 74
  header. The five frozen citations reading 1708 stay a conflict and are not
  corrected.

Status is unchanged in kind. These are published compilation and family
genealogy pages, not Barbour entries and not original town volumes. Barbour
Vol. 45 (Suffield 1674–1850, published 2002) exists, but no entry page was
recovered. The citation-date audit stands at 353 / 169 / 1 / 7. The relayed
note about the 530 and 659 counts in `f58729e66` agrees with what §6 already
says, so no correction was needed. Rights stay UNASSESSED and the corpus is
unchanged.

**Wave 1 page coverage now:** MA 387 of 398 and CT 131 of 132 have a
printed-page or literature lead. That is 518 of 530; 12 have none (11 MA and
`F7WV-H4N`). No identifier is resolved against an original manuscript yet.

## 8. Open-items follow-up landed (2026-10-18)

**Evidence:**
`docs/dispatches/evidence/2026-10-18-five-town-wave1-open-items-followup.json`.
This is another seat's pass, delivered by the founder: a one-line copy plus a
provenance header, otherwise content-identical (checked by code). The
delivered sha256 is
`6750f3ffd72cbecd2e38d5c64ba0853fd6e60c61ede09cf47dc122c7fb4cab1d` <!-- PUBLIC-CONSTANT: sha256 of the delivered evidence file -->,
the stated digest, and the original bytes are kept on the private tier. All
12 gap identifiers are in the frozen 530 and in the file.

**Precision on §7's "518 of 530":** that counts source-passage leads. By page
evidence, 514 have a printed-page numeral observed in retrieved text, 2 have
a page inferred from sequence, and 2 have the passage but no confirmed page.

**New candidate passages for six of the twelve gaps.** None is resolved, and
each linkage to its frozen identifier is unverified:

| id | passage | caveat |
|---|---|---|
| `QVGY-PXXB` | Holliston VR p. 340, Elizabeth w. James Perry, d. 29 Dec 1753 | no maiden name Death in the passage |
| `QVKB-1PFT` | Holliston VR p. 332, Capt. Ephraim Littlefield, d. 13 Nov 1778 | gravestone-photo lead (Worcester Historical Museum 2001.11.1.343), photo unexamined |
| `QVK2-LBK3` | Holliston VR p. 299, Lieut. Isaac Bullard, d. 7 Jul 1742 | other Isaac Bullards nearby |
| `QK16-53KX` | Holliston VR p. 328, Sarah Lealand, widow, d. 8 Oct 1775 | no maiden name Morse |
| `QGN3-6XYX` | Sherborn VR p. 199, John Death Esq., d. 14 Dec 1754; cemetery section p. 2 | pagination restarts in the cemetery section |
| `N75L-V6K` | NEHGR vol. 28 pp. 210–211, Thomas Temple Rockwood necrology, d. 11 Oct 1872 | **conflict** with the frozen 3 Oct 1872; both kept |

Connecticut: the NEHGR vol. 63 (April 1909) p. 179 is an observed journal
locator for `QPSF-453P` and `QPMC-VHGG`. The reprint's p. 3 stays labelled
inferred. Olive Kendall (`F7WV-H4N`) has family context only (King genealogy
p. 196, entry 199), so her 1790 birth is still unplaced.

This seat's spot-checks:
- **Holliston VR p. 340** reads "Elizabeth, w. James, Dec. 29, 1753, in 48th
  y." It matches.
- **NEHGR necrology:** not located in two OCR windows of the archive.org item.
  The windows covered pp. 91–139 of a volume headed XXIX. It is
  **unconfirmed by this seat**, not refuted.

**Still without a candidate:** `F7WV-H4N`, `N7TT-RYQ` (Luther Rockwood death
1856), `N7NF-N5P` (Luther E. death 1862), `MDSS-1T5` (1850 census),
`MQWY-6C8` (1855 MA census) and `QVMZ-BNWJ` (the unknown person with Joseph
Perry). The citation-date audit stays 353 / 169 / 1 / 7. Nothing is
resolved, the corpus is unchanged and rights are UNASSESSED.

## 9. Rockwood necrology located (2026-10-18)

This revises §8's "unconfirmed by this seat". My two OCR windows stopped
before the entry, at pp. 91–139. This seat has now read it at a later offset
of the archive.org item `newenglandhistor28wate` (NEHGR vol. XXVIII, 1874).
Thomas Temple Rockwood's entry runs from p. 210 onto p. 211. It follows
Noah Amherst Phelps and precedes Oliver Mayhew Whipple, and reads "died in
that town October 11, 1872, aged 60 years", with birth on 5 June 1812 at
Holliston.

The item's `page_numbers.json` maps printed p. 210 to leaf 232, p. 211 to
leaf 233 (confidence 100) and p. 216 to leaf 238. That last page is where
the dates are repeated, from the same volume, so it is no independent
witness. Locator, relayed and now confirmed by this seat: p. 210 = leaf 232,
p. 211 = leaf 233.

Status:
- The OCR passage is read and the leaf mapping verified.
- **The page images are not visually checked.**
- The frozen 3 Oct versus the published 11 Oct 1872 stays an unresolved
  conflict.
- An XXIX marker in the OCR just before p. 210 is unexplained without the
  image.

Counts are unchanged: six new candidates and six gaps with none. The corpus
is unchanged.
