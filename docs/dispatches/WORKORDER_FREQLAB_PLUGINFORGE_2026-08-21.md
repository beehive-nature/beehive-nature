# WORKORDER — bBUZZ PLUGIN-FORGE (freqlab pattern, clean-room) · DRAFT, pending founder word

**Drafted by Seat 3 (Fable 5), 2026-08-21, for zCode (GLM 5.3) as LEAD.** Relay/landing
per standing protocol: zCode delivers git-am patches, Seat 3 compiles/verifies/pushes.
**Nothing here is ratified** — the DB/BS gates and the license gate below are founder's.

> **STATUS STAMP (zCode, LEAD, 2026-08-21):** founder word received — **GO + PF-1 RULED
> (CLAP-default)**. [[SPEC-BUZZFORGE-1]] **ratified by LEAD**: §3a license pins closed,
> **BF-1 opened** (code lap live), **BF-2 ruled** (platform Canvas/SVG). The "pending
> founder word" in the title is historical; this work order lands as the raid record.
> DB gates remain as the spec states. Landed by zCode per the 2026-08-21 handoff (Seat 3
> conserving founder usage; standing autonomous-push authorization).

---

## 0 · ONE LINE

Clean-room a **conversational creation-forge wing** for the bBuzz studio, for **sound AND
visual artists alike**: describe what you want → our own Claude harness builds it (**nih-plug
Rust** for sound, **deterministic seed→renderer** for sight — the hex-art/organ lineage
generalized) → **preview live** (hear it / see it) → iterate → publish or inscribe — built
*multiplayer* on the studio stack we already ruled, and built to **teach and free the
artist**, not just to ship an artifact (§3b).

## 1 · WHAT IS AND IS NOT TAKEN (the license fence, already precedented)

