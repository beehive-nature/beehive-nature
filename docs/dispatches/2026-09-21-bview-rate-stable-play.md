# bViEw rate + stable play (2026-09-21)

Mid-download 2 MiB Blob refreshes thrashed decode and still skipped to the end (full moov duration, short mdat).

- Show `MB · MB/s` on the counter
- Phase A: first-frame preview paused at 0 (no autoplay)
- Phase B: start play once ≥12 MiB local
- Final swap on complete; discard end-skip playheads
