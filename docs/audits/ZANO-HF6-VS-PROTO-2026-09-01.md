# ZANO HF6 vs FROZEN PROTO — source-cited audit — 2026-09-01

**Scope.** Zano Hard Fork 6 consensus and address-format changes, read at source, against
the frozen surface: `proto/messages-zano.proto` v0.3 and the CLSAG design in the Trezor
lane. **Frozen decisions are NOT reopened and nothing here proposes changing them:**
SLIP-0010 `m/44'/1018'` all-hardened · 3/2-CLSAG GGX single-pass · 1/8 scaling · seed-class
flag. Language ceiling: "sound by construction / isolated by design".

**Source.** hyle-team/zano at HEAD `e5f56e11` (shallow clone, 200 commits). HF6 mainnet
activation is `ZANO_HARDFORK_06_AFTER_HEIGHT = 3833000` (`src/currency_core/currency_config.h:318`),
min build 501 (`:319`), fork id 6 (`:343`). The calendar date of activation is not in the
source — the order says 2026-08-31 and an earlier raid note says Aug 25–27; the date is
**UNVERIFIED** from source and does not affect any finding below.

**Method.** Every hit of `grep -rn "HARDFORK_06|is_hardfork_active(ZANO_HARDFORK_06|TRANSACTION_VERSION_POST_HF6|HF6" src/`
(60 hits) was visited and attributed to its enclosing function. `src/crypto/` was grepped
for any hardfork/version conditional. Key citations were re-read by hand at the line.

---

## A · The signing-path primitives under HF6

| primitive | source | HF6 branch? | verdict |
|---|---|---|---|
| `generate_CLSAG_GGX` | `src/crypto/clsag.cpp`, `clsag.h` | `grep -rniE "hardfork\|HF6\|TRANSACTION_VERSION" src/crypto/` → **0 hits** | DOES NOT TOUCH — isolated by design |
| bppe range proof | `src/crypto/range_proof_bppe.h` | 0 hits (same grep) | DOES NOT TOUCH |
| Zarcanum balance double-Schnorr | `src/crypto/zarcanum.cpp/.h` | 0 hits | DOES NOT TOUCH (dispatch above it changed — §B6) |
| Key image `I = s·Hp(P)`, `v = keccak256(s) mod l` | `src/crypto/crypto.cpp` | 0 hits | DOES NOT TOUCH |
| CLSAG call site | `src/currency_core/currency_format_utils.cpp:2596-2601` `generate_CLSAG_GGX(tx_hash_for_signature, ring, pseudo_out_amount_commitment, pseudo_out_blinded_asset_id, k_image, ephemeral.sec, …)` | not HF-gated; pseudo-outs still stored 1/8-scaled at `:2566,2572` | DOES NOT TOUCH the 1/8 convention |

History caveat: the shallow clone cannot show whether `clsag.cpp` lines 189–330 (the range
the proto v0.3 header cites) were modified by an earlier commit; what IS visible is that
HEAD contains no HF-conditional branch in any `src/crypto/` file. A byte-level diff of
`generate_CLSAG_GGX` against the v0.3 reading is **UNVERIFIED** from this clone — it
does not block any TOUCHES/DOES-NOT-TOUCH call below, because the call is made on the
presence/absence of HF gating, which is fully visible.

## B · Consensus / format changes, one by one

### B1 · Transaction version 4 mandatory; `tx_out_zarcanum` gains two fields
- `src/currency_core/blockchain_storage.cpp:7183-7186` `validate_tx_for_hardfork_specific_terms`: after HF6 `tx.version >= TRANSACTION_VERSION_POST_HF6` is a hard rule (`TRANSACTION_VERSION_POST_HF6 = 4`, `currency_config.h:44`).
- `src/currency_core/currency_basic.h:405-425` `struct tx_out_zarcanum`: fields are `stealth_address, concealing_point, amount_commitment, blinded_asset_id, encrypted_amount, **encrypted_payment_id**, mix_attr` inside `BEGIN_VERSIONED_SERIALIZE(TX_OUT_ZARCANUM_CURRENT_VERSION, version)` — a version byte and a u64 payment id that the pre-HF6 `tx_out_zarcanum_v1` (`currency_basic_backward_comp.inl:147-171`) did not carry. `transaction_prefix::serialize` (`currency_basic.h:1193-1211`) switches the vout element type on `TRANSACTION_VERSION_POST_HF6`.
- `get_transaction_prefix_hash` (`currency_format_utils_transactions.cpp:659-666`) is unchanged: keccak over the serialized prefix. The BLOB changes, the hash function does not.
- **TOUCHES proto:** `ZanoSignInput.tx_prefix_hash` (message m). The proto already declares this an out-of-band serialization contract ("byte-identical to the daemon, vector-tested, not defined here") — the contract's INPUT changed. `ZanoSignSetOutputAck` has no field for `encrypted_payment_id` (see B2).
- **TOUCHES signing path:** only via m (`prepare_prefix_hash_for_sign`, `currency_format_utils.cpp:3210` → `:2599`). The CLSAG algorithm consumes m as an opaque 32-byte value.
- Consequence: HF6 test vectors must be generated from v4 prefixes; a host serializing v3 outputs produces a different m than the daemon and the device signs a message no daemon will accept.

