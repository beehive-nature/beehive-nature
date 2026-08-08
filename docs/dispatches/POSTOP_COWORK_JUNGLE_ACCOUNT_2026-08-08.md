# POST-OP NOTE — COWORK · JUNGLE ACCOUNT PROVISIONED (`banchor22222`)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-08.

---

## PRE-OP STATE
No Jungle account. Key custody unresolved (prior note, C2). Founder ruled resolution **(a)**:
Cowork holds a **Jungle-only throwaway** key. Faucet requires a human-proof, which per the
standing fence **only the founder may complete**.

## PROCEDURE PERFORMED
1. Generated two secp256k1 keypairs in the sandbox (owner, active).
2. Navigated the founder's browser to `https://monitor.jungletestnet.io/` and **stopped**.
   The founder completed the human-proof and ran the faucet.
3. Verified the resulting account **independently** against
   `jungle4.api.eosnation.io/v1/chain/get_account` — not trusting local `cleos` output,
   which self-reported *"executed locally, but may not be confirmed by the network yet."*

## SEATS PRESENT
**Cowork** — key generation, browser navigation, on-chain verification, this note.
**Seat 0 (founder)** — completed the human-proof and executed the faucet transactions.
Per LAW 8c: the faucet transaction output is the **founder's**; every finding below is
**Cowork's** verification of it.

## FINDINGS

**F1 — Account live and keys match. VERIFIED** (independent endpoint, head block 280,522,718):

| | |
|---|---|
| account | `banchor22222`, created 2026-08-08T23:39:13 |
| `owner` key | `EOS8VG7XChVVMYRo1MzLkqfgXq1PZkjAmR2dQLF7adpNq9h3UXBrs` ✓ matches generated |
| `active` key | `EOS7W92SwjbSNReJXrFyHCNMUg9Yy65XQEM3MgSE8nyt9m7ft41EW` ✓ matches generated |
| balances | 100.0000 EOS · 100.0000 JUNGLE · **100.0000 A** (`core.vaulta`) |
| `ram_quota` / `ram_usage` | **5,495 / 3,446** → **2,049 bytes free** |
| CPU / NET | 2,270,114 µs · 3,052,280,961 bytes (powerup, 1 day) |

**F2 — ⭐ `ram_usage = 3,446` independently confirms the receipted account-creation cost.**
`RECEIPT_R8_VAULTA_RAM.md:34` predicted **"≈ 3,450 bytes (measured at 3,446 on a vanilla
mainnet account)."** A fresh account on a *different chain* lands on **3,446 exactly.**
That number is now confirmed twice, on two chains, by two seats. **VERIFIED.**
Note it also validates the R8 methodology, not just the figure.

**F3 — Observed RAM price, from the founder's own transaction (better than a quote):**
4,095 bytes for **0.8370 EOS** all-in (0.8328 ram + 0.0042 fee) = **~0.0002044 EOS/byte**.

## SPECIMENS
- `POST /v1/chain/get_account {"account_name":"banchor22222"}` → HTTP 200, full JSON above.
- Faucet txids (founder's, reported by local cleos, **not independently confirmed by this
  seat**): `16cfe945…`, `2397b20f…`, `256d77eb…`, `687c9af3…`, `755de866…`. Account state
  above is the VERIFIED artifact; the txids are **REPORTED**.
- No crate refs — no source read this procedure (LAW 8a: nothing to stamp).

## COMPLICATIONS

**C1 — ⚠ BLOCKER FOR CODE: this account cannot host a contract at its current RAM quota.**
`ram_quota` is **5,495 bytes** with **2,049 free**. Contract deployment writes the wasm +
abi into the account's RAM. For scale, `RECEIPT_R8_VAULTA_RAM.md` measured the v3 contract's
`setcode` at **428,690 bytes** (42,869 wasm × 10). The anchor contract is far smaller by
design — one action, no per-name rows — but it will still need **orders of magnitude more
than 2,049 bytes.**

**This is not a defect; it is an unbought resource, and it is cheap.** At the observed
0.0002044 EOS/byte, and against a 100 EOS balance:

| Buy | Cost | Covers |
|---|---|---|
| 50 KB | ~10.2 EOS | a small contract |
| 150 KB | ~30.7 EOS | comfortable headroom incl. the 144-row ring |
| 400 KB | ~81.8 EOS | v3-scale wasm — almost the whole balance |

**Recommended before deploy:** `buyrambytes` to a sensible quota, then re-check. **Cowork
did not buy** — spending the account's balance is a build decision on Code's contract, not a
document-seat call. Naming it so it is not discovered at deploy time.

**C2 — RAM headroom would not fit a v3-style registry row anyway** (2,049 free vs 2,537 for
a v3 `.b` row). **Moot** — v3 is dead by the reset — recorded only to pre-empt anyone
reading the free-RAM figure as a registry constraint. It is not.

**C3 — RIPEMD-160 is disabled in this environment's OpenSSL build.** Key derivation failed
(`ValueError: unsupported hash type ripemd160`) until `pycryptodome` was installed. **Any
seat doing Antelope key work in this sandbox hits this.** Fix: `pip install pycryptodome
--break-system-packages`.

**C4 — Private keys are OUT of the repo, deliberately.** Held only at
`/tmp/jungle_throwaway.keys` in the sandbox. **This repo is PUBLIC (A52)** — a WIF must never
land in it. `.gitignore` covers `*.key`/`*.seed` and the secret-scan hook would catch a WIF,
but **neither is being relied on as the control**: the keys are simply not in the tree.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **`banchor22222` is live on Jungle4**, owner/active held by Cowork as a testnet-only
   throwaway, funded 100 EOS / 100 JUNGLE / 100 A.
2. **Before Code deploys the anchor contract to this account, buy RAM** — 2,049 free bytes
   is not enough for any contract (C1). ~30 EOS buys comfortable headroom.
3. **The human-proof is DONE for this identity.** Per the founder's standing test, this
   identity's human-proof count is now **1** and must not go higher — any further faucet or
   CAPTCHA step for `banchor22222` is friction the agent layer should absorb.
4. **The lifecycle proof is now unblocked on custody and on time-model** (F3 in the prior
   note closed by World A). It remains gated only on **Code's anchor contract being
   deployed** and **goose's 28-day grace update** to the vectors.
5. Install `pycryptodome` before any Antelope key work here (C3).
