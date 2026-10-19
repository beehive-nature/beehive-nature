# 2026-10-06 — vaulta/zk: the kind-selector repair, the asymmetric regression, and the two-tier ceremony

Seat: zCode (worktree `wt-zcode`, branch `zcode/vaulta-zk-2026-10-06`,
parent `31ec63316`). This dispatch answers the founder ruling of
2026-10-06 (retain PLONK/BN254; close the M3 next-step as superseded;
repair the aggregate kind-selector; prepare a verified multi-party setup;
keep the promotion claim narrow). A CONCURRENT session of this seat
worked the same ruling in the same worktree (the review reconciliation:
enforcing runners, the zkrcount v1.1 resource bound, the zkrtst111111
pass — receipted in the count-v1 dispatch addendum); the division of
labor is stated in §8. Everything below is receipt-first:
CLAIM → EVIDENCE → BOUNDARY NOT CROSSED.

## §1 — the defect, confirmed at source before any edit

- CLAIM: the v1 selector counted the OPPOSITE baseline.
- EVIDENCE: `contracts/zkreceipts/count.circom` (at `31ec63316`), lines
  143–147: `component selDead = IsEqual(); selDead.in[0] <== kind;
  selDead.in[1] <== 0;` then `picked <== f6.dOut[0] + selDead.out *
  (f6.lOut[0] - f6.dOut[0]);`. `IsEqual().out` is 1 when equal, so at
  kind=0 (the documented dead-baseline claim, header lines 17–20 and the
  README) `picked` equals `f6.lOut[0]` — the LIVE count — and at kind=1
  the dead count. The ruling's arithmetic table (20 dead-kept / 19
  live-kept → selector returns 19/20) is confirmed by reading; the
  cohort's real 20/20 symmetry is why both deployed examples verified
  with the labels swapped.
- BOUNDARY: this session confirmed the inversion by source review and by
  the post-fix refusal receipts below; we did NOT re-execute the pre-fix
  circuit (the ruling's own local reproduction + the concurrent review
  session's re-derivation stand as the pre-fix evidence).

## §2 — the fix (one line, one component removed)

`picked = dOut + kind·(lOut − dOut)` — with `kind·(kind−1) === 0` already
constraining K binary, K selects its OWN baseline's counter directly.
The `selDead` component is deleted. Constraint count 101,278 → 101,275
(the removed IsEqual's 3 constraints). Circuit hash (snarkjs, from the
setup step): `25597a57…0446a3ba`.

## §3 — the asymmetric fixture (`fixtures/asym-cohort.json`)

Derived deterministically from
`docs/receipts/ant-reach-cohort-2026-10-06.json`: flip member
`1fb8e4fcd463b41a` (opened-baseline) settled verdict #2 to dead.
Self-audited with zkrprep's own cross-check battery before use:
deadKept **20**, liveKept **19**, settled sums 43/50 unchanged, flips 1.
Witness root `0x1f31dc72ea8886bf…55f65b1c4` (full value in the lab's
`~/plonkport/asym/expected.json`).
Labeled: TEST FIXTURE — synthetic, never the measured cohort; it exists
so kind labels are distinguishable.

## §4 — the regression ladder (prove_count.sh step [9b], receipts)

- correct claims: kind=0/count=20 and kind=1/count=19 both build
  witnesses, prove, and verify off-chain (`ASYM-DEAD-20-OK`,
  `ASYM-LIVE-19-OK`);
- REVERSED counts (the exact claims the pre-fix selector verified):
  kind=0/count=19 and kind=1/count=20 are **refused at witness
  generation** — `Error: Assert Failed. Error in template CountTree_81
  line: 151` (the `picked === count` constraint; no satisfying witness
  exists) — and the pipeline HARD-FAILS if either probe passes;
- tampered publics on a real asym proof (kind flipped, count +1):
  `plonk verify` → Invalid Proof, both rejected;
- the cohort's own 20/20 claims still prove and verify (they must — the
  real claims are symmetric), and the standing forgery set
  (eval_zw+1 / mutated count / mutated root / mutated kind) all still
  reject.
