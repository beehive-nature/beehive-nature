# Five first clicks, three complete presentations

Founder request: fully review Home, Gallery, Music studio, Buzz directory and
Profile and give New bee, Raver and Cypherpunk distinct UX/UI experiences.
New bee starts with art, music and people. Profile remains optional depth.
The matriarch's comfort and artistic judgment remain the design standard;
the three views retain the same facts, destinations and capabilities.

## What changes on each page

| Page / source | New bee | Raver | Cypherpunk |
| --- | --- | --- | --- |
| Home — `scripts/build-atlas.mjs`, `surfaces/atlas.css`, `surfaces/atlas.js` | Approved three first choices; human-readable topics; catalogue and evidence optional | Art and cultural invitations lead into the full catalogue | One search form moves beside the technical introduction; canonical family identifiers and evidence lead |
| Gallery — `surfaces/blight/gallery.html` | One artwork, a legible caption and large Previous / Start tour / Next controls; collection chooser opens as a dialog | Large artwork beside a visible collection rail | Artwork, collection index and source record in three panes; record opens by default |
| Music — `surfaces/blight/studio-music.html` | One composition surface with Play / Stop / Tempo; saving visible and advanced panels optional | Performance transport and variation/sound controls beside the note grid | Grid beside expanded sound, import, sharing and score-JSON panels |
| Buzz — `surfaces/buzz-directory.html` | One readable canvas; original hive actions and cautions visible; connection and additional-community depth expandable | People/agents follow our hives, ahead of the broader directory | Relay/connection details and the complete published roster open by default |
| Profile — `surfaces/profile.html` | Public people/name records, explicit Person / Machine agent labels, expandable histories | Wider family cards and expanded histories | Dense record arrangement with the original name history and provenance exposed |

Five ordinary HTML links connect these pages without an account requirement.
They survive a failed enhancement script. The shared view bar still comes
from `register.js` through `tour.js`; there is no second preference store.
Gallery and Music opt into complete authored themes, including controls and
error colors. Profile/Buzz extend the shared reading theme. Responsive rules
stack tool panes; controls have visible keyboard focus and at least 44px
height. The note grid retains a readable horizontal scroll area on phones.
These are source properties, not a claim of rendered device acceptance.

## Functional repairs found during review

- Music's 128 note cells are native buttons with one keyboard entry and
  arrow navigation. Clear and variation have Undo. Tempo and imported/share
  data are validated before application. JSON is a score, not an audio file
  or an inscription transaction.
- One audio transport survives view changes. Stop cancels scheduled notes
  and pending audio startup; an old resume cannot start a second loop.
- Song links carry complete UTF-8 composition data and imported metadata in
  the URL fragment. Legacy query links still load. The old 1,800-character
  truncation is gone; excessive size reports a download alternative.
  Clipboard denial reveals the complete link for manual copying.
- Gallery starts paused. Empty navigation is safe; failed/partial chain reads
  remain distinguishable from completed empty reads. Retry, visible dialog
  Close and native collection/piece buttons replace misleading or fragile
  controls. The market placeholder now states that it is not connected.
- Ethereum collections use Ethereum hosts for the initial balance read.
  Batched JSON-RPC results follow request IDs rather than response order.
  Generation tickets prevent a superseded collection from repainting.
  Browser history restoration retries an interrupted read and restores the
  viewer/tour state. Terminal failures no longer leave Holder at Loading.
- Home keeps one search form and remembers manual catalogue/evidence choices.
  View changes preserve composition, gallery selection and search input.
  Focus returns to the visible disclosure summary if its content closes.
- Profile retains both conflicting Queen dates and explicitly names the
  unresolved 27/29 August discrepancy. It does not invent a corrected date.
  Directory statuses are labeled published records, not live availability.

The collection contract addresses, ABI constants, original record words,
curation order and returned artwork remain the gallery's source. No chain
transactions, wallet signatures, mesh traffic or production-box edits were
performed. Profile is a public dynasty record, not an editable personal
account, presence signal or working DM service. Readiness, expired invites,
and human/agent distinctions remain on the original records.

## Coordination and translation

Canonical lane: issue #10, five-page claim comment 5567366213. Implementation
lives in `wt-astra-frontdoor` on `codex/five-door-three-views-2026-09-07`.
The branch includes the previously pushed journey-alignment dispatch and
Grok PR #15, integrated at `8202f3cb`: its 31 additive social-arrival keys,
copy and tests are retained. No attestation was added by integration.

Grok's board and independent social-door work remain its lane. PR #19
appeared during integration with an overlapping directory rewrite; it needs
reconciliation against this candidate, not a blind overwrite of either
branch. Source review found no missing destinations. This candidate adopts
Grok's visible estate-hive web actions, shorter arrival header with expandable
receipt/count evidence, and continuous light bottom navigation. The social
door can land separately after localization and per-view state preservation;
its proposal resets disclosures on each toggle and should reuse this lane's
preserve/restore behavior instead. The separate cloud-environment and banchor
PRs are outside this change.

Three existing sessions were reused: two bounded read-only source reviewers
(tool mechanics and reading/navigation UX) and one localization worker.
They inherited their established settings, with no model/effort override,
new implementation fleet or paid tool added. Review findings above were
fixed and covered by the named tests. This is source-mediated coordination,
not a claim of direct injection into Cursor or zCode sessions.

`experience.*` adds 54 keys in English plus the 28 docked languages: 1,566
nonempty cells. The six priority languages stay ru, lv, th, gd, tt, uk;
existing language preference and corpus attestations remain unchanged.
Every new cell is a machine draft. Musical key means tonic, score means
composition data, and seed means the generator input. Native review,
especially modern technical vocabulary in gd/tt/sa, remains open. Dynamic
status text and historical unkeyed prose still have English fallbacks;
core-key coverage does not mean every sentence has been translated.

## Verification and limits

Local focused suite: **64/64 passed**, including the 15 new tests in
`e2e/first-click.test.mjs`. They execute the shipped inline engines using
fake timers, audio startup, DOM boundaries and RPC responses. They prove
the named state/failure behaviors without making chain or audio requests.
The existing search, language, shared-bar, dock and Grok social tests remain
in the same CI step. Registry and CI-shape checks passed; frozen orbit art
was preserved by the freeze-aware loader bump.

Cache versions: tour 39, register 9, language loader 23, corpus 15,
atlas CSS 3 and atlas JS 4. The frozen orbit retains its previous cache key
under the standing freeze. Other surface edits are cache-only.

No local browser screenshots, DOM inspection, clicking, resizing or visual
QA were performed: the applicable Sites skill requires an explicit request
for browser testing. The repository's existing CI browser suites still gate
the release. No live collection completeness, live invite availability,
native translation attestation or matriarch usability approval is claimed.
The public PR/CI and issue #10 release receipt record publication separately;
this source dispatch does not assert a deployment that has not happened.

Committed-source verification: the first estate-source run reported
`4 drifted: bd.ext.h2: two Englishes` because its markup scanner interpreted
an inline JavaScript selector as a keyed HTML element. The selector now uses
single-quoted attribute values, with the same DOM behavior. The next run
passed **11/11**, including regeneration, 680 used keys and 799 corpus keys
across the 28 translated languages. No wording or translation was weakened
to satisfy the check.
