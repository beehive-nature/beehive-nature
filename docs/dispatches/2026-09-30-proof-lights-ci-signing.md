# 2026-09-30 — Proof lights: the CI-signing card

Seat: zCode (GLM). The card was recorded 2026-09-29 at the founder's request
(`2026-09-27-proof-lights-gate-repair.md`, "The CI-signing card") so the
signing work would have a named owner and not be lost between sessions. #250
and #247 are on `main`; this lands the card's scope, tested end-to-end on
disposable keys. The production key pair remains the founder's gesture — see
"the one human step" at the end.

## What landed

### 1. Canonical bytes (`e2e/render-badges.mjs`, `canonicalBytes`)

The exact signed byte string of a status document is its canonical
serialization: the `proof-lights/status/2` fields in fixed order, the
`source_digest` one-line treatment `serialise()` already applies, a trailing
newline, and **the `signature` field set to `null`**. The signer signs these
bytes and nothing else; the verifier recomputes them from the parsed document,
so a reformatted or key-reordered file cannot move the signed content, and the
signature can never cover itself. `serialise` round-trips `canonicalBytes`
byte-exactly (asserted in the local trial; the gate re-derives it on every
signature check).

### 2. Trust configuration (`docs/badge-trust.json`, schema `proof-lights/trust/1`)

