# 2026-10-12 — WB004 jungle-live: the website-independent multisig lifecycle proven on Jungle4, every control a real chain refusal

Lane: `zcode/wb004-jungle-live-2026-10-12` (worktree `wt-zcode-wb004live`,
from origin/main `4e9d44744`). Order: founder 2026-10-12 — "prove the
website-independent Jungle path, not build another multisig system": one
bounded, harmless lifecycle under valid delegated authority, approvals bound
to exact bytes, the ordered negative controls, recovery with every prior
client unavailable, and a precise statement of how BNR authorization becomes
enforceable Antelope authority.

## 0 · Reconciliation before labor

- PR **#378** (SETTLE bridge, model scale) remains OPEN, all checks green
  except the `eternal` job — the known bDroP blocker; bDroP v3 landed on
  main only today (`4e9d44744`), so #378's cure is a rebase/rerun owned by
  **its** owner. This lane did not touch the bridge, its branch, or its
  models; no duplication.
- WB004 (time-extinction, 10-09) and BZDID-002 (10-10/11, merged `ae4a554cd`)
  read for their boundaries: both explicitly model-scale, "no live Vaulta /
  Antelope settlement". This lane is that named-open live leg, under WB004's
  own L1-L4 laws.
- The shared checkout's `main` ref was 455 behind origin; all reading was
  done from `origin/main` git objects; this lane's worktree was cut fresh.

## 1 · The deployed chain, verified (not assumed from the specimen)

- Chain id `73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d` — PUBLIC-CONSTANT Jungle4 chain id, pinned before any signing (the 2026-09-08 custody law), equal on CryptoLions and Greymass at every read.
- Deployed `eosio.msig` wasm `get_code_hash` = `afbc51b5fd8a63c7a9938b7ef953c55259d3224d7460f22808a04e09d9250eed` — PUBLIC-CONSTANT deployed code hash at run time (2026-10-12T21:00Z era). Its ABI carries `approve` with `proposal_hash:checksum256$` (binary extension) and the `invalidate` action; the deployed contract writes the newer `approvals2` + `invals` tables. Byte-equivalence to the vendored `c526479a` specimen is NOT claimed (no wasm build here); instead the behavior itself was probed live — every negative control below is a behavioral probe of the deployed code, and two of its behaviors diverge in practice from a naive reading of the reference (§4).
- Zero-push codec arbitration before any transaction: 5/5 then 6/6 real
  historical transactions satisfy `transaction_id = sha256(packed_trx)` under
  my packing convention; and after the signing fix, **4/4 recovered signers
  of unrelated real chain transactions match their accounts' on-chain keys**
  (`probe-sig-layout.mjs`) — the digest construction and signature wire
  format proven against chain-produced bytes before this lane pushed
  anything.

## 2 · Authority and custody

- Dedicated test authority only: `bzcodejungle` (this seat's Jungle4
  account). Keys loaded from CurrentUser DPAPI through in-memory pipes;
  plaintext never printed, never on disk (shape refused by length/charset
  assertion in the loader). Re-derived public keys MATCH `public.json`
  (both `EOS…` legacy and `PUB_K1_…` encodings — which also anchored the
  base58/K1-checksum code against real vectors).
- A delegated permission `wbfoursignr` (parent `active`, threshold 1, fresh
  key **K2**) was created by `updateauth` and bounded by `linkauth` to
  exactly: `eosio.msig::approve`, `eosio.msig::unapprove`,
  `eosio.token::transfer`. K2 rotated to **K3** mid-lane (both generations
  DPAPI at rest in the same custody directory). This IS the bounded
  delegated authority the order asked for — least privilege enforced by the
  chain, not by convention.
- Resources self-served from the account's own balance (`delegatebw` ×2,
  `buyrambytes`); no founder gesture was needed or used anywhere in this
  lane.

## 3 · The lifecycle (all block-verified; ids below are PUBLIC-CONSTANT on-chain trx ids)

