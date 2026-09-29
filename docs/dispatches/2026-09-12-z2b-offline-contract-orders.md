# Z2.A second review and Z2.B offline contract orders

Codex (Astra), 2026-09-12. Reviewed corrected audit `b9867fc2`.
The retractions on Suite MCP, Luna attribution, release identity, the broken
JavaScript reference and in-process recovery resolve the first review's
central factual objections. Independently checked evmlib v0.9.1's
`external_signer.rs` and `IPaymentVaultV2.sol`: the keyless helper exists,
its approval default is `Amount::MAX`, and the corrected event ABI matches.
This is **not acceptance of section 5 as a finished payment contract**.

## Remaining corrections incorporated into the build order

1. **Cost bound is wrong.** The inspected `PaymentVaultV2.sol` computes
   `median16(selected_pool.candidates.amount) * (1 << depth)`. It requires
   `2^ceil(depth/2)` pools. With depth 12 and every candidate amount 1, the
   audit's sum of all candidates is 64 * 16 = 1,024; the charge is 4,096.
   Derive the amount/ceiling from the actual pinned selection and pricing
   rules with overflow checks. Do not use an unlimited approval. This source
   describes a local Anvil contract; do not equate it with a verified mainnet
   deployment. Pin the corresponding SDK bindings and flag deployment parity
   separately.
2. **Fee and value constraints are incomplete.** Gas units are not a native
   currency fee cap. Validate transaction value (zero for these contract
   calls), gas limit, fee-per-gas fields and cumulative worst-case native fee,
   including approval/replacement policy. Reject unsupported transaction
   types. Canonical hashes do not establish quote authenticity by themselves.
3. **Receipts must identify the actual batch.** Equal depth/timestamp and an
   amount below a ceiling are insufficient. Bind the receipt to the expected
   transaction hash and decoded transaction calldata, payer, chain, contract
   and ordered commitments. Validate the winner against the pinned selection
   rule and that plan's pools. Reject a different batch with the same
   depth/timestamp. RPC responses remain externally supplied evidence, not
   independent cryptographic proof of chain finality.
4. **Signing lifecycle:** a signed transaction hash is unavailable before
   signing. Persist intent/attempt identity and nonce first; then validated
   signed transaction/hash before any future broadcast; then reconcile the
   outcome. Define crash points explicitly. Unknown never automatically
   re-signs. An atomic rename alone is not a cross-platform durability proof.
5. **Scope conflict:** section 7 says no broadcast/upload, then Order C asks
   for both on a devnet. Order C is deferred. This build has no RPC, device,
   wallet, signing or broadcast actions. Wave is rejected as unsupported for
   this first Merkle-only slice rather than implementing another payment path.
6. **Attribution remains partly incorrect:** `b9867fc2` adds the seat trailer
   but still has the founder as committer. Do not call that the complete T3
   shape. The next commit must use founder author, seat committer and parsed
   seat trailer; no rewrite of either historical commit.

Source references:
- https://github.com/WithAutonomi/evmlib/blob/v0.9.1/src/external_signer.rs
- https://github.com/WithAutonomi/evmlib/blob/v0.9.1/contracts/IPaymentVaultV2.sol
- https://github.com/WithAutonomi/evmlib/blob/v0.9.1/contracts/PaymentVaultV2.sol

## Paste-ready order

```text
START FRESH SESSION: z2.b — GLM 5.3 MAX.
Build a bounded OFFLINE Merkle payment-contract slice for the SKAISTS
companion, using this review as an override of z2.a section 5/7.

Read these files without changing their owners' worktrees:
C:\Users\travi\wt-z2a-trezor-audit\docs\dispatches\2026-09-12-z2a-watch-autonomi-trezor-audit.md
C:\Users\travi\wt-zcode-watch-jams-plur\docs\dispatches\2026-09-12-z2b-offline-contract-orders.md

Create your own worktree wt-z2b-watchpay and codex/z2b-watchpay branch from
a recorded current origin/main pin. Read the repository instructions.
Use a non-production module under crates/watchpay (adapt to the existing
workspace conventions). Do not edit Watch-It, bantfarm, ops/ant-extsig,
the admission gate, or another seat's worktree.

Implement pure validation/composition and a local state model:
- Bounded, versioned Merkle-only plan; strict integer/field validation,
  deterministic canonical encoding and hashes; chain/payer/contracts bound;
  no private DataMaps, capabilities or file content. Reject Wave.
- Pin SDK/ABI source and dependency versions. Use upstream keyless encoding
  primitives where available; no copy of member-pay.mjs. Derive exact or
  conservative bounded approval from verified pricing, never Amount::MAX.
  Include the depth-12 unit-price counterexample from this review.
- Validate decoded transaction value, chain, payer, destination, calldata,
  nonce policy, token ceiling and native fee ceilings before acceptance.
- Strict receipt-to-transaction-to-batch binding; no fallback hashes. Test
  wrong batch with identical depth/time, wrong winner, wrong contract,
  missing/duplicate events, reverted receipt and altered transaction.
- Persist intent, signed-result record and outcome as distinct states using
  synthetic data only. Crash/fault tests must state precisely what survives;
  unknown outcomes never automatically create a new signing attempt. Do not
  claim upload process-death recovery from this ledger.

Tests are synthetic/offline. Compare calldata with pinned upstream helper
vectors and record their generator. Add overflow, expiry (including payment
timestamp), tampering, nonzero native value, excessive fees, cancellation,
and interrupted-state tests. Specify RPC/chain evidence assumptions clearly.
Do NOT execute z2.a Order C; devnet rehearsal is a later reviewed slice.

No device/Suite/Connect calls, wallet access, signing, broadcast, uploads,
production changes, install or upstream PR. Downloading public dependencies
for the build is fine. Keep deployment and admission gates disabled.

Commit with founder author, zCode committer and parsed zCode coauthor
trailer. Push your branch; never force. Return a pinned dispatch, actual
test counts, limitations, and the exact proposed next slice for review.
```

Review validation: source inspection plus git metadata inspection; no
payment code was executed and no device was accessed. This order authorizes
an offline implementation candidate, not a live integration or payment.
