# SPEC-PEER-FUNNEL-1 — the first mile: a customer's fiat becomes USDC in the estate's wallet

Status: SECTION LANDED 2026-09-05 (z3.3, Order B of the 2026-09-04 dispatch) —
this file carries §receive, the seller-side receive path against zkp2p-contracts'
live V2 escrow stack on Base (EscrowV2 + OrchestratorV3, the active dispute
stack), built from docs/raids/PEER-SORT-2026-09-02.md §1 + §5 (read at source
`2e70f3cc`; every address below is a live-deployment fact from that raid's
contract inventory, not a hope). Code judged, never the coder.

The funnel in one sentence: **the estate is a SELLER, not an operator** — its
Base address is a bare `to` on someone else's escrow, it signs nothing, it
runs nothing, and a customer's Venmo payment settles as USDC on Base straight
into the estate wallet.

## §receive — the seller-side receive path

### The roles (A69, mapped at source)

| role | who | does |
|---|---|---|
| depositor / maker (LP) | a third party with USDC in `EscrowV2` and a Venmo handle | receives the customer's fiat; its escrowed USDC is released |
| taker / onramper | **the customer** | `signalIntent` with `to` = the estate's Base address, then pays the LP fiat |
| recipient | **the estate** | signs nothing; receives one USDC `Transfer` |

**LP required, estate never the LP — law.** If the estate played depositor it
would receive fiat and its own USDC would come home to itself — a fiat
receipt, not new USDC (A69). The first mile structurally depends on a
third-party LP with a fiat handle; that residue is recorded, not hidden.

### The receive address (bare `to`)

`0x89881F83A8C9CE06E34cbDD50A612909a784d7C6` — the estate soul's existing
Base address (holds kingbeelovis.base.eth and bclaude.base.eth,
ownerOf-verified 2026-08-29), the same address the b-meter names as
`base_receive_address` in keys.json.meta. It is a RECIPIENT only: no
allowance is ever granted from it for the funnel, no intent is ever signed
by it, and the estate's only funnel event is the incoming USDC `Transfer`.

### The ONE seller-side event (what the wallet's receive call reads)

An incoming USDC `Transfer` (token `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
to the estate address with `from` = `OrchestratorV3 0x014025fDE093f8701d86e9f38e2C3a9b779cb5c7`
(or `from` = a post-intent hook, when one exists). That is the entire
seller-side surface — read keylessly with `eth_getLogs` from any public Base
RPC. `surfaces/wallet.html` §peer-funnel carries the call: random public
host per lookup (the founder privacy ruling 2026-08-24 — no operator
privileged), topics pinned to the Transfer signature + the orchestrator +
the estate address, rows rendered with tx / block / amount, honest-empty
state when nothing has arrived.

### The tithe, attached at signal time (no second transaction — first choice)

`referralFees[]` on the customer's intent: up to 10 recipients, ≤ 50 % total,
paid from `releaseAmount` **before** `netAmount` moves
(`lib/ReferralFeeLib.sol:15-18`, `OrchestratorV3.sol:665-671`). THE TITHE
RIDES AS ONE REFERRAL ENTRY; the estate wallet = `to`. The split happens
inside Peer's own settlement — the estate never signs, never sweeps, never
runs a relayer for it. Caveat carried from the raid: a deposit protected by
the gating service signs `hashReferralFees` (`:791`), so the LP's gating
signer must accept the split — an LP-selection fact, priced before the
intent, never discovered after.

The tithe referral recipient address is founder word (the 10 % law is
founder law); the wallet shows the SHAPE with the recipient unfilled rather
than inventing an address.

### exact-multi after settlement (the fallback split)

When an intent settles with no referral attached, the split still happens —
as the estate's own receipt-side instruction: ONE payment paying seller +
tithe together, the qisma exact-multi invariants as schema law
(sum(outputs) == amount, payTo ∈ outputs, feePayer ∉ outputs), the same
shape z3.1 landed in bsigner for the Vaulta rail. On Base the atomic form is
a contract: the post-intent hook door (`IPostIntentHookV2.execute`, the
orchestrator approving exactly `netAmount`, `:724-725`) — recorded with its
live-stack limit: V3 whitelists **no** hook (`:529-533`), so the hook is the
deploy-and-register path, not a today fact. Until then the fallback is the
estate-internal sweep (compose-never-sign at the wallet, founder word moves
it). Nothing in this section requires it to be live for the receive path to
work: the receive path is complete the moment the Transfer lands.

### What the estate does NOT operate (the sort's SERVER class, stated once)

No attestation service, no witness key, no indexer, no checkout, no relayer,
no plugin API keys. Settlement finality is one vendor signature until the
estate's own witness set exists (A70) — a boarding fact, priced as such.
Every funnel exit is on-chain RULE: the LP's `releaseFundsToPayer`
(`:288-318`) human exit, cancel/expiry back to the LP, unlocked withdrawals.

## §order-of-work

1. ✅ §receive — this section + the wallet's receive call (keyless
   `eth_getLogs`, honest-empty) — landed with this spec.
2. Tithe referral address by founder word → the intent card fills.
3. exact-multi sweep on Base (compose-never-sign first; hook contract when
   the estate deploys and the registry door exists).
