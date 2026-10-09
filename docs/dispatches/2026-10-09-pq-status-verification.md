# 2026-10-09 — PQ migration status: the pasted report, verified sentence by sentence

Seat 3 (Claude Code, Fable 5.1 session "pq-migration-verification"). The founder pasted a
post-quantum status report written by another seat (headline: "very strong, verified state across
the estate … the remaining frontier is the hardware cross-compile fix and the founder device
ceremony"). This dispatch checks every sentence of it against main, the fork clones on this box
and the mailbox, and records what is true, what needs a precision, what is overstated, what is
stale, and what the report leaves out. The report itself is not in the repo; nothing is deleted
here, the corrections are the record.

**Bound to:** main `2014a067c` (== `origin/main` at 2026-10-09T16:40Z; all nine workflows on that
sha concluded `success`: tests, bTunGsTeN PQ, bTunGsTeN PQ SAW, bTunGsTeN RB, WB001 SAW proofs,
WB002 SAW equivalence, WB002 WASM corpus, secret-scan, pages). Fork receipt chain
`~/bpq-rb-clone` at `da2583079`, clean.

**Method.** 29 read-only agents in one workflow: five verifiers (one per report section), three
adversarial refuters per section with distinct lenses (source bytes, drift since the report,
wording ceiling), a judge for every contested verdict, three sweeps (omissions, open items, law
book), one completeness critic that re-ran five receipts. No file was written by any agent; no
proof, cargo or SAW was re-run (CI conclusions are the oracle). The orchestrator re-ran the
receipts in §1 by hand.

## 0 · Verdict

Nothing in the report is false. Of 42 judged sentences: 3 TRUE, 25 TRUE_WITH_PRECISION,
11 OVERSTATED, 2 STALE, 1 UNVERIFIABLE_HERE. It is a 2026-10-05 snapshot whose status words
("verified", "DUAL-VERIFIED", "preventing", "comfortably", "intact", "one-line") consistently grade
above their receipts, and it omits the whole post-quantum proof program that has been the
founder's order since 2026-10-08. Its single biggest defect is the headline: a two-implementation
cross-check is called a "verified state" (SPEC-BPQ-1 §6 rules that wording out), and two
remaining items are named where the primary sources name at least ten.

## 1 · Receipts run by the orchestrator (commands and unedited deciding lines)

```
git rev-list --left-right --count origin/main...HEAD
0	0
gh run list --branch main --limit 12 --json name,headSha,conclusion
2014a067c  tests success · bTunGsTeN PQ success · bTunGsTeN PQ SAW success · bTunGsTeN RB success
           WB001 SAW proofs success · WB002 SAW equivalence success · WB002 WASM corpus success
           secret-scan success · pages build and deployment success
node scripts/verify-bpq-signatures.mjs
ok   ORDERS-1.md: signed by bzpq12urgrzaz7cpmnl9t78cwa9zyjhllky2cs5vxt8rf6ct5k6raemqsr8q3vg, says it was signed at 2026-10-05T03:06:09.933Z
(… six more ok lines, same id, same instant …)
bpq signatures: 7 of 7 verify, signers pinned (1); law files: 7 of 7 current
exit=0
wsl -e sh -c "cd ~/bpq-rb-clone && git rev-parse --abbrev-ref HEAD && git log --oneline -n 3 && git status --porcelain | wc -l"
bpq-safe7
da2583079 bpq: receipts on beehive 7a8709bdff, and the T3W1 hardware fit without a device
1d21da9e4 qstrdefsport: the Zano app's qstrs, as the build regenerates them
27ba1ed51 bpq: emulator receipts for db92c25, pasted with the filters named
0
sed -n "25p;29p" /c/Users/travi/source/trezor-firmware/vendor/sphincsplus/ref/merkle.c
    unsigned steps[ SPX_WOTS_LEN ];
    info.wots_steps = steps;
(fetched 2026-10-09) raw.githubusercontent.com/sphincs/sphincsplus/{master,consistent-basew}/ref/merkle.c
    unsigned steps[ SPX_WOTS_LEN ];   info.wots_steps = steps;     (both branches: unchanged upstream)
grep -c -E "Some\(\"[a-z0-9-]+\"\) =>" crates/bsigner/src/main.rs
18        (keygen sign verify list keys-seal kemtest x402pay bpq-open bpq-verify bpq-handover
           bpq-attest-nostr taproot-sighash taproot-address psbt-inspect btc-intent
           bpq-attest-intent btc-verify-intent selftest; plus version)
git log --format="%h %ad %s" --date=short -- crates/bsigner/CONTRACT.md
a5b88db00 2026-10-06 bsigner: the contract is frozen — the organ's public surface written down as law, by founder order
```

## 2 · The claims, one line each (verdict → the sentence as the sources support it)

### §1 The law is signed and CI-enforced

- **L1** "COMPLETE & ACTIVE IN CI (commit 8a2ad008e)" → TRUE_WITH_PRECISION. `8a2ad008e` landed the
  seven `.bpqsig.json` files and `docs/PQ-SIGNERS.json` (authored 2026-10-05T03:07:23Z). CI wiring is
  `fe4a88ae2` and `638abb105` (2026-10-04); the gate became *blocking on a stale file*, with a Rust
  second leg (`scripts/verify-law-signatures-rust.sh` through the built bsigner, `tests.yml:51`),
  at `74ac205ac` (2026-10-08). `8a2ad008e`'s own body says a later edit "reads STALE, never a failed
  build". Dating "CI-enforced" to 10-05 describes the weaker gate.
- **L2** "one-press signing on wallet.html#sign / #pq-law, 2026-10-05T03:06:09Z" → TRUE_WITH_PRECISION.
  Every signature carries `at: 2026-10-05T03:06:09.933Z` (the signer's browser clock; local time
  2026-10-04 21:06 -06:00, so "October 5" is UTC). `#sign` is a hash route (`signSheet()`,
  `surfaces/wallet.html:4263-4266`, landed `45c4e544b` three minutes before the signing commit);
  `#pq-law` is the in-panel anchor (`:1260`). Both call `lawSign()`. Which was pressed rests on the
  commit message; the signing receipt `law-signatures-2urgrzaz-2026-10-05.json` it names is not tracked.
- **L3** "All 7 foundational estate documents" → TRUE_WITH_PRECISION. Exactly the seven files
  `docs/PQ-LAW.json` names; every `docs/RULINGS-*.md` is among them. "All foundational documents"
  overreaches the law book's own table (CLAUDE.md §1): PERSON-1/BIO-1 (other repo),
  SPEC-BNROSE-ONBOARD, feature-backlog, risk-register, BIND-1, bzdid-architecture-decision and the
  dispatches are unsigned. Say "all seven law files in `docs/PQ-LAW.json`".
- **L4** "detached ML-DSA-65 signatures" → TRUE (`kind: detached`, 3309-byte signatures, SPEC-BPQ-1 §3b shape).
- **L5** "Verified signer … (founder)" → TRUE_WITH_PRECISION. One id pinned; 7 of 7 verify under it.
  "(founder)" is the pin's `name` field, which `scripts/apply-law-signatures.mjs:21` writes as its
  default; no tracked receipt, ruling or binding ties the id to a person. Read "pinned signer,
  labelled founder".
- **L6** the quoted line `bpq signatures: 7 of 7 verify, signers pinned (1)` → STALE. Since
  `74ac205ac` the script prints `…; law files: 7 of 7 current` and that clause is the one that
  gates; the quoted string is the pre-10-08 format and the `8a2ad008e` commit body, not a fresh
  run on main. Receipt law: paste the real current line (§1 above).
- **L7** (implied) enforced in CI → TRUE_WITH_PRECISION. `tests.yml:127` (noble script) and
  `e2e/law-signatures.test.mjs` in the static job; `tests.yml:51` (bsigner twin with a TEETH row)
  in the test job; on push and pull_request; both `success` in run 37960758875.
- **L8** (implied) the signatures bind the current bytes → TRUE (zero commits on the seven law
  files, the sig files, the pin or the list since `8a2ad008e`).

### §2 Specification and core cryptography

- **S1** the algorithm list → TRUE_WITH_PRECISION. ML-DSA-65 (FIPS 204), X-Wing = ML-KEM-768 +
  X25519 (draft-connolly-cfrg-xwing-kem-11 pinned), SLH-DSA-SHAKE-256f (FIPS 205), AES-256-GCM,
  HKDF-SHA-256: all at SPEC-BPQ-1 §2 (`:36-48`) and §4. The SLH-DSA Rust twin is integritychain
  `fips205 0.4.1`, not RustCrypto; "Rust over RustCrypto" holds for ml-dsa 0.1.1 and ml-kem 0.3.2 only.
  Only the succession *commitment* is in both implementations; the succession *act* (handover v1,
  §5, 2026-10-08) is Rust-only and the browser neither makes nor checks one (`:206-208`).
- **S2** commitment hashed into the id at birth → TRUE_WITH_PRECISION. `succ = SHA3-256("bpq1/succession"
  ‖ slhPublicKey)` is hashed into the id with the ML-DSA-65 public key; the ML-DSA key is public
  from birth, the SLH-DSA key is revealed only at a handover (`:87-90`).
- **S3** "AES-256-GCM segments wrapped under an HKDF-SHA-256 expansion of the root" → TRUE_WITH_PRECISION,
  one layer skipped: segments are under a random per-object key Kf; Kf is wrapped (AES-256-GCM)
  under KW = HKDF-SHA-256(vault key, salt = oid, "bpq1/wrap/self"); the vault key is
  HKDF-Expand(masterPrk, "BDID-v1/vault-key" with context `root`) (`:65`, `:150-165`).
- **S4** "IMPLEMENTED & DUAL-VERIFIED … agree byte-for-byte" → OVERSTATED. SPEC-BPQ-1 §6 (`:270-272`):
  "a cross-check between two implementations, not an audit … JS signing is not claimed to be
  constant-time". Say "implemented; cross-checked on shared vectors". What is stronger today than the
  report says: every NIST ACVP case for ML-KEM/ML-DSA/SLH-DSA-SHAKE-256f runs on two Rust
  implementations (job `pq01-vectors`), and SAW receipts exist for the named sub-lanes in §3 below.
- **S5** R1–R4 paraphrases → OVERSTATED in two places. R3 says grinding is "out of reach for the life
  of a session" and that the words "cannot catch a page that is itself fake", not "preventing
  grinding". R2 removes the soul-name dependency only for "only me" files sealed after the ruling;
  shared files still need the persona's soul name, and pre-ruling objects open with the persona
  context. R4's SLIP-21 path `["BZPQ-DEVICE","v1"]` is named in SPEC-BPQ-1 §7 and the fork's
  `docs/bpq-device.md`, not in the ruling text; "hardware signing on Safe 7 uses" is emulator-only.
- **S6** (implied) the rulings are implemented → TRUE_WITH_PRECISION. R1 `crates/wallet-relay/src/envelope.rs`
  (`cargo test --workspace`), R2 `cbdbaf4b7` (`root` refused in `bpq.js:184,223` and `bpq.rs:318-320`),
  R3 `a813465d6` (`wallet.html:6684-6693`, vector pinned in `e2e/wallet-forge-pq.mjs:847`); R4's code is
  in the private fork, exercised on the emulator only.
- Missing from §2 entirely: the context rule (1–64 printable ASCII, both implementations, `b57c73921`),
  §5b Nostr event attestation and §5c intent authorization (2026-10-09, vectors in `tests.yml:124-125`).

### §3 Safe 7 (T3W1)

- **H1** the handoff and the 10-05 receipt exist and say so → TRUE.
- **H2** "rebased onto 7a8709bdff, branch bpq-safe7-7a8709b at da2583079" → TRUE_WITH_PRECISION.
  The chain `f7dba43d2 → 27ba1ed51 → 1d21da9e4 → da2583079` sits on `7a8709bdf` in `~/bpq-rb-clone`
  (local branch name `bpq-safe7`); no clone on this box holds a ref named `bpq-safe7-7a8709b`, so the
  remote branch name rests on the receipt's pasted `ls-remote` line (network git against the private
  fork hangs here and was not run).
