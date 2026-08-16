# RECEIPT — AuthenticateDevice primitives verified (goose, 2026-08-15 18:28)
**Purpose:** Seat 3's visual-attestation idea ("derive the art from an AuthenticateDevice
signature — fresh per challenge, only this device can produce it") builds on three claims.
All three verified at source this session (`fw:` = `C:/Users/travi/source/trezor-firmware`
@ `9330ef0607`, tracks upstream `ded1c141b6`). No endorsement of the idea — primitives only.

| Claim | Verdict | Receipt |
|---|---|---|
| Caller-chosen nonce/challenge | **YES** | `fw:common/protob/messages-management.proto` L400-403: `AuthenticateDevice { required bytes challenge = 1; optional bool stream = 2 }` |
| Three per-device attestation roots | **YES** | proto L410-425: `AuthenticityProof` carries optiga (certs+sig), tropic (certs+sig), mcu (certs+sig); handler signs all three: `fw:core/src/apps/management/authenticate_device.py` |
| One root post-quantum | **YES — the MCU root, ML-DSA (FIPS 204)** | `fw:core/embed/sec/mcu_attestation/inc/sec/mcu_attestation.h` L24-32: `#include <mldsa_native.h>`, `MCU_ATTESTATION_SIG_SIZE = MLDSA_BYTES(MLD_CONFIG_API_PARAMETER_SET)`; `mcu_attestation.c` L64-83 `mldsa_signature_internal(...)`. Corroborated: `fw:core/embed/models/T3W1/model.toml` — `bootloader_header_tool = "headertool_pq"` + feature `mcu_attestation` |

**Material details for anyone building on it:**
1. **The PQ root only answers in streaming mode** — handler: `if utils.USE_MCU_ATTESTATION and msg.stream:` …
   a non-streaming (legacy) call returns optiga + tropic only. Call with `stream=True` and pull
   the ML-DSA proof via `GetAuthenticityProofChunk` (`proof_type=MCU`), by design since PR #6893
   ("don't send MCU attestation in one large response").
2. **Gates:** bootloader must be locked (`bootloader_locked()`, else ProcessError) + an on-device
   `confirm_action` Allow press. No PIN unlock required — the flow is usable exactly where the
   bComb-art compose would need it.
3. Signed payload construction: compact-size-prefixed `"AuthenticateDevice:"` header + challenge
   (handler L33-38); optiga signs SHA-256 of it, tropic and mcu sign it directly.
4. `mcu.sign` MicroPython surface: `fw:core/embed/upymod/modtrezorcrypto/modtrezorcrypto-mcu.h`
   (get_certificate + sign, fixed-size `MCU_ATTESTATION_SIG_SIZE` output — ML-DSA's fixed
   signature length, PQ-consistent).

**Status of adjacent lanes:** Safe 7 still absent from this box (0 `VID_1209` at every check
16:0x-18:28) — `thp_pair_receipt.py` remains staged for the plug-in moment.
