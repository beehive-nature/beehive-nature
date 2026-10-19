# READER NOTES — Buzz as it is (architecture, must-keep, scale and censorship failure)

Reader area: Buzz today. Read-only. No design here. Every line carries a citation and a class:
RULED (founder or governing text) · MEASURED (receipt with real output) · CLAIMED (asserted, no receipt here) · UNVERIFIED.

Path keys used below:
- `BZ/` = `C:/Users/travi/buzz-src/` (the skaists/buzz fork checkout)
- repo-relative paths = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3/`
- `MEM/` = `C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory/`
- `UP` = live `gh api repos/block/buzz` reads made 2026-10-15/16 (read-only)

## 0. Version pins (read these first, everything else is relative to them)

- MEASURED: `BZ/` HEAD is `e1035672` on branch `desktop-build/0.5.21-canonicalfix`; `git rev-list --left-right --count upstream/main...HEAD` = `354  8` (354 behind, 8 ahead) against the LOCAL ref `upstream/main` = `4e1770aa` (2026-09-18). The local upstream ref is itself stale.
- MEASURED (UP): real upstream `main` head `93ffc37cbd` at 2026-10-16T00:33Z; latest release `desktop-v0.5.28` 2026-10-09; Apache-2.0; not archived; 3,631 open issues.
- CLAIMED: installed desktop is a zCode fork build 0.5.21, "there is no upstream 0.5.21" (`MEM/buzz-installed-desktop-is-zcode-fork.md:8-11`). Never "update" it to stock (same file :13-17).
- CLAIMED: box relay image `ghcr.io/block/buzz:0.2.1`, built 2026-08-08, 18 migrations behind (`C:/Users/travi/.buzz/RESEARCH/BUZZ_FEATURE_MAP_2026-09-18.md:13`). The relay for `skaists.buzz` later moved to Hostinger 2.25.245.161 (`MEM/handoff-2026-10-03-three-lanes-and-ant-review.md:17`). UNVERIFIED: which relay image runs on Hostinger today.
- Upstream ARCHITECTURE.md on main still says the same single-source-of-truth sentence (UP `ARCHITECTURE.md` line 7, fetched copy in scratchpad `pqbuzz/upstream-ARCH.md:7`). MEASURED (fetch).

## 1. The event model

Wire format (CLAIMED, upstream doc; consistent with code reads):
- Every action is a NIP-01 event `{id, pubkey, kind, tags, content, sig}`; id = SHA-256 of canonical serialization; pubkey = secp256k1; sig = Schnorr (`BZ/ARCHITECTURE.md:103-114`). "The `kind` integer is the only dispatch switch" (`BZ/ARCHITECTURE.md:116`).
- Kind ranges: 0-9999 standard, 10000-19999 replaceable, 20000-29999 ephemeral (not stored, not audited), 30000-39999 addressable, 40000-49999 Buzz custom (`BZ/ARCHITECTURE.md:118-126`). 129 `pub const KIND_` in `BZ/crates/buzz-core/src/kind.rs` (MEASURED grep count).
- Limits: frame 65,536 B; 1,024 subs per connection; 500 historical results per filter (`BZ/ARCHITECTURE.md:161`); handler semaphore 1,024 (`:271`).

Kinds that carry the product (all from `BZ/crates/buzz-core/src/kind.rs`, line numbers in parentheses):
- Chat: 9 stream message (479), 40002 v2 (481), 40003 edit (483), 40004-40008 pin/bookmark/scheduled/reminder/diff (485-493), 7 reaction (58), 5 deletion (56), 40100 canvas (495), 40099 system message (497), 45001-45003 forum (550-554).
- NIP-29 groups: 9000/9001/9002/9005/9007/9008/9009/9021/9022 (335-351); relay-signed 39000-39003 (422-428). Membership notices 44100/44101 relay-signed (`BZ/NOSTR.md:132-139`).
- NIP-43 relay membership: 13534 roster, 8000/8001 deltas, 9030-9033 admin (398-404; `BZ/NOSTR.md:272-277`).
- Auth: 22242 NIP-42 (77), 27235 NIP-98 (83), 24242 Blossom auth (79), 24243 identity binding (81).
- DMs: 1059 gift wrap (60) accepted; 30622 DM visibility (449).
- Ephemeral: 20001 presence (463), 20002 typing (467), 24134 pairing (465), 24200 agent observer frame (469), 24810 huddle reaction (472).
- Agents: 10100 agent profile (87), 30174 engram (94), 30175 persona (196), 30176 team (282), 30177 managed agent (291), 30178 team catalog (319), 30179 private managed agent (118; relays MUST reject until gates land, `BZ/docs/nips/NIP-PMA.md:3-5`), 44200 turn metric (545), 43001-43006 jobs (518-528).
- Workflows: 30620 def (442), 46001-46012 run/approval events (564-582), 46020 trigger (558), 46030/46031 approval grant/deny (560-562).
- Huddles: 48100-48103, 48106 (590-598).
- Git (NIP-34): 30617/30618 repo, 1617 patch, 1618/1619 PR, 1621 issue, 1630-1633 status (605-623).
- Push lease 30350 (109); reminders 30300 (102); moderation 9040-9044, report 1984 (327-370).

Auth surfaces:
- NIP-42: relay sends challenge immediately, client must AUTH before EVENT/REQ (`BZ/ARCHITECTURE.md:183-196`); ±60 s tolerance (`:387`). Handler order in code: crypto verify → community ban gate with NIP-OA owner cascade → pubkey allowlist → relay membership (with NIP-OA fallback) → materialize owner mapping (`BZ/crates/buzz-relay/src/handlers/auth.rs:86-282`). MEASURED (code read).
- The NIP-42 `relay` tag the server expects is `scheme://tenant.host()`, NOT the config host (`BZ/crates/buzz-relay/src/api/bridge.rs:225-232`). MEASURED (code read). Consequence: the community's DNS name is inside every AUTH proof.
- NIP-98: Schnorr kind 27235 with URL + method tags for HTTP bridge (`BZ/ARCHITECTURE.md:370,386`); buzz-cli signs NIP-98 (`BZ/crates/buzz-cli/src/client.rs:78-107`).
- NIP-OA owner attestation: `["auth", owner, conditions, sig]`, BIP-340 Schnorr over `SHA256("nostr:agent-auth:" || agent_pubkey || ":" || conditions)` (`BZ/docs/nips/NIP-OA.md:31-46`). "An event that includes a valid `auth` tag remains authored by `event.pubkey`" (`:17`). Relays "MUST NOT rewrite event authorship" (`:78`). Time clauses are self-declared: "These clauses do not enforce wall-clock expiry" (`:101`). Revocation = stop issuing tags (`:99`). In the relay: membership `ViaOwner` admits an agent whose owner is a member (`BZ/crates/buzz-relay/src/api/mod.rs:82-111`); agent→owner DB mapping is "first-write-wins" (`:170-217`); a ban on the owner cascades to the agent (`handlers/auth.rs:102-155`). NIP-AA codifies "virtual membership" with no persistent row (`BZ/docs/nips/NIP-AA.md` abstract + terminology).
- Blossom media: `PUT /media/upload` (BUD-02), `GET/HEAD /media/{sha256}.{ext}` (BUD-01), 50 MB (`BZ/ARCHITECTURE.md:624-625`; `BZ/crates/buzz-media/src/upload.rs:574`). Media URLs are absolute to the relay host (`docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:43`).

