# READER NOTES — the decentralized user-pays-for-resources stack

Reader area: user-pays stack, for the PQ Buzz (x0x + BNRoSe) design. Facts only, no design.
Repo root for relative paths: `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3`.
Memory notes: `C:/Users/travi/.claude/projects/C--Users-travi-beehive-nature/memory/<name>.md`.
Classes: **RULED** (founder or governing text) · **MEASURED** (receipt with real output) · **CLAIMED** (asserted, no receipt here) · **UNVERIFIED**.
Read 2026-10-15. Nothing was built or run. Test counts below are `#[test]` grep counts I took myself; no suite was run.

---

## 1. The governing law (read this first)

| # | Rule (verbatim where quoted) | Citation | Class |
|---|---|---|---|
| L1 | "The kernel SHALL NOT require continuous operator subsidy for normal operation." | docs/CONSTITUTION.md:83 | RULED (but see note) |
| L2 | "Users fund the resources they consume; nodes are paid for capabilities they provide." | docs/CONSTITUTION.md:83 | RULED |
| L3 | "The paymaster *abstracts* user-funded payment; it must never *absorb* cost." | docs/CONSTITUTION.md:83 | RULED |
| L4 | The only allowed standing costs are bootstrap seeds and maintaining the spec and reference code. | docs/CONSTITUTION.md:83 | RULED |
| L5 | "Settlement is finite by design." Most interactions must never need ordered settlement. | docs/CONSTITUTION.md:85 | RULED |
| L6 | The resource token is "metabolic energy" and a **reference implementation**, "not a constitutional truth". | docs/CONSTITUTION.md:86 | RULED |
| L7 | `resource.accounting` = b-token; the paymaster abstracts a user-funded basket (Vaulta RAM/CPU/NET, ZANO gas, AR, ANT) "and never subsidizes". | docs/CONSTITUTION.md:128 | RULED (the appendix itself is marked "informative, non-constitutional", :115) |

Note on L1–L4: the header of CONSTITUTION.md:3 still reads "DRAFT v0.1 — for founder review". Article VI §3 is marked ratified (:97). CLAUDE.md ranks the file first in precedence. I have recorded V.1 as RULED. Article V itself carries no separate ratification line.

Rules that derive from or sharpen V.1:

- **Access is free, consumption is metered.** "No person pays to *use* a BNR function". Physical resource use is metered: "Two transactions, two layers." Source: docs/dispatches/RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md:11. RULED.
- **Meter physical quantities and never fiat prices.** b amounts are "RESOURCE QUANTITIES (mesh-seconds, VRAM-byte-seconds, RAM bytes, chunk counts) — never as fiat-pegged prices." Source: same file, :23. RULED.
- **The MVP denominates in A, and b is finalized last.** Source: RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:15. The prototype uses A natively: "A carries every metered unit" (RULING_A_NATIVE_JUNGLE_FIRST_2026-08-22.md:5-6, :17). It runs on two tracks: "A flows on mainnet, b is forged on Jungle" (:59). RULED.
- **Self-heal test.** Every recommendation must answer "how does this autonomously SELF-HEAL and SCALE to 10 billion users for a thousand years?" (RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:18). Under this test, a design that needs a human in the loop for each event fails. RULED.
- **Jungle-first.** No BNR smart contract goes to mainnet until it is fully built and tested on Jungle, and then only on founder word (gate MX-7). Source: RULING_A_NATIVE_JUNGLE_FIRST_2026-08-22.md:22-24. RULED.
- **Operations sit behind a logged-in wallet; viewing stays open.** Anything that triggers server work, spends quota, writes state, crawls or pushes "sits behind a logged-in wallet" (RULING_WALLET_GATED_OPS_2026-08-20.md:42-44). The session is SIWE-shaped: "the address is the session". It is "not bzDiD" (:53-58). Per-address quotas are "the caller-pays doctrine (Article V.1 / hardline 8d) made mechanical" (:61-63). Fail closed: "no session → the op endpoint does not exist" (:64). Viewing stays open, and the doctrine is to dangle more of the art, not less (:46-48, :102-111). RULED.
- **bPay rail priority.** Native gas-dependent Layer-0 rails (BTC L1, ETH L1) are "last-line/fallback routes, not default UX". First-line routes are the ones that abstract gas: EVM/L2, LN, paymaster/sponsor patterns and b-meter mediation (docs/RULINGS-2026-09-16.md:73-87). The crosswalk extends V.1 into a UX-priority law. It also says "users never touch CPU/NET directly" (:89-94). RULED.
- **bPay only, one wallet.** Founder, 2026-09-26: "do not even think of using anything other than bpay". "ONE UI WALLET WITH EVERY DAMN ADAPTER … WORKING AUTONOMOUSLY". The rail, network, token and fee route are the machine's choices, never the person's. Source: memory founder-one-wallet-bpay-only.md:11, :17-18. RULED as founder word, with a caveat: the memory itself says "Not yet in the repo law book" (:20), and the name "bPay" is unratified (memory bpay-settle-adapter-lane.md:30).

