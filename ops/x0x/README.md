# ops/x0x — x0x agent daemon on the hive box (lane x0x, 2026-09-05)

**What runs on the box** (verbatim in-tree: `x0x.service` + `x0xd.toml`):

- `x0xd` v0.41.2 (saorsa-labs/x0x, pre-built linux-arm64-gnu, option A) at
  `/usr/local/bin/{x0xd,x0x}`; system user `x0x` (`/var/lib/x0x`, nologin).
- systemd `x0x.service`: MemoryMax 512M · MemoryHigh 384M · CPUQuota 100% ·
  TasksMax 64 · IPAccounting=yes · ProtectSystem=strict · empty capability
  bounding set · StateDirectory=x0x. `ExecStartPre` = `x0xd --check`.
- Own identity dir `/var/lib/x0x/identity` (machine/agent ML-DSA keys NEVER in
  `~/.x0x`), data dir `/var/lib/x0x/data` (api.port + api-token live here).
- Config: loopback API `127.0.0.1:12700` only; daemon self-update OFF
  (`[update] enabled=false` — upgrades are founder-order tarball swaps, sha256
  + GPG verified); `zero_peer_restart_secs=600` top-level (supervisor law).
- Remote exec: DISABLED by default and left that way — `/etc/x0x/exec-acl.toml`
  deliberately ABSENT; `x0xd --check` and `x0x diagnostics exec` both receipt
  `enabled:false, disabled_reason:"acl_missing"`. Mobile: none (order: no).

**License (L-VERIFY at HEAD, v0.41.2 = 1ddbce0c-era):** Cargo.toml declares
`license = "MIT OR Apache-2.0"` — matches the SKILL claim. `LICENSE-MIT` is the
verbatim full MIT text (Copyright (c) 2025 Saorsa Labs, 1068 B). FLAG:
`LICENSE-APACHE` is a 763-byte Apache-2.0 NOTICE-form file, not the full text —
the Apache leg is declared + abbreviated in-tree (why GitHub API says
NOASSERTION). Adoption rides the verbatim MIT leg.

**Binary review before run:** tarball sha256 `a95d7465b3168d95…f6c226f0eb`
PUBLIC-CONSTANT (release asset .sha256, verified on box), GPG good signature
"David Irvine (code signing) <david@saorsalabs.com>" key CEB3 506E 7DCB 8A2D
D2D6 79E8 EDDA 4827 D89C 0F29 — TOFU against the release-shipped
SAORSA_PUBLIC_KEY.asc (honest bound: same-release trust). Contents: only
`x0xd`, `x0x`, LICENSEs, README.

## THE WALL (found live, blocks the box from the mesh)

Box UDP egress is port-allowlisted ABOVE the OS (iptables OUTPUT is ACCEPT):
DNS 1.1.1.1:53 → reply; NTP :123 → reply; STUN 74.125.140.127:19302 → silent
timeout; UDP 1.1.1.1:5483 → silent timeout. x0x is QUIC/UDP-only → ALL 24
embedded bootstrap dials (12 hosts × :443/:5483, v4+v6) time out; daemon runs
healthy but mesh-isolated (peers: 0). **Founder gesture to unblock: OCI
security-list/NSG egress UDP 443 + 5483** (optionally INPUT 5483/udp for
inbound dialing). Nothing else changes — the unit then joins on its own
(`zero_peer_restart_secs` restarts it into the mesh).

## Identities seated

- box agent `1ca00a42…8df66367` (words: boeing above destroy limb), display
  `hive-box`, machine `5e9ace67…7fe37bc9` — healthy, isolated by the wall.
