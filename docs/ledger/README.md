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
| `pirate-haul-rulings-2026q3.md` | Active quarter — continues the above | Append-only | ⏳ Not yet mirrored |
| `pirate-haul-candidates.md` | Targets under evaluation, not yet ruled | Mutable | ⏳ Not yet mirrored |
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

## Open question for the founder — which copy is the record of truth?

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
