# DOCKET k002 — K-D4 + K-D5 Seam Fixes (the two HIGH findings)

Authority: BIND-1 v0.1 (docs/BIND-1.md, sha c5025945…) · founder rulings on the k001 HOLD (2026-07-13) · Seat 3 k001 review (two HIGH findings, verified independently by Seat 1) · ORDERS-1 v0.7.
Repo: **beehive-nature/beehive-nature** (kernel).
Executor: Seat 4, **own kernel clone** (`C:\Users\travi\lobster\beehive-nature` — verify `remote -v` points at github.com/beehive-nature before starting). Delivery law: branch `seat4/k002` off the **NEW kernel main** (post K-D1→K-D3 partial merge — `6f70033`), push branch only, Seat 3 sole merger, red-first with EACH fix's marquee red witnessed, digests declared post-commit via **Git Bash/WSL sha256sum on stdin**.

**Scope: fix ONLY the K-D4 + K-D5 defects in `crates/sense-atproto/src/lib.rs`.** K-D1→K-D3 already landed on main and are out of scope. Do not touch the predicate, the Evidence types, or the EventType/SourceChain variants. Offline; no network, no credentials.

---

## K-D4 — corroboration must verify AGREEMENT and DISJOINTNESS (the check the comment claims but the code omits)

`witness()` currently counts every source that returns `Some` without comparing the records they return — the inline comment promises a CID-match check that the code does not perform, so two sources reporting DIFFERENT records still mint Confirmed/Settlement. Fix: before a source counts toward a grade, verify it **agrees on the record** (CID match — the predicate's step-2 logic) AND that corroborating sources are **disjoint** (distinct source labels). Two sources returning different records do NOT corroborate — the grade stays at the lower level.
**Marquee red:** two sources, disagreeing records → grade does NOT rise to Confirmed (currently it wrongly does).

## K-D5 — retraction must not overwrite an immutable Event

`retract()` inserts the retraction event with an unguarded `HashMap::insert`, so a retraction whose `event_id` collides with an existing event overwrites it — violating "the original stands immutable." Fix: guard the insert exactly as `ingest()` guards — a colliding `event_id` must NOT overwrite the existing event.
**Marquee red:** a retraction whose `event_id` collides with an existing event → the original event is unchanged (currently it is overwritten).

## K-D5 — retraction signer authorization

Neither `retract()` nor `process_retraction()` checks the retraction signer against the original record's owner — any signed DID can flag another DID's record. Fix: the retraction's `signer_did` must match the original crossed event's owner (`seller_did`); a foreign-DID retraction is refused.
**Marquee red:** a retraction signed by a DID other than the original owner → refused (currently accepted).

## K-D5 — generative interleaving property test; dead param

Convert the 3-fixture example test to a real **generative property test** over any `(original, retraction, duplicate)` ordering — idempotent on `event_id`, original never mutated, deletion of a never-crossed record emits nothing, for every interleaving. Remove the dead `_allowlist` param from `process_retraction` (or wire it meaningfully).

## Close the MEDIUM coverage gaps (from the k001 review)

- **is_high at the decision layer:** add a dispute-engine test that places a lone `SignedSelfAttestation`/`AiInference` item on an otherwise-high, >0.95-confidence winning side and asserts it still cannot auto-enforce — exercising the `is_high` gate, not just the 0.95 confidence threshold.
- **K-D3 inert-data — inspect the EVENT:** the marquee inert-data test must assert the crossed **Event's** string fields (payload title/category) carry no instruction-shaped text, not only the Evidence — so a future impl that copied record fields into the event is caught.

---

## Acceptance

Each fix red-first — its marquee red witnessed at commit A, green at commit B; full kernel `cargo test --workspace` green (note: on Windows, `chain-eos` and peers may intermittently hit os error 4551 — CI/ubuntu is the gate). All changed-file digests declared post-commit. Push `seat4/k002` only. Seat 3 re-runs the standing red-witnessed pass and the gate-focus review (review subagents READ-ONLY per the 2026-07-13 standing law). **On merge:** `--no-ff`, then prune BOTH `seat4/k001` and `seat4/k002`; retain any kernel markers. `seat4/k001` (`88f393d`) is retained as the k002 base reference until k002 lands.
