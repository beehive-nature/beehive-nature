# DISPATCH — buzz JOIN-BY-ADDRESS — 2026-09-04

Seat: z3.2. Order: "a stranger with ONLY a phone and the relay address must
end up in the room." Landed: client capability in the buzz monorepo
(fork `skaists/buzz`, branch `join-by-address` @ 7605d1e), proven live on the
estate hives, PR upstream **block/buzz#7311** per SPEC-BUZZ-MULTIRELAY-1
§roads (fork-to-prove, then PR).

## The founder's ruling, implemented

Desktop pairing (NIP-AB device handoff, or an invite code + NIP-07 extension)
is not scalable: every path through it needs a second machine or an installed
tool. Join-by-address is one input wide: paste `wss://relay.skaists.dev` →
the relay serves the community's pairing material itself → the key is made on
the phone → the room opens. Zero configuration, zero tools, no VPN, no
toggles — the onboarding law, held.

## What exists now (all client-side; the stock buzz-relay 0.2.1 untouched)

- **`web/src/shared/lib/local-identity.ts`** — a PERSISTENT browser-local key
  (generated once, localStorage, exportable nsec, honestly labeled). This is
  the load-bearing piece: upstream gated durable membership behind NIP-07
  because the old fallback key was page-lifetime and would strand memberships
  on reload. A persistent local key closes that gap; NIP-07 remains preferred
  when present; `requireNip07` flows unchanged.
- **`web/src/features/join/`** — the one-input join: normalize the address
  (`shared/lib/address.ts`), read `join.json` from the relay origin
  (`join-material.ts`), accept terms when the community has them, claim the
  standing invite, land in the room. Fail-closed everywhere: no material
  published → a plain refusal, never a guess.
- **`web/src/features/room/`** — a persistent NIP-42 room connection
  (AUTH challenge → signed kind 22242 → REQ only after the AUTH's OK) and a
  phone-first room view on the NIP-29 wire (kind 9, `#h` = channel UUID):
  history, live subscription, composer, relay verdicts verbatim.
- **THE CANONICAL-ORIGIN SIGNING LAW** (found live, fixed client-side): NIP-98
  `u` tags and NIP-42 `relay` tags must name the community's CANONICAL origin
  as the relay declares it (NIP-11 `/info` → `push.origin` — for skaists that
  is `wss://skaists.buzz`), while TRANSPORT rides the road the stranger was
  given (`relay.skaists.dev`). Signing the alias is refused
  `401 URL mismatch`; connecting the socket to the canonical host would die on
  SNI-filtered networks. Sign the identity, ride the road. This bites any
  client behind an alias host — the PR carries it upstream.

## Estate deployment (fork-to-prove on the hives)

- `/opt/buzz/deploy/compose/join/` — the built join page (vite base `/join/`)
  + **join.json** (community skaists.buzz, the standing invite
  `v2.nyPI…a5wk`, default channel `welcome-everyone`
  `06f1aa06-d646-58c8-a3a9-5898241adf43`).
- `compose.join.yml` (caddy volume) + Caddyfile join blocks in BOTH skaists
  site blocks (backup `Caddyfile.bak-pre-join`): `/join/` (SPA fallback) and
  `/join.json` served CORS-open (`access-control-allow-origin: *` verified
  live) so any hosted join page can resolve any relay address.
- The estate door is now phone-first: "stranger with a phone, no app, no
  account? → join in your browser" (backup `index.html.bak-pre-join`).

## Receipts

- `e2e/shots-buzz/join-390-address-only.png` — the phone, cold context, no
  extension, ONE line typed: `wss://relay.skaists.dev`
- `e2e/shots-buzz/join-390-composing.png` — composing in the room
- `e2e/shots-buzz/join-390-in-the-room.png` — **THE ORDER'S RECEIPT**: #welcome-everyone
  · skaists.buzz · live, history rendered, the phone's own message delivered
  ("hello from a phone with one address — no app, no extension, no second
  machine"), identity disclosure with the export-your-key warning
- `e2e/shots-buzz/join-390-fail-closed.png` — `wss://relay2.skaists.dev` (no
  material published) refused in plain words
- `e2e/join-by-address-shot.mjs` — the browser receipt script (8/8 PASS,
  twice — before and after the deploy rebuild)
- `e2e/join-by-address-phone-truth.mjs` — the headless server-side truth run
  (runs on the box beside the monorepo web/ for nostr-tools): fresh key →
  claim 200 joined → AUTH ok (canonical relay tag) → room messages → EOSE.
  This harness found both protocol laws (canonical signing, AUTH-OK-gated
  REQ) before the browser ever ran.

## Standing-invite facts (the operator ledger)

The door's standing invite (`v2.nyPI…a5wk`) is ALIVE and was re-verified by
claim. Mint caps are the relay's own: TTL ≤ 30 days, ≤ 10 000 uses — **a
standing invite must be re-minted by an owner/admin key before it expires;
join.json must then be updated with the new code.** The lane's test claims
added member rows (roster, newest first): bb0e6a1a…, be03b1cc…, 7ac07d0a…,
8e004262…, 6d82fb85… — owner-revocable; listed here for that purpose.

## Checks

Monorepo: `pnpm check` (biome + file-size + pubkey-truncation) green ·
`tsc --noEmit` clean · `vite build` clean (default base and `--base=/join/`).
Estate: the receipt script is the gate; CI unchanged by this lane's repo files
(docs + e2e artifacts only).
