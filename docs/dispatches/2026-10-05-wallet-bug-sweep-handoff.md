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

## 5 · Audit receipts (run 2026-10-05, on e77a50918)

**The walk.** surfaces/wallet.html served at its production origin in memory, Vaulta mocked (king.b → kingbeelovis), every other chain read made to fail; three registers × 390 and 1280 px × three states (no name; king.b; king.b with the e2e keychain, recovery code of `new Uint8Array(32).fill(0x2a)`); every task, every raver card, and the pay lanes pressed. 54 page states, every visible line and control kept per section.

**The classification.** Ten read-only auditors (one per section group), each checked by a read-only completeness critic, read every line the walk showed and every JS path that writes into the section (error paths the walk cannot reach included). Four read-only verifiers took the §3 P0 claims; a scout took the Trezor failure.

| section | P0 | P1 | P2 |
|---|---|---|---|
| glance | 4 | 27 | 17 |
| keychain | 7 | 54 | 14 |
| vault | 9 | 57 | 13 |
| forge | 4 | 56 | 19 |
| balances | 2 | 22 | 18 |
| bridge-acct | 7 | 33 | 13 |
| pay | 6 | 56 | 25 |
| compose | 8 | 59 | 10 |
| store | 3 | 44 | 23 |
| add-proof | 8 | 36 | 18 |
| trezor | 2 | 14 | 5 |
| **total** | 60 | 458 | 175 |

Verdicts on §3: the `#tx-wa` passkey lane, the cap bypass and the Arweave errors in another task were confirmed; the forge-account context claim was refuted as stated (findOwnKey already searches `vaulta:<name>/active`), with real neighbouring gaps (a bare forged account under a row, a stale signing verdict after an account change). The audit also found: `eosio` has no `transfer` action on Vaulta mainnet and A is core.vaulta's token (the send lane could never have worked, and the A figure was the EOS balance relabelled).

Every P0, by section (`selector · what a reader met`):

