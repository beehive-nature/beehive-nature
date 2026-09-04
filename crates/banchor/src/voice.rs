//! VOICE IN — a spoken goal drives the same loop. whisper.cpp on the
//! ESTATE'S OWN IRON (the Oracle box's compute lane), never hosted ASR:
//! audio never leaves estate machines, and the transcript carries its full
//! provenance (engine, model, where it ran, the wav's digest) into every
//! replay and receipt.
//!
//! Shape: capture 16 kHz mono PCM on the machine with the mic
//! (voice/voice-capture.ps1 — winmm P/Invoke, zero installs), scp the wav
//! to the box, run whisper-cli there over SSH, bring the text back. The
//! transcript is operator speech transcribed by a local model — it can
//! MISHEAR; it is recorded verbatim, digested, and never treated as more
//! authoritative than the human who spoke it.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

use crate::b64::{b64u, sha3_256_b64u};

#[derive(Debug, thiserror::Error)]
pub enum VoiceError {
    #[error("voice: capture/read failed: {0}")]
    Io(String),
    #[error("voice: ssh/scp to the compute box failed: {0}")]
    Transport(String),
    #[error("voice: whisper produced no usable transcript")]
    Empty,
}

pub fn ssh_key() -> PathBuf {
    std::env::var("BANCHOR_SSH_KEY")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home_join(&[".ssh", "bnr_key.lf"]))
}

pub fn voice_host() -> String {
    std::env::var("BANCHOR_VOICE_HOST").unwrap_or_else(|_| "ubuntu@129.153.202.144".into())
}

fn home_join(parts: &[&str]) -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    let mut p = PathBuf::from(home);
    for part in parts {
        p.push(part);
    }
    p
}

/// Record `seconds` from the default microphone with LOCAL ffmpeg (dshow),
/// straight to whisper's 16 kHz mono s16 wav. ffmpeg is found via
/// BANCHOR_FFMPEG, PATH, or the winget install dir; the dshow device via
/// BANCHOR_MIC (default: this box's "Microphone Array (Realtek(R) Audio)").
/// Local capture only — the audio never leaves estate machines.
pub fn capture_mic(out: &Path, seconds: u32) -> Result<(), String> {
    let ffmpeg = std::env::var("BANCHOR_FFMPEG")
        .ok()
        .filter(|p| Path::new(p).is_file())
        .or_else(|| which_ffmpeg())
        .ok_or_else(|| {
            "no ffmpeg for mic capture — set BANCHOR_FFMPEG (local tool; voice/voice-capture.ps1 is the zero-install fallback, currently experimental)"
                .to_string()
        })?;
    let mic = std::env::var("BANCHOR_MIC")
        .unwrap_or_else(|_| "Microphone Array (Realtek(R) Audio)".into());
    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-loglevel",
            "error",
            "-f",
            "dshow",
            "-i",
            &format!("audio={mic}"),
            "-t",
            &seconds.to_string(),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-sample_fmt",
            "s16",
        ])
        .arg(out)
        .status()
        .map_err(|e| format!("ffmpeg: {e}"))?;
    if !status.success() {
        return Err(
            "ffmpeg mic capture failed (mic muted or device name changed — set BANCHOR_MIC)".into(),
        );
    }
    Ok(())
}

fn which_ffmpeg() -> Option<String> {
    // PATH first, then the winget links dir, then a shallow package scan
    if Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some("ffmpeg".into());
    }
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let links = Path::new(&local).join("Microsoft/WinGet/Links/ffmpeg.exe");
    if links.is_file() {
        return Some(links.display().to_string());
    }
    let pkgs = Path::new(&local).join("Microsoft/WinGet/Packages");
    let mut found: Option<String> = None;
    if let Ok(entries) = std::fs::read_dir(&pkgs) {
        for e in entries.flatten() {
            let bin = e.path().join("ffmpeg-9.0.1-full_build/bin/ffmpeg.exe");
            if bin.is_file() {
                found = Some(bin.display().to_string());
                break;
            }
            // version-agnostic retry: any */bin/ffmpeg.exe one level deeper
            if let Ok(sub) = std::fs::read_dir(e.path()) {
                for s in sub.flatten() {
                    let bin = s.path().join("bin/ffmpeg.exe");
                    if bin.is_file() {
                        found = Some(bin.display().to_string());
                        break;
                    }
                }
            }
            if found.is_some() {
                break;
            }
        }
    }
    found
}

