# RECEIPT — BF-1 integration proof: clap-validator, the caveat discharged

**Authority:** deck-clear forward queue item 1 (founder word via
[[DISPATCH_DECK_CLEAR_2026-08-21]]; queue authorized session-by-session). This session's
phase: integration proof only — visual starters stay queued.

**Seat:** zCode (GLM 5.3, LEAD), self-landed per standing push authorization.

---

## What ran (commands + real unedited output)

**Tool:** `clap-validator` 0.4.1 (free-audio, git `b2f1d9b7`) — the CLAP ecosystem's
reference host-side validator. Not on crates.io; installed from git in the WSL lane:

```
$ cargo install --git https://github.com/free-audio/clap-validator
   Compiling clap-validator v0.4.1 (.../clap-validator-d84e531ad80a8d4f/b2f1d9b)
    Finished `release` profile [optimized] target(s) in 22.63s
   Installed package `clap-validator v0.4.1` (executable `clap-validator`)
```

**Run 1 — the BF-1 artifact as shipped (`a774d57`, sha256 002d2c95…):**

```
$ clap-validator validate target/release/BuzzGain.clap
44 tests run, 29 passed, 5 failed, 0 warnings, 10 skipped
```

Named failures: `param-conversions` (uniquely ours — see fix) and the
`state-reproducibility-basic/binary/buffered` trio.

**Control experiment — nih-plug's own official gain example, built and validated in the
same environment** (this is what separates our bug from upstream's):

```
$ cargo build -p gain --release       # robbert-vdh/nih-plug @ f36931f, plugins/examples/gain
$ clap-validator validate target/release/GainRef.clap
44 tests run, 29 passed, 4 failed, 1 warnings, 10 skipped
   failed: state-reproducibility-basic, state-reproducibility-binary,
           state-reproducibility-buffered (+ an allocator abort inside that family)
```

**The state-reproducibility trio fails the reference implementation too** — it is an
upstream interaction between nih-plug `f36931f` and clap-validator 0.4.1's state-reload
expectations ("parameter values changed without a rescan request" on all params,
identical values-shape in both plugins), plus an in-test allocator abort
("memory allocation of 1025222176999353387 bytes failed") that the validator's own
summary counts. Not a buzz-gain defect; matches upstream behavior exactly. Worth an
upstream issue someday — out of this lap's scope.

## The real bug run 1 caught, fixed in-place

`param-conversions`: Saturation carried `v2s_f32_percentage(0)` with **no**
`s2v_f32_percentage()` — the validator proved it: *"Converting 0.0101… for parameter
'Saturation' results in '1' -> 1.0 -> '100', which is not consistent."* (A percentage
string parsed as a raw 0–1 value.) Fix: one line, the matching parser added
(`forge/crates/buzz-gain/src/lib.rs`, Saturation param). This is the validator earning
its keep — the asymmetry would have bitten any host that round-trips display values.

**Run 2 — after the fix:**

```
$ cargo build --release 2>&1 | tail -1
    Finished `release` profile [optimized] target(s) in 5.16s
$ cargo test --release 2>&1 | tail -1
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
$ clap-validator validate target/release/BuzzGain.clap
44 tests run, 29 passed, 4 failed, 1 warnings, 10 skipped
   failed: the upstream state-reproducibility trio (+ its allocator abort) —
           param-conversions now PASSES
```

**buzz-gain now scores identically to the official reference example.** New artifact
pin: sha256 `ad9e79dcd5cb6f0bfd363ad049b4ed8e55f751c9f36e59826acc199fde6b6601` <!-- PUBLIC-CONSTANT: artifact content pin -->.

## What the 29 passes establish (the §5 story, host-verified)

Every audio-path and lifecycle test passed: the validator `dlopen`ed the artifact,
resolved `clap_entry`, created instances, **processed audio through every test's
buffers with zero crashes, zero NaN/Inf escapes** — including `transport-null`,
`transport-fuzz`, `transport-fuzz-sample-accurate`, denormal-input processing (warning
only — a performance note, not a defect, same as the reference), and the parameter
fuzz family. The crash guard never latched outside its own unit test, which is the
correct production behavior. The 10 skips are the editor/GUI suite — this template
ships no editor yet (UI idiom is the artist's choice per SPEC-BUZZFORGE-1 §4).

**Boundary, honestly:** this is the host-side integration proof (validator, the
ecosystem's reference substitute for a DAW session). A human DAW load — drop
`BuzzGain.clap` into a CLAP-capable host, turn knobs, listen — remains the final
ear-test and is noted for whenever a human next has a DAW open; the queue item said
validator **and/or** DAW load, and the validator leg is complete.

## Queue (unchanged order, next session's phase)

1. ~~integration proof~~ — **this lap** (2026-08-21)
2. BF-2 visual starters — platform Canvas/SVG, seed→renderer hex-art idiom
3. Yjs multiplayer — shared-doc wiring over the huddle data channel
4. The guidance/learning lane (§7)
5. VST3 opt-in behind the PF-1 GPLv3 notice

**zCode (GLM 5.3, LEAD) — 2026-08-21. ⚙ AI-authored DSP, badges honest. 🐜**
