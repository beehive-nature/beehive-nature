# Required proof relation (not an implemented circuit)

Given an approved suite S and public BatchStatement B, prove there exists private
state/witness W such that:

1. B has the approved exact encoding; its digest is exactly the two public input
   limbs. Version, full domain, operation and expiry are constrained.
2. The prior note/reservation/nullifier/revocation/inbox state hashes to oldRoot.
3. Every imported deposit is a valid element of the bound finalized funding
   inbox and imported exactly once into this domain/asset state.
4. Every spent note is valid, funded, authorized, and belongs to this home domain.
5. The chosen spend/close nullifier is correctly derived and absent in the old
   state AND in earlier operations of this batch; it is inserted in the new state.
6. New reserves allocate exclusive value, preserve the parent delegated budget,
   bind the merchant/quote/expiry and produce correctly valued change.
7. Accepted receipts bind exact quote, model/program, price units, rounding,
   allowed evidence, sequence, prior receipt, cumulative values and recipient.
   Required signatures/credential proofs/compute proofs are genuinely verified,
   not supplied as unconstrained booleans.
8. Amounts are range-constrained and arithmetic cannot wrap. The permitted tariff
   is applied and charges PLUS all fees remain within the funded ceiling.
9. For each asset, inputs equal provider credit + fees + change/refund + remaining
   reserve + explicit public withdrawals. No asset's surplus covers another.
10. Nullification and all output construction are within the same transition;
    no beneficiary or relayer field is an unconstrained/publicly replaceable input.
11. Refund/claim/revocation branches respect the agreed redemption window and
    registered valid claims. A unilateral provider claim does not require a
    newly cooperative payer. Refunds for deposits not yet imported are safe.
12. Each externally visible withdrawal EXACTLY matches the B recipient/asset/value
    list; each removes corresponding private value and consumes its nullifier.
13. The resulting authenticated state hashes to newRoot; receipt commitments
    match the accepted receipts; output payloads/witness updates bind to the
    agreed availability commitment. Hashing data is not proof of availability.
14. Every recursion/aggregation inner statement is verified using the approved
    key and semantics. An input list's Merkle root alone is not aggregation.
15. Required authority proof, including any bRESPECT/bzDiD predicate, verifies its
    scope, freshness and revocation policy without leaking a stable human ID.

## Proof coverage flags (descriptive; not authority by themselves)

AUTHORIZATION, FUNDING, RESERVATION, METER_ARITHMETIC, CLIENT_ACCEPTANCE,
COMPUTE_EXECUTION, FHE_EVALUATION, NULLIFIER_UPDATE, VALUE_CONSERVATION,
DATA_AVAILABILITY, OUTPUT_DELIVERY.

A suite is approved only for actual verified coverage. METER_ARITHMETIC does not
imply COMPUTE_EXECUTION; COMPUTE_EXECUTION does not imply OUTPUT_DELIVERY or
subjective utility; FHE_EVALUATION does not imply anonymous transport/payment.

## Deployment blockers

No circuit source/setup artifacts are shipped. The C++ verifier router rejects
all proof systems. The native Groth16 equation prototype assumes validated
subgroup points and is isolated from the contract on purpose. HALO2/STARK/PQ
names are reserved routes, not implemented backends. Private state recovery and
unilateral claims/exits must be implemented and tested before custody is enabled.
