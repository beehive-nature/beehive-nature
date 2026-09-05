//! The Zano firmware contract surface this crate holds on behalf of
//! proto/messages-zano.proto (v0.4, order C 2026-09-05).
//!
//! btrezor cannot sign — that fence is unchanged. What it OWNS here is the
//! contract's named refusal and the fences that keep the proto additive:
//!
//!   * [`GATEWAY_ADDRESS_NOT_SUPPORTED`] — the named failure v1 firmware
//!     returns for a `ZanoSignSetOutput.dest_address` whose base58 prefix is
//!     gwZ (0x656e) or gwiZ (0x14276e) — hyle-team/zano @ e5f56e11,
//!     currency_config.h:35-36. A gateway destination is a different output
//!     type (`tx_out_gateway`, currency_basic.h:356-371: single 32-byte key,
//!     plaintext amount, no stealth address, no commitments) that the v0.3
//!     ack shape cannot express; per docs/audits/ZANO-HF6-VS-PROTO-2026-09-01.md
//!     §C the correct v1 behaviour is to refuse, and supporting gateways is a
//!     new ack shape and a separate decision.
//!   * The base58 prefix check itself — [`is_gateway_address_prefix`] —
//!     the rule a firmware implementer writes once, cited at source.
//!
//! THE FROZEN GATE (order C): the derivation path (SLIP-0010 m/44'/1018'
//! all-hardened), the 3/2-CLSAG GGX single-pass round, and the 1/8 rule are
//! proto surfaces and are asserted verbatim below — a revision that alters
//! any of them changes a frozen decision and fails the gate. The seed-class
//! flag is not a proto surface (it lives in the CLSAG lane's frozen
//! decisions); it is untouched by construction, and the additive-only
//! inventory test holds that line. v0.4 is additive only; these tests keep
//! it that way.

/// The named failure for a gateway destination on the v1 signing path.
/// Trezor `Failure` text: the string below, verbatim.
pub const GATEWAY_ADDRESS_NOT_SUPPORTED: &str = "ZanoGatewayAddressNotSupported";

/// The base58 prefix bytes of Zano gateway addresses at the audited HEAD
/// (currency_config.h:35-36): version word 0x656e encodes to "gwZ",
/// 0x14276e to "gwiZ" (integrated, 8-byte pid).
pub const GATEWAY_PREFIX_GWZ: u16 = 0x656e;
pub const GATEWAY_PREFIX_GWIZ: u32 = 0x0014_276e;