- HONEST BUG CAUGHT BY THE LADDER ITSELF: the first version of the
  inversion probe passed the words `dead`/`live` as the kind value, so
  the witness generator died at input parsing (`Cannot convert dead to
  a BigInt`) — a FALSE GREEN that proved nothing about the selector.
  Found by reading the probe's captured stderr; fixed to numeric kinds
  and re-run; the receipts above are from the corrected probes. The
  probe error text is captured to `probe_err_*.log` for exactly this
  reason.

## §5 — artifacts regenerated TOGETHER (the no-mixed-vk law)

One pipeline pass, no pairing of a corrected circuit with an old
verifying key: r1cs → plonk setup → zkey → `count_vk.json` →
`gen_vk_count_cpp.js` → `vk_count_constants.hpp` → cdt-cpp 4.1.1 →
`zkrcount.wasm`/`.abi` → witnesses → proofs → calldata. Both on-chain
passes below deploy builds whose sha256 equals the on-chain code hash.

## §6 — the ceremony, split into tiers (the ruling's correction accepted)

- **Rehearsal tier:** `pot17_final.ptau` (one honest seat, this lab) —
  rehearsal-labeled, unchanged, still the pipeline default.
- **Release tier:** Hermez `powersOfTau28_hez_final_17.ptau` — the
  public multi-contributor BN254 transcript (54 contributions + beacon,
  perpetual-powersoftau lineage), power 17 = 128k constraints ≥ our
  116,537 PLONK constraints. Verified before use:
  1. **blake2b-512** matches the iden3/snarkjs README ceremony table
     byte-for-byte (`6247a343…b49345`). (Receipt note: that table's
     digests are BLAKE2b-512, not sha512 — the mismatch that taught us
     this is itself the receipt for "verify, don't trust filenames".)
  2. hermez S3 original and circom.info mirror are **byte-identical**
     (`cmp` clean; sha256 `6b662a32…83ae0` both) — two independent
     download locations.
  3. `snarkjs powersoftau verify hez17.ptau` — **RUNNING at commit
     time** (single-threaded, 99% CPU, PID 155167, >52 min elapsed;
     54 contributions × pairing checks over the 151,078,040-byte
     transcript). HONEST CORRECTION of the concurrent session's
     addendum wording ("transcript re-verified"): the only verify
     process on this box is this one and it had NOT completed when that
     was written. The completed checks are (1) and (2); the verify's
     final verdict lands in the follow-up addendum. If it reports ANY
     failed contribution, the release tier is void and reverts to
     rehearsal-only.
- The release zkey/vk/constants/proofs are derived with `PTAU=hez17.ptau`
  (the pipeline knob added in this commit) — the artifacts both chain
  passes below verified against.
