# THP_TRANSPORT_MATRIX.md — the Safe 7 handshake, mapped at source
**From:** goose (Seat 1 hands) · answers `DISPATCH_GOOSE_THP_MATRIX_2026-08-14.md` · **Date:** 2026-08-15
**Method:** L-VERIFY — every row cites a file path read this session. `fw:` = local firmware checkout
`C:/Users/travi/source/trezor-firmware` (beehive fork, local `main` @ `9330ef0607`, tracks upstream `trezor/trezor-firmware` `upstream/main` `ded1c141b6` "fix(rust/trezor-thp): channel desync after incorrect ACK" — i.e. THP code present and current). `bn:` = `C:/Users/travi/beehive-nature`. No physical device was attached to this box during the session — device-behaviour rows that rest on code only are marked **UNVERIFIED-on-device**.

**TL;DR verdicts**
1. **Bridge (trezord) = v1-ONLY, released and master.** No THP code exists in trezord-go. But the Safe 7's THP mux *answers v1 packets by design* (CodecV1 compat), so the v1 GetFeatures lane should work TODAY — one device receipt owed.
2. **Connect 9.7.3 web has no THP lane at all** (zero `Thp` strings in the shipped web bundle; its webusb transport has no THP logic). That is the wall the founder hit.
3. **python trezorlib (pip 0.20.2 == repo main) CAN pair a stock Safe 7 over USB, no debuglink** — CodeEntry flow where a human rewrites the code from the device screen. Fastest working lane for receipts.
4. **The full THP spec surface is in-tree in Rust already** (`fw:rust/trezor-thp`) — a Rust host implementation is *porting*, not *designing*.
5. **BLE lane is real and GATT-mapped** (UUIDs below); one THP framing serves USB + BLE; recommend relay-native BLE (btleplug) before Web Bluetooth (Safari/iOS/Firefox absent — worse than BarcodeDetector).

---

## §1 trezord-go (Bridge) × T3W1 — does the released Bridge speak to it at all?

| Question | Verdict | Receipt |
|---|---|---|
| Does trezord-go implement THP? | **NO — v1 protocol only.** Case-insensitive grep for `thp` across all `.go`/`.md` at master matches exactly one line: `server/http.go:54 statusRouter := r.PathPrefix("/status")` — the substring in "Pa**thp**refix". | trezord-go master cloned to `%TEMP%/trezord-go` this session |
| Released version | `VERSION` = **2.0.34 unreleased**; CHANGELOG latest released = **2.0.33** (2023-04-19, "in Trezor Suite"); `git ls-remote --tags` shows **no v2.1.x/v3.x** ever tagged | `trezord-go/VERSION`, `CHANGELOG.md`, tag listing |
| Will it enumerate a T3W1? | **Yes, by USB ID.** trezord matches VID **0x1209** (libusb hard filter `VID_1209`, `usb/lowlevel/libusb/libusb.go:60`; `core/core.go:147-149` VendorT2=0x1209, ProductT2Firmware=0x53C1). Safe 7 firmware declares the **same VID:PID 0x1209:0x53C1** on its WebUSB configuration. | `fw:core/embed/io/usb/usb_config.c` L49, L64-65, L79-80 |
| Does the device accept v1 through the THP mux? | **Yes, by design.** `Mux::packet_in`: `if cb.is_codec_v1() { return self.handle_v1(packet) }`; `handle_v1` accepts `Header::CodecV1Request` (control byte **0x3F** = the v1 magic `?`) and enqueues a `CodecV1Response`. v1-compat is built into the THP-era firmware. | `fw:rust/trezor-thp/src/channel/device.rs` L164-215 |
| Cross-evidence that v1+THP coexist on one wire | trezorlib `probe()` writes a **v1 Cancel** and reads; only `Failure(InvalidProtocol)` demotes it to the THP client — i.e. the same device is expected to answer v1. | `fw:python/src/trezorlib/protocol_v1.py` L350-374 |
| THP *over* Bridge in the JS world | Scaffolded but unserved: `@trezor/transport@1.6.3` `transports/bridge.js` carries `thpState.serialize()` inside its protocol-messages body (L139-247) — but no released trezord can answer it. | transport-1.6.3 npm tarball, extracted this session |

