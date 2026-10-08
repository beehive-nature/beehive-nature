//! Canonical values, the commitment hash, and the anchored event log.

use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// A canonical value: what an event field or a state commitment is built of.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Val {
    Null,
    Bool(bool),
    Int(u128),
    Str(String),
    Arr(Vec<Val>),
    Obj(BTreeMap<String, Val>),
}

impl From<&str> for Val {
    fn from(s: &str) -> Val {
        Val::Str(s.to_string())
    }
}
impl From<String> for Val {
    fn from(s: String) -> Val {
        Val::Str(s)
    }
}
impl From<&String> for Val {
    fn from(s: &String) -> Val {
        Val::Str(s.clone())
    }
}
impl From<u64> for Val {
    fn from(n: u64) -> Val {
        Val::Int(n as u128)
    }
}
impl From<u128> for Val {
    fn from(n: u128) -> Val {
        Val::Int(n)
    }
}
impl From<bool> for Val {
    fn from(b: bool) -> Val {
        Val::Bool(b)
    }
}
impl<T: Into<Val>> From<Option<T>> for Val {
    fn from(o: Option<T>) -> Val {
        o.map_or(Val::Null, Into::into)
    }
}

impl Val {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Val::Str(s) => Some(s),
            _ => None,
        }
    }
    pub fn as_int(&self) -> Option<u128> {
        match self {
            Val::Int(n) => Some(*n),
            _ => None,
        }
    }
    pub fn get(&self, k: &str) -> Option<&Val> {
        match self {
            Val::Obj(m) => m.get(k),
            _ => None,
        }
    }
}

fn quote(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// Canonical serialization: sorted keys (BTreeMap order), no whitespace.
/// Deterministic by construction; sha256 over it is the commitment idiom.
pub fn canon(v: &Val) -> String {
    let mut out = String::new();
    canon_into(v, &mut out);
    out
}

fn canon_into(v: &Val, out: &mut String) {
    match v {
        Val::Null => out.push_str("null"),
        Val::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Val::Int(n) => out.push_str(&n.to_string()),
        Val::Str(s) => quote(s, out),
        Val::Arr(a) => {
            out.push('[');
            for (i, x) in a.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                canon_into(x, out);
            }
            out.push(']');
        }
        Val::Obj(m) => {
            out.push('{');
            for (i, (k, x)) in m.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                quote(k, out);
                out.push(':');
                canon_into(x, out);
            }
            out.push('}');
        }
    }
}

pub fn sha(s: &str) -> String {
    let d = Sha256::digest(s.as_bytes());
    d.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn genesis() -> String {
    sha("bT-WB02:genesis")
}

/// One anchored event: its sequence number, its fields (including `type`),
/// and its root = sha(prev_root | canon({seq, ...fields})).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Event {
    pub seq: u64,
    pub fields: BTreeMap<String, Val>,
    pub root: String,
}

impl Event {
    pub fn ty(&self) -> &str {
        self.fields.get("type").and_then(Val::as_str).unwrap_or("")
    }
    pub fn str(&self, k: &str) -> Option<&str> {
        self.fields.get(k).and_then(Val::as_str)
    }
    pub fn int(&self, k: &str) -> Option<u128> {
        self.fields.get(k).and_then(Val::as_int)
    }
    pub fn id(&self, k: &str) -> Option<u64> {
        self.int(k).map(|n| n as u64)
    }
    /// The hashed body: the fields plus `seq`.
    pub fn body(&self) -> String {
        let mut m = self.fields.clone();
        m.insert("seq".into(), Val::from(self.seq));
        canon(&Val::Obj(m))
    }
    /// The root this event SHOULD carry over `prev_root`.
    pub fn root_over(&self, prev_root: &str) -> String {
        sha(&format!("{prev_root}|{}", self.body()))
    }
}

/// Build an event-field map: `fields![("type", "move"), ("assetid", id)]`.
#[macro_export]
macro_rules! fields {
    ($(($k:expr, $v:expr)),* $(,)?) => {{
        let mut m = std::collections::BTreeMap::<String, $crate::log::Val>::new();
        $( m.insert($k.to_string(), $crate::log::Val::from($v)); )*
        m
    }};
}
