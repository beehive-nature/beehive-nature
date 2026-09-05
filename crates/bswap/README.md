# bswap — adaptor-signature atomic swap (SWAP-LOCK)

**One secret moves both legs.** The script side is BTC (testnet-first): a
P2WSH 2-of-2-with-CSV-refund lock whose happy-path spend carries an ECDSA
adaptor pre-signature. The no-script side is **the Zano leg the frozen
CLSAG proto already signs** — Zano's HTLC output type does not exist at
HEAD (SWAP-SORT §4, fact A64), so the Zano leg of any atomic swap is the
adaptor/no-script side, exactly the surface `messages-zano.proto` v0.3
signs. The pattern source is **BasicSwap's XMR path** per
`docs/raids/SWAP-SORT-2026-09-02.md` §5 (z2.1 row): mechanisms travel,
code does not.

## The mechanism (all claims cite file+function or stop at UNVERIFIED)

- **Adaptor (BTC, secp256k1)** — `src/adaptor.rs`, the multiplicative
  construction: pre-signature `(R, R_f, r_f, s′)` with `R = k·G`,
  `R_f = k·T`, `s′ = k⁻¹(z + r_f·x)`; verify `s′·R == z·G + r_f·X`
  (`verify_adaptor`); complete `s = s′·t⁻¹` (`complete`); extract
  `t = s′·s⁻¹` (`extract`). Proven by the round-trip and negative tests
  in that file. **UNVERIFIED:** byte-for-byte correspondence with
  Particl's/BasicSwap's own OtVES encoding (their repos are not at this
  seat) — not claimed.
- **Adaptor-blindness (found by this crate's own negative test):** the
  verification equation is `T`-invariant — the binding lives with the
  completer: the leader checks `R_f == t·R` against its OWN secret
  (`verify_adaptor_as_completer`). A pre-signature encrypted to any other
  point is refused there. Third-party `verify_adaptor` alone does NOT
  bind the adaptor point — both checks together are the gate.
- **Completion is all-or-nothing:** completing with a wrong secret does
  not even yield a valid ECDSA signature (the algebra closes only over
  the true `t`) — tested.
- **Low-s (BIP 62):** `complete` returns the low-s form; `extract` tries
  `s` and `n−s` so extraction survives wallet normalisation — tested.
- **Script (BTC testnet)** — `src/script.rs::swap_script`: `OP_IF
  <leader> CHECKSIGVERIFY <follower> CHECKSIG OP_ELSE <csv>
  CHECKSEQUENCEVERIFY DROP <follower> CHECKSIG OP_ENDIF`; P2WSH program
  `sha256(script)` (BIP 141); bech32 address (BIP 173 — witness version
  as its own 5-bit group; the one-byte-string framing trap is guarded by
  the round-trip test). Bech32 correctness is pinned to the BIP 173
  testnet P2WSH reference vector, asserted in the tests. **UNVERIFIED:**
  the exact script bytes in BasicSwap's `xmr_swap_1.py` — this
  construction stands on its own asserted bytes.
- **Zano (no-script leg)** — `src/zano.rs`: combined-key lock
  `P = (a+b)·B` (SWAP-SORT §1 row 3: "combined-key lock on the NO-SCRIPT
  coin"); the leader's share IS the swap secret; the follower's
  post-claim derivation `t + b` (`sweep_secret`), verified against the
  lock (`sweep_matches`). Scalar mapping labeled: the same 32 bytes
  reduce mod `l` (dalek `from_bytes_mod_order`) on the Zano side and mod
  `n` (k256 `reduce_bytes`) on the BTC side. **UNVERIFIED:** the exact
  canonical mapping BasicSwap uses for its XMR leg.
- **Protocol** — `src/protocol.rs`: refunds armed BEFORE any lock
  (refuse-to-lock guards are enforced, not advisory); the pre-signature
  is verified on delivery (the completer's gate when the leader's secret
  is in hand); the sweep key is CHECKED against the combined lock before
  use; abort exits exist pre-claim only.
- **Timelock law** — `src/protocol.rs::validate_timelocks`: the leader's
  Zano-refund escape must outlive the follower's BTC refund + sweep
  window + margin (`zano_refund_at ≥ btc_refund_at + sweep_window +
  margin`) — else the leader could claim the BTC and claw the Zano.
  **UNVERIFIED:** BasicSwap's exact timeout constants.

## Scope fences

- **No transaction builder**: the crate signs 32-byte digests and builds
  script/address artifacts; sighash computation, tx assembly and
  broadcast are the wallet lane's. **On-chain BTC testnet broadcast:
  UNVERIFIED at this seat** (no funded testnet node here).
- **No CLSAG implementation**: the Zano spend signature is the frozen
  proto / signer lane's work ("swap = one more thing the signer signs,
  not a new signer" — SWAP-SORT §5). The estate's Zano key authority
  in-tree is `crates/chain-zano/src/keys.rs` (SLIP-0010 `m/44'/1018'`).
- **DO NOT add an HTLC to Zano** (dispatch A64; SWAP-SORT §4).
- **No price feed**: the swap logic never consumes a price (there is no
  price-reading code in this crate; the absence is the fence).
- Language ceiling: **sound by construction / isolated by design**.

## Build & test

```
cargo test --offline -p bswap     # 22/22 green (adaptor, script, zano, protocol)
cargo clippy --offline -p bswap   # clean (the workspace profile notice is pre-existing)
```

Dependencies: k256 (secp256k1/ECDSA), curve25519-dalek (ed25519 scalars),
sha2, bech32 — all from the local registry cache (offline build).
