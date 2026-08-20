# The Trezor-Org Batch × bDiD Stack — Take/Leave Assessment

**Context:** 14 repos from github.com/trezor, assessed against the declared stack (Rust, htmx, SQLite, Alpine.js; b-indexers; ANT/AR/VAULTA rails) and the target signing topology — **bSAFE 7 (custom-firmware Trezor Safe 7) for heavy approvals, mobile for light-value work and wallet features**. Licenses marked ✓ were verified from cloned source; others are stated from general knowledge and flagged.

Most of these are Trezor's forks of upstream projects (nayuki's QR library, btleplug, noise-rust, evolu, mcuboot, sqlite-wasm) — Trezor forks what it ships on. That's a useful signal in itself: this list is roughly the bill of materials for a hardware-wallet host, which is exactly what your topology needs.

---

## The headline: this batch unblocks your own named blocker

`bdid-onboarding-design.md` §6, on Zano and the Safe 7: *"no third-party host speaks the Safe 7 wire protocol… Blocker to clear: a Safe 7-protocol-aware host **and** a coreapp firmware fork."*

You already have the firmware fork (bSAFE 7). This batch contains the host ingredients, all in Rust:

- **btleplug** (BSD-3-Clause ✓) — cross-platform BLE central: Linux/mac/Windows *and Android and iOS*. One library gives both the desktop surface and the mobile light wallet a BLE path to the Safe 7.
- **noise-rust** (public domain/Unlicense ✓) — Noise Protocol Framework, revision 34, vectors verified against snow/cacophony. The Safe 7's BLE transport (THP) runs an encrypted Noise channel; this is the host side of it.
- **trezord-go** (LGPL-3.0 ✓) — the reference USB bridge daemon. Not your long-term transport (Go, and upstream is folding transport into Suite), but the readable spec of the wire protocol while you build the Rust equivalent.
- **trezor-firmware** — already yours via the bSAFE 7 fork.

**A Rust bSAFE 7 host is the single highest-leverage project in this list.** It is what makes "approve/sign mostly with my Trezor" real from *your* surfaces (htmx/Alpine pages talking to a local Rust agent, kernel-side signing flows) instead of routing through Trezor Suite — and it is the same artifact your design doc says Zano signing eventually needs. It also serves the T3 docket directly: per-connection re-attestation, the TROPIC01 challenge-sign evidence path, countersigning by the T5 anchor — all of that needs a host you control.

---

## Take — by role in the stack

### Optical rung: QR-Code-generator (MIT ✓)
Nayuki's library, 6 languages — including **`rust`** and, critically, **`rust-no-heap`**: a no-allocator port that can run *inside firmware*, so bSAFE 7 itself can render QR frames on-device. That makes the air-gap loop fully yours: device screen → phone camera and back. Take both Rust ports; the TypeScript port covers the browser surface.

On the dynamic-QR trick (~450 B/s): the throughput is right for ~v20+ codes at a few fps. One strong recommendation before this hardens: **adopt BC-UR (Blockchain Commons Uniform Resources) as the frame encoding** rather than a custom chunking scheme. UR's fountain-coded multi-part QRs mean a dropped frame never stalls the transfer (the decoder finishes from any sufficient subset — big win at 450 B/s on a shaky phone camera), and it makes your optical rung interoperable with the existing air-gapped ecosystem (Keystone, Passport, SeedSigner). There are maintained Rust and TS implementations. The QR library stays; UR is the layer between your payloads and it.

Topology note: the optical path is your most trust-minimized channel — no radio, nothing to pair, malware on the host can't reach the device. **Prefer QR for the heaviest approvals and for genesis/recovery ceremonies; treat BLE as the convenience channel.** Your T3 docket's tier language already supports exactly this split.

