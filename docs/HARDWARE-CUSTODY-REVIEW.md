# Hardware Custody Review — the Full Ladder, Open Hardware First
### For the BNR/bDiD stack · prepared 2026-08-18 · air-gap primer included

**Scope.** Every hardware signer worth considering for the custody ladder, judged on the axes that matter to this stack: openness (firmware, hardware, secure element — three separate questions), air-gap modality, interop with the optical ecosystem, fit with the multi-rail design (Vaulta/AR/ANT and friends), FIDO2/passkey-rung support, and price-to-reach. "Largest users" is read both ways deliberately: the **largest number** of users (the $0–$79 rungs decide that) and the **largest holders** (the multisig quorum section decides that).

**First, the correction from your own tree.** The original optical tool is **decimen** (decimen.app — your raid dispatch `RAID_DECIMEN_OPTICAL_TRANSFER.md` already contains the definitive take/leave). What Claude Code built from it, **bComb**, is not a copy — it's a different animal: a 127-cell hexagonal luminance-only frame format, `no_std`/no-alloc **so it compiles into Trezor firmware**, 8 bytes per frame with CRC-8 per frame and CRC-32 per beam, honest about its rate (~73 B/s at 7 Hz in v2; the "~420" brand figure is v1's bits/sec, now a floor — never to be conflated with decimen's 418.5 KB/s dense-QR record). The astute part is the `no_std` constraint: it means the *device screen* can beam, not just the browser. That's a capability none of the commercial wallets below ship.

---

## 1 · The air-gap primer you asked for

An air-gapped signer never touches a network or a cable during signing. The unsigned payload crosses to the device by a one-way-inspectable channel, gets displayed and approved on trusted hardware, and the signature comes back the same way. Four modalities exist in the wild:

**Animated QR (optical).** The dominant standard is **BC-UR** (Blockchain Commons Uniform Resources): CBOR payloads, bytewords encoding, and fountain-coded multi-part QRs — the decoder finishes from *any sufficient subset* of frames, so a dropped frame never stalls the transfer. Keystone, Passport, SeedSigner, Krux, and Jade all speak UR; Sparrow/BlueWallet/Nunchuk speak it on the software side. Coldcard notably went its own way with **BBQr**, a separate animated-QR format — a live example of why settling your framing standard early (G3 on the sprint map) matters. Optical is the most trust-minimized channel: no radio, no pairing state, a human can *see* the entire attack surface.

**microSD sneakernet.** Files (PSBTs) carried on a card. Robust, high-capacity, but the card is a bidirectional USB-class device with firmware of its own — a subtler surface than photons.

**NFC.** Tap-to-transfer. Convenient, short-range, but radio nonetheless.

**BLE with an encrypted channel.** Not air-gapped — but the Safe 7 (Noise-encrypted THP) and Passport Prime (QuantumLink) both take the position that an *authenticated, encrypted, user-confirmed* radio channel is acceptable for convenience tiers. Your two-tier model already encodes the right answer: radio for light value, optical for heavy.

**Where your three optical assets sit** (this is the piece to keep straight as the stack hardens):

