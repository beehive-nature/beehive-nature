# INVOICE-1 ORACLE RE-VERIFICATION — GREEN (2026-09-17, formal pass)

## STATE

Re-SYNCed: PR #97 head = `801d869f` (the A2q repair). The builder delta since
the previously failed oracle pass (`2d615b63..801d869f`) is EXACTLY two files
(+84/−7): `scripts/lib/bpay-invoice-generic.mjs` and
`scripts/inv1-generic-builder.mjs` — the repair and its evidence, nothing
else. The frozen battery and both pinned zGenealogy fixtures are
byte-unchanged vs the pin `4c6a4593` (zero diff, verified directly AND by the
battery's own pin check; battery runs exit 0 with its 3 registered reds still
printed — the historical record preserved). The economic branch `4c6a4593`
remains unmerged to main with no open PR of its own. (Awareness only: PR #98
— the Gesture-D ceremony rerun — is open from the ceremony seat.)

## ORACLE RESULT

**13/13 independent attacks PASS. INVOICE-1 CURRENT CAPABILITY = GREEN.**

The verifier (`scripts/inv1-oracle-verify.mjs`, v2, banked on this branch and
now CI-wired) implements the documented semantic law INDEPENDENTLY —
"quotes are an unordered collection of unique quote identities" — sorting raw
quote values by `quote_hash` before any representation step; it imports
nothing of the builder's canonicalization. Verification ran in a detached
checkout of exactly `801d869f`.

## 13/13 EVIDENCE

1. **A1** independent digest + canonical-bytes recomputation reproduces the
   module's exactly.
2. **A2** key-order reversal at every level: same identity.
3. **A2q-P** all 24 EXHAUSTIVE permutations of a unique 4-quote set → ONE
   canonical byte string, ONE contentDigest, every permutation validates.
4. **A2q-G** reordered enumeration re-derives the SAME contentDigest AND the
   same commitmentDigest — one collection semantics across both digests.
5. **A3/A3v** dropped quote, new issuedAt, and same-hashes-with-one-amount-
   changed each change identity (set semantics did not blunt sensitivity).
6. **A2q-D** duplicate `quote_hash` refused in all three shapes: same hash +
   same amount; same hash + different amount; and with the attacker's
   RECOMPUTED contentDigest (validation-side law survives re-forge);
   build-side refused too.
7. **A4** committed attackers (amount tamper; quote-amount substitution; both
   with independently recomputed digests) refused by the Σ-law alone —
   independent of digest integrity.
8. **A5** fresh-process child proves the historical obligation under MUTATED
   pricing AND then DELETED pricing, validating against the durable digest.
9. **A6** void→settled flip refused; stripped reforge refused against the
   anchor; lawful supersession (`successorJobId` + `priorDigest`) and
   settlement-from-issued valid.
10. **A7/A8** `receiptDigest` = presence-checked evidence only; no
    signing/key primitives; no R20 semantics migrated.
11. **A9** no genealogy/Autonomi vocabulary in the generic law text.
12. **A10** job identity routes (constant across versions) while content
    identity distinguishes them.

Honesty notes: (a) the verifier's first run tripped on an ORACLE-side fixture
bug (my perm fixture summed past its own declared ceiling) — fixed in the
verifier, module untouched; (b) the v1→v2 verifier change is the documented
set law re-derivation the A2q return required, plus exhaustive permutations
and the duplicate-variant split — no builder code imported.

## LEDGER RULING (unchanged in kind, now complete)

Historical observations are NOT repainted. The frozen battery's registered
rows remain RED as findings against the zGenealogy reference consumer:

- INV-1.1 reference RED → **CLOSED-BY-INVOICE-1** (oracle-verified)
- INV-1.4 reference RED → **CLOSED-BY-INVOICE-1** (oracle-verified)
- INV-1.5 reference RED → **CLOSED-BY-INVOICE-1** (oracle-verified, A2q
  repaired and re-verified)

Current capability: **INVOICE-1 GREEN** on the generic implementation
(`bpay.invoice-generic/1` @ `801d869f`).

## MERGE ORDER (re-ruled from CURRENT ancestry)

1. **Open and merge the economic/oracle branch PR**
   (`zcode/bpay-economic-frontier-2026-09-17`, `4c6a4593`) → main FIRST —
   the oracle/spec lineage must land as its own reviewed PR. It has NO open
   PR today; one must be opened.
2. **Then merge #97** (head `801d869f`, base main): after (1) its diff vs
   main collapses to exactly the two builder commits. Do NOT merge #97
   before (1) — its base=main would carry the oracle content into main
   without the oracle's own PR ancestry.
3. **Then this PR (#99)**: retarget to main after #97 lands (currently
   stacked on the builder branch); it carries the v2 verifier (CI-wired),
   both verification receipts, and this ruling.
4. The verifier's CI step rides #99 and is legitimate now (13/13 earned;
   previously withheld pending the repair).

## BOUNDARY NOT CROSSED

No repair from the oracle seat (the one mid-pass fix was to the oracle's own
verifier fixture, disclosed above); frozen battery, fixtures, and pins
byte-unchanged; zGenealogy, R20/bpay-rail, Gesture D, IF-1..IF-4, VV-2,
Jungle4, VOCAB-1, RECON-1 all untouched.

## NEXT OWNER

The founder/merger for the ruled sequence; thereafter the economic seat owns
INVOICE-1's continued life (VOCAB-1 and RECON-1 remain queued on that lane,
unopened). zGenealogy may adopt the generic module as a consumer on its own
lane.

## FOUNDER ACTION

Open + merge the economic branch PR (step 1), then #97, then retarget +
merge #99. Nothing else required — INVOICE-1 stands GREEN on independent
verification.
