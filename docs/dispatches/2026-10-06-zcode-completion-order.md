# 2026-10-06 — the completion order, labored: bSigner frozen, the SETTLE nerve wired, the voucher path converged, the did:b: root lit

**Lane**: `zcode/complete-order-2026-10-06` (worktree `wt-zcode-complete`, from
origin/main `a3006ba66`). **Order**: the founder's revised completion inventory
(`completion-inventory-2026-10-06.md`) and its five-point engineering order.
**Protocol note**: reconciliation before labor, per standing law — the order
was checked against the tip before anything was built, and one of its three
load-bearing factual claims did not survive the check (below).

## 0 · Reconciliation — what the tip actually held

| inventory claim | verified at `a3006ba66` | verdict |
|---|---|---|
| voucher-escrow "is literally the same blob as at `d58caa23`, so its AV-2 hole remains on main" | the blob at BOTH shas is the FIXED one; the Sept-16 GREEN commit `415162d6` reached main via PR #87 (`07c1b7aec`) before `d58caa23`. Rust freshness + single-use: present, tests 17/17 | **claim wrong**; the TRUE hole was the live Python engine + serve bridge (executed in §3) |
| "the bSigner→SETTLE nerve is not yet concretely wired" | zero bsigner references in the settle kernel/tools | **claim holds**; wired in §2 |
| "the actual BEELOG architecture is still absent; `did:b:` only in docs" | no `did:b:` in any code at tip | **claim holds**; first increment built in §4 |

None of the 16 commits between the inventory's read point (`aae4d875`) and the
tip touched the lane files (empty path-diff), so the findings were checked
once and held.

## 1 · bSigner — the contract is frozen (order item 1)

`crates/bsigner/CONTRACT.md`, new: the frozen public surface written down as
law — the nine CLI commands, the `bheart.signature/1` agility envelope (shape
never changes; migration = a new algorithm id, never a redefinition), the
`bheart.keyset/1` file shape, the sig/kem/hash registries, and the standing
laws (signs-never-submits, keys never leave or print, the banchor independence
fence, the btrezor-as-future-BACKEND naming ruling). Contract changes need a
founder ruling recorded in the file with its date. Open by design and named:
the hardware backend, and consumer-side rail wiring. No organ code was
touched — the freeze holds in practice, not just on paper.

## 2 · The bSigner→SETTLE nerve (order item 2)

**Files**: `tools/bpay-settle/bsigner-authority.mjs`,
`tools/bpay-settle/bsigner-nerve.test.mjs`, `tools/bpay-settle/README.md`,
`.github/workflows/tests.yml`.

The kernel's `settle({ authorityHash })` parameter said "the signing itself
belongs to the signed-authorization lane"; that lane now exists and its organ
is bsigner, reached through its frozen CLI (no organ changes). What is signed:
the domain-separated bytes the kernel itself digests —
`"bnr/settle-authority/v1" ‖ 0x00 ‖ canonical JSON` — so one ML-DSA signature
binds the document AND its domain. `settleSigned()` verifies through the organ
BEFORE the kernel is called; a bad signature never reaches an adapter verb.
Payload signing stays the rail vaults' job (chain curves transact; ML-DSA
authorizes) — stated in the module header so nobody reads the nerve wider than
it is.

**Receipts** (against the real built organ, ml-dsa-65 keyset the organ itself
generated): `bsigner-nerve.test.mjs` **7/7** — keygen (no secret material in
output), sign+verify of the domain-separated bytes, full kernel path under the
signed authority (prepare→combine→submit→reconcile, receipt issued), an
authority edited after signing refused with ZERO adapter verbs called, another
key's signature refused, and the kernel's own authorityHash law refusing
without the nerve. Unchanged suites: `bpay-settle.test.mjs` **53/53**,
`prove.mjs` **36/36 mutations killed** (kernel untouched). CI: a new
`test`-job step mirrors the solana-native step (`SETTLE_BSIGNER_BIN`,
"a skipped suite is not a pass"); tests.yml was edited as YAML and
parse-checked with PyYAML before commit.

## 3 · Voucher convergence (order item 3)

**Files**: `scripts/buzz-meter/voucher_escrow.py`, `x402_meter.py`, `meter.py`,
`test_voucher_escrow.py`, `test_x402_meter.py`.

