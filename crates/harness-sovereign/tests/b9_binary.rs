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
        if text == "DROP" {
            // Transport failure: close without any response, so the
            // real backend adapter reports a transport error and the
            // coordinator fails over.
            return;
        }
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

fn expectations(
    root: &Path,
    session: &str,
    order: &str,
) -> harness_sovereign::b9::SavedRunExpectations {
    harness_sovereign::b9::SavedRunExpectations {
        session_id: session.to_string(),
        order_id: order.to_string(),
        material: read_material(root),
        manifest: MANIFEST.to_vec(),
    }
}

fn verify_only(dir: &Path, workdir: &Path, session: &str, order: &str) -> Output {
    let root = workdir.join("runs").join(session);
    let mut command = Command::new(env!("CARGO_BIN_EXE_harness-sovereign"));
    command
        .arg("--verify-only")
        .arg("--workdir")
        .arg(workdir)
        .arg("--session")
        .arg(session)
        .arg("--order-id")
        .arg(order)
        .arg("--public-material")
        .arg(root.join("public-material.json"))
        .arg("--manifest")
        .arg(dir.join("manifest.json"))
        .env("HARNESS_VAULT_REC", vault_phrase());
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
    let saved = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root,
        &expectations(&root, "sess-run-valid", ORDER),
    )
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
    let verify = verify_only(&dir, &workdir, "sess-run-valid", ORDER);
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
    let wrong_order = verify_only(&dir, &workdir, "sess-run-tampered", "ORDER-B");
    assert!(
        !wrong_order.status.success(),
        "verify-only for ORDER-B must fail: {}",
        String::from_utf8_lossy(&wrong_order.stderr)
    );
    let right_order = verify_only(&dir, &workdir, "sess-run-tampered", ORDER);
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
    let tampered = verify_only(&dir, &workdir, "sess-run-tampered", ORDER);
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
    let saved = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root,
        &expectations(&root, "sess-run-failover", ORDER),
    )
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
    let verify = verify_only(&dir, &workdir, "sess-run-failover", ORDER);
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
    let saved_a = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root_a,
        &expectations(&root_a, "sess-alpha", "ORDER-A"),
    )
    .expect("run A verifies after B");
    let saved_b = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root_b,
        &expectations(&root_b, "sess-beta", "ORDER-B"),
    )
    .expect("run B verifies");
    assert_eq!(saved_a.order_id, "ORDER-A");
    assert_eq!(saved_b.order_id, "ORDER-B");
    assert_ne!(saved_a.did, saved_b.did);
    std::fs::remove_dir_all(&dir).ok();
}

fn copy_dir(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).expect("copy dest");
    for entry in std::fs::read_dir(from).expect("read dir") {
        let entry = entry.expect("entry");
        let target = to.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), &target).expect("copy file");
        }
    }
}

fn snapshot_tree(root: &Path) -> Vec<(String, Vec<u8>)> {
    let mut out = Vec::new();
    let mut walk = vec![root.to_path_buf()];
    while let Some(dir) = walk.pop() {
        for entry in std::fs::read_dir(&dir).expect("snapshot read") {
            let entry = entry.expect("snapshot entry");
            if entry.path().is_dir() {
                walk.push(entry.path());
            } else {
                out.push((
                    entry
                        .path()
                        .strip_prefix(root)
                        .expect("under root")
                        .to_string_lossy()
                        .replace('\\', "/"),
                    std::fs::read(entry.path()).expect("snapshot file"),
                ));
            }
        }
    }
    out.sort();
    out
}

