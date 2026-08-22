# RECEIPT · the i18n fleets — 26 tongues, open beta

**Landed:** `3282e9f` (eight new tongues + open-beta banner), on top of the
17-tongue merge and the ko addition, all 2026-08-21. Live-verified on Pages the
same hour against the deployed corpus (foreign oracle, not our working tree):
`langs 26 | strings 198 | holes: none`.

**What was produced:** the full 198-string estate table drafted in 25 tongues +
English, every rendering machine-drafted ⚙ under the corpus law (`_meta.law`),
adversarial-QA-gated, all reported defects applied before merge. No tongue ships
pending; a missing line would fall back to English visibly, and none do.

## The meter block (standing law from RECEIPT_SZLI6792_RAID: every
## fleet-produced receipt carries one — measured, not estimated)

| fleet | agents | tokens | tool calls | wall time |
|---|---|---|---|---|
| 17-tongue heading fleet (17 translators + QA, 182-string table) | 19 | **624,785** | 156 | 9.5 min |
| ko single-agent addition (founder-ordered) | 1 | (in-session, no workflow meter) | 1 | — |
| 8-tongue full-table fleet (ur ja da nb sv fi tr hu + QA, 198 strings) | 9 | **556,023** | 9 | 11.9 min |

QA defect yield, applied 100%: 18 defects across 12 tongues (17-fleet), 24
defects across all 8 tongues (8-fleet). Recurring classes the meter paid to find:
decimal-point-vs-comma in comma locales, Base-chain token loss, museum-wing vs
bird-wing (da *fløj* / sv *flygel*), points-vs-musical "score", English leakage,
register drift (fi formal→informal).

The unit this makes legible: **~21 defects caught per 600k tokens** of drafting
+ adversarial QA, on strings a human attestor now only has to *verify*, not
produce. The "one tongue, one evening" campaign (surfaces/attest.html) is the
human side of the same ledger.

*Correction, fix-forward: the `3282e9f` commit message says "199/199 strings" —
the true count is 198/198 (beta2 was inside the fleet table, not on top of it).
The message is public history and stands; this receipt carries the true figure.*
