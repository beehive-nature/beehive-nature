# bPay SETTLE: one settlement contract, any chain

`intent → bounded authority → adapter → chain → a receipt rebuilt from the chain`

The kernel is [`scripts/lib/bpay-settle.mjs`](../../scripts/lib/bpay-settle.mjs). It is chain-neutral and pure: no clock, no network, no files. It sits between two pieces of existing law and adds the SETTLEMENT stage between them:

- INVOICE-1 ([`bpay-invoice-generic.mjs`](../../scripts/lib/bpay-invoice-generic.mjs)) supplies the invoice and the canonical bytes.
- RECON-1 ([`recon-reconcile.mjs`](../../scripts/lib/recon-reconcile.mjs)) decides SATISFIED, or anything else, from VOCAB-1 evidence records.

The ruled seven stages are carried in every receipt: QUOTE → PRICING COMMITMENT → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION.

## The eight verbs

The verbs are shaped after Coinbase Mesh, so a Mesh implementation can sit under an adapter unchanged. BNR's own law sits above them.

| verb | Mesh analogue | what the kernel holds the adapter to |
|---|---|---|
| `network()` | `/network/list`, `/network/options` | CAIP-2 id, assets keyed by CAIP-19, submit model, evidence ceiling. Owner authority is refused. The descriptor's hash is bound into the authority, so an adapter changed mid-flight cannot settle |
| `balance()` | `/account/balance` | base units, exact |
| `prepare()` | `/construction/preprocess` + `metadata` | keyed by the intent digest (idempotency) |
| `payloads()` | `/construction/payloads` | must move exactly what the invoice owes, to exactly the authority's recipient, within its native-fee bound |
| `combine()` | `/construction/combine` + `hash` | shell-submits only. The signed bytes are persisted before submit |
| `submit()` | `/construction/submit` | returns a ref, never a terminal state |
| `status()` | `/block/transaction` | kept as the vendor's or the rail's own word. It never closes anything |
| `reconcile()` | none | an independent read that returns VOCAB-1 records. The vendor's own endpoint is refused as a value witness |

What Mesh does not have is carried in the hash-committed intent:

- the invoice commitment
- bounded authority, which is `settlement.execute`, single-use, and never owner privilege
- the quote and its expiry
- the user-asset maximum and the native-fee maximum
- privacy requirements, from a closed list; a route that cannot meet one is refused before anything is signed
- the proof commitment
- the refund policy
- the bMeter evidence reference

The receipt then adds its own hash and the reconciliation state.

## Adapters

| adapter | rail | submit model | what it reuses |
|---|---|---|---|
| [`adapters/smart-account-usdc.mjs`](adapters/smart-account-usdc.mjs) | Base / Base Sepolia, USDC | wallet-submits | the Base Account SDK (`@base-org/account` 2.5.13), injected and never imported. Route **pay** is a person present, using `pay()` with telemetry off and the intent bound as the attribution suffix. Route **spend-permission** is an agent acting as the permission's spender, never an owner |
| [`adapters/solana-devnet.mjs`](adapters/solana-devnet.mjs) | Solana devnet, SOL | shell-submits | `crates/settle-solana` on the native carrier (child process, JSON on stdio). The Rust bench composes the transaction, verifies the signature and reconciles. The adapter only maps the verbs |

[`evm.mjs`](evm.mjs) is the shared independent reader.

- Two RPC operators must return the same receipt, field for field, for the top evidence class. That covers the block, the sender, the gas and every log. The calldata must match on both, and finality counts only if every agreeing operator reports it.
- A single operator is reported one class lower and is never final.
- A transfer counts only if its sender acted in that transaction: through its own successful user operation, or as the transaction sender. Two such senders paying the same recipient go to a person to sort out.
- Fees come from the chain. A paymaster-sponsored user operation costs the payer 0.

## TUNGSTEN: COINBASE SETTLEMENT ROUTE

[`tungsten.mjs`](tungsten.mjs) runs the eight steps and checks five kill conditions. The verdict is computed from observations. As in the doxx harness, a failed control yields INCONCLUSIVE, never FAIL and never PASS.

