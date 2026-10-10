//! bTunGsTeN WB001 — the model core, the implementation of `scripts/btungsten/wb001-cryptol/BTungstenWB001.cry`.
//!
//! Every function here is written to match one Cryptol definition, name for
//! name, so SAW (`scripts/btungsten/wb001-saw/rust.saw`) can prove each one
//! equal to its spec for ALL inputs, compositionally:
//!
//! | Rust                      | Cryptol (`BTungstenWB001`)          |
//! |---------------------------|-------------------------------------|
//! | [`utf8_step`]             | `step`                              |
//! | `well_formed_utf8_{64,128}` | `wellFormedUtf8`                  |
//! | `pad_ok_{32,64,128,4096}` | `canonicalPad len bs == bs`         |
//! | [`valid_intent`]          | `validIntent`                       |
//! | [`offsets`]               | `bDom` .. `bPld`, `envLen`          |
//! | [`byte_at`]               | `byteAt`                            |
//! | [`encode`]                | `wire` (and returns `envLen`)       |
//!
//! and the decoder core, against `scripts/btungsten/wb001-cryptol/WB001Decode.cry`
//! (`scripts/btungsten/wb001-saw/decode.saw`):
//!
//! | Rust                      | Cryptol (`WB001Decode`)             |
//! |---------------------------|-------------------------------------|
//! | [`byte_at_pos`]           | `byteAtPos`                         |
//! | [`byte_from`]             | `byteFrom`                          |
//! | `bytes_from_{32,64,128,4096}` | `bytesFrom`                     |
//! | [`chunk_64`]              | `chunk64`                           |
//! | [`be32_from`], [`be64_from`] | `be32From`, `be64From`           |
//! | [`block_code`]            | `blockCode`                         |
//! | [`decode_core`]           | `decodeSpec`                        |
//!
//! The encoder emits the envelope by position dispatch (`out[k] = byte_at(k)`)
//! instead of by concatenation. Same bytes (the shared vectors pin them), and
//! the shape SAW can verify: every write lands at a concrete index. The
//! decoder core reads a fixed `MAX_ENV` buffer and the true input length for
//! the same reason: SAW cannot run the slice decoder with a symbolic length
//! (a 900 s probe at inputs of at most 200 bytes never left symbolic
//! simulation, 2026-10-10), and every loop here has a concrete trip count.
//!
//! Arithmetic on offsets is `u32` wrapping, exactly Cryptol's `[32]`.
//! [`encode`] and [`byte_at`] require `valid_intent` (bounded lengths); on an
//! invalid intent they may panic on an array bound. They never return wrong
//! bytes silently: the bound check is the refusal.

#![no_std]
#![forbid(unsafe_code)]

/// Envelope capacity: the longest legal envelope (all fields at their maximum).
pub const MAX_ENV: usize = 4626;

/// `"bT-WB01" || 0x01`: magic plus version.
pub const HEAD8: [u8; 8] = [b'b', b'T', b'-', b'W', b'B', b'0', b'1', 0x01];

/// An intent in the formal shape: every variable field is a length word and a
/// capacity array whose bytes past `len` are zero (canonical padding).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Intent {
    pub domain_len: u32,
    pub domain: [u8; 64],
    pub nonce_len: u32,
    pub nonce: [u8; 32],
    pub epoch: u64,
    pub action_len: u32,
    pub action: [u8; 32],
    pub destination_len: u32,
    pub destination: [u8; 128],
    pub capability_len: u32,
    pub capability: [u8; 64],
    pub amount: u64,
    pub expiry: u64,
    pub payer_len: u32,
    pub payer: [u8; 128],
    pub payload_len: u32,
    pub payload: [u8; 4096],
}

impl Intent {
    /// Every length and byte zero (not a valid intent: lengths below the bounds).
    pub const ZERO: Intent = Intent {
        domain_len: 0,
        domain: [0; 64],
        nonce_len: 0,
        nonce: [0; 32],
        epoch: 0,
        action_len: 0,
        action: [0; 32],
        destination_len: 0,
        destination: [0; 128],
        capability_len: 0,
        capability: [0; 64],
        amount: 0,
        expiry: 0,
        payer_len: 0,
        payer: [0; 128],
        payload_len: 0,
        payload: [0; 4096],
    };
}