**Consequence for `bn:crates/wallet-relay/src/trezor_bridge.rs` (Seat 3's lane):** the plumbing is right and the v1 framing (`frame_hex`/`unframe_hex`, GetFeatures=55) should succeed against **stock 2.12.4 today** — trezord enumerates 0x1209:0x53C1 and the device answers CodecV1. **UNVERIFIED-on-device** (founder's Safe 7 not attached here): if stock 2.12.4 ships with v1-compat disabled, the call stage will report it — the lane already names that failure honestly in its header comment. THP framing is a *later upgrade* for this lane, not a prerequisite. Emulator alternative exists in-tree: `fw:safe7/proof.py` + `fw:safe7-proof.sh` build/run the T3W1 debug emulator for exactly this class of receipt.

---

## §2 @trezor/transport (trezor-suite) THP status — and exactly where 9.7.3's web path stops

**Version chain (npm registry, fetched this session):** `@trezor/connect-web@9.7.3` → deps `@trezor/connect@9.7.3` + `@trezor/connect-common@0.5.1`; `@trezor/connect@9.7.3` → **`@trezor/transport@1.6.3`** + `@trezor/device-utils@1.2.0`.

| Transport in 1.6.3 | THP support | Receipt |
|---|---|---|
| `lib/thp/{send,receive,call,index}.js` | **Wire codec shipped** (framing, sync bits, encrypted-channel send/receive) | tarball listing + node grep (files with `Thp` refs: `errors.js`, `thp/*`, `transports/abstractApi.js`, `transports/bridge.js`) |
| `transports/bridge.js` | THP state plumbed through protocol-messages (**needs a THP-capable trezord — none released**, see §1) | bridge.js L13, L139-247 |
| `transports/webusb.js` (+`.browser.js`) | **ZERO thp references** — the web's USB transport cannot even start a THP channel | node grep across extracted tarball |
| `transports/nodeusb.js`, `udp.js`, `abstract.js`, `abstractApi.js` | abstractApi carries thp refs (session/pairing scaffolding); nodeusb is the native lane Suite desktop uses | same grep |

**Where 9.7.3's web path stops, row by row:**
1. `@trezor/connect-web@9.7.3` npm bundle (38 files, extracted and grepped): **zero `Thp` strings anywhere**. The web bundle ships no THP pairing flow at all.
2. Its webusb transport (1.6.3) has no THP logic → a THP-only device interaction cannot complete; pairing methods (CodeEntry UI) are not in the package.
3. Model DB: **T3W1 IS known** to 9.7.3 — `@trezor/device-utils@1.2.0` contains `T3W1` in `models.js` and `deviceModelInternal.js` (extracted + grepped). The empty WebUSB picker is *not* a missing-model problem. **UNVERIFIED:** exact picker-suppression cause (webusb claim of the THP-era interface layout under Windows is the live suspect — needs one device receipt).
4. The device-side "pair prompt that never completes" is the device correctly entering `ThpPairingRequest` (see §4 messages) the moment any host opens a THP channel — Suite mobile's deep-link handshake is THP-native and stops at the same place for third-party apps.
5. CDN cross-check attempted: `connect.trezor.io/9.7.3/iframe.js` → **404 NoSuchKey** (S3 body captured); the runtime iframe bundle path differs — **UNVERIFIED** which CDN bundle the popup loads; the npm bundle evidence stands on its own.
6. **suite develop (GitHub contents API, fetched):** `packages/transport/src` = `{api, index.ts, transports}`, `transports/` = `{nodeusb.ts, udp.ts}`, `api/` = `{udp.ts, udp.test.ts}` — THP host orchestration (ThpDeviceAccess-class code, pairing-method UI) is **not** at these paths at develop; it lives higher in Suite app code. **UNVERIFIED** beyond this listing (no full clone this session).

---

## §3 python trezorlib × stock T3W1 (2.12.4) over USB — pairing without debuglink

**Verdict: YES by code.** Repo `fw:python` `pyproject.toml` = **0.20.2**, and PyPI latest `trezor` = **0.20.2** (2026-07-31, pypi.org JSON fetched) → **pip's trezorlib ships THP**. Full host THP stack in-tree: `fw:python/src/trezorlib/thp/{channel,client,control_byte,cpace,credentials,curve25519,exceptions,message,pairing,thp_io}.py`.

