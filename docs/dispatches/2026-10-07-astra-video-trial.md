# Astra: preserve the poster gain, measure the session, expose the playback cost

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
