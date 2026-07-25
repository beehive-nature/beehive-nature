//! Offline end-to-end suite: a synthetic signed repo drives the whole
//! pipeline — mirror → receipt → restore — against an in-memory rail and a
//! fixture PDS. No network anywhere (house law). The adversarial cases
//! prove the refusal gates: tampered CAR, wrong signer, lying blob bytes,
//! hidden blobs, and idempotent re-runs that must not re-upload.

use sha2::{Digest, Sha256};

use atmirror::cid::{Cid, CODEC_DAG_CBOR, CODEC_RAW};
use atmirror::commit::SigningKey;
use atmirror::did::{identity_from_document, AccountIdentity};
use atmirror::mirror::{mirror, MirrorError};
use atmirror::rail::testrail::MemRail;
use atmirror::rail::Rail;
use atmirror::restore::{restore, Authorship, RestoreError};
use atmirror::state::State;
use atmirror::xrpc::{Pds, XrpcError};

const DID: &str = "did:plc:testqueenbee1234";
const NOW: &str = "2026-07-25T00:00:00Z";

// ─── tiny dag-cbor test encoder (mirror of cbor::testenc, which is
//     crate-private; duplicated here on purpose — fixtures, not product) ──

fn enc_uint(out: &mut Vec<u8>, major: u8, v: u64) {
    let m = major << 5;
    match v {
        0..=23 => out.push(m | v as u8),
        24..=255 => {
            out.push(m | 24);
            out.push(v as u8);
        }
        256..=65535 => {
            out.push(m | 25);
            out.extend_from_slice(&(v as u16).to_be_bytes());
        }
        _ => {
            out.push(m | 26);
            out.extend_from_slice(&(v as u32).to_be_bytes());
        }
    }
}
fn enc_text(out: &mut Vec<u8>, s: &str) {
    enc_uint(out, 3, s.len() as u64);
    out.extend_from_slice(s.as_bytes());
}
fn enc_bytes(out: &mut Vec<u8>, b: &[u8]) {
    enc_uint(out, 2, b.len() as u64);
    out.extend_from_slice(b);
}
fn enc_null(out: &mut Vec<u8>) {
    out.push(0xf6);
}
fn enc_link(out: &mut Vec<u8>, cid: &Cid) {
    enc_uint(out, 6, 42);
    let raw = cid.to_bytes();
    enc_uint(out, 2, raw.len() as u64 + 1);
    out.push(0x00);
    out.extend_from_slice(&raw);
}
fn enc_map(out: &mut Vec<u8>, n: u64) {
    enc_uint(out, 5, n);
}
fn enc_array(out: &mut Vec<u8>, n: u64) {
    enc_uint(out, 4, n);
}

fn cid_of(data: &[u8], codec: u64) -> Cid {
    Cid {
        codec,
        digest: Sha256::digest(data).into(),
    }
}

fn base58btc_encode(data: &[u8]) -> String {
    const ALPHA: &[u8; 58] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut digits: Vec<u8> = Vec::new();
    for &byte in data {
        let mut carry = byte as u32;
        for d in digits.iter_mut() {
            let v = (*d as u32) * 256 + carry;
            *d = (v % 58) as u8;
            carry = v / 58;
        }
        while carry > 0 {
            digits.push((carry % 58) as u8);
            carry /= 58;
        }
    }
    let mut s: String = data.iter().take_while(|&&b| b == 0).map(|_| '1').collect();
    for &d in digits.iter().rev() {
        s.push(ALPHA[d as usize] as char);
    }
    s
}

// ─── fixture repo ────────────────────────────────────────────────────────

struct Fixture {
    car: Vec<u8>,
    commit_cid: Cid,
    blob_bytes: Vec<u8>,
    blob_cid: Cid,
    hidden_blob_bytes: Vec<u8>,
    hidden_blob_cid: Cid,
    identity: AccountIdentity,
}

