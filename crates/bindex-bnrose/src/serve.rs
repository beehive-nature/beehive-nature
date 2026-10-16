//! The read-only HTTP and SSE surface over a sealed index file, hand-rolled
//! on `std::net` like `bindexer`'s, deliberately: no framework, no cookies,
//! no WebSocket upgrade, no key material, GET only.
//!
//! - Every JSON answer is exactly the `query` module's JSON. `/status` adds
//!   one top-level `serve` object (the server's own confession: bounds and
//!   counters); nothing inside the query's answer is touched.
//! - `/events` is a Server-Sent Events stream (`text/event-stream`, plain
//!   GET, static-friendly): one `ingest` event per row of the `ingests`
//!   table, one `divergence` event per row of `divergences`, in time order,
//!   replayed from a cursor the client supplies either as the standard
//!   `Last-Event-ID` header or as `?since=` (an `EventSource` cannot set
//!   headers). The cursor is `i<ingest id>-d<divergence id>`: everything up
//!   to and including those ids has been seen. The tables ARE the backlog
//!   (durable, in the sealed file); a replay sends at most `replay_cap`
//!   rows per table per batch and says so with a `truncated` event, then
//!   keeps delivering in later batches.
//! - Each connection gets its own SQLite connection with `PRAGMA query_only`
//!   set: the engine refuses every write on it, so the serving process has
//!   no write path even by accident.
//! - Connections are bounded (`max_connections`); one over the bound is
//!   answered `503` with a named refusal, counted, and confessed in
//!   `/status`. Non-GET is `405` with `Allow: GET` by construction.
//! - CORS headers appear only with the explicit `cors` flag.

use crate::query;
use crate::store::Store;
use crate::{now_unix, unhex32};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct ServeOptions {
    pub max_connections: usize,
    pub replay_cap: usize,
    pub poll_ms: u64,
    pub cors: bool,
    /// seconds between keepalive comments on an idle stream
    pub keepalive_secs: u64,
}

impl Default for ServeOptions {
    fn default() -> ServeOptions {
        ServeOptions {
            max_connections: 64,
            replay_cap: 1000,
            poll_ms: 500,
            cors: false,
            keepalive_secs: 15,
        }
    }
}

/// The server's own confession, shared by every connection thread.
#[derive(Default)]
pub struct Counters {
    pub active: AtomicUsize,
    pub accepted: AtomicU64,
    pub refused_over_bound: AtomicU64,
    pub events_sent: AtomicU64,
    pub started_at_unix: AtomicU64,
}

pub struct Server {
    listener: TcpListener,
    db: PathBuf,
    opts: ServeOptions,
    pub counters: Arc<Counters>,
}

/// A connection the engine will not let write: `PRAGMA query_only = 1`.
pub fn open_query_only(db: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(db)?;
    conn.pragma_update(None, "query_only", 1)?;
    Ok(conn)
}

impl Server {
    pub fn bind(db: &Path, addr: &str, opts: ServeOptions) -> std::io::Result<Server> {
        let listener = TcpListener::bind(addr)?;
        let counters = Arc::new(Counters::default());
        counters
            .started_at_unix
            .store(now_unix(), Ordering::Relaxed);
        Ok(Server {
            listener,
            db: db.to_path_buf(),
            opts,
            counters,
        })
    }

    pub fn local_addr(&self) -> std::io::Result<SocketAddr> {
        self.listener.local_addr()
    }

    /// The accept loop; never returns under normal operation.
    pub fn run(self) -> std::io::Result<()> {
        for stream in self.listener.incoming() {
            let stream = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };
            let c = self.counters.clone();
            let db = self.db.clone();
            let opts = self.opts.clone();
            std::thread::spawn(move || handle(stream, db, opts, c));
        }
        Ok(())
    }

    /// Run the accept loop on its own thread (the tests and the CLI).
    pub fn spawn(self) -> std::thread::JoinHandle<std::io::Result<()>> {
        std::thread::spawn(move || self.run())
    }
}