## 2. Single relay = single source of truth, and its limits

- CLAIMED (upstream, verbatim): "The relay is the single source of truth. All reads and writes flow through it. There is no peer-to-peer event exchange, no gossip, no replication" (`BZ/ARCHITECTURE.md:7`; unchanged on UP main).
- Store: one Postgres (events monthly range-partitioned) + one Redis (presence SET EX 180, typing ZSET, PUBLISH fan-out) + S3/MinIO for media (`BZ/ARCHITECTURE.md:48-55, 450-458, 774-801`). Pipeline: auth → pubkey match → verify → membership → DB insert → Redis publish → fan-out → search/audit/workflow fire-and-forget (`:226-240`).
- Horizontal scale exists only INSIDE one deployment: Redis multi-node fan-out is wired (`BZ/ARCHITECTURE.md:61-64, 446`); `buzz-relay-mesh` is an iroh QUIC mesh between relay pods where "mesh membership is a hint; the Redis fenced generation is the arbiter" (`BZ/crates/buzz-relay-mesh/src/lib.rs:1-19`). Upstream harness claims a 64x bus reduction from community-scoped Redis topics (`BZ/perf/RELAY_BUS_SCALING.md:20-31`). CLAIMED (not reproduced here).
- Upstream "federation" is identity federation, not event replication: NIP-FI binds an OIDC issuer's JWS assertion to a Nostr key, audience = the community's canonical host URI (UP `docs/nips/NIP-FI.md`, scratchpad copy `pqbuzz/upstream-NIP-FI.md:17-23,50-60`). MEASURED (fetch).
- Community = host. "The URL is the community" (`BZ/VISION.md:54`); unknown host fails closed (`BZ/crates/buzz-relay/src/tenant.rs:6-11`). DMs and profiles do not cross community domains (`BZ/NOSTR.md:14-20`).
- Client holds ONE address per community; no relay list anywhere (`docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:13-19`). CLAIMED (estate source read 2026-08-31). Desktop agents ignore their own `relay_url` pin and follow the workspace relay (`BZ/desktop/src-tauri/src/relay.rs:69-71`). MEASURED (code read). buzz-acp default is `ws://localhost:3000` (`BZ/crates/buzz-acp/src/config.rs:240`).
- Scale target (CLAIMED, upstream, no receipt): "10K humans + 50K agents", "~600K events/day (~7/sec avg)", fan-out "<50ms p99" (`BZ/VISION.md:198-204`).
- LOADMODEL-1M: "1M concurrent implies ≥100 relay communities' worth of signaling federation" and control-plane federation is "a named open item (§8 G-6)" (`docs/specs/LOADMODEL-1M.md:50,139`). It also records that 10B realtime fan-out is undemonstrated (`:19,146`). CLAIMED (model, not capacity).
- Arithmetic (derived here, not measured): the sovereign order's 10B workload is "about 115,741 ops/s average at 1 op/user/day" (`MEM/sovereign-operating-environment-order.md`, Laws list). That is about 16,500 times Buzz's per-relay average target of ~7 events/s, and 10B humans / 10K humans per relay = 1,000,000 relay-communities at the upstream target.
- Huddle audio is server-forwarded full mesh: "N×(N−1) frame copies per 20ms tick — 25 peers = 600 copies/tick"; soft cap 25, hard 255 (`BZ/crates/buzz-relay/src/audio/room.rs:47-49`). MEASURED (code read).
- Known upstream gaps (CLAIMED, upstream doc, fork base): no rate limiter enforced (`BZ/ARCHITECTURE.md:823`; feature map says upstream later added fixed-window limits, `BUZZ_FEATURE_MAP:48`); approval gates fail (WF-08) (`BZ/ARCHITECTURE.md:826`); `send_dm`/`set_channel_topic` NotImplemented (`:827`).

