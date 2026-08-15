# RECEIPT — a bComb frame rendered on the Trezor Safe 7 and decoded byte-identically

**Seat 3 (Claude Code), 2026-08-15.** Bytes encoded on the host, rendered on the T3W1
framebuffer, captured as a PNG, and read back by the JavaScript oracle with **no byte
altered**. **No firmware Rust was written.**

```
BYTE-IDENTICAL TO WHAT WAS ENCODED: YES
```

---

## The loop, and where each link is proven

```
"bLighTnetWorK on a Trezor screen"     32 B, 5 frames
   -> bcomb.framesFor()                surfaces/blight/bcomb.js  (the oracle)
   -> draw() 380x380, letterboxed to 380x520
   -> JPEG q=0.90                      34,353 B   (T3W1 limit 65,536)
   -> trezorui_api.check_homescreen_format()   -> True    ** the firmware's own gate **
   -> trezorui_api.confirm_homescreen(image=jpg).paint()  -> True
   -> Display.record_start() -> display_save() -> refresh00-00000000.png  380x520 RGBA
   -> bcomb.inspect()                  stage=decoded, cell=16.6px, frame 1/5
   -> bytes    [0, 32, 98, 76, 105, 103, 104, 84]
      expected [0, 32, 98, 76, 105, 103, 104, 84]
```

**Predicted cell size 16.52 px; measured off the device 16.6 px.** The geometry receipt
(`RECEIPT_T3W1_GEOMETRY_2026-08-15.md`) held.

## Why there is no Rust in this

The scouted conclusion was that rendering needed a new Rust component, because MicroPython
has no drawing API — `trezorui.Display` exposes only `WIDTH`, `HEIGHT`, `orientation`,
`record_start`, `record_stop`. **That is true for arbitrary drawing and false for this.**

`trezorui_api.confirm_homescreen(title, image)` takes a **JPEG directly as an argument** and
renders it. No storage write, no unlock, no device workflow. The homescreen was dismissed
early as "a dead end — static, host-uploaded, proves nothing." **It is a dead end for the
security property and a working door for the render.** Those are different questions and
conflating them cost a detour.

*(`storage.device.set_homescreen()` was tried first and fails with `Could not save value` on
a device whose storage is not unlocked. `confirm_homescreen` needs neither.)*

## The environment, since it was the real blocker

| obstacle | resolution |
|---|---|
| no `ensurepip`, no sudo, PEP 668 | **`uv`** was already on the box and bundles its own |
| `layout_parser: No such file` | console script from `core/tools` — `uv pip install -e core/tools` |
| `No module named 'trezorlib'` | `uv pip install -e python/` from the repo itself |
| `Fatal: Tropic configuration check failed` | `make ... UNIX_PORT_OPTS="DISABLE_TROPIC=1"`. `PYOPT=0` auto-drops optiga but **not** tropic |
| binary not executable after build | `chmod +x` — the exec bit is lost crossing `/mnt/c` |
| a backgrounded build vanished | **WSL tears down between harness calls.** Long builds must run under the harness's own background runner, not `nohup` inside WSL |

Build: `BUILD_EXIT=0`, zero errors, `DISPLAY_RESX=380 DISPLAY_RESY=520`,
`TREZOR_MODEL_T3W1`, `UI_LAYOUT_ECKHART`, `USE_THP`, `PYOPT=0`. Byte-identical in size to
the Aug 2 prebuilt, which confirms that one was also tropic-disabled.

## What this proves

1. **bComb renders legibly on the real T3W1 framebuffer** — not a simulation, the actual
   display driver and the actual panel geometry.
2. **The firmware's own format gate accepts it.** `check_homescreen_format` returned `True`,
   so the JPEG satisfies 380×520 and `mcu_height <= 16` as the Rust requires.
3. **JPEG's lossy DCT does not destroy the format.** A bComb is nothing but high-contrast
   edges, the worst case for ringing — and it survived every quality from 1.0 down to 0.5,
   with a full 5-frame beam assembling byte-perfect through the round trip.
4. **The capture path works end to end** and yields exactly the 380×520 RGBA PNG the
   decoder wants.

## What this does NOT prove — stated plainly

- **It is ONE STATIC FRAME.** Not a stream. Animation still needs a Rust component driven by
  `EventCtx::request_anim_frame`, and whether that sustains 4–7 Hz under render load is
  **unmeasured**.
- **It carries no MiM-immunity.** The homescreen is **host-supplied by construction**, so
  this proves the *render*, never the *trust*. The property that makes the device screen
  worth using — that a compromised host cannot repaint it — is exactly the property this
  path lacks. `DISPATCH_TREZOR_OPTICAL_LANE.md` §2 remains the route to that.
- **No real optics.** This is a framebuffer dump, not a photograph. Camera auto-exposure,
  glass, glare and angle are untested here; the founder's own laptop-camera receipts remain
  the only real-sensor evidence.
- **Emulator, not silicon.** Rasterisation on a real panel may differ.

## Reproduce

```
docs/receipts/jpeg_survival.cjs   # host: bComb -> JPEG survival sweep, writes ~/bcomb_home.jpg
docs/receipts/emu_bcomb.py        # device: check_homescreen_format -> confirm_homescreen -> record
docs/receipts/decode_emu.cjs      # host: decode the captured PNG, compare bytes
```

Run the emulator from `core/src` so `sys.path` resolves the firmware's Python packages.
