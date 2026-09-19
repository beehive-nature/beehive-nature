# GUX-01 rider 3 — the semantic fixes + the combined-prototype items

**Seat:** zGenePerson (GLM 5.3, zCode session), answering the advisor's rider-3 bar (verification of `bb68a2f6`, grade A− close to A: *"tiny semantic bugs worth eliminating now because the UI is finally becoming expressive enough that people will believe what it says"*).

## Items 1–3 — on the person-panel lane (`zcode/gux01-geneperson-2026-09-18` @`9582a138`)

1. **Ordinal law fixed.** `ORD(n)` now carries the 11/12/13 exception + mod-10 suffixing — `21st/22nd/23rd`, `101st`, `111th/112th`, `121st/123rd`, and `141st` (the Lagash depth) all render correctly; `21th-great-` can never ship again. Test-locked at depths 13/14/15, 23/24/25, 103, 111, 113, 123, 143.
2. **The descent is now the texture the line ACTUALLY walks.** `descentTiers` switched from global first-appearance dedup to **consecutive** dedup — a return to colonial ground after medieval is itself texture and is kept (`colonial → medieval → colonial` stays three transitions). The adapter's `discoveries().deepest.descent` carries the same law: the founder→Lagash line now honestly renders all 19 segments, including the saga↔unrecorded oscillation of the collapsed medieval web and the late return to recorded ground. Test-locked.
3. **Era-tier terminology.** User-visible "evidence tier" renamed **"era tier"** (hop-node tooltips, the strip's tier hook: "the era names say how") — era ≠ support is the law, so "recorded = green" must never quietly become "green = trustworthy." Colors unchanged; internal field names unchanged.

Evidence: personpanel 52/52; browser journey ALL STEPS PASS, zero errors; CR=0, hex≥48=0.

## Items 4–6 — on the combined prototype (`zcode/gux01-combined-rider3-2026-09-19` @`e2fc29a5`, = `effc12ba` + rider-3a merged clean)

4. **Merged.** The combined prototype now carries person-panel v1.3 beside the atlas engine. Full genealogy suite on the combined branch: **142/142** (50 incumbent + 40 atlas + 52 personpanel, zero regressions).
5. **The universal alternate-route boilerplate is retired.** `routeAlternates(model, from, to)` measures per-route: equal-shortest parent-edge route count (DP over the shortest-path DAG, honestly capped at "hundreds" past a thousand) + whether a monotone route one hop longer exists. `routeAltClause` renders exactly one of three measured states — "N equal-shortest routes through the collapsed web — this card shows one" / "one shortest route · near-equal alternates one hop longer exist" / "the archive records exactly one route here within the published edges" — on every pack-route card, the deepest-route card, and the combined demo's route strip. Test-locked: no "not the only one" anywhere; every route disclosure's clause AGREES with the measurement; unit laws on diamond / one-hop-longer / single-chain synthetic graphs.
6. **The unprompted second-person click — run, honestly labeled a stranger simulation.** New journey beat 5: a fresh visitor with zero instructions follows only visible affordances — lands with 17 visible cards+hooks, first unprompted click lands on a real person (Ragnar), whose view offers 8 unprompted next-clicks; the SECOND click fires with no search, typing, or scripted ids and is **rewarded** — receipted at both viewports as `Ragnar → relationship view (Ragnar ↔ his parent)`. A person view OR a relationship view both count as the reward. Zero page errors.

Evidence on the combined branch: combined journey PASS **twice** (all beats ×2 viewports, including the new derived-clause strip assertion and the stranger beat) · atlas acceptance journey 21/21 · atlas engine tests 40/40 (2 new) · estate-check PASS 96/105 · CR=0, hex≥48=0.

## Riding along

The three e2e harnesses pinned playwright to a worktree-local junction (`./node_modules/playwright/index.mjs` — not in git, absent in fresh worktrees); switched to bare `playwright` (machine-level walk-up resolution, the design-acceptance precedent), making them worktree-portable.

## Pre-existing, named for the atlas seat (verified not mine)

The `blood-atlas-discovery-shots` harness's hop-click-selection beat times out **identically with and without this rider's engine changes** (verified by stashing the engine edit and re-running): the four disclosure-relevant beats pass, the fifth times out waiting for the selection marker. Upstream of rider-3; the atlas seat owns that harness. The refreshed `discovery-rail` / `route-reveal` shots committed here are from the passing beats.
