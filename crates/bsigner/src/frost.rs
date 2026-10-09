//! The threshold BIP-340 backend behind bsigner (SPEC-BTUNGSTEN-PQ-1 PQ12
//! step 5): FROST signing (BIP-FROST-signing, FROST3) over a ChillDKG key,
//! from chilldkg-rs 0.5.0, which is unaudited and says so.
//!
//! Compiled only with the `frost` feature, so it is absent from the shipped
//! binary until its key ceremony and its shares at rest (PQ09's sealed
//! format) land. It signs and never submits: no network code.
//!
//! The rules it enforces, each by the shape of the code:
//! - a session opens only from a [`VerifiedIntent`] (built only by
//!   `intent::verify_spend`) whose output key is this group's Taproot key,
//!   and only for one of the sighashes bsigner computed itself; the nonce is
//!   bound to that sighash and the Taproot tweak at round 1, so chilldkg
//!   refuses to sign anything else with it;
//! - a session id opens once ([`SessionLog`]);
//! - [`sign`] takes the [`Session`] by value, and chilldkg's secret nonce is
//!   neither Clone nor Copy, so a nonce signs once;
//! - [`finish`] refuses fewer than the threshold of partial signatures, and
//!   releases the signature only after bsigner's own BIP-340 check under the
//!   output key, beside chilldkg's.

use crate::intent::VerifiedIntent;
use crate::taproot;
use chilldkg_rs::dkg::msg::{CoordinatorDKGOutput, DKGOutput};
use chilldkg_rs::sign::{self, PartialSignature, PubNonce, Tweak};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use k256::ProjectivePoint;
use std::collections::BTreeSet;

#[derive(Debug, PartialEq, Eq)]
pub struct FrostError(pub String);

impl std::fmt::Display for FrostError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "refused: {}", self.0)
    }
}

fn refuse<T>(why: impl Into<String>) -> Result<T, FrostError> {
    Err(FrostError(why.into()))
}

fn upstream<T, E: std::fmt::Display>(r: Result<T, E>) -> Result<T, FrostError> {
    r.map_err(|e| FrostError(format!("chilldkg: {e}")))
}

/// The group's Taproot key-path output: BIP-341's TapTweak of the threshold
/// key with no script tree, as the tweak chilldkg applies (x-only) and the
/// output key bsigner's own BIP-341 code computes.
pub fn taproot_output(threshold: &ProjectivePoint) -> Result<(Vec<Tweak>, [u8; 32]), FrostError> {
    let enc = threshold.to_affine().to_encoded_point(true);
    let x: [u8; 32] = enc
        .x()
        .ok_or(FrostError(
            "the threshold key is the point at infinity".into(),
        ))?
        .as_slice()
        .try_into()
        .unwrap();
    let q = taproot::output_key(&x, None).map_err(|e| FrostError(e.to_string()))?;
    Ok((vec![Tweak::xonly(q.tweak)], q.key))
}

/// The session ids a signer has opened. A second open under one id is
/// refused.
#[derive(Default)]
pub struct SessionLog(BTreeSet<[u8; 32]>);

/// One signer's half of one session: one input of one verified intent.
pub struct Session {
    signer: sign::Signer,
    sighash: [u8; 32],
    tweaks: Vec<Tweak>,
}

/// Round 1 for one signer: its public nonce, bound to the sighash of
/// `input` and to the Taproot tweak.
pub fn open(
    share: &DKGOutput,
    intent: &VerifiedIntent,
    input: usize,
    session_id: [u8; 32],
    log: &mut SessionLog,
    random: [u8; 32],
) -> Result<(Session, (usize, PubNonce)), FrostError> {
    let (tweaks, key) = taproot_output(&share.threshold_pubkey)?;
    if &key != intent.output_key() {
        return refuse("the intent spends another key than this group's");
    }
    let Some(&sighash) = intent.sighashes().get(input) else {
        return refuse("the intent has no such input");
    };
    if !log.0.insert(session_id) {
        return refuse("this session id was opened before");
    }
    let mut signer = sign::Signer::new(share);
    let nonce = upstream(signer.step1((Some(sighash.to_vec()), Some(tweaks.clone()), random)))?;
    Ok((
        Session {
            signer,
            sighash,
            tweaks,
        },
        nonce,
    ))
}

