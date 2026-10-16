//! The serving surface, driven end to end: a real state directory from the
//! supervisor, a sealed index, the server on a loopback port, raw HTTP over
//! `TcpStream` (no client crate), SSE events read as a browser would read
//! them, an ingest performed WHILE a client is subscribed, a divergence, the
//! 405s, the connection bound, the replay cap, and the planted write.

use bindex_bnrose::ingest::{ingest, IngestOptions};
use bindex_bnrose::query;
use bindex_bnrose::serve::{
    open_query_only, parse_cursor, ServeOptions, Server, SseEvent, SseReader,
};
use bindex_bnrose::store::Store;
use bnrose_exec_core::E_ADMITTED;
use bnrose_exec_host::fixtures::{fixture, read_intent, test_policy};
use bnrose_exec_host::keys::SupervisorKeys;
use bnrose_exec_host::opexec::Supervisor;
use bnrose_exec_host::worker::{Bounds, NativeWorker};
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
    fn serve(&self, opts: ServeOptions) -> SocketAddr {
        let server = Server::bind(&self.db, "127.0.0.1:0", opts).unwrap();
        let addr = server.local_addr().unwrap();
        server.spawn();
        addr
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

// ---- answers are the query module's, untouched -------------------------------

#[test]
fn get_answers_are_exactly_the_query_json_and_status_confesses_the_server() {
    let mut lab = lab("answers", 0x21);
    let ids = lab.run_ops(2);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions::default());
    let store = Store {
        conn: open_query_only(&lab.db).unwrap(),
    };

    let (st, mut status) = get(addr, "/status");
    assert_eq!(st, "HTTP/1.1 200 OK");
    let serve = status.as_object_mut().unwrap().remove("serve").unwrap();
    assert_eq!(serve["maxConnections"], 64);
    assert!(serve["backlog"].is_string());
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
    // the engine-level refusal behind every connection the server opens
    let conn = open_query_only(&lab.db).unwrap();
    let err = conn
        .execute(
            "INSERT INTO meta(key, value) VALUES ('planted', 'write')",
            [],
        )
        .expect_err("a query_only connection must refuse the write");
    assert!(err.to_string().contains("readonly"), "{err}");
    let store = Store { conn };
    assert_eq!(store.meta("planted").unwrap(), None);
}

// ---- events: replay, live ingest, divergence, resume ------------------------------

#[test]
fn events_replay_then_follow_a_live_ingest_and_a_divergence() {
    let mut lab = lab("events", 0x23);
    lab.run_ops(2);
    let covered1 = lab.index().unwrap();
    let addr = lab.serve(ServeOptions {
        poll_ms: 100,
        ..ServeOptions::default()
    });

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
    let replica = lab.state.join("replica").join("journal.bin");
    let mut bytes = std::fs::read(&replica).unwrap();
    // flip a byte inside the first Admitted record's envelope
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
    let err = lab.index().expect_err("divergence refuses");
    assert!(err.to_string().contains("divergence"), "{err}");
    let ev = next(&mut r);
    // the refused ingest row and the divergence row carry the same second;
    // the merge orders divergence before ingest by kind, so either may come
    // first depending on the clock tick; collect both
    let ev2 = next(&mut r);
    let kinds: Vec<&str> = vec![ev.event.as_str(), ev2.event.as_str()];
    assert!(kinds.contains(&"divergence"), "{kinds:?}");
    assert!(kinds.contains(&"ingest"), "{kinds:?}");
    let div = if ev.event == "divergence" { &ev } else { &ev2 };
    let ing = if ev.event == "ingest" { &ev } else { &ev2 };
    assert_eq!(data(div)["seq"], 0);
    assert_eq!(data(ing)["outcome"], "refused:diverge");
    assert_eq!(ev2.id, "i3-d1", "the cursor covers both tables");

    // resume with the standard header: only what is past the cursor comes
    let (_, mut r2) = subscribe(addr, "/events", &[("Last-Event-ID", "i2-d0")]);
    let h = next(&mut r2);
    assert_eq!(h.event, "hello");
    assert_eq!(h.id, "i2-d0");
    let a = next(&mut r2);
    let b = next(&mut r2);
    let ids: Vec<String> = vec![a.id.clone(), b.id.clone()];
    assert!(ids.contains(&"i3-d1".to_string()), "{ids:?}");
    assert_eq!(parse_cursor(Some(&b.id)), (3, 1));
}

// ---- bounds: connections and replay --------------------------------------------

#[test]
fn connections_are_bounded_and_the_refusal_is_confessed_in_status() {
    let mut lab = lab("bound", 0x24);
    lab.run_ops(1);
    lab.index().unwrap();
    let addr = lab.serve(ServeOptions {
        max_connections: 1,
        poll_ms: 100,
        keepalive_secs: 1,
        ..ServeOptions::default()
    });
    let (status, mut held) = subscribe(addr, "/events", &[]);
    assert_eq!(status, "HTTP/1.1 200 OK");
    let _ = next(&mut held); // hello: the stream is established and counted
    let (st, _, body) = request(addr, "GET", "/status", &[]);
    assert_eq!(st, "HTTP/1.1 503 Service Unavailable");
    assert_eq!(body["refusal"], "serve:connections-exhausted");
    drop(held);
    // the slot is released when the stream goes; the refusal is counted
    let mut ok = false;
    for _ in 0..50 {
        let (st, _, body) = request(addr, "GET", "/status", &[]);
        if st == "HTTP/1.1 200 OK" {
            assert!(body["serve"]["refusedOverBound"].as_u64().unwrap() >= 1);
            assert_eq!(body["serve"]["maxConnections"], 1);
            ok = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    assert!(ok, "the slot never came back");
}

#[test]
fn a_replay_is_capped_per_batch_and_says_so_then_continues() {
    let mut lab = lab("cap", 0x25);
    lab.run_ops(1);
    lab.index().unwrap();
    lab.index().unwrap();
    lab.index().unwrap(); // three ingest rows
    let addr = lab.serve(ServeOptions {
        replay_cap: 1,
        poll_ms: 50,
        ..ServeOptions::default()
    });
    let (_, mut r) = subscribe(addr, "/events?since=i0-d0", &[]);
    assert_eq!(next(&mut r).event, "hello");
    let e1 = next(&mut r);
    assert_eq!((e1.event.as_str(), e1.id.as_str()), ("ingest", "i1-d0"));
    let t = next(&mut r);
    assert_eq!(t.event, "truncated");
    assert_eq!(data(&t)["replayCap"], 1);
    let e2 = next(&mut r);
    assert_eq!((e2.event.as_str(), e2.id.as_str()), ("ingest", "i2-d0"));
    let t2 = next(&mut r);
    assert_eq!(t2.event, "truncated");
    let e3 = next(&mut r);
    assert_eq!((e3.event.as_str(), e3.id.as_str()), ("ingest", "i3-d0"));
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