/// A complete signed repo: commit → 1 MST node → 2 records; record 1
/// embeds `blob`, record 2 embeds `hidden_blob` (which listBlobs will
/// omit — the record-scan must still find it).
fn fixture() -> Fixture {
    let sk = k256::ecdsa::SigningKey::from_slice(&[42u8; 32]).unwrap();

    let blob_bytes = b"png bytes png bytes".to_vec();
    let blob_cid = cid_of(&blob_bytes, CODEC_RAW);
    let hidden_blob_bytes = b"the blob the host forgot to list".to_vec();
    let hidden_blob_cid = cid_of(&hidden_blob_bytes, CODEC_RAW);

    // record 1: a post with a blob embed.
    let mut rec1 = Vec::new();
    enc_map(&mut rec1, 2);
    text_kv(&mut rec1, "$type", "app.bsky.feed.post");
    enc_text(&mut rec1, "embed");
    enc_map(&mut rec1, 4);
    text_kv(&mut rec1, "$type", "blob");
    enc_text(&mut rec1, "mimeType");
    enc_text(&mut rec1, "image/png");
    enc_text(&mut rec1, "ref");
    enc_link(&mut rec1, &blob_cid);
    enc_text(&mut rec1, "size");
    enc_uint(&mut rec1, 0, blob_bytes.len() as u64);
    let rec1_cid = cid_of(&rec1, CODEC_DAG_CBOR);

    // record 2: profile with the hidden blob.
    let mut rec2 = Vec::new();
    enc_map(&mut rec2, 2);
    text_kv(&mut rec2, "$type", "app.bsky.actor.profile");
    enc_text(&mut rec2, "avatar");
    enc_map(&mut rec2, 4);
    text_kv(&mut rec2, "$type", "blob");
    enc_text(&mut rec2, "mimeType");
    enc_text(&mut rec2, "image/jpeg");
    enc_text(&mut rec2, "ref");
    enc_link(&mut rec2, &hidden_blob_cid);
    enc_text(&mut rec2, "size");
    enc_uint(&mut rec2, 0, hidden_blob_bytes.len() as u64);
    let rec2_cid = cid_of(&rec2, CODEC_DAG_CBOR);

    // one MST node holding both records.
    let mut node = Vec::new();
    enc_map(&mut node, 2);
    enc_text(&mut node, "e");
    enc_array(&mut node, 2);
    enc_map(&mut node, 4);
    enc_text(&mut node, "k");
    enc_bytes(&mut node, b"app.bsky.actor.profile/self");
    enc_text(&mut node, "p");
    enc_uint(&mut node, 0, 0);
    enc_text(&mut node, "t");
    enc_null(&mut node);
    enc_text(&mut node, "v");
    enc_link(&mut node, &rec2_cid);
    enc_map(&mut node, 4);
    enc_text(&mut node, "k");
    enc_bytes(&mut node, b"app.bsky.feed.post/3kaaaaaaaaa2a");
    enc_text(&mut node, "p");
    enc_uint(&mut node, 0, 9); // shares "app.bsky." with previous key
    enc_text(&mut node, "t");
    enc_null(&mut node);
    enc_text(&mut node, "v");
    enc_link(&mut node, &rec1_cid);
    enc_text(&mut node, "l");
    enc_null(&mut node);
    let node_cid = cid_of(&node, CODEC_DAG_CBOR);

    // unsigned commit → sign → signed commit (sig appended, order kept).
    let mut unsigned = Vec::new();
    enc_map(&mut unsigned, 5);
    enc_text(&mut unsigned, "did");
    enc_text(&mut unsigned, DID);
    enc_text(&mut unsigned, "rev");
    enc_text(&mut unsigned, "3lfixture0001");
    enc_text(&mut unsigned, "data");
    enc_link(&mut unsigned, &node_cid);
    enc_text(&mut unsigned, "prev");
    enc_null(&mut unsigned);
    enc_text(&mut unsigned, "version");
    enc_uint(&mut unsigned, 0, 3);
    use k256::ecdsa::signature::hazmat::PrehashSigner;
    let digest: [u8; 32] = Sha256::digest(&unsigned).into();
    let sig: k256::ecdsa::Signature = sk.sign_prehash(&digest).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let mut commit = Vec::new();
    enc_map(&mut commit, 6);
    enc_text(&mut commit, "did");
    enc_text(&mut commit, DID);
    enc_text(&mut commit, "rev");
    enc_text(&mut commit, "3lfixture0001");
    enc_text(&mut commit, "data");
    enc_link(&mut commit, &node_cid);
    enc_text(&mut commit, "prev");
    enc_null(&mut commit);
    enc_text(&mut commit, "version");
    enc_uint(&mut commit, 0, 3);
    enc_text(&mut commit, "sig");
    enc_bytes(&mut commit, &sig.to_bytes());
    let commit_cid = cid_of(&commit, CODEC_DAG_CBOR);

    // CAR: header + commit + node + rec1 + rec2.
    let mut header = Vec::new();
    enc_map(&mut header, 2);
    enc_text(&mut header, "roots");
    enc_array(&mut header, 1);
    enc_link(&mut header, &commit_cid);
    enc_text(&mut header, "version");
    enc_uint(&mut header, 0, 1);
    let mut car = Vec::new();
    varint(&mut car, header.len() as u64);
    car.extend_from_slice(&header);
    for (cid, data) in [
        (&commit_cid, &commit),
        (&node_cid, &node),
        (&rec1_cid, &rec1),
        (&rec2_cid, &rec2),
    ] {
        let cb = cid.to_bytes();
        varint(&mut car, (cb.len() + data.len()) as u64);
        car.extend_from_slice(&cb);
        car.extend_from_slice(data);
    }

    // identity via a DID-document fixture (same path production takes).
    let point = sk.verifying_key().to_encoded_point(true);
    let mut key_payload = vec![0xe7, 0x01];
    key_payload.extend_from_slice(point.as_bytes());
    let key_multibase = format!("z{}", base58btc_encode(&key_payload));
    let doc = serde_json::json!({
        "id": DID,
        "alsoKnownAs": ["at://queen.test"],
        "verificationMethod": [{
            "id": format!("{DID}#atproto"),
            "type": "Multikey",
            "controller": DID,
            "publicKeyMultibase": key_multibase,
        }],
        "service": [{
            "id": "#atproto_pds",
            "type": "AtprotoPersonalDataServer",
            "serviceEndpoint": "https://pds.fixture.test"
        }]
    });
    let identity = identity_from_document(DID, &doc).unwrap();

    Fixture {
        car,
        commit_cid,
        blob_bytes,
        blob_cid,
        hidden_blob_bytes,
        hidden_blob_cid,
        identity,
    }
}

