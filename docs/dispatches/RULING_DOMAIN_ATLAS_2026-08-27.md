# RULING — THE DOMAIN ATLAS (founder ruling recorded · seat proposal attached for redline)
**Date:** 2026-08-27, eve of the megasprint
**Founder ruling (verbatim):** *"each surface will find its way to an app/domain/dApp and why the hub needs to be rearranged. this is all the web domains i control/paid and will deploy so we group all pages/surfaces/dApps with domains"*
**Effect:** closes the open IA question from the hub audit (bnature.social vs skaists.social overlap, cross-domain taxonomy). The hub's shape is now ruled: **an atlas grouped by family and domain, not a link-wall of six panels.**
**Verification:** every repo/pages claim below read live via `gh api` tonight; DNS state from the front-door lane memory (cname files bound, registrar pointing pending except the live set).

---

## 1. THE PORTFOLIO (26 domains, all privacy-protected, all Active)

Two renewal cohorts — two budget events, put both on the ops calendar:

- **Cohort A — renews 2027-07-03 (8):** beehivebiomass.com · beehivenature.com · bnature.bio · bnature.social · plur.earth · skaists.com · skaists.dev · skaists.social
- **Cohort B — renews 2026→2027-08-26 (18):** beehivebiomass.buzz · beehivebuds.buzz · beehivebuds.com · beehivenature.buzz · bnature.buzz · bnr.baby · bnr.lol · bnr.quest · midi.blue · plur.asia · plur.lat · plur.quest · skaists.art · skaists.buzz · skaists.lol · skaists.quest · skaists.store · skaists.xyz

> Note: **beehivebiomass.art** appeared in the paste as a registrar upsell ad ("85% OFF $3.98/yr") — NOT owned, NOT counted. If we ever want it, it's a $3.98 decision.

## 2. VERIFIED FRONT-DOOR STATE (gh api, 2026-08-27)

| domain | front repo | org | pages | DNS |
|---|---|---|---|---|
| skaists.dev | beehive-nature (main) | beehive-nature | ✓ | **LIVE (the hub)** |
| skaists.com | skaists-com | skaists | ✓ | pending |
| skaists.art | skaists-art | skaists | ✓ | pending |
| skaists.store | skaists-store | skaists | ✓ | pending |
| skaists.xyz | skaists-xyz | skaists | ✓ | pending |
| skaists.buzz | skaists-buzz | skaists | ✓ | pending |
| skaists.quest | skaists-quest | skaists | ✓ | pending |
| skaists.lol | skaists-lol | skaists | ✓ | pending |
| **skaists.social** | — none — | | ✗ | ✗ |
| plur.asia | plur-asia | skaists | ✓ | pending |
| plur.quest | plur-quest | skaists | ✓ | pending |
| plur.lat | plur-lat | skaists | ✓ | pending |
| **plur.earth** | PLUR.earth | **user account** | **✗ pages OFF** | was live-6 |
| bnature.bio | bNATURE.bio | beehive-biomass | ✓ | live-6 |
| **bnature.social** | — none — | | ✗ | was live-6 ⚠ |
| bnature.buzz | bnature-buzz | beehive-nature | ✓ | pending |
| bnr.baby | bnr-baby | beehive-nature | ✓ | pending |
| bnr.quest | bnr-quest | beehive-nature | ✓ | pending |
| bnr.lol | bnr-lol | beehive-nature | ✓ | pending |
| midi.blue | midi-blue | beehive-nature | ✓ | **pending paste** |
| **beehivenature.com** | — none — | | ✗ | was live-6 ⚠ |
| beehivenature.buzz | beehivenature-buzz | beehive-nature | ✓ | pending |
| **beehivebiomass.com** | — none — | | ✗ | was live-6 ⚠ |
| beehivebiomass.buzz | beehivebiomass-buzz | beehive-biomass | ✓ | pending |
| **beehivebuds.com** | — none — | | ✗ | ✗ |
| beehivebuds.buzz | beehivebuds-buzz | beehive-nature | ✓ | pending |

⚠ Three of the original "live six" story-domains (bnature.social, beehivenature.com, beehivebiomass.com) have **no front repo of their own** — their panels in today's hub point at paths on other repos. The atlas makes this honest instead of implied. **plur.earth** needs its Pages enabled (repo exists, pages=false, on the personal account — recommend a `plur-earth` repo in the skaists org for consistency with its siblings).

## 3. THE FAMILY ATLAS (proposal — every line redlinable)

**TLD semantics we're committing to** (they recur deliberately): `.dev` = build/hub · `.com` = human front door · `.social` = social app skins · `.buzz` = the nostr/buzz lane · `.art` = art surfaces · `.store` = commerce · `.quest` = quests & learning · `.lol` = lore & fun · `.xyz` = the lab · regional TLDs (`.asia`, `.lat`) = chapter mirrors when communities ask.

