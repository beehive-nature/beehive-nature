//! The decoder before RB05, kept verbatim as a reference: `decode` now runs
//! `decode_core` (a fixed buffer and the true length, the shape SAW proves
//! equal to `decodeSpec`), and this leg holds the two to the same answer,
//! value or refusal code, on seeded inputs around the envelope's structure.
//! Agreement here is sampled; the universal statements are the SAW proofs.

use crate::common::Rng;
use crate::randomized::random_intent;
use btungsten_wb001::core::{well_formed_utf8_128, well_formed_utf8_64, Intent, HEAD8};
use btungsten_wb001::{canonical, decode, Refusal};

#[derive(Clone, Copy)]
enum Kind {
    Utf8,
    Bytes32,
    U64,
    Raw,
}

const FIELDS: [(u8, Kind, u32, u32); 10] = [
    (0x01, Kind::Utf8, 1, 64),
    (0x02, Kind::Bytes32, 32, 32),
    (0x03, Kind::U64, 8, 8),
    (0x04, Kind::Bytes32, 32, 32),
    (0x05, Kind::Utf8, 1, 128),
    (0x06, Kind::Utf8, 1, 64),
    (0x07, Kind::U64, 8, 8),
    (0x08, Kind::U64, 8, 8),
    (0x09, Kind::Utf8, 1, 128),
    (0x0a, Kind::Raw, 0, 4096),
];

fn padded<const CAP: usize>(v: &[u8]) -> [u8; CAP] {
    let mut a = [0u8; CAP];
    a[..v.len()].copy_from_slice(v);
    a
}

/// `btungsten_wb001::decode` as it stood at 804cd2c86, body unchanged.
fn legacy_decode(env: &[u8]) -> Result<Box<Intent>, Refusal> {
    if env.len() < 8 {
        return Err(Refusal::Short);
    }
    if env[..7] != HEAD8[..7] {
        return Err(Refusal::Magic);
    }
    if env[7] != HEAD8[7] {
        return Err(Refusal::Version);
    }
    let mut at = 8usize;
    let mut vals: Vec<&[u8]> = Vec::with_capacity(10);
    for &(tag, kind, min, max) in FIELDS.iter() {
        if at + 5 > env.len() {
            return Err(Refusal::Short);
        }
        if env[at] != tag {
            return Err(Refusal::TagOrder);
        }
        let len = u32::from_be_bytes([env[at + 1], env[at + 2], env[at + 3], env[at + 4]]);
        if len < min || len > max {
            return Err(Refusal::Length);
        }
        let len = len as usize;
        if at + 5 + len > env.len() {
            return Err(Refusal::Short);
        }
        let v = &env[at + 5..at + 5 + len];
        if let Kind::Utf8 = kind {
            let ok = if max == 64 {
                well_formed_utf8_64(&padded::<64>(v))
            } else {
                well_formed_utf8_128(&padded::<128>(v))
            };
            if !ok {
                return Err(Refusal::Utf8);
            }
        }
        vals.push(v);
        at += 5 + len;
    }
    if at != env.len() {
        return Err(Refusal::Trailing);
    }
    let u64be = |v: &[u8]| u64::from_be_bytes(v.try_into().expect("length checked: 8"));
    let i = Box::new(Intent {
        domain_len: vals[0].len() as u32,
        domain: padded(vals[0]),
        nonce_len: 32,
        nonce: padded(vals[1]),
        epoch: u64be(vals[2]),
        action_len: 32,
        action: padded(vals[3]),
        destination_len: vals[4].len() as u32,
        destination: padded(vals[4]),
        capability_len: vals[5].len() as u32,
        capability: padded(vals[5]),
        amount: u64be(vals[6]),
        expiry: u64be(vals[7]),
        payer_len: vals[8].len() as u32,
        payer: padded(vals[8]),
        payload_len: vals[9].len() as u32,
        payload: padded(vals[9]),
    });
    Ok(i)
}

/// Block start offsets of a well-formed envelope, walked by its own length words.
fn block_starts(env: &[u8]) -> Vec<usize> {
    let mut at = 8;
    let mut v = Vec::new();
    while at + 5 <= env.len() && v.len() < 10 {
        v.push(at);
        at += 5 + u32::from_be_bytes([env[at + 1], env[at + 2], env[at + 3], env[at + 4]]) as usize;
    }
    v
}