- **H3** 25/25, 5/5, `fork_dirty: false` → TRUE_WITH_PRECISION: bound to `1d21da9e4`; `da2583079`
  changes only receipt and measurement files.
- **H4** "generates matching card, binding, and detached signatures" → OVERSTATED. The *card* is
  byte-equal (dsa, kem, id; succ on the JS side only at that revision). Binding and detached
  signatures are not byte-matched, they *verify* in both implementations, by design (whether noble
  signs hedged or deterministic is UNVERIFIED). Oracles were at beehive-nature `42aac5cfa`, since moved.
- **H5** flash / heap / stack and "fits comfortably within the 32 KB app stack" → OVERSTATED. Three
  evidence kinds: flash read from two built ARM images (+36,352 B, 70.16 %); heap measured on the
  *host* through the `bpq_alloc` seam (86,160 B peak, largest block 30,720 B, fragmentation
  unmeasured); stack a static `-fstack-usage` path sum (16,296 B) *below* the MicroPython binding
  with the VM frames above it not counted. The receipt lists "hardware fit as a whole" under
  `not_claimed`; SPEC-BPQ-1 §7 says "Not proved: fit on hardware". Nothing has run on hardware.
- **H6** merkle.c:29 type mismatch → TRUE_WITH_PRECISION. `unsigned steps[SPX_WOTS_LEN]` (`:25`)
  assigned at `:29` into `uint32_t *wots_steps` (`wotsx1.h:15`); `uint32_t` is `long unsigned int`
  on arm-none-eabi-gcc 13.3 and the build uses `-Werror`. The file is content of the
  `vendor/sphincsplus` submodule (pin `129b72c80`, upstream branch consistent-basew), textually
  `#include`d by `crypto/bpq/bpq_slh.c:60`. Upstream master and consistent-basew still declare
  `unsigned steps[]` (fetched 2026-10-09): no upstream fix to track.
