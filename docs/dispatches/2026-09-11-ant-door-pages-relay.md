# Autonomi door — Pages fetch + gold remodel (2026-09-11)

Lane: ant-door on `skaists.dev/surfaces/ant-door.html`.
Worktree: this cloud seat (`/workspace`), branch `cursor/ant-door-relay-gold-a3b2`.
Shared checkout and other seats were not used for `git add`.

## Symptom, re-checked

Live Pages page fetched same-origin `/ant/v1/data/public/<ADDR>` and painted
UNREACHABLE / “door answered 404”.

Verified just now:

- `GET https://skaists.dev/ant/v1/data/public/<ADDR>` → **404 HTML**,
  `server: GitHub.com` (Pages, no Caddy door).
- `GET https://relay.skaists.dev/ant/v1/data/public/<ADDR>` with
  `Origin: https://skaists.dev` → **200** `application/json` `{data: base64}`
  JPEG, **138,931** decoded bytes, magic `FF D8 FF`,
  `access-control-allow-origin: https://skaists.dev`.
- `HEAD` on the relay path is **403** (GET-only). That is the door, not a
  network miss.

Hypothesis held: Pages never had the same-origin `/ant` proxy. The door
lives on `relay.skaists.dev`.

## Fix

`surfaces/ant-door.html` now chooses a door base:

- `skaists.dev` / `www.skaists.dev` → `https://relay.skaists.dev`
- `relay.skaists.dev` → same-origin
- anywhere else (local poke) → same-origin first, then relay
- query override: `?door=relay` or `?door=same`

A same-origin **Pages HTML** body is treated as “not the door” and the
next base is tried. Autonomi 5xx stays an honest “network quiet”. CORS
failures on preview origins say to use skaists.dev or the poke proxy.

Public address unchanged (PUBLIC-CONSTANT on the same line as the 64-hex).

## Remodel

Gallery chrome pattern: experience nav, visible language host, expandable
`data-tour-host` footer, New bee / Raver / Cypherpunk via `tour.js` →
`register.js`. New bee is calm (view / emotion / choose — no step list).
Raver celebrates when bytes land. Cypherpunk carries endpoint, Pages vs
relay, door-vs-WASM, and the network-tab story.

## Connect cards — atlas as source of truth

Founder correction: do not cherry-pick. After a successful paint, the
page fetches same-origin `index.html` and renders **every** `article.srf`
grouped by the atlas org/family sections (skaists, beehive-nature,
beehive-biomass, buds, bnr, …). Names and hrefs come from the atlas
markup. `ant-door.html` is omitted because you are on it. The atlas pin
is `index.html`. No invented medical copy — bio surfaces keep their
atlas glosses.

## Poke path

```
node e2e/ant-door-poke.mjs           # stay up
node e2e/ant-door-poke.mjs --check   # assert proxy + live relay
```

Local URL printed as `http://127.0.0.1:<port>/surfaces/ant-door.html`.
The poke server proxies `GET /ant/v1/*` to the relay so same-origin works
on localhost (relay CORS is skaists.dev only).

Pages preview after deploy: `https://skaists.dev/surfaces/ant-door.html`.

## Registry

`estate.json` gloss dropped the false “same-origin” claim. `node
scripts/build-atlas.mjs` rebuilt the hub so the atlas card matches.

## Tests run this lane

```
node --test e2e/ant-door-pages.test.mjs
# tests 5  pass 5  fail 0

node e2e/ant-door-poke.mjs --check
PASS proxied door HTTP 200
PASS proxied door JSON envelope
PASS page served
PASS atlas connect fetch
PASS live relay 200
PASS live relay CORS

node scripts/estate-check.mjs
PASS estate-check — 93 counted · 102 listed · 26 domains
```

Live relay GET from this seat: 200, 138,931 JPEG bytes, CORS
`access-control-allow-origin: https://skaists.dev`. Playwright was not
installed in this environment (`require('playwright')` failed); image
paint is verified in the poke JSON envelope (`/9j/` JPEG) plus the
browser walkthrough against the local poke URL.

## Not done

- Box `/opt/buzz/deploy/compose/door/` was not overwritten (ops stay
  verbatim with the box; this is the Pages surface).
- No medical/health copy invented.
- No force-push. No secrets printed.
