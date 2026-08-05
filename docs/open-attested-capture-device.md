# BNR open biometric capture device — specification

<!-- 7 agents: 4 survey (open hardware, attestation without a vendor CA,
     reproducible build + supply chain, continuous custody), 2 adversarial
     (key extraction, firmware substitution), 1 spec. 2026-08-04.
     [M] measured/cited  [D] derived  [E] estimate.
     VERDICT: open hardware delivers the full 50-170x and is the ONLY
     architecture that can — but the naive open answer (MCU-rooted key)
     is 300x WORSE than shipping nothing. The part choice is the design. -->

# BNR OPEN BIOMETRIC CAPTURE DEVICE — SPECIFICATION

Tags: **[M]** measured/cited · **[D]** derived from cited numbers · **[E]** estimate, verify before committing.

---

## 1. The verdict

**Yes — an open-hardware device delivers the full 50–170×, and it is the *only* architecture that can, because the 50–170× was never about the sensors. But the range of open outcomes spans 0.003× to 170× on a single part choice, and the cheap open answer is 300× *worse than shipping nothing*.**

The number, laid out:

| Architecture | Marginal cost to mint one fraudulent identity | vs. the $310 rented-human floor [M] | vs. unattested $3,000 baseline |
|---|---|---|---|
| No attestation (assembled spoof) | **$3,000** [M] | 9.7× | 1.0× (baseline) |
| **Open, MCU-rooted** (key in nRF52832 flash behind APPROTECT) | **~$10**, minutes each, infinitely scaling [M] | **0.03× — below the floor** | **0.003× — a 300× REGRESSION** |
| Open, discrete SE, no optical challenge | ~$10k–50k per die, destructive, non-scaling [E] | 32–160× | 3–17× |
| **Open, discrete SE + SE-owned rolling-shutter optical challenge** | **$150k–500k**, per-capture, non-scaling [M] | **484–1,613×** | **50–170×** |
| Apple SEP + iOS attestation | $150k–500k technical; **~$0 marginal via the provisioning line, and invisible** | — | 50–170× technical, **~0× social** |

Three things follow, and they are the whole design:

1. **The founder is right that attestation needs *a* secure element, not *Apple's*.** On key extraction, a $1.80 TROPIC01 and Apple's SEP sit in the same physical class: per-die lab work at $10k–50k+ that does not scale. Open loses nothing on extraction physics. The SEP's advantage was always policy.
2. **The founder's optical challenge is the load-bearing part, and it is why the MCU stops mattering.** An SE on an I²C bus with an MCU between it and the sensor attests *the MCU's claims*, not photons — the same MitM, relocated. Imposing the SE nonce as *illumination* puts it inside the pixel data, where a synthesized frame cannot contain it. That single mechanism is the difference between the 3–17× row and the 50–170× row, and it costs **$0.20/unit at 1M** (an SE-gated LED driver).
3. **The dominant attack is not technical.** Once the device is SE-rooted, the cheapest break is a dishonestly provisioned batch: one bribe at the line, normal BOM, ~$0 marginal per fake identity, perfect crypto on every unit. No amount of added cryptography touches it. This is where open wins *structurally* and closed cannot follow — see §3 and §6.

**Three corrections to the target basket, stated before anyone designs the wrong thing:**

- **Two irises at ISO/IEC 19794-6 resolution (≥200 px across an 11.5 mm iris) cannot come off a wrist.** The optics force ~200 mm standoff with a ~6 mm lens [D]. The basket is a **two-form-factor system**: a worn band (custody + PPG) and a shared handheld/kiosk head (iris + finger vein).
- **Every open smartwatch PPG front end on the market is green-only** (HRS3300, VC31B) [M]. No red, no IR, no 850/950 nm ratio test. Hard stop — one PCB spin required, not a firmware patch.
- **Use a rolling shutter deliberately.** Global shutter throws away the sub-frame timing channel that makes the optical challenge spatially encodable. The cheaper part is the more secure one here.

---

## 2. The BOM

Two units. **BNR-B1** (band, one per person, continuous custody + heartbeat). **BNR-H1** (head, shared, two irises + finger vein + optical challenge).

### BNR-B1 — worn band

| Function | Part number | 1-off | 1k | 1M |
|---|---|---:|---:|---:|
| MCU (non-security-critical by design) | nRF52840-QIAA | $10.00 (module) | $4.20 | $2.60 [E] |
| **Secure element** | **TROPIC01 `TR01-C2P-T301`** (eval: MIKROE-6559 Secure Tropic Click) | $30.00 | $3.00 [E] | $1.80 [E] |
| — closed alternate / second root | NXP SE050 or OPTIGA Trust M V3 | $12.00 | $2.60 [E] | $1.60 [E] |
| Optical AFE, 6 selectable wavelengths | **MAX86141** [M $10.37] | $10.37 | $6.50 [E] | $3.80 [E] |
| 850 nm emitters ×2 | Osram **SFH 4045N** | $0.80 | $0.44 | $0.18 |
| 950 nm emitters ×2 | Osram **SFH 4043** (alt Vishay VSMY2940) | $0.80 | $0.44 | $0.18 |
| Green emitter ×1 (equity fallback, see §5) | Osram SFH 4250 / any 525 nm | $0.30 | $0.15 | $0.06 |
| Photodiodes ×2 | Vishay VEMD8080 / Osram SFH 2440 | $1.20 | $0.70 | $0.30 |
| IMU (wake-on-motion interrupt source) | ST **LSM6DSO** | $2.50 | $1.60 | $0.85 |
| Thermistors ×2, 0402 NTC (skin/air gradient) | Murata NCP15XH103 | $0.20 | $0.08 | $0.03 |
| Strap-loop conductor + keyed clasp contacts | custom | $0.80 | $0.45 | $0.20 |
| Cell, 150 mAh LiPo | generic 401230 | $3.00 | $1.60 | $0.80 |
| **Custody reserve domain** (supercap or 2nd cell) | AVX SCM series | $1.20 | $0.70 | $0.35 |
| **On-wrist wireless charge** (clasp coil + Rx) | WLC1115 / BQ51013B + coil | $4.00 | $2.30 | $1.10 |
| PMIC, LDOs, crystal, antenna, passives | — | $3.00 | $1.60 | $0.75 |
| PCB (4-layer rigid-flex) + assembly | — | $25.00 | $6.00 | $1.60 |
| Enclosure, strap, **glitter-epoxy tamper seal** | — | $12.00 | $4.00 | $1.30 |
| **BAND TOTAL** | | **$105** | **$34** | **$16** |

Cap sense is an MCU peripheral — $0. The strap loop at $0.20 is the highest value-per-cent part in the device (§5).

### BNR-H1 — shared capture head

