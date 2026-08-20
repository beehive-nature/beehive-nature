# RAID — STEMDECK (stemdeckapp/stemdeck): DAW-in-browser patterns for the bMiDi studio

**Source:** full clone read in tree at pinned commit `7eba6340efb701aecd56b0e9016694b97969f4cb`
(2026-08-19). Root `LICENSE` read raw in tree: **Apache License 2.0** — verbatim standard text,
no carve-outs, no attribution rider (the crawl4ai check applied and passed). No NOTICE file
exists, so Apache §4(d) carries nothing extra. **L-VERIFY: SATISFIED at pinned commit.**
Apache-2.0 → AGPL-3.0-only is one-way compatible; taken code keeps its copyright header and
a pointer to this raid.
**Doctrine:** full pirate rules per founder, 2026-08-19 — *"take everything that serves the
queen and the hive and leave everything that does not; do no harm ever."*
**Prompted by:** founder — a **bMiDi music inscription art creation studio** to complement the
visual inscription studio (DISPATCH_STUDIO_BULLPEN_2026-08-16 §0 inventory).

---

## What the target is

Local-first stem separation with a DAW-style browser front end. Drop in audio, Demucs splits
it to six stems, and a multitrack mixer plays them back: waveform lanes, loop region, gold
playhead, per-stem fader/mute/solo, live VU meters, BPM/key/LUFS analysis. No account, no
upload, no subscription — audio never leaves the machine. FastAPI backend, optional Tauri
desktop shell, ~8k lines of Python pipeline, ~12k lines of frontend JS.

**The structural headline: the entire frontend is no-build vanilla JS with zero runtime
dependencies.** Their `package.json` says it plainly: *"The app itself has no build step and
no runtime dependencies; this exists only so CI can drive a real browser."* That is the
`surfaces/` discipline, arrived at independently by working musicians. The raid is unusually
clean because the two ships are already the same shape.

---

## TAKE — serves the queen and the hive

### 1. The DAW frontend module map (Apache-2.0 code and patterns)

| module | lines | what it is | bMiDi seat |
|---|---|---|---|
| `static/js/transport.js` | 835 | play/pause/seek/loop, playhead sync | studio transport — the missing spine of `studio-music.html` |
| `static/js/mixer.js` + `audioEngine.js` | 535+315 | Web Audio graph: per-lane gain/mute/solo/monitor, state sync between mixer and sidebar | per-voice mixer for multi-voice MIDI pieces |
| `static/js/beatgrid.js` + `beatgridUi.js` | 598+137 | beat/bar lattice, snap, downbeat handling | **the MIDI quantization grid** — highest-value single take; a piano roll is a beatgrid with pitch lanes |
| `static/js/metronome.js` | 405 | click-track scheduling against the grid | studio metronome |
| `static/js/player.js` | 1760 | min/max-sample waveform lane rendering, shared normalization, zoom/fit | lane-rendering technique transfers to note-lane and velocity rendering |
| `static/js/state.js` | 203 | small explicit state store, no framework | matches surfaces discipline |
| VU meters (in mixer path) | — | post-gain RMS via AnalyserNode, peak hold, slow falloff | live meters for the studio preview |

Take as **reference source at the pinned commit**; port into the studio's inlined-module style
(the bLiGhTbeAM lesson stands: shared code inlined per page must be fixed in every copy — keep
the taken modules as real `.js` files with one cache-key version, per the tour.js law).

### 2. Key detection: the Albrecht-Shanahan profiles with the pop-minor insight
`app/pipeline/analyze.py` — 24 constants and a comment worth the whole raid: their minor
profile weights **b7 high and M7 low**, the opposite of Temperley/Kostka-Payne, because pop
uses natural minor while Bach chorales bias the leading tone. It is a small pure function —
reimplement in JS (constants are from the published Albrecht & Shanahan 2013 paper) for
seed→key validation in `midi-organ.html` and imported-motif analysis in the studio.

### 3. Cancellable job runner pattern
`app/pipeline/runner.py` + `jobqueue.py`: cancel mid-pipeline → terminate the active
subprocess immediately, delete the partial job dir, return to ready. PATTERN for any future
local processing venue (broom-agent lanes included). No code dependency.

### 4. Playwright-drives-static-JS CI pattern
`playwright.config.mjs` + `tests/js/*.test.mjs` — browser tests over a no-build static app,
node-run unit files beside them. Direct upgrade candidate for the surfaces verify loop
(today: contrast probe + manual instrument passes).

### 5. PATTERN — the honest-comparison table
Their README tables their own gaps against commercial rivals ("Honest Comparison"), and their
pyproject pins carry paragraph-length comments explaining each constraint. Same doctrine as
our show-the-errors museum wall. Keep as the standing example that it survives contact with a
real user community.

---

## LEAVE — does not serve, or harms

- **The Demucs/torch separation pipeline.** Gigabytes of torch, and the studio's medium is
  MIDI, not audio stems. Also the model weights are Meta's release with their own terms — a
  license question we never need to answer if we never take the lane. LEAVE whole.
- **The yt-dlp import lane.** A downloader bolted to a creation studio is a copyright surface
  the hive does not need: bMiDi inscribes **original** works. This is the do-no-harm line,
  drawn where they themselves drew a disclaimer. LEAVE whole, including the QR hand-off code
  that feeds it.
- **FastAPI backend + Tauri shell + packaging.** Surfaces are static and file://-runnable;
  the studio has no server and wants none (Article V.1 — nothing hive-operated to fund).
- **`catalog.js` (3,519 lines) library manager.** The hive's library is the chain; the
  inscription explorer already renders it.

## CAUTION — the trap shelf

- **`static/vendor/soundtouch-processor.js`** header claims *"Adapted from SoundTouch C++ by
  Olli Parviainen. MIT License."* SoundTouch upstream has been **LGPL-2.1** for its whole
  public life — a header claiming MIT on an adaptation is the crawl4ai/Remotion shape
  (custom-or-wrong license wearing a clean jacket). Do NOT take this file without reading the
  upstream license at a pinned commit. bMiDi does not need WSOLA time-stretch, so the cheap
  answer is: never take it.
- **`static/vendor/multitrack.js`** is a minified wavesurfer-multitrack bundle. Never take a
  minified vendored blob — if lane rendering is wanted beyond what §1 gives, take from the
  wavesurfer upstream source (BSD-3 family) at a pinned commit with its own L-VERIFY.

---

## FIT — where the haul lands

- **`surfaces/blight/studio-music.html`** (200-line MVP) is the landing site: beatgrid +
  transport + mixer grow it into the creation studio. **`midi-organ.html`** stays the pure
  seed-renderer ("same seed, same song, forever") — the studio composes, the organ proves
  determinism.
- **Same gate, same encoder** as the visual lane (DISPATCH_STUDIO_BULLPEN §0): a MIDI piece
  is kilobytes — comfortably inside the 24,576 B SSTORE2 blob budget the visual lane already
  measured against. bMiDi needs no new inscription plumbing.
- **Complement noted, not raided here:** audio→MIDI transcription (e.g. Spotify `basic-pitch`,
  stated Apache-2.0) is the missing bridge from stems to notes, should the founder ever want
  "hum it in" capture. Separate target, separate L-VERIFY, parked in the candidates ledger.

**Seat 3, 2026-08-19.** Clone retained in session scratchpad for porting; the pinned sha above
is the authority if the scratchpad is gone.
