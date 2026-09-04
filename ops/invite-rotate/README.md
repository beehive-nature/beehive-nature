# invite-rotate — the standing invite never dies of old age

The join-by-address door (`/join/` + `join.json`, dispatch 2026-09-04) hangs
on ONE standing invite. Relay mint caps are TTL ≤ 30 days and ≤ 10 000 uses —
so the door decays by construction unless someone re-mints before expiry.
This lane automates that: a systemd timer that, before TTL/uses run out,
mints a fresh invite (owner/admin NIP-98) and rewrites `join.json` + the door
link — atomically, logged, fail-closed.

## The rotation law (what the script enforces)

1. **DECIDE** from state, not hope: the state file carries the live invite's
   `expires_at`/`max_uses`. No state (bootstrap) or remaining TTL below
   `ROTATE_MARGIN_SECS` ⇒ rotate. Uses cannot be read back from the relay
   (no read endpoint) — TTL is the binding trigger; set `max_uses` with
   headroom (default 10 000).
2. **MINT** `POST /api/invites` NIP-98-signed by the community owner
   (`{"ttl_secs":…,"max_uses":…}` — body covered by the `payload` tag).
3. **VERIFY BEFORE SWAP**: the fresh code's landing page (`GET /invite/<code>`
   on the tenant host) must answer 200 before anything is rewritten — a
   join.json pointing at a dead code is worse than an old one.
4. **SWAP ATOMICALLY**: `join.json` rewritten via tmp-file + `rename()` (the
   bind-mounted-inode law — mv, never in-place write), preserving every
   other field; `invite_url` becomes `/invite/<new code>`.
5. **LOG** one JSONL line per decision (rotations AND dry-runs) — the
   operator ledger the dispatch asked for.

## Deployment shapes on the box (`/opt/invite-rotate`)

- **`invite-rotate-test.timer`** (hourly) — the THROWAWAY rehearsal:
  a private buzz-relay instance (compose, `127.0.0.1:3311`, tenant
  `rotate-test.local`, throwaway owner key in `/opt/invite-rotate/secrets/`)
  + its own `join.test.json`. Nothing here can touch skaists.buzz.
- **`invite-rotate.timer`** (daily) — the skaists.buzz run in **DRY-RUN**:
  reads the LIVE `/opt/buzz/deploy/compose/join/join.json`, logs what it
  would mint and rewrite, writes NOTHING. It stays dry-run until the founder
  grants bClaude admin on skaists.buzz — then `ROTATE_DRY_RUN=0` plus the
  owner key in the unit's EnvironmentFile is the entire cutover. (Honest
  limit: with no admin key there is no way to read the live v2 code's TTL —
  the dry-run line says so instead of guessing.)

## Files (in-tree verbatim = what runs on the box)

- `invite-rotate.mjs` — the one script (node, nostr-tools for NIP-98)
- `compose.rotate-test.yml` — the throwaway relay + postgres (own DB, own
  port, loopback-only; no redis — absent = exact single-instance behavior)
- `invite-rotate-test.{service,timer}` / `invite-rotate.{service,timer}`
- `package.json` — the nostr-tools pin

Deploy: `rsync`/`scp` this dir to `/opt/invite-rotate`, `npm install`, keys
via the gen step in the service EnvironmentFile, `sudo systemctl enable --now
invite-rotate-test.timer`.

## Traps the first boot caught (all receipted in the lane log)

- A relay deployment needs more than the docs imply: `BUZZ_RELAY_PRIVATE_KEY`
  (stable signing key) when membership is required; a **minio** instance AND
  its `buzz-media` bucket pre-created (`mc` via
  `docker run --entrypoint sh -v init.sh …` — the mc image's entrypoint is
  `mc`, and alias/bucket must happen in ONE container: `--rm` kills the alias
  between runs); and **redis — the NIP-98 HTTP replay guard is redis-backed
  and fail-closed** ("absent = single-instance" covers pubsub only).
- node's `fetch` (undici) treats `Host` as a forbidden header and SILENTLY
  drops it — the script's HTTP layer is `node:http`, where tenant routing
  via Host header actually works.
- Two identical mints inside one second produce byte-identical NIP-98 auth
  events → the replay guard (rightly) refuses the second. Every auth event
  carries a random `nonce` tag, unique by construction.
- The NIP-98 `u` tag names the relay's OWN origin (canonical-origin signing
  law, join-by-address lane), while transport rides the loopback URL.

