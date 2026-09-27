# 2026-09-27 — MY SPACE: the stranger instrument (Cypunk lane, UX measurement)

Seat: Fable 5.1. Founder go: "start the MY SPACE stranger instrument on its own branch". Branch `claude-lovis/funny-pascal-bpv6vu-myspace` from main 7d6808d8. No surface touched; this lane measures.

## The question

Can a stranger complete MY SPACE without learning the storage architecture? `e2e/myspace-stranger.mjs` answers the machine-measurable part with a scripted visitor per register who reads only the words on screen, chooses by plain-language intent, stores a file, then tries to remove it and get it back. It counts every implementation word it had to read. What it cannot measure it names as not measured: task completion rate with people, and comprehension of temporary versus forever. Those are the human layer and stay judgement, reported as judgement.

## Result at main 7d6808d8, 390×844, three registers

| register | purposes offered | wrong choice (of offered) | first file: steps · ms | wire during keep-here add | terms on control (now / forever): lifetime | remove | outcome stated | finality stated | recover offered | leak words in front | own-wallet wording visible | forever payer (declared) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bee | now, keep, share, forever | 0/4 | 3 · 530 | none | y / y | ok | y | y | n | 1 | y | you |
| raver | now, keep, share, forever | 0/4 | 3 · 407 | none | y / y | ok | y | y | n | 0 | y | you |
| cypherpunk | now, keep, share, forever | 0/4 | 3 · 429 | none | y / y | ok | y | y | n | 26 (declared voice) | n | you |

Reading it:

- **Choice: 0 wrong of 12.** In every register the visible words of the four purpose controls led the stranger's four intents to the right purpose. The words that carried it: bee "just for now / keep it here / show the world / keep it forever", raver "just now / keep it / show it / forever", cypherpunk the purpose ids with their declared terms.
- **First file: three presses, under 520 ms from page open**, and **no request left the page during a keep-it-here add** in any register. After the add the page resets the pressed purpose to the most private one, as its own comment says it will.
- **Terms before the choice:** lifetime and readers are stated on every purpose control in every register before the visitor commits. This is the proxy for "temporary versus forever is stated", not a claim that it was understood.
- **Remove works and says what it did** in all three registers: the confirmation sentence states finality ("Nothing about this file will exist anywhere else"), and the outcome is stated afterwards ("Gone. The bytes and the key were both here…").
- **Recover does not exist, and the word is on screen anyway.** Nothing offers to bring a removed file back. The tour bar shows a link named "recover" that leads to key recovery. A stranger who has just removed a file and sees "recover" is being told something untrue by juxtaposition. Design seat: either an undo window on removal, or the bar's word changes while a removal was just confirmed.
- **Leakage:** bee front 1 implementation word ("wallet", in the funding sentence), raver 0, cypherpunk 26 (its declared voice: rail, adapter, indexeddb, blossom, ant, autonomi, signer, predicate, keyref). The shared archive below the fronts: 0 in every register.
- **Funding: the known mismatch, and where it actually lives.** bee and raver show "you pay, from your own wallet" on the forever control; cypherpunk shows "payer you". Those words are not page copy: `myspace.js` prints the payer the ANT rail DECLARES in its `describe` terms (`myspace-adapter-ant.js`), and the register phrase sets map `payer: you` to those sentences. So the wording fix, once the sponsor cap is defined, is a declared-terms change on the rail (payer becomes the sponsor) plus the phrase for that payer, and the page will say it in all three voices without a copy edit. The static tech note at `surfaces/myspace.html` line 442 says the same thing in prose and is the one literal to change.

## Two instrument findings, disclosed

