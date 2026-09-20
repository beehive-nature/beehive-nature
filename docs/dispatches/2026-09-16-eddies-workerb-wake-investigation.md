# EDDIES WORKERB WAKE — implementation evidence banked, binding question answered · 2026-09-16

**Seat:** zCode (Eddies Workerb). **Wake condition FIRED (1):** new primary Eddies
evidence arrived — the founder's 2026-09-16 order quoted verbatim in
`docs/dispatches/2026-09-15-eddies-antenglement-primary-source.md` and re-issued
with the wake: *"WAKE CONDITION FIRED: new primary Eddies evidence arrived.
Investigate eddiesexchange.com and the supplied payment/invoice object…"*
Research only; no integration; no product code touched.

**Mid-run founder relay (2026-09-16, same day):** the live invoice/payment URL —
`eddiesexchange.com/payment/18d5c884-39de-690e-534c-2adbf51e10c3` — was supplied
mid-run (provenance: founder-relayed Discord evidence, i.e. CLAIM-adjacent for
the URL's meaning; everything the fetch and code show below is FACT with
receipt). A founder architecture ruling and a new head question were also
relayed and are adopted below (quoted where load-bearing).

**Method receipt.** Static GETs only against `eddiesexchange.com` and
`dweb.eddiesexchange.com` (root, both SPA shells, 53 JS/WASM assets, one API
GET for the supplied invoice id), plus public read-only RPC `eth_call`s to
Arbitrum One, RDAP/whois/TLS lookups, and bounded web/Autonomi-docs searches.
No account, no wallet, no POST, no binaries executed. Scratch copies at
`/tmp/eddies-recon/` (dispatcher + workerb receipts share this directory).

---

## 0 · LEAD FINDING — the founder's binding question

> Founder head question (verbatim, 2026-09-16): *"What cryptographically/
> economically binds the server-side Eddie obligation to the ANT and Autonomi
> scratchpad state?"*

**Answer: NOTHING cryptographic binds them. The binding is economic reference
plus operator trust.** Decomposed, with the ladder:

1. **The Eddie obligation ledger is server-authoritative.** Balances,
   obligations (payment requests, receivables, debts, escrow, loans) live in
   the gateway server's database, surfaced over a clearnet REST API
   (`/api/payment-requests/...`, `/api/transfer`, `/api/escrow/agreements`,
   `/api/loans/...`). Server-side state includes counters the client merely
   displays (`annihilationCount`, `custodyFunds`, `zippedFunds`, `quantum`,
   `belowMinimumSince`). FACT — bundle `index-B9Ujs5IL.js` (account-state
   reader maps these fields verbatim; full API regex table `fQ` in bundle).
2. **The invoice/payment object carries no client-verifiable proof.** The
   fetched object (§3) is bare JSON: `requestId`, `shareToken`, `sender`,
   `recipient`, `amount`, `status`, timestamps, metadata. No signature, no
   hash, no key the recipient checks. The only "capability" is knowledge of
   the URL/id. FACT (unauthenticated GET receipt, 2026-09-16).
3. **Acceptance is an authenticated API mutation, not a verification of
   on-chain or on-network state.** Accept = `POST /api/payment-requests/:id/
   accept` with `X-Username` plus a post-quantum signature header over a
   domain-prefixed message (`eddies-move3:{username}:{sender}:{amount}:{ts}:
   {expires}` → `auth2_pk`/`auth2_sig`/`auth2_ts`/`auth2_expires`). This binds
   the action to the **user's PQ identity key**, not to ANT, not to Autonomi.
   FACT — bundle `Kr()`/`vh()` signers.
