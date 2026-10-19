# x0x (saorsa-labs): what it provides today, how BNR uses it, what is measured

Reader notes for the PQ Buzz design. Read-only. Repo root = `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3`
(paths below are repo-relative unless absolute). Upstream read 2026-10-15/16 via `gh api` GETs.
Kinds: RULED (founder/governing text), MEASURED (receipt with real output), CLAIMED (asserted, no receipt we hold), UNVERIFIED.

## 0. Escalations first (collisions with governing text; not resolved here)

1. **PLANE LAW collides with "Buzz over x0x".** RULED, `docs/ledger/pirate-haul-rulings.md:18`: "PLANE LAW — Buzz = human plane, x0x = machine plane, Autonomi = durable, Arweave = permanence, Vaulta/Zano = settlement". Same line: "Law X-1 x0x NEVER storage", "X-2 machine decisions must surface to human plane", "X-3 no component may need x0x liveness to preserve data". `docs/specs/LOADMODEL-1M.md:50` cites the same plane law. A design that moves the human plane onto x0x needs a founder ruling. The drafted `SPEC_X0X-1.md` named in that ruling is NOT in the repo (`git ls-files` finds only `SPEC-X0X-622-CAPTURE-1.md`), and a depth-3 search under `C:/Users/travi` did not find it.
2. **Confidentiality ceiling.** RULED, `docs/ledger/pirate-haul-rulings.md:19`: "confidentiality language ONLY on private_secure/TreeKEM at pinned version, capped at 'sound by construction'; GSS/public presets carry NO confidentiality claims". It also says "ADR 0012's testnet verification = upstream's claim until P0 reproduces encrypt/decrypt + rekey-on-ban receipts locally". **BNR holds no TreeKEM receipt.** Every BNR x0x exercise used public groups: hive-porch is `public_open` (`ops/x0x/README.md:69-73`), and the battery creates `public_open` groups and `signed` stores (`crates/btungsten-meshdep/src/workload.rs:468-476, 341`).
3. **x0x is the weakest rail.** RULED, `docs/ledger/pirate-haul-rulings-2026q3.md:27`: "anything held only in x0x must anchor to Autonomi/Arweave or it does not survive".
4. **The "revocation is never shed" claim is wrong for the version we measured.** `crates/btungsten-meshdep/profiles/leaf-shed-normal.toml:12-13,50-54` and `docs/dispatches/2026-10-12-btmd-mesh-dependability.md:214-216` say revocation and Critical traffic are never shed "by design" on v0.47.1. Upstream #1111 (https://github.com/saorsa-labs/x0x/issues/1111) found `x0x.revocation.v1/v2/v3` were classified **Normal**, which means they could be shed. #1335 fixed this, it shipped only in **v0.48.0** ("Revocation carriers can no longer be shed", v0.48.0 release notes), and #1111 closed 2026-10-13. What we hold is the 3/3 drill observation on v0.47.1 (MEASURED). A guarantee on that version is not supported.
5. **The upstream merge-flow note is stale.** The task brief and memory note `x0x-open-issue-not-unfixed` say maintainers merge to `codex/final-acceptance-candidate`. On 2026-10-15 `gh api repos/saorsa-labs/x0x/branches/codex%2Ffinal-acceptance-candidate` returned **404**, and the last 30 closed PRs all have base `main` (#1335, #1343, #1415 merged to main). Current rule: an open issue is open on main. The same memory's line "there is no Hostinger x0x host" is also stale (see §5).
6. **Possible conflict with "users fund what they consume".** Constitution Art. V.1 is cited in `C:/Users/travi/CLAUDE.md` §1 row 1; another reader should confirm. A default Leaf forwards other peers' subscribed system traffic. The biggest topics are Critical-class `caps/v1/response` and `dm/v1/bus`, which a node carries even with no local DM activity (`docs/dispatches/2026-09-15-x0x-505-504-field-evidence.md:79-86`). x0x has no resource metering or payment surface (none found in README v0.48.0 or the ADRs read).

## 1. Capability table (upstream x0x; latest release v0.48.0, published 2026-10-14T11:24:10Z; main `cb2a3938a` 2026-10-15)

| Feature | Version | Status | Citation |
|---|---|---|---|
| Daemon `x0xd` + CLI + Rust lib; REST/WS/SSE on loopback only (174 endpoints) | v0.48.0 | shipped (CLAIMED) | README v0.48.0 lines 272-283 |
| 3-layer identity: machine, agent, optional user; ML-DSA-65; IDs = SHA-256 of the public key | v0.48.0 | shipped (CLAIMED) | consolidated A02 "Decision"; README:26-49 |
| Keys at rest: plain bincode, file mode 0600, **no app-layer at-rest encryption** | ADR 0015 Accepted; ADR 0012 decision 6 | shipped (CLAIMED) | adr-archive/0012 lines 84-96; adr-archive/0015 |
| QUIC transport (ant-quic `=0.27.60`), TLS 1.3 raw public keys (RFC 7250), ML-KEM-768 KEX | main Cargo.toml:22 | CLAIMED; pure vs hybrid KEX UNVERIFIED at source | docs/security.md:7-21 |
| NAT traversal via QUIC extension frames, no STUN/ICE/TURN; MASQUE transport relay through the advertised backbone | — | CLAIMED | docs/nat-traversal-strategy.md:7; adr-archive/0071 Decision 1 |
| **UDP only.** "UDP on port 443 remains UDP. It is not an HTTPS fallback"; no blocked-UDP fallback decided | A05 Proposed | CLAIMED (limit) | consolidated A05 "Paths and status" and "Matters to settle" |
| Bootstrap = seed hints only; 6 seeds (NYC, SFO, HEL, NUE, SG, SYD) on :5483, plus :443 listeners | ADR 0001/0011 | shipped (CLAIMED) | v0.48.0 release notes; adr-archive/0011 Decision 1-3 |
| **No global DHT for user/group data**; availability = reachable holders | ADR 0006 Accepted | design law (CLAIMED) | README:200-206; adr-archive/0006 Decision 1-6 |
| Direct messages: ML-DSA-signed envelope, per-recipient ML-KEM-768 + ChaCha20-Poly1305 seal, over the gossip bus; durable ACK v2; replay cache 10,000 entries / 630 s | ADR 0050/0030 Accepted | shipped (CLAIMED) | adr-archive/0050 Decision 1-4 |
| DM `sender` field self-asserted at app layer (machine_id authenticated by QUIC) | docs | CLAIMED, and drifts from ADR 0050 | docs/security.md:39 |
| Named groups: SignedPublic (integrity only), MlsEncrypted default → TreeKEM (saorsa-mls `0.3.8` on main) | ADR 0012 | shipped single-member (ADR status); multi-member conflicting (see §2) | adr-archive/0012 line 3; main Cargo.toml:28 |
| KV store: OR-Set + LWW CRDT, delta gossip; policies Signed / Allowlisted / Encrypted / AppendOnly / SelfKeyed / GroupSigned / TreeKemEncrypted; SelfKeyed quota 64 keys / 256 KiB; non-encrypted deltas are plaintext bincode | ADR 0047 Accepted | shipped (CLAIMED) | adr-archive/0047 Decision 1-4, Consequences |
| KV state-sync after restart rejects every StateRequest on binding mismatch | open bug | defect | issue #1105 (open) |
| Durable local history (SQLite + FTS5), default on, `max_bytes` 1 GiB; **local only, never served to the network**; MLS groups stored as decrypted plaintext | ADR 0023 Accepted, amended by 0041 | shipped (CLAIMED) | adr-archive/0023 "Decision" |
| Owner device sync: profile, names, Home pointer only. "DMs and other groups' history never replicate" | ADR 0041 | shipped (CLAIMED) | README:145 |
| Presence: every agent beacons to the global topic `x0x.presence.global`; adaptive offline timeout 180-600 s | ADR 0049 Accepted | shipped (CLAIMED) | adr-archive/0049 Decision 1-2 |
| File transfer, SHA-256 verified, at most 1 GiB | — | shipped (CLAIMED) | README:247 |
| Leaf participation is the default; Leaf does not forward unsubscribed topics | ADR 0034 Accepted | shipped (CLAIMED) | adr-archive/0034 Decision 1 |
| Byte budget: `byte_policy` default **observe_only**; `shed_normal` opt-in; soft 64 KiB/s, hard 128 KiB/s, burst 4 MiB; `leaf_max_eager_degree` 2 | slice 1-2 | shipped, opt-in (CLAIMED) | docs/504-slice1-experimental.md; consolidated A06 "Current implementation" |
| App peer relay for DMs: off by default; 10/min per sender, 100/min global, 1 MiB/min; header signs no digest of the inner envelope (#437) | ADR 0051 **Proposed** | shipped off (CLAIMED) | adr-archive/0051 Decision 1-4 |
| Relay role work frozen until #807/#731 close with fleet evidence | ADR 0071 Accepted | frozen | adr-archive/0071 Decision 2-3 |
| Self-update over gossip with ML-DSA-65 signed manifests (we disable it) | — | shipped (CLAIMED) | README:149-158 |
| Release artifacts signed ML-DSA-65 `.sig` + GPG `.asc` | v0.48.0 | shipped (CLAIMED); we verify only sha256 + GPG | v0.48.0 release notes |
| Per-kind counters (verify/bus/delivered/published) | #1170 | **open** (depends on #869, which depends on saorsa-gossip #100, also open) | issues #1170, #869; saorsa-gossip#100 |
| Stable authenticated transport msg ID to clients | #869 | **open** | issue #869 |
| SSE broadcast lag sends no gap marker | v0.47.1 | defect / limit | docs/dispatches/2026-10-15-pq-net-bounded-sse.md:135-140 |
| ADR set: 15 consolidated A01-A15 are **Proposed**; archive accepted 2026-10-10 | — | governance state | consolidated A0x headers |

Scope (CLAIMED): x0x's primary user is "an AI agent acting for one owner with 2–5 machines" (adr-archive/0095 Decision §1). A01: "x0x does not provide a global storage network or a global directory".

## 2. PQ primitives by layer, and the confidentiality claim allowed

- **Transport (machine↔machine QUIC):** ML-KEM-768 session keys and ML-DSA-65 raw-public-key authentication (docs/security.md:7-21). CLAIMED. Whether the KEX is hybrid is UNVERIFIED. No hyle-team/Zano relevance.
- **Identity/signing:** every agent, machine and user key is ML-DSA-65. Gossip envelopes carry ML-DSA-65 signatures. Our #504 comment cites #656's "~10.31 KB floor per eager frame" for that envelope; CLAIMED, we did not reproduce it (#504 comment 5684632472).
- **Group encryption:** saorsa-mls TreeKEM plus ChaCha20-Poly1305. The PQ ciphersuite IDs are "SPEC-2" (`0x0B**`), which **diverge from IETF draft codepoints. There is no RFC 9420 wire interop** (adr-archive/0012 lines 117-123). A09: "Do not claim RFC 9420 wire interoperability merely because a component is called MLS". README:168 still says "MLS (RFC 9420)".
- **Multi-member TreeKEM status conflicts across sources (UNVERIFIED):**
  - ADR 0012 status line 3: the joiner's Welcome is not delivered at 0.21.0.
  - bridge README (2026-08-04): "x0x multi-member TreeKEM works".
  - tic-tac-toe README: private-group crypto "remain[s] gated".
  - A09 "Current implementation" (checked 2026-10-12): self-leave "does not rotate the remaining members' keys"; "Full automatic revocation eviction and rekeying remain incomplete".
- **Allowed claim (RULED, rulings:19):** only for `private_secure`/TreeKEM, at a pinned version, after local P0 encrypt/decrypt + rekey-on-ban receipts, and never stronger than "sound by construction". Today, with no P0 receipt, BNR may claim **nothing** about confidentiality on x0x. Public and signed groups: integrity only. KV deltas for non-encrypted policies are plaintext (ADR 0047). History is stored as decrypted plaintext locally (ADR 0023).

## 3. Measured numbers, with conditions

**Public mesh (application counters vs wire bytes: do not mix them).**
- 2026-09-05, laptop default Leaf on v0.41.x, about 35 min: about 1.54 GB eager gossip out, about 44 MB/min, from the `diagnostics gossip` app counter (`docs/dispatches/2026-09-05-x0x-box-mesh.md:80-84`). MEASURED, app-level.
- The 2026-09-05 "~6 Mbps sustained" laptop burden and router outage are founder-reported and "not remeasured". The cause is "**unverified**" (`ops/x0x/LAPTOP-NETWORK.md:9-22`). CLAIMED.
- 2026-09-15, OCI box v0.45.0 default Leaf, 300 s, 26 peers: `epidemic_forward` **86.33 MB/min**; top topics caps/response 28.4%, announce blob 25.8%, machine announce 11.8%, dm/bus 9.4% (`docs/dispatches/2026-09-15-x0x-505-504-field-evidence.md:79-86`). MEASURED, **but this is an app send-attempt counter, not wire**: upstream #622 closing comment says "figures here are send-attempt rates, not wire measurements (#590)".
- 2026-09-26, source build @474ef34 with `shed_normal`, 32 peers: 59.36 MB/min (−31%). Critical caps/response and dm/bus were unshed and grew (#504 comment 5844630400; `docs/dispatches/2026-10-12-btmd-mesh-dependability.md:64-68`). MEASURED, app-level, not a controlled replication.
- W@tch (another embedder), OS `IPAccounting` **wire** bytes, idle Leaf: 0.41.3 ~561-778, 0.45.0 322, **0.46.0 default 142**, **0.46.0 + shed_normal 52 MB/min** (32 down / 20 up), "~75 GB/day per idle linked device". W@tch ships with the agent switched off (#504 comment 6117979353). CLAIMED (third-party receipt; we hold no raw data).
- Hostinger v0.46.0 default Leaf, systemd IPAccounting **wire**:
  - First 30 s of reconvergence: 256,740,849 B egress.
  - Uptime 107→137 s: 37,597,296 B egress and 42,620,378 B ingress, which is about 75 MB/min out and 85 MB/min in (≈160 MB/min combined; my arithmetic) at 23 peers.
  - Source: `docs/dispatches/2026-10-03-hostinger-x0x-always-on.md:50,56`. MEASURED, early window only, "not ... an idle bandwidth guarantee".
- Upstream bootstrap fleet: 6 hosts × 2 vCPU, three daemons each, 45-68% of a vCPU per daemon at 26-28 peers idle (#656). CLAIMED.

**Private rig (WSL netns/veth, pinned binaries, kernel veth counters; no public route).** Source for most rows: `docs/dispatches/2026-10-12-btmd-mesh-dependability.md:96-109`.
- Rig idle bill is ~0.3-2.0 MB/min combined per leaf (:185-187). The constrained-leaf budget is 2,097,152 B/min (`budgets/btmd-budgets-1.json:34`). That budget was missed at s9 (2.60 MiB/min; `profiles/leaf-shed-normal.toml:36-38`) and missed again in pair 4 baseline at 2,147,645 B/min (`docs/dispatches/2026-10-15-pq-net-repeat-validation.md:71-73`).
- P2, v0.47.1, s3/s6/s9: all classes full except s9 `shed_normal` KV sync 10/20 within 30 s (20/20 with a 180 s window) (:178-182).
- Scale-9 N=10 interleaved study (`docs/dispatches/2026-10-13-btmd-scale9-study.md:34-45`):
  - baseline 10/10 within gate;
  - shed 1/10 within gate (7 late at 48.8-63.9 s, median 53.0 s; 2 never within 180 s);
  - shed with budget ×10: 10/10.
- Recovery drills (:194-205):
  - kill-9 then restart in 1.0 s, identity preserved;
  - partitioned node still answers `/health` READY (ready ≠ delivered);
  - revocation reached 3/3 observers;
  - one corrupted byte → node refuses to start (fail-closed);
  - rejoin from peer cache 0.003 s after seed loss.
  - Continuity: v0.46.0→v0.47.1 green; downgrade to v0.45.0 does not serve the KV value (X0XKVS2 fail-closed).
- Flood (:214-221): leaf bill ~32-83× idle under `shed_normal`. Inbound to a subscribed leaf is not bounded by design; the ≤3× gate FAILED.
- PQ-NET SSE, v0.47.1, one pair per scale (`docs/evidence/pq-net-sse-20261015/summary.md:14-19`): s9 `shed_normal` store **6/20** vs baseline 20/20, leaf idle 1,340,226 vs 1,135,096 B/min.
- Store HTTP status, v0.47.1 s9 (`docs/dispatches/2026-10-15-pq-net-store-http-status.md:71-89`):
  - all 20 puts returned HTTP 200 and all sender readbacks matched;
  - shed recipients returned **404** on all 16 checks for k2-k9, so 4/20;
  - baseline 20/20, idle traffic flat (+0.056%).
  - These are accepted writes that went unobserved remotely. They are not API refusals.
- Root cause and patch (`docs/dispatches/2026-10-15-pq-net-store-propagation.md:19-31,125-147`): saorsa-gossip-pubsub recovery-intent identity was lost on V3 Full/Ref re-signed retries.

| Build | baseline store | shed store |
|---|---|---|
| Control | 20/20 | 11/20 |
| Guard only | 20/20 | 7/20 |
| V3 fix + guard | 20/20 | 20/20 (−3.52% idle, single pair) |

  - Upstream PR saorsa-gossip **#115 is OPEN** (head `a9f77b1d6`, no merge; latest release v0.5.88). x0x main pins `=0.5.88`. **The fix is not in any x0x release.**
- Fresh-identity replication, 4 pairs, s9, V3-fixed backport (`docs/dispatches/2026-10-15-pq-net-repeat-validation.md:49-74`; `docs/evidence/pq-net-repeat-validation-20261015/replication.json` aggregate):
  - store 160/160, puts 80/80, DMs 96/96, group 96/96, probes 4,480/4,480;
  - savings per pair 29.55 / 25.79 / **−24.82** / 47.00%; mean 19.38%, median 27.67%, ratio of means 23.97%;
  - "Neither average proves a stable saving."

## 4. Known defects / open upstream work (state at read time)

- #504 OPEN, P2 (Leaf egress). Default changes need ADR 0078 and envelope collapse needs ADR 0101 (comment 5995680476). #622 closed as a duplicate into #504 (5906763450). Slice order: S1 unicast caps, S3 consume-only Leaves, S4 enforced shed with revocation exempt.
- #505 CLOSED 2026-09-15 on our field re-run (5688498210). Pre-fix senders still ship 4,096 B flights and fail through fragment filters (`ops/x0x/README.md:193-197`).
- Also open: #1170, #869, #1105, saorsa-gossip #100, saorsa-gossip PR #115. Revocation was Normal-class before v0.48.0 (#1111, fixed by #1335).
- ADR 0051 relay header does not bind the inner envelope (#437). ADR 0071 relay freeze.
- The #622 public capture packet was **never run**: SPEC-X0X-622-CAPTURE-1 is "NOT ACCEPTED for launch" (`docs/specs/SPEC-X0X-622-CAPTURE-1.md:3-6`), and the packet's last round lists the capture as "Unperformed" (`docs/dispatches/2026-09-10-x0x-622-measurement-packet.md:455-458`).
- Our fork token cannot open upstream PRs: FORBIDDEN/404 while comments work (`ops/x0x/README.md:224-227`).

## 5. What x0x explicitly does NOT do (CLAIMED from upstream; RULED where marked)

- It is not storage, and has no global DHT for user data. Availability = reachable authorized holders (ADR 0006; A01; A10). RULED for BNR: X-1/X-3 (rulings:18) and the anchor rule (2026q3:27).
- It does not replicate DM history or other groups' history between devices (README:145). History is never served to the network (ADR 0023).
- It does not fall back to TCP/HTTPS (A05). Whether its QUIC carries an SNI a WatchGuard-style filter could match is UNVERIFIED.
- It does not encrypt key material at rest (ADR 0015).
- It does not enforce a byte cap by default (observe_only), and does not bound inbound floods to a subscribed leaf (btmd :214-221).
- It does not provide exactly-once delivery, sequence gaps or replay to clients (#869 scope; A07 delivery is at least once).
- It does not route Buzz rooms: "x0x transport availability does not automatically change Buzz's room routing" (`docs/dispatches/2026-10-03-hostinger-x0x-always-on.md:47`).

## 6. Our deployments

- **Hostinger** `buzz-hostinger` (2.25.245.161, NixOS 26.05, 8 cores / 32 GB):
  - Software: x0x **v0.46.0** static musl, sha256 `79941941…` plus GPG key CEB3…0F29, TOFU (`docs/dispatches/2026-10-03-hostinger-x0x-always-on.md:7,13-19`; `ops/x0x/hostinger/x0x-service.nix:5-8`).
  - Config: API loopback 127.0.0.1:12700, UDP 5483, default Leaf, not a relay, peer relay off, self-update off, exec disabled; MemoryMax 1G, CPU 100%, Tasks 128, `Restart=always` (`ops/x0x/hostinger/README.md:16-24`; `x0xd.toml:2-14`). UDP 5483 was "founder-approved 2026-09-25" (`configuration.nix:44`).
  - Last health receipt, 2026-10-11T00:22:24Z: "ok=true, healthy, peers=19, send_ready_peers=19, uptime_secs=648372" (`docs/dispatches/2026-10-10-agent23-dell-version-alignment.md:29`). MEASURED. Nothing newer was found.
  - Not upgraded to v0.48.0. Device enrollment and send/read receipts are still pending (`docs/dispatches/2026-10-03-first-device-cohort.md:9`).
  - `/watch` and `/live` returned 502 because Caddy routes them through `oracle-service` (`docs/dispatches/2026-10-10-agent23-ci-device-readiness.md:39`).
  - A token-incident containment is UNVERIFIED (`docs/dispatches/2026-10-10-agent23-hostinger-device-handoff.md:28`).
- **OCI box** (129.153.202.144, arm64, x0x v0.45.0, identity `hive-box`): **dark** on 2026-10-03. TCP 22/80/443, ICMP and UDP 5483 timed out from three continents, while the Hostinger control passed (`docs/dispatches/2026-10-03-oci-box-dark-and-v0460-verified.md:8-12,36-47`). It holds the old identity and the evidence. No later receipt was found.
- **Laptop / Dell:** binaries were updated to v0.46.0 on 2026-10-11. Zero x0x processes; no local mesh test (`docs/dispatches/2026-10-10-agent23-dell-version-alignment.md:21-23`). Policy is no local P2P daemon on the shared network; access goes over a leased SSH tunnel (`ops/x0x/LAPTOP-NETWORK.md:28-61`). That network's TCP middlebox completes every handshake, so TCP-connect probes from it are worthless (`docs/dispatches/2026-10-03-oci-box-dark-and-v0460-verified.md:19-34`).

## 7. Numbers I could not tie to a BNR-held receipt

- W@tch 142/52 MB/min and 75 GB/day (third-party).
- #656's 10.31 KB frame floor and the bootstrap CPU figures.
- The laptop ~6 Mbps figure.
- Bridge convergence of 45.75 / 36.42 ms (x0x-nostr-bridge README).
- Mac daemon 1.68 GB RSS after 6.8 days (#656).
- The size of the public mesh. Our nodes saw 19-33 peers; the total is unknown.

## 8. Prior art directly on point (upstream; CLAIMED)

- **saorsa-labs/x0x-nostr-bridge** is a Nostr relay facade on the x0x gossip mesh, NIP-01 subset plus 11/16/42/50. The README says "Point any NIP-29-compatible client (e.g. an unmodified Buzz desktop…)". Topics are `buzz.v1.global` and `buzz.v1.ch.<channel>`. Events are Schnorr-verified, stored in local SQLite, and have "no cross-bridge history catch-up". It lists 4 pre-deploy gaps. Last push was 2026-08-04.
- **saorsa-labs/tic-tac-toe** is the native x0x workspace (Tauri). It has a "Buzz deep-copy plan" decided by David on 2026-07-22, with the "End state remains pure x0x". Production cut straight to x0xd REST/WS (`docs/design/buzz-fork-plan.md`). The x0x ADR 0023 durable history exists because of the Buzz-on-x0x bridge spike (adr-archive/0023 lines 23-27).
