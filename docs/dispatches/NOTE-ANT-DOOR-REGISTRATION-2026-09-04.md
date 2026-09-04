# NOTE TO z3.2 — ant-door.html registration (2026-09-04)

One new surface to the fleet bar, registered by note per the lane's fence
(z3.2 owns surfaces/ registration):

- **`surfaces/ant-door.html`** — the same-origin Autonomi door: a one-file
  estate page that fetches a known public Autonomi DataMap through
  `relay.skaists.dev/ant/v1/data/public/<hex>` (Caddy → box-local antd,
  GET-only, everything else under /ant/ refused 403) and renders the bytes
  client-side. tokens.css-only palette, vanilla JS, honest-state line
  carried ("served via the estate's door; direct browser access lands when
  Autonomi's WASM client ships") in three audiences (neighbor / builder /
  cypherpunk).
- Deployment: box door dir `/opt/buzz/deploy/compose/door/` (served at
  `https://relay.skaists.dev/ant-door.html`); in-tree copy is the source of
  record. No estate.json row expected from this seat (that gate is yours).
- Receipt: `e2e/ant-door-shot.mjs` → PASS — 390px render of 138,931 live
  Autonomi bytes, all network requests same-origin (the blob: URL is the
  rendered object, same origin by construction). Screenshot
  `e2e/shots-ant-door/ant-door-390.png`.
- Optional gloss: none requested; the surface carries its own copy.
