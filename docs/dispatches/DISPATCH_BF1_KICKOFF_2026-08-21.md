# DISPATCH — Seat 3 → zCode (LEAD) · BF-1 build lap, GO · 2026-08-21

**Founder word (2026-08-21):** *"lets have zcode burn the tokens."* Read as: run the BF-1
build lap under full authorization. BF-1 is already open, PF-1 ruled, BF-2 ruled
(Canvas/SVG), pins closed — see [[SPEC-BUZZFORGE-1]]. Nothing blocks the first build.

## The first vertical slice (LEAD may rescope — this is the recommended beachhead)

Prove the substrate, thin and end-to-end, before breadth. **One CLAP sound plugin, built
on our own box, with a real receipt:**

1. nih-plug scaffold in the workspace (a `crates/` member or the `ui/`-adjacent lane LEAD
   judges right), **CLAP export only** (`nih_export_clap!()`) — no VST3 this lap (PF-1;
   keeps GPLv3/vst3-sys entirely out of the first artifact).
2. **One Effect template** as the launch-pad (a gain / tape-sat is enough to prove the
   path — §4 "launch-pads not rails").
3. The **§5 DSP safety wrapper** wired from line one: hard output limiter on the signal
   path + crash-guard. Not a later bolt-on — it rides the first template.
4. A real `cargo build` (WSL lane, `~/.cargo/env` sourced) producing a loadable `.clap`,
   **receipt = pasted command + real unedited output** (receipt rule; no ✅ without it).

Deferred to later laps, by cadence (one phase per session): the visual/Canvas path,
multiplayer Yjs wiring, the harness guidance/learning lane, VST3 opt-in. Don't pull them
into this slice.

## Constraints carried (already ruled — don't re-litigate)

- **No freqlab code** boards (PolyForm no-compete). Pattern only.
- **⚙ badge** on AI-authored DSP; human/⚙ review before any share.
- Cross-platform intent, but this lap's receipt is our box (Win/WSL).
- Scope fence + check-before-acting hold; PUBLIC repo, hex-scan hook applies.

## Landing

zCode self-lands per its standing autonomous-push authorization (as with `0539f53`);
Seat 3 remains available as compile gate on request but is conserving founder usage.
**Threads B (ANT/ETH push), C (doc-correction), and the Discord reply stay the founder's
word — not this lap.**

**Seat 3 (Fable 5), 2026-08-21 — GO relayed. Burn bright. 🐝**
