# ORDERS-1 — OR Roster & Standing Orders

**Version:** v0.4 · **Status:** ratified @ c14226f · amended by this commit
**Scope:** seat roster, model pins, per-seat marching orders, shift rhythm, re-pin procedure
**Inherited law:** relay-of-record · sole-tree-pusher · one file per prompt with acceptance criteria · channel law (card first, fenced chunks second) · Convention v2.2 verifier states · no re-opening banked decisions without new evidence

---

## §1 Model Pin Table

*The only section in this document where model identifiers appear. All orders below bind to seats, never models — pins rotate without doctrine changes.*

| # | Seat | Callsign | Primary pin | Escalation pin | Meter |
|---|------|----------|-------------|----------------|-------|
| 0 | Attending Code Surgeon | King Bee | wetware | — | attention (non-fungible) |
| 1 | Surgeon Fellow | Fable | Claude Fable 5 (claude.ai) | — top of judgment chain | Anthropic Max |
| 2 | Resident Surgeon | zResident | GLM 5.2 (chat) | defers to Seat 1 at window-open | GLM Pro |
| 3 | Chief Surgical Code Tech I | Claude Code | Opus 4.8 (primary) | Opus 4.8 (`/model opus`), judgment-class files only | Anthropic Max |
| 4 | Surgical Code Tech II | Lovis Lobster | GLM Code 5.2 via openclaw | — | GLM Pro |
| 5 | Chief Surgical Nurse | Cowork | app default (Fable-class) | — | Anthropic Max |
| 6 | Pathologist | zPATH | GLM 5.2 | — | GLM Pro |
| 7 | Anesthesiologist | Design | app default | — | Anthropic Max — slack-only, art direction |

**Judgment-class files (Seat 3 escalation trigger):** crypto seams, escrow/state machines, invariant-bearing code (TE-x, §9.2 guards), anything adjacent to banked architecture. All other files run the primary pin.

**Re-pin procedure:** edit the row, commit. One-line diff, no other section changes.

---

## §2 Doctrine

1. Scarcest pool gets judgment; abundant pool gets volume.
2. The tree is the bus. Dockets and results move by commit + raw URL + sha256, never by inbox.
3. Done = a passing test or a written record. Never "the spec looks right."
4. "Approved" attaches to a sha, never to a session — session output is scratch until committed.
5. Dispatch constants are memory; the artifact's frozen manifest is record — gates key to the manifest.
6. Digests prove integrity, never authority — no seat delegates execution judgment to a document.
7. The firehose is publish-once — deletion is repo hygiene, not unpublishing; test records must be safe-to-be-permanent by content.
8. Hash at the source, before transport — a digest computed downstream of a pipe certifies the pipe.
9. A suite never ships its own oracle — the assertion target must be product code that can lose.

---

## §3 Marching Orders by Seat

### Seat 0 — Attending Code Surgeon (King Bee)
**Do:** set priority; make founder-gate calls (AUTO-1 governed class, overrides, contested judgment); verify heads by `git ls-remote` / `git rev-parse`, never from narrative prose; ratify by commit.
**Don't:** carry packets between seats; sit in the loop on automatable steps.
**Surfaces to you when:** a founder gate fires, a verifier returns MISMATCH-PP, or Seats 1 and 2 diverge on a call.

### Seat 1 — Surgeon Fellow (Fable)
**Do:** dispatch by docket written to the tree — one phase, one owner, one file, explicit acceptance criteria; frame founder gates as options + recommendation; synthesize audits into go/no-go; fresh session per phase, short sessions.
**Don't:** bulk reads, mechanical edits, or long exploratory threads on the Max meter; re-open banked decisions absent new evidence.
**Escalates:** anything gate-class → Seat 0.

### Seat 2 — Resident Surgeon (zResident)
**Do:** hold dispatch while the Max window is locked — triage, stage dockets, queue Seat 4 work; render second opinions on Seat 1 calls, logging divergence as diagnostic signal; hand back at window-open with a delta report against the tree head.
**Don't:** push; close founder gates; overwrite a committed Seat 1 docket (append, never overwrite).
**Escalates:** divergence with Seat 1 → Seat 0, both positions with cited lines.