**Exact flow (all cited):**
1. `get_client()` (`fw:python/src/trezorlib/client.py` L671-677) runs `probe(transport)` — a v1 Cancel; `Failure(InvalidProtocol)` → `TrezorClientThp`, else `TrezorClientV1`.
2. CLI auto-pairs (`fw:python/src/trezorlib/cli/__init__.py` L430-448 `_get_client`): if `not client.pairing.is_paired()` → `default_pairing_flow(client.pairing, code_entry_callback=get_code_entry_code)`, stores the credential, `finish()`.
3. `default_pairing_flow` (`fw:python/src/trezorlib/thp/pairing.py` L383-420): SkipPairing only when no credential is requested (CLI always requests one) → otherwise **CodeEntry**: a *human* enters the code displayed on the Safe 7 screen (`get_code_entry_code` is a terminal prompt) → CPace anti-MITM (`thp/cpace.py`, `curve25519.py`) → `ThpCredentialRequest` → credential → encrypted transport.
4. Credentials persist to the platform config dir as **`thp-credentials.json`** (`fw:python/src/trezorlib/cli/credentials.py` L47, L125); `trezorctl device thp-forget` removes the pairing (`cli/device.py` L538).
5. Transports under the same THP client: `webusb` (iface 0, 64-byte chunks — `transport/webusb.py` L40-45), `hid`, `udp`, `bridge`, and **`ble`** (`transport/ble.py`, bleak-based, imports `T3W1`).

**No debuglink anywhere in the pairing path** — the code displayed on-device is the MITM anchor. Commands: `pip install trezor` → `trezorctl list` → `trezorctl get-features` (pairing prompt appears on first run). **UNVERIFIED-on-device** against stock 2.12.4 from this box (founder's device intermittently on Seat 3's box — that receipt closes this row).

---

## §4 The THP spec surface for the bSAFE-7-native Rust plan (the map, not the implementation)

All paths relative to `fw:`. The device implementation **and a host-side Rust reference already exist** — port `rust/trezor-thp` (host role) rather than re-deriving the spec.

**Framing — `rust/trezor-thp/src/header.rs`, `control_byte.rs`, `crc32.rs`, `fragment.rs`, `alternating_bit.rs`:**
- Packet = **control byte (u8) + channel id (u16 BE) + payload length (u16 BE) + payload + CRC32** (checksum len 4; nonce len 8; max payload 60 000).
- Control bytes: `0x3F` CodecV1 (v1 magic `?`), `0x00/0x01` handshake InitiationRequest/Response, `0x02/0x03` handshake CompletionRequest/Response, `0x04` encrypted transport, `0x40/0x41` channel-allocation request/response, `0x42` transport error, `0x43/0x44` ping/pong; continuation `0x80`; sync bits **ACK 0x08 / SEQ 0x10** (alternating-bit retransmission, `MAX_RETRANSMISSION_COUNT = 50`, backoff in `channel/mod.rs` L909-918).
- Channel ids **0x0001-0xFFEF** + broadcast **0xFFFF** (allocation request/response carry an 8-byte nonce; response carries the new channel id + device properties).

**Pairing states & phases — `rust/trezor-thp/src/channel/mod.rs`:**
- `PairingState { Unpaired=0, Paired=1, PairedAutoconnect=2 }` (L76-82) — returned in the handshake CompletionResponse.
- Four phases: **handshake → pairing → credential → encrypted transport** (`Phase` L160-176; transition into encrypted transport via protobuf `ThpEndRequest`/`ThpEndResponse`); application header after encryption = **3 bytes (session id u8 + message type u16) + protobuf + GCM tag** (`APP_HEADER_LEN` L41; `MAX_CREDENTIAL_LEN` 128; `MAX_DEVICE_PROPERTIES_LEN` 64).

**Session keys — `rust/trezor-thp/src/channel/noise.rs`:**
- **Noise XX**, host = initiator: `-> e` / `<- e, ee, s, es` / `-> s, se` / `<- pairing_state` (file header comment). X25519 + SHA-256 + **AES-256-GCM**, tag 16 B, handshake hash 32 B. Backends: `trezor-noise-rust-crypto` / `trezor-noise-ring` (github.com/trezor/noise-rust).
- Credential lookup (reconnect without re-pairing): host stores (remote static pubkey, host static privkey, credential); match condition `masked_static == X25519(SHA256(remote_static || ephemeral), remote_static)` — `rust/trezor-thp/src/credential.rs` L8-20.

