# bMESHasi / b-meter — vNext RAiD

**Date:** September 8, 2026  
**Status:** Proposed engineering specification extending the ratified replaceable-interface architecture and 10B Homeostasis Test. Not a deployed implementation, audit, benchmark, or assurance that any named network will survive for a millennium.

## 1. Decision

Adopt a storage-diverse, local-first computational and agentic network. bMESHasi coordinates discovery and execution; b-meter produces evidence-backed resource receipts; Silent Pay enforces spending authority and the selected payment-privacy policy; settlement adapters move value. Arweave, Autonomi, Filecoin, IPFS, and additional decentralized storage implementations remain explicit adapter choices, not interchangeable promises.

The value proposition is **authorized useful work, intelligible prices, inspectable evidence, private participation, and portable results**. Neither a universal compute token nor guaranteed financial appreciation follows from this architecture.

The central invariant is: **preserve the human's authority and the agreed guarantees; replace implementations without silently weakening those guarantees.**

## 2. Evidence baseline and corrections

The current x402 documentation describes `upto` payments in which a buyer authorizes a ceiling and the seller supplies the actual settlement amount. It also documents EVM batch settlement using escrow and cumulative off-chain vouchers. These mechanisms do not themselves prove accurate metering or hide a payment graph. A native Vaulta integration must be implemented and advertised explicitly; EVM support is not automatic support for Vaulta's native WASM chain. [S1, S2]

Autonomi documentation describes encrypted chunks and private DataMaps, and its current data-types page explicitly describes immutable content-addressed storage. That is not a guarantee of universal erasure or anonymous traffic. The prior conversational assertion about a specific deployed Autonomi ML-KEM/ML-DSA stack was not verified and is excluded from this specification's guarantees. [S3, S4]

Arweave is designed for permanent information storage. This is useful for deliberate public memory and conflicts with unconditional deletion of sensitive data. [S5]

IPFS documents public content-routing metadata and transport encryption without default content encryption. Filecoin documents storage verification and distinct storage/retrieval markets. Sia documents client-side encryption. These are different guarantees, not a single privacy class. [S6, S7, S8]

Vaulta's protocol page describes 0.5-second blocks and approximately one-second deterministic finality. Antelope release notes document native BLS mathematical host functions. Neither establishes the unverified 90 ms to 40 ms figure as end-to-end private-payment latency. [S9, S10]

A zero-knowledge proof establishes the encoded statement without exposing its private witness; it does not establish the truth of unverified real-world inputs. FHE can support computation over ciphertext, but confidentiality and execution integrity must be specified separately. [S11, S12]

## 3. Proposed component boundaries

```text
Human authority
  bHEartWALLet: keys, budget, recovery, consent, revocation
  DNI: optional, purpose-scoped credential presentations
              |
              v
bMESHasi: discover -> negotiate -> plan -> route -> supervise
              |
    +---------+--------------------+
    |                              |
SovereignStorage               ConfidentialCompute
local / Autonomi               local / MPC / selected FHE
Filecoin / IPFS                explicitly accepted TEE
Arweave / other adapters       public-data remote compute
    |                              |
    +----------------+-------------+
                     v
b-meter: tariff + usage evidence + acceptance -> private receipt
                     v
Silent Pay: reserved authority + replay protection + privacy policy
                     v
Aggregate / verify / settle through a selected settlement domain
                     v
Vaulta adapter, with other adapters replaceable and separately tested

LOVEernment: transparent protocol governance, never a master decryption key
```

This is a logical topology, not a requirement for one global coordinator. Independent clients, providers, proof services, aggregators, and settlement domains must be able to implement compatible boundaries.

### bHEartWALLet

Keep self-custody and bounded autonomous spending. Replace a permanent agent payer identity as the universal payment mechanism with purpose-scoped capabilities and an optional shielded-payment backend. The wallet owns policy enforcement; the language model may propose actions but may not rewrite budgets, relax confidentiality, export master keys, or choose its own verifier.

A capability binds an audience, allowed operation, monetary ceiling, total delegated budget, expiry, maximum child depth, accepted evidence, storage restrictions, and settlement domain. Child allocations reserve part of the parent's remaining budget atomically. A dozen children do not each inherit the full parent's spending allowance.

