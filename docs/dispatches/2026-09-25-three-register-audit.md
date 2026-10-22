# THREE-REGISTER AUDIT — every surface vs the skaists design system blueprint

date 2026-09-25 · seat zCode (GLM) · scope: all 115 surface .html files in the tree — 102 estate rows, every row verified present on disk; 13 unregistered tree files named in the table.

blueprint canon: [docs/dispatches/2026-09-25-skaists-design-system-blueprint.md](2026-09-25-skaists-design-system-blueprint.md) — captured verbatim this date from the founder shared claude.ai artifact (Design System, anyone-with-the-link): the casing law, the three registers, colour law, type law, honest-states law, tree and signs, translation, motion, and the full token sheet.

instrument: scripts/register-audit.mjs (static, read-only, rerunnable) + one live browser probe (e2e/shots-three-register-audit/ — wallet.html at 390px, all three registers screenshot).

## THE HEADLINE

**No surface on the estate implements the blueprint three separate UX/UIs yet.** The estate has the 2026-08-28 toggle canon — a three-pill RegisterToggle that travels estate-wide and flips body[data-reg] — and 15 surfaces write real three-register prose. But the blueprint core upgrade, *a register changes voice, density AND DRESS* (bee = paper ground / serif / soft corners · raver = black / you-magenta / display / pills · cypherpunk = black / mono / ai-teal / radius-sm), is implemented by **zero of 115 surfaces**: not one register-scoped style rule exists anywhere. The live probe proves it — bee, raver and cypherpunk on wallet.html render pixel-identical.

| verdict (estate rows) | surfaces | what it means |
|---|---|---|
| THREE-UX | 15 | real data-reg prose in all three registers; toggle present; dress still shared |
| TOGGLE-ONLY | 78 | toggle inherited via tour.js/rails-badge; zero register-specific UX on the page |
| NO-TOGGLE | 9 | no tour.js/register.js/rails-badge include — the toggle never mounts |
| (tree-only, unregistered) | 13 | not in estate.json |

## SYSTEM-LEVEL GAPS (stated once, not 115 times)

