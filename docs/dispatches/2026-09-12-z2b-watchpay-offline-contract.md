# Z2.B — watchpay: the offline Merkle payment-contract slice (receipt)

Seat z2.b (GLM 5.3 MAX / zCode), 2026-09-12. Order:
`wt-zcode-watch-jams-plur/docs/dispatches/2026-09-12-z2b-offline-contract-orders.md`
(Codex/Astra second review), superseding z2.a §5/§7 implementation orders.
This slice is **offline contract + negative tests only**: no RPC, no
device/Suite/Connect, no wallet access, no signing, no broadcast, no
uploads, no production edits, no install, no upstream PR. Nothing outside
`crates/watchpay/`, the workspace member list, and `Cargo.lock` changed.

## Landed

- Worktree `../wt-z2b-watchpay`, branch `codex/z2b-watchpay`, pinned at
  origin/main `8d42da28` (eco-adaptor-sweep head at start).
- **`crates/watchpay`** (non-production module; 11 source modules +
  `dev/gen-parity-vectors` + 4 integration-test files):
  - `types` — strict canonical value types (`EthAddr` lowercase-hex 20B,
    `Hex32` 32B, `Atto` canonical-decimal u256, string-only in JSON).
  - `abi` — pinned signatures; selectors/topics COMPUTED from the pinned
    signature strings (no hand-pasted literals); constants
    `MAX_MERKLE_DEPTH=12`, `CANDIDATES_PER_POOL=16`,
    `MERKLE_PAYMENT_EXPIRATION_SECS=604800` (7 days, client-side law,
    evmlib v0.9.1 `merkle_tree.rs:28`).
  - `plan_model` / `plan` — the versioned bounded Merkle-only envelope
    (`watch-pay-plan/1`), `deny_unknown_fields` everywhere (the
    structural no-private-material law; a smuggled `data_map` field is a
    tested refusal). Declared figures must EQUAL derived figures:
    batch ceiling, `batch_id`, `approve_ceiling_total`, gas/native-fee
    coverage, `plan_hash`. Wave arm refused. Expiry includes the batch
    payment timestamp (future OR older than 7 days refused). job_id
    charset-enforced (doubles as ledger directory name; traversal
    refused at both boundaries).
  - `pricing` — the pinned rules: `expected_reward_pools=2^ceil(d/2)`,
    `median16` (sorted-index-8 upper median) with a LITERAL port of the
    Solidity quickselect cross-checked on adversarial arrays,
    `charge=median16(winner)<<depth` overflow-checked.
  - `canonical` — deterministic binary encoding; `batch_id` binds chain,
    vault, depth, timestamp AND ordered commitments; `plan_hash` over the
    whole envelope.
  - `calldata` — keyless composition for `payForMerkleTree` /
    `approve` / `getCompletedMerklePayment` + strict `MerklePaymentMade`
    decoding (topic count, 96-byte data, canonical padding enforced).
  - `tx` — decoded-transaction validation: legacy + EIP-1559 only
    (types 1/3/4/unknown fail closed), chain/payer/destination/nonce/
    gas/fees/value(=0)/calldata byte-identity, zero-hash refused
    ("hash unavailable before signing").
  - `receipt` — strict receipt→recorded-tx→batch binding; exactly one
    vault-emitted `MerklePaymentMade`; winner must be one of THIS
    batch's pools; `totalAmount` must equal the pricing-rule recompute;
    `PaymentAlreadyExists(bytes32)` revert classification; NO tx-hash
    fallback anywhere (structurally impossible — the winner only ever
    comes from the decoded event).
  - `ledger` — durable attempts (`intent → signed → mined|reverted`,
    `unknown`, `cancelled`), fsync-before-rename (+Unix dir fsync;
    Windows journaling caveat documented, not claimed proven),
    fail-closed on torn/corrupt files (named), duplicate tx-hash refusal
    plan-wide, Mined = permanent double-pay fence, **Unknown never
    auto-re-signs** (human-gated `resolve_unknown`/`abandon_unknown`;
    the signed tx rides inside the Unknown record). Upload
    process-death recovery explicitly NOT claimed.
- **Tests: 55 passed / 0 failed** (lib 14, ledger_lifecycle 11,
  parity_calldata 3, plan_validation 14, receipt_binding 13; doc-tests 0).
  Clippy clean; `scripts/secret-scan.sh tree` clean; every 48+ hex run
  carries a same-line PUBLIC-CONSTANT marker.

## The review's six corrections — how each is answered

1. **Cost bound.** Ceiling derivation = `max over pools of
   median16<<depth` from the plan's own commitments, overflow-checked —
   never a candidate sum, never `Amount::MAX` (refused by law at plan,
   composer, and tx-validation layers). The depth-12 unit counterexample
   is a pinned regression: 64 pools × 16 × 1 → candidate sum 1024,
   per-pool charge 4096; declaring 1024 is refused naming both figures.
   Deployment parity flagged below.