// ---- the UTF-8 DFA (Cryptol `step`) -------------------------------------

pub const ST_G: u8 = 0;
pub const ST_C1: u8 = 1;
pub const ST_C2: u8 = 2;
pub const ST_C3: u8 = 3;
pub const ST_E0: u8 = 4;
pub const ST_ED: u8 = 5;
pub const ST_F0: u8 = 6;
pub const ST_F4: u8 = 7;
pub const S_BAD: u8 = 13;

pub fn utf8_step(st: u8, b: u8) -> u8 {
    if st == S_BAD {
        S_BAD
    } else if st == ST_G {
        if b <= 0x7f {
            ST_G
        } else if (0xc2..=0xdf).contains(&b) {
            ST_C1
        } else if b == 0xe0 {
            ST_E0
        } else if (0xe1..=0xec).contains(&b) || b == 0xee || b == 0xef {
            ST_C2
        } else if b == 0xed {
            ST_ED
        } else if b == 0xf0 {
            ST_F0
        } else if (0xf1..=0xf3).contains(&b) {
            ST_C3
        } else if b == 0xf4 {
            ST_F4
        } else {
            S_BAD
        }
    } else if st == ST_C1 {
        if (0x80..=0xbf).contains(&b) {
            ST_G
        } else {
            S_BAD
        }
    } else if st == ST_C2 {
        if (0x80..=0xbf).contains(&b) {
            ST_C1
        } else {
            S_BAD
        }
    } else if st == ST_C3 {
        if (0x80..=0xbf).contains(&b) {
            ST_C2
        } else {
            S_BAD
        }
    } else if st == ST_E0 {
        if (0xa0..=0xbf).contains(&b) {
            ST_C1
        } else {
            S_BAD
        }
    } else if st == ST_ED {
        if (0x80..=0x9f).contains(&b) {
            ST_C1
        } else {
            S_BAD
        }
    } else if st == ST_F0 {
        if (0x90..=0xbf).contains(&b) {
            ST_C2
        } else {
            S_BAD
        }
    } else if st == ST_F4 {
        if (0x80..=0x8f).contains(&b) {
            ST_C2
        } else {
            S_BAD
        }
    } else {
        S_BAD
    }
}

macro_rules! well_formed {
    ($name:ident, $cap:expr) => {
        /// Cryptol `wellFormedUtf8`: the DFA run over the whole capacity array
        /// (the zero padding is a fixed point of the ground state).
        pub fn $name(bytes: &[u8; $cap]) -> bool {
            let mut st = ST_G;
            let mut i = 0;
            while i < $cap {
                st = utf8_step(st, bytes[i]);
                i += 1;
            }
            st == ST_G
        }
    };
}
well_formed!(well_formed_utf8_64, 64);
well_formed!(well_formed_utf8_128, 128);

macro_rules! pad_ok {
    ($name:ident, $cap:expr) => {
        /// Cryptol `canonicalPad len bs == bs`: nothing nonzero at or past `len`.
        /// Branch-free (`&` and `|` on bools, no short circuit): one term per
        /// byte, so symbolic execution never splits paths over 4096 bytes.
        pub fn $name(len: u32, bytes: &[u8; $cap]) -> bool {
            let mut ok = true;
            let mut i = 0;
            while i < $cap {
                ok &= ((i as u32) < len) | (bytes[i] == 0);
                i += 1;
            }
            ok
        }
    };
}
pad_ok!(pad_ok_32, 32);
pad_ok!(pad_ok_64, 64);
pad_ok!(pad_ok_128, 128);
pad_ok!(pad_ok_4096, 4096);

