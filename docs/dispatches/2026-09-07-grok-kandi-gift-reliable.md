# Grok — reliable kandi gifts — 2026-09-07

Seat: Grokbot / Cursor cloud agent (`bc-45eba030-74e5-4366-ab2b-5882c9950654`).
Lane: issue #27 first PR. Branch: `grok/kandi-gift-reliable-2026-09-07`.
**Base SHA:** `832bdf838873bf34cf296901a8925130b951d704` (origin/main at start; not rebased).

Astra keeps `register.js`, `tour.js`, language loader and generated Home. This
lane edits the consumer page, its corpus rows, and kandi tests only.

## Defects confirmed (source, then tests)

1. **Mutable index + unguarded timers — CONFIRMED.** `gift(idx)` captured an
   array index. `giving` was written and never read by the callbacks. Giving A
   twice from `[A,B]` started two timers on index 0; the first splice retired A,
   the second splice retired B, and both exported A.
2. **Animation committed retirement — CONFIRMED.** The last handshake timeout
   pushed a short `given` row and spliced the arm before copy or any deliberate
   handoff. Reduced-motion (`delay=0`) still committed.
3. **Short `given` records — CONFIRMED.** Memory stored `{beads,to,ts}` only.
   The original KND1 could not be reconstructed.
4. **Silent copy/save — CONFIRMED.** `clipboard.writeText` and `save()`
   swallowed failures. `#stringit` and `#rcvgo` cleared input after a write
   that never landed.
5. **Duplicate Keep / paste — CONFIRMED.** Same KND1 appended another left-arm
   copy. Arrival Keep had the same hole.
6. **Stale-tab overwrite — CONFIRMED.** `save()` wrote the in-memory snapshot
   over whatever another tab had stored.
7. **Names vs beads — CONFIRMED.** `NAMERE` was ASCII-only (`Jānis`, Cyrillic
   refused). Word entry `replace(/[^A-Z]/g,'')` deleted letters without saying
   so. Bead alphabet `[0-9A-Z]` was already the protocol; that part was not a
   defect.

Discarded: a separate gift engine per view. Presentation rides `data-reg` on
the same state machine. KND1 was not versioned; Unicode names ride the
existing `maker`/`for` fields. Old readers that still use ASCII `NAMERE` will
refuse those names honestly — that is not a silent reinterpret.

## What this page does now

- Gift identity is `encode(k)` (the KND1 string), plus a generation token on
  every timer. Repeated taps, close, reduced motion, a second target, or a
  piece that left the arm cannot complete a stale operation or retire a
  neighbour.
- Handshake animation only prepares the export. **I handed it over** writes
  the full export onto the memory line, then retires, in one `save()`.
  Clipboard success is the `copied` phase, not completion and not a receive
  receipt. Clipboard rejection leaves selectable text.
- Receive is preview-first (`#rcvgo` = look, `#rcvkeep` = keep). Same KND1 is
  idempotent. Arrival Keep shares that function. Show remains a `#k=` preview
  pointer via `PTR.kandi`.
- `save()` re-reads `bkandi` immediately before write. A valid other-tab
  snapshot merges by piece identity (given/export wins). Unreadable data is
  refused in `#armerr` / `#cerr` and is not overwritten.
- Names accept Unicode letters/marks/digits plus the old punctuation. Bead
  words still require A–Z and name the leftover characters before the input
  is cleared.
- Three presentations on this page: New bee uses shared light reading
  (`data-bee-theme="shared"`); Raver leads with the handshake; Cypherpunk
  states the same limits. One gift function. Disclosure open-state is
  remembered per view. Composer draft, prepared export and language are not
  reset on toggle.

## Tests (ran on this seat)

| File | Receipt |
| --- | --- |
| `e2e/kandi-gift.mjs` | 30 passed, 0 failed — repeated give, cancel, target change, stale complete, clipboard reject, quota on string/complete, preview+keep+duplicate+malformed, merge + refuse stale tabs, Unicode names, bead leftovers, Show preview, view-toggle preserve + one painted phase label |
| `e2e/kandi-views.test.mjs` | 5 passed — shared light New bee, one engine, escrow denied, keyed labels vs corpus, disclosure memory; page-local phase CSS must not set `display` on `[data-reg]` children |
| `e2e/kandi-arms.mjs` | 13 passed — arms/gift/receive laws via finish + keep; handshake does not retire |
| `e2e/kandi-crossing.mjs` | 16 passed — crossing + Show fragment; receive is look-then-keep |
| `e2e/kandi-arrival.mjs` | 10 passed — arrival preview / Keep / mangled |
| `e2e/kandi-thread.mjs` | 11 passed — threading unchanged |
| `e2e/estate-source.mjs` | 11 passed — new keys exist in every docked tongue; English matches the page |
| `e2e/register.test.mjs` | 15 passed — shared loader / theme contract unchanged |

Browser check in this VM (Playwright Chromium, reduced motion): New bee is the shared cream canvas; a `PLUR` piece named `Jānis` / `Анна` stays on the right arm through the handshake; the same export survives Raver and Cypherpunk toggles; **I handed it over** then retires it and keeps the full KND1 on the memory line. First screenshot pass showed all three phase labels stacked — a page-local `display:block` on `.gp b` / `.why` beat `register.js` hide. That rule was removed; only the active view's label paints.

This is a served-page check in this VM, not matriarch acceptance and not a claim the public Pages deploy has moved.

## Astra — CI note

These suites are **not** on `.github/workflows/tests.yml` today (inherited).
Suggested additive wiring, Astra-owned:

- static / Front door: `node --test e2e/kandi-views.test.mjs` beside
  `social-three-view` / `forge-room-views`
- node / Playwright job, after shared Chromium setup: `node kandi-gift.mjs`,
  and the existing `kandi-arms`, `kandi-crossing`, `kandi-arrival`,
  `kandi-thread` if they are to stop being local-only

No `tour.js` / `register.js` cache bump. Loader stays `tour.js?v=40`.

## Remaining limitations

- Clipboard write is still not delivery. There is no mesh, inbox, or remote
  confirm.
- Crossing remains two local handoffs. Not escrow.
- A Show / `#k=` link is a copy. Anyone with the string can Keep a copy.
- Unicode names on current KND1 will be refused by **old** readers that still
  use ASCII `NAMERE`. A versioned payload, if wanted, is a separate follow-up.
  This PR does not reinterpret old strings.
- `localStorage` is this browser, this origin. Another device is another arm.
- `save()` re-reads before write, then `setItem`. Another tab can still write
  in that window (TOCTOU). The race is named in source; it is not closed.
- Machine-drafted corpus cells (7 keys × 28 tongues) are unattested.
- Creative/campaign board assets stay out of this PR.

## Independent review nits (`50c4c697`, session `bc-d507016e`)

Taken in this descendant: leftover-timer guard (`completed` timeouts return;
finish refused until `#giftout` is open with an export); `|` in a name is
refused, not stripped; 650ms delayed cancel / switch / early-finish cases
shipped; crossing "forever" copy pulled back to this-browser; TOCTOU named
instead of claimed closed.

No production box, wallet, DM or public post.
