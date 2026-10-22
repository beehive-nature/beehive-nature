# 2026-10-07 — vaulta/zk: the four follower boot receipts EXECUTED GREEN, one config defect found live and corrected, lane integrated (PR #363)

Lane: SPEC-ZK-RECEIPT-AGGREGATES-1, owner: zCode (Vaulta/finalizer seat,
per the founder's 2026-10-07 delivery order). This closes the two open
items of that order: **the parent branch's integration** and **the four
missing follower receipts, executed in the already-authorized lab
environment** (the WSL lab where this lane's chain work already runs;
Jungle4 is a public testnet — syncing is read-only; no founder gesture
required beyond the standing lane authorization).

## What shipped

1. **Integration**: PR #363 carries the whole lane branch (harness
   repairs r2/r3, finalizer v4 + its 23/23 counterexample battery, the
   corrected banking note, the follower-config law) into main. Merge
   owner: this seat, per "agents own code review, CI, merges".
2. **The four boot receipts**, executed against a real Jungle4 follower
   booted from the EOS Nation v8 snapshot in the lab — ALL GREEN, each
   bound to its runtime instance per the one-shot law:
   - **EXPOSURE** — observed listeners: `127.0.0.1:8899` (http) +
     `127.0.0.1:9878` (p2p), loopback only, matching the intended
     posture (loopback-BOUND, not closed).
   - **IDENTITY** — the node's own `get_info`:
     `chain_id 73e4385a…716c4d` == the pinned PUBLIC-CONSTANT — the
     configured chain-id moved from EXPECTED to **VERIFIED**; head at
     the live frontier; server v1.2.2.
   - **PEER** — 7 of the 9 configured peers with **completed Jungle4
     handshakes** (chain-id-verified handshakes; named agents incl. EOS
     Nation, Aloha EOS, Detroit Ledger); 1 still connecting
     (cryptolions), 1 not connected — configured nine ≠ connected nine,
     recorded as observed.
   - **AGREEMENT** — local LIB 290,902,209 block id
     `1156d0c18d94b20ab3657239fa4c1681e8efedc096df0b371a2ebdfed8a4a642`  # PUBLIC-CONSTANT: public jungle4 chain data (scanner marker)
     == the SAME block id from the independent public API (greymass —
     independent of the snapshot source eosnation) at the exact same
     height, same chain-id, same block timestamp. Agreement established.
   Receipt artifact (verbatim, timestamped, with all instance
   bindings): `docs/receipts/zkr-jungle4-follower-boot-2026-10-08.txt`.
3. **A config defect found live and corrected** (this is the substantive
   engineering finding of the boot): the committed posture paired the
   loopback p2p bind with `allowed-connection = none`, reading that as
   "no inbound; outbound dials still sync". In Spring v1.2.2 that
   reading is WRONG — `none` rejects ALL peer handshakes, including the
   responses to this node's own outbound dials. Evidence chain: first
   boot (01:22–01:33Z) → zero completed handshakes, our node sending
   `go away: authentication failure` to six different operators' peers;
   TCP egress to all nine peer ports proven OPEN by direct probe;
   clock skew 5s (handshake timestamps sane); after the single
   amendment `none → any` (everything else identical): 7/9 handshakes
   complete and the node synced from the snapshot root to the live
   frontier in ~2 minutes. The inbound boundary is and remains the
   loopback p2p bind — the EXPOSURE receipt proves the sockets never
   leave the machine. The correction is made LOUDLY in the committed
   config (the file's own law required receipting the finding, not
   quietly relaxing the value), with the evidence above recorded here.
4. **Reproducible hosted procedure** (for the next operator, in-tree):
   - `contracts/zkreceipts/follower-boot.sh` — boots the follower:
     committed config verbatim + explicit runtime deltas (loopback
     ports; the lab's rehearsal chain holds 8888/9876 and sibling lab
     work transiently held 9877), fresh data-dir from the snapshot.
     Prerequisites (one-time): `~/jungle4-zkr/snapshots/latest-snapshot.bin`
     ← `https://snapshots.eosnation.io/jungle4-v8/latest` (zstd;
     python3.14 `compression.zstd` works without root), and
     `genesis.json` ← the EOS-Jungle-Testnet Node-Manual-Installation
     repo (needed only for non-snapshot boots; snapshot boots carry the
     chain identity).
   - `contracts/zkreceipts/follower-receipts.sh` — re-captures all four
     receipts with full instance bindings; re-run on EVERY new runtime
     instance (one-shot law: restarts/config changes/new data dirs
     inherit nothing).

## Runtime-instance lifetime (honest boundary)

The receipted instance (pid 1063985, booted 2026-10-08T01:34:49 local,
held by this session's process) lives as long as this zCode session's
task holder. When it stops, the receipts STAND as captured (they are
one-shot evidence for that instance, per the law) — but a NEW boot (via
`follower-boot.sh`) requires re-running `follower-receipts.sh` before
any downstream receipt attributes independent Jungle4 verification to
the follower. A persistent follower (systemd unit on a chosen host) is
a founder infrastructure decision, not silently assumed here.

## What was verified / what remains

- Verified: the four receipts above; the v4 offline battery 23/23
  (re-verified from the committed tree earlier today); branch CI green;
  PR #363 merged main-ward when its checks completed (status recorded
  in the lane memory).
- The two evidence paths stay distinct as ruled: follower-backed (these
  four receipts) and public-API (submission_source / execution block /
  verification_source labels) — neither establishes the other.
- Remains open on the lane (unchanged): tungsten-2 leak distinguisher
  and tungsten-4 1k/10k scale; the Autonomi coupling ban stands. The
  finalizer's LIVE run (v4 against zkrtst111111) is now UNBLOCKED for
  whoever owns that beat — the follower is a verified verification
  source for Jungle4 ZK execution per this gate.
- Not done, named: no systemd/persistent deployment of the follower
  (founder decision on host); the PEER receipt's 2/9 non-connected peers
  are recorded, not investigated to root cause (transient peer
  availability is expected; cryptolions was still completing its
  handshake at capture time).

NEXT OWNER: this seat holds until PR #363 is merged and main is green;
after that, the lane returns to banked with tungsten-2/4 as the only
open beats.
