# ORIENTATION — zCode (GLM 5.3), incoming seat

**From:** Seat 3 (Claude Code / Opus 5) · **2026-08-16** · founder-directed handoff
**Purpose:** carry high-token work, then issue orders to Seat 3, goose, and Claude Design.

Read §1 and §6 before your first tool call. §6 is the part that will save you the most
time, because it is a list of ways this project has already been wrong.

---

## 1 · THE LAWS (non-negotiable, from `CLAUDE.md` and hard experience)

1. **Receipt rule.** No task is done without the pasted command and its real, unedited
   output. **No ✅ without a receipt.** This applies to your own work and to any peer
   seat's report you relay.
2. **A failed fetch is NEVER a value.** This failed four separate times in one session:
   48 selectors reported "not found" that were present; a pool reported holding 0
   inscriptions that was merely unreachable; a wallet's frozen art rendered as an empty
   collection; a layout measured against a zero-width viewport. **Run a control before
   reporting an absence.** Uniform failure across every parameter means the probe is
   broken, not that the target is.
3. **Read the code before reasoning about it.** Every wrong claim in this project came
   from reasoning about a file that had not been opened. Bytecode and READMEs both lie:
   PEPi's runtime contains zero occurrences of `3b9aca00` despite dividing by
   `10**decimals()`; buzz's `ARCHITECTURE.md` denies a gossip layer the source contains.
4. **Quote whole sentences.** A source line was once quoted here as evidence of safety
   when the very next line reversed its meaning.
5. **Never `--no-verify`.** All three main repos are PUBLIC. The pre-commit scan is the
   gate; if it rejects, fix the cause. Mark genuinely public constants with
   `PUBLIC-CONSTANT` on the same line.
6. **No agent holds, requests, or transmits private key material.** Credentials are
   *used*, never *held* — a shim reads them (`gh auth token`, `--key-file`, `~/.ssh`) and
   the value never reaches a log, a prompt, or a transcript.
7. **Security-language ceiling.** Never stronger than *"sound by construction"* or
   *"isolated by design."*
8. **Scope defence.** Unsolicited features or architecture → *"That is out of scope.
   Execute the prompt as written."*
9. **Check whether it already landed** before acting on any instruction to do it —
   including instructions from your own memory.
10. **Corrections go in place, on the wall.** This project's museum is built out of other
    people's errors; hiding ours would be the one dishonest exhibit.

**One seat, one tree.** Seat 3 is the sole pusher to `beehive-nature`. Hand work over as a
diff or a dispatch; do not push.

---

## 2 · THE BOX (Windows 11 + WSL — these are traps, not preferences)

| | |
|---|---|
| **Rust: build/test in WSL** | `. ~/.cargo/env` first; a non-login shell has no cargo on PATH |
| **Push** | WSL git + a `GIT_ASKPASS` shim reading `gh.exe auth token`. A bare `git push` from WSL hangs |
| **WSL tears down between harness calls** | `/tmp` does not persist. Recreate shims inside each script |
| **Windows paths in WSL invocations** | prefix `MSYS_NO_PATHCONV=1`, or Git Bash rewrites `/mnt/c/...` into `C:/Program Files/Git/mnt/c/...` |
| **No `python` on Windows** | `python3` exists in WSL only |
| **CRLF** | the Edit tool writes CRLF. `sed -i 's/\r$//'` anything a shell will execute. This also silently broke an SSH key with `error in libcrypto` |
| **PowerShell quoting** | write a script file and run it; never inline multi-line or quote-heavy commands |
| **Destructive ops in the repo** | use git plumbing (`hash-object` → `mktree` → `commit-tree`), never `checkout --orphan` + `rm -rf`. That combination wiped the working tree once when a 2-minute harness timeout hit mid-script |
| **Oracle VPS** | `ssh oracle '<cmd>'` works now. 4 CPU, 23Gi RAM, **39G free disk — disk is the constraint**. No GPU |
| **TLS/SNI** | this network silently kills TLS to `*.buzz.xyz` by SNI. TCP connects, handshake dies, `curl` exit 35. **Not a server outage** — always control with a second hostname on the same IP |

