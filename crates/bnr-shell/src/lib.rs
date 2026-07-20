//! `bnr-shell` — the BNR OSe shell (Lane A, RELAY_19 §6c). The OSe **frame** that carries D-14:
//! it reads `b` balances (kernel-side, so this crate is AGPL like the rest of the kernel) and
//! denominates every surface in BOTH gauges, with the one `b`↔currency rate confined to the draw
//! facility. The D-14 *model* lives in [`denomination`]; this crate WIRES it to the ledger and
//! (in a later commit) frames the COSMIC view.
//!
//! **Frame before features.** The shell's job is not "a window with buttons"; it is the frame
//! that holds the invariant, into which features plug. So the first thing built is the frame and
//! its controls — red-first, before any window opens (the COSMIC view is a later, Linux-only
//! commit; libcosmic does not build on Windows, so it is deferred, not shipped unverified).
//!
//! D-14, binding from line one:
//! - **Both gauges, always.** A `b`-costing surface yields a HUD *with* a `b` gauge or refuses —
//!   [`denomination::Hud::render`] cannot drop a mandated gauge, and this crate never routes
//!   around it.
//! - **No `b`↔currency rate in the shell.** [`frame_surface`] never sets a rate; the one ratio
//!   lives only in the draw facility's own surface ([`denomination::Hud::render_draw_facility`]).
//! - **Law 1d at the pixel.** A `b` gauge whose balance is unfetched/stale **says so** — it is
//!   [`denomination::BGauge::stale`], which renders "—", never a `0`. An empty gauge that reads
//!   `0` is worse than no gauge.
//! - **No Pop/apt/System76 coupling** (RELAY_19 §6a negative control). The shell is an ordinary
//!   Rust crate; a distro-specific dependency fails [`dependency::forbidden_findings`]. This is
//!   what makes the shipped-image base free to be decided later — the shell runs on any base.

#![forbid(unsafe_code)]

use b_token::{Amount, BLedger};
use capability::Did;
use denomination::{BGauge, Hud, HudRefusal, SurfaceKind};

/// Reads a thread's `b` balance for the shell's `b` gauge. **The failure path is Law 1d:** when
/// the balance is unfetched or the read fails, this returns `None`, and the gauge becomes
/// `stale()` — "—", never a `0`.
pub trait BSource {
    /// The thread's current spendable `b`, or `None` if it cannot be vouched for right now.
    fn spendable_b(&self, who: &Did) -> Option<Amount>;
}

/// A [`BSource`] backed by the kernel's in-memory [`BLedger`]. The real shell reads a live /
/// rebuildable view; a failed or absent read returns `None` → a stale gauge. This is the crate's
/// one dependency on `b`: the shell reads balances, it never writes or moves `b`.
pub struct LedgerBSource<'a> {
    pub ledger: &'a BLedger,
}

impl BSource for LedgerBSource<'_> {
    fn spendable_b(&self, who: &Did) -> Option<Amount> {
        Some(self.ledger.spendable_of(who))
    }
}

/// Build the `b` gauge for a surface costing `cost_b`, from a live balance source. A known balance
/// yields a **function reading** ("enough for N") — the capability, not a priceable amount; an
/// unavailable balance yields [`BGauge::stale`] (Law 1d — no number it cannot vouch for).
pub fn b_gauge_for(src: &dyn BSource, who: &Did, cost_b: f64) -> BGauge {
    match src.spendable_b(who) {
        Some(bal) => {
            let bal_f = bal as f64;
            let reading = if cost_b > 0.0 {
                let n = (bal_f / cost_b).floor() as u128;
                format!("enough for {n}")
            } else {
                "available".to_string()
            };
            BGauge::known(bal_f, reading)
        }
        None => BGauge::stale(),
    }
}