## 3. What users and agents depend on (feature inventory, upstream as audited 2026-09-18)

From `BUZZ_FEATURE_MAP_2026-09-18.md` (CLAIMED, code-verified by that audit, not re-run): channels open/private stream/forum, DMs and group DMs, threads, reactions, search, media, voice notes, presence/typing, cross-device unread, reminders (`:38`); agents create/run/stop, harness catalog (goose, Claude, Codex, buzz-agent), respond-to modes incl. allowlist, NIP-OA, teams, identity archive, observer (`:40`); workflows YAML with message/reaction/diff/schedule/webhook triggers, git Smart HTTP, `git-credential-nostr`, `git-sign-nostr`, NIP-34 issues/patches/PRs, NIP-MP projects (`:42`); huddles with agent voice, push-to-talk, NIP-AB pairing, iOS content-free push, Android none (`:44`); hosted provisioning, invites, NIP-43 roles, moderation, admin console (`:48`).
- Agent harness (`BZ/ARCHITECTURE.md:644-674`): relay WS + NIP-42 → buzz-acp → ACP JSON-RPC over stdio → agent; pool 1-32; at most one prompt in flight per channel; batches queued @mentions; does not persist state.
- buzz-acp attaches the NIP-OA tag inside the AUTH event (`BZ/crates/buzz-acp/src/relay.rs:3460-3492`) and treats any AUTH denial not prefixed `error:` as terminal, no retry (`:3804-3806`).
- buzz-cli: "JSON-only stdout, structured errors on stderr, two-tier auth (NIP-98 keypair → dev pubkey)" (`BZ/VISION.md:163`); commands present: agents, channels, dms, feed, issues, mem, messages, moderation, notes, patches, pr, projects, reactions, repos, social, upload, users, workflows (MEASURED dir listing `BZ/crates/buzz-cli/src/commands/`).
- Identity model to keep: "Scoped by identity, not by permission flags — the same way you'd scope a teammate" (`BZ/README.md:48`). "Channel membership is the only gate" (`BZ/VISION.md:37`). Recorded in the ruling ledger as the reason Buzz was ruled in (`docs/ledger/pirate-haul-rulings.md:17`).
- Seat policy that depends on Buzz features: respond-to "selected senders", parallelism 2-3; the open problem is WF-08 where "bFUzZ's cryptographically bound review of exact X resumes it" (`MEM/fable-seat-policy-selected-senders.md:12-19`). RULED (founder 2026-09-18, memory-recorded).
- Upstream still lacks (CLAIMED, 2026-09-18): WF-08 durable approval, any compute metering/attribution, dead-letter inbox/replay, per-speaker transcripts, Android push, web chat (`BUZZ_FEATURE_MAP:19,46,54-61`). MEASURED (UP main fetch 2026-10-16): `approval_not_supported` still at `crates/buzz-workflow/src/lib.rs:246`; NIP-11 `payment_required: false` at `crates/buzz-relay/src/nip11.rs:173`.

