//! Issue #480 adversarial controls — each must REFUSE, bounded, named.
//!
//!   ledger    — barrier-controlled concurrent reservations: accepted total
//!               NEVER exceeds authorized, at zero, one-below/at/above cap,
//!               and near u64::MAX (deterministic, no timing luck)
//!   wire      — concurrent wire fetches against a budget for exactly K:
//!               exactly K succeed, the rest 402, spent == K×size
//!   memory    — a hostile peer cannot grow the client past its cap: huge
//!               declared length, lying-small length with 100× stream,
//!               header flood, no terminator, missing/duplicate/malformed
//!               Content-Length, trickle stall (deadline), interrupted body
//!   symlink   — a planted symlink in the store refuses server-side and
//!               the decoy bytes NEVER leave (server-side confidentiality
//!               guard, independent of client digest checks)
use btungsten_sovereign_rails::{
    fetch_artifact, fetch_artifact_deadlined, EgressLedger, SovereignPeer,
};
use genealogy_publication::bind_and_write;
use serde_json::json;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Barrier};
use std::time::{Duration, Instant};

fn fixture(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("bsr-adv-{}-{tag}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    let lin = dir.join("assets/profile-archive/lineage");
    fs::create_dir_all(lin.join("persons")).unwrap();
    fs::create_dir_all(lin.join("sources")).unwrap();
    let roster = json!({
        "schema": "skaists.lineage/2", "root": "founder",
        "persons": {
            "founder": {"name": "Living", "living": true, "evidence": {"era": "living"},
                        "publication": {"status": "private-stub"}, "refs": []},
            "pa": {"name": "Pat Sovereign", "living": false, "lifespan": "1900-1950",
                   "evidence": {"era": "recorded"}, "publication": {"status": "public"},
                   "refs": [{"provider": "familysearch", "id": "AAA-111"}]}
        },
        "edges": {"founder": ["pa"]}, "couples": {},
    });
    fs::write(
        lin.join("remington-bloodline.json"),
        serde_json::to_string(&roster).unwrap(),
    )
    .unwrap();
    fs::write(lin.join("sources/index.json"), "{}").unwrap();
    for rel in [
        "blood-relation-reconciliation.json",
        "staging-inventory.json",
        "attested-overlays.json",
        "identity-registry.json",
        "sources/records.json",
        "sources/images-summary.json",
        "sources/rights-qualification.json",
    ] {
        fs::write(dir.join("assets/profile-archive/lineage").join(rel), "{}").unwrap();
    }
    for id in ["founder", "pa"] {
        fs::write(
            lin.join(format!("persons/{id}.html")),
            format!("<html>{id}-sovereign-page</html>"),
        )
        .unwrap();
        fs::write(
            lin.join(format!("persons/{id}.json")),
            format!("{{\"id\":\"{id}\"}}\n"),
        )
        .unwrap();
    }
    bind_and_write(&dir).expect("fixture bind");
    dir
}

/// A hostile raw HTTP server: accepts one connection, runs the scripted
/// behavior, counts body bytes actually written, returns when done.
fn adversarial_server(behavior: fn(&mut std::net::TcpStream)) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap().to_string();
    std::thread::spawn(move || {
        if let Ok((mut s, _)) = listener.accept() {
            let mut req = [0u8; 1024];
            let _ = s.read(&mut req); // consume the GET
            behavior(&mut s);
        }
    });
    addr
}

fn send_all(s: &mut std::net::TcpStream, bytes: &[u8]) {
    let _ = s.write_all(bytes);
}

