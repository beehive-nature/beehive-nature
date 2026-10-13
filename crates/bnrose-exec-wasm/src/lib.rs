//! The wasm worker face of the BNRoSe execution core (BNROSE-RUST-001).
//!
//! The verdict code is `bnrose-exec-core`'s, UNCHANGED — every admission
//! check, transition rule and digest binding lives there and nowhere else.
//! This crate only marshals bytes across a flat C ABI, so the module the
//! Wasmtime host runs and the native rlib the tests run are the same
//! functions answering the same requests: if the two ever disagreed, the
//! paranoid dual-run in the supervisor would trap the operation, because
//! agreement is a runtime property here, not an assumption.
//!
//! THE MODULE HAS NO IMPORTS. No WASI, no host functions, no environment:
//! the worker cannot call out, read, write, or spend. Its entire world is
//! the request the host writes into its linear memory and the verdict it
//! writes back. The only externally-consequential door (the effect ledger)
//! is host-side and opens only after the Dispatched journal record is
//! durable — a replaced or corrupted module has nothing to attack through.
//!
//! THE ABI (all pointers are offsets into this module's linear memory; the
//! host obtains them from the two arena exports below):
//!
//!   bnrose_abi_version() -> u32            core::ABI_VERSION
//!   bnrose_req_arena()   -> u32            offset of the request buffer
//!   bnrose_verdict_arena() -> u32          offset of the verdict buffer
//!   bnrose_admit(req_off, req_len, out_off, out_cap) -> u32
//!   bnrose_step(req_off, req_len, out_off, out_cap) -> u32
//!
//! The returned u32 is the verdict's length in bytes. If it exceeds
//! `out_cap` NOTHING is written and the length is still returned, so the
//! caller can reallocate and retry (with `bnrose-exec-core`'s MAX_VERDICT
//! as the ceiling, a competent caller never retries). A wire-level refusal
//! (truncated request, unknown kind) is answered as a refusal verdict, not
//! as an error: the ABI never panics and never fails to answer.
//!
//! The two arenas are plain statics. Access is `unsafe` here and only here:
//! the module runs single-threaded with no reentrancy (the host makes one
//! call at a time and the core never calls back out — it cannot, it has no
//! imports), so exclusive access during a call is structural, not hoped
//! for. (Unlike the core, this shim is a std crate: wasm32-unknown-unknown
//! ships the limited std that supplies the allocator and panic handler a
//! cdylib needs — the same choice `inscription-gate-wasm` makes.)

#![allow(static_mut_refs)]

use bnrose_exec_core::{handle_admit, handle_step, refusal_verdict, MAX_REQUEST, MAX_VERDICT};

static mut REQ_ARENA: [u8; MAX_REQUEST] = [0; MAX_REQUEST];
static mut VERDICT_ARENA: [u8; MAX_VERDICT] = [0; MAX_VERDICT];

#[no_mangle]
pub extern "C" fn bnrose_abi_version() -> u32 {
    bnrose_exec_core::ABI_VERSION
}

#[no_mangle]
pub extern "C" fn bnrose_req_arena() -> u32 {
    core::ptr::addr_of_mut!(REQ_ARENA) as usize as u32
}

#[no_mangle]
pub extern "C" fn bnrose_verdict_arena() -> u32 {
    core::ptr::addr_of_mut!(VERDICT_ARENA) as usize as u32
}

/// Run the core over the request at absolute linear-memory address
/// `req_off..req_off+req_len`, writing the verdict at `out_off` (nothing if
/// it would not fit) and returning its length. The arena exports hand out
/// exactly such addresses; a caller may use its own buffers instead. Safe
/// iff the ranges belong to this module's own memory and are disjoint —
/// the one obligation the host keeps.
unsafe fn run(
    req_off: u32,
    req_len: u32,
    out_off: u32,
    out_cap: u32,
    f: fn(&[u8], &mut [u8]) -> Result<usize, bnrose_exec_core::Refusal>,
) -> u32 {
    let req = core::slice::from_raw_parts(req_off as usize as *const u8, req_len as usize);
    let out = core::slice::from_raw_parts_mut(out_off as usize as *mut u8, out_cap as usize);
    match f(req, out) {
        Ok(n) => n as u32,
        Err(rf) => refusal_verdict(rf, out) as u32,
    }
}

#[no_mangle]
pub extern "C" fn bnrose_admit(req_off: u32, req_len: u32, out_off: u32, out_cap: u32) -> u32 {
    unsafe { run(req_off, req_len, out_off, out_cap, handle_admit) }
}

#[no_mangle]
pub extern "C" fn bnrose_step(req_off: u32, req_len: u32, out_off: u32, out_cap: u32) -> u32 {
    unsafe { run(req_off, req_len, out_off, out_cap, handle_step) }
}

// ---- the native face of the same ABI (rlib consumers) ----------------------
//
// The supervisor's native worker and the agreement battery call these. On
// the host, pointers are not u32s, so this face hands the core the real
// slices; the verdict BYTES are the same encoder's either way (one core,
// one verdict encoder), and the wasm module's own marshaling is what the
// Wasmtime integration exercises. The paranoid dual-run compares the two
// end to end regardless.

fn native_call(
    req: &[u8],
    f: fn(&[u8], &mut [u8]) -> Result<usize, bnrose_exec_core::Refusal>,
) -> Vec<u8> {
    let n = req.len().min(MAX_REQUEST);
    let mut out = [0u8; MAX_VERDICT];
    let written = match f(&req[..n], &mut out) {
        Ok(w) => w,
        Err(rf) => refusal_verdict(rf, &mut out),
    };
    out[..written].to_vec()
}

/// Run an admission request natively through the ABI, returning the verdict
/// bytes exactly as the wasm module would emit them.
pub fn native_admit(req: &[u8]) -> Vec<u8> {
    native_call(req, handle_admit)
}

/// Run a step request natively through the ABI, returning the verdict bytes
/// exactly as the wasm module would emit them.
pub fn native_step(req: &[u8]) -> Vec<u8> {
    native_call(req, handle_step)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_native_face_answers_what_the_core_answers() {
        // a truncated admit request: the core refuses; the ABI answers the
        // refusal verdict; the native face returns those same bytes
        let v = native_admit(&[1, 1, 5]);
        let mut probe = [0u8; MAX_VERDICT];
        let n = refusal_verdict(bnrose_exec_core::Refusal::WireTruncated, &mut probe);
        assert_eq!(&v[..], &probe[..n]);
        assert_eq!(bnrose_abi_version(), bnrose_exec_core::ABI_VERSION);
        assert_ne!(bnrose_req_arena(), bnrose_verdict_arena());
    }
}
