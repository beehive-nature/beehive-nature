# bChat: a connection-health strip folded from the receipt stream

Seat: Claude (Seat 3). Date: 2026-10-06. Founder-relayed Codex order: fold the
doxx tungsten-test lesson into bChat as a UI and observability experiment only.
No doxx integration, no vendor dependency, no change to trust roots.

## What changed

- `surfaces/bchat-cockpit.js`: a pure projection, receipts in, lights and
  evidence rows out. There is no second health state machine. Five lights:
  identity, crypto, road, relay, receipt. A light is green only on its receipt:
  `key-armed`, `vectors-run` with every vector passing, a probed or opened
  primary road, an `OK true` to our AUTH or a publication, and a published or
  received event. An open socket alone is not "authed".
- The relay light carries the relay's own words when it refuses
  (`restricted: not a relay member`), in the guard tone, and stays that way
  after the socket closes. Fallback road is dotted and labelled; offline is a
  plain state of its own.
- `surfaces/bchat.html`: new receipts at real events only: `key-armed`,
  `key-forgotten`, `vectors-run`, `road-remembered` (local fact at boot),
  `road-probe`, `relay-dial`, `nip42-challenge`, `nip42-verdict` (the relay's
  OK to our AUTH, verbatim, which the page used to drop), `sub-closed`,
  `dm-offered`, `relay-closed`, `relay-error`, `net-offline`/`net-online`.
  Rejection notes now keep up to 160 characters, so a verdict is not cut.
- Under the title: the strip, then one collapsible "connection info" panel
  (road, dialled, socket open, NIP-42 challenged, AUTH answered, AUTH verdict,
  publication, relay verdict, EVENT → OK, last event prefix, session, counters).
  Tapping a light opens it. Timings are named application events: dial → open,
  challenge → AUTH, AUTH → OK, EVENT → OK. No ping, route or Rx/Tx is claimed.
- The three trust lanes, SIMULATED SMS, descriptor-only Autonomi, the posture
  card and the relay door prose are unchanged.

## Regressions

- `e2e/bchat-cockpit.test.mjs` (CI): a fresh page has no green light; each
  green needs its receipt; restricted renders as the relay's words, never
  success; fallback differs from primary; offline is a state; plaintext passed
  as receipt meta never reaches the projection. Local run: pass 5, fail 0.
- `e2e/bchat-eternal.test.mjs` (CI): five lights, none green on load, with no
  socket or external request; identity and crypto turn green only after their
  actions; a held send turns nothing green; a light opens its evidence; the
  message text appears in no light, evidence row or receipt.
