# PHASE E UX — the ceremony cockpit: the two observations made visible

**Seat:** zCode (My Data / bPay UX only). **Date:** 2026-09-19. **Branch:**
`zcode/bdata-phase-e-2026-09-19` (UX rider stacked on the parked lane HEAD
`8a58e31a`). Backend signing/composer logic and Trezor transport were NOT
touched — the UX is built on the already-frozen contracts
(`bpay-sign` `/v1/sign/state` · `/v1/sign/begin` · `/v1/sign/receipt` ·
`/v1/testnet/settle`, refusal shapes verbatim).

## WHAT LANDED (all in `surfaces/bdata.js` + corpus + gates)

**THE CEREMONY RAIL** — the frozen backend states surface as one visible
spine inside the ceremony card, so the founder always knows where the
ceremony stands and what has NOT happened yet:
`PREPARED → AUTHORIZATION REVIEW → AUTHORIZED → DEVICE PREFLIGHT →
SIGNING REVIEW → SIGNED / NOT BROADCAST` (done ✓ / current highlighted /
future dimmed; orientation only — never an affordance, per the
one-concept/one-click law).

**OBSERVATION A — the harmless device preflight** (its own state, cyan,
shield): harmless by construction (no transaction is signed), proves the
pipe (device → transport → address) and that a refusal is handled cleanly.
The transport is named as INFRASTRUCTURE (Suite MCP underneath; this page
stays the cockpit — the mission law, rendered). The expected payer + path
come from the frozen `/v1/sign/state` review. Until the hardware lane
lands, the device gesture is a **labeled SIMULATED rehearsal** (estate
law: simulated is labeled, never implied) behind a one-press button;
the seam is where the real transport receipt binds later — no backend
semantics were invented. **OBSERVATION B stays LOCKED until A confirms**
(locked, not hidden).

**A deliberate Safe 7 rejection = a normal, user-controlled outcome.**
Both at the preflight (rejection panel + "run again" — the founder's own
re-press, never automatic) and at signing (the frozen
`{ok:false, error, why}` envelope classified by the transport's own words:
reject/refuse/cancel/deny → the calm cyan "You rejected this on the
device — nothing was signed, nothing was sent… not a system failure;
no automatic retry"; anything else keeps the amber ⚠ system-failure
panel).

**OBSERVATION B — the two real signatures** (gold, pen — visually distinct
from A on purpose): the full binding review (artifact, audience+origin,
invoice lineage, job/56 quotes, exact ANT ceiling, SEPARATE gas,
contracts+chain, payer+path, sealed plan) plus **the two-signature
manifest**: `1/2 — ERC-20 approve` (the vault may spend exactly the ANT
total — bounded, never unlimited) and `2/2 — payForQuotes, one call`
(carries ALL the quote payments), with the count law line and
SIGNING DOES NOT BROADCAST OR PAY prominent. Exactly ONE press.

**SIGNED / NOT BROADCAST, unmistakable:** banner-strength bordered
`NOT BROADCAST · NOT PAID · NOT UPLOADED.`, both slot hashes + recovered
signer, the receipt offered for inspection FIRST ("inspect this receipt
before anything else happens"), and broadcast visibly **locked** (a chip,
never a hidden step).

**THE SETTLEMENT LAW (UX):** the settle affordance now requires
`testnet` AND a **demo-shaped ceremony** (hot TESTNET key / `*-DEMO`
mode — the banked f3962879 pipeline proof, regression-gated E2/E3).
A real-Safe-7-shaped ceremony NEVER shows a settlement action — including
testnet/REPLICA-shaped hardware receipts (gate D3). Mainnet-shaped
receipts never exposed testnet controls before and still don't (A22b).

**TESTNET-REPLICA stays impossible to confuse with public Arbitrum
Sepolia** — the full-phrase banner on the review and the receipt badge
kept verbatim (fedb2095 rulings), gate-asserted D1/D2.

**Language:** 36 new corpus keys (`bd.cer.*`, `bd.obs.*`, new
`bd.sign.*`) ×29 tongues, ru/es/de/fr/zh drafted ⚙, others EN per the
visible-fallback law; language gate 13/13. (Phase E's older `bd.sign.*`
keys still render EN-fallback — noted, not relitigated here.)

## EVIDENCE

