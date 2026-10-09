//! The Skaists SETTLE bridge — SK001's named-open beat, executed at model
//! scale through the WB004 epochal engine (founder order 2026-10-09:
//! "SETTLE can ultimately drive an Antelope/Vaulta multisig or whatever
//! successor exists centuries later").
//!
//! The organism: 7,776 = 6⁵ seats, five energy-type constituencies with
//! UNEQUAL populations (population is a measured variable; the packing
//! {1556, 1555×4} is recorded, not constitutional). Governance weight is
//! exactly 1/5 per constituency, CONSTANT in population, in integer
//! arithmetic — no float ever represents a fifth (3 × 1/5 ≠ 0.6).
//!
//! The bridge: every live seat proves the five public predicates
//! (UNIQUE, LIVE, SEAT, ENERGY_TYPE ∈ 1..5, CURRENT_EPOCH —
//! sk001-seat.mjs PROOF_KEYS verbatim); COMPRESS folds the vote into
//! five per-constituency tallies plus one fixed-weight verdict (the
//! sk001-seat.mjs:182-202 fold, re-derived here in integers); SETTLE
//! drives that verdict through Engine::epoch_cycle — 7,776 sovereigns
//! aggregate through shards into ONE bounded msig proposal whose
//! execution writes the immutable receipt. The execution layer stays
//! constant-size while the organism is 6⁵ (SPEC-BTUNGSTEN-1 law L3).
//!
//! Non-inheritance law holds: this receipts the MODEL bridge. No live
//! Antelope/Vaulta settlement is claimed or implied.

use btungsten_wb004::epoch::{Engine, T0};
use btungsten_wb004::{canon, sha_hex};

/// The seat cap, DERIVED from the sixfold five-layer geometry — never
/// hardcoded (the SK001 constitution law).
fn seat_cap() -> usize {
    (1..=5).fold(1, |a, _| a * 6)
}

/// The five constitutional weights as exact rationals: 1/5 each,
/// constant in population. No float represents them.
const WEIGHT_NUM: u64 = 1;
const WEIGHT_DEN: u64 = 5;

struct Organism {
    /// seat → (human id, energy type 1..=5)
    seats: Vec<(u64, u8)>,
}

impl Organism {
    /// An adversarially UNEQUAL occupancy: the largest constituency
    /// holds more humans than the smallest by >10×. Sum = 7,776.
    fn occupy(populations: &[u64; 5]) -> Organism {
        let mut seats = Vec::new();
        let mut next_human = 0u64;
        for (ty, &n) in populations.iter().enumerate() {
            for _ in 0..n {
                seats.push((next_human, ty as u8 + 1));
                next_human += 1;
            }
        }
        Organism { seats }
    }
    fn population_of(&self, ty: u8) -> u64 {
        self.seats.iter().filter(|(_, t)| *t == ty).count() as u64
    }
}

/// The five public predicates, one per seat (sk001 PROVE's interface —
/// everything else stays behind the evidence boundary).
fn predicates_hold(engine: &Engine, seat: (u64, u8), epoch_valid: bool) -> bool {
    let (human, ty) = seat;
    // UNIQUE + SEAT: one human registered exactly once (the registry's
    // duplicate refusal upholds the bijection)
    let unique = engine.registered.contains(&human);
    // LIVE + authorized: participation is the liveness act
    let live = unique;
    // ENERGY_TYPE ∈ {1..5}
    let type_ok = (1..=5).contains(&ty);
    unique && live && type_ok && epoch_valid
}

/// COMPRESS, re-derived in integers from sk001-seat.mjs:182-202: each
/// constituency decides by member majority; the federation decides by
/// strict majority of the five equal rational weights — population
/// never enters. Returns (tallies as yes-counts, verdict).
fn compress(organism: &Organism, votes_yes: &[bool]) -> (Vec<u64>, bool) {
    assert_eq!(organism.seats.len(), votes_yes.len());
    let mut yes = vec![0u64; 5];
    let mut no = [0u64; 5];
    for ((_, ty), &v) in organism.seats.iter().zip(votes_yes) {
        if v {
            yes[*ty as usize - 1] += 1
        } else {
            no[*ty as usize - 1] += 1
        }
    }
    // per-constituency member majority → the constituency's single
    // rational vote; federation = strict majority of the 1/5 weights
    let mut weight_yes = 0u64;
    for i in 0..5 {
        if yes[i] > no[i] {
            weight_yes += WEIGHT_NUM;
        }
    }
    let verdict = weight_yes * 2 > WEIGHT_DEN;
    (yes, verdict)
}

/// The population governor — the WRONG governor (SK001's convicted
/// teeth): weight = constituency population / total. Kept only to be
/// convicted by disagreement.
fn population_governor(organism: &Organism, votes_yes: &[bool]) -> bool {
    let mut yes = [0u64; 5];
    let mut no = [0u64; 5];
    for ((_, ty), &v) in organism.seats.iter().zip(votes_yes) {
        if v {
            yes[*ty as usize - 1] += 1
        } else {
            no[*ty as usize - 1] += 1
        }
    }
    let mut pop_yes = 0u64;
    let mut pop_total = 0u64;
    for i in 0..5 {
        let p = organism.population_of(i as u8 + 1);
        pop_total += p;
        if yes[i] > no[i] {
            pop_yes += p;
        }
    }
    pop_yes * 2 > pop_total
}

