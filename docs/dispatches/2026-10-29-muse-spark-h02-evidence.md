# Dispatch: MUSE-SPARK H02 evidence preparation (2026-10-29)

**Lane:** Muse Code evidence-preparation seat (B9 contract + recording prep).
**Branch:** `spark/h02-evidence-2026-10-29` (own worktree
`../wt-muse-spark-h02-evidence`, staged from the fetched PR #492
candidate — never the shared checkout).
**Base:** HEAD `059e16f270adae824bf1b6980fc89f5fcdcf78ca`
(`spark/h01-acceptance-2026-10-29`); PR #492 base
`e36fde447446440916131a2b4dadd1eee3bcc7d0`.
**Ruling head:** PR #492 advanced to
`4613c22faad4d779a9abe8c474468615692e203a` during this lane; the
LEAD RULING (B9 JSON CONTRACT, closed 2026-10-29) cites it as
authority and the frozen fixture conforms to its `b9.rs`.
**Status:** FIXTURE FROZEN per ruling, committed below. No recorded
run (no live-run receipts exist; they attach only after an actual
run).
**Publish re-verification (2026-10-29, HEAD `eb3ac482a`):**
`manifest.json` 5,037 bytes, SHA-256
`acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
(Get-FileHash agrees), `check_manifest.py` MATCH exit 0, 40 items,
`order_id: demo-task`. PR #492 head re-fetched at publish:
`a4e017144edc98b00ccdadb34f6ab2cb748e093b` (unchanged; JSON contract
retained). Refusal matrix extended with R8 (failed run presenting a
valid receipt must refuse: outcome-gating, not receipt-gating).
**Execution (loopback, same day):** harness `a4e01714` built detached
(`../wt-b9-verify`, binary digest `2D83F184…3801395`); baselines +
R1–R8 executed via scripted loopback, archived in `runs/` with
`RUN-LOG.md`. Accepted: R1, R2a, R2b, R6 outright; R3/R4b/R4c at
checkpoint stage; R5 mutated without refusal (post-state
unverifiable). Refused as required: R4d, R7, R8. R4a accepted without
defect claim. Golden fixture unchanged throughout.

## 1. Governing specification

- `B9-DEMO-TASK.md`: absent repo-wide (filename search, zero hits).
- `LEDGER-KEEP/` / `demo-task/task.md`: absent as file and directory
  (zero hits). Sole reference is the comment at
  `crates/harness-sovereign/src/b9.rs:193`.
- Governing contract: `crates/harness-sovereign/src/b9.rs`, git blob
  `01e3134a4b2034b0d51f8d49b40356e406039d4e`.
- Item schema: split raw bytes on `\n`, strip one trailing `\r` per
  part, drop empty parts (incl. final terminator), duplicates count.

## 2. Discrepancy (CLOSED by LEAD RULING, 2026-10-29)

JSON governs — no Wonder contact needed; none was found (memory, H01
dispatch, `inbox/` all empty of a channel) and none is fabricated.
The ruling cites PR #492 at `4613c22fa`, whose rewritten `b9.rs`
(counts elements of the top-level array or `items` array, duplicates
included, fail-closed otherwise) matches the handoff's JSON/biomass
shape. LEDGER-KEEP's newline rule and four-field `result.json` are a
separate task. The 133-byte newline-record candidate is superseded
and removed before commit.

## 3. Frozen fixture (FINAL per ruling)

`docs/dispatches/evidence/2026-10-29-spark-h02-b9/`:
`manifest.json` (5,037 bytes, blob
`00828bb3c8bdd91c42a89545bf91aa3170126a5a`), `make_manifest.py`
(byte-exact regenerator), `EXPECTED.json`
(`order_id: demo-task`, 40 items), `MANIFEST.SHA256`,
`check_manifest.py` (stdlib-only independent checker),
`PROVENANCE.md`, `CAPTURE-PROCEDURE.md`, `DEPENDENCIES.md`
(dependency-removal matrix + version/provenance table), empty
`transcripts/`, `checkpoints/`, `identity/`, `timing/`,
`recording/` slots.

- Content: JSON object with an `items` array of exactly 40 clearly
  synthetic biomass records (`bio-syn-001`…`bio-syn-040`); entry 23
  exactly duplicates entry 7; duplicates are included in the count.
- Newline convention: LF only, UTF-8, single trailing newline.
- Raw-byte SHA-256 (stored bytes hashed directly, never parsed and
  reserialized):
  `acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
  (Python hashlib + Get-FileHash + certutil agree).
- Item count 40, confirmed by `check_manifest.py` (exit 0, MATCH),
  independent of the production counting function. Receipt contract
  and signed payload `<hash>:<count>:<order_id>` preserved; expected
  rehearsal `order_id` is `demo-task`.

## 4. Properties checked (prep-level, code-reading — not a run)

- Decentralization: `verify_receipt` / `accept_completed_run` are pure
  local crypto over frozen bytes + exported public material; no server
  database, no network, no telemetry in the B9 path.
- Custody: signing goes through `IdentityHook::checkpoint` (local
  bSigner keys); only `did`/`alg`/`verifying_key_b64u` are exported.
  No private keys or credentials collected or stored.
- Payer: B9 verification is separate from economic settlement (settle
  lane); payer/budget/usage capture is procedure §7, unfunded so far.
- Resources: fixed 5,037-byte manifest; single-pass count; no
  unbounded allocation. Dependency-removal matrix + version table in
  `DEPENDENCIES.md`: zero dependency changes, fully offline freeze.

## 5. Goals vs demonstrated results

10 billion users and 1,000 years of continuity are GOALS, not
demonstrated here: this prep freezes one 7-item manifest and one
procedure. SAME ACTOR (`verify_same_actor`: same key, recomputed DID
binding, complete-message continuation) proves key continuity only —
it must NOT be labeled unique-human verification.

## 6. Recording procedure

Per `CAPTURE-PROCEDURE.md` §§1–8: provenance, frozen input,
pre-exported identity, pre/post transcripts + signed checkpoints,
receipt accepted only via `accept_completed_run`, real fault/backend
timing, authorized payer/budget/usage from provider receipts, screen
recording with labeled event replay. Blockers: hosted checks green on
the exact candidate head + two backends verified by live provider
calls. No paid calls, no new server database, no centralized
telemetry, no fabricated PASS.
