//! The independent verifier — a second, differently-coded reader of the
//! same laws, cross-checked against `resolve_did`.
//!
//! What "independent" honestly means here: this file does NOT reuse the
//! library's chain walker, its arbitration code, or its explicit
//! `signedBy` index dispatch. It finds the authorized key by TRYING EVERY
//! key in the predecessor keyset, explores successors depth-first, and
//! picks winners by recomputing priority from scratch. It shares the
//! underlying sha2 / ml-dsa / ed25519-dalek primitives (a third
//! cryptographic implementation would be a different project, not a
//! verifier) and it shares the SPEC — so this catches coding slips and
//! walker bugs, not spec disagreements. That limit is stated here so
//! nobody reads this file as more than it is.
//!
//! The differential law: for every scenario and every adversarial
//! mutation, the two verifiers agree — same accept with the same head
//! hash, or both refuse. Mutation classes: flipped bytes in ops, flipped
//! bytes in the genesis, reordered inputs, withheld middle ops, foreign
//! ops, duplicated ops.

mod common;

use bzdid::{resolve_did, BzDidError, DidState, GenesisOp, KeyAlg, KeyCard, RotateOp};
use common::{scenario, signed_rotate, TestKey, T0, V1};
use sha2::{Digest, Sha256};

// ------------------------------------------------------------------
// The independent reader
// ------------------------------------------------------------------

enum Ind {
    /// resolved: head state hash
    Head([u8; 32]),
    /// refused (any reason — the differential checks accept/refuse and
    /// head agreement, not message equality)
    Refused,
}

/// Verify a signature by trying EVERY key of the predecessor keyset —
/// no index dispatch, no shared helper.
fn any_key_verifies(pred: &DidState, msg: &[u8], sig: &[u8]) -> bool {
    for card in &pred.rotation_keys {
        let ok = match card.alg {
            KeyAlg::Ed25519 => {
                if card.key.len() != 32 || sig.len() != 64 {
                    continue;
                }
                let mut pk = [0u8; 32];
                pk.copy_from_slice(&card.key);
                let Ok(vk) = ed25519_dalek::VerifyingKey::from_bytes(&pk) else {
                    continue;
                };
                let mut sb = [0u8; 64];
                sb.copy_from_slice(sig);
                let sig = ed25519_dalek::Signature::from_bytes(&sb);
                vk.verify_strict(msg, &sig).is_ok()
            }
            KeyAlg::MlDsa65 => {
                if card.key.len() != 1952 || sig.len() != 3309 {
                    continue;
                }
                let Ok(enc) =
                    ml_dsa::EncodedVerifyingKey::<ml_dsa::MlDsa65>::try_from(&card.key[..])
                else {
                    continue;
                };
                let vk = ml_dsa::VerifyingKey::<ml_dsa::MlDsa65>::decode(&enc);
                let Ok(signature) = ml_dsa::Signature::<ml_dsa::MlDsa65>::try_from(sig) else {
                    continue;
                };
                use ml_dsa::Verifier as _;
                vk.verify(msg, &signature).is_ok()
            }
        };
        if ok {
            return true;
        }
    }
    false
}

/// Which predecessor-key INDEX verifies this op (None if none does) —
/// priority recomputed from scratch.
fn verifying_index(pred: &DidState, op: &RotateOp) -> Option<usize> {
    let msg = bzdid::rotate_body_bytes(op).ok()?;
    for (i, card) in pred.rotation_keys.iter().enumerate() {
        let ok = match card.alg {
            KeyAlg::Ed25519 => {
                let mut pk = [0u8; 32];
                if card.key.len() != 32 || op.sig.len() != 64 {
                    continue;
                }
                pk.copy_from_slice(&card.key);
                let Ok(vk) = ed25519_dalek::VerifyingKey::from_bytes(&pk) else {
                    continue;
                };
                let mut sb = [0u8; 64];
                sb.copy_from_slice(&op.sig);
                let sig = ed25519_dalek::Signature::from_bytes(&sb);
                vk.verify_strict(&msg, &sig).is_ok()
            }
            KeyAlg::MlDsa65 => {
                if card.key.len() != 1952 || op.sig.len() != 3309 {
                    continue;
                }
                let Ok(enc) =
                    ml_dsa::EncodedVerifyingKey::<ml_dsa::MlDsa65>::try_from(&card.key[..])
                else {
                    continue;
                };
                let vk = ml_dsa::VerifyingKey::<ml_dsa::MlDsa65>::decode(&enc);
                let Ok(signature) = ml_dsa::Signature::<ml_dsa::MlDsa65>::try_from(&op.sig[..])
                else {
                    continue;
                };
                use ml_dsa::Verifier as _;
                vk.verify(&msg, &signature).is_ok()
            }
        };
        if ok {
            return Some(i);
        }
    }
    None
}

