# SAFE 7 public accounts, Rust Solana evaluation, bSAFE firmware bench

2026-10-03 · Codex · continuation of PR #334.

The founder asked to continue the Solana/Rust/settlement evaluation through their
Trezor SAFE 7 and then bSAFE 7 custom firmware. This delivery implements public
account sync in the existing wallet and an offline Rust settlement boundary,
with a pinned T3W1 firmware emulator interoperability bench. Physical-device,
live settlement and production-firmware acceptance remain separate results.

## Public accounts now have a Trezor entry point

`surfaces/wallet.html` → **see what i have → Accounts & following → Sync Trezor
public accounts**. This extends the existing account book; it does not create a
second wallet or change bPay's connected signer.

- Solana: explicit account number, Suite four-level path or three-level compatibility path (corrected during the wallet review).
- Arbitrum/Base: explicit EVM account number and its public address.
- Bitcoin native SegWit: import the account zpub from `getPublicKey` with device
  display requested. `getAccountInfo` reads the public descriptor's confirmed
  account balance, covering discovered receive and change addresses. This is
  not a single receiving-address balance. Gap-limit/backend coverage still
  applies. Taproot descriptors are not implemented in this slice.
- Manual xpub/ypub/zpub entries can be saved to My accounts or Following.
  Account-depth, public version, checksum and compressed-key shape are checked.
- Returned derivation paths must match the request. Duplicate accounts,
  cancellations, init failures and mismatched Bitcoin responses do not become
  successful imports/reads. Label edits preserve public derivation provenance.
- Only public metadata is stored locally. Bitcoin account keys disclose linked
  activity to the reader service; this is explained before import. Trezor Connect
  loads its official versioned 9.7.3 URL with SHA-384 integrity on a click and
  explicitly routes through hosted Trezor Suite web. Physical SAFE 7 pairing is
  not accepted by the fixture tests. Reloading a saved Bitcoin account does not
  automatically load the SDK. See heart-wallet-unification for the later repair receipts.

Source functions: wallet address-book `validate`, `connectTrezor`,
`readBitcoinAccount`, `trezorSelection`, and the Trezor form submit handler.
Device-export provenance is informational, not proof of ownership/attestation.

## Rust boundary

`crates/settle-solana` is a new kernel workspace member. `prepare` uses Anza's
pinned message/system-instruction constructors for one native SOL transfer and
an intent-hash memo. `verify_signature` uses dalek `verify_strict` over those
exact bytes and rechecks the supplied network, height and fee observations.
`reconcile` requires a successfully finalized RPC observation, matching slot,
bounded final fee and the exact signed transaction bytes. Missing error fields
are refused. A signature is not a settlement.

The input requests the devnet genesis identity; supplied RPC observations are
not authenticated by this offline program. No RPC client, key custody or
broadcast exists. Authority/proof references are opaque evaluation labels;
receipts explicitly set `authority_verified` and `proof_verified` to false.
The memo binds references to the transaction but does not verify Groth16 or
authorize payment. Production bPay authorization, a durable attempt ledger,
fee sponsorship, live submission, comparative Vaulta execution and Token-2022
remain outstanding. Usage and evidence schema: `crates/settle-solana/README.md`.

## Firmware source and runtime

The source inventory rechecked the existing bSAFE audits/build receipt. The
Windows firmware checkout remains at `9330ef0607658a41eaa97c8e473b65e80844c23b`
with other work and modified submodules. It was left intact. The earlier audit
records missing tracked Zano inputs in that newer source. A fresh Linux clone
at published `4524b956222e81d1c1073ce74f0e362bae758bbf` provides the bench baseline
(firmware 2.12.4), not a current-upstream release approval.

New harness: `tools/firmware/solana-emulator-bench.py`. It checks source/submodule
pins and a clean tree, creates only temporary emulator profiles, loads a fixed
public BIP39 test vector, and exercises T3W1 Solana signing through official
trezorlib. It never enumerates/selects USB or Bluetooth devices. Two fresh
profiles must produce matching public addresses/signatures; Rust must reject an
altered intent. Debug-link interaction is for the emulator only.

Build command in `/home/travi/wt-codex-bsafe-solana`:

```sh
nix-shell --run 'uv run --frozen xtask build firmware --emulator --model T3W1 --pyopt false --debug-link true'
```

