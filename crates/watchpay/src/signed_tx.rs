//! Strict decoding of SIGNED legacy (EIP-155) and EIP-1559 transactions —
//! the untrusted-bridge-result parsing half of the Connect adapter.
//!
//! RLP framing is delegated to `alloy-rlp = 0.3` (`Header::decode` is
//! strict: non-canonical single bytes, non-canonical long sizes and
//! length-of-length prefixes are refused by the library itself). On top of
//! that this module enforces:
//! - **canonical re-encode equality**: every decoded transaction is
//!   re-encoded from its fields and must byte-equal the input — a whole-
//!   input canonicality proof that also catches trailing garbage inside or
//!   after the envelope;
//! - **minimal integer encodings** (`strict_uint`): leading zeros and
//!   oversized widths are field-named refusals;
//! - **replay protection**: legacy `v` must be the EIP-155 form
//!   (`2·chainId + 35 + recid`); the bare 27/28 pre-155 form is refused;
//! - **typed-transaction type discipline**: only `0x02` (EIP-1559) is
//!   accepted; `0x01` (access-list), `0x03` (blob), `0x04` (7702) and
//!   unknown types fail closed naming `tx_type` (via
//!   [`crate::tx::TxEnvelope::parse_type`] for the known set).
//!
//! Envelope layouts (published specifications EIP-155/2718/1559,
//! cross-checked against `@ethereumjs/tx 10.1.3` fixtures — see
//! `dev/gen-connect-fixtures/`):
//! - legacy signed: `rlp([nonce, gasPrice, gasLimit, to, value, data, v, r, s])`
//!   with signing preimage
//!   `keccak256(rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, '', '']))`;
//! - EIP-1559 signed: `0x02 ‖ rlp([chainId, nonce, maxPriorityFeePerGas,
//!   maxFeePerGas, gasLimit, to, value, data, accessList, yParity, r, s])`
//!   with signing preimage `keccak256(0x02 ‖ rlp([… first 9 fields]))`.
//!   The absent access list encodes as the empty LIST (0xc0), not the
//!   empty string.
//!
//! This module decodes and re-derives; it never binds to a plan (that is
//! [`crate::connect`]'s job) and never recovers the signer (that is
//! [`crate::eth`], invoked by the adapter).

use crate::abi::keccak256;
use crate::error::{Error, Result};
use crate::types::Atto;
use alloy_rlp::{Buf, BufMut, Encodable, Header};

/// Hard upper bound on a serialized transaction BEFORE any parsing. The
/// largest lawful payload here is a depth-12 batch (64 pools × 1056 bytes
/// ≈ 65.6 KiB of calldata); 128 KiB is generous headroom, and anything
/// larger is refused without a single RLP byte being examined.
pub const MAX_SERIALIZED_TX_BYTES: usize = 128 * 1024;

fn refuse(field: &'static str, reason: impl Into<String>) -> Error {
    Error::field(field, reason)
}

/// Pull the next item out of a list payload cursor: returns the item's
/// PAYLOAD slice and whether the item was a list. Header parsing and its
/// strictness (non-canonical single bytes, non-canonical sizes, length-of-
/// length rules, bounds) belong to alloy-rlp; this only slices and
/// advances. A short list is a field-named refusal (the "missing
/// signature components" class).
fn next_item<'a>(cursor: &mut &'a [u8], field: &'static str) -> Result<(&'a [u8], bool)> {
    if cursor.is_empty() {
        return Err(refuse(
            field,
            "list ended before this field — missing component",
        ));
    }
    let before = *cursor;
    let header =
        Header::decode(cursor).map_err(|e| refuse("serialized_tx", format!("RLP: {e}")))?;
    let header_len = before.len() - cursor.len();
    // Header::decode validated `cursor.remaining() >= payload_length`.
    let payload = &before[header_len..header_len + header.payload_length];
    cursor.advance(header.payload_length);
    Ok((payload, header.list))
}

/// Strict minimal big-endian RLP integer: empty = 0, no leading zeros,
/// bounded width. (The single-byte own-form rule is enforced by the
/// re-encode equality check.)
fn strict_uint(item: &[u8], field: &'static str, max_bytes: usize) -> Result<()> {
    if item.len() > max_bytes {
        return Err(refuse(
            field,
            format!(
                "integer encoding {} bytes exceeds the {}-byte width",
                item.len(),
                max_bytes
            ),
        ));
    }
    if item.len() > 1 && item[0] == 0 {
        return Err(refuse(
            field,
            "integer has a leading zero — non-minimal RLP encoding",
        ));
    }
    Ok(())
}

fn item_to_u64(item: &[u8], field: &'static str) -> Result<u64> {
    strict_uint(item, field, 8)?;
    let mut v: u64 = 0;
    for &b in item {
        v = v
            .checked_mul(256)
            .and_then(|x| x.checked_add(b as u64))
            .ok_or_else(|| refuse(field, "u64 overflow"))?;
    }
    Ok(v)
}

