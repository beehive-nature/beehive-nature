//! `price-feed` — the USDA AMS hemp price series and the **computed small-package penalty**
//! (RELAY_11 deltas 1–2).
//!
//! **Tier R applied to a price feed.** BNR's price index is built on the free, official, weekly
//! **USDA AMS National Weekly Hemp Report (FVHEMP)** — retail advertised prices for shelled hemp
//! seed (= hulled hearts), by package size — *not* on a licensed benchmark. The whole point of
//! Tier R is that any stranger can reproduce the number from the same public PDF; a subscriber-only
//! benchmark cannot be independently verified by the grower it prices. (It is also structurally
//! lucky: there is no hemp futures contract to reference, and the USDA data is physical — kilograms
//! crossing borders at declared values — so referencing it prices delivery, not an index. k002
//! holds by construction, not by our restraint.)
//!
//! Two honesty disciplines, both load-bearing and both the *type*, not a later bolt-on:
//!
//! 1. **A failed OR stale fetch is [`PriceReading::NotMeasured`], never a stale price rendered as
//!    current.** The weekly report is a PDF fetched over the network — an impure, platform-bound,
//!    fallible read. [`read_price`] turns a fetch error into NotMeasured *and* turns a fetch that
//!    merely succeeds with an old report into NotMeasured. A price a week stale that renders as
//!    "this week's" is the same lie as a stale gauge showing a number (D-14 Law 1d) — worse than
//!    no price.
//!
//! 2. **The package-size penalty is COMPUTED, and carries its full derivation** — the way the
//!    dashboard's `Headroom` carries its inputs. [`PackageSizePenalty`] holds both price points in
//!    full (each package's price, size, and derived `$/lb`) alongside the premium, and the premium
//!    is a function of them a reader re-derives. It is USDA's own weekly survey, arithmetic done in
//!    public: the person who can only afford the small bag pays up to ~31% more per pound. That is
//!    "the disclosure mission pointed at a number nobody bothers to divide" — a surface, not a
//!    footnote — so it must be re-checkable, not asserted.
//!
//! **The live fetcher is a deferred handoff.** The pure model and the [`PriceReportSource`] seam
//! ship now and test on any host with no network or PDF dependency. The real `UsdaAmsFetcher`
//! (HTTP + PDF parse) is a later, platform-bound commit — the same shape as the shell's Linux-only
//! COSMIC window — and any live fetch of the federal PDF is gated on a founder go. What is
//! guaranteed *today* is the contract: whatever the fetcher does, a failed or stale result is
//! NotMeasured by the return type, so the honesty cannot be dropped when the fetcher lands.

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// Ounces per pound — the constant that turns a package price into a `$/lb` (the one comparable
/// unit across package sizes).
pub const OZ_PER_LB: f64 = 16.0;

/// A weekly report older than this (seconds) is treated as stale by [`read_price`]. Two weeks: one
/// weekly cycle plus publication-lag grace. The report is weekly; anything older is not "current".
pub const STALE_AFTER_SECS: i64 = 14 * 24 * 3600;

/// Product grade as USDA surveys it. The penalty is computed *within* a grade — organic and
/// conventional are different markets and must not be cross-normalised.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Grade {
    Conventional,
    Organic,
}

/// One advertised package from the weekly report, carrying its inputs and its derived `$/lb`.
/// `per_lb_usd` is a pure function of `package_price_usd` and `package_oz`; it is stored for a
/// consumer and re-derivable by a verifier (see [`PricePoint::recompute_per_lb`]).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PricePoint {
    pub grade: Grade,
    /// Package size in ounces (as advertised).
    pub package_oz: f64,
    /// Advertised package price in USD.
    pub package_price_usd: f64,
    /// Derived: price normalised to `$/lb`. = `package_price_usd * OZ_PER_LB / package_oz`.
    pub per_lb_usd: f64,
}

impl PricePoint {
    /// Build a point, deriving `$/lb` from the package price and size. The derivation lives here,
    /// in code; the inputs live in the struct — so the stored `per_lb_usd` is never an accepted
    /// number, always a computed one.
    pub fn new(grade: Grade, package_oz: f64, package_price_usd: f64) -> PricePoint {
        PricePoint {
            grade,
            package_oz,
            package_price_usd,
            per_lb_usd: Self::compute_per_lb(package_oz, package_price_usd),
        }
    }

    fn compute_per_lb(package_oz: f64, package_price_usd: f64) -> f64 {
        package_price_usd * OZ_PER_LB / package_oz
    }

