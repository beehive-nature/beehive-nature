# BSAFE-DEVICE-1 — Seed Spec: the Bee-Native Sovereign Device
**Status:** SEED — design inputs for the raid, not a ruling. Founder-class gates listed in §8.
**Reads with:** `docs/biometric-uniqueness-ledger.md` (the governing analysis), `crates/attestation-core`, `crates/onboarding`, `dockets/T3_device_enrollment_flows.md`, `dockets/TIERED_ACCESS_attestation_design.md`, `crates/bcomb`, the bSAFE 7 firmware fork, HARDWARE-CUSTODY-REVIEW.md, SPRINT-FINISH-LINE-MAP.md.
**Cryptography doctrine (ratified 2026-08-18):** measure every choice against David Irvine's practice — boring, decades-tested primitives; invent protocols and formats, never primitives; self-authentication (identity derived client-side from what the human holds, no authority consulted). This spec contains zero novel cryptography by construction.

---

## 1 · Mission

One device family, built like the Safe 7 and beyond it: everything the Trezor Safe 7 has (auditable TROPIC01-class SE, open firmware, BLE, on-device confirm), plus the sensing surface the BNRoSe vision needs — so that a person can pick up any device, exchange a few flashes of light with a camera, and be authenticated into the decentralized stack as one soul in ten billion, **without any biometric ever becoming a key, leaving a device, or entering a gallery.**

The felt experience is "the light knows me." The architecture underneath is: photons carry a *signed, challenge-bound session assertion*; biometrics *unlock locally and prove liveness*; uniqueness was proven *once, at enrolment, by an oracle that publishes nothing.* Three jobs, permanently separated. This separation is the load-bearing wall of the whole device; every section below assumes it.

## 2 · The Identity Law (inherited, restated as device law)

1. **The bDiD is the self-certifying digest of the genesis op. Nothing on this device is the identity.** Keys authorise; sensors attest; the root outlives every component (Article II; `crates/onboarding` doctrine).
2. **No biometric is ever key material.** No fuzzy extractors, no template-derived keys — a key you cannot rotate is a key you cannot keep for 1,000 years, and matchability *is* the leak (biometric-ledger §"the load-bearing idea"). Biometrics gate the *release* of keys held in the SE, Face-ID-style, on silicon the owner can audit.
3. **No biometric ever leaves the device.** Templates live in the SE's sealed storage; what travels is an attestation: "liveness passed, method M, coverage C, at t," signed by the device key. The uniqueness oracle sees enrolment measurements only through the AMPC protocol the ledger doc specifies, returns a boolean, publishes nothing, retains nothing matchable.
4. **Merge/duplicate resolution is user-initiated and cryptographically proved** (prove control of the prior root with its passkey/phrase), never oracle-initiated — this kills the poisoning-attack class outright (ledger §merge).

## 3 · The Three-Lane Sensor Law

Every sensor on the device or a paired wearable is assigned to exactly one lane at design time. **A sensor may not change lanes at runtime, and no reading crosses lanes.** Lane assignment is a spec change, reviewed like a consensus rule.

**Lane A — MATCH (high-entropy, stable, slow-changing).** Iris (NIR), vein map (palm/finger, NIR), face geometry. Used for: local unlock (template in SE, matched on-device) and the one-time uniqueness enrolment via AMPC. AND-fusion only within this lane, per the FAR budget at 10^10 humans.
**Lane B — PRESENCE (dynamic, high-variance, defined by intra-subject change).** Heartbeat signature (ECG/PPG), rPPG from camera, EDA, gait from wearable IMU. Used for: **liveness and continuous presence only** — "a living human, the same one who unlocked, is still holding this." Never fused into matching (a ~20% FNMR channel adds evasion probability and zero discrimination — ledger §dynamic-biologics). Lane B is what defeats the photograph, the mask, and the sleeping-owner attack; it is the honest home of the "reflected photon signature."
**Lane C — WELLNESS (telemetry about the body, not about identity).** Photo-serum optics (SpO₂, hemoglobin estimation, glucose-adjacent signals as sensors mature), HRV, temperature, sleep/activity from wearables. Sealed to a persona with `DisclosureMode` per binding (default Selective), never touching the identity path — enforced the same way `age` containment already is: the identity code cannot name Lane C's types, proven by a containment test. Lane C is also the research lane (§7), and it is consent-gated *per study*, not per device.

**Regulatory note (Lane C):** serum-analysis claims (glucose especially) walk into medical-device territory in every jurisdiction that matters. Lane C ships as sandboxed *apps* with their own attestation of coverage — `attestation-core`'s `Eligibility::NotDetermined` doing exactly its job — so the device never makes a medical claim the app didn't prove.

## 4 · The OS Law — child seeds, never the root

Adopt the KeyOS/Xous demonstration as law: **a sandboxed app receives a hardened child seed derived for its context; no app, ever, touches master key material.** This is the persona-nullifier pattern (`PRF(seed, context)`, already in the engine as `deriveRecordKey`/`personaNullifier`) promoted from library convention to operating-system enforcement. A Lane C glucose app is *structurally incapable* of signing a spend; a Lane A matcher is structurally incapable of exporting a template. Message-passing microkernel (Rust; Xous is the proven open ancestor), every app open-source and reproducible as a catalog condition.

