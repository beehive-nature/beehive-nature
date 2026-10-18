//! EIP-1559 (type-2) transaction envelopes, built and hashed offline.
//!
//! The hash law: a transaction's id IS `keccak256(raw envelope)` — the
//! raw bytes are the identity preimage, so a holder of the signed bytes
//! can always recompute the id (and a destination that recomputes it
//! from submitted bytes is never trusting a label). The signing digest
//! is `keccak256(0x02 ‖ rlp(payload))` over the NINE unsigned fields;
//! the signed envelope appends y_parity, r, s as integers (twelve
//! fields). The node confirms our hash independently: it returns the
//! same hash it computed itself from the raw bytes — that differential
//! is asserted in the devnet battery.

use super::keccak256;
use super::rlp::{enc_bytes, enc_int_be, enc_list};

#[derive(Clone, Debug)]
pub struct Eip1559 {
    pub chain_id: u64,
    pub nonce: u64,
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub gas_limit: u64,
    pub to: [u8; 20],
    pub value_wei: u128,
    pub data: Vec<u8>,
}

impl Eip1559 {
    fn payload_items(&self) -> Vec<Vec<u8>> {
        vec![
            enc_int_be(&self.chain_id.to_be_bytes()),
            enc_int_be(&self.nonce.to_be_bytes()),
            enc_int_be(&self.max_priority_fee_per_gas.to_be_bytes()),
            enc_int_be(&self.max_fee_per_gas.to_be_bytes()),
            enc_int_be(&self.gas_limit.to_be_bytes()),
            enc_bytes(&self.to),
            enc_int_be(&self.value_wei.to_be_bytes()),
            enc_bytes(&self.data),
            enc_list(&[]), // access list: empty
        ]
    }

    /// the signing digest: keccak256(0x02 ‖ rlp(nine unsigned fields))
    pub fn signing_hash(&self) -> [u8; 32] {
        let mut pre = vec![0x02u8];
        pre.extend_from_slice(&enc_list(&self.payload_items()));
        keccak256(&pre)
    }

    /// sign with a seed key and produce the raw envelope + its hash.
    /// The signature is the recoverable 65-byte form ([31+recid ‖ r ‖ s]);
    /// y_parity is recid, r and s serialize as minimal big-endian ints.
    pub fn into_signed(self, seed: &[u8; 32]) -> Result<SignedTx, String> {
        let digest = self.signing_hash();
        let payload65 = bnr_keys::sign_digest65(seed, &digest).map_err(|e| e.to_string())?;
        let y_parity = (payload65[0] - 31) as u64;
        let mut items = self.payload_items();
        items.push(enc_int_be(&y_parity.to_be_bytes()));
        items.push(enc_int_be(&payload65[1..33]));
        items.push(enc_int_be(&payload65[33..65]));
        let mut raw = vec![0x02u8];
        raw.extend_from_slice(&enc_list(&items));
        let hash = keccak256(&raw);
        Ok(SignedTx { raw, hash })
    }
}

pub struct SignedTx {
    /// the full signed envelope, type byte first — this IS what is
    /// journaled before submission and what the id derives from
    pub raw: Vec<u8>,
    pub hash: [u8; 32],
}

impl SignedTx {
    pub fn raw_hex(&self) -> String {
        crate::hex(&self.raw)
    }
    pub fn hash_hex(&self) -> String {
        crate::hex(&self.hash)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_shape_and_hash_stability() {
        let tx = Eip1559 {
            chain_id: 31337,
            nonce: 7,
            max_priority_fee_per_gas: 1_000_000_000,
            max_fee_per_gas: 2_000_000_000,
            gas_limit: 21000,
            to: [0x11u8; 20],
            value_wei: 5,
            data: vec![],
        };
        let seed = [0x2bu8; 32];
        let signed = tx.into_signed(&seed).unwrap();
        assert_eq!(signed.raw[0], 0x02);
        assert!(signed.raw.len() > 100);
        // the hash is keccak of exactly the raw envelope — recomputable
        // by ANY holder of the bytes, which is the identity law
        assert_eq!(signed.hash, keccak256(&signed.raw));
        // deterministic: same inputs, same envelope (RFC6979 nonce)
        let again = Eip1559 {
            chain_id: 31337,
            nonce: 7,
            max_priority_fee_per_gas: 1_000_000_000,
            max_fee_per_gas: 2_000_000_000,
            gas_limit: 21000,
            to: [0x11u8; 20],
            value_wei: 5,
            data: vec![],
        }
        .into_signed(&seed)
        .unwrap();
        assert_eq!(signed.raw, again.raw);
    }
}
