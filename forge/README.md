# the forge — bBuzz creation forge (sound + visual)

**Spec:** [[SPEC-BUZZFORGE-1]] · **Gate:** BF-1 open, code lap live (founder GO 2026-08-21,
"lets have zcode burn the tokens") · **License law:** PF-1 — CLAP is the default export;
VST3 is opt-in behind a named GPLv3 source-on-request notice and is **not built** in this
lane today. No freqlab code boards (PolyForm no-compete, Remotion-class precedent) —
pattern only, clean-room.

## What's here

| crate | what | status |
|---|---|---|
| `crates/buzz-gain` | first Effect template: drive → tape saturation → trim → **§5 safety wrapper** (soft-knee hard limiter + crash guard, both unit-tested). CLAP-only (`nih_export_clap!`). ⚙ AI-authored DSP. | **BF-1 first slice — built & receipted 2026-08-21** |

The nih-plug dependency is pinned to the spec's §3a license pin (commit `f36931f`, ISC).
License note from the BF-1 build: nih_plug compiles vst3-sys (GPLv3) even for CLAP-only
exports, but this crate ships no VST3 binary, and GPLv3 merges one-way into our
AGPL-3.0-only source. PF-1's notice duty attaches when/if VST3 ships.

## Build (WSL lane)

```bash
cd forge
. ~/.cargo/env
cargo build --release   # artifact: target/release/buzz_gain.clap
cargo test              # §5 wrapper unit tests
```

Receipt rule: no ✅ without the pasted command and real unedited output — see
`docs/dispatches/RECEIPT_zCode_BF1_BUILD_2026-08-21.md`.

## Queue (cadence law: one phase per session)

1. ~~first vertical slice~~ — done 2026-08-21
2. visual starters (platform Canvas/SVG — BF-2 ruled)
3. multiplayer: plugin source as a Yjs doc on the huddle's data channel
4. harness guidance/learning lane (in-band explain, practice loops)
5. VST3 opt-in behind its GPLv3 notice (PF-1)

⚙ Everything AI-authored in this lane carries the gear badge; a human/⚙ review
precedes any share.
