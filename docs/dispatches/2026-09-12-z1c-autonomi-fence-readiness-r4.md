# z1.c dispatch r4 — per-field type validation in the projections (2026-09-12)

**Lane:** same readiness lane; closes the r3 review blocker
([#10 comment 5647905430](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5647905430),
candidate 11fbfda4). **Session/effort:** zCode GLM 5.3 Medium, existing
session. Local tests only — no box probes, no production/capacity changes.

## The gap, closed

The r3 projections validated container shape but not the projected VALUES:
a nested object substituted into a selected field (`build_commit:
{private_note: "ZCANARY"}`, registry `version`, monitor `tag_name`) passed
the schema guard and printed. r4 makes every projected value prove itself
before output:

- **`scalar_str(value; format-regex)`** — null passes through (valid
  observed nulls preserved); a string passes ONLY if it matches its
  bounded expected format; everything else (object, array, number,
  boolean, unmatched string) → `error("field")` → ONE generic diagnostic
  + nonzero exit. Bounded formats per field: version `^[0-9]+(\.…){0,3}
  ([-+]…)?$`, tag `^v?[0-9][0-9A-Za-z.+-]*$`, hex commit
  `^[0-9a-f]{7,40}$`, network `^[a-z0-9][a-z0-9-]*$`, status
  `^[a-z][a-z0-9_-]*$`, paths `^/`, node id `^[0-9]+$`.
- **`scalar_num` / `scalar_bool`** for `fetched_at_epoch_secs`,
  `uptime_seconds`, `prerelease` (number/boolean or null only).
- **`upgrade_channel` bounded to its enum**: null | "stable" | "beta".
- **Process rows validate every printed token**: numeric pid, bounded
  comm `^[a-zA-Z0-9_.-]+$`, elapsed shape `^([0-9]+-)?([0-9]{1,2}:)?
  [0-9]{1,2}:[0-9]{2}$` — malformed rows are omitted, never echoed
  (both the fixture path and the live `ps` path use the same validated
  projector).

## New canary regressions (22 assertions on top of r3's 28)

| case | injection | asserts |
|---|---|---|
| T6a/T6b | registry `version` = {nested canary} / = 12345 | rc≠0 + generic diagnostic + no canary |
| T7a/T7b | monitor `tag_name` = {nested canary} / `prerelease` = canary string | rc≠0 + generic diagnostic + no canary |
| T8a/T8b | health `build_commit` = {nested canary} / `uptime_seconds` = {nested canary} | rc≠0 + generic diagnostic + no canary |
| T9 | `upgrade_channel: null` kept; `binary_path` ABSENT → null | rc=0; both nulls printed; no canary |
| T10 | ps rows with canary pid / canary elapsed + one valid row | valid row survives; malformed omitted; zero leakage |

## Receipt

`bash docs/runbooks/autonomi-observe.test.sh` (local; bash + static
jq 1.7.1, nothing installed system-wide):

```
RESULT: 50 passed, 0 failed        (suite exit 0)
```

50/50 = r3's 28 + the 22 new. `bash -n` clean on both files. Filenames
unchanged and correct: `autonomi-observe.sh`, `autonomi-observe.test.sh`
(the "autonomo" spelling appeared only in an r3 commit-message typo, never
in tree paths — verified by grep). Runbook §5 updated to revision 4's
output law (type-checked projections, nested rejection, preserved nulls,
validated process tokens) with the 50/50 receipt.

## Return

Pushed descendant on `zcode/autonomi-fence-readiness-2026-09-12`;
returned on #10 with commit link + receipt. No observations, production
changes, or capacity operations this pass.
