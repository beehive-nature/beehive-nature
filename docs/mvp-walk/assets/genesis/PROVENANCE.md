# Genesis marks — provenance

**Date of founder supply:** 2026-09-07  
**Lane:** Grok campaign pack, issue #27  
**Base:** `832bdf83` (`origin/main` at branch creation)

Organizations share one organism. They do **not** map onto New bee / Raver / Cypherpunk. Those three names are reading views on any brand. Semantic UI hues (Peace teal, Love pink, Unity purple, Respect blue/gold on the kandi and PLUR surfaces) stay separate from org identity.

| Organization | Founder photograph (session attachment, 2026-09-07) | File in this pack | Kind |
|---|---|---|---|
| skaists | purple-center hex bloom: magenta/fuchsia core → purple → cyan → lime rim, white gutters, scalloped hex edge | `skaists-purple-center.svg` | reconstruction |
| beehive biomass | solid lime-green hex bloom, uniform fill, white honeycomb gutters | `beehive-biomass-solid-green.svg` | reconstruction |
| beehive nature | green-center hex bloom: pale yellow/lime core → cyan → magenta rim | `beehive-nature-green-center.svg` | reconstruction |

## What is true

The founder supplied three photographs to the creative worker session on 2026-09-07. The session listed them as:

1. `/workspace/marketing-review/genesis-palette/skaists-purple-center.jpg`
2. `/workspace/marketing-review/genesis-palette/beehive-biomass-solid-green.jpg`
3. `/workspace/marketing-review/genesis-palette/beehive-nature-green-center.jpg`

Those JPEG paths were **not present** on this checkout, and `git log --all` on `origin` did not contain them. Grok’s earlier localhost `docs/mvp-walk/` tree was also absent from origin. This pack therefore reconstructs geometry and palette from the founder photographs as described in-session, using `build-blooms.mjs`.

## What is not claimed

- These SVGs are **not** the founder photographs and are **not** byte-identical to them.
- They are review proxies for color stops and radial hex structure so the board can be reviewed without a localhost-only folder.
- Replace the SVGs with the original JPEG/PNG bytes in a follow-up if those files are recovered from the laptop worktree or another seat.

## Derived color stops (reconstruction, not a ratified token sheet)

**skaists:** `#E01888` → `#A02CC4` → `#4A6EE8` → `#2EC4E6` → `#6EDC46` → `#C8E62A`  
**beehive biomass:** `#9AD62E` solid  
**beehive nature:** `#FFF4B0` → `#D4EC3A` → `#7ED84A` → `#2EC8E0` → `#3A88E0` → `#D040B8` → `#E02890`

Regenerate: `node docs/mvp-walk/assets/genesis/build-blooms.mjs`
