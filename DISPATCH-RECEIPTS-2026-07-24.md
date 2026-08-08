# Dispatch Receipts — 2026-07-24

**Status:** 4/4 orders executed. All fences held.
**Fence audit:** No node started. No build/compile. No broadcast. No key used. All writes confined to this file.
**One state change occurred, and it was the one you authorized:** `ant update` (ORDER 1).

---

## Execution environment — read this first

Your orders assumed a single execution context. There are two, and they are not interchangeable:

| Context | Egress | Can reach |
|---|---|---|
| Cowork Linux sandbox | **Blocked (proxy 403)** | nothing — api.hive.blog and api.github.com both refused |
| Your Windows machine (via VPN) | Open | Hive RPC ✅, GitHub ✅, `ant` binary ✅ |

**Everything below ran on your machine.** The sandbox could not have executed any of these four orders. Worth encoding in future orders: "execute on host, not sandbox."

---

## ORDER 1 — ant CLI 0.3.1 update + --help re-readback ✅

### Receipt

```
=== PRE ===
ant 0.3.0
=== UPDATE ===
Current version: 0.3.0
Checking for updates...
Update available: v0.3.0 -> v0.3.1
Downloading ant from
https://github.com/WithAutonomi/ant-client/releases/download/ant-cli-v0.3.1/ant-0.3.1-x86_64-pc-windows-msvc.zip
Download complete
Downloading signature...
Verifying ML-DSA signature...
Signature verified
Extracting archive...
Updated successfully: v0.3.0 -> v0.3.1
=== POST ===
ant 0.3.1
```

Binary: `C:\Users\travi\AppData\Local\ant\bin\ant.exe`. ML-DSA (post-quantum) signature verified by the updater itself — that is a meaningful supply-chain receipt, log it.

### Full command tree, v0.3.1 (verbatim)

```
Autonomi network client
Usage: ant.exe [OPTIONS] <COMMAND>
Commands:
  node    Manage nodes
  wallet  Wallet operations
  file    File operations (multi-chunk upload/download with EVM payment)
  chunk   Single-chunk operations (low-level put/get without file splitting)
  update  Update the ant binary to the latest version
  help    Print this message or the help of the given subcommand(s)
Options:
      --json                             Output structured JSON instead of human-readable text
  -b, --bootstrap <BOOTSTRAP>            Bootstrap peer addresses (for data operations)
      --devnet-manifest <MANIFEST>       Path to devnet manifest JSON
      --allow-loopback                   Allow loopback connections (devnet/local testing)
      --ipv4-only                        Force IPv4-only mode (disable dual-stack)
  -v, --verbose...                       Increase verbosity. By default no logs are emitted
                                         (privacy by design). -v: info+warn, -vv: debug, -vvv: trace
      --evm-network <EVM_NETWORK>        [default: arbitrum-one]

ant node    → add | daemon | dismiss | reset | start | status | stop
ant wallet  → address | balance
ant file    → upload | download | cost
ant chunk   → put | get
```

### Required one-line answer

> **Mutable-type CLI families in v0.3.1 — NO.**

`register`, `scratchpad`, `pointer`, `vault` are all **absent**. The data surface is chunk-only: immutable content-addressed put/get plus file-level chunking. No telemetry subcommand either.

### Findings your order didn't anticipate

1. **The top-level surface is byte-identical between 0.3.0 and 0.3.1.** I captured the 0.3.0 tree before updating, so this is a real diff, not an assumption. 0.3.1 is a point release with no CLI surface change. *The Discord supersession flag, whatever it refers to, is not a CLI-surface change.* That is the actual answer to why you were told to re-readback.
2. **`antup` is not installed** on your machine. `ant update` is self-contained (self-replace on Windows). No version manager to maintain.
3. **Telemetry: absent from the CLI, present in the node.** `ant-node`'s config carries a `metrics_port` with a default (`src/config.rs:247,262`). The CLI exposes no toggle for it. If "no telemetry" is a founder directive, the CLI is not where you enforce it — the node config is. **Flagging this as a gap between your fence and your controls.**

### ✅ §4.3 CLOSED (appended post-review) — full subtree diff, 0 differences

