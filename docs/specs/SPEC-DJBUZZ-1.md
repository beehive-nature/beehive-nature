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

---

## 5 · BEATPORT-CLASS INTEGRATION — the lawful posture (founder list, 2026-08-20)

The founder's tool list (api-evangelist/beatport docs, the beatport org, beatportdl,
music-assistant + its discussion, orpheusdl-beatport, beets-beatport4, the kemo gist)
maps three integration classes, and the house treats them differently BY LAW:

| class | examples | posture |
|---|---|---|
| **metadata & catalog patterns** | api-evangelist docs, beets-beatport4 (beets plugin class), music-assistant's connector discussion | **adopt as patterns** — the room's catalog/metadata layer: track IDs, artists, labels, artwork references, the DJ's own library organization |
| **the DJ's own purchases** | library tools operating on tracks the DJ bought | **supported** — a DJ's purchased library is theirs; the room reads THEIR library metadata, never a shared stream of purchased catalogs |
| **download/circumvention-shaped** | beatportdl, orpheusdl-beatport, the streaming-proxy's Beatport-API mimicry (§3) | **pattern-study only, never shipped** — ToS-risk class; the hive does not build distribution circumvention, full stop. Streaming from services a DJ does not control into a commercial-mimicked API is counsel-and-founder territory at best |

**The commerce rule:** purchase links, affiliates, anything money — founder hands (DB-4
lineage). The room's Beatport surface, if built, is **metadata + the DJ's own library +
"buy it where the artist gets paid" links** — and it names that law on its face.

## 6 · THE LISTENING ROOM — the founder's "another tab outside the buzz"

Founder, verbatim: *"full integration with the buzz room maybe another tab outside of
the buzz for art viewing and listening and edits?"* — **Yes, and it is an estate
surface, not a buzz feature** (the pattern: buzz is the room; Pages is the gallery):

**`surfaces/listening.html` — the Listening Room** (build queued behind DB-1's class
ratification):

- **VIEW:** the sound-inscription gallery — each piece's on-chain art (the generator's
  visual twin, hex-art lineage) beside its provenance: parent seed, renderer contract,
  the set it dropped in, the AR-pinned master's sha256.
- **LISTEN:** two paths, both keyless — (a) **client-side re-render**: the on-chain
  seed + renderer played in the browser (the organ's synth, generalized — the
  inscription IS the music, no file needed); (b) the **AR master** via public gateway
  for the studio recording. The now-playing wall of the buzz room embeds the same
  players for live sets.
- **EDITS — the fork law applied to sound:** a listener forks a piece the way BiGen
  forks a verdict: change the seed, hear the change immediately (client-side), and
  mint the fork **with provenance to its parent** — a remix lineage that is itself
  receipted art. Edits never mutate the original (append-mostly, the reorg law's
  grammar); the fork tree IS the community's collaborative score.
- **Integration with the room:** the buzz room's live wall links every played track to
  its Listening-Room page when an inscription exists — the set becomes a walkable
  gallery the moment it ends; bQueenBee's drop announcements link there too.

**Gate DB-5:** the fork-provenance shape (parent pointer + divergence receipt) rides
DB-1's class ratification — one ruling opens the room's build.

---

## 7 · THE CREATION DOCTRINE — humans + AI making first-class art around the clock (GO executed)

Founder, verbatim: *"lets get the Ui/UX for humans and ai creating 1st class sound and
visual art around the clock across the world. How do we best work with others, stay true
to our self art creation process and fully leverage hardware/bMeshAsi for music
creation, production intwined with erc20i tokens and or nfts"* — **GO approved on all
DB gates.** The doctrine, four lines, each already a standing law elsewhere in the tree:

1. **Humans and AI co-create, badges honest.** The around-the-clock output is a feature
   only if every piece says what it is: ⚙ on AI-touched art, exactly as on machine-drafted
   language. The world's first honest generative label is the moat.
2. **The self-art process stays sovereign.** The founder's style anchors are the genesis
   corpus; AI extends, never replaces; forks credit parents (the lineage law, live in
   the Listening Room).
3. **Working with others rides the bAccord grammar.** Remix rights, revenue splits,
   credit — settled in the open, bQueenBee refereeable, the Farmers Market's shape.
4. **Hardware + bMeshAi carry the production.** Offline-first studio (the bSAFE device
   lane); performances sync over the mesh when towers choke (bMeshAi); the tokens are
   the receipts — **ERC-20i inscriptions for the art, never bridged; NFT-class minting
   only where tier-2 id-addressed transfer exists** (the §10 boundary, measured: frozen
   data on exSat/ETH; on Base, existence couples to balance — escrow carries backing).

**Landed with the GO:** `surfaces/listening.html` — the Listening Room v0: one seed
driving sound AND sight through a deterministic demo renderer (the organ generalized);
**the fork law live** (child = parent with one nibble flipped, divergence receipt
rendered, parent untouched, lineage stacked); the DB-1 provenance card rendered as UI;
the doctrine on the page. Hub 42, roster 34, **70/70**. The real renderer-contract
build and the buzz-room wiring follow the deployment gates.
