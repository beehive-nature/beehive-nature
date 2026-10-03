# bChat stack genesis — NIP-44 v2 in JS, all official vectors green; the three-lane surface lands

Seat: zCode (GLM). Date: 2026-10-02. Trigger: founder order — "see what you
can do with this and our tech stack. you are starting our messaging/DM/chat
stack," with the GrapheneOS Messaging integration analysis (reuse Android
plumbing, never its trust model; three lanes: SMS / BNR private / Autonomi
attachment). Canon: docs/specs/SPEC-BCHAT-1.md (this dispatch's receipts are
its §vectors section, in CI).

## What landed (one lane, branch `zcode/bchat-stack-2026-10-02`, rides this commit)

- **surfaces/bchat-nip44.js** — the estate's first JS NIP-44 v2. Built ONLY
  on already-vendored parts (bnr-sign.js: @noble/secp256k1 2.3.0 ECDH,
  @noble/hashes sha256+hmac) plus pure-JS HKDF (RFC 5869) and ChaCha20
  (RFC 8439). Current-spec format: length-prefixed padding, HKDF-expand
  L=76 with info=nonce, version byte 2, strict base64. Deployed caps
  explicit: rejects empty and >65,535-byte plaintexts (the bkimi lesson,
  encoded).
- **surfaces/bchat-core.js** — transport-neutral envelope v1: three frozen
  trust lanes, measured attachment states (descriptor-only → … →
  hash-verified), RETAIN/FORGET as publication-consent routing with an
  honest sweep report (GLOSSARY-BRIDGE ruling), bMeter-shaped receipts that
  strip contents by construction.
- **surfaces/bchat.html** — the surface: register-aware (bee/raver/
  cypherpunk via register.js + tokens.css), SIMULATED-labeled SMS demo lane
  (display-only, no fake sends), real BNR private lane (NIP-17 rumor→seal→
  gift-wrap, NIP-42 AUTH, dual-home ROOM + road-memory + opt-in probe),
  Autonomi descriptor attachments ("Building" — capability-truth), envelope
  inspector + verbatim wire log for the cypherpunk register, and a
  prove-the-encryptor panel that runs the NIP's own vectors in-page.
- **e2e/bchat-core.test.mjs + e2e/bchat-nip44-vectors.mjs** — CI-wired
  (tests.yml node list): every official NIP-44 v2 vector from the
  sha256-pinned paulmillr/nip44 file, RFC 5869 case 1, RFC 8439 §2.4.2,
  core-model invariants, and the surface's source laws (SIMULATED labels,
  noopener external links, no-request-on-load).
- **Registration ritual, one commit**: root estate.json row (id `bchat`,
  family `bnr`, home `skaists.buzz`, LIVE, honest `limit` naming every
  not-yet-real part), review.html SURFACES entry, build-atlas output
  (119 listed · 110 counted).

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

**CLAIM 1 — the encryptor matches the official NIP-44 v2 vectors.**
EVIDENCE: `node --test e2e/bchat-core.test.mjs` — 22/22 pass, including all
35 conversation-key vectors, 8 invalid-key rejections (twist/no-sqrt/order),
the message-keys table, the padded-length table, deterministic encrypt/
decrypt with fixed nonces, 3 long-message sha256-pinned cases, 13 invalid
decrypt rejections, and the 4 length-bound rejections. Pinned source:
nip44.vectors.json sha256 269ed0f6…e25040 (the NIP's own pin, checked at
bake time). BOUNDARY: "sound by construction against the pinned official
vectors" — no field-strength claim beyond that wording cap.

**CLAIM 2 — the surface loads clean and behaves at 390 px.**
EVIDENCE: Playwright smoke on a local server: zero page/console errors;
register toggle works (bee→cypherpunk→bee); key generation arms a 64-hex
x-only identity; in-page vector panel 5/5 ✓; offline send is HELD locally
with "connect is a click" state; receipts log records it. Screenshots at
%TEMP%/bchat-390.png and bchat-sent-390.png (session-local, not committed).
BOUNDARY: the RELAY leg is untested live this turn — see open items.