#[test]
fn ledger_concurrent_reservations_never_exceed_the_ceiling() {
    // zero budget: everything refuses
    let z = EgressLedger::new(0);
    assert!(z.reserve(1).is_err());
    // exactly at / one below / one above cap, barrier-controlled concurrency
    for (authorized, each, threads) in [(100u64, 10u64, 10usize), (99, 10, 10), (101, 10, 10)] {
        let ledger = Arc::new(EgressLedger::new(authorized));
        let barrier = Arc::new(Barrier::new(threads));
        let mut handles = vec![];
        for _ in 0..threads {
            let l = ledger.clone();
            let b = barrier.clone();
            handles.push(std::thread::spawn(move || {
                b.wait();
                l.reserve(each).is_ok()
            }));
        }
        let accepted: u64 = handles.into_iter().map(|h| h.join().unwrap() as u64).sum();
        assert!(
            ledger.spent() <= authorized,
            "spent {} exceeded authorized {authorized}",
            ledger.spent()
        );
        assert_eq!(
            ledger.spent(),
            accepted * each,
            "ledger disagrees with accepted count"
        );
        let expected_ok = authorized / each;
        assert_eq!(
            accepted, expected_ok,
            "at cap {authorized}, each {each}: exactly {expected_ok} may pass"
        );
    }
    // near u64::MAX: overflow-safe arithmetic must not wrap into acceptance
    let big = EgressLedger::new(u64::MAX - 5);
    assert!(
        big.reserve(u64::MAX).is_err(),
        "saturating reserve near u64::MAX must refuse"
    );
    assert!(big.reserve(u64::MAX - 5).is_ok());
    assert_eq!(big.spent(), u64::MAX - 5);
    assert!(big.reserve(1).is_err());
}

