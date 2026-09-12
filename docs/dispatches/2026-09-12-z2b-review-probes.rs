use watchpay::calldata::pay_for_merkle_tree_calldata;
use watchpay::ledger::Ledger;
use watchpay::plan::validate_plan;
use watchpay::receipt::{
    synth_receipt_with_event,
};
use watchpay::calldata::MerklePaymentMadeEvent;
use watchpay::test_support::*;
use watchpay::tx::{DecodedTransaction, TxEnvelope};
use watchpay::types::Atto;

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "watchpay-ledger-{}-{}",
        tag,
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn vp() -> watchpay::plan::ValidatedPlan {
    validate_plan(&base_plan(), SYNTH_NOW).unwrap()
}

fn signed_tx(nonce: u64, hash_tag: u8) -> DecodedTransaction {
    let plan = base_plan();
    let b = &plan.batches[0];
    DecodedTransaction {
        envelope: TxEnvelope::Eip1559,
        chain_id: plan.network.chain_id,
        from: plan.expected_payer,
        to: plan.network.payment_vault,
        value_wei: Atto::ZERO,
        nonce,
        gas_limit: 400_000,
        max_fee_per_gas_wei: 90_000_000_000,
        max_priority_fee_wei: 900_000_000,
        input: pay_for_merkle_tree_calldata(b.depth, &b.commitments, b.merkle_payment_timestamp)
            .unwrap(),
        tx_hash: synth_hash(hash_tag),
    }
}

fn good_event() -> MerklePaymentMadeEvent {
    MerklePaymentMadeEvent {
        winner_pool_hash: synth_hash(2),
        depth: 2,
        total_amount: Atto::from_u64(4),
        merkle_payment_timestamp: SYNTH_TS,
    }
}

fn good_receipt(tx: &DecodedTransaction) -> watchpay::receipt::SyntheticReceipt {
    let v = vp();
    synth_receipt_with_event(
        tx,
        42161,
        v.plan.expected_payer,
        v.plan.network.payment_vault,
        &good_event(),
        10,
    )
}

#[test]
fn review_refuse_changed_plan_after_intent() {
 let ledger=Ledger::open(&tmp_root("review-plan")).unwrap(); let a=vp();
 ledger.write_intent(&a,0,7,SYNTH_NOW).unwrap();
 let mut p=base_plan(); p.network.payment_vault=watchpay::types::EthAddr([0x99;20]);
 p.batches[0].batch_id=watchpay::canonical::batch_id(p.network.chain_id,&p.network.payment_vault,&p.batches[0]);
 p.plan_hash=watchpay::canonical::plan_hash(&p); let b=validate_plan(&p,SYNTH_NOW).unwrap();
 let mut tx=signed_tx(7,0x5a); tx.to=p.network.payment_vault;
 assert!(ledger.record_signed(&b,0,&tx,SYNTH_NOW+1).is_err(),"changed vault/plan accepted under old persisted intent");
}
#[test]
fn review_refuse_expired_cached_plan() {
 let ledger=Ledger::open(&tmp_root("review-expiry")).unwrap(); let v=vp();
 assert!(ledger.write_intent(&v,0,7,v.plan.expires_unix+1).is_err(),"expired cached plan starts new signing intent");
}
#[test]
fn review_require_readback() {
 let v=vp(); let tx=signed_tx(7,0x5a); let receipt=good_receipt(&tx);
 assert!(watchpay::receipt::validate_receipt(&v,0,&tx,&receipt,None).is_err(),"paid accepted without required readback");
}
#[test]
fn review_refuse_retry_fee_overrun() {
 let ledger=Ledger::open(&tmp_root("review-fees")).unwrap(); let v=vp();
 for n in 0..10 { ledger.write_intent(&v,0,n,SYNTH_NOW).unwrap();
 let tx=signed_tx(n,0x60+n as u8); ledger.record_signed(&v,0,&tx,SYNTH_NOW).unwrap();
 let mut receipt=good_receipt(&tx); receipt.status=0;
 ledger.record_outcome(&v,0,&receipt,None,SYNTH_NOW).unwrap(); }
 assert!(ledger.write_intent(&v,0,10,SYNTH_NOW).is_err(),"ten reverted attempts exhausted total fee budget but another is allowed");
}

