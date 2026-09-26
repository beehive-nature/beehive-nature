# ETERNAL wave 2: 40 more surfaces as three products each (2026-09-26)

**Seat:** Claude (cloud session). The founder is the author and Claude the committer.
**Branch:** `claude-lovis/magical-allen-dd0xqh` (PR #240). Wave 1 (#239) went live on Pages as c013f2e1.
**Order:** "THREE SEPERATE UI/UX'S IN THE SINGLE SURFACE", measured against skaists. Standing order: "push everything out".

## What landed
With this PR, 71 surfaces carry three authored fronts. Each has one data layer that reads the page's own facts, and every gesture hands off to the page's real flow.

| batch | surfaces | commit |
|---|---|---|
| W2-H | fleet-hosted index, acid-cascade, indigo-index, resonance, bnr-dashboard | 33d8e639 |
| W2-C | bLighT midi, midi-organ, midiroom, midivault, studio-music | 2793b302 |
| W2-F | hardware guide, build, lab, security, stack | fea667d5 |
| W2-D | bLighT pixelrefiner, studio-gate, inscription-explorer, compare, bnri-gallery | d08abb8d |
| W2-A | doors hub, beehivenature, skaists, plur, bnature-social | 3332b297 |
| W2-B | doors bnature-bio, beehivebiomass, both hive doors, ant-door | 212093a1 |
| W2-E | forge index, hexfield, huddle, room, comb | c522ad48 |
| W2-G | recover, keys/addresses, royalguard, privacy-lens, attest | 63af4188 |

Each commit message carries its surfaces' flow, the three UIs, the facts and their sources, and the before → after whole-page scores.

## Rulings kept
- **Frozen or preserved:** forge/orbit.html is frozen (forge-freeze ok). The doors' hex band stays byte-true (each test pins it; doors.mjs 41/41). The fleet art stays exactly as made (0 lines removed; preserve dress; fleet-pixels, fleet-bus and intake-daybucket green).
- **Keys and custody:** no front reads, stores, copies, logs or sends a word, key or note secret. Each test proves it with wrapped field getters, network and storage, a typed sentinel, and a source scan.
- **Excluded:** wallet.html, forge/orbit-v2.html, the generated index.html, the redirects jams.html and watch-ant.html, and the fleet/* originals.

## Honesty fixes found inside old pages
- fleet-hosted/index said its copies differ "by exactly one line each" and that it "runs no JavaScript". On HEAD they differed by 3-40 lines and it loaded two scripts.
- pixelrefiner called its FUNGI sprites "live … read from the contract". fungiSheet() draws embedded constants and makes no request.
- inscription-explorer said "this garden is quiet" when no RPC had answered at all.
- Several dashes shown as values now say what they mean: "not detected", "no layer measured yet", "not decoded", "source pending".
- stack.html's organ board printed a raw key ("st.stamp").
- hexfield's #link threw on a refused clipboard.
- comb's HUD showed "–%" under reduced motion until six interactions.

## CI shape (the cap is 20 min everywhere; the batteries split instead)
- The bottom-half audit moved from `node` to `eternal`. `node` had hit 19m09s on main; it then ran 16m22s.
- The skaists meter moved to its own `meter` job. 51 fronts took 7m11s here, and wave 2 takes the list past 70.
- bview-eternal failed once under the full 73-file battery. Its dial breathes, so Playwright never saw a still frame. The tap no longer waits for one (0763f49e). The full step then passed 449/449 in 6 min on this box.

## Receipts
Lead-verified per batch, then on the committed tree:
- Each surface's `*-eternal` test is red on its HEAD page.
- The full ETERNAL step passes 449/449.
- The meter holds 71 fronts at 100% x3.
- footer-audit ratchet: 0 worse. no-page-errors: 113 surfaces, 0. estate-source 11/11.
- lint-ci-shape: 90/90.

## Named for the founder (not acted on)
- `fleet-hosted/I1-EXEMPTION.md` still says the index makes zero subresource requests. It already loaded two same-origin scripts before this wave.
- The hive doors deploy to the relay as single files without skaists.css, so their fronts stand aside there. Serving it is an ops decision.
- skaists-buzz's "estate relay · live" eyebrow is static.
- keys/addresses' input still says "paste a root seed".
- design-acceptance (not in CI) conflicts with the skaists and casing laws. This is the same question as the design-system eyebrow and D4.
- Still open from wave 1: the profile lineage_corpus pin, the wallet three-UI plan, and three-node-plan.md / server-exit-plan.md.

## Not done
- **Wave 3:** 36 surfaces are in progress (the fleet labs, the rest of bLighT, and the root pages), on the same brief with its wave 3 rulings (law-of-the-sea's print first screen, dock-claims, design-system specimens, the QR codes).
- **Translations:** about 2,300 `et.*` strings are English through `T()`; the corpus pass follows the rollout.
- **Live chain and network states:** unreachable from this box. Success states are proved with fixtures only, and every fixture is named in its test.