fn item_to_u256(item: &[u8], field: &'static str) -> Result<Atto> {
    strict_uint(item, field, 32)?;
    Ok(Atto(primitive_types::U256::from_big_endian(item)))
}

/// Left-pad a minimal integer item to 32 bytes (r/s scalars).
fn item_to_scalar(item: &[u8], field: &'static str) -> Result<[u8; 32]> {
    strict_uint(item, field, 32)?;
    if item.is_empty() {
        return Err(refuse(
            field,
            "zero-length scalar — signature component missing",
        ));
    }
    let mut out = [0u8; 32];
    out[32 - item.len()..].copy_from_slice(item);
    Ok(out)
}

fn item_to_addr(item: &[u8], field: &'static str) -> Result<crate::types::EthAddr> {
    if item.len() != 20 {
        return Err(refuse(
            field,
            format!("`to` must be exactly 20 bytes, got {}", item.len()),
        ));
    }
    let mut a = [0u8; 20];
    a.copy_from_slice(item);
    Ok(crate::types::EthAddr(a))
}

/// One term of a re-encoded envelope: a byte string, or the empty LIST
/// (0xc0) that EIP-1559's `accessList` carries when absent.
enum Term<'a> {
    Str(&'a [u8]),
    EmptyList,
}

impl Encodable for Term<'_> {
    fn encode(&self, out: &mut dyn BufMut) {
        match self {
            Term::Str(b) => b.encode(out),
            Term::EmptyList => Header {
                list: true,
                payload_length: 0,
            }
            .encode(out),
        }
    }
    fn length(&self) -> usize {
        match self {
            Term::Str(b) => b.length(),
            Term::EmptyList => 1,
        }
    }
}

fn encode_terms(terms: &[Term]) -> Vec<u8> {
    let mut out = Vec::with_capacity(alloy_rlp::list_length(terms));
    alloy_rlp::encode_list(terms, &mut out);
    out
}

fn str_terms<'a>(items: &[&'a [u8]]) -> Vec<Term<'a>> {
    items.iter().map(|b| Term::Str(b)).collect()
}

/// A strictly decoded SIGNED legacy (EIP-155) transaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacySignedTx {
    pub nonce: u64,
    pub gas_price_wei: u64,
    pub gas_limit: u64,
    pub to: crate::types::EthAddr,
    pub value_wei: Atto,
    pub data: Vec<u8>,
    /// EIP-155 v (2·chainId + 35 + recid); the pre-155 27/28 form is
    /// refused at decode.
    pub v: u64,
    pub chain_id: u64,
    pub recid: u8,
    pub r: [u8; 32],
    pub s: [u8; 32],
}

/// A strictly decoded SIGNED EIP-1559 transaction (empty access list only).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Eip1559SignedTx {
    pub chain_id: u64,
    pub nonce: u64,
    pub max_priority_fee_wei: u64,
    pub max_fee_per_gas_wei: u64,
    pub gas_limit: u64,
    pub to: crate::types::EthAddr,
    pub value_wei: Atto,
    pub data: Vec<u8>,
    pub y_parity: u8,
    pub r: [u8; 32],
    pub s: [u8; 32],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignedTx {
    Legacy(LegacySignedTx),
    Eip1559(Eip1559SignedTx),
}

impl SignedTx {
    /// Strict decode of a full signed transaction (legacy list or typed
    /// envelope). `bytes` is the raw payload WITHOUT any 0x prefix.
    pub fn decode_strict(bytes: &[u8]) -> Result<SignedTx> {
        if bytes.is_empty() {
            return Err(refuse("serialized_tx", "empty response body"));
        }
        if bytes.len() > MAX_SERIALIZED_TX_BYTES {
            return Err(refuse(
                "serialized_tx",
                format!(
                    "{} bytes exceeds the {} byte bound — refused before parsing",
                    bytes.len(),
                    MAX_SERIALIZED_TX_BYTES
                ),
            ));
        }
        match bytes[0] {
            // Legacy transactions start with a list header (0xc0..=0xff).
            0xc0..=0xff => Self::decode_legacy(bytes),
            // Typed envelopes: only EIP-1559 (0x02) is a lawful carrier for
            // these payments; the known-but-refused set names tx_type via
            // parse_type, anything else names it here.
            0x02 => Self::decode_1559(&bytes[1..], bytes),
            type_byte => {
                // Surface the library-shaped refusal for known types first.
                crate::tx::TxEnvelope::parse_type(type_byte)?;
                Err(refuse(
                    "tx_type",
                    format!(
                        "type byte 0x{type_byte:02x} is not a valid envelope start — legacy \
                         transactions begin with a list header, typed envelopes with their \
                         EIP-2718 type byte"
                    ),
                ))
            }
        }
    }

