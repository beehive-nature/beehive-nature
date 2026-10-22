# 2026-10-19 — the blood seal reader: the dApp verification and retrieval layer

Founder order (after #475 closed): "the next substantive deliverable is
the dApp verification and retrieval layer — consume the sealed index,
obtain a trusted root independently, verify fetched content before
rendering, and support GitHub bootstrap with Arweave, Autonomi and x0x
as independently qualified adapter routes. Missing or corrupted bytes
must fail closed, not silently fall back to an unverified page."

Delivered: `surfaces/blood-seal.html` + `surfaces/blood-seal.js` — a
reader whose one law is AN UNVERIFIED BYTE NEVER RENDERS.

## How it works

- **Rails** — a registry with qualification gates: GitHub Pages bootstrap
  (same-origin static fetch of the committed corpus) is the one
  qualified rail today; Arweave, Autonomi and x0x are declared rails
  whose browser routes are not yet qualified — they are labeled exactly
  that on the page and in code, and attempting one is a named refusal
  (`route-not-qualified`), never a silent skip.
- **The trust boundary** — the root pin: sha256 of
  `publication-state.json`, pasted (or linked) from a channel no rail
  controls — the committing git history or the lane dispatch, never a
  fetch. With a pin: state is fetched, re-hashed, and compared; a rail
  serving anything else is recorded in the reading log and the next
  qualified rail is tried — the pin, not the rail, decides what is
  sealed. Without a pin: the reading is labeled CONSISTENCY ONLY /
  untrusted with the explicit warning that a full local rewrite would
  self-verify; it never says "verified."
- **Verify-before-render** — for the requested person the reader checks,
  in order: state hash vs pin → index↔state binding (recomputed, never
  the index's self-claim) → state↔index agreement on the person's page
  digests → BOTH page files fetched and re-hashed against the state.
  Only then does the page render — into a sandboxed iframe
  (`sandbox=""`, no scripts, no same-origin). Every refusal is named
  (`pin-mismatch`, `index-not-bound`, `digest-disagreement`,
  `page-drift`, `person-unknown`, `fetch-failed`,
  `secure-context-required`); the reading log shows each rail attempt.

## Evidence

- Hermetic e2e `e2e/blood-seal.test.mjs` (fixture corpus in the seal's
  own schemas, real digests, real surface files served from a throwaway
  root; wired into the tests workflow after the arweave-status step,
  YAML-validated): **green, 6 gates** — (A) three declared-unqualified
  rails visible; (B) correct pin → VERIFIED + card + the page rendered
  with srcdoc set ONLY after verification; (C) tampered page bytes →
  FAILED CLOSED `page-drift`, srcdoc null; (D) wrong pin → FAILED CLOSED
  `pin-mismatch`, srcdoc null; (E) no pin → CONSISTENCY ONLY, the word
  VERIFIED absent, warning visible; (F) unknown person → FAILED CLOSED,
  srcdoc null.
- Real-corpus smoke on this box: the real surface against the real seal
  (pin `d8666b9c…`) verified person `p3d44ccaffd` — "Jack Benedum
  Sutphen · 1920–1982" — and rendered the page only after digest
  verification.
- Registration ritual in this same commit: rows in both registries
  (`surfaces/estate.json` + root `estate.json`, org beehive-nature,
  family beehivenature, LIVE), `node scripts/build-atlas.mjs` output
  (122 listed · 113 counted), the `surfaces/review.html` SURFACES
  entry, and `estate-check.mjs` PASS.

## Honest boundaries

- One qualified rail today (GitHub bootstrap). The adapter rails fetch
  nothing here; their qualification is separate work (adapter-arweave /
  adapter-autonomi / ops/x0x browser routes), each to be independently
  qualified before its rail flips to qualified.
- The page wears skaists tokens by construction and mounts register.js
  (three registers), but is NOT yet on `skaists-conformance.mjs`'s
  `--only` list — token discipline is unmeasured until that pass adds
  it. Chrome is English-only (stack.html precedent, visible note).
- No .b anchor registration, no ANT upload, no IQ.wiki — founder
  gestures unchanged. Zero FamilySearch requests; the studio's content
  untouched.
- The pin protects reading integrity; it does not authenticate the
  corpus's provenance (that is the .b/signed-binding future seam).

NEXT OWNER: adapter-route qualification (arweave/autonomi/x0x browser
fetch + digest verify through this same layer); conformance pass for
this surface; the .b anchor binding when the founder registers one.
