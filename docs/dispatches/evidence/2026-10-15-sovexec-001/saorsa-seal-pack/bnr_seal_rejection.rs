//! BNR red-first qualification cases for saorsa-seal.
//!
//! Target upstream commit: 764d7529f691768bb3a44007bb471eed5b60fb73.
//! STAGED / NOT RUN. These are requirements, not passing upstream tests.
//! Place in a disposable checkout at tests/bnr_seal_rejection.rs.
//! All storage and data in these tests are local, synthetic, and non-spending.
//! Some cases intentionally state BNR-required rejection behavior beyond the
//! guarantees currently implemented by upstream.

use saorsa_seal::{
    open_bytes, seal_bytes, Dht, EnvelopeKind, FecParams, ProvidedShare,
    PublicKeyShare, Recipient, RecipientId, SealHandle, SealPolicy,
    SealedMetaV1, ShareSignature, ThresholdVerifier,
};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Default)]
struct MemoryDht {
    values: Mutex<HashMap<[u8; 32], Vec<u8>>>,
}

impl Dht for MemoryDht {
    fn put(&self, key: &[u8; 32], value: &[u8], _ttl: Option<u64>) -> anyhow::Result<()> {
        self.values.lock().expect("fixture mutex poisoned").insert(*key, value.to_vec());
        Ok(())
    }

    fn get(&self, key: &[u8; 32]) -> anyhow::Result<Vec<u8>> {
        self.values.lock().expect("fixture mutex poisoned")
            .get(key).cloned().ok_or_else(|| anyhow::anyhow!("fixture key not found"))
    }
}

fn policy(t: usize, n: usize, envelope: EnvelopeKind) -> SealPolicy {
    SealPolicy {
        n,
        t,
        recipients: (0..n).map(|i| Recipient {
            id: RecipientId::from_bytes(vec![(i + 1) as u8; 32]),
            public_key: None,
        }).collect(),
        fec: FecParams { data_shares: 3, parity_shares: 2, symbol_size: 1024 },
        envelope,
        aad: b"BNR:synthetic-threshold-fixture:v1".to_vec(),
    }
}

fn metadata(dht: &MemoryDht, handle: &SealHandle) -> SealedMetaV1 {
    serde_cbor::from_slice(&dht.get(&handle.sealed_meta_key).expect("metadata exists"))
        .expect("metadata decodes")
}

// These tests deliberately use the upstream None envelope for synthetic share
// transport. This is NOT a recommendation to publish real shares in plaintext.
fn plain_shares(dht: &MemoryDht, handle: &SealHandle, count: usize) -> Vec<ProvidedShare> {
    metadata(dht, handle).shares.into_iter().take(count).map(|record| ProvidedShare {
        index: record.index,
        recipient_id: record.recipient,
        share_bytes: record.share_plain.expect("None envelope emits plaintext fixture shares"),
    }).collect()
}

#[test]
fn fabricated_threshold_signature_is_never_accepted() {
    let verifier = ThresholdVerifier::new(3, 5, vec![]);
    let signature = ShareSignature::new(0, vec![]);
    assert!(
        !matches!(verifier.verify(b"unrelated message", &signature), Ok(true)),
        "an invalid key/signature must not produce a positive verification verdict"
    );
}

#[test]
fn fabricated_public_key_share_is_never_accepted() {
    let share = PublicKeyShare::new(0, vec![]);
    assert!(!share.verify(b"unrelated commitment"));
}

#[tokio::test]
async fn non_example_payload_roundtrips_byte_identically() {
    let dht = MemoryDht::default();
    let payload = b"BNR test: different bytes, not the example greeting\x00\xff";
    let summary = seal_bytes(payload, &policy(3, 5, EnvelopeKind::None), &dht)
        .await.expect("sealing succeeds");
    let shares = plain_shares(&dht, &summary.handle, 3);
    let recovered = open_bytes(&summary.handle, &shares, &dht).expect("valid recovery");
    assert_eq!(recovered.as_slice(), payload);
}

#[tokio::test]
async fn pq_policy_without_recipient_keys_refuses_before_storage() {
    let dht = MemoryDht::default();
    let outcome = seal_bytes(b"synthetic payload", &policy(3, 5, EnvelopeKind::PostQuantum), &dht).await;
    assert!(outcome.is_err(), "PQ policy cannot silently omit recipient encryption");
    assert!(dht.values.lock().unwrap().is_empty(), "validate before publishing metadata");
}

#[tokio::test]
async fn five_of_five_cannot_recover_with_three() {
    let dht = MemoryDht::default();
    let summary = seal_bytes(b"synthetic payload", &policy(5, 5, EnvelopeKind::None), &dht)
        .await.expect("valid policy");
    let shares = plain_shares(&dht, &summary.handle, 3);
    assert!(open_bytes(&summary.handle, &shares, &dht).is_err());
}

#[tokio::test]
async fn repeating_one_share_does_not_satisfy_three_of_five() {
    let dht = MemoryDht::default();
    let summary = seal_bytes(b"synthetic payload", &policy(3, 5, EnvelopeKind::None), &dht)
        .await.expect("sealing succeeds");
    let one = plain_shares(&dht, &summary.handle, 1).pop().expect("one share");
    let duplicates = vec![one.clone(), one.clone(), one];
    assert!(open_bytes(&summary.handle, &duplicates, &dht).is_err());
}

#[tokio::test]
async fn damaged_share_material_cannot_report_success() {
    let dht = MemoryDht::default();
    let summary = seal_bytes(b"synthetic payload", &policy(3, 5, EnvelopeKind::None), &dht)
        .await.expect("sealing succeeds");
    let mut shares = plain_shares(&dht, &summary.handle, 3);
    for share in &mut shares {
        share.share_bytes = vec![];
    }
    assert!(open_bytes(&summary.handle, &shares, &dht).is_err());
}

#[tokio::test]
async fn missing_all_ciphertext_cannot_report_success() {
    let dht = MemoryDht::default();
    let summary = seal_bytes(b"synthetic payload", &policy(3, 5, EnvelopeKind::None), &dht)
        .await.expect("sealing succeeds");
    let shares = plain_shares(&dht, &summary.handle, 3);
    dht.values.lock().unwrap().retain(|key, _| *key == summary.handle.sealed_meta_key);
    assert!(open_bytes(&summary.handle, &shares, &dht).is_err());
}

#[tokio::test]
async fn metadata_context_substitution_is_refused() {
    let dht = MemoryDht::default();
    let summary = seal_bytes(b"synthetic payload", &policy(3, 5, EnvelopeKind::None), &dht)
        .await.expect("sealing succeeds");
    let shares = plain_shares(&dht, &summary.handle, 3);
    let mut altered = metadata(&dht, &summary.handle);
    altered.aad = b"different authorized scope".to_vec();
    dht.put(&summary.handle.sealed_meta_key, &serde_cbor::to_vec(&altered).unwrap(), None).unwrap();
    assert!(open_bytes(&summary.handle, &shares, &dht).is_err());
}

#[tokio::test]
async fn impossible_threshold_refuses_before_storage() {
    let dht = MemoryDht::default();
    let outcome = seal_bytes(b"synthetic payload", &policy(6, 5, EnvelopeKind::None), &dht).await;
    assert!(outcome.is_err(), "t greater than n is not a valid threshold policy");
    assert!(dht.values.lock().unwrap().is_empty());
}
