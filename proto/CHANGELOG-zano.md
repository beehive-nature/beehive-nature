# messages-zano.proto — changelog

## v0.3 → v0.4 (2026-09-05, order C — ADDITIVE ONLY)

Per `docs/audits/ZANO-HF6-VS-PROTO-2026-09-01.md` (read at source against
hyle-team/zano @ `e5f56e11`, the audit's HEAD). Nothing existing is
renumbered, removed, or reopened; the frozen decisions (SLIP-0010
`m/44'/1018'` all-hardened · 3/2-CLSAG GGX single-pass · 1/8 rule ·
seed-class flag) are untouched — enforced by the fence tests in
`crates/btrezor/src/zano_proto.rs`, which read the proto at test time and
fail any revision that alters a frozen marker or drops a v0.3 field line.
A64 applies: nothing the audit marked nonexistent at the audited HEAD is
added.

1. **tx version 4 prefix layout documented at `ZanoSignInput.tx_prefix_hash`.**
   The out-of-band serialization contract's INPUT changed at HF6
   (`TRANSACTION_VERSION_POST_HF6 = 4`, `currency_config.h:44`, mandatory
   after height 3833000). The layout block cites the Zano file and line for
   every byte: the prefix field order (`transaction_prefix::serialize`,
   `currency_basic.h:1191-1211` — version uvarint, vin, extra, vout, 1-byte
   hardfork_id), the byte primitives (`FIELD` on an integer = fixed-width
   little-endian, NOT varint — `serialization.h:33-35` → `binary_archive.h:60-66`;
   `VARINT_FIELD` = uvarint; blobs raw; containers uvarint-counted; variants
   one tag byte, `binary_archive.h:32`), the variant tag table
   (`currency_basic.h:1391-1468`: `txin_zc_input`=37, `tx_out_zarcanum`=63),
   the `tx_out_zarcanum` body with the NEW `encrypted_payment_id` word
   (`currency_basic.h:405-425`), and m's chain: m =
   keccak256(prefix bytes) (`get_transaction_prefix_hash`,
   `currency_format_utils_transactions.cpp:658-666`), passed UNCHANGED to
   CLSAG in the normal mode (`prepare_prefix_hash_for_sign` :4982, :4986;
   call site :3210). Consequence carried: v4 test vectors must be generated
   from v4 prefixes — a v3-serializing host produces an m no post-HF6 daemon
   accepts.
2. **`encrypted_payment_id` (additive field 6, both messages).**
   `ZanoSignSetOutput.payment_id` (uint64, absent/0 = none) and
   `ZanoSignSetOutputAck.encrypted_payment_id` (bytes, always 8). HF6 makes
   the payment id intrinsic per output:
   `encrypted_payment_id = payment_id ^ amount_mask.m_u64[1]` where
   `amount_mask = Hs(CRYPTO_HDS_OUT_AMOUNT_MASK, h)` is the same keccak
   scalar whose `m_u64[0]` masks `encrypted_amount`
   (`currency_format_utils.cpp:1552-1560`; pid size 8,
   `currency_config.h:54`). Without the word on the ack, the host cannot
   rebuild the v4 prefix whose hash was signed. Wallet policy on
   self-directed + pid (`wallet2.cpp:8586-8610`, audit B3) stays host-side;
   consensus enforcement UNVERIFIED per the audit.
3. **v1 refuse rule: gateway destinations.** A `dest_address` with base58
   prefix gwZ (`0x656e`) or gwiZ (`0x14276e`) — `currency_config.h:35-36` —
   names a gateway destination: `tx_out_gateway`
   (`currency_basic.h:356-371`) is a DIFFERENT output type (single 32-byte
   key, plaintext amount, no stealth address, no commitments, no concealing
   point) that the ack shape cannot express. v1 firmware REFUSES it with the
   named failure `ZanoGatewayAddressNotSupported` (constant + prefix check +
   fences in `crates/btrezor/src/zano_proto.rs`). Supporting gateways is a
   new ack shape and a separate decision, never an amendment here.

## v0.2 → v0.3 (2026-09-03)

CLSAG round CONFIRMED single-pass against `clsag.cpp`; oneof wrappers; the
1/8 rule made explicit (host sends RAW, firmware scales); CLSAG confirmed
not to read BP+ data. (As recorded in the proto header.)

## v0.1 → v0.2

Initial multi-round draft. (Pre-history of this lane; see git.)
