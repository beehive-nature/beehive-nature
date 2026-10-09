//! PQ10 runner (SPEC-BTUNGSTEN-PQ-1 §PQ10).
//!
//!   p3count prove <n> <members>   one hiding proof per claim kind, measured
//!   p3count forgery               the FORGERY battery at n = 64 (asym cohort)
//!   p3count leak                  tungsten-2 v1, as leak/PREREGISTERED-STARK.md registers it
//!   p3count leak-v2               tungsten-2 v2 (PREREGISTERED-STARK-v2.md), permutation families
//!
//! Every line it prints starts with `PQ10 `. Exit 1 on any accepted forgery,
//! any refused honest proof, or a security figure under the target.

use std::process::ExitCode;
use std::time::Instant;

use btungsten_p3count::air::CountAir;
use btungsten_p3count::config::{self, HidingConfig, Params};
use btungsten_p3count::security::figure;
use btungsten_p3count::statement::{F, Hasher, Leaf, leaves_from_cohort, statement};
use btungsten_p3count::trace::{generate, public_values};
use p3_uni_stark::{
    PreprocessedVerifierKey, Proof, prove_with_preprocessed, setup_preprocessed,
    verify_with_preprocessed,
};

/// Chosen by p3count-scan: proven >= 100 bits from n = 64 to n = 16384.
pub const PARAMS: Params = Params {
    log_blowup: 3,
    num_queries: 104,
    query_pow_bits: 16,
};
pub const TARGET_PROVEN_BITS: usize = 100;

const ASYM: &str = include_str!("../../../../contracts/zkreceipts/fixtures/asym-cohort.json");

/// Deterministic synthetic cohorts for the scale beats (splitmix64).
fn synthetic(n: usize, members: usize, seed: u64) -> Vec<Leaf> {
    let mut s = seed;
    let mut next = move || {
        s = s.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = s;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    };
    let mut v: Vec<Leaf> = (0..members)
        .map(|_| {
            let x = next();
            let y = next();
            Leaf {
                fp: x,
                pheno: (y & 1) as u8,
                r: [
                    ((y >> 1) % 3) as u8,
                    ((y >> 3) % 3) as u8,
                    ((y >> 5) % 3) as u8,
                ],
            }
        })
        .collect();
    v.resize(n, Leaf::default());
    v
}

struct Setup {
    air: CountAir,
    pp: p3_uni_stark::PreprocessedProverData<HidingConfig>,
    vk: PreprocessedVerifierKey<HidingConfig>,
    cfg: HidingConfig,
}

fn setup(n: usize, members: usize) -> Setup {
    let height = config::height(n, PARAMS);
    let air = CountAir::new(n, members, height);
    let cfg = config::hiding(PARAMS, n, members);
    let (pp, vk) = setup_preprocessed(&cfg, &air, height.trailing_zeros() as usize)
        .expect("preprocessed commit")
        .expect("preprocessed columns");
    Setup { air, pp, vk, cfg }
}

fn prove(s: &Setup, leaves: &[Leaf], public: &[F]) -> Option<Proof<HidingConfig>> {
    let w = generate(&Hasher::default(), &s.air, leaves);
    prove_with_preprocessed(&s.cfg, &s.air, w.trace, public, Some(&s.pp)).ok()
}

fn verifies(s: &Setup, proof: &Proof<HidingConfig>, public: &[F]) -> bool {
    verify_with_preprocessed(&s.cfg, &s.air, proof, public, Some(&s.vk)).is_ok()
}

