# THE STRANGER WALK — 91 surfaces, cold, 390px · 2026-08-30

**Method:** fresh context per surface (no storage, no wallet, no prior visit), live site.
**The one repair made in pass:** stack.html organ board `T_` ReferenceError (collision orphan) — fixed `@646108e`.

## THE RANKED TEN (strangers affected × unnecessary-ness)

| # | surface | first stop | load-bearing? | dead end? | jargon fold |
|---|---|---|---|---|---|
| 1 | stack.html (board) | T_ ReferenceError — unlabeled rows | no | **was** — fixed | 0 |
| 2 | blight/index.html | "connect wallet" before the fleet | no — reads are keyless | no | 1 |
| 3 | blight/workbench.html | Connect before the read tools | half (sign only) | no | 2 |
| 4 | review.html | passkey section opened the page | reading needs nothing | no | 2 |
| 5 | wallet.html | bzDiD creation + 4 jargon words in fold | yes (custody door) — words wrong | no | 4 |
| 6 | museum.html | 2 seal frames degrade (base.org art 404) | no | honest fallback | 0 |
| 7 | bnames.html | registry table silently empty on RPC fail | live-read honest, silence not | partial | 1 |
| 8 | festival/index.html | "no wallet" in fold | actions yes, lineup no | no | 1 |
| 9 | doors/beehivenature.html | 5.7s first load (walk); re-measured 203–378ms — cold-cache outlier, no cut needed | — | no | 0 |
| 10 | bantfarm/bmeshasi.html | dials silently empty on RPC fail | same as #7 | partial | 1 |

## Fixed this pass (landed @4a79b58)

CLASS 1: blight/index connect moves below the fleet grid; workbench Connect leaves the read-tools bar, labeled "Connect wallet — only for signing"; review.html re-ordered — the tally deck renders first, sections renumbered, compose labeled "sign in to add yours".
CLASS 2: the three chain-read pages now say "couldn't reach the chain from your network — the page is fine, the data isn't loading" and name public-endpoint blocking as a cause.
CLASS 3: wallet fold rewritten in bee register ("your keys stay in this tab only — gone when you close it"); door re-measured — no cut needed.

## The gate

`e2e/no-page-errors.mjs` — walks all 91 live surfaces fresh, fails on ANY page error (the T_ class). Caught 3 apostrophe SyntaxErrors in this lane's own strings before landing. CI step added after university smoke.

## Comparison

nostr.com: ~60s, one click + OAuth — a custody trade we would not make. We still lose on three doors (now fixed). 80+ surfaces passed the walk with real content in the first fold and zero stops.
