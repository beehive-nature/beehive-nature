# bViEw: stop 8K stalls with a seconds-based prebuffer (2026-09-26)

**Seat:** zCode (GLM). **Surface:** `surfaces/bview.html`. **Task card:** founder handoff
2026-09-26 — "written to produce proof, not advice." The ants.tube dispatch (#229, merged
`fef342c05`) named the pathology; this lane cures it in our own client.

## Why

The old rule started playback after a fixed `PLAY_MIN` = 12 MiB. For 8K that is 1–2 s of
content: the early Blob's mdat ends almost immediately, the playhead hits the frozen edge,
and the timeupdate hold clamps it there until the whole download lands. The viewer sees a
video that starts, stalls, and gives no honest answer to "when will this actually play?"

## The rule (replaces the fixed 12 MiB start)

Inputs are measured only — the door's Content-Length, the moov duration, the sliding-window
download rate the MB/s counter already keeps:

- **Play rate** = Content-Length ÷ moov duration (bytes per video-second).
- **Sustained start**: download rate ≥ 1.15× the play rate AND the buffer ahead (≥ 3 s of
  content, floor 1.5 MiB, and never less than what covers the rest of the download at the
  measured rate) — then the early Blob starts and plays to the finish swap without meeting
  the frozen edge.
- **Whole-file mode**: a pipe that cannot stay ahead never fake-starts. The countdown shows
  the honest whole-file ETA (remaining bytes ÷ measured rate) and the finish line plays the
  complete Blob. No start-then-freeze, ever.

The envelope (JSON base64) path estimates the decoded total from the measured
decoded/received ratio so the rule stays honest on the fallback path too.

## Device decode report

After the first frame paints (the bulk still ahead), the page asks
`navigator.mediaCapabilities.decodingInfo` at the **measured** frame size and measured
bitrate (H.264 High profile config). If the browser reports `!supported || !smooth`, bViEw
warns the viewer (`#s-decode`): "This device reports it cannot decode this video smoothly —
playback may stutter." The API is the browser's own verdict — cited, never invented; if the
API is missing the page stays silent (cite-or-silent).

## Honest UI

- `#eta`: keyed words ("Ready in" / "Whole file first — ready in", `bview.readyIn` /
  `bview.readyFull`) + the number in a `translate="no"` span — no interpolation machinery,
  word order safe across tongues.
- Cypherpunk sheet gains **Playback rule** (`bview.n.pre`, ×29 tongues): the measured ratio
  ("×0.6 rate/play · whole file first" / "×1.7 rate/play · start @ 4.7 MB") — cite-or-silent.
- `data-prebuffer` on the video element: `waiting` | `whole-file` | `sustained` — the state
  an inspector (or test) can read; the receipt lives on the page itself.

## Proof

`node --test e2e/bview.test.mjs` — **12/12** (9 existing unchanged + 3 new):

- **slow pipe** (64 KiB/40 ms ≈ 1.6 MB/s vs ≈ 2.5 MB/s play rate): rule computes mid-download,
  honest whole-second countdown visible and **counting down**, player NOT fake-started
  (paused preview, playhead ≈ 0), plays at the finish line, countdown retires.
- **fast pipe** (64 KiB/15 ms ≈ 4.4 MB/s): `sustained` start while bytes still arrive
  (counter well below the whole file, bar up), plays stall-free after the swap (clock
  advances unclamped), and no decode warning when the browser reports smooth.
- **decode warning**: a browser stubbed to report `smooth: false` raises the keyed warning.

390px receipts (`e2e/bview-prebuffer-shots.mjs`, fresh context per phase, old surface pulled
from git at run time — same mocked door, same fixture):

- `e2e/shots-bview/prebuffer-before-390.png` — old rule: bar + rate, no readiness answer.
- `e2e/shots-bview/prebuffer-after-390.png` — "Whole file first — ready in ~10 s".
- `e2e/shots-bview/prebuffer-after-fast-390.png` — sustained early start, bytes still arriving.

Gates run locally: estate-check PASS (104 counted, hub in sync — registry untouched),
estate-source 11/11 (4 new keys, every docked tongue covers, corpus English matches the page).

## i18n

4 new keys × 29 tongues (`bview.readyIn`, `bview.readyFull`, `bview.decodeWarn`,
`bview.n.pre`), machine-drafted (⚙) per the corpus `_meta` law, inserted textually before
`bview.slow` to keep the file's formatting.

## Boundary

- The decode probe cites the H.264 High profile config at measured dimensions — a file in
  another codec could decode differently than the report; the warning is the browser's
  report, not a client measurement of the file.
- Whole-file ETA is only as honest as the sliding-window rate; a collapsing pipe updates the
  number rather than lying once.
- Translations are machine drafts; a missing line falls back to English visibly.
- Live 8K measurement on the real repro was NOT run from this seat (no door drive tonight) —
  the mocked-door battery + the fixture's measured rates are the receipts here. · UNVERIFIED
  on real 8K until a founder browser pass or a live repro run.

## §7 shape of this commit

Author: the founder (`loVis waTer <loviswater44@gmail.com>`). Committer: the seat
(`zCode <zcode@skaists.dev>`) with a parsed `Co-authored-by:` trailer — the exact shape
`scripts/identity-check.sh` prescribes for seat work (T3 in its selftest). Verified locally
through the estate's own gate before push.
