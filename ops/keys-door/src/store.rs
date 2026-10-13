//! What the edge keeps on disk, under state_dir:
//!
//! - `floor`: the monotonic floor (rule 4), one decimal line. Its own file,
//!   outside the serve state: discarding a corrupt serve state never lowers
//!   it, and it only ever rises.
//! - `serve.json`: the serve state, `{"chain":[<b64u envelope>…],"pack":"<b64u
//!   SHA3-256>","v":1}`, every accepted envelope from genesis to the served
//!   record. Written tmp + rename: this rename IS the atomic swap (rule 6).
//! - `packs/<b64u SHA3-256>`: the served pack, content-addressed, written
//!   before serve.json names it.
//! - `evidence/<b64u SHA3-256>`: the envelopes of every valid record seen at
//!   a fork and after one (rule 5), content-addressed, at most
//!   [`MAX_EVIDENCE`]. Kept while its seq is at or above the floor: a fork
//!   stays known after the sources that showed it go quiet, and across a
//!   restart. The door drops an envelope once the floor passes its seq
//!   (nothing below the floor is accepted again, rule 4). Like the floor,
//!   it is never read as absent when it is there and unreadable.
//!
//! Nothing here is trusted on load: the envelopes go back through the same
//! parse, two verifiers and chain walk as any other source, and the pack
//! through the same hash checks (rule 7).

use std::fs;
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

use crate::b64::{b64u, unb64u, unb64u32};
use crate::pq::sha3;
use crate::record::{MAX_ENVELOPE, MAX_PACK, MAX_SAFE};

const FLOOR: &str = "floor";
const SERVE: &str = "serve.json";
const PACKS: &str = "packs";
const EVIDENCE: &str = "evidence";
/// serve.json holds base64url envelopes of at most 64 KiB each
const SERVE_MAX: u64 = 256 * 1024 * 1024;
/// evidence envelopes kept at most; only signers a record authorizes can
/// make a fork, so a full store means they made dozens
pub const MAX_EVIDENCE: usize = 64;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ServeFile {
    chain: Vec<String>,
    pack: String,
    v: u64,
}

pub struct Persisted {
    pub chain: Vec<Vec<u8>>,
    pub pack: Vec<u8>,
    pub pack_sha3: [u8; 32],
}

pub struct Store {
    dir: PathBuf,
}

static TMP: AtomicU64 = AtomicU64::new(0);

fn read_capped(path: &Path, cap: u64) -> std::io::Result<Vec<u8>> {
    let mut out = Vec::new();
    fs::File::open(path)?.take(cap + 1).read_to_end(&mut out)?;
    if out.len() as u64 > cap {
        return Err(std::io::Error::other(format!(
            "{} is larger than {cap} bytes",
            path.display()
        )));
    }
    Ok(out)
}

impl Store {
    pub fn new(dir: &Path) -> Self {
        Store {
            dir: dir.to_path_buf(),
        }
    }

