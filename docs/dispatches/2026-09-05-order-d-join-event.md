# ORDER D — JOIN BY ADDRESS: the owner-signed join event (2026-09-05)

Order: "a phone joins a buzz community by pasting the relay address alone;
no desktop, no QR, no second machine" — upgraded from the landed
join.json door to a SIGNED NOSTR EVENT served by the relay wire itself.

## 1 · The pairing flow read (cited)

- The phone's "Add Community" (mobile PairingPage, `addingCommunity=true`)
  accepts ONLY a desktop-generated pairing code: `nostrpair://` (NIP-AB —
  QR/typed, `pair()` → `_pairNipAb`) or legacy `buzz://` base64url JSON
  {relayUrl, nsec…} (`_pairLegacy`, mobile/lib/features/pairing/pairing_provider.dart:123-136,
  833-867). The desktop side generates the NIP-AB code + SAS verification
  (desktop/src/features/onboarding/ui/IdentityRecoveryPairing.tsx;
  mobile/lib/features/pairing/pairing_page.dart — "Verify Security Code").
  No URL path existed on the phone before this order.
- The desktop app already accepts a bare wss:// in Add Community
  (desktop/src/features/communities/ui/AddCommunityDialog.tsx →
  InviteRedeemForm normalizeRelayUrl path) — but against a members-only
  relay it hits the invite wall with nothing to fetch.

## 2 · The relay now publishes + serves the join material (kind 34550)

- **Kind** `KIND_COMMUNITY_JOIN_MATERIAL = 34550` (NIP-29's
  community-definition kind, reused as the carrier — crates/buzz-core/src/kind.rs).
  Owner/admin-scoped to publish (`Scope::AdminChannels` in
  crates/buzz-relay/src/handlers/ingest.rs — a member key cannot forge
  the join material), community-global, parameterized-replaceable by `d`
  tag (invite rotation re-publishes in place).
- **Tags**: `d` = community host (the replaceable key) · `name` ·
  `origin` = the canonical ws origin (the AUTH relay tag clients must
  sign). **Content** = the same v1 JSON join.json carries
  (community/invite_url/default_channel/rooms).
- **The one unauthenticated read**: req.rs serves a REQ whose every filter
  pins exactly kinds:[34550] (no other scoping, limit ≤ 8) to
  UNAUTHENTICATED connections — fail-closed shape guard, unit-tested
  (`join_material_shape_guard_pins_the_kind`, run on the box: 1 passed);
  the query is pinned to global rows of that kind, so no member data can
  appear on the path. This is what makes "knows only the wss:// URL"
  sufficient: fetch the event → mint in-pocket → claim the standing
  invite → NIP-42 AUTH → live.
- **DEPLOYED TO PROD**: buzz-prod-relay-1 now runs the fork binary
  (built in a bookworm container on the box — the host-glibc binary
  crashed on the image's 2.36, rolled back within a minute, receipt
  below) volume-mounted over the stock image's
  /usr/local/bin/buzz-relay (compose.yml +1 volume line, backup kept:
  compose.yml.bak-pre-join-event). Zero new hosted dependency.

## 3 · Client sides (state of each)

- **WEB (the estate fork, PR block/buzz#7311 @eeb252286)**:
  web/src/features/join/join-event.ts fetches the event off the wire
  (unauthenticated REQ, fail-closed parse, the same well-formedness law
  as join.json); JoinPage tries THE WIRE FIRST, join.json stays the
  fallback; body[data-join-source] records which path served.
  **DEPLOYED**: the door at relay.skaists.dev/join/ now runs this build
  (vite --base /join/, in-place file copy — the bind-mount inode trap
  bit during deploy: replacing the join/ dir orphans caddy's mount
  (door 404); healed by in-place content copy + caddy restart, banked).
- **MOBILE (the same fork/PR)**: pair() now dispatches wss:// URLs to
  join_by_address.dart — the full phone protocol in Dart: fetch the event
  over a raw socket → mint the key IN-POCKET (nostr.Keys.generate —
  never "do you have a key") → claim over HTTP with the NIP-98 `u` tag
  naming the CANONICAL url while transporting on the pasted road →
  NIP-42 AUTH with the canonical origin in the relay tag must return
  OK true → Community stored against the canonical origin. CI-gated by
  the repo's mobile job (flutter) on the PR; NOT built on this seat
  (no flutter toolchain — FLAGGED).
- **Upstream PR**: block/buzz#7311 updated (fork skaists/buzz,
  branch join-by-address — the lane's standing single PR).

## 4 · Receipts

- **The full event path PROVEN LIVE on the throwaway rotate stack**
  (invite-rotate-test-relay-1 running the same fork binary; owner key
  from /opt/invite-rotate/secrets — env only, never printed):
  `ops/join-event-publish.mjs --live` AUTHed as owner (OK true),
  published kind 34550 (OK true), and **verified the stranger's way: a
  fresh UNAUTHENTICATED REQ returned the event**.
- **Browser receipt at 390px** (e2e/join-by-address-event-shot.mjs, ALL
  PASS): a cold phone context typed ONLY `ws://127.0.0.1:3311` (the
  tunneled throwaway) → body[data-join-source]=**event** (the material
  came off the wire, join.json never consulted) → room live → sent +
  received its own message → zero page errors. Shots:
  e2e/shots-buzz/join-event-390-{address-only,room-live,sent}.png.
- **Prod no-regression** (e2e/join-by-address-shot.mjs): 7/8 PASS —
  join → room live → history → send/receive → fail-closed → zero page
  errors; the one FAIL is the identity-panel assertion, pre-existing
  door-build drift (present before this order's deploy, unchanged by it).
- **The founder's phone (caffeine)**: NOT driven from this seat — no
  adb/flutter here (FLAG). The phone joins today via its browser +
  /join/ (json fallback, regression-proven); after the owner gesture
  below the same door serves from the event.

## 5 · The founder gesture (staged, the invite-re-mint law)

`ops/join-event-publish.mjs` on the box (~/src/web/): dry-run by default,
`--live` refuses without `BUZZ_OWNER_SEC` (the OWNER nsec/hex — the
founder's custody; nobody else holds it: the admin a376d913 is
"pre-existing; identity unconfirmed", bClaude is member-only). One run
publishes the event on relay.skaists.dev and verifies the unauthenticated
REQ returns it. Until then the prod door runs its proven json fallback —
nothing is lost, nothing is guessed.

## Traps banked this lane

- Host-built ARM binaries link the host glibc — the image (Debian 12,
  glibc 2.36) refuses GLIBC_2.38/2.39; build in `rust:1.95-bookworm`
  (and mind cargo reusing the host's target dir).
- The bind-mount inode trap strikes DIRECTORY replacement (rm -rf join &&
  cp): caddy's /srv/join mount orphans → 404; heal = in-place content
  copy (find -mindepth 1 -delete + cp), caddy restart re-binds.
- Door deploys must keep join.json (a door-side static file, not in the
  web dist).
- psql -t -A INSERT..RETURNING appends "INSERT 0 1" — pipe through
  head -1 when capturing.
