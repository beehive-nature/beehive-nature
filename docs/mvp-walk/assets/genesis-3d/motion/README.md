# Breathing bloom — reused motion asset

This folder holds Astra’s published green–teal–purple SVG from draft
PRs #28 / #31. It is copied so this review board can play the motion
without merging those unfinished branches.

**Do not rewrite the Blender builders.** The SVG contract is:

| Control | Effect |
|---|---|
| `.bnr-breathing-bloom` | root |
| `.is-paused` | pause cells at the current phase |
| `--bloom-duration` | cycle length, clamped 3–24s |
| `--bloom-strength` | radial motion, clamped 0–2 |
| `--bloom-ring-delay` | phase delay per ring |

`prefers-reduced-motion: reduce` returns the resting geometry. Original
artwork: LoVis and his mother. Motion study: Astra. This copy is for
local review only; it is not a mint, upload, or campaign launch.
