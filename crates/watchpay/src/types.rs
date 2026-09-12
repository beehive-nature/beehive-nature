//! Strict value types for the watchpay plan envelope.
//!
//! Every string form here is CANONICAL and reject-everything-else:
//! - [`EthAddr`] `0x` + 40 lowercase hex bytes (20 bytes).
//! - [`Hex32`] `0x` + 64 lowercase hex bytes (32 bytes) — hashes/commitments.
//! - [`Atto`] canonical decimal string (digits only, no sign, no leading
//!   zeros unless the value is exactly `0`, at most 78 digits).
//!
//! `Atto` names the unit explicitly per the plan law: all payment-token
//! amounts in the envelope are integer atto-units of the payment token.
//! A JSON *number* is refused for `Atto` — amounts ride as strings only.

use primitive_types::U256;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

fn is_lower_hex(s: &str, want: usize) -> bool {
    s.len() == 2 + want
        && s.starts_with("0x")
        && s[2..].bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// A 20-byte EVM address in canonical lowercase-hex string form.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct EthAddr(pub [u8; 20]);

impl EthAddr {
    pub const ZERO: EthAddr = EthAddr([0u8; 20]);

    pub fn as_bytes(&self) -> &[u8; 20] {
        &self.0
    }

    pub fn is_zero(&self) -> bool {
        self.0 == [0u8; 20]
    }

    pub fn from_lower_hex(s: &str) -> Result<Self, String> {
        if !is_lower_hex(s, 40) {
            return Err(format!("address must be 0x + 40 lowercase hex chars, got {s:?}"));
        }
        let mut out = [0u8; 20];
        hex::decode_to_slice(&s[2..], &mut out).map_err(|e| e.to_string())?;
        Ok(EthAddr(out))
    }

    pub fn to_lower_hex(&self) -> String {
        format!("0x{}", hex::encode(self.0))
    }
}

impl std::fmt::Display for EthAddr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_lower_hex())
    }
}

impl Serialize for EthAddr {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_lower_hex())
    }
}

impl<'de> Deserialize<'de> for EthAddr {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        EthAddr::from_lower_hex(&s).map_err(serde::de::Error::custom)
    }
}

/// A 32-byte hash / commitment in canonical lowercase-hex string form.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Hex32(pub [u8; 32]);

impl Hex32 {
    pub const ZERO: Hex32 = Hex32([0u8; 32]);

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn is_zero(&self) -> bool {
        self.0 == [0u8; 32]
    }

    pub fn from_lower_hex(s: &str) -> Result<Self, String> {
        if !is_lower_hex(s, 64) {
            return Err(format!("hash must be 0x + 64 lowercase hex chars, got {s:?}"));
        }
        let mut out = [0u8; 32];
        hex::decode_to_slice(&s[2..], &mut out).map_err(|e| e.to_string())?;
        Ok(Hex32(out))
    }

    pub fn to_lower_hex(&self) -> String {
        format!("0x{}", hex::encode(self.0))
    }
}

impl std::fmt::Display for Hex32 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_lower_hex())
    }
}

impl Serialize for Hex32 {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_lower_hex())
    }
}

impl<'de> Deserialize<'de> for Hex32 {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Hex32::from_lower_hex(&s).map_err(serde::de::Error::custom)
    }
}

/// An integer amount of atto payment-token units, canonical decimal string.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Atto(pub U256);

impl Atto {
    pub const ZERO: Atto = Atto(U256::zero());
    /// 2^256 - 1. Never a lawful approval value here (the E7 law).
    pub const MAX: Atto = Atto(U256::max_value());

    pub fn from_u64(v: u64) -> Self {
        Atto(U256::from(v))
    }

    pub fn from_u128(v: u128) -> Self {
        Atto(U256::from(v))
    }

