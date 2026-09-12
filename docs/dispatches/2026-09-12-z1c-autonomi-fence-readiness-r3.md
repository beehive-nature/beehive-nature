# z1.c dispatch r3 — fail-closed observation script + canary tests (2026-09-12)

**Lane:** same readiness lane; this pass closes the single integration
blocker from [Astra's r2 review](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647673959)
(candidate e220dfcc). **Session/effort:** zCode GLM 5.3 Medium, existing
session. Bounded to the listed blocker: fail-closed output, no raw
fallbacks, no argv, local canary tests. **No production change, no box
probe, no resize/deletion/upgrade/service change.**

## What changed

`docs/runbooks/autonomi-observe.sh` rewritten to revision 3:

- **Raw fallbacks removed.** The `jq || sed` registry fallback is gone. The
  registry, upgrade-monitor, and health sections now parse through
  schema-validated jq projections (`error("schema")` on wrong shape,
  explicit field lists). Any parse/schema failure or missing tool yields
  ONE generic diagnostic (fixed string — never the source input, never
  parser errors containing it) and a nonzero exit.
- **No argv, no environment, ever.** Processes print `pid=/comm=/elapsed=`
  only (`ps -eo pid=,comm=,etime=` projected by awk columns 1-3). The
  rev-2 `ps aux` denylist (one address pattern) is gone — argv is not
  read into output at all.
- **Logs: extracted values only.** Counts (`no_upgrade_available_count`,
  `rejecting_put_count`), the next-check timestamp (regex-validated), the
  last refusal's two numbers (`available_gib`/`reserve_gib`), and the
  ingress total (numeric awk sum). Unparseable/changed-shape lines are
  OMITTED, never echoed; chunk addresses cannot appear by construction.
- **Health: named values only** (status, version, build_commit,
  evm_network, uptime_seconds) — unknown fields (e.g. contract addresses,
  future fields) dropped by the projection.
- **Versions: only a semver-shaped token survives** `--version` output —
  junk on the same line cannot print.
- `OBS_JQ` test override added solely to exercise the missing-tool path
  (default `jq` — production behavior unchanged); all `OBS_*` env vars
  exist for local fixtures only.

## The canary test suite (new)

`docs/runbooks/autonomi-observe.test.sh` — local synthetic fixtures under
a temp dir, no network, no box. Canary law: the string `ZCANARY` must
never appear in stdout or stderr.

| case | fixture | asserts |
|---|---|---|
| T1 | canaries in registry rewards_address + unknown field, releases unknown fields, health unknown fields, ps argv/env/token, log `addr=`, `--version` junk | rc=0; all 15 approved values present; zero canaries |
| T2 | malformed registry JSON (canary inside) | rc≠0; generic `registry: approved-field extraction failed`; source not echoed |
| T3 | missing jq (OBS_JQ → nonexistent) | rc≠0; generic `required tool jq missing`; no canary |
| T4 | malformed health JSON (canary inside) | rc≠0; generic `health: approved-field extraction failed`; source not echoed |
| T5 | changed log shape (`WEIRD-CHANGED-FORMAT … embedded_secret=ZCANARY…`) | unparseable line omitted (not echoed); approved refusal values survive; zero canaries |

## Receipt

`bash docs/runbooks/autonomi-observe.test.sh` (local, bash + jq 1.7.1;
static jq fetched for the run, nothing installed system-wide):

```
RESULT: 28 passed, 0 failed        (suite exit 0)
```

28/28: T1 ×15, T2 ×3, T3 ×3, T4 ×3, T5 ×4. Full per-assertion output in
the commit's working receipt (35 lines, 28 PASS, 0 FAIL). `bash -n` clean
on both files. Two author-caught defects fixed en route and recorded: a
stray paren in the monitor jq schema guard (failed closed — the fail-closed
law worked as designed) and the T3 PATH-toolbox approach replaced by the
`OBS_JQ` override after MSYS symlink flakiness.

## Runbook deltas (same commit)

§5 rewritten (fail-closed output law + suite reference; rev-2 box receipts
kept and labeled; rev 3 not box-run — next box run re-receipts the new
shape). §7.2 reworded per the review: PUT refusals are reported for the
observed sample windows only, explicitly not generalized into proof of
zero writes on any path; the refusal is an operational follow-up (capacity
planning keeps production boundaries, coordinates with the Watch/media
owner) — not authority to resize.

## Return

Pushed descendant on `zcode/autonomi-fence-readiness-2026-09-12`; returned
on #10 with commit link + the 28/28 receipt.
