# fs 8-gen frontier: reconciliation receipt + custodian acquisition plan (2026-10-18)

Seat 3 (Claude Code). Documentation and research planning only. Founder
decision, chat 2026-10-18: "Approve the reconciliation receipt and custodian
plan. Keep the FamilySearch automation refusal intact. No change to the image
frontier, existing observations, private-tier controls or ANT publication
authorization."

The stopped frontier is untouched. The private queue (7,114) and all 40
observations stand as banked in `abd8a82e0`; nothing is rebuilt, retried, read
from FamilySearch, or downloaded. The automated FamilySearch sweep stays
stopped unless FamilySearch grants explicit written authorization.

## 1. Source

`assets/profile-archive/lineage/sources/records.json`, 13,249 records.
Git Bash `sha256sum` on the working file and on `git show 0270f568a:…` (the
10-13 measuring commit) both read:
`4c11aaf0fe7e2625bbfed7e6cbda07a1ad2304e7ff2dacbe689e944b74911679` <!-- PUBLIC-CONSTANT: sha256 of a public file -->
The file is **byte-identical** between the 10-13 measurement and today. The
private queue header records the same hash.

## 2. Extraction rules and exact sets

Identifier rule: `/1:1:([A-Z0-9]{4}-[A-Z0-9]{3,4})(?![A-Z0-9-])/g`.

| set | rule | distinct |
|---|---|---|
| C, citation | matches inside each record's `citation` string | **7,018** |
| E, evidence | matches inside each element of the record's `evidence` array | 264 |
| E ∩ C | | 168 |
| E \ C, evidence-only | | **96** |
| C ∪ E = queue | the queue builder's whole-file rule | **7,114** = 7,018 + 96 exactly |

The queue equals C ∪ E, checked by code (`queueEqualsUnion: true`). All 96
evidence-only identifiers sit in evidence entries typed `OTHER` / `Original`.
They are references carried inside an index's extracted data, not the citing
record itself. **None of the 96 was attempted** (all `never-attempted`). The
exact 96 are listed in the evidence file (§6).

The title, `urls` and `event` fields carry no `1:1` identifiers.

## 3. The 7,037 figure: not reproducible, no recorded rule

The 10-13 receipt (`0270f568a`) states 7,037 "distinct 1:1 record arks (4-4/4-3
forms)" measured "with zero requests", but records no extraction rule. On
the byte-identical file, no tested rule yields 7,037:

| rule tried | count |
|---|---|
| citation only (strict, no lookahead, any length) | 7,018 |
| whole record / citation + evidence | 7,114 |
| citation, records without any `3:1` in the citation | 7,018 |
| citation, records without any `3:1` anywhere | 7,004 |
| whole record, records without any `3:1` anywhere | 7,100 |

So the 77-identifier gap (7,114 − 7,037) is **not** explained by the 96
evidence-only links. That would leave 7,018, which is 19 below 7,037. The same
receipt's "59 distinct 3:1 long-form image arks inside citations" is also not
reproduced: citation-scoped `3:1` matches read 80 (any form) and 78 (long
form). **Classification: 7,037 is UNVERIFIED.** It has no rule, no identifier
list, and no reproduction. It is not corrected to any number; it stands
beside this receipt as unexplained.

The 7,114 queue is the reproducible set and stays the frontier of record. The
96 evidence-only identifiers are flagged as a separate class. They are kept
in the queue and never silently dropped, because the queue is frozen.

## 4. Ledger, from identifiers and statuses (not from a pending count)

| class | count |
|---|---|
| queued `1:1` identifiers | 7,114 |
| mapped (unique rendered link) | 18 |
| FamilySearch-stated "No Image Available" | 10 |
| retryable observation | 11 |
| walker failure | 1 |
| observed in total | 40 |
| **never attempted** | **7,074** |
| **without a terminal outcome** | **7,086** |

Correction of my own wording in `abd8a82e0`: "7,075 pending" was the
writer's retry list. That is the never-attempted 7,074 plus the one walker
failure still eligible for retry. It was never the count of records not yet
attempted.

"No Image Available" is a **FamilySearch-specific** observation for that
record page. It is not evidence that the original custodian holds no image.

## 5. Custodian acquisition plan (adopted)

Execution order:

1. **Close the arithmetic.** Done here (§1 to §4).
2. **Preserve the stopped frontier.** No queue rebuild, no silent retries, no
   bulk FamilySearch browser reads, no image downloads.
3. **Partition by original custodian.** The first deliverable is the
   collection-level manifest (§6). It covers 291 cited collections, with
   custodian, access method and rights all `UNASSESSED` until each is
   researched. Assignments total 7,108 because a few identifiers are cited
   under more than one collection. 15 identifiers sit in citations without a
   leading collection title, and the 96 evidence-only identifiers form their own
   group.
4. **Authorized routes only.** Use the custodian archive's own catalog data
   where its terms permit automated access, ingesting the archive's own
   identifiers, stable URLs, provenance and any permitted bytes (never content
   taken from FamilySearch). For FamilySearch-controlled records, the routes
   are targeted manual research or explicit FamilySearch authorization. The
   developer-key application from 2026-09-22 is still pending its review, and
   API access is not by itself permission for bulk mapping.
5. **Publication stays separately gated.** Map first, establish
   redistribution rights second. Any Autonomi storage spend goes under its
   existing independent approvals and spending limits. A mapped image or its
   bytes never qualifies for publication by itself.

Outcome ledger for new work (one class per identifier, each with custodian,
access date and evidence): `mapped-by-custodian`, `mapped-by-authorized-FS`,
`FS-index-only`, `access-restricted`, `not-found-at-custodian`, `retryable`.
The 40 existing observations keep their recorded states. They are FS-session
observations and are not re-labelled.

Largest unresolved collections (count of unresolved identifiers):
814 Massachusetts, Births and Christenings, 1639-1915 · 653 England, Births
and Christenings, 1538-1975 · 551 Massachusetts, Town Clerk, Vital and Town
Records, 1626-2001 · 353 Connecticut, Births and Christenings, 1649-1906 ·
318 Find a Grave Index · 299 LDS Record of Members (Worldwide), 1836-1970 ·
210 Rhode Island, Births and Christenings, 1600-1914 · 175 Denmark, Baptisms,
1618-1923 · 163 Utah, Deaths and Burials, 1888-1946 · 159 New Hampshire,
Births and Christenings, 1714-1904 · 158 Connecticut, Vital Records, Prior to
1850 · 144 Sweden, Baptisms, 1611-1920.

Several of the largest are FamilySearch-compiled indexes ("Births and
Christenings") whose original custodian is the underlying parish or town
register. Identifying that custodian per collection is the first research
task, not an assumption made here.

## 6. Evidence

`docs/dispatches/evidence/2026-10-17-frontier-custodian-manifest.json`
(`skaists.frontier-custodian-manifest/1`). It holds the rules, the set sizes,
the queue status tally, the exact 96 evidence-only identifiers, and the 291
collection rows. It is public-safe: collection names, counts and ark pointers
already present in the public layer. No person data, no image bytes.

Zero FamilySearch requests this turn. Zero private-tier writes.
