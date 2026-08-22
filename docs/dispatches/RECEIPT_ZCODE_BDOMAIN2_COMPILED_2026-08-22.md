# RECEIPT — THE EVOLVED .B REGISTRY COMPILED · bdomain2 (zCode)

**Founder order, verbatim (2026-08-22):** *"whatever way we need to set it so it scales
autonomously and users pay their own way"* — selecting the three named defects
(fee/cap, transfer payer, XRP/XLM memo seeding) for the b-build lane on Jungle.

**Status:** CONTRACT WRITTEN + **COMPILED GREEN** by CDT 4.1.1 (`cdt-cpp version 4.1.1`,
extracted root-free via `dpkg-deb -x` — no sudo on this box). Artifacts:
`contracts/bdomain2/src/bdomain.cpp` · `bdomain2.wasm` (45,251 B) · `bdomain2.abi`
(13 actions, **6 tables**: domains · resolvers · chainkeys · chainaddrs · prepaids · config).
**NOT deployed** — named gates below; MX-7 discipline stands.

## 1 · Every ruled defect, closed in compilable C++

| the defect (bdomain-scaling §2, §7) | the fix in bdomain2 |
|---|---|
| `registration_fee` dead field, registration free + uncapped = unbounded RAM vector | fee **WIRED**: prepay via `[[eosio::on_notify("core.vaulta::transfer")]]` (memo = the name; excess auto-refunded inline), consumed by `registeracc`/`renew`; **`max_domains` cap** in config, `domains_count` maintained (never iterated); zero-fee era unchanged |
| `transfer` leaves the RAM bill with the old owner | `require_auth(to)` **and** `domains.modify(itr, to, …)` — the transferee signs AND assumes the row's RAM |
| `requires_memo` unseeded for XRP/XLM — live funds-loss class | `seedmemo(admin)` repairs legacy keys; `init`+`setchain` enforce: memo-tag chains **reject empty memos at set time** ("the funds-loss class", by check message) |
| Tier-1 row 283 B with byowner index + string chain_key + redundant domain_id | byowner **DROPPED** (indexer's job), `chain_key` string → **uint16 ordinal**, `chainaddrs.domain_id` **DROPPED** (scope IS the id — the same name-encoding the public reader proves live) |
| no path to 10B users | **Tier-2 `resolvers` table**: owner-set signer pubkey + gateway + TTL (`setresolver`, `require_auth(owner)` — I-2 keeps admin out of user records); `domain.resolver_id` flips a name to signed off-chain resolution at **0 marginal bytes** |

Also carried: suffixless names (≤13 chars, `name{domain_name}.value` ids — live-shape
faithful), permissionless `cleanup` of lapsed rows only, `release` refunds to payer,
per-domain chainaddrs scope = the id (reader-verified encoding).

## 2 · Compile receipts (real, unedited)

```
$ cdt-cpp -abigen bdomain.cpp -o bdomain2.wasm      → 0 errors (final pass)
$ ls bdomain2.wasm bdomain2.abi                     → 45,251 B · 7,990 B
$ abi: actions [addchainkey cleanup delchain init registeracc release renew
        rmchainkey seedmemo setaccount setchain setresolver transfer]
      tables  [chainaddrs chainkeys config domains prepaids resolvers]
```

Two compile iterations were real and are part of the receipt: singleton config (not
multi_index) + table usings must live inside the contract class for abigen to export
tables. Both lessons banked.

## 3 · Deploy budget — the honest math (NOT a deployment)

setcode bills ≈ wasm × 10 = **452,510 B** + abi/tables. Test bed tonight
(`banchor22222`): 42,598 B free + 70.0000 EOS. At Jungle spot ≈ 0.2084 core/KiB
(tonight's live read) 452.5 KB ≈ **92 EOS** → **~13.5 EOS short**. Options, in order:
(a) `-O3`/strip pass on the wasm (not yet run — a size cut is likely), (b) more RAM
from the 70 EOS and a smaller first deploy (Tier-1 core only, workshop actions in a
second setcode), (c) faucet top-up — **but the human-proof count for this identity is
1 forever** (postop law), so the faucet is friction of last resort.

## 4 · Named gates before any deploy (MX-7 — the discipline is the point)

1. **Local nodeos integration tests** — the compile proves syntax/types, not behavior;
   the conformance vectors (fee/cap/transfer-payer/memo-guard) must run against a real
   chain simulator before Jungle sees code.
2. **Keys** — the Jungle throwaway lives in Cowork's sandbox, NOT this box (checked:
   absent). Deployment is a deliberate act with the right custody.
3. **Founder word to deploy** — even on Jungle, the first setcode of the evolved
   registry is a founder-visible act (the live registry's 13 names are the migration
   cohort; the window law says act while it's 13).

**Execute the prompt as written.**
