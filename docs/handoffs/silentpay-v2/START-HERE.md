# bMESHasi / Silent Pay — coding handoff

Prepared 8 September 2026. This folder carries the current design into a coding environment without relying on conversational memory.

## What is actually here

`baseline/silentpay_v2/` contains the original draft 0.2 specification, Python reference, C++ contract source, examples and tests. The Python reference was rerun during preparation of this handoff: **59 tests passed**. See `verification/python-baseline-tests.txt` and `verification/status.json` for the observed command and environment.

The native contract has not been compiled or deployed in this handoff. The proof router is deliberately disabled. No Rust implementation, real ZK circuit, FHE integration, bridge, hardware integration, node operation, repository upload, or Codex task is asserted. The Python model is plaintext, in-process test software—not a private payment system.

`baseline/silentpay_v03_design/` adds the approved b-first interface, ANT/Arbitrum route, Autonomi storage, resource-aware FeePlan, participation profiles and acceptance scenarios. Those scenarios are specifications, not additional executed tests.

The earlier vNext archive is included under `baseline/` as historical context. Keep implementation status distinct from requirements.

## Start coding

Open this extracted folder in a coding environment. Read `AGENTS.md`, `docs/DECISIONS.md`, and `docs/SPRINT-01.md`. Use `BOOTSTRAP-PROMPT.txt` as the initial instruction. This folder is not yet a Git repository. Use version control in the selected development environment; do not automatically publish it or push to an unrelated repository.

The first deliverable is a runnable Rust economic/state-machine reference with tests and a clearly labelled simulation. It must preserve fail-closed proof handling. Native/EVM integration is an explicit qualification milestone—not a reason to represent mocks as a deployed bridge.

The most recent approved decision is to use **exSat as a primary implementation reference for the native Vaulta/EVM boundary**. This is not a dependency on external BTC custody or a claim that any selected runtime has already been pinned and tested.

## Reproduce the existing baseline

From `baseline/silentpay_v2/`, install the pinned dependencies in an isolated Python environment and run:

```sh
python -m unittest discover -s tests -v
```

The Python and C++ drafts use different encodings. Establish explicit, versioned cross-language fixtures before interoperability claims.

## Report progress as evidence

For every milestone report files changed, exact commands, observed results, mocks/stubs, and unresolved blockers. Distinguish proposed, implemented, compiled, tested, integrated, audited and deployed. A chat instruction or an approval is not evidence that a service is running.