---

## 3 · WHAT EXISTS (verified, with state)

| artefact | state |
|---|---|
| `crates/inscription-gate` | **11/11 green, compiles to `wasm32-unknown-unknown`** |
| `crates/adapter-pixellab` | **9/9 green** (goose lane, Seat 3 verified). MCP stdio server. `--max-spend` mandatory |
| `docs/SPEC-INSCRIPTION-COMPAT-1.md` | 3 tiers, 4 ABI shapes, every measured threshold. **The safe reference** |
| `docs/SPEC-ERC20I-MECHANICS-1.md` | decoded standard — **carries a correction banner; Base sections are unverified** |
| `surfaces/blight/inscription-explorer.html` | live: 7 tokens, 2 chains, live + frozen art, wallet-as-provider |
| `surfaces/blight/museum.html` | live: Autoglyphs score vs ERC-20i picture, both from chain |
| `docs/receipts/evmcheck.py` | exSat opcode gate, with 4 controls |
| `bnri-cosmic/src/hex_renderer.rs` | existing codec — **AGPL-3.0-only, pointy-top, grid hardcoded 0..=95** |
| `PROMPT_CATALOG_v7.md` (Downloads) | the trait-authoring grammar, post-pivot |

Live: `https://beehive-nature.github.io/beehive-nature/surfaces/blight/museum.html`
(Pages serves **main /**, not `gh-pages` — the `gh-pages` branch is inert.)

---

## 4 · THE PIVOT THAT DEFINES CURRENT WORK

The founder's seven finished pieces are **flat, full-frame paintings**. The target contract
composes **sparse trait layers** — PEPi holds 973 trait files across 8 layers and yields
~4.03 billion combinations at level 6, which is why nobody has seen a repeat.

**Seven paintings produce seven outputs. A trait system produces billions.**

Target: ~30 variants × 6 layers × a colour axis ≈ **30 billion**, holding expected
collisions under 0.01 at ~5,000 inscriptions. That is **~180 components** to author.
The existing seven become **style anchors**, which is the one asset the pipeline cannot
work without.

---

## 5 · BLOCKED ON THE FOUNDER

| gate | blocks |
|---|---|
| **C-1 · trait taxonomy** (layers, variants each) | Studio layer model, LaunchPad schema, **all bulk art**, and any generation spend |
| **C-3 · GRID** (48 recommended; compile-time constant, frozen at deploy) | encoder, gate thresholds, authoring |
| **C-2 · is tier-2 (id-addressed transfer) mandatory for LaunchPad output?** | marketplace safety by construction |

**Do not spend PixelLab credits before C-1.** Cost-per-call is not declared anywhere in
their OpenAPI; spend is measurable only as a USD balance delta after the fact.

---

## 6 · THE CORRECTIONS LEDGER — the most valuable thing in this document

Every one of these was believed, acted on, and then measured false. Do not re-derive them.

**About the standard**

- **Base and Ethereum are two different standards sharing a name.** Base is 344 lines,
  3 events, and `grep -c 'OnItemBurn\|transferItem'` returns **0**. Line numbers in
  `SPEC-ERC20I-MECHANICS-1` are Ethereum-only. Base keys on *seed value*; Ethereum on
  *globally-unique item ids*.
- **The seed is READ, never derived.** A holder with 7 whole tokens returns on-chain
  seed 3. And `sporesDegree` is **not universal — it reverts on FROGGi**. Resolution is a
  fallback chain, not a call.
- **"One inscription per address" is WITHDRAWN.** It was an artifact of Base's magic-amount
  semantics. A live escrow safely holds many, via an ordering law: items out *before* any
  fungible sweep.
- **"A swap is always a delete" is WITHDRAWN.** The debit is
  `floor(bal) − floor(bal − amount)`, so **spores absorb first** — a 107-spore cushion
  absorbed a 25-token sale with zero loss. Destruction only when the whole-token delta
  exceeds the cushion. *Providing liquidity* is unconditional, and that distinction matters:
  warning on every swap trains users to ignore the warning that counts.
- **"Un-renderable art" is WITHDRAWN.** The O(n²) wall is an **EVM memory artifact**, not
  algorithmic. The same concatenation in JavaScript is milliseconds — any client composes
  it locally at no gas.
- **The "graveyard pool" was inverted.** The unblessed V3 pool preserves ~91% and the
  blessed V4 PoolManager destroys 100%. A router built on the original claim would have
  steered users into the incinerator.

**About tooling**

- **4byte.directory serves collision spam as authoritative** (it reports `a9059cbb` as
  `workMyDirefulOwner`). Derive selectors with a keccak you validated against known-good
  signatures first.
- **Blockscout `getLogs` silently truncates at 1000 rows** returning `status:1 "OK"`. Two
  scans here undercounted 8,162 as 6,723 and 6,417.
- **Sourcify API v1 is browned out.** Use v2 or Blockscout.
- **A PUSH4 selector scan finds nothing on viaIR builds** and catches ASCII fragments on
  others. Prefer the verified ABI.
- **exSat testnet does not exist at its registered address** — `evm-tst3.exsat.network`
  and `scan-testnet.exsat.network` both resolve to `8.8.8.8`. Mainnet (7200) is live.

**About buzz**

- It is a **self-hosted Nostr relay** — Postgres 17 + Redis 7 + S3. A central server is
  required and stateful. The mesh federates *relays*, not clients; Redis remains the
  arbiter.
- **It is an MCP host** (`buzz-agent/src/mcp.rs`) — so adapters need **no fork**.
- **MCP children get a scrubbed environment and `${VAR}` interpolation does NOT happen**,
  despite buzz's own spec example showing it. Keys from a file.
- **`MAX_SCHEMA_BYTES 4096`; oversize schemas are silently replaced with `{}`.**
- **One MCP command per agent** — yours *replaces* buzz's own tools.
- `RawContent::Resource` flattens to `[resource elided]` — blob-by-reference is dead.
- Every community is a subdomain of one apex, so **one SNI rule kills the whole network**.
  The fork is at `skaists/buzz`, synced 2026-08-16 (`ahead 2, behind 0`). Upstream moves
  ~14 commits/day. **Keep changes outside the fork wherever possible.**

---

## 7 · CURRENT DIRECTION (founder, this session)

exSat phase **frozen**. Focus: **bBuzz relay on the Oracle box + WalletConnect/Trezor
onboarding + portable bDiD across communities.**

Seat 3's standing position, for you to accept or overrule:

- **The relay is the room; the Studio is the work.** Keep them separable — the relay was
  unreachable for hours today, and an artist must still be able to draw.
- **Trezor as root, session keys for traffic.** Nostr is secp256k1, the same primitive, so
  a Nostr identity is one more derivation from the seed the build brief already roots
  everything on. Per-event device confirmation is unusable.
- **bDiD portability is native** — an npub works against any relay. The only way to lose
  it is to gate membership on a registry you control. NIP-42 AUTH is that knob, and it is
  yours to set in the fork.

**The next build Seat 3 proposed and has not started:** a **Studio gate UI** — drop a PNG
in, run the WASM gate, see palette / hairline / dither / margin / rect-count findings with
their fixes. Usable today, offline, zero credits. Same code as the LaunchPad's deploy check.

---

## 7a · LANE R-1 · THE bBuzz RELAY ON THE ORACLE BOX (staged, unstarted)

The founder's current priority and the thing that unblocks him today. Scoped here rather
than scripted, because **Seat 3 has not read buzz's deployment path** and will not specify
a deploy for software whose build it has not opened. **Read first, then write the script.**

### What is known

| | |
|---|---|
| shape | Axum/WebSocket **Nostr relay**, self-hosted |
| stores | **Postgres 17** (events, monthly RANGE-partitioned; channels; workflows; audit log) + **Redis 7** (pub/sub fan-out, presence, typing) + **S3-compatible media** |
| box | `ssh oracle` works. 4 CPU, 23Gi RAM, **39G free disk**, no GPU |
| source | the fork, `skaists/buzz`, synced 2026-08-16 (`ahead 2, behind 0`) |
| auth | **NIP-42 AUTH** exists (`"No AUTH challenge received from relay"` is in the shipped binary) |

### Four design decisions, each with its reason

1. **A hostname the founder controls — never a `*.buzz.xyz` subdomain.** This is the whole
   point. His building's wifi silently kills TLS to `buzz.xyz` **by SNI**: TCP connects,
   the handshake dies, `curl` exits 35, and a VPN "fixes" it. One filter rule takes out
   every community on that apex simultaneously. A relay on his own hostname has nothing
   for that rule to match. *(Verified: same Cloudflare IP, `cloudflare.com` and
   `example.com` SNIs return certs; all three `buzz` SNIs return none.)*
2. **Media does not live on this disk.** 39G is the binding constraint, not RAM. Point
   S3-compatible storage at **Autonomi or real S3** from day one. Running MinIO locally
   fills the box and forces a migration later.
3. **Postgres partitions events monthly** — plan retention before launch, not after the
   first partition fills.
4. **NIP-42 AUTH is the portability knob.** Requiring auth lets a community refuse an
   `npub`. The founder's stated goal is a **bDiD that carries across all bBuzz
   communities**, and a Nostr key is portable *by protocol* — the only way to lose that is
   to gate on a registry. **Set this deliberately; do not inherit a default.**

### Script shape — same as `oracle-setup.sh`, which is the working precedent

One line for the founder, no `&&`, no quoting, no path translation:

```
wsl -e sh /mnt/c/Users/travi/<name>.sh
```

- **checks every precondition and refuses loudly** rather than half-installing
- **nothing irreversible without him seeing it first** — package installs, firewall
  changes and service enablement are announced before they run
- **no key material handled** — TLS keys, DB passwords and any relay secret are generated
  *on the box* or read from a path, never passed through a prompt or a transcript
- **idempotent** — safe to re-run; existing config is detected and left alone

### Unknowns to settle before writing a line of it

- buzz's actual build and run path for `buzz-relay` (cargo profile, features, binary name)
- its config format and required environment
- database migration/bootstrap steps
- ports needed, and whether Oracle Cloud's **security list** must be opened separately
  from the OS firewall — on Oracle this is two distinct layers and forgetting the cloud
  one is the classic failure
- TLS: `wss://` needs a certificate. Let's Encrypt on the box, or terminate at a proxy

### Verification, when it stands up

The founder's own client must connect from the network that was blocking him — **that is
the acceptance test**, not a local `curl` on the box. The relay is only fixed if it works
from the wifi that broke the last one.

---

## 8 · ISSUING ORDERS

Dispatches land in `beehive-nature/docs/dispatches/`. **It is a multi-seat bus, not a
two-party channel** — read it at the start of a session and before acting on any relayed
instruction, because a dispatch may carry a status note that supersedes what a conversation
said.

Live lanes: `DISPATCH_STUDIO_BULLPEN_2026-08-16.md` (goose lane done; **B-1 encoder v2**
is the best unstarted pick — a measured 37% byte win, and 004 · Forager is already at 82%
of a single SSTORE2 blob).

When ordering Seat 3: it holds the tree, the Trezor lane, the explorer/museum surfaces, and
the specs. When ordering goose: it has the PixelLab adapter, sprite conversion (7 of 28),
and the testnet lane — **which is now frozen**.