struct Request {
    method: String,
    path: String,
    query: String,
    last_event_id: Option<String>,
}

fn read_request(stream: &mut TcpStream) -> Option<Request> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let mut head = Vec::new();
    let mut buf = [0u8; 1024];
    loop {
        let n = match stream.read(&mut buf) {
            Ok(0) => return None,
            Ok(n) => n,
            Err(_) => return None,
        };
        head.extend_from_slice(&buf[..n]);
        if head.len() > 16 * 1024 {
            return None;
        }
        if head.windows(4).any(|w| w == b"\r\n\r\n") {
            break;
        }
    }
    let text = String::from_utf8_lossy(&head);
    let mut lines = text.split("\r\n");
    let first = lines.next()?;
    let mut parts = first.split_whitespace();
    let method = parts.next()?.to_string();
    let target = parts.next()?.to_string();
    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p.to_string(), q.to_string()),
        None => (target.clone(), String::new()),
    };
    let mut last_event_id = None;
    for l in lines {
        if let Some((k, v)) = l.split_once(':') {
            if k.trim().eq_ignore_ascii_case("last-event-id") {
                last_event_id = Some(v.trim().to_string());
            }
        }
    }
    Some(Request {
        method,
        path,
        query,
        last_event_id,
    })
}

fn query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    query
        .split('&')
        .filter_map(|kv| kv.split_once('='))
        .find(|(k, _)| *k == key)
        .map(|(_, v)| v)
}

fn write_json(stream: &mut TcpStream, code: &str, body: &Value, cors: bool, extra: &str) {
    let text = body.to_string();
    let cors_h = if cors {
        "Access-Control-Allow-Origin: *\r\n"
    } else {
        ""
    };
    let resp = format!(
        "HTTP/1.1 {code}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n{cors_h}{extra}\r\n{text}",
        text.len()
    );
    let _ = stream.write_all(resp.as_bytes());
}

fn handle(mut stream: TcpStream, db: PathBuf, opts: ServeOptions, c: Arc<Counters>) {
    let Some(req) = read_request(&mut stream) else {
        return;
    };
    c.accepted.fetch_add(1, Ordering::Relaxed);
    if req.method != "GET" {
        // one 405 for every non-GET: read-only by construction
        write_json(
            &mut stream,
            "405 Method Not Allowed",
            &json!({"refusal": "method:not-allowed", "method": req.method, "allow": "GET", "writePath": "none: the index is written by ingest on the custody side; this surface serves"}),
            opts.cors,
            "Allow: GET\r\n",
        );
        return;
    }
    // the bound: counted before any work, released on every exit path
    let prev = c.active.fetch_add(1, Ordering::SeqCst);
    if prev >= opts.max_connections {
        c.active.fetch_sub(1, Ordering::SeqCst);
        c.refused_over_bound.fetch_add(1, Ordering::Relaxed);
        write_json(
            &mut stream,
            "503 Service Unavailable",
            &json!({"refusal": "serve:connections-exhausted", "maxConnections": opts.max_connections}),
            opts.cors,
            "Retry-After: 1\r\n",
        );
        return;
    }
    struct Release<'a>(&'a Arc<Counters>);
    impl Drop for Release<'_> {
        fn drop(&mut self) {
            self.0.active.fetch_sub(1, Ordering::SeqCst);
        }
    }
    let _release = Release(&c);

    let conn = match open_query_only(&db) {
        Ok(k) => k,
        Err(e) => {
            write_json(
                &mut stream,
                "500 Internal Server Error",
                &json!({"refusal": "serve:db", "why": e.to_string()}),
                opts.cors,
                "",
            );
            return;
        }
    };
    let store = Store { conn };

    let seg: Vec<&str> = req.path.trim_matches('/').split('/').collect();
    match (seg.first().copied().unwrap_or(""), seg.get(1).copied()) {
        ("", None) => write_json(&mut stream, "200 OK", &index_json(), opts.cors, ""),
        ("status", None) => match query::status(&store) {
            Ok(mut v) => {
                v["serve"] = serve_json(&opts, &c);
                write_json(&mut stream, "200 OK", &v, opts.cors, "");
            }
            Err(e) => write_json(
                &mut stream,
                "500 Internal Server Error",
                &json!({"refusal": "query", "why": e.to_string()}),
                opts.cors,
                "",
            ),
        },
        ("entity", Some(h)) => answer(
            &mut stream,
            &opts,
            unhex32(h)
                .map_err(crate::Error::Refused)
                .and_then(|id| query::entity(&store, &id)),
        ),
        ("authority", Some(h)) => {
            let after = query_param(&req.query, "after").and_then(|s| s.parse().ok());
            let limit = query_param(&req.query, "limit")
                .and_then(|s| s.parse().ok())
                .unwrap_or(100);
            answer(
                &mut stream,
                &opts,
                unhex32(h)
                    .map_err(crate::Error::Refused)
                    .and_then(|a| query::by_authority(&store, &a, after, limit)),
            );
        }
        ("steps", Some(h)) => answer(
            &mut stream,
            &opts,
            unhex32(h)
                .map_err(crate::Error::Refused)
                .and_then(|r| query::steps(&store, &r)),
        ),
        ("events", None) => {
            let since = query_param(&req.query, "since")
                .map(|s| s.to_string())
                .or(req.last_event_id);
            stream_events(stream, store, &opts, &c, since.as_deref());
        }
        _ => write_json(
            &mut stream,
            "404 Not Found",
            &json!({"refusal": "route:unknown", "routes": index_json()["routes"]}),
            opts.cors,
            "",
        ),
    }
}

