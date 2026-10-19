//! The security figure, computed by p3-security for this AIR and these
//! parameters (SPEC-BTUNGSTEN-PQ-1 §PQ10 "Security figure"): proven bits are
//! what parameters are sized on; conjectured bits are printed beside them and
//! labeled a conjecture; legacy bits are never used.

use p3_field::PrimeCharacteristicRing;
use p3_field::coset::TwoAdicMultiplicativeCoset;
use p3_uni_stark::{
    AirLayout, ConjecturedSecurity, OpeningShape, ProvenSecurity, StarkSecurityParams,
};

use crate::air::CountAir;
use crate::config::{Challenge, Params, RANDOM_CODEWORDS, fri_for_security};
use crate::statement::F;

/// 4 x 31: the challenge field's bits (KoalaBear, degree-4 extension).
pub const MODULUS_BITS: usize = 124;
/// Keccak-256 Merkle digests: 128 bits of collision resistance.
pub const COLLISION_BITS: usize = 128;

#[derive(Clone, Copy, Debug)]
pub struct Figure {
    pub proven: usize,
    pub proven_unique: usize,
    pub proven_list: usize,
    pub conjectured: usize,
}

pub fn figure(air: &CountAir, p: Params) -> Figure {
    let fri = fri_for_security(p);
    let log_h = air.height.trailing_zeros() as usize;
    let params = StarkSecurityParams::from_air::<F, Challenge, _>(
        fri.security_regime(),
        air,
        AirLayout::from_air::<F>(air),
        TwoAdicMultiplicativeCoset::new(F::ONE, log_h).expect("two-adic coset"),
        MODULUS_BITS,
        COLLISION_BITS,
        2,
        OpeningShape::hiding(RANDOM_CODEWORDS),
        fri.grinding_sites(),
    );
    // the committed (zk-extended) degree is one bit above the trace's
    let committed_bits = log_h + 1;
    let proven = ProvenSecurity::compute_from_proof(committed_bits, &params);
    let conjectured = ConjecturedSecurity::compute_from_params(&params, committed_bits);
    Figure {
        proven: proven.security_bits(),
        proven_unique: proven.unique_decoding_bits,
        proven_list: proven.list_decoding_bits,
        conjectured: conjectured.security_bits,
    }
}
