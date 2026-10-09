//! The inputs RB04 compares the parsers on.
//!
//! - [`vectors`]: the pinned WB001 vectors (`scripts/btungsten/wb001-vectors.json`
//!   positives and envelope refusals, `wb001-bridge.json` terms), each with
//!   its pinned answer, and constructed boundary inputs whose answer follows
//!   from their construction (every field at and past its bounds, every
//!   UTF-8 boundary class in every text field, every truncation of the base
//!   envelope, header, tag-order and trailing-byte faults).
//! - [`sampled`]: seeded adversarial inputs: random valid envelopes and
//!   mutations of them (bit flips, byte substitutions, truncation, appended,
//!   inserted and deleted bytes, rewritten length words, framed fields at
//!   their bounds, framed malformed UTF-8, tag faults, header faults,
//!   splices), and random bytes. The same seed gives the same inputs.
//!
//! Envelopes are built here by a plain tag-length-value writer ([`raw`]),
//! not by BNR's encoder, so malformed ones can be built too; for valid
//! fields the two produce the same bytes (tested).

use serde_json::Value;

use crate::Decoded;

pub const HEAD: [u8; 8] = *b"bT-WB01\x01";

/// (tag, min length, max length, text?) per block, in wire order.
pub const BLOCKS: [(u8, u32, u32, bool); 10] = [
    (0x01, 1, 64, true),
    (0x02, 32, 32, false),
    (0x03, 8, 8, false),
    (0x04, 32, 32, false),
    (0x05, 1, 128, true),
    (0x06, 1, 64, true),
    (0x07, 8, 8, false),
    (0x08, 8, 8, false),
    (0x09, 1, 128, true),
    (0x0a, 0, 4096, false),
];

/// What BNR must answer for an input, where it is known.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Expect {
    /// Accepted, with these values where they are known.
    Accept(Option<Decoded>),
    Refuse(&'static str),
}

#[derive(Clone, Debug)]
pub struct Case {
    pub input: Vec<u8>,
    pub kind: &'static str,
    pub expect: Option<Expect>,
}

/// splitmix64: small, fast, and the same everywhere.
pub struct Rng(pub u64);

impl Rng {
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }
    pub fn below(&mut self, n: u64) -> u64 {
        if n == 0 { 0 } else { self.next() % n }
    }
    pub fn range(&mut self, lo: u64, hi: u64) -> u64 {
        lo + self.below(hi - lo + 1)
    }
    pub fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        &xs[self.below(xs.len() as u64) as usize]
    }
    pub fn bytes(&mut self, n: usize) -> Vec<u8> {
        (0..n).map(|_| self.next() as u8).collect()
    }
}

/// The ten (tag, value) blocks of an envelope's fields.
pub fn blocks(d: &Decoded) -> Vec<(u8, Vec<u8>)> {
    vec![
        (0x01, d.domain.clone()),
        (0x02, d.nonce.clone()),
        (0x03, d.epoch.to_be_bytes().to_vec()),
        (0x04, d.action.clone()),
        (0x05, d.destination.clone()),
        (0x06, d.capability.clone()),
        (0x07, d.amount.to_be_bytes().to_vec()),
        (0x08, d.expiry.to_be_bytes().to_vec()),
        (0x09, d.payer.clone()),
        (0x0a, d.payload.clone()),
    ]
}

/// Header and blocks, each block's length word its true length.
pub fn raw_blocks(bs: &[(u8, Vec<u8>)]) -> Vec<u8> {
    let mut out = HEAD.to_vec();
    for (t, v) in bs {
        out.push(*t);
        out.extend_from_slice(&(v.len() as u32).to_be_bytes());
        out.extend_from_slice(v);
    }
    out
}

pub fn raw(d: &Decoded) -> Vec<u8> {
    raw_blocks(&blocks(d))
}

/// Byte offset of block `i`'s tag in `raw(d)`.
pub fn block_offset(d: &Decoded, i: usize) -> usize {
    8 + blocks(d)[..i]
        .iter()
        .map(|(_, v)| 5 + v.len())
        .sum::<usize>()
}

fn field_mut(d: &mut Decoded, i: usize) -> &mut Vec<u8> {
    match i {
        0 => &mut d.domain,
        1 => &mut d.nonce,
        3 => &mut d.action,
        4 => &mut d.destination,
        5 => &mut d.capability,
        8 => &mut d.payer,
        9 => &mut d.payload,
        _ => unreachable!("block {i} is a 64-bit word"),
    }
}