The original caveat was that I captured only the *top-level* tree at 0.3.0 before updating, so "unchanged" held for the top level only — a subcommand could have been added under `node`/`wallet`/`file`/`chunk` invisibly. **That gap is now closed.**

Method: downloaded the v0.3.0 release to a temp directory and diffed it against the installed 0.3.1 binary, command by command. The installed 0.3.1 was **not** modified — verified both versions side by side before diffing (`TEMP BINARY VERSION: ant 0.3.0` / `INSTALLED VERSION (untouched): ant 0.3.1`).

```
Source: WithAutonomi/ant-client/releases/download/ant-cli-v0.3.0/
        ant-0.3.0-x86_64-pc-windows-msvc.zip  (11,667,816 bytes)
```

| Subtree | Result |
|---|---|
| `(root)`, `node`, `wallet`, `file`, `chunk` | SAME |
| `node add\|daemon\|dismiss\|reset\|start\|status\|stop` | SAME |
| `wallet address\|balance` | SAME |
| `file upload\|download\|cost` | SAME |
| `chunk put\|get` | SAME |
| **Total** | **0 differences across 19 subtrees** |

The diff covers full help text — subcommands *and* flags — not just command names. **v0.3.1 has a byte-identical CLI surface to v0.3.0 at every level.** §4.3 is definitively closed: the Discord supersession flag is not a CLI-surface change, and there is no subcommand hiding below the top level. Whatever was superseded is internal (protocol, dependency, or build), not user-facing.

Fences: read-only, temp-directory only, no node started, installed binary untouched, temp artifacts deleted after capture.

---

## ORDER 2 — Per-node RAM/disk constants ⚠️ EXECUTED, PREMISE CORRECTED

### Your method was broken in two ways

1. **Cargo cache is empty of Autonomi sources.** Your `ant` is a prebuilt signed download, never compiled locally. `C:\Users\travi\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f` contains no `ant-*`, no `autonomi`, no `libp2p`. Primary method dead.
2. **`ant-networking` no longer exists.** Not as a crate, not as a dependency. `ant-node` v0.14.3 pulls networking, DHT, security, trust *and* storage from a single dependency: **`saorsa-core = "0.26.2"`**. The in-repo comment is explicit: *"Core (provides EVERYTHING: networking, DHT, security, trust, storage)"*.

I used the GitHub fallback your order already authorized. **Correct repo: `WithAutonomi/ant-node` (v0.14.3)** — your guess was right. Note `maidsafe/autonomi` is the **legacy** monorepo; reading it would have given you constants for a codebase that no longer ships. Do not cite it.

### The headline finding: there is no per-node disk allocation

`src/storage/lmdb.rs:691`:

```
map_size = current_db_file_size + max(0, available_space - reserve)
```

| Constant | Value | Citation |
|---|---|---|
| `MIN_MAP_SIZE` | 256 MiB | `src/storage/lmdb.rs:41` |
| `DEFAULT_DISK_RESERVE` | 500 MiB | `src/storage/lmdb.rs:29` |
| `max_map_size` default | `0` = auto-derive | `src/storage/lmdb.rs:60,72,143,160` |
| page-aligned, floored at MIN | — | `src/storage/lmdb.rs:700,713,718` |
| resize-on-demand at write | — | `src/storage/lmdb.rs:275,634–667` |
| `max_dbs` | 1 | `src/storage/lmdb.rs:186` |
| `MIB` / `GIB` helpers | 1024·1024 / 1024·MIB | `src/storage/lmdb.rs:23,26` |

**Operational consequence for SITREP §4.6 — this is the finding that matters:**
With the default `max_map_size = 0`, **every node sizes its LMDB map to (its own DB size + all remaining free disk − 500 MiB)**. The 500 MiB reserve is *per node*, not global. Run N nodes on one volume and each independently maps almost the entire free disk. LMDB map size is a virtual address-space reservation rather than committed bytes, so this does not instantly fill the disk — but **no node self-limits, and the reserve does not compose across nodes.** On any multi-node host you must set `max_map_size` explicitly per node. Treat "nodes will share the disk sensibly" as false.

### RAM: no per-node constant exists — and that is the honest answer

There is no `MAX_MEMORY`, no RAM budget, no allocation ceiling anywhere in `ant-node`. Memory is emergent from these, all citable:

| Contributor | Value | Citation |
|---|---|---|
| Verified-XorName LRU cache | 100,000 entries, **documented as 3.2 MB** | `src/payment/cache.rs:14,15`; `src/config.rs:266,267` |
| `max_message_size` | `max(MAX_REPLICATION_MESSAGE_SIZE, MAX_WIRE_MESSAGE_SIZE)` | `src/config.rs:383–388` |
| `MAX_WIRE_MESSAGE_SIZE` | 5 MiB (per doc comment) | `src/config.rs:134` |
| `MAX_REPLICATION_MESSAGE_SIZE` | `REPLICATION_MESSAGE_SIZE_MIB × 1024 × 1024` | `src/replication/config.rs:275` |
| `MAX_CONCURRENT_REPLICATION_SENDS` | 3 × up to 4 MB chunk ≈ **12 MB** | `src/replication/config.rs:128,130` |
| `MAX_CONCURRENT_AUDIT_RESPONSES` | 32 | `src/replication/config.rs:146` |
| `MAX_AUDIT_RESPONSES_PER_PEER` | 4 | `src/replication/config.rs:158` |
| Audit response size | up to 2 × 4 MiB = 8 MiB each → **256 MiB worst-case burst** | `src/replication/config.rs:197,290,291` |
| `max_parallel_fetch()` | = CPU `available_parallelism`, fallback 4 | `src/replication/config.rs:164,169–171` |
| Global allocator | `mimalloc` | `Cargo.toml` |

**Two things to carry into §4.6:**

- **The dominant RAM term is a burst, not a steady state.** 32 concurrent audit responses × 8 MiB = **~256 MiB transient ceiling**, dwarfing the 3.2 MB steady cache. Size hosts for the burst.
- **Memory scales with core count.** `max_parallel_fetch()` reads `available_parallelism` — a 16-core VPS allocates 4× the fetch buffers of a 4-core box *for the same node*. This is the configurable parameter your order asked for, and it is not a config field; it is CPU topology. Pinning it requires cgroup/affinity limits, not a TOML edit.
- **LMDB is mmap'd.** Map size is virtual address space; resident set is OS page-cache governed. Do not add map size to a RAM budget.

### Peer / DHT parameters

| Constant | Value | Citation |
|---|---|---|
| `K_BUCKET_SIZE` | 20 | `src/replication/config.rs:24` |
| `PAID_LIST_CLOSE_GROUP_SIZE` | 20 | `src/replication/config.rs:41` |
| `NEIGHBOR_SYNC_SCOPE` | 20 | `src/replication/config.rs:44` |
| `NEIGHBOR_SYNC_PEER_COUNT` | 4 | `src/replication/config.rs:48` |
| `QUORUM_THRESHOLD` | 4 | `src/replication/config.rs:38` |
| `STORAGE_ADMISSION_MARGIN` | 2 | `src/replication/config.rs:32` |

### Unresolved — not fabricated

- `CLOSE_GROUP_SIZE`, `MAX_CHUNK_SIZE`, `MAX_WIRE_MESSAGE_SIZE`, `REPLICATION_MESSAGE_SIZE_MIB` are **re-exports from `ant-protocol` 2.3.0**, a separate crate I did not read. Doc comments say 4 MB chunk / 5 MiB wire; `QUORUM_THRESHOLD = 4 = floor(CLOSE_GROUP_SIZE/2)+1` implies CLOSE_GROUP_SIZE ∈ {6,7}, and the test fixture uses 7 (`:885`). **I am not asserting 7.** Needs a read of `ant-protocol`.
- **Version lineage warning:** `ant-node` main is **v0.14.3**; your CLI is **v0.3.1** (`ant-client`). Separately versioned. The node binary `ant node add` actually fetches may not be v0.14.3. Re-verify these constants against the installed node before committing them to SITREP.
- ~~Everything under `saorsa-core` is unread~~ → **CLOSED.** See §4.6 CLOSED below.

### ✅ §4.6 RAM GAP CLOSED (appended post-review) — saorsa-core 0.26.2 read

Source: `crates.io/api/v1/crates/saorsa-core/0.26.2/download` (629,081 bytes), extracted to temp, 42 `.rs` files. Read-only, nothing compiled, nothing installed, temp deleted after capture. Line numbers are relative to `src/`.

