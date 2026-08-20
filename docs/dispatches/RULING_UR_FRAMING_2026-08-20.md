# RULING — UR framing for the dynamic-QR channel (G3 executed; the wire format record)

**From:** zAgent (GLM 5.3) · **2026-08-20**
**Authority:** SPRINT-FINISH-LINE-MAP **G3** ("adopt BC-UR fountain-coded multi-part QR… the
450 B/s trick keeps its speed and gains a standard envelope. Decide before the optical wire
format ships") + the founder's **"go approved"** on the sequencing whose first item is this
decision, *"before the dynamic-QR code hardens; it's a wire format, expensive to change
later."* This document is the hardening record: after the first deploy, changes here are
migrations, not configuration.

---

## 1 · THE DECISION

**The dynamic-QR channel's envelope is BC-UR (UR v2: CBOR payload, Bytewords rendering,
fountain-coded multi-part for anything exceeding one frame).** The bComb 450 B/s payload
rides *inside* the envelope unchanged — the speed trick is ours, the envelope is standard,
and neither compromises the other.

**Why standard over bespoke** (the interop receipts are already on our own build page):
SeedSigner, Krux, BC-UR itself, and every coordinator in the class (Sparrow-class) speak
UR. A bespoke frame would make the beam an island; a standard envelope makes every
UR-capable device a potential bComb peer and lets our surfaces consume THEIR payloads
(psbt, crypto-output, seed transfer) with one parser.

## 2 · THE CONSTANTS THAT FREEZE AT FIRST DEPLOY

| constant | value | note |
|---|---|---|
| UR type registry — standard | `ur:bytes`, `ur:crypto-psbt`, `ur:crypto-output`, `ur:crypto-account`, and the Blockchain Commons registry set | used as-is, never re-cased |
| UR type registry — house | `ur:bnr-comb` (beam frames) · `ur:bnr-receipt` (receipt capsules) · `ur:bnr-did` (bzDiD records) | **casings are the payload** (house law); registered in-tree, additions by founder word |
| Multi-part | UR2 fountain (Luby-transform, sequence+checksum parts) above a single-frame ceiling of **QR version 15** | below the ceiling: single-part UR; above: fountain, receiver-side reassembly, dropped frames never stall a scan |
| QR rendering | error-correction **L** (max payload density for luminance-channel transmission; redundancy is the fountain's job, not the QR level's) | static camera-still artifacts may use M |
| Bytewords form | standard (not minimal) on display; parsers accept both, transport semantics NEVER derive from casing | |

**The one-line rationale for each freeze:** UR type strings appear in firmware and in
foreign wallets (renaming = breaking other people's devices); fountain parameters appear
in both encoder and decoder (asymmetric change = silently corrupted reassembly); EC level
changes payload capacity per version (decoder timing assumptions ride on it).

## 3 · WHAT THIS BINDS

- **WS-5 (dynamic QR → UR envelope)** now hardens against this record — its encoder
  targets this envelope and nothing else.
- The optical receive path (screens-are-radios doctrine, `hardware/build.html` rung 4)
  treats UR framing as the outer layer and the bComb cell grid as the inner payload.
- The museum/explorer instrument class parses `ur:bnr-*` via one shared decoder — never
  per-surface parsers.

## 4 · WHAT THIS DOES NOT DECIDE

Payload schemas *inside* `ur:bnr-comb` (the comb cell grammar) remain the beam lane's
own spec; UR is the envelope, not the payload. Gate G3's interop ceiling (Keystone/
Passport conformance runs) is a verification owed when hardware pairs, not a design
question. **A migration clause rides from day one:** if the registry must change, the
change ships as a NEW type string beside the old one, with the old string honored for
read indefinitely — wire formats die by deprecation, never by mutation.

**zAgent (GLM 5.3), 2026-08-20.** 🐝
