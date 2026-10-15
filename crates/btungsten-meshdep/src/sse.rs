//! Bounded, fail-closed management SSE observation. No reconnect can prove
//! continuity without a replay contract, so a disconnect invalidates the run.
use super::{now_ms, SseFrame};
use std::io::{BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::SyncSender;
use std::time::{Duration, Instant};

pub const QUEUE_FRAMES: usize = 128;
pub const EVENT_BYTES: usize = 64 * 1024;
const HEADER_BYTES: usize = 16 * 1024;

struct Input<'a> {
    stream: BufReader<TcpStream>,
    stop: &'a AtomicBool,
    deadline: Option<Instant>,
}
impl Input<'_> {
    fn byte(&mut self) -> Result<u8, String> {
        loop {
            if self.stop.load(Ordering::Relaxed) {
                return Err("collector stopped".into());
            }
            if self.deadline.is_some_and(|d| Instant::now() >= d) {
                return Err("SSE header deadline".into());
            }
            let mut b = [0];
            match self.stream.read(&mut b) {
                Ok(1) => return Ok(b[0]),
                Ok(_) => return Err("SSE disconnected; continuity unverified".into()),
                Err(e)
                    if matches!(
                        e.kind(),
                        std::io::ErrorKind::TimedOut
                            | std::io::ErrorKind::WouldBlock
                            | std::io::ErrorKind::Interrupted
                    ) =>
                {
                    ()
                }
                Err(e) => return Err(format!("SSE read: {e}")),
            }
        }
    }
    fn line(&mut self, limit: usize) -> Result<Vec<u8>, String> {
        let mut line = Vec::new();
        loop {
            let b = self.byte()?;
            if line.len() == limit {
                return Err("SSE HTTP line limit".into());
            }
            line.push(b);
            if b == b'\n' {
                return Ok(line);
            }
        }
    }
}

#[derive(Default)]
struct Events {
    line: Vec<u8>,
    data: String,
    has_data: bool,
    previous_cr: bool,
    started: bool,
}
impl Events {
    fn byte(&mut self, b: u8) -> Result<Option<SseFrame>, String> {
        if self.previous_cr {
            self.previous_cr = false;
            if b == b'\n' {
                return Ok(None);
            }
        }
        if b != b'\n' && b != b'\r' {
            if self.line.len() + self.data.len() >= EVENT_BYTES {
                return Err("SSE event/line limit".into());
            }
            self.line.push(b);
            return Ok(None);
        }
        self.previous_cr = b == b'\r';
        let line = std::str::from_utf8(&self.line).map_err(|_| "SSE invalid UTF-8")?;
        let line = if !self.started {
            line.strip_prefix('\u{feff}').unwrap_or(line)
        } else {
            line
        };
        self.started = true;
        let result = if line.is_empty() && self.has_data {
            self.data.pop(); // SSE joins data fields with LF, removing the final LF.
            self.has_data = false;
            Some(SseFrame {
                data: std::mem::take(&mut self.data),
                at_ms: now_ms(),
            })
        } else {
            if let Some(value) = line
                .strip_prefix("data:")
                .or_else(|| (line == "data").then_some(""))
            {
                let value = value.strip_prefix(' ').unwrap_or(value);
                if self.data.len() + value.len() + 1 > EVENT_BYTES {
                    return Err("SSE event limit".into());
                }
                self.data.push_str(value);
                self.data.push('\n');
                self.has_data = true;
            }
            None
        };
        self.line.clear();
        Ok(result)
    }
}