- BOUNDARY (the ruling's words kept): multiple agents on one shared host
  are NOT independent trust domains; a fresh BNR ceremony needs human
  participants on separate machines — the witnessed-sealing KIT remains
  a named future lane. Nothing here authorizes mainnet deposits; Vaulta
  mainnet stays out of scope until a witnessed ceremony ruling.

## §7 — on-chain acceptance (corrected build, release-class artifacts)

Build identity: contract sha256 / on-chain code hash
`7a86ac34ddf15489…84af6f40d` (full 64-hex in the run logs; same bytes
on both chains — the count-v1 identity pattern, now for the corrected
vk). <!-- PUBLIC-CONSTANT: jungle4+rehearsal code hash, truncated -->

**Rehearsal chain** (Spring v1.2.2, CRYPTO_PRIMITIVES, account
`zkrcount12`, runner zkrrun.sh):
- pre-init anchor REFUSED "law not initialized"; `init(64)` executed
  (the concurrent session's v1.1 bound, exercised here);
- anchor 1 (R,0,20) + REAL dead proof → EXECUTED; anchor 2 (R,1,20) +
  REAL live proof → EXECUTED;
- forged (eval_zw+1) / mutated count / mutated root / mutated kind →
  ALL REFUSED "count proof REJECTED — plonk pairing false"; re-verify →
  REFUSED "anchor already verified"; bad kind at anchor → REFUSED
  "kind must be 0 or 1";
- **ASYM (the selector law on-chain): anchor 8 (fRoot,0,20) + asym dead
  proof EXECUTED; anchor 9 (fRoot,1,19) + asym live proof EXECUTED;
  REVERSED claims anchored (permissionless — anchors 10 (0,19) and 11
  (1,20) accept) and their verifies REFUSED by the pairing;**
- anchors table: seq 1/2/8/9 verified_at set; 3–6/10/11 at 0;
- billing probe (find2.sh) returned NOT FOUND for these txs — billing
  NOT captured on the rehearsal pass, labeled; the jungle4 pass below
  carries the billed µs.

**Vaulta public testnet (jungle4)** — sponsored pass (spladder recipe,
account `zkrtst222222` redeployed over the count-v1 deploy — RAM is
~0.21 EOS/KB and a fresh 510 KB contract exceeds the sponsor's balance;
redeploy costs ~zero RAM delta; old rows preserved below seq 100, new
pass at seqs 101–111, `init(18)` over the 6 existing rows):
- deploy gate (sharpened): on-chain code hash == built wasm sha256;
- canonical verifies billed **11,590 / 9,969 µs** (real PLONK bills —
  contrast the phantom below);
- asym verifies billed **11,515 µs (dead=20) / 10,660 µs (live=19)**;
- forged / mutated count / mutated root / mutated kind / re-verify /
  bad-kind: ALL REFUSED; reversed-count verifies at seqs 110/111
  REFUSED;
- anchors 101/102 verified_at set; 103–106/110/111 at 0.

**The phantom pass, kept as the law's receipt:** the first jungle4
attempt (fresh `zkrtst444444`) bought no RAM (sponsor overdrawn for
1 MB: "overdrawn balance" → setcode REFUSED "Account using more than
allotted RAM") and then EVERY action "executed" at ~300 µs with code
hash all-zeros — codeless no-ops masquerading as a green pass. The old
gate tested only that the hash was non-empty; an all-ZERO string is
non-empty. Both runners now assert on-chain code hash == the built
wasm's sha256 (the concurrent session sharpened this same law
independently — their deploy-gate comment and this failure are the
same lesson from two directions).

**The concurrent session's pass** (`zkrtst111111`, enforcing runner):
canonical 101/102 and asym 201/202 verified under the same build
(verified_at in the table); its re-run FATALed on a cap-readback bug
(the helper read the anchors table for a law-row field — fixed here
with `law_field`), and that account's exhaustion leg remains to be
exercised on a fresh budget; not a contract defect.

## §8 — two sessions, one worktree (the reconciliation)

The ruling landed on the seat while a review session was already
working `31ec63316`. Division of labor, honestly: THIS session —
selector fix + asym fixture + pipeline regeneration + hez17 ceremony
verification + rehearsal & zkrtst222222 passes + spec bookkeeping +
this dispatch. THE CONCURRENT SESSION — the count-v1 review
reconciliation addendum, the enforcing zkrself-run/recheck v2 runners,
the zkrcount v1.1 bounded-anchor law row, and the zkrtst111111 pass.
Each session consumed the other's in-flight artifacts (their runner
runs my asym calldata; my runners call their init; their dispatch
addendum receipts my selector fix). One co-edited bug is receipted in
§7 (the cap readback). Their addendum's ceremony wording ("re-verified")
is corrected in §6 above.

## §9 — spec bookkeeping

- `docs/specs/SPEC-PRIVACY-1.md`: the §m3 "named next step of the ruled
  fork" paragraph now carries a SUPERSEDED block pointing at §m4
  (executed 2026-09-04, ruled closed 2026-10-06). The PLONK/BN254 engine
  is closed; reopen only on a specific defect or measured reason.
- `docs/specs/SPEC-ZK-RECEIPT-AGGREGATES-1.md`: §sequence step 5 records
  this repair; the remainder is unchanged (tungsten 2 + 4, sealing kit).

## §10 — kept narrow (the ruling's guardrails, restated as lane law)

- The aggregate lane's proof is COUNT-ONLY. The receipt's 43/50 settled
  totals are sums for the SECOND circuit; measurement origin and
  vantage independence remain outside the proof.
- Replacing the setup does not make the payment/privacy system
  production-complete: M10's bond escrow and payouts are rehearsal
  counters without token rails — an implementation boundary separate
  from any ceremony assumption.
- No funds moved; no mainnet deposits; delegated engineering authority
  only.

---

## §addendum-1 — the fresh-account enforcing pass COMPLETES (2026-10-07, founder-funded zkrtst444444)

The founder paid the phantom-pass account (`zkrtst444444`: 100 EOS
liquid + large delegated CPU/NET). That unlocked the one leg no prior
account had budget room for. Receipts:

- **RAM:** self-bought 460,000 B (tx `bc9a1cf9…` TESTNET-ONLY) — RAM
  at ~0.21 EOS/KB is why a fresh 510 KB contract deploy exceeds the
  spladder sponsor's balance; the funded account buys its own.
- **The enforcing runner (zkrself-run.sh v2, epoch-based rerun-safe
  seqs) ran 21/28 green in-process**: deploy gate (code hash == built
  wasm sha256), `init(10)` over a zero-row account, canonical verifies
  with `verified_at` table transitions, **the EXHAUSTION regression —
  10 rows to cap, then "anchor beyond cap — budget exhausted — REFUSED:
  anchor table FULL (bounded resource budget)"** — plus the bad-kind
  and one-proof-per-anchor refusals and final table state.
- **Two read-races, both caught by the gates, both receipted:** (1) the
  first deploy-gate read hit a stale greymass node still showing the
  pre-deploy zero hash after an EXECUTED setcode — the gate FATALed
  healthy evidence; a re-read 4 s later matched. (2) the reconcile
  helper's rapid get-table burst was rate-limited to null bodies —
  seven refusal legs went INCONCLUSIVE (never false-green) before
  their verify pushes ran. **(2) is CORRECTED in §addendum-2: the
  nulls were a LOCAL stdin race in the parser, not provider
  throttling; the provider-level diagnosis is withdrawn as
  unestablished.**
- **The seven short-circuited legs were completed manually** with the
  same exact-message assertions, 3 s spacing: forged (eval_zw+1) /
  mutated count / mutated root / mutated kind / re-verify /
  **REVERSED (0,19)** / **REVERSED (1,20)** — ALL refused with the
  contract's own messages.
- **Runner hardened (code-enforced — the read-race class hit twice):**
  the deploy-gate hash read now retries bounded (4 × 4 s) before it may
  FATAL; reconcile widened to 8 attempts × 6 s. Both edits sit beside
  the sibling session's epoch-based seq fix (their comment receipts the
  crashed-run collision the time-based seqs cure). **(The widening was
  NOT the cure — §addendum-2 repairs the parser itself.)**