**CLAIM 3 — the estate checks pass with the registration complete.**
EVIDENCE: estate-check PASS (110 counted · 119 listed), door-counts PASS
(6 doors agree), estate-source PASS except the committed-hub byte check,
which regenerates from HEAD and by design requires the hub to be COMMITTED
with the registry — it passes the moment this commit exists (mechanism
read at e2e/estate-source.mjs:67-79, not assumed); r5-surface-audit PASS;
lint-ci-shape 104/104 guarded; my test battery 22/22 after all edits.
BOUNDARY: CI's own run is the final word; these are same-tree local runs.

## Open items — named, with next owners

- **Relay kind allowlist UNVERIFIED**: `wsl -e ssh oracle` refused (connection
  reset, 2026-10-02) — whether skaists.buzz accepts kinds 14/1059 is unproven.
  The surface renders OK/CLOSED verdicts verbatim either way. NEXT OWNER: box
  seat (read relay kind policy; if 1059 bounces, allowlist it under the ops/
  change-both-together law).
- **Live two-device DM proof**: needs the allowlist + a second key; the
  self-send loopback (ephemeral key) is exercisable in-page today.
- **Android surface** (GrapheneOS Messages plumbing, MIT): SEAT-OPEN; first
  beat = fork/licensing pass at HEAD, then conversation UI bound to bChat
  Core with the three lane badges.
- **Autonomi retrieval adapter** (descriptor → stream; bview's service worker
  is the candidate seam): NEXT OWNER: bData/bview seat.
- **Language**: bchat.html is English-only at genesis; 28-tongue adopt is the
  language lane's beat under corpus laws.

## Upstream check (standing law, done before the lane)

`gh api notifications` 2026-10-02: five estate PRs visible (bview bLink,
ant-extsig 0.21.0, bnames registry-fee, zBlood gate rider, docs/stack) —
no dirvine-originated requests affecting our backend outstanding in the
notification surface. x0x #622/#505: unchanged posture per standing memory.

## CI receipts (the branch's own runs)

- **Run 1 (e97eae192)**: `test` job green; `static` red on two beats —
  both mine, both cured in 7a979b965: (1) the one-shell law
  (e2e/register.test.mjs:171-175 — exactly one shared-loader tag, and it is
  tour.js?v=42 which bootstraps register.js itself; bchat.html had loaded
  register.js directly too); (2) the Engine Room directory is GENERATED
  (scripts/build-stack-surfaces.mjs) — a new surface requires regeneration;
  stack.html rebuilt (128 surfaces · 119 registered · 9 unregistered),
  --check green. `wallet` job also red on the raver adapter battery —
  NOT reproduced from this tree: two local runs of
  `WALLET_REG=raver node e2e/wallet-adapter.mjs` at e97eae192 both exit 0
  (30 passed / 0 failed); run 2 then passed the wallet job clean — flake
  class, recorded.
- **Run 2 (7a979b965)**: static/meter/test/wallet GREEN. `node`+
  `eternal` red — triaged to **INHERITED, not this lane's**: main itself is
  red at e8a8fa280 (#329, language lane; tests run 37102228253) with the
  IDENTICAL failing steps (comprehension + engineflow in node; ETERNAL
  fronts + footer-audit ratchet in eternal; wallet reds besides). Proof
  this branch adds nothing to that cluster: engineflow fails identically
  with BASE's stack.html swapped into this tree (c5c15f6d7 stack,
  unchanged comprehension source = 6 disclosures at base/main/HEAD alike —
  the 7th is runtime-made and broken by #329's regression, not by the
  bchat row); both relays answer 200 today, so it is not an outage.
  NEXT OWNER of node/eternal reds: the #329/#331/#332 seat (main's own
  descendant run is the cure path; #332 dc03615c6 was still queued at
  07:0xZ).
