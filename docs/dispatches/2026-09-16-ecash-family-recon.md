# OPEN-SOURCE E-CASH FAMILY RECON — DBC ideas mapped to open implementations, compared against bPay · 2026-09-16

**Order (founder, verbatim):** *"Roll this workerb into the open-source e-cash
family instead: identify existing open implementations of the useful DBC
ideas—offline bearer notes, acceptance windows, signed transfer receipts,
double-spend detection—then compare them against bPay's bounded-authority/
private-receipt architecture. Reuse before invention; no Eddies dependency."*
**Seat:** zCode (the Eddies workerb, rolled forward). **Mode:** research only —
source pages fetched live, every claim permalinked or marked; zero code, zero
integration; verdicts remain the reuse seat's, post reconciliation gate.
**Context:** follows the Eddies double closure (`2026-09-16-eddies-dbc-
rollforward.md`), whose one carried artifact was the design-pattern note now
being sourced in the open. **Baseline** `origin/main` = `c84a168e`, worktree
`../wt-zcode-eddies`, branch `zcode/ecash-family-recon-2026-09-16`.

## 0 · One-screen read

| candidate | what it is (verified) | license | double-spend model | research class |
|---|---|---|---|---|
| **Cashu** (protocol + [nuts](https://github.com/cashubtc/nuts); [nutshell](https://github.com/cashubtc/nutshell) impl) | Chaumian ecash for Bitcoin/LN; "Blind Diffie-Hellman Key Exchange" blinding (Wagner variant); bearer tokens as transferable strings; NUT-12 **DLEQ proofs** for offline verification | MIT | redemption-time mint check (melt/swap), per protocol family; page didn't spell it out — marked | **ADAPT-study** (reuse-first via CDK) |
| **CDK** ([cashubtc/cdk](https://github.com/cashubtc/cdk)) | "collection of rust crates for Cashu wallets and mints" — libraries + `cdk-cli` + `cdk-mintd`; ALPHA but real-sats; NUT-00–06 + 07–17, 18–23, 25–30 incl. **NUT-24 HTTP 402**, **NUT-27 Nostr backup**, NUT-30 on-chain; `cdk-ffi` bindings | **Apache-2.0 OR MIT** | as Cashu | **the reuse-first candidate** |
| **Fedimint** ([fedimint](https://github.com/fedimint/fedimint)) | "Federated E-Cash Mint", module system (Bitcoin/Lightning/Chaumian ecash + custom modules), threshold blind signatures, dealer-free DKG; 13.5k commits, active | MIT | federated consensus among guardians | **WATCH** (ops weight) |
| **GNU Taler** ([taler.net](https://taler.net/en/), [docs](https://docs.taler.net/)) | GNU-project exchange-based anonymous taxable payments; "none of the participants can defraud the others without being detected immediately"; Exchange "audited regularly like any other banking institution" | Free Software (GNU; exact license not on fetched pages) | exchange database + auditor | **WATCH** (headline-verified only; API/DD docs unread) |
| **sn_dbc** ([maidsafe/sn_dbc](https://github.com/maidsafe/sn_dbc), [crates.io](https://crates.io/crates/sn_dbc)) | "private and fungible digital currency that utilize a **distributed (and sharded) spentbook** of spends rather than a blockchain"; one-time keys/stealth addresses; **BLS** (blsttc); "transactions are settled immmediately"; 482 commits, SAFE-era, dormant since Autonomi went token-on-Arbitrum | **BSD/MIT dual** | distributed sharded spentbook (network-native) | **WATCH** (Autonomi-adjacent lineage — almost certainly the vocabulary ancestor of Eddies' DBC naming) |
| dan-gould DBC line | the blind-sig DBC design with Mint+spentbook (vocabulary kin of Eddies) | — | — | **dead pointer** (repo 404; author now leads Payjoin Dev Kit — verified) |

## 1 · The four DBC ideas, sourced in the open

1. **Offline bearer notes** — fully solved open: Cashu tokens are literal
   strings you "send to another user such as via email or a messenger"
   (nutshell README), with **NUT-12 DLEQ proofs** letting the RECIPIENT
   verify a token's blind signature offline before ever contacting the mint;
   Fedimint notes are bearer objects under federation issuance; sn_dbc DBCs
   are bearer certificates whose reissue settles against the spentbook.
2. **Acceptance windows** — the honest finding: **no open spec analog**. The
   Cashu NUT index (00–30, verified this session) has keysets-and-FEES
   (NUT-02) but no keyset-validity/expiry or spendability-window spec; Taler
   carries contract-term deadline vocabulary (refund/wire/pay deadlines,
   "DD 26: Refunds and Fees" named in its docs index — semantics NOT read
   this session); Lightning invoice expiry is already ours. The 0h/1h/24h
   acceptance-window economic wrapper appears to be Eddies-original, and its
   open-est kin is our own invoice/expiry + escrow-window laws.
3. **Signed transfer receipts** — in a bearer-note world nobody needs them:
   the note IS the transfer. The receipt-as-a-separate-signed-object slot is
   OURS (SpendReceipt chaining); sn_dbc's reissue transactions are the
   nearest open relative.
4. **Double-spend detection** — four open answers, one per trust topology:
   redemption-time mint check (Cashu melt/swap), federated consensus
   (Fedimint), exchange-database + independent auditor (Taler), and the
   distributed sharded spentbook (sn_dbc — "not necessary to trust in a
   single entity", scales by sharding). **Eddies' bloom-gossip offline
   probabilistic spentbook has no open implementation found** — and the
   structural reason is now clear: offline DETECTION without any registry is
   only probabilistic; every open family pays for soundness with an
   online/federated/anchored checkpoint. That is the exact trade our
   adapter-ring/x402/Jungle4 rails already make.

## 2 · Comparison against bPay's boundaries (§12 of the reconciliation)

- **Private receipt (#2):** e-cash and bPay receipts are different objects,
  not competitors — privacy lives IN the bearer note (blind signatures),
  while our SpendReceipt is a non-bearer, hash-chained, private-by-default
  record. An e-cash layer would OCCUPY a slot bPay deliberately leaves open
  (offline bearer transfer between metered sessions), never replace the
  receipt.
- **Bounded authority (#4):** bearer notes are UNbounded by nature (whoever
  holds, spends). The open families' nearest kin to capAssert is **NUT-10
  "Spending conditions" + NUT-11 P2PK + NUT-14 HTLCs** — spending
  constraints attached to the token itself. Mapping NUT-10 semantics onto
  capAssert/linkauth/capability tiers is THE comparison the reuse seat must
  run before any adoption.
- **Adapter-ring (#6) / first-party-only:** mints and exchanges are
  third-party endpoints; any use is adapter-mediated (the Alby/LN and
  NWC patterns we already run). CDK's wallet+mint split matters here: a
  self-hosted cdk-mintd behind our own adapter is the only shape that can
  ever satisfy the ring.
- **x402 meter law set (#3):** striking convergence — **NUT-24 "HTTP 402
  Payment Required"** is a first-class Cashu spec, beside our own five x402
  laws and z33 panel. Cross-pollination check before we ever extend the
  meter: same problem, two vocabularies.
- **Buzz/nostr rails:** **NUT-27 "Nostr Mint Backup"** — the e-cash family
  already ships a nostr-shaped persistence pattern; our buzz rooms and NIP
  rails rhyme without dependency.
- **Conservation/issuance (the Eddies failure axis):** every open family
  answers "what backs the note" BY CONSTRUCTION — sats peg-in/peg-out
  (Cashu/Fedimint), exchange reserves + auditor (Taler), network-native
  issuance (sn_dbc). This is precisely the property Eddies lacked
  (client-side genesis self-mint + server-gated value), and the property any
  bPay adapter contract must preserve.
- **Payment/Delivery separation (#10):** Taler is the closest (contract
  terms + merchant fulfillment flow), at headline level only.

## 3 · Research-class classification (verdicts reserved, post-gate)

**REUSE-FIRST: CDK** (Apache-2.0/MIT, Rust, wallet AND mint crates,
NUT-00–30 near-full incl. 24/27/30, FFI bindings; ALPHA-labelled — maturity
risk named). **ADAPT-STUDY: Cashu protocol** (MIT; the NUT corpus is the
best-specified Chaumian profile in the open). **WATCH: Fedimint** (federation
ops weight vs our single-box estate), **GNU Taler** (construction docs
unread this session), **sn_dbc** (dormant SAFE-era design, but the only
open spentbook-on-network implementation, BLS/blsttc, Autonomi-lineage —
concept capital for any future ANT-adjacent rail). **No license obstacles
found so far — MIT/Apache/BSD-MIT across the board; zero GPL in the family.**

## 4 · Open items (reuse seat thresholds, post-gate)

1. NUT-10 spending-condition semantics vs capAssert/capability tiers (the
   load-bearing comparison).
2. NUT-24 vs our five x402 laws — crosswalk or convergence declaration.
3. Taler exchange/merchant API + DD-26 refund/deadline semantics (the
   acceptance-window kin).
4. CDK maturity pass (ALPHA caveat) + `cdk-ffi`/wasm depth for box residency.
5. sn_dbc technical writeup series (Autonomi forum links in its README) for
   the spentbook design at depth.

## Landing receipt

Queue item #4 appended (`docs/agents/PROTOCOL-REUSE-QUEUE.md`). Scratch
evidence: live fetches of all linked pages this session (2 rounds + Taler
docs index). Landed from `../wt-zcode-eddies`, branch
`zcode/ecash-family-recon-2026-09-16`, cut from `c84a168e`, §7 seat shape,
four pre-push checks, pushed branch + main. Eddies dependency: ZERO.
