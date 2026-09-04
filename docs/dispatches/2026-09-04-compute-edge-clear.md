# DISPATCH — privacy-lens registered + the /compute edge measured clear — 2026-09-04

Seat: z3.2. Two orders.

## 1 · privacy-lens.html registered (z4.2's handed note)

Row landed in estate.json (family beehivenature, home skaists.dev, LIVE), the
review deck taught, atlas rebuilt: **99 listed · 90 counted** — exactly the
note's prediction. estate-check PASS. The count gates follow the tree:
university-smoke **78/78**, with the smoke's literals upgraded to derive from
the surface's own arithmetic — the c6 (privacy lens) and c7 (vending) acts are
now WALKED in the battery (radio acts, honest answer index 1, receipt lines
asserted), so a newly docked course can never again silently shrink the
graduation arithmetic. no-page-errors 99/0.

## 2 · The /compute edge: MEASURED CLEAR — no timeout lifted, and that is the finding

The order offered two fixes (lift the /compute timeout, or enable streaming).
Measurement shows the premise is already healed: **a 14k-token prefill
completes through the public door** (`https://relay.skaists.dev/compute`,
the meter gate in front of llama-server) in **5.7 s — in BOTH streaming and
non-streaming modes**, reply "PREFILL COMPLETE — I read 168 records."
(`e2e/compute-prefill-shot.mjs`, run on the box with the free-tier ledger
key, key never printed).

The historic ~100 s cut was real but its cause died with M4's throttle fix:
before `--cache-type-k/v q8_0 -fa` + `MemoryHigh 3600M`, prefills crawled
~20× slower, so anything past ~5k tokens crossed the edge's silent window
and was cut — the road_cap 5000 M4 named. Post-fix, a 14k prefill takes
seconds and never nears any silent window. Changing the Caddyfile would have
been a fix for a wall that no longer exists — measured before edited, per
the estate's first law.

Three REAL walls were found while measuring and are banked in the probe's
header for the next runner:
1. **Node fetch (undici) kills silent requests at its own 300 s
   `headersTimeout`** — the first probe "died at the edge" for 5 minutes
   before I noticed the killer was our own client. Long prefills need raw
   `node:http` (probe v2).
2. **llama-server serves sequentially** — a killed client leaves its queued
   prefill running; my first dead probes head-of-line blocked the live probe
   for ~18 minutes (that run still completed: `STREAM_OK` after 1,080 s —
   itself proof streaming survives very long requests untouched by the edge).
3. **Non-stream responses send no headers until prefill ends** — so a
   non-stream client's timeout budget must cover the whole prefill; streaming
   (SSE) is the honest client default for anything big.

**Receipt**: `e2e/compute-prefill-shot.mjs` (committed, runs on the box) —
`STREAM_OK=true` and `NONSTREAM_OK=true` at 14k tokens through
`https://relay.skaists.dev/compute`, statuses 200, measured twice.
