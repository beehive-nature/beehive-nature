# Grok — ACS marketing foundation landing (2026-09-19)

Seat: BgrOKbot (Grok Build / Buzz ACP, channel bMARKeTing).
Lane: marketing/design docs landing, genesis docket / issue #10.
This is a filesystem receipt. It does not restate the plan.

## Identity

| Field | Actual |
|---|---|
| Seat | BgrOKbot |
| Runtime | Grok Build TUI, Buzz ACP harness, nest `C:\Users\travi\.buzz` |
| Model | Grok 4.6 (`grok-4.6`) |
| Effort | high (orientation + docs landing; one session, no fleet) |
| Session type | per-channel Buzz ACP in `#bMARKeTing` (not a Cursor Cloud Agent; not a laptop `wt-grok-social-slice` takeover) |
| Worktree | `C:\Users\travi\.buzz\REPOS\wt-grok-acs-foundation` |
| Branch | `grok/acs-marketing-foundation-2026-09-19` |
| Base | `origin/main` `d7b9b2c6707efea75bb1e96f988a940b6326088c` (fetched this session; `git rev-parse HEAD` on the worktree matched `origin/main` before the first edit) |

Channel appointment: founder event `8d7bd2a1` (2026-09-19) — house resident code/media surgeon in `#bMARKeTing` for at least one month. Canonical orientation packet: nest `GUIDES/BMARKETING_GROK_RESIDENCY.md` sha256 `2658730e8fd152da77932bff83695c56c8150f97b6b54c1ce53a514619103f35` PUBLIC-CONSTANT (11,947 B).

This claim does **not** reopen the 2026-09-12 zCode implementation takeover of social/UI lanes. Stopped Grok social branches stay stopped. Campaign proof stays in issue #27.

## What landed

| Path | Role |
|---|---|
| `docs/ART_CREATORS_STUDIO_MARKETING_FOUNDATION.md` | Byte-for-byte copy of nest `PLANS/ART_CREATORS_STUDIO_MARKETING_FOUNDATION.md` v0.3. Not rewritten. |
| this file | Landing receipt. Pointer, not a second plan. |

Source hash, verified after copy and before commit:

```
Get-FileHash -Algorithm SHA256 docs/ART_CREATORS_STUDIO_MARKETING_FOUNDATION.md
D219C0B87FC5D1FD568F0CCBE2E85C5D54244852EA6CA4BCFFADB419BE916E15 PUBLIC-CONSTANT
22987 bytes, LF-only
```

Matches the Buzz review-loop closing receipt (bFUzZ 2026-09-18, event `cba72e06` lineage): v0.3 sha256 `d219c0b8…6e15`, 22,987 B.

Status of the landed file remains **DRAFT v0.3**. Nothing in it is a founder ruling. Dollar figures and launch numbers are the founder's pasted proposal, recorded, not ratified.

## Claims register

**None introduced.** This slice adds an internal marketing-law document and this receipt. It does not advertise ACS, does not claim a live Studio/ACS product, does not name an edition size, and does not spend.

The landed file discusses BNRi because it is the estate's marketing **law**, not a Campaign-A destination. Campaign-A ads and landing pages remain BNRi-free by construction (foundation §4.1). That rule is not satisfied by this docs landing; it will bind the first ACS page this seat authors.

## Outbound link map

The landed foundation file contains **zero** `http://` or `https://` URLs (verified by search this session). Policy citations live as quoted text plus platform names; dated URLs remain in the nest file `RESEARCH/AD_POLICY_TOKEN_MARKETING.md`, not in this PR.

This receipt links only to in-repo paths and GitHub issue #10.

## §2 screen (docs landing, not a media slice)

- token_mention_allowed=false: this is not an ad; no paid destination
- no 7777 in this receipt; the foundation keeps 7777 out of creative
- ACS = room, Studio = engine: preserved in the copied file
- no unreceipted user-facing product claims
- FTC/branded-content: not a creator brief

## Attribution

§7 form, matching `scripts/identity-check.sh` T3 (founder author, seat committer, parsed `Co-authored-by`):

- Author: `loVis waTer <loviswater44@gmail.com>`
- Committer: `BgrOKbot <loviswater44@gmail.com>` (founder's real mailbox, seat display name; no fabricated domain)
- No `Signed-off-by:` under a machine identity (ORDERS-1 DCO clause)

The residency packet allowed seat-as-author with known-red §7 CI. This slice follows the gate instead: T1 (seat-as-author) is blocked by identity-check.

## Checks run

- `git fetch origin`; `git rev-parse HEAD` == `git rev-parse origin/main` == `d7b9b2c6707efea75bb1e96f988a940b6326088c` before the first edit
- `Get-FileHash` nest source == worktree copy (output above)
- Search of the copied file for 48+ hex runs: none
- Search of the copied file for `https?://`: none
- Collision: `git log --all --oneline --not origin/main -- docs/ART_CREATORS_STUDIO_MARKETING_FOUNDATION.md` empty; no open PR owns this path
- No `surfaces/` edits; no estate.json / atlas / review.html ritual
- No `STATUS.md` edit (hot ledger; Astra may add the line on integration)

## Limits (named)

- Nest orientation packet and foundation remain the working copies until this PR merges. Dual-home until Astra integrates.
- Genesis docket `2026-09-06-genesis-work-docket.md` is **not** rewritten here. A one-line pointer in that docket is Astra's integration beat.
- X financial-services ad policy is still UNVERIFIED (HTTP 402 on 2026-09-18). Not closed by this PR.
- No spend, no Helena auth, no publish, no edition size, no ACS-name ruling.
- GitHub issue-write will be attempted from this seat; if it 403s, this dispatch and the PR are the claim (same pattern as `2026-09-07-grok-claim-27.md`).

## Next (this seat, not this PR)

1. Fetch the X financial-services policy page into nest `RESEARCH/AD_POLICY_TOKEN_MARKETING.md` if this runtime can reach it.
2. Inventory `docs/dispatches/2026-09-07-grok-genesis-campaign-pack.md` against foundation §2; post the delta as a later candidate.
3. Draft the stage-2 creator-pilot brief into nest `OUTBOX/` (FTC block + two-instrument split). Waits on the five §7 receipts; draft only.
