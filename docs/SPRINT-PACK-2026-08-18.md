# BNR Sprint Pack · 2026-08-18
### Everything from today's build session, verified and ready for tomorrow's sprint.

**Start here:** `docs/SPRINT-FINISH-LINE-MAP.md` — decision gates G1–G6, workstreams WS-1…WS-8, day sequencing, and the pinned cross-implementation test vector.

## Contents

```
docs/
  SPRINT-FINISH-LINE-MAP.md        the map (incl. WS-8 dice-roll entropy, founder-directed)
  BSAFE-DEVICE-1.md                bee-native device seed spec (three-lane sensor law, child-seed OS)
  BNR-LAB-1.md                     hardware lab charter — L-1..L-4 RATIFIED 2026-08-18
  HARDWARE-CUSTODY-REVIEW.md       full open-hardware / air-gap review + assembled ladder
  filekey-for-bdid-review.md       FileKey take/leave (round 1, pre-codebase)
  filekey-bdid-integration-review.md  FileKey vs the actual six repos, file-by-file
  trezor-repos-bdid-assessment.md  the 14 trezor-org repos: takes, leaves, Rust-host finding

key-build/bdid-key/
  src/bdid-key.js                  the engine: PRF→master_prk→Ed25519, BIP39 24w, bdidrec codes,
                                   fingerprint words, persona nullifiers, R1b-strict verify
  dist/bdid-key.vendor.js          bundled ESM (all deps vendored)
  dist/bdid-key.iife.js            bundled IIFE — global BDIDKEY; this is what the surface loads
  test/test.mjs                    26 tests, all green; pinned vectors any Rust port must match
  → setup: npm i @noble/curves @noble/hashes @scure/bip39 @scure/base esbuild
  → run:   node test/test.mjs

surfaces/
  onboarding/index.html            PATCHED surface: UV=required, residentKey, PRF ladder,
                                   real 24-word BIP39, live restore, PREVIEW auto-flips
  onboarding/bdid-key.js           the IIFE engine, named as the page expects — keep adjacent
  onboarding.patch                 unified diff vs beehive-nature/surfaces/onboarding/index.html
  bdid-recover.html                offline recovery tool — zero network requests, self-contained
  hardware/                        the 4-page education surface:
    index.html                       open hardware guide (direct links, FOSS only, excluded list)
    security.html                    security events (leads with Coldcard RNG failure, corrected)
    build.html                       become a producer (builder ladder, EDC/Tomorrowland, sandbox study)
    lab.html                         ⬡ the lab (science+art reviews, comb score, complementary gear)

rust/bsafe-host/
  thp/                             THP frame codec + Noise XX channel (noise-rust family)
  host/                            Transport trait, mem loopback, BLE spike checklist (feature "ble")
  → run: cargo test   (4/4 green; ~/.cargo needs crates.io access)

e2e/e2e.mjs                        Chromium e2e for the patched surface — CTAP2 virtual
                                   authenticator WITH PRF; 6/6 green
  → run: npm i playwright && node e2e/e2e.mjs   (expects surface at surfaces/onboarding/... — adjust root path in the script)
```

## Verified state (what "done" meant today)

- Engine: 26/26 unit tests; bundle re-verified against pinned vector after bundling.
- Surface: 6/6 e2e in real Chromium incl. full PRF ceremony + deterministic re-assertion + phrase restore.
- Recovery tool: headless round-trip vs pinned vector; no-network scan clean.
- Rust: `cargo test` 4/4 — frame refusals, Noise XX handshake/transport/tamper, prologue mismatch, full stack over mem transport.
- Hardware pages: HTML parse-checked, Chromium-rendered, screenshots reviewed.

## Pinned cross-impl vector (Rust port must reproduce byte-identically)

```
prf_secret = 0x01 × 32
master_prk = d54134a6b181fd7af5a3870446d9a91b73b551ed3ef52f153841a73be093d4ac PUBLIC-CONSTANT
context    = "bnr.b"
ed25519_pk = 761e0ec527d094b3b5afe40a5f8c78b0be8c54e7c9cf6d79bf62255625a84591 PUBLIC-CONSTANT
fp_words   = "lock robust differ helmet baby stable"   fp_hex = 837768f7
phrase[0..3] = "stem answer claim"
```

## Standing rulings carried in this pack

Cryptography doctrine: boring primitives only, protocols not primitives, self-authentication (per D. Irvine practice — ratified). G3 leans BC-UR for optical framing (ratify at sprint open). BNR-LAB-1 ethics law L-1..L-4: **ratified 2026-08-18**. Labels (`BDID-v1/…`, `bdidrec`, `BSAFE7-THP-v0`) are normative-once-ratified — G2 at sprint open, before anything derives on mainnet.

*Derivation pattern adapted from FileKey (GPLv3 → AGPL-3.0-only kernel, compatible via GPLv3 §13). All vendored deps: MIT/Apache/public-domain (noble/scure/nayuki/noise-rust).*