**Protobuf surface — `fw:common/protob/messages-thp.proto`:**
- `ThpPairingMethod { SkipPairing=1, CodeEntry=2, QrCode=3, NFC=4 }` (L56-62); `ThpDeviceProperties { internal_model, model_variant, protocol_version_major/minor, pairing_methods }` (L66-77).
- Message ids: PairingRequest **1008** → Approved 1009 → SelectMethod 1010 → PreparationsFinished 1011; CredentialRequest 1016/Response 1017; EndRequest 1018/EndResponse 1019; CodeEntry Commitment 1024 / Challenge 1025 / CpaceTrezor 1026 / CpaceHostTag 1027 / Secret 1028; QrCodeTag 1032 / Secret 1033; NfcTagHost 1040 / TagTrezor 1041; plus `ThpCreateNewSession {passphrase, on_device, derive_cardano}` (L88-95), `ThpHandshakeCompletionReqNoisePayload {host_pairing_credential}` (L79-85), `ThpPairingCredential`, `ThpPairedCache`.

**Device-side glue (what the Rust host must be compatible with):** `fw:core/embed/rust/src/thp/{mod,crypto,micropython,time,tests}.rs` — global `THP_CONTEXT`, per-interface muxes (`MAX_INTERFACES = 2` with `ble` feature), up to 4 opening + 10 appdata channels, channel ids unique across interfaces, encrypted static key when device-locked (`ChannelOpen::static_key_required`/`set_static_key`, `device.rs` L424-481). Host reference: `rust/trezor-thp/src/channel/host.rs`. Python reference: `fw:python/src/trezorlib/thp/*`. JS reference: `@trezor/transport@1.6.3 lib/thp/*`.

---

## §5 The BLE lane (founder ask: "can you add bluetooth connection?")

**(a) GATT service/characteristics the Safe 7 advertises — VERIFIED in-tree:**

| Role | UUID | Properties | Receipt |
|---|---|---|---|
| Primary service | `8c000001-a59b-4d58-a9ad-073df69fa1b1` | — | `fw:nordic/trezor/trezor-ble/src/ble/ble_internal.h` (BT_UUID_TRZ_VAL) |
| **RX** (host→device) | `8c000002-a59b-4d58-a9ad-073df69fa1b1` | WRITE, WRITE_WITHOUT_RESP | `ble_internal.h` + `src/ble/service.c` GATT block |
| **TX** (device→host) | `8c000003-…` | NOTIFY (attr used by `service_send`) | service.c |
| NOTIFY | `8c000004-…` | NOTIFY (attr used by `service_notify`) | service.c |

All characteristics demand **encrypted/bonded** GATT perms (`BT_GATT_PERM_*_ENCRYPT`) — the service is unreachable before BLE-level pairing. Advertising includes the 128-bit service UUID (`src/ble/advertising.c` `BT_DATA_BYTES(BT_DATA_UUID128_ALL, BT_UUID_TRZ_VAL)`), name from `CONFIG_BT_DEVICE_NAME`, fast interval 20-25 ms / slow 152.5-211.25 ms. Radio = **nRF52832 coprocessor** (`boards/t3w1_revA_nrf52832.conf/.overlay`) running Zephyr (`nordic/trezor/trezor-ble`), relaying to the main MCU over **trz_comm SPI/UART** (`src/trz_comm/trz_comm.h` — PACKET_DATA_SIZE 254). Device-side API: `fw:core/embed/io/ble/inc/io/ble.h` (modes OFF/KEEP_CONNECTION/CONNECTABLE/PAIRING/DFU; **BLE_PAIRING_CODE_LEN = 6**; max 8 bonds; 244-byte BLE packets).

**(b) THP-over-BLE vs THP-over-USB — one framing serves both (CONFIRMED at source):** the THP mux binds per *interface* (`core/embed/rust/src/thp/mod.rs` `add_interface(iface_num, device_properties)`, `MAX_INTERFACES 1` → `2` under `feature = "ble"`); channel ids and channel limits are **shared across interfaces**; the §4 packet format is identical on both. Divergences: transport chunk size (USB 64 B — `python/src/trezorlib/transport/webusb.py` — vs BLE 244 B — `io/ble/inc/io/ble.h`), and BLE's bonding prerequisite at the GATT layer *below* THP. Corroborating quirk: the BLE busy reply is v1-framed (`service.c` `busy_packet` starts `0x3f 0x23 0x23`…).

