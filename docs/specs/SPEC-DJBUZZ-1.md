# SPEC-DJBUZZ-1 — sound inscriptions + the DJ buzz community room

**Founder, verbatim (2026-08-20, with the tool list):** *"our sound inscription creation
and DJ buzz community room"* — followed by the Traktor ecosystem directory
(AwesomeTraktor, streaming proxy, now-playing, API client, bridge, librarian), Mixxx,
and deckshark.us.

**Status:** SPEC — the lane where the estate converges: the festival economy's musical
arm, the organ's seed-derived scales becoming inscribed sound, and the buzz relay as
the room where DJs perform. Nothing proprietary is integrated except through clean
interfaces; the license table below is the L-VERIFY pass, house pattern.

---

## 1 · THE TWO HALVES

**A · Sound inscription creation.** The inscription art lane already renders sound from
seeds — `blight/midi-organ.html` (the seed becomes sound; MiDi's scales playable) and
`blight/studio-music.html` (16-step sequencer, import any piece's scale). The
extension is honest about what "on-chain audio" can mean:

- **On-chain: the seed + the renderer contract** — the same shape as the hex-art
  lineage (a small deterministic generator, the music equivalent of the pixel
  renderer): the inscription IS the generator + its seed, and any client can re-render
  the track from nothing. Size reality respected: full audio files do not go on-chain.
- **The full master: pinned media** — MEDIA-1's lane carries the rendered master
  (Arweave-first, sha256-pinned to the record); the inscription references it.
- **The creation pipeline, in-house:** seed → scale (organ lineage) → composition
  (studio sequencer) → **Mixxx** as the open-source performance/mixing layer → the
  recorded set → inscription. **Mixxx is the house-first choice: GPLv2+, open,
  scriptable** — the Traktor lane is supported through clean interfaces only (§3).

**B · The DJ buzz community room.** The relay is the room (the standing doctrine) — a
**DJ community on the hive's own buzz instance**, on the founder-controlled hostname
(the SNI law: never a \*.buzz.xyz subdomain). Shape:

- DJs join the community; **live now-playing metadata flows into the room** — sourced
  from Traktor's **broadcast feature** (the `traktor_nowplaying` pattern, MIT: Icecast
  metadata → parsed → posted) or **Mixxx-native** (open end to end); the room's wall
  shows the live set as it happens — every track a receipt-able line.
- **Sets end as artifacts:** the setlist (timestamped, from the metadata stream) +
  the recorded master (pinned AR per MEDIA-1) + optionally a sound inscription of the
  signature moment — the DJ's drop becomes an inscription, announced by bQueenBee
  (`receipts.drop` class, media-carrying).
- **The raver register already owns the culture slot** (🎛 — the retired rave energy's
  lawful home); the DJ room is its living room at runtime.

## 2 · THE PIPELINE, END TO END

```
seed → scale (organ) → compose (studio) → perform (Mixxx / Traktor-clean-if)
      → live metadata → the buzz room (founder-hostname relay, community wall)
      → set ends → setlist receipt + master pinned (AR, sha256)
      → signature moment → SOUND INSCRIPTION (on-chain seed+renderer, AR master)
      → bQueenBee announces the drop (VOICE record, media: ar:<txid>)
```

Every arrow is a thing the tree already has a pattern for: seed-derivation (organ),
sequencing (studio), relay rooms (buzz), media pinning (MEDIA-1), announcements (the
voice crate), receipts throughout.

## 3 · THE TOOLS TABLE (L-VERIFY pass, 2026-08-20 — verified licenses bold)

| tool | what it is | license | house posture |
|---|---|---|---|
| **traktor-api-client** (ErikMinekus) | QML-hook pushing live track data to a web server | **MIT (verified)** | boardable/reference for our metadata bridge — but the QML hook is a proprietary-app mod: **clean interfaces preferred** (broadcast/Icecast) |
| **traktor_nowplaying** (radusuciu) | broadcast metadata → now-playing text | **MIT (verified)** | the pattern for our room's Traktor ingestion; reimplement clean, credit the pattern |
| **Mixxx** | the open-source DJ platform | **GPLv2+ (verified)** | the house performance layer — **pattern and interop, never code-paste into AGPL**; GPLv2 services may sit beside ours |
| traktor-streaming-proxy | Beatport-API-mimicking stream proxy | owed L-VERIFY | pattern only until verified; streaming-rights questions are founder-counsel territory |
| Traktor-Bridge / Librarian / AwesomeTraktor | conversion/curation utilities | owed L-VERIFY | reference; nothing adopted yet |
| **Native Instruments Traktor Pro** | the proprietary DJ platform | proprietary | **integrated through its published surfaces only** (broadcast metadata, MIDI); no QML mods shipped by us |
| deckshark.us | DJ-gear marketplace contact | n/a | founder-hands if a commercial touch is wanted (DB-4) |

## 4 · GATES

| | question |
|---|---|
| **DB-1** | the sound-inscription shape: on-chain seed+renderer contract class + AR master (recommended) — founder ratifies the class before any mint |
| **DB-2** | the buzz DJ-room deployment: founder-hostname relay community (the R-1 lane's heritage) — deployment is founder-hands with the box script pattern |
| **DB-3** | remaining license verifications (streaming-proxy, bridge, librarian) before any adoption |
| **DB-4** | any commercial touch (deckshark, NI) — founder-hands only |

**The art law rides from day one:** a sound inscription is art — ERC-20i-family
discipline, exSat the home, **never bridged** (to-source dissolution), and MEDIA-1's
pin discipline on every master. zAgent (GLM 5.3), acting chief, 2026-08-20. 🐝
