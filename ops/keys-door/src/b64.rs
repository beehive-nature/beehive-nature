//! base64, decoded strictly: a text is accepted only if re-encoding what it
//! decodes to gives the same text back (no stray trailing bits, no length
//! that cannot occur, no whitespace). Digests travel as base64url without
//! padding, never hex (contract §1: the repo's secret scan blocks hex runs of
//! 48+ chars); the antd JSON envelope carries standard padded base64.

const URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const STD: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode(alpha: &[u8; 64], bytes: &[u8], pad: bool) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(alpha[(n >> 18) as usize & 63] as char);
        out.push(alpha[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(alpha[(n >> 6) as usize & 63] as char);
        } else if pad {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(alpha[n as usize & 63] as char);
        } else if pad {
            out.push('=');
        }
    }
    out
}

fn decode(alpha: &[u8; 64], s: &str, pad: bool) -> Option<Vec<u8>> {
    let body = if pad { s.trim_end_matches('=') } else { s };
    let mut out = Vec::with_capacity(body.len() * 3 / 4 + 3);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in body.bytes() {
        let v = alpha.iter().position(|&a| a == c)? as u32;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    (encode(alpha, &out, pad) == s).then_some(out)
}

pub fn b64u(bytes: &[u8]) -> String {
    encode(URL, bytes, false)
}

pub fn unb64u(s: &str) -> Option<Vec<u8>> {
    decode(URL, s, false)
}

/// A 32-byte digest in base64url (43 chars), strictly.
pub fn unb64u32(s: &str) -> Option<[u8; 32]> {
    unb64u(s)?.try_into().ok()
}

pub fn b64_std(bytes: &[u8]) -> String {
    encode(STD, bytes, true)
}

pub fn unb64_std(s: &str) -> Option<Vec<u8>> {
    decode(STD, s, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_refuses_non_canonical_text() {
        assert_eq!(b64u(b"foobar"), "Zm9vYmFy");
        assert_eq!(b64u(b"fo"), "Zm8");
        assert_eq!(unb64u("Zm8").as_deref(), Some(&b"fo"[..]));
        // "Zm9" decodes "fo" only with stray low bits set: refused
        assert_eq!(unb64u("Zm9"), None);
        assert_eq!(unb64u("Z"), None);
        assert_eq!(unb64u("Zm8="), None);
        assert_eq!(b64_std(b"fo"), "Zm8=");
        assert_eq!(unb64_std("Zm8=").as_deref(), Some(&b"fo"[..]));
        assert_eq!(unb64_std("Zm8"), None);
        assert_eq!(unb64_std("Zm8=\n"), None);
        assert_eq!(unb64_std("Zm 8="), None);
        assert_eq!(unb64u32(&b64u(&[7u8; 32])), Some([7u8; 32]));
        assert_eq!(unb64u32(&b64u(&[7u8; 31])), None);
    }
}