**The dominant RAM term is not in `ant-node` at all — and `ant-node` cannot tune it.**

| Constant | Value | Citation |
|---|---|---|
| **`DEFAULT_MAX_CONNECTIONS`** | **10,000** | `network.rs:129` |
| — applied as default | `unwrap_or(DEFAULT_MAX_CONNECTIONS)` | `network.rs:563`, `585` |
| — enforced | `if peer_count > self.config.max_connections` | `network.rs:1987` |
| — overridable | builder `.max_connections(n)` | `network.rs:460–461` |
| `DEFAULT_CONNECTION_TIMEOUT_SECS` | 25 | `network.rs:137` |

**`ant-node`'s config exposes no `max_connections` field.** The override exists only on the saorsa-core builder. So unless `ant-node` sets it internally, **every node admits up to 10,000 concurrent connections by default, and there is no TOML knob for it.** This is the §4.6 answer: the governing RAM parameter is a dependency default that is invisible from the node's own configuration surface.

**Peer table (bounded, cheap):**

| Constant | Value | Citation |
|---|---|---|
| `KADEMLIA_BUCKET_COUNT` | 256 | `dht/core_engine.rs:1292` |
| `DEFAULT_K` / `DEFAULT_K_VALUE` | 20 | `dht/core_engine.rs:1286`, `network.rs:601` |
| `MIN_K_VALUE` | 4 | `network.rs:605` |
| `MAX_ADDRESSES_PER_NODE` | 8 | `dht/core_engine.rs:109` |
| **Ceiling** | 256 × 20 × 8 = **40,960 address entries** | derived |

**Message and value ceilings — note the two different `MAX_MESSAGE_SIZE`:**

| Constant | Value | Citation |
|---|---|---|
| `MAX_MESSAGE_SIZE` (DHT wire) | **64 KiB** | `dht_network_manager.rs:58` |
| `MAX_MESSAGE_SIZE` (validation) | **16 MiB** | `validation.rs:71` |
| `MAX_VALUE_SIZE` | 10 MiB | `validation.rs:74` |
| `MAX_KEY_SIZE` | 1 MiB | `validation.rs:73` |

Two ceilings 256× apart at different layers, same name. Anything reasoning about buffer sizing must specify which. Flagging as a footgun.

**Queues, sharding, rate limiting:**

| Constant | Value | Citation |
|---|---|---|
| `MAX_RATE_LIMIT_KEYS` | 100,000 | `rate_limit.rs:9` |
| `LOOKUP_FAILURE_BROADCAST_CAPACITY` | 1,024 | `dht_network_manager.rs:146` |
| `PENDING_DIAL_BROADCAST_CAPACITY` | 16 | `dht_network_manager.rs:139` |
| `MESSAGE_DISPATCH_SHARDS` | 8 | `transport_handle.rs:2513` |
| `MIN_SHARD_CHANNEL_CAPACITY` | 16 | `transport_handle.rs:2521` |
| `DEFAULT_MAX_CONCURRENT_OPS` | 100 | `dht_network_manager.rs:5515` |
| `MIN_CONCURRENT_OPERATIONS` | 10 | `dht_network_manager.rs:49` |
| `MAX_CANDIDATE_NODES` | 200 | `dht_network_manager.rs:54` |
| `ALPHA` (parallel queries) | 3 | `dht_network_manager.rs:2634` |
| `MAX_ITERATIONS` | 20 | `dht_network_manager.rs:2633` |
| `MAX_CONCURRENT_REVALIDATIONS` | 8 | `dht_network_manager.rs:149` |
| `MAX_CONCURRENT_REVALIDATION_PINGS` | 4 | `dht_network_manager.rs:152` |
| `ML_DSA_PUB_KEY_LEN` | 1,952 bytes | `identity/node_identity.rs:53` |

**Residual — named, not papered over.** There is **no per-connection buffer constant** in saorsa-core. I grepped for `with_capacity(N)`, `vec![0u8; N]`, `BUF_SIZE`, `buffer_size`, and fixed-size channels; the only hits were a `broadcast::channel(4)` and two-element vectors. Per-connection memory is QUIC/PQC transport session state allocated below this crate, so **the coefficient cannot be derived from source — it must be measured.**

