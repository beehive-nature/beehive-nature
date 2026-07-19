//! The Denomination Constant (D-14) — `b` and money, everywhere, always.
//!
//! Third design law after colour (D-1) and direction (D-13). Every OSe surface that touches
//! function or value shows **two gauges**: `b` answers *can I do this?*, money answers *what
//! does this mean in my money?* From the sovereign core to the most regulated plugin, the
//! user never loses sight of either. That continuity is the OSe — plugins change, the gauges
//! do not.
//!
//! # Two gauges, never one ratio
//!
//! The pair is shown; the **exchange rate between them is not** — no ambient b/USD ticker, no
//! implied price on ordinary surfaces. A price rendered on every screen is a market being
//! wished into existence, and "not in the markets" has to hold at the pixel level. The one
//! surface where a conversion appears is the protocol draw facility itself, because that is
//! the sanctioned venue and the only one.
//!
//! # Why this is types, not chrome
//!
//! The law is enforced by making a one-gauge or wrong-gauge surface *unrepresentable* where
//! it can be, and *refusable* where it cannot. [`Hud::render`] cannot produce a value line
//! without a currency gauge or a function line without a `b` gauge. And a `b` gauge over a
//! **stale** count refuses rather than rendering a number — Law 1d: a gauge showing the wrong
//! number is worse than no gauge.
//!
//! # `b` is displayed in FUNCTION, not as an amount to be priced
//!
//! `b`'s display unit is capability — *"enough for three deployments"* — not a bare quantity
//! inviting mental conversion to dollars. [`BGauge`] carries a function reading, and the
//! amount is available for arithmetic but is not the display primitive.

use serde::{Deserialize, Serialize};

/// A currency the user reads value in. A **display preference**, never a profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CurrencyId(pub String);

/// A monetary amount in a stated currency. Never silently converted.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Money {
    pub amount: f64,
    pub currency: CurrencyId,
}

// ── the b gauge ───────────────────────────────────────────────────────────────

/// A `b` balance is either currently known, or it is not. A gauge over an unknown balance
/// must say so, never show a number. (Law 1d, at the pixel.)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BBalance {
    /// Fetched and current. The `f64` is available for arithmetic; it is not the display.
    Known(f64),
    /// Not yet fetched, or the fetch failed, or the cached value is stale.
    Stale,
}

/// The `b` gauge — *can I do this?* Displayed in **function**, not as a priceable amount.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BGauge {
    pub balance: BBalance,
    /// The capability reading a surface shows: "enough for three deployments".
    /// Present only when the balance is `Known` — a function reading over a stale balance
    /// would be a confident statement about the wrong number.
    pub function_reading: Option<String>,
}

impl BGauge {
    pub fn known(amount: f64, function_reading: impl Into<String>) -> Self {
        BGauge {
            balance: BBalance::Known(amount),
            function_reading: Some(function_reading.into()),
        }
    }
    /// A gauge that cannot vouch for its number. It renders as "—" / "balance unavailable",
    /// never as a figure.
    pub fn stale() -> Self {
        BGauge {
            balance: BBalance::Stale,
            function_reading: None,
        }
    }
    pub fn is_showable(&self) -> bool {
        matches!(self.balance, BBalance::Known(_)) && self.function_reading.is_some()
    }
}

/// The money gauge — *what does this mean in my money?* In the user's currency preference.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MoneyGauge {
    pub value: Money,
}

// ── what a surface denominates ────────────────────────────────────────────────

/// What a given surface actually touches. **Each gauge denominates what it denominates:** a
/// b-gated function shows its `b` cost; a fee shows currency; a surface touching both shows
/// both. This is the input to [`Hud::render`], which cannot then drop the required gauge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SurfaceKind {
    /// A function that costs `b` — deployment, update, capability unlock.
    Function { cost_b: f64, function_note: String },
    /// A service, fee, or deal denominated in money.
    Value { amount: Money },
    /// A surface touching both — a screen that spends `b` and quotes a fee.
    Both {
        cost_b: f64,
        function_note: String,
        amount: Money,
    },
}

