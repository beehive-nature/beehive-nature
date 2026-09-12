# SKAISTS watch companion: three views, language bundle, privacy boundaries

## Scope and attribution

This lane repairs `surfaces/watch.html` in the isolated watch worktree and
updates the existing PR #42. SKAISTS owns the web companion's name and design.
W@tch, JAMS.community and 3Speak are independent projects, with explicit links
to their original apps/project pages opening in new tabs. Their stock device
apps are not modified. The previous W@tch link incorrectly pointed at our own
relay; watch, Jams and devroom now point to the actual Watch-It repository.

The founder's north star is secure access for everyone and privacy in every
view. Cypherpunk exposes the mechanisms and limits; it is not an access tier.
An attractive privacy diagram is not evidence that a private transport exists.

## Visible changes

- New bee follows the shared light SKAISTS theme; Raver uses a distinct dark
  media palette; Cypherpunk opens the technical room and privacy map. Each view
  keeps the same controls, session state and amounts.
- Replaced unrelated Forge/two-tab copy with watching and conversation copy.
  A stopped/absent stream has a designed empty state, not a black video box.
- Local file preview loads its styles and language bundle without a server.
  Room controls are disabled there; no room API, stream or iframe starts.
- Hosted chat loads `/join/` only after the reader presses Open chat. Shared
  navigation is an in-flow disclosure instead of a fixed strip over content.
- Both required gauges remain visible and say Not quoted. A-denominated
  session credit is separate from b and a local-currency quote. No unread
  receipt lights an audit verdict. The sample manifest is labelled shape
  checked, not cryptographically verified or a live connection.
- Page Referrer policy and chat iframe policy are `no-referrer`. Host-provided
  receipt fields now render via `textContent`, closing an HTML-injection path
  in `paintStrip`; a browser regression supplies a hostile image field.

## Language and accessibility

32 new `watch.*` keys have English plus 28 machine-drafted translations. No
human attestation is claimed; native review, particularly gd/tt/sa, remains
open. Detailed protocol explanations remain English, explicitly marked with
`lang=en` and `dir=ltr`; the shared coverage indicator reports the actual
visible translated subset rather than a full-page translation claim.

`scripts/build-watch-languages.mjs` derives the inline watch/shell subset from
the existing corpus (38 keys). The browser test checks it is current. The
shared loader can use this bundle under file protocol and preserves its
normal fallback and withdrawal rules. Missing translations stay English.

Local browser checks cover all 29 languages in each of the three views at
390px, Arabic RTL and enlarged text. Visual inspection covered desktop New bee,
Raver and Cypherpunk, the privacy map, and English/Arabic phone layouts. These
are layout/runtime checks, not human review of translation meaning.

## Privacy and access findings

The map is source checked against `watch.html` (`attach`, `readSession`,
`pollHealth`, `pollTicker`, chat handler), `surfaces/rails-badge.js`
(`railsAlive`, `boot`), and `ops/watch/live-door.mjs` (`handler`, `meterRow`).
Live deployment configuration, logging and retention were not inspected.

The hosted page reads health and ticker every five seconds and a fixture once.
Watch sends a receipt number in playlist queries and polls session JSON every
four seconds; pause adds a two-second poll. The host can associate these paths
and their timing with an IP and receipt. HTTPS terminates at an operator; it
does not establish end-to-end encryption or conceal playback from that host.
The same-origin chat iframe is not a security boundary from first-party scripts
or origin storage. Chat's downstream protocol/encryption remains unverified by
this page. The map never interpolates stored passes or identity values.

**Access finding requiring backend follow-up:** the checked-in server's
playlist branch checks active receipt credit, but its `.ts` segment branch
serves an existing segment without checking that receipt. The receipt JSON
route also has no caller identity check. This can be confirmed by comparing
the `SEGMENTS`, `PLAYLIST DOOR`, and session branches of `handler`; no production
request or private media retrieval was made. Playlist metering must not be
described as private media authorization. The page now says private viewing is
not established. No box code or configuration was changed by this design lane.

The shared rails badge is a dated snapshot with an explicit refresh that can
contact two public chain hosts. A saved public label or origin fingerprint is
not authentication. Future claims about encrypted media, private transactions,
unlinkability, key custody or paid admission require separate evidence. This
watch page starts no wallet signing, payment, raw x0x socket or real Store write.

## Parallel-session boundary and 3Speak

Read the [ecosystem adapter sweep](2026-09-12-eco-adaptor-sweep.md) from
`origin/main`. It is research input, not proof that an adapter is integrated.
This lane owns presentation and disclosures, not the other session's Autonomi,
Hive or node upgrade work. We have added an external 3Speak link only.

For a future 3Speak adapter, the [official player](https://play.3speak.tv/)
documents watch/embed routes and iframe mode; [Hive's video-hosting guide](https://developers.hive.io/services/videoHoster.html)
describes the Hive/IPFS boundary. Prefer a documented provider player preserving
creator attribution and access rules. A publicly reachable HLS URL alone is
not permission to rebroadcast a catalog or bypass a provider's admission flow.
No upstream code, uploads, private catalog, paywall or wallet was touched.

## Verification receipt

Before integrating the newer main branch:

- Watch browser checks: **29/29**, including 87 language/view combinations,
  raw file preview, opt-in chat, inert hostile receipt text, unchanged amounts
  across views, and no stored pass interpolated into the privacy map.
- Shared language/register unit tests: **27/27**, including inline bundle,
  malformed-bundle fallback and withdrawn-translation cases.
- Jams browser checks **17/17** and encrypted Store reader **9/9** on the design
  change; no real network write or payment proof is claimed.
- Estate source check **11/11**; registry **94 counted / 103 listed / 26 domains**;
  generated language bundle in sync and whitespace check clean.

Hosted checks and final integration validation are recorded below once run.
The existing public live-media and funded-session exercises were not run:
those perform writes and operational changes outside this presentation repair.

## Bringing main into the review branch

Integrated `origin/main` at `8d42da28` locally into this PR branch; main itself
is not changed. Five textual conflicts were resolved by retaining both CI
suites, both corpus additions and drafting histories, main's current-language
and coverage refresh fixes, and its sibling-asset resolution alongside our
file-protocol paths. Both media pages now use the shared v42 loader. The corpus
has 1,027 keys after composition; no other session's translation was discarded.

The combined watch/Jams/Store browser battery passes **29 + 17 + 9**. The
shared unit battery initially named Jams' older v41 loader; updating it to v42
restored **27/27**. The source gate compares against committed HEAD and restores
HEAD on drift, so running it during a pending merge named the old generated hub.
The atlas was regenerated for the combined registry and is committed with the
merge; its final committed-tree gate follows. CI shape is **42/42** guarded
suite steps. Hosted review checks remain the authority for the final pushed pin.

Final local validation on the composed tree: the committed atlas/source gate
passes **11/11**, registry and bundle checks pass, and the inherited reading-room
browser suite passes **1,454 assertions** (both viewport sizes, translations,
view/state retention, reduced motion and denied preference storage). The worktree
is clean after the receipt commit. PR #42 is updated and mergeable; hosted
checks were still running when this receipt was written. No merge or live
deployment is claimed.