A reviewed file pins the trusted public keys — **the gate never accepts a key
carried inside a document** (a document only names a `key_id`). Each pinned
key carries: a versioned key id (`bheart-<16 b64url>`, `bsigner`'s own
derivation), the algorithm (`ml-dsa-44|65|87`, `bsigner`'s registry), the
base64url verifying key (length-checked per FIPS 204 parameter set: 1312 /
1952 / 2592 bytes), a validity period (`valid_from`..`valid_until`, canonical
ISO-8601 UTC), a purpose (only `ci-attestation` is trusted today), and a note.
A separate `revoked` list names revoked key ids. `loadTrust()` validates all
of this strictly — exact fields, no duplicates, well-formed ids, `valid_from ≤
valid_until` — and `--check` REFUSES the whole run on any trust error.

**Semantics, stated once:** validity is judged **at signing time**
(`signed_at_ms` inside the validity window): an attestation made while the key
was valid stays verifiable after the key retires. **Revocation is absolute:**
a revoked key fails every signature it ever made, because revocation means
compromise, not age. A revoked key therefore STAYS PINNED (the public key
remains known so its signatures fail by name, not as "unknown key").

The file ships with `keys: []` — no production key exists yet, and inventing
one is not this seat's to do. An empty pin list is not a hole: every supplied
signature fails "not in the trust configuration", which is the correct
fail-closed behavior for a world with no pinned keys.

### 3. The signing half (`e2e/sign-badges.mjs`)

Signs **staged** origin-ci documents. Three refusals before any ink, so the
properties do not depend on the workflow alone:

1. **Head binding.** `--expect-sha` (in CI: `github.sha`, the run's own head)
   must equal the document's `revision`, or nothing is signed. This is the
   binding the card demanded: a valid signature over an origin-ci document
   proves a run checked out that revision, because the signer refused every
   other case.
2. **Trust first.** The seed's own key (key_id derived by `bsigner` from the
   seed's public half) must be pinned, valid NOW, and not revoked, or nothing
   is signed — a key the gate would refuse never produces signatures.
3. **Gate before ink.** Each staged document passes the full gate (evidence,
   coverage, derivation, manifest at that revision) unsigned; after signing,
   the signed document is verified again through the full gate before the run
   reports success.

The seed is env-delivered (`BADGE_SIGNING_SEED_B64U`, or `--seed-env VAR`):
never an argument, never printed, never written to disk. Without a seed the
job **skips by name** (exit 0, "nothing to sign") — the no-stall law: missing
credentials block only the work that needs them, while the gate stays fully
armed (an unsigned origin-ci document still fails `--check`).

### 4. `bsigner` extensions (`crates/bsigner`)

The estate's signer gains two CLI surfaces, both small, both inside the
existing cited construction (pq.rs citations unchanged and still accurate):

- `sign --seed-env VAR --alg ml-dsa-65 --file … [--out …]` — the signing key
  comes from the named environment variable; the key_id is derived from the
  seed's own public key (`dsa_public_from_seed`, new in pq.rs, same
  derivation path `dsa_sign` walks: `from_seed` → `verifying_key` → `encode`),
  so the envelope names the identity it signed under. `--key-id` and
  `--seed-env` are mutually exclusive.
- `verify-env --file MSG --envelope ENV --verifying-key-file PATH` —
  verification against an explicit one-line base64url public key, for
  verifiers that pin trust in their own reviewed configuration and never hold
  the private keyset.

The gate shells out to `bsigner` for all ML-DSA math — **one cited
implementation, both directions**; the gate never grows a second crypto
implementation in JavaScript. A missing or broken verifier binary fails
closed (probed).

### 5. The gate (`e2e/render-badges.mjs --check`)

Step 7 (provenance) now reads: origin `local` unchanged (asserted, unsigned,
stated); origin `ci` must carry positive-integer `run_id` and `run_attempt`
AND a signature. Step 8 (signature) verifies: exact `bheart.signature/1`
envelope shape (fields, algorithms, agility statement, digest `{alg:"sha3-256",
b64u, bytes}` where `bytes` is the content length — this is `digest_envelope`'s
shape, corrected during the local trial); key_id pinned in trust; not revoked;
valid at signing time; and the envelope verified by `bsigner` over the
canonical bytes (digest + byte count + signature math all inside
`verify_envelope`). A signature on a `local`-origin document fails outright —
assertions are never attested. `--check` without a resolvable verifier fails
closed on any signed document (`--verifier PATH` or `PROOF_LIGHTS_VERIFIER`,
falling back to `target/{debug,release}/bsigner`).

Derive mode learns `--origin ci --run-id N --run-attempt M --stage DIR`: the
unsigned ci document is staged beside its evidence for the signing job —
never written straight into `docs/status`.

### 6. The workflow (`.github/workflows/tests.yml`)

- The **meter job** builds `bsigner` (rust toolchain + cache, `cargo build
  --locked -p bsigner`) before the proof-lights steps: the probes need the
  binary, and any signed document on main will need the verifier. The meter
  step now also writes `--json meter-evidence.json` (the `manifestAt` regex is
  unaffected: the page list token is unchanged). On pushes to main, a new
  **stage step** derives the origin-ci document at `$GITHUB_SHA` with this
  run's id/attempt and uploads it as the `badge-stage` artifact. PR runs stage
  nothing.
- A new **`badge-signing` job**: `needs: meter`, runs only on pushes to main,
  in the protected **`badge-signing` environment**, with the seed delivered as
  `secrets.BADGE_SIGNING_SEED_B64U`. No PR content ever executes in it. It
  downloads the staged trio, signs it (`sign-badges.mjs`), verifies it, and
  publishes the signed trio as the `badge-signed` artifact. If the meter job
  is red, the signing job is skipped — a red measurement is not attested.

**Landing a signed badge on main** stays a normal reviewed commit: download
the artifact, commit the trio under `docs/status/`, and the next push's gate
re-verifies it against the pinned trust. CI keeps `contents: read`; nothing
auto-commits.

### 7. Negative probes (`e2e/render-badges.test.mjs`, now 36 tests)

The card's six, plus the controls and the signing-job refusals — every one on
**disposable keys** that `bsigner keygen` generates at test time (nothing
committed, printed, or persisted beyond the removed scratch dir):

| Probe | Verdict line |
|---|---|
| control: a properly signed ci badge passes | PASS with full signature provenance |
| wrong key (trust pins another key) | FAIL `not in the trust configuration` |
| unknown key id | FAIL `not in the trust configuration` |
| expired key | FAIL `was not valid at signing time` |
| not-yet-valid key | FAIL `was not valid at signing time` |
| revoked key (stays pinned, marked revoked) | FAIL `is revoked` |
| signature over altered bytes (1 ms of `measured_at` drift — not derivation-visible) | FAIL `content digest mismatch` |
| signed doc stripped of its signature | FAIL `origin ci requires a signature` |
| signature on a local-origin document | FAIL `origin local documents are unsigned by definition` |
| broken verifier binary | FAIL `gave no verdict` (fails closed) |
| malformed trust file / revoked-not-pinned | whole check REFUSES |
| signing job: revision ≠ run's head | REFUSES, signs nothing |
| signing job: key not pinned in trust | REFUSES |
| signing job: already-signed document | REFUSES to re-sign |
| signing job: no seed in environment | skips BY NAME, exit 0 |

Two pre-existing probes' failure WORDING changed with the new gate (the old
strings named the pre-card placeholder state); both still fail for their
forgery.

## Key rotation procedure (the card's item 6)

1. **Generate.** The founder runs `bsigner keygen --alg ml-dsa-65` on their
   own device. The keyset (seed) never leaves it. `keygen` prints the public
   `key_id` and `verifying_key_b64u`.