/// The one surface allowed to show a conversion rate: the protocol draw facility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DrawFacility {
    /// The sanctioned rate. This is the ONLY place a b↔currency ratio may be rendered.
    pub rate_b_to_currency: f64,
    pub currency: CurrencyId,
}

// ── the HUD ───────────────────────────────────────────────────────────────────

/// A rendered heads-up display for one surface. **The gauges the law requires are not
/// `Option` on the paths where they are required** — [`Hud::render`] returns an error rather
/// than a HUD missing a mandated gauge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Hud {
    pub b: Option<BGauge>,
    pub money: Option<MoneyGauge>,
    /// A conversion rate, present **only** on a draw-facility surface.
    pub rate: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum HudRefusal {
    /// A function surface was handed a `b` gauge it cannot show (stale balance).
    /// Law 1d: refuse rather than render the wrong number.
    UnshowableBGauge,
    /// A function surface with no `b` gauge, or a value surface with no money gauge.
    MissingRequiredGauge { which: &'static str },
    /// A b↔currency rate was supplied for a surface that is not the draw facility.
    RateOutsideDrawFacility,
}

impl Hud {
    /// Render the HUD for an ordinary (non-draw-facility) surface.
    ///
    /// Guarantees, by construction:
    /// - a `Function` surface yields a HUD **with** a `b` gauge, and that gauge is showable;
    /// - a `Value` surface yields a HUD **with** a money gauge;
    /// - a `Both` surface yields **both**;
    /// - **no `rate` is ever set** — the ratio belongs to the draw facility alone.
    pub fn render(kind: &SurfaceKind, b: Option<BGauge>) -> Result<Hud, HudRefusal> {
        match kind {
            SurfaceKind::Function { function_note, .. } => {
                let g = require_showable_b(b)?;
                let _ = function_note;
                Ok(Hud {
                    b: Some(g),
                    money: None,
                    rate: None,
                })
            }
            SurfaceKind::Value { amount } => Ok(Hud {
                b: None,
                money: Some(MoneyGauge {
                    value: amount.clone(),
                }),
                rate: None,
            }),
            SurfaceKind::Both { amount, .. } => {
                let g = require_showable_b(b)?;
                Ok(Hud {
                    b: Some(g),
                    money: Some(MoneyGauge {
                        value: amount.clone(),
                    }),
                    rate: None,
                })
            }
        }
    }

    /// Render the draw facility — **the only surface permitted a conversion rate.** It still
    /// shows both gauges; it additionally shows the sanctioned ratio.
    pub fn render_draw_facility(
        facility: &DrawFacility,
        b: Option<BGauge>,
        money: Money,
    ) -> Result<Hud, HudRefusal> {
        let g = require_showable_b(b)?;
        Ok(Hud {
            b: Some(g),
            money: Some(MoneyGauge { value: money }),
            rate: Some(facility.rate_b_to_currency),
        })
    }
}

fn require_showable_b(b: Option<BGauge>) -> Result<BGauge, HudRefusal> {
    match b {
        Some(g) if g.is_showable() => Ok(g),
        Some(_) => Err(HudRefusal::UnshowableBGauge),
        None => Err(HudRefusal::MissingRequiredGauge { which: "b" }),
    }
}

/// Audit a HUD that arrived from anywhere (e.g. a plugin) against D-14. A regulated plugin
/// surface **may not** suppress the shell's gauges, and may not carry a rate. This is the
/// control for the plugin edge: the shell frames the plugin, never the reverse.
pub fn audit_plugin_hud(hud: &Hud, kind: &SurfaceKind) -> Result<(), HudRefusal> {
    match kind {
        SurfaceKind::Function { .. } => {
            let g = hud
                .b
                .as_ref()
                .ok_or(HudRefusal::MissingRequiredGauge { which: "b" })?;
            if !g.is_showable() {
                return Err(HudRefusal::UnshowableBGauge);
            }
        }
        SurfaceKind::Value { .. } => {
            hud.money
                .as_ref()
                .ok_or(HudRefusal::MissingRequiredGauge { which: "money" })?;
        }
        SurfaceKind::Both { .. } => {
            let g = hud
                .b
                .as_ref()
                .ok_or(HudRefusal::MissingRequiredGauge { which: "b" })?;
            if !g.is_showable() {
                return Err(HudRefusal::UnshowableBGauge);
            }
            hud.money
                .as_ref()
                .ok_or(HudRefusal::MissingRequiredGauge { which: "money" })?;
        }
    }
    // A plugin surface is never the draw facility, so it must carry no rate.
    if hud.rate.is_some() {
        return Err(HudRefusal::RateOutsideDrawFacility);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn usd(a: f64) -> Money {
        Money {
            amount: a,
            currency: CurrencyId("USD".into()),
        }
    }

    // ── both gauges, always ───────────────────────────────────────────────────

    #[test]
    fn a_function_surface_always_carries_the_b_gauge() {
        let k = SurfaceKind::Function {
            cost_b: 3.0,
            function_note: "deploy".into(),
        };
        let hud = Hud::render(
            &k,
            Some(BGauge::known(12.0, "enough for three deployments")),
        )
        .unwrap();
        assert!(hud.b.is_some());
        assert!(hud.rate.is_none());
    }

    #[test]
    fn a_value_surface_always_carries_the_money_gauge() {
        let k = SurfaceKind::Value {
            amount: usd(45_000.0),
        };
        let hud = Hud::render(&k, None).unwrap();
        assert!(hud.money.is_some());
        assert!(hud.rate.is_none());
    }

    #[test]
    fn a_both_surface_carries_both_gauges() {
        let k = SurfaceKind::Both {
            cost_b: 1.0,
            function_note: "sign".into(),
            amount: usd(500.0),
        };
        let hud = Hud::render(&k, Some(BGauge::known(9.0, "enough for nine signings"))).unwrap();
        assert!(hud.b.is_some() && hud.money.is_some());
    }

    /// **A function surface with no b gauge cannot be rendered.** The law is unrepresentable
    /// to violate on this path, not merely discouraged.
    #[test]
    fn a_function_surface_without_b_refuses() {
        let k = SurfaceKind::Function {
            cost_b: 3.0,
            function_note: "deploy".into(),
        };
        assert_eq!(
            Hud::render(&k, None).unwrap_err(),
            HudRefusal::MissingRequiredGauge { which: "b" }
        );
    }

    // ── Law 1d: a gauge showing the wrong number is worse than no gauge ────────

    #[test]
    fn a_stale_b_gauge_refuses_rather_than_showing_a_number() {
        let k = SurfaceKind::Function {
            cost_b: 3.0,
            function_note: "deploy".into(),
        };
        assert_eq!(
            Hud::render(&k, Some(BGauge::stale())).unwrap_err(),
            HudRefusal::UnshowableBGauge
        );
    }

    #[test]
    fn a_stale_gauge_carries_no_number_to_show() {
        let g = BGauge::stale();
        assert!(!g.is_showable());
        assert!(g.function_reading.is_none());
        assert_eq!(g.balance, BBalance::Stale);
    }

    // ── two gauges, never one ratio ───────────────────────────────────────────

    #[test]
    fn no_ordinary_surface_ever_carries_a_conversion_rate() {
        for k in [
            SurfaceKind::Function {
                cost_b: 3.0,
                function_note: "x".into(),
            },
            SurfaceKind::Both {
                cost_b: 3.0,
                function_note: "x".into(),
                amount: usd(1.0),
            },
        ] {
            let hud = Hud::render(&k, Some(BGauge::known(5.0, "enough"))).unwrap();
            assert!(
                hud.rate.is_none(),
                "a b/USD rate on an ordinary surface wishes a market into being"
            );
        }
        let v = Hud::render(&SurfaceKind::Value { amount: usd(1.0) }, None).unwrap();
        assert!(v.rate.is_none());
    }

    #[test]
    fn the_draw_facility_is_the_one_room_with_a_rate() {
        let f = DrawFacility {
            rate_b_to_currency: 4.20,
            currency: CurrencyId("USD".into()),
        };
        let hud = Hud::render_draw_facility(&f, Some(BGauge::known(100.0, "enough")), usd(420.0))
            .unwrap();
        assert_eq!(hud.rate, Some(4.20));
        assert!(
            hud.b.is_some() && hud.money.is_some(),
            "even here, both gauges show"
        );
    }

    // ── the plugin edge ───────────────────────────────────────────────────────

    #[test]
    fn a_plugin_that_suppresses_the_shell_gauges_fails_audit() {
        // a regulated-plugin value surface that dropped the money gauge
        let empty = Hud {
            b: None,
            money: None,
            rate: None,
        };
        assert!(audit_plugin_hud(&empty, &SurfaceKind::Value { amount: usd(1.0) }).is_err());
        // a function surface whose b gauge went stale inside the plugin
        let stale = Hud {
            b: Some(BGauge::stale()),
            money: None,
            rate: None,
        };
        assert_eq!(
            audit_plugin_hud(
                &stale,
                &SurfaceKind::Function {
                    cost_b: 1.0,
                    function_note: "x".into()
                }
            ),
            Err(HudRefusal::UnshowableBGauge)
        );
    }

    #[test]
    fn a_plugin_may_not_render_a_conversion_rate() {
        let with_rate = Hud {
            b: Some(BGauge::known(1.0, "enough")),
            money: Some(MoneyGauge { value: usd(1.0) }),
            rate: Some(4.2),
        };
        assert_eq!(
            audit_plugin_hud(
                &with_rate,
                &SurfaceKind::Both {
                    cost_b: 1.0,
                    function_note: "x".into(),
                    amount: usd(1.0)
                }
            ),
            Err(HudRefusal::RateOutsideDrawFacility)
        );
    }

    #[test]
    fn a_compliant_plugin_hud_passes_audit() {
        let good = Hud {
            b: Some(BGauge::known(2.0, "enough for two")),
            money: Some(MoneyGauge { value: usd(50.0) }),
            rate: None,
        };
        assert!(audit_plugin_hud(
            &good,
            &SurfaceKind::Both {
                cost_b: 1.0,
                function_note: "x".into(),
                amount: usd(50.0)
            }
        )
        .is_ok());
    }

    // ── currency is a display preference, never a profile ─────────────────────

    #[test]
    fn currency_id_carries_no_profile_data() {
        let c = CurrencyId("MXN".into());
        let j = serde_json::to_string(&c).unwrap().to_lowercase();
        for forbidden in [
            "status", "income", "credit", "rating", "profile", "verified", "tier",
        ] {
            assert!(
                !j.contains(forbidden),
                "currency_metric is a display denomination, not a profile"
            );
        }
    }

    #[test]
    fn b_is_displayed_in_function_not_as_a_bare_amount() {
        let g = BGauge::known(12.0, "enough for three deployments");
        // the display primitive is the function reading; the number is for arithmetic
        assert_eq!(
            g.function_reading.as_deref(),
            Some("enough for three deployments")
        );
        assert!(matches!(g.balance, BBalance::Known(_)));
    }

    #[test]
    fn round_trips() {
        let hud = Hud {
            b: Some(BGauge::known(1.0, "enough")),
            money: Some(MoneyGauge { value: usd(1.0) }),
            rate: None,
        };
        let j = serde_json::to_string(&hud).unwrap();
        assert_eq!(hud, serde_json::from_str::<Hud>(&j).unwrap());
    }
}
