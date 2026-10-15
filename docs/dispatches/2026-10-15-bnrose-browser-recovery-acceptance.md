# 2026-10-15 · Browser-to-BNRoSe durable purchase recovery — handoff ACCEPTED, current-main baseline measured, the open case defined, the seam named

Date: 2026-10-15 (UTC timestamps throughout). Seat: Claude Code (Fable 5.1), a fresh session. Worktree `.claude/worktrees/friendly-mclean-e83996`, branch `claude-LoVis/browser-bnrose-purchase-recovery-aa511f`, cut from main `ec7fed11f5cd5362ac58987aeed96652ff0b0e24` (the #410 merge; `git fetch origin main` at 10:31Z returned the same sha, so this branch starts on current main, not a stale one). Orders: the founder's relayed mission of 2026-10-15 ("Integrate and qualify browser-to-BNRoSe durable recovery for a paid-but-incomplete ANT upload after total browser-state loss … Own the browser integration and end-to-end qualification. Coordinate changes to the existing Rust core with its current owner. Do not build a competing execution core, journal, or storage abstraction."). This dispatch is the mission's first required write: the acceptance of the #410 → #411 handoff, recorded in the repository.

## 1. The handoff, accepted — by whom, for what, and what stays with the Rust owner

**Accepted here**, as the receiving owner of the **browser integration and the end-to-end qualification**: the operation record `bpay.ant.journal/1`, the signed-envelope preservation rule, the reservation rule and the crash fixtures, exactly as §5c of `docs/dispatches/2026-10-12-agent20-devnet-acceptance-scope.md` hands them over and as PR #411 comment `6140053520` (2026-10-13T06:54:03Z) announced them. The handoff was addressed to "the PR #411 owner"; that lane (ZCode, `zcode/bnrose-*`) has since delivered #421, #424, #425, #427 and #428 and has **not** consumed the browser record or the browser fixtures in any merged or open PR (checked: every merged PR since 2026-10-14 and every open PR at 10:31Z; no `zcode/*` branch touches `surfaces/`, `e2e/ant-*` or the record schema). The integration seam is therefore unowned, and this seat takes it. Nothing is duplicated: the Rust execution core, its journal, its effect ledger, its CLI and its destination surface remain ZCode's; any change this lane needs inside `crates/bnrose-exec-*` is proposed to that owner on its PR or dispatch first and lands under its review, never as a parallel core.

**The seam, stated so the two owners cannot collide:**

| this lane owns | ZCode keeps |
|---|---|
| `surfaces/ant-pay.js` and `surfaces/bpay-invoice.js` boundary hooks (a durable-acknowledgement await before the first broadcast; recovery from a door, not only from a file) | `crates/bnrose-exec-core`, `-wasm`, `-host` (admission, state machine, journal, ledger, receipts, CLI, `dest-*`) |
| a new Rust **consumer** of the host crate (a loopback door that stores and replays the browser record through `journal::ReplicatedJournal` and `keys::SupervisorKeys`, both already public) | the record formats inside those crates, the event-code space `E_*`, `scripts/bnrose-rust-001/`, the lane workflow |
| `e2e/ant-replacement-recovery.mjs`, `e2e/ant-record-import.mjs` and their successors; the devnet lab under `tools/ant-testnet/` | the Cryptol twin, the grid, the cross-node harness |

## 2. The reading, reconciled (what each merged record establishes for THIS case, and what it does not)

| record | merged as | establishes | does not establish |
|---|---|---|---|
| #410 (head `49bd085941bab82ba8857a2024a66ebc65908b25`) | `ec7fed11f` 2026-10-15T10:18:07Z | the journal-before-broadcast discipline in the page; the record importer treating a record as evidence; cases 1–7 with case 7's lost branch named as THE OPEN CASE; the acknowledged persistence boundary = `localStorage.setItem` returning | any durability of that boundary (its own §5 says so, and §4 below measures it failing once at 12 s on this box today) |
| #411 BNROSE-RUST-001 | `f731b174f` 2026-10-13T23:30:54Z | a journal fsynced before the effect door; recovery from journal + ledger alone; UNKNOWN preserved; `tests/recovery.rs` crash-after-effect | anything about a browser, an EIP-1559 envelope, or an Arbitrum destination — its intents are WB001 envelopes, its effect is a digest row |
| #421 BNROSE-RUST-002 | `1692c2629` 2026-10-14T02:47:24Z | "durably acknowledged" DEFINED (SPEC-RUSTEOSVM-1 §2.4: fsync-complete on two independent stores before the effect door); `ReplicatedJournal` (ack only after every replica's fsync); the OS-atomic `supervisor.claim`; the replacement law | global exclusivity (its own boundary: local process exclusivity only) |
| #425 cross-node | `5c24bb044` 2026-10-14T05:30:49Z | two sovereigns independently ACCEPT the same intent; the destination's op-keyed idempotency is what prevents the double effect; the TEETH control lands two effects without it | anything for external chains: "External-chain destinations (Arbitrum/Hive adapters) carry this obligation destination-side; that wiring is a named follower, not claimed here" — the exact reason this lane reconciles against Arbitrum's own nonce, chain id and signed bytes and never against a local or Vaulta-side record |
| #427 cross-node procs | `1f163522a` 2026-10-14T08:05:50Z | `dest-apply` verifies the receipt before applying; crash between effect and receipt recovers and the replay is refused | an adversarial or consensus destination |
| #428 twin-grid | `7e653693c` 2026-10-14T09:50:13Z | Rust↔Cryptol sampled agreement on the replacement gate | SAW correspondence (its own boundary) |

**PR-head receipt for #410, preserved as counted** (GitHub check-runs API on `49bd0859…`, read at 10:33Z): **52 success / 8 skipped / 0 failing**. The eight skips are `rb01-psi`, `rb02-aes`, `rb03-budget`, `rb04-daedalus` (two runs each, path-filtered) and are not counted as passes. On the merge commit `ec7fed11f` at the same moment: 7 check-runs still `in_progress` (wallet, saw-ntt-dsa, saw-ntt, saw, node, meter, eternal), the rest success, none failing; `pages build and deployment` run `38719283050` completed success, updated 2026-10-15T10:20:02Z. **That is deployment-job evidence only.** No one has compared the bytes skaists.dev serves against `ec7fed11f`'s tree; served-wallet-byte verification stays a separate item (§7).

## 3. Lab state, observed (not reset, not stopped, not redeployed)

| fact | observed | at |
|---|---|---|
| `sh tools/ant-testnet/health.sh` from inside WSL | **9/9 ok, exit 0**: manifest at `127.0.0.1:25000`, network id `local-devnet-30444-2026-10-12T21:08:53.077667131+00:00`, chain 31337 on rpc port 43229 answering `0x7a69`, 10 private-address browser endpoints, ant-devnet pid 3756192 (rss 281136 kB), anvil pid 3756208 (rss 486492 kB) | 2026-10-15T10:32:36Z |
| process start (`ps -o lstart`, the guest's clock) | both `Mon Oct 12 17:56:31 2026`; elapsed `2-10:34:56` at 10:31Z | 2026-10-15T10:31:28Z |
| the running instance's environment | `ANVIL_IP_ADDR=0.0.0.0` (it predates `start.sh`'s loopback binding; the dispatch's §3 recorded this instance as `0.0.0.0:43229` and it still is), cwd = the predecessor worktree `.claude/worktrees/bnr-settlement-adapter-03c61e`; `~/ant-testnet/data` does **not** exist (this instance predates that convention); `~/ant-testnet/devnet.log` 48.7 MB | 2026-10-15T10:31:28Z |
| listening | UDP 30454–30463 on `0.0.0.0` (the browser nodes); the host-side `wslrelay` loopback forwarding measured in `ant-testnet-confinement-2026-10-12.json` was not re-measured here | 2026-10-15T10:32:36Z |

Commands, as the kit has them: health = `sh health.sh` run inside WSL from `tools/ant-testnet/`; stop = `sh stop.sh` there — **destructive**: it discards the chain and node state, and a new `start.sh` is a new network with a new id. Nothing of this lane's recovery evidence may be collected across a stop; every recovery case runs against the running network.

## 4. Current-main baseline, with the real browser handler and the existing crash fixtures (this worktree, `ec7fed11f`, Windows host, Playwright Chromium from `e2e/node_modules`)

Run 1, `node e2e/ant-replacement-recovery.mjs`, 10:38:40Z → 10:39:49Z, exit 1:

```
ok   1. same-context page restart after a lost receipt response: resumed from the journal, no second payment, no second press
ok   2. saved-record replacement: the record saved before the browser was lost resumed on a replacement client with no payment and no press
ok   3. already-stored, no-payment reuse: a stranger's client stores the file and pays nothing
ok   4. lost submission acknowledgement: the kept hash was found on the chain; no second payment, no second press
AssertionError [ERR_ASSERTION]: the journal survived the killed process on disk (12 s after the write)
    at file:///…/e2e/ant-replacement-recovery.mjs:328:12   actual: false  expected: true
```

**Case 5 — SIGKILL 12 s after the acknowledged `localStorage` write — FAILED in this sample: the journal did not survive.** Cases 6 and 7 did not run in this sample because the suite stops at the first assertion. Guest load average at the time: 8.7 (other seats building).

Run 2, the same command, 10:41:35Z → 10:42:43Z, exit 0: all seven cases pass; case 5 survived this time; case 6 printed "the journal did not survive the kill" (nothing sent was lost; a fresh invoice offered, 2 planned, nothing paid); case 7 printed its lost branch — "the journal did NOT survive on this box — the chain holds the payment, the browser does not know it; resume offered a NEW invoice (2 planned) and paid nothing without a press. This is the OPEN case".

**Reading, preserved not manufactured:** #410's dispatch recorded on 2026-10-13 that "3 s after the write was not enough … 12 s was"; today 12 s was not enough in one of two samples. The 12 s figure was always a measurement, never a durability claim, and it is now shown to be **nondeterministic on the same box**. That is the mission's premise made concrete: no delay after `setItem` is a durability boundary, and the fix is a boundary hook that awaits an acknowledgement from a store whose fsync *is* the acknowledgement, not a longer sleep. Case 7's lost branch reproduced in the sample that reached it, as the handoff said it would.

Run 1, `node e2e/ant-record-import.mjs`, 10:39:49Z → 10:41:08Z, exit 0: 5/5 (`conflicting quote ownership refused`; `write failure after the journal write: failure-atomic`; `12 malformed or inconsistent records refused`; `concurrent purchase refuses the import`; `asserted confirmed, chain unaware, window shut: UNKNOWN on resume; no send, no press, exposure held`).

The Rust lane's own baseline is read from CI, not re-run here: `BNROSE-RUST-001` run `38719284449` on `ec7fed11f` completed success at 10:21:54Z (battery, teeth, recovery demo, cross-node demo, bench).

## 5. The open case, defined precisely

**What is lost:** the browser process, its profile, every `localStorage` key (`bnr.ant.purchase*.v1:<sha>`, `bnr.ant.quote-claims*.v1`), every open page, and any in-memory callback — before any record was saved by hand.

**What must survive, and where (the recovery authority):**

| survives | where | why it is enough / not enough |
|---|---|---|
| the operation binding: plan `id`, `binding`, `scope`, `payer`, `authorization{invoice,scope,payer,expiresAt,gasCeilingWei,artifactSha256,at}`, every payment's `quote_hash`/`rewards_address`/`amount_atto` | a BNRoSe state directory on this host: `journal::ReplicatedJournal` over two stores, fsync-all-before-ack, under `keys::SupervisorKeys` (journal MAC + Ed25519 receipt key), claimed exclusively by `supervisor.claim` | the record a replacement browser needs to re-offer the identical kept envelope or to reconcile — the same fields the importer already validates whole |
| per transaction: `raw` (signed type-2 bytes), `hash`, `nonce`, `to`, `data`, `gas`, `maxFeePerGas`, `reservedWei`, `state` | the same journal, appended **before** `eth_sendRawTransaction` and acknowledged (fsynced on both stores) before the send is allowed | reconciliation from Arbitrum by hash and by payer nonce (today's `observe`) needs nothing else |
| the upload checkpoint and, after it exists, the retrieval reference | the same journal | resume of the upload after the payment |
| the source bytes | **not** in the journal by default. Either the person re-chooses the same file (the importer already refuses a file whose sha differs) or the door is asked to retain the bytes (measured as bytes written) | a payment hash cannot reconstruct a destroyed file; when the bytes are gone and not retained, the status stays **paid, incomplete** and nothing re-pays |
| the keychain / the payer's key | the keychain origin (the isolated keychain or the page's own on devnet) — **outside this lane** | recovery grants no key; a replacement browser that cannot sign can still reconcile and still must not re-pay |

**Not claimed:** recovery after destruction of the state directory and both of its replicas; cross-device recovery (the door is loopback on one host — moving the state directory is the custody transfer #421 already defines, `E_MIGRATION`, and is ZCode's); any claim that a record on this host or on Vaulta prevents a second payment on Arbitrum. Duplicate-effect prevention on Arbitrum is the destination's: chain id, nonce and calldata bound in the signature, which is why identical bytes can only ever run once and why a replacement browser reconciles by nonce before it is allowed to offer anything.

## 6. The seam, proposed (not built in this dispatch)

1. **Boundary hook in the page**: `AntPay.createHosted` grows an optional `durable` participant; the payer awaits `durable.ack(record)` after `t.raw`/`t.hash` are saved and **before** `rpc('eth_sendRawTransaction')`, and again after `submitted`; an absent or refused acknowledgement refuses the broadcast by name (nothing sent), it never falls back to `localStorage` alone silently. The existing JS state machine is reused, not duplicated; the record is `bpay.ant.journal/1` unchanged.
2. **A loopback door in Rust**, a new consumer crate of `bnrose-exec-host`: it opens a `ReplicatedJournal` at its own state directory under a `supervisor.claim`, appends the record as one chained, replicated, fsynced event and answers with the journal head tag only after `ReplicatedJournal::append` returns (that is the SPEC-RUSTEOSVM-1 §2.4 acknowledgement, structurally); it serves the replacement browser the latest record for an artifact sha so the importer's existing `checkedRecord` path installs it as evidence. The door's event code lives in the door's own file, not in the core's `E_*` space; if a shared code is wanted, that is a one-line proposal to ZCode.
3. **Destination reconciliation** stays where it is: `observe` reads Arbitrum (or the devnet chain) by hash and by payer nonce; UNKNOWN stays UNKNOWN with the reservation and the quote claim held.
4. **Qualification** extends the existing suites, one new file beside them, driving the real handler through the real door: crash immediately after the acknowledged write (today's case 7, now expected to resume), crash between ack and broadcast, lost submission ack, paid-but-incomplete upload with profile deletion, replacement browser with empty storage recovering from the door with no file export, two browsers racing the same recovery, a tampered/stale/unavailable door, and the negative control (door bypassed → today's lost branch). Measured: ack latency, recovery latency, bytes written, peak memory, destination payment count (from the chain, never from a model). Process-crash, browser-loss, node-loss and power-loss evidence stay separate columns; power loss is **untested** unless a real power event is staged.

## 7. Separate ownership and evidence (not this lane's)

- **Production keychain redeploy** (`keys.skaists.dev` predates the pin announcement): kc/integrate.
- **Hosting `keys-devnet.skaists.dev`** (route-served in automation, no DNS): a founder-level DNS/Pages step.
- **Mainnet acceptance** of the bounded real-network purchase: its own funding and spending authority and the founder's gesture.
- **Served-wallet-byte verification** of `ec7fed11f` on skaists.dev: not done by anyone as of this dispatch; the Pages deployment at 10:20:02Z is a job result.
- **Rust core changes**: ZCode (`zcode/bnrose-*`).
- **DNS-independent resolution and verified launch**: the integration lead named in `docs/dispatches/2026-10-13-bnr-dns-independence-routing.md`.
- **The predecessor worktree** `.claude/worktrees/bnr-settlement-adapter-03c61e` (branch `claude-LoVis/ant-purchasing-devnet-54711d`, at `49bd08594`, merged): one untracked directory `tools/agent20-ux-shots/` (register screenshots, never committed). Left as is.

## 8. What this dispatch does not claim

No recovery path exists yet from a BNRoSe state directory to a replacement browser; the OPEN case is still OPEN. The baseline above is one host, one day, two samples. Nothing was stopped, started, deleted or redeployed. No key material appears anywhere in this record.