2. **Fee/value constraints.** `NativeFeeCeilings` (fee-per-gas u64-bounded,
   priority ≤ total, cumulative worst-case native fee = gas×fee×tx-count
   re-derived and declared totals must cover it); tx value must be zero;
   unsupported tx types refused; legacy priority-field refused; per-field
   ceilings at tx validation.
3. **Receipt binding.** Bound to expected tx hash, decoded calldata,
   payer, chain, contract, and the ordered commitments (batch_id);
   wrong-batch-same-depth/timestamp is a tested refusal; winner validated
   against the plan's pools and `totalAmount` against the pinned pricing
   rule; RPC-evidence assumptions stated in the module docs (externally
   supplied, not proof of finality; confirmations recorded as reported).
4. **Signing lifecycle.** Intent(+nonce) persisted before any sign; signed
   record validated before persistence; outcomes reconciled after; crash
   points C1–C4 defined with executable what-survives tests; torn files
   fail closed; Unknown requires an explicit `HumanGate`.
5. **Scope.** No broadcast/upload anywhere (Order C NOT executed). Wave
   rejected, not implemented.
6. **Attribution.** This commit: founder author, zCode committer, parsed
   `Co-authored-by: zCode` trailer (+DCO sign-off). No history rewritten.

## Receipts

- Parity vectors generated OFFLINE by the REAL
  `evmlib::external_signer::pay_for_merkle_tree_calldata`
  (evmlib `=0.9.1` from crates.io, feature `external-signer`); generator
  checked in at `crates/watchpay/dev/gen-parity-vectors/` with its run
  receipt; `tests/parity_calldata.rs` asserts byte-equality for depth-1
  and depth-2 batches. The same run receipted **E7 live**: the helper's
  `approve_amount` = 2^256-1 (`Amount::MAX`), asserted as a pinned fact
  and refused by this crate.
- Upstream pins read 2026-09-12: WithAutonomi/evmlib tag `v0.9.1` —
  `contracts/{IPaymentVaultV2,PaymentVaultV2,MerklePaymentLib,Types}.sol`,
  `abi/IPaymentVault.json`, `src/external_signer.rs`,
  `src/merkle_payments/merkle_tree.rs`,
  `src/merkle_batch_payment.rs`.

## New findings at the pin (for review)

- **`selectWinnerPool` entropy is stronger than the audit's E7 wording**:
  the seed is `keccak256(prevrandao ‖ block.timestamp ‖ sender ‖
  payment_timestamp)` (MerklePaymentLib.sol) — `msg.sender` alone is NOT
  the entropy. Consequence: the exact charge is unknowable at plan time
  even with the payer pinned; the max-over-pools ceiling is not just
  conservative, it is the ONLY derivable bound (and receipt-time
  recompute is exact). Nothing to fix; recorded because both prior
  documents understate it.
- **MAX_MERKLE_DEPTH discrepancy**: contract `PaymentVaultV2.sol` says 12;
  evmlib v0.9.1's Rust `merkle_batch_payment.rs` says 8. The module
  enforces the contract bound (12) and refuses depth 0 (division by
  `depth` in the contract body).
- **evmlib's helper encodes unlawful shapes**: it happily emits depth-1
  calldata with one pool (contract requires 2); our composer refuses.
- **`external_signer` is feature-gated** in evmlib 0.9.1
  (`features = ["external-signer"]`).

## Limitations (honest list)

- `PaymentVaultV2.sol` is a local-Anvil shape ("no proxy, no Ownable" in
  its own comment); no verified mainnet deployment inspected — deployment
  parity UNVERIFIED, flagged for review.
- evmlib is NOT a dependency of the workspace build (vectors are pinned
  artifacts + recorded generator; `dev/` is a standalone root). The
  direct-evmlib-dep vs ant-protocol-re-export question stays OPEN for
  the review to decide.
- tx_hash is recorded, not re-derived (needs the signed serialization —
  later slice). Signature verification is out of scope by order.
- Reverted-receipt classification reads optional revert data (from an
  eth_call/trace re-run), documented as NOT part of
  eth_getTransactionReceipt.
- Windows ledger durability: content fsync + rename; directory-entry
  fsync unavailable via std — documented, not claimed proven.
- No upload-process-death recovery exists or is claimed (z2.a E4 stands).

## Proposed next slice (for review, NOT started)

**z2.c — devnet rehearsal of the same contract** (z2.a Order C shape, on a
LOCAL Anvil/LocalDevnet, software signer only, zero money, no Trezor, no
mainnet): new harness reusing watchpay's validator against REAL local
receipts; kill-after-payment, double-submit (`PaymentAlreadyExists`),
`FinalizeResume` in-process resume; every outcome routed through the
ledger. Depends on the reviewer's call on the evmlib-dependency question
above. Separately after that: the Connect signing adapter (founder's
standing preference), still with deployment/admission gates closed.
