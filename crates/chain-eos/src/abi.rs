//! Antelope contract-ABI decoder: binary action data → JSON.
//!
//! This closes the pipeline's last seam: `extract_actions()` produces raw
//! ABI-encoded bytes, this module turns them into the `serde_json::Value`
//! the normalizer consumes. Same philosophy as the SHIP codec: the type set
//! real marketplace contracts use is decoded completely; exotic types
//! (128-bit ints, keys/signatures, variants, binary extensions) return a
//! typed `Unsupported` error rather than a guess. A recognized action whose
//! bytes don't exactly fill its struct is an error (`TrailingBytes`) — a
//! wrong ABI must never silently mis-decode.
//!
//! Where the ABI itself comes from at runtime (chain `get_abi` RPC, or a
//! pinned file per contract) is part of the real-endpoint milestone; this
//! module takes ABI JSON as input.
//!
//! JSON number policy: u64/i64 decode to JSON numbers (serde_json holds
//! them losslessly — the normalizer reads them via `as_u64`/`as_i64`);
//! `time_point_sec` decodes to its integer seconds for the same reason.

use std::collections::HashMap;
use std::fmt;

use serde::Deserialize;
use serde_json::{Map, Number, Value};

use crate::{u64_to_name, DecodeError, Reader};

// ---------------------------------------------------------------------------
// ABI definition (the JSON shape contracts publish)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AbiDef {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub types: Vec<TypeAlias>,
    #[serde(default)]
    pub structs: Vec<StructDef>,
    #[serde(default)]
    pub actions: Vec<ActionDef>,
    // tables, variants, ricardian_clauses etc. are ignored on parse;
    // variant-typed fields fail at decode time with Unsupported.
}

#[derive(Debug, Deserialize)]
pub struct TypeAlias {
    pub new_type_name: String,
    #[serde(rename = "type")]
    pub type_: String,
}

#[derive(Debug, Deserialize)]
pub struct StructDef {
    pub name: String,
    #[serde(default)]
    pub base: String,
    #[serde(default)]
    pub fields: Vec<FieldDef>,
}

#[derive(Debug, Deserialize)]
pub struct FieldDef {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
}

#[derive(Debug, Deserialize)]
pub struct ActionDef {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
}

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AbiError {
    /// The ABI JSON itself failed to parse.
    BadAbiJson(String),
    /// The action name has no entry in the ABI's `actions`.
    UnknownAction(String),
    /// A field references a type that is neither built-in nor a struct.
    UnknownType(String),
    /// A type this decoder deliberately does not handle.
    Unsupported(String),
    /// The underlying byte reads failed (truncated data).
    Wire(DecodeError),
    /// Bytes remained after the action struct was fully decoded — the ABI
    /// does not match the data.
    TrailingBytes { remaining: usize },
}

impl fmt::Display for AbiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AbiError::BadAbiJson(e) => write!(f, "invalid ABI JSON: {e}"),
            AbiError::UnknownAction(a) => write!(f, "action `{a}` not in ABI"),
            AbiError::UnknownType(t) => write!(f, "type `{t}` not in ABI"),
            AbiError::Unsupported(t) => write!(f, "unsupported ABI type: {t}"),
            AbiError::Wire(e) => write!(f, "action data truncated: {e}"),
            AbiError::TrailingBytes { remaining } => {
                write!(f, "{remaining} trailing byte(s): ABI does not match data")
            }
        }
    }
}

impl std::error::Error for AbiError {}

impl From<DecodeError> for AbiError {
    fn from(e: DecodeError) -> Self {
        AbiError::Wire(e)
    }
}

// ---------------------------------------------------------------------------
// decoder
// ---------------------------------------------------------------------------

pub struct Abi {
    aliases: HashMap<String, String>,
    structs: HashMap<String, StructDef>,
    actions: HashMap<String, String>,
}

impl Abi {
    pub fn from_json(json: &str) -> Result<Self, AbiError> {
        let def: AbiDef =
            serde_json::from_str(json).map_err(|e| AbiError::BadAbiJson(e.to_string()))?;
        Ok(Abi {
            aliases: def
                .types
                .into_iter()
                .map(|t| (t.new_type_name, t.type_))
                .collect(),
            structs: def
                .structs
                .into_iter()
                .map(|s| (s.name.clone(), s))
                .collect(),
            actions: def.actions.into_iter().map(|a| (a.name, a.type_)).collect(),
        })
    }

