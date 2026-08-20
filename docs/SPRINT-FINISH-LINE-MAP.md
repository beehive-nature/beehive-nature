# Sprint Finish-Line Map — the Key Build → Signing Stack
### bDiD onboard/wallet/hardware · prepared 2026-08-18 for tomorrow's raid sprint

**The finish line, stated once:** a person walks the onboarding surface with any rung they own — passkey, spare phone, FIDO2 key, or bSAFE 7 — and leaves with a real Ed25519-authorised bDiD, a real 24-word floor that restores it offline forever, and heavy approvals routed to the Trezor while the phone handles light value. Nothing simulated, every refusal honest, every rung the same identity.

---

## What is ALREADY DONE (today's build — all tested, all delivered as files)

| Artifact | State | Proof |
|---|---|---|
| **bdid-key engine** (`bdid-key.js` src + vendored bundle) | PRF→master_prk→Ed25519 (did-autonomi keyAlg), 24-word BIP39 both directions, `bdidrec1…` codes, fingerprint words, persona nullifiers, R1b-strict verify | 26/26 node tests, pinned cross-impl vectors |
| **Onboarding surface patch** (`index.html` + `.patch`) | Real ceremony: UV=required, residentKey=required, PRF ext, capability ladder, PRF-less fallback rung (phrase-only root), real words replace stage props, `PREVIEW` auto-flips on engine presence, restore path live | 6/6 Chromium e2e incl. CTAP2 virtual authenticator **with PRF**: full ceremony + deterministic re-assertion |
| **Offline recovery tool** (`bdid-recover.html`) | Single file, zero network requests, phrase/code → keys + fingerprint + prove-control signature | Headless roundtrip vs pinned vector; no-network scan clean |
| **bsafe-host Rust workspace** (`bsafe-host.tar.gz`) | THP frame codec (typed refusals) + Noise_XX_25519_ChaChaPoly_BLAKE2s channel (noise-rust family) + mem-transport full-stack test; btleplug BLE feature-gated with spike checklist | 4/4 cargo tests: handshake, transport, tamper refusal, prologue mismatch |

**Pinned test vector (any port must reproduce byte-identically):**
`prf_secret=0x01×32 → master_prk=d54134a6…93d4ac → ed25519_pub(ctx "bnr.b")=761e0ec5…a84591 → fp="lock robust differ helmet baby stable"`

---

## DECISION GATES — settle these at sprint open, before code hardens

**G1 · 24 words (founder-class).** Implemented as canonical 24 (256-bit root); 12-word input refused with an explanation. The old mock said 12. Root entropy is unfixable after first real enrolment — ratify 24 or overrule now.

**G2 · Labels (raid).** Every `BDID-v1/…` domain-separation string in the engine is normative-once-ratified. Rename before first mainnet derivation or never. Same for `bdidrec` HRP and the `BSAFE7-THP-v0` Noise prologue.

**G3 · UR framing (raid).** Adopt BC-UR fountain-coded multi-part QR for the dynamic-QR channel (interop with Keystone/Passport/SeedSigner; dropped frames never stall). The 450 B/s trick keeps its speed and gains a standard envelope. Decide before the optical wire format ships.

**G4 · Derivation context registry (raid).** Engine scopes keys by context string (today: `bnr.b`). Decide the canonical context names (kernel? per-community? per-rail?) and who may mint them — this is the persona/namespace law surface.

**G5 · Root-door policy ratification (raid).** As built: PRF-capable passkey ⇒ root derives from PRF (two doors, one root). No PRF ⇒ root is fresh entropy, phrase is the only root door, authenticator is authn-only. Trezor rung ⇒ device seed, phrase skipped (founder ruling 2026-08-14 preserved). Confirm this matrix.

**G6 · Enrolment `code_hash` semantics (crate owner).** Phrase is now derivational; `RecoveryPath::WrittenCode{code_hash}` becomes a local write-down check, not a restore credential. Small API note in `crates/onboarding` before more callers exist.

---

## SPRINT WORKSTREAMS — each independently finishable, with its done-line

### WS-1 · Land the key build in-tree
Apply `onboarding.patch` + drop `bdid-key.js` into `surfaces/onboarding/`; port `test.mjs` into CI; wire the e2e (Playwright + virtual authenticator, script provided) into the tests workflow.
**Done when:** CI runs the 26 unit tests + 6 e2e checks green on every push, and the surface on a real phone creates a passkey, shows 24 real words, and restores from them. *(Everything exists; this is integration only.)*

### WS-2 · Anchoring — the last PREVIEW gauge
The one remaining stub: `creating()`'s "Anchoring identity record…" spinner. Wire the genesis record: canonical genesis op → bDiD = digest (self-certifying, per biometric-ledger doc) → signed with the derived record key (R1b-strict) → anchored via the existing atmirror/receipt pattern → `RootIdentity.anchored=true` → `Enrolment::anchor()` (the mutator the design doc already names as missing).
**Done when:** a real enrolment produces an anchored root a second machine can verify from the chain read alone, and the ready screen's `did:webvh`/`did:autonomi` gauge reads Known without lying. *(Also settles which DID method string the surface displays — it currently says `did:webvh`, the crate says `did:autonomi`; one of them is wrong on purpose and should say why.)*