### B2 · Intrinsic per-output payment id
- `currency_format_utils.cpp:1555-1560` `construct_tx_out_zarcanum`: `if (tx.version >= TRANSACTION_VERSION_POST_HF6) out.encrypted_payment_id = de.payment_id ^ amount_mask.m_u64[1]` where `amount_mask = Hs(CRYPTO_HDS_OUT_AMOUNT_MASK, h)` — the SAME keccak scalar whose `m_u64[0]` already masks `encrypted_amount`. Size 8 (`currency_config.h:54`; `is_payment_id_size_ok` `:4753-4758`).
- **TOUCHES proto:** `ZanoSignSetOutput` has no payment-id input; `ZanoSignSetOutputAck` has no `encrypted_payment_id` output. Firmware computing outputs must emit this word (0 when no pid) or the host cannot rebuild the prefix the device signed.
- **TOUCHES signing path:** via m only. DOES NOT TOUCH the output points, bppe, balance proof, key image, derivation, or 1/8 scaling.
- Consequence: additive per-output field, derived from a mask the firmware already computes; no new cryptographic operation.

### B3 · Self-directed transfers with payment ids forbidden
- `src/wallet/wallet2.cpp:8586-8610` `check_and_throw_if_self_directed_tx_with_payment_id_requested` — in the HF6 zone throws if any self-directed destination has an intrinsic pid ≠ 0, or all outputs are self-directed with a tx-wide pid; `process_new_transaction` (`:581,666-668`) skips such incoming txs on scan.
- Consensus-level enforcement: **UNVERIFIED** — no such rule found in `blockchain_storage.cpp` or `hardfork_specific_terms.h`; it reads as wallet policy. Stopping that line.
- DOES NOT TOUCH proto or signing path (host-side policy either way).

### B4 · Extra/attachment type table
- `src/currency_core/hardfork_specific_terms.h:82-104` (column hf6): `tx_payer(_old)`, `tx_receiver(_old)`, `etc_tx_details_unlock_time`, `etc_tx_details_unlock_time2` → not allowed; new `gateway_address_descriptor_operation`, `etc_coinbase_block_cumulative_size` → at most one. Enforced by `validate_tx_for_hardfork_specific_terms_types_HF6` (`:186-249`), called from `blockchain_storage.cpp:7104` and `tx_semantic_validation.cpp:70-73`.
- `currency_format_utils.cpp:867` unlock-time lookup gated `tx_hadrfork_id < 6`; `blockchain_storage.cpp:6168` coinstake `handle_output` replaces unlock-time with an explicit confirmation count.
- **TOUCHES `tx_prefix_hash`** only through which extra entries the host places in the prefix. DOES NOT TOUCH any proto field or the CLSAG/bppe/balance math.

### B5 · Payload encryption / sender derivation v2
- `currency_format_utils.cpp:2185` `get_encryption_key_derivation` — v4 uses `encrypt_decrypt_key_derivation_for_sender(tx_pub_key, spend_secret_key, …)` instead of `chacha_crypt_legacy`; `:2228` `decrypt_payload_items`, `:2263` `encrypt_payload_items` switch visitors.
- The sender-side path consumes `spend_secret_key`, which under the frozen invariant never leaves the device. DOES NOT TOUCH any proto field; DOES NOT TOUCH the signing path.
- Consequence (flag, not a change): sender-encrypted comments/derivation hints on a watch-only host cannot be produced without the device — outside frozen v1 scope.