- laptop (Windows) default instance at `C:\Users\travi\x0x-win\`, data
  `%APPDATA%\x0x`: agent `be9ad64a…5a656cb89` (words: resource plate aspire
  beechnut), display `hive-laptop` — 25 peers, send-ready.
- laptop named instance `--name second`: agent `97b09c05…f20cddb00`, display
  `hive-worker` — joined public group `hive-porch`
  (`2ab6a7e5…e9ad2470e`, preset public_open: open_join · signed_public ·
  public_directory · public read) via member-minted invite; posted + read back
  with correct attribution (msg `89eaa046…2bb3769e`, fan_out 6).

**Join law (found live):** v0.41.2 has NO inviteless join — not for open_join
groups either. `POST /groups/join` takes an invite; their own GUI's Join dialog
pastes `x0x://invite/…`; group cards carry no join capability; the live public
groups (Phase-B Fleet Dogfood etc.) have `request_access_enabled:false`.
Public groups are world-READABLE, member-JOIN is invite-only.

## Tailnet forward — PROVEN (round 4, 2026-09-05)

After the founder's OCI ingress **All-Protocols/all-ports stateful** rule
landed (the only rule kind that matches non-initial IP fragments — the
>1500 B PQ ServerHello flights arrive fragmented; see upstream data issue
saorsa-labs/x0x#505), the box joined the mesh on its own: **peers 8→28,
FullCone NAT, direct connections**, agent `hive-box` **joined hive-porch**
via laptop-minted invite (member 3, active, posted
`96680c7c…2323d4f7d` fan_out 6).

The forward, end to end: laptop CLI
`x0x forward add --local 127.0.0.1:18080 --peer <box-hex> --target-port 12700`
→ `curl http://127.0.0.1:18080/health` on the laptop answers **HTTP 200 in
~90 ms with the BOX daemon's own health JSON** (its peers/uptime), laptop
loopback → box loopback over post-quantum QUIC.

**LAWS found landing it (each one bit us):**
1. **Connect ACL on BOTH ends**: default DENY with the ACL file absent — the
   TARGET side gates the loopback connect, but v0.41.2's ORIGIN side also
   refuses forward creation with `409 no connect ACL loaded` until the
   laptop carries its own ACL. In-tree: `ops/x0x/connect-acl.toml` (box) +
   `C:\Users\travi\x0x-win\connect-acl.toml` (laptop mirror).
2. **Trust on BOTH sides**: the outbound `open_peer_stream` enforces the
   LOCAL trust decision — `contacts add` + `trust set <peer> trusted` is
   needed on the laptop for the box agent AND on the box for the laptop,
   else the local listener accepts TCP and closes in <1 ms with ZERO logs
   and zero stream counters anywhere.
3. **`x0x machines connect <box-machine-id>`** forces the direct transport
   session (printed `outcome: Direct` to 129.153.202.144:5483) when gossip
   view shuffling hasn't paired the two agents yet; `peer probe` alone says
   "Peer not found" until a session exists.

## Upstream defect found (shipped at v0.41.2 AND at HEAD)

The embedded GUI (`src/gui/x0x-gui.html`, served at `/gui`) closes the
`addEventListener('peer-lifecycle', e=>{…}` callback with `};` instead of `});`
— a one-character parse error that kills the entire ~4970-line script in EVERY
browser: the GUI renders its shell ("Connecting… 0 peers") with zero data
wiring. Introduced by `bdd3f46a` ("release: v0.41.1 — GUI event-stream
repair"). Receipt harness: `e2e/x0x-gui-proxy.mjs` (laptop) serves the daemon's
own HTML with exactly that one character fixed (asserted single substitution)
and reverse-proxies REST/SSE/WS — with it the GUI comes fully alive
(`e2e/shots-x0x/gui-laptop-one-char-fix.png`, `gui-laptop-public-group-chat.png`
— hive-porch + the seat-proof message + live peers, 0 page errors).
Session-token law verified: `/gui?token=` accepts ONLY a 10-minute session
token (`POST /auth/session`); the durable token is never accepted in a URL.

## Local receipt artifacts (untracked, laptop)

`e2e/x0x-gui-shot.mjs` (token-from-file screenshotter), `e2e/x0x-gui-proxy.mjs`
(one-char-fix proxy), `e2e/shots-x0x/` (4 shots: shell as-shipped, one-char-fix
live, public-group chat, box GUI over SSH tunnel).
