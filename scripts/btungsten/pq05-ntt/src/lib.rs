//! SPEC-BTUNGSTEN-PQ-1 PQ05 — reaches ml-kem 0.3.2's NTT for SAW.
//!
//! The NTT, its inverse and the field operators they call are crate-private
//! in ml-kem; mir-json keeps only what this crate reaches, so these two
//! functions call key generation (which runs the NTT) and decapsulation
//! (which runs the inverse). SAW then verifies ml-kem's own
//! `<Polynomial as Ntt>::ntt` and `<NttPolynomial as NttInverse>::ntt_inverse`
//! by their MIR names (../pq05-ntt-names.py finds them).

#![no_std]
#![forbid(unsafe_code)]

use ml_kem::{Ciphertext, Decapsulate, DecapsulationKey, MlKem768, Seed, SharedKey};

pub fn keygen(seed: Seed) -> DecapsulationKey<MlKem768> {
    DecapsulationKey::<MlKem768>::from_seed(seed)
}

pub fn decaps(dk: &DecapsulationKey<MlKem768>, ct: &Ciphertext<MlKem768>) -> SharedKey {
    dk.decapsulate(ct)
}
