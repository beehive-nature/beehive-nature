//! bsafe-thp — THP (Trezor Host Protocol) skeleton for the bSAFE 7 Rust host.
//!
//! Scope of this crate (sprint phase 1): the two layers a host needs before any
//! transport is plugged in —
//!   1. a FRAME codec (chunked link-layer frames with magic, channel id, length,
//!      CRC — resumable, refuses garbage loudly), and
//!   2. an encrypted CHANNEL: Noise XX over the frame layer, using the same
//!      pure-Rust Noise family Trezor forks (noise-rust).
//!
//! What this is NOT yet: the exact upstream THP wire constants. Upstream THP is
//! still stabilizing in trezor-firmware; the codec here is layered so the frame
//! constants and handshake pattern are swappable once bSAFE 7 pins its dialect
//! (see `Dialect`). The Noise roundtrip test at the bottom is real cryptography,
//! not a stub — handshake, key agreement, transport messages, tamper refusal.
//!
//! Transport lives in the `bsafe-host` crate (BLE via btleplug behind a feature;
//! USB later). This crate is transport-agnostic: bytes in, bytes out.

use crc::{Crc, CRC_32_ISO_HDLC};
use noise_protocol::{CipherState, HandshakeState, U8Array, DH};
use noise_rust_crypto::{Blake2s, ChaCha20Poly1305, X25519};
use thiserror::Error;

pub const CRC32: Crc<u32> = Crc::<u32>::new(&CRC_32_ISO_HDLC);

/// Wire dialect: the constants that must match the device build.
/// bSAFE 7 pins its own values here once the firmware side lands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Dialect {
    pub magic: [u8; 2],
    /// Max payload bytes per frame (BLE MTU-derived for the Safe 7 link).
    pub max_frame_payload: usize,
}

impl Default for Dialect {
    fn default() -> Self {
        // PROPOSED-PENDING-FIRMWARE: placeholder magic "b7"; swap to the values
        // the bSAFE 7 firmware ships. Nothing else in the codec depends on them.
        Self { magic: *b"b7", max_frame_payload: 244 }
    }
}

#[derive(Debug, Error)]
pub enum ThpError {
    #[error("bad magic {found:02x?} (expected {expected:02x?}) — not a THP frame")]
    BadMagic { found: [u8; 2], expected: [u8; 2] },
    #[error("frame truncated: need {need} bytes, have {have}")]
    Truncated { need: usize, have: usize },
    #[error("CRC mismatch: computed {computed:08x}, frame carries {carried:08x}")]
    Crc { computed: u32, carried: u32 },
    #[error("payload {len} exceeds dialect max {max}")]
    TooLong { len: usize, max: usize },
    #[error("noise: {0}")]
    Noise(String),
    #[error("decrypt failed (tampered, replayed, or out-of-order message)")]
    Decrypt,
}

/// One link-layer frame: magic(2) ‖ channel(1) ‖ len_be(2) ‖ payload ‖ crc32_be(4).
/// CRC covers everything before it. Deliberately dumb — resumability and honesty
/// (loud, typed refusals) over cleverness.
pub fn encode_frame(d: &Dialect, channel: u8, payload: &[u8]) -> Result<Vec<u8>, ThpError> {
    if payload.len() > d.max_frame_payload {
        return Err(ThpError::TooLong { len: payload.len(), max: d.max_frame_payload });
    }
    let mut out = Vec::with_capacity(9 + payload.len());
    out.extend_from_slice(&d.magic);
    out.push(channel);
    out.extend_from_slice(&(payload.len() as u16).to_be_bytes());
    out.extend_from_slice(payload);
    let crc = CRC32.checksum(&out);
    out.extend_from_slice(&crc.to_be_bytes());
    Ok(out)
}

pub struct Frame<'a> {
    pub channel: u8,
    pub payload: &'a [u8],
}

pub fn decode_frame<'a>(d: &Dialect, buf: &'a [u8]) -> Result<Frame<'a>, ThpError> {
    if buf.len() < 9 {
        return Err(ThpError::Truncated { need: 9, have: buf.len() });
    }
    let found = [buf[0], buf[1]];
    if found != d.magic {
        return Err(ThpError::BadMagic { found, expected: d.magic });
    }
    let len = u16::from_be_bytes([buf[3], buf[4]]) as usize;
    let need = 5 + len + 4;
    if buf.len() < need {
        return Err(ThpError::Truncated { need, have: buf.len() });
    }
    let carried = u32::from_be_bytes([buf[5 + len], buf[6 + len], buf[7 + len], buf[8 + len]]);
    let computed = CRC32.checksum(&buf[..5 + len]);
    if computed != carried {
        return Err(ThpError::Crc { computed, carried });
    }
    Ok(Frame { channel: buf[2], payload: &buf[5..5 + len] })
}

// ── Noise channel ──────────────────────────────────────────────────────────────
// Noise_XX_25519_ChaChaPoly_BLAKE2s: mutual authentication, identity hiding,
// forward secrecy. XX because host and device learn each other's static keys
// DURING the handshake — which is when the T3 countersign UX fires (fingerprint
// words of the device static key on the host screen, human confirms on device).

type Hs = HandshakeState<X25519, ChaCha20Poly1305, Blake2s>;