pub fn reader(
    addr: &str,
    token: &str,
    stop: &AtomicBool,
    tx: &SyncSender<SseFrame>,
    ready: &SyncSender<Result<(), String>>,
) -> Result<(), String> {
    let addr: SocketAddr = addr
        .parse()
        .map_err(|_| "SSE requires numeric rig address")?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("SSE connect: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_millis(200)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    if token.contains(['\r', '\n']) {
        return Err("invalid SSE token".into());
    }
    write!(stream, "GET /events HTTP/1.1\r\nHost: {addr}\r\nAuthorization: Bearer {token}\r\nAccept: text/event-stream\r\n\r\n").map_err(|e| e.to_string())?;
    let mut input = Input {
        stream: BufReader::new(stream),
        stop,
        deadline: Some(Instant::now() + Duration::from_secs(10)),
    };
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() == HEADER_BYTES {
            return Err("SSE header limit".into());
        }
        header.push(input.byte()?);
    }
    let header = std::str::from_utf8(&header).map_err(|_| "SSE invalid header UTF-8")?;
    let mut lines = header.split("\r\n");
    let status = lines.next().unwrap_or_default();
    if !status.starts_with("HTTP/1.1 200 ") {
        return Err("SSE requires HTTP/1.1 200".into());
    }
    let mut chunked = false;
    let mut event_stream = false;
    for line in lines.filter(|l| !l.is_empty()) {
        let (key, value) = line.split_once(':').ok_or("SSE malformed header")?;
        let value = value.trim();
        if key.eq_ignore_ascii_case("content-encoding") && !value.eq_ignore_ascii_case("identity") {
            return Err("SSE unsupported content encoding".into());
        }
        if key.eq_ignore_ascii_case("transfer-encoding") {
            if chunked || !value.eq_ignore_ascii_case("chunked") {
                return Err("SSE unsupported transfer encoding".into());
            }
            chunked = true;
        }
        if key.eq_ignore_ascii_case("content-length") {
            return Err("SSE finite content length unsupported".into());
        }
        if key.eq_ignore_ascii_case("content-type") {
            event_stream = value
                .split(';')
                .next()
                .unwrap_or_default()
                .eq_ignore_ascii_case("text/event-stream");
        }
    }
    if !event_stream {
        return Err("SSE content type is not event-stream".into());
    }
    ready
        .send(Ok(()))
        .map_err(|_| "SSE readiness receiver closed")?;
    input.deadline = None;
    let mut events = Events::default();
    loop {
        let size = if chunked {
            let line = input.line(128)?;
            let line = std::str::from_utf8(&line).map_err(|_| "SSE invalid chunk header")?;
            let digits = line
                .strip_suffix("\r\n")
                .ok_or("SSE chunk header missing CRLF")?;
            if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err("SSE invalid chunk size/extensions unsupported".into());
            }
            let n = usize::from_str_radix(digits, 16).map_err(|_| "SSE chunk size overflow")?;
            if n == 0 {
                return Err("SSE ended; continuity unverified".into());
            }
            n
        } else {
            1
        };
        // Chunk size never controls allocation; each byte feeds bounded state.
        for _ in 0..size {
            if let Some(frame) = events.byte(input.byte()?)? {
                tx.try_send(frame)
                    .map_err(|_| "SSE queue full/closed; delivery evidence incomplete")?;
            }
        }
        if chunked && (input.byte()? != b'\r' || input.byte()? != b'\n') {
            return Err("SSE chunk missing CRLF".into());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fragmented_utf8_multiline_and_boundary() {
        let mut e = Events::default();
        let mut frames = Vec::new();
        for b in "data: hé\r\ndata: two\r\n\r\n".bytes() {
            if let Some(f) = e.byte(b).unwrap() {
                frames.push(f.data);
            }
        }
        assert_eq!(frames, ["hé\ntwo"]);
    }
    #[test]
    fn bom_and_cr_only_lines_preserve_data_and_invalid_utf8_fails() {
        let mut e = Events::default();
        let mut frames = Vec::new();
        for b in "\u{feff}data: one\rdata: two\r\r".bytes() {
            if let Some(f) = e.byte(b).unwrap() {
                frames.push(f.data);
            }
        }
        assert_eq!(frames, ["one\ntwo"]);
        let mut e = Events::default();
        e.byte(0xff).unwrap();
        assert!(e.byte(b'\n').is_err());
    }
    #[test]
    fn line_and_multiline_event_are_bounded() {
        let mut e = Events::default();
        for _ in 0..EVENT_BYTES {
            e.byte(b'x').unwrap();
        }
        assert!(e.byte(b'x').is_err());
        let mut e = Events::default();
        let mut failed = false;
        for b in "data: x\n".repeat(EVENT_BYTES).bytes() {
            if e.byte(b).is_err() {
                failed = true;
                break;
            }
        }
        assert!(failed);
    }
}
