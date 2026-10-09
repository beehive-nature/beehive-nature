//! tungsten-2 LEAK, exactly as contracts/zkreceipts/leak/PREREGISTERED-STARK.md
//! registers it: the observations, the families F0-F4 and the fixed pass
//! criterion. The proving loop lives in the runner; this module only turns
//! proofs into observations and observations into verdicts.

use serde_json::Value;
use statrs::distribution::{Beta, ChiSquared, ContinuousCDF, StudentsT};

use crate::statement::Leaf;

/// One proof as the adversary sees it.
pub struct Sample {
    pub class: &'static str,
    pub set: String,
    pub kind: u8,
    /// numbers of the fixed-shape part, in order
    pub fixed: Vec<u64>,
    /// numbers of the FRI multi-opening proofs, in order
    pub openings: Vec<u64>,
    pub trace_commit: String,
    pub quotient_commit: String,
    pub trace_local: Vec<u64>,
}

const OPENING_KEYS: [&str; 2] = ["input_openings", "commit_phase_openings"];

fn numbers(v: &Value, in_openings: bool, fixed: &mut Vec<u64>, openings: &mut Vec<u64>) {
    match v {
        Value::Number(n) => {
            let x = n
                .as_u64()
                .unwrap_or_else(|| n.as_i64().map_or(0, |i| i as u64));
            if in_openings {
                openings.push(x)
            } else {
                fixed.push(x)
            }
        }
        Value::Array(a) => a
            .iter()
            .for_each(|x| numbers(x, in_openings, fixed, openings)),
        Value::Object(m) => {
            for (k, x) in m {
                numbers(
                    x,
                    in_openings || OPENING_KEYS.contains(&k.as_str()),
                    fixed,
                    openings,
                );
            }
        }
        _ => {}
    }
}

pub fn sample(class: &'static str, set: String, kind: u8, proof_json: &Value) -> Sample {
    let (mut fixed, mut openings) = (Vec::new(), Vec::new());
    numbers(proof_json, false, &mut fixed, &mut openings);
    let mut trace_local = Vec::new();
    numbers(
        &proof_json["opened_values"]["trace_local"],
        false,
        &mut trace_local,
        &mut Vec::new(),
    );
    Sample {
        class,
        set,
        kind,
        fixed,
        openings,
        trace_commit: proof_json["commitments"]["trace"].to_string(),
        quotient_commit: proof_json["commitments"]["quotient_chunks"].to_string(),
        trace_local,
    }
}

/// A synthetic 40-member cohort engineered to 20 dead-kept and 20 live-kept,
/// random fingerprints and settled patterns, padded to 64 (the SIM class).
pub fn sim_cohort(mut next: impl FnMut() -> u64) -> Vec<Leaf> {
    let mut v: Vec<Leaf> = (0..40)
        .map(|i| {
            let pheno = (i % 2) as u8;
            let x = next();
            // at least one settled run, every settled run the baseline's own verdict
            let mut r = [0u8; 3];
            for (k, slot) in r.iter_mut().enumerate() {
                if (x >> k) & 1 == 1 {
                    *slot = 1 + pheno;
                }
            }
            if r == [0, 0, 0] {
                r[(x >> 3) as usize % 3] = 1 + pheno;
            }
            Leaf {
                fp: next(),
                pheno,
                r,
            }
        })
        .collect();
    // shuffle (Fisher-Yates) so the baselines do not alternate
    for i in (1..v.len()).rev() {
        let j = (next() % (i as u64 + 1)) as usize;
        v.swap(i, j);
    }
    v.resize(64, Leaf::default());
    v
}

fn welch_p(a: &[f64], b: &[f64]) -> f64 {
    let mean = |x: &[f64]| x.iter().sum::<f64>() / x.len() as f64;
    let var =
        |x: &[f64], m: f64| x.iter().map(|y| (y - m).powi(2)).sum::<f64>() / (x.len() as f64 - 1.0);
    let (ma, mb) = (mean(a), mean(b));
    let (va, vb) = (var(a, ma), var(b, mb));
    let (na, nb) = (a.len() as f64, b.len() as f64);
    if va == 0.0 && vb == 0.0 {
        return if ma == mb { f64::NAN } else { 0.0 }; // NaN = excluded constant
    }
    let se2 = va / na + vb / nb;
    let t = (ma - mb) / se2.sqrt();
    let df = se2.powi(2) / ((va / na).powi(2) / (na - 1.0) + (vb / nb).powi(2) / (nb - 1.0));
    let dist = StudentsT::new(0.0, 1.0, df).expect("df > 0");
    2.0 * (1.0 - dist.cdf(t.abs()))
}