- The Hermez transcript verify was STILL RUNNING at this addendum
  (>1 h single-threaded CPU); its verdict remains the open receipt.

### Closeout wording for the fresh-account record (per review order)

> **Fresh-account acceptance: 28 legs reported complete across the
> initial automated run and a separately recorded seven-leg follow-up.
> Automated runner: reconciliation repair outstanding.**

The two parts are bound to one another by: chain jungle4 · account
`zkrtst444444` · deployed code hash `7a86ac34ddf15489…84af6f40d`
(== built wasm sha256, the hez17-derived vk constants) · the prove
artifact set of addendum §5 (canonical root `0x2e6bc682…`, asym
fixture root `0x1f31dc72…`) · anchor seqs 1791354701–706 and
1791354801–804 (the automated run's anchors; the seven-leg follow-up
verified against those same rows). The initial INCONCLUSIVE results
stand preserved above, not replaced by a single green summary.

---

## §addendum-2 — the reconciliation failures were a LOCAL parser race; the harness repair (review 2026-10-07, second order)

**The reviewer's finding, confirmed against our own receipts.** Both
reconciliation helpers parsed with `JSON.parse(process.stdin.read())` —
`read()` returns null when nothing is buffered yet, a STREAM STATE, not
a property of the HTTP response. The reviewer reproduced the exact
failure on a complete valid fixture with no network involved (Node
22.16.0; ours is 22.22.1). The smoking gun was already in our run log:
only `reconcile()` used the synchronous `read()` form, while
`row_field`/`count_rows` used the event-accumulation form — and in the
same run, against the same endpoint, the event-form reads PASSED while
every `reconcile()` call failed with `Cannot read properties of null
(reading 'rows')`. **The addendum-1 sentence attributing the nulls to
greymass rate-limiting is WITHDRAWN as unestablished.** Provider-level
throttling may or may not have occurred; the null parse value alone is
not evidence of it, and the local race fully explains the seven
INCONCLUSIVE legs. (The deploy-gate zero-hash observation — a bash-level
read showing a genuinely different VALUE, not a parse null — remains a
read-your-writes race, consistent-with, cause plausible.)

