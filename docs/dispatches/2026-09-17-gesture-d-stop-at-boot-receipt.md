# GESTURE D — credential boundary first, ceremony STOPPED AT BOOT (2026-09-17)

**Founder order (verbatim spine):** credential boundary first, then ceremony;
preserve existing binary/config/journal provenance, do not rebuild; execute only
multi-leg → AV-6a → AV-5 → AV-8 → AV-4 → reconciliation; stop on first failed
acceptance bar; no fix-forward during the ceremony; promote only real Base
Sepolia evidence to D(testnet); AV-6b specified-only; production unauthorized.

**Verdict: STOPPED AT THE BOOT PRECONDITION.** The door binary cannot complete a
live startup — a same-process flock self-deadlock in its journal open sequence.
No drill beat executed; nothing promoted; the journal is pristine. The stop is
per the founder's law; the fix belongs to the builder seat, not this ceremony.

## 1 · Credential boundary — EXECUTED (before any ceremony motion)

- Upstream signer API verified at source (crates.io x402-chain-eip155 2.0.2 +
  x402-types 2.0.2, materialized via cargo fetch on the box):
  `Eip155SignersConfig = Vec<LiteralOrEnv<EvmPrivateKey>>`; `EvmPrivateKey::from_str`
  is `B256` — hex-only; `LiteralOrEnv` resolves `$VAR`/`${VAR}` from the process
  environment at deserialize time, fail-loud if unset. There is NO key-file
  reference form upstream, so the founder's hierarchy resolves to
  **environment-backed signer**: preference #2, no secret-bearing file at all.
- The previously staged `/opt/x402-door.chains.json` carried an INLINE sec1 PEM
  (root:600). That material (PEM sha256 `2484cb0df50ededcf72dd32f9239d97fc1ff1ae7f4c1705caa654f366138a1c3` PUBLIC-CONSTANT,
  address `0x4d645ccc9a4fa5121ecb46df32f40dd4a668caff`) would not even parse as
  a signer (PEM ≠ hex) — the file was never loadable by the door.
- **Identity truth:** the PEM IS byte-identical to `~/funnel-test/funnel-test.key`
  (the peer-funnel throwaway, file sha256 `26417d52c977b596b40d1ddfffd35316d85e6eef7204a6ee968b10045578437e` PUBLIC-CONSTANT)
  whose true address is `0xb43b94ae967f0ae2e1bc7b5453086ab308f537af` — the funded
  ceremony identity. The previous pass had staged the RIGHT key in the WRONG
  format; this pass kept the key, removed the file-bearing form.
- `/opt/x402-door.chains.json` rewritten to `"signers": ["$X402_OPS_WALLET_KEY"]`
  (inner-object shape — see F4), root:root 600, sha256 `4c0b4f23373ca18ad0d51b822382c2c5215d1a14eb14b7ac101b013f01d6e45f` PUBLIC-CONSTANT — zero secret material.
- Key crossing at door start: kit reads the funnel PEM in memory → stdin of a
  root wrapper → process env → door. Never argv, never a new file, never
  printed/logged (post-ceremony scan: 0 files under the ceremony dir contain the
  raw key bytes). /proc environ of the root-owned door is root-readable only.
- The funnel key file itself is the funnel lane's pre-existing artifact (founder
  custody); untouched. Recommendation banked: rotate/dispose it after the
  testnet lane closes — it now guards a funded identity.

## 2 · Pre-flight — ALL GREEN (first fully-green live pre-flight of this door)

