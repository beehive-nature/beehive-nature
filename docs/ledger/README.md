# Raid Ledger — repo-local mirror

The raid ledger (the "pirate haul") records founder-ruled verdicts on external-technology
adoption: TAKE / LEAVE / PATTERN per target, with a license receipt, an adoption threshold,
a re-audit trigger, and a mirror requirement.

It originated in **chat-Opus's memory store**, where exactly one agent could read it. No file
existed on any machine. This directory is the fleet-readable mirror, so every agent works from
one record instead of asking one agent to recite it.

**Read this before proposing any external-tech adoption.**

## Index

| File | Role | Mutability | Status |
|---|---|---|---|
| [`pirate-haul-rulings.md`](./pirate-haul-rulings.md) | Closed quarter — 2026 Q1–Q3 through 07-25 | Append-only, now sealed | ✅ Mirrored — `299412f` |
| [`pirate-haul-rulings-2026q3.md`](./pirate-haul-rulings-2026q3.md) | Active quarter — continues the above | Append-only | ✅ Mirrored — `672feba` |
| [`pirate-haul-candidates.md`](./pirate-haul-candidates.md) | Targets under evaluation, not yet ruled | **Mutable** | ✅ Mirrored — `129b6f2` |
| `pirate-haul.md` | Operational — raid procedure | Operational | ⏳ Not yet mirrored |

Pending rows are listed because the set is known, **not** because placeholder files exist.
Nothing has been reconstructed or inferred; each file lands only when supplied verbatim from
the store. If a row says "Not yet mirrored," that file is genuinely absent from this repo.

## Why `docs/ledger/README.md` and not a root `LEDGER.md`

"Ledger" is already overloaded in this repo — [`dockets/MASTERY_LEDGER_commons_first.md`](../../dockets/MASTERY_LEDGER_commons_first.md)
and the [`crates/mastery-ledger`](../../crates/mastery-ledger) crate are unrelated to the raid
ledger. A third meaning at repo root would make the collision worse. The index lives inside the
directory it indexes, and the four files cross-reference each other from there.

## Standing laws

The closed file carries laws that remain **in force across all quarters**, not just the quarter
that recorded them:

- **L-VERIFY** — verify the LICENSE file *in the repo tree*, not the GitHub sidebar label, not
  aggregators, not "widely reported as." For models this extends to the weights license on the
  model host, verified separately from the code.
- **Mirror-by-law** — an adopted artifact must be pinned at a specific commit and mirrored to
  BNR-controlled rails, so it survives upstream disappearance.
- **RAID DOCTRINE** — take what serves the code base, leave everything else; do no harm.
- **FOUR AXES** — every target scored on code / community / compatibility / synergy-symbiotic-
  parasitic check, from the first pass, before any verdict.
- **Adoption gate vs integration gate** — integration is not adoption and does not take the
  adoption gate. A closed proprietary SaaS can fail adoption and still pass integration.

## Fidelity

Each file is committed **verbatim** — not reformatted, not summarized, not reconstructed, with
frontmatter preserved. Fidelity is verified rather than assumed, by a source → working-tree →
git-blob round trip: the blob is extracted back out of git with `git cat-file` and its sha256
compared against the source. A commit is only claimed when those match.

**Know exactly what that proves, and what it does not.** The round trip covers
*source → working tree → git blob*. It says **nothing** about *store → source*. Byte counts are
checked against the store where available, but a byte check is *necessary, not sufficient* —
paraphrase is the demonstrated failure mode, and a paraphrase that happens to preserve length
passes silently. `pirate-haul-rulings.md` at `299412f` was mirrored before this was understood
and had no second export to diff against, so it may contain paraphrases that will never be
detected. That is **not** an argument to re-export it: a second export would produce a third
variant, not a verification.

## Export procedure — export once, then deltas only

This follows directly from the finding below, and exists so the flaw cannot recur.

1. **Each file is exported from the store exactly once**, single-pass, never assembled from
   multiple operations. That export is committed after round-trip verification.
2. **After a file lands here, it is never re-exported.** New rulings arrive as **append-only
   deltas** — one entry at a time, small enough to read in full — appended to the committed file
   rather than regenerating it.
3. A delta **cannot silently reword an existing entry, because it never touches one.** Full
   re-export is the operation that carries the risk, so it happens once per file and never again.

