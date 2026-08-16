//! Protocol and behaviour tests. Everything runs the full stdio JSON-RPC
//! loop over duplex streams against MockTransport — zero network, zero
//! generations. The first real PixelLab call is a deliberate, founder-
//! present act that this suite never performs.

use adapter_pixellab::pixellab::MockTransport;
use adapter_pixellab::{run_server, ServerConfig};
use base64::Engine;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

const BALANCE_FIXTURE: &str = include_str!("../fixtures/balance.json");
const GENERATE_FIXTURE: &str = include_str!("../fixtures/generate_bitforge.json");
const PNG_1PX_B64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

fn png_1px() -> Vec<u8> {
    base64::engine::general_purpose::STANDARD.decode(PNG_1PX_B64).unwrap()
}

async fn read_msg<R: tokio::io::AsyncRead + Unpin>(r: &mut BufReader<R>) -> Value {
    let mut line = String::new();
    let n = r.read_line(&mut line).await.expect("read_line");
    assert!(n > 0, "server closed stdout unexpectedly");
    serde_json::from_str(line.trim()).expect("valid JSON from server")
}

async fn write_msg<W: tokio::io::AsyncWrite + Unpin>(w: &mut W, v: &Value) {
    let s = serde_json::to_string(v).unwrap();
    w.write_all(s.as_bytes()).await.unwrap();
    w.write_all(b"\n").await.unwrap();
    w.flush().await.unwrap();
}

#[allow(clippy::type_complexity)]
async fn spawn_server(
    responses: Vec<Value>,
    cfg: ServerConfig,
) -> (
    Arc<MockTransport>,
    tokio::io::DuplexStream,
    BufReader<tokio::io::DuplexStream>,
    tokio::task::JoinHandle<()>,
) {
    let mock = Arc::new(MockTransport::new(responses));
    let (client_write, server_stdin) = tokio::io::duplex(8192);
    let (server_stdout, client_read) = tokio::io::duplex(8192);
    let t = mock.clone();
    let c = Arc::new(cfg);
    let handle = tokio::spawn(async move {
        let _ = run_server(t, c, server_stdin, server_stdout).await;
    });
    (mock, client_write, BufReader::new(client_read), handle)
}

async fn handshake<W: tokio::io::AsyncWrite + Unpin, R: tokio::io::AsyncRead + Unpin>(
    w: &mut W,
    r: &mut BufReader<R>,
) {
    write_msg(
        w,
        &json!({"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}),
    )
    .await;
    let resp = read_msg(r).await;
    assert_eq!(resp["result"]["serverInfo"]["name"], "adapter-pixellab");
    assert_eq!(resp["result"]["protocolVersion"], "2025-06-18");
    write_msg(w, &json!({"jsonrpc":"2.0","method":"notifications/initialized"})).await;
}

#[tokio::test]
async fn initialize_tools_list_and_notification_silence() {
    let dir = tempfile::tempdir().unwrap();
    let (_mock, mut w, mut r, _h) =
        spawn_server(vec![], ServerConfig { out_dir: dir.path().into(), max_spend_usd: None }).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["id"], 1);
    assert_eq!(resp["result"]["serverInfo"]["name"], "adapter-pixellab");
    assert_eq!(resp["result"]["protocolVersion"], "2025-06-18");
    assert!(resp["result"]["capabilities"]["tools"].is_object());

    // A notification must produce no response: the next line we read belongs
    // to id 2, not to the notification.
    write_msg(&mut w, &json!({"jsonrpc":"2.0","method":"notifications/initialized"})).await;
    write_msg(&mut w, &json!({"jsonrpc":"2.0","id":2,"method":"tools/list"})).await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["id"], 2, "notification must not have been answered");

    let tools = resp["result"]["tools"].as_array().unwrap();
    let names: Vec<&str> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
    assert!(names.contains(&"generate_image"));
    assert!(names.contains(&"get_balance"));
    assert_eq!(tools.len(), 2, "surface is exactly the art lane — one MCP command per agent");
}

