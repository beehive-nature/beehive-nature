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
