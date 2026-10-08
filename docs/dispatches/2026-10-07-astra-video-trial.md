# Astra: preserve the poster gain, measure the session, expose the playback cost

## Full-go implementation follow-up

Founder approved implementation after the initial measurement-kit delivery.
Trial #1's identity is unavailable to the founder. Public-site inspection could
not establish it, so no replacement run is represented as that experiment.

Read the live `https://www.ants.tube/assets/index-B4-449j6.js` bundle via HTTPS.
SHA-256: 6a890631e0bdbfaef8907d63a9cb4fc6a957cb9abc36988ba143d29e3aa5ae1a PUBLIC-CONSTANT
It contains visible/background poster prioritization (`jS`/`Xu`), shared-client
access (`Sn`/`b0`), and playback context switching (`Uk`/`Wk`). These are minified
symbols in this exact bundle, not stable APIs. We did not alter or copy the
third-party application into the estate. This source evidence changes the next
step: inspect existing contention before adding another poster scheduler.

An independently reproducible bView defect is fixed in this follow-up. Previously
any out-of-order chunk completion restarted the 45-second starvation timeout,
even while the player was blocked on an earlier chunk. Now the timeout measures
only outstanding demand for the next ordered chunk. Later chunks cannot extend
that deadline; successful demand ends it; player processing time is excluded.
Direct-only stops with a named missing chunk, and direct-with-fallback uses the
existing relay path. No increase in concurrency, retries, proxies, or cache scope.

Receipts now distinguish emitted bytes/chunks from queued bytes, peak queue,
current missing chunk and cumulative completed head-wait time. The standalone
capture allowlists these fields. Late successful reads cannot update a stopped
run. The existing bView CI step now also executes the scorecard tests.

Validation:

- Unchanged HEAD HTML (`a3e203224`) with the two new starvation cases:
  0 passed, 2 failed, exit 1, 17,770.873 ms. Both expected recovery states timed
  out: the old page lets later chunks renew the deadline and then completes.
- Candidate direct + eternal front suites: 15 passed, 0 failed/skipped, exit 0,
  78,496.3783 ms. Real Chromium/VP9 frames; network reader mocked.
- Strengthened final fault fixtures (late successful reads ignore cancellation;
  healthy successive chunks span more than one watchdog interval): 3 passed,
  0 failed/skipped, exit 0, 9,163.6062 ms.
- Scorecard: 4 passed, exit 0. Estate-check passed; CI-shape 125/125 guarded;
  diff whitespace check clean. Production timeout remains 45 seconds; only the
  fault fixture maps that timer to 800 ms. Existing silent-read test exercised
  the actual 45-second timeout successfully.
- Initial harness attempt ran before a fixture edit succeeded because `python`
  resolved to the unavailable Windows Store shim: 9 passed, 2 timeout failures.
  Applied the fixture edit with Node, then obtained the candidate and unchanged
  baseline receipts above. That failed attempt is not counted as acceptance.

This is tested recovery behavior, not a measured mainnet speedup. Neither a new
live Trial #1 comparison nor proof of Shu's warm-navigation claim is available.
The implementation changes existing surface code only; no surface was added or
moved, so no atlas registration change is needed.

## Initial measurement-kit delivery (historical)

Founder opened this lane with Shu's October 7 cold-start report and qualitative
warm-navigation follow-up. Delivered in `tools/video-trial/`: executable arithmetic,
explicitly attributed input, bounded bView capture helper, four regression tests,
and a controlled Trial #2 protocol with proposed acceptance budgets.

The supplied interpretation yields 43.3% less time to first poster and 20.2% less
time to 21/21 posters, but 22.2% more short-clip first-frame time and 30.4% more
long-clip stall time (+6.9 seconds). Preserve the poster candidate; do not call
the combined trial accepted. Warm responsiveness is reported, not quantified.
No abandonment threshold, cause, confidence interval, or network-entropy diagnosis
is established by this material. Original screenshots were placeholders here.

Source inspection at base `08d11832b`: `surfaces/bview.html` has `openPool` client
reuse inside one document, `pagehide` pool closure, full-media `cacheGet/cachePut`,
a six-lane direct reader with ordered emission, and `window.__bviewEngine` receipts.
The new capture allowlists timing/path/counter fields, samples every 250 ms, and
caps at 7,200 samples. It does not capture poster paints, DHT, wire traffic, or
cross-document navigation. No production player or third-party site was changed.

The next experiment tests whether suppressing admission of offscreen poster reads
at Watch entry protects video deadlines while retaining Home responsiveness.
That is a hypothesis, not the identified mechanism of Trial #1. Keep cold client,
warm new-content, warm cached-content, and real full-navigation results separate.
Respect Shu's operator no-proxy/no-transcoding/no-content-custody constraint from
`2026-09-26-ants-tube-shu-reply.md`.

## Upstream priority checked live

On October 7, read saorsa-labs/x0x #622, #505 and #504 via GitHub CLI.
#622 is closed into #504; #505 is field-accepted. David's latest #504 comment
(October 5) calls for per-kind counters (#1170) and a same-workload
delivered/published capture. That mesh work remains separate; this lane supplies
none of its missing field evidence. No upstream replies were sent.

- https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476
- https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450
- https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210

## Validation and boundaries

`node --test tools/video-trial/scorecard.test.mjs`: 4 tests passed, 0 failed,
0 skipped, exit 0. Tests catch sign/denominator mistakes, unknown-to-zero
conversion, duplicate/invalid inputs, false measured provenance, sensitive-field
copying and an unbounded recorder. Capture execution was in a simulated browser
global via node:vm, not a live browser or Autonomi measurement.

`node tools/video-trial/scorecard.mjs tools/video-trial/shu-2026-10-07.json`:
exit 0, 14 rows including the explicitly unknown warm transition.
`git diff --check`: clean. No broad browser suite: product runtime is unchanged.
No new live comparison, deployment, bTunGsTeN conformance claim, or community
message. Trial build/source, raw run records and exact fixtures are still needed
to execute a faithful comparison; no invented replacement benchmark was used.

Hook installation was attempted using Git-for-Windows bash after bare `sh` was
unavailable on PowerShell PATH. Installer refused the existing custom hook:
`install-hooks: REFUSING - C:\Users\travi\beehive-nature\.githooks/pre-commit exists and was not written by this installer.`
Inspected hook invokes `scripts/secret-scan.sh diff` and staged
`scripts/identity-check.sh`; commit-msg checks identity trailers. Kept these
existing controls intact. Staging/commit/push use only the owned sibling
`wt-astra-video` worktree and explicit pathspecs. Initial issue lookup used the
wrong repo `maidsafe/x0x` and failed; corrected to `saorsa-labs/x0x` above.
