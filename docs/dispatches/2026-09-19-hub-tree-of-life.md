# THE TREE OF LIFE PASS — the hub (skaists.dev) in the new face

**Seat:** Cowork (design + UI). **Date:** 2026-09-19. **Branch:**
`cowork/hub-tree-of-life-2026-09-19`. **Founder order (verbatim intent):** *the
hub skaists.dev gets a full make over … start with the surfaces of highest
demand and lowest liability — remember, restore, keep — scaled to all
languages … three separate user experiences.* The face was ruled the same day
(design system "skaists", version 6: "OKAY A 100% CONGRATS").

## What changed (hub only — no other surface, no shared shell, no register.js)

**The house hand names the page.** `skaists.dev` in the masthead and the footer
is now set in **burti** — the original Latvian letterform of the .a/.b names
(`docs/BLAZON.md`), compiled to one same-origin file
(`surfaces/fonts/burti.woff2`, 98 glyphs: Latin, the Latvian court, the house
signs). Names only, never sentences; `translate="no" dir="ltr"` so no tongue
and no RTL page ever reorders the founder's casing. Provenance and the compiler
travel with it (`assets/brand/burti/`: the founder's `burti-dna.js` and the
compile script that rebuilds the file from it). No third-party fetch was added; if the file fails,
the old mono mark is the fallback.

**Austras koks is the hero — drawn from the registry at build.**
`scripts/atlas-tree.mjs` draws the Latvian tree of life from `estate.json`'s own
counts; the bough is the crest's curve copied point for point
(`M0,4 C-26,-4 -58,-22 -84,-54` and its inner curl), the ground line is Māra's
water. One truth, three readings (same facts, never different numbers):

| register | the tree | the room |
|---|---|---|
| new bee | the fir: eight boughs (families) bearing comb — **one cell per counted surface**, an open seat is a dashed cell | paper `#fbf7f0`, ink `#0c1412`, human purple `#6e3fb8`, magenta action `#a8238c`, guard lilac; no band — the tree is the art; 16px+ reading text; 44px controls |
| raver | the same boughs spun into a wheel of light, orbits turning slowly (stilled under reduced motion) | the founder's hex band stays, byte-true; gradient house hand; the on-chain art stage |
| cypherpunk | the same tree as a graph: `skaists.dev → org → family`, straight chords, every count written, a bar per family | mono top to bottom; search first; nothing rounded that need not be |

The builder refuses to ship if the boughs do not sum to the door number
(`TREE DRIFT`). The pictures are pictures — no links, no controls inside them —
and the caption names every house and count **in words** beside its colour
(D-1: colour never carries meaning alone).

**Remember · restore · keep comes first.** A new group sits above the three
start rows (which are untouched and still pinned by their test):

- **My Data** → `bdata.html`, speaking with bData's own keys (`bd.h1`,
  `bd.lead`) — the hub cannot promise more than the page does.
- **Watch together** → `watch.html`, with the room's own keys (`watch.title`,
  `watch.beeLead`).
- **bGENEaLOGy** — founder casing exact (GENE and LOG heavy; b, a, y light), a
  **plain row with its reason** ("being built now — not open yet"): not a link
  to nowhere, not a disabled button. The day a genealogy surface is registered,
  the builder throws until this row becomes a real link.

**Truth call made in this lane:** my first draft said "keep a file forever" and
"kept on a network no company owns". The estate's own canon says Arweave is
forever and Autonomi is private-and-deletable, and My Data says "what it costs
to keep them" — so those lines were cut before they shipped. The heading is
"keep what matters." and the line under it claims only what is true of the
design: *kept by you, not by a company.*

**Accent moved off biomass green.** Green means living systems; it was also the
hub's hover/focus/arrow colour. Each register now has its own action hue
(new bee human purple, raver magenta, cypherpunk network cyan); focus is an ink
ring. Honey stays reserved for b. Guard stays lilac. No `text-transform`
anywhere in the sheet (tested).

**The register control on the hub** is one row at 390px: a pill track, the
pressed pill filled, and the ✓ still says "pressed" without colour. Scoped to
`body[data-experience=home]` from `atlas.css`; `register.js` is not edited.

## All languages

Six new strings (`hub.keep.*`) docked in **en + 28 tongues** by
`scripts/tmp/hub-keep-keys.mjs` (never overwrites an existing cell; `--check`
mode). All ⚙ machine-drafted under the corpus law until a native speaker
attests. Rendered and looked at in ar (RTL), lv, ja, hi, de at 390px: no
horizontal overflow, names hold left-to-right, the arrows mirror.

## Gates (un-piped, this lane)

- `node scripts/estate-check.mjs` — PASS (96 counted · 105 listed · hub static + embed in sync)
- front-door suite (the full CI list, 29 files) — 333/333 pass, **3 new tests**: the tree equals the registry in all three readings · the keep rows speak only their destinations' words and bGENEaLOGy stays plain · the house hand is same-origin and nothing forces case
- `node e2e/estate-source.mjs` — corpus integrity PASS (28 languages × 2022 keys, every data-i18n key present); the byte-for-byte hub check passes on the committed tree
- `node e2e/no-page-errors.mjs` — 105 surfaces walked · 0 with page errors
- `node e2e/i18n-coverage.mjs … --floors` — the hub holds its floor; two floors fail on pages this lane does not touch (`forge/room.html` 19/20, `or-board.html` 58/94) — reported, not repaired here

## Not done here (named, not hidden)

- The estate-wide shared new-bee theme in `register.js` (`#f6f7f2 / #18362a`)
  is still the old green-grey on every other surface; many tests pin it. It
  migrates in its own lane, surface family by family.
- bData's kicker is forced uppercase on live (`BDATA — …`) — a casing-law
  break in zCode's active lane (Phase C, same day); flagged to the founder, not
  touched from here.
- bGENEaLOGy itself is zCode's lane.

**Receipt:** the LIVE URL at 390px, all three registers — never the git state.