fn answer(stream: &mut TcpStream, opts: &ServeOptions, r: Result<Value, crate::Error>) {
    match r {
        Ok(v) => write_json(stream, "200 OK", &v, opts.cors, ""),
        Err(crate::Error::Refused(why)) => write_json(
            stream,
            "400 Bad Request",
            &json!({"refusal": "request", "why": why}),
            opts.cors,
            "",
        ),
        Err(e) => write_json(
            stream,
            "500 Internal Server Error",
            &json!({"refusal": "query", "why": e.to_string()}),
            opts.cors,
            "",
        ),
    }
}

fn index_json() -> Value {
    json!({
        "crate": "bindex-bnrose",
        "surface": "read-only HTTP + SSE over one sealed index file",
        "routes": ["/status", "/entity/{hex}", "/authority/{hex}?after=&limit=", "/steps/{hex}", "/events?since=i0-d0 (SSE; or Last-Event-ID)"],
        "methods": "GET only; every other method is 405",
        "keyless": true,
        "sendtx": "NO: permanently",
    })
}

fn serve_json(opts: &ServeOptions, c: &Counters) -> Value {
    json!({
        "maxConnections": opts.max_connections,
        "activeConnections": c.active.load(Ordering::SeqCst),
        "acceptedRequests": c.accepted.load(Ordering::Relaxed),
        "refusedOverBound": c.refused_over_bound.load(Ordering::Relaxed),
        "replayCap": opts.replay_cap,
        "pollMs": opts.poll_ms,
        "keepaliveSecs": opts.keepalive_secs,
        "cors": opts.cors,
        "eventsSent": c.events_sent.load(Ordering::Relaxed),
        "startedAtUnix": c.started_at_unix.load(Ordering::Relaxed),
        "backlog": "the ingests and divergences tables of the sealed file; a replay batch is bounded by replayCap and says so with a truncated event",
    })
}

/// `i<ingest id>-d<divergence id>`; anything unparseable is the origin.
pub fn parse_cursor(s: Option<&str>) -> (i64, i64) {
    let Some(s) = s else { return (0, 0) };
    let Some((i, d)) = s.split_once('-') else {
        return (0, 0);
    };
    let i = i
        .strip_prefix('i')
        .and_then(|x| x.parse().ok())
        .unwrap_or(0);
    let d = d
        .strip_prefix('d')
        .and_then(|x| x.parse().ok())
        .unwrap_or(0);
    (i, d)
}

