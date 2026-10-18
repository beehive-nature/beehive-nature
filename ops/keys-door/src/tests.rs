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
use crate::door::{offline_verdict, Door, WALK_BYTES};
use crate::pq::{self, BheartSig, DetachedSig, Sig, SigFile};
use crate::record::{
    parse_envelope, parse_record, Envelope, FileEntry, Hints, Pack, Parsed, Record, Refusal,
    Source, BUILD, ENVELOPE, KIND, SCHEMA,
};
use crate::server::{health_router, router, Health, Shared, SharedRef};
use crate::sources::{self, Http};
use crate::store::{Store, MAX_EVIDENCE};
use crate::verify::{Second, Verifiers};

const ORIGIN: &str = "https://keys.skaists.dev";
const RP: &str = "keys.skaists.dev";
const COMMIT: &str = "38c394fac7e9ad1b70b87b3b95e6702fd4b5c244";
const PEER: &str = "https://peer.test";
/// a second peer, configured only where a test adds it
const PEER2: &str = "https://peer2.test";
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
    let ids: Vec<String> = signers.iter().map(|k| k.id.clone()).collect();
    release_ids(seq, prev, &ids, tag)
}

/// A release whose `signers` are these ids, of either profile.
fn release_ids(seq: u64, prev: Option<&Rel>, signers: &[String], tag: &str) -> Rel {
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
    let mut ids = signers.to_vec();
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
        sig: Sig::Bpq(sig.clone()),
        vk: None,
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
        Some(p) => Verifiers::new(p.to_str().expect("utf-8 path"), &pin_of(&p), scratch)
            .expect("KEYS_DOOR_BSIGNER names a runnable bsigner"),
        None => Verifiers::with_second(Second::Stub(|p, _| pq::fips204_ok(p)), scratch),
    }
}

/// The base64url SHA-256 of a file: the bsigner_sha256 pin of the binary under test.
fn pin_of(p: &Path) -> String {
    b64u(&crate::verify::file_sha256(p).expect("the binary under test is readable"))
}

fn real_verifiers(scratch: &Path) -> Verifiers {
    let p = bsigner_env().expect(
        "KEYS_DOOR_BSIGNER is not set: this test exists to run the real bsigner subprocess, and a skipped gate is not a pass",
    );
    Verifiers::new(p.to_str().expect("utf-8 path"), &pin_of(&p), scratch)
        .expect("a runnable bsigner, hashing to its own pin")
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
        bsigner_sha256: b64u(&[0u8; 32]),
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
    /// The configured peer's chain endpoint answers these envelopes at
    /// `/release/1..=n` (and 404 above).
    fn peer_chain(&self, envs: &[Vec<u8>]) {
        self.chain_at(PEER, envs);
    }
    /// `peer`'s chain endpoint answers these envelopes at `/release/1..=n`
    /// and 404 above (whatever it answered there before).
    fn chain_at(&self, peer: &str, envs: &[Vec<u8>]) {
        for n in 1..=64 {
            let url = format!("{peer}{}/{n}", sources::RELEASE_PATH);
            match envs.get(n - 1) {
                Some(e) => self.http.get_ok(&url, e.clone()),
                None => self.http.get_gone(&url),
            }
        }
    }
    /// The configured peer's `/pack`.
    fn peer_pack(&self, pack: &[u8]) {
        self.http
            .get_ok(&format!("{PEER}{}", sources::PACK_PATH), pack.to_vec());
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
    let pin0 = b64u(&[0u8; 32]);
    let e = Verifiers::new("", &pin0, &dir).unwrap_err();
    assert!(e.contains("two ML-DSA-65 verifiers are mandatory"), "{e}");
    assert!(Verifiers::new(dir.join("absent").to_str().unwrap(), &pin0, &dir).is_err());
    assert!(Verifiers::new(dir.to_str().unwrap(), &pin0, &dir).is_err());
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
        Verifiers::new(path.to_str().unwrap(), &pin_of(&path), &dir.join("scratch")).unwrap()
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
    fx.peer_chain(std::slice::from_ref(&env));
    fx.peer_pack(&pack);
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
    let Sig::Bpq(mut s) = p.env.sig.clone() else {
        panic!("the bpq.js vector is a §3b signature")
    };
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
        for p in [
            "/.well-known/bnr-keychain/release",
            "/.well-known/bnr-keychain/release/1",
            "/.well-known/bnr-keychain/pack",
        ] {
            assert_eq!(call(app.clone(), "GET", p).await.0, StatusCode::NOT_FOUND);
        }
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

/// The fork outlives the sources that showed it: once the peer that
/// offered b2 goes quiet, a2 (from the inbox) is the only seq 2 any source
/// offers, and it must not be taken. Only the kept evidence still holds b2.
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
    fx.inbox("1.json", &envelope(&g, k));
    fx.inbox("a2.json", &envelope(&a2, k));
    fx.peer_chain(&[envelope(&g, k), envelope(&b2, k)]);
    let mut door = fx.door();
    door.poll(true);
    let fork = |fx: &Fx| {
        let h = fx.health();
        (h.seq, h.equivocation.map(|e| e.seq))
    };
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());

    // the peer goes quiet: a2 is the only seq 2 any source offers
    for n in 1..=2 {
        fx.http
            .get_gone(&format!("{PEER}{}/{n}", sources::RELEASE_PATH));
    }
    door.poll(true);
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());
    // and a restarted edge remembers it too (state_dir/evidence)
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());

    // b3 arrives while no source offers b2; its prev selects b2: that
    // branch wins
    fx.inbox("b3.json", &envelope(&b3, k));
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
    fx.inbox("b4.json", &envelope(&b4, k));
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

/// `n` distinct envelopes of one record under one signature: they differ
/// only in their unsigned hints.
fn variants(r: &Rel, k: &Key, n: usize) -> Vec<Vec<u8>> {
    let sig = sign(k, &r.bytes);
    (0..n)
        .map(|i| {
            let hints = Hints {
                ar: vec![b64u(&[i as u8; 32])],
                ..Hints::default()
            };
            envelope_with(&r.bytes, &sig, hints)
        })
        .collect()
}

/// Write envelopes straight into state_dir/evidence, as kept evidence.
fn plant_evidence(fx: &Fx, envs: &[Vec<u8>]) {
    let kept = fx.cfg.state_dir.join("evidence");
    fs::create_dir_all(&kept).unwrap();
    for e in envs {
        fs::write(kept.join(b64u(&pq::sha3(&[e.as_slice()]))), e).unwrap();
    }
}

fn evidence_names(fx: &Fx) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(fx.cfg.state_dir.join("evidence"))
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    names.sort();
    names
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
    // a store already full of evidence at or above the floor (seq 9, on a
    // chain this edge does not hold)
    let other = release(1, None, &[k], "other");
    let stray = release(9, Some(&other), &[k], "stray");
    plant_evidence(&fx, &variants(&stray, k, MAX_EVIDENCE));
    for r in [&g, &a2, &b2, &b3] {
        fx.offer(r);
        fx.inbox(&format!("{}.json", b64u(&r.sha3)), &envelope(r, k));
    }
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());
    assert!(noted(&door, "evidence is full"), "{:?}", door.notes());
    assert_eq!(evidence_names(&fx).len(), MAX_EVIDENCE);
}

/// Rule 5 at any seq. An edge serving x3 (floor 3) meets a valid fork at
/// seq 2 whose branches both continue (x3, y3): it holds at x3. The fork is
/// kept although it is below the floor, so once the source of y2/y3 goes
/// quiet and x4 arrives, the edge still holds: no seq+1 record picked a
/// branch. A restart does not forget it either.
#[test]
fn a_fork_below_the_floor_holds_the_edge_after_its_sources_go_quiet() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let x2 = release(2, Some(&g), &[k], "x2");
    let x3 = release(3, Some(&x2), &[k], "x3");
    let x4 = release(4, Some(&x3), &[k], "x4");
    let y2 = release(2, Some(&g), &[k], "y2");
    let y3 = release(3, Some(&y2), &[k], "y3");
    let mut fx = fx("evidence-below-floor", &g, &[k]);
    let offer = |fx: &Fx, r: &Rel| {
        fx.offer(r);
        fx.inbox(&format!("{}.json", b64u(&r.sha3)), &envelope(r, k));
    };
    for r in [&g, &x2, &x3] {
        offer(&fx, r);
    }
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(3), "{:?}", door.notes());
    assert_eq!(fx.store().floor().unwrap(), 3);

    for r in [&y2, &y3] {
        offer(&fx, r);
    }
    door.poll(true);
    let held = |fx: &Fx| {
        let h = fx.health();
        (h.seq, h.equivocation.map(|e| e.seq))
    };
    assert_eq!(held(&fx), (Some(3), Some(2)), "{:?}", door.notes());
    let name = |r: &Rel| b64u(&pq::sha3(&[&envelope(r, k)]));
    let mut fork = vec![name(&x2), name(&x3), name(&y2), name(&y3)];
    fork.sort();
    assert_eq!(evidence_names(&fx), fork, "kept although below the floor");

    // the source of y2/y3 goes quiet; x4 arrives
    for r in [&y2, &y3] {
        fs::remove_file(fx.cfg.inbox_dir.join(format!("{}.json", b64u(&r.sha3)))).unwrap();
    }
    offer(&fx, &x4);
    door.poll(true);
    assert_eq!(held(&fx), (Some(3), Some(2)), "{:?}", door.notes());
    assert_eq!(evidence_names(&fx), fork);
    // restarted, the edge cannot walk past the fork to x3 again, so it
    // serves nothing, and it still reports the fork
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(held(&fx), (None, Some(2)), "{:?}", door.notes());
    assert_eq!(fx.store().floor().unwrap(), 3);
}

