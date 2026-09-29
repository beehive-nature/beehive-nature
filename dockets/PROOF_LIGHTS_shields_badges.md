⟨Research → Design/Code · Proof lights: status badges derived from verified state · 2026-09-27, amended 2026-09-27⟩

# Proof lights — badges as a projection of verifiable state

**Design law:** don't trust the badge; verify what generated it. A badge is a
small, human-readable projection of a machine-produced status document that is
re-derived from committed evidence. It is never a typed claim. A badge whose
value nothing machine-checks is not shown.

**Amendment (founder review, 2026-09-27).** The first version of this docket
proposed a public-Shields Endpoint phase and a later self-hosted Shields with a
verifier service. #250 already implements something simpler: offline rendering,
same-origin publication, no badge server at all. This amendment adopts that path
(§3) and corrects one wrong claim (§1). It also adds two distinctions the first
version blurred: historical evidence versus live status, and git addressing
versus cryptographic binding (§2). The founder's rulings on the three open
questions are in §5.

**Source pin.** Shields.io behaviour below is read from
`badges/shields @ 0a0ac0e1086b12ea602cd10f4c6647ab0fa4765f` (PUBLIC-CONSTANT):
- `doc/self-hosting.md` §"Disabling Dynamic and Endpoint badges";
- `config/default.yml` (`dynamicAndEndpointBadgesEnabled: true`,
  `allowUnsecuredEndpointRequests: false`);
- `core/server/server.js` (service registration filtered by that switch,
  around line 481);
- `services/github/github-license.service.js` (`_requestJson` to
  `/repos/{user}/{repo}`);
- `services/endpoint-common.js` (the endpoint JSON schema);
- `package.json` (`"license": "(MIT OR Apache-2.0)"`).

## 1. What Shields gives us, and what we use

| Family | How it gets its value | Fetches remotely? |
|---|---|---|
| Static `/badge/<label>-<message>-<color>` | The URL itself | No |
| Endpoint `/endpoint?url=<json>` | JSON with `schemaVersion: 1`, `label`, `message`, and optionally `color`, `isError`, `cacheSeconds` | Yes, from a requester-supplied URL |
| Dynamic JSON | Extracts a value from arbitrary JSON | Yes, from a requester-supplied URL |
| Service badges (e.g. GitHub license) | The service's own upstream API | Yes, the upstream API |
| `badge-maker` (the npm package) | Label, message and colour passed in-process | No. It is a pure renderer |

**The switch, stated correctly.** `dynamicAndEndpointBadgesEnabled` (env
`DYNAMIC_AND_ENDPOINT_BADGES_ENABLED`) turns off **both** the Endpoint and the
Dynamic family together; neither can be turned off without the other.
- **What the switch covers.** In `core/server/server.js` it only removes the
  open-ended service families from route registration.
- **What it does not cover.** Every other service still registers, and some
  of them still fetch upstream. For example, the GitHub-license service calls
  the GitHub API. (The static `/badge/...` route is one that does not.)
- **Correction.** It is **not** a global switch for outbound network access.
  The first version said a switched-off instance "fetches nothing"; that was
  wrong.

**What we use:** only `badge-maker`, in CI, offline. There is no Shields server,
public or self-hosted, anywhere in the path.

## 2. The status document (the thing that is actually trusted)

The implemented schema is `proof-lights/status/2` (#250; gate repaired in #253).
Per badge, three files are committed together under `docs/status/`:

- `<name>.source.json`: the instrument's `--json` output, byte-exact (the
  **evidence**).
- `<name>.json`: the status document. It names:
  - the instrument, the CI step and the full revision measured;
  - measurement provenance (`origin`, `run_id`, `run_attempt`);
  - the derived values;
  - `source_blob` and `source_digest`;
  - the renderer version;
  - `signature`.
- `<name>.svg`: `render(document)`, byte-exact.

**Every derived value is recomputed from the evidence by the gate**, never
read back from the document. The gate also checks:
- the evidence is readable and schema-valid;
- the revision is a commit in the repository;
- the evidence covers the manifest (the page list at that revision) exactly
  once per page × register.

A signature can authenticate an attestation; it cannot make an unchecked
derivation correct. So derivation checking comes first and signing second.

**Git addressing versus evidence binding.**
- `source_blob` is the git blob id: the repository *locator*.
- It is SHA-1, so it is not the long-term integrity commitment for signed
  evidence; NIST directs security uses of SHA-1 to SHA-2 or SHA-3.
- The commitment is `source_digest: {alg: "sha3-256", value}`. It is
  algorithm-tagged, and `sha3-256` is already in the estate's registry.
- **Scanner conflicts.** The secret scan blocks 48+ hex runs, so the digest
  carries the reviewed `PUBLIC-CONSTANT` marker on its own line. A scanner
  conflict gets a reviewed public-data treatment; it never drives a weaker
  hash.

**Revision provenance.**
- **Revision.** It must be a real commit, not merely forty hex characters.
- **`origin: local`.** The revision is the measurer's assertion, and the gate
  says so on every PASS.
- **`origin: ci`.** The run id and attempt must be bound to the revision the
  run checked out. The gate refuses `ci` until that binding is verifiable.
- **Historical measurements.** A measurement may name an older revision. It
  must never be relabelled as a measurement of today's head.