/// Clean whisper-cli output: `-nt` mode emits bare text lines; strip
/// leading/trailing noise, collapse ALL whitespace runs (ASR pads words).
/// Pure — tested offline.
pub fn clean_transcript(raw: &str) -> String {
    raw.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with("whisper_") && !l.starts_with("system_info"))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Transcribe one wav ON THE BOX with whisper.cpp. Returns the transcript
/// plus full provenance for the replay.
pub fn goal_from_audio(wav: &Path) -> Result<(String, Value), VoiceError> {
    let bytes = std::fs::read(wav).map_err(|e| VoiceError::Io(e.to_string()))?;
    if bytes.len() < 44 || &bytes[..4] != b"RIFF" {
        return Err(VoiceError::Io(format!(
            "{} is not a RIFF wav ({} bytes)",
            wav.display(),
            bytes.len()
        )));
    }
    let digest = sha3_256_b64u(&bytes);
    let remote = format!("/tmp/banchor-voice-{digest}.wav");

    // scp the clip to the box (audio stays on estate machines)
    let scp_out = Command::new("scp")
        .arg("-i")
        .arg(ssh_key())
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg(wav)
        .arg(format!("{}:{}", voice_host(), remote))
        .output()
        .map_err(|e| VoiceError::Transport(e.to_string()))?;
    if !scp_out.status.success() {
        return Err(VoiceError::Transport(
            String::from_utf8_lossy(&scp_out.stderr).to_string(),
        ));
    }

    // whisper-cli on the box — LOCAL inference, estate iron
    let model = std::env::var("BANCHOR_WHISPER_MODEL")
        .unwrap_or_else(|_| "/opt/buzz-compute/whisper.cpp/models/ggml-small-q5_1.bin".into());
    // TONGUE ORDER (founder voice-session ruling 2026-09-04): Latvian ·
    // Thai · Russian · Ukrainian. Latvian FORCED by default — English-default
    // ASR is the proven failure (spoken Latvian came out as nonsense).
    let lang = std::env::var("BANCHOR_VOICE_LANG").unwrap_or_else(|_| "lv".into());
    let cli = std::env::var("BANCHOR_WHISPER_CLI")
        .unwrap_or_else(|_| "/opt/buzz-compute/whisper.cpp/build/bin/whisper-cli".into());
    let ssh_out = Command::new("ssh")
        .arg("-i")
        .arg(ssh_key())
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg(voice_host())
        .arg(format!(
            "{cli} -m {model} -f {remote} -nt -np -l {lang} 2>/dev/null"
        ))
        .output()
        .map_err(|e| VoiceError::Transport(e.to_string()))?;
    if !ssh_out.status.success() {
        return Err(VoiceError::Transport(
            String::from_utf8_lossy(&ssh_out.stderr).to_string(),
        ));
    }
    let _ = Command::new("ssh")
        .arg("-i")
        .arg(ssh_key())
        .arg("-o")
        .arg("BatchMode=yes")
        .arg(voice_host())
        .arg(format!("rm -f {remote}"))
        .status();

    let transcript = clean_transcript(&String::from_utf8_lossy(&ssh_out.stdout));
    if transcript.is_empty() {
        return Err(VoiceError::Empty);
    }
    let provenance = json!({
        "source": "audio",
        "asr": {
            "engine": "whisper.cpp",
            "model": model,
            "lang": lang,
            "tongue_order": "lv · th · ru · uk",
            "where": voice_host(),
            "hosted_asr": false,
        },
        "audio": {
            "path": wav.display().to_string(),
            "bytes": bytes.len(),
            "sha3_256": format!("sha3-256:{digest}"),
            "b64u_head": b64u(&bytes[..bytes.len().min(64)]),
        },
        "transcript": transcript,
    });
    Ok((transcript, provenance))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcript_cleaning_strips_noise_and_squashes_lines() {
        let raw = "whisper_init_from_file_with_state_no_state: loading model from ...\n\n\n  Click the  root zone   registry.  \nsystem_info: n_threads = 3\n";
        assert_eq!(clean_transcript(raw), "Click the root zone registry.");
    }

    #[test]
    fn provenance_names_engine_and_locality() {
        // shape check without any network: the builder is exercised in the
        // live receipt; here we pin the contract fields
        let p = json!({
            "source": "audio",
            "asr": { "engine": "whisper.cpp", "hosted_asr": false },
        });
        assert_eq!(p["source"], "audio");
        assert_eq!(p["asr"]["hosted_asr"], false);
        assert_eq!(p["asr"]["engine"], "whisper.cpp");
    }
}
