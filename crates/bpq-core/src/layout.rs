//! SPEC-BPQ-1 byte layouts (SPEC-BTUNGSTEN-PQ-1 PQ04): the `bpq1/` domain
//! labels, the AES-GCM nonce of a sealed-object part, the segment
//! arithmetic of a sealed object, and the two validators a binding's signed
//! bytes rest on. bsigner calls these; `scripts/btungsten/pq04-saw/layout.saw`
//! proves each one equal to `scripts/btungsten/pq04-cryptol/BpqLayout.cry`,
//! and `properties.saw` proves the spec's obligations (`domainsDisjoint`,
//! `nonceInjective`, `bodyExact`, `segmentsTile`, the separator lemmas, and
//! the bounded `bindInjective` model).

/// `bpq1/id`: the id hash preimage
pub const ID: u8 = 0;
/// `bpq1/succession`: the succession commitment preimage
pub const SUCCESSION: u8 = 1;
/// `bpq1/card`: the card signing message
pub const CARD: u8 = 2;
/// `bpq1/bind`: the binding signing message
pub const BIND: u8 = 3;
/// `bpq1/detached`: the detached file signature message
pub const DETACHED: u8 = 4;
/// `bpq1/key-commit`: the file key commitment preimage
pub const KEY_COMMIT: u8 = 5;
/// `bpq1/seal`: the SEAL signing message
pub const SEAL: u8 = 6;
/// `bpq1/wrap/self`: the HKDF info of a self slot
pub const WRAP_SELF: u8 = 7;
/// `bpq1/wrap/x-wing`: the HKDF info of an X-Wing slot
pub const WRAP_XWING: u8 = 8;
/// `bpq1/handover`: the succession handover message (SLH-DSA)
pub const HANDOVER: u8 = 9;
/// `bpq1/cosign:`: the wallet's Ed25519 cosignature over a binding
pub const COSIGN: u8 = 10;
/// `bpq1/words`: the six-word id fingerprint preimage (bpq.js `words`)
pub const WORDS: u8 = 11;
/// `bpq1/nostr-event`: the Nostr event attestation message (PQ13)
pub const NOSTR_EVENT: u8 = 12;
/// Domain ids are `0 .. DOMAIN_COUNT`.
pub const DOMAIN_COUNT: u8 = 13;
pub const DOMAIN_CAP: usize = 20;

/// Every `bpq1/` domain label: the prefix of a signing message, of a hash
/// preimage or of an HKDF wrap info. Index = domain id.
pub const DOMAIN_STR: [&str; 13] = [
    "bpq1/id",
    "bpq1/succession",
    "bpq1/card",
    "bpq1/bind",
    "bpq1/detached",
    "bpq1/key-commit",
    "bpq1/seal",
    "bpq1/wrap/self",
    "bpq1/wrap/x-wing",
    "bpq1/handover",
    "bpq1/cosign:",
    "bpq1/words",
    "bpq1/nostr-event",
];

const fn pad(s: &str) -> [u8; DOMAIN_CAP] {
    let b = s.as_bytes();
    assert!(b.len() <= DOMAIN_CAP);
    let mut out = [0u8; DOMAIN_CAP];
    let mut i = 0;
    while i < b.len() {
        out[i] = b[i];
        i += 1;
    }
    out
}

const fn pads() -> [[u8; DOMAIN_CAP]; 13] {
    let mut out = [[0u8; DOMAIN_CAP]; 13];
    let mut d = 0;
    while d < 13 {
        out[d] = pad(DOMAIN_STR[d]);
        d += 1;
    }
    out
}

const fn lens() -> [u32; 13] {
    let mut out = [0u32; 13];
    let mut d = 0;
    while d < 13 {
        out[d] = DOMAIN_STR[d].len() as u32;
        d += 1;
    }
    out
}

/// The domain labels, zero-padded to `DOMAIN_CAP`.
pub const DOMAIN_BYTES: [[u8; DOMAIN_CAP]; 13] = pads();
/// The domain label lengths.
pub const DOMAIN_LEN: [u32; 13] = lens();

/// Byte `k` of domain `d`'s label, zero past its end: the table SAW proves
/// equal to the spec's. `d` must be a domain id.
pub fn domain_byte(d: u8, k: u32) -> u8 {
    if (k as usize) < DOMAIN_CAP {
        DOMAIN_BYTES[d as usize][k as usize]
    } else {
        0
    }
}

