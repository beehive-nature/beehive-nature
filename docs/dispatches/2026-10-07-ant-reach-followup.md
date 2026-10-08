# 2026-10-07 — Autonomi endpoint cohort follow-up

The pending CI claims in the handoff are now resolved, and one additional
scheduled window has been incorporated without overwriting the prior receipt.

## CI and deployment

- `c7a4c5c14`: tests [37680870048](https://github.com/beehive-nature/beehive-nature/actions/runs/37680870048), secret scan, Pages deployment and the manual probe all succeeded.
- `0e04b1dc9`: secret scan succeeded; Pages was cancelled; tests [37681761168](https://github.com/beehive-nature/beehive-nature/actions/runs/37681761168) failed in the meter job. Exact error: `The action 'shared setup — install (exempt from always())' has timed out after 10 minutes.` This is an install timeout, not a demonstrated SDK regression.
- Descendant `8046a4a86`: tests [37681843032](https://github.com/beehive-nature/beehive-nature/actions/runs/37681843032), secret scan and Pages deployment succeeded. The middle run is still recorded as failed, not retroactively green.

## New observation

Scheduled run [37700084759](https://github.com/beehive-nature/beehive-nature/actions/runs/37700084759)
succeeded. Both downloaded exports report SDK 0.1.2. macOS started at
2026-10-07 23:06:11Z and Linux at 23:14:02Z, observing 60 and 492 endpoints
respectively. Their starts differ by about eight minutes, so this window
is not presented as a simultaneous network comparison.

`docs/receipts/ant-reach-cohort-2026-10-07-followup.json` preserves the original
ten runs and appends these two. Classifications use the existing
`scripts/ant-reach-verdict.mjs::verdict` function. The fixed cohort is unchanged.

- Dead cohort: 120/120 settled observations remained dead (previously 108/108).
- Live cohort: 142/144 remained open (previously 126/128).
- No new flips. The two historical misses remain recorded.
- Missing/unsettled observations are excluded from settled denominators.

This is transport observation of a fixed sample, not proof of the upstream
root cause, population prevalence, or future reachability. Historical results
are extended from the committed receipt, not claimed as fresh reruns.

## Upstream and schedule

Issue [WithAutonomi/ant-node#247](https://github.com/WithAutonomi/ant-node/issues/247)
is still open. Its latest comment is the reporter's correction; no maintainer
response is present at this check. No upstream message was sent.

The six-hour cron remains active. Its existing guard permits scheduled probes
through October 9 UTC and skips them starting October 10 UTC; the cron entry
itself still requires removal afterward. It is too early to remove it now.
Run history establishes which executions occurred, but does not establish
that every absent window was dropped specifically because GitHub was busy.

Validation: inspected both fresh artifact schemas and SDK labels; recomputed
every member's counts from the retained per-run observations with the existing
verdict classifier. Documentation/receipt-only change; no additional live probe
or unrelated test battery was run.
