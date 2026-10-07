# 2026-10-07 — the full-cohort hint census: every open record hint enumerated for the 8 dead generations, and the Maren vein advanced 4 records

Order (founder, 2026-10-07): "I need you to scrape every bit of
familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations. we will stage it here and github and later ANT."
— verbatim re-issuance of the standing 2026-09-18 material-evidence order;
this wake executed its current issuance: a complete open-hint CENSUS of the
frozen 809-person dead cohort (depths 2–9 from root L627-FH9) plus every
named extramural open vein, then identity-verified attaches on the named
Maren-side vein.

## Session proof

Founder sign-in retained from 2026-10-06. Oracle per the session-oracle law
(wire proof, never cookie presence): authed in-page fetch of
`/service/tree/tree-data/v8/person/L627-FH9/details` → **200 with real
person data** (birth formalText +1977-06-14, contributor travis remington).
The "Account: travis remington" chip visible on the linker pages corroborates.

## THE CENSUS — every open hint on the record-matches wire, 823 pids

Wire: `GET /service/tree/tree-data/v8/record-matches/{pid}/all` (authed,
in-page, single worker, 170 ms pacing, resumable ndjson + cursor in the
private tier). Scope: **809 cohort persons** (the frozen dead 8-gen corpus,
depth histogram 4/8/16/32/60/112/203/374) **+ 14 extramural persons** (every
pid named open in the 10-04→10-06 wakes, incl. the four missed by the first
pass — LZDH-WYF, L21W-9ZT, KWCT-391, LJDF-JY4 — honestly named below).

- **823 requests · 822 OK · 1 provider refusal named**: LNQ5-BSG (Don Ray
  Remington, depth 2) → **HTTP 410 Gone** — the documented living-flag /
  private-space class; his 0-sources gap from the 09-18 harvest stands.
- **End-of-wake open hints: 85** (pre-attach 94; today's 9 attachments
  cleared 9). Confidence: 70× conf 5, 15× conf 4.
- **Cohort (23 open on 10 persons)**: KWJ4-XBD Albert Perry Rockwood d5 ×7
  (LDS membership ×2, Nauvoo ×2, NUMIDENT, Wikipedia index, 1850 census —
  the NUMIDENT row is a same-name-different-person candidate: SS-era record
  for an 1805 birth; identity care required), LKR3-6XT ×8 (not yet
  inspected), and 8 singles: L6LW-1G2 (Ohio death, c4), LJDG-CYG (1860
  census, c5), LN5V-3N2 (1870 census, c5), MS86-N1C (England christening,
  c4), GWXR-H2K + GWXR-3TD (Somerset couple, daughter Sarah's christening,
  c5 pair), MVXD-XT8 ×1, G9LD-217 ×1.
- **Extramural (62 open)**: the Olsen family LZDH-WYF 18 (was 22), MHRT-169
  18 (was 20), MLCS-MN5 4 (her own birth-class records, untouched today),
  and **L1N9-S2L 22 — PARKED** behind the founder's Christen-cluster merge
  ruling (its wire drifted 25→22 with zero attach work from this seat: a
  provider-side shared-record recount, reported as observed, not explained
  beyond that).
- 3 extramural persons redacted in the public layer per the privacy law
  (living or unconfirmed): count stubs only, no fsid, match detail withheld;
  full fidelity in the private tier.
- Honest method note: the first two sweep attempts used single evaluate
  calls that hit the 32 s browser-eval cap; their abandoned in-page loops
  (read-only fetches, same pacing) ran to completion before the persistent
  page-side worker started. The census loop itself is the single worker.

## ATTACHED this wake — 4 records / 9 person-attachments, every row reload-verified DETACH in a fresh linker

1. **Death register `1:1:QG83-1487`** (Denmark, Church Records, 1484-1941,
   Bakkendrup, Løve, Holbæk; page 202 vol 8): Maren Nielsen, age 65 (est.
   1812), **died 4 Oct 1877** — exact match to Maren Nielsdatter LZDH-WYF's
   own death conclusion, which until today carried **0 sources**. Attached
   principal row only; her death fact now has its record. The record's
   spouse mention ("Christen Olesen") prewired to LW9Z-S11 (the 1780
   cluster Christen) — **spouse row intentionally not attached** (contested
   topology; the reason string on the attach says so).
