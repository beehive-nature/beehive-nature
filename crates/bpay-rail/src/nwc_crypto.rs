//! NIP-44 v2 cryptography — pure module, DEFAULT build (network-free).
//!
//! Implemented EXACTLY per the fetched spec (nips/44.md, R13):
//! conversation_key = HKDF-Extract(SHA-256, IKM = ECDH-shared
//! x-coordinate, salt = "nip44-v2"); per-message keys = HKDF-Expand(
//! OKM = conversation_key, info = 32-byte CSPRNG nonce, L = 76) sliced
//! chacha_key(0..32) / chacha_nonce(32..44) / hmac_key(44..76);
//! ciphertext = ChaCha20(counter 0) over the spec-padded plaintext;
//! mac = HMAC-SHA256(hmac_key, nonce‖ciphertext); payload =
//! base64(0x02 ‖ nonce ‖ ciphertext ‖ mac). MAC verified BEFORE
//! decryption (decrypt-then-forget on MAC failure). Nonce from the OS
//! CSPRNG (getrandom) — the R13 DRBG deviation is dead. All key
//! material passed through [`zeroize::Zeroizing`].

use chacha20::cipher::{KeyIvInit, StreamCipher};
use chacha20::ChaCha20;
use hmac::{Hmac, Mac};
use k256::elliptic_curve::sec1::{EncodedPoint, FromEncodedPoint};
use sha2::Sha256;
use zeroize::{Zeroize, Zeroizing};

use crate::nwc::NwcError;

type HmacSha256 = Hmac<Sha256>;

fn hkdf_extract(ikm: &[u8], salt: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(salt).expect("hmac accepts any key");
    mac.update(ikm);
    let mut k = Zeroizing::new([0u8; 32]);
    k.copy_from_slice(&mac.finalize().into_bytes());
    k
}

fn hkdf_expand(okm: &[u8], info: &[u8], len: usize) -> Zeroizing<Vec<u8>> {
    let mut out = Vec::with_capacity(len);
    let mut t: Vec<u8> = Vec::new();
    let mut counter: u8 = 1;
    while out.len() < len {
        let mut mac = <HmacSha256 as Mac>::new_from_slice(okm).expect("hmac accepts any key");
        mac.update(&t);
        mac.update(info);
        mac.update(&[counter]);
        t = mac.finalize().into_bytes().to_vec();
        out.extend_from_slice(&t);
        counter += 1;
    }
    out.truncate(len);
    let z = Zeroizing::new(out);
    t.zeroize();
    z
}

/// ECDH shared x-coordinate (pure Rust k256; even-Y convention for
/// 32-byte x-only peer keys — reference behavior).
pub fn ecdh_shared_x(
    secret: &[u8; 32],
    peer_xonly_hex: &str,
) -> Result<Zeroizing<[u8; 32]>, NwcError> {
    let peer =
        hex::decode(peer_xonly_hex).map_err(|e| NwcError::Other(format!("peer pubkey: {e}")))?;
    if peer.len() != 32 {
        return Err(NwcError::Other("peer pubkey must be 32-byte x-only".into()));
    }
    let mut compressed = vec![0x02u8];
    compressed.extend_from_slice(&peer);
    let cp = <EncodedPoint<k256::Secp256k1>>::from_bytes(compressed)
        .map_err(|e| NwcError::Other(format!("peer pubkey reconstruct: {e}")))?;
    let affine = k256::AffinePoint::from_encoded_point(&cp)
        .into_option()
        .ok_or_else(|| NwcError::Other("peer point decompress failed".into()))?;
    let shared = k256::ecdh::diffie_hellman(
        k256::SecretKey::from_slice(secret)
            .map_err(|e| NwcError::Other(format!("secret key: {e}")))?
            .to_nonzero_scalar(),
        affine,
    );
    let mut x = Zeroizing::new([0u8; 32]);
    x.copy_from_slice(&shared.raw_secret_bytes()[..32]);
    Ok(x)
}

/// PUBLIC for LT-9.2 vector pinning (the official nip44.vectors.json
/// carries conversation_key test cases).
pub fn conversation_key(
    secret: &[u8; 32],
    peer_hex: &str,
) -> Result<Zeroizing<[u8; 32]>, NwcError> {
    let shared_x = ecdh_shared_x(secret, peer_hex)?;
    Ok(hkdf_extract(shared_x.as_slice(), b"nip44-v2"))
}

/// NIP-44 v2 min/max plaintext sizes (the reference: 1 to 65535 bytes).
pub const MIN_PLAINTEXT_SIZE: usize = 1;
pub const MAX_PLAINTEXT_SIZE: usize = 65535;

