//! BNRoSe L2 supervisor — the trusted host around the untrusted workers
//! (BNROSE-RUST-001; dispatch `2026-10-12-bnrose-rust-001.md`).
//!
//! Layout: [`worker`] (the `Worker` trait; the native worker through the
//! same ABI the module exports; the Wasmtime worker behind fuel, epoch and
//! memory caps; the paranoid dual-run that requires byte equality),
//! [`journal`] (the HMAC-chained append-only record of identity, scope,
//! reservations and progress — fsynced before any external effect),
//! [`ledger`] (the idempotent, digest-bound effect ledger — the named
//! dedup enforcement component for the external effect), [`receipt`]
//! (Ed25519 statements independently checkable with the public key),
//! [`keys`] (supervisor key material, derived from a root, never printed),
//! [`fixtures`] (deterministic signed WB001 intents for the battery),
//! [`opexec`] (the supervisor engine: run one operation; recover from
//! durable records), [`cli`] (the executable slice).
//!
//! Two honesty anchors. The journal and the ledger are the ONLY durable
//! state; a recovery reads nothing else — not a worker's scratch, not the
//! founder's browser, not another agent's memory. And no claim of
//! exactly-once external effects is made from the local journal alone:
//! within this slice the ledger's idempotent apply is what prevents a
//! duplicate effect, and anything beyond this single-supervisor slice
//! would have to be a property of the external system itself.

pub mod cli;
pub mod fixtures;
pub mod journal;
pub mod keys;
pub mod ledger;
pub mod opexec;
pub mod receipt;
pub mod worker;

use bnrose_exec_core::{OpState, Policy, Refusal};

/// Build an admission request (the core's wire form).
pub fn admit_request(
    clock: u64,
    authority: &[u8; 32],
    policy: &Policy,
    env: &[u8],
) -> Vec<u8> {
    let mut r = Vec::with_capacity(env.len() + 600);
    r.push(1);
    r.push(bnrose_exec_core::K_ADMIT);
    r.extend_from_slice(&clock.to_le_bytes());
    r.extend_from_slice(authority);
    r.extend_from_slice(&policy.wire());
    r.extend_from_slice(&(env.len() as u16).to_le_bytes());
    r.extend_from_slice(env);
    r
}

/// Build a step request (the core's wire form).
#[allow(clippy::too_many_arguments)]
pub fn step_request(
    op: &[u8; 32],
    env_sha: &[u8; 32],
    state: &OpState,
    event: u8,
    payload: &[u8],
    clock: u64,
    expiry: u64,
) -> Vec<u8> {
    let mut r = Vec::with_capacity(payload.len() + 160);
    r.push(1);
    r.push(bnrose_exec_core::K_STEP);
    r.extend_from_slice(op);
    r.extend_from_slice(env_sha);
    r.extend_from_slice(&state.wire());
    r.push(event);
    r.extend_from_slice(&clock.to_le_bytes());
    r.extend_from_slice(&expiry.to_le_bytes());
    r.extend_from_slice(&(payload.len() as u16).to_le_bytes());
    r.extend_from_slice(payload);
    r
}

/// What the core said about an admission.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AdmitVerdict {
    Admitted {
        op: [u8; 32],
        env_sha: [u8; 32],
        effect: [u8; 32],
    },
    Refused(Refusal),
}

pub fn parse_admit_verdict(v: &[u8]) -> Result<AdmitVerdict, String> {
    match v.first() {
        Some(1) if v.len() == 97 => Ok(AdmitVerdict::Admitted {
            op: v[1..33].try_into().unwrap(),
            env_sha: v[33..65].try_into().unwrap(),
            effect: v[65..97].try_into().unwrap(),
        }),
        Some(2) if v.len() == 5 => Ok(AdmitVerdict::Refused(code_to_refusal(
            u32::from_le_bytes([v[1], v[2], v[3], v[4]]),
        )?)),
        _ => Err(format!("malformed admit verdict: {} bytes", v.len())),
    }
}

/// What the core said about a step.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StepVerdict {
    Next(OpState),
    Refused(Refusal),
}

