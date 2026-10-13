//! The edge end to end. Signers are throwaway ML-DSA-65 keys (fips204 keygen
//! from fixed seeds) with throwaway SLH-DSA-SHAKE-256f succession keys, so
//! every bzpq1 id is derived the whole way (SPEC-BPQ-1 §2). No real key, no
//! network: the rails are an in-memory mock.
//!
//! The second verifier is the real `bsigner` when KEYS_DOOR_BSIGNER names
//! its binary. The tests that exist to exercise it (and the bpq.js vectors)
//! FAIL without it: a skipped gate is not a pass. The other tests then fall
//! back to a test-only stub that repeats the in-process verdict.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, RwLock};

use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
use fips204::ml_dsa_65;
use fips204::traits::{KeyGen as _, SerDes as _, Signer as _};
use fips205::slh_dsa_shake_256f;
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tower::ServiceExt;

use crate::b64::{b64_std, b64u, unb64u};
use crate::canon;
use crate::config::Config;
use crate::door::{offline_verdict, Door};
use crate::pq::{self, DetachedSig, SigFile};
use crate::record::{
    parse_envelope, parse_record, Envelope, FileEntry, Hints, Pack, Record, Refusal, Source, BUILD,
    ENVELOPE, KIND, SCHEMA,
};
use crate::server::{health_router, router, Health, Shared, SharedRef};
use crate::sources::{self, Http};
use crate::store::{Store, MAX_EVIDENCE};
use crate::verify::{Second, Verifiers};

const ORIGIN: &str = "https://keys.skaists.dev";
const RP: &str = "keys.skaists.dev";
const COMMIT: &str = "38c394fac7e9ad1b70b87b3b95e6702fd4b5c244";
const PEER: &str = "https://peer.test";
const ANT: &str = "https://ant.test";
const AR: &str = "https://ar.test";
const AT: &str = "2026-10-12T00:00:00Z";

// ---------------------------------------------------------------------------
// throwaway signers

struct Key {
    sk: ml_dsa_65::PrivateKey,
    dsa: Vec<u8>,
    succ: [u8; 32],
    id: String,
}

fn key(n: usize) -> &'static Key {
    static KEYS: [OnceLock<Key>; 3] = [const { OnceLock::new() }; 3];
    KEYS[n].get_or_init(|| {
        let b = n as u8;
        let (pk, sk) = ml_dsa_65::KG::keygen_from_seed(&[b + 1; 32]);
        let (slh, _) = <slh_dsa_shake_256f::KG as fips205::traits::KeyGen>::keygen_with_seeds(
            &[b + 11; 32],
            &[b + 21; 32],
            &[b + 31; 32],
        );
        let succ = pq::succession_commit(&fips205::traits::SerDes::into_bytes(slh));
        let dsa = pk.into_bytes().to_vec();
        let id = pq::id_from(&dsa, &succ).expect("fixed lengths");
        Key { sk, dsa, succ, id }
    })
}

fn sign(k: &Key, file: &[u8]) -> DetachedSig {
    let fh = pq::sha3(&[file]);
    let msg = pq::detached_message(&k.id, AT, file.len() as u64, &fh);
    let sig = k.sk.try_sign_with_seed(&[9; 32], &msg, &[]).expect("signs");
    DetachedSig {
        at: AT.into(),
        bpq: 1,
        dsa: b64u(&k.dsa),
        file: SigFile {
            sha3: b64u(&fh),
            size: file.len() as u64,
        },
        id: k.id.clone(),
        kind: "detached".into(),
        sig: b64u(&sig),
        succ: b64u(&k.succ),
    }
}

// ---------------------------------------------------------------------------
// releases and envelopes

struct Rel {
    record: Record,
    bytes: Vec<u8>,
    sha3: [u8; 32],
    pack: Vec<u8>,
}

