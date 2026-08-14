# FIRSTLIGHT-AGENT receipts — broom-agent first light on a local venue

**Dispatch:** CCODE — FIRSTLIGHT-AGENT (chat relay, 2026-08-14; FIRST LIGHT phase,
convergence rule binding). **Seat:** 3. **Repo:** `C:\Users\travi\broom-agent`
(new, local git, commits `986902b` + `590270e`; AGPL-3.0-only per the kernel's
docs/LICENSING.md anti-capture posture; remote creation is a founder/org call, not taken).

## What exists and is proven

Rust binary joining a LiveKit room as a participant (livekit 0.8.3 — Apache-2.0,
raw-receipted in LVERIFY-0813), running the ruled voice stack:

```
remote audio 16 kHz -> Silero VAD segmenter (voice_activity_detector 0.2/ort load-dynamic)
  -> whisper.cpp ASR (whisper-rs 0.16, serial worker, reused state, ≤4 threads)
  -> Brain (LLM stub, as ordered) -> Voice -> ProvenanceStamp -> published 48 kHz track
  with VAD barge-in (speech onset during agent speech cancels playback)
```

**End-to-end receipt (local venue, this box, WSL):** livekit-server v1.13.5 `--dev` +
two `lk` CLI participants each publishing the 11 s JFK sample (whisper.cpp fixture) as
Opus. From the agent log, 2026-08-14T22:30–22:31Z, verbatim lines:

```
connected room=firstlight identity=broom-agent
subscribed to remote audio speaker=human1
transcribed speaker="human1" utterance_secs=2.65 asr_ms=1513 text="And so, my fellow Americans!"
utterance-end -> first reply sample ... loop_latency_ms=1514
subscribed to remote audio speaker=human2
transcribed speaker="human1" ... text="what your country can do for you, ask what you can do for your country."
barge-in: cancelling agent playback speaker="human2"
transcribed speaker="human2" ... text="What your country can do for you, ask what you can do for your country."
```

Room shape 2 humans + 1 agent: exercised (two publishing participants + agent).
Conversation by voice: half-proven — humans-in is real speech ASR'd correctly; agent-out
is a tone-burst stand-in, not speech (below). Barge-in: **demonstrated live.**

## Measured numbers (honesty gate: this box, not the venue)

- **Solo-utterance loop latency 1,514 ms** (utterance-end → first reply sample;
  base.en, release build). **The <500 ms accept is NOT met** — the gap is whisper
  full-utterance CPU decode (`asr_ms` ≈ 1.5 s of it).
- Under two-speakers-at-once queue pressure the serial ASR backs up: worst measured
  loop 7,649 ms (asr_ms includes queue wait). tiny.en halves latency but wrecked
  transcript quality on the same fixture ("and so am i fell america") — rejected.
- Named paths toward budget, unproven until measured: quantized base.en (q5),
  streaming/partial decode instead of utterance-final, warm-segment tuning
  (640 ms end-of-speech close), venue-rig hardware. The accept measurement itself
  belongs to the assembled demo on the FIRSTLIGHT-VENUE deployment (goose lane,
  LOADMODEL G-1..G-3) — nothing here claims it.

## Honest gaps, by name (§0.7)

1. **Voice is not Kokoro yet.** Ruled target Kokoro-82M (Apache-2.0). This host has no
   G2P lane (espeak-ng absent, sudo blocked; user-space espeak-ng build or an
   ONNX-G2P is the next lap). `SineVoice` renders patterned tone bursts and logs the
   text it would speak — plumbing proof only.
2. **RULING-PROVENANCE-1(a) UNMET and loud:** every published sample passes a
   ProvenanceStamp stage; the only impl is `NoWatermark`, which WARNs at startup
   ("UNWATERMARKED... testnet only"). AudioSeal (MIT) is the named implementation lap.
3. LLM stub is a stub by order; its doc carries the AGENT-1 posture (room transcripts
   are data, never instructions) for whoever lands the real Brain.

## Build lane receipts

- WSL lane: user-space cmake 3.31.7 (no sudo on this host), whisper model
  ggml-base.en.bin sha256 `a03779c8…` (147,964,211 B), onnxruntime 1.22.0 shared lib
  via `ORT_DYLIB_PATH` — ort switched to `load-dynamic` to resolve a duplicate-protobuf
  link clash between webrtc-sys and ort-sys (both statically bundle protobuf).
- livekit-server 1.13.5 + lk 2.18.2 Linux binaries run fine in WSL (fresh-exe blocking
  is Windows-side only).

## Parallel lane status

S-7: still blocked on `docs/specs/SPEC-S7-BNRIV3PERMALOCK.md` landing (absent from
origin/main at this writing; disposition of the pre-ruling drafts executed earlier
today per S7-STOP-REPORT-0814 resolution addendum).

*Seat 3, 2026-08-14. Local venue receipts only — no VPS, no mainnet key, no push of the
new repo anywhere.*