/// Cryptol `validIntent`.
pub fn valid_intent(i: &Intent) -> bool {
    i.domain_len >= 1
        && i.domain_len <= 64
        && pad_ok_64(i.domain_len, &i.domain)
        && well_formed_utf8_64(&i.domain)
        && i.nonce_len == 32
        && pad_ok_32(i.nonce_len, &i.nonce)
        && i.action_len == 32
        && pad_ok_32(i.action_len, &i.action)
        && i.destination_len >= 1
        && i.destination_len <= 128
        && pad_ok_128(i.destination_len, &i.destination)
        && well_formed_utf8_128(&i.destination)
        && i.capability_len >= 1
        && i.capability_len <= 64
        && pad_ok_64(i.capability_len, &i.capability)
        && well_formed_utf8_64(&i.capability)
        && i.payer_len >= 1
        && i.payer_len <= 128
        && pad_ok_128(i.payer_len, &i.payer)
        && well_formed_utf8_128(&i.payer)
        && i.payload_len <= 4096
        && pad_ok_4096(i.payload_len, &i.payload)
}

/// Block start offsets and the envelope length (Cryptol `bDom` .. `bPld`, `envLen`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Offsets {
    pub dom: u32,
    pub non: u32,
    pub epo: u32,
    pub act: u32,
    pub dst: u32,
    pub cap: u32,
    pub amt: u32,
    pub exp: u32,
    pub pay: u32,
    pub pld: u32,
    pub env: u32,
}

pub fn offsets(i: &Intent) -> Offsets {
    let dom = 8u32;
    let non = dom.wrapping_add(5).wrapping_add(i.domain_len);
    let epo = non.wrapping_add(5).wrapping_add(i.nonce_len);
    let act = epo.wrapping_add(5).wrapping_add(8);
    let dst = act.wrapping_add(5).wrapping_add(i.action_len);
    let cap = dst.wrapping_add(5).wrapping_add(i.destination_len);
    let amt = cap.wrapping_add(5).wrapping_add(i.capability_len);
    let exp = amt.wrapping_add(5).wrapping_add(8);
    let pay = exp.wrapping_add(5).wrapping_add(8);
    let pld = pay.wrapping_add(5).wrapping_add(i.payer_len);
    // Cryptol envLen sums the blocks in its own order; the same [32] sum.
    let env = 8u32
        .wrapping_add(5u32.wrapping_add(i.domain_len))
        .wrapping_add(5u32.wrapping_add(i.nonce_len))
        .wrapping_add(5 + 8)
        .wrapping_add(5u32.wrapping_add(i.action_len))
        .wrapping_add(5u32.wrapping_add(i.destination_len))
        .wrapping_add(5u32.wrapping_add(i.capability_len))
        .wrapping_add(5 + 8)
        .wrapping_add(5 + 8)
        .wrapping_add(5u32.wrapping_add(i.payer_len))
        .wrapping_add(5u32.wrapping_add(i.payload_len));
    Offsets {
        dom,
        non,
        epo,
        act,
        dst,
        cap,
        amt,
        exp,
        pay,
        pld,
        env,
    }
}

#[inline]
fn in_block(off: u32, sz: u32, k: u32) -> bool {
    k >= off && k < off.wrapping_add(sz)
}

#[inline]
fn len_byte(len: u32, k: u32, off: u32) -> u8 {
    // (split len : [4][8]) @ (k - off - 1): big-endian
    len.to_be_bytes()[k.wrapping_sub(off).wrapping_sub(1) as usize]
}

macro_rules! block_byte {
    ($name:ident, $cap:expr) => {
        #[inline]
        fn $name(t: u8, off: u32, len: u32, bytes: &[u8; $cap], k: u32) -> u8 {
            if k == off {
                t
            } else if k < off.wrapping_add(5) {
                len_byte(len, k, off)
            } else {
                bytes[k.wrapping_sub(off).wrapping_sub(5) as usize]
            }
        }
    };
}
block_byte!(block_byte_8, 8);
block_byte!(block_byte_32, 32);
block_byte!(block_byte_64, 64);
block_byte!(block_byte_128, 128);
block_byte!(block_byte_4096, 4096);