pub fn cursor_string(i: i64, d: i64) -> String {
    format!("i{i}-d{d}")
}

struct Ev {
    kind: &'static str,
    at: i64,
    id: i64,
    data: Value,
}

/// One batch: every ingest row past `i` and every divergence row past `d`,
/// each table capped, merged by time. Returns the rows and whether a cap hit.
fn batch(store: &Store, i: i64, d: i64, cap: usize) -> Result<(Vec<Ev>, bool), rusqlite::Error> {
    let mut out = Vec::new();
    let mut stmt = store.conn.prepare(
        "SELECT id, at_unix, covered_through_seq, index_head, agreement, single_replica, outcome FROM ingests WHERE id > ?1 ORDER BY id ASC LIMIT ?2",
    )?;
    let ing: Vec<Ev> = stmt
        .query_map(params![i, (cap + 1) as i64], |r| {
            let head: Vec<u8> = r.get(3)?;
            Ok(Ev {
                kind: "ingest",
                at: r.get(1)?,
                id: r.get(0)?,
                data: json!({
                    "id": r.get::<_, i64>(0)?,
                    "atUnix": r.get::<_, i64>(1)?,
                    "coveredThroughSeq": r.get::<_, i64>(2)?,
                    "indexHead": crate::hex(&head),
                    "agreement": r.get::<_, String>(4)?,
                    "singleReplica": r.get::<_, i64>(5)? == 1,
                    "outcome": r.get::<_, String>(6)?,
                }),
            })
        })?
        .collect::<Result<_, _>>()?;
    let mut stmt = store.conn.prepare(
        "SELECT id, at_unix, seq, replica_a, replica_b, digest_a, digest_b FROM divergences WHERE id > ?1 ORDER BY id ASC LIMIT ?2",
    )?;
    let div: Vec<Ev> = stmt
        .query_map(params![d, (cap + 1) as i64], |r| {
            let da: Vec<u8> = r.get(5)?;
            let db: Vec<u8> = r.get(6)?;
            Ok(Ev {
                kind: "divergence",
                at: r.get(1)?,
                id: r.get(0)?,
                data: json!({
                    "id": r.get::<_, i64>(0)?,
                    "atUnix": r.get::<_, i64>(1)?,
                    "seq": r.get::<_, i64>(2)?,
                    "replicaA": r.get::<_, String>(3)?,
                    "replicaB": r.get::<_, String>(4)?,
                    "digestA": crate::hex(&da),
                    "digestB": crate::hex(&db),
                }),
            })
        })?
        .collect::<Result<_, _>>()?;
    let truncated = ing.len() > cap || div.len() > cap;
    out.extend(ing.into_iter().take(cap));
    out.extend(div.into_iter().take(cap));
    out.sort_by(|a, b| {
        a.at.cmp(&b.at)
            .then(a.kind.cmp(b.kind))
            .then(a.id.cmp(&b.id))
    });
    Ok((out, truncated))
}