fn sha256_b64u(b: &[u8]) -> String {
    b64u(&Sha256::digest(b))
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn release(seq: u64, prev: Option<&Rel>, signers: &[&Key], tag: &str) -> Rel {
    let files: Vec<(&str, Vec<u8>)> = vec![
        (
            "index.html",
            format!("<!doctype html><title>{tag}</title>\n").into_bytes(),
        ),
        ("keychain.js", format!("// keychain {tag}\n").into_bytes()),
        (
            "vendor/bzdid-key.js",
            format!("// vendor {tag}\n").into_bytes(),
        ),
    ];
    let pack: Vec<u8> = files.iter().flat_map(|(_, b)| b.clone()).collect();
    let mut ids: Vec<String> = signers.iter().map(|k| k.id.clone()).collect();
    ids.sort();
    let record = Record {
        files: files
            .iter()
            .map(|(p, b)| FileEntry {
                path: p.to_string(),
                sha256: sha256_b64u(b),
                sha3: b64u(&pq::sha3(&[b])),
                size: b.len() as u64,
            })
            .collect(),
        kind: KIND.into(),
        origin: ORIGIN.into(),
        pack: Pack {
            sha256: sha256_b64u(&pack),
            sha3: b64u(&pq::sha3(&[&pack])),
            size: pack.len() as u64,
        },
        prev: prev.map(|p| b64u(&p.sha3)),
        rp_id: RP.into(),
        schema: SCHEMA.into(),
        seq,
        signers: ids,
        source: Source {
            build: BUILD.into(),
            commit: COMMIT.into(),
            repo: "beehive-nature/beehive-nature".into(),
        },
    };
    rel(record, pack)
}

fn rel(record: Record, pack: Vec<u8>) -> Rel {
    let bytes = record.canonical_bytes();
    Rel {
        sha3: pq::sha3(&[&bytes]),
        record,
        bytes,
        pack,
    }
}

/// The ANT address the mock door stores a release's pack under.
fn ant_addr(r: &Rel) -> String {
    hex(&Sha256::digest(&r.pack))
}

fn envelope_with(record: &[u8], sig: &DetachedSig, hints: Hints) -> Vec<u8> {
    serde_json::to_vec(&Envelope {
        bnr: ENVELOPE.into(),
        hints,
        record: b64u(record),
        sig: sig.clone(),
    })
    .expect("serializes")
}

/// An envelope signed by `k`, hinting the ANT address of its pack.
fn envelope(r: &Rel, k: &Key) -> Vec<u8> {
    let hints = Hints {
        ant: Some(ant_addr(r)),
        ..Hints::default()
    };
    envelope_with(&r.bytes, &sign(k, &r.bytes), hints)
}

// ---------------------------------------------------------------------------
// the mock rails

#[derive(Default)]
struct MockInner {
    gets: HashMap<String, Vec<u8>>,
    posts: HashMap<String, Vec<u8>>,
    calls: Vec<String>,
}

#[derive(Default, Clone)]
struct Mock(Arc<Mutex<MockInner>>);

impl Mock {
    fn get_ok(&self, url: &str, body: Vec<u8>) {
        self.0.lock().unwrap().gets.insert(url.into(), body);
    }
    /// The source at `url` goes quiet (404 from now on).
    fn get_gone(&self, url: &str) {
        self.0.lock().unwrap().gets.remove(url);
    }
    fn post_ok(&self, url: &str, body: Vec<u8>) {
        self.0.lock().unwrap().posts.insert(url.into(), body);
    }
    fn calls(&self) -> Vec<String> {
        self.0.lock().unwrap().calls.clone()
    }
    fn answer(map: &HashMap<String, Vec<u8>>, url: &str, limit: u64) -> Result<Vec<u8>, String> {
        match map.get(url) {
            Some(b) if b.len() as u64 <= limit => Ok(b.clone()),
            Some(_) => Err("body over limit".into()),
            None => Err("HTTP 404".into()),
        }
    }
}

impl Http for Mock {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, String> {
        let mut m = self.0.lock().unwrap();
        m.calls.push(format!("GET {url}"));
        Mock::answer(&m.gets, url, limit)
    }
    fn post_json(&self, url: &str, body: &[u8], limit: u64) -> Result<Vec<u8>, String> {
        let mut m = self.0.lock().unwrap();
        m.calls
            .push(format!("POST {url} {}", String::from_utf8_lossy(body)));
        Mock::answer(&m.posts, url, limit)
    }
}

// ---------------------------------------------------------------------------
// fixture

fn bsigner_env() -> Option<PathBuf> {
    std::env::var_os("KEYS_DOOR_BSIGNER").map(PathBuf::from)
}

fn verifiers(scratch: &Path) -> Verifiers {
    match bsigner_env() {
        Some(p) => Verifiers::new(p.to_str().expect("utf-8 path"), scratch)
            .expect("KEYS_DOOR_BSIGNER names a runnable bsigner"),
        None => Verifiers::with_second(
            Second::Stub(|s, f| pq::precheck(s, f).is_ok_and(|p| pq::fips204_ok(&p))),
            scratch,
        ),
    }
}

fn real_verifiers(scratch: &Path) -> Verifiers {
    let p = bsigner_env().expect(
        "KEYS_DOOR_BSIGNER is not set: this test exists to run the real bsigner subprocess, and a skipped gate is not a pass",
    );
    Verifiers::new(p.to_str().expect("utf-8 path"), scratch).expect("a runnable bsigner")
}

struct Fx {
    dir: PathBuf,
    cfg: Config,
    http: Mock,
    shared: SharedRef,
}

fn tmpdir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("keys-door-test-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("inbox")).unwrap();
    fs::create_dir_all(dir.join("scratch")).unwrap();
    dir
}

fn fx_pinned(name: &str, genesis_sha3: [u8; 32], signers: &[String]) -> Fx {
    let dir = tmpdir(name);
    let cfg = Config {
        origin: ORIGIN.into(),
        rp_id: RP.into(),
        genesis_sha3: b64u(&genesis_sha3),
        genesis_signers: signers.to_vec(),
        min_seq: 1,
        state_dir: dir.join("state"),
        inbox_dir: dir.join("inbox"),
        listen: "127.0.0.1:0".parse().unwrap(),
        health_listen: "127.0.0.1:0".parse().unwrap(),
        bsigner_path: String::new(),
        poll_secs: 60,
        arweave_gateways: vec![],
        arweave_owners: vec![],
        ant_doors: vec![ANT.into()],
        peers: vec![PEER.into()],
    };
    cfg.validate().expect("a valid test config");
    Fx {
        dir,
        cfg,
        http: Mock::default(),
        shared: Arc::new(RwLock::new(Shared::default())),
    }
}

fn fx(name: &str, genesis: &Rel, signers: &[&Key]) -> Fx {
    let ids: Vec<String> = signers.iter().map(|k| k.id.clone()).collect();
    fx_pinned(name, genesis.sha3, &ids)
}

impl Fx {
    fn door(&self) -> Door {
        self.door_with(verifiers(&self.dir.join("scratch")))
    }
    fn door_with(&self, v: Verifiers) -> Door {
        Door::new(
            self.cfg.clone(),
            v,
            Box::new(self.http.clone()),
            self.shared.clone(),
        )
    }
    /// A restarted edge on the same disk: fresh memory, fresh serving state.
    fn restart(&mut self) -> Door {
        self.shared = Arc::new(RwLock::new(Shared::default()));
        let mut d = self.door();
        d.load();
        d
    }
    fn inbox(&self, name: &str, bytes: &[u8]) {
        fs::write(self.cfg.inbox_dir.join(name), bytes).unwrap();
    }
    /// Put a release's pack on the mock ANT door, under its hinted address.
    fn offer(&self, r: &Rel) {
        let body = serde_json::to_vec(&json!({ "data": b64_std(&r.pack) })).unwrap();
        self.http
            .get_ok(&format!("{ANT}/v1/data/public/{}", ant_addr(r)), body);
    }
    fn health(&self) -> Health {
        self.shared.read().unwrap().health.clone()
    }
    fn store(&self) -> Store {
        Store::new(&self.cfg.state_dir)
    }
}

impl Drop for Fx {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.dir);
    }
}

fn noted(door: &Door, needle: &str) -> bool {
    door.notes().iter().any(|n| n.contains(needle))
}

async fn call(app: axum::Router, method: &str, path: &str) -> (StatusCode, HeaderMap, Vec<u8>) {
    let resp = app
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let (status, headers) = (resp.status(), resp.headers().clone());
    let body = resp
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes()
        .to_vec();
    (status, headers, body)
}

fn block_on<F: std::future::Future>(f: F) -> F::Output {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
        .block_on(f)
}

// ---------------------------------------------------------------------------
// §1: the record parser

#[test]
fn record_parse_refuses_every_other_spelling() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    assert_eq!(parse_record(&g.bytes).unwrap(), g.record);
    let text = String::from_utf8(g.bytes.clone()).unwrap();
    let refused = |b: &[u8]| parse_record(b).unwrap_err().name();

    let spaced = text.replacen("\"kind\":", "\"kind\": ", 1);
    assert_eq!(refused(spaced.as_bytes()), "non_canonical");
    let swapped = text.replacen(
        "\"rp_id\":\"keys.skaists.dev\",\"schema\":\"bnr.keychain-release/1\"",
        "\"schema\":\"bnr.keychain-release/1\",\"rp_id\":\"keys.skaists.dev\"",
        1,
    );
    assert_ne!(swapped, text);
    assert_eq!(refused(swapped.as_bytes()), "non_canonical");
    let dup = text.replacen(
        "\"kind\":\"release\",",
        "\"kind\":\"release\",\"kind\":\"release\",",
        1,
    );
    assert_eq!(refused(dup.as_bytes()), "duplicate_key");
    let float = text.replacen("\"seq\":1,", "\"seq\":1.0,", 1);
    assert_eq!(refused(float.as_bytes()), "malformed");
    let escaped = text.replacen("vendor/bzdid", "vendor\\/bzdid", 1);
    assert_eq!(refused(escaped.as_bytes()), "non_canonical");
    assert_eq!(refused(format!("{text}\n").as_bytes()), "not_ascii");

    // canonical, but a field the record does not have: deny_unknown_fields
    let mut v = canon::check(&g.bytes).unwrap();
    let canon::Value::Obj(m) = &mut v else {
        panic!("an object")
    };
    m.insert("extra".into(), canon::Value::Int(1));
    assert_eq!(refused(&canon::to_bytes(&v).unwrap()), "unknown_field");
    // canonical, but prev is absent rather than null
    let mut v = canon::check(&g.bytes).unwrap();
    let canon::Value::Obj(m) = &mut v else {
        panic!("an object")
    };
    m.remove("prev");
    assert_eq!(refused(&canon::to_bytes(&v).unwrap()), "missing_field");
}

