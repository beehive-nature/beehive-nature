//! B9 through the built executable: scripted loopback backends, real
//! files on disk, independent verification of the artifacts.
//!
//! These tests run `harness-sovereign` as a subprocess. The stub
//! backends speak just enough OpenAI-compatible SSE for the real
//! backend adapter; acceptance is read back from the artifacts the
//! run leaves behind, never from helper calls in the run's process.

use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::{Arc, Mutex};

const MANIFEST: &[u8] = b"[\n {\"id\": \"bio-0007\", \"kg\": 120},\n {\"id\": \"bio-0042\", \"kg\": 98},\n {\"id\": \"bio-0013\", \"kg\": 455}\n]";
const ORDER: &str = "ORDER-A";

fn tool_call_text_for(order: &str) -> String {
    format!(
        "Producing the receipt now.\n```tool\n{{\"id\": \"b1\", \"name\": \"b9_receipt\", \"args\": {{\"order_id\": \"{order}\"}}}}\n```\n"
    )
}

fn tool_call_text() -> String {
    format!(
        "Producing the receipt now.\n```tool\n{{\"id\": \"b1\", \"name\": \"b9_receipt\", \"args\": {{\"order_id\": \"{ORDER}\"}}}}\n```\n"
    )
}

/// A scripted OpenAI-compatible loopback backend. Chat requests pop
/// the next scripted assistant text; `/models` always succeeds so the
/// prober sees a healthy backend.
struct StubBackend {
    url: String,
}

fn start_stub(script: Vec<String>) -> StubBackend {
    let listener = TcpListener::bind("127.0.0.1:0").expect("stub bind");
    let url = format!("http://{}", listener.local_addr().expect("stub addr"));
    let queue = Arc::new(Mutex::new(VecDeque::from(script)));
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let queue = queue.clone();
            std::thread::spawn(move || handle(stream, queue));
        }
    });
    StubBackend { url }
}

fn handle(mut stream: TcpStream, queue: Arc<Mutex<VecDeque<String>>>) {
    let mut reader = BufReader::new(stream.try_clone().expect("clone stream"));
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => return,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    break;
                }
                if let Some((name, value)) = trimmed.split_once(':') {
                    if name.eq_ignore_ascii_case("content-length") {
                        content_length = value.trim().parse().unwrap_or(0);
                    }
                }
            }
            Err(_) => return,
        }
    }
    let mut body = vec![0u8; content_length];
    if reader.read_exact(&mut body).is_err() {
        return;
    }
    let (content_type, payload) = if request_line.contains("/models") {
        ("application/json", "{}".to_string())
    } else if request_line.contains("/chat/completions") {
        let text = queue
            .lock()
            .expect("queue")
            .pop_front()
            .unwrap_or_else(|| "done".to_string());
        let event = serde_json::json!({"choices": [{"delta": {"content": text}}]});
        (
            "text/event-stream",
            format!("data: {event}\n\ndata: [DONE]\n\n"),
        )
    } else {
        ("text/plain", "not found".to_string())
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{payload}",
        payload.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn scenario_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("harness-b9-binary-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("scenario dir");
    std::fs::write(dir.join("manifest.json"), MANIFEST).expect("manifest");
    dir
}

fn vault_phrase() -> String {
    format!("{}art", "abandon ".repeat(23))
}

fn run_binary(
    dir: &Path,
    workdir_name: &str,
    order: &str,
    max_turns: u32,
    backend_urls: &[String],
) -> (PathBuf, Output) {
    let workdir = dir.join(workdir_name);
    let mut command = Command::new(env!("CARGO_BIN_EXE_harness-sovereign"));
    command
        .arg("--workdir")
        .arg(&workdir)
        .arg("--session")
        .arg(format!("sess-{workdir_name}"))
        .arg("--manifest")
        .arg(dir.join("manifest.json"))
        .arg("--order-id")
        .arg(order)
        .arg("--max-turns")
        .arg(max_turns.to_string())
        .env("HARNESS_VAULT_REC", vault_phrase())
        .env("MODEL_API_KEY", "test-key-not-a-secret");
    for url in backend_urls {
        command.arg("--backend-url").arg(url);
    }
    let output = command.output().expect("binary runs");
    (workdir, output)
}

/// Run the binary into an explicit workdir under an explicit
/// session (for evidence-isolation scenarios).
fn run_binary_at(
    dir: &Path,
    workdir: &Path,
    session: &str,
    order: &str,
    backend_urls: &[String],
) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_harness-sovereign"));
    command
        .arg("--workdir")
        .arg(workdir)
        .arg("--session")
        .arg(session)
        .arg("--manifest")
        .arg(dir.join("manifest.json"))
        .arg("--order-id")
        .arg(order)
        .arg("--max-turns")
        .arg("6")
        .env("HARNESS_VAULT_REC", vault_phrase())
        .env("MODEL_API_KEY", "test-key-not-a-secret");
    for url in backend_urls {
        command.arg("--backend-url").arg(url);
    }
    command.output().expect("binary runs")
}

