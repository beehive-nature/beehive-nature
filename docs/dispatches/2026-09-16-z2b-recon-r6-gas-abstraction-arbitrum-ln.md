# Z2.B recon round 6 — gas abstraction vs our model, Arbitrum L1 fees RESOLVED, LN mapped to the rail interface

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Prioritize gas
abstraction: ERC-4337 bundler/paymaster, EIP-7702, and L2-native
sponsorship against our self-hosted/replaceable adapter model. Then
resolve Arbitrum L1-data fee composition against watchpay's existing
fee ceilings. Then map LN against the same bPay rail interface. Reuse
first; identify the smallest missing pieces. No implementation yet."
BTC research stays banked (rail-order ruling).

## Probe 1 — gas abstraction vs the self-hosted / replaceable-adapter model

**ERC-4337** (ethereum.org + docs.erc4337.io + eth-infinitism pins):
UserOperation → alt-mempool → bundler → EntryPoint `handleOps`;
paymasters sponsor gas; explicitly positioned against "centralized
relayer-based solutions" via "a permissionless mempool and bundler
ecosystem". Mapped to our law:
- **EntryPoint**: on-chain singleton (v0.8 at
  0x4337084d9e255ff0702461cf8895ce9e3b5ff108 on most EVM networks) —
  trustless contract, no third party. ✓ first-party by construction.
- **Bundler**: a RELAY, and self-hostable — the reference
  implementation lives at eth-infinitism/bundler (linked from the
  contracts repo; GPL-3.0 ecosystem). **Box-resident bundler = the
  first-party posture** (nodes-on-the-box law). Third-party bundlers =
  the Cake-server trust class → optional adapter only.
- **Paymaster**: holds deposits on EntryPoint, signs sponsorships, and
  LEARNS user intent/operation contents — the self-hosted shape is
  "sponsor yourself": a box-resident paymaster funded from the estate's
  own treasury delivers the gasless UX with no third party. Third-party
  paymasters = optional adapter (never required — same ruling class as
  hosted scanning).
- **Licensing note**: reference contracts/bundler are GPL-3.0 — under
  our one-door law, cited-and-pinned, never vendored into the AGPL
  kernel without a licensing pass; interfaces (EntryPoint ABI,
  UserOperation shape) are facts, not code.

**EIP-7702** (eips.ethereum.org, status Final; shipped in Pectra per
ethereum.org, May 7 2025): type-4 transactions carrying authorization
tuples `[chain_id, address, nonce, y_parity, r, s]`; a delegation
indicator `0xef0100 || address` is written to the EOA's code; calls
then execute the referenced code in the EOA's context. Batching +
sponsorship + privilege de-escalation; "forward-compatible" with 4337
(a 7702-delegated EOA can run ERC-4337 wallet code —
`Simple7702Account` exists in the reference repo). **Mapped to our
law**: signing a 7702 authorization GRANTS A CONTRACT UNRESTRICTED
ACCESS TO THE EOA (their own words) — that is a CUSTODY-CLASS action,
not a routine payment. It must ride a ceremony: bounded delegate
allowlists, explicit founder/organ approval, and the EIP's stated
pitfalls carried as validator requirements (sign over nonce/value/gas/
target/calldata; init front-running via ecrecover; tx-origin invariant
breakage). The organ question (does the Trezor sign 7702
authorizations, and with what review surface) is queued for the
hardware-signing lane.

