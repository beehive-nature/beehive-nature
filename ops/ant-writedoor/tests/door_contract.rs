//! The door's contract battery — every row is a refusal or a shape the
//! adapter (myspace-adapter-ant.js) builds against. Mainnet spend: ZERO;
//! the only gateway in these tests is the shape-only MockGateway.
//!
//! Mutation legs for bFUzZ (named so the count says it moved):
//! - strip the ceiling checks        -> over_ceiling rows fall
//! - strip the path refusal          -> path_refused row falls
//! - strip CORS echo/preflight       -> cors_* rows fall
//! - strip address equality          -> address_mismatch row falls
//! - strip payment-shape checks      -> double_pay / unknown_quote /
//!                                      missing_quote_tx rows fall

use ant_writedoor::{Door, DoorConfig, MockGateway, UnwiredGateway};
use axum::body::Body;
use axum::http::{header, HeaderValue, Request, StatusCode};
use http_body_util::BodyExt;
use std::sync::Arc;
use tower::ServiceExt;

const ORIGIN: &str = "https://skaists.dev";
const KNOWN_ADDR: &str = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a"; // PUBLIC-CONSTANT: ant-door.html's pinned mainnet DataMap (read-door receipt)

fn door(max: usize) -> Arc<Door> {
    Door::new(
        DoorConfig {
            max_bytes: max,
            allowed_origin: ORIGIN.to_string(),
        },
        Arc::new(MockGateway::new()),
    )
}

async fn body_json(resp: axum::response::Response) -> serde_json::Value {
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

async fn send(door: &Arc<Door>, req: Request<Body>) -> axum::response::Response {
    door.router().oneshot(req).await.unwrap()
}

fn req(method: &str, uri: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

fn with_origin(mut r: Request<Body>, origin: &str) -> Request<Body> {
    r.headers_mut()
        .insert(header::ORIGIN, HeaderValue::from_str(origin).unwrap());
    r
}

async fn prepare_bytes(d: &Arc<Door>, content: Vec<u8>) -> serde_json::Value {
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/prepare")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::ORIGIN, ORIGIN)
        .body(Body::from(content))
        .unwrap();
    futures_send(d, r).await
}

async fn futures_send(d: &Arc<Door>, r: Request<Body>) -> serde_json::Value {
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK, "prepare must 200");
    body_json(resp).await
}

#[tokio::test]
async fn ceiling_probe_open_and_closed() {
    let d = door(1024);
    // open (mock): 200 with the configured ceiling
    let resp = send(
        &d,
        with_origin(req("GET", "/ant/v1/upload/prepare"), ORIGIN),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .unwrap(),
        ORIGIN
    );
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_METHODS)
            .unwrap(),
        "GET"
    );
    let v = body_json(resp).await;
    assert_eq!(v["max_bytes"], 1024);

    // closed (unwired): ANY non-200 is the page's "door not open" contract
    let closed = Door::new(DoorConfig::default(), Arc::new(UnwiredGateway));
    let resp = send(&closed, req("GET", "/ant/v1/upload/prepare")).await;
    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let v = body_json(resp).await;
    assert_eq!(v["error"], "upstream_unwired");
}

#[tokio::test]
async fn prepare_returns_the_pinned_shape() {
    let d = door(1024 * 1024);
    let v = prepare_bytes(&d, b"hello door".to_vec()).await;
    for key in [
        "upload_id",
        "payment_type",
        "total_atto",
        "chunks",
        "quotes",
        "data_map_address",
    ] {
        assert!(v.get(key).is_some(), "missing field {key}");
    }
    assert_eq!(v["payment_type"], "wave_batch");
    assert!(
        v["total_atto"].is_string(),
        "total_atto must be a decimal STRING"
    );
    let total: u128 = v["total_atto"].as_str().unwrap().parse().unwrap();
    assert!(total > 0);
    // the page sums the parts: total_atto == sum(quotes[].amount_atto)
    let sum: u128 = v["quotes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|q| q["amount_atto"].as_str().unwrap().parse::<u128>().unwrap())
        .sum();
    assert_eq!(total, sum, "total_atto must equal the quote sum");
    let dma = v["data_map_address"].as_str().unwrap();
    assert!(
        dma.starts_with("0x") && dma.len() == 66,
        "data_map_address is 0x + 64 hex"
    );
    assert_eq!(
        v["chunks"]["total"],
        v["quotes"].as_array().unwrap().len() as u64
    );
    // strict per-quote shape
    for q in v["quotes"].as_array().unwrap() {
        assert!(q["quote_hash"].as_str().unwrap().starts_with("0x"));
        assert!(q["rewards_address"].as_str().unwrap().starts_with("0x"));
        assert!(q["amount_atto"].is_string());
    }
}

#[tokio::test]
async fn prepare_refuses_a_json_path_body_by_name() {
    let d = door(1024 * 1024);
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/prepare")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, ORIGIN)
        .body(Body::from(
            serde_json::json!({ "path": "/etc/passwd" }).to_string(),
        ))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let v = body_json(resp).await;
    assert_eq!(v["error"], "path_refused");
}

#[tokio::test]
async fn prepare_refuses_wrong_content_type() {
    let d = door(1024 * 1024);
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/prepare")
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from("just text"))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let v = body_json(resp).await;
    assert_eq!(v["error"], "bad_request");
}

