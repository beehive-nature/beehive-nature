# HANDOFF 2026-10-05: wallet.html bug sweep (fresh session)

Founder, 2026-10-05: "wallet.html is still full of bugs with more than i am spending any more time
on. hand off to a new session". He tests on skaists.dev and reports nothing else; this file is the
whole brief. Recommended seat: **Opus 5.5, high effort, Ultracode on** (workflows for the audit and
for adversarial review; xhigh for any signing or key change).

## 0 · Read first

1. `C:/Users/travi/CLAUDE.md` (laws; §4a: never hand the founder a command).
2. Memory index `~/.claude/projects/C--Users-travi-beehive-nature/memory/MEMORY.md`, especially:
   `founder-calm-guidance-and-one-choice`, `soul-name-is-not-vaulta-account`, `hive-lane-one-paste`,
   `arweave-ecdsa-from-keychain`, `wallet-registers-gate-structure`, `register-is-a-grammar-not-a-dress`,
   `founder-ux-only-astra-owns-ui`, `founder-no-pr-no-local-server-live-check`,
   `founder-report-done-and-pending-only`, `receipt-only-reporting`, `never-run-a-publish-script-to-test-it`.
3. This file, then `git log --oneline -12 -- surfaces/wallet.html`.

## 1 · The founder's rules for this surface (2026-10-05, all binding)

- Every state a user sees in new bee and raver is **one calm sentence plus the one action** (a
  named link or a button in the same place). No bare states, raw errors, step counters ("1/5"),
  ALL-CAPS shouting, tool names, "above/below" across tasks, or dashes in bee copy. Detail moves
  to cypherpunk; it is never deleted.
- Order of ways for any chain: (1) the wallet's own key, (2) **one paste + one press in the same
  surface** (the key used once, or sealed under the keychain; never stored in the clear),
  (3) a third-party wallet only as a quiet last resort. Never a copy button that sends the user
  elsewhere. "STOP SENDING OUR USERS TO 3RD PARTY SOFTWARE."
- A UI bug report is never answered with code or commands: fix it, say in plain words what now works.
- No PRs: commit to main from the worktree (Windows git + askpass shim), verify on skaists.dev, end
  with CI's verdict on the pushed sha.

## 2 · What works now (live, CI green, main ccd9b3808)