fn stream_events(
    mut stream: TcpStream,
    store: Store,
    opts: &ServeOptions,
    c: &Counters,
    since: Option<&str>,
) {
    let cors_h = if opts.cors {
        "Access-Control-Allow-Origin: *\r\n"
    } else {
        ""
    };
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: close\r\nX-Accel-Buffering: no\r\n{cors_h}\r\n"
    );
    if stream.write_all(head.as_bytes()).is_err() {
        return;
    }
    let (mut i, mut d) = parse_cursor(since);
    let hello = json!({
        "cursor": cursor_string(i, d),
        "coveredThroughSeq": store.meta("covered_through_seq").ok().flatten(),
        "indexHead": store.meta("index_head").ok().flatten(),
        "readAtUnix": store.meta("read_at_unix").ok().flatten(),
        "replayCap": opts.replay_cap,
    });
    if write_event(&mut stream, "hello", &cursor_string(i, d), &hello).is_err() {
        return;
    }
    // while idle the socket is probed with a 1 ms read: a zero-length read
    // is the peer closing, and the thread (and its bound slot) end at once
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1)));
    let mut idle_polls: u64 = 0;
    let keepalive_every = (opts.keepalive_secs * 1000 / opts.poll_ms.max(1)).max(1);
    loop {
        let (rows, truncated) = match batch(&store, i, d, opts.replay_cap) {
            Ok(b) => b,
            Err(e) => {
                let _ = write_event(
                    &mut stream,
                    "error",
                    &cursor_string(i, d),
                    &json!({"refusal": "query", "why": e.to_string()}),
                );
                return;
            }
        };
        if rows.is_empty() {
            let mut probe = [0u8; 8];
            match stream.read(&mut probe) {
                Ok(0) => return,
                Ok(_) => {}
                Err(e)
                    if matches!(
                        e.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) => {}
                Err(_) => return,
            }
            idle_polls += 1;
            if idle_polls.is_multiple_of(keepalive_every)
                && stream.write_all(b": keepalive\n\n").is_err()
            {
                return;
            }
            std::thread::sleep(Duration::from_millis(opts.poll_ms));
            continue;
        }
        idle_polls = 0;
        for ev in rows {
            match ev.kind {
                "ingest" => i = i.max(ev.id),
                _ => d = d.max(ev.id),
            }
            if write_event(&mut stream, ev.kind, &cursor_string(i, d), &ev.data).is_err() {
                return;
            }
            c.events_sent.fetch_add(1, Ordering::Relaxed);
        }
        if truncated
            && write_event(
                &mut stream,
                "truncated",
                &cursor_string(i, d),
                &json!({"replayCap": opts.replay_cap, "cursor": cursor_string(i, d), "note": "more rows follow in the next batch"}),
            )
            .is_err()
        {
            return;
        }
    }
}

fn write_event(stream: &mut TcpStream, kind: &str, id: &str, data: &Value) -> std::io::Result<()> {
    let frame = format!("id: {id}\nevent: {kind}\ndata: {}\n\n", data);
    stream.write_all(frame.as_bytes())
}

/// A minimal SSE reader for tests and tools: one event per call.
pub struct SseReader<R: Read> {
    inner: BufReader<R>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SseEvent {
    pub id: String,
    pub event: String,
    pub data: String,
}

impl<R: Read> SseReader<R> {
    pub fn new(r: R) -> SseReader<R> {
        SseReader {
            inner: BufReader::new(r),
        }
    }

    /// Skips the HTTP head (up to the first blank line) once, then yields
    /// events; comments are skipped; `None` on EOF or timeout.
    pub fn skip_head(&mut self) -> std::io::Result<String> {
        let mut status = String::new();
        let mut line = String::new();
        loop {
            line.clear();
            if self.inner.read_line(&mut line)? == 0 {
                return Ok(status);
            }
            if status.is_empty() {
                status = line.trim_end().to_string();
            }
            if line == "\r\n" || line == "\n" {
                return Ok(status);
            }
        }
    }

    pub fn next_event(&mut self) -> Option<SseEvent> {
        let mut ev = SseEvent {
            id: String::new(),
            event: String::new(),
            data: String::new(),
        };
        let mut line = String::new();
        loop {
            line.clear();
            match self.inner.read_line(&mut line) {
                Ok(0) | Err(_) => return None,
                Ok(_) => {}
            }
            let l = line.trim_end_matches(['\r', '\n']);
            if l.is_empty() {
                if ev.event.is_empty() && ev.data.is_empty() {
                    continue; // blank between comments
                }
                return Some(ev);
            }
            if let Some(rest) = l.strip_prefix(':') {
                let _ = rest; // comment / keepalive
                continue;
            }
            if let Some(v) = l.strip_prefix("id: ") {
                ev.id = v.to_string();
            } else if let Some(v) = l.strip_prefix("event: ") {
                ev.event = v.to_string();
            } else if let Some(v) = l.strip_prefix("data: ") {
                ev.data = v.to_string();
            }
        }
    }
}