#[tokio::test]
async fn over_ceiling_refused_by_name_server_side() {
    let d = door(8);
    // declared length fast refusal
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/prepare")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, "9")
        .body(Body::empty())
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let v = body_json(resp).await;
    assert_eq!(v["error"], "too_large");
    assert_eq!(v["max_bytes"], 8);

    // streamed-count refusal (no declared length to trust)
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/prepare")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .body(Body::from(vec![0u8; 9]))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(resp).await["error"], "too_large");
}

#[tokio::test]
async fn preflight_exact_origin_named_methods_never_wildcard() {
    let d = door(1024);
    // correct preflight for POST prepare (octet-stream makes it non-simple)
    let r = Request::builder()
        .method("OPTIONS")
        .uri("/ant/v1/upload/prepare")
        .header(header::ORIGIN, ORIGIN)
        .header("Access-Control-Request-Method", "POST")
        .header("Access-Control-Request-Headers", "content-type")
        .body(Body::empty())
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .unwrap(),
        ORIGIN
    );
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_METHODS)
            .unwrap(),
        "POST"
    );
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_HEADERS)
            .unwrap(),
        "Content-Type"
    );

    // wrong origin: refused, no echo
    let r = Request::builder()
        .method("OPTIONS")
        .uri("/ant/v1/upload/prepare")
        .header(header::ORIGIN, "https://evil.example")
        .header("Access-Control-Request-Method", "POST")
        .body(Body::empty())
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    assert!(resp
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        .is_none());

    // wrong method on the route: refused
    let r = Request::builder()
        .method("OPTIONS")
        .uri("/ant/v1/upload/finalize")
        .header(header::ORIGIN, ORIGIN)
        .header("Access-Control-Request-Method", "GET")
        .body(Body::empty())
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    // never a wildcard anywhere
    let r = Request::builder()
        .method("OPTIONS")
        .uri("/ant/v1/upload/prepare")
        .header(header::ORIGIN, ORIGIN)
        .header("Access-Control-Request-Method", "POST")
        .body(Body::empty())
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    for (_, v) in resp.headers().iter() {
        assert_ne!(v, "*", "CORS law: never a wildcard");
    }
    let _ = KNOWN_ADDR; // read-door provenance pin, carried for the battery's own receipts
}

async fn full_flow(d: &Arc<Door>) -> serde_json::Value {
    let plan = prepare_bytes(d, b"round trip".to_vec()).await;
    let txs: Vec<serde_json::Value> = plan["quotes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|q| {
            serde_json::json!({
                "quote_hash": q["quote_hash"],
                "tx_hash": format!("0x{}", "ab".repeat(32)),
            })
        })
        .collect();
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/finalize")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, ORIGIN)
        .body(Body::from(
            serde_json::json!({ "upload_id": plan["upload_id"], "txs": txs }).to_string(),
        ))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let fin = body_json(resp).await;
    assert_eq!(fin["data_map_address"], plan["data_map_address"]);
    plan
}

#[tokio::test]
async fn finalize_round_trip_address_equality() {
    let d = door(1024 * 1024);
    full_flow(&d).await;
}