/// Cryptol `byteAt`: the byte at envelope position `k`, by block dispatch.
/// `o` must be `offsets(i)`.
pub fn byte_at(i: &Intent, o: &Offsets, k: u32) -> u8 {
    if k < 8 {
        HEAD8[k as usize]
    } else if in_block(o.dom, 5u32.wrapping_add(i.domain_len), k) {
        block_byte_64(0x01, o.dom, i.domain_len, &i.domain, k)
    } else if in_block(o.non, 5u32.wrapping_add(i.nonce_len), k) {
        block_byte_32(0x02, o.non, i.nonce_len, &i.nonce, k)
    } else if in_block(o.epo, 5 + 8, k) {
        block_byte_8(0x03, o.epo, 8, &i.epoch.to_be_bytes(), k)
    } else if in_block(o.act, 5u32.wrapping_add(i.action_len), k) {
        block_byte_32(0x04, o.act, i.action_len, &i.action, k)
    } else if in_block(o.dst, 5u32.wrapping_add(i.destination_len), k) {
        block_byte_128(0x05, o.dst, i.destination_len, &i.destination, k)
    } else if in_block(o.cap, 5u32.wrapping_add(i.capability_len), k) {
        block_byte_64(0x06, o.cap, i.capability_len, &i.capability, k)
    } else if in_block(o.amt, 5 + 8, k) {
        block_byte_8(0x07, o.amt, 8, &i.amount.to_be_bytes(), k)
    } else if in_block(o.exp, 5 + 8, k) {
        block_byte_8(0x08, o.exp, 8, &i.expiry.to_be_bytes(), k)
    } else if in_block(o.pay, 5u32.wrapping_add(i.payer_len), k) {
        block_byte_128(0x09, o.pay, i.payer_len, &i.payer, k)
    } else if in_block(o.pld, 5u32.wrapping_add(i.payload_len), k) {
        block_byte_4096(0x0a, o.pld, i.payload_len, &i.payload, k)
    } else {
        0
    }
}

/// Cryptol `wire`: writes the zero-padded envelope into `out` and returns
/// `envLen`. The deployed envelope is `out[..envLen]`.
pub fn encode(i: &Intent, out: &mut [u8; MAX_ENV]) -> u32 {
    let o = offsets(i);
    let mut k = 0;
    while k < MAX_ENV {
        out[k] = byte_at(i, &o, k as u32);
        k += 1;
    }
    o.env
}

// ---- the decoder core (Cryptol `WB001Decode`) -----------------------------

/// Verdicts of [`decode_core`]: accepted, or the first refusal in the order
/// the pinned vectors record (`btungsten_wb001::Refusal` maps them).
pub const D_OK: u8 = 0;
pub const D_SHORT: u8 = 1;
pub const D_MAGIC: u8 = 2;
pub const D_VERSION: u8 = 3;
pub const D_TAG_ORDER: u8 = 4;
pub const D_LENGTH: u8 = 5;
pub const D_UTF8: u8 = 6;
pub const D_TRAILING: u8 = 7;

/// Cryptol `byteAtPos`: the input byte at position `p`; zero outside the
/// buffer. Every read the decoder core makes at a computed position goes
/// through here, so SAW proves one symbolic read, once; total, so a call
/// leaves SAW no side goal (no read [`decode_core`] falls outside).
pub fn byte_at_pos(buf: &[u8; MAX_ENV], p: u32) -> u8 {
    if p < MAX_ENV as u32 {
        buf[p as usize]
    } else {
        0
    }
}

/// Cryptol `byteFrom`: byte `j` of the `len` value bytes starting at `q`;
/// zero past `len` (canonical padding).
pub fn byte_from(buf: &[u8; MAX_ENV], q: u32, len: u32, j: u32) -> u8 {
    if j < len {
        byte_at_pos(buf, q.wrapping_add(j))
    } else {
        0
    }
}

macro_rules! bytes_from {
    ($name:ident, $cap:expr) => {
        /// Cryptol `bytesFrom`: the `len` value bytes starting at `q`, in the
        /// formal shape (zero padded to the field's capacity).
        pub fn $name(buf: &[u8; MAX_ENV], q: u32, len: u32) -> [u8; $cap] {
            let mut a = [0u8; $cap];
            let mut j = 0;
            while j < $cap {
                a[j] = byte_from(buf, q, len, j as u32);
                j += 1;
            }
            a
        }
    };
}
bytes_from!(bytes_from_32, 32);
bytes_from!(bytes_from_64, 64);
bytes_from!(bytes_from_128, 128);