#[test]
fn wire_concurrency_exact_budget_enforcement() {
    let root = fixture("wire");
    let lin = root.join("assets/profile-archive/lineage");
    let size = fs::metadata(lin.join("persons/pa.html")).unwrap().len();
    let k = 3u64;
    let mut peer = SovereignPeer::new(&lin, size * k)
        .serve("127.0.0.1:0")
        .unwrap();
    let addr = peer.addr.to_string();
    let barrier = Arc::new(Barrier::new(10));
    let mut handles = vec![];
    for _ in 0..10 {
        let a = addr.clone();
        let b = barrier.clone();
        handles.push(std::thread::spawn(move || {
            b.wait();
            fetch_artifact(&a, "persons/pa.html", 1_000_000).is_ok()
        }));
    }
    let ok: u64 = handles.into_iter().map(|h| h.join().unwrap() as u64).sum();
    assert_eq!(ok, k, "exactly {k} concurrent fetches may pass the ceiling");
    assert_eq!(
        peer.ledger.spent(),
        size * k,
        "chargeable bytes never exceeded the authorization"
    );
    peer.stop();
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn hostile_peer_cannot_grow_the_client_past_its_cap() {
    // huge declared Content-Length: refused before any body byte is read
    let addr = adversarial_server(|s| {
        send_all(
            s,
            b"HTTP/1.1 200 OK\r\nContent-Length: 1073741824\r\n\r\nJUNK",
        );
    });
    let t0 = Instant::now();
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("oversized response"), "{err}");
    assert!(
        t0.elapsed() < Duration::from_secs(5),
        "refusal is immediate, not a download"
    );
    // lying-small Content-Length, then 100x the cap streamed: client stops at
    // the declared length; the excess is simply not read
    let addr = adversarial_server(|s| {
        send_all(
            s,
            b"HTTP/1.1 200 OK\r\nContent-Length: 16\r\n\r\n0123456789abcdef",
        );
        let junk = [b'X'; 65536];
        for _ in 0..200 {
            send_all(s, &junk); // 100x a 64KiB cap, ignored by the client
        }
    });
    let got = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap();
    assert_eq!(
        got.len(),
        16,
        "client read exactly the declared length, nothing more"
    );
    // header flood: no terminator, endless header bytes
    let addr = adversarial_server(|s| {
        send_all(s, b"HTTP/1.1 200 OK\r\nX-Flood: ");
        let junk = [b'H'; 4096];
        for _ in 0..100 {
            send_all(s, &junk);
        }
    });
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("no HTTP header terminator"), "{err}");
    // no Content-Length at all
    let addr = adversarial_server(|s| {
        send_all(
            s,
            b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nBODY-WITHOUT-LENGTH",
        );
    });
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("no content-length"), "{err}");
    // duplicate Content-Length
    let addr = adversarial_server(|s| {
        send_all(
            s,
            b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nContent-Length: 999\r\n\r\nABCD",
        );
    });
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("duplicate content-length"), "{err}");
    // malformed Content-Length
    let addr = adversarial_server(|s| {
        send_all(s, b"HTTP/1.1 200 OK\r\nContent-Length: nine\r\n\r\nABCD");
    });
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("malformed content-length"), "{err}");
    // trickle stall: header trickles then holds — the deadline fires
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap().to_string();
    std::thread::spawn(move || {
        if let Ok((mut s, _)) = listener.accept() {
            let mut req = [0u8; 1024];
            let _ = s.read(&mut req);
            send_all(
                &mut s,
                b"HTTP/1.1 200 OK\r\nContent-Length: 1024\r\n\r\npartial",
            );
            std::thread::sleep(Duration::from_millis(1500)); // hold the socket open
        }
    });
    let t0 = Instant::now();
    let err = fetch_artifact_deadlined(
        &addr,
        "persons/pa.html",
        64 * 1024,
        Duration::from_millis(400),
    )
    .unwrap_err();
    assert!(
        err.contains("stalled") || err.contains("interrupted"),
        "{err}"
    );
    assert!(
        t0.elapsed() < Duration::from_secs(3),
        "the deadline bounded the wait"
    );
    // interrupted body: promises 1024, closes after 7
    let addr = adversarial_server(|s| {
        send_all(s, b"HTTP/1.1 200 OK\r\nContent-Length: 1024\r\n\r\npartial");
        // drop (close) without the rest
    });
    let err = fetch_artifact(&addr, "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(err.contains("interrupted transfer"), "{err}");
    // and a correctly sized page still works through the hardening
    let root = fixture("honest");
    let lin = root.join("assets/profile-archive/lineage");
    let mut peer = SovereignPeer::new(&lin, 1_000_000)
        .serve("127.0.0.1:0")
        .unwrap();
    let got = fetch_artifact(&peer.addr.to_string(), "persons/pa.html", 64 * 1024).unwrap();
    assert!(String::from_utf8_lossy(&got).contains("sovereign-page"));
    peer.stop();
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn planted_symlink_refuses_and_never_leaks_the_decoy() {
    let root = fixture("link");
    let lin = root.join("assets/profile-archive/lineage");
    // a private decoy OUTSIDE the store, with sentinel bytes
    let decoy = root.join("private-decoy.txt");
    fs::write(&decoy, "DECOY-SECRET-BYTES-NEVER-TO-LEAK").unwrap();
    // plant a VALID-NAMED symlink inside the store pointing at the decoy
    let target = lin.join("persons/pa.html");
    fs::remove_file(&target).unwrap();
    let made = {
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_file(&decoy, &target).is_ok()
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&decoy, &target).is_ok()
        }
    };
    if !made {
        // this Windows host refuses unprivileged symlinks; CI (ubuntu)
        // creates it and exercises the refusal — the control is not skipped
        // anywhere that can create the attack
        eprintln!("symlink creation unavailable on this host — control deferred to CI ubuntu");
        let _ = fs::remove_dir_all(&root);
        return;
    }
    let mut peer = SovereignPeer::new(&lin, 1_000_000)
        .serve("127.0.0.1:0")
        .unwrap();
    let err = fetch_artifact(&peer.addr.to_string(), "persons/pa.html", 64 * 1024).unwrap_err();
    assert!(
        err.contains("peer refused (403)") && err.contains("symlink refused"),
        "{err}"
    );
    assert!(
        !err.contains("DECOY-SECRET"),
        "the decoy bytes never left the peer"
    );
    peer.stop();
    let _ = fs::remove_dir_all(&root);
}