#[test]
fn agent3_counterexamples_refused_with_fresh_valid_controls() {
    // Agent 3's published counterexample shapes (#494 at 31ab1820),
    // rerun against fresh valid runs produced by this binary. Every
    // tamper works on a disposable copy; the fresh control passes.
    let dir = scenario_dir("counterexamples");
    let stub = start_stub(vec![
        tool_call_text(),
        "Receipt produced. Task complete.".to_string(),
    ]);
    let (workdir, output) = run_binary(&dir, "run-ctr", ORDER, 6, &[stub.url]);
    assert!(output.status.success(), "fresh valid control run");
    let session = "sess-run-ctr";

    let control = dir.join("copy-control");
    copy_dir(&workdir, &control);
    let ok = verify_only(&dir, &control, session, ORDER);
    assert!(
        ok.status.success(),
        "fresh control must pass: {}",
        String::from_utf8_lossy(&ok.stderr)
    );

    let outcome_path = |wd: &Path| wd.join(format!("runs/{session}/evidence/run-outcome.json"));
    let tamper_case = |tag: &str, tamper: &dyn Fn(&Path)| {
        let copy = dir.join(format!("copy-{tag}"));
        copy_dir(&workdir, &copy);
        tamper(&copy);
        let out = verify_only(&dir, &copy, session, ORDER);
        assert!(
            !out.status.success(),
            "{tag} must be refused: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    };

    // R2b: bare hand-written outcome, no authentication.
    tamper_case("r2b", &|copy| {
        std::fs::write(outcome_path(copy), "{\"run\":\"Ok(EndTurn)\"}").expect("tamper");
    });
    // R2a shape: outcome kind is not exactly EndTurn (and the record
    // no longer matches its signature).
    tamper_case("r2a", &|copy| {
        let path = outcome_path(copy);
        let mut value: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).expect("outcome"))
                .expect("outcome parses");
        value["outcome_kind"] = serde_json::json!("Cancelled before EndTurn");
        std::fs::write(&path, value.to_string()).expect("tamper");
    });
    // R1 shape: a successful outcome record from another run pasted
    // over this one — it binds another actor/transcript.
    {
        let other_dir = scenario_dir("counterexample-other");
        let other_stub = start_stub(vec![
            tool_call_text(),
            "Receipt produced. Task complete.".to_string(),
        ]);
        let (other_workdir, other_out) =
            run_binary(&other_dir, "run-ctr", ORDER, 6, &[other_stub.url]);
        assert!(other_out.status.success(), "donor run");
        tamper_case("r1", &|copy| {
            let donor = other_workdir.join("runs/sess-run-ctr/evidence/run-outcome.json");
            std::fs::copy(&donor, outcome_path(copy)).expect("paste outcome");
        });
        std::fs::remove_dir_all(&other_dir).ok();
    }
    // R6: same order, wrong requested session.
    {
        let out = verify_only(&dir, &control, "sess-does-not-exist", ORDER);
        assert!(!out.status.success(), "wrong session must be refused");
        let root = run_root(&control, "run-ctr");
        assert!(harness_sovereign::b9::verify_saved_run(
            &control,
            &root,
            &expectations(&root, "sess-does-not-exist", ORDER),
        )
        .is_err());
    }
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn agent3_checkpoint_inventory_counterexamples_are_refused() {
    // Failover run: two signed checkpoints, complete inventory.
    let dir = scenario_dir("ckpt-counterexamples");
    let stub = start_stub(vec![
        tool_call_text(),
        "Receipt produced after failover. Task complete.".to_string(),
    ]);
    let dead = closed_url();
    let (workdir, output) = run_binary(&dir, "run-fx", ORDER, 8, &[dead, stub.url]);
    assert!(output.status.success(), "fresh failover control run");
    let session = "sess-run-fx";
    let checkpoints_path = |wd: &Path| wd.join(format!("runs/{session}/evidence/checkpoints.json"));

    let control = dir.join("copy-control");
    copy_dir(&workdir, &control);
    assert!(
        verify_only(&dir, &control, session, ORDER).status.success(),
        "fresh failover control must pass"
    );

    let tamper_case = |tag: &str, tamper: &dyn Fn(&Path)| {
        let copy = dir.join(format!("copy-{tag}"));
        copy_dir(&workdir, &copy);
        tamper(&copy);
        let out = verify_only(&dir, &copy, session, ORDER);
        assert!(
            !out.status.success(),
            "{tag} must be refused: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    };
    // R4a: remove one exported entry (persisted log retains it).
    tamper_case("r4a-remove-entry", &|copy| {
        let path = checkpoints_path(copy);
        let mut value: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).expect("checkpoints"))
                .expect("checkpoints parse");
        value.as_array_mut().expect("array").remove(0);
        std::fs::write(&path, value.to_string()).expect("tamper");
    });
    // R4b: strip every envelope from the exported evidence.
    tamper_case("r4b-strip-envelope", &|copy| {
        let path = checkpoints_path(copy);
        let mut value: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).expect("checkpoints"))
                .expect("checkpoints parse");
        for entry in value.as_array_mut().expect("array") {
            entry
                .as_object_mut()
                .expect("entry")
                .remove("bsigner_envelope");
        }
        std::fs::write(&path, value.to_string()).expect("tamper");
    });
    // R4c: non-array checkpoint evidence.
    tamper_case("r4c-non-array", &|copy| {
        std::fs::write(checkpoints_path(copy), "{}").expect("tamper");
    });
    // R4d: whole exported file deleted.
    tamper_case("r4d-deleted", &|copy| {
        std::fs::remove_file(checkpoints_path(copy)).expect("tamper");
    });
    // R3: corrupt a checkpoint signature in BOTH the exported
    // evidence and the persisted log, so only signature verification
    // itself can refuse it.
    tamper_case("r3-corrupt-signature", &|copy| {
        for path in [
            checkpoints_path(copy),
            copy.join(format!("sessions/{session}.checkpoints.jsonl")),
        ] {
            let text = std::fs::read_to_string(&path).expect("read checkpoints");
            let marker = "\"signature_b64u\"";
            let after = text.find(marker).expect("signature field") + marker.len();
            let start = after + text[after..].find('"').expect("signature value") + 1;
            let mut bytes = text.into_bytes();
            bytes[start] = if bytes[start] == b'A' { b'B' } else { b'A' };
            std::fs::write(&path, bytes).expect("tamper");
        }
    });
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn occupied_session_refuses_before_mutation_and_original_stays_verifiable() {
    // R5: re-running into the same workdir/session must refuse
    // atomically, before identity generation or any mutation, and
    // the original run must remain byte-identical and verifiable.
    let dir = scenario_dir("reuse");
    let workdir = dir.join("reuse-workdir");
    let stub = start_stub(vec![tool_call_text(), "done".to_string()]);
    let first = run_binary_at(&dir, &workdir, "sess-reuse", ORDER, &[stub.url]);
    assert!(
        first.status.success(),
        "first run: {}",
        String::from_utf8_lossy(&first.stderr)
    );
    let before = snapshot_tree(&workdir);

    let stub2 = start_stub(vec![tool_call_text(), "done again".to_string()]);
    let second = run_binary_at(&dir, &workdir, "sess-reuse", ORDER, &[stub2.url]);
    assert!(
        !second.status.success(),
        "occupied session must refuse: {}",
        String::from_utf8_lossy(&second.stderr)
    );
    assert!(
        String::from_utf8_lossy(&second.stderr).contains("already occupied"),
        "refusal must name occupancy: {}",
        String::from_utf8_lossy(&second.stderr)
    );
    assert_eq!(
        snapshot_tree(&workdir),
        before,
        "refused reuse must leave the original run byte-identical"
    );
    let root = workdir.join("runs/sess-reuse");
    let saved = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root,
        &expectations(&root, "sess-reuse", ORDER),
    )
    .expect("original run still verifies after refused reuse");
    assert_eq!(saved.order_id, ORDER);
    std::fs::remove_dir_all(&dir).ok();
}