Propose → approve (hash-bound) → withdraw → exec refused → re-approve →
**exec executed** → duplicate refused, on proposal `wb4qjddz`:
`713a7ebfac619030fb9672374234d0802fde59a609770f068589fee421fc0f03` (propose, block 291734300) — PUBLIC-CONSTANT on-chain trx id
`4716c10cb24d53d4fe7486ffde96d246029631762165cebf0ddacc9293d1383b` (hash-bound approve, block 291734378) — PUBLIC-CONSTANT on-chain trx id
`76f22de1591dfd21596074a13687a58b1a0abb16735b2c045fbe302df121ac9c` (unapprove, block 291734473) — PUBLIC-CONSTANT on-chain trx id
`91d9f2e0e3bc0cb13422f59f3bdbfbb6e6338d6c1dc444b230dc89ae9598a1cd` (re-approve, block 291734479) — PUBLIC-CONSTANT on-chain trx id
`30b68fdf8a178d3ace2ef3fdf64d04c791c23c10749001a3f272113f806dffb3` (**exec**, block 291734484, irreversible; Greymass serves the same block id with the same executed transaction) — PUBLIC-CONSTANT on-chain trx id

Delayed execution (`wb4xoqbu`, `delay_sec` 60): "too early to execute"
refused before the window; executed after it —
`7c532e3906212f70e70d35a819854c3a225ea23409045178ca50ef2a37f91ff6` — PUBLIC-CONSTANT on-chain trx id

Rotation semantics (`wb4hufys` / `wb4onuwc`): after `updateauth` K2→K3 the
stale K2 signature is refused by nodeos itself; **exec of the
pre-rotation approval SUCCEEDS** — key rotation does NOT withdraw stored
approvals (they are permission levels, not keys) —
`e18ad0c1e9a62e8b954ebbfb008c33ef19710d64d967496d1c7b698ac040519b` — PUBLIC-CONSTANT on-chain trx id; while `invalidate` DOES kill earlier
approvals at exec time (exec refused "transaction authorization failed",
cancelled clean) —
`8fa01a7abc72e969b934688925278ee445f40993f6b487547d9595d98e87ccd1` — PUBLIC-CONSTANT on-chain trx id

Inner action everywhere: 0.0001 EOS to `junglefaucet` (verifiable, harmless,
executed inline). Full timeline, per-transaction blocks, and the
approvals-table states are in the committed
`scripts/btungsten/wb004-live/receipt-wb004-live.json` + `state.json`
(generator-owned public-chain-data JSON; secret-scan exemption on the
wb001-bridge.json basis, documented in scripts/secret-scan.sh).

## 4 · Negative controls — each a real chain refusal, message verbatim

| Control | Chain's own refusal |
|---|---|
| approve with wrong proposal_hash | `hash mismatch` (deployed assert_sha256 binding — exact-bytes approval works) |
| exec with approval withdrawn | `transaction authorization failed` |
| duplicate exec | refused (message state-dependent through node lag, §5) |
| exec inside the delay window | `too early to execute` |
| propose with past expiration | `transaction expired` |
| exec after expiration | `transaction expired` |
| approve at a level not requested | `approval is not on the list of requested approvals` |
| requested (child) cannot satisfy declared (active) at propose | `transaction authorization failed` |
| stale key after rotation | `transaction declares authority … but does not have signatures for it` |
| exec after invalidate | `transaction authorization failed` |
| duplicate push of identical signed bytes | `duplicate transaction e911d348…` (the id itself is the reconciliation) — PUBLIC-CONSTANT on-chain trx id |

## 5 · The deployed-code and endpoint findings (reclassified, not buried)

Per the corrective-receipt law, three run-time surprises were investigated
to root cause and reclassified:

1. **The link law.** A delegated permission not `linkauth`'d to an action
   class makes `propose` refuse ("transaction authorization failed") for
   inner transactions declaring it — `check_transaction_authorization`
   enforces permission→action links for the DECLARED inner authorizations,
   not only for the outer push. Least privilege is real and bites at the
   proposal door. (Fixed by linking `transfer`; `unapprove` needed its own
   link too.)
