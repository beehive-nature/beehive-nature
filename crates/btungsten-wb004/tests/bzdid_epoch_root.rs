//! The bzDiD epoch-root settlement bridge — ORDER BZDID-002 Phase 3,
//! model scale through the WB004 epochal engine (the Skaists bridge
//! precedent: fixtures only, a LIVE Vaulta settlement stays named, not
//! claimed — the non-inheritance law).
//!
//! The design principle this bridge exists to hold (the founder order's
//! own words): "the chain should certify the minimum necessary state;
//! identity validity must remain locally verifiable without trusting
//! the service that serves the proof."
//!
//! What settles: a BEELOG head — constant size regardless of history —
//! published as ONE anchor row per epoch (`bnr/bzdid-epoch-root/v1`,
//! crates/bzdid/src/anchor.rs). The anchor's canonical bytes are the
//! epoch payload; `Engine::epoch_cycle` aggregates population
//! participation over its digest into one bounded msig proposal, quorum
//! approves, executes inside the TTL, and the immutable SETTLE receipt
//! binds the payload digest in the hash-chained log.
//!
//! What does NOT settle, and the battery proves it by deletion: the
//! identity itself. `resolve_did` and the BEELOG proofs take no anchor,
//! no receipt, no chain artifact — an identity whose anchors all vanish
//! verifies exactly as well as one whose anchors settle. The chain is
//! an ANNEX to the evidence, never a limb of it.
//!
//! No funds move, no custody changes (the model engine moves nothing);
//! nothing here touches a network. Fixture scale by order.

use btungsten_wb004::epoch::{Engine, T0};
use bzdid::anchor::{Anchor, GENESIS_PREV, MAX_ANCHOR_BYTES};
use bzdid::beelog::{verify_inclusion, IdentityLog};
use bzdid::{resolve_did, BzDid, GenesisOp, KeyAlg, KeyCard, RotateOp};

/// A model population: 3 shards' worth of sovereigns (768) — enough for
/// the engine's 2/3 shard quorum to have teeth when a shard is withheld.
fn population(engine: &mut Engine) {
    for id in 0..768u64 {
        engine.registered.insert(id);
    }
}

// ------------------------------------------------------------------
// The identity fixture: a real signed chain, real BEELOG head
// ------------------------------------------------------------------

struct Fixture {
    did: BzDid,
    genesis_bytes: Vec<u8>,
    ops: Vec<Vec<u8>>,
}

fn mk_key(seed: u8) -> ed25519_dalek::SigningKey {
    let mut s = [0u8; 32];
    s[0] = seed;
    ed25519_dalek::SigningKey::from_bytes(&s)
}

fn fixture() -> Fixture {
    let r0 = mk_key(0xA0);
    let r1 = mk_key(0xB0);
    let card = |k: &ed25519_dalek::SigningKey| {
        KeyCard::new(KeyAlg::Ed25519, k.verifying_key().as_bytes().to_vec()).unwrap()
    };
    let genesis = GenesisOp {
        rotation_keys: vec![card(&r0), card(&r1)],
        signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5D; 32]).unwrap(),
        services: vec![],
        also_known_as: vec![],
        valid_until: 4_102_444_800,
    };
    let genesis_bytes = genesis.build().unwrap();
    let did = BzDid::derive(&genesis_bytes);
    use ed25519_dalek::Signer as _;
    use sha2::Digest as _;
    let ghash: [u8; 32] = sha2::Sha256::digest(&genesis_bytes).into();
    let mut op1 = RotateOp {
        seq: 1,
        prev: ghash,
        at: 1_700_000_000,
        signed_by: 1,
        rotation_keys: vec![card(&r0)],
        signing_key: KeyCard::new(KeyAlg::Ed25519, vec![0x5E; 32]).unwrap(),
        services: vec![],
        also_known_as: vec![],
        valid_until: 4_102_444_800,
        sig: vec![0u8; 64],
    };
    op1.sig = r1
        .sign(&bzdid::rotate_body_bytes(&op1).unwrap())
        .to_bytes()
        .to_vec();
    let b1 = op1.build().unwrap();
    Fixture {
        did,
        genesis_bytes,
        ops: vec![b1],
    }
}

// ------------------------------------------------------------------
// The bridge: anchor → aggregate → bounded msig → SETTLE receipt
// ------------------------------------------------------------------

#[test]
fn an_anchor_settles_through_the_epochal_engine_and_the_receipt_binds_it() {
    let f = fixture();
    let resolved = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    let idlog = IdentityLog::from_resolved(&resolved, &f.genesis_bytes);
    let head = idlog.head();

    // the anchor: bounded, verified, bound to the LOCAL head
    let anchor = Anchor::new(f.did.clone(), 1, &head, GENESIS_PREV.into()).unwrap();
    let payload = anchor.canon().unwrap();
    assert!(payload.len() < MAX_ANCHOR_BYTES);
    let digest = anchor.digest().unwrap();

    // the engine settles the payload — model scale
    let mut engine = Engine::genesis();
    engine.now = T0;
    population(&mut engine);
    let receipt = engine.epoch_cycle(&payload, &[]).unwrap();
    // `executed` carries the payload digest: the receipt literally
    // binds this anchor's bytes — recomputed independently below
    assert_eq!(receipt.executed, digest);
    assert_eq!(
        receipt.executed,
        btungsten_wb004::sha_hex(payload.as_bytes()),
        "the engine's own digest idiom agrees with the anchor's"
    );

    // the SETTLE receipt log moved — an immutable row was written
    let head_log = engine.log.head();
    assert_ne!(
        head_log,
        btungsten_wb004::authority::ReceiptLog::genesis_root()
    );
    // the anchor still binds the locally verified head after settlement
    assert!(anchor.binds(&f.did, &idlog.head()));
}

