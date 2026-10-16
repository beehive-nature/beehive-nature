//! The preview face of `bnr-explorer` as a wasm module.
//!
//! THE MODULE HAS NO IMPORTS. No WASI, no host functions, no environment, so
//! the code that reads untrusted bytes cannot name a network, a key, a store
//! or a clock: its whole world is the request the page writes into its
//! memory and the verdict it writes back. The page checks this before it
//! instantiates the module (`WebAssembly.Module.imports(m).length === 0`,
//! plus the module's pinned sha256) and turns previews off rather than run a
//! module that fails either check. The test below checks the committed
//! module the same way.
//!
//! The ABI (pointers are offsets into this module's memory):
//!
//! ```text
//! bx_abi_version() -> u32
//! bx_alloc(len) -> u32                  0 when len is 0 or over MAX_REQUEST
//! bx_free(ptr, len)
//! bx_verdict_arena() -> u32             a MAX_VERDICT-byte buffer
//! bx_verdict_cap() -> u32               MAX_VERDICT
//! bx_preview(req, req_len, out, cap) -> u32
//! ```
//!
//! `bx_preview` returns the verdict's length; when it exceeds `cap` nothing is
//! written. With the arena as `out` it always fits. A bad request is answered
//! with a refusal verdict, never a trap.
//!
//! `unsafe` is here and only here: turning the host's offsets into slices,
//! and the allocator calls behind `bx_alloc`/`bx_free`. The module runs one
//! call at a time and never calls out (it cannot), so nothing else can touch
//! those bytes during a call.

use std::alloc::{alloc, dealloc, Layout};

use bnr_explorer::preview::BUDGET;
use bnr_explorer::wire::{self, MAX_VERDICT, REQUEST_HEADER};

pub const ABI_VERSION: u32 = 1;
/// The largest request: a header and the largest previewable object.
pub const MAX_REQUEST: usize = REQUEST_HEADER + BUDGET.max_input;

static mut VERDICT: [u8; MAX_VERDICT] = [0; MAX_VERDICT];

#[no_mangle]
pub extern "C" fn bx_abi_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn bx_alloc(len: u32) -> u32 {
    let len = len as usize;
    if len == 0 || len > MAX_REQUEST {
        return 0;
    }
    match Layout::from_size_align(len, 1) {
        Ok(layout) => unsafe { alloc(layout) as usize as u32 },
        Err(_) => 0,
    }
}

#[no_mangle]
pub extern "C" fn bx_free(ptr: u32, len: u32) {
    let len = len as usize;
    if ptr == 0 || len == 0 || len > MAX_REQUEST {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(len, 1) {
        unsafe { dealloc(ptr as usize as *mut u8, layout) }
    }
}

#[no_mangle]
pub extern "C" fn bx_verdict_arena() -> u32 {
    core::ptr::addr_of_mut!(VERDICT) as usize as u32
}

#[no_mangle]
pub extern "C" fn bx_verdict_cap() -> u32 {
    MAX_VERDICT as u32
}

/// Judge the request at `req..req+req_len`, writing the verdict at `out`.
/// Safe iff both ranges lie in this module's memory and do not overlap — the
/// host's one obligation, which the arena and `bx_alloc` meet by
/// construction.
#[no_mangle]
pub extern "C" fn bx_preview(req: u32, req_len: u32, out: u32, cap: u32) -> u32 {
    let (req, out) = unsafe {
        (
            core::slice::from_raw_parts(req as usize as *const u8, req_len as usize),
            core::slice::from_raw_parts_mut(out as usize as *mut u8, cap as usize),
        )
    };
    wire::handle(req, out) as u32
}

/// The same handler natively: the verdict bytes the module would write.
pub fn native_preview(req: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; MAX_VERDICT];
    let n = wire::handle(req, &mut out);
    out.truncate(n);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// The committed module, the bytes the page fetches.
    fn committed() -> Vec<u8> {
        let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../surfaces/bnr-explorer.wasm");
        std::fs::read(&p).unwrap_or_else(|e| panic!("{}: {e}", p.display()))
    }

    fn leb(b: &[u8], p: &mut usize) -> u32 {
        let (mut v, mut shift) = (0u32, 0);
        loop {
            let byte = b[*p];
            *p += 1;
            v |= ((byte & 0x7F) as u32) << shift;
            if byte & 0x80 == 0 {
                return v;
            }
            shift += 7;
        }
    }

    fn name(b: &[u8], p: &mut usize) -> String {
        let n = leb(b, p) as usize;
        let s = String::from_utf8(b[*p..*p + n].to_vec()).unwrap();
        *p += n;
        s
    }

    /// (import count, exported names) read straight from the binary.
    fn sections(m: &[u8]) -> (u32, Vec<String>) {
        assert_eq!(&m[..8], b"\0asm\x01\0\0\0", "not a wasm v1 module");
        let (mut p, mut imports, mut exports) = (8, 0, Vec::new());
        while p < m.len() {
            let id = m[p];
            p += 1;
            let size = leb(m, &mut p) as usize;
            let end = p + size;
            let mut q = p;
            match id {
                2 => imports = leb(m, &mut q),
                7 => {
                    for _ in 0..leb(m, &mut q) {
                        exports.push(name(m, &mut q));
                        q += 1; // kind
                        leb(m, &mut q); // index
                    }
                }
                _ => {}
            }
            p = end;
        }
        exports.sort();
        (imports, exports)
    }

    #[test]
    fn the_committed_module_imports_nothing_and_exports_only_the_abi() {
        let (imports, exports) = sections(&committed());
        assert_eq!(imports, 0, "the preview module must have no imports");
        let mut want = vec![
            "bx_abi_version",
            "bx_alloc",
            "bx_free",
            "bx_preview",
            "bx_verdict_arena",
            "bx_verdict_cap",
            "memory",
        ];
        want.sort();
        assert_eq!(exports, want);
    }

    #[test]
    fn the_section_reader_sees_an_import_when_there_is_one() {
        // a hand-built module importing env.f: () -> () — the negative
        // control for the test above
        let m: Vec<u8> = [
            &b"\0asm\x01\0\0\0"[..],
            &[1, 4, 1, 0x60, 0, 0],                         // type section
            &[2, 9, 1, 3, b'e', b'n', b'v', 1, b'f', 0, 0], // import section
        ]
        .concat();
        assert_eq!(sections(&m).0, 1);
    }

    #[test]
    fn the_allocator_refuses_what_no_request_could_need() {
        assert_eq!(bx_alloc(0), 0);
        assert_eq!(bx_alloc((MAX_REQUEST + 1) as u32), 0);
        bx_free(0, 10); // a no-op, not a crash
    }

    #[test]
    fn the_native_face_is_the_kernel() {
        use bnr_explorer::{HashAlg, ObjectId};
        let body = b"plain words";
        let id = ObjectId::of(HashAlg::Sha256, body);
        let mut req = b"BXPQ\x01\x01".to_vec();
        req.extend_from_slice(id.digest());
        req.extend_from_slice(&(body.len() as u32).to_le_bytes());
        req.extend_from_slice(body);
        let v = native_preview(&req);
        assert_eq!(&v[..6], b"BXPV\x01\x01");
        assert_eq!(&v[v.len() - body.len()..], body);
        assert_eq!(bx_abi_version(), ABI_VERSION);
        assert_eq!(bx_verdict_cap() as usize, MAX_VERDICT);
    }
}