    /// Strict canonical-decimal parse. Rejects signs, leading zeros,
    /// non-digits, empty strings, and JSON numbers.
    pub fn parse_canonical(s: &str) -> Result<Self, String> {
        if s.is_empty() {
            return Err("amount string is empty".into());
        }
        if !s.bytes().all(|b| b.is_ascii_digit()) {
            return Err(format!("amount string {s:?} is not canonical decimal (digits only)"));
        }
        if s.len() > 1 && s.starts_with('0') {
            return Err(format!("amount string {s:?} has a leading zero"));
        }
        if s.len() > 78 {
            return Err(format!("amount string {s:?} exceeds u256 (78 digits)"));
        }
        let v = U256::from_dec_str(s).map_err(|e| format!("amount string {s:?}: {e}"))?;
        Ok(Atto(v))
    }

    pub fn checked_add(self, o: Self) -> Option<Self> {
        self.0.checked_add(o.0).map(Atto)
    }

    pub fn checked_mul(self, o: Self) -> Option<Self> {
        self.0.checked_mul(o.0).map(Atto)
    }

    /// `self << shift`, refusing any bit loss or overflow. Implemented via
    /// checked multiplication by 2^shift (uint 0.10 has no checked_shl).
    pub fn checked_shl(self, shift: u32) -> Option<Self> {
        if shift >= 256 {
            return if self == Atto::ZERO { Some(Atto::ZERO) } else { None };
        }
        let factor = Atto(U256::from(1u8) << shift);
        self.checked_mul(factor)
    }

    pub fn to_decimal(&self) -> String {
        self.0.to_string()
    }
}

impl std::fmt::Display for Atto {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_decimal())
    }
}

impl Serialize for Atto {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_decimal())
    }
}

impl<'de> Deserialize<'de> for Atto {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Atto::parse_canonical(&s).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addr_canonical_forms() {
        let a = EthAddr::from_lower_hex("0x00000000000000000000000000000000000000b2").unwrap();
        assert_eq!(a.to_lower_hex(), "0x00000000000000000000000000000000000000b2");
        assert!(EthAddr::from_lower_hex("0x00000000000000000000000000000000000000B2").is_err());
        assert!(EthAddr::from_lower_hex("b2000000000000000000000000000000000000000").is_err());
        assert!(EthAddr::from_lower_hex("0x00").is_err());
    }

    #[test]
    fn hex32_canonical_forms() {
        let h = Hex32::from_lower_hex(
            "0x0100000000000000000000000000000000000000000000000000000000000000", // PUBLIC-CONSTANT: synthetic fixture value
        )
        .unwrap();
        assert_eq!(h.0[0], 1);
        assert!(Hex32::from_lower_hex("0X0100").is_err());
    }

    #[test]
    fn atto_strict_decimal() {
        assert_eq!(Atto::parse_canonical("0").unwrap(), Atto::ZERO);
        assert_eq!(Atto::parse_canonical("4096").unwrap().to_decimal(), "4096");
        for bad in ["", "+1", "-1", "007", "0x1", "1 ", "1.5", "١٢٣", "1e3"] {
            assert!(Atto::parse_canonical(bad).is_err(), "{bad:?} must be refused");
        }
        let too_long = "1".to_string() + &"0".repeat(78);
        assert!(Atto::parse_canonical(&too_long).is_err(), "79 digits must be refused");
        // 78 nines exceed u256 (max has 78 digits starting with 1).
        assert!(Atto::parse_canonical(&"9".repeat(78)).is_err());
        // The exact u256 maximum parses (and equals Atto::MAX).
        let max_str = "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // PUBLIC-CONSTANT: upstream Amount::MAX default, receipted at the pin
        assert_eq!(Atto::parse_canonical(max_str).unwrap(), Atto::MAX);
    }

    #[test]
    fn atto_json_is_string_only() {
        #[derive(Deserialize)]
        struct V {
            a: Atto,
        }
        let ok: V = serde_json::from_str(r#"{"a":"4096"}"#).unwrap();
        assert_eq!(ok.a.to_decimal(), "4096");
        assert!(serde_json::from_str::<V>(r#"{"a":4096}"#).is_err(), "JSON numbers must be refused");
    }
}
