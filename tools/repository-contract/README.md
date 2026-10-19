# Portable repository contract, version 1

GitHub remains the source host, proposal UI and CI provider. This consumer adds
an offline source manifest and a deterministic acceptance decision that do not
call GitHub. It does **not** install a new branch authority or create production
keys. `acceptUpdate` returns a proposed next state in `shadow` mode. GitHub's
existing merge/check process still governs this repository.

## Existing contracts reused

- `scripts/lib/bpay-invoice-generic.mjs::canonicalBytes`: sorted object keys,
  array order preserved. Our closed schemas exclude its special `quotes` field.
- `scripts/lib/bpay-settle.mjs::digest`: SHA-256 over domain, NUL, canonical JSON.
  This imports the commitment function, never payment or submission behavior.
- `crates/bsigner/CONTRACT.md`: unchanged frozen `bheart.signature/1` envelope.
  `signature.mjs::verifyEnvelope` is a **consumer** using the already-vendored
  ML-DSA-65 implementation in `surfaces/onboarding/vendor/bpq-lib.js`.
  `bsigner.test.mjs` checks interoperability with the real Rust bSigner CLI.
  No bSigner feature or wire-format changes. Version 1 supports ML-DSA-65 and
  SHA3-256 envelope content digests; other algorithm IDs are refused.
- `scripts/ci-run-receipt.mjs` supplies the existing unsigned GitHub observation
  format. `github.mjs::githubStatement` checks explicit workflow/job selection,
  run attempt, successful execution, actual checkout/tree and log digest. Its
  output is named `unsigned_statement`: it must still be signed by an executor
  authorized by the independently trusted repository policy.

bindexer remains a keyless observer. bPay retains payment/reconciliation
authority. x0x transport, ANT/AR storage, Hive ordering, and CPU/RAM/NET execution
can consume these byte contracts later; none is impersonated by a local test.

## The decision and trust root

```js
import { acceptUpdate } from './contract.mjs';
const result = acceptUpdate({
  state, trustedStateDigest, policy, manifest, proposal,
  signatures, evidence, payloads, // Map<sha256:hex, Uint8Array>
});
```

The caller obtains `trustedStateDigest` from a trusted checkpoint channel,
**outside the proposal/package**. It binds the repository ID, ref, current
head/tree, sequence, policy digest and last accepted proposal digest. The latter
chains the full accepted manifest and previous checkpoint, including artifacts
that do not change a Git head. It is null only at the trusted sequence-zero
bootstrap. A supplied policy cannot authorize itself.
Unknown fields/versions, unknown keys/algorithms and malformed input are refused.
The result is `{accepted:false, code, detail}` or a deterministic proposed state
with the old and new checkpoint digests. No clock, network, signing, payment,
recipe execution, file mutation or ref update occurs in this decision.

The update must name exactly the next sequence and previous checkpoint; the
source commit must directly include the current head among its parents. Owner
signatures cover the entire domain-separated proposal. Every required suite
needs its declared threshold of **distinct authorized keys**, signing a
qualification statement bound to that proposal and pinned recipe. Failed,
skipped, cancelled, stale, duplicate, missing and wrong-source evidence refuse.
Distinct keys are not automatically independent operators.

Trust model: **pinned executor signatures**. An executor signature authenticates
that executor's claim; it does not prove correct computation. A dishonest trusted
executor can sign a false observation. GitHub observations and unkeyed hashes
alone cannot authorize an update. Independent re-execution/quorum, hardware
attestation or a scoped computation proof are later provider choices.

This version cannot change policy, rotate/revoke keys or choose a genesis root.
Those require an explicit later transition contract. A consumer must atomically
compare-and-swap the current checkpoint before installing a returned state.
Two proposals evaluated against the same old checkpoint can both be eligible;
only one may win that storage transaction. The tests prove the loser and replay
refuse **after** the checkpoint advances. No distributed ordering or crash-safe
authoritative state store is claimed here.

## Manifest and wire profile

`contract.mjs` and `manifest.mjs` are the closed-schema validators. Wire JSON is
exact `canonicalDocument(value)`: UTF-8 canonical JSON followed by one LF.
`parseDocument` refuses duplicate fields, alternate encodings, unsafe integers,
negative zero, lone surrogates and prototype-special keys. The document
validators additionally refuse unknown fields.
This is the estate's INVOICE-1 profile, not a claim of RFC 8785 compatibility.

| Document | Required content |
| --- | --- |
| `bnr.repository-state/1` | repository, ref, sequence, head, tree, policy_digest, last_proposal |
| `bnr.repository-policy/1` | repository, ref, revision, pinned public keys, update keys/threshold, suites with recipe digest and executor keys/threshold, max_bytes |
| `bnr.repository-manifest/1` | repository, ref, source, files, recipes |
| `bnr.repository-update/1` | repository, ref, next sequence, previous_state, policy_digest, manifest_digest |
| `bnr.repository-qualification/1` | proposal_digest, suite, recipe_digest, result, observation_digest |

Public keys use `{id, alg, public_key}`. The ID is the frozen organ's
`bheart-` plus the first 16 base64url characters of SHA3-256(algorithm ID bytes
concatenated with public key bytes); the full public key is pinned in policy.
`signingBytes('proposal', value)` and `signingBytes('evidence', value)` use
different domains. Envelope timestamps are not an authorization clock.

