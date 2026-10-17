# PQ-Buzz reader notes: workload and scale model, 10B users, 1,000 years

Reader seat. Facts and arithmetic only, no design. Repo root for relative paths:
`C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3`. Kinds: RULED
(founder or governing text), MEASURED (receipt with real output), CLAIMED (asserted, no
receipt), UNVERIFIED. Every derived figure is labelled ARITH, and every input I chose is labelled ASSUMPTION.
Arithmetic was run with node (scratchpad `pqbuzz/calc.js`) and is shown inline so it can be redone.

## 0. Governing sentences (verbatim, short)

- "10B users needs a declared workload model (about 115,741 ops/s average at 1 op/user/day). A single-host test is not a mesh result." (`C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory/sovereign-operating-environment-order.md:23`). RULED as recorded in auto-memory (founder order 2026-10-11). I could not find the primary pasted text in `docs/`, so treat the wording as a memory paraphrase.
- "The 1000-year goal is continuity through replacement, tested by simulated extinction and generation transitions." (same file :24). RULED, recorded in memory the same way.
- "Users fund the resources they consume; nodes are paid for capabilities they provide." (`docs/CONSTITUTION.md:83`). RULED per the CLAUDE.md precedence table. Caveat: the file header says "DRAFT v0.1 — for founder review" (`docs/CONSTITUTION.md:3`).
- `resource.accounting`: the paymaster "abstracts a user-funded basket ... and never subsidizes" (`docs/CONSTITUTION.md:128`). RULED, with the same caveat.
- "a native Vaulta account is ~2,996 B of chain RAM and is therefore inherently O(n)." (`docs/bzdid-architecture-decision.md:61`). RULED (decision 2026-08-04).
- "No authoritative store must exist for a free identity to work." (`docs/bzdid-architecture-decision.md:390`). RULED.
- "The hardline is that BNR funding must never gate how many users can exist" (`docs/bzdid-architecture-decision.md:187-188`). RULED (LAW 8s). Its test: "does this cost grow with the number of names?" (:199).
- Scale direction: "scale toward 10B" is listed among inherited non-negotiables (`C:/Users/travi/Downloads/DOCKET_BUZZ_SOVEREIGN_RELAY.md:7`). RULED as direction only.
- x0x: "ADR 0006: no global DHT for user/group data — availability = peer liveness", plus "Law X-1 x0x NEVER storage" and "X-3 no component may need x0x liveness to preserve data" (`C:/Users/travi/Downloads/pirate-haul-rulings.md:18`). RULED in the ledger (x0x ruled in 2026-07-23; PLANE LAW comes from the drafted SPEC_X0X-1).
- Buzz relay "is the single source of truth ... no gossip, no replication" (upstream ARCHITECTURE.md, quoted at `docs/specs/SPEC-BUZZ-MULTIRELAY-1.md:8-11`). CLAIMED (upstream design statement). Also: "§fractal is SPEC'd here, BUILT nowhere." (:89).
- Founder law, 2026-10-13: "autonomous healing cannot be used to conceal unacceptable service interruption." (`docs/dispatches/2026-10-13-btmd-scale9-study.md:115-117`). RULED.
- Founder disposition: zero observed control failures "is not zero underlying failure probability" (same file :97-99). RULED.
- Gate ladder: "10k-node testnet per Stage-2 [GAP], then ×10 steps toward 1M — no scale claim skips a rung." (`docs/specs/LOADMODEL-1M.md:137`). CLAIMED, as a spec gate; LOADMODEL itself is "MODEL DRAFTED — no receipts" (:4).

## 1. Cited table: ruled or measured scale numbers relevant to messaging

