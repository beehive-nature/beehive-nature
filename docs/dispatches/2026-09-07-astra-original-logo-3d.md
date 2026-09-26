# Original genesis logos — first Blender relief study

Lane: Astra, `codex/genesis-3d-study-2026-09-07`, based on main `a70dafe5`.
Founder request: explore 3D versions in Blender; then use the six original logos
he supplied, made by him and his mother. This is a review artifact, not a site
release or a campaign launch.

## Authorship and meaning

The six supplied files retain their filenames and exact bytes in
[`source/originals/`](../mvp-walk/assets/genesis-3d/source/originals/).
All six copies were compared by SHA-256 against the supplied Downloads files;
all matched. Their dimensions and public artwork digests are in the
[`originals receipt`](../mvp-walk/assets/genesis-3d/source/originals-receipt.md).

The originals belong to the founder and his mother. The proposed extrusion,
neutral sidewalls, bevels, materials and lighting are Astra's 3D interpretation.
The [founder color statement](2026-09-07-founder-color-meaning.md) travels with
the study: purples communicate humans; teal communicates AI; greens communicate
biomass. Mixed gradients remain intact.

## Delivered

- [Combined render](../mvp-walk/assets/genesis-3d/renders/original-blooms.png):
  teal, green and purple-led originals together.
- Four individual renders, including the green-teal original, at 1000 × 1000.
- [Editable Blender file](../mvp-walk/assets/genesis-3d/models/original-genesis-study.blend):
  five scenes, four packed original image textures and 180 separate editable
  cells per variant. The overview contains three collection instances.
- Four self-contained GLB files, each with 180 cells, embedded original texture
  bytes and 110,016 triangles. Sizes range from 5,406,620 to 6,086,320 bytes.
- Rebuild scripts, trace overlay, geometry receipt and
  [verification results](../mvp-walk/assets/genesis-3d/verification.json).

The high-resolution teal original is the geometry master: nine observed rings
of twenty tapered cells. The other originals supply their color fields using
normalized image coordinates. This does not claim pixel-identical outlines
across every lower-resolution JPEG. The tiny center cells are retained; their
8–14 source pixels cannot establish exact subpixel corners.

The reference trace has 99.5014% flat-mask overlap with the measured foreground.
The reduced modeling trace has 98.7240% overlap; the builder uses the reference
trace instead for cells below 40 source pixels. These are mask measurements,
not recovered vector-master accuracy or a visual quality score.

## Execution and checks

Blender 4.5.13 LTS, build `daeeeca98fb0`, ran locally through WSL. The official
Linux archive passed its published SHA-256 check. Rendering used CPU Cycles,
four threads and 32 samples, with no production-box connection or mesh node.
All five final PNGs were inspected visually.

`python verify-study.py` passed after all exporters finished. Output reports:
six source files; five renders; 180 unique expected cell IDs per GLB; original
texture bytes embedded unchanged; zero external buffer/image dependencies.
The saved `.blend` was separately reopened in Blender. Inspection output:
five scenes; 180 editable meshes with UVs and bevel modifiers in each of four
variants; four packed source images; three overview instances.

Problems encountered and corrected:

- The verified Windows portable build could not start: Windows reported a
  missing `blender.crt` activation dependency. Its archive and executable
  signature checks passed. No security setting was changed; the verified Linux
  build supplied the working runtime.
- Initial GLB inspections counted 181, 182, 183 and 184 mesh nodes as selected
  objects leaked across scenes. `use_active_scene=True` now accompanies
  `use_selection=True`; final results are exactly 180 in every file.
- A follow-up export stopped at a long Blender scene-name lookup, leaving later
  files stale. Scene names are now short, with full titles stored as metadata.
  The documented command uses `--python-exit-code 1` so Python failures cannot
  masquerade as a successful Blender process. All four exports completed before
  the final verification.
- Initial lighting washed out original colors. Neutral lighting and revised
  intensity/distance preserve a clearer color reading in the final renders.

The GLBs are study exports: delivery optimization, animation and fabrication
design remain separate work. No public surface, service or deployment changed.

## Grok coordination

Grok keeps the campaign board and 2D provenance updates; Astra supplies this
original-based 3D study. The earlier provisional regular-hex reconstruction is
superseded for this lane. The original-art and color handoff is recorded on
[PR #28](https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5575660394).

A bounded independent source review of campaign tip `921b2924` returned
[two remaining observation-method edits](https://github.com/beehive-nature/beehive-nature/pull/28#issuecomment-5575759413):
separate local-completion timing from receiver-Keep timing with an explicit
attempt denominator; separate hypothetical concept reactions from neutral
observation of what happened. Its eight remote checks were confirmed successful.
PR #28 remains draft, #27 remains open, and human observation receipts and a
continuous PLUR film remain pending. No browser usability session was claimed.

Delegation used two existing local subagent lanes: original-cell tracing and
independent campaign source review, both inheriting the current model/effort.
No new cloud agent, paid creative service or subscription was started.
