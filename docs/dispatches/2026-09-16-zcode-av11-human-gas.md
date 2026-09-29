# 2026-09-16 — AV-11 human native-gas surface audit + the P0/P1 matrix (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-11 (P1, last of the
founder's roll order: AV-6 → AV-5 → AV-4 → AV-11, then STOP for
reconciliation). Founder brief: enumerate every first-line payment path;
prove the human-facing contract never asks for ETH/ARB/native gas; distinguish
first-line from R5 last-line adapters; fail automatically on a future
first-line human-gas surface. Both audits in CI. **Branch**
`zcode/av2-stale-quote-ttl`, worktree `wt-zcode-av2`.

## The audit (`scripts/audit-human-gas.mjs`, in CI)

- **Rail classification** (the table's spine): vaulta/solana/hive/wallet.html
  FIRST_LINE; arweave/bitcoin LAST_LINE (R5 native-asset fallbacks). An
  UNCLASSIFIED `wallet-adapter-*.js` fails the audit — the future-rail gate.
- **Human-facing scan**: HTML text nodes (whole-file, script/style bodies
  blanked — the code between `>` and `<` operators is not prose) + quoted JS
  literals with sentence shape or bare unit words (`gwei` is
  identifier-shaped AND human-facing), against a gas-surface pattern
  battery; abstraction claims (`gasless`, `no gas`, `sponsor`) count clean.
- **Registered-findings ledger**: a first-line gas surface must be REGISTERED
  with its remediation or the audit FAILS (the detector); a stale ledger
  entry (surface removed) also FAILS — the ledger can never lag reality or
  outlive its fix. `registered ≠ resolved` is printed on every pass.

**Findings — the R5 gas-abstraction backlog, now machine-tracked** (this is
the honest RED content of AV-11; the surfaces exist today):
1. Base USDC top-up says "tiny gas" — wallet.html:778 AND meter.py's
   voucher_view (the serve bridge tells the same story) — an ERC-20 send
   needs human-held ETH;
2. Arbitrum ANT flow: "Gas is estimated live before you confirm the
   broadcast" — the human pays ARB gas;
3. a gas-read status line ("gas: reading…");
4. gwei rendering in the panel (gas belongs in the adapter, never the
   panel).
Remediation for all: the R5 paths (sponsored sends / paymasters / relayers /
price-inclusive totals). Vaulta (gasless resource delegation) is the
first-line exemplar — clean.

**Result: PASS (structure)** — every rail classified, every first-line gas
surface registered with remediation, none stale, and the detector proven
live during construction (it caught its own fixture leaks and three
extractor blind spots before settling).

## The P0/P1 matrix (the founder's reconciliation ask)

`docs/agents/AV-P0-P1-MATRIX.md` — every AV lane against **specified →
implemented/CI-proven → live-wired/operationally proven**. The one-line
truth: **columns 1 and 2 are green across P0+P1; column 3 is empty.** No AV
lane is live-wired — each names its deploy gates in the matrix (token+fresh
rates+poller wiring for AV-1/2; door-health signal at burn callers for AV-3;
the meter deploy for AV-5/6 handles; R5 gas abstraction for AV-11's
findings). The standing rule written into the matrix: column 3 requires a
box receipt naming the wired caller.

## Receipts

- AV-11 audit PASS locally and in CI (line added beside the batteries).
- AV-4 (prior commits this lane): door audit 2/2 + handle battery 3/3 in CI;
  regressions all green (voucher 16/16, x402 45/45, AV-1 5/5, AV-3 5/5,
  AV-5 3/3, AV-6 4/4).
- No production deployment; the workerb STOPS here per the founder's order —
  P2 (AV-7/AV-8) is specified-only and awaits a ruling, not invention.
