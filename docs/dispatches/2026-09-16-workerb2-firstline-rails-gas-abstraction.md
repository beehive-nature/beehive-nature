# WORKERB2 — bPay first-line rails: gas abstraction on EVM/L2 + LN · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"bPay rail priority
update: Bitcoin L1 and Ethereum L1 native-gas routes are last-line/fallback,
not first-line UX. Preserve the BTC research already banked, but stop
expanding BTC-L1 work. Next mission: investigate first-line payment
rails/patterns — EVM/L2 and LN — specifically how bPay can abstract native
gas from the human while preserving self-custody, privacy, bounded authority,
and replaceable settlement adapters. Reuse existing open code before
inventing. No integration yet."*
**Mode:** research/reuse review; no integration, no implementation.
**Baseline:** origin/main `ed099888` — recorded AFTER the concurrent
reconciliation-gate landing (Astra dispositions; see §1 for what that rules
onto this mission). All external claims carry this-session sources; BTC-L1
depth intentionally frozen (prior dispatches stand as banked).

> **Correction to prior framing (founder, this session):** licensing is NOT
> a Beehive architecture gate — the cw_bitcoin dispatch's "license wall"
> wording is corrected here. The technical findings of that dispatch stand
> as findings (the sp_scanner architecture, the PDK session model); any
> adoption-time licensing work is a solved-later concern, never a verdict.

---

## 1. Standing constraints this mission respects (from `ed099888` + `ee334c17`, FACT)

- **R5 (founder ruling, banked verbatim in `docs/RULINGS-2026-09-16.md` @ee334c17):**
  native L0 gas-dependent rails (BTC L1, ETH L1) are **last-line/fallback,
  not default UX**; EVM/L2-style, LN, and gas-abstracting routes are
  first-line; BTC/BIP-352 + ETH-L1 stay replaceable adapters; bPay is never
  designed around them. The ladder below is the R5-shaped map — this
  mission's order and the law now say the same thing.
- **"bPay" is a PROPOSAL, unratified** — this dispatch researches the
  proposed pay layer's first-line shape; nothing here ratifies the name or
  the layer.
- **R4 (now law): no wallet-global identifier linking multirail legs** —
  every rail map below must compose per-leg identities. This is a genuine
  design constraint on "one bPay identity": there must NOT be one.
- **D2: corpus-code MINE** (failure/retry ceilings, Payment/Delivery split,
  fixtures — as relevant, no wholesale mirror) — the intent-shaped patterns
  below are where that mine applies.
- BTC-L1 frozen per this mission's own order.

## 2. The deliverable: the gas-abstraction ladder (ADAPT-shaped map)

Five tiers, ordered by how far the native asset is from the human. The
proposed first line is tiers 1–3; native-gas wallets are the last line.

| tier | pattern | what the human does | native gas? | self-custody |
|---|---|---|---|---|
| 4 | Chaumian ecash (Fedimint/Cashu) | holds blinded tokens | none | **custodial** (federated vs single-mint) — WATCH only |
| 3 | LN channels + offers | pays from pre-funded channel | invisible (rides channel fees) | keys ours (LDK/Alby Hub) |
| 2 | sponsored execution: 4337 paymaster / EIP-7702 delegate | signs an intent/op | paid by sponsor under a budget | EOA/Smart-account ours |
| 1 | **signed-authorization intents** (x402 / EIP-2612-3004 permits) | signs a message | **settler-side**, never the payer's | keys ours, sign-only |
| 0 | native-gas execution (watchpay-class discipline) | holds + spends ETH/BTC for gas | yes | keys ours |

**The estate already lives at tiers 1–3 for machines and tiers 3/0 for
humans.** Tier 1 is literally our Jungle4 law (vending + x402 meter live;
`bsigner/src/x402.rs` exact-multi invariants; 37-proof CI battery). Tier 2
has our own spec on the shelf (CD-29). Tier 3 runs today (Alby Hub, NWC
1000 sat/day cap). The mission's question — "abstract gas from the human
while preserving self-custody, privacy, bounded authority, replaceable
adapters" — is answered by *promoting tiers 1–2 to the human-first line*
and keeping tier 0 as fallback, NOT by new invention.

## 3. Rail findings, 2026-pinned (FACTs with sources)

### 3.1 x402 — the first-line machine rail, now multi-chain + Rust-native