| kill condition | how it is observed |
|---|---|
| 1. unrestricted authority | spend route: `isOwnerAddress(spender)` is read on chain before any money moves and must be false. pay route: the payer's `nextOwnerIndex` is read before and after and must not change. An index that cannot be read is INCONCLUSIVE, never a pass. In both, any owner change, upgrade, cross-chain replay, ERC-20 `approve` or EIP-7702 call is refused before it reaches a signer |
| 2. unbounded cap | spend route: the grant must equal the request field by field, including a period covering the whole window so the cap cannot refill. The calls must be exactly `[approve,] spend, transfer`. After approval the permission must read as valid, and an `eth_call` of `spend(allowance + 1)` must revert on every operator with the contract's own `ExceededSpendPermission` error. No money moves. pay route: the chain shows exactly the approved amount |
| 3. vendor assertion as sole proof | value evidence comes from the harness's own reader, with two operators at `event-log+readback`. The vendor list is the caller's, not the adapter's. The vendor's status is compared three ways and can only disagree |
| 4. receipt not recreatable | a fresh adapter and reader, given only the intent and the tx hash, must rebuild identical evidence |
| 5. vendor identifiers in the kernel | the caller's term list is scanned over the intent and the receipt. Only `adapter_local` may name the vendor |

The honest fake passes with limitations, and those limitations are stated from source:

- On the spend route the recipient is bound by BNR's allowlist, not by the contract. `spend()` pays the spender, who then forwards the funds.
- The spend-permission helpers send telemetry, and there is no switch to turn it off.
- On the pay route the cap is the person's approval of that one payment, not a standing limit.

Controls run before anything is paid. The adapter must read through the harness's own reader, every operator must be up and on the right chain, and the token must read. If any control fails, nothing settles and the verdict is INCONCLUSIVE. The owner and cap probes are the harness's own chain reads, never questions put to the adapter, and they count only values every operator returned identically.

At settle time the kernel does three things:

- It rebuilds the intent from the invoice and the adapter, and rechecks both expiries.
- It refuses a second settlement under the same authority, even through a freshly built intent. The outbox claim is put-if-absent, so two concurrent runs pay once.
- It refuses an authority whose hash is not the signed one. The signing itself belongs to the signed-authorization lane — wired: [`bsigner-authority.mjs`](bsigner-authority.mjs), the bSigner organ signing the domain-separated authority bytes (ML-DSA, `bheart.signature/1` envelope) and the organ's own verification gating `settle()` before any adapter verb. Payload signing stays the rail vault's job; ML-DSA authorizes, the chain's own curves transact.

Receipt digests are unkeyed. A forger who recomputes them is caught by re-reading the chain (`rebuiltRecords`) or by an anchor (`expectedDigest`).

Each kill condition has a sabotage test that makes it go red. `node prove.mjs` disables each of 36 guards in turn, and the suite fails every time.

## Differential against our rails

| capability | Coinbase / Base | x0x | ANT | Vaulta | Hive | AR | pick |
|---|---|---|---|---|---|---|---|
| a person pays, one press | `pay()`: USDC, gas sponsored, in a vendor-hosted window | none (transport) | `ant-pay.js` pays storage only | the wallet's own key, through the outbox | own-key transfer, RC-funded | none | own key first; this route only as the last resort (founder rule 2026-10-05) |
| an agent spends within a bound | Spend Permission: cap + expiry on chain; recipient not on chain | none | none | permission linking scopes an action; a cap needs a contract (not built) | none | none | spend-permission for EVM, with BNR's allowlist holding the recipient |
| proof of payment | public RPC read, two operators | none | none | block readback (`wallet-adapter-vaulta.js` confirm) | its own RPC, not yet wired to RECON-1 | permanent anchor for a receipt digest (not wired) | `evm.mjs` + RECON-1; anchor the receipt digest on AR next |
| privacy | needs a vendor account; SDK telemetry is on by default (off for `pay()` here) | private transport | private storage | public account | public account | public | declared per adapter, enforced at intent build |

## Running it

- `node --test bpay-settle.test.mjs` runs 53 tests against the fake chain (CI static job).
- `node prove.mjs` runs the mutation proof (CI static job).
- `SETTLE_SOLANA_BIN=target/debug/settle-solana node --test solana-native.test.mjs` runs 7 tests against the real binary (CI test job, after the workspace build).
- `SETTLE_BSIGNER_BIN=target/debug/bsigner node --test bsigner-nerve.test.mjs` runs 7 tests of the signed-authorization nerve against the real organ (CI test job, after the workspace build).
- A live run on Base Sepolia needs two founder steps: a Base Account passkey, and test USDC in it. Nothing in this directory moves money on its own.
