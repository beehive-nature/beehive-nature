# DISPATCH — buzz VOICE LANE — GOAL 1: LATVIAN VOICE IN THE ROOM — 2026-09-04

Seat: zCode. Order: voice message on the phone view → whisper.cpp on the
box (multilingual, -l lv forced) → transcript posted as the message with
the audio's digest; raw audio deleted after transcription; tongue order
lv · th · ru · uk; fork-to-prove, PR upstream.

## LANDED

Client: fork `skaists/buzz` branch `voice-messages` @0384a753 — mic in the
room composer (rendered ONLY when the community's join material declares
a door — fail-closed both ways), tongue picker in the community's order,
honest transcribing state, nsec guard on transcripts, NIP-98 door auth
(canonical `u`, payload = sha256 of the audio bytes, rides the given
road). PR upstream **block/buzz#7348** (stacks on #7311).

Door: `ops/voice-scribe` in-tree = what runs on the box — node worker →
ffmpeg → `whisper-cli -l <tongue>` (multilingual **large-v3-turbo q5_0**,
574 MB; language PINNED, never auto), serialized queue, per-job spool dir
deleted in a `finally`, NIP-98-gated, 8 MB/120 s caps, 10 jobs/5 min/key.
Caddy `/voice` on both roads, iptables 8093 persisted, systemd
`voice-scribe.service`, join.json `voice` field written atomically.

## RECEIPT

`e2e/shots-buzz/voice-390-general-transcript.png` — a COLD phone at 390px
joins by address alone, switches to #general, records 15.5 s of REAL
Latvian (the LibriVox Lāčplēsis reader, public domain) through the real
mic path, and the message arrives:

> Šis ir LibriVox ieraksts. Visi LibriVox ierasti ir brīvi no
> autortiesībām. Lai uzzinātu vairāk vai piedalītos, lūdzu apmeklējiet
> LibriVox.org. … — 🎙 voice→text · lv · sha256:d5b2e59070e9d1d03766e664e63b4e16aab3e36fb776dcb66ff6f8a49d5c26e5 (PUBLIC-CONSTANT receipt digest)

11/11 PASS (`e2e/voice-shot.mjs`); spool dir EMPTY after the run (raw
audio deleted, journal line receipts it); door-served digest matches the
message byte-for-byte.

## NUMBERS

Door: 40.5 s for a 15.5 s note (2.6× real-time on 4 ARM cores). Bake-off:
small garbles natural lv, medium accurate but 4–6×RT, turbo-q5_0 the
landed compromise. Gates: biome + tsc + file-sizes + pubkey-truncation
green (the two remaining repo-wide biome errors are the agent-roster
seat's untracked WIP, not this lane's).

## FLAGS

Turbo still drifts on archaic words ("ieraksti"→"ierasti", "Lāčplēsis"→
"Lāčplēs") — honest transcript, not a cleaned one. Latency is the price
of the accurate model. The nonce/rate guard is in-memory = single
instance (redis is the multi-instance cure). Membership itself stays the
relay's law — the door proves key possession only.

## TRAPS (banked in ops/voice-scribe/README.md)

whisper.cpp cmake EXAMPLES=OFF removes the CLI; the trailing-slash law
(signed `u` vs the path Caddy needs); MediaRecorder webm carries no
container duration (probe the converted wav); the box iptables is a
per-port INPUT allowlist (netfilter-persistent); espeak-ng lv is
unrecognized by whisper; msedge-tts endpoint dead 2026-09-04.

## NEXT

th · ru · uk proof runs through the same door (allowlist already live);
desktop client voice; whisper batching if traffic grows.
