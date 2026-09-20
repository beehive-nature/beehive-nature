# Silent Pay v2 — Vaulta settlement adapter and x402 scheme

**Draft 0.2 · 8 September 2026 · bMESHasi / b-meter / bHEartWALLet / bzDiD / bSAFE**

Status: proposed normative protocol, an executable off-chain economic reference
model, native Antelope C++ contract core, and experimental BLS equation source.
Not a deployed payment system. No user repository was modified. No live funds,
hardware, bridge, FHE engine, or ZK circuit were exercised. See `../README.md` for
exact implementation boundaries and test results.

“MUST”, “MUST NOT”, and “SHOULD” describe requirements of a conforming future
implementation; they do not claim the delivered reference model satisfies every
production requirement.

## 1. Governing decisions

Preserve the logical gas tank as private budget state, not a mandatory global
agent wallet address. A UI approval authorizes a bounded intent; independent
payment adapters execute funded legs. Each note/reservation has exactly one
home settlement domain. No receipt, bridge label, or UI abstraction makes funds
spendable on two chains.

Storage, compute, evidence, authority, and settlement are separate interfaces.
Vaulta is the first settlement adapter, not the definition of x402 or the global
owner of all storage and computation. bzDiD/bSAFE establish scoped authority.
bRESPECT supplies optional, purpose-scoped evidence to the authority policy.
b-meter does not require raw sensor records or a global identity.

Minimize unavoidable recurring costs while preserving privacy, recovery,
correct accounting and exit. Zero user-facing marginal price, a one-time storage
charge, sponsored capacity, and zero physical operating cost are different facts.
The router MUST record who bears a cost and what happens when sponsorship ends.

## 2. One UI approval, multiple independently funded legs

A private `IntentPlan` contains a wallet-local random intent ID, signed policy
version, a Merkle root (or equivalent reviewed commitment) of leg policies,
asset-specific budget ceilings, permitted conversions, approval/claim deadlines,
mandatory-versus-optional legs, privacy minima, and failure behavior.

Each leg contains its own unrelated external session ID, network, full chain
identity, execution mode, exact asset identity, recipient, provider quote,
maximum debit INCLUDING fees, output acceptance conditions, funded reserve,
and finality/recovery policy. The global intent ID MUST NOT be published to each
provider or chain: it would become a cross-chain tracking identifier.

The UI MAY show an indicative reporting-currency total. The authorization MUST
retain a vector of native-asset maxima. Adding 3 AR, 2 ANT and 1 A into “6 tokens”
is not accounting. Any conversion MUST bind source and destination assets,
max-input/min-output, permitted counterparty/venue, fee cap and quote expiry.
No oracle source or exchange rate is implicitly trusted.

Default flow:

1. Discover providers and construct the approved private plan.
2. Reserve funds for every mandatory leg in its own home domain.
3. Begin irreversible work only after required reserve assurances are satisfied.
4. Meter and accept each job under its own quote.
5. Settle independent legs; aggregate where compatible.
6. Present one private receipt containing individual leg outcomes.

Reserve failure before work starts triggers cancellation/refund of other unused
reservations. Already delivered work and irreversible public storage writes are
not undone by calling a workflow a “transaction.” After partial completion,
preserve earned claims and refund only unused funds. Unknown transaction status
is not failure and MUST NOT trigger a new payment under a fresh identifier.

Supported baseline guarantee: **per-domain atomic settlement; cross-domain
workflow compensation**. An `all-or-nothing` financial guarantee spanning chains
is rejected unless a separately qualified atomic protocol or explicitly accepted
counterparty guarantee exists. One hardware confirmation can authorize several
native signatures; it is not necessarily one cryptographic signature.

UI state per leg: quoted, reserved, accepted, submitted, unknown, finalized,
refunded, or failed. Overall “settled” requires all mandatory financial legs to
be finalized. Accepted-for-batching and submitted are never called finalized.

## 3. Domain and asset identity

x402 v2 distinguishes `scheme` (semantics) and `network` (implementation). [S1]
The draft Antelope CAIP-2 namespace uses `antelope:` plus the first 32 hexadecimal
characters of the full 64-character chain ID. The FULL chain ID remains necessary
for signing and security bindings. [S2]

For native Vaulta, derive:

```
domain = H("SILENTPAY-V2", full_chain_id, native_contract,
           token_contract, token_symbol_with_precision, protocol_version)
```

The shorter CAIP identifier is discovery metadata, never the sole security
binding. Native Antelope and Vaulta EVM are different execution domains and MUST
not share unqualified adapters. Deployment must verify full chain ID, contract
code/ABI, token contract, symbol/precision, active protocol features, finality
policy, permissions, and proof-suite digests against a signed allowlist manifest.
A single untrusted RPC answer is not sufficient bootstrap trust.

