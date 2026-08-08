# COURSE_SYNC RECEIPT — BNR invite/onboard dispatch

**Seat:** Claude Code (Seat 3) · **Filed:** 2026-08-08
**Against:** `DISPATCH_BNR_INVITE_ONBOARD_2026-08-08.md` (landed verbatim, same commit).
**Law swept before this filing:** PERSON-1 (APPROVED v0.1, frozen), CONSTITUTION Art. V.1
+ stack rows, b-tokenomics §2.10/§3.3, feature-backlog CD-13, SPEC-BNROSE-ONBOARD,
SPEC-BNROSE-0-CHARTER, ORDERS-1 v0.8 §2–§3, INDEX (whole board), KISS/bDiD rulings of
2026-08-07/08.

**Provenance receipt (landing metadata's grep claim):**

```
> Grep pattern="creatormagic" path="C:\Users\travi\beehive-nature" -i
No matches found
> Grep pattern="creatormagic|desktop-pairing|desktop pairing" path="C:\Users\travi\LOVErnment-DAO" -i
No matches found
```

---

## §1 — Item-by-item against governed text

| # | Directive | Verdict |
|---|---|---|
| 1a | 1:1 invites, single-use, long TTL, auto-reissue | **No governed collision.** Fence F2 applies (redemption emits nothing). |
| 1b | Public multi-use invites, capped 25–100, visible expiry | **ESCALATION E1** — collides with adopted invite-rationing. |
| 2 | No dead-ends; "Request a fresh invite" fallback | **ALIGNED.** P-13's spirit at the community door — a knockable door, never a terminal wall. Cost note under F3. |
| 3 | Server-side validation BEFORE ToS + identity mint | **ALIGNED — this is CD-13.** "No half-born accounts" (`feature-backlog.md:303-306`): refusal happens pre-act with the failing condition named ("expired vs at-cap vs revoked" is exactly the failing-minimum-named discipline). `FloorRefusal` as a type already exists in the tree (`bdid-onboarding-design.md:85,132`). An identity minted against a spent token is a half-born join. |
| 4 | Idempotent re-open (resume, not re-consume) | **ALIGNED.** Same idempotency discipline as `Wallet::observe` (`bdid-onboarding-design.md:85`) — re-observation never double-consumes. |
| 5 | Owner controls: use-count + TTL sliders, live counter, reissue, convert-to-gate toggle | **ESCALATION E1** (the use-count slider is the same open question as 1b). The convert-public-link→request-access-gate toggle itself is unconflicted. |
| 6 | Mobile-native identity minting for invite joins; no desktop-pairing wall | **ALIGNED in direction** — `identity.mobile` Tier-1 default is Secure Enclave / StrongBox / passkeys (`CONSTITUTION.md:122`; PERSON-1 T1), and `RULING_KISS_BDID_PASSKEY_WALLET` (CANON) ships bDiD with passkey. A desktop-pairing wall on the join path would contradict the Tier-1 mobile default, so the directive's prohibition is law-consistent. **ESCALATION E2** on the funding half of the mint. |

No biometric surface anywhere in the six items — P-3 / BIO-1 B-2 untouched. No funds
flow through invites — the no-BNR-receiving-address rule
(`SPEC-BNROSE-ONBOARD.md:74-76`) untouched.

## §2 — Escalations, by name, not resolved

**E1 — b-tokenomics §2.10 (ADOPTED) vs owner-set invite caps (items 1b, 5).**
`b-tokenomics.md:161-165` adopted invite rationing by rank — qualify by attendance at
the most recent meeting; invites scarce as the community fills, down to one — as the
*replacement* for the rejected 5% recruitment commission (§3.3, whose rejection also
protects lineage-disjointness from deep single-rooted invite trees). The dispatch gives
owners free sliders up to ~100 redemptions per public link. **Open question this seat
does not decide:** does §2.10's rationing govern Buzz-surface community invites, or
only Respect-cascade communities? If it governs, the slider is bounded by the
rank-rationed allowance and "25–100" is illustrative, not free. Whatever is ruled, the
adopted anti-recycling rule (rejoin-after-eviction requires a new invite,
`b-tokenomics.md:574`) must survive it.

**E2 — Item 6's identity mint lands on the funded-wallet question that is IN FLIGHT.**
`RULING_KISS_BDID_PASSKEY_WALLET` (CANON) ships every bDiD with passkey + funded
wallet — genesis funding IS issuance. The funding *composition* is the open founder
question on the board (front-load the GAS, never the RESOURCE TOKEN — hypothesis, not
ruling; INDEX: "no seat builds against either reading"). The spec may *sequence* the
mint (after server-side validation, per item 3); no seat implements the funded-wallet
leg of an invite join until that word lands.

## §3 — Fences the drafted spec must carry (drafting requirements, not escalations)

**F1 — An invite gates a community's door, never THE door.** PERSON-1 P-13
(`PERSON-1.md:128-129`): admission to a cascade requires nothing — no invitation, no
sponsor, no fee. Eden required an invitation plus witnesses
(`LOVErnment-DAO/docs/research/D-2_eden_dossier.md:22`); P-13 rejected that shape for
personhood. The spec must state the two doors are distinct: no invite requirement may
ever gate cascade admission or bDiD creation as such. Invite-coded joins may *carry* an
identity mint (item 6); identity must never *require* an invite.

**F2 — Invites emit nothing, ever.** P-1 (gate, not payout) extended to membership:
issuing, redeeming, or reissuing an invite mints no b, accrues no Respect, pays no
commission in any form (§3.3's rejection stands).

**F3 — Invites are service-layer objects.** Art. V.1 (`CONSTITUTION.md:83`): the
paymaster abstracts user-funded cost and never absorbs it; the `resource.accounting`
row (`:128`) never subsidizes. Token storage, expiry timers, owner notifications, and
the request-access queue are surface infrastructure — none of it may become a kernel
resource drain, and any on-chain act at redemption is governed by E2's ruling, not
invented here.

## §4 — Adjacencies, named so nothing is read as opened

- **CONCEPT_B_COMPUTE_BID_WORKERBEE stays FILED, NOT SPECCED.** This dispatch is
  generic join mechanics; it does not open the concept's 5 questions.
- **SPEC-BNROSE-ONBOARD (the $10 walk) is a different door** — no text collision; a
  future cross-reference (one person may do both flows) is a drafting note only.
- **Series routing is open:** if the spec files as a BNRoSe-N doc, the Charter's
  leg-declaration rule binds (`SPEC-BNROSE-0-CHARTER.md` §0.1); it does not map cleanly
  onto L1/L2/L3, which suggests it may belong outside that series. Seat 0/1 routing call.
- **MIRROR-1 untouched** — recon substrate only; nothing here touches `skaists/buzz`
  or Stage 2.

## §5 — Bus actions taken this filing

Dispatch landed verbatim + this receipt + INDEX row (INDEX is Cowork-maintained; Seat 3
added the row rather than leave the board stale — deviation recorded for Cowork to
reformat). Committed and pushed under the self-executing docs-only cadence rule
(clean scan; founder word 2026-08-08). Commit and push receipts are in the session
report; the commit this file lands in is its own sha receipt.

## §6 — Attestation

No `Signed-off-by` emitted (ORDERS-1 §3 DCO clause). Credit via `Co-Authored-By`.
Model actually at this seat this sitting: **Claude Fable 5** — noting §1 pin table
lists Seat 3 primary as Opus 4.8; a re-pin is a founder one-line diff
(ORDERS-1 §1), flagged here, not performed. Nothing designed, nothing implemented,
no escalation resolved.
