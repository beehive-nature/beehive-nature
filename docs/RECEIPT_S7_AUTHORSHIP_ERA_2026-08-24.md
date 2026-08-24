# RECEIPT — ORDERS-1 §7 authorship: the unenforced-clause era

**Founder-ordered record, 2026-08-24. Measured by cc1 (lane/cC, gate seat).**
Purpose: so a future reader does not rediscover this as fresh and infer that
someone bypassed a gate. Nobody did. There was no gate.

## The boundary comes from the artifact, not the index

    49803b9  2026-08-07T16:17:57-06:00
    "ratify: ORDERS-1 v0.8 — authorization clause in force from this commit"

§7 is in force **from 2026-08-07**. `CLAUDE.md` §1 recorded 2026-08-05; corrected
to match the commit, on the same rule that settled proto v0.3 — the artifact is
the receipt.

## The count

Of ~921 commits in the repository, **111 are authored under a machine-seat
identity** — roughly one in eight.

| era | commits | status |
|---|---|---|
| before 2026-08-07 | **14** | lawful — predate the clause |
| 2026-08-07 onward | **97** | contrary to §7 |

Split verified against **both** author date and committer date; the two agree
exactly and no commit straddles the boundary, so backdating does not explain it.

| identity | commits | note |
|---|---|---|
| `zCode (GLM 5.3)` | 72 | across two emails, one fabricated-domain |
| `goose` | 11 | fabricated domain |
| `zCode-R (GLM 5.3)` | 10 | |
| `Seat 3 (Claude Code)` | 7 | pre-§7; founder's real email, seat display name |
| `Lovis Lobster` | 6 | pre-§7; **fabricated domain** — not a founder variant |
| `bGoose` | 3 | founder's real email, seat display name |
| `Seat 1 (Fable)` | 1 | pre-§7 |
| `Claude` | 1 | committed by `zCode (GLM 5.3)` |

Three identities use a fabricated domain — `goose@beehive-nature`,
`lovis-lobster@beehive-nature`, `zcode@beehive-nature.local` — which is the exact
precedent §7 exists to end.

## It is not a bypass

All 97 are already public in `origin/main`. §7 shipped as ratified text with **no
enforcement mechanism**: no hook, no gate, no check. Five seats worked for
seventeen days under their own identities because nothing ever refused one. Read
this as an unenforced clause, not as circumvention, and not as a pre-rule era —
92% of these commits postdate ratification.

## Disposition: not rewritable

Standing law 10 — fix forward, never rewrite public history. Rewriting 97 commits
across seventeen days would invalidate every hash in every receipt this estate has
issued, including the fleet preservation digests and the push receipts. The record
is corrected here, in place.

## The permitted form, for the avoidance of doubt

Author is the founder; the seat is credited in the body:

    Author: loVis waTer <loviswater44@gmail.com>
    Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

A real domain, a permitted trailer, no `Signed-off-by:` under a machine identity.

## RULED, 2026-08-24: enforce as written, no amendment

§7 stands. Practice conforms to the clause, not the reverse.

- **The enforcement point is a CI check on the pushed range.** It is the only
  place that reaches every clone. The 76-commit majority of the post-§7 era was
  authored outside this box, which is exactly why a local mechanism cannot be the
  answer.
- **`.githooks/pre-commit` is advisory only.** It is `--no-verify`-able and it
  reaches only trees configured on this machine. Ship it, but a hook alone is
  never to be described as "enforced" — saying so would be a signal prettier than
  the truth.
- **The compliant form is already in use** and is recorded above: author is the
  founder, the seat credited by `Co-authored-by:`, a real domain, and no
  `Signed-off-by:` under a machine identity.

Nothing above this line is rewritten. The 97 stay as they are, public and
unaltered, under standing law 10.
