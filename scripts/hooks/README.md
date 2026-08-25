# scripts/hooks — Claude Code hooks, versioned

Hooks live in `~/.claude/settings.json`, which is **user-level, unversioned, and
on one disk**. This directory is the backed-up, adoptable copy. The `~/.claude`
install stays the *live* copy; it stops being the *only* copy.

---

## warn-grep-c-chain.mjs

**Warns — never blocks — when a Bash command chains `grep -c` with `&&`.**

### The bug

```sh
grep -c foo file && echo "next"
```

`grep -c` emits a **count** and exits **1 on zero matches**. A count of 0 is
DATA, not a failure — so a legitimate zero silently kills the rest of the chain
and the later commands never run. That is how a check reports "clean" when it
never actually looked. **Six occurrences across three seats in one sprint**,
including two while building the check for it.

### Only `-c`, never `-q`

`grep -q x && act` is boolean **by design** and correct. Measured over **3,765
unique real Bash invocations** from this box:

| pattern | fires | verdict |
|---|---|---|
| `grep -q … &&` | 66 (1.75%) | all legitimate — warning here trains dismissal |
| `grep -c … &&` | 25 (0.66%) | overwhelmingly real bugs |

An earlier draft matched `[cq]` and would have fired on all 66. A warning that
fires on correct usage is worse than no warning: it decays into wallpaper, the
same way an unreviewed `PUBLIC-CONSTANT` stops meaning anything.

**Also measured and REJECTED:** `VAR=$(cmd) && echo "$VAR"`. It looks like the
same bug and sometimes is, but it fires 6 times on that corpus, of which 4 are
legitimate gating (`NEW=$(git rev-parse HEAD) && … && git push` — you *want*
that to stop). False positives dominate 4:1, so it is deliberately not matched.

### Safety

The hook can only ever print a `systemMessage`. It never emits `continue:false`,
never a `permissionDecision`, and **every path exits 0** — parse failure,
unexpected shape, empty stdin, thrown error. A warning hook that can break the
shell is worse than the bug it warns about.

### Install

`jq` is not on this box; the hook is Node (Node is). Copy the script to
`~/.claude/hooks/` and merge this into `~/.claude/settings.json` — **merge, do
not replace**; `hooks` sits alongside your existing top-level keys:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/travi/.claude/hooks/warn-grep-c-chain.mjs\"",
            "shell": "bash",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Adjust the absolute path per machine. On Windows the `C:/…` form is required —
the hook runs under bash, but Node is a Windows binary and cannot resolve a
`/c/…` MSYS path.

### Verify before trusting it

Pipe the payload the hook will actually receive. All five must hold:

```sh
# NOTE: Windows path form, same reason as the settings command above — under
# Git Bash `~` expands to /c/… which Windows Node cannot resolve.
H="C:/Users/travi/.claude/hooks/warn-grep-c-chain.mjs"
echo '{"tool_input":{"command":"grep -c foo bar && echo next"}}' | node "$H"   # warns
echo '{"tool_input":{"command":"grep -q foo bar && echo ok"}}'   | node "$H"   # SILENT
echo '{"tool_input":{"command":"ls -la"}}'                       | node "$H"   # silent
echo 'not json at all'                                           | node "$H"   # silent, exit 0
printf ''                                                        | node "$H"   # silent, exit 0
```

The last two matter most: a hook that dies on malformed input would fail closed
on every command.

### Proving it is actually live

A hook's success is **invisible** — the `systemMessage` renders in the user's UI
and never reaches the model, and the UI only surfaces "Ran N hooks" when a hook
errors or is slow. Silence is indistinguishable from a hook that never fired.

Instrument an observable side channel, prove it fires, then remove the
instrument. Temporarily prefix the `command` in settings.json:

```
echo "hook fired $(date)" >> /tmp/claude-hook-check.txt; node "…/warn-grep-c-chain.mjs"
```

Run any Bash command, `cat /tmp/claude-hook-check.txt`, then **strip the prefix
and delete the file**. Expected rate on real traffic: ~0.66%, roughly 1 command
in 150.

---

## The gap this does NOT close

`scripts/lint-shell-chains.sh` catches the same pattern in **committed shell**
and runs in CI beside the fmt gate. This hook catches it in **ad-hoc** shell.
All six known violations were ad-hoc, so the lint finds zero in the repo today —
it protects future gate scripts, which is where a swallowed failure is worst.

**Nothing keeps this copy and the `~/.claude` copy in sync**, and CI cannot see
`~/.claude`. Drift is silent. Check it by hand after editing either:

```sh
diff "C:/Users/travi/.claude/hooks/warn-grep-c-chain.mjs" scripts/hooks/warn-grep-c-chain.mjs
```