/// Kept evidence is never deleted, not even by a restart under a config
/// that cannot parse it (a typo in rp_id): that poll refuses it in the
/// pool and leaves it on disk, and the corrected edge still knows the fork.
#[test]
fn evidence_outlives_a_config_that_cannot_parse_it() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let a2 = release(2, Some(&g), &[k], "a2");
    let b2 = release(2, Some(&g), &[k], "b2");
    let mut fx = fx("evidence-typo", &g, &[k]);
    for r in [&g, &a2, &b2] {
        fx.offer(r);
        fx.inbox(&format!("{}.json", b64u(&r.sha3)), &envelope(r, k));
    }
    let mut door = fx.door();
    door.poll(true);
    let fork = |fx: &Fx| {
        let h = fx.health();
        (h.seq, h.equivocation.map(|e| e.seq))
    };
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());
    let kept = evidence_names(&fx);
    assert_eq!(kept.len(), 2);

    let mut typo = fx.cfg.clone();
    typo.rp_id = "keys.skaists.dex".into();
    typo.validate()
        .expect("the shape is valid; the value is a typo");
    let mut door = Door::new(
        typo,
        verifiers(&fx.dir.join("scratch")),
        Box::new(fx.http.clone()),
        Arc::new(RwLock::new(Shared::default())),
    );
    door.load();
    door.poll(true);
    assert!(noted(&door, "evidence: "), "{:?}", door.notes());
    assert_eq!(evidence_names(&fx), kept, "nothing kept is deleted");

    // corrected, with b2 gone from every source but the kept evidence
    fs::remove_file(fx.cfg.inbox_dir.join(format!("{}.json", b64u(&b2.sha3)))).unwrap();
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(fork(&fx), (Some(1), Some(2)), "{:?}", door.notes());
}

#[test]
fn bytes_must_hash_to_what_the_record_names() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let fx = fx("bytes", &g, &[k]);
    let env = envelope_with(&g.bytes, &sign(k, &g.bytes), Hints::default());
    fx.inbox("g.json", &env);
    // the peer's chain ends at seq 1, so its pack is asked for seq 1
    fx.peer_chain(&[env]);
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
fn the_floor_only_rises_and_a_corrupt_one_is_never_read_as_zero() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
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
}

/// Decided (rule 4): a running edge whose floor file turns corrupt keeps
/// serving the release it last verified (accepted while the floor could be
/// read) and accepts nothing new: no rail is read, nothing is fetched,
/// kept or swapped, and the edge never rewrites a floor it cannot read. A
/// restart with the floor still corrupt serves nothing (503): after a
/// restart nothing is served, so everything would be new. Repaired, the
/// edge resumes.
#[test]
fn a_corrupt_floor_keeps_the_served_release_and_accepts_nothing_new() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    let mut fx = fx("floor-corrupt", &g, &[k]);
    let envs: Vec<Vec<u8>> = [&g, &r2, &r3].iter().map(|r| envelope(r, k)).collect();
    fx.inbox("1.json", &envs[0]);
    fx.offer(&g);
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());

    // everything that would reach 3 is on offer: inbox, peer chain and
    // pack, ANT door
    fx.inbox("2.json", &envs[1]);
    fx.inbox("3.json", &envs[2]);
    fx.peer_chain(&envs);
    fx.peer_pack(&r3.pack);
    fx.offer(&r2);
    fx.offer(&r3);
    let floor = fx.cfg.state_dir.join("floor");
    fs::write(&floor, b"x\n").unwrap();
    let calls = fx.http.calls().len();
    door.poll(true);
    let h = fx.health();
    assert_eq!((h.seq, h.state), (Some(1), "serving"), "{:?}", door.notes());
    assert!(
        h.last_error
            .unwrap()
            .contains("is corrupt: refusing every new release"),
        "{:?}",
        door.notes()
    );
    assert_eq!(fx.http.calls().len(), calls, "no rail is read");
    assert_eq!(fs::read(&floor).unwrap(), b"x\n", "never rewritten");
    assert_eq!(
        fx.store().load().unwrap().unwrap().chain,
        envs[..1].to_vec()
    );
    assert!(!fx.cfg.state_dir.join("evidence").exists());
    block_on(async {
        let app = router(fx.shared.clone());
        let (s, _, b) = call(app.clone(), "GET", "/").await;
        assert_eq!(
            (s, b.as_slice()),
            (StatusCode::OK, &b"<!doctype html><title>g</title>\n"[..])
        );
        let (s, _, b) = call(app.clone(), "GET", "/.well-known/bnr-keychain/release/1").await;
        assert_eq!((s, &b), (StatusCode::OK, &envs[0]));
        assert_eq!(
            call(app, "GET", "/.well-known/bnr-keychain/release/2")
                .await
                .0,
            StatusCode::NOT_FOUND
        );
    });

    // restarted with the floor still corrupt: nothing is served, so
    // nothing is accepted
    let mut door = fx.restart();
    door.poll(true);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());
    assert_eq!(
        block_on(call(router(fx.shared.clone()), "GET", "/")).0,
        StatusCode::SERVICE_UNAVAILABLE
    );

    // repaired: the edge resumes and walks on to 3
    fs::write(&floor, b"1\n").unwrap();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(3), "{:?}", door.notes());
    assert_eq!(fx.store().floor().unwrap(), 3);
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

fn release_get(n: u64) -> String {
    release_get_at(PEER, n)
}

fn release_get_at(peer: &str, n: u64) -> String {
    format!("GET {peer}{}/{n}", sources::RELEASE_PATH)
}

fn pack_get() -> String {
    format!("GET {PEER}{}", sources::PACK_PATH)
}

/// Contract §7 A1: a member edge serves the verified envelope of every seq
/// 1..current at /.well-known/bnr-keychain/release/<seq>, and a fresh edge
/// configured with a peer only walks that chain from genesis, each
/// envelope checked on its own, then takes the peer's pack for the record
/// its chain ends at, by hash.
#[test]
fn a_fresh_edge_with_peers_only_walks_the_chain_from_genesis() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    let envs: Vec<Vec<u8>> = [&g, &r2, &r3].iter().map(|r| envelope(r, k)).collect();
    let a = fx("walk-a", &g, &[k]);
    for (r, e) in [&g, &r2, &r3].into_iter().zip(&envs) {
        a.offer(r);
        a.inbox(&format!("{}.json", r.record.seq), e);
    }
    a.door().poll(true);
    assert_eq!(a.health().seq, Some(3));

    // edge A's chain endpoint
    let (served, pack) = block_on(async {
        let app = router(a.shared.clone());
        let mut served = Vec::new();
        for n in 1..=3 {
            let path = format!("/.well-known/bnr-keychain/release/{n}");
            let (s, h, b) = call(app.clone(), "GET", &path).await;
            assert_eq!(s, StatusCode::OK, "{path}");
            assert_eq!(h["content-type"], "application/json");
            assert_eq!(h["cache-control"], "no-cache");
            assert_eq!(
                h["etag"].to_str().unwrap(),
                format!("\"{}\"", sha256_b64u(&b))
            );
            served.push(b);
        }
        let (s, _, current) = call(app.clone(), "GET", "/.well-known/bnr-keychain/release").await;
        assert_eq!(
            (s, &current),
            (StatusCode::OK, &served[2]),
            "bare = current"
        );
        let (s, h, b) = call(app.clone(), "HEAD", "/.well-known/bnr-keychain/release/2").await;
        assert_eq!((s, b.len()), (StatusCode::OK, 0));
        assert_eq!(
            h["content-length"].to_str().unwrap(),
            served[1].len().to_string()
        );
        for seg in [
            "0",
            "4",
            "01",
            "+1",
            "-1",
            "1.0",
            "",
            "1/",
            "x",
            "99999999999999999999",
        ] {
            let path = format!("/.well-known/bnr-keychain/release/{seg}");
            assert_eq!(
                call(app.clone(), "GET", &path).await.0,
                StatusCode::NOT_FOUND,
                "{path}"
            );
        }
        let pack = call(app, "GET", "/.well-known/bnr-keychain/pack").await.2;
        (served, pack)
    });
    assert_eq!(served, envs, "every verified envelope, as received");

    // edge B: a peer and nothing else
    let b = fx("walk-b", &g, &[k]);
    b.peer_chain(&served);
    b.peer_pack(&pack);
    let mut door = b.door();
    door.poll(true);
    assert_eq!(b.health().seq, Some(3), "{:?}", door.notes());
    assert_eq!(b.store().load().unwrap().unwrap().chain, envs);
    assert_eq!(
        b.http.calls(),
        vec![
            release_get(1),
            release_get(2),
            release_get(3),
            release_get(4),
            pack_get()
        ],
        "one seq at a time until 404, then the pack of the seq the chain ends at"
    );
    // serving 3, a poll asks the peer for seq 4 only
    door.poll(true);
    assert_eq!(b.http.calls().len(), 6);
    assert_eq!(b.http.calls()[5], release_get(4));
    assert_eq!(b.health().seq, Some(3));
}

