# Astra UI integration intake — make the invitation match the result

Seat: Codex (Astra). Date: 2026-09-19. Inspected main: `d7b9b2c6`.
Status: source review and implementation brief, not an implementation or deployment receipt.

## Design reference actually read

The founder supplied the [skaists Design System](https://claude.ai/artifact/FAw4pbmMfrKNX6ffA1cDsj).
It initially required sign-in; it subsequently became readable in the existing browser.
I read its README and token table directly. Component demonstrations and downloadable
assets were not inspected: the browser rejected component-menu clicks because it could
not safely resolve the nested-frame coordinates. The artifact was not edited.

The integration standard extracted from that reference:

| Concern | Acceptance requirement |
| --- | --- |
| Three registers | Identical facts, actions and permissions; distinct voice, density and composition. Detail remains accessible in every register. |
| New bee | Paper `#fbf7f0`, ink `#0c1412`, human purple and one magenta primary action; 16px reading text; familiar adult language and a clear return path. |
| Raver | Art carries the explanation; words remain with glyphs; motion never suggests work or playback that is not occurring. |
| Cypherpunk | Inspectable state and provenance, mono reading face, teal actions. |
| Unavailable capability | Visible name and plain explanation, not a dead button. Unknown measurements must not appear as zero or an unexplained dash. |
| Interaction | Press targets at least 44px; visible focus; no automatic sound; a coherent still under reduced motion. |
| Language | Whole keyed sentences; RTL logical layout; room for longer translations; founder casing and people's names preserved. |
| Identity | Burti for names rather than sentences. Source art and the matriarch's mandala are preserved, not redrawn. |

This is an intake summary, not a claim that existing surfaces already meet every item.
The artifact names an older repository base (`f7465f4`) and explicitly describes
unsynced material. Current source must be compared by behavior and content, not by
assuming that the artifact is already shipped code.

## Current owners and boundaries

I read the bUi room `783fdfd9-2087-4478-bf0a-ec7498b794f9`, including the restart
thread and its correction. PR #137's Daily Art Manifest has an existing writer,
adversarial reviewer and routing seat. Their reported re-pin at `dd5c7e7f` rests on
content identity plus a rerun, not the withdrawn ancestry claim. Their remaining
hold is the founder's decision about how visible the daily variation should be.
This intake neither reopens their technical review nor lifts that hold.

PR #125 owns the genealogy/navigation work. bData has its own active founder-gesture
and pricing work. No files in either lane were changed here. PR #125 shares the
language corpus, so any media recovery must preserve its unrelated cells.

Astra's selected contribution is cross-surface action clarity and acceptance.
The first bounded candidate is Watch → Music → a clearly identified sound source.
This addresses the founder's earlier question about what the Music page actually
lets a person listen to.

## Source findings at the inspected main

1. `surfaces/watch.html:43` links to Music using `music.beeLead`, which says music
   is already playing. The embedded Watch language bundle carries the same claim.
2. `surfaces/music.html:273` repeats that claim; line 277 says the room plays from
   the verified manifest. No audio player is implemented there. The source shows
   encrypted-reference inspection, decorative animation and local join-state
   changes; `join-room` handling around line 549 does not establish playback.
3. `surfaces/listening.html:132-158` implements user-triggered oscillator sound.
   It is a generated-sound demonstration, not a hosted recording or performance.
   Its `stop()` clears the timer without clearing the displayed playing state;
   natural completion uses that same path. Audio-context resume/failure handling
   is also missing. This is source evidence; no sound was played during this audit.
4. Watch has conditional HLS/session code. Its presence is not proof of a live
   stream or hosted room at the public static address.

## Recover existing work, do not rebuild it in parallel

[Draft PR #78](https://github.com/beehive-nature/beehive-nature/pull/78), inspected
at `5b9164af`, already adds the useful Music source panel. It remains open and
conflicts with current main. A read-only application check of its five text files
against `d7b9b2c6` failed only on the coverage-floor file; that does not constitute
a complete integration test.

The draft still needs correction before reuse: both misleading hero claims remain;
its disabled Play control conflicts with the new plain-row design; and its dormant
ready branch enables a button and changes labels without implementing playback.
Links to project homepages must not be presented as attached tracks.

### Bounded GLM implementation packet

One writer, in an isolated worktree, after the room's routing seat records ownership:

1. Recover the source panel and its useful tests/keys from #78 onto fresh main,
   retaining the current paper/ink treatment. Use a descendant or a fresh recovery
   branch with provenance; do not rewrite an already reviewed remote history.
2. Correct the Music hero and Watch invitation in all existing tongues. Rebuild
   Watch's embedded bundle. A preview may invite exploration; it cannot announce
   playback merely because a manifest verified.
3. Describe unavailable local playback as a plain row with its reason. Remove the
   unsupported ready-state promise. Keep community/project links distinct from an
   actual recording or stream, and label external new-tab navigation.
4. Give someone who wants immediate sound a plainly named path to the existing
   generated-sound demo. If this path is promoted, repair and prove its Play, Stop,
   completion, suspended-context and failure states in the same bounded recovery.
5. Preserve the full current corpus and coverage-floor map. Change only measured
   floors for affected pages; do not import the old floor file wholesale.
6. Return a draft PR, a dispatch, and fresh 390px/desktop images. No new transport,
   hosted media, uploads, paid operations, wallet actions or deployment is needed.

Suggested routing, pending acknowledgement: LoVis bee-laborer records the owner;
one available GLM writer carries the recovery; bFUzZ checks behavior independently;
Astra checks the complete arrival/action/return journey against the design reference.
This is not a claim that those seats have accepted a new assignment.

### Acceptance of that recovery

- Watch → Music answers what exists, what can be done now, and what has not been
  configured, consistently in all three registers.
- No playback status without actual playback; no audio or media write on arrival
  or on a local join toggle. Preserve the same-origin override guard.
- If Listening is offered: press starts sound, Stop actually stops and reports it,
  completion reports completion, and rejected/suspended audio does not claim success.
- Keyboard focus, reduced motion, 390px/desktop, English, Arabic and a long
  translation; return navigation preserves chosen register/language.
- Music, music-view, store-reader, Watch-manifest, Watch-bundle check, estate-source,
  cleanup and affected language-floor checks on the final candidate. No baseline
  failures are silently called green; no floor is lowered to hide a regression.

## Checks and delivery limits

Read-only upstream check performed before selecting a feature lane: x0x #622 is
open; its current macOS evidence still distinguishes send-attempt measurements from
delivery and after-change acceptance. #505 is closed. No production or laptop mesh
probe was run.

This intake used local source inspection, an independent read-only audit, GitHub
PR state and the visible design/Buzz interfaces. No application suites were rerun,
because no product code changed. No new Buzz assignment was delivered: this seat's
CLI is unauthenticated, and native composer interaction did not produce a verified
message. Do not infer a dispatched job from this brief.

Subsequent authorized bridge setup is recorded separately in
`2026-09-19-codex-buzz-bridge.md`. It supersedes the CLI-authentication limitation
above; this paragraph preserves the earlier intake's delivery state.

## Verified routing and the Watch ownership dependency

The bridge subsequently delivered the packet directly to LoVis bee-laborer. The
coordinator recorded it in `WORK_LOGS/2026-09-19_BUI_MUSIC_SOUND_LANE.md` and proposed
ZcODe5.3max as recovery writer, bFUzZ as behavioral reviewer and Astra as journey
reviewer. This records routing, not an implementation acceptance. #137 stays held.

The coordinator checked both Cowork Watch branches as integrated through #138,
but Cowork's stated ownership of `watch.html` and shared register CSS has not been
released. Until it is, the permitted subset is **Music + Listening**. Watch markup,
its invitation and its embedded language bundle remain outside that subset.

An independent source check caught a coupled translation dependency before edits:
`music.beeLead` is used in Watch's fallback and embedded bundle. Changing that key
while freezing Watch would fail bundle `--check`; an English mismatch also fails
estate-source. The boundary-preserving option is to give Music's truthful lead a
new Music-only key (for example `music.roomPreviewLead`) with all language cells
and draft provenance. `music.beeIntro` is not embedded by Watch and may be corrected
in place together with Music's fallback. Preserve corpus metadata, including
`law`, `langs`, `rtl`, `attested` and `withdrawn`, which the bundle builder embeds.

Read-only in-memory checks confirmed that the proposed new Music-only key and
the intro correction leave Watch's generated bundle unchanged. Keep the Watch
bundle gate active. The scoped candidate must explicitly disclose that Watch's
false playback invitation remains unresolved behind the ownership dependency;
it must not claim the full cross-surface journey repaired.
