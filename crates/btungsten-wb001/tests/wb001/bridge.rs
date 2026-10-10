//! The formal-wire bridge, Rust leg: the model re-derives every pinned
//! term's envelope byte-for-byte, and BTungstenWB001.cry carries each hex literal,
//! typed declaration and bridge property. (The SAW leg proves the same
//! encoder equal to `wire` for every valid intent; these terms stay as the
//! closed-term checks the Cryptol formal job evaluates.)

use crate::common::{intent_of, parse, to_hex, BRIDGE, INTENT_CRY};
use btungsten_wb001::canonical;

#[test]
fn the_model_re_derives_every_pinned_envelope_and_intent_cry_carries_each() {
    let b = parse(BRIDGE);
    let terms = b.at("terms").arr();
    assert!(terms.len() >= 8);
    let mut hexes = std::collections::HashMap::new();
    for term in terms {
        let name = term.at("name").s();
        let i = intent_of(term.at("intent")).build().unwrap();
        let env = canonical(&i).unwrap();
        let want = term.at("envelopeHex").s();
        assert_eq!(env.len() as u64, term.at("envLen").n(), "{name}: envLen");
        assert_eq!(
            to_hex(&env),
            want,
            "{name}: bytes drifted from the pinned bridge"
        );
        assert!(
            INTENT_CRY.contains(&want),
            "{name}: BTungstenWB001.cry lost the hex literal"
        );
        assert!(
            INTENT_CRY.contains(&format!("b{name} : [{}][8]", env.len())),
            "{name}: declaration drifted"
        );
        let prop = format!("bridge{}{}", name[..1].to_uppercase(), &name[1..]);
        assert!(
            INTENT_CRY.contains(&prop),
            "{name}: bridge property missing"
        );
        hexes.insert(name, want);
    }
    assert_ne!(hexes["twinL"], hexes["twinR"]);
    assert_ne!(hexes["nearA"], hexes["nearB"]);
}