/// The walk's controls. Each envelope stands or falls on its own, the
/// first that does not extend what the edge holds ends the walk and nothing
/// above it is fetched. The peer's pack may be asked for (any configured
/// peer may hold the bytes), but it is not seq 1's by hash, so the edge
/// stays at seq 1 (its pack from the ANT door).
#[test]
fn the_peer_walk_refuses_what_does_not_chain() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    // a forged seq 2: one bit of its ML-DSA-65 signature
    let mut forged = sign(k, &r2.bytes);
    let mut raw = unb64u(&forged.sig).unwrap();
    raw[7] ^= 1;
    forged.sig = b64u(&raw);
    let forged2 = envelope_with(&r2.bytes, &forged, Hints::default());
    // a validly signed seq 2 whose prev selects another record, and a seq 3
    // that links to it
    let other = release(1, None, &[k], "other");
    let stray2 = release(2, Some(&other), &[k], "stray2");
    let stray3 = release(3, Some(&stray2), &[k], "stray3");
    let cases = [
        (
            "forged",
            vec![envelope(&g, k), forged2, envelope(&r3, k)],
            "peer https://peer.test seq 2: bad_signature",
        ),
        (
            "prev",
            vec![envelope(&g, k), envelope(&stray2, k), envelope(&stray3, k)],
            "peer https://peer.test seq 2: prev does not select the record this edge holds at seq 1",
        ),
        (
            "seq",
            vec![envelope(&g, k), envelope(&r3, k), envelope(&r3, k)],
            "peer https://peer.test seq 2: it answers with seq 3",
        ),
    ];
    for (name, chain, why) in cases {
        let fx = fx(&format!("walk-{name}"), &g, &[k]);
        fx.offer(&g);
        fx.peer_chain(&chain);
        fx.peer_pack(&r3.pack);
        let mut door = fx.door();
        door.poll(true);
        assert_eq!(fx.health().seq, Some(1), "{name}: {:?}", door.notes());
        assert!(noted(&door, why), "{name}: {:?}", door.notes());
        let calls = fx.http.calls();
        assert!(calls.contains(&release_get(2)), "{name}: {calls:?}");
        assert!(!calls.contains(&release_get(3)), "{name}: {calls:?}");
        // and the next poll still refuses it: the edge stays at 1
        door.poll(true);
        assert_eq!(fx.health().seq, Some(1), "{name}: {:?}", door.notes());
    }
}

/// A peer's own claim of its current (the bare `release`) is never read:
/// here it names seq 1, as a stale or stalling peer would; the edge walks
/// the chain endpoint to 3 regardless.
#[test]
fn a_peer_that_lies_about_its_current_is_ignored() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let r2 = release(2, Some(&g), &[k], "r2");
    let r3 = release(3, Some(&r2), &[k], "r3");
    let fx = fx("walk-liar", &g, &[k]);
    fx.peer_chain(&[envelope(&g, k), envelope(&r2, k), envelope(&r3, k)]);
    fx.peer_pack(&r3.pack);
    let bare = format!("{PEER}{}", sources::RELEASE_PATH);
    fx.http.get_ok(&bare, envelope(&g, k));
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(3), "{:?}", door.notes());
    assert!(
        !fx.http.calls().contains(&format!("GET {bare}")),
        "{:?}",
        fx.http.calls()
    );
}

/// The walk is bounded per poll. One its budget cuts short resumes where
/// it stopped (the verified records above the served one are held); the
/// peer's pack, asked for on any poll, counts only once it hashes to a
/// record the walk reached.
#[test]
fn a_peer_walk_cut_short_by_its_budget_resumes_next_poll() {
    let k = key(0);
    let mut rels = vec![release(1, None, &[k], "w1")];
    for n in 2..=5 {
        let r = release(n, rels.last(), &[k], &format!("w{n}"));
        rels.push(r);
    }
    let envs: Vec<Vec<u8>> = rels.iter().map(|r| envelope(r, k)).collect();
    let fx = fx("walk-budget", &rels[0], &[k]);
    fx.peer_chain(&envs);
    fx.peer_pack(&rels[4].pack);
    let mut door = fx.door();
    door.set_walk_budget(2, WALK_BYTES);
    let walked = |fx: &Fx| {
        fx.http
            .calls()
            .into_iter()
            .filter(|c| c.contains("/bnr-keychain/release"))
            .collect::<Vec<_>>()
    };
    door.poll(true);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());
    assert_eq!(walked(&fx), vec![release_get(1), release_get(2)]);
    assert!(
        noted(&door, "walk budget is spent; the walk resumes at seq 3"),
        "{:?}",
        door.notes()
    );
    door.poll(true);
    assert_eq!(fx.health().state, "unverified", "{:?}", door.notes());
    assert_eq!(walked(&fx)[2..], [release_get(3), release_get(4)]);
    door.poll(true);
    assert_eq!(fx.health().seq, Some(5), "{:?}", door.notes());
    assert_eq!(walked(&fx)[4..], [release_get(5), release_get(6)]);
    assert_eq!(fx.http.calls().last(), Some(&pack_get()));
    assert_eq!(fx.store().load().unwrap().unwrap().chain, envs);

    // the byte budget bounds a walk too: checked before each request, so
    // a poll fetches at most one envelope past it
    let fx = self::fx("walk-bytes", &rels[0], &[k]);
    fx.peer_chain(&envs);
    let mut door = fx.door();
    door.set_walk_budget(64, 1);
    door.poll(true);
    assert_eq!(walked(&fx), vec![release_get(1)]);
}

/// Every peer is walked from the served seq + 1, whatever another peer
/// holds above it. Peer 1's walk reaches x4, whose pack is nowhere yet.
/// Then peer 2 offers y2, y3, a valid branch from the served g, and peer 1's
/// pack turns up. Peer 2 is still walked from seq 2, so the fork reaches the
/// pool and the edge holds at g (rule 5) instead of taking x4.
#[test]
fn every_peer_is_walked_from_the_served_seq_whatever_another_holds() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let x2 = release(2, Some(&g), &[k], "x2");
    let x3 = release(3, Some(&x2), &[k], "x3");
    let x4 = release(4, Some(&x3), &[k], "x4");
    let y2 = release(2, Some(&g), &[k], "y2");
    let y3 = release(3, Some(&y2), &[k], "y3");
    let mut fx = fx("walk-two-peers", &g, &[k]);
    fx.cfg.peers.push(PEER2.into());
    fx.offer(&g);
    fx.inbox("g.json", &envelope(&g, k));
    let mut door = fx.door();
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());

    fx.peer_chain(&[&g, &x2, &x3, &x4].map(|r| envelope(r, k)));
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "no pack for x2..x4 anywhere yet");

    fx.chain_at(PEER2, &[&g, &y2, &y3].map(|r| envelope(r, k)));
    fx.peer_pack(&x4.pack);
    let before = fx.http.calls().len();
    door.poll(true);
    let h = fx.health();
    assert_eq!(
        (h.seq, h.equivocation.map(|e| e.seq)),
        (Some(1), Some(2)),
        "{:?}",
        door.notes()
    );
    let polled = fx.http.calls()[before..].to_vec();
    assert!(polled.contains(&release_get_at(PEER2, 2)), "{polled:?}");
}

/// Each peer has its own walk budget, so a peer with a long chain cannot
/// spend a poll's walk before another peer is asked. Peer 1 offers x2..x6
/// (every pack on the ANT door) and spends its 3 requests on seq 1..3;
/// peer 2's y2, y3 reach the same poll's pool, and the edge holds at g.
#[test]
fn a_long_chain_on_one_peer_does_not_starve_another() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let mut xs: Vec<Rel> = Vec::new();
    for n in 2..=6 {
        let r = release(n, Some(xs.last().unwrap_or(&g)), &[k], &format!("x{n}"));
        xs.push(r);
    }
    let y2 = release(2, Some(&g), &[k], "y2");
    let y3 = release(3, Some(&y2), &[k], "y3");
    let mut fx = fx("walk-starve", &g, &[k]);
    fx.cfg.peers.push(PEER2.into());
    fx.offer(&g);
    for r in &xs {
        fx.offer(r);
    }
    let mut chain = vec![envelope(&g, k)];
    chain.extend(xs.iter().map(|r| envelope(r, k)));
    fx.peer_chain(&chain);
    fx.chain_at(PEER2, &[&g, &y2, &y3].map(|r| envelope(r, k)));
    let mut door = fx.door();
    door.set_walk_budget(3, WALK_BYTES);
    door.poll(true);
    let h = fx.health();
    assert_eq!(
        (h.seq, h.equivocation.map(|e| e.seq)),
        (Some(1), Some(2)),
        "{:?}",
        door.notes()
    );
    let calls = fx.http.calls();
    for n in 1..=3 {
        assert!(calls.contains(&release_get(n)), "{calls:?}");
        assert!(calls.contains(&release_get_at(PEER2, n)), "{calls:?}");
    }
    assert!(!calls.contains(&release_get(4)), "{calls:?}");
}

