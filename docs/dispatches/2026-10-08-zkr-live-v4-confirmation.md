# 2026-10-08 — vaulta/zk: the finalizer's LIVE v4 confirmation — green on zkrtst111111 (exit 0, 9 passed / 0 failed / 0 never-ran), plus a live-caught helper defect fixed the same day

Lane: SPEC-ZK-RECEIPT-AGGREGATES-1, owner: zCode (Vaulta/finalizer
seat, continuing per "go from task to task"). This closes the ledger
line that has stood since the founder's correction: *"the earlier live
result belongs to v2 at fd12cc373; no live-v3 claim should survive in
canon until that exact repaired artifact executes."* **The exact
repaired v4 artifact — the byte-identical blob merged to main at
8519eab6c (sha256 5529c92d…) — has now executed live, green.**

## The live run (labels per the two-evidence-paths law)

- `verification_source`: the local Jungle4 follower, the SAME receipted
  runtime instance as the four green boot receipts (pid 1063985, chain
  73e4385a…, live-synced; follower == public-API views concurred on the
  full anchors table before the run).
- `submission_source`: https://jungle4.greymass.com (wallet + pushes;
  keosd-held bnrzk wallet).
- target: `zkrtst111111`, on-chain code hash == pinned release wasm
  sha256 `7a86ac34…` (identity gate PASS — read-only, before any push).
- **Verdict: exit 0 — `RESULT: 9 passed, 0 failed (incl. 0 never-ran)`**
  — identity PASS; all seven negative legs PASS on their exact
  contract-specified refusal reasons (forged proof / count=21 / mutated
  root / kind=1 / re-verify / asym reversed 0-19 / asym reversed 1-20 —
  each `count proof REJECTED — plonk pairing false` or
  `anchor already verified` as specified, rc=19); exhaust PASS
  (`anchor table FULL (bounded resource budget)`); final PASS with
  coverage "7 claims — exactly what discovery recorded this run" and
  the asserted final table (27 rows == cap; verified_at classes exact).
  Verbatim: `docs/receipts/zkr-live-v4-green-2026-10-08.txt`.

## The first run was RED — and the harness was right

Run #1 (minutes earlier, identical command) exited 1: `forged` FAIL and
`final` FAIL. Root cause, established from the run's own kept
diagnosis dir + independent table reads: the forged leg's discovery
(the unverified (root,0,20) pool) returned **seq 1 — a VERIFIED row**
— although unverified targets exist (seq 3/103/999/…) and the same
query re-run standalone returns seq 3. The transient: the served row
shape at that read emptied the class pool in `final-find.mjs`
(`!r.verified_at` is false for a string-typed `"0"`), and the helper's
old **silent cross-class fallback** (`pool.length ? pool : matches`)
substituted the first ANY-class match — a verified row. The push then
refused for the WRONG reason, and the claim duplicated reverify's seq 1
— which my round-4 helper hardening (duplicate-seq → exit 8) refused
to grade. **Every downstream gate did its job; the defect was the
helper's silent degradation itself.**

## The fix (same day, offline-proven first)

`final-find.mjs` now: (1) validates numeric ABI fields — any
non-numeric `seq`/`kind`/`count`/`verified_at` is `READ-ERROR`
(retried by the caller, never trusted — strict ABI validation before
class assertions, the standing acceptance law); (2) **no cross-class
substitution** — an empty requested class pool is `NONE`, a loud
discovery failure (the leg records FAIL; the run never pushes at a
wrong target).

Offline regressions added to the committed battery
(`zkrself-parse-test.sh` + `fixtures/find/`): normal table class-exact
picks (unverified→seq 3, verified→seq 1); **only-verified table +
unverified query → NONE** (the live-run defect shape); string-typed
verified_at → READ-ERROR both classes (the run-#1 anomaly shape).

Re-run after the fix: parse-test **21/21** (15 prior + 6 new),
`zkrself-final-v4-offline-test.sh` **23/23**, `zkrself-final.test.sh`
**6/6**, `zkrself-final-offline-test.sh` **3/3**. The live green run
above was executed BEFORE the helper fix (its discoveries were
correct); the fix removes the degradation path that produced run #1's
red — a future transient of that shape now fails loud at discovery
(READ-ERROR retries → leg FAIL) instead of pushing at a wrong target.

## Boundaries

- Run #1's red output kept verbatim:
  `docs/receipts/zkr-live-v4-run1-red-2026-10-08.txt` (honest record;
  both runs label their sources).
- The follower instance's one-shot receipts govern as before: if the
  instance restarts, re-run `follower-receipts.sh` before further
  verification-source claims.
- No deployment, no RAM purchase, no state mutation: every push in
  both runs was a refused negative leg; the standing-anchor
  reconciliation is read-mostly by design.
- Lane's remaining open beats unchanged: tungsten-2 leak distinguisher
  (sibling: machinery + preregistration in-tree), tungsten-4 scale
  (sibling: machinery staged). PQ inventory in-tree (sibling).
