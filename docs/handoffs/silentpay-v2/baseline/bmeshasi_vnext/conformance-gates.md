# Conformance gates beyond schema validation

These are required integration/security tests for future implementation. They have **not** been executed by the included unit-test suite.

## Storage and privacy

1. A private object cannot be routed to a permanent-public archive, including during failover, retries, migration, or recovery.
2. An owner-controlled deletion requirement rejects immutable third-party copies. Revocation, key destruction, local deletion, and provider requests are reported separately.
3. A secret DataMap, private locator, low-entropy unblinded hash, or human-to-object mapping cannot appear in a public receipt or batch input.
4. Provider outage, gateway compromise, and primary-device loss do not trigger a plaintext fallback. Recovery respects the original disclosure and custody policy.
5. Recovery from an independent replica and owner-controlled backup is demonstrated without the original provider or a universal recovery custodian.

## Authority, metering, and payment

6. Concurrent child capabilities cannot reserve more than the parent's funded balance. Retries do not create additional reservations.
7. A proof of sufficient balance without an exclusive funded reservation is rejected by a service policy requiring guaranteed payment.
8. Altering the tariff, units, rounding, asset, precision, fee, payee, program, result, or settlement domain invalidates the accepted authorization/evidence binding.
9. A validly signed but incorrect usage claim fails a policy that requires cryptographic execution evidence. A genuine execution proof is not treated as proof of subjective answer quality or physical sensor truth.
10. Reusing a receipt, voucher, or nullifier within a domain, after restart, after pruning, or across a disallowed domain does not produce a second charge.
11. Cumulative settlement cannot roll back or exceed the reserved cap. Nonnegative value conservation includes fees, change/refunds, and outstanding reservations.
12. Interrupted, expired, disputed, rejected, or undelivered jobs reach specified bounded outcomes. Client acknowledgement withholding and provider result withholding are tested.
13. A relayer cannot redirect payouts, select an unauthorized fee, replace a verifier, or spend unrelated value.

## Proofs, availability, upgrades, and scale

14. Unknown, retired, malformed, wrong-circuit, or wrong-verification-key proofs fail closed within bounded resource use. A submitter-selected suite never overrides policy.
15. Aggregators that withhold state data or receipt witnesses cannot strand users without the documented escape/recovery mechanism. A root is not accepted as evidence of data availability.
16. Network observers, colluding storage/compute/settlement services, repeated requests, distinctive amounts, timing, public payouts, and fee-payer patterns are included in linkage tests.
17. Cryptographic migration covers notes, credentials, witnesses, key recovery, old proofs, and retained ciphertext. An outer proof wrapper cannot silently weaken the required security class.
18. Whole-path benchmarks report low-resource-client memory, prover/verifier cost, latency percentiles, settlement exposure, replicated state growth, repair costs, and environmental measurement uncertainty.

Release policy must record which gates passed, the exact versions and hardware tested, unresolved assumptions, and the guarantee exposed to applications. No single successful benchmark is sufficient for a general privacy claim.
