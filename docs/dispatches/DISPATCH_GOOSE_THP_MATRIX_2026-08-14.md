# DISPATCH → goose (Seat 1 hands): THP transport matrix — the Safe 7 handshake, at source
**From:** Seat 3 · founder directive 2026-08-14 ("finish connecting stock trezor firmware";
"heavy token demand work for goose") · **Priority: critical path**

## The observed wall (founder-tested, both platforms, receipts in session)
Stock Safe 7 (T3W1, fw 2.12.4) + released Connect 9.7.3: popup opens, consent works,
WebUSB picker lists NO device, the DEVICE shows a THP pair prompt ("return to your app")
that the web host never completes. Mobile: deep-links into Suite app → same third-party
handshake stop. Suite itself talks to the device fine.

## Deliverable: `THP_TRANSPORT_MATRIX.md` (mailbox), every row source-cited
1. **trezord-go (Bridge) × T3W1:** does the released Bridge speak to a T3W1 at all —
   v1 protocol accepted, or THP-only? (github trezor/trezord-go + trezor-suite
   packages/transport). This decides whether Seat 3's just-landed native Bridge lane
   (`wallet-relay/src/trezor_bridge.rs`, GetFeatures over 21325) can work TODAY or
   needs THP framing immediately.
2. **@trezor/transport THP status:** which transports in trezor-suite (develop) implement
   THP pairing (CodeEntry/QR/NFC methods), and exactly where 9.7.3's web path stops.
3. **python trezorlib × stock T3W1 over USB:** can current trezorlib (pip / repo main)
   GetFeatures + pair over THP against STOCK 2.12.4 without debuglink? Exact pairing
   flow + commands. (Our fork memory: T3W1 THP tooling exists — confirm for REAL device.)
4. **The THP spec surface** we must implement for the bSAFE-7-native lane: framing,
   pairing states, session keys — file pointers into trezor-firmware (core/embed/…thp…)
   sufficient for a Rust implementation plan. No implementation — the map.

Constraints: L-VERIFY (cite file paths), UNVERIFIED labels where not confirmed, no
device access assumed (the founder's Safe 7 is intermittently attached to Seat 3's box).
WalletConnect is documented LAST resort only (hosted relay = capture pattern; founder: ":(").

## 5 (added, founder ask: "can you add bluetooth connection?") — BLE lane
Verified at source: `core/embed/io/ble` + top-level `nordic/` exist for T3W1.
Map: (a) the GATT service/characteristic UUIDs the Safe 7 advertises;
(b) THP-over-BLE framing vs THP-over-USB (THP was BUILT for the wireless era —
one framing implementation should serve both; confirm divergences);
(c) Web Bluetooth API feasibility from the browser (Chromium desktop + Android
only; Safari/iOS absent → honest ABSENT gauge like BarcodeDetector) vs the
relay doing native BLE (btleplug-class crate) — recommend the order;
(d) pairing UX: what the device shows during BLE THP pairing (the founder has
already seen the pair prompt live). Same L-VERIFY discipline.
