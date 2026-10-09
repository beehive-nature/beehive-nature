//! Prints p3-security's proven and conjectured bits for this AIR over a
//! grid of FRI parameters, so the parameters PQ10 uses are chosen by
//! computation. usage: p3count-scan [n]
use btungsten_p3count::air::CountAir;
use btungsten_p3count::config::{self, Params};
use btungsten_p3count::security::figure;

fn main() {
    let n: usize = std::env::args()
        .nth(1)
        .map_or(64, |s| s.parse().expect("n"));
    println!("PQ10-SCAN n={n}: log_blowup queries pow -> height proven(unique/list) conjectured");
    for log_blowup in [1, 2, 3, 4] {
        for pow in [0, 16, 20] {
            let mut best = None;
            for q in (8..=400).step_by(4) {
                let p = Params {
                    log_blowup,
                    num_queries: q,
                    query_pow_bits: pow,
                };
                let air = CountAir::new(n, n, config::height(n, p));
                let f = figure(&air, p);
                if f.proven >= 100 {
                    best = Some((p, air.height, f));
                    break;
                }
                if q + 4 > 400 {
                    best = Some((p, air.height, f));
                }
            }
            if let Some((p, h, f)) = best {
                println!(
                    "PQ10-SCAN {} {} {} -> {} {}({}/{}) {}",
                    p.log_blowup,
                    p.num_queries,
                    p.query_pow_bits,
                    h,
                    f.proven,
                    f.proven_unique,
                    f.proven_list,
                    f.conjectured
                );
            }
        }
    }
}