/// The length of domain `d`'s label: the table SAW proves equal to the
/// spec's. `d` must be a domain id.
pub fn domain_len(d: u8) -> u32 {
    DOMAIN_LEN[d as usize]
}

/// The label of domain `d`: the bytes of the table `domain_byte` reads, cut
/// at `domain_len`, both proven equal to the spec's. `d` must be a domain id.
pub fn domain(d: u8) -> &'static [u8] {
    &DOMAIN_BYTES[d as usize][..domain_len(d) as usize]
}

/// Nonce flags of the parts of a sealed object.
pub const FLAG_MORE: u32 = 0;
pub const FLAG_FINAL: u32 = 1;
pub const FLAG_META: u32 = 2;
pub const FLAG_SEAL: u32 = 3;

/// The AES-256-GCM nonce of a sealed-object part: flag (u32, big-endian)
/// then index (u64, big-endian).
pub fn nonce(flag: u32, index: u64) -> [u8; 12] {
    let f = flag.to_be_bytes();
    let i = index.to_be_bytes();
    [
        f[0], f[1], f[2], f[3], i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7],
    ]
}

pub const SEG_MIN: u64 = 1024;
pub const SEG_MAX: u64 = 16_777_216;
/// The AES-GCM tag each segment carries.
pub const TAG_LEN: u64 = 16;

/// A segment size the CORE may name.
pub fn seg_ok(seg: u64) -> bool {
    (SEG_MIN..=SEG_MAX).contains(&seg)
}

/// The number of BODY segments: one (empty, tag only) for an empty file,
/// else `ceil(len / seg)`. `seg_ok(seg)` must hold.
pub fn segment_count(len: u64, seg: u64) -> u64 {
    if len == 0 {
        1
    } else {
        len.div_ceil(seg)
    }
}

/// The BODY length `len + 16·n`, if it neither overflows nor exceeds
/// `avail`, the bytes left in the object. `seg_ok(seg)` must hold.
pub fn body_len(len: u64, seg: u64, avail: u64) -> Option<u64> {
    let n = segment_count(len, seg);
    let b = n.checked_mul(TAG_LEN)?.checked_add(len)?;
    if b <= avail {
        Some(b)
    } else {
        None
    }
}

/// The plaintext length of segment `i` of `n`: `seg`, except the last,
/// which holds what is left: `len % seg`, a whole `seg` when that is 0, and
/// 0 for an empty file. No multiplication or subtraction, so nothing on
/// this path can wrap. `n = segment_count(len, seg)`, `i < n`.
pub fn segment_plain_len(i: u64, n: u64, len: u64, seg: u64) -> u64 {
    if i + 1 < n {
        seg
    } else if len == 0 {
        0
    } else if len.is_multiple_of(seg) {
        seg
    } else {
        len % seg
    }
}

pub const TEXT_CAP: usize = 32;

/// A short text, zero-padded to `TEXT_CAP`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Text {
    pub len: u32,
    pub bytes: [u8; TEXT_CAP],
}

impl Text {
    /// `b` as a padded text, or `None` if it is longer than `TEXT_CAP`.
    pub fn new(b: &[u8]) -> Option<Text> {
        if b.len() > TEXT_CAP {
            return None;
        }
        let mut bytes = [0u8; TEXT_CAP];
        bytes[..b.len()].copy_from_slice(b);
        Some(Text {
            len: b.len() as u32,
            bytes,
        })
    }
}

fn digit(b: u8) -> bool {
    b.is_ascii_digit()
}

/// Cryptol `atOk`: `YYYY-MM-DDTHH:MM:SS[.f{1,9}]Z`, bpq.js `AT_RE` (the
/// shape only: field ranges are not checked). Branch-free.
pub fn utc_timestamp(t: &Text) -> bool {
    let b = &t.bytes;
    let n = t.len;
    let head = digit(b[0])
        & digit(b[1])
        & digit(b[2])
        & digit(b[3])
        & (b[4] == b'-')
        & digit(b[5])
        & digit(b[6])
        & (b[7] == b'-')
        & digit(b[8])
        & digit(b[9])
        & (b[10] == b'T')
        & digit(b[11])
        & digit(b[12])
        & (b[13] == b':')
        & digit(b[14])
        & digit(b[15])
        & (b[16] == b':')
        & digit(b[17])
        & digit(b[18]);
    let whole = (n == 20) & (b[19] == b'Z');
    let mut frac = (22..=30).contains(&n) & (b[19] == b'.');
    let mut i = 20;
    while i < 30 {
        let k = i as u32;
        let last = k + 1 == n;
        let inside = k + 1 < n;
        frac &= (!last | (b[i] == b'Z')) & (!inside | digit(b[i]));
        i += 1;
    }
    head & (whole | frac)
}