    fn decode_legacy(bytes: &[u8]) -> Result<SignedTx> {
        let mut outer = bytes;
        let payload = Header::decode_bytes(&mut outer, true)
            .map_err(|e| refuse("serialized_tx", format!("RLP: {e}")))?;
        if !outer.is_empty() {
            return Err(refuse(
                "serialized_tx",
                "trailing bytes after the legacy envelope",
            ));
        }
        let mut c = payload;
        let (f_nonce, _) = next_item(&mut c, "nonce")?;
        let (f_gas_price, _) = next_item(&mut c, "gasPrice")?;
        let (f_gas_limit, _) = next_item(&mut c, "gasLimit")?;
        let (f_to, _) = next_item(&mut c, "to")?;
        let (f_value, _) = next_item(&mut c, "value")?;
        let (f_data, _) = next_item(&mut c, "data")?;
        let (f_v, _) = next_item(&mut c, "v")?;
        let (f_r, _) = next_item(&mut c, "r")?;
        let (f_s, _) = next_item(&mut c, "s")?;
        if !c.is_empty() {
            return Err(refuse(
                "serialized_tx",
                "trailing items inside the envelope list",
            ));
        }
        let v = item_to_u64(f_v, "v")?;
        if v < 35 {
            return Err(refuse(
                "v",
                format!(
                    "legacy v = {v} carries no EIP-155 replay protection (27/28 pre-155 form) \
                     — refused"
                ),
            ));
        }
        let chain_id = (v - 35) / 2;
        let recid = ((v - 35) % 2) as u8;
        let tx = LegacySignedTx {
            nonce: item_to_u64(f_nonce, "nonce")?,
            gas_price_wei: item_to_u64(f_gas_price, "gasPrice")?,
            gas_limit: item_to_u64(f_gas_limit, "gasLimit")?,
            to: item_to_addr(f_to, "to")?,
            value_wei: item_to_u256(f_value, "value")?,
            data: f_data.to_vec(),
            v,
            chain_id,
            recid,
            r: item_to_scalar(f_r, "r")?,
            s: item_to_scalar(f_s, "s")?,
        };
        let re = Self::Legacy(tx.clone()).canonical_bytes();
        if re != bytes {
            return Err(refuse(
                "serialized_tx",
                "non-canonical encoding (re-encode differs from input)",
            ));
        }
        Ok(SignedTx::Legacy(tx))
    }

    fn decode_1559(after_type: &[u8], full: &[u8]) -> Result<SignedTx> {
        let mut outer = after_type;
        let payload = Header::decode_bytes(&mut outer, true)
            .map_err(|e| refuse("serialized_tx", format!("RLP: {e}")))?;
        if !outer.is_empty() {
            return Err(refuse(
                "serialized_tx",
                "trailing bytes after the typed envelope",
            ));
        }
        let mut c = payload;
        let (f_chain, _) = next_item(&mut c, "chainId")?;
        let (f_nonce, _) = next_item(&mut c, "nonce")?;
        let (f_priority, _) = next_item(&mut c, "maxPriorityFeePerGas")?;
        let (f_max_fee, _) = next_item(&mut c, "maxFeePerGas")?;
        let (f_gas_limit, _) = next_item(&mut c, "gasLimit")?;
        let (f_to, _) = next_item(&mut c, "to")?;
        let (f_value, _) = next_item(&mut c, "value")?;
        let (f_data, _) = next_item(&mut c, "data")?;
        let (f_access, f_access_is_list) = next_item(&mut c, "access_list")?;
        let (f_parity, _) = next_item(&mut c, "yParity")?;
        let (f_r, _) = next_item(&mut c, "r")?;
        let (f_s, _) = next_item(&mut c, "s")?;
        if !c.is_empty() {
            return Err(refuse(
                "serialized_tx",
                "trailing items inside the envelope list",
            ));
        }
        if !f_access_is_list || !f_access.is_empty() {
            return Err(refuse(
                "access_list",
                "non-empty access list — these payments never carry one (EIP-2930 data would be \
                 a different envelope and a different request)",
            ));
        }
        let y_parity = item_to_u64(f_parity, "yParity")?;
        if y_parity > 1 {
            return Err(refuse(
                "yParity",
                format!("yParity {y_parity} outside {{0,1}}"),
            ));
        }
        let tx = Eip1559SignedTx {
            chain_id: item_to_u64(f_chain, "chainId")?,
            nonce: item_to_u64(f_nonce, "nonce")?,
            max_priority_fee_wei: item_to_u64(f_priority, "maxPriorityFeePerGas")?,
            max_fee_per_gas_wei: item_to_u64(f_max_fee, "maxFeePerGas")?,
            gas_limit: item_to_u64(f_gas_limit, "gasLimit")?,
            to: item_to_addr(f_to, "to")?,
            value_wei: item_to_u256(f_value, "value")?,
            data: f_data.to_vec(),
            y_parity: y_parity as u8,
            r: item_to_scalar(f_r, "r")?,
            s: item_to_scalar(f_s, "s")?,
        };
        let re = Self::Eip1559(tx.clone()).canonical_bytes();
        if re != full {
            return Err(refuse(
                "serialized_tx",
                "non-canonical encoding (re-encode differs from input)",
            ));
        }
        Ok(SignedTx::Eip1559(tx))
    }