### WS-3 · Offline recovery tool hardening
Today's `bdid-recover.html` works. Sprint adds: context picker fed from G4's registry, print stylesheet (paper backup card with fingerprint line), and a vendored copy checked into the repo + served as a download from the recovery screen (mirroring FileKey's "even if we disappear" pattern).
**Done when:** a phrase written today restores on an air-gapped machine with no BNR service reachable, and the artifact ships in-tree.

### WS-4 · bSAFE 7 host spike (hardware day — needs the physical Safe 7)
Un-gate `--features ble` on a dev machine; walk the checklist in `host/src/lib.rs`: scan → connect → THP GATT service discovery → adapt notifications/writes to the `Transport` trait → run the Noise XX handshake from `bsafe-thp` over it → display `remote_static` as **fingerprint words** (engine's §7 — same words function, JS and Rust must agree; port `fingerprint()` to Rust against the pinned vector) → human confirms on device.
**Done when:** one encrypted round-trip host↔Safe 7 completes with the fingerprint confirmed on the device screen. Frame constants discovered get pinned into `Dialect` and the `BSAFE7-THP-v0` prologue is ratified (G2).
**Honest scope note:** signing real Vaulta/Zano payloads is NOT this sprint — that needs the protobuf message layer (generate from trezor-firmware's `.proto`s as `bsafe-messages`, next sprint's WS).

### WS-5 · Dynamic QR → UR envelope (pairs with G3)
Wrap the existing 450 B/s animated-QR payloads in BC-UR fountain encoding (Rust + TS libs exist; the vendored nayuki `qrcodegen.js` stays as the renderer, `rust-no-heap` port for the device side). Update the optical rung's pair-request/reply to UR types.
**Done when:** a transfer completes across a deliberately lossy capture (cover the camera for 2 s mid-stream) with no restart — the property fountain codes buy.

### WS-6 · Signing-tier policy (the "mostly my Trezor, mobile for light" ask, made law)
Encode the two-tier model in `crates/capability`: bSAFE 7 (T5) = unbounded approvals, always on-device confirm; mobile (T4) = delegation with ceilings ("send up to X/day", per T3 §6 consent text rendered from the actual capability list), countersigned by the T5 anchor; QR path preferred for approvals above a threshold, BLE for below.
**Done when:** the delegation object exists as a type with a smart constructor (same idiom as `GradeDisclosure` — unforgeable, disclosure-witnessed), and one worked example passes: phone requests over-ceiling → refused with the ceiling named → same request via Safe 7 → approved.

### WS-8 · Dice-roll entropy for bSAFE (added post-Coldcard-RNG disclosure, founder-directed)
The Coldcard failure was a silent entropy substitution that no user could see and no firmware update could repair. bSAFE answers with **verifiable, user-participating entropy**: a seed-generation menu offering dice rolls (99×d6 ≈ 256 bits; SeedSigner's proven UX) — always **XOR-mixed with the hardware RNG, never replacing it**, so the seed is at least as strong as the strongest source and no single source (a weak TRNG, loaded dice, a compromised display) can weaken it alone. Same option in the browser engine's phrase-only path (dice mixed with `crypto.getRandomValues`). Plus the regression test the whole industry just learned to write: a CI check that the hardware RNG path is *actually active* in the shipped build — asserting the flag is **on**, not merely present — with a known-answer health test on the entropy source at boot.
**Done when:** a user can generate a bSAFE seed from dice + TRNG mix, re-derive it from the same rolls on a second device to verify the math (then discard that test seed), and CI fails loudly if any build ever falls back off the hardware RNG.

### WS-7 · b-indexer spec (writing, not code)
One spec doc against blockbook's API surface as prior art: per-rail arrival verification (`Wallet::observe`'s chain-read witness), xpub-scale address watching, Rust + SQLite, one indexer per rail starting with Vaulta (where `b` settles) and Arbitrum (first Class-B rail). Explicitly out: running blockbook itself (Go, AGPL, covers none of the core rails).
**Done when:** the spec names the tables, the witness format, and the refusal states for the two launch rails, and a reviewer can start the Vaulta indexer from it without asking questions.

---

## Sequencing for the day

Morning: **G1–G6 rulings** (30 min, they're all pre-chewed above) → WS-1 lands while rulings happen (no gate blocks it except G1's word count, already built as 24). Midday: split — hardware people on WS-4, surface people on WS-2/WS-3, one writer on WS-7. Afternoon: WS-5 if the optical rung owner is free, WS-6 as the integrating thread. End-of-day demo, in order: enroll on a phone (WS-1) → restore air-gapped (WS-3) → anchored root verified from a second machine (WS-2) → encrypted hello from the Safe 7 with fingerprint words on its screen (WS-4).

## Standing risks, named

The fork tax: bSAFE 7 must track upstream trezor-firmware security patches forever — set the rebase cadence now, let `fido2-tests` + `trezor-user-env` be the regression net (and add an hmac-secret/PRF conformance check, since the passkey rung's determinism depends on it). The vendor 404: `t3w1/authenticity.json` is still missing upstream, so device-genuineness attestation stays blocked on Trezor regardless of fork status — bSAFE 7 needs its own signed definitions/authenticity story (template: the `data` repo layout). And the license ledger stays clean as built: engine adapts GPLv3 patterns into the AGPL-3.0-only kernel (compatible), noise-rust is public domain, btleplug BSD-3, nayuki QR MIT.