/// Round 2 for one signer: its partial signature over the session's
/// sighash. The session, and the secret nonce inside it, is consumed.
pub fn sign(
    mut session: Session,
    relayed: Vec<(usize, PubNonce)>,
) -> Result<(usize, PartialSignature), FrostError> {
    upstream(
        session
            .signer
            .finalize((relayed, session.sighash.to_vec(), session.tweaks.clone())),
    )
}

/// The coordinator's half of one session.
pub struct Relay {
    coordinator: sign::Coordinator,
    t: usize,
    sighash: [u8; 32],
    tweaks: Vec<Tweak>,
    key: [u8; 32],
}

/// Round 1 for the coordinator: checks the signing set and its nonces and
/// returns the list every signer needs for round 2.
pub fn relay(
    group: &CoordinatorDKGOutput,
    intent: &VerifiedIntent,
    input: usize,
    nonces: Vec<(usize, PubNonce)>,
) -> Result<(Relay, Vec<(usize, PubNonce)>), FrostError> {
    let (tweaks, key) = taproot_output(&group.threshold_pubkey)?;
    if &key != intent.output_key() {
        return refuse("the intent spends another key than this group's");
    }
    let Some(&sighash) = intent.sighashes().get(input) else {
        return refuse("the intent has no such input");
    };
    if nonces.len() < group.t {
        return refuse(format!(
            "{} signers, fewer than the threshold of {}",
            nonces.len(),
            group.t
        ));
    }
    let mut coordinator = sign::Coordinator::new(group);
    let relayed = upstream(coordinator.step1(nonces))?;
    Ok((
        Relay {
            coordinator,
            t: group.t,
            sighash,
            tweaks,
            key,
        },
        relayed,
    ))
}