fn state_after(_pred: &DidState, op: &RotateOp, stored: &[u8]) -> DidState {
    DidState {
        seq: op.seq,
        hash: Sha256::digest(stored).into(),
        last_at: op.at,
        rotation_keys: op.rotation_keys.clone(),
        signing_key: op.signing_key.clone(),
        services: op.services.clone(),
        also_known_as: op.also_known_as.clone(),
        valid_until: op.valid_until,
    }
}

fn applies(pred: &DidState, op: &RotateOp) -> bool {
    op.seq == pred.seq + 1
        && op.prev == pred.hash
        && op.at < pred.valid_until
        && op.at >= pred.last_at
        && verifying_index(pred, op).is_some()
}

/// Depth-first resolution: extend the state by the lowest-index verified
/// successor, recursing; returns the terminal head hash.
fn independent_resolve(
    state: &DidState,
    remaining: &[(RotateOp, Vec<u8>)],
) -> Result<[u8; 32], ()> {
    let next = state.seq + 1;
    let candidates: Vec<&(RotateOp, Vec<u8>)> = remaining
        .iter()
        .filter(|(op, _)| op.seq == next && op.prev == state.hash && applies(state, op))
        .collect();
    if candidates.is_empty() {
        // terminal — but any handed op beyond the head is withholding
        for (op, _) in remaining {
            if op.seq > state.seq {
                return Err(());
            }
        }
        return Ok(state.hash);
    }
    // min verifying index wins; same-min different-bytes is equivocation
    let mut best: Option<usize> = None;
    let mut winners: Vec<&(RotateOp, Vec<u8>)> = Vec::new();
    for c in &candidates {
        let idx = verifying_index(state, &c.0).unwrap();
        match best {
            None => {
                best = Some(idx);
                winners.push(c);
            }
            Some(b) if idx < b => {
                best = Some(idx);
                winners.clear();
                winners.push(c);
            }
            Some(b) if idx == b => winners.push(c),
            Some(_) => {}
        }
    }
    if winners.len() != 1 {
        return Err(());
    }
    let (op, stored) = winners[0];
    let ns = state_after(state, op, stored);
    let rest: Vec<(RotateOp, Vec<u8>)> = remaining
        .iter()
        .filter(|(o, s)| !(o.seq == op.seq && s == stored))
        .cloned()
        .collect();
    independent_resolve(&ns, &rest)
}

fn independent(genesis_bytes: &[u8], ops: &[Vec<u8>]) -> Ind {
    let genesis = match GenesisOp::parse(genesis_bytes) {
        Ok(g) => g,
        Err(_) => return Ind::Refused,
    };
    let h: [u8; 32] = Sha256::digest(genesis_bytes).into();
    let state = DidState {
        seq: 0,
        hash: h,
        last_at: 0,
        rotation_keys: genesis.rotation_keys,
        signing_key: genesis.signing_key,
        services: genesis.services,
        also_known_as: genesis.also_known_as,
        valid_until: genesis.valid_until,
    };
    let mut parsed = Vec::new();
    for b in ops {
        // a byte-identical replay is one op, not an equivocation — dedup
        // (this reader's own rule, coded its own way)
        if parsed.iter().any(|(_, s): &(RotateOp, Vec<u8>)| s == b) {
            continue;
        }
        match RotateOp::parse(b) {
            Ok(op) => parsed.push((op, b.clone())),
            Err(_) => return Ind::Refused,
        }
    }
    match independent_resolve(&state, &parsed) {
        Ok(h) => Ind::Head(h),
        Err(_) => Ind::Refused,
    }
}

// ------------------------------------------------------------------
// The differential
// ------------------------------------------------------------------

