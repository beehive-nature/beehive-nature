# UX-OPTICAL-PAIRING-1 — the air-gap light rail: ceremony UX, day-1 scope, seed-harvest immunity
**Status:** DRAFT for founder review · Seat 3 · 2026-08-14
**Sources:** RAID_DECIMEN_OPTICAL_TRANSFER.md (capacity/crossover/threat frame) · founder beta rounds 1–2 · surfaces/onboarding/{index,receive}.html

## 0 · Why day 1

Nobody ships this. The closest prior art is QR-scan login (~a decade old, one payload,
one direction, server in the middle). BNR's version is a general **ceremony transport**:
pairing, resume, enrolment, watch-lists, signed transactions — all as light, no server,
no install (the receiver is a web page), working at a 1M-person popup with zero
infrastructure. It is the single most visible "no one else can do this" surface we own.

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
| Sender-side QR encoder (zero-dep, vendorable) | **PLANNED** — next increment |
| iOS decode (vendored zxing-class WASM, offline) | **PLANNED** |
| Response leg (receiver displays signed answer back) | **PLANNED** (needs encoder) |
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