- **Accounts follow the .b name** (cecd5494a): the registry row's owner signs, its account receives
  (king.b → kingbeelovis; the Vaulta account "king" is a stranger's). A bare account that carries
  this wallet's key is never redirected by a hostile row. The receive address shows only once the
  wallet proves it signs. Cache `bnr_vacct`.
- **One-press sign sheet** (`wallet.html?compose=kingbeelovis:<action>&args=…&intent=…#sign-action`),
  driven by the name desk (bnames.html workshop and secure buttons). If the wallet cannot sign yet,
  the wallet first searches its own earlier keys on the account, then offers **one paste** of the
  account's active key in the same sheet: one transaction adds this wallet's key and carries the
  action (654723bd1). The founder's own key on kingbeelovis is from an older keychain, so his first
  renew asks for that paste.
- **Arweave from your keys** (da991f73c): native secp256k1 address (Arweave 2.9+), keyless reads,
  publish from it; one rule picks the shown address and the paying key.
- **Hive** (ccd9b3808): one paste of the active key adds the account it names (founder: loviswater),
  sealed per soul; one press sends HIVE/HBD under the outbox law.
- Tests in CI: e2e/wallet-action-sheet.mjs (71), wallet-arweave-keys.mjs (26), wallet-hive.mjs (39),
  plus the existing wallet batteries.

## 3 · Known defects still open (from today's audits and reviews; verify each before fixing)

**P0 · money, keys, honesty**
- `#tx-wa` "sign with the account passkey instead": the checkbox only skips the bridge check;
  `walletAction`/`vaultSign` have no WebAuthn lane, so it signs with K1 or fails.
- Composed Vaulta actions bypass the spend cap (`walletAction` never calls `capAssert`).
- `walletPublish` (Arweave) writes its failures to `#tx-out` in the proof task; keep-task users never
  see them (`#arw-file-status` says only "did not complete").
- Account forge: accounts it creates get keys from `vaulta:<name>/active`; confirm `findOwnKey`
  covers them end to end, and that the forge's own "bridged" check uses the same context.

**P1 · calm-guidance sweep (bee and raver show these today)**
- Coin cards (`#bal-sec`): an unread total shows a lone caret "⌄"; stats "waiting…", "connect
  keychain to derive", "read failed", "AR/ANT/arbitrum read failed" with no retry; breakdown rows
  say "Vaulta adapter / Hive adapter" and "read an account to see its AR row".
- Keychain (`#kc-sec`): "engine missing", PRF jargon from `passkeyFallbackMsg` (raw `e.message`
  embedded), ALL-CAPS key-card titles, "— keychain scrubbed from memory —".
- Bridge scaffold and account forge: step counters ("1/5 …"), "node refused:" plus raw JSON,
  "broadcast is covered by staked CPU/NET…", "FORGE ACCOUNT".
- Key forge chips: raw `err.message`, "core derives when WASM armed", the ar: chip note "public
  Arweave address — never a private JWK" for a derived address.
- Arweave panel: "REFUSED", "⚓ ANCHORED", raw gateway errors.
- Composer `#tx-out`: "1/5 building intent…", "SUBMITTED — …NOT sent", "vaulta adapter not
  attached — never spawned", "build failed:", "vault refused:".
- Pay: "liquid: —", "derived address: — · gas: reading…", "choose a lane above", "2/3 signing…",
  "node refused: <JSON>".
- Outbox (`#outbox-sec`): raw intent_id, phase pills, "read: <JSON>".
- Vault: "UNLOCK", "🔐 CREATE THE VAULT", "＋ SEAL IT IN", "unverified".
- Accounts book: "Read unavailable · <raw error>".
- Raver hides the checkboxes inside `label.law` without an id (`#tx-wa`, `#vlt-devicebound`).
- Cypherpunk console mirrors the "at a glance" tile links as dead text.

**P2**
- The send lanes and the sign sheet have their own button looks; Astra owns the look (leave hooks).
- `docs/SPEC-RESOURCE-DASHBOARD-1.md` and the wallet disagree on Turbo; the wallet stays native-only
  until the founder rules.

## 4 · Method

1. Audit (workflow): walk wallet.html in three registers × 390 and 1280, with no keychain and with
   the e2e fixture keychain (recovery code of `new Uint8Array(32).fill(0x2a)`, in-memory routed
   origin as in e2e/wallet-action-sheet.mjs). List every visible string and control per task;
   classify each against §1. Keep the list in this file's §5 as receipts.
2. Fix in batches by section. One commit per batch; never two commit paths at once.
3. Before each push: `node e2e/wallet-registers.mjs` (127), `node e2e/estate-source.mjs`, the wallet
   batteries in three registers (`WALLET_REG=bee|raver|cypherpunk node e2e/wallet-<x>.mjs`),
   `node e2e/wallet-action-sheet.mjs`, `wallet-hive.mjs`, `wallet-arweave-keys.mjs`, and
   `cd e2e && node footer-audit.mjs --only wallet.html --baseline footer-audit.baseline.json`.
   Restore regenerated screenshots (`git checkout -- e2e/shots-*`) before committing.
4. Any change to a signing or key path gets a read-only adversarial review workflow (Explore agents,
   per-finding refutation) before it is pushed.
5. Verify on skaists.dev, read-only.

## 5 · Audit receipts (the next session fills this in)

_Empty until the §4 audit runs._

## 6 · Laws that bind every step

- **The founder's browser pane holds his passkey** (Windows Hello "kingbeelovis · Passkey for
  skaists.dev"). Never open a `#sign-action` link with an intent, press Sign, connect the keychain,
  publish, pay or send from an agent browser. Live checks are read-only.
- No mainnet act; no agent holds, requests or transmits key material; tests use the public dev key
  only (TESTNET-ONLY marker) and mocked chains.
- New wallet UI goes inside an existing section (the registers gate counts sections and pins
  `WL_TASK_OF`). New `data-i18n` keys need all 28 tongues in surfaces/lang-corpus.json.
- Bumping a script's `?v=` means regenerating stack.html (`node scripts/build-stack-surfaces.mjs`).
- Never `--no-verify`; never rewrite public history.

## 7 · Paste this to start the fresh session

> Read `beehive-nature/docs/dispatches/2026-10-05-wallet-bug-sweep-handoff.md` and everything in its
> §0, in order. Then run its §4 audit of surfaces/wallet.html and fix every finding against its §1
> rules, P0 first, one commit per batch to main, each verified as §4 says. Never act with the
> founder's passkey or on mainnet (§6). Report to the founder only what now works, in plain words,
> and what is still open, ending with CI's verdict on the last pushed sha.