Revocation stops future authority according to the protocol's cutoff rules. It must not erase a provider's already-earned, valid claim. Recovery must restore access without introducing an undisclosed custodian.

### DNI

Use credential proofs only when an application genuinely needs eligibility. Routine compute payments should not require disclosing a civil identity or biometric identity. Separate enrollment, credential issuance, key recovery, and presentation.

Use purpose-scoped presentations and domain-scoped replay protection. Do not publish raw biometrics, reusable biometric hashes, or a universal cross-service identifier. A proof of a credential does not independently prove one-human-one-identity; enrollment and anti-Sybil assumptions remain explicit.

### bDATA and ZbDATA

bDATA contains deliberately public material: protocol specifications, public agent packages, licenses, tariff definitions, reproducible-build manifests, audits, governance decisions, and carefully designed public checkpoints.

ZbDATA contains private agent memory, private inputs/results, private receipts, recovery material, and mappings from private logical objects to storage locations. Keep keys and sensitive manifests under owner control. No implicit promotion from ZbDATA to bDATA is allowed.

A content hash is not automatically a hiding commitment. Use reviewed randomized commitments for low-entropy private statements. Keep raw private CIDs, DataMaps, filenames, and object-to-person mappings out of public settlement records.

### Proof boundary

Keep Halo2 as a candidate implementation, not a protocol identity. Accept proofs only against a registry that pins the exact implementation, proof system, circuit/program digest, verification key, public-input schema, parameters, and activation/retirement policy.

A submitter cannot make an arbitrary statement acceptable merely by selecting a proof-system identifier. Unknown suites fail closed. Aggregation must preserve the security requirements of the entire proof composition, including any outer wrapper.

### Vaulta boundary

Retain Vaulta as a settlement adapter. Keep confidential workloads, per-request logs, identity records, and private storage locators out of its routine public state.

Native cryptographic acceleration is a performance candidate. Benchmark the complete verifier with encoding, validation, state access, execution limits, and failure cases on the actual target release. A host-function microbenchmark is not a production transaction benchmark.

### LOVEernment

Publish protocol rules, verifier approvals, upgrade rationale, and review results. Keep private ballots, subject identifiers, and private capability graphs out of permanent public archives. Governance must not gain a universal decryption or spending key.

Use migration windows and explicitly documented emergency powers. Distinguish disabling a vulnerable proof suite from silently freezing users' legitimate exit rights. Preserve privacy and access options through upgrades rather than assuming a version field makes migration safe.

## 4. Storage policy: capability matching, not brand selection

| Adapter | Proposed role | Required qualification |
|---|---|---|
| Local / owner-controlled | Keys, sensitive working memory, highest-sensitivity inputs | Device security, backup, recovery, and bounded deletion controls |
| Autonomi | Encrypted distributed objects with private DataMaps | Immutable-chunk and retrieval-metadata risks must be accepted; do not promise physical erasure |
| Arweave | Deliberately permanent public knowledge, public agent releases, protocol history | Explicit archival consent, publication rights, privacy review, multiple retrieval paths |
| Filecoin | Contracted persistence, replicas, archives, large artifacts | Separate storage verification, retrieval tests, renewal, repair, and lifecycle cost |
| IPFS | Content addressing, distribution, hot caches, public artifact retrieval | Pinning/persistence plan; content encryption where needed; routing-metadata threat model |
| Sia and other decentralized adapters | Additional storage choices and independent failure domains | Exact adapter capability declarations and conformance tests; no assumed equivalence |

These roles are proposals. Technical baselines are sourced in S3–S8. Adding a provider name does not approve it for every data class.

### Retention classes

**Ephemeral private:** temporary state with a defined local retention window. Prefer owner-controlled memory and storage when deletion is a hard requirement.

**Renewable private:** encrypted objects with renewal, key rotation, recoverability, and an explicit deletion/revocation model. A backend with immutable copies is unsuitable when policy requires control over all retained copies.

**Durable private:** an explicit choice to retain encrypted data despite immutable or uncontrolled-copy risks. Encryption is not a promise of secrecy for a thousand years.

