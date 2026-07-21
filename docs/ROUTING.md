# ROUTING — where artifacts go, and who moves them

**ROUTING** · **Destination:** `beehive-nature/docs/ROUTING.md` · **Delivery:** Code commits.
**Founder read required:** once. After that it runs itself.

---

## THE STANDING RULE

**Every artifact names its destination and its delivery method in its first three lines, at creation time.**

```
**ROUTING** · **Destination:** <repo/path or seat name>
**Delivery:** Code commits | paste to <seat> | founder-manual
**Founder read required:** yes/no
```

**Why:** 46 files accumulated untracked on this mount because no artifact carried its own routing, so the founder became the router by default. **An artifact that does not know where it goes has made someone else responsible for remembering.**

---

## WHO CAN DO WHAT — the constraint that shapes everything

| Seat | Read repo | Write mount | Commit | Push |
|---|---|---|---|---|
| **Code** | yes | yes | **yes** | **yes** |
| **Cowork/design** | yes (public repos, via clone) | yes | **no** | **no** |

**Verified, not assumed:** `.git` is read-only to the Cowork seat — `git add` fails. **LOVErnment-DAO is public and clonable anonymously; `beehive-nature` requires auth.**

> **Consequence: the design seat can produce and stage, never land. Every durable artifact needs exactly one line to Code.** That is the whole courier cost, and it is one line, not a pile.

---

## OUTSTANDING NOW

### Code commits these

| File | Destination |
|---|---|
| `docs/DESIGN-BRIEF-02-bigen-library.md` | here — beside BRIEF-01 |
| `docs/ROUTING.md` | here — this file |
| `bigen-pickup/INTEGRITY-SCHEMA.md` | **`LOVErnment-DAO` → `bigen/integrity/SCHEMA.md`** |

### Paste to a seat, then delete

| File | To |
|---|---|
| `bigen-pickup/CORRECTIONS-01.md` | the BIGEN seat |

### Delete — correspondence, nothing is lost

**`RELAY_08` through `RELAY_25`, plus `RELAY_SEED_*`, `RELAY_UI_*`, `RELAY_BNRi_*` — 23 files.** Every ruling inside them is already mirrored into a committed home (`VOCABULARY.md`, the crate docs, the test suites, `DESIGN-CONSTRAINTS.md`). **They are scaffolding around finished buildings.**

**`RELAY_25_BIGEN_architecture.md` is the one exception** — it is the architecture reasoning for the bigen tree. Move it to `LOVErnment-DAO` as `bigen/ARCHITECTURE.md`, not as a `RELAY_`.

### Hold — not this session's problem

**16 `*_DO_NOT_COMMIT.md` files + `BACKUP_*.zip`** — legacy, gated behind the Drive backup. **`*.SEAT3_VERIFIED.md`** are Code's own receipts; Code's call.

---

## FOUNDER-MANUAL — only these actually need hands

**Nothing on this list can be done by any seat. Everything else has an owner.**

1. **Backup zip → Drive.** Gates the legacy sweep above.
2. **Authorize the GitHub connector** (`plugin:engineering:github`, in connector settings). **Removes most of the remaining courier burden** — the design seat could then read repo state directly instead of asserting about trees it cannot see.
3. **Fiscal sponsor emails** · **lab RFQ** · **farmer's number** · **the four private letters** · **`mro-jl22-ajin` posting** · **a Linux machine for the COSMIC window.**

**Aug 21 is the only clock.**

---

## WHAT CHANGED, SO IT DOESN'T RECUR

**Before:** the design seat produced prose and the founder relayed, routed, and remembered which file went to which seat.

**After:** every file carries its destination. **The founder's job is to forward one line to Code and paste one file to a seat.** If an artifact ever arrives without a routing header, it is defective and should be sent back.

---

*bQueenBee custodies the process; humans hold the duty. Custody means the record is durable and the next action is named — not that more documents exist.*
