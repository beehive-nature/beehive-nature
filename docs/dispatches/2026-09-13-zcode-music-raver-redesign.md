# 2026-09-13 · zCode · Raver and music surface redesign (draft PR)

**Assignment.** Rename the user-facing jams.html surface to music.html with old links preserved; redesign Raver as a genuinely distinct experience under the BNR color law (purple = humans, teal = Ai, green = biomass) with PLUR / skaists / LOVErnment context; keep facts and functionality identical across views while changing first-screen temperature, imagery, language density and interaction style; test New bee, Raver and Cypherpunk at 390px and desktop; no payment, wallet or production infrastructure; draft PR with dispatch and screenshots.

## 1 · The rename, done by the ritual

- `surfaces/jams.html` → `surfaces/music.html` via `git mv` (history carried).
- `surfaces/jams.html` is reborn as a **permanent redirect shim**: `<meta http-equiv=refresh>` + `location.replace('music.html' + location.search + location.hash)` so query (`?manifest=…&store=…`) and hash survive the hop; `rel=canonical` to music.html; `noindex`; no shell riders on purpose (a redirect hands you across in one hop — the destination's shell is the shell that loads).
- Registry (root `estate.json`): the jams row became the **music row** (id `music`, path `surfaces/music.html`, LIVE, org skaists, home plur.earth, same label "SKAISTS mUsiC · PLUR jam"), and a second **jams alias row** (path `surfaces/jams.html`, `presented:false`, gloss "permanent redirect to music.html") keeps the tree-for-file counting law honest. Atlas re-derived: **95 counted / 104 listed** (was 94/103 — the shim is a real file, so it is a real counted row, never a duplicate card).
- Wherever a gate counts or walks surfaces, the shim is named with its reason, not waved in: `e2e/university-smoke.mjs` REACHABILITY_EXEMPT (orbit-v2 pattern), `e2e/reachability.mjs` ALLOWLIST (I1-EXEMPTION shape: reason + notCovering), `e2e/register.test.mjs` shell-census carve-out. All three fail-closed lists keep their anti-rot laws (stale/gone/needless entries fail).
- Nav updated everywhere jams.html was linked as a room: plur.html (actions), watch.html (local-nav ×3), blanguage.html (raver dock), review.html deck (lists BOTH music.html and jams.html — both are tree files), hub regenerated from the registry.
- **Proof the old address works**: `zcode-music-check.mjs` navigates `jams.html?manifest=<fixture>` and asserts the browser ends on `music.html?manifest=…` with the manifest VERIFIED — the query rode the redirect.

## 2 · The z2.sec hardening rides THROUGH the rename (flagged, important)

origin/main moved mid-lane (PR #74 z2.sec + PR #70/#72 z2.profile merged 2026-09-12/13). z2.sec's S2 had hardened jams.html in place: same-origin-only `?manifest=`/`?store=` overrides (fail-closed ignore + visible REFUSED row) and the no-referrer meta. A rename that drops a merged security fix is a regression wearing a redesign's clothes, so:

- music.html carries the S2 block **verbatim in intent** (sameOriginOverride guard + REFUSED row) plus `<meta name="referrer" content="no-referrer">`; the shim carries the meta too.
- The renamed test asserts it: a crafted `?manifest=https://attacker.example/evil.json` is IGNORED (the default room still verifies), the refusal is visible in the room log, and zero sub-resource requests touch the attacker origin.
- Merged origin/main cleanly (single conflict: jams.html, resolved to the shim; plur/blanguage/tour auto-merged).

## 3 · Three views, one set of facts

Same DOM, same manifest, same gate, same log — `register.js`'s founder-canon contract. Only temperature, imagery, density and interaction change:

- **New bee (default)** — light estate canvas (#f6f7f2), quiet type, no ambient motion, every control plain and labelled; lead "A calm room. The music is already playing."
- **Raver** — a full-bleed floor: deep purple-black with purple/teal/green radial glows, giant gradient wordmark, a 17ch feel line ("The floor is yours."), first-party SVG artwork (speaker rings breathing, a 14-bar equalizer as the set, five purple crowd silhouettes swaying on a biomass-green horizon — all `aria-hidden`, zero external assets), PLUR strip under the opening, stat-tile facts with poster numerals, a pill "join this jam". The floor story names all three contexts: *come as you are — we accept you*, **skaists** means beautiful, the **LOVErnment** writes its law as care — *mīlestība ir karalis*.
- **Cypherpunk** — mono terminal, compact, boundary-first: a `boundary · evidence` card (dl citing `manifest-reader.js loadManifest()` / `store-reader.js readEncryptedItems()`, no-raw-transport, and an honest UNVERIFIED list) is promoted to the top of the reading order; the lead is "Inspect the manifest, the store read and the gate."

**BNR color law, applied semantically and named on the page** (a visible legend line, keyed ×29): purple = humans (creator credit, the join act), teal = Ai (source credit, visualizer, store adapter), green = biomass (room law, the horizon). Each view respeaks the tokens at its own contrast (bee light tints #65509A/#176879/#326b39, raver luminous #9C6FD6/#45C2DC/#86CC72, cypherpunk terminal set).

**Motion law.** Ambient motion exists only in Raver, and it is a courtesy: a labelled pause control (ux.pause/ux.resume/ux.still, `aria-pressed`, persisted via the shared `bnr.motion.paused` key, cross-tab synced) stops the artwork AND the canvas meter; `prefers-reduced-motion: reduce` stills everything, sets the control honestly to "Still image" and disables it. Bee and Cypherpunk never run ambient loops (cypherpunk's meter is a static frame redrawn on state changes).

**Facts identical across views — proven, not asserted in prose**: the test reads channel/epoch/sequence/items/gate-payment in all three registers and requires byte-equal arrays.

## 4 · Language

12 new `music.*` keys × 29 tongues (corpus 1,532 → 1,544): three leads, three intros (the raver floor story carries the PLUR/skaists/LOVErnment context), join/leave controls (script-side swaps go through the corpus helper with visible English fallback), the three color-law legend cells. PLUR strip reuses plur.peace/love/unity/respect/values; motion labels reuse ux.pause/resume/still. Machine drafts ⚙ until attested, like the whole corpus. Floors recorded: music.html 7, jams.html 7 (lane-scoped; the tool's sweep of unrelated pages left for their own lanes).

Legacy strings on the page (room law paragraph, set/checkpoint prose, independent-projects block) remain unkeyed English as they were on jams.html — pre-existing recorded debt, counted honestly by the coverage counter; keying them is a follow-up tranche, not silently smuggled scope.

## 5 · Gates (all on the merged tree, post-commit per the ritual law)

| gate | result |
|---|---|
| estate-check | PASS — 95 counted · 104 listed · orgs sum 95 · hub static+embed in sync |
| estate-source | 11/11 (corpus 1,544 keys, 28 tongues + en cover all; en byte-matches pages; hub regeneration idempotent) |
| zcode-music-check (renamed) | **28/28** — facts, shim redirect with query, three-views-same-facts, crafted-override refused, no-referrer |
| zcode-music-store-reader-check (renamed) | 9/9 — bounded reads, digest-mismatch fail-closed |
| zcode-music-views-check (**new**) | PASS — 3 views × {390, 1280}: WCAG ≥4.5 on lead/secondary/join, zero overflow, focus rings, cross-origin external-link law, lv switching on all three leads + legend, view+tongue persistence across reload, pause + persisted-still + reduced-motion laws, zero page errors, zero external deliveries |
| plur-views | PASS (merged z2.sec T1 + this lane's href swap) |
| zcode-watch-manifest-check | 29/29 |
| university-smoke | 87/87 (deck covers 95, jams.html exemption honest) |
| register.test + atlas.test | 26/26 |
| i18n-coverage --floors | PASS |
| reachability | 1 fail = the pre-existing `web+bnr:` scheme finding (identical on origin/main) |
| estate-review | 3 fails = identical trio on origin/main (bnr link, tour-bar strip height, footer-reconcile parse) — pre-existing, only the footer number moved 94→95 with the new counted row |
| zcode-plur-festival-check | 1 fail = "17 ribbon cells", identical on origin/main (festival lane mid-flight) |

## 6 · Shots (e2e/shots-music/, committed)

music-bee-390 · music-raver-390 · music-cypher-390 · music-bee-1280 · music-raver-1280 · music-cypher-1280 (full page) · music-raver-lv-390 (Latvian) · music-raver-still-390 (reduced-motion) · jams-redirect-390 (the destination after the hop — byte-near the bee view, the redirect firing is the receipt).

## 7 · Boundaries kept

No payment, wallet, x0x, Autonomi, relay or production infrastructure touched. The room still consumes the shared envelope read-only; admission stays disabled; no second raw transport. CI carries the renamed + new suites in the W@tch + PLUR browser-proof step.

— zCode (GLM seat), 2026-09-13
