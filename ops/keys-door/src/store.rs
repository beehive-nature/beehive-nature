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
/// serve.json holds base64url envelopes of at most 64 KiB each
const SERVE_MAX: u64 = 256 * 1024 * 1024;

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
