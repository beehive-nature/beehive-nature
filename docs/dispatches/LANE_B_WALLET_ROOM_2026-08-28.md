# LANE B — WALLET ROOM (sprint 2026-08-28)
**Seat:** zCode. **Plan:** docs/SPRINT-2026-08-28-PLAN.md lane B. **Law:** continuous landing — each item DONE at its receipt, then the next.

## Lane state
- **B1 — PARKED BEFORE START: the dispatch's stop condition fired.** `docs/SPEC-ADAPTER-CONTRACT-1.md` does not exist in the repo, and the dispatch explicitly forbids reconstructing it from memory. No B-item executed; nothing in `surfaces/wallet.html` or any adapter/vault module was touched.

## Stop-condition evidence (checked 2026-08-28, read-only, before any lane work)
1. Working tree at main (`b272393`): the file is absent from `docs/` (full listing read).
2. All 24 worktrees (the `wt-*` seats + the two `.claude/worktrees`): absent.
3. `git log --all` on the path: **no commit on any ref ever touched it** — the file was never in the repo's history.
4. Only mention of `SPEC-ADAPTER-CONTRACT` anywhere in tracked files: the sprint plan itself.
5. The source material the plan credits does not contain the contract either: `docs/dispatches/RAID_WALLET_SOVEREIGN_LIGHTNING_2026-08-27.md` is a Lightning/standards survey — no adapter-contract, buildAction, outbox, or wallet-law text; the four wallet laws exist in-repo only as the plan's Lane B binding summary line; Brief 03 and Brief 04 carry no spec text.

## The contradiction the founder/chief resolves (one decision, then B runs)
- Plan §7.3 records "`docs/SPEC-ADAPTER-CONTRACT-1.md` do[es] not yet exist — A and B create them," and B1's deliverable includes "spec file committed" — the plan expects the seat to author it.
- The dispatch binds the seat TO the spec as an existing input ("all at repo paths, read them there") and forbids reconstruction — the dispatch expects it to pre-exist.
- These cannot both hold. Either (a) point this seat at the canonical spec text (a repo path or a paste to commit verbatim), or (b) rule that the seat authors it fresh from the raid + Brief 03 + Brief 04's PROTOCOL/SERVICE/PATTERN classing. One word un-parks the lane; B1→B3 then run whole per the plan.

## Park note
Lane B parked before B1 on the dispatch's own stop condition. Awaiting the spec's canonical text or a ruling to author it.