- **H7** "needs a one-line type cast fix" → OVERSTATED. The handoff (`:180-181`) says it "needs a
  choice"; the receipt says "a code decision, not made here". The only patch in existence is the
  uncommitted `#pragma GCC diagnostic warning "-Wincompatible-pointer-types"` in `~/bpq-fit-clone`
  used for measurement. Options remain open (submodule patch or re-pin, wrapper around the textual
  include, per-file diagnostic). The decision belongs to the fork lane, not to a status report.
- **H8** "followed by step 5/6" → TRUE_WITH_PRECISION. Handoff §8 orders: ARM fix → a clean hardware
  build with bpq lifted out of the emulator-only gate *as a reviewed change* → step 5 (the ceremony-plan
  dispatch) → gate 6 (the founder-present ceremony). The report drops the reviewed build and folds
  step 5 into gate 6; there is no "step 6".
- **H9** "(Gates 1–4)" → OVERSTATED. What is receipted is handoff *steps* 1–4 (release source,
  ML-DSA-65 in firmware, message API, cross-check). The audit's six *gates*
  (`2026-10-02-bsafe-pq-audit.md:53-80`) are a different list; gate 1's upstream security
  reconciliation, gate 2's native pairing and gate 4's wrong-phrase tests have no receipt.
- **H10** "device not flashed, bootloader attestation remains intact" → UNVERIFIABLE_HERE. "Not
  flashed" is receipted as this lane's conduct ("never written to any device"). "Attestation remains
  intact" is a device-state fact no receipt observes; only `authenticate_device` run by the founder
  against the physical Safe 7 can say it. "Law preserved" is a self-grade no receipt issues.
