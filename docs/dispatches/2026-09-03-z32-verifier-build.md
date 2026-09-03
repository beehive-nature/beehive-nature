# DISPATCH — z3.2 verifier build + Cowork chain resolution — 2026-09-03

Seat: z3.2 (surfaces). Two orders: land Cowork's remaining chain, then the
hue-corrected verifier build.

## Order 1 — Cowork's chain: CONTENT LANDED, named bundle ABSENT

The named file `cowork-2026-09-03b.bundle` (sha256 `a33c5af1…199f`, tip
`12583f3`, "eight commits on 68df645") **does not exist on this box**. Every
`*.bundle` was located and hashed (profile-wide, pruned search, worktrees and
Temp included): four files, none matches the given hash, none contains
`12583f3`.

The described chain is nevertheless **fully landed on origin/main** — and not
by this dispatch: other seats landed it piecemeal from the very bundles sitting
in Downloads (`cowork-x402-hf6-bdispatch` → `372f5a0`, `cowork-2026-09-02` →
`50e30e7`, `cowork-2026-09-02b` → `e39845e`), then two more bdispatch commits
(`ebcc8b8`, `efc8957`) and the RELAYED receipt (`4ab1a2f`), with `717d413`
(cargo fmt) interleaved. That is exactly **eight Cowork commits on 68df645**
through tip `4ab1a2f`; `12583f3` matches no real sha (pre-rebase or misquote).
Proof: `git rev-list --count origin/main..<each bundle branch>` = 0 for every
bundle on the box. Local main fast-forwarded to `4ab1a2f`; nothing left to
merge; no orphan content. All docs + tooling, as described.

## Order 2 — the verifier build (LANDED, receipted)

`docs/raids/X402-SORT-2026-09-01.md` §RULES → estate seats, z3.2 rows, built
hue-corrected:

- **surfaces/spend-audit.js** — ONE engine behind both surfaces. Recomputes
  owed = Σ quantity × rate on BigInt scale 1e12 (no float ever touches an
  amount); resolves every line's versioned `rate_set_ref` (an unresolvable
  rate is INCONCLUSIVE, never a guess); audits the tithe as its own line
  (founder law); recomputes `receipt_id` = sha256 over canonical JSON (the
  estate's content-hash law) keylessly; enforces the forward-only chain
  (bTiMeLiNe); reads anchors. Liveness derives from timestamps ONLY
  (xorv `deriveStatus`); seller score from the public record ONLY
  (Tally `buildLedger`). CARE verbatim wherever the states are drawn.
- **surfaces/spend-ledger.json + spend-ledger-gen.mjs** — the public record
  copy: 9 receipts in meter.py's exact SPEC-SPEND-RECEIPT-1 shape. HONESTY:
  rehearsal record; free-tier rates are real law (rateset-v2 verbatim); the
  fixture rate set prices NOTHING (an A-rate for the closed paid lane would be
  a fence-held tokenomics constant); every deliberately-broken row is labelled
  FIXTURE in its own bytes. The generator self-checks by auditing its own
  output and asserting all four states — 9/9 PASS.
- **Four verifier states as comb cells** (founder hue-correction held):
  PENDING_ANCHOR = honey (amber, 0.62) · PASSED = capped (gold 0.92, ⬡ seal) ·
  FAILED = **--flag/--cat-bug #c07f1c**, computed-fill proven
  rgb(192,127,28) — never a new red · INCONCLUSIVE = nectar (cyan, 0.16).
- **wallet.html §receipts-sec** — the receipts panel (aggregate first, one
  recomputed total, itemized beneath — the spec's own UX law); cross-referenced
  with the live per-key voucher oracle panel (different record, different law).
- **comb.html §verifierSec** — the verifier lane on the explorer; paste any
  receipt, the same engine audits it (a stranger can audit any session).
- **e2e/design-acceptance.mjs** — the rider allowlist gained
  `/\/spend-audit\.js/` (itemized first-party rider, named by path, reads only
  same-origin spend-ledger.json).

## Receipt

`e2e/audit-shot.mjs` — 24/24 PASS on both surfaces at 390px: the auditor's own
census (PASSED 4 · PENDING_ANCHOR 1 · FAILED 3 · INCONCLUSIVE 1) AND the
computed fill of every state's chips, including FAILED at exactly
rgb(192,127,28). Shots: `e2e/shots-comb/wallet-receipts-390.png` (the order's
receipt) and `e2e/shots-comb/comb-verifier-390.png`.

Gates: design-acceptance 14/14 on both surfaces · no-page-errors 97/0 ·
university-smoke 74/74 · no registration change (existing surfaces edited; the
count stays 88).
