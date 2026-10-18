# kc/integrate: keychain releases and keyless edges, integrated; remaining operations handed off

Date: 2026-10-13. Coordinator: the Claude Code session that ran `kc/integrate`. This session stops
after this dispatch lands; nothing below waits on it.

## What is integrated (component evidence, not deployment)

- `tools/keychain-release/`: canonical release record (`bnr.keychain-release/1`), prepare/check
  rebuild from the named commit, envelope, place, import-sig, verify; Hive `bnr.anchor` builder and
  quorum reader pinned to the genesis anchor (block 108404167); the independent prober.
- `ops/keys-door/`: the keyless edge. Serves only what a release record names, after two ML-DSA-65
  implementations agree (fips204 in-process, the pinned `bsigner` as a subprocess), the chain walks
  from the pinned genesis with no jumps, the floor never falls, and every file hashes to the record.
  Two signature profiles, strictly separate: SPEC-BPQ-1 §3b and `bsigner sign`'s
  `bheart.signature/1`. Authority is the full public key and the exact record; `key_id` is only a
  consistency check; `signed_at_ms` is unauthenticated and ignored.
- `ops/keys-edge/`: Dockerfile (bsigner build pinned by SHA-256 in the image and in `edge.toml`),
  compose (keys-net, fixed address, hardened), `Caddyfile.keys`, the CI lab, `replace.sh`,
  `TRUST.md`, `WIRE-TEST-REQUEST.md`.

## Evidence, kept separate

| evidence | where | result |
|---|---|---|
| CI lab a–g (GitHub Actions, docker) at `f1890a163` | run `keychain-edge-lab` on that head | all PASS (TLS 1.3 hybrid-only refusals, SNI 421, bytes = record, fresh edge from a peer, floor, corrupt state, fork) |
| replacement test outside GitHub, at `4b72cd221` | `docs/receipts/keychain-edge/replace-2026-10-13.txt` | 14 PASS, 0 FAIL |
| replacement test outside GitHub, at `e5a8de2f3` | `docs/receipts/keychain-edge/replace-2026-10-13-e5a8de2f3.txt` | 14 PASS, 0 FAIL; one machine, loopback, not independent-host evidence. Its bsigner pin was computed from the local debug binary at run start: a record of which binary ran, not an authentication of that build. |
| raw bsigner behaviour (public-only keyset) | `keys-door` CI step `--nocapture`, test `bsigner_public_only_keyset_compatibility` | recorded as observed: wrong key, altered file, malformed envelope and unsupported envelope algorithms are refused; a keyset carrying private fields and a keyset whose `alg` is ml-dsa-87 are ACCEPTED by the pinned bsigner (it verifies with the envelope's algorithm). Neither is shown to allow a forgery. |
| edge-policy refusal | `verify::public_keyset` and its sentinel test | keys-door builds the public-only keyset from exactly five public fields, ml-dsa-65 only, checked key length and derived id; a keyset that fails is refused before any subprocess, and the sentinel proves bsigner is never run for it. This is the adapter's policy, not bsigner's. |
| valid release verification | lab step g (seq 5, bsigner-signed) and the Rust test with real `bsigner keygen`/`sign` | accepted by both verifiers |
| JS suite, Windows, `BSIGNER` unset | `node --test 'tools/keychain-release/test/*.test.mjs'` | 60 passed, 1 skipped (the noble-vs-bsigner cross check, NOT RUN without `BSIGNER`) |
| noble-vs-bsigner cross check, WSL, `BSIGNER` set | `bheart.test.mjs` | passed (run separately; not in CI) |
| CI on integrated heads | see "Final CI" below | recorded per head; `501ca5e5b` is historical, superseded before its run completed |

Not evidence of production: no edge serves `keys.skaists.dev` from these components; the outside
wire test of the live listener is **NOT EXECUTED** (`ops/keys-edge/WIRE-TEST-REQUEST.md`).

## Executable pin provenance

The `bsigner_sha256` pin makes an edge refuse any other binary at its path. In the lab and in
`replace.sh` the expected hash is measured from the binary just built or found, which records which
binary ran; it does not authenticate the build. Production provisioning takes the expected hash from
authenticated build/release evidence (a reproducible build of a named commit, or a signed release
record of the edge software), never from whatever file occupies the path.

## To BNROSE-RUST-001 (the verified-launch owner), for reuse

The release format (`bnr.keychain-release/1`, canonical record, envelope, both signature profiles),
the verifier interface (`keys-door verify --config --envelope`, the two-verifier rule, the chain
rules 1-7 and amendment A1), the trust-bootstrap requirements (TRUST.md §2), and the fixtures:
`ops/keys-door/tests/vectors/` (bpq.js vector, profile-separation cases), `ops/keys-edge/lab/lab.sh`
and `ops/keys-edge/lab/replace.sh`. A DNS-independent verified launch consumes these; it earns the
hostile-history rules only by failing these fixtures first. The current protection is edge-enforced;
nothing here verifies a release in the browser before its code runs.

## For the bsigner owner (findings, no change requested here)

With a public-only keyset in `--keydir`, `bsigner verify` reads only `type`, `kind` and the
verifying key: it accepted a keyset that also carried `sealed_b64u`/`seed`/`secret`, and one
whose `alg` was ml-dsa-87 (it dispatches on the envelope's algorithm). Recorded in the
compatibility test output; keys-door's adapter is stricter and is the enforced policy.

## Remaining operations, assigned

1. **Release authority (founder, through the existing law-signing procedure).** A law-signed
   `docs/RULINGS-*.md` appointing the release role: the full public key and its id, the custodian
   and environment, the genesis checkpoint, succession and revocation (TRUST.md §2).
   `docs/KEYCHAIN-RELEASE-SIGNERS.json` stays empty until then. No wallet-master or law-key reuse.
2. **The release key (its custodian).** Provisioned in the custodian's own environment; private
   material never enters a conversation, repo, CI or edge.
3. **Outside wire test (operations permission for the Hostinger listener; Hostinger owner Agent 23).**
   Run `WIRE-TEST-REQUEST.md` exactly, or record it NOT EXECUTED.
4. **First production release and edge deployment (after 1–3).** Prepare and sign release 1, deploy
   `ops/keys-edge` with the ruled pins, prober green from outside vantages.
5. **DNS cutover for `keys.skaists.dev` (founder, Namecheap).** Separate from everything above.
6. **Live ANT purchase (agent20 with the founder).** Untouched by this lane.
7. **Browser pre-execution verification (keychain owner).** Not built; recorded open in
   SPEC-BTUNGSTEN-PQ-1 §8.

## Final CI

The candidate is the commit that carries this file; its CI is the pre-merge result, read per
workflow (passed, failed, cancelled, skipped and queued kept apart) on the pull request that lands
it. The merge SHA and the post-merge runs are recorded on that pull request after landing; this
file is not edited again, so the candidate's CI covers it.
