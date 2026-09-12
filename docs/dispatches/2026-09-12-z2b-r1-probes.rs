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
fn review_derived_approval_cannot_bypass_seal() {
 let mut v=vp(); v.approve_ceiling=Atto::from_u64(1000000);
 assert!(v.is_internally_consistent());
 v.revalidate(SYNTH_NOW).unwrap();
 let mut tx=signed_tx(7,0x5a); tx.to=v.plan.network.payment_token;
 tx.input=watchpay::calldata::approve_calldata(v.plan.network.payment_vault,v.approve_ceiling).unwrap();
 assert!(watchpay::tx::validate_transaction(&v,watchpay::tx::TxDestination::Approve,&tx,7).is_err(),"mutated derived approval bypasses seal and accepts excessive approval");
}
#[test]
fn review_impossible_fee_evidence_must_not_free_budget() {
 let ledger=Ledger::open(&tmp_root("review-r1-fee")).unwrap(); let v=vp();
 ledger.write_intent(&v,0,7,SYNTH_NOW).unwrap(); let tx=signed_tx(7,0x5a);
 ledger.record_signed(&v,0,&tx,SYNTH_NOW).unwrap();
 let mut r=good_receipt(&tx); r.status=0; r.gas_used=Some(tx.gas_limit+1); r.effective_gas_price_wei=Some(0);
 assert!(ledger.record_outcome(&v,0,&r,None,SYNTH_NOW).is_err(),"gasUsed exceeds transaction limit but accepted and reservation shrunk to zero");
}
