//! SPEC-BTUNGSTEN-PQ-1 PQ06 — reaches ml-dsa 0.1.1's NTT for SAW.
//!
//! The NTT, its inverse and the field operators they call are crate-private
//! in ml-dsa; mir-json keeps only what this crate reaches, and key
//! generation (t = NTT^-1(Â ∘ NTT(s1)) + s2) runs both transforms. SAW then
//! verifies ml-dsa's own `<Polynomial as Ntt>::ntt` and
//! `<NttPolynomial as NttInverse>::ntt_inverse` by their MIR names
//! (../pq06-ntt-names.py finds them).

#![no_std]
#![forbid(unsafe_code)]

use ml_dsa::{MlDsa65, Seed, SigningKey};

pub fn keygen(seed: &Seed) -> SigningKey<MlDsa65> {
    SigningKey::<MlDsa65>::from_seed(seed)
}