fn text_kv(out: &mut Vec<u8>, k: &str, v: &str) {
    enc_text(out, k);
    enc_text(out, v);
}

fn varint(out: &mut Vec<u8>, mut v: u64) {
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
}

// ─── fixture PDS ─────────────────────────────────────────────────────────

struct FakePds {
    car: Vec<u8>,
    latest: (String, String),
    /// What listBlobs admits to (deliberately omits the hidden blob).
    listed: Vec<String>,
    blobs: std::collections::BTreeMap<String, Vec<u8>>,
    deny_blobs: Vec<String>,
}

impl FakePds {
    fn from_fixture(f: &Fixture) -> FakePds {
        let mut blobs = std::collections::BTreeMap::new();
        blobs.insert(f.blob_cid.to_string_b32(), f.blob_bytes.clone());
        blobs.insert(
            f.hidden_blob_cid.to_string_b32(),
            f.hidden_blob_bytes.clone(),
        );
        FakePds {
            car: f.car.clone(),
            latest: (f.commit_cid.to_string_b32(), "3lfixture0001".into()),
            listed: vec![f.blob_cid.to_string_b32()], // hidden one omitted!
            blobs,
            deny_blobs: Vec::new(),
        }
    }
}

impl Pds for FakePds {
    fn get_repo(&self, _did: &str) -> Result<Vec<u8>, XrpcError> {
        Ok(self.car.clone())
    }
    fn get_latest_commit(&self, _did: &str) -> Result<(String, String), XrpcError> {
        Ok(self.latest.clone())
    }
    fn list_blobs(&self, _did: &str) -> Result<Vec<String>, XrpcError> {
        Ok(self.listed.clone())
    }
    fn get_blob(&self, _did: &str, cid: &str) -> Result<Vec<u8>, XrpcError> {
        if self.deny_blobs.iter().any(|d| d == cid) {
            return Err(XrpcError::Status {
                status: 404,
                endpoint: "com.atproto.sync.getBlob".into(),
            });
        }
        self.blobs.get(cid).cloned().ok_or(XrpcError::Status {
            status: 404,
            endpoint: "com.atproto.sync.getBlob".into(),
        })
    }
}