/// Cryptol `chunk64`: bytes `base` .. `base + 63` of the `len` value bytes
/// starting at `q` (zero padded), one chunk of the payload.
pub fn chunk_64(buf: &[u8; MAX_ENV], q: u32, len: u32, base: u32) -> [u8; 64] {
    let mut a = [0u8; 64];
    let mut i = 0;
    while i < 64 {
        a[i] = byte_from(buf, q, len, base.wrapping_add(i as u32));
        i += 1;
    }
    a
}

/// Cryptol `bytesFrom` at the payload's capacity, in 64 chunks: SAW applies
/// the chunk override 64 times instead of the byte override 4,096 times.
pub fn bytes_from_4096(buf: &[u8; MAX_ENV], q: u32, len: u32) -> [u8; 4096] {
    let mut a = [0u8; 4096];
    let mut c = 0;
    while c < 64 {
        let k = chunk_64(buf, q, len, (c * 64) as u32);
        let mut i = 0;
        while i < 64 {
            a[c * 64 + i] = k[i];
            i += 1;
        }
        c += 1;
    }
    a
}

/// Cryptol `be32From`: the big-endian u32 at `q`.
pub fn be32_from(buf: &[u8; MAX_ENV], q: u32) -> u32 {
    u32::from_be_bytes([
        byte_at_pos(buf, q),
        byte_at_pos(buf, q.wrapping_add(1)),
        byte_at_pos(buf, q.wrapping_add(2)),
        byte_at_pos(buf, q.wrapping_add(3)),
    ])
}

/// Cryptol `be64From`: the big-endian u64 at `q`.
pub fn be64_from(buf: &[u8; MAX_ENV], q: u32) -> u64 {
    u64::from_be_bytes([
        byte_at_pos(buf, q),
        byte_at_pos(buf, q.wrapping_add(1)),
        byte_at_pos(buf, q.wrapping_add(2)),
        byte_at_pos(buf, q.wrapping_add(3)),
        byte_at_pos(buf, q.wrapping_add(4)),
        byte_at_pos(buf, q.wrapping_add(5)),
        byte_at_pos(buf, q.wrapping_add(6)),
        byte_at_pos(buf, q.wrapping_add(7)),
    ])
}

/// Cryptol `blockCode`: the refusal the block header at `at` raises, in the
/// decoder's order (short header, tag, length bounds, short value); `D_OK`
/// when the header is well formed and its value fits in the `n` input bytes.
pub fn block_code(buf: &[u8; MAX_ENV], n: u64, at: u32, tag: u8, lo: u32, hi: u32) -> u8 {
    if (at as u64) + 5 > n {
        D_SHORT
    } else if byte_at_pos(buf, at) != tag {
        D_TAG_ORDER
    } else {
        let len = be32_from(buf, at.wrapping_add(1));
        if len < lo || len > hi {
            D_LENGTH
        } else if (at as u64) + 5 + (len as u64) > n {
            D_SHORT
        } else {
            D_OK
        }
    }
}