**Net §4.6 position:** the *governing parameter* is now identified and cited (10,000 connections, untunable from `ant-node`). The *bytes-per-connection coefficient* requires one measurement: start a single node, let it reach steady-state peer count, sample RSS. That is a node-start operation and therefore **fenced** — it needs the founder's nodes-on directive. Until then, per-node RAM is bounded below by `ant-node`'s ~256 MiB audit burst and bounded above by whatever 10,000 connections costs, which is the number nobody has yet.

### 🔁 §4.6 max_connections — END-TO-END TRACE (supersedes the two hedges above)

I hedged twice on this and both hedges are now resolved by tracing the full call chain. **The 10,000 figure governs. Confirmed.**

**Step 1 — `ant-node` never sets it.** `max_connections` has **zero occurrences** in the entire `ant-node` tree (74 `.rs` files, `main` branch tarball). `build_core_config` (`ant-node/src/node.rs:219–224`) sets only four builder fields:

```rust
let mut core_config = CoreNodeConfig::builder()
    .port(config.port)
    .ipv6(!config.ipv4_only)
    .local(local)
    .max_message_size(config.max_message_size)
    .build()
```

**Step 2 — saorsa-core fills the gap with 10,000.** `network.rs:563`: `max_connections: self.max_connections.unwrap_or(DEFAULT_MAX_CONNECTIONS)` → resolves to **10,000** (`network.rs:129`).

**Step 3 — it propagates to the transport.** `transport_handle.rs:415` passes `config.max_connections` as the third argument to `DualStackNetworkNode::new_with_options(...)`.

**Step 4 — it reaches the real transport builder.** `saorsa_transport_adapter.rs:536`: `.max_connections(max_connections)` on `P2pConfig::builder()`.

**The competing `DEFAULT_MAX_CONNECTIONS = 100`** (`saorsa_transport_adapter.rs:132`) is a **red herring for this path**. It is consumed only by the convenience constructor `P2PNetworkNode::new(bind_addr)` at `:498`. `ant-node` does not use that constructor — it arrives via the `DualStack` → `new_with_options` path, which takes the value explicitly. **100 never applies to an `ant-node` process.**

**Corrected conclusions:**

| Claim | Verdict |
|---|---|
| 10,000 is the live transport connection limit | ✅ **CONFIRMED** by 4-step trace |
| `ant-node` cannot tune it (no TOML knob) | ✅ **CONFIRMED** — zero occurrences in ant-node |
| `network.rs:1987` is an admission gate | ❌ **FALSE** — it is inside `health_check()`, reports only |
| The `100` default might govern instead | ❌ **FALSE** — wrong constructor path |

**What this does and does not mean.** 10,000 is a **ceiling, not an allocation.** Nothing preallocates 10,000 connection slots; a node only holds as many connections as peers actually establish. So fleet arithmetic of the form *nodes × 10,000 × bytes-per-conn* is a **worst-case bound, not a steady-state budget** — and should not be booked as an expected RAM figure.

The real exposure is **tail risk, not baseline**: a node has no configuration-level cap on inbound connections, so a connection-flood scenario is bounded only by whatever saorsa-transport enforces one layer further down (**unread — `saorsa-transport` crate**). For a fleet, the mitigation is a per-node cgroup memory cap or an upstream connection limit, since the knob does not exist in `ant-node`.

**Operator's levers, precisely:**
- `max_message_size` — **tunable** from `ant-node` config (`node.rs:223` wires it through)
- `max_connections` — **not tunable** from `ant-node` at any level
- Also set unconditionally at `saorsa_transport_adapter.rs:537–538`: `.conservative_timeouts()` and `.data_channel_capacity(DEFAULT_DATA_CHANNEL_CAPACITY)` — both memory-relevant, both living in `saorsa-transport`, both unread.

**Edit to your accept criteria:** the order demanded "RAM/node (min + typical)" cited to source. No such constant exists. Had I met that criterion literally, I would have had to invent it. I have given you the constants that do exist plus the derivation. **Recommend future orders permit "no constant exists; value is runtime-derived from X" as a passing answer** — otherwise the accept criteria reward fabrication.

