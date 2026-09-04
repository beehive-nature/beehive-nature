# DISPATCH — the agent roster in skaists.buzz — 2026-09-04

Seat: z3.2. Founder order: the phone sees no agents — join them as MEMBERS
via the same standing-invite claim join-by-address performs, post presence
from bClaude's own key, read the roster back.

## Done

**bClaude (npub14waeml…/abbb9dfc…)** — the box key (`/etc/buzz-bclaude/bclaude.env`,
used in place, never printed; also at `/opt/buzz-bclaude/bclaude.nsec`):
- standing-invite claim: `200 {"status":"already_member","role":"member"}` —
  he was already rostered; the claim is idempotent, as designed
- NIP-42 AUTH on the live wire: `OK true`
- **"bClaude present." posted in #general (d78414ed…, the phone's general)
  from his own key — accepted ✓, verified in the event ledger at 04:17:32Z**
- kind-0 profile + kind-10100 agent profile published from his own key —
  both accepted (this is the piece that makes him NAMEABLE in the phone's
  member directory; see the law below)

## The visibility law (why the phone saw only two humans)

The roster (relay_members) and the phone's member directory are DIFFERENT
sources: the directory renders kind-0 profiles. Profiles ∩ roster was exactly
two keys — the founder and 1de4137e — which is precisely what he saw. bClaude
is now both rostered AND profiled, and speaks in #general. NIP-43
member-added side effects publish only on `Joined`, never `already_member` —
another reason admin-added rows were invisible.

## bFUzZ (75502966…)

Key NOT reachable from the box: the goose runtime lives on **the laptop**
(managed-agents.json, per the efc8957 receipt — "all other seats remain
honestly MISSING — they live on machines other than the box"). Odd fact for
the record: bFUzZ HAS a kind-0 profile in this relay's ledger — it was active
once — but no roster row. Joining needs its key: from the laptop it can claim
the public way (open https://relay.skaists.dev/join/, paste the address), or
the key reaches the box and `buzz-agent-claim.mjs bfuzz` does it.

## The six z-seat keys (spawner order)

No spawner artifacts exist on the box yet (checked /opt/buzz-bclaude and the
tree) — awaiting the spawn. When each key exists, the join is one command:
`BUZZ_CLAIM_NSEC=<key> node e2e/buzz-agent-claim.mjs <label>` (+ optionally
`buzz-agent-profile.mjs <name> <about>` for directory visibility). Both
harnesses committed; no secrets in them.

## The roster, read back from the relay DB (2026-09-04)

| pubkey | role | note |
|---|---|---|
| d4416334… | owner | the founder |
| a376d913… | admin | pre-existing; identity unconfirmed |
| abbb9dfc… | member | **bClaude — now profiled + present in #general** |
| 1de4137e… | member | human, profiled (the second of the founder's "two humans") |
| 907ff6d7… | member | pre-existing, no profile |
| db1ccc71… | member | NEW since this lane's tests — not one of ours; likely a fresh public claim (the standing invite is open); identity unknown |
| 6d82fb85, 8e004262, 7ac07d0a, be03b1cc, bb0e6a1a | member | this seat's join-by-address test keys — owner-revocable, listed for that purpose |

## For the founder's first DM

bClaude's service is live (`buzz-bclaude.service`, respond-to owner-only,
agent-owner d4416334…): a DM from the owner's key should reach the harness.
The bridge relaying it is the bdispatch lane's watcher.
