//! Bounded management-plane responses. These limits constrain the observer,
//! not x0x gossip, signing, authorization, or the transport's delivery policy.

use std::io::{ErrorKind, Read};
use std::net::TcpStream;
use std::time::{Duration, Instant};

const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;

pub(super) fn read_response(
    stream: &mut TcpStream,
    budget: Duration,
) -> Result<(u16, String), String> {
    let deadline = Instant::now() + budget;
    read_bounded(|buf| {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(std::io::Error::new(
                ErrorKind::TimedOut,
                "response deadline",
            ));
        }
        stream.set_read_timeout(Some(remaining))?;
        stream.read(buf)
    })
}

fn read_bounded(
    mut read: impl FnMut(&mut [u8]) -> std::io::Result<usize>,
) -> Result<(u16, String), String> {
    let mut raw = Vec::new();
    let mut buf = [0u8; 8192];
    let mut header = None;
    loop {
        // Read at most one byte beyond the cap, without allocating it in raw.
        let mut allowance = buf.len().min(MAX_RESPONSE_BYTES - raw.len() + 1);
        if header.is_none() {
            allowance = allowance.min(MAX_HEADER_BYTES - raw.len());
        }
        let n = match read(&mut buf[..allowance]) {
            Ok(n) => n,
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("HTTP response read: {e}")),
        };
        if n == 0 {
            break;
        }
        if n > MAX_RESPONSE_BYTES - raw.len() {
            return Err("HTTP response exceeds 8388608-byte encoded limit".into());
        }
        raw.extend_from_slice(&buf[..n]);
        if header.is_none() {
            if let Some(p) = find(&raw, b"\r\n\r\n") {
                if p + 4 > MAX_HEADER_BYTES {
                    return Err("HTTP headers exceed 16384-byte limit".into());
                }
                let parsed = parse_header(&raw[..p])?;
                if parsed
                    .length
                    .is_some_and(|n| n > MAX_RESPONSE_BYTES - (p + 4))
                {
                    return Err("HTTP Content-Length exceeds response limit".into());
                }
                header = Some((p + 4, parsed));
            } else if raw.len() >= MAX_HEADER_BYTES {
                return Err("HTTP headers exceed 16384-byte limit".into());
            }
        }
    }
    let (offset, header) = header.ok_or("no HTTP header terminator")?;
    let body = &raw[offset..];
    let decoded;
    let body = if header.chunked {
        decoded = dechunk(body)?;
        decoded.as_slice()
    } else {
        if header.length.is_some_and(|n| n != body.len()) {
            return Err("HTTP Content-Length mismatch (truncated or trailing bytes)".into());
        }
        body
    };
    let text = std::str::from_utf8(body).map_err(|_| "HTTP body is not UTF-8")?;
    Ok((header.status, text.to_string()))
}

struct Header {
    status: u16,
    length: Option<usize>,
    chunked: bool,
}

