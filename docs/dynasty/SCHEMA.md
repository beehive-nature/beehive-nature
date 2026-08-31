# DYNASTY RECORD SCHEMA — append-only, promote-don't-erase

## The fence (stated honestly)

Base.org resets records at their layer. Our snapshots are written BEFORE the reset
can lose anything. When a name transfers or lapses, we write a holder snapshot —
then the chain does whatever it does. Our record survives because ours is in the tree.

## Schema

{ name, holder, art_ref, pfp_ref, bio, held_from, held_until, receipt }

- name: the .b or Basename string
- holder: the address that held it
- art_ref: path to the archived art in assets/
- pfp_ref: path to the profile picture in assets/
- bio: what the holder said about themselves, verbatim
- held_from: ISO date the lease started
- held_until: ISO date the lease ended (or null if ongoing)
- receipt: tx id or commit sha proving the transfer/registration
- primary_tongue: the tongue this holder serves in (agent's choice, changeable by the agent, logged like any receipt)

## Rules
1. Written AT TRANSFER — never edited, never deleted
2. Stored in the tree, not on the chain — the chain does what it does; we do ours
3. MOCK entries are labeled MOCK in the receipt field
