# PROVENANCE — B9 evidence preparation (2026-10-29, Muse Spark H02 lane)

Status: PREPARED LAYOUT. No recorded run exists. Nothing below is a
run result; every run artifact slot is empty until the capture
procedure in `CAPTURE-PROCEDURE.md` is executed.

## Base

- Worktree: `C:\Users\travi\wt-muse-spark-h02-evidence`
- Branch: `spark/h02-evidence-2026-10-29` (own worktree, own branch)
- HEAD: `059e16f270adae824bf1b6980fc89f5fcdcf78ca` (fetched PR #492
  candidate, `spark/h01-acceptance-2026-10-29`)
- PR #492 base: `e36fde447446440916131a2b4dadd1eee3bcc7d0`
- Recorded via `git rev-parse HEAD` in this worktree after checkout.
- Owned subtree only: this evidence directory plus the lane dispatch
  `docs/dispatches/2026-10-29-muse-spark-h02-evidence.md`. Harness
  Rust modules, shared instructions and dependency manifests untouched.

## Governing specification (as found at prep time; superseded by ruling below)

- `B9-DEMO-TASK.md`: absent repo-wide at `059e16f27` (filename
  search, zero hits).
- `LEDGER-KEEP/` / `demo-task/task.md`: absent as file and directory
  (zero hits); the only reference was the comment at
  `crates/harness-sovereign/src/b9.rs:193` of that head
  (`b9.rs` blob `01e3134a4b2034b0d51f8d49b40356e406039d4e`), whose
  item schema counted newline records.
- At the ruling head `4613c22fa`, `b9.rs` was rewritten around the
  JSON contract (spec reconciliation doc block, JSON
  `count_manifest_items` returning `Option`, order-bound
  verification, `RunDefinition`, `b9_receipt` tool path): that head's
  contract governs, and this file's frozen fixture conforms to it.

## Discrepancy: manifest.json/biomass vs input.bin newline records

CLOSED by the LEAD RULING below: JSON governs; the newline-record
candidate is superseded and removed before any commit. (An
OPEN-discrepancy draft of this file existed in the working tree only;
no Wonder contact was ever found or fabricated.)

## LEAD RULING — B9 JSON CONTRACT (closed, 2026-10-29)

Decision closed by lead; no Wonder contact required. Authority: PR
#492 at `4613c22faad4d779a9abe8c474468615692e203a` ("close H01
acceptance — order-bound verified B9 through the real executable"),
the reconciliation in `docs/dispatches/2026-10-29-muse-spark-h01.md`,
and `crates/harness-sovereign/src/b9.rs` at that head: the manifest
is JSON; items are the elements of the top-level array or the
top-level object's `items` array; duplicates count; anything else
fails closed. LEDGER-KEEP's newline-counting rule and four-field
`result.json` are a separate task and do not govern this receipt.

Revision note: this worktree was staged from `059e16f27` (the PR
#492 head at prep time); the ruling cites the current head
`4613c22fa` (one commit ahead, `b9.rs` +320/-2 there, new
`tests/b9_binary.rs`). The frozen fixture below conforms to the
`4613c22` JSON contract, read from the object store before freezing.

Compatibility recheck (publish time): PR #492 head is now
`a4e017144edc98b00ccdadb34f6ab2cb748e093b` ("canonical bzDiD
identity, complete saved-run verification, isolated run evidence").
Its `b9.rs` retains the JSON item-counting contract verbatim
(top-level array or `items` array, duplicates included, fail-closed
otherwise; five-field receipt; order-bound verification), and its
executable exposes `--workdir` (default `runs/demo`), `--session`
(default `demo-1`), `--order-id` (execution default
`B9-DEMO-ORDER-1` — hence the explicit `--order-id demo-task`),
`--verify-only`, and isolated `runs/<session>/` evidence with
`frozen-manifest.bin`. The golden fixture is unchanged by harness
advance: 5,037 bytes, SHA-256 `acc9cb10…569c`, 40 items
(re-verified at publish).
Harness integration stays with Wonder; this lane owns fixtures,
evidence documentation and its dispatch only.

The earlier 133-byte / 7-item newline-record candidate
(`input.bin`, SHA-256 `56882888…fe7`) is SUPERSEDED and removed from
this directory. The discrepancy is CLOSED by this ruling.

## Frozen fixture (FINAL per ruling)

- `manifest.json`: 5,037 bytes, git blob
  `00828bb3c8bdd91c42a89545bf91aa3170126a5a`. A JSON object with an
  `items` array of exactly 40 clearly synthetic biomass records
  (`bio-syn-001` … `bio-syn-040`, `kind: synthetic-biomass`,
  rotating `SYN-PLOT-A/B/C/D` plots); entry 23 is an exact duplicate
  of entry 7, and duplicates are included in the count.
- Newline convention: LF only (zero CR bytes), UTF-8, single
  trailing newline. Reproduced byte-for-byte by rerunning
  `python make_manifest.py` (no randomness, no timestamps).
- Raw-byte SHA-256 (hashed from the stored bytes, never parsed and
  reserialized):
  `acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
  corroborated three ways: Python `hashlib`, `Get-FileHash`, and
  `certutil -hashfile` (all agree; recorded in session).
- Expected item count: 40, confirmed by the independent
  `check_manifest.py` (stdlib only; hashes raw bytes, parses a
  separate decoded copy solely to count `items` elements; does not
  invoke the production counting function): `MATCH`, exit 0.
- `EXPECTED.json` pins `order_id: demo-task`, the hash, count 40,
  5,037 bytes, and the runtime copy names (`input.bin`,
  `frozen-manifest.bin`): any runtime copy under those names must
  preserve these bytes exactly.
- Receipt contract (unchanged): `order_id`, `input_sha256`,
  `item_count`, `signature`, `did`; signed payload
  `<hash>:<count>:<order_id>`. Expected rehearsal `order_id`:
  `demo-task` — execution and independent verification must use this
  same pinned value.
- Private keys/credentials: none collected; none stored. The `identity/`
  slot takes only exported public material at run time.
- No vault phrases, key files or `keys/`/`nostr-keys/` directories in
  `runs/` (verified by content + directory scan at archive time).

## Execution record (loopback rehearsals, 2026-10-29)

- Harness: PR #492 `a4e01714`, built detached at `../wt-b9-verify`
  (no commits there); binary SHA-256
  `2D83F1843A425B397E99AE6ADE40A0DFD743158CD54FD2C009FB1F04F3801395` <!-- PUBLIC-CONSTANT --> <!-- PUBLIC-CONSTANT -->
  (pre-existing warnings only). Toolchain: cargo/rustc 1.98.1.
- Backends: scripted loopback (`loopback_backend.py`, same wire
  protocol as `tests/b9_binary.rs`); no provider, no credits, no paid
  calls. Every runtime's `public-material.json` archived with
  non-empty `genesis_op_b64u`, and verification used that runtime's
  identity throughout.
- Baselines archived in `runs/`: clean pass, single-failover pass
  (10.2 s, pre+post pair), exhausted fail (15.4 s, prober kill —
  monitor probes only `backends[0]`), max-turns fail with own valid
  receipt. `R1/R2a/R2b/R6` accepted (defects), `R3/R4b/R4c` passed at
  checkpoint stage (defects), `R4a` accepted without defect claim,
  `R4d/R7/R8` refused as required, `R5` mutated without refusal and
  left post-state unverifiable (defect). Full narrative + verbatim
  outputs: `runs/RUN-LOG.md` + per-case archives.
- After Wonder's correction, the accepted cases get rerun with both
  receipts preserved; this record stays as the pre-correction baseline.
