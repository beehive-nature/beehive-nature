# 2026-10-07 — bTunGsTeN WB002: the WASM-vs-model equivalence beat EXECUTED (vendored 2021 wasm on Antelope Spring 1.2.2)

zCode seat, branch `zcode/btungsten-wb002-hardening-2026-10-07` (the
hardening lane's standing order: "after those repairs, proceed with
WASM-versus-model comparison"; the founder's relay confirmed no seat
had taken it and the ruling requires no founder action). No check-in
before complete/live, per the founder's standing instruction.

## CLAIM

The VENDORED 2021 SimpleAssets wasm — byte-identical to upstream
`e6a042f`, NEVER rebuilt, pins from `wb002-specimen/PROVENANCE.md` —
executes on the CURRENT Antelope client (Spring 1.2.2, Savanna era,
this box's WSL Ubuntu, local dev chain) and agrees with the HARDENED
model (specimen profile) on every step of a 46-step deterministic
corpus.

**EVIDENCE** `scripts/btungsten/wb002-wasm-equiv.mjs` +
`scripts/btungsten/wb002-wasm-receipt.json`, three consecutive
fresh-chain runs 2026-10-07, all identical:

- corpus steps 46, verdicts matched 46, class mismatches 0, state
  mismatches 0, final full-state projections byte-identical.
- comparison per step: accept/refuse class AND the complete table
  projection (sassets incl. container trees, snttassets, offers,
  nttoffers, offerfs, delegates, stat, accounts) after EVERY step,
  with ONE shared clock (the model's now is synced from the chain's
  head block time before each step).
- **14 refused steps proven atomic ON CHAIN** — the whole table
  projection is unchanged across every refused push, including the
  partial-batch counterexample (a valid asset followed by a missing
  one: the chain refuses and moves nothing) — the R-1 class now
  verified against Antelope's own rollback boundary, not only the
  model's.
- **F-1 LIVE**: with `authorctrl=true`, the issuer's signature ALONE
  moved a holder's balance (`transferf`) and burned one (`burnf`) —
  ACCEPTED by the real contract. The port's most consequential
  conviction is upstream behavior, not a modeling artifact.
- **F-3 LIVE**: `attach` by the owner is refused (composition is
  author-gated upstream); attach/detach by the author accepted.
- the corpus also covers: offer→claim consent (wrong offeree
  refused), wrong-signer and receiver-only transfers refused,
  mdata author-only updates, delegated-asset routing refused,
  borrower early return accepted, redelegation (sovereign never
  moves), UNDELEGATE before/after real chain-time expiry, NTT
  lifecycle, changeauthor by author alone accepted / by owner
  refused, and burn-with-container refused.

**BOUNDARY NOT CROSSED** corpus-sampled evidence under the
result-class law — NOT a proof for all inputs, NOT an EQUIVALENCE-class
proof claim; a LOCAL single-producer dev chain only (no testnet/
mainnet claim); Spring 1.2.2 specifically (no version-generality
claim); the receipt's row messages scrub 48+ hex tx ids (the marker
law has no same-line carrier in JSON; full ids appeared in run
output only).

## What running a 2021 artifact on the 2026 client actually took

- The wasm deploys UNMODIFIED once its OWN documented deployment
  link is applied: `cleos set account permission simpleasset1 active
  --add-code`. Upstream's `sendEvent` sends DEFERRED transactions
  acting as the contract account (SA.cpp:1187), and every Antelope
  since eosio.code requires that link. Without it the first
  deferred event dies with `subjective_block_production_exception:
  Authorization failure with sent deferred transaction …` — a real
  deployment configuration, not an artifact change. (Naming this
  precisely matters: the artifact runs on the current client; it is
  the DEPLOYMENT that carries the one-flag migration cost.)
- Spring's keosd serves the wallet API on its unix socket only
  (HTTP wallet endpoints 404); cleos speaks `unix://` wallet URLs;
  a freshly created wallet is born unlocked (with
  `--unlock-timeout`), which removes the unlock dance entirely.
- WSL's timer accuracy is poor (nodeos warns at startup); the 499ms
  default subjective deadline killed heavier 2021-contract calls
  nondeterministically — `--max-transaction-time=10000` fixes it.
- A failed `get table` must NEVER read as an empty table: the
  harness throws on read failures instead (an early draft silently
  projected `[]` during a nodeos hiccup — a false-mismatch factory).
- Id spaces: `lnftid` asset ids match naturally (both sides run the
  same genesis counters; only `create*` consumes them). `offerfs.id`
  diverges — upstream allocates offer ids from the same counter as
  deferred-event ids, which the model deliberately does not port
  (EXCLUDED SURFACE) — the harness renames the model's offer key to
  the chain's and NAMES that reconciliation in its header; the
  projection excludes that internal id.
- Sibling isolation held: a sibling lane's chain owns :8888 and the
  shared keosd; this beat ran its own nodeos (:8889, own p2p :9877,
  own data/config) and its own keosd (own socket + wallet dir), and
  kills only processes it started (exact-name + own-port match).

## Reproduction

`MSYS_NO_PATHCONV=1 wsl -d Ubuntu -e bash -lc "cd
/mnt/c/Users/travi/wt-zcode && node scripts/btungsten/wb002-wasm-equiv.mjs"`
(assumes antelope-spring + node in WSL; boots a fresh chain, deploys
the vendored artifact, runs the corpus, writes the receipt, exits
nonzero on any mismatch). The harness filename deliberately does not
match the CI `*.test.mjs` glob — it needs the Spring stack; the CI
runner leg is a named follow-up.

## NEXT OWNER

- CI green on this PR → this seat merges (no-stall law).
- Live testnet leg (README §next 4): same corpus against a deployed
  contract on Jungle4/Vaulta — needs account resources (founder
  gesture class), so it stays named, not started.
- CI runner leg (README §next 5) and the shared Cryptol/SAW
  container beat (WB001 §next 1 / WB002 §next 2).

HUMAN INTERACTION: NONE.
