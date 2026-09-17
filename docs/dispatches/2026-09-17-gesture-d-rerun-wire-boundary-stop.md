# GESTURE D — ceremony rerun: boot REPAIRED and LIVE-PROVEN; stopped at the door's wire boundary (2026-09-17)

**Wake order (founder, 2026-09-17):** deadlock-builder GREEN merged to main
(`5d4d7569`) → executor wakes → re-SYNC → rebuild/restage from merged main →
rerun the staged ceremony unchanged. Standing boundaries honored verbatim:
IF-1..IF-4 not implemented from this seat; stop at the next real seam; AV-6b
specified-only; production unauthorized; P2 frozen; the previously crossed
Base Sepolia signature boundary stays at its existing tier (never promoted to
payment/settlement).

**Verdict: the repaired door BOOTS — F1 live-proven GREEN. The ceremony then
stopped at its next defined step, the multi-leg beat: the door's wire
boundary refuses the REAL x402 v2 payer wire for every scheme.** A new
integration finding (proposed IF-5) is banked and routed to Astra. No drill
leg executed; nothing promoted; the journal is pristine.

## 1 · Pre-flight — ALL GREEN (repaired binary)

- **Source/build correspondence:** box checkout
  `/home/ubuntu/beehive-nature` at `5d4d7569` (door tree clean; the repair
  present in source — `LockGuard::Held`/`mutation_lock` in `journal.rs`).
  Built `cargo build --release --locked --features live-wiring` under sudo
  (root-owned target tree, the prior staging's ownership), rustc 1.98.0
  (88d9e12ae 2026-08-18), 3m22s.
- **NEW binary sha256:** `f251550210b6f4fc80d1289e98c070873a8918a2f3df0160aa0ddf8e2859a298` PUBLIC-CONSTANT (10,723,512 bytes, 2026-09-17 08:32:23 UTC).
- **SUPERSEDED:** `830b0613…6dfc71` — evidence for the pre-repair binary
  only, never for the repaired one.
- Preflight battery (kit, unchanged): chainId `0x14a34` (84532 Base
  Sepolia), block `0x2cc237e`, ETH 1,999,440,708,823,927 wei (≈0.002),
  USDC 900,000 base units (0.9), live DOMAIN_SEPARATOR matches
  {USDC,2,84532} True, kit key → `0xb43b…37af` OK, door binary sha = the
  NEW sha above, configs hashed (`/opt/x402-door.chains.json`
  `2c900d86…3ead` env-ref zero-secret; `/opt/x402-door.config.json`
  `bb8a3ae4…5bd0`: loopback 127.0.0.1:18042, journal `/var/lib/x402-door`,
  cap 200T/reserved 150T/float 400T wei, chain 84532).

## 2 · F1 boot acceptance — GREEN, live (the bar that stopped the last pass)

- `kit.py doorstart t2` → doorwrap pid 3578036 → **log line:
  `x402-door listening on 127.0.0.1:18042 (loopback; Caddy fronts the
  same-origin door)`** — the line that could never print on the pre-repair
  build (prior evidence: empty log, kernel stack `locks_lock_inode_wait`).
- `ss`: `LISTEN 127.0.0.1:18042` by `x402-door` pid 3578036.
- Journal after boot: pristine (only `.lock`) — `recover_stranded_settling`
  ran UNDER the exclusive hold and completed. No deadlock at any point.

## 3 · Multi-leg beat — STOPPED at the wire boundary (new finding, IF-5)

The first live POSTs through the door in its history; all refused at leg
extraction, same named path, journal untouched (fail-closed):

| leg | shape | door answer |
|---|---|---|
| fresh exact, kit `exact ml1 1` (nonce `0x2edc33f8…df1eb`) | real x402 v2 EIP-3009 | `400 missing path /paymentPayload/payload/from — refusing (fail-closed)` |
| prior pass's stored leg `0x628a65b8…cc45` (static-validated PASS against live USDC, §5 of the stop receipt) | real x402 v2 EIP-3009 | same `400`, same path |
| upto leg, kit `upto` | real x402 v2 Permit2 | same `400`, same path |

Door log (R4-safe, `logs/door-t2.log`): one `verify refused` + two
`settle refused` lines naming leg extraction; zero reservation files after
every refusal.

**Mechanism, verified at source both sides:**

- Door `wire.rs::extract_leg` reads ONLY flat paths
  `/paymentPayload/payload/{from,nonce,validBefore,value|maxAmount}`
  (camelCase/snake_case variants) — it never looks under
  `payload.authorization` or `payload.permit2Authorization`.
- Upstream `x402-chain-eip155` 2.0.2 `v2_eip155_exact/types.rs` re-exports
  `Eip3009Payload = ExactEvmPayload { signature, authorization: { from, to,
  value, validAfter, validBefore, nonce } }`, and the V2 facilitator
  deserializes ONLY nested shapes (`FacilitatorVerifyRequest` untagged enum:
  Eip3009 | Permit2 — both nest the payer fields).
- The two constraints are disjoint: no payload satisfies the door's
  extractor and upstream's serde at once. The flat shape exists only in the
  door's own test fixtures (acceptance/adversarial suites) — the exact
  mock-vs-reality discrepancy Gesture D exists to uncover, now proven at the
  live seam.

**Classification:** NEW integration finding, **proposed IF-5** — *the door's
wire extraction rejects the real x402 v2 payer wire for ALL schemes* —
broadening IF-1 (upto-only) to scheme-wide; same wire-compatibility family.
Per the wake order: STOP here, bank, classify, route to Astra. NOT repaired
from this seat (a wire-boundary rewrite is architecture reconciliation).

**Not executed, honestly:** settle beats, AV-6a (already structurally
unreachable per the stop receipt's F5), AV-5 (requires settled legs), AV-4
journal scan (journal empty — nothing to scan), reconciliation (no figures).
All remain unmet BEHIND the boundary; nothing was forced.

## 4 · AV-8 boot-law beat — GREEN, live

- `doorkill9` → `not-running`, listener gone — the kernel released the
  process-lifetime hold instantly (D-5's crash-release semantics live).
- `doorstart t3` → pid 3591210 → `listening` line again — `open_exclusive`
  re-acquired after the crash, recovery under the hold, bind. Journal
  pristine.
- The stranded-Settling restart variant stays at library proof (merged
  `boot_exclusive` suite, CI-green on `5d4d7569`): producing a stranded
  record live requires legs through the wire boundary, and fabricating
  journal state on the box would be fix-forward — refused.

## 5 · Clean close + tiers

- Door stopped (`not-running`), listener gone; journal EMPTY + coherent
  (only `.lock`, 0 records) before and after; secret scan 2,925 files under
  `~/x402-ceremony/` → 0 raw-key-byte hits; kit/reqs/logs banked in place;
  the repaired binary LEFT STAGED (`f2515502…`) for the pass after Astra's
  wire ruling.
- **Base Sepolia signature boundary: NOT re-crossed** — no transaction sent,
  no nonce consumed (zero `consume` calls; the stored leg's nonce remains
  unspent). Its tier is unchanged: static verification only, never
  payment/settlement.
- **D(testnet): NOT earned. Gesture D: BLOCKED_INTERNAL — at the NEW seam
  (IF-5).** Production unauthorized; AV-6b specified-only; P2 frozen.

## 6 · Routing

- ASSURANCE-LEDGER board updated by this PR (anchored after the Standing
  line — no overlap with #93's pending insert).
- IF-5 belongs in the INTEGRATION-FINDINGS-QUEUE (that file lives on #93's
  unmerged branch; untouched from this seat). Verbatim item for the queue
  owner, to prevent drift:

> **IF-5 — door wire extraction rejects the real x402 v2 payer wire (all
> schemes).** Live-proven 2026-09-17 (ceremony rerun receipt §3): the door's
> `wire.rs::extract_leg` reads flat `paymentPayload.payload.{from,nonce,
> validBefore,value|maxAmount}`; upstream v2 (x402-chain-eip155 2.0.2)
> carries ONLY nested shapes (`authorization.*` for EIP-3009,
> `permit2Authorization.*` for Permit2; V2 facilitator enum accepts nothing
> else). Disjoint — no payload passes both. Blocks every live leg at the
> door boundary before the facilitator is consulted; subsumes IF-1's upto
> case. Architecture reconciliation BEFORE implementation (extraction
> rewrite touches LegKey construction, the door's test fixtures, and the
> IF-2/IF-3 seams behind it).

- **Next owner: Astra** — architecture reconciliation of the wire-boundary
  family (IF-5 + IF-1..IF-4 + the stop receipt's F3/F5 seams) as one
  ruling. After the ruling, the Gesture-D seat re-runs this SAME order
  again: kit, driver, config and the staged repaired binary are all in
  place.

— zCode Gesture-D executor seat, 2026-09-17 (UTC). Claim → evidence →
boundary not crossed: every claim above carries its log line, sha, or
source path; the door's serving ability is claimed ONLY at boot/restart —
no leg ever passed its wire boundary.