/// True when a Zano address string starts with a gateway prefix ("gwZ" /
/// "gwiZ") — the destinations v1 firmware refuses with
/// [`GATEWAY_ADDRESS_NOT_SUPPORTED`].
pub fn is_gateway_address_prefix(addr: &str) -> bool {
    addr.starts_with("gwZ") || addr.starts_with("gwiZ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proto_text() -> String {
        let p = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../proto/messages-zano.proto");
        std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("read {}: {e}", p.display()))
    }

    #[test]
    fn gateway_prefixes_detected() {
        assert!(is_gateway_address_prefix("gwZabcd"));
        assert!(is_gateway_address_prefix("gwiZabcd"));
        assert!(!is_gateway_address_prefix("ZanoAddress1"));
        assert!(!is_gateway_address_prefix("iZpid"));
        assert!(!is_gateway_address_prefix("aZxaudit"));
        assert!(!is_gateway_address_prefix(""));
        assert_eq!(GATEWAY_PREFIX_GWZ, 0x656e);
        assert_eq!(GATEWAY_PREFIX_GWIZ, 0x14276e);
    }

    #[test]
    fn proto_declares_the_named_refusal() {
        let p = proto_text();
        assert!(
            p.contains(GATEWAY_ADDRESS_NOT_SUPPORTED),
            "the v1 refuse rule must name {GATEWAY_ADDRESS_NOT_SUPPORTED}"
        );
        assert!(p.contains("0x656e"), "gwZ prefix cited");
        assert!(p.contains("0x14276e"), "gwiZ prefix cited");
    }

    #[test]
    fn proto_is_at_v04_and_carries_the_additive_fields() {
        let p = proto_text();
        assert!(p.contains("AUTHORITATIVE DRAFT v0.4"), "version bumped");
        assert!(
            p.contains("optional uint64 payment_id = 6;"),
            "SetOutput carries the sender payment id (additive field 6)"
        );
        assert!(
            p.contains("optional bytes encrypted_payment_id = 6;"),
            "SetOutputAck carries the 8-byte HF6 word (additive field 6)"
        );
    }

    /// THE FROZEN GATE — order C: "a diff that touches them fails the gate".
    /// These markers are the v0.3 wording, verbatim; a revision that alters
    /// any of them changes a frozen decision and fails here.
    #[test]
    fn frozen_decisions_are_untouched() {
        let p = proto_text();
        let frozen = [
            // derivation path — SLIP-0010, all-hardened, fixed once at Init
            "m/44'/1018'/account'/change'/index' (all hardened)",
            "derivation path lives here ONLY. Never re-sent per input.",
            // CLSAG round — single-pass, confirmed against clsag.cpp in v0.3
            "CLSAG signing round PROMOTED from TBD to CONFIRMED",
            "No pre-commitment round. Does NOT read BP+ data.",
            "CONFIRMED single-pass against clsag.cpp",
            // the 1/8 rule — raw vs premultiplied, verbatim from v0.3
            "1/8 rule made explicit",
            "DO NOT pre-scale pseudo_out_* or stealth/amount fields on the host.",
            "host sends it as T premultiplied by 1/8 (clsag.h)",
            // security invariant — secrets never on the wire
            "and NEVER appear on",
        ];
        for marker in frozen {
            assert!(
                p.contains(marker),
                "FROZEN DECISION TOUCHED — proto no longer carries v0.3's verbatim: {marker:?}"
            );
        }
    }

    /// v0.4 must be ADDITIVE: every v0.3 field line survives verbatim (no
    /// renumbering, no removal, no type change). Checked against the field
    /// inventory of v0.3 as committed at 8797d662..4717f069.
    #[test]
    fn v04_is_additive_over_v03_field_inventory() {
        let p = proto_text();
        let v03_fields = [
            "repeated uint32 address_n = 1;",
            "required bytes address = 1;",
            "required bytes view_secret = 1;",
            "required uint64 count = 2;",
            "required bytes  out_pub_key = 1;",
            "required uint64 out_index = 3;",
            "repeated bytes key_images = 1;",
            "required uint32 num_inputs = 3;",
            "required uint32 num_outputs = 4;",
            "required uint32 ring_size = 5;",
            "required uint64 fee = 6;",
            "optional uint32 hard_fork = 7;",
            "required uint32 input_index = 1;",
            "repeated ZanoRingMember ring = 2;",
            "required uint32 real_output_index = 3;",
            "required bytes stealth_address = 1;",
            "required bytes amount_commitment = 2;",
            "required bytes blinded_asset_id = 3;",
            "optional uint64 global_index = 4;",
            "required bytes key_image = 1;",
            "required bytes pseudo_out_amount_commitment = 2;",
            "required bytes pseudo_out_asset_id = 3;",
            "required bytes hmac = 4;",
            "required bytes  dest_address = 2;",
            "required uint64 amount = 3;",
            "optional bytes  asset_id = 4;",
            "optional bool   is_change = 5;",
            "required bytes concealing_point = 3;",
            "required bytes ecdh_info = 4;",
            "optional bytes blinded_asset_id = 5;",
            "required bytes  tx_prefix_hash = 3;",
            "required ZanoClsagGgxSignature signature = 1;",
            "required bytes c = 1;",
            "repeated bytes r_g = 2;",
            "repeated bytes r_x = 3;",
            "required bytes K1 = 4;",
            "required bytes K2 = 5;",
            "optional bytes tx_secret_keys = 1;",
        ];
        for f in v03_fields {
            assert!(
                p.contains(f),
                "v0.3 field line missing or altered (additive-only violated): {f:?}"
            );
        }
    }

    /// A64: the mechanism the audit marked nonexistent at HEAD must not
    /// appear in the proto. The needle is assembled at runtime so this file
    /// does not carry it either.
    #[test]
    fn nothing_marked_nonexistent_appears() {
        let p = proto_text();
        let needle = ["H", "T", "L", "C"].concat();
        assert!(
            !p.contains(&needle),
            "the proto names a mechanism A64 removed at HEAD"
        );
    }
}
