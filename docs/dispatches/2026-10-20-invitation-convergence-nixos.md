# Invitation convergence: authenticated v4 provenance

Repair branch: `codex/invitation-convergence`, x0x PR #5.
Candidate: `3956274a07958e8b01da34eacf9fb672148e7048`.
Base: main `cfb097504cfe2d2eaf3cdc6176b02585142450aa`.

## Root cause and scope

The October 19 scheduled run 39223803733 failed at the test's provenance
assertion, before the joiner attempted admission. The test called
`SignedInvite::creator_agent_id_from_base_state`, a legacy full-roster
derivation, on an authenticated v4 invitation. ADR-0059 deliberately removes
`base_members_v2` from that format. Current invitations carry `base_roster`
and an explicit `creator` inside `InviteSignedViewV4`.

The repair changes only `tests/named_group_join_metadata_event.rs`. Both
the public-open and private-secure variants now assert the v4 shape, verify
the bound inviter signature, and compare the signed creator with the
historical creator. Substituting the issuing admin as creator must return
`InviterSignatureInvalid`. Existing admin-role, membership, state-hash,
roster-root, TreeKEM security-binding and final creator assertions remain.
No timeout was increased and no assertion was removed without a current
protocol equivalent.

Production code and dependency pins are unchanged. In
`src/groups/invite.rs`, `SignedInvite::verify_v4_inviter_signature` verifies
the canonical signed view using `verify_with_ml_dsa` after the inline public
key's agent-ID binding. The real join handler additionally applies its
revocation, base-consistency and policy gates. The test does not replace
those gates or confer authority on historical creator metadata.

## Native validation

Validation runs on Hostinger NixOS 26.05, with Rust 1.95.0 and nixpkgs
`09063bd1f2b36fd9fd793c36dfade7bd40a93dfc`, separately from the running node.
All features are enabled, matching the failed scheduled test's feature set.
The development profile disables debug symbols to bound compiler memory;
these are correctness tests, not performance measurements.

The temporary build uses a dynamic user, its own state directory, a 16 GB
limit and low scheduler priority. Test execution uses a fresh loopback-only
network namespace, no default routes, a non-root dynamic user, empty
capability sets, no-new-privileges and whole-unit child cleanup. Runtime
admission checks record these properties before starting any test daemon.

Build setup constraints are retained in the journal. A copied rustup
linker wrapper referenced its previous location; installing the pinned
toolchain in a fresh lane-owned directory corrected that. The all-features
Opus build required `CMAKE_POLICY_VERSION_MINIMUM=3.5` with the pinned Nix
CMake version. This is a validation-job environment setting, following
[CMake's compatibility documentation](https://cmake.org/cmake/help/latest/variable/CMAKE_POLICY_VERSION_MINIMUM.html),
not a source/dependency modification. That bundled Opus build subsequently
installed its archive under `lib64` while its Rust build script searched
`lib`. The validation shell therefore includes Nix `libopus` 1.6.1 from
the same pinned nixpkgs revision; Cargo discovers it through pkg-config.
The shell definition and lock are retained. The Windows rustup shim also failed
an automatic component refresh; formatting instead used the already
installed Rust 1.95.0 formatter directly.

The native baseline reproduced the exact scheduled failure at the old
provenance assertion: one failed test in 36.25 seconds, exit 101. The
candidate then rebuilt successfully in 2.20 seconds. All seven ignored
tests in `named_group_join_metadata_event` passed in 198.86 seconds:
zero failed or ignored, three non-ignored tests filtered out.
This includes both non-creator-admin variants, the public and TreeKEM
convergence assertions, forged role/secret rejection, signed-role tampering
rejection, invite-secret recording, propagation and idempotence.

The runtime reported successful unit completion, a 94.5 MB memory peak,
and 27.086 CPU seconds. The unchanged daemon SHA-256 in both runs is
`3e0c4dd42f58a623cba4f57fb87ea7faec3ccf9f47b8024aa0d84499d8550bea` (PUBLIC-CONSTANT).
The baseline test binary hash is
`140c399b3c2b378a08ed11d5d6fbbec658319d5f25de45ca7cceefb9072970ac` (PUBLIC-CONSTANT);
the repaired test hash is
`7ce7abcf4b53f0b70a912e9bd081e9c2fdbf19770af663eaa1bf2465bda3ab15` (PUBLIC-CONSTANT).
The identical daemon bytes and repaired test result establish that the
observed failure was the obsolete test expectation; they do not establish
that every possible invitation/convergence defect is resolved.

After validation, all four temporary build/runtime units were inactive.
The existing production x0x 0.46.0 service remained active and healthy,
with 25 send-ready peers and zero restarts. It was not replaced by the
candidate build. Full logs, shell definitions, isolation admission and
checksums are in
[`../receipts/invitation-convergence-20261020/`](../receipts/invitation-convergence-20261020/).

At publication, PR #5 is ready for review and unmerged. Hosted checks show
28 successes, two scheduled skips, the inherited Cargo Audit failure,
and two still running (Test Suite and Coverage Gate). Those pending jobs
are not counted as passes. The weekly timing job remains schedule-only;
the native suite above directly executes its seven ignored selectors.
The original scheduled run itself remains a historical failed run, and
no one-hour soak result is claimed.

Final closeout on October 20: both pending jobs succeeded. The final rollup
is **30 success, two skipped, one inherited Cargo Audit failure, zero pending**
at the same PR #5 head. Test Suite passed 4,746 tests (326 skipped), plus one
voice acceptance test; Coverage passed 4,740 (318 skipped), reporting 86.97%
line coverage above the unchanged 65.70% floor. REST/API and transport advisory
coverage targets remain unmet. The final JSON and selected job log excerpts
are retained alongside the earlier snapshot. See
[CI closeout and native comparison](2026-10-20-bnrose-native-comparison-ci-closeout.md).

Publication tooling note: the BNR hook self-test exercised secret rejection
and clean-content acceptance, but its later inventory fixture did not
complete (`Missing inventory source: crates/adapter-arweave`) in the sparse
receipts checkout. This is not a passing full hook-self-test claim and is
separate from the seven passing native x0x tests. Publication uses the
installed hooks without bypass.

## Separate work and limits

PR #4 remains unmerged at `85633f6a6dfea44e62a0cad778aa429275fc4604`.
Its shadow adapter is not part of this branch. The separate dependency
remediation remains PR #3; this branch retains main's dependency graph.
PR #5's Cargo Audit run 39394537791 confirms the same seven findings:
rustls 0.23.45 (RUSTSEC-2026-0346 through 0349) and zip 2.4.2
(RUSTSEC-2026-0367 through 0369). No ignore was introduced to turn that
independent failure green.

Oracle's A1 capacity blocker remains independent: the previous recovery
attempts failed in all three Phoenix domains. No Oracle instance was
started or accessed in this lane, and no Oracle OS or health claim follows
from these Hostinger tests. No production node deployment or live-mesh
acceptance is claimed.
