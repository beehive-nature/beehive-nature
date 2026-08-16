# DISPATCH — Studio / LaunchPad work split, and the bullpen

**From:** Seat 3 (Claude Code) · **2026-08-16** · founder-directed
**Status:** OPEN — goose lane is ready to start; bullpen lanes are staged, not assigned.

Founder: *"lets put goose in the game. I think you have your hands full. then design in the
bullpen just in case they are needed."*

---

## 0 · What already exists, so nobody rebuilds it

| artefact | state |
|---|---|
| `crates/inscription-gate` | **NEW, 11/11 tests green, compiles to `wasm32-unknown-unknown`** |
| `docs/SPEC-INSCRIPTION-COMPAT-1.md` | three tiers, four ABI shapes, the measured thresholds |
| `docs/SPEC-ERC20I-MECHANICS-1.md` | the standard decoded — **carries two known defects, see §3** |
| `surfaces/blight/inscription-explorer.html` | live: 7 tokens, 2 chains, live + frozen art, wallet-as-provider |
| `surfaces/blight/museum.html` | live: Autoglyphs score vs ERC-20i picture, both from chain |
| `docs/receipts/evmcheck.py` | exSat opcode gate, with controls |
| `bnri-cosmic/src/hex_renderer.rs` | the existing codec — **AGPL-3.0-only, pointy-top, grid hardcoded 0..=95** |

Published: `https://beehive-nature.github.io/beehive-nature/` (explorer at
`surfaces/blight/inscription-explorer.html`, museum at `museum.html`).

---

## 1 · GOOSE LANE — the PixelLab adapter (ready now, no blockers)

The one piece of the Studio that is fully specified, independently testable, and does not
touch anything Seat 3 has open.

**Build `crates/adapter-pixellab`.**

The API surface is confirmed live at `https://api.pixellab.ai/v1/openapi.json` — 8
endpoints: `generate-image-pixflux`, `generate-image-bitforge`, `animate-with-skeleton`,
`animate-with-text`, `rotate`, `inpaint`, `estimate-skeleton`, `balance`.

**Contract with the rest of the Studio — the whole interface, deliberately small:**

```
prompt + style anchor + layer name  ->  PNG with alpha
```

Anything meeting that enters the same gate and the same encoder. **The adapter must not
know what a trait is**, and the Studio must not know which generator produced a PNG.

**Requirements:**

1. **Key from a file (`--key-file`), never an environment variable — MCP children get a scrubbed environment and `${VAR}` interpolation does not happen (buzz's own persona-spec example showing `${GITHUB_TOKEN}` is wrong; env-passed keys silently 401). Never a literal, never a prompt, never a log line.** *(Corrected in place 2026-08-16, goose lane, per Seat 3's read of `buzz-persona/src/resolve.rs`; this line originally said "environment variable".)*
2. **`GET /balance` before any spend, and after.** The founder has ~2,000 generations; a
   runaway loop is real money. Refuse to start a batch that could exceed a declared budget.
3. **Determine from the OpenAPI schema, and report back**, whether these exist:
   - a **style/reference image** parameter — the anchor workflow depends on it
   - **transparency / background removal** — trait layers need alpha from step one
   - palette or colour-count control
   - the exact **cost per call** per endpoint
   These four answers decide the Studio's generation flow. Read the schema; do not infer.
4. **Zero generations spent to build it.** Mock the transport, test against recorded
   fixtures. The first real call should be a deliberate, founder-present act.
5. Async, cancellable, with progress. Generation takes seconds to minutes.

**MCP deployment constraints (folded in 2026-08-16 from Seat 3's post-read of `buzz-agent/src/mcp.rs` — this dispatch was written before that file had been read):**

- The adapter is an **MCP server** (stdio child of buzz), not a standalone daemon.
- `MAX_SCHEMA_BYTES 4096`: oversize tool schemas are **silently replaced with `{}`** — it presents as a model failure, not a config failure. The adapter's tests assert every schema serializes under that budget.
- **One MCP command per agent**: pointing buzz at this server replaces its own tools. The surface stays at exactly two tools — `generate_image` and `get_balance` — deliberately the whole art lane.
- `RawContent::Resource` flattens to `[resource elided]`: blob-by-reference is dead. The adapter **writes the PNG itself** and returns a text handle (absolute path + metadata).
- Balance is **USD credits (float)**, not a generation count (`GET /balance → CreditsResponse { type: "usd", usd }`), and **cost-per-call is not declared anywhere in the OpenAPI** — it can only be *measured* as the before/after balance delta. The spend cap is therefore denominated in USD, and every generate call reports its measured spend.

**Explicitly NOT in scope for this lane:** prompt authorship, trait taxonomy, anything
touching the gate or the encoder.

### Why this lane and not another

PixelLab's ToS **§4 incorporates CreativeML Open RAIL-M by reference**, and RAIL-M's
definition of *Distribution* covers offering a model as a hosted service to third parties.
**The founder's own mint is clean** (ToS §1.3, §3.3 grant output ownership for commercial
use). **The LaunchPad must never call a generator on a stranger's behalf** — the artist
brings their own generator and their own licence. Keeping the adapter behind a narrow
interface is what makes that boundary enforceable rather than aspirational.

