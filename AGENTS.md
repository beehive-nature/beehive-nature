# AGENTS.md — the estate's standing laws for any agent seat

You are one of several agent seats working `beehive-nature/beehive-nature`
in parallel. Other seats are live right now. These laws exist because
breaking each one has cost real hours; they are the minimum bar.

## Identity and commits
- **Worktree law (FOUNDER ORDER):** stage/commit/push ONLY from your own
  `../wt-<seat>` worktree. NEVER `git add` from the shared checkout at
  `C:\Users\travi\beehive-nature` — other seats' WIP lives there.
- Add by explicit pathspec; never `git add -A`.
- **Check origin first:** `git fetch origin` before healing anything; red CI
  is often another seat's inherited state — locate the first red commit
  before assuming yours. Cure = push a descendant, not a force anything.
- Commit messages are the estate's canon: long, honest, receipts over
  claims. Report failures with their output; skipped steps get named.
- The pre-commit hook blocks hex runs ≥48 chars; if a constant must appear,
  put a same-line `PUBLIC-CONSTANT` (or `TESTNET-ONLY`) marker.

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