### B6 · Balance proof dispatch gains an HF6 case
- `currency_format_utils.cpp:683-687` `generate_tx_balance_proof` and `:953-956` `check_tx_balance` dispatch on `version >= 4` to `generate_tx_balance_proof_hf6` / `verify_balance_proof_hf6` (`currency_format_utils_transactions.cpp:183-346`, `:348-540`).
- For a tx with ≥1 `txin_zc_input` — the only case the proto signs — the proof is still `generate_double_schnorr_sig<gt_X, gt_G>(tx_id, commitment_to_zero, secret_x, tx_pub_key, tx_sec, dss)` into `zc_balance_proof` (`:334-339`), the same primitive as HF4 (`:81`). `commitment_to_zero` gains `bare_inputs_commitments_sum` / `bare_outs_*` terms (`:249-250`) which are zero without gateway ins/outs.
- The new `zc_gw_balance_proof` (`generic_linear_composition_and_schnorr_sig_s`, `currency_basic.h:526-533`) is used only when there are NO confidential inputs.
- **DOES NOT TOUCH** `ZanoSignBalanceProofAck.balance_proof` for native ZC-input transactions; the v0.3 TBD-A (exact `dss` serialization) is unchanged in kind. DOES NOT TOUCH the double-Schnorr.

### B7 · Asset surjection proof HF6 variant
- `currency_format_utils.cpp:476-490` dispatch to `generate/verify_asset_surjection_proof_hf6` (`:200`, `:363`); ring composition accommodates `txin_gateway`. Not on the proto wire (native asset id explicit in v1). DOES NOT TOUCH proto or signing path.

### B8 · Range-proof count rule and the 32-output hard cap
- `currency_format_utils.cpp:608-614` `check_single_tx_range_proofs`: HF6 permits zero range proofs iff zero confidential outputs; `generate_zc_outs_range_proof` (`:495-520`) counts only `tx_out_zarcanum`. `CURRENCY_TX_MAX_ALLOWED_OUTS = 32` becomes a hard rule (`currency_config.h:23`; `blockchain_storage.cpp:7189`).
- DOES NOT TOUCH proto or bppe. The proto's "≤2 outputs on-device / >2 offloaded" split is unaffected.

### B9 · Coinbase / block / fork-choice rules
- `blockchain_storage.cpp:1668-1705` `prevalidate_miner_transaction`; `:1921` `create_block_template`; `:7682-7695`, `:7848-7872` `handle_block_to_main_chain` (coinbase blob 8000, `currency_config.h:67`); `:2454,2499-2508` `is_reorganize_required`; `tx_pool.cpp:1147`; `net_node.inl:1240`. DOES NOT TOUCH proto or signing.

### B10 · Blob-size accounting
- `currency_format_utils_transactions.cpp:714-733,770` `get_transaction_hash` / `get_object_blobsize` use real serialized size after HF6. Fee estimation only. DOES NOT TOUCH proto or signing.

### B11 · Wallet / RPC / tooling hits
- `fill_destination_helper.h:92-135`, `simplewallet.cpp:1856-2302`, `wallet_rpc_server.cpp:654`, `conn_tool.cpp:63,973`, `wallet_public_structs_defs.h:738` — 8-byte pid enforcement, pre-HF6 intrinsic-pid rejection, history v3. Host-side only.

## C · Gateway addresses — what the firmware app must parse or sign

**Definition.** `gateway_address_id_type = crypto::public_key` (`currency_basic.h:160`);
`address_v = variant<account_public_address, gateway_address_id_type>` (`:163`). A gateway
address is a **single 32-byte key**, not the `{S, V}` pair of `account_public_address`
(`:109-134`), and carries no flags byte (no auditable flag).

**Encoding.** `get_account_address_as_str(const gateway_address_id_type&, pid)`
(`currency_format_utils.cpp:4790-4803`): base58 of `gateway_address_serialized_to_str{version,
gateway_addr, optional<u64> o_payment_id}` (`currency_basic.h:166-176`), prefix
`CURRENCY_PUBLIC_GATEWAY_BASE58_PREFIX = 0x656e` ("gwZ") or `…_INTEG_GATEWAY_… = 0x14276e`
("gwiZ", with 8-byte pid) (`currency_config.h:34-35`). Parser:
`get_account_address_and_payment_id_from_str` (`:4829-4843`).

