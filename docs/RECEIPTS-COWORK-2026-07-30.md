# COWORK RECEIPTS — DISPATCH_KEYRING_2026-07-30 (W1, W2, W3)
Seat: Cowork (machine ops / hands). Date: 2026-07-30.
Standing laws observed: no key material touched; no seed/PIN/passphrase; no signing prompt
answered; digests via Git Bash/WSL only, never PowerShell pipes; UNVERIFIED marked and stopped.

---

## W2 — Git-for-Windows msys repair · **CLOSED — defect A48 no longer reproduces**

**Finding: no repair was required.** Git for Windows has been updated since A48 was
recorded; the msys2 runtime is functional on this machine now.

Probe, run from `cmd` (raw output):

```
git version 2.55.0.windows.2
SH_OK
sh_exit=0
sha256sum (GNU coreutils) 8.32
sha_exit=0
```

A48 recorded git `2.53.0`-era behaviour where `sh.exe`, `bash.exe`, and
`usr/bin/sha256sum.exe` all failed `STATUS_DLL_NOT_FOUND`. All three now start and
exit 0 under `2.55.0.windows.2`.

**Acceptance — hook run to completion, Windows-side git, scratch branch, no `--no-verify`:**

```
5fab814                                   (HEAD before test)
hookrun_exit=0                            (git hook run pre-commit)
Switched to a new branch 'scratch/hook-test-w2'
[scratch/hook-test-w2 885cb5f] W2: no-op hook verification commit
commit_exit=0
885cb5f W2: no-op hook verification commit
```

Scratch branch deleted after verification; `main` restored at `5fab814`. The
project secret-scan hook (`core.hooksPath=.githooks`) executed and passed — the gate
ran, it was not bypassed.

**Ledger action required (Seat 1 or code seat):** A48 must be superseded, not deleted —
it was true when recorded. Proposed successor row: *"A48 superseded 2026-07-30: git
2.55.0.windows.2 runs sh/sha256sum/hooks cleanly; Windows-side commits no longer
require the WSL fallback. WSL path retired as a workaround."*

**Note for the record:** `main` is **3 commits ahead of `origin/main`** and unpushed.
Not in scope for W1–W3; flagging because the register now lives in this tree and its
history is only durable once pushed.

---

## W1 — `esr://` handler · **PARTIAL — registration verified, visual confirmation blocked**

**Anchor version:** `1.3.12.0` at `C:\Program Files\Anchor Wallet\Anchor Wallet.exe`.

**Handler registration — already correct, both hives:**

```
HKEY_CURRENT_USER\Software\Classes\esr
    URL Protocol    REG_SZ
    (Default)       REG_SZ    URL:esr
HKEY_CURRENT_USER\Software\Classes\esr\shell\open\command
    (Default)       REG_SZ    "C:\Program Files\Anchor Wallet\Anchor Wallet.exe" "%1"

HKEY_CLASSES_ROOT\esr  ... (identical)
```

No `UserChoice` override exists under
`HKCU\...\Shell\Associations\UrlAssociations\esr` — nothing is hijacking the protocol.
**Re-registration was therefore not performed: the registration is not the defect.**

**Launch test (Anchor running):** `start "" "esr://test"` — Anchor was already running
(6 processes, Electron multi-process as expected) and remained running afterward.

**What is NOT verified, stated as a gap:** whether a signing prompt actually rendered.
Confirming that requires a screenshot of the Anchor window; the computer-use access
request timed out (180s, no approval dialog resolved), so **no visual receipt was
obtained.** Cold-start test also not run — killing 6 Anchor processes without founder
presence was judged out of scope for a config-only lane.

**Status: UNVERIFIED on the acceptance criterion.** Per standing law this is stopped
and reported, not inferred. The registry evidence rules out handler mis-registration
as the cause; if founder observes esr:// links still failing, the defect is inside
Anchor's URL handling (the greymass/anchor #958 lineage), not Windows association —
which is itself the useful narrowing.

**To finish:** founder runs `start "" "esr://test"` and reports whether a prompt
appears, or re-grants computer-use so a screenshot can be taken.

---

## W3 — exSat network config · **chainId VERIFIED; wallet entry NOT made**

**Pre-connect chainId verification — done first, per the fence:**

```
POST https://evm.exsat.network
{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}

{"id":1,"jsonrpc":"2.0","result":"0x1c20"}
```

`0x1c20` = **7200 decimal**. Matches the dispatch pin and the C1 registry pin. The RPC
endpoint is live and answering. Verified via `curl.exe` under cmd — the PowerShell
attempt was discarded for quoting corruption, consistent with the no-PowerShell-pipes rule.

**Network parameters, ready to enter:**

| Field | Value |
|---|---|
| Network name | exSat Network |
| RPC URL | `https://evm.exsat.network` |
| Chain ID | 7200 (`0x1c20`) — **verified live above** |
| Currency symbol | BTC |
| Block explorer | `https://scan.exsat.network` |

**Wallet entry NOT performed.** MetaMask and Rabby are browser extensions; adding a
network requires driving the extension UI inside a browser profile that holds live
wallet state. Two reasons to stop:

1. Computer-use access did not resolve, so no UI could be driven at all this session.
2. Judgment call worth stating even if it had: the extension UI sits one click from
   accounts, connect prompts, and signing flows. The dispatch scopes Cowork to
   configuration only and orders a hard stop at any signing surface — driving a live
   wallet extension is close enough to that boundary that founder presence is the
   right posture, not an obstacle.

**Founder takes over here — explicitly:** open MetaMask/Rabby → Settings → Networks →
Add network manually → enter the five values in the table above → save. Confirm the
wallet reports chain 7200 after adding, then connect the Trezor and do the portal
connect and any signature personally. Cowork touched no seed, PIN, passphrase, or
signing prompt, and will not.

**Standing reminder carried from the dispatch:** this path is INTERIM by ruling. It
retires when bSigner's exSat rail passes its honesty gate — the `verify_chain_id()`
pin in C1 is the same 7200 verified above, so the two agree by construction.

---

## Summary

| Order | State | Blocking |
|---|---|---|
| W2 | **CLOSED** — A48 no longer reproduces; hook exit 0 Windows-side | none; ledger supersede row proposed |
| W1 | **PARTIAL** — registration correct and ruled out as cause; prompt-render unverified | computer-use access |
| W3 | **chainId VERIFIED 0x1c20**; wallet entry deferred to founder by design | founder presence |

Cross-order finding: both W1's remaining step and W3's wallet entry need the same
thing — an approved UI-control session or the founder at the keyboard. They should be
done in one sitting.
