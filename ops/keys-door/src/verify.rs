//! Rule 2: a signature counts only when TWO independent ML-DSA-65
//! implementations accept it: the fips204 crate in-process (pq.rs) and the
//! frozen bsigner CLI (crates/bsigner, RustCrypto ml-dsa) as a subprocess.
//! If they disagree the record is refused and the disagreement is reported,
//! never resolved in either's favour.
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
//!   keyset `K.json` = `{type:"bheart.keyset/2", kind:"signature",
//!   alg:"ml-dsa-65", key_id:K, verifying_key_b64u}` written here from the
//!   envelope's `vk`. This relies on `load_dsa_public` reading only `type`,
//!   `kind`, `alg` and the public key (keys.rs `read_keyset`), which is how
//!   the frozen build behaves, not a guarantee CONTRACT.md states.

use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde_json::json;

use crate::b64::b64u;
use crate::pq::{self, BheartSig, DetachedSig, Pre, Sig};
use crate::record::{Parsed, Refusal};

const BSIGNER_TIMEOUT: Duration = Duration::from_secs(30);
const BSIGNER_STDOUT_MAX: u64 = 64 * 1024;

#[derive(Debug, Clone)]
pub enum Second {
    Bsigner(PathBuf),
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

/// Both verdicts, for reporting (`keys-door verify`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Outcome {
    pub fips204: bool,
    pub bsigner: Result<bool, String>,
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
            (_, Err(e)) => Err(Refusal::VerifierFailed(e.clone())),
        }
    }
}

static SEQ: AtomicU64 = AtomicU64::new(0);

impl Verifiers {
    /// The real pair. An empty `bsigner_path` is a refusal, never a skip:
    /// two verifiers are mandatory.
    pub fn new(bsigner_path: &str, scratch: &Path) -> Result<Self, String> {
        if bsigner_path.is_empty() {
            return Err(
                "bsigner_path is empty: two ML-DSA-65 verifiers are mandatory (rule 2), refusing to serve"
                    .into(),
            );
        }
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
        Ok(Verifiers {
            second: Second::Bsigner(p),
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

    fn second_ok(&self, sig: &Sig, pre: &Pre, file: &[u8]) -> Result<bool, String> {
        match &self.second {
            Second::Bsigner(path) => match sig {
                Sig::Bpq(d) => run_bpq_verify(path, &self.scratch, d, file, &pre.id),
                Sig::Bheart(b) => run_verify(path, &self.scratch, b, &pre.dsa, file),
            },
            #[cfg(test)]
            Second::Stub(f) => Ok(f(pre, file)),
        }
    }
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
fn run_bsigner(bin: &Path, args: &[OsString]) -> Result<(ExitStatus, serde_json::Value), String> {
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

/// bheart.signature/1: `bsigner verify` against a public-only keyset made
/// from the envelope's `vk` (the precheck already tied the key id to it).
fn run_verify(
    bin: &Path,
    scratch: &Path,
    sig: &BheartSig,
    vk: &[u8],
    file: &[u8],
) -> Result<bool, String> {
    let key_id = pq::bheart_key_id(vk);
    with_scratch(scratch, |dir| {
        let (sig_path, file_path, keydir) = (
            dir.join("sig.json"),
            dir.join("record.json"),
            dir.join("keys"),
        );
        std::fs::create_dir(&keydir).map_err(|e| e.to_string())?;
        let keyset = json!({
            "type": "bheart.keyset/2",
            "kind": "signature",
            "alg": pq::BHEART_ALG,
            "key_id": key_id,
            "verifying_key_b64u": b64u(vk),
        });
        std::fs::write(keydir.join(format!("{key_id}.json")), keyset.to_string())
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
            serde_json::Value::Bool(b) => b,
            _ => return Err("bsigner verify gave no verified field".into()),
        };
        if verified != status.success() {
            return Err(format!("bsigner verdict and exit status differ ({status})"));
        }
        // a yes about another key id is a no, as bpq-verify's id is above
        Ok(verified && v["key_id"] == key_id.as_str())
    })
}
