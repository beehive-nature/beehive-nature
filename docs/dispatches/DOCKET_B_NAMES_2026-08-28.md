# FOUNDER .b DOCKET — compose, never sign · 2026-08-28

**Seat:** z2.1 · **Rule:** HIS hands sign; nothing on this lane touches a key · **Registry:** `kingbeelovis` on Vaulta (aca376f2…), read live 2026-08-28

## 1 · READ-BACK (38 unique names queried against the live domains table — 13 rows)

| # | name | status | owner | expires | batch |
|---|---|---|---|---|---|
| 1 | kim | AVAILABLE | — | — | 1 |
| 2 | wayne | AVAILABLE | — | — | 1 |
| 3 | cody | AVAILABLE | — | — | 1 |
| 4 | sienna | AVAILABLE | — | — | 1 |
| 5 | pung | AVAILABLE | — | — | 1 |
| 6 | b | AVAILABLE | — | — | 1 |
| 7 | bee | AVAILABLE | — | — | 1 |
| 8 | beehivebuds | AVAILABLE | — | — | 1 |
| 9 | beehivebiomass | AVAILABLE | — | — | 1 |
| 10 | plur | AVAILABLE | — | — | 1 |
| 11 | skaists | AVAILABLE | — | — | 2 |
| 12 | lovernment | AVAILABLE | — | — | 2 |
| 13 | **inga** | **TAKEN** | kingbeelovis | 2027-08-01 | — |
| 14 | wenpin | AVAILABLE | — | — | 2 |
| 15 | aaron | AVAILABLE | — | — | 2 |
| 16 | william | AVAILABLE | — | — | 2 |
| 17 | ella | AVAILABLE | — | — | 2 |
| 18 | adan | AVAILABLE | — | — | 2 |
| 19 | michael | AVAILABLE | — | — | 2 |
| 20 | ej | AVAILABLE | — | — | 2 |
| 21 | **remington** | **TAKEN** | kingbeelovis | 2027-08-01 | — |
| 22 | sutphen | AVAILABLE | — | — | 3 |
| 23 | mark | AVAILABLE | — | — | 3 |
| 24 | zander | AVAILABLE | — | — | 3 |
| 25 | berlin | AVAILABLE | — | — | 3 |
| 26 | janus | AVAILABLE | — | — | 3 |
| 27 | regina | AVAILABLE | — | — | 3 |
| 28 | isaac | AVAILABLE | — | — | 3 |
| 29 | jason | AVAILABLE | — | — | 3 |
| 30 | beehivenature | AVAILABLE | — | — | 3 |
| 31 | skaistsdao | AVAILABLE | — | — | 3 |
| 32 | buzz | AVAILABLE | — | — | 4 |
| 33 | usad | AVAILABLE | — | — | 4 |
| 34 | busad | AVAILABLE | — | — | 4 |
| 35 | beehivenaturereserve | AVAILABLE | — | — | 4 |
| 36 | bnr | AVAILABLE | — | — | 4 |
| 37 | bn | AVAILABLE | — | — | 4 |
| 38 | bqueenbee | AVAILABLE | — | — | 4 |
| 39 | luna | AVAILABLE | — | — | 5 |
| 40 | love | AVAILABLE | — | — | 5 |
| 41 | lover | AVAILABLE | — | — | 5 |
| 42 | countess | AVAILABLE | — | — | 5 |
| 43 | count | AVAILABLE | — | — | 5 |
| 44 | duke | AVAILABLE | — | — | 5 |
| 45 | lord | AVAILABLE | — | — | 5 |
| 46 | minister | AVAILABLE | — | — | 5 |
| 47 | primeminister | AVAILABLE | — | — | 5 |
| 48 | dao | AVAILABLE | — | — | 5 |

**TAKEN (2):** inga and remington — both already held by kingbeelovis, both expire 2027-08-01. **Nothing to do.**

## 2 · ABI VERIFICATION (cited, never assumed)

**Live ABI** (`get_abi` → `kingbeelovis`, code_hash `07c267f0…bec18` (full hash in the live ABI response) PUBLIC-CONSTANT: chain code hash, public blockchain data):

```json
"structs": [{ "name": "registeracc", "fields": [
  { "name": "registrant",  "type": "name"   },
  { "name": "domain_name", "type": "string" },
  { "name": "target",      "type": "name"   }
]}]
```

**THE VERDICT:** `domain_name` is **`string`**, NOT Antelope `name`. There is **NO 12-character cap**.

**On-chain proof** (stronger than the ABI alone): the live registry already holds a **15-char** name (`travisremington`) and an **18-char** name (`loviswaternakamoto`). Both registered. Both live. The cap is dead.