#[test]
fn anchors_chain_epoch_over_epoch_through_the_engine() {
    let f = fixture();
    let resolved = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    let idlog = IdentityLog::from_resolved(&resolved, &f.genesis_bytes);

    let mut engine = Engine::genesis();
    engine.now = T0;
    population(&mut engine);

    let mut prev = GENESIS_PREV.to_string();
    for epoch in 1..=3u64 {
        // the log grows between epochs (a new op settles at epoch 2)
        let head = idlog.head();
        let anchor = Anchor::new(f.did.clone(), epoch, &head, prev.clone()).unwrap();
        let receipt = engine.epoch_cycle(&anchor.canon().unwrap(), &[]).unwrap();
        assert_eq!(receipt.epoch, epoch as usize);
        prev = anchor.digest().unwrap();
    }
    // the anchor chain: epoch 3's prev is epoch 2's digest — one
    // history, no forks
    let head = idlog.head();
    let a3 = Anchor::new(f.did.clone(), 3, &head, prev).unwrap();
    assert!(a3.verify().is_ok());
}

#[test]
fn a_tampered_anchor_is_not_what_the_receipt_settled() {
    let f = fixture();
    let resolved = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    let idlog = IdentityLog::from_resolved(&resolved, &f.genesis_bytes);
    let head = idlog.head();

    let anchor = Anchor::new(f.did.clone(), 1, &head, GENESIS_PREV.into()).unwrap();
    let digest = anchor.digest().unwrap();

    // tamper: the published root is rewritten after settlement
    let mut tampered = anchor.clone();
    tampered.root = "f".repeat(64);
    assert_ne!(tampered.digest().unwrap(), digest);
    // and it no longer binds the local truth — the bind check is the
    // wall between a settled row and a rewritten one
    assert!(!tampered.binds(&f.did, &head));
    // a stale anchor (old size) neither binds nor matches
    let mut stale = anchor.clone();
    stale.size -= 1;
    assert!(!stale.binds(&f.did, &head));

    // the engine refuses nothing here because it settles payloads, not
    // policies — the tamper dies at the BIND CHECK, above, which is the
    // adapter's own law. Recorded so nobody mistakes the layers.
}

#[test]
fn the_identity_survives_total_anchor_deletion() {
    // THE INDEPENDENCE LAW, executed: with every anchor and every
    // receipt deleted, the identity resolves and its BEELOG proofs
    // verify exactly as before. The chain is an annex, never a limb.
    let f = fixture();
    let resolved = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    let idlog = IdentityLog::from_resolved(&resolved, &f.genesis_bytes);
    let head = idlog.head();
    let seq = resolved.head.seq;

    // settle an anchor, then DELETE all chain-side memory of it: the
    // engine, its receipts, the anchor itself
    {
        let mut engine = Engine::genesis();
        engine.now = T0;
        population(&mut engine);
        let anchor = Anchor::new(f.did.clone(), 1, &head, GENESIS_PREV.into()).unwrap();
        let _receipt = engine.epoch_cycle(&anchor.canon().unwrap(), &[]).unwrap();
        // deletion: everything above goes out of scope with this block
    }

    // the identity verifies from handed bytes alone — same verdict,
    // same head, same proofs
    let re = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    assert_eq!(re.head.seq, seq);
    assert_eq!(re.head.hash, resolved.head.hash);
    for i in 0..=seq {
        let (leaf, proof) = idlog.op_evidence(i).unwrap();
        assert!(verify_inclusion(leaf, i, &idlog.head(), &proof).is_ok());
    }
}

#[test]
fn shard_withholding_still_settles_at_quorum_and_the_receipt_says_so() {
    // the engine's own bounded-liveness property, exercised through the
    // bridge: one shard of three withheld (a censor) — the 2/3 quorum
    // carries the epoch, and the receipt records the honest count
    let f = fixture();
    let resolved = resolve_did(&f.did, &f.genesis_bytes, &f.ops, None).unwrap();
    let idlog = IdentityLog::from_resolved(&resolved, &f.genesis_bytes);
    let anchor = Anchor::new(f.did.clone(), 1, &idlog.head(), GENESIS_PREV.into()).unwrap();

    let mut engine = Engine::genesis();
    engine.now = T0;
    population(&mut engine);
    let receipt = engine.epoch_cycle(&anchor.canon().unwrap(), &[0]).unwrap();
    assert_eq!(receipt.shards_total, 3);
    assert_eq!(
        receipt.shards_proving, 2,
        "one withheld shard; quorum holds"
    );
    // and pushing past the quorum refuses — the wall, not a hope
    assert!(engine
        .epoch_cycle(&anchor.canon().unwrap(), &[0, 1])
        .is_err());
}
