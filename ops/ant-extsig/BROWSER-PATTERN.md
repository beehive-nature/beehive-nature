# The autonomi:// browser pattern — measured, not hoped (2026-09-04)

READ-ONLY probe against **antd 0.12.0** (the WithAutonomi/ant-sdk local
gateway daemon, arm64, running on the box, mainnet `arbitrum-one`, healthy:
`/health` 200 `{"status":"ok","evm_network":"arbitrum-one"}`). PATTERN ONLY —
nothing vendored, no estate surface modified.

## What it takes to render `autonomi://<address>` from a plain page, TODAY

Three layers, and the middle one is the whole story:

1. **THE REFERENCE** — the page carries `autonomi://<64-hex>` links/media.
   Zero cost, zero deps: it is just a URL.
2. **THE RESOLVER** — something must turn the address into bytes. The
   browser cannot: (a) the network's transport is QUIC + post-quantum crypto
   the browser sandbox doesn't speak, and (b) **ant-wasm is WIP** (dashed
   box in ant-sdk's own architecture diagram — the WebRTC-direct-in-page
   client does not exist yet). The shipped resolver is **antd**, a local
   Rust daemon exposing `GET /v1/data/public/<address>` (base64 payload).
3. **THE RENDERER** — fetch → decode → inline. The vendor's ant-webex
   extension does this via content scripts.

## The CORS wall, measured

`antd --cors` (env `ANTD_CORS`) exists and is required — but it does NOT
open the daemon to arbitrary page origins. Measured live:

```
GET /health with Origin: https://skaists.dev
→ access-control-allow-origin: http://127.0.0.1:8082   (the daemon's OWN origin)
```

A **plain page** on an estate surface therefore CANNOT fetch
`http://127.0.0.1:8082/v1/data/public/...` cross-origin — the browser blocks
the response. The roads around the wall, honestly:

- **The extension road** (ant-webex, MIT/Apache, Chrome 120+/Firefox 128+):
  extensions declare host permissions, which bypass page CORS. This is the
  vendor's shipped pattern; we would vendor nothing — the member installs
  the extension (or our own built from their MIT source if the founder
  wants an estate-branded one).
- **The same-origin proxy road**: the estate serves a proxy path
  (e.g. `https://<surface>/ant/<address>` → box-local antd) so the page's
  fetch is same-origin. Server-side per the onboarding law (walls solved on
  the box, never in the visitor's browser). Cost: the surface becomes a
  relay for reads — fine for read-only, and it is exactly the hive-board
  read-door shape.
- **The read endpoint shape, measured**: `GET /v1/data/public/<hex>` →
  `{data: base64}`; a mainnet-unknown address returns a TYPED error
  (`DataMap chunk not found at <hex>`, HTTP 500) — the daemon really queried
  the live network before answering.

## The estate verdict (PATTERN, no commitment)

When the vending machine's ANT layer wants `autonomi://` content rendered on
a member's page: same-origin proxy door for reads (onboarding law holds,
zero member installs), and watch ant-wasm — the day it ships, the resolver
moves INTO the page over WebRTC-direct and the proxy door retires. Until
then "WebRTC Direct browser client" is a roadmap line in their diagram, not
a thing a plain page can do; anything claiming otherwise would be vendored
fiction.

License posture: antd/ant-sdk/ant-webex = MIT OR Apache-2.0 (repo LICENSE
files verified) — clean to interoperate; nothing copied into the tree by
this lane beyond this report.