/// Cryptol `decodeSpec`: the strict decode of an input of `n` bytes whose
/// first `MAX_ENV` bytes are `buf` (no accepted block reaches position
/// `MAX_ENV`, so the rest can only be counted, never read). Returns the
/// verdict; writes `out` on `D_OK` only.
pub fn decode_core(buf: &[u8; MAX_ENV], n: u64, out: &mut Intent) -> u8 {
    if n < 8 {
        return D_SHORT;
    }
    let mut magic = true;
    let mut k = 0;
    while k < 7 {
        magic &= buf[k] == HEAD8[k];
        k += 1;
    }
    if !magic {
        return D_MAGIC;
    }
    if buf[7] != HEAD8[7] {
        return D_VERSION;
    }

    let a_dom: u32 = 8;
    let c = block_code(buf, n, a_dom, 0x01, 1, 64);
    if c != D_OK {
        return c;
    }
    let l_dom = be32_from(buf, a_dom.wrapping_add(1));
    let domain = bytes_from_64(buf, a_dom.wrapping_add(5), l_dom);
    if !well_formed_utf8_64(&domain) {
        return D_UTF8;
    }

    let a_non = a_dom.wrapping_add(5).wrapping_add(l_dom);
    let c = block_code(buf, n, a_non, 0x02, 32, 32);
    if c != D_OK {
        return c;
    }
    let l_non = be32_from(buf, a_non.wrapping_add(1));
    let nonce = bytes_from_32(buf, a_non.wrapping_add(5), l_non);

    let a_epo = a_non.wrapping_add(5).wrapping_add(l_non);
    let c = block_code(buf, n, a_epo, 0x03, 8, 8);
    if c != D_OK {
        return c;
    }
    let epoch = be64_from(buf, a_epo.wrapping_add(5));

    let a_act = a_epo.wrapping_add(5).wrapping_add(8);
    let c = block_code(buf, n, a_act, 0x04, 32, 32);
    if c != D_OK {
        return c;
    }
    let l_act = be32_from(buf, a_act.wrapping_add(1));
    let action = bytes_from_32(buf, a_act.wrapping_add(5), l_act);

    let a_dst = a_act.wrapping_add(5).wrapping_add(l_act);
    let c = block_code(buf, n, a_dst, 0x05, 1, 128);
    if c != D_OK {
        return c;
    }
    let l_dst = be32_from(buf, a_dst.wrapping_add(1));
    let destination = bytes_from_128(buf, a_dst.wrapping_add(5), l_dst);
    if !well_formed_utf8_128(&destination) {
        return D_UTF8;
    }

    let a_cap = a_dst.wrapping_add(5).wrapping_add(l_dst);
    let c = block_code(buf, n, a_cap, 0x06, 1, 64);
    if c != D_OK {
        return c;
    }
    let l_cap = be32_from(buf, a_cap.wrapping_add(1));
    let capability = bytes_from_64(buf, a_cap.wrapping_add(5), l_cap);
    if !well_formed_utf8_64(&capability) {
        return D_UTF8;
    }

    let a_amt = a_cap.wrapping_add(5).wrapping_add(l_cap);
    let c = block_code(buf, n, a_amt, 0x07, 8, 8);
    if c != D_OK {
        return c;
    }
    let amount = be64_from(buf, a_amt.wrapping_add(5));

    let a_exp = a_amt.wrapping_add(5).wrapping_add(8);
    let c = block_code(buf, n, a_exp, 0x08, 8, 8);
    if c != D_OK {
        return c;
    }
    let expiry = be64_from(buf, a_exp.wrapping_add(5));

    let a_pay = a_exp.wrapping_add(5).wrapping_add(8);
    let c = block_code(buf, n, a_pay, 0x09, 1, 128);
    if c != D_OK {
        return c;
    }
    let l_pay = be32_from(buf, a_pay.wrapping_add(1));
    let payer = bytes_from_128(buf, a_pay.wrapping_add(5), l_pay);
    if !well_formed_utf8_128(&payer) {
        return D_UTF8;
    }

    let a_pld = a_pay.wrapping_add(5).wrapping_add(l_pay);
    let c = block_code(buf, n, a_pld, 0x0a, 0, 4096);
    if c != D_OK {
        return c;
    }
    let l_pld = be32_from(buf, a_pld.wrapping_add(1));
    let payload = bytes_from_4096(buf, a_pld.wrapping_add(5), l_pld);

    let a_end = a_pld.wrapping_add(5).wrapping_add(l_pld);
    if a_end as u64 != n {
        return D_TRAILING;
    }
    *out = Intent {
        domain_len: l_dom,
        domain,
        nonce_len: l_non,
        nonce,
        epoch,
        action_len: l_act,
        action,
        destination_len: l_dst,
        destination,
        capability_len: l_cap,
        capability,
        amount,
        expiry,
        payer_len: l_pay,
        payer,
        payload_len: l_pld,
        payload,
    };
    D_OK
}
