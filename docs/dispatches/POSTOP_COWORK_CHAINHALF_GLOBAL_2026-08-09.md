# POST-OP NOTE — COWORK · CHAIN HALF ON THE GLOBAL TREE (re-run complete)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: RE-RUN CLOSED — offline half 9/9, chain half committed and verified.**

---

## PRE-OP STATE
Offline re-run complete (9/9 validity + inclusion). Chain half approved. Code had redeployed
`banchor22222` with the global-tree contract — new code hash `e04824f18693bf86…` <!-- PUBLIC-CONSTANT: Jungle4 contract code hash --> (was
`6d3aa632…`), action `commit()` with the full :137 field set. Head was epoch 145, synthetic
root `0x…0091`, `tree_size` 40.

## PROCEDURE PERFORMED
1. Read the **deployed ABI and the `commits` table** before building anything (LAW 8k) —
   the contract had changed shape since my last interaction with it.
2. Rebuilt the identical 19-leaf global tree from seed; confirmed the root reproduced.
3. **Deliberately submitted `tree_size = 19` first** — lower than the stored 40 — to test
   whether append-only is enforced or merely intended.
4. Re-submitted with an honest append-only size and verified from `cryptolions`.

## SEATS PRESENT
**Cowork** — all steps and findings. **Code** — global-tree contract and the synthetic rows
at epochs 2/3/145. **goose** — R6 rules the tree construction follows. (LAW 8c.)

## FINDINGS

**F1 — ⭐ APPEND-ONLY IS ENFORCED, not merely intended.** The deliberate shrink was refused:

```
assertion failure with message: tree_size may never shrink; the tree is append-only
```

This is the positive result of a negative test — I did not assume the guard existed, I tried
to violate it and was stopped. **A guard nobody has attempted to breach is an assumption.**

**F2 — Commit landed and chain-links correctly.**

| field | value |
|---|---|
| tx | `f32e7478c573a4ccece6fb0b647e86bf3c5af66c3c8a9ae387b16003577cbcf6` <!-- PUBLIC-CONSTANT: Jungle4 testnet transaction id --> |
| block / time | 280,539,282 @ 2026-08-09T01:59:34, `executed` |
| epoch | 146 |
| `new_root` | `ecc730baa44dfeffd26ff074606c0768b2ae3bb58f79d459fcf33d3a395a4624` <!-- TESTNET-ONLY synthetic root: the 19-leaf offline tree --> |
| `prev_root` | `0x…0091` — exactly epoch 145's `new_root` |
| `tree_size` | 59 (40 prior + 19 appended) |
| `delta_id` | `02c14d1395709284e8c951ec5aa85264a7817a553e35df4a87256cdd21a46d32` <!-- TESTNET-ONLY synthetic delta id --> |

**The `new_root` is byte-identical to the offline re-run's global root.** The two halves
commit to the same artifact — the chain half anchors precisely the tree the resolver
verified inclusion against, not a re-derivation of it.

**F3 — RAM delta: `account_ram_deltas: []` — ZERO.** Epoch 146 overwrote ring slot 2
(146 mod 144 = 2), and the table confirms epoch 3 survives while epoch 2 is gone. **Wrap at
zero net bytes, observed on a public chain**, consistent with Code's measurement.

## SPECIMENS
- `push_transaction` trace (status `executed`, full action data as above).
- `get_table_rows` on `banchor22222::commits` via **cryptolions** (independent of the
  `eosnation` push endpoint): epochs 145, 146, 3 — epoch 2 overwritten.
- Reproduction from seeds `COWORK-LIFECYCLE-{OWNER,STRNGR}-SEED-2026`; R6 v2 RFC 6962.

## COMPLICATIONS

**C1 — HONEST LIMIT: `tree_size` continuity is nominal, not structural, across this
boundary.** My `new_root` commits to **19 real leaves**; the predecessor rows (epochs 2, 3,
145 with roots `0x…0002/0003/0091` and `delta_id` `0x1234…`) are **synthetic placeholders**,
not roots of real trees. So 40 → 59 is arithmetically append-only and satisfies the guard,
but there is **no real 40-leaf tree that my 59 extends.** The roots are not in a genuine
ancestor relationship. This is a limitation of testing against synthetic predecessor data —
**not a design flaw, and not something the contract can detect.** Stated so nobody later
reads this row as evidence of a continuous 59-leaf history.

**C2 — The contract cannot verify that `new_root` actually commits to `tree_size` leaves.**
Following from C1: `tree_size` is an asserted integer, monotonicity-checked but not bound to
the root. A committer can claim any non-shrinking size. **Consistent with the design** — the
chain proves order, the resolver proves content — but worth stating explicitly, since
"tree_size" reads like a verified quantity and is not one.

**C3 — Ring wrap silently overwrote epoch 2.** Expected and correct, but it means the table
is **not** a complete history — it is the last 144 epochs. Anyone auditing must read the
table as a window, not an archive. (Already flagged by Seat 0 for the ABI docs; observed
here in practice.)

**C4 — Two standing-law bookkeeping defects found and fixed** — see the laws file:
- **8k was adopted and cited across several post-ops but never written into the file.**
- **8m collided:** the founder's latest adopting message said "LAW 8m", but 8m was already in
  force (THE CORE MEASURE DECIDES). The new law is recorded as **8n**, flagged rather than
  silently overwriting a live law. **Founder may renumber.**

**C5 — Mainnet untouched. `banchor11111` dead per 8h.** One testnet key, unchanged.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The re-run is CLOSED end to end.** Offline: 9/9 validity + inclusion. Chain: epoch 146
   committed, `prev_root` linked, zero RAM, `new_root` identical to the verified tree.
2. **Append-only is proven enforced** (F1). Do not re-test by assumption; it is measured.
3. **`tree_size` is asserted, not verified against the root** (C2) — if that binding is ever
   wanted, it needs a design decision, not a contract tweak.
4. **The commits table is a 144-epoch window, not a history** (C3).
5. **Still untested at scale by anyone:** proof size vs the ~1.7 KB **binary** budget (now
   ruled), and the private-lookup bound at 10^10 (constraint ruled, mechanism open).