4. **ANT's only roles are reference, payment rail for one purchase, and a
   payout address.** (a) pricing reference (CoinGecko `autonomi` EUR quote +
   Frankfurter FX); (b) `transfer()` of the official ANT ERC-20 on Arbitrum
   One via MetaMask to buy "merkle-days" — recipient is a plain EOA (no code,
   nonce 0, balance 0 — never used on-chain as of 2026-09-16); (c) an optional
   signed `"EddiesExchange quantum-foam coupling\nuser: …\nts: …"` message
   (`/api/farm/couple-rewards`) that merely registers an EVM rewards address.
   No `approve()`, no escrow contract, no lock, no bridge — `approve` appears
   only inside the stock ERC-20 ABI fragment, never called with a spender.
   FACT — Farm chunk + RPC receipts (dispatcher cross-verified).
5. **Scratchpads are an encrypted client mirror, not an authority.** Vault
   content is encrypted client-side (PBKDF2-SHA256 100k iter → AES-256-GCM,
   fresh salt per save) and pushed to named Autonomi scratchpads via the
   gateway's `/dweb-0/scratchpad-public` family. The client's "Autonomi
   Router" falls back to the vault **only when the gateway is unreachable**;
   when reachable, the server is read and the vault mirrored. Two shared
   public registries (global user index, marketplace registry) do live on
   scratchpads. FACT — `mO()` encryptor, `uN` "autonomi"-typed backend class,
   router code paths.
6. **Economic binding only:** €$ amounts are denominated against EUR
   (`/api/eur-value`, `euroPerHundred` ladders, Frankfurter) and ANT
   (CoinGecko), and one class of ledger entries (merkle-days) is *sold* for
   ANT. If the operator's server lies or vanishes, no client can reconstruct
   authoritative obligations from Autonomi state alone (mirror is ciphertext
   keyed to user secrets) nor from Arbitrum (no contract holds or escrows
   anything). INFERENCE from FACTS 1–5.

**Therefore** (founder-ruled framing, adopted): Eddies is a **hybrid
centralized application** — canonical ANT ERC-20 on Arbitrum One (reference +
one purchase rail) + Autonomi scratchpads (encrypted persistence + shared
registries) + a **clearnet, server-authoritative application ledger** for
payment requests/escrow/loans/transfers. It is NOT an Autonomi-native monetary
rail. Useful ideas may live in it (§6), but it is very different from the
decentralized funded-authority primitive originally suspected.

---

## 1 · Wake receipt + new-claims bank (eddde statements preserved as CLAIMS)

Wake: condition (1) of the 2026-09-15 park — "the 'How Eddies Work' artifact
contents or implementation source arrives" — fired 2026-09-16 by founder order
(the artifact itself still has not arrived; its *implementation* is public).
Park record: queue item #1, `docs/agents/PROTOCOL-REUSE-QUEUE.md`.

New-claims bank (all eddde/founder-relayed, pre-evidence):

