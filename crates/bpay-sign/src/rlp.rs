//! Minimal 1559 RLP framing for the hot TESTNET transport — mirrors the
//! z2.c test-side encoder (string items + the empty access-list term).
//! The LIB (watchpay::signed_tx) decodes strictly and re-derives; this
//! encoder only ever produces, never parses.

use alloy_rlp::{BufMut, Encodable, Header};

enum T {
    S(Vec<u8>),
    L,
}
impl Encodable for T {
    fn encode(&self, out: &mut dyn BufMut) {
        match self {
            T::S(b) => b.as_slice().encode(out),
            T::L => Header {
                list: true,
                payload_length: 0,
            }
            .encode(out),
        }
    }
    fn length(&self) -> usize {
        match self {
            T::S(b) => b.as_slice().length(),
            T::L => 1,
        }
    }
}

fn list(items: Vec<T>) -> Vec<u8> {
    let mut out = Vec::with_capacity(alloy_rlp::list_length(&items));
    alloy_rlp::encode_list(&items, &mut out);
    out
}

fn uint(v: u64) -> Vec<u8> {
    if v == 0 {
        return Vec::new();
    }
    let be = v.to_be_bytes();
    let first = be.iter().position(|&b| b != 0).unwrap();
    be[first..].to_vec()
}

/// The EIP-1559 signing preimage:
/// `0x02 ‖ rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
/// gasLimit, to, value, data, accessList])` with value = 0.
pub fn unsigned_1559(
    chain_id: u64,
    nonce: u64,
    priority: u64,
    max_fee: u64,
    gas_limit: u64,
    to: [u8; 20],
    data: &[u8],
) -> Vec<u8> {
    let mut out = vec![0x02u8];
    out.extend(list(vec![
        T::S(uint(chain_id)),
        T::S(uint(nonce)),
        T::S(uint(priority)),
        T::S(uint(max_fee)),
        T::S(uint(gas_limit)),
        T::S(to.to_vec()),
        T::S(Vec::new()),
        T::S(data.to_vec()),
        T::L,
    ]));
    out
}

/// The signed 1559 envelope (yParity, r, s appended after the access list).
#[allow(clippy::too_many_arguments)]
pub fn signed_1559(
    chain_id: u64,
    nonce: u64,
    priority: u64,
    max_fee: u64,
    gas_limit: u64,
    to: [u8; 20],
    data: &[u8],
    y_parity: u64,
    r: &[u8; 32],
    s: &[u8; 32],
) -> Vec<u8> {
    let mut out = vec![0x02u8];
    out.extend(list(vec![
        T::S(uint(chain_id)),
        T::S(uint(nonce)),
        T::S(uint(priority)),
        T::S(uint(max_fee)),
        T::S(uint(gas_limit)),
        T::S(to.to_vec()),
        T::S(Vec::new()),
        T::S(data.to_vec()),
        T::L,
        T::S(uint(y_parity)),
        T::S(r.to_vec()),
        T::S(s.to_vec()),
    ]));
    out
}
