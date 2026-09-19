# 2026-09-19 · zCode · casing law + the AV-1 standing red (main heal)

ORDER (founder relay, three items, one chain): (1) bData's small title shows
"BDATA" — remove the forced case; (2) main is red on every push —
`tests.yml › static › AV-1 serve-bridge battery` fails at
"1.4c: crash header did not kill the server" (same on f7465f41 and 27fb5cf1) —
find the real cause, no skip, no retry-loop; (3) hub handshake for the
bGENEaLOGy registration — READ, acted on only when that lane lands (not this
chain). Fence honored: atlas.css / atlas-tree.mjs / watch.html / ant-door.html
untouched (Cowork's face lane).

## 1 · CASING LAW — LANDED

`surfaces/bdata.html` line 25: `.kicker` carried `text-transform:uppercase`,
rendering "BDATA — …". Removed the declaration (the ONLY forced case on the
page — grep-verified one `text-transform` in the file).

- CLAIM: the kicker renders mixed case, no forced case anywhere on the page.
- EVIDENCE: 390px Chromium over the changed worktree file — textContent
  `"bData — the organism-level data surface"`, computed `text-transform: none`
  (screenshot taken); bData gate re-run GREEN **85/85**; estate-source 11/11;
  estate-check PASS (96 counted, hub in sync). Gate's canonical review shot
  `e2e/shots-bdata/bdata-review-390.png` refreshed by the green run (in this
  commit).
- BOUNDARY NOT CROSSED: no other style, key, or markup touched on the page.

## 2 · THE AV-1 RED — CAUSE FOUND, BATTERY REPAIRED

- CAUSE (the real one): f065f76f (M-REPAIR R2 / AV-3) made meter.py's admin
  CHARGE own live door health — `gate_door_health()` probes
  `GATE_PROBE_URL` (default `http://172.18.0.1:8091/readiness`, the box's
  docker-bridge gate) and **PARKS** the charge when unreachable (typed 200
  `{parked:true}`, zero writes — deliberate park-not-kill law). The AV-1
  battery (43366499, older than the seam) spawns its server hermetically and
  never provided a door, so on CI **every charge parked**: the 1.4c crash
  hook sits AFTER the charge, unreachable → "crash header did not kill the
  server". Smoking gun in the RED run's own 1.2 line:
  `conservation exact (84.0000 − 0 = 84.0000)` — Σcharges 0, the battery's
  charge path had been passing VACUOUSLY since the seam landed.
- THE FIX (harness-side; meter.py untouched — the seam is production law):
  the battery's `Server` env now wires `GATE_PROBE_URL` to the bridge's own
  public view (`/v1/voucher/<key>/view`) — a real HTTP round trip, ANY answer
  = reachable per the seam's own law, stable across restart. `restart()`
  gained an `extra_env` patch (the URL is read at process start).
- NEW PROOF 1.5 pins the seam so it can never de-fang the battery silently
  again: door DOWN (closed loopback port) ⇒ charge parks typed
  (`parked:true, park_reason:"door"`, no `event`), ledger bytes IDENTICAL,
  idempotency key UNCONSUMED; door back on the SAME ledger dir ⇒ the SAME
  key charges exactly once.
- CLAIM: battery GREEN end to end.
- EVIDENCE: local run (WSL py3.14) — 6/6 proofs, twice consecutively; 1.2 now
  reads `84.0000 − 35.2000 = 48.8000` (charges genuinely execute); negative
  control re-meaningful (real double-charge caught). CI is authoritative on
  the PR.
- BOUNDARY NOT CROSSED: no skip, no retry-loop, no marker/xfail; production
  code (meter.py) unchanged; the other buzz-meter batteries share nothing
  with this file.

## 3 · HUB HANDSHAKE — READ, BANKED

The atlas guard: the moment a surface with id/path matching /genealogy/i is
registered in estate.json, `node scripts/build-atlas.mjs` throws ON PURPOSE.
In that same commit: `notYet` row becomes `<a class="keep-link line" …>`
keeping the title EXACTLY `<strong class="bgene" translate="no" dir="ltr">
b<b>GENE</b>a<b>LOG</b>y</strong>`, guard + state line dropped;
`e2e/atlas.test.mjs` "the keep rows promise only…" updated (3 keep-links, no
plain row); atlas rebuilt; `surfaces/index.html` committed. Face: house hand
at surfaces/fonts/burti.woff2 (names only), new-bee tokens in
`body[data-reg=bee]` (atlas.css — Cowork's file, read-only for me). NOT acted
on here — the genealogy lane has not landed its registration.

## NUMBERS

bData gate 85/85 · estate-source 11/11 · estate-check 96 counted / 105 listed
/ 3 orgs · AV-1 battery 6/6 (×2 runs) · 1 file CSS −1 declaration · battery
+63 lines (env wiring + restart patch + case 1.5 + harness-law docstring).