fn verify_only(workdir: &Path, extra: &[&str]) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_harness-sovereign"));
    command
        .arg("--verify-only")
        .arg("--workdir")
        .arg(workdir)
        .env("HARNESS_VAULT_REC", vault_phrase());
    for arg in extra {
        command.arg(arg);
    }
    command.output().expect("verify-only runs")
}

fn run_root(workdir: &Path, workdir_name: &str) -> PathBuf {
    workdir.join("runs").join(format!("sess-{workdir_name}"))
}

fn read_material(run_root: &Path) -> harness_sovereign::identity::PublicMaterial {
    let text = std::fs::read_to_string(run_root.join("public-material.json"))
        .expect("public material exported");
    serde_json::from_str(&text).expect("public material parses")
}

fn closed_url() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("closed bind");
    let url = format!("http://{}", listener.local_addr().expect("closed addr"));
    drop(listener);
    url
}

#[test]
fn zero_turns_fail_without_a_receipt() {
    let dir = scenario_dir("zero");
    let stub = start_stub(vec![tool_call_text(), "done".to_string()]);
    let (workdir, output) = run_binary(&dir, "run-zero", ORDER, 0, &[stub.url]);
    assert!(
        !output.status.success(),
        "zero turns must exit nonzero: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!run_root(&workdir, "run-zero").join("receipt.json").exists());
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn end_turn_without_receipt_fails() {
    let dir = scenario_dir("no-receipt");
    let stub = start_stub(vec!["All done, no tool needed.".to_string()]);
    let (workdir, output) = run_binary(&dir, "run-noreceipt", ORDER, 6, &[stub.url]);
    assert!(
        !output.status.success(),
        "EndTurn without a receipt must exit nonzero: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!run_root(&workdir, "run-noreceipt")
        .join("receipt.json")
        .exists());
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn valid_completed_task_passes_and_artifacts_verify_from_disk() {
    let dir = scenario_dir("valid");
    let stub = start_stub(vec![
        tool_call_text(),
        "Receipt produced. Task complete.".to_string(),
    ]);
    let (workdir, output) = run_binary(&dir, "run-valid", ORDER, 6, &[stub.url]);
    assert!(
        output.status.success(),
        "valid run must exit zero: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    // Independent verification in this process, from disk artifacts.
    let root = run_root(&workdir, "run-valid");
    let material = read_material(&root);
    let frozen = std::fs::read(root.join("frozen-manifest.bin")).expect("frozen manifest");
    assert_eq!(frozen, MANIFEST);
    // Complete saved-run verification agrees from disk as well.
    let saved = harness_sovereign::b9::verify_saved_run(&workdir, &root, Some(ORDER))
        .expect("saved run verifies completely");
    assert_eq!(saved.receipt.order_id, ORDER);
    let receipt = harness_sovereign::b9::verify_receipt_file(
        &root.join("receipt.json"),
        &frozen,
        &material,
        ORDER,
    )
    .expect("receipt verifies from disk");
    assert_eq!(receipt.item_count, 3);

    // The run definition is the single source: saved goal, order and
    // transcript evidence all agree with it.
    let definition: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(root.join("run-definition.json")).expect("definition"),
    )
    .expect("definition parses");
    assert_eq!(definition["order_id"], ORDER);
    let goal: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(workdir.join(format!("sessions/sess-run-valid.goal.json")))
            .expect("saved goal"),
    )
    .expect("goal parses");
    assert_eq!(goal["task_id"], ORDER);
    let transcript = std::fs::read_to_string(root.join("evidence/transcript.canonical.txt"))
        .expect("transcript evidence");
    assert!(
        transcript.contains("receipt.json written for order ORDER-A"),
        "tool result must be in the exported transcript: {transcript}"
    );
    // Verify-only through the binary agrees, with no keystore use.
    let verify = verify_only(&workdir, &[]);
    assert!(
        verify.status.success(),
        "verify-only must pass: {}",
        String::from_utf8_lossy(&verify.stderr)
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn tampered_receipt_and_wrong_order_fail_verify_only() {
    let dir = scenario_dir("tampered");
    let stub = start_stub(vec![
        tool_call_text(),
        "Receipt produced. Task complete.".to_string(),
    ]);
    let (workdir, output) = run_binary(&dir, "run-tampered", ORDER, 6, &[stub.url]);
    assert!(output.status.success(), "setup run must pass");

    // Wrong requested order: the receipt is genuinely valid for
    // ORDER-A, so only the order binding can refuse ORDER-B.
    let wrong_order = verify_only(&workdir, &["--order-id", "ORDER-B"]);
    assert!(
        !wrong_order.status.success(),
        "verify-only for ORDER-B must fail: {}",
        String::from_utf8_lossy(&wrong_order.stderr)
    );
    let right_order = verify_only(&workdir, &["--order-id", ORDER]);
    assert!(right_order.status.success(), "control: ORDER-A passes");

    // Tampered receipt: flip the recorded count on disk; both the
    // binary's verify-only path and this process must refuse it.
    let root = run_root(&workdir, "run-tampered");
    let receipt_path = root.join("receipt.json");
    let mut receipt: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&receipt_path).expect("receipt"))
            .expect("receipt parses");
    receipt["item_count"] = serde_json::json!(99);
    std::fs::write(&receipt_path, receipt.to_string()).expect("tamper");
    let tampered = verify_only(&workdir, &[]);
    assert!(
        !tampered.status.success(),
        "tampered receipt must fail verify-only: {}",
        String::from_utf8_lossy(&tampered.stderr)
    );
    let material = read_material(&root);
    assert!(
        harness_sovereign::b9::verify_receipt_file(&receipt_path, MANIFEST, &material, ORDER)
            .is_err()
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn primary_connection_failure_then_replacement_completes() {
    let dir = scenario_dir("failover");
    let stub = start_stub(vec![
        tool_call_text(),
        "Receipt produced after failover. Task complete.".to_string(),
    ]);
    let dead = closed_url();
    let (workdir, output) = run_binary(&dir, "run-failover", ORDER, 8, &[dead, stub.url]);
    assert!(
        output.status.success(),
        "failover run must exit zero: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let root = run_root(&workdir, "run-failover");
    let transcript = std::fs::read_to_string(root.join("evidence/transcript.canonical.txt"))
        .expect("transcript evidence");
    assert!(
        transcript.contains("[harness] Provider failover at "),
        "handoff must be in the exported transcript: {transcript}"
    );
    let checkpoints: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(root.join("evidence/checkpoints.json"))
            .expect("checkpoint evidence"),
    )
    .expect("checkpoints parse");
    let phases: Vec<&str> = checkpoints
        .as_array()
        .expect("checkpoint array")
        .iter()
        .filter_map(|c| c["phase"].as_str())
        .collect();
    assert!(
        phases.contains(&"pre-switch") && phases.contains(&"post-switch"),
        "signed checkpoint pair must be exported: {phases:?}"
    );
    // Complete saved-run verification, including the signed
    // checkpoint pair as SAME ACTOR, agrees from disk.
    let saved = harness_sovereign::b9::verify_saved_run(&workdir, &root, Some(ORDER))
        .expect("failover saved run verifies completely");
    assert!(saved.same_actor_verified);
    assert_eq!(saved.checkpoint_signatures_verified, 2);
    // Backend health snapshot is part of the exported evidence.
    let health: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(root.join("evidence/backend-health.json"))
            .expect("backend health evidence"),
    )
    .expect("health parses");
    let backends = health.as_array().expect("health array");
    assert_eq!(backends.len(), 2);
    assert_eq!(backends[0]["healthy"], serde_json::json!(false));
    assert_eq!(backends[1]["healthy"], serde_json::json!(true));
    let verify = verify_only(&workdir, &[]);
    assert!(verify.status.success(), "failover receipt must verify");
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn two_runs_in_one_workdir_keep_isolated_evidence() {
    // Two sessions, two orders, ONE workdir: each run's definition,
    // material, receipt and evidence live in its own runs/<session>/
    // root, and neither overwrites the other.
    let dir = scenario_dir("isolated");
    let workdir = dir.join("shared-workdir");
    let stub_a = start_stub(vec![tool_call_text_for("ORDER-A"), "done A".to_string()]);
    let out_a = run_binary_at(&dir, &workdir, "sess-alpha", "ORDER-A", &[stub_a.url]);
    assert!(
        out_a.status.success(),
        "run A: {}",
        String::from_utf8_lossy(&out_a.stderr)
    );
    let root_a = workdir.join("runs/sess-alpha");
    let receipt_a = std::fs::read(root_a.join("receipt.json")).expect("receipt A");

    let stub_b = start_stub(vec![tool_call_text_for("ORDER-B"), "done B".to_string()]);
    let out_b = run_binary_at(&dir, &workdir, "sess-beta", "ORDER-B", &[stub_b.url]);
    assert!(
        out_b.status.success(),
        "run B: {}",
        String::from_utf8_lossy(&out_b.stderr)
    );
    let root_b = workdir.join("runs/sess-beta");

    assert_eq!(
        std::fs::read(root_a.join("receipt.json")).expect("receipt A reread"),
        receipt_a,
        "run B must not overwrite run A's evidence"
    );
    let saved_a = harness_sovereign::b9::verify_saved_run(&workdir, &root_a, Some("ORDER-A"))
        .expect("run A verifies after B");
    let saved_b = harness_sovereign::b9::verify_saved_run(&workdir, &root_b, Some("ORDER-B"))
        .expect("run B verifies");
    assert_eq!(saved_a.order_id, "ORDER-A");
    assert_eq!(saved_b.order_id, "ORDER-B");
    assert_ne!(saved_a.did, saved_b.did);
    std::fs::remove_dir_all(&dir).ok();
}
