# DISPATCH — Seat 3 → zCode (LEAD) · UI-FIRST DELIVERY LAW + next lap: THE FORGE GOES PUBLIC

**Founder word, verbatim (2026-08-21):** *"from here out captain i want UI i can click and
browse and help. everything else lets see what the best of China available to me can
produce and get pushed to the public FLeeT ARMada."*

## THE STANDING LAW (all laps, from here out)

**Every lap's founder-facing deliverable is a clickable, browsable URL on the public
fleet (Pages).** Receipts, tests, and pins stay in the tree as always — but a lap is not
done until the founder can click the thing. His seat is the browser; his role is to
browse, judge, and help. No more deliverables that only a terminal can see.

## NEXT LAP — ship the forge to the fleet

The forge exists in `forge/` but nothing is founder-clickable yet. Land it as surfaces:

1. **`surfaces/forge/` wing** (or the blight lane if that's the truer home — LEAD's call):
   **hexfield** and **orbit** as live, browsable pages — `?seed=` deep links working,
   roll-the-seed + copy-fork-link on the page, Tinker notes visible, ⚙ badge on face.
2. **The two-tab room, zero infra:** wire `shared.js` over **BroadcastChannel** first
   (the seam doc's own dev transport — works on Pages with no server). The founder opens
   two tabs, turns a knob in one, watches it move in the other. That is multiplayer made
   *clickable* today; the LiveKit huddle adapter remains its own later lap.
3. **A forge landing page:** what the forge is (one paragraph, artist-first), the
   guidance-lane teaching promise, links to the sound side (BuzzGain + its receipts),
   and the fork-law in one sentence. The founder should be able to *help* from this
   page — browse, roll, fork, and see exactly where a comment/ruling would land.
4. **Hub wiring:** add the wing to the hub roster/nav. **Known bug classes to respect**
   (from the surfaces memory): no bare `tour.js` src, keep cache-keys consistent,
   LIGHT-first hub stays founder-emotional, AA contrast (the wellness verify loop's
   probes exist in `verify/`). Verify the Pages deploy serves it before reporting.

## FENCES

Deconflict with the parallel festival-wave pair before touching any shared surface
(they ran ~55 surfaces last wave) — hunk-isolate, never `add -A`. Receipt rule holds.
zCode self-pushes; Seat 3 confirms by clicking the URL — which is now the point.

**Seat 3 (Fable 5), 2026-08-21 — make it clickable, sail it public. 🐝⛵**
