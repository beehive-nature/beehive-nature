//! RB04 in miniature: the same comparison rbench rb04 runs, on the vectors
//! and a small fixed-seed sample, so `cargo test` exercises it without the
//! Haskell toolchain (the generated parsers are committed).

use rb04_daedalus::corpus::{self, Expect, Rng, raw};
use rb04_daedalus::{Bnr, DIMENSIONS, bnr, compare, variant};

const SEED: u64 = 0x5242_3034_2026_1009;
const SAMPLE: u64 = 3_000;

#[test]
fn only_unpaired_surrogate_escapes_are_rewritten() {
    // a JSON escape `\uXXXX`, built here so no tool or editor decodes it
    let u = |h: &str| format!("\\u{h}");
    let input = format!(
        "[\"{}\", \"{}{}\", \"{}x\", \"\\{}\"]",
        u("d800"),
        u("d83d"),
        u("dc1d"),
        u("dc00"),
        u("d800")
    );
    let want = format!(
        "[\"{}\", \"{}{}\", \"{}x\", \"\\{}\"]",
        u("fffd"),
        u("d83d"),
        u("dc1d"),
        u("fffd"),
        u("d800")
    );
    assert_eq!(corpus::lone_surrogates_as_fffd(&input), (want, 2));
}

#[test]
fn the_tlv_writer_is_the_canonical_encoder_on_valid_fields() {
    let mut rng = Rng(SEED);
    let mut ds = vec![corpus::base()];
    ds.extend((0..2_000).map(|_| corpus::random_valid(&mut rng)));
    for d in ds {
        assert_eq!(d.reencode().as_deref(), Ok(raw(&d).as_slice()));
    }
}

#[test]
fn bnr_gives_the_pinned_or_constructed_answer_on_every_vector() {
    for (i, c) in corpus::vectors().iter().enumerate() {
        let got = bnr(&c.input);
        let ok = match (c.expect.as_ref().expect("every vector has an answer"), &got) {
            (Expect::Accept(None), Bnr::Accept(_)) => true,
            (Expect::Accept(Some(want)), Bnr::Accept(d)) => want == d,
            (Expect::Refuse(want), Bnr::Refuse(code)) => want == code,
            _ => false,
        };
        assert!(
            ok,
            "vector {i} ({}): expected {:?}, BNR {:?}",
            c.kind, c.expect, got
        );
    }
}

#[test]
fn the_honest_grammar_agrees_with_bnr_on_every_vector_and_sample() {
    let v = variant("honest").unwrap();
    let cases = corpus::vectors()
        .into_iter()
        .chain(corpus::sampled(SEED, SAMPLE));
    for (i, c) in cases.enumerate() {
        let r = compare(v, &c.input);
        assert!(r.agrees_everywhere(), "input {i} ({}): {:?}", c.kind, r);
    }
}

#[test]
fn every_teeth_variant_is_convicted_on_its_dimension() {
    // the dimensions crates/btungsten-bench/src/lanes/rb04.rs (TEETH) declares
    let honest = variant("honest").unwrap();
    for (name, dim) in [
        ("t1_domain_bound", "acceptance"),
        ("t2_word_endian", "values"),
        ("t3_cesu8_surrogate", "acceptance"),
        ("t4_trailing_bytes", "consumed"),
    ] {
        let v = variant(name).unwrap();
        let k = DIMENSIONS.iter().position(|d| *d == dim).unwrap();
        let witness = corpus::vectors()
            .into_iter()
            .chain(corpus::sampled(SEED, SAMPLE))
            .find(|c| compare(v, &c.input).dims[k] == Some(false));
        let w = witness.unwrap_or_else(|| panic!("{name}: no disagreement on {dim}"));
        assert!(
            compare(honest, &w.input).agrees_everywhere(),
            "{name}: honest disagrees on the witness"
        );
    }
}
