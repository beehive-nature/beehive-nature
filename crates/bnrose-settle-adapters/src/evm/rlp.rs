//! Minimal RLP encoding (Ethereum's, exactly): a byte string under 128
//! encodes as itself; longer strings get a length prefix 0x80+len; a
//! big-endian INTEGER encodes as its minimal byte string without leading
//! zeros (zero is the EMPTY string); a list wraps its concatenated items
//! with 0xc0+len (or a longer length prefix). Decoding is out of scope —
//! we only build envelopes whose hashes the node independently confirms.

pub fn enc_bytes(b: &[u8]) -> Vec<u8> {
    if b.len() == 1 && b[0] < 0x80 {
        return vec![b[0]];
    }
    let mut out = length_prefix(0x80, b.len());
    out.extend_from_slice(b);
    out
}

/// an integer from its big-endian bytes: minimal, leading zeros stripped
/// (zero itself encodes as the EMPTY string — 0x80 — while the byte
/// STRING [0x00] encodes as 0x00; different laws, both pinned in tests)
pub fn enc_int_be(b: &[u8]) -> Vec<u8> {
    let stripped = leading_zeros(b);
    if stripped.len() == 1 && stripped[0] == 0 {
        return enc_bytes(&[]);
    }
    enc_bytes(stripped)
}

pub fn enc_list(items: &[Vec<u8>]) -> Vec<u8> {
    let mut payload = Vec::new();
    for i in items {
        payload.extend_from_slice(i);
    }
    let mut out = length_prefix(0xc0, payload.len());
    out.extend_from_slice(&payload);
    out
}

fn leading_zeros(b: &[u8]) -> &[u8] {
    let mut i = 0;
    while i + 1 < b.len() && b[i] == 0 {
        i += 1;
    }
    &b[i..]
}

fn length_prefix(offset: u8, len: usize) -> Vec<u8> {
    if len < 56 {
        return vec![offset + len as u8];
    }
    let len_bytes = len.to_be_bytes();
    let stripped = leading_zeros(&len_bytes);
    let mut out = vec![offset + 55 + stripped.len() as u8];
    out.extend_from_slice(stripped);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hex;

    #[test]
    fn classic_vectors() {
        // the RLP test-suite basics: "dog" is a 3-byte string → 0x83 prefix
        assert_eq!(hex(&enc_bytes(b"")), "80");
        assert_eq!(hex(&enc_bytes(b"dog")), "83646f67");
        assert_eq!(hex(&enc_bytes(&[0x00])), "00");
        assert_eq!(hex(&enc_bytes(&[0x0f])), "0f");
        assert_eq!(hex(&enc_bytes(&[0x04, 0x00])), "820400");
        // the spec example: each string carries its own 0x83, the list
        // wraps the 8-byte payload with c8
        assert_eq!(
            hex(&enc_list(&[enc_bytes(b"cat"), enc_bytes(b"dog")])),
            "c88363617483646f67"
        );
        assert_eq!(hex(&enc_list(&[])), "c0");
        // integers: 0 → empty; 1024 → 0x820400; 15 → 0x0f
        assert_eq!(hex(&enc_int_be(&0u64.to_be_bytes())), "80");
        assert_eq!(hex(&enc_int_be(&1024u64.to_be_bytes())), "820400");
        assert_eq!(hex(&enc_int_be(&15u64.to_be_bytes())), "0f");
        // 32-byte leading-zero-stripped ints (r/s shapes)
        let mut r = [0u8; 32];
        r[31] = 0x01;
        assert_eq!(hex(&enc_int_be(&r)), "01");
    }

    #[test]
    fn long_list_length_prefix() {
        // a 60-byte payload crosses the 56-byte boundary → 0xf8 prefix
        let items: Vec<Vec<u8>> = vec![enc_bytes(&[0xaa; 60])];
        let out = enc_list(&items);
        assert_eq!(out[0], 0xf8);
        assert_eq!(out[1], 62);
        assert_eq!(out.len(), 64);
    }
}