/// buzz's MAX_SCHEMA_BYTES is 4096; oversize schemas are silently replaced
/// with {}. This test is the guard against that ever biting us silently.
#[test]
fn tool_schemas_under_4096_bytes() {
    for t in adapter_pixellab::tools::tools_json().as_array().unwrap() {
        let s = serde_json::to_string(&t["inputSchema"]).unwrap();
        assert!(
            s.len() < 4096,
            "tool {} inputSchema is {} bytes — buzz would silently swap it for {{}}",
            t["name"],
            s.len()
        );
        assert!(s.len() > 2, "tool {} schema must not be empty", t["name"]);
    }
}

#[tokio::test]
async fn generate_with_style_anchor_writes_png_and_measures_spend() {
    let dir = tempfile::tempdir().unwrap();
    let anchor = dir.path().join("anchor.png");
    std::fs::write(&anchor, png_1px()).unwrap();
    let out_dir = dir.path().join("out");
    let cfg = ServerConfig { out_dir: out_dir.clone(), max_spend_usd: Some(10.0) };
    let responses = vec![
        serde_json::from_str(BALANCE_FIXTURE).unwrap(),      // balance before: 5.0
        serde_json::from_str(GENERATE_FIXTURE).unwrap(),     // the generation
        json!({"type":"usd","usd":4.96}),                    // balance after
    ];
    let (mock, mut w, mut r, _h) = spawn_server(responses, cfg).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({
            "jsonrpc":"2.0","id":7,"method":"tools/call",
            "params":{"name":"generate_image","arguments":{
                "prompt":"a bee",
                "style_image_path": anchor.to_string_lossy(),
                "layer_name":"006 Manifestor/Larva",
                "width":96,"height":96,
                "outline":"single color black outline",
                "detail":"low detail",
                "shading":"flat shading"
            }}
        }),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["id"], 7);
    assert_eq!(resp["result"]["isError"], false);
    let text = resp["result"]["content"][0]["text"].as_str().unwrap();
    let out: Value = serde_json::from_str(text).unwrap();

    assert_eq!(out["endpoint"], "bitforge", "a style anchor must route to bitforge");
    assert_eq!(out["layer"], "006_Manifestor_Larva");
    let path = std::path::PathBuf::from(out["path"].as_str().unwrap());
    assert!(path.exists(), "PNG must exist at the returned handle");
    assert!(path.starts_with(&out_dir), "handle must point into the configured out-dir");
    let written = std::fs::read(&path).unwrap();
    assert_eq!(written, png_1px());

    let spent = out["balance"]["spent_this_call"].as_f64().unwrap();
    assert!((spent - 0.04).abs() < 1e-9, "measured spend {spent}");
    let session = out["session"]["spent_usd"].as_f64().unwrap();
    assert!((session - 0.04).abs() < 1e-9);

    let calls = mock.calls_snapshot();
    assert_eq!(calls.len(), 3, "balance, generate, balance");
    assert_eq!(calls[1].0, "/generate-image-bitforge");
    let body = calls[1].1.as_ref().unwrap();
    assert!(body["style_image"]["base64"].is_string());
    assert_eq!(body["no_background"], true);
    assert_eq!(body["outline"], "single color black outline");
    assert_eq!(body["detail"], "low detail");
    assert_eq!(body["shading"], "flat shading");
}

