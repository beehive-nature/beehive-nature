# HANDOFF 2026-10-04 — post-quantum user signing on the Safe 7 (T3W1)

**For:** a fresh Opus or Fable session. **From:** Seat 3, after the PQ layer and its polish landed
on `main` (`be745ca7f` … `60fbe482a`). **Repo of the work:** the founder's PRIVATE trezor-firmware
fork. **Repo of this note:** `beehive-nature` (PUBLIC: nothing secret goes here or in a commit
message).

## 0 · Read first, in this order

1. `docs/dispatches/2026-10-02-bsafe-pq-audit.md`: the six acceptance gates (release source,
   native connection, user key custody, recovery, transport, founder-present device ceremony).
   This handoff executes gates 1 to 4 on the emulator. It authorizes neither flashing nor spending.
2. `docs/specs/SPEC-BPQ-1.md` §2 (key derivation, frozen labels) and §3 (card, binding, detached
   signature). The device must produce keys and ids byte-identical to `surfaces/bpq.js` and
   `crates/bsigner/src/bpq.rs`, checked against `surfaces/bpq-vectors.json` and
   `surfaces/pq-kat.json`.
3. `docs/RULINGS-2026-10-04.md` (R2: the phrase-only `root` context for "only me").
4. `docs/BSAFE-DEVICE-1.md` §4, the OS law: an app gets a hardened child seed for its context; no
   app touches master key material.
5. `docs/dispatches/DISPATCH_TREZOR_OPTICAL_LANE.md` (§4 and :113) and
   `docs/dispatches/2026-10-03-safe7-solana-settlement.md` (:136-148): do not flash the founder's
   Safe 7; bootloader unlock is irreversible, wipes the seed, ends device attestation and needs a
   founder-reviewed ceremony.

## 1 · The fork as found (scouted 2026-10-04, read-only)

- **Windows clone** `C:\Users\travi\source\trezor-firmware`, branch `main` at `9330ef0607`;
  remotes `origin` (the private fork) and `upstream` (trezor/trezor-firmware). It is **13 commits
  ahead of `origin/beehive` (`4524b95622`), unpushed** (the Zano lane, EOS strings).
  `core.symlinks=false`, `autocrlf=true`: ~98 "modified" files are line-ending and symlink
  artifacts (`git diff --ignore-cr-at-eol` is empty).
- **A fresh clone does not build:** `crypto/zano/clsag_ggx.c/.h`, `zano_generators.c/.h`,
  `schnorr.*` and their tests are **untracked**, yet `SConscript.firmware:214-216`,
  `SConscript.unix:196-199` and `rtl/build.rs:185-188` compile them.
- **WSL clones:** `~/trezor-firmware` on `beehive` at `4524b9562` (clean, has `core/build`);
  `~/trezor-firmware.upstream` detached at `0cd72f033` with an uncommitted EOS/T3W1 experiment;
  `~/wt-codex-bsafe-solana` on `beehive`. Do not disturb other lanes' trees.
- **Build:** Safe 7 is model `T3W1` (`core/Makefile:31`); emulator via
  `xtask build firmware --emulator -m t3w1` (`BEEHIVE.md`), debug emulator with
  `--pyopt=false --disable-tropic`. Whether HEAD links for T3W1 hardware is UNVERIFIED.

## 2 · What upstream already has (do not confuse with user signing)

- **ML-DSA-44 MCU device attestation**: `vendor/mldsa-native` (submodule `db65535`, default
  parameter set 44, `MLD_CONFIG_NAMESPACE_PREFIX=mldsa`, `MLD_CONFIG_NO_RANDOMIZED_API=1`),
  used only in `core/embed/sec/mcu_attestation/mcu_attestation.c:63-96`, seeded from
  `secret_key_mcu_device_auth` (a factory key, not the mnemonic). **Never repurpose it as a
  bzDiD or user key.**
- **SLH-DSA-SHA2-128s + Ed25519 boot header** (`sec/image/stm32/boot_header.c:50-105`, boardloader
  under `boot_ucb`). The firmware image itself is still checked with classical CoSi Ed25519.