2. **The self-transfer refusal.** Jungle4's deployed `eosio.token` refuses
   self-transfers ("cannot transfer to self") — the first P1 build used a
   self-transfer and could never execute; rebuilt with the faucet
   recipient. The same refusal, surfacing through an exec whose approval
   was still live on a lagging node, briefly masqueraded as an auth-check
   divergence; a controlled discriminator (never-approved proposal with a
   clean inner action) proved the deployed exec DOES gate on stored
   approvals, and a later exec reproduced the proper refusal. The chain
   was right both times; my runner was racing.
3. **The phantom acceptance / re-proposed instance.** The CryptoLions
   endpoint load-balances across nodes that can lag and briefly diverge:
   observed (all recorded in state.json): TAPOS refusals naming the node's
   own head ("Is this transaction from a different fork?"), a refusal
   ("no approval previously granted") that contradicted live state on both
   providers, and one "accepted" duplicate exec (`237aabde…`, block
   291734700) that was NOT a phantom and NOT a duplicate-of-instance: my
   own lagging-read-driven retries had RE-PROPOSED the same name twice
   (blocks 291734646, 291734712), and 237aabde legitimately executed the
   second instance. Exactly-once held per instance; my bookkeeping had
   wrongly assumed one instance. The cure now in the runner: every
   acceptance is block-inclusion verified before it counts (a real phantom
   is repushed; an un-includable acceptance fails the run), and resumes
   key off block-verified transaction ids, never off table reads. Final
   state was swept: all leftover instances cancelled, proposal scope clean.

The duplicate-push control in §4 is therefore honest in the strongest
form available on a shared testnet through a load-balanced endpoint: the
chain refuses the identical bytes by naming the transaction id, and the
receipt's acceptance evidence is block inclusion, dual-provider, at LIB.

## 6 · Cold recovery — MSIG.app / browser / coordinator unavailable

`cold-recover.mjs`, a fresh process, from ONLY the public receipt + public
RPC: all 31 accepted transactions located in real blocks with status
`executed`; the P1 exec irreversible (LIB ≥ block); block-id EQUAL across
CryptoLions and Greymass with the exec present in Greymass's copy of the
block; the delegated permission present with the post-rotation K3 key and
exactly the three links; the proposal scope swept. It prints the rebuilt
timeline purely from block data — the replacement-worker proof. **No
client, coordinator, or website is on the critical path.** MSIG.app URLs
for each proposal are carried in the receipt as the optional public view
(`https://msig.app/jungle/bzcodejungle/<name>`); nothing in the lane
depends on it.

## 7 · How BNR authorization becomes enforceable Antelope authority (the required precision)

- **What is enforceable today, and it is the chain that enforces it:** the
  Antelope permission model. BNR's policy-checked agent acts under a
  dedicated on-chain permission whose authority is exactly what the chain
  validates: `updateauth` defines it, `linkauth` bounds its action surface,
  `require_auth` gates every msig entry point, `check_transaction_authorization`
  at propose demands the requested approval set satisfy the inner declared
  authorizations (including link constraints), exec re-checks the stored
  approval set against the same inner bytes, `assert_sha256` binds each
  approval to the exact packed transaction when `proposal_hash` is
  supplied, and rotation/invalidation semantics are as measured above. In
  this construction **BNR validates, Antelope enforces what BNR's delegated
  key holds** — and the enforcement is sound by construction because it is
  the chain's own code path, exercised live by this lane.
- **What does NOT exist on Jungle4, named plainly:** any on-chain verifier
  of a BNR aggregate, proof, or ML-DSA envelope. `eosio.msig` verifies
  Antelope transaction authorization only (source: the vendored
  `eosio.msig.cpp` exec → `trx_is_authorized` → the
  `check_transaction_authorization` intrinsic; behavior confirmed against
  the deployed wasm). A policy-checked agent remains a policy-checked
  agent; calling a modeled approval an aggregate creates no on-chain
  enforcement. Upgrading the bridge means deploying a verifier contract
  whose authority the msig requested-approvals then reference — a new
  contract lane. The real aggregation cryptography stays routed to RB05;
  the SETTLE bridge at model scale stays with #378's owner.