### SKAISTS — the maker estate (9 domains)
| domain | role | seats (proposed) |
|---|---|---|
| **skaists.dev** | **THE HUB — the atlas itself** + dev surfaces | surfaces index · devroom · forge/room · stack · keys/addresses · dock · record |
| skaists.com | the human front door | the story · onboarding/receive |
| skaists.social | the maker social app | the bsky-style engine's maker skin (see Social ruling below) |
| skaists.buzz | the buzz lane front | buzz-studio · relay presence |
| skaists.art | the art surfaces | pixelrefiner · qrroses · qrtree · museum · gallery · bnri-gallery · inscription-explorer |
| skaists.store | commerce | market · purse · b4b |
| skaists.xyz | the lab | forge/* · compare · workbench · demo |
| skaists.quest | quests & learning | biQ · university |
| skaists.lol | lore & fun | btranslated · blanguage |

### BEEHIVENATURE — the organism (2)
| domain | role |
|---|---|
| **beehivenature.com** | the organism's manifesto door — the 01–04 cards ("what it is / how it proves / what it costs / who it's for") live HERE, off the hub |
| beehivenature.buzz | the hive's buzz presence |

### BNATURE — the living network (3)
| domain | role | seats |
|---|---|---|
| bnature.social | the organism social — community skin of the one social engine | hearth · pulse · bqueenbee-live · huddle · bsymposium |
| bnature.bio | the living lane | bearth · bfood · blongevity · bigen — **zero-health-claims discipline inherited from the Buds law** |
| bnature.buzz | nature buzz relay | |

### BEEHIVEBIOMASS — the network itself (2)
| domain | role |
|---|---|
| beehivebiomass.com | bmesh/biomass operations — bantfarm · bfactory · bmeshasi · coop |
| beehivebiomass.buzz | biomass buzz |

### BEEHIVEBUDS — the buds line (2) — **STANDING LAW, UNCHANGED**
| domain | role |
|---|---|
| beehivebuds.buzz | face line verbatim · **age gate before ANY product content · zero health/therapeutic claims** |
| beehivebuds.com | future storefront — same law, same gate |

### PLUR — the heart (4)
| domain | role |
|---|---|
| plur.earth | the PLUR home — plur · festival · kandi · bset |
| plur.quest | festival games & quests |
| plur.asia · plur.lat | chapter mirrors — hold until communities ask |

### MIDI — the music universe (1)
| domain | role |
|---|---|
| **midi.blue** | the MiDi front door — the contract-read engine (midi.html) · the bMiDi residency (midiroom) · the organ · the swap — the erc20i showpiece until it outgrows one domain |

### BNR — the kernel brand (3)
| domain | role |
|---|---|
| bnr.baby | the beginner door — the Tier-1 passkey wallet wizard ("the baby wallet": free, browser, zero-balance, no hardware) |
| bnr.quest | bIQ quests |
| bnr.lol | kernel lore & fun |

**The Social ruling (kills the overlap the audit flagged):** ONE social engine, TWO doors. skaists.social = the makers' skin, bnature.social = the organism/community skin — shared engine (the atproto/buzz mirror lane), separate identities, no third overlap. If you'd rather have ONE social and redirect the other, strike a line.

## 4. WHAT THIS DOES TO THE HUB (tomorrow's Claude Design pass, scoped)

1. **Six panels + SIX DOORS row + ALL SURFACES widget → one atlas.** Family-first sections; each surface appears exactly once, in its family, with its home.
2. **Every row carries state:** `LIVE` · `DNS-PENDING` (repo bound, registrar pointing outstanding) · `BUILT-UNHOSTED` (surface exists, no domain home yet) · `SEAT-OPEN`. The 78/70/29 count mismatch dies because every number derives from the one registry.
3. **One registry file is the source of truth** (surface → family → domain → path → state). The hub renders from it; the counts compute from it; the search filters it. No hand-maintained numbers anywhere.
4. **Family glossary line** — one plain sentence per family at each section head (kills first-screen jargon: bMiDi, fUSD, "Wing IV" get their glossary homes).
5. **Manifesto 01–04 moves to beehivenature.com** — the hub is the map, not the sermon (REDLINE if you want it staying).
6. **DNS state is shown, not hidden** — "paths for now" disappears as a confession; a domain waiting on registrar pointing says so with the exact pending action.

## 5. MIGRATION LAW (how surfaces graduate)

The hub is the **index of record**. A surface's home is a `(domain, path)` pair in the registry. When a surface finds its own domain-app — one row changes, the old path keeps serving (redirect or retained), zero link rot, the atlas re-renders, and the counts stay true because they were never hand-written. **No surface ever "moves" — it graduates, and the map records the diploma.**

## 6. OPEN SEATS (founder redlines before structure locks)

1. studio-gate / studio-music — skaists.social (product) or skaists.dev (dev tools)?
2. review / dao-dashboard — skaists.dev or the DAO's own future home?
3. market — skaists.store (commerce) vs skaists.dev (tool)?
4. museum — skaists.art or skaists.lol (it is both)?
5. The Social ruling — two skins of one engine, or one social + one redirect?
6. Manifesto cards to beehivenature.com — yes/no?
7. Six missing front repos (skaists.social, bnature.social, beehivenature.com, beehivebiomass.com, beehivebuds.com, plur-earth) — scaffold during the sprint or on graduation only?

---
*z1 (zCode), acting captain. Portfolio verified against the registrar paste; repo state verified via gh api tonight. The atlas is redlinable line-by-line — once you strike your marks, the hub rebuild follows it mechanically.*
