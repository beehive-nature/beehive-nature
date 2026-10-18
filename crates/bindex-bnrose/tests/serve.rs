//! The serving surface, driven end to end: a real state directory from the
//! supervisor, a sealed index, the server on a loopback port, raw HTTP over
//! `TcpStream` (no client crate), SSE events read as a browser would read
//! them, an ingest performed WHILE a client is subscribed, a divergence, the
//! 405s, the connection bound (taken before any header byte), the replay
//! cap over the merged stream, the cursor precedence on reconnect, the
//! natively read-only handle, the refused options, and the planted write.

use bindex_bnrose::ingest::{ingest, IngestOptions};
use bindex_bnrose::query;
use bindex_bnrose::serve::{
    open_read_only, parse_cursor, parse_cursor_strict, ServeOptions, Server, SseEvent, SseReader,
};
use bindex_bnrose::store::Store;
use bnrose_exec_core::E_ADMITTED;
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::keys::SupervisorKeys;
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker};
use rusqlite::DatabaseName;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

const NOW: u64 = 1_800_000_000;

struct Lab {
    state: PathBuf,
    db: PathBuf,
    pk: [u8; 32],
    next_fixture: u64,
}

fn lab(name: &str, root_byte: u8) -> Lab {
    let dir = std::env::temp_dir().join(format!("bindex-serve-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let state = dir.join("state");
    std::fs::create_dir_all(&state).unwrap();
    SupervisorKeys::init(&state, &[root_byte; 32]).unwrap();
    let pk = SupervisorKeys::load(&state).unwrap().ed_public;
    Lab {
        state,
        db: dir.join("index.db"),
        pk,
        next_fixture: 0,
    }
}

impl Lab {
    fn run_ops(&mut self, n: u64) -> Vec<[u8; 32]> {
        let mut sup =
            Supervisor::open(&self.state, Box::new(NativeWorker::new()), test_policy()).unwrap();
        let mut ids = Vec::new();
        for _ in 0..n {
            let f = fixture(self.next_fixture, NOW, 600);
            self.next_fixture += 1;
            let out = sup.run(
                &read_intent(&f.to_json()).unwrap(),
                NOW,
                false,
                &Bounds::default(),
            );
            assert!(out.refused.is_none(), "{:?}", out.refused);
            ids.push(bnrose_exec_core::op_id(&f.authority, &f.env));
        }
        ids
    }
    fn index(&self) -> Result<u64, bindex_bnrose::Error> {
        let mut store = Store::open(&self.db)?;
        ingest(&mut store, &self.state, &self.pk, &IngestOptions::default())
            .map(|r| r.covered_through_seq)
    }
    /// Rewrite one byte of the replica so the next ingest refuses and
    /// records a divergence.
    fn diverge(&self) {
        let replica = self.state.join("replica").join("journal.bin");
        let mut bytes = std::fs::read(&replica).unwrap();
        let mut i = 0;
        loop {
            let len = u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap()) as usize;
            if bytes[i + 4 + 41] == E_ADMITTED {
                bytes[i + 4 + 46 + 130 + 9] ^= 0x01;
                break;
            }
            i += 4 + len;
        }
        std::fs::write(&replica, bytes).unwrap();
    }
    fn serve(&self, opts: ServeOptions) -> SocketAddr {
        let server = Server::bind(&self.db, "127.0.0.1:0", opts).unwrap();
        let addr = server.local_addr().unwrap();
        server.spawn();
        addr
    }
}

fn fast() -> ServeOptions {
    ServeOptions {
        poll_ms: 50,
        keepalive_secs: 1,
        ..ServeOptions::default()
    }
}

fn request(
    addr: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
) -> (String, String, Value) {
    let mut s = TcpStream::connect(addr).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
    let mut req = format!("{method} {path} HTTP/1.1\r\nHost: test\r\n");
    for (k, v) in headers {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str("\r\n");
    s.write_all(req.as_bytes()).unwrap();
    let mut raw = Vec::new();
    let _ = s.read_to_end(&mut raw);
    let text = String::from_utf8_lossy(&raw).into_owned();
    let (head, body) = text.split_once("\r\n\r\n").expect("an HTTP head");
    let status = head.lines().next().unwrap().to_string();
    let json = serde_json::from_str::<Value>(body).unwrap_or(Value::Null);
    (status, head.to_string(), json)
}

fn get(addr: SocketAddr, path: &str) -> (String, Value) {
    let (s, _, v) = request(addr, "GET", path, &[]);
    (s, v)
}

fn subscribe(
    addr: SocketAddr,
    path: &str,
    headers: &[(&str, &str)],
) -> (String, SseReader<TcpStream>) {
    let mut s = TcpStream::connect(addr).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(8))).unwrap();
    let mut req = format!("GET {path} HTTP/1.1\r\nHost: test\r\nAccept: text/event-stream\r\n");
    for (k, v) in headers {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str("\r\n");
    s.write_all(req.as_bytes()).unwrap();
    let mut r = SseReader::new(s);
    let status = r.skip_head().unwrap();
    (status, r)
}

fn next(r: &mut SseReader<TcpStream>) -> SseEvent {
    r.next_event().expect("an event before the read timeout")
}

fn data(ev: &SseEvent) -> Value {
    serde_json::from_str(&ev.data).unwrap()
}

fn wait_status_ok(addr: SocketAddr, tries: usize) -> Option<Value> {
    for _ in 0..tries {
        let (st, _, body) = request(addr, "GET", "/status", &[]);
        if st == "HTTP/1.1 200 OK" {
            return Some(body);
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    None
}

// ---- answers are the query module's, untouched -------------------------------

#[test]
fn get_answers_are_exactly_the_query_json_and_status_confesses_the_server() {
    let mut lab = lab("answers", 0x21);
    let ids = lab.run_ops(2);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions::default());
    let store = Store {
        conn: open_read_only(&lab.db).unwrap(),
    };

    let (st, mut status) = get(addr, "/status");
    assert_eq!(st, "HTTP/1.1 200 OK");
    let serve = status.as_object_mut().unwrap().remove("serve").unwrap();
    assert_eq!(serve["maxConnections"], 64);
    assert_eq!(serve["headerTimeoutSecs"], 5);
    assert_eq!(serve["writeTimeoutSecs"], 10);
    assert!(serve["backlog"].is_string());
    assert!(serve["boundTakenAt"]
        .as_str()
        .unwrap()
        .starts_with("accept"));
    assert_eq!(serve["cors"], false);
    assert_eq!(
        status,
        query::status(&store).unwrap(),
        "status is the query's own JSON plus serve"
    );

    let hex0 = bindex_bnrose::hex(&ids[0]);
    let (st, entity) = get(addr, &format!("/entity/{hex0}"));
    assert_eq!(st, "HTTP/1.1 200 OK");
    assert_eq!(entity, query::entity(&store, &ids[0]).unwrap());
    assert_eq!(entity["entity"]["evidence"]["attested"]["value"], true);

    let f0 = fixture(0, NOW, 600);
    let a = bindex_bnrose::hex(&f0.authority);
    let (st, by) = get(addr, &format!("/authority/{a}?limit=5"));
    assert_eq!(st, "HTTP/1.1 200 OK");
    assert_eq!(
        by,
        query::by_authority(&store, &f0.authority, None, 5).unwrap()
    );
    assert!(
        by["coverage"]["readAtUnix"].as_u64().unwrap() > 0,
        "freshness marks travel"
    );

    let (st, steps) = get(addr, &format!("/steps/{hex0}"));
    assert_eq!(st, "HTTP/1.1 200 OK");
    assert_eq!(steps, query::steps(&store, &ids[0]).unwrap());

    let (st, idx) = get(addr, "/");
    assert_eq!(st, "HTTP/1.1 200 OK");
    assert_eq!(idx["sendtx"], "NO: permanently");
    let (st, nope) = get(addr, "/nope");
    assert_eq!(st, "HTTP/1.1 404 Not Found");
    assert_eq!(nope["refusal"], "route:unknown");
    let (st, bad) = get(addr, "/entity/zz");
    assert_eq!(st, "HTTP/1.1 400 Bad Request");
    assert_eq!(bad["refusal"], "request");
}

// ---- no write path -------------------------------------------------------------

#[test]
fn non_get_is_405_by_construction_and_a_planted_write_is_refused_by_name() {
    let mut lab = lab("writes", 0x22);
    lab.run_ops(1);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions::default());
    for (verb, path) in [
        ("POST", "/status"),
        ("PUT", "/entity/00"),
        ("DELETE", "/events"),
        ("PATCH", "/authority/00"),
        ("POST", "/ingest"),
    ] {
        let (st, head, body) = request(addr, verb, path, &[("Content-Length", "2")]);
        assert_eq!(st, "HTTP/1.1 405 Method Not Allowed", "{verb} {path}");
        assert!(head.contains("Allow: GET"), "{head}");
        assert_eq!(body["refusal"], "method:not-allowed");
    }
}

#[test]
fn the_serving_handle_is_natively_read_only_and_never_creates_a_file() {
    let mut lab = lab("readonly", 0x27);
    lab.run_ops(1);
    lab.index().unwrap();
    // natively read-only: the engine says so, and an INSERT is refused
    let conn = open_read_only(&lab.db).unwrap();
    assert!(conn.is_readonly(DatabaseName::Main).unwrap());
    let err = conn
        .execute(
            "INSERT INTO meta(key, value) VALUES ('planted', 'write')",
            [],
        )
        .expect_err("a read-only handle must refuse the write");
    assert!(err.to_string().contains("readonly"), "{err}");
    // even with the PRAGMA toggled off, the handle stays read-only
    conn.pragma_update(None, "query_only", 0).unwrap();
    let err = conn
        .execute(
            "INSERT INTO meta(key, value) VALUES ('planted', 'write')",
            [],
        )
        .expect_err("the PRAGMA is defense in depth, not the guarantee");
    assert!(err.to_string().contains("readonly"), "{err}");
    let store = Store { conn };
    assert_eq!(store.meta("planted").unwrap(), None);
    // a missing index is refused, and no file appears
    let missing = lab.db.parent().unwrap().join("not-there.db");
    assert!(open_read_only(&missing).is_err());
    assert!(!missing.exists(), "a GET must never create an index file");
    let server = Server::bind(&missing, "127.0.0.1:0", ServeOptions::default()).unwrap();
    let addr = server.local_addr().unwrap();
    server.spawn();
    let (st, _, body) = request(addr, "GET", "/status", &[]);
    assert_eq!(st, "HTTP/1.1 500 Internal Server Error");
    assert_eq!(body["refusal"], "serve:db");
    assert!(!missing.exists());
}

// ---- options are validated by name ---------------------------------------------

#[test]
fn zero_or_absurd_options_are_refused_by_name_at_bind() {
    let mut lab = lab("options", 0x28);
    lab.run_ops(1);
    lab.index().unwrap();
    for (what, opts) in [
        (
            "replay_cap",
            ServeOptions {
                replay_cap: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "poll_ms",
            ServeOptions {
                poll_ms: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "max_connections",
            ServeOptions {
                max_connections: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "keepalive_secs",
            ServeOptions {
                keepalive_secs: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "header_timeout_secs",
            ServeOptions {
                header_timeout_secs: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "write_timeout_secs",
            ServeOptions {
                write_timeout_secs: 0,
                ..ServeOptions::default()
            },
        ),
        (
            "replay_cap",
            ServeOptions {
                replay_cap: 1_000_000,
                ..ServeOptions::default()
            },
        ),
    ] {
        let err = Server::bind(&lab.db, "127.0.0.1:0", opts)
            .err()
            .expect(what);
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidInput);
        assert!(err.to_string().starts_with("serve:config: "), "{err}");
        assert!(err.to_string().contains(what), "{err}");
    }
    assert!(ServeOptions::default().validate().is_ok());
}

// ---- events: replay, live ingest, divergence, resume ------------------------------

#[test]
fn events_replay_then_follow_a_live_ingest_and_a_divergence() {
    let mut lab = lab("events", 0x23);
    lab.run_ops(2);
    let covered1 = lab.index().unwrap();
    let addr = lab.serve(fast());

    let (status, mut r) = subscribe(addr, "/events?since=i0-d0", &[]);
    assert_eq!(status, "HTTP/1.1 200 OK");
    let hello = next(&mut r);
    assert_eq!(hello.event, "hello");
    assert_eq!(hello.id, "i0-d0");
    assert_eq!(data(&hello)["coveredThroughSeq"], covered1.to_string());
    let first = next(&mut r);
    assert_eq!(first.event, "ingest");
    assert_eq!(first.id, "i1-d0");
    assert_eq!(data(&first)["coveredThroughSeq"], covered1);
    assert_eq!(data(&first)["outcome"], "ok");

    // an ingest WHILE subscribed: the journal grows, the index extends
    lab.run_ops(1);
    let covered2 = lab.index().unwrap();
    assert!(covered2 > covered1);
    let live = next(&mut r);
    assert_eq!(live.event, "ingest");
    assert_eq!(live.id, "i2-d0");
    assert_eq!(data(&live)["coveredThroughSeq"], covered2);

    // a divergence: one replica rewritten, the ingest refuses and records
    lab.diverge();
    let err = lab.index().expect_err("divergence refuses");
    assert!(err.to_string().contains("divergence"), "{err}");
    // the divergence row is written before the refused ingest row, in the
    // same second; kind order puts divergence first
    let div = next(&mut r);
    assert_eq!(div.event, "divergence", "{div:?}");
    assert_eq!(data(&div)["seq"], 0);
    assert_eq!(div.id, "i2-d1");
    let ing = next(&mut r);
    assert_eq!(ing.event, "ingest");
    assert_eq!(data(&ing)["outcome"], "refused:diverge");
    assert_eq!(ing.id, "i3-d1", "the cursor covers both tables");

    // resume with the standard header: only what is past the cursor comes
    let (_, mut r2) = subscribe(addr, "/events", &[("Last-Event-ID", "i2-d0")]);
    let h = next(&mut r2);
    assert_eq!(h.event, "hello");
    assert_eq!(h.id, "i2-d0");
    let a = next(&mut r2);
    assert_eq!((a.event.as_str(), a.id.as_str()), ("divergence", "i2-d1"));
    let b = next(&mut r2);
    assert_eq!((b.event.as_str(), b.id.as_str()), ("ingest", "i3-d1"));
    assert_eq!(parse_cursor(Some(&b.id)), (3, 1));
}

#[test]
fn a_reconnect_with_both_cursor_sources_resumes_from_the_header_without_duplicates() {
    let mut lab = lab("resume", 0x29);
    lab.run_ops(1);
    lab.index().unwrap();
    lab.index().unwrap();
    lab.index().unwrap(); // three ingest rows
    let addr = lab.serve(fast());
    // an EventSource re-sends its original URL (?since=i0-d0) on reconnect
    // and advances the header: the header must win
    let (_, mut r) = subscribe(addr, "/events?since=i0-d0", &[("Last-Event-ID", "i2-d0")]);
    let h = next(&mut r);
    assert_eq!(h.event, "hello");
    assert_eq!(h.id, "i2-d0");
    let only = next(&mut r);
    assert_eq!((only.event.as_str(), only.id.as_str()), ("ingest", "i3-d0"));
    assert_eq!(data(&only)["id"], 3, "i1 and i2 are not replayed");
    // a malformed header falls back to the query bootstrap, not to a crash
    let (_, mut r2) = subscribe(addr, "/events?since=i1-d0", &[("Last-Event-ID", "garbage")]);
    assert_eq!(next(&mut r2).id, "i1-d0");
    assert_eq!(next(&mut r2).id, "i2-d0");
    assert_eq!(parse_cursor_strict("garbage"), None);
    assert_eq!(parse_cursor_strict("i-1-d0"), None);
    assert_eq!(parse_cursor_strict("i7-d2"), Some((7, 2)));
}

// ---- bounds: connections (taken at accept) and the merged replay cap --------------

#[test]
fn connections_are_bounded_and_the_refusal_is_confessed_in_status() {
    let mut lab = lab("bound", 0x24);
    lab.run_ops(1);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions {
        max_connections: 1,
        ..fast()
    });
    let (status, mut held) = subscribe(addr, "/events", &[]);
    assert_eq!(status, "HTTP/1.1 200 OK");
    let _ = next(&mut held); // hello: the stream is established and counted
    let (st, _, body) = request(addr, "GET", "/status", &[]);
    assert_eq!(st, "HTTP/1.1 503 Service Unavailable");
    assert_eq!(body["refusal"], "serve:connections-exhausted");
    drop(held);
    let body = wait_status_ok(addr, 50).expect("the slot never came back");
    assert!(body["serve"]["refusedOverBound"].as_u64().unwrap() >= 1);
    assert_eq!(body["serve"]["maxConnections"], 1);
}

#[test]
fn the_bound_is_taken_before_any_header_byte_and_a_slow_client_is_dropped_at_the_deadline() {
    let mut lab = lab("slowloris", 0x2a);
    lab.run_ops(1);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions {
        max_connections: 1,
        header_timeout_secs: 1,
        ..fast()
    });
    // a client that never finishes its headers holds the one slot ...
    let mut slow = TcpStream::connect(addr).unwrap();
    slow.write_all(b"GET /status HTTP/1.1\r\nHost: test\r\n")
        .unwrap();
    std::thread::sleep(Duration::from_millis(200));
    let (st, _, body) = request(addr, "GET", "/status", &[]);
    assert_eq!(st, "HTTP/1.1 503 Service Unavailable", "{body}");
    // ... and a non-GET over the bound is refused the same way, inline,
    // without a worker thread
    let (st, _, _) = request(addr, "POST", "/status", &[]);
    assert_eq!(st, "HTTP/1.1 503 Service Unavailable");
    // at the deadline the slow client is dropped and the slot returns
    let body =
        wait_status_ok(addr, 40).expect("the slot never came back after the header deadline");
    assert!(
        body["serve"]["headerTimeouts"].as_u64().unwrap() >= 1,
        "{body}"
    );
    assert!(body["serve"]["refusedOverBound"].as_u64().unwrap() >= 2);
    drop(slow);
}

#[test]
fn a_replay_is_capped_over_the_merged_stream_and_keeps_time_order_across_batches() {
    let mut lab = lab("cap", 0x25);
    lab.run_ops(1);
    lab.index().unwrap(); // i1 at t1
    std::thread::sleep(Duration::from_millis(1100));
    lab.index().unwrap(); // i2 at t2 > t1
    std::thread::sleep(Duration::from_millis(1100));
    lab.diverge();
    let _ = lab.index().expect_err("divergence"); // d1 then i3, both at t3 > t2
    let addr = lab.serve(ServeOptions {
        replay_cap: 1,
        ..fast()
    });
    let (_, mut r) = subscribe(addr, "/events?since=i0-d0", &[]);
    assert_eq!(next(&mut r).event, "hello");
    // one event per batch, each followed by truncated while more is pending;
    // the order is the global time order, never an earlier ingest after a
    // later divergence
    let e1 = next(&mut r);
    assert_eq!((e1.event.as_str(), e1.id.as_str()), ("ingest", "i1-d0"));
    assert_eq!(next(&mut r).event, "truncated");
    let e2 = next(&mut r);
    assert_eq!((e2.event.as_str(), e2.id.as_str()), ("ingest", "i2-d0"));
    assert_eq!(next(&mut r).event, "truncated");
    let e3 = next(&mut r);
    assert_eq!((e3.event.as_str(), e3.id.as_str()), ("divergence", "i2-d1"));
    assert_eq!(next(&mut r).event, "truncated");
    let e4 = next(&mut r);
    assert_eq!((e4.event.as_str(), e4.id.as_str()), ("ingest", "i3-d1"));
    assert!(data(&e1)["atUnix"].as_i64() < data(&e2)["atUnix"].as_i64());
    assert!(data(&e2)["atUnix"].as_i64() <= data(&e3)["atUnix"].as_i64());
}

#[test]
fn cors_header_appears_only_with_the_flag() {
    let mut lab = lab("cors", 0x26);
    lab.run_ops(1);
    lab.index().unwrap();
    let plain = lab.serve(ServeOptions::default());
    let (_, head, _) = request(plain, "GET", "/status", &[]);
    assert!(!head.contains("Access-Control-Allow-Origin"));
    let open = lab.serve(ServeOptions {
        cors: true,
        ..ServeOptions::default()
    });
    let (_, head, body) = request(open, "GET", "/status", &[]);
    assert!(head.contains("Access-Control-Allow-Origin: *"));
    assert_eq!(body["serve"]["cors"], true);
}
