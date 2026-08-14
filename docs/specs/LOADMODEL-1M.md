# SPEC — LOADMODEL-1M · BNRoSe Realtime Layer: 1,000,000-Concurrent Capacity + Margin Model

**Routing:** `beehive-nature/docs/specs/LOADMODEL-1M.md` (BNRoSe spec corpus home; BNRoSe-0 Charter §0.1 downstream-citation rule applies)
**Status:** MODEL DRAFTED — no receipts. Every figure below is either (a) arithmetic over a number cited to an input artifact, or (b) tagged **[ASSUMPTION]**. Nothing here is a performance claim (receipt rule: no ✅ without pasted output).
**Authority:** dispatch `BNROSE-REALTIME-LOADMODEL-0813` (2026-08-13). Job: capacity + margin model for 1,000,000 concurrent high-demand video/audio users (influencer/festival load) on the BNRoSe realtime layer.
**Charter leg (per BNRoSe-0 §0.1):** serves **L3 — ephemeral compute, b-metered** (realtime forwarding is metered ephemeral compute; it is not eternal data L1, and it constrains — but is not — the replay discipline L2).
**Scope fences honored:** no new architecture; no economics rulings assumed; no dollar figures invented. Dollar figures that appear are *quotations of artifacts*, cited.

---

## 0. Stop-and-report cross-check (dispatch clause)

Inputs were checked against the ledger rulings: `Downloads/LEDGER.md`, `RULINGS-2026-07-26.md` (R1–R3), `RULING_neutral_layer_and_topology.md`, `pirate-haul-rulings.md` (Buzz / x0x / Hive / raid doctrine), `TREASURY-1-NOTES_*` §11.10 discipline, `SPEC-BNROSE-0-CHARTER.md`, R7 addendum (Eternal Computer / bTiMe), `VPS_COST_ANALYSIS.md`.

**Verdict: NO input contradicts a ledger ruling. Proceed.** Three flags surfaced — escalated here, not silently resolved:

- **FLAG-1 — VPS unit-spec tension (artifact vs artifact).** The Buzz docket cites the node-infra ledger unit as "$100/mo, 64 GB, 10 Gbps, non-shared" [Buzz-dkt R-1]. `VPS_COST_ANALYSIS.md` (2026-07-16) states that spec "does not exist anywhere in 2026" — realistic $300–500/mo; the ~$101/mo class buys 128 GB ECC + 24 TB HDD + **1 Gbps** [VPS-CA]. Neither side is a founder economics ruling, so this is a flag, not a stop: the model carries BOTH unit classes (§5) and keeps margin symbolic (§7) so no dollar resolution is smuggled in. Founder reconciliation owed (§8 G-5).
- **FLAG-2 — which ledger pays operators.** TREASURY-1-NOTES §11.10: Vaulta chain operators are "paid in A, NOT in b… b never pays for infrastructure; b authorizes → treasury spends A." This model classifies SFU forwarding as **L3 ephemeral compute** — the Charter's b-metered leg ("compute rented by the mesh-second in b", bTiMe vouchers) — not Vaulta chain ops. If the founder later rules forwarding is §11.10-class infrastructure, the price variable re-denominates in A and the GB arithmetic below is unchanged. Not resolved here.
- **FLAG-3 — extrapolation distance.** The LiveKit/Rust raid artifact's own honesty limit: "nobody has demonstrated 10B-endpoint realtime fan-out"; its Stage-2 gate is a **10k-subscribed-node testnet** before claiming any higher scale [GAP Gap-2 + Stage 2; ledger copy 2026-08-11]. 1M concurrent is ×100 beyond the ruled gate; every node count below inherits **[ASSUMPTION]** until the gate ladder is walked with receipts (§8 G-4).

**Non-contradictions, recorded so they are not re-litigated:** "6-way rooms" (dispatch class definition) vs founder circle-size-8 [D-3] — different domains (media room vs decision circle); no conflict. LiveKit Agents' turn-detection model license caution [PH-candidates] — no LiveKit Agents component is load-bearing in this model.

---

## 1. Inputs (all read this session)

