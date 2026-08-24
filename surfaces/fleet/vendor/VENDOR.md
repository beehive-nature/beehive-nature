# VENDOR · chart.js — a record of what the fleet art depends on TODAY

ORDER FLEET-2 item 1. The fleet HTML is untouched and keeps its CDN URL forever;
this file records what that URL served on the capture date so the art's dependency
can never silently change underneath it.

| field | value |
|---|---|
| URL fetched | `https://cdn.jsdelivr.net/npm/chart.js` |
| resolved version | **4.5.1** (jsdelivr `X-JSD-Version: 4.5.1`, `X-JSD-Version-Type: version`) |
| bytes | 208,522 |
| sha256 | `48444a82d4edcb5bec0f1965faacdde18d9c17db3063d042abada2f705c9f54a` <!-- PUBLIC-CONSTANT: vendored chart.js 4.5.1 digest, pinned by ORDER FLEET-2 --> |
| captured (UTC) | **2026-08-24T04:07:04Z** |
| content-type | `application/javascript; charset=utf-8` |
| etag | `W/"32e8a-y1VYFBBM+7v4jk0bIQM7SVw8Wnc"` |
| build | UMD (`chart.umd.js` body — the no-version /npm/chart.js default) |
| license | MIT — banner in file head: "(c) 2025 Chart.js Contributors" |

Loaded by 7 of the 9 fleet HTML surfaces at runtime (FLEET-1 inventory): acid-cascade,
blend-lab, bnr-dashboard, flower-lab, indigo-index, resonance, spliff-lab.
The URL carries **no version pin** — jsdelivr floats it to the latest, which is exactly
why this byte-record exists: a re-fetch that disagrees with this sha256 means the art's
dependency moved, and that fact belongs on the bus, not in a silent render change.

Verify anytime: `curl -sL https://cdn.jsdelivr.net/npm/chart.js | sha256sum`