const TEXT: [usize; 4] = [0, 4, 5, 8];
const BYTES: [usize; 3] = [1, 3, 9];
const WORDS: [usize; 3] = [2, 6, 7];

/// UTF-8 boundary classes (RFC 3629 section 4 and its exclusions): the
/// well-formed edges, then the malformed classes a decoder must refuse.
pub const UTF8_VALID: &[(&str, &[u8])] = &[
    ("U+0000", &[0x00]),
    ("U+007F", &[0x7f]),
    ("U+0080", &[0xc2, 0x80]),
    ("U+07FF", &[0xdf, 0xbf]),
    ("U+0800", &[0xe0, 0xa0, 0x80]),
    ("U+D7FF", &[0xed, 0x9f, 0xbf]),
    ("U+E000", &[0xee, 0x80, 0x80]),
    ("U+FFFD", &[0xef, 0xbf, 0xbd]),
    ("U+FFFF", &[0xef, 0xbf, 0xbf]),
    ("U+10000", &[0xf0, 0x90, 0x80, 0x80]),
    ("U+10FFFF", &[0xf4, 0x8f, 0xbf, 0xbf]),
];

pub const UTF8_MALFORMED: &[(&str, &[u8])] = &[
    ("lone continuation 80", &[0x80]),
    ("lone continuation BF", &[0xbf]),
    ("overlong C0 80", &[0xc0, 0x80]),
    ("overlong C1 BF", &[0xc1, 0xbf]),
    ("overlong E0 80 80", &[0xe0, 0x80, 0x80]),
    ("overlong E0 9F BF", &[0xe0, 0x9f, 0xbf]),
    ("overlong F0 80 80 80", &[0xf0, 0x80, 0x80, 0x80]),
    ("overlong F0 8F BF BF", &[0xf0, 0x8f, 0xbf, 0xbf]),
    ("surrogate ED A0 80 (U+D800)", &[0xed, 0xa0, 0x80]),
    ("surrogate ED BF BF (U+DFFF)", &[0xed, 0xbf, 0xbf]),
    ("past U+10FFFF F4 90 80 80", &[0xf4, 0x90, 0x80, 0x80]),
    ("past U+10FFFF F5 80 80 80", &[0xf5, 0x80, 0x80, 0x80]),
    ("byte F8", &[0xf8]),
    ("byte FE", &[0xfe]),
    ("byte FF", &[0xff]),
    ("truncated C2", &[0xc2]),
    ("truncated E1 80", &[0xe1, 0x80]),
    ("truncated F1 80 80", &[0xf1, 0x80, 0x80]),
    ("continuation missing C2 41", &[0xc2, 0x41]),
];

fn hex(s: &str) -> Vec<u8> {
    (0..s.len() / 2)
        .map(|i| u8::from_str_radix(&s[2 * i..2 * i + 2], 16).expect("pinned hex"))
        .collect()
}

fn num(v: &Value) -> u64 {
    v.as_str()
        .expect("pinned number string")
        .parse()
        .expect("pinned number")
}

/// A pinned intent row (JSON-safe) as decoded values.
fn pinned(row: &Value) -> Decoded {
    let s = |k: &str| row[k].as_str().expect("pinned text").as_bytes().to_vec();
    Decoded {
        domain: s("domain"),
        nonce: hex(row["nonce"].as_str().expect("nonce")),
        epoch: num(&row["epoch"]),
        action: hex(row["action"].as_str().expect("action")),
        destination: s("destination"),
        capability: s("capability"),
        amount: num(&row["amount"]),
        expiry: num(&row["expiry"]),
        payer: s("payer"),
        payload: hex(row["payload"].as_str().expect("payload")),
    }
}

pub const VECTORS_JSON: &str = include_str!("../../wb001-vectors.json");
pub const BRIDGE_JSON: &str = include_str!("../../wb001-bridge.json");