| # | Input | File | Role in the model |
|---|---|---|---|
| I-1 | **Buzz raid artifact (10B-scale)** — self-hosted relay docket + Buzz ruling | `Downloads/DOCKET_BUZZ_SOVEREIGN_RELAY.md`; ruling 2026-07-21 in `Downloads/pirate-haul-rulings.md` | node unit spec; "scale toward 10B" inherited non-negotiable; Buzz = human plane (plane law) |
| I-2 | **LiveKit/Rust raid artifact** — BNR Ecosystem Gap-Analysis Boarding Report | `Downloads/compass_artifact_wf-f7ebd09b-*.md`; ledger copy `beehive-nature/docs/ledger/pirate-haul-candidates.md` (2026-08-11) | TURN as real recurring cost; LiveKit (self-hosted) covers *live*; 10k fan-out gate; connection-count ceiling; "decentralize and amortize, not eliminate" |
| I-3 | **Voice-loop rulings** | `VOICE-1.md`; D-004→D-008; D-009a/a2/b/b2/c (Downloads + LOVErnment-DAO/dockets) | control-plane caps (≤3 posts/day, 21-day heartbeat); fail-closed G-Q; single-instance precondition (D-009b F-3) |
| I-4 | **Ledger + economics rulings** | `RULINGS-2026-07-26.md` (R3); `TREASURY-1-NOTES_2..5` §11.10; R7 addendum (bTiMe / mesh-second); `SPEC-BNROSE-0-CHARTER.md`; `VPS_COST_ANALYSIS.md`; `compass_artifact_wf-c9696483` (b-metered fair-use mesh spec) | margin fences; b-meter variable *shapes*; unit-cost reality bands |
| I-5 | **NAT evidence** | `DISPATCH_COWORK_NODE5_PORT.md` | member-side NAT reality: exactly ONE NAT-PMP forwarded port, 60 s lease, random 40000–65535, changes on every VPN reconnect — the condition the TURN band models |

---

## 2. Decomposition of 1,000,000 concurrent users into room/stream classes

The dispatch names the classes; the **mix is [ASSUMPTION]** (no artifact states a traffic mix). Worked default — an operator can substitute shares and re-derive:

| Class | Users | Units | Shape |
|---|---|---|---|
| **A — 1:1 calls** | 200,000 | 100,000 simultaneous calls | 2 senders; each receives the other |
| **B — 6-way rooms** | 480,000 | 80,000 simultaneous rooms | 6 senders; each receives the other 5 |
| **C — 1-to-many broadcast** | 320,000 | 320 casts × 1,000 viewers | 1 sender (influencer/festival stage); viewers receive-only |
| **Total** | **1,000,000** | — | — |

**Media rate per sending participant r = 2.6 Mbps** (2.5 video + 0.1 audio) **[ASSUMPTION]** — no input artifact states media bitrates. The model is linear in r: substitute the measured rate and every downstream figure scales.

