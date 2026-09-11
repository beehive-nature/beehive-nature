# Connect Store: accepted local prototype integrated

The founder authorized progressing the Buzz-compatible Connect + Store backend.
zCode's independent re-review accepted the corrected local candidate
`f02f0f6e442efbdc1736571952bcb1748121e4a6`; the acceptance is recorded at
`5d0afbfa` in [the R1 dispatch](2026-09-10-connect-store-review-zcode-r1.md).
All four findings from the first review are closed for that stated scope.

## Integration record

Integration uses the seat-owned `wt-astra-connect-store-integration`, branch
`codex/connect-store-integration-2026-09-10`, starting from main `5d0afbfa`.
The local merge's second parent is the exact accepted candidate `f02f0f6e`.
Its author is loVis waTer, committer is Codex (Astra), and the final message
block carries the parsed Co-authored-by trailer. No API merge or rewritten
history is involved. The shared checkout and build worktree are untouched.

There are no conflicts. The entire `tools/connect-store` tree, its workflow,
original build dispatch, and process-loss receipt are byte-identical to the
accepted candidate. This integration dispatch is the only added material.
The two independent review dispatches already on main remain unchanged.

The accepted candidate has four completed successful check-runs (`scan`,
`static`, `test`, `node`). Integration verification on Windows Node 24.18.0:
`npm ci --ignore-scripts` reports zero vulnerabilities; `npm test` passes
26/26; `npm run prove` passes with every measured receipt field unchanged;
CI shape passes 40/40; `git diff --check` is clean.

CI on the resulting merge must be checked by its own SHA after push. Candidate
checks are not evidence about a different commit. The merge commit carrying
this file records both parents; its check-runs are the integration CI receipt.

## Accepted scope and next work

Two authenticated clients can exchange signed history and a file locally,
lose the first gateway process, then recover exact signed events and file bytes
using opaque copied objects and a client-held checkpoint pin. Outsiders remain
refused. This is a tested local protocol prototype, not a live relay migration.

Next implementation lane: a bounded x0x receive-to-follow adapter for a
read-only replica, with actual HTTP/WebSocket caller tests against a synthetic
daemon fixture matching the pinned upstream protocol. Checkpoint hints must
pass the existing Channel.follow verification before changing visible state.
This closes a missing implementation boundary; a loopback fixture cannot prove
remote participant delivery or provider independence.

Before a network canary or production replacement, the outstanding gates remain:
capped payment admission at signing, a second x0x participant actually receiving
and following a checkpoint, recovery through a genuinely separate provider,
and client-held pins plus writer fencing before a replacement accepts writes.
Full-snapshot cost amplification must be included in payment budgets. Paid
Autonomi writes remain disabled. No app profile, service, production traffic,
wallet or public laptop mesh node is changed by this integration.
