# Sprint order — Zano HF6 adapter pass

**Recipient:** Claude Code (Seat 3), `bclaude@agents.skaists.buzz`.
**Status:** reconstructed implementation brief, Goal 2 of the two-goal sprint.
The supplied conversation names this goal but does not include its original order
body. The work below is derived from the existing source-cited audit; it is not
presented as recovered verbatim founder wording, a fresh upstream audit, or completed work.

## Start with the existing work

Fetch current main and inspect the existing HF6 branches, tests and PRs before coding.
Use an isolated worktree; preserve other seats' changes. Read
[ZANO-HF6-VS-PROTO-2026-09-01](../audits/ZANO-HF6-VS-PROTO-2026-09-01.md),
[handoff v1.3](../architecture/handoff-v1.3.md), the actual `chain-zano` adapter,
`proto/messages-zano.proto`, and the associated firmware/host implementation wherever
it currently lives. Resolve any stale documentation against source and record the pins.

## Scope

1. **Revalidate the HF6 format boundary.** Pin a current Zano source revision and the
   exact node/network used for verification. Revisit the audit's transaction-version,
   per-output version, intrinsic payment-ID, address parser and serialized-size claims.
   Record upstream file/function citations and changes since the earlier pin. Do not
   treat a historical activation height as a verified current network state.
2. **Prove the transaction prefix.** For the supported confidential transaction path,
   align host and device serialization, including HF6 version fields and per-output
   `encrypted_payment_id`, so both sides agree on the bytes and signing hash. Determine
   the necessary additive wire changes from current source. Preserve existing field
   numbers and test compatibility explicitly.
3. **Keep the frozen cryptographic decisions.** The earlier audit distinguishes prefix
   work from SLIP-0010 derivation, view-key derivation, CLSAG GGX, key images, balance
   proof and the 1/8 convention. Confirm that separation with current source and
   independent vectors. Absence of an HF6 conditional alone is not proof of byte-level
   cryptographic equivalence across revisions.
4. **Refuse unsupported gateway outputs.** The existing v1 scope is confidential
   spending. Detect gateway address/output variants and return a named error before
   signing; do not reinterpret them as confidential addresses or silently expose values.
   Adding gateway spending is outside this compatibility pass.
5. **Exercise edge cases.** Cover payment ID absent/present, invalid lengths, multiple
   outputs, output caps, version boundaries, address variants, fee/blob-size estimation,
   malformed data and the self-directed-payment-ID rule. Distinguish wallet policy from
   consensus acceptance instead of inferring one from the other.
6. **Receipt the real signing boundary.** Keep keys in the appropriate signer. Host
   simulation, emulator results, testnet node acceptance and real-device signing are
   different evidence classes. Report exactly which exists; no fabricated signature,
   synthetic success marker or software-only pass can stand in for a hardware receipt.

## Acceptance and delivery

Use independent upstream/reference vectors and relevant adapter/serialization tests,
including negative vectors for unsupported gateway destinations and malformed versions.
Verify a supported confidential transaction against the pinned node/testnet when that
environment and authorized test inputs are available. Record a missing device/node/input
as incomplete acceptance, while completing the independent host-side work.

Report source and proto revisions, exact serialization/hash comparisons, tests run and
failure output, node/device evidence actually obtained, and remaining gaps. Commit and
push the isolated branch with a dated dispatch. Never rewrite public history or revive
retired protocol choices through an unrelated HF6 fix.

## Provisioning and privacy

Use existing authorized hardware and testnet resources. Follow the current
[worktree and box rules](../../AGENTS.md); keep deployment mirrors aligned if an actual
deployment is part of the implementation. Do not buy infrastructure or alter cloud
ingress simply to make an acceptance result appear complete.

Keep spend secrets/device secrets out of logs and files. Preserve confidential defaults,
label public test constants, and publish only permitted test evidence. Signing by the
founder's wallet remains subject to that wallet's existing authorization boundary.
The full separately mentioned “provisioning law” was not supplied; this brief does not
claim to reproduce it.
