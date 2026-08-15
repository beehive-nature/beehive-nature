# UX-OPTICAL-PAIRING-1 — the air-gap light rail: ceremony UX, day-1 scope, seed-harvest immunity
**Status:** DRAFT for founder review · Seat 3 · 2026-08-14
**Sources:** RAID_DECIMEN_OPTICAL_TRANSFER.md (capacity/crossover/threat frame) · founder beta rounds 1–2 · surfaces/onboarding/{index,receive}.html

## 0 · Why day 1

Nobody ships this. The closest prior art is QR-scan login (~a decade old, one payload,
one direction, server in the middle). BNR's version is a general **ceremony transport**:
pairing, resume, enrolment, watch-lists, signed transactions — all as light, no server,
no install (the receiver is a web page), working at a 1M-person popup with zero
infrastructure. It is the single most visible "no one else can do this" surface we own.

## 0b · RECEIPTS (founder-verified, 2026-08-14)
186 bytes of light, laptop→phone over Pages https; then the full one-scan
install+pair from a **stock Samsung A16 camera app** — no BNR software on the
phone, envelope delivered by fragment, consent shell reached. The mass-adoption
device class is the proven baseline, not the aspiration.
(`RECEIPT_OPTICAL_ONESCAN_FIRSTLIGHT_2026-08-14.md`)

## 1 · The rule that shapes everything: one frame first

One QR frame carries ~2.9 KB. **Every day-1 ceremony payload fits in one frame**, so
day 1 is STATIC QR + camera — no fountain streaming, no decimen dependency, no video.
(The founder's camera test confirmed the placeholder was inert — correct suspicion;
the real rail below is what makes it live.) Fountain streams (decimen lane, AGPL,
self-hosted) enter only for >3 KB payloads: DID logs, watch-lists >100 addresses,
app-bundle sideload. **Never reach for the animated stream when a static code serves.**

## 2 · Day-1 scope (buildable now)

| piece | state |
|---|---|
| Mobile receiver — real camera + native BarcodeDetector decode, honest ABSENT on iOS | **BUILT** (`surfaces/onboarding/receive.html`) |
| Envelope shapes `{v:1, kind}`: `bnr-pair-request` · `bnr-resume` · `bnr-enroll-pubkey` · `bnr-watch-list` · `bnr-signed-tx` | **BUILT** (shape-validate + display, never act) |
| Sender-side QR encoder | **BUILT** — vendored Nayuki qrcodegen (MIT verbatim in-file, pinned 8329a710, compiled ES2017), jsQR foreign-oracle round-trip PASS; wizard pairing screen renders a live `bnr-pair-request` |
| iOS decode (vendored zxing-class WASM, offline) | **PLANNED** |
| Response leg (the double-flash) | **BUILT** 2026-08-14 — phone: on-device Ed25519 keypair, nonce-echoing reply, REALLY signed where supported (every degradation labeled); wizard: scan/paste + nonce-binding + sig verify + fingerprint; Declared→Known only on a bound reply. Refusal matrix DOM-verified (wrong-nonce/no-echo/no-request/wrong-kind all refuse named) |
| Fountain lane for >3 KB (self-hosted decimen, frozen tag) | **PLANNED** (RAID conditions apply) |

## 2b · The bComb frame (founder direction 2026-08-14: "hexagonal and BNR palette, in Rust")

Split by interop, not by taste:
- **Single-frame handshakes STAY standard QR.** Stock cameras + native decoders are
  the no-install story; a custom symbol there would trade our day-1 magic for looks.
