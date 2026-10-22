//! The machine and toolchain a receipt was measured on. Read from the
//! operating system at run time; anything that cannot be read is written as
//! "unavailable", never guessed.

use std::path::Path;

use serde_json::{json, Value};

use crate::measure::output;

/// The ISA features the RB lanes care about: AES-NI and carry-less multiply
/// (Swanky's AES-based hashing and garbling, the AES backends of RB02),
/// AVX2/AVX-512 (Swanky's `vectoreyes`, built for the native CPU).
const ISA: &[&str] = &[
    "aes",
    "pclmulqdq",
    "vaes",
    "vpclmulqdq",
    "sse4_1",
    "avx",
    "avx2",
    "avx512f",
    "bmi2",
    "sha_ni",
];

pub fn host() -> Value {
    let cpuinfo = std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let field = |name: &str| {
        cpuinfo
            .lines()
            .find(|l| l.split(':').next().map(str::trim) == Some(name))
            .and_then(|l| l.split_once(':'))
            .map(|(_, v)| v.trim().to_string())
    };
    let flags: Vec<String> = field("flags")
        .map(|f| f.split_whitespace().map(String::from).collect())
        .unwrap_or_default();
    let isa: serde_json::Map<String, Value> = ISA
        .iter()
        .map(|f| (f.to_string(), json!(flags.iter().any(|x| x == f))))
        .collect();
    let os = std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("PRETTY_NAME="))
                .map(|l| l[12..].trim_matches('"').to_string())
        });
    let kernel = std::fs::read_to_string("/proc/sys/kernel/osrelease")
        .ok()
        .map(|s| s.trim().to_string());
    let mem_kib = std::fs::read_to_string("/proc/meminfo").ok().and_then(|s| {
        s.lines()
            .find(|l| l.starts_with("MemTotal:"))
            .and_then(|l| l.split_whitespace().nth(1)?.parse::<u64>().ok())
    });
    let na = |v: Option<String>| v.map_or(json!("unavailable"), Value::from);
    json!({
        "arch": std::env::consts::ARCH,
        "os": na(os),
        "kernel": na(kernel),
        "cpu_model": na(field("model name")),
        "logical_cpus": std::thread::available_parallelism().map(|n| n.get()).ok(),
        "isa": if flags.is_empty() { json!("unavailable") } else { Value::Object(isa) },
        "mem_total_kib": mem_kib,
        "virtualized": flags.iter().any(|f| f == "hypervisor"),
    })
}

/// 1-, 5- and 15-minute load averages, read before and after measured
/// phases: this box is shared, and a run measured under load says so.
pub fn loadavg() -> Value {
    std::fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|s| {
            let v: Vec<f64> = s
                .split_whitespace()
                .take(3)
                .filter_map(|x| x.parse().ok())
                .collect();
            (v.len() == 3).then(|| json!(v))
        })
        .unwrap_or(json!("unavailable"))
}

/// `rustc -vV` and `cargo -V` as the toolchain resolves in `cwd` (a
/// `rust-toolchain` file there selects it through rustup), or with an
/// explicit `+toolchain`.
pub fn rust_toolchain(cwd: &Path, toolchain: Option<&str>) -> Value {
    let plus = toolchain.map(|t| format!("+{t}"));
    let mut rustc = vec!["rustc"];
    let mut cargo = vec!["cargo"];
    if let Some(p) = &plus {
        rustc.push(p);
        cargo.push(p);
    }
    rustc.push("-vV");
    cargo.push("-V");
    let vv = output(&rustc, cwd);
    let mut v = json!({ "selected_by": toolchain.map_or("rust-toolchain file / rustup default in the build directory".to_string(), |t| format!("+{t}")) });
    match vv {
        Some(text) => {
            for line in text.lines() {
                if let Some((k, val)) = line.split_once(": ") {
                    v[k.replace('-', "_")] = json!(val);
                }
            }
            v["version"] = json!(text.lines().next().unwrap_or_default());
        }
        None => v["rustc"] = json!("unavailable"),
    }
    v["cargo"] = output(&cargo, cwd).map_or(json!("unavailable"), |s| json!(s.trim()));
    v
}

/// The commit a git checkout is at, and whether its tracked files differ.
pub fn git_identity(dir: &Path) -> Value {
    let head = output(&["git", "rev-parse", "HEAD"], dir).map(|s| s.trim().to_string());
    let dirty = output(
        &["git", "status", "--porcelain", "--untracked-files=no"],
        dir,
    )
    .map(|s| !s.trim().is_empty());
    json!({ "commit": head, "tracked_changes": dirty })
}

/// Seconds since the Unix epoch, as an RFC 3339 UTC timestamp.
pub fn utc_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    rfc3339(secs)
}

pub fn rfc3339(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // civil-from-days (Howard Hinnant's algorithm)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_are_civil_utc() {
        assert_eq!(rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(rfc3339(1_791_504_000), "2026-10-09T00:00:00Z");
        assert_eq!(rfc3339(4_102_444_799), "2099-12-31T23:59:59Z");
    }
}
