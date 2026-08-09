# POST-OP NOTE — COWORK · MILESTONE: ONE DAO, FULL LIFECYCLE, END TO END
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: MILESTONE CLOSED.** Chain proved ORDER; resolver proved VALIDITY.

---

## PRE-OP STATE
Contract deployed by Code at `banchor22222` (code hash `6d3aa632d51af1db99e23fdc6332ff1450c83bb1211642982d9fb52de055583d` <!-- PUBLIC-CONSTANT: Jungle4 contract code hash -->), one prior test anchor at epoch 1000144.
Resolver half already 9/9 offline. `ram_quota` 152,279 after Code's buy; balance 70 EOS.

## PROCEDURE PERFORMED
1. Read the deployed **ABI** first — anchored against the real action signature
   `anchor(dao:name, epoch:uint64, root:checksum256, prev_root:checksum256)`, not an assumed one.
2. Generated the five lifecycle stages deterministically (fixed Ed25519 seeds), computed a
   **Merkle root per epoch** over that epoch's record leaves.
3. Chained `prev_root` forward, **extending Code's existing anchor** rather than restarting
   from genesis.
4. Hand-serialized and signed five `anchor` transactions **in the sandbox** (key never
   moved), pushed from the Windows side.
5. Verified the resulting chain from **`cryptolions`** — a different endpoint than the
   `eosnation` node used to push.

## SEATS PRESENT
**Cowork** — record generation, Merkle roots, serialization, signing, anchoring, verification,
this note. **Code** — contract and the pre-existing epoch-1000144 anchor (no Code action in
this procedure). **goose** — validity rules the resolver half implements. (LAW 8c.)

## FINDINGS

**F1 — ⭐ THE CHAIN, VERIFIED END TO END ON A PUBLIC CHAIN.** Six links, each `prev_root`
exactly the previous `root`:

| epoch | stage | root (first 16) | prev_root (first 16) |
|---|---|---|---|
| 1000144 | *(Code's test)* | `1111111111111111` | `aa11bb22cc33dd44` |
| 1000145 | REGISTER | `539ab074f64c3982` | `1111111111111111` |
| 1000146 | CHANGE @28d | `f22617b86069a253` | `539ab074f64c3982` |
| 1000147 | RENEW @365d | `4f7685a900a6a2ac` | `f22617b86069a253` |
| 1000148 | RECLAIM in grace | `a153875e0c3aec48` | `4f7685a900a6a2ac` |
| 1000149 | STRANGER after lapse | `b517e5cfb5558056` | `a153875e0c3aec48` |

**Ordering is self-verifying** — no seat is trusted to assert sequence; each link is checked
by the contract against stored state.

**F2 — CONTRACT CALLS USED: 5 — one epoch root per stage, and NOTHING ELSE.** No per-name
call, no fee, no admin action, no registration transaction. Register, change, renew, lapse
and reclaim were all **properties of signed records**, resolved offline. This is the claim
the whole design rests on, and it is now measured rather than argued.

**F3 — Cost measured: 188 bytes RAM per anchor**, `ram_usage` 3,496 → 85,716 across
deploy + 5 anchors. Balance 100 → 70 EOS (Code's RAM buy). At 188 B/epoch, the **144-slot
ring wraps at zero net delta**, so per-DAO RAM is bounded regardless of epoch count.

**F4 — The resolver half stands at 9/9** with both boundaries exercised from both sides
(27d/28d change gap; exp+27d/exp+28d grace-vs-lapse). Records used here are the *same*
records, leaf-hashed into the roots above — **the two halves are the same artifact, not two
descriptions of one.**

## SPECIMENS
- Transactions (Jungle4, all `executed`): <!-- PUBLIC-CONSTANT: Jungle4 testnet transaction ids -->
  `e1609ace4cf71ac4…` (1000145, blk 280531291) · `01a845d2e5ccc517…` (1000146, blk 280531292) ·
  `3bbf98521c7e90d8…` (1000147, blk 280531293) · `2c7ebdb3b41c6779…` (1000148, blk 280531294) ·
  `938e00c58e7ad53f…` (1000149, blk 280531579)
- `get_table_rows` on `banchor22222::roots` via **cryptolions** → six rows above.
- Harness: `/tmp/{resolver,lifecycle,chainhalf,eoslib,sign_anchors}.py` (sandbox scratch).

## COMPLICATIONS

**C1 — `require_auth(dao)`: a DAO must be an on-chain Antelope account to anchor.** First
attempt with `dao="testdao"` failed `missing authority of testdao`. Re-scoped to
`banchor22222`. **Not a defect — but a design property worth stating:** the design is
O(DAOs) accounts, not O(names), which preserves the scaling argument. It does mean **DAOs,
unlike users, cannot be keypair-only.** Flagged for the founder's open per-DAO-vs-global-tree
question.

**C2 — My first signature was rejected: `is_canonical(c)` failed.** My canonicality test
was too weak. Antelope's `is_canonical` checks **both** leading bytes of r and s
(`elliptic_secp256k1.cpp`), not just the high bit:
`!(r[0]&0x80) && !(r[0]==0 && !(r[1]&0x80)) && !(s[0]&0x80) && !(s[0]==0 && !(s[1]&0x80))`.
**The earlier `updateauth` passed on luck, not correctness** — a latent defect that only
surfaced under repetition. Fixed in `eoslib.py`.

**C3 — ⚠ RACE: E5 was refused, then succeeded unchanged two minutes later.** E1–E4 landed in
**consecutive 0.5s blocks**; E5 hit a node whose speculative state had not yet applied E4, so
`prev_root` compared against a stale head. **Operationally important for the sequencer: a
chain-linked anchor must not be submitted until the previous one is applied.** Pushing faster
than block production breaks the link check even when every payload is correct. Recorded
because a naive sequencer loop would hit this immediately and misread it as a data bug.

**C4 — My first diagnosis of C3 was wrong, and I caught it by decoding rather than
reasoning.** I decoded E5's payload expecting a bad `prev_root`; my byte offset was off by the
varuint length prefix, which made a *correct* payload look corrupt. Re-aligned, the payload
was right — which is what redirected me to the race. **Per LAW 8k: I proved the probe could
return a positive before trusting its negative.**

**C5 — No mainnet contact. `banchor11111` untouched** (dead per LAW 8h). No mainnet key
exists in any seat.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The milestone is closed and reproducible.** One DAO, full lifecycle, **five contract
   calls — all epoch roots**. Chain proves order (F1), resolver proves validity (F4).
2. **A sequencer must serialize anchors** — wait for the previous anchor to be applied before
   submitting the next (C3). This is the single most likely production bug in this design.
3. **Antelope canonical-signature rule is stricter than the obvious check** (C2) — any seat
   writing a signer needs the both-leading-bytes test.
4. **DAOs require on-chain accounts** (C1); users do not. Bears on the founder's open
   per-DAO-anchor vs single-global-tree question — **not converged on quietly.**
5. Still open, neither blocking: `owner` succession, and the anchor-shape question above.