**The repair (fixture-tested BEFORE any chain use, per the order):**

- `reconcile_row.mjs` — the ONE shared parser: `readFileSync(0, 'utf8')`
  blocks until stdin EOF, so the race is structurally eliminated, not
  retried away. Failure classes are NAMED and exit-coded: 2 malformed ·
  3 transport-empty · 4 row-missing · 5 field-mismatch (diagnostics to
  stderr).
- `zkrself-parse-test.sh` + `fixtures/parse/` — local fixtures, no
  network/wallet/chain/RAM: valid · truncated-JSON · zero-byte ·
  seq-absent · count-mismatch, plus the here-string delivery path (the
  exact incident mechanism) ×5. **RESULT: 10 passed, 0 failed.**
- `zkrself-run.sh` + `zkrself-recheck.sh` rewired through the shared
  parser; the reads now use the DECLARED second endpoint (`RCLEOS` —
  the wiring gap the review flagged is closed: the claim and the code
  agree); the in-code "write endpoint throttles read bursts" comment is
  corrected to the unverified status.
- The final table section is now ASSERTED, not printed
  (`final_table_assert.mjs`): the four intended-valid claims (canonical
  AND asym positives — the gap the review named) must carry exact
  fields and nonzero `verified_at`; the six rejected claims must match
  their anchored (tampered where applicable) fields and remain
  unverified AT THE OBSERVATION; total rows must equal the cap for the
  exhaustion fixture; any parse failure FAILS the run. Exit-coded:
  4 missing · 5 mismatch · 6 verified_at wrong for the class ·
  7 row-count ≠ cap.

**The recorded rows reconciled read-only (no RAM, per the order):**
the repaired `final_table_assert.mjs` over the saturated
`zkrtst444444` table — seqs 1791354701–706 / 1791354801–804, spec
matching every anchored claim including the tampered values —
**ASSERT-EXIT=0**: four positives verified (canonical 20/20 + asym
20/19), six rejected claims exact and unverified at the observation,
10 rows == cap 10. The account is preserved as the exhaustion fixture.