| check | result |
|---|---|
| chain | `0x14a34` = 84532 **Base Sepolia** (terminology per founder: receipts say Base Sepolia, never Ethereum Sepolia) |
| identity | `0xb43b…37af`, kit-derivation cross-validated against foundry (cast) on fresh keys |
| funds | ETH `1999440708823927` wei (≈0.002); USDC `900000` base units (0.9) |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` verified against Circle's published list at execution time; on-chain EIP-712 domain reconstructed = `{name:"USDC", version:"2", chainId:84532}` matching the live DOMAIN_SEPARATOR byte-exactly |
| EIP-3009 proxies | both x402 Permit2 proxies deployed on 84532 (code present) — relevant to F2 |
| binary | `/home/ubuntu/beehive-nature/ops/x402-door/target/release/x402-door`, sha256 `830b0613c35545709e8859fa6d2ea877e0ec6e25360202ca762faa7b2a6dfc71` PUBLIC-CONSTANT — matches the checkpoint; unchanged by this pass |
| source | box checkout + driver link-snapshot at `0e1c22ec` (= origin/main at pass start) |
| journal | `/var/lib/x402-door` coherent and EMPTY (0 records; only `.lock`) — before and after |
| production absence | door config = loopback bind 127.0.0.1:18042, RPC `sepolia.base.org` only, no production endpoints or identities anywhere in the door surface |

## 3 · THE STOP — live startup self-deadlock (F1)

Evidence chain, all first-hand on the box:
1. Door started with the env-injected key (root, detached). Process alive,
   5 threads, an ESTABLISHED TLS socket to the RPC (facilitator/provider build
   succeeded — the credential wiring WORKS).
2. Never binds :18042; log file empty (the "listening" line is printed only
   after journal recovery).
3. Kernel stack of the blocked task: `locks_lock_inode_wait` ← `__do_sys_flock`
   — waiting on `/var/lib/x402-door/.lock` (fd held by the same process).
4. Mechanism at source (`ops/x402-door/src/imp.rs` + `src/journal.rs` @
   `0e1c22ec`): startup runs `Journal::open_exclusive` (holds a `try_lock` flock
   on `.lock` for the instance lifetime) and then `recover_stranded_settling()`,
   whose `acquire_exclusive()` opens `.lock` AGAIN and takes a BLOCKING `flock`.
   Two open file descriptions, same file, same process → Linux flock semantics
   deny the second acquisition → self-deadlock. The door can never serve a
   request.
5. Library-level reproduction (ceremony driver, scratch root, no production
   code touched): `open_exclusive` → `recover_stranded_settling` killed by a
   10s timeout, exit 124 — reproduced deterministically.

Why no test caught it: the suites exercise journal ops on NON-exclusive opens
(`Journal::open`); the exclusive hold plus an immediately-following blocking
acquire exists only in the binary's startup sequence, which had never been run
live before this pass (config/env were the open obstacles until now).

Per the founder's no-fix-forward law the defect is NAMED, not cured. The
builder-side fix is one bounded decision (release-and-reacquire discipline, a
non-blocking acquire in recovery, or moving recovery before the exclusive hold)
— for the builder seat to charter, prove RED→GREEN, and re-stage; the door
binary provenance (SHA above) is preserved untouched.

## 4 · Further findings at source (all read-only; no code touched)

- **F2 — upto legs are unreachable through this door, end to end.** The door's
  wire extraction (`wire.rs::extract_leg`) reads only EIP-3009-shaped payloads
  (`value`/`maxAmount` under `paymentPayload.payload`); upstream's v2-upto
  facilitator accepts ONLY Permit2 payloads (its own doc: "EIP-3009 requires
  exact amounts at signing time"). The two shapes are disjoint: an upto request
  is refused at the door's leg-extraction boundary before the scheme handler is
  ever reached. The runbook's "upto settled at less than max" beat cannot occur
  through this build.
- **F3 — the imp drops the actual-charged amount and fills gas at reserve-rate.**
  The imp's Success mapping passes `actual_amount: None, gas_actual_wei: None`;
  the door fills `amount_authorized` (the ceiling) and `reserved_gas_wei`
  respectively. Consequences: (a) an upto leg could never record a
  reconciled-down actual even if reachable (upstream's `UptoSettleResponse`
  carries the real `amount` and it is discarded); (b) ONE facilitator-settled
  leg books `150000000000000` wei against the `200000000000000` daily cap —
  75% of the day's budget at reserve-rate, not reality-rate. Human-gate
  resolves (`resolve_unknown`/`resolve_reorg`) DO take real evidence figures
  and restore truthful accounting.
- **F4 — chains-config example-vs-imp shape mismatch.** `sepolia/chains.example.json`
  is the `{eip155:{chain_reference, inner:{…}}}` envelope, but `imp.rs`
  deserializes the file directly as `Eip155ChainConfigInner` (inner object only).
  The box file was corrected to the inner shape (config-side cure, not code);
  the in-repo example remains misleading for the next operator.
- **F5 — AV-6a's retry ceiling is unreachable at the live seam.** The ceiling
  (`settle_attempts >= max_settle_attempts_per_leg`, refusal loud) counts only
  `FacilitatorSettle::Error` outcomes (`Ok(success:false)` from upstream).
  Upstream 2.0.2 constructs NO error-shaped settle response anywhere (every
  settle failure is `Err`, including on-chain reverts), and the imp maps every
  `Err` to `Ambiguous` → journal `Unknown` (never auto-retried). The only live
  attempt-counting path is a facilitator verify refusal — exactly once per leg
  (re-verify is refused at reserve before the facilitator is called). So "3
  failing settles on one leg → 4th refused loud" is structurally impossible
  through the live wiring: the first definitive-looking failure parks the leg
  Unknown instead. Notably the Unknown law is itself a stronger brake against
  retry storms — but the AV-6a bar as specified cannot be met without a seam
  change (classify scheme errors into Error outcomes), which is builder work.

## 5 · What Base Sepolia reality DID confirm (the one live boundary crossed)

A payer-side exact leg was built and signed offline (domain `{USDC,2,84532}`,
EIP-712 `TransferWithAuthorization`, self-addressed test authorization) and
static-called `transferWithAuthorization` against the live USDC contract:
**PASS (no revert)** — signature, domain, window, and balance all verify on the
real contract. Leg nonce `0x628a65b8f36d80c408de192dd1841e116f10c547daf8b9095f995c854b66cc45` PUBLIC-CONSTANT
(request kept at `~/x402-ceremony/reqs/` on the box for the next lawful pass;
the nonce remains unspent). Every other step of the ceremony waits on F1.

## 6 · Evidence tiers — nothing promoted

- AV-4/5/6a/7/8 rows in the ASSURANCE LEDGER are UNCHANGED (class A; door
  pre-production). No drill ran; no D(testnet) claims are made. AV-6b untouched
  (specified-only). Production placement remains unauthorized and untouched.
- The pre-flight green + payer-side static proof are banked as evidence for the
  next pass, not as promotions.

## 7 · Box state at close

- Door: stopped; binary sha unchanged; no listener; journal EMPTY and coherent.
- `/opt/x402-door.chains.json` (env-ref, non-secret) + `/opt/x402-door.config.json`
  in place; hashes above and in the kit preflight output.
- Ceremony tooling on the box (`~/x402-ceremony/`: kit.py, doorwrap.sh, driver/,
  makeleg.py, logs/, one stored leg) — secret-scan clean (0 files contain the
  raw key); kept as provenance for the next pass.
- Scratch (cargo-fetch dir, comparison scripts, repro root) removed.

## 8 · Next-pass handoff (bounded)

1. Builder charters the F1 fix (one decision + RED→GREEN proof), rebuilds, and
   re-stages the binary; re-verify sha + provenance ritual.
2. Re-run THIS order unchanged: pre-flight → multi-leg → AV-6a → AV-5 → AV-8 →
   AV-4 → reconciliation; the kit/driver on the box already implement every beat,
   including the nonce-consume (AV-6a), kill/restart (AV-8), flag/resolve
   operator gestures (AV-5), and the journal scan (AV-4).
3. Expect and grade honestly: F2 (upto wire refusal), F3 (ceiling-recorded
   actuals + reserve-rate budget), F5 (AV-6a unreachable) — these bars CANNOT
   pass on the current build; their receipts should record the structural
   findings, not force outcomes.

— zCode seat, 2026-09-17 (UTC). Claim → evidence → boundary not crossed:
credential boundary claimed with the env-ref file + zero-secret scan; live
pre-flight claimed with the on-chain checks above; the door's serving ability
NOT claimed — killed by its own lock before binding.
