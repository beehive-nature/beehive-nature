# Original genesis marks — Blender relief study

Original artwork: **LoVis and his mother**. Six original files were supplied on
2026-09-07. Their bytes and filenames are preserved in `source/originals/`.

**Color carries meaning:** purples communicate humans; teal communicates AI;
greens communicate biomass. The original mixed gradients are retained. These
are not three interchangeable UI skins or an invented organization mapping.

## See the studies

- `renders/original-blooms.png` — teal, green and purple-led originals together.
- `renders/teal-original.png` — teal / AI.
- `renders/green-original.png` — green / biomass.
- `renders/purple-original.png` — original purple-led gradient, including its other colors.
- `renders/green-teal-original.png` — original mixed color flow.

`models/original-genesis-study.blend` contains four editable scenes and a shared
studio overview, with artwork textures packed inside. Each cell remains a
separate named mesh with a bevel modifier and original-image UV coordinates.
`models/*.glb` are the four self-contained exports for subsequent web/scene work.
They should load on demand rather than becoming a mandatory cost of opening Home.

These are visual studies. A physical manufactured piece would need its own
backing, scale, strength and fabrication design; the model is separate cells.

## What comes from the originals

The high-resolution teal PNG is the geometry master: 180 measured cells in
nine observed rings of twenty, including the tiny center cells. This is a trace
of the actual tapered outlines, not a construction from regular hexagons.
The other original images provide their color fields, registered by normalized
image bounds to the same family geometry. This does not assert that every
low-resolution JPEG has pixel-identical outlines.

`source/cells.json` keeps both the reference trace and a reduced modeling trace.
The reference mask overlap is 99.5014%; the optional reduced trace is 98.7240%
with at most one source pixel of boundary deviation. These figures describe
flat-mask overlap, not image quality or recovery of unavailable vector masters.
The Blender builder retains the reference contours for cells below 40 pixels
in area, because a one-pixel reduction consumes too much of the smallest cells.
No cell is removed. The innermost twenty cells have only 8–14 source pixels each;
their exact subpixel corners remain uncertain.

The four face materials use the original image files, including continuous
gradients. Original image files are not recolored. Rendered appearance also
depends on the scene's neutral lights and material reflections. Depth, enamel
surface response, neutral sidewalls and camera angles are this new study.

`trace-original.py` recreates the contours and diagnostic overlay using Pillow
and NumPy. `geometry-receipt.json` records the actual modeled cells per variant.
`source/originals-receipt.md` records the original file digests and image metadata.

## Rebuild

Run `trace-original.py` with Python, Pillow and NumPy. Then run Blender 4.5 LTS:

```sh
blender --background --factory-startup --threads 4 --python-exit-code 1 --python build-study.py
```

The builder uses Blender's bundled Python and built-in glTF exporter; it makes
no network requests and needs no add-ons. The executable must be launched from
a full Blender distribution, not copied out on its own.

Run `python verify-study.py` after the build completes. It checks the four GLB
containers, all 180 cell identities per export, exact embedded original texture
bytes, image dimensions and the Blender file header. Results are recorded in
`verification.json`. Each current GLB has 110,016 triangles and is 5.4–6.1 MB;
these are editable study exports, with web delivery optimization still pending.

On this laptop Blender 4.5.13 LTS ran through local WSL at
`~/.cache/bnr-tools/blender/blender-4.5.13-linux-x64/blender`. The official archive
passed its published SHA-256 check. Its Windows portable counterpart also
passed the archive check and executable signature check, but Windows reported
a missing `blender.crt` activation dependency at startup. No security settings
were changed; rendering used the working Linux build with four CPU threads.

The study is separate from Grok's campaign edits and is not deployed to the
public front door. The prior provisional 96-regular-hex reconstruction was
superseded by these supplied originals before any final study was accepted.