**Permanent public:** deliberate publication of material that the owner intends to remain public. Arweave is a natural candidate. The default policy in this draft forbids permanent publication of private or restricted data.

This corrects the earlier abstract `RETAIN/FORGET` boundary: `forget()` must return what actually happened. Distinguish access revocation, key destruction, local deletion, provider deletion request, and a verified destruction claim. Never collapse these into an unconditional global deletion flag.

Key destruction cannot remove another party's saved plaintext, copied keys, or retained ciphertext. Re-encrypting a current object cannot upgrade the cryptography of an old immutable copy. Sanitization is threat- and effort-bounded, not a timeless guarantee. [S13]

### Adapter contract

Every adapter declares its mutability, expected retention, deletion semantics, content and metadata confidentiality, key custody, proof interfaces, retrieval behavior, repair mechanism, cost model, and export path.

The router rejects policy-incompatible adapters before optimization. A cheaper permanent backend cannot be substituted for revocable private storage. A private DataMap cannot be published to make failover easier. A failed encrypted backend cannot trigger plaintext replication.

Private logical object IDs map to adapter-specific locators inside a protected manifest. Public artifacts may use public manifests. Test recovery after loss of a provider and after loss of an ordinary client device; a perfectly replicated ciphertext with an unrecoverable key is still a failed recovery design.

## 5. b-meter: evidence-backed obligations, not a magical compute unit

Use a resource vector. Examples include deterministic VM fuel, a specified tokenizer's counts, byte-seconds of storage, egress bytes, proof jobs, and contractually defined service requests. Pin the workload/model version, measurement method, tariff version, units, and rounding rule.

A GPU-second across different accelerators is not automatically equivalent work. A token count is not proof of answer quality. A physical-energy measurement requires a trusted measurement boundary; proving arithmetic over a reported wattage does not prove the sensor is honest.

For a quote with nonnegative quantities and a defined integer pricing rule:

```text
charge = sum(round_as_quoted(quantity_i * numerator_i / denominator_i)) + fees
charge <= remaining authorized amount
```

Use integer atomic asset units. Bind the network, asset contract/identifier, precision, tariff, recipient, and permitted fees. Reject excess charges; do not silently clip an overrun and call it correct metering. Currency conversion, when used, needs an independently specified quote source and validity window.

### Evidence classes

A provider-signed claim identifies an assertion but does not prove honest work. A client-accepted receipt establishes agreed billing under that client's policy. An attestation depends on its device, firmware, provisioning, and revocation assumptions. A cryptographic execution proof establishes the specified computation over its bound inputs. Real-world measurements retain their measurement assumptions.

Treat these as different evidence types, not equivalent variants of `proof = true`. A cryptographic-compute requirement rejects a mere signed usage claim. Workload correctness and subjective utility remain separate acceptance criteria.

### Private receipt

The private receipt binds:

- the quote, capability commitment, purpose and settlement domain;
- program/model digest, input commitment, result commitment, and private output handle;
- tariff digest, resource quantities, evidence type and evidence artifact references;
- cumulative accepted charge, authorization limit, recipient and fee constraints;
- a replay-safe job/session reference and a specified acceptance/dispute policy.

The complete receipt is not a public blockchain record. Only the allowed settlement statement and reviewed public outputs leave the private boundary. Proof public inputs must be audited for linkability.

## 6. Silent Pay: distinguish autonomy, solvency, and privacy

Silent authorization is not the same as payment anonymity. Batching helps settlement efficiency but does not, on its own, conceal counterparties or prevent correlation.

For the proposed shielded mode, use a reviewed confidential payment construction with funded commitments, conservation of value, spend authorization, change outputs, and anti-double-spend state. Nullifiers need a precise scope and an authoritative state transition; a fresh random identifier alone is not anti-double-spend security.

A valid balance proof is not a reservation. Ten concurrent requests cannot independently reserve the same unspent balance. Use serializable reservations in a funded channel/domain or consume distinct funded notes according to the selected payment construction.

