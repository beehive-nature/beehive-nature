# G3 negative review — G1 at pinned 9114b17e (2026-09-07)

Reviewer: zCode / GLM-5.3 Max, **fresh read-only session**, separate
worktree `wt-zcode-g3` (detached at the pinned ref; the build worktree
`wt-zcode-g1` untouched). Mandate: try to break the G1 claims, not re-run
them — verify independently, probe beyond the shipped tests, report
findings with repros. Production was touched READ-ONLY (no cleanup, no
restarts, no writes). [#4](https://github.com/beehive-nature/beehive-nature/issues/4)
stays open pending this review's findings being dispositioned.

## 1. Independently verified (all PASS)

| claim | independent check | result |
|---|---|---|
| fixture suite at pinned ref | rerun from `wt-zcode-g3`, non-root | ALL PASS (defect census, permission failures, guard withholding, clean census, `not-applicable` exemption) |
| deployed tool == pinned ref | sha256 box `/home/ubuntu/recovery/recovery-inventory.py` vs worktree copy | identical (`ce1e9dadb4615b43…` both) |
| ten-GB fence reserve | `df -h /` + fresh run `headroom_ok` | 14 G free / 70%, `headroom_ok: true` |
| services alive | dev relay pid 3832163 (untouched), 9 prod containers, voice `ok`/queue 0, x0x 0.41.3 healthy 27 peers, ant stack 3/3 known pids | all alive |
| bitcoin recovered + progressing | `is-active` + journal UpdateTip | active; **470325 → 471077** (+752 blocks ≈ 2 h), progress 0.163687 → 0.164645 |
| committed snapshot semantics | fresh read-only run vs `box-2026-09-07-post-correction.json` | same attention set (`dev-relay-build`, `vending-probe`), no errors |
| preserved recovery bundle | re-hash all 4 files vs dispatch-recorded sha256 | 4/4 match |
| historical snapshots immutable | `git diff d9248e4b 9114b17e` on pre/post-repair JSONs | empty — unchanged |
| CI claim | check-runs API at pinned sha | **7/7 success** |

The §7 acceptance table, §8 and §9 correction-cycle claims spot-checked
against the tree: statuses, test names, and assertions exist and behave as
written.

## 2. Findings (adversarial probes BEYOND the shipped suite)

The probes target the output guard — the documented backstop that "scans
the serialized output and refuses (exit 3) if sensitive markers appear" —
using realistic key shapes in operator-declared `notes` fields of
non-secret roots (ad-hoc config in /tmp; repo untouched):

**F1 (MEDIUM) — the guard is case-sensitive; a real nostr secret passes.**
A lowercase `nsec1…` string — the encoding nostr keys ACTUALLY take — flows
into stdout JSON; the `NSEC` marker only matches uppercase. Lowercase
`authorization: bearer` and the phrase `private key material` likewise
pass. Repro: root with `"notes": "rotate soon:
nsec1zzqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"` (all
bech32-legal characters, obviously fake) → exit 2 (not 3), sentinel
present in output.

**F2 (MEDIUM) — the guard is hex-blind; raw key-shaped hex passes.** A
64-hex string in `notes` (EVM-private-key shaped) reaches output verbatim.
No hex-run check exists. Digests legitimately occupy 64-hex in output, so
the cure must scope the check to config-echo fields (`notes`, `method`,
`kind`, `recovery_owner`) or exempt digest-valued keys — not blanket-ban
hex.

**Classification.** Both are defense-in-depth failures of the backstop's
STATED claim, not structural leaks: secret-reference entries remain
metadata-only (tested, re-verified), file contents are never read, and the
leaking pathway is operator-declared prose. But the estate's most common
key format sailing through the last line of defense is exactly what the
guard exists to catch, and the receipts' description of it oversells until
fixed. One small correction round (case-folded markers + hex-run check on
config-echo fields, with a lowercase-nsec and a hex-notes regression test)
cures both; same family, one root cause.

**Nothing else broke under probing:** error reports stayed code-shaped
with no discovered paths, secret-notes stayed absent, unknown/unreadable
restart shapes all escalated, no snapshot drift, guard withholding itself
(uppercase marker shape) still exits 3 with empty stdout.

## 3. Scope note — G2

G3's docket line covers G1/G2. G2 (durable receipt/replay boundary) is
Astra's analysis lane and has no shipped candidate at this ref — there is
nothing to negatively review yet. G3-of-G2 defers until its candidate
exists; this review covers G1 only.

## 4. Verdict

**G1's core acceptance items stand, independently re-proven.** Two MEDIUM
findings (F1+F2, one root cause) require a small third correction round
before #4 closes: fix the guard, add the two regression tests, regenerate
the post-correction snapshot read-only. Until then #4 stays open — an
unmet requirement remains open rather than being reported as complete.

Reviewer's receipts: probe transcripts in §2 (repro commands inline), all
§1 checks run 2026-09-07T05:5x–06:0xZ against
`9114b17eb4e4f4fa7e6abcb8362e58e3a2ed28cb`.
