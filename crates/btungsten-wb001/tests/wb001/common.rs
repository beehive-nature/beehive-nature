//! Shared test support: a minimal JSON reader that keeps strings as UTF-16
//! code units (the pinned vectors carry lone surrogates on purpose, which no
//! UTF-8 JSON library can hold), the battery's base intent, and helpers.

use btungsten_wb001::{IntentIn, Text};

pub const VECTORS: &str = include_str!("../../../../scripts/btungsten/wb001-vectors.json");
pub const BRIDGE: &str = include_str!("../../../../scripts/btungsten/wb001-bridge.json");
pub const ORACLE: &str = include_str!("../../../../scripts/btungsten/wb001-ed25519-oracle.json");
pub const INTENT_CRY: &str =
    include_str!("../../../../scripts/btungsten/wb001-cryptol/BTungstenWB001.cry");

#[derive(Clone, Debug)]
pub enum J {
    Null,
    Bool,
    Num(String),
    Str(Vec<u16>),
    Arr(Vec<J>),
    Obj(Vec<(String, J)>),
}

impl J {
    pub fn get(&self, k: &str) -> Option<&J> {
        match self {
            J::Obj(m) => m.iter().find(|(key, _)| key == k).map(|(_, v)| v),
            _ => None,
        }
    }
    pub fn at(&self, k: &str) -> &J {
        self.get(k).unwrap_or_else(|| panic!("missing key {k}"))
    }
    pub fn arr(&self) -> &[J] {
        match self {
            J::Arr(a) => a,
            other => panic!("not an array: {other:?}"),
        }
    }
    pub fn utf16(&self) -> &[u16] {
        match self {
            J::Str(s) => s,
            other => panic!("not a string: {other:?}"),
        }
    }
    pub fn s(&self) -> String {
        String::from_utf16(self.utf16()).expect("well-formed string expected here")
    }
    pub fn n(&self) -> u64 {
        match self {
            J::Num(n) => n.parse().expect("integer"),
            J::Str(_) => self.s().parse().expect("integer in a string"),
            other => panic!("not a number: {other:?}"),
        }
    }
}

pub fn parse(src: &str) -> J {
    let b = src.as_bytes();
    let mut i = 0;
    let v = value(b, &mut i);
    ws(b, &mut i);
    assert_eq!(i, b.len(), "trailing JSON");
    v
}

fn ws(b: &[u8], i: &mut usize) {
    while *i < b.len() && b[*i].is_ascii_whitespace() {
        *i += 1;
    }
}

fn value(b: &[u8], i: &mut usize) -> J {
    ws(b, i);
    match b[*i] {
        b'{' => {
            *i += 1;
            let mut m = Vec::new();
            ws(b, i);
            if b[*i] == b'}' {
                *i += 1;
                return J::Obj(m);
            }
            loop {
                ws(b, i);
                let k = match value(b, i) {
                    J::Str(s) => String::from_utf16(&s).expect("ASCII keys"),
                    _ => panic!("object key"),
                };
                ws(b, i);
                assert_eq!(b[*i], b':');
                *i += 1;
                let v = value(b, i);
                m.push((k, v));
                ws(b, i);
                match b[*i] {
                    b',' => *i += 1,
                    b'}' => {
                        *i += 1;
                        return J::Obj(m);
                    }
                    c => panic!("object: unexpected {}", c as char),
                }
            }
        }
        b'[' => {
            *i += 1;
            let mut a = Vec::new();
            ws(b, i);
            if b[*i] == b']' {
                *i += 1;
                return J::Arr(a);
            }
            loop {
                a.push(value(b, i));
                ws(b, i);
                match b[*i] {
                    b',' => *i += 1,
                    b']' => {
                        *i += 1;
                        return J::Arr(a);
                    }
                    c => panic!("array: unexpected {}", c as char),
                }
            }
        }
        b'"' => {
            *i += 1;
            let mut out: Vec<u16> = Vec::new();
            loop {
                let c = b[*i];
                if c == b'"' {
                    *i += 1;
                    return J::Str(out);
                }
                if c == b'\\' {
                    let e = b[*i + 1];
                    *i += 2;
                    match e {
                        b'"' => out.push(0x22),
                        b'\\' => out.push(0x5c),
                        b'/' => out.push(0x2f),
                        b'b' => out.push(0x08),
                        b'f' => out.push(0x0c),
                        b'n' => out.push(0x0a),
                        b'r' => out.push(0x0d),
                        b't' => out.push(0x09),
                        b'u' => {
                            let h = std::str::from_utf8(&b[*i..*i + 4]).unwrap();
                            out.push(u16::from_str_radix(h, 16).unwrap());
                            *i += 4;
                        }
                        _ => panic!("bad escape"),
                    }
                    continue;
                }
                // a raw UTF-8 sequence: decode one char, emit its UTF-16 units
                let s = std::str::from_utf8(&b[*i..])
                    .unwrap_or_else(|e| std::str::from_utf8(&b[*i..*i + e.valid_up_to()]).unwrap());
                let ch = s.chars().next().unwrap();
                let mut buf = [0u16; 2];
                out.extend_from_slice(ch.encode_utf16(&mut buf));
                *i += ch.len_utf8();
            }
        }
        b't' => {
            *i += 4;
            J::Bool
        }
        b'f' => {
            *i += 5;
            J::Bool
        }
        b'n' => {
            *i += 4;
            J::Null
        }
        _ => {
            let st = *i;
            while *i < b.len()
                && (b[*i] == b'-'
                    || b[*i] == b'.'
                    || b[*i] == b'e'
                    || b[*i] == b'E'
                    || b[*i] == b'+'
                    || b[*i].is_ascii_digit())
            {
                *i += 1;
            }
            J::Num(std::str::from_utf8(&b[st..*i]).unwrap().to_string())
        }
    }
}