#[tokio::test]
async fn budget_cap_refuses_second_generation() {
    let dir = tempfile::tempdir().unwrap();
    let anchor = dir.path().join("anchor.png");
    std::fs::write(&anchor, png_1px()).unwrap();
    let cfg = ServerConfig { out_dir: dir.path().join("out"), max_spend_usd: Some(0.05) };
    let responses = vec![
        json!({"type":"usd","usd":5.0}),
        serde_json::from_str(GENERATE_FIXTURE).unwrap(),
        json!({"type":"usd","usd":4.94}), // spent 0.06 — over the 0.05 cap
        json!({"type":"usd","usd":4.94}), // balance-before of the refused call
    ];
    let (mock, mut w, mut r, _h) = spawn_server(responses, cfg).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
            "name":"generate_image","arguments":{"prompt":"bee one","style_image_path": anchor.to_string_lossy()}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["result"]["isError"], false);

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
            "name":"generate_image","arguments":{"prompt":"bee two"}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["id"], 2);
    assert_eq!(resp["result"]["isError"], true);
    let text = resp["result"]["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("cap"), "refusal must name the cap: {text}");

    let gens = mock
        .calls_snapshot()
        .into_iter()
        .filter(|(p, _)| p.contains("generate-image-"))
        .count();
    assert_eq!(gens, 1, "the capped call must never reach the generator");
}

#[tokio::test]
async fn get_balance_reports_usd_and_session() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = ServerConfig { out_dir: dir.path().into(), max_spend_usd: Some(3.0) };
    let (_mock, mut w, mut r, _h) =
        spawn_server(vec![serde_json::from_str(BALANCE_FIXTURE).unwrap()], cfg).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":9,"method":"tools/call","params":{
            "name":"get_balance","arguments":{}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["result"]["isError"], false);
    let out: Value = serde_json::from_str(resp["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(out["usd"], 5.0);
    assert_eq!(out["session"]["cap_usd"], 3.0);
    assert_eq!(out["session"]["spent_usd"], 0.0);
}

#[tokio::test]
async fn unknown_tool_is_a_protocol_error() {
    let dir = tempfile::tempdir().unwrap();
    let (_mock, mut w, mut r, _h) =
        spawn_server(vec![], ServerConfig { out_dir: dir.path().into(), max_spend_usd: None }).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{
            "name":"estimate_skeleton","arguments":{}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["id"], 5);
    assert_eq!(resp["error"]["code"], -32602);
}

#[tokio::test]
async fn invalid_enum_rejects_before_any_request() {
    let dir = tempfile::tempdir().unwrap();
    let (mock, mut w, mut r, _h) =
        spawn_server(vec![], ServerConfig { out_dir: dir.path().into(), max_spend_usd: None }).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
            "name":"generate_image","arguments":{"prompt":"x","outline":"glowy"}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["result"]["isError"], true);
    let text = resp["result"]["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("allowed:"), "error must list allowed values: {text}");
    assert!(mock.calls_snapshot().is_empty(), "validation must fire before any network");
}

#[tokio::test]
async fn non_png_style_anchor_is_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let junk = dir.path().join("not-a-png.png");
    std::fs::write(&junk, b"definitely not png bytes").unwrap();
    let (mock, mut w, mut r, _h) =
        spawn_server(vec![], ServerConfig { out_dir: dir.path().into(), max_spend_usd: None }).await;
    handshake(&mut w, &mut r).await;

    write_msg(
        &mut w,
        &json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{
            "name":"generate_image","arguments":{"prompt":"x","style_image_path": junk.to_string_lossy()}
        }}),
    )
    .await;
    let resp = read_msg(&mut r).await;
    assert_eq!(resp["result"]["isError"], true);
    let text = resp["result"]["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("not a PNG"), "{text}");
    assert!(mock.calls_snapshot().is_empty());
}

#[test]
fn load_key_strips_bom_cr_and_whitespace() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("key");
    // The bnr_key gremlin: BOM + CRLF from a Windows-authored file.
    std::fs::write(&p, "\u{feff}sk-live-abc123\r\n").unwrap();
    assert_eq!(adapter_pixellab::load_key(&p).unwrap(), "sk-live-abc123");

    let empty = dir.path().join("empty");
    std::fs::write(&empty, "").unwrap();
    assert!(adapter_pixellab::load_key(&empty).is_err());

    let missing = dir.path().join("missing");
    assert!(adapter_pixellab::load_key(&missing).is_err());
}