## 4. Metering already drafted for Buzz

- RULED (Seat-1 ruling, dispatch level): "Buzz may ROUTE payment but is never the payer of record. Zero balance is a named FloorRefusal, never a silent top-up." (`docs/dispatches/RULING_SEAT1_B1_PHASE0_DESIGN_2026-08-10.md:12`); epoch_funding extension "Confirmed" (`:14-16`).
- The spec (`docs/dispatches/BUZZ_A_METERING_SPEC.md`): "Buzz meters PHYSICAL RESOURCES CONSUMED, priced in `A`. It never meters access, requests, or entitlements." (`:39-40`). Units = closed `ResourceClass` enum MeshSecond, VramByteSecond, RamByte, CpuMicrosecond, NetByte, ChunkCount, StorageByte, ChainFee (`:44-47`). "A pays for the COMMODITY layer. It never pays for the SERVICE layer." (`:73`). "b does not appear in the alpha metering path at all" (`:80-82`). Payer of record = the user (`:103-104`); "Buzz's own A pays for Buzz's own resources only — its relay, its epoch anchors" (`:105-106`); shared-funder negative control must FAIL (`:107-108`). Unfillable swap = refuse, never auto-widen (`:122-126`); storage routing "< 256 KiB → AR · ≥ 256 KiB → ANT" (`:127`); one receipt type `SpendReceipt` (`:129`). No rate values (`:139-141`). C2: the spec did not read Buzz's implementation (`:164-167`).
- Governing text: "Users fund the resources they consume ... The paymaster *abstracts* user-funded payment; it must never *absorb* cost." (`docs/CONSTITUTION.md:83`). RULED.
- What runs today (CLAIMED): upstream has no metering, quota, billing, or per-consumer attribution; NIP-AM captures per-turn token cost encrypted but no UI reads it and there is no price table; the box's `buzz-compute` and `buzz-meter*` services are ours (`BUZZ_FEATURE_MAP:46`). The `/compute` path is bearer-keyed, "the till's metered path" (`docs/dispatches/LANE_RELAY_DUALHOME_2026-08-29.md:42`).

## 5. Censorship and SNI incidents (chronological)

