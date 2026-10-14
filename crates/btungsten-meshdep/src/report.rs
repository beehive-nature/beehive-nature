//! Receipts: raw JSONL (durable, outside temp dirs) plus the sanitized
//! summaries that may be committed in-tree.
//!
//! Sanitization law: committed summaries never contain a 64-hex peer
//! identity. The sanitizer replaces any hex run of 48+ characters with a
//! short digest reference; a unit test convicts an unsanitized line.

use serde::Serialize;

pub struct Receipts {
    pub dir: std::path::PathBuf,
}

impl Receipts {
    pub fn open(dir: &std::path::Path) -> Result<Self, String> {
        std::fs::create_dir_all(dir).map_err(|e| format!("receipts dir: {e}"))?;
        Ok(Receipts {
            dir: dir.to_path_buf(),
        })
    }

    pub fn append_jsonl<T: Serialize>(&self, name: &str, row: &T) -> Result<(), String> {
        use std::io::Write;
        let line = serde_json::to_string(row).map_err(|e| e.to_string())?;
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.dir.join(name))
            .map_err(|e| format!("open {}: {e}", name))?;
        writeln!(f, "{line}").map_err(|e| e.to_string())
    }

    pub fn write_json<T: Serialize>(&self, name: &str, val: &T) -> Result<(), String> {
        let s = serde_json::to_string_pretty(val).map_err(|e| e.to_string())?;
        std::fs::write(self.dir.join(name), s).map_err(|e| format!("write {name}: {e}"))
    }

    pub fn write_raw(&self, name: &str, s: &str) -> Result<(), String> {
        std::fs::write(self.dir.join(name), s).map_err(|e| format!("write {name}: {e}"))
    }
}

/// Replace any hex run of 48+ chars with a short digest reference. Applied
/// to every value that may reach a committed summary.
#[must_use]
pub fn sanitize(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_hexdigit() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_hexdigit() {
                i += 1;
            }
            let run = &s[start..i];
            if run.len() >= 48 {
                out.push_str(&format!("«hex{}…{}»", run.len(), &run[..6]));
            } else {
                out.push_str(run);
            }
        } else {
            out.push(bytes[i] as char);
            i += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizer_convicts_64_hex_runs_and_keeps_short_ones() {
        // Assembled at runtime from short pieces: the source carries no
        // 48+ hex literal (the estate hex law applies to sources too).
        let peer_id = format!(
            "{}{}{}",
            "1ca00a42",
            "0123456789abcdef".repeat(3),
            "8df66367"
        );
        assert_eq!(peer_id.len(), 64);
        let s = sanitize(&format!("node {} ready", peer_id));
        assert!(
            !s.contains(&peer_id),
            "full hex identity must not survive sanitization"
        );
        assert!(
            s.contains("«hex64…1ca00a»"),
            "short digest reference replaces it: {s}"
        );
        // Short hex stays (digests of op envelopes are 64-hex and get
        // referenced; the raw stays in the raw dir).
        assert_eq!(sanitize("abc123"), "abc123");
    }

    #[test]
    fn op_digests_in_summaries_are_referenced_not_inlined() {
        let digest = "a".repeat(64);
        let s = sanitize(&format!("op {digest} lost"));
        assert_eq!(s, "op «hex64…aaaaaa» lost");
    }
}