    /// Re-derive `$/lb` from this point's own inputs — the verifier's side of "carries its
    /// derivation". A stored `per_lb_usd` that disagrees with this is a corrupted record.
    pub fn recompute_per_lb(&self) -> f64 {
        Self::compute_per_lb(self.package_oz, self.package_price_usd)
    }
}

/// A week's price series, sourced to a specific FVHEMP report. Carries the report's own identity
/// (`week_ending`, `as_of_unix`) and its `source` URL, because a Tier-R number is only Tier-R if a
/// reader can go to the same PDF.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PriceSeries {
    /// Human week-ending date of the report, e.g. "2026-04-29".
    pub week_ending: String,
    /// Week-ending as a unix timestamp — the machine-checkable age, for the staleness gate.
    pub as_of_unix: i64,
    /// The report this was read from — reproducible by any stranger from the same PDF.
    pub source: String,
    pub points: Vec<PricePoint>,
}

impl PriceSeries {
    /// The small-package penalties for one grade: for each package more expensive per pound than
    /// that grade's cheapest-per-lb option, the premium it carries. See [`PackageSizePenalty`].
    pub fn penalties_for(&self, grade: Grade) -> Vec<PackageSizePenalty> {
        PackageSizePenalty::derive_for_grade(grade, &self.points)
    }
}

/// A price reading: **measured** from a fresh report, or honestly **not measured** with its reason.
/// There is deliberately no "stale price" arm — a stale price does not get to be a reading.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PriceReading {
    /// Priced from a specific, fresh weekly report.
    Measured(PriceSeries),
    /// No current price — fetch failed, or the latest report is stale. Carries why.
    NotMeasured { reason: String },
}

impl PriceReading {
    pub fn is_measured(&self) -> bool {
        matches!(self, PriceReading::Measured(_))
    }
    pub fn reason(&self) -> Option<&str> {
        match self {
            PriceReading::NotMeasured { reason } => Some(reason.as_str()),
            PriceReading::Measured(_) => None,
        }
    }
}

/// The **computed** small-package penalty for one package, within one grade. The penalty is the
/// premium this package's `$/lb` carries over the grade's cheapest-per-lb option.
///
/// It carries its full derivation: both [`PricePoint`]s in full (each with its own price, size, and
/// `$/lb`) and the derived `premium_fraction`. A reader re-divides USDA's numbers and gets the same
/// premium — [`PackageSizePenalty::recompute_premium`] is that check. This is the disclosure
/// mission pointed at a number nobody bothers to divide, so it must be re-checkable, not asserted.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PackageSizePenalty {
    pub grade: Grade,
    /// The cheapest-per-lb option for this grade — the honest baseline (not merely "the largest
    /// package"; the best per-pound deal actually offered).
    pub baseline: PricePoint,
    /// The package being compared — more expensive per pound than the baseline.
    pub smaller: PricePoint,
    /// Derived: the premium as a fraction (0.23 = +23%). = `smaller.per_lb / baseline.per_lb - 1`.
    pub premium_fraction: f64,
}

