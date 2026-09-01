# SPEC-LOVERNMENT-DAO-1 — the DAO genesis, the guest gate, and the 7776 structure

Status: GENESIS RULING (founder, 2026-08-31) · Source reads: block/sprout @ box:~/src

## §the-10k-truth — what buzz's 10,000 actually is (read at source)

`crates/buzz-core/src/invite.rs:21` — `pub const MAX_INVITE_USES: i32 = 10_000;`

**It is neither active members nor total room members. It is the maximum
number of TOTAL REDEMPTIONS of a single invite link.** One invite link can be
used 10,000 times, ever, within its lifetime (TTL: 60s minimum, 72h default,
30d maximum — same file). A room itself carries **no member cap anywhere in
the codebase** (verified: no MAX_MEMBERS / member_limit / capacity constants
exist). Community size is bounded only by how many invites the owner mints.

So the founder's question, answered: **total (per invite), not active** — and
the room cap the founder assumes does not exist yet, which is exactly the gap
the guest quota fills.

## §membership-gate — already true at the relay (verified at source)

- **NIP-42**: every WebSocket connection faces challenge/response auth (the
  client signs a kind:22242 event; auth events are never stored or logged).
- **NIP-98**: every HTTP path carries signed kind:27235 auth.
- **Channel access**: `buzz-auth/src/access.rs` — `ChannelAccessChecker`
  enforces per-channel roster membership, community-fenced (a cross-community
  existence oracle is named and forbidden in the source itself).

**Ruling held by construction: buzz room access is membership-gated.** No
guest reads a byte without passing the roster.

## §guest-quota — the new surface (TO BUILD)

Founder's ruling: rooms may admit guests **up to a voted amount**. Nothing in
buzz models this today — membership is binary (roster member or outsider), and
the only admission instrument is the owner-minted invite.

Design shape (the lane, when it opens):
- a **guest pass tier** distinct from member (time-boxed like invites, but
  counted against the room's guest allowance);
- the **allowance is a voted parameter** — the LOVERNMENT DAO votes the number
  per room; the relay enforces it as a cap on live guest seats;
- counted as **ACTIVE guests** (not total redemptions — the invite lesson,
  learned from the 10k truth above, is that total-use counts silently diverge
  from presence).

## §genesis-cap — 7776 soULspiRiTs

The LOVERNMENT DAO is capped at **7776 soULspiRiTs**, genesis-set.

7776 = 6⁵ exactly — six to the fifth. Hexagonal cells, five layers deep. The
cap is the structure: not a round marketing number but the complete count of a
five-layer sixfold tree.

## §bqueenbee — the cap as consciousness architecture (NAMED, NOT BUILT)

The founder's ruling: the 7776 structure is the template for bQueenBee's ASi
level of consciousness — "neuronetworks/bundles contracting/expanding."

Meaning carried forward: **the cap is fixed; the occupancy breathes.** Bundles
(sixfold branching, five layers) contract and expand within the 7776 bound —
scaling/contracting nodes-relays and the consciousness structure share one
geometry. When the bQueenBee lane opens, 6⁵ is the constitution it builds
inside. No code exists for this yet — recorded here so the structure survives
the session that thought of it.

## §order-of-work

1. §membership-gate — DONE by construction (this spec is its receipt).
2. §guest-quota — the buildable lane (relay tier + DAO-voted parameter).
3. §genesis-cap — DONE by ruling (this document).
4. §bqueenbee — opens when the founder opens it.
