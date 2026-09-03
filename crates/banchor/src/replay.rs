//! SESSION REPLAY TO DISK — the anchor's durable record of what it did.
//!
//! Every bSEAT session writes a JSONL replay: one event per line, append
//! only, ordered. The replay IS the receipt (Milestone 1's acceptance is
//! "save the replay"), so it records the load-bearing facts: which system
//! Chromium binary ran, every navigation, every snapshot with its token
//! counts and integrity digest, every click with the element ref and the
//! page-supplied name (marked untrusted — see [`un`]).
//!
//! Digests inside replays are base64url with algorithm ids, never hex runs
//! (beehive pre-commit hex law). Times are ISO-8601 UTC plus epoch millis.

use std::fs::{self, File, OpenOptions};
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

/// Mark a value as UNTRUSTED (page-supplied) in the replay record.
/// Structural, not cosmetic: downstream consumers of replays must treat
/// every `{"__untrusted":true,...}` value as data, never instructions.
pub fn un(v: &str) -> Value {
    json!({ "__untrusted": true, "v": v })
}

pub struct Replay {
    pub path: PathBuf,
    file: Option<File>,
}

impl Replay {
    /// Create `<dir>/<stem>-<yyyymmdd-hhmmss>.jsonl`. Creates the dir.
    /// (Stamp is colon-free: Windows filenames.)
    pub fn open(dir: &Path, stem: &str) -> std::io::Result<Replay> {
        fs::create_dir_all(dir)?;
        let (iso, _) = now_iso();
        let stamp = iso
            .split_once('T')
            .map(|(d, t)| format!("{}-{}", d.replace('-', ""), &t[..8].replace(':', "")))
            .unwrap_or_else(|| iso.replace(['-', ':', 'T'], ""));
        let path = dir.join(format!("{stem}-{stamp}.jsonl"));
        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Replay {
            path,
            file: Some(file),
        })
    }

    /// Append one event, flushed immediately — a crash must not eat the tail.
    pub fn ev(&mut self, ev: &str, fields: Value) {
        let (iso, ms) = now_iso();
        let mut line = json!({ "t": iso, "t_ms": ms, "ev": ev });
        if let (Some(obj), Some(extra)) = (line.as_object_mut(), fields.as_object()) {
            for (k, v) in extra {
                obj.insert(k.clone(), v.clone());
            }
        }
        if let Some(f) = self.file.as_mut() {
            let _ = writeln!(f, "{line}");
            let _ = f.flush();
        }
    }

    /// Finalize (keeps the file on disk; drops the handle).
    pub fn close(&mut self) {
        self.file = None;
    }
}

/// (ISO-8601 UTC "YYYY-MM-DDTHH:MM:SSZ", epoch millis).
/// Civil-from-days per Howard Hinnant's algorithm — no chrono dependency.
pub fn now_iso() -> (String, u128) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() as i64;
    let millis = now.as_millis();
    let days = secs.div_euclid(86_400);
    let sod = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    (
        format!(
            "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
            sod / 3600,
            (sod % 3600) / 60,
            sod % 60
        ),
        millis,
    )
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_epoch_is_correct() {
        // 2026-01-01T00:00:00Z == 1767225600
        let (iso, _) = {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
            // recompute through the same fn is circular; assert structural shape
            let _ = now;
            let days = 1767225600i64.div_euclid(86_400);
            let sod = 1767225600i64.rem_euclid(86_400);
            let (y, m, d) = civil_from_days(days);
            (
                format!(
                    "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
                    sod / 3600,
                    (sod % 3600) / 60,
                    sod % 60
                ),
                0u128,
            )
        };
        assert_eq!(iso, "2026-01-01T00:00:00Z");
    }

    #[test]
    fn civil_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1)); // 2024-01-01
        assert_eq!(civil_from_days(20_651), (2026, 7, 17)); // 2026-01-01 is day 20454; +197d
    }

    #[test]
    fn replay_writes_events() {
        let dir = std::env::temp_dir().join("banchor-replay-test");
        let _ = std::fs::remove_dir_all(&dir);
        let mut r = Replay::open(&dir, "unit").unwrap();
        r.ev("session_start", json!({"chrome": "test"}));
        r.ev(
            "click",
            json!({"ref": "@e1", "name": un("More information...")}),
        );
        r.close();
        let text = fs::read_to_string(&r.path).unwrap();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(text.contains("\"ev\":\"session_start\""));
        assert!(text.contains("\"__untrusted\":true"));
        assert!(text.contains("\"t\":\"20"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
