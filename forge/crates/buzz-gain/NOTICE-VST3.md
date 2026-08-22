# NOTICE — the VST3 opt-in path (PF-1: read before enabling `--features vst3`)

**Ruling:** SPEC-BUZZFORGE-1 PF-1 (founder, 2026-08-21): *CLAP is the default export;
VST3 is opt-in behind a named GPLv3 source-on-request notice.* This is that notice.

## What enabling the feature does

`cargo build --release --features vst3` adds the VST3 entry point to the binary
alongside CLAP. The VST3 path goes through `nih_plug`'s VST3 bindings, which are
**RustAudio/vst3-sys, licensed GPLv3** (pinned via Cargo.lock; see SPEC-BUZZFORGE-1 §3a
and the nih-plug README §Licensing: *"any VST3 plugins built with NIH-plug need to be
able to comply with the terms of the GPLv3 license"*).

Note (verified in the BF-1 build): nih_plug *compiles* vst3-sys unconditionally, but a
CLAP-only build ships no VST3 entry point and the combined work stays AGPL-3.0-only
(GPLv3 merges one way). **Distributing a VST3 binary is the act that engages GPLv3.**

## Your obligations if you distribute a VST3 build of this crate

1. **Corresponding source on request** — this repository IS the complete source, so
   point recipients at it (and at the exact commit you built). Keep that true: never
   distribute a VST3 build whose source is not public.
2. **License the binary GPLv3-compatible** — our AGPL-3.0-only source satisfies this;
   if you fork under a different license, re-check compatibility before shipping VST3.
3. **No additional restrictions** on recipients' GPL rights.

## House posture

CLAP-first is not a workaround — it rides the art law's never-bridged discipline and
keeps the default artifact clean (ISC framework + MIT format). VST3 exists so artists
living in VST3-only hosts are not locked out; the notice exists so that choice is
informed, not accidental.