fn cmd_prove(n: usize, members: usize) -> bool {
    let leaves = if n == 64 && members == 40 {
        leaves_from_cohort(ASYM, 64)
    } else {
        synthetic(n, members, 0x5eed ^ n as u64)
    };
    let t = Instant::now();
    let s = setup(n, members);
    let setup_ms = t.elapsed().as_millis();
    let st = statement(&Hasher::default(), &leaves);
    let f = figure(&s.air, PARAMS);
    let mut ok = f.proven >= TARGET_PROVEN_BITS;
    println!(
        "PQ10 SECURITY n={n}: proven {} bits (unique {}, list {}), conjectured {} bits (a conjecture), target {TARGET_PROVEN_BITS}; log_blowup {} queries {} query-PoW {} bits; height {} width {}",
        f.proven,
        f.proven_unique,
        f.proven_list,
        f.conjectured,
        PARAMS.log_blowup,
        PARAMS.num_queries,
        PARAMS.query_pow_bits,
        s.air.height,
        s.air.total_width()
    );
    for (kind, count) in [(0u8, st.dead), (1u8, st.live)] {
        let public = public_values(&st.root, kind, count);
        let t = Instant::now();
        let Some(proof) = prove(&s, &leaves, &public) else {
            println!("PQ10 SCALE n={n} kind={kind}: the honest proof FAILED to prove");
            ok = false;
            continue;
        };
        let prove_ms = t.elapsed().as_millis();
        let t = Instant::now();
        let good = verifies(&s, &proof, &public);
        let verify_us = t.elapsed().as_micros();
        let bytes = postcard::to_allocvec(&proof).expect("serialize").len();
        ok &= good;
        println!(
            "PQ10 SCALE n={n} members={members} kind={kind} count={count}: prove {prove_ms} ms, verify {verify_us} us, proof {bytes} bytes, degree_bits {}, verified {good} (setup {setup_ms} ms)",
            proof.degree_bits
        );
    }
    ok
}

/// Every array under one of `keys`, emptied: the zero-opening shapes.
fn empty_arrays(v: &mut serde_json::Value, keys: &[&str], hits: &mut usize) {
    match v {
        serde_json::Value::Object(m) => {
            for (k, x) in m.iter_mut() {
                if keys.contains(&k.as_str()) && x.is_array() {
                    *x = serde_json::Value::Array(vec![]);
                    *hits += 1;
                } else {
                    empty_arrays(x, keys, hits);
                }
            }
        }
        serde_json::Value::Array(a) => a.iter_mut().for_each(|x| empty_arrays(x, keys, hits)),
        _ => {}
    }
}

