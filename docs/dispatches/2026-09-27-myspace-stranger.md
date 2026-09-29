# 2026-09-27 — MY SPACE: the stranger instrument (Cypunk lane, UX measurement)

Seat: Fable 5.1. Founder go: "start the MY SPACE stranger instrument on its own branch". Branch `claude-lovis/funny-pascal-bpv6vu-myspace` from main 7d6808d8. No surface touched; this lane measures.

**2026-09-29 revision.** An independent agent review of the first commit (6bb5c8ec) found that two of the instrument's headline numbers were artefacts of the instrument, not of the page. This dispatch is rewritten around the corrected instrument; the first commit's numbers stay in git and are quoted in §"What the review found" so the correction is visible, not silent.

## The question

Can a stranger complete MY SPACE without learning the storage architecture? `e2e/myspace-stranger.mjs` answers the machine-measurable part with a scripted visitor per register who reads only the words on screen, chooses by plain-language intent, stores a file, then tries to remove it and get it back. It counts every implementation word it had to read. What it cannot measure it names as not measured: task completion rate with people, and comprehension of temporary versus forever. Those are the human layer and stay judgement, reported as judgement.

## Result, branch head over main 7d6808d8 (MY SPACE files unchanged on main since), 390×844, three registers

Three consecutive runs agree byte-for-byte apart from the millisecond figures. Run 7 of 9 is quoted; runs 7, 8 and 9 hash identical once the timings are masked.