## 2. The rails, and who pays for which resource today

### 2a. Rail map

| Rail | Pays for | Today's state | Citation | Class |
|---|---|---|---|---|
| **Vaulta A** (`core.vaulta`) | RAM (Bancor market), CPU/NET (stake or powerup/REX), MVP meter unit | Mainnet reads keyless. Contracts only on Jungle4 / local Spring. A has no faucet. The 2026-09-01 "A-paralysis" ended only after the founder's powerup gesture. | SPEC-VENDING-2.md:96-108; RULING_A_NATIVE…:51-56 | MEASURED (Jungle4 deploy receipts cited in spec) |
| **ANT** (Autonomi on Arbitrum One) | Storage, pay-once per chunk. Gas is ETH on Arbitrum. | `surfaces/ant-pay.js` is merged. The hosted signer (#396 → 283babc42, #400) signs with the bzDiD `evm:<soul>` key. Devnet loop paid 0.046875 tANT; mainnet acceptance is a separate lane. | memory ant-native-signer-converged.md:11-19; ant-devnet-acceptance-lane.md:12-14, :37 | MEASURED (devnet); mainnet press UNVERIFIED |
| **Arweave AR** | Permanence. Payloads under 256 KiB route to AR. | `adapter-arweave` ships a `MockArweaveClient` only (crates/adapter-arweave/src/lib.rs:13-16). The vending certificate was uploaded through Turbo at `winc: 0` (SPEC-VENDING-2.md:52-54). | | MEASURED (free-tier upload); adapter CLAIMED |
| **Hive** | Resource Credits (stake-derived; 5-day regen, about 20%/day). Onboarding has a treasury-side `delegate_rc`. | Dashboard tile spec only. | SPEC-RESOURCE-DASHBOARD-1.md:214-220; SPEC-BNROSE-ONBOARD.md:70-75 | CLAIMED |
| **Solana** | Native SOL transfer + intent memo | `settle-solana` is an "offline evaluation bench, not production bPay authorization". Every receipt says `authority_verified: false`. | crates/settle-solana/README.md:8-12, :93-96 | MEASURED offline (tests); live NONE |
| **Base / USDC** | Money in (PayPal/PYUSD door; Peer/zkp2p funnel); Spend Permission $1/24h | The funnel's receive path landed and reads keylessly. The bPay SETTLE kernel and Base adapter are on main (9fe11722f) but not wired into wallet.html. A live Base Sepolia run is founder-gated. | SPEC-PEER-FUNNEL-1.md:10-13, :92-94; memory bpay-settle-adapter-lane.md:11-35 | MEASURED (receive path); live settle UNVERIFIED |
| **exSat BTC (EVM, chainId 7200)** | Gas, through the CD-29 voucher paymaster | Spec only: "No implementation exists" | CD-29:2-3 | CLAIMED (draft spec) |
| **Zano** | `settlement.private`, multisig escrow | escrow-core is a pure state machine | CONSTITUTION.md:123; crates/escrow-core/src/lib.rs:1-7 | CLAIMED |
| **b** | Kernel-side "energy". "never an EVM token, never bridged, never gas". | Accounting scaffold only (§3). | crates/b-token/src/lib.rs:6-9, :22-23 | CLAIMED (scaffold) |

### 2b. Per resource, who pays today

- **Storage.** Payloads under 256 KiB go to AR and payloads of 256 KiB or more go to ANT. 256 KiB is "the operating threshold, not the naive crossover" (docs/storage-substrate-split.md:56, :83; BUZZ_A_METERING_SPEC.md:127). Status: MEASURED in the split doc. The payer is the user's own wallet. ANT pays once per chunk (about 0.085 ANT/chunk plus gas, "never $0", SPEC-VENDING-2.md:145-148). Status: CLAIMED (last reading). One live quote: 0.2145 ANT for 4,146 bytes on 2026-10-05 (memory ant-pay-phase-e-lane.md:46). Status: MEASURED. The Turbo free tier under 100–105 KiB is **"ArDrive's corporate subsidy, not a protocol guarantee"**. It is risk R3, and the plan is never priced at $0 (storage-substrate-split.md:314; SPEC-VENDING-2.md:10-12). Status: RULED (risk register language).
- **RAM.** Paid by whoever writes the row. Vending `mint` writes "under **the member's own auth and RAM**" (SPEC-VENDING-2.md:84). A Vaulta account is "~2,996 B of chain RAM … inherently O(n)". **"Free-tier users get no native Vaulta account."** (docs/bzdid-architecture-decision.md:61). Status: RULED (arithmetic). The paid-tier RAM deposit is quoted live from `rammarket` at claim time (:27, :388). There is no `.b` registration fee: "All five jobs a fee could do fail" (RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md:18). Status: RULED.
- **CPU/NET (Vaulta).** Two models exist: stake (capital locked, no ongoing fee) or rent through REX/powerup (ongoing fee, no capital) (SPEC-VENDING-1.md:107-116). Status: MEASURED at HEAD 2026-09-01. bmesh-meter models the powerup price curve (see §3).
- **Compute / mesh LLM.** The only live meter is the Python `scripts/buzz-meter/meter.py` on the box. The box was the OCI host, and its current state is UNVERIFIED (see gaps). Tier ladder (founder law): "FREE tier = the box/qwen compute lane (guest keys, no charge, capped fairly…); PAID tier = the Claude-agents lane (A-metered, cost basis + 10% tithe)". "free-tier receipts simply charge zero" (docs/dispatches/LANE_M_B_METER_2026-08-29.md:6). Status: RULED. The Claude lane is "CLOSED until the founder funds credits" (:33). Status: CLAIMED.
- **Bandwidth/egress.** Egress rates are "UNVERIFIED at every provider; never quoted to anyone" (gate MX-4, SPEC-BMESHASI-EXCHANGE-1.md:105). No meter exists.
- **Relay time (Buzz).** Not metered anywhere. B1 rule 2: "Buzz's own A pays for Buzz's own resources only — its relay, its epoch anchors." (BUZZ_A_METERING_SPEC.md:105). The dashboard tile spec calls the relay "T-P (hosted community relay = honest badge 'hosted, not sovereign')" and "the workspace's SPOF by design" (SPEC-RESOURCE-DASHBOARD-1.md:288-290). The relay host is Hostinger (memory handoff-2026-10-03-three-lanes-and-ant-review.md:17). Status: CLAIMED.
- **GPU rental.** Pre-paid. Budget "locked from the user's balance when the session starts" (SPEC-RESOURCE-DASHBOARD-1.md:282, :367). Status: CLAIMED (spec only).

### 2c. The self-funded mechanics (spec level)

- "Every spend debits the user's own balance on the target rail. The system never fronts cost, never holds an endowment for user spending, and never creates debt." Insufficient balance means a rejected spend. There is no cross-rail lending, and an automated bridge or borrow is never used. Source: SPEC-RESOURCE-DASHBOARD-1.md:363-367, :382. Status: CLAIMED (spec is "DRAFT for founder ratification", :3).
- B1 rules for Buzz metering. Each is testable:
  1. Every metered operation names the paying account, and that account is the USER's (BUZZ_A_METERING_SPEC.md:103-104).
  2. "One shared funder across per-user items is the breach" (:97).
  3. A negative-control test, where one Buzz-funded rail settles two users' operations, must FAIL (:107-108).
  4. "Zero balance is a REFUSAL, not a subsidy … Never a silent top-up, never a loan" (:109-112).
  5. An unfillable swap is refused, and slippage is never widened automatically (:122-127).

  Status: CLAIMED. The spec says its generalization of `epoch_funding` is "MY reading, not a ruling" (:169-172).
- Rail C issuance (RULED, RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md:8): issuance "does not front-load tokens". "Never assume depth. Never let a cycle fail closed on an unfillable swap." (:27-28). **Per-identity float is the wrong shape**: at 10^10 identities, one payment's worth of ANT each is about 9.8% of total ANT supply (:73-82). Status: CLAIMED (arithmetic), recorded as a ruled design constraint. Candidate reconciliation: "Front-load the GAS … Never front-load the RESOURCE TOKEN … EARNED, not issued". This is a "hypothesis awaiting founder word. No seat builds against either reading yet." (:93-100). Status: UNVERIFIED / open.

## 3. Metering and settlement primitives, by maturity

| Crate / file | What it is | Maturity | Citation |
|---|---|---|---|
| `bmesh-meter` | Utilization pricing for flow resources (CPU/NET powerup curve), mirroring `AntelopeIO/reference-contracts@c526479a…` powerup.cpp. Pure, time injected. "contains **no default parameter values**" (values are a founder gate). | Library. 17 `#[test]` (5 live-conformance, 7 negative, 5 property). "mutation-proven" per R-2 receipt (CLAIMED here). | crates/bmesh-meter/src/lib.rs:1-5, :9-23, :42-45 |
| `bmesh-ram` | Vaulta RAM market as a constant-product Bancor relay, bit-for-bit with the `double` source. Includes the `buyrambytes(4096)` → 4095-byte undershoot measured live 2026-08-22. | Library. 17 `#[test]` including Jungle conformance. | crates/bmesh-ram/src/lib.rs:1-36 |
| `bmesh-hwfit` | VRAM/hardware admission scoring for bMeshLLM. "a genuinely new build" (Buzz has no model selection). | Library | crates/bmesh-hwfit/src/lib.rs:1-9 |
| `bmesh-serve` | Demo stack (axum + sqlite journal + htmx/Alpine) journaling browser-read rammarket ticks at 127.0.0.1:8788 | Demo | crates/bmesh-serve/src/main.rs:1-14 |
| `wallet-relay` buzz.rs | `/v1/mesh/heartbeat`. `"node_id": "bnr-relay-vps"` and `"b_metered_tokens_this_epoch": 0` are both hardcoded. | Stub. "one heartbeat endpoint, one hardcoded node, 0 metered tokens". | crates/wallet-relay/src/buzz.rs:54, :67; SPEC-BMESHASI-EXCHANGE-1.md:41 |
| `wallet-relay` lib | "Never holds keys, never signs, never pays — the self-funded model end to end." | Phase-0 relay | crates/wallet-relay/src/lib.rs:5-6 |
| `voucher-escrow` | Rust conformance core of `voucher_escrow.py`. A-denominated in `Quatch` (1e-4 A). Hash-chained, refuse-before-write. "THE TITHE: 10% on top of cost basis, a DISTINCT line on every receipt." | 17 `#[test]`. It verifies the Oracle box's production ledger snapshot (6 events, 2026-08-29). | crates/voucher-escrow/src/lib.rs:1-20; fixtures/README.md:7-22 |
| `scripts/buzz-meter/` (meter.py, gate.js, voucher_escrow.py, x402_meter.py) | The live meter. Python closed enum adds `prefill_token`, `decode_token`. Per-key gate (401 without key). Chain-poll A credits; settlement is "INSTRUCTION ONLY — the meter never moves money". | Deployed 2026-08-29 on the OCI box (MEASURED then) | LANE_M_B_METER_2026-08-29.md:9-34; RECEIPT-LIVE-DEPLOY-ESCROW-2026-08-29.md:20-35; meter.py:56-58 |
| `shared-types` spend.rs | `SpendReceipt`. Closed `ResourceClass` enum: MeshSecond, VramByteSecond, RamByte, CpuMicrosecond, NetByte, ChunkCount, StorageByte, ChainFee. `Denom {B, A}`, "Never a fiat currency". | Types | crates/shared-types/src/spend.rs:62-80 |
| `escrow-core` / `escrow-engine` | Commerce escrow state machine (Created→…→Completed, timeouts) and its bus consumer. Pure. | 44+10 / 5 `#[test]` | crates/escrow-core/src/lib.rs:1-20; escrow-engine/src/lib.rs:1-8 |
| `watchpay` | OFFLINE Autonomi Merkle-payment plan, validation and ledger. Refuses evmlib's `Amount::MAX` approve and derives a ceiling instead. Deployment parity UNVERIFIED. | Offline slice | crates/watchpay/src/lib.rs:1-35 |
| `b-token` | `BLedger` (mint on `ResourceProof`, burn, transfer, reserve) and `RespectBook` (non-transferable; modulates the b unlock rate). `MintGate::Refuse` is the default. The only other gate is the dev `AcceptNonEmptyEvidence`. | Scaffold. **No real ResourceProof verifier exists.** | crates/b-token/src/lib.rs:1-23, :328-357 |
| `treasury-t0` | b as collateral, lock-and-burn, "no pool purse … so it cannot absorb cost". 20% function floor that cannot be collateralized. | Types + controls. "Live rails wait on counsel". | crates/treasury-t0/src/lib.rs:1-9, :30-32 |
| `denomination` | Two gauges (b function and money), never one ratio. "no ambient b/USD ticker". | Types | crates/denomination/src/lib.rs:9-15 |
| `bsigner` x402pay | Pre-signature gate: allowlist, pinned seller signature, expiry, per-signature cap, remaining budget, exact-multi split (seller + tithe). "signed, never submitted". "a budget or allowlist nobody stated is a refusal, not a guess". | CLI | crates/bsigner/src/main.rs:33-38; src/x402.rs:57-66, :92-93 |
| `settle-solana` | Offline Solana evaluation bench | Bench | README.md:8-12 |
| `chain-eos` | Hand-rolled SHIP binary codec (Phase 1). No pay function. | Reader | crates/chain-eos/src/lib.rs:1-8 |
| `adapter-autonomi` | `antctl` node telemetry → `NodeSnapshot`. Mock client over a pinned fixture. Live JSON keys UNVERIFIED. | Mock | crates/adapter-autonomi/src/lib.rs:1-32 |
| `adapter-arweave` | Event bundle Merkle root → Arweave anchor. Mock client. | Mock | crates/adapter-arweave/src/lib.rs:1-16 |
| `surfaces/ant-pay.js` | Coordinator. "never holds an EVM key". Approve is for "the EXACT quoted total, never unlimited". Tx hashes persisted before finalize. Envelope checked by code that did not sign it. | Merged (#190, #396, #400) | surfaces/ant-pay.js:1-22 |
| CD-29 paymaster | Kernel-signed, voucher-gated BTC gas sponsorship. b is debited kernel-side, and b never crosses the seam (S-1…S-6). | DRAFT v0.3.1, "No implementation exists" | CD-29:2-3, :352-371 |
| Vending `vending` contract | `rates` (basis per call in A, governed by founder word) and `tithe` (1000 bp). Jungle4 deploy at `bnrapolltest`. | MEASURED on Jungle4; mainnet = founder ceremony | SPEC-VENDING-2.md:77-111 |
| ZK receipt aggregates | PLONK count proof over private receipts, verified on Jungle4 (~10.6–12.1 ms CPU). Claims may state counts, sums or bounds only. | Leak + scale tungsten gates OPEN | SPEC-ZK-RECEIPT-AGGREGATES-1.md:18-23, :96-99, :121-124 |

**Receipt and observability law (RULED 2026-10-06).** User-facing state "MUST be a deterministic derivation of receipts the system already banked". A light shows green only when the receipt that proves it exists. Source: SPEC-RECEIPT-OBSERVABILITY-1.md:3-4, :11-22. The rule is mapped forward to bPay/bMeter and to x0x/bMESHasi as `capability granted → route created → exercise observed → revoked` (:128-131).

## 4. What is ruled about fees and subsidies

- **The tithe.** 10% on top of provider cost basis, in A, "a distinct TITHE line on every receipt, never buried in the rate". The percentage changes "by founder word alone". Sources: LANE_M_B_METER_2026-08-29.md:5; vending `tithe` 1000 bp → kingbeelovis (SPEC-VENDING-2.md:81, :90-91); x402 rule "rate table = cost basis + tithe field … not a margin" (SPEC-VENDING-1.md:130-132); the Peer funnel tithe rides as a referral entry to the founder-filed address (SPEC-PEER-FUNNEL-1.md:51-65). Status: RULED.
- **"The tithe is the business."** "ANT farming is participation, NOT revenue". Network-wide node income is about $10/day (node income = uploader spend). Re-opening this is barred. Source: SPEC-VENDING-1.md:55-66. RULED. The $10/day figure is the estate's own measurement, CLAIMED here.
- **No fee on `.b`.** Bounding is a per-bDiD name cap (RULINGS_SUCCESSION_RAILS_NOFEE_2026-08-08.md:17-19). RULED.
- **IRON FIRST waterfall.** Meter revenue reimburses VPS, hardware and bandwidth "before anything else is paid". The order is law, and ratios sit behind MX-1 (SPEC-BMESHASI-EXCHANGE-1.md:74-77). RULED (founder order).
- **Paymaster degradation law.** T0 (user's own key, own gas) "MUST ship working". "Deleting the paymaster is a supported operation." "No feature is T2-only." Sources: CD-29:226-233, :284-290. CLAIMED (draft), and it directly applies V.1.
- **Sponsorship pool source is open.** CD-29 Q-4 asks who funds the pool. It is "CD-4-gated and not this spec's to invent" (CD-29:1546-1551). OPEN.
- **b is never sold.** On onboarding: "BNR is never in the flow of funds"; b is "granted by the treasury on completion, not sold" (docs/RULINGS-2026-07-26.md:49-56). The flow has no BNR-owned receiving addresses (SPEC-BNROSE-ONBOARD.md:74-75). bSAFE exclusion: "a paymaster that sells b for USDC is a token sale through a side door" (feature-backlog.md:277-285). RULED.
- **Two-loop law.** The money loop and the metabolic loop "never touch". b's utility is "the **service layer** … never the commodity layer" (feature-backlog.md:287-296). RULED (founder direction 2026-07-06). The B1 derivation "A pays for the COMMODITY layer. It never pays for the SERVICE layer." keeps b off the metering path (BUZZ_A_METERING_SPEC.md:73-83). CLAIMED derivation. The Q-2 / MX-2 founder gate stays OPEN (CD-29:1522-1535; SPEC-BMESHASI-EXCHANGE-1.md:103).
- **Lite accounts.** "Lite accounts carry identity and attribution, never value." Value requires graduation to the user's own keys (RULINGS-2026-07-26.md:10-18). RULED.

## 5. Autonomy and grant rules

- **2026-08-29 autonomy ruling.** It is cited through supersession pointers; I found no standalone file. The SOVEREIGN/SUPERVISED axis is "RETIRED". Agents run "fully autonomous". Spend caps are "the owner's **optional tool** (the $1/24h Spend Permission pattern), never a condition of agency". Source: RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md:5-12. RULED.
- **Agents self-fund from resources they earned under their bDiD.** Source: same file, :17, :27-29. RULED. Amendment: only "**Autonomi/ANT** is a verified permissionless contribute-to-earn rail; Vaulta/A has none" (:45-47). Attenuation uses ERC-7710 plus enforcers. ERC-7715 is human-gated, "do not use it" (:42-45). RULED (amendment).
- **Autonomi seam.** A finite ERC-20 allowance enforced by the token contract plus a remote KMS signer. "HARD FENCE: never engage the merkle path (≥64 chunks) — it grants INFINITE allowance." Source: RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md:38-43. RULED. Note: `watchpay` later derives a bounded ceiling for the merkle path instead of MAX (crates/watchpay/src/lib.rs:27-35). That is a scope change for the design to reconcile, not a lift of the fence.
- **Explicit grant** (founder order 2026-10-11): "Autonomy means an explicit grant: purpose, operations, resources, recipients, duration and limits. An unlocked keychain, an old invoice or a copied ceiling is not a grant." Cross-device budgets need real enforcement. Source: memory sovereign-operating-environment-order.md:21. RULED (founder order, memory-recorded). Same order: 10B users needs a declared workload model, about 115,741 ops/s at 1 op/user/day (:23). "bSigner … signs authorization artifacts and never submits" (:18).
- **No invented gas authorization** (founder 2026-10-11): "Cite the applicable grant for this probe rather than promoting a remembered number into permission." If no grant exists, the limit is the key holder's own entry. Never pre-fill it. Within a valid grant, act without asking again. Source: memory no-invented-gas-authorization.md:11-18. RULED.
- **Caps are signer-authoritative** (founder ruling 2026-08-11). "A keyless relay can be replaced, so a cap only it enforces is not a cap." Source: SPEC-RESOURCE-DASHBOARD-1.md:297-299. RULED (cited in a draft spec).
- **Keychain isolation.** The keychain lives at keys.skaists.dev with its own passkey RP. It signs only Autonomi storage payments (≤100 ANT, value 0, Arbitrum). "Grants in place of per-payment presses" is a NEXT phase, not built. Source: memory keychain-isolation-lane.md:11-13, :28-37. RULED (origin), CLAIMED (scope).
- **No agent key custody.** "no agent holds/requests/transmits private key material" stands. An upload wallet is a narrow exception "the founder will write himself" (memory ant-pay-phase-e-lane.md:25-28). RULED.

## 6. FREE tier: what the sources say about a user with no on-chain account

Identity costs nothing:
- A bzDiD genesis writes "zero" bytes to any blockchain at "zero" cost to BNR. The user can receive on every key-based chain (bzdid-architecture-decision.md:58-59).
- "No authoritative store must exist for a free identity to work." Free-tier DA is $0 because the payer verifies the log locally (:390).

Consumption by a free user is covered today only by:
- (a) the zero-charge, capped FREE compute tier on estate iron (LANE_M:6); and
- (b) the visitor's own browser calling public RPCs with "their IP, their rate limits" (RULING_WALLET_GATED_OPS:104-107).

A wallet session needs only a key, not an account (:53-58).

What the sources say about paying by contributing device resources:
1. Agents "earn credit / value / resources by **contributing resources**": Autonomi nodes earn ANT, Buzz/meshLLM nodes "provide RAM, earn b" (RULING_BDID_HIERARCHY…:17). RULED. Bounded by the amendment: only ANT is a verified permissionless earn rail (:45-47).
2. b is "Minted on a ResourceProof", which is "evidence that a real resource contribution occurred". The gate refuses every proof by default, and real verification is "adapter work" (crates/b-token/src/lib.rs:7, :328-375). CLAIMED, not built.
3. "new users earn their first b … earning-through-use is the onboarding feature" (feature-backlog.md:281-283). RULED direction. A welcome grant is a separate meta-tier decision that is Sybil-exposed (:283-285).
4. bMeshAsi providers "pledge iron" and consumers book vRAM, CPU-node, mirror-hosting or bandwidth. A mesh, registry, dispatch and live settlement "Does NOT exist" (SPEC-BMESHASI-EXCHANGE-1.md:45-58).
5. Rail C hypothesis: "The resource token is EARNED, not issued". It awaits founder word (RULING_RAIL_C…:93-100). UNVERIFIED.
6. Hive RC is stake-derived and regenerates. The treasury can `delegate_rc` at onboarding (SPEC-BNROSE-ONBOARD.md:70-73). CLAIMED.
7. x0x default Leaf runs with "NO --relay". Relay contribution is opt-in (docs/specs/SPEC-X0X-622-CAPTURE-1.md:144). CLAIMED (spec of a measurement runner).

No source rules a mechanism that converts a free user's device contribution into credit for Buzz resources. See gaps.

## 7. Collisions to ESCALATE (not resolved here)

1. **Free compute tier vs V.1.** LANE_M:6 gives the FREE tier at no charge on estate iron. CONSTITUTION.md:83 limits standing costs to bootstrap seeds and spec maintenance. B1 §3 rule 4 says "Zero balance is a REFUSAL, not a subsidy" (BUZZ_A_METERING_SPEC.md:109). The free tier is founder law (2026-08-29) and postdates B1 (2026-08-10).
2. **b spend boundary vs two-loop law.** RULING_B_SPEND_BOUNDARY:6 says b is spent "ONLY where the function CONSUMES PHYSICAL RESOURCES". feature-backlog.md:294-296 says b's utility is "never the commodity layer". The workaround is A-first (BUZZ_A_METERING:73-83). Q-2 / MX-2 is still OPEN (CD-29:1522; BMESHASI:103).
3. **Tithe on the paid lane vs "A never pays for the SERVICE layer".** The 10% tithe in A is a charge above commodity basis (LANE_M:5). B1 says metering access, a seat or a tier prices the service layer (BUZZ_A_METERING:75-78). B1 is a derivation and LANE_M is founder law.
4. **Token-count units vs physical units.** The Python meter's enum adds `prefill_token` / `decode_token` "by this lane's founder dispatch" (LANE_M:10; meter.py:56-58). The Rust closed `ResourceClass` lacks them (spend.rs:62-71). B1 says an inference meters as "`VramByteSecond` + `CpuMicrosecond` + `NetByte` — NOT as 'one inference'" (BUZZ_A_METERING:49-50).
5. **Paid-balance allowlist vs free access.** bClaude answers only "founder + pubkeys bound to PAID keys with balance > 0" (LANE_M:32). RULING_B_SPEND_BOUNDARY:11 says "No person pays to *use* a BNR function".
6. **wallet-relay role.** The dashboard spec says it "Implements bSigner … keystore access. Enforces spend caps" (SPEC-RESOURCE-DASHBOARD-1.md:405). The same spec at §6.1, and the crate, say keyless and advisory: "Never holds keys, never signs, never pays" (crates/wallet-relay/src/lib.rs:5-6). bsigner is now its own crate (crates/bsigner/src/main.rs:1-8).
7. **Funnel vs no-BNR-receiving-address.** The Peer funnel and tithe make the estate a USDC recipient (SPEC-PEER-FUNNEL-1.md:10-13). SPEC-BNROSE-ONBOARD.md:74-75 says "no receiving addresses owned by BNR anywhere in the flow". That rule is scoped to onboarding. A Buzz pay flow must state which scope it is in.
8. **Merkle path.** The "never engage the merkle path" fence (RULINGS_TESTNET_A_MVP_CUSTODY:42) and watchpay's bounded-merkle derivation (watchpay lib.rs:27-35) need one reading.
9. **Per-identity float at 10^10.** It fails on arithmetic on any rail (RAIL_C:78-82). A "funded wallet at genesis" (KISS) versus no front-load is still a founder question (:88-100).

## 8. Gaps

- No relay-time, bandwidth or egress meter exists. Relay cost is paid by the estate ("Buzz's own A"). MX-4 egress rates are UNVERIFIED.
- No ResourceProof verifier exists, so no device-contribution → credit path. The mesh, registry, dispatch and settlement do not exist (BMESHASI:45-49). `b_metered_tokens_this_epoch` is hardcoded 0.
- MX-1 curve values, MX-3 voucher identity, MX-5 wallet-gate merge point and MX-6 external onboarding are all OPEN founder gates (BMESHASI:102-107). CD-29 Q-2, Q-3, Q-4, Q-5 and Q-7 are OPEN. Sybil resistance is "the drain defence, and it is not in this document" (CD-29:1553-1558).
- Live state of the meter box is UNVERIFIED. The production voucher ledger and meter were on the OCI box 129.153.202.144, which was "dark from every outside vantage point" on 2026-10-03 (memory handoff-2026-10-03…:17).
- No PQ signature exists on any payment rail. Every pay rail signs with ed25519 or secp256k1. bsigner `bpq-attest-nostr` only *vouches* for a Nostr event that "Buzz and every relay still check by its secp256k1 Schnorr signature" (bsigner main.rs:54-56).
- Cross-device budget enforcement does not exist. "R7: everything is browser-local" (memory ant-native-signer-converged.md:26). Grants that replace per-payment presses are unbuilt (keychain-isolation-lane.md:37).
- A Base Spend Permission ($1/24h) exists for one agent wallet. No per-user Buzz grant object is specced.
- Autonomi node emissions were paused on 2026-01-20, which makes the per-write cost uncertain (UNVERIFIED, SPEC-RESOURCE-DASHBOARD-1.md:390). "Whether any BNR surface has live b rails today" is UNVERIFIED (:393).
- The paid-but-incomplete upload recovery case is OPEN, owned by the BNRoSe Rust lane (memory ant-devnet-acceptance-lane.md:37).
- The b supply law ("420 per soul, lifetime") appears in CD-29 as register item U-11, UNVERIFIED (CD-29:1499). SPEC-ORIGINATION-1.md:103 states a per-bzDiD 420 cap.
