# ECO ADAPTOR SWEEP — seven ecosystems reviewed for demand velocity (2026-09-12)

Order: "review different adaptor/plugins our stack integrates with; most
have made big updates and i need your team to review their code and report
changes synergy and recommendations. all for maximum demand velocity and
our eco adoption."

Seven research seats fanned out (one per ecosystem), web receipts only —
no upstream code cloned, no estate code touched (astra holds the stack
this session). Every claim carries a permalink or is marked UNVERIFIED.

## 0 · The one-screen read

| target | live state | verdict | top action |
|---|---|---|---|
| WithAutonomi | org restructured; browser client PRs final-stage; node auto-upgrades | ACT NOW (defensive + adopt) | pin the fence's upgrade channel; re-receipt member-write on stable |
| bluesky-social | Spaces alpha (gated communities); AppView open-sourced; all MIT | ADOPT (biggest new attention pool) | one PDS + funnel mirror (~2 days), then feed generator |
| 3Speak / Mantequilla-Soft | 300+ commits since June: ad platform w/ viewer rev-share, paywalls, live rooms | INTEGRATE (never copy — no license) | probe embed.3speak.tv HLS into our watch rooms; pitch Vaulta escrow to tibfox |
| openhive-network | official Hive org, core very active, frontends quiet; wax+workerbee MIT | SELECTIVE ADOPT (libs only) | mirrornet cross-poster prototype via wax |
| VaultaFoundation | DORMANT in 2026 (motion is WharfKit v4 RCs); big updates were 2025 | HOLD + one spike | A-denominated mainnet meter spike; never build on Vaulta EVM (sunset 2025-10-08) |
| elkimek/get-based | NAME COLLISION — health PWA, not Base; AGPL | MINE FOR PATTERNS only | Web-Locks single-writer wallet-tab pattern (re-implement, AGPL-clean) |
| freqlab (jamesontucker) | DEAD since Jan 2026; PolyForm Shield (noncommercial); macOS AI VST-builder | ADMIRE, DON'T ADOPT | build our own onchain-MIDI WebAudio toy as surface #94 |

Three premise corrections for the founder's "big updates" frame:
- **get-based is not a Base project** — "based" = biology (getbased.health).
- **freqlab's repo has zero commits since 2026-06-01** (tip 2026-01-21); only live signal is a waitlist.
- **VaultaFoundation's updates are 2025 history** (A-swap, EVM sunset, Spring MIT); 2026 org activity is a metrics bot + WharfKit RCs elsewhere.

The genuinely fresh 2026 motion is **WithAutonomi, Bluesky, and 3Speak**.

---

## 1 · WithAutonomi (Autonomi) — the org moved, the browser client is one merge away

**WHAT IT IS.** Autonomi moved orgs: `maidsafe/autonomi` froze 2026-05-22
(last release `stable-2026.2.3.2`, 2026-02-19; crates.io `autonomi` crate
stuck at 0.10.2) and the official org is now **WithAutonomi** (created
2026-03-21, 30 repos): **ant-client** (ant-core lib + ant-cli, successor
to the `autonomi` crate), **ant-node** (stable **v0.18.1** 2026-09-02;
**v0.19.0-rc.2/beta.1** 2026-09-09), **ant-sdk** (antd daemon + FFI
Python/Swift/Kotlin/Go/JS + MCP; v0.12.1 2026-09-04), **ant-protocol**
(v2.3.5), **saorsa-core/-transport** (DHT/QUIC successor to ant-quic;
relicensed AGPL→MIT/Apache in v0.27.0), **ant-webex** (browser extension
v0.2.2), **indelible** (enterprise gateway v0.12.0). ant-quic itself now
lives at **saorsa-labs/ant-quic** (beside **x0x** and saorsa-webrtc).
Cadence: weekly-ish, RC→beta→stable with **auto-upgrade on stable**.

