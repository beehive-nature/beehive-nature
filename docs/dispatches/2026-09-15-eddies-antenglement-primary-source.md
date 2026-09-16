# EDDIES / ANTENGLEMENT — primary-source evidence banked, artifact still unretrieved · 2026-09-15

**Seat:** zCode. **Trigger:** the Claude seat's 2026-09-15 analysis of developer
**eddde**'s two messages, relayed here by the founder, with the instruction to
append its investigation block verbatim to the protocol-reuse queue and to
preserve the primary-source material. **What this dispatch is:** the evidence
bank + provenance chain. **What it is NOT:** a description of how Eddies work —
no code or specification has been seen by any seat in this chain; every
mechanical statement below is interpretation of two developer messages and one
screenshot, and is marked as such.

## Provenance chain (whole chain, because nothing else is verifiable)

```
eddde (developer, originals in founder's custody — channel NOT on our record)
  → two messages dated 2026-09-10 and 2026-09-15 (as labeled by the analysis;
    the analysis also calls the second one "yesterday's", so the labels are
    relay-side, UNVERIFIED) + one screenshot + a linked "How Eddies Work"
    artifact (URL not on our record)
  → Claude seat analysis, 2026-09-15 (blocked from retrieving the artifact;
    public web searches surfaced no specification)
  → founder relay to zCode seat, 2026-09-15 (this dispatch + queue item #1 in
    docs/agents/PROTOCOL-REUSE-QUEUE.md, appended verbatim)
```

**Not in our custody:** the verbatim message texts, the screenshot file, the
artifact URL/contents, and eddde's channel/affiliation. This dispatch banks the
relay faithfully and flags every gap. If the founder pastes the originals, they
land in a follow-up section here, byte-true.

## The two messages, as relayed (Claude seat's wording — secondary source)

**2026-09-10:** Eddies apparently associate ANT-node/Farm uptime with "funds"
and an application-denominated **€$** balance; "42 funds" is stated to
correspond to the app balance. A **pay-link** mechanism is described. The
developer states that if a recipient does not yet accept Eddies, an obligation
may remain — the relayed example: *"your renter owes you €600 whenever they
start accepting or paying with Eddies."*

**2026-09-15:** the developer describes **"antenglement"** as allowing
blockchain ANT that the user "keeps" to be spent, with the requirement that the
user **run an ANT node** to keep the mechanism active.

## Screenshot clues (as listed in the analysis; file not banked)

- `MONEY X currency €$200` — an app balance line.
- An **Ethereum-address-like identifier** (0x…; full value not on our record).
- Entries `€$100 (0)` and `€$100 (24)` — the parenthesized numbers' semantics
  (hours? count? state?) are UNKNOWN; preserve the observation, assume nothing.
- ANT imagery.

UI balances establish nothing about collateralization, redemption, settlement
finality, or economic value — the do-not-assume list in the queue item governs.

## Retrieval attempts, receipted

1. **Claude seat (2026-09-15):** external retrieval of the linked "How Eddies
   Work" artifact blocked; public web searches found no specification.
2. **zCode seat (2026-09-15, this session):**
   - WebSearch `"antenglement" Autonomi ANT` → **zero results** for the term in
     any combination (only Autonomi ANT price-page noise).
   - WebSearch `"Eddies" Autonomi ANT node "how eddies work"` + variations
     (`Autonomi network "eddies" ANT node rewards`, `"how eddies work"
     Autonomi`, `Autonomi "eddies" ANT earn tokens forum`) → **nothing in an
     Autonomi context**; only fluid-dynamics and off-topic hits.
   - Conclusion: **no public spec, no indexed artifact.** The artifact's
     contents must come from eddde or a founder paste. Nothing below or in the
     queue manufactures mechanics that may already be precisely defined there.

**CITATION LAW banked from the search itself:** in Autonomi-adjacent searches,
"ANT" also matches the dead **Aragon (ANT)** governance token — a different
asset. In our receipts ANT always means the Autonomi Network Token; never blend
the two.

**Affiliation unknown (do not assume, addendum to the queue's list):** nothing
on our record says eddde is or is not affiliated with WithAutonomi/Autonomi
officially. Eddies is therefore NOT an update to any adaptor in the 2026-09-12
eco-adaptor sweep (whose WithAutonomi row stands as swept); it is a new,
unaffiliated-until-proven third-party system under investigation.

## Interpretation frame (the Claude seat's, preserved with attribution)

Three things the terminology suggests keeping distinct: (1) the ANT blockchain
asset, (2) the ANT node/Farm whose uptime/activity is associated with "funds",
(3) the app-denominated €$ balance and Eddie obligations/receivables. The
load-bearing sentence is the obligation-persistence one: €$600 displayed by the
application may be a **payment capability/claim**, not €600 of redeemable euros
anywhere — exactly what the archaeology/reuse investigation must establish
before €$ is treated as money.

The architectural resemblance worth testing — against our Silent Pay model's
**funding authority → usage/metering → receipt → settlement** — is a
conceivable **ANT/node participation → earned capability/credit → payment
instruction → eventual acceptance/settlement** separation. If sound (issuance,
redemption, conservation, double-spend, failure semantics), an Eddie-shaped
primitive could matter as an **obligation/receivable representation** for
machine economies — verifiable obligations that accumulate and later net/settle
— or as an adapter beneath `b`. Neither is recommended on conceptual
similarity; the 28-question brief in the queue is the gate.

## Landing receipt

- Queue item #1 appended verbatim → `docs/agents/PROTOCOL-REUSE-QUEUE.md`
  (this file's creation; the Astra protocol-reuse seat named in
  `docs/agents/BUZZ-BOX-SRE-SEAT.md` now has its queue artifact).
- Worktree `../wt-zcode-eddies`, branch `zcode/eddies-antenglement-2026-09-15`,
  cut from `origin/main` (bd939bf8) per the worktree-cut law; committed with §7
  seat shape; pushed.

## Open items (blocking the investigation)

1. **"How Eddies Work" artifact contents** — founder paste (copy/export) is the
   only known road in; two seats' retrieval attempts are exhausted.
2. **Verbatim originals** of eddde's two messages (and the screenshot file) —
   to be banked byte-true here when relayed; dates re-confirmed against them.
3. Then the reuse seat works queue item #1's 28 questions against
   code/specification only.