/// The pinned vectors carry unpaired UTF-16 surrogates on purpose (`\uD800`
/// escapes in the intent-level `bt-wb01:utf16` refusal rows), which a UTF-8
/// JSON reader cannot hold. Each unpaired surrogate escape is read as
/// `�`; returns the text and how many were rewritten. Those rows have
/// no envelope and are not parser inputs ([`vectors`] checks that the count
/// equals the rows it skips).
pub fn lone_surrogates_as_fffd(s: &str) -> (String, usize) {
    let b = s.as_bytes();
    let unit = |i: usize| -> Option<u16> {
        if b.get(i) == Some(&b'\\') && b.get(i + 1) == Some(&b'u') && i + 6 <= b.len() {
            u16::from_str_radix(std::str::from_utf8(&b[i + 2..i + 6]).ok()?, 16).ok()
        } else {
            None
        }
    };
    let mut out = String::with_capacity(s.len());
    let (mut i, mut n) = (0, 0);
    while i < b.len() {
        // an escaped backslash is two bytes of text, never an escape start
        if b[i] == b'\\' && b.get(i + 1) == Some(&b'\\') {
            out.push_str("\\\\");
            i += 2;
            continue;
        }
        match unit(i) {
            Some(0xd800..=0xdbff) if matches!(unit(i + 6), Some(0xdc00..=0xdfff)) => {
                out.push_str(&s[i..i + 12]);
                i += 12;
            }
            Some(0xd800..=0xdfff) => {
                out.push_str("\\ufffd");
                n += 1;
                i += 6;
            }
            _ => {
                let len = s[i..].chars().next().map_or(1, char::len_utf8);
                out.push_str(&s[i..i + len]);
                i += len;
            }
        }
    }
    (out, n)
}

fn pinned_json(text: &str) -> (Value, usize) {
    let (clean, n) = lone_surrogates_as_fffd(text);
    (serde_json::from_str(&clean).expect("pinned JSON parses"), n)
}

/// The base intent of the WB001 vectors (`base` positive).
pub fn base() -> Decoded {
    pinned(&pinned_json(VECTORS_JSON).0["positives"][0])
}

pub fn vectors() -> Vec<Case> {
    let mut out = Vec::new();
    let (v, rewritten) = pinned_json(VECTORS_JSON);
    let mut intent_level = 0;
    for p in v["positives"].as_array().expect("positives") {
        out.push(Case {
            input: hex(p["envelope"].as_str().expect("envelope")),
            kind: "pinned-positive",
            expect: Some(Expect::Accept(Some(pinned(p)))),
        });
    }
    for r in v["refusals"].as_array().expect("refusals") {
        // intent-level refusals (unpaired UTF-16 surrogates) have no envelope
        if r["envelope"].is_null() {
            assert_eq!(
                r["code"], "bt-wb01:utf16",
                "an envelope-less refusal row is a UTF-16 one"
            );
            intent_level += 1;
        }
        if let Some(env) = r["envelope"].as_str() {
            let code = match r["code"].as_str().expect("code") {
                "bt-wb01:utf8" => "bt-wb01:utf8",
                other => panic!("pinned envelope refusal with code {other}: extend this match"),
            };
            out.push(Case {
                input: hex(env),
                kind: "pinned-refusal",
                expect: Some(Expect::Refuse(code)),
            });
        }
    }
    // every rewritten surrogate sits in a skipped intent-level row: four
    // escapes in four rows today (a row could carry several; then this
    // check, not the vectors, is what must change)
    assert_eq!(
        rewritten, intent_level,
        "surrogate escapes outside the intent-level rows"
    );
    let (b, in_bridge) = pinned_json(BRIDGE_JSON);
    assert_eq!(in_bridge, 0, "the bridge terms carry no surrogate escapes");
    for t in b["terms"].as_array().expect("terms") {
        out.push(Case {
            input: hex(t["envelopeHex"].as_str().expect("envelopeHex")),
            kind: "pinned-bridge-term",
            expect: Some(Expect::Accept(Some(pinned(&t["intent"])))),
        });
    }
    out.extend(constructed());
    out
}

fn case(input: Vec<u8>, kind: &'static str, expect: Expect) -> Case {
    Case {
        input,
        kind,
        expect: Some(expect),
    }
}

fn accept(d: &Decoded) -> Expect {
    Expect::Accept(Some(d.clone()))
}

