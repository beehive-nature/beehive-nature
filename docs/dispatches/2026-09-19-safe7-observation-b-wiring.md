# Safe 7 Observation B — wired + gated, ceremony awaiting the founder's press

Board GO received 2026-09-19 (verbatim order: wire the proven
`SuiteMcpTransport` into `/v1/sign/begin`; no changes to watchpay, the 15
laws, composer, two-slot shape, verifier, receipt grammar, gas policy, or
UX semantics; current founder authorization only if valid — otherwise
refuse; reconfirm manifest before any device prompt; slot 1 → wall →
slot 2 → wall → ONE SIGNED receipt → STOP; zero auto-retry; ambiguous
timeout = unknown outcome, never another signature prompt).

Branch `zcode/bpay-suite-mcp-2026-09-19` (worktree `wt-zcode-bpay-mcp`,
on 45af24e4 + this commit). **Zero watchpay bytes changed** (verified in
the diff; preserved suites re-run green in this worktree).

## What was built (service wiring only — the organ untouched)

- `crates/bpay-sign/src/bridge.rs` — the antd-bridge READ side: live
  `GET /v1/authorization` + `GET /v1/jobs` parsed into the organ's own
  `WaveAuthorization`/`WaveJobSummary` (serde-compatible; the bridge's
  extra job fields ignored; 3 unit tests incl. the live shapes).
- `BPAY_SIGN_MODE=safe7` (`main.rs`):
  - authorization/jobs read LIVE from the bridge on EVERY request —
    never cached, never vended (the demo vending endpoints do not
    register in this mode); a missing founder press stays missing.
  - `/v1/sign/begin` signs through `SuiteMcpTransport` — the SAME
    injected `ConnectTransport` boundary the hot key rides; slot loop,
    exactly-one receipt ledger, restart-never-resigns: all unchanged.
  - THE MODE LAW: safe7 refuses any binding whose chain is not
    Arbitrum One 42161 (the REAL ceremony shape; testnet/replica shapes
    are demo-mode-only).
  - THE SETTLE LAW: `/v1/testnet/settle` refuses outright in safe7 mode
    ("the Safe 7 ceremony ends at SIGNED") — belt-and-braces over the
    structural testnet-only receipt checks.
  - nonce/fees compose from the READ-ONLY public Arbitrum One RPC
    (`https://arb1.arbitrum.io/rpc`; read-only eth_getTransactionCount +
    eth_gasPrice; no send code exists in the binary's safe7 path).
  - the payer is the Observation-A-proven device address
    `0x8fd7252a29fb759755e30a15e966932eaad91b75` (env-overridable; LAW 14
    — a device signing from any other key refuses at the wall).
  - `/v1/sign/state` gains the pre-device RECONFIRM manifest in safe7
    mode: signatures expected, 1/N exact-ANT approve, 2/N one
    payForQuotes call carrying ALL payments, `broadcast:false`, the stop
    line. Demo-mode responses unchanged.
- `ops/bpay-sign/safe7-ceremony.mjs` — the founder-operated driver:
  reads the CURRENT authorization from the live bridge (REFUSES at LAW 1
  when none — never refreshes/regenerates/repairs); reads the job's
  payment set from the bridge state on disk (tuples
  [quote_hash, rewards, amount_hex] → decimal atto; sum must equal the
  authorization ceiling before anything is sent); prints the full
  manifest; requires typing **SIGN**; begin → the two device approvals;
  prints + banks the SIGNED receipt; exit 0 signed / 1 refusal / 2
  precondition / 3 UNKNOWN OUTCOME (timeout or ambiguous session end —
  inspection required, NEVER retried by the driver).

## Live evidence on the wiring day

- Bridge :8807 LIVE: **ZERO authorization records** (the lawful refusal
  state — nothing regenerated); 10 jobs; TWO open lineages — the
  founder's `up-1789807703111` @ 4.2932401962890625 ANT (artifact
  338b4868…, the morning's price refresh) and a second smaller lineage
  `up-1789679752969` @ 0.2132 ANT (LAW 4 staling is same-artifact, so
  the second lineage does not stale the founder's).
- The safe7 service answered a probe with the LAW 1 refusal verbatim —
  the gate is live.
- Read-only RPC: chain 42161 ✓; payer pending nonce 2; gas 20 Mwei.
- A stale demo-mode bpay-sign held :8808 (previous session); killed and
  replaced (demo-mode startup law re-verified after the wiring:
  mint-and-print-and-exit intact).

## State at banking

The founder's press had NOT landed (quiet watch; silence is correct
system behavior — never nudged). The ceremony is STAGED, not run: door
http://127.0.0.1:8899/bdata.html (serving the UX seat's surface),
bridge :8807, safe7 service :8808, driver ready. The founder's sequence:
bData → price current → Review → 🔑 I authorize this →
`node ops/bpay-sign/safe7-ceremony.mjs` → type SIGN → approve 1/2, 2/2
on the device → SIGNED · NOT BROADCAST. The SIGNED receipt will be
banked as its own dispatch when it exists.

## Tests

bpay-sign **9/9** (6 prior + 3 bridge-shape tests) ×multiple runs;
watchpay preserved suites all green in this worktree (11 ok targets);
cargo fmt clean; clippy zero-new (pre-existing warnings only); driver
`node --check` clean. Demo-mode regression: startup path intact.

## Boundaries

No watchpay changes. No settlement, no push_transaction, no upload, no
broadcast, no mainnet transaction — in safe7 mode the binary holds no
send path at all beyond the demo-only settle route, which refuses in
this mode structurally and by the mode check. The founder's
authorization press remains the only missing event.
