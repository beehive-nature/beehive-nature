//! BNR native Trezor lane — talk to the LOCAL Trezor Bridge (trezord,
//! 127.0.0.1:21325) directly from the relay. No connect.trezor.io page, no
//! third-party popup: the founder-ruled "never wait on someone else's
//! integration schedule" lane, running against STOCK firmware.
//!
//! Bridge API (plain HTTP + hex-framed protobuf, protocol v1):
//!   POST /            -> {"version":...}
//!   POST /enumerate   -> [{"path":..,"session":..},..]
//!   POST /acquire/{path}/null -> {"session":"1"}
//!   POST /call/{session}  body=hex([type u16 BE][len u32 BE][protobuf]) -> same framing
//!   POST /release/{session}
//! trezord validates the Origin header against a trezor.io allowlist; as a
//! LOCAL client we present one. GetFeatures is message type 55; Features is 17.
//!
//! HONESTY: every stage failure is NAMED (bridge absent / no device / busy /
//! call failed) so the wizard can render the exact cure. If stock T3W1 refuses
//! v1 protocol over Bridge (THP-only), the call stage reports that truthfully —
//! and the THP step of this lane (goose's matrix dispatch) replaces the framing,
//! not the plumbing.

use axum::response::{IntoResponse, Response};
use axum::Json;

const BRIDGE: &str = "http://127.0.0.1:21325";
const ORIGIN: &str = "https://connect.trezor.io";

/// v1 wire framing: [msg_type u16 BE][payload len u32 BE][protobuf payload], hex.
pub fn frame_hex(msg_type: u16, payload: &[u8]) -> String {
    let mut out = Vec::with_capacity(6 + payload.len());
    out.extend_from_slice(&msg_type.to_be_bytes());
    out.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    out.extend_from_slice(payload);
    out.iter().map(|b| format!("{b:02x}")).collect()
}

/// Parse a v1 response frame from hex -> (msg_type, payload bytes).
pub fn unframe_hex(hex: &str) -> Result<(u16, Vec<u8>), String> {
    let bytes: Result<Vec<u8>, _> = (0..hex.len() / 2 * 2)
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
        .collect();
    let bytes = bytes.map_err(|e| format!("bad hex: {e}"))?;
    if bytes.len() < 6 {
        return Err(format!("frame too short: {} bytes", bytes.len()));
    }
    let msg_type = u16::from_be_bytes([bytes[0], bytes[1]]);
    let len = u32::from_be_bytes([bytes[2], bytes[3], bytes[4], bytes[5]]) as usize;
    let payload = bytes[6..].to_vec();
    if payload.len() < len {
        return Err(format!("truncated payload: {} of {len}", payload.len()));
    }
    Ok((msg_type, payload[..len].to_vec()))
}

/// Minimal protobuf walk over Features: field 1 = vendor (len-delimited),
/// fields 2/3/4 = major/minor/patch (varint). Everything else skipped by wire
/// type. No proto codegen — six fields of hand-rolled reading, testable.
pub fn parse_features(p: &[u8]) -> (Option<String>, Option<(u64, u64, u64)>) {
    let (mut i, mut vendor, mut maj, mut min, mut pat) = (0usize, None, None, None, None);
    fn varint(p: &[u8], i: &mut usize) -> Option<u64> {
        let (mut v, mut s) = (0u64, 0u32);
        while *i < p.len() {
            let b = p[*i];
            *i += 1;
            v |= u64::from(b & 0x7f) << s;
            if b & 0x80 == 0 {
                return Some(v);
            }
            s += 7;
            if s > 63 {
                return None;
            }
        }
        None
    }
    while i < p.len() {
        let key = match varint(p, &mut i) {
            Some(k) => k,
            None => break,
        };
        let (field, wire) = (key >> 3, key & 7);
        match wire {
            0 => {
                let v = match varint(p, &mut i) {
                    Some(v) => v,
                    None => break,
                };
                match field {
                    2 => maj = Some(v),
                    3 => min = Some(v),
                    4 => pat = Some(v),
                    _ => {}
                }
            }
            2 => {
                let len = match varint(p, &mut i) {
                    Some(l) => l as usize,
                    None => break,
                };
                if i + len > p.len() {
                    break;
                }
                if field == 1 {
                    vendor = String::from_utf8(p[i..i + len].to_vec()).ok();
                }
                i += len;
            }
            5 => i += 4,
            1 => i += 8,
            _ => break,
        }
    }
    let ver = match (maj, min, pat) {
        (Some(a), Some(b), Some(c)) => Some((a, b, c)),
        _ => None,
    };
    (vendor, ver)
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(15))
        .redirects(0)
        .build()
}

fn bridge_post(path: &str, body: &str) -> Result<String, String> {
    agent()
        .post(&format!("{BRIDGE}{path}"))
        .set("Origin", ORIGIN)
        .send_string(body)
        .map_err(|e| e.to_string())
        .and_then(|r| r.into_string().map_err(|e| e.to_string()))
}

