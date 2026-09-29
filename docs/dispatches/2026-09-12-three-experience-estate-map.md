# Three-experience estate map — source inventory, 2026-09-12

The shared switch is wired into the source of every registered page. Complete New bee and Raver experiences are not. This dispatch separates the shared shell, authored composition, prose variants and the work still needed.

Scope: read-only inspection of estate.json, all 102 registered HTML files, shared register/tour/language code and the home stylesheet in the integration worktree. Base commit at inspection: `4aeffdd0` (nine-page review base). Other agents are editing the eight remodel pages and shared design/language code in parallel; this document is a source snapshot, not a deployment or final acceptance receipt. No browser walk, production request, clinical review or native-speaker review was performed in this lane.

## Denominator and evidence standard

[estate.json](../../estate.json) contains **102 registered rows: 93 counted surfaces plus 9 nested fleet pages** marked `counted:false`. The orbit-v2 fork is counted but explicitly `presented:false`. Domain holdings and other repositories are not additional reviewed pages here; WELLness work in another repo is not silently counted as complete.

All 102 HTML files reference `tour.js`; [surfaces/tour.js:145](../../surfaces/tour.js#L145) loads language and register riders. That establishes the source inclusion path, not successful rendering or authored experiences. [surfaces/register.js:1](../../surfaces/register.js#L1) says page-specific presentations are separate; its `mount` route mapping assigns unadapted pages `data-bee-theme=pending` and preserves selected artwork routes. See [surfaces/register.js:252](../../surfaces/register.js#L252). A control, light background, view-specific paragraph or media tag is insufficient evidence of an independently composed arrival.

The categories below are editorial source findings, **not a percentage-complete score**. In particular, the six existing layouts still need review against the founder's higher Raver bar: original graphics, empathic visual communication, and purposeful interaction. An instrument with purple trim does not pass that bar automatically.

| Source finding | Counted surfaces | Additional nested pages | Meaning |
| --- | ---: | ---: | --- |
| Eight remodel pages | 8 | 0 | Separate first-bee/first-raver compositions, page-owned stages and choices are present in the review base; current release work is separate. |
| Existing authored layouts | 6 | 0 | Layout/order/disclosure changes beyond labels; not a blanket design-quality acceptance. |
| Partial treatment | 13 | 0 | Per-view prose and/or local styling; requires stronger New bee/Raver composition. |
| Shared light door adapter | 8 | 0 | Calm palette/readability from register; little page-owned view content. |
| Pending page composition | 56 | 0 | Tour shell found; no page-owned view composition found in this HTML source scan. |
| Preserve artwork/instrument core | 2 | 9 | Orbit pair and nested fleet pages; build surrounding experiences without rewriting semantic geometry or evidence. |
| Total | 93 | 9 | 102 registered rows. |

## Per-surface source map

`Keys` counts literal `data-i18n=` occurrences in the HTML, including template strings. It is an integration clue, not sentence coverage, actual translation coverage or attestation. The evidence link for a pending page points to its tour inclusion; it proves only the shell route. Pages with external or dynamically generated content still need runtime inspection before final classification.

### Eight remodel pages under current integration

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/onboarding/index.html:266](../../surfaces/onboarding/index.html#L266) | Separate New bee arrival (linked) and Raver arrival at line 277; page stages at 318, 327, 338. Structure present; current root integration owns quality, translations and verification. | 18 |
| [surfaces/review.html:215](../../surfaces/review.html#L215) | Separate New bee arrival (linked) and Raver arrival at line 225; page stages at 259, 270, 315. Structure present; current root integration owns quality, translations and verification. | 38 |
| [surfaces/bsymposium.html:172](../../surfaces/bsymposium.html#L172) | Separate New bee arrival (linked) and Raver arrival at line 182; page stages at 226, 236, 255. Structure present; current root integration owns quality, translations and verification. | 33 |
| [surfaces/bearth.html:194](../../surfaces/bearth.html#L194) | Separate New bee arrival (linked) and Raver arrival at line 204; page stages at 241, 251, 267. Structure present; current root integration owns quality, translations and verification. | 30 |
| [surfaces/bfood.html:229](../../surfaces/bfood.html#L229) | Separate New bee arrival (linked) and Raver arrival at line 239; page stages at 272, 282, 303, 335. Structure present; current root integration owns quality, translations and verification. | 50 |
| [surfaces/bigen.html:183](../../surfaces/bigen.html#L183) | Separate New bee arrival (linked) and Raver arrival at line 194; page stages at 235, 245, 268. Structure present; current root integration owns quality, translations and verification. | 46 |
| [surfaces/blongevity.html:215](../../surfaces/blongevity.html#L215) | Separate New bee arrival (linked) and Raver arrival at line 225; page stages at 259, 269, 285. Structure present; current root integration owns quality, translations and verification. | 34 |
| [surfaces/university/index.html:195](../../surfaces/university/index.html#L195) | Separate New bee arrival (linked) and Raver arrival at line 205; page stages at 246, 255, 286. Structure present; current root integration owns quality, translations and verification. | 38 |

### Existing authored layouts and disclosure behavior

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/blight/gallery.html:30](../../surfaces/blight/gallery.html#L30) | New bee single artwork; Raver collection rail; Cypherpunk record column. Same read controls and retained artwork; no new action claimed. | 22 |
| [surfaces/blight/studio-music.html:17](../../surfaces/blight/studio-music.html#L17) | Distinct grid/controls density; instrument settings in disclosures; sequencer and playback remain shared. | 31 |
| [surfaces/forge/room.html:105](../../surfaces/forge/room.html#L105) | Light jam canvas; vivid Raver instrument; tech disclosures default differently by view. Shared scene and knobs, not separate engines. | 22 |
| [surfaces/index.html:30](../../surfaces/index.html#L30) | Art/music/people cards; a separate Raver artwork stage and source disclosures. See atlas.css:19 and :48. | 504 |
| [surfaces/buzz-directory.html:163](../../surfaces/buzz-directory.html#L163) | New bee choose cards; Raver two-column community arrangement; Cypherpunk connection records. Existing SVG icons are not a complete emotional art direction. | 49 |
| [surfaces/profile.html:144](../../surfaces/profile.html#L144) | New bee reading column; Raver portrait/card grid; Cypherpunk record layout. Portrait treatment is still mostly glyphs, not the requested full visual storytelling. | 10 |

### Partial treatment: prose, light styling, or disclosure

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/doors/bnature-social.html:150](../../surfaces/doors/bnature-social.html#L150) | Choose cards and catalogue memory; New bee cream; Raver restyles the same arrival and opens the catalogue. Still partial. | 34 |
| [surfaces/stack.html:101](../../surfaces/stack.html#L101) | Intro, license and probe explanations change prose; architecture instrument remains shared. | 76 |
| [surfaces/wallet.html:184](../../surfaces/wallet.html#L184) | Intro and compute-voucher copy change; wallet workflow remains shared. | 35 |
| [surfaces/bnames.html:97](../../surfaces/bnames.html#L97) | Intro and availability explanation change; name desk remains shared. | 0 |
| [surfaces/bset.html:58](../../surfaces/bset.html#L58) | Intro changes; the playlist remains one composition. | 1 |
| [surfaces/festival/index.html:91](../../surfaces/festival/index.html#L91) | Many per-view paragraphs around the same floor demos; paragraph variants do not establish different entry journeys. | 18 |
| [surfaces/kandi.html:134](../../surfaces/kandi.html#L134) | Readable light palette and detailed per-view gift copy; Raver adds glow. Same large composer/arms structure; no full emotional receive composition. | 10 |
| [surfaces/royalguard.html:61](../../surfaces/royalguard.html#L61) | Two prose blocks change; dashboard remains shared. | 0 |
| [surfaces/attest.html:45](../../surfaces/attest.html#L45) | Intro changes; attestation form remains shared. | 1 |
| [surfaces/blanguage.html:173](../../surfaces/blanguage.html#L173) | One account of the word skaists changes by view; the wider language page is shared. | 12 |
| [surfaces/buzz-studio.html:106](../../surfaces/buzz-studio.html#L106) | Intro changes; the collaborative paint instrument remains shared. | 15 |
| [surfaces/bqueenbee-live.html:201](../../surfaces/bqueenbee-live.html#L201) | Generated reply links use per-view markup; the page is a local knowledge-base agent, not an authored Raver room. | 6 |
| [surfaces/bantfarm.html:67](../../surfaces/bantfarm.html#L67) | Several per-view explanations; treasury/node dashboard remains shared. | 7 |

### Shared light door adapters

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/doors/beehivenature.html:179](../../surfaces/doors/beehivenature.html#L179) | Shared door adapter in register.js; no local view-specific arrival found. | 38 |
| [surfaces/doors/plur.html:152](../../surfaces/doors/plur.html#L152) | Shared door adapter in register.js; no local view-specific arrival found. | 12 |
| [surfaces/doors/skaists.html:159](../../surfaces/doors/skaists.html#L159) | Shared door adapter in register.js; no local view-specific arrival found. | 16 |
| [surfaces/doors/bnature-bio.html:160](../../surfaces/doors/bnature-bio.html#L160) | Shared door adapter in register.js; no local view-specific arrival found. | 18 |
| [surfaces/doors/beehivebiomass.html:152](../../surfaces/doors/beehivebiomass.html#L152) | Shared door adapter in register.js; no local view-specific arrival found. | 7 |
| [surfaces/doors/skaists-buzz.html:91](../../surfaces/doors/skaists-buzz.html#L91) | Shared relay adapter in register.js; no local view-specific arrival found. | 0 |
| [surfaces/doors/beehivenature-buzz.html:86](../../surfaces/doors/beehivenature-buzz.html#L86) | Shared relay adapter in register.js; no local view-specific arrival found. | 0 |
| [surfaces/doors/index.html:143](../../surfaces/doors/index.html#L143) | Shared door adapter in register.js; no local view-specific arrival found. | 6 |

### Shell mounted; page-owned New bee and Raver composition not found

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/b4b.html:133](../../surfaces/b4b.html#L133) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 5 |
| [surfaces/biq.html:147](../../surfaces/biq.html#L147) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 7 |
| [surfaces/blight/bnri-gallery.html:100](../../surfaces/blight/bnri-gallery.html#L100) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/c1-aid.html:339](../../surfaces/blight/c1-aid.html#L339) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 4 |
| [surfaces/blight/compare.html:250](../../surfaces/blight/compare.html#L250) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 1 |
| [surfaces/blight/index.html:160](../../surfaces/blight/index.html#L160) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 6 |
| [surfaces/blight/inscription-explorer.html:531](../../surfaces/blight/inscription-explorer.html#L531) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 1 |
| [surfaces/blight/midi-organ.html:173](../../surfaces/blight/midi-organ.html#L173) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/museum.html:569](../../surfaces/blight/museum.html#L569) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 10 |
| [surfaces/blight/pixelrefiner.html:4496](../../surfaces/blight/pixelrefiner.html#L4496) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/qrtree.html:1065](../../surfaces/blight/qrtree.html#L1065) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/qrroses.html:1205](../../surfaces/blight/qrroses.html#L1205) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 1 |
| [surfaces/blight/qrroses-smil.html:904](../../surfaces/blight/qrroses-smil.html#L904) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/profile.html:881](../../surfaces/blight/profile.html#L881) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/local-agent/index.html:408](../../surfaces/local-agent/index.html#L408) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/record.html:69](../../surfaces/record.html#L69) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/midi.html:1344](../../surfaces/blight/midi.html#L1344) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/midiroom.html:784](../../surfaces/blight/midiroom.html#L784) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/midivault.html:427](../../surfaces/blight/midivault.html#L427) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/vaulta-reader.html:187](../../surfaces/blight/vaulta-reader.html#L187) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/workbench.html:1221](../../surfaces/blight/workbench.html#L1221) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/dock.html:166](../../surfaces/dock.html#L166) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/fleet-hosted/index.html:159](../../surfaces/fleet-hosted/index.html#L159) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/hardware/build.html:157](../../surfaces/hardware/build.html#L157) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 3 |
| [surfaces/hardware/index.html:109](../../surfaces/hardware/index.html#L109) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 10 |
| [surfaces/hardware/security.html:76](../../surfaces/hardware/security.html#L76) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 5 |
| [surfaces/listening.html:112](../../surfaces/listening.html#L112) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 5 |
| [surfaces/onboarding/receive.html:1741](../../surfaces/onboarding/receive.html#L1741) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/recover.html:5133](../../surfaces/recover.html#L5133) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/demo.html:1820](../../surfaces/blight/demo.html#L1820) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 1 |
| [surfaces/blight/farmers.html:263](../../surfaces/blight/farmers.html#L263) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 1 |
| [surfaces/hardware/lab.html:95](../../surfaces/hardware/lab.html#L95) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 6 |
| [surfaces/keys/addresses.html:108](../../surfaces/keys/addresses.html#L108) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 3 |
| [surfaces/blight/market.html:250](../../surfaces/blight/market.html#L250) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/plur.html:863](../../surfaces/plur.html#L863) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/studio-gate.html:703](../../surfaces/blight/studio-gate.html#L703) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 4 |
| [surfaces/forge/hexfield.html:166](../../surfaces/forge/hexfield.html#L166) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/forge/index.html:90](../../surfaces/forge/index.html#L90) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/dao-dashboard/index.html:760](../../surfaces/dao-dashboard/index.html#L760) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 8 |
| [surfaces/devroom.html:329](../../surfaces/devroom.html#L329) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/hearth.html:180](../../surfaces/blight/hearth.html#L180) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/pulse.html:84](../../surfaces/blight/pulse.html#L84) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/btranslated.html:141](../../surfaces/btranslated.html#L141) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 4 |
| [surfaces/forge/huddle.html:90](../../surfaces/forge/huddle.html#L90) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/blight/coop.html:166](../../surfaces/blight/coop.html#L166) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/bfactory.html:159](../../surfaces/bfactory.html#L159) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 6 |
| [surfaces/bmeshasi.html:371](../../surfaces/bmeshasi.html#L371) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/design-system.html:407](../../surfaces/design-system.html#L407) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 25 |
| [surfaces/museum.html:337](../../surfaces/museum.html#L337) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 43 |
| [surfaces/fieldnotes.html:131](../../surfaces/fieldnotes.html#L131) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 70 |
| [surfaces/or-board.html:291](../../surfaces/or-board.html#L291) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/ant-door.html:103](../../surfaces/ant-door.html#L103) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/comb.html:567](../../surfaces/comb.html#L567) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/vending.html:795](../../surfaces/vending.html#L795) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/privacy-lens.html:600](../../surfaces/privacy-lens.html#L600) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |
| [surfaces/watch.html:462](../../surfaces/watch.html#L462) | Tour shell present; no local view-specific composition found. Authored New bee and Raver arrivals pending. | 0 |

### Preserved artworks and nested fleet instruments

| Surface and evidence | Finding | Keys |
| --- | --- | ---: |
| [surfaces/forge/orbit.html:150](../../surfaces/forge/orbit.html#L150) | Pinned orbit renderer; preserve geometry and build any new arrival outside its core. | 0 |
| [surfaces/fleet-hosted/gallery/resonance.html:289](../../surfaces/fleet-hosted/gallery/resonance.html#L289) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/gallery/acid-cascade.html:243](../../surfaces/fleet-hosted/gallery/acid-cascade.html#L243) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/gallery/indigo-index.html:282](../../surfaces/fleet-hosted/gallery/indigo-index.html#L282) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/blend-lab.html:302](../../surfaces/fleet-hosted/lab/blend-lab.html#L302) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/edible-tracker.html:267](../../surfaces/fleet-hosted/lab/edible-tracker.html#L267) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/flower-lab.html:187](../../surfaces/fleet-hosted/lab/flower-lab.html#L187) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/intake-tracker.html:194](../../surfaces/fleet-hosted/lab/intake-tracker.html#L194) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/spliff-lab.html:248](../../surfaces/fleet-hosted/lab/spliff-lab.html#L248) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/fleet-hosted/lab/bnr-dashboard.html:212](../../surfaces/fleet-hosted/lab/bnr-dashboard.html#L212) | Nested fleet page; counted:false. register preserves this page art/instrument palette; authored arrival still pending. | 0 |
| [surfaces/forge/orbit-v2.html:150](../../surfaces/forge/orbit-v2.html#L150) | Tinkering fork; counted but presented:false. Do not add public navigation as part of UI restyling. | 0 |

## Translation work that remains

**48 of 102 registered HTML files (39 of the 93 counted surfaces) have zero literal data-i18n hooks in their page source.** The shared toggle may still be translated, and external scripts can generate keyed content. This is therefore a prioritization signal, not a claim that every word on those pages is untranslatable. Conversely, one keyed title does not make the body translated.

[surfaces/lang.js:111](../../surfaces/lang.js#L111) translates keyed elements and falls back to English when a rendering is absent. [surfaces/lang.js:131](../../surfaces/lang.js#L131) explicitly distinguishes visible-text coverage from the old misleading keys-present count. The runtime also supplies dynamic labels through BNRLanguage.text. Preserve that honest measurement and use it for all three view arrivals plus the first completed interaction, including empty, loading, failed and saved states. A hidden expert panel is not evidence that the visible New bee copy is localized.

For each batch, author concise English New bee and Raver text first, keep brand/identity names stable, and key dynamic statuses, input labels and accessible names together. Translate into the existing priority order (Russian, Latvian, Thai, Scottish Gaelic, Tatar, Ukrainian, then the remaining configured languages). Test long strings, script/font support, narrow screens and RTL where applicable. Machine-drafted corpus entries remain unreviewed until a human language receipt exists; the 26-language picker is not that receipt.

## Next batches by the journey a person takes

These are bounded proposed batches, not newly claimed assignments. Every batch pairs an authored New bee arrival, an authored Raver composition and the same preserved functional core; evidence is attached to the actual pages changed.

1. **Make, enjoy and gift.** Continue from Home → gallery/music → kandi → PLUR/festival and the maker. Kandi, PLUR, festival, bset, listening, the two museums, MIDI organ/player/room/vault, studio-gate and inscription explorer are the nearest exposed gaps. New bee should encounter one ready-to-use creative action; Raver should feel the artwork, hands, rhythm and maker credit before machinery. Keep playback and unsaved creations through a view/language switch. This batch gives the founder's creative-community promise an end-to-end path instead of more isolated landings.
2. **People and cooperation.** Social door → Buzz directory → optional profile/name → actual room. Existing directory/profile/forge-room layouts are a base, but bnature-social, buzz-studio, forge-huddle, bnames, bLIGHT profile, local-agent, bQueenBee, hearth, pulse, watch and privacy-lens need page-owned presentation and accurate availability states. Purple denotes humans, teal denotes AI, and these labels must remain readable without relying only on color. Show where conversation really occurs and whether a room is browser-local, externally hosted or a held capability.
3. **Understand body, food and land.** Finish the eight reviewed remodels as a connected walk, then adapt the biology door and the nine nested fleet instruments. New bee gets a short explanation and an actionable choice; Raver gets page-specific living-system imagery, with quantities, uncertainty and evidence still readable. Preserve blank-as-unknown and the distinction between an illustration and a measurement. Do not turn an emotional plant-medicine narrative into an unsupported health claim.
4. **Enter from any front door.** Apply the same composed arrival standard to the eight plain door adapters, including relay doors. A general visitor should choose by intention before encountering domain/repository inventories; a Raver should see the relevant artwork and community context. Reuse real destinations, language choice and navigation state; do not copy three separate page engines.
5. **Build and create at depth.** Forge index/hexfield/orbit wrappers, pixelrefiner, QR tree/roses, bLIGHT workbench/demo/compare/index/bnri-gallery/c1-aid, comb, hardware index/build/lab/security and the fleet index need simple entry choices around their existing instruments. Surface one reversible first action; preserve render fidelity, pinned source art and technical controls in Cypherpunk. For pure artworks, a composed gallery wrapper may be appropriate while the artwork remains unchanged.
6. **Trust, identity and stewardship.** Wallet, recover, keys/addresses, beam receive, royalty/DAO/treasury pages, b4b, dock, stack, vaulta-reader, attest/blanguage/btranslated/biq, devroom, fieldnotes, record, OR board, Autonomi door, vending, biomass factory/mesh/coop/farm/market and design-system remain part of the estate scope. Separate read-only, local-only, simulated and signing actions in plain language before decorative work. Do not use a richer skin to imply a transaction, backup, agent capability or market exists. Cypherpunk retains the inspectable record.

The first three batches produce complete visitor walks and should take priority over unrelated cosmetic expansion. A single release should name its exact surfaces and languages tested; this inventory remains open for the rest.

## Definition of completion for one authored page

- New bee has a deliberately composed light arrival with a clear title, short copy, comfortable controls, a primary choice and optional detail; it can be understood without learning estate jargon.
- Raver communicates the page's actual meaning through credited imagery/composition and empathic copy. Original BNR bloom geometry and the human/AI/biomass color meanings are retained; motion is optional, pauseable and respects reduced-motion.
- The first successful task is tested in both views. Inputs, playback, selection, saves, progress and disclosure choices survive switches as appropriate. Cypherpunk's existing instrument and evidence remain accessible.
- The translated first screen, next action, error and completion state are measured; native review is recorded separately from machine drafts. Narrow viewport, keyboard focus, contrast and text expansion are reviewed.
- The receipt says which source/commit was checked, what was visually and functionally verified, and what remains. It does not equate a mounted toggle with a finished experience.

## What this inventory did not do

No code/corpus changes, commits, merge, production edits, remote review, external-repository inventory, field observation or health-content verification. Only this dispatch was authored. The upstream backend priority check belongs to the root's coordination lane; this bounded source inventory did not start a backend feature or contact any upstream project.
