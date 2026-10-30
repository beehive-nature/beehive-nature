use crate::{sha256, write_record, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const OUTPUT_LIMIT: usize = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct Receipt {
    pub classification: &'static str,
    pub argv: Vec<String>,
    pub cwd: String,
    pub environment: String,
    pub started_unix_ms: u128,
    pub elapsed_ms: u128,
    pub timeout_seconds: u64,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub output_limited: bool,
    pub stdout_sha256: String,
    pub stderr_sha256: String,
    pub stdout_b64: String,
    pub stderr_b64: String,
    #[serde(skip)]
    pub stdout: Vec<u8>,
    #[serde(skip)]
    pub stderr: Vec<u8>,
}

impl Receipt {
    pub fn stderr_text(&self) -> String {
        String::from_utf8_lossy(&self.stderr).into_owned()
    }
    pub fn successful(&self) -> bool {
        self.exit_code == Some(0) && !self.timed_out && !self.output_limited
    }
}

fn reader<T: Read + Send + 'static>(
    input: T,
    overflow: Arc<AtomicBool>,
) -> thread::JoinHandle<std::io::Result<Vec<u8>>> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        input
            .take((OUTPUT_LIMIT + 1) as u64)
            .read_to_end(&mut bytes)?;
        if bytes.len() > OUTPUT_LIMIT {
            overflow.store(true, Ordering::SeqCst);
        }
        Ok(bytes)
    })
}

pub fn capture(
    mut command: Command,
    output: &Path,
    environment: &str,
    seconds: u64,
) -> Result<Receipt> {
    let argv = std::iter::once(command.get_program())
        .chain(command.get_args())
        .map(|s| s.to_string_lossy().into_owned())
        .collect();
    let cwd = command
        .get_current_dir()
        .ok_or("explicit child cwd required")?
        .display()
        .to_string();
    let started_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let start = Instant::now();
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("start child: {e}"))?;
    let overflow = Arc::new(AtomicBool::new(false));
    let stdout_reader = reader(child.stdout.take().ok_or("child stdout")?, overflow.clone());
    let stderr_reader = reader(child.stderr.take().ok_or("child stderr")?, overflow.clone());
    let mut timed_out = false;
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if start.elapsed() >= Duration::from_secs(seconds) || overflow.load(Ordering::SeqCst) {
            timed_out = start.elapsed() >= Duration::from_secs(seconds);
            let _ = child.kill();
            break child.wait().map_err(|e| e.to_string())?;
        }
        thread::sleep(Duration::from_millis(10));
    };
    let stdout = stdout_reader
        .join()
        .map_err(|_| "stdout thread panicked")?
        .map_err(|e| e.to_string())?;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "stderr thread panicked")?
        .map_err(|e| e.to_string())?;
    let receipt = Receipt {
        classification: "PUBLIC-CONSTANT: offline command and exact public output bytes; no environment values or private runtime files captured",
        argv, cwd, environment: environment.into(), started_unix_ms,
        elapsed_ms: start.elapsed().as_millis(), timeout_seconds: seconds,
        exit_code: status.code(), timed_out, output_limited: overflow.load(Ordering::SeqCst),
        stdout_sha256: sha256(&stdout), stderr_sha256: sha256(&stderr),
        stdout_b64: STANDARD.encode(&stdout), stderr_b64: STANDARD.encode(&stderr), stdout, stderr,
    };
    write_record(output, &receipt)?;
    Ok(receipt)
}
