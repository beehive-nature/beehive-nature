# bPay Phase E — the Trezor signing runbook (founder-operated)

Phase E ends at a **locally verified signature**. It does not broadcast, does
not pay, does not upload, does not finalize. The cockpit is **My Data**
(bData); the organ is `crates/watchpay/src/wave.rs`; nothing here can move
value by construction.

## Where things stand (2026-09-19, this lane)

1. **The signing organ is built and offline-proven** (149/149 watchpay tests):
   the 15-law binding gate, the `payForQuotes` composer (selector
   `0xb6c2141b`, golden-pinned), the verification wall, the exactly-one
   receipt ledger. The bData UI carries the full review ("2 transactions
   expected — 1 approve + 1 payForQuotes over 56 quotes") and STOPS at
   SIGNED. Mock-proven 23/23 (`e2e/bdata-phase-e.mjs`).
2. **The machine currently holds ZERO authorization records.** The founder's
   reported live ceremony left no record in the bridge
   (`GET /v1/authorization` → `[]`; no `authorizations.json` anywhere on the
   laptop). AND the Phase-C-banked job (`up-1789780618488`, 4.0663 ANT) is
   **abandoned** — five newer force-fresh re-quotes ran 21:08–21:14
   (newest open jobs now quote ~4.2170 ANT). Under the no-silent-requote
   wall any older authorization is void by construction.
   → **Before signing can begin: refresh the price in My Data and press
   "I authorize this" against the CURRENT job.** That press is the founder's
   alone.
3. **The signing cockpit service (`bpay-sign`, default :8808) is the staged
   next slice.** Its endpoint contract is frozen (below) and the UI already
   speaks it (mock-proven). It binds the organ, persists receipts, and owns
   the device transport.

## The exact transaction count (established at source this lane)

**2 transactions = 2 device signatures.**
- 1 × ERC-20 `approve(paymentVault, exact ANT total)` on the ANT token
  (`0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684`)
- 1 × `payForQuotes([56 payments])` on the payment vault
  (`0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26`), Arbitrum One (42161)

Evidence: evmlib 0.9.1 `external_signer.rs` batches quotes at
`MAX_TRANSFERS_PER_TRANSACTION = 256`; 56 ≤ 256 → one call. "56 chosen quote
payments" ≠ 56 transactions. Wave (not merkle) is forced by the client for
56 chunks (< `DEFAULT_MERKLE_THRESHOLD`). If a future job exceeds 256
payments the count law recomputes (1 + ceil(n/256)) and the review states it.

## The Safe 7 transport ladder (evidence-ranked)

| transport | verdict | evidence |
|---|---|---|
| Browser Trezor Connect (connect.trezor.io) | **CANNOT drive a Safe 7** | THP matrix §2: zero THP lane in connect-web 9.7.3; the founder's pair prompt "never completes" |
| v1 bridge/USB (trezord :21325 / trezor-client) | **answers, refuses app messages** | btrezor measured 2026-07-30: `Failure_InvalidProtocol` on the safe7 emulator; trezord is v1-only; Suite 26.9.2's bridge is in-process (21325 only while Suite runs; not listening at last probe) |
| **Trezor Suite 26.9.2 experimental MCP** | **present in the installed build — founder-gated** | asar carries `TR_EXPERIMENTAL_MCP_SERVER`; z2.a review: `trezor_send_transaction` carries data/chainId/fees and invokes `ethereumSignTransaction` at source pin aee3f9e8. Suite may be INFRASTRUCTURE UNDERNEATH (Phase E brief); bData stays the cockpit |
| Rust THP host (port `rust/trezor-thp` from the firmware checkout) | **the estate-native path — not yet built** | mapped in THP matrix §4; substantial |

**Before the first hardware confirmation the preflight must be run
(founder's hand, harmless, no value):** device discovered → transport named →
Safe 7 model confirmed → account/path chosen → EVM address derived → equals
the payer or discrepancy surfaced → device confirmation appears → a refusal
is handled cleanly → zero broadcast. A source claim is not a device receipt;
the transport that actually worked gets recorded in the receipt.

## Enabling Suite's experimental MCP (founder gesture)

1. Trezor Suite → Settings → Experimental → enable **MCP Server** (the
   German-string probe confirms the toggle ships in 26.9.2).
2. Note how it is served (port/stdio) — first enable surfaces it; that
   discovery is a founder-present step of the preflight.
3. If the MCP path signs with the Safe 7, `bpay-sign` gains a Suite-MCP
   transport (Suite underneath; the review stays in My Data; the device
   screen remains the truth). If it does not, the THP Rust port is the lane.

## The frozen service contract (`bpay-sign`, staged slice)

- `POST /v1/sign/state` `{authorization_id, upload_id, payments[{quote_hash,
  rewards_address, amount_atto}]}` → `{ok, review{transaction_count, …}}` or
  `{ok:false, refusal{law, why}}` — runs all 15 binding laws, re-derives the
  commitment digest (never trusts the stored one).
- `POST /v1/sign/begin` (same body + `path`) → preflight (payer derivation),
  slot 1 (approve), slot 2 (payForQuotes), each verified through the wall →
  `{ok, receipt{state:'signed', slots[…], broadcast:false, …}}`. ONE
  dispatch per slot; no automatic retry; duplicates refuse at the slot
  binding; a restart never re-signs.
- `GET /v1/sign/receipt?authorization_id=` → the durable receipt.

Receipts persist under the service state dir (`sign-receipts/*.json`,
schema `bpay.sign-receipt/1`) — nonsecret fields only; never seed, keys,
PINs, passphrases, or pairing secrets (the organ holds none).

## THE TESTNET PROOF (2026-09-19, founder order: "just use ARB's testnet to prove it all first")

**PROVEN END TO END**, twice through the CLI driver and once through the
browser UI — prepare → authorize → binding gate (15 laws) → sign ×2
(wall-verified) → **SETTLE (both transactions MINED, status 1)**:

- Ledger: ganache at **chain 421614** (the Arbitrum Sepolia chain id)
  carrying **the REAL Autonomi contract artifacts** (evmlib 0.9.1's own
  `AutonomiNetworkToken` + `PaymentVaultV2` bytecode, deployed fresh —
  token minted 2.5M ANT to the hot key). Labeled **TESTNET-REPLICA** in
  every review/receipt (LAW 13's third shape: `replica: true`); public
  Sepolia needs only a funded key (faucets are human-gated — a 30-second
  founder drip moves the whole ceremony to the public testnet by deleting
  `BPAY_SIGN_REPLICA_*` from the service env).
- Confirmed on-chain: `payForQuotes` mined with **gasUsed 3,117,489 and
  exactly 56 ERC-20 Transfer events** — every payment distributed by the
  real vault code. The organ's selector `0xb6c2141b` matches the vendor
  artifact's own `methodIdentifiers` table.
- The organ receipt stays `broadcast:false paid:false uploaded:false` —
  settlement is a SERVICE-layer, structurally-testnet-only act
  (`/v1/testnet/settle` refuses any non-testnet receipt and any RPC not
  answering chain 421614; no mainnet settlement code exists in the binary).

### Run it yourself

1. `node /c/Users/travi/bpay-testnet/deploy-replica.mjs` (ledger on :8545 must be up: `npx ganache --chain.chainId 421614 --port 8545 --wallet.accounts "<testnet key>,10000000eth"`)
2. `bpay-sign` with `BPAY_SIGN_MODE=testnet-demo BPAY_SIGN_RPC=http://127.0.0.1:8545 BPAY_SIGN_REPLICA_TOKEN=<deployed token> BPAY_SIGN_REPLICA_VAULT=<deployed vault>` (:8808)
3. **Founder's hands: http://127.0.0.1:8899/bdata.html** (door running) — 🌐 Public → price → review → I authorize this → Sign with Trezor → Begin device signing (hot TESTNET key in this proof) → SIGNED → Settle on TESTNET.
4. CLI driver: `node ops/bpay-sign/testnet-ceremony.mjs` · browser presentation: `node ops/bpay-sign/present-testnet.mjs` (captures e2e/shots-bdata/bpay-e-{1..7}-390.png).

The Safe 7 replaces the hot key when a hardware transport lands (Suite
experimental MCP is the live candidate); everything else — bindings,
composer, wall, receipts, UI — is unchanged by construction.

## BOARD RULINGS BANKED (2026-09-19, post-proof review of f3962879)

1. **THE MEASURED GAS LAW is now an organ law + fixture**: composition
   REFUSES a payForQuotes gas ceiling below `600k + 50k × payments`
   (56 → ≥3.4M; measured burn 3,117,489; the 3M ceiling that reverted
   on-chain is a named, test-pinned refusal — `the_measured_gas_law_
   refuses_the_oog_ceiling_forever`).
2. **The permanent label**: "Arbitrum-Sepolia-shaped TESTNET-REPLICA
   using real Autonomi contract artifacts" — banner-strength in the
   signing review, named on the receipt panel, named in the settled
   banner, replica-conditional in the service's settle response. Never
   "proven on Arb's testnet" without the REPLICA word while on the local
   ledger. Public Sepolia is a SEPARATE receipt when the same code runs
   against the public network.
3. **The first Safe 7 ceremony splits into two observations** (bank the
   device receipt before any settlement): **A** — harmless
   preflight/rejection/approval → recovered signer matches the expected
   address; inspect; then **B** — the two real bPay transactions signed
   → watchpay verifies → **SIGNED / NOT BROADCAST**, and the receipt is
   inspected BEFORE any public-testnet settlement gesture. Suite 26.9.2
   experimental MCP is the transport candidate (My Data the cockpit,
   watchpay the verifier, Suite merely the pipe); do NOT build native
   Rust THP before banking the real Safe 7 receipt.
4. Mainnet stays deliberately untouched until the hardware transport is
   real AND the founder re-authorizes against a current job.
