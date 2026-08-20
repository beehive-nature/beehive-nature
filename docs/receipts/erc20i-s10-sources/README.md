# ERC-20i §10 — conserved contract sources

Recovered from the probe session's scratchpad
(`%TEMP%/claude/C--Users-travi/c12f969c…/scratchpad/`) and conserved here so the
source-level leg of `RECEIPT_ERC20I_S10_LOCKED_SEED_2026-08-20.md` is re-runnable by
any stranger without depending on a temp directory that cleanup could erase.

| file | what it is | the §10 evidence |
|---|---|---|
| `Pepi-Base.sol` (344 lines, 3 events) | the **Base** PEPi model — the file the scratchpad named `Pepi.sol` | L80/L89: collection/transfer copies the full `SeedData` struct into `_ownedTokens` — a frozen snapshot; L248: `mushroomOfOwnerByIndex` returns storage directly, no balance recompute; L176–183: existence is balance-coupled (FIFO dissolve) |
| `Pepi-ETH-items.sol` (724 lines) | the **Ethereum** item model (`l1_Pepi.sol` in the scratchpad) | `_mintItem` rolls seeds once and stores; `_transferItem` moves the stored struct verbatim under the same itemId; `getOwnerItemsPage` (L535) is a pure stored read |

Provenance: public deployed contracts (see the §10 receipt for the two-RPC bytecode
equality and the live counterexamples); sources as recovered — **byte-preserved, not
reformatted**. License per RECEIPT_GOOSE_PEPI_SEED_UNITS_2026-08-15: MIT, founder-held
artifact. Naming correction of record: the scratchpad's `Pepi.sol` is the **Base**
model (finder: zbCode via the §10 receipt; goose receipt corrected in place).
