# VENDING + WALLET PERSONA COMPLETION — three registers each, the OR-1 command board concept

**Lane:** zcode-or-persona · **Seat:** zCode (bFUzZ) · **Date:** 2026-09-13
**Founder order:** complete distinct register experiences on `vending.html` and `wallet.html` — New bee welcoming/simple/trust-building, Raver expressive/social/translation-forward, Cypherpunk a trauma-level-1 flagship OR command surface (pre-op assessment → procedure readiness → procedure → post-op recovery → discharge & follow-up; inpatient + outpatient tracks) as an interface concept and systems visualization, never clinical advice or a medical-care tool. Preserve the design system and the privacy posture; payment/wallet/consent boundaries explicit; never imply a transaction or medical action occurred when it did not; keyed translations for new copy; one-click recovery for bee/raver, detailed diagnostics for cypherpunk; 390px + persona-rendering + translation-coverage + zero-page-error checks; clean links to the OR Board without duplicating it; reviewable branch only.

## What landed

Both surfaces carry a persona layer in the register canon (one set of facts, capabilities and access — only temperature, hierarchy and copy change):

- **NEW BEE** — a welcome/first-minute trust panel (`p-bee`), calm copy, larger law text, and the one-tap recovery bar: when live reads fail, ONE button re-runs them and the bar stays friendly (offline-tested); never a dead end.
- **RAVER** — the floor banner (`p-raver`): PLUR strip (existing `plur.*` keys), translation-forward affordance (vending: "pick yours for the name" focuses the tongue select; wallet: the corpus line), social line from live machine data (holds count, latest mint), warm chrome.
- **CYPHERPUNK** — the **OR-1 COMMAND board** (`p-or`): a trauma-level-1 operating-room readout as an interface concept, banner-labeled "interface concept · systems visualization — not clinical advice, not a medical-care tool" in every tongue. Five phases (pre-operative assessment · procedure readiness · the procedure · post-operative recovery · discharge & follow-up) × two tracks (inpatient = custodial/keyed; outpatient = observe-only/walk-out). **Every cell quotes a real status the page already rendered** — no new claim, no new fetch, no second transport. A diagnostics drawer lists each read with code + evidence + retry (vending) or locate (wallet, via the new `__walletRefreshBalances` seam — same hook pattern as `__EVM_RAILS`/`__CHAIN_MATRIX`, exposing only a re-run of keyless balance reads).

Structural hierarchy differences are real, not recolors: measured **visible** order (flex reflow) differs 3/3 across registers on both surfaces — wallet bee leads connect→balances→pay, raver lifts garden+voucher, cypherpunk leads receipts→matrix→balances→composer behind the board; vending's board leads its flow. **Machinery is never hidden in any register** (the behavioral gates read `innerText`), and new panels use `.pcard`, never `.card`/`.step`, so the vending-shot lane's nth-of-type contracts cannot shift.

## Boundaries kept (the never-laws)

- No payment/wallet action implied: the recovery retry only re-READS; the plan/approve/memo flows untouched; "nothing moves" language intact (vending-shot behavioral proofs re-run green).
- No medical claim: the board maps THE ESTATE'S OWN operations (name-canon screen = pre-op assessment, plan gate = consent, comb finality = recovery, certificate+resurrection = discharge criteria, x402 audit = follow-up); the disclaimer rides the banner in all 29 corpus cells.
- The wallet's founder-ruled **phone fold law** (balance hero + keychain ring above everything at ≤700px — "a hero balance below the crease is a hero nobody saw") is preserved for every register: persona chrome and reordering are scoped to ≥701px; on phones the fold law rules and the panels fall in below the fold heroes. Found the hard way — wallet-fund's three fold checks went red on the first cut and are green again (94/94).
- OR Board: linked (1–2 relative links per surface, keyed `p.orLink`), never duplicated, its relay feed never fetched; or-board.html itself untouched (PR #76's polish rides independently).

## i18n

77 new keys (`p.*` shared 21 · `vp.*` vending 26 · `wp.*` wallet 30) × 28 docked tongues, ⚙ machine-drafted, recorded in `_meta.drafted`. **English is derived from the surfaces at draft time** (DOM innerHTML for static, the `T()` fallback for dynamic) so the corpus cannot drift from the page — the draft script asserts coverage of every extracted key. Evidence fragments inside board cells (e.g. "armed · memo-bound · jungle4") stay as data-English by the keyed-sentence line the corpus law draws; noted here as the honest boundary of this pass.

## Verification (all local, this worktree)

- `e2e/zcode-persona-check.mjs` — **84/84**: persona panels render per register (and only then); register applied on body; **visible hierarchy 3/3 distinct** on both surfaces; machinery sections all present in every register; OR-1 banner + 5 phases + 2 tracks + ≥12 evidence rows + diagnostics drawer (opens, rows render); **offline** (RPCs/price/arweave blocked): bee+raver show the one-tap retry, clicking never throws, bar stays friendly; cypherpunk shows detailed down/nm states; **ru translation**: bee title, recovery line, OR banner disclaimer, phase headings all render Russian; OR board links clean + no feed duplication; **390px × 6**: zero horizontal overflow, zero page errors, shots in `e2e/shots-persona/` (6 files).
- Regression: `wallet-fund.mjs` **94/94** (incl. the three phone-fold law checks + desktop order unchanged) · `wallet-matrix.mjs` 11/11 · `vending-shot.mjs` full pass (name-canon suite, plan/refuse/one-tap ERC-20 decode, 11/0 live resurrection, monitor deep-links) — first run had one CoinGecko ERR_FAILED flake, clean on rerun; its 13 refreshed live shots are committed as the run's receipts · `estate-source.mjs` 0 FAILS (corpus law: every key exists, every tongue covers, English matches) · `estate-check` PASS 95/104 · `no-page-errors` 104 walked · 0 · `node --test` register/no-dead-host/lang-coverage 38/0.

## Flags + remaining gaps

- **PR #76 overlap (known):** the polish lane (open, review-only) also touches vending/wallet/lang-corpus/coverage infra. This lane is built on origin/main (50d56d60) with additive, panel-scoped blocks and no renamed IDs/functions; the merge order is the reviewer's call.
- Evidence fragments in OR cells are data-English (see i18n note) — keying them is polish-lane-shaped follow-up.
- The wallet diagnostics use locate (scroll+highlight) rather than retry for panel-specific reads — only the keyless balance reads have a safe re-run seam today; widening that is a follow-up with the wallet seat's own conventions.
- Branch pushed for review only — not merged, not deployed, no CI claim beyond the local gates above (CI runs on the PR).

Co-authored-by: bFUzZ <bGoose@agents.skaists.dev>