impl PackageSizePenalty {
    /// Derive every small-package penalty for `grade` from a week's points. The baseline is the
    /// **cheapest per lb** option that grade offers; a penalty is produced for each package strictly
    /// more expensive per pound, sorted worst-first so the headline penalty leads. Empty if the
    /// grade has fewer than two distinct per-lb prices (no penalty to compute).
    pub fn derive_for_grade(grade: Grade, points: &[PricePoint]) -> Vec<PackageSizePenalty> {
        let of_grade: Vec<&PricePoint> = points.iter().filter(|p| p.grade == grade).collect();
        // Baseline = the cheapest per lb. min_by on partial_cmp; NaN prices would be malformed input
        // upstream, so total_cmp-free partial_cmp with a stable fallback is fine here.
        let baseline = match of_grade.iter().min_by(|a, b| {
            a.per_lb_usd
                .partial_cmp(&b.per_lb_usd)
                .unwrap_or(std::cmp::Ordering::Equal)
        }) {
            Some(b) => (*b).clone(),
            None => return Vec::new(),
        };

        let mut penalties: Vec<PackageSizePenalty> = of_grade
            .iter()
            .filter(|p| p.per_lb_usd > baseline.per_lb_usd)
            .map(|p| {
                let smaller = (*p).clone();
                let premium_fraction = smaller.per_lb_usd / baseline.per_lb_usd - 1.0;
                PackageSizePenalty {
                    grade,
                    baseline: baseline.clone(),
                    smaller,
                    premium_fraction,
                }
            })
            .collect();

        // Worst penalty first — the person paying the most per pound leads the surface.
        penalties.sort_by(|a, b| {
            b.premium_fraction
                .partial_cmp(&a.premium_fraction)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        penalties
    }

    /// Re-derive the premium from the two points' own `$/lb` — the verifier's side. The stored
    /// `premium_fraction` must equal this; if it does not, the record was tampered, not computed.
    pub fn recompute_premium(&self) -> f64 {
        self.smaller.per_lb_usd / self.baseline.per_lb_usd - 1.0
    }

    /// The premium as a whole-number percent, e.g. 23 or 31 — the figure that goes on the surface.
    pub fn premium_pct_rounded(&self) -> i64 {
        (self.premium_fraction * 100.0).round() as i64
    }
}

/// The seam to the federal feed. The real implementation fetches and parses the weekly FVHEMP PDF;
/// it lives behind this trait because the fetch is impure and platform-bound (network + PDF), and —
/// like the shell's COSMIC window — the live fetcher is a deferred handoff. What is fixed in-tree
/// today is the **contract**: a fetch either yields a parsed series for a known week, or it fails
/// with a reason. There is no third "returned something stale silently" option — staleness is the
/// caller's gate in [`read_price`], not the source's secret.
pub trait PriceReportSource {
    /// Fetch and parse the latest weekly report, or fail with a human reason.
    fn fetch_latest(&self) -> Result<PriceSeries, FetchFailure>;
}

/// Why a fetch could not produce a current price. Rendered into a [`PriceReading::NotMeasured`]
/// reason — a fetch failure is a stated absence, never a silent fallback to an old number.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FetchFailure {
    pub reason: String,
}

/// Read the current price, **honestly**. A fetch error is [`PriceReading::NotMeasured`]; a fetch
/// that *succeeds* but returns a report older than `max_staleness_secs` is **also** NotMeasured —
/// because a stale price rendered as current is the lie this whole crate exists to refuse. Only a
/// fresh, successfully-parsed report is [`PriceReading::Measured`].
pub fn read_price(src: &dyn PriceReportSource, now: i64, max_staleness_secs: i64) -> PriceReading {
    match src.fetch_latest() {
        Err(f) => PriceReading::NotMeasured {
            reason: format!("no current price: fetch failed — {}", f.reason),
        },
        Ok(series) => {
            let age = now - series.as_of_unix;
            if age > max_staleness_secs {
                PriceReading::NotMeasured {
                    reason: format!(
                        "no current price: latest report (week ending {}) is {age}s old, past the \
                         {max_staleness_secs}s freshness window — a stale price is not rendered as \
                         current",
                        series.week_ending
                    ),
                }
            } else {
                PriceReading::Measured(series)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // FVHEMP week ending 2026-04-29 (RELAY_11 §2), as a unix timestamp.
    const WEEK_2026_04_29: i64 = 1_777_766_400;
    const SOURCE: &str = "https://www.ams.usda.gov/mnreports/fvhemp.pdf";

    /// The real RELAY_11 §2 table — conventional and organic shelled hemp seed.
    fn fvhemp_2026_04_29() -> PriceSeries {
        PriceSeries {
            week_ending: "2026-04-29".to_string(),
            as_of_unix: WEEK_2026_04_29,
            source: SOURCE.to_string(),
            points: vec![
                PricePoint::new(Grade::Conventional, 16.0, 10.39),
                PricePoint::new(Grade::Conventional, 8.0, 6.40),
                PricePoint::new(Grade::Organic, 12.0, 11.43),
                PricePoint::new(Grade::Organic, 7.0, 7.28),
                PricePoint::new(Grade::Organic, 8.0, 9.99),
            ],
        }
    }

    /// A source returning a fixed result — configurable to fail or to hand back any series.
    struct FixedSource(Result<PriceSeries, FetchFailure>);
    impl PriceReportSource for FixedSource {
        fn fetch_latest(&self) -> Result<PriceSeries, FetchFailure> {
            self.0.clone()
        }
    }

    // ── the derived $/lb matches USDA's arithmetic, and carries its inputs ────

    #[test]
    fn per_lb_is_derived_from_price_and_size() {
        let p = PricePoint::new(Grade::Conventional, 8.0, 6.40);
        assert!(
            (p.per_lb_usd - 12.80).abs() < 1e-9,
            "8 oz at $6.40 is $12.80/lb"
        );
        // stored value equals the verifier's recomputation — a computed number, not an accepted one.
        assert_eq!(p.per_lb_usd, p.recompute_per_lb());
    }

    // ── the small-package penalty: computed, matches RELAY_11's 23%/31% ───────

    #[test]
    fn conventional_penalty_is_23_percent_and_re_derivable() {
        let series = fvhemp_2026_04_29();
        let penalties = series.penalties_for(Grade::Conventional);
        assert_eq!(
            penalties.len(),
            1,
            "one smaller package than the 16 oz baseline"
        );
        let pen = &penalties[0];
        assert_eq!(
            pen.baseline.package_oz, 16.0,
            "baseline is the cheapest per lb (the 16 oz)"
        );
        assert_eq!(pen.smaller.package_oz, 8.0);
        assert_eq!(
            pen.premium_pct_rounded(),
            23,
            "8 oz costs +23%/lb over 16 oz (RELAY_11 §3b)"
        );
        // the premium carries its derivation: stored == recomputed from the two points.
        assert!((pen.premium_fraction - pen.recompute_premium()).abs() < 1e-12);
    }

    #[test]
    fn organic_worst_penalty_is_31_percent_and_leads() {
        let series = fvhemp_2026_04_29();
        let penalties = series.penalties_for(Grade::Organic);
        // two packages dearer per lb than the 12 oz baseline: the 8 oz (+31%) and the 7 oz (+9%).
        assert_eq!(penalties.len(), 2);
        assert_eq!(
            penalties[0].baseline.package_oz, 12.0,
            "baseline is the cheapest per lb"
        );
        // worst-first: the 8 oz at +31% leads the surface, not the milder 7 oz.
        assert_eq!(penalties[0].smaller.package_oz, 8.0);
        assert_eq!(
            penalties[0].premium_pct_rounded(),
            31,
            "organic 8 oz is +31%/lb (RELAY_11 §3b)"
        );
        assert!(penalties[1].premium_fraction < penalties[0].premium_fraction);
    }

    #[test]
    fn baseline_is_the_cheapest_per_lb_not_merely_the_largest_package() {
        // Positive control for the honest baseline. Here the LARGEST package is NOT the cheapest per
        // lb (a bulk bag priced badly). The penalty must key off min $/lb, or it would understate
        // the harm — the whole finding is "cheapest available per lb vs what you actually pay".
        let points = vec![
            PricePoint::new(Grade::Conventional, 32.0, 40.00), // 32 oz, $20.00/lb — biggest, but dear
            PricePoint::new(Grade::Conventional, 16.0, 10.00), // 16 oz, $10.00/lb — the real cheapest
            PricePoint::new(Grade::Conventional, 8.0, 6.00),   // 8 oz,  $12.00/lb
        ];
        let penalties = PackageSizePenalty::derive_for_grade(Grade::Conventional, &points);
        assert_eq!(
            penalties[0].baseline.package_oz, 16.0,
            "baseline is the cheapest per lb (16 oz), not the largest (32 oz)"
        );
        // and the 32 oz bulk bag is itself flagged as a +100% penalty over the real best deal.
        let bulk = penalties
            .iter()
            .find(|p| p.smaller.package_oz == 32.0)
            .unwrap();
        assert_eq!(bulk.premium_pct_rounded(), 100);
    }

    // ── fetch honesty: a failed OR stale fetch is NotMeasured, never a current-looking price ──

    #[test]
    fn a_fresh_fetch_is_measured() {
        let src = FixedSource(Ok(fvhemp_2026_04_29()));
        // "now" one day after the report — well inside the window.
        let reading = read_price(&src, WEEK_2026_04_29 + 24 * 3600, STALE_AFTER_SECS);
        assert!(reading.is_measured());
    }

    #[test]
    fn a_failed_fetch_is_notmeasured_with_its_reason() {
        let src = FixedSource(Err(FetchFailure {
            reason: "USDA host returned 503".to_string(),
        }));
        let reading = read_price(&src, WEEK_2026_04_29, STALE_AFTER_SECS);
        assert!(!reading.is_measured());
        assert!(
            reading.reason().unwrap().contains("503"),
            "the reason names the failure"
        );
    }

    #[test]
    fn a_stale_report_is_notmeasured_never_rendered_current() {
        // The founder's flagged case: the fetch SUCCEEDS but hands back an old report. It must not
        // become a Measured price wearing this week's date. now = report + 30 days > the 14-day
        // window.
        let src = FixedSource(Ok(fvhemp_2026_04_29()));
        let now = WEEK_2026_04_29 + 30 * 24 * 3600;
        let reading = read_price(&src, now, STALE_AFTER_SECS);
        assert!(
            !reading.is_measured(),
            "a stale-but-successful fetch is NOT a current price"
        );
        let reason = reading.reason().unwrap();
        assert!(
            reason.contains("stale"),
            "the reason says the price is stale"
        );
        assert!(reason.contains("2026-04-29"), "and names which report");
    }
}
