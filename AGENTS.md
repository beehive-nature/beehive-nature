# AGENTS.md — the estate's standing laws for any agent seat

You are one of several agent seats working `beehive-nature/beehive-nature`
in parallel. Other seats are live right now. These laws exist because
breaking each one has cost real hours; they are the minimum bar.

## Identity and commits
- **Worktree law (FOUNDER ORDER):** stage/commit/push ONLY from your own
  `../wt-<seat>` worktree. NEVER `git add` from the shared checkout at
  `C:\Users\travi\beehive-nature` — other seats' WIP lives there.
- **Branch and HEAD verification (REVIEW RULE, 2026-10-14):** in a lane
  where sibling seats share one worktree, run `git branch --show-current`
  (and confirm it is the branch you intend) immediately BEFORE every
  `git commit` and every `git push` — a sibling's branch switch lands
  your commit on the wrong line silently. Two convictions: the stale
  bench binary that was "passing" (provenance unproven) and the
  empty-branch push recovered at PR #427. Preferred posture: one
  worktree per active agent (`git worktree add ../wt-<seat>-<lane>`),
  which makes the check trivial and the collision impossible.
- Add by explicit pathspec; never `git add -A`.
- **Check origin first:** `git fetch origin` before healing anything; red CI
  is often another seat's inherited state — locate the first red commit
  before assuming yours. Cure = push a descendant, not a force anything.
- Commit messages are the estate's canon: long, honest, receipts over
  claims. Report failures with their output; skipped steps get named.
- The pre-commit hook blocks hex runs ≥48 chars; if a constant must appear,
  put a same-line `PUBLIC-CONSTANT` (or `TESTNET-ONLY`) marker.
  Wire it after cloning: `sh scripts/install-hooks.sh` - one install covers every
  checkout of the repo (common hooks dir). `e2e/hooks-installed.test.sh`
  proves the wiring and fails when the hook is absent. Measured on this box
  2026-09-20: hooks fire under Git-for-Windows (fire, block and delegate all
  proven); WSL cannot resolve gitfile worktrees - git itself fatals there
  before any hook runs - so commit from Git-for-Windows inside worktrees.

## Surfaces (the registration ritual — same commit, every beat)
Adding or moving anything under `surfaces/` rides ONE commit with all of:
the file, its `estate.json` row, `node scripts/build-atlas.mjs` output, and
the `surfaces/review.html` SURFACES entry. CI (`estate-check`,
`university-smoke`) is tree-following and will name the missing beat.

## Reports and secrets
- Every lane lands a dispatch at `docs/dispatches/YYYY-MM-DD-<lane>.md`,
  committed and pushed; reply with the filename.
- Secrets are env-delivered and NEVER printed, committed, or pasted — keys,
  nsecs, api-tokens, session tokens.
- Crypto claims cite source file+function or stop at `UNVERIFIED`; wording
  caps at "sound by construction / isolated by design".

## Upstream priority (FOUNDER ORDER, 2026-09-10)
- David Irvine's (`dirvine`) GitHub communications are priority one. Check
  outstanding requests affecting our backend before starting new feature lanes.
- x0x #504's remaining measurement work moved to **#622**; also track the
  related #505 field-evidence request. Follow current discussion and acceptance
  terms, not an issue's closed badge. Record replies and completed evidence.
- Handoff: `docs/dispatches/2026-09-10-david-irvine-followup.md`. Synthetic
  tests, send-attempt counters and a prepared capture are not a live result.

## External navigation (FOUNDER ORDER, reaffirmed 2026-09-07)
- External website links open a new tab so the current BNR page and session
  remain available. Use user-activated links with `target="_blank"` and
  `rel="noopener noreferrer"`, and tell the reader when a new tab will open.
- Same-page and same-origin BNR navigation stays in the current tab.
- The shared `surfaces/tour.js` click handler covers dynamically rendered
  external links. Standalone review boards must carry these attributes too.

## The box (oracle)
- Reach: `wsl -e ssh oracle` (Ubuntu 24.04 aarch64, OCI).
- `ops/` in-tree is VERBATIM what runs on the box — change both together.
- New inbound ports need an iptables INPUT door + `netfilter-persistent
  save` (per-port door law). Egress/ingress cloud rules are FOUNDER gestures.
- x0x mesh node: `ops/x0x/` (systemd `x0x`, capped). Laptop side is
  ON-DEMAND only: `C:\Users\travi\x0x-win\x0x-tunnel.ps1 up|down|status`
  (auto-downs after 10 min — the building wifi law; nodes on the box,
  everything else is a window into it).

## Where the history lives
- `docs/dispatches/` — every lane's receipts, newest at the top of your
  reading list. `docs/specs/` — the SPEC-* canon. `docs/raids/` — source
  studies. `ops/` — runbooks that run.
- Laws with a FOUNDER RULING tag are not relitigable.

## Standing system requirements (PCi environment, added 2026-10-29)

These stand alongside the laws above; they do not overwrite any of them.

- Build toward 10 billion active unique human users and at least
  1,000 years of continuity for the PCi hybrid quantum cryptographic
  computing environment.
- Fully decentralized and noncustodial; users pay their own way.
- Providers stay replaceable; keys stay owner-controlled; state and
  work stay bounded.
- Paid operations are attributable to an authorized payer with a
  bounded budget — no unattributable spend, no unbounded operation.
- Agent-key continuity does not establish unique humanity. Never
  present a key-continuity proof (a DID, a checkpoint pair, a signed
  receipt) as proof that a unique human stands behind an agent.