/// A peer that no longer answers the chain an earlier poll held from it is
/// walked again from the served seq + 1 in the same poll, so its other
/// branch reaches the pool. Two ways: the record above what it answered
/// before does not select it, or the record its chain ended at is gone.
#[test]
fn a_peer_that_changes_branch_is_walked_again_from_the_served_seq() {
    let k = key(0);
    let g = release(1, None, &[k], "g");
    let x2 = release(2, Some(&g), &[k], "x2");
    let x3 = release(3, Some(&x2), &[k], "x3");
    let y2 = release(2, Some(&g), &[k], "y2");
    let y3 = release(3, Some(&y2), &[k], "y3");
    let y4 = release(4, Some(&y3), &[k], "y4");
    let env = |r: &Rel| envelope(r, k);
    let serving_g = |name: &str| {
        let fx = fx(name, &g, &[k]);
        fx.offer(&g);
        fx.inbox("g.json", &env(&g));
        let mut door = fx.door();
        door.poll(true);
        assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
        (fx, door)
    };

    // a budget cut leaves x2, x3 held; then seq 4 selects y3, not x3
    let (fx, mut door) = serving_g("walk-parted");
    fx.peer_chain(&[&g, &x2, &x3].map(env));
    door.set_walk_budget(2, WALK_BYTES);
    door.poll(true);
    assert!(
        noted(&door, "walk budget is spent; the walk resumes at seq 4"),
        "{:?}",
        door.notes()
    );
    fx.peer_chain(&[&g, &y2, &y3, &y4].map(env));
    door.set_walk_budget(8, WALK_BYTES);
    door.poll(true);
    assert!(
        noted(
            &door,
            "peer https://peer.test: its seq 4 does not select the seq 3 it answered before; walking it again from seq 2"
        ),
        "{:?}",
        door.notes()
    );
    let h = fx.health();
    assert_eq!(
        (h.seq, h.equivocation.map(|e| e.seq)),
        (Some(1), Some(2)),
        "{:?}",
        door.notes()
    );

    // the chain ended at x3 (no pack anywhere); then the peer has only y2
    let (fx, mut door) = serving_g("walk-shortened");
    fx.peer_chain(&[&g, &x2, &x3].map(env));
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    fx.peer_chain(&[&g, &y2].map(env));
    door.poll(true);
    assert!(
        noted(
            &door,
            "peer https://peer.test: it no longer has seq 3; walking it again from seq 2"
        ),
        "{:?}",
        door.notes()
    );
    // x3 selects x2, so x wins the fork at 2 (rule 5); y2 is kept as
    // evidence of it
    let y2_kept = b64u(&pq::sha3(&[&env(&y2)]));
    assert!(evidence_names(&fx).contains(&y2_kept), "{:?}", door.notes());
}