**L2-native sponsorship** (e.g. Base's smart-wallet paymaster API):
NOT source-pinned this round — same class as third-party paymasters
(optional adapter, never required); queued for a one-fetch pin if a
sponsorship model is ever evaluated concretely.

**Smallest missing piece (gas abstraction):** not infrastructure — a
**fee-descriptor type** on the rail interface: `{class: L2-gas |
L1-folded-gas | LN-routing-msat | channel-op-L1, worst_case, units}`,
so every rail expresses its fee shape in one vocabulary and the
watchpay ceiling laws bind per class. watchpay's envelope is already
the L2-gas member of this family.

## Probe 2 — Arbitrum L1-data fee composition: RESOLVED, watchpay ceilings HOLD

docs.arbitrum.io/how-arbitrum-works/gas-fees (own words): "The total
fee charged to a transaction is the child chain basefee multiplied by
the sum of the child chain gas used and the parent chain calldata
charge" — the L1 posting cost is divided by the child-chain basefee
"to convert the fee into child chain gas units" (the "poster fee"),
receipts carry `gasUsedForL1` (L1 charge in child-gas units), and
`eth_estimateGas` "returns a value sufficient to cover the full
transaction fee". Tips are ignored ("Nitro ignores this field and
never collects any tips" — first-come-first-served sequencer).

**Verdict against watchpay (the flagged assumption resolves TRUE with
one caveat):** the L1 component is GAS-FOLDED, so a single
`gas_used × effective_gas_price` product (≤ `gas_limit ×
max_fee_per_gas`) bounds TOTAL native spend — watchpay's per-tx and
cumulative ceiling math holds on Arbitrum with no separate L1 term,
and our fee-evidence validation shape (gas_used × price) is exactly
what Arbitrum receipts report. The caveat (the smallest missing
piece): `per_tx_gas_limit` must include L1 headroom — an underfunded
gas limit REVERTS (their words: fails on insufficient gas) rather
than overcharging, which is fail-closed in the right direction, but a
plan composed with mainnet-sized gas limits would revert on Arbitrum.
Dispatch as a one-line doc note + a per-chain L1-headroom hint in the
plan envelope — no code this round.

## Probe 3 — LN mapped against the bPay rail interface (checklist re-anchored)

| checklist item (R2) | LN shape | delta |
|---|---|---|
| addresses | invoices (BOLT11) / offers (BOLT12 — parked in our lightning lane) / LNURL | no static address; identity = node pubkey + per-payment invoice |
| balance | local/remote CHANNEL balances (liquidity model) | balance is reservation-shaped, not account-shaped — maps to escrow-core-style state, not a scalar |
| history | payment records (pay_index) | not chain txs; same trait surface |
| node | peer/channel management (LND gRPC / Alby Hub API) | channel OPEN/CLOSE are BTC-L1 txs — **the first-line rail rides the last-line rail for liquidity ops** (watchpay-style ceilings apply to those L1 legs) |
| sync status | channel reconnect + gossip | event-bus push maps cleanly |
| fees | routing fees (msat, probe-able) | trivial unit abstraction; channel ops → L1 fees → fee-descriptor class |
| send | pay invoice; in-flight HTLC = PendingTransaction | HTLC timeout/resolution maps to our abort/unknown-state laws (ledger unknown-state semantics were built for exactly this shape) |
| custody | **requires an ONLINE signing node** | THE finding below |

**The custody finding:** LN payment flow needs fast online HTLC
signing — the Trezor compose→validate→external-sign rhythm does NOT
map to payment flow. But the nodes-on-the-box law maps exactly: **the
box IS the always-online LN node**, so LN custody is "box-resident key
under ceremony + spending-cap laws" (estate precedents: box-resident
members; the PAY-panel spend-cap lane). Watchtowers (delegated
monitoring) are third-party → optional adapter, never required — the
same ruling class as hosted scanning and third-party paymasters.
**Reuse verdict:** do not reimplement LN — the rail wraps the
LIVE Alby Hub (lightning lane) behind the trait; smallest missing
pieces are (a) the box-resident LN signing policy (caps/ceremonies —
largely existing law to be restated for LN), (b) the fee-descriptor
above, (c) invoice/offer lifecycle types in the satellite contracts.

## Scoreboard

First-line rails now have: a gas-abstraction trust map (4337 =
self-host bundler + sponsor-yourself paymaster; 7702 = custody-class
ceremony; third-party sponsors = optional adapters), a RESOLVED
Arbitrum fee composition (watchpay ceilings hold; L1 headroom note),
and an LN↔checklist mapping with the custody tension named and the
box-law resolution identified. No implementation; BTC proposals stay
parked.

## Sources

- https://docs.arbitrum.io/how-arbitrum-works/gas-fees
- https://ethereum.org/en/roadmap/account-abstraction/ (+ 4337 stats,
  Pectra/7702 ship date)
- https://docs.erc4337.io/ (architecture; GPL-3.0 aa-mkdocs)
- https://eips.ethereum.org/EIPS/eip-7702 (Final; type-4; risks)
- https://github.com/eth-infinitism/account-abstraction (EntryPoint
  v0.8 address, Simple7702Account, GPL-3.0; links the self-hostable
  eth-infinitism/bundler)
- Estate: watchpay fee/budget laws (this lane R0–R3); lightning-lane
  memory (Alby Hub LIVE, BOLT-12 parked); spend-cap lane; R2 rail
  checklist (a5c454fa's predecessor dispatch).