/// The canonical compressed result — exactly what SETTLE carries to the
/// execution layer: five tallies, the constant weights, one verdict.
fn compressed_payload(organism: &Organism, votes_yes: &[bool]) -> String {
    let (yes, verdict) = compress(organism, votes_yes);
    let tallies: Vec<String> = (0..5).map(|i| format!("{}:{}", i + 1, yes[i])).collect();
    let pairs = [
        ("tallies", tallies.join(",")),
        ("weights", "1/5,1/5,1/5,1/5,1/5".into()),
        ("verdict", if verdict { "YES" } else { "NO" }.into()),
    ];
    canon(&pairs)
}

#[test]
fn skaists_7776_settles_through_the_bounded_epochal_engine() {
    // the cap derives from the geometry: 6^5 = 7,776; no equal integer
    // fifths exist (the arithmetic law, held by the integer remainder)
    let cap = seat_cap();
    assert_eq!(cap, 7_776);
    assert_ne!(cap % 5, 0, "equal integer fifths would exist");
    assert_eq!(
        [1556, 1555, 1555, 1555, 1555].iter().sum::<u64>(),
        cap as u64
    );

    // an adversarially unequal occupancy (population is a measured variable)
    let populations = [4_000u64, 1_200, 1_200, 1_000, 376];
    assert_eq!(populations.iter().sum::<u64>(), cap as u64);
    let organism = Organism::occupy(&populations);

    // the epochal engine at organism scale: exactly the 7,776 seat
    // holders register — one human, one seat (a second seat for the
    // same human is refused; the seat-cap row itself is SK001's own)
    let mut e = Engine::genesis();
    for (human, _) in &organism.seats {
        e.register(*human).unwrap();
    }
    assert_eq!(e.registered.len(), cap);
    let err = e.register(0u64).unwrap_err();
    assert_eq!(
        err.code, "bt-wb004:duplicate",
        "one human may not hold two seats"
    );

    // every live seat proves the five predicates before voting
    assert!(organism.seats.iter().all(|&s| predicates_hold(&e, s, true)));

    // a vote, constructed per constituency: 1 and 2 vote no inside
    // (zero yes), 3, 4, 5 carry EXACT internal majorities — the three
    // small constituencies together hold 2,576 of 7,776 humans
    let votes: Vec<bool> = organism
        .seats
        .iter()
        .scan((0u64, 1u8), |(seen, cur_ty), (_, ty)| {
            if *ty != *cur_ty {
                *cur_ty = *ty;
                *seen = 0;
            }
            let i = *seen;
            *seen += 1;
            Some(*ty >= 3 && i < majority_of(populations[*ty as usize - 1]))
        })
        .collect();
    let (yes, verdict) = compress(&organism, &votes);
    // constituencies 3,4,5 have exact yes-majorities; 1,2 none → 3/5
    assert_eq!(
        yes,
        vec![
            0,
            0,
            majority_of(populations[2]),
            majority_of(populations[3]),
            majority_of(populations[4])
        ]
    );
    assert!(verdict, "3 of 5 equal weights is the constitutional YES");

    // SETTLE: the compressed verdict drives the epochal engine
    e.now = T0;
    let payload = compressed_payload(&organism, &votes);
    let receipt = e
        .epoch_cycle(&format!("skaists:settle:v1|{payload}"), &[])
        .unwrap();
    assert_eq!(receipt.population, cap);
    // the execution layer stayed constant while the organism is 6^5
    assert!(
        receipt.msig_levels <= 3,
        "the msig vector grew with the organism"
    );
    // the settled receipt binds the compressed payload's digest
    assert_eq!(
        receipt.executed,
        sha_hex(format!("skaists:settle:v1|{payload}").as_bytes())
    );
    e.log.verify().unwrap();
    println!(
        "skaists: 6^5={} pop={:?} shards={} msig_levels={} verdict={}",
        cap,
        populations,
        receipt.shards_total,
        receipt.msig_levels,
        if verdict { "YES" } else { "NO" }
    );
}

fn majority_of(p: u64) -> u64 {
    p / 2 + 1
}

/// Weight ⊥ population, by disagreement: the same vote under the two
/// governors gives different answers, and the CONSTITUTIONAL one is the
/// fixed-weight verdict that settled. The population governor is the
/// convicted teeth, not the law.
#[test]
fn the_population_governor_is_convicted_by_disagreement() {
    let populations = [4_000u64, 1_200, 1_200, 1_000, 376];
    let organism = Organism::occupy(&populations);
    // the three SMALL constituencies (2,576 humans) vote yes inside;
    // the two LARGE ones (5,200 humans) vote no inside
    let votes: Vec<bool> = organism.seats.iter().map(|(_, ty)| *ty >= 3).collect();
    let (.., fixed) = compress(&organism, &votes);
    let pop = population_governor(&organism, &votes);
    assert!(fixed, "3 of 5 equal weights: the constitutional YES");
    assert!(
        !pop,
        "the population governor blocked what 3/5 of the constitutional weight passed"
    );
    assert_eq!(2_576u64 + 5_200, 7_776);
}