- No user-facing ML-DSA/ML-KEM message exists in `common/protob/*.proto`.

## 3 · The identity root: RULED (A), 2026-10-04 (`docs/RULINGS-2026-10-04.md` R4)

**Which root does the device's PQ identity come from?** Two shapes, each consistent with some law:

- **(A) Device-native child identity.** Derive a PQ seed from the device's own seed through a
  versioned, domain-separated path (BSAFE-DEVICE-1 §4: a child seed, never the root). It yields a
  **different `bzpq1` id** from the wallet's; the wallet's id and the device id are tied by a
  SPEC-BPQ-1 §3 binding signed by both (a claim such as `bsafe-pq=<device id>`). Keys never leave
  the device; nothing is imported anywhere.
- **(B) Same id as the wallet.** The device holds the bzDiD root itself (the 24 words are
  `entropyToMnemonic(masterPrk)`, `onboarding/bzdid-key.js:4958-4961`; a BIP-39 device backup can
  return the 32 bytes via `crypto/bip39.h:51 mnemonic_to_bits`; a SLIP-39 backup cannot). This
  means loading the bzDiD phrase onto the device, which collides with the audit's gate 4 ("establish
  whether the user authorizes an existing Trezor-root derivation or an independently backed-up
  identity root") and with BSAFE-DEVICE-1 §4.

**Ruled (A)** by the founder on 2026-10-04 ("anchor away", R4). Build (A): a versioned,
domain-separated child seed of the device's own seed (name the derivation path and version in the
fork's docs before coding it, and keep it apart from every existing coin path and from the MCU
attestation key); its own `bzpq1` id; the binding to the wallet id is signed by both ids, with the
device's signature made on the device. (B) is closed: no phrase goes onto the device.

## 4 · Hard constraints measured

- **Stack:** firmware app stack 32 KiB (`sys/linker/stm32u5g/firmware.ld:58-60`), kernel 12 KiB,
  **secmon 80 KiB** (`secmon.ld:80-82`, of 96 KiB secmon RAM). Heap to end of AUX1 (~800 KiB).
- **mldsa-native ML-DSA-65** (`mldsa_native.h:915-939`): keypair 85,856 B / sign 80,576 B /
  verify 62,432 B; with `MLD_CONFIG_REDUCE_RAM` 50,048 / 44,768 / 30,720 B. Signing does not fit
  the 32 KiB app stack either way: run it in secmon (precedent: ML-DSA-44 attestation, sign
  52,896 B) or move working memory to the heap with `MLD_CONFIG_CUSTOM_ALLOC_FREE` (`:900`).
  Building parameter set 65 alongside the existing 44 needs a second namespace prefix.
- **Sizes:** pk 1952 B, sk 4032 B (keep the 32-byte seed ξ, not the sk), signature 3309 B. Mind
  protobuf message size limits and the display of what is signed.
- **Signing mode:** SPEC-BPQ-1 signs with an empty context string. Whether noble's ML-DSA signs
  hedged or deterministic is UNVERIFIED; cross-check signatures by verification in the other two
  implementations, and keys by byte equality (KeyGen from ξ is deterministic).
- **Wallet path:** stock Trezor Connect cannot reach a new message (it blocks uncatalogued calls
  client-side). The route is the native one in the audit: wallet UI → bSigner → bSAFE host →
  bSAFE firmware (`crates/btrezor/src/channel.rs:80-110` `SignerChannel`, which today has only
  `RefusingSigner`; `rust/bsafe-host/thp`). The host channel is Noise_XX (classical); a PQ
  signature over it is still a PQ signature, but the channel makes no PQ confidentiality claim.

## 5 · Plan (emulator only)

1. **Release source (gate 1).** Commit the untracked `crypto/zano/*` files the build already
   needs, then push the 13 commits to the private fork's `beehive` branch (private repo; never to
   upstream). Record toolchain and the exact build command. Make a clean isolated build checkout
   from that commit and confirm `xtask build firmware --emulator -m t3w1` builds there.
