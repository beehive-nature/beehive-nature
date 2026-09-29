# WORKERB2 — x402-rs V2 deep-read + the box facilitator adapter DESIGN · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"Deep-read `x402-rs` V2
as the leading bPay first-line implementation candidate. Map its payer
authorization, facilitator, settlement, replay protection, chain selection,
and failure semantics directly against our ratified bPay boundaries and
watchpay reserve→settle machinery. Then design—not implement—the smallest
self-hosted facilitator adapter that can run on our box while remaining
replaceable. Keep EIP-7702 and LN parallel first-line routes, not
dependencies of x402. Native-gas rails remain fallback. Do not return Q-2 to
the founder unless an actual unresolved human choice survives the
code-level comparison."*
**Mode:** source deep-read + engineering design. **No implementation.**
**Baseline:** origin/main `9792170e` (recorded after fetch; concurrent
GLOSSARY-BRIDGE landing classified docs-only, zero overlap).

**Source pin:** `x402-rs/x402-rs@main` — pushed 2026-07-13, 290★,
Apache-2.0, workspace v**2.0.2**, edition 2024, rust 1.93. Crates:
`x402-types` (proto/facilitator/scheme), `x402-axum` (layer + paygate +
facilitator_client), `x402-reqwest` (client),
**`x402-facilitator-local`** (self-hosted facilitator with `/verify`,
`/settle`, `/supported` handlers), chain crates under `crates/chains/`:
**eip155, solana, aptos, tron** (TRON at 0.2, others 2.0).

---

## 1. The six-axis map (FACT from source, vs our machinery)

| axis | x402-rs V2 (at source) | our ratified boundary / machinery | verdict |
|---|---|---|---|
| **payer authorization** | three schemes per chain, swappable: **EIP-2612 permit** (with `eip2612_gas_sponsoring.rs`), **EIP-3009** (`transferWithAuthorization`), **Permit2** behind x402 proxy contracts (`X402ExactPermit2Proxy`, `X402UptoPermit2Proxy`); **ERC-6492/1271 validation** (`Validator6492.json`) for smart-account signers | watchpay's sealed `ValidatedPlan` + plan-bound `SignRequest`; adapter-ring (no direct third-party endpoints); R5 first-line | **ADAPT** — scheme handlers are exactly our replaceable-settlement-adapter shape; 6492 means **7702-delegated EOAs can pay through the same door later with zero facilitator change** (routes compose at the payer side — parallel, not dependent, per mission order) |
| **facilitator** | `Facilitator` trait: `verify` / `settle` / `supported`, generic over a `FacilitatorContract` (wire types injectable, test doubles named); `FacilitatorLocal` routes by **chain-id + scheme slug** through a `SchemeRegistry` built from `chain_registry + scheme_blueprints + config` | our trait-fronted, fail-closed seams (`ConnectTransport` with no impl; `ChainBackend`/adapter-ring) | **ADOPT the seam verbatim** — the registry/trait split is the replaceability mechanism R5 asks for |
| **settlement** | scheme handlers execute on-chain; **`pending_nonce_manager.rs`** manages the facilitator's own tx nonces; settle response carries tx evidence | watchpay: durable intent→signed→outcome, `record_signed_at_attempt`, crash points C1–C4, tx-hash recorded | **ADAPT** — the nonce manager solves the facilitator-side multi-inflight problem; outcome binding stays ours (journal, §2) |
| **replay protection** | EIP-3009: authorization `nonce` + `validAfter`/`validBefore` window (checked at verify, **consumed on-chain by the token contract** — the contract is the ledger of record); Permit2: its own replay domain | watchpay: fee evidence refuses impossible records; expiry blocks new signing never discards evidence; `validUntil` MUST be finite (CD-29 P-12 kinship) | **ADAPT + add our journal** — on-chain nonce consumption is sound; the door adds idempotent-settle journaling keyed by auth nonce (§2) |
| **chain selection** | V2 `PaymentRequirements{scheme, chain…}`; chain crates registered in `networks.rs`; facilitator answers `supported` from the registry | R5: chains are replaceable adapters; Base live, ETH-L1 fallback | **ADAPT** — data-driven registry; Base-first config |
| **failure semantics** | typed `PaymentVerificationError` taxonomy (incl. `UnsupportedScheme`); settle distinguishes outcomes incl. insufficient funds; **the `upto` scheme's settle response "includes the actual settled amount, which may be less than the authorized maximum"** — amount fixed AT SETTLEMENT under a signed max | watchpay: reservations reconcile DOWN only with receipt evidence; no-evidence failures free nothing; Unknown never auto-re-signs; vending `upto` ceilings law | **DIRECT KINSHIP — the headline mapping.** x402-rs `upto` ≡ vending `upto` ceiling ≡ watchpay approve-ceiling-vs-actual. The reserve→settle semantics we already execute in tests are the semantics this scheme needs at the facilitator |

**Q-2 DISPOSITION (per mission order, resolved at code level — no founder
return needed):** the two-loop question (may the settlement treasury pay
gas cross-domain?) does not arise in the smallest adapter, because the
facilitator's settlement gas is paid by a **box ops wallet** — an
operations budget under its own cap, the same already-ruled class as the
watch WIF and the NWC 1000-sat/day allowance — never by the vending/meter
settlement loop. No b-for-gas path exists in this design. The only
surviving human gesture is routine ops funding (founder floats the wallet,
sets the cap) — the standard funding ritual, not an architectural choice.
**Q-2 therefore does not block; recorded as resolved-in-shape, scoped to
this adapter.**

