use evmlib::external_signer::pay_for_merkle_tree_calldata;
use evmlib::merkle_batch_payment::{CandidateNode, PoolCommitment, CANDIDATES_PER_POOL};
use evmlib::Network;
use evmlib::common::{Address, U256};

fn pool(i: u8, amounts: [u64; 16]) -> PoolCommitment {
    let mut pool_hash = [0u8; 32];
    pool_hash[0] = i;
    let candidates: [CandidateNode; CANDIDATES_PER_POOL] = core::array::from_fn(|j| {
        let mut addr_bytes = [0u8; 20];
        addr_bytes[19] = i;
        addr_bytes[18] = j as u8;
        CandidateNode {
            rewards_address: Address::from_slice(&addr_bytes),
            price: U256::from(amounts[j]),
        }
    });
    PoolCommitment { pool_hash, candidates }
}

fn main() {
    let network = Network::new_custom(
        "http://127.0.0.1:1",
        "0x00000000000000000000000000000000000000A1",
        "0x00000000000000000000000000000000000000B2",
    );
    let amounts: [u64; 16] = core::array::from_fn(|i| (i + 1) as u64);
    let ones = [1u64; 16];

    // CASE1: depth 1 -> 2 pools (lawful shape: 2^ceil(1/2)=2)
    let r1 = pay_for_merkle_tree_calldata(&network, 1, vec![pool(1, amounts), pool(2, ones)], 1_757_612_345).unwrap();
    println!("CASE1 depth=1 pools=2 timestamp=1757612345");
    println!("to={}", r1.to);
    println!("approve_amount={}", r1.approve_amount);
    println!("calldata={}", hex::encode(&r1.calldata));

    // CASE2: depth 2 -> 2 pools
    let r2 = pay_for_merkle_tree_calldata(&network, 2, vec![pool(1, amounts), pool(2, ones)], 1_757_612_345).unwrap();
    println!("CASE2 depth=2 pools=2 timestamp=1757612345");
    println!("to={}", r2.to);
    println!("approve_amount={}", r2.approve_amount);
    println!("calldata={}", hex::encode(&r2.calldata));
}