/// Boundary inputs whose answer follows from their construction.
pub fn constructed() -> Vec<Case> {
    let base = base();
    let env = raw(&base);
    let mut out = vec![case(env.clone(), "constructed-base", accept(&base))];
    // every variable field at its bounds, framed
    for i in TEXT.into_iter().chain([9]) {
        let (_, lo, hi, _) = BLOCKS[i];
        for (len, ok) in [(lo, true), (hi, true), (hi + 1, false)]
            .into_iter()
            .chain((lo > 0).then(|| (lo - 1, false)))
        {
            let mut d = base.clone();
            *field_mut(&mut d, i) = vec![b'a'; len as usize];
            let e = if ok {
                accept(&d)
            } else {
                Expect::Refuse("bt-wb01:length")
            };
            out.push(case(raw(&d), "constructed-bounds", e));
        }
    }
    // fixed-size fields one short and one long, framed
    for i in BYTES.into_iter().take(2).chain(WORDS) {
        let size = BLOCKS[i].1 as usize;
        for len in [size - 1, size + 1] {
            let mut bs = blocks(&base);
            bs[i].1 = vec![0x5a; len];
            out.push(case(
                raw_blocks(&bs),
                "constructed-bounds",
                Expect::Refuse("bt-wb01:length"),
            ));
        }
    }
    // every UTF-8 class in every text field, framed
    for i in TEXT {
        for (_, seq) in UTF8_VALID {
            let mut d = base.clone();
            field_mut(&mut d, i).extend_from_slice(seq);
            out.push(case(raw(&d), "constructed-utf8-valid", accept(&d)));
        }
        for (_, seq) in UTF8_MALFORMED {
            let mut d = base.clone();
            field_mut(&mut d, i).extend_from_slice(seq);
            out.push(case(
                raw(&d),
                "constructed-utf8-malformed",
                Expect::Refuse("bt-wb01:utf8"),
            ));
            // and at the start of the field
            let mut d = base.clone();
            let f = field_mut(&mut d, i);
            let rest = std::mem::take(f);
            f.extend_from_slice(seq);
            f.extend_from_slice(&rest);
            out.push(case(
                raw(&d),
                "constructed-utf8-malformed",
                Expect::Refuse("bt-wb01:utf8"),
            ));
        }
    }
    // every truncation of the base envelope
    for k in 0..env.len() {
        out.push(case(
            env[..k].to_vec(),
            "constructed-truncation",
            Expect::Refuse("bt-wb01:short"),
        ));
    }
    // trailing bytes
    for extra in [&[0x00][..], &[0x01], &[0x00; 7], &HEAD] {
        let mut x = env.clone();
        x.extend_from_slice(extra);
        out.push(case(
            x,
            "constructed-trailing",
            Expect::Refuse("bt-wb01:trailing"),
        ));
    }
    // header faults
    for k in 0..7 {
        let mut x = env.clone();
        x[k] ^= 0x20;
        out.push(case(
            x,
            "constructed-magic",
            Expect::Refuse("bt-wb01:magic"),
        ));
    }
    for ver in [0x00, 0x02, 0xff] {
        let mut x = env.clone();
        x[7] = ver;
        out.push(case(
            x,
            "constructed-version",
            Expect::Refuse("bt-wb01:version"),
        ));
    }
    // tag faults: every adjacent pair swapped, every tag replaced, one block
    // repeated, the last block dropped
    for i in 0..9 {
        let mut bs = blocks(&base);
        bs.swap(i, i + 1);
        out.push(case(
            raw_blocks(&bs),
            "constructed-tag-order",
            Expect::Refuse("bt-wb01:tag-order"),
        ));
    }
    for i in 0..10 {
        let mut bs = blocks(&base);
        bs[i].0 = 0x0b;
        out.push(case(
            raw_blocks(&bs),
            "constructed-tag-order",
            Expect::Refuse("bt-wb01:tag-order"),
        ));
    }
    let mut bs = blocks(&base);
    bs.insert(1, bs[0].clone());
    out.push(case(
        raw_blocks(&bs),
        "constructed-tag-order",
        Expect::Refuse("bt-wb01:tag-order"),
    ));
    let mut bs = blocks(&base);
    bs.pop();
    out.push(case(
        raw_blocks(&bs),
        "constructed-missing-block",
        Expect::Refuse("bt-wb01:short"),
    ));
    // length words that disagree with the bytes that follow
    let dom = block_offset(&base, 0);
    let mut x = env.clone();
    x[dom + 1..dom + 5].copy_from_slice(&u32::MAX.to_be_bytes());
    out.push(case(
        x,
        "constructed-length-word",
        Expect::Refuse("bt-wb01:length"),
    ));
    let pld = block_offset(&base, 9);
    let mut x = env.clone();
    let claimed = base.payload.len() as u32 + 1;
    x[pld + 1..pld + 5].copy_from_slice(&claimed.to_be_bytes());
    out.push(case(
        x,
        "constructed-length-word",
        Expect::Refuse("bt-wb01:short"),
    ));
    out
}