1. Before 2026-07: building Wi-Fi blocked the Builderlab-hosted relay and Proton; this triggered the sovereign-relay docket (`C:/Users/travi/Downloads/DOCKET_BUZZ_SOVEREIGN_RELAY.md:4`). CLAIMED.
2. 2026-08-29: same IP, same second: SNI `skaists.buzz` → `write:errno=10054` RST mid-ClientHello; SNI `relay.skaists.dev` → no reset; four public resolvers answer cleanly, so this is SNI/DPI filtering, not DNS (`LANE_RELAY_DUALHOME_2026-08-29.md:7-11`). MEASURED (receipt in dispatch). Fix: Caddy alias vhosts with `header_up Host <primary-domain>` because "the relay 404'd the wss upgrade (it validates Host against BUZZ_DOMAIN)" (`:56`); verified 101 + AUTH challenge from the filtered path (`:58-62`).
3. 2026-08-31: the building Wi-Fi also kills the vendor's `*.communities.buzz.xyz` (000/000) (`docs/dispatches/MULTI_RELAY_ASK_2026-08-31.md:18-20`). CLAIMED.
4. 2026-10-15 (tonight): WatchGuard `WebBlocker.Resident`, category "Elevated Exposure", resets TLS on SNI `skaists.buzz`, 403 deny page on :80; outside nodes HTTP 200 (`MEM/buzz-relay-building-filter-alias.md:11`). Fix via app UI: Community settings → `wss://relay.skaists.dev`; all 18 agents came back; one agent hit a terminal `auth-required: verification failed` and needed a manual Start; media links stored as `https://skaists.buzz/media/...` stay broken because `rewriteRelayUrl` only proxies the current origin (`:13-17`). Relay2 / `beehivenature.buzz` box 129.153.202.144 dark since 2026-10-03 (`:18`). CLAIMED (memory receipt).
- Classifier source: "a VENDOR REPUTATION CLASSIFICATION carried by the BrightCloud/Webroot DB. It follows the TLD reputation" (`docs/dispatches/VENDOR_RECLASS_KIT_2026-08-29.md:3-5`). FortiGuard disputes submitted x2; BrightCloud (the one that fixes WatchGuard) still human-gated (`:94-104`). Building IT allowlist note prepared (`docs/NETWORK-ALLOWLIST-NOTE.md:17-24`).
- Canonical-origin coupling: the fallback's NIP-11 `push.origin` is `wss://skaists.buzz` and "IT IS IDENTITY, LOAD-BEARING — it must stay skaists.buzz" (`LANE_RELAY_DUALHOME:74-87`). The fork's 8 desktop commits make the client fetch `/info` on the transport road and sign NIP-42/NIP-98/invites for the canonical origin, failing closed on a malformed document (`BZ/desktop/src-tauri/src/relay.rs:201-245`; `git log` c3567a17..e1035672). MEASURED (code + git log).
- Founder onboarding law: "A VPN can never be an onboarding step. Two hundred neighbors will not install one." (`docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:54-55`). RULED (founder 2026-09-01, as recorded). Founder GO: "skaists.buzz stays the brand; skaists.dev is the guaranteed path." (`LANE_RELAY_DUALHOME:3`). RULED.
- §roads (client road list) is PROPOSED; §fractal (relay-to-relay replication, NIP-11 `peers`, lease membership) is "SPEC'd here, BUILT nowhere" (`SPEC-BUZZ-MULTIRELAY-1.md:3,34-50,76-91`). Docket R-4 proposes Veilid transport for hostile networks; R-5: "No architecture conjures packets past a filter" (`DOCKET_BUZZ_SOVEREIGN_RELAY.md:33-35`). CLAIMED, drafted, not built.

## 6. E2EE status (vision only, not shipped)