// ─── the suite ───────────────────────────────────────────────────────────

#[test]
fn mirror_verifies_uploads_and_receipts() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };

    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();
    assert_eq!(report.commit_cid, f.commit_cid.to_string_b32());
    assert_eq!(report.records, 2);
    assert_eq!(report.verified_blocks, 4);
    assert!(!report.car_reused);
    // Both blobs mirrored — including the one listBlobs hid.
    assert_eq!(report.blobs_uploaded, 2);
    assert_eq!(report.receipt.media.len(), 2);
    assert!(report.missing_blobs.is_empty());
    assert!(report.corrupt_blobs.is_empty());
    // Receipt binding (A5) and anchor integrity.
    assert!(report.receipt.binding_ok());
    let anchor = report.receipt.arweave.as_ref().unwrap();
    assert_eq!(anchor.byte_length, Some(f.car.len() as u64));
    let car_back = rail.get(&anchor.tx_id).unwrap();
    assert_eq!(car_back, f.car);
    // CAR uploads: 1 car + 2 blobs.
    assert_eq!(rail.put_count, 3);
}

#[test]
fn rerun_is_idempotent_no_reupload() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let first = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();
    let puts_after_first = rail.put_count;
    let second = mirror(
        &pds,
        &f.identity,
        &mut rail,
        &mut state,
        "2026-07-26T00:00:00Z",
    )
    .unwrap();
    assert!(second.car_reused);
    assert_eq!(
        rail.put_count, puts_after_first,
        "re-run must not re-upload"
    );
    // Idempotent = same receipt, byte-stable (original createdAt kept).
    assert_eq!(second.receipt, first.receipt);
}

#[test]
fn tampered_car_is_refused() {
    let f = fixture();
    let mut pds = FakePds::from_fixture(&f);
    let last = pds.car.len() - 1;
    pds.car[last] ^= 0x01;
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    match mirror(&pds, &f.identity, &mut rail, &mut state, NOW) {
        Err(MirrorError::Refused(why)) => assert!(why.contains("CAR verification"), "{why}"),
        other => panic!("expected refusal, got {other:?}"),
    }
    assert_eq!(rail.put_count, 0, "nothing may upload after a refusal");
}

#[test]
fn wrong_signing_key_is_refused() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    // Identity whose key is NOT the fixture signer.
    let other = k256::ecdsa::SigningKey::from_slice(&[9u8; 32]).unwrap();
    let point = other.verifying_key().to_encoded_point(true);
    let mut payload = vec![0xe7, 0x01];
    payload.extend_from_slice(point.as_bytes());
    let mut identity = f.identity.clone();
    identity.signing_key_multibase = format!("z{}", base58btc_encode(&payload));
    identity.signing_key = SigningKey::from_multibase(&identity.signing_key_multibase).unwrap();

    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    match mirror(&pds, &identity, &mut rail, &mut state, NOW) {
        Err(MirrorError::Refused(why)) => assert!(why.contains("commit signature"), "{why}"),
        other => panic!("expected refusal, got {other:?}"),
    }
    assert_eq!(rail.put_count, 0);
}

#[test]
fn denied_blob_is_reported_not_fatal() {
    let f = fixture();
    let mut pds = FakePds::from_fixture(&f);
    pds.deny_blobs.push(f.blob_cid.to_string_b32());
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();
    assert_eq!(report.missing_blobs, vec![f.blob_cid.to_string_b32()]);
    assert_eq!(report.blobs_uploaded, 1); // the hidden one still made it
    assert_eq!(report.receipt.media.len(), 1);
}

