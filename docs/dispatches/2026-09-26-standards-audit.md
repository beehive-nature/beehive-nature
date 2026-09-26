# 2026-09-26 — Standards audit: published UX metrics over every surface, and the register ruling measured

Seat: Fable 5.1, medium. Lane: measurement only. No surface was restyled beyond the two shared-rider target-size fixes named below. PR #237 (register restoration) was NOT touched; another seat drives it and has already posted its one-tap-deep finding there.

## Why this lane exists

The founder said it plainly: there are real UX/UI/standards metrics, and the estate's own design laws are not them. `e2e/design-acceptance.mjs` scores the estate against the estate. Nothing in the tree scored it against WCAG 2.2, Core Web Vitals or the register ruling as numbers. Two instruments now do, and both are repo-resident so the next seat runs them instead of re-deriving them:

- `e2e/standards-audit.mjs` — axe-core 4.13.0 (Deque) with the WCAG 2.0/2.1/2.2 A+AA rule tags, WCAG 2.2 SC 2.5.8 target size, reflow at 375px, document-level checks (lang/title/viewport/h1/main), FCP, requests, KB, console errors, attempted cross-origin requests. All cross-origin requests are aborted in the harness; the count is what the page would have leaked.
- `e2e/register-divergence.mjs` — the founder's ruling of 2026-09-26 as a colour-blind fingerprint: heading outline (HIER), visible tag sequence (ARR), text density (DENS), interactive grammar (GRAM), plus rendered fonts. Loads each data-reg surface three times with `bregister` set before any script runs. PASS = every register pair differs on ≥2 of the four structural axes. RECOLOR = a pair identical on all four.

Both take `PW_CHROMIUM_PATH` for a box without a playwright-managed browser. `axe-core@4.13.0` is added to `e2e/package.json` and the lockfile by npm, not by hand.

## Evidence caveat

Seven files were attached by Windows path (`README (2).md`, `manifest.json`, `tokens.json`, `SEX 3.2.md`, `UI Design version eternal.html`, `laya.gif`, plus the two plans) and only the two plans reached the session. The register contract is measured here from the founder's quoted text of it (three registers = three readings of one set of facts; bee Instrument Serif/Sans, raver Unbounded/Sora, cypherpunk IBM Plex Mono; `move the detail, never delete it`), not from the files.

## 1. Standards audit — before (main at fb8da542) and after the two rider fixes

| metric (375×812) | before | after | standard |
|---|---|---|---|
| axe nodes critical / serious / moderate / minor | 12 / 557 / 0 / 0 | 12 / 565 / 0 / 0 | WCAG 2.x A+AA |
| surfaces with zero axe violations | 24 / 51 | 23 / 51 | |
| interactive targets under 24×24 px | 527 / 4662 | 437 / 4662 | WCAG 2.2 SC 2.5.8 (AA) |
| interactive targets under 44×44 px | 2758 / 4662 | 2758 / 4662 | WCAG 2.5.5 AAA, Apple HIG, Material |
| horizontal overflow at 375 px | 0 surfaces | 0 | WCAG 1.4.10 |
| missing lang / title / viewport | 0 / 0 / 0 | same | WCAG 3.1.1, 2.4.2 |
| h1 ≠ 1 / no main landmark | 2 / 3 | same | WCAG 1.3.1, 2.4.1 |
| surfaces with console or page errors at load | 11 | 11 | |
| surfaces attempting cross-origin requests at load | 9 | 9 | |
| median FCP / over 1800 ms | 72 ms / 0 | 72 / 0 | CWV lab "good" < 1800 ms |

The two rider fixes (`surfaces/lang.js` language select `min-height:24px`; `surfaces/rails-badge.js` recheck glyph `min-width:24px`) removed the two under-size targets that every rider-carrying surface repeated (90 targets across 45 surfaces). Loader pins moved `lang.js?v=26→27`, `rails-badge.js?v=4→5`, with the six test pins that assert the lang.js version (register.test + five view batteries) moved in the same commit. The serious count moved 557→565 and zero-violation surfaces 24→23 between runs on identical page sources: the deltas are on surfaces whose contrast node counts vary run to run with lazily rendered content (blood.html rendered 7 contrast nodes in run two that it had not painted by the axe pass in run one). Two runs is not a trend; the instrument prints the per-surface numbers so the next run can tell.

