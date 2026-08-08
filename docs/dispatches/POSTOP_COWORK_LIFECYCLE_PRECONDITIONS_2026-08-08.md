# POST-OP NOTE — COWORK · DAO LIFECYCLE PROOF, PRECONDITION SURVEY
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md` (ratified 2026-08-08). **Date:** 2026-08-08.

---

## PRE-OP STATE
Task received: **one DAO, full lifecycle end-to-end on Jungle** — register, change at 28
days, renew at 365, lapse, reclaim — **zero contract calls except the epoch root**, receipts
at every step.

Applied the new delegation filter to the task itself before starting:
1. Moves a user toward existing / a resource toward autonomous metering — **yes**.
2. Survives 10^10 × 1000 years, no human in the loop — **yes, that is what it proves**.
3. Live surface someone will run — **yes, Jungle4**.
**Passes all three. Task accepted.**

## PROCEDURE PERFORMED
Precondition survey only. **No lifecycle steps executed** — see COMPLICATIONS. Two live
`get_info` calls against independent Jungle4 endpoints; dependency and custody audit against
standing law.

## SEATS PRESENT
**Cowork** (this note, all findings below). Task authored by **Seat 0**. Upstream
dependencies belong to **Code** (anchor contract) and **goose** (validity rules + vectors) —
named per LAW 8c; **no finding here originates with them.**

## FINDINGS

**F1 — Jungle4 is reachable from this seat. VERIFIED.** Two independent endpoints agree:

| | value |
|---|---|
| `chain_id` | `73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d` <!-- PUBLIC-CONSTANT: Jungle4 testnet chain id, returned by every public Jungle4 endpoint --> |
| head block | 280,516,785 / …786 |
| head block time | 2026-08-08T22:51:47 |
| endpoints | `jungle4.cryptolions.io` (v1.2.2), `jungle4.api.eosnation.io` (v1.2.1) |

This mattered to check first: the Hive API is **proxy-blocked (403)** from this sandbox, so
reachability could not be assumed by analogy. Jungle4 is not blocked. **The live surface is
available.**

**F2 — The lifecycle is almost entirely off-chain, by design.** Under the reset, register /
change / renew / lapse / reclaim are **properties of signed records**, not contract actions.
The only on-chain event in the whole lifecycle is the **epoch root**. Consequence for this
proof: the bulk of the work is **producing and verifying signed records**, and the chain
interaction is a single anchor call per epoch. **REPORTED** as the ruled design; the record
format that makes it executable does not exist yet (D1).

**F3 — Simulated time is required and is a design decision, not a convenience.** The proof
must exercise a **28-day** change interval and a **365-day** term. These cannot be waited
out. Whether validity intervals are evaluated against **wall-clock**, **epoch sequence**, or
a **record-carried timestamp** determines both how the proof is run *and* what the resolver
actually enforces. **UNVERIFIED — belongs to goose's validity-rule spec**, flagged here
because a proof harness built against the wrong assumption would silently prove nothing.

## SPECIMENS
- `GET https://jungle4.cryptolions.io/v1/chain/get_info` → HTTP 200, JSON above.
- `GET https://jungle4.api.eosnation.io/v1/chain/get_info` → HTTP 200, matching `chain_id`.
- No crate refs — no source was read in this procedure (LAW 8a: nothing to stamp).

## COMPLICATIONS

**C1 — BLOCKED on two upstream deliverables. Not a defect; sequencing.**
- **Code's anchor contract** must be deployed to Jungle before any epoch root can be
  submitted.
- **goose's validity rules + test vectors** define the signed-record format. Without them
  there is nothing well-formed to sign, and a record invented here would be **fiction the
  resolver would later reject** — the proof would assert a design that does not exist.
  The founder's own ordering (Code → goose → Cowork) anticipates this; recording it so the
  block is visible rather than inferred.

**C2 — KEY CUSTODY IS UNRESOLVED, AND IT IS MINE TO SURFACE, NOT TO DECIDE.**
The lifecycle requires **signing records as a bDiD** and submitting **at least one epoch
root** — both need private key material and a funded Jungle account.

Standing law reads: *"no agent ever holds, requests, or transmits private key material;
mainnet founder keys never pass to any seat; **throwaway keys only on testnets**."* That
final clause **may** permit a testnet throwaway key. But **Cowork's own accepted fences**
(ACK, 2026-08-07) state: *no key material, no seed/PIN/passphrase, no signing surfaces.*

**A seat does not widen its own fence by reinterpreting it.** The two readings are not
reconciled by anything on record, so I am stopping here rather than generating a key and
proceeding under the more permissive one. **This is a founder word, and it is small:**

- **(i)** Cowork may generate and hold a **throwaway Jungle-only** key for this proof, keys
  never leaving the testnet and never reused; **or**
- **(ii)** Code holds the Jungle account and signing, Cowork drives the lifecycle and
  records receipts; **or**
- **(iii)** the founder supplies a funded Jungle account and Cowork operates it within a
  stated bound.

**No option is recommended.** Any is workable; the proof cannot start until one is chosen.

**C3 — The secret-scan pre-commit hook BLOCKED this note on first commit. Working as
designed; recorded rather than silently worked around.** The Jungle4 `chain_id` is a 64-hex
run, which the scanner treats as key/seed/vector-shaped. Resolved by annotating the line
`PUBLIC-CONSTANT` per the scanner's own documented escape — **not** by `--no-verify`, which
the hook itself names as a last resort and which CI would re-catch on push anyway.

Worth carrying: **a public chain id and a private key are the same shape to a scanner.**
Every future post-op note recording a chain id, block id, or tx hash will hit this. The
annotation is the correct answer each time; reaching for `--no-verify` because "it's
obviously just a chain id" is how a real key eventually rides through on the same reasoning.

**C4 — No defects found in ratified artifacts.** This procedure changed no code and no
prior doc.

## DISPOSITION

**Sufficient alone for the next operator (LAW 8f):**

1. **Jungle4 is live and reachable; chain_id `73e4385a…716c4d`.** Do not re-verify.
2. **The lifecycle proof cannot start until (a) Code's anchor contract is on Jungle,
   (b) goose's record format + vectors exist, and (c) key custody is ruled (C2).**
   (c) is the one that is **not** upstream work — it needs one founder word and can be
   answered now, in parallel, so it is not discovered as a blocker after (a) and (b) land.
3. **Do not build a proof harness against an assumed record format or an assumed time
   model.** F3's time question changes what the harness proves.
4. **All v3 frozen-contract work is stopped** per the reset — Cowork holds no v3 work and
   opened none this turn.

**Nothing in this note is a document about the design.** It records a live-surface check, a
sequencing block, and one unresolved custody question. The proof itself remains unstarted
and unfabricated.