| # | quantity | value | kind | citation |
|---|---|---|---|---|
| 1 | target population | 10B ("scale toward 10B") | RULED (direction) | Downloads/DOCKET_BUZZ_SOVEREIGN_RELAY.md:7; memory sovereign-operating-environment-order.md:23 |
| 2 | floor workload | ~115,741 ops/s at 1 op/user/day | RULED (memory) / ARITH 1e10/86,400 = 115,740.74 | memory :23 |
| 3 | Buzz relay scale target | 10K humans + 50K agents per relay; single relay = single community | CLAIMED (upstream VISION.md) | Downloads/compass_artifact_wf-c9696483-…md:13; docs/specs/LOADMODEL-1M.md:50 |
| 4 | relay node unit, ledgered | 64 GB RAM, 10 Gbps, $100/mo | CLAIMED, contested | Downloads/DOCKET_BUZZ_SOVEREIGN_RELAY.md:27; LOADMODEL-1M.md:17,86 |
| 5 | relay node unit, budget reality | 128 GB ECC, 24 TB HDD, 1 Gbps, ~$101/mo | CLAIMED (VPS_COST_ANALYSIS, quoted) | LOADMODEL-1M.md:87 |
| 6 | sustained forward budget per node | 7.0 Gbps (U-10G) / 0.7 Gbps (U-1G), at u=0.70 | ASSUMPTION over unit spec | LOADMODEL-1M.md:89 |
| 7 | per-box connection ceiling | "100k+ realtime connections" | CLAIMED | LOADMODEL-1M.md:91 |
| 8 | x0x idle bill, public mesh, other embedder | 52 MB/min combined (32 down / 20 up) ≈ 75 GB/day per idle linked device (0.46.0 + shed_normal); 142 MB/min at 0.46.0 default | MEASURED by W@tch (systemd IPAccounting, 30×60 s) | docs/dispatches/2026-10-12-btmd-mesh-dependability.md:56-58,70-73 |
| 9 | x0x idle bill, public mesh, ours | 86.33 MB/min (v0.45.0, 26 peers); 59.36 MB/min shed_normal (32 peers) | MEASURED (not a controlled replication) | same :61-69 |
| 10 | x0x idle, private 9-node rig, per leaf | ~0.69–1.76 MB/min (e.g. 720,161–1,413,783 B/min at baseline s9) | MEASURED (kernel veth) | docs/dispatches/evidence/2026-10-12-btmd-mesh-dependability/summary.md:19; 2026-10-15-pq-net-repeat-validation.md:57-60 |
| 11 | leaf idle budgets | desktop ≤ 8,388,608 B/min; constrained ≤ 2,097,152 B/min; DM p95 ≤ 3 s; revocation ≤ 15 s; KV convergence ≤ 30 s | CLAIMED ("PROPOSED ENGINEERING TARGETS") | crates/btungsten-meshdep/budgets/btmd-budgets-1.json:5,28,37,42-44 |
| 12 | shed_normal saving, 4 fresh pairs, 9 nodes | −24.82% to +47.00%; mean 19.38%, median 27.67%; "Neither average proves a stable saving" | MEASURED | docs/dispatches/2026-10-15-pq-net-repeat-validation.md:55-69 |
| 13 | scale-9 state sync under shed_normal, stock budget | 1/10 within gate, 7/10 late (median 53.0 s), 2/10 never (≤180 s); baseline 10/10; budget ×10 10/10 | MEASURED | docs/dispatches/2026-10-13-btmd-scale9-study.md:34-45 |
| 14 | accepted writes missing at recipients | shed_normal 4/20 vs baseline 20/20, all puts HTTP 200 | MEASURED | docs/dispatches/2026-10-15-pq-net-store-http-status.md:71-86 |
| 15 | largest mesh measured by the estate | 9 nodes, single host (WSL netns) | MEASURED (limit) | 2026-10-15-pq-net-repeat-validation.md:91-97 |
| 16 | ML-DSA-65 sizes | pk 1,952 B, sig 3,309 B (ML-DSA-44 1,312/2,420; -87 2,592/4,627) | MEASURED-in-code (crate assertions, tests, noble cross-check) | crates/bsigner/src/pq.rs:162-165; crates/capability/src/lib.rs:1109-1110,1153-1155; crates/atmirror/src/record_sig.rs:49,95 |
| 17 | ML-KEM-768 sizes | ek 1,184 B, ct 1,088 B | MEASURED-in-code | crates/bsigner/src/pq.rs:220,276 |
| 18 | estate X-Wing (bpq) | pk 1,216 B (1,184 + 32); ct 1,120 B (1,088 + 32) | RULED (spec) | docs/specs/SPEC-BPQ-1.md:82-83 |
| 19 | bpq public card | dsa 1,952 / kem 1,216 / succ 32 + ML-DSA-65 sig | RULED (spec) | docs/specs/SPEC-BPQ-1.md:94-95 |
| 20 | on-chain bytes per user (bzDiD/BEELOG) | 148,156 B total for any N; 0.0000148 B/user at 10B | CLAIMED design arithmetic (commit row measured 356 B cold / 0 B wrap) | docs/bzdid-architecture-decision.md:343-363, 219-221 |
| 21 | native Vaulta account | ~2,996 B, O(n); free tier gets none | RULED | bzdid-architecture-decision.md:61 |
| 22 | Vaulta RAM unallocated | 76,128,825,344 B (70.90 GiB, 2026-08-04); 75,800,886,740 B (2026-08-22); max_ram_size 418,945,440,768 B | MEASURED (live mainnet) | bzdid-architecture-decision.md:365; crates/bmesh-ram/tests/live_conformance.rs:18,75 |
| 23 | Vaulta NET capacity | ~181 GB/day | CLAIMED | bzdid-architecture-decision.md:373 |
| 24 | per-identity storage, free tier | ~600 B log, $0 required | RULED design | bzdid-architecture-decision.md:384,390 |
| 25 | per paid name, permanent DA | ~2,842 B; renewal 192 B/name/yr | RULED design | bzdid-architecture-decision.md:387,400 |
| 26 | name tree at 10B names | ~2×10¹⁰ nodes × 32 B ≈ 640 GB (sequencer); full log ~2.6 TB | CLAIMED (upper bound) | bzdid-architecture-decision.md:284,498 |
| 27 | Arweave price | $32.56/GiB (Turbo, one vendor, ±30%) | MEASURED (2026-07/08) | bzdid-architecture-decision.md:379 |
| 28 | ANS-104 DataItem header | ~1,044 B per item, claimant-paid | RULED (a), 2026-08-09 | bzdid-architecture-decision.md:131-136,245 |
| 29 | Autonomi chunk | ≤4,190,208 B; smallest file 3 B → MIN_ENCRYPTABLE_BYTES = 3×MIN_CHUNK_SIZE; price is flat per chunk | MEASURED (source-cited) | docs/research/2026-10-05-autonomi-10-100gb.md:24-25; docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:25,89 |
| 30 | ANT chunk price | live median 0.0848 ANT/chunk ≈ $0.0035; merkle gas ≈ $0.000158/chunk | MEASURED (2026-08-21) | RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md:90-91 |
| 31 | NIP-44 v2 plaintext cap (current Buzz DMs) | 65,535 B (nostr 0.44.7 deploys 65,408) | MEASURED | docs/specs/SPEC-BCHAT-1.md:13-14,118 |
| 32 | 10B demand precedent (video) | 10B at 1% active → 37.72 Tb/s; 100% → 3.77 Pb/s at 0.377 Mb/s | ARITH receipt, "networkCapacity: UNVERIFIED" | docs/receipts/serverless-demand-2026-10-11.json; docs/dispatches/2026-10-11-serverless-ant-video.md:133-136 |
| 33 | 1M concurrent video precedent | 7.59 Tbps egress at f=0; 1,302–1,519 U-10G nodes | ARITH, MODEL no receipts | LOADMODEL-1M.md:65,105 |
| 34 | NAT/TURN fraction | 20–40% | ASSUMPTION (dispatch band; G-3 BLOCKED) | LOADMODEL-1M.md:74,136 |
| 35 | dense wireless | BLE mesh 500+ nodes: >1 s and <85% | CLAIMED (cited guidance) | docs/specs/SIM-MESHFEST-0.md:50,55-58 |

