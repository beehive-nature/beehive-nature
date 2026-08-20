# DISPATCH — bMessenger, Royal-guard peer review, and the bLOVErAi window

**From:** Seat 3 (Claude Code) · **2026-08-19** · founder-directed (mobile relay)
**Status:** OPEN — §1 names what already exists; §2–§4 are proposals with founder gates.

Founder, verbatim: *"do you think we can add a peer review analytics for me of how they
interact; preserving privacy. they will be able to communicate with me directly via
bMessenger private scalable to 10 billion for at least 1000 years at no scaling cost or
operating cost to the hive; we have already talked about it enough so check all your docs
and ledger. should have a bLOVErAi prompt window in the same surfaces/pages. we are peer
reviewing as Royal BNR guards reviewing the peer reviewers."*

---

## 1 · The docs check: bMessenger already exists in the tree — it just never had the name

The word "bMessenger" appears nowhere in docs/ or the ledgers. The **thing** does:

| piece | where | state |
|---|---|---|
| identity, free at 10-billion scale | `docs/bzdid-architecture-decision.md` — `bzDiD = hash(genesis_op)`, "no issuer, no ordering, no registry, no DA, no chain bytes, no cost"; `:245` a free identity needs **no authoritative store anywhere** | RULED |
| transport | `surfaces/blight/relay.js` — Nostr wss to public relays, v1 live (read + plaintext pointer broadcast) | LIVE v1 |
| payload law | `surfaces/blight/pointers.js` — **a message is a POINTER, never content**; one grammar, ≤140-char note | LIVE |
| the feed | `surfaces/blight/pulse.html` | LIVE |
| address binding | `surfaces/keys/addresses.html` — npub is an ADDRESS of the root, not the root; derivation context registered | LIVE |
| privacy (E2E) | relay.js header: "E2E (NIP-44 + secp256k1 vendored from bzdid-key) docks as **TASK 6b**" | **THE GAP** |
| durability | `docs/SPEC-PAY-ONCE-NOW-1.md` — pay-once invariants for all durable data | RULED |

**So bMessenger = the founder's name for this rail**, and the scaling claim decomposes
honestly:

- **10 billion**: holds — identity is the bzDiD arithmetic ($3.56, once, for 10 billion
  identities), and there is no hive-side per-user row anywhere (the no-authoritative-store
  ruling).
- **No scaling or operating cost to the hive**: holds — public relays are third-party
  infrastructure the hive neither runs nor funds; durable payloads are pay-once,
  **payer = sender** (Article V.1: users fund what they consume).
- **1000 years**: holds for the **durable layer only** (pay-once storage + render-from-chain).
  Public Nostr relays are ephemeral transport with no millennium guarantee — the pointer law
  is exactly what makes that acceptable: losing a relay loses a notification, never content.
  Stated plainly so the claim never outruns the mechanism (security-language ceiling).

**Direct line to the founder**: guards DM the founder's npub — E2E once TASK 6b lands.
**TASK 6b is therefore the blocking lane of this whole dispatch** — "private" is the one
adjective in the founder's sentence the live v1 does not yet earn. NIP-44 v2 is
ChaCha20+HMAC with a conversation key from secp256k1 ECDH; the secp256k1 vendoring docks
with the key engine per addresses.html. Nothing here invents crypto — cite or stop applies
to the implementation.

## 2 · Peer-review analytics that preserve privacy: attestation, not telemetry

**The fence first:** this tree severs analytics beacons on principle
(RAID_AUTHENTIK condition 1), and recover.html's zero-network guarantee is law. A tracking
pixel on the hub is not on the table. What IS lawful — and stronger — inverts the
direction: **nothing observes the reviewer; the reviewer attests.**

- **Review receipt** = a signed `[bX review]` pointer event: reviewer's bzDiD signs
  {surface reviewed, verdict, ≤140-char note, url}. Published deliberately via relay.js —
  the same act as sending a message, because it IS one, addressed to the founder and CC the
  pulse.
- **Analytics** = aggregation over voluntarily published receipts: who reviewed what, verdict
  distribution, coverage map of surfaces nobody has walked. Renders as a static surface from
  relay reads — no server, no store, no cost (the pulse pattern).
- **Privacy boundary**: interaction is never captured — a reviewer who walks every page and
  publishes nothing has left nothing anywhere. What exists is exactly what was signed. A
  reviewer can hold a persona npub (the persona-nullifier label already exists in the key
  engine's v1 constants) so review standing and civil identity stay separable.

## 3 · Royal BNR guards: the second-order review is already our reputation grammar

"Guards reviewing the peer reviewers" is provenance-weighted attestation, which the kernel
already rules: **claims support, never authorize** (dispute-engine Tier-1), and respect is
arithmetic over settlement facts, never a worldview (VOCABULARY Law 2). Concretely:

- A **guard verdict** is a signed `[bX guard]` pointer referencing a review receipt's event
  id: {verified sig ✓/✗, reviewer bzDiD standing at time of review, guard's own verdict}.
- Guard verdicts **weight** reviews in the analytics render; they never delete or gate them
  (popularity never auto-enforces — same clause).
- Guards are named bzDiDs the founder appoints — the roster is a founder act, not code.

## 4 · The bLOVErAi prompt window — three lanes, one doctrine, founder picks

Doctrine that binds (memory + SPEC-BLOVERAI-BZDID-BONDING-1): bLOVErAi is **on-device,
fail-closed, holds no DID**; every agent falls under bQueenBee or a unique human bzDiD; and
surfaces carry **no hive-operated server** (Article V.1). Any lane that proxies prompts
through a hive box is disqualified before it starts.

| lane | mechanism | wins | costs |
|---|---|---|---|
| **W-1 in-browser model** | WebGPU LLM (e.g. WebLLM-class, Apache-2.0 — separate L-VERIFY) inlined as a surfaces module; weights fetched once, cached, then offline | truly on-device, zero hive cost, fail-closed by construction (no model → window says so honestly) | first-load is hundreds of MB; phone coverage uneven |
| **W-2 bring-your-own venue** | prompt window composes to the user's OWN bLOVErAi venue (broom-agent lineage) on their LAN/device | full-strength model, doctrine-clean | only serves users who run a venue; that is the stubborn few today |
| **W-3 prompt-builder handoff** | window builds a context-rich prompt (page state, seed, review grammar) the user pastes into whatever AI they hold | works today on every phone, zero bytes shipped | not conversational; the AI is theirs, not bLOVErAi |

**Recommendation: W-3 now (it is an afternoon and serves the inner-circle review round
immediately), W-1 as the real build behind it, W-2 stays the power-user path.** The window
is one shared module on the same pages as the review grammar, so "ask bLOVErAi about this
page" and "publish a review receipt" sit side by side.

## 5 · Founder gates

| | question | blocks |
|---|---|---|
| **G-1** | bLOVErAi window lane: W-3 now + W-1 build — yes/no/other | §4 |
| **G-2** | Review-receipt + guard-verdict kinds (`[bX review]`, `[bX guard]`) and the guard roster | §2, §3 |
| **G-3** | TASK 6b (NIP-44 E2E) jumps to the front of the surfaces queue — confirm | §1 "private" |

Nothing in §2–§4 is built yet; this dispatch is the check-the-docs answer plus the smallest
honest design that fits inside standing law. One word per gate starts the lane.

**Seat 3, 2026-08-19.**