fn chi_square_p(a: &[u64], b: &[u64]) -> f64 {
    let (mut ca, mut cb) = ([0f64; 256], [0f64; 256]);
    a.iter().for_each(|x| ca[(x & 0xff) as usize] += 1.0);
    b.iter().for_each(|x| cb[(x & 0xff) as usize] += 1.0);
    let (ta, tb) = (a.len() as f64, b.len() as f64);
    let (mut stat, mut bins) = (0.0, 0usize);
    for k in 0..256 {
        let tot = ca[k] + cb[k];
        if tot == 0.0 {
            continue;
        }
        bins += 1;
        let ea = tot * ta / (ta + tb);
        let eb = tot * tb / (ta + tb);
        stat += (ca[k] - ea).powi(2) / ea + (cb[k] - eb).powi(2) / eb;
    }
    if bins < 2 {
        return 1.0;
    }
    1.0 - ChiSquared::new((bins - 1) as f64).expect("df").cdf(stat)
}

/// Clopper-Pearson 95% interval for k successes in n.
fn clopper_pearson(k: usize, n: usize) -> (f64, f64) {
    let lo = if k == 0 {
        0.0
    } else {
        Beta::new(k as f64, (n - k + 1) as f64)
            .expect("beta")
            .inverse_cdf(0.025)
    };
    let hi = if k == n {
        1.0
    } else {
        Beta::new((k + 1) as f64, (n - k) as f64)
            .expect("beta")
            .inverse_cdf(0.975)
    };
    (lo, hi)
}

pub struct Verdict {
    pub pass: bool,
    pub lines: Vec<String>,
}

/// F0 / G0: pairs sharing a trace commitment, a quotient commitment, or
/// opened trace values.
fn linkability(s: &[Sample]) -> (usize, usize, usize) {
    let mut shared = (0, 0, 0);
    for i in 0..s.len() {
        for j in i + 1..s.len() {
            shared.0 += (s[i].trace_commit == s[j].trace_commit) as usize;
            shared.1 += (s[i].quotient_commit == s[j].quotient_commit) as usize;
            shared.2 += (s[i].trace_local == s[j].trace_local) as usize;
        }
    }
    shared
}

fn histogram(xs: &[u64]) -> [f64; 256] {
    let mut h = [0f64; 256];
    xs.iter().for_each(|x| h[(x & 0xff) as usize] += 1.0);
    h
}

fn chi_square_stat(a: &[f64; 256], b: &[f64; 256]) -> f64 {
    let (ta, tb): (f64, f64) = (a.iter().sum(), b.iter().sum());
    let mut stat = 0.0;
    for k in 0..256 {
        let tot = a[k] + b[k];
        if tot == 0.0 {
            continue;
        }
        let (ea, eb) = (tot * ta / (ta + tb), tot * tb / (ta + tb));
        stat += (a[k] - ea).powi(2) / ea + (b[k] - eb).powi(2) / eb;
    }
    stat
}