/// The `--version` line names the commit it is given, and "unknown" for
/// none or an empty one. Whether a build embeds KEYS_DOOR_COMMIT at all is
/// not checked here (a test binary sees only its own build's value): CI's
/// version stamp step builds with it and compares the binary's output.
#[test]
fn version_line_names_the_given_commit_or_unknown() {
    let pkg = env!("CARGO_PKG_VERSION");
    assert_eq!(
        crate::version_line(Some(COMMIT)),
        format!("keys-door {pkg} (commit {COMMIT})")
    );
    for none in [Some(""), None] {
        assert_eq!(
            crate::version_line(none),
            format!("keys-door {pkg} (commit unknown)")
        );
    }
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

/// A configured peer may be http to loopback, as an ANT door may (contract
/// §7 A3); anywhere else it is https. An Arweave gateway is https only.
#[test]
fn configured_peers_take_the_ant_door_rule_gateways_stay_https() {
    let fx = fx_pinned("cfg-peers", [7; 32], &[key(0).id.clone()]);
    let with = |peers: &[&str], gateways: &[&str]| {
        let mut c = fx.cfg.clone();
        c.peers = peers.iter().map(|s| s.to_string()).collect();
        c.arweave_gateways = gateways.iter().map(|s| s.to_string()).collect();
        c.validate()
    };
    assert_eq!(
        with(&["https://peer.example", "http://127.0.0.1:8099"], &[]),
        Ok(())
    );
    for bad in [
        "http://10.80.96.2:8096",
        "http://peer.example",
        "http://127.0.0.1:8099/",
    ] {
        let e = with(&[bad], &[]).expect_err(bad);
        assert!(
            e.contains("peers must be https, or http to loopback"),
            "{e}"
        );
    }
    let e = with(&[], &["http://127.0.0.1:1984"]).expect_err("an http gateway");
    assert!(e.contains("arweave_gateways must be https"), "{e}");
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

// ---------------------------------------------------------------------------
// the second profile: bheart.signature/1 (what `bsigner sign` emits), with
// the verifying key in the envelope's `vk` and the signer id `mldsa65:…`

/// bsigner's `agility` text (crates/bsigner/src/envelope.rs). Not signed.
const AGILITY: &str =
    "verify dispatches on the alg fields above; unknown ids are refused, never defaulted";

/// A throwaway bheart signer made in this process (fips204 keygen from a
/// fixed seed), signing the raw bytes with an empty context as bsigner does.
struct HKey {
    sk: ml_dsa_65::PrivateKey,
    vk: Vec<u8>,
    id: String,
    key_id: String,
}

fn hkey(n: usize) -> &'static HKey {
    static KEYS: [OnceLock<HKey>; 2] = [const { OnceLock::new() }; 2];
    KEYS[n].get_or_init(|| {
        let (pk, sk) = ml_dsa_65::KG::keygen_from_seed(&[n as u8 + 101; 32]);
        let vk = pk.into_bytes().to_vec();
        HKey {
            sk,
            id: pq::mldsa65_id(&vk).expect("a 1952-byte key"),
            key_id: pq::bheart_key_id(&vk),
            vk,
        }
    })
}

fn bheart_of(key_id: &str, file: &[u8], sig: &[u8]) -> BheartSig {
    let n = file.len() as u64;
    BheartSig {
        agility: AGILITY.into(),
        alg: "ml-dsa-65".into(),
        content: pq::BheartContent {
            bytes: n,
            digest: pq::BheartDigest {
                alg: "sha3-256".into(),
                b64u: b64u(&pq::sha3(&[file])),
                bytes: n,
            },
        },
        key_id: key_id.into(),
        signature: pq::BheartSignature {
            alg: "ml-dsa-65".into(),
            b64u: b64u(sig),
            bytes: sig.len() as u64,
        },
        signed_at_ms: 1_760_227_200_000,
        kind: "bheart.signature/1".into(),
    }
}

fn hsign(k: &HKey, file: &[u8]) -> BheartSig {
    let sig = k.sk.try_sign_with_seed(&[7; 32], file, &[]).expect("signs");
    bheart_of(&k.key_id, file, &sig)
}

fn henvelope_with(record: &[u8], sig: Sig, vk: Option<&[u8]>, hints: Hints) -> Vec<u8> {
    serde_json::to_vec(&Envelope {
        bnr: ENVELOPE.into(),
        hints,
        record: b64u(record),
        sig,
        vk: vk.map(b64u),
    })
    .expect("serializes")
}

/// An envelope carrying a bheart signature by `vk`, hinting the pack's ANT address.
fn henvelope(r: &Rel, sig: BheartSig, vk: &[u8]) -> Vec<u8> {
    let hints = Hints {
        ant: Some(ant_addr(r)),
        ..Hints::default()
    };
    henvelope_with(&r.bytes, Sig::Bheart(sig), Some(vk), hints)
}

#[test]
fn mldsa65_ids_are_validated_strictly() {
    let h = hkey(0);
    assert!(h.id.starts_with("mldsa65:") && h.id.len() == 8 + 43);
    assert!(pq::is_mldsa65_id(&h.id) && pq::is_signer_id(&h.id));
    assert!(pq::is_signer_id(&key(0).id) && !pq::is_mldsa65_id(&key(0).id));
    assert_eq!(h.key_id.len(), "bheart-".len() + 16);
    let digest = &h.id[8..];
    // the last base64url digit of 32 bytes carries 2 spare bits: setting one
    // spells other text for the same bytes, and it is refused
    const URL: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let last = URL
        .iter()
        .position(|&c| c == digest.as_bytes()[42])
        .unwrap();
    let respelt = format!("mldsa65:{}{}", &digest[..42], URL[last | 1] as char);
    for bad in [
        String::new(),
        digest.to_string(),
        respelt,
        format!("MLDSA65:{digest}"),
        format!("mldsa65:{digest}="),
        format!("mldsa65:{}", &digest[..42]),
        format!("mldsa65:{digest}A"),
        format!("mldsa65: {}", &digest[1..]),
        format!("mldsa87:{digest}"),
        "mldsa65:".to_string(),
    ] {
        assert!(!pq::is_signer_id(&bad), "{bad:?}");
    }

    // a record may name either form; the config too
    let g = release_ids(1, None, &[key(0).id.clone(), h.id.clone()], "mixed");
    assert_eq!(parse_record(&g.bytes).unwrap(), g.record);
    let mut bad = g.record.clone();
    bad.signers = vec!["mldsa65:short".into()];
    assert_eq!(
        bad.validate().unwrap_err(),
        Refusal::Field("signers (non-empty, sorted, unique bzpq1 or mldsa65: ids)")
    );
    let fx = fx_pinned("mldsa-cfg", g.sha3, std::slice::from_ref(&h.id));
    let mut cfg = fx.cfg.clone();
    cfg.genesis_signers = vec!["mldsa65:short".into()];
    assert!(cfg.validate().is_err());
}

#[test]
fn bheart_envelope_is_parsed_strictly_before_any_lattice_math() {
    let (h, other) = (hkey(0), hkey(1));
    let g = release_ids(1, None, std::slice::from_ref(&h.id), "hg");
    let good = hsign(h, &g.bytes);
    let env = henvelope(&g, good.clone(), &h.vk);
    let p = parse_envelope(&env, ORIGIN, RP).unwrap();
    assert_eq!(p.pre.id, h.id);
    assert_eq!(
        p.pre.message, g.bytes,
        "the message is the raw record bytes"
    );
    assert!(pq::fips204_ok(&p.pre));
    let scratch = tmpdir("bheart-pre");
    let stub = Verifiers::with_second(Second::Stub(|p, _| pq::fips204_ok(p)), &scratch);
    assert_eq!(stub.verify(&p).unwrap(), h.id);

    let refused = |sig: BheartSig, vk: Option<&[u8]>, rec: &[u8]| {
        parse_envelope(
            &henvelope_with(rec, Sig::Bheart(sig), vk, Hints::default()),
            ORIGIN,
            RP,
        )
        .unwrap_err()
    };
    let with = |f: &dyn Fn(&mut BheartSig)| {
        let mut s = good.clone();
        f(&mut s);
        s
    };
    // wrong vk: the key id bsigner derives from it is not the one signed
    assert_eq!(
        refused(good.clone(), Some(&other.vk), &g.bytes),
        Refusal::IdMismatch
    );
    // key_id mismatch
    assert_eq!(
        refused(
            with(&|s| s.key_id = other.key_id.clone()),
            Some(&h.vk),
            &g.bytes
        ),
        Refusal::IdMismatch
    );
    // algorithm ids
    let alg = Refusal::Field("sig.alg and sig.signature.alg (ml-dsa-65)");
    assert_eq!(
        refused(with(&|s| s.alg = "ml-dsa-87".into()), Some(&h.vk), &g.bytes),
        alg
    );
    assert_eq!(
        refused(
            with(&|s| s.signature.alg = "ml-dsa-44".into()),
            Some(&h.vk),
            &g.bytes
        ),
        alg
    );
    assert_eq!(
        refused(
            with(&|s| s.content.digest.alg = "sha3-512".into()),
            Some(&h.vk),
            &g.bytes
        ),
        Refusal::Field("sig.content.digest.alg (sha3-256)")
    );
    assert_eq!(
        refused(
            with(&|s| s.kind = "bheart.signature/2".into()),
            Some(&h.vk),
            &g.bytes
        ),
        Refusal::Field("sig.type (bheart.signature/1)")
    );
    // vk: required with bheart, forbidden with §3b, exactly 1952 bytes
    assert_eq!(
        refused(good.clone(), None, &g.bytes),
        Refusal::Field("vk (required with bheart.signature/1)")
    );
    let bpq_with_vk = henvelope_with(
        &g.bytes,
        Sig::Bpq(sign(key(0), &g.bytes)),
        Some(&h.vk),
        Hints::default(),
    );
    assert_eq!(
        parse_envelope(&bpq_with_vk, ORIGIN, RP).unwrap_err(),
        Refusal::Field("vk (forbidden with a §3b signature)")
    );
    assert_eq!(
        refused(good.clone(), Some(&h.vk[..1951]), &g.bytes),
        Refusal::Field("vk (base64url of a 1952-byte ML-DSA-65 key)")
    );
    // digest, sizes
    assert_eq!(
        refused(
            with(&|s| s.content.digest.b64u = b64u(&pq::sha3(&[b"x"]))),
            Some(&h.vk),
            &g.bytes
        ),
        Refusal::FileMismatch
    );
    assert_eq!(
        refused(with(&|s| s.content.bytes += 1), Some(&h.vk), &g.bytes),
        Refusal::FileMismatch
    );
    assert_eq!(
        refused(
            with(&|s| s.content.digest.bytes -= 1),
            Some(&h.vk),
            &g.bytes
        ),
        Refusal::FileMismatch
    );
    // signature length: the field, and the decoded bytes
    let len = Refusal::Field("sig.signature (3309 bytes)");
    assert_eq!(
        refused(with(&|s| s.signature.bytes = 3308), Some(&h.vk), &g.bytes),
        len
    );
    let short = with(&|s| {
        let mut raw = unb64u(&s.signature.b64u).unwrap();
        raw.pop();
        s.signature.b64u = b64u(&raw);
    });
    assert_eq!(refused(short, Some(&h.vk), &g.bytes), len);
    // one bit of the record: the digest no longer names it
    let t = tamper(&g);
    assert_eq!(
        refused(good.clone(), Some(&h.vk), &t),
        Refusal::FileMismatch
    );
    // ... and rebound to the tampered bytes, only ML-DSA refuses it
    let rebound = bheart_of(&h.key_id, &t, &unb64u(&good.signature.b64u).unwrap());
    let q = parse_envelope(
        &henvelope_with(&t, Sig::Bheart(rebound), Some(&h.vk), Hints::default()),
        ORIGIN,
        RP,
    )
    .unwrap();
    assert!(!pq::fips204_ok(&q.pre));
    assert_eq!(stub.verify(&q).unwrap_err(), Refusal::BadSignature);
    // the field set is exact
    let text = String::from_utf8(env.clone()).unwrap();
    for (from, to) in [
        ("\"type\":", "\"note\":\"x\",\"type\":"),
        ("\"signed_at_ms\":", "\"signed\":1,\"signed_at_ms\":"),
        ("\"digest\":{", "\"digest\":{\"extra\":1,"),
        ("\"agility\":", "\"agility_x\":"),
    ] {
        let e = text.replacen(from, to, 1);
        assert_ne!(e, text);
        assert!(
            matches!(
                parse_envelope(e.as_bytes(), ORIGIN, RP).unwrap_err().name(),
                "unknown_field" | "missing_field"
            ),
            "{from}"
        );
    }
    // a signer the genesis pins do not name authorizes nothing
    let mut verify = |q: &Parsed| stub.verify(q);
    let not_pinned = crate::chain::extends(
        None,
        &p,
        &g.sha3,
        std::slice::from_ref(&key(0).id),
        &mut verify,
    );
    assert_eq!(
        not_pinned.unwrap_err(),
        "no signature by an authorized signer"
    );
    let pinned = crate::chain::extends(None, &p, &g.sha3, std::slice::from_ref(&h.id), &mut verify);
    assert_eq!(pinned.unwrap(), h.id);
    let _ = fs::remove_dir_all(&scratch);
}

/// Rotation between profiles through record.signers, on the door: a §3b
/// genesis names an mldsa65: id; a §3b seq 2 by the old key is refused, a
/// bheart seq 2 by the named key is accepted and served.
fn rotation_on_the_door(
    name: &str,
    vk: &[u8],
    bheart_sign: &dyn Fn(&[u8]) -> BheartSig,
    v: Verifiers,
) {
    let old = key(0);
    let id = pq::mldsa65_id(vk).unwrap();
    let g = release_ids(1, None, std::slice::from_ref(&id), "rot-g");
    let r2 = release_ids(2, Some(&g), std::slice::from_ref(&id), "rot-2");
    let fx = fx(name, &g, &[old]);
    fx.offer(&g);
    fx.offer(&r2);
    fx.inbox("1.json", &envelope(&g, old));
    // the old key signs seq 2: g's signers no longer name it
    fx.inbox("2-old.json", &envelope(&r2, old));
    let mut door = fx.door_with(v);
    door.poll(true);
    assert_eq!(fx.health().seq, Some(1), "{:?}", door.notes());
    assert!(
        noted(&door, "no signature by an authorized signer"),
        "{:?}",
        door.notes()
    );
    // the rotated-to key signs the same seq 2 in the bheart profile
    fx.inbox("2-new.json", &henvelope(&r2, bheart_sign(&r2.bytes), vk));
    door.poll(true);
    assert_eq!(fx.health().seq, Some(2), "{:?}", door.notes());
    assert_eq!(fx.store().load().unwrap().unwrap().chain.len(), 2);
    let (status, _, body) = block_on(call(router(fx.shared.clone()), "GET", "/keychain.js"));
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, b"// keychain rot-2\n");
    // the chain endpoint hands the bheart envelope on, and it parses again
    let (status, _, body) = block_on(call(
        router(fx.shared.clone()),
        "GET",
        &format!("{}/2", sources::RELEASE_PATH),
    ));
    assert_eq!(status, StatusCode::OK);
    let served = parse_envelope(&body, ORIGIN, RP).unwrap();
    assert_eq!(served.pre.id, id);
    assert!(matches!(served.env.sig, Sig::Bheart(_)));
}

#[test]
fn rotation_from_bzpq1_to_mldsa65_through_record_signers() {
    let h = hkey(1);
    let dir = tmpdir("rot-stub");
    let v = Verifiers::with_second(Second::Stub(|p, _| pq::fips204_ok(p)), &dir);
    rotation_on_the_door("rot-in-process", &h.vk, &|b| hsign(h, b), v);
    let _ = fs::remove_dir_all(&dir);
}

// --- the real bsigner: keygen + sign with its own CLI, verify with both ---

const REC_ENV: &str = "KEYS_DOOR_TEST_REC";

/// The 24-word test phrase (23 x "abandon", then "art"): a public BIP-39
/// test vector, never a real key.
fn test_phrase() -> String {
    let mut w = vec!["abandon"; 23];
    w.push("art");
    w.join(" ")
}