- **V2 of the standard** launched: "the SDK handles chain selection,
  facilitator discovery, payment routing, and scheme selection" — moving to
  multi-chain ([x402 V2 launch](https://x402.org/x402-v2-launch/));
  expansions beyond EVM already exist (e.g. a
  [TRON x402 crate](https://lib.rs/crates/x402-chain-tron) with TIP-712
  signing).
- **Open Rust implementation exists**: the
  [x402-rs](https://x402.rs/) family — crates covering "server middleware,
  client automation, facilitator, and multi-chain support"
  ([crates.io](https://crates.io/crates/x402-rs),
  [GitHub](https://github.com/x402-rs/x402-rs)) supporting protocol v1+v2
  on EIP-155 chains. **This is the reuse-before-invent unit for bPay's
  first line: our Rust core + a self-hosted facilitator on the box**
  (nodes-on-the-box law) instead of any hosted dependency.
- **Payer-side no-gas confirmed:** settlement gas is a facilitator concern —
  Coinbase's managed [CDP facilitator](https://docs.cdp.coinbase.com/x402/seller/facilitator)
  "handles signature validation, blockchain interaction, transaction
  screening, and settlement gas management." The payer signs; the settle
  side pays gas. Our Jungle4 meter laws already bound exactly this shape.
- **Estate anchors:** vending/x402 meter LIVE (`RECEIPT_VENDING_X402_METER`),
  x402 five-law port (`docs/raids/X402-SORT-2026-09-01.md`), engine-parity
  CI gate. **Verdict: ADAPT (x402-rs as the crate seam, self-hosted
  facilitator; CDP docs as hosted reference only).**

### 3.2 EIP-7702 — the bridge that upgrades our existing EOAs without new custody

- **Live since Pectra and broadly adopted by 2026:** ethereum.org carries
  the canonical [7702 guidelines](https://ethereum.org/roadmap/pectra/7702/);
  MetaMask's delegator contract is
  [live on mainnet](https://etherscan.io/address/0x63c0c19a282a1b52b07dd5a65b58948a07dae32b)
  (as of Sep 2026); curated delegation-target inventory exists
  ([awesome-eip-7702-delegations](https://github.com/Arvolear/awesome-eip-7702-delegations)
  — MetaMask smart account, Ambire, ERC-4337 shapes).
- **Why it fits bPay precisely:** 7702 "upgrades an existing EOA with smart
  account capabilities (**batched transactions, gas sponsorship, and spend
  permissions**) while keeping the same address"
  ([Coinbase docs](https://docs.cdp.coinbase.com/wallets/using-wallets/eip-7702)) —
  that triple is exactly our bounded-authority vocabulary: spend
  permissions are the capAssert/Spend-Permissions law already governing
  agent allowances (WALLET-LEDGER), and our bzDiD Base EOAs are 7702-shaped
  by construction (delegation is per-transaction, revocable, address-stable).
- **Verdict: ADAPT the pattern (delegate → bounded-authority module; sponsor
  → paymaster/budget), WRAP a vetted delegation target rather than
  authoring one — and read targets against CD-29's predicates before any
  choice. No integration now.**

### 3.3 ERC-4337 paymasters + CD-29 — our own spec, now with an external ecosystem to dock to

- CD-29 (draft v0.3.1, spec-only) is a **resource paymaster** with
  reserve-then-settle predicates (P-14/P-15) and founder-class gates: Q-2
  (the two-loop / b-for-gas question) and U-7 (exSat bundler validation
  rules — "if U-7 does not clear, the sponsored path does not deploy").
- **The tested in-estate cousin already exists: watchpay's fee-budget
  ledger** (merged `28116f4a`) — per-attempt `reserved_fee_wei`,
  reservations reconcile DOWN only with receipt evidence, intent refused
  when plan-wide reservations exceed the ceiling. CD-29 §6.2.1's
  "a pure read is not a cap" is the same law watchpay already executes in
  tests. When CD-29 unblocks, its implementation has a proven semantic
  template in-tree.
- **The tier-2 gas question Q-2 poses partially dissolves at tier 1:** with
  permit/x402-shaped intents, stablecoin payment and fee live in the same
  signed object and settlement gas is facilitator-side — no cross-loop
  treasury payment is needed for the FIRST line. The two-loop question
  remains live only for sponsored tier-2 execution.
  (INFERENCE from the pattern shapes; Q-2 stays a founder question.)
- **Verdict: HOLD (spec-only, gated as it says); dock to the 7702/x402
  findings above when it opens.**

### 3.4 LN — already our human-first live rail; LDK Node is the open engine if we ever embed

- **LDK Node** — "ready-to-go, self-custodial Lightning node library built
  with LDK and BDK in Rust, designed for easy embedding into wallets"
  ([docs.rs](https://docs.rs/ldk-node/*/ldk_node/)) — has become "a
  foundation for mobile wallet integrations, providing C bindings and
  built-in LSP support" ([State of Lightning 2026](https://www.spark.money/research/lightning-network-2026-state)).
  BOLT-12 offers need onion-message-capable peers
  ([btrust tutorial](https://blog.btrust.tech/getting-started-with-ldk-node-building-a-lightning-node-in-rust/));
  the offer/async-payments/splicing roadmap is active
  ([LDK blog](https://lightningdevkit.org/blog/), bolt12.org).
- **Estate fit:** our nodes-on-the-box law puts channels on the box (Alby
  Hub LIVE with a 1000 sat/day NWC cap) and the human's device is a window
  — LDK Node would matter only if a device-resident LN lane is ever ruled
  (same posture as the PlainWallet-embed WATCH on Zano).
- **Privacy note:** offers' blinded paths remain the strongest
  receiver-privacy shape in any tier here — already receipted in our
  corpus. **Verdict: WRAP what we run (NWC/Hub); WATCH LDK Node.**

### 3.5 Ecash — the zero-gas UX with a custody price (WATCH only)

- 2026 framing: ecash is Lightning's "last-mile" answer
  ([Bitcoin 2026 panel](https://www.youtube.com/watch?v=4iwEBvEByA4));
  Cashu = single-mint custody ("can rug 100% unilaterally"), Fedimint =
  federated threshold custody across guardians
  ([comparison](https://www.spark.money/tools/lightning-vs-fedimint-comparison),
  [D-Central](https://d-central.tech/bitcoin-ecash-comparison/)).
- **Estate tension, named once:** Fedimint's guardian model is
  bounded-authority-shaped (threshold, multi-party) — but guardians
  operate OTHER people's pooled custody, which meets the wallet-ceremony
  constitution ("nobody operates someone else's wallet") head-on. Running
  or joining a federation is a founder-class custody ruling, not an
  architecture choice. **Verdict: WATCH; no lane chartered.**

## 4. The four mission properties, per tier (the compliance matrix)

- **Self-custody:** tiers 0–3 keep keys ours (tier 2 keeps the EOA address,
  delegation revocable per-tx); tier 4 trades it away by construction.
- **Privacy:** permit/x402 signatures become public at settlement (payer
  address visible to the settle side — bounded by R4's per-leg identity
  law, no wallet-global linking); paymasters see the ops they sponsor
  (sponsorship = a surveillance surface — CD-29 already treats sponsor
  policy as governed); LN blinded paths strongest for receivers; ecash
  strongest for payers, at the custody price.
- **Bounded authority:** tier 1 = the signed amount IS the bound (meter
  laws); tier 2 = spend permissions / CD-29 predicates / watchpay-style
  reservations; tier 3 = NWC/day caps (live); tier 4 = federation threshold
  (but over pooled custody).
- **Replaceable adapters:** every first-line rail has an open, self-hostable
  implementation — x402-rs (facilitator on the box), 7702 targets (vetted,
  swappable delegates), CD-29 (ours), LDK/Alby (ours, self-hosted). No
  first-line pattern requires a hosted third party; hosted references
  (CDP facilitator) are documentation, not dependencies.

## 5. Open questions for the founder (no action implied)

1. Ratify the ladder? (Tier 1/2 first-line, tier 0 fallback — as PROPOSAL
   refinement toward the unratified bPay name.)
2. Does Q-2 stay open given the tier-1 dissolution argument (§3.3), or is
   the two-loop question now scoped to sponsored execution only?
3. Any interest in a self-hosted x402 facilitator design note for the box
   (bounded by the meter/tithe laws) as the first concrete tier-1 reuse
   step — research-only, when wanted?

## Source ledger (this session, 2026-09-16)

[x402.rs](https://x402.rs/) · [crates.io/x402-rs](https://crates.io/crates/x402-rs) ·
[github/x402-rs](https://github.com/x402-rs/x402-rs) ·
[x402 V2 launch](https://x402.org/x402-v2-launch/) ·
[CDP facilitator docs](https://docs.cdp.coinbase.com/x402/seller/facilitator) ·
[x402-chain-tron](https://lib.rs/crates/x402-chain-tron) ·
[ethereum.org 7702](https://ethereum.org/roadmap/pectra/7702/) ·
[Coinbase EIP-7702 docs](https://docs.cdp.coinbase.com/wallets/using-wallets/eip-7702) ·
[awesome-7702-delegations](https://github.com/Arvolear/awesome-eip-7702-delegations) ·
[MetaMask delegator on Etherscan](https://etherscan.io/address/0x63c0c19a282a1b52b07dd5a65b58948a07dae32b) ·
[docs.rs ldk-node](https://docs.rs/ldk-node/*/ldk_node/) ·
[btrust LDK Node tutorial](https://blog.btrust.tech/getting-started-with-ldk-node-building-a-lightning-node-in-rust/) ·
[State of Lightning 2026](https://www.spark.money/research/lightning-network-2026-state) ·
[LDK blog](https://lightningdevkit.org/blog/) ·
[Spark: LN vs Fedimint](https://www.spark.money/tools/lightning-vs-fedimint-comparison) ·
[D-Central ecash comparison](https://d-central.tech/bitcoin-ecash-comparison/)
— plus in-tree at `ed099888`: `docs/CD-29-resource-paymaster-spec.md`,
`docs/RULINGS-2026-09-16.md`, vending/x402 receipts, `crates/watchpay`
(fee-reservation ledger), WALLET-LEDGER, prior Workerb2 dispatches.

**No integration, no code changed, no chains touched. Research only.**