pub fn hex(s: &str) -> Vec<u8> {
    assert!(s.len().is_multiple_of(2), "odd hex");
    (0..s.len())
        .step_by(2)
        .map(|k| u8::from_str_radix(&s[k..k + 2], 16).expect("hex"))
        .collect()
}

pub fn to_hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// JS `b32(seed)`: the first 24 bytes of the seed text, zero-padded to 32.
pub fn b32(seed: &str) -> Vec<u8> {
    let mut v = vec![0u8; 32];
    let s = &seed.as_bytes()[..seed.len().min(24)];
    v[..s.len()].copy_from_slice(s);
    v
}

pub fn t(s: &str) -> Text {
    Text::Str(s.to_string())
}

/// JS-style string literal with possible lone surrogates.
pub fn t16(units: &[u16]) -> Text {
    Text::Utf16(units.to_vec())
}

pub fn base() -> IntentIn {
    IntentIn {
        domain: t("skaists.bpay/1"),
        nonce: b32("nonce-wb001"),
        epoch: 1,
        action: b32("action-hash-01"),
        destination: t("vault:0xBEEF"),
        capability: t("pay"),
        amount: 1_000_000,
        expiry: 1_790_000_000,
        payer: t("seat:bFUzZ"),
        payload: br#"{"upload_id":"up-1"}"#.to_vec(),
    }
}

/// A JSON-safe intent row (vectors, bridge) back to an `IntentIn`.
pub fn intent_of(row: &J) -> IntentIn {
    IntentIn {
        domain: t16(row.at("domain").utf16()),
        nonce: hex(&row.at("nonce").s()),
        epoch: row.at("epoch").n(),
        action: hex(&row.at("action").s()),
        destination: t16(row.at("destination").utf16()),
        capability: t16(row.at("capability").utf16()),
        amount: row.at("amount").n(),
        expiry: row.at("expiry").n(),
        payer: t16(row.at("payer").utf16()),
        payload: hex(&row.at("payload").s()),
    }
}

/// Deterministic test seeds: the battery's keys are made in-process, like
/// the JS battery's, but reproducibly.
pub fn seed(n: u8) -> [u8; 32] {
    let mut s = [0u8; 32];
    for (k, b) in s.iter_mut().enumerate() {
        *b = n.wrapping_mul(31).wrapping_add(k as u8).wrapping_mul(97) ^ 0x5a;
    }
    s
}

/// xorshift64*: a reproducible generator for the randomized legs.
pub struct Rng(pub u64);
impl Rng {
    pub fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }
    pub fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}
