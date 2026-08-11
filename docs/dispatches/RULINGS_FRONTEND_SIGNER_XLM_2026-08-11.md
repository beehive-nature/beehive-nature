# RULINGS — FRONTEND STACK · CAPPED-SPEND ENFORCEMENT · XLM RAIL
**Ruled by:** Seat 1, self-resolved under the autonomy directive, 2026-08-11.
**Landed in-tree by:** Cowork — **transcription, not authorship** (LAW 8c).
**Status: CANON.** These three were stated direction that had never reached the tree.

> **⭐ WHY THIS FILE EXISTS, AND IT IS THE POINT OF ALL THREE:** ruling 1 was the founder's
> stated direction for some time, **but the repository still said Leptos** — so Claude Design
> was building against a tree that contradicted the direction, and was right to. **A ruling
> that lives only in chat is not yet a ruling of the room (LAW 8y).** Direction is not
> landed until the documents it supersedes point at it.

---

## RULING 1 — FRONTEND STACK (FORMAL)

**`htmx` + `hx-boost` + `Alpine.js` + `WASM` are PRIMARY.**
**React ONLY where it measurably wins** — the minority case, and "measurably" is the load-
bearing word: a preference is not a measurement.
**Leptos and D1 are SUPERSEDED.**

**Superseded documents — banners added, bodies left standing:**

| document | Leptos references | disposition |
|---|---|---|
| `docs/DESIGN-BRIEF-03-wallet-operations-mvp.md` | 10 | superseded banner at top; body left standing |
| `docs/dispatches/DISPATCH_WALLET_MVP_VPS_2026-08-10.md` | 7 | superseded banner at top; body left standing |
| `docs/ledger/pirate-haul-candidates.md` | 1 | **left alone** — a candidate ledger records what was *considered*, and rewriting it would falsify the record |

**Bodies are not rewritten, deliberately.** A brief is a record of what was asked for when
it was written; editing 17 references would erase the reasoning that produced the current
designs and risk silently changing intent I did not author. **The banner is the correction;
the body is the history.**

## RULING 2 — CAPPED-SPEND ENFORCEMENT IS **SIGNER-AUTHORITATIVE**

**The cap is enforced at the tier that holds the key:**
- **Trezor firmware** where the rail supports it;
- **the JWK signer** otherwise.

**The relay pre-checks the same cap as ADVISORY defence-in-depth — and is NEVER the
authority.**

> **The reason, which is the rule:** **a keyless relay can be replaced, so a cap only it
> enforces is not a cap.** An attacker who swaps or bypasses the relay inherits an
> unbounded spend. Enforcement has to sit where the signature is produced, because that is
> the one component an attacker cannot route around without the key.

**This is the same shape as every other property this room has had to fix this week:** a
guarantee that depends on a component which can be swapped is not a guarantee. Ed25519
non-malleability held by library accident; `canon()` injectivity held by field ordering;
the Merkle fold held by nobody checking the shipping Rust. **Same failure, third layer.**

**BUILD BOTH, AND LABEL WHICH IS WHICH.** The relay check must be visibly advisory in code
and in UI, or the next reader will assume the relay is the authority — and then someone
will "simplify" the signer check away as redundant.

**Claude Design is unblocked:** the capped-spend control ships **ENABLED**, with a
**"signer-enforced (relay pre-checks)"** badge. The badge is not decoration — **it tells the
user which tier is actually protecting them.**

## RULING 3 — XLM IS A FIRST-CLASS RAIL

XLM is in the rail set and in the brief. It **folds into the D3 phase plan with its own
`SOURCE` / `ENFORCEMENT` slots**, exactly like every other rail.

**It is NOT left `Absent`.** `Absent` is a gauge state that means *we looked and there is no
witness* — using it for *we did not get to it yet* corrupts the vocabulary the whole
dashboard depends on. **A rail we have not wired is an unfilled slot, not an absent witness.**

---

## WHAT THIS DOES NOT DO

- **No implementation.** Ruling 1 names the stack; migrating D1 is Design's lane.
- **No cap VALUES.** Ruling 2 fixes *where* the cap is enforced, not what it is. No number
  appears in this document.
- **No XLM rail wiring.** Ruling 3 puts XLM in the plan; goose's Work Order B fills its slots.

## COMPLICATIONS

**C1 — The two superseded documents still read Leptos throughout their bodies.** The banner
is at the top and unmissable, but **a seat that jumps to a mid-document section will read
superseded guidance.** Accepted deliberately over rewriting another seat's work; **flagged
so it is a known cost rather than a surprise.** If Design would rather the bodies be
migrated, that is a Design-lane task and I will not do it unasked.

**C2 — "React only where it measurably wins" has no measurement defined here.** Ruling 1
sets the bar; **nothing in the tree says how to clear it.** Whoever proposes React first
will have to define the measurement, and that definition should come back as a ruling
rather than be settled case-by-case.

**C3 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched.
