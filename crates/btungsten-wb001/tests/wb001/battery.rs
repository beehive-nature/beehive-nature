//! The intent-binding invariant, attacked: no valid signature may authorize
//! any intent other than the exact intent that was committed to.

use crate::common::{b32, base, seed, t};
use btungsten_wb001::core::HEAD8;
use btungsten_wb001::{
    canonical, decode, public_key, sign, verify, verify_envelope, IntentIn, Refusal, Text,
};

fn env_of(x: &IntentIn) -> Vec<u8> {
    canonical(&x.build().expect("valid intent")).expect("canonical")
}

fn signed(n: u8, x: &IntentIn) -> ([u8; 32], [u8; 64]) {
    let s = seed(n);
    (public_key(&s), sign(&s, &x.build().unwrap()).unwrap())
}

fn verifies(pk: &[u8; 32], x: &IntentIn, sig: &[u8; 64]) -> bool {
    match x.build() {
        Ok(i) => verify(pk, &i, sig),
        Err(_) => false,
    }
}

/// The SABOTAGE encoder: length-free concatenation, the historic ambiguity
/// bug. Lives in the test only, so the teeth row can convict it.
fn naive_concat(x: &IntentIn) -> Vec<u8> {
    let txt = |t: &Text| match t {
        Text::Str(s) => s.as_bytes().to_vec(),
        Text::Utf16(u) => String::from_utf16(u).unwrap().into_bytes(),
    };
    [
        txt(&x.domain),
        x.nonce.clone(),
        x.epoch.to_be_bytes().to_vec(),
        x.action.clone(),
        txt(&x.destination),
        txt(&x.capability),
        x.amount.to_be_bytes().to_vec(),
        x.expiry.to_be_bytes().to_vec(),
        txt(&x.payer),
        x.payload.clone(),
    ]
    .concat()
}

#[test]
fn canonical_is_deterministic_and_round_trips_through_the_strict_decoder() {
    let x = base();
    let a = env_of(&x);
    assert_eq!(a, env_of(&x));
    let back = decode(&a).expect("decode");
    assert_eq!(canonical(&back).unwrap(), a);
    assert_eq!(*back, *x.build().unwrap());
}

#[test]
fn typed_refusals_fail_closed_each_with_its_name() {
    let r = |x: IntentIn| x.build().err().map(|e| e.code());
    assert_eq!(
        r(IntentIn {
            domain: t(""),
            ..base()
        }),
        Some("bt-wb01:bounds")
    );
    assert_eq!(
        r(IntentIn {
            nonce: vec![0; 31],
            ..base()
        }),
        Some("bt-wb01:type")
    );
    assert_eq!(
        r(IntentIn {
            payload: vec![0; 4097],
            ..base()
        }),
        Some("bt-wb01:bounds")
    );
    let good = env_of(&base());
    assert_eq!(decode(&[0u8; 4]).unwrap_err(), Refusal::Short);
    let mut m = good.clone();
    m[..7].copy_from_slice(b"bT-WB00");
    assert_eq!(decode(&m).unwrap_err(), Refusal::Magic);
    let mut v = good.clone();
    v[7] = 0x02;
    assert_eq!(decode(&v).unwrap_err(), Refusal::Version);
    assert_eq!(decode(&good[..good.len() - 1]).unwrap_err(), Refusal::Short);
    let mut tr = good.clone();
    tr.push(0);
    assert_eq!(decode(&tr).unwrap_err(), Refusal::Trailing);
    // the JS-only rows (u64 not BigInt, unknown field, missing field) are
    // type-system facts in Rust: an IntentIn has exactly ten typed fields.
}

