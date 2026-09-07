# Feeling in bloom — artist motion studio

Original artwork: **LoVis and his mother**. Motion and creator-preview study:
Astra. The green–teal–purple original is the Raver emotional face selected by
the founder, with **skaists and LOVErnment DAO** present alongside the art.
Purple communicates humans, teal AI and green biomass in every view.

Open `index.html` through a local HTTP server rooted at the repository. The
preview reuses `surfaces/register.js` for New bee / Raver / Cypherpunk, with
New bee as the default. The English study has three expressions: breathing,
shared rhythm and celebration. All capabilities remain available in every view.
Grok owns the subsequent creative/social board integration and production copy.

The SVG is loaded once. The film has no source until its button is pressed.
No wallet, microphone, analytics, live mood signal or mint operation is involved.
The embedded artwork, inscription snapshots and links retain their own credits.
The creator's choices are transient page state; only the existing shared view
preference uses the shell's normal browser-local storage.

## Artwork files

- `green-teal-breathing.svg`: self-contained, 180 traced cells, original JPEG
  bytes embedded once, CSS motion. The source asset is 83,287 bytes; gzip is
  29,109 bytes. Gzip measures delivery compression, not an automatic gas saving.
- `green-teal-breathing.mp4`: optional six-second, 720 × 720, 24 fps silent
  Blender loop. The final encoded size and media metadata are in `video-receipt.json`.
- `green-teal-breathing.blend`: editable animated Blender scene with 180 cells
  and the selected original image packed inside. The static master in `../models/`
  remains unchanged.
- `green-teal-breathing-poster.jpg`: small still for the film's unloaded state.

The studio's **Save animated SVG** embeds the selected expression and intensity
in a standalone file; reduced-motion behavior and author credit travel with it.
**Save still SVG** records the currently visible transforms and disables motion.
It therefore preserves the composition the artist paused, including any ring
wave position. It is not a mint or a grant of a new artwork license.

## Controls and integration

The SVG root is `.bnr-breathing-bloom`:

| Control | Effect |
|---|---|
| `.is-paused` | Pause all cells at the current animation phase |
| `--bloom-duration` | Cycle duration, clamped to 3–24 seconds |
| `--bloom-strength` | Radial motion multiplier, clamped to 0–2 |
| `--bloom-ring-delay` | Phase delay per measured ring |

The preview maps the full 0–100% slider onto 0–2 strength, preserving each
preset's preferred strength at 50%. Celebration uses a 3.6-second cycle;
breathing and shared rhythm use six seconds with different ring phases.
Only movement changes; the source image is not recolored. The SVG honors
`prefers-reduced-motion: reduce` by returning to the static resting geometry.

Pause is beside the artwork, including at phone widths. Hidden tabs pause the
SVG and video; the video does not automatically resume when returning. Choosing
the film pauses the SVG. A failed film load restores the previous SVG pause
state unless the artist made a newer play/pause choice, then offers a real retry.

## Rebuild and verify

From the parent directory, run `python build-breathing-svg.py`. Its structural
checks and size calculations are recorded in `svg-receipt.json`; they validate
all 180 IDs, the exact embedded image, self-containment, boundaries, seamless
keyframe endpoints, pause rules and the reduced-motion override.

Use Blender 4.5 LTS for the film, with an absolute scratch directory for frames:

```sh
blender --background --threads 4 --python-exit-code 1 --python build-breathing-blender.py -- --frames-dir /absolute/scratch/bloom-frames --engine eevee --samples 4
```

The checked local build used Blender 4.5.13 LTS through WSL with four Blender
threads and `LP_NUM_THREADS=4` for Mesa. EEVEE's initial graphics-context warnings
did not prevent the rendered output. Cycles is an optional slower alternative
(`--engine cycles --samples 16`); the four-frame preview was inspected before the
EEVEE full sequence. Source colors remain in the original image; the two render
engines have different lighting results.

The Blender loop uses a periodic cosine for radial expansion and vertical rise,
with ring phases. Keys span frames 1–145, with matching endpoint poses; exported
frames 1–144 omit the duplicate endpoint. The vector and film share the original
artwork and breathing idea, with independently authored 2D and 3D motion.

Encode the completed sequence with FFmpeg:

```sh
ffmpeg -framerate 24 -start_number 1 -i /absolute/scratch/bloom-frames/%04d.png -frames:v 144 -c:v libx264 -threads 2 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -an green-teal-breathing.mp4
```

The video is a local visual study. It is not proof of a minted inscription,
marketplace compatibility, cross-device synchronization or a live DAO feature.
Music response, depth unfolding and public gift delivery remain subsequent work.