Runtime receipt: `docs/receipts/bsafe-solana-emulator-2026-10-03.json`.
**Two fresh T3W1 2.12.4 emulator profiles passed**, using official trezorlib THP
over localhost UDP. Both exported the same public-vector address and signed the
Rust-built message. Rust verified each signature and refused an altered amount.
The emulator displayed the recipient, 0.000001 SOL amount, intent memo and
0.000005 SOL fee. The receipt contains the captured screen text and emulator/Rust
binary hashes. This proves official-client emulator interoperability, not the
unfinished native bSAFE host or physical transport. No transaction was broadcast.

Build/launch corrections, retained as failures:

1. `xtask build emulator --model T3W1` exited 2: `invalid value 'emulator' for
   '<PROJECT>'`. The correct project is `firmware --emulator`.
2. The optimized emulator compiled, but the debug runner exited 1 with
   `ImportError: can't import name get_gc_info`. The default `pyopt=true`
   omitted debug helpers. The final build explicitly disables pyopt and enables
   debug-link. No firmware-source patch was needed for that configuration fix.

Local logs: `/home/travi/bsafe-solana-emulator-build*.log` and
`/home/travi/bsafe-solana-emulator-bench*.log`. Initial runs are not success
receipts. The existing reproducible embedded-image receipt is retained at
`docs/receipts/bsafe-build-baseline-2026-10-02.json`; this emulator exercise does
not convert those development images into approved installation candidates.

## Validation and remaining device work

- Chromium public-account suite: **44/44** (mock RPCs).
- Chromium Trezor suite: **19/19** (fake bridge; gesture, retries, paths,
  cancellation, duplicates, Bitcoin account binding, exact large balances,
  provenance after rename and mobile layout).
- Wallet register suite: **125/125**.
- The earlier PR head `ef190a5a3` failed the wallet funding suite's phone-fold
  check in both push and PR CI. Its account book preceded the balance cards.
  This continuation moves the book below the cards and fixes the test to
  measure the actual balance control, rather than half the growing section's
  height. A negative control pushes that control below the viewport and must
  be detected. Final funding suite: **97/97**, including that negative control.
- `cargo test --locked -p settle-solana`: **8/8** integration tests, including
  tampering and refusal branches; library/bin/doc test targets also exited 0.
- `cargo clippy -p settle-solana --all-targets --locked -- -D warnings`: exit 0.
- Estate check, R5 surface audit, and `git diff --check`: exit 0.
- Windows PnP query by Trezor name returned no device. No physical export,
  signature, transfer, bootloader unlock or flash was performed.

Earlier CI also had one push-only failure in the unmodified
`e2e/plur-festival-entry.test.mjs:75` (`raver: the press lands on the section`);
the PR run's eternal job passed at the same head. This dispatch does not call
the whole PR green on the strength of the focused local checks.
Build/runtime logs and local browser captures are retained at
`C:/Users/travi/bsafe-build-20261003/`.

For physical acceptance: first read/display matching stock-device accounts;
then exercise a user-controlled test transaction and cancellation, compare the
device's destination/amount with the Rust intent, verify its returned signature,
and independently capture final settlement evidence. No agent-supplied seed,
no mainnet trial and no conflation of mock success with hardware acceptance.

Before a custom image: reconcile the unpublished firmware work, review upstream
changes/security fixes, pin complete source/toolchain/submodules and repeat the
embedded build, then finish native-host interop and physical acceptance. The
existing `rust/bsafe-host` Noise/transport tests do not establish that physical
connection. Neither this bench nor the old audit proves device-held user PQ
keys; device attestation and user wallet signing are different capabilities.

Trezor documents that bootloader unlock permanently removes access to factory
attestation; restoring official firmware does not undo that. A firmware image
and a founder-reviewed device ceremony must be concrete before that irreversible
step. Nothing in this dispatch authorizes or performs it.

Sources checked 2026-10-03:
[public-key export](https://connect.trezor.io/9/methods/bitcoin/getPublicKey/),
[account reads](https://connect.trezor.io/9/methods/bitcoin/getAccountInfo/),
[Solana address export](https://connect.trezor.io/9/methods/solana/solanaGetAddress/),
[Solana signing](https://connect.trezor.io/9/methods/solana/solanaSignTransaction/),
[SAFE bootloader unlock](https://trezor.io/learn/security-privacy/how-trezor-keeps-you-safe/unlocking-the-bootloader-on-trezor-safe-devices),
[Trezor architecture](https://docs.trezor.io/trezor-firmware/core/embed-arch/embed-arch.html).

Upstream priority was checked earlier in this lane: x0x #622 redirects remaining
measurement work back to #504 as of September 30; #505 field evidence was
accepted September 15. This local wallet/firmware bench adds no claim of x0x
field acceptance and sends no upstream message.
