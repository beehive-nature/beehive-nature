# Z2.B recon round 5 — differential-test DESIGN (no implementation) + research redirect to first-line rails

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Build the
differential-test design for k256 BIP-352 vs the published vector
suite and `silentpayments`, but don't implement the bPay BTC rail yet.
Preserve `bpay-sp-core` as a PROPOSAL. Then redirect research toward
first-line LN/EVM/L2 rails and gas abstraction." Standing ruling
recorded: **BTC L1 is last-line/fallback; LN/EVM/L2 are first-line.**

This round is design + redirection only: no code, no vectors executed,
no integration, nothing built.

## Part 1 — Differential-test design (bpay-sp-core acceptance harness)

### Objectives (what the harness must PROVE when the core is ever built)

1. **Vector truth**: our k256 BIP-352 arithmetic reproduces the
   PUBLISHED suite — `bip-0352/send_and_receive_test_vectors.json`
   (28 cases: comment-tagged sending+receiving pairs; the R4 smoke
   proved case 0 only).
2. **Reference agreement**: our core agrees with the vector-verified
   `silentpayments` crate (secp256k1) on every case — differential on
   IMPLEMENTATIONS, not just against fixed strings.
3. **Platform equivalence**: the wasm build of our core agrees with its
   native build on every case — under the R4 lesson law: anchored by
   the published suite (external ground truth), never by wasm==native
   equality alone.
4. **Negative coverage**: malformed inputs refuse (the suite carries
   no explicit negative cases — we derive them: bad bech32m checksums,
   wrong network/version bytes, non-canonical pubkeys, empty inputs,
   zero-valued drains).

### Harness shape (design)

```
vector-driver (test-only crate, never shipped):
  parse send_and_receive_test_vectors.json →
    SendCase { vins: [(priv_key, prevout_script_class)], recipients,
               expected: {outputs, shared_secret, input_key_sum} }
    RecvCase { scan_priv, spend_priv, labels?,
               expected: {addresses, outputs: [(tweak, pubkey, sig)]} }

trait SpCoreUnderTest {            // the ONLY seam; adapters:
    fn sender_outputs(&self, recipients, partial_secret) -> Outputs;
    fn partial_secret(&self, inputs, outpoints) -> Scalar32;   // organ-side fn
    fn derive_code(&self, scan_pub, spend_pub, net) -> SpCode;
    fn scan_match(&self, block_tweaks, scan_priv) -> Matches;  // recv side
}
  adapter A: silentpayments (secp, native)          // reference, exists today
  adapter B: bpay-sp-core (k256, native)            // PROPOSAL — not built
  adapter C: bpay-sp-core wasm (wasmi host)         // PROPOSAL — not built

legs per case:
  L1  A == published expected          (reference sanity; partially
                                       receipted in R4 for case 0)
  L2  B == published expected          (vector truth of ours)
  L3  B == A                           (implementation agreement)
  L4  C == B == published              (platform equivalence, anchored)
negatives: both adapters must REFUSE (named error), never diverge into
  accepting; divergence between adapters on a malformed input = finding.
```

### Coverage matrix (all 28 published cases + derived negatives)

Per the suite's structure: sending cases with (a) P2PK inputs
(negation rule on odd-parity taproot keys only — verified in R4 at
`get_a_sum_secret_keys`), (b) taproot key-path inputs, (c) multiple
recipients, (d) recipient `count` > 1, (e) labels on the receive side,
(f) multiple outputs. Each case runs legs L1–L4; the matrix asserts
every leg for every case — no sampling.

### Laws carried into the design

- External-anchor law (R4 lesson): every comparison's terminal ground
  truth is the PUBLISHED vector, not another of our own legs.
- The harness is TEST-ONLY capital: it strengthens whichever core is
  ever adopted (ours, or a future silentpayments fork) — it does not
  presume the bpay-sp-core build decision, which stays parked as a
  proposal under the rail-order ruling.
- Cost when built: the driver + adapters are ~2–3 days; wasm leg
  reuses the R4 wasmi runner pattern (recorded in the R4 appendix).

### Explicitly NOT in this round

No implementation, no `bpay-sp-core` crate, no vector execution beyond
what R4 already receipted, no Blindbit work.

## Part 2 — Research redirect: first-line LN/EVM/L2 rails + gas abstraction

Opening map only (the next roll-forward probes queue from here).

**Estate capital already in hand for the first line:**
- **LN**: Alby Hub LIVE (lightning lane; BIP-352 shipped there —
  receive-side, via Hub, not our Rust). The first-line LN question is
  the SAME shape as the BTC-L1 one: which parts are ours to own vs
  vendored, and does the k256-wasm posture matter for a web leg.
- **EVM/L2**: `watchpay` is already a bounded-payment-contract engine
  for an EVM L2 (Arbitrum-shape vault) with **fee ceilings, per-tx
  worst-case math, and cumulative budget laws — i.e., an existing
  gas-abstraction PRIMITIVE** (the plan envelope IS a gas-abstracted
  payment description); `chain-exsat-evm` (EVM log decode);
  `b-token`/escrow stack for value movement.
- **Cross-cutting**: the R4 posture finding (k256-wasm viable, secp-C
  not) governs any first-line rail's web leg too.

**Queued probes (next roll-forwards, research-only):**
1. Gas-abstraction landscape vs our first-party-only law: ERC-4337
   bundler/paymaster trust shapes, EIP-7702 delegation, L2-native fee
   sponsorship — which models keep the box/node first-party.
2. L2 fee composition (Arbitrum L1-data component inside the bid —
   already flagged as an assumption in the watchpay receipt; needs a
   source-pinned memo before any EVM rail decision).
3. LN first-line shape: Alby Hub integration surface vs our own
   rail-trait checklist (R2); where custody (organ) meets LN.
4. Re-anchor the R2 rail checklist onto LN/EVM rails specifically
   (it was translated from a UTXO-shaped wallet; EVM rails differ in
   history/fees/nonce semantics — watchpay's nonce/budget laws map
   directly).

## Sources

- R4 dispatch (0db24923) — vector-0 receipt, wasmi runner, anchors law.
- bip-0352/send_and_receive_test_vectors.json (structure: 28 cases,
  comment/sending/receiving — verified in R4).
- Estate capital: crates/watchpay (fee/budget laws), chain-exsat-evm,
  bnr-keys (wasm law); memory lanes: wallet-lightning-raid (Alby Hub),
  bpay-rail-order-ruling.
