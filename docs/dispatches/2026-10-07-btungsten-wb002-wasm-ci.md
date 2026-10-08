# 2026-10-07 — WB002 WASM corpus CI runner

The next leg after merged PR #359: `.github/workflows/wb002-wasm.yml`
executes the existing 46-step corpus three times, each on a fresh local
single-producer chain. Ubuntu 22.04 and Spring 1.2.2 are explicit; the
upstream Debian release asset is verified against its published SHA-256
before installation. Fresh JSON receipts are uploaded for 14 days, including
partial receipts on failure. Missing receipts fail artifact collection.

The harness now creates a unique temporary state/wallet directory, accepts
HTTP/P2P port overrides, refuses occupied ports, and only signals its own
child processes. The previous port-substring process killer is removed.
SIGINT/SIGTERM clean up owned children. No sibling chain is stopped.

Validation: JavaScript syntax check passed. A local Spring run and hosted
workflow are being measured; their final results will be recorded below.
The hook installer refused to replace the pre-existing custom shared hook:
`install-hooks: REFUSING ... pre-commit exists and was not written by this installer`.
Inspection confirms it delegates to secret-scan and identity-check; the
hooks-installed battery passed. Existing shared hooks were preserved.
Initial local tooling probes found no `python` or `sh` on PowerShell PATH;
edits used Node and hook validation used Git-for-Windows bash instead.

Upstream priority checked before this lane: David's latest #622 comment
moves remaining work back to #504; his 2026-10-05 #504 comment requests
per-kind counters (#1170) and a same-workload delivered/published capture.
#505 has David's field-accepted close. No mesh measurement is claimed here.
References: https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450
https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476
https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210

Boundary: corpus-sampled agreement on this pinned local stack, not a formal
proof, testnet result, or version-general equivalence. Testnet remains a
separate resource-dependent leg. The Cryptol follow-up is already owned
by PR #361 and is not duplicated here.
