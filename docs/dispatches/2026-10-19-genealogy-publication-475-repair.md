# 2026-10-19 — issue #475 repair: stack inventory regenerated; `gp resolve` fails closed

Issue #475 (founder-filed, source-verified against `345fc7edb`): (1) the
`tests/static` job failed because adding the crate changed the workspace
inventory without regenerating `surfaces/stack.html`; (2) `gp resolve`
read the state and index and returned the index's page hashes without
verifying the seal it reported — a modified local index could mint a
plausible record; (3) rails wording must stay bounded; (4) census must
refuse symlinks/non-regular files. This lane is the one tested
integration fix; nothing else moved — no pages, no studio content, no
harvest, no upload, no spend.

## §1 — stack inventory (the CI red)

`node scripts/build-stack-inventory.mjs` regenerated in this seat's
isolated worktree: `surfaces/stack.html` diff is exactly the crate-count
row (`84 → 85 workspace crates`) and the member list. Checks green:
`build-stack-inventory.mjs --check` ({"components":24,"workspaceCrates":
85,"mode":"checked"}), `build-stack-surfaces.mjs --check` (130/121/9),
`build-keychain.mjs --check` ({"keychain":"pinned","vendor":3}). No other
surface touched; the registration ritual does not apply (generated file
rider, no surface added or moved).

## §2 — the resolver trust boundary (fail closed, pinned root, preview)

`resolve` now verifies before it reports, in order:
1. **Pinned root** — `--expect-state-sha <hex>` (from a channel outside
   the mutable pair: git commit, signed .b binding). Mismatch refuses:
   `pinned-root mismatch: pin …, local state hashes d8666b9c… — refusing`.
2. **Index↔state binding** — `index.stateSha256 == sha256(state bytes)`,
   computed, never the index's self-claim. Tampered stateSha256 →
   `index not bound to the state beside it … tampered or stale index`.
3. **State↔index agreement** on the person's page digests. Tampered
   person hash with intact stateSha256 → `index/state disagree on page
   digests for p3d44ccaffd: html index fff…f vs state 785fb579…`.
4. **Disk truth** — both page digests recomputed from the files. Page
   tamper → `page bytes drift: persons/p3d44ccaffd.html state says
   785fb579…, disk hashes 0ed40606… — failing closed`.
5. **`--preview`** — untrusted inspection mode: proceeds past drift,
   visibly labeled `"mode": "preview-untrusted"` with the drifts in
   `warnings[]` and `pageDigestsRecomputedFromDisk: false`. Never a
   verification.

Output is now schema `…-resolve/2` with a `verification` block
(pinnedRootChecked / indexBoundToState / stateIndexAgreeOnPerson /
pageDigestsRecomputedFromDisk) and an honest `trustRoot`:
`"unpinned-local"` with the explicit warning that a full local rewrite
would self-verify (a local self-hash is not anchor authentication —
issue wording kept verbatim in intent), or `"pinned"` when the pin
channel supplied the root. The `--bname` anchor note now states it is an
unregistered demonstration anchor — address FORM validation only.

## §3 — bounded wording

`RAILS` roles rewritten to "declared rail — name only, no fetch route in
this crate" (github-pages bootstrap / adapter-arweave / adapter-autonomi
/ ops/x0x). No retrieval is claimed; the note repeats: verify page
digests against the pinned stateSha256 after any fetch.

## §4 — census hardening

`census_persons` checks `file_type()` before reading: symlinks are
refused (`symlink refused: <name>`), non-regular files refused by name —
no hashing outside-tree bytes. Negative control attempts a real symlink
to an outside file; on hosts that refuse unprivileged symlink creation
(this Windows box) it prints the deferral and returns — CI's ubuntu
runner creates it and exercises the refusal.

## Evidence

- `cargo test -p genealogy-publication`: **10/10** — the 5 original
  controls plus tampered-index-page-hash, tampered-index-stateSha256,
  page-drift fail-closed + preview labeling, pinned-root mismatch/match,
  symlink refusal.
- Real corpus: `gp check` green, findings 0, artifacts BYTE-UNCHANGED
  (state still `d8666b9c…` — the defect was resolve's verification, not
  the seal's shape; no rebind needed). Real resolve:
  `"mode": "verified-local"`, `indexBoundToState: true`,
  `pageDigestsRecomputedFromDisk: true`, trustRoot honestly
  `unpinned-local` absent a pin. All three tamper scenarios above were
  executed against the real corpus and refused with the named errors;
  `git checkout` restored; final check green.
- Working tree at commit: only `crates/genealogy-publication/src/{lib,
  main}.rs` + the regenerated `surfaces/stack.html` + this dispatch.

## Boundaries unchanged

Buzz studio = content owner; FamilySearch acquisition lane stays closed
(refusal intact, zero requests this wake); rails stay declarations until
the adapters/x0x own fetch routes; `.b` registration and IQ.wiki remain
founder gestures; the dApp must not call any resolution authenticated
until it pins the root out-of-band.

Closes #475.