**The closeout line, updated post-repair:** fresh-account acceptance
remains 28 legs reported complete across the initial automated run and
the separately recorded seven-leg follow-up (binding above); the
automated runner's reconciliation repair has now LANDED and is
fixture-proven, so the outstanding clause is retired for future runs —
the historical 21+7 split stands as recorded.

**The transcript — the verify COMPLETED (2026-10-07, ~01:15 lab
time):** `snarkjs powersoftau verify hez17.ptau` ran UNRESTARTED to
completion — **final line "Powers of Tau Ok!", process exit 0**, wall
time ≈ 1 h 45 m single-threaded (the process was never restarted for a
status update, per the order). Tool: snarkjs 0.7.6 (node 22.22.1).
Transcript digests: blake2b-512 `6247a343…b49345` (the iden3/snarkjs
README published-table match) · sha256 `6b662a32…83ae0`. With checks
(1) hash-pin, (2) dual-source byte-identity, and (3) the completed
transcript verification all green, the release-tier verification
status reads PASSED for the downloaded artifact. Lane gates unchanged:
the leak distinguisher and the 1k/10k scale measurements remain OPEN —
"only one receipt remains" describes the selector-repair dispatch,
never the lane or its coupling readiness (the Autonomi coupling ban
stands).

---

## §addendum-3 — review order 3: the two remaining harness items closed, offline-proven (2026-10-07)

The reviewer's dispatch closed the stdin-race, read-endpoint and
pending-transcript findings at `112f1c011` (banked above; the completed
transcript receipt keeps its scope: verification of the DOWNLOADED
setup artifact, never "the ZK lane is done"). Two items stayed open;
both are now closed, offline-first:

**1 · the finalizer.** The committed blob (`834a28f4…`) was indeed the
unrepaired v2 — the working tree meanwhile held the concurrent seat's
uncommitted v3, which this session AUDITED line-by-line rather than
trusting its header, then proved by STUB REPLAY
(`zkrself-final-offline-test.sh` — a fixture-backed fake cleos drives
the entire finalizer with no network, chain or RAM):

- the v2 defect (failure counters mutated inside `$(...)`, legs
  skippable while the run exits 0) is closed by construction —
  discovery NEVER records; the caller owns every counter, and the
  required-leg ledger turns a never-ran leg into a failure;
- **case happy: 9/9 legs PASS, exit 0; case missing-row: the absent
  claim's leg FAILS and the run exits 1 (absence is a failure — the
  exact v2 counter-example, now red); case wrong-build: a merely
  non-empty wrong code hash FAILS identity, exit 1.**

**2 · strict timestamp validation.** The reviewer's four mutations
(rejected row missing `verified_at`; rejected row `null`; positive row
`"not-a-timestamp"`; positive row `-1`) all passed the helper's
truthiness/`Number()` predicates — confirmed, reproduced, fixed:
`final_table_assert.mjs` now requires the field to be PRESENT and a
VALID uint32 ABI timestamp (numeric, integral, 0…2³²−1) BEFORE the
positive-vs-zero assertion; missing/null/nonnumeric/negative all exit 6
as state-not-established, positive claims require exactly > 0 and
rejected claims exactly 0. All four mutations are committed fixtures
(`fixtures/final/`) in the standing offline suite —
**zkrself-parse-test.sh now 15/15** (five response classes, five
here-string deliveries, valid table, four timestamp mutations).

The recorded read-only reconciliation of §addendum-2 is unaffected
(the observed rows carried proper numeric timestamps); what changed is
that the helper no longer accepts responses that do not establish the
state it claims to establish. The finalizer's final leg rides the same
helper, so the tightening covers both entry points.

Scope unchanged: selector and anchor-budget repairs stay closed; leak
and scale stay open; no circuit rebuild, ceremony rerun, account
funding or Autonomi coupling. `final-find.mjs` (selection-only, feeds
the strict gate downstream) keeps its event-accumulation read — noted
here so a future review knows it was looked at, not missed.
