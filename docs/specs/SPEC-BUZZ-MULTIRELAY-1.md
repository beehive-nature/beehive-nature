# SPEC-BUZZ-MULTIRELAY-1 — one community, many roads

Status: PROPOSED (founder ask 2026-08-31: "seems like there should be a way for
me to put in multiple relays?") · Mirror: block/sprout @ box:~/src (Apache-2.0)

## THE FINDINGS AT SOURCE (2026-08-31)

1. **The relay is single-road by design.** ARCHITECTURE.md, verbatim: "The relay
   is the single source of truth. All reads and writes flow through it. There is
   no peer-to-peer event exchange, no gossip, no replication — just clients
   connecting to one relay over WebSocket."

2. **The client holds ONE address per connection.** Evidence: the desktop app's
   `managed-agents.json` carries `relay_url` as a plain string (19 entries on the
   founder's machine — the same agent appears once per community); the webview's
   community store holds single `wss://` strings; a source-wide grep for
   fallback/multi-relay schemas across `apps/` and `crates/buzz-core` returns
   nothing (the only "fallback" hits are unrelated pairing-code paths). There is
   no relay LIST anywhere in the client today.

3. **"Multiple relays" already exists as multiple communities** — the app joins
   N communities, each exactly one relay. That is breadth, not resilience.

4. **The estate already solved the SERVER half.** Dual-home (LANE G, the
   host-rewrite law) makes `skaists.buzz` and `relay.skaists.dev` the SAME
   community — same relay process, same rooms, same keys, same NIP-42 auth. Two
   names, one truth. Verified from a filtering wifi: door 200, wss 101/101.

5. **Filters make the gap acute.** The founder's building wifi RSTs `.buzz`
   (SNI-level, proven 2026-08-31) and kills the vendor's
   `*.communities.buzz.xyz` too. Single-road clients on filtered networks are
   dead clients. The clean roads are the difference between VPN and no VPN.

## §roads — the client design (the build)

A community entry holds an ordered address LIST instead of one string:

- **§identity** — the community's canonical name (`skaists.buzz`) is identity,
  never transport. It stays what the community is CALLED; the ORIGIN RULING
  carries over unchanged.
- **§transport** — the list is pure transport. Connect strategy =
  last-known-good road first; fail over on TCP/TLS failure or auth rejection;
  re-probe the identity road periodically (the buzz-studio ROAD MEMORY pattern,
  ported native). Every road of one community yields identical events — that is
  already true server-side via dual-home, so NO protocol change is needed for
  v1.
- **§invite** — invite links carry the road list (v2 payload gains a `roads`
  array; single-address links stay valid forever).
- **§surface** — the community UI shows the active road as one quiet word
  (honesty law: the user can SEE they are on the guaranteed road).

## §onboarding — the law that motivates the whole spec (founder, 2026-09-01)

**A VPN can never be an onboarding step. Two hundred neighbors will not install
one.** The road toggle (`buzz-road.mjs`) was a diagnostic — it told us where
the wall was; it was never the answer. A guest's first minute inside the
community must cost zero configuration, zero tools, zero network knowledge:
open the invite, be in the room. Any design that requires the user to know
what an SNI is has already failed the two hundred.

## §launch-override — the founder's fact, verified at source

`crates/buzz-acp/src/config.rs:240`:

    #[arg(long, env = "BUZZ_RELAY_URL", default_value = "ws://localhost:3000")]

- **BUZZ_RELAY_URL before launch** (or the `--relay` arg) sets the relay with
  no app surgery; the relay address is also swappable inside the app. The same
  relay under a different name clears a hostname-keying middlebox with no VPN.
- **The default value is the ghost's origin**: any binding without an explicit
  relay inherits `ws://localhost:3000` — which is how an empty `relay_url`
  landed LoVis bee-laborer on the WSL dev relay's idle loop (cleaned
  2026-09-01). A road-list client makes this class of accident impossible:
  there is always an explicit, remembered road, never a silent default.

## §fractal — the server design (the next lane, named honestly)

Roads-as-names protect against FILTERS, not against BOX LOSS. The founder's
"fractal anchored relay redundancy, autonomously scaling/contracting
nodes-relays" is replication + elasticity — upstream buzz has NEITHER ("no
gossip, no replication"). That is a protocol extension, not a client patch:

- relay advertises peer relays (a NIP-11 extension field, e.g. `peers`);
- signed events replicate relay-to-relay per community (anchor = the community's
  pubkey set; fractal = any member relay can serve the whole log);
- scaling/contracting = membership-driven: a community's relays join/leave by
  lease, the client road list updates from the anchor.

Scope guard: §fractal is SPEC'd here, BUILT nowhere. §roads is the buildable
lane — it delivers the founder's daily need (many roads, one community, zero
VPN) without waiting for replication.

## §bridge — what runs until the client ships

- `scripts/buzz-road.mjs` — one command flips every estate reference in the
  desktop app between the clean roads and the identity roads (live-reload via
  the app's own config watcher; timestamped backups; never touches vendor-host
  entries).
- The human account joins via the clean doors (`https://relay.skaists.dev`,
  `https://relay2.skaists.dev`) — invite links there ride the clean host
  end-to-end.
- buzz-studio.html ROAD MEMORY already models the exact §roads behaviour in the
  web surface — the reference implementation of the feel.

## §contribute — the estate IS the bleeding edge

The monorepo is Apache-2.0 and mirrored. The lane: build §roads as a fork on
the estate hives, prove it through a real filter (the building wifi is our
test bench), then PR upstream to block/sprout. Fork-to-prove, PR-to-lead — the
estate's name goes on the feature every buzz community inherits.
