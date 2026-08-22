# RECEIPT — BF-1 first build lap: the forge stands, buzz-gain compiles

**Authority:** Seat 3 → zCode (LEAD) dispatch 2026-08-21, relaying founder word
*"lets have zcode burn the tokens."* BF-1 open, PF-1 ruled (CLAP-default), BF-2 ruled
(Canvas/SVG), §3a pins closed — [[SPEC-BUZZFORGE-1]].

**Seat:** zCode (GLM 5.3, LEAD). **Lap:** the recommended first vertical slice, unrescoped —
one CLAP sound plugin, one Effect template, §5 wrapper from line one, real cargo receipt.
Visual path, Yjs multiplayer, guidance lane, VST3 opt-in all deferred per cadence law.

---

## What was built

```
forge/                                   — the bBuzz creation forge lane (new)
  Cargo.toml                             — workspace, resolver 2
  README.md                              — lane doc + build recipe + queue
  crates/buzz-gain/
    Cargo.toml                           — cdylib, nih_plug pinned to §3a commit f36931f
    src/lib.rs                           — BuzzGain: drive → sat → trim → §5 wrapper
    src/safety.rs                        — §5 OutputGuard::limit + CrashGuard (latching)
  Cargo.lock                             — committed: full dep tree pinned (audit rail)
```

- **Template** (`src/lib.rs`): Effect launch-pad per spec §4 — Drive (dB, −12…+24),
  Saturation (0…1, clean↔tanh tape curve), Trim (dB), Ceiling (dBFS, −12…**0** — the
  range itself caps at 0 dBFS so the §5 limiter is always on and always last).
- **§5 wrapper** (`src/safety.rs`), wired before any DSP was written:
  `limit()` = knee at 50% of ceiling → tanh soft curve → hard clamp; non-finite input →
  digital silence (a lone NaN must never reach a DAC). `CrashGuard` = `catch_unwind`
  around the DSP body, buffer zeroed + fault **latched** on panic (later buffers stay
  muted without invoking the body), latch cleared on host re-init (`Plugin::reset`).
- **CLAP-only**: `nih_export_clap!(BuzzGain)`; no `Vst3Plugin` impl, no VST3 binary.
  CLAP_ID `org.beehive-nature.buzz-gain`; features AudioEffect/Stereo/Mono/Utility.
- **⚙ badge**: in the plugin NAME shown by hosts, in CLAP_DESCRIPTION ("review before
  sharing"), in the crate docs and README. This DSP is AI-authored (this seat) —
  human/⚙ review precedes any share, per the creation doctrine.
- **No freqlab code** — API shape informed only by nih-plug's own ISC-licensed example
  (`plugins/examples/gain.rs` at the pinned commit) and the trait definitions read from
  the clone. Pattern only (Describe→Build→Preview uses our own harness, later laps).

## Receipts (pasted commands, real unedited output)

Build lane: WSL (`wsl.exe -e bash -lc`), cargo 1.97.1 / rustc 1.97.1, default release
profile (the "constrained" O-3 posture — no LTO marathons this lap).

**1. `cargo build --release`** (final invocation after the one-line `Some()` fix below):

```
$ cd /mnt/c/Users/travi/beehive-nature/forge && . ~/.cargo/env && cargo build --release
   Compiling serde v1.0.229
   Compiling nih_plug v0.0.0 (https://github.com/robbert-vdh/nih-plug.git?rev=f36931f7af4646065488a9845d8f8c2f95252c23#f36931f7)
   Compiling buzz-gain v0.1.0 (/mnt/c/Users/travi/beehive-nature/forge/crates/buzz-gain)
    Finished `release` profile [optimized] target(s) in 7.07s
```

First compile had exactly one error — `CLAP_MANUAL_URL` needed `Some(Self::URL)` —
fixed and rebuilt; shown here for honesty, not hidden.

**2. `cargo test --release`** — the §5 wrapper unit suite:

```
running 5 tests
test safety::tests::curve_is_continuous_at_the_knee ... ok
test safety::tests::non_finite_input_becomes_silence ... ok
test safety::tests::curve_is_monotonic_and_sign_preserving ... ok
test safety::tests::output_never_exceeds_the_ceiling ... ok
test safety::tests::crash_guard_latches_on_panic_and_resets ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

Including `f32::MAX`, `±∞`, `NaN` at the ceiling test — the limiter holds at all of them.

**3. Artifact assembly + CLAP ABI check** (rename is the standard CLAP-on-Linux
assembly, same as nih_plug's own bundler; `clap_entry` is the symbol every CLAP host
resolves after `dlopen` — its presence is the loadability contract):

```
$ ls -la target/release/libbuzz_gain.so
-rwxrwxrwx 2 travi travi 1490640 Aug 21 20:42 target/release/libbuzz_gain.so
$ cp target/release/libbuzz_gain.so target/release/BuzzGain.clap
$ nm -D target/release/BuzzGain.clap | grep -i clap_entry
000000000010b340 D clap_entry
$ file target/release/BuzzGain.clap
target/release/BuzzGain.clap: ELF 64-bit LSB shared object, x86-64, version 1 (SYSV),
dynamically linked, BuildID[sha1]=9c4f8738a13588e1475ccc619878fe43468f7631, not stripped
$ sha256sum target/release/BuzzGain.clap
002d2c9558de72d2b58dd5646cffdc57f886c4c44015883e8703bd1bea278aca  target/release/BuzzGain.clap  <!-- PUBLIC-CONSTANT: artifact content pin -->
```

**Loadability status, honestly:** ABI-shaped and symbol-verified, **not yet loaded into
a live DAW** (no DAW in the WSL lane this lap). Next integration step queued: load in a
CLAP host and/or run free-audio's `clap-validator` — see queue.

## License finding (correction of this seat's own first draft — kept visible)

The build log shows **nih_plug compiles vst3-sys (GPLv3) unconditionally**, even for a
crate that never calls `nih_export_vst3!`. My initial README/Cargo comment claimed
otherwise; corrected in-place before landing. Posture, verified: this crate ships **no
VST3 binary**; GPLv3 code merges one-way into our AGPL-3.0-only source (FSF
compatibility), so the combined `.clap` remains distributable under our house license
with source open in this public repo. **PF-1's VST3 notice duty attaches when/if a VST3
export ships** — the spec's CLAP-default ruling remains the load-bearing fence.

Supply chain: `Cargo.lock` pins the full tree (nih_plug @ f36931f per §3a; vst3-sys @
b3ff4d77 via nih_plug's own manifest). `forge/target/` ignored by the repo's
`**/target` rule — nothing built boards the repo.

## Queue (one phase per session)

1. ~~first vertical slice: buzz-gain CLAP + §5 wrapper + receipt~~ — **this lap**
2. DAW load / `clap-validator` pass (integration proof of the same artifact)
3. visual starters (platform Canvas/SVG — BF-2 ruled)
4. multiplayer: plugin source as a Yjs doc on the huddle's data channel
5. harness guidance/learning lane (in-band explain, practice loops — §7)
6. VST3 opt-in behind its named GPLv3 notice (PF-1)

**zCode (GLM 5.3, LEAD) — 2026-08-21. ⚙ AI-authored DSP, badges honest. Burned bright. 🐜**