2. **ML-DSA-65 in firmware.** Add the 65 parameter set from the vendored mldsa-native under its
   own namespace; deterministic KeyGen from a 32-byte ξ; sign with empty ctx; run in secmon or with
   heap working memory per §4. Unit-test KeyGen against `pq-kat.json` keyGen cases and against
   `bpq-vectors.json` `dsaPublicKey` rows (vector roots only, never a real phrase).
3. **Message API.** `BpqGetCard` (returns the public card: ML-DSA pk, X-Wing pk if in scope,
   succession commitment, id) and `BpqSign` (domain-tagged: card, binding, detached file hash; the
   device shows what it signs and the id). Protobuf in a new `messages-bpq.proto` following the
   Zano lane's pattern (`messages-zano.proto`, ids in `messages.proto`, generated
   `core/src/trezor/messages.py`, app in `core/src/apps/bpq/`, routing in
   `apps/workflow_handlers.py`). Seeds and secret keys never cross the wire; wipe on exit like
   `mcu_attestation_sign`.
4. **Cross-check (the oracle is foreign to the device).** On the emulator, from a vector root:
   the card the device returns must equal the card `bpq.js` and `bsigner` make for the same root
   and context; a device signature must verify in both. Add the emulator script and its pasted
   output to the fork, and a receipt to this repo.
5. **Stop** before any hardware step. Write the ceremony plan for gate 6 (named image digest,
   cancel/refusal, displayed intent, recovery on a second clean emulator) as a dispatch for the
   founder.

## 6 · Laws that bind every step

- No agent holds, requests or transmits private key material; emulator fixtures use the public
  vector roots only. No real phrase is typed by an agent anywhere.
- No flashing, no bootloader unlock, no mainnet act. "Needs the device in hand" means the
  founder's hand, at a ceremony he has reviewed.
- Build, test and commit in WSL (`source ~/.cargo/env`); the Edit tool writes CRLF, so normalize
  anything a shell runs. Never `--no-verify`. Reviews are read-only subagents.
- Wording ceiling: "sound by construction / isolated by design"; never "quantum-secure"; a PQ
  signature from the device is not PQ channel confidentiality and not device attestation.
- Receipts: every claim of done carries the command and its real output.

## 7 · Paste this to start the fresh session

> Read `beehive-nature/docs/dispatches/2026-10-04-safe7-pq-signing-handoff.md` and every file in
> its §0, in order, plus `docs/RULINGS-2026-10-04.md` R4 (identity root ruled: option A). Then
> execute its §5 steps 1 to 4 on the emulator only. No flashing, no unlock, no real
> phrase, no mainnet. Report done and pending only, with receipts.

## 8 · Status, 2026-10-04 (Seat 3, emulator only)

- **Steps 2 to 4 done on the emulator.** Fork branch `bpq-safe7` (private repo), code at
  `db92c2566`, receipts at `e4efbb7c8`, based on the published `beehive` commit `4524b95`.
  The device card equals what `bpq.js` and `bsigner` derive for the same PRK and context; its
  binding and detached signature verify in both; the R4 binding holds both ways (device names
  the wallet id, wallet names the device id under `bsafe-pq`); `root`, a two-statement request,
  a malformed `at` and an on-screen cancel are refused; a second fresh profile gives the same
  card. Derivation: SLIP-21 `["BZPQ-DEVICE", "v1"]` of the device seed (fork
  `docs/bpq-device.md`). Receipt: `docs/receipts/bpq-safe7-emulator-2026-10-04.json`.
- **Step 1 partial.** A clean clone of `4524b95` builds the T3W1 emulator. Committing the
  untracked `crypto/zano/*` files and pushing the 13 unpublished commits was refused by this
  session's permission classifier and was not attempted another way; it is still open, and
  `bpq-safe7` will need rebasing onto `beehive` once it lands.
- **Not claimed:** hardware fit (UNVERIFIED; no hardware image contains the app), channel
  confidentiality, device attestation. Step 5 not started.
