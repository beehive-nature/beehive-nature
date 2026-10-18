//! Rule 2: a signature counts only when TWO independent ML-DSA-65
//! implementations accept it: the fips204 crate in-process (pq.rs) and the
//! bsigner CLI (crates/bsigner, RustCrypto ml-dsa) as a subprocess. If they
//! disagree the record is refused and the disagreement is reported, never
//! resolved in either's favour.
//!
//! The bsigner binary is PINNED: edge.toml `bsigner_sha256` is the base64url
//! SHA-256 of the exact build this edge runs. The file at `bsigner_path` is
//! hashed at startup (a mismatch refuses to start) and again before every
//! spawn, and at every poll (a binary swapped under a running edge refuses
//! every new release, named `bsigner_pin_mismatch`). The pin is
//! version-specific compatibility, measured by the compatibility tests in
//! tests.rs against that build; it is not a guarantee that bsigner's
//! interface stays frozen. A new bsigner means running those tests against
//! it and pinning it anew. Residual: the file is hashed, then executed by
//! path, so a swap inside that window is not caught.
//!
//! bsigner's contract (crates/bsigner/CONTRACT.md, src/main.rs), per profile:
//!
//! - SPEC-BPQ-1 §3b: `bsigner bpq-verify --file SIG --target FILE` prints
//!   one JSON line `{"kind":"detached","id":…,"verified":true|false,…}` and
//!   exits 0 when verified, 1 otherwise (also 1, with no JSON on stdout,
//!   when it cannot read its inputs). It does not check pins, so the caller
//!   checks kind == "detached" and the id, as
//!   scripts/verify-law-signatures-rust.sh does.
//! - bheart.signature/1: `bsigner verify --key-id K --file FILE --envelope
//!   SIG --keydir DIR` (`cmd_verify`) prints `{"verified":true,"key_id":K,…}`
//!   and exits 0, or `{"verified":false,"reason":…}` and exits 1 (1 with no
//!   JSON when it cannot read its inputs). DIR holds only a PUBLIC-ONLY
//!   keyset `K.json` with exactly `{type:"bheart.keyset/2", kind:"signature",
//!   alg:"ml-dsa-65", key_id:K, verifying_key_b64u}`, written here from the
//!   envelope's `vk` by [`public_keyset`], which refuses any other field or
//!   value. This relies on how the pinned build reads a keyset (keys.rs
//!   `read_keyset` checks `type` and `kind`, `load_dsa_public` then reads
//!   `alg` and the public key), which CONTRACT.md does not promise. The
//!   compatibility tests also record what that build does NOT check: it
//!   accepts a keyset carrying sealed or other extra fields, and one whose
//!   `alg` names another algorithm (verify dispatches on the envelope's alg).
//!   So the writer, not bsigner, is what keeps a keyset exact.

use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::b64::{b64u, unb64u, unb64u32};
use crate::pq::{self, BheartSig, DetachedSig, Pre, Sig};
use crate::record::{Parsed, Refusal};

const BSIGNER_TIMEOUT: Duration = Duration::from_secs(30);
const BSIGNER_STDOUT_MAX: u64 = 64 * 1024;
/// The exact field set of a public-only keyset, and nothing else.
pub const KEYSET_FIELDS: [&str; 5] = ["alg", "key_id", "kind", "type", "verifying_key_b64u"];

#[derive(Debug, Clone)]
pub enum Second {
    /// the bsigner binary and the SHA-256 it must hash to
    Bsigner(PathBuf, [u8; 32]),
    /// Test-only stand-in for the second verifier. It does not exist in any
    /// non-test build, so no config can select it.
    #[cfg(test)]
    Stub(fn(&Pre, &[u8]) -> bool),
}

#[derive(Debug, Clone)]
pub struct Verifiers {
    second: Second,
    scratch: PathBuf,
}

/// Why the second verifier gave no verdict.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecondError {
    /// the file at bsigner_path is not the pinned build
    PinMismatch(String),
    /// spawn, timeout, output, or verdict and exit status that disagree
    Failed(String),
}

impl std::fmt::Display for SecondError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SecondError::PinMismatch(m) | SecondError::Failed(m) => f.write_str(m),
        }
    }
}