All example chain IDs consisting of zeros are TEST FIXTURES, not deployed
networks. `test.token:4,TST` is a draft adapter asset string. Production A metadata
must be independently resolved; a token ticker alone is not an asset identifier.

## 4. x402 wire profile

Proposed scheme name: `silentpay-v2`.
Profile: `shielded-reserved-v1`.
Network family: `antelope:<32-character-prefix>` for native Vaulta/Antelope.
Status: experimental custom scheme, not an upstream x402 registration or a claim
of support by existing facilitators.

Current x402 documents `upto` for capped single-request charging and
`batch-settlement` for repeated off-chain vouchers and later redemption. [S3,S4]
Silent Pay patterns their semantics but adds reserved private funding, explicit
meter acceptance and a shielded transition circuit. It MUST be registered in
client, resource-server and facilitator implementations. A client MUST NOT
silently substitute transparent `exact`/`upto` when the requested privacy profile
is unavailable.

A `402` response uses x402Version 2, `resource`, and `accepts`. The selected
requirement contains `scheme`, `network`, `amount` as canonical decimal atomic
units, `asset`, `payTo`, `maxTimeoutSeconds`, and `extra`. `payTo` identifies the
settlement pool; a one-time provider output commitment in `extra` identifies the
actual entitled payee inside that pool. The provider quote authenticates both.

Required `extra`: fullChainId, adapterVersion, profile, quoteHash, tariffHash,
payeeCommitment, feePolicyHash, authorityPolicyHash, evidencePolicyHash,
proofSuiteId, poolCodeHash, validUntil, claimUntil. Include the exact resource
origin, method, request-body commitment, program/model version, expiry and
operation scope in the private signed quote. A fetch to another origin cannot
reuse it. Redirects require policy re-evaluation, not automatic payment.

The request retry includes base64 JSON in `PAYMENT-SIGNATURE`. It carries the
selected requirement, one-time session reference, authorization proof/reference,
funded-reservation inclusion proof/reference, and domain binding. Implementations
MUST reject duplicate JSON keys, malformed integers, unknown critical fields,
wrong recipient/domain, expired quotes and unsupported proof suites. [S5]

The scheme baseline presumes a previously finalized reservation. `/verify`
checks proof validity, funding-state membership, merchant binding, deadline,
and evidence/privacy profile. **/verify is not a reserve operation and a balance
proof is not a reservation.** Reserve acquisition is performed by the Silent Pay
adapter before authorization is accepted for service.

Facilitator operations:

* `/supported`: advertise exact scheme/network/profile and concrete proof suite.
* `/verify`: non-mutating verification of a reserved authorization.
* `/settle`: submit an accepted obligation and return actual final settlement
  when available under the negotiated synchronous flow.

Experimental async batching endpoint `/silentpay/v2/claims` returns HTTP 202 with
an opaque, access-controlled claim handle and `accepted-for-batching`. The server
may deliver an accepted result with this application-level status. This is NOT
an upstream standard final settlement response. A custom client polls or
subscribes to the private handle; only after finality may the standard
`PAYMENT-RESPONSE` claim `success: true` and include the actual chain transaction.
No made-up transaction hash, payer identity, or success status is permitted.

Proofs too large for the negotiated header limit travel in a separately
negotiated authenticated request body or private, capability-gated object fetch.
Bind the byte digest, MIME type, length, expiry and origin. Public proof-object
URLs can correlate users and MUST NOT be the default.

Idempotency is scoped to merchant, selected quote, domain, reservation and
receipt/sequence. The coordinator stores pending intents and outbox messages in
crash-safe state. A timeout is reconciled against authoritative chain state.
Retry uses the same obligation; changing the idempotency key does not create new
spending authority.

## 5. Data structures and privacy

### Capability (private)

version; authority-policy proof; funding-note/reservation reference; domain;
asset; quoteHash; merchant commitment; aggregate ceiling; fee ceiling/recipient;
allowed program/resource class; permitted evidence; validity/claim deadlines;
nonce; delegation constraints; purpose-scoped bRESPECT/bzDiD presentation if
required. It MUST prove control of the note's authorized secret or credential
without publishing the root human key.

A parent capability can allocate a budget to child capabilities only through an
exclusive reservation/state update. Each child does not inherit the full
unspent parent budget. The reference model uses separately funded child notes;
it does not implement a full recursive delegation circuit.

### FundedNote and Reservation (private state)