What the standards say is actually wrong, by weight:

| rule | impact | WCAG | surfaces | nodes |
|---|---|---|---|---|
| color-contrast | serious | 1.4.3 | 20 | ~520 |
| link-in-text-block | serious | 1.4.1 | 4 | 18 |
| target-size | serious | 2.5.8 | 1 (bqueenbee-live) | 12 |
| label | critical | 4.1.2 | 3 (bmeshasi ×7, bantfarm, recover) | 9 |
| scrollable-region-focusable | serious | 2.1.1 | 4 | 5 |
| select-name | critical | 4.1.2 | 3 | 3 |
| nested-interactive | serious | 4.1.2 | 2 | 2 |

The contrast failures are token-level, not page-level. One ink is most of it: `#5f6f61` (the dim caption ink) on the estate's dark grounds measures 3.3–3.7:1 and needs 4.5:1. It accounts for bset (102 nodes), attest (29), bantfarm (21), blood (7), bnames, plus wallet's own set. The second family is the cyan action ink `#00e5ff` on light grounds in blanguage (1.5:1, 43 nodes) and `#7ddf8f`/`#8a9a8a` on bnamesday's cream. Lifting `#5f6f61` to roughly `#7d8f7f` clears about 200 nodes across 6 surfaces in one token change. That is a design-seat decision, not this lane's.

wallet.html specifically, the frozen golden-dress reference: 77 serious contrast nodes and one critical (a select with no accessible name), 26 targets under 44px, plus a 404 on `assets/house/house-seal-roundel.svg`.

## 2. The register ruling, measured on main

Verdicts: WEAK 5, RECOLOR 12, PASS 15. PASS = every register pair differs on ≥2 of HIER/ARR/DENS/GRAM. RECOLOR = at least one pair identical on all four. WEAK = a pair differs on one axis only. NO-REG = a register did not apply (body[data-reg] missing).

