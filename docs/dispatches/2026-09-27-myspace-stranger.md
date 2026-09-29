# 2026-09-27 — MY SPACE: the stranger instrument (Cypunk lane, UX measurement)

Seat: Fable 5.1. Founder go: "start the MY SPACE stranger instrument on its own branch". Branch `claude-lovis/funny-pascal-bpv6vu-myspace` from main 7d6808d8. No surface touched; this lane measures.

**2026-09-29 revisions.** Two independent agent reviews (code-review, high effort) of this instrument found headline numbers that were artefacts of the instrument, not of the page: the first review on commit 6bb5c8ec, the second on b6097862. This dispatch is rewritten around the twice-corrected instrument; the earlier numbers stay in git and are quoted below so each correction is visible, not silent.

## The question

Can a stranger complete MY SPACE without learning the storage architecture? `e2e/myspace-stranger.mjs` answers the machine-measurable part with a scripted visitor per register who reads only the words on screen, chooses by plain-language intent, stores a file, then tries to remove it and get it back. It counts every implementation word it had to read. What it cannot measure it names as not measured: task completion rate with people, and comprehension of temporary versus forever. Those are the human layer and stay judgement, reported as judgement.

## Result, branch head over main 7d6808d8 (MY SPACE files unchanged on main since), 390×844, three registers

Runs 10, 11 and 12 on this box. Runs 11 and 12 hash identical with the millisecond figures masked; run 10 differs from them in exactly one recorded fact, the purpose that was pressed when the bee front was read ("now" instead of "keep"), which is the attach-order nondeterminism the instrument now records rather than hides. Run 11 is quoted.