#[test]
fn injectivity_over_the_adversarial_corpus() {
    let nested = env_of(&base());
    let corpus: Vec<IntentIn> = vec![
        base(),
        IntentIn {
            payload: vec![],
            ..base()
        },
        IntentIn {
            payload: vec![0],
            ..base()
        },
        IntentIn {
            payload: nested.clone(),
            ..base()
        },
        IntentIn {
            payload: [nested.clone(), nested.clone()].concat(),
            ..base()
        },
        IntentIn {
            destination: t("vault:0xBEEF "),
            ..base()
        },
        IntentIn {
            domain: t("skaists.bpay/1 "),
            destination: t("vault:0xBEE"),
            ..base()
        },
        IntentIn {
            capability: t("pa"),
            ..base()
        },
        IntentIn {
            amount: 0,
            ..base()
        },
        IntentIn {
            amount: 4_294_967_295,
            ..base()
        },
        IntentIn {
            amount: 4_294_967_296,
            ..base()
        },
        IntentIn {
            amount: u64::MAX,
            ..base()
        },
        IntentIn { epoch: 0, ..base() },
        IntentIn {
            expiry: 1_790_000_001,
            ..base()
        },
        IntentIn {
            nonce: b32("nonce-wb002"),
            ..base()
        },
        IntentIn {
            action: b32("action-hash-02"),
            ..base()
        },
        IntentIn {
            payer: t("seat:bFUzZ2"),
            ..base()
        },
        IntentIn {
            domain: t("skaists.bpay/2"),
            ..base()
        },
        IntentIn {
            payload: br#"{"upload_id":"up-1"} {"upload_id":"up-1"}"#.to_vec(),
            ..base()
        },
        IntentIn {
            payload: br#"{"upload_id":"up-1"#.to_vec(),
            ..base()
        },
        IntentIn {
            destination: t("a"),
            capability: t("b"),
            payer: t("c"),
            ..base()
        },
        IntentIn {
            destination: t("ab"),
            capability: t("b"),
            payer: t("c"),
            ..base()
        },
        IntentIn {
            destination: t("a"),
            capability: t("a"),
            payer: t("c"),
            ..base()
        },
        IntentIn {
            payload: "\u{0100}\u{0101}".as_bytes().to_vec(),
            ..base()
        },
        IntentIn {
            payload: "\u{fffd}".as_bytes().to_vec(),
            ..base()
        },
    ];
    let mut seen = std::collections::HashSet::new();
    for x in &corpus {
        assert!(
            seen.insert(env_of(x)),
            "two corpus intents share canonical bytes"
        );
    }
    assert_eq!(seen.len(), 25);
}

#[test]
fn all_ten_fields_bind() {
    let a = base();
    let (pk, sig) = signed(1, &a);
    assert!(verifies(&pk, &a, &sig), "control");
    let moves: Vec<IntentIn> = vec![
        IntentIn {
            domain: t("skaists.bpay/2"),
            ..base()
        },
        IntentIn {
            domain: t("x"),
            ..base()
        },
        IntentIn {
            nonce: b32("nonce-wb002"),
            ..base()
        },
        IntentIn {
            nonce: vec![0; 32],
            ..base()
        },
        IntentIn { epoch: 2, ..base() },
        IntentIn { epoch: 0, ..base() },
        IntentIn {
            action: b32("action-hash-02"),
            ..base()
        },
        IntentIn {
            action: vec![0; 32],
            ..base()
        },
        IntentIn {
            destination: t("vault:0xBEE2"),
            ..base()
        },
        IntentIn {
            destination: t("vault:0xBEEF/x"),
            ..base()
        },
        IntentIn {
            capability: t("refund"),
            ..base()
        },
        IntentIn {
            capability: t("pay-all"),
            ..base()
        },
        IntentIn {
            amount: 1_000_001,
            ..base()
        },
        IntentIn {
            amount: 999_999,
            ..base()
        },
        IntentIn {
            amount: 0,
            ..base()
        },
        IntentIn {
            expiry: 1_790_000_001,
            ..base()
        },
        IntentIn {
            expiry: 0,
            ..base()
        },
        IntentIn {
            payer: t("seat:bFUzZ2"),
            ..base()
        },
        IntentIn {
            payer: t("seat:other"),
            ..base()
        },
        IntentIn {
            payload: br#"{"upload_id":"up-2"}"#.to_vec(),
            ..base()
        },
        IntentIn {
            payload: vec![],
            ..base()
        },
    ];
    for f in &moves {
        assert!(!verifies(&pk, f, &sig), "a moved field still verified");
        assert!(verifies(&pk, &a, &sig), "control drifted mid-matrix");
    }
    assert_eq!(moves.len(), 21);
}

#[test]
fn every_flipped_bit_of_the_envelope_fails() {
    let env = env_of(&base());
    let (pk, sig) = signed(2, &base());
    assert!(verify_envelope(&pk, &env, &sig), "control");
    let mut mutants = 0;
    for i in 0..env.len() {
        for bit in 0..8 {
            let mut m = env.clone();
            m[i] ^= 1 << bit;
            assert!(
                !verify_envelope(&pk, &m, &sig),
                "byte {i} bit {bit} flipped and still verified"
            );
            mutants += 1;
        }
    }
    assert_eq!(mutants, 205 * 8);
}