/// Round 2 for the coordinator: the final BIP-340 signature, released only
/// when there are at least the threshold of partial signatures and the
/// signature verifies under the output key by bsigner's own check.
pub fn finish(
    mut r: Relay,
    partials: Vec<(usize, PartialSignature)>,
) -> Result<[u8; 64], FrostError> {
    if partials.len() < r.t {
        return refuse(format!(
            "{} partial signatures, fewer than the threshold of {}",
            partials.len(),
            r.t
        ));
    }
    let sig = upstream(
        r.coordinator
            .step2((partials, r.sighash.to_vec(), r.tweaks)),
    )?;
    let vk = k256::schnorr::VerifyingKey::from_bytes(&r.key)
        .map_err(|_| FrostError("the output key is not on the curve".into()))?;
    let s = k256::schnorr::Signature::try_from(&sig[..])
        .map_err(|_| FrostError("not a BIP-340 signature encoding".into()))?;
    if vk.verify_raw(&r.sighash, &s).is_err() {
        return refuse("the combined signature does not verify under the output key");
    }
    Ok(sig)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{bpq, intent, psbt};
    use chilldkg_rs::dkg::{Coordinator, Participant};
    use k256::Scalar;
    use sha2::{Digest, Sha256};

    /// A deterministic t-of-n ChillDKG session: the coordinator's output and
    /// every participant's. Host keys and randomness are hashes of public
    /// labels; nothing here is a secret anyone holds.
    fn dkg(t: usize, n: usize, label: &str) -> (CoordinatorDKGOutput, Vec<DKGOutput>) {
        let scalar = |s: String| {
            let h: [u8; 32] = Sha256::digest(s.as_bytes()).into();
            Option::<Scalar>::from(<Scalar as k256::elliptic_curve::PrimeField>::from_repr(
                h.into(),
            ))
            .unwrap()
        };
        let hosts: Vec<Scalar> = (0..n)
            .map(|i| scalar(format!("{label} host {i}")))
            .collect();
        let host_pks: Vec<ProjectivePoint> = hosts
            .iter()
            .map(|s| ProjectivePoint::GENERATOR * s)
            .collect();
        let mut ps: Vec<Participant> = hosts
            .iter()
            .map(|s| Participant::new_with_secret(s).unwrap())
            .collect();
        let mut c = Coordinator::new(host_pks.clone(), t).unwrap();
        let m1 = ps
            .iter_mut()
            .enumerate()
            .map(|(i, p)| p.step1((host_pks.clone(), t, [i as u8; 32])).unwrap())
            .collect();
        let r1 = c.step1(m1).unwrap();
        let m2 = ps
            .iter_mut()
            .enumerate()
            .map(|(i, p)| p.step2((r1.clone(), [0x80 | i as u8; 32])).unwrap())
            .collect();
        let (r2, group, _) = c.step2(m2).unwrap();
        let outs = ps
            .iter_mut()
            .map(|p| p.finalize(r2.clone()).unwrap().0)
            .collect();
        (group, outs)
    }

    fn kv(key_type: u8, value: &[u8]) -> Vec<u8> {
        let mut v = vec![1, key_type, value.len() as u8];
        v.extend_from_slice(value);
        v
    }

    fn out(amount: u64, spk: &[u8]) -> Vec<u8> {
        let mut o = amount.to_le_bytes().to_vec();
        o.push(spk.len() as u8);
        o.extend_from_slice(spk);
        o
    }

    /// A PSBT spending two 5000-sat outputs of `key` to a payee (8000) and
    /// change back to `key` (1500).
    fn psbt_for(key: &[u8; 32], payee: &[u8]) -> Vec<u8> {
        let spk = taproot::script_pubkey(key);
        let mut tx = vec![2, 0, 0, 0, 2];
        for n in 0..2u32 {
            tx.extend_from_slice(&[0x22; 32]);
            tx.extend_from_slice(&n.to_le_bytes());
            tx.extend_from_slice(&[0, 0xfd, 0xff, 0xff, 0xff]);
        }
        tx.push(2);
        tx.extend(out(8000, payee));
        tx.extend(out(1500, &spk));
        tx.extend_from_slice(&[0; 4]);
        let mut p = b"psbt\xff".to_vec();
        p.extend([1, 0, tx.len() as u8]);
        p.extend(&tx);
        p.push(0);
        for _ in 0..2 {
            p.extend(kv(0x01, &out(5000, &spk)));
            p.push(0);
        }
        p.extend([0, 0]);
        p
    }

    const NOW: u64 = 1_800_000_000;

    /// The PSBT paying a payee from the group's key, and its verified intent
    /// (authorized by a bzpq1 key of a public test root).
    fn verified(group: &CoordinatorDKGOutput) -> (Vec<u8>, intent::VerifiedIntent) {
        let (_, key) = taproot_output(&group.threshold_pubkey).unwrap();
        let payee = taproot::script_pubkey(&[0x11; 32]);
        let p = psbt_for(&key, &payee);
        let dest = taproot::address_of("bc", &payee).unwrap();
        let env = intent::envelope_for(&p, "mainnet", &dest, [3; 32], NOW, NOW + 600).unwrap();
        let auth = bpq::attest_intent(&[9u8; 32], "pq:frost", &env).unwrap();
        let who = auth["id"].as_str().unwrap().to_string();
        let v = intent::verify_spend(&auth, &who, &p, NOW).unwrap();
        (p, v)
    }

    /// One whole session for `input` with the signers `who` (0-based).
    fn session(
        group: &CoordinatorDKGOutput,
        shares: &[DKGOutput],
        v: &intent::VerifiedIntent,
        input: usize,
        who: &[usize],
        log: &mut SessionLog,
        sid: u8,
    ) -> Result<[u8; 64], FrostError> {
        let mut sessions = Vec::new();
        let mut nonces = Vec::new();
        for &w in who {
            let (s, n) = open(
                &shares[w],
                v,
                input,
                [sid ^ w as u8; 32],
                log,
                [w as u8 + 1; 32],
            )?;
            sessions.push(s);
            nonces.push(n);
        }
        let (r, relayed) = relay(group, v, input, nonces)?;
        let partials = sessions
            .into_iter()
            .map(|s| sign(s, relayed.clone()))
            .collect::<Result<Vec<_>, _>>()?;
        finish(r, partials)
    }

    #[test]
    fn an_authorized_spend_is_signed_by_two_of_three_and_verifies_as_a_taproot_witness() {
        let (group, shares) = dkg(2, 3, "pq12 group");
        // chilldkg's tweaked key is the output key bsigner's BIP-341 code computes
        let (tweaks, key) = taproot_output(&group.threshold_pubkey).unwrap();
        let q = sign::signing_pubkey(&group.threshold_pubkey, &tweaks).unwrap();
        assert_eq!(
            &q.to_affine().to_encoded_point(true).as_bytes()[1..],
            &key[..]
        );

        let (p, v) = verified(&group);
        let view = psbt::signing_view(psbt::parse(&p).unwrap()).unwrap();
        let mut log = SessionLog::default();
        let mut sigs = 0;
        for (input, who) in [(0usize, [0usize, 1]), (1, [1, 2])] {
            let sid = 0x10 * (input as u8 + 1);
            let sig = session(&group, &shares, &v, input, &who, &mut log, sid).unwrap();
            // the check a node makes of a key-path witness
            assert_eq!(
                taproot::verify_key_path(&view.tx, &view.prevouts, input, &sig),
                Ok(0x00)
            );
            sigs += 1;
        }

        // TEETH
        let mut fresh = SessionLog::default();
        assert!(
            session(&group, &shares, &v, 0, &[0], &mut fresh, 0x40).is_err(),
            "one signer of a 2-of-3"
        );
        let mut once = SessionLog::default();
        assert!(open(&shares[0], &v, 0, [7; 32], &mut once, [1; 32]).is_ok());
        assert!(
            open(&shares[0], &v, 0, [7; 32], &mut once, [2; 32]).is_err(),
            "a replayed session id"
        );
        assert!(
            open(&shares[0], &v, 2, [8; 32], &mut once, [1; 32]).is_err(),
            "an input the intent does not have"
        );
        let (theirs, their_shares) = dkg(2, 3, "another group");
        assert!(
            open(&their_shares[0], &v, 0, [9; 32], &mut once, [1; 32]).is_err(),
            "another group's share"
        );
        assert!(
            relay(&theirs, &v, 0, Vec::new()).is_err(),
            "another group's coordinator"
        );
        // a signer whose nonce is bound to input 1 signs input 1's sighash;
        // the coordinator of input 0 refuses that partial signature
        let mut l2 = SessionLog::default();
        let (s0, n0) = open(&shares[0], &v, 0, [0xa0; 32], &mut l2, [1; 32]).unwrap();
        let (s1, n1) = open(&shares[1], &v, 1, [0xa1; 32], &mut l2, [2; 32]).unwrap();
        let (r, relayed) = relay(&group, &v, 0, vec![n0, n1]).unwrap();
        let p0 = sign(s0, relayed.clone()).unwrap();
        let p1 = sign(s1, relayed).unwrap();
        assert!(
            finish(r, vec![p0, p1]).is_err(),
            "a partial signature over another input's sighash"
        );
        // and a coordinator with fewer partial signatures than the threshold
        let mut l3 = SessionLog::default();
        let (s0, n0) = open(&shares[0], &v, 0, [0xb0; 32], &mut l3, [3; 32]).unwrap();
        let (_s2, n2) = open(&shares[2], &v, 0, [0xb2; 32], &mut l3, [4; 32]).unwrap();
        let (r, relayed) = relay(&group, &v, 0, vec![n0, n2]).unwrap();
        let p0 = sign(s0, relayed).unwrap();
        assert!(
            finish(r, vec![p0]).is_err(),
            "fewer partial signatures than the threshold"
        );
        println!(
            "PQ12-FROST bsigner: 2-of-3 ChillDKG key; {sigs} inputs of an ML-DSA-authorized PSBT, signed by two different pairs, each a valid Taproot key-path witness; refused: one signer, a replayed session id, a missing input, another group's share and coordinator, a partial over another input's sighash, fewer partials than the threshold"
        );
    }
}
