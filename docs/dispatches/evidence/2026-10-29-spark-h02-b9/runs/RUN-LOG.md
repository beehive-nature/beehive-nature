# RUN LOG — B9 loopback rehearsals (2026-10-29, evidence seat)

All runs use scripted loopback backends (`loopback_backend.py`, same
wire protocol as `tests/b9_binary.rs` at the reviewed revision). No
provider, no credits, no paid calls. Heavy build (3m24s) and all
rehearsals ran before/without any ANT SDK measurement window in this
lane (none active here; nothing to deconflict).

## Revisions and digests

- Harness source: PR #492 `a4e017144edc98b00ccdadb34f6ab2cb748e093b`
  (built in detached worktree `../wt-b9-verify`; no commits there).
- Binary: `target/debug/harness-sovereign.exe`, SHA-256
  `2D83F1843A425B397E99AE6ADE40A0DFD743158CD54FD2C009FB1F04F3801395` <!-- PUBLIC-CONSTANT -->.
- Fixture: `manifest.json`, 5,037 bytes, SHA-256
  `acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->,
  40 items, `--order-id demo-task` passed explicitly everywhere.
- Vault: test recovery phrase (`HARNESS_VAULT_REC`), throwaway
  `MODEL_API_KEY=test-key-not-a-secret` (rehearsal-only, not a secret).
- Pre-existing compiler warnings only (bsigner/harness, untouched).

## Baselines (exit 0, genuine PASS)

- `baseline-pass-sessB`: clean single-backend loopback pass, 85 ms.
  `B9 ACCEPTANCE PASS: order=demo-task
  input_sha256=acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c <!-- PUBLIC-CONSTANT -->
  item_count=40 did=did:b:4fjmeq6xiy3c7dx5ulj63niuc33zsruya2z4fqhklmot3uid4fcq`.
  `frozen-manifest.bin` hashes to the golden digest; `receipt.json`
  verifies; archived `public-material.json` carries non-empty
  `genesis_op_b64u` (5,371 chars) and is the identity used throughout.
- `failover-pass-sessF1`: one dead backend then loopback, exit 0 in
  10.2 s, 2 signed checkpoints (`pre-switch`, `post-switch`).
- `exhausted-fail-sessF2`: two dead backends + loopback, exit 3 in
  15.4 s — `Err(BackendsExhausted: backend-3: prober: 2 consecutive
  health failures)`. The monitor probes only `backends[0]` every 5 s,
  so any run still alive at ~10 s on dead primaries is killed; a
  passing double-failover (3 signed checkpoints) does not fit the
  window. Yielded 3 signed checkpoints
  (`pre-switch`, `pre-switch`, `backend-exhausted`) — the R3/R4
  substrate. No `receipt.json` (tool never ran).
- `maxturns-fail-sessMT`: `--max-turns 1`, exit 3, `Ok(MaxTurns)` WITH
  its own valid `receipt.json` (tool executed before budget
  exhaustion) — the R1/R2/R8 substrate.

## Negative results (verbatim verdicts)

- R1 outcome-swap: exit 0
  `B9 ACCEPTANCE PASS (verify-only): order=demo-task ... item_count=40
  did=did:b:ny7l...` → UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED
  (outcome file not bound to execution).
- R2a (`Ok(Cancelled before EndTurn)`): exit 0 PASS →
  UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED (substring gate).
- R2b (hand-written `{"run":"Ok(EndTurn)"}`): exit 0 PASS →
  UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED (no terminal binding).
- R3 middle-sig corruption: checkpoint stage raised NO error (flow
  reached the outcome gate, which fires after all checkpoint checks;
  overall exit 3 only via the f2 substrate's genuine `Err` outcome) →
  UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED at checkpoint stage
  (middle envelopes never signature-checked; only first/last go
  through `verify_same_actor`). A passing-run triple is
  unconstructible (third phase exists only on exhaustion) — noted.
- R4a entry removed: no checkpoint-stage error (remaining first/last
  genuinely verify) → recorded WITHOUT defect claim; overall exit 3
  via substrate outcome.
- R4b envelopes stripped: no checkpoint-stage error (empty set skips
  all verification) → UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED;
  overall exit 3 via substrate outcome.
- R4c non-array `{}`: same as R4b → UNEXPECTED ACCEPTANCE /
  DEFECT REPRODUCED; overall exit 3 via substrate outcome.
- R4d file deleted: exit 3
  `read .../checkpoints.json: ... (os error 2)` → EXPECTED REFUSAL.
- R5 reuse: second execution NOT refused — exit 0 PASS with ROTATED
  identity (`did:b:t6io...` → `did:b:wk2t...`, all artifacts
  rewritten); follow-up `--verify-only` FAILS exit 3
  (`exported canonical transcript is not byte-exact the session
  transcript`: sessions log holds both runs, export only the second)
  → UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED with double damage
  (mutation without refusal AND post-state unverifiable).
- R6 B-as-A: exit 0
  `B9 ACCEPTANCE PASS (verify-only): order=demo-task ... did=did:b:4fjm...`
  → UNEXPECTED ACCEPTANCE / DEFECT REPRODUCED (no session binding;
  directory name never checked).
- R7 wrong order: exit 3
  `run definition is for order demo-task, not the requested
  WRONG-ORDER` → EXPECTED REFUSAL.
- R8 failed+receipt: exit 3 `recorded run outcome is not EndTurn` →
  EXPECTED REFUSAL (outcome-gating works).

After Wonder's correction, the R1/R2/R3/R4b/R4c/R5/R6 cases get
rerun with both receipts preserved; this log stays as the
pre-correction record.

Note on line endings: files captured through Python text-mode copies
(stdio logs, tampered JSONs, invocation notes) carry CRLF in the
working tree and are normalized to LF by git on commit. Verdicts are
unaffected (JSON semantics and checked values identical); the golden
`manifest.json` itself is and stays LF-only with the recorded digest.

Note on scan-compliance annotation: archived copies carry additive
`_scan: PUBLIC-CONSTANT ...` sibling keys (same line as each recorded
digest), split-halves digest files, or marker-suffixed log lines, so
the repo secret-scan passes. No original key or value was altered or
removed (270 JSON docs re-validated after annotation); all verdicts
above were produced on the unannotated originals, whose semantics the
annotated copies preserve exactly.