**Historical evidence versus live status.**
- **Historical measurement.** A revision-labelled static SVG
  (`… @7d6808d`) records what was measured at that revision. It cannot turn
  grey when time passes, so it claims nothing about now.
- **Live status.** A badge that claims *current* health needs a freshness
  evaluator with tested cache behaviour. The rule "expired or unreachable
  shows grey `unknown`, and there is never a cached pass" applies only to that
  live path. It is not a property of a file rendered earlier.

## 3. The path

```
measure → validate evidence → derive document → verify signature (when supported)
        → render locally (badge-maker) → publish same-origin files
```

| Step | Where | State |
|---|---|---|
| Measure | The instrument (e.g. `e2e/skaists-conformance.mjs --json`) | Exists |
| Validate evidence and derive | `e2e/render-badges.mjs` derive mode, which runs the gate before writing | #250 + #253 |
| Gate | `render-badges.mjs --check` plus `render-badges.test.mjs` (the forgery probes), in CI | #253 |
| Sign and verify | A dedicated CI-attestation key (§5.1) | Next card |
| Render | `badge-maker`, offline, in CI | #250 |
| Publish | The existing surface publication path, same-origin. Design-acceptance I1 holds; no badge CDN | #250 |

**Withdrawn from the first version:**
- the public-Shields Endpoint phase (P0);
- the self-hosted Shields and verifier service (P1).

Neither is needed, and both are network surfaces the offline design avoids.
A separate verifier is introduced only when a real **live freshness**
requirement exists, and then it serves verified documents rather than
fetching URLs. P2 remains: claims derived from signed BNRoSe receipts, through
the same path.

## 4. Initial badge set — derived only

| Badge | Derived from | Available |
|---|---|---|
| `skaists meter \| n/n fronts 100% @<rev>` | The standards meter's evidence, re-derived by the gate | Now (#250, #253) |
| `BUILD`, `TESTS` | CI job output, once CI-origin provenance is verifiable | With the CI-signing card |
| `REPRODUCIBLE` | `skaists/buzz` `.github/workflows/ci-images.yml`: the job fails unless a no-cache rebuild gives the identical digest (PR #9) | For CI images only: see below |
| `LICENSE \| <SPDX>` | The manifest's license field | Now |
| `SEAL \| <alg>` | The `bnr-seal` suite id (`Suite::as_str`) | Now |
| `ISOLATION \| env+fs` | The `buzz-acp` launcher `--check` probe in CI (PRs #7, #8) | When #8 lands |

**What `REPRODUCIBLE` means.** A reproducibility check *exists* for the CI
images. That means the instrument is available. It does not mean every subject
commit has earned `REPRODUCIBLE | yes`: each badge must name the image digest
and the run that rebuilt it.

**Still held back until a machine check exists** (typed claims are exactly
what this design replaces):
- `TELEMETRY | NONE`: needs a network-capability test (the next isolation card).
- `KEYS | USER-HELD` and `SELF-CUSTODY`: need an attestation or E-tier signal
  (`TIERED_ACCESS_attestation_design.md`).
- `AUDIT | GREEN`: needs an audit report reference.
- `ZK`, `SETTLEMENT`, `STORAGE`, `ETERNAL`: each needs the receipt or proof
  that backs it.

## 5. Founder rulings (2026-09-27)

1. **Signing key: a dedicated CI-attestation key**, never a wallet or personal
   root key. `bsigner`'s registry has `ml-dsa-44|65|87`; `ml-dsa-65` fits, but
   the full signing and verification path for status documents is untested
   until that card lands.
   - **Isolation from PRs.** Signing runs apart from untrusted PR execution:
     no privileged job runs PR content, and access is narrowly scoped through
     a protected environment.
   - **Pinned key.** The trusted public key is pinned in reviewed trust
     configuration. A key that accompanies a document is never accepted.
   - **Lifecycle.** Versioned key ids, defined validity periods, and an
     explicit revocation and rotation procedure.
   - **Owner.** The CI-signing card has a named owner, state, start
     condition and scope, recorded with the gate repair: #253,
     `docs/dispatches/2026-09-27-proof-lights-gate-repair.md`, "The CI-signing
     card" (2026-09-29).
2. **Hosting: no badge server for the first implementation.** The SVG, the
   document and the evidence are published through the existing
   surface-publication path. A verifier service comes only when a live
   freshness requirement justifies it. The fact that Shields offers a server
   is not a reason.
3. **Presentation: text first, glyphs optional.**
   - **Readable without decoding.** The measured value, the revision and the
     verification state must be readable without interpreting an icon or a
     colour.
   - **Three readings, one fact.** Fable evaluates each register:
     - cypherpunk: compact technical wording;
     - bee: a plain sentence;
     - raver: a more expressive presentation.
   - **Glyphs.** Glyphs (🔐 ◈ ✓ ∞ ⛓ ◉) identify categories only. They never
     manufacture an impression of verification.

## 6. What this docket does not claim

- It builds no code. The renderer and the gate are #250 and #253; signing is a
  later card.
- The Shields facts are read from the pinned upstream source above. The public
  shields.io site was unreachable from the build sandbox, so its hosted
  behaviour has not been independently checked.