/// Frame one surface: assemble its HUD via the D-14 model. A `b`-costing surface carries a `b`
/// gauge read from `src`; a value surface carries money; a surface touching both carries both —
/// and **no surface framed here carries a rate**. Returns a [`HudRefusal`] rather than a HUD
/// missing a mandated gauge or showing a stale number.
pub fn frame_surface(kind: &SurfaceKind, src: &dyn BSource, who: &Did) -> Result<Hud, HudRefusal> {
    let b = match kind {
        SurfaceKind::Function { cost_b, .. } | SurfaceKind::Both { cost_b, .. } => {
            Some(b_gauge_for(src, who, *cost_b))
        }
        SurfaceKind::Value { .. } => None,
    };
    Hud::render(kind, b)
}

/// RELAY_19 §6a negative control: the shell must carry **no Pop/apt/System76-specific coupling**,
/// so the shipped-image base stays free to be decided later and the shell runs on any base.
pub mod dependency {
    /// Distro-coupling substrings forbidden in the shell's dependency or import names.
    ///
    /// **`libcosmic` is deliberately NOT here.** It is the base-agnostic COSMIC toolkit (upstream
    /// at the `pop-os` org, but not Pop-*distro* coupling — it runs on NixOS too); depending on
    /// it is what makes the shell a COSMIC app, not what couples it to Pop. What is forbidden is
    /// the DISTRO: its package manager (`apt`/`dpkg`), System76 hardware/firmware crates, and
    /// Pop's own shell/desktop. So this list is names like `system76-power`, never the `pop-os`
    /// org broadly (which would wrongly flag the whole libcosmic tree — the BNRi_OS finding).
    pub const FORBIDDEN: &[&str] = &[
        "apt",
        "dpkg",
        "debconf",
        "system76-power",
        "system76-firmware",
        "system76_power",
        "pop-shell",
        "pop_shell",
        "pop-desktop",
        "pop_desktop",
        "distinst",
        "pop-installer",
    ];

