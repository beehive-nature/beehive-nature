//! The preview wire: the only bytes that cross into and out of the wasm
//! module. Fixed little-endian layouts, a magic and a version on both sides,
//! every length checked before it is used.
//!
//! ```text
//! request  "BXPQ" ver=1 alg:u8 digest:[32] body_len:u32 body:[body_len]
//! verdict  "BXPV" ver=1 tag:u8 …
//!            tag 1 text         truncated:u8 lines:u32 text_len:u32 text:[text_len]
//!            tag 2 image        format:u8 width:u32 height:u32
//!            tag 3 unavailable  reason:u8 detail:u8
//!            tag 4 refused      wire_refusal:u8   (the request itself was bad)
//! ```

use crate::id::{HashAlg, ObjectId};
use crate::preview::{Preview, BUDGET};

pub const REQUEST_MAGIC: &[u8; 4] = b"BXPQ";
pub const VERDICT_MAGIC: &[u8; 4] = b"BXPV";
pub const VERSION: u8 = 1;
pub const REQUEST_HEADER: usize = 4 + 1 + 1 + 32 + 4;
/// The largest verdict: a text verdict carrying a full excerpt.
pub const MAX_VERDICT: usize = 4 + 1 + 1 + 1 + 4 + 4 + BUDGET.max_text_bytes;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WireRefusal {
    Truncated,
    BadMagic,
    BadVersion,
    UnknownAlg,
    LengthMismatch,
}

impl WireRefusal {
    pub const fn wire(self) -> u8 {
        match self {
            WireRefusal::Truncated => 1,
            WireRefusal::BadMagic => 2,
            WireRefusal::BadVersion => 3,
            WireRefusal::UnknownAlg => 4,
            WireRefusal::LengthMismatch => 5,
        }
    }
}

/// Split a request into the id it names and the body to judge.
pub fn decode_request(req: &[u8]) -> Result<(ObjectId, &[u8]), WireRefusal> {
    if req.len() < REQUEST_HEADER {
        return Err(WireRefusal::Truncated);
    }
    if &req[..4] != REQUEST_MAGIC {
        return Err(WireRefusal::BadMagic);
    }
    if req[4] != VERSION {
        return Err(WireRefusal::BadVersion);
    }
    let alg = HashAlg::from_wire(req[5]).ok_or(WireRefusal::UnknownAlg)?;
    let mut digest = [0u8; 32];
    digest.copy_from_slice(&req[6..38]);
    let body_len = u32::from_le_bytes([req[38], req[39], req[40], req[41]]) as usize;
    if body_len != req.len() - REQUEST_HEADER {
        return Err(WireRefusal::LengthMismatch);
    }
    Ok((ObjectId::new(alg, digest), &req[REQUEST_HEADER..]))
}

/// Build a request (the page does this in JS; this is the reference the
/// tests hold it to).
#[cfg(test)]
pub fn encode_request(id: &ObjectId, body: &[u8]) -> alloc::vec::Vec<u8> {
    let mut out = alloc::vec::Vec::with_capacity(REQUEST_HEADER + body.len());
    out.extend_from_slice(REQUEST_MAGIC);
    out.push(VERSION);
    out.push(id.alg().wire());
    out.extend_from_slice(id.digest());
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
    out.extend_from_slice(body);
    out
}

/// Encode a verdict into `out`. Returns the verdict's length; when it does
/// not fit, nothing is written and the length is still returned.
pub fn encode_verdict(v: &Result<Preview, WireRefusal>, out: &mut [u8]) -> usize {
    let mut w = Writer { out, n: 0 };
    let need = verdict_len(v);
    if need > w.out.len() {
        return need;
    }
    w.put(VERDICT_MAGIC);
    w.put(&[VERSION]);
    match v {
        Ok(Preview::Text(t)) => {
            w.put(&[1, t.truncated as u8]);
            w.put(&t.lines.to_le_bytes());
            w.put(&(t.text.len() as u32).to_le_bytes());
            w.put(t.text.as_bytes());
        }
        Ok(Preview::Image {
            format,
            width,
            height,
        }) => {
            w.put(&[2, format.wire()]);
            w.put(&width.to_le_bytes());
            w.put(&height.to_le_bytes());
        }
        Ok(Preview::Unavailable(u)) => {
            let (reason, detail) = u.wire();
            w.put(&[3, reason, detail]);
        }
        Err(r) => w.put(&[4, r.wire()]),
    }
    w.n
}