- **Authority continuity (WB004 L1/L2 at execution scale):** continuity
  lives in the permission tree plus `invalidate()`/re-approval, not in any
  original key — proven live by the K2→K3 rotation. No millennium-length
  proposal was created (L2); the execution layer stayed a bounded,
  single-digit approval set (L3); the 2106 representation boundary is
  untouched by this lane and remains WB004's named open live-leg check (L4).

## 8 · Engineering notes (cited, for whoever signs next)

Three wire laws had to be read at the source before Jungle4 would accept a
signature — each is cited inline in `keys.mjs`:
`fc/src/crypto/elliptic_secp256k1.cpp:141-156` (the K1 payload is
`[v, r, s]` with `v = 27+recid(+4 compressed)` ∈ 31..34, else exactly
"unable to reconstruct public key from signature");
`fc/src/crypto/elliptic_common.cpp:152-157` (the canonical law: r and s
lead bytes < 0x80, and a zero lead byte must be followed by ≥ 0x80 — noble
does not enforce it; re-sign with extra entropy until canonical); and
noble v2's `sign()` prehashes by default (our digest is already
`sha256(chain_id ‖ packed_trx ‖ 32 zero bytes)` per Leap's
`transaction.cpp:47-57`, so `prehash: false` is mandatory). The account
custody file is a JSON wrapper of per-permission HEX-encoded DPAPI blobs
whose plaintext is a UTF-16LE bare WIF (shape-asserted, never printed).

## 9 · Receipts

- Offline: `node selftest.mjs` GREEN (LEB128 vectors, name laws, TAPOS,
  base58 round-trips + the account's real pubkey encodings).
- Live: staged run `state.json` (41 recorded steps, every refusal with the
  chain's verbatim message, every acceptance block-inclusion verified);
  final `receipt-wb004-live.json`; cold recovery GREEN (31/31 located,
  dual-provider, LIB, permission/links/scope verified).
- Deployed-code identity: code hash + ABI fields recorded (§1).
- CI: this lane adds no workflow surface; the secret-scan exemption for
  the lane's generator-owned JSON follows the wb001-bridge.json precedent
  and is documented in scripts/secret-scan.sh itself.

## 10 · What is NOT claimed

- No equivalence proof between the deployed Jungle4 wasm and the vendored
  `c526479a` reference (behavior probes only; a build-and-hash comparison
  is a cheap next owner item).
- No multi-party quorum was exercised (a single account's delegated
  permission with threshold 1; the m-of-n path is exercised in WB004's
  model and by the shared testnet's other live msig traffic observed
  during the run — `ikbiwgjaz.gm/h1repro` executed propose→approve→exec in
  the same window).
- No on-chain BNR-proof verifier, no funds moved except the account's own
  resource purchases and 0.0001-EOS faucet donations, no production
  authority, no mainnet anything.
- The stronger independent witness (our own follower node on the box,
  re-running the vaulta/zk hardened config) was not run; two independent
  public providers plus local recomputation is the line this lane claims.

## NEXT OWNER

- The follower-node witness leg (box, ops/ precedent) if a second-source
  beyond two public providers is wanted.
- The deployed-vs-vendored wasm hash comparison (needs eosio.cdt build).
- PR #378 rebase/rerun after bDroP v3 (its owner).
- The post-2106 live-leg check (WB004 L4's named open item) if Jungle4
  ever runs a chain-time helper; otherwise it stays a model+spec boundary.

HUMAN INTERACTION: NONE.

## Post-run note (same session)

- While reproducing the inherited static red locally, a `git stash pop` in
  this lane's worktree accidentally popped the CODEX seat's bpay-rail WIP
  stash (shared stash stack across worktrees). Detected immediately,
  discarded from this worktree with a hard reset to this lane's own pushed
  commit; the codex stash itself is INTACT (pop-on-conflict preserves it)
  and nothing of theirs was modified or dropped. The same accident and
  recovery has precedent (stash@{1}'s own message). Noted here per the
  corrective-receipt law: named, contained, no silent anything.
- The inherited static red ("Surface directory needs regeneration") was
  located at main's own tip (83775b5ec modified bdrop surfaces without
  regenerating; a7d0989f2 was the same cure for the prior round) and cured
  as a one-line descendant rider in this PR (surfaces/stack.html).
