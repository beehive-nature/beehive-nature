# LANE B — WALLET ROOM (sprint 2026-08-28)
**Seat:** zCode. **Plan:** docs/SPRINT-2026-08-28-PLAN.md lane B. **Law:** continuous landing — each item DONE at its receipt, then the next.

## Lane state
- **B1 — DONE @31b856e + rider @997cba4 (live URL receipt on skaists.dev/surfaces/wallet.html, CI green 3/3 both pushes).** The adapter contract runs in the browser carrier: two dedicated Web Workers (vaulta full-contract, hive balance) on JSON-RPC 2.0; the shell owns the outbox (build→sign→PERSIST→submit→confirm); undeclared capabilities are paths that do not exist; every response crosses an exact-value redaction wall (errors included); nothing shows "sent" until a block read says so. Unicove is retired from the user path — bnames' registration flow lands in our own composer (`walletAction()` + `?compose=` prefill). Gate e2e/wallet-adapter.mjs **24/24** (§9 criteria 1–6, mutation-proven red-then-green).
  - **LIVE receipts (e2e/shots-lane-b/, 390px):** compose from the LIVE Jungle4 ABI (banchor22222::commit, 7 typed fields); the full pipeline against the real rail — signed, outbox-persisted, and the node's honest verdict surfaced verbatim: `FAILED — the rail refused: action's authorizing actor 'bnrij2cis3fd' does not exist`; and the chain-read receipt on a REAL landed testnet action — tx `fce2bd77…` read back by the adapter's confirm from block #283931579, status `executed`, 8 blocks behind head.
  - **The one founder gesture to a full landing:** any Jungle4 account whose key the composer can sign with. Probed dead: greymass `/account/create` (201-but-never-lands), eosn faucet (unreachable), monitor faucet (reCAPTCHA — founder browser, same gesture that created banchor22222 on 2026-08-08), `eosio.faucet::create/send` (faucet-permissioned). A throwaway keypair was generated locally for the receipt (TESTNET-ONLY, lives in the OS temp dir, never the repo).
  - **Live-taught rider @997cba4:** a node answering with a parseable error body is the rail saying NO — surface the verdict, don't rotate around it (eosnation's 500 carried the real nodeos reason).

## Stop-condition evidence (checked 2026-08-28, read-only, before any lane work)
1. Working tree at main (`b272393`): the file is absent from `docs/` (full listing read).
2. All 24 worktrees (the `wt-*` seats + the two `.claude/worktrees`): absent.
3. `git log --all` on the path: **no commit on any ref ever touched it** — the file was never in the repo's history.
4. Only mention of `SPEC-ADAPTER-CONTRACT` anywhere in tracked files: the sprint plan itself.
5. The source material the plan credits does not contain the contract either: `docs/dispatches/RAID_WALLET_SOVEREIGN_LIGHTNING_2026-08-27.md` is a Lightning/standards survey — no adapter-contract, buildAction, outbox, or wallet-law text; the four wallet laws exist in-repo only as the plan's Lane B binding summary line; Brief 03 and Brief 04 carry no spec text.

## The contradiction the founder/chief resolves (one decision, then B runs)
- Plan §7.3 records "`docs/SPEC-ADAPTER-CONTRACT-1.md` do[es] not yet exist — A and B create them," and B1's deliverable includes "spec file committed" — the plan expects the seat to author it.
- The dispatch binds the seat TO the spec as an existing input ("all at repo paths, read them there") and forbids reconstruction — the dispatch expects it to pre-exist.
- These cannot both hold. Either (a) point this seat at the canonical spec text (a repo path or a paste to commit verbatim), or (b) rule that the seat authors it fresh from the raid + Brief 03 + Brief 04's PROTOCOL/SERVICE/PATTERN classing. One word un-parks the lane; B1→B3 then run whole per the plan.

## Park note
- **B2 — DONE @d2ac439 (live at skaists.dev/surfaces/wallet.html, CI green 3/3, 390px shot `e2e/shots-lane-b/wallet-B2-matrix-live-390.png`).** The sixteen-rail chain matrix renders from the data block: every count computed (16 rails · 3 live · 4 proven · 5 verify · 1 study · 3 gap), every row carries read path + custody-tier sign path + honest state badge. Gate `e2e/wallet-matrix.mjs` 8/8 incl. the never-typed mutation.

B1 + B2 landed live; B3 (Arweave buildPublish) runs next per the plan.