A note commits domain, exact asset, value, authorization key commitment, secret
serial and fresh randomness. A reservation consumes funded authority and locks
value for one provider/quote/claim window. Change is a new note. A provider must
have a bounded unilateral claim path; a customer refund cannot defeat a valid
claim during its agreed redemption window.

### MeterReceipt (private)

version; reservation/session; quoteHash; domain; exact asset; program/model
digest; input/work/result/meter commitments; resource vector; tariffHash; unit
and rounding rules; evidence class and digest; cumulative accepted charge;
cumulative fee; sequence; previous receipt commitment; terminal flag; recipient;
acceptance or adjudication evidence; output-delivery conditions.

Quantities and prices use exact integer/rational arithmetic with explicit
rounding. Fees are quoted. Per-receipt and cumulative overflow checks are
mandatory. Fees count AGAINST the funded ceiling, not in addition to it.

```
charge_delta = sum(round_as_quoted(quantity_i * price_num_i / price_den_i))
cumulative_charge = previous_cumulative_charge + charge_delta
0 <= cumulative_fee <= permitted_fee_ceiling
cumulative_charge + cumulative_fee <= funded_ceiling
```

Resource definitions specify measurement boundaries and rounding granularity.
Splitting one bill into many independently rounded bills must not change the
agreed charging rule. Deterministic instruction counts, tokenizer counts,
physical runtime, bandwidth and storage duration are different resources.

Evidence types are not interchangeable: provider assertion, client acceptance,
qualified attestation and cryptographic computation evidence. A payment-proof
suite does not automatically establish execution correctness. FHE protects
specified inputs during supported computations; a separate proof must verify
the required evaluation/meter statement. Neither proves arbitrary answer utility.

### Nullifiers and outputs

Use suite-defined PRFs with separate domain labels for spend, reservation close,
entitlement, event presentation and withdrawal. A production nullifier derives
from a private secret and correct scope, not a public identity/session hash.
The Python reference hashes visible IDs ONLY as an inspectable state-machine
simulation; that construction is not the private protocol.

No standalone public `nullify` action exists. Non-membership verification,
nullifier insertion, balance update, provider credit, change/refund creation and
state-root update are one atomic state transition. A failed proof/transfer must
leave neither burned authority nor a partial payout.

### BatchStatement (public)

version; domain; sequence; operation; old/new state roots; funding inbox root and
count; receipt commitment root; availability commitment; expiry; optionally
aggregated public withdrawals; exact approved proof suite metadata.

Per-job private receipts, body/request contents, biometrics, stable user/agent
keys, private DataMaps/CIDs, and the wallet-global intent ID are excluded.
A randomized commitment is required for low-entropy private content; a plain
unsalted hash is not a hiding commitment.

The authenticated private state contains notes, reservations, accepted
obligations, nullifiers, inbox-consumption position and revocation state.
Reference contract compares the old root and sequence before accepting a new
root. It does not store one public row per metered request. Roots compress chain
state; they do not eliminate witnesses, data availability, or proof-generation
costs.

## 6. Lifecycle and contract actions

```
QUOTE -> AUTHORIZE -> RESERVE [funding becomes exclusive]
      -> EXECUTE / METER -> VERIFY EVIDENCE -> ACCEPT OR DISPUTE
      -> PROVE VALID STATE TRANSITION [including nullifier updates]
      -> AGGREGATE -> VERIFY + COMMIT ON VAULTA -> FINALITY
```

Logical authorize/meter records remain private. The default is NOT five separate
public blockchain actions for every computation.

| Interface/action | Location | Role |
|---|---|---|
| authorize | wallet/hardware policy | Issue bounded, scoped authority |
| reserve / `commitres` | domain state + Vaulta anchor | Exclusively lock funded notes, preferably in batches |
| meter / accept | b-meter and accepting client/policy | Validate tariff/evidence and sign the accepted cumulative receipt |
| nullify | circuit + atomic transition only | Reject reused authority while creating correct outputs |
| aggregate | prover/aggregator | Prove a valid sequence; a Merkle root alone is not a proof |
| `settlebatch` | Vaulta contract | Verify approved suite; update state, including shielded provider credits |
| `withdraw` | Vaulta contract | Consume private credit and perform expressly approved public payout |
| `reclaim` | Vaulta contract | Release unused reservation after applicable conditions |
| `forceclaim` | permissionless domain entry | Let entitled provider submit a valid claim without a favored aggregator |
| pause new authority | contract governance | Stop new exposure; preserve qualified claims/exits as specified |

A provider may remain inside the pool rather than withdrawing for every request.
When a native transfer occurs, its recipient and amount are public. Pool funding,
withdrawals, timing and relayer network metadata remain correlation surfaces.
“Silent” means the selected guarantees are enforced, not that all traces vanish.

