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
`register.js`. Same facts in every view. Status, badge, plaque and
connect-count are rewritten by `speak()` on load, paint, fail, and
`bregister`.

- **New bee:** commons-short. Look / Feel / Choose. No builder jargon
  (no CORS, WASM, proxy, Pages, same-origin, daemon, DataMap, `/ant/v1`).
  Hex address is hidden. Live badge is `Here`. Fail is “Not this time.”
- **Raver:** garden / dusk / bloom / body / hunger. Celebration when the
  public picture lands (`It bloomed`). Empathic imagery, not a protocol
  lecture. No invented medical or dosing copy.
- **Cypherpunk:** door vs WASM, `/ant` proxy, `relay.skaists.dev`,
  network-tab story, hop badge `N BYTES · RELAY|SAME-ORIGIN · LIVE`.

Pages→relay fetch is unchanged (`doorBases`, `isPagesHtml`, `?door=`).

## Connect cards — atlas as source of truth

Founder correction: do not cherry-pick. After a successful paint, the
page fetches same-origin `index.html` and renders **every** `article.srf`
grouped by the atlas org/family sections (skaists, beehive-nature,
beehive-biomass, buds, bnr, …). Empty atlas families (buds’ open seat)
still appear from the atlas `.open-seat` copy. Names and hrefs come from
the atlas markup. `ant-door.html` is omitted because you are on it. The
atlas pin is `index.html`. No invented medical copy — bio surfaces keep
their atlas glosses.

Browser poke (Chrome against `e2e/ant-door-poke.mjs`) after the
three-view lock:

- Image naturalWidth **782**, **100** connect cards, eight families
  including buds (bsymposium, bEarth, bFood, gallery, Watch room,
  bantfarm, midivault, hearth, pulse still present).
- **New bee** badge `Here` · “It arrived. Look, then choose if you
  want.” · Look / Feel / Choose · hex hidden · no CORS/WASM/proxy.
- **Raver** badge `It bloomed` · “The garden just handed you a living
  picture.” · The gift / The seeing / The wander.
- **Cypherpunk** badge `138,931 BYTES · SAME-ORIGIN · LIVE` ·
  autonomi:// hex · Door vs Pages · Door vs WASM · Network tab story.

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
# tests 8  pass 8  fail 0
# (3 new: New bee jargon lock, Raver celebration lock,
#  Cypherpunk door/WASM/relay/network-tab lock)

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
installed in this environment (`require('playwright')` failed). Headless
Chrome against the poke URL (puppeteer-core, not in-tree) asserted the
three-view lock: bee `Here` / no hex / no WASM, raver `It bloomed`,
cypherpunk `138,931 BYTES · SAME-ORIGIN · LIVE` / hex / Door vs WASM,
image 782×1600, 100 atlas cards. Manual headed walkthrough recorded.

## Not done

- Box `/opt/buzz/deploy/compose/door/` was not overwritten (ops stay
  verbatim with the box; this is the Pages surface).
- No medical/health copy invented.
- No force-push. No secrets printed.