The Rust conformance core already had the law; the LIVE engine did not — its
`deposit_usdc` cited a bare `(rate, rate_ref)` with no quote id, no serve
moment, no TTL, and the serve bridge passed declared rates straight through.
That was the remaining stale-quote-replay surface. The convergence (same law
as the Rust core, field for field): `ConversionQuote {id, rate_a_per_usdc,
rate_ref, quoted_at}` validated at construction; typed `StaleQuote` /
`QuoteReplay`; refusal order = Z33 settlement replay (idempotent credit
returns the original event) → quote single-use (the ledger IS the burned-id
registry, rebuilt by scan, restart-surviving) → inclusive TTL (age == TTL
refuses; future-dated is malformed, not fresh) → dust — every refusal before
the append, `quote_id`/`quote_ts` burned into the event. The serve bridge now
REQUIRES the served quote (missing quote fields = typed `SettlementMismatch` —
the hole stays closed at the bridge). BASEPOLL mints quotes honestly: the
run's card-read moment is `quoted_at`, the id is `(rate_ref, tx)` — one quote
per deposit. `QUOTE_TTL_SECS = 300` mirrors Rust; tests derive boundaries from
the constant (a founder TTL ruling cannot silently break them).

**Receipts** (Python 3.14 via WSL, exit 0 each): `test_voucher_escrow.py`
**23 proofs** (7 new AV-2); `test_x402_meter.py` **47 proofs** (3 new bridge
cases); `test_serve_bridge` / `test_av3` / `test_av5` / `test_av6` **PASS**;
Rust core `cargo test -p voucher-escrow` **17/17** unchanged.

## 4 · bzDiD — the did:b: root and verifier, first increment (order item 4)

**Files**: `crates/bzdid/` (new crate: `dagcbor.rs`, `did.rs`, `genesis.rs`,
`lib.rs`, `tests/atmirror_crosscheck.rs`, `tests/genesis_vector.rs`),
workspace member + lock, `docs/VOCABULARY.md`, `crates/onboarding/src/lib.rs`.

The architecture's own order says root first, and the root is now code:
`bzDiD = "did:b:" ‖ base32(sha256(genesis_op))` — full 256 bits, lowercase
RFC 4648 base32, unpadded, 52 chars. The genesis op's byte-level v1 canon
(`BDID-GENESIS-V1`) is frozen by a pinned test vector. Hand-rolled canonical
dag-cbor because the identity IS a hash of the encoding; canonical rules
enforced on encode AND decode (shortest heads, length-first map order,
definite lengths, duplicate keys refused); the verifier hashes the handed
bytes and never re-encodes (stored-bytes law); validity refuses at the expiry
boundary. Signed succession/rotation is the named NEXT increment — nothing
signature-shaped is claimed. Identity coherence fixed per the review's own
instruction: **VOCABULARY Law 7** — `did:b:` is the sovereign root, every
other DID method a bound anchor; `crates/onboarding` now says where
`did:autonomi` sits in that hierarchy.

**Receipts**: `cargo test -p bzdid` **16/16** (14 unit + the atmirror
cross-reader check + the frozen vector); RFC 4648 §10 base32 vectors; tamper
proof (any flipped byte refuses — structure or hash, no third outcome);
neighbor-did proof; clippy zero crate warnings; `cargo fmt --all` clean;
workspace builds locked.

## 5 · The order's design principle

"The chain should certify the minimum necessary state; identity validity must
remain locally verifiable without trusting the service that serves the proof"
— held by construction in §4: the root certifies nothing on any chain, and
`verify_genesis` is pure (bytes + did in, verdict out). The principle is also
recorded where the next increments will read it: the crate docs and Law 7.

## Carry-overs (the queue, with next owners)

1. **bzDiD succession/rotation** — signed rotation ops, priority arbitration
   (two ops at the same seq, different-priority keys — the architecture
   Phase 1 names this as the hardest remaining piece). NEXT OWNER: the bzDiD
   lane that picks up order item 4's second increment.
2. **`.b` BEELOG + independent proof verification, then the minimal Vaulta
   epoch root** — architecture Phases 3–5; the tree spec and verifier ship
   day one per §8. NEXT OWNER: bzDiD lane, after succession.
3. **bSigner hardware backend** (btrezor behind the frozen interface).
   NEXT OWNER: hardware lane; contract freeze bars surface changes.
4. **Live-box deployment note for §3**: the box's serve bridge
   (`server.mjs` paymentContext shape) must carry `quote_id`/`quoted_at` in
   its declared payment context the day it next syncs from this tree, or
   base-rail credits will refuse (fail closed, by design). The rate-card
   `minted_at` discipline from the Sept-16 dispatch rides the same sync.
   NEXT OWNER: the box/serve-bridge lane.
5. **The live Pages-deploy verify backlog** (estate-wide queue stall) —
   untouched by this lane, still owed.

## Verification

Everything above ran on this box (Git-for-Windows worktree, cargo 1.98.1,
node 24.18.0, WSL Python 3.14.4) except the full-workspace CI matrix, which
the branch push exercises. No secrets were printed, committed, or pasted; no
money moved; nothing here submits anything anywhere.
