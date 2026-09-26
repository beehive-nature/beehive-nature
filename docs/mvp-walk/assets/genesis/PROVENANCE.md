# Genesis marks — provenance (campaign board)

**Lane:** Grok campaign pack, issue #27 · draft PR #28  
**Originals + 3D study owner:** Astra, draft [PR #31](https://github.com/beehive-nature/beehive-nature/pull/31) @ `ffb44283`  
**Creators of the supplied originals:** LoVis and his mother (founder credit, 2026-09-07)

**Color carries meaning.** Purple communicates **humans**. Teal communicates **AI**. Green communicates **biomass**. Mixed gradients stay intact. These colors are not three interchangeable UI skins and do **not** map onto New bee / Raver / Cypherpunk.

Three **distinct** labels. Do not collapse them.

| Label | What it is | Where on this pack | Establishes founder original? |
|---|---|---|---|
| **Supplied original** | Unchanged JPEG/PNG bytes from LoVis and his mother | `../genesis-3d/source/originals/` | Yes — those files |
| **New 3D interpretation** | Astra Blender relief stills traced from the originals (depth, lighting, sidewalls are the study) | `../genesis-3d/renders/` | No — interpretation of the originals |
| **Provisional reconstructed SVG** | Earlier hex blooms with **chosen** geometry and stops | this folder | **No** |

The reconstructed SVGs stay **provisional** unless a later commit actually replaces them with founder originals. They were drawn when the JPEGs were absent from this checkout. They do **not** become the originals now that the originals are here.

## Supplied originals (this pack)

Copied from PR #31 so #28 stays reviewable. Digests and pixel sizes: [`../genesis-3d/source/originals-receipt.md`](../genesis-3d/source/originals-receipt.md).

| File | Color reading |
|---|---|
| `green BN logo.jpg` | Green / biomass |
| `green-teal BN logo.jpg` | Green outer field, teal transition, purple center — humans / AI / biomass together. Founder pick for empathic Raver communication |
| `purple BN logo.jpg` | Purple-led, other colors kept |
| `teal BN logo.jpg` | Teal / AI |
| `teal_BN_logo_transparent.png` | Teal / AI (transparent) |
| `teal_logo_magenta.png` | Teal field with magenta |

## New 3D interpretation (stills only on this board)

Astra owns the editable Blender master and GLBs on #31. This board copies **stills** only:

- `renders/original-blooms.png` — teal, green, and purple-led studies together
- individual `renders/*-original.png`

GLB / Blender files are **not** copied here (5.41–6.09 MB and ~7.76 MB). They stay an optional study on #31 until delivery is optimized. README: [`../genesis-3d/README.md`](../genesis-3d/README.md).

## Provisional reconstructed SVGs (this folder)

| File | Kind |
|---|---|
| `skaists-purple-center.svg` | provisional reconstruction (chosen geometry/stops) |
| `beehive-biomass-solid-green.svg` | provisional reconstruction (chosen fill) |
| `beehive-nature-green-center.svg` | provisional reconstruction (chosen geometry/stops) |

Chosen stops (not a ratified token sheet):

**skaists:** `#E01888` → `#A02CC4` → `#4A6EE8` → `#2EC4E6` → `#6EDC46` → `#C8E62A`  
**beehive biomass:** `#9AD62E` solid  
**beehive nature:** `#FFF4B0` → `#D4EC3A` → `#7ED84A` → `#2EC8E0` → `#3A88E0` → `#D040B8` → `#E02890`

Regenerate those SVGs only: `node docs/mvp-walk/assets/genesis/build-blooms.mjs`

## Open

- Continuous PLUR film remains an **open production deliverable**.
- Shared theme behavior and original-based 3D assets stay with Astra (#31).
- No campaign launch. No mint or contract change in this lane.
