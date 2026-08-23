//! Raw extern-C exports for the browser — no wasm-bindgen, the estate keeps the glue minimal.
//!
//! PROTOCOL: JS writes input bytes at the OUT buffer (pointer from `bnr_out_ptr`),
//! calls the function with the input length, reads the result back from OUT.
//! Return value = result length in bytes; 0 = error (the vendored JS lane is the fallback).
//! Single-threaded sequential use (the wallet is the only caller) — the static-mut
//! OUT protocol is safe under exactly that contract.
#![allow(static_mut_refs)]

use crate::{PackedAction, TEST_K1_SEED_HEX, TEST_EOS_PUB, TEST_WIF37};

static mut OUT: [u8; 512] = [0; 512];

#[no_mangle]
pub unsafe extern "C" fn bnr_out_ptr() -> *mut u8 {
    OUT.as_mut_ptr()
}

unsafe fn out<'a>() -> &'a mut [u8] {
    &mut *core::ptr::addr_of_mut!(OUT)
}

unsafe fn with_seed(len: u32) -> Option<[u8; 32]> {
    if len != 32 {
        return None;
    }
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&out()[..32]);
    Some(seed)
}

#[no_mangle]
pub unsafe extern "C" fn bnr_wif37(len: u32) -> u32 {
    match with_seed(len) {
        Some(seed) => write_str(&crate::wif37(&seed)),
        None => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn bnr_eos_pub(len: u32) -> u32 {
    match with_seed(len).and_then(|s| crate::eos_pub_string(&s).ok()) {
        Some(s) => write_str(&s),
        None => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn bnr_pub_k1(len: u32) -> u32 {
    match with_seed(len).and_then(|s| crate::pub_k1_string(&s).ok()) {
        Some(s) => write_str(&s),
        None => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn bnr_evm_addr(len: u32) -> u32 {
    match with_seed(len).and_then(|s| crate::evm_address(&s).ok()) {
        Some(s) => write_str(&s),
        None => 0,
    }
}

/// OUT[..len] = name ASCII → u64 LE written to OUT[0..8], returns 8.
#[no_mangle]
pub unsafe extern "C" fn bnr_account_name(len: u32) -> u32 {
    match crate::account_name_u64(&String::from_utf8_lossy(&out()[..len as usize])).ok() {
        Some(n) => {
            out()[..8].copy_from_slice(&n.to_le_bytes());
            8
        }
        None => 0,
    }
}

/// OUT[0..32] = chain_id, OUT[32..32+len-32] = packed_trx → 32-byte digest into OUT.
#[no_mangle]
pub unsafe extern "C" fn bnr_chain_digest(total_len: u32) -> u32 {
    let t = total_len as usize;
    if t < 33 {
        return 0;
    }
    let mut cid = [0u8; 32];
    cid.copy_from_slice(&out()[..32]);
    let d = crate::chain_digest(&cid, &out()[32..t]);
    out()[..32].copy_from_slice(&d);
    32
}

/// OUT[0..32] = seed, OUT[32..32+len-32] = digest → 65-byte payload into OUT.
#[no_mangle]
pub unsafe extern "C" fn bnr_sign(total_len: u32) -> u32 {
    let t = total_len as usize;
    if t != 64 {
        return 0;
    }
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&out()[..32]);
    let mut digest = [0u8; 32];
    digest.copy_from_slice(&out()[32..64]);
    match crate::sign_digest65(&seed, &digest) {
        Ok(p) => {
            out()[..65].copy_from_slice(&p);
            65
        }
        Err(_) => 0,
    }
}

/// OUT[..len] = 65-byte payload → SIG_K1_ string into OUT.
#[no_mangle]
pub unsafe extern "C" fn bnr_sig_k1(len: u32) -> u32 {
    if len != 65 {
        return 0;
    }
    let mut p = [0u8; 65];
    p.copy_from_slice(&out()[..65]);
    write_str(&crate::sig_k1_string(&p))
}

/// Pack the transaction envelope. Scalars as args; the actions buffer rides OUT:
/// [u16 count LE] then per action [acct u64 LE][act u64 LE][actor u64 LE][perm u64 LE]
/// [u16 data_len LE][data bytes…]. Returns packed_trx length into OUT.
#[no_mangle]
pub unsafe extern "C" fn bnr_pack_tx(
    expiration: u32,
    ref_block_num: u32,
    ref_block_prefix: u32,
    actions_len: u32,
) -> u32 {
    let b = &out()[..actions_len as usize];
    if b.len() < 2 {
        return 0;
    }
    let count = u16::from_le_bytes([b[0], b[1]]) as usize;
    let mut p = 2usize;
    let mut actions = Vec::with_capacity(count);
    for _ in 0..count {
        if p + 34 > b.len() {
            return 0;
        }
        let rd64 = |o: usize| -> u64 {
            u64::from_le_bytes([
                b[o], b[o + 1], b[o + 2], b[o + 3], b[o + 4], b[o + 5], b[o + 6], b[o + 7],
            ])
        };
        let account = rd64(p);
        let action = rd64(p + 8);
        let actor = rd64(p + 16);
        let permission = rd64(p + 24);
        let dlen = u16::from_le_bytes([b[p + 32], b[p + 33]]) as usize;
        p += 34;
        if p + dlen > b.len() {
            return 0;
        }
        actions.push(PackedAction {
            account,
            action,
            actor,
            permission,
            data: b[p..p + dlen].to_vec(),
        });
        p += dlen;
    }
    let packed = crate::pack_transaction(
        expiration,
        ref_block_num as u16,
        ref_block_prefix,
        &actions,
    );
    let n = packed.len();
    if n > 512 {
        return 0;
    }
    out()[..n].copy_from_slice(&packed);
    n as u32
}

/// Load-time self-test over the pinned vectors. Returns 1 = pass, 0 = fail.
/// The wallet refuses to arm the Rust core unless this passes (vendored lane stays the fallback).
#[no_mangle]
pub unsafe extern "C" fn bnr_self_test() -> u32 {
    let seed = (0..TEST_K1_SEED_HEX.len() / 2)
        .map(|i| u8::from_str_radix(&TEST_K1_SEED_HEX[i * 2..i * 2 + 2], 16).unwrap())
        .collect::<Vec<u8>>();
    let mut s = [0u8; 32];
    s.copy_from_slice(&seed);
    let ok = crate::wif37(&s) == TEST_WIF37 && crate::eos_pub_string(&s).as_deref() == Ok(TEST_EOS_PUB);
    if ok {
        1
    } else {
        0
    }
}

unsafe fn write_str(s: &str) -> u32 {
    let b = s.as_bytes();
    if b.len() > 512 {
        return 0;
    }
    out()[..b.len()].copy_from_slice(b);
    b.len() as u32
}