    fn write_atomic(&self, path: &Path, bytes: &[u8]) -> std::io::Result<()> {
        let dir = path.parent().unwrap_or(&self.dir);
        fs::create_dir_all(dir)?;
        let tmp = dir.join(format!(
            ".tmp-{}-{}",
            std::process::id(),
            TMP.fetch_add(1, Ordering::Relaxed)
        ));
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)?;
        let r = f.write_all(bytes).and_then(|_| f.sync_all());
        drop(f);
        if let Err(e) = r.and_then(|_| fs::rename(&tmp, path)) {
            let _ = fs::remove_file(&tmp);
            return Err(e);
        }
        #[cfg(unix)]
        fs::File::open(dir)?.sync_all()?;
        Ok(())
    }

    /// The persisted floor: 0 when no floor file exists; an error when one
    /// exists and is not a plain decimal line (never read as 0).
    pub fn floor(&self) -> Result<u64, String> {
        let path = self.dir.join(FLOOR);
        let bytes = match read_capped(&path, 64) {
            Ok(b) => b,
            Err(e) if e.kind() == ErrorKind::NotFound => return Ok(0),
            Err(e) => return Err(format!("floor file {}: {e}", path.display())),
        };
        let text = bytes
            .strip_suffix(b"\n")
            .filter(|t| {
                !t.is_empty() && t.iter().all(u8::is_ascii_digit) && (t.len() == 1 || t[0] != b'0')
            })
            .ok_or_else(|| format!("floor file {} is corrupt", path.display()))?;
        std::str::from_utf8(text)
            .ok()
            .and_then(|t| t.parse::<u64>().ok())
            .filter(|n| *n <= MAX_SAFE)
            .ok_or_else(|| format!("floor file {} is corrupt", path.display()))
    }

    /// Raise the floor to `seq`; a lower or equal seq leaves it unchanged.
    pub fn raise_floor(&self, seq: u64) -> Result<u64, String> {
        let cur = self.floor()?;
        if seq <= cur {
            return Ok(cur);
        }
        self.write_atomic(&self.dir.join(FLOOR), format!("{seq}\n").as_bytes())
            .map_err(|e| format!("floor: {e}"))?;
        Ok(seq)
    }

    /// The kept evidence envelopes: none when the directory does not exist;
    /// an error when it exists and anything in it cannot be read, is not a
    /// regular file, is too large or too many, or does not hash to its name
    /// (never read as no evidence). An interrupted write's tmp file is
    /// skipped.
    pub fn evidence(&self) -> Result<Vec<Vec<u8>>, String> {
        let dir = self.dir.join(EVIDENCE);
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(format!("evidence {}: {e}", dir.display())),
        };
        let mut out = Vec::new();
        for entry in rd {
            let path = entry
                .map_err(|e| format!("evidence {}: {e}", dir.display()))?
                .path();
            let corrupt = || format!("evidence file {} is corrupt", path.display());
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(corrupt)?;
            if name.starts_with(".tmp-") {
                continue;
            }
            let digest = unb64u32(name).ok_or_else(corrupt)?;
            if !fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_file()) {
                return Err(corrupt());
            }
            let bytes = read_capped(&path, MAX_ENVELOPE as u64)
                .map_err(|e| format!("evidence file {}: {e}", path.display()))?;
            if sha3(&[&bytes]) != digest {
                return Err(corrupt());
            }
            out.push(bytes);
            if out.len() > MAX_EVIDENCE {
                return Err(format!(
                    "evidence {} holds more than {MAX_EVIDENCE} envelopes",
                    dir.display()
                ));
            }
        }
        out.sort();
        Ok(out)
    }

    /// Keep one evidence envelope; keeping it again changes nothing.
    pub fn keep_evidence(&self, envelope: &[u8]) -> Result<(), String> {
        let path = self.dir.join(EVIDENCE).join(b64u(&sha3(&[envelope])));
        if path.exists() {
            return Ok(());
        }
        self.write_atomic(&path, envelope)
            .map_err(|e| format!("keep evidence: {e}"))
    }

    /// Drop one evidence envelope; one that is not there is already dropped.
    pub fn drop_evidence(&self, envelope: &[u8]) -> Result<(), String> {
        let path = self.dir.join(EVIDENCE).join(b64u(&sha3(&[envelope])));
        match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("drop evidence {}: {e}", path.display())),
        }
    }

    /// The serve state, or None when there is none. An error means it
    /// exists and cannot be read as a serve state (rule 7: discard).
    pub fn load(&self) -> Result<Option<Persisted>, String> {
        let bytes = match read_capped(&self.dir.join(SERVE), SERVE_MAX) {
            Ok(b) => b,
            Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(format!("serve state: {e}")),
        };
        let f: ServeFile =
            serde_json::from_slice(&bytes).map_err(|e| format!("serve state: {e}"))?;
        if f.v != 1 || f.chain.is_empty() {
            return Err("serve state: unknown version or empty chain".into());
        }
        let chain = f
            .chain
            .iter()
            .map(|e| unb64u(e).filter(|b| b.len() <= MAX_ENVELOPE))
            .collect::<Option<Vec<_>>>()
            .ok_or("serve state: an envelope is not base64url or is too large")?;
        let pack_sha3 = unb64u32(&f.pack).ok_or("serve state: pack is not a digest")?;
        let pack = read_capped(&self.dir.join(PACKS).join(&f.pack), MAX_PACK)
            .map_err(|e| format!("serve state pack: {e}"))?;
        if sha3(&[&pack]) != pack_sha3 {
            return Err("serve state: the pack file does not match its name".into());
        }
        Ok(Some(Persisted {
            chain,
            pack,
            pack_sha3,
        }))
    }

    /// Persist a release: the pack first, then serve.json (the swap), then
    /// drop every other pack.
    pub fn commit(&self, chain: &[&[u8]], pack: &[u8]) -> Result<(), String> {
        let name = b64u(&sha3(&[pack]));
        let packs = self.dir.join(PACKS);
        self.write_atomic(&packs.join(&name), pack)
            .map_err(|e| format!("write pack: {e}"))?;
        let f = ServeFile {
            chain: chain.iter().map(|e| b64u(e)).collect(),
            pack: name.clone(),
            v: 1,
        };
        let json = serde_json::to_vec(&f).map_err(|e| e.to_string())?;
        self.write_atomic(&self.dir.join(SERVE), &json)
            .map_err(|e| format!("write serve state: {e}"))?;
        if let Ok(rd) = fs::read_dir(&packs) {
            for e in rd.flatten() {
                if e.file_name().to_str() != Some(name.as_str()) {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
        Ok(())
    }
}
