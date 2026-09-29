# 2026-09-27 — MY SPACE: the stranger instrument (Cypunk lane, UX measurement)

Seat: Fable 5.1. Founder go: "start the MY SPACE stranger instrument on its own branch". Branch `claude-lovis/funny-pascal-bpv6vu-myspace` from main 7d6808d8. No surface touched; this lane measures.

**2026-09-29 revisions.** Five independent agent reviews (code-review, high effort) of this instrument found headline numbers that were artefacts of the instrument, not of the page, and then instrument defects short of that: the first on commit 6bb5c8ec, the second on b6097862, the third on 22ec3fb5, the fourth on 64720c1d, the fifth on 97a2c602. This dispatch is rewritten around the corrected instrument; the earlier numbers stay in git and are quoted below so each correction is visible, not silent.

## The question

Can a stranger complete MY SPACE without learning the storage architecture? `e2e/myspace-stranger.mjs` answers the machine-measurable part with a scripted visitor per register who reads only the words on screen, chooses by plain-language intent, stores a file, then tries to remove it and get it back. It counts every implementation word it had to read. What it cannot measure it names as not measured: task completion rate with people, and comprehension of temporary versus forever. Those are the human layer and stay judgement, reported as judgement.

## Result, branch head over main 7d6808d8 (MY SPACE files unchanged on main since), 390×844, three registers

Runs 26–28 on this box hash identical with the millisecond figures masked, with no instrument notes. Run 27 is quoted.

