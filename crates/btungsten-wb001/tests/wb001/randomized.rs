//! Randomized legs over the model: strict-decode round trip and pairwise
//! distinctness on reproducible random valid intents, including multibyte
//! text and full-capacity fields.

use crate::common::{to_hex, Rng};
use btungsten_wb001::{canonical, decode, IntentIn, Text};

const ALPHABET: [&str; 10] = [
    "a",
    "Z",
    "0",
    "/",
    ":",
    "\u{0101}",
    "\u{652f}",
    "\u{1F41D}",
    "\u{FFFD}",
    "e\u{0301}",
];

fn text(r: &mut Rng, max: usize) -> Text {
    let mut s = String::new();
    let want = 1 + r.below(max as u64) as usize;
    while s.len() < want {
        let c = ALPHABET[r.below(ALPHABET.len() as u64) as usize];
        if s.len() + c.len() > max {
            break;
        }
        s.push_str(c);
    }
    if s.is_empty() {
        s.push('a');
    }
    Text::Str(s)
}

fn bytes(r: &mut Rng, n: usize) -> Vec<u8> {
    (0..n).map(|_| r.next() as u8).collect()
}

fn random_intent(r: &mut Rng) -> IntentIn {
    let payload_len = match r.below(4) {
        0 => 0,
        1 => 4096,
        _ => r.below(300) as usize,
    };
    IntentIn {
        domain: text(r, 64),
        nonce: bytes(r, 32),
        epoch: r.next(),
        action: bytes(r, 32),
        destination: text(r, 128),
        capability: text(r, 64),
        amount: r.next(),
        expiry: r.next(),
        payer: text(r, 128),
        payload: bytes(r, payload_len),
    }
}

#[test]
fn random_valid_intents_round_trip_and_stay_distinct() {
    let mut r = Rng(0x00b7_5eed_0001);
    let mut seen = std::collections::HashMap::new();
    let n = 4000;
    for _ in 0..n {
        let i = random_intent(&mut r)
            .build()
            .expect("generator makes valid intents");
        let env = canonical(&i).unwrap();
        let back = decode(&env).unwrap();
        assert_eq!(*back, *i, "decode(canonical(i)) != i");
        if let Some(prev) = seen.insert(to_hex(&env), i.clone()) {
            assert_eq!(*prev, *i, "two distinct intents share canonical bytes");
        }
    }
    assert_eq!(seen.len(), n);
}
