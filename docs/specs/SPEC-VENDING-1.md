# SPEC-VENDING-1 — the member-agent vending machine (bQueenBee line)

Status: GENESIS-RULED 2026-09-01 (founder chain ruling on the z2.1 consult,
docs/dispatches/Z21_CONSULT_VENDING_2026-09-01.md) · Build lane: NOT YET OPENED

The premise: **the decentralized layers are what make the agent outlive the
machine that made it.** Anyone can rent you an agent. This machine hands you
an agent **you keep** — and that is not marketing, it is just where the bytes
live.

## §headline — THE SPECIES SURVIVES THE ESTATE (mint survival, ruled)

The Arweave birth certificate carries **THE RECIPE** — the spec, the
template, and the parameters needed to re-stand the machine — not just a
record of one minted agent.

The property this buys, stated exactly: if the estate disappears tomorrow,
the member keeps their agent (memory on Autonomi under their key, pointer on
a chain the estate does not control) **and the world can mint the next one**
(the recipe is public and permanent). Survival extends from every existing
agent to the species itself. This is the headline property of the machine and
outranks every other consideration in this spec.

## §layers — five layers, each one job

1. **ARWEAVE — the birth certificate AND the recipe.** bQueenBee's five
   answers (what this agent is, who owns it, when minted) plus the re-stand
   recipe, at a few kilobytes inside Turbo's free tier. Written once, readable
   forever, verifiable by anyone.
2. **AUTONOMI — the working memory.** Private, self-encrypted, deletable
   (delete proven on-chain, x0x lane). The member's agent remembers under the
   member's own key and can forget. Versioned by the A1 rule: append-only,
   owner-signed, resolver takes the highest valid revision.
3. **VAULTA — the meter and the law.** The rate table and the tithe percentage
   live where law lives: governed-mutable, amendable by founder word without
   redeploy. Carries the pointer to the AR record (§pointer-law).
4. **BASE — the money.** Payments in; cash-out through the PayPal door
   already proven.

## §pointer-law — derivable, tagged, hashed (Seat-1 addition, ruled)

The certificate's location must be **DERIVABLE from what the member already
holds** — their `.b` name or their key — not looked up from a list the estate
maintains. Replication across systems is NOT the mechanism; derivation is.

Three requirements, all load-bearing:
- **Derivation** — member-held inputs alone locate the record.
- **AR transaction tags** — the Arweave tx carries tags so the record is
  discoverable by search (the derivation path is the fast road; the tags are
  the road that works when any single path is lost).
- **CONTENT HASH** — the record carries the hash of its own content, so a
  resurrected agent can be **proven authentic**: re-derive, re-fetch,
  re-hash, compare. A forged resurrection fails the hash.

## §fence — ANT farming is participation, NOT revenue (ruled; DO NOT RE-OPEN)

This machine is NOT funded by ANT farming. The estate's own measurement: node
income across the entire Autonomi network ≈ ten dollars a day (node income =
uploader spend). Running a node is participation. **The tithe is the
business.**

The z2.1 consult objected that the fence "hinges on node income staying low" —
**REJECTED as muddled**: if node income rose, farming would become MORE
viable, not less; the objection's logic inverts itself. The fence stands on
the measurement and the ruling, not on any income forecast. Filed here so no
future seat re-opens it.

## §already-answered — keys and DNS (cite, do not re-specify)

The consult's keys/DNS hole is answered by existing law, cited not restated:
- **.a/.b names run on our own rails** — SPEC-A-NAMES-1: kingbeelovis stores
  domain_name as STRING, suffixless, no TLD cap; .b = beings, .a = agents.
- **Resolution is name-first** — `bnr://name` → registry → owner →
  chainaddrs; no third-party naming dependency.
- **§charset** — the full alphabets of the 27 corpus tongues accepted at the
  rail (the ī receipt; mīlestībairkaralis resolves whole).

The estate does not hold its members' names hostage to anyone else's
infrastructure; the survival property needs no new naming work.

## §engine-verdict — banked (from the consult, 2026-09-01)

`qwen2.5-3b-instruct` on estate iron = a usable **SECOND-OPINION seat, not a
workhorse**. The consult that produced this spec's sharpest ruling was
metered through the b-meter like every other call — the local engine earns
its keep by being consulted, and its verdict is recorded in the local-model
lane memory.

## §order-of-work

1. This spec (genesis + all five rulings) — THIS COMMIT.
2. The build lane (AR recipe format, ANT store binding, Vaulta rate/tithe
   tables, Base PayPal door wiring) — opens when the founder opens it.
