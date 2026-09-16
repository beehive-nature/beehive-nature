# PROTOCOL-REUSE QUEUE — Astra seat (ADOPT / ADAPT / WRAP / WATCH / BUILD)

**What this is.** The investigation queue for the planned HIGH protocol-reuse seat,
as chartered in the Buzz Box SRE seat document (`docs/agents/BUZZ-BOX-SRE-SEAT.md`):
*"Astra = synthesis + architecture review. Later HIGH protocol-reuse seat
(OpenA2A/AIM, AIP/AAP/ATX, OpenCompany, ADOPT/ADAPT/WRAP/WATCH/BUILD); LOW
sessions = bounded workers from findings."* Until that seat is seated, this file
IS the queue — any seat may append an item verbatim with attribution and
provenance; the reuse seat works items top-down.

**Laws that bind every item here:**
- Classification vocabulary is **ADOPT / ADAPT / WRAP / WATCH / BUILD** — nothing
  else. A verdict without implementation evidence is not a verdict.
- Crypto-language + citation law: claims cite sources; no overclaiming.
- Fresh receipts only; a worked item links its evidence dispatch.

**Item shape:** status (OPEN / IN WORK / DONE-VERDICT) · received date ·
attributed source · evidence pointer.

---

## 1 · EDDIES / ANTENGLEMENT INVESTIGATION — OPEN

*Received 2026-09-15, appended verbatim from the Claude seat's analysis, relayed
by the founder. Primary-source evidence, provenance chain, and both retrieval
attempts: [`docs/dispatches/2026-09-15-eddies-antenglement-primary-source.md`](../dispatches/2026-09-15-eddies-antenglement-primary-source.md).
The "How Eddies Work" artifact is NOT publicly retrievable (zero web index
hits for "antenglement" or Eddies-in-Autonomi-context, checked from two seats) —
a founder paste of its contents is the only road in.*

```text
EDDIES / ANTENGLEMENT INVESTIGATION

New primary-source material from developer eddde:

2026-09-10:
Eddies apparently associate ANT-node/Farm uptime with "funds" and an
application-denominated €$ balance. A pay-link mechanism is described.
The developer states that if a recipient does not yet accept Eddies,
an obligation may remain for future acceptance/payment.

2026-09-15:
Developer describes "antenglement" as allowing blockchain ANT that
the user "keeps" to be spent, with the requirement that the user run
an ANT node to keep the mechanism active.

DO NOT assume:
- €$ is EUR
- €$ is a stablecoin
- displayed €$ is redeemable fiat
- "funds" means blockchain funds
- ANT is locked
- ANT is bridged
- ANT collateralizes €$
- node uptime itself creates monetary value
- antenglement uses quantum mechanics
- an Eddie represents final settlement

Determine from CODE/SPECIFICATION if available:

1. What exactly is an Eddie?
2. What exactly is a "fund"?
3. Why does 42 funds correspond to the stated app balance?
4. What creates €$ units?
5. What destroys €$ units?
6. Is €$ transferable?
7. Is it redeemable, and for what?
8. What backs it?
9. What does a pay link cryptographically contain?
10. What constitutes payment acceptance?
11. What does "owes you" mean in the state machine?
12. Can obligations expire?
13. Can they be repudiated?
14. Can they be double-spent?
15. Can obligations be netted?
16. What happens when counterparties never adopt Eddies?
17. What role does ANT-node uptime actually play?
18. What role does blockchain ANT actually play?
19. Does ANT move on-chain?
20. Is ANT locked, delegated, signed, proven, referenced, or untouched?
21. What is "antenglement" technically?
22. What happens when the ANT node goes offline?
23. What identity links ANT node ↔ Eddie ↔ blockchain address?
24. Is that relationship publicly linkable?
25. What Sybil resistance exists?
26. What conservation invariant exists?
27. What recovery mechanism exists?
28. What settlement/finality model exists?

Then compare these primitives against:

Silent Pay v2
FeePlan
b-meter receipts
payment/delivery state machines
ANT settlement adapter
RAiD identity/capabilities

Classify each useful component:

ADOPT / ADAPT / WRAP / WATCH / BUILD

Do not recommend integration based on conceptual similarity alone.
Require implementation evidence.
```

**Working hypothesis carried alongside (interpretation, NOT evidence):** Eddies
may be a parallel credit/obligation system whose earning logic associates with
ANT-node operation — distinct in kind from a settlement/bridge mechanism. The
architectural resemblance worth testing is the shared separation of
**earning/participation → capability/credit → payment instruction → eventual
settlement** against our **funding authority → usage/metering → receipt →
settlement** (Silent Pay v2 / FeePlan / b-meter). The interesting reuse
candidate, IF soundness is established, is an obligation/receivable
representation for machine economies — not "another currency" behind `b`.
