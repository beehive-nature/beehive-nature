# BheART WALLet: additional accounts and public-address following

2026-10-03, America/Denver. Seat: Codex. Branch:
`codex/wallet-accounts-follow-2026-10-03`. Owned checkout:
`C:/Users/travi/wt-codex-wallet-accounts`.

## Result

The wallet's **see what i have** task now includes **Accounts & following**.
Readers can save multiple existing accounts or public addresses, label them,
edit their network/address/list, refresh one or all, copy an address, remove a
record, undo the last removal, and open its activity explorer in a new tab.
The preservation-invoice panel links directly to the list.

The list supports Vaulta A, liquid Hive HIVE, Arbitrum ETH + ANT, Base ETH +
native USDC, confirmed Bitcoin BTC, Solana SOL, and Arweave AR. These are
the assets carried by the existing readers; this is not arbitrary-token
discovery. Hive Power/HBD and Bitcoin pending amounts are not folded into
these balances. Silent-payment addresses are explicitly refused because
following them requires a private scanning capability, not an address lookup.

**My accounts** and **Following** are separate lists. The user's classification
does not prove ownership and does not grant spending authority. These entries
never enter the connected wallet's totals. Adding an entry does not create an
on-chain account, import a key, switch the signing identity, or fund bPay.

Up to 50 public records persist in this browser under
`bnr.wallet.public-accounts.v1`. The stored schema contains only version,
network, address, label and list classification. Balances and read errors stay
in memory. No cloud sync or background alerts are implemented. The page
discloses that public chain services receive addresses being read.

## Implementation boundaries

- `surfaces/wallet.html`, `BNRWALLET.readPublicBalance`: reuses the Vaulta,
  Hive and Arweave adapter shell and loads the existing Bitcoin/Solana
  workers on demand. The EVM reader uses the existing `EVM_RAILS` asset
  registry, checks the responding host's chain ID, and formats integer base
  units without a floating-point conversion. No new signing path is added.
- `wallet-address-book` inline module, `normalize` / `validate`: validates
  network-specific forms, mixed-case EVM checksums, Bitcoin Base58Check and
  Segwit checksums/programs, Solana decoded length, and Arweave padding.
  Same-network EVM casing cannot create duplicate records; different
  networks remain distinct. Labels render through `textContent`.
- `refresh` / `refreshAll` / `expire`: reads carry individual state and
  timestamps. Failed or expired reads display no balance figure. A successful
  read expires after two minutes, checked every 15 seconds and on visibility
  changes. Batch refreshes use three concurrent reads and cannot overlap.
  A response arriving after removal or a cross-tab update cannot recreate
  a record. Storage failures never claim a successful save; conflicting
  tab writes are refused with a retry message.
- The existing `autoConnect` gesture handler excludes the entire address
  book. A returning soul can use these controls without a passkey ceremony.
- External activity links carry `target="_blank"`,
  `rel="noopener noreferrer"`, and visible new-tab wording.

This modifies the existing registered wallet surface. No surface is added
or moved, so no estate row or review-board entry is added.

## Verification

- `node e2e/wallet-accounts.mjs`: **44 checks passed**, exit 0. Real Chromium
  and existing Web Workers, with mocked public RPCs. Covers the seven
  networks, EVM precision and chain mismatch, checksums, duplicate handling,
  edit/remove/undo, XSS-shaped labels, stale/error states, late reads,
  reload/cross-tab persistence, storage quota/corruption, and all three
  registers at 390px. No script exceptions or horizontal overflow.
- Credential isolation includes a returning `bnr_soul` fixture. Address-book
  controls make zero credential calls and retain the connected account and
  balance. The negative control dispatches the existing keychain gesture
  outside the address book and observes one intercepted credential request.
- `node e2e/wallet-registers.mjs`: **125 / 125 passed**, exit 0. Existing
  three-register navigation, presentation, accessibility and value-state
  checks are green on the final run.
- `node tools/check-wallet.js`: clean, exit 0. Inline syntax, assets, IDs,
  duplicate IDs, tag balance and existing integration checks pass.
- `node scripts/estate-check.mjs`: exit 0, 109 counted / 118 listed /
  26 domains, registry and embedded hub in sync.
- `git diff --check`: exit 0.
- `e2e/wallet-accounts.mjs` is wired into the existing wallet CI job.

Screenshots in `e2e/shots-wallet-accounts/` show **fixture balances**, not
live holdings. The desktop and mobile form/list views were visually inspected.
No mainnet transaction, signature, payment or private-key operation was run.
Live provider availability, GitHub CI, merge and production deployment are
not established by these local checks.

## Failures found and handled

The baseline `tools/check-wallet.js` at fetched main `0ce0ff781` failed with
`FAIL section: 19 open vs 20 close`. Blame identifies the extra closing tag
before the composer in `3fa910ef55`. This change removes that stray tag;
the checker now reports 19 / 19 and exits 0.

The first register run found newly added 13px notes below New Bee's 14px
minimum. The final styling uses 16px notes and at least 14px address/status
and action text in that register. The failed run was stopped after the
finding; its result is not counted as a pass.

The initial address-book fixture had a 41-digit EVM body and was correctly
refused; the test fixture was corrected. Screenshot checks were tightened to
assert the actual selected register before recording each view.

`sh` was absent from PowerShell PATH. Retrying through
`C:/Program Files/Git/bin/bash.exe scripts/install-hooks.sh` returned:
`install-hooks: REFUSING - .../.githooks/pre-commit exists and was not written by this installer`.
Inspection found an existing shared hook that delegates to both
`scripts/secret-scan.sh diff` and `scripts/identity-check.sh`; it was preserved.
The installer contract test exited 0, but its refusal probe had no staged
delta (`nothing added to commit`), so that particular row is **not** evidence
that a secret was blocked. The actual lane commit remains subject to the
existing shared scanner and identity hooks.

## Upstream priority check

Fetched origin before implementation and rechecked it before publication.
The lane starts at main `0ce0ff781d9b1fcf604f45f9b2fe4ea8d3fa8393`.
The GitHub run listing available during this check returned older records at
`c5e7f2cc`; those are not CI evidence for this lane or current main.

Read David Irvine's current discussion before opening the feature lane:

- [#622, 2026-09-30 disposition](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
  moves remaining work back to **#504**. The old handoff's direction to #622
  is now historical.
- [#504, current consolidated work](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5906795696)
  retains the per-pair delivered/published measurement and ordered post-v0.46
  work. It remains open. This wallet lane performs no mesh measurement and
  makes no acceptance claim for those items.
- [#505 field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210)
  records David's September 15 close on the reporter's OCI evidence. No new
  handshake test or upstream reply was performed in this lane.

The work here is the existing browser wallet's public-read interface; no
backend/mesh service, port, deployed file, key or production wallet is changed.