fn parse_header(raw: &[u8]) -> Result<Header, String> {
    let text = std::str::from_utf8(raw).map_err(|_| "HTTP headers are not UTF-8")?;
    let mut lines = text.split("\r\n");
    let mut status = lines
        .next()
        .ok_or("empty HTTP response")?
        .split_whitespace();
    if !matches!(status.next(), Some("HTTP/1.1" | "HTTP/1.0")) {
        return Err("unsupported HTTP response version".into());
    }
    let status = status.next().ok_or("missing HTTP status")?;
    if status.len() != 3 || !status.bytes().all(|b| b.is_ascii_digit()) {
        return Err("invalid HTTP status".into());
    }
    let status = status.parse::<u16>().map_err(|_| "invalid HTTP status")?;
    if !(200..=599).contains(&status) {
        return Err("unsupported HTTP status (expected final response)".into());
    }
    let mut length = None;
    let mut chunked = false;
    for line in lines {
        let (name, value) = line.split_once(':').ok_or("malformed HTTP header")?;
        if name.is_empty()
            || !name
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&b))
        {
            return Err("invalid HTTP header name".into());
        }
        let value = value.trim();
        if name.eq_ignore_ascii_case("content-length") {
            if length.is_some() || value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
                return Err("invalid or duplicate HTTP Content-Length".into());
            }
            length = Some(
                value
                    .parse::<usize>()
                    .map_err(|_| "invalid HTTP Content-Length")?,
            );
        } else if name.eq_ignore_ascii_case("transfer-encoding") {
            if chunked || !value.eq_ignore_ascii_case("chunked") {
                return Err("unsupported or duplicate HTTP Transfer-Encoding".into());
            }
            chunked = true;
        }
    }
    if chunked && length.is_some() {
        return Err("ambiguous HTTP response framing".into());
    }
    Ok(Header {
        status,
        length,
        chunked,
    })
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn dechunk(mut body: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let nl = find(body, b"\r\n").ok_or("bad HTTP chunk header")?;
        let line = std::str::from_utf8(&body[..nl]).map_err(|_| "invalid HTTP chunk header")?;
        let size = line.split(';').next().unwrap_or("");
        if size.is_empty() || !size.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("invalid HTTP chunk size".into());
        }
        let size = usize::from_str_radix(size, 16).map_err(|_| "HTTP chunk size overflow")?;
        body = &body[nl + 2..];
        if size == 0 {
            // The daemon API emits no trailers. Refuse unsupported metadata
            // rather than silently interpreting a partial response as evidence.
            return if body == b"\r\n" {
                Ok(out)
            } else {
                Err("missing HTTP chunk terminator or unsupported trailers".into())
            };
        }
        // Subtraction first: a malicious usize::MAX must never wrap an index.
        if size > body.len().saturating_sub(2) || body.get(size..size + 2) != Some(b"\r\n") {
            return Err("truncated HTTP chunk or missing CRLF".into());
        }
        out.extend_from_slice(&body[..size]);
        body = &body[size + 2..];
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::net::TcpListener;

    fn consume_request(socket: &mut TcpStream) {
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            assert!(request.len() < 1024);
            let mut byte = [0u8; 1];
            socket.read_exact(&mut byte).unwrap();
            request.push(byte[0]);
        }
    }

    fn parse(raw: &[u8], fragment: usize) -> Result<(u16, String), String> {
        let mut cursor = raw;
        read_bounded(|buf| {
            let n = buf.len().min(fragment);
            cursor.read(&mut buf[..n])
        })
    }

    #[test]
    fn fragmented_valid_responses_preserve_exact_bytes_and_error_status() {
        for fragment in [1, 7, 8192] {
            for (raw, expected) in [
                (&b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello"[..], (200, "hello")),
                (b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n3;x=1\r\n fo\r\n0\r\n\r\n", (200, "hello fo")),
                (b"HTTP/1.1 504 timeout\r\nContent-Length: 2\r\n\r\n{}", (504, "{}")),
                (b"HTTP/1.0 200 OK\r\n\r\nclose-delimited", (200, "close-delimited")),
            ] {
                assert_eq!(parse(raw, fragment).unwrap(), (expected.0, expected.1.into()));
            }
        }
    }

    #[test]
    fn incomplete_ambiguous_and_malformed_responses_never_become_evidence() {
        for raw in [
            "HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: 1\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: nope\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: +2\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length : 2\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\n Content-Length: 2\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\n\r\n{}",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n\r\n",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}XX0\r\n\r\n",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\njunk",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nffffffffffffffff\r\nx",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n+2\r\n{}\r\n0\r\n\r\n",
            "HTTP/1.1 200 OK\r\nContent-Length: 999999999999999999999\r\n\r\n",
            "NOTHTTP 200 OK\r\n\r\n{}",
            "HTTP/1.1 100 Continue\r\n\r\n",
            "HTTP/1.1 200 OK\r\ninvalid-header\r\n\r\n",
        ] {
            assert!(parse(raw.as_bytes(), 7).is_err(), "accepted {raw:?}");
        }
        assert!(parse(b"HTTP/1.1 200 OK\r\n\r\n\xff", 1).is_err());
    }

    #[test]
    fn exact_response_limit_passes_and_one_more_byte_is_refused() {
        let head = b"HTTP/1.1 200 OK\r\n\r\n";
        let mut raw = head.to_vec();
        raw.resize(MAX_RESPONSE_BYTES, b'x');
        assert_eq!(
            parse(&raw, 8192).unwrap().1.len(),
            MAX_RESPONSE_BYTES - head.len()
        );
        raw.push(b'x');
        assert!(parse(&raw, 8192).unwrap_err().contains("encoded limit"));
    }

    #[test]
    fn header_and_advertised_length_refused_before_reading_body() {
        for raw in [
            format!(
                "HTTP/1.1 200 OK\r\nX-Fill: {}",
                "x".repeat(MAX_HEADER_BYTES)
            ),
            format!("HTTP/1.1 200 OK\r\nContent-Length: {MAX_RESPONSE_BYTES}\r\n\r\n"),
        ] {
            let mut cursor = raw.as_bytes();
            let error = read_bounded(|buf| {
                assert!(!cursor.is_empty(), "must refuse before another read");
                cursor.read(buf)
            })
            .unwrap_err();
            assert!(error.contains("limit"));
        }
    }

    #[test]
    fn exact_header_limit_passes_and_one_more_byte_is_refused() {
        let prefix = "HTTP/1.1 200 OK\r\nX-Fill: ";
        let raw = format!(
            "{prefix}{}\r\n\r\n",
            "x".repeat(MAX_HEADER_BYTES - prefix.len() - 4)
        );
        assert_eq!(raw.len(), MAX_HEADER_BYTES);
        assert_eq!(parse(raw.as_bytes(), 7).unwrap(), (200, String::new()));
        let oversized = raw.replacen("X-Fill: ", "X-Fill: x", 1);
        assert!(parse(oversized.as_bytes(), 7)
            .unwrap_err()
            .contains("headers exceed"));
    }

    #[test]
    fn live_client_reads_fragmented_chunked_json_without_byte_changes() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            consume_request(&mut socket);
            for part in [
                &b"HTTP/1.1 200 OK\r\nTransfer-"[..],
                b"Encoding: chunked\r\n\r\n5\r\n{\"a\":\r\n",
                b"2\r\n1}\r\n0\r\n\r\n",
            ] {
                socket.write_all(part).unwrap();
            }
        });
        let value = super::super::NodeClient::new(&addr.to_string(), "")
            .get_json("/health")
            .unwrap();
        assert_eq!(value, serde_json::json!({"a": 1}));
        server.join().unwrap();
    }

    #[test]
    fn live_client_rejects_truncated_success_json() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            consume_request(&mut socket);
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\n{}")
                .unwrap();
        });
        let result = super::super::NodeClient::new(&addr.to_string(), "").get_json("/health");
        assert!(result.unwrap_err().contains("Content-Length mismatch"));
        server.join().unwrap();
    }

    #[test]
    fn continuing_bytes_cannot_renew_total_read_deadline() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket.write_all(b"HTTP/1.1 200 OK\r\n\r\n").unwrap();
            for _ in 0..100 {
                if socket.write_all(b"x").is_err() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });
        let mut socket = TcpStream::connect(addr).unwrap();
        assert!(read_response(&mut socket, Duration::from_millis(60)).is_err());
        drop(socket);
        server.join().unwrap();
    }
}