fn verify_with_pin(
    workdir: &Path,
    session: &str,
    order: &str,
    pin: &Path,
    manifest: &Path,
) -> Output {
    Command::new(env!("CARGO_BIN_EXE_harness-sovereign"))
        .arg("--verify-only")
        .arg("--workdir")
        .arg(workdir)
        .arg("--session")
        .arg(session)
        .arg("--order-id")
        .arg(order)
        .arg("--public-material")
        .arg(pin)
        .arg("--manifest")
        .arg(manifest)
        .env("HARNESS_VAULT_REC", vault_phrase())
        .output()
        .expect("verify-only with pin runs")
}

#[test]
fn verify_only_requires_explicit_expectations_and_refuses_identity_substitution() {
    // Two valid bundles: same session, same order, same manifest,
    // different identities. A's public material is retained outside
    // the disposable evidence as the pin; B's whole bundle is then
    // substituted into A's workdir and must refuse against A's pin.
    let dir = scenario_dir("identity-substitution");
    let manifest = dir.join("manifest.json");

    let workdir_a = dir.join("workdir-a");
    let stub_a = start_stub(vec![tool_call_text(), "done A".to_string()]);
    let out_a = run_binary_at(&dir, &workdir_a, "sess-bundle", ORDER, &[stub_a.url]);
    assert!(
        out_a.status.success(),
        "bundle A: {}",
        String::from_utf8_lossy(&out_a.stderr)
    );
    let pin_a = dir.join("pin-a-public-material.json");
    std::fs::copy(
        workdir_a.join("runs/sess-bundle/public-material.json"),
        &pin_a,
    )
    .expect("retain A pin outside the evidence");

    // Missing required expectation arguments refuse, naming the
    // missing expectation, before any artifact is trusted.
    for (tag, args) in [
        ("none", vec!["--verify-only", "--workdir"]),
        ("workdir-only-extra", vec!["--verify-only"]),
    ] {
        let _ = tag;
        let out = Command::new(env!("CARGO_BIN_EXE_harness-sovereign"))
            .args(args)
            .arg(&workdir_a)
            .env("HARNESS_VAULT_REC", vault_phrase())
            .output()
            .expect("missing-args invocation");
        assert!(
            !out.status.success()
                && String::from_utf8_lossy(&out.stderr).contains("missing required"),
            "{tag} must refuse for missing expectations: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }

    // Independently pinned control passes.
    let control = verify_with_pin(&workdir_a, "sess-bundle", ORDER, &pin_a, &manifest);
    assert!(
        control.status.success(),
        "pinned control must pass: {}",
        String::from_utf8_lossy(&control.stderr)
    );

    // Bundle B: same session/order/manifest, a different identity.
    let workdir_b = dir.join("workdir-b");
    let stub_b = start_stub(vec![tool_call_text(), "done B".to_string()]);
    let out_b = run_binary_at(&dir, &workdir_b, "sess-bundle", ORDER, &[stub_b.url]);
    assert!(
        out_b.status.success(),
        "bundle B: {}",
        String::from_utf8_lossy(&out_b.stderr)
    );

    // Substitute B's whole bundle into A's workdir.
    for name in ["runs", "sessions"] {
        let _ = std::fs::remove_dir_all(workdir_a.join(name));
        copy_dir(&workdir_b.join(name), &workdir_a.join(name));
    }
    let substituted = verify_with_pin(&workdir_a, "sess-bundle", ORDER, &pin_a, &manifest);
    assert!(
        !substituted.status.success(),
        "B's bundle must refuse against A's pin: {}",
        String::from_utf8_lossy(&substituted.stderr)
    );
    std::fs::remove_dir_all(&dir).ok();
}

fn mutate_checkpoints_both_copies(
    workdir: &Path,
    session: &str,
    mutate: &dyn Fn(&mut Vec<serde_json::Value>),
) {
    let exported_path = workdir.join(format!("runs/{session}/evidence/checkpoints.json"));
    let mut entries: Vec<serde_json::Value> = serde_json::from_str(
        &std::fs::read_to_string(&exported_path).expect("exported checkpoints"),
    )
    .expect("checkpoints parse");
    mutate(&mut entries);
    std::fs::write(
        &exported_path,
        serde_json::to_string_pretty(&entries).expect("serialize exported"),
    )
    .expect("write exported");
    let persisted = entries
        .iter()
        .map(|entry| serde_json::to_string(entry).expect("serialize entry"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    std::fs::write(
        workdir.join(format!("sessions/{session}.checkpoints.jsonl")),
        persisted,
    )
    .expect("write persisted");
}

#[test]
fn inventory_commitment_and_interior_signature_regressions() {
    // A three-checkpoint control: primary drops, secondary drops,
    // tertiary completes — pre-switch, pre-switch, post-switch.
    let dir = scenario_dir("inventory");
    // The backend adapter retries transport failures internally
    // (three attempts), so the middle backend must drop them all
    // before the coordinator fails over.
    let mid = start_stub(vec![
        "DROP".to_string(),
        "DROP".to_string(),
        "DROP".to_string(),
    ]);
    let finisher = start_stub(vec![
        tool_call_text(),
        "Receipt produced after two failovers.".to_string(),
    ]);
    // The dead endpoint is claimed last, so its freed port cannot be
    // reused by either live stub listener.
    let dead = closed_url();
    let (workdir, output) = run_binary(
        &dir,
        "run-inv",
        ORDER,
        10,
        &[dead, mid.url.clone(), finisher.url.clone()],
    );
    let _ = (&mid, &finisher);
    assert!(
        output.status.success(),
        "three-checkpoint control run: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let session = "sess-run-inv";
    let root = run_root(&workdir, "run-inv");
    let saved = harness_sovereign::b9::verify_saved_run(
        &workdir,
        &root,
        &expectations(&root, session, ORDER),
    )
    .expect("three-checkpoint control verifies");
    assert_eq!(saved.checkpoint_signatures_verified, 3);
    assert!(saved.same_actor_verified);

    let case = |tag: &str, mutate: &dyn Fn(&mut Vec<serde_json::Value>)| -> String {
        let copy = dir.join(format!("copy-{tag}"));
        copy_dir(&workdir, &copy);
        mutate_checkpoints_both_copies(&copy, session, mutate);
        let root = copy.join(format!("runs/{session}"));
        let err = harness_sovereign::b9::verify_saved_run(
            &copy,
            &root,
            &expectations(&root, session, ORDER),
        )
        .expect_err(&format!("{tag} must be refused"));
        err
    };

    // Two-copy substitution [pre, post] -> [pre, pre]: every
    // remaining envelope verifies, so only the signed inventory
    // commitment can refuse it.
    let err = case("duplicate", &|entries| {
        // Order-preserving duplication of the first entry over the
        // middle one ([pre, pre, post]): every envelope verifies and
        // turn counts stay non-decreasing, so only the signed
        // inventory commitment can refuse it.
        let first = entries[0].clone();
        entries[1] = first;
    });
    assert!(
        err.contains("stage=inventory-commitment"),
        "duplication refusal stage: {err}"
    );

    // Consistent metadata mutation in both copies.
    let err = case("metadata", &|entries| {
        entries[0]["phase"] = serde_json::json!("mutated-phase");
    });
    assert!(
        err.contains("stage=inventory-commitment"),
        "metadata refusal stage: {err}"
    );

    // Same-length reordered entries, consistently in both copies.
    let err = case("reorder", &|entries| {
        entries.reverse();
    });
    assert!(!err.is_empty(), "reorder must be refused: {err}");

    // Genuine interior signature failure: corrupt the middle
    // checkpoint's signature in both copies. The refusal stage must
    // be signature verification itself, not a later stage.
    let err = case("interior-signature", &|entries| {
        let signature = entries[1]["bsigner_envelope"]["signature_b64u"]
            .as_str()
            .expect("middle signature")
            .to_string();
        let mut bytes = signature.into_bytes();
        bytes[0] = if bytes[0] == b'A' { b'B' } else { b'A' };
        entries[1]["bsigner_envelope"]["signature_b64u"] =
            serde_json::json!(String::from_utf8(bytes).expect("still base64url alphabet"));
    });
    assert!(
        err.contains("stage=checkpoint-signature") && err.contains("checkpoint 1"),
        "interior refusal stage must be checkpoint-signature: {err}"
    );

    // The untouched control still passes through the binary too.
    let control = dir.join("copy-control");
    copy_dir(&workdir, &control);
    assert!(
        verify_only(&dir, &control, session, ORDER).status.success(),
        "three-checkpoint control must pass verify-only"
    );
    std::fs::remove_dir_all(&dir).ok();
}