fn kind_first(b: u8) -> bool {
    b.is_ascii_lowercase() | b.is_ascii_digit()
}

fn kind_rest(b: u8) -> bool {
    kind_first(b) | (b == b'.') | (b == b'_') | (b == b'-')
}

/// Cryptol `kindOk`: `[a-z0-9][a-z0-9._-]{0,31}`, bpq.js `KIND_RE`.
/// Branch-free.
pub fn claim_kind(t: &Text) -> bool {
    let b = &t.bytes;
    let mut ok = (t.len >= 1) & (t.len <= TEXT_CAP as u32) & kind_first(b[0]);
    let mut i = 1;
    while i < TEXT_CAP {
        let inside = (i as u32) < t.len;
        ok &= !inside | kind_rest(b[i]);
        i += 1;
    }
    ok
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(s: &str) -> Text {
        Text::new(s.as_bytes()).unwrap()
    }

    #[test]
    fn the_domain_table_is_the_strings() {
        for (d, s) in DOMAIN_STR.iter().enumerate() {
            assert_eq!(domain(d as u8), s.as_bytes());
            assert!(DOMAIN_BYTES[d][s.len()..].iter().all(|&b| b == 0));
        }
        for (a, la) in DOMAIN_STR.iter().enumerate() {
            for (b, lb) in DOMAIN_STR.iter().enumerate() {
                assert!(a == b || !lb.starts_with(la), "{la} prefixes {lb}");
            }
        }
    }

    #[test]
    fn nonce_is_flag_then_index_big_endian() {
        assert_eq!(nonce(1, 2), [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2]);
        assert_eq!(nonce(FLAG_SEAL, u64::MAX)[4..], [0xff; 8]);
    }

    #[test]
    fn segment_arithmetic() {
        assert_eq!(segment_count(0, 1024), 1);
        assert_eq!(segment_count(1, 1024), 1);
        assert_eq!(segment_count(1024, 1024), 1);
        assert_eq!(segment_count(1025, 1024), 2);
        assert_eq!(body_len(1025, 1024, 1057), Some(1057));
        assert_eq!(body_len(1025, 1024, 1056), None);
        assert_eq!(body_len(u64::MAX, 1024, u64::MAX), None, "no wrap");
        assert_eq!(segment_plain_len(1, 2, 1025, 1024), 1);
        assert_eq!(segment_plain_len(0, 1, 0, 1024), 0);
        assert!(!seg_ok(1023) && seg_ok(1024) && seg_ok(SEG_MAX) && !seg_ok(SEG_MAX + 1));
    }

    #[test]
    fn validators_match_the_browser_patterns() {
        for ok in [
            "2026-10-08T12:00:00Z",
            "2026-10-08T12:00:00.1Z",
            "2026-10-08T12:00:00.123456789Z",
        ] {
            assert!(utc_timestamp(&t(ok)), "{ok}");
        }
        for bad in [
            "2026-10-08T12:00:00",
            "2026-10-08T12:00:00.Z",
            "2026-10-08T12:00:00.1234567890Z",
            "2026-10-08 12:00:00Z",
            "2026-10-08T12:00:00Z\n",
            "2026-10-08T12:00:00Z\ned25519=x",
            "x026-10-08T12:00:00Z",
        ] {
            assert!(
                Text::new(bad.as_bytes()).is_none_or(|x| !utc_timestamp(&x)),
                "{bad:?}"
            );
        }
        for ok in [
            "a",
            "ed25519",
            "vaulta-k1",
            "successor-bzpq",
            "x.y_z",
            &"a".repeat(32),
        ] {
            assert!(claim_kind(&t(ok)), "{ok}");
        }
        for bad in ["", "A", "-a", "a=b", "a\nb", "\u{e9}"] {
            assert!(!claim_kind(&t(bad)), "{bad:?}");
        }
        assert!(Text::new("a".repeat(33).as_bytes()).is_none());
    }
}
