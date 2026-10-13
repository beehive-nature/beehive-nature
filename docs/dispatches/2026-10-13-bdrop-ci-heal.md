# bDroP CI heal — #413/#415 lifecycle repair + #416 viewport repair (ZCode seat 1, 2026-10-13)

Lane: `zcode/bdrop-ci-heal-2026-10-13` (worktree `wt-zcode-bdrop-ci`), base `8f9633c30`
(origin/main at pickup). Deliverable commit `c961e272c`. Ownership per the pickup order
on #413: Agent 30 / bDroP, one seat, PR #409/#411/#412 untouched.

## 1. The mechanism, from recorded evidence first (#413, #415)

The step `restart after mid-handoff closure reconciles from the chain` timed out at
exactly its tuned wall on four recorded occasions with no code change near the path:
20s twice on main (run 38322545384, job `eternal`, the whole file otherwise green),
45s twice on PR #409 heads (runs 38351639383, 38360498738 — #415's table). Previous
responses were two widenings (e59d41913 20→45s, a4df32921 45→75s) and the inert
keychain origin (9f5128526); the step starved again after both.

Fresh instrumentation (throwaway 6c replica with an in-page timeline: fetch wrap,
longtask observer, resource timings, outbox mutation stamps, liveness beats):

- **The desk's own work is sub-second.** Unloaded: browser launch 410ms, goto 605ms,
  `body[data-reg]` +41ms, the reconcile RPC issues at page-t+180ms and answers in
  ~100ms, the confirmed render lands at t+292ms — **before the data-reg gate
  resolves** — `waitForFunction` then resolves in 4ms. The whole boot (≈330KB of JS
  across six scripts, register.js loaded dynamically last) completes at ~600ms.
- **Under 12-core oversubscription** (all local cores saturated): launch 3493ms,
  goto 1650ms, boot stretched ~3x — the reconcile still settles before the gate
  (waitForConfirmed 8ms). The page's work scales mildly; nothing in it approaches 20s.
- **The CI failures are renderer starvation, not desk work**: in every recorded
  failure the node-side timer fired exactly on schedule (the ✗ lands at wall+ε), the
  preceding steps were green, and sibling suites in the same `node --test` invocation
  completed subtests at normal speed *through the stall windows* — the runner's CPU
  was available to everyone except the frozen page renderer. The eternal job runs
  ~115 suites (one `node --test`, 4-vCPU runner) whose concurrent browsers can freeze
  one page's main thread for tens of seconds at a time.
- Conclusion: **no tuned wall measures this.** 20s, 45s and 75s are all the same bet
  on the scheduler; two have already lost.

## 2. The repair (no widening, no watcher, no rerun-until-green)

Page (`surfaces/bdrop.js?v=10`):

- Reconcile chain reads carry the desk's **own deadline** — 10s, then abort and name
  it ("the endpoint did not answer in 10s — read aborted"). Reads only: an aborted
  read can broadcast nothing. The autonomous boot pass retries a stalled read **once**
  (1.5s backoff): a slow answer is not a verdict; only a read that answers may settle
  a record.
- The boot reconcile stamps **`data-boot-settled`** on `#outbox` when its pass
  completes (`finally`, plus a catch path that names an outright failure) — the
  settle event. This also closes a real product gap: a stalled endpoint previously
  wedged the boot reconcile silent forever; the outcome is now always a rendered
  fact.

Test (`e2e/bdrop-eternal.test.mjs`):

- The step waits for the page's own event with **no tuned timeout** (`timeout: 0`);
  the predicate accepts `data-boot-settled` OR the confirmed record, and the
  assertion then names the record's own line (`@loviswater/bdrop-keychain-closed-midhandoff · confirmed`).
  A broken reconcile settles and reds immediately with the page's answer in the
  detail; a starved renderer resumes and settles green. The eternal step's 12-min
  job cap is the outer backstop (documented in the code).
- The no-duplicate-broadcast invariant is asserted unchanged (broadcasts=2 across
  the whole keychain scenario).
- **Focused regression 6d**: a restart against a chain stalling every answer past
  the deadline (new `stallMs` mock control) — the boot pass settles with the
  unanswered read **named** on the record, broadcasts stay 0 through
  deadline/retry/abort, and the manual reconcile confirms once the endpoint
  answers. The scenario's waits carry walls because the page's own work is bounded
  by its own deadlines (10+1.5+10s), not by a tuned sleep.

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
  registers** under the same metrics; local footer-audit `--only bdrop.html`
  against the committed baseline: `0 worse · 0 better` — **baseline untouched**.

## 4. Batteries on this head (c961e272c, tree state of the final commit)

- `node --test e2e/bdrop-eternal.test.mjs` — **GREEN ×4**: idle (twice: pre/post
  assertion tightening), under 12-burner CPU contention, and with 6d included
  (13 scenarios + 6d; the contended run also exercised the event-driven step).
- `node --test e2e/bdrop-preserve.test.mjs` — GREEN (2/2).
- `node footer-audit.mjs --only bdrop.html --baseline footer-audit.baseline.json`
  — no findings, ratchet 0/0.
- Recorded-evidence pass over runs 38322545384 / 38351639383 / 38360498738 before
  any change (the order's reproduce-first requirement).

## 5. Boundaries named honestly

- The event-driven step hangs (to the job cap) only if the page never settles at
  all — a renderer freeze resolves into green, a broken reconcile settles and reds
  with its answer; a wedged-forever page is the one case the cap catches.
- Only `reconcileOne`'s reads are deadline-bounded. `evidenceFor`'s
  (get_transaction/get_block/dynamic-globals) and the publish pre-flight keep
  today's behavior: their failures already carry their own vocabulary, and no CI
  failure has implicated them; unbounded stalls there are a named, unobserved
  residual.
- The other boot-reconcile waits in the file (e.g. the ambiguity-restart step,
  20s) share the starvation exposure in principle and were left untouched — the
  order targets the one demonstrated step. The same settle-event pattern applies
  if they ever starve.
- The 53-char key in the editions line is public on-chain fact (editions.json,
  PUBLIC-CONSTANT-scanned); the fix changes layout, not facts.

CI verdict: the PR's own eternal run on this head is the live check (main's eternal
red was #416's ratchet + this step; both repaired here). Verdict recorded in the PR
and on #413 once the run completes.

NEXT OWNER: any merger. HUMAN INTERACTION: NONE.