- Upstream product posture: "Server-managed encryption covers every channel, every DM, every event — eDiscovery works on everything. End-to-end encryption (NIP-44) is a future consideration for DMs." (`BZ/VISION.md:100`; unchanged on UP main `VISION.md:102`). CLAIMED.
- "DMs are not end-to-end encrypted (relay-gated channels; gift-wrap is declared and never sent)" (`BUZZ_FEATURE_MAP:38`). The relay accepts NIP-17 kind 1059 and excludes 1059/30300/30622 from search (`BZ/NOSTR.md:71`; `BZ/ARCHITECTURE.md:808`).
- Upstream attempts (MEASURED via UP): PR #1185 "encrypt 2-party DMs end-to-end with a relay-owned latch (Phase 1)" closed unmerged; PR #1358 "Add E2EE vision and conversation spec" (MLS-based) closed unmerged; `VISION_E2EE.md` and `docs/e2ee-conversations.md` 404 on main; issue #3336 "Support Marmot Protocol (MLS / RFC 9420) for scalable group E2EE" OPEN since 2026-07-28, a 2026-08-01 comment says "there are already three designs in flight and no stated direction".
- NIP-44 is used today only for owner↔agent private data: engrams 30174 (`BZ/docs/nips/NIP-AE.md` abstract), observer frames 24200 must be NIP-44 (`BZ/crates/buzz-relay/src/handlers/event.rs:1104-1105`), NIP-AM, reminders 30300, push-lease bodies (`BZ/docs/nips/NIP-PL.md` abstract). Huddle Opus frames are forwarded opaque; "the server never decodes" (`BUZZ_FEATURE_MAP:44`), not E2EE.
- Estate: bChat sends real NIP-17 gift wraps from a browser surface; the Buzz relay answered "restricted: not a relay member" (`docs/specs/SPEC-BCHAT-1.md:55,104-113`). Banked law: "same-library sign+verify proves nothing" (`:113`).
- Ledger record: "E2EE is a vision-spec branch NOT shipped" (`docs/ledger/pirate-haul-rulings.md:17`).
- PQ status: none. Every signature is BIP-340 secp256k1; NIP-AB pairing says "No post-quantum security: the ECDH key exchange is vulnerable" (`BZ/crates/buzz-core/src/pairing/NIP-AB.md:78`); git signing uses Nostr secp256k1 keys (`BZ/docs/nips/NIP-GS.md:10-13`); relay mesh uses iroh keys (`BZ/crates/buzz-relay-mesh/src/endpoint.rs:3,20`).

## 7. Classical dependencies a PQ redesign would touch (inventory, not design)

Event id SHA-256 + Schnorr sig (every event); NIP-42 22242; NIP-98 27235 (CLI, git-credential-nostr); Blossom auth 24242; NIP-OA auth tag; NIP-GS git object signatures; relay keypair signing 39000-39003, 44100/44101, 13534; NIP-44 v2 (secp256k1 ECDH + HKDF + ChaCha20 + HMAC) for engrams, observer frames, NIP-AM, reminders, push leases, pairing; NIP-17 gift wraps; iroh endpoint keys in relay mesh and Buzz Mesh compute; SHA-256 audit hash chain (`BZ/ARCHITECTURE.md:497-499`); TLS in transit. The sovereign order says "An ML-DSA wrapper does not replace secp256k1 inside a transaction; keep every classical dependency listed" (`MEM/sovereign-operating-environment-order.md`). RULED (founder order 2026-10-11, memory-recorded).

## 8. Behaviors a redesign must stay compatible with (observed dependencies, cited)

- Agent harness contract: ACP stdio JSON-RPC, per-channel single in-flight prompt, NIP-42 auth carrying NIP-OA (`BZ/ARCHITECTURE.md:650-674`; `buzz-acp/src/relay.rs:3460-3492`).
- buzz-cli JSON contract and NIP-98 + NIP-OA header injection (`BZ/crates/buzz-cli/src/client.rs:78-107,589-617`).
- Identity: one keypair per human and per agent, owner attestation without author rewrite (`BZ/docs/nips/NIP-OA.md:17,78,86-88`); membership as the only gate (`BZ/VISION.md:37`).
- Third-party Nostr clients (nak, Chachi, 0xchat) speak NIP-29 + NIP-42 directly (`BZ/NOSTR.md:200-210`); these assume secp256k1 NIP-01 events.
- 1000-year non-negotiables recorded on the docket: "no user incarceration ... interoperable/adaptable ~1000y; scale toward 10B" (`DOCKET_BUZZ_SOVEREIGN_RELAY.md:7`). CLAIMED (docket records them as inherited).
- Constitution versioning: "new versions must not break existing consumers (additive evolution; deprecation windows measured in years)" (`docs/CONSTITUTION.md:92`). RULED.
- Continuity test: "can another conforming client resume this from independently verifiable state?" (`MEM/sovereign-operating-environment-order.md`, How to apply). RULED (founder order, memory-recorded).

