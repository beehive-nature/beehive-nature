# OpenHarness EXECUTE reference: source check, not an adopted ruling

The founder supplied an architecture assessment proposing OpenHarness as a
replaceable EXECUTE adapter. Its embedded citation placeholders were not usable
sources, so a separate read-only pass checked upstream. Reference repository:
[autonomous-ai/openharness](https://github.com/autonomous-ai/openharness), resolved
to `3cd4014a08da6363841521e8cee010ee5ef46740` on 2026-09-19.

## What upstream supports

- The [DSH contract](https://github.com/autonomous-ai/openharness/blob/3cd4014a08da6363841521e8cee010ee5ef46740/store/spec/README.md)
  records its 2026-09-14 frozen baseline. It already has append-only extensions,
  including viewer-package and update behavior. Pin the commit and supported
  extensions; `spec: 1` alone is not the entire compatibility target.
- The optional verdict file reports readiness, findings, phases and artifacts.
  It is an execution claim, not cryptographic proof or independent verification.
- [Account-free local operation](https://github.com/autonomous-ai/openharness/blob/3cd4014a08da6363841521e8cee010ee5ef46740/docs/development.md)
  is still unfinished. Replacing transport alone does not remove account bootstrap.
  Windows and full Linux support also remain development work.
- DSH setup, initialization, update and viewer commands execute package code.
  Isolation must cover all those phases, not merely the model process. Upstream
  documents that external setup side effects cannot automatically be rolled back.
  See [package changes](https://github.com/autonomous-ai/openharness/blob/3cd4014a08da6363841521e8cee010ee5ef46740/store/spec/CHANGES.md).
- [Provider Protocol](https://github.com/autonomous-ai/openharness/blob/3cd4014a08da6363841521e8cee010ee5ef46740/provider/spec/README.md)
  defines eight required methods, HTTPS, SSE turn streaming and provider-held
  history. It uses tenant-scoped Bearer credentials, not native RAiD grants.
  One provider agent represents one continuous transcript; session mapping needs
  an explicit adapter contract. Some mutation methods may explicitly refuse.
- [Provider onboarding](https://github.com/autonomous-ai/openharness/blob/3cd4014a08da6363841521e8cee010ee5ef46740/provider/spec/onboarding.md)
  says provider machines are not end-to-end encrypted. Do not transfer the native
  daemon transport's encryption claim to this integration path. It also requires
  public HTTPS, credential review and staged onboarding.
- The provider profile requires string error codes, whereas
  [JSON-RPC 2.0 section 5.1](https://www.jsonrpc.org/specification#error_object)
  requires integers. Compatibility tests must target this specific profile.

## Proposed Beehive boundary

EXECUTE-01 is a reasonable candidate boundary: resolve a versioned capability,
validate authority, run an adapter, and return a typed result with artifact hashes.
Identity, proof, settlement and retention remain separate. That is an architectural
proposal; no implemented adapter or compatibility with frozen Beehive interfaces
was demonstrated by this source pass.

RAiD authorization, b-meter receipts, spending enforcement, physical machine
interlocks and Beehive settlement are additions to specify and prove. Upstream
does have usage reporting; do not claim that it has no accounting of any kind.

Before implementation, specify request and artifact hashes, package pins, grant
validation, metering units, hard limits, cancellation, retries/idempotency and
receipt trust levels. Metering after completion does not enforce a spending cap.
The supplied example's 500,000,000,000 byte-milliseconds is only about 139 kB
averaged over one hour; it is not a useful one-hour application memory allowance.

Keep Bitcoin BIP-352 Silent Payments distinct from any internal multi-asset
"Silent Pay" abstraction. A multi-asset settlement adapter and fee/tithe ledger
need their own contract; BIP-352 does not provide that whole mechanism.

Design files and simulations do not establish physical-actuation authority.
Manufacturing remains a separate adapter and acceptance problem.

## Safe next slice

Ask one research/implementation seat for a pinned compatibility matrix and a
fixture-only ExecutionRequest/ExecutionResult contract. Include refused setup,
over-budget cancellation, duplicate request, malformed verdict, and artifact-hash
mismatch cases. No upstream install scripts, credentials, paid execution, host
daemons or machine control are needed for that slice. Return a draft for review;
do not treat this note as founder adoption of a new kernel verb.

No DSH was installed or executed. No account, transport, wallet, machine or
deployment was changed by this source check.