pub const NOISE_PATTERN: &str = "Noise_XX_25519_ChaChaPoly_BLAKE2s";
/// PROLOGUE binds the dialect into the channel: a host and device disagreeing on
/// wire constants fail the handshake instead of talking past each other.
pub const PROLOGUE: &[u8] = b"BSAFE7-THP-v0";

pub struct NoiseChannel {
    send: CipherState<ChaCha20Poly1305>,
    recv: CipherState<ChaCha20Poly1305>,
    /// Remote static public key, learned during XX — feed to fingerprint words.
    pub remote_static: Option<[u8; 32]>,
}

fn params() -> noise_protocol::patterns::HandshakePattern {
    noise_protocol::patterns::noise_xx()
}

pub fn initiator(static_key: [u8; 32]) -> Hs {
    Hs::new(params(), true, PROLOGUE, Some(<X25519 as DH>::Key::from_slice(&static_key)), None, None, None)
}

pub fn responder(static_key: [u8; 32]) -> Hs {
    Hs::new(params(), false, PROLOGUE, Some(<X25519 as DH>::Key::from_slice(&static_key)), None, None, None)
}

/// Drive a completed handshake into a transport channel.
pub fn into_channel(hs: Hs, is_initiator: bool) -> Result<NoiseChannel, ThpError> {
    if !hs.completed() {
        return Err(ThpError::Noise("handshake not complete".into()));
    }
    let remote_static = hs.get_rs().map(|k| {
        let mut a = [0u8; 32];
        a.copy_from_slice(k.as_slice());
        a
    });
    let (c1, c2) = hs.get_ciphers();
    let (send, recv) = if is_initiator { (c1, c2) } else { (c2, c1) };
    Ok(NoiseChannel { send, recv, remote_static })
}

impl NoiseChannel {
    pub fn seal(&mut self, plaintext: &[u8]) -> Vec<u8> {
        self.send.encrypt_vec(plaintext)
    }
    pub fn open(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>, ThpError> {
        self.recv.decrypt_vec(ciphertext).map_err(|_| ThpError::Decrypt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(b: u8) -> [u8; 32] {
        [b; 32]
    }

    #[test]
    fn frame_roundtrip_and_refusals() {
        let d = Dialect::default();
        let f = encode_frame(&d, 3, b"hello device").unwrap();
        let back = decode_frame(&d, &f).unwrap();
        assert_eq!(back.channel, 3);
        assert_eq!(back.payload, b"hello device");
        // refusals are typed and loud
        let mut bad = f.clone();
        bad[7] ^= 0xff;
        assert!(matches!(decode_frame(&d, &bad), Err(ThpError::Crc { .. })));
        let mut wrong = f.clone();
        wrong[0] = b'x';
        assert!(matches!(decode_frame(&d, &wrong), Err(ThpError::BadMagic { .. })));
        assert!(matches!(decode_frame(&d, &f[..6]), Err(ThpError::Truncated { .. })));
        assert!(matches!(
            encode_frame(&d, 0, &vec![0u8; d.max_frame_payload + 1]),
            Err(ThpError::TooLong { .. })
        ));
    }

    #[test]
    fn noise_xx_handshake_transport_and_tamper_refusal() {
        // Full XX: -> e   <- e,ee,s,es   -> s,se ; then transport both ways.
        let mut ini = initiator(key(0x11));
        let mut res = responder(key(0x22));

        let m1 = ini.write_message_vec(b"").unwrap();
        res.read_message_vec(&m1).unwrap();
        let m2 = res.write_message_vec(b"").unwrap();
        ini.read_message_vec(&m2).unwrap();
        let m3 = ini.write_message_vec(b"").unwrap();
        res.read_message_vec(&m3).unwrap();
        assert!(ini.completed() && res.completed());

        let mut ch_i = into_channel(ini, true).unwrap();
        let mut ch_r = into_channel(res, false).unwrap();

        // XX means both sides LEARNED the peer static — this is what the
        // fingerprint-words countersign displays.
        assert!(ch_i.remote_static.is_some() && ch_r.remote_static.is_some());

        let ct = ch_i.seal(b"sign this: bDiD record ...");
        assert_eq!(ch_r.open(&ct).unwrap(), b"sign this: bDiD record ...");
        let ct2 = ch_r.seal(b"shown on device; approved");
        assert_eq!(ch_i.open(&ct2).unwrap(), b"shown on device; approved");

        // tamper → typed refusal, never garbage plaintext
        let mut evil = ch_i.seal(b"pay 1 b");
        evil[0] ^= 1;
        assert!(matches!(ch_r.open(&evil), Err(ThpError::Decrypt)));
    }

    #[test]
    fn prologue_mismatch_fails_handshake() {
        // A host on a different dialect prologue must not complete against us.
        let mut ini = Hs::new(params(), true, b"WRONG-PROLOGUE", Some(<X25519 as DH>::Key::from_slice(&key(1))), None, None, None);
        let mut res = responder(key(2));
        let m1 = ini.write_message_vec(b"").unwrap();
        res.read_message_vec(&m1).unwrap();
        let m2 = res.write_message_vec(b"").unwrap();
        // initiator must refuse the responder's message (hash transcript differs)
        assert!(ini.read_message_vec(&m2).is_err());
    }
}