**Plane note (cited, not designed):** signaling/membership rides Buzz signed events (human plane, per the x0x ruling's PLANE LAW). Buzz's own relay target is 10K humans + 50K agents, and single-relay = single-community today [PHR Buzz; wf-c9696483] → 1M concurrent implies ≥100 relay communities' worth of signaling federation. Control-plane federation is a named open item (§8 G-6), not assumed solved.

---

## 3. SFU forwarding math, per class

Formulas first (re-derivable by any operator):
- Class A egress = calls × 2r  ·  Class B egress = rooms × 6 × 5 × r  ·  Class C egress = viewers × r
- Ingress = senders × r  ·  all figures below use r = 2.6 Mbps **[ASSUMPTION]**

| Class | Ingress | SFU egress, f=0 | ×1.2 (f=20%) | ×1.4 (f=40%) |
|---|---|---|---|---|
| A — 1:1 | 520 Gbps | 520 Gbps | 624 Gbps | 728 Gbps |
| B — 6-way | 1,248 Gbps | 6,240 Gbps | 7,488 Gbps | 8,736 Gbps |
| C — broadcast | 0.832 Gbps | 832 Gbps | 998.4 Gbps | 1,164.8 Gbps |
| **Fleet** | **1.769 Tbps** | **7,592 Gbps (7.59 Tbps)** | **9,110 Gbps** | **10,629 Gbps** |

Per-unit SFU load: A = 5.2 Mbps/call · B = 78 Mbps/room · C = 2.6 Gbps per 1,000-viewer cast.
Forwarded volume: **3.42 PB/hour** base (f=0); **4.10 PB/h** at f=20%; **4.78 PB/h** at f=40% [arithmetic]. Sustained-month equivalents: 2.46 / 2.95 / 3.44 EB.

---

## 4. TURN-relay fraction (20–40% NAT-blocked)

- Band f_nat ∈ [0.20, 0.40] is **dispatch-mandated**, direction corroborated by artifacts: TURN servers are named as a real, recurring WebRTC NAT-traversal cost [GAP §C]; and the node5 dispatch documents the member-side reality — one forwarded inbound port, 60 s lease, random port number, changes on reconnect [node5-port]. At 1M users: **200,000 (f=20%) to 400,000 (f=40%) participants ride TURN-style relay.**
- **Relay multiplier [ASSUMPTION]:** TURN-relayed media transits a relay twice (ingress + egress) → fleet forwarding throughput × (1 + f_nat). Per-allocation accounting is finer but not more honest at this granularity.
- TURN capacity is counted **inside** the fleet totals (member nodes may serve the relay role). Carving out a separate TURN fleet would be new architecture — out of scope.

---

## 5. Member-node units and CPU

Two unit classes, both carried (FLAG-1):

| Unit | Spec | Source |
|---|---|---|
| **U-10G** (ledgered) | 64 GB RAM, 10 Gbps non-shared | [Buzz-dkt R-1, "per node-infra ledger"] — realism contested by [VPS-CA] ($300–500/mo) |
| **U-1G** (budget reality) | 128 GB ECC, 24 TB HDD, **1 Gbps** unmetered, ~$101/mo (every $50–150/mo option surveyed is 1 Gbps) | [VPS-CA] |

- Utilization cap **u = 0.70 [ASSUMPTION]** → sustained forward budgets: **7.0 Gbps (U-10G)** / **0.7 Gbps (U-1G)** per node.
- **CPU is symbolic:** no input artifact carries SFU CPU-per-stream data. κ = vCPU per Gbps forwarded, placeholder **κ = 2 [ASSUMPTION, UNVERIFIED]**. At κ=2 a U-10G node at 7 Gbps needs 14 vCPU — fits the 8c/16t Xeon D-1541 cited in [VPS-CA]; on such nodes **bandwidth remains the binding constraint**; on weaker nodes CPU binds first. Fleet CPU at f=20% ≈ 9,110 × κ vCPU. **Benchmark receipt owed before any fleet commitment (§8 G-1).**
- Connection-count cross-check (not binding): artifact ceiling "100k+ realtime connections" on a strong dedicated box [GAP, PocketBase boarding facts] vs worst case here — a U-10G node carrying B-class load holds ~90 rooms = ~540 media participants, orders of magnitude below the connection ceiling. **Forward bandwidth binds long before connection count.**
- Cross-node fan-out for Class C follows the ruled direction (TAKE iroh-gossip/gossipsub mesh pub/sub; BUILD fan-out on the Nostr/Buzz + x0x rails) [GAP Gap-2 verdict] — topology changes latency/CPU shape, not the GB arithmetic.

---

## 6. OPERATOR TABLE — node count + uplink requirement, per class

**Per-node uplink requirement (sustained egress): U-10G ≥ 7 Gbps · U-1G ≥ 0.7 Gbps.** Node counts are bandwidth-bound (§5); round up per class.

| Class | Users | Units | Egress f=0 | f=20% | f=40% | **Nodes U-10G** (7 Gbps ea.) @20% / @40% | **Nodes U-1G** (0.7 Gbps ea.) @20% / @40% |
|---|---|---|---|---|---|---|---|
| A — 1:1 | 200,000 | 100,000 calls | 520 Gbps | 624 | 728 | **90 / 104** | **892 / 1,040** |
| B — 6-way | 480,000 | 80,000 rooms | 6,240 Gbps | 7,488 | 8,736 | **1,070 / 1,248** | **10,698 / 12,480** |
| C — 1-to-many | 320,000 | 320 × 1,000 viewers | 832 Gbps | 998.4 | 1,164.8 | **143 / 167** | **1,427 / 1,664** |
| **FLEET** | **1,000,000** | — | **7,592 Gbps** | **9,110** | **10,629** | **1,302 / 1,519** | **13,015 / 15,184** |

Support rows [arithmetic]: users per U-10G node at f=0 — A ≈ 2,692 · B ≈ 538 · C ≈ 2,692. TURN-relayed participants: 200k / 400k. Aggregate user-side uplink (all senders) ≈ 1.77 Tbps.
Sensitivity: every count scales linearly in r and in 1/(u × NIC). Halving r halves the fleet; raising u from 0.70 to 0.90 cuts counts ~22%.

---

## 7. Margin — symbolic b-meter expression (no invented dollar figures)

Variables — none numeric; setting any of them would be an economics ruling, which this dispatch forbids assuming:

- **p** = price per **GB forwarded**, denominated in b — the b-meter unit for the forwarding leg. The ruled precedent shape is bTiMe's mesh-second ("compute rented by the mesh-second in b") [R7 Item A; Charter L3], extended to GB-forwarded per this dispatch; metering mechanics follow the b-metered fair-use mesh spec (metered unit + prepaid session voucher + pro-rata attribution at settlement) [wf-c9696483].
- **s** = **node-operator share** of p (0 < s ≤ 1); network/treasury share = 1 − s.
- **C_node** = operator's all-in cost of one node-month, in b. (Dollar bands existing in artifacts are quotations, not inputs: $100/mo ledgered-10G claim [Buzz-dkt]; ~$101–137/mo 1-Gbps class; $300–500/mo realistic 10-G [VPS-CA]. Converting them into b would require a b price — no ruling sets one.)
- **F_node** = GB forwarded per node-month = NIC × u × 324 TB per Gbps-month. At U-10G / u=0.70: **F_node = 2.27 × 10⁶ GB/node-month** [arithmetic on cited unit spec].

**Per node-month:  M_node = s · p · F_node − C_node**  ·  break-even price  **p* = C_node / (s · F_node)**
**Fleet-month:  M_fleet = s · p · V_month − N · C_node**, with V_month = 2.95 EB (f=20%) / 3.44 EB (f=40%) sustained [arithmetic]; N = fleet node count (§6).

Ruling fences binding on this expression (cited):
1. **BNR never in the flow of funds; b is granted by the treasury on completion, not sold** [RULINGS-2026-07-26 R3] — the b paying p is treasury/sponsor-side, never a user token sale through BNR.
2. **No b-token at time of service** [PH-candidates, Hive entry] — consumers are membership/fair-use gated ("membership is the only gate" [wf-c9696483]); metering settles the supply side.
3. **§11.10 discipline** [TREAS §11.10] — if forwarding is later ruled infrastructure-class, operators are paid in A and p re-denominates; the GB arithmetic is unchanged (FLAG-2).
4. **Egress is a real cost to amortize, not rent to eliminate** — "decentralize and amortize, not eliminate"; egress fees are "rent on your own data" [GAP §C]. The member-node fleet amortizes egress across user-owned units (onboarding tier 1: members "run a full node and relay VPS" [R6 §C]).

---

## 8. Verify gates (receipt rule — none closed yet)

- **G-1** CPU benchmark: κ measured on the reference unit, pasted load receipt — required before fleet commit. **FIRST RECEIPT (2026-08-14, FIRSTLIGHT-VENUE, bridge unit ≠ reference unit):** 6-way video room ≈ 0.055 core (≈18 rooms/core, Neoverse-N1 ×4); κ-with-floor ≈ 17 vCPU/Gbps at 0.003 Gbps, co-located loadgen, loopback-only — placeholder κ=2 NOT validated; gate stays open for a NIC-exercised ≥100 Mbps run on the reference unit.
- **G-2** Media-rate measurement: r per class from a live high-demand event (replaces [ASSUMPTION]). **FIRST RECEIPT (2026-08-14, synthetic only — gate stays open):** 6-way audio ≈ 20.5 kbps/publisher; forwarded video ≈ 533 kbps/track (simulcast layers, synthetic pattern, 0% loss, 6/6 tracks both runs). Real DJ/stage media r still unmeasured.
- **G-3** NAT-fraction measurement: f_nat from connection telemetry (the node5-port dispatch demonstrates the measurement pattern; 20–40% is a dispatch band, not a measurement). **BLOCKED (2026-08-14, evidence re-based):** external curl to :7880 times out (000/10 s) while the VPS answers 200 on localhost and instance iptables ACCEPTs — cloud-layer (OCI Security List/NSG) block is the standing hypothesis. TCP-SYN probes from the ops box return True even on ports with no listener (80/443) = SYN-interception false positives; they are not evidence. Founder act: open TCP 7880/7881 + UDP 7882/3478 in the OCI console (console = ground truth). Band remains [ASSUMPTION].
- **G-4** Fan-out gate ladder: 10k-node testnet per Stage-2 [GAP], then ×10 steps toward 1M — no scale claim skips a rung.
- **G-5** Founder reconciliation of FLAG-1 (unit spec) and FLAG-2 (settlement denomination).
- **G-6** Control-plane federation: signaling across ≥100 relay communities [PHR Buzz single-relay limit] — spec owed before 1M is claimable end-to-end.
- **G-7** License verification for any LiveKit component actually adopted (turn-detection models carry a separate license) [PH-candidates; R6 §F].

---

## Honesty gate

"Modeled" ≠ "demonstrated." This file is arithmetic over cited artifacts and tagged assumptions — not a capacity claim. The 10B non-negotiable [Buzz-dkt] is inherited as direction, and the raid artifact's own limit stands: decentralized realtime fan-out at this scale is unsolved in the wild [GAP; ledger 2026-08-11].
