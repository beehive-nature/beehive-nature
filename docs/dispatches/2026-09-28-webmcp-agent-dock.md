# WebMCP on the agent dock: list + stage, never send (2026-09-28)

**Seat:** Claude Code (Fable 5.1), desktop worktree `brave-wiles-4fc88b`. The committer is the founder per §7; the seat is credited by `Co-Authored-By`.
**Branch:** `claude-LoVis/webmcp-browser-eval-45e0b2`, PR #263.
**Surface:** `surfaces/agent-dock.js`, the shared dock loaded by 16+ surfaces. The change only modifies the dock; no surface was added or moved, so the registration ritual (estate.json / atlas / review.html) does not apply.
**Order:** the founder relayed an outside WebMCP assessment: "this is your project to eval and build".

## The eval

The relayed assessment was checked against a foreign oracle, the live W3C Web Machine Learning CG spec and explainer, not against its own prose.

- **Holds:**
  - The API is `document.modelContext`.
  - `registerTool` returns `Promise<undefined>`.
  - `ToolAnnotations.readOnlyHint` exists.
  - `execute` returns `{content:[{type:'text',text}]}`.
  - Cross-origin frames need `allow="tools"`.
  - Chrome 149+ has an origin trial and the flag `enable-webmcp-testing`. Firefox and Safari have no implementation.
- **Overstated:**
  - "Zero Server State Law" is not a phrase in this repo.
  - The Extism MCP gateway is a target in `DISPATCH-2026-08-11-TEN-TARGET.md` P3. It is not built.
- **Correct and kept:** the kernel, signing and keys are out of scope. The feature is a progressive enhancement on the surface layer only.

## What shipped

When `document.modelContext.registerTool` exists, the dock registers two tools. Without it, nothing registers and nothing changes.

- **`bnr_list_agents`** (`readOnlyHint`): the four dock agents, their purpose, and `acceptsMessage` (false for bAigents).
- **`bnr_stage_message`** (`queen` | `hearth` | `bloverai`): opens the dock on that agent and places a draft. **It never sends.**
  - The dock opens without taking page focus.
  - If the person was in the composer or on Send, focus moves to the dock title, which cannot submit.
  - The person's draft is kept byte for byte, and only a missing separator is added.
  - If the text would exceed 4000 characters, the tool refuses rather than truncating.
  - An agent's own repeated stage is refused. That marker expires on any edit or send.
  - A notice ("A browser agent placed a draft… press Send") outranks old receipts, clears when the person types or sends, and gives way only to an agent that cannot open.

No tool sends, copies, navigates or leaves the page. Agent text only reaches `.value` and `.textContent`, never `innerHTML`.

## Review trail (all read-only reviewers; the writer never judged its own work)

| head | reviewer | verdict |
|---|---|---|
| `fc096d959` | Explore subagent | REQUEST-CHANGES: focus stealing, notice erased on load, silent truncation, repeat stacking |
| `6338711e7` | Explore subagent | REQUEST-CHANGES: repeat check refused the person's own words ("book" + "ok") |
| `03d673306` | same reviewer | APPROVE-WITH-NITS: "send clears" test proved nothing |
| `e238cb682` | Explore subagent | APPROVE-WITH-NITS (test commit), then merge preview into `3939e4023`: APPROVE-WITH-NITS |
| `e238cb682` | Codex security review | 2 P1 + 4 P2. P2: stale status hid the notice, the draft was not verbatim, focus was left on a submit control, dedup outlived provenance. P1: this dispatch was missing, and the PR body counts were stale |
| `55a6e7489` | fixes for all four P2s | re-review pending at the time of writing |

A reviewer's claim that the `Co-Authored-By` trailer names the wrong model was rejected: the trailer follows this session's own attribution instruction.

## Receipts

- **Unit harness:** `node --test e2e/agent-dock.test.mjs` passes 43/43 at `55a6e7489`, with 16 new tests.
  - Each fix is mutation-checked: the new test fails on the prior code.
  - Not explained: the whole file run against `e238cb682`'s dock hung (a synchronous stall; `--test-timeout` did not fire), while each new test alone just fails. The fixed code runs to completion.
- **CI unit list** (`tests.yml` front-door line):
  - At `6338711e7`, the first run was 386 pass / **1 fail, and the failing test was not captured**. 7 reruns were clean, and it was not in the dock suite.
  - At `03d673306`: 389/389, three times.
- **CI on `e238cb682`:** `tests` and `secret-scan` were green on both the push and pull_request runs.
- **Stand-in browser:** the app's browser pane, a real Chromium DOM with a fake registry and the real bQueenBee engine. Focus was kept, the notice survived the engine load, the engine's chat was unchanged, and the repeat was refused.
- **Native Chrome 153.0.8010.53, throwaway profile** (a separate process, temporary `--user-data-dir` deleted after; the founder's Chrome was untouched):
  - The flag was set only in that profile's `Local State` as `enable-webmcp-testing@1`. The name was read from its own `chrome://flags`.
  - Control, with no flag: no `document.modelContext`.
  - With the flag, on `surfaces/bmeshasi.html`: native `getTools()` listed both tools. Native `executeTool` round-trips passed list, stage (dock open, focus kept, nothing sent, engine chat unchanged), repeat refusal and bAigents refusal.
  - Finding for callers: Chrome 153's `executeTool` takes the input as a **JSON string** and rejects an object ("Failed to parse input arguments"), although the IDL says `any`.
- **NOT VERIFIED:** a real AI agent autonomously discovering and choosing to call these tools.

## Follow-up owned by this seat, after merge

Bump every `agent-dock.js?v=` loader to one new version, `v=10`. That covers 18 pages, both generators (`tools/build-surfaces.mjs`, `scripts/build-atlas.mjs`) and `crates/bmesh-serve/assets/page.html` (`include_str!`), so a rebuild cannot bring the old version back. Returning visitors otherwise keep the old dock until their cache expires.