    /// Canonical re-encoding of the FULL signed form (what the transaction
    /// hash is taken over).
    pub fn canonical_bytes(&self) -> Vec<u8> {
        match self {
            SignedTx::Legacy(t) => {
                let (n, gp, gl, v) = (
                    uint_min(t.nonce),
                    uint_min(t.gas_price_wei),
                    uint_min(t.gas_limit),
                    uint_min(t.v),
                );
                let val = atto_min(&t.value_wei);
                let items: [&[u8]; 9] = [
                    &n,
                    &gp,
                    &gl,
                    t.to.as_bytes(),
                    &val,
                    &t.data,
                    &v,
                    &t.r[..],
                    &t.s[..],
                ];
                encode_terms(&str_terms(&items))
            }
            SignedTx::Eip1559(t) => {
                let (c, n, pf, mf, gl, yp) = (
                    uint_min(t.chain_id),
                    uint_min(t.nonce),
                    uint_min(t.max_priority_fee_wei),
                    uint_min(t.max_fee_per_gas_wei),
                    uint_min(t.gas_limit),
                    uint_min(t.y_parity as u64),
                );
                let val = atto_min(&t.value_wei);
                let mut terms = str_terms(&[&c, &n, &pf, &mf, &gl, t.to.as_bytes(), &val, &t.data]);
                terms.push(Term::EmptyList);
                terms.push(Term::Str(&yp));
                terms.push(Term::Str(&t.r[..]));
                terms.push(Term::Str(&t.s[..]));
                let mut out = Vec::with_capacity(1 + alloy_rlp::list_length(&terms));
                out.push(0x02);
                alloy_rlp::encode_list(&terms, &mut out);
                out
            }
        }
    }

    /// The preimage hash the signature was computed over (EIP-155 legacy
    /// hashing / EIP-1559 preimage). Computed LOCALLY, never accepted from
    /// the bridge.
    pub fn signing_hash(&self) -> [u8; 32] {
        match self {
            SignedTx::Legacy(t) => {
                let (n, gp, gl, c) = (
                    uint_min(t.nonce),
                    uint_min(t.gas_price_wei),
                    uint_min(t.gas_limit),
                    uint_min(t.chain_id),
                );
                let val = atto_min(&t.value_wei);
                let items: [&[u8]; 9] = [
                    &n,
                    &gp,
                    &gl,
                    t.to.as_bytes(),
                    &val,
                    &t.data,
                    &c,
                    &[], // r placeholder
                    &[], // s placeholder
                ];
                keccak256(&encode_terms(&str_terms(&items)))
            }
            SignedTx::Eip1559(t) => {
                let (c, n, pf, mf, gl) = (
                    uint_min(t.chain_id),
                    uint_min(t.nonce),
                    uint_min(t.max_priority_fee_wei),
                    uint_min(t.max_fee_per_gas_wei),
                    uint_min(t.gas_limit),
                );
                let val = atto_min(&t.value_wei);
                let mut terms = str_terms(&[&c, &n, &pf, &mf, &gl, t.to.as_bytes(), &val, &t.data]);
                terms.push(Term::EmptyList);
                let mut out = Vec::with_capacity(1 + alloy_rlp::list_length(&terms));
                out.push(0x02);
                alloy_rlp::encode_list(&terms, &mut out);
                keccak256(&out)
            }
        }
    }

    /// The transaction hash: keccak256 over the canonical signed form,
    /// computed locally.
    pub fn tx_hash(&self) -> crate::types::Hex32 {
        crate::types::Hex32(keccak256(&self.canonical_bytes()))
    }
}

/// Minimal big-endian bytes of a u64 (empty for zero).
fn uint_min(v: u64) -> Vec<u8> {
    if v == 0 {
        return Vec::new();
    }
    let be = v.to_be_bytes();
    let first = be.iter().position(|&b| b != 0).unwrap();
    be[first..].to_vec()
}

/// Minimal big-endian bytes of an Atto (empty for zero, ≤32 bytes).
fn atto_min(v: &Atto) -> Vec<u8> {
    let be = v.0.to_big_endian();
    let first = be.iter().position(|&b| b != 0).unwrap_or(32);
    be[first..].to_vec()
}