| Function | Part number | 1-off | 1k | 1M |
|---|---|---:|---:|---:|
| Application SoC (runs IRIS matcher, Apache-2.0 [M]) | Pi Zero 2 W → Rockchip **RV1103** at volume | $15.00 | $12.00 | $5.50 [E] |
| **Iris imager, NIR** | **IMX219** (Pi Camera Module 2 **NoIR** — IR-cut already absent) | $25.00 | $8.00 | $3.20 [E] |
| Lens, M12 ~6 mm f/2.0, IR-corrected + holder | — | $8.00 | $3.50 | $1.60 |
| 850 nm bandpass filter (ambient rejection) | Midopt BP850 / equiv. | $12.00 | $4.00 | $1.20 |
| Iris illuminator ×6 | Osram **SFH 4715AS** (alt Vishay VSMY2850) | $3.60 | $1.80 | $0.80 |
| **SE-gated LED driver** — the whole security argument | TPS61169 + SE GPIO enable | $0.90 | $0.45 | $0.20 |
| **Secure element** | **TROPIC01** | $30.00 | $3.00 [E] | $1.80 [E] |
| Finger-vein imager, NIR | OV2640 **night-vision variant** (no IR-cut) | $7.00 | $3.00 | $1.40 |
| Vein illuminator ×6 | Osram **SFH 4253-Z** 860 nm | $1.80 | $0.90 | $0.40 |
| Vein diffuser + finger channel optics | 3D print / molded | $2.00 | $0.80 | $0.30 |
| Eye-position guide, IR fold mirror | — | $6.00 | $2.50 | $1.00 |
| PCB + assembly | — | $30.00 | $8.00 | $2.00 |
| Enclosure (3D print → injection molded) | — | $18.00 | $6.00 | $1.80 |
| Power / USB-C / battery | — | $6.00 | $2.50 | $1.10 |
| **HEAD TOTAL** | | **$165** | **$56** | **$22** |

**Why IMX219 and not a global-shutter machine-vision sensor:** at 1.12 µm pixels, a 110 mm object field (both eyes) at 200 mm standoff yields **~343 px across an 11.5 mm iris — a 1.7× margin over the ISO recommendation** [D]. Two OV9281 global-shutter modules ($25.99 + $35.99 [M]) cost 2.4× more, cover **one eye each** (3.0 µm pixels → 73 mm field → ~73 px/iris on a 1280-px sensor) [D], and destroy the rolling-shutter timing channel.

**Depth of field is the trap:** at magnification m ≈ 0.033, f/2.8 gives ~11 mm DoF; **stop to f/5.6 for ~23 mm** [D] and budget ~4× the NIR illumination. Design corneal irradiance to IEC 62471 / IEC 60825-1 exempt-group limits (order **10 mW/cm²** for long exposures — **verify against current standard text before fixing LED current** [E]). This is the one line item where "it's a $0.40 LED" is wrong.

### Disqualified, with reasons

| Rejected | Price | Why |
|---|---|---|
| OpenBCI Cyton / Ganglion | $1,249 / $624.99 [M] | **SOLD OUT**, and $156/channel vs $3–5/channel at chip level [D]. EEG-priced hardware doing an ECG job. |
| Waveshare Finger Vein Module (A)/(B) | €22–$70 [M] | Closed firmware, on-module matching, proprietary templates, unverifiable "liveness". **A black box cannot be attested.** The vendor-policy trap in miniature. |
| PineTime / Colmi P8 as attestation root | $26.99 / ~$15 [M] | HRS3300 is green-only (no ratio test) **and** nRF52832 APPROTECT falls to a $5–100 ESP32 rig [M]. Fine as a *chassis* and cheap prototyping donor; never as a root. |
| MAX30102 as the production PPG | $2–5 [M] | Excellent, fully raw, ungated 18-bit FIFO — proof that "raw PPG is restricted" was always vendor policy. But 660/880 nm is fixed; it cannot do 850/950. **Use it for bench work, not the product.** |

**Optional ECG add-on** (if R-R/HRV from PPG proves insufficient): ProtoCentral MAX30003 v3, **CERN-OHL-P v2**, ₹3,495 ≈ $40, in stock [M]; MAX30003 at chip level ~$3–5 [E]. It meets the *electrical* requirements of IEC 60601-2-47; what it lacks is **certification, not performance** — ProtoCentral says so explicitly [M]. Avoid AD8232 boards: typical 0.5–40 Hz front ends give R-peaks only, no ST-segment morphology [M].

---

## 3. The attestation chain

Five links. No vendor CA appears as a root anywhere. Each link states what it proves **and what it does not**.

```
[1] REPRODUCIBLE BUILD ──> [2] MEASURED BOOT (key sealed to measurement)
                                        │
                                        v
                          [3] DEVICE KEY, born in the SE
                                        │
                              ┌─────────┴─────────┐
                              v                   v
                   [4] TRANSPARENCY LOGS    [X] OPTICAL CHALLENGE
                       A / B / C                (the capture seam)
                              │                   │
                              └─────────┬─────────┘
                                        v
                              [5] RELYING PARTY
```

### Link 1 — Reproducible firmware build

**Proves:** the measurement value in the attestation token corresponds to *published source anyone can rebuild*.

**Mechanism:** pin `west.yml` to commit hashes; `SOURCE_DATE_EPOCH`; `-ffile-prefix-map` / `-fdebug-prefix-map`; no `__DATE__`/`__TIME__`; deterministic archive and link order; version injected as an explicit build input, **not** `git describe` (which varies with clone depth — a shallow CI checkout ≠ a full local one) [M].

