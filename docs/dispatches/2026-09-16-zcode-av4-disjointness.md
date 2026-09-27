# 2026-09-16 — AV-4 cross-rail disjointness + handle unlinkability, RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-4 (P1, third per
the founder roll order). Founder brief verbatim: audit the *actual emitted
artifacts*, not type definitions; construct two legs of one plan and prove an
observer of one rail cannot derive the other rail's payer; attack accidental
joins through plan ids, auth ids, payer tags, filenames/paths, timestamps,
logs, diagnostics; R4 = no wallet-global identifier linking multirail legs;
negative control leaking one shared handle. **Branch**
`zcode/av2-stale-quote-ttl`, worktree `wt-zcode-av2`.

## The door half (4.1) — actual artifacts, structurally clean

`ops/x402-door/tests/av4_disjointness.rs` drives TWO legs of ONE
wallet-local plan through the REAL `Journal::reserve` (Base + Arbitrum
shapes) and audits what actually lands on disk:

1. **identifier-leaf disjointness** — every string leaf of one leg's
   records against the other's (the R4 prohibition); the intersection must
   be empty.
2. **payer/nonce containment** — no artifact of one leg even CONTAINS the
   other's payer or auth nonce as a substring.
3. **cross-chain containment** — leg A's records never mention leg B's chain
   id (the R4 logging law's structural core). The audit's own construction
   caught its fixture violating this (a shared chain-scoped asset string) —
   fixed in the fixture, kept as a lesson: content mapping is key-anchored,
   never sort-order or loose substring.
4. **filename joins** — journal basenames (the payment ids `res-{nonce}`)
   are leg-distinct.
5. **Value channels REPORTED, not failed** (a ruling point for the founder):
   same-second timestamps and equal authorized amounts are correlatable
   metadata and public pricing information respectively — falsifying either
   to hide co-temporality would be a worse law than reporting it. R4's
   defense is structural: per-chain journals, zero shared identifiers.

**Negative control**: a deliberately leaky variant (both legs stamped with
one shared `plan_ref`) is DETECTED by the same audit function — the harness
proves it catches the class. **Result: 2/2 green; the door's structural R4
holds against its actual artifacts.**

## The handle half (4.2) — a real leak, RED first, closed

**RED receipts** (box, Python 3.12.3, exit 1): `QuotingDesk` minted quote
ids as `q-{lane}-{t:.0f}-{n:06d}` — same-principal handles shared the
lane+second prefix with **sequential global counters**
(`q-mesh-1800000000-000001 / …-000002`, kept in the battery's PART A
forever): an observer of one handle derives the shape and ORDER of the
other — session-linkable, and the counter is a wallet-global sequence
number in miniature. The battery then failed against the live minter
("handle leaks lane or timestamp").

**GREEN** (`x402_meter.py`): the minter emits `q-` + 32 hex of
`secrets.token_hex` — 128 bits of pure entropy; no lane, no timestamp, no
counter. Battery proves: zero minted-field leakage, **zero reuse across
10,000 mints**, and unlinkability proper (beyond the constant type prefix,
handles share no structure). Negative control: the old sequential minter
(inline replica) shares a 23-char lane+timestamp prefix with adjacent
counters and the battery's assertions FAIL against it — detection proven.

## Receipts

- Door audit 2/2 (cargo, fmt clean — rides CI's existing
  `--manifest-path ops/x402-door` run).
- Handle battery 3/3 on box; CI line added beside its siblings.
- Regressions all green: voucher 16/16, x402 45/45, AV-1 5/5, AV-3 5/5,
  AV-5 3/3, AV-6 4/4.
- No production deployment; nothing box-side moved.

## Standing notes

- The founder's R4 bar is met **in the audited components**; a
  wallet-global correlation id is not needed anywhere the audit looked —
  the per-chain journal + per-leg LegKey + entropy handles carry the whole
  flow. If a future seam genuinely needs internal correlation, the audit's
  disjointness function is the gate it must pass (private/local + provably
  never crossing a rail boundary or public receipt).
- Next per the roll order: AV-11 (human native-gas surface audit), then
  the P0/P1 matrix and STOP for reconciliation.
