# DISPATCH · Trezor Safe 7 as a bLighTnetWorK transmitter — what is actually possible

**Cut by:** Seat 3 (Claude Code) · 2026-08-15
**Trigger:** founder — *"for combination PoL/PoU + Trezor bLB MiM immunity verification
the trezor would be amazing. it looks like it is just for static pics, but this being
open source and power user features hidden I think we can make this work. DON'T ASSUME
IT ISN'T POSSIBLE."*
**Method:** read-only source scout of `source/trezor-firmware` (fork, base pinned at
upstream `0cd72f0`). Every claim below carries a file and symbol. Nothing was flashed,
nothing was modified.

---

## 0 · The headline

**He is right that it is possible, and wrong about which door.** The homescreen is a
dead end. But the firmware *already contains* a device-originated, man-in-the-middle-immune
display primitive — the THP pairing code — and one of its two forms **ships on stock
signed firmware today**. That is the thing worth building on.

One correction to the source he was quoting: the panel is **380 wide × 520 tall
(portrait)**, not 520×380. Authority is `core/embed/models/T3W1/test_bindgen_macros.txt:5-6`
(`DISPLAY_RESX=380, DISPLAY_RESY=520`), which beats the marketing page.

---

## 1 · Why the homescreen cannot carry a beam

- Firmware accepts **JPEG only** — `layout_eckhart/firmware/homescreen/helpers.rs:11`
  `check_homescreen_format()` returns false for everything that is not JPEG at exactly
  `WIDTH × HEIGHT` with `mcu_height() <= 16`. TOIF/ToiG are rejected on this model.
- Max size **65536 B** (`models/T3W1/model_T3W1.h:35`) — generous, but irrelevant.
- Rendering is a single static image: `homescreen/mod.rs:166` renders one
  `Option<BinaryData>` via `shape::JpegImage`, and the result is *cached* to avoid
  repaint (`storage_cache.homescreen_shown`).
- **No animation exists anywhere in that path.** Searched `gif`, `multiframe`,
  `frame_count` across `core/embed/rust/src/ui` and `core/src/apps` — zero hits.

Even if it animated, a homescreen is **uploaded by the host**, so it could never prove
anything about the device. A static picture the PC chose is not evidence.

## 2 · The primitive that IS the prize — THP pairing, device-originated

`core/src/apps/thp/pairing.py:269` `_handle_qr_code_is_selected()`:

```python
ctx.qr_code_secret = random.bytes(16)                 # device TRNG, host never sees it
sha_ctx = sha256(ThpPairingMethod.QrCode.to_bytes(1, "big"))
sha_ctx.update(ctx.channel_ctx.get_handshake_hash())  # bound to THIS Noise channel
sha_ctx.update(ctx.qr_code_secret)
ctx.code_qr_code = sha_ctx.digest()[:16]
```

The host must then prove it *read the screen*: `_handle_qr_code_tag()` (`pairing.py:326`)
checks `sha256(handshake_hash || code_qr_code)` against the host's tag before the secret
is revealed. **Because the code commits to the Noise handshake hash, a relay attacker
cannot forward it** — his channel has a different hash. That is real MiM immunity, in
the shipped source, generated on the device.

**Two forms, and their status differs — this is the load-bearing detail:**

| Form | Device-originated | On stock signed firmware |
|---|---|---|
| **CodeEntry** — 6 digits, via CPace (`pairing.py:230`) | yes | **YES — already shipping** |
| **QrCode** — 32 hex chars (`pairing.py:269`) | yes | **no** — `__debug__` only |