fn scenario_ops() -> (common::Scenario, Vec<Vec<u8>>) {
    let s = scenario();
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ml(0xD1).card(), TestKey::ed(0xD2).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let d1 = TestKey::ml(0xD1);
    let (op2, b2) = signed_rotate(
        2,
        op1.hash().unwrap(),
        T0 + 10,
        0,
        vec![TestKey::ed(0xE1).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &d1,
    );
    let e1 = TestKey::ed(0xE1);
    let (_, b3) = signed_rotate(
        3,
        op2.hash().unwrap(),
        T0 + 20,
        0,
        vec![TestKey::ml(0xF1).card()],
        TestKey::ed(0x60).card(),
        V1,
        &e1,
    );
    (s, vec![b1, b2, b3])
}

fn agree(genesis_bytes: &[u8], ops: &[Vec<u8>], did: &bzdid::BzDid) {
    let lib = resolve_did(did, genesis_bytes, ops, None);
    let ind = independent(genesis_bytes, ops);
    match (&lib, &ind) {
        (Ok(r), Ind::Head(h)) => assert_eq!(
            &r.head.hash, h,
            "both accept but different heads — a walker is wrong"
        ),
        (Ok(_), Ind::Refused) => panic!("library accepts, independent refuses"),
        (Err(_), Ind::Head(_)) => panic!("library refuses, independent accepts"),
        (Err(_), Ind::Refused) => {}
    }
}

/// A cheap deterministic PRNG for mutation sites (xorshift) — the estate's
/// law is determinism: the same seed, the same battery, every run.
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

#[test]
fn the_independent_verifier_agrees_on_the_happy_paths() {
    let (s, ops) = scenario_ops();
    agree(&s.genesis_bytes, &ops, &s.did);
    // reorders
    agree(
        &s.genesis_bytes,
        &[ops[1].clone(), ops[0].clone(), ops[2].clone()],
        &s.did,
    );
    // duplicates
    agree(
        &s.genesis_bytes,
        &[
            ops[0].clone(),
            ops[0].clone(),
            ops[1].clone(),
            ops[2].clone(),
        ],
        &s.did,
    );
    // withheld middle
    agree(&s.genesis_bytes, &[ops[0].clone(), ops[2].clone()], &s.did);
    // competing successors at one seq (priority + equivocation)
    let (op1, b1) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![TestKey::ed(0x71).card()],
        TestKey::ed(0x5E).card(),
        V1,
        &s.r1,
    );
    let (_, b0) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        0,
        vec![TestKey::ml(0x72).card()],
        TestKey::ed(0x5F).card(),
        V1,
        &s.r0,
    );
    let (thief2, b1t) = signed_rotate(
        2,
        op1.hash().unwrap(),
        T0 + 5,
        0,
        vec![TestKey::ed(0x73).card()],
        TestKey::ed(0x60).card(),
        V1,
        &TestKey::ed(0x71),
    );
    let _ = thief2;
    agree(&s.genesis_bytes, &[b1.clone(), b0.clone()], &s.did);
    agree(&s.genesis_bytes, &[b0, b1.clone()], &s.did);
    agree(&s.genesis_bytes, &[b1, b1t], &s.did);
}

#[test]
fn the_independent_verifier_agrees_under_mutation() {
    let (s, ops) = scenario_ops();
    let mut rng = Rng(0x00BE_EF20_2610_1010);
    let mut accepted = 0usize;
    let mut refused = 0usize;
    for round in 0..200 {
        let mut mutated: Vec<Vec<u8>> = ops.clone();
        let target = rng.below(mutated.len());
        let byte_idx = rng.below(mutated[target].len());
        mutated[target][byte_idx] ^= 1u8 << (rng.next() % 8) as u32;
        if rng.next().is_multiple_of(5) {
            // sometimes also reorder
            let j = rng.below(mutated.len());
            mutated.swap(0, j);
        }
        if rng.next().is_multiple_of(7) {
            // sometimes drop an op (withholding shape)
            let _ = mutated.remove(rng.below(mutated.len()));
        }
        if rng.next().is_multiple_of(11) {
            // sometimes duplicate one
            let j = rng.below(mutated.len());
            let d = mutated[j].clone();
            mutated.push(d);
        }
        let lib = resolve_did(&s.did, &s.genesis_bytes, &mutated, None);
        if lib.is_ok() {
            accepted += 1;
        } else {
            refused += 1;
        }
        agree(&s.genesis_bytes, &mutated, &s.did);
        let _ = round;
    }
    // both populations non-empty — the mutation actually exercised both
    // verdicts, or the battery is vacuous
    assert!(accepted > 0, "no mutation survived verification: vacuous");
    assert!(refused > 0, "no mutation was refused: vacuous");
}

#[test]
fn the_independent_verifier_agrees_on_genesis_tampering() {
    let (s, ops) = scenario_ops();
    let mut rng = Rng(0xD1D1_D1D1);
    for _ in 0..100 {
        let mut g = s.genesis_bytes.clone();
        let i = rng.below(g.len());
        let b = rng.below(8);
        g[i] ^= 1u8 << b;
        agree(&g, &ops, &s.did);
    }
}

#[test]
fn the_independent_reader_shares_the_wrong_key_refusal() {
    // sanity: any_key_verifies must NOT accept a foreign signature
    let s = scenario();
    let st = DidState::from_genesis(&s.genesis, &s.genesis_bytes);
    let (op, _) = signed_rotate(
        1,
        s.genesis_hash,
        T0,
        1,
        vec![s.r2.card()],
        KeyCard::new(KeyAlg::Ed25519, vec![0x5E; 32]).unwrap(),
        V1,
        &TestKey::ed(0x99), // a key NOWHERE in the keyset
    );
    assert!(!any_key_verifies(
        &st,
        &bzdid::rotate_body_bytes(&op).unwrap(),
        &op.sig
    ));
    assert!(verifying_index(&st, &op).is_none());
    // and the wrong-key error really is a signature error in the library
    let bytes = op.build().unwrap();
    assert!(matches!(
        resolve_did(&s.did, &s.genesis_bytes, &[bytes], None),
        Err(bzdid::SuccessionError::InvalidSignature { .. })
    ));
    // BzDidError::SignatureRejected is the underlying refusal shape
    let _ = BzDidError::SignatureRejected;
}