Each funded object has one authoritative home settlement domain. Binding network and contract identifiers prevents replay, but does not itself solve cross-domain double spending. Do not introduce live multi-chain spending before an explicit, audited migration/bridge protocol exists.

For each asset, require conservation across the accepted transition. For a fully closed reservation:

```text
reserved value = provider credit + allowed fees + user refund
```

For partial settlement, include remaining reserved value as an output and prove cumulative claims stay within the funded ceiling. This is an accounting invariant, not executable proof code in this package.

### Proposed job lifecycle

```text
DISCOVER -> QUOTE -> AUTHORIZE -> RESERVE
         -> EXECUTE -> METER -> VALIDATE EVIDENCE
         -> ACCEPT OR DISPUTE -> AGGREGATE -> SETTLE
         -> RETAIN / ARCHIVE / REVOKE ACCESS AS AUTHORIZED
```

Use signed quote expiry, idempotent retries, bounded execution, an explicit result-delivery policy, and incremental receipts for long-running jobs. A result hash proves integrity of something retrieved; it does not prove the customer received a usable result. Conversely, a customer may withhold acknowledgement. Define staged exchange, dispute procedures, and bounded exposure rather than asserting that delivery and payment are automatically atomic.

Relayers may submit approved settlement payloads but may not alter recipients, increase fees, replace the statement, or spend unrelated funds. Multiple relayers reduce dependence on one operator; they do not by themselves eliminate traffic analysis or censorship.

Deposits, withdrawals, public provider payouts, timestamps, amounts, RPC access, and logs remain privacy surfaces. Cross-layer correlation must be tested under a declared observer and collusion model.

## 7. Privacy requirements are independent dimensions

Do not treat local execution, TEEs, MPC, and FHE as a universal P1-to-P5 ladder. Negotiate and enforce separate guarantees for input confidentiality, output confidentiality, execution correctness, metering integrity, access-pattern privacy, payer/payee unlinkability, key custody, and cryptographic assumptions.

Local execution may satisfy a confidential task better than remote FHE. Remote computation on deliberately public inputs may be entirely appropriate. A TEE is only admitted when its trust assumptions are explicitly acceptable. MPC and FHE adapters must declare workload support, performance limits, decryption authority, and proof coverage.

No implementation is advertised as post-quantum end-to-end simply because one encryption component is post-quantum. Audit signatures, commitments, proofs, key establishment, recovery, identity, transport, and settlement dependencies together. Future iO remains outside the critical path.

The default response to an unavailable privacy-preserving execution path is to queue, run locally when authorized, or decline. It is not to reveal plaintext to finish the job.

## 8. The 10B Homeostasis Test becomes a conformance scorecard

Use privacy, sovereignty, recoverability, and correct settlement as hard gates. Optimize cost, throughput, and energy only among configurations that satisfy them. Do not turn the scorecard into a weighted number that lets low cost compensate for a forbidden disclosure.

Measure end-to-end p50/p95/p99 latency, verifier and prover work, peak client memory, transport bytes, replicated byte-years, repair cost, state growth, operator concentration, recovery time, settlement failure rate, and privacy leakage under defined adversaries. Count prover and redundancy overhead instead of hiding it outside the benchmark.

An illustrative scenario, not a forecast or achieved benchmark:

```text
10 billion users * 100 interactions/day = 1 trillion interactions/day
1 trillion * 32 bytes = 32 TB/day for one tiny record per interaction
At 10,000 interactions/batch: 100 million batches/day, about 1,157 batches/s
```

This excludes replication, receipts, proofs, and payouts. Batching is necessary but not sufficient. Keep most work and receipts local to appropriate domains; aggregate selectively; avoid global per-interaction records.

Succinct verification does not make execution free or eliminate data availability. A state root does not reconstruct lost witnesses. Require independently recoverable state, receipt retention, and an escape path before accepting value-bearing aggregation. Pruning must preserve the rejection of old spends and legitimate withdrawal capability.

A thousand-year architecture means planned renewal, migration, succession, and recovery. It does not mean one chain, cipher, company, data format, or economic endowment is guaranteed to endure unchanged.

## 9. Delivery gates

### Gate A: executable economic and storage policy