/// The reference calcPaddedLen (chunk-rounding, from paulmillr/nip44):
/// `chunk * ceil(len / chunk)` where chunk = 32 for small inputs, then
/// nextPower/8 for larger. NOT power-of-2 rounding.
/// PUBLIC for vector pinning.
pub fn calc_padded_len(len: usize) -> usize {
    if len <= 32 {
        return 32;
    }
    // nextPower = 1 << (floor(log2(len - 1)) + 1) = the next power of 2
    // at-or-above len
    let next_power = (len - 1).next_power_of_two();
    let chunk = if next_power <= 256 {
        32
    } else {
        next_power / 8
    };
    // chunk * ceil(len / chunk) = chunk * (floor((len-1)/chunk) + 1)
    chunk * ((len - 1) / chunk + 1)
}

/// NIP-44 v2 pad: prefix(2) + plaintext + suffix(calcPaddedLen(len) - len).
/// The prefix rides OUTSIDE the padded body. Refuses oversize input
/// (> 65535) with a typed error — never silently truncates.
fn pad(plaintext: &[u8]) -> Result<Vec<u8>, NwcError> {
    let len = plaintext.len();
    if len < MIN_PLAINTEXT_SIZE {
        return Err(NwcError::Other(format!(
            "plaintext too short: {len} bytes (minimum {MIN_PLAINTEXT_SIZE})"
        )));
    }
    if len > MAX_PLAINTEXT_SIZE {
        return Err(NwcError::Other(format!(
            "plaintext too long: {len} bytes (maximum {MAX_PLAINTEXT_SIZE}) — \
             refusing, never truncating"
        )));
    }
    let body_len = calc_padded_len(len);
    let mut out = Vec::with_capacity(2 + body_len);
    out.extend_from_slice(&(len as u16).to_be_bytes());
    out.extend_from_slice(plaintext);
    out.resize(2 + body_len, 0);
    Ok(out)
}

fn unpad(padded: &[u8]) -> Result<Vec<u8>, NwcError> {
    if padded.len() < 2 {
        return Err(NwcError::Other("padded payload too short".into()));
    }
    let len = u16::from_be_bytes([padded[0], padded[1]]) as usize;
    // Full validation: size bounds + length prefix + exact padded length
    if !(MIN_PLAINTEXT_SIZE..=MAX_PLAINTEXT_SIZE).contains(&len) {
        return Err(NwcError::Other(format!(
            "invalid plaintext size: {len} (must be {MIN_PLAINTEXT_SIZE}..={MAX_PLAINTEXT_SIZE})"
        )));
    }
    if 2 + len > padded.len() {
        return Err(NwcError::Other("length prefix exceeds payload".into()));
    }
    let expected_total = 2 + calc_padded_len(len);
    if padded.len() != expected_total {
        return Err(NwcError::Other(format!(
            "invalid padding: total {} bytes, expected {} (2 + calcPaddedLen({}))",
            padded.len(),
            expected_total,
            len
        )));
    }
    Ok(padded[2..2 + len].to_vec())
}

pub fn b64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>, NwcError> {
    fn val(c: u8) -> Result<u32, NwcError> {
        match c {
            b'A'..=b'Z' => Ok((c - b'A') as u32),
            b'a'..=b'z' => Ok((c - b'a' + 26) as u32),
            b'0'..=b'9' => Ok((c - b'0' + 52) as u32),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err(NwcError::Other(format!("bad base64 byte {c}"))),
        }
    }
    let clean: Vec<u8> = s.bytes().filter(|b| *b != b'=').collect();
    let mut out = Vec::new();
    for chunk in clean.chunks(4) {
        let mut n: u32 = 0;
        for (i, c) in chunk.iter().enumerate() {
            n |= val(*c)? << (18 - 6 * i);
        }
        out.push((n >> 16) as u8);
        if chunk.len() > 2 {
            out.push((n >> 8) as u8);
        }
        if chunk.len() > 3 {
            out.push(n as u8);
        }
    }
    Ok(out)
}

/// OS-CSPRNG nonce (getrandom) — the pinned spec's requirement.
fn csprng_nonce() -> Result<[u8; 32], NwcError> {
    let mut nonce = Zeroizing::new([0u8; 32]);
    getrandom::getrandom(nonce.as_mut())
        .map_err(|e| NwcError::Other(format!("os entropy: {e}")))?;
    let out = *nonce;
    Ok(out)
}

fn message_keys(ck: &[u8], nonce: &[u8]) -> Zeroizing<Vec<u8>> {
    hkdf_expand(ck, nonce, 76)
}

