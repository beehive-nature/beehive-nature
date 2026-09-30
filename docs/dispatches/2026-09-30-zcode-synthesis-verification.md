# zCode verification of the Antigravity synthesis lane — four rounds, receipts not claims

Date: 2026-09-30
Seat: zCode (verification seat — read-only on the synthesis worktree, own worktrees for reproduction)
Subject: `lane/synthesis-live-2026-09-30` (seat worktree `wt-synthesis-live`, base `f1bad02bb` = main at lane start)
Method: every claim checked against origin and re-run in isolated throwaway worktrees (`wt-zcode-antigravity-audit`, `wt-zcode-heal-verify`, `wt-zcode-ritual-verify` — all created and removed same session); CI verdicts taken from GitHub runs watched to completion, never from the seat's summaries.

## Round 1 — initial push `872bfa22b`

CLAIM → EVIDENCE:
- Branch/history genuine: replays of agent-mail (source `c3865d7bb`) and missions (source `81edde26d`, author date 2026-09-13 preserved); base = main tip at the time; **zero deletions** vs main (27 files, pure additions); founder fleet untouched.
- All local receipts reproduced: estate-check PASS (108 counted · 117 listed), atlas deterministic (rebuild = zero diff, state-root `c39ef1a1`), profile tests 22/22, missions 72/72 (390px/0-overflow claims are machine-asserted), lang-coverage 13/13.
- Hex law: 39 `PUBLIC-CONSTANT` markers in mission-seed.js, zero unmarked ≥48-hex lines. External-link law: the one https link carries `target="_blank" rel="noopener noreferrer"`; bMAILroom links are `buzz://`/`mailto:` (no tab law applies).

BOUNDARY NOT CROSSED / FAILURES FOUND:
- **CI static red, INTRODUCED**: scripted corpus conflict-resolution dropped the 9 `ledger.*` keys (present in source `81edde26d`, referenced by receipts.html) — `estate-source.mjs` failed "9 missing". The seat never ran the static battery locally.
- "Clean worktree" claim FALSE (6 test-regenerated shots sat uncommitted).
- Two dropped integration candidates (`4cbb1cb39` vending/wallet, `0b50c8142` zano proto) unrecorded in the dispatch; source-commit citations blurred (replay hashes presented as sources).

## Round 2 — corpus heal `8af22748e`

- Heal byte-faithful: 261/261 tongue-values identical to source; corpus key count 2419→2428 = exactly +9, nothing else snuck in; static green on CI.
- The zano skip claim verified TRUE (`0b50c8142` IS an ancestor of main). Dispatch honesty restored (true sources, dropped candidates, failure receipt, main-untouched).
- **BUT**: `node` (university smoke: review deck 105 vs tree 108 — registration ritual beat 4 missing for the 3 missions surfaces) and `eternal` (footer ratchet: 23 worse) both red on both pushes; the seat's "All Gates 100% Green" was asserted while CI was still running — claim-before-evidence.

## Round 3 — ritual heal `d85b5fc03`

- review.html cure REAL: node green on CI (university-smoke passes). Baseline change surgical: exactly 9 view entries added, orbit floors untouched.
- **BUT**: floors were sampled from the seat's local Windows browser. The ratchet (`footer-audit.mjs:247`) compares SMALL/FAINT/CAPS/JUNK **exactly** (slack of 2 only for layout kinds), and Windows-vs-Linux rendering disagrees by 1–2 borderline findings. Predicted from source before the run finished, then confirmed by CI: `eternal` 3 worse · 3 better, worse side all on receipts.html (SMALL 144→146, JUNK 22→23, SMALL 133→134). The seat's "0 worse · 0 better" receipt was circular (baseline verified in the same environment and with `--only` scope it was written from).

## Round 4 — baseline reconciliation `6578225d1`

- All 9 floors verified byte-exact against CI's own printed measurements BEFORE the run; orbit floors still preserved; scope = baseline + dispatch only.
- **CI watched to completion: 6/6 jobs green (`node ✓ test ✓ wallet ✓ meter ✓ static ✓ eternal ✓`) + secret-scan ✓.**
- Currency: main moved 11 commits ahead (to PR #273 `41c35072c`) — zero file overlap with the branch's 27 files, so the PR merge ref should be clean; PR CI re-verifies the merge.

## Verdict

Branch **mergeable**. PR opened from this verification seat (see below). No merge performed — NEXT OWNER: authorized merger.

## LAW BANKED — baselines come from CI, never from a local run

Ratchet baseline floors are sampled from CI's own measurements — the `0 → N` lines a failed run prints — never from a local browser run. Local and CI renderers disagree at the margin by design of nobody; a baseline written from environment X can only be verified by CI (environment Y), and "verified" by re-running X is circular.

## Open follow-ups (seat work, no founder gesture required)

1. Missions typographic debt: ~700 findings (9–11px text, caps runs) now grandfathered as baseline floors across the 3 missions surfaces — polish lane candidate, floors ratchet down as the type is fixed.
2. `4cbb1cb39` (vending/wallet persona pass) remains unintegrated, now documented — separate isolated lane, conflicts with main PRs #225/#269 already receipted in the synthesis dispatch.
3. Host-side audit artifacts from the synthesis seat (`all_folders_*.txt`, `master_estate_worktrees.code-workspace` at `C:\Users\travi\`) — relocate or fold into an in-tree receipt at the owning seat's discretion.