#[test]
fn record_value_rules() {
    let (k1, k2) = (key(0), key(1));
    let g = release(1, None, &[k1], "g");
    let r2 = release(2, Some(&g), &[k1, k2], "r2");
    assert!(parse_record(&r2.bytes).is_ok());
    let verdict = |f: &dyn Fn(&mut Record)| {
        let mut r = r2.record.clone();
        f(&mut r);
        match parse_record(&r.canonical_bytes()) {
            Ok(_) => "accepted",
            Err(e) => e.name(),
        }
    };
    assert_eq!(verdict(&|r| r.prev = None), "bad_field");
    assert_eq!(verdict(&|r| r.seq = 0), "bad_field");
    assert_eq!(verdict(&|r| r.files.swap(0, 1)), "bad_field");
    assert_eq!(
        verdict(&|r| r.files[2].path = "vendor/../x.js".into()),
        "bad_field"
    );
    assert_eq!(
        verdict(&|r| r.files[2].path = "/abs.js".into()),
        "bad_field"
    );
    assert_eq!(
        verdict(&|r| {
            let mut c = r.files[0].clone();
            c.path = "CNAME".into();
            r.files.insert(0, c);
            r.pack.size += r.files[0].size;
        }),
        "bad_field"
    );
    assert_eq!(verdict(&|r| r.pack.size += 1), "bad_field");
    assert_eq!(verdict(&|r| r.signers.reverse()), "bad_field");
    assert_eq!(
        verdict(&|r| r.signers[1] = r.signers[0].clone()),
        "bad_field"
    );
    assert_eq!(verdict(&|r| r.signers.clear()), "bad_field");
    assert_eq!(
        verdict(&|r| r.source.build = "node scripts/build-keychain.mjs --out DIR --origin X".into()),
        "bad_field"
    );
    assert_eq!(
        verdict(&|r| r.source.commit = COMMIT.to_uppercase()),
        "bad_field"
    );
    assert_eq!(
        verdict(&|r| r.schema = "bnr.keychain-release/2".into()),
        "config_mismatch"
    );
    assert_eq!(verdict(&|r| r.kind = "law".into()), "config_mismatch");

    let mut seq1 = g.record.clone();
    seq1.prev = Some(b64u(&[0; 32]));
    assert_eq!(
        parse_record(&seq1.canonical_bytes()).unwrap_err().name(),
        "bad_field"
    );
}

#[test]
fn envelope_is_strict_and_matches_the_config() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let env = envelope(&g, k);
    assert!(parse_envelope(&env, ORIGIN, RP).is_ok());
    assert_eq!(
        parse_envelope(&env, "https://other.example", RP).unwrap_err(),
        Refusal::ConfigMismatch("origin")
    );
    assert_eq!(
        parse_envelope(&env, ORIGIN, "other.example").unwrap_err(),
        Refusal::ConfigMismatch("rp_id")
    );
    let text = String::from_utf8(env.clone()).unwrap();
    let dup = text.replacen("{\"bnr\":", "{\"bnr\":\"x\",\"bnr\":", 1);
    assert_eq!(
        parse_envelope(dup.as_bytes(), ORIGIN, RP)
            .unwrap_err()
            .name(),
        "duplicate_key"
    );
    let extra = text.replacen("{\"bnr\":", "{\"extra\":1,\"bnr\":", 1);
    assert_eq!(
        parse_envelope(extra.as_bytes(), ORIGIN, RP)
            .unwrap_err()
            .name(),
        "unknown_field"
    );
    let sig_extra = text.replacen(
        "\"kind\":\"detached\"",
        "\"kind\":\"detached\",\"note\":\"x\"",
        1,
    );
    assert_eq!(
        parse_envelope(sig_extra.as_bytes(), ORIGIN, RP)
            .unwrap_err()
            .name(),
        "unknown_field"
    );
    let big = vec![b' '; 64 * 1024 + 1];
    assert_eq!(
        parse_envelope(&big, ORIGIN, RP).unwrap_err(),
        Refusal::TooLarge
    );
    // a signer id that does not derive from the keys it carries
    let mut s = sign(k, &g.bytes);
    s.id = key(1).id.clone();
    let e = envelope_with(&g.bytes, &s, Hints::default());
    assert_eq!(
        parse_envelope(&e, ORIGIN, RP).unwrap_err(),
        Refusal::IdMismatch
    );
    let mut s = sign(k, &g.bytes);
    s.at = "2026-10-12T00:00:00Z\nx".into();
    let e = envelope_with(&g.bytes, &s, Hints::default());
    assert_eq!(
        parse_envelope(&e, ORIGIN, RP).unwrap_err(),
        Refusal::Field("sig.at")
    );
}

// ---------------------------------------------------------------------------
// §2: the id derivation and the two verifiers

#[test]
fn id_derivation_matches_the_browser_vectors() {
    let v: Value =
        serde_json::from_str(include_str!("../../../surfaces/bpq-vectors.json")).unwrap();
    let rows = v["keys"].as_array().unwrap();
    assert!(!rows.is_empty());
    for row in rows {
        let dsa = unb64u(row["dsaPublicKey"].as_str().unwrap()).unwrap();
        let slh = unb64u(row["slhPublicKey"].as_str().unwrap()).unwrap();
        let succ = pq::succession_commit(&slh);
        assert_eq!(b64u(&succ), row["successionCommit"].as_str().unwrap());
        let id = pq::id_from(&dsa, &succ).unwrap();
        assert_eq!(id, row["id"].as_str().unwrap());
        assert!(pq::is_bzpq_id(&id));
        assert!(!pq::is_bzpq_id(&id.to_uppercase()));
    }
    // and the throwaway test signers derive theirs the same way
    let k = key(0);
    assert!(k.id.starts_with("bzpq1") && pq::is_bzpq_id(&k.id));
}

#[test]
fn an_empty_bsigner_path_refuses_to_serve() {
    let dir = tmpdir("nobsigner");
    let e = Verifiers::new("", &dir).unwrap_err();
    assert!(e.contains("two ML-DSA-65 verifiers are mandatory"), "{e}");
    assert!(Verifiers::new(dir.join("absent").to_str().unwrap(), &dir).is_err());
    assert!(Verifiers::new(dir.to_str().unwrap(), &dir).is_err());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn verifier_disagreement_is_refused_and_reported() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let fx = fx("disagree", &g, &[k]);
    let scratch = fx.dir.join("scratch");
    let p = parse_envelope(&envelope(&g, k), ORIGIN, RP).unwrap();
    let says_no = Verifiers::with_second(Second::Stub(|_, _| false), &scratch);
    let r = says_no.verify(&p).unwrap_err();
    assert_eq!(
        r,
        Refusal::Disagreement {
            fips204: true,
            bsigner: false
        }
    );
    assert_eq!(r.name(), "verifier_disagreement");
    assert!(r.to_string().starts_with("verifier disagreement"));

    let mut forged = sign(k, &g.bytes);
    let mut raw = unb64u(&forged.sig).unwrap();
    raw[7] ^= 1;
    forged.sig = b64u(&raw);
    let q = parse_envelope(
        &envelope_with(&g.bytes, &forged, Hints::default()),
        ORIGIN,
        RP,
    )
    .unwrap();
    // a second verifier that always says yes adds nothing on a valid
    // signature (rule 2 needs both to accept, and both do); only a forgery
    // shows it up, as a disagreement
    let says_yes = Verifiers::with_second(Second::Stub(|_, _| true), &scratch);
    assert_eq!(says_yes.verify(&p).unwrap(), k.id);
    assert_eq!(
        says_yes.verify(&q).unwrap_err(),
        Refusal::Disagreement {
            fips204: false,
            bsigner: true
        }
    );

    // through the door: nothing is served, and health names it
    fx.inbox("g.json", &envelope(&g, k));
    fx.offer(&g);
    let mut door = fx.door_with(says_no);
    door.poll(true);
    let h = fx.health();
    assert_eq!(h.state, "unverified");
    assert!(h.last_error.unwrap().contains("verifier disagreement"));
}

