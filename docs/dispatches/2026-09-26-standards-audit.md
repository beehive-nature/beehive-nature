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

## 6. Second pass — the register ruling measured against the committed design sheet (after main merged in, 48 data-reg surfaces)

The design sheet the founder's bundle carries is in the tree: `docs/design/skaists/tokens.json` (git blob `1866b934e4618668ef918c50b9a45a06d3df3ae1`, its own `meta.ref main@f7465f4`, `synced 2026-09-19`) beside `docs/design/skaists/manifest.json`. `e2e/register-divergence.mjs` now reads it and prints that provenance in its header. What is measured is the REPOSITORY COPY; whether it is byte-equal to the founder's original design-pass upload is not established here and the instrument says so. Two fidelity columns were added beside the structural verdict and are never folded into it: matching fonts and grounds does not make three experiences.

Expected first-choice families from the sheet: new bee = Instrument Sans / Instrument Serif; raver = Sora / Unbounded; cypherpunk = IBM Plex Mono; the house hand = burti; the sheet's zero-fetch `ui` stack (system-ui) is counted as its own class because the sheet sanctions it for live estate surfaces.

Totals after the merge of main 8fd210f9 (the bottom-half + ETERNAL lanes added 16 data-reg surfaces; 32 → 48):

| measure | new bee | raver | cypherpunk |
|---|---|---|---|
| structural verdicts (all three registers) | RECOLOR 21 · WEAK 11 · PASS 16 of 48 | | |
| mean text share: register family / house / ui stack / other (%) | 1 / 0 / 69 / 29 | 1 / 0 / 60 / 38 | 31 / 0 / 32 / 37 |
| surfaces rendering ANY of the register's own family | 1 / 48 | 1 / 48 | 29 / 48 |
| body ground equals the sheet's `bg` | 22 / 48 | 8 / 48 | 9 / 48 |

Reading it:

- **One surface on main renders the sheet's bee and raver type: blood.html** (Instrument Sans on 59% of its text in bee, Sora on 57% in raver). It is the ETERNAL lane's bGENEaLOGy surface and it PASSES the structural test. Every other surface renders system-ui or Plex in bee and raver: the raver and new-bee type systems exist on exactly one page.
- **cypherpunk's "other" is mostly `ui-monospace`**: register.js dresses cypherpunk with `ui-monospace, Cascadia Mono, Consolas, monospace`, so the first-choice family is the system mono, not the sheet's IBM Plex Mono. Plex appears first on 29 of 48 surfaces through their own styles. Strict reading, reported as measured.
- **The 16 surfaces main added are 12 RECOLOR, 3 WEAK, 1 PASS.** The RECOLOR set is now 21: ant-door, b4b, bdata, bfactory, biq, bmeshasi, bqueenbee-live, btranslated, comb, design-system, law-of-the-sea, listening, museum, myspace, or-board, privacy-lens, read, record, vending, wallet, watch. wallet.html, the golden-dress reference, is unchanged: 1148 visible elements in all three registers, same outline, same grammar.
- **Ground fidelity is low in the dark registers**: raver's body ground equals the sheet's `#06110c` on 8 of 48, cypherpunk on 9 of 48. New bee's paper `#fbf7f0` holds on 22 of 48.

Full per-surface table for this pass:

| surface | verdict | bee/raver same axes | bee/cypher same axes | raver/cypher same axes | density b/r/c (chars per 1000px) | visible els b/r/c | headings b/r/c | interactive (link,btn,input,sel,details open) b/r/c | median font px b/r/c | top font b / r / c | token font share reg/house/ui/other % b · r · c | bg = tokens b/r/c | dress |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ant-door.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR DENS GRAM | 1167/1195/1248 | 99/99/99 | 122/122/122 | 58,4,0,1,0/0 · 58,4,0,1,0/0 · 58,4,0,1,0/0 | 13/13/13 | ui-sans-serif(51) / ui-sans-serif(51) / ui-sans-serif(51) | 0/0/99/1 · 0/0/99/1 · 0/0/79/21 | n/n/n | — |
| attest.html | WEAK | HIER GRAM | HIER DENS GRAM | HIER GRAM | 1116/986/1216 | 326/324/326 | 1222/1222/1222 | 62,5,0,1,0/0 · 62,5,0,1,0/0 · 62,5,0,1,0/0 | 14/14/12.5 | system-ui(187) / IBM Plex Mono(186) / IBM Plex Mono(185) | 0/0/97/3 · 0/0/23/77 · 76/0/21/4 | n/n/n | — |
| austras-koks.html | WEAK | HIER DENS GRAM | HIER | HIER DENS | 1005/1071/1119 | 135/131/138 | 1/1/1 | 57,15,0,1,1/0 · 57,15,0,1,1/0 · 57,15,0,1,1/1 | 13/13/13 | ui-sans-serif(68) / ui-sans-serif(69) / ui-sans-serif(51) | 0/0/99/1 · 0/0/99/1 · 33/0/61/6 | y/y/y | — |
| b4b.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1117/1062/1354 | 174/174/174 | 122222/122222/122222 | 68,4,0,1,3/0 · 68,4,0,1,3/0 · 68,4,0,1,3/3 | 14/14/13 | system-ui(69) / IBM Plex Mono(71) / IBM Plex Mono(71) | 0/0/94/6 · 0/0/44/56 · 56/0/40/4 | n/n/n | — |
| bantfarm.html | WEAK | HIER DENS GRAM | HIER | HIER | 1001/947/1132 | 278/276/303 | 1222222/1222222/1222222 | 66,10,3,2,0/0 · 66,10,3,2,0/0 · 67,10,3,2,0/0 | 14/14/13 | system-ui(78) / IBM Plex Mono(105) / IBM Plex Mono(117) | 0/0/76/24 · 0/0/33/67 · 60/0/26/14 | n/n/n | — |
| bdata.html | RECOLOR | HIER ARR DENS GRAM | HIER | HIER | 758/794/1000 | 244/244/248 | 12332/12332/12332 | 59,8,1,1,4/0 · 59,8,1,1,4/0 · 59,8,1,1,4/4 | 14/14/14 | system-ui(87) / system-ui(87) / system-ui(84) | 0/0/97/3 · 0/0/97/3 · 0/0/93/7 | y/n/n | — |
| bearth.html | PASS | GRAM | — | — | 528/471/1503 | 117/109/775 | 1/∅/12222222442 | 58,5,0,1,1/0 · 58,5,0,1,1/0 · 73,3,5,2,2/1 | 16/16/12 | system-ui(68) / system-ui(62) / ui-monospace(233) | 0/0/100/0 · 0/0/100/0 · 0/0/19/81 | y/n/n | — |
| bfactory.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 1097/1050/1251 | 213/213/213 | 122222/122222/122222 | 60,7,0,1,0/0 · 60,7,0,1,0/0 · 60,7,0,1,0/0 | 14/14/13 | system-ui(90) / IBM Plex Mono(88) / IBM Plex Mono(88) | 0/0/97/3 · 0/0/38/62 · 60/0/35/5 | n/n/n | — |
| bfood.html | PASS | GRAM | — | — | 598/512/1330 | 105/98/1620 | 1/∅/1223333333222444222222 | 59,5,0,1,1/0 · 59,5,0,1,1/0 · 69,3,7,3,3/2 | 16/16/12 | system-ui(69) / system-ui(64) / ui-monospace(792) | 0/0/100/0 · 0/0/100/0 · 8/0/6/86 | y/n/n | — |
| bigen.html | PASS | GRAM | — | — | 624/505/1172 | 115/108/560 | 1/∅/122222322333222 | 59,5,0,1,1/0 · 59,5,0,1,1/0 · 118,6,0,1,3/1 | 16/16/12 | system-ui(69) / system-ui(64) / ui-monospace(308) | 0/0/100/0 · 0/0/100/0 · 1/0/14/85 | y/n/n | — |
| biq.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 1080/1085/1262 | 176/176/176 | 1222222/1222222/1222222 | 65,6,7,2,0/0 · 65,6,7,2,0/0 · 65,6,7,2,0/0 | 14/14/13 | system-ui(72) / IBM Plex Mono(70) / IBM Plex Mono(70) | 0/0/98/2 · 0/0/44/56 · 56/0/40/4 | n/n/n | — |
| blanguage.html | PASS | HIER | — | — | 1250/1099/1477 | 717/713/765 | 1232233332233/1232233332233/12223222233332233 | 91,4,0,1,0/0 · 90,4,0,1,0/0 · 94,4,0,1,1/0 | 14/14/12 | system-ui(426) / IBM Plex Mono(415) / IBM Plex Mono(452) | 0/0/100/0 · 0/0/13/87 · 88/0/10/2 | n/n/n | — |
| blongevity.html | PASS | GRAM | — | — | 575/501/1301 | 109/103/306 | 1/∅/122223322 | 61,5,0,1,1/0 · 61,5,0,1,1/0 · 90,4,1,2,2/1 | 16/16/12 | system-ui(70) / system-ui(65) / ui-monospace(168) | 0/0/100/0 · 0/0/100/0 · 0/0/24/76 | y/n/n | — |
| blood.html | PASS | HIER DENS | DENS | DENS | 1110/1045/1070 | 425/416/444 | 221/221/3321 | 65,36,5,1,1/0 · 64,43,1,1,0/0 · 66,37,1,1,0/0 | 14/14/13 | Instrument Sans(134) / Sora(78) / IBM Plex Mono(150) | 59/1/24/16 · 57/0/39/4 · 73/0/25/2 | y/y/y | — |
| bmeshasi.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 985/985/1214 | 334/334/334 | 1233222222/1233222222/1233222222 | 73,5,7,1,0/0 · 73,5,7,1,0/0 · 73,5,7,1,0/0 | 14/14/12 | IBM Plex Mono(188) / IBM Plex Mono(188) / IBM Plex Mono(188) | 0/0/23/77 · 0/0/23/77 · 77/0/21/2 | n/n/n | — |
| bnames.html | WEAK | HIER DENS GRAM | HIER GRAM | HIER GRAM | 884/854/1035 | 258/245/255 | 12222222/12222222/12222222 | 59,8,6,1,0/0 · 59,8,6,1,0/0 · 59,8,6,1,0/0 | 14/14/12 | IBM Plex Mono(109) / IBM Plex Mono(100) / IBM Plex Mono(100) | 0/0/32/68 · 0/0/35/65 · 58/0/30/12 | n/n/n | — |
| bnamesday.html | PASS | DENS | — | — | 566/530/1615 | 275/915/2520 | 122222/∅/222222222222222 | 66,26,13,4,6/0 · 58,14,7,3,1/0 · 96,14,13,7,0/0 | 14/14/13 | system-ui(161) / system-ui(85) / ui-monospace(958) | 0/2/98/0 · 0/7/93/0 · 0/0/11/89 | y/y/y | — |
| bqueenbee-live.html | RECOLOR | HIER ARR DENS GRAM | HIER GRAM | HIER GRAM | 1078/1078/1377 | 224/224/225 | 122222/122222/122222 | 62,52,1,1,0/0 · 62,52,1,1,0/0 · 62,52,1,1,0/0 | 14/14/12 | IBM Plex Mono(107) / IBM Plex Mono(107) / IBM Plex Mono(108) | 0/0/34/66 · 0/0/34/66 · 66/0/31/3 | n/n/n | — |
| bset.html | WEAK | HIER DENS GRAM | HIER GRAM | HIER GRAM | 668/665/747 | 1630/1628/1629 | 1222/1222/1222 | 161,7,1,1,0/0 · 161,7,1,1,0/0 · 161,7,1,1,0/0 | 14/14/12 | IBM Plex Mono(431) / IBM Plex Mono(429) / IBM Plex Mono(429) | 0/0/11/89 · 0/0/11/89 · 88/0/10/2 | n/n/n | — |
| bsymposium.html | PASS | GRAM | — | — | 526/428/1870 | 118/111/327 | 1/∅/1222233322 | 58,5,0,1,1/0 · 58,5,0,1,1/0 · 104,3,0,1,2/1 | 16/16/12 | system-ui(68) / system-ui(62) / ui-monospace(184) | 0/0/100/0 · 0/0/100/0 · 0/0/23/77 | y/n/n | — |
| btranslated.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 1109/1109/1372 | 191/191/191 | 1222222/1222222/1222222 | 59,4,2,2,0/0 · 59,4,2,2,0/0 · 59,4,2,2,0/0 | 14/14/12 | IBM Plex Mono(79) / IBM Plex Mono(79) / IBM Plex Mono(79) | 0/0/41/59 · 0/0/41/59 · 59/0/38/4 | n/n/n | — |
| buzz-directory.html | PASS | — | — | — | 599/484/803 | 126/120/461 | 1/∅/12222222222 | 64,5,0,1,1/0 · 63,5,0,1,1/0 · 96,3,0,1,20/18 | 16/16/12 | system-ui(72) / system-ui(68) / ui-monospace(269) | 0/0/100/0 · 0/0/100/0 · 0/0/16/84 | y/n/n | — |
| buzz-studio.html | WEAK | HIER DENS GRAM | HIER ARR GRAM | HIER GRAM | 927/930/1150 | 678/676/678 | 122222/122222/122222 | 63,21,1,1,0/0 · 63,21,1,1,0/0 · 63,21,1,1,0/0 | 14/14/13 | ui-monospace(60) / ui-monospace(58) / ui-monospace(65) | 0/0/48/52 · 0/0/49/51 · 0/0/44/56 | n/y/y | — |
| bview.html | PASS | HIER DENS | DENS | DENS | 973/993/983 | 151/173/179 | 1/1/122222 | 57,5,1,1,1/0 · 57,6,1,1,1/0 · 57,5,1,1,1/1 | 14/14/14 | system-ui(80) / system-ui(82) / ui-monospace(61) | 0/0/80/20 · 0/0/81/19 · 0/0/46/54 | y/y/y | — |
| comb.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS | HIER ARR DENS | 947/947/1039 | 655/655/655 | 12222/12222/12222 | 63,17,1,1,11/0 · 63,17,1,1,11/0 · 63,17,1,1,11/2 | 14/14/12 | IBM Plex Mono(387) / IBM Plex Mono(387) / IBM Plex Mono(387) | 0/0/13/87 · 0/0/13/87 · 87/0/12/1 | n/n/n | — |
| design-system.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR GRAM | 833/828/922 | 578/578/578 | 122222222/122222222/122222222 | 66,8,1,1,0/0 · 66,8,1,1,0/0 · 66,8,1,1,0/0 | 13/13/12 | ui-monospace(135) / ui-monospace(135) / ui-monospace(140) | 0/0/29/71 · 0/0/29/71 · 0/0/26/74 | n/y/y | — |
| devroom.html | WEAK | HIER ARR GRAM | HIER ARR GRAM | HIER ARR GRAM | 924/1038/1313 | 283/283/283 | 122344443444444443444422/122344443444444443444422/122344443444444443444422 | 66,4,0,1,3/0 · 66,4,0,1,3/0 · 66,4,0,1,3/0 | 14/14/12 | IBM Plex Mono(145) / IBM Plex Mono(145) / IBM Plex Mono(145) | 0/0/26/74 · 0/0/26/74 · 67/0/24/9 | n/n/n | — |
| dock.html | WEAK | HIER ARR GRAM | HIER ARR GRAM | HIER ARR GRAM | 955/1098/1375 | 189/189/189 | 12222222/12222222/12222222 | 75,4,0,1,0/0 · 75,4,0,1,0/0 · 75,4,0,1,0/0 | 14/13.3/12.5 | IBM Plex Mono(69) / IBM Plex Mono(69) / IBM Plex Mono(69) | 0/0/39/61 · 0/0/39/61 · 48/0/35/17 | n/n/n | — |
| fieldnotes.html | WEAK | HIER ARR GRAM | HIER ARR GRAM | HIER ARR GRAM | 956/1193/1340 | 203/203/203 | 12/12/12 | 68,4,0,1,0/0 · 68,4,0,1,0/0 · 68,4,0,1,0/0 | 14/14/13 | IBM Plex Mono(80) / IBM Plex Mono(80) / IBM Plex Mono(80) | 0/0/40/60 · 0/0/40/60 · 57/0/36/6 | n/n/n | — |
| index.html | PASS | DENS | — | HIER | 492/475/695 | 3951/4158/3867 | 123332333323/1223332333323/1223332333323 | 305,5,1,2,122/0 · 310,5,1,2,122/1 · 306,5,1,2,122/112 | 14/14/12 | system-ui(2028) / system-ui(1802) / ui-monospace(2081) | 0/0/96/4 · 0/0/85/15 · 0/0/2/97 | y/y/y | — |
| kandi.html | WEAK | HIER DENS GRAM | HIER | HIER | 840/860/1021 | 180/181/205 | 1222/1222/1222 | 61,21,4,1,1/0 · 61,21,4,1,1/0 · 61,21,4,1,1/1 | 16/14/13 | system-ui(104) / ui-sans-serif(51) / ui-sans-serif(51) | 0/0/100/0 · 0/0/54/46 · 5/0/40/55 | y/n/n | — |
| law-of-the-sea.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1452/1452/1088 | 343/343/343 | 123333333333333333333333/123333333333333333333333/123333333333333333333333 | 59,4,0,1,5/0 · 59,4,0,1,5/0 · 59,4,0,1,5/5 | 14/14/14 | system-ui(250) / system-ui(250) / ui-monospace(215) | 0/0/94/6 · 0/0/94/6 · 0/0/19/81 | y/n/n | — |
| listening.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS | HIER ARR DENS | 1087/1087/1052 | 152/152/152 | 122/122/122 | 61,8,1,1,2/0 · 61,8,1,1,2/0 · 61,8,1,1,2/2 | 13/13/13 | ui-sans-serif(51) / ui-sans-serif(51) / ui-sans-serif(51) | 0/0/53/47 · 0/0/53/47 · 47/0/48/5 | n/n/n | — |
| museum.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR GRAM | 955/927/1044 | 309/309/309 | 122222222/122222222/122222222 | 61,4,0,1,0/0 · 61,4,0,1,0/0 · 61,4,0,1,0/0 | 14/14/13 | system-ui(113) / system-ui(157) / ui-monospace(157) | 0/0/78/22 · 0/0/100/0 · 0/0/24/76 | y/n/n | — |
| music.html | PASS | HIER DENS | DENS GRAM | — | 746/686/808 | 255/304/267 | 12222222/12222222/122222222 | 71,7,0,1,0/0 · 71,8,0,1,0/0 · 71,7,0,1,0/0 | 14/14/12.5 | system-ui(96) / ui-monospace(99) / ui-monospace(113) | 0/0/93/7 · 0/0/41/59 · 0/0/33/67 | y/n/n | — |
| myspace.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 1122/1104/1376 | 114/114/114 | 1/1/1 | 57,9,0,1,1/0 · 57,9,0,1,1/0 · 57,9,0,1,1/1 | 13/13/13 | ui-sans-serif(51) / ui-sans-serif(51) / ui-sans-serif(51) | 0/0/99/1 · 0/0/99/1 · 0/0/69/31 | y/n/y | — |
| or-board.html | RECOLOR | HIER ARR DENS GRAM | HIER | HIER | 1116/1143/1334 | 196/196/197 | 1222/1222/1222 | 63,5,0,1,0/0 · 63,5,0,1,0/0 · 64,4,0,1,0/0 | 13/13/12 | IBM Plex Mono(72) / IBM Plex Mono(72) / IBM Plex Mono(73) | 0/0/43/57 · 0/0/43/57 · 56/0/39/5 | n/n/n | — |
| plur.html | PASS | DENS GRAM | — | DENS | 663/692/767 | 475/515/560 | 122/1333322/1333322322 | 64,91,1,4,0/0 · 64,91,1,4,0/0 · 66,91,1,4,0/0 | 14/14/13 | ui-monospace(171) / ui-monospace(175) / ui-monospace(205) | 0/0/49/51 · 0/0/53/47 · 0/0/49/51 | n/n/n | — |
| privacy-lens.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 1255/1297/1517 | 170/170/170 | 1222/1222/1222 | 62,6,0,1,1/0 · 62,6,0,1,1/0 · 62,6,0,1,1/0 | 13/13/13 | IBM Plex Mono(59) / IBM Plex Mono(59) / IBM Plex Mono(59) | 0/0/49/51 · 0/0/49/51 · 51/0/44/4 | n/n/n | — |
| profile.html | PASS | DENS | — | — | 760/721/982 | 165/159/878 | 1233333/233333/122223222222222222222222233333 | 68,7,1,1,1/0 · 67,7,1,1,1/0 · 75,13,5,1,8/4 | 16/16/12 | system-ui(101) / system-ui(96) / ui-monospace(388) | 0/0/100/0 · 0/0/99/1 · 3/0/14/83 | y/n/n | — |
| read.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR DENS GRAM | 898/898/898 | 91/91/91 | 1/1/1 | 59,5,1,1,0/0 · 59,5,1,1,0/0 · 59,5,1,1,0/0 | 14/14/14 | system-ui(61) / system-ui(61) / system-ui(51) | 0/2/98/0 · 0/2/98/0 · 0/2/82/16 | y/n/n | — |
| record.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR DENS GRAM | HIER ARR DENS GRAM | 531/531/552 | 747/747/747 | 122222222222222222222/122222222222222222222/122222222222222222222 | 209,4,0,1,0/0 · 209,4,0,1,0/0 · 209,4,0,1,0/0 | 14/14/12 | ui-monospace(300) / ui-monospace(300) / ui-monospace(305) | 0/0/16/84 · 0/0/16/84 · 0/0/14/86 | n/n/n | — |
| review.html | PASS | GRAM | — | — | 519/446/1913 | 104/99/192 | 1/∅/122222 | 59,5,0,1,1/0 · 59,5,0,1,1/0 · 62,12,4,6,3/1 | 16/16/13 | system-ui(67) / system-ui(63) / ui-monospace(63) | 0/0/100/0 · 0/0/100/0 · 7/0/43/50 | y/n/n | — |
| royalguard.html | WEAK | HIER DENS GRAM | HIER GRAM | HIER ARR GRAM | 1017/994/1220 | 184/179/179 | 12222/12222/12222 | 73,5,0,1,0/0 · 73,5,0,1,0/0 · 73,5,0,1,0/0 | 14/14/13 | IBM Plex Mono(80) / IBM Plex Mono(75) / IBM Plex Mono(75) | 0/0/41/59 · 0/0/43/57 · 57/0/39/4 | n/n/n | — |
| stack.html | PASS | HIER DENS | HIER | HIER | 1037/1048/1359 | 616/607/624 | 1222322222/1222322222/1222322222 | 95,13,0,1,7/0 · 95,13,0,1,5/0 · 98,13,0,1,5/5 | 14/14/12 | IBM Plex Mono(320) / IBM Plex Mono(314) / IBM Plex Mono(327) | 0/0/15/85 · 0/0/15/85 · 84/0/13/3 | n/n/n | — |
| vending.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR GRAM | HIER ARR GRAM | 1028/1028/1234 | 385/385/385 | 12/12/12 | 76,10,1,3,0/0 · 76,10,1,3,0/0 · 76,10,1,3,0/0 | 14/14/12 | IBM Plex Mono(176) / IBM Plex Mono(176) / IBM Plex Mono(176) | 0/0/25/75 · 0/0/25/75 · 75/0/23/2 | n/n/n | — |
| wallet.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 911/902/1200 | 1148/1148/1148 | 1222222222222222222/1222222222222222222/1222222222222222222 | 63,47,15,6,24/0 · 63,47,15,6,24/0 · 63,47,15,6,24/14 | 14/14/12 | system-ui(683) / system-ui(722) / ui-monospace(722) | 0/0/93/7 · 0/0/98/2 · 1/0/6/93 | y/y/y | contract |
| watch.html | RECOLOR | HIER ARR DENS GRAM | HIER ARR | HIER ARR | 473/487/767 | 254/254/254 | 12233333333222/12233333333222/12233333333222 | 71,3,0,1,4/0 · 71,3,0,1,4/0 · 71,3,0,1,4/2 | 14/14/14 | system-ui(139) / system-ui(139) / ui-monospace(89) | 0/1/91/8 · 0/1/91/8 · 0/1/34/66 | y/n/n | — |