#[test]
fn lying_blob_bytes_are_refused_per_blob() {
    let f = fixture();
    let mut pds = FakePds::from_fixture(&f);
    pds.blobs
        .insert(f.blob_cid.to_string_b32(), b"not the real bytes".to_vec());
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();
    assert_eq!(report.corrupt_blobs, vec![f.blob_cid.to_string_b32()]);
    // The corrupt bytes were never uploaded.
    assert!(report
        .receipt
        .media
        .iter()
        .all(|m| m.source_blob_cid.as_deref() != Some(&f.blob_cid.to_string_b32()[..])));
}

#[test]
fn restore_round_trips_from_rail_alone() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();

    // No PDS from here on. Rail + receipt + signing key only.
    let outcome = restore(&report.receipt, &rail, Some(&f.identity.signing_key)).unwrap();
    assert_eq!(outcome.did, DID);
    assert_eq!(outcome.records, 2);
    assert_eq!(outcome.car_bytes, f.car);
    assert_eq!(outcome.blobs.len(), 2);
    assert!(outcome.blob_failures.is_empty());
    assert_eq!(outcome.authorship, Authorship::Verified);
}

#[test]
fn restore_without_key_runs_steps_1_to_5_and_reports_step_6_not_performed() {
    // CC-1 (offline-or-fail default), empirical leg: with NO key, §8 steps
    // 1–5 still run at full strictness and the outcome carries an explicit
    // NOT PERFORMED for step 6 — never a silent resolve, never a spurious
    // failure. The structural leg is the module boundary itself: restore.rs
    // imports no DID resolver and no PDS client.
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();

    let outcome = restore(&report.receipt, &rail, None).unwrap();
    assert_eq!(outcome.authorship, Authorship::NotPerformed);
    // Steps 1–5 all ran: CAR re-hashed and complete, blobs verified.
    assert_eq!(outcome.records, 2);
    assert_eq!(outcome.car_bytes, f.car);
    assert_eq!(outcome.blobs.len(), 2);
    assert!(outcome.blob_failures.is_empty());

    // And steps 1–5 keep their teeth without a key: a tampered rail copy
    // is still rejected in keyless mode.
    let addr = report.receipt.arweave.as_ref().unwrap().tx_id.clone();
    let mut tampered = rail.stored.get(&addr).unwrap().clone();
    let last = tampered.len() - 1;
    tampered[last] ^= 0x01;
    rail.stored.insert(addr, tampered);
    assert!(matches!(
        restore(&report.receipt, &rail, None),
        Err(RestoreError::Rejected(_))
    ));
}


#[test]
fn restore_rejects_wrong_key_and_bad_binding() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();

    let other = k256::ecdsa::SigningKey::from_slice(&[9u8; 32]).unwrap();
    let wrong = SigningKey::Secp256k1(*other.verifying_key());
    assert!(matches!(
        restore(&report.receipt, &rail, Some(&wrong)),
        Err(RestoreError::Rejected(_))
    ));

    let mut bad = report.receipt.clone();
    bad.content_cid = "bafyreiwrong".into();
    assert!(matches!(
        restore(&bad, &rail, Some(&f.identity.signing_key)),
        Err(RestoreError::Rejected(_))
    ));
}

#[test]
fn restore_flags_tampered_rail_copy() {
    let f = fixture();
    let pds = FakePds::from_fixture(&f);
    let mut rail = MemRail::default();
    let mut state = State {
        did: DID.into(),
        ..State::default()
    };
    let report = mirror(&pds, &f.identity, &mut rail, &mut state, NOW).unwrap();

    // Tamper with the rail's stored CAR copy.
    let addr = report.receipt.arweave.as_ref().unwrap().tx_id.clone();
    let mut tampered = rail.stored.get(&addr).unwrap().clone();
    let last = tampered.len() - 1;
    tampered[last] ^= 0x01;
    rail.stored.insert(addr, tampered);

    match restore(&report.receipt, &rail, Some(&f.identity.signing_key)) {
        Err(RestoreError::Rejected(why)) => assert!(why.contains("sha256"), "{why}"),
        other => panic!("expected rejection, got {other:?}"),
    }
}
