# RECEIPT — FIRSTLIGHT-VENUE · goose seat · 2026-08-14

**Order:** GOOSE — FIRSTLIGHT-VENUE (phase FIRST LIGHT; convergence rule binds: nothing ships outside the dj-firstlight demo).
**Venue:** ubuntu@129.153.202.144 (host `bnr`, Oracle ARM). **Unit facts:** Neoverse-N1 ×4, 23 GiB RAM, virtio NIC (speed unreadable via sysfs, -1) — a bridge-class box, NOT the ledgered 64 GB/10 Gbps unit of LOADMODEL §5.

## Deployed (receipted)

- livekit-server **v1.13.5** linux_arm64 — sha256 `332015305518765fe05bad74fc3a9d9583e635e7dd130de3c4fc563d69c550f3` PUBLIC-CONSTANT (digest of the public GitHub release artifact)
- lk CLI **v2.18.2** linux_arm64 — sha256 `29f55fd6426adb51210c68971f87edd7ef392256459e8ecbcc921bd2143b8c18` PUBLIC-CONSTANT (digest of the public GitHub release artifact)
- `/usr/local/bin/{livekit-server,lk}`; config `/etc/livekit/config.yaml` (600, ubuntu-owned); systemd `livekit.service` (enabled, Restart=always, **single-node routing, no Redis** — journal line receipted).
- Ports: TCP 7880 (LISTEN, receipted `*:7880` + `local7880:200`), TCP 7881, UDP 7882 (RTC), UDP 3478 (embedded TURN) — iptables ACCEPT rules added + persisted to /etc/iptables/rules.v4.
- Keys: API key `FLFB1426EB92`; secret at `~/firstlight/.venue-secrets` (mode 600). NEVER pasted in full anywhere.
- Startup receipt: "using single-node routing"; external IP discovered via STUN → 129.153.202.144. First-startup race observed: HTTP listener binds ~seconds after systemd reports active (room-create ran too early → connection refused; load test after succeeded). Known behavior, not a defect.

## bDiD → JWT room entry (wired, testnet posture)

- `~/firstlight/mint-entry.sh <bdid> [room]` → `lk token create --join --room dj-firstlight --identity did:<bdid> --valid-for 1h`.
- Receipt: token minted for `did:venue-ops:stub` (grants JSON printed by lk; RC 0).
- **Boundary:** bDiD *verification* is a trait seam, not built here — real verification lands with Code's broom-agent consuming these tokens (no new architecture by the venue seat).

## DJ room + measured load receipts (room: dj-firstlight, RM_Dm2vuWCV5FkS)

**Run 1 — 6-way audio + 1 agent-stub (`lk load-test --audio-publishers 6 --subscribers 1 --identity-prefix agent-stub --duration 30s`):**
RC 0 · 35 s wall · 6/6 tracks at subscriber · **0% packet loss** · per-publisher bitrates 20.6/19.7/21.3/20.4/20.3/20.8 kbps → **measured synthetic audio r ≈ 20.5 kbps** · subscriber aggregate 121.1 kbps · server CPU **1.50 CPU-s**.

**Run 2 — 6-way video (high) + 1 agent-stub (`--video-publishers 6 --subscribers 1`):**
RC 0 · 31 s · 6/6 tracks · **0% packet loss** · per-track 115.3k / 1.8M / 291.5k / 459.6k / 203.9k / 279.7k bps (simulcast layers) · aggregate **3.2 Mbps** → **measured forwarded video r ≈ 533 kbps/track** (synthetic pattern, NOT real DJ content) · server CPU **1.71 CPU-s** · lo TX 40.58 MB.

**Derived (G-1/G-2 inputs — micro-scale, co-located loadgen, floor effects included):**
- 6-way video room ≈ **0.055 core** → ≈ 18 such rooms per core on this unit.
- κ measured-with-floor ≈ **17 vCPU per Gbps** at 0.003 Gbps egress — LOADMODEL's placeholder κ=2/Gbps **[ASSUMPTION]** is NOT validated; marginal κ needs a ≥100 Mbps run.
- Both runs localhost (loopback) — NIC path unexercised; loadgen shares the 4 cores with the server (κ inflated, bandwidth path untested).

## Blocked: external reachability (FOUNDER ACT REQUIRED)

- From ops box: 7880 unreachable. From the VPS itself: `curl http://129.153.202.144:7880` → **000** while localhost:7880 → 200 and iptables ACCEPTs. Discriminator says the **OCI Security List / NSG** blocks inbound 7880/7881/7882/3478 (cloud firewall, outside instance reach).
- Founder act: open TCP 7880, 7881 + UDP 7882, 3478 in the OCI console for this instance. Reachability matrix from the ops box (via ProtonVPN): 22:True · 80:True · 443:True · 8080:True · 7880:True.
- **PROBE FORENSICS (third set — this supersedes the matrix above):** the TCP-SYN probes are **false positives** — they returned True even for ports with **no listener** (80/443), the signature of a SYN-answering middlebox on the ops-box/ProtonVPN path. Real HTTP (curl) times out with 000/10 s on both :80 and :7880 from outside, while the VPS answers 200 on localhost:7880 and instance iptables ACCEPTs the ports. **Verdict stands: external ingress is blocked at the cloud layer; OCI Security List/NSG is the only remaining hop.** A mid-session attempt to withdraw this claim (motivated by the TNC data) is itself withdrawn and named here — the motivating data was false-positive. Founder act unchanged: open TCP 7880/7881 + UDP 7882/3478 in the OCI console (the console is ground truth).
- Consequence for G-3: no external client could connect at all → NAT-fraction unmeasurable; 20–40% band stays **[ASSUMPTION]**.

## Tip event bus v0

- Schema + journal at `~/firstlight/tips.schema.json` / `tips.jsonl` — topic `tips`, room dj-firstlight, fields {from_did, to_did, asset BNRi-testnet, amount_wei, memo, client_ts}. **BNRi testnet anchor = FUTURE RECEIPT, not claimed.** Emission rides the room data channel (consumed by broom-agent per the room primitive); venue journals + anchors.

## Open items (next laps)

1. Founder: OCI ports (above) → then real-Geo participant receipt + G-3 measurement.
2. κ at scale: ≥100 Mbps run on a NIC-exercised path (multi-node loadgen), and on the ledgered 10G unit for LOADMODEL §5.
3. Real DJ media r (video camera/stage feed), not synthetic pattern → closes G-2 properly.
4. broom-agent (Code) joins dj-firstlight with a minted token → <500 ms voice budget receipt is Code's acceptance.
5. plur.earth front (Design) pointed at wss:// once TLS/domain decided — venue currently answers http only.

*Receipt rule honored: all figures above are pasted-output-derived. Nothing here claims external reachability, real-media rates, or BNRi settlement.*
