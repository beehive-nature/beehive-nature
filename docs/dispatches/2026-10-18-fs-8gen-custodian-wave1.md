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
