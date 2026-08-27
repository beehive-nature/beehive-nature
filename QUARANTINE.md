# QUARANTINE — do not build in this branch, do not merge it

**`lane/zB-lostname` is quarantined by founder order, 2026-08-26.**

> "DO NOT MERGE lane/zB-lostname. Not 5a3a634, not 5e6af50. That branch carries
> the reversed name repoints."

## Why

Both commits on this lane repoint the estate's default identity away from
**`bloverai.base.eth` / `0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876`**, which is
**THE DEFAULT EVERYWHERE** and remains so:

| commit | what it repoints |
|---|---|
| `5a3a634` | `gallery.html` default wing → `bqueenbee.base.eth`; `profile.html` default address → `bqueenbee.base.eth`; `farmers.html` and `market.html` `LOV` → `0x100fd362…` |
| `5e6af50` | relabels those already-repointed defaults as "bQueenBee's Lost Purse" |

The lane also argues in prose that `bloverai.base.eth` "was lost with its wallet
key" and may "never be presented as the founder's again". **That reading is not
in force.** The default is unchanged.

**bQueenBee's Lost Purse is a NAMED EXHIBIT, never a default.** It exists on
`main` as an extra button and an extra rung on the holders' ladder in
`inscription-explorer.html`, standing beside the founder's garden — which keeps
first position in both, because that is what "never a default" means in markup:
whatever loads when nobody has chosen is unchanged.

## What was salvaged, and where it lives now

Nothing here needs to be merged. The engineering was lifted onto a clean lane
cut from `main` and has landed:

- the **Multicall3 person-scan engine** — `surfaces/blight/profile.html`
- **adaptive chunking + the forward-only cache** — same file
- the **registry-walk fallback in `resolveName`**, and **`start()` resolving a
  name before `balanceOf`** — `surfaces/blight/gallery.html`
- the **Lost Purse** as a named exhibit — `surfaces/blight/inscription-explorer.html`

Two corrections worth carrying forward, because the order was written from the
commit subjects rather than the diffs:

1. **The two gallery fixes are in `5a3a634`, not `5e6af50`.** `5e6af50` touches
   `gallery.html` by exactly two lines, and both are the rename. The
   registry-walk fallback and the resolve-before-`balanceOf` ordering are
   tangled into the repoint commit, and were lifted out of it by hand.
2. **`5e6af50`'s `profile.html` cannot be taken wholesale.** This lane forked
   before `main` gained the address book, so checking the file out deletes that
   feature — measured at −274 lines against `main`. Only the lane's own delta
   (`git diff 5a3a634 5e6af50`) may be applied, minus the chip-rename hunk.

## The rule

Do not branch from here. Do not cherry-pick from here without re-reading this
file. If something on this lane is wanted, lift the hunk onto a fresh lane cut
from `main` and prove afterwards that no repoint value survived:

```
grep -nE "['\"](bqueenbee\.base\.eth|0x100fd362[0-9a-f]*)['\"]" surfaces/blight/*.html
```

That grep must return nothing but exhibit rows in `inscription-explorer.html`.
A mention of the name inside a comment explaining the ban is not a repoint; a
mention inside quotes, as a value a surface loads, is.