- **Footer-audit ratchet — the 12 "worse" WERE mine, now cured (this
  push)**: bchat.html lower-half text violated the floors (SMALL <12px,
  FAINT 4.40:1, CAPS text-transform on h2, TAP-height buttons). Fixed to
  the audit's own floors: all text ≥12px, --dim ink minimum, no forced
  capitals, 34px tap floor, lane badges keep AA ink text with colored
  glyph+border (identity never rode color alone anyway). Proof:
  `node footer-audit.mjs --only bchat.html --regs bee,cypherpunk` →
  "0 views with findings on 0 surfaces · no findings". Battery still
  22/22; page smoke clean (zero console errors, in-page vectors 5/5).

## Pass 2 (same seat, same night) — the wire shared, proven live, made ETERNAL

- **surfaces/bchat-wire.js** — the NIP-01/NIP-17 assembly (event ids/sigs,
  rumor→seal→gift build, verify-and-unwrap) extracted from the page into ONE
  module shared by bchat.html and the lane's harnesses; the page keeps only
  ROOM + socket (turnkey law). Battery grew to 25/25: gift round-trip
  between fresh identities, forged-seal refusal, wrong-identity refusal.
- **scripts/bchat-live-proof.mjs — the LIVE receipt (on-demand, never CI).**
  Run against BOTH roads 2026-10-02 ~21:21Z, fresh ephemeral identities:
  wss://skaists.buzz AND wss://relay.skaists.dev connect, speak NIP-01,
  challenge AUTH (NIP-42), we answer kind 22242 correctly — and the relay
  REFUSES the fresh identity on both doors, verbatim:
  `OK false auth-required: verification failed` and
  `CLOSED auth-required: not authenticated` (subscribe gated the same way).
  FINDING (measured, both roads): the relay is a MEMBER hive — publication
  and reading sit behind member auth, so kind-1059 acceptance is
  unreachable for non-member keys; the open question moved from "kind
  allowlist" to "member mint." Box ssh (port 22) timed out both routes all
  day — the harness is what settled it. NEXT OWNERS: invite lane (mint
  bChat identities) + box seat (behind member auth, confirm kinds 14/1059;
  ops/ change-both law). The surface now states the auth wall in the door
  card ("MEASURED 2026-10-02, both roads") and renders verdicts verbatim.
- **e2e/bchat-eternal.test.mjs (CI-wired, 18/18)** — the lane's 390px
  eternal front: rub law WATCHED from the harness (no socket, no external
  request fires on load), lanes + SIMULATED in place, register law,
  in-browser vectors 5/5, held-local send, FORGET actually prunes and SAYS
  consent-routing, Autonomi descriptor descriptor-only/Building. It caught
  a real bug on first run: `.compose{display:flex}` defeated the `hidden`
  flag (author CSS beats UA CSS) — cured with the `[hidden]{display:none!important}`
  guard. Related honest-semantics find, banked: an until-read OUTBOX copy
  is born read and sweeps itself — correct per policy; the eternal test
  resets retention to persistent before the descriptor step.
- FORGET receipts now CARRY: the last sweep's note stays visible
  (timestamped) instead of dying with the render that performed it.
- Re-verified after all edits: battery 25/25 · footer-audit
  --only bchat.html = zero findings, all three registers · eternal 18/18 ·
  build-stack-surfaces --check OK (directory regenerated with the
  bchat-wire.js reference) · lint-ci-shape 104/104.

## Worktree law, kept

All edits and the commit are from `C:/Users/travi/wt-zcode` on branch
`zcode/bchat-stack-2026-10-02` (cut from origin/main c5c15f6d7). The shared
checkout sits on `grapheneOSmessagingZcode` (lane marker branch, occupied) —
not touched, per one-writer-per-worktree. No hex ≥48 anywhere unmarked; the
vectors file carries PUBLIC-CONSTANT on every baked line.
