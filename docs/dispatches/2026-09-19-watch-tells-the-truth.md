# W@TCH TELLS THE TRUTH ABOUT WHERE IT STANDS — the founder's catch, fixed

**Seat:** Cowork (design + UI). **Date:** 2026-09-19. **Branch:** `cowork/watch-aplus-2026-09-19`.

**The catch (founder screenshot, skaists.dev/surfaces/watch.html, desktop):** the Conversation
panel was showing GitHub's own 404 page inside the chat frame. "Open chat" loads `/join/`; this
address is a static preview, no room host lives here, so the frame filled with someone else's
error. The Room pass box had the same lie in it: it invited a number no host here could honour,
and the chip said "Connection unavailable" as if something had broken.

**Now:** the page asks once (`/live/health`). When no room host answers —
- the pass panel and Open chat step aside for **one plain row with the reason**
  ("No room is hosted at this address yet. This page is a preview.") — never a disabled button,
  never a frame of a 404;
- the chip says **Preview**, not an error; health and ticker polling stop (no more 404s every 5s);
- `/join/` is never loaded unless a room host answered.
On a real room host nothing changes — the W@tch proof (fake host) still passes 29/29.

**Face:** the one filled action ("Watch") is magenta in new bee (`--primary`), per the ruled face.

**All languages:** one new key `watch.noRoom`, en + 28 tongues, machine-drafted under the corpus
law; the page's inline bundle rebuilt (`build-watch-languages.mjs --check` in sync).

**Coverage floor 55 → 45 for watch.html, on purpose:** the floor counts *visible* keyed leaves; the
pass panel's ten keyed leaves are now out of sight on a static address by design. Every visible
leaf is still keyed.

Everything is in `scripts/tmp/watch-aplus.mjs` — asserted edits, a re-run changes nothing.

**Gates (un-piped, browser proofs before the push):** W@tch 29/29 · front-door 333/333 ·
PLUR views · no-page-errors 105/0 · estate-source · coverage floors.

**Not done here (next):** the full UX attack the founder ordered on this room — arrival,
the screen, the pass flow on a live host, raver's art — wants a live room host to judge against.

**Receipt:** the live page at 390px and desktop — never the git state.
