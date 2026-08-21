# RECEIPT — the szli6792 raid: seventeen repos, zero licenses, one attribution refused, and the studio answer

**Founder's order, verbatim (2026-08-21):** *"figure out how to leverage this the best
ways. first thought for me is frontend ui/ux for our multiple visual and sound creation
buzz studios. we need a simple visual interface to modify, share, cocreate with other
members/bAiGenTs can work with art in real-time in sync ?"* — and on the account:
*"based IMO this is pepi's creator … ??"*

**Method:** seven-agent pass — full census with per-repo license fetch, three deep dives
reading actual files, an attribution investigation, an adversarial flip attempt on the
attribution, synthesis. Every failed fetch declared in the workflow record. Confirmed
first: **szli6792 appears nowhere in either of our trees before today** — the founder
was right that this is new.

---

## 1 · THE HEADLINE, AND IT IS A WALL

**Zero of the seventeen repos carry a license file.** Under copyright default that is
all-rights-reserved, and under the raid doctrine — take what the license permits, do no
harm ever — **the code take is zero lines.** Ideas, facts, and lessons are free;
everything else stays where it is. Most of the account is CU Boulder coursework
(instructor-authored frameworks, multi-student team rights) and Dapp University
tutorial artifacts — third-party lineage stacked on top of the missing licenses.

## 2 · MODULE-PANEL-TEMPLATES — the name misled, and the files decide

**It is not a UI kit.** It is a library of *physical* front-panel drilling and cutout
templates for Eurorack modular synthesizer hardware — per-manufacturer folders of KiCad
`.kicad_pcb` files and centimeter-dimensioned SVG exports (hole circles and panel
outlines for Make Noise, Intellijel, Mannequins and thirteen others). No JavaScript, no
CSS, no audio code, no application code of any kind. It is also a **stale fork** —
zero szli6792 commits, frozen at the upstream's 2020 head — and the upstream is
unlicensed too.

**What genuinely survives for the buzz studios is one idea, and it is free of this
repo entirely: the modular-synth idiom.** Patchable modules, one panel per function,
knobs and jacks as the whole interface — a strong mental model for a creation-studio
UI that belongs to the synth tradition, not to any repository.

## 3 · PEPI ATTRIBUTION — verdict: LIKELY NOT THE CREATOR; the tree must not record it

The founder's read was reasonable — an account with deep Pepi tooling — and the
adversarial pass, whose brief was to *flip* the initial verdict, strengthened it
instead. The evidence that decides it:

- **The operator wallet was identified and proven on-chain**: EOA `0x1609e546…adc3`
  deployed the PEPI contract as its first-ever transaction (CREATE-address computed
  from RLP+keccak and self-tested), sent the exact inscription-load transaction the
  repo cites, and deployed the V2 relaunch. One wallet ran the whole launch family.
- **That wallet was completely dormant across the entire window in which szli6792
  created and populated the repo** (nonce frozen through Sep 1–26, 2024; repo created
  Sep 21–22). The repo correlates with no on-chain event at all.
- **The repo misidentifies its own source contract** — its description names one
  contract while the transaction its ReadMe cites targets a sibling. The deployer of
  both would not confuse them; the mislabeling reads like an outsider navigating a
  confusing multi-contract launch.
- A grep of the account's full 6 MB notebook finds **zero wallet addresses and zero
  transaction hashes**; no Pepi surface, thread, or interview names the account; its
  GitHub social graph is empty.
- The one genuine *for* — the tooling includes a re-encode-for-reload direction and
  full trait-layer knowledge — is inert: that capability was never exercised on-chain
  by anyone.

**Consequence:** the verdict is not "confirmed" in either direction, so **no attribution
line enters the tree.** The single check that would settle it: the funding origin of
that wallet's first gas on Base, or a signed message from it. Side finding, useful for
the museum: the genuine collection lives on **Base** (three contracts, one operator);
an Ethereum-chain "PEPI" appears on a scam-listing site as a plausible copycat — the
"which chain is real" confusion is itself a teachable exhibit.

