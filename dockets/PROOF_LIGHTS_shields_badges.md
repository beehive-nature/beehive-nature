⟨Research → Design/Code · Proof lights: status badges derived from signed state · 2026-09-27⟩

# Proof lights — badges as a projection of verifiable state

**Design law:** don't trust the badge; verify what generated it. A badge is a
small, human-readable projection of a machine-produced, signed status
document. It is never a typed claim. A badge whose value nothing machine-checks
is not shown.

**Source pin.** Shields.io behaviour below is read from
`badges/shields @ 0a0ac0e1086b12ea602cd10f4c6647ab0fa4765f` (PUBLIC-CONSTANT):
- `doc/self-hosting.md` §"Disabling Dynamic and Endpoint badges";
- `config/default.yml` (`dynamicAndEndpointBadgesEnabled: true`,
  `allowUnsecuredEndpointRequests: false`);
- `services/endpoint-common.js` (the endpoint JSON schema);
- `package.json` (`"license": "(MIT OR Apache-2.0)"`).

## 1. What Shields gives us

| Family | How it gets its value | Fetches a URL? |
|---|---|---|
| Static `/badge/<label>-<message>-<color>` | The URL itself | No |
| Endpoint `/endpoint?url=<json>` | JSON with `schemaVersion: 1`, `label`, `message`, optional `color`, `isError` and `cacheSeconds` | Yes, a requester-supplied URL |
| Dynamic JSON | Extracts a value from arbitrary JSON | Yes, a requester-supplied URL |

**The constraint that shapes the design.** A single switch,
`dynamicAndEndpointBadgesEnabled` (env `DYNAMIC_AND_ENDPOINT_BADGES_ENABLED`),
turns off **both** Endpoint and Dynamic badges together. Upstream warns that
these families fetch requester-supplied URLs, which is unsuitable for an
internet-facing instance that can reach private network resources. So a
self-hosted instance cannot keep Endpoint badges and also refuse to fetch
arbitrary URLs. Section 3 resolves this with a verifier that emits static
badges only.

Public `img.shields.io` sits behind Cloudflare (`doc/self-hosting.md`
§Cloudflare). That is acceptable for phase 0 only, never as permanent
infrastructure.

## 2. The status document (the thing that is actually trusted)

CI emits one status document per repository, per commit and per surface. It is
canonical JSON, signed, and follows the estate's crypto-agility law: every
signature names its algorithm.

```json
{
  "v": 1,
  "subject": {"repo": "skaists/buzz", "commit": "<40-hex>", "surface": "buzz-acp"},
  "issued_at": "2026-09-27T05:00:00Z",
  "expires_at": "2026-10-04T05:00:00Z",
  "claims": {
    "build":        {"value": "pass", "source": "<CI job URL>"},
    "tests":        {"value": "791/791", "source": "<CI job URL>"},
    "reproducible": {"value": "yes", "source": "<ci-images run URL>", "evidence": "no-cache rebuild digest == pushed digest"},
    "license":      {"value": "AGPL-3.0-only", "source": "Cargo.toml [workspace.package]"}
  },
  "sig": {"alg": "ml-dsa-65", "key_id": "<status signing key id>", "value": "<base64>"}
}
```

- **Every claim names its `source`.** That is the run or file that produced
  the value. A badge links there, so "verify what generated it" is one click.
- **`expires_at` bounds staleness.** An expired document renders grey
  `unknown`, never the last good value.
- **The signature uses the existing `bsigner` algorithm identifiers**
  (`crates/bsigner/src/alg.rs`, `SigAlg`: `ml-dsa-44|65|87`). No new crypto.
- **This is not a bnr-seal envelope.** Status documents are public; bnr-seal
  is for private storage.

## 3. Phases

| Phase | Render | Trust path | Fetching |
|---|---|---|---|
| **P0 — now** | `img.shields.io/endpoint?url=…` pointing at an endpoint JSON that CI publishes next to the signed document | CI job → endpoint JSON (unsigned projection) → badge; the badge links to the signed document | Public Shields fetches our URL (behind Cloudflare) |
| **P1 — self-hosted** | `badges.skaists.dev`, Shields with `DYNAMIC_AND_ENDPOINT_BADGES_ENABLED=false` | A small **badge verifier** fetches only our own status documents from an allowlist, checks signature, subject and expiry, then 302-redirects to the local **static** `/badge/<label>-<message>-<color>` | Shields fetches nothing. The verifier fetches only allowlisted origins. |
| **P2 — receipts** | Same as P1 | Claims are derived from signed BNRoSe receipts instead of CI job output | Unchanged |

P1 rejected alternative: keep Endpoint enabled and rely on an egress
firewall. It works, but it makes network policy the security boundary for
code that fetches user-supplied URLs. The verifier design needs no such
trust.

Verifier outcomes:
- valid signature and not expired → the claim's value and colour;
- expired → grey `unknown`;
- bad signature, wrong subject or unknown `alg` → red `unverified`, which
  is Shields' `isError` semantics;
- document unreachable → grey `unknown`.

It never falls back to a cached "pass".

## 4. Initial badge set — derived only

| Badge | Derived from | Available |
|---|---|---|
| `BUILD \| pass` | CI build job on the commit | Now |
| `TESTS \| n/n` | CI test job counts | Now |
| `REPRODUCIBLE \| yes` | `skaists/buzz` `.github/workflows/ci-images.yml`: the job fails unless a no-cache rebuild gives the identical digest, and provenance records it (PR #9) | Now, for CI images |
| `LICENSE \| <SPDX>` | The manifest's license field | Now |
| `SEAL \| <alg>` | `bnr-seal` suite id (`Suite::as_str`) | Now |
| `ISOLATION \| env+fs` | `buzz-acp` launcher `--check` probe in CI (PRs #7, #8) | When #8 lands |

**Not shown until a machine check exists** (typed claims are exactly what
this design replaces):
- `TELEMETRY | NONE`: needs a network-capability test (the next isolation
  card).
- `KEYS | USER-HELD` and `SELF-CUSTODY`: need an attestation or E-tier signal
  (`TIERED_ACCESS_attestation_design.md`).
- `AUDIT | GREEN`: needs an audit report reference.
- `ZK`, `SETTLEMENT`, `STORAGE` and `ETERNAL`: need the receipt or proof
  that backs each.

## 5. Open questions for the founder

1. Which key signs status documents? It should be a dedicated CI key, never
   a person's or wallet key. Where does it live, and how is it rotated?
2. P1 host: the oracle box or elsewhere?
3. Badge glyph and colour language (🔐 ◈ ✓ ∞ ⛓ ◉): adopt as Shields `logoSvg`,
   or keep plain text?

## 6. What this docket does not claim

- It builds no code: no verifier, no signing step, no Shields deployment.
- The Shields facts are read from the pinned upstream source above. The
  public shields.io site was unreachable from the build sandbox, so its
  hosted behaviour is not independently checked.
