//! The read-only HTTP surface — hand-rolled on std, deliberately.
//!
//! GET-only by construction: the router matches exactly five read paths; every
//! other method 405s. There is no POST handler to abuse because there is no POST
//! handler. `sendtx` is not a route, not a function, not a string in this crate's
//! call graph — the spec's most important row, enforced structurally.

use crate::api;
use rusqlite::Connection;
use std::io::{Read, Write};
use std::net::TcpListener;

pub fn serve(conn: &Connection, addr: &str) -> std::io::Result<()> {
    let listener = TcpListener::bind(addr)?;
    eprintln!("bindexer read-only API on http://{addr}  (GET only; sendtx: NO — permanently)");
    for stream in listener.incoming() {
        let mut stream = match stream {
            Ok(s) => s,
            Err(_) => continue,
        };
        let mut buf = [0u8; 4096];
        let n = match stream.read(&mut buf) {
            Ok(n) if n > 0 => n,
            _ => continue,
        };
        let req = String::from_utf8_lossy(&buf[..n]);
        let mut parts = req.split_whitespace();
        let method = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("");
        let (code, body) = route(conn, method, path);
        let resp = format!(
            "HTTP/1.1 {code}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        let _ = stream.write_all(resp.as_bytes());
    }
    Ok(())
}

fn route(conn: &Connection, method: &str, path: &str) -> (&'static str, String) {
    if method != "GET" {
        // one 405 for every non-GET — read-only by construction
        return (
            "405 Method Not Allowed",
            serde_json::json!({"error": "read-only API", "method": method, "sendtx": "NO — permanently"}).to_string(),
        );
    }
    let seg: Vec<&str> = path.trim_matches('/').split('/').collect();
    let out = match (
        seg.first().copied(),
        seg.get(1).copied(),
        seg.get(2).copied(),
    ) {
        (Some("api"), Some("status"), _) => api::status(conn),
        (Some("api"), Some("block-index"), Some(h)) => match h.parse::<i64>() {
            Ok(h) => api::block_by_height(conn, h),
            Err(_) => serde_json::json!({"error": "height must be an integer"}),
        },
        (Some("api"), Some("block"), Some(id)) => api::block_by_hash(conn, id),
        (Some("api"), Some("tx"), Some(id)) => api::tx(conn, id),
        (Some("api"), Some("address"), Some(a)) => api::address(conn, a),
        (Some("api"), Some("reorgs"), _) => api::reorgs(conn),
        _ => serde_json::json!({
            "error": "no such route",
            "routes": ["/api/status", "/api/block-index/{height}", "/api/block/{hash}", "/api/tx/{txid}", "/api/address/{address}", "/api/reorgs"],
            "sendtx": "NO — permanently"
        }),
    };
    ("200 OK", out.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store;

    #[test]
    fn non_get_is_405_read_only_by_construction() {
        let conn = store::open(":memory:").unwrap();
        store::init(&conn, "7200").unwrap();
        for verb in ["POST", "PUT", "DELETE", "PATCH"] {
            let (code, body) = route(&conn, verb, "/api/tx/0x1");
            assert_eq!(code, "405 Method Not Allowed", "{verb} must 405");
            assert!(body.contains("NO"), "the denial travels with the refusal");
        }
        // and the unknown route confesses the route list
        let (code, body) = route(&conn, "GET", "/api/nope");
        assert_eq!(code, "200 OK");
        assert!(
            body.contains("sendtx"),
            "the 404-shape answer carries the NO row too"
        );
    }
}