fn bsigner_run(bin: &Path, args: &[&str]) -> Value {
    let out = std::process::Command::new(bin)
        .args(args)
        .env(REC_ENV, test_phrase())
        .output()
        .expect("bsigner runs");
    assert!(
        out.status.success(),
        "bsigner {args:?}: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    serde_json::from_slice(&out.stdout).expect("bsigner prints JSON")
}

/// `bsigner sign --rec-env V --key-id K --file F --out S`, read back.
fn bsigner_sign(bin: &Path, dir: &Path, keydir: &Path, key_id: &str, file: &[u8]) -> BheartSig {
    let (f, s) = (dir.join("to-sign.json"), dir.join("sig.json"));
    fs::write(&f, file).unwrap();
    let _ = fs::remove_file(&s);
    let said = bsigner_run(
        bin,
        &[
            "sign",
            "--rec-env",
            REC_ENV,
            "--key-id",
            key_id,
            "--file",
            f.to_str().unwrap(),
            "--out",
            s.to_str().unwrap(),
            "--keydir",
            keydir.to_str().unwrap(),
        ],
    );
    assert_eq!(said["envelope_type"], "bheart.signature/1");
    // bsigner writes it pretty-printed; the strict struct reads every field
    serde_json::from_slice(&fs::read(&s).unwrap()).expect("an exact bheart.signature/1")
}

#[test]
fn a_bsigner_made_bheart_signature_passes_both_verifiers() {
    let bin = bsigner_env().expect(
        "KEYS_DOOR_BSIGNER is not set: this test exists to run the real bsigner keygen, sign and verify, and a skipped gate is not a pass",
    );
    let dir = tmpdir("bheart-real");
    let keydir = dir.join("keys");
    let made = bsigner_run(
        &bin,
        &[
            "keygen",
            "--alg",
            "ml-dsa-65",
            "--rec-env",
            REC_ENV,
            "--keydir",
            keydir.to_str().unwrap(),
        ],
    );
    let key_id = made["key_id"].as_str().unwrap().to_string();
    let vk = unb64u(made["verifying_key_b64u"].as_str().unwrap()).unwrap();
    assert_eq!(vk.len(), 1952);
    assert_eq!(key_id, pq::bheart_key_id(&vk), "bsigner derive_key_id");
    let id = pq::mldsa65_id(&vk).unwrap();

    // a bsigner-made signature over a release record, as bsigner wrote it
    let g = release_ids(1, None, std::slice::from_ref(&id), "real-g");
    let sig = bsigner_sign(&bin, &dir, &keydir, &key_id, &g.bytes);
    assert_eq!(sig.key_id, key_id);
    let env = henvelope(&g, sig.clone(), &vk);
    let p = parse_envelope(&env, ORIGIN, RP).unwrap();
    assert_eq!(p.pre.id, id);
    let v = real_verifiers(&dir.join("scratch"));
    let o = v.outcome(&p);
    assert_eq!((o.fips204, o.bsigner.clone()), (true, Ok(true)));
    assert_eq!(v.verify(&p).unwrap(), id);
    // check_sig is the same pair outside an envelope
    let o = v
        .check_sig(&Sig::Bheart(sig.clone()), Some(&b64u(&vk)), &g.bytes)
        .unwrap();
    assert_eq!((o.fips204, o.bsigner), (true, Ok(true)));

    // one bit of the record, the digest rebound: both refuse
    let t = tamper(&g);
    let rebound = bheart_of(&key_id, &t, &unb64u(&sig.signature.b64u).unwrap());
    let q = parse_envelope(
        &henvelope_with(&t, Sig::Bheart(rebound), Some(&vk), Hints::default()),
        ORIGIN,
        RP,
    )
    .unwrap();
    let o = v.outcome(&q);
    assert_eq!((o.fips204, o.bsigner), (false, Ok(false)));
    assert_eq!(v.verify(&q).unwrap_err(), Refusal::BadSignature);
    // one bit of the signature: both refuse
    let mut raw = unb64u(&sig.signature.b64u).unwrap();
    raw[1000] ^= 0x10;
    let forged = bheart_of(&key_id, &g.bytes, &raw);
    let q = parse_envelope(
        &henvelope_with(&g.bytes, Sig::Bheart(forged), Some(&vk), Hints::default()),
        ORIGIN,
        RP,
    )
    .unwrap();
    assert_eq!(v.verify(&q).unwrap_err(), Refusal::BadSignature);
    // the prechecks, on the bsigner-made signature
    let refused = |s: BheartSig, vk: Option<&[u8]>| {
        parse_envelope(
            &henvelope_with(&g.bytes, Sig::Bheart(s), vk, Hints::default()),
            ORIGIN,
            RP,
        )
        .unwrap_err()
    };
    let with = |f: &dyn Fn(&mut BheartSig)| {
        let mut s = sig.clone();
        f(&mut s);
        s
    };
    assert_eq!(refused(sig.clone(), Some(&hkey(0).vk)), Refusal::IdMismatch);
    assert_eq!(
        refused(with(&|s| s.key_id = hkey(0).key_id.clone()), Some(&vk)),
        Refusal::IdMismatch
    );
    assert_eq!(
        refused(with(&|s| s.alg = "ml-dsa-44".into()), Some(&vk)).name(),
        "bad_field"
    );
    assert_eq!(refused(sig.clone(), None).name(), "bad_field");
    assert_eq!(
        refused(
            with(&|s| s.content.digest.b64u = b64u(&pq::sha3(&[b"x"]))),
            Some(&vk)
        ),
        Refusal::FileMismatch
    );
    assert_eq!(
        refused(with(&|s| s.signature.bytes = 3310), Some(&vk)).name(),
        "bad_field"
    );
    let bpq_with_vk = henvelope_with(
        &g.bytes,
        Sig::Bpq(sign(key(0), &g.bytes)),
        Some(&vk),
        Hints::default(),
    );
    assert_eq!(
        parse_envelope(&bpq_with_vk, ORIGIN, RP).unwrap_err().name(),
        "bad_field"
    );
    // a bsigner-made genesis the pins do not name authorizes nothing
    let mut verify = |q: &Parsed| v.verify(q);
    let pins = std::slice::from_ref(&key(0).id);
    assert_eq!(
        crate::chain::extends(None, &p, &g.sha3, pins, &mut verify).unwrap_err(),
        "no signature by an authorized signer"
    );
    let pins = std::slice::from_ref(&id);
    assert_eq!(
        crate::chain::extends(None, &p, &g.sha3, pins, &mut verify).unwrap(),
        id
    );

    // rotation on the door, both verifiers real
    let sign_with = |b: &[u8]| bsigner_sign(&bin, &dir, &keydir, &key_id, b);
    rotation_on_the_door(
        "rot-bsigner",
        &vk,
        &sign_with,
        real_verifiers(&dir.join("scratch")),
    );
    let _ = fs::remove_dir_all(&dir);
}

/// The lying-verifier controls for the bheart subprocess path: a script that
/// says yes about the key id it is asked for shows a forgery up only as a
/// disagreement, a yes about another key id is a no, and a yes with exit 1
/// is no verdict at all.
#[cfg(unix)]
#[test]
fn a_lying_bsigner_verify_on_the_bheart_path() {
    use std::os::unix::fs::PermissionsExt;
    let h = hkey(0);
    let g = release_ids(1, None, std::slice::from_ref(&h.id), "liar-h");
    let dir = tmpdir("liar-h");
    let liar = |name: &str, body: &str| {
        let path = dir.join(name);
        fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        Verifiers::new(path.to_str().unwrap(), &pin_of(&path), &dir.join("scratch")).unwrap()
    };
    // argv: verify --key-id K --file F --envelope S --keydir D
    let echoes = liar(
        "yes-echo.sh",
        r#"printf '{"verified":true,"key_id":"%s","alg":"ml-dsa-65"}\n' "$3""#,
    );
    let other = liar(
        "yes-other.sh",
        r#"printf '{"verified":true,"key_id":"bheart-AAAAAAAAAAAAAAAA"}\n'"#,
    );
    let lies_exit = liar(
        "yes-exit1.sh",
        r#"printf '{"verified":true,"key_id":"%s"}\n' "$3"; exit 1"#,
    );
    let p = parse_envelope(&henvelope(&g, hsign(h, &g.bytes), &h.vk), ORIGIN, RP).unwrap();
    let mut raw = unb64u(&hsign(h, &g.bytes).signature.b64u).unwrap();
    raw[7] ^= 1;
    let q = parse_envelope(
        &henvelope_with(
            &g.bytes,
            Sig::Bheart(bheart_of(&h.key_id, &g.bytes, &raw)),
            Some(&h.vk),
            Hints::default(),
        ),
        ORIGIN,
        RP,
    )
    .unwrap();
    assert_eq!(echoes.verify(&p).unwrap(), h.id);
    assert_eq!(
        echoes.verify(&q).unwrap_err(),
        Refusal::Disagreement {
            fips204: false,
            bsigner: true
        }
    );
    assert_eq!(
        other.verify(&p).unwrap_err(),
        Refusal::Disagreement {
            fips204: true,
            bsigner: false
        }
    );
    assert_eq!(lies_exit.verify(&p).unwrap_err().name(), "verifier_failed");
    let _ = fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// profile close: the bsigner pin, public-only compatibility against the
// pinned binary, authority = full public key + exact record, and strict
// profile separation (the same fixture the JS reader is held to)

#[test]
fn the_bsigner_pin_is_checked_at_startup_before_each_spawn_and_every_poll() {
    let dir = tmpdir("pin");
    let bin = dir.join("fake-bsigner");
    fs::write(&bin, b"#!/bin/sh\nexit 1\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    }
    let path = bin.to_str().unwrap();
    let pin = pin_of(&bin);
    // startup: an unparseable pin, then a wrong one, refuse to serve
    for bad in ["", "UNFILLED-sha256-of-bsigner-b64u", "AAAA"] {
        let e = Verifiers::new(path, bad, &dir).unwrap_err();
        assert!(e.starts_with("bsigner_sha256 must be"), "{e}");
    }
    let e = Verifiers::new(path, &b64u(&[7u8; 32]), &dir).unwrap_err();
    assert!(e.starts_with("bsigner_pin_mismatch: "), "{e}");
    assert!(e.contains(&pin) && e.contains(&b64u(&[7u8; 32])), "{e}");
    let v = Verifiers::new(path, &pin, &dir).expect("the file hashes to its pin");
    assert_eq!(v.pin_ok(), Ok(()));

    // swapped under a running edge: the next spawn is refused by name, not run
    let k = key(0);
    let g = release(1, None, &[k], "pin-g");
    let p = parse_envelope(&envelope(&g, k), ORIGIN, RP).unwrap();
    fs::write(
        &bin,
        b"#!/bin/sh\nprintf '{\"kind\":\"detached\",\"verified\":true}'\n",
    )
    .unwrap();
    let r = v.verify(&p).unwrap_err();
    assert_eq!(r.name(), "bsigner_pin_mismatch", "{r}");
    assert!(v
        .pin_ok()
        .unwrap_err()
        .starts_with("bsigner_pin_mismatch: "));

    // and the door: a swapped bsigner refuses every new release, and says so on health
    let fx = fx("pin-door", &g, &[k]);
    fx.inbox("g.json", &envelope(&g, k));
    fx.offer(&g);
    let mut door = fx.door_with(v);
    door.poll(true);
    let h = fx.health();
    assert_eq!(h.seq, None);
    assert!(
        h.last_error
            .as_deref()
            .is_some_and(|e| e.starts_with("bsigner_pin_mismatch: ")),
        "{h:?}"
    );
    // the example config's placeholder is refused by the config itself
    let mut cfg = fx.cfg.clone();
    cfg.bsigner_sha256 = "UNFILLED-sha256-of-the-pinned-bsigner".into();
    assert!(cfg
        .validate()
        .unwrap_err()
        .starts_with("bsigner_sha256 must be"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_edge_toml_example_placeholder_is_refused() {
    let text = include_str!("../../keys-edge/edge.toml.example");
    let line = text
        .lines()
        .find(|l| l.starts_with("bsigner_sha256 = "))
        .expect("edge.toml.example names bsigner_sha256");
    assert!(line.contains("UNFILLED"), "{line}");
    let v: Value = toml::from_str::<toml::Value>(line)
        .map(|t| serde_json::to_value(t).unwrap())
        .unwrap();
    assert!(crate::b64::unb64u32(v["bsigner_sha256"].as_str().unwrap()).is_none());
}

/// One raw `bsigner verify` run, its stdout, stderr and exit printed so the
/// CI log carries every case. Accepted = exit 0 and stdout says verified true.
fn raw_verify(
    case: &str,
    bin: &Path,
    key_id: &str,
    file: &Path,
    sig: &Path,
    keydir: &Path,
) -> bool {
    let out = std::process::Command::new(bin)
        .args(["verify", "--key-id", key_id, "--file"])
        .arg(file)
        .arg("--envelope")
        .arg(sig)
        .arg("--keydir")
        .arg(keydir)
        .output()
        .expect("bsigner runs");
    let (stdout, stderr) = (
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr),
    );
    println!(
        "compat {case}: exit {:?} stdout {} stderr {}",
        out.status.code(),
        stdout.trim(),
        stderr.trim()
    );
    let said: Value = serde_json::from_str(stdout.trim()).unwrap_or(Value::Null);
    let accepted = out.status.success() && said["verified"] == true;
    // the same discipline keys-door applies: a verdict never disagrees with the exit status
    if said["verified"].is_boolean() {
        assert_eq!(said["verified"] == true, out.status.success(), "{case}");
    }
    accepted
}

/// A keyset file written as is (NOT through keys-door's writer): what the
/// pinned bsigner does with each shape is the fact under test.
fn raw_keyset(dir: &Path, key_id: &str, v: &Value) -> PathBuf {
    let _ = fs::remove_dir_all(dir);
    fs::create_dir_all(dir).unwrap();
    fs::write(dir.join(format!("{key_id}.json")), v.to_string()).unwrap();
    dir.to_path_buf()
}

/// Compatibility of the PINNED bsigner with public-only keysets, case by
/// case, recorded raw. Fails (never skips) without KEYS_DOOR_BSIGNER. Two
/// cases are accepted by bsigner where the reviewer's table says refuse: a
/// keyset with private or extra fields, and a keyset whose alg is ml-dsa-87
/// (verify dispatches on the envelope's alg). Both are recorded as what the
/// binary does, and keys-door's writer is shown to refuse to write either, and
/// to refuse before any spawn.
#[test]
fn bsigner_public_only_keyset_compatibility() {
    let bin = bsigner_env().expect(
        "KEYS_DOOR_BSIGNER is not set: the public-only compatibility suite runs against the pinned binary, and a skipped gate is not a pass",
    );
    println!("compat binary: {} sha256 {}", bin.display(), pin_of(&bin));
    let dir = tmpdir("compat");
    let keygen = |name: &str| {
        let made = bsigner_run(
            &bin,
            &[
                "keygen",
                "--alg",
                "ml-dsa-65",
                "--rec-env",
                REC_ENV,
                "--keydir",
                dir.join(name).to_str().unwrap(),
            ],
        );
        let vk = unb64u(made["verifying_key_b64u"].as_str().unwrap()).unwrap();
        (made["key_id"].as_str().unwrap().to_string(), vk)
    };
    let ((k1, vk1), (k2, vk2)) = (keygen("k1"), keygen("k2"));
    let rec = release_ids(1, None, &[pq::mldsa65_id(&vk1).unwrap()], "compat");
    let sig = bsigner_sign(&bin, &dir, &dir.join("k1"), &k1, &rec.bytes);
    let (file, sig_path) = (dir.join("record.json"), dir.join("bsigner-sig.json"));
    fs::write(&file, &rec.bytes).unwrap();
    fs::write(&sig_path, serde_json::to_vec_pretty(&sig).unwrap()).unwrap();
    let write_sig = |name: &str, v: &Value| {
        let p = dir.join(name);
        fs::write(&p, v.to_string()).unwrap();
        p
    };
    let sig_v = serde_json::to_value(&sig).unwrap();
    let edited = |f: &dyn Fn(&mut Value)| {
        let mut v = sig_v.clone();
        f(&mut v);
        v
    };
    let ks1 = crate::verify::public_keyset_for(&vk1);
    let pub1 = raw_keyset(&dir.join("pub1"), &k1, &ks1);

    // (a) valid
    assert!(raw_verify("a valid", &bin, &k1, &file, &sig_path, &pub1));
    // (b) wrong key: another keygen's public key under the first key id; and
    // a correct public-only keyset of a different key
    let swapped = json!({"type":"bheart.keyset/2","kind":"signature","alg":"ml-dsa-65","key_id":k1,"verifying_key_b64u":b64u(&vk2)});
    let d = raw_keyset(&dir.join("swapped"), &k1, &swapped);
    assert!(!raw_verify(
        "b wrong-key-under-first-id",
        &bin,
        &k1,
        &file,
        &sig_path,
        &d
    ));
    assert!(
        crate::verify::public_keyset(&swapped).is_err(),
        "keys-door never writes it"
    );
    let d = raw_keyset(
        &dir.join("pub2"),
        &k2,
        &crate::verify::public_keyset_for(&vk2),
    );
    assert!(!raw_verify(
        "b correct-keyset-other-key",
        &bin,
        &k2,
        &file,
        &sig_path,
        &d
    ));
    // (c) one byte of the file
    let mut altered = rec.bytes.clone();
    altered[10] ^= 1;
    let alt = dir.join("altered.json");
    fs::write(&alt, &altered).unwrap();
    assert!(!raw_verify(
        "c altered-file",
        &bin,
        &k1,
        &alt,
        &sig_path,
        &pub1
    ));
    // (d) malformed envelope
    let text = serde_json::to_string_pretty(&sig).unwrap();
    let trunc = dir.join("truncated.json");
    fs::write(&trunc, &text[..text.len() / 2]).unwrap();
    assert!(!raw_verify(
        "d truncated-json",
        &bin,
        &k1,
        &file,
        &trunc,
        &pub1
    ));
    let p = write_sig(
        "nosig.json",
        &edited(&|v| {
            v.as_object_mut().unwrap().remove("signature");
        }),
    );
    assert!(!raw_verify(
        "d missing-signature",
        &bin,
        &k1,
        &file,
        &p,
        &pub1
    ));
    let p = write_sig(
        "baddigest.json",
        &edited(&|v| {
            v["content"]["digest"]["b64u"] = json!("!!not base64url!!");
        }),
    );
    assert!(!raw_verify(
        "d digest-not-b64u",
        &bin,
        &k1,
        &file,
        &p,
        &pub1
    ));
    // (e) unsupported algorithms, in the envelope and in the keyset
    for alg in ["ml-dsa-87", "ml-dsa-65-hedged"] {
        let p = write_sig(
            "alg.json",
            &edited(&|v| {
                v["alg"] = json!(alg);
                v["signature"]["alg"] = json!(alg);
            }),
        );
        assert!(!raw_verify(
            &format!("e envelope-alg-{alg}"),
            &bin,
            &k1,
            &file,
            &p,
            &pub1
        ));
    }
    let hedged = json!({"type":"bheart.keyset/2","kind":"signature","alg":"ml-dsa-65-hedged","key_id":k1,"verifying_key_b64u":b64u(&vk1)});
    let d = raw_keyset(&dir.join("hedged"), &k1, &hedged);
    assert!(!raw_verify(
        "e keyset-alg-ml-dsa-65-hedged",
        &bin,
        &k1,
        &file,
        &sig_path,
        &d
    ));
    assert!(crate::verify::public_keyset(&hedged).is_err());
    // RECORDED: the pinned bsigner verifies with the envelope's alg and does
    // not refuse a keyset whose alg is ml-dsa-87. keys-door never writes one.
    let k87 = json!({"type":"bheart.keyset/2","kind":"signature","alg":"ml-dsa-87","key_id":k1,"verifying_key_b64u":b64u(&vk1)});
    let d = raw_keyset(&dir.join("k87"), &k1, &k87);
    let raw87 = raw_verify(
        "e keyset-alg-ml-dsa-87 (recorded)",
        &bin,
        &k1,
        &file,
        &sig_path,
        &d,
    );
    println!("compat e keyset-alg-ml-dsa-87: the pinned bsigner accepted = {raw87}; keys-door's writer refuses this keyset");
    assert!(crate::verify::public_keyset(&k87).is_err());
    // (f) unexpected private fields. RECORDED: the pinned bsigner reads past
    // them. keys-door's writer refuses the keyset, and refuses before any spawn.
    let mut private = ks1.clone();
    private["sealed_b64u"] = json!("AAAA");
    private["seed"] = json!("AAAA");
    private["secret"] = json!(true);
    let d = raw_keyset(&dir.join("private"), &k1, &private);
    let rawp = raw_verify(
        "f keyset-private-fields (recorded)",
        &bin,
        &k1,
        &file,
        &sig_path,
        &d,
    );
    println!("compat f keyset-private-fields: the pinned bsigner accepted = {rawp}; keys-door's writer refuses this keyset");
    for field in [
        "sealed_b64u",
        "seed",
        "secret",
        "verifying_key_bytes",
        "law",
    ] {
        let mut ks = ks1.clone();
        ks[field] = json!("x");
        let e = crate::verify::public_keyset(&ks).unwrap_err();
        assert!(e.contains("not public-only") && e.contains(field), "{e}");
    }
    // bsigner given such a keyset is not consulted: a sentinel in its place
    // would leave a mark if it ran
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mark = dir.join("sentinel-ran");
        let sentinel = dir.join("sentinel.sh");
        fs::write(
            &sentinel,
            format!(
                "#!/bin/sh\ntouch {}\nprintf '{{\"verified\":true}}'\n",
                mark.display()
            ),
        )
        .unwrap();
        fs::set_permissions(&sentinel, fs::Permissions::from_mode(0o755)).unwrap();
        fs::create_dir_all(dir.join("scratch")).unwrap();
        let e =
            crate::verify::run_verify(&sentinel, &dir.join("scratch"), &private, &sig, &rec.bytes)
                .unwrap_err();
        assert!(e.contains("not public-only"), "{e}");
        assert!(
            !mark.exists(),
            "bsigner was consulted with a keyset that is not public-only"
        );
        // control: the sentinel runs, and leaves its mark, for an exact keyset
        let _ = crate::verify::run_verify(&sentinel, &dir.join("scratch"), &ks1, &sig, &rec.bytes);
        assert!(
            mark.exists(),
            "control: the sentinel never ran, so its silence above proved nothing"
        );
    }
    // and through keys-door with the pinned binary, end to end: accept
    let v = real_verifiers(&dir.join("scratch"));
    let o = v
        .check_sig(&Sig::Bheart(sig.clone()), Some(&b64u(&vk1)), &rec.bytes)
        .unwrap();
    assert_eq!((o.fips204, o.bsigner), (true, Ok(true)));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn signed_at_ms_feeds_nothing() {
    let h = hkey(0);
    let g = release_ids(1, None, std::slice::from_ref(&h.id), "at-ms");
    let base = hsign(h, &g.bytes);
    let mut zero = base.clone();
    zero.signed_at_ms = 0;
    let mut far = base.clone();
    far.signed_at_ms = 253_402_300_799_999; // 9999-12-31T23:59:59.999Z
    let scratch = tmpdir("at-ms");
    let v = verifiers(&scratch);
    let verdicts: Vec<_> = [&base, &zero, &far]
        .iter()
        .map(|s| {
            let p = parse_envelope(&henvelope(&g, (*s).clone(), &h.vk), ORIGIN, RP).unwrap();
            (p.pre.clone(), v.verify(&p))
        })
        .collect();
    for (pre, r) in &verdicts {
        assert_eq!(pre, &verdicts[0].0, "the prechecked parts are the same");
        assert_eq!(r, &Ok(h.id.clone()));
    }
    // on the door: all three offered at once are one record, one signer, no fork
    let fx = fx_pinned("at-ms-door", g.sha3, std::slice::from_ref(&h.id));
    fx.offer(&g);
    for (i, s) in [&base, &zero, &far].iter().enumerate() {
        fx.inbox(&format!("{i}.json"), &henvelope(&g, (*s).clone(), &h.vk));
    }
    let mut door = fx.door_with(verifiers(&fx.dir.join("scratch")));
    door.poll(true);
    let hl = fx.health();
    assert_eq!(hl.seq, Some(1), "{:?}", door.notes());
    assert!(hl.equivocation.is_none());
    let _ = fs::remove_dir_all(&scratch);
}

#[test]
fn key_id_is_consistency_never_authority() {
    let h = hkey(0);
    // a bheart key id is not a signer id: not in a record, not in a config
    let g = release_ids(1, None, std::slice::from_ref(&h.id), "kid");
    let mut r = g.record.clone();
    r.signers = vec![h.key_id.clone()];
    assert_eq!(r.validate().unwrap_err().name(), "bad_field");
    let fxk = fx_pinned("kid-cfg", g.sha3, std::slice::from_ref(&h.id));
    let mut cfg = fxk.cfg.clone();
    cfg.genesis_signers = vec![h.key_id.clone()];
    assert!(cfg.validate().unwrap_err().starts_with("genesis_signers"));
    // the only authority is the mldsa65: id of the full key: pinning the key
    // id authorizes nothing, even when the signature is good
    let p = parse_envelope(&henvelope(&g, hsign(h, &g.bytes), &h.vk), ORIGIN, RP).unwrap();
    let scratch = tmpdir("kid");
    let stub = Verifiers::with_second(Second::Stub(|p, _| pq::fips204_ok(p)), &scratch);
    let mut verify = |q: &Parsed| stub.verify(q);
    let by_key_id = crate::chain::extends(
        None,
        &p,
        &g.sha3,
        std::slice::from_ref(&h.key_id),
        &mut verify,
    );
    assert_eq!(
        by_key_id.unwrap_err(),
        "no signature by an authorized signer"
    );
    // a matching key id with another key is an id mismatch, before any lattice math
    let mut s = hsign(h, &g.bytes);
    s.key_id = hkey(1).key_id.clone();
    let e = henvelope_with(&g.bytes, Sig::Bheart(s), Some(&h.vk), Hints::default());
    assert_eq!(
        parse_envelope(&e, ORIGIN, RP).unwrap_err(),
        Refusal::IdMismatch
    );
    let _ = fs::remove_dir_all(&scratch);
}

/// The shared fixture (tests/vectors/profile-separation.json, also read by
/// tools/keychain-release/test/bheart.test.mjs): every case's verdict here.
#[test]
fn profile_separation_vector_verdicts() {
    let vector: Value =
        serde_json::from_str(include_str!("../tests/vectors/profile-separation.json")).unwrap();
    let cases = vector["cases"].as_array().unwrap();
    assert!(cases.len() >= 13);
    let scratch = tmpdir("profile-vector");
    let v = verifiers(&scratch);
    for c in cases {
        let name = c["name"].as_str().unwrap();
        let bytes = serde_json::to_vec(&c["envelope"]).unwrap();
        let got = parse_envelope(&bytes, ORIGIN, RP).and_then(|p| v.verify(&p));
        println!(
            "profile {name}: {}",
            match &got {
                Ok(id) => format!("accept {id}"),
                Err(r) => format!("refuse {} ({r})", r.name()),
            }
        );
        match c["expect"].as_str().unwrap() {
            "accept" => assert_eq!(got.as_deref().ok(), c["signer"].as_str(), "{name}"),
            "refuse" => assert!(got.is_err(), "{name}"),
            other => panic!("{other}"),
        }
    }
    // the separation cases are refused for their shape, never by the lattice:
    // no object is read as the other profile
    for (name, want) in [
        ("bheart_type_removed", "unknown_field"),
        ("bheart_type_removed_no_vk", "unknown_field"),
        ("bpq_with_type_added", "unknown_field"),
        ("bpq_with_type_added_and_vk", "unknown_field"),
        ("bpq_with_vk", "bad_field"),
        ("bheart_without_vk", "bad_field"),
    ] {
        let c = cases.iter().find(|c| c["name"] == name).expect(name);
        let r =
            parse_envelope(&serde_json::to_vec(&c["envelope"]).unwrap(), ORIGIN, RP).unwrap_err();
        assert_eq!(r.name(), want, "{name}: {r}");
    }
    let _ = fs::remove_dir_all(&scratch);
}
