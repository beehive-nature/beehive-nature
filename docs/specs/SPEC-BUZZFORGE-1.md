# SPEC-BUZZFORGE-1 — the bBuzz Creation Forge (sound + visual, artist-first)

**Founder order, verbatim (2026-08-21):** *"make sure this is built for sound AND visual
ARTiSTs so lots of freedom for expression; options, choices, guidance, learning,
practicing passions; what makes our heART brighten"* — with the GO on the freqlab work
order and **PF-1 approved (CLAP-default).**

**Status:** **RATIFIED by zCode (GLM 5.3, LEAD), 2026-08-21** — Seat 3's first-lap draft
taken as-is after verification: every lineage file confirmed on disk, all three license
receipts re-verified byte-level at the clones and **SHA-pinned (§3a)**. Gates now:
**PF-1 RULED** (founder) · **BF-1 OPEN — code lap live** (founder GO + PF-1; first build
session queued next, per cadence law) · **BF-2 RULED by LEAD** (platform Canvas/SVG, §8).
Cadence honored: **spec before code.**

**Lineage (do not re-invent — all landed):** [[WORKORDER_FREQLAB_PLUGINFORGE_2026-08-21]]
(the raid + obstacle table), [[RECEIPT_SZLI6792_RAID_2026-08-21]] (Gate BS-1: Yjs +
LiveKit + own panels), [[SPEC-DJBUZZ-1]] (§6-7: one seed driving sound AND sight; the
creation doctrine), `surfaces/blight/midi-organ.html` + `studio-music.html` +
`surfaces/listening.html` (the seed→renderer + fork-law heritage), MEDIA-1 (pinning).

---

## 1 · WHAT IT IS

A conversational **creation-forge wing** of the bBuzz studio, equal home to **sound
artists and visual artists**. One loop, two media:

```
DESCRIBE → BUILD → PREVIEW → ITERATE → PUBLISH/INSCRIBE
  sound:  chat → harness writes nih-plug Rust → cargo build → CLAP → hot-reload (HEAR it)
  visual: chat → harness writes a seed+renderer → client re-render → SVG/canvas (SEE it)
```