## 9. Collisions (escalate by name, do not resolve)

1. PLANE LAW: "Buzz = human plane, x0x = machine plane, Autonomi = durable, Arweave = permanence, Vaulta/Zano = settlement; Law X-1 x0x NEVER storage ... X-3 no component may need x0x liveness to preserve data" (`docs/ledger/pirate-haul-rulings.md:18`). "Buzz over x0x" merges the two planes and any x0x-held history meets X-1/X-3.
2. Buzz role ruling: Buzz "rides ON TOP of the four-network stack, NEVER a storage/permanence/privacy/settlement layer" (`pirate-haul-rulings.md:17`). An E2EE or durable-log Buzz meets "privacy" and "storage".
3. Truth location: upstream "relay is the single source of truth" (`BZ/ARCHITECTURE.md:7`) vs docket "No single Postgres is the source of truth" with Arweave as truth-of-record (`DOCKET_BUZZ_SOVEREIGN_RELAY.md:14,19`), docket status "drafted (not built)" (`:4`).
4. Identity bound to a DNS name: NIP-42 expected URL = tenant host (`bridge.rs:225-232`), NIP-FI audience = canonical host, `push.origin` ruled to stay `skaists.buzz` (`LANE_RELAY_DUALHOME:74-87`), while that name is the one the filter blocks (`MEM/buzz-relay-building-filter-alias.md:11`). The sovereign order notes "WebAuthn alone does not survive losing the original domain".
5. Metering language: SPEC-BUZZFORGE-1 calls the A-metering rail "b-denominated compute settlement" (`docs/specs/SPEC-BUZZFORGE-1.md:170-171`), while the ruled metering spec says "b does not appear in the alpha metering path at all" and warns about language erosion (`BUZZ_A_METERING_SPEC.md:80-82,158-162`).
6. Standing relay cost: metering spec lets "Buzz's own A" pay "its relay" (`BUZZ_A_METERING_SPEC.md:105-106`); Constitution limits acceptable standing costs to "bootstrap seeds and specification/reference-code maintenance" (`docs/CONSTITUTION.md:83`). Whether always-on relay hosting is a standing operator cost is not ruled here.
7. Domain semantics: seat proposal ".buzz = the nostr/buzz lane" (`docs/dispatches/RULING_DOMAIN_ATLAS_2026-08-27.md:53`) vs TLD-reputation filtering of `.buzz` (`VENDOR_RECLASS_KIT:3-5`).
8. Upstream product encryption posture (server-managed, eDiscovery, `BZ/VISION.md:100`) vs any E2EE PQ Buzz.
9. Interop vs PQ: NIP-01 clients assume secp256k1 Schnorr (`BZ/NOSTR.md:200-210`; `BZ/ARCHITECTURE.md:103-114`); a PQ event format leaves them behind, against "interoperable/adaptable ~1000y" (`DOCKET:7`).
10. Scope: founder 2026-10-03 "lets just focus on my four devices and the hostinger vps" (OCI out) (`MEM/founder-no-pr-no-local-server-live-check.md:11`); LOADMODEL and the 10B ask assume a member-node fleet (`LOADMODEL-1M.md:128`).

## 10. Gaps (not verified here)

- Which relay image/version runs on Hostinger today; whether `buzz-relay-mesh` is enabled there.
- No local load test of any Buzz relay; 10K+50K and <50 ms p99 are upstream targets without a receipt here; the 64x bus harness was not re-run.
- Whether the desktop still never sends NIP-17 gift wraps on UP main (audit was 2026-09-18).
- Full text of the Marmot issue thread beyond the first comment; the three in-flight upstream E2EE designs are not named in what was read.
- How WatchGuard treats UDP/QUIC (x0x uses ML-KEM QUIC) on this network; no probe exists.
- Mobile app build on the founder's phone (`BUZZ_FEATURE_MAP:78`).
- Primary sources for memory-recorded founder quotes (seat policy, sovereign order, Hostinger scope) were not re-read.
- DM size cap differs: "Up to 9" (`BZ/VISION.md:20`) vs "up to 8" (`BUZZ_FEATURE_MAP:38`) vs "group DMs (3-9)" (UP PR #1185 body).