**Output structure — a different output type, not a variant of the confidential one.**
`construct_tx_out` (`currency_format_utils.cpp:1627-1643`) routes a gateway destination to
`construct_tx_out_gateway` (`:1597-1625`), which asserts `tx.version >= TRANSACTION_VERSION_POST_HF6`
and emits `tx_out_gateway{version, gateway_addr, asset_id (1/8-premultiplied), amount (varint,
PLAINTEXT), payment_id}` (`currency_basic.h:356-370`). There is **no stealth address, no
amount commitment, no concealing point, no blinded asset id, no encrypted amount.** The
only derived quantity is `payment_id = de.payment_id ^ Hs(CRYPTO_HDS_GW_OUT_AMOUNT_MASK,
Hs(8·r·gw_addr, i)).m_u64[1]` (`:1604-1616`; domain separator `crypto_config.h:53`). Gateway
outputs add nothing to `tgc.amount_commitments_sum` (`:1618-1622`, commented out in source),
receive no range proof (`:502-505`), and their plaintext amount enters the HF6 balance
proof as a bare term (`currency_format_utils_transactions.cpp:232-238`). Consensus fences:
gateway ins/outs are incompatible with `TX_FLAG_SIGNATURE_MODE_SEPARATE` and gateway outs
with a tx-wide payment id (`blockchain_storage.cpp:7191-7203`). A new input type
`txin_gateway` (`currency_basic.h:340-353`) and `gateway_sig` (`:1168-1181`) exist; the
signature builder is `generate_gateway_sig_dummy` (`currency_format_utils.cpp:2604-2609`),
a stub at HEAD.

**Answer to the order's question.** For a firmware app that receives
`ZanoSignSetOutput.dest_address`:
- A standard (`Z…`/`iZ…`/`aZx…`) destination: **nothing changes** in what is parsed or in how `out_pub_key`, `amount_commitment`, `concealing_point`, `ecdh_info` are computed; only the additional `encrypted_payment_id` word (B2) must be produced.
- A gateway (`gwZ…`/`gwiZ…`) destination: **TOUCHES the proto** — `ZanoSignSetOutputAck` cannot be satisfied, since none of its four required fields exist for `tx_out_gateway`; the balance-proof `commitment_to_zero` also gains a bare term. **DOES NOT TOUCH the signing path** — CLSAG, bppe, the key image, the derivation, and the 1/8 convention on ring/pseudo-out fields are all untouched by the presence of a gateway output. The correct v1 behaviour, consistent with the frozen proto, is for firmware to **refuse** the gwZ/gwiZ prefixes; supporting them is a new ack shape and a separate decision, not an amendment to anything frozen.

## D · Summary table

| # | HF6 change | frozen proto field(s) | signing path |
|---|---|---|---|
| B1 | tx v4 / `tx_out_zarcanum` + pid + version | TOUCHES `tx_prefix_hash` (input to the out-of-band serialization contract); `SetOutputAck` lacks the new word | TOUCHES m only |
| B2 | Intrinsic per-output pid | TOUCHES `SetOutput` / `SetOutputAck` (additive field) | TOUCHES m only |
| B3 | Self-directed + pid ban | no (wallet policy; consensus enforcement UNVERIFIED) | no |
| B4 | Extra/attachment type table | no (prefix content only) | m only |
| B5 | Payload encryption v2 | no | no |
| B6 | Balance-proof HF6 dispatch | no (native ZC-input case unchanged) | DOES NOT TOUCH the double-Schnorr |
| B7 | Surjection proof HF6 | no | no |
| B8 | Range-proof count rule / 32-out cap | no | DOES NOT TOUCH bppe |
| B9 | Coinbase / block / fork-choice | no | no |
| B10 | Blob-size accounting | no | no |
| C | Gateway address + `tx_out_gateway` | TOUCHES `dest_address`, all of `SetOutputAck`; balance `commitment_to_zero` bare term | DOES NOT TOUCH CLSAG / bppe / key image / derivation / 1/8 |

## E · Reading

The frozen crypto core — CLSAG GGX single-pass, bppe, key image, `v = keccak256(s) mod l`,
the 1/8 convention, the derivation path — is **isolated by design** under HF6: no file in
`src/crypto/` carries an HF branch, and the CLSAG call site is unconditional. The
load-bearing HF6 deltas for the frozen proto are on the **transaction-prefix surface**:
(1) the v4 prefix layout that feeds m, (2) the additive `encrypted_payment_id` word on
each confidential output, and (3) a new output type for gateway destinations that the
v0.3 ack cannot express and v1 firmware should refuse. None of these requires reopening a
frozen decision; (1) and (2) are vector-set and ack-field work on the already-declared
out-of-band serialization contract, and (3) is a scope line.

**UNVERIFIED lines carried (none blocks a TOUCHES/DOES-NOT-TOUCH call):** activation calendar
date; consensus-level enforcement of the self-directed-pid ban; byte-level history of
`generate_CLSAG_GGX` from a shallow clone.
