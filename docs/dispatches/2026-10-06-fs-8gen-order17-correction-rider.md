# Correction rider — the two "order-14" dispatches dated 2026-10-04 are misdated and misnumbered; labor attribution corrected

Per the corrective-receipt discipline (withdrawn named withdrawn,
reclassification = revised conclusion), this rider corrects two receipts
this session published to main:

- `docs/dispatches/2026-10-04-fs-8gen-order14-reconciliation.md`
- `docs/dispatches/2026-10-04-fs-8gen-order14-seed-attaches.md`

Both were written and pushed **2026-10-06**, not 10-04, and the order
this session received is the **17th** issuance of the 8-gen order, not
the 14th — sibling sessions had already dispatched the 10-04 tasks
harvest (unnumbered wake), order #15 (10-05), and order #16 (10-06,
@228fb7ca2), plus order-13b labor (@6aefe7772, 10-06). The files stay
in place as published history; their dates and ordinal are wrong and
this rider supersedes those fields.

## Root cause — a verification gap, named as a law

My dispatch-existence check listed `docs/dispatches/` from the SHARED
CHECKOUT's working tree (stale at bfd955f39, 40+ commits behind
origin/main) instead of origin/main's tree. The 10-04 tasks-harvest,
order-15, and order-16 dispatches were therefore invisible to my
"reconcile fresh" step. **LAW: dispatch-state verification reads
`git ls-tree origin/main` (post-fetch), never a working-tree directory
listing.** (The harvest/queue/PR pillars were verified correctly against
origin/main; only the sibling-dispatch layer was missed.)

## Attribution corrections (revised conclusions)

1. **Hadlock `62XG-3FTR` "attached by someone outside this session's
   sight"** — attributed now: the **2026-10-04 tasks-harvest session**
   attached it ×3 (Mary KWCT-391, Dwight LCZ5-8QV, Walter KWJZ-YG2),
   per `2026-10-04-fs-tasks-harvest.md`. My wake verified it standing;
   no duplicate.
2. **"Daniel L Briggs duplicate cluster flagged"** — reframed: PNC5-R9G
   (1937–2025) was **deliberately CREATED** by the tasks-harvest session
   from Daniel's own obituary with full record vitals (b. 2 Feb 1937
   Pontiac MI, d. 1 Jun 2025), alongside Jim Briggs PNCP-RDN. The
   LL4G-3FL ("1937-Deceased", no death year) vs PNC5-R9G pair remains a
   probable same-man duplicate — the merge ruling stays the founder's,
   now with correct provenance (created-from-record, not accidental).
3. **"The 13-hint rail is drained"** — this was a re-confirmation, not a
   discovery: order-13b (@6aefe7772, earlier the same day) had already
   recorded "digest + rail exhausted, all probeable ancestors zero
   hints." My 10-pid re-poll independently agrees.

## What remains genuinely new from this session (standing receipts)

- **Chester Briggs's own GenealogyBank obituary `1:1:X3R1-XZLL`** (a
  different record from Daniel's obit `X3J9-XF11`): attached 5/5,
  reason-texted, DETACH-proven — Chester Arthur Briggs L21W-9ZT,
  Theodora Bell Lawton KCN3-1P6, Jim Briggs PNCP-RDN, Daniel L Briggs
  PNC5-R9G, David Arthur Briggs LL4G-322.
- **Irving A Cook pension index `1:1:KD57-L28`**: score 0.48 verified
  TRUE on place-trail evidence (1920 Ohio/WV pension + Lancaster
  Fairfield OH residence = the tree's 1900–1940 Fairfield County trail),
  attached to LJDF-JY4, DETACH-proven. Distinct from the tasks-harvest's
  1950 census and Ohio-death attaches for the same man.
- **Order-16's named open vein probed**: PNC6-GJQ (Nels Martinsen) and
  PNCX-S8Q (unnamed mother) hint wires = **zero matches ≥ confidence 3**
  as of this wake (async computation either yielded nothing or nothing
  qualifies).

## Pillar state — unchanged from order-16's verification

Harvest frozen+merged (809 / 23,673 / 13,249); image queue terminal
(366/366, 308 images / 83,315,926 B); staging here+github standing; ANT
= codex PR #336 + privacy siblings #346/#347, no spend anywhere.

— zCode seat, 2026-10-06
