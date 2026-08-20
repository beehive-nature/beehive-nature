//! Buzz mesh heartbeat — minimal b-metered presence.
//! Uses bmesh-hwfit (crate 36, commit 6a4e47a) for model-fit scoring.

use axum::response::{IntoResponse, Response};
use axum::Json;

/// GET /v1/mesh/heartbeat — returns this node's mesh presence.
/// Reads hardware from /proc, scores against bmesh-hwfit catalog.
pub async fn heartbeat() -> Response {
    let cpu_cores = detect_cpu_cores();
    let ram_bytes = detect_ram();
    let gpu_vram = detect_gpu_vram();
    let arch = std::env::consts::ARCH.to_string();

    let gpu_name: Option<String> = gpu_vram.map(|_| "detected".into());
    let profile = bmesh_hwfit::NodeProfile::manual(gpu_vram, gpu_name, cpu_cores, ram_bytes, &arch);

    let catalog = bmesh_hwfit::default_catalog();
    let scores = bmesh_hwfit::best_fit(&profile, &catalog);

    // Extract best-fit model name from the reason string
    let (best_model, best_score) = match scores.first() {
        Some(s) => {
            let name = s
                .reason
                .split(" — ")
                .next()
                .unwrap_or("unknown")
                .to_string();
            (name, s.score)
        }
        None => ("none fits".into(), 0.0),
    };

    let all_fits: Vec<serde_json::Value> = scores
        .iter()
        .map(|s| {
            serde_json::json!({
                "model": s.reason.split(" — ").next().unwrap_or("?"),
                "score": s.score,
            })
        })
        .collect();

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let vram_gb = gpu_vram.map(|v| v as f64 / 1_073_741_824.0).unwrap_or(0.0);
    let ram_gb = ram_bytes as f64 / 1_073_741_824.0;

    Json(serde_json::json!({
        "node_id": "bnr-relay-vps",
        "status": if gpu_vram.is_some() { "ready" } else { "standby" },
        "model_name": best_model,
        "fit_score": best_score,
        "hardware": {
            "arch": arch,
            "cpu_cores": cpu_cores,
            "ram_gb": (ram_gb * 10.0).round() / 10.0,
            "gpu": if gpu_vram.is_some() { "present" } else { "none" },
            "vram_total_gb": (vram_gb * 10.0).round() / 10.0,
        },
        "all_fits": all_fits,
        "last_seen_epoch": now_secs,
        "b_metered_tokens_this_epoch": 0,
    }))
    .into_response()
}

/// Detect CPU core count from /proc/cpuinfo.
fn detect_cpu_cores() -> u32 {
    std::fs::read_to_string("/proc/cpuinfo")
        .map(|s| s.lines().filter(|l| l.starts_with("processor")).count() as u32)
        .unwrap_or(0)
}

/// Detect total RAM from /proc/meminfo (returns bytes).
fn detect_ram() -> u64 {
    std::fs::read_to_string("/proc/meminfo")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("MemTotal:"))
                .and_then(|l| l.split_whitespace().nth(1))
                .and_then(|v| v.parse::<u64>().ok())
                .map(|kb| kb * 1024)
        })
        .unwrap_or(0)
}

/// Detect GPU VRAM via nvidia-smi (returns bytes, or None if no NVIDIA GPU).
fn detect_gpu_vram() -> Option<u64> {
    std::process::Command::new("nvidia-smi")
        .arg("--query-gpu=memory.total")
        .arg("--format=csv,noheader,nounits")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|mib| mib * 1024 * 1024)
}
