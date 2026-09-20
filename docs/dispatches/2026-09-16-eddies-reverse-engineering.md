# EDDIES EXCHANGE — INDEPENDENT REVERSE-ENGINEERING · 2026-09-16

**Order (founder, verbatim):** *"Independently reverse-engineer Eddies Exchange
from public/read-only evidence. Ignore all previous interpretations. Primary
question: What is an Eddie, technically? Find the actual source of authority
for Eddie creation, ownership, transfer, settlement and destruction…*
Specifically test whether changing Eddie ownership requires an Arbitrum
transaction or can occur solely through /api/*. Do not assume eddde's
terminology describes the implementation. Research only. GET/read-only/on-chain
read calls only. No accounts, wallet connections, signatures or payments.*
**Method independence:** fresh deployment read (entry bundle
`index-Dooy-XIV.js`, 1,011,336 B + 17 priority route chunks, all downloaded
this session); the prior Eddies dispatch was NOT read this session and nothing
below cites it. eddde's terminology used only as search strings, never as
facts. **Constraint compliance:** browser-asset GETs, one unauthenticated API
GET (the founder-supplied invoice URL + /api/health), and Arbitrum One
read-only JSON-RPC (`eth_call`, `eth_getCode`, `eth_getBalance` — batched
POST is the transport for read methods, zero mutations sent). No accounts, no
wallet, no signatures, no payments.

---

## 1 · DIRECT ANSWER

**An Eddie is a row in the Eddies Exchange server database** — a €$-denominated
fund/balance object (acceptance-window classes incl. 0h/24h visible in live
data) owned by a **username account**, mutated exclusively through
PQ-signed `/api/*` calls against the **"eddies-gateway"** server. It is NOT an
on-chain token or NFT (no ERC-20/721 touches the Eddie lifecycle; the only
ERC-20 in the app is official ANT, used for top-up payment), NOT
cryptographically bound to ANT (ANT payments go by hand-built calldata to a
hardcoded, code-less, zero-balance EOA, with the txHash **client-reported** to
the server), NOT independently verifiable through Autonomi (scratchpad vaults
are AES-GCM-encrypted client-side under **secret-derived names**), and only
flavor-wise a "signed obligation" (the PQ signatures authenticate API callers
to the server — they do not make obligation state verifiable by third
parties).

**What decentralized primitive does Eddies add beyond ANT on Arbitrum +
Autonomi storage + a conventional application server? NONE, at this evidence
state.** The chain leg is a burn-shaped payment; the storage leg is private
encrypted persistence; the authority is the server.

## 2 · THE FIVE-WAY CLASSIFICATION (founder's test)

| hypothesis | verdict | evidence |
|---|---|---|
| on-chain token/NFT | **NO** | Eddie lifecycle = `/api/*` only; no ERC-721 anywhere in bundles; sole ERC-20 = official ANT for top-up; second constant `0xe495…0943` has **zero code on Arbitrum** (live `eth_getCode` → `0x`) and does not appear in the current build |
| cryptographically bound to ANT | **NO** | payment = hand-built `0xa9059cbb`+padded-args `transfer()` to hardcoded `0x742d35Cc3d2fF4E2b4b3b25b06ee6f9DB55B94Da`; recipient live-read: **no code, 0 wei** — a virgin EOA (the classic Ethereum documentation example address); the txHash is then passed to the gateway by the CLIENT (`syncUserVault({transactionHash…})`) — client-asserted, server-side verification not observable in client code |
| independently verifiable through Autonomi | **NO** | vault save: `POST /dweb-0/scratchpad-public {name: vault_<secret[:16]>, content: PBKDF2→AES-GCM(plaintext, secretKey)}`; load: `GET /dweb-0/scratchpad-public-by-name/vault_<secret[:16]>` then decrypt — name is derived FROM the secret; a third party can neither discover nor read the mirror |
| signed obligation/receivable | **flavor only** | request signing is real PQ: canonical strings extracted verbatim — `eddies-write2:${username}:${ts}:${path}:${bodyHash}` (headers `x-eddies-pq-user/-key/-sig/-ts`) and `eddies-move3:${username}:${move}:${account}:${ts}:${expires}` (body `auth2_pk/auth2_sig/auth2_ts/auth2_expires`) — but keys live in `localStorage`, and the signatures authenticate CALLERS to the server; the obligation's state itself is a server row |
| server/database record | **YES — the authority** | `/api/health` self-identifies `eddies-gateway`; the live invoice is plain unauthenticated JSON keyed by usernames; `godmode` admin view (`isGodmodeViewing, godmodeTarget:<username>`) reads any user's balances server-side; an offline "Autonomi Router" falls back per-endpoint to scratchpad tables (`["payment_requests","dbcs"]`) when the clearnet API is unreachable — a cache/mirror, not a second authority |

## 3 · ONE EDDIE, END-TO-END (anchor: the founder-supplied live invoice)

`GET /api/payment-requests/18d5c884-39de-690e-534c-2adbf51e10c3`
(unauthenticated, this session) →

```json
{"acceptanceWindow":24,"amount":100,"fiat":false,"type":"invoice",
 "createdAt":1789556897181,"expiresAt":1789643297181,   /* exactly +24h */
 "sender":"eddde","recipient":"autonomiphilus","status":"pending",
 "escrowId":null,"claimCode":null,
 "metadata":{"has0hFunds":false,"selectedFundIds":["1x9x5a6argwp-godset-…"]},
 "shareLink":"/payment/18d5c884-…","shareToken":"18d5c884-39de-93e3-…"}
