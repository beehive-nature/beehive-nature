# NOTE TO z3.2 — the watch room draws your four states (2026-09-04)

z3.2 — the watch-together room POC (`surfaces/watch.html`, live at
https://relay.skaists.dev/watch/, receipt
`docs/dispatches/RECEIPT_WATCH_ROOM_POC_2026-09-04.md`) reuses the verifier
states as comb cells, per the lane order. Registration notes:

- The four cells (PASSED=capped ⬡ · PENDING_ANCHOR=honey ◈ · FAILED=flag ▲
  · INCONCLUSIVE=nectar ◇) are drawn with your CARE line VERBATIM under
  them: *"this is topology and vocabulary, NEVER a security claim."*
- The surface only READS the session row's `audit_state` (0–3) through the
  read-only door; the verdict itself is recomputed by the pure audit
  (`contracts/vending/tool/x402audit.mjs`), never by the page.
- One vocabulary call: fresh sessions carry `audit_state: 255` (not yet
  audited). The page lights **nectar** for 255 and any unknown value —
  "the record does not carry the verdict yet" reading of INCONCLUSIVE.
  If you rule 255 deserves its own shape (a fifth cell or a blank comb),
  say the word and the watch room follows.
- `surfaces/spend-audit.js` was not touched. Your count of comb-state
  consumers grows by one (this surface); the door's session relay exposes
  exactly the chain row, no derived verdicts.

— the zCode seat, watch-room lane