2. **Christening `1:1:QG8Q-P964`** (Ane Sophie Christensen, 1841): attached
   ×3 — daughter LZDH-WB1 (1841–1855), mother LZDH-WYF, father **MHRT-169**
   (the linker's own canonical pairing, merge-safe per the 10-06 law).
   Same-event re-indexes QG8Q-V3C5 + H29V-YW2M left unattached, documented
   (the standing same-event skip law).
3. **Christening `1:1:QG8Q-ZCJ9`** (Ane Marie Christensen, 1854): attached
   ×3 — daughter MLCS-M2L (1854–Deceased), mother, father MHRT-169.
   Re-index twins QG8Q-X866 + H2S9-193Z documented as skips.
4. **`1:1:QG87-SM82`** (Mette Kirstine Christensen's record): attached
   parent rows ×2 — LZDH-WYF + MHRT-169. **Child row NOT attached**: Mette
   Kirstine exists in the tree only as the duplicate-cluster copy
   (L1NW-6M1, "Others in Tree") — attaching her row would feed the parked
   cluster. Merge-safe: when the founder rules the cluster merge, the
   record lands with everyone.

Marriage re-indexes FVLK-B94 + QG87-N38Z remain documented skips (the
1834 Finderup marriage itself was attached 10-06). QG87-M751 ("Karen
Kristiansen / Kristen Olsen") is identity-suspect (father spelling + name
form differ) — left open, named for the next wake's verification, not
attached, not dismissed.

No persons created; no vitals overwritten; no refusals beyond the named
410; the L1N9-S2L side untouched. Per-row attach reasons: the typed reason
rode the paired sets; per-row reason visibility is the same UNVERIFIED
boundary the 10-06 receipt named (identity of every attach is
exact-vitals-proven; Latest Changes shows reasons if it matters).

## Staged layers (three-tier, per the doctrine)

| layer | where | content |
|---|---|---|
| PRIVATE | `C:/Users/travi/family-lineage/hint-sweep-2026-10-07/` (never committed) | `sweep-input.json` (823 pids + names/depths/tiers), `sweep-results.ndjson` (every wire response incl. redacted persons' match detail), cursor |
| PUBLIC corpus | `assets/profile-archive/lineage/sources/hint-census-2026-10-07.json` | `skaists.hint-census/1` — end-of-wake open-hint snapshot, possibility-tier by construction (never upgrades evidence.support), per-person match detail for nameable persons, redaction stubs for the rest, reconciliation with the 410 named |
| Tooling | `tools/genealogy/hint-census.mjs` + session/sweep sidecars | zero-dep builder (pure fold, exportable `buildCensus`), deceased-extramural allowlist with per-name basis |

The frozen 809-person sources index/records (13,249 records) are UNCHANGED
this wake: every attach since the 10-03 corpus freeze landed on extramural
persons, so the cohort corpus carries no sync debt. The census artifact is
the new public layer; ANT staging stays "later" per the order (codex seat
owns #336/#346/#347).

## UI rails learned this wake (for the next seat)

- Linker URL: `/en/search/linker?ark=<FULL ark:/61903/1:1:XXXX-XXX url-encoded>&id=<pid>&hinting=/tree/person/details/<pid>` — the short `1:1:` form errors ("Something Went Wrong"); the full-ark form is what the record page's own "View in Source Linker" generates.
- SPA hydration takes 20–30 s in agent-driven tabs; the degraded-shell state is slow-load, not signed-out — the wire oracle remains the only session proof.
- Playwright clicks time out on actionability (continuous re-render); DOM-level clicks via evaluate work. "Compare and attach X with Y" FOCUSES the row; the row's confirm button then reads "Attach X to Y".

## Still open (named, with next owners)

- **Cohort attaches**: KWJ4-XBD ×7 (NUMIDENT row likely a refusal —
  verify-then-refuse), LKR3-6XT ×8 (inspect first), the 8 singles — each
  census-enumerated with ark/confidence/relations in the public artifact.
- **Maren vein remainder**: Dorthe Cathrine, Oline, Karen child events;
  MLCS-MN5's own 4; the QG87-M751 identity question.
- **Links-wire full-record staging**: the census carries arks + titles; the
  `links/sources` transcription pass for the new records (and any future
  attaches) rides the next sources pass.
- **Founder calls unchanged**: the three-Christens merge ruling (L1N9-S2L
  side parked, 22 hints), the Daniel Briggs duplicate cluster, the
  PNCX-S8Q mother-naming (Norway parish), Don Ray Remington's search pass
  (the 410 class).
- **ANT**: later, per the order; codex seat owns the gate.

— zCode seat (hint-census wake), 2026-10-07
