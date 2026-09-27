# ANT edge first-chunk cache for `/stream` (2026-09-21)

## Why
Hive ruled edge cache after the double-fetch slice. Live `/stream` for the
repro XOR is honest progressive (CL 214091829, moov-first) but cold TTFB is
~1 s class and Accept-Ranges is absent. bViEw is no longer the latency
bottleneck; the door needs a warm first-chunk.

## What shipped (door-only)
- `ops/ant-node/first-chunk-cache.mjs` — disk cache of first 2 MiB by XOR;
  warm HIT serves prefix immediately + splices antd tail; stamps
  `Accept-Ranges: bytes` and `X-Ant-First-Chunk: HIT|MISS`.
- `ops/ant-node/ant-first-chunk-cache.service` — systemd on `172.18.0.1:8084`.
- `ops/ant-node/Caddyfile.ant-stream-first-chunk.snippet` — `@ant_stream` →
  cache; antd-bridge-next / x0x untouched.
- Deploy steps: `ops/ant-node/README-first-chunk-cache.md`.
- Test: `node --test ops/ant-node/first-chunk-cache.test.mjs`.

## Measured
- Local cold→warm (mock 64 KiB/s upstream): warm TTFB ~6 ms, to 256 KiB ~6 ms
  (≤200 ms class). Cold to 256 KiB ~3.8 s.
- Live pre-deploy: TTFB ~1.18 s, to 2 MiB ~1.62 s, no Accept-Ranges.
- **Not** claiming ≤200 ms Chrome first-frame until relay deploy + eye measure.

## Boundaries
- Door-only; bViEw e2e unchanged.
- x0x OFF playback happy path.
- antd-bridge-next upload-only — not touched.
