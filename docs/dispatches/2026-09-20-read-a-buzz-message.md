# READ A BUZZ MESSAGE — a guest reads a public thread in the browser

**Seat:** Cowork. **Date:** 2026-09-20. **Branch:** `cowork/read-buzz`.
**Founder catch:** he sent an outside reader a `buzz://message?...` address; the reader
had no Buzz app and no way to open it. *"i don't want to force visitors/guests to
download install the buzz app to read a thread/channel."*

**Measured first.** A brand-new key knocking on `wss://skaists.buzz` gets
`restricted: not a relay member` — the relay is members-only at the door, so a
browser cannot read it directly, and no member key belongs in a public page.

**The road taken (no new member, no founder key).** The relay box already publishes
`/hive/board.json`. bee-laborer added a read-only exporter on the same box:
`https://relay.skaists.dev/hive/public/index.json` and `/<channel-uuid>.json`, only
channels whose own flag is `visibility = open`; private, DM and kind 1059 never leave
the box. CORS is pinned to `https://skaists.dev`.

**The surface.** `surfaces/read.html` — paste a `buzz://message?channel=…&id=…[&thread=…]`
address (or arrive with it after `#`), and the message, its replies and the rest of the
channel's recent feed show in all three registers. Message text is set as text, never
markup; only `https://` links become links. Wrong address or a private channel gets one
plain row with the reason. No fetch happens until an address is given. 10 strings
(`read.*`) docked in en + 28 tongues by text insertion (the corpus layout is untouched),
all machine-drafted. Registered as `read-buzz` (100 counted).

**Gates:** estate-check PASS · front-door suite 367/367 · estate-source 11/11 ·
no-page-errors 109 walked, 0 errors · coverage floors: only the two known
environment-only floors (forge/room, or-board) fail locally.

**Not done here:** a "read without the app" road on the two buzz doors (hand-kept
files, own lane); the exporter scripts are not yet in `ops/` (bee-laborer's queue).

**Receipt:** the LIVE URL at 390px opening the founder's own address.