Reservation conservation on closure:

```
reserved_value = provider_credit + authorized_fee_credit + user_refund
```

Partial settlement adds `remaining_reserved_value` to the right side. No
obligation can be counted twice in an aggregate. Assets never net against each
other without a separately verified conversion operation.

Registered accepted obligations survive revocation and timeout. Off-chain
receipts not yet recorded in the authoritative domain require an explicit
redemption window, monitoring and a working unilateral claim path. The reference
model's timeout honors receipts already registered in its in-memory state; it
does not prove fairness for undisclosed receipts or unavailable private state.

## 7. Proof router and Vaulta acceleration

Route by exact approved suite, not just an algorithm name:

```
GROTH16_BLS381 / circuit / VK / input schema / host version
HALO2 / curve / commitment backend / transcript / circuit / VK
STARK / field / hash / FRI & security parameters / program
PQ_RESERVED / not a deployed claim
```

Antelope CDT exposes native BLS12-381 group and pairing functions. [S6] Those
functions are a candidate accelerator for a compatible verifier, not automatic
proof-system or FHE support. The delivered equation prototype computes the
Groth16 pairing relation with actual native API names but is NOT a validated
verifier. Point conversion, subgroup membership, identity-point policy,
canonical encodings, circuit/VK binding and malformed-proof tests are required.

The C++ statement digest is SHA256 of the exact ABI-packed statement. Its two
128-bit little-endian limbs are the prototype circuit public inputs; the circuit
must constrain the complete packed-statement preimage and every transition.
The Python model's sorted-JSON digest is a DIFFERENT diagnostic codec; it is not
wire-compatible with EOSIO ABI and must not be used as its test vector.

Groth16 setup artifacts and any circuit-specific ceremony need published
provenance. A Groth16 outer wrapper around a different inner proof retains the
outer wrapper's assumptions: it does not become post-quantum by naming a STARK
inside it. Cryptographic upgrades require actual funded-state migration,
re-enrollment/rekeying where appropriate, and compatible exits.

The documented Vaulta finality figure is approximately one second with
half-second blocks. [S7] The claimed 90 ms -> 40 ms improvement remains unverified.
End-to-end latency includes routing, reserve finality, proving, batching,
submission, verification, state access and finality; it cannot be substituted
with a pairing microbenchmark.

## 8. Data availability, exits, and scale

A commitment to available data is not proof that data is recoverable. Users need
private note/reservation witnesses, relevant tree updates, receipts, key recovery
and a provider-independent exit procedure. Strong storage encryption does not
make lost witness data reconstructible from a root.

Before any real deposit, qualify private update distribution, independently
replicated state, authenticated downloads, output-note discovery without public
user identifiers, force inclusion, withdrawal under sequencer failure, and
recovery of unimported deposits. Add escape modes without turning privacy into
an undocumented emergency sacrifice.

The source's current funding-root equality is a small-scale serialization
baseline: another deposit invalidates a prepared batch proof. Production should
use audited epoch-sealed inbox snapshots or equivalent bounded commitment
windows and deterministic witness rebasing. No throughput achievement is claimed.

For N independent execution domains with T_i throughput, useful capacity is
approximately sum(T_i), less coordination and shared-resource bottlenecks.
A 21-producer consensus set is replicated agreement, not 21 independent shards.
N(N-1)/2 possible pairwise links are quadratic connectivity, not quadratic
throughput. EOSIO's original parallel/horizontal architecture is historical
context; Vaulta explicitly says previous whitepapers no longer define its current
protocol. [S7,S8]

Keep independent local domains and aggregate only necessary settlement evidence.
One global root can become a serialization bottleneck; the protocol must permit
separately funded pools/domains with explicit migration, without accidentally
allowing the same note in several of them.

## 9. Arweave and operational-cost policy

Arweave/ArDrive is useful for deliberate public protocol memory, specifications,
public agent releases, tariffs and carefully reviewed aggregate checkpoints.
Private bSAFE authority, biometric records and cross-user capability graphs are
not published merely because the upload has zero quoted price.

Current Turbo docs describe uploads up to 105 KiB with a 10 MiB lifetime allowance
tracked per wallet and subnet; both limits apply. `getFreeStatus()` reports
remaining allowance. Some SDK/marketing material still says 100 KiB/100 KB.
These are service/version-specific conditions, not a costless Arweave protocol
primitive. [S9,S10] No quota-circumvention or endless free-small-file assumption
is part of this design.