- glance · `#wstat` · ✓ connected as king.b · Vaulta account kingbeelovis · balances live
- glance · `#connect-sec .wl-connect-cta (#wq, #wgo) and .wl-create-bzdi` · the field "your account or .b name" and the "connect" button vanish (display:none!important); nothing on the p
- glance · `#wl-bee .wlb-fig[data-wl-src=v-bal], #v-bal, #wstat` · on Vaulta, your home chain / <balance of the bare account 'king', a stranger's> / ✓ connected as king.b · bala
- glance · `#sum-bridge (with #sum-kc)` · keychain: connected ✓ · Vaulta authority: connect your keychain to check (never changes; signing stays off)
- keychain · `#kc-soul-name (in the K1 card .kt)` · VAULTA K1 SIGNING KEY (vaulta:king) over EOS7J7TFtDywaew7rr9rAU1cirLgKBsxy9c5gUJqD8R1qVQp5hqar
- keychain · `#kc-stat` · ✓ bzDiD born on this device — connect now re-touches this exact passkey automatically. Write down your recover
- keychain · `#kc-stat` · no usable bzDiD passkey came through — if the browser offered a QR for your phone, know that path only works w
- keychain · `.dm-rv on the '· this browser' row, then #kc-stat on the nex` · revoked (this browser's seal deleted too — connect falls back to passkey/recovery)
- keychain · `#dm-stat` · revoked — the device keeps any cached copy offline; full kill is the recovery-rotate lane / ✓ this device now 
- keychain · `#qr-body (confirm sheet after a camera scan)` · a desktop at <b>{the phone's OWN location.host}</b> asks to sign in + six words + [allow this desktop] [cancel
- keychain · `#kc-stat (next connect after 'make THIS device permanent')` · ✓ keychain live — keys in tab memory only, never stored (shown for a soul derived from the device wrapper pass
- vault · `#vlt-importbtn2 -> #vlt-file -> #vlt-stat` · ✓ imported and unlocked — N entries. This replaced any vault previously held in this browser.
- vault · `#vlt-rekey (prompts) -> #vlt-stat` · prompt "Current keypass:" (value is ignored while unlocked), then prompt "New keypass:\n\n(suggestion — 88 bit
- vault · `#vlt-open > .law (④ Your devices), line 1119` · ④ Your devices. Every one of these opens this vault on its own, and none of them can read the others. Add each
- vault · `#vlt-open > .law (⑤ Your bzDiD), line 1147; #vlt-stat after ` · ⑤ Your bzDiD. Seal your soul’s recovery phrase in here and it stops living on one device’s passkey. Any device
- vault · `#vlt-sealbzdid` · 🐝 seal my bzDiD recovery phrase -> seals an entry labelled 'my bzDiD soul · <fingerprint>' from BZDIDKEY.iden
- vault · `#vlt-panic (button, confirm, #vlt-stat)` · ⚠ panic — revoke every device except this one / confirm: PANIC — revoke all N other device(s)? Only the device
- vault · `#vlt-devices button[data-revoke] (confirm, #vlt-stat)` · confirm: Revoke "<label>"? That device can no longer open this vault. Every other device keeps working. / revo
- vault · `#vlt-list button[data-act=bridge] -> #br-wif, #br-paste; #vl` · key placed in the bridge field below — it is scrubbed the moment you broadcast
- vault · `#vlt-revealed button 'copy to clipboard' -> #vlt-stat` · copy to clipboard -> copied — your clipboard now holds a private key. Paste it where you need it, then copy so
- forge · `#pq-bind-stat (after #pq-bind)` · ✓ 7 accounts bound to bzpq1… · save the binding. keep a copy somewhere permanent. ⏱ timestamp it on Bitcoin (t
- forge · `#forge-chips .chip .cx (every derived chip)` · ✓ copied
- forge · `#forge-stat (after #forge-ar)` · ✓ your Arweave address for king · made from your keys (secp256k1), never stored (meanwhile the ar:king chip sh
- forge · `#forge-chips (ar:<soul> chip)` · ar:king · Arweave address / <bound 43-char address> / public Arweave address — never a private JWK
- balances · `#h-info` · <acct> · <vesting_shares as a number> HP · <hbd> HBD · rep <raw reputation integer>
- balances · `#hv-other` · use a different Hive account
- bridge-acct · `#br-wif (inside details#br-wif-scaffold[data-reg=cypherpunk]` · #br-calm says "The key is used once and never kept." The vault handoff writes the private key into the hidden 
- bridge-acct · `#br-paste-stat (rebuilt inside #br-calm by brCalm)` · "Adding this wallet to kingbeelovis…" disappears on the first poll. If the key does not show within about 15 s
- bridge-acct · `#br-paste-stat` · The chain said no. Nothing changed.
- bridge-acct · `#ac-stat (written by vaultaSend)` · "the network did not answer, so nothing was sent. [try again]" / "the chain said no. nothing was sent." / "som
- bridge-acct · `#ac-stat, #ac-go (price lives only in #ac-cost[data-wl-tech]` · you have 5.0000 A to pay for the new account’s RAM.
- bridge-acct · `#bridge-sec > .law[data-wl-tech]` · Your bzDiD-derived K1 key is not on your account yet. Gold: connect / inject / derive enrolls the key — New-be
- bridge-acct · `#ac-stat` · you have 5.0000 A to pay for the new account’s RAM. (left over from the previous account)
- pay · `#sv-stat (same helper writes #sw-stat, #ac-stat)` · the chain said no. nothing was sent. / the network did not answer, so nothing was sent. [try again] / somethin
- pay · `#se-stat` · Base refused: already known / Base refused: null
- pay · `#tx-panel > .law (last child, no id)` · the EVM lane sends from your derived 0x address — fund it via 📥 receive first (it is not your Vaulta account 
- pay · `#rx-cards button.rxc, #pn-copy` · ✓ copied
- pay · `#rx-cards (card 'Lightning · sats')` · Lightning · sats / npub167raq0r4… (with QR) / the LN module’s own key — the NWC connection binds to this, neve
- pay · `#ln-card` · description <the invoice's own text> / issuer <the offer's own text> / amount N minor units of <the offer's ow
- compose · `#tx-preview-body` · preview() writes '<b>action</b> '+contract+':'+action+' / <b>auth</b> '+actor+'@active / <b>args</b> '+JSON.st
- compose · `#tx-go, #act-go, #act-paste-go` · (no message at all) the action is built, signed and sent past the cap: walletAction (6119) and vaultSign's Vau
- compose · `#outbox-list .obx-retry` · 'FAILED — the rail refused: rail accepted nothing: {…}' in #tx-out and the row pill turns 'failed', while the 
- compose · `#outbox-list (retry) writing into #tx-out` · every retry message ('submitting the identical stored bytes…', 'submit faulted (…)', 'FAILED — …', 'EXPIRED — 
- compose · `#tx-out (written by walletPublish)` · 'arweave adapter not attached — never spawned', 'build failed: …', 'sign refused: …', 'signed (…) and PERSISTE
- compose · `#tx-wa (label in #tx-wa-row)` · ✋ sign with the account passkey instead (PUB_WA at threshold 1 — either signer works)
- compose · `#act-h, #act-say` · setchain words 'Point k.b at <address> on <chain_key>.' come from d.chain_key; a missing field prints 'undefin
- compose · `#tx-go` · (no message) The second press builds a new transaction, signs it, persists it and submits it, so the action ru
- store · `#arw-go / #arw-stat` · payload verified (1926 B, sha256 pinned) · your own key signs… (then it signs and posts at once, no review ste
- store · `#arw-stat` · payload verified (1926 B, sha256 pinned) · your own key signs… (stays forever; button re-enabled)
- store · `#arw-file-status` · Publication submitted. / Publication signed. / Publication failed. / Publication expired. / Publication confir
- add-proof · `#peer-sec .row[data-wl-tech] (code 0x8988… + #peer-copy)` · raver: 0x89881F83A8C9CE06E34cbDD50A612909a784d7C6 [copy] · bee after show the details: receive address (bare t
- add-proof · `#peer-copy` · copied
- add-proof · `#vc-key[placeholder]` · your meter key, e.g. bclau-paid-1
- add-proof · `#vc-panel with #vc-err` · previous key's balance + 'send any amount of A to: <acct>' + memo '<previous key>' stay on screen next to 'the
- add-proof · `.vc-copy buttons beside #vc-a-dest, #vc-a-memo, #vc-u-dest` · A · Vaulta · gasless / send any amount of A to: <acct> [copy] / with this exact memo (the memo is the binding:
- add-proof · `#vc-u-dest + [data-i18n=wl.vc.usdc.nomemo]` · send USDC (Base) to: 0x… [copy] … no memo needed on this rail: your bound address credits you
- add-proof · `#receiptsBody headline (26px total) + lead` · 0.1064448 A · Every bill re-checked here in your browser. Open a receipt to see its proof.
- add-proof · `#receiptsBody button[data-rc]` · tapping 'receipt 7: FAILED' opens receipt 6's proof (INCONCLUSIVE); tapping receipt 1 opens nothing new
- trezor · `#wa-status` · Initialize failed: unexpected error (the raw TrezorConnect.init error, passed through by status(e.message)); a
- trezor · `#wa-trezor-path / #wa-trezor-account` · Derivation path: m/44'/60'/1'/0/0 (for account 2), saved and labelled 'Trezor · account 2'

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