**The non-obvious fix:** MCUboot RSA-PSS signing is non-deterministic by design — the padding salt is random [M, Zephyr #49572]. Do not make the signed blob the artifact under comparison. **Rebuilders reproduce and hash the payload; the signature is a detached statement over that hash.** Then PSS randomness is irrelevant *and* the PSA software-component measurement is over exactly the thing rebuilders confirm.

**Threshold: ≥3 independent rebuilders, organizationally and geographically disjoint, publishing signed attestations continuously.** Below 3 this is theater.

**Does not prove:** that the source is benign. Reproducibility makes a backdoor *public*, not absent.

**Honest state of the art:** nobody in embedded achieves continuous third-party-verified reproducibility. Zephyr has no CI job asserting it (issue #50205); InfiniTime ships a pinned Docker env, which is environment reproducibility, not verified bit-identity; NuttX and TF-M publish nothing [M]. **GrapheneOS is the existence proof** — small team, full OS, reproducible builds, hardware attestation with zero Google in the path [M]. A wearable image is a few hundred KB, one toolchain, statically linked, no package manager. Debian solved a vastly harder instance. **This gap is small enough for BNR to close, and it is BNR's job, not a vendor's.**

### Link 2 — Measured boot with the key sealed to the measurement

**Proves:** the firmware currently running hashes to X.

**Mechanism:** TF-M Initial Attestation Service on a Cortex-M33, emitting a **PSA attestation token — a CBOR/COSE_Sign1 EAT profile, now RFC 9783** [M]. Claims that matter here: `Nonce` (carries the optical-challenge seed and the biometric bundle hash), `Instance ID` (the UEID logged in Log B), `Implementation ID`, **`Security Lifecycle`** (catches a debug-unlocked unit), **`Boot Seed`** (ties multiple tokens to one boot session — the custody primitive), and **`Software Components[]`** with per-component measurement hashes — exactly what Link 1's rebuilders reproduce.

**The critical distinction:** secure boot verifies a **signature** ("signed by a key I trust"), never a **measurement** ("this exact hash"). To get a measurement into attestation you must **seal to it** — derive or unlock the signing key from the measurement so that wrong firmware simply gets a useless key. **The seal must live in the discrete SE.** A seal inside a glitchable MCU is worth zero [M, LimitedResults 2020 / CVE-2020-27211].

**Does not prove:** that the firmware is still unmodified *now*. A post-boot MCU glitch leaves the measurement intact and the key live. **This is the residual technical attack, and Link X is the only thing that closes it.**

**RFC 9783's `Verification Service Indicator` is explicitly a hint only** — the spec states the relying party may lack the trust anchor and must treat it like any externally supplied information [M]. The standard was written to permit exactly what BNR is doing.

### Link 3 — Device key, born on-die in a discrete secure element

**Proves:** the private key has never existed in software, on any bus, or in any factory database.

**Mechanism:** `lt_ecc_key_generate(slot, ED25519|P256)` on TROPIC01 — 32 ECC key slots, 16 monotonic counters to `0xFFFFFFFE`, and uniquely `lt_ecc_eddsa_sign` signs a **raw message up to 4096 bytes**, not just a 32-byte digest [M, `C:\Users\travi\source\trezor-firmware\vendor\libtropic\`].

**The vendor-removal primitive — this is why TROPIC01 and not SE050:** Tropic Square provisions pairing slot 0 with SH0PUB and **publishes SH0PRIV in libtropic itself** (`lt_sh0priv_prod0`). Per `docs/reference/default_pairing_keys.md`: the customer establishes a session on slot 0, writes their own X25519 public key to slot 1/2/3, and **invalidates slot 0** [M]. After that step **Tropic Square cannot open a secure channel to the part.** No other vendor on the list offers structural self-removal.

**Freshness and ordering:** sign `{nonce, monotonic_counter++, H(payload)}`. This requires a **hardware** monotonic counter, which is precisely where MCU-integrated storage fails — **neither nRF5340 nor ESP32 has one** [M]. ATECC608B has 2 (2,097,151 increments — ample for a 28-day cadence over a lifetime), OPTIGA has 4, TROPIC01 has 16 [M].

**Does not prove — state this loudly:** *no commodity part, open or closed, proves that ADC bytes came from photons rather than from a wire.* The SE attests the key, never the sensor. Apple is identical: the SEP attests SEP's state; the camera pipeline is attested only by software Apple signs.

### Link X — SE-owned optical challenge (the capture seam)

**Proves:** the pixel data was produced by a physical optical system illuminated at an instant only the SE could have chosen.

**Mechanism:** the SE owns the LED enable line **directly** — SE GPIO or SE-gated driver, never an MCU request. The SE derives a pulse schedule from its nonce and fires it during **rolling-shutter readout**. The pulse's *spatial band position* in the frame encodes its firing time to sub-frame precision. At IMX219 full resolution (3280×2464 @ ~21 fps) line time is **~19 µs** [D — measure on bench]; an 8-line pulse is localizable to roughly ±1 line, giving **~8.3 bits per pulse, ~33 bits over 4 pulses per capture** [D].

**Why this is the 50–170× line:** a synthesized frame cannot contain illumination it never received. A counterfeit "sensor" that is secretly an MCU replaying a waveform must synthesize a physically correct response — specular glint geometry, per-wavelength absorption ratio at 850 vs 950 nm, inter-channel timing — **within the frame time, against a randomized challenge, on a bus owned exclusively by the SE**. That converts a one-shot forgery into a real-time in-loop optical simulator: the $150k–500k figure, per-capture, non-scaling.

**Consequence that saves money:** because the MCU is no longer security-critical, cheap MCUs (and even PineTime-class chassis) become usable for the band.

**Does not prove:** anything about *whose* body it is. That is d′, custody, and the circle.

### Link 4 — Transparency logs (this is what replaces the vendor CA)

Three Merkle logs, all **witness-cosigned** by independent parties countersigning checkpoints (the Go sumdb / Sigstore pattern), so a split view requires colluding witnesses. Precedents: CT (RFC 6962/9162), Sigstore/Rekor, Android Key Transparency, and **Transparency.dev's ArmoredWitness** — open hardware whose firmware provenance rides in transparency logs; study it directly [M].

| Log | Leaf | Policy |
|---|---|---|
| **A — Firmware** | `(image_hash, source_commit, toolchain_hash, config_hash, rebuilder_sigs[])` | A PSA software-component measurement is acceptable **only** with ≥3 independent rebuild attestations. This makes Link 1 load-bearing, not aspirational. |
| **B — Device identity** | `(SE_pubkey, Implementation_ID, batch_id, ceremony_transcript_hash, physical_fingerprint_hash, circle_id, epoch, timestamp)` | Relying party **requires an inclusion proof** before accepting any token. |
| **C — Lifecycle** | revocation, decommission, stolen, debug-unlock observed | Checked at every verification. |

RFC 9334 (RATS) already separates the roles and explicitly names **device owners** alongside manufacturers as legitimate Endorsers and Reference Value Providers [M]. CoRIM (`draft-ietf-rats-corim`) is the wire format. So:

- **Reference values** (which measurements are acceptable) → BNR publishes, rebuilders corroborate. **Fully solved, no vendor.**
- **Endorsement** ("is this key in genuine, non-debug silicon, one of N legitimately made?") → **the only claim that ever needed an issuer.** Logs B + the circle replace it.

**The counting invariant is where open beats closed outright, not merely ties.** Publish per batch: wafer/part counts, units assembled, units shipped, keys logged. At 10k-unit batches a community can **literally count**, and the numbers must reconcile. A factory or interdictor minting extra keys faces a fork: log them (public, auditable, implicates the witnesses) or don't (useless, because relying parties demand inclusion proofs). **Apple cannot do this at 200M units/year and does not publish an issued-key count at all.** That absence is the man-in-the-middle the founder named.

### Link 5 — Relying party

Accepts only if **all** hold:

1. PSA token COSE signature verifies under the SE public key.
2. That public key has a **Log B inclusion proof**, endorsed by a ≥4-of-6 circle quorum threshold signature.
3. Every `Software Components[]` measurement has a **Log A** entry with ≥3 rebuild attestations.
4. `Security Lifecycle` = `secured` (not `debug-unlocked`).
5. Nonce matches the verifier's challenge; monotonic counter strictly increased.
6. **Optical-challenge residual verifies**: recovered banding schedule matches the SE-issued schedule within tolerance, and the multi-channel coherence residual passes.
7. **Custody chain**: `W ≥ threshold`, `E − W ≤ budget`, no BREAK domain fork since the last circle (§5).
8. No **Log C** revocation entry.
9. Externally witnessed time (Roughtime or the circle beacon) within the last ≤24 h.

**Zero vendor CAs in that list.** The SE vendor's certificate appears at exactly one place — as **one input among M** to the ceremony in §6 — and its absence degrades one bit (§9), it does not break the chain.

---

## 4. Open vs closed, honestly

Per attack class. **Marginal cost per fraudulent identity** is the governing metric, against the **$310 rented-human floor** [M].

| # | Attack class | Open (BNR-B1/H1, TROPIC01-rooted) | Apple SEP + iOS | Delta — who wins, by how much |
|---|---|---|---|---|
| 1 | **Key extraction, physical** | $10k–50k/die, destructive, non-scaling [E] | $10k–50k/die, destructive, non-scaling [E] | **Tie.** Both CC-EAL-class physics. Founder's "$2 part" is exactly right. |
| 1b | **Measured attack history of the SE** | **TROPIC01: no CC certificate, ~1–2 yr public exposure. Cost to extract is UNMEASURED.** | SEP: 15 yrs of global red-teaming, certified countermeasures | **OPEN LOSES**, and it's unquantified — the worst kind. Hedge: dual-SE (TROPIC01 **and** SE050 must both sign), **+$1.60/unit at 1M**. Put "cost to extract from an open SE" on the measurement list, not on a slide. |
| 2 | **Firmware substitution** | Reproducible build + ≥3 rebuilders + Log A + key sealed to measurement | Apple-signed; **no reproducible build, nobody outside Apple can verify** | **OPEN WINS.** Apple's users cannot check what they run. |
| 3 | **Post-boot MCU glitch → SE signs synthetic data** | Closed by SE-owned optical challenge → $150k–500k | Same seam exists (SEP attests SEP, not the camera); mitigated only by software Apple signs | **Open wins on auditability, ties on cost.** |
| 4 | **Attested per-row sensor timestamps** | **Exists — BNR owns the readout.** | **Not a documented primitive on either iOS or Android** [M — flagged as the largest technical unknown in the programme] | **OPEN WINS DECISIVELY.** The single strongest argument for building hardware at all. |
| 5 | **Dishonest manufacture / provisioning** | N-of-M witnessed ceremony + public issuance log + published device count. Attack = collude 4-of-6 VRF-sampled humans. | **~$0 marginal, and structurally invisible** — unpublished, unauditable issuer, no published key count | **OPEN WINS DECISIVELY.** This is the cheapest attack in the whole taxonomy and closed hardware has no defense at all. |
| 6 | **Trust-root misissuance / revocation lever** | BNR co-root; unilateral rotation valid under any quorum-forming circle (W3) | Apple's CA is sole root; Apple can revoke you | **OPEN WINS.** Availability is a security property. |
| 7 | **Secure clock** | **No RTC in any $2 SE.** A compromised device runs its ratchet fast. Bound: witness interval ≤24 h → ≤24 h fabricated custody/device | Fused secure timer in SoC | **OPEN LOSES**, bounded and tunable. Cost: 24 h of fabricable custody on an already-$10k–50k compromised die. |
| 8 | **Build/toolchain supply chain** | Reproducible + ≥3 disjoint rebuilders; compromise requires ≥3 collusions | Single vendor build server, unverifiable | **OPEN WINS 3×** (literally: 1 → 3 required compromises). |
| 9 | **Coercion** | Zero bits. Every sensor tells the truth. | Zero bits. | **Tie at zero.** Neither. Duress signaling + rate caps + the circle, or nothing. |
| 10 | **Identity rental** | Continuous custody raises marginal cost from ~$0 to **the wage of continuous human availability**; **zero bits cryptographically** | No custody at all — a phone is handed over freely | **Open wins economically, not cryptographically.** Do not oversell this. |
| 11 | **Manufacturing QA / field reliability** | Community assembly, multiple sites. Field failure **[E] 3–8%/yr** | **[E] ~1%/yr** | **OPEN LOSES ~3–8×.** Offset partly by repairability (§7); a repairable $35 unit at 5% failure beats a sealed $400 unit at 1%. |
| 12 | **Update reach / patch velocity** | No forced-update channel; a firmware bug can persist in the field indefinitely | Days-to-weeks global rollout | **OPEN LOSES**, materially. Mitigation: circle-mediated updates every 28 days → worst-case patch latency 28 days vs ~7. |
| 13 | **Genuine-die authenticity** | **SH0PRIV is public** [M] **and libtropic does not verify the cert chain** [M, `libtropic.h` ~line 742]. An interdicted or emulated die is undetectable unless BNR verifies out of band. | Apple verifies its own silicon end to end | **OPEN LOSES**, and this is the sharpest single loss — see §9.1. An SE *emulator* at ~$50–200/unit scales and sits below $310. **Must be closed by out-of-band chain verification + 1–2% destructive sampling.** |

**Net, stated without flattery:** open ties closed on the expensive, non-scaling technical breaks; **loses** on SE attack history (unquantified), secure clock (bounded, ≤24 h), field reliability (~3–8×), patch velocity (4×), and die authenticity (dangerous until fixed); and **wins decisively** on the cheap, scaling social break, on sensor-seam timestamps that do not exist on any phone, on build verifiability, and on the trust root itself. **The one attack class that governs cost at 10-billion scale is #5, and that is the one closed hardware cannot defend.**

---

## 5. Continuous custody

**Thesis:** Nymi ships *authentication continuity* — removal deauthenticates in real time [M]. It does **not** ship *custody proof* — no artifact later proves the band was on one wrist from t₁ to t₂. That after-the-fact unforgeability is the entire delta, and it costs **~$0 in BOM**.

### 5.1 Removal detection

| Channel | Loss latency | Avg current | Spoof cost | Role |
|---|---|---|---|---|
| **Strap-loop conductor** (per-strap key through strap + clasp) | **<50 ms** | ~1 µA [E] | Must bridge a keyed loop while wearing | **Instantly authoritative — physical, not inferential. Nymi does not do this. Build it. $0.20/unit at 1M.** |
| **PPG pulsatile AC** (not DC level) | 2–5 s | 10–40 µA duty-cycled | Pulsatile phantom, $200–2k | Primary liveness-of-contact |
| **Skin/air differential thermal** (gradient, not absolute) | 30–120 s | <1 µA [E] | Must hold a body-temp gradient continuously | **Best corroborator** — slow, nearly unspoofable in combination |
| Capacitive/galvanic | <200 ms | 1–2 µA [E] | Saline gel + foam, <$5 | Fast trigger only. **Never authoritative.** |
| IMU | n/a | ~10 µA wake-on-motion | — | Not a presence channel — the **interrupt source**, plus unbuckle-jerk transient |

**Fusion rule:** BREAK requires k-of-n agreement **across different time constants**. Fast channels open a suspicion window only; confirmation requires a slow corroborator (thermal gradient collapse or PPG-AC absent ≥3 ticks). **Sole exception: strap-loop open is instantly authoritative.**

**Equity constraint, load-bearing at 10B scale:** 525 nm green is absorbed by melanin. PPG-only presence degrades on high-Fitzpatrick skin and on cold, vasoconstricted wrists. **Use green + 850/950 nm IR and fall back to IR-dominant presence.** Cost: one LED die, **$0.06 at 1M**. Skipping it excludes populations — a security failure disguised as a BOM decision.

### 5.2 Gap semantics — the deployability decision

Tick **T = 30 s**. Three tiers, not two.

| Tier | Window | State | Re-entry cost |
|---|---|---|---|
| **Slip** | ≤3 ticks (90 s) **and** no slow corroborator dropped | WORN (logged) | none; budget ~20/24 h |
| **Soft gap** | 90 s – 15 min | SUSPENDED | **single channel** — PPG cardiac-morphology match to on-device template, or finger |
| **Hard gap** | >15 min, **or** strap-loop open, **or** tamper mesh | **BREAK** | **full basket at a head**: two irises + heartbeat + finger/veins + SE-issued optical challenge |

- **Showering is never a removal.** 5 ATM/IP68; a **WET** state (cap electrode saturated + temp spike) down-weights cap and thermal, rides on PPG + IMU, time-boxed 30 min.
- **Sleep:** custody is *easier* — stable perfusion, low motion. The real failure is **compression** (lying on the wrist) killing PPG. **Do not widen the night budget** (an attacker picks night); lean on ballistocardiographic IMU + thermal, both excellent when still.
- **Medical / MRI / cast / dialysis / amputation:** **pre-declared suspension.** Wearer fully authenticates *before*, issues a signed suspension with a duration, optionally co-signed by a circle member. Returns to a *declared*, not anomalous, gap. No circle penalty.
- **2–4% of humans cannot wear a wrist device at all** [E]. The custody protocol must be form-factor-agnostic — ankle, pendant, ring, patch — or it excludes them by construction.
- **Repairability as a security property:** strap replacement is an **authenticated declared event**. The strap-loop carries a per-strap key, so an unauthorized swap is detected but a legitimate repair does not nuke the chain.

### 5.3 The ratchet

Two counters, one chain:

```
E = elapsed ticks   (RTC-driven, always advances)
W = worn ticks      (advances only when fusion verdict = WORN)

K_{i+1} = HMAC(K_i, i ‖ worn_flag ‖ H(sensor_verdict_bitmap) ‖ E)
delete K_i                                     // forward-secure
```

**The gap is unforgeable after the fact because the chain index IS a worn-time clock.** A verifier compares `W` against externally witnessed elapsed time; the deficit `E − W` is total off-body time. You cannot advance faster than the SE will tick, and you cannot recover `K_{i−1}` from `K_i`, so history cannot be back-dated or rewritten.

**Break is a domain fork, not a flag:**

```
BREAK:  K' = HMAC(K_i, "BREAK" ‖ E)            // history preserved; unbroken-domain key destroyed
REBIND: K_live = HMAC(K', "REBIND" ‖ H(full_basket_capture_attestation))
```

After a break the device can still **prove its own history** but is *structurally incapable* of minting a token in the unbroken domain. No revocation message, no server, no vendor cloud in the path.

**Binding to the 28-day circle:**

```
K_0^(c) = HKDF(R_c ‖ pk_device ‖ H(basket_capture))
```

`R_c` = the circle's quorum-signed attestation root. Max **80,640 ticks per 28-day epoch** [D]. At circle time the quorum checks `W ≥ threshold` and `E − W ≤ budget`; if not, it **refuses to re-seed** and the human redoes the full basket in person. **This bounds any undetected forgery to one circle period.**

**Binding to presence:** `P_j = HKDF(K_live, "presence" ‖ j)`. Presence proofs are *derived from* the custody chain, so a break silently invalidates every future presence proof with **no network round-trip** — this is what makes "no vendor cloud in any critical path" actually achievable rather than aspirational.

**Rate limiting lives in the SE, not the MCU.** The SE refuses to tick faster than T regardless of what firmware asks.

### 5.4 Battery

**Continuous presence sensing is not the battery problem. Display and radio are.**

| Item | Avg current |
|---|---|
| nRF52840 System ON + RTC | 1.5–3 µA [M, datasheet] |
| IMU wake-on-motion (LSM6DSO-class) | ~10 µA [E] |
| Capacitive sense @1 Hz | 1–2 µA [E] |
| Dual thermistor @0.1 Hz | <1 µA [E] |
| PPG presence, duty-cycled (2 s / 60 s, IR+green) | 5–15 µA [E] |
| SE ratchet tick (~10 mA × 5 ms / 30 s) | ~1.7 µA [D] |
| **Custody floor** | **~25–40 µA ≈ 0.10–0.15 mW** |

On the 150 mAh cell (555 mWh): **~3,700–5,500 h ≈ 150–230 days of pure custody** [D]. Continuous non-duty-cycled PPG streaming measures **1.66 mW** [M, compressed-sensing wristband study] → ~14 days. Both dwarf any real band's 3–7 day life, which is consumed by display, BLE connection intervals, NFC and haptics.

Two decisions follow:

1. **Duty-cycle by interrupt, not by poll.** Contact cannot be lost without motion. IMU wake-on-motion (~10 µA) fires a high-rate verification burst within ~200 ms of any strap manipulation. Baseline PPG polling drops to 1/60 s, and 1/120 s during sleep, **with zero loss of break-detection latency.**
2. **Give custody its own power domain with a hard reserve** — last 8% of the cell (12 mAh) or the dedicated supercap. At 32 µA that is **~375 h ≈ 15.6 days of ratchet after the band is "dead"** [D]. Combined with on-wrist wireless charging ($1.10 at 1M), **this removes charging as a custody-break cause entirely.** Nymi's vendor guidance is to charge at end of shift — i.e. a deliberate daily custody break [M]. Do not copy that.

**Custody subsystem BOM at 1M: ~$4.30** of the $16 band.

### 5.5 The honest limit

**Custody buys:** the credential and the body have not separated since attestation; a stolen band is dead on arrival; offline spoof assembly must *also* sustain unbroken live presence; and an unforgeable after-the-fact wear record that gives the circle something real to audit.

**Custody buys exactly zero against:** coercion (a gun to the head produces a perfect capture and perfect custody — every sensor tells the truth); accompanied rental ("wear it and come with me"); a rented human acting in person; a compromised verifier.

**Blunt framing:** custody converts identity rental from a one-time key sale into an **ongoing service contract requiring the human's continued physical participation** — raising marginal cost from ~$0 to the wage of continuous availability. That is a large *economic* change and a **zero-bit cryptographic** one. Sell it as nothing else.

**What must catch the rest:** duress signaling (a distinct enrolled finger or tap cadence producing a valid-looking token flagged out-of-band — must be plausibly deniable and never fail visibly); rate and value caps; the 28-day circle, which is the only layer that can perceive "this person is being controlled"; circle-graph anomaly detection (rental farms have signatures — many identities, few attestors, correlated break timing, co-location); and making rental unprofitable rather than impossible.

---

## 6. Provisioning at a circle

**The claim:** a device key witnessed at an in-person circle is a **stronger root than a factory-provisioned one on the attack that actually dominates**, and a **weaker one on the attack that is expensive anyway**. Both halves are true and both must be said.

### 6.1 Why it is stronger

The factory endorsement asserts "genuine silicon, key born on-die," from an **unwitnessed line**. That is precisely the ~$0-marginal, perfectly-scaling social attack (§4 row 5): one bribe at one station and every unit in the batch emits cryptographically perfect attestations of adversary-chosen data. Nothing is broken. It is invisible.

The circle endorsement asserts something the factory structurally cannot: *"this key was born, on this die, **in front of six named humans**, bound in the same session to a body those humans recognize, at a stated time and place, and the transcript is in a public log."*

To forge it, an attacker must collude with **4 of 6 VRF-sampled circle members who did not know in advance they would be sampled**. That is not a bribe at a station; it is a conspiracy the sampling mechanism selects against.

### 6.2 The ceremony

**Pre-circle: the device ships UNPROVISIONED.**

- Factory generates no key and holds no secret. TROPIC01 pairing slot 0 still carries Tropic's default SH0PUB — whose private counterpart is public [M] — which is *safe here precisely because no secret exists yet*.
- Factory applies **randomized glitter/random-fiber epoxy** over the seam and screws, photographs under fixed lighting, and writes `(batch_id, unit_serial, fingerprint_hash, vendor_cert)` into **Log B** as `unbound_unit`. Purism does exactly this commercially; the literature is explicit that plain adhesive seals are defeated by heat and solvents while randomized, per-unit, pre-committed patterns are not [M]. **Cost: cents. Highest-ROI physical control that exists.**

**At the circle — 9 steps, ~25 minutes:**

| # | Step | What it defeats |
|---|---|---|
| 1 | **Fingerprint check.** Quorum photographs the arriving unit and compares against the Log B image. Any member can do this on their own phone. | Interdiction in transit |
| 2 | **Firmware attestation.** Read the PSA token's `Software Components[]`; each member independently checks Log A inclusion with ≥3 rebuild attestations. | Backdoored image |
| 3 | **Vendor chain verification, out of band.** Verify the TROPIC01 cert chain to Tropic Square's published root using BNR's own verifier — **not** libtropic, which does not verify the chain [M]. Record the result as one input, not the root. | Emulated/substituted die (§9.1) |
| 4 | **Key genesis.** `lt_ecc_key_generate(slot_1, ED25519)` — private key born on-die, never off-chip. Each of the M members contributes entropy; **that entropy binds the ceremony transcript, not the key material** (the SE TRNG owns the key). | Key-escrow at manufacture |
| 5 | **Vendor removal.** Write the circle's X25519 public key to pairing slot 1; **invalidate slot 0.** After this instant Tropic Square cannot open a secure channel to this part [M]. | Vendor as standing MitM |
| 6 | **Live basket capture, in the room.** Two irises + heartbeat + finger/veins under the SE-issued optical challenge, witnessed. The humans see the person; the device sees the biometrics; the SE sees the LED timing. | Batch pre-enrolled to a synthetic feed |
| 7 | **Threshold endorsement.** 4-of-6 sign `(SE_pub, impl_id, fw_measurement, fingerprint_hash, H(basket_capture), E_e, circle_id, location_commit, vendor_chain_result, timestamp)`. | Single-issuer misissuance |
| 8 | **Publish + retain.** Append to Log B; the returned inclusion proof is written into a TROPIC01 R-memory user slot (512 available [M]) so the device carries its own proof offline. | Split-view; offline verification |
| 9 | **Seed the ratchet.** `K_0^(c) = HKDF(R_c ‖ pk_device ‖ H(basket_capture))`. Device leaves the room **worn and ticking**. | Custody gap between enrollment and first use |

**Re-seeding every 28 days** at the next circle checkpoints continuity against humans and bounds undetected forgery to one epoch. **W3 holds:** unilateral rotation is valid if signed by *any* quorum-forming circle, so no circle can hold a person hostage.

**This replaces the T5 countersign** in `C:\Users\travi\beehive-nature\dockets\T3_device_enrollment_flows.md` §7 while keeping the keygen → evidence → delegation shape intact. It also overturns the concession in `C:\Users\travi\beehive-nature\dockets\TIERED_ACCESS_attestation_design.md` §2 — "a wearable-rooted tier is speculative" was a market survey, not a physics result.

### 6.3 Two claims, separated — where circle provisioning is weaker

- **Claim L (local):** *"the firmware on this device hashes to X, X is in Log A with ≥3 rebuilds, and this key was born in this SE."* A circle-provisioned key carries this **fully** — arguably better than a factory key, because six named humans watched.
- **Claim G (global):** *"this die is genuinely a TROPIC01 and not an emulator."* A circle **cannot verify this by inspection.** Step 3 outsources it to the vendor's cert chain, and that is a real dependency (§9.1).

**Quantified:** an SE *emulator* — an MCU pretending to be a TROPIC01 on the SPI bus — costs **[E] $50–200/unit**, and it **scales**. That is below the $310 floor. **If you skip step 3, circle provisioning reopens exactly the scaling break that the discrete SE was bought to close.** Step 3 plus 1–2% destructive/IRIS sampling per batch is not optional decoration; it is the load-bearing half of the ceremony.

### 6.4 Supply-chain controls, ranked by effectiveness ÷ cost

1. **Key born on-device, never exported; public key logged.** The factory never holds a private key. Cost ~$0. **The backbone.**
2. **Randomized physical fingerprint pre-committed at manufacture.** Cents. Highest-ROI physical control.
3. **SE-owned optical challenge against the analog path.** $0.20/unit.
4. **Destructive + IRIS sampling of 1–2% per batch, with the sampling seed drawn from the same beacon the circles use** — so the manufacturer cannot choose which units get inspected. **IRIS** (infrared in-situ silicon inspection, arXiv 2303.07406) is a non-destructive open backside technique, community-executable [M].
5. **Multiple independent assembly sites.** A compromised batch is bounded *and identifiable by `batch_id` in Log B*. Owning everyone requires owning every site. A structural benefit of refusing to centralize.
6. **Ship unprovisioned; provision at a circle.** The maximal version — removes the factory from the trust path entirely, subject to §6.3.

---

## 7. Cost and coverage

### 7.1 Unit cost

| | 1-off | 1k | 1M |
|---|---:|---:|---:|
| BNR-B1 band, BOM | $105 | $34 | **$16** |
| BNR-H1 head, BOM | $165 | $56 | **$22** |
| Band, landed retail (BOM × 2.2 [E]) | — | $75 | **$35** |
| Head, landed retail | — | $123 | **$48** |
| Head amortized per person (1 head : 100 people) | — | $1.23 | **$0.48** |
| **Per-person, first cost @1M** | | | **$35.48** |
| **Per-person, 10-yr TCO** (band 5-yr life, 2 cycles) | | | **~$71** |

A head at 1 : 100 handles ~1,300 enrollment/re-seed sessions per year (13 epochs × 100) plus ~200 hard-gap re-auths — **~4 captures/day** [D]. 1 : 500 is feasible; 1 : 100 is the conservative planning ratio.

### 7.2 Versus a $400 vendor wearable

| | Vendor wearable | Vendor + required phone | **BNR @1M** | Ratio |
|---|---:|---:|---:|---:|
| First cost / person | $400 | **$829** (SEP attestation in practice requires the paired phone; +$429 [E]) | **$35.48** | **11× / 23×** |
| 10-yr TCO (4-yr replacement vs 5-yr) | $1,000 | $1,695 | **$71** | **14× / 24×** |
| Cost to reach 10⁹ people | $400B | $829B | **$35.5B** | 23× |
| Cost to reach 10¹⁰ people | $4.0T | $8.29T | **$355B** | 23× |
| As % of world GDP (~$110T) | 3.6% | **7.5%** | **0.32%** | — |

### 7.3 What that does to coverage

| Population band | Approx. size | $400 device | $35 device | $16 subsidized-at-BOM |
|---|---:|---|---|---|
| High income | ~1.2B | reachable | reachable | reachable |
| Upper-middle | ~2.6B | ~partial | reachable | reachable |
| Lower-middle | ~3.4B | 30–130% of *annual* bottom-quintile income [E] → **effectively 0% voluntary adoption** | 3–12% of annual income — **in the range of a feature-phone purchase** | reachable |
| Below $6.85/day | ~3.6B [M-ish] | unreachable | marginal | **reachable with subsidy at $16 BOM** |
| Below $2.15/day | ~700M [M-ish] | unreachable | unreachable unsubsidized | **reachable at $16 BOM** |
| **Realistic coverage ceiling** | | **~3.8B (38%)** | **~7.2B (72%)** | **~10B (100%)** |

**Cost is a security property, and this is why:** a system that covers 38% of humanity has a 62% Sybil surface it cannot see. The excluded population is not a market problem; it is the attack surface. **The 23× cost reduction buys ~34 percentage points of coverage — and every point of coverage is a point of Sybil space closed.** No sensor upgrade in this document buys anything comparable.

**Repairability is the second cost lever.** A $35 unit with a replaceable strap, replaceable cell, and an authenticated strap-swap event has a materially longer effective life than a sealed $400 unit, which partly offsets the 3–8× field-reliability loss in §4 row 11. **Resolve the socketed-SE tension by binding, not by glue:** the SE↔sensor optical challenge plus the circle enrollment mean a swapped SE **fails verification** rather than silently passing — so the SE can be serviceable without being swappable.

**The other 2–4%:** ankle, pendant, ring and patch variants of BNR-B1 share the entire custody subsystem and PCB. Budget one extra mechanical program, not one extra electrical program.

---

## 8. Build order

### E0 — The kill experiment. $12, one day.

**Question:** does an SE-owned GPIO LED pulse land in an IMX219 frame as *recoverable banding at all*?

Rig: ATECC608B ($0.90) + one 850 nm LED + IMX219 NoIR + Pi Zero 2 W (already on the bench). Fire a `Sign(External)`-derived pulse schedule on the SE's authorization output; recover the band centroid from the frame; compare against the SE's committed schedule.

**Pass:** band centroid recovers the pulse time to **σ_t ≤ 40 µs** (≈2 line times) [D].
**Fail:** if the banding is not localizable, **the entire architecture in this document is dead on day one** and you go back to phone SoCs or a different modality. Nothing else should be built before this returns.

### E1 — The prove-or-kill experiment. $85, two weeks.

**Question:** with the challenge, what is d′ between a live eye and the best spoof media — given that without it, coordinated synthesis sits at **d′ ≈ 0** [M]?

Rig: E0 plus the M12 lens, bandpass filter, 6-LED illuminator, and a TROPIC01 Click. N = 20 live eyes (Fitzpatrick I–VI), 5 spoof classes (high-res print, e-ink, OLED display, textured contact lens on a prosthetic, ballistic-gel prosthetic with embedded specular sphere).

**Metric:** d′ of the challenge-response residual — banding position error, specular glint displacement, and 850/950 nm absorption ratio, jointly.
**Pass bar: d′ ≥ 4** (≈2% EER).
**If d′ < 2, the attested-seam claim on open hardware is dead** and the 50–170× belongs to a different architecture. Everything after this point assumes E1 passed.

This is the cheapest possible test of the single claim the whole programme rests on. **Run it before ordering a single band PCB.**

### Then, in order

| # | Deliverable | Why here |
|---|---|---|
| 2 | **850/950 PPG spin**: MAX86141 + SFH 4045N/4043. ~$15–20 BOM, one PCB [M]. | The ratio test exists nowhere off the shelf. Prove it in silicon before it's a system dependency. |
| 3 | **Reproducible-build pipeline + 3 disjoint rebuilders.** Detached signature over the payload hash (§3 Link 1). | Log A is worthless without it, and it gates every measurement claim downstream. |
| 4 | **Fix libtropic's unverified cert chain** [M, `libtropic.h` ~742] — BNR's own out-of-band verifier. ~2 weeks. | Without it, §6 step 3 cannot execute and §9.1 stays open. |
| 5 | **Custody band, N=6 alpha.** Strap loop + fusion + ratchet + reserve domain. | Cheapest way to find out whether false-BREAK is deployable. |
| 6 | **Logs A/B/C + witness cosigning**, on the Sigstore/sumdb pattern. Study **ArmoredWitness** first [M]. | Nobody has logged device identity keys at manufacture. Do not design this from scratch. |
| 7 | **First circle ceremony, filmed, N=6 devices.** | Everything in §6 is untested protocol until humans run it. |
| 8 | **Field trial: N ≥ 200, ≥30 days.** Stratified by Fitzpatrick I–VI, occupation, climate, tattooed and hairy wrists. **Primary endpoint: false-BREAK rate per wear-day. Target < 0.03/day (1 per 30 days).** | **This number does not exist in public — not Nymi's, not Apple's, not anyone's** [M]. BNR must generate it. **Cold is the #1 predicted false-break driver** — vasoconstriction destroys perfusion index. |
| 9 | Eye-safety certification to IEC 62471. **[E] $5–15k, one-time.** | Regulatory gate on shipping any NIR illuminator. |
| 10 | 1k pilot build, two independent assembly sites, published counting invariant. | The first real test of §6.4. |

**Do not build:** an integrated watch that tries to do irises (§1); anything rooted in an nRF52 (§1); anything with an OpenBCI board in it (§2); anything with a Waveshare vein module in the trust path (§2).

---

## 9. What still needs a vendor

Five real dependencies. Ranked by what depending on them actually costs.

### 9.1 Genuine-die authenticity — the one that matters

**TROPIC01's published RTL does not prove that the die in your hand matches that RTL.** Compounding this, two facts found in the local tree: SH0PRIV is published in libtropic [M], so every chip between fab and provisioning is pairable by anyone with physical access; and libtropic itself *"DOES NOT validate/verify the whole certificate chain, it just parses out STPUB"* [M, `C:\Users\travi\source\trezor-firmware\vendor\libtropic\include\libtropic.h` ~line 742]. Together: **an interdicted or emulated die is undetectable by default.**

**Cost of the dependency: [E] $50–200/unit for an SE emulator, and it scales — below the $310 floor.** This is the single most dangerous open item in the document.

**Mitigation, and it is sufficient:** (a) BNR's own out-of-band verifier for the Tropic chain, executed at every circle (§6 step 3); (b) provisioning as the first operation, in BNR's or the circle's hands, never the factory's; (c) 1–2% destructive + **IRIS** backside optical sampling per batch with a beacon-drawn seed [M]. Residual after mitigation: **one bit** — "is Tropic Square's own root honest" — and that bit is now one input among M in a threshold endorsement, not a root.

### 9.2 CMOS image sensor

**No open image sensor exists.** IMX219 register maps are reverse-engineered and adequate; the die is Sony's.

**Cost of the dependency:** a hypothetical sensor with an embedded frame injector. **This is the cheapest dependency in the list**, because the optical challenge tests the *sensor's empirical behavior*, not its datasheet. A malicious sensor must produce correct SE-timed banding, correct specular geometry, and correct per-wavelength ratios in real time — i.e. it must become the $150k–500k coordinated-synthesis attacker. **Depending on Sony here costs approximately nothing, because the architecture does not trust the sensor in the first place.**

### 9.3 Silicon fabrication generally

Nobody fabs their own chips. This is true of Apple too. The difference is what it buys you: BNR's fab dependency is confined to §9.1's single bit, whereas the closed path's fab dependency comes bundled with an unauditable provisioning line and an unpublished issued-key count.

**Cost: bounded and named.** Multi-source the MCU (nRF52840 / ESP32-C6 / STM32U5 — the MCU is non-security-critical by design, so second-sourcing it is a supply decision, not a security one). If you must put a key anywhere near an MCU, use hardened-APPROTECT silicon (**nRF52840 rev 3 / nRF52833 / nRF52820**) and **verify revision per batch — Pine64 stock is old, vulnerable silicon** [M], and Nordic does not claim certified fault-injection resistance [M].

**If ESP32 is ever chosen: use C6, not S3.** The S3 has no ECDSA peripheral — DS is RSA-only, so every attestation signature is **384 bytes**; the C6's ECDSA peripheral gives **64 bytes**. At 10¹⁰ devices × 13 sessions/year that is **~6× the log and on-chain bandwidth for identical security** [D].

### 9.4 SE attack-history maturity

TROPIC01 has **no CC certificate and ~1–2 years of public exposure**. SE050 and OPTIGA Trust M V3 are **CC EAL6+** [M] but closed.

**Cost: unquantified, which is the worst category.** "Cost to extract a key from an open SE" is **unmeasured** — put it on the measurement list, not on a slide. **Hedge for $1.60/unit at 1M: dual-SE.** TROPIC01 as the auditable root and SE050 as an independent second signer; both must sign for a token to verify. An attacker must break an open part with a short history *and* a CC EAL6+ part. Trezor's shipping OPTIGA configuration is the proof that vendor cert and device cert can coexist without the vendor being the root [M, `C:\Users\travi\source\trezor-firmware\docs\core\misc\optiga.md`: E0E0 = Infineon cert, **E0E1 = device certificate chain**, E0F0 = P-256 device key gated on `Conf(KEY_PAIRING)`].

**The 50–170× argument does not depend on this being resolved.** It depends on attestation existing at all.

### 9.5 The secure clock

**No $2 SE has an internal RTC** — not ATECC608B, not SE050, not TROPIC01 [M]. A physically compromised device can run its ratchet fast.

**Cost, quantified: maximum fabricated custody = the witness interval.** Bind ticks to externally witnessed time (Roughtime, or the circle's signed beacon) at every verifier interaction. **Enforce ≤24 h → exposure is ≤24 h per compromised device**, on a device that already cost $10k–50k to compromise.

**This is the one place the open design is measurably worse than a phone SoC with a fused secure timer.** The cost is bounded and the bound is a tunable parameter. Say it that way; do not hide it.

### 9.6 Not vendor dependencies, despite appearances

NIR LEDs, photodiodes, lenses, bandpass filters, thermistors, IMUs, batteries, coils, passives — all multi-sourced commodities with no trust relationship. **IRIS (Iris Recognition Inference System) is open source under Apache-2.0** [M], so BNR does not need to write an IrisCode matcher. **`worldcoin/orb-software` is MIT/Apache-2.0** and includes `orb-attest` and `orb-secure-element` [M] — the only shipped dual-iris NIR device with SE attestation, and substantially readable. Read it. But note the two seams: `orb-firmware` **explicitly excludes the security MCU firmware**, and `worldcoin/orb-hardware` is under a **use-restricted "Responsible Use License v1.0"** — not OSI, not OSHWA. **Study the software; do not inherit the hardware licence.**

IEC 62471 eye-safety testing is a **lab**, not a CA: a one-time **[E] $5–15k** with no ongoing trust relationship.

---

**Summary of the four numbers that decide everything:**

- **$0.20/unit at 1M** — the SE-gated LED driver that turns 3–17× into **50–170×**.
- **$1.80/unit at 1M** — the discrete SE that keeps you off the **0.003×** regression.
- **$310** — the rented-human floor every marginal attack cost must clear.
- **23×** — the coverage multiplier, which is the only number in this document that changes how many humans the system can see.
