//! SYSTEM CHROMIUM LAUNCHER — drive the browser the machine already has.
//!
//! The lane is explicit: "drive a SYSTEM Chromium." Not a vendored binary,
//! not a playwright-managed cache — the installed browser, discovered in
//! order (env override → Chrome → Chromium → Edge, which IS a Chromium).
//! The binary actually used is recorded in every replay, so the receipt
//! always says whose wheels the anchor drove on.
//!
//! Launch shape: --remote-debugging-port=0 (kernel picks a free port; we
//! parse "DevTools listening on ws://127.0.0.1:<port>/…" from stderr),
//! a THROWAWAY user-data-dir (the anchor never touches the human's profile),
//! headless=new for the walking skeleton. Kill on drop; profile erased.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::cdp;

#[derive(Debug, thiserror::Error)]
pub enum BrowserError {
    #[error("no system chromium found — set BHEARTWALLET_CHROME to a Chromium binary")]
    NotFound,
    #[error("chromium exited before speaking devtools: {0}")]
    EarlyExit(String),
    #[error("timed out waiting for the devtools port")]
    Timeout,
    #[error(transparent)]
    Cdp(#[from] cdp::CdpError),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

fn candidate_paths() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Ok(p) = std::env::var("BHEARTWALLET_CHROME") {
        v.push(PathBuf::from(p));
    }
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let la = std::env::var("LOCALAPPDATA").unwrap_or_default();
    for (dir, exe) in [
        (&pf, r"Google\Chrome\Application\chrome.exe"),
        (&pf86, r"Google\Chrome\Application\chrome.exe"),
        (&la, r"Google\Chrome\Application\chrome.exe"),
        (&pf86, r"Microsoft\Edge\Application\msedge.exe"),
        (&pf, r"Microsoft\Edge\Application\msedge.exe"),
        (&pf, r"Chromium\Application\chrome.exe"),
        (&pf86, r"Chromium\Application\chrome.exe"),
    ] {
        v.push(PathBuf::from(dir).join(exe));
    }
    v
}

/// Discover the system Chromium. Order: env, then well-known install paths.
pub fn find_chromium() -> Result<PathBuf, BrowserError> {
    for p in candidate_paths() {
        if p.is_file() {
            return Ok(p);
        }
    }
    Err(BrowserError::NotFound)
}

pub struct Browser {
    pub child: Child,
    pub port: u16,
    pub binary: PathBuf,
    pub version: Value,
    profile_dir: PathBuf,
}

impl Browser {
    /// Launch system Chromium headless with an ephemeral profile + CDP port.
    ///
    /// PORT DISCOVERY (the Windows-honest way): we pick a free port OURSELVES
    /// (bind a listener to :0, note the port, drop it) and hand Chrome
    /// `--remote-debugging-port=<port>` explicitly. The textbook
    /// `--remote-debugging-port=0` + parse-the-"DevTools listening on" line
    /// off stderr is UNRELIABLE on Windows headless=new — the line is not
    /// guaranteed to arrive on a piped stderr. We then poll
    /// `GET /json/version` until DevTools answers. The stderr reader stays
    /// alive purely to catch early exits.
    pub fn launch(headless: bool) -> Result<Browser, BrowserError> {
        let binary = find_chromium()?;
        eprintln!("[banchor] system chromium: {}", binary.display());
        let profile_dir = std::env::temp_dir().join(format!(
            "banchor-profile-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.subsec_nanos())
                .unwrap_or(0)
        ));
        let port = pick_free_port().ok_or(BrowserError::Timeout)?;
        let profile_arg = format!("--user-data-dir={}", profile_dir.display());
        let mut args: Vec<String> = vec![
            format!("--remote-debugging-port={port}"),
            profile_arg,
            "--no-first-run".into(),
            "--no-default-browser-check".into(),
            "--disable-extensions".into(),
            "--disable-background-networking".into(),
            "--disable-component-update".into(),
            "--hide-scrollbars".into(),
            "--window-size=1280,900".into(),
            "--remote-allow-origins=*".into(),
        ];
        if headless {
            args.push("--headless=new".into());
        }

        let mut child = Command::new(&binary)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        eprintln!("[banchor] chromium pid {} on 127.0.0.1:{port}", child.id());

        let stderr = child.stderr.take().expect("stderr piped");
        let (tx, rx) = mpsc::channel::<String>();
        std::thread::spawn(move || {
            let r = BufReader::new(stderr);
            for line in r.lines().flatten() {
                if std::env::var("BANCHOR_TRACE").is_ok() {
                    eprintln!("[banchor:chrome] {line}");
                }
                if tx.send(line).is_err() {
                    break;
                }
            }
        });

        // poll /json/version until devtools is up (or the child dies)
        let deadline = Instant::now() + Duration::from_secs(30);
        let mut version: Option<Value> = None;
        while Instant::now() < deadline {
            if let Ok(Some(_)) = child.try_wait() {
                return Err(BrowserError::EarlyExit(line_hint(&rx)));
            }
            match cdp::http_json(port, "GET", "/json/version") {
                Ok(v) => {
                    version = Some(v);
                    break;
                }
                Err(_) => std::thread::sleep(Duration::from_millis(250)),
            }
        }
        let version = version.ok_or(BrowserError::Timeout)?;
        eprintln!("[banchor] devtools live on 127.0.0.1:{port}");
        Ok(Browser { child, port, binary, version, profile_dir })
    }
}

/// Ask the kernel for a free TCP port on loopback (bind :0, read it, drop).
fn pick_free_port() -> Option<u16> {
    std::net::TcpListener::bind(("127.0.0.1", 0)).ok().and_then(|l| l.local_addr().ok()).map(|a| a.port())
}

fn line_hint(rx: &mpsc::Receiver<String>) -> String {
    rx.try_iter().take(3).collect::<Vec<_>>().join(" | ")
}

impl Drop for Browser {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_dir_all(&self.profile_dir);
    }
}
