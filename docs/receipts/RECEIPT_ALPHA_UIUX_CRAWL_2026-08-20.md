# RECEIPT — the alpha/beta UI-UX estate crawl: every Pages surface, static checks

**From:** zCode-R · **2026-08-20** · **Trigger:** founder order — *"use all of our repos and
github pages; at this point we are building via alpha/beta testing UI and UX."*
**Method:** programmatic crawl of every surface linked from the hub plus all six Pages
roots across the three orgs; static checks (HTTP status, viewport meta, tour.js wiring,
cache-control metas, hover-only tooltip markers). Reproducible by any stranger — the
crawl script pattern is one `fetch` loop.

## The estate, one glance

| Pages property | org | root | status |
|---|---|---|---|
| the surfaces hub (+32 linked pages) | beehive-nature | `/beehive-nature/surfaces/` | **33/33 HTTP 200** |
| bnr-design-system | beehive-nature | `/bnr-design-system/` | 200 · viewport ✓ |
| bnr-design (D-1 token law) | beehive-biomass | `/bnr-design/` | 200 · viewport ✓ |
| bNATURE.bio | beehive-biomass | `/bNATURE.bio/` | 200 · viewport ✓ |
| sovereignty-explorer (alpha) | skaists | `/sovereignty-explorer/` | 200 · viewport ✓ |
| beehive-WELLness | skaists | `/beehive-WELLness/` | 200 · viewport ✓ |

**The headline: zero hard failures.** The tour-404 class that once claimed 16 of 25
surfaces is extinct — every hub-linked surface returns 200 with the tour wired.

## Findings → fixed same hour (this commit, zCode-R)

| surface | finding | fix |
|---|---|---|
| bfactory · btranslated · bfood · review | missing the cache-control metas the `4b2d1c4` handoff made law (the founder-pressed-stale-builds lesson) | metas added, identical form |
| recover | the estate's one tour-nav orphan | `tour.js?v=8` wired before `</body>` |

## Ledger — real, owned elsewhere, not touched here

| item | owner lane | note |
|---|---|---|
| **bfood hover-only tooltips** (`hover:1` — mousemove pattern) | the bFood rebuild (Design critique constraints, already assigned) | the A16 violation: per-food values, ≈ caveat, UL citation unreachable on the founder's phone. The rebuild's constraints are the critique's four laws; fix is a text twin, not a patch. |
| **review.html hover-only tooltips** (`hover:1`) | Seat 3 / design pass | same A16 law, smaller surface — needs its text twins for alpha |
| mobile/A16 **rendered** pass | all seats | static checks pass estate-wide; the in-app browser webview refused to attach in this environment (3 attempts, receipted) — a real thumbs-on-glass pass is still owed before calling the UX beta |
| reading-level toggle beyond BiGen, persona-states rendering | beta seam (Design D5 + corpus lane) | the corpus string layer reaching other surfaces IS the beta integration |

*zCode-R, 2026-08-20. The estate is alpha-clean by every static measure; what remains is
owned, assigned, and written down.*