Implement strict schemas, a capability engine, integer tariff arithmetic, privacy-compatible routing, idempotency, local encrypted result handling, and conformance tests. No real funds. Reject permanent-private publication and silent downgrade. The attached schemas and fixtures start this specification layer only.

### Gate B: bounded payment testnet

Implement one explicitly supported Vaulta settlement adapter and its custom x402 bridge, funded reservations, cumulative accounting, replay protection, expiry, cancellation, crash recovery, and refunds. Pin chain identity, native-versus-EVM execution mode, token contracts, contract permissions, and supported schemes. Do not call transparent testnet payments anonymous.

### Gate C: audited privacy construction

Add the chosen shielded payment and proof implementation. Test public-input leakage, adversarial deposits/withdrawals, fee-payer linkage, RPC correlation, colluding services, duplicated authorizations, malformed encodings, false statements, prover denial of service, and stale verifier keys.

### Gate D: workload expansion and diversity

Integrate actual Autonomi, Arweave, Filecoin, IPFS and other approved adapters; test their claimed lifecycle and retrieval properties. Add selected MPC/FHE workloads only after end-to-end tests show acceptable privacy, correctness, failure handling, and total cost. Benchmark on low-resource clients as well as high-end hardware.

Audit the exact dependency licenses as part of exitability. Vaulta's current protocol page describes Spring under the Business Source License and licensing arrangements; do not assume every version or use is permissively licensed. This is a dependency-review item, not a legal conclusion. [S9]

## 10. Adopt / pattern / leave

**ADOPT as design requirements:** plural storage adapters; deliberate public archival; private manifests; least-authority agent capabilities; evidence-specific metering; funded reservations; explicit receipt acceptance; approved proof suites; migration and recovery; no silent confidentiality downgrade.

**PATTERN and qualify through implementation:** Arweave-backed public agent releases; confidential payment constructions; x402 capped and batched payment semantics; native Vaulta cryptographic acceleration; recursive aggregation; selected MPC/FHE; optional TEE execution under explicit policy.

**LEAVE:** one permanent agent-to-public-wallet mapping as a universal requirement; universal FHE mandates; permanent private-data publication by default; unsupported post-quantum claims; treating provider assertions as mathematical proof; treating batching as anonymity; treating a proof root as data availability; speculative cryptographic cost forecasts as dependencies.

**Kernel:** Make useful work portable, authority bounded, evidence inspectable, private data protected, and public knowledge durable. Preserve the invariant; replace the implementation.

## Sources checked

These sources establish external baselines, not that the proposed bMESHasi implementation exists. No source code or deployment snapshot of the user's current implementation was available for this review.

- S1 — x402, Upto: `https://docs.x402.org/schemes/upto`
- S2 — x402, Batch Settlement: `https://docs.x402.org/schemes/batch-settlement`
- S3 — Autonomi, Data Storage: `https://docs.autonomi.com/developers/core-concepts/data-storage`
- S4 — Autonomi, Data Types: `https://docs.autonomi.com/developers/core-concepts/data-types`
- S5 — Arweave, Permanent Information Storage: `https://arweave.org/`
- S6 — IPFS, Privacy and Encryption: `https://docs.ipfs.tech/concepts/privacy-and-encryption/`
- S7 — Filecoin, Filecoin and IPFS: `https://docs.filecoin.io/getting-started/how-storage-works/filecoin-and-ipfs`
- S8 — Sia, Welcome to Sia: `https://docs.sia.tech/`
- S9 — Vaulta, Protocol Summary: `https://www.vaulta.com/protocol`
- S10 — AntelopeIO, Leap release notes, BLS host functions: `https://github.com/AntelopeIO/leap/releases`
- S11 — Zcash, What Are zk-SNARKs?: `https://z.cash/learn/what-are-zk-snarks/`
- S12 — Zama, Introduction to FHE: `https://www.zama.org/introduction-to-homomorphic-encryption` (used for ciphertext computation, not blanket claims of anonymity or correctness)
- S13 — NIST, SP 800-88 Rev. 2 publication record and abstract: `https://csrc.nist.gov/pubs/sp/800/88/r2/final`