#[tokio::test]
async fn finalize_payment_shape_laws_hold_door_side() {
    let d = door(1024 * 1024);
    let plan = prepare_bytes(&d, b"shape laws".to_vec()).await;
    let quotes = plan["quotes"].as_array().unwrap();

    let plan_c = plan.clone();
    let finalize_with = |txs: Vec<serde_json::Value>| {
        let plan_c = plan_c.clone();
        let d = d.clone();
        async move {
            let r = Request::builder()
                .method("POST")
                .uri("/ant/v1/upload/finalize")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::ORIGIN, ORIGIN)
                .body(Body::from(
                    serde_json::json!({ "upload_id": plan_c["upload_id"], "txs": txs }).to_string(),
                ))
                .unwrap();
            let resp = d.router().oneshot(r).await.unwrap();
            (resp.status(), body_json(resp).await)
        }
    };

    // a quoted chunk with no tx
    let empty: Vec<serde_json::Value> = vec![];
    let (st, v) = finalize_with(empty).await;
    assert_eq!(st, StatusCode::BAD_REQUEST);
    assert_eq!(v["error"], "missing_quote_tx");

    // a payment naming a quote the door did not give
    let (st, v) = finalize_with(vec![serde_json::json!({
        "quote_hash": format!("0x{}", "11".repeat(32)),
        "tx_hash": format!("0x{}", "ab".repeat(32)),
    })])
    .await;
    assert_eq!(st, StatusCode::BAD_REQUEST);
    assert_eq!(v["error"], "unknown_quote");

    // a quote paid twice
    let paid_twice: Vec<serde_json::Value> = quotes
        .iter()
        .map(|q| {
            serde_json::json!({
                "quote_hash": q["quote_hash"],
                "tx_hash": format!("0x{}", "ab".repeat(32)),
            })
        })
        .chain(std::iter::once(serde_json::json!({
            "quote_hash": quotes[0]["quote_hash"],
            "tx_hash": format!("0x{}", "cd".repeat(32)),
        })))
        .collect();
    let (st, v) = finalize_with(paid_twice).await;
    assert_eq!(st, StatusCode::BAD_REQUEST);
    assert_eq!(v["error"], "double_pay");
}

#[tokio::test]
async fn finalize_unknown_upload_and_malformed_hex() {
    let d = door(1024 * 1024);
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/finalize")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "upload_id": "up-mock-does-not-exist",
                "txs": [{ "quote_hash": format!("0x{}", "11".repeat(32)), "tx_hash": format!("0x{}", "ab".repeat(32)) }]
            })
            .to_string(),
        ))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    assert_eq!(body_json(resp).await["error"], "unknown_upload");

    // not hex64: refused by name
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/finalize")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "upload_id": "whatever",
                "txs": [{ "quote_hash": "0x1234", "tx_hash": "0x5678" }]
            })
            .to_string(),
        ))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn finalize_address_mismatch_refused_by_the_door() {
    // a gateway that hands back a foreign address must not pass: the door
    // compares against its OWN ledger record, gateway-agnostic.
    let mock = MockGateway::tampered();
    let d = Door::new(DoorConfig::default(), Arc::new(mock));
    let plan = prepare_bytes(&d, b"tamper test".to_vec()).await;
    let txs: Vec<serde_json::Value> = plan["quotes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|q| {
            serde_json::json!({
                "quote_hash": q["quote_hash"],
                "tx_hash": format!("0x{}", "ab".repeat(32)),
            })
        })
        .collect();
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/finalize")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({ "upload_id": plan["upload_id"], "txs": txs }).to_string(),
        ))
        .unwrap();
    let resp = d.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(body_json(resp).await["error"], "address_mismatch");
}

#[tokio::test]
async fn restart_is_the_reprepare_law() {
    // a fresh Door (process restart) does not know the old upload_id: the
    // honest answer is unknown_upload -> the page re-prepares. Persistence
    // across restart is the wiring slice's obligation on the gateway.
    let d1 = door(1024 * 1024);
    let plan = prepare_bytes(&d1, b"pre restart".to_vec()).await;
    let d2 = door(1024 * 1024);
    let r = Request::builder()
        .method("POST")
        .uri("/ant/v1/upload/finalize")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "upload_id": plan["upload_id"],
                "txs": [{ "quote_hash": format!("0x{}", "11".repeat(32)), "tx_hash": format!("0x{}", "ab".repeat(32)) }]
            })
            .to_string(),
        ))
        .unwrap();
    let resp = d2.router().oneshot(r).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    assert_eq!(body_json(resp).await["error"], "unknown_upload");
}