| surface | verdict | bee/raver same axes | bee/cypher same axes | raver/cypher same axes | density b/r/c (chars per 1000px) | visible els b/r/c | headings b/r/c | interactive (link,btn,input,sel,details open) b/r/c | median font px b/r/c | top font b / r / c | dress |
|---|---|---|---|---|---|---|---|---|---|---|---|
| attest.html | WEAK | HIER DENS GRAM | HIER DENS GRAM | HIER DENS GRAM | 1508/1500/1519 | 333/331/333 | 1222/1222/1222 | 64,6,0,1,0/0 · 64,6,0,1,0/0 · 64,6,0,1,0/0 | 10.5/10.5/10.5 | IBM Plex Mono(193) / IBM Plex Mono(191) / IBM Plex Mono(190) | — |
| austras-koks.html | WEAK | HIER DENS GRAM | HIER DENS | HIER DENS | 1055/1125/1159 | 142/138/145 | 1/1/1 | 59,16,0,1,1/0 · 59,16,0,1,1/0 · 59,16,0,1,1/1 | 12/12/12 | ui-sans-serif(68) / ui-sans-serif(69) / ui-sans-serif(51) | — |
| b4b.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS | HIER ARR DENS | 1694/1694/1724 | 181/181/181 | 122222/122222/122222 | 70,5,0,1,3/0 · 70,5,0,1,3/0 · 70,5,0,1,3/3 | 12/12/12 | IBM Plex Mono(76) / IBM Plex Mono(76) / IBM Plex Mono(76) | — |
| bantfarm.html | WEAK | HIER DENS GRAM | HIER DENS | HIER DENS | 1309/1282/1395 | 285/283/310 | 1222222/1222222/1222222 | 68,11,3,2,0/0 · 68,11,3,2,0/0 · 69,11,3,2,0/0 | 11.5/10.5/10.5 | IBM Plex Mono(110) / IBM Plex Mono(106) / IBM Plex Mono(118) | — |
| bdata.html | RECOLOR | HIER ARR DENS GRAM | HIER | HIER | 785/823/1015 | 250/250/254 | 12332/12332/12332 | 61,9,1,1,4/0 · 61,9,1,1,4/0 · 61,9,1,1,4/4 | 14/14/14 | system-ui(86) / system-ui(86) / system-ui(83) | — |
| bearth.html | PASS | GRAM | — | — | 516/459/1846 | 124/116/782 | 1/∅/12222222442 | 60,6,0,1,1/0 · 60,6,0,1,1/0 · 75,4,5,2,2/1 | 16/16/10.5 | system-ui(70) / system-ui(64) / ui-monospace(225) | — |
| bfood.html | PASS | GRAM | — | — | 596/510/1728 | 112/105/1627 | 1/∅/1223333333222444222222 | 61,6,0,1,1/0 · 61,6,0,1,1/0 · 71,4,7,3,3/2 | 16/16/10.5 | system-ui(71) / system-ui(66) / ui-monospace(792) | — |
| bigen.html | PASS | GRAM | — | — | 625/506/1326 | 122/115/575 | 1/∅/122222322333222 | 61,6,0,1,1/0 · 61,6,0,1,1/0 · 120,7,0,1,3/1 | 16/16/10.5 | system-ui(71) / system-ui(66) / ui-monospace(314) | — |
| blanguage.html | PASS | HIER DENS | — | DENS | 1574/1711/1784 | 799/795/847 | 1232233332233/1232233332233/12223222233332233 | 108,5,0,1,0/0 · 107,5,0,1,0/0 · 111,5,0,1,1/0 | 10.5/10.5/10.5 | system-ui(472) / IBM Plex Mono(466) / IBM Plex Mono(503) | — |
| blongevity.html | PASS | GRAM | — | — | 575/501/1673 | 116/110/313 | 1/∅/122223322 | 63,6,0,1,1/0 · 63,6,0,1,1/0 · 92,5,1,2,2/1 | 16/16/10 | system-ui(72) / system-ui(67) / ui-monospace(168) | — |
| bnames.html | WEAK | HIER DENS GRAM | HIER DENS GRAM | HIER DENS GRAM | 1204/1161/1172 | 265/252/262 | 12222222/12222222/12222222 | 61,9,6,1,0/0 · 61,9,6,1,0/0 · 61,9,6,1,0/0 | 11.5/11.5/11.5 | IBM Plex Mono(114) / IBM Plex Mono(105) / IBM Plex Mono(105) | — |
| bnamesday.html | PASS | DENS | — | — | 576/547/1616 | 282/922/2527 | 122222/∅/222222222222222 | 68,27,13,4,6/0 · 60,15,7,3,1/0 · 98,15,13,7,0/0 | 14/14/13 | system-ui(161) / system-ui(85) / ui-monospace(958) | — |
| bqueenbee-live.html | RECOLOR | HIER ARR DENS GRAM | HIER DENS GRAM | HIER DENS GRAM | 1781/1781/1786 | 231/231/232 | 122222/122222/122222 | 64,53,1,1,0/0 · 64,53,1,1,0/0 · 64,53,1,1,0/0 | 10/10/10 | IBM Plex Mono(112) / IBM Plex Mono(112) / IBM Plex Mono(113) | — |
| bset.html | WEAK | HIER DENS GRAM | HIER DENS GRAM | HIER DENS GRAM | 971/967/970 | 1637/1635/1636 | 1222/1222/1222 | 163,8,1,1,0/0 · 163,8,1,1,0/0 · 163,8,1,1,0/0 | 10.5/10.5/10.5 | IBM Plex Mono(436) / IBM Plex Mono(434) / IBM Plex Mono(434) | — |
| bsymposium.html | PASS | GRAM | — | — | 526/428/2166 | 125/118/334 | 1/∅/1222233322 | 60,6,0,1,1/0 · 60,6,0,1,1/0 · 106,4,0,1,2/1 | 16/16/10.5 | system-ui(70) / system-ui(64) / ui-monospace(184) | — |
| buzz-directory.html | PASS | — | — | — | 599/484/934 | 133/127/468 | 1/∅/12222222222 | 66,6,0,1,1/0 · 65,6,0,1,1/0 · 98,4,0,1,20/18 | 16/16/10.5 | system-ui(74) / system-ui(70) / ui-monospace(269) | — |
| buzz-studio.html | RECOLOR | HIER DENS GRAM | HIER ARR DENS GRAM | HIER DENS GRAM | 1242/1246/1305 | 685/683/685 | 122222/122222/122222 | 65,22,1,1,0/0 · 65,22,1,1,0/0 · 65,22,1,1,0/0 | 12/12/12 | ui-monospace(60) / ui-monospace(58) / ui-monospace(65) | — |
| bview.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR DENS GRAM | 1064/1047/1117 | 95/95/95 | 1/1/1 | 60,6,1,1,0/0 · 60,6,1,1,0/0 · 60,6,1,1,0/0 | 14/14/14 | system-ui(61) / system-ui(61) / system-ui(51) | — |
| index.html | PASS | DENS | — | HIER | 489/480/695 | 3958/4165/3874 | 123332333323/1223332333323/1223332333323 | 307,6,1,2,122/0 · 312,6,1,2,122/1 · 308,6,1,2,122/112 | 14/12/12 | system-ui(2028) / system-ui(1802) / ui-monospace(2081) | — |
| kandi.html | PASS | HIER GRAM | HIER | HIER | 855/970/1101 | 187/188/212 | 1222/1222/1222 | 63,22,4,1,1/0 · 63,22,4,1,1/0 · 63,22,4,1,1/1 | 16/12/12 | system-ui(104) / IBM Plex Mono(53) / ui-sans-serif(51) | — |
| law-of-the-sea.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1505/1505/1095 | 350/350/350 | 123333333333333333333333/123333333333333333333333/123333333333333333333333 | 61,5,0,1,5/0 · 61,5,0,1,5/0 · 61,5,0,1,5/5 | 14/14/14 | system-ui(250) / system-ui(250) / ui-monospace(215) | — |
| listening.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS | HIER ARR DENS | 1145/1145/1079 | 159/159/159 | 122/122/122 | 63,9,1,1,2/0 · 63,9,1,1,2/0 · 63,9,1,1,2/2 | 12/12/12 | IBM Plex Mono(55) / IBM Plex Mono(55) / IBM Plex Mono(55) | — |
| music.html | PASS | HIER DENS | DENS GRAM | DENS | 938/875/945 | 262/311/274 | 12222222/12222222/122222222 | 73,8,0,1,0/0 · 73,9,0,1,0/0 · 73,8,0,1,0/0 | 12/12/11 | system-ui(100) / ui-monospace(99) / ui-monospace(113) | — |
| myspace.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1111/1039/1557 | 121/121/121 | 1/1/1 | 59,10,0,1,1/0 · 59,10,0,1,1/0 · 59,10,0,1,1/1 | 12/12/12 | ui-sans-serif(51) / ui-sans-serif(51) / ui-sans-serif(51) | — |
| plur.html | PASS | DENS GRAM | DENS | DENS | 847/839/837 | 482/522/567 | 122/1333322/1333322322 | 66,92,1,4,0/0 · 66,92,1,4,0/0 · 68,92,1,4,0/0 | 12/12/12 | ui-monospace(171) / ui-monospace(175) / ui-monospace(205) | — |
| profile.html | PASS | DENS | — | — | 934/913/1066 | 173/167/886 | 1233333/233333/122223222222222222222222233333 | 70,8,1,1,1/0 · 69,8,1,1,1/0 · 77,14,5,1,8/4 | 16/16/11.84 | system-ui(102) / system-ui(98) / ui-monospace(388) | — |
| read.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR DENS GRAM | 969/969/969 | 98/98/98 | 1/1/1 | 61,6,1,1,0/0 · 61,6,1,1,0/0 · 61,6,1,1,0/0 | 14/14/14 | system-ui(61) / system-ui(61) / system-ui(51) | — |
| review.html | PASS | GRAM | — | — | 524/451/2122 | 111/106/199 | 1/∅/122222 | 61,6,0,1,1/0 · 61,6,0,1,1/0 · 64,13,4,6,3/1 | 16/16/12 | system-ui(69) / system-ui(65) / ui-monospace(63) | — |
| royalguard.html | RECOLOR | HIER DENS GRAM | HIER DENS GRAM | HIER ARR DENS GRAM | 1447/1429/1445 | 191/186/186 | 12222/12222/12222 | 75,6,0,1,0/0 · 75,6,0,1,0/0 · 75,6,0,1,0/0 | 11.5/12/12 | IBM Plex Mono(85) / IBM Plex Mono(80) / IBM Plex Mono(80) | — |
| stack.html | PASS | HIER DENS | HIER DENS | HIER DENS | 1643/1669/1775 | 634/625/642 | 1222322222/1222322222/1222322222 | 97,14,0,1,7/0 · 97,14,0,1,5/0 · 100,14,0,1,5/5 | 10.5/10.5/10.5 | IBM Plex Mono(333) / IBM Plex Mono(327) / IBM Plex Mono(340) | — |
| wallet.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1073/1136/1369 | 1156/1156/1156 | 1222222222222222222/1222222222222222222/1222222222222222222 | 65,48,15,6,24/0 · 65,48,15,6,24/0 · 65,48,15,6,24/14 | 10/10/10 | system-ui(681) / system-ui(720) / ui-monospace(720) | contract |
| watch.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 482/498/788 | 261/261/261 | 12233333333222/12233333333222/12233333333222 | 73,4,0,1,4/0 · 73,4,0,1,4/0 · 73,4,0,1,4/2 | 14/14/14 | system-ui(139) / system-ui(139) / ui-monospace(89) | — |

