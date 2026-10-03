# bSAFE 7: firmware custody and PQ integration audit

2026-10-02, America/Denver. Source audit; no device, firmware build, flashing,
signature, payment or upload was performed. The intended architecture remains
our wallet UI -> bSigner -> native bSAFE host -> bSAFE firmware on Safe 7,
with confirmation on the hardware. Stock Trezor Connect is a separate existing
route, not a replacement for this plan.

## Source provenance

The firmware is located at `C:/Users/travi/source/trezor-firmware`, with origin
`https://github.com/beehive-nature/Trezor-firmware-dApp`.

| Source | Observed revision | Meaning |
|---|---|---|
| Local firmware HEAD | `9330ef0607658a41eaa97c8e473b65e80844c23b` | EOS screen repair; 13 commits beyond origin/beehive |
| Fetched origin/beehive | `4524b956222e81d1c1073ce74f0e362bae758bbf` | Published firmware branch |
| Fetched origin/main | `bcc81240dd4e691e5a4a69ca76644017dea76773` | Initial commit; no merge base with the previously fetched upstream/main |
| Fresh upstream/main | `59f16c066fc616ad7985c9fedabec339b312b09c` | 2026-10-02 external app orchestration |

`git rev-list --left-right --count HEAD...upstream/main` returned `641 723`.
These are divergent commit counts, not a count of security fixes. Upstream
security reconciliation is outstanding. The earlier local upstream ref was
`ded1c141b643b57ef3a4f9a71d7a2fb2ced083a6` from July 31.

The checkout contains tracked modifications, untracked Zano crypto work and
modified submodules. Windows reported inaccessible vendor/reparse paths
(`Function not implemented` / os error 1920). None were reset, cleaned,
staged or overwritten. This checkout cannot be described as a reproducible
release. Git fetch updated refs, not working files.

## Findings grounded in source

Firmware paths below refer to local HEAD above. A focused `git diff --quiet HEAD`
over common/protob, authenticate_device.py, mcu_attestation and secret_keys
returned 0, so those inspected working files match that commit.

| Layer | Source and function | Finding / boundary |
|---|---|---|
| PQ boot verification | `core/embed/sec/image/stm32/boot_header.c::boot_header_check_signature` | Verifies Ed25519 and SLH signatures. Source presence does not identify the installed boardloader or establish the signing authority of a custom release. |
| PQ device authenticity | `core/embed/sec/mcu_attestation/mcu_attestation.c::mcu_attestation_sign` | Uses mldsa-native with a device-authentication seed and fresh signing randomness; wipes seed, private key and randomness on exit. This is device attestation, not wallet/user signing. |
| Attestation key origin | `core/embed/sec/secret_keys/stm32u5/secret_keys.c::secret_key_mcu_device_auth` | Derives from SECRET_PRIVILEGED_MASTER_KEY_SLOT and KEY_INDEX_MCU_DEVICE_AUTH. It is not derived from the user's recovery mnemonic. Never repurpose it as a bzDiD key. |
| Attestation protocol | `core/src/apps/management/authenticate_device.py::authenticate_device` | Refuses an unlocked bootloader. Domain-binds the challenge to AuthenticateDevice; MCU proof requires stream=true. Custom firmware authentication must be assessed against these actual restrictions. |
| User PQ protocol | `common/protob/*.proto` | No ML-DSA/ML-KEM user-signing or key-establishment message found in the bounded search. MCU proof fields are not a general signing API. |
| Host channel | `rust/bsafe-host/thp/src/lib.rs::NOISE_PATTERN` | Noise_XX_25519_ChaChaPoly_BLAKE2s is the implemented classical channel. It does not establish PQ confidentiality. |
| Physical transport | `rust/bsafe-host/host/src/lib.rs`, `spike/SPIKE.md` | Memory transport and a BLE interface sketch; the spike documents the emulator/protobuf and physical legs as subsequent work. A loopback approval string is not an on-device signature. |
| Hardware signer | `crates/btrezor/src/lib.rs`, `channel::RefusingSigner` | Explicitly refuses signing; intended as a bSigner backend. This is not evidence that every other Trezor payment adapter is nonfunctional. |
| Software PQ | `crates/bsigner/src/pq.rs::dsa_generate`, `dsa_sign`; `keys.rs::keygen_dsa`, `keygen_kem` | ML-DSA/ML-KEM code exists on the host. Seed files are host custody, not Safe 7 custody. Existing source says independent audit, ACVP vectors and encrypted-at-rest storage remain outstanding. |
| Browser recovery | `surfaces/onboarding/bzdid-key.js::encodeRecoveryPhrase`, `decodeRecoveryPhrase`, `deriveRecordKey`, `deriveK1Key` | BIP-39 directly encodes a 32-byte root; current derived signers are Ed25519 and secp256k1. No proven recovery relationship to bSigner seed files, device-authentication keys or a future bSAFE PQ user key. |

## Implementation sequence and acceptance gates

1. **Release source:** preserve the existing firmware checkout; create an isolated
   build checkout from an explicitly identified commit with pinned submodules.
   Reconcile the 13 unpublished commits and upstream security changes before
   naming a release. Record toolchain, T3W1 build flags, debuglink exclusion,
   image digest, vendor-header/update-signing policy and repeat-build comparison.
2. **Native hardware connection:** reuse the firmware's upstream THP implementation
   and official protobuf definitions where compatible. Verify the host against
   the chosen firmware, including pairing rejection and reconnect. Do not treat
   our generic Noise loopback as protocol interoperability evidence.
3. **User key custody:** define a separate versioned, domain-separated user-key
   derivation and message API. Keep attestation keys separate. Reuse suitable
   audited PQ implementations after target memory/latency measurements; bSigner's
   host implementation is a reference/interoperability candidate, not firmware
   that can simply be transplanted. Never silently fall back to host keys.
4. **Recovery and migration:** prove deterministic restore on a second clean
   emulator using disposable fixtures; test wrong phrase/passphrase, algorithm
   version and context. Establish whether the user authorizes an existing
   Trezor-root derivation or an independently backed-up identity root before
   enrolling real keys. Do not import a Trezor backup into the browser.
5. **Transport and identity verification:** treat PQ signatures, channel secrecy
   and identity rotation as separate properties. Specify a reviewed standard
   hybrid channel before making a PQ confidentiality claim. Require explicit
   algorithm binding, replay rejection, downgrade refusal and rotation evidence.
6. **Device acceptance:** only after reproducible emulator/build evidence, run a
   founder-present ceremony against a named firmware image. Prove cancel/refusal,
   displayed message intent, signature verification and recovery. Firmware
   installation needs a separate concrete device action; this audit authorizes
   neither flashing nor spending. External chain signatures retain chain rules.

These gates prevent a firmware attestation signature or a software PQ signature
from being mislabeled as a recoverable, hardware-held PQ identity.

## Changes shipped with this audit

- Add bSAFE and bSigner PQ to the shared catalog for all three stack views.
- Correct bSigner's ambiguous "keys never leave the device" comment to identify
  host seed-file custody explicitly. No executable cryptography changed.
- Keep the seven existing genealogy screenshot artifacts unstaged and unchanged.

Validation: regenerate the catalog, check deterministic output, check source
links and run git diff --check. No cryptographic tests were run: these changes
are documentation/catalog changes and cannot validate hardware integration.
No emulator, local web server or formal-verification run was started.

Upstream-priority check: x0x #622's latest comment returns remaining work to
#504 and requires the delivered/published matrix; #505 remains closed. No new
mesh evidence or backend acceptance is claimed by this firmware audit.