Router behavior: query current allowance/quote; prefer approved free upload;
otherwise use an approved one-time paid route within budget, an independently
funded alternative, local retention, or queue. A price change never expands the
human's authorization. Free-tier suspension is an ordinary failover test.

Turbo documents an existing x402 upload path using USDC on Base. [S11] Autonomi documents ANT payments on Arbitrum and an ETH gas requirement for
those token transfers. [S14] Thus storage network and payment network are not
necessarily the same. Native AR
uploads/funding and Base-USDC x402 uploads are separate adapters; neither is
native Vaulta acceptance. A one-UI plan can coordinate them without pretending
AR, ANT and A are interchangeable or automatically bridged.

Budget ledger: user cash outlay, hive cash outlay, sponsored quota/capacity,
resource usage, required capital, future commitments and separately realized
operator revenue. AR mining, ARIO gateway activity, Autonomi ANT nodes and
Vaulta block production have different rules and economics. In particular an
ar.io gateway is not automatically an AR mining node. Autonomi documents potential
node earnings from reliable storage/serving. [S12,S13]

The agent may monitor operations, maintain bounded working capital and recommend
sweeps under human-set policy. Hardware, power, bandwidth, stake/opportunity cost,
repairs and unsold token price risk remain real. Expected future rewards are NOT
spendable funds and are not collateral by default.

## 10. bSAFE, bzDiD and bRESPECT integration

This draft does not redefine bSAFE tokenomics or replace the prior Fable work.
It consumes a versioned `AuthorityPolicyProof` from the supplied boundary:

```
sensors (no wallet root key) -> local quality/freshness/policy checks
   -> hardware-held signing authority -> bounded capability
```

The authority proof binds approved firmware/policy, fresh session challenge,
resource origin, exact quote, permitted domain/asset/cap and expiry. Compromised
sensor evidence cannot silently raise a budget. bRESPECT presentations are scoped
to the required purpose/epoch, with an issuer/event-policy digest and revocation
handling, rather than a public social graph in each payment.

Spend nullifiers and personhood/entitlement nullifiers MUST use distinct scopes.
Selling or transferring an economic token must not independently mint additional
one-person eligibility. This is an interface separation, not a claim about a
specific existing bSAFE token contract.

Security assertions refer to an approved, measured threat profile and recovery
procedure. There is no unconditional “Sybil/MiM immunity” flag in the payment
wire format. Local multi-sensor work remains valuable without publishing the
biological source or making every microcharge a new biometric ceremony.

## 11. Delivery and qualification

Included: full spec; C++ contract core and types; fail-closed proof router;
isolated native BLS equation prototype; Python signatures/accounting simulator;
x402 header validation and examples; one-approval multileg budget checks;
59 passing unit tests including 1,000 seeded accounting scenarios.

Not included/verified: actual private-note circuit, approved VK/ceremony,
compiled WASM/ABI, deployed testnet, real x402 SDK plugin/server/facilitator,
private state-availability/escape path, FHE integration, bSAFE hardware,
authentication/deduplication research results, bridge or atomic cross-chain
payment implementation, economic profitability or security audit.

The contract refuses deposits and proofs while these value-path gates are absent.
The Python model is plaintext and in-memory; its signatures and accounting tests
must not be represented as privacy, persistence or distributed-consensus tests.

Qualification order: freeze wire/ABI statements and golden vectors; compile on
pinned CDT; implement and independently review circuit plus recovery/force-claim;
exercise value-free local/testnet deployments; validate x402 custom plugins;
run adversarial privacy/availability/cost benchmarks; then consider real funds.

## Sources (checked 8 September 2026)

S1 https://docs.x402.org/schemes/overview
S2 https://namespaces.chainagnostic.org/antelope/caip2
S3 https://docs.x402.org/schemes/upto
S4 https://docs.x402.org/schemes/batch-settlement
S5 https://docs.x402.org/guides/migration-v1-to-v2
S6 https://github.com/AntelopeIO/cdt/blob/v4.1.1/libraries/eosiolib/core/eosio/crypto_bls_ext.hpp
S7 https://www.vaulta.com/protocol
S8 https://github.com/EOSIO/Documentation/blob/master/TechnicalWhitePaper.md
S9 https://docs.ar.io/build/upload/turbo-credits
S10 https://github.com/ardriveapp/turbo-sdk
S11 https://docs.ar.io/build/upload/x402-uploading-to-turbo/
S12 https://docs.autonomi.com/node
S13 https://docs.ar.io/build/run-a-gateway/
S14 https://docs.autonomi.com/token

External documents establish protocol/service facts, not implementation or
security of this proposal. Prior project input: RAID-vNext-architecture.md,
8 September 2026, provided in this conversation.