| Channel | Rate | Role |
|---|---|---|
| **BC-UR animated QR** | ~0.1–3 KB payloads, seconds | *Interop* — signing flows with every third-party wallet and signer; the ceremony wire format |
| **decimen** (self-hosted, unmodified — per the raid dispatch's AGPL analysis) | up to ~100s of KB/s | *Bulk air-gap file transfer* — firmware images, journals, big receipts between machines |
| **bComb** | ~73 B/s, 512 B/beam | *Firmware-native beam* — the Safe 7/bSAFE screen itself transmitting; identity-sized payloads; the brand channel |

They are complements, not competitors: UR where the ecosystem must understand you, decimen where bulk crosses the gap, bComb where the *device* is the sender. The one hygiene rule from your own dispatch worth repeating: decimen's hash gate is integrity, not authenticity — anything identity-shaped that crosses any of these channels needs Ed25519 verification against a key the receiver already trusts, plus a receiver-generated challenge for freshness. The engine's `verifyRecordSig` (R1b-strict) is exactly what should sit at that gate.

---

## 2 · The review — device by device

### The anchor (already chosen, validated here): Trezor Safe 7 / bSAFE 7 — $249
Three hardware layers: **TROPIC01** (Tropic Square) — the first secure element whose design external researchers can actually audit — plus an Infineon Optiga EAL6+ SE, plus an STM32U5 MCU. Fully open firmware (your fork exists), first Trezor with BLE, USB-C, and a committed post-quantum path (**SLH-DSA-128**) — which lines up directly with the 1,000-year horizon in a way no competitor has committed to. FIDO2 on-device, so the Safe 7 can *also* be the passkey rung's authenticator.

Honesty requires the flip side: Ledger's Donjon lab executed a **laser fault-injection attack against TROPIC01 in January 2026**, publicly disclosed by Trezor in June 2026. Read that the right way — the *point* of an auditable SE is that attacks surface in public and get fixed in the open, versus closed SEs where you simply never hear. But it means the anchor's defense-in-depth (three layers, on-device confirm, passphrase) is load-bearing, not ceremonial. **Verdict: anchor confirmed.** The fork tax (rebase cadence, fido2-tests + user-env regression net) stays the standing risk from the sprint map.

### The budget open rung: Trezor Safe 3 — ~$59–79
Same open firmware lineage, Optiga SE, USB only, no touchscreen. As the *cheapest fully-open-firmware commercial signer*, it's the natural "first real hardware" step above the spare-phone rung, and it runs the same FIDO2 stack — meaning the passkey rung and the hardware rung can be the same $59 object. **Verdict: include** as the mass-reach commercial rung.

### The sovereignty-maximal rung: SeedSigner — ~$50 DIY (and Krux, ~$35–65)
SeedSigner is the purest expression of your doctrine on the market: **stateless** (holds no secrets at rest — the seed enters per-session via QR/dice/camera entropy), built from **commodity parts** (Pi Zero + camera + screen) that no customs form or supply-chain adversary flags as a wallet, fully open source, QR-only air-gap, ~$50 self-assembled. Krux is the same philosophy on K210-class hardware with its own firmware. Limitations, stated plainly: Bitcoin-only, no secure element (statelessness *is* the answer to that), no FIDO2, and someone must build it. But for skaists — a festival community — **SeedSigner build parties are an onboarding ceremony waiting to happen**: a table, $50 of parts, an afternoon, and a person leaves holding a signer they assembled with their own hands and can verify to the last line. Nothing else on this list converts "meet people where they are" into physical culture like that. **Verdict: include, enthusiastically**, as the DIY rung and the multisig diversity leg.

### The premium open-air-gap rung: Foundation Passport Prime — $349 (and Passport Core, ~$259)
The most architecturally interesting device of 2026, and the closest cousin to your stack: **KeyOS is a Rust microkernel OS built on Xous**, sandboxed apps over message passing, each app receiving a *hardened child seed* rather than master-key access — the same "context-scoped derivation below one root" shape as your persona nullifiers. Hardware under **CERN-OHL-S v2** (genuinely open hardware, not just schematics-published), GPL firmware, QR camera + microSD air-gap, NFC card backups with 2-of-3 Shamir, **FIDO2 security key support**, TOTP, released March 2026. It's the only device besides Trezor covering both the wallet rung and the passkey rung. Priced for the committed, not the masses. **Verdict: include** as the premium rung and the second leg of high-value multisig — and put **KeyOS on the raid's reading list**: an open Rust microkernel treating "apps get child seeds, never the root" as OS law is prior art for exactly what bSAFE 7's firmware architecture wants to become.

### The multi-chain air-gap rung: Keystone 3 Pro — ~$119–149
The pragmatic pick for your multi-rail reality: QR/BC-UR native, broad chain support (EVM, Solana, and the long tail — closest match to the 13-rail table), open application firmware **including the secure-element firmware** (rare), three EAL5+ SEs, fingerprint unlock. Caveats: hardware only partially open, Shenzhen supply chain (relevant to users with specific threat models — your sources note it plainly), and no FIDO2. For the user who arrives holding six chains and wants one air-gapped device today, this is the honest recommendation. **Verdict: include** for the multi-rail rung; watch their firmware repo for Vaulta-adjacent chain support you could upstream rather than fork.

### The open-source-everything budget rung: Blockstream Jade / Jade Plus — ~$79–169
Fully open source down to the board, camera-based QR air-gap ("QR mode" runs it fully air-gapped), cheap, well-maintained. Its distinctive trade: **no secure element at all** — instead a "blind oracle" scheme where the key is encrypted to a rate-limited remote oracle (or run your own), so brute-force protection comes from the network rather than silicon. That's a real dependency (oracle reachability/custody) your custody-disclosure law (`RELAY_22 §5a` machinery) would want disclosed on the binding, which you can do — the crate already has the shape. Bitcoin/Liquid only. **Verdict: include-with-disclosure** as a budget open rung; the self-hosted-oracle variant is the interesting one for BNR (the kernel could *be* the oracle).

### The battle-tested BTC heavy rung: Coldcard Q / Mk4 — ~$169–249
The most air-gap-modality-complete device made (microSD + NFC + QR with camera on the Q, plus their BBQr format), dual SEs, deeply proven in Bitcoin multisig practice. Two honest caveats: the license moved away from OSI-approved open source after a public dispute (source-*visible*, restrictively licensed — exactly the distinction your license ledger cares about), and it's BTC-only with its own QR dialect. **Verdict: optional include** for Bitcoin-heavy users' multisig quorums; not a ladder rung BNR builds against.

### Briefly, the rest
**BitBox02** (~$149): clean open firmware, USB-only — adds no modality your ladder lacks; fine, not needed. **OneKey**: open-source multi-chain, air-gap variants exist; a Keystone alternative if supply or price demands. **Cypherock X1**: no seed phrase at all — key Shamir-split across NFC cards; a genuinely different recovery geometry worth one raid read, but young trust base. **NGRAVE ZERO**: QR air-gapped and EAL7-certified, but firmware not meaningfully open — fails the doctrine test. **Ledger** (all models): closed SE, and the **Recover** service established that firmware *can* extract seed material to third-party custodians — under your constitution's custody-disclosure law that's not a caveat, it's a disqualification for the sovereign ladder. Name it in the UI the way you name unavailable rails: excluded, with the reason stated. **Tangem and card-style wallets**: closed silicon, no display for verification — no.

### The long-horizon strategic note: open silicon
TROPIC01 shipping in a mainstream wallet is the start of something your 1,000-year goals should track: auditable secure elements as commodity parts. The same current runs through **Precursor/Xous** (the ancestor of Passport Prime's KeyOS) and open-FPGA secure enclaves. A future **bee-native device** — bComb beaming from its screen, TROPIC01-class auditable silicon, KeyOS-style child-seed OS, built like a SeedSigner from parts anyone can buy — is no longer science fiction; every ingredient now exists in shipping products. Not this sprint, not this year; worth a standing line in the roadmap.

---

## 3 · The assembled ladder (price → rung → role)

| $ | Rung | Device | Tier fit |
|---|---|---|---|
| $0 | Spare phone, optical | decimen/bComb + your onboarding surface | T-F larva → light custody |
| $0 | Written 24 words | paper (+ optional metal plate later) | the floor, always mandatory |
| ~$50 | DIY stateless signer | SeedSigner / Krux (build-party rung) | T4-adjacent, multisig leg |
| $59–79 | First open commercial | Trezor Safe 3 (also the FIDO2/passkey object) | T4 |
| $79–169 | Budget open / multi-chain air-gap | Jade Plus (disclosure: oracle) / Keystone 3 Pro | T4, multi-rail users |
| $249 | **The anchor** | **bSAFE 7** (Trezor Safe 7 fork) | **T5** |
| $349 | Premium open air-gap | Passport Prime (KeyOS) | T5-grade second leg |

**For the largest holders:** no single device, however open, should hold a life-changing balance alone. The recommendation is a **mixed-vendor multisig quorum** — e.g. 2-of-3 across bSAFE 7 + Passport Prime + SeedSigner — so no single firmware lineage, secure element, or supply chain is a single point of failure. All three legs speak QR, so the quorum can be exercised fully air-gapped. The T3 docket's countersign ceremony (fingerprint words on the T5 screen) extends naturally to quorum enrollment.

**For the largest number of users:** the ladder's gravity is at the bottom — the spare-phone optical rung and the $50–79 devices — and the doctrine holds at every step: same bDiD at every rung, climb without restart, every refusal named.

## 4 · Actions this feeds back into the sprint map

UR framing (G3) gets one addendum from this review: Coldcard's BBQr divergence is the cautionary tale — adopt UR, and if Coldcard support ever matters, treat BBQr as a second decoder, never a second sender format. WS-6's tier policy gains the quorum case (multisig enrollment as a T5 ceremony). And two reading-list items for the raid: KeyOS/Xous architecture notes (child-seed OS law), and the TROPIC01 fault-injection disclosure thread (what "auditable SE" buys and doesn't). Everything else — the fork tax, the fido2-tests net, the authenticity-root gap — is already on the map and unchanged by anything here.
