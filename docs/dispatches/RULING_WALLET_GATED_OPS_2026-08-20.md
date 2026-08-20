# RULING — operations behind a logged-in wallet, everywhere in the BNRoSe ECO

**Founder word, verbatim (2026-08-20, in-session):** *"sounds like the inscription scanning
could be a DDOS vulnrubility; mod to severe risk just put the operations/functions behind
logged in wallet (that should be with them anywhere any everywhere thoughout the entire
BNROsE ECO."*

Recorded per the standing law that a founder ruling spoken in conversation is a ruling.
Security lane, binds every seat.

---

## 1 · The threat model, graded honestly

**What inscription scanning is:** multi-call read crawls (holder enumeration, record
reads, render calls) against chain data — cheap per call, unbounded in aggregate.

**Today's exposure — LOW, by construction (swept and receipted 2026-08-20):** every
surface in the tree is static (GitHub Pages); every POST found by sweep
(`grep -rln "method:'POST'" surfaces/`) is the **visitor's own browser** calling
third-party public rails (chain RPCs, Blockscout, DexScreener, the Bluesky view API,
base.domains). **BNR operates zero server endpoints.** A stranger hammering the
inscription explorer burns their own IP's reputation with public RPCs — not our quota,
not our infrastructure. The 8d test passes by accident: no scan costs the hive anything.

**Where the founder's moderate-to-severe grade becomes real — at the moment any of these
wire (none has yet):**

| vector | mechanism | severity |
|---|---|---|
| rail-2 quota (QuickNode or any keyed endpoint) reachable by anonymous-triggered ops | strangers spend **our** quota into billing; free tier exhausted → alpha/beta functions die | **severe** (cost + outage) |
| b-indexer (or any served API) deployed publicly without a gate | unbounded enumeration crawls against our process/SQLite | **moderate** (capacity; read-only by construction — no write surface exists to abuse) |
| webhook/Stream receivers, OFFER/escrow/marketDEX ops | state-changing endpoints hammered or replayed | **severe** (integrity + capacity) |

The ruling lands **now, before** those wire — the gate is cheap at design time and
expensive retrofitted. Rail-2's exit criterion (DISPATCH_SCALE_RAILS §2) already forbids
subscription drift; this ruling closes the other half: **our quota is never spendable by
the anonymous.**

## 2 · THE LAW

**Every operation/function in the BNRoSe ecosystem — anything that triggers server-side
work, spends quota, writes state, crawls, backfills, or pushes — sits behind a
logged-in wallet. Anywhere. Everywhere. No exceptions granted by convenience.**

**Viewing stays open.** The museum renders, the education surfaces teach, public reads
answer — anonymously, as they do today. An address is required **to do**, never **to
see**. (Seat's reading of the founder's words, consistent with the education mission and
the museum dead-network law; one word from the founder overrides it.)

## 3 · The pattern (build it the same way everywhere)

**Wallet session, SIWE-shaped — the address is the session:**

1. Client requests a nonce; signs a session message with the connected wallet; the
   signature verifies against the address. **No password, no email, no PII** — a
   pseudonymous address, consent-law compatible. A wallet session is **not** bzDiD, never
   becomes one, and confers no identity claim beyond key possession.
2. Sessions gate **ops only**: scan crawls, enumeration jobs, backfills, webhook
   receivers, offer/claim/escrow actions, anything that touches rail-2 quota.
3. **Per-address rate limits and quotas** ride the session — the caller-pays doctrine
   (Article V.1 / hardline 8d) made mechanical: the wallet that triggers the cost owns
   the cost's attribution. Abuse becomes attributable and throttleable per address.
4. Fail-closed: no session → the op endpoint does not exist (404-shaped), never a
   detailed rejection.

## 4 · Mapping, per artifact

| artifact | gate status |
|---|---|
| all current surfaces | **no change owed** — zero ops exist today (sweep-receipted); any NEW op lands with the gate or does not land |
| inscription-explorer / museum scans | client-side public-rail reads stay lawful (cost lands on the visitor's own IP); any future server-side scan helper → gated |
| `crates/bindexer` serve | GET-only stands (sendtx permanently NO — SPEC-BINDEXER-0's most important row); **scan-class endpoints gain a wallet-gate middleware flag before any public deployment**; owner-lane note filed |
| rail-2 (QuickNode/webhooks/streams) | no anonymous-triggerable quota, ever; webhook receivers validate origin + gate state changes; EGRESS row owed at wire time (standing law) |
| bRoSe OFFER / escrow / marketDEX | ops by definition — wallet-gated from day one (their consent-first law already implies it; this makes it mechanical) |
| consent-station surface (zAgent lane) | the wallet session composes with consent-first: the session proves key possession, consent proves intent — never conflate them |
| ERC-8004 agent lane (if N-3 opens) | agent registrations under founder-held keys per the rails dispatch — machine side has its own key discipline |

## 5 · Standing consequences

- New-op review question added to every future surface/API spec: **"where is the wallet
  gate?"** — an ops-bearing artifact without an answer does not merge.
- The DoS posture stays defense-in-depth: static anonymous viewing (nothing to hammer),
  gated attributable ops (abuse throttleable per address), keyless permanent rails
  (rail 1 — nothing of ours to exhaust).

*Read-only verification throughout; no endpoint was probed beyond our own tree, no key
material touched.*

---

## 6 · ADDENDUM, same night — the boundary question answered: the dangling-art doctrine

The seat's reading (§2: ops gated, viewing open) was put to the founder with one
alternative (everything gated, even viewing). His answer, verbatim:

> *"autonomous redundent chaos adoption velocity we dangle more of the art in front
> until we hit limits? would that be a waste?"*

**The reading stands, extended into doctrine:**

1. **Viewing stays open — and we dangle MORE, not less.** Maximum anonymous exposure of
   the collection is the adoption-velocity engine, and on the current rails it costs the
   hive nothing: static Pages (free, effectively unbounded) + chain reads executed by the
   **visitor's own browser** against public RPCs (their IP, their rate limits). Dangling
   art this way is not a waste — it is free distribution. The waste-vector exists only if
   viewing is ever routed through OUR quota (rail-2), which §2 already forbids.
2. **The limits we hit are signals, not walls.** When a visitor's public-rail experience
   degrades (their 429s) or a free tier ends, that is the trigger to cache harder or
   migrate the function to the sovereign rail (rail 1) — never a trigger to gate the art
   behind login.
3. **The wallet session is a door to MORE dangling, never a wall in front of it.**
   Anonymous sees the collection; a session unlocks deeper scans, personal galleries,
   own-holdings views, offers and claims. Sessions personalize and attribute; they do not
   ration the art.
4. **The posture has its name from the founder's own words: autonomous, redundant,
   chaos-tolerant, adoption-velocity-first.** Static-first (nothing of ours to hammer),
   operator-diverse redundant oracles (two-operator law), dead-network honesty when
   things break, and the gate exists to keep that machine fundable and attributable —
   serving velocity, never throttling it.
