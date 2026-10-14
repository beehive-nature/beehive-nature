# bDroP CI heal — #413/#415 lifecycle repair + #416 viewport repair (ZCode seat 1, 2026-10-13)

Lane: `zcode/bdrop-ci-heal-2026-10-13` (worktree `wt-zcode-bdrop-ci`), base `8f9633c30`
(origin/main at pickup). Ownership per the pickup order on #413: Agent 30 / bDroP,
one seat, PR #409/#411/#412 untouched.

## 1. The mechanism — PROVEN by reproduction, after two refuted theories (kept as the trail)

**Correction discipline:** the first repair commit (c961e272c) diagnosed *renderer
starvation*; the first CI run of PR #419 (38460056289) refuted it by printing the
record itself (`prepared · 1 events`); a storage-tear theory followed; a local rerun
then **reproduced the failure deterministically enough to pin the true cause**. The
final mechanism, proven:

**The 6b gate was vacuous.** The step's readiness predicate was
`/handoff/.test(#outbox.textContent)` — and the scenario's permlink is
`bdrop-keychain-closed-midhandoff`: **"handoff" is a substring of the permlink.**
The gate passed the instant the publish handler persisted the record at stage
`prepared` (its first write, before the pre-flight RPC even answered). The test then
closed the browser mid-**pre-flight**; the journal on disk held `prepared · 1 events`;
and a pre-gesture record is **skipped** by the boot reconcile *by design* — so the
restart could never confirm and **no wall-clock window, at any width, could ever turn
the step green.**

This single cause explains the entire record:

- The 20s starvations (main run 38322545384), the 45s starvations (PR #409 runs
  38351639383/38360498738) and the 75s era's first CI failure: the same skipped
  reconcile, lottery-set by whether the pre-flight RPC answered before the test's
  next statement ran (fast box: usually yes; loaded runner: often no).
- #415's observation that "the preceding *handoff state persisted* step passed":
  it passed vacuously — the permlink matched at `prepared`.
- Why the two widenings (e59d41913 20→45s, a4df32921 45→75s) never could help.
- Both `prepared · 1 events` failures of 2026-10-13: PR #419's first CI run, and a
  local rerun after the first repair added a stage-true precondition assertion —
  that assertion is what exposed the vacuous gate within two runs.

Instrumented context (throwaway in-page timeline, deleted before commit): on intact
storage the desk's restart work is sub-second — the reconcile RPC issues at
page-t+180ms, the confirmed render lands at t+292ms, before the `body[data-reg]`
gate resolves; under 12-core oversubscription the boot stretches ~3x and the
reconcile still settles before the gate. The desk was never slow; the step was
testing a state that could not reconcile.

## 2. The repair (no widening, no watcher, no rerun-until-green)

Test (`e2e/bdrop-eternal.test.mjs`):

- **The 6b gate now waits for the storage record itself at stage `handoff`**
  (`localStorage` predicate on the record's scope+stage) — the vacuous text match is
  gone, and a new assertion proves the journal holds the operation at handoff with
  no signed bytes before the browser dies.
- **The restart half seeds a fresh profile with the exact captured record** (the
  dying browser's own journal bytes, via the same storage API the desk trusts).
  Persistence-before-death is asserted on the 6b side; the restart-reconcile claim
  is what 6c proves — deterministically, with no cross-process storage-flush timing
  in the loop (the write→close window is milliseconds and localStorage commits
  lazily; a same-profile relaunch would re-expose that boundary).
- The settle wait stays **event-driven** (`timeout: 0`): the page's boot reconcile
  stamps `data-boot-settled` when its pass completes; a broken reconcile settles and
  the assertion names the record's own line. The eternal job's 12-min step cap is
  the outer backstop. The no-duplicate-broadcast invariant is asserted unchanged
  (broadcasts=2 across the whole keychain scenario).
- **Focused regression 6d**: a restart against a chain stalling every answer past
  the desk's read deadline (new `stallMs` mock control) — the boot pass settles with
  the unanswered read **named** on the record, broadcasts stay 0 through
  deadline/retry/abort, and the manual reconcile confirms once the endpoint answers.

Page (`surfaces/bdrop.js?v=10`) — the desk's own robustness, honest product behavior
independent of the test:

- Reconcile chain reads carry the desk's **own deadline** (10s → abort, named
  "the endpoint did not answer in 10s — read aborted"; reads only — an aborted read
  can broadcast nothing). The autonomous boot pass retries a stalled read once
  (1.5s backoff). Previously a stalled endpoint wedged the boot reconcile silent
  forever — a real-user gap this closes. Verified live by 6d.

## 3. The viewport regression (#416), measured not guessed

The footer-audit ratchet went `WIDE 0 → 1` for bdrop.html in all three registers
(417px against 390px) on main's own runs, first appearing with the v5→v9 lineage.
Reproduced with a faithful probe (mobile emulation, register preset, externals
blocked, CI-equivalent font metrics — Courier New ≈ DejaVu/Liberation 0.60em
advance vs local 0.55em):

- Offender: the **editions row's status line**. `eca905aba` (0001 LIVE) grew the
  status text by the 53-char posting public key; a flex item's min-width is its
  longest unbreakable run, and that key measures **381.7px** under CI fonts —
  identical overflow in bee/raver/cypherpunk (register-independent), page 415-417px.
- Fix: `#editions .row span.law{min-width:0;overflow-wrap:anywhere}` — the line
  breaks inside the run instead of widening the page. After: **390px in all three
  registers** under the same metrics; footer-audit vs the committed baseline:
  **0 worse · 0 better — baseline untouched.** CI confirmation: PR #419's first
  run printed `ratchet: 0 worse · 0 better` (the #416 half held on the runner).

## 4. Batteries (final head, after the vacuous-gate fix)

- `node --test e2e/bdrop-eternal.test.mjs` — **GREEN ×5**: three idle runs and two
  under 12-burner CPU contention (the contention axis is where the old lottery
  lived), all 13 scenarios + 6d, 114 checks each.
- `node --test e2e/bdrop-preserve.test.mjs` — GREEN (2/2).
- `node footer-audit.mjs --only bdrop.html --baseline footer-audit.baseline.json`
  — no findings, ratchet 0/0.
- PR #419 CI: first run (pre-gate-fix) went red on the 6c step and **printed the
  mechanism** (`prepared · 1 events` — the event-driven repair turning a silent
  timeout into diagnostic evidence); 6d and the footer ratchet were green on that
  same run. The gate fix pushed after; verdict on the final head recorded in the
  PR and on #413.

## 5. Boundaries named honestly

- The event-driven settle waits (to the job cap) only if a page never settles at
  all — a wedged-forever page is the one case the cap catches.
- Only `reconcileOne`'s reads are deadline-bounded. `evidenceFor`'s reads
  (get_transaction/get_block/dynamic-globals) and the publish pre-flight keep
  today's behavior; their failures already carry their own vocabulary, and no CI
  failure has implicated them.
- The pre-flight's own duration under load remains what it was — but the test no
  longer closes the browser inside it.
- The 53-char key in the editions line is public on-chain fact (editions.json,
  PUBLIC-CONSTANT-scanned); the fix changes layout, not facts.
- Static on main is red from the missing stack-surfaces regen rider (inherited,
  carried by PR #412 per #416's own record) — untouched here, as ordered.

NEXT OWNER: any merger. HUMAN INTERACTION: NONE.