/// The same negative controls on the subprocess path, with sh scripts in
/// bsigner's place: one says yes to everything and names the id from the
/// signature file it is given, one says yes about another id.
#[cfg(unix)]
#[test]
fn a_lying_second_verifier_on_the_subprocess_path() {
    use std::os::unix::fs::PermissionsExt;
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let dir = tmpdir("liar");
    let liar = |name: &str, body: &str| {
        let path = dir.join(name);
        fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        Verifiers::new(path.to_str().unwrap(), &dir.join("scratch")).unwrap()
    };
    let echoes = liar(
        "yes-echo.sh",
        r#"id=$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' "$3")
printf '{"kind":"detached","id":"%s","verified":true}\n' "$id""#,
    );
    let other = liar(
        "yes-other.sh",
        r#"printf '{"kind":"detached","id":"bzpq1x","verified":true}\n'"#,
    );
    let p = parse_envelope(&envelope(&g, k), ORIGIN, RP).unwrap();
    let mut forged = sign(k, &g.bytes);
    let mut raw = unb64u(&forged.sig).unwrap();
    raw[7] ^= 1;
    forged.sig = b64u(&raw);
    let q = parse_envelope(
        &envelope_with(&g.bytes, &forged, Hints::default()),
        ORIGIN,
        RP,
    )
    .unwrap();

    assert_eq!(
        echoes.verify(&p).unwrap(),
        k.id,
        "not caught on a valid one"
    );
    assert_eq!(
        echoes.verify(&q).unwrap_err(),
        Refusal::Disagreement {
            fips204: false,
            bsigner: true
        },
        "caught on a forgery"
    );
    assert_eq!(
        other.verify(&p).unwrap_err(),
        Refusal::Disagreement {
            fips204: true,
            bsigner: false
        },
        "another id is a no"
    );
    let _ = fs::remove_dir_all(&dir);
}

/// Flip one bit of a base64url digit inside the record, keeping it canonical.
fn tamper(r: &Rel) -> Vec<u8> {
    let start = String::from_utf8(r.bytes.clone())
        .unwrap()
        .find(&r.record.files[0].sha3)
        .unwrap();
    let i = (start..start + 42)
        .find(|&i| (r.bytes[i] ^ 1).is_ascii_alphanumeric())
        .unwrap();
    let mut t = r.bytes.clone();
    t[i] ^= 1;
    t
}

#[test]
fn bsigner_subprocess_is_the_second_verifier() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let dir = tmpdir("bsigner");
    let v = real_verifiers(&dir.join("scratch"));
    let p = parse_envelope(&envelope(&g, k), ORIGIN, RP).unwrap();
    assert_eq!(v.outcome(&p).bsigner, Ok(true));
    assert_eq!(v.verify(&p).unwrap(), k.id);

    // one bit of the record, the signature rebound to the new bytes: only
    // ML-DSA can refuse it now, and both implementations do
    let t = tamper(&g);
    assert!(
        parse_record(&t).is_ok(),
        "the tampered record is still canonical"
    );
    let mut s = sign(k, &g.bytes);
    s.file.sha3 = b64u(&pq::sha3(&[&t]));
    let q = parse_envelope(&envelope_with(&t, &s, Hints::default()), ORIGIN, RP).unwrap();
    let o = v.outcome(&q);
    assert_eq!((o.fips204, o.bsigner.clone()), (false, Ok(false)));
    assert_eq!(v.verify(&q).unwrap_err(), Refusal::BadSignature);

    // one bit of the signature
    let mut s = sign(k, &g.bytes);
    let mut raw = unb64u(&s.sig).unwrap();
    raw[1000] ^= 0x10;
    s.sig = b64u(&raw);
    let q = parse_envelope(&envelope_with(&g.bytes, &s, Hints::default()), ORIGIN, RP).unwrap();
    assert_eq!(v.verify(&q).unwrap_err(), Refusal::BadSignature);

    // the shared browser vector (surfaces/bpq-vectors.json, made by bpq.js):
    // a detached signature over bytes i -> (i*31+7) mod 256, 4096 long
    let vecs: Value =
        serde_json::from_str(include_str!("../../../surfaces/bpq-vectors.json")).unwrap();
    let file: Vec<u8> = (0..4096u32).map(|i| ((i * 31 + 7) % 256) as u8).collect();
    let d: DetachedSig = serde_json::from_value(vecs["detached"]["signature"].clone()).unwrap();
    let o = v.check_detached(&d, &file).unwrap();
    assert_eq!((o.fips204, o.bsigner), (true, Ok(true)));
    let mut changed = file.clone();
    changed[0] ^= 1;
    assert_eq!(
        v.check_detached(&d, &changed).unwrap_err(),
        Refusal::FileMismatch
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn bpqjs_release_vector_passes_both_verifiers_and_is_served() {
    let vector: Value =
        serde_json::from_str(include_str!("../tests/vectors/bpqjs-genesis.json")).unwrap();
    let env = serde_json::to_vec(&vector["envelope"]).unwrap();
    // the record bpq.js wrote is canonical by this parser's rule
    let p = parse_envelope(&env, ORIGIN, RP).expect("the bpq.js record parses");
    let id = p.pre.id.clone();
    let fx = fx_pinned("bpqjs", p.record_sha3, std::slice::from_ref(&id));
    let v = real_verifiers(&fx.dir.join("scratch"));
    let o = v.outcome(&p);
    assert_eq!((o.fips204, o.bsigner), (true, Ok(true)));
    assert_eq!(v.verify(&p).unwrap(), id);

    // and served end to end, with the pack assembled from the vector's files
    let pack: Vec<u8> = p
        .record
        .files
        .iter()
        .flat_map(|f| unb64u(vector["files"][&f.path].as_str().unwrap()).unwrap())
        .collect();
    fx.http
        .get_ok(&format!("{PEER}/.well-known/bnr-keychain/pack"), pack);
    fx.inbox("bpqjs.json", &env);
    let mut door = fx.door_with(v);
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    let (status, _, body) = block_on(call(router(fx.shared.clone()), "GET", "/"));
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        unb64u(vector["files"]["index.html"].as_str().unwrap()).unwrap()
    );

    // the same vector with one record bit flipped and rebound: both refuse
    let t = {
        let start = String::from_utf8(p.record_bytes.clone())
            .unwrap()
            .find(&p.record.files[0].sha3)
            .unwrap();
        let i = (start..start + 42)
            .find(|&i| (p.record_bytes[i] ^ 1).is_ascii_alphanumeric())
            .unwrap();
        let mut t = p.record_bytes.clone();
        t[i] ^= 1;
        t
    };
    let mut s = p.env.sig.clone();
    s.file.sha3 = b64u(&pq::sha3(&[&t]));
    let q = parse_envelope(&envelope_with(&t, &s, Hints::default()), ORIGIN, RP).unwrap();
    let v = real_verifiers(&fx.dir.join("scratch"));
    let o = v.outcome(&q);
    assert_eq!((o.fips204, o.bsigner), (false, Ok(false)));
}

