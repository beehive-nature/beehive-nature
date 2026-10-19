//! Authority-negative: the controller cannot acquire signing, network or
//! spending authority. Declared dependencies are exactly the four named in its
//! manifest, and no source file names a signing key, a socket or an HTTP
//! client. (Transitive capability is named: the storage engines link tokio;
//! the controller opens no socket of its own, and adapter-store's SKV-2
//! receipt covers the engines' runtime behavior.)

use std::path::Path;

#[test]
fn dependencies_are_exactly_the_named_four() {
    let manifest =
        std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")).unwrap();
    let mut deps = Vec::new();
    let mut in_deps = false;
    for line in manifest.lines() {
        let t = line.trim();
        if t.starts_with('[') {
            in_deps = t == "[dependencies]";
            continue;
        }
        if in_deps && !t.is_empty() && !t.starts_with('#') {
            deps.push(t.split(['=', ' ']).next().unwrap().to_string());
        }
    }
    deps.sort();
    assert_eq!(deps, vec!["adapter-store", "ml-dsa", "serde_json", "sha3"]);
    assert!(
        !manifest.contains("[dev-dependencies]"),
        "the tests sign with the same pinned crate"
    );
}

#[test]
fn no_source_names_a_key_a_socket_or_a_client() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    let mut stack = vec![src];
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(d).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                stack.push(p);
            } else {
                files.push(p);
            }
        }
    }
    assert!(files.len() >= 10);
    let forbidden = [
        "SigningKey",
        "try_sign",
        "std::net",
        "TcpStream",
        "UdpSocket",
        "TcpListener",
        "reqwest",
        "hyper",
        "ureq",
    ];
    for f in files {
        let text = std::fs::read_to_string(&f).unwrap();
        for word in forbidden {
            assert!(!text.contains(word), "{} names {word}", f.display());
        }
    }
}