/// Deterministic-nonce encrypt — for LT-9.2 official-vector pinning
/// ONLY (the vectors carry fixed nonce+payload pairs). Production code
/// always uses the CSPRNG path.
#[doc(hidden)]
pub fn nip44_encrypt_with_nonce(
    secret: &[u8; 32],
    peer_hex: &str,
    plaintext: &str,
    nonce: &[u8; 32],
) -> Result<String, NwcError> {
    let ck = conversation_key(secret, peer_hex)?;
    let keys = message_keys(ck.as_slice(), nonce);
    let mut ct = pad(plaintext.as_bytes())?;
    let mut cipher = ChaCha20::new_from_slices(&keys[0..32], &keys[32..44]).expect("32+12 slices");
    cipher.apply_keystream(&mut ct);
    let mut mac = <HmacSha256 as Mac>::new_from_slice(&keys[44..76]).expect("any key");
    mac.update(nonce);
    mac.update(&ct);
    let tag = mac.finalize().into_bytes();
    let mut payload = vec![0x02u8];
    payload.extend_from_slice(nonce);
    payload.extend_from_slice(&ct);
    payload.extend_from_slice(&tag);
    Ok(b64_encode(&payload))
}

/// NIP-44 v2 encrypt (spec-exact; CSPRNG nonce; keys zeroized).
pub fn nip44_encrypt(
    secret: &[u8; 32],
    peer_hex: &str,
    plaintext: &str,
) -> Result<String, NwcError> {
    let ck = conversation_key(secret, peer_hex)?;
    let nonce = csprng_nonce()?;
    let keys = message_keys(ck.as_slice(), nonce.as_slice());
    let mut ct = pad(plaintext.as_bytes())?;
    let mut cipher = ChaCha20::new_from_slices(&keys[0..32], &keys[32..44]).expect("32+12 slices");
    cipher.apply_keystream(&mut ct);
    let mut mac = <HmacSha256 as Mac>::new_from_slice(&keys[44..76]).expect("any key");
    mac.update(&nonce);
    mac.update(&ct);
    let tag = mac.finalize().into_bytes();
    let mut payload = vec![0x02u8];
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ct);
    payload.extend_from_slice(&tag);
    Ok(b64_encode(&payload))
}

/// NIP-44 v2 decrypt — MAC verified FIRST; any failure is
/// indistinguishable from "not addressed to us" (the correlation
/// engine treats it as ignore, never as a crash).
pub fn nip44_decrypt(
    secret: &[u8; 32],
    peer_hex: &str,
    payload_b64: &str,
) -> Result<String, NwcError> {
    let data = b64_decode(payload_b64)?;
    if data.len() < 66 || data[0] != 0x02 {
        return Err(NwcError::Other("payload not a nip44-v2 frame".into()));
    }
    let nonce: [u8; 32] = data[1..33].try_into().expect("33 slice");
    let ct = &data[33..data.len() - 32];
    let tag = &data[data.len() - 32..];
    let ck = conversation_key(secret, peer_hex)?;
    let keys = message_keys(ck.as_slice(), nonce.as_slice());
    let mut mac = <HmacSha256 as Mac>::new_from_slice(&keys[44..76]).expect("any key");
    mac.update(&nonce);
    mac.update(ct);
    let expect = mac.finalize().into_bytes();
    let mut diff = 0u8;
    for (a, b) in tag.iter().zip(expect.iter()) {
        diff |= a ^ b;
    }
    if diff != 0 {
        return Err(NwcError::Other("mac mismatch — not addressed to us".into()));
    }
    let mut pt = ct.to_vec();
    let mut cipher = ChaCha20::new_from_slices(&keys[0..32], &keys[32..44]).expect("32+12 slices");
    cipher.apply_keystream(&mut pt);
    let unpadded = unpad(&pt)?;
    String::from_utf8(unpadded).map_err(|e| NwcError::Other(format!("utf8: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys() -> ([u8; 32], String) {
        // round-trip pair: fixed client secret, derived peer from it
        let sk = [7u8; 32];
        let signing = k256::schnorr::SigningKey::from_bytes(&sk).expect("any");
        let peer = hex::encode(signing.verifying_key().to_bytes());
        (sk, peer)
    }

    #[test]
    fn nip44_round_trip() {
        let (sk, peer) = keys();
        let msg = r#"{"method":"get_info","params":{}}"#;
        let enc = nip44_encrypt(&sk, &peer, msg).unwrap();
        let dec = nip44_decrypt(&sk, &peer, &enc).unwrap();
        assert_eq!(dec, msg);
    }

    #[test]
    fn nip44_mac_failure_is_ignorable() {
        let (sk, peer) = keys();
        let mut enc = nip44_encrypt(&sk, &peer, "x").unwrap();
        let mut raw = b64_decode(&enc).unwrap();
        let last = raw.len() - 1;
        raw[last] ^= 0x01; // tamper the MAC
        enc = b64_encode(&raw);
        let e = nip44_decrypt(&sk, &peer, &enc).unwrap_err();
        assert!(e.to_string().contains("not addressed to us"));
    }

    #[test]
    fn wrong_key_does_not_decrypt() {
        let (sk, peer) = keys();
        let enc = nip44_encrypt(&sk, &peer, "secret").unwrap();
        let other = [8u8; 32];
        assert!(nip44_decrypt(&other, &peer, &enc).is_err());
    }
}