    /// Decode one action's data. Strict: every byte must be consumed.
    pub fn decode_action(&self, action: &str, data: &[u8]) -> Result<Value, AbiError> {
        let ty = self
            .actions
            .get(action)
            .ok_or_else(|| AbiError::UnknownAction(action.to_string()))?
            .clone();
        let mut r = Reader::new(data);
        let value = self.decode_type(&ty, &mut r)?;
        let remaining = r.remaining();
        if remaining > 0 {
            return Err(AbiError::TrailingBytes { remaining });
        }
        Ok(value)
    }

    /// Follow `types` aliases to the underlying type name.
    fn resolve<'a>(&'a self, mut ty: &'a str) -> &'a str {
        // Alias chains are short; guard against cycles anyway.
        for _ in 0..16 {
            match self.aliases.get(ty) {
                Some(next) => ty = next,
                None => break,
            }
        }
        ty
    }

    fn decode_type(&self, ty: &str, r: &mut Reader) -> Result<Value, AbiError> {
        // Suffixes compose on the written type name, outermost last.
        if let Some(inner) = ty.strip_suffix("[]") {
            let count = r.varuint32()?;
            let mut items = Vec::with_capacity(count as usize);
            for _ in 0..count {
                items.push(self.decode_type(inner, r)?);
            }
            return Ok(Value::Array(items));
        }
        if let Some(inner) = ty.strip_suffix('?') {
            return match r.u8()? {
                0 => Ok(Value::Null),
                1 => self.decode_type(inner, r),
                b => Err(DecodeError::BadOptionalFlag(b).into()),
            };
        }
        if ty.ends_with('$') {
            return Err(AbiError::Unsupported("binary extension ($)".into()));
        }

        let ty = self.resolve(ty);
        if let Some(v) = self.decode_builtin(ty, r)? {
            return Ok(v);
        }
        match self.structs.get(ty) {
            Some(_) => self.decode_struct(ty, r),
            None => Err(AbiError::UnknownType(ty.to_string())),
        }
    }

    /// `Ok(None)` means "not a built-in — try structs".
    fn decode_builtin(&self, ty: &str, r: &mut Reader) -> Result<Option<Value>, AbiError> {
        let v = match ty {
            "bool" => Value::Bool(r.u8()? != 0),
            "uint8" => Value::Number(r.u8()?.into()),
            "int8" => Value::Number((r.u8()? as i8).into()),
            "uint16" => Value::Number(r.u16_le()?.into()),
            "int16" => Value::Number((r.u16_le()? as i16).into()),
            "varuint32" => Value::Number(r.varuint32()?.into()),
            "uint32" => Value::Number(r.u32_le()?.into()),
            "int32" => Value::Number((r.u32_le()? as i32).into()),
            "uint64" => Value::Number(r.u64_le()?.into()),
            "int64" => Value::Number((r.u64_le()? as i64).into()),
            "float32" => float_number(f64::from(f32::from_le_bytes(r.u32_le()?.to_le_bytes())))?,
            "float64" => float_number(f64::from_le_bytes(r.u64_le()?.to_le_bytes()))?,
            "name" => Value::String(u64_to_name(r.u64_le()?)),
            "string" => {
                let bytes = r.length_prefixed()?;
                match std::str::from_utf8(bytes) {
                    Ok(s) => Value::String(s.to_string()),
                    Err(_) => return Err(AbiError::Unsupported("non-utf8 string".into())),
                }
            }
            "bytes" => Value::String(crate::to_hex(r.length_prefixed()?)),
            "checksum160" => Value::String(crate::to_hex(r.take_n(20)?)),
            "checksum256" => Value::String(crate::to_hex(r.take_n(32)?)),
            "checksum512" => Value::String(crate::to_hex(r.take_n(64)?)),
            // Integer seconds/slots so the normalizer reads them as numbers.
            "time_point_sec" => Value::Number(r.u32_le()?.into()),
            "time_point" => Value::Number((r.u64_le()? as i64).into()),
            "block_timestamp_type" => Value::Number(r.u32_le()?.into()),
            "symbol_code" => Value::String(symbol_code_string(r.u64_le()?)),
            "symbol" => {
                let raw = r.u64_le()?;
                Value::String(format!("{},{}", raw & 0xff, symbol_code_string(raw >> 8)))
            }
            "asset" => {
                let amount = r.u64_le()? as i64;
                let raw_symbol = r.u64_le()?;
                Value::String(format_asset(amount, raw_symbol))
            }
            "uint128" | "int128" | "varint32" | "float128" | "public_key" | "signature" => {
                return Err(AbiError::Unsupported(ty.to_string()))
            }
            _ => return Ok(None),
        };
        Ok(Some(v))
    }

