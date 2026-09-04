# RECEIPT — the ladder inside the powerup window: mint → resurrect from the certificate alone → forged fails → hash-verified (2026-09-04)

The founder's ask, executed end to end on Jungle4 inside the powerup window.
**Result: `RESURRECTION PROVEN: 11 pass, 0 fail`** on a FRESH agent,
`vendingtest2`, minted for this receipt. Every monitor deep-link below was
rendered in headless Chromium and READ BACK from the rendered DOM (data
visible — block number, action name, finality status — not just a page
load); screenshots are committed in `contracts/vending/tool/`.

## THE LADDER

**1. MINT** — `vending::mint` for `vendingtest2` (template
`bqueenbee-genesis-1`, tongue `latvian`, same member key):
- **mint tx:** `3d1f2aa870de6f32b0fb16ae2f4c3c76c735f53e9aa08956e6f74911f5a0c896` <!-- PUBLIC-CONSTANT: jungle4 txid -->
- **RENDERED + READ BACK** at:
  **https://monitor.jungletestnet.io/#accountActions:3d1f2aa870de6f32b0fb16ae2f4c3c76c735f53e9aa08956e6f74911f5a0c896** <!-- PUBLIC-CONSTANT: jungle4 mint txid in monitor URL -->
  — rendered: block **285021247**, 2026.09.04 00:33:06, CPU 131 µs, NET 40 B,
  finality **Irreversible**, action `bnrapolltest :: mint`, auth
  `bnrapolltest@active`. Screenshot: `monitor-mint2-tx.png`.
- **certificate:** 3235 B canonical JSON · sha256
  `fa0116afa2020a60cfcaaca0a60c22c00c14d19aaf0f363c5a00c9e3a40a1e57` <!-- PUBLIC-CONSTANT -->
  · **ar://eiHVpo3lzifCKF3HN0JrDCnS8BlEjIUCk1oFM-4nMS4** (Turbo free tier,
  winc 0) → https://arweave.net/eiHVpo3lzifCKF3HN0JrDCnS8BlEjIUCk1oFM-4nMS4
- **pointer row:** written by the same mint tx; readable by anyone at any
  public Jungle4 API (`get_table_rows code=bnrapolltest scope=bnrapolltest
  table=certs` → the `vendingtest2` row carries ar_id eiHVpo3l… +
  content_hash fa0116af…).

**2. RESURRECT from the certificate alone** — `node resurrect.mjs
vendingtest2 jungle4`, a fresh process holding only the agent name:

| # | gate | verdict |
|---|---|---|
| 1 | name road: name → `certs` row → ar id (Jungle4 chain state — a chain the estate does not control) | ok |
| 2 | ar id is a 43-char data item | ok |
| 3 | gateway fetch of the bytes over public HTTPS | ok — HTTP 200 |
| 4 | certificate is JSON | ok |
| 5 | **CONTENT HASH VERIFIES** (re-derive canonical JSON → sha256 → compare to in-record) | ok — fa0116afa2020a60… |
| 6 | chain row hash agrees with in-record hash (three-way) | ok |
| 7 | recipe carried (the species survives the estate) | ok |
| 8 | five answers carried | ok |
| 9 | **key road:** the member key ALONE finds the record on Arweave (GraphQL Member-Key tag search) | ok — 5 hits (the member's whole mint history) |
| 10 | record discoverable; owner recorded (throwaway RSA uploader) | ok |
| 11 | **FORGED COPY FAILS** (one flipped field ⇒ HASH MISMATCH ⇒ refused) | ok |

**3. The account view** (rendered + read back earlier at
https://monitor.jungletestnet.io/#accountOverview:bnrapolltest — created-by
junglefaucet 2026-08-29, balances, permissions, the powerup numbers; its
Contract tab renders all six vending actions).

## The one-line

Inside the powerup window the machine minted a second agent, stood it back up
from nothing but its name, proved the record's own hash, and refused a forged
copy — 11/11, every tx visible on the official monitor by deep link, the
certificate permanent on Arweave at $0.
