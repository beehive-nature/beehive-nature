# Mail TLS completion receipt — 2026-10-03

## Landed

PR #260 is MERGED as `ee6e3ddc9c6be814e0e5a4218ca9c9248b3f8540`, from reviewed head `39eea28794a3aad23631ec8ff8d9e2463ebd02d9`. GitHub recorded mergedAt `2026-10-03T07:03:48Z` (October 3 UTC; October 3 at 01:03:48 America/Denver).

- PR: https://github.com/beehive-nature/beehive-nature/pull/260
- Completion review: https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5966592484
- Existing round-9 reviewer verdict passes this exact head. Codex code/security summary completed for the same head. Zero unresolved review threads.
- Pre-merge checks: 15 SUCCESS, 1 SKIPPED. Aikido Deep Review was skipped; that is not security or runtime proof.
- Merge preview against fetched main `dc03615c6`: `git merge-tree --write-tree` exited 0, tree `205fff5c2f2ba0188a7a29d890eb11fa30191153`. Main advanced independently before the server-side merge; GitHub still accepted the head-locked merge without overriding protection.
- Executed `gh pr merge 260 --merge --match-head-commit 39eea28794a3aad23631ec8ff8d9e2463ebd02d9`; exit 0. This session did not encounter an automatic approval rejection or change permission settings.
- Corrected PR title to “mail: withdraw the unverified STARTTLS finding and add on-host diagnostics.” The previous title asserted the suspected interception explanation as fact. The body already states the uncertainty correctly.

The script, historical withdrawal dispatch, and ledger correction landed together. The only new file in this completion lane is this receipt.

## Host result: UNVERIFIED

Two attempts through the prescribed WSL SSH alias failed before authentication:

1. `wsl -e ssh -o BatchMode=yes -o ConnectTimeout=10 oracle 'id -un; hostname; command -v sudo; sudo -n true'`
2. `wsl -e ssh -o BatchMode=yes -o ConnectTimeout=20 oracle 'id -un; hostname; sudo -n true'`

Both exited 1 with:

```text
Connection timed out during banner exchange
Connection to 129.153.202.144 port 22 timed out
```

The alias resolves to user `ubuntu`, host `129.153.202.144`, port 22, matching the checked-in mailroom/OCI runbooks. Neither attempt reached a remote command. No service, certificate, firewall or server configuration changed. Failure to receive an SSH banner does not establish whether the host is down, the path is filtered, or sshd is unavailable.

STARTTLS advertisement, negotiation, deployed/running certificate agreement, and server egress remain UNVERIFIED. The old external measurement remains withdrawn. The suspected interception cause remains UNVERIFIED.

## Exact diagnostic for the next reachable host run

Use the merged version of `scripts/buzz-mail/tls-diag.sh`. Its exact file digest is:

`1958c4490d1d3f8df1474e8ff7293644e7ed2835be12b3559c8b9acb585e0f8e` PUBLIC-CONSTANT

Read through the script before running as root. From a checkout containing merge `ee6e3ddc9`, obtain the script from that commit, verify the digest above, and execute it on oracle with `sudo sh`. It performs diagnostic reads and bounded loopback/egress probe connections; it does not restart services. Preserve the exit code and complete derived output in a successor dispatch. Never capture private-key contents, process command lines or full s_client session output. Report current advertisement and negotiation separately; a current successful handshake does not settle the historical August observation.

## Local verification and limitations

Worktree: `C:/Users/travi/wt-codex-mail-tls-finish`, branch `codex/mail-tls-finish-2026-10-03`. Shared-checkout WIP untouched; staging is by this receipt's explicit path only.

- Git-for-Windows `sh -n scripts/buzz-mail/tls-diag.sh`: exit 0. Exact file hash matches the reviewed script.
- Installer exited 2, refusing to overwrite the existing `.githooks/pre-commit` because it is not installer-owned. Retained it: inspection shows the active hook runs `scripts/secret-scan.sh diff` followed by `scripts/identity-check.sh`; `core.hooksPath` points to that existing directory. No hook bypass used.
- `e2e/hooks-installed.test.sh` exited 0, but its claimed refusal row printed “nothing added to commit.” That row did not establish scanner rejection of a nonempty staged delta. Its reported pass is NOT counted as proof of that behavior. No scanner repair is included in this mail lane.
- An initial post-merge fetch raced another seat updating origin/main and reported “cannot lock ref … is at ee6e3ddc9 … but expected a61f23c06 …”. A subsequent `git fetch origin main` exited 0; origin/main resolved to the merge SHA. No force update used.
- Existing configured Git identity retained. No invented seat identity or Signed-off-by trailer.

## Publication boundary

GitHub Pages run: https://github.com/beehive-nature/beehive-nature/actions/runs/37105100848

At the receipt snapshot, build succeeded and deploy was queued. Merge completion is confirmed; site publication and post-merge CI completion are not yet claimed here. Post-merge secret scan run 37105100950 subsequently completed SUCCESS. The tests run and Pages deployment are still pending at the final follow-up. Prior PR CI passes do not stand in for these new main runs.
## Completion status follow-up

GitHub Pages run 37105100848 completed SUCCESS: publication is now confirmed. Main tests run 37105100918 completed FAILURE. Failed jobs: `eternal` (ETERNAL fronts and bottom-half rendered checks) and `node` (comprehension and engineflow rendered checks). Observed node diagnostics include “seven disclosures on the organ board, got 6” and an engineflow `paraKey` TypeError after keyboard-navigation failures. These are unresolved repository CI findings; this status check does not establish the introducing commit or attribute them to the mail diagnostic. Server TLS remains UNVERIFIED after the two recorded SSH banner timeouts. Therefore the merge and publication are complete, but host verification and a green post-merge test run are not complete.
## Retry requested: current main is green; SSH still unavailable

Re-fetched origin/main on 2026-10-03. Main `fd423f3fa8e825120b62f3afae3fb7608e843541` contains the #260 merge. Tests run 37108252124, secret scan 37108252168, and Pages deployment 37108251432 all completed SUCCESS. The earlier failed rendered checks are no longer a current-main gate.

Retried `wsl -e ssh -o BatchMode=yes -o ConnectTimeout=15 oracle 'id -un; hostname; sudo -n true'`. It exited 1: “Connection timed out during banner exchange”; connection to 129.153.202.144 port 22 timed out. No remote commands ran. Live host TLS verification is the only remaining mail-lane completion item. The next meaningful attempt is when the configured SSH endpoint can complete its banner/authentication exchange; elapsed time alone does not establish that it is reachable.