## 4 · THE RAID LIST

**TAKE — facts and ideas only (uncopyrightable; clean-room reimplementation, courtesy
nod where noted):**

1. **Pepi chain facts:** the Base contract family, the inscription-load tx, and the
   calldata schema — `set{Bodies,Eyes,Mouths,Hats,Accessories,Clothes}` as
   `(level, count, rects[])`, rects `[x,y,w,h(,color)]` on a 32×32 grid, pack batching.
   Chain-public facts; grist for the inscription studio and the museum.
2. **The verification-loop idea:** clone the target contract to a testnet, replay
   re-encoded payloads, diff `getSVG()` against mainnet — confirms a loop we already run.
3. **PNG→rect-SVG, the concept plus its failure modes:** horizontal-only run merging is
   insufficient for inscription byte budgets (ours needs 2D greedy merge or per-color
   `<path>` runs); regex-stripping black styles is a trap (SVG's default fill is black);
   always convert RGBA. Courtesy nod to szli6792/PNG2rectSVG as inspiration — nothing more.
4. **An escrow checklist item:** paying `address(this).balance` in a multi-asset escrow
   drains all parties — the tutorial fixed it in one function and left it callable by
   anyone in another. One line for the contract-review checklist.
5. **Cataloging idiom:** template folders per manufacturer with tested/fix/untested fit
   labels — reimplemented, never copied.

**LEAVE:** all code in all seventeen repos (no license anywhere); all 797 Pepi sprite
SVGs and dumps (unlicensed repo *and* third-party artwork the repo author never owned);
the Ethercities saved page (embeds third-party UI and an MIT project's shell — rights
the owner cannot grant); the `Unlicense` SPDX headers in the Solidity files (boilerplate
inherited from an unlicensed upstream — broken chain of title, not a grant); the whole
panel-template fork; and the manual paste-into-a-website decode workflow, which is a
regression against our programmatic ABI decoding.

## 5 · THE STUDIO ANSWER — what the founder actually asked for

The shortest defensible path to *"members and bAiGenTs co-create art in real-time in
sync"*, built from what we already run plus clean licenses:

- **The look:** our own panel/module components in the existing `ui/` Vite lane, in the
  modular-synth idiom — panels, knobs, patch cords as the design language. Web Audio API
  for the sound panels (platform, no license question). Any prior-art patcher UI gets
  its license verified per-repo before a single take; noted now: VCV Rack is GPLv3 —
  patterns-read only unless we accept copyleft on that surface.
- **The sync semantics — the actual co-creation:** **Yjs (MIT)** as the shared art
  document. Mature CRDT, presence/cursor awareness, built for high-frequency
  knob-and-brush updates. Automerge (MIT) is the credible alternative; raw WebRTC data
  channels are transport with no merge semantics, and hand-rolling conflict resolution
  is the mistake we decline in advance.
- **The room:** **the LiveKit venue we already run** (broom-agent lane, Apache-2.0 —
  agent-in-room with live barge-in already proven). One room per studio gives presence,
  talk-while-you-draw audio, and a data channel to ship Yjs updates over.
  **bAiGenTs join as ordinary LiveKit participants editing the same Yjs document —
  exactly the seat shape broom-agent already occupies.** The founder's question
  contained its own architecture: the room AI seat *is* the co-creating agent.
- **What the walls forbid:** any code or art from this account; Pepi sprites in any
  serialization; GPL mixed into this surface without accepting GPL. Everything named
  above is MIT/Apache-2.0 with routine attribution — clean.

**Gate BS-1 (founder):** green-light the studio build on this stack. The raid
contributed vocabulary and cautionary lessons; the studio is built from Yjs + our
LiveKit venue + our own panels. That is the whole take, and it is enough.

**Seat 3 (Fable 5), 2026-08-21.** Full pirate rules honoured: everything that serves
the hive taken — and it turned out the license walls meant the takeable part was the
ideas, which were the valuable part anyway. Do no harm held. 🐝