const ODD: [&[u8]; 8] = [
    &[0xc0, 0x80],
    &[0xed, 0xa0, 0x80],
    &[0xf4, 0x90, 0x80, 0x80],
    &[0xff],
    &[0xe0, 0x80, 0x80],
    &[0xf0, 0x8f, 0xbf, 0xbf],
    &[0xc2],
    &[0x80],
];

/// One seeded input: a canonical envelope, then one structural mutation.
fn mutated(r: &mut Rng) -> Vec<u8> {
    let i = random_intent(r)
        .build()
        .expect("generator makes valid intents");
    let mut e = canonical(&i).unwrap();
    let starts = block_starts(&e);
    match r.below(10) {
        0 => {}
        1 => e.truncate(r.below(e.len() as u64 + 1) as usize),
        2 => {
            let extra = 1 + r.below(8) as usize;
            e.extend((0..extra).map(|_| r.next() as u8));
        }
        3 => e.extend(std::iter::repeat(0u8).take(4626 + r.below(600) as usize)),
        4 => {
            let p = r.below(e.len() as u64) as usize;
            e[p] = r.next() as u8;
        }
        5 => {
            let at = starts[r.below(starts.len() as u64) as usize];
            let (_, _, lo, hi) = FIELDS[(e[at] as usize).clamp(1, 10) - 1];
            let w = match r.below(5) {
                0 => lo.wrapping_sub(1),
                1 => hi,
                2 => hi + 1,
                3 => lo,
                _ => r.next() as u32,
            };
            e[at + 1..at + 5].copy_from_slice(&w.to_be_bytes());
        }
        6 => {
            // an odd UTF-8 sequence over the start of a text field's value
            let text = [0usize, 4, 5, 8];
            let at = starts[text[r.below(4) as usize]];
            let odd = ODD[r.below(ODD.len() as u64) as usize];
            let len = u32::from_be_bytes([e[at + 1], e[at + 2], e[at + 3], e[at + 4]]) as usize;
            let off = r.below(len as u64) as usize;
            for (k, b) in odd.iter().enumerate() {
                if off + k < len {
                    e[at + 5 + off + k] = *b;
                }
            }
        }
        7 => {
            let at = starts[r.below(starts.len() as u64) as usize];
            e[at] = r.below(12) as u8;
        }
        8 => {
            // magic (bytes 0..7) or version (byte 7)
            let p = r.below(8) as usize;
            e[p] ^= 1 + r.below(255) as u8;
        }
        _ => {
            let n = r.below(300) as usize;
            e = HEAD8
                .iter()
                .copied()
                .chain((0..n).map(|_| r.next() as u8))
                .collect();
        }
    }
    e
}

#[test]
fn decode_core_answers_as_the_legacy_decoder_did() {
    let mut r = Rng(0x00b7_5eed_0005);
    let mut accepted = 0;
    let mut refusals = std::collections::BTreeMap::new();
    let n = 20_000;
    for _ in 0..n {
        let e = mutated(&mut r);
        let now = decode(&e);
        let then = legacy_decode(&e);
        match (&now, &then) {
            (Ok(a), Ok(b)) => {
                assert_eq!(a, b, "values differ on {e:02x?}");
                accepted += 1;
            }
            (Err(a), Err(b)) => {
                assert_eq!(a, b, "refusal differs on {e:02x?}");
                *refusals.entry(a.code()).or_insert(0) += 1;
            }
            _ => panic!("acceptance differs on {e:02x?}: now {now:?}, legacy {then:?}"),
        }
    }
    // every refusal class the generator aims at must actually occur
    for code in [
        "bt-wb01:short",
        "bt-wb01:magic",
        "bt-wb01:version",
        "bt-wb01:tag-order",
        "bt-wb01:length",
        "bt-wb01:utf8",
        "bt-wb01:trailing",
    ] {
        assert!(
            refusals.get(code).copied().unwrap_or(0) > 0,
            "{code} never occurred: {refusals:?}"
        );
    }
    assert!(accepted > n / 20, "too few accepted inputs: {accepted}");
}