    fn decode_struct(&self, name: &str, r: &mut Reader) -> Result<Value, AbiError> {
        // Own the field list up front to avoid borrowing self across the
        // recursive calls.
        let (base, fields): (String, Vec<(String, String)>) = {
            let s = self
                .structs
                .get(name)
                .ok_or_else(|| AbiError::UnknownType(name.to_string()))?;
            (
                s.base.clone(),
                s.fields
                    .iter()
                    .map(|f| (f.name.clone(), f.type_.clone()))
                    .collect(),
            )
        };

        let mut map = Map::new();
        if !base.is_empty() {
            match self.decode_struct(self.resolve(&base), r)? {
                Value::Object(base_map) => map.extend(base_map),
                _ => return Err(AbiError::UnknownType(base)),
            }
        }
        for (fname, fty) in fields {
            let v = self.decode_type(&fty, r)?;
            map.insert(fname, v);
        }
        Ok(Value::Object(map))
    }
}

fn float_number(v: f64) -> Result<Value, AbiError> {
    Number::from_f64(v)
        .map(Value::Number)
        .ok_or_else(|| AbiError::Unsupported("non-finite float".into()))
}

/// symbol_code: up to 7 uppercase chars packed LSB-first, zero-terminated.
fn symbol_code_string(mut v: u64) -> String {
    let mut s = String::new();
    for _ in 0..7 {
        let c = (v & 0xff) as u8;
        if c == 0 {
            break;
        }
        s.push(c as char);
        v >>= 8;
    }
    s
}

