# POST-OP NOTE — COWORK · `updateauth` EXECUTED + LIFECYCLE RESOLVER HALF
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.

---

## PRE-OP STATE
`banchor22222@active` held **one** key (Cowork). Code had no deploy authority.
`ram_usage` 3,446 / `ram_quota` 5,495. Founder ruled deploy authority option (2),
threshold 1. Code's active public key supplied by founder.

## PROCEDURE PERFORMED
1. Verified on-chain that the `updateauth` had **not** already been applied (avoided a
   duplicate broadcast).
2. Serialized `eosio::updateauth` **by hand** and signed it **in the sandbox**, where the
   private key lives. Pushed via the Windows side. **The private key never moved.**
3. Verified the result from **`jungle4.cryptolions.io`** — deliberately a *different*
   endpoint than the `eosnation` node the transaction was pushed to.
4. Built and ran the **lifecycle resolver half offline** (see F4) rather than idling on
   Code's deploy.

## SEATS PRESENT
**Cowork** — all steps and findings below. **Seat 0** — supplied Code's public key and the
threshold ruling. **Code** — owner of the public key added; **no Code action in this
procedure.** (LAW 8c.)

## FINDINGS

**F1 — `updateauth` executed and independently VERIFIED.**

| | |
|---|---|
| tx | `ab99d97cd6fa528bbfe614a87b3eb98f7c3385a4899c63a57be52a23576f5289` <!-- PUBLIC-CONSTANT: Jungle4 testnet transaction id --> |
| block / time | 280,528,833 @ 2026-08-09T00:32:29.500, status `executed` |
| `@active` | threshold 1 — `EOS58bhskNhQ…` (Code) + `EOS7W92SwjbS…` (Cowork), both weight 1 |
| `@owner` | **UNCHANGED**, Cowork only |
| verified via | `jungle4.cryptolions.io` (push was to `jungle4.api.eosnation.io`) |

**F2 — RAM cost of the second key, measured: `ram_usage` 3,446 → 3,496 = +50 bytes.**
Free RAM now **1,999 bytes** — still far short of any contract. The RAM buy stands.

**F3 — `@owner` retention gives recovery without a founder round-trip**, and incidentally
demonstrates the open `owner`-succession problem in miniature: whoever holds `owner` holds
the account, and here that is one disposable key.

**F4 — ⭐ LIFECYCLE RESOLVER HALF: 9/9 STAGES PASS, ZERO CONTRACT CALLS.** Run offline with
synthetic `epoch_time` per the founder's split — **chain proves ORDER, resolver proves
VALIDITY** — against rev-4 rules (grace boundary **exclusive**):

| Stage | epoch_time | Expect | Got |
|---|---|---|---|
| 1 REGISTER | T0 | ACCEPT | ACCEPT |
| 2 CHANGE @28d | T0+28d | ACCEPT | ACCEPT |
| 2b CHANGE @27d *(negative)* | T0+27d | REJECT | REJECT (R3 gap) |
| 3 RENEW @365d | T0+365d | ACCEPT | ACCEPT |
| 4b GRACE @exp+27d | T0+757d | GRACE | GRACE |
| 4 LAPSE @exp+28d | T0+758d | LAPSED | LAPSED |
| 5 RECLAIM (owner, in grace) | T0+757d | ACCEPT | ACCEPT |
| 5b STRANGER in grace *(negative)* | T0+757d | REJECT | REJECT (grace lock) |
| 6 STRANGER after lapse | T0+759d | ACCEPT | ACCEPT |

**Both boundaries are exercised from both sides** — 27d/28d on the change gap, and
exp+27d/exp+28d on grace-vs-lapse. A lifecycle that only walks the happy path would pass
while a boundary was inverted; these would not.

## SPECIMENS
- `POST /v1/chain/push_transaction` → full `processed` trace, status `executed`.
- `POST /v1/chain/get_account` @ `cryptolions` → both keys present under `@active`.
- Harness: `/tmp/resolver.py`, `/tmp/lifecycle.py` (sandbox scratch). Rules stamped to
  `SPEC_RESOLVER_VALIDITY_RULES` rev 4 (LAW 8a).

## COMPLICATIONS

**C1 — `abi_json_to_bin` is `410 Gone` on Leap 5+ nodes.** The node cannot serialize action
args any more. Recorded for reuse.

**C2 — `pyntelope` 0.8.6 has no `Authority` and no public-key type.** Neither node nor
library could build `updateauth`. **Resolution:** hand-rolled Antelope serialization (name
base32; `public_key` = type byte + 33-byte compressed; varuint arrays) plus RFC-6979
deterministic ECDSA with low-s canonical form and recovery id, K1 signature encoding.

**C3 — ⚠ THE TRAP: Antelope sorts authority keys by SERIALIZED KEY BYTES, not base58 text.**
Here the two orders coincided, so it worked — **a diverging set would have been rejected as
"invalid authority," an error pointing at the authority rather than at the sort.** Sorted on
decoded key bytes. Now **LAW 8j**.

**C4 — Sandbox cannot reach Jungle4 (proxy-restricted); the Windows side can.** This is why
the split shape was necessary, and it is also *why the key stayed put*: signing happened
where the key already was, and only signed bytes crossed. Recorded as an operating fact, not
a defect.

**C5 — No RAM bought, no contract deployed, nothing else spent.** Balance still 100.0000 EOS.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **Code is unblocked.** `@active` carries Code's key at threshold 1. Buy RAM from the
   account's own 100 EOS (~30 EOS ≈ 150 KB at the measured 0.0002044 EOS/byte), then deploy.
   **1,999 free bytes is not enough — buy first.**
2. **The lifecycle's resolver half is DONE and passing 9/9.** What remains for the milestone
   is the **chain half only**: anchor each stage's Merkle root as an epoch root and show
   ordering holds via `prev_root`. The record content is already produced and leaf-hashed.
3. **Reusable environment facts:** `abi_json_to_bin` gone (C1); pyntelope lacks authority
   types (C2); key sort is by bytes (C3, LAW 8j); RIPEMD-160 needs pycryptodome; sandbox is
   network-restricted (C4).
4. **`banchor11111` remains dead** per Law 8h. **Mainnet untouched.** No mainnet key exists
   in any seat.