---

## 2 · THE BULLPEN — staged, not assigned

Each is independently startable and does not collide with the goose lane or with Seat 3.

### B-1 · Encoder v2 (Rust, measured wins, no new research needed)

Three wastes measured across all seven reference pieces:

| change | effect on the genesis piece (16,216 B) |
|---|---|
| drop the always-zero pad byte | −2,027 B (12.5%) |
| palette index instead of 24-bit colour | ~10,200 B total (**−37%**) |
| vertical merging (currently `height` is always 1) | further, unmeasured |

Matters because **004 · Forager is 20,136 B — 82% of a single 24,576 B SSTORE2 blob.**
Must keep the golden vectors, which are already declared *"Shared between Rust and
Solidity."* **Bump the format version; do not silently change the wire format.**

### B-2 · The `.b` + ENS resolver (proven, unbuilt)

All three paths verified working:

| name | path | chain |
|---|---|---|
| `*.b` | `kingbeelovis` `domains` → `chainaddrs`, CAIP-2 keyed | Vaulta |
| `*.base.eth` | registry `0xB947…5a95` → resolver → `addr` | Base |
| `*.eth` | registry `0x0000…2e1e` → resolver → `addr` | Ethereum |

`jesse.base.eth` resolves end to end as the control. Three states must be distinguished:
**unregistered** (owner zero), **lapsed** (owner set, past `expires`), **current**. Must
cache and **degrade to the raw address** — a naming outage must never break a render.
Note `remington.b` expires **2027-08-01**.

### B-3 · Museum: the process wall

The compare view exists (`v1` vs `v2`, same seed). What is missing is the *why*: the
empty `earsLevelCounts` layer, the underflow that blocks locking on FUNGI, the 1,408 bytes
of difference between two PEPi contracts and what they bought. **Show the errors, not only
the artefacts** — founder's stated intent, and the corrections belong on the wall.

### B-4 · Trait decomposition (research, unblocks nothing yet)

Getting ~180 sparse layers out of whole-image generators. Per-trait generation against a
style anchor is the recommended route; segmentation of finished sprites at 48×48 is the
open question. **Blocked behind C-1** for the numbers, not for the technique.

### B-5 · exSat deploy rehearsal

`evmcheck.py` exists and has controls. What is missing is a **testnet rehearsal of upload
order**, because `counts[]` is increment-only and is the selection modulus — **one
out-of-order batch permanently poisons a level**, which is how `earsLevelCounts` shipped
`[0,0,0,0,0,0]`. Rehearse before mainnet, not during.

---

## 3 · KNOWN DEFECTS IN COMMITTED WORK — Seat 3 owns these, listed so nobody builds on them

1. **`SPEC-ERC20I-MECHANICS-1` attributes Ethereum line numbers to Base.** Base is 344
   lines, declares three events, and has **zero** occurrences of `OnItemBurn` or
   `transferItem`. **Base and Ethereum are two different standards sharing a name** — Base
   keys on seed-value with per-owner uniqueness, Ethereum on globally-unique item ids.
2. **`SPEC-INSCRIPTION-COMPAT-1 §1.2` presents `sporesDegree` as universal. It reverts on
   FROGGi.** The seed source is no more universal than the renderer.
3. **The explorer's market panel overstates swap risk.** Measured: the debit is
   `floor(bal) − floor(bal − amount)`, so **loose spores absorb the trade first** — a
   holder with a 107-spore cushion sold 25 tokens and lost nothing. Destruction happens
   only when the whole-token delta exceeds the cushion. Warning on every swap trains users
   to dismiss the warning that matters.

---

## 4 · FOUNDER GATES — these block real work

| | | blocks |
|---|---|---|
| **C-1** | **Trait taxonomy** — layers, and variants per layer | Studio layer model, LaunchPad schema, all bulk art, B-4's numbers |
| **C-3** | **GRID** — 48 recommended; frozen at deploy as a compile-time constant | encoder, gate thresholds, art authoring |
| **C-2** | Is tier 2 (id-addressed transfer) mandatory for LaunchPad output? | marketplace safety by construction |

**C-1 is the expensive one.** ~30 variants across 6 layers, times a colour axis, gives ~30
billion combinations — enough to hold expected collisions under 0.01 at ~5,000
inscriptions. That is ~**180 components**, each far smaller than a full sprite.

---

## 5 · STANDING RULES FOR ANY SEAT TAKING A LANE

- **Receipt rule.** The pasted command and its real unedited output, or it did not happen.
- **A failed fetch is never a value.** Three times in one session a failure read as zero or
  absent: 48 selectors "not found" that were present, a pool reported holding 0
  inscriptions that was unreachable, and a wallet's frozen art rendered as an empty
  collection. **Run a control before reporting an absence.**
- **Read the code before reasoning about it.** Every wrong claim this session came from
  reasoning about a file that had not been opened.
- **Quote whole sentences.** A source line was quoted here as evidence of safety when the
  next line reversed its meaning.
- **Never `--no-verify`.** Repos are public; the pre-commit scan is the gate.
- Corrections go **in place, on the wall**. The lineage this project documents is made of
  errors, and hiding ours would be the one dishonest exhibit.
