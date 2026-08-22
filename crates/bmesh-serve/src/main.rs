//! bmesh-serve — the stack proof: htmx + AlpineJS + sqlite/postgres, each at its
//! polar strength, in one working loop (founder word 2026-08-22).
//!
//! The loop mirrors the estate's own architecture in miniature:
//!   the VISITOR'S BROWSER reads the live Vaulta rammarket keylessly (free
//!   distribution, zero server egress) → POSTs the reading here → the server
//!   journals it to **sqlite** (embedded, zero-ops — this lane's demand) →
//!   **htmx** polls server-rendered fragments back (hypermedia, no client
//!   render layer) → **AlpineJS** owns the client-side register toggle and the
//!   live formatting (small state, declarative, in the markup).
//! **postgres** compiles only with `--features postgres` — its polar strength
//! (many concurrent writers) is not this lane's demand, and the page says so.
//!
//! Vendored and SHA-pinned in assets/: htmx 2.0.4, AlpineJS 3.14.9 (receipts in
//! the lane dispatch). Run: `cargo run -p bmesh-serve` → http://127.0.0.1:8788

mod journal;

use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use journal::{Journal, SqliteJournal, TickIn};
use std::sync::Arc;
use std::time::Instant;

const HTMX_JS: &str = include_str!("../assets/htmx.min.js");
const ALPINE_JS: &str = include_str!("../assets/alpine.min.js");
const PAGE: &str = include_str!("../assets/page.html");

pub struct AppState {
    pub journal: SqliteJournal,
    pub started: Instant,
}

pub type SharedState = Arc<AppState>;

#[tokio::main]
async fn main() {
    let journal = SqliteJournal::open("bmesh-serve.db").expect("open sqlite journal");
    let state: SharedState = Arc::new(AppState {
        journal,
        started: Instant::now(),
    });

    let app = Router::new()
        .route("/", get(page))
        .route("/assets/htmx.js", get(htmx_js))
        .route("/assets/alpine.js", get(alpine_js))
        .route("/api/ticks", get(ticks_fragment))
        .route("/api/tick", post(post_tick))
        .route("/api/status", get(status_fragment))
        .route("/api/analytics/summary", get(analytics_summary))
        .route("/api/analytics/trend", get(analytics_trend))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8788")
        .await
        .unwrap();
    println!("bmesh-serve listening on http://127.0.0.1:8788 (sqlite journal: bmesh-serve.db)");
    axum::serve(listener, app).await.unwrap();
}

async fn page() -> Html<&'static str> {
    Html(PAGE)
}

async fn htmx_js() -> Response {
    ([(header::CONTENT_TYPE, "application/javascript")], HTMX_JS).into_response()
}

async fn alpine_js() -> Response {
    (
        [(header::CONTENT_TYPE, "application/javascript")],
        ALPINE_JS,
    )
        .into_response()
}

/// thousands-grouped rendering for i64 (rust format strings carry no grouping flag)
fn group(n: i64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

/// htmx fragment: the journal table body, server-rendered. This is htmx's polar
/// strength — the server owns the HTML, the client only swaps it in.
fn render_ticks(ts: &[journal::Tick]) -> String {
    ts.iter()
        .map(|t| {
            format!(
                "<tr><td>{id}</td><td>{c:.4}</td><td>{b}</td><td>{q}</td><td>{h}</td></tr>",
                id = t.id,
                c = t.core_units_per_name,
                b = group(t.base_bytes),
                q = group(t.quote_raw),
                h = t.source_host
            )
        })
        .collect()
}

async fn ticks_fragment(State(st): State<SharedState>) -> Html<String> {
    let recent = st.journal.recent(12);
    Html(render_ticks(&recent))
}

async fn post_tick(
    State(st): State<SharedState>,
    Json(t): Json<TickIn>,
) -> Result<Html<String>, StatusCode> {
    if !(t.core_units_per_name.is_finite() && t.base_bytes > 0 && t.quote_raw > 0) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let id = st.journal.insert(&t);
    let row = st.journal.recent(1);
    let _ = id;
    Ok(Html(render_ticks(&row)))
}

async fn status_fragment(State(st): State<SharedState>) -> Html<String> {
    let secs = st.started.elapsed().as_secs();
    let n = st.journal.count();
    Html(format!(
        "<b>{backend}</b> journal · {n} ticks · up {m}m {s}s · postgres lane: {pg}",
        backend = st.journal.backend_name(),
        n = n,
        m = secs / 60,
        s = secs % 60,
        pg = if cfg!(feature = "postgres") {
            "ARMED (compiled in — connect via DATABASE_URL-shaped config in code)"
        } else {
            "honest absence — armed by --features postgres; its polar strength (many concurrent writers) is not this lane's demand"
        }
    ))
}

/// sqlite analytics — the journal's own history, server-rendered (htmx fragment)
async fn analytics_summary(State(st): State<SharedState>) -> Html<String> {
    let n = st.journal.count();
    Html(format!("{n} ticks"))
}

async fn analytics_trend(State(st): State<SharedState>) -> Html<String> {
    let mut all = st.journal.recent(10_000);
    all.reverse(); // oldest first
    if all.is_empty() {
        return Html("no ticks yet".to_string());
    }
    let first = all.first().unwrap();
    let last = all.last().unwrap();
    let delta = last.core_units_per_name - first.core_units_per_name;
    Html(format!(
        "{:.4} → {:.4} ({}{:.4} over {} ticks)",
        first.core_units_per_name,
        last.core_units_per_name,
        if delta >= 0.0 { "+" } else { "" },
        delta,
        all.len()
    ))
}

// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal::SqliteJournal;

    fn tick(core: f64) -> TickIn {
        TickIn {
            core_units_per_name: core,
            base_bytes: 75_800_886_740,
            quote_raw: 251_602_894_241,
            source_host: "api.eosn.io".into(),
        }
    }

    #[test]
    fn sqlite_journal_roundtrip() {
        let j = SqliteJournal::in_memory().unwrap();
        assert_eq!(j.count(), 0);
        let a = j.insert(&tick(0.8421));
        let b = j.insert(&tick(0.8422));
        assert!(b > a, "ids ascend");
        assert_eq!(j.count(), 2);
        let recent = j.recent(2);
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].core_units_per_name, 0.8422, "newest first");
        assert_eq!(recent[1].core_units_per_name, 0.8421);
        assert_eq!(j.backend_name(), "sqlite");
    }

    #[test]
    fn fragment_renders_rows_server_side() {
        let ts = vec![journal::Tick {
            id: 7,
            core_units_per_name: 0.8421,
            base_bytes: 75_800_886_740,
            quote_raw: 251_602_894_241,
            source_host: "api.eosn.io".into(),
        }];
        let html = render_ticks(&ts);
        assert!(html.contains("<td>7</td>"), "id rendered");
        assert!(html.contains("0.8421"), "reading rendered");
        assert!(html.contains("75,800,886,740"), "base grouped-rendered");
    }
}