// ---------------------------------------------------------------------------
// §4: acceptance through the door, and serving

#[test]
fn genesis_is_accepted_persisted_and_served() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let fx = fx("genesis", &g, &[k]);
    let env = envelope(&g, k);
    fx.inbox("g.json", &env);
    fx.offer(&g);
    let mut door = fx.door();
    door.poll(true);
    let h = fx.health();
    assert_eq!((h.state, h.seq), ("serving", Some(1)), "{:?}", door.notes());
    assert_eq!(h.record_sha3, Some(b64u(&g.sha3)));
    assert_eq!(fx.store().floor().unwrap(), 1);
    let persisted = fx.store().load().unwrap().unwrap();
    assert_eq!(persisted.chain, vec![env.clone()]);
    assert_eq!(persisted.pack, g.pack);

    block_on(async {
        let app = router(fx.shared.clone());
        let (s, h, b) = call(app.clone(), "GET", "/").await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(b, b"<!doctype html><title>g</title>\n");
        assert_eq!(h["content-type"], "text/html; charset=utf-8");
        assert_eq!(h["cache-control"], "no-cache");
        assert_eq!(h["x-content-type-options"], "nosniff");
        assert_eq!(
            h["etag"].to_str().unwrap(),
            format!("\"{}\"", g.record.files[0].sha256)
        );
        let (s, h, b) = call(app.clone(), "GET", "/keychain.js").await;
        assert_eq!((s, b.as_slice()), (StatusCode::OK, &b"// keychain g\n"[..]));
        assert_eq!(h["content-type"], "text/javascript; charset=utf-8");
        let (s, _, b) = call(app.clone(), "GET", "/vendor/bzdid-key.js").await;
        assert_eq!((s, b.as_slice()), (StatusCode::OK, &b"// vendor g\n"[..]));
        let (s, h, b) = call(app.clone(), "HEAD", "/index.html").await;
        assert_eq!((s, b.len()), (StatusCode::OK, 0));
        assert_eq!(h["content-length"], "32");
        let (s, h, b) = call(app.clone(), "GET", "/.well-known/bnr-keychain/release").await;
        assert_eq!((s, &b), (StatusCode::OK, &env));
        assert_eq!(h["content-type"], "application/json");
        let (s, h, b) = call(app.clone(), "GET", "/.well-known/bnr-keychain/pack").await;
        assert_eq!((s, &b), (StatusCode::OK, &g.pack));
        assert_eq!(h["content-type"], "application/octet-stream");
        for m in ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"] {
            let (s, h, _) = call(app.clone(), m, "/").await;
            assert_eq!(s, StatusCode::METHOD_NOT_ALLOWED, "{m}");
            assert_eq!(h["allow"], "GET, HEAD");
        }
        for p in [
            "/nope",
            "/CNAME",
            "/.nojekyll",
            "/vendor",
            "/index.html/",
            "/.well-known/other",
        ] {
            assert_eq!(
                call(app.clone(), "GET", p).await.0,
                StatusCode::NOT_FOUND,
                "{p}"
            );
        }
        let (s, _, b) = call(health_router(fx.shared.clone()), "GET", "/health").await;
        assert_eq!(s, StatusCode::OK);
        let v: Value = serde_json::from_slice(&b).unwrap();
        assert_eq!(v["seq"], 1);
        assert_eq!(v["state"], "serving");
        assert_eq!(v["equivocation"], Value::Null);
    });
}

#[test]
fn nothing_verified_is_503() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let fx = fx("empty", &g, &[k]);
    let mut door = fx.door();
    door.poll(true);
    block_on(async {
        let app = router(fx.shared.clone());
        for p in ["/", "/index.html", "/nope"] {
            assert_eq!(
                call(app.clone(), "GET", p).await.0,
                StatusCode::SERVICE_UNAVAILABLE,
                "{p}"
            );
        }
        assert_eq!(
            call(app.clone(), "HEAD", "/").await.0,
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            call(app.clone(), "GET", "/.well-known/bnr-keychain/release")
                .await
                .0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            call(app.clone(), "POST", "/").await.0,
            StatusCode::METHOD_NOT_ALLOWED
        );
        let (s, _, b) = call(health_router(fx.shared.clone()), "GET", "/health").await;
        assert_eq!(s, StatusCode::SERVICE_UNAVAILABLE);
        let v: Value = serde_json::from_slice(&b).unwrap();
        assert_eq!(
            (v["state"].as_str(), &v["seq"]),
            (Some("unverified"), &Value::Null)
        );
        assert_eq!(
            call(health_router(fx.shared.clone()), "GET", "/other")
                .await
                .0,
            StatusCode::NOT_FOUND
        );
    });
}

#[test]
fn a_tampered_record_is_never_served() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let t = tamper(&g);
    // pin genesis on the TAMPERED bytes, as if the operator had: only the
    // signature stands between them and the edge now
    let fx = fx_pinned("tamper", pq::sha3(&[&t]), std::slice::from_ref(&k.id));
    let mut s = sign(k, &g.bytes);
    // (a) the signature still names the original bytes
    let e = envelope_with(&t, &s, Hints::default());
    assert_eq!(
        parse_envelope(&e, ORIGIN, RP).unwrap_err(),
        Refusal::FileMismatch
    );
    // (b) rebound to the tampered bytes: ML-DSA refuses
    s.file.sha3 = b64u(&pq::sha3(&[&t]));
    fx.inbox("t.json", &envelope_with(&t, &s, Hints::default()));
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    assert!(noted(&door, "bad_signature"), "{:?}", door.notes());
}

#[test]
fn an_unpinned_signer_authorizes_nothing() {
    let (k1, k2) = (key(0), key(1));
    let g = release(1, None, &[k1], "g");
    let fx = fx("unpinned", &g, &[k1]);
    // genesis signed by a key that is not a genesis signer
    fx.inbox("g.json", &envelope(&g, k2));
    fx.offer(&g);
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    assert!(
        noted(&door, "no signature by an authorized signer"),
        "{:?}",
        door.notes()
    );
    // properly signed genesis, then a seq 2 signed by a key g does not list
    fx.inbox("g.json", &envelope(&g, k1));
    let r2 = release(2, Some(&g), &[k1], "r2");
    fx.inbox("r2.json", &envelope(&r2, k2));
    fx.offer(&r2);
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    assert!(noted(&door, "seq 2 record"));
}

#[test]
fn no_jump_without_every_record_between() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    let fx = fx("jump", &g, &[k]);
    for r in [&g, &r2, &r3] {
        fx.offer(r);
    }
    fx.inbox("1.json", &envelope(&g, k));
    fx.inbox("3.json", &envelope(&r3, k));
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "3 does not link to 1");
    fx.inbox("2.json", &envelope(&r2, k));
    door.poll(true);
    assert_eq!(fx.health().seq, Some(3), "{:?}", door.notes());
    assert_eq!(fx.store().floor().unwrap(), 3);
    assert_eq!(fx.store().load().unwrap().unwrap().chain.len(), 3);
}