fn cmd_forgery() -> bool {
    let (n, members) = (64, 40);
    let leaves = leaves_from_cohort(ASYM, n);
    let h = Hasher::default();
    let st = statement(&h, &leaves);
    let s = setup(n, members);
    let honest = public_values(&st.root, 0, st.dead);

    // the honest control first: a battery whose honest proof fails proves nothing
    let proof = prove(&s, &leaves, &honest).expect("the honest proof");
    let control = verifies(&s, &proof, &honest);
    println!(
        "PQ10 FORGERY control (honest claim kind 0 count {}): {}",
        st.dead,
        if control { "verified" } else { "REFUSED" }
    );
    let mut all = control;
    let mut report = |name: &str, refused: bool| {
        println!(
            "PQ10 FORGERY {name}: {}",
            if refused { "refused" } else { "ACCEPTED" }
        );
        all &= refused;
    };
    let accepted = |leaves: &[Leaf], public: &[F]| {
        prove(&s, leaves, public).is_some_and(|p| verifies(&s, &p, public))
    };

    // statement mutations, each proved from the real witness and checked
    report(
        "wrong count (21 for 20)",
        !accepted(&leaves, &public_values(&st.root, 0, st.dead + 1)),
    );
    report(
        "reversed claim (kind 1, count 20)",
        !accepted(&leaves, &public_values(&st.root, 1, st.dead)),
    );
    report(
        "non-binary kind (2)",
        !accepted(&leaves, &public_values(&st.root, 2, st.dead)),
    );
    let mut other = leaves.clone();
    other[0].fp ^= 1;
    report(
        "wrong root (one fingerprint bit)",
        !accepted(
            &leaves,
            &public_values(&statement(&h, &other).root, 0, st.dead),
        ),
    );
    let mut skipped = leaves.clone();
    skipped[5] = Leaf::default();
    report(
        "skipped receipt (member 5 zeroed, claimed under the real root)",
        !accepted(&skipped, &honest),
    );
    let mut padded = leaves.clone();
    padded[50] = Leaf {
        fp: 7,
        pheno: 0,
        r: [1, 1, 1],
    };
    let ps = statement(&h, &padded);
    report(
        "nonzero pad (slot 50 carries a kept dead member)",
        !accepted(&padded, &public_values(&ps.root, 0, ps.dead)),
    );

    // proof-level mutations against the honest proof
    report(
        "public value swap (count 19 on a count-20 proof)",
        !verifies(&s, &proof, &public_values(&st.root, 0, st.dead - 1)),
    );
    report(
        "public value swap (kind 1 on a kind-0 proof)",
        !verifies(&s, &proof, &public_values(&st.root, 1, st.dead)),
    );
    let s39 = setup(n, members - 1);
    report(
        "members lie (verified against the 39-member key)",
        verify_with_preprocessed(&s39.cfg, &s39.air, &proof, &honest, Some(&s39.vk)).is_err(),
    );
    let bytes = postcard::to_allocvec(&proof).expect("serialize");
    let mut flips = 0;
    let mut flip_refused = 0;
    for k in 0..256 {
        let pos = k * bytes.len() / 256;
        let mut b = bytes.clone();
        b[pos] ^= 0x01;
        flips += 1;
        let refused = match postcard::from_bytes::<Proof<HidingConfig>>(&b) {
            Ok(p) => !verifies(&s, &p, &honest),
            Err(_) => true,
        };
        flip_refused += refused as usize;
    }
    report(
        &format!(
            "one-bit flips at {flips} evenly spaced positions of the {}-byte proof ({flip_refused} refused)",
            bytes.len()
        ),
        flip_refused == flips,
    );
    let truncated = postcard::from_bytes::<Proof<HidingConfig>>(&bytes[..bytes.len() - 1])
        .map(|p| !verifies(&s, &p, &honest))
        .unwrap_or(true);
    report("truncated by one byte", truncated);

    // T-VACUOUS: the zero-opening shapes (SPEC §2)
    let mut v = serde_json::to_value(&proof).expect("json");
    let mut hits = 0;
    empty_arrays(&mut v, &["commit_phase_openings"], &mut hits);
    let refused = hits > 0
        && serde_json::from_value::<Proof<HidingConfig>>(v)
            .map(|p| !verifies(&s, &p, &honest))
            .unwrap_or(true);
    report(
        &format!("T-VACUOUS no commit-phase openings ({hits} arrays emptied)"),
        refused,
    );
    let mut v = serde_json::to_value(&proof).expect("json");
    let mut hits = 0;
    empty_arrays(&mut v, &["sibling_values", "opened_values"], &mut hits);
    let refused = hits > 0
        && serde_json::from_value::<Proof<HidingConfig>>(v)
            .map(|p| !verifies(&s, &p, &honest))
            .unwrap_or(true);
    report(
        &format!("T-VACUOUS zero queries opened ({hits} arrays emptied)"),
        refused,
    );

    // a different statement's transcript: the same proof under another instance label
    let other_cfg = config::hiding(PARAMS, n, members + 1);
    report(
        "instance label (the proof checked under members = 41's transcript)",
        verify_with_preprocessed(&other_cfg, &s.air, &proof, &honest, Some(&s.vk)).is_err(),
    );
    all
}

const CANON: &str = include_str!("../../../../docs/receipts/ant-reach-cohort-2026-10-06.json");