1. **Dress law unimplemented estate-wide** — 0 register-scoped CSS rules across 115 surfaces. The toggle is real; the three UX/UIs are not. This is the adoption work.
2. **register.js itself is pre-blueprint** — prose/density switcher with no dress; its own chrome drifts (active pill gold #FFD700, cyan hover — the blueprint gives actions ai teal in cypherpunk and reserves honey for b only), and the artifact not-synced section already rules the repo new-bee colors superseded (paper #fbf7f0 / ink #0c1412, ruled 2026-09-19).
3. **0 surfaces link docs/tokens.css** — the entity sheet the blueprint carries whole is linked by nothing; every surface hand-rolls its palette.
4. **guard-is-never-red breached on the fleet** — #e74c3c error-red on all 9 fleet/* surfaces and 3 fleet-hosted mirrors (the blueprint bans an error-red token; guard is lilac).
5. **casing law breached on ~40 surfaces** — text-transform is banned (founder casing is payload; no style sheet may alter it); ~40 files still carry it.
6. **gold as accent, not b** — #FFD700/#e8b54b as door/navigation/accent on ~45 surfaces (doors/index ×24, doors/plur ×22, design-system ×28, wallet ×12 …) vs the law that honey touches only BChip.
7. **9 estate surfaces never mount the toggle** — ant-door, doors/beehivenature-buzz, doors/skaists-buzz, local-agent/index, plur, privacy-lens, profile, vending, watch: the register choice cannot travel there.
8. **13 tree files unregistered** — the estate-check/atlas ritual gap: ant-door-cors.html, essays.html, fae.html, root index.html, surfaces/fleet/* ×9.

## PER-SURFACE VERDICTS

columns: bee/raver/cy = data-reg blocks per register · dress = register-scoped style rules in the page (none anywhere) · flags = blueprint violations found in the file (file-level drift markers, not per-line citations — several pages use gold/red inside their own legacy palette).

| surface | verdict | bee/raver/cy | dress | blueprint flags | registry |
|---|---|---|---|---|---|
| surfaces/attest.html | THREE-UX | 1/1/1 | — | gold | estate |
| surfaces/bantfarm.html | THREE-UX | 7/7/10 | — | gold | estate |
| surfaces/bearth.html | THREE-UX | 1/1/1 | — | gold | estate |
| surfaces/bfood.html | THREE-UX | 1/1/1 | — | gold | estate |
| surfaces/blanguage.html | THREE-UX | 1/1/1 | — | gold | estate |
| surfaces/bnames.html | THREE-UX | 2/2/2 | — | gold · shadow | estate |
| surfaces/bqueenbee-live.html | THREE-UX | 1/1/2 | — | gold · shadow | estate |
| surfaces/bset.html | THREE-UX | 1/1/1 | — | gold · shadow | estate |
| surfaces/bsymposium.html | THREE-UX | 1/1/1 | — | gold | estate |
| surfaces/buzz-studio.html | THREE-UX | 1/1/1 | — | text-transform · gold · shadow | estate |
| surfaces/festival/index.html | THREE-UX | 10/10/10 | — | — | estate |
| surfaces/kandi.html | THREE-UX | 2/2/2 | — | text-transform | estate |
| surfaces/royalguard.html | THREE-UX | 2/2/2 | — | gold | estate |
| surfaces/stack.html | THREE-UX | 2/3/4 | — | text-transform · gold | estate |
| surfaces/wallet.html | THREE-UX | 2/2/2 | — | text-transform · gold · shadow | estate |
| ant-door-cors.html | NO-TOGGLE | 0/0/0 | — | — | unreg |
| essays.html | NO-TOGGLE | 0/0/0 | — | — | unreg |
| fae.html | NO-TOGGLE | 0/0/0 | — | — | unreg |
| index.html | NO-TOGGLE | 0/0/0 | — | — | unreg |
| surfaces/ant-door.html | NO-TOGGLE | 0/0/0 | — | — | estate |
| surfaces/b4b.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/bfactory.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/bigen.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/biq.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/blight/bnri-gallery.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/c1-aid.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/compare.html | TOGGLE-ONLY | 0/0/0 | — | shadow | estate |
| surfaces/blight/coop.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/demo.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/blight/farmers.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/blight/gallery.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/blight/hearth.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/blight/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/inscription-explorer.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/blight/market.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/midi-organ.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/blight/midi.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/blight/midiroom.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/blight/midivault.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/museum.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/pixelrefiner.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/blight/profile.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/pulse.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/blight/qrroses-smil.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/qrroses.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/blight/qrtree.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/blight/studio-gate.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/studio-music.html | TOGGLE-ONLY | 0/0/0 | — | shadow | estate |
| surfaces/blight/vaulta-reader.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blight/workbench.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/blongevity.html | TOGGLE-ONLY | 0/0/0 | — | gold · shadow | estate |
| surfaces/bmeshasi.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/btranslated.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/buzz-directory.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/comb.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/dao-dashboard/index.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/design-system.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/devroom.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/dock.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/beehivebiomass.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/beehivenature-buzz.html | NO-TOGGLE | 0/0/0 | — | text-transform · shadow | estate |
| surfaces/doors/beehivenature.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/bnature-bio.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/bnature-social.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/plur.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/doors/skaists-buzz.html | NO-TOGGLE | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/doors/skaists.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/fieldnotes.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/fleet-hosted/gallery/acid-cascade.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red · gold | estate |
| surfaces/fleet-hosted/gallery/indigo-index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red · gold | estate |
| surfaces/fleet-hosted/gallery/resonance.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red · gold | estate |
| surfaces/fleet-hosted/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/fleet-hosted/lab/blend-lab.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red | estate |
| surfaces/fleet-hosted/lab/bnr-dashboard.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red | estate |
| surfaces/fleet-hosted/lab/edible-tracker.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red · gold | estate |
| surfaces/fleet-hosted/lab/flower-lab.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red | estate |
| surfaces/fleet-hosted/lab/intake-tracker.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red | estate |
| surfaces/fleet-hosted/lab/spliff-lab.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · error-red | estate |
| surfaces/fleet/acid-cascade.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red · gold | unreg |
| surfaces/fleet/blend-lab.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red | unreg |
| surfaces/fleet/bnr-dashboard.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red | unreg |
| surfaces/fleet/edible-tracker.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red · gold | unreg |
| surfaces/fleet/flower-lab.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red | unreg |
| surfaces/fleet/indigo-index.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red · gold | unreg |
| surfaces/fleet/intake-tracker.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red | unreg |
| surfaces/fleet/resonance.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red · gold | unreg |
| surfaces/fleet/spliff-lab.html | NO-TOGGLE | 0/0/0 | — | text-transform · error-red | unreg |
| surfaces/forge/hexfield.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/forge/huddle.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/forge/index.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/forge/orbit-v2.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/forge/orbit.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/forge/room.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/hardware/build.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/hardware/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/hardware/lab.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/hardware/security.html | TOGGLE-ONLY | 0/0/0 | — | — | estate |
| surfaces/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/keys/addresses.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/listening.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/local-agent/index.html | NO-TOGGLE | 0/0/0 | — | text-transform · shadow | estate |
| surfaces/museum.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold | estate |
| surfaces/onboarding/index.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/onboarding/receive.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/or-board.html | TOGGLE-ONLY | 0/0/0 | — | text-transform · shadow | estate |
| surfaces/plur.html | NO-TOGGLE | 0/0/0 | — | text-transform · gold · shadow | estate |
| surfaces/privacy-lens.html | NO-TOGGLE | 0/0/0 | — | text-transform · shadow | estate |
| surfaces/profile.html | NO-TOGGLE | 0/0/0 | — | text-transform · gold | estate |
| surfaces/record.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/recover.html | TOGGLE-ONLY | 0/0/0 | — | text-transform | estate |
| surfaces/review.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/university/index.html | TOGGLE-ONLY | 0/0/0 | — | gold | estate |
| surfaces/vending.html | NO-TOGGLE | 0/0/0 | — | text-transform · shadow | estate |
| surfaces/watch.html | NO-TOGGLE | 0/0/0 | — | text-transform · shadow | estate |
## METHOD + BOUNDARY

- static pass per file: toggle-loader grep (tour.js / register.js / rails-badge.js), data-reg counts per register, register-scoped style rules inside style blocks, and four high-signal blueprint flags (text-transform, error-red hexes, gold hexes, box-shadow — flagged for the edges-not-shadows law; glow-sovereign re-check is dress-aware work for later).
- the check that matters — three separate UX/UIs — is the dress column: all zeros. The 15 THREE-UX rows are prose-complete, not dress-complete.
- live probe: wallet.html served locally at 390px, register pills clicked (body[data-reg] verified flipping bee→raver→cypherpunk), screenshots identical. Receipts: e2e/shots-three-register-audit/wallet-{bee,raver,cypherpunk}-390.png
- NOT done here: applying the blueprint. Canon capture + this audit are the lane whole move; adoption (dress tokens into register.js + per-surface markup) is the next lane and owes its own plan.
