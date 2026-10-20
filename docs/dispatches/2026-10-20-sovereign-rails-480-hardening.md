# 2026-10-20 — issue #480 repair: the ceiling is atomic, the client is bounded, the store is airtight

Issue #480 (founder-filed against `79ed2cc3f`, blocker linked from
#479): (P0) the egress ledger's check-then-increment raced; (P0) the
client read the whole response before enforcing its cap; (P1) a
symlink inside the served store leaked bytes past the closed name set.
All three repaired with adversarial controls that refuse, bounded and
named.

## P0-1 — the ledger ceiling is now ONE atomic step

`EgressLedger::reserve` uses `fetch_update` (CAS retry) with
saturating arithmetic inside the predicate: check-and-increment cannot
interleave. Controls (`adversarial_hardening.rs`):
- **Barrier-controlled concurrent reservations** — deterministic, no
  timing luck: 10 threads at a Barrier against caps of 100/99/101 with
  per-request 10 → accepted is EXACTLY authorized/each, spent ==
  accepted×each, never above the ceiling; zero budget refuses
  everything; near `u64::MAX` the saturating predicate refuses
  `u64::MAX` under a `u64::MAX-5` authorization, accepts the exact fit,
  then refuses one more byte — no wrap into acceptance.
- **On the wire**: budget sized for exactly K=3 fetches, 10 concurrent
  requests → exactly 3 succeed, 7 refuse 402, chargeable bytes served
  == the authorization exactly.
- The doc now says what it is in the issue's own words: a
  byte-allowance ledger — not yet evidence of user-signed funding,
  settlement, or network tariff enforcement.

## P0-2 — the client's memory is bounded before the payload is trusted

`fetch_artifact` rewritten (`fetch_artifact_deadlined` for explicit
deadlines): incremental header read under an 8 KiB cap (flood/no
terminator refuses at the cap); Content-Length REQUIRED and exactly
one (missing / duplicate / malformed each refuse by name); the
declared length is checked against `max_bytes` BEFORE any body byte is
read; the body is then read incrementally to EXACTLY the declared
length — a peer that lies small and streams 100× the cap simply stops
being read (bytes past the declaration are never consumed); every
read carries a deadline. Controls, all refusing bounded and named:
huge declared length (immediate refusal, no download), lying-small
length + 200×64 KiB of junk (client returns exactly the declared 16
bytes), header flood, missing/duplicate/malformed Content-Length,
trickle stall (deadline fires within bounds), interrupted body — and a
correctly sized page still works through the hardening.

## P1 — a served artifact is a regular file, never a link out of the store

`handle_conn` stats with `symlink_metadata` (does not follow): a
planted symlink with a VALID artifact name refuses 403 named before a
byte is read; non-regular files refuse too. Control: a private decoy
with sentinel bytes sits outside the store, a valid-named symlink
points at it — the peer refuses and the sentinel NEVER appears in the
response (server-side confidentiality, independent of client digests).
On hosts that refuse unprivileged symlink creation (this Windows box)
the control defers with a printed reason; CI ubuntu creates it and
exercises the refusal.

## Receipts

- `cargo test -p btungsten-sovereign-rails`: 5 tests green (the
  two-peer lab + 4 adversarial controls); `cargo test -p
  genealogy-publication` 12/12 unchanged; fmt clean; the three
  generated-artifact checks green (no riders — no surface or workspace
  change).
- Qualification language per the issue: the lab remains threads in one
  test process on one host with test-driver recovery interventions —
  labeled as such; multi-host, real x0x authenticated forwarding and
  autonomous repair stay the next bar. The workflow is path-filtered
  and passed on this SHA; no branch-protection rule is claimed.

Closes #480.