- **H12** "EMULATOR COMPLETE; ARM HARDWARE BUILD PENDING" → TRUE_WITH_PRECISION: steps 1–4 done on the
  emulator, step 5 not started, and the receipt's pending list has four items, of which the report
  names one (the other three: on-device stack/heap/timing at gate 6; the step-5 plan; the 13
  pre-`7a8709bdff` fork commits carrying the `dev@beehive-nature` identity, escalated 2026-10-05,
  unchanged).

### §4 Wallet and "Eternal" UI

- **W1** seal/open "live across all three registers" → TRUE_WITH_PRECISION. One DOM, one handler;
  only the words switch per register (`data-reg` spans at `wallet.html:1241-1242`), so no register
  can hold a capability another lacks. CI exercises seal/open in the default register only
  (`e2e/wallet-forge-pq.mjs`). "Live" on skaists.dev was not checked here.
- **W2** "(AES-256-GCM + X-Wing + ML-DSA-65)" → TRUE_WITH_PRECISION: that is the *shared* seal. An
  only-me `.bpq` has no X-Wing slot and no ML-DSA-65 signature (`wallet.html:3974` passes
  `signer=null`; `bpq.js:483-506`); the opener says "unsigned, an only-me file".
- **W3** "#pq-bind … Ed25519 cosigning and OpenTimestamps calendar submission" → TRUE_WITH_PRECISION.
  The press builds a §3 binding (the spec's term is "pre-quantum notarization") with one cosign by
  the bzDiD Ed25519 record key. OpenTimestamps is a *separate* button `#pq-ots` after binding;
  the `.ots` holds pending calendar promises only and the page verifies nothing in it; CI mocks
  the calendars.
- **W4** "#pq-check … zero network calls" → TRUE_WITH_PRECISION, read not traced: the handler
  (`:4351-4367`) reads two files and calls `BPQ.verifyFile`; neither `bpq.js` nor `bpq-lib.js`
  contains fetch/XHR/sendBeacon/WebSocket; works with the keychain closed (`:1248`).
- **W5** "Batch 5 landed 16 more surfaces at 6f74e48a0 … ACTIVE & EXPANDING" → STALE. Batch 5 is
  exact (16 surfaces, 16 e2e), but batches 6 (`2eea1e7a3`) and 7 (`0b6daff20`, "the last fifteen
  pages") landed 2026-10-06 and `2026-10-06-chosen-ui-rollout-done-bchat-left.md` declares the
  rollout complete on every registered page except `surfaces/bchat.html`. Nothing has followed.
- **W6** "eternalization pipeline … ETERNALIZATION-EDITION-V2.json gate" → TRUE_WITH_PRECISION.
  `preserve-service.mjs:34` resolves the gate; its status is not APPROVED and the upload endpoint is
  code-disabled (409), progression all NOT YET. This is the zblood Autonomi preservation lane: not
  PQ, and not the Skaists design rollout. The section puts three different "eternal"s under one heading.
- **W7** what signs the law → TRUE_WITH_PRECISION: `#pq-law` (panel) and `#sign` (sheet) share
  `lawSign()`; the press runs the passkey (WebAuthn PRF) ceremony itself; a "is it yours?" check
  stops without signing and needs a second press.

### Headline and "Immediate Next Moves"

- **N1** "Fix ARM compiler diagnostic (merkle.c:29)" → OVERSTATED as "one-line cast" (see H7); first
  item of handoff §8 Next, correct as the order.
- **N2** "Draft the Gate 6 Ceremony Plan" → TRUE_WITH_PRECISION: step 5, not started, no plan file
  anywhere. The parenthetical drops what the handoff and the audit require of it: displayed message
  intent, signature verification, recovery on a second clean emulator; "founder in loop" is
  "founder-present".
- **N3** "QR Bridge User Migration: keys paired … need a one-press bind/rotation" → OVERSTATED and a
  conflation. What crossed the v1 bridge was the recovery *root* itself (`MPRK.slice()`, AES-GCM
  over public nostr relays under secp256k1-ECDH-only HKDF `bnr-qr-bridge-v1`), so every derived key
  is in scope, not "keys paired". The remedy landed 2026-10-04 (`fe4a88ae2`; `wallet.html:1288-1293`):
  new recovery words, then a §3 binding whose successor field names the new bzpq1 id. Two steps, a
  re-root plus a binding, not a §5 rotation and not one press. Nothing is left to build; whether any
  user has done it is not recorded in the repo. v2 still transports the root, now under hybrid
  secp256k1-ECDH + X-Wing, and refuses v1 codes.
- **N4** "remaining frontier is the ARM fix and the device ceremony" → OVERSTATED (see §3 and §4 below).
- **N5** wording ceiling → six of eight scanned phrases exceed their receipts: "verified state",
  "DUAL-VERIFIED", "preventing grinding", "fits comfortably", "Law preserved", "attestation remains
  intact". "Spec definitions … enforced in CI" has no workflow referent (one comment at `tests.yml:115`).

## 3 · What the report omits: the PQ program on main (CI is the receipt)

Two workflows, `bTunGsTeN PQ` (jobs pq00-teeth, pq01-vectors, pq11-classic, pq05-xwing, pq12-taproot,
pq10-plonky3) and `bTunGsTeN PQ SAW` (jobs saw, saw-ntt), both `success` on `2014a067c`;
`docs/specs/SPEC-BTUNGSTEN-PQ-1.md` (`a3419732c`) is the per-algorithm ledger. Lane words, not mine:

- **PQ00** teeth library: T-VACUOUS / T-TRUNCATE convict the vortex specimen — EXERCISED. zCode audit: no defects.
- **PQ01** every NIST ACVP case, ML-KEM-512/768/1024, ML-DSA-44/65/87, SLH-DSA-SHAKE-256f, two Rust
  implementations: 2,729 / 2,729, 137 TEETH held — EXERCISED. zCode: F-2 (flip guard) carried; F-3 see §4.
- **PQ02** Keccak round body PROVEN at all 24 constants (keccak 0.1.6 and 0.2.2); the 24-round loop READ; sponge not started.
- **PQ03** bzDiD derivation injective over all seven labels PROVEN; SHA-256 soft compression PROVEN;
  HMAC/HKDF at L4 open; the context-rule finding repaired (`b57c73921`).
- **PQ04** SPEC-BPQ-1 byte layouts: 10 equivalences + 7 universals PROVEN over 14 domain labels;
  `segmentsBridge` stated not proven; `bindInjective` a bounded model.
- **PQ05** ML-KEM base field, NTT, inverse NTT, base-case multiply, multiply_ntt PROVEN equal to
  FIPS 203 Alg. 9–12; X-Wing combiner PROVEN; draft-11 vectors EXERCISED.
- **PQ06** ML-DSA field ops PROVEN; Barrett/multiply tied in three links with one READ step;
  debug-build 128-bit underflow assertion OPEN; L3/L4 not started.
- **PQ07** SLH-DSA succession Rust twin + handover v1 EXERCISED, zCode-confirmed; browser handover and
  the log-keeper (N-3) not landed.
- **PQ08** law signatures: stale is red since 2026-10-08, with the bsigner twin in CI (`74ac205ac`).
- **PQ09** bsigner keys sealed at rest (`bheart.keyset/2`) EXERCISED, zCode-confirmed; N-1 closed by `2d69aa26e` (today).
- **PQ10** Plonky3 hiding STARK of the receipt-count statement EXERCISED (forgery battery, 102-bit
  figure, three scale points); tungsten-2 LEAK v1 FAIL stands, v2 PASS; on-chain NOT RUN; SAW rowSound not done.
- **PQ11** classical KATs 1,485 / 1,485 EXERCISED; BIP-39 packing PROVEN.
- **PQ12** FROST/ChillDKG behind bsigner, steps 1–5 on main today (`7e1ac0fcc … 6c05ba67a`), BIP-341/174/371
  vectors EXERCISED, FROST feature-gated OFF; key ceremony, sealed shares, CLI rounds, sighash
  differential, wallet press NOT yet.
- **PQ13** Nostr event attestation (§5b) EXERCISED both directions; relay carriage is an upstream ask.
- **PQ14/PQ15** designed in the spec, not started / explicitly out.
- The independent review seat (zCode, seated 2026-10-09): `2026-10-09-zcode-pq00-pq01-audit.md`
  and `2026-10-09-zcode-pq07-pq09-review.md`; the report does not mention review at all.

Nothing on main proves ML-DSA-65, ML-KEM-768 or SLH-DSA-SHAKE-256f end to end; "proven" is true
only of the sub-lanes named above, and the Keccak claim is "round body proven, loop read".

## 4 · Open items, owners, and candidates dropped for want of a source

Founder-only (named, not resolved, per CLAUDE.md §1 "escalate by name"):

1. **ESCALATE: `crates/bsigner/CONTRACT.md` freeze vs main.** The contract (`a5b88db00`, founder order
   2026-10-06) freezes nine commands and says "changing anything in the FROZEN list below requires a
   founder ruling, recorded here with its date", and that the at-rest follow-up "must not change the
   file's visible shape". Main dispatches 18 subcommands plus `version` (nine added since:
   keys-seal, bpq-handover, bpq-attest-nostr, taproot-sighash, taproot-address, psbt-inspect,
   btc-intent, bpq-attest-intent, btc-verify-intent), `keygen`/`sign`/`kemtest`/`x402pay` now take
   `--rec-env`, and the keyset is `bheart.keyset/2`. The PQ lanes that added them were founder-ordered
   (2026-10-08 "do every one of those"), but no ruling is recorded in the file and no RULINGS file
   exists after 2026-10-04. Either the ruling is recorded with its date, or the surface is reverted;
   a seat may not decide which.
2. **Gate 6**: the founder-present device ceremony against a named image, the only place on-device
   stack headroom, heap fragmentation and signing time can be measured. Nothing authorizes a flash or
   a bootloader unlock.
3. **The 13 pre-`7a8709bdff` fork commits** carrying `dev@beehive-nature` (published 2026-10-05 by a
   staging script that ran by mistake; fixed forward only, never rewritten): acknowledgment pending
   since 2026-10-05.
4. **Who may add a second signer to `docs/PQ-SIGNERS.json`**: `apply-law-signatures.mjs:43` pins any
   receipt card whose signatures verify over every law file; no ruling says adding a signer is
   founder-only. A governance question, not a defect.
5. **zCode's next beat order** (PQ10 Plonky3 receipt vs PQ03 SAW injectivity verify): the founder's
   call, default newest-first.

PQ lane (in handoff order for the Safe 7 lane):

6. Decide and make the ARM compile fix (`bpq_slh.c` against `merkle.c:29`), reproduced through the
   fork's nix-shell `arm-none-eabi-gcc` 13.3 (`/nix/store/…-gcc-arm-embedded-13.3.rel1`); no cross
   compiler is on the WSL or Git Bash PATH.
7. A clean T3W1 hardware build with bpq lifted out of the emulator-only gate, as a reviewed change,
   image digest recorded.
8. Step 5: the gate-6 ceremony plan as a dispatch for the founder (named image digest, cancel/refusal,
   displayed message intent, signature verification, recovery on a second clean emulator).
9. PQ12 key ceremony + sealed shares + CLI rounds + sighash differential, then the wallet press.
10. PQ07 browser-side handover and a handover log (so N-3 has an owner); PQ10 SAW rowSound and the
    on-chain fit (a 16,384-row proof is ~720 KB against jungle4's 524,287-byte NET limit); PQ04
    `segmentsBridge`; PQ06 underflow assertion; PQ02 loop and sponge; PQ03 HKDF at L4.
11. Close the review ledger in writing: N-1 fixed by `2d69aa26e`; F-3's receipt is CI run
    37960758936's gate-2 `cargo audit 0.22.2` (lock-wide); delete the two stale "cargo-audit is not
    installed on this box" lines in `scripts/btungsten/README.md`; F-2 at the next touch of `mlkem.rs`.
12. The authoring seat: rewrite the status report with the corrections in §2 before it is relayed further.

Per-user, not a build item: anyone who used the v1 QR bridge before 2026-10-04 makes new recovery
words and binds the new id under the old (tool landed `fe4a88ae2`).

Dropped, no primary source at HEAD (they live only in a seat's memory notes): "BEELOG leaf needs an
algorithm id and u64 time before the first anchor"; "bdata Only-me pipeline"; "house TLS ring →
aws-lc-rs (D-009c)" (D-009c is the ATProto docket; no file mentions aws-lc; the real open TLS item
is rustls 0.23.42 RUSTSEC-2026-0285, clearing at ≥ 0.23.45, owned by name in the PQ12 gate-2 record).

Local loose ends for the next Safe 7 session: `~/wt-bpq-safe7` is at `90a0b5cff`, a *sibling* rebase
(same parent `f7dba43d2` as `27ba1ed51`), not part of the receipt chain; `~/bpq-fit-clone` holds nine
uncommitted measurement files (never commit them); the offline remote refs in both WSL clones are
stale (`origin/beehive` at `4524b956`).

## 5 · Not checked here

Whose hand pressed `#sign` or `#pq-law` (the signatures prove a key, the commit author field is
unsigned, the signing receipt is untracked); the private fork's remote ref names; anything
on-device; a network trace of `#pq-check` (read only); the ARM compile failure (read from
`HARDWARE_FIT_RECEIPT.md`, not reproduced); `cargo audit` at exactly `87c744810`; CI runs keyed to
`8a2ad008e` (the API returns none for that `head_sha`; the first green run after it is what CI
holds); whether skaists.dev serves HEAD's `wallet.html` and `bpq.js`.

## 6 · Fixed forward in this session

`docs/specs/SPEC-BPQ-1.md:294` said "**Proved, emulator only**" of a test run with no SAW or Cryptol
receipt; under the wording ceiling it now says "**Exercised, emulator only**" (separate commit).
Everything else in this dispatch is record, not change.

HUMAN INTERACTION: NONE EXECUTED; five founder-only items named in §4. NEXT OWNER: the Safe 7
lane (§4 items 6–8) and the authoring seat (item 12).