| register | purposes offered | wrong choice (of offered) | led nowhere | first file: steps · ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front | leak words in archive | own-wallet wording visible | forever payer (declared) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bee | now, keep, share, forever | 0/4 | 0 | 3 · 790 (255 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 1 | 2 | y (front, controls, archive) | you |
| raver | now, keep, share, forever | 0/4 | 0 | 3 · 656 (254 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 0 | 2 | y (controls, archive) | you |
| cypherpunk | now, keep, share, forever | 0/4 | 0 | 3 · 714 (255 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 26 (declared voice) | 20 | y (archive) | you |

Reading it:

- **Choice: 0 wrong of 12, and 0 "led nowhere".** With whole-word matching and a tie rule (a zero score or a tie is "the words led nowhere", never the first control in the DOM), every intent in every register lands on the right purpose with a clear lead (scores 4–8, printed per choice in the receipts). The words that carried it: bee "just for now / keep it here / show the world / keep it forever", raver "just now / keep it / show it / forever", cypherpunk the purpose ids with their declared terms.
- **First file: three presses.** Milliseconds from page open across runs 10–12: 656–815, plus one cold first context at 1136; about 255 ms in every run is the instrument waiting for the offered purposes and the pressed one to hold still before it reads the front. The page's own share is therefore roughly 400–560 ms. **No request left the page during a keep-it-here add, none during the remove, and none in the 250 ms after it**, in any register. After the add the page resets the pressed purpose to the most private one, as its own comment says it will.
- **Terms before the choice:** lifetime and readers are stated on every purpose control in every register before the visitor commits. This is the proxy for "temporary versus forever is stated", not a claim that it was understood.
- **Remove works and says what it did** in all three registers. Finality is judged twice and the matching words are printed: the confirmation sentence earns it on "anywhere else" ("Nothing about this file will exist anywhere else"), the outcome on "Gone". Exactly one visible remove control per stored row; it is pressed through playwright's actionability checks, not a programmatic click.
- **Recover does not exist.** Nothing on the page offers to bring a removed file back, and the search now uses the same visibility rule as everything else, so a future position:fixed undo toast would count. **Correction to the first two commits:** the tour bar's link named "recover" (which leads to key recovery) is present in the bar's link strip but is *not* on screen at 390 px without scrolling the bar; the earlier claim that a stranger "sees the word" after removing a file was a presence check, not a visibility check, and is withdrawn. What stands for the design seat: there is no file recovery, and the bar's word "recover" means keys, so if a recovery affordance is ever added the two must not share a name.
- **Leakage.** Fronts: bee 1 ("wallet", in the funding sentence), raver 0, cypherpunk 26 in its declared voice (rail ×8, blossom ×3, ant ×3, adapter/worker/indexeddb/autonomi ×2, aes/signer/predicate/keyref ×1; read with "keep" pressed — the write path changes with the pressed purpose, so the pressed one is recorded). The shared archive below the fronts: bee and raver 2 each ("rails" in the tech note's always-visible summary, "wallet" in the forever mode button's payer phrase), cypherpunk 20 in its own voice (rail ×7, wallet ×4, adapter ×3, …). The first commit's "0 in every register" came from a selector that read only the archive's two-word heading.
- **Funding: the known mismatch is on screen in all three registers, and where it lives.** bee shows "you pay, from your own wallet" on its front and forever control, raver on its forever control, and all three on the archive's forever mode button ("You pay for it, from your own wallet." / "you pay. your wallet." / "payer: you (own wallet)"). **Correction to the previous commit:** cypherpunk was reported "n" because only the front and controls were searched; the archive says it. Those words are not page copy: `myspace.js` prints the payer the ANT rail DECLARES in its `describe` terms (`myspace-adapter-ant.js`), and the register phrase sets (`myspace.js` ~487–502) map `payer: you` to those sentences. So the wording fix, once the sponsor cap is defined, is a declared-terms change on the rail (payer becomes the sponsor) plus the phrase for that payer, and the page will say it in all three voices without a copy edit. The static tech note at `surfaces/myspace.html` line 442 says the same thing in prose and is the one literal to change.

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

## Two instrument findings from the first commit, still standing

1. **A forced click is not a tap.** The first run selected the wrong orbit in raver and put a request on the wire during what was meant to be a keep-it-here add. The geometry probe showed why: a playwright click at a fixed offset inside the keep ring's hit box (the gesture `e2e/myspace-eternal.test.mjs` uses, `position {5,60}, force`) lands on the next ring out. Real taps on the ring, precise or 12 px off, select the right orbit every time and keep the front and the archive in step. The instrument taps the ring's own point; the product's orbit geometry is sound; the eternal test's gesture is fragile and is left for its owner.
2. **"recover" matched the tour bar.** The first run reported recover as offered in all registers because the bar's key-recovery link matched. The instrument searches the page's own controls only and records the bar link's presence and on-screen state separately.

## Method

`node e2e/myspace-stranger.mjs [--json out] [--reg bee,raver,cypherpunk]`. Localhost http, cold context per register, all cross-origin requests aborted and logged by phase (load / read / add / after-add / remove / after-remove / done). Purpose chosen by scoring each control's visible words, whole words only, against the intent's plain words minus other intents' strong words; a zero or tied score is "led nowhere"; the chosen control's text and score are printed so a person can judge the match. Visible text means an element that is not hidden and has a box on screen. Playwright 1.62, Chromium 141. Full receipts of run 11 follow.

## Receipts

### bee
- "keep this just for now" → chose **now** (score 4) via "just for now only this phone opens it. gone when you close this tab. stays here"
- "keep it on this phone" → chose **keep** (score 8) via "keep it here only this phone opens it. stays until you remove it. stays here"
- "share it with people" → chose **share** (score 6) via "show the world anyone with the link opens it. stays while the hive keeps it. nobody can delete it. goes out"
- "keep it forever" → chose **forever** (score 4) via "keep it forever anyone can read it. lasts forever. nobody can delete it. you pay, from your own wallet. goes out"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 790 ms from open (of which 255 ms is the instrument waiting for every purpose to be offered before reading); status shown: "Done."; no request left the page during the add
- remove: control "Remove" (1 visible) → sentence "The bytes go and the key goes with them. Only this phone opens it. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "Remove from this phone" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {"wallet":1}; in the shared archive below: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (in: front, controls, archive); the forever rail declares payer = you

### raver
- "keep this just for now" → chose **now** (score 7) via "just now: this phone only · gone when this tab closes"
- "keep it on this phone" → chose **keep** (score 6) via "keep it: this phone only · stays till you drop it"
- "share it with people" → chose **share** (score 4) via "show it: the link opens it · stays while the hive holds it · no delete"
- "keep it forever" → chose **forever** (score 4) via "forever: anyone reads it · lasts forever · no delete · you pay"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 656 ms from open (of which 256 ms is the instrument waiting for every purpose to be offered before reading); status shown: "done."; no request left the page during the add
- remove: control "remove" (1 visible) → sentence "The bytes go and the key goes with them. this phone only. Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "remove" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {}; in the shared archive below: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true (in: controls, archive); the forever rail declares payer = you

### cypherpunk
- "keep this just for now" → chose **now** (score 5) via "now temp readers this-device · lifetime until-this-tab-closes · deletable yes · payer nobody · net none"
- "keep it on this phone" → chose **keep** (score 4) via "keep local readers this-device · lifetime until-you-delete-it · deletable yes · payer nobody · net none"
- "share it with people" → chose **share** (score 4) via "share blossom readers link-holders · lifetime while-the-store-keeps-it · deletable no · payer the-hive · net skaists.buz"
- "keep it forever" → chose **forever** (score 6) via "forever ant readers everyone · lifetime permanent · deletable no · payer you · net autonomi, arbitrum-one"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 714 ms from open (of which 257 ms is the instrument waiting for every purpose to be offered before reading); status shown: "written."; no request left the page during the add
- remove: control "DROP" (1 visible) → sentence "The bytes go and the key goes with them. readers: this device Nothing about this file will exist anywhere else." (finality word: "anywhere else") → confirm "DROP ROW" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality word: "Gone"); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar carries a link named "recover" that leads to KEY recovery, not file recovery (in the bar's strip but NOT on screen at this width without scrolling the bar)
- leak words in the front (read with purpose "keep" pressed): {"adapter":2,"rail":8,"worker":2,"indexeddb":2,"aes":1,"blossom":3,"ant":3,"autonomi":2,"signer":1,"predicate":1,"keyref":1}; in the shared archive below: {"adapter":3,"rail":7,"worker":1,"indexeddb":1,"aes":1,"wallet":4,"scheme":1,"ciphertext":1,"keyref":1}
- funding: own-wallet wording visible true (in: archive); the forever rail declares payer = you

