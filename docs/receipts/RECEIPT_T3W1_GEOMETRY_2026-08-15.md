# RECEIPT — bComb decodes at Trezor Safe 7 panel geometry

**Seat 3 (Claude Code), 2026-08-15.** Run before writing any firmware Rust, to answer the
one question that could make that work pointless: **does the bComb format survive at the
T3W1's actual screen dimensions, under the conditions a device screen actually presents?**

Script: `docs/receipts/t3w1_geometry.cjs` — run under node with `canvas`, against the
canonical codec at `surfaces/blight/bcomb.js`. Reproduce with
`node docs/receipts/t3w1_geometry.cjs`.

---

## The geometry

| | |
|---|---|
| panel | **380 × 520 portrait** — from the device itself, `trezor-emu-core` reporting `d.WIDTH/d.HEIGHT`, not from a datasheet |
| comb | square by construction, so **380 × 380** centred with black letterbox above and below |
| **cell size** | **16.52 px** |
| decoder floor | 3.2 px |
| **margin** | **5.2×** |

## Results — unedited

```
self-test: PASS
T3W1 panel 380x520, cell size = 16.52px (decoder floor is 3.2px)

payload 65B -> 9 frames @ 8 B/frame

1. native 380x520, all frames:      9/9  PASS
2. beam assembles byte-perfect:     PASS

3. robustness sweep (device screens are dim and glossy)
   full brightness            OK    cell=16.5px  decoded
   lit=180 (dimmer panel)     OK    cell=16.5px  decoded
   lit=120 (much dimmer)      OK    cell=16.6px  decoded
   45% dimmed by camera       OK    cell=16.5px  decoded
   35% glare wash             OK    cell=16.5px  decoded
   55% glare wash             OK    cell=16.5px  decoded
   dim panel + glare          OK    cell=16.5px  decoded

4. distance proxy — comb shrunk inside a 640px capture
   comb 380px in 640px frame: OK    cell=16.5px  decoded
   comb 300px in 640px frame: OK    cell=13.0px  decoded
   comb 240px in 640px frame: OK    cell=10.4px  decoded
   comb 200px in 640px frame: OK    cell=8.7px  decoded
   comb 160px in 640px frame: OK    cell=7.0px  decoded
   comb 130px in 640px frame: OK    cell=5.6px  decoded
   comb 110px in 640px frame: OK    cell=4.8px  decoded
```

## What this establishes

1. **The format fits the panel with 5.2× margin.** Nothing about the Safe 7's screen is
   marginal for this codec.
2. **A realistic device payload is 9 frames.** A 65-byte signed challenge response at
   8 bytes/frame; at 4 Hz that is a ~2.3 s beam, at 7 Hz ~1.3 s.
3. **Panel dimness does not matter.** The codec thresholds adaptively per frame, so
   `lit=120` decodes as readily as `lit=235`. **A hardware wallet's screen is dimmer than
   a monitor and this is not a problem.**
4. **Glare does not matter at these cell sizes** — 55% white wash still decodes, which was
   the founder's original failure mode on a phone-to-laptop capture and is comfortably
   cleared here.
5. **The camera can stand well back.** The comb still decodes occupying 110 px of a 640 px
   capture — 17% of frame width, 4.8 px cells.

## What it does NOT establish

- **Nothing about firmware rendering.** This renders with node-canvas, not with
  `shape::RawImage` on a real framebuffer. Rasterisation differences, gamma, and the
  panel's actual response are untested.
- **Nothing about refresh timing.** `EventCtx::request_anim_frame` drives frame advance on
  device; whether it sustains 4–7 Hz under render load is unmeasured.
- **Nothing about a real camera.** Simulated dim/glare is not a real sensor with real
  auto-exposure. The founder's own laptop-camera receipts remain the only real-optics
  evidence.

## Why it was worth running first

`crates/bcomb` already builds for `thumbv8m.main-none-eabihf`, so the encoder is firmware-
ready. The open risk was **geometric**, not linguistic: if 380 px could not carry 127 cells
legibly, the renderer would have been wasted work. **It carries them with five times the
margin the decoder needs**, so the remaining work is rendering and timing — both of which
are engineering, not discovery.
