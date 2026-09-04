# voice-scribe — Latvian voice IN the Buzz room

The voice lane (2026-09-04): a phone records a voice note in the room
composer → the note is POSTed to the community's transcription door →
whisper.cpp on the box transcribes it (multilingual model, language PINNED
per request — never auto-detect; the estate's tongue order is
**lv · th · ru · uk**, lv the default) → the transcript is posted to the
room as the message, carrying the audio's sha256 digest → **the raw audio
is deleted after transcription**. What persists on the relay is text plus
a digest; no recording is ever stored.

## The pieces

- `voice-scribe.mjs` — the door (node, one file). NIP-98-gated POST:
  the `u` tag must sign the community's CANONICAL origin (`https://skaists.buzz/voice`
  — sign the identity, ride the given road), the `payload` tag must be the
  sha256 of the raw audio bytes, signature must verify, event ≤ 10 min old,
  nonce single-use. In-memory nonce/rate state = single instance only
  (the relay's redis-backed guard is the multi-instance cure, invite-rotate
  precedent).
- Pipeline per job: bytes → spool dir (0600, one dir per job) → ffprobe
  duration cap 120s → ffmpeg to 16 kHz mono wav → `whisper-cli -m <model>
  -l <lang> -f in.wav -oj` → transcript → `rm -rf` the job dir in a
  `finally`. Jobs serialize (whisper owns the cores while running); queue
  cap 3, then plain-words 503. Per-job timeout kills the child.
- Model: `ggml-large-v3-turbo-q5_0` (574 MB). The Latvian bake-off:
  small garbles even natural speech, medium is 4–6× real-time, turbo-q5_0
  is ~1.7× real-time with near-medium accuracy. Build: whisper.cpp
  (cmake, `-DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON` —
  **EXAMPLES=OFF removes whisper-cli**; that flag cost one rebuild).
- `voice-scribe.service` — systemd unit; bind `172.18.0.1:8093`
  (the caddy-door bridge convention, like compute 8091 / voucher 8092).
- Caddy: `handle_path /voice/*` blocks in BOTH skaists site blocks
  (`Caddyfile.bak-pre-voice` taken first) — additive only.
- Client capability lives in the buzz fork (`skaists/buzz`, branch
  `voice-messages`): mic in the composer, fail-closed on the join
  material (`join.json` `voice` key — no key, no mic), transcript
  auto-posted as the message with the digest line.

## Deploy

```
rsync this dir → /opt/voice-scribe (whisper.cpp/ + model live beside it)
cd /opt/voice-scribe && npm install
sudo systemctl enable --now voice-scribe
# caddy: add the /voice blocks, then
sudo docker exec buzz-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Traps banked

- **EXAMPLES=OFF** in the whisper.cpp cmake configure removes the CLI —
  the build "succeeds" with no binary.
- **The trailing-slash law**: the client signs `u` = canonical origin +
  the declared path, and the declared path carries the trailing slash
  the Caddy `handle_path /voice/*` match needs — the door must accept
  the canonical URL both with and without that slash (found live: a
  401 that was correct auth signed against a slightly different string).
- **MediaRecorder webm has no container duration** (no Cues seek head) —
  ffprobe on the RAW upload cannot answer; convert to wav first, then
  probe the wav, where duration is exact (found live on the second
  receipt run).
- **iptables is an INPUT allowlist per port** — a new bridge door needs
  its own `-s 172.16.0.0/12 --dport <n>` rule plus
  `netfilter-persistent save`, or caddy 502s with "Host is unreachable".
- espeak-ng's Latvian is UNRECOGNIZED by whisper (robotic prosody;
  every model garbles it) — synthetic-voice testing must use neural TTS
  or real speech.
- The msedge-tts free endpoint is dead from both this box and a
  residential IP (stream closes before `turn.end`, 2026-09-04).
- whisper `-oj` writes `<of>.json` with a `transcription` segment array.
- The Latvian receipt audio is LibriVox Lāčplēsis (public domain,
  archive.org `lacplesis_kb_librivox`) — real human speech; the spoken
  LibriVox disclaimer round-trips near-exactly through turbo.
