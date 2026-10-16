//! SKV-3 (sovereignty), executable leg: the seam CANNOT acquire identity,
//! signing or settlement authority. This is a NEGATIVE capability proof at
//! the levels a test can actually observe:
//!
//! 1. Dependency surface — the crate's manifest declares exactly the
//!    embedded-storage set (rusqlite; optional surrealkv + tokio). No
//!    signing, identity, settlement or network-client crate is linked by
//!    the seam's own declaration.
//! 2. Source surface — the seam's source contains no network or key
//!    tokens: it cannot reach the network or handle key material by
//!    construction of its own code.
//!
//! Named boundaries: transitive dependencies of the engines are NOT
//! asserted here (surrealkv links tokio with IO enabled — a transitive
//! capability; the runtime behavior is covered by the SKV-2 denial and
//! socket-observation receipts). Authority itself is architectural law,
//! not a runtime claim: storage retains bytes; BNROSE governs authority
//! (founder ruling 2026-10-13). No test can prove an absence of future
//! code; this one convicts any regression of the surface.

const MANIFEST: &str = include_str!("../Cargo.toml");
const SOURCES: [&str; 4] = [
    include_str!("../src/lib.rs"),
    include_str!("../src/sqlite.rs"),
    include_str!("../src/surrealkv.rs"),
    include_str!("../src/bin/skv-child.rs"),
];

const ALLOWED_DEPS: [&str; 3] = ["rusqlite", "surrealkv", "tokio"];
const FORBIDDEN_SOURCE_TOKENS: [&str; 6] = [
    "TcpStream",
    "UdpSocket",
    "to_socket_addrs",
    "lookup_host",
    "signing_key",
    "secret_key",
];

fn declared_deps() -> Vec<String> {
    let mut in_deps = false;
    let mut deps = Vec::new();
    for line in MANIFEST.lines() {
        let t = line.trim();
        if t.starts_with('[') {
            in_deps = t == "[dependencies]";
            continue;
        }
        if in_deps && !t.is_empty() && !t.starts_with('#') {
            if let Some(name) = t.split('=').next() {
                deps.push(name.trim().to_string());
            }
        }
    }
    deps
}

#[test]
fn skv3_no_authority_or_network_surface() {
    let deps = declared_deps();
    assert!(!deps.is_empty(), "manifest parse produced no deps");
    let unexpected: Vec<_> = deps
        .iter()
        .filter(|d| !ALLOWED_DEPS.contains(&d.as_str()))
        .collect();
    assert!(
        unexpected.is_empty(),
        "seam declares non-storage dependencies: {unexpected:?}"
    );

    let mut hits = Vec::new();
    for (i, src) in SOURCES.iter().enumerate() {
        for token in FORBIDDEN_SOURCE_TOKENS {
            if src.contains(token) {
                hits.push(format!("source[{i}] contains {token}"));
            }
        }
    }
    assert!(
        hits.is_empty(),
        "seam source carries forbidden surface: {hits:?}"
    );

    println!(
        "SKV3-RECEIPT deps={:?} forbidden_tokens=0 sources_scanned={} authority=bytes-only (BNROSE governs authority; transitive engine capability covered by SKV-2 receipts) verdict=PASS",
        deps,
        SOURCES.len()
    );
}