fn verdict_len(v: &Result<Preview, WireRefusal>) -> usize {
    5 + match v {
        Ok(Preview::Text(t)) => 1 + 1 + 4 + 4 + t.text.len(),
        Ok(Preview::Image { .. }) => 1 + 1 + 4 + 4,
        Ok(Preview::Unavailable(_)) => 1 + 2,
        Err(_) => 1 + 1,
    }
}

struct Writer<'a> {
    out: &'a mut [u8],
    n: usize,
}

impl Writer<'_> {
    fn put(&mut self, b: &[u8]) {
        self.out[self.n..self.n + b.len()].copy_from_slice(b);
        self.n += b.len();
    }
}

/// The whole module call: decode, judge under [`BUDGET`], encode.
pub fn handle(req: &[u8], out: &mut [u8]) -> usize {
    let v = decode_request(req).map(|(id, body)| crate::preview::preview(&id, body, &BUDGET));
    let n = encode_verdict(&v, out);
    // The excerpt is plaintext of the object; its heap buffer is overwritten
    // before it is freed, so a reused allocation never hands it back.
    if let Ok(Preview::Text(t)) = v {
        let mut bytes = t.text.into_bytes();
        bytes.fill(0);
        core::hint::black_box(&bytes);
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preview::{fixtures, ImageFormat, Unavailable};
    use alloc::vec;

    fn run(req: &[u8]) -> alloc::vec::Vec<u8> {
        let mut out = vec![0u8; MAX_VERDICT];
        let n = handle(req, &mut out);
        out.truncate(n);
        out
    }

    #[test]
    fn an_image_verdict_has_the_documented_layout() {
        let body = fixtures::png(640, 480);
        let id = ObjectId::of(HashAlg::Sha256, &body);
        let v = run(&encode_request(&id, &body));
        let mut want = b"BXPV\x01\x02".to_vec();
        want.push(ImageFormat::Png.wire());
        want.extend_from_slice(&640u32.to_le_bytes());
        want.extend_from_slice(&480u32.to_le_bytes());
        assert_eq!(v, want);
    }

    #[test]
    fn a_text_verdict_carries_its_excerpt_and_counts() {
        let body = b"hello\nworld";
        let id = ObjectId::of(HashAlg::Sha256, body);
        let v = run(&encode_request(&id, body));
        assert_eq!(&v[..7], b"BXPV\x01\x01\x00");
        assert_eq!(u32::from_le_bytes(v[7..11].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(v[11..15].try_into().unwrap()), 11);
        assert_eq!(&v[15..], body);
    }

    #[test]
    fn a_bad_request_is_refused_as_a_request_not_as_a_preview() {
        let body = b"x";
        let id = ObjectId::of(HashAlg::Sha256, body);
        let good = encode_request(&id, body);
        let cases = [
            (good[..10].to_vec(), WireRefusal::Truncated),
            ([b"XXXX", &good[4..]].concat(), WireRefusal::BadMagic),
            (
                [&good[..4], &[2], &good[5..]].concat(),
                WireRefusal::BadVersion,
            ),
            (
                [&good[..5], &[9], &good[6..]].concat(),
                WireRefusal::UnknownAlg,
            ),
            ([&good[..], b"extra"].concat(), WireRefusal::LengthMismatch),
        ];
        for (req, r) in cases {
            assert_eq!(
                run(&req),
                [b"BXPV\x01\x04".as_slice(), &[r.wire()]].concat()
            );
        }
    }

    #[test]
    fn a_verdict_that_does_not_fit_writes_nothing_and_says_how_much() {
        let body = b"some text";
        let id = ObjectId::of(HashAlg::Sha256, body);
        let req = encode_request(&id, body);
        let mut small = [0xAAu8; 8];
        let need = handle(&req, &mut small);
        assert!(need > small.len());
        assert_eq!(small, [0xAA; 8]);
    }

    #[test]
    fn the_largest_possible_text_verdict_fits_the_documented_maximum() {
        let body = "ā".repeat(100_000);
        let id = ObjectId::of(HashAlg::Sha256, body.as_bytes());
        let v = run(&encode_request(&id, body.as_bytes()));
        assert!(v.len() <= MAX_VERDICT);
        assert_eq!(v[6], 1, "truncated flag set");
    }

    #[test]
    fn identity_change_crosses_the_wire_as_a_reason() {
        let id = ObjectId::of(HashAlg::Sha256, b"listed");
        let v = run(&encode_request(&id, b"served"));
        let (reason, detail) = Unavailable::IdentityChanged.wire();
        assert_eq!(v, [b"BXPV\x01\x03".as_slice(), &[reason, detail]].concat());
    }
}