```

- **Creation** — `POST /api/payment-requests`, PQ-signed per §2; the server
  mints the row (opaque fund IDs like `1x9x5a6argwp-godset-<epoch>-<n>-<n>`),
  sets `expiresAt = createdAt + acceptanceWindow`. Identities are USERNAMES,
  not keys/addresses, on the object itself.
- **Ownership / payment / invoice** — the recipient opens `/payment/<id>`,
  accepts via `POST /api/payment-requests/<id>/accept` (route regex +
  scratchpad-fallback table `["payment_requests","dbcs"]` both read from the
  bundle): a server-side ledger move of the selected fund records between
  username accounts. **No chain event exists anywhere in this leg.**
- **Settlement (the only chain touch)** — top-up/exit ramp in
  `AutonomiSettings` chunk: MetaMask `eth_sendTransaction` with either an ETH
  value tx (`gas 0x5208`) or hand-built ERC-20 ANT calldata; recipient
  hardcoded `0x742d…94Da` (dead EOA — see §2); client polls
  `eth_getTransactionReceipt` up to 30×1 s, then calls
  `syncUserVault({paymentMethod, transactionHash, …})`. Failure branch:
  *"Payment Successful, Sync Pending"* — the two legs are explicitly decoupled
  and the hash is client-asserted.
- **Transfer** — `/api/transfer`, `/api/transfer/reclaim`,
  `/api/receivable-transfers/pending`, `/api/real-time-transfer(s)`,
  `/api/inflight/lock`, plus class-swaps `/api/swap/to-0h` / `from-0h` —
  all API mutations, all PQ-signed, no chain involvement.
- **Destruction / expiry** — `expiresAt` (+24 h on the anchor);
  farm-side annihilation bookkeeping (`balanceAnnihilationCount` field,
  `/api/farm/link-node|unlink-node|sync-uptime`,
  `/api/farm-uptime-transfers(/pending)`) — server-side.

**The founder's specific test, answered: changing Eddie ownership NEVER
requires an Arbitrum transaction — it occurs solely through `/api/*`.**
Arbitrum appears in the app only as the top-up payment rail (ETH/ANT to the
dead EOA) and even there the chain event is not the trusted input — the
client-reported txHash is.

## 4 · EVIDENCE-BACKED ARCHITECTURE DIAGRAM

```
                    USER BROWSER — the only real crypto custody
   localStorage: PQ keypair (pqSignaturePublicKey + secret),
                 user secretKey, currentUser.username
      │                                          │
      │ sign "eddies-write2:${user}:${ts}:        │ PBKDF2 → AES-GCM encrypt;
      │   ${path}:${bodyHash}"                    │ name = vault_${secret[:16]}
      │ sign "eddies-move3:${user}:${move}:       │ (name DERIVED from secret —
      │   ${acct}:${ts}:${expires}"               │  undiscoverable + unreadable
      │ → headers/body: x-eddies-pq-sig/-ts/-key, │  to third parties)
      │   x-eddies-user / auth2_*                 │
      ▼                                           ▼
 ┌────────────────────────────┐        ┌─────────────────────────────┐
 │ EDDIES GATEWAY  (server)   │        │ dweb.eddiesexchange.com     │
 │ self-id "eddies-gateway"   │        │ Autonomi gateway (CF-front) │
 │ ══ THE AUTHORITY ══        │        │ encrypted scratchpads =     │
 │ users · €$ funds (0/1/24h  │        │ PERSISTENCE + offline       │
 │ + 42 classes) · invoices · │        │ router fallback — NOT an    │
 │ escrows · loans · DBC      │        │ authority, NOT verifiable   │
 │ e-cash · farm uptime ·     │        └─────────────────────────────┘
 │ annihilation · godmode     │
 └─────────────┬──────────────┘
               │ txHash CLIENT-ASSERTED via syncUserVault();
               │ server-side verification not observable in client code
               ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ ARBITRUM ONE (hard-bound: 4-RPC fallback arb1/publicnode/drpc/ │
 │ blastapi; MetaMask-class wallet per CSP)                       │
 │  ANT ERC-20 0xa78d…bdb684 — OFFICIAL (live eth_call:           │
 │  name "Autonomi", symbol "ANT")                                │
 │  ONLY chain touch: ETH value tx or hand-built 0xa9059cbb       │
 │  transfer() → 0x742d…94Da — DEAD EOA (no code, 0 wei).         │
 │  No lock, no escrow, no spend-approval, no ERC-721;            │
 │  NO Eddie ever appears on-chain.                               │
 └────────────────────────────────────────────────────────────────┘
```

## 5 · SUPPORTING FACTS (all this session, current build)

- **Chain binding:** Arbitrum One RPC fallback list verbatim
  (`arb1.arbitrum.io/rpc`, `arbitrum-one-rpc.publicnode.com`,
  `arbitrum.drpc.org`, `arbitrum-one.public.blastapi.io`); wallet interaction
  is raw `window.ethereum.request` (eth_sendTransaction /
  eth_getTransactionReceipt) — no ethers/viem contract abstraction in the
  payment path.
- **API surface mapped from the entry bundle** (65+ paths): auth
  (login/register/logout, TOTP ×5, webauthn, bitcoin), `/api/payment-requests`
  (+/accept+/reject), `/api/transfer(+/reclaim)`, `/api/escrow/*`,
  `/api/loans/*`, `/api/dbc/mint|supply|borrow|exchange|wallet` (e-cash),
  `/api/bundle/create-42|unbundle-42`, `/api/farm/*`,
  `/api/send-negative-balance`, `/api/sealed(/key)`, `/api/time-value/…`,
  `/api/bearer/issue`, `/api/signers/link`, `/api/stellar/transfer`,
  `/api/offline/purse(/release)`, `/api/sqrl/redeem-woven`, tips, ads, DNS…
- **E-cash cryptography present:** entry bundle carries secp256k1 generator
  constants (`0x6666…66` Pedersen/blind-signature generator family,
  `0x52036cee…`, `0x216936d3…`) — application-internal, server-mediated
  (`/api/dbc/*`); the one subsystem worth a separate protocol-reuse look,
  and it does NOT change the §1 answer.
- **Security observations (read-only findings, reported as evidence):**
  (a) the invoice GET is unauthenticated AND returns a `shareToken` bearer
  credential to any anonymous reader; (b) PQ signing keys + user secretKey
  live in `localStorage` (XSS-extractable class); (c) all "ANT payments"
  route to a hardcoded doc-example EOA that has never been used; (d) a
  server-side `godmode` view impersonates arbitrary usernames.
- **Not re-derived this pass (out of scope, no claim):** farm payout rates,
  the "42" class semantics beyond endpoint names, DBC internals, server-side
  tx verification, the media/"NFT" minting path (`webp_*` fields present on
  the invoice object, all null on the anchor).

## 6 · Provenance & landing

Scratch directory `/tmp/eddies-recon/` (fresh bundles
`index-Dooy-XIV.js` + 17 chunks; the prior session's older
`index-B9Ujs5IL.js` still on disk was excluded from every grep). Reads:
homepage + assets (GET), invoice + health (GET), Arbitrum One JSON-RPC
(`eth_call` ×2, `eth_getCode` ×2, `eth_getBalance` ×1). Landed from
`../wt-zcode-eddies`, branch `zcode/eddies-reverse-2026-09-16`, cut from
fresh `origin/main` (74d2134f), §7 seat shape, four pre-push checks, pushed
branch + main. Queue item #1 updated with this receipt.