- **The streaming lane becomes the bComb frame** — both endpoints are ours anyway
  (no stock app decodes fountain streams), so the symbol is ours to design:
  - **Hexagonal module lattice.** ~15% denser packing than a square grid, better
    rotation tolerance; shipped prior art exists (MaxiCode has run hexagonal
    modules in production logistics for decades — this is proven, not exotic).
  - **Data in LUMINANCE ONLY** (dark/light, exactly QR's channel) — immune to
    white balance and cheap cameras. The BNR palette tints dark modules across the
    mandala gradient as pure decoration: **hue carries zero data** (D-1 kept — color
    never carries meaning alone), so it decodes anywhere and is unmistakably ours.
    Chroma bits (HCCB-style) stay a v2 research lever behind calibration anchors.
  - **Hex/mandala finder motif** replaces QR's squares — the house motif IS the
    acquisition target; a bComb stream is visually BNR from across a room.
  - **One Rust codec crate** (`bcomb`): encode+decode, golden-vector conformance
    (the decimen discipline — vectors ARE the contract), compiled to WASM for the
    web receiver, native for relay/tools, and screen-side on bSAFE 7 (§4.4) later.
  - Fountain framing (our wire, informed by the decimen protocol via the clean-room
    rules — the RAID's dlog contamination firewall applies from day one).

## 2c · Ruled by founder 2026-08-14: the data layer is BLACK AND WHITE

The b logo plan — black hexagons and white — and the channel engineering agree
exactly, and so does the design law (b [bSAFE] is the uncolored ground):

- **Data modules: black/white only.** Luminance is the one channel every camera,
  every print process, every lighting condition, and every accessibility need
  preserves. Color in the DATA would buy little and cost dependability (white
  balance, cheap sensors, print drift) — the founder's suspicion is correct.
- **Color is a halo, never a bit.** The mandala gradient lives in a decorative
  ring/finder AROUND the black-and-white comb (exactly the shared mandala motif:
  colored petals around a structured core). Strip every drop of color and the
  code still decodes — D-1 as channel law.
- Consequence: **the bComb data field IS the b logo aesthetic.** The brand and
  the channel are the same object; nothing was traded for looks.
- Upstream note (verified 2026-08-14): decimen main is still v0.5.2 at 418.5 KB/s
  sustained; no multithread commit on main yet. Re-verify at tag-pin time.

## 2d · Ruled by founder 2026-08-15: NO COLOUR IN THE TRANSPORT, INCLUDING THE FINDER

Founder, watching a real capture drift from clean to unreadable mid-beam:
*"the receiving laptop camera starts off with great resolution where I can see
defined color and it works fast and perfect, but doesn't finish and the camera
view gets washed out white ... the color is fucking up the receiving camera."*

He was right, and §2c above was already the law — *"strip every drop of color and
the code still decodes"*. **The v1 implementation did not obey it.** `findFinder`
located the comb by matching magenta pixels, so hue was load-bearing in the
DECODER even though no bit was stored in it. Stripping colour would have broken
decoding outright. That is a D-1 violation that lived inside the codec while the
doc claimed compliance; naming it here rather than quietly fixing it.

**The ruling, now implemented:**
- **Nothing in the transport carries hue.** Black ground, white hexagons, and a
  softened white (235, not 255) so a camera's auto-exposure has less to bloom on.
- **The anchor is STRUCTURAL, not chromatic** — a lit core inside an always-dark
  collar, with an always-lit rim at ring 6. Geometry a data pattern cannot fake,
  read on luminance alone.
- **The mandala is the logo AT REST.** Brand at rest, luminance in flight. The
  two are deliberately different objects; §2c's "colour is a halo" survives as a
  *branding* rule, not a frame-format rule.
- **Decoration may never share a canvas with data.** The v1 sender had its
  animated colour mandala repainting the beam canvas at 60fps over a 240ms data
  clock, so the screen showed decoration ~94% of the time and a camera almost
  never caught a frame. Self-verify passed anyway because it decoded in the
  instant before the next repaint — a green light measuring the wrong thing.
  **This, not the palette, is why beams "started perfect and never finished."**

**Frame format changed with the collar** (v2, 127 cells): ring 0 lit core, ring 1
dark collar, rings 2–5 = **84 data cells**, ring 6 lit rim. Packing is
`[6 index][6 total-1][64 payload][8 CRC-8]`; **8 bytes/frame**, max 64 frames =
512 B/beam. Rate is **84 bits × 7 Hz = 588 b/sec** — the old "~420 b/sec" brand
came from v1's 60 bits and is now a floor. Both surfaces' rate chips were
corrected; still never to be confused with decimen's 418.5 KB/s.

**Receipts (measured 2026-08-15, node+canvas oracle and live browser):**
- self-test 6/6 frames; single-bit flips **84/84 refused, 0 accepted**;
  round trip byte-perfect; progress held through 8 contradictory noise frames.
- **Hue-independence proof:** swapping the R and B channels of a captured frame
  (a maximal hue change at near-constant luminance) returns the **byte-identical
  frame**. D-1 is now provable, not asserted.
- **Wash tolerance:** a 55% white overlay — the founder's exact symptom — decodes
  at 100%. A colourful UI in frame no longer produces a false finder.
- **Live browser, 9s sustained:** 86/86 reads decoded (100%), all 17 frames
  collected, payload assembled, and **max channel spread 0 across 739,600 pixels**
  — the beaming canvas is measurably grayscale.

Still owed: the Rust `bcomb` crate. The JS remains the conformance oracle, and a
second implementation is not evidence for this one.

## 3 · The ceremony grammar (who displays, who scans)

**Directional law (from the RAID, load-bearing):** the UNTRUSTED/new device DISPLAYS;
the TRUSTED device SCANS and signs. Public data only on any screen, ever.
- **Pair a spare phone (air-gap rung):** new phone displays `bnr-enroll-pubkey`
  (its envelope pubkey); trusted surface scans → signs additive enrolment → done.
  Incumbents do this backwards (trusted screen displays, new device scans) because a
  server completes it; ours needs no server and leaks no secret.
- **Cross-device resume:** desktop displays `bnr-resume` (signed, nonce, journal-head
  bound, short expiry); phone scans; ceremony continues where it stood.
- **Air-gapped signing loop:** online surface displays unsigned tx → offline signer
  scans, shows WYSIWYS on its own screen, signs → displays `bnr-signed-tx` back →
  online surface scans → `POST /v1/upload`. Both legs one frame for typical txs.
- **Every payload:** signed by a key the receiver already trusts, verified by the
  CONSUMING ceremony (the receiver validates shape only), replay-bound (nonce/journal
  head), short-lived. The optical layer is a hostile courier, always.

## 3b · THE DOORSTEP FUNNEL (founder use case, 2026-08-14 — the GTM shape)

*"I am selling seed door to door; a new member scans a QR to start monthly
deliveries; once the product arrives they discover the rest of BNR."*

The full chameleon: it FEELS like "scan to subscribe" (every incumbent trained
this gesture) and IS a sovereign identity bootstrap. Staged:

- **Stage 0 — print.** A stylized static QR on the seed packet / flyer / card.
  Styling rule: **stylize the FRAME (hex border, center mark), never the
  modules**; encode at high error correction (ECC H tolerates ~30% obstruction);
  the code inside stays stock-camera decodable — that is the whole trick.
- **Stage 0b/1 — THE ONE-SCAN LINK (built 2026-08-14, after the first live
  186-byte transfer):** the pairing QR carries the receiver URL with the envelope
  in the **#fragment** — fragments never reach any server, so the payload arrives
  with the page and stays on the phone. Any stock camera: scan → tap → page opens
  → envelope already delivered → informed-consent shell (plain words first, 8f)
  → key created on-device (WebCrypto Ed25519, honest capability probe). Install
  and pair are ONE gesture; the BNR receiver reads the same code directly.
- **Stage 1 — one network moment.** Stock camera → URL → the receiver/onboarding
  PWA loads and caches. No signal at the door? The SELLER's phone serves the
  page (hotspot/captive), or the packet QR carries the essential consent terms
  themselves (a one-frame payload needs no fetch at all). The server is a
  bootstrap crutch here, used for exactly one hop, then gone.
- **Stage 2 — the optic deploy (the dazzle).** Seller's screen streams the
  subscription offer as light: `bnr-consent-request` {terms, price in plain
  words, cadence, seller's bDiD, nonce}. Buyer's phone shows the terms ON THE
  BUYER'S OWN SCREEN (never trust the seller's display for what you're agreeing
  to), buyer taps consent → keypair born on-device → displays `bnr-enroll-pubkey`
  + signed consent back → seller scans (the double-flash). Both hold a signed
  record; **no network existed at any point**; the anchor posts when either side
  next sees signal. New member in under a minute on a doorstep.
- **Stage 3 — discovery.** The delivery arrives with the next QR (order status,
  member surface) → wallet → the ladder → first Trezor. The seed subscription
  IS the onboarding; crypto is discovered, not pitched.

Payload kinds added to the receiver's known set: `bnr-consent-request`,
`bnr-consent-signed`. The consent record is a receipt both parties hold —
subscription state lives in signed envelopes, not in a company database.

## 3c · THE EVENT CEREMONY (founder use case: bRespect monthlies, PoL/PoU recalibration)

Light's unfair advantage over radio: **one screen is an infinite multicast.** A stage
screen at a bRespect monthly (or a 1M-person popup) streams the event ceremony to
every camera in the crowd simultaneously — zero bandwidth contention, zero pairing,
zero infrastructure; ten cameras or ten thousand cost the same. Uses:
- **Event envelope broadcast:** the month's ballot, the PoL/PoU recalibration
  challenge, the event's journal-head anchor — one bComb stream, everyone receives.
- **Presence AS liveness — THE ORIGINAL CLAIM HERE WAS FALSE AND IS DELETED
  (2026-08-15).** It read: *"receiving the stream proves a camera stood in this room
  during this window (the per-event nonce can't be known elsewhere/elsewhen)."* The
  per-event nonce **can** be known elsewhere and elsewhen, because this very section
  designs it as a deliberate public multicast. One confederate with a phone and an
  LTE connection serves unlimited remote sybils; the event's own livestream carries
  the stage screen to the entire internet in real time; and a 600 mm-equivalent lens
  reads a 2 m LED wall from roughly **4.3 km** — a hotel window across the plaza, or
  a drone. §8.1 already lists "camera relay of a filmed screen" as an attack, so this
  was an internal contradiction in one document, not an objection imported from
  outside. **Receiving a broadcast proves only that a camera saw a screen that was
  showing it.** It is not presence, not liveness, and not a PoL input on its own.
  Infinite multicast and infinite eavesdrop are the same physical property; the
  advantage below is real, this inference from it was not
  grounded: a remote adversary cannot stand in the room. Return leg (votes,
  recalibration proofs) goes device→steward scanners at the door, signed + nonce-bound.
- **Optical liveness spike (founder-approved):** the visual-nonce binding — the
  screen's pattern must appear inside the capture the signer signs over — is the
  same primitive; the event is its natural first deployment.

## 3d · Password managers are funnels (founder direction)

Trezor's password features, Bitwarden, and kin already hold people's most-guarded
digital habits — each is a doorway: users who already run a manager are pre-educated
in exactly the custody instincts the ladder needs (secrets, backups, devices). The
wizard's seed-education names Bitwarden deliberately; the dashboard should meet
managers where they are (import watch-lists, coexist, never demand migration day 1).
The funnel is trust-first: BNR sits beside the manager until it earns the vault.

## 4 · Trezor UX (founder rulings, 2026-08-14 beta)

1. **All Trezors in the door** at 🐝 BEE (stock firmware, local bridge); breadcrumb
   trail to 👑 ROYAL GUARD via the free **Trezor bSAFE 7** firmware (our custom Safe 7
   build; naming is ours, not Trezor SAS's — clearance flagged). Wizard implements this.
2. **Trezor holders never see a seed step.** The device ran its own seed ceremony on
   its own screen at setup. Asking again is redundant AND a fresh harvest surface —
   the skip is itself a security feature and the wizard records it as a gauge
   ("recovery lives on your Trezor — we never ask, ever"). Implemented.
3. **Our wallet/dashboard replaces Trezor Suite** progressively; firmware upgrade is
   offered when trust is earned ("flash later from your dashboard — same wallet,
   never a restart"), never gated at the door.
4. **The Safe 7 color touchscreen is an optical TRANSMITTER.** Firmware-lane
   candidate (bSAFE 7 vNext): the device DISPLAYS the signed transaction as a QR on
   its own screen — the phone camera scans it — making the signing loop fully
   optical with **no cable and no host trust**: what the device shows is what the
   device signed, on a screen no host software can repaint. (Return leg host→device
   stays cable/NFC per hardware capability — UNVERIFIED what Safe 7 ships; verify
   before speccing.) This is the founder's "light/pixel in my Trezor" instinct,
   grounded: prior art exists (QR-signer wallets), ours adds the granted-set.

## 5 · Seed-harvest immunity (the doctrine, stated plainly)

Founder directive: defend against exotic seed-extraction — shoulder cameras, remote
viewing, EEG/hippocampal recall harvesting — and ignore expert scoffing. The sound
engineering position needs no stance on any mechanism, because the defense is
mechanism-independent:

> **A secret that is never rendered — on a screen, on paper, or in a human memory —
> cannot be harvested from any of them.** Immunity = removing the rendering, not
> hardening it. (Unnameable beats forbidden, applied to the human channel.)

The ladder, by rung:
- **🐝/👑 Trezor:** seed born on-device, shown once on the device's own screen at
  setup, never by any BNR surface (ruling §4.2). With granted-set firmware, even a
  fully harvested seed phrase cannot make the DEVICE sign outside the pre-approved
  set — and PoU/PoL (below) gates the identity layer above it.
- **📷 Air-gap phone:** key born on the offline device; only PUBLIC material ever
  crosses as light (§3 directional law). Nothing to harvest from the channel.
- **🔑/🛡 Passkey/FIDO2 (the floor):** the BIP-39 phrase EXISTS here — it is the
  written-code floor, the one recovery a person with a single device and no money
  has, and it stays (law). Mitigations: display-once + confirm-before-activate
  (built); education that steers to encrypted managers over memorization (built —
  memorized seeds are precisely the hippocampal-harvest surface, so **"don't
  memorize it, store it"** is both the friendly and the paranoid advice); and the
  ladder itself — the climb OFF the phrase-floor to device custody is the cure.
- **PoU/PoL (biometric proof-of-uniqueness/life):** the countermeasure to REPLAY of
  anything harvested: a phrase alone must never move an identity — liveness +
  uniqueness gates recovery/rotation, so a harvested secret without the living human
  is inert. (Design intent; biometric ledger timeline per its own spec.)
- **Optical liveness (research lane):** the light channel can carry a per-ceremony
  visual nonce — the trusted screen's pattern must appear inside the camera capture
  the signer signs over, binding "this signature happened HERE, NOW, in front of
  THIS screen." Cheap, novel, ours. Worth a spike after the encoder lands.

## 6 · Stack posture (founder directive, standing)

Server is a **bootstrap crutch**. Surfaces: htmx/Alpine-class decor over zero-network
HTML (both wizard and receiver run from `file://` except the camera's secure-context
requirement); relay = today's convenience; the destination stack is
Autonomi/Arweave/Vaulta/x0x/buzzBmeshAsi where ceremonies travel as light and mesh,
and the server disappears. Every surface must degrade down that ladder gracefully.

## 7 · Open items
0. `bcomb` crate scaffold (§2b): hex lattice geometry + luminance coding + golden
   vectors first, visuals second. Clean-room boundary doc before any decimen reading.
1. Sender-side QR encoder: vendor-or-write decision (zero-dep, MIT-clean, offline).
2. iOS decoder: vendored WASM pick + audit (the decimen RAID flagged codec supply-chain).
3. Safe 7 hardware I/O inventory (NFC? camera? — UNVERIFIED) before §4.4 spec.
4. "Trezor bSAFE 7" naming clearance.
5. PoU/PoL ↔ recovery binding spec (which ceremonies REQUIRE liveness).

---

## 8 · MULTI-CHANNEL PROXIMITY — light + BLE + NFC + WiFi (founder direction 2026-08-15)

> *"combining BT/NFC/wifi for additional multifactor authentication; this will be
> great for Ai. you want to solve sybil attack; trust me."*

**Why this is the strong path: none of it is biometric.** No body data, no
template, no gallery, nothing crosses the BIND-1 seam — so `BIO-1` (B-1…B-5) and
`PERSON-1` P-3 are untouched, and the sybil work proceeds without a doctrine
amendment. Proximity is a property of *physics and place*, not of a person's body.

### 8.1 What each channel actually proves (different physics = different attack)

| channel | range | proves | its attack |
|---|---|---|---|
| **light (bLiGhTbeAM)** | line-of-sight, m | "I could SEE that screen" — directional, needs an unobstructed path; a remote attacker cannot see the room | camera relay of a filmed screen |
| **NFC** | ~4 cm | "I TOUCHED it" — the strongest proximity claim available | hardware relay (two radios, one operator) |
| **BLE** | ~10 m | "I was near, and here is the RSSI trace over time" | amplifier relay; RSSI spoofing |
| **WiFi (scan only)** | ~50 m | "I saw the same access points you did" — a room-scale fingerprint, no association or internet needed | AP-list replay if stale |

**The fusion rule that defeats all four attacks at once: issue the challenge on
one channel, require the answer on another.** A relay must now defeat *every*
channel simultaneously, in real time, in both directions — light AND radio AND
touch. Each is individually beatable; the conjunction is not, and the cost of
beating it scales with the attacker's physical presence, which is exactly the
quantity a sybil attacker cannot mass-produce.

### 8.2 The co-presence graph — the part that actually kills sybils at scale

At a 100k-person event every device sees: the same **beam** (one LED wall,
infinite multicast), the same **WiFi BSSID set**, and each other's **BLE
advertisements**. Each device can therefore attest: *"at time T, in this
radio-and-light environment, I witnessed N other distinct devices."*

That is a **witness graph built from physics** — and it feeds `PERSON-1`'s T3
cascade (peer attestation) rather than competing with it: the cascade already
rules that uniqueness rides on presence + months + peers. Multi-channel
proximity makes each "presence" claim *machine-checkable* instead of purely
social. **Nothing here is a uniqueness oracle on its own** — B-2 holds; it is
evidence that feeds the tier that already owns the question.

### 8.3 Distance bounding — CORRECTED 2026-08-15, the previous text was wrong physics

**The claim this section used to make was false and is deleted, not softened.** It
read: *"The relay attack is defeated by round-trip timing… Light + NFC are the two
channels where this is sharpest."* Light rendered on a **display** cannot bound
distance, and the error is not one of implementation quality — it is six to seven
orders of magnitude.

Bounding distance requires the timing quantum to sit below the light-travel time
being resolved. One metre of separation is **6.67 ns** round trip. One bComb frame
period at the shipped clock is **240 ms = 2.4×10⁸ ns**, coarser by a factor of
**3.6×10⁷**. Put as range: a single frame of timing ambiguity spans
c × 0.24 s ≈ **36,000 km** one way, against an Earth circumference of 40,075 km.
Even a heroic 1 ms end-to-end resolution — far beyond a camera pipeline plus a
display refresh — still admits a relay **150 km** away.

The practical side is worse. An honest run has multi-second variance *by
construction*: one beam-CRC failure raises `confirmAt` from 2 toward 5
(`surfaces/blight/bcomb.js`), a 2.5× dwell multiplier, on top of hand shake, focus
hunting, and the auto-exposure drift already measured washing out real captures. A
bound loose enough not to false-reject honest users sits at **tens of seconds**. A
pipelined relay needs **0.1–0.4 s**.

**And no bound is implemented.** §8.5 says nothing in §8 is built; that remains
true. **Today the rail has zero relay detection**, and no surface may imply
otherwise.

What can actually bound distance:

| primitive | resolution | on a Safe 7 |
|---|---|---|
| **UWB secure ranging** (802.15.4z, cryptographic STS) | ~1 ns → 15–30 cm | the only consumer-grade primitive that delivers it — and **the Safe 7 does not have it**. New silicon both ends. A purpose-built beacon could carry it |
| **NFC near-field coupling** | ~4 cm, physics-limited | a genuine anti-casual proximity gate, worth having — but **hardware-relay-able**, so never sell it as distance bounding. NFC pairing is `__debug__`-gated on this device |
| **BLE RSSI** | none | defeated by a ~$50 amplifier, the class that defeats keyless car entry. Not a factor. §8.1's own table already concedes this |
| **light on a display** | 240 ms → ~36,000 km | **cannot bound distance.** `issued_at`/`answered_at` stay, as a *replay freshness window only* — which is what they can honestly do |

Spec item, corrected: every ceremony records `issued_at` / `answered_at` on the
*issuer's* clock and refuses stale answers. That is **replay freshness, not
proximity**, and it must be described that way everywhere it appears.

### 8.4 The AI case (founder: "great for Ai")

An agent needs to know a **human device was physically present when this was
authorized** — without knowing *who*, and without a biometric. Multi-channel
proximity gives exactly that shape: the agent issues a challenge as light, the
human's device answers signed over BLE/NFC inside the timing bound, and the
agent holds a receipt that says *present, live, in this room, at this moment*.
Identity stays the user's key; presence is the physical claim; neither is a body.

### 8.5 Build order (nothing here is built yet)
1. **Timing bound** on the existing optical ceremony (cheap; issuer-clock only).
2. **BLE answer lane** — the Safe 7 BLE work (goose's §5 matrix) is the same radio.
3. **WiFi-scan fingerprint** — browser cannot scan APs; needs the wearable/native
   surface. Note as PLANNED, never implied in a web build.
4. **NFC tap** — Web NFC is Chrome-Android only; honest ABSENT elsewhere.
5. **Co-presence attestations** — the graph, once 1–4 produce signed artifacts.
