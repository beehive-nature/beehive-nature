//! G2-B fresh-process persistence + offline-CLI matrix rows: resume from
//! a checkpoint on disk after in-memory state is discarded, repeat-only
//! (never skip) when deliberately reusing an old checkpoint, default
//! output excludes raw payloads, and the source is never modified.
use std::io::Write;
use std::process::Command;

use serde_json::Value;

const BIN: &str = env!("CARGO_BIN_EXE_banchor");

fn run(args: &[&str]) -> (bool, String, String) {
    let out = Command::new(BIN)
        .args(args)
        .output()
        .expect("spawn banchor");
    (
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

fn rec(ev: &str, extra: &str) -> String {
    format!("{{\"t\":\"2026-09-07T00:00:00Z\",\"t_ms\":1,\"ev\":\"{ev}\"{extra}}}\n")
}

#[test]
fn fresh_process_resume_repeat_only_and_payload_exclusion() {
    let dir = std::env::temp_dir().join("banchor-g2b-process");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let replay = dir.join("replay.jsonl");
    // a replay containing click/approve/model-shaped payloads
    let body = format!(
        "{}{}{}{}{}",
        rec("session_start", ""),
        rec(
            "model_turn",
            ",\"response\":{\"__untrusted\":true,\"v\":\"PAYLOAD-SENTINEL-MODEL\"}"
        ),
        rec(
            "click",
            ",\"name\":{\"__untrusted\":true,\"v\":\"PAYLOAD-SENTINEL-CLICK\"}"
        ),
        rec("approved", ",\"risks\":[\"spend\"]"),
        rec(
            "session_end",
            ",\"ok\":true,\"halted\":false,\"gaps\":false"
        ),
    );
    std::fs::write(&replay, body.as_bytes()).unwrap();
    let bytes_before = std::fs::read(&replay).unwrap();

    // run 1: fresh process, no cursor, one-record batches
    let (ok, out, err) = run(&[
        "replay-inspect",
        "--file",
        replay.to_str().unwrap(),
        "--source-key",
        "proc-k",
        "--max-records",
        "1",
    ]);
    assert!(ok, "run1 stderr: {err}");
    let v: Value = serde_json::from_str(&out).expect("run1 json");
    assert_eq!(v["records"].as_array().unwrap().len(), 1);
    assert_eq!(v["records"][0]["ev"], "session_start");
    assert_eq!(v["session"]["writer_acknowledgment"], "unknown");
    assert_eq!(v["stop"]["kind"], "limit_reached");
    // default output excludes raw payloads
    assert!(!out.contains("PAYLOAD-SENTINEL"));
    // candidate cursor is PROPOSED, not saved
    assert_eq!(
        v["note"],
        "candidate cursor NOT saved — accept the batch, then save a new checkpoint explicitly"
    );

    // the caller accepts the batch and explicitly saves the checkpoint
    let cp1 = dir.join("cp1.json");
    std::fs::write(&cp1, v["candidate_cursor"].to_string().as_bytes()).unwrap();

    // run 2: FRESH PROCESS resuming from the disk checkpoint
    let (ok2, out2, err2) = run(&[
        "replay-inspect",
        "--file",
        replay.to_str().unwrap(),
        "--source-key",
        "proc-k",
        "--cursor",
        cp1.to_str().unwrap(),
        "--max-records",
        "2",
    ]);
    assert!(ok2, "run2 stderr: {err2}");
    let v2: Value = serde_json::from_str(&out2).expect("run2 json");
    let evs2: Vec<&str> = v2["records"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["ev"].as_str().unwrap())
        .collect();
    assert_eq!(evs2, vec!["model_turn", "click"], "resume never repeats");
    assert!(
        v2["next_offset"].as_u64().unwrap() > v["next_offset"].as_u64().unwrap(),
        "resume advances"
    );

    // run 3: deliberately reusing the OLD checkpoint repeats, never skips
    let (ok3, out3, err3) = run(&[
        "replay-inspect",
        "--file",
        replay.to_str().unwrap(),
        "--source-key",
        "proc-k",
        "--cursor",
        cp1.to_str().unwrap(),
        "--max-records",
        "2",
    ]);
    assert!(ok3, "run3 stderr: {err3}");
    let v3: Value = serde_json::from_str(&out3).expect("run3 json");
    let evs3: Vec<&str> = v3["records"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["ev"].as_str().unwrap())
        .collect();
    assert_eq!(evs3, evs2, "old checkpoint repeats the same batch");
    assert_eq!(v3["next_offset"], v2["next_offset"]);

    // --raw returns payloads, explicitly labeled untrusted
    let (okr, outr, errr) = run(&[
        "replay-inspect",
        "--file",
        replay.to_str().unwrap(),
        "--source-key",
        "proc-k",
        "--max-records",
        "2",
        "--raw",
    ]);
    assert!(okr, "raw stderr: {errr}");
    assert!(outr.contains("raw_untrusted") && outr.contains("PAYLOAD-SENTINEL"));

    // the source was never modified
    assert_eq!(std::fs::read(&replay).unwrap(), bytes_before);

    // a wrong-key cursor refuses with a nonzero exit
    let bad_cp = dir.join("bad.json");
    std::fs::write(
        &bad_cp,
        v["candidate_cursor"]
            .to_string()
            .replace("proc-k", "other-k"),
    )
    .unwrap();
    let (okb, _, errb) = run(&[
        "replay-inspect",
        "--file",
        replay.to_str().unwrap(),
        "--source-key",
        "proc-k",
        "--cursor",
        bad_cp.to_str().unwrap(),
    ]);
    assert!(!okb);
    assert!(errb.contains("cursor refused"));
    let _ = std::fs::remove_dir_all(&dir);
    let _ = Write::write(&mut std::io::stdout(), b"");
}
