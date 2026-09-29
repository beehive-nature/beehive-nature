# Parity-vector generator (recorded)

Generates the calldata vectors pinned in `../../tests/parity_calldata.rs`
by calling the REAL upstream keyless helper
`evmlib::external_signer::pay_for_merkle_tree_calldata` from
**evmlib = "=0.9.1" (crates.io, feature `external-signer`)** — the same
pin the z2.a audit and the z2.b review inspected.

## Run receipt

- 2026-09-12, z2.b seat (GLM/zCode), OFFLINE: `cargo run --release`.
  Calldata encoding is pure — the `Network::new_custom` provider is
  never dialed (any syntactically valid RPC URL works).
- First run (CASE1 depth 1 with ONE pool) receipted that the upstream
  helper encodes UNLAWFUL pool counts without complaint; the checked-in
  vectors use lawful shapes only (depth 1 -> 2 pools, depth 2 -> 2
  pools, ts 1757612345, pool tags 1/2, amounts 1..=16 / all-ones).
- The same run printed `approve_amount` =
  115792089237316195423570985008687907853269984665640564039457584007913129639935 <!-- PUBLIC-CONSTANT: upstream Amount::MAX decimal, receipted at the pin -->
  (= 2^256-1, `Amount::MAX`) — the E7 collision, live at the pin. This
  crate refuses that approval shape by law.

## Regenerate and compare

```
cargo run --release   # prints CASE1/CASE2 calldata hex
```

Compare byte-for-byte with `CASE1_CALLDATA_HEX`/`CASE2_CALLDATA_HEX` in
`../../tests/parity_calldata.rs` (the test itself already asserts this
crate's composer reproduces them).