The external standards behind rows 16-17 are FIPS 204 Table 2 (https://doi.org/10.6028/NIST.FIPS.204) and FIPS 203 (https://doi.org/10.6028/NIST.FIPS.203). I did not fetch either PDF this session. The estate's crate assertions and KAT tests are the receipt I relied on.

## 2. First-order workload envelope at 10B users (ARITH, every input flagged)

**Inputs.** Each is an ASSUMPTION unless cited:
- N = 1e10 users (row 1). Population held constant across 1,000 years (A1).
- Messages sent per user per day: M ∈ {1, 10, 100} (A2). 1 is the memory floor. No ruling gives a messaging rate.
- Payload 200 B text (A3). Framing/header 100 B, covering id, timestamp, kind, AEAD tag and nonce (A4).
- Delivered copies per sent message k = 6, from 3 recipients × 2 devices (A5).
- Peak/average = 3× (A6). Relay utilisation u = 0.70 (A7, as in LOADMODEL :89).
- Every message retained forever, with no compression, counted per replica (A8). Multiply by the replication factor r, which is unruled.

**Bytes per PQ-signed message.** Sizes come from rows 16-18.
- (A) Self-contained, carrying sig + full pk: 200 + 100 + 3,309 + 1,952 = **5,561 B**.
- (B) Sig + 32 B key reference, pk exchanged once per relationship: 200 + 100 + 3,309 + 32 = **3,641 B**. The signature is 90.9% of this message.
- (C) B + one ML-KEM-768 encapsulation per recipient: **4,729 B** per delivered copy (X-Wing: 4,761 B).
- Classical Nostr-shaped comparison: 200 + 100 + 64 sig + 32 pk + 32 id = 428 B. B is 8.5× that, and the signature alone is 51.7× a BIP-340 signature.
- Archival wrapping: one ANS-104 DataItem per message adds ~1,044 B (+28.7% on B; row 28).
- x0x already negotiates key-cache V3 "Full/Ref" frames: "A Full/Ref transition changes the charged size" (`docs/evidence/pq-net-store-propagation-20261015/pubsub-0.5.87-v3-intent.patch:16,46`). So upstream already avoids resending the pk on every frame. The Ref frame size is UNVERIFIED.
- MLS: RFC 9420 application messages are signed with the sender's leaf signature key before encryption (https://www.rfc-editor.org/rfc/rfc9420, §6). That implies ~3,309 B per message under ML-DSA-65. Which MLS ciphersuite x0x uses is UNVERIFIED.

**Throughput, using B = 3,641 B.** Delivered = k × sent. Relay tier = sent + delivered.

| M | msgs/s avg | peak (3×) | sent B/day | sent Gbps | delivered Gbps | relay-tier Gbps | U-1G nodes avg / peak | U-10G nodes avg / peak |
|---|---|---|---|---|---|---|---|---|
| 1 | 115,741 | 347,222 | 3.64e13 (36.4 TB) | 3.37 | 20.2 | 23.6 | 34 / 102 | 4 / 11 |
| 10 | 1,157,407 | 3,472,222 | 3.64e14 | 33.7 | 202 | 236 | 338 / 1,012 | 34 / 102 |
| 100 | 11,574,074 | 34,722,222 | 3.64e15 (3.64 PB) | 337 | 2,023 | 2,360 | 3,372 / 10,114 | 338 / 1,012 |

For text, bandwidth is small next to video. 1M concurrent video already needs 7.59 Tbps (row 33).

**Connection count binds before bandwidth** (ARITH, given rows 7 and A5). 2×10¹⁰ device connections ÷ 100k per box = **200,000 boxes**. At M=100 peak, bandwidth needs only 10,114 U-1G nodes, so connections bind by ~20×; at M=1 they bind by ~2,000×. That holds only if every device keeps a persistent connection, which is itself an assumption. LOADMODEL reached the opposite conclusion for video, where forward bandwidth binds first (:91).

**Idle gossip overhead dominates useful traffic** (ARITH; rows 8, 10, 11; per device × 1e10):

| idle rate per device | per device/day | ×1e10 | ÷ M=100 relay-tier (2.36 Tbps) |
|---|---|---|---|
| 52 MB/min public mesh (W@tch) | 74.9 GB | 69.3 Pbps | 29,380× |
| 8 MiB/min desktop budget | 12.1 GB | 11.2 Pbps | 4,740× |
| 2 MiB/min constrained budget | 3.02 GB | 2.80 Pbps | 1,185× |
| ~1.0 MB/min private 9-node rig | 1.44 GB | 1.33 Pbps | 565× |

Extrapolating a 26–32-peer idle rate to a 10B mesh is UNVERIFIED in both directions. The estate's own verdict on that public-mesh rate: "nothing in this battery extrapolates" (`2026-10-12-btmd-mesh-dependability.md:253-255`). W@tch ships with the x0x agent switched OFF because of it (:56-59).

**Storage growth per replica.** Using B and A8:

| M | per year (all users) | per 1,000 yr | per user-year | per user, 1,000 yr | Arweave $/user-yr (row 27) |
|---|---|---|---|---|---|
| 1 | 13.3 PB | 13.3 EB | 1.33 MB | 1.33 GB | $0.040 |
| 10 | 133 PB | 133 EB | 13.3 MB | 13.3 GB | $0.40 |
| 100 | 1.33 EB | 1.33 ZB | 133 MB | 133 GB | $4.03 |

**Chunk-priced durable storage (Autonomi) and granularity** (ARITH on rows 29-30, one price from one date). At M=100 a user sends 36,525 messages/yr.
- Storing each message as its own file costs ≥3 chunk payments: 36,525 × 3 × $0.0035 ≈ **$385/user-yr**, or $3.85T/yr in aggregate.
- Batching a year of messages into one file needs 31.7 → 32 chunks ≈ **$0.11/user-yr**, or $1.12B/yr in aggregate.
- That is a ~3,400× difference. Under Article V.1 the user pays either figure, so storage granularity is a direct cost lever that falls on users.

**Identity and directory state** (ARITH; rows 16-19, 24):
- bpq card raw ≈ 1,952 + 1,216 + 32 + 3,309 = 6,509 B (≈ 8.7 KB as base64url JSON). Cards for 1e10 users ≈ **65 TB**. Public keys alone are 19.5 TB.
- Identities ever minted over 1,000 yr, assuming ~75-yr turnover (A9): ~1.33e11. Cards for all of them ≈ 868 TB; bzDiD genesis ops at 600 B ≈ 80 TB.
- MLS (RFC 9420 tree, PQ ciphersuite assumed, A10): a leaf ≈ 1,952 + 1,184 + 3,309 = 6,445 B, before credential/extension bytes.
  - A group the size of one Buzz community (60K, row 3) means ≈ **387 MB of public tree state per member**, with commit paths of ~16 nodes.
  - A 1e10 "global room" ≈ 64 TB per member, with ~34-node paths.

**On-chain (Vaulta)** (ARITH; rows 21-23):
- 1 byte per user = 10 GB, or 13.2% of all unallocated RAM (75.8 GB).
- The M=1 sent stream (421 MB/s) would fill all unallocated RAM in **~180 s**; at M=100 it takes 1.8 s. The Bancor relay cannot sell the last of it at any price (bzdid :412).
- One 300 B action per message is 16.6× the claimed 181 GB/day NET at M=1, and 1,657× at M=100.
- Ruled design keeps chain bytes O(1): 148,156 B for any N.

## 3. What cannot be global state (ARITH conclusions; the collision named in each)

1. **The message log.** It grows 13 PB to 1.33 EB/yr. A node that receives every message needs 3.4–337 Gbps (sent stream) or 36 TB/day at M=1. That is 485× the 75 GB/day idle bill already judged unacceptable for a device. This collides with x0x ADR 0006 and Law X-1, and with Buzz's "single source of truth" relay at 1e6 communities (1e10 ÷ 10K).
2. **Per-message or per-user chain state.** See §2 on-chain: it breaks bzdid :61 and the registrant-pays hardline (:144-212).
3. **A global identity or card directory.** At 65 TB it is storable on an archive but not on every device. It also collides with bzdid :390 ("No authoritative store must exist") and ADR 0006.
4. **Global groups or rooms as one MLS tree.** O(n) PQ tree state per member: 387 MB at 60K, 64 TB at 1e10.
5. **Global CRDT KV convergence.** At only 9 nodes, stock shed_normal already misses a 30 s gate in 9/10 trials, and anti-entropy recovers in ~53 s (row 13). The founder ruled that healing is not delivery.
6. **Global presence or heartbeats.** One beat per user per minute = 1.67e8 updates/s (ARITH; the rate is assumption A11).

What the ruled record does allow globally: commitments, not records. That means one root per epoch on chain (0 B net on ring wrap, bzdid :142); per-epoch notary roots on BCH/BTC, "ANCHOR, NOT WAREHOUSE" (`docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md:72-77`); and a single global name tree of ~640 GB to 2.6 TB, as one tree with mirrorable shards.

## 4. 1,000-year and format-durability notes

- SPEC-BNROSE-3 is a SKELETON (`docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md:9`). The epoch record format (§3), the cold-start verifier (§4) and archival-node ops (§5) are all placeholders (:107-111). No ruled format-durability rule exists yet for messages.
- The live tip needs "a thin live layer per chain" (:31-36). The mirror is not a live node.
- The storage formula is linear in bytes/msg. A future signature-scheme migration rescales every row of §2: SLH-DSA-SHAKE-256f signatures are 49,856 B, about 13.7× the B shape. That value is CLAIMED from FIPS 205 Table 2 and not found in estate code. The estate uses SLH-DSA-SHAKE-256f only for its succession commitment (`docs/specs/SPEC-BPQ-1.md:87`).
- Continuity evidence so far: a cold version replacement v0.46.0→v0.47.1 kept identity and data, and a downgrade failed closed (X0XKVS2), both MEASURED on 9 nodes (`2026-10-12-btmd-mesh-dependability.md:207-212`). Simulated extinction and generation-transition tests are not found.
- Domain dependence: the filter blocks `.buzz` by SNI, and this was documented on 2026-08-31 (`SPEC-BUZZ-MULTIRELAY-1.md:29-32`), the same failure seen tonight. Memory also records "WebAuthn alone does not survive losing the original domain" (memory :24).

## 5. Gaps (no ruling or receipt located)

- No ruled messages/user/day, group-size distribution, device count, retention default or replication factor. bchat's `retain: persistent|until-read|ephemeral` has no default at scale (`SPEC-BCHAT-1.md:67`). Storage swings 100× on M alone.
- No measured ML-DSA-65 sign/verify throughput anywhere in the estate. Relay CPU per verified event is UNVERIFIED.
- No measured buzz-relay events/s or connections per box. 10K + 50K is a vision target and 100k connections is a quoted ceiling.
- Largest x0x evidence is 9 nodes on one host. The 10k-node rung (LOADMODEL G-4) has not been walked.
- The x0x MLS ciphersuite and the V3 Ref frame size are UNVERIFIED.
- f_nat (20–40%) is unmeasured (G-3 BLOCKED).
- Population trajectory and generation length over 1,000 years are not ruled (A1, A9).
- CLAUDE.md line references for bzdid are stale: :137→:142, :245→:390, :292→:437. Its "143 KB" (:29) disagrees with the §5 table's 148,156 B = 144.7 KiB (:353).