/// v2 (PREREGISTERED-STARK-v2.md): G0, then G1-G4 judged by `perms`
/// permutations of the proof labels drawn from `next`.
pub fn judge_v2(label: &str, s: &[Sample], perms: usize, mut next: impl FnMut() -> u64) -> Verdict {
    let mut lines = Vec::new();
    let n = s.len();
    let shared = linkability(s);
    let g0 = shared == (0, 0, 0);
    lines.push(format!(
        "{label} G0 linkability: {} pairs share the trace commitment, {} the quotient commitment, {} the opened trace values -> {}",
        shared.0, shared.1, shared.2, if g0 { "pass" } else { "SEPARATES" }
    ));
    let width = s[0].fixed.len();
    if s.iter().any(|x| x.fixed.len() != width)
        || s.iter()
            .any(|x| x.trace_local.len() != s[0].trace_local.len())
    {
        lines.push(format!(
            "{label}: the fixed-shape part does not align across proofs -> FAIL"
        ));
        return Verdict { pass: false, lines };
    }
    let values: Vec<Vec<f64>> = s
        .iter()
        .map(|x| x.fixed.iter().map(|&v| (v % (1 << 31)) as f64).collect())
        .collect();
    let pops: Vec<Vec<f64>> = s
        .iter()
        .map(|x| {
            x.fixed
                .iter()
                .map(|&v| (v as u32).count_ones() as f64)
                .collect()
        })
        .collect();
    let h_trace: Vec<[f64; 256]> = s.iter().map(|x| histogram(&x.trace_local)).collect();
    let h_open: Vec<[f64; 256]> = s.iter().map(|x| histogram(&x.openings)).collect();
    let cents: Vec<Vec<f64>> = s
        .iter()
        .map(|x| {
            x.trace_local
                .iter()
                .map(|&v| (v % (1 << 31)) as f64)
                .collect()
        })
        .collect();

    let min_p = |feat: &Vec<Vec<f64>>, lab: &[bool]| -> f64 {
        let mut m: f64 = 1.0;
        for k in 0..width {
            let a: Vec<f64> = (0..n).filter(|&i| lab[i]).map(|i| feat[i][k]).collect();
            let b: Vec<f64> = (0..n).filter(|&i| !lab[i]).map(|i| feat[i][k]).collect();
            let p = welch_p(&a, &b);
            if !p.is_nan() {
                m = m.min(p);
            }
        }
        m
    };
    let chi = |lab: &[bool]| -> f64 {
        let sum = |hs: &Vec<[f64; 256]>, want: bool| -> [f64; 256] {
            let mut t = [0f64; 256];
            (0..n)
                .filter(|&i| lab[i] == want)
                .for_each(|i| (0..256).for_each(|k| t[k] += hs[i][k]));
            t
        };
        chi_square_stat(&sum(&h_trace, true), &sum(&h_trace, false))
            + chi_square_stat(&sum(&h_open, true), &sum(&h_open, false))
    };
    let centroid_gap = |lab: &[bool]| -> f64 {
        let mut correct = 0;
        for i in 0..n {
            let centroid = |want: bool| -> Vec<f64> {
                let members: Vec<&Vec<f64>> = (0..n)
                    .filter(|&j| j != i && lab[j] == want)
                    .map(|j| &cents[j])
                    .collect();
                (0..cents[i].len())
                    .map(|d| members.iter().map(|m| m[d]).sum::<f64>() / members.len() as f64)
                    .collect()
            };
            let dist = |c: &[f64]| {
                cents[i]
                    .iter()
                    .zip(c)
                    .map(|(a, b)| (a - b).powi(2))
                    .sum::<f64>()
            };
            let guess = dist(&centroid(true)) <= dist(&centroid(false));
            correct += (guess == lab[i]) as usize;
        }
        (correct as f64 / n as f64 - 0.5).abs()
    };

    let observed: Vec<bool> = s.iter().map(|x| x.class == "REAL").collect();
    let obs = [
        min_p(&values, &observed),
        min_p(&pops, &observed),
        chi(&observed),
        centroid_gap(&observed),
    ];
    let mut extreme = [0usize; 4];
    let mut lab = observed.clone();
    for _ in 0..perms {
        for i in (1..n).rev() {
            let j = (next() % (i as u64 + 1)) as usize;
            lab.swap(i, j);
        }
        let st = [
            min_p(&values, &lab),
            min_p(&pops, &lab),
            chi(&lab),
            centroid_gap(&lab),
        ];
        extreme[0] += (st[0] <= obs[0]) as usize;
        extreme[1] += (st[1] <= obs[1]) as usize;
        extreme[2] += (st[2] >= obs[2]) as usize;
        extreme[3] += (st[3] >= obs[3]) as usize;
    }
    let mut pass = g0;
    for (k, name) in [
        "G1 positional values (min Welch p)",
        "G2 positional popcounts (min Welch p)",
        "G3 low bytes (chi-square sum)",
        "G4 nearest centroid (|accuracy - 0.5|)",
    ]
    .iter()
    .enumerate()
    {
        let p = (1 + extreme[k]) as f64 / (1 + perms) as f64;
        let ok = p > 0.0125;
        pass &= ok;
        lines.push(format!("{label} {name}: observed {:.4e}, permutation p {p:.4} over {perms} (threshold 0.0125) -> {}", obs[k], if ok { "pass" } else { "SEPARATES" }));
    }
    lines.push(format!(
        "{label} VERDICT: {}",
        if pass {
            "PASS (no registered family separated REAL from SIM)"
        } else {
            "FAIL (a registered family separated the classes)"
        }
    ));
    Verdict { pass, lines }
}