| register | purposes offered | wrong choice (of offered) | led nowhere | first file: steps · ms | wire during keep-here add | wire during remove | terms on control (now / forever): lifetime | remove | outcome stated | finality stated (before confirm / after) | recover offered | leak words in front | leak words in archive | own-wallet wording visible | forever payer (declared) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bee | now, keep, share, forever | 0/4 | 0 | 3 · 755 (255 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 1 | 2 | y | you |
| raver | now, keep, share, forever | 0/4 | 0 | 3 · 642 (254 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 0 | 2 | y | you |
| cypherpunk | now, keep, share, forever | 0/4 | 0 | 3 · 720 (258 of it instrument settle) | none | none | y / y | ok | y | y / y | n | 26 (declared voice) | 20 | n | you |

Reading it:

- **Choice: 0 wrong of 12, and 0 "led nowhere".** With whole-word matching and a tie rule (a zero score or a tie is "the words led nowhere", never the first control in the DOM), every intent in every register still lands on the right purpose, with a clear lead (scores 4–8, printed per choice in the receipts). The words that carried it: bee "just for now / keep it here / show the world / keep it forever", raver "just now / keep it / show it / forever", cypherpunk the purpose ids with their declared terms.
- **First file: three presses.** Milliseconds from page open: 642–816 across the nine runs, of which about 255 ms in every run is the instrument itself waiting for every purpose to be offered before it reads the front (see finding 11 below). The page's own share is therefore roughly 390–560 ms, in line with the first commit's 407–530 ms. **No request left the page during a keep-it-here add, and none during the remove**, in any register. After the add the page resets the pressed purpose to the most private one, as its own comment says it will.
- **Terms before the choice:** lifetime and readers are stated on every purpose control in every register before the visitor commits. This is the proxy for "temporary versus forever is stated", not a claim that it was understood.
- **Remove works and says what it did** in all three registers. Finality is now judged twice: the confirmation sentence the visitor reads before pressing ("Nothing about this file will exist anywhere else") states it, and the outcome afterwards ("Gone. …") states it again. Exactly one visible remove control per stored row; it is pressed through playwright's actionability checks, not a programmatic click.
- **Recover does not exist, and the word is on screen anyway.** Nothing offers to bring a removed file back. The tour bar shows a link named "recover" that leads to key recovery. A stranger who has just removed a file and sees "recover" is being told something untrue by juxtaposition. Design seat: either an undo window on removal, or the bar's word changes while a removal was just confirmed.
- **Leakage, corrected.** Fronts: bee 1 ("wallet", in the funding sentence), raver 0, cypherpunk 26 in its declared voice (rail ×8, blossom ×3, ant ×3, adapter/worker/indexeddb/autonomi ×2, aes/signer/predicate/keyref ×1; read with "keep" pressed — the write path changes with the pressed purpose, so the instrument now waits for every purpose to be offered and records the pressed one). **The shared archive below the fronts is not 0 as the first commit claimed: bee and raver 2 each, cypherpunk 20.** For bee and raver the two words are "rails" in the tech note's always-visible summary ("index · rails · identity") and "wallet" in the forever mode button's payer phrase ("You pay for it, from your own wallet." / "you pay. your wallet."). Cypherpunk's archive says its vocabulary out loud in the mode buttons and row terms (rail ×7, wallet ×4, adapter ×3, …). The first commit's 0 came from a selector that read only the archive's two-word heading; see finding 1.
- **Funding: the known mismatch, and where it actually lives.** bee and raver show "you pay, from your own wallet" on the forever control; cypherpunk shows "payer you". Those words are not page copy: `myspace.js` prints the payer the ANT rail DECLARES in its `describe` terms (`myspace-adapter-ant.js`), and the register phrase sets (`myspace.js` ~487–502) map `payer: you` to those sentences, on the front's control and again on the archive's forever mode button. So the wording fix, once the sponsor cap is defined, is a declared-terms change on the rail (payer becomes the sponsor) plus the phrase for that payer, and the page will say it in all three voices without a copy edit. The static tech note at `surfaces/myspace.html` line 442 says the same thing in prose and is the one literal to change.

## What the review found (2026-09-29), and what changed

An independent agent review (code-review, high effort) of commit 6bb5c8ec returned ten findings. Each was checked against the page before acting. Disposition:

1. **Archive leakage read one heading.** `querySelector('main > :not(#eternal)')` returns the first non-front child of `<main>`, the `<h2>the whole space</h2>`, so the archive count was `{}` by construction. Confirmed (main's direct children listed: the h2 is first). Fixed: every child of `main` except the fronts is read, visible text only. Result moved from 0/0/0 to 2/2/20.
2. **Finality was earned by the outcome, not the confirmation.** The old regex matched "Gone." in the post-confirm status, not the pre-confirm sentence, while the dispatch said the sentence states finality. Confirmed. Fixed: `finalityBeforeConfirm` and `finalityAfter` are judged and printed separately; the finality vocabulary gained "nowhere else / anywhere else / no longer / will not exist", which is what the sentence actually says. Both are true in all registers.
3. **Substring counting.** "trail" counted as "rail", "gasp" as "gas", while "ant." at a line end was never counted. Confirmed. Fixed: whole words, singular or plural. Cypherpunk's front stayed at 26 (different composition); the fronts of bee and raver did not change.
4. **Requests during remove were lost.** After the add snapshot, any cross-origin request during remove or recover was filed under the add set and never printed. Confirmed. Fixed: one set per phase (load / read / add / after-add / remove / done); the table gains "wire during remove"; every non-empty phase prints. All empty in all registers.
5. **Remove control not filtered for visibility and pressed programmatically.** Confirmed. Fixed: candidates must have a box on screen, the first is tagged and pressed with `page.click`, and the candidate count is printed (1 per register).
6. **Choice scoring by substring and first-in-DOM on ties.** "know" scored as "now", "anywhere" as "here"; a zero or tied score silently chose the first control. Confirmed. Fixed: whole words; zero or tie is reported as "led nowhere" with the score and the tied purposes; the score prints per choice.
7. **`--reg` as last argument crashed.** Confirmed. Fixed: a missing or flag-shaped value falls back to the default.
8. **Dispatch prose "under 520 ms" against a 530 ms receipt.** Confirmed. This rewrite quotes the measured range and separates the instrument's own settle time.
9. **Status read through `innerText` ignoring `hidden`.** The page clears the text when it hides the element, so no wrong value was printed, but the read was not hidden-aware. Fixed: visible text is only taken from an element that is not `hidden` and has a box on screen (client rects, not `offsetParent`, because the confirmation sheet is `position:fixed`).
10. **Static server and abort route duplicate `e2e/myspace-eternal.test.mjs`.** Accurate; not changed here. Extracting a shared harness helper touches the eternal test, which belongs to its owner, and is not a measurement defect. Left as a named follow-up.
11. **Found while re-running, not by the review: the front's text depends on when it is read.** Rails attach one by one and the pressed purpose follows the first open one, so cypherpunk's write path (and its leak count: 26 vs 28) differed between runs. The instrument now waits until every purpose is offered (5 s cap) plus 250 ms, records the pressed purpose the front was read under, and prints its own settle time beside the first-file milliseconds so the page is not charged for it.

## Two instrument findings from the first commit, still standing

1. **A forced click is not a tap.** The first run selected the wrong orbit in raver and put a request on the wire during what was meant to be a keep-it-here add. The geometry probe showed why: a playwright click at a fixed offset inside the keep ring's hit box (the gesture `e2e/myspace-eternal.test.mjs` uses, `position {5,60}, force`) lands on the next ring out. Real taps on the ring, precise or 12 px off, select the right orbit every time and keep the front and the archive in step. The instrument taps the ring's own point; the product's orbit geometry is sound; the eternal test's gesture is fragile and is left for its owner.
2. **"recover" matched the tour bar.** The first run reported recover as offered in all registers because the bar's key-recovery link matched. The instrument searches the page's own controls only and records the bar link's presence as the finding above.

## Method

`node e2e/myspace-stranger.mjs [--json out] [--reg bee,raver,cypherpunk]`. Localhost http, cold context per register, all cross-origin requests aborted and logged by phase (load / read / add / after-add / remove / done). Purpose chosen by scoring each control's visible words, whole words only, against the intent's plain words minus other intents' strong words; a zero or tied score is "led nowhere"; the chosen control's text and score are printed so a person can judge the match. Visible text means an element that is not hidden and has a box on screen. Playwright 1.62, Chromium 141. Full receipts of run 7 follow.

## Receipts

### bee
- "keep this just for now" → chose **now** (score 4) via "just for now only this phone opens it. gone when you close this tab. stays here"
- "keep it on this phone" → chose **keep** (score 8) via "keep it here only this phone opens it. stays until you remove it. stays here"
- "share it with people" → chose **share** (score 6) via "show the world anyone with the link opens it. stays while the hive keeps it. nobody can delete it. goes out"
- "keep it forever" → chose **forever** (score 4) via "keep it forever anyone can read it. lasts forever. nobody can delete it. you pay, from your own wallet. goes out"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 755 ms from open (of which 255 ms is the instrument waiting for every purpose to be offered before reading); status shown: "Done."; no request left the page during the add
- remove: control "Remove" (1 visible) → sentence "The bytes go and the key goes with them. Only this phone opens it. Nothing about this file will exist anywhere else." (finality stated: true) → confirm "Remove from this phone" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality stated: true); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front (read with purpose "keep" pressed): {"wallet":1}; in the shared archive below: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true; the forever rail declares payer = you

### raver
- "keep this just for now" → chose **now** (score 7) via "just now: this phone only · gone when this tab closes"
- "keep it on this phone" → chose **keep** (score 6) via "keep it: this phone only · stays till you drop it"
- "share it with people" → chose **share** (score 4) via "show it: the link opens it · stays while the hive holds it · no delete"
- "keep it forever" → chose **forever** (score 4) via "forever: anyone reads it · lasts forever · no delete · you pay"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 642 ms from open (of which 254 ms is the instrument waiting for every purpose to be offered before reading); status shown: "done."; no request left the page during the add
- remove: control "remove" (1 visible) → sentence "The bytes go and the key goes with them. this phone only. Nothing about this file will exist anywhere else." (finality stated: true) → confirm "remove" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality stated: true); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front (read with purpose "keep" pressed): {}; in the shared archive below: {"rail":1,"wallet":1}
- funding: own-wallet wording visible true; the forever rail declares payer = you

### cypherpunk
- "keep this just for now" → chose **now** (score 5) via "now temp readers this-device · lifetime until-this-tab-closes · deletable yes · payer nobody · net none"
- "keep it on this phone" → chose **keep** (score 4) via "keep local readers this-device · lifetime until-you-delete-it · deletable yes · payer nobody · net none"
- "share it with people" → chose **share** (score 4) via "share blossom readers link-holders · lifetime while-the-store-keeps-it · deletable no · payer the-hive · net skaists.buz"
- "keep it forever" → chose **forever** (score 6) via "forever ant readers everyone · lifetime permanent · deletable no · payer you · net autonomi, arbitrum-one"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 720 ms from open (of which 258 ms is the instrument waiting for every purpose to be offered before reading); status shown: "written."; no request left the page during the add
- remove: control "DROP" (1 visible) → sentence "The bytes go and the key goes with them. readers: this device Nothing about this file will exist anywhere else." (finality stated: true) → confirm "DROP ROW" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else." (finality stated: true); no request left the page during the remove
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front (read with purpose "keep" pressed): {"adapter":2,"rail":8,"worker":2,"indexeddb":2,"aes":1,"blossom":3,"ant":3,"autonomi":2,"signer":1,"predicate":1,"keyref":1}; in the shared archive below: {"adapter":3,"rail":7,"worker":1,"indexeddb":1,"aes":1,"wallet":4,"scheme":1,"ciphertext":1,"keyref":1}
- funding: own-wallet wording visible false; the forever rail declares payer = you

