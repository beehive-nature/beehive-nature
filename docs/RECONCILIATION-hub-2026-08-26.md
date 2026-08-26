# Hub design reconciliation — 2026-08-26 (lane/reconcile)

A RECONCILIATION, not a redesign. Drift was mapped, one mechanical class was
fixed (provably render-neutral), everything aesthetic is listed below for the
founder untouched. Standing laws held: colour never carries meaning alone;
semantic tokens were not repainted; `--b-value` stays b-amounts-only.

## STEP 1 — the map

**Four supposed sources of truth, as found:**

| source | what it actually is |
|---|---|
| **A** `Beehive Hub Redesign Brief eco design v2.zip` | two inline-styled mock pages (`Beehive Hub.dc.html`, `Estate Review 2026-08-26.dc.html`) + nav PNGs. **Declares zero tokens** — its colours are hardcoded hexes in inline styles (all from the entity set: `#06110C #E9F2EC #D655BB #86CC72 #45C2DC #9C6FD6 #E8B54B #6FA9E0 #B79FE0 #1E2B26 #648176`). The brief is PICTURES + words, not a palette. |
| **B** live hub `surfaces/index.html` | declares **23 tokens inline** (legacy family: `--blue --ember --green --hot --lilac --magenta --panel --inset --void --tile --lift --dim --dimmer --gold --cyan …` + its own `--sem-*` mappings) and links **no** tokens.css. |
| **C** palette of record | **`relay/tokens.css` DOES NOT EXIST in the repo.** The two real sheets: `surfaces/tokens.css` (the D1 macro sheet — linked by 8 surfaces) and `docs/tokens.css` (the entity/kernel sheet — verbatim-embedded by onboarding, never linked). They overlap in vocabulary with DIFFERENT values. |
| **D** `surfaces/blight/demo.html` (bLiGhTbeAM) | declares the **16 entity tokens inline** — values byte-identical to docs/tokens.css DARK block (incl. `--rainbow` at a literal `90deg`). Plus: `surfaces/blight/profile.html` (20 declared, same entity duplicate class, mine). |