#[test]
fn every_flipped_bit_of_the_signature_fails() {
    let env = env_of(&base());
    let (pk, sig) = signed(3, &base());
    let mut mutants = 0;
    for i in 0..64 {
        for bit in 0..8 {
            let mut s = sig;
            s[i] ^= 1 << bit;
            assert!(
                !verify_envelope(&pk, &env, &s),
                "signature byte {i} bit {bit} flipped and still verified"
            );
            mutants += 1;
        }
    }
    assert_eq!(mutants, 512);
}

#[test]
fn structural_forgeries_all_refuse() {
    let env = env_of(&base());
    let (pk, sig) = signed(4, &base());
    let len_at = |e: &[u8], at: usize| {
        u32::from_be_bytes([e[at + 1], e[at + 2], e[at + 3], e[at + 4]]) as usize
    };
    let (mut at, mut dest_at, mut cap_at) = (HEAD8.len(), 0, 0);
    while at < env.len() {
        if env[at] == 0x05 {
            dest_at = at;
        }
        if env[at] == 0x06 {
            cap_at = at;
        }
        at += 5 + len_at(&env, at);
    }
    assert!(dest_at > 0 && cap_at > dest_at);
    let dest = env[dest_at..cap_at].to_vec();
    let cap = env[cap_at..cap_at + 5 + len_at(&env, cap_at)].to_vec();
    let swapped = [
        &env[..dest_at],
        &cap[..],
        &dest[..],
        &env[cap_at + cap.len()..],
    ]
    .concat();
    let unknown = [&env[..], &[0x0b, 0, 0, 0, 1, 0x41][..]].concat();
    let duped = [
        &env[..dest_at],
        &dest[..],
        &dest[..],
        &env[dest_at + dest.len()..],
    ]
    .concat();
    let mut splice = env.clone();
    let swallowed = (len_at(&env, dest_at) + 5 + len_at(&env, cap_at) + 5) as u32;
    splice[dest_at + 1..dest_at + 5].copy_from_slice(&swallowed.to_be_bytes());
    let truncated = env[..env.len() - 3].to_vec();
    for forged in [&swapped, &unknown, &duped, &splice, &truncated] {
        assert!(!verify_envelope(&pk, forged, &sig));
        assert!(decode(forged).is_err());
    }
    assert!(verify_envelope(&pk, &env, &sig), "control drifted");
}

#[test]
fn domain_nonce_epoch_expiry_participate() {
    let (pk, sig) = signed(5, &base());
    for x in [
        IntentIn {
            domain: t("other.protocol/9"),
            ..base()
        },
        IntentIn {
            nonce: b32("nonce-wb003"),
            ..base()
        },
        IntentIn { epoch: 2, ..base() },
        IntentIn {
            expiry: 1_790_000_500,
            ..base()
        },
    ] {
        assert!(!verifies(&pk, &x, &sig));
    }
    assert!(verifies(&pk, &base(), &sig), "control");
}

#[test]
fn teeth_the_naive_encoder_is_convicted_by_this_corpus() {
    let pairs = [
        (
            IntentIn {
                destination: t("ab"),
                capability: t("c"),
                ..base()
            },
            IntentIn {
                destination: t("a"),
                capability: t("bc"),
                ..base()
            },
        ),
        (
            IntentIn {
                payer: t("ab"),
                payload: b"c".to_vec(),
                ..base()
            },
            IntentIn {
                payer: t("a"),
                payload: b"bc".to_vec(),
                ..base()
            },
        ),
    ];
    for (n, (l, r)) in pairs.iter().enumerate() {
        assert_eq!(
            naive_concat(l),
            naive_concat(r),
            "sabotage control: the naive encoder no longer collides"
        );
        assert_ne!(
            env_of(l),
            env_of(r),
            "the canonical encoder must separate them"
        );
        let (pk, sig) = signed(10 + n as u8, l);
        assert!(verifies(&pk, l, &sig));
        assert!(
            !verifies(&pk, r, &sig),
            "a signature over left verified right: THE INVARIANT IS BROKEN"
        );
    }
}

#[test]
fn cross_key_is_not_this_keys_authorization() {
    let (other_pk, sig) = signed(6, &base());
    let pk = public_key(&seed(7));
    assert!(!verifies(&pk, &base(), &sig));
    assert!(verifies(&other_pk, &base(), &sig), "control");
}
