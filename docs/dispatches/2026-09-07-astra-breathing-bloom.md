# Feeling in bloom — first three expressions and Blender loop

Founder approval: proceed with the artist-first recommendations, followed by
the locked ranking of breathing, shared rhythm and celebration. The selected
green–teal–purple original is the Raver emotional face, with skaists and
LOVErnment DAO explicitly on the board. This lane delivers a working review
studio and reusable assets; public campaign launch remains outside this lane.

## Delivered

The [studio](../mvp-walk/assets/genesis-3d/motion/index.html) has three user-chosen
expressions, an intensity slider, pause beside the art, and actual animated/still
SVG exports. It reuses the shared New bee / Raver / Cypherpunk control. New bee
remains the default; changing view preserves the expression, intensity and pause.

The original image bytes remain embedded in the 180 traced cells. Artist credit
names LoVis and his mother; the motion study is credited separately. Purple
communicates humans, teal AI and green biomass. The existing FUNGi, FROGGi and
PEPi snapshots appear alongside the bloom with their source records. skaists,
LOVErnment DAO and the people directory are visible parts of the composition.

| Asset | Actual bytes | Contents |
|---|---:|---|
| Animated SVG | 83,287 | 180 cells, exact embedded original, CSS motion |
| SVG gzip measurement | 29,109 | Delivery compression; no gas-cost claim |
| MP4 loop | 767,970 | Six seconds, 720 × 720, 24 fps, 144 frames, no audio |
| Animated Blender scene | 481,198 | 180 editable animated cells, one packed original |
| Film poster JPEG | 76,104 | Still displayed before film loading |

The optional film has no media source on arrival and loads only through its
button. It pauses the SVG while playing. A failed request restores the prior
pause state unless a newer user play/pause choice supersedes it, and offers a
working retry. A 15-second deadline prevents a stalled load from trapping the
control. The page records no mood, connects to no other device and needs no
wallet or microphone. No gift transfer, mint or governance action is simulated.

## Verification and review

- The SVG builder's structural checks pass: all 180 original IDs, one exact
  embedded JPEG, internal references, padded motion bounds, loop endpoints,
  pause semantics and a reduced-motion override. This full animated asset is
  larger than the earlier 34,949-byte monochrome geometry-only size probe.
- The compressed Blender file was reopened. Inspection returned one scene,
  180 editable animated cells, exact packed original image bytes and **zero**
  saved-position difference between endpoint frames 1 and 145. The encoded
  sequence omits the duplicate endpoint.
- `verify-breathing-video.py` counted 144 decoded frames at 24 fps, duration
  6.000000 seconds, H.264/yuv420p, no audio and the MP4 index before media data
  for progressive playback. FFmpeg decoded the complete movie without errors.
- Browser checks covered all three views; expression/pause/intensity retention;
  actual running and frozen transforms; zero intensity; and celebration's full
  range (75% strength 1.675, 100% strength 2). At a 390-pixel viewport the page
  had no horizontal overflow and pause remained visible beside the artwork.
- Both SVG export controls created files in Downloads. Both parsed with 180
  cells and byte-identical embedded originals. The still's first-cell matrix
  exactly matched the visible paused browser matrix. The download-event watcher
  timed out despite the file being successfully saved; filesystem inspection
  established the actual result rather than treating that timeout as a failed
  export or a successful download merely because the page said so.
- While the MP4 was still absent, a real failed request verified the visible
  retry and restoration of running SVG motion. After encoding, the same control
  successfully loaded a six-second silent looping video with native controls.
- New bee and Raver screenshots were visually inspected, including the narrow
  layout and film playback. The temporary viewport override was reset.
- Reduced-motion CSS and controller branches were reviewed structurally; the
  host operating-system preference was not changed for a live emulation test.
  No human usability observation receipt or translation review is claimed.

One existing local agent built the SVG and its structural receipt; another
independently reviewed the studio's controls and wording. Both inherited the
current model/effort. Astra built the Blender animation, integrated the studio,
verified actual browser behavior and remains the shared-theme asset integrator.

The independent review found four issues, all repaired: still export previously
returned the resting pose; a failed film request could leave the SVG paused;
without the shared script, all three headings could appear; celebration's
slider reached the asset's strength cap too early. Pause was also moved beside
the artwork and unloaded video chrome was replaced with an explicit still.

## Rendering and boundaries

Blender 4.5.13 LTS rendered locally through WSL. Four Cycles preview frames and
an EEVEE comparison were inspected. The final 144-frame sequence used EEVEE,
four samples, four Blender threads and `LP_NUM_THREADS=4`. EEVEE emitted EGL
context warnings (`EGL_BAD_MATCH`) before successfully rendering; its process
completed with exit code zero and the final marker `BNR BREATHING RENDER COMPLETE`.
FFmpeg encoded with two threads. Intermediate PNG sequences remain in the own
worktree's `.audit/` directory and are not staged.

All implementation edits are confined to the original-art asset lane and this
dispatch. The static original master and supplied source files are unchanged.
The [motion README](../mvp-walk/assets/genesis-3d/motion/README.md) carries the
rebuild commands, file sizes and limits. The English studio is served locally
for review; no production service, public homepage or chain contract was changed.

Grok keeps the Raver social/creative board and consumes these still/vector/movie
assets, without rewriting the Blender source. Its #28 observation-method and
provenance edits remain its lane; #28 stays draft and #27 stays open. Music
response, unfolding into depth, remix kits and public gift integration follow
the first three expressions' human review rather than being claimed complete.
