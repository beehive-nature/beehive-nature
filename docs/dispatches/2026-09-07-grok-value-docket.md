# Grok's next slice: a gift worth sharing, a story we can demonstrate

2026-09-07 · Astra lead · source inspected at main `832bdf83`.

Serves L2 (rebuildable behavior and reproducible evidence); records L1 persistence and L3 resource limits without claiming either is complete. This is a work assignment under the founder's invitation to guide Grok. Receipt of the assignment remains unconfirmed until Grok claims it in [coordination issue #10](https://github.com/beehive-nature/beehive-nature/issues/10).

**Direction:** complete one satisfying person-to-person kandi exchange, then make that exact experience the New bee campaign demonstration. Develop the festival opportunity through a small discovery brief in parallel. Use what is learned to choose the next social capability. The three brands and three views are independent dimensions: every organization can have New bee, Raver and Cypherpunk presentations of the same capabilities.

The founder's mother remains the design reference: an experienced artist entitled to clarity, comfort and dignity. Home remains the broad arrival; a specific gift or campaign link should open its relevant bracelet or making surface, with an obvious way home. Profile remains optional.

## First assignment — trustworthy gift behavior

**Owner:** Grok integrator and one implementation worker. Claim current base and paths before editing. Start with `surfaces/kandi.html`, the existing `e2e/kandi-{arms,arrival,crossing,thread}.mjs` tests, a focused gift-state regression suite and a dispatch. Apply three-view presentation inside this consumer page after the state repairs; Astra retains shared theme/routing/CI integration.

Source review found these concrete acceptance defects:

1. `gift(idx)` captures a mutable array index and runs unguarded timers. Giving A twice from `[A,B]` can retire A and then B, while exporting A twice. `giving` does not guard the callbacks. A presentation-only redesign would preserve this loss path.
2. The animation retires a bracelet before copying or any recipient action. Copy failures and `save()` failures are swallowed; creation/receive still clear the user's input. The shortened `given` record cannot reconstruct the original export. Repeated Keep/paste adds copies, and two open tabs can overwrite the same saved arms.
3. `NAMERE` rejects names such as `Jānis` and Cyrillic names. Word entry strips characters outside A–Z. A translated interface does not make these inputs usable in the founder's priority languages.

Source: [`kandi.html`](../../surfaces/kandi.html), `load/save`, `clean/decode`, `#stringit`, `gift`, `#copygift`, `#donegift`, `#rcvgo`, arrival Keep; [`pointers.js`](../../surfaces/blight/pointers.js), `PTR.kandi`. These are source findings, including an execution-path counterexample, not a new live-browser reproduction receipt.

**Acceptance for the first PR:**

- Use a stable gift identity and a bounded operation state. Repeated taps, closing/cancelling, reduced motion, navigation or a changed arm cannot retire another bracelet or complete a hidden stale operation.
- Preserve the founder's retirement rule: a completed gift leaves the giver's arm and keeps a memory. Animation alone must not commit that change. Define the deliberate local handoff-completion action; retain the complete export in a recoverable local record before retiring it. Do not claim that a recipient received it merely because a clipboard write succeeded.
- Distinguish prepared, copied/manual-copy-needed, locally completed and kept-by-this-browser states. Use short plain labels in New bee; details can explain mechanics. A clipboard rejection offers selectable text and a useful recovery action. No successful-save wording when storage fails; keep input/export available. Detect stale writes from another tab and merge safely or refuse visibly rather than silently overwriting work.
- Receiving remains preview-first, then explicit Keep. Reopening/repeating the same canonical payload is locally idempotent. Preserve current saved arms and legacy payloads. A public Show link is a copyable preview, not evidence of a completed exclusive gift; received keepsakes remain without Give/Cross actions. The crossing remains a local operation, never advertised as escrow or a remotely atomic exchange.
- Preserve legitimate names without silent transliteration or deletion. Separate Unicode names from the existing bead alphabet. If a compatible protocol extension is needed, put its migration and old-reader behavior in a separate small follow-up; do not silently reinterpret old KND1 records. Explain unsupported bead letters before someone loses their input.
- Add negative tests for repeated give, target changes, cancellation/stale timers, clipboard rejection, blocked/full storage, duplicate receive, stale-tab writes and malformed input, alongside successful controls. Retain the existing arms/crossing/arrival/threading rules. Return failures and limitations honestly. Coordinate with Astra to put meaningful new checks into the actual release workflow; a test file on disk is not automatically a CI gate.

Preserve work, language and disclosure choices when switching views. New bee uses the shared light reading standard; Raver leads with art and emotion; Cypherpunk exposes the same state and limits. Do not create a separate gift engine for each view. New or changed copy gets aligned corpus rows across the docked languages with machine-draft status; claim the append-only corpus edit when the English is stable. zCode #7 remains independent meaning/native review.

## Parallel assignment — one brand and demonstration pack

**Owner:** Grok integrator plus one bounded creative worker. Reuse `docs/mvp-walk/marketing.html`, `docs/mvp-walk/index.html`, their assets and the existing outreach dispatch in Grok's branch. Those files are not on inspected main: include their actual commits and assets in the PR, not only a localhost or `/workspace/` path. Keep implementation and campaign assets in separately reviewable changes.

Deliver one review board with:

- **Genesis marks:** skaists with its purple center; beehive biomass solid green; beehive nature as the genesis palette reference. Derive exact colors/geometry from the founder's supplied marks and record file provenance. The organizations do not map one-to-one onto the three reading views. Keep semantic UI colors and organization identity separate.
- **One New bee introduction:** a short statement of what someone can make, share and discover today; one clear invitation. A possible creative starting point is “Make a little color. Give it to someone.” This is proposed copy, not a newly ratified slogan. Replace the current long parenthetical movement instructions in the voiceover with natural spoken language; keep precise choreography in the production notes.
- **One 15-second New bee cut and one Raver adaptation:** common action and destination, different expression. Include readable captions, a poster/static alternative, playback controls and reduced-motion treatment. Cypherpunk gets the matching source/limits card. Use original or permission-cleared media/audio with provenance.
- **Founder-accepted PLUR continuity:** two people throughout; Love formed by their touching fingertips; Unity uses interlocked fingers; Respect carries the bracelet from giver wrist to receiver wrist while fingers stay locked; giver ends bare. A dissolve between separate signs is not the requested fluid movement. Label physical illustration separately from the software's person-carried clipboard/link handoff.
- **A claim-to-proof table:** exact claim, intended reader, demonstrated action, source/release, proof type, destination, limit and last verification date. A design still is a concept; a screen recording proves only the recorded behavior; source publication and a human usability observation are separate evidence. Correct the current “stays/forever” language to the actual browser-storage boundary. Do not attach permanent storage, verified identity, unique ownership or cross-device delivery promises to KND1 checksums.

Keep one campaign destination per creative. A grand-opening introduction can lead to Home; a specific “make a kandi” or received-gift action should land directly on that action. Owned Home/Buzz/Bluesky placements are the founder's proposed distribution sequence, not evidence here of account access, active room presence or platform performance. Return concrete post previews and destinations; this assignment launches no public post, recipient messages, paid campaign or purchase.

## Small learning loop and festival brief

Prepare a short observation guide and an empty scorecard for a first group of about five willing newcomers. That sample size is a cheap working choice, not a statistical guarantee or a mandatory approval gate for ordinary fixes. Give a neutral goal, observe the attempt and record the point of confusion; do not coach the clicks and report the coached result as independent completion. These methods follow the [GDS usability-testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing).

Record the tested version, attempted tasks, unassisted completions, assistance, failures/recovery and separate observed receiver Keeps. Distinguish a deliberate decline from a technical failure. Record time to a first completed bracelet and to a completed handoff; test the proposed “30 seconds” rather than advertising it in advance. A small tally of known attempts and outcomes follows the [completion-rate principle](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate); our specific pilot measures are engineering proposals. Use aggregate volunteered observations, with no private gift payloads, names or hidden tracking committed. Agent fixtures are not human participants. Human recruitment and feedback remain pending until people actually take part.

Festival discovery starts as a **one-page hypothesis brief**, not a second product build:

| Participant | Candidate value to investigate | Evidence to request in a later human conversation |
|---|---|---|
| Attendee | A meaningful creative exchange with someone | Can they make, give and understand what is kept? What would make them return? |
| Artist/DJ/maker | A recognizable creative gift linked to their work | Would they choose to make/share it, and what attribution or reuse do they need? |
| Promoter/community host | An optional participatory activity | Which existing problem would a small pilot solve, who would host it, and what would count as worthwhile? |

Prepare a few interview questions, one small proposed pilot, its required people/resources and its success/failure measures. Budget, willingness to host/pay and commercial benefit stay **unknown** until evidenced. No scraped lead campaign or outreach is assigned. Do not make a grand-opening brand freeze a prerequisite for learning what these people need.

After the gift slice, the next human/agent candidate is a small, explicitly invoked creative helper with a stated actor, capability, input, result and failure state. Map it to the existing dock/local-agent seams before claiming implementation paths. Coordinate any agent-receipt view with backend Astra/zCode against the contract under #23/PR #25 after its acceptance. That candidate is an offline reader with unknown writer acknowledgment, not a live agent-delivery service. Do not build a competing receipt database or call a relayed task acknowledged/completed.

## Allocation, authority and return

Grok keeps its existing founder-driven integrator session. Suggested maximum concurrent implementation allocation: **one fresh Cursor cloud worker at high effort** for gift state and tests, and **one fresh focused creative worker at medium effort** for the brand/demo pack. Reuse an available reviewer in a separate read-only session after the code candidate exists, at high effort for state/persistence/claim review. The reviewer must not review its own implementation. Use actual supported settings and report model, effort label, session type/ID and file ownership; Astra does not know Grok's current model configuration. These are bounded trial/subscription tasks, not authorization to buy capacity or leave workers polling.

Astra retains shared `register.js`, `tour.js`, language-loader/measurement infrastructure, generated Home and CI/cache integration. Grok owns the claimed kandi consumer changes and marketing assets. zCode's existing #6/#7 review and #23 recovery work remain undisturbed. No new server, laptop mesh, settlement, root-identity or constitutional mechanism is needed for this slice.

Map claims honestly to the seven primitives: typed maker text is not authenticated Identity; the giver's choice is Intent; local transitions are observed Events; codec validation is limited Evidence; research findings are attributable Knowledge; browser/clipboard/storage limits are Resources; this gift demonstration implements no monetary Settlement. Durable kernel semantics are a target for future adapters, not properties conferred by these labels.

**Return:** claim branch/base and workers in #10; then provide the small code PR, portable review board/assets, claim-to-proof table, observation guide/empty scorecard and festival brief, exact commits/checks, remaining limitations and a committed dispatch. Claim readiness of each artifact separately. Most immediate implementation effort goes to the gift defect; branding runs alongside it; discovery is timeboxed to the short brief. The founder can give creative feedback on a concrete board while the agents handle routine integration.

Astra prepared this docket in its own worktree after fetching main, reading the founder's pasted handoff, the constitution/design constraints and current issues. One existing read-only source-review session was reused at inherited model/effort; no new Astra worker, browser test, public campaign or product deployment was started. Existing kandi tests were inspected, not run in this documentation lane. The next assignment is published for Grok to claim, not represented as already running.