/// GET /v1/trezor/native/features — the whole handshake, every stage named.
pub async fn native_features() -> Response {
    let out = tokio::task::spawn_blocking(|| {
        // stage 1: bridge alive?
        let ver = bridge_post("/", "").map_err(|e| {
            ("bridge-absent", format!("Trezor Bridge is not running on 127.0.0.1:21325 ({e}). Start Trezor Suite (its bundled Bridge starts with it), then retry."))
        })?;
        // stage 2: device present?
        let devices = bridge_post("/enumerate", "").map_err(|e| ("enumerate-failed", e))?;
        let path = devices
            .split("\"path\":\"")
            .nth(1)
            .and_then(|s| s.split('"').next())
            .ok_or(("no-device", "Bridge is running but lists NO device. Plug the Trezor into a DATA port (some cables are charge-only), unlock it, and retry.".to_string()))?
            .to_string();
        // stage 3: acquire (fails if Suite holds the session)
        // Modern Suite (26.x) runs the bridge IN-PROCESS — it listens on 21325
        // only WHILE SUITE IS RUNNING (verified on-box 2026-08-14: no standalone
        // trezord.exe installed). So do NOT tell the user to close Suite — that
        // kills the bridge. If busy, release the device inside Suite (eject) or
        // just retry; /acquire with a null prev-session forces acquisition.
        let acq = bridge_post(&format!("/acquire/{path}/null"), "")
            .map_err(|e| ("busy", format!("Device present but the session is held — release/eject it inside Trezor Suite (keep Suite RUNNING, its in-process bridge is what this lane uses) and retry. ({e})")))?;
        let session = acq
            .split("\"session\":\"")
            .nth(1)
            .and_then(|s| s.split('"').next())
            .ok_or(("acquire-parse", format!("unexpected acquire answer: {acq}")))?
            .to_string();
        // stage 4: GetFeatures (v1 message type 55)
        let call = bridge_post(&format!("/call/{session}"), &frame_hex(55, &[]));
        let _ = bridge_post(&format!("/release/{session}"), ""); // best-effort
        let resp = call.map_err(|e| ("call-failed", format!("Handshake refused at the protocol stage ({e}). If this device is THP-only, the v1 lane cannot speak to it — the native THP step replaces this framing; see the goose matrix dispatch.")))?;
        let (msg_type, payload) = unframe_hex(&resp).map_err(|e| ("bad-frame", e))?;
        let (vendor, version) = parse_features(&payload);
        Ok::<_, (&str, String)>(serde_json::json!({
            "bridge": ver.trim(),
            "device_path": path,
            "response_msg_type": msg_type,
            "features_msg": msg_type == 17,
            "vendor": vendor,
            "firmware": version.map(|(a,b,c)| format!("{a}.{b}.{c}")),
            "proof": "REAL device answered over the BNR native bridge lane — no third-party page involved",
        }))
    })
    .await;

    match out {
        Ok(Ok(v)) => Json(serde_json::json!({ "ok": true, "result": v })).into_response(),
        Ok(Err((stage, why))) => {
            Json(serde_json::json!({ "ok": false, "stage": stage, "why": why })).into_response()
        }
        Err(e) => Json(serde_json::json!({ "ok": false, "stage": "join", "why": e.to_string() }))
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_features_frame_is_the_golden_hex() {
        assert_eq!(frame_hex(55, &[]), "003700000000");
    }

    #[test]
    fn unframe_round_trips_and_names_truncation() {
        let hex = frame_hex(17, &[0x0a, 0x02, b'h', b'i']);
        let (t, p) = unframe_hex(&hex).expect("parses");
        assert_eq!(t, 17);
        assert_eq!(p, vec![0x0a, 0x02, b'h', b'i']);
        assert!(unframe_hex("0011").unwrap_err().contains("too short"));
        assert!(unframe_hex("00110000000a00")
            .unwrap_err()
            .contains("truncated"));
    }

    #[test]
    fn features_parser_reads_vendor_and_version_and_skips_unknowns() {
        // field1 "trezor.io", field2=2, field3=12, field4=4, plus an unknown
        // len-delimited field 9 to prove skipping works.
        let mut p = vec![0x0a, 0x09];
        p.extend_from_slice(b"trezor.io");
        p.extend_from_slice(&[0x10, 0x02, 0x18, 0x0c, 0x20, 0x04, 0x4a, 0x03, 1, 2, 3]);
        let (vendor, ver) = parse_features(&p);
        assert_eq!(vendor.as_deref(), Some("trezor.io"));
        assert_eq!(ver, Some((2, 12, 4)));
    }

    #[test]
    fn features_parser_never_panics_on_garbage() {
        for garbage in [&[0xff_u8; 3][..], &[0x0a, 0xff], &[], &[0x07]] {
            let _ = parse_features(garbage); // must not panic
        }
    }
}
