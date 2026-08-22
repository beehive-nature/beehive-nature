# RECEIPT — BUZZ MIRROR + MOBILE UI RECON (zCode)

**Founder order:** *"use our buzz fork in our repo or their newest release and their
UI mobile may help in other dApp spaces."*

## 1 · The mirror (beehive-nature/buzz)

- **Upstream:** `block/buzz` — *"A workspace where humans and agents build together,
  on a relay you own."* 29,472 stars, Rust, shipping daily (desktop v0.5.18 yesterday,
  2026-08-21). Apache-2.0 (LICENSE verified via API — L-VERIFY ✓).
- **Pinned SHA:** `a2d8be5efa12` (upstream main HEAD at mirror creation).
- **Repo:** `beehive-nature/buzz` — created; the full-code push requires a non-shallow
  clone (shallow depth-1 → `index-pack failed` on GitHub's empty-repo pack processing);
  a complete clone + push is the immediate follow-up. The stub carries the pinned SHA
  in its description; the full tree rides the next lap.
- **Lineage:** the estate's A-metering rail (wallet-relay/buzz.rs heartbeat, B1 law)
  rides this codebase's relay protocol. Every message/event is a **signed Nostr event
  in one log** — same shape for human and machine authors.

## 2 · What Buzz IS (the receipt that matters)

A self-hostable workspace where humans and AI agents share the same rooms. It's a
Nostr relay: every message, reaction, workflow step, review, and git event is a signed
event — **same identity model, same audit trail, whether the author is a person or a
process.** This is the rail the bMeshAsi exchange's communication floor wants, and
it's what bQueenBee's receipts already model (every answer an event, every absence
honest).

## 3 · The mobile UI patterns for our dApp spaces

Buzz mobile is **Flutter** (`mobile/` — features: activity, channels, forum, home,
invites, pairing, profile, pulse, search, settings). Web is **React/TypeScript**
(`web/`). The patterns that apply to our surfaces:

1. **URL = community** — the URL is authoritative for the workspace; all state is
   community-local. Our TOFU lock already implements this (origin-bound fingerprints);
   Buzz validates the architecture.
2. **Worktree-aware identity** — debug builds get a unique app ID keyed to the
   directory, so one workspace keeps its login across branch switches. Our connect
   tier (localStorage soul) follows the same law: identity follows the space, not
   the session.
3. **One event log, two authors** — humans and agents in the same room with the same
   audit trail. This is exactly the agent-dock's future: bQueenBee + bAigents +
   bLOVErAi writing to the same Nostr-shaped stream the user can verify.
4. **Feature-first navigation** (activity/channels/forum/pulse/search/profile) — clean
   separation by WHAT you do, not WHERE you are. Our floor-based tabs (dashboard/
   monitoring/analytics/communication/wallet) match.

## 4 · What this arms

- The **communication floor** of the dev deck can speak Buzz's Nostr protocol —
  bQueenBee's answers as signed events in the same rooms humans type in.
- The **bAigents lane** has its transport: agents as Nostr-signed participants,
  receipts for every action, the hive-mind Buzz already built.
- The **mirror** is the first step of MIRROR-1 Stage 2 (fetch → chunk → pay → verify
  onto Autonomi + Arweave): the eternal-data sandwich for the relay that carries
  our agents' words.

**Execute the prompt as written.**