Reading the table:

- **12 of 32 register surfaces are recolor-only** on at least one pair, by the founder's own axes. wallet.html is one: 1156 visible elements in every register, same headings, same tag sequence, same interactive grammar; only density moves because cypherpunk opens the disclosures. bee and raver are the same page there.
- **15 pass**, and they pass for one reason: cypherpunk opens every `details[data-reg-disclose]`, which changes ARR, DENS and GRAM at once. On those 15 the bee/raver pair is still usually identical on HIER and ARR (see the "bee/raver same axes" column): the surfaces differ bee→cypherpunk, not bee→raver.
- **Fonts:** the contract names Instrument Serif/Sans for bee, Unbounded/Sora for raver, IBM Plex Mono for cypherpunk. Nothing on main renders Instrument, Unbounded or Sora in any register. bee and raver render `system-ui` on 20 surfaces and `IBM Plex Mono` on the rest; cypherpunk renders `ui-monospace` or Plex. The raver type system does not exist in the tree yet.
- This is the same finding the #237 seat reported one tap deep, measured at the first screen on main across every adopting surface. The two instruments agree.

## 3. Gates run here

- register.test 15/15; bearth 7/7, bfood 8/8, bigen 8/8, blongevity 8/8, bsymposium 7/7 (the six lang.js pin carriers).
- standards-audit: two full runs, 51 surfaces, 135 s each. register-divergence: one full run, 32 surfaces.
- bdata-surface gate (lang.js touched): GREEN 100/100, run here after aliasing the box's Chromium 141 into the revision playwright 1.62 expects.