`core/src/trezor/wire/thp/__init__.py:41` sets
`_DEFAULT_ENABLED_PAIRING_METHODS = [ThpPairingMethod.CodeEntry]`; QrCode and NFC are
appended only inside `if __debug__` (lines 56–63, upstream TODOs #6036–#6038). Separately,
eckhart's `show_address_details()` returns `NotImplementedError`
(`layout_eckhart/ui_firmware.rs:956`), which is the entry point
`thp/ui.py:103 show_qr_code_screen()` reaches for — so the QR screen is wired to a stub
on this layout even in debug.

## 3 · Three paths, in increasing cost

**PATH A — ship MiM immunity now, stock firmware, zero risk to hardware.**
Use the 6-digit CodeEntry that already works. The device shows six digits it generated;
the human carries them to the host; the code is handshake-bound so a relay fails. Low
bandwidth and it needs human eyes, but it is **MiM-immune today on an unmodified
retail Safe 7**. Our surfaces can accept it as a ceremony leg immediately.

**PATH B — unblock the on-device QR. Small custom build.**
Two edits: add `QrCode` to the default pairing methods, and wire the eckhart layout to
the working `QrScreen` (`layout_eckhart/firmware/qr_screen.rs`, already used by the
receive-address flow at `flow/receive.rs:158`). The QR generator itself is real and runs
**on the device** — `ui/component/qr_code.rs:89` calls `qrcodegen::QrCode::encode_text`
locally; the host supplies a string, never modules.
*Capacity trap:* `MAX_DATA = 311` but `QR_MAX_VERSION` caps at Version 9 = **180 bytes
binary**, and overflow hits `unwrap!(qr)` at `qr_code.rs:103` — a fatal error, not a
graceful refusal. Budget under 180 B.

**PATH C — animated bComb on the device screen. The bSAFE 7 prize.**
Buildable. The Rust drawing layer has what we need:
- `shape::Bar` (`shape/bar.rs`) — rects with radius/thickness/alpha
- **`shape::RawImage` (`shape/rawimage.rs`) — blits an arbitrary in-memory bitmap**
- canvases `Mono8Canvas` / `Rgb565Canvas` / `Rgba8888Canvas`; T3W1 renders through
  `shape/display/fb_rgba8888.rs render_on_display()`
- animation: `EventCtx::request_anim_frame()` (`ui/component/base.rs:522`),
  `ANIM_FRAME_DURATION = 1ms` — **several fps is comfortable**; render time is the bound.

There is **no filled-polygon primitive**, so hexagons are not drawn directly. That is fine
and actually easier: rasterise the 84-cell comb into a small bitmap and blit it once with
`RawImage`. Geometry is generous — at 380 px wide a cell is `380/23 ≈ 16.5 px`, five times
the 3.2 px floor our decoder needs. **The mono v2 format lands here perfectly: the device
has no colour problem to solve because we removed colour from the transport yesterday.**

What makes Path C worth it: the device beams a **signature over a challenge**, computed
inside secure hardware. The host cannot see it, cannot forge it, and cannot relay it if we
bind to the handshake hash the way `pairing.py` already does. That is PoU/PoL with the
strongest possible witness.

## 4 · HARDWARE WARNING — do not flash the founder's Safe 7

Custom firmware runs on retail hardware, but the bootloader enforces terms
(`core/embed/projects/bootloader/main.c`, flags decoded in `sec/image/inc/sec/image.h:63-85`):

- **The device secret is wiped/blocked** — `main.c:490-497`, `VTRUST_SECRET_ALLOW` absent
  → `secret_prepare_fw()`. **The existing seed and Optiga-backed features are lost.**
- **1-hour watchdog** — `main.c:535-540`, `iwdg_start(60*60)`; the device reboots.
- **Red "UNSAFE, DO NOT USE!" boot screen** and a required physical tap every boot
  (`bootui.c:57`, `main.c:501-528`).
- Signature checking itself cannot be bypassed: `boot_firmware()` chains
  `check_vendor_header_keys` → `check_vendor_header_lock` → `check_image_header_sig` →
  `check_image_contents` (CoSi m-of-n, keys baked into `model_T3W1.h`).

**Therefore:** Path C is developed on the **emulator** (`xtask build firmware --emulator
-m t3w1`, then `./emu.py`) and, if it goes to metal, on a **second, seedless device** —
never the founder's $250 daily driver. This is exactly the calculus that makes his
"ordering some parts and making our own festival rave candy HWW edition" a serious
option rather than a joke: a purpose-built beacon has no seed to lose, no watchdog, and
no red screen.

## 5 · Host-pushes-pixels: ruled out, and that is good news

There is **no `DebugLinkPaintScreen` or equivalent** — searched `common/protob/*.proto`
for `Paint`, `pixel`, `framebuffer`; the only hits are `homescreen_width/height`
(`messages-management.proto:132-133`). `DebugLinkRecordScreen` pulls screenshots *out*;
`DebugLinkDecision` injects *input*. Python has no drawing API at all — the whole
`trezorui.Display` surface is `WIDTH`, `HEIGHT`, `orientation()`, `record_start/stop()`.

This is a feature, not an obstacle: **a screen the host cannot paint is the entire reason
the screen is trustworthy.** Note the one hole — `DebugLinkGetPairingInfo`
(`messages-debug.proto:156`, handler `apps/debug/__init__.py:290`) hands the host
`code_entry_code`, `code_qr_code` and `nfc_secret_trezor`, deliberately destroying the
MiM immunity of §2 so the test suite can self-confirm. It is `__debug__`-gated
(`apps/debug/__init__.py:1-6` halts if not `__debug__`; `xtask/src/feature_resolver.rs:127-131`
enables debuglink only with `--pyopt=false`). **Any bSAFE 7 build we ship must not carry
it**, or we ship the MiM we came to kill.

## 6 · Recommendation

1. **Now, no hardware risk:** adopt Path A — accept the shipping 6-digit CodeEntry as a
   MiM-immune ceremony leg on our surfaces.
2. **Next, emulator only:** Path B then C on `xtask build firmware --emulator -m t3w1`,
   on its own branch (this fork's `main` carries un-upstreamed Zano/EOS work per
   `BEEHIVE.md`; keep the rebase surface small).
3. **Founder gate before any metal.** Flashing costs the seed on that device. Not a
   decision a machine seat makes.

**Still owed and named:** the Rust `bcomb` crate (JS remains the conformance oracle);
the §1 native-lane device receipt, still blocked on hardware attach.