#[test]
fn rollback_is_refused_and_the_floor_outlives_the_state() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    let mut fx = fx("rollback", &g, &[k]);
    for r in [&g, &r2, &r3] {
        fx.offer(r);
    }
    fx.inbox("1.json", &envelope(&g, k));
    fx.inbox("2.json", &envelope(&r2, k));
    fx.inbox("3.json", &envelope(&r3, k));
    fx.door().poll(true);
    assert_eq!(fx.health().seq, Some(3));

    // restart with only 1 and 2 offered: the state still serves 3, offline
    fs::remove_file(fx.cfg.inbox_dir.join("3.json")).unwrap();
    let mut door = fx.restart();
    door.poll(false);
    assert_eq!(fx.health().seq, Some(3), "{:?}", door.notes());

    // lose the serve state: the floor (its own file) still says 3, so 2 is refused
    fs::remove_file(fx.cfg.state_dir.join("serve.json")).unwrap();
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    assert!(noted(&door, "below the floor 3"), "{:?}", door.notes());
    fx.inbox("3.json", &envelope(&r3, k));
    door.poll(true);
    assert_eq!(fx.health().seq, Some(3));

    // a configured min_seq is a floor too
    let mut low = fx_pinned("minseq", g.sha3, std::slice::from_ref(&k.id));
    low.cfg.min_seq = 2;
    low.inbox("1.json", &envelope(&g, k));
    low.offer(&g);
    let mut door = low.door();
    door.poll(true);
    assert_eq!(low.health().state, "unverified");
    assert!(noted(&door, "below the floor 2"));
}

#[test]
fn equivocation_stops_the_edge_until_a_successor_picks_a_branch() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let a2 = release(2, Some(&g), &[k], "a2");
    let b2 = release(2, Some(&g), &[k], "b2");
    let fx = fx("equivocation", &g, &[k]);
    for r in [&g, &a2, &b2] {
        fx.offer(r);
        fx.inbox(&format!("{}.json", b64u(&r.sha3)), &envelope(r, k));
    }
    let mut door = fx.door();
    door.poll(true);
    let h = fx.health();
    assert_eq!(h.seq, Some(1), "neither branch is taken");
    let mut both = vec![b64u(&a2.sha3), b64u(&b2.sha3)];
    both.sort();
    assert_eq!(
        h.equivocation.as_ref().map(|e| (e.seq, e.records.clone())),
        Some((2, both))
    );

    let r3 = release(3, Some(&b2), &[k], "r3");
    fx.offer(&r3);
    fx.inbox("r3.json", &envelope(&r3, k));
    door.poll(true);
    let h = fx.health();
    assert_eq!(
        (h.seq, h.equivocation),
        (Some(3), None),
        "{:?}",
        door.notes()
    );
    let chain = fx.store().load().unwrap().unwrap().chain;
    let second = parse_envelope(&chain[1], ORIGIN, RP).unwrap();
    assert_eq!(second.record_sha3, b2.sha3, "the branch r3 selects won");
}

/// The fork outlives the sources that showed it: a peer serves only its
/// current envelope, so once it moves from b2 to b3 no source offers b2,
/// and a2 alone must not be taken. Only the kept evidence still holds b2.
#[test]
fn an_equivocation_is_remembered_after_its_sources_go_quiet() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let a2 = release(2, Some(&g), &[k], "a2");
    let b2 = release(2, Some(&g), &[k], "b2");
    let b3 = release(3, Some(&b2), &[k], "b3");
    let b4 = release(4, Some(&b3), &[k], "b4");
    let mut fx = fx("equivocation-memory", &g, &[k]);
    for r in [&g, &a2, &b2, &b3, &b4] {
        fx.offer(r);
    }
    let peer = format!("{PEER}{}", sources::RELEASE_PATH);
    fx.inbox("1.json", &envelope(&g, k));
    fx.inbox("a2.json", &envelope(&a2, k));
    fx.http.get_ok(&peer, envelope(&b2, k));
    let mut door = fx.door();
    door.poll(true);
    let fork = |fx: &Fx| {
        let h = fx.health();
        (h.seq, h.equivocation.map(|e| e.seq))
    };
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());

    // the peer goes quiet for a poll: a2 is the only seq 2 any source offers
    fx.http.get_gone(&peer);
    door.poll(true);
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());
    // and a restarted edge remembers it too (state_dir/evidence)
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());

    // the peer moves on to b3, whose prev selects b2: that branch wins
    fx.http.get_ok(&peer, envelope(&b3, k));
    door.poll(true);
    assert_eq!(fork(&fx), (Some(3), None), "{:?}", door.notes());
    let chain = fx.store().load().unwrap().unwrap().chain;
    let second = parse_envelope(&chain[1], ORIGIN, RP).unwrap();
    assert_eq!(
        second.record_sha3, b2.sha3,
        "the branch b3 selects, never a2"
    );

    // evidence that does not hash to its name is never read as none: no
    // new release is accepted, and the one already served stays served
    let kept = fx.cfg.state_dir.join("evidence");
    let one = fs::read_dir(&kept).unwrap().next().unwrap().unwrap().path();
    fs::write(&one, b"junk").unwrap();
    fx.http.get_ok(&peer, envelope(&b4, k));
    door.poll(true);
    let h = fx.health();
    assert_eq!((h.seq, h.state), (Some(3), "serving"), "{:?}", door.notes());
    assert!(
        h.last_error.unwrap().contains("refusing every new release"),
        "{:?}",
        door.notes()
    );
    assert_eq!(
        block_on(call(router(fx.shared.clone()), "GET", "/")).0,
        StatusCode::OK
    );
}

/// A fork the edge has no room to remember is one it could forget, so a
/// full evidence store holds the edge where it is.
#[test]
fn a_full_evidence_store_holds_the_edge() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let a2 = release(2, Some(&g), &[k], "a2");
    let b2 = release(2, Some(&g), &[k], "b2");
    let b3 = release(3, Some(&b2), &[k], "b3");
    let fx = fx("evidence-full", &g, &[k]);
    let kept = fx.cfg.state_dir.join("evidence");
    fs::create_dir_all(&kept).unwrap();
    for i in 0..MAX_EVIDENCE {
        let junk = format!("junk {i}").into_bytes();
        fs::write(kept.join(b64u(&pq::sha3(&[&junk]))), junk).unwrap();
    }
    for r in [&g, &a2, &b2, &b3] {
        fx.offer(r);
        fx.inbox(&format!("{}.json", b64u(&r.sha3)), &envelope(r, k));
    }
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());
    assert!(noted(&door, "evidence is full"), "{:?}", door.notes());
}

#[test]
fn bytes_must_hash_to_what_the_record_names() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let fx = fx("bytes", &g, &[k]);
    fx.inbox(
        "g.json",
        &envelope_with(&g.bytes, &sign(k, &g.bytes), Hints::default()),
    );
    // a truncated pack from the peer
    let pack_url = format!("{PEER}/.well-known/bnr-keychain/pack");
    fx.http
        .get_ok(&pack_url, g.pack[..g.pack.len() - 1].to_vec());
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    assert!(noted(&door, "pack mismatch"), "{:?}", door.notes());
    // same length, one byte changed
    let mut flipped = g.pack.clone();
    flipped[3] ^= 1;
    fx.http.get_ok(&pack_url, flipped);
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    fx.http.get_ok(&pack_url, g.pack.clone());
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1));

    // a record whose pack hashes hold but one file's hash is wrong
    let mut bad = g.record.clone();
    bad.files[1].sha3 = b64u(&pq::sha3(&[b"other bytes"]));
    let bad = rel(bad, g.pack.clone());
    let fx2 = self::fx("filehash", &bad, &[k]);
    fx2.inbox("bad.json", &envelope(&bad, k));
    fx2.offer(&bad);
    let mut door = fx2.door();
    door.poll(true);
    assert_eq!(fx2.health().state, "unverified");
    assert!(
        noted(&door, "file keychain.js does not match its hashes"),
        "{:?}",
        door.notes()
    );
}

