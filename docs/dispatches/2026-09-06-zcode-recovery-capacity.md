# G1 recovery + capacity — verified inventory, preserved restart artifact, fence reserve restored (2026-09-06/07)

Issue [#4](https://github.com/beehive-nature/beehive-nature/issues/4). Owner:
zCode (GLM-5.3, fresh session, worktree `wt-zcode-g1`, branch
`lane/g1-recovery`). Astra owns parallel analysis; no competing writer in
this lane. All box work rode `ssh oracle` (one canonical transport); the
tunnel helper stayed DOWN throughout G1 (exercised and receipted in the
[G0 evidence dispatch](2026-09-07-zcode-g0-voice-evidence.md)).

## 0. The change/reason/rollback receipt (written BEFORE any mutation)

Every production mutation of this session, decided in advance:

| # | change | reason | rollback |
|---|---|---|---|
| 1 | `docker rmi rust:1.95-bookworm caddy:2-builder caddy:2-alpine alpine curlimages/curl busybox` | unused image set — no container references them (verified `docker ps -a` image set vs `docker images`); reproducible, re-pullable; ~2.6 G | `docker pull <ref>` — full list kept here; rust:1.95-bookworm is the fork-rebuild image, its re-pull is part of the rebuild recipe |
| 2 | `journalctl --vacuum-size=300M` | archived journals are rebuildable log history, not recovery material; 1.36 G → 300 M recent kept | none (rotated logs are gone) — accepted, stated here |
| 3 | `rm -rf /home/ubuntu/.npm/_cacache /root/.npm/_cacache /home/ubuntu/.cache/pnpm /home/ubuntu/.cache/pip /home/ubuntu/.cache/node-gyp` | package-manager caches repopulate on next use; ~740 M | automatic regeneration |
| 4 | `apt-get clean` + `rm -rf /var/lib/apt/lists/*` | apt lists regenerate on `apt-get update`; ~500 M | `apt-get update` |
| 5 | `rm -rf /home/ubuntu/src/target` (LAST, only after §2 verification) | build tree is a reproducible artifact: repo `skaists/buzz` @ `088a677f88737aa42af4d6d790bd2dfe8373e835` intact, `rustc 1.98.0` on box; the live process's exe was ALREADY deleted from this tree — its bytes are preserved+verified off-volume (§2) | rebuild: `cargo build` in `~/src` (recipe §5); exact-image restore possible from the preserved copy |
| 6 | `systemctl start buzz-bitcoind` (AFTER space restored) | root cause diagnosed: `No space left on device` LevelDB IO error 2026-09-04T12:21Z (§6); with reserve restored a start is the recovery, not a blind restart; no reindex/delete/flag changes | `systemctl stop buzz-bitcoind` returns the SERVICE to stopped — it does not undo bitcoind's own pruning/catch-up writes; no data-level rollback exists without an external datadir copy, and none was taken (wording corrected in §8) |

NOT touched, with reasons: bitcoin datadir (5.9 G authoritative — preservation
record §6), ant fence `/mnt/ant-store` + its 6 G loop image (the fence itself),
`/opt/buzz` (prod fork binary bind-mounted into `buzz-prod-relay-1`),
`/opt/buzz-bclaude` (ACTIVE build tree — `buzz-acp` runs from it, exe NOT
deleted), `/opt/buzz-compute` models, docker volumes (both hives' git-data +
Alby Hub LND state — funds-adjacent authoritative), `vending-probe` (restart
dependency UNKNOWN — explicit, stays), `.rustup`/`.cargo` (the rebuild path).

## 1. Fresh census + machine-readable inventory

`scripts/ops/recovery-inventory.py` (this commit) — read-only, declared-roots
only, secret-free by structure (secret-reference entries carry
location/permissions/recovery owner ONLY; contents never read; a guard
withholds output and exits 3 if sensitive markers appear), fail-closed
statuses. Fixture tests `e2e/recovery-inventory.test.sh`: missing/unknown
recovery dependency, deleted-exe-under-build-tree, reserve breach,
secret-free output, guard withholding — ALL PASS (CI lane: `tests.yml`).

Before-state (2026-09-07T03:38Z): `/dev/sda1` 45 G, 41 G used, **3.5 G free
(93%)**; fence law `ops/ant-node/fence.md` requires ≥ 10 G. Failed units:
`buzz-bitcoind.service` (+postfix, pre-existing). The ant stack alive
(node-2 in the fence, antd bridge, CLI daemon). Live process **pid 3832163
`buzz-relay` running the DELETED binary
`/home/ubuntu/src/target/debug/buzz-relay`** since 2026-09-04 09:30 (PPid 1,
dev ports 3315–3317) — the exact restart-path trap the issue named.

Full machine-readable snapshots (15 roots, footprints, digests, statuses,
deleted-exe scan, reserve check), pre- AND post-repair, plus the exact
config: committed at `fixtures/recovery-inventory/
box-2026-09-07-pre-repair.json`, `box-2026-09-07-post-repair.json`,
`box-config-2026-09-07.json` (hex-exempt fixtures dir).
Digests recorded there include `bitcoind`, the deployed prod fork binary
`/opt/buzz/buzz-relay-join` (bind-mounted into the prod relay — the restart
artifact), `buzz-acp`, ant-node, antd, ant CLI, and the voice door sources
(parity already proven at full-hash width in the G0 evidence dispatch).
Exit code 2 with attention: `dev-relay-build` (active-deleted-executable)
and `/` (reserve-breach −7.05 G). Six OS-upgrade deleted exes (logind,
python3.12, agetty×2, tee, gpg-agent) recorded as system-upgrade class,
outside declared roots.

Classifications (docket's four): authoritative-state — bitcoin chainstate,
ant-node fence, docker volumes, wallet-relay home; reproducible-artifact —
dev build tree, prod fork source+binary, bclaude tree, compute models,
containerd image store, ant CLI home, antd lane, vending-probe;
rebuildable-index-cache — systemd journal; secret-reference — x0x identity
(location/permissions/recovery owner only).

## 2. Preservation + verification (BEFORE deletion)

Off-volume destination: the laptop (separate machine/disk),
`C:\Users\travi\box-recovery\2026-09-07-g1\`. Streamed over SSH; no box-side
temp copy was made (no added pressure). sha256 verified BOTH sides:

- deleted dev-relay exe via `/proc/3832163/exe`: 237,588,768 bytes, sha256
  `c332c34cb2256c896ea84bb24eb3f1d5312f51819cc5a4aeafa02c03882f1df7` PUBLIC-CONSTANT: preserved restart artifact, laptop == box
- untracked (never-committed) fork scripts, laptop == box:
  `web/agent-claim.mjs` `064776606e8b50dc0426f6c932ca8be17129d10da3169585384fe03292869163` PUBLIC-CONSTANT: preserved untracked script
  `web/agent-profile.mjs` `5dca06dfd63e7670d286af3002336cc800a11c999e51fa9a4209ce6e4485b98e` PUBLIC-CONSTANT: preserved untracked script
  `web/join-event-publish.mjs` `9d4b232aba2ef0ea09bbfed63cd4ae753d985b9392a91cc94157ffc9b5783eee` PUBLIC-CONSTANT: preserved untracked script

The bundle also holds the inventory config + raw output. Retrieval verified
by hash comparison — the precondition of receipt §0 item 5.

## 3. Capacity repair — executed (2026-09-07T03:5x–04:0xZ)

Free space on `/` after each receipt item (bytes, `df -B1`):

| step | free after | delta |
|---|---|---|
| start (census) | 3,686,125,568 | — |
| 1 `docker rmi` six-image unused set | 4,100,739,072 | +414 M (rust+builder content untagged; see prune line) |
| 1b `docker image prune -f` (dangling = the untagged 2.07 G rust content) | (folded below) | +535 M reclaimed |
| 2 `journalctl --vacuum-size=300M` — "freed 967.9M of archived journals" | 5,115,699,200 | +1,015 M |
| 3 npm/pnpm/pip/node-gyp cacache removals (ubuntu+root) | 5,846,605,824 | +731 M |
| 4 `apt-get clean` + apt lists | 6,345,052,160 | +498 M |
| 5 `rm -rf /home/ubuntu/src/target` (precondition §2 verified) | **14,509,219,840** | +8,164 M |

Note on step 1: `docker rmi` untagged the rust/builder images but their
layers lingered as a dangling 2.07 G image until `docker image prune -f`
(dangling-only; no container references) reclaimed 535 M — shared in-use
layers account for the difference between 2.07 G dangling and 535 M freed.

## 4. Before/after disk + service state

| | before (03:38Z) | after (04:05Z) |
|---|---|---|
| `/dev/sda1` | 41 G used, 3.5 G free, **93%** | 31 G used, **14 G free, 69–70%** |
| fence `headroom_ok` (tool) | false, −7.05 G | **true** (13.5 GiB free vs 10 GiB reserve) |
| dev relay pid 3832163 | running deleted exe | **still running, 3 listeners** (untouched by design) |
| prod containers | Up/healthy | Up/healthy (re-verified after) |
| voice door | ok, queue 0 | ok, queue 0 |
| x0x | healthy, 27 peers | healthy, 27 peers |
| ant stack (node-2/antd/CLI) | 3 processes | 3 processes |
| failed units | bitcoind, postfix | **bitcoind ACTIVE**; postfix failed (pre-existing, mailroom lane, out of scope) |

## 5. Dev-relay restart recipe (rollback path for item 5)

```
# on the box
cd /home/ubuntu/src            # skaists/buzz fork @ 088a677f88737aa42af4d6d790bd2dfe8373e835
# restore the three untracked scripts from the preserved bundle if missing
cargo build                    # rustc 1.98.0 (toolchains on box untouched)
./target/debug/buzz-relay …    # dev instance, ports 3315/3316/3317
# exact-image alternative: the preserved 227 MB binary runs as-is
```

## 6. Bitcoin — preservation/rollback record + observed progress

**Diagnosis first (no blind restart):** the failure journal shows the root
cause — `Failed to force flush state (Disk space is too low!)` and
`Fatal LevelDB error: IO error: /var/lib/bitcoin/blocks/index/000192.dbtmp:
No space left on device` on 2026-09-04T12:21Z (the pre-fence 98% period),
then `Restart=on-failure` looped into start-limit failure. No corruption
evidence.

**Preservation/rollback record (separate, as required):**

- Unit `buzz-bitcoind.service` verbatim in the census: `bitcoind
  -datadir=/var/lib/bitcoin -prune=2000 -txindex=0 -dbcache=1024 …,
  -disablewallet`, User=bitcoinu, MemoryMax=3G, Restart=on-failure.
  Unit file NOT edited this session.
- No manual database edits: no reindex flag, no deletion, no `prune` change,
  no config edit — operator hands never touched the datadir. Pre-start
  record: 5.8 G, 179 files (captured above BEFORE the start).
- What the start changed (stated plainly, correction §8): from 04:06Z the
  datadir is modified by BITCOIND'S OWN operation — pruning retired old
  block files, chainstate flushed, catch-up writes continue. That is the
  node working, not damage, and stopping does not revert it.
- Rollback: `systemctl stop buzz-bitcoind` returns the service to the
  stopped state — NOT the database to its pre-start state. No external copy
  of the datadir was taken this session (5.8 G; preservation was discharged
  by not touching it and recording the unit + pre-start measurements), so
  no data-level rollback path exists. Recorded as fact, not papered over;
  the earlier "returns the box to the pre-start state" claim in the first
  draft of this receipt was wrong and is superseded by this wording.

**Recovery + observed progress (2026-09-07T04:06Z, after the reserve was
restored):** one `systemctl start`. Result: `active (running)`;
`Loaded best chain: height=470324 … progress=0.163686` (chainstate intact —
the LevelDB flush failure left no damage); verification 0%→99%;
`Block index and chainstate loaded`; `Pruning blockstore…`; network threads
started; one minute later `UpdateTip: new best=… height=470325 …
progress=0.163687` — **block progress observed**. Catch-up from the 2017
prune frontier continues under normal operation; disk steady at 14 G free
during start. Postfix's failed unit is pre-existing and belongs to the
mailroom lane, not this one.

## 7. Acceptance disposition + next session packet

| acceptance item | disposition |
|---|---|
| machine-readable inventory; tests detect missing/unknown recovery dependency + sensitive-content prevention | **DONE** — tool + `e2e/recovery-inventory.test.sh` ALL PASS (CI: `tests.yml`); snapshots committed under `fixtures/recovery-inventory/` |
| identify active builds; preserve the restart artifact for the live deleted-binary process before touching its build tree | **DONE** — two active build trees found (dev relay `~/src` deleted-exe; `buzz-bclaude` live exe — untouched); 227 MB binary streamed off-volume, hash-verified BOTH sides, BEFORE `rm -rf ~/src/target` |
| change/reason/rollback receipt before mutation; preserve material off-volume + verify retrieval before deletion | **DONE** — §0 written before the first mutation (file timestamp order); §2 hash pairs laptop==box |
| restore the fence.md ten-GB reserve; exact before/after disk + service state | **DONE** — 3.5 G → 14 G free (93% → 69%); §4 table; `headroom_ok:true` |
| Bitcoin: separate preservation/rollback record + observed block progress; no blind restart/reindex/delete | **DONE** — §6; diagnosed no-space root cause, no manual database edits, one start, UpdateTip observed (rollback wording corrected in §8) |
| source/deployment bytes consistent + this dispatch filed | **DONE** — no deployment surface changed by this lane; tool+tests+snapshots+dispatch in one commit |

**Explicitly NOT done / open for the next session:**

- The dev relay (pid 3832163) still runs its deleted exe. Restart now means
  the §5 recipe (rebuild or the preserved binary) — a founder-gesture
  decision WHEN to bounce a dev service; the inventory keeps flagging it
  `active-deleted-executable` until then (honest, not an error).
- `vending-probe` restart dependency UNKNOWN (892 M, untouched; the
  corrected tool now flags it `unknown-restart-dependency` instead of
  letting it pass as healthy — see §8).
- bitcoind catch-up to tip is in progress at receipt time (normal
  operation; prune=2000 bounds block growth, chainstate grows with tip).
- postfix@-.service failed (pre-existing; mailroom lane).
- The inventory config (`box-config-2026-09-07.json`) is a point-in-time
  census: new services need their roots declared (tool fails closed on
  undeclared = unrecorded, by design).

**Next session packet:** ref = this commit on `lane/g1-recovery`; issue #4
stays open for Astra's acceptance + G3 negative review; next commands:
`bash e2e/recovery-inventory.test.sh` (CI lane),
`ssh oracle 'sudo python3 /home/ubuntu/recovery/recovery-inventory.py
--config /home/ubuntu/recovery/inventory.box.json'` (expect rc=2 with
dev-relay-build and vending-probe in attention under the corrected
semantics — §8); known blockers: none for this lane's scope.

## 8. Bounded correction after acceptance review (same session, 2026-09-07)

The founder relayed astra's acceptance review of `d9248e4b`: four findings,
all confirmed real on inspection. Corrected in this session (one commit on
the same lane); the capacity cleanup was NOT repeated, per the review.

1. **Unknown restart dependencies passed as healthy** (`vending-probe`
   `method: unknown` → `status: ok`; an unreadable restart executable also
   exited 0). Fix: new attention statuses `unknown-restart-dependency`
   (fires on explicit `method: "unknown"` OR a restart block naming no
   executable and no unit) and `unreadable-restart-dependency` (executable
   exists but cannot be read); both escalate the root and force exit 2.
2. **Permission failures disappeared** (unreadable proc links and
   subdirectories produced exit 0, no errors, silently incomplete
   measurements). Fix: `footprint` records every unreadable entry via
   `measurement_errors` (walk `onerror` + per-stat), the root flags
   `partially-unreadable`, the proc scan records `proc-permission-denied`
   per pid into `scan_errors`, and ANY incompleteness forces exit 2. The
   tool now honors the fail-closed law its own header states. Side proof
   during the fix: a "clean" census run against the REAL `/proc` as an
   unprivileged user correctly refused to pass — the test now pins
   `PROC_DIR` to an empty fixture for the clean case, because an
   unprivileged full-proc scan is genuinely partial.
3. **Secret-reference output carried arbitrary config notes** (a synthetic
   sentinel in `notes` passed through). Fix: secret-reference entries are
   rebuilt from scratch as metadata only — id, path, classification,
   owner, mode, recovery_owner, status. No `notes` key exists on them, so
   config prose cannot ride a secret entry; the output guard stays as
   backstop.
4. **Bitcoin rollback wording overclaimed** ("stop returns the box to the
   pre-start state; datadir never modified"). Fix: §0 row 6 and §6 now say
   what is true — no manual database edits, but bitcoind's own pruning,
   flush, and catch-up writes from 04:06Z are real and not revertible by
   stopping; no external datadir copy was taken, so no data-level rollback
   path exists. The original wording is superseded in place, visibly.

**Tests added** (the originals passed because they never exercised these
cases): `unknown-restart-dependency` via both explicit `method: "unknown"`
and an empty restart block; `unreadable-restart-dependency` (executable
path is a directory — unreadable for any uid); `unreadable-artifact`;
permission-denied subdirectory → `partially-unreadable` +
`measurement_errors`; permission-denied pid → `scan_errors`
`proc-permission-denied`; secret-notes sentinel never emitted (content AND
notes). ALL PASS (non-root; the two EACCES cases print a loud root-run
note instead, CI runs them for real).

**Regenerated evidence:** the post-correction read-only snapshot is
committed at `fixtures/recovery-inventory/box-2026-09-07-post-correction.json`
(ran with the corrected tool, read-only, no cleanup repeated). Under
corrected semantics its attention set is `dev-relay-build`
(active-deleted-executable) and `vending-probe`
(unknown-restart-dependency) — the honest state. The pre-repair and
post-repair snapshots from the original run are kept unchanged as history.

**Acceptance:** moved to a fresh G3 review session per the docket, with
the corrected tool, the negative tests, and this section as its inputs.

## 9. Second bounded correction (two review findings, same session)

Astra verified `ef31fca9` (7/7 green, corrected snapshot flags both
expected items, Bitcoin wording accepted) and found two remaining gaps.
Both confirmed real; both fixed here. Still no capacity work repeated.

1. **Omitted or null restart information still passed.** A missing
   `restart` key and an explicit `"restart": null` both fell into the
   `restart is None` branch, which recorded `restart: None` and raised no
   defect — exit 0. Fix: absent/null/undeclared restart is now
   `unknown-restart-dependency` by default (reported as
   `{"method": "undeclared"}`); the ONE exemption is an explicit
   designation `"restart": {"method": "not-applicable"}`, which is echoed
   in the output so the declaration itself is auditable. Silence is no
   longer readable as "fine". (All 15 roots in the box config declare a
   restart, so the box snapshot's attention set is unchanged:
   dev-relay-build + vending-probe.)
2. **Measurement errors exposed discovered object names.** `str(err)` on
   walked OSErrors embedded the discovered path verbatim — an unreadable
   directory named `CUSTOMER-OBJECT-SENTINEL` appeared in the JSON,
   violating #4's prohibition on emitting object names. Fix: every error
   report is now structured `{root, op, code, errno}` (or
   `{op, code, pid}` for the proc scan) — operation + symbolic errno
   (`EACCES`, `EISDIR`), NEVER `str(err)`, never a discovered path; the
   same normalization applies to artifact/restart `unreadable:` statuses
   and the statvfs failure status.

**Regression tests added** for both reproducible cases: a root with no
restart key and one with `"restart": null` both assert
`unknown-restart-dependency` + `{"method": "undeclared"}`; a mode-000
DISCOVERED directory literally named `CUSTOMER-OBJECT-SENTINEL` inside a
declared root asserts `partially-unreadable` + code-shaped
`measurement_errors` (keys ⊆ {root, op, code, errno}, no `/` in any
entry) and greps the whole output for the name; the proc-permission
assertion now requires the `EACCES` code shape; the clean census gains a
`not-applicable` root to prove the designation stays healthy at exit 0.
ALL PASS non-root.

**Snapshot:** the read-only post-correction snapshot at
`fixtures/recovery-inventory/box-2026-09-07-post-correction.json` was
regenerated with this final tool (same attention set, errors now
code-shaped). Pre-repair and post-repair history files untouched.

**Handoff:** #4 remains open; acceptance per the docket belongs to a
fresh G3 review session — inputs: this section, §8, the tool at this
commit, the fixture battery, and the three snapshots.

## 10. Third bounded correction — the guard (G3 findings F1+F2, same build session)

The G3 review ([dispatch](2026-09-07-zcode-g3-negative-review.md))
independently confirmed every core claim and found the output guard
case-sensitive and hex-blind. Both fixed here; still no capacity work.

1. **Markers match case-insensitively** — real secrets arrive lowercase
   (`nsec1…`, `authorization: bearer`, "private key"); the guard folds
   both sides before comparing. The marker WORD named in the stderr trip
   message carries no secret value.
2. **Key-shaped hex is checked against a registry of digests the TOOL
   COMPUTED** — every artifact/restart digest is registered at computation
   time; any 48+ hex run in the serialized output that is not one of those
   exact values trips the guard. No field NAME is exempt: a config field
   literally named `sha256` carrying an uncomputed hex run refuses the
   same as a `notes` leak. (The `not-applicable` restart branch echoes
   only the method, so no uncomputed field rides it at all.) The hex trip
   message never echoes the offending value.

**Tests added:** four trip cases — lowercase `nsec1…` in notes, an
assembled 64-hex key shape in notes, lowercase `authorization: bearer` +
"private key" phrasing, and a `sha256`-NAMED config field on a normally
echoed restart block — each asserts **exit 3, empty stdout, and no value
echo to stderr**; plus the POSITIVE case: the clean census's computed
digest appears in output verbatim (guard does not eat legitimate hashes).
Sentinels are assembled at runtime (32-hex halves) so the test file never
contains a literal 48+ hex run. ALL PASS non-root; the earlier rounds'
regressions all still pass.

**Box:** fixed tool re-staged, sha256 parity verified against the
committed ref, snapshot regenerated READ-ONLY (attention set unchanged:
dev-relay-build + vending-probe; computed digests — bitcoind, the prod
fork binary, buzz-acp, ant-node, antd, ant CLI, voice sources — pass the
new guard unchanged). The new pinned commit goes to the G3 reviewer;
#4 stays open until that verification passes.