The property that makes this work: appending to a committed file means `git diff` shows exactly
the new bytes, and everything prior is byte-identical **by construction rather than by
assertion**. The residual risk becomes bounded and visible, and review collapses to the delta
alone.

### The mutable file needs one extra convention

`pirate-haul-candidates.md` is the only file here that legitimately *loses* entries — an entry
leaves when it is promoted to rulings, or dropped. Deltas alone will not keep it accurate, and
re-export is the operation we just established as unsafe.

Convention, already precedented by the `attie.ai` entry when it moved to rulings:
**promotions are recorded, not erased.** A promoted entry stays in place with a one-line pointer
replacing its body. The file becomes append-and-amend-in-place rather than regenerate, and every
amendment stays small enough to read in full.

## Open question for the founder — which copy is the record of truth?

> **RESOLVED 2026-08-07 — `RULING_REPO_IS_THE_RECORD` (Seat 0, King Bee).**
> Founder's words: **"repo is the record."** `docs/ledger/` in the repo tree **IS** the
> record of truth for raid rulings; the chat-Opus/Fable memory store is the **working
> copy** — the drafting surface, never the authority. **On any disagreement, the repo
> wins.** New rulings land as append-only deltas; no file is ever re-exported whole; the
> sealed Q1–Q3 file is left alone. The question body below is preserved as the record of
> what was asked (promote-don't-erase), not deleted.
> Canonical ruling: [`../dispatches/RULING_REPO_IS_THE_RECORD_2026-08-07.md`](../dispatches/RULING_REPO_IS_THE_RECORD_2026-08-07.md).

This directory is described as a *mirror*, which implies chat-Opus's memory store is upstream.
That leaves a divergence hazard: if a ruling is appended to the store, this mirror is silently
stale, and an agent reading the repo gets an incomplete record while believing it is complete.

BNR already owns the doctrine that resolves this — the genesis anchor's mirror-by-law, and the
2026-07-25 receipt-rail finding that **the record of truth is the BNR-controlled rail, and the
other surface is a broadcast mirror, never the record.** Applying that shape here would make
*this directory* the record and the memory store the working copy. That is a founder ruling,
not an agent's call, so it is recorded here as open rather than assumed either way.

Until it is ruled: treat this mirror as authoritative only as of each file's commit date, and
confirm against the store before relying on it for a new adoption decision.

### Evidence bearing on that ruling: transcription is non-deterministic

This is not speculative. It was measured while mirroring `pirate-haul-rulings-2026q3.md`.

The first export of that file (A, 23,472 bytes, `9AFDF6DE…BB0D8`) carried a 47-byte discrepancy
against the store. It was **rejected rather than committed**, and a single-pass re-export (B,
27,110 bytes, `A18FA76D…8AA2`) was requested. A was preserved so the two could be diffed instead
of one silently replacing the other.

The diff located the gap exactly — one shared entry, differing by exactly 48 bytes:

```
A:  ...blocked on that machine by Application Control, so commits sit local...
B:  ...blocked on that machine by the same Application Control policy that
    blocked the crawl4ai clone, so commits sit local...
```

Byte accounting then closed with no residue: A content minus trailing LF = 23,471 against a store
reading of 23,519 (delta 48); B content minus trailing LF = 27,109 against a store reading of
27,109 (exact). The 1-byte offset in both is the trailing newline the store does not count.

**The difference is a paraphrase, not a truncation.** The same entry, transcribed twice, was
re-composed with different wording. Nothing was lost — text was rewritten. The predicted cause
(an assembly step dropping bytes from appended entries) was wrong; the divergence is in an entry
that came through the store *read*.

Two consequences follow, and both bear on the ruling above:

1. **Single-pass export does not fix this.** It removes the assembly variable, not the
   transcription variable. Two exports of an *unchanged* store will not be byte-identical.
2. **Therefore no export is reproducible, and the store cannot be verified against any export.**
   chat-Opus has stated plainly that it has no mechanical copy path — every export passes through
   re-typing. This is the measured confirmation of that.

A non-reproducible transcription pipeline cannot be the authoritative source for a record other
agents depend on. That argues for ruling this directory the record. If it is so ruled, the
paired requirement is that exports are single-pass, never assembled, and every one is round-trip
verified before it lands — otherwise the record inherits the drift it was meant to escape.