**RECENT CHANGES — the five critical answers (receipted):**
- **(a) Browser client — our law is about to break, not yet broken.** Five
  coordinated PRs opened 2026-09-01, all still OPEN 2026-09-11:
  [ant-client#186](https://github.com/WithAutonomi/ant-client/pull/186)
  "ant-core-powered direct browser client" (+15,556 lines: WASM + WebRTC
  Direct, pays once, uploads, resolves DataMaps **without an application
  gateway**; mergeable_state dirty),
  [ant-node#220](https://github.com/WithAutonomi/ant-node/pull/220)
  WebRTC-Direct node endpoint,
  [saorsa-core#158](https://github.com/WithAutonomi/saorsa-core/pull/158)
  browser DHT,
  [saorsa-transport#160](https://github.com/WithAutonomi/saorsa-transport/pull/160)
  signaling-free WebRTC. Today's shipped browser path remains
  ant-webex + antd local daemon. **"Browser client does not exist" stays
  true for stable — but it is final-stage, not absent.**
- **(b) API breaks vs our 0.18-era member-write.** No receipt of
  member-write removal; breaks per ant-client CHANGELOG: 0.3.3 reworked
  external-signer merkle API (ADR-0003), 0.3.4 broke
  `resolve_binary`/`check_for_update`, 0.3.5 resumable finalize (no double
  payment on shortfall). The lib is now **ant-core 0.8.1, MIT OR
  Apache-2.0** — embedding is license-clean vs the old GPL-3.0 crate.
- **(c) Pricing — our quadratic law needs re-derivation.**
  [ADR-0004](https://github.com/WithAutonomi/ant-node/blob/main/docs/adr/ADR-0004-commitment-bound-quote-pricing.md)
  (merged 2026-07-07): quote price is now a function of the node's
  **audited storage commitment** (formula moved to ant-protocol; raw
  record-count floor retired by ADR-0006).
  [ADR-0008](https://github.com/WithAutonomi/ant-node/blob/main/docs/adr/ADR-0008-storage-economics-and-payment-protocol.md)
  raises merkle settlement multiplier to **3x**; ADR-0013 exists because
  old clients paid then had uploads refused at exact shortfall —
  **payments destroyed** on version skew.
- **(d) Mesh lane.** [ant-quic v0.27.50](https://github.com/saorsa-labs/ant-quic/releases/tag/v0.27.50)
  (2026-09-07): RFC 9000 §14 fix — handshake flights no longer rely on IP
  fragmentation (the x0x #505 fix family), plus explicit P2P bind-address
  fix. x0x + saorsa-gossip pushed 2026-09-12.
- **(e) GDPR/public-data APIs:** no changes found (UNVERIFIED beyond
  search; public-upload APIs only grew).

**SYNERGY.** antd (ant-sdk) is a ready-now simplified gateway (localhost
REST, CORS, `/health` write_ready, FFI/MCP) for our surfaces; the browser
PRs are the 93-surface endgame; 0.27.50 hardens x0x on fragment-filtering
networks.

**RECOMMENDATIONS (ranked).**
1. **Fence-check NOW (~1h):** ant-node stable auto-upgrades within ~24h
   of release ([v0.18.0 notes](https://github.com/WithAutonomi/ant-node/releases/tag/v0.18.0))
   — pin the upgrade channel on our fenced node so the receipted
   member-write path cannot drift, then **re-run the member-write receipt
   on v0.18.1**.
2. Adopt **antd v0.12.1** as gateway core (1–2 wks).
3. Track ant-client#186/#220; pilot one surface on merge (1 wk spike).
4. Bump x0x lane to **ant-quic 0.27.50** (days) — retire-trigger from the
   0.41.2→0.41.3 runbook still standing.
5. Re-run the pricing study against ADR-0004/0008 (1 wk) — the quadratic
   shape is still count-derived but the coefficients moved.

**RISKS.** Silent auto-upgrade under the fence; settlement-version skew
(ADR-0013 — never mix old client + new nodes on merkle batches); repo
renames rot our internal pins; PR #186 is dirty/open — do not build on it.

**VERDICT: ACT NOW** — pin the fence's upgrade channel and re-receipt
member-writes on v0.18.1 before v0.19.0 goes stable.

---

## 2 · Bluesky / atproto — Spaces is converging on our exact NIP-29 model

**WHAT IT IS.** Federated stack: PDS (per-account signed repos) → relay
("bsky.network" bigsky/Go) → AppView (now open-sourced in-repo as
`packages/bsky`, npm @atproto/bsky 0.0.272). Identity = DIDs + DNS
handles; typed APIs via Lexicons; chat.bsky (incl. group chats); video
via Bluesky-run Kotlin transcoder (MIT, bluesky-video); moderation =
ozone; auth = atproto OAuth (PAR + DPoP). Biggest 2026 shape-change:
**Spaces** — permissioned-data protocol extension (proposal 0016): gated
mini-networks with a space-authority DID, per-(user,space) repos, LtHash
commits, party-to-party sync without relay — protocol-native private
communities.

**RECENT CHANGES (receipted).**
- [Spaces Alpha live 2026-08-20](https://atproto.com/blog/atproto-spaces-alpha)
  (gated communities, sub-only publishing; alpha Docker `pds-spaces-alpha`;
  full launch targeted fall 2026; impl PR
  [atproto#5187](https://github.com/bluesky-social/atproto/pull/5187)).
- **AppView open-sourced** in the monorepo
  ([packages/bsky](https://github.com/bluesky-social/atproto/tree/main/packages/bsky)),
  actively merged through Sept (e.g. #5461, 2026-08-31).
- New **bsky** monorepo (2026-07-06) + **Jetstream v2 with network
  replay** ([Protocol Services, 2026-08-13](https://atproto.com/blog/introducing-bluesky-protocol-services),
  [repo](https://github.com/bluesky-social/bsky)).
- PDS v0.5.33/0.5.34 (2026-09-11, [releases](https://github.com/bluesky-social/atproto/releases));
  SSRF hardening + bounded decompression (#5468/#5502).
- ozone 0.4.x (2026-09-04): off @atproto/api, Prometheus metrics.
- social-app (MIT) 1.123.0 (2026-06-06) → 1.132.0 (2026-09-03), ~9 releases.
- [AT Protocol trademark policy 2026-07-15](https://atproto.com/blog/at-protocol-trademark);
  IETF ATP WG kicked off 2026-04-02.

**TECH + LICENSE.** TypeScript reference impl, **dual MIT/Apache-2.0**;
social-app **MIT** (fork the UI legally); Go services Apache-2.0. Minimal
PDS = one Docker container + DNS ([pds repo](https://github.com/bluesky-social/pds)).

**SYNERGY.** One `pds.skaists.dev` gives every agent seat a DID + handle
(same "server hosts keys for members" shape as buzz); our owner-signed
kind-34550 join event maps almost 1:1 to Spaces' space-authority
credential; feed-generator (MIT,
[repo](https://github.com/bluesky-social/feed-generator)) is a pure demand
surface for funnel content; Bridgy Fed
([fed.brid.gy](https://fed.brid.gy/docs)) is the incumbent nostr bridge;
their video embeds compete with our rooms — keep metering ours, post
teasers there.

**RECOMMENDATIONS (ranked).**
1. **One PDS + mirror funnel lanes as posts (~2 days)** — Docker PDS,
   cross-post feed, immediate access to Bluesky's discovery graph.
2. **Custom feed generator "skaists" (~2–3 days)** — subscribable in-app
   by any Bluesky user.
3. Spaces alpha prototype (~1 wk, flagged alpha-risk) — model one buzz
   community as a gated Space ahead of fall launch.
4. Bridgy Fed opt-in for buzz↔Bluesky (~1 day) before building custom.
5. atproto OAuth as secondary login on estate surfaces (~3 days).

**RISKS.** PBC-run AppView/relay centralization (mitigations trending:
open AppView, Hubble public mirror); trademark policy constrains our
branding; Spaces is alpha with promised destructive migrations.

**VERDICT: ADOPT** — highest-leverage adjacent attention pool audited;
infra is MIT, cheap to enter.

---

## 3 · 3Speak / Mantequilla-Soft — shipping daily; integrate, never copy

**WHAT IT IS.** 3Speak = decentralized video on **Hive** (HIVE/HBD
creator payouts, IPFS storage, Hive Keychain/HiveAuth). Mantequilla-Soft
(~54 repos, one dominant maintainer `tibfox`) is effectively 3Speak's
whole dev shop: React frontend `new-3speak-tv`, encoder `3speakencoder`,
upload/embed service `embedvideos`, IPFS hot-cache `hotnode`, player,
short-form `hivesnaps`, audio rooms `hangouts`, browser extension. **No
TV-app repos** — native surface is a Capacitor 8 iOS/Android app
(appId `capacitor.threespeak.app`). SPEAK token: no trace in code since
June (UNVERIFIED).

**RECENT CHANGES (receipted; 300+ commits on `production` since 2026-06-01,
last push 2026-09-11).**
- **Full advertising platform** (Aug–Sep): platform + consent overlay
  ([ff5956f, 2026-08-24](https://github.com/Mantequilla-Soft/new-3speak-tv/commit/ff5956f));
  ad flights paid **in HBD/HIVE from the wallet**
  ([10194f8, 2026-09-03](https://github.com/Mantequilla-Soft/new-3speak-tv/commit/10194f8));
  **viewers opt in to earn a share of ad revenue**
  ([48b810d, 2026-09-02](https://github.com/Mantequilla-Soft/new-3speak-tv/commit/48b810d),
  PR [#417](https://github.com/Mantequilla-Soft/new-3speak-tv/pull/417));
  server-gated Skip + shorts swipe-past-ad (99d4c3b, 2026-09-06).
- **Supporters-only paywall** (5d9bb0c, 2026-08-14) + per-video guest
  lists (ae52119, 2026-08-15).
- **Live audio rooms** via LiveKit + OpenPods room announcements
  (c05ffb4 2026-06-13, 29773ef 2026-08-14).
- Media replace on existing posts (ff3fa10 2026-07-28, 31fcec7
  2026-09-08); **embed-HTML copy in share menu**
  ([46b0aad, 2026-09-03](https://github.com/Mantequilla-Soft/new-3speak-tv/commit/46b0aad));
  transcripts + podcast feeds (f3aa069, 2026-08-20); YouTube-style watch
  redesign (1f82c50, 2026-06-26). No tags/releases — `production` IS the
  release channel.

**TECH + LICENSE.** React+Vite, Express OG-card server, TUS resumable
upload → embed.3speak.tv → community encoders → IPFS supernode (4–7 day
hot cache). **License: NONE on new-3speak-tv** — all-rights-reserved;
reuse of their code is off the table; APIs/embeds are fair game.

**SYNERGY.** Their catalog into our watch rooms (if HLS/MP4 fetchable off
embed.3speak.tv, our ffmpeg ingest co-watches it); their new ad platform
+ paywall vs our opensess/charge/settle per-view escrow — a drop-in
alternative rail at finer granularity; buzz↔Hive community mirroring;
their Capacitor app as distribution only if our rooms stay embeddable.

**RECOMMENDATIONS (ranked).**
1. **Probe embed.3speak.tv HLS for room ingestion** (1–2 days) — cheapest
   catalog expansion for watch rooms this quarter.
2. **Pitch Vaulta per-view escrow to tibfox** as alt checkout (3–5 day
   spike; he ships daily, responsive surface).
3. **buzz ↔ Hive bridge**: NIP-29 agents posting room announcements into
   Hive communities (2–3 days, pairs with §4 wax).
4. Embeddable room widget for their surfaces (1–2 wks; blocked on
   relationship — monitor).

**RISKS.** No license; centralized chokepoints despite IPFS talk
(their gateway, their supernode, their keys); bus factor ≈ 1; public API
docs absent — integration needs reverse-engineering.

**VERDICT: INTEGRATE (zero code reuse).**

---

## 4 · openhive-network — official Hive org; adopt wax + workerbee (MIT), monitor the rest

**WHAT IT IS.** The Hive blockchain's official GitHub home (101 repos,
[hive.io](https://hive.io); core team associated with Blocktrades —
UNVERIFIED formally). Flagships: **hive** (C++ node), **hivemind**
(social API), **dhive** (JS client, a GitLab mirror), **condenser**,
**wax** (Rust/WASM API client), **workerbee** (automation on wax).
Core is healthy (pushes today); frontends quiet. **Zero nostr or SPK
repos in-org** — no collision with buzz. PRs barely used; flow is direct
pushes to `develop` — track commits, not PRs.

**RECENT CHANGES (receipted).** hive mainnet version bumped to 1.28.7
([1584099c, 2026-07-10](https://github.com/openhive-network/hive/commit/1584099c);
last GitHub release page is 1.28.3, 2025-11-07 — release page lags chain);
P2P hardening batch (c1fe08a7/81398699, 2026-08-16); DHF refactor
(157d5185, 2026-09-01). hivemind: `/sync-status` endpoint (790d6925,
2026-08-02), boundary vacuums for massive sync (2026-08-29). wax v0.3.9
(Python 3.14 CI, formatters). **workerbee**: full runtime/orchestration +
observer-filters build-out (8e10afed/7fd0c79b/e48b2977, 2026-07-03,
incl. mirrornet test targets). clive/beekeeper wallet tooling dormant.

**TECH + LICENSE.** wax/hivemind/workerbee **MIT** — safe; core `hive`
custom/NOASSERTION — read before any copying; several repos are GitLab
mirrors (verify canonical before depending).

**SYNERGY.** wax (Python+JS Hive client) + workerbee (filters/observers)
= ready-made agent rails to mirror buzz room drops into Hive communities
(peakd/ecency audiences) and collect HBD — pure distribution; NIP-29
groups ↔ Hive communities map cleanly and they have zero nostr presence.
HBD is a proven creator stablecoin rail (3Speak precedent) alongside
Vaulta/Base.

**RECOMMENDATIONS (ranked).**
1. **Hive cross-post agent via wax** (1–2 wks): pip-install wax 0.3.9 in
   a sandbox, post a test op to **mirrornet** (safe, no real funds).
2. Fork workerbee's observer design for our own chain watchers (2–3 day eval).
3. HBD as alt payment rail — mirrornet round-trip first (M–L).

**RISKS.** License trap on core; bus factor ~3; mirror-repo confusion.

**VERDICT: SELECTIVE ADOPT** (wax + workerbee now, org on monitor).

---

## 5 · VaultaFoundation — dormant in 2026; our rails are safe; the value is A-token + Savanna finality

**WHAT IT IS.** The renamed EOS Network Foundation (93 repos). Holds
contracts + infra, **not** the node — Spring lives at
[AntelopeIO/spring](https://github.com/AntelopeIO/spring); eosjs remains
at [EOSIO/eosjs](https://github.com/EOSIO/eosjs); the live wallet SDK is
[WharfKit](https://github.com/WharfKit). Chains: Vaulta mainnet (native
asset now **$A**) + **jungle4** still the sandbox of record
([jungletestnet.io](https://jungletestnet.io/) — faucet dispenses A).

**RECENT CHANGES (receipted) — the honest headline: since 2026-06-01 the
org is essentially dormant.** Only pushes are an automated metrics bot;
every other repo last pushed ≤ 2025-10-01; AntelopeIO/spring last push
2025-11-12; no 2026 posts on vaulta.com technical updates. The "big
updates" are 2025 events that still matter to us:
- **EOS→A swap** began 2025-05-14, 1:1; wallets/exchanges confirm A into
  2026 ([Exodus KB upd. 2026-09-03](https://www.exodus.com/support/en/articles/11382719-eos-has-migrated-to-the-vaulta-a-token)).
- **[system-contracts v3.10.0](https://github.com/VaultaFoundation/system-contracts/releases/tag/v3.10.0)**
  (2025-06-25): staking/claim now require $A via `core.vaulta`; bpay
  emits **A** — notification handlers must match
  ([upgrade guide](https://docs.vaulta.com/docs/latest/advanced-topics/upgrading-to-vaulta)).
- **Vaulta EVM SUNSET**: support ended 2025-10-08 (consolidated around
  exSat); final evm-contract v2.1.0 / evm-node v2.0.0 are migration-only.
- Spring final act: **relicense to MIT** (e6a99f6, 2025-11-12); last
  stable v1.2.2 (2025-08-19), v2.0.0 stalled at dev previews.
- The one live 2026 motion: **WharfKit js v4.0.0-rc1→rc7**
  (2026-08-26 → 2026-09-11, [releases](https://github.com/wharfkit/js/releases)).

**TECH + LICENSE.** eosjs frozen at 22.1.0 (npm latest tag 2021) — zero
bump risk, zero upstream fixes; our name-u64/jsdom/K1 traps are permanent
in-house law. system-contracts custom all-rights-reserved (call, don't
copy); Spring MIT.

**SYNERGY.** **Savanna instant finality** (live on jungle4): credit
views on finality signal instead of block-depth heuristics; A-denominated
meter pricing via `core.vaulta`; WharfKit v4 as eventual eosjs
successor for frontends.

**RECOMMENDATIONS (ranked).**
1. **Hold the line (0 effort):** jungle4 + eosjs 22.x forced by nothing;
   pin Spring v1.2.2 on any node we operate.
2. **A-denominated mainnet spike** (1–2 wks): re-price meter/escrow to A
   per the docs guide; audit `eosio.token`/bpay handlers.
3. Watch WharfKit v4; spike a session faucet UI on rc7; adopt at stable.
4. **Never build on Vaulta EVM** — sunset; if an EVM USDC rail is wanted,
   exSat is a separate audit.
5. Finality-driven escrow crediting (low–medium).

**RISKS-TO-OUR-RAILS.** Upstream dormancy = slow security fixes;
jungle4 is community-run (keep an endpoint/version canary — exact BP
Spring version UNVERIFIED); stablecoin issuer drift post-swap — verify
our USDC issuer's state before mainnet escrow (UNVERIFIED whether
migrated).

**VERDICT: HOLD + one spike** — A-migration spike on jungle4 this
sprint; ignore EVM.

---

## 6 · elkimek/get-based — NAME COLLISION: a health PWA, not Base

**WHAT IT IS.** "getbased" (getbased.health) is a local-first **personal
health intelligence PWA**: lab imports, SNPs, wearables, encrypted Evolu
sync, optional AI chat. **"Based" = biology, not Base L2.** No names, no
USDC, no NFTs; zero code hits for "x402"/"usdc"/"Base Mainnet". Only
crypto surface: an embedded **Cashu ecash wallet** funding Routstr AI
nodes (pay-per-prompt inference).

**RECENT CHANGES (receipted).** Extremely active solo project: **1,212
commits since 2026-06-01**, last push today (82d0a42e, 2026-09-12 —
Routstr mint-polling fix);
[v1.19.0 2026-09-05](https://github.com/elkimek/get-based/releases/tag/v1.19.0-cli-agents)
(CLI agent providers: Codex/OpenCode/Hermes via local Companion);
Routstr wallet security + balance-preservation fixes (26615ef8, 3833168b,
Sept); Routstr Private TEE mode (61120b13, 2026-07-11).

**TECH + LICENSE.** Vanilla-JS PWA + Node companion; **AGPL-3.0** —
network copyleft; **no code reuse in our surfaces** (patterns only,
re-implemented).

**SYNERGY.** Low for Base rails; transferable value: (1)
`js/cashu-funding-coordinator.js` — exemplary multi-tab wallet UX (Web
Locks leader election + BroadcastChannel fan-out: one tab monitors
mints) — directly useful for our wallet-bearing checkout tabs;
(2) vendored-first build (zero third-party CDN scripts) — independent
validation of our first-party-only law; (3) refund/custody-transition
patterns if agent seats ever pay for inference.

**RECOMMENDATIONS.** No product adoption. **Port the Web-Locks
single-writer pattern (~3h, re-implement AGPL-clean)** into USDC/x402
wallet tabs before the next checkout surface ships. Optional 1–2 wk
spike: Cashu ecash as sub-cent complement to x402 for agent micro-spend.

**VERDICT: MINE FOR PATTERNS.**

---

## 7 · freqlab (jamesontucker) — dead repo, wrong license, wrong platform; keep the pattern

**WHAT IT IS.** Not a WebAudio playground: a **macOS Tauri app that
builds real VST3/CLAP audio plugins through AI conversation** (a
per-project Claude Code agent writes Rust DSP; one-click compile, hot
reload, git-versioned changes, DAW publishing). MIDI preview rig
(sequencer, MIDI file playback, hardware MIDI) + FFT analyzers.
([README](https://github.com/jamesontucker/freqlab/blob/main/README.md),
[freqlab.app](https://freqlab.app) — pay-what-you-want + waitlist.)

**RECENT CHANGES — none.** Zero commits since 2026-06-01; tip is
[4f18935 "updated copy", 2026-01-21](https://github.com/jamesontucker/freqlab/commit/4f18935);
last release [v0.2.8, 2026-01-20](https://github.com/jamesontucker/freqlab/releases/tag/v0.2.8);
a Windows-support v0.3.0 tag (1882a96, 2026-01-29) never merged to main;
repo pushed_at 2026-03-13 (housekeeping). License pivoted GPL-3.0 →
**PolyForm Shield 1.0.0** (2c7beea, 2026-01-20) — source-available,
**noncommercial only**.

**SYNERGY.** Weak direct (macOS-native, license-locked,
Anthropic-dependent, possibly stalled). Real *pattern* synergy:
conversational-agent-writes-DSP maps onto buzz agents generating live
audio from onchain scores; its MIDI preview rig validates demand for
MIDI-first toys; its anti-generative positioning matches our
performance-surface ethos.

**RECOMMENDATIONS.**
1. **Build our own first-party WebAudio toy** — onchain-score-driven
   synth + spectrum visualizer as surface #94 (effort M; prototype a
   WebAudio graph reading one MiDi contract's score).
2. Monitor the waitlist for a v2 (trivial).
3. Optional outreach to nanoshrine (indie, pay-what-you-want ethos) re:
   web MIDI toys / nostr-transported audio (effort S).

**RISKS.** PolyForm Shield blocks reuse; Claude CLI dependency;
mobile autoplay-unlock is a law for whatever we build ourselves.

**VERDICT: ADMIRE, DON'T ADOPT.**

---

## 8 · Cross-lane ranked moves for demand velocity

1. **Autonomi fence-check (today, ~1h, defensive)** — pin upgrade
   channel, re-receipt member-write on v0.18.1. Protects a proven rail
   from silent auto-upgrade; prerequisite for everything Autonomi.
2. **Bluesky PDS + funnel mirror (~2 days)** then **"skaists" feed
   generator (~2–3 days)** — the largest new attention pool on the
   table, MIT-clean, protocol-native gated communities (Spaces) landing
   this fall that converge on our NIP-29 model.
3. **3Speak HLS ingest probe (1–2 days)** — instant co-watch catalog for
   the watch rooms; follow with the Vaulta-escrow pitch to tibfox.
4. **Hive cross-poster via wax on mirrornet (1–2 wks)** — buzz room drops
   mirrored into Hive communities; HBD collection; pairs with 3Speak
   (same chain).
5. **Web-Locks wallet-tab pattern (3h)** from get-based, re-implemented
   AGPL-clean — hardens every checkout surface we ship next.
6. **Surface #94: onchain-MIDI WebAudio toy (M)** — the freqlab pattern,
   first-party, no license entanglement.
7. **Vaulta A-denominated meter spike (1–2 wks, later)** — when jungle4
   metering graduates toward mainnet; Savanna-finality crediting rides
   along.

## 9 · Method + fences

Seven parallel research seats (one per ecosystem), web receipts only
(GitHub API/releases/commits, official blogs, live sites); no upstream
repos cloned; no estate code touched — astra holds the stack this
session. Claims carry permalinks or UNVERIFIED. This dispatch is the
record; lane execution awaits founder word.