The source profile is explicitly **one complete Git snapshot**, not all history:

- `source` carries `object_format:'sha1'`, `history:'snapshot'`, commit, tree,
  ordered parent IDs and all reachable trees/blobs plus the root commit.
- Every object carries `{oid, kind, bytes, digest}`. The verifier recomputes both
  the Git object ID and a SHA-256 byte commitment and walks the declared graph.
  Missing, extra, malformed and incorrectly typed objects refuse. Parent
  commits are the declared shallow boundary, not silently missing history.
- Submodules/gitlinks and LFS pointers refuse; version 1 does not claim their
  external contents. A future manifest version must carry and verify them.
- `files` carries named input/output byte descriptors. Recipes bind argv,
  runtime digest, input/output names, `network:'none'`, CPU/RAM limits and zero
  network bytes. These are committed execution requirements, not evidence that
  a scheduler enforced them. Runtime image bytes are referenced by digest and
  are not automatically embedded. Recipe completeness is the policy author's
  responsibility; no hermetic-build claim is made.
- Payload storage is `objects/<sha256 hex>`; metadata never chooses local paths.
  CLI payload reads default to a hard 256 MiB budget and JSON to 32 MiB.
  The policy can lower the payload limit. Resource limits reject oversized
  carried data before signature work; they do not sandbox an execution provider.

## Local CLI

Requires Node 22+ and Git. No package install or credentials. These commands run
from the repository root. All `--out` paths must be new. The pack command reads
committed `HEAD`, never unstaged files. It does not fetch missing objects.

Write a canonical plan through `canonicalDocument` containing:

```js
const plan = {
  recipes: [{
    id: 'tests', argv: ['node', '--test', 'test.mjs'],
    runtime_digest: pinnedRuntimeDigest,
    input_files: ['lockfile'], output_files: ['results'], network: 'none',
    limits: { cpu_seconds: 120, ram_bytes: 268435456, net_bytes: 0 },
  }],
  files: [
    { name: 'lockfile', role: 'input', path: '/explicit/path/lockfile' },
    { name: 'results', role: 'output', path: '/explicit/path/results' },
  ],
};
```

```sh
node tools/repository-contract/cli.mjs pack --repo /path/to/repo --repository urn:bnr:your-repository --ref refs/heads/main --plan /path/to/plan.json --out /path/to/new-package
node tools/repository-contract/cli.mjs inspect --package /path/to/new-package
node tools/repository-contract/cli.mjs restore --package /path/to/new-package --out /path/to/new-bare-repo
```

Restoration writes only a new bare Git repository, marks its shallow boundary,
then checks it with `git fsck --strict`. It writes Git's existing
[zlib-compressed loose object format](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects),
avoiding one child process per object. It does not check out or execute source.
Restoration is an integrity check, not authorization. The test restores a
two-commit fixture with an unavailable remote and proves the exact head/tree.
For snapshots exceeding the CLI's conservative 256 MiB ceiling, the module API
accepts an explicit `maxBytes` argument to `packSnapshot`, `loadPackage` and
`restoreSnapshot`. The policy still bounds acceptance; increasing a caller's
I/O budget does not override that policy.

Prepare canonical policy/state/proposal and obtain the trusted checkpoint
through your existing authority process. The module exports `commitment` for
the six domain-separated document kinds. Existing bSigner signs these bytes:

```sh
node tools/repository-contract/cli.mjs signing-bytes --kind proposal --document /path/to/proposal.json --out /path/to/proposal.bytes
bsigner sign --key-id EXISTING_ID --file /path/to/proposal.bytes --keydir /existing/keydir --rec-env EXISTING_RECOVERY_ENV --out /path/to/signature.json
```

Qualification envelopes sign `signingBytes('evidence', statement)`. Put the
exact observation bytes under their digest in the package's objects directory.
The canonical packet is `{state, policy, proposal, signatures, evidence}`;
each evidence item is `{statement, envelope}`. `signatures` is a list of
proposal envelopes, not signature booleans supplied by an adapter.

```sh
node tools/repository-contract/cli.mjs verify --package /path/to/new-package --packet /path/to/packet.json --checkpoint sha256:TRUSTED_CHECKPOINT
```

Only an accepted shadow decision exits zero. An absent checkpoint or refusal
exits nonzero. No command creates a production identity or modifies GitHub.
`fixtures.mjs` contains public deterministic TEST-ONLY keys and is imported
only by tests; never use its policy or keys for a repository authority.

## Tests and next provider boundary

```sh
node --test tools/repository-contract/contract.test.mjs tools/repository-contract/package.test.mjs
REPOSITORY_BSIGNER_BIN=target/debug/bsigner node --test tools/repository-contract/bsigner.test.mjs
```

The existing `tests` workflow runs the pure/CLI suites in `static`, and the real
organ test after the existing workspace build in `test`. No new workflow,
dependency install or duplicate Rust build. A missing organ fails, never skips.

The next provider can store these exact objects on ANT/AR and return them to
`loadPackage`, without changing acceptance bytes. It must separately prove
upload/readback/retention. x0x can transport proposals without acquiring update
authority. An executor can sign the same qualification format without Actions.
Before moving live refs off GitHub, qualify trusted checkpoint distribution,
atomic ordering, durable recovery, key/policy transitions and provider failure.