/// Valid UTF-8 text of exactly `len` bytes, mixing every encoded width.
pub fn text(rng: &mut Rng, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    while out.len() < len {
        let room = len - out.len();
        let width = 1 + rng.below(room.min(4) as u64) as usize;
        let c = loop {
            let cp = match width {
                1 => rng.below(0x80) as u32,
                2 => rng.range(0x80, 0x7ff) as u32,
                3 => rng.range(0x800, 0xffff) as u32,
                _ => rng.range(0x10000, 0x10ffff) as u32,
            };
            if let Some(c) = char::from_u32(cp) {
                break c;
            }
        };
        let mut buf = [0u8; 4];
        out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
    }
    out
}

/// A length in `[lo, hi]`, at a bound one time in four.
fn length(rng: &mut Rng, lo: u32, hi: u32) -> usize {
    match rng.below(8) {
        0 => lo as usize,
        1 => hi as usize,
        // payloads are mostly small: a long tail, not a uniform 0..4096
        _ if hi > 1024 => {
            let top = if rng.below(4) == 0 { hi as u64 } else { 256 };
            rng.range(lo as u64, top) as usize
        }
        _ => rng.range(lo as u64, hi as u64) as usize,
    }
}

fn word(rng: &mut Rng) -> u64 {
    match rng.below(6) {
        0 => 0,
        1 => u64::MAX,
        2 => 1 << rng.below(64),
        3 => (1u64 << 32) + rng.below(3) - 1,
        _ => rng.next(),
    }
}

pub fn random_valid(rng: &mut Rng) -> Decoded {
    let t = |rng: &mut Rng, i: usize| {
        let n = length(rng, BLOCKS[i].1, BLOCKS[i].2);
        text(rng, n)
    };
    let domain = t(rng, 0);
    let nonce = rng.bytes(32);
    let epoch = word(rng);
    let action = rng.bytes(32);
    let destination = t(rng, 4);
    let capability = t(rng, 5);
    let amount = word(rng);
    let expiry = word(rng);
    let payer = t(rng, 8);
    let n = length(rng, 0, 4096);
    let payload = rng.bytes(n);
    Decoded {
        domain,
        nonce,
        epoch,
        action,
        destination,
        capability,
        amount,
        expiry,
        payer,
        payload,
    }
}

const SPECIAL: [u8; 10] = [0x00, 0x01, 0x7f, 0x80, 0xbf, 0xc0, 0xed, 0xf4, 0xf5, 0xff];

/// Mutation operators, with their weights.
pub const OPERATORS: &[(&str, u64)] = &[
    ("valid", 15),
    ("bit-flip", 10),
    ("byte-set", 8),
    ("truncate", 6),
    ("append", 6),
    ("insert", 5),
    ("delete", 5),
    ("length-word", 10),
    ("field-bounds", 10),
    ("utf8", 10),
    ("tags", 5),
    ("header", 3),
    ("random", 4),
    ("splice", 3),
];

fn operator(rng: &mut Rng) -> &'static str {
    let total: u64 = OPERATORS.iter().map(|(_, w)| w).sum();
    let mut x = rng.below(total);
    for (name, w) in OPERATORS {
        if x < *w {
            return name;
        }
        x -= w;
    }
    unreachable!("weights sum to total")
}

