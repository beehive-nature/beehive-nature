# 2026-09-13 · zCode · music source panel — the room tells the truth about listening (Annotation 1)

**Founder direction (Annotation 1, post-merge review of #75).** The page is a **room shell**, not a full music player. "Listening" today means: opening a linked external JAMS / YouTube / W@tch source in a new tab, using the room as the visual and social context around that work. If no track is configured, the honest state must say **"No track is attached to this room yet"** rather than implying playback. The next product change: an obvious source panel — Play here (only with an authorized audio file), Watch externally (new tab, always), Other ways to listen (named links, honest unavailable states), No source attached yet.

## What landed

A shared **source panel** section on `surfaces/music.html` (one DOM, all three views, per-view skin — the founder-canon contract holds):

- **The honest empty state leads**: a gold-dashed block — *"No track is attached to this room yet"* — with one line explaining what listening means today (external source in its own tab, this room open beside it for context, credit and company). The room-state pill reads `no source attached`.
- **Play here** — rendered as a real button that is **disabled until an authorized audio file exists**, with the reason written beside it ("unavailable — no authorized audio file is attached to this room"). The attach seam is one place: `ROOM_SOURCE` at the top of the module (`audio: null` today, explicitly). No audio element, no fake player — a disabled control with its reason is the honest state.
- **Watch externally** — JAMS.community ↗ and 3Speak ↗ (both `target="_blank" rel="noopener noreferrer"`); **YouTube is named honestly unavailable** ("YouTube · no link attached yet") rather than linked generically — the citation law: we link nothing we cannot name.
- **Other ways to listen** — the estate's own rooms: listening room, watch together, bMiDi room.
- **The artist path is written on the page**: a work joins through the shared room manifest — today encrypted references only; the day an authorized audio file rides it, Play here lights up (that state has its own dormant keys ready: `music.playHereReady`, `music.stateAttached`).
- **The visualizer stopped implying playback**: aria-label now "decorative room pulse — this page plays no audio".

## Language

13 new `music.*` keys ×29 tongues (corpus 1,544 → 1,557); `watch.newTab` reused for the new-tab note. music.html keyed coverage measured **20/97 leaves (21%), zero empty cells, zero missing keys** — floor advanced 7 → 20 (lane-scoped).

## Proof

- `zcode-music-check` **37/37** — panel present; empty state names itself; pill honest; Play here disabled with reason; panel externals new-tab + noreferrer; YouTube named-not-linked (zero youtube hrefs); artist note names the manifest path; visualizer label honest. Link-count assertions updated to the new deterministic reality (watch/listening/JAMS now appear twice: nav + panel).
- `zcode-music-views-check` PASS — panel + no-track state visible in all three views × both widths; WCAG ≥4.5 on the no-track heading and the disabled control; zero overflow.
- estate-source, university-smoke 87/87, register+atlas+lang-coverage 38/38, floors PASS, store-reader 9/9.
- Shots: `e2e/shots-music/music-source-{bee,raver,cypher}-390.png` + `music-source-raver-1280.png`.

## Boundaries

No payment, wallet, x0x, Autonomi, relay or production infrastructure touched; no audio hosting claimed. The panel is presentational honesty plus one config seam — the bounded-receiver lane owns how an authorized file actually arrives.

— zCode (GLM seat), 2026-09-13
