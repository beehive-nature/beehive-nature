# RECEIPT — JUNGLE4 PERMISSIONS: bounded authority + the successor-able role, PROVEN ON-CHAIN (2026-08-29)

**Lane 1 — the memo proof, positive AND negative** (account `bnrapolltest`, watch `kingbeelovis`, A rail `core.vaulta`):
| proof | tx | outcome |
|---|---|---|
| memo'd transfer credits | `574ce0e5…` (5.0), `d71207bb…` (2.0), `e3bc86e0…` + `f3838e08…` (1.0 each), `70eb99cb…` (0.5) | **memo-routed credits, escrow events `c5668002… 50a0dc8a… 4033ab43… 4011d29f… 1fd34ea9…` — live surface reads 8.8400** |
| WRONG memo must NOT credit | `ba0a6924…` + `831cb1da…` (memo `wrong-memo-probe`) | **PARKED — no credit; settlement instructions `instr-…-71b55e59` + `instr-…-adeb1557` written, founder word decides. A binder that credits when the memo is wrong isn't a binder — this one parks.** |
| chain | 12 events green, tip `1fd34ea9dcbaa754…` |

**Lane 2 — bounded authority, every tx cited:**
1. **linkauth `memo` → `core.vaulta::transfer` ONLY** (perm created `96722bbe…`, link `138b48dc…`; on-chain link table verified: `memo → core.vaulta/transfer`, active/board/owner empty). **BOTH WAYS proven:**
   - memo-signed transfer **SUCCEEDS**: `70eb99cb03dc9035…` — the memo key moved tokens and nothing else was signed.
   - memo-signed NON-transfer (**eosio.token::transfer**) **REFUSED by the chain**: *"action declares irrelevant authority {bnrapolltest/memo}; minimum authority is {bnrapolltest/active}"* — bounded authority, proven not specified. *(First attempt pair failed for a benign reason — the link landed one block after the permission; the retried pair is the clean proof.)*
2. **The successor-able role**: second account `bnrapollteam` born (`318e8d9b…`, RAM+stake+seed 10 EOS, A-seed `085128b4…`, key vaulted 600 box-only). Custom permission `board` = {accounts: [bnrapollteam@active]} created under active (`7a7a7029…`). **Then board amended ITSELF** — added a key member, signed by bnrapollteam@active as `bnrapolltest@board`, **no owner signature anywhere** (`b9c010a6…`). The role is a mutating account-set under a fixed identifier; succession demonstrated.
3. **The ceiling, shown not hidden**: owner then overrode `board` entirely — replaced membership with the active key alone, signed `bnrapolltest@owner` (`b32aa6f4…`). The mortal-root finding stands: owner outranks every custom permission.

**Keys:** owner/active/memo (founder-issued) + bnrapollteam (lane-generated) all vaulted on the box at 600, never printed past the founder's own paste, never committed. Owner was used ONCE — step 3, exactly as ordered.

**Tooling laws learned (recorded for the [[bdid-custody]] thread):**
- eosjs is the estate's proven EOSIO signer (`~/eosjs-sign/` on the box); the hand-rolled pure-python signer retired — its last lesson: **WIF checksum = ripemd160(sha256(sha256(payload)))[:4]** (double sha), and **EOS pubkey checksum = ripemd160(pub)[:4]** (single, no sha at all) — two different checksum laws in one address format, measure before encode.
- `core.vaulta` forbids self-transfers (cf_system.cpp) — test transfers go to the watch account.
- linkauth + a dedicated child permission IS a workable bounded-token-authority primitive on Vaulta today: enumerable reach, instant revocation by unlink, and the child cannot climb (1c proves the wall).

**Succession implications for [[bdid-custody]]:** the role primitive works exactly as theorized — `permission_level_weight` account-membership under a fixed name, self-amending without owner, owner-override as the honest ceiling. The dead-man half remains where the ledger already ruled: eosio.msig + delay_sec (≤45d, permissionless exec), NOT `waits` (dead on mainnet since block 396,090,329). Next concrete step for that thread: an msig proposal with delay as the dead-man heartbeat, board as the membership.