pub fn sample(rng: &mut Rng) -> Case {
    let d = random_valid(rng);
    let env = raw(&d);
    let op = operator(rng);
    let input = match op {
        "valid" => env,
        "bit-flip" => {
            let mut x = env;
            let k = rng.below(x.len() as u64) as usize;
            x[k] ^= 1 << rng.below(8);
            x
        }
        "byte-set" => {
            let mut x = env;
            let k = rng.below(x.len() as u64) as usize;
            x[k] = *rng.pick(&SPECIAL);
            x
        }
        "truncate" => {
            let k = rng.below(env.len() as u64) as usize;
            env[..k].to_vec()
        }
        "append" => {
            let mut x = env;
            let n = rng.range(1, 8) as usize;
            x.extend(rng.bytes(n));
            x
        }
        "insert" => {
            let mut x = env;
            let k = rng.below(x.len() as u64 + 1) as usize;
            x.insert(k, rng.next() as u8);
            x
        }
        "delete" => {
            let mut x = env;
            let k = rng.below(x.len() as u64) as usize;
            x.remove(k);
            x
        }
        "length-word" => {
            let i = rng.below(10) as usize;
            let (_, lo, hi, _) = BLOCKS[i];
            let at = block_offset(&d, i);
            let mut x = env;
            let cur = u32::from_be_bytes([x[at + 1], x[at + 2], x[at + 3], x[at + 4]]);
            let any = rng.next() as u32;
            let w = *rng.pick(&[
                cur.wrapping_add(1),
                cur.wrapping_sub(1),
                0,
                1,
                lo.wrapping_sub(1),
                hi,
                hi + 1,
                u32::MAX,
                0x8000_0000,
                any,
            ]);
            x[at + 1..at + 5].copy_from_slice(&w.to_be_bytes());
            x
        }
        "field-bounds" => {
            let i = *rng.pick(&[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            let (_, lo, hi, is_text) = BLOCKS[i];
            let mut lens = vec![lo as usize, hi as usize, hi as usize + 1];
            if lo > 0 {
                lens.push(lo as usize - 1);
            }
            let n = *rng.pick(&lens);
            let mut bs = blocks(&d);
            bs[i].1 = if is_text { text(rng, n) } else { rng.bytes(n) };
            raw_blocks(&bs)
        }
        "utf8" => {
            let i = *rng.pick(&TEXT);
            let (_, _, hi, _) = BLOCKS[i];
            let seq = if rng.below(4) == 0 {
                rng.pick(UTF8_VALID).1
            } else {
                rng.pick(UTF8_MALFORMED).1
            };
            let mut dd = d.clone();
            let f = field_mut(&mut dd, i);
            // keep the field within its bound, so the UTF-8 check decides
            while f.len() + seq.len() > hi as usize {
                f.clear();
            }
            let k = rng.below(f.len() as u64 + 1) as usize;
            // on a character boundary of the valid text: back up over
            // continuation bytes
            let mut k = k;
            while k > 0 && k < f.len() && (f[k] & 0xc0) == 0x80 {
                k -= 1;
            }
            let tail = f.split_off(k);
            f.extend_from_slice(seq);
            f.extend_from_slice(&tail);
            raw(&dd)
        }
        "tags" => {
            let mut bs = blocks(&d);
            match rng.below(4) {
                0 => {
                    let i = rng.below(9) as usize;
                    bs.swap(i, i + 1);
                }
                1 => {
                    let i = rng.below(10) as usize;
                    bs[i].0 = rng.next() as u8;
                }
                2 => {
                    let i = rng.below(10) as usize;
                    let b = bs[i].clone();
                    bs.insert(i, b);
                }
                _ => {
                    let i = rng.below(10) as usize;
                    bs.remove(i);
                }
            }
            raw_blocks(&bs)
        }
        "header" => {
            let mut x = env;
            let k = rng.below(8) as usize;
            x[k] = rng.next() as u8;
            x
        }
        "random" => {
            let n = rng.below(301) as usize;
            let mut x = if rng.below(2) == 0 {
                HEAD.to_vec()
            } else {
                Vec::new()
            };
            x.extend(rng.bytes(n));
            x
        }
        _ => {
            let other = raw(&random_valid(rng));
            let a = rng.below(env.len() as u64 + 1) as usize;
            let b = rng.below(other.len() as u64 + 1) as usize;
            let mut x = env[..a].to_vec();
            x.extend_from_slice(&other[b..]);
            x
        }
    };
    Case {
        input,
        kind: op,
        expect: None,
    }
}

pub fn sampled(seed: u64, count: u64) -> impl Iterator<Item = Case> {
    let mut rng = Rng(seed);
    (0..count).map(move |_| sample(&mut rng))
}
