# SIM-MESHFEST-0 — POPUP-MESH SIMULATION SPEC (500k dense multiday festival)
**Seat:** Cowork · **Date:** 2026-08-14 · **Dispatch:** SIM-MESHFEST-0813 (coordinate with DeepSeek)
**Status: SPEC. The sim follows this file.**
**Intake rule accepted: a sim without RF contention modelling is rejected. This spec is
written so that rejection is mechanical, not a matter of taste — see §6.**

---

## §0 — THE PHYSICS THAT DECIDES THE ANSWER (state it first, then measure it)

**Wireless capacity is per unit AREA, not per device.** Devices in one collision domain
share airtime under CSMA/CA — they take turns. **Adding a device does not add capacity; it
adds a competitor for the same airtime.** Capacity per area is set by *spectrum × spatial
reuse*, and spatial reuse is bought with **physical isolation** (directional antennas, low
power, walls), not with software.

**Consequence the sim exists to QUANTIFY rather than assert:** at 500,000 people in a dense
footprint, **a pure device-to-device mesh cannot carry audio or video**, and the interesting
question is not *whether* it fails but **at what density, per load class, and how it fails**
— graceful degradation or collapse.

**The sim is therefore a capacity-and-failure instrument, not a feasibility argument.** If it
returns "pure mesh works at 500k," the sim is wrong and the first thing to audit is whether
airtime is actually being modelled (§6).

## §1 — PARAMETERS — every row CITED or tagged ASSUMPTION

**Nothing enters the model unlabelled.** An ASSUMPTION is not a defect; **an unlabelled
assumption is.**

### 1.1 Wi-Fi (802.11)

| # | parameter | value | status |
|---|---|---|---|
| W1 | Clients per AP for adequate airtime | **50–100** | **CITED** — high-density design guidance |
| W2 | Stadium-class AP client support | **100–200 STAs** | **CITED** |
| W3 | Venue-scale user population precedent | **50k–100k** (stadium) | **CITED** — *note: our target is 5–10× this* |
| W4 | Dense-deployment effect | interference ↑ packet error rate, ↓ concurrent transmissions per area | **CITED** |
| W5 | Capacity mechanism | CSMA/CA contention; 802.11ax OFDMA replaces contention with scheduling | **CITED** |
| W6 | Spatial reuse method | directional antennas, **≤30° beamwidth**, to carve isolated zones | **CITED** |
| W7 | 2.4 GHz non-overlapping channels | **3** | **ASSUMPTION** (standard, not re-verified here) |
| W8 | 5 GHz usable channels at venue power/DFS | **ASSUMPTION — must be set per venue and per regulatory domain; do NOT hardcode** |
| W9 | Per-STA goodput under contention | **derived, not assumed** — output of the airtime model, never an input |

### 1.2 BLE / BLE Mesh

| # | parameter | value | status |
|---|---|---|---|
| B1 | Nominal max nodes per BLE Mesh network | **32,767** | **CITED — and misleading in practice; do not use as a capacity input** |
| B2 | Measured latency/reliability by network size | <50 nodes: **<100 ms, 98–99%** · 50–200: **100–300 ms, 94–97%** · 200–500: **300–800 ms, 85–93%** · **500+: >1 s, <85%** | **CITED** |
| B3 | TTL default / practical hop limit | default **5**; real degradation beyond **5–7 hops** | **CITED** |
| B4 | Typical payload | **11–15 bytes** | **CITED** |
| B5 | Congestion mechanism | flooding ⇒ redundant rebroadcast ⇒ contention ("silent killer") | **CITED** |

> **⛔ B2 IS THE HEADLINE AND IT SHOULD BE READ BEFORE ANY TOPOLOGY IS DEFENDED.** BLE mesh is
> already **outside its measured envelope at 500 nodes**. The festival is **500,000** — three
> orders of magnitude past the point where reliability drops below 85% and latency exceeds a
> second. **BLE mesh is a local-cluster control channel in this design or it is nothing.**

### 1.3 Devices, battery, churn — **ALL ASSUMPTION, and they must be swept, not fixed**

| # | parameter | status |
|---|---|---|
| D1 | Battery capacity distribution across a real crowd's phones | **ASSUMPTION — sweep** |
| D2 | Drain rate per radio mode (idle / scanning / relaying / video TX) | **ASSUMPTION — sweep; relaying is the term that decides mesh viability** |
| D3 | Fraction willing to relay (battery-donating strangers) | **ASSUMPTION — sweep from 0. Treat high values as adversarial optimism** |
| D4 | Churn: arrival/departure/sleep/dead over a multiday event | **ASSUMPTION — sweep** |
| D5 | Screen-on fraction (gates optical, §2.6) | **ASSUMPTION** |

> **D3 is where mesh simulations usually lie to themselves.** A phone that relays other
> people's video is a phone whose battery dies before the headliner. **The sim must report
> the relay-participation rate its result depends on**, and a result requiring >20%
> sustained volunteer relaying should be labelled accordingly.

### 1.4 Uplink asymmetry and NAT — **ASSUMPTION unless a venue quote exists**

| # | parameter | status |
|---|---|---|
| U1 | Venue backhaul down/up asymmetry | **ASSUMPTION — and asymmetry is the constraint: crowds UPLOAD** |
| U2 | CGNAT / carrier NAT prevalence | **ASSUMPTION** |
| U3 | Peer-to-peer hole-punch success rate behind CGNAT | **ASSUMPTION — and low. Failure ⇒ relay ⇒ backhaul load** |
| U4 | TURN relay fallback fraction | **derived from U3, not assumed** |