#[test]
fn a_corrupt_state_is_discarded_and_answers_503() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let mut fx = fx("corrupt", &g, &[k]);
    fx.inbox("g.json", &envelope(&g, k));
    fx.offer(&g);
    fx.door().poll(true);
    assert_eq!(fx.health().seq, Some(1));
    fs::remove_file(fx.cfg.inbox_dir.join("g.json")).unwrap();
    let serve = fx.cfg.state_dir.join("serve.json");
    let good = fs::read(&serve).unwrap();

    fs::write(
        &serve,
        b"{\"chain\":[\"not base64!\"],\"pack\":\"x\",\"v\":1}",
    )
    .unwrap();
    let mut door = fx.restart();
    door.poll(false);
    let h = fx.health();
    assert_eq!(h.state, "unverified");
    assert!(
        h.last_error.unwrap_or_default().contains("discarded"),
        "{:?}",
        door.notes()
    );
    assert_eq!(
        block_on(call(router(fx.shared.clone()), "GET", "/")).0,
        StatusCode::SERVICE_UNAVAILABLE
    );

    // a pack file that does not hash to its name
    fs::write(&serve, &good).unwrap();
    let packs = fx.cfg.state_dir.join("packs");
    let pack_file = fs::read_dir(&packs)
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    fs::write(&pack_file, b"junk").unwrap();
    let mut door = fx.restart();
    door.poll(false);
    assert_eq!(fx.health().state, "unverified");
    assert!(noted(&door, "does not match its name"));

    // an envelope in the state that no longer verifies
    fs::write(&pack_file, &g.pack).unwrap();
    let mut env: Value = serde_json::from_slice(&envelope(&g, k)).unwrap();
    env["sig"]["sig"] = json!(b64u(&[0u8; 3309]));
    let state = json!({"chain": [b64u(&serde_json::to_vec(&env).unwrap())], "pack": b64u(&pq::sha3(&[&g.pack])), "v": 1});
    fs::write(&serve, serde_json::to_vec(&state).unwrap()).unwrap();
    let mut door = fx.restart();
    door.poll(false);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());

    // and the good state serves again
    fs::write(&serve, &good).unwrap();
    let mut door = fx.restart();
    door.poll(false);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
}

#[test]
fn the_floor_only_rises_and_a_corrupt_floor_refuses_every_new_release() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let fx = fx("floor", &g, &[k]);
    let store = fx.store();
    assert_eq!(store.floor().unwrap(), 0);
    assert_eq!(store.raise_floor(5).unwrap(), 5);
    assert_eq!(store.raise_floor(3).unwrap(), 5);
    assert_eq!(fs::read(fx.cfg.state_dir.join("floor")).unwrap(), b"5\n");
    for junk in [
        &b"x\n"[..],
        b"05\n",
        b"5",
        b"",
        b"-1\n",
        b"99999999999999999999\n",
    ] {
        fs::write(fx.cfg.state_dir.join("floor"), junk).unwrap();
        assert!(
            store.floor().is_err(),
            "{:?}",
            String::from_utf8_lossy(junk)
        );
    }
    // nothing served yet: nothing is, so 503
    fx.inbox("g.json", &envelope(&g, k));
    fx.offer(&g);
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified");
    assert!(fx.health().last_error.unwrap().contains("floor"));

    // a running edge whose floor turns corrupt accepts nothing new; what
    // it serves stays served (it was accepted while the floor could be read)
    let floor = fx.cfg.state_dir.join("floor");
    fs::write(&floor, b"1\n").unwrap();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    fx.inbox("r2.json", &envelope(&r2, k));
    fx.offer(&r2);
    fs::write(&floor, b"x\n").unwrap();
    door.poll(true);
    let h = fx.health();
    assert_eq!((h.seq, h.state), (Some(1), "serving"), "{:?}", door.notes());
    assert!(h
        .last_error
        .unwrap()
        .contains("is corrupt: refusing every new release"));
    let (s, _, b) = block_on(call(router(fx.shared.clone()), "GET", "/"));
    assert_eq!(
        (s, b.as_slice()),
        (StatusCode::OK, &b"<!doctype html><title>g</title>\n"[..])
    );
}

/// Rails that turn the floor file into a directory the first time a pack
/// is fetched from an ANT door: the floor reads fine when the poll starts
/// and cannot be raised when the swap comes.
struct FloorBreaker {
    rails: Mock,
    floor: PathBuf,
    armed: Arc<AtomicBool>,
}

impl Http for FloorBreaker {
    fn get(&self, url: &str, limit: u64) -> Result<Vec<u8>, String> {
        if url.contains("/v1/data/public/") && self.armed.swap(false, Ordering::SeqCst) {
            let _ = fs::remove_file(&self.floor);
            fs::create_dir_all(self.floor.join("blocked")).unwrap();
        }
        self.rails.get(url, limit)
    }
    fn post_json(&self, url: &str, body: &[u8], limit: u64) -> Result<Vec<u8>, String> {
        self.rails.post_json(url, body, limit)
    }
}

/// Rule 4's floor is raised before a release is persisted or served, so
/// the served seq is never above the floor on disk: a floor that cannot
/// be raised means no swap at all, never a release served over a stale
/// floor that a lost serve state would let a rollback through.
#[test]
fn the_floor_is_raised_before_a_release_is_served() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let fx = fx("floor-first", &g, &[k]);
    let floor = fx.cfg.state_dir.join("floor");
    let armed = Arc::new(AtomicBool::new(false));
    let rails = FloorBreaker {
        rails: fx.http.clone(),
        floor: floor.clone(),
        armed: armed.clone(),
    };
    let mut door = Door::new(
        fx.cfg.clone(),
        verifiers(&fx.dir.join("scratch")),
        Box::new(rails),
        fx.shared.clone(),
    );
    fx.inbox("1.json", &envelope(&g, k));
    fx.offer(&g);
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());

    fx.inbox("2.json", &envelope(&r2, k));
    fx.offer(&r2);
    armed.store(true, Ordering::SeqCst);
    door.poll(true);
    assert!(noted(&door, "not swapped: floor"), "{:?}", door.notes());
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    assert_eq!(
        fx.store().load().unwrap().unwrap().chain.len(),
        1,
        "nothing on disk names seq 2"
    );

    // repaired: the next poll raises the floor to 2, then serves 2
    fs::remove_dir_all(&floor).unwrap();
    fs::write(&floor, b"1\n").unwrap();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(2), "{:?}", door.notes());
    assert_eq!(fx.store().floor().unwrap(), 2);
}