1. **A forced click is not a tap.** The first run selected the wrong orbit in raver and put a request on the wire during what was meant to be a keep-it-here add. The geometry probe showed why: a playwright click at a fixed offset inside the keep ring's hit box (the gesture `e2e/myspace-eternal.test.mjs` uses, `position {5,60}, force`) lands on the next ring out. Real taps on the ring, precise or 12 px off, select the right orbit every time and keep the front and the archive in step. The instrument now taps the ring's own point; the product's orbit geometry is sound; the eternal test's gesture is fragile and is left for its owner.
2. **"recover" matched the tour bar.** The first run reported recover as offered in all registers because the bar's key-recovery link matched. The instrument now searches the page's own controls only and records the bar link's presence as the finding above.

## Method

`node e2e/myspace-stranger.mjs [--json out] [--reg bee,raver,cypherpunk]`. Localhost http, cold context per register, all cross-origin requests aborted and logged by phase (load / add). Purpose chosen by scoring each control's visible words against the intent's plain words minus other intents' strong words; the chosen control's text is printed so a person can judge the match. Playwright 1.62, Chromium 141. Full receipts follow.

## Receipts

### bee
- "keep this just for now" → chose **now** via "just for now only this phone opens it. gone when you close this tab. stays here"
- "keep it on this phone" → chose **keep** via "keep it here only this phone opens it. stays until you remove it. stays here"
- "share it with people" → chose **share** via "show the world anyone with the link opens it. stays while the hive keeps it. nobody can delete it. goes out"
- "keep it forever" → chose **forever** via "keep it forever anyone can read it. lasts forever. nobody can delete it. you pay, from your own wallet. goes out"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 530 ms from open; status shown: "Done."; no request left the page during the add
- remove: control "Remove" → sentence "The bytes go and the key goes with them. Only this phone opens it. Nothing about this file will exist anywhere else." → confirm "Remove from this phone" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else."
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front: {"wallet":1}; in the shared archive below: {}
- funding: own-wallet wording visible true; the forever rail declares payer = you

### raver
- "keep this just for now" → chose **now** via "just now: this phone only · gone when this tab closes"
- "keep it on this phone" → chose **keep** via "keep it: this phone only · stays till you drop it"
- "share it with people" → chose **share** via "show it: the link opens it · stays while the hive holds it · no delete"
- "keep it forever" → chose **forever** via "forever: anyone reads it · lasts forever · no delete · you pay"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 407 ms from open; status shown: "done."; no request left the page during the add
- remove: control "remove" → sentence "The bytes go and the key goes with them. this phone only. Nothing about this file will exist anywhere else." → confirm "remove" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else."
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front: {}; in the shared archive below: {}
- funding: own-wallet wording visible true; the forever rail declares payer = you

### cypherpunk
- "keep this just for now" → chose **now** via "now temp readers this-device · lifetime until-this-tab-closes · deletable yes · payer nobody · net none"
- "keep it on this phone" → chose **keep** via "keep local readers this-device · lifetime until-you-delete-it · deletable yes · payer nobody · net none"
- "share it with people" → chose **share** via "share blossom readers link-holders · lifetime while-the-store-keeps-it · deletable no · payer the-hive · net skaists.buz"
- "keep it forever" → chose **forever** via "forever ant readers everyone · lifetime permanent · deletable no · payer you · net autonomi, arbitrum-one"
- first file: stored under keep (rows: [{"purpose":"keep","scheme":"local"}]; archive pressed after add (the page resets to the most private purpose): now) in 3 presses, 429 ms from open; status shown: "written."; no request left the page during the add
- remove: control "DROP" → sentence "The bytes go and the key goes with them. readers: this device Nothing about this file will exist anywhere else." → confirm "DROP ROW" → outcome "Gone. The bytes and the key were both here, and this file existed nowhere else."
- recover: nothing on screen offers to bring a removed file back; the tour bar shows a link named "recover" that leads to KEY recovery, not file recovery
- leak words in the front: {"adapter":2,"rail":8,"worker":2,"indexeddb":2,"aes":1,"blossom":3,"ant":3,"autonomi":2,"signer":1,"predicate":1,"keyref":1}; in the shared archive below: {}
- funding: own-wallet wording visible false; the forever rail declares payer = you