## 4. What is next, and whose

1. Design seat: the `#5f6f61` caption ink and the `#00e5ff`-on-light action ink (one token decision, ~250 nodes). Then the 9 critical `label`/`select-name` nodes, which are `aria-label` one-liners.
2. Design seat, via #237's shape: a raver reading that differs from bee in structure on the 12 RECOLOR surfaces, and the raver/bee type systems the contract names. `register-divergence.mjs` is the acceptance instrument; it should go one tap deep next (click each first-screen action, fingerprint again), which is the #237 seat's finding turned into a gate.
3. This lane: wire `standards-audit.mjs` into `tests.yml` as an informational step first (prints, does not fail), then ratchet: zero critical, then no new contrast nodes per surface.

## 5. §7 identity correction (CI static job, run 36230037484)

The first commit on this lane (9fd446a9) was authored as `Claude <noreply@anthropic.com>` and the estate's §7 check failed it: the author of every commit is the founder, the seat self-identifies as committer, and author≠committer commits require a Co-authored-by trailer. This seat had not exported the identities. Cured the estate way, by a descendant in the correct shape, not by rewriting the pushed commit. Seat committer identity from here: `bFable5.1 (Claude Fable 5.1) <noreply@anthropic.com>`, following the `bOPus5 (Claude Opus 5)` pattern already on main.