**(c) Web Bluetooth from the browser — the honest ABSENT gauge (worse than BarcodeDetector):**
- `navigator.bluetooth` (mdn/browser-compat-data, fetched this session): **Chrome 70+, Chrome Android 56+, Firefox NO, Safari NO, WebView Android NO.**
- For scale, BarcodeDetector (the precedent the dispatch cites): Chrome 88+, Chrome Android 83+, Edge 83+, **Safari 17+**, Firefox NO.
- Gauge: Web Bluetooth is **ABSENT on all iOS/Safari and Firefox** — strictly narrower than BarcodeDetector. Chromium-desktop+Android only. Its chooser/permission flow also sits between the user and THP's own code entry.
- **Relay-native BLE is the primary lane:** `btleplug` 0.12.0 (crates.io, updated 2026-03, 1.41M downloads) — Rust, Windows/macOS/Linux/Android backends. Precedent that host-BLE THP is routine: trezorlib ships `transport/ble.py` on **bleak** and imports the T3W1 model. **Recommended order: (1) relay-native btleplug GATT — scan by service UUID 8c000001-…, bond with the 6-digit passkey, then run §4 THP unchanged over RX/TX; (2) Web Bluetooth only as a progressive enhancement for Chromium desktop/Android.** The one-framing-both-transports property makes (2) nearly free once (1) exists.

**(d) Pairing UX the founder has already seen live:** two stacked layers. *BLE layer:* 6-digit passkey (`BLE_PAIRING_CODE_LEN`, `passkey_to_str` + `auth_passkey_confirm` in `nordic/trezor/trezor-ble/src/ble/pairing.c`) confirmed on the device. *THP layer:* the pairing-code screen — `fw:core/embed/rust/src/ui/layout_eckhart/flow/show_thp_pairing_code.rs` (T3W1 = eckhart layout; Main screen with Confirm/Cancel + info menu). The "return to your app" prompt is the device waiting in `ThpPairingRequest` for a host that never selects a method — exactly the §2 stop.

---

## WalletConnect — documented LAST resort only
Hosted relay = capture pattern; founder verdict ":(". Recorded solely so the ladder is complete: USB v1 (Bridge/native, §1) → USB THP (§3/§4) → BLE native (§5c-1) → Web Bluetooth (§5c-2) → WalletConnect (never preferred).

## Receipts owed (the short list)
1. **Seat 3 box:** one `trezord` + `wallet-relay` GetFeatures run against stock 2.12.4 (closes §1 UNVERIFIED-on-device).
2. **Seat 3 box:** `pip install trezor && trezorctl get-features` (closes §3 on real hardware; emulator fallback in-tree via `fw:safe7/proof.py`).
3. **goose/Code:** WebUSB picker suppression cause under Windows for 9.7.3 (§2.3) — one device-manager capture during receipt 1 settles it.

---
## Seat 3 addendum — on-box findings (2026-08-14, founder's Windows host)

Probing the actual machine (not source) to turn goose's "should work today" into a recipe:

- **NO standalone `trezord.exe` is installed.** `…\Trezor Suite\resources\bin\` contains
  `tor.exe`, coinjoin, and — notable — `bluetooth\trezor-bluetooth.exe`, but no bridge
  binary. Modern Suite (26.x) runs the bridge **in-process** (`@trezor/transport-bridge`).
  **Consequence:** port 21325 exists **only while Suite is running.** Any advice to "close
  Suite, the bridge survives" is FALSE now (that was the deprecated standalone-trezord era);
  `trezor_bridge.rs` busy-message corrected accordingly.
- **Recipe for the §1 device receipt:** Suite RUNNING (minimized is fine) + Safe 7 on a
  DATA port + unlocked → `wallet-relay` `/v1/trezor/native/features`. If Suite holds the
  session, eject the device inside Suite (don't quit Suite) and retry; `/acquire/…/null`
  forces acquisition.
- **Live probe now:** 21325 not listening (Suite closed), no `VID_1209` device present →
  §1 receipt still OWED, blocked on hardware attach, not on code.
- **BLE asset for §5 (upgrades goose's recommendation):** Suite ships a NATIVE Safe-7 BLE
  bridge at `…\resources\bin\bluetooth\trezor-bluetooth.exe`. Before reimplementing btleplug
  from scratch, PROBE this binary — its local port/protocol are a likely ready-made BLE
  transport (or at least a reference for the GATT flow goose mapped). Port/protocol
  UNVERIFIED — a follow-up on-box probe when the device is attached.