/// Standard asset rendering: amount scaled by symbol precision, e.g.
/// `(12345, "4,FUSD")` → `"1.2345 FUSD"`.
fn format_asset(amount: i64, raw_symbol: u64) -> String {
    let precision = (raw_symbol & 0xff) as u32;
    let code = symbol_code_string(raw_symbol >> 8);
    let sign = if amount < 0 { "-" } else { "" };
    let abs = amount.unsigned_abs();
    let scale = 10u64.pow(precision);
    if precision == 0 {
        return format!("{sign}{abs} {code}");
    }
    format!(
        "{sign}{}.{:0width$} {code}",
        abs / scale,
        abs % scale,
        width = precision as usize
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::name_to_u64;

    /// A plausible lovismarket ABI aligned with the §9.3 mapping fields.
    const LOVISMARKET_ABI: &str = r#"{
        "version": "eosio::abi/1.2",
        "types": [{"new_type_name": "did", "type": "string"}],
        "structs": [
            {"name": "listing_base", "base": "", "fields": [
                {"name": "listing_id", "type": "string"}
            ]},
            {"name": "addlisting", "base": "listing_base", "fields": [
                {"name": "seller_did", "type": "did"},
                {"name": "seller_account", "type": "name"},
                {"name": "category", "type": "string?"},
                {"name": "title", "type": "string?"},
                {"name": "amount", "type": "uint64"},
                {"name": "asset_id", "type": "string"},
                {"name": "timestamp", "type": "time_point_sec"},
                {"name": "tags", "type": "string[]"},
                {"name": "price", "type": "asset"}
            ]}
        ],
        "actions": [{"name": "addlisting", "type": "addlisting"}]
    }"#;

    fn put_varuint32(out: &mut Vec<u8>, mut v: u32) {
        loop {
            let mut b = (v & 0x7f) as u8;
            v >>= 7;
            if v != 0 {
                b |= 0x80;
            }
            out.push(b);
            if v == 0 {
                break;
            }
        }
    }

    fn put_string(out: &mut Vec<u8>, s: &str) {
        put_varuint32(out, s.len() as u32);
        out.extend_from_slice(s.as_bytes());
    }

    fn symbol_raw(precision: u8, code: &str) -> u64 {
        let mut v = 0u64;
        for (i, c) in code.bytes().enumerate() {
            v |= u64::from(c) << (8 * (i + 1));
        }
        v | u64::from(precision)
    }

    /// Binary addlisting payload matching LOVISMARKET_ABI field order.
    fn encode_addlisting(category: Option<&str>) -> Vec<u8> {
        let mut d = Vec::new();
        put_string(&mut d, "listing-42"); // listing_id (base struct)
        put_string(&mut d, "did:plc:seller"); // seller_did (via alias)
        d.extend_from_slice(&name_to_u64("sellerseller").unwrap().to_le_bytes());
        match category {
            Some(c) => {
                d.push(1);
                put_string(&mut d, c);
            }
            None => d.push(0),
        }
        d.push(0); // title: absent
        d.extend_from_slice(&5_000_000u64.to_le_bytes()); // amount
        put_string(&mut d, "fusd-asset-id"); // asset_id
        d.extend_from_slice(&1_782_000_000u32.to_le_bytes()); // timestamp
        put_varuint32(&mut d, 2); // tags[]
        put_string(&mut d, "hemp");
        put_string(&mut d, "seeds");
        d.extend_from_slice(&12_345i64.to_le_bytes()); // price amount
        d.extend_from_slice(&symbol_raw(4, "FUSD").to_le_bytes());
        d
    }

    #[test]
    fn decodes_addlisting_with_alias_base_optional_array_and_asset() {
        let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
        let v = abi
            .decode_action("addlisting", &encode_addlisting(Some("hemp-seeds")))
            .unwrap();

        assert_eq!(v["listing_id"], "listing-42"); // from the base struct
        assert_eq!(v["seller_did"], "did:plc:seller"); // through the alias
        assert_eq!(v["seller_account"], "sellerseller");
        assert_eq!(v["category"], "hemp-seeds");
        assert_eq!(v["title"], Value::Null); // absent optional
        assert_eq!(v["amount"].as_u64(), Some(5_000_000));
        assert_eq!(v["asset_id"], "fusd-asset-id");
        assert_eq!(v["timestamp"].as_i64(), Some(1_782_000_000));
        assert_eq!(v["tags"], serde_json::json!(["hemp", "seeds"]));
        assert_eq!(v["price"], "1.2345 FUSD");
    }

    #[test]
    fn absent_optional_decodes_to_null() {
        let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
        let v = abi
            .decode_action("addlisting", &encode_addlisting(None))
            .unwrap();
        assert_eq!(v["category"], Value::Null);
    }

    #[test]
    fn unknown_action_is_an_error() {
        let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
        assert_eq!(
            abi.decode_action("dellisting", &[]),
            Err(AbiError::UnknownAction("dellisting".into()))
        );
    }

    #[test]
    fn trailing_bytes_mean_the_abi_does_not_match() {
        let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
        let mut data = encode_addlisting(Some("x"));
        data.push(0xFF);
        assert_eq!(
            abi.decode_action("addlisting", &data),
            Err(AbiError::TrailingBytes { remaining: 1 })
        );
    }

    #[test]
    fn truncated_data_is_a_wire_error_not_a_panic() {
        let abi = Abi::from_json(LOVISMARKET_ABI).unwrap();
        let data = encode_addlisting(Some("x"));
        let err = abi.decode_action("addlisting", &data[..data.len() - 4]);
        assert!(matches!(err, Err(AbiError::Wire(_))), "got {err:?}");
    }

    #[test]
    fn unsupported_types_are_typed_errors() {
        let abi = Abi::from_json(
            r#"{"structs":[{"name":"a","base":"","fields":[{"name":"k","type":"public_key"}]}],
                "actions":[{"name":"a","type":"a"}]}"#,
        )
        .unwrap();
        assert_eq!(
            abi.decode_action("a", &[0u8; 34]),
            Err(AbiError::Unsupported("public_key".into()))
        );
    }

    #[test]
    fn unknown_field_type_is_an_error() {
        let abi = Abi::from_json(
            r#"{"structs":[{"name":"a","base":"","fields":[{"name":"x","type":"mystery"}]}],
                "actions":[{"name":"a","type":"a"}]}"#,
        )
        .unwrap();
        assert_eq!(
            abi.decode_action("a", &[1, 2, 3]),
            Err(AbiError::UnknownType("mystery".into()))
        );
    }

    #[test]
    fn asset_and_symbol_render_standard_forms() {
        assert_eq!(format_asset(12_345, symbol_raw(4, "FUSD")), "1.2345 FUSD");
        assert_eq!(format_asset(-500, symbol_raw(2, "USD")), "-5.00 USD");
        assert_eq!(format_asset(7, symbol_raw(0, "ITEM")), "7 ITEM");
        assert_eq!(symbol_code_string(symbol_raw(4, "FUSD") >> 8), "FUSD");
    }
}