- CLAIM A: "1,000 farming days → 1,000 Eddies" (farm-time issuance).
- CLAIM B: Eddies are "SAFE Network native" (SAFE = Autonomi's former name).
- CLAIM C: Eddies are "uploaded to Autonomi".
- CLAIM D (implicit from invoice URL): a payment link identifies an invoice
  object that renders a payable page.

Graduation table in §5. Prior 2026-09-10/09-15 claims (funds↔uptime, €$
balance, pay-link, obligation persistence, antenglement) remain on record in
the 2026-09-15 dispatch; graduations below.

---

## 2 · Findings by the founder's six questions

### 2.1 What technically IS an Eddie?

**FACT.** An Eddie is an **application-ledger bearer unit** — a row in the
operator's database — with a rich client-side grammar. Evidence:

- Server tables (IndexedDB mirror schema, `k5`/`II` in `index-B9Ujs5IL.js`):
  `wallets, dbcs, transactions, payment_requests, debts, escrow_agreements,
  loan_offers, receivable_transfers, blackholes, combined_bundles, companies,
  user_aliases, stellar_bindings, webauthn_credentials, error_logs`.
- Every account has `eddiesBalance` + `eddiesUnspend` (a spend-hold balance).
- Funds (the concrete €$-carrying objects) are **denominated containers**
  (default €$100) with an **acceptance window** ∈ {0h, 1h, 24h} (+ special 42
  class), a fiat/crypto ticker ("Basket cut — That Eddie now holds yuan, euro
  and dollar at once"), `kind: virtual|real`, timestamps (age), and states
  masked/stamped/locked/zipped. Screenshot "€$100 (0)" / "€$100 (24)" =
  €$100 funds with 0h/24h acceptance windows — **CONFIRMED** by the live
  invoice's `acceptanceWindow: 24` and the window-class table
  `{0:{...},1:{...},24:{...}}`.
- Offline token format (binary, QR/audio-modem carried):
  `{version:1, type, timestamp, nonce, payload:{eddie:{id, amount, window,
  owner}, signature?}, targetOwner?}` — decodes from a 60-ish-byte payload;
  audio carrier frequencies per window class (0h=1600Hz, 1h=1200Hz, 24h=800Hz);
  downloadable as `.eddie.json` with generative art (`.png`), sound (`.wav`),
  and video (`.mp4`) per Eddie — the "NFT" surface.
- A Rust/wasm DBC wallet (`eddies_chain_bg.wasm`, exports `mintDbc`,
  `verifyDbc`, `isSpent`, `markSpent`, `getSpentbookStats`,
  `createTransferReceipt`, `receiveTransferReceipt`, `threeWordAddress…`)
  implements Digital-Bearer-Certificate-style units client-side with a
  spentbook; server DBC endpoints exist (`/api/dbc/wallet/:id/send`,
  `foam-collide`, `reclaim`).
- Sending = `POST /api/bearer/issue` → returns a **bearer note + note_hash**
  (note text parses as `/^🐜\s*drawn\s*€\s*(\d+(\.\d{1,2})?)$/` — an actual
  banknote/draft literal).

**Class: NOT an NFT in the token-standard sense** (no ERC-721/1155 contract
anywhere; "NFT" in the site meta description is marketing for per-Eddie
generative media + unique ids). It is a **mutual-credit/bearer-note hybrid
with time-denominated subclasses**, centered on one operator.

### 2.2 How does farming time create/claim an Eddie?

**FACT (UI law strings, Farm chunk + bundle).** Verbatim from the app:

> "Run an Autonomi node — it is detected and linked here by itself. Every UTC
> day your node is seen alive credits 1 farm-day, and a day is worth two
> things at once: 1 Eddie of uptime, paid out as a €$100 0h container sourced
> from genesis (god) once every 100 days, and €$200 of foam-capture budget —
> one €$100 1h particle plus one €$100 24h particle, one of each per day.
> Couple your earnings address is read off the node, so the uptime pays to it
> — days farmed before that are held, not lost, and pay out in full."

- Node linking: `/api/farm/link-node` `{username, pid, rewards_address}` (pid
  = the antnode's peer id; "Node is online & reachable — farm-days start
  crediting"), `/api/farm/unlink-node`, `/api/farm/local-nodes`,
  `/api/farm/status`, `/api/farm/sync-uptime`.
- So **1 farm-day ≈ 1 Eddie (€$100)** → eddde's "1,000 farming days → 1,000
  Eddies" is consistent with the app's own issuance law (graduates to
  VERIFIED-IN-SHAPE, rate is a UI string + server accounting we cannot audit).
- Farm/merkle days are **transferable commodities**: `/api/farm-uptime-transfers`
  (seller→buyer offers with approve/reject), and marketplace listings
  `{kind:"uptime", farm_days, merkle_days}` priced in €$.
- Merkle-days are **bought with ANT**: `days × ant_per_merkle_day` (default
  2222) ANT via MetaMask on Arbitrum → `POST /api/farm/pay-merkle-days` with
  the tx hash ("The payment went through but the gateway would not bank it").
- **Annihilation law** (verbatim): *"Whatever else you do, an ant node has to
  stay up. More than three days without it answering and the Eddies annihilate
  just the same."* — plus an `annihilationCount` server counter and a UI
  virtual/real pair-annihilation ("vp-annihilate") mechanic. Node uptime is a
  **liveness bond** on holding Eddies, not a proof-of-work mint.
- "Quantum foam" = the daily capture budget: "Link an antnode to earn
  quantum-foam capture allowance", "capture in the foam costs no farmed day —
  for whoever gets there first" (first-come race), `foamCaptures` classified
  within debts. No quantum mechanics beyond the naming.

### 2.3 What does "uploaded to Autonomi" mean at implementation level?

**FACT.** The app is a Vite SPA served from two origins: `eddiesexchange.com`
and `dweb.eddiesexchange.com` (the dweb origin is the API/gateway base; the
main origin 308-redirects `/api/*` to it). Both shells run a purge script for
an injected `autonomi-toolbar` — i.e. an **Autonomi gateway proxy** can serve
these pages and injects its toolbar; the clearnet domains front the same
content through Cloudflare. Gateway selection: local `http://127.0.0.1:5537`
(a local Autonomi gateway) → `https://dweb.eddiesexchange.com`, with failover
(`eddies_gateway_url`, `/api/mesh/gateways` mesh discovery), and a **content
pin**: `GET /api/log/chain` must return `links[0].shard_addr` equal to
`002f89831656c8d40e7717155f5620d6775f36ba80a63858e6b708319c9889b4` PUBLIC-CONSTANT (Autonomi
shard address, 32 bytes) or the gateway is rejected — the site content itself
is sharded on Autonomi and gateways are verified against the pinned shard.
Persistence API: `POST /dweb-0/scratchpad-public {name, content}` and
`GET /dweb-0/scratchpad-public-by-name/:name` — named Autonomi scratchpads
(cross-checked: Autonomi Rust crate exposes `Scratchpad` = "mutable space for
encrypted data on the Network", address derived from owner pubkey —
docs.rs/autonomi). Used for: encrypted per-user vaults (`vault_<key-slice>`,
content = PBKDF2→AES-GCM ciphertext), per-table mirrors
(`eddies_<table>_v1`), a **global user index** and a **marketplace registry**
(public shared state). Claim C graduates to VERIFIED (in shape: application
data on real Autonomi datatypes via their gateway; the *ledger* is still
server-authoritative — see §0).

### 2.4 Invoice representation / storage / verification

**FACT (receipts).** The supplied URL (founder-relayed, §1 provenance;
`/payment/18d5c884-39de-690e-534c-2adbf51e10c3`) serves the
SPA shell; the object itself is the unauthenticated GET
`https://dweb.eddiesexchange.com/api/payment-requests/<id>` — **200, plain
JSON** (fetched 2026-09-16 ~15:52 UTC):

```json
{"acceptanceWindow":24,"acceptance_window":24,"amount":100,
 "billingMethods":null,"claimCode":null,"claimedBy":null,
 "createdAt":1789556897181,"escrowId":null,"euroAmount":null,
 "euroPerHundred":null,"fiat":false,"listingHours":null,
 "message":"maybe spam your eddie stuff in offtopic",
 "metadata":{"has0hFunds":false,"isInvoice":true,
   "selectedFundIds":["1x9x5a6argwp-godset-1780600584961-c1787992529413-1212"]},
 "note":"maybe spam your eddie stuff in offtopic",
 "recipient":"autonomiphilus","requestId":"18d5c884-39de-690e-534c-2adbf51e10c3",
 "sender":"eddde","shareLink":"/payment/18d5c884-39de-690e-534c-2adbf51e10c3",
 "shareToken":"18d5c884-39de-93e3-509b-4be3fc706db3","status":"pending",
 "type":"invoice","webpAddress":null,"webpBatchAddress":null,
 "webpBatchUrl":null,"webpUrl":null}
```

- **Representation:** snake/camel-duplicated JSON fields (migration seam);
  type `invoice`; amount 100 with `acceptanceWindow` 24 (hours — matches
  `expiresAt − createdAt = 86 400 000 ms` exactly; createdAt decodes to
  2026-09-16T11:08:17.181Z, i.e. minted ~4.7h before fetch — this is eddde's
  own live invoice, note "maybe spam your eddie stuff in offtopic", recipient
  "autonomiphilus" — the Discord context is direct).
- **Storage:** gateway server database (clearnet API), with optional
  `webp*Address`/`webp*Url` fields for an invoice card image stored at an
  Autonomi address (null here) and a client vault mirror. NOT stored as an
  Autonomi-native invoice datatype.
- **Verification:** **none on the object** — no signature/hash/MAC. Accept /
  reject are username-authenticated POSTs with the PQ `eddies-move3:` header
  (§0.3). The share link is bearer-by-knowledge (shareToken exists but the
  public link carries only the requestId).
- **Unconfirmed observation (not a finding):** the id's version nibble parses
  as 6 (time-ordered UUIDv6 family) and the shareToken's as 9, both sharing
  the timestamp prefix `18d5c884-39de` (same-millisecond mint). The client
  bundle only shows `crypto.randomUUID` (v4); id minting is server-side and
  not visible, so minting method stays UNCONFIRMED.
- Offline fallback: the Autonomi Router can serve `payment_requests` rows from
  the encrypted vault when the gateway is unreachable (404-shaped errors
  otherwise) — again a mirror, not a proof.

### 2.5 Where does ANT participate?

**FACT.** (Citation law: ANT = Autonomi Network Token.) The app pins the
**canonical official ANT ERC-20 on Arbitrum One** — `0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684`
(chainId 42161/0xa4b1, 18 decimals; dispatcher-verified by read-only
`eth_call` name/symbol; Arbiscan token page: "Autonomi", ANT, 41k holders;
docs.autonomi.com/token import page lists the same address). Roles:

1. **Price reference** for €$ ladders (CoinGecko `autonomi` EUR + Frankfurter).
2. **Merkle-day purchase rail** (MetaMask `transfer()` on Arbitrum; default
   recipient constant `0xe495524572f5f668CfB480B0Eba113Bbf77F0943` is an EOA
   with no code, nonce 0, balance 0 — dead/unused; founder discipline: do not
   chase further).
3. **Rewards coupling**: EVM signature over the quantum-foam coupling message
   registers a payout address; uptime "pays to it".
4. A standalone "Send ANT tokens" feature (plain ERC-20 transfer to any
   address — a wallet convenience, not a ledger leg).

No locking, no bridging, no collateral contract, no on-chain €$ representation.
A second bundled "MONEY X" ladder prices €$100 ↔ €200 (and window-42 ↔ €500)
via `/api/loans/*` style peer offers ("Lend €$100 Eddies, borrow €200 euros")
— euro-credit against Eddies at operator-set ratios; real-euro settlement leg
is outside anything visible in code (UNKNOWN).

### 2.6 Primitive class: NFT vs obligation vs credit vs other

**INFERENCE (strongly evidenced).** Eddies = **operator-centered mutual-credit
bearer units with time-structured acceptance** — simultaneously:
- **credit** (€$ ledger balances against a central operator; loans of euros
  against Eddies; aged-Eddies interest law: *"the Eddies that repay it must
  carry at least as much age as this loan has — purchasing power is the
  interest"*),
- **obligation/receivable** (pending invoices; `receivable_transfers`
  approve/reject; obligations to non-adopters persist — eddde's renter claim
  matches the `pending`+`expiresAt` machinery),
- **commodity time** (farm-days/merkle-days listed and transferred),
- **collectible media** (per-Eddie generative art/audio/video, steganographic
  watermark "Hide €$X in an image", `.eddie.json` files) — the "NFT" skin
  without a token standard.
Not: an Autonomi-native token, not an on-chain asset, not final settlement.

---

## 3 · The 28-question map

| # | Question | Answer (ladder) |
|---|---|---|
| 1 | What is an Eddie? | **FACT** §2.1: app-ledger bearer unit; €$100 default container; window classes 0/1/24(+42); virtual/real; DBC wasm wallet; generative media. |
| 2 | What is a "fund"? | **FACT** a denominated Eddie container object (ticker, amount, window, age, states masked/stamped/zipped); selectable (`selectedFundIds` in live invoice). |
| 3 | Why 42 funds ↔ app balance? | **PARTIAL/FACT-adjacent** "42" is a special window class (window-42 MONEY pays €500/hundred vs €200; "42s cannot [be listed]"); screenshot's "42 funds" most plausibly = funds of the 42 class; exact account mapping UNKNOWN (needs account view). |
| 4 | What creates €$? | **FACT** operator issuance: genesis("god") payout (€$100/100 days per node), foam-capture particles (€$200/day), merkle-day purchase with ANT, loans ("cash in money"). |
| 5 | What destroys €$? | **FACT** pair-annihilation ("vp-annihilate", `annihilationCount`, `blackholes` table), the 3-day-offline annihilate law, repayment of loans in aged Eddies. |
| 6 | Is €$ transferable? | **FACT** yes, P2P inside the app (`/api/transfer`, `/api/bearer/issue` notes, real-time transfers, inflight hop/lock/settle); no external chain rail. |
| 7 | Redeemable for what? | **PARTIAL** app-internal: farm/merkle-day listings, loans against euros (MONEY ladder €200/€500 per €$100), cash-swap book; euro settlement leg UNKNOWN/outside code. |
| 8 | What backs it? | **INFERENCE** nothing but operator credit + EUR/ANT price references + the node-liveness annihilate bond. No reserve visible. |
| 9 | Pay link cryptographically contains? | **FACT** nothing cryptographic: URL path = server row id (UUID); object has no sig/hash; shareToken unused by the public link. |
| 10 | Payment acceptance = ? | **FACT** authenticated POST accept (username + PQ `eddies-move3` sig header); server marks request; optionally via escrow accept-and-pay. |
| 11 | "Owes you" meaning? | **FACT** a pending payment-request/receivable row (status `pending`, `expiresAt`, `receivable_transfers` approve/reject); claimable later — persistence to non-adopters matches eddde's renter example. |
| 12 | Obligations expire? | **PARTIAL** `expiresAt` = createdAt + window (24h observed); expiry enforcement server-side; status stays `pending` past window in at least one observed shape — expiry semantics per-row UNKNOWN at server. |
| 13 | Repudiable? | **INFERENCE** yes at the operator layer (server-authoritative; no client-verifiable proof); user-side repudiation requires server cooperation. |
| 14 | Double-spendable? | **PARTIAL** server prevents in-ledger doubles (spentbook stats in wasm; `eddiesUnspend` hold balance; inflight lock/settle); bearer notes/files (`.eddie.json`, audio) have no visible online-bond — offline double-presentment UNKNOWN (wasm `verifyTransferReceipt`/`isSpent` exists but needs gateway). |
| 15 | Netting? | **PARTIAL** receivables vs debts on one account; `/api/debts/:id/transfer`; escrow vote/punish; no visible multilateral netting engine. |
| 16 | Counterparty never adopts? | **FACT** obligation persists as pending receivable (eddde claim graduates); expiresAt caps it; farm-days/merkle-days tradeable to third parties instead. |
| 17 | ANT-node uptime role? | **FACT** liveness bond: 1 Eddie + €$200 foam per UTC day alive; >3 days unanswered → Eddies annihilate; pid-linked via `/api/farm/link-node`. |
| 18 | Blockchain ANT role? | **FACT** §2.5: price reference + merkle-day purchase + rewards coupling address. |
| 19 | Does ANT move on-chain? | **FACT** only in the merkle-day purchase and the send-ANT feature — plain `transfer()` to an EOA (currently unused address); no contract interactions. |
| 20 | Locked/delegated/signed/proven/referenced/untouched? | **FACT** mostly *referenced* (prices, coupling sig); *moved* only for merkle-days; never locked/delegated/escrowed. |
| 21 | "antenglement" technically? | **FACT (bundle)** `FZ=["antenglement","maid","ant"]` is a tag list for the ANT-wallet feature family (deposit tagging); no quantum/entanglement code — the "entanglement" is: run a node (annihilate law) + hold/couple ANT (coupling sig) + the ledger associates both. Marketing term. |
| 22 | ANT node offline? | **FACT (UI law)** >3 days → "the Eddies annihilate just the same"; `annihilationCount` counter; days-before-coupling "held, not lost". |
| 23 | Identity links node↔Eddie↔address? | **FACT** username account binds all: node pid linked to username; PQ sig keypair per account; optional EVM rewards address coupled by wallet signature; Bitcoin auth (BIP39 + schnorr), WebAuthn/PRF, TOTP, Stellar bindings also supported. |
| 24 | Publicly linkable? | **PARTIAL** global user index scratchpad is public (usernames/keys); EVM address link is disclosed to the operator and in coupled rewards; on-chain ANT address ↔ username mapping not published on-chain. |
| 25 | Sybil resistance? | **INFERENCE** weak/bounded: one node-pid per account (link/unlink server-side), annihilate law punishes idle accounts, foam capture is first-come-raced; no PoW/stake visible. |
| 26 | Conservation invariant? | **PARTIAL** virtual/real pair-annihilation is an explicit matter/antimatter conservation mechanic + spentbook for DBCs; total-€$ conservation across issuance/annihilation not auditable (server-held). |
| 27 | Recovery mechanism? | **PARTIAL** encrypted vault mirror on Autonomi scratchpads (device key), WebAuthn/PRF + SQRL + passkey ceremonies, `/api/transfer/reclaim`, escrow reclaim; account recovery via operator UNKNOWN. |
| 28 | Settlement/finality model? | **INFERENCE** operator-final: server row mutation = final for €$; `/api/transactions/:id/finality` endpoint exists (per-tx finality status); no external settlement except the ANT merkle-day purchase tx. |

Tally: **FACT-answered 16** (1,2,4,5,6,9,10,11,16,17,18,19,20,21,22,23),
**partial 9** (3,7,12,14,15,24,26,27,28), **UNKNOWN-leaning 3** (8 is
INFERENCE, 13 INFERENCE, 25 INFERENCE — evidence-based but not code-proven
end-to-end). None require guessing: every UNKNOWN names its missing artifact.

---

## 4 · eddde claims vs implementation evidence (graduation)

| Claim | Status | Evidence |
|---|---|---|
| 1,000 farm-days → 1,000 Eddies | **GRADUATED (in shape)** | Farm UI law: 1 Eddie (€$100) per credited UTC farm-day; server accounting unauditable. |
| "SAFE Network native" | **CONTRADICTED for the token leg** / reframed | Official ANT is an Arbitrum One ERC-20 (dispatcher + docs + Arbiscan); Autonomi leg = storage (scratchpads). Eddies itself is server-ledger. |
| "Uploaded to Autonomi" | **GRADUATED (in shape)** | Encrypted vaults + public registries on named scratchpads via dweb gateway; site content pinned by shard address. Ledger authority remains server-side. |
| Pay-link mechanism exists | **GRADUATED** | `/payment/:requestId` route + `/api/payment-requests/:id` object (live receipt). |
| Obligation persists until recipient adopts | **GRADUATED (in shape)** | pending receivables + expiresAt + receivable-transfers; exact server expiry behavior UNKNOWN. |
| "42 funds" ↔ app balance | **PARTIALLY RESOLVED** | 42 = special window class (€500/hundred on MONEY; non-listable); account-level mapping still UNKNOWN. |
| "antenglement" (spend ANT you keep, run a node) | **GRADUATED as naming, reinterpreted** | It is the tag for the node-liveness + ANT-coupling feature family; ANT moves only when buying merkle-days; nothing is "spent while kept" on-chain — the kept-thing is the node bond, not ANT. |

---

## 5 · Comparison: Silent Pay v2 / FeePlan / b-meter / payment-delivery machines

- **Silent Pay v2 (funding authority → metering → receipt → settlement):**
  Eddies has all four stations but **concentrates them in one operator**: the
  "funding authority" is the genesis/foam issuer (server), metering is UTC-day
  liveness of an external network's node (a novel meter input — Autonomi
  reachability as proof-of-service), receipts are server rows + bearer notes
  (not client-verifiable), settlement is a row mutation. Silent Pay's
  separable-verifier property is absent.
- **FeePlan:** the MONEY ladder (€$100 → €200/€500 windows) is a fixed tariff
  table like a fee plan, but denominated in the operator's own unit against
  EUR — no funding source behind it is visible.
- **b-meter receipts:** Eddies' closest analogue is the **farm-day**: an
  uptime-metered accrual with a daily tick and a commodity transfer market —
  structurally similar to metered prepay credit, but the meter reads another
  network's node liveness and the unit is annihilable (negative balance
  semantics b-meter never has).
- **Payment/delivery state machines:** the invoice lifecycle
  (pending → accepted/expired; escrow accept-and-pay, pause, punish, vote,
  terminate; inflight lock→hop→settle; `/finality` endpoint) is a genuine
  two-route machine and maps naturally onto the estate's Payment/Delivery
  independence law — but its states are operator-held, not journaled.
- **Reusable ideas (candidates, not verdicts):** window-denominated value
  (0h/1h/24h acceptance classes = time-value baked into the unit), aged-money
  interest (repayment must carry the loan's age), pair-annihilation as an
  explicit destruction invariant, mesh-gateway content pinning
  (`/api/log/chain` shard pin), PQ-signed API request headers
  (`auth2_*`), encrypted-vault-on-scratchpad user persistence.

---

## 6 · Verdict (vocabulary: ADOPT/ADAPT/WRAP/WATCH/BUILD)

**WATCH** (upgraded from WATCH/INVESTIGATE; evidence bar met for
classification, not for adoption). Eddies is a live, inventive, **operator-
centered hybrid application** (official ANT on Arbitrum + Autonomi scratchpad
persistence + clearnet server-authoritative ledger), not a decentralized
monetary rail; no component clears the estate's verifier-separability bar
today. ADOPT/ADAPT/WRAP are all rejected at this evidence state; BUILD is
not applicable (no primitive here we lack that this supplies better). The
founder's reconciliation gate continues to govern any reuse of the ideas in
§5. Risks on record: single operator authority, unauditable issuance/
annihilation accounting, invoice objects with no client-verifiable proof,
default treasury constant dead on-chain, domain registered 2025-10-22 with
registration expiring 2026-10-22 (36 days after this dispatch).

---

## 7 · Open items

1. Server-side code (gateway, issuer, annihilator accounting) — would settle
   Q12/Q13/Q14/Q26 definitively; not public (no GitHub org/repo found; web
   index only now lists the two frontends).
2. The "How Eddies Work" artifact contents — still never seen; now largely
   superseded by implementation evidence, but remains the named wake artifact.
3. eddde affiliation with WithAutonomi — still UNKNOWN.
4. Real-euro settlement leg of MONEY loans / cash-swap book — outside all
   visible code; needs founder paste of a cash-out story if it matters.
5. Whether shareToken ever gates anything (currently unused by public links).

## Landing receipt

- Dispatch: this file. Queue item #1 status refreshed same commit.
- Worktree `C:\Users\travi\wt-zcode-eddies`, branch
  `zcode/eddies-workerb-wake-2026-09-16`, cut from `origin/main` (`bf0f2a72`).
  SHA recorded in the commit; fast-forward-only push to main per law.
- Dispatcher receipts shared at `/tmp/eddies-recon/` (root + dweb HTML, 53
  assets, invoice JSON, RDAP/TLS/RPC outputs) — not committed (evidence
  excerpts quoted inline above carry the load).
