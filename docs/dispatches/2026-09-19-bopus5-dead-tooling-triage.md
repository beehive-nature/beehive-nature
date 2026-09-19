# 2026-09-19 · bOPus5 · dead-tooling triage (Slice O3)

**Order.** LoVis bee-laborer cut Set O (Buzz event `06dba752`, 2026-09-19 13:40Z) from
bFaBLe5.1's refill map (`5d5dc448`). O3 is output only: one ledger, **no deletion in
this slice**. `wallet-*` and `purse-*` are payment surfaces and stay triage-only forever;
their verdicts below are recorded, never actioned. Deletions, if any, come later as
one-file cuts on the Slice B precedent, after the ledger is read.

**Base.** `d7b9b2c6` (main after #138). Every measurement below was taken at that commit.

## Method

1. **Zero-reference census, reproduced.** For each of the 27 files, `git grep -l -F
   "<basename>.mjs"` (scripts: the full file name) over the whole tree, excluding the
   file itself → **0 hits for all 27**. A word-bounded search for the bare stem adds only
   non-references: `doors` (a directory name) and `report-lint` (its own fixture,
   `e2e/report-lint.fixture.md`).
2. **Aliases.** Each tool's distinctive name or headline was searched across `docs/`.
   Three hits, each read:
   - `wallet-vault`: `docs/dispatches/2026-09-13-zcode-dead-host-inventory.md:74` names
     "`wallet-vault/matrix/fund`" as the battery to re-run after wallet-adapter changes.
     That is a live procedural reference.
   - `ceb9`: `docs/receipts/deployments.json:63` records `0xceb9d288…` as NTNT. That is
     the answer to the probe's own question 2, landed as a receipt.
   - `purse-name`: `docs/museum/CANON-2026-08-28.md:31` is prose ("her purse-name"), not
     the tool.
3. **Provenance.** First and last commit per file (`git log --diff-filter=A`, `git log
   -1`). Every file was authored under the founder account. The seat is identified by
   the commit subject, not the author.
4. **Does it still run?** Local-only tools were run at base from a `git archive`
   scratch copy, 180 s timeout each. Tools that reach public RPC, Blockscout or the live
   `skaists.dev` were **not run**; they are marked "network, not run". The
   `push-preflight.sh` selftest needs a real repo, so it was run under WSL from the base
   blob inside the main checkout.

## The ledger

Verdict key:
- **KEEP**: a gate, rig or seat tool with a present job.
- **DELETE-CANDIDATE**: a self-declared one-off whose question was answered and whose
  answer landed.
- **TRIAGE-ONLY**: payment family; the verdict is informational, and it is never deleted
  from this ledger.
- **FALSE SIGNAL**: the tool asserts or builds from a premise that a later commit
  disproved, so a green run from it is not evidence. See the erratum below.

### Gates and rigs that still pass, not wired into CI

| file | first → last | what it measures | run at base | verdict |
|---|---|---|---|---|
| `e2e/intake-daybucket.mjs` | `2d30ed3e` → `c88174a5` 08-24, 6 commits | ORDER zB: the intake day-bucket keys on LOCAL date, never UTC, and the export carries its timezone | `21 passed, 0 failed`, exit 0 | **KEEP** |
| `e2e/comb-shot.mjs` | `083101c0` 09-01 | THE COMB lane receipt: all three cell states visible at 390, proven by the renderer's census and by pixel buckets | exit 0; `PASS nectar translucent pixels on canvas — 13614`, `PASS zero page errors`. It writes `e2e/shots-comb/*.png` | **KEEP** (re-runnable receipt) |
| `scripts/report-lint.mjs` | `2bcfe078` 08-24 | a gate on seat REPORTS: every assertion carries raw output or UNVERIFIED | `--selftest` PASS (classification and mutation), exit 0 | **KEEP** |
| `scripts/push-preflight.sh` | `b842bb27` → `ade15d90` 08-24, 5 commits | a seat's safety checks on its own delta before pushing its own lane | `--selftest` under WSL in a real repo: P1–P4 correct, `selftest ok`, exit 0 | **KEEP** |
| `scripts/lane-prepush.sh` | `caddcab4` → `20d01e4e` 08-24, 5 commits | the four-check lane protocol, subject asserted first (zC finding, founder ruling 08-24) | not run: it needs a lane subject | **KEEP** (seat protocol) |

### Gate that has drifted

| file | first → last | what it measures | run at base | verdict |
|---|---|---|---|---|
| `e2e/doors.mjs` | `542d986e` → `399e2e5f` 08-26, 3 commits | founder order 08-26: THE SIX FRONT DOORS at 390; tap floor, footer room, zero page errors, every listed link 200 with body text | `45 passed, 5 failed`, exit 1 | **KEEP, stale** |

What the 5 failures are:
- The gate pins `files.length === 7` (six doors plus index). `surfaces/doors/` now holds
  9, because `beehivenature-buzz.html` and `skaists-buzz.html` were added in `be2ac575`
  (08-31), after the gate.
- The other 4 failures are those two new doors, 2 checks each: headline/one-thing, and
  one 404. Both 404s are the same request, `GET /api/join-policy`, fetched by the relay
  doors' status script from the same origin. They are harness artifacts: the endpoint
  answers `200 {}` on both live hosts (measured 2026-09-19 in slice O4).
- The link checks, the tap floor and the six original doors all pass.

This is drift for the doors owner to classify, not a defect finding.

### Payment family (triage-only forever)

| file | first → last | what it measures | run at base | verdict |
|---|---|---|---|---|
| `e2e/wallet-vault.mjs` | `9cac25ad` 08-23 | THE VAULT in real Chromium with a CTAP2 virtual authenticator (PRF): one keypass, multi-slot, revocable | `35 passed, 0 failed`, exit 0 | **TRIAGE-ONLY · KEEP** (named by the 09-13 dead-host dispatch as a re-run battery) |
| `e2e/wallet-arweave.mjs` | `fe756aa0` 08-24 | the Arweave adapter and publish path: pinned serialization vectors, gateway rotation, vault custody roundtrip, mocked-gateway publish | `22 passed, 0 failed`, exit 0 | **TRIAGE-ONLY · KEEP** |
| `e2e/purse-live-check.mjs` | `47894c90` 08-26 | "one-off: click the live exhibit button on skaists.dev … Untracked; a look, not a lane" | network, not run | **TRIAGE-ONLY** (on the merits it would be a DELETE-CANDIDATE) |
| `e2e/purse-name-now.mjs` | `bea6cdf9` 08-26 | "one-off: what does bqueenbee.base.eth resolve to RIGHT NOW" (receipt for the renewal re-point) | network, not run | **TRIAGE-ONLY** (on the merits it would be a DELETE-CANDIDATE) |

### Live-chain verification rigs (network, not run)

| file | first → last | what it measures | verdict |
|---|---|---|---|
| `e2e/art-tuple-verify.mjs` | `bea6cdf9` 08-26 | the tuple-ABI fix: the ART renders (wall labels, not chips) for garden, purse and museum | **FALSE SIGNAL → DELETE-CANDIDATE** (erratum: its premise, "sel + 0x20 + (seed, extra) everywhere", was disproved by `7e530f28`; its checks match labels and count pieces or SVG nodes, so they cannot see which level was drawn) |
| `e2e/inscription-fidelity-verify.mjs` | `45d28687` 08-27 | walls render the contracts' own SVG answers byte-for-byte against `window.__rawPieces` | **FALSE SIGNAL → repair in Z6** (erratum: it builds its own oracle call as `sel + w(0x20) + …` at `:47` and `:59`, the calldata `7e530f28` disproved) |
| `e2e/scan-clean-verify.mjs` | `c86c3419` → `47894c90` 08-26 | lane zB-scan-clean: gallery default wing, the Purse as a named exhibit, the profile law | **KEEP** (regression rig for live rendering; it cannot be a CI gate while it needs Base RPC) |
| `e2e/midi-swap-verify.mjs` | `696551a6` 08-27 | the swap popup with a fake EIP-1193 wallet: no auto-connect, chain guard, live QuoterV2 quote, calldata word by word | **KEEP**; payment-adjacent (it builds a trade), so treat as triage-only |
| `e2e/qrroses-odd.mjs` | `9f3e4aa9` 08-29 | THE ODD-COUNT GATE (founder ruling): 300 seeds, no even stems, leaves, petal layers or bees; blooms outside the quiet zone | **KEEP**; note that it targets live `skaists.dev`, not the repo copy |

### Census and inventory tools

| file | first → last | what it measures | verdict |
|---|---|---|---|
| `e2e/mobile-comprehension.mjs` | `5dfa697f` 09-16 | the phone-readability census (founder order 09-16): walls of prose, per surface, bee at 390 | **KEEP** (the newest file here; not run, long walk) |
| `e2e/unkeyed-inventory.mjs` | `008d86f7` 09-12 | the full unkeyed-string inventory feeding the corpus keylist | **KEEP** (live input to keyed-prose work) |
| `e2e/huddle-local.mjs` | `826dd031` 08-21 | THE LIVEKIT LOCAL-VENUE RECEIPT: two contexts converge over a real livekit-server; its header says "not a standing gate … run manually" | **KEEP** (manual receipt; not run, needs the venue) |

### Self-declared one-offs whose answer landed

| file | first → last | the question it asked | where the answer lives | verdict |
|---|---|---|---|---|
| `e2e/art-abi-probe.mjs` | `bea6cdf9` 08-26 | why FROGGI/PEPI don't render: inline versus tuple ABI | the tuple fix, same commit | **DELETE-CANDIDATE** |
| `e2e/pepi-froggi-truth.mjs` | `bea6cdf9` 08-26 | FROGGI and PEPI ground truth (balances, holders) | same commit | **DELETE-CANDIDATE** |
| `e2e/ceb9-probe.mjs` | `45d28687` 08-27 | FUNGI seed on self-send; is `0xCeb9…` an ERC-20i | `docs/receipts/deployments.json:63` (NTNT) | **DELETE-CANDIDATE** |
| `e2e/inscription-fidelity-probe.mjs` | `45d28687` 08-27 | why our explorer ≠ inscriptions.app (three suspects) | superseded by `inscription-fidelity-verify.mjs`, same commit | **DELETE-CANDIDATE** |
| `e2e/midi-b-facts.mjs` | `497d820d` 08-27 | MiDi B: owner renounced, LP real, burned | the bMiDi residency commit | **DELETE-CANDIDATE** |
| `e2e/midi-pool-debug.mjs` | `497d820d` 08-27 | which pool the V3 factory returns for MiDi A/B | same commit | **DELETE-CANDIDATE** |
| `e2e/local-agent-diag.mjs` | `e6c6533f` 09-05 | "warm-phase diagnostic (scratch, not a gate)" | the receipt is `e2e/local-agent-shot.mjs` 12/12, same commit | **DELETE-CANDIDATE** |
| `e2e/dead-surface-sweep.mjs` | `249436f1` 08-25 | "one-shot dead/stub sweep (sprint 2026-08-24)" | `e2e/no-page-errors.mjs` covers this and is CI-wired (105 walked) | **DELETE-CANDIDATE**; at base it walked 95 pages, then never exited (timeout 124) |
| `e2e/shot-zb-visual.mjs` | `249436f1` 08-25 | "visual audit shots (sprint 2026-08-24, zB set)" | the sprint's commits | **DELETE-CANDIDATE**; at base it wrote 4 shots, then never exited (timeout 124) |

## Tally

- **KEEP: 14.** 5 still-passing gates or tools, 1 drifted gate, 2 wallet batteries (also
  triage-only), 3 live-chain rigs, 3 census or manual tools.
- **DELETE-CANDIDATE: 9.**
- **FALSE SIGNAL: 2** (the erratum rows; one goes to delete, one to repair).
- **TRIAGE-ONLY with a delete-class profile: 2** (`purse-*`). They are never cut here.
- Total: 27 = 24 `e2e/*.mjs` + 3 `scripts/*`.

## Erratum (2026-09-19, after PROVE of `f8d210f3`)

The first version of this ledger marked `art-tuple-verify.mjs` and
`inscription-fidelity-verify.mjs` **KEEP**. That rested on each file's own header,
and those headers are wrong. `7e530f28` (2026-08-28) checked each contract's
Sourcify-verified `Generator.sol` and found that `getSvg`/`getMeta` take one static
`SeedData` struct. A static struct has no leading offset word. The old calldata
prepended `0x20`, so the contract read the seed as the constant 32 and drew
lowest-tier art. bFaBLe5.1 raised the lead in Refill 5, and LoVis bee-laborer cut this
fix.

- `art-tuple-verify.mjs:4` states the disproven fix as its premise ("The fix: sel +
  0x20 + (seed, extra) everywhere"). Its passing checks (`:26`–`:99`; the
  other `check(` calls are the catch-side failures) match wall label text, count pieces,
  or count `svg` nodes. None of them reads which level was drawn.
  A lowest-tier piece passes all of them, so the rig cannot detect the defect
  `7e530f28` fixed. It moves to
  DELETE-CANDIDATE. Any level-true replacement is a separate cut.
- `inscription-fidelity-verify.mjs` builds its reference calls at `:47` and `:59` as
  `col.sel + w(0x20) + …`, so its byte-for-byte comparison is the broken call checked
  against the broken call. Its return decoder at `:31` checks the `0x20` offset word of
  the returned `string`, which is correct ABI for a dynamic return and is not part of
  this defect. The Z6 cut (ZcODe5.3max) owns the repair of `:47` and `:59`.
- Not changed here: `art-abi-probe.mjs` and `ceb9-probe.mjs` also build the old
  calldata. Both were already DELETE-CANDIDATE, and that verdict stands. The "where the
  answer lives" cell for `art-abi-probe.mjs` names the tuple fix of `bea6cdf9`. That fix
  was itself corrected by `7e530f28`.
- These tools were not run for this erratum. The finding comes from the source lines
  cited above and from `7e530f28`'s own message.

## What this does not claim

- The network tools were not run. Their verdicts rest on each file's own header and
  commit, not on a run at base.
- "Zero references" is scoped to `git grep` over this tree at `d7b9b2c6`. Seats' local
  workspaces, other branches and chat history were not searched. A seat may still run a
  tool by hand.
- KEEP does not mean "wire into CI". Wiring any of these is a separate cut with its own
  owner.
- The two `timeout 124` runs are recorded as observed (output complete, process never
  exited). No root cause was traced.