**The token table** (drift rows only; full generated table preserved in the
lane's `.recon/map.mjs` output — run `node .recon/map.mjs`):

| token | docs sheet (entity law) | surfaces sheet | live hub | doors family (×7) | blight demo / profile | other notables |
|---|---|---|---|---|---|---|
| `--sem-harm` | `var(--guard)` #B7A8F7 — "NEVER error-red" | — | `var(--ember)` **#FF7A6B** | `var(--ember)` | `#ffb347` (profile) / ember (demo aliases) | pixelrefiner `#ffb347`; THREE families live |
| `--gold` | — | `#FFD700` | **#E8B54B** (= b-value's honey) | #FFD700 | — | two golds by name collision |
| `--b-value` | `#E8B54B` (b amounts ONLY) | — | (unused name) | — | #E8B54B ✓ | `--gold` on hub carries the honey value |
| `--cyan` | — | `#00E5FF` | #45C2DC (= --ai's value) | #00E5FF | — | two cyans |
| `--ai` | `#45C2DC` | — | — | — | #45C2DC ✓ (+light #2B7A8B in docs) | onboarding declares both modes |
| `--violet` / `--sovereign` | `#9C6FD6` | `--violet #c9a0ff` | `--purple #9C6FD6` | `--lilac #B79FE0` | sovereign #9C6FD6 ✓ | two violets + three alias names |
| `--dim` | `--ink-mut #8FA79C` | `#8a9a8a` | **#8FA79A** | #8FA79A | — | three mutes differing by digits |
| `--faint` | — | `#6f7f71` | — | — | — | bnames/royalguard/wallet pin **#5f6f61** over the sheet's #6f7f71 (same-name drift, LEFT IN PLACE) |
| `--line` | `#1E2B26` | `#243026` | #1E2B26 | #1E2B26 | ✓ | qrtree `#E4EBDC`, fleet-hosted `#262638` |
| `--panel`/`--inset`/`--void` | — | `--bg1 #111a14` | #0A1310/#08120E/#06110C | same as hub | same as hub | three near-black ground ladders |
| `--rainbow` | `linear-gradient(var(--flow),…)` | — | — | — | literal `90deg` | renders identical under ltr; diverges under rtl |
| `--accent` | — | — | — | **six different values** across the 7 doors | — | per-door identity accents |
| `--guard` | `#B7A8F7` | — | — | — | ✓ | royalguard pins **#7D5FB0** (same-name drift) |

**Census:** 20 files under `surfaces/` declare colour tokens; 8 correctly
`<link>` the surfaces sheet (b4b, blongevity, bmeshasi, bnames, listening,
royalguard, wallet, bqueenbee-live); onboarding embeds the docs sheet verbatim
("source of law"); the rest declare locally.

## STEP 2 — the one mechanical thing

**Done, render-neutral, proven:** `bnames.html`, `royalguard.html`,
`wallet.html` each declared six tokens (`--line --cyan --gold --leaf --violet
--amber`) **byte-identical to the surfaces/tokens.css they already link** —
dead declarations. Removed. Proof: **18/18 computed token values identical
before/after**; royalguard + wallet full-page screenshots byte-identical;
bnames is a live-animated/chain-reading page (two consecutive shots of the
same tree differ), so the computed-style equality is its honest proof.
`--faint` (#5f6f61 ≠ sheet #6f7f71) was NOT removed — that is drift, listed,
untouched.

**STOPPED, per the order's own rule** ("if removing a duplicate would change a
rendered colour, STOP and report"): `demo.html` and `profile.html` duplicate
the entity set, whose only in-repo source is `docs/tokens.css` — and that
sheet carries a `prefers-color-scheme: light` block. Importing or embedding it
would repaint every light-scheme visitor of two surfaces that are dark-always
today. There is no importable entity sheet without the light block, and the
founder-named `relay/tokens.css` does not exist. **Founder item:** land the
record sheet where surfaces can import it (dark-only, or rule that the light
block may ride along — onboarding already embeds it whole, which looks like
precedent, but that ruling is yours, not mine). Then the swap in demo/profile
is ten lines.

**Also completed here:** the `tour.js ?v=26→27` cache sweep that the profile
lane's bump-rider run produced but only partly committed (5 of 82 files) —
main was half-swept: the asset changed while ~77 surfaces still pinned the
stale key. The sweep's full output is committed on this lane. Made by
`scripts/bump-rider.sh` originally; frozen art untouched (orbit keeps ?v=26
by the freeze law).

## STEP 3 — aesthetic disagreements (brief vs live hub), for the founder

Pictures: `brief-mock-390.png` vs `live-hub-before-390.png` in this folder.

1. **Header signature** — brief: drifting animated hex-tile ribbon in the full
   entity palette + CRT scanline overlay; live: static gradient wash +
   wordmark. (motion + identity)
2. **Type character** — brief: monospace throughout; live: sans UI stack.
3. **Manifesto** — brief: four numbered sections `01 what it is · 02 how it
   proves · 03 what it costs · 04 who it's for`; live: one long prose intro.
4. **Counts + footer wording** — brief mock says "63 surfaces · three orgs";
   live says "74 surfaces · six domains · three orgs · one organism · …".
5. **Start-here curation** — brief: six starred doors (Dock, keys,
   bLiGhTbeAM, PLUR museum, bFood hexagon, BNR DAO); live: the full 81-tile
   wall, Dock introduced by prose.
6. **Search/filter** — brief: a prominent search + domain-chip filter section
   ("no door matches that"); live: domain sections + tiles, no such panel.
7. **Scanlines/blips** — brief: CRT texture and blinking blips as ambience;
   live: none.

**Adjacent functional finding (not aesthetic):** `https://skaists.dev/` root
returns **404** — the hub is reachable at `/surfaces/index.html` (github.io
301s to the domain). The domain's front door is missing.

## Standing-law notes

- `--sem-harm` carrying `var(--ember)` (#FF7A6B) on the live hub, doors,
  qrtree, dao, devroom, dock, demo contradicts the docs sheet's "guard
  refusal — NEVER error-red" law. **Not repainted** — semantic tokens are
  never repainted to fix anything by a reconciliation lane; this is founder
  ruling territory (either the law or the embers move).
- `--b-value` remains b-amounts-only everywhere observed.
- fleet-hosted/index.html declares 13 tokens — preserved byte-law territory,
  listed, untouched.

## A law collision, found and resolved conservatively

Running the gates surfaced a **pre-existing red on main**: estate-review's
"tour bar rides every surface" failed on `blight/profile.html` — the previous
lane dropped its rider include to hold a two-origin runtime ledger, and that
edit was gated with design-acceptance but estate-review was not re-run after
it (my miss). Two laws collided; the shared estate law wins over a
per-surface claim: **the rider is restored** (`tour.js?v=27`), the in-page
comment now records the collision, and profile's ledger claim narrows to
"self + the public RPC + the estate's own badge rail." If the stronger
two-origin claim matters, that needs a founder-ruled rider variant (a badge
fetch is not a data dependency) — listed here rather than improvised.