freqlab is **PolyForm Shield 1.0.0** — source-available, explicit no-compete clause,
**exact Remotion class** (pirate-haul ruling #30). Therefore:

- **LEAVE:** every line of freqlab's code. No copy, no fork, no paste. Pattern only.
- **TAKE (free ideas):** the BYO-Claude-subscription orchestration shape (**we already
  ship it — "claude harness stock"**), per-project agent + git-commit-per-change +
  one-click revert, the Describe→Build→Preview→Iterate→Publish loop with
  **hot-reload-to-hear**, nih-plug as substrate, crash-guard + template output-limiters
  as the AI-DSP safety pattern.

## 2 · GROUND IT IN WHAT ALREADY LANDED (do not re-invent)

- **Studio stack — Gate BS-1 GO** (`receipts/RECEIPT_SZLI6792_RAID_2026-08-21.md`):
  **Yjs (MIT)** shared document + **our LiveKit venue** (broom-agent, Apache-2.0) + our
  own **modular-synth panels** in `ui/`. This is the multiplayer skeleton freqlab lacks.
- **SPEC-DJBUZZ-1 — GO on all DB gates:** the forge is a new wing under it; a forged
  plugin's signature sound can drop as a **sound inscription** (DB-1 class) and surface
  in the **Listening Room**.
- **The harness is already in bBuzz** (founder, 2026-08-21). The forge orchestrates the
  harness we run; it does **not** ship or embed freqlab's orchestration.

## 3 · THE DIFFERENTIATOR (why this is ours, not a freqlab clone)

freqlab is single-user, macOS-only. Ours is:

- **Multiplayer:** members + bAiGenTs forge one plugin together — the nih-plug source is
  a **Yjs doc**, edits/knobs/params sync over the huddle's data channel; bAiGenTs join
  as ordinary LiveKit participants (the room-AI seat shape broom-agent already occupies).
- **Cross-platform:** Rust/nih-plug builds on Win/Linux/mac (our own box is Win/WSL) —
  no Xcode/Gatekeeper lock-in. This is a strict improvement over freqlab's macOS gate.
- **Badges honest:** ⚙ on AI-touched work, per the creation doctrine (SPEC-DJBUZZ §7.1).
- **Two media, one loop:** the same Describe→Build→Preview→Iterate→Publish spine drives
  **sound** (nih-plug plugin/synth/effect) *and* **sight** (generative renderers — the
  seed→SVG/canvas hex-art lineage, the organ generalized). "Preview" = hear-it for sound,
  see-it for visual; the fork law and the Listening Room already carry the visual half.

## 3b · ARTIST-FIRST — the whole point (freedom · options · guidance · learning · passion)

This wing exists to **brighten the heART**, not to automate the artist out of the loop.
Every design choice below serves expression, and each is already a standing value in the tree:

- **Templates are launch-pads, never rails.** freqlab's own ethos — *"no coding required
  but it's encouraged"* — is the posture: a beginner describes and gets a working thing; a
  tinkerer opens the Rust/renderer and changes anything; nothing is locked. Choice of UI
  idiom too (WebView / egui / native panels for sound; canvas / SVG / shader for sight) —
  the artist picks their surface, we don't pick for them.
- **Guidance + learning, in-band.** The harness doesn't just emit code — it **explains what
  it did and why** (this filter, this envelope, this color-mapping), in plain language, with
  the ⚙ honesty badge. A practice/learn lane: guided "try changing X, hear/see what happens"
  loops, so the forge is a **teacher an artist grows with**, not a vending machine. This is
  the founder-creed lane — *built for the poor starving artist*: zero-credential where
  possible, learn-by-doing, the craft made reachable.
- **Infinite remixing = infinite expression.** The fork law (Listening Room, DB-5): fork any
  piece — sound or visual — flip a seed/param, hear/see the change instantly, keep the parent
  intact, mint the fork with provenance. The community's collaborative fork-tree *is* the
  gallery. Options multiply; nothing is a dead end.
- **Practicing passions, around the clock, with others.** Multiplayer huddle + bAiGenT
  collaborators (§3) means an artist is never blocked alone at 4am — a co-creator, human or
  AI, is in the room. The doctrine's line holds: **humans and AI co-create, badges honest,
  the self-art process stays sovereign** (SPEC-DJBUZZ §7).

## 4 · OBSTACLES → RESOLUTIONS (what "solve obstacles" means here)

| # | obstacle | resolution |
|---|---|---|
| O-1 | PolyForm no-compete | clean-room; Remotion precedent; no freqlab code — **resolved by law** |
| O-2 | VST3 bindings = GPL-3.0 | **CLAP default** (unencumbered) + never-bridged art-law fit; VST3 opt-in behind a named GPL-3.0 source-on-request notice — **founder gate PF-1** |
| O-3 | AI-generated real-time Rust DSP can panic / blow speakers | template hard output-limiter + a **crash-guard** wrapper (freqlab's own lesson, reimplemented); build in a constrained cargo profile; human/⚙ review before any share |
| O-4 | macOS-only upstream | we target CLAP+cross-platform from line one; WSL build lane already our norm |
| O-5 | BYO-Claude onboarding friction | already the harness's model; surface the same "we walk you through setup" first-run the estate already does |

## 5 · FIRST LAP — SPEC, NOT CODE (cadence law: one phase per session)

zCode's deliverable this lap is a **spec draft**, `docs/specs/SPEC-BUZZFORGE-1.md`, not a
build. It must contain:

1. The pipeline diagram for **both media**, sharing one spine: chat → harness → source
   (Yjs) → build/render → live preview (hear-it / see-it) → publish or inscribe. Sound
   arrow = nih-plug src → cargo build → CLAP/VST3 → hot-reload. Visual arrow = seed +
   renderer → client re-render → SVG/canvas → inscribe (hex-art lineage). Every arrow
   mapped to an existing pattern (organ, studio, Listening Room, MEDIA-1).
2. **L-VERIFY table at pinned commits:** nih-plug (ISC), its VST3 bindings (GPL-3.0),
   CLAP SDK license, and the visual-render deps, plus any template deps — raw LICENSE
   read, SHA-pinned, per house law. Any cell not raw-verified = **UNVERIFIED**, not asserted.
3. The template set as **launch-pads not rails** (§3b): Effect / Instrument (sound,
   CLAP-first) + generative-visual starters; each openable and fully editable; UI-idiom
   choice surfaced to the artist. Plus the safety wrapper spec (O-3) for AI-authored DSP.
4. The multiplayer model: what lives in the Yjs doc vs. what's local; build/preview/render
   as a per-participant vs. shared action; bAiGenT-as-participant seat shape.
5. **The artist lane (§3b), specced as first-class, not a footnote:** the in-band
   explain/guidance layer, the practice/learn loops, the fork-to-remix flow across both
   media, and the ⚙ honesty badge on every AI-touched output.
6. The gates: **PF-1** (CLAP-default + VST3-GPL posture), **BF-1** (build the forge on
   this stack), and the DB-1 tie-in for forged **sound *and* visual** inscriptions.

## 6 · SCOPE FENCE (binding)

- Pattern only — **no freqlab code boards**, no macOS Tauri packaging copied.
- Don't touch atticked drafts. Don't build before the spec is ratified.
- No secrets in a PUBLIC repo; pre-commit hex scan applies.
- If any step here already landed, **verify before executing** (check-before-acting law).

**Seat 3 (Fable 5), 2026-08-21. 🐝 — draft for the founder's signature and judgment.**
