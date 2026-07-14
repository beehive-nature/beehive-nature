# DOCKET k003 — Hardening residuals from the k002 review

Authority: BIND-1 v0.1 · founder ruling 2026-07-13 (k002 dispatch CLOSED, clean merge ratified) · ORDERS-1 v0.7.
Repo: **beehive-nature/beehive-nature** (kernel).
Executor: Seat 4, own kernel clone. Branch `seat4/k003` off current main `fbfb815`. Push branch only.
Scope: **two correctness fixes + two test repairs. Nothing more.**

---

## Fix 1 — rewitness() at_uri pinning

`rewitness()` currently raises `existing.grade` using corroboration from whatever `at_uri` is passed — it does not verify `at_uri == existing.at_uri`. A witness for record Y can bump record X's grade. Fix: check `at_uri == existing.at_uri` before raising; a mismatch is a no-op.

**Marquee red:** a low-grade `SocialWitness` for record X cannot be raised by record Y's corroboration.

## Fix 2 — signer auth not bypassable at the low level

`retract()` checks `signer_did == seller_did`, but `process_retraction()` does not — a caller can bypass `retract()` by calling `process_retraction()` directly and `ingest()`-ing the result. Fix: fold the ownership check DOWN into `process_retraction()` (accept `original_seller_did` parameter, refuse on mismatch), and guard `ingest()` against `SocialRecordRetracted` events (retractions must enter through `retract()`).

**Marquee red:** `process_retraction()` with a foreign signer → refused. `ingest()` of a `SocialRecordRetracted` event → refused.

## Repair 3 — proptest monotonic-grade assertion is vacuous

Both `IngestOriginal` and `IngestDuplicate` carry the same `ViewGrade::Informational` evidence, so `entry.1.view_grade >= original_grade` is always `Informational >= Informational`. Fix: add a `RaiseGrade` action that ingests the original event at `Confirmed` or `Settlement`, making the monotonic assertion non-vacuous.

## Repair 4 — never-crossed-emits-nothing not explicit

The proptest asserts `log.len() <= 2` but does not prove `RetractNonexistent` added zero events. Fix: track log size across the action and assert it did not grow.

---

## Deferred — named deployment gates (NOT code fixes for k003)

Two R-004-class properties are real deployment gates on the seam, not unit-test checks:

1. **CID-agreement-on-self-reported-strings vs predicate re-hash.** The K-D4 agreement gate compares `pinned_cid` values reported by sources — which are self-reported. The predicate (K-4 step 2) re-hashes record bytes independently. A source could self-report a CID that matches another source without holding the same bytes. At deployment, the seam must re-hash at the source boundary, not trust the source's self-report. This is a pre-live integration property.

2. **N-of-M rests on true source disjointness.** `IndependentSocialView` checks distinct source labels, but two sources with different labels can share infrastructure (same PDS, same relay behind a proxy). True source independence — like R-004's chain-view requirement — is a deployment property that the code cannot enforce. Document as a pre-live gate.

Both are banked here so the k003 scope stays tight. They do not chase in unit tests.

---

## Acceptance

Red-first each fix — marquee red witnessed at commit A, green at commit B. `cargo test --workspace` green. Digests post-commit via Git Bash/WSL `sha256sum` on stdin. Push `seat4/k003` only.