The orchestration half is **already ours** — bBuzz ships the Claude harness ("claude
harness stock"). BuzzForge is *not* freqlab's code (PolyForm Shield, no-compete — LEAVE);
it is our harness driving our substrate, on the multiplayer studio stack we already ruled.
freqlab contributed the **pattern only**, precedented as Remotion-class in the ledger.

## 2 · THE PIPELINE (every arrow already has a pattern)

| stage | sound | visual | existing pattern |
|---|---|---|---|
| describe | chat prompt in the huddle | chat prompt in the huddle | bBuzz harness |
| build | harness → nih-plug Rust (CLAP-first) | harness → deterministic seed+renderer | organ / studio |
| preview | cargo build → **hot-reload, hear it** (test signals, samples, live in, MIDI) | **client re-render, see it** (SVG/canvas) | studio-music / listening |
| iterate | change params/DSP, re-hear | flip seed/nibble, re-see | fork law (DB-5) |
| publish | send CLAP to DAW folder | pin master (AR, sha256) | MEDIA-1 |
| inscribe | signature sound → on-chain seed+renderer | on-chain seed+renderer | DB-1 art law |

## 3 · L-VERIFY TABLE — raw licenses, receipted 2026-08-21 · SHA-PINNED 2026-08-21 (§3a)

| component | license | receipt (raw, this pass) | posture |
|---|---|---|---|
| **nih-plug** (robbert-vdh/nih-plug) | **ISC — VERIFIED** | raw `LICENSE` at master: *"ISC License · Copyright (c) 2022-2024 Robbert van der Helm"* | **TAKE** — the sound substrate |
| **vst3-sys** (RustAudio/vst3-sys) via `nih_export_vst3!()` | **GPLv3 — VERIFIED** | nih-plug README §Licensing (verbatim): *"the VST3 bindings … are licensed under the GPLv3 license … any VST3 plugins built with NIH-plug need to be able to comply with the terms of the GPLv3 license"* | **CONDITIONAL** — VST3 output only, GPLv3-gated (PF-1) |
| **CLAP** (free-audio/clap) | **MIT — VERIFIED** | raw `LICENSE` at main: *"MIT License · Copyright (c) 2021 Alexandre BIQUE"* | **TAKE** — the default export path, unencumbered |

**Consequence, ruled:** the CLAP path is ISC (framework) + MIT (format) = clean. The VST3
path pulls GPLv3 through vst3-sys. **PF-1 (founder, 2026-08-21): CLAP is the default
export; VST3 is opt-in behind a named GPLv3 source-on-request notice.** ~~Owed before
BF-1: SHA-pin all three…~~ **CLOSED by LEAD, 2026-08-21:** all three pinned (§3a), quotes
re-verified byte-level at the clones; the visual-render L-VERIFY is closed by the BF-2
ruling (platform Canvas/SVG = zero third-party render dep). Standing clause: any future
shader/Rust-WASM dep gets raw-read + pinned before boarding.
**PF-1 executed 2026-08-21:** the VST3 opt-in is implemented as cargo feature `vst3`
(`crates/buzz-gain`, NOTICE-VST3.md beside it) — dual-build receipted: the default
artifact emits `clap_entry` only; `--features vst3` adds `GetPluginFactory`. The notice
travels with the crate.

### 3a · PINS (zCode, 2026-08-21 — sha256 of the license files at the pinned commits) <!-- PUBLIC-CONSTANT: content pins of public repo license files -->

| repo | pinned commit | date | file | sha256 |
|---|---|---|---|---|
| robbert-vdh/nih-plug | `f36931f7af4646065488a9845d8f8c2f95252c23` | 2026-05-10 | `LICENSE` (ISC) | `9a6b01e206b7c24a562280bee8eb719ff803042b5e42f977e95c942e2215369a` <!-- PUBLIC-CONSTANT: sha256, public LICENSE --> |
| robbert-vdh/nih-plug | `f36931f7af4646065488a9845d8f8c2f95252c23` | 2026-05-10 | `README.md` §Licensing (the vst3-sys GPLv3 warning, verbatim) | `8b72e8d11c7be322cf307f733a6cd4dbabc3369d9a08b4d0c075214de9a1f93f` <!-- PUBLIC-CONSTANT: sha256, public README --> |
| RustAudio/vst3-sys | `f3e8f01c3de6d5df2f503c920c9f2bf8166a771b` | 2023-06-19 | `license.md` (GPLv3, "either version 3") | `eccd8f3b1ef26c7d40aca899dd9b0068227fd52deff60778a3c7c048cdaf6c4f` <!-- PUBLIC-CONSTANT: sha256, public license.md --> |
| free-audio/clap | `a47f6badb49d948fd009998f28309cdab78979c9` | 2026-07-28 | `LICENSE` (MIT) | `da7cee3f00825d45db7cad8e0c65abf150faad60f4acb0ab46137887ba536abe` <!-- PUBLIC-CONSTANT: sha256, public LICENSE --> |

vst3-sys note: repo quiescent since 2023-06-19 — the pin is stable by stillness, not by
churn. Seat 3's three raw receipts above were re-verified byte-level against these
clones before pinning (trust-the-repo law applies to in-house accounts too).

## 4 · TEMPLATES ARE LAUNCH-PADS, NEVER RAILS (§3b of the work order)

- **Sound starters:** Effect (EQ / comp / reverb / delay / saturation) and Instrument
  (synth / sampler / drum), **CLAP-first**, each a working plugin from one sentence.
- **Visual starters:** generative seed→SVG/canvas pieces in the hex-art idiom (the organ's
  synesthetic twin — one seed, sound *and* sight).
- **Freedom law:** every template opens to full source; the artist may change anything, or
  never open it at all — freqlab's *"no coding required but it's encouraged."* UI idiom is
  the artist's choice (WebView / egui / native panels for sound; Canvas / SVG for sight),
  not ours to impose.

## 5 · SAFETY WRAPPER — for AI-authored real-time DSP (O-3)

AI-written audio Rust can panic or blow up an output. Non-negotiable in every sound
template: a **hard output limiter** on the signal path and a **crash-guard** wrapper that
catches a panicking plugin and declares the fault instead of taking the host down
(freqlab's own lesson, reimplemented clean). Builds run in a constrained cargo profile.
Every AI-touched output carries the **⚙ badge**; a human/⚙ review precedes any share.

## 6 · THE MULTIPLAYER MODEL (the differentiator freqlab lacks)

- **Shared (in the Yjs doc):** the source of the piece — nih-plug Rust / renderer code,
  parameter values, knob and control state, the project's chat context.
- **Local (per participant):** the compiled artifact and the audio/preview render — build
  and hot-reload are a **per-participant action** against the shared source (each hears/sees
  on their own machine); a "push build to room" makes a build the shared reference.
- **bAiGenTs are ordinary LiveKit participants** editing the same Yjs doc — the room-AI
  seat shape broom-agent already occupies. No artist is blocked alone at 4am.
- Transport is the **huddle's data channel** over the LiveKit venue we already run.

## 7 · THE ARTIST LANE — first-class, what brightens the heART

1. **Guidance in-band:** the harness explains *what it built and why* (this envelope, this
   filter, this color map) in plain language — a teacher, not a vending machine.
2. **Practice/learn loops:** guided "try changing X, hear/see what happens" cycles; the
   forge is something an artist grows with. Founder-creed lane — *built for the poor
   starving artist:* zero-credential where possible, learn-by-doing, craft made reachable.
3. **Fork = expression:** fork any piece (sound or visual), flip a seed/param, hear/see it
   instantly, parent untouched, mint the fork with provenance (DB-5). The community
   fork-tree *is* the gallery.
4. **Sovereign self-art:** humans and AI co-create, badges honest, the founder's style
   stays the anchor and AI extends rather than replaces (SPEC-DJBUZZ §7).

## 8 · GATES

| | question | status |
|---|---|---|
| **PF-1** | CLAP default, VST3 opt-in behind a GPLv3 notice | **RULED — founder, 2026-08-21** |
| **BF-1** | build the forge on this stack (spec ratified → code lap opens) | **OPEN — code lap live** — founder GO (work order) + PF-1 ruled; spec **ratified by LEAD 2026-08-21**; §3a pins closed; first build session queued next per cadence law (one phase per session) |
| **BF-2** | the visual-render dep choice + its L-VERIFY (prefer platform Canvas/SVG) | **RULED — LEAD, 2026-08-21: platform Canvas/SVG** (browser-native Canvas 2D + SVG; zero third-party render dep → L-VERIFY vacuously clean, receipt = the visual starters' import surface; any future shader/Rust-WASM dep: raw-read + pin before boarding) |
| **DB-1** | the sound *and* visual inscription class (seed+renderer + AR master) | rides SPEC-DJBUZZ DB-1 |

## 9 · OUT OF SCOPE (the fence)

No freqlab code boards (PolyForm no-compete). No macOS-only assumption — CLAP + Rust is
cross-platform from line one (our box is Win/WSL). No secrets in this PUBLIC repo. No build
before BF-1. If any piece already landed, **verify before executing.**

**Seat 3 (Fable 5), 2026-08-21 — DRAFT for zCode (LEAD) and the founder's signature. 🐝💚**

**Ratified by zCode (GLM 5.3, LEAD), 2026-08-21 — lineage verified on disk, license
receipts re-verified byte-level and SHA-pinned (§3a), BF-1 opened (code lap live), BF-2
ruled (platform Canvas/SVG). §3b artist-first and §5 DSP safety remain load-bearing
exactly as drafted. Next: BF-1 first build session. 🐜**

---

## ADDENDUM · lane C2 (2026-08-28) — PATTERN NOTE: the covenant-zapper (BOLT12-offer-in-profile-metadata, zappable)

**What boards: a PATTERN, nothing else.** The upstream that demonstrated it —
`gudnuf/bolt12-covenant-zapper`, a Bitcoin++ 2024 hackathon project — is
**UNLICENSED** (verified 2026-08-28: GitHub license API 404, no LICENSE file at
the repo root). Not one line of it boards; any estate implementation is
first-party code, written by us.

**The pattern, in our own words:** a Lightning **BOLT12 offer** — a static,
recipient-generated payment code (`lno1…`) — placed in a Nostr profile's
**Kind-0 metadata**. The profile becomes **zappable**: any wallet or client
that speaks offers requests an invoice against it and pays directly; the zap
receipt rides as a signed event. **What it replaces:** LNURL-pay's answering
host — with an offer there is no pay-server to run, no invoice endpoint to
keep alive, and no custody surface of ours anywhere in the loop. Payer
privacy rides the offer's blinded paths.

**Why the forge cares:** artist-first value flow with zero estate-run payment
infrastructure. Every artist's profile carries their OWN offer — value flows
peer-to-wallet, the hive never holds keys, and nobody's income depends on a
server we operate. It is the receive-side twin of the A-metering rail
(b-denominated compute settlement): value IN to creators, compute OUT to
agents, both sides intermediary-free. Pairs with §7's sovereign self-art:
the artist's identity, keys, and now their payment rail are all theirs.

**Standing clause:** BOLT12 itself is public protocol documentation (BOLT #12);
this note boards the pattern only. Any future implementation re-applies the
§3a discipline — raw license reads and pins on every library it touches —
before boarding.
