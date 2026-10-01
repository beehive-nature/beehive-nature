# bViEw relay fallback: preserve the first resumed playhead

PR #284 shipped browser-direct Autonomi range playback. Its complete combined-tree CI (36813197754 plus scan 36813197748) passed, and Pages run 36814625671 deployed merge faccefae33e68cc3aca30b0c708209cf4796a3c1. All 31 public runtime artifacts matched the tested bytes. A fresh owned Chrome profile played the public Mandelbrot demo to its full 12-second end through real WebRTC with zero relay requests or page errors; the user's personal playlist was untouched.

Production follow-up injected a media error after seeking to 4.2 seconds. The real relay recovered, but its progressive preview reset the saved playhead to zero. The earlier test asserted only that playback eventually reached four seconds, which masked the restart. A separate harness typo waited for the path label `relay`, although the real label is `stream`; that timeout is not counted as a pass.

The cure removes the preview's unconditional zero seek and `keepAt` reset. The existing start-budget planner retains the saved target and waits for media there. Normal new-video starts still initialize `keepAt` to zero in `view`; no buffering rule or CI threshold is weakened.

The strengthened decoder-error case delivers the real VP9 fixture progressively through an owned local HTTP server and records the **first** relay `playing` event. It requires that first playhead to be at least four seconds. Before the fix: 1 test, 0 pass, 1 failure, exit 1, 3595.8693 ms; assertion output: `the first resumed frame must retain the playhead, not restart and eventually reach it`. After: 1 test, 1 pass, 0 failures/cancellations/skips, exit 0, 3091.385 ms.

The first fetch raced another checkout updating the shared remote-tracking ref (`cannot lock ref ... expected da75846c3...`); a fresh fetch succeeded, and this own-worktree descendant starts from merged main. No force or shared-checkout staging was used. Final suite, CI, Pages and public first-resumed-frame receipts follow in the PR description.

Relay remains default. Direct retrieval is not viewer seeding, an ANT/x0x node, bzDiD wallet integration, or private playlist sync. The large-video field stall remains an unresolved delivery observation, not a claim of large-scale capacity.

Final local direct + bViEw regression suite: 22 tests, 22 pass, 0 failures/cancellations/skips, exit 0, 134325.767 ms. Includes the strengthened first-resumed-playhead assertion, slow/fast doors, interrupted delivery, seek, stable direct URL, client reuse and watchdog policy.