### Seat 3 — Chief Surgical Code Tech I (Claude Code)
**Do:** sole tree-pusher — the law stands; execute the docket as written; commit checkpoints immediately; run `cargo test` — the only reviewer left whose opinion matters; review and land Seat 4 branches; escalate model per §1 on judgment-class files only.
**Don't:** design; add unsolicited features — scope-defense applies: "That is out of scope. Execute the prompt as written."; push anything that has not met the compiler.
**Escalates:** acceptance criteria unmeetable as written → back to Seat 1 with the failing case.

### Seat 4 — Surgical Code Tech II (Lovis Lobster)
**Do:** bulk execution on the GLM meter — scaffolds, boilerplate, first-draft tests, mechanical refactors, long reads, implementation of settled visual identity under Seat 7 art direction; fetch dockets from the public repo by raw URL and verify sha256 before starting (channel law: the GLM channel strips attachments — no pasted payloads, ever); deliver as a pushed `seat4/<docket>` branch — review input only; no delivery branch is law until Seat 3 merges it.
**Don't:** push to `main` or merge any branch; touch banked architecture; accept payloads over chat.
**Escalates:** docket digest mismatch → stop, report, wait.

### Seat 5 — Chief Surgical Nurse (Cowork)
**Do:** batched research dockets — one per window, scoped question, defined deliverable, cited sources; multi-tool synthesis only.
**Don't:** free-run errands; gather what a plain public-web read can answer (route that to Seat 6 or Seat 2).
**Escalates:** findings touching a launch gate (R-00x class, peg monitor) → Seat 1, flagged for Seat 0.

### Seat 6 — Pathologist (zPATH)
**Do:** read everything, operate on nothing; audit committed heads at pinned sha via raw URL + digest; report in verifier states (MATCH / UNCOMPUTABLE / MISMATCH-PP) and 0/0/0 format; run adversarial passes on spec ↔ code seams.
**Don't:** propose features — findings, not features; audit uncommitted prose; accept a specimen without a digest.
**Escalates:** any MISMATCH-PP → Seat 0 direct, halt-class.

### Seat 7 — Anesthesiologist (Design)
**Do:** keep the patient stable — art direction, palette compliance (teal-forward, green→teal→purple mandala), design review of Seat 4 visual output; deliver direction as committable assets.
**Don't:** run during push-critical windows; implement settled identity (volume work — routes to Seat 4); introduce off-palette variants.
**Escalates:** brand or identity questions → Seat 0 (identity is founder-class).

---

## §4 Shift Rhythm

**Window OPEN — Claude shift:** Seat 1 dispatches → Seat 3 executes and pushes → Seat 0 makes gate calls. Seats 5 and 7 run only if the window has slack after pushes.

**Window LOCKED — GLM shift:** Seat 4 executes the queued dockets → Seat 6 audits the last committed head → Seat 2 stages the next cycle.

**Shift change:** the incoming seat reads the tree head + STATUS.md, never chat scrollback. The rate limit is the shift bell, not a stall.

---

## §5 Acceptance Criteria (this document)

- [ ] Model identifiers appear in §1 only (grep-verifiable).
- [ ] Every seat carries orders, prohibitions, an escalation trigger, and a meter.
- [ ] A re-pin is a one-line diff.
- [ ] Committable as-is; ratification = founder commit.

---

**Changelog:**
v0.4 — Seat 3 re-pinned: escalation pin promoted to primary (§1 table); effective 2026-07-11 (founder-authorized).
v0.3 — delivery-law amendment (seat4/* push, Seat 3 sole merger); doctrine 4–9 from the D-001/D-002 laps (founder-ratified 2026-07-11).
v0.2 — Seat 7 re-pinned to art-direction/slack-only; settled-identity implementation routed to Seat 4 (founder cost flag, 2026-07-11).