## 2. DESIGN (PROPOSAL, spec-grade, awaiting founder chartering) — "x402 door": the smallest self-hosted facilitator adapter

**Shape.** One Rust service on the box, in the `ops/` family (the
`live-door`/`meter.py serve`/`bindexer` lineage), wrapping
`x402-facilitator-local` + `x402-chain-eip155`, behind a Caddy same-origin
door at `relay.skaists.dev/x402/*` (ant-door precedent; POST-passing;
iptables per-port law; rate-limited — the estate's first consumer for the
DoS-budget note, archaeology §I5). The surface speaks exactly `/verify`,
`/settle`, `/supported` (+GET schema info, as x402-rs ships). Nothing
first-party is forked: we CONFIGURE the registry, we don't modify the
crates.

**Start configuration (replaceable by data, not code):**
- chains: **Base only** (8453) via `networks.rs` registry;
- schemes: **`eip3009` exact** (native USDC on Base carries EIP-3009) +
  **`upto`** for metered/usage-priced resources (the watch-room
  pause-not-kill meter shape gains an EVM twin);
- settlement wallet: dedicated **ops wallet**, founder-floated ETH float,
  root-owned key file 600 (watch-WIF precedent), **daily gas cap +
  low-water alert + fail-closed stop** — when the wallet cannot fund a
  settlement, `/verify` refuses new reservations (never accept-then-stuck).

**The reserve→settle journal (our layer on the stateless verify):**
- `/verify` = x402-rs scheme validation (signature, 3009 window + balance,
  requirements match) **+ reservation write**: keyed by authorization
  nonce → {payer (per-leg), chain, scheme, authorized max (upto) / amount
  (exact), resource, validBefore, reserved_gas_est}. Journal laws reused
  verbatim from watchpay's ledger: exclusive-writer OS file lock across
  read/check/write; torn file fails closed; version-pinned records.
- `/settle` = scheme execution via the nonce manager **+ evidence-gated
  reconciliation**: reservation reconciles to the ACTUAL settled amount
  (≤ authorized, upto) only with tx-hash receipt evidence; failures keep
  the reservation until evidence or `validBefore` expiry (no free without
  evidence); stuck settlements enter an **Unknown state that never
  auto-retries** — HumanGate only (watchpay law). Idempotency: same
  authorization nonce → same journal row, never double-settle; the
  on-chain 3009 nonce remains the replay ledger of record, the journal is
  ours for budget, idempotency, and audit.
- **Daily budget law**: sum of reserved_gas_est under open reservations +
  settled-today actuals ≤ daily cap, else refuse new verifies (watchpay's
  plan-wide reservation refusal, applied to gas).

**R4 compliance (per-leg identity, stated as law in the design):** the
journal keys payer addresses per chain; **logs and journal MUST NOT join
payer identifiers across chains or legs** — no wallet-global correlation
surface. The door knows nothing else about the payer.

**Replaceability (R5):** every swap point is registry-shaped — chain
(networks config), scheme (blueprints), facilitator implementation (the
`Facilitator` trait — a hosted facilitator can replace ours behind the
same door for A/B without surface change), settlement wallet. LN and
7702 stay parallel first-line routes: LN settles through its own live
NWC/Hub path; 7702-delegated payers reach this door through the existing
6492 validation without any dependency in either direction.

**Acceptance contract (test-shaped, for the future implementation
mission — none written now):**
1. verify-refuses when wallet float < settlement floor (fail-closed);
2. upto settlement reconciles reservation to actual ≤ authorized, with
   receipt evidence required (no-evidence failure keeps reservation);
3. same auth nonce settles exactly once (idempotent journal + on-chain
   nonce agreement);
4. expired `validBefore` never settles; reservation released at expiry
   with no budget freed to a NEW reservation without evidence of
   non-settlement (timeout + on-chain check);
5. journal torn-file fails closed (loader refuses);
6. no cross-chain payer correlation in any log line (CI-greppable);
7. door swap: pointing the surface at a second facilitator
   implementation changes zero surface code;
8. daily-cap refusal names the cap and current exposure.

**Explicitly NOT in the smallest adapter:** no 4337 bundling, no LN
interaction, no token swaps, no TRON/Solana/Aptos chains, no
`eip2612_gas_sponsoring` (2612 needs the sponsor path CD-29 governs —
deferred there), no surface-side changes to any estate page (the door is
server-side only; first consumer wiring is a later, separately-chartered
mission).

## 3. Source ledger (read this session, 2026-09-16, at `x402-rs/x402-rs@main`)

Workspace `Cargo.toml` (members, v2.0.2, Apache-2.0); tree listings;
`crates/x402-types/src/facilitator.rs` (trait + contract, full);
`crates/x402-facilitator-local/src/{facilitator_local.rs,handlers.rs}`
(full / routing / routes); `crates/x402-types/src/proto/v2.rs`
(requirements/payload/extensions); `crates/chains/x402-chain-eip155/src/
v2_eip155_upto/types.rs` (upto semantics); ABI inventory
(IEIP3009/IERC20Permit/Permit2 proxies/Validator6492) from tree paths.
In-tree at `9792170e`: `crates/watchpay` (reserve→settle ledger laws),
`docs/RULINGS-2026-09-16.md` (R1–R5), `docs/GLOSSARY-BRIDGE.md`,
vending/x402 receipts, `ops/` door precedents, WALLET-LEDGER (NWC cap,
watch WIF).

**No implementation, no code changed, no chains touched. Deep-read +
design only; Q-2 resolved in shape and not returned.**
