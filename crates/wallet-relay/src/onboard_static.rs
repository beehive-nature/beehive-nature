//! Serve the onboarding surfaces from the relay — the beta/self-hosted lane.
//!
//! Why the relay serves these at all (beta finding 2026-08-14): a DOWNLOADED
//! copy of receive.html opens as `file://`, where mobile browsers block the
//! camera with no popup — dead end by browser design, not by bug. `localhost`
//! IS a secure context, so `cargo run -p wallet-relay` + `/onboard/receive`
//! gives a working camera on the dev box today; the same routes serve phones
//! once the box has a real https hostname. Files are compiled in (include_str)
//! so the served surface is exactly the reviewed, committed one — no path
//! traversal, no live-edit drift on a running relay.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

const ONBOARD_HTML: &str = include_str!("../../../surfaces/onboarding/index.html");
const RECEIVE_HTML: &str = include_str!("../../../surfaces/onboarding/receive.html");
const QRCODEGEN_JS: &str = include_str!("../../../surfaces/onboarding/vendor/qrcodegen.js");
const BLIGHT_DEMO: &str = include_str!("../../../surfaces/blight/demo.html");

fn page(body: &'static str, content_type: &'static str) -> Response {
    (StatusCode::OK, [("content-type", content_type)], body).into_response()
}

/// GET /onboard — the first-join wizard.
pub async fn onboard() -> Response {
    page(ONBOARD_HTML, "text/html; charset=utf-8")
}

/// GET /onboard/receive — the optical receiver (camera works: localhost/https).
pub async fn receive() -> Response {
    page(RECEIVE_HTML, "text/html; charset=utf-8")
}

/// GET /onboard/vendor/qrcodegen.js — the wizard's relative script resolves here.
pub async fn qrcodegen_js() -> Response {
    page(QRCODEGEN_JS, "text/javascript; charset=utf-8")
}

/// GET /blight — the bLiGhTbeAM demo (moving b logo talking to a BNR dApp).
pub async fn blight_demo() -> Response {
    page(BLIGHT_DEMO, "text/html; charset=utf-8")
}

#[cfg(test)]
mod tests {
    use crate::{app, AppState};
    use crate::gateway::GatewayPool;
    use axum::http::StatusCode;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    fn state() -> AppState {
        AppState::new(GatewayPool::new(&["http://a", "http://b"]).unwrap(), None)
    }

    #[tokio::test]
    async fn onboarding_surfaces_are_served_with_encoder_resolvable() {
        for (path, must_contain) in [
            ("/onboard", "BNR · Get started"),
            // ruled copy (Claude Design's visual language §3 / correction C-1):
            // "Receive over light" -> "Receive on the bLighTnetWorK" (exact casing)
            ("/onboard/receive", "Receive on the bLighTnetWorK"),
            ("/onboard/vendor/qrcodegen.js", "qrcodegen"),
        ] {
            let resp = app(state())
                .oneshot(axum::http::Request::get(path).body(axum::body::Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(resp.status(), StatusCode::OK, "{path}");
            let body = resp.into_body().collect().await.unwrap().to_bytes();
            let text = String::from_utf8_lossy(&body);
            assert!(text.contains(must_contain), "{path} missing marker");
        }
        // the wizard references the vendor script by the path the router serves
        let resp = app(state())
            .oneshot(axum::http::Request::get("/onboard").body(axum::body::Body::empty()).unwrap())
            .await
            .unwrap();
        let body = resp.into_body().collect().await.unwrap().to_bytes();
        assert!(
            String::from_utf8_lossy(&body).contains("vendor/qrcodegen.js"),
            "wizard script src must resolve relative to /onboard/"
        );
    }
}