/// The registered families and criterion over the 20 samples.
pub fn judge(label: &str, s: &[Sample]) -> Verdict {
    let mut lines = Vec::new();
    let mut pass = true;

    // F0 linkability
    let mut shared = (0, 0, 0);
    for i in 0..s.len() {
        for j in i + 1..s.len() {
            shared.0 += (s[i].trace_commit == s[j].trace_commit) as usize;
            shared.1 += (s[i].quotient_commit == s[j].quotient_commit) as usize;
            shared.2 += (s[i].trace_local == s[j].trace_local) as usize;
        }
    }
    let f0 = shared == (0, 0, 0);
    pass &= f0;
    lines.push(format!(
        "{label} F0 linkability: {} pairs share the trace commitment, {} the quotient commitment, {} the opened trace values -> {}",
        shared.0, shared.1, shared.2, if f0 { "pass" } else { "SEPARATES" }
    ));

    let (real, sim): (Vec<&Sample>, Vec<&Sample>) = s.iter().partition(|x| x.class == "REAL");
    let width = s[0].fixed.len();
    if s.iter().any(|x| x.fixed.len() != width) {
        lines.push(format!("{label} F1/F2: the fixed-shape part does not align across proofs (registration assumption broken) -> FAIL"));
        return Verdict { pass: false, lines };
    }

    // F1, F2: Welch t per position, Bonferroni over the counted positions
    for (name, f) in [("F1 value mod 2^31", 0usize), ("F2 popcount", 1)] {
        let feat = |x: u64| {
            if f == 0 {
                (x % (1 << 31)) as f64
            } else {
                (x as u32).count_ones() as f64
            }
        };
        let mut ps = Vec::new();
        for k in 0..width {
            let a: Vec<f64> = real.iter().map(|x| feat(x.fixed[k])).collect();
            let b: Vec<f64> = sim.iter().map(|x| feat(x.fixed[k])).collect();
            let p = welch_p(&a, &b);
            if !p.is_nan() {
                ps.push(p);
            }
        }
        let min = ps.iter().cloned().fold(1.0, f64::min);
        let threshold = 0.05 / ps.len().max(1) as f64;
        let ok = min > threshold;
        pass &= ok;
        lines.push(format!(
            "{label} {name}: {} positions counted of {width}, smallest p {min:.3e}, Bonferroni threshold {threshold:.3e} -> {}",
            ps.len(),
            if ok { "pass" } else { "SEPARATES" }
        ));
    }

    // F3 low-byte chi-squares
    for (name, pick) in [
        ("F3a opened trace values", 0usize),
        ("F3b multi-opening proofs", 1),
    ] {
        let pool = |c: &[&Sample]| -> Vec<u64> {
            c.iter()
                .flat_map(|x| {
                    if pick == 0 {
                        x.trace_local.clone()
                    } else {
                        x.openings.clone()
                    }
                })
                .collect()
        };
        let p = chi_square_p(&pool(&real), &pool(&sim));
        let ok = p > 0.025;
        pass &= ok;
        lines.push(format!(
            "{label} {name} low-byte chi-square: p {p:.4} (threshold 0.025) -> {}",
            if ok { "pass" } else { "SEPARATES" }
        ));
    }

    // F4 leave-one-out nearest centroid on the opened trace values
    let vecs: Vec<Vec<f64>> = s
        .iter()
        .map(|x| {
            x.trace_local
                .iter()
                .map(|&v| (v % (1 << 31)) as f64)
                .collect()
        })
        .collect();
    let mut correct = 0;
    for i in 0..s.len() {
        let centroid = |class: &str| -> Vec<f64> {
            let members: Vec<&Vec<f64>> = (0..s.len())
                .filter(|&j| j != i && s[j].class == class)
                .map(|j| &vecs[j])
                .collect();
            (0..vecs[i].len())
                .map(|d| members.iter().map(|m| m[d]).sum::<f64>() / members.len() as f64)
                .collect()
        };
        let dist = |c: &[f64]| {
            vecs[i]
                .iter()
                .zip(c)
                .map(|(a, b)| (a - b).powi(2))
                .sum::<f64>()
        };
        let guess = if dist(&centroid("REAL")) <= dist(&centroid("SIM")) {
            "REAL"
        } else {
            "SIM"
        };
        correct += (guess == s[i].class) as usize;
    }
    let (lo, hi) = clopper_pearson(correct, s.len());
    let ok = lo <= 0.5 && 0.5 <= hi;
    pass &= ok;
    lines.push(format!(
        "{label} F4 nearest centroid (leave-one-out): {correct} of {} correct, 95% interval [{lo:.3}, {hi:.3}] -> {}",
        s.len(),
        if ok { "pass" } else { "SEPARATES" }
    ));
    lines.push(format!(
        "{label} VERDICT: {}",
        if pass {
            "PASS (no pinned family separated REAL from SIM)"
        } else {
            "FAIL (a pinned family separated the classes)"
        }
    ));
    Verdict { pass, lines }
}