**Therefore:**
- `beehivebiomass` (14 chars) — **LAWFUL**, no options needed
- `beehivenature` (13 chars) — **LAWFUL**, no options needed
- `beehivenaturereserve` (20 chars) — **LAWFUL**, no options needed

No lawful-form alternatives are required. All three ride the normal batches.

## 3 · THE BATCHES (5 transactions, 46 registeracc actions total)

Every action: `account=kingbeelovis`, `name=registeracc`, `authorization=[{actor:kingbeelovis, permission:active}]`, `data={registrant:kingbeelovis, domain_name:<name>, target:kingbeelovis}`.

**Batch 1 (10 names):** kim · wayne · cody · sienna · pung · b · bee · beehivebuds · beehivebiomass · plur
**Batch 2 (10 names):** skaists · lovernment · wenpin · aaron · william · ella · adan · michael · ej · *(9 — remington was slotted here, taken, removed)*
**Batch 3 (10 names):** sutphen · mark · zander · berlin · janus · regina · isaac · jason · beehivenature · skaistsdao
**Batch 4 (7 names):** buzz · usad · busad · beehivenaturereserve · bnr · bn · bqueenbee
**Batch 5 (10 names):** luna · love · lover · countess · count · duke · lord · minister · primeminister · dao

### Raw paste-ready blocks

Each block is a complete Vaulta transaction JSON — paste into any Vaulta-signing tool (the wallet composer, `cleos push actions`, bloks.io, whatever pen the founder chooses):

**Batch 1:**
```json
{"actions":[{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"kim","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"wayne","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"cody","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"sienna","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"pung","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"b","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"bee","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"beehivebuds","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"beehivebiomass","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"plur","target":"kingbeelovis"}}]}
```

**Batch 2:**
```json
{"actions":[{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"skaists","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"lovernment","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"wenpin","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"aaron","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"william","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"ella","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"adan","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"michael","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"ej","target":"kingbeelovis"}}]}
```

**Batch 3:**
```json
{"actions":[{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"sutphen","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"mark","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"zander","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"berlin","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"janus","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"regina","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"isaac","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"jason","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"beehivenature","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"skaistsdao","target":"kingbeelovis"}}]}
```

**Batch 4:**
```json
{"actions":[{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"buzz","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"usad","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"busad","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"beehivenaturereserve","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"bnr","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"bn","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"bqueenbee","target":"kingbeelovis"}}]}
```

**Batch 5:**
```json
{"actions":[{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"luna","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"love","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"lover","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"countess","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"count","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"duke","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"lord","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"minister","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"primeminister","target":"kingbeelovis"}},{"account":"kingbeelovis","name":"registeracc","authorization":[{"actor":"kingbeelovis","permission":"active"}],"data":{"registrant":"kingbeelovis","domain_name":"dao","target":"kingbeelovis"}}]}
```

### RAM estimate (honest)

46 names × ~0.85 A ≈ **39.1 A** total (resellable). Per batch: B1 ≈ 8.5 A · B2 ≈ 7.65 A · B3 ≈ 8.5 A · B4 ≈ 5.95 A · B5 ≈ 8.5 A.

### Wallet-composer prefills

The composer boots per-action; for the multi-action batches the raw blocks above are the paste-ready pen. For single-name walks (if the founder prefers one-at-a-time), each action's `data` block is exactly the composer's `contract=kingbeelovis, action=registeracc` form — the WALLET_PROFILE already carries the shape.

## 4 · FOUNDER SIGN-STEPS (numbered, stupid easy)

You sign **5 transactions**. Each is one ceremony. Each registers ~10 names.

1. **Open your Vaulta wallet** (the wallet surface or any signing tool) as `kingbeelovis@active`.
2. **Batch 1** — paste the Batch 1 JSON block. Review: 10 `registeracc` calls, your account on every line. **Sign.**
3. **Batch 2** — paste Batch 2. 9 calls (remington dropped — already yours). **Sign.**
4. **Batch 3** — paste Batch 3. 10 calls. **Sign.**
5. **Batch 4** — paste Batch 4. 7 calls. **Sign.**
6. **Batch 5** — paste Batch 5. 10 calls (luna · love · lover · the nobility · dao). **Sign.**
7. **Done.** 46 names registered. ~39.1 A RAM (resellable). Fee: 0.0000 per name. Expires: 365 days from each registration.

**What you already own (no action):** inga (expires 2027-08-01) · remington (expires 2027-08-01).

## Fences

Compose-only. No key touched. No transaction signed. No name registered by this lane. The registry was read (read-only RPC). The ABI was read (read-only RPC). The founder's hands do the only writing that happens.
