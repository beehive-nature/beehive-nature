//! Shared test authority — deterministic keys and op builders.
//!
//! The LIBRARY verifies only; these helpers exist so tests can MINT
//! scenarios (including hostile ones) with real signatures. Determinism
//! is total: every key comes from a fixed seed, so the frozen vector in
//! `tests/succession.rs` reproduces byte-for-byte.

use bzdid::{rotate_body_bytes, BzDid, GenesisOp, KeyAlg, KeyCard, RotateOp};
use ed25519_dalek::{Signer, SigningKey};
use ml_dsa::{
    Keypair as _, MlDsa65, Seed as DsaSeed, Signer as MlSigner, SigningKey as MlSigningKey,
};
use sha2::{Digest as _, Sha256};

/// One deterministic signing authority — ed25519 or ml-dsa-65 (the closed
/// registry, both arms exercised).
pub enum TestKey {
    Ed(SigningKey),
    Ml(MlSigningKey<MlDsa65>),
}

#[allow(dead_code)]
impl TestKey {
    pub fn ed(seed_byte: u8) -> TestKey {
        let mut seed = [0u8; 32];
        seed[0] = seed_byte;
        TestKey::Ed(SigningKey::from_bytes(&seed))
    }
    pub fn ml(seed_byte: u8) -> TestKey {
        let mut seed = [0u8; 32];
        seed[0] = seed_byte;
        let seed_arr: DsaSeed = seed.into();
        TestKey::Ml(MlSigningKey::<MlDsa65>::from_seed(&seed_arr))
    }
    pub fn card(&self) -> KeyCard {
        match self {
            TestKey::Ed(sk) => {
                KeyCard::new(KeyAlg::Ed25519, sk.verifying_key().as_bytes().to_vec()).unwrap()
            }
            TestKey::Ml(sk) => {
                KeyCard::new(KeyAlg::MlDsa65, sk.verifying_key().encode().to_vec()).unwrap()
            }
        }
    }
    pub fn sign(&self, msg: &[u8]) -> Vec<u8> {
        match self {
            TestKey::Ed(sk) => sk.sign(msg).to_bytes().to_vec(),
            TestKey::Ml(sk) => sk.try_sign(msg).unwrap().encode().to_vec(),
        }
    }
}

/// Build a fully signed rotation op plus its stored bytes. `signer` is the
/// key at index `signed_by` of the PREDECESSOR keyset — the test must pass
/// the matching pair or resolution will (correctly) refuse.
#[allow(dead_code)]
#[allow(clippy::too_many_arguments)]
pub fn signed_rotate(
    seq: u64,
    prev: [u8; 32],
    at: u64,
    signed_by: u64,
    new_rotation: Vec<KeyCard>,
    new_signing: KeyCard,
    valid_until: u64,
    signer: &TestKey,
) -> (RotateOp, Vec<u8>) {
    let mut op = RotateOp {
        seq,
        prev,
        at,
        signed_by,
        rotation_keys: new_rotation,
        signing_key: new_signing,
        services: vec![],
        also_known_as: vec![],
        valid_until,
        sig: vec![
            0u8;
            if matches!(signer, TestKey::Ml(_)) {
                3309
            } else {
                64
            }
        ],
    };
    let msg = rotate_body_bytes(&op).unwrap();
    op.sig = signer.sign(&msg);
    let bytes = op.build().unwrap();
    (op, bytes)
}

/// The demo identity every scenario forks from: three rotation keys —
/// r0 ml-dsa-65 (the offline recovery authority), r1 ed25519 (the hot
/// device key), r2 ed25519 (second device) — priority by list order.
#[allow(dead_code)]
pub struct Scenario {
    pub genesis: GenesisOp,
    pub genesis_bytes: Vec<u8>,
    pub did: BzDid,
    pub r0: TestKey,
    pub r1: TestKey,
    pub r2: TestKey,
    pub genesis_hash: [u8; 32],
}

pub const T0: u64 = 1_800_000_000; // a plausible "now"
pub const V1: u64 = 4_102_444_800; // 2100-01-01T00:00:00Z

pub fn scenario() -> Scenario {
    let r0 = TestKey::ml(0xA0);
    let r1 = TestKey::ed(0xB0);
    let r2 = TestKey::ed(0xC0);
    let genesis = GenesisOp {
        rotation_keys: vec![r0.card(), r1.card(), r2.card()],
        signing_key: TestKey::ed(0x5D).card(),
        services: vec!["https://did.example".into()],
        also_known_as: vec![],
        valid_until: V1,
    };
    let genesis_bytes = genesis.build().unwrap();
    let did = BzDid::derive(&genesis_bytes);
    let genesis_hash = {
        let h: [u8; 32] = Sha256::digest(&genesis_bytes).into();
        h
    };
    Scenario {
        genesis,
        genesis_bytes,
        did,
        r0,
        r1,
        r2,
        genesis_hash,
    }
}
