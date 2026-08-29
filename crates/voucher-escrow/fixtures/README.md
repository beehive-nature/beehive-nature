# Cross-form fixtures — voucher-escrow

Two ledgers, both written by the **Python** engine, both verified here by the
Rust core. Neither was produced by this crate: a form must not be its own
witness about conformance with the other form.

## `live-ledger-snapshot.jsonl` — the acceptance

A verbatim snapshot of the **production escrow ledger on the Oracle box**
(z1.1, 2026-08-29): 6 events — 2 migration seeds, an A-rail deposit and charge,
a USDC-rail deposit (12 USDC @ 2.5 → 30 A) and its charge. Events only; secrets
never lived in the ledger.

Verified two ways, deliberately:

| test | path | what it proves |
|---|---|---|
| `live_chain_verifies_in_rust` | `verify_external_chain` (parsed values, re-serialised) | the canonicalization law agrees across languages *today* |
| `live_chain_verifies_from_its_stored_bytes` | `from_jsonl` + `verify_chain` (**rule 3**) | the chain verifies from the bytes the box actually wrote |

Balances derived here match what the box reported: `1.0000` / `0.5000` /
`1.3400` / `29.3400`, and zero-balance keys derive to zero.

## `python_ledger.jsonl` — the adversarial companion

Generated with the in-tree `scripts/buzz-meter/voucher_escrow.py` while the box
snapshot was still in flight. It is kept because it exercises what the live
snapshot happens not to:

| # | event | what it exercises |
|---|---|---|
| 0 | A deposit, memo-native | the gasless A/Vaulta rail, sender + memo |
| 1 | charge | line items, explicit rate, the 10% tithe as its own line |
| 2 | USDC deposit | explicit rate + `rate_ref` |
| 3 | deposit, **non-ASCII voucher** | `café-Ω-voucher`, escaped as Python escapes it |
| 4 | charge | a second charge, so the chain has depth |

Python's own reading: `member-abc = 29.5600`, `café-Ω-voucher = 1.0000`.

### Why rule 3 is not a formality

Disable rule 3 — verify by re-serialising instead of hashing stored bytes — and
**proof 18 fails at event 2**. Not at the non-ASCII event. Not at every float
either: event 1 carries a 17-significant-digit timestamp and verifies fine while
event 2's does not.

That is the whole argument. The divergence is **value-specific and
unpredictable**, so you cannot enumerate the forks — you stop asking a
serialiser to reproduce bytes that were already written down. `from_jsonl` keeps
them; `verify_chain` hashes them.

`verify_external_chain` remains for callers already holding parsed events, and
carries this warning in its own doc comment.

## The scanner

These files sit under a **narrow, path-scoped** secret-scan exemption for this
crate's fixtures (`scripts/secret-scan.sh`, 2026-08-29, on the
`dockets/*/receipt-*.json` basis): hash-chained canonical JSONL where every byte
is load-bearing, so a same-line `PUBLIC-CONSTANT` marker would break the very
artifact it pins. The 64-hex values are public chain hashes of append-only
events — never key material. **Anything added here must meet the same line:
events only, no secrets.**
