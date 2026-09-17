# CACHE SELF-HEAL — RED→GREEN · 2026-09-17

**Order (founder):** *"stale refusal cached → re-mint → next request must self-heal without process restart."*

**Root cause (from AV-2 drill diagnosis):** Node's default HTTP agent pools connections; a reused socket can serve a stale admission response after the serve's rate_set changes underneath.

**Fix:** `agent: false` on the admission probe's `http.get` — one line, forces a fresh connection per probe. The null-cache path already re-fetches correctly by construction; the fix removes the last silent-staleness vector.

**RED receipt (live, on-box):** forced stale rate_set (minted_at backdated 400s) → request through gate→llama = **503** (correct fail-closed refusal).
**GREEN receipt (live, on-box, NO process restart):** re-minted rate_set → request through gate→llama = **200**.

Commit `0f718286`. Availability defect, not money-safety (direction was fail-closed throughout the bug's lifetime).