    /// Scan a Cargo manifest's dependency sections and a source's import lines for a forbidden
    /// distro-coupling name. Scoped to dependency / `use` lines so prose and this list itself do
    /// not self-trip.
    pub fn forbidden_findings(manifest: &str, source: &str) -> Vec<String> {
        let mut hits = Vec::new();
        let mut in_deps = false;
        for line in manifest.lines() {
            let t = line.trim();
            if let Some(section) = t.strip_prefix('[') {
                in_deps = section.contains("dependencies");
                continue;
            }
            if in_deps && !t.is_empty() && !t.starts_with('#') {
                let name = t
                    .split(['=', ' ', '.'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_lowercase();
                if FORBIDDEN.iter().any(|f| name.contains(f)) {
                    hits.push(format!("dep:{name}"));
                }
            }
        }
        for line in source.lines() {
            let t = line.trim();
            if t.starts_with("use ") || t.contains("extern crate ") {
                let l = t.to_lowercase();
                if FORBIDDEN.iter().any(|f| l.contains(f)) {
                    hits.push(format!("import:{t}"));
                }
            }
        }
        hits
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use b_token::{AcceptNonEmptyProof, ResourceProof};
    use denomination::{CurrencyId, Money};

    fn did(s: &str) -> Did {
        Did::new(s)
    }
    fn funded(who: &Did, amt: Amount) -> BLedger {
        let mut l = BLedger::new();
        l.mint(
            who,
            amt,
            &ResourceProof {
                evidence_ref: "seed".into(),
            },
            &AcceptNonEmptyProof,
            1_700_000_000,
        )
        .unwrap();
        l
    }
    fn money(a: f64) -> Money {
        Money {
            amount: a,
            currency: CurrencyId("USD".into()),
        }
    }
    /// A source whose read always fails — the stale path (unfetched / offline).
    struct Unavailable;
    impl BSource for Unavailable {
        fn spendable_b(&self, _who: &Did) -> Option<Amount> {
            None
        }
    }

    // ── D-14 · red-first controls, before the window opens ───────────────────

    #[test]
    fn both_gauges_a_function_surface_carries_its_b_gauge() {
        let a = did("did:example:a");
        let led = funded(&a, 900);
        let src = LedgerBSource { ledger: &led };
        let kind = SurfaceKind::Function {
            cost_b: 300.0,
            function_note: "deploy".into(),
        };
        let hud = frame_surface(&kind, &src, &a).unwrap();
        assert!(
            hud.b.is_some(),
            "a function surface always carries a b gauge"
        );
        assert!(hud.b.as_ref().unwrap().is_showable());
        assert_eq!(hud.b.unwrap().function_reading.unwrap(), "enough for 3");
        assert!(hud.money.is_none());
    }

    #[test]
    fn law_1d_a_stale_balance_says_so_never_a_zero() {
        // Positive control: an unavailable balance yields a stale gauge, and a FUNCTION surface
        // (which must show its b) refuses rather than render a number it cannot vouch for.
        let a = did("did:example:a");
        let kind = SurfaceKind::Function {
            cost_b: 300.0,
            function_note: "deploy".into(),
        };
        assert_eq!(
            frame_surface(&kind, &Unavailable, &a),
            Err(HudRefusal::UnshowableBGauge),
            "a stale b balance must refuse, not render 0 (Law 1d)"
        );
        // and the gauge itself is a stale gauge, not a Known(0).
        assert_eq!(b_gauge_for(&Unavailable, &a, 300.0), BGauge::stale());
    }

    #[test]
    fn no_rate_is_ever_set_by_the_shell() {
        // The one b↔currency ratio belongs to the draw facility alone; nothing the shell frames
        // carries a rate (D-14). Check every ordinary surface kind.
        let a = did("did:example:a");
        let led = funded(&a, 1000);
        let src = LedgerBSource { ledger: &led };
        for kind in [
            SurfaceKind::Function {
                cost_b: 100.0,
                function_note: "f".into(),
            },
            SurfaceKind::Value { amount: money(5.0) },
            SurfaceKind::Both {
                cost_b: 100.0,
                function_note: "f".into(),
                amount: money(5.0),
            },
        ] {
            let hud = frame_surface(&kind, &src, &a).unwrap();
            assert!(hud.rate.is_none(), "the shell never sets a b↔currency rate");
        }
    }

    #[test]
    fn a_both_surface_carries_both_gauges() {
        let a = did("did:example:a");
        let led = funded(&a, 1000);
        let src = LedgerBSource { ledger: &led };
        let kind = SurfaceKind::Both {
            cost_b: 250.0,
            function_note: "deploy+fee".into(),
            amount: money(12.0),
        };
        let hud = frame_surface(&kind, &src, &a).unwrap();
        assert!(
            hud.b.is_some() && hud.money.is_some(),
            "both gauges present"
        );
        assert!(hud.rate.is_none());
    }

    // ── RELAY_19 §6a · the no-Pop-coupling negative control ──────────────────

    #[test]
    fn pop_dependency_lint_bites_and_the_shell_is_clean() {
        use dependency::forbidden_findings;
        // positive control: a Pop/apt/System76 dependency or import MUST be caught first.
        let decoy_manifest =
            "[dependencies]\nsystem76-power = \"1\"\ndenomination = { path = \"../denomination\" }\n";
        assert!(
            !forbidden_findings(decoy_manifest, "").is_empty(),
            "a System76 distro dependency must be flagged"
        );
        assert!(
            !forbidden_findings("", "use pop_shell::widget;").is_empty(),
            "a Pop-shell import must be flagged"
        );
        // libcosmic (the base-agnostic toolkit) is NOT distro coupling — it must pass.
        assert!(
            forbidden_findings(
                "[dependencies]\nlibcosmic = { git = \"https://github.com/pop-os/libcosmic\" }\n",
                "use libcosmic::app;"
            )
            .is_empty(),
            "libcosmic is the COSMIC toolkit, not Pop-distro coupling — it must not be flagged"
        );
        // the real crate: clean today.
        let manifest = include_str!("../Cargo.toml");
        let source = include_str!("lib.rs");
        assert_eq!(
            forbidden_findings(manifest, source),
            Vec::<String>::new(),
            "bnr-shell carries no Pop/apt/System76 coupling"
        );
    }
}