| register | purposes offered | controls readable without a tap | wrong choice (of offered) | led nowhere | first file: page presses (+ the file picker) · ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front (incl. cards read) | leak words in archive (empty / with the stored row) | own-wallet wording visible | forever payer (declared) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bee | now, keep, share, forever | 4/4 | 0/4 | 0 | 2 (+ picker) · 846 (269 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 1 | 2 / 2 | y (controls; archive) | you |
| raver | now, keep, share, forever | 0/4 (4 taps to learn the rest) | 0/4 | 0 | 2 (+ picker) · 1180 (266 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 2 (2 on the cards) | 2 / 2 | y (controls (after a tap); archive) | you |
| cypherpunk | now, keep, share, forever | 4/4 | 0/4 | 0 | 2 (+ picker) · 736 (269 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 26 (declared voice) | 20 / 21 | y (archive) | you |

Reading it:

- **Raver's rings say nothing until tapped. This is the finding the third review surfaced, and the one that matters most for the design seat.** Bee's rows and cypherpunk's table carry their purpose words on the control (4/4 readable without a tap). Raver's four orbits are unlabeled rings; their names and terms exist only as `aria-label` (for a screen reader) and on the card that answers a tap. The first three commits scored raver on the `aria-label` and reported "0 wrong of 4" as if the words were on screen; they were not. The instrument now does what a sighted visitor does: taps each ring and reads the card, counting the taps. With that, raver still reaches 0 wrong of 4, but only after four learning taps, and its first-file time carries them (1204 ms against 826 / 743). Whether four exploratory taps before the first real choice is the intended raver grammar ("tap an orbit · tap the heart" is the front's own hint) or a cost is the design seat's call; the instrument only reports it.
- **Choice: 0 wrong of 12, and 0 "led nowhere".** With whole-word matching and a tie rule (a zero score or a tie is "the words led nowhere", never the first control in the DOM), every intent in every register lands on the right purpose with a clear lead (scores 4–8, printed per choice in the receipts). The words that carried it: bee "just for now / keep it here / show the world / keep it forever", raver's cards "just now / keep it / show it / forever" with their terms, cypherpunk the purpose ids with their declared terms.
- **First file: two presses on the page plus the device's file picker** (plus the four learning taps in raver). Milliseconds from page open to the row observed stored, runs 26–28: bee 828–867, cypherpunk 736–749, raver 1160–1196; about 265 ms of each is the instrument waiting for the offered purposes and the pressed one to hold still before it reads the front; the clock starts at page open (browser-context setup is timed apart and not counted) and stops the moment the row is observed stored. **No request left the page during a keep-it-here add, none during the remove, and none in the 250 ms after it**, in any register. After the add the page resets the pressed purpose to the most private one, as its own comment says it will.
- **Terms before the choice:** lifetime and readers are stated on every purpose control (bee, cypherpunk) or on its card after the tap (raver) before the visitor commits. This is the proxy for "temporary versus forever is stated", not a claim that it was understood.
- **Remove works and says what it did** in all three registers. Finality is judged twice and the matching words are printed: the confirmation sentence earns it on "anywhere else" ("Nothing about this file will exist anywhere else"), the outcome on "Gone". Exactly one visible remove control per stored row; it is pressed through playwright's actionability checks, not a programmatic click.
- **Recover does not exist.** Nothing on the page offers to bring a removed file back, and the search uses the same visibility rule as everything else, so a future position:fixed undo toast would count. The tour bar's link named "recover" (which leads to key recovery) is present in the bar's link strip but is *not* on screen at 390 px without scrolling the bar; the first two commits' claim that a stranger "sees the word" after removing a file was a presence check, not a visibility check, and is withdrawn. What stands for the design seat: there is no file recovery, and the bar's word "recover" means keys, so if a recovery affordance is ever added the two must not share a name.
- **Leakage.** Fronts: bee 1 ("wallet", in the funding sentence), raver 2 ("blossom" and "ant", read on the cards during the learning taps: the cards name the rail after the purpose), cypherpunk 26 in its declared voice (rail ×8, blossom ×3, ant ×3, adapter/worker/indexeddb/autonomi ×2, aes/signer/predicate/keyref ×1; read with "keep" pressed — the write path changes with the pressed purpose, so the pressed one is recorded). The shared archive below the fronts, read empty and again with the stored row showing: bee and raver 2 / 2 ("rails" in the tech note's always-visible summary, "wallet" in the forever mode button's payer phrase; the stored row adds nothing in these registers), cypherpunk 20 / 21 in its own voice (rail ×7, wallet ×4, adapter ×3, …; its row prints keyref and cipher). The first commit's "0 in every register" came from a selector that read only the archive's two-word heading.
- **Funding: the known mismatch is on screen in all three registers, and where it lives.** bee says "you pay, from your own wallet" on its forever control, raver on the forever card after a tap, and all three on the archive's forever mode button ("You pay for it, from your own wallet." / "you pay. your wallet." / "payer: you (own wallet)"). The second commit's "cypherpunk n" searched only the front and controls; the archive says it. The previous commit's "bee: front, controls, archive" counted one sentence twice, since the front contains the controls; the front outside the controls is now tested on its own. Those words are not page copy: `myspace.js` prints the payer the ANT rail DECLARES in its `describe` terms (`myspace-adapter-ant.js`), and the register phrase sets (`myspace.js` ~487–502) map `payer: you` to those sentences. So the wording fix, once the sponsor cap is defined, is a declared-terms change on the rail (payer becomes the sponsor) plus the phrase for that payer, and the page will say it in all three voices without a copy edit. The static tech note at `surfaces/myspace.html` line 442 says the same thing in prose and is the one literal to change.

## First review (2026-09-29, on 6bb5c8ec): ten findings, disposition

1. **Archive leakage read one heading.** `querySelector('main > :not(#eternal)')` returns the first non-front child of `<main>`, the `<h2>the whole space</h2>`, so the archive count was `{}` by construction. Fixed: every child of `main` except the fronts, visible text only. 0/0/0 became 2/2/20.
2. **Finality was earned by the outcome, not the confirmation.** Fixed: judged separately before and after, matching word printed; "nowhere else / anywhere else / no longer / will not exist" added because that is what the sentence says.
3. **Substring counting** ("trail" as "rail"). Fixed: whole words, singular or plural.
4. **Requests during remove were lost** after the add snapshot. Fixed: one wire set per phase.
5. **Remove control not filtered for visibility, pressed programmatically.** Fixed: must have a box on screen; pressed with `page.click`; candidate count printed.
6. **Choice scoring by substring, first-in-DOM on ties.** Fixed: whole words; zero or tie is "led nowhere"; score printed.
7. **`--reg` as last argument crashed.** Fixed.
8. **Dispatch prose "under 520 ms" against a 530 ms receipt.** Fixed by quoting ranges and separating the instrument's settle time.
9. **Status read ignoring `hidden`.** Fixed: visible text only from elements that are not hidden and have client rects.
10. **Static server duplicates `myspace-eternal.test.mjs`.** Not changed; a shared serve helper touches another owner's test. Named follow-up (also raised by the second review).
11. Found while re-running: the front's text depends on when it is read (cypherpunk 26 vs 28). First fix: wait for every purpose to be offered; superseded by the second review's finding 8 below.

## Second review (2026-09-29, on b6097862): ten findings, disposition

1. **A missing `__eternal` crashed the whole run** (an unguarded evaluate after the ready wait; no per-register try/catch), losing every register's output and the `--json`. Fixed: the read is guarded and a register that dies is reported as failed while the others and the JSON survive.
2. **RECOVER filtered by `offsetParent`,** against the file's own rule, so a position:fixed undo toast would be missed. Fixed: client rects, and `body > button` included.
3. **Requests between the remove snapshot and the end were dropped** (filed under "remove" after the snapshot, and that phase was not printed). Fixed: an `after-remove` phase begins right after the outcome is read, with a 250 ms wait so a post-delete render or adapter follow-up reaches the log; every non-add/remove phase prints. All empty.
4. **cypherpunk "own-wallet wording: n" was a selector-scope artefact:** the archive's forever mode button says "payer: you (own wallet)". Fixed: the front, its controls and the archive are all searched and the table says where. Now y in all three registers.
5. **The tour bar "recover" finding rested on DOM presence, not visibility.** Fixed: the link is tested at its centre point against `elementFromPoint`; at 390 px it is present but not on screen. The finding is corrected above.
6. **`FINAL` matches "gone" and "permanent", which also occur in lifetime clauses;** latent, since the instrument removes a keep row. Mitigated: the matching word is printed so a reader can judge it; the vocabulary is unchanged.
7. **Remove-control matcher was substring-based.** Fixed: whole words.
8. **Waiting for every purpose to be offered treats "legitimately not offered" as "not settled"** and would burn 5 s on a page with a rail missing. Fixed: the wait is for the offered set and the pressed purpose to hold still for 250 ms (5 s cap), which also covers the first review's finding 11.
9. **Static server duplication** (three copies across `myspace-eternal.test.mjs`, `myspace-seam.mjs`, this file). Still a named follow-up, for the same reason.
10. **Duplicate keep scoring, string-spliced evaluate helpers, header vocabulary incomplete.** Fixed: one scoring per intent reused by FIRST FILE; plain arrow functions in the evaluates; header lists keyref and pubkey.

## Third review (2026-09-29, on 22ec3fb5): ten findings, disposition

1. **Raver was scored on `aria-label`, words no sighted visitor sees.** Confirmed against the page: the orbits are `<g class="orbit" aria-label=…>` with no rendered text; names and terms appear on `#etRaverCard` after a tap. Fixed: a control's own visible words are used; a control with none is learned by tapping it and reading the card, the taps are counted, and "controls readable without a tap" is a column. Reported above as the lane's main finding.
2. **`after-remove` began after its own 250 ms wait,** so the phase was empty by construction. Fixed: the phase begins before the wait.
3. **A register that died lost everything it had gathered and leaked its context.** Fixed: the record is built before anything can fail, the body runs in try/finally with the context closed in finally, and a failure keeps the partial record with a note naming the phase.
4. **The raver tap used viewport coordinates without scrolling the SVG into view.** Fixed: the orbits are scrolled into view first and the tap point is asserted inside the viewport.
5. **First-file milliseconds included two evaluates after the row was stored.** Fixed: the clock stops when the row is observed stored.
6. **"front" and "controls" counted the same own-wallet sentence twice.** Fixed: the front is tested outside its controls (text nodes not inside a control), read before any learning tap.
7. **Stale receipt sentence about the settle wait.** Fixed.
8. **Duplicate reducers and tallies.** Fixed: one summary per result feeds the stderr line and the table.
9. **Static server duplication** (now counted at four copies). Still a named follow-up; touching the other harnesses is other owners' lane.
10. **`--reg` typos produced a plausible failed row.** Fixed: unknown registers exit 2 with the known list.
11. Found while re-running: the page's data mirror reports the new pick before the card re-renders, so the card read after a learning tap could lag by one ring (one run in three showed share/forever tied and forever at −1). Fixed: after a tap the instrument waits for the card's words to change (3 s cap, skipped when the ring was already the pressed one). Four runs then agree.

## Fourth review (2026-09-29, on 64720c1d): seven findings, disposition

1. **Context and page setup ran before the try/finally,** so a failure there still killed the run. Fixed: setup is inside the try under a `setup` phase; the context is closed in finally only if it was opened.
2. **The no-remove-control path left the phase at `remove`** with an empty literal list, hiding anything on the wire during the recover probe. Fixed: the path records the wire and moves to `after-remove` like the found-control path.
3. **"outcome stated" accepted any non-empty status,** including the add's leftover "Done.". Fixed: the status before the confirm is captured and the outcome must be a new sentence.
4. **The TERMS payer proxy matched "nobody" and "hive",** which also occur in the deletable and lifetime clauses. Fixed: pay / pays / paid / payer / paying / wallet, whole words.
5. **Presses had no timeout** (playwright's 30 s default against 3–15 s everywhere else). Fixed: 5 s on every press.
6. **The instrument wrote into the page it measures.** Confirmed: `myspace.html` observes `#list` with `attributes: true`, so tagging a button with `data-stranger-rm` fired the page's own refresh right before the remove. Fixed: the remove control is selected with a playwright locator (text filter + `visible=true`) and pressed through it; nothing is written into the page.
7. **`R.external` duplicated `wire.load`.** Removed.
8. **Static server duplication.** Still a named follow-up, for the same reason as before.

Results after this round are unchanged from the third review's (runs 23–25; 24 and 25 identical with timings masked, 23 differing only in the recorded pressed purpose when the bee front was read). Run 24 is quoted in the receipts.

## Fifth review (2026-09-29, on 97a2c602): eight findings, disposition

1. **Raver's learning cards were read but not counted as leakage.** The cards print the rail after the purpose ("show it · blossom", "forever · ant"). Fixed: words read on the cards during the learning taps count into the front figure and are printed apart. Raver's front goes from 0 to 2 (blossom, ant), both on the cards.
2. **The archive was counted only while empty,** before the stored row the visitor reads to find the remove control existed. Fixed: the archive is read again with the row showing and both figures are printed. Bee and raver rows add no implementation word (2 / 2); cypherpunk's row prints its keyref and cipher (20 / 21).
3. **The first-file clock started before the browser context existed.** Fixed: the clock starts at page open; context setup is timed and printed apart, not counted.
4. **"On screen" was used for what is really "rendered"** (has a box; the page is taller than the viewport). Fixed in the code's words and here: rendered means on the page, not in view without scrolling; only the tour-bar link is tested for being in view.
5. **TERMS lifetime/readers regexes matched substrings.** Fixed: whole words.
6. **The settle wait kept its state in a page global,** contradicting "nothing is written into the page". Fixed: the signature is polled from the instrument side; the page is not written to.
7. **Static server duplication.** Still the named follow-up.
8. **The file picker was counted as a page press.** Fixed: the picker is the device's dialog, counted apart; the page presses are two (purpose, add).

## Two instrument findings from the first commit, still standing

1. **A forced click is not a tap.** The first run selected the wrong orbit in raver and put a request on the wire during what was meant to be a keep-it-here add. The geometry probe showed why: a playwright click at a fixed offset inside the keep ring's hit box (the gesture `e2e/myspace-eternal.test.mjs` uses, `position {5,60}, force`) lands on the next ring out. Real taps on the ring, precise or 12 px off, select the right orbit every time and keep the front and the archive in step. The instrument taps the ring's own point; the product's orbit geometry is sound; the eternal test's gesture is fragile and is left for its owner.
2. **"recover" matched the tour bar.** The first run reported recover as offered in all registers because the bar's key-recovery link matched. The instrument searches the page's own controls only and records the bar link's presence and on-screen state separately.

## Method

`node e2e/myspace-stranger.mjs [--json out] [--reg bee,raver,cypherpunk]`. Localhost http, cold context per register, all cross-origin requests aborted and logged by phase (load / read / add / after-add / remove / after-remove / done). Purpose chosen by scoring each control's own visible words (or, for a control that shows none, the card that answers a tap on it) against the intent's plain words minus other intents' strong words, whole words only; a zero or tied score is "led nowhere"; the chosen text and score are printed so a person can judge the match. Visible text means an element that is not hidden and is rendered (has a box); rendered means on the page, not in view without scrolling, and only the tour-bar link is tested for being in view. Playwright 1.62, Chromium 141. Full receipts of run 27 follow.

## Receipts

### bee
- controls readable without a tap: 4 of 4
- "keep this just for now" → chose **now** (score 4) via "just for now only this phone opens it. gone when you close this tab. stays here"
- "keep it on this phone" → chose **keep** (score 8) via "keep it here only this phone opens it. stays until you remove it. stays here"
- "share it with people" → chose **share** (score 6) via "show the world anyone with the link opens it. stays while the hive keeps it. nobody can delete it. goes out"
- "keep it forever" → chose **forever** (score 4) via "keep it forever anyone can read it. lasts forever. nobody can delete it. you pay, from your own wallet. goes out"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page plus the file picker, 846 ms from page open to the row observed stored (of which 269 ms is the instrument waiting for the offered purposes and the pressed one to hold still before reading; 45 ms of browser-context setup before the open is not counted); status shown: "Done."; no request left the page during the add
- remove: control "Remove" (1 visible) → sentence "The bytes go and the key goes with them. Only this phone opens it. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "Remove from this phone" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {"wallet":1}; in the shared archive below while empty: {"rail":1,"wallet":1}; with the stored row showing: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (in: controls; archive); the forever rail declares payer = you

### raver
- controls readable without a tap: 0 of 4; the other 4 carry no words of their own and were learned by tapping each and reading the card
- "keep this just for now" → chose **now** (score 7) via "o1 just now · temp this phone only · gone when this tab closes" (read on the card after tapping the ring)
- "keep it on this phone" → chose **keep** (score 6) via "o2 keep it · local this phone only · stays till you drop it" (read on the card after tapping the ring)
- "share it with people" → chose **share** (score 4) via "o3 show it · blossom the link opens it · stays while the hive holds it · no delete" (read on the card after tapping the ring)
- "keep it forever" → chose **forever** (score 4) via "o4 forever · ant anyone reads it · lasts forever · no delete · you pay" (read on the card after tapping the ring)
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page plus the file picker (after 4 taps to learn the rings), 1180 ms from page open to the row observed stored (of which 266 ms is the instrument waiting for the offered purposes and the pressed one to hold still before reading; 34 ms of browser-context setup before the open is not counted); status shown: "done."; no request left the page during the add
- remove: control "remove" (1 visible) → sentence "The bytes go and the key goes with them. this phone only. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "remove" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {}; on the cards read during the learning taps: {"blossom":1,"ant":1}; front including those cards: {"blossom":1,"ant":1}; in the shared archive below while empty: {"rail":1,"wallet":1}; with the stored row showing: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (in: controls (after a tap); archive); the forever rail declares payer = you

### cypherpunk
- controls readable without a tap: 4 of 4
- "keep this just for now" → chose **now** (score 5) via "now temp readers this-device · lifetime until-this-tab-closes · deletable yes · payer nobody · net none"
- "keep it on this phone" → chose **keep** (score 4) via "keep local readers this-device · lifetime until-you-delete-it · deletable yes · payer nobody · net none"
- "share it with people" → chose **share** (score 4) via "share blossom readers link-holders · lifetime while-the-store-keeps-it · deletable no · payer the-hive · net skaists.buz"
- "keep it forever" → chose **forever** (score 6) via "forever ant readers everyone · lifetime permanent · deletable no · payer you · net autonomi, arbitrum-one"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page plus the file picker, 736 ms from page open to the row observed stored (of which 269 ms is the instrument waiting for the offered purposes and the pressed one to hold still before reading; 36 ms of browser-context setup before the open is not counted); status shown: "written."; no request left the page during the add
- remove: control "DROP" (1 visible) → sentence "The bytes go and the key goes with them. readers: this device Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "DROP ROW" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {"adapter":2,"rail":8,"worker":2,"indexeddb":2,"aes":1,"blossom":3,"ant":3,"autonomi":2,"signer":1,"predicate":1,"keyref":1}; in the shared archive below while empty: {"adapter":3,"rail":7,"worker":1,"indexeddb":1,"aes":1,"wallet":4,"scheme":1,"ciphertext":1,"keyref":1}; with the stored row showing: {"adapter":3,"rail":6,"worker":1,"indexeddb":1,"aes":2,"wallet":4,"scheme":1,"ciphertext":1,"keyref":2}
- funding: own-wallet wording visible true (in: archive); the forever rail declares payer = you