impl From<String> for SecondError {
    fn from(m: String) -> Self {
        SecondError::Failed(m)
    }
}

/// Both verdicts, for reporting (`keys-door verify`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Outcome {
    pub fips204: bool,
    pub bsigner: Result<bool, SecondError>,
}

impl Outcome {
    pub fn decide(&self, id: &str) -> Result<String, Refusal> {
        match (self.fips204, &self.bsigner) {
            (true, Ok(true)) => Ok(id.to_string()),
            (false, Ok(false)) => Err(Refusal::BadSignature),
            (a, Ok(b)) => Err(Refusal::Disagreement {
                fips204: a,
                bsigner: *b,
            }),
            (_, Err(SecondError::PinMismatch(m))) => Err(Refusal::BsignerPin(m.clone())),
            (_, Err(SecondError::Failed(m))) => Err(Refusal::VerifierFailed(m.clone())),
        }
    }
}

static SEQ: AtomicU64 = AtomicU64::new(0);

/// SHA-256 of a file, streamed.
pub fn file_sha256(path: &Path) -> Result<[u8; 32], String> {
    let mut f = std::fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = f
            .read(&mut buf)
            .map_err(|e| format!("{}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().into())
}

/// The pin check: the file at `path` hashes to `pin`, or the named refusal's text.
fn check_pin(path: &Path, pin: &[u8; 32]) -> Result<(), SecondError> {
    let got = file_sha256(path).map_err(SecondError::PinMismatch)?;
    if &got != pin {
        return Err(SecondError::PinMismatch(format!(
            "{} hashes to SHA-256 {}, but edge.toml bsigner_sha256 pins {}",
            path.display(),
            b64u(&got),
            b64u(pin)
        )));
    }
    Ok(())
}

impl Verifiers {
    /// The real pair. An empty `bsigner_path` is a refusal, never a skip:
    /// two verifiers are mandatory. The binary must hash to `bsigner_sha256`.
    pub fn new(bsigner_path: &str, bsigner_sha256: &str, scratch: &Path) -> Result<Self, String> {
        if bsigner_path.is_empty() {
            return Err(
                "bsigner_path is empty: two ML-DSA-65 verifiers are mandatory (rule 2), refusing to serve"
                    .into(),
            );
        }
        let pin = unb64u32(bsigner_sha256).ok_or(
            "bsigner_sha256 must be the base64url SHA-256 (43 characters) of the bsigner binary at bsigner_path, refusing to serve",
        )?;
        let p = PathBuf::from(bsigner_path);
        let meta =
            std::fs::metadata(&p).map_err(|e| format!("bsigner_path {bsigner_path}: {e}"))?;
        if !meta.is_file() {
            return Err(format!("bsigner_path {bsigner_path} is not a file"));
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if meta.permissions().mode() & 0o111 == 0 {
                return Err(format!("bsigner_path {bsigner_path} is not executable"));
            }
        }
        check_pin(&p, &pin).map_err(|e| format!("bsigner_pin_mismatch: {e}; refusing to serve"))?;
        Ok(Verifiers {
            second: Second::Bsigner(p, pin),
            scratch: scratch.to_path_buf(),
        })
    }

    #[cfg(test)]
    pub fn with_second(second: Second, scratch: &Path) -> Self {
        Verifiers {
            second,
            scratch: scratch.to_path_buf(),
        }
    }

    /// The pin, checked now (the door calls this at every poll).
    pub fn pin_ok(&self) -> Result<(), String> {
        match &self.second {
            Second::Bsigner(path, pin) => {
                check_pin(path, pin).map_err(|e| format!("bsigner_pin_mismatch: {e}"))
            }
            #[cfg(test)]
            Second::Stub(_) => Ok(()),
        }
    }

    /// Run both verifiers on one prechecked envelope.
    pub fn outcome(&self, p: &Parsed) -> Outcome {
        Outcome {
            fips204: pq::fips204_ok(&p.pre),
            bsigner: self.second_ok(&p.env.sig, &p.pre, &p.record_bytes),
        }
    }

    /// The signer id when both accept; otherwise the named refusal.
    pub fn verify(&self, p: &Parsed) -> Result<String, Refusal> {
        self.outcome(p).decide(&p.pre.id)
    }

    /// Both verdicts on any §3b detached signature over `file` (not only a
    /// release envelope), after the same precheck.
    pub fn check_detached(&self, sig: &DetachedSig, file: &[u8]) -> Result<Outcome, Refusal> {
        self.check_sig(&Sig::Bpq(sig.clone()), None, file)
    }

    /// Both verdicts on a signature of either profile over `file` (`vk` as
    /// an envelope carries it), after the same precheck.
    pub fn check_sig(&self, sig: &Sig, vk: Option<&str>, file: &[u8]) -> Result<Outcome, Refusal> {
        let pre = pq::precheck_sig(sig, vk, file)?;
        Ok(Outcome {
            fips204: pq::fips204_ok(&pre),
            bsigner: self.second_ok(sig, &pre, file),
        })
    }

    fn second_ok(&self, sig: &Sig, pre: &Pre, file: &[u8]) -> Result<bool, SecondError> {
        match &self.second {
            Second::Bsigner(path, pin) => {
                // the binary can be swapped under a running edge: hashed before every spawn
                check_pin(path, pin)?;
                Ok(match sig {
                    Sig::Bpq(d) => run_bpq_verify(path, &self.scratch, d, file, &pre.id)?,
                    Sig::Bheart(b) => {
                        let ks = public_keyset_for(&pre.dsa);
                        run_verify(path, &self.scratch, &ks, b, file)?
                    }
                })
            }
            #[cfg(test)]
            Second::Stub(f) => Ok(f(pre, file)),
        }
    }
}

/// The public-only keyset for a verifying key, as [`public_keyset`] accepts it.
pub fn public_keyset_for(vk: &[u8]) -> Value {
    json!({
        "type": "bheart.keyset/2",
        "kind": "signature",
        "alg": pq::BHEART_ALG,
        "key_id": pq::bheart_key_id(vk),
        "verifying_key_b64u": b64u(vk),
    })
}

/// The one writer of a public-only keyset: exactly the five public fields,
/// `type` bheart.keyset/2, `kind` signature, `alg` ml-dsa-65, a 1952-byte
/// verifying key and the key id bsigner derives from it. Anything else (a
/// sealed seed, a secret flag, any extra field, another algorithm) is
/// refused here, so such a file is never written and bsigner never reads
/// one. Returns the key id and the file bytes.
pub fn public_keyset(v: &Value) -> Result<(String, Vec<u8>), String> {
    let o = v.as_object().ok_or("a keyset is a JSON object")?;
    let mut keys: Vec<&str> = o.keys().map(String::as_str).collect();
    keys.sort_unstable();
    if keys != KEYSET_FIELDS {
        let extra: Vec<&str> = keys
            .iter()
            .filter(|k| !KEYSET_FIELDS.contains(k))
            .copied()
            .collect();
        return Err(format!(
            "a public-only keyset carries exactly {KEYSET_FIELDS:?}; refusing one with {keys:?} (not public-only: {extra:?})"
        ));
    }
    let s = |k: &str| o[k].as_str().unwrap_or_default();
    if s("type") != "bheart.keyset/2" || s("kind") != "signature" || s("alg") != pq::BHEART_ALG {
        return Err(
            "a public-only keyset is type bheart.keyset/2, kind signature, alg ml-dsa-65".into(),
        );
    }
    let vk = unb64u(s("verifying_key_b64u"))
        .filter(|k| k.len() == pq::DSA_PK_LEN)
        .ok_or("verifying_key_b64u is not a 1952-byte ML-DSA-65 key in base64url")?;
    let key_id = pq::bheart_key_id(&vk);
    if s("key_id") != key_id {
        return Err("key_id is not the bsigner key id of verifying_key_b64u".into());
    }
    let bytes = serde_json::to_vec(v).map_err(|e| e.to_string())?;
    Ok((key_id, bytes))
}

/// A fresh scratch directory for one subprocess run, removed after it.
fn with_scratch<T>(
    scratch: &Path,
    f: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let dir = scratch.join(format!(
        "keys-door-verify-{}-{}",
        std::process::id(),
        SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir(&dir).map_err(|e| format!("scratch {}: {e}", dir.display()))?;
    let out = f(&dir);
    let _ = std::fs::remove_dir_all(&dir);
    out
}

/// Run bsigner with `args`, bounded in time and output, and read its one
/// JSON verdict. No JSON on stdout is an error, never a verdict.
fn run_bsigner(bin: &Path, args: &[OsString]) -> Result<(ExitStatus, Value), String> {
    let mut child = Command::new(bin)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn {}: {e}", bin.display()))?;
    let deadline = Instant::now() + BSIGNER_TIMEOUT;
    let status = loop {
        if let Some(s) = child.try_wait().map_err(|e| e.to_string())? {
            break s;
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("bsigner timed out".to_string());
        }
        std::thread::sleep(Duration::from_millis(5));
    };
    let mut stdout = Vec::new();
    if let Some(o) = child.stdout.take() {
        o.take(BSIGNER_STDOUT_MAX)
            .read_to_end(&mut stdout)
            .map_err(|e| e.to_string())?;
    }
    let v = serde_json::from_slice(&stdout)
        .map_err(|_| format!("bsigner gave no verdict (exit {status})"))?;
    Ok((status, v))
}

/// §3b: `bsigner bpq-verify`.
fn run_bpq_verify(
    bin: &Path,
    scratch: &Path,
    sig: &DetachedSig,
    file: &[u8],
    id: &str,
) -> Result<bool, String> {
    with_scratch(scratch, |dir| {
        let (sig_path, file_path) = (dir.join("sig.json"), dir.join("record.json"));
        // the signature object exactly as the in-process verifier read it
        std::fs::write(
            &sig_path,
            serde_json::to_vec(sig).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        std::fs::write(&file_path, file).map_err(|e| e.to_string())?;
        let (status, v) = run_bsigner(
            bin,
            &[
                "bpq-verify".into(),
                "--file".into(),
                sig_path.into(),
                "--target".into(),
                file_path.into(),
            ],
        )?;
        let verified = v["verified"] == true;
        if v["kind"] != "detached" {
            return Err("bsigner did not read a detached signature".into());
        }
        if verified != status.success() {
            return Err(format!("bsigner verdict and exit status differ ({status})"));
        }
        Ok(verified && v["id"] == id)
    })
}

/// bheart.signature/1: `bsigner verify` against `keyset`, which must pass
/// [`public_keyset`] before anything is written or spawned. The precheck
/// already tied the signature's key id to the envelope's `vk`; the key id
/// here is derived from the keyset's key, never taken from the signature.
pub(crate) fn run_verify(
    bin: &Path,
    scratch: &Path,
    keyset: &Value,
    sig: &BheartSig,
    file: &[u8],
) -> Result<bool, String> {
    let (key_id, keyset_bytes) = public_keyset(keyset)?;
    with_scratch(scratch, |dir| {
        let (sig_path, file_path, keydir) = (
            dir.join("sig.json"),
            dir.join("record.json"),
            dir.join("keys"),
        );
        std::fs::create_dir(&keydir).map_err(|e| e.to_string())?;
        std::fs::write(keydir.join(format!("{key_id}.json")), keyset_bytes)
            .map_err(|e| e.to_string())?;
        std::fs::write(
            &sig_path,
            serde_json::to_vec(sig).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        std::fs::write(&file_path, file).map_err(|e| e.to_string())?;
        let (status, v) = run_bsigner(
            bin,
            &[
                "verify".into(),
                "--key-id".into(),
                key_id.clone().into(),
                "--file".into(),
                file_path.into(),
                "--envelope".into(),
                sig_path.into(),
                "--keydir".into(),
                keydir.into(),
            ],
        )?;
        let verified = match v["verified"] {
            Value::Bool(b) => b,
            _ => return Err("bsigner verify gave no verified field".into()),
        };
        if verified != status.success() {
            return Err(format!("bsigner verdict and exit status differ ({status})"));
        }
        // a yes about another key id is a no, as bpq-verify's id is above
        Ok(verified && v["key_id"] == key_id.as_str())
    })
}
