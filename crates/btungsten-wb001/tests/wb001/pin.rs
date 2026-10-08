//! The pinned-file generator, in Rust: the shared vectors and the formal
//! bridge are derived from the model and serialized exactly as the files are
//! committed (JSON.stringify layout). The drift gate requires the committed
//! bytes to equal a fresh derivation; the ignored `pin_write` test rewrites
//! them after an intentional format change:
//!   cargo test -p btungsten-wb001 --test wb001 -- --ignored pin_write

use crate::common::{base, to_hex};
use btungsten_wb001::core::HEAD8;
use btungsten_wb001::{canonical, IntentIn, Text};

pub enum W {
    Str(Vec<u16>),
    Num(u64),
    Arr(Vec<W>),
    Obj(Vec<(&'static str, W)>),
}

fn s(x: &str) -> W {
    W::Str(x.encode_utf16().collect())
}

fn esc(units: &[u16], out: &mut String) {
    out.push('"');
    let mut i = 0;
    while i < units.len() {
        let u = units[i];
        let pair = (0xd800..0xdc00).contains(&u)
            && i + 1 < units.len()
            && (0xdc00..0xe000).contains(&units[i + 1]);
        if pair {
            out.push_str(&String::from_utf16(&units[i..i + 2]).unwrap());
            i += 2;
            continue;
        }
        match u {
            0x22 => out.push_str("\\\""),
            0x5c => out.push_str("\\\\"),
            0x08 => out.push_str("\\b"),
            0x0c => out.push_str("\\f"),
            0x0a => out.push_str("\\n"),
            0x0d => out.push_str("\\r"),
            0x09 => out.push_str("\\t"),
            u if u < 0x20 || (0xd800..0xe000).contains(&u) => out.push_str(&format!("\\u{u:04x}")),
            u => out.push(char::from_u32(u as u32).unwrap()),
        }
        i += 1;
    }
    out.push('"');
}

pub fn compact(w: &W, out: &mut String) {
    match w {
        W::Str(u) => esc(u, out),
        W::Num(n) => out.push_str(&n.to_string()),
        W::Arr(a) => {
            out.push('[');
            for (k, x) in a.iter().enumerate() {
                if k > 0 {
                    out.push(',');
                }
                compact(x, out);
            }
            out.push(']');
        }
        W::Obj(m) => {
            out.push('{');
            for (k, (key, x)) in m.iter().enumerate() {
                if k > 0 {
                    out.push(',');
                }
                esc(&key.encode_utf16().collect::<Vec<_>>(), out);
                out.push(':');
                compact(x, out);
            }
            out.push('}');
        }
    }
}

pub fn pretty(w: &W, ind: usize, out: &mut String) {
    let pad = |n: usize| "  ".repeat(n);
    match w {
        W::Arr(a) => {
            out.push_str("[\n");
            for (k, x) in a.iter().enumerate() {
                out.push_str(&pad(ind + 1));
                pretty(x, ind + 1, out);
                out.push_str(if k + 1 < a.len() { ",\n" } else { "\n" });
            }
            out.push_str(&pad(ind));
            out.push(']');
        }
        W::Obj(m) => {
            out.push_str("{\n");
            for (k, (key, x)) in m.iter().enumerate() {
                out.push_str(&pad(ind + 1));
                esc(&key.encode_utf16().collect::<Vec<_>>(), out);
                out.push_str(": ");
                pretty(x, ind + 1, out);
                out.push_str(if k + 1 < m.len() { ",\n" } else { "\n" });
            }
            out.push_str(&pad(ind));
            out.push('}');
        }
        leaf => compact(leaf, out),
    }
}

fn text(t: &Text) -> W {
    match t {
        Text::Str(x) => s(x),
        Text::Utf16(u) => W::Str(u.clone()),
    }
}

fn json_intent(x: &IntentIn) -> Vec<(&'static str, W)> {
    vec![
        ("domain", text(&x.domain)),
        ("nonce", s(&to_hex(&x.nonce))),
        ("epoch", s(&x.epoch.to_string())),
        ("action", s(&to_hex(&x.action))),
        ("destination", text(&x.destination)),
        ("capability", text(&x.capability)),
        ("amount", s(&x.amount.to_string())),
        ("expiry", s(&x.expiry.to_string())),
        ("payer", text(&x.payer)),
        ("payload", s(&to_hex(&x.payload))),
    ]
}

fn env(x: &IntentIn) -> Vec<u8> {
    canonical(&x.build().expect("pinned terms are valid intents")).unwrap()
}

fn st(x: &str) -> Text {
    Text::Str(x.to_string())
}

fn with_domain_bytes(bytes: &[u8]) -> String {
    let good = env(&base());
    let mut e = HEAD8.to_vec();
    e.push(0x01);
    e.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    e.extend_from_slice(bytes);
    e.extend_from_slice(&good[8 + 5 + "skaists.bpay/1".len()..]);
    to_hex(&e)
}

pub fn vectors() -> String {
    let positives: Vec<(&str, IntentIn)> = vec![
        ("base", base()),
        (
            "astral destination",
            IntentIn {
                destination: st("vault:\u{1F41D}"),
                ..base()
            },
        ),
        (
            "legitimate U+FFFD payer",
            IntentIn {
                payer: st("seat:\u{FFFD}"),
                ..base()
            },
        ),
        (
            "combining + latin extended",
            IntentIn {
                payer: st("seat:b\u{0101}bis\u{0301}"),
                ..base()
            },
        ),
        (
            "cjk capability",
            IntentIn {
                capability: st("\u{652f}\u{4ed8}"),
                ..base()
            },
        ),
        (
            "astral domain",
            IntentIn {
                domain: st("skaists.\u{1F431}/1"),
                ..base()
            },
        ),
        (
            "empty payload",
            IntentIn {
                payload: vec![],
                ..base()
            },
        ),
        (
            "u64 ceiling",
            IntentIn {
                amount: u64::MAX,
                ..base()
            },
        ),
        (
            "u32 boundary +1",
            IntentIn {
                amount: 4_294_967_296,
                ..base()
            },
        ),
        (
            "nested envelope payload",
            IntentIn {
                payload: env(&base()),
                ..base()
            },
        ),
    ];
    let positives = positives
        .into_iter()
        .map(|(name, x)| {
            let e = env(&x);
            let mut row = vec![("name", s(name))];
            row.extend(json_intent(&x));
            row.push(("envelope", s(&to_hex(&e))));
            row.push(("length", W::Num(e.len() as u64)));
            W::Obj(row)
        })
        .collect();
    let u16s = |v: &[u16]| Text::Utf16(v.to_vec());
    let by_intent: Vec<(&str, IntentIn)> = vec![
        (
            "domain lone high surrogate",
            IntentIn {
                domain: u16s(&[0xd800]),
                ..base()
            },
        ),
        (
            "destination lone low surrogate",
            IntentIn {
                destination: u16s(&[0xdc00]),
                ..base()
            },
        ),
        (
            "capability embedded surrogate",
            IntentIn {
                capability: u16s(&[0xd800, 0x41]),
                ..base()
            },
        ),
        (
            "payer embedded surrogate",
            IntentIn {
                payer: u16s(&[0x78, 0xd801, 0x79]),
                ..base()
            },
        ),
    ];
    let mut refusals: Vec<W> = by_intent
        .into_iter()
        .map(|(name, x)| {
            let code = x.build().unwrap_err().code();
            W::Obj(vec![
                ("name", s(name)),
                ("code", s(code)),
                ("intent", W::Obj(json_intent(&x))),
            ])
        })
        .collect();
    let by_envelope: [(&str, &[u8]); 5] = [
        ("domain raw 0xff", &[0xff]),
        ("domain encoded surrogate (CESU-8)", &[0xed, 0xa0, 0x80]),
        ("domain overlong 0xc0 0x80", &[0xc0, 0x80]),
        ("domain beyond U+10FFFF", &[0xf4, 0x90, 0x80, 0x80]),
        ("domain truncated 0xc2", &[0xc2]),
    ];
    for (name, bytes) in by_envelope {
        let e = with_domain_bytes(bytes);
        let code = btungsten_wb001::decode(&crate::common::hex(&e))
            .unwrap_err()
            .code();
        refusals.push(W::Obj(vec![
            ("name", s(name)),
            ("code", s(code)),
            ("envelope", s(&e)),
        ]));
    }
    let doc = W::Obj(vec![
        ("what", s("PUBLIC-CONSTANT: deterministic bT-WB001 shared vectors — canonical encodings of public test intents and their refusal codes; generated from the Rust model by crates/btungsten-wb001/tests/wb001/pin.rs, never by hand.")),
        ("format", s("bt-wb01/1")),
        ("note", s("Pinned shared vectors — derived from the Rust model (the code SAW proves equal to the Cryptol wire): positives byte-for-byte (full length, every meaningful byte), refusals by exact code. Includes the surrogate/invalid-UTF-8 boundary rows of the 2026-10-07 repair. Regenerate only via `cargo test -p btungsten-wb001 --test wb001 -- --ignored pin_write` after an intentional format change; the wb001 test target fails on any drift.")),
        ("positives", W::Arr(positives)),
        ("refusals", W::Arr(refusals)),
    ]);
    let mut out = String::new();
    compact(&doc, &mut out);
    out.push('\n');
    out
}

/// The constructed terms of BTungstenWB001.cry (iBase, twinL, twinR, astral, fffd,
/// combining, nearA, nearB), as model intents.
pub fn bridge_terms() -> Vec<(&'static str, IntentIn)> {
    let b = IntentIn {
        payload: b"{}".to_vec(),
        ..base()
    };
    vec![
        ("iBase", b.clone()),
        (
            "twinL",
            IntentIn {
                destination: st("ab"),
                capability: st("c"),
                ..b.clone()
            },
        ),
        (
            "twinR",
            IntentIn {
                destination: st("a"),
                capability: st("bc"),
                ..b.clone()
            },
        ),
        (
            "astral",
            IntentIn {
                domain: st("skaists.\u{1F41D}/1"),
                ..b.clone()
            },
        ),
        (
            "fffd",
            IntentIn {
                payer: st("\u{FFFD}"),
                ..b.clone()
            },
        ),
        (
            "combining",
            IntentIn {
                destination: st("e\u{0301}"),
                ..b.clone()
            },
        ),
        (
            "nearA",
            IntentIn {
                payload: vec![0xde, 0xad, 0xbe, 0xef],
                ..b.clone()
            },
        ),
        (
            "nearB",
            IntentIn {
                payload: vec![0xde, 0xad, 0xbe, 0xef, 0x00],
                ..b
            },
        ),
    ]
}

pub fn bridge() -> String {
    let terms = bridge_terms()
        .into_iter()
        .map(|(name, x)| {
            let e = env(&x);
            W::Obj(vec![
                ("name", s(name)),
                ("envLen", W::Num(e.len() as u64)),
                ("intent", W::Obj(json_intent(&x))),
                ("envelopeHex", s(&to_hex(&e))),
            ])
        })
        .collect();
    let doc = W::Obj(vec![
        ("what", s("WB001 formal-wire bridge — the Rust model's canonical() bytes pinned for the Cryptol spec's constructed terms (founder review B1)")),
        ("format", s("each term carries the model intent (JSON-safe) and the exact canonical() envelope hex; BTungstenWB001.cry pins the same hex as opaque constants; the Rust test target and the Cryptol formal job re-derive every run")),
        ("note", s("closed-term agreement on pinned terms; the universal statement is the SAW proof that the model's encoder equals `wire` (wb001-saw/rust.saw); regenerate with `cargo test -p btungsten-wb001 --test wb001 -- --ignored pin_write`")),
        ("terms", W::Arr(terms)),
    ]);
    let mut out = String::new();
    pretty(&doc, 0, &mut out);
    out.push('\n');
    out
}

#[test]
fn the_committed_pinned_files_equal_a_fresh_derivation_from_the_model() {
    assert_eq!(
        vectors(),
        crate::common::VECTORS,
        "wb001-vectors.json drifted from the model: run the ignored pin_write test"
    );
    assert_eq!(
        bridge(),
        crate::common::BRIDGE,
        "wb001-bridge.json drifted from the model: run the ignored pin_write test"
    );
}

#[test]
#[ignore = "rewrites the pinned files; run only after an intentional format change"]
fn pin_write() {
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../scripts/btungsten/");
    std::fs::write(format!("{root}wb001-vectors.json"), vectors()).unwrap();
    std::fs::write(format!("{root}wb001-bridge.json"), bridge()).unwrap();
}