- **`e2e/bdata-phase-e.mjs` GREEN 55/55** (was 24/24): full ceremony A1–A24
  (rail, Obs A harmless+labeled, B locked→manifest→one press, SIGNED
  banner + locked broadcast + inspect-first, no settle), preflight
  rejection + recovery A2R1–5, LAW 1 refusal B1–4 (today's live machine
  state), signing rejection C1–C4 (calm panel, ONE dispatch), REPLICA
  hardware D1–D5 (banner + NO settlement), demo E1–E4 (settle survives
  where it lawfully belongs). Zero page errors everywhere; 390px.
- **`e2e/bdata-surface.mjs` GREEN 42/42** (no regression); language
  coverage 13/13.
- **THE BROWSER JOURNEY** — `node ops/bpay-sign/present-ceremony.mjs`
  (mocked frozen contracts only): twelve 390px shots
  `e2e/shots-bdata/ceremony-{01..12}-390.png` across three journeys —
  J1 the first real Safe 7 ceremony (shelf→price→auth review→AUTHORIZED→
  Obs A idle→**deliberate rejection (normal outcome)**→confirmed→Obs B
  manifest→SIGNED/NOT BROADCAST, settle absent), J2 the TESTNET-REPLICA
  hardware rehearsal (banner + no settlement), J3 the hot-key demo
  (settle + SETTLED ON THE TESTNET-REPLICA). **Zero page errors.** Key
  frames machine-vision-verified (Obs A teal vs B gold, dashed-gold
  manifest with 1/2 + 2/2, bordered NOT BROADCAST banner, locked
  broadcast chip, full-phrase REPLICA banner; no overflow/clipping at
  390px).
- `ops/bpay-sign/present-testnet.mjs` updated for the Observation A step
  (the live-stack walk; its live re-run is the founder's, ledger up).

## CONCURRENT SEAT — DISCOVERED, NOT DISTURBED

While this UX lane ran, a concurrent session was writing the Suite-MCP
transport in the SAME worktree (`crates/bpay-sign/src/suite_mcp.rs`,
`src/bin/safe7_preflight.rs`, `src/lib.rs`, a small `main.rs` import
diff — file mtimes seconds behind HEAD). That is the hardware lane the
parked runbook awaits. **None of it is in this commit** (explicit
pathspec; their files remain in the worktree untouched). No backend
semantics, no crate bytes, no transport code were read beyond
identification or modified by this lane.

## BOARD RULING ON THIS LANE (2026-09-19, on af02247b — banked verbatim in substance)

1. **`af02247b` stands as-is. No rewrite.** The pathspec commit was the
   right containment; verified by the board: zero `crates/watchpay` /
   `crates/bpay-sign` bytes in the commit.
2. **One writer per worktree** (the safer extension of one writer per file
   family): backend and UX must not share a worktree while coding
   concurrently. The concurrent-worktree incident is **a coordination
   hazard discovered and contained before contamination — not a code
   defect.**
3. **Board state:** bPay UX lane **GREEN / PARKED awaiting hardware
   contract**; the Backend Suite-MCP lane **continues, in its own
   worktree**; **no further UX implementation until actual Observation A
   data arrives** (the real Safe 7 receipt).
4. **The SIMULATED-rehearsal wording in Observation A flips only when the
   Safe 7 receipt actually exists** — the preflight panel's honesty label
   is load-bearing and must not be softened before then.
5. **The move is STAGED, not executed**: at banking time the backend
   writer was still LIVE in `wt-zcode-bpay-e` (`suite_mcp.rs` mtime
   04:02:53, ~100s before this check — a second write after the first
   sighting at 03:55:56). Moving files under a live writer would recreate
   the hazard inverted, so the fix ships as
   **`ops/bpay-sign/stage-backend-worktree.sh`** — a one-paste run with a
   LIVE-WRITER GUARD (refuses if any backend file changed in the last
   10 minutes), cut from the parked base `8a58e31a` into
   `wt-zcode-bpay-mcp` (branch `zcode/bpay-suite-mcp-2026-09-19`), work
   left uncommitted for the backend seat to commit as its own lane.
   Run it when the backend session closes.

## BOUNDARY NOT CROSSED

No edits to `crates/watchpay`, `crates/bpay-sign` logic, or any Trezor
transport. No backend semantics invented (the preflight device gesture is
a labeled rehearsal seam, not a new endpoint). No payment, no broadcast,
no upload, no authorization created/modified. No merge of neighboring
backend work. The organ's frozen contracts are consumed exactly as
shipped; the demo settle path (f3962879) preserved and regression-gated.