> **NAT is not a detail — it converts "peer-to-peer" into "relayed through infrastructure"**
> for whatever fraction fails to hole-punch, and that fraction lands squarely on the backhaul
> the pure-mesh topology claims not to need.

## §2 — THE SIX REQUIRED MODELS (acceptance criteria, restated as build items)

1. **Airtime contention, per channel, per unit area.** Model CSMA/CA airtime as the shared,
   conserved resource. **Not an abstract link graph** — a graph edge implies capacity that
   airtime does not grant. Per-area channel budget = channels × spatial-reuse factor (W6).
2. **Battery + churn.** Devices leave, sleep, die. **A relay that dies mid-path is a topology
   change**, not a lost packet.
3. **Uplink asymmetry + NAT.** Per §1.4, with TURN fallback derived.
4. **Three load classes, measured SEPARATELY and never averaged** (§4).
5. **Topology comparison** (§3).
6. **Decimen optical as a ZERO-RF channel** (§5) — it consumes **no airtime**, which is its
   entire strategic value here.

## §3 — TOPOLOGIES COMPARED

| id | topology |
|---|---|
| **T-A** | **Pure device mesh** — no fixed infrastructure |
| **T-B** | **Device mesh + wired venue relay backbone** — fixed APs on wired backhaul, devices mesh locally |

**T-B is the realistic one and the sim must still measure it honestly** — a wired backbone
moves the bottleneck to the AP's air interface and the backhaul uplink; **it does not remove
the airtime limit, it buys spatial reuse.**

## §4 — LOAD CLASSES (separate tables; averaging them hides the result)

| class | shape | why separate |
|---|---|---|
| **L1 control/gossip** | tiny, bursty, delay-tolerant | the only class BLE mesh can plausibly serve |
| **L2 audio** | ~continuous, low bitrate, **latency-critical** | tolerates loss badly, tolerates delay worse |
| **L3 video** | continuous, **high bitrate** | dominates airtime; will set the failure threshold |

**A single "bandwidth" number across these three is a wrong answer with a confident face.**

## §5 — DECIMEN OPTICAL AS A ZERO-RF CHANNEL

Screen→camera transport. **Consumes zero spectrum**, so it is *additive* to a saturated RF
environment rather than competitive with it — the one channel whose capacity does not
degrade as the crowd grows.

**Bounds (from the L-VERIFY receipt, `docs/register/LVERIFY-DECIMEN-2026-08-13.md`):**
~128 KB/s phone-to-phone, ≤64 MB payloads, **line-of-sight, one-to-one, human-mediated**.

**Therefore: config/schedule/onboarding payloads — YES. Audio/video — NO, and the sim must
not model it as a media path.** Its correct role is **removing L1 load from the RF budget**,
and the sim should quantify exactly that: *how much airtime is freed by moving config
distribution optical.*

## §6 — WHAT MAKES THIS SIM RECEIPT-INVALID (self-rejection, mechanical)

**The sim REJECTS ITS OWN RUN if any of these hold:**

1. **No airtime accounting** — if capacity is not a conserved per-area resource, **REJECT**.
   *Test:* doubling device density in a fixed area **must** reduce per-device goodput. If it
   does not, the model is a link graph wearing a radio costume.
2. **A "bandwidth" figure that averages L1/L2/L3** — **REJECT**.
3. **Any unlabelled parameter** — every value CITED or ASSUMPTION — **REJECT**.
4. **T-A succeeding at 500k for L2 or L3** — **REJECT AND AUDIT**; that result contradicts
   §0 and indicates the contention model is not binding.
5. **Relay-participation assumption not reported** with the result — **REJECT** (§1.3 D3).
6. **BLE mesh used above its measured envelope** without a flag citing B2 — **REJECT**.

> **Criterion 1 is the negative control, and it is the point.** A sim that cannot be made to
> fail by adding devices is not modelling contention. **Run that check first and report it in
> the output header**, so a green result is never a green result of unknown provenance.

## §7 — OUTPUT FORMAT

**Capacity table: per topology × per load class.** Columns: sustainable offered load, per-device
goodput, latency p50/p95, delivery ratio, **and the density at which each falls off a cliff**.
**Failure thresholds are the deliverable** — the number of devices per unit area at which each
class stops meeting its own budget. Plus a **freed-airtime** figure for §5.

## COMPLICATIONS

**C1 — Half the parameter table is ASSUMPTION, and the honest ones are the device/battery/NAT
rows.** Those are exactly the rows that decide T-A's viability. **A result is only as good as
its D3 sweep**, which is why the sim reports the assumption alongside the number rather than
in an appendix.

**C2 — I have not written the sim.** This is the spec. **The intake gate in §6 applies to my
own implementation as much as to anyone's**, and criterion 1 is the first thing I will run.

**C3 — No venue measurements exist.** Every RF citation here is from stadium/high-density
*design guidance*, not from a measured 500k festival. **A 500k multiday crowd is larger than
the cited precedent (W3) by 5–10×**, so the model extrapolates past its own sources — stated
plainly rather than smoothed over.

**C4 — Coordination with DeepSeek is dispatched but not yet performed.** Nothing in this file
reflects their input. **Whatever they contribute enters as CITED or ASSUMPTION like everything
else**, including if it contradicts §0.
