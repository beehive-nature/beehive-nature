# DISPATCH — Seat 3 → zCode (LEAD) · NAV SWEEP + LIVEKIT GO · 2026-08-21

**Founder word (2026-08-21):** *"make sure all these ships/dapps/surfaces make their way
to the hub and menu tree in all the appropriate places"* — and, mid-watch: *"the LiveKit
huddle adapter — same room, real rooms, humans + bAiGenTs across [the world] — to zcode."*
Two tasks, one lap each (LEAD may land them in one session as separate commits, per the
established pattern).

## TASK 1 — NAV SWEEP (Seat 3 audited 2026-08-21; gaps named, verify before wiring)

The menu tree is **`surfaces/tour.js`** — its roster array `L` draws the footer strip on
every ship. Seat-3 audit findings:

| ship | hub card (index.html) | tour.js roster |
|---|---|---|
| forge wing (landing/hexfield/orbit/room) | ✅ present | ❌ **ABSENT** |
| kandi (festival wave, peer's ship) | ✅ present (×2) | ❌ **ABSENT** |
| listening / festival / buzz-studio / studio / organ / museum | ✅ | ✅ |

Orders:
1. **Add `forge` to the tour.js roster** in the section that reads truest (it sits with
   studio/organ/listening as a creation ship). Entry points at `forge/` (the landing);
   the landing carries its own sub-links (hexfield/orbit/room) — sub-pages don't clutter
   the strip, same pattern as other wings.
2. **`kandi` is the parallel pair's ship** — wire the nav entry (nav is shared infra,
   not their file), but leave `kandi.html` itself untouched and note the addition in the
   commit message so the peer sees it. If their wave's conventions say kandi is
   deliberately hub-only, stand down on it and say so in the receipt.
3. **Sweep the fLeeT index itself** (`blight/index.html` — the ARMada roster page) and
   any other roster-ish surfaces (gallery/explore/catalog) for whichever of the new
   ships belong there by each page's own admission rule. Add where they belong; receipt
   where they don't and why.
4. **Known bug classes bind:** never a bare `tour.js` src; **cache-key discipline** — if
   the strip's markup changes, bump `?v=` consistently everywhere it's referenced (skew
   is a landed bug class). Estate-review + university-smoke re-run; bump tree-tracking
   assertions honestly as before. Pages-verify before reporting.

## TASK 2 — LIVEKIT HUDDLE ADAPTER (GO)

The seam doc's contract, made real: wrap the LiveKit data channel into
`{send(bytes)} → sharedPiece.receive(bytes)` (~30 lines per the seam), against **the
LiveKit venue the estate already runs** (broom-agent lane — reuse it, don't stand up a
second venue). Deliverable per the UI-FIRST law: **a clickable room the founder can
join** — same `room.html` experience but across machines, humans + bAiGenTs as ordinary
participants. Honest boundary if venue reachability from Pages needs infra the founder
must touch (keys/hosting): deliver the adapter + a local-venue receipt, and hand the
founder ONE script line for the deployment act, per the §4a box-script law — never a raw
command chain.

## FENCES

Deconflict with the festival pair on every shared file (tour.js especially — hunk-isolate,
check their in-flight state first). Receipt rule. ⚙ badges. zCode self-pushes; Seat 3 and
the founder confirm by clicking.

**Seat 3 (Fable 5), 2026-08-21 — wire the strip, open the real room. ⛵🐝**

---
## FOUNDER GO + SEAT 3 LANDING NOTE — 2026-08-22

Founder word tonight, verbatim: *"lets see what lovely China has offered as their best
with zCode and have them build it out."* Seat 3 verified the forge on the bench: all
four ships parse (room.html's top-level await is lawful module code — the first probe
was non-module and wrong, per the broken-probe law), the jsDelivr Yjs dependency is
DISCLOSED, PINNED, Gate-BS-1-cited, and fails declared with a local fallback. The
forge passes the gate. **Both tasks above are GO** — and the nav sweep now also covers
the eight-door family (movement artist rename + the four new doors, `66b8a1e`) and the
hub's homeostasis pass (READ redistributed 17→10, sovereignty-explorer docked in KEYS,
counts at 57=57). The WELLness organ card is a NAMED ABSENCE: no citable Pages URL
exists in this tree — founder supplies it, then it docks in one line.