---

## ORDER 3 — Hive read-ingestion surface ✅

All methods probed live against `api.hive.blog` through your VPN. Read-only, no keys.

### Reference table (all verified, not documented-from-memory)

| Method | Params | Key response fields | Pagination | Notes |
|---|---|---|---|---|
| `condenser_api.get_content` | `[author, permlink]` (positional array) | `body`, `created`, `children`, `net_rshares`, `active_votes`, `json_metadata`, `body_length` | none — single post | ✅ verified |
| `condenser_api.get_discussions_by_created` | `[{tag, limit}]` (array-wrapped object) | 22 fields incl. `url,body,author,permlink,created,category,children,net_rshares` | `start_author`/`start_permlink` | ✅ verified, 2 rows |
| `bridge.get_ranked_posts` | `{sort, tag, limit}` (named object) | same shape as above | `start_author`/`start_permlink` | ✅ verified. **HiveMind 2nd-layer** |
| `bridge.get_community` | `{name}` | `title`, `subscribers`, `type_id`, `created_at` | none | ✅ verified — `hive-139531` = HiveDevs, 3580 subs |
| `account_history_api.get_account_history` | `{account, start, limit, include_reversible, operation_filter_low}` (named) | `[index, {block, timestamp, trx_id, op{type,value}}]` | backwards from `start:-1`; **`limit` max 1000, 1001 rejected** | ✅ verified |
| `condenser_api.get_ops_in_block` | `[block_num, only_virtual]` | array of `{op:[type, payload], trx_id, ...}` | none — one block | ✅ verified on block 108404167: 8 ops, 5 custom_json, 1 `bnr.anchor` |

**Param-style trap:** `condenser_api.*` takes **positional arrays**, `bridge.*` and `*_api.*` take **named objects**. Mixing them silently returns null. Encode this in the adapter.

**`bridge.*` is HiveMind (2nd layer), not consensus.** It is served by a separate indexer that can lag or fail independently of the block API. **Never source anchor-chain truth from `bridge.*`** — use it for discovery only. Anchor truth comes from `account_history_api` / `get_ops_in_block`.

### The critical answer: retrieving all `bnr.anchor` from genesis

**Your order's premise is wrong in a way that matters.** `account_history_api.get_account_history` **cannot filter by the custom_json `id` field.** Proven empirically: with `operation_filter_low = 262144` the call returned `bnr.anchor`, `community`, **and** `follow` — all mixed.

What the filter *does* do — and it works — is filter by **operation type bitmask**. `custom_json` is operation **bit 18**, so `operation_filter_low = 262144` (`1 << 18`). Verified: `distinct op types: custom_json_operation`, nothing else.

**Most efficient query, verified:**

```json
{"jsonrpc":"2.0","id":1,
 "method":"account_history_api.get_account_history",
 "params":{"account":"loviswater","start":-1,"limit":1000,
           "include_reversible":true,"operation_filter_low":262144}}
```

…then filter client-side on `op.value.id == "bnr.anchor"`.

**At current scale the entire anchor chain is one call.** The account has **25 custom_json ops total** (13 `community`, 11 `follow`, 1 `bnr.anchor`) — a single 1000-row page covers all of history with 40× headroom. You will not need pagination until ~1000 custom_json ops; at hourly anchoring that is ~41 days. Then paginate backwards using the lowest returned index as the next `start`.

### Genesis anchor — sample response, on-chain and verified

```
hist_index:    167
block:         108404167
timestamp:     2026-07-24T04:37:03
trx_id:        7d404d75b82ac38fc5b27b1dd4cf2727c9c583b8
posting_auths: loviswater
json_len:      620
```
```json
{"v":1,"seq":0,"type":"genesis","kernel":"beehive-nature-reserve-kernel",
 "declare":"Genesis anchor of the Beehive Nature Reserve Kernel. The canonical pointer set is mirrored to two or more independent rails by law; every chain that carries it, this one included, is a read rail and never the foundation. Built for ten billion possible souls, to last a thousand years, at no cost beyond what is already given.",
 "root":"8797d66222327758ad245eeae7afffbbe3a73794",
 "root_ref":"git:beehive-nature/beehive-nature@8797d66222327758ad245eeae7afffbbe3a73794",
 "mirror":["arweave"],
 "law":"10e9 users / 1000 years / zero added cost"}
```