## 5 · Hardware Baseline

Safe 7 parity: TROPIC01-class auditable SE **plus** an independent certified SE (defense in depth — the Jan-2026 TROPIC01 fault-injection result is why two heterogeneous elements stay mandatory), open MCU (STM32U5-class or better), USB-C, BLE with Noise-encrypted THP, Qi2, on-device confirm screen. Additions, in priority order:

1. **NIR-capable camera** (Lane A iris/vein + QR/UR/bComb receive) with a hardware shutter/indicator — the camera is also an attack surface; the owner must be able to *see* it's off.
2. **PPG path** (Lane B/C) — rear optical window or wearable delegation.
3. **A screen bright and fast enough to beam** — bComb is `no_std` for exactly this; the device is a first-class optical *sender* (~73 B/s identity payloads today; screen/camera ceiling is a bench question, not a spec question).
4. **RAM/flash headroom** — sized for on-device matching, the app sandbox, and mesh buffering; "bigger RAM" is a real requirement, exact number set by the Lane A matcher's memory floor, measured not guessed.
5. **ECG electrodes** (Lane B) — bezel-touch, as smartwatches do, if the industrial design allows without compromising the seal.
6. **UWB or BLE-ranging** (optional, later) — proximity binding for wearable delegation ceremonies.

**Openness floor (non-negotiable):** CERN-OHL-S v2 for hardware, GPL-family for firmware, reproducible builds, no component whose datasheet requires an NDA to audit the security path. Commodity-parts bias wherever the threat model allows — the SeedSigner lesson: a device anyone can build is a device no chokepoint can ban.

## 6 · Wearables — the delegation mesh

Wearables (ring, watch, bracelet, necklace, xyz) are **T3/T4 evidence sources and light-value signers, never roots.** Each enrolls per the T3 universal shape: keygen in its own keystore → evidence → **countersigned by the T5 anchor** (fingerprint words on the anchor's screen) → delegation with a ceiling ("this ring can attest presence and approve up to X/day; it can never...") → re-attestation on cadence, quiet decay to T1 on miss. A wearable's continuous Lane B stream is what lets the phone-tap moment be instant: presence was already warm. Loss of a wearable is a non-event — revoke the delegation, the root never moved. Integration order: watch (ECG+PPG+IMU, the richest honest signal) → ring (PPG, wear-time) → open-hardware candidates first (watch: PineTime/Bangle.js-class as dev targets; ring: the open-firmware field is thin today — an honest gap the education surface (§7) should aim students at).

## 7 · The Festival Proving Ground

Massive EDM festivals are the design-pressure environment: hundreds of thousands of humans, no reliable network (mesh required), high-value moments (payments, access, safety), and a temporary micro-economy that resets — the ideal sandbox for a socioeconomic wellness study. Device requirements this forces: offline-first everything (optical + mesh, chain reads deferred), sunlight-legible beam, battery honesty, and consent ceremonies that work in a crowd at night. Research data (Lane C aggregate) is monetized **only** through the study's consent artifact: per-study opt-in bound to a persona nullifier, raw data sealed, aggregates sold, participants paid in the same economy they generated — the study inherits RELAY_22's disclosure law wholesale. Case studies for the education surface: EDC Las Vegas and Tomorrowland Belgium (scale, wristband/RFID prior art — closed systems to study and surpass, not emulate).

## 8 · Founder-class gates (no seat can settle)

**FD-1** Does a bee-native device get built at all, vs. bSAFE-forking successive Trezor generations forever? (This spec is useful either way — §2–§4 and §6 govern the fork too.)
**FD-2** Lane assignments ratified as consensus-grade law (the table in §3, especially heartbeat-in-B-never-A).
**FD-3** The uniqueness oracle's operator model (threshold committee composition) — the ledger doc's open question, unchanged.
**FD-4** Lane C monetization consent artifact — per-study text, payment split, and whether aggregate sale requires a community vote per study.
**FD-5** Wearable vendor floor — open-firmware-only (thin market today) vs. attest-what-you-can from closed wearables with custody disclosed (RELAY_22 §5a shape).

## 9 · Build order (each phase ends holding something real)

**P0 (now, no new hardware):** the three-lane law as types in a `crates/sensor-lanes` skeleton + containment tests; wearable delegation objects in `crates/capability` (sprint WS-6 grows into this).
**P1 (bSAFE 7 as the lab):** bComb beam from device screen (the `no_std` crate exists — light it up); host-side Lane B rPPG liveness experiment against the phone camera, PAD-only, measured honestly.
**P2 (first wearable):** watch-class open device enrolled through T3, countersigned, delegated, revoked — the full lifecycle on stage hardware.
**P3 (silicon conversations):** TROPIC01-class SE + NIR camera module reference design; decide FD-1 with real BOM numbers.
**P4 (festival pilot):** a bounded deployment (one stage, one weekend, volunteers) of the study consent flow with Lane C sealed — before EDC/Tomorrowland scale is ever discussed.