/// A member edge serves its current envelope and its pack (§4). That seeds
/// another edge only together with every record below the current one:
/// rule 3 never jumps, and a peer serves no record but its current one.
/// Peers alone seed a fresh edge only at genesis; past it, the records
/// below come from another rail (here the inbox; Arweave would do).
#[test]
fn a_member_edge_seeds_another_that_holds_the_records_below() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let a = fx("seed-a", &g, &[k]);
    for r in [&g, &r2] {
        a.offer(r);
        a.inbox(&format!("{}.json", r.record.seq), &envelope(r, k));
    }
    a.door().poll(true);
    assert_eq!(a.health().seq, Some(2));
    // edge B knows nothing but a peer, and A's /.well-known answers it
    let b = fx("seed-b", &g, &[k]);
    let (rel_b, pack_b) = block_on(async {
        let app = router(a.shared.clone());
        (
            call(app.clone(), "GET", "/.well-known/bnr-keychain/release")
                .await
                .2,
            call(app, "GET", "/.well-known/bnr-keychain/pack").await.2,
        )
    });
    b.http
        .get_ok(&format!("{PEER}/.well-known/bnr-keychain/release"), rel_b);
    b.http
        .get_ok(&format!("{PEER}/.well-known/bnr-keychain/pack"), pack_b);
    b.offer(&g);
    let mut door = b.door();
    door.poll(true);
    assert_eq!(
        b.health().state,
        "unverified",
        "the peer alone cannot seed past genesis"
    );
    b.inbox("1.json", &envelope(&g, k));
    door.poll(true);
    assert_eq!(b.health().seq, Some(2), "{:?}", door.notes());
}

// ---------------------------------------------------------------------------
// the rails

#[test]
fn ant_door_answers_are_strict() {
    let mock = Mock::default();
    let data = b"hello ant!".to_vec();
    let addr = hex(&Sha256::digest(&data));
    let url = format!("{ANT}/v1/data/public/{addr}");
    let put = |s: &str| mock.get_ok(&url, serde_json::to_vec(&json!({ "data": s })).unwrap());
    put(&b64_std(&data));
    assert_eq!(sources::ant_get(&mock, ANT, &addr, 10).unwrap(), data);
    assert!(
        sources::ant_get(&mock, ANT, &addr, 11).is_err(),
        "size is exact"
    );
    put(b64_std(&data).trim_end_matches('='));
    assert!(
        sources::ant_get(&mock, ANT, &addr, 10).is_err(),
        "padding is required"
    );
    put(&format!("{}\n", b64_std(&data)));
    assert!(sources::ant_get(&mock, ANT, &addr, 10).is_err());
    put(&b64_std(&data).replacen('a', "b", 1));
    let changed = sources::ant_get(&mock, ANT, &addr, 10).unwrap();
    assert_ne!(
        changed, data,
        "bytes are checked by hash at the caller, not here"
    );
    let calls = mock.calls().len();
    assert!(sources::ant_get(&mock, ANT, &addr.to_uppercase(), 10).is_err());
    assert_eq!(
        mock.calls().len(),
        calls,
        "a malformed address is never requested"
    );
}

#[test]
fn arweave_needs_owners_and_its_tags_must_name_the_body() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let mut fx = fx("arweave", &g, &[k]);
    fx.cfg.arweave_gateways = vec![AR.into()];
    fx.offer(&g);
    let mut door = fx.door();
    door.poll(true);
    assert!(
        !fx.http.calls().iter().any(|c| c.starts_with("POST")),
        "no owner filter: Arweave discovery is off"
    );

    let owner = b64u(&[5; 32]);
    fx.cfg.arweave_owners = vec![owner.clone()];
    let (tx_bad, tx_good) = (b64u(&[1; 32]), b64u(&[2; 32]));
    let edge = |id: &str, rs: &str| {
        json!({"cursor": id, "node": {"id": id, "tags": [
            {"name": "App-Name", "value": sources::AR_APP},
            {"name": "Origin", "value": ORIGIN},
            {"name": "Seq", "value": "1"},
            {"name": "Record-SHA3", "value": rs},
        ]}})
    };
    let answer = json!({"data": {"transactions": {"pageInfo": {"hasNextPage": false}, "edges": [
        edge(&tx_bad, &b64u(&[7; 32])),
        edge(&tx_good, &b64u(&g.sha3)),
    ]}}});
    fx.http.post_ok(
        &format!("{AR}/graphql"),
        serde_json::to_vec(&answer).unwrap(),
    );
    fx.http.get_ok(&format!("{AR}/{tx_bad}"), envelope(&g, k));
    fx.http.get_ok(&format!("{AR}/{tx_good}"), envelope(&g, k));
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    assert!(noted(
        &door,
        "Record-SHA3 or Seq tag does not name this record"
    ));
    let post = fx
        .http
        .calls()
        .into_iter()
        .find(|c| c.starts_with("POST"))
        .unwrap();
    assert!(
        post.contains(&owner) && post.contains("bnr-keychain-release"),
        "{post}"
    );
}

#[test]
fn inbox_reads_are_bounded() {
    let dir = tmpdir("inbox-bounds");
    let inbox = dir.join("inbox");
    for i in 0..300 {
        fs::write(inbox.join(format!("e{i:03}.json")), b"{}").unwrap();
    }
    fs::write(inbox.join("a-big.json"), vec![b' '; 64 * 1024 + 1]).unwrap();
    fs::write(inbox.join("notes.txt"), b"ignored").unwrap();
    let mut notes = Vec::new();
    let got = sources::read_inbox(&inbox, &mut notes);
    assert_eq!(got.len(), 255, "256 read, the oversized one skipped");
    assert!(
        notes.iter().any(|n| n.contains("holds 301 envelopes")),
        "{notes:?}"
    );
    assert!(notes
        .iter()
        .any(|n| n.contains("a-big.json: larger than 64 KiB")));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn urls_are_https_endpoints_only() {
    assert!(sources::url_ok("https://peer.example", false));
    assert!(sources::url_ok("https://relay.skaists.dev/ant", false));
    assert!(sources::url_ok("http://127.0.0.1:8082", true));
    for bad in [
        "http://peer.example",
        "https://peer.example/",
        "https://user@peer.example",
        "https://peer.example?x=1",
        "https://",
        "ftp://peer.example",
        "https://peer example",
    ] {
        assert!(!sources::url_ok(bad, true), "{bad}");
    }
    assert!(!sources::url_ok("http://127.0.0.1:8082", false));
    assert!(!sources::url_ok("http://10.0.0.1:8082", true));
}

// ---------------------------------------------------------------------------
// keys-door verify

#[test]
fn offline_verify_prints_a_verdict() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let fx = fx("offline", &g, &[k]);
    let v = verifiers(&fx.dir.join("scratch"));
    let (out, ok) = offline_verdict(&fx.cfg, &v, &envelope(&g, k));
    assert!(ok, "{out}");
    assert_eq!(
        (out["verdict"].as_str(), out["fips204"].as_bool()),
        (Some("accept"), Some(true))
    );
    assert_eq!(out["signer"], k.id.as_str());
    let (out, ok) = offline_verdict(&fx.cfg, &v, &envelope(&r2, k));
    assert!(!ok);
    assert!(
        out["reason"].as_str().unwrap().starts_with("not chained"),
        "{out}"
    );
    let (out, ok) = offline_verdict(&fx.cfg, &v, b"{}");
    assert!(!ok);
    assert!(
        out["reason"].as_str().unwrap().starts_with("missing_field"),
        "{out}"
    );
}