### Local state: sqlite-wasm (Apache-2.0 ✓)
Official SQLite WASM with OPFS persistence — a direct fit for rust+htmx+sqlite+alpine: the onboarding surface and browser wallet get the *same* SQLite data model as the kernel-side Rust, instead of ad-hoc localStorage. Pair it with the encrypted-to-self pattern from the FileKey review (storage key derived from the identity, contents sealed to the user's own key) so wallet state at rest is unreadable without the passkey. Take.

### Sync between anchor and mobile: evolu (MIT ✓) — take the pattern, leave the framework
Evolu is local-first SQLite with E2E-encrypted sync where **identity and the sync key derive from a BIP39 mnemonic** — architecturally a sibling of your recovery model (the written phrase is the root; every device re-derives). But it's a TypeScript/React-ecosystem framework, which cuts against rust/htmx/alpine. Leave the dependency; steal the design: your mobile light wallet and Safe 7-anchored desktop syncing wallet metadata (contacts, rail address book, receipts) through an encrypted CRDT log keyed off the bDiD root, with any dumb relay in the middle. That's the "wallet features on mobile" story without a custody server.

### Test harnesses for bSAFE 7: fido2-tests (Apache-2.0/MIT ✓), trezor-user-env, data
This trio is your custom-firmware safety net, and it matters more *because* you run a fork:

- **fido2-tests** — FIDO2/CTAP2 conformance suite. Run it against every bSAFE 7 build so firmware changes never silently break the FIDO2/passkey rung. One item to verify explicitly with it: **hmac-secret / PRF behavior**, since the FileKey-style derivation rung depends on it and UV-vs-non-UV secret stability is exactly the class of thing a firmware fork can perturb.
- **trezor-user-env** — the dockerized emulator/test environment. CI for enrollment flows against your firmware with no hardware in the loop; the missing piece between "founder has a Safe 7 in hand" and repeatable regression tests. (License unverified — check before redistribution; internal CI use is unaffected.)
- **data** — the firmware/network-definitions registry your design doc already leans on (the exSat chain-7200 `network.dat`; the t3w1 `authenticity.json` that 404s). Two takes: vendor the definitions you depend on so a Trezor CDN change can't break onboarding, and — since **a custom firmware breaks the stock authenticity chain by definition** — stand up your own signed definitions + authenticity story for bSAFE 7 devices, using this repo's layout as the template. That 404 you documented means even stock t3w1 attestation is blocked on the vendor today; your fork needs its own answer regardless.

### Firmware substrate: mcuboot (Apache-2.0 — not cloned, high confidence), trezor-firmware
mcuboot is the secure-bootloader standard for the class of MCU that runs the Safe 7's BLE side. If bSAFE 7 touches anything on that co-processor, mcuboot's signed-update chain is the territory you're in — take as part of the firmware build/update toolchain, not as app code. On trezor-firmware itself, the real cost of the fork is **tracking upstream security patches forever**; set a rebase cadence and let fido2-tests + user-env be the regression gate. That maintenance loop is a 1k-year-goal issue in miniature: a fork that drifts is a fork that dies.

### Integration layer: trezor-suite — take one package, leave the app
Your design doc already routes exSat through Trezor Connect with a signed network definition. Take **@trezor/connect** (and the protobuf message definitions, which are the ground truth your Rust host must speak — `messages-ripple.proto` missing TrustSet, etc., all live here). Leave Suite-the-application; your surfaces replace it. Package licenses in the monorepo vary — verify @trezor/connect's before vendoring.

## Leave — with reasons

- **blockbook** (AGPL-3.0 — not cloned) as a dependency. It's Go against your Rust+SQLite focus, each chain needs a full backing node, and it covers none of your core rails — no Vaulta, no Hive, no AR/ANT, no Zano. **But take it as the reference spec for your b-indexers**: its xpub-level indexing is the proven answer to the problem your derive-all design creates (watching many addresses per user per rail, verifying arrival by chain read). If BTC-family rails ship in v2, running stock blockbook for just those may beat writing three indexers — a per-rail decision, not a stack commitment.
- **ln-vending** (GPL-3.0 ✓) — Node.js MDB-protocol vending-machine integration. Leave for the wallet stack. One honest flag before discarding: skaists is a festival economy, and a working LN-payment-to-physical-dispense reference is squarely a festival-marketplace primitive. Park it on the skaists side, not the identity side.
- **evolu as a dependency** — covered above; pattern in, framework out.
- **trezord-go as a destination** — reference while the Rust host is built, then retire it.

## How it maps to the two-tier signing model

The T3 docket already defines the shape; this batch fills in transports. **Heavy path (bSAFE 7, T5):** approvals via QR/UR air-gap (QR-Code-generator rust-no-heap on-device + UR framing) or USB; BLE via btleplug+noise as the convenience channel with per-connection re-attestation; every consent screen rendered from the actual capability list per §6. **Light path (mobile, T4):** delegation with ceilings ("send up to X/day") issued under the T5 countersign; sqlite-wasm + encrypted sync (evolu pattern) for wallet features; btleplug's mobile support means the phone can also *be* the QR camera and the BLE host for the Safe 7 when the two are together. The delegation objects themselves already have a home — `crates/capability` and the T4 matrix.

## Suggested sequencing

1. **UR framing decision** — before the dynamic-QR code hardens; it's a wire format, expensive to change later.
2. **Rust host spike** — btleplug + noise-rust + protobufs from trezor-suite, against trezor-user-env's emulator; goal: one signed message round-trip from an htmx surface.
3. **CI net** — fido2-tests + user-env wired to bSAFE 7 builds (with an explicit hmac-secret/PRF conformance check).
4. **Definitions registry** — vendor `data`, sign your own for the fork.
5. **b-indexer spec** — write it against blockbook's API surface as prior art, in Rust+SQLite.
