# /fleet/lab/ — the ruled placement for the operator tools

ORDER FLEET-2 item 2 layout. Files destined here when Seat 1 rules the move:

- blend-lab.html · flower-lab.html · spliff-lab.html · intake-tracker.html ·
  edible-tracker.html · bnr-dashboard.html

SAME ORIGIN is the law that decided this grouping: bnr-dashboard.html reads the
other tools' localStorage at runtime — the full census (FLEET-2):

| key family | written by | read by |
|---|---|---|
| `bnIntake_*` | intake-tracker | **bnr-dashboard** |
| `bnRDI*` | intake-tracker | **bnr-dashboard** |
| `bnSessions*` | flower-lab | **bnr-dashboard** |
| `bnBaseline` | edible-tracker | edible-tracker (self-contained) |
| `bnEdibleSessions` | edible-tracker | edible-tracker (self-contained) |

localStorage is per-ORIGIN, not per-path: /fleet/lab/ and /fleet/gallery/ on one
GitHub Pages origin share the bus; a different origin (or a file:// split under
some browsers) kills the dashboard's reads **silently — nothing errors, the
aggregates just read empty.** Keep every fleet surface on one origin.

Nothing has been moved into this directory yet — placement executes on Seat 1's
word. Fleet HTML stays verbatim, forever.