620 bytes confirmed — matches the payload your 368,692,399 RC measurement was taken against.

**Add to build-out queue item 2:** single-node dependency is a availability risk. Add fallbacks — `anyx.io`, `api.deathwing.me`, `techcoderx.com`. `api.hive.blog` publishes no hard rate limit but throttles under load.

---

## ORDER 4 — RC delegation and anchor cadence ⚠️ MATH CORRECTED

### Your regen constant is wrong, and it is load-bearing

`HIVE_RC_REGEN_TIME` = **432,000 seconds = 5 days = 20.00%/day**, not 18.13%. Every downstream figure in the order moves.

### Measured account state (live, 2026-07-24)

```
max_rc:                      5,637,013,468
current_mana:                5,268,321,069
max_rc_creation_adjustment:  5,622,320,093
vesting_shares:                 14.693375 VESTS
delegated / received:            0.000000 VESTS
own_HP:                          0.009085
total_vesting_fund_hive:   213,309,553.678 HIVE
total_vesting_shares:  344,975,687,253.305329 VESTS
```

### The structural finding your order missed

**99.74% of your max_rc is a one-time account-creation grant, not stake.**

```
stake-derived RC = 5,637,013,468 − 5,622,320,093 = 14,693,375
vesting_shares                                   = 14.693375 VESTS
```

Those are the same number. **Stake-RC equals raw VESTS 1:1** — i.e. **1 VEST = 1,000,000 RC**. That is your VESTS→max_rc conversion, derived from your own account rather than from a forum post. @loviswater holds **0.009 HP**. Effectively zero stake.

### Corrected cadence math

```
HP↔VEST:   1 HP = 1 / 6.183321e-4 = 1,617.24 VESTS = 1.61724e9 RC

Current sustainable:
  5,637,013,468 × 0.20        = 1,127,402,694 RC/day
  ÷ 368,692,399               = 3.06  →  3 anchors/day   (your order said ~2)

Hourly target (24/day):
  24 × 368,692,399            = 8,848,617,576 RC/day
  required max_rc ÷ 0.20      = 44,243,087,880          (your order said 48.9B)
  − creation adjustment       = 38,620,767,787 stake-RC needed
  ÷ 1e6                       = 38,620.77 VESTS
  × 6.183321e-4               = 23.88 HP
```

### Recommendation — the gap is not what it looks like

> **Stake ~24 HP. That is the whole answer.**

Your order framed this as a ~43.2B RC procurement problem and sent me looking for delegation charities. In RC units it *is* a large number. **In stake units it is roughly 24 HIVE powered up** — a trivial purchase, self-custodied, permanent, and it makes you independent of anyone else's goodwill.

Verify: `23.88 HP × 1.61724e9 = 3.862e10` stake-RC `+ 5.622e9` grant `= 4.424e10` max_rc `× 0.20 = 8.85e9`/day `÷ 3.687e8 = 24.0 anchors/day` ✓

### ⚠️ CORRECTION (appended post-review) — 23.88 HP is a snapshot price, not a fixed one

I should have caught this before shipping the figure. **RC cost per operation is demand-dependent, not constant.** Verified live:

| Resource | pool | pool_eq | state |
|---|---|---|---|
| `resource_history_bytes` | 24,138,424,039 | 27,050,539,251 | **10.8% below equilibrium** |
| `resource_execution_time` | 65,507,566,265 | 69,256,028,844 | 5.4% below |
| `resource_state_bytes` | 26,139,716,809,806 | 27,139,923,979,692 | 3.7% below |
| `resource_market_bytes` | 1,981,626,441 | 2,003,755,169 | 1.1% below |
| `resource_new_accounts` | 10,473,771 | 157,691,079 | 93.4% below |

Pool below equilibrium ⇒ **price above baseline**. `history_bytes` is the resource that scales with custom_json payload size, and it was sitting ~11% below equilibrium when the 368,692,399 RC measurement was taken. **That measurement was made at an elevated price.** As the pool recovers the anchor gets cheaper; under network congestion it gets more expensive.

