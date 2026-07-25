//! Autonomi rail — via the `ant` network client CLI as a **subprocess**.
//!
//! License gate, stated plainly: the `autonomi` crate is GPL-3.0 and this
//! workspace is AGPL-3.0-only with its own boundaries; per the standing
//! constraint ("network API, NOT linking the GPL-3.0 crate, unless and
//! until D-2 clears that path") this adapter never links Autonomi code.
//! It drives the separately-installed `ant` binary — a process boundary,
//! the same posture `adapter-autonomi` takes toward `antctl` — and the
//! network API that binary speaks.
//!
//! UNVERIFIED (tracked, not hidden — the adapter-autonomi discipline): the
//! exact `--json` output schema of `ant file upload` is not yet confirmed
//! against a live funded run (uploads cost ANT via the wallet configured
//! in `ant` itself; this tool holds no key). Parsing is therefore
//! **fail-closed**: the address is accepted only when the output yields
//! exactly one unambiguous candidate; anything else surfaces the raw
//! output as an error instead of guessing. When a live run lands, pin the
//! real schema here and tighten the parser to it.

use std::io::Write;
use std::process::Command;

use crate::rail::{Rail, RailError};

pub struct AntCli {
    pub bin: String,
}

impl AntCli {
    pub fn new(bin: &str) -> AntCli {
        AntCli {
            bin: bin.to_string(),
        }
    }

    fn run(&self, args: &[&str]) -> Result<(String, String), RailError> {
        let out = Command::new(&self.bin)
            .args(args)
            .output()
            .map_err(|e| RailError::Local(format!("{} {:?}: {e}", self.bin, args)))?;
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        if !out.status.success() {
            return Err(RailError::Rejected {
                status: out.status.code().unwrap_or(-1).unsigned_abs() as u16,
                body: format!(
                    "{} {}: {}",
                    self.bin,
                    args.join(" "),
                    tail(&stderr, 400).trim()
                ),
            });
        }
        Ok((stdout, stderr))
    }
}

fn tail(s: &str, n: usize) -> &str {
    let start = s.len().saturating_sub(n);
    // Snap to a char boundary.
    let mut start = start;
    while start < s.len() && !s.is_char_boundary(start) {
        start += 1;
    }
    &s[start..]
}

/// Extract the single plausible content address from `ant` output:
/// hex tokens of 64+ chars. Exactly one distinct candidate or refusal —
/// never a guess.
fn extract_address(stdout: &str) -> Result<String, RailError> {
    let mut candidates: Vec<String> = Vec::new();
    for token in stdout.split(|c: char| !c.is_ascii_hexdigit()) {
        if token.len() >= 64 && !candidates.iter().any(|c| c == token) {
            candidates.push(token.to_string());
        }
    }
    match candidates.len() {
        1 => Ok(candidates.remove(0)),
        0 => Err(RailError::Unparseable(format!(
            "no content address in ant output: {}",
            tail(stdout, 400).trim()
        ))),
        _ => Err(RailError::Unparseable(format!(
            "ambiguous addresses {candidates:?} in ant output — refusing to guess"
        ))),
    }
}

impl Rail for AntCli {
    fn scheme(&self) -> &'static str {
        "ant"
    }

    fn put(&mut self, bytes: &[u8], _tags: &[(String, String)]) -> Result<String, RailError> {
        let dir = std::env::temp_dir().join(format!("atmirror-{}", std::process::id()));
        std::fs::create_dir_all(&dir).map_err(|e| RailError::Local(e.to_string()))?;
        let path = dir.join(format!("put-{}.bin", bytes.len()));
        {
            let mut f =
                std::fs::File::create(&path).map_err(|e| RailError::Local(e.to_string()))?;
            f.write_all(bytes)
                .map_err(|e| RailError::Local(e.to_string()))?;
        }
        let path_s = path.to_string_lossy().into_owned();
        let result = self.run(&["--json", "file", "upload", &path_s]);
        let _ = std::fs::remove_file(&path);
        let (stdout, _stderr) = result?;
        extract_address(&stdout)
    }

    fn get(&self, address: &str) -> Result<Vec<u8>, RailError> {
        let dir = std::env::temp_dir().join(format!("atmirror-{}", std::process::id()));
        std::fs::create_dir_all(&dir).map_err(|e| RailError::Local(e.to_string()))?;
        let dest = dir.join(format!("get-{address}"));
        let dest_s = dest.to_string_lossy().into_owned();
        self.run(&["--json", "file", "download", address, &dest_s])?;
        let bytes = if dest.is_dir() {
            // A single-file download may land as dir/<name>; accept exactly
            // one file, refuse ambiguity.
            let entries: Vec<_> = std::fs::read_dir(&dest)
                .map_err(|e| RailError::Local(e.to_string()))?
                .filter_map(Result::ok)
                .collect();
            if entries.len() != 1 {
                return Err(RailError::Unparseable(format!(
                    "download produced {} entries at {dest_s}",
                    entries.len()
                )));
            }
            std::fs::read(entries[0].path()).map_err(|e| RailError::Local(e.to_string()))?
        } else {
            std::fs::read(&dest).map_err(|e| RailError::Local(e.to_string()))?
        };
        let _ = std::fs::remove_dir_all(&dest);
        let _ = std::fs::remove_file(&dest);
        Ok(bytes)
    }

    fn probe(&self, _address: &str) -> Result<bool, RailError> {
        // No cheap existence check in the v0.3.1 CLI surface (chunk get is
        // a full download). Callers fall back to trusting local state.
        Err(RailError::Unsupported("existence probe"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_extraction_is_fail_closed() {
        let a = "c".repeat(64);
        let b = "d".repeat(64);
        assert_eq!(
            extract_address(&format!("Uploaded: {a}\n")).unwrap(),
            a.clone()
        );
        // Repeated same address is still unambiguous.
        assert_eq!(
            extract_address(&format!("{{\"address\":\"{a}\",\"again\":\"{a}\"}}")).unwrap(),
            a
        );
        assert!(matches!(
            extract_address("done, no address here"),
            Err(RailError::Unparseable(_))
        ));
        assert!(matches!(
            extract_address(&format!("{a} then {b}")),
            Err(RailError::Unparseable(_))
        ));
    }
}