2. **Pin.** A reviewed commit adds the key to `docs/badge-trust.json` with
   `valid_from` = now, `valid_until` = a chosen horizon (rotation cadence is
   the founder's; the validity window is the enforcement), `purpose`
   `ci-attestation`, a note naming the generation date. The gate only starts
   trusting the key when this lands.
3. **Store.** The founder adds `BADGE_SIGNING_SEED_B64U` (the seed,
   base64url) as a secret of the `badge-signing` environment, which should
   carry reviewer approval (protection is the founder's gesture in the repo's
   settings). The seed is pasted once into GitHub's secret store and never
   again anywhere.
4. **Operate.** Every push to main signs the staged ci measurement with the
   environment's key — `sign-badges.mjs` derives the key_id from the seed and
   refuses to sign if that key is not pinned, revoked, or out of validity, so
   a stale secret cannot produce untrusted signatures.
5. **Retire (age).** Do nothing, or let `valid_until` pass: new signatures
   stop, existing signatures stay verifiable (validity is judged at signing
   time). Optionally remove the pin later — signatures then fail "not in the
   trust configuration", so only retire a pin when its badges are meant to
   lapse.
6. **Revoke (compromise).** Add the key_id to `revoked` (keep it pinned) by
   reviewed commit, and delete the environment secret. Every signature that
   key ever made fails from that commit on. Old signed badges on main go red
   until re-signed by the successor key — that is the intended behavior, not
   collateral: a compromised key's attestations must not stand.
7. **Approves.** Every trust-file change is a reviewed commit on a PR, like
   any other gate configuration. There is no second, faster path.

## Receipts (all on this box, 2026-09-30, worktree `wt-zcode-badgesign`)

- `cargo test --locked -p bsigner` → 36 passed, 0 failed (34 before this card
  + 2 new: `public_from_seed_is_the_keygen_verifying_key`, and the selftest
  arm).
- `cargo fmt --all --check` → clean.
- `cargo clippy --locked -p bsigner --all-targets -- -D warnings` → 2
  PRE-EXISTING `type_complexity` lints at `keys.rs:108` and `keys.rs:140`
  (`load_dsa`/`load_kem` signatures, untouched by this card; CI gates fmt, not
  clippy, on the workspace). Not fixed here to keep this diff scoped; recorded
  for whoever owns the next bsigner lane.
- `node --test render-badges.test.mjs` → 36/36 (21 carried, 2 reworded, 13
  new; disposable-key rig built and destroyed inside the suite).
- `node render-badges.mjs --check` → 1/1 PASS on the committed (local,
  unsigned) badge with the shipped empty trust file.
- End-to-end local trial (off-repo scratch): keygen → trust pin → stage
  `--origin ci` → `sign-badges.mjs` with env-delivered seed → gate PASS with
  `signed by … (ml-dsa-65, valid at signing time, not revoked)` → tamper
  `measured_at` by 1 ms → gate FAIL on the digest mismatch. The trial script
  lived in the OS temp dir and is deleted; nothing reusable was left out of
  the suite.
- `node scripts/lint-ci-shape.mjs` → 102/102 (three new run-steps carry
  `if: always()`; the two artifact `uses:` steps are infra and run on
  success/condition by design).
- `sh scripts/secret-scan.sh tree` → clean (the trust file carries base64url
  public material only; no seed material exists in the repo).

## What is proven, and what is not

- **Proven (reproducible):** every negative probe fails; a disposable-key
  signed ci document passes the full gate; the signing job's refusals hold;
  tamper detection is byte-level.
- **Not yet proven:** a signature by the PRODUCTION key in the REAL protected
  environment — that requires the founder's key and secret to exist. Until
  then the card's done-when ("a CI-produced, signed status document passes
  the gate") is proven on disposable keys only, and `docs/badge-trust.json`
  pins nothing.
- **UNVERIFIED by this seat:** nothing new cryptographically — ML-DSA is
  `bsigner`'s existing cited construction; the carried-forward warning from
  pq.rs applies verbatim (the RustCrypto `ml-dsa` crate has never been
  independently audited; NIST ACVP vectors have not been run in this repo).
- The status schema stays `proof-lights/status/2`: the `signature` field was
  always "null until signed"; an older gate fails closed on a signed document
  (UNVERIFIED placeholder), which is the safe direction.

## The one human step (founder gesture, plain language)

When you want the badges actually signed by the estate's key, do this once:

1. On your machine, run:
   `cargo run --locked -p bsigner -- keygen --alg ml-dsa-65`
   It prints a `key_id` and a `verifying_key_b64u` (public, safe to paste
   anywhere) and saves the private key in your `.bheartwallet` folder.
2. In the repo settings on GitHub, create an **environment** named
   `badge-signing` (Settings → Environments → New environment), and add to it
   a **secret** named `BADGE_SIGNING_SEED_B64U` whose value is the
   `seed_b64u` line from the keyset file it printed the path of. Turning on
   "Required reviewers" for that environment is the recommended protection.
3. Tell any seat the key is ready; pinning the public key in
   `docs/badge-trust.json` is a normal reviewed commit and the seats will do
   it.

Until then, everything works unsigned exactly as it does today, and the
signing job reports "nothing to sign" on every push to main.