/// One registered LEAK run (PREREGISTERED-STARK.md): 10 REAL proofs of the
/// canonical cohort, claims alternating, then 10 SIM cohorts, one proof
/// each; a fresh config (fresh OS randomness) and setup for every proof.
macro_rules! leak_samples {
    ($make:expr) => {{
        let (n, members) = (64usize, 40usize);
        let h = Hasher::default();
        let air = CountAir::new(n, members, config::height(n, PARAMS));
        let log_h = air.height.trailing_zeros() as usize;
        let mut samples = Vec::new();
        let mut sim_rng: rand::rngs::StdRng = rand::make_rng();
        for i in 0..20 {
            let (class, set, leaves) = if i < 10 {
                ("REAL", "cohort".to_string(), leaves_from_cohort(CANON, n))
            } else {
                (
                    "SIM",
                    format!("sim-{}", i - 9),
                    btungsten_p3count::leak::sim_cohort(|| rand::Rng::next_u64(&mut sim_rng)),
                )
            };
            let st = statement(&h, &leaves);
            let kind = (i % 2) as u8;
            let count = if kind == 0 { st.dead } else { st.live };
            assert_eq!(
                (st.dead, st.live),
                (20, 20),
                "{class} {set}: every cohort in this experiment is 20/20"
            );
            let public = public_values(&st.root, kind, count);
            let cfg = $make(n, members);
            let (pp, vk) = setup_preprocessed(&cfg, &air, log_h)
                .expect("commit")
                .expect("preprocessed");
            let w = generate(&h, &air, &leaves);
            let proof = prove_with_preprocessed(&cfg, &air, w.trace, &public, Some(&pp))
                .expect("honest proof");
            assert!(
                verify_with_preprocessed(&cfg, &air, &proof, &public, Some(&vk)).is_ok(),
                "honest proof verifies"
            );
            println!("PQ10 LEAK proof {i}: class {class}, set {set}, claim ({kind}, {count})");
            samples.push(btungsten_p3count::leak::sample(
                class,
                set,
                kind,
                &serde_json::to_value(&proof).expect("json"),
            ));
        }
        samples
    }};
}

fn cmd_leak() -> bool {
    let hiding = leak_samples!(|n, m| config::hiding(PARAMS, n, m));
    let v = btungsten_p3count::leak::judge("PQ10 LEAK hiding", &hiding);
    v.lines.iter().for_each(|l| println!("{l}"));
    let plain = leak_samples!(|n, m| config::plain(PARAMS, n, m));
    let t = btungsten_p3count::leak::judge("PQ10 LEAK TEETH non-hiding", &plain);
    t.lines.iter().for_each(|l| println!("{l}"));
    let teeth = !t.pass;
    println!(
        "PQ10 LEAK TEETH: the non-hiding control {} the registered criterion",
        if teeth {
            "FAILS, as it must,"
        } else {
            "PASSES, so the harness is broken and the hiding result is void:"
        }
    );
    v.pass && teeth
}

/// v2 (PREREGISTERED-STARK-v2.md): new proofs, permutation families.
fn cmd_leak_v2() -> bool {
    let mut rng: rand::rngs::StdRng = rand::make_rng();
    let hiding = leak_samples!(|n, m| config::hiding(PARAMS, n, m));
    let v = btungsten_p3count::leak::judge_v2("PQ10 LEAK-v2 hiding", &hiding, 2000, || {
        rand::Rng::next_u64(&mut rng)
    });
    v.lines.iter().for_each(|l| println!("{l}"));
    let plain = leak_samples!(|n, m| config::plain(PARAMS, n, m));
    let t =
        btungsten_p3count::leak::judge_v2("PQ10 LEAK-v2 TEETH non-hiding", &plain, 2000, || {
            rand::Rng::next_u64(&mut rng)
        });
    t.lines.iter().for_each(|l| println!("{l}"));
    // the registered teeth: the non-hiding control must fail criterion (a), linkability
    let teeth = t
        .lines
        .iter()
        .any(|l| l.contains("G0 linkability") && l.ends_with("SEPARATES"));
    println!(
        "PQ10 LEAK-v2 TEETH: the non-hiding control {} criterion (a)",
        if teeth {
            "FAILS, as it must,"
        } else {
            "PASSES, so the harness is broken and the hiding result is void:"
        }
    );
    v.pass && teeth
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let ok = match args.get(1).map(String::as_str) {
        Some("prove") => {
            let n = args.get(2).and_then(|s| s.parse().ok()).expect("n");
            let m = args.get(3).and_then(|s| s.parse().ok()).expect("members");
            cmd_prove(n, m)
        }
        Some("forgery") => cmd_forgery(),
        Some("leak") => cmd_leak(),
        Some("leak-v2") => cmd_leak_v2(),
        _ => {
            eprintln!(
                "usage: p3count prove <n> <members> | p3count forgery | p3count leak | p3count leak-v2"
            );
            false
        }
    };
    if ok {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
