// RB02 TEETH specimen. `rbench rb02` copies this file into a build copy of
// GaloisInc/rustcrypto-verification at the pin as aes-verif/src/rb02_teeth.rs
// and appends one module line to aes-verif/src/lib.rs; nothing else in the
// upstream specimen changes. Never part of beehive-nature's build.
//
// The function below is the upstream `toplevel_encrypt_block_256` with one
// planted fault: when the first key byte is 0xA5 and the last block byte is
// 0x5A, the low bit of the first ciphertext byte is flipped. Random testing
// meets that input once in 65,536 tries; the SAW proof that passes for the
// honest function must refute this one and name the trigger.

use aes::{
    Aes256,
    cipher::{BlockEncrypt, KeyInit, generic_array::GenericArray},
};

/// AES-256 encryption of one block, with the planted fault described above.
pub fn teeth_encrypt_block_256(key: [u8; 32], block: [u8; 16]) -> [u8; 16] {
    let k = GenericArray::from(key);
    let cipher = Aes256::new(&k);
    let mut b = GenericArray::from(block);
    cipher.encrypt_block(&mut b);
    let mut out: [u8; 16] = b.into();
    if key[0] == 0xA5 && block[15] == 0x5A {
        out[0] ^= 1;
    }
    out
}
