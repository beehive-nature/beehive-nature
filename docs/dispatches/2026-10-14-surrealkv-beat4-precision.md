# 2026-10-14 — SKV beat 4: precision corrections executed — duplicate member fixed, outbound-network denial, authority-negative proof, runtime lifecycle receipts

Founder beat-4 directives accepted in full. This dispatch records what
was executed; the working seam vs qualified sovereign storage system
distinction is banked — the first is demonstrated, the second still
needs independent failure, isolation and long-duration evidence.

## 1. Repository hygiene: the duplicate member was REAL — fixed

The founder's read of the `dbb2b1a31` diff was exact: `crates/
adapter-store` was inserted into workspace members TWICE — once by my
explicit edit (line 15) and once by cargo's own auto-append when the
crate was first built (collapsed onto the
`"crates/bpq-device-xcheck"` line). Cargo silently tolerates the
duplicate, which is why every build stayed green while the count was
inflated: the stack inventory's "76 workspace crates" counted the
ghost. Fixed this beat: exactly one entry; `cargo metadata` clean;
stack inventory regenerated at the TRUE count **75**; `--check` PASS.
Lesson banked: after `cargo init` inside a workspace, grep the members
list before adding by hand — cargo has already added you.

## 2. NO-SERVER-DB precision: observation extended + outbound DENIAL added

The founder's correction is banked: path-only constructors prevent
CALLERS from supplying endpoints; they do not prevent an implementation
from dialing out, and ten listening samples prove no listeners, not
isolation. Two new legs:

- **All-state socket observation** (`tests/skv2_network_denial.rs`):
  TCP+UDP, every state, attributable to the working child across live
  samples — zero.
- **Outbound-network DENIAL** (same file): a mechanism LADDER whose
  receipt names what actually ran. Kernel leg: the entire bounded
  workload (2000 ops) under `unshare -rn` (rootless user+net namespace).
  Runner reality convicted the first implementation: GitHub's apparmor
  userns restriction lets `unshare -rn` SPAWN but die EPERM — the
  original fallback only caught spawn-errors, so the first Linux run
  failed with `exited_clean=false samples=[]`. Repaired: the death is
  caught, its captured stderr lands in the receipt as the reason, and
  the ladder falls through to the libc leg — an LD_PRELOAD socket
  blocker (compiled by build.rs on Linux hosts; `socket()` for
  AF_INET/AF_INET6 fails ENETUNREACH) guarded by an ACTIVE control: a
  bash `/dev/tcp` connect under the shim must fail "unreachable", and
  an inert shim FAILS the leg rather than falling through. Where no
  mechanism exists the receipt says observation-only. Named boundary:
  raw syscalls or a statically-linked libc bypass the libc boundary;
  the kernel netns leg remains the strongest where permitted. SKV-2
  receipts, both engines: clean exit, zero sockets any state, exact
  replay, PASS.

## 3. SKV-3 executable: the seam cannot acquire authority

`tests/skv3_authority_negative.rs` — a negative capability proof at the
levels a test can observe: the manifest's dependency set is EXACTLY
{rusqlite, surrealkv, tokio} (no signing, identity, settlement or
network-client crate linked by the seam's own declaration), and the
seam's source carries zero network/key tokens (TcpStream, UdpSocket,
to_socket_addrs, lookup_host, signing_key, secret_key). Named
boundaries: transitive engine capability (surrealkv links tokio with
IO) is NOT asserted away — runtime behavior is covered by the SKV-2
denial/observation receipts; and authority itself is architectural
law, not a runtime claim: storage retains bytes, BNROSE governs
authority, no adapter becomes a sovereign control plane. The test
convicts any regression of the surface.

## 4. Runtime lifecycle: long-lived shape, executable

`tests/skv_life_runtime.rs` — founder directive made executable, both
engines: 4 concurrent writer threads × 1500 deterministic ops on
disjoint ranges + 2 concurrent readers (torn-value detection under
concurrency), then a 2 s idle (background tasks get no block_on
windows), then a post-idle commit (starvation probe), then orderly
closure (Arc drop → SurrealKV tree.close()), then a FRESH reopen
(cleanup proof) and EXACT comparison against the full per-thread
deterministic replay. Receipts, both engines: `torn=0 post_idle=true
close=orderly reopen=clean exact_replay=true verdict=PASS`. This also
exercises the private current-thread runtime from multiple threads
simultaneously — the multi-year starvation/shutdown question gets its
first executable row, not a final answer.

## 5. Distinctions reaffirmed (wording tightened in the crate README)

- `Immediate` ≠ demonstrated power-loss durability: process-kill
  receipts are valid within the process-death model; they do NOT
  establish persistence through power interruption, filesystem
  corruption or device write-cache failure. Power-loss stays NOT RUN.
- The exact-replay oracles assume sequential, uniquely identifiable
  operations — the founder's caveat, now written into the README so the
  assumption cannot silently broaden.
- Working interchangeable storage seam (demonstrated) ≠ fully
  qualified sovereign storage system (needs independent failure,
  isolation and long-duration evidence — SKV-5 and the service tests,
  still NOT RUN).

## 6. Issue #420 routing made executable

All seats share one GitHub push identity, so an assignee cannot express
seat ownership; the repo had no ownership vocabulary. Created label
`owner:bmesh` ("owned by the bmesh lane; seats share one push identity
so routing rides labels"), applied it to #420, and posted the
acceptance re-verification path as a comment. Executable query:
`gh issue list -l owner:bmesh`.

## Status

- SKV-1, SKV-2, SKV-3, SKV-4, NO-SERVER-DB, lifecycle: **first
  receipts GREEN on this box (Windows) for both engines; Linux CI to
  confirm (the unshare denial leg only runs there).**
- SKV-5 (bounded growth, pruning, migration, rollback,
  migration-interruption), six-service independence, aarch64,
  power-loss: NOT RUN, routed.
- Qualification disposition: unchanged — independent bTunGsTeN
  evidence + repository CI process, no founder gates. SurrealKV stays a
  replaceable embedded candidate; SQLite stays the reference.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13.
