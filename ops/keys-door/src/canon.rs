//! Canonical JSON (contract §1): printable ASCII only, object keys sorted
//! bytewise at every level, no insignificant whitespace, no trailing newline,
//! integers in plain decimal, no floats. A record is accepted only if its
//! bytes equal the canonical re-serialization of its own parse, so every
//! alternative spelling of the same value (escapes, `1.0`, `01`, reordered
//! keys, spaces) is refused rather than normalized.
//!
//! The parse is serde_json's tokenizer driven by a visitor of our own, so a
//! duplicate key is refused by name instead of last-one-wins.

use std::collections::BTreeMap;
use std::fmt;

use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    Null,
    Bool(bool),
    Int(u64),
    Str(String),
    Arr(Vec<Value>),
    Obj(BTreeMap<String, Value>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CanonError {
    /// a byte outside 0x20..=0x7e (non-ASCII, a control byte, a newline)
    NotPrintableAscii,
    DuplicateKey(String),
    /// any other parse failure: floats, negative numbers, bad JSON
    Malformed(String),
    /// parses, but is not byte-for-byte its own canonical form
    NonCanonical,
}

impl fmt::Display for CanonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CanonError::NotPrintableAscii => f.write_str("not printable ASCII"),
            CanonError::DuplicateKey(k) => write!(f, "duplicate key {k:?}"),
            CanonError::Malformed(m) => write!(f, "malformed JSON: {m}"),
            CanonError::NonCanonical => f.write_str("not in canonical form"),
        }
    }
}

const DUP: &str = "duplicate key ";

impl<'de> Deserialize<'de> for Value {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_any(ValueVisitor)
    }
}

struct ValueVisitor;

impl<'de> Visitor<'de> for ValueVisitor {
    type Value = Value;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a JSON value with integer numbers only")
    }
    fn visit_unit<E>(self) -> Result<Value, E> {
        Ok(Value::Null)
    }
    fn visit_bool<E>(self, b: bool) -> Result<Value, E> {
        Ok(Value::Bool(b))
    }
    fn visit_u64<E>(self, n: u64) -> Result<Value, E> {
        Ok(Value::Int(n))
    }
    fn visit_i64<E: de::Error>(self, _: i64) -> Result<Value, E> {
        Err(E::custom("negative number"))
    }
    fn visit_f64<E: de::Error>(self, _: f64) -> Result<Value, E> {
        Err(E::custom("not an integer"))
    }
    fn visit_str<E>(self, s: &str) -> Result<Value, E> {
        Ok(Value::Str(s.to_owned()))
    }
    fn visit_string<E>(self, s: String) -> Result<Value, E> {
        Ok(Value::Str(s))
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
        let mut v = Vec::new();
        while let Some(x) = a.next_element()? {
            v.push(x);
        }
        Ok(Value::Arr(v))
    }
    fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
        let mut m = BTreeMap::new();
        while let Some(k) = a.next_key::<String>()? {
            if m.contains_key(&k) {
                return Err(de::Error::custom(format!("{DUP}{k:?}")));
            }
            let v = a.next_value()?;
            m.insert(k, v);
        }
        Ok(Value::Obj(m))
    }
}

/// Parse JSON with duplicate keys refused and integers only. Says nothing
/// about canonical form (envelopes are parsed this way; records go through
/// [`check`]).
pub fn parse(bytes: &[u8]) -> Result<Value, CanonError> {
    serde_json::from_slice::<Value>(bytes).map_err(|e| {
        let m = e.to_string();
        match m.strip_prefix(DUP) {
            Some(rest) => {
                CanonError::DuplicateKey(rest.split(" at line").next().unwrap_or(rest).into())
            }
            None => CanonError::Malformed(m),
        }
    })
}

fn write_str(s: &str, out: &mut Vec<u8>) -> Result<(), CanonError> {
    out.push(b'"');
    for b in s.bytes() {
        if !(0x20..=0x7e).contains(&b) {
            return Err(CanonError::NotPrintableAscii);
        }
        if b == b'"' || b == b'\\' {
            out.push(b'\\');
        }
        out.push(b);
    }
    out.push(b'"');
    Ok(())
}

fn write(v: &Value, out: &mut Vec<u8>) -> Result<(), CanonError> {
    match v {
        Value::Null => out.extend_from_slice(b"null"),
        Value::Bool(b) => out.extend_from_slice(if *b { b"true" } else { b"false" }),
        Value::Int(n) => out.extend_from_slice(n.to_string().as_bytes()),
        Value::Str(s) => write_str(s, out)?,
        Value::Arr(a) => {
            out.push(b'[');
            for (i, x) in a.iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                write(x, out)?;
            }
            out.push(b']');
        }
        Value::Obj(m) => {
            // BTreeMap<String, _> iterates in str order, which is bytewise
            out.push(b'{');
            for (i, (k, x)) in m.iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                write_str(k, out)?;
                out.push(b':');
                write(x, out)?;
            }
            out.push(b'}');
        }
    }
    Ok(())
}

/// The canonical bytes of a value.
pub fn to_bytes(v: &Value) -> Result<Vec<u8>, CanonError> {
    let mut out = Vec::new();
    write(v, &mut out)?;
    Ok(out)
}

/// A serde_json value (from a typed struct's serialization) as a canonical
/// value. Numbers must be non-negative integers.
pub fn from_json(v: &serde_json::Value) -> Result<Value, CanonError> {
    Ok(match v {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => Value::Int(
            n.as_u64()
                .ok_or_else(|| CanonError::Malformed("not a non-negative integer".into()))?,
        ),
        serde_json::Value::String(s) => Value::Str(s.clone()),
        serde_json::Value::Array(a) => {
            Value::Arr(a.iter().map(from_json).collect::<Result<_, _>>()?)
        }
        serde_json::Value::Object(m) => Value::Obj(
            m.iter()
                .map(|(k, x)| Ok((k.clone(), from_json(x)?)))
                .collect::<Result<_, CanonError>>()?,
        ),
    })
}

/// The whole §1 byte rule: printable ASCII, no duplicate key, integers only,
/// and the bytes are exactly the canonical re-serialization of their parse.
pub fn check(bytes: &[u8]) -> Result<Value, CanonError> {
    if !bytes.iter().all(|b| (0x20..=0x7e).contains(b)) {
        return Err(CanonError::NotPrintableAscii);
    }
    let v = parse(bytes)?;
    if to_bytes(&v)? != bytes {
        return Err(CanonError::NonCanonical);
    }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_canonical_spelling_passes() {
        assert!(check(br#"{"a":[1,"x",null,true],"b":{"c":0}}"#).is_ok());
        for bad in [
            &br#"{"b":1,"a":2}"#[..],
            br#"{"a": 1}"#,
            br#"{"a":1}
"#,
            br#"{"a":1.0}"#,
            br#"{"a":1e0}"#,
            br#"{"a":01}"#,
            br#"{"a":-1}"#,
            br#"{"a":"\/"}"#,
            br#"{"a":"\u0041"}"#,
            " {\"a\":1}".as_bytes(),
            "{\"a\":\"\u{e9}\"}".as_bytes(),
        ] {
            assert!(check(bad).is_err(), "{}", String::from_utf8_lossy(bad));
        }
        assert_eq!(
            check(br#"{"a":1,"a":1}"#),
            Err(CanonError::DuplicateKey("\"a\"".into()))
        );
        assert_eq!(check(br#"{"a":1,"b":2}"#).map(|_| ()), Ok(()));
        assert_eq!(check(br#"{"b":1,"a":2}"#), Err(CanonError::NonCanonical));
    }
}