pub fn parse_step_verdict(v: &[u8]) -> Result<StepVerdict, String> {
    match v.first() {
        Some(1) if v.len() == 1 + bnrose_exec_core::STATE_BLOB => Ok(StepVerdict::Next(
            OpState::parse(&v[1..]).map_err(|e| e.word().to_string())?,
        )),
        Some(2) if v.len() == 5 => Ok(StepVerdict::Refused(code_to_refusal(
            u32::from_le_bytes([v[1], v[2], v[3], v[4]]),
        )?)),
        _ => Err(format!("malformed step verdict: {} bytes", v.len())),
    }
}

fn code_to_refusal(code: u32) -> Result<Refusal, String> {
    use Refusal::*;
    Ok(match code {
        0 => DecodeShort,
        1 => DecodeMagic,
        2 => DecodeVersion,
        3 => DecodeTagOrder,
        4 => DecodeLength,
        5 => DecodeUtf8,
        6 => DecodeTrailing,
        7 => EnvOversize,
        8 => InvalidIntent,
        9 => PolicyDomain,
        10 => PolicyCapability,
        11 => PolicyAmount,
        12 => PolicyPayload,
        13 => PolicyExpired,
        14 => PolicyMinLead,
        15 => PolicyEpochFuture,
        16 => ReservationCaps,
        17 => IllegalTransition,
        18 => DispatchExpired,
        19 => DigestMismatch,
        20 => WireTruncated,
        21 => WireOversize,
        22 => WireUnknownKind,
        n => return Err(format!("unknown refusal code {n}")),
    })
}

/// Lowercase hex (receipts and diagnostics).
pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

pub fn unhex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("odd hex length".into());
    }
    let mut v = Vec::with_capacity(s.len() / 2);
    let b = s.as_bytes();
    for i in (0..b.len()).step_by(2) {
        let hi = (b[i] as char).to_digit(16).ok_or("hex digit")?;
        let lo = (b[i + 1] as char).to_digit(16).ok_or("hex digit")?;
        v.push((hi * 16 + lo) as u8);
    }
    Ok(v)
}

/// Base64 (standard alphabet, padded) for intent files and receipts.
pub fn b64(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for c in bytes.chunks(3) {
        let b = [c[0], *c.get(1).unwrap_or(&0), *c.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        s.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    s
}

pub fn unb64(s: &str) -> Result<Vec<u8>, String> {
    fn val(c: u8) -> Result<u32, String> {
        Ok(match c {
            b'A'..=b'Z' => (c - b'A') as u32,
            b'a'..=b'z' => (c - b'a' + 26) as u32,
            b'0'..=b'9' => (c - b'0' + 52) as u32,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("base64 digit".into()),
        })
    }
    let b = s.as_bytes();
    if b.len() % 4 != 0 {
        return Err("base64 length".into());
    }
    let mut v = Vec::with_capacity(b.len() / 4 * 3);
    for c in b.chunks(4) {
        let pad = c.iter().filter(|&&x| x == b'=').count();
        if c[..4 - pad.min(2)].iter().any(|&x| x == b'=') {
            return Err("base64 padding".into());
        }
        let n = (val(c[0])? << 18)
            | (val(c[1])? << 12)
            | if pad < 2 { val(c[2])? << 6 } else { 0 }
            | if pad < 1 { val(c[3])? } else { 0 };
        v.push((n >> 16) as u8);
        if pad < 2 {
            v.push((n >> 8) as u8);
        }
        if pad < 1 {
            v.push(n as u8);
        }
    }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b64_round_trips_against_known_vectors() {
        // RFC 4648's own vectors
        for (raw, enc) in [
            (&b""[..], ""),
            (&b"f"[..], "Zg=="),
            (&b"fo"[..], "Zm8="),
            (&b"foo"[..], "Zm9v"),
            (&b"foob"[..], "Zm9vYg=="),
            (&b"fooba"[..], "Zm9vYmE="),
            (&b"foobar"[..], "Zm9vYmFy"),
        ] {
            assert_eq!(b64(raw), enc);
            assert_eq!(unb64(enc).unwrap(), raw);
        }
    }

    #[test]
    fn hex_round_trips() {
        assert_eq!(hex(&[0xde, 0xad, 0xbe, 0xef]), "deadbeef");
        assert_eq!(unhex("deadbeef").unwrap(), vec![0xde, 0xad, 0xbe, 0xef]);
        assert!(unhex("abc").is_err());
    }
}
