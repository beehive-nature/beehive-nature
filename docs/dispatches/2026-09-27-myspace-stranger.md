# 2026-09-27 — MY SPACE: the stranger instrument (Cypunk lane, UX measurement)

Seat: Fable 5.1. Founder go: "start the MY SPACE stranger instrument on its own branch". Branch `claude-lovis/funny-pascal-bpv6vu-myspace` from main 7d6808d8. No surface touched; this lane measures.

**2026-09-29 revisions.** Twenty-six independent agent reviews (code-review, high effort) of this instrument found headline numbers that were artefacts of the instrument, not of the page, and then instrument defects short of that: the first on commit 6bb5c8ec, the second on b6097862, the third on 22ec3fb5, the fourth on 64720c1d, the fifth on 97a2c602, the sixth on e174a934, the seventh on 4fdc2e1d, the eighth on 77227fdd, the ninth on 05c05d55, the tenth on 5bffdae3, the eleventh on 5a197eae, the twelfth on f8610dc1, the thirteenth on 1f92aeb8, the fourteenth on 294c7940, the fifteenth on 54322497, the sixteenth on 3dd18b6f, the seventeenth on 8b0322c5, the eighteenth on 4342ec70, the nineteenth on 9427f6bc, the twentieth on 252cb9f1, the twenty-first on 6160792f, the twenty-second on e9da009b, the twenty-third on f4431760, the twenty-fourth on d0e49613, the twenty-fifth on a40799e3, the twenty-sixth on b03f13d9. This dispatch is rewritten around the corrected instrument; the earlier numbers stay in git and are quoted below so each correction is visible, not silent.

## The question

Can a stranger complete MY SPACE without learning the storage architecture? `e2e/myspace-stranger.mjs` answers the machine-measurable part with a scripted visitor per register who reads only the words on screen, chooses by plain-language intent, stores a file, then tries to remove it and get it back. It counts every implementation word it had to read. What it cannot measure it names as not measured: task completion rate with people, and comprehension of temporary versus forever. Those are the human layer and stay judgement, reported as judgement.

## Result, branch head over main 7d6808d8 (MY SPACE files unchanged on main since), 390×844, three registers

Runs 104–106 on this box (current main merged in) hash identical with the millisecond figures masked, with no instrument notes. Run 105 is quoted.

| register | purposes offered | controls readable without a tap | wrong choice (of offered) | led nowhere | first file: page presses (+ the file picker) · page ms (load + add) · whole run ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime·readers·payer | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front (incl. cards read) | leak words in archive (empty / with the stored row) | own-wallet wording visible | forever payer (declared) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bee | now, keep, share, forever | 4/4 | 0/4 | 0 | 2 (1 confirming the already-pressed purpose) (+ picker) · page 519 (load 301 + the add itself 218) · whole run 815 (instrument 269 settle + 17 reading) | none | none | y·y·n / y·y·y | ok | y | y / y | n | 1 | 2 / 2 | y (controls; archive) | you |
| raver | now, keep, share, forever | 1/4 (3 taps to learn the rest) | 0/4 | 0 | 2 (+ picker) · page 406 (load 290 + the add itself 116) · whole run 1009 (instrument 269 settle + 331 reading) | none | none | y·y·n / y·y·y | ok | y | y / y | n | 4 (4 on the cards) | 2 / 2 | y (controls (after a tap); archive) | you |
| cypherpunk | now, keep, share, forever | 4/4 | 0/4 | 0 | 2 (1 confirming the already-pressed purpose) (+ picker) · page 387 (load 285 + the add itself 102) · whole run 668 (instrument 266 settle + 12 reading) | none | none | y·y·y / y·y·y | ok | y | y / y | n | 35 (declared voice) | 20 / 22 | y (archive) | you |

Reading it:

- **Raver's rings say nothing until tapped. This is the finding the third review surfaced, and the one that matters most for the design seat.** Bee's rows and cypherpunk's table carry their purpose words on the control (4/4 readable without a tap). Raver's four orbits are unlabeled rings; their names and terms exist only as `aria-label` (for a screen reader) and on the card that answers a tap. The first three commits scored raver on the `aria-label` and reported "0 wrong of 4" as if the words were on screen; they were not. The instrument now does what a sighted visitor does: reads the card the pressed ring already shows (1 of 4 for free), taps each other ring and reads its card, counting the taps (3). With that, raver still reaches 0 wrong of 4, but only after three learning taps, and its first-file time carries the instrument's learning of them (whole run 1009 ms against 815 / 668 in run 105; the page's own time, load plus the add itself, is 406 ms against 519 / 387, so the extra is the learning, not the page). Whether three exploratory taps before the first real choice is the intended raver grammar ("tap an orbit · tap the heart" is the front's own hint) or a cost is the design seat's call; the instrument only reports it.
- **Choice: 0 wrong of 12, and 0 "led nowhere".** With whole-word matching and a tie rule (a zero score or a tie is "the words led nowhere", never the first control in the DOM), every intent in every register lands on the right purpose with a clear lead (scores 4–8, printed per choice in the receipts). The words that carried it: bee "just for now / keep it here / show the world / keep it forever", raver's cards "just now / keep it / show it / forever" with their terms, cypherpunk the purpose ids with their declared terms.
- **First file: two presses on the page plus the device's file picker** (plus the three learning taps in raver). In bee and cypherpunk the keep purpose is usually already pressed on arrival (it depends on which rail attaches first), so the first press only confirms it and one press plus the picker would do; raver's first press was real in these runs because the learning taps had moved the pick to another ring (the flag is computed each run, not assumed). The table leads with the page's own time, load plus the add itself (run 105: bee 519, raver 406, cypherpunk 387), and prints the whole run beside it (bee 815, raver 1009, cypherpunk 668; across runs 104–106 bee 812–826, cypherpunk 668–746, raver 1009–1109). Each figure is split in the table: first the page's own load until the fronts are ready in the register (about 280–315 ms), then about 265 ms of the instrument waiting for the offered purposes and the pressed one to hold still, then the instrument's own reading and learning (under 10 ms for bee and cypherpunk, about 320 ms for raver's three learning taps), then the add itself from the purpose press to the stored row (bee 218, raver 116, cypherpunk 102; the press, the add press, the picker and their round-trips are inside it); the few milliseconds left are the instrument's reads between those segments. The clock starts at page open (browser-context setup is timed apart and not counted) and stops the moment the row is observed stored. **No request left the page during a keep-it-here add, none during the remove, and none in the 250 ms after it**, in any register; that covers requests the page makes, requests its workers make, and WebSockets (a socket cannot be aborted from the harness and would print as "ws host"; none opened). After the add the page resets the pressed purpose to the most private one, as its own comment says it will.
- **Terms before the choice:** lifetime and readers are stated on every purpose control (bee, cypherpunk) or on its card (raver) before the visitor commits, in every register; the payer is stated on every forever control and on all four of cypherpunk's (matched on the values the terms take, never on cypherpunk's printed labels). This is the proxy for "temporary versus forever is stated", not a claim that it was understood.
- **Remove works and says what it did** in all three registers. Finality is judged twice and the matching words are printed: the confirmation sentence earns it on "anywhere else" ("Nothing about this file will exist anywhere else"), the outcome on "existed nowhere" ("this file existed nowhere else"); a bare "gone" never counts, because the page's non-final outcome ("Gone from this phone. The copy out there stays where it is.") also begins with it. Exactly one visible remove control per stored row; it is pressed through playwright's actionability checks, not a programmatic click.
- **Recover does not exist.** Nothing on the page offers to bring a removed file back, and the search uses the same visibility rule as everything else, so a future position:fixed undo toast would count. The tour bar's link named "recover" (which leads to key recovery) is present in the bar's link strip but is *not* on screen at 390 px without scrolling the bar (0% of its width lies inside the viewport and the strip); the first two commits' claim that a stranger "sees the word" after removing a file was a presence check, not a visibility check, and is withdrawn. What stands for the design seat: there is no file recovery, and the bar's word "recover" means keys, so if a recovery affordance is ever added the two must not share a name.
- **Leakage.** The vocabulary is the fixed implementation words plus every rail scheme and network the page itself declares at run time, each as one phrase (today temp, local, blossom, skaists.buzz, ant, autonomi, arbitrum-one), so the count does not depend on which rail a row landed on and a new rail is counted the day it attaches. Fronts: bee 1 ("wallet", in the funding sentence), raver 4 (temp, local, blossom, ant: each card names its rail after the purpose, so a visitor who learns the rings reads all four), cypherpunk 35 in its declared voice (rail ×8, blossom ×3, ant ×3, temp+local 5, adapter/worker/indexeddb/autonomi/arbitrum-one/skaists.buzz ×2, aes/signer/predicate/keyref ×1; the write path changes with the pressed purpose, so the pressed one is recorded). The shared archive below the fronts, read empty and again with the stored row showing: bee and raver 2 / 2 ("rails" in the tech note's always-visible summary, "wallet" in the forever mode button's payer phrase; the stored row adds nothing in these registers), cypherpunk 20 / 22 in its own voice (rail ×7, wallet ×4, adapter ×3, …; its row prints its keyref, cipher and `local:` scheme). The first commit's "0 in every register" came from a selector that read only the archive's two-word heading.
- **The page's own refresh can drop a change (a finding the instrument had been working around, named by the thirteenth review).** `refresh()` in `surfaces/myspace.html` returns early while a read is in flight, and nothing re-fires it afterwards, so a mutation that lands during that read (the row after an add, the pick after a press) can leave the fronts' count or pressed state stale until some unrelated change fires. The instrument reads the page's own truth (the archive row, the body state, the index) rather than the fronts' data mirror because of it; for the design seat, the fix is a trailing-edge refresh (mark dirty while pending, run once more when the read returns). Not measured as a rate here; it is a race, seen in the code, not reproduced on this box.
- **Funding: the known mismatch is on screen in all three registers, and where it lives.** bee says "you pay, from your own wallet" on its forever control, raver "you pay" on the forever card after a tap, and all three in the archive (bee's forever mode button "You pay for it, from your own wallet.", raver's "you pay.", and in cypherpunk, which discloses the tech note, the note's own sentence "a file kept forever is paid by you, from your own wallet."). A sentence that says the opposite ("asks your wallet for nothing") is never a hit, so the column can go to "n" once the wording is fixed; the sentence that earned each hit is printed in the receipts. The second commit's "cypherpunk n" searched only the front and controls; the archive says it. The previous commit's "bee: front, controls, archive" counted one sentence twice, since the front contains the controls; the front outside the controls is now tested on its own. Those words are not page copy: `myspace.js` prints the payer the ANT rail DECLARES in its `describe` terms (`myspace-adapter-ant.js`), and the register phrase sets (`myspace.js` ~487–502) map `payer: you` to those sentences. So the wording fix, once the sponsor cap is defined, is a declared-terms change on the rail (payer becomes the sponsor) plus the phrase for that payer, and the page will say it in all three voices without a copy edit. The static tech note at `surfaces/myspace.html` line 442 says the same thing in prose and is the one literal to change.

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

## Sixth review (2026-09-29, on e174a934): ten findings, disposition

1. **The raver bullet quoted timings from a superseded run.** Fixed: the bullet quotes the run the dispatch says it quotes.
2. **The learning loop tapped the ring that was already pressed,** whose card was already on the page, and counted the tap. Fixed: the pressed ring's card is read for free before any tap; raver is 1/4 readable without a tap and learns the other three with three taps, not four.
3. **The pressed ring's card was counted in the front and again among the cards read.** Resolved by 2: only cards reached by a tap are added to the front figure.
4. **`after-add` was a zero-width window,** so a follow-up request to the add would have been filed under the remove. Fixed: 250 ms in `after-add` before the remove begins, mirroring `after-remove`. Empty in all registers.
5. **The raver tap point was derived by hand** from the SVG's box, assuming a square layout. Fixed: the browser maps the ring's own top point through `getScreenCTM`, whatever the layout.
6. **Static server duplication.** Still the named follow-up.
7. **Readers and payer terms were computed but never printed.** Fixed: the table's terms column reads lifetime·readers·payer and the receipts print all three per control. It surfaced one honest "n": cypherpunk's share control says "lifetime while-the-store-keeps-it", which the lifetime vocabulary did not recognise; "lifetime" and "while" are now in it (both are lifetime statements), and every control in every register states lifetime and readers; payer is stated on every forever control and on all of cypherpunk's.
8. **An aborted run printed `undefined` in its leakage receipt.** Fixed: the record starts with every leakage field present.
9. **A non-Error throw printed `undefined`.** Fixed: one error-text helper that handles bare strings.
10. **A remove-vocabulary miss would have read as a product finding.** Fixed: when no control matches, the note prints every rendered control on the row so a reader can tell the two apart.

Results after this round (runs 32–34, identical with timings masked): raver 1/4 readable + 3 taps (was 0/4 + 4); every other measured value unchanged. Run 33 is quoted in the receipts.

## Seventh review (2026-09-29, on 4fdc2e1d): ten findings, disposition

1. **A bare "gone" satisfied finality,** though the page's own non-final outcome begins "Gone from this phone. The copy out there stays where it is." Fixed: "gone" counts last and never when the sentence says a copy stays; "existed nowhere" added. Latent today (a keep row is removed), corrected anyway.
2. **The first-file wait hung on the page's data mirror,** whose refresh debounce can drop a mutation on a slow box. Fixed: the wait is on the page's own truth (a rendered row control, the body's file state, or the mirror, whichever shows first); the mirror is then awaited for the receipt.
3. **The TERMS proxy was tautological for cypherpunk,** whose rows print the label words "readers / lifetime / payer" for every purpose. Fixed: matched on the values a term can take (this-device, link-holders, everyone, until-, while-, permanent, nobody, the-hive, you, pay, wallet), never on the labels; "lifetime" as a word, added in the sixth round, is out again. cypherpunk still states all three on every control, by its values.
4. **For bee and cypherpunk the chosen purpose is already pressed on arrival,** so the first counted press only confirms it. Fixed: recorded and printed ("1 confirming the already-pressed purpose"); the necessary presses in those registers are one plus the picker.
5. **The add press was counted only after the picker event arrived.** Fixed: counted when the press lands.
6. **The page-load handler bypassed the error-text helper.** Fixed.
7. **A flag without a value silently ran the default.** Fixed: exits 2 with the usage line.
8. **The static server was a fourth copy.** Fixed for this file: `e2e/lib/serve.mjs` (`serveTree(root)`) is new and used here; the older harnesses keep their copies until their owners move them, which is what the earlier rounds declined to do on their behalf.
9. **The pressed purpose was read twice** (once for the receipt, once for the free card). Fixed: one read.
10. **The PR description carried first-round numbers.** Regenerated from this dispatch's result table after this round's review.

Results after this round (runs 35–37, identical with timings masked): the press count now says which press only confirmed an already-pressed purpose; every other measured value unchanged. Run 36 is quoted in the receipts.

## Eighth review (2026-09-29, on 77227fdd): eight findings, disposition

1. **"gone counts last" was false:** a regex returns the leftmost match, so "Gone." at the start of the outcome still earned finality, and the seventh round's dispatch prose ("earns it on nowhere else") contradicted its own receipts, which printed "Gone". Fixed: a bare "gone" never counts; the outcome earns finality on "existed nowhere" and the confirmation on "anywhere else", and the receipts now say so.
2. **A card that did not change after a learning tap kept the previous ring's words** and scored them as this ring's. Fixed: the ring's words are marked unknown and it is not scored; the note names it.
3. **The PR description was one round behind the dispatch.** Regenerated from the dispatch's result table at 77227fdd; regenerated again after this round.
4. **The pressed ring's card was counted as front-outside-the-controls and as that ring's own words.** Fixed: the card is excluded from the outside walk.
5. **The new shared server let an encoded `..` escape the tree.** Fixed: the resolved path must stay under the root (proven: `/%2e%2e/%2e%2e/etc/passwd` → 404, the page → 200).
6. **"drop" and "remove" counted as lifetime words;** they state deletability. Fixed.
7. **The run loop and the browser/server close were not under try/finally.** Fixed: nothing is left running whatever throws.
8. **A disabled control could win a choice.** Fixed: disabled or unreadable controls are not scored, and the choice row says when the intent's own control was not usable.

Results after this round (runs 38–40): 39 and 40 identical with timings masked; 38 differs only in bee arriving with "now" pressed, so its keep press was a real press rather than a confirming one — the attach-order nondeterminism the instrument records. Run 39 is quoted in the receipts.

## Ninth review (2026-09-29, on 05c05d55): nine findings, disposition

1. **A failed learning tap aborted the whole register.** Fixed: a tap that fails, or a card that does not answer, leaves that ring unknown and unscored; the run goes on. The orbit scroll has the same 5 s cap as every press.
2. **The first-file figure hid the instrument's reading and learning time inside "page" time.** Fixed: the figure is split into instrument settle, instrument reading/learning, and the add itself (purpose press to row). Raver's extra is the instrument learning three rings (325 ms), not the page: the add itself is 161 ms against bee 211 and cypherpunk 123.
3. **RECOVER searched only direct children of body,** so a nested undo toast would have been missed. Fixed: the whole page but the tour bar.
4. **The teardown wire phase was zero-width.** Fixed: 250 ms in `done`, and the log is copied after the context has closed.
5. **Which bucket a raver rail name landed in (front or cards) depended on which ring was pressed on arrival.** Fixed: the card is never part of the front; every card the visitor read (the pressed ring's and the tapped ones) counts in one bucket. The split is now the same whichever ring was pressed (runs 41 vs 42/43 prove it).
6. **The recover matcher read the accessible name only when the control had no text.** Fixed: both are read, so an icon button named "Undo" counts.
7. **The pressed ring's card words were printed as if on the control.** Fixed: the receipt says "read on the card the pressed ring already showed".
8. **Dead branches** (a disabled winner, an empty option list). Removed; pickByWords owns both cases.
9. **The readability sentence assumed the pressed ring's card had been read for free.** Fixed: it says so only when it was.

Results after this round (runs 41–43): 42 and 43 identical with timings masked; 41 differs only in raver arriving with "now" pressed, so the free card was a different ring's — the leakage figures are the same in all three. Run 42 is quoted in the receipts.

## Tenth review (2026-09-29, on 5bffdae3): ten findings, disposition

1. **The leak vocabulary named two rails (blossom, ant) but not the other two (temp, local), nor the arbitrum network,** so the count depended on which rail a row landed on. Fixed: all four rail names and both networks are in. Raver's cards go from 2 to 4 (temp, local, blossom, ant); cypherpunk's front from 26 to 33 and its archive with the row from 21 to 22 (the row's `local:` scheme).
2. **Every press waited on the page's debounced data mirror alone.** Fixed: the archive's pressed mode button, the control's own pressed or selected state, or the mirror, whichever answers first.
3. **"cannot" in "this cannot reach it" could earn finality** for a sentence that promises nothing. Fixed: "cannot reach" and "not something this page can promise" make a sentence non-final. Latent (a keep row is removed).
4. **The controls' own words were read without the rendered rule.** Fixed: a control with no box shows no words, like every other read.
5. **The stored-row wait matched the same selector as the remove candidates.** Fixed: it waits for a row painted into the archive, the body's file state, or the mirror.
6. **Requests landing in the add or remove bucket after its copy were dropped from every output.** Fixed: the phase advances before the copy, and every phase prints.
7. **The leakage record was built twice.** Fixed: one record, fields assigned.
8. **The older MY SPACE harnesses still carry their own servers** (one with fixed ports and no traversal guard). Not changed here: `myspace-eternal.test.mjs` is a CI-gated test another lane owns; the helper is there for it. Named follow-up, unchanged in kind.
9. **The PR description was behind again.** Regenerated from this run's table after this round.
10. **The shared server was case-sensitive on extensions and 404'd a directory without its slash.** Fixed (proven: `/surfaces` → 200 text/html, `/surfaces/` → 200, traversal → 404).

Results after this round (runs 47–49, identical with timings masked, no notes): only the leakage figures moved, by the wider vocabulary. Run 48 is quoted in the receipts.

## Eleventh review (2026-09-29, on 5a197eae): nine findings, disposition

1. **The instrument never waited for the requested register to be applied** (register.js is loaded asynchronously by the tour bar), so on a slow box the wrong front could be read. Fixed: after the ready wait it waits for `body[data-reg]` to be this register, and the register is part of the settle signature.
2. **The shared server served a directory's index in place of redirecting,** so the page's relative links would resolve one level up. Fixed: 301 to the slash form (proven: `/surfaces` → 301 `/surfaces/`).
3. **The first-file split omitted page open → fronts ready,** so the parts did not sum and the prose attributed the wrong 270 ms to settle. Fixed: load is printed too (bee 277, raver 280, cypherpunk 314), and the prose below says which segment is which.
4. **The remove matcher read rendered text only,** while the recover matcher read the accessible name; an icon button named "Remove" would have read as a product gap. Fixed: matched on the accessible name (words or `aria-label`).
5. **A confirming press is not verifiable through the pick,** which is already the target. Playwright's click checks that the control receives the pointer at the action point, so the press is known to have landed; said so in the code. The raver tap is never a confirming one.
6. **A listen failure hung the server's promise.** Fixed: it rejects.
7. **The recover phrase patterns had no word boundaries.** Fixed.
8. **A stale comment described the old stored-row selector.** Removed.
9. **The traversal guard compared resolved paths, not real ones,** so a symlink out of the tree would have been served. Fixed: the real path must be under the tree's real path (a symlink that stays inside, like a node_modules bin link, is served; one that leaves is a 404).

Results after this round (runs 50–52, identical with timings masked, no notes): no measured value moved; the timing column gained the load segment. Run 51 is quoted in the receipts.

## Twelfth review (2026-09-29, on f8610dc1): eight findings, disposition

1. **After the stored row was seen on the page, the instrument still waited on the debounced mirror,** which can miss the change and never catch up. Fixed: the receipt reads the index itself; the mirror is not waited on. The remove wait likewise takes the page's own truth (row gone, body empty, or the mirror).
2. **The directory redirect dropped the query and re-encoded nothing.** Fixed: the still-encoded path plus its query (proven: `/surfaces?f=abc` → 301 `/surfaces/?f=abc`).
3. **A failed page load was only noted, then waited on for up to 35 s.** Fixed: it ends the register at once, recorded as an aborted run.
4. **An icon-only remove control would have printed as `""`.** Fixed: its accessible name prints when it shows no words.
5. **Some leak words are also plain English** (local, temp, token, scheme, gas). Not changed: they are counted wherever they appear and the receipts print every word with its count, so a reader can tell a rail name from prose; on this page today they appear only as rail and network names. Said so in the code.
6. **The raver tap did not check what was on top at the tap point.** Fixed: `elementFromPoint` must be inside the target ring, else the occluder is named and the ring is left unknown.
7. **A dead alias and a redundant alternative.** Removed.
8. **The follow-up undercounted the harnesses with their own servers.** Four are named now: `myspace-eternal.test.mjs`, `myspace-seam.mjs`, `fleet-bus.mjs`, `intake-daybucket.mjs`.

Results after this round (runs 53–55, identical with timings masked, no notes): no measured value moved. Run 54 is quoted in the receipts.

## Where the reviews stand

Rounds one to ten each changed a measured value or a claim; rounds eleven and twelve changed none (their findings were robustness on paths this page does not take today, and hygiene); round thirteen changed one figure (cypherpunk's front, by the declared network phrases) and added the page finding above; rounds fourteen to twenty-six changed none. Every finding of every round is either fixed or answered above; the one standing follow-up is the four older harnesses' own static servers, which belong to their owners.

## Thirteenth review (2026-09-29, on 1f92aeb8): nine findings, disposition

1. **The remove wait still accepted the mirror's count,** which can read 0 from before the add and would have ended the wait before the delete, reading the outcome too early. Fixed: the page's own truth only (row gone or body empty).
2. **The page defect the instrument had been working around was not named as a finding.** It is now, below: `refresh()` in `surfaces/myspace.html` drops any mutation that lands while a read is in flight, and nothing re-fires it.
3. **The rail and network names were a hand-kept list** that would miss a fifth rail. Fixed: the schemes and networks the page declares at run time (`__eternal.data.rails`) join the vocabulary, each as one whole phrase, printed in the receipts (temp, local, blossom, skaists.buzz, ant, autonomi, arbitrum-one). Cypherpunk's front is 35: the first attempt split "arbitrum-one" and "skaists.buzz" into words and counted "arbitrum" twice (37) and even "one" (40); both corrected before this was committed.
4. **One mirror read was unguarded.** Fixed.
5. **A failed learning tap still counted as a learning tap.** Fixed: only a tap that revealed a card counts; failed taps are counted apart.
6. **The after-remove window was not opened on the failure paths.** Fixed.
7. **`textContent` fallback could return words no visitor read.** Fixed: `innerText` only.
8. **A derived leakage figure was stored three times.** Fixed: two inputs, summed where printed.
9. **A permanent redirect from a throw-away server.** Fixed: 302.

Results after this round (runs 62–64): 62 and 64 identical with timings masked; 63 differs only in cypherpunk arriving with "now" pressed, which swaps one "temp" for one "local" in its write path (35 either way). Run 63 is quoted in the receipts.

## Fourteenth review (2026-09-29, on 294c7940): seven findings, disposition

1. **"Confirming press" and the pressed purpose at read were decided from the mirror** the instrument otherwise distrusts. Fixed: the archive's pressed mode button decides; the mirror is a fallback only. The settle signature is now the page's own state (register, mode buttons and which is pressed) plus the mirror's offered set.
2. **The controls' own words fell back to `textContent`,** which for an SVG ring would count an unrendered `<title>`. Fixed: `innerText` only, like every other read.
3. **The headline first-file figure was mostly instrument.** Fixed: the table leads with the page's own time (load + the add itself: bee 485, raver 409, cypherpunk 460) and prints the whole run with the instrument's share beside it.
4. **The instrument always exited 0.** Fixed: a register without its first file, or an aborted run, sets exit code 1.
5. **A declared phrase ending in a non-word character could never match.** Fixed: the edges are "not a word character" rather than `\b`.
6. **A shadowed variable name.** Fixed.
7. **Three filesystem round-trips per request in the shared server.** Fixed: real path, then read; a directory answers with the redirect from the read's own error.

Results after this round (runs 65–67, identical with timings masked, no notes): no measured value moved; the timing column now leads with the page's own figure. Run 66 is quoted in the receipts.

## Fifteenth review (2026-09-29, on 54322497): nine findings, disposition

1. **The exit code ignored a remove that errored and a ring that could not be learned.** Fixed: both exit 1.
2. **Every request, same-origin included, was paused by the interception,** stretching the page's own timings. Fixed: only requests leaving the origin are intercepted; same-origin requests are never touched. The add's own figure keeps the press, the add press and the picker inside it, and the receipt says so.
3. **A payer value other than nobody / the-hive / you would have read as "not stated"** in cypherpunk's row, so the very fix the dispatch recommends (a sponsor as payer) would have shown as a regression. Fixed: any printed payer value counts.
4. **A declared phrase containing a fixed word was counted twice.** Fixed: declared phrases are counted first, longest first, and every match is blanked out of the text before the fixed words are counted.
5. **The reviewer proposed fixing the page's `refresh()` in this PR.** Not done: this lane is measurement-only by founder order and touches no surface; the finding stands above for the design seat, with the trailing-edge fix spelled out.
6. **The pressed-mode read was copied in three places.** Fixed: one helper.
7. **A `//dir` request would have redirected off the origin.** Fixed: leading slashes are collapsed before the redirect is built.
8. **`--json=file` and `--reg=list` were silently ignored.** Fixed: both forms are accepted.
9. **`myspace-seam.mjs`, the other hand-run harness for this page, kept its own server.** Fixed: it now imports the shared one (a free port instead of the fixed 8897; the same MIME table and guards). The seam gate was run on this box after the change; its result is in the commit message.

Results after this round (runs 68–70, identical with timings masked, no notes; run 69 quoted): no measured value moved. These three runs ran while the seam gate was running on the same box, which is why their page figures sit a little above runs 65–67.

## Sixteenth review (2026-09-29, on 3dd18b6f): eight findings, disposition

1. **The raver card on arrival was attributed to the archive's pressed purpose, but the card renders from the fronts' mirror,** and the two can disagree after a dropped refresh. Fixed: the card is attributed to the mirror's pick, the mirror's pick is part of the settle signature, and a disagreement between the two is noted.
2. **Measurements the instrument itself flagged as unreliable exited 0 and looked like ordinary rows.** Fixed: a page that never became ready, never took the register, or whose offered set was still changing at the cap is marked "unreliable" in the table row and exits 1.
3. **`--json=` with an empty value slipped through.** Fixed: exits 2 like the other missing-value forms.
4. **The press wait still accepted the mirror's pick.** Fixed: the page's own pressed state only.
5. **The header's vocabulary list was stale.** Fixed.
6. **The follow-up undercounted the harnesses with their own server.** Corrected with a count: 184 files under `e2e/` open their own server (`grep -l createServer e2e/*.mjs | wc -l` on this day), not three or twenty.
7. **`arg()` was one of many hand-rolled argv readers.** Fixed for this lane: `e2e/lib/args.mjs` (`argReader(usage)`), used here; the others are their owners'.
8. **The front is walked twice and the card read before each tap.** Not changed: the cost is inside the instrument's own "reading" figure, which the table prints apart from the page's time.

Results after this round (runs 71–73, identical with timings masked, no notes): no measured value moved. Run 72 is quoted in the receipts.

## Seventeenth review (2026-09-29, on 8b0322c5): nine findings, disposition

1. **The row marker and the exit code used different predicates.** Fixed: one `unsound` predicate marks the row and sets the exit code.
2. **Two readers of "visible words" disagreed** (innerText for one front, a text-node walk for another; neither handled screen-reader-only slivers and visibility:hidden the same way). Fixed: one rule for every read — rendered, not hidden or visibility:hidden, not a sub-2 px sr-only sliver, not inside a closed details body. No figure moved on this page.
3. **Two denominators for "offered"** (controls rendered vs purposes the mirror declares). Fixed: the row says when they differ.
4. **The shared server buffered whole files.** Fixed: streamed, with Range honoured (proven: a 10-byte range answers 206 with `bytes 0-9/52063`).
5. **Common asset types missing from the MIME table.** Fixed.
6. **"One argv reader" overstated.** Reworded: an argv reader, used here; the other harnesses keep theirs.
7. **The four rail names were both hard-coded and declared.** Fixed: the page's declarations are the one source for rail names; the fixed list holds implementation words only. No figure moved.
8. **Fixing the page's `refresh()` in a sibling commit.** Declined again: no surface is touched in this lane by founder order; the finding stands above.
9. **The tour-bar probe clamped the link's centre to the viewport edge.** Fixed: the visible fraction of the link inside both the viewport and its scrolling strip is measured and printed; at 390 px it is 0%, so the "not on screen" finding stands and is now a number.

Results after this round (runs 74–76, identical with timings masked, no notes): no measured value moved. Run 75 is quoted in the receipts.

## Eighteenth review (2026-09-29, on 4342ec70): five findings, disposition

1. **A read-stream error in the shared server would have killed the harness process.** Fixed: a stream that fails after the headers went out ends the response; before, it answers 404.
2. **Four reads still bypassed the one visibility rule** (the controls' own words, the card-changed wait, the recover search). Fixed: every read goes through the same rule.
3. **"The words led nowhere" was marked unsound and exited 1,** although it is a measured result. Fixed: it is a measured failure of the page's words, printed as such, and does not exit 1.
4. **Whitespace was normalised twice.** Fixed.
5. **A comment claimed the raver press is never a confirming one,** which depends on ring order. Fixed: the flag is computed, and the comment and dispatch say so.

Results after this round (runs 80–82, identical with timings masked, no notes): no measured value moved. Run 81 is quoted in the receipts. The review's findings have fallen from ten a round to five, all on paths this page does not take today.

## Nineteenth review (2026-09-29, on 9427f6bc): seven findings, disposition

1. **A client that went away mid-body left the file stream's descriptor open.** Fixed: `pipeline`, which destroys the source on either side closing, replaces the hand-rolled pipe and error handler.
2. **The press wait still accepted the front control's own pressed attribute,** which is rendered from the mirror. Fixed: the archive's pressed mode button alone; and a file stored under a purpose other than the pressed one is a hard error, never recorded silently.
3. **A page whose words led nowhere printed "FAILED" in the table.** Fixed: the cell says "no file:" with the measured reason; an instrument failure says so.
4. **The shared argv reader exited the process from inside a helper.** Fixed: it throws a `UsageError`; the script exits 2 before anything is open.
5. **Three copies of the visibility evaluator.** Fixed: one page-side reader for all three shapes, reused by the card-changed wait.
6. **The seam gate's on-box test matched a URL prefix without the slash,** so a port that merely begins with the server's digits would have passed as on-box now that the port is free. Fixed: the origin plus a slash. The gate was re-run after the change; its result is in the commit message.
7. **The tour-bar probe ignored the strip's fade.** Fixed: the masked pixels at the strip's edge are not readable and are subtracted from the visible fraction (still 0% for the "recover" link at 390 px).

Results after this round (runs 83–85, identical with timings masked, no notes): no measured value moved. Run 84 is quoted in the receipts (run with the seam gate busy on the same box, hence the slightly higher page figures).

## Twentieth review (2026-09-29, on 252cb9f1): six findings, disposition

1. **The own-wallet test matched negated sentences** ("asks your wallet for nothing"), so the column could never go to "n" after the sponsored-payer fix. Fixed: a hit is a sentence that says the visitor pays and carries no negation, and the sentence that earned it is printed (bee: "you pay, from your own wallet."; raver: "you pay"; cypherpunk: the tech note's "a file kept forever is paid by you, from your own wallet.", visible because cypherpunk discloses the tech note).
2. **The shared server's 404 fallback after a stream error was unreachable** (the headers had already gone out), so a file removed under the server answered a 200 status line and a reset. Fixed: the file is opened first and its size read from that handle, so the headers and the body come from one snapshot; a failure after the headers destroys the socket, which a browser reports as a failed load, never as a good 200.
3. **A process-wide exception handler was used to catch two flag reads,** changing every other uncaught error's exit code. Fixed: the two reads sit in one try/catch; no global handler.
4. **Unsoundness was inferred from note wording.** Fixed: recorded as data where it is detected; the row marker, the receipts' own "unsound" line and the exit code read that record.
5. **`--reg constructor` passed validation.** Fixed: own keys only.
6. **Content-Length came from a stat taken before the stream.** Resolved by 2.

Results after this round (runs 86–88, identical with timings masked, no notes): no measured value moved. Run 87 is quoted in the receipts.

## Twenty-first review (2026-09-29, on 6160792f): six findings, disposition

1. **Two failure paths (an add that did not land, a remove that errored) marked the row unsound without recording why.** Fixed: both record their reason; the marker, the receipts and the exit code read that record alone.
2. **The own-wallet negation rejected any sentence containing "no" or "not".** Fixed: the negation must be about the paying itself ("pays nothing", "wallet for nothing", "no wallet", "never asks"); "you pay, not from ours" still says you pay.
3. **The full-file body was not bounded to the size the header promised.** Fixed: the stream ends at that size.
4. **Request interception does not see WebSockets or a worker's own requests,** so "no request left the page" was narrower than it read. Fixed: sockets and every context-level request are logged under the phase too (a socket cannot be aborted from here; it would print as "ws host"). None opened in any register: the "none" columns now cover sockets and workers as well.
5. **An empty positional value (`--reg ""`) was taken as a value.** Fixed: a missing value, same as `--reg=`.
6. **The directory answer and the 404 were written out several times; the redirect promised "never cached" but set no header.** Fixed: one `notFound`, one `directory` (with `Cache-Control: no-store`), and `send` is `pipeline` alone.

Results after this round (runs 89–91, identical with timings masked, no notes): no measured value moved. Run 90 is quoted in the receipts.

## Twenty-second review (2026-09-29, on e9da009b): nine findings, disposition

1. **The stored-row wait still accepted the mirror's count,** which can arrive a few milliseconds before the row is painted, so the archive could have been read "with the row showing" while it was still empty. Fixed: the page's own truth only (a row painted into the archive, or the body's file state).
2. **The receipts printed a measured "led nowhere" as FAILED.** Fixed: "no file, measured:" with the reason; an instrument failure says so.
3. **The remove control's printed words bypassed the visibility rule.** Fixed: the one rule, or the accessible name for an icon.
4. **An unknown flag was silently ignored.** Fixed: the reader knows the script's flags and refuses any other (`--regs` → usage, exit 2).
5. **"payer undefined" would have counted as a stated payer.** Fixed: an empty value (undefined, null, none) is not a value.
6. **The own-wallet negation missed common shapes** ("nothing leaves your wallet", "you do not pay"). Fixed: a negating word within four words of "pay" or "wallet" in the same sentence; the two shapes this rule gets wrong are named in the code, and the sentence that earned a hit is printed so a reader can judge.
7. **A throw between open and send leaked the file handle.** Fixed: closed on every path that does not hand it to a stream.
8. **The header still described the rail names as part of the fixed list.** Fixed.
9. **Duplicated comments.** Removed.

Results after this round (runs 92–94, identical with timings masked, no notes): no measured value moved. Run 93 is quoted in the receipts.

## Twenty-third review (2026-09-29, on f4431760): nine findings, disposition

1. **The negation window could not match contractions** ("you don't pay"). Fixed, and proven on six sentence shapes.
2. **Stray positionals, repeated flags and a bare `--` slipped past the argv reader.** Fixed: the reader is `node:util` `parseArgs` in strict mode with no positionals, plus the empty-value and repeated-flag refusals; proven on six invocations.
3. **The receipt's index read is the page's own `loadRows`, which would migrate a legacy row.** Answered, not changed: the context is always cold (one file, written by this run), so there is nothing for it to migrate and it writes nothing; said so in the code. A read-only export would be a surface change.
4. **Quoted control text was cut mid-word** (`skaists.buz`). Fixed: cut at a word boundary and marked; the receipts now quote `skaists.buzz`.
5. **The pressed-mode helper kept a dead mirror fallback.** Removed.
6. **Every cross-origin request was logged twice** (route and context). Fixed: the route only aborts; the context event is the one logger; sockets apart.
7. **A hand-rolled parser where `parseArgs` exists.** Resolved by 2.
8. **Fixing the page's `refresh()` here.** Declined again; the lane touches no surface and the finding stands above for the design seat.
9. **A HEAD request read the whole file.** Fixed: the headers, no body read (proven: HEAD → 200, length 52063, 0 bytes).

Results after this round (runs 95–97, identical with timings masked, no notes): no measured value moved. Run 96 is quoted in the receipts.

## Twenty-fourth review (2026-09-29, on d0e49613): eight findings, disposition

1. **The one visibility rule joined text from neighbouring elements with a space**, so a sentence could run from one control into the next and a "no" in a sibling element could negate, or a neighbouring "wallet" could earn, an own-wallet hit. Fixed: text from different blocks (or across a `<br>`) is joined by a line break, which the sentence splitter already honours; the receipts print that break as " / ", so a quoted control now shows where one element ends and the next begins ("keep it forever / anyone can read it. …"). No measured value moved.
2. **Every server fault was a 404.** Fixed: a missing path (ENOENT, ENOTDIR, a path that does not decode) is 404; any other fault is 500 and written to stderr (proven with a socket in the tree: open fails ENXIO → 500 "err", stderr "serve: ENXIO").
3. **The seam gate's `finally` skipped the server's close when the browser's close rejected**, so the gate could never exit. Fixed: the browser close is caught, the server close always runs; the gate re-run after the change: 136 passed, 0 failed.
4. **The "payer" lookahead could not exclude a dash or a dot** (`\b` after a non-word character). Fixed and proven: "payer —", "payer -", "payer ·", "payer undefined/none/null" are not a stated payer; "payer you" is. Latent (the page prints "payer nobody" / "payer you" today).
5. **An empty file's stream was bounded to one byte.** Fixed: a 0-byte file is answered with the headers alone (proven: GET and HEAD → 200, length 0, body 0).
6. **Any method was served like GET.** Fixed: only GET and HEAD are served; anything else is 405 with `Allow: GET, HEAD` and a stderr line (proven on POST and DELETE).
7. **A stale comment on the stored-row wait still named the mirror's count as a signal.** Deleted.
8. **Fixing the page's `refresh()` here.** Declined again; the lane touches no surface and the finding stands above for the design seat.

Results after this round (runs 98–100, identical with timings masked, no notes): no measured value moved. Run 99 is quoted in the receipts.

## Twenty-fifth review (2026-09-29, on a40799e3): nine findings, disposition

1. **A path with an encoded NUL was a 500 and a stderr line**, not a 404. Fixed: no path in the tree has a NUL, so it is 404 (proven: `GET /surfaces/%00` → 404, nothing on stderr).
2. **A read fault after the headers was swallowed.** Fixed: the pipeline's error is written to stderr unless it is the client leaving (premature close, reset, broken pipe).
3. **A body that came up short of the promised length left the socket open**, so a client waited on keep-alive instead of seeing a failed load. Fixed: the body is counted against the promised length and a short one is an error, which destroys the socket (proven end to end on this box: a 64 MiB file truncated to 1000 bytes after the headers → stderr "serve: ESHORT after the headers", the client's read fails).
4. **Fixing the page's `refresh()` here.** Declined again; the lane touches no surface and the finding stands above for the design seat.
5. **Two definitions of "a request that left the server"** (the seam gate's prefix test, the stranger's origin test) that classified `blob:` and `data:` URLs differently. Fixed: `offBox(url, base)` is exported by the server and used by both (a `blob:` URL of the server's origin stays on the box; `data:`, `about:` and an unparseable URL count as left); the seam gate re-run: 136 passed, 0 failed.
6. **The `aria` field was collected and never read**, under a comment that promised a screen-reader measurement. Removed, with the comment saying why aria-label is not scored.
7. **The LEAK comment still claimed the rail and network names were in the fixed list.** Rewritten to say they come from the page's declarations only.
8. **The `innerText` guard was a second "has words" rule beside the one visibility rule.** Removed; `wordsIn` reads every control.
9. **A leftover comment fragment on the `line` helper.** Deleted.

The dispatch patch for the twenty-fourth round dropped the result table's header and separator rows (a line-range slip in the patch script; the rows themselves were right), and the twenty-fifth round's patch then failed on that anchor, so ed45cb6b carries the twenty-fifth round's code without its dispatch; both are put right in this commit, and the table is checked for its header from now on.

Results after this round (runs 101–103, identical with timings masked, no notes): no measured value moved. Run 102 is quoted in the receipts.

## Twenty-sixth review (2026-09-29, on b03f13d9): seven findings, disposition

1. **The seam gate's hermetic abort route had its own "left the box" rule** (a regex letting any 127.0.0.1 port through) beside the shared `offBox` its logger uses, so a request to another local port would land while being counted as off-box. Fixed: the abort route uses the shared rule less the mocked hive; the gate re-run on the merged tree: 136 passed, 0 failed.
2. **The own-wallet "where" label said "controls (after a tap)" whenever any control needed a tap**, even if the sentence sat on the card already showing. Fixed: the label comes from the control whose words hold the sentence (tapped / card already showing / the control itself). Raver's label is unchanged today (its forever card is learned by a tap, the arrival ring being "now").
3. **`close()` waited for every connection to end**, so a client's paused body could hold a gate open after a swallowed browser close. Fixed: the listener is closed and open connections are cut (proven: a keep-alive connection left open, `close()` resolves at once).
4. **The PR body quoted an older run than the dispatch it names as its source.** Regenerated from this dispatch's table after this push.
5. **`wordsIn` forced a style read per text node and an ancestor walk per node.** Memoised per element for one call; same rule, fewer forced reads. The reading segment is unchanged within its run-to-run spread.
6. **`--reg bee,bee` ran one register twice.** Refused with exit 2, like an unknown name (proven).
7. **The tour-bar fade regex was written twice.** Bound once.

Main moved by five merges since this branch's base (#267, #247, #226, #250, #230); none touches the MY SPACE files, `e2e/lib/` or the two gates, and current main is merged into the branch (7f32dd78) so the runs below are on that tree.

Results after this round (runs 104–106 on the merged tree, identical with timings masked, no notes): no measured value moved; the masked receipts equal run 102's apart from the revision line. Run 105 is quoted in the receipts.

## Two instrument findings from the first commit, still standing

1. **A forced click is not a tap.** The first run selected the wrong orbit in raver and put a request on the wire during what was meant to be a keep-it-here add. The geometry probe showed why: a playwright click at a fixed offset inside the keep ring's hit box (the gesture `e2e/myspace-eternal.test.mjs` uses, `position {5,60}, force`) lands on the next ring out. Real taps on the ring, precise or 12 px off, select the right orbit every time and keep the front and the archive in step. The instrument taps the ring's own point; the product's orbit geometry is sound; the eternal test's gesture is fragile and is left for its owner.
2. **"recover" matched the tour bar.** The first run reported recover as offered in all registers because the bar's key-recovery link matched. The instrument searches the page's own controls only and records the bar link's presence and on-screen state separately.

## Method

`node e2e/myspace-stranger.mjs [--json out] [--reg bee,raver,cypherpunk]`. Localhost http, cold context per register, all cross-origin requests aborted and logged by phase (load / read / add / after-add / remove / after-remove / done). Purpose chosen by scoring each control's own visible words (or, for a control that shows none, the card that answers a tap on it) against the intent's plain words minus other intents' strong words, whole words only; a zero or tied score is "led nowhere"; the chosen text and score are printed so a person can judge the match. Visible text means an element that is not hidden and is rendered (has a box); rendered means on the page, not in view without scrolling, and only the tour-bar link is tested for being in view. Playwright 1.62, Chromium 141. Full receipts of run 105 follow.

## Receipts

### bee
- controls readable without a tap: 4 of 4
- terms on the now control before the choice: lifetime stated, readers stated, payer not stated
- terms on the keep control before the choice: lifetime stated, readers stated, payer not stated
- terms on the share control before the choice: lifetime stated, readers stated, payer not stated
- terms on the forever control before the choice: lifetime stated, readers stated, payer stated
- "keep this just for now" → chose **now** (score 4) via "just for now / only this phone opens it. gone when you close this tab. / stays here"
- "keep it on this phone" → chose **keep** (score 8) via "keep it here / only this phone opens it. stays until you remove it. / stays here"
- "share it with people" → chose **share** (score 6) via "show the world / anyone with the link opens it. stays while the hive keeps it. nobody can delete it. / goes out"
- "keep it forever" → chose **forever** (score 4) via "keep it forever / anyone can read it. lasts forever. nobody can delete it. you pay, from your own wallet. / goes out"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page (the first only confirmed keep, already pressed on arrival) plus the file picker, 815 ms from page open to the row observed stored: 301 ms until the fronts were ready in this register, 269 ms of the instrument waiting for the offered purposes and the pressed one to hold still, 17 ms of the instrument reading the page and learning the controls, 218 ms for the add itself from the purpose press to the row (the press, the add press, the picker and their round-trips through the harness are inside it), and the rest between those (50 ms of browser-context setup before the open is not counted); status shown: "Done."; no request left the page during the add
- remove: control "Remove" (1 visible) → sentence "The bytes go and the key goes with them. Only this phone opens it. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "Remove from this phone" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "existed nowhere"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar; 0% of its width inside the viewport and the strip)
- leak words in the front (read with purpose "keep" pressed): {"wallet":1}; rail and network words the page declared and that joined the vocabulary: temp, local, blossom, skaists.buzz, ant, autonomi, arbitrum-one; in the shared archive below while empty: {"rail":1,"wallet":1}; with the stored row showing: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (controls: "you pay, from your own wallet."; archive: "You pay for it, from your own wallet."); the forever rail declares payer = you

### raver
- controls readable without a tap: 1 of 4 (the pressed ring's card was already on the page); 3 carry no words of their own and were learned by tapping each and reading the card
- terms on the now control before the choice: lifetime stated, readers stated, payer not stated
- terms on the keep control before the choice: lifetime stated, readers stated, payer not stated
- terms on the share control before the choice: lifetime stated, readers stated, payer not stated
- terms on the forever control before the choice: lifetime stated, readers stated, payer stated
- "keep this just for now" → chose **now** (score 7) via "o1 / just now · temp / this phone only · gone when this tab closes" (read on the card after tapping the ring)
- "keep it on this phone" → chose **keep** (score 6) via "o2 / keep it · local / this phone only · stays till you drop it" (read on the card the pressed ring already showed)
- "share it with people" → chose **share** (score 4) via "o3 / show it · blossom / the link opens it · stays while the hive holds it · no delete" (read on the card after tapping the ring)
- "keep it forever" → chose **forever** (score 4) via "o4 / forever · ant / anyone reads it · lasts forever · no delete · you pay" (read on the card after tapping the ring)
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page plus the file picker (after 3 taps to learn the rings), 1009 ms from page open to the row observed stored: 290 ms until the fronts were ready in this register, 269 ms of the instrument waiting for the offered purposes and the pressed one to hold still, 331 ms of the instrument reading the page and learning the controls, 116 ms for the add itself from the purpose press to the row (the press, the add press, the picker and their round-trips through the harness are inside it), and the rest between those (34 ms of browser-context setup before the open is not counted); status shown: "done."; no request left the page during the add
- remove: control "remove" (1 visible) → sentence "The bytes go and the key goes with them. this phone only. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "remove" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "existed nowhere"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar; 0% of its width inside the viewport and the strip)
- leak words in the front (read with purpose "keep" pressed): {}; on the cards the visitor read (the pressed ring's and the ones reached by a tap): {"blossom":1,"local":1,"temp":1,"ant":1}; rail and network words the page declared and that joined the vocabulary: temp, local, blossom, skaists.buzz, ant, autonomi, arbitrum-one; in the shared archive below while empty: {"rail":1,"wallet":1}; with the stored row showing: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (controls (after a tap): "you pay"; archive: "you pay."); the forever rail declares payer = you

### cypherpunk
- controls readable without a tap: 4 of 4
- terms on the now control before the choice: lifetime stated, readers stated, payer stated
- terms on the keep control before the choice: lifetime stated, readers stated, payer stated
- terms on the share control before the choice: lifetime stated, readers stated, payer stated
- terms on the forever control before the choice: lifetime stated, readers stated, payer stated
- "keep this just for now" → chose **now** (score 5) via "now / temp / readers this-device · lifetime until-this-tab-closes · deletable yes · payer nobody · net none"
- "keep it on this phone" → chose **keep** (score 4) via "keep / local / readers this-device · lifetime until-you-delete-it · deletable yes · payer nobody · net none"
- "share it with people" → chose **share** (score 4) via "share / blossom / readers link-holders · lifetime while-the-store-keeps-it · deletable no · payer the-hive · net skaists.buzz"
- "keep it forever" → chose **forever** (score 6) via "forever / ant / readers everyone · lifetime permanent · deletable no · payer you · net autonomi, arbitrum-one"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 2 presses on the page (the first only confirmed keep, already pressed on arrival) plus the file picker, 668 ms from page open to the row observed stored: 285 ms until the fronts were ready in this register, 266 ms of the instrument waiting for the offered purposes and the pressed one to hold still, 12 ms of the instrument reading the page and learning the controls, 102 ms for the add itself from the purpose press to the row (the press, the add press, the picker and their round-trips through the harness are inside it), and the rest between those (33 ms of browser-context setup before the open is not counted); status shown: "written."; no request left the page during the add
- remove: control "DROP" (1 visible) → sentence "The bytes go and the key goes with them. readers: this device Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "DROP ROW" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "existed nowhere"); no request left the page during the remove
- recover: nothing rendered on the page offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar; 0% of its width inside the viewport and the strip)
- leak words in the front (read with purpose "keep" pressed): {"skaists.buzz":2,"arbitrum-one":2,"autonomi":2,"blossom":3,"local":3,"temp":2,"ant":3,"adapter":2,"rail":8,"worker":2,"indexeddb":2,"aes":1,"signer":1,"predicate":1,"keyref":1}; rail and network words the page declared and that joined the vocabulary: temp, local, blossom, skaists.buzz, ant, autonomi, arbitrum-one; in the shared archive below while empty: {"adapter":3,"rail":7,"worker":1,"indexeddb":1,"aes":1,"wallet":4,"scheme":1,"ciphertext":1,"keyref":1}; with the stored row showing: {"local":1,"adapter":3,"rail":6,"worker":1,"indexeddb":1,"aes":2,"wallet":4,"scheme":1,"ciphertext":1,"keyref":2}
- funding: own-wallet wording visible true (archive: "a file kept forever is paid by you, from your own wallet."); the forever rail declares payer = you