**Consequence:** sizing stake at exactly 23.88 HP leaves **zero margin**. Any rise in network-wide demand drops you below 24 anchors/day with no warning.

**Revised recommendation: stake 36–48 HP (1.5–2× computed) for hourly anchoring.** Still a trivial purchase, and it absorbs congestion swings. The order-of-magnitude conclusion is unchanged — this is a stake problem measured in tens of HIVE, not a delegation problem — but do not commit the bare 23.88 to the board as a price.

**Also unverifiable as claimed:** I could not empirically confirm the 20%/day regen from two live samples. `rc_api.find_rc_accounts` returns the **stored** manabar, not a projection — `current_mana` and `last_update_time` were byte-identical across samples 6 hours apart because no RC-consuming operation occurred in between. The 20%/day figure rests on the documented `HIVE_RC_REGEN_TIME` constant, which is solid, but empirical confirmation requires broadcasting an op and diffing. Bundle it with the 150-byte measurement.

**Do not pursue RC delegation as the primary path.** Delegation is revocable at the delegator's whim, which is a terrible foundation for a chain whose entire premise is durability. It is worth having as a bridge, not a base.

### `delegate_rc` mechanics (for completeness)

- **Not a native operation.** It is a `custom_json` with id `rc`, params `{from, delegatees, max_rc}`.
- **Posting authority** — deliberately, to limit account risk. Relevant to your key-rotation plan: rotating the posting key rotates RC-delegation control *and* anchor-posting control together.
- **Revocable at will** by the delegator setting `max_rc` to 0. No lockup, no notice.
- Delegations are not queryable as first-class state — you must scan and parse `custom_json` history (HiveSQL's `TxCustoms`), same client-side-filter problem as ORDER 3.
- `RC Angel` exists as a community RC-pool service. Bridge-grade, not foundation-grade.

### Smaller-anchor alternative — bounded, not asserted

Measuring the 150-byte cost requires broadcasting, which is fenced. What I can say honestly:

- HF26 made custom_json cost **directly proportional to size**.
- **If cost were purely linear**, 150 bytes → ~89.2M RC → **12.6 anchors/day at current stake**. That is an *upper bound*.
- Real RC cost = state + execution + history components; only the history term scales with bytes. There is a non-zero floor, so the true figure is **below 12.6/day**.
- **Do not plan against 12.6.** Measure it: post one 150-byte anchor, diff `rc_manabar.current_mana` before and after. One broadcast buys you the exact coefficient. That is a human action (needs the posting key) — not dispatchable.

---

## Consolidated edits for future orders

1. **Specify execution context.** "On host, not sandbox." The sandbox has no egress; three of four orders were undeliverable there.
2. **Let accept criteria admit absence.** ORDER 2 demanded a constant that does not exist. Add: *"'No constant exists; value is runtime-derived from X' is a passing answer."* As written, the criteria rewarded invention.
3. **Verify constants before building math on them.** The 18.13% regen figure propagated into four downstream numbers and a wrong strategic conclusion.
4. **Check internal consistency.** "~2 anchors/day" contradicted the order's own inputs (they imply 3.06). The mismatch was visible without any external lookup.
5. **Pin repo *and* crate version.** `maidsafe/autonomi` is legacy; `ant-networking` is gone; `ant-node` v0.14.3 ≠ CLI v0.3.1.
6. **Distinguish consensus from 2nd-layer.** `bridge.*` is HiveMind and can lag independently. Never anchor-truth from it.

## Open items — not done, not faked

- `ant-protocol` 2.3.0 unread → `CLOSE_GROUP_SIZE`, `MAX_CHUNK_SIZE`, `MAX_WIRE_MESSAGE_SIZE`, `REPLICATION_MESSAGE_SIZE_MIB` still unresolved
- `saorsa-core` 0.26.2 unread → all real DHT/networking memory
- Node-binary version installed by `ant node add` unverified against v0.14.3
- 150-byte RC coefficient needs one broadcast to measure
- ~~`ant node/wallet/file/chunk` subtrees at 0.3.0 not captured~~ → **CLOSED.** Full 19-subtree diff run against the v0.3.0 release; 0 differences. See §4.3 CLOSED above.
- Live HIVE price not checked; the ~24 HP figure is stake-denominated only
