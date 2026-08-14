# RAID — AUTHENTIK (goauthentik/authentik): IdP techniques vs the sovereign filter

**Source:** GitHub API license+source verification (`gh api repos/goauthentik/authentik/contents/...`) + docs; repo `main`, `pushed_at` 2026-08-14T18:56:15Z; self-reported version `2026.11.0-rc1` (pyproject.toml, Cargo.toml)
**Doctrine:** L-VERIFY from repo, capture-pattern test, TAKE/LEAVE/PATTERN
**Prompted by:** founder — "they are solving the same problems and they may have techniques we can use?"

---

## Executive Summary

Yes — same problems (multi-factor ladders, enrolment ceremonies, recovery, device metadata, config-as-code), and yes — there are real, MIT-licensed techniques worth taking. But authentik solves them **as an authority**: a Django server + Postgres that owns the user row, mints the session, and lets an admin with shell access log in as anyone (`authentik/recovery/lib.py`). That trust model is structurally inverted from bDiD and transfers **zero**.

What transfers is mechanism, not authority: the flow/stage decomposition, re-entrant remediation sub-ceremonies, offline signed-artifact verification (the vendored FIDO MDS), per-credential exponential backoff, confirm-before-activate for recovery material, and hash-gated declarative convergence. Highest-value single item: **re-entrant remediation** (`authentik/stages/authenticator_validate/stage.py::prepare_stages` + `FlowPlan.insert_stage`) — "you cannot pass this gate yet, here is the sub-ceremony that will let you" — which BNR does not have in any form.

Second finding, unrelated to authentik and more urgent: the primary receiving surface **does not exist**. DESIGN-BRIEF-03 §5/§6 tables `b-onboard/src/{ceremony,gates,ladder,probe,viewmodel,render,doctor}.rs` as "Built, tested (21 tests), 2,687 lines"; a tree search of `C:\Users\travi\beehive-nature` (excluding `target/`) returns **zero hits** for any of them. Actual crate is `crates/onboarding/src/{lib.rs 639, age.rs 274}` = 913 lines, 16 `#[test]`. This is good news for the RAID — techniques land as greenfield design, not migration — but the brief currently instructs implementers to build on nothing.

Third: authentik as **internal ops SSO** for BNR's own VPS/admin surfaces is a genuinely different and materially better answer — legitimate with three named conditions (below).

---

## The Structural Verdict

### As BNR USER identity — DISQUALIFIED, and not on license grounds

authentik is structurally an authority. A Django server owns a Postgres row per user, mints sessions and tokens, and every trust decision terminates at a server an admin runs. Recovery is an operator running `ak create_recovery_key` on the box: `authentik/recovery/lib.py` mints a `Token` with `TokenIntents.INTENT_RECOVERY`; `UseTokenView.get()` does `login(request, token.user, backend=BACKEND_INBUILT)` on a **GET** of `/recovery/use-token/<key>`; the CLI prints verbatim *"Store this link safely, as it will allow anyone to access authentik as {user}."* A sibling command `create_admin_group` force-creates an `is_superuser` group.

This fails filter (1) — it cannot survive 10^10 users × 1000 years with no human in the loop, because a human must run, patch, back up and hold the DB for each instance — and fails (2) at the level of every deployment being its own central authority.

Reinforcing evidence, each independently verified:
- Authorization verdicts are **cached** server-side: `authentik/policies/process.py::cache_key` = `goauthentik.io/policies/` + binding uuid + session_key + user pk, TTL from `cache.timeout_policies`. A revocation lag only an operator can flush.
- MFA-skip is a **server-minted HMAC**: cookie `authentik_mfa`, HS256 signed with `sha256(f"{get_unique_identifier()}:{stage.pk.hex}")` (`authenticator_validate/stage.py`). Only the server can mint or verify it.
- Backup codes are stored **in plaintext**: `authenticator_static/models.py` — `StaticToken.token = CharField(max_length=100, db_index=True)`, looked up via `token_set.filter(token=token)`. No hashing (contrast `SMSDevice`, which has an `is_hashed` flag).
- Admins can delete or enumerate any user's credentials: `authenticator_webauthn/api/devices.py::WebAuthnAdminDeviceViewSet` is a full ModelViewSet; `core/api/devices.py::AdminDeviceViewSet` enumerates any user's devices.

**Verdict: LEAVE the trust model entirely.** Only code shapes transfer, never the authority.

### As BNR INTERNAL ops SSO (VPS / admin surfaces) — LEGITIMATE, with three conditions

Different question, better answer. Self-hosting is complete (`lifecycle/container/compose.yml` = postgresql + server + worker, no hosted dependency); the OSS core is MIT with no seat counting and no license server; EE validation is offline against a bundled cert, so an unlicensed install degrades to "feature unavailable" rather than shutting down; full air-gap is a documented first-class mode (`website/docs/install-config/air-gapped.mdx`).

Conditions, all source-verified:
1. **Sever the two default-on beacons.** `authentik/lib/default.yml` ships `disable_update_check: false` and `disable_startup_analytics: false`. Stock install polls `https://version.goauthentik.io/version.json` (`authentik/admin/tasks.py::update_latest_version`, 8h cache) and POSTs a Plausible-style pageview carrying the version string to `https://goauthentik.io/api/event` on every boot (`lifecycle/gunicorn.conf.py` ~L138-152). Set `AUTHENTIK_DISABLE_UPDATE_CHECK=true`, `AUTHENTIK_DISABLE_STARTUP_ANALYTICS=true`, `AUTHENTIK_ERROR_REPORTING__ENABLED=false` (Sentry DSN `authentik.error-reporting.a7k.io` is already default-off, `sample_rate 0.1`), and set avatars to `initials` to kill the `secure.gravatar.com` fetch.
2. **Stay strictly outside `authentik/enterprise/**`.** See License below.
3. **Remove the docker-socket mount.** The shipped worker service in `lifecycle/container/compose.yml` runs `user: root` with `- /var/run/docker.sock:/var/run/docker.sock` (paired with `outposts.discover: true`). On a BNR VPS that is host-root-equivalent privilege granted to the IdP. Remove it, or disable outpost auto-discovery.

Ops tooling for BNR staff is a bounded human-in-the-loop surface. It must never touch the bDiD user path. Note `AUTHENTIK_TOKEN` (`internal/outpost/ak/entrypoint/entrypoint.go`, `cmd/{ldap,proxy,rac,radius}/main.go`) is a long-lived shared bearer secret between outpost and core — fine as a machine credential between two boxes BNR runs, categorically wrong for user identity.

---

## License (verified)

**GitHub's badge is unusable here.** `gh api repos/goauthentik/authentik` returns `license: {key: "other", spdx_id: "NOASSERTION"}` — precisely because the root LICENSE is a carve-out document. Anyone assessing this repo from the sidebar, or from training memory that says "authentik is MIT", **will get the license wrong**. Path-based reading of the actual LICENSE files is the only correct method, and it must be re-run per directory before any file is copied.

Root `/LICENSE` (Copyright (c) 2023 Jens Langhammer) is a **four-way split**:

| Path | License |
|---|---|
| `website/**` | CC BY-SA 4.0 |
| `authentik/enterprise/**` | the license defined in `authentik/enterprise/LICENSE` (proprietary) |
| all client-side JavaScript (served directly, or compiled/arranged/augmented/combined) | MIT Expat |
| **everything else** | **MIT** |

`authentik/enterprise/LICENSE` is the "authentik Enterprise Edition (EE) License", Copyright (c) 2022-present Authentik Security Inc. Verified verbatim terms: production use requires agreement with the Authentik Subscription ToS (`goauthentik.io/legal/terms`) **and** a valid EE subscription for the correct seat count; copy/modify for development and testing is permitted **without** a subscription; **your modifications and patches are claimed by Authentik Security Inc.** ("retain all right, title and interest in and to all such modifications and/or patches") and may only be used with a valid subscription; and it is "forbidden to copy, merge, publish, distribute, sublicense, and/or sell the Software." Source-available, not open source, with an unusually aggressive patch-assignment clause. **The dev/test carve-out is a trap for a project that intends to ship.**

**EE perimeter — quarantined from the BNR tree** (`gh api .../contents/authentik/enterprise`): `license.py`, `public.pem`, `models.py`, `middleware.py`, `policy.py`, `signals.py`, `tasks.py`, plus `agents/`, `audit/`, `core/revocation.py`, `endpoints/connectors/`, `lifecycle/`, `migrations/`, `policies/unique_password/`, `providers/{google_workspace, microsoft_entra, radius, scim, ssf, ws_federation}/`, `reports/`, `requests/`, `stages/{account_lockdown, authenticator_endpoint_gdtc, mtls, source}/`.

Note the EE stages and policies are **stage/policy-shaped and therefore easy to reach for by accident** while reading the OSS ones. Also note EE ships its own `radius/` and `scim/` providers *alongside* the MIT ones — the OSS provider exists; EE extends it.

**Everything BNR actually wants is MIT**, verified by directory location (the root LICENSE's rule is purely path-based):
- `authentik/flows/` — `planner.py`, `stage.py`, `markers.py`, `challenge.py`, `models.py`, `views/`
- `authentik/stages/` — all 22 concrete stage packages including `authenticator_webauthn/`, `authenticator_validate/`, `authenticator_static/`
- `authentik/policies/` — engine, process, models, types
- `authentik/blueprints/v1/` + the root `blueprints/` tree with `schema.json`
- OSS providers: oauth2, saml, ldap, proxy, rac, radius, scim
- `authentik/lib/generators.py`, `authentik/core/api/devices.py`

**Notable exception: mTLS as an auth stage is EE-only** (`authentik/enterprise/stages/mtls/`). If a BNR internal-ops design reached for client-certificate auth on admin surfaces, plan around it with the MIT WebAuthn stages instead.

**EE enforcement is offline and cryptographic, not a phone-home.** `authentik/enterprise/license.py` validates the license JWT locally: reads the `x5c` header, loads leaf and intermediate DER certs, verifies the chain terminates at the bundled root `authentik/enterprise/public.pem` (`get_licensing_key()`). No license server is contacted. Audience is bound per-install (`f"enterprise.goauthentik.io/license/{get_unique_identifier()}"`). ES512 over secp384r1 today with a stated ES384 migration in 2026 — an in-code comment monkeypatches `ECAlgorithm._validate_curve` to bypass pyjwt ≥2.11 spec enforcement (a live spec-violation workaround). Expiry drives graded degradation via `THRESHOLD_WARNING_*` / `THRESHOLD_READ_ONLY_WEEKS`. No license at all simply means `EnterprisePolicyAccessView.check_license()` returns *"Enterprise required to access this feature."* — the MIT core keeps working.

---

## Techniques Worth Patterning

Each entry: what they do → source path → where it lands in BNR → what must NOT come with it.

### 1. Re-entrant remediation sub-ceremony — HIGHEST VALUE

**What:** When a user hits the MFA gate with no usable device, `not_configured_action` ∈ {SKIP, DENY, CONFIGURE}. On CONFIGURE the stage looks up its `configuration_stages` M2M: zero → log `CONFIGURATION_ERROR` + `stage_invalid`; exactly one → `plan.insert_stage(next_stage)` and continue immediately; more than one → render them to the user as a **choice** (`SelectableStageSerializer`: pk, name, verbose_name, meta_model_name), then insert the chosen one. `in_memory_stage(view, **kwargs)` fabricates a Stage with **no database row** whose `view` is a Python class; `FlowPlan.insert_stage(stage, marker, index=1)` splices it as the immediate next step. A running stage can inject steps into its own ceremony.

**Source:** `authentik/stages/authenticator_validate/stage.py::prepare_stages` + `models.py::NotConfiguredAction`; `authentik/flows/models.py::in_memory_stage`; `authentik/flows/planner.py::FlowPlan.insert_stage`

**Lands in BNR:** as a fifth transition on the (not-yet-existing) ceremony machine — e.g. `Transition::Detoured { steps: Vec<StepId> }`. When a gate cannot pass but a known remediation exists, splice the remediation in front of the current gate, journal its own receipts, re-enter the gate — so the journal *proves the detour happened*. Where authentik offers a choice of `configuration_stages`, BNR offers a choice of remediations (passkey / FIDO2 / Trezor). Maps directly onto `/v1/bni.id/enroll` being callable mid-flow rather than as a separate detour.

**Do NOT import:** the DB-backed `configuration_stages` M2M, or `in_memory_stage`'s ability to fabricate arbitrary stage classes at runtime. BNR's remediation set must be a closed Rust enum resolved at compile time.

**Note:** BNR currently has no third exit. On failure it parks and renders `auto_fix`/`manual_action` as verbatim registry **text** — a human instruction, not a step the machine can run and journal.

### 2. Offline signed-artifact verification — the vendored FIDO MDS

**What:** The most transferable pattern in the repo. `authentik/stages/authenticator_webauthn/tasks.py::webauthn_mds_import` reads **only local files**: `mds/blob.jwt` (10,396,871 B), `mds/aaguid.json` (302,003 B), `mds/root-r3.crt` (GlobalSign Root CA R3, 867 B), and calls `fido2.mds3.parse_blob(blob, mds_ca())` — the signed blob is verified against a **pinned CA cert** at import time, zero network access. Revoked entries dropped via `fido2.mds3.filter_revoked`. Re-import skipped unless the blob serial (`blob.no`, cached under `goauthentik.io/stages/authenticator_webauthn/mds_no`) changed. The network fetch is a **separate ops-only management command**, `update_webauthn_mds.py`, hitting `https://mds3.fidoalliance.org/` and `https://passkeydeveloper.github.io/passkey-authenticator-aaguids/aaguid.json` — run by developers, never at user-auth time.

**Source:** `authentik/stages/authenticator_webauthn/{tasks.py, mds/, management/commands/update_webauthn_mds.py}`

**Lands in BNR:** ship the AAGUID→tier mapping as a signed artifact verified against a pinned key at import, network fetch confined to a dev/ops command. **BNR improvement over authentik:** anchor the snapshot hash to Arweave (ANS-104) so the mapping table is itself sovereign, and version it by content hash rather than a vendor-assigned serial (`blob.no`).

**Do NOT import:** the MDS as an **admission gate**. `device_type_restrictions` is a hard allowlist enforced at both enrol and use. Gating tier admission on an AAGUID allowlist inherits the FIDO Alliance as an authority over who may hold a tier, and `filter_revoked()` lets them revoke an authenticator model out of the table. It also collides head-on with the ratified BNR rule that **hardware is a preference, never a credential** (`crates/onboarding/src/lib.rs:39-41`, RELAY_17). AAGUID→tier must be **advisory metadata recorded at enrolment**, never a live admission check.

### 3. Per-credential exponential backoff

**What:** `ThrottlingMixin` puts `throttling_failure_timestamp` + `throttling_failure_count` **on the device**; `delay_required = get_throttle_factor() * 2 ** (failure_count - 1)`; returns `{reason: N_FAILED_ATTEMPTS, failure_count, locked_until}`. `throttle_reset()` on success, `throttle_increment()` on failure. Per-class factors are configurable and injected at verify time (`email_otp_throttling_factor`, `sms_otp_...`, `totp_...`, `static_...`, all default 1.0). Applied to `StaticDevice` and `TOTPDevice`; `WebAuthnDevice` does **not** use it.

**Source:** `authentik/stages/authenticator/models.py::ThrottlingMixin`

**Lands in BNR:** this is the **only** rate-limiting design in authentik whose state is per-credential rather than per-tenant, so it survives the 10^10 × 1000yr filter — counters can live in the user's own key store or as monotone entries in the hash-chained log, with no central server. Adopt the per-class factor idea too (a backup code should back off harder than a TOTP code). Surface `locked_until` to the user.

**Do NOT import:** `authentik.policies.reputation` — `update_score(request, username, -1)` on every invalid challenge is a server-held per-username score gating access.

### 4. Confirm-before-activate for recovery material

**What:** The unsaved `StaticDevice` (`confirmed=False`) and its `StaticToken` objects are held in `request.session` under `SESSION_STATIC_DEVICE` / `SESSION_STATIC_TOKENS` and are only persisted — `device.confirmed=True`, `token.save()` — in `challenge_valid`, i.e. **after** the user acknowledges the displayed codes. Nothing is written until the user confirms they hold the recovery material. Defaults: `token_count=6`, `token_length=12`, each code from `generate_id(length)` = `SystemRandom().choice(ascii_letters + digits)` per char (≈62^12 ≈ 2^71).

**Source:** `authentik/stages/authenticator_static/{stage.py, models.py}`, `authentik/lib/generators.py`

**Lands in BNR:** BIP-39 mnemonic enrolment must not mark the recovery factor as enrolled in the bDiD log until the user demonstrably confirms the phrase. **Make the log entry the confirmation, not the display.** This composes with the existing written-code floor (`crates/onboarding/src/lib.rs:259-277`, `Enrolment::complete` refuses with `NoWrittenCodeFloor`).

**Do NOT import:** plaintext storage of the codes (see Structural Verdict), and note the **missing** behaviour: re-running the static setup creates a *new* `StaticDevice` and nothing deletes or supersedes prior ones. BNR must make recovery-material rotation an explicit, logged supersession event.

### 5. Enforce user-verification at assertion time, bound to the requested level

**What:** `verify_authentication_response(..., require_user_verification = stage.webauthn_user_verification == UserVerification.REQUIRED)`. They bind the assertion-side UV check to the **same configured level** used to build the request — closing the classic WebAuthn bug of asking for UV and never checking the UV flag in `authenticatorData`.

**Source:** `authentik/stages/authenticator_webauthn/challenge.py::validate_challenge_webauthn`

**Lands in BNR:** this is the difference between Tier1 (passkey, UV preferred) and Tier2 (FIDO2, UV required) being real vs cosmetic. `/v1/authenticator/ladder` must return the tier's UV level **and** the verifier must re-check the UV flag. A tier that is only requested and never verified is not a tier.

**Related, cheap, take it:** hints→attachment auto-inference for older UAs that ignore `hints` — `hints ⊆ {security-key, hybrid} → CROSS_PLATFORM`; `hints ⊆ {client-device} → PLATFORM` (`authenticator_webauthn/stage.py::get_challenge`). Directly reusable as the tier ladder's device-class selector.

### 6. Response-class binding

**What:** Each validator (`validate_code` / `validate_webauthn` / `validate_duo`) first asserts that the submitted answer's `device_class` actually appears in the `device_challenges` the server put into plan context **for this attempt** — else "No compatible device class allowed".

**Source:** `authentik/stages/authenticator_validate/stage.py::AuthenticatorValidationChallengeResponse._challenge_allowed`

**Lands in BNR:** the verifier must bind the accepted proof type to the tier it actually demanded. Without it a client can downgrade itself to a weaker factor class.

**Negative lesson to take with it:** in `get_device_challenges`, `allowed_devices.append(device)` executes **before** the WebAuthn device-type restriction `continue`, and that list is what is passed to `check_mfa_cookie(allowed_devices)`. So a credential whose device type is no longer allowed is excluded from being *challenged* but is still accepted as the cookie-bound device that lets the stage be *skipped*. **Compute the fast-path/skip predicate from the same filtered set as the challenge predicate.** (Exploitability UNVERIFIED — reported as a design lesson, not a vulnerability claim; see Open Questions.)

### 7. Self-describing credential records

**What:** `WebAuthnDevice` stores `credential_id` (unique), `public_key`, `sign_count`, **`rp_id` per device** (CharField max_length=253), `attestation_certificate_pem`, `attestation_certificate_fingerprint` (SHA-256 via `authentik.crypto.models.fingerprint_sha256`), `aaguid`, `device_type` FK. `attestation=AttestationConveyancePreference.DIRECT` is **hard-coded, not configurable** — they always request attestation, which is what makes AAGUID capture and cert pinning possible. Duplicate enrolment blocked by uniqueness on `credential_id`. Challenge lives at plan-context key `goauthentik.io/stages/authenticator_webauthn/challenge` and is explicitly `pop`ped before every new challenge is generated.

**Source:** `authentik/stages/authenticator_webauthn/{models.py, stage.py, challenge.py}`

**Lands in BNR:** as **additive fields** on `onboarding::Authenticator` (`crates/onboarding/src/lib.rs:50-55`, currently only `credential_id` + `kind`). Put the attestation cert fingerprint and AAGUID into the user's hash-chained bDiD log as the tier-evidence entry at enrolment. Verification of "this user holds Tier2/Tier3" then reads the log, not a live MDS lookup — which is what makes it survive the disappearance of the FIDO Alliance.

**Do NOT import — and this is the sharpest architectural consequence in the whole assessment:** `authentik/stages/authenticator_webauthn/utils.py` derives `get_rp_id(request)` = request host minus port, `get_origin(request)` = absolute URI minus trailing slash. **A WebAuthn credential is permanently bound to a DNS name someone must keep controlling.** This is not authentik's flaw — it is inherent to WebAuthn — and it bears directly on `did:webvh`, which carries a domain. **Consequence for BNR: a passkey/FIDO2 credential must NOT be the identity root.** It should be a device-local unlock/wrapping factor gating access to the user-held Ed25519 / BIP-39-derived key that IS the bDiD root. If the tier ladder ever makes the WebAuthn credential the root of trust, the identity dies with the domain.

### 8. Recovery requires a surviving factor — and ships disabled

**What:** `blueprints/example/flows-recovery-email-mfa-verification.yaml`, slug `default-recovery-flow`, `designation: recovery`, `authentication: require_unauthenticated`. Binding order: identification (10) → email (20) → **authenticator_validate (21)** → password prompt (30) → user_write `user_creation_mode: never_create` (40) → user_login (100). **MFA is re-verified after the email link and before the password can be changed.** Rate limiting from the email stage: `recovery_max_attempts` default 5, `recovery_cache_timeout` default `minutes=5` (sliding), `token_expiry` default `minutes=30`.

And: **no recovery flow ships by default.** `blueprints/default/` contains authentication, authenticator-{static,totp,webauthn}-setup, user-settings, invalidation, oobe, password-change — no recovery. All recovery flows live in `blueprints/example/` with label `blueprints.goauthentik.io/instantiate: "false"`. Recovery is an explicit, opt-in, admin-authored artifact.

**Lands in BNR:** proof-of-mnemonic alone must not silently restore a bDiD that has a higher tier enrolled. Either require the surviving factor as well, **or** make the tier downgrade an explicit, user-signed, publicly logged event. And ship no default recovery path that an operator can enable without the user's key.

**Do NOT import:** email as the trust root. `stages/email` + `authenticator_email` make an SMTP-reachable mailbox (someone else's server) a recovery authority. The **redelivery pattern** (a token that resumes a ceremony on another device) is worth taking; email as trust root is not. Two-uses split applies: SMTP is entirely legitimate for BNR-internal ops notification, never on the user identity path.

### 9. Enumeration resistance as an engine property, not a UI choice

**What:** `identification/models.py::pretend_user_exists` (default **TRUE**) and `email/stage.py`'s silent pretend-to-send when `designation == RECOVERY` and the user doesn't exist. Non-disclosure lives inside the stage, not in the template.

**Lands in BNR:** when a bDiD-resolution or community-join step fails to find a subject, the step must consume the same time and emit the same challenge shape as success. Worth encoding as a law in the gates module rather than trusting each probe.

### 10. Designation — one engine, many ceremonies

**What:** `FlowDesignation` has seven values — authentication, authorization, invalidation, enrollment, unenrollment, recovery, stage_configuration — and it is **not decoration**. Stages branch on it (`authenticator_validate` refuses a passwordless WebAuthn challenge when `designation != AUTHENTICATION`; email pretends-to-send under RECOVERY). The planner refuses to cache STAGE_CONFIGURATION plans. `ToDefaultFlow.get_flow` resolves designation → concrete flow.

**Lands in BNR:** `Designation { FirstJoin, Recovery, Rotate, AddDevice, Delegate, Unenrol }` on a ceremony manifest, with step predicates reading it. One machine, one journal format, many ceremonies. BNR today models exactly one ceremony (first join); recovery, key rotation, add-device, guardian hand-off and un-enrol have no representation. **At 10^10 users with no help desk, recovery is not an edge case — it is the modal long-run ceremony, and it currently has no engine.**

### 11. Per-binding failure semantics + skip-the-wizard

**What (a):** `InvalidResponseAction` ∈ RETRY (re-render with field errors) / RESTART (replan) / RESTART_WITH_CONTEXT (replan carrying `plan.context` forward). Configured **per binding**, not globally.
**What (b):** `FlowPlan.requires_flow_executor` / `to_redirect` — given an allow-list of "silent" stage view types, if every remaining binding is silent AND no binding carries a `ReevaluateMarker`, the executor is never rendered; it dispatches only the final stage. Nothing is shown to a human who has nothing to answer.

**Lands in BNR:** (a) as a per-StepSpec field — today every BNR failure parks. A mistyped backup-code slice is not the same event as an unrecoverable failure, and the distinction belongs in the machine, not the GUI. (b) restore/re-join on a machine that already holds the keys should never render a 7-row wizard rail.

### 12. Two-phase applicability with re-evaluation at entry

**What:** Each `FlowStageBinding` carries `evaluate_on_plan` (default False) **and** `re_evaluate_policies` (default **TRUE**). `ReevaluateMarker.process` re-runs the engine with `use_cache=False` at the moment the stage is about to be presented, feeding it the live plan context, and returns None to delete the stage if it now fails. **A stage's applicability is a function of facts gathered by earlier stages in the same run.**

**Source:** `authentik/flows/{models.py, markers.py}`

**Lands in BNR:** each StepSpec gets an `applies: Predicate` evaluated at gate entry, never cached, with the verdict **written into the receipt** so a skipped step is auditable — replacing today's blunt `Outcome::Skipped` (hard-restricted to one gate, carrying no machine-readable reason) with `Outcome::NotApplicable { reason }`.

**Do NOT import:** the predicate implementation. authentik's expression policies execute admin-authored Python from a database (see next section). BNR predicates must be pure compiled functions over local facts.

### 13. Config-as-code — INTERNAL OPS ONLY

Four sub-techniques, all MIT, all landing on BNR's **ops** surfaces (`crates/wallet-relay/src/watch.rs:22` `WATCH_ONLY_ADDRESSES` env var; `ladder.rs:125-149` `ladder_metadata()`; `wallet-relay/src/lib.rs:414-418` `trezor_granted` match table) — display/ops data with **no identity authority**.

- **Schema generated from the consuming code.** `authentik/blueprints/v1/schema.py::SchemaBuilder` walks every allowed model's DRF serializer through `drf_jsonschema_serializer`, emits draft-07 titled "authentik {version} Blueprint schema", committed as `/blueprints/schema.json`. → BNR: derive a schema from the Rust config structs via serde+schemars, commit it version-stamped, point editors and CI at it. Compiled Rust types stay the single authority; the schema is a projection, never a second source of truth.
- **Content-hash-driven convergence.** `v1/tasks.py::blueprints_find` computes `sha512(path.read_bytes()).hexdigest()`; re-applies only `if instance.last_applied_hash != blueprint.hash`. No clocks, no sequence numbers, no coordination. → "Has this node converged" is answerable offline by comparing two digests, and the same digest can be anchored.
- **Validate by executing, then roll back.** `Importer.apply()` wraps `_apply_models()` in `transaction.atomic()` and raises `IntegrityError` to force rollback on any failure. Validation is the **same code path** run for real then deliberately discarded (`transaction_rollback()` enters atomic, yields, always raises `DoRollback`; `capture_logs()` collects what would have happened). → dry-run node provisioning against scratch state and discard, rather than statically predicting effects that depend on live state. Keep the all-or-nothing property: a partially provisioned node is worse than an unprovisioned one.
- **Explicit desired-state vocabulary** instead of implicit upsert: `absent | present | created | must_created`. `must_created` = hard error if the object already exists — exactly the create-only, no-clobber invariant BNR needs for anything key-shaped. In Rust these become four distinct operations/types rather than a runtime string field, which is strictly better.

Plus two cheap ideas: **symbolic cross-references resolved at apply time with hard failure** (`!KeyOf <id>` → `instance.pk`, else `EntryInvalidError`), and a **labels namespace marking provenance and lifecycle** (`blueprints.goauthentik.io/{system,generated,instantiate,description}`, with "mount an empty file over a shipped one to disable it").

And the boundary that makes it safe: **a bounded, total mini-language, not a scripting language.** 14 YAML constructors (`!KeyOf !Find !FindObject !Context !Format !Condition !If !Env !File !Enumerate !Value !Index !AtIndex !ParseJSON`) — conditionals, boolean combinators, enumeration, formatting, lookups; **no exec anywhere in the blueprint path**. Total functions, no user-defined recursion. That boundary is the single best design decision in the subsystem — and the one authentik partially violated (see disqualifiers).

### 14. Air-gap as a first-class, documented mode

`website/docs/install-config/air-gapped.mdx` enumerates **every** outbound URL on one page with the exact flag to kill each. Regardless of what BNR takes from authentik, **this is the right documentation artifact for BNR to produce about itself**. Sovereignty claims are only auditable if the egress surface is written down.

### 15. Graded degradation over hard failure

`THRESHOLD_WARNING_EXPIRY_WEEKS` / `_USER_WEEKS` / `_ADMIN_WEEKS` / `THRESHOLD_READ_ONLY_WEEKS` (`authentik/enterprise/models.py`): expiry escalates warn-admin → warn-user → read-only rather than flipping off. **Idea only — the file is EE-licensed.** For BNR: credential/anchor staleness should degrade capability progressively and visibly, never brick a user at a cliff edge.

### 16. Single-datastore discipline

Verified: `lifecycle/container/compose.yml` declares exactly three services — postgresql (`docker.io/library/postgres:16-alpine`), server, worker. **No redis service.** `pyproject.toml` lists no redis client; instead `django-postgres-cache`, `django-channels-postgres`, `django-dramatiq-postgres`, plus `django-pglock`, `django-pgtrigger`, `django-postgres-extra`. `website/docs/releases/2025/v2025.8.mdx`: the worker rework *"allowed us to not depend on Redis for background tasks."* They deliberately deleted an entire moving part. For a system BNR wants to survive without operators, every removed daemon is one fewer thing to babysit. **The direction of travel — fewer services, not more — is the pattern.**

### 17. Device-management UX (surface exactly three facts)

One unified table across all device classes: Name / Type / Created at / Last used at / Actions (`web/src/user/user-settings/mfa/MFADevicesPage.ts`). The Type cell shows `extraDescription` (the human authenticator model resolved from AAGUID) with the **raw AAGUID in a tooltip**; `DeviceSerializer.get_extra_description` / `get_external_id` resolve from `device_type`. New keys are **auto-named** from `device_type.description` (falling back to "WebAuthn Device"), so a YubiKey appears as its model name with zero user input. The Enrol dropdown is generated from each stage's `ui_user_settings()` configureUrl with an `AndNext` return URL.

**Lands in BNR:** same three facts (friendly name, model resolved from AAGUID as *advisory*, last-used), sourced from the user's own bDiD log rather than a server device table.

### 18. UI-agnostic challenge protocol

Every stage returns a serialized `Challenge` whose only structural contract is a `component` string (`ak-stage-authenticator-validate`, `xak-flow-redirect`, `ak-stage-access-denied`), plus `flow_info` and `response_errors`. The executor never knows what a screen looks like; `to_stage_response()` even wraps plain Django redirects/HTML into `RedirectChallenge`/`ShellChallenge` so everything crosses one wire format.

**Lands in BNR:** a `Challenge { component: String, .. }` + `Response { component, .. }`, both Serialize/Deserialize, with the view-model layer becoming *one renderer* of that rather than the interface itself. Unlocks a phone surface, a TUI, and an offline/paper delegation packet driving the identical machine. Relevant because BNR already has two surfaces in flight and no serialization boundary between them.

### 19. Observability by plan snapshot — the forward view

Every successful stage appends `deepcopy(self.plan)` to `SESSION_KEY_HISTORY` before popping; `views/inspector.py` replays it and exposes, per snapshot, the current stage binding, the **next planned** stage binding, and the sanitized context.

**Lands in BNR:** the local journal already gives the past; what is missing is the **forward** view — what is planned next, and why. A `planned_remaining()` on the machine, surfaced in the view-model, is cheap and is what lets a parked user see what they are parked *before*.

### 20. Ordering lesson from EE account_lockdown (idea only, code is EE)

Its source comment records that deactivation is committed **before** revocation, "so the retry loop inside `revoke_user_access` closes the timing-attack window where a credential is minted with a token being deleted."
**BNR analogue:** publish the revocation/rotation entry to the hash-chained log and anchor it **before** tearing down the old key's live capabilities, so there is no window in which a capability is minted against a key that is mid-revocation.

---

## Techniques That Do Not Transfer

| Technique | Source | Why it fails |
|---|---|---|
| **Flow/Stage/FlowStageBinding as DB rows** | `authentik/flows/models.py` | Ceremony definition is an admin-owned Postgres table edited through an authenticated API. Presupposes an authority that owns the ceremony. Take the **shape** (plan/marker/binding/challenge), never the storage or the ownership. |
| **`FlowToken` pickle round-trip** — actively dangerous | `authentik/flows/models.py` (`pickle.dumps` → base64 → DB text, `pickle.loads` on restore, both `# nosec`); `executor.py::_check_flow_token` deserializes on presentation of a **URL parameter** | Any BNR cross-device resume must be a signed, schema-validated, non-executable document. Never language-native deserialization. |
| **Server-side plan cache** | `planner.py::cache_key` = `goauthentik.io/flows/planner/<flow_pk>#<user_pk>`, plus `cache.keys(...)`/`delete_many` sweeps | Per-user server state. No analogue in a sovereign stack. |
| **Session-held ceremony state** | `SESSION_KEY_{PLAN,GET,POST,HISTORY}` in `executor.py` | Live ceremony in a server session. BNR's local hash-chained journal is the correct substitute and is already strictly better. |
| **MFA-skip cookie** | `authenticator_validate/stage.py`, HS256 over `sha256(unique_identifier + stage_pk)` | A server-held secret gating a user's authentication. Any BNR "recent auth" shortcut must be a short-lived capability signed by the **user's** key and independently verifiable. |
| **CLI/admin recovery token** | `authentik/recovery/{lib.py,views.py}` + `create_recovery_key.py` + `create_admin_group.py` | Bearer login link = account takeover by anyone with shell access. Not adaptable at any tier. |
| **Admin credential CRUD** | `authenticator_webauthn/api/devices.py`, `core/api/devices.py` | Revocation must be a user-signed entry in the hash-chained log, not an admin capability. |
| **Reputation scoring** | `update_score(request, username, -1)`, `authentik.policies.reputation` | Server-held per-username score gating access. At most an operator-side abuse control; never an input to whether a user may prove their own identity. |
| **Duo / SMS / CAPTCHA / email as factors** | `DeviceClasses` in `authenticator_validate/models.py`; `validate_challenge_duo` → Duo API | Every one is a subsidised third party (carrier, SMTP operator, Duo, CAPTCHA vendor). Fails filter (2). CAPTCHA additionally fails no-human-in-the-loop **by construction**. |
| **Sources / external IdP stages** | `IdentificationStage.sources` | Delegates identity to an upstream authority. Structurally opposite to user-held keys. |
| **Outposts, brands, RBAC** | `planner.py::_check_authentication` special-cases outpost service accounts by parsing `ak-outpost-<pk>` out of a username; `inspect_flow` is a Django object permission | Multi-tenant hosted-product concerns. |
| **OCI blueprint distribution** | docs: `oci://` prefix, `BlueprintOCIClient`, "re-fetched each execution, so when using changing tags, blueprints will automatically be updated", "credentials … embedded into the URL" | Mutable tags + secrets-in-URL + central registry. Take pulling a **signed, pinned** artifact; leave all three of those. Content-addressed and anchored beats `ghcr.io` tags on every axis BNR cares about. |
| **EE license gate in the authorization path** | `authentik/enterprise/policy.py` → `LicenseKey.get_total().status().is_valid` + `request.user.type == UserTypes.INTERNAL` | A vendor-signed subscription artifact deciding at runtime whether a security feature may run. Exactly the subsidy dependency the filter exists to catch. Password Uniqueness lives behind it. |
| **Prometheus/Sentry instrumentation coupling** | `start_span`, `set_tag`, `capture_exception`, Histogram labels threaded through `planner.py`/`stage.py`/`executor.py` | Useful telemetry for a hosted product; a phone-home dependency in a sovereign client. BNR's receipts already are the observability substrate. |

---

## Where Runtime Policy Would Be a Regression

Honest both directions: authentik's policy engine is **well-engineered** for what it is, and they are **honest about the trade**. `website/docs/customize/policies/types/expression/index.mdx` carries a "Privileged Feature" warning — *"Expression policies execute server-side Python inside authentik. Treat the ability to create or edit them as a highly privileged permission."* The in-code comment in `authentik/lib/expression/evaluator.py` is equally blunt: **"Yes this is an exec, yes it is potentially bad"** — justified because variables are limited and the policies can only be edited by admins. This is a deliberate admin-tier trade, not an oversight. And the bulk engines (`FilterPolicyEngine` / `ListPolicyEngine`) are genuinely good: static bindings translated into pure SQL `Q` objects, `with_descendants` for nested groups, MODE_ALL candidates pruned by the static verdict, per-(user,binding) cache lookups collapsed into one `cache.get_many()`.

That said, adopting runtime-evaluated gates would be a regression against BNR's compile-enforced ones on five axes:

1. **It is unsandboxed `exec`.** `BaseEvaluator.evaluate()` textually wraps the admin's expression into `def handler(<sanitized context keys>): <indented body>` via `wrap_expression()`, `compile()`s it, then `exec(ast_obj, self._globals, _locals)`. No RestrictedPython, no AST allowlist, no import filter. **No `__builtins__` restriction exists** — the key is absent from `_globals`, so CPython injects the full builtins module at exec time. (A repo-wide `gh api search/code q='__builtins__ repo:goauthentik/authentik'` returns `total_count 0`; corroborative, not exhaustive — see UNVERIFIED.) Net: an expression policy can import, open files, spawn processes — full RCE as the worker user, by design.

2. **A "policy" here is not a predicate — it is an effectful program that can mint credentials.** The expression globals hand out `requests` (a live HTTP session), `resolve_dns`/`reverse_dns`, `ak_send_email`, `ak_create_jwt` and `ak_create_jwt_raw` (mints and persists AccessTokens / signs arbitrary claims with an OAuth2Provider key), `ak_call_policy` (recursive policy invocation), `ak_create_event`. The same `BaseEvaluator` backs Property Mappings (`authentik/core/expression/evaluator.py`), so mappings are the same exec with a different context. Under BNR's unnameable-not-forbidden doctrine the whole point is that an invalid state **cannot be written down**; here any state is nameable at runtime by whoever holds the admin bit, and the check happens after the fact.

3. **Isolation is conditional and timeouts are advisory.** `engine.py::_evaluate_dynamic_bindings` creates a one-way `Pipe(False)` per binding and a `PolicyProcess` (fork context) — but `if not CURRENT_PROCESS._config.get('daemon'): task.run()` executes the policy **inline in the caller**, no fork, no isolation, no timeout at all. And the documented per-binding `timeout` (default 30s) is not a kill: `proc_info.process.join(proc_info.binding.timeout)` followed by an unconditional `proc_info.connection.recv()`. Nothing calls `terminate()`/`kill()`. Crash-safe (`PolicyProcess.run()` has `finally: self.connection.send(result)`), **hang-unsafe** — a wedged policy blocks the caller indefinitely. Compile-time gates cannot hang, cannot fork, cannot leak a process.

4. **Unbounded ongoing cost and correctness risk.** A compiled Rust state machine is checked once at build and costs nothing forever; an expression policy is re-interpreted per request, per user, for as long as the system runs. Across 10^10 users × 1000 years that is unbounded compute **and** unbounded correctness risk: a policy that starts raising silently degrades to its `failure_result` rather than failing loudly, and nobody is in the loop to notice.

5. **I/O and DB access during config parsing** — where authentik crossed its own line. `!File` (`common.py::File.resolve`) is a bare `open(self.path, encoding='utf8')` with **no base-directory restriction** (while the sibling `BlueprintInstance.retrieve_file()` in `blueprints/models.py` does correct traversal defence: `joinpath().resolve()` then `if not str(full_path).startswith(str(base.resolve())): raise BlueprintRetrievalFailed`). `!Env` reads process env; `!Find` issues live ORM queries. All fire during **API-time validation**, before apply, because `BlueprintInstanceSerializer.validate_content()` runs `Importer.validate()` on POSTed content — giving a blueprint author an arbitrary-file-read primitive on the worker. Same admin trust tier as expression policies, but worth naming. BNR config parsing must be pure and offline-reproducible: same bytes → same parse on any machine, with external inputs resolved in a separate, explicit, auditable step.

**Two defaults to invert, not copy.** `_combine_results`: `if not all_results: return PolicyResult(empty_result)` with `empty_result=True` — **no bindings means PASS**. Combined with default `MODE_ANY` (one passing binding is enough), an authentik target is **open until someone remembers to close it**. Whatever BNR borrows, the default must be closed and unconfigurable for identity-adjacent gates. Conversely `PolicyBinding.failure_result` defaults to `False` (fail-closed on policy error) and *that* is right — make the failure disposition a named, type-level decision, and for identity make it fail-closed with no option to change it.

**And the ordering tax.** authentik's own docs admit "blueprint discovery and evaluation is not guaranteed to follow any specific order"; the fix is a meta-model (`authentik_blueprints.metaapplyblueprint`) that applies another blueprint inline, bypassing the task queue with an in-code comment about avoiding deadlocks. Rust's module/type graph gives BNR that ordering **for free at compile time**. Any move toward declarative config for the node garden should keep the ordering problem inside the compiler, not push it into YAML.

**What BNR must not weaken, whatever is adopted** (all verified in `crates/onboarding/`):
- `GradeDisclosure` compile-enforcement (`lib.rs:337-347`): private `shown` field, **no `Deserialize` derive**, sole constructor `disclose_grade()`. The doc comment at 326-328 names the alternative as a past defect — *"the old `grade_was_shown: bool` was the thread_age defect — a protection decided by a value the restrained party hands in."* A runtime policy engine evaluating a gate from serialized context would re-introduce exactly this. The `compile_fail` doctest at 331-336 is the guard.
- The written-code recovery **floor** (`lib.rs:259-277`) — `Enrolment::complete` refuses with `NoWrittenCodeFloor`; the test at 456-466 proves a second authenticator alone does not substitute. Rationale in-code (213-217): it is the only option available to someone poor and someone with exactly one device.
- `PersonaBinding::bind` custody refusal (`lib.rs:194-207`) and the explicit non-wildcard match in `is_pds_custodial` (`lib.rs:101-106`), so a new persona variant must decide its own custody status.
- Age containment (`age.rs:9-15` — "THE ABSENCE IS THE GUARANTEE"; no birthdate/document-number/scan field is representable; no document-upload variant, `age.rs:32-35`) plus the source-scan containment test with positive decoy at `lib.rs:617-638`. Any IdP technique that folds attribute verification into the identity flow breaks this by construction.
- "NEVER a private key. NEVER signs." (`wallet-relay/src/ladder.rs:2-4, 67, 83`; `watch.rs:2-3, 29`).
- Hardware is a preference, never a credential (`lib.rs:39-41`, RELAY_17).
- `Enrolment` field privacy (`lib.rs:248-253` private, `279-290` read-only accessors). No setter, no post-hoc mutation.

**Accumulated ceremony context must be a typestate builder over typed witnesses, not a `HashMap<String, Value>`.** The moment the context becomes stringly-typed, every compile-enforced gate in that crate degrades to a runtime check.

---

## Cross-Seat Notes

**To whoever owns DESIGN-BRIEF-03 — blocking documentation defect.**
§5 (lines 205-211) tables `ceremony.rs` (404), `gates.rs` (229), `ladder.rs` (198), `probe.rs` (271), `viewmodel.rs` (921), `render.rs` (425), `doctor.rs` (207) as "Built"; §6 line 254 claims "Onboarding crate (7 modules, 2,687 lines) | b-onboard/src/ | Built, tested (21 tests)". A `find` across `C:\Users\travi\beehive-nature` excluding `target/` returns **zero hits** for `b-onboard/`, `ceremony.rs`, `gates.rs`, `probe.rs`, `viewmodel.rs`, `render.rs`, `doctor.rs`. The only `ladder.rs` is `crates/wallet-relay/src/ladder.rs`, a different thing. Actual: `crates/onboarding/src/{lib.rs 639, age.rs 274}` = 913 lines, 16 `#[test]`. §1 line 43 instructs implementers to build Tier 1 on "existing `onboarding` crate's ceremony/gates/ladder/viewmodel" — **that instruction points at nothing.** Either the modules exist somewhere unsearched (a sibling repo, a branch, a stash — UNVERIFIED, only the working tree was searched) or the brief needs correcting before any docket opens against it.

**To wallet-relay — code defect, emitted transaction is structurally unsignable.**
`crates/wallet-relay/src/ladder.rs:110-113`: `enroll_handler` reads `pubkey_envelope` (line 109) and echoes it back in the response (line 119), but passes the **literal string** `"PUB_KEY_FROM_ENVELOPE"` as the key into `prepare_updateauth`. The inline comment says "placeholder — envelope payload.value fills this" and nothing fills it. `envelope.rs:18-20` shows the value lives at `payload.value` and is never read; grep confirms no `as_str()` call touches `pubkey_envelope` anywhere. The emitted `unsigned_tx` would set bni.id active auth to a non-key string. Confirmed by source reading + grep, **not** by executing the endpoint.

**To architecture — three unreconciled ladders.**
(a) `onboarding::AuthenticatorKind = {PlatformPasskey, RoamingKey}` — 2 variants (`lib.rs:43-46`). (b) `wallet-relay::ladder::AuthenticatorTier = {Larva, Pupa, Bee, RoyalGuard}` — 4 rungs with a T-F/T-H custody seam (`ladder.rs:10-15`). (c) DESIGN-BRIEF-03 §1 — 3 Tiers mapped onto an L1/L2, L3/L4, L5 decentralisation ladder (lines 42, 53, 65). Plus onboarding's own Step 0-3 commons ladder (`lib.rs:5-19`). They disagree about how many rungs exist and what a rung means. **Any authentik technique must attach to exactly one of these**; pick before adopting. Also: `crates/onboarding` has **zero dependents** — it appears only as a workspace member (root `Cargo.toml:32`) and in its own manifest; `wallet-relay` does not depend on it. The two ladders were written independently and have never been reconciled in code.

**To architecture — DID method divergence.**
`crates/onboarding/src/lib.rs` is written entirely around `did:autonomi` anchored to Autonomi (lines 12, 22, 59, 65, 295, 360) and makes Settlement grade require a bidirectional `did:plc` ↔ `did:autonomi` binding (295-308). DESIGN-BRIEF-03 (239/276) and the current architecture use `did:webvh` anchored to Arweave via ANS-104 Ed25519. **The onboarding crate is stale relative to the stated bDiD root.**

**To architecture — founder-in-the-loop on the declared mass-user path.**
`SPEC-AUTHENTICATOR-LADDER-1` (~line 47) states "This ladder is the MASS-USER (Layer-0 keypair) climb", explicitly separate from the hub-tier heavyweight mint. Yet `ladder.rs:121` emits `'_note':'UNSIGNED. Founder signs. Pubkey enrolled additively (S3).'` Under the filter this fails test (1) — it cannot survive 10^10 users with no human in the loop — and is the single sharpest structural bottleneck on the new endpoints. Whether this is permanent design or pre-launch scaffolding is **not stated** in either document; the conflict is an inference from the two, not a contradiction either admits.

**To Design/UX (the surface, if a wizard is built).**
Take §17 (three facts per credential, auto-named from AAGUID), §18 (component-string challenge so the same machine drives CLI + libcosmic + a phone), §19 (show the user what they are parked *before*, not just where they are), §11b (never render a wizard for a user with nothing to answer), and §5's hint→attachment mapping so the wrong authenticator is never offered on older browsers. Do **not** take authentik's admin-facing flow editor — the ceremony must not be an editable table.

**To goose / Cowork.**
The blueprints subsystem (§13) is the reusable ops artifact here: schemas generated from consuming code, sha512-gated convergence, validate-by-executing-then-rollback, offline CLI applier (`manage.py apply_blueprint <path> [--dry-run]`) as the primary interface with HTTP as optional sugar. Shipped corpus is real: `/blueprints/{default 16 files, system 10, example 13, migrations}`. Applies to VPS bring-up, not to identity.

---

## Open Questions for Founder

1. **Do the phantom modules exist anywhere?** Only the working tree of `C:\Users\travi\beehive-nature` (excluding `target/`) was searched — not other drives, other repos, git history, or unmerged branches. If they exist, this RAID's "empty socket, greenfield" framing is wrong and the techniques are a migration instead. If they don't, DESIGN-BRIEF-03 §5/§6 need correcting before any implementation docket opens against them.

2. **Which ladder is canonical?** Two-variant `AuthenticatorKind`, four-rung `AuthenticatorTier`, or the brief's three Tiers? Nothing can be attached until this is settled.

3. **`did:autonomi` or `did:webvh`?** The onboarding crate and the brief disagree. Every recommendation about writing tier evidence "into the bDiD log" is method-dependent.

4. **Is the founder signature in `enroll_handler` permanent design or pre-launch scaffolding?** If permanent, the mass-user framing in SPEC-AUTHENTICATOR-LADDER-1 needs revising; if scaffolding, it needs a dated removal condition. Neither document says.

5. **Internal ops SSO — deploy authentik, or build?** The three conditions are cheap and verified (kill two beacons, quarantine `enterprise/**`, remove the docker-socket mount). But it is a Python/Django/Postgres/Go/Rust stack to babysit on a BNR VPS. Worth a separate decision, and it turns partly on Q6.

6. **Should anyone read the Authentik Subscription ToS?** `authentik/enterprise/LICENSE` incorporates `goauthentik.io/legal/terms` by reference as a binding condition of EE production use. That document is **off-repo and was not fetched**. Since the recommendation is to quarantine `authentik/enterprise/**` entirely, it does not block this assessment — but any EE evaluation is incomplete until it is read.

7. **Is a licence review wanted before any code (as opposed to design pattern) is transcribed?** The MIT reading is a reading of the LICENSE text, quoted verbatim above — not legal advice.

---

## UNVERIFIED — carried forward, do not upgrade

**On authentik (read-only, not executed):**
- **No code was tested.** Every claim is read from the repo tree at `main` via `gh api .../contents/...`. Behaviour under load, concurrency, or attack was not exercised. **No commit SHA was pinned** — all fetches were against the default branch as of 2026-08-14; contents may have moved.
- **Exploitability of the `allowed_devices` ordering** (`authenticator_validate/stage.py::get_device_challenges`, append before the device-type `continue`) is UNVERIFIED. The code path is as described; whether it is reachable as a real MFA bypass depends on `last_auth_threshold` being non-zero and a device-type restriction being tightened after a cookie was issued. **Reported as a design lesson, not a vulnerability claim.**
- **The hung-policy claim is reasoned from source, not empirically tested.** It follows from `engine.py` calling `connection.recv()` unconditionally after `join(timeout)` with no `terminate()`. No test asserting termination behaviour was found; the code was not run. Mitigating detail that *was* verified: `PolicyProcess.run()` sends its result in a `finally:` block, so a policy that merely raises always returns — only a genuinely wedged policy hangs.
- **The "no `__builtins__` restriction anywhere in the repo" claim is search-index dependent.** It rests on `gh api search/code` returning `total_count 0` plus a direct read of `authentik/lib/expression/evaluator.py`. GitHub code search does not index every file in every repo. The direct read is solid; the repo-wide absence claim is corroborative.
- **Rust tier division of labour is UNVERIFIED.** Root `Cargo.toml` defines a workspace (`packages/ak-axum`, `ak-common`, `client-rust`, `website/scripts/docsmg`), edition 2024, axum/axum-server with `aws-lc-rs` compiled with the `fips` feature (matching `compliance.fips.enabled`); `src/` holds `main.rs`, `healthcheck.rs`, `server/{core,static,tls}.rs`, `worker/`, `outpost/`, `brands/`, `metrics/`; `default.yml` carries `rust_log` tuning for tokio/hyper/sqlx/rustls. Files, dependencies and module names confirmed — but `src/main.rs` and `src/server/core.rs` were **not read**, so **which process actually terminates HTTP in the current release is UNVERIFIED**.
- **Redis elimination is verified only for the default path.** VERIFIED: no redis service in `compose.yml`, no redis client in `pyproject.toml`, v2025.8 release note. NOT VERIFIED: what schemes the `cache: url` and commented `channel: url` keys in `default.yml` accept — an external Redis may still be pluggable.
- **Helm chart requirements UNVERIFIED.** The chart lives in a separate repo (`goauthentik/helm`) which was not queried. Only evidence is the v2025.8 release note referencing `docker.io/library/redis` 8.2 in chart defaults *at that time*.
- **Blueprint re-apply interval.** The docs claim instances are re-applied "regularly (every 60 minutes)" (`website/docs/customize/blueprints/index.mdx`); the Schedule/crontab definition setting it was **not located** (`authentik/blueprints/apps.py` and the tasks.schedules machinery were not read). The 60-minute figure is a **docs claim, not a source-verified constant**.
- **Not read:** `authentik/blueprints/{apps.py, v1/oci.py, v1/meta/registry.py, v1/exporter.py}` and the blueprints test suite. All OCI distribution claims come from the docs page and `models.py::retrieve_oci()`, **not** from reading the client.
- **Not read:** 15 of the 22 OSS stage packages as source. The stage inventory is verified as a **directory listing** only; `flows/*`, `authenticator_validate`, `authenticator_webauthn`, `authenticator_static`, `identification`, `email`, `deny`, `redirect`, `policies/models.py` were read as source. Claims about consent, invitation, prompt, user_write, captcha, user_login/logout/delete internals are **not** source-verified.
- **Not verified:** whether the ExpressionPolicy create/edit permission (the RCE-equivalent) can be delegated to non-superuser roles through RBAC, and which permission strings gate it. The docs call it "a highly privileged permission"; the permission model was not traced.
- **Not verified:** `PolicyResult` pickling behaviour through the Django cache backend, and whether `cache.timeout_policies` has a default that bounds the staleness window in practice. Key construction and the `cache.set` call are verified; the configured TTL default is not.
- **Not verified:** `LicenseUsage` runtime behaviour (`authentik/enterprise/models.py`). It records usage locally for seat accounting; whether any path transmits usage off-box was **not** confirmed. No such transmission appears in `license.py` and it is not among the four outbound URLs in `air-gapped.mdx`, but `models.py` itself was not read.
- **Not verified:** exact EE feature-to-directory mapping as marketed. Directory names under `authentik/enterprise/` are evidence of **scope**, not of function; individual modules (`agents/`, `endpoints/connectors/`) were not read.
- **`mds/blob.jwt` was not opened or parsed**, and the validity period / current status of GlobalSign Root CA R3 in `mds/root-r3.crt` was not checked. The claim that the pinned CA eventually expires is a general property of X.509 roots, not something read from that file.
- **Version string `2026.11.0-rc1`** is self-reported in `pyproject.toml` and `Cargo.toml` on `main`. This is a pre-release number on the development branch, not necessarily the current stable tag; the releases API was not queried.
- **Not assessed:** git history, release cadence, contributor concentration, CVE record. Nothing here speaks to project health, only to code at `main`.
- **Docs caveat:** the WebAuthn stage docs page does **not** mention the FIDO MDS at all. All MDS behaviour above is verified from code (`tasks.py`, `mds/`, `update_webauthn_mds.py`) only. The static stage docs page does not state defaults; `token_count=6` / `token_length=12` are verified from `models.py` only. The flow-designation docs summary came via WebFetch (a model-summarised page) — every claim carried forward from it was independently confirmed against `flows/models.py` and `planner.py`; nothing rests on the docs page alone.
- **`authentik/stages/authenticator/models.py::Device.from_persistent_id`** rendered in the base64-decoded read with what appeared to be an unusual `except` clause. Not confirmed through a second channel; **excluded from findings**, no claim made.
- **Partially read:** `authentik/enterprise/LICENSE` was read to ~30 lines, covering the operative grant, subscription requirement, retention-of-title clause and redistribution prohibition. The remainder was not read.
- **Unresolved legal question:** whether the root LICENSE's MIT Expat carve-out for "all client-side JavaScript" overrides the `enterprise/` carve-out for EE frontend code under `web/`. The EE text asserts client-side assets are MIT, which reads as consistent, but the interaction of the two documents for any EE feature's UI code cannot be resolved from the tree alone.

**On BNR:**
- **The workspace was not compiled or run.** The `ladder.rs:110-113` unsignable-tx defect is confirmed by source reading + grep, not by executing the endpoint.
- **Line numbers cited for BNR files are from the working tree as read in this session and will drift.**
- **Only lines 1-120 of `age.rs` (of 274) were read.** `satisfies_regulated_purchase` is truncated at 120; the `no_birthdate_or_document_field` test was **not read directly** — its existence is asserted by the module doc comment at `age.rs:14-15`.
- **The 16-test count** is a grep of `#[test]` attributes in the two source files; it excludes the `compile_fail` doctest at `lib.rs:331-336`. The crate has no `tests/` dir.
- **DESIGN-BRIEF-03: only §1, §5 and §6 were read.** §2-4 and §7-10 were seen as section headers only.
- **The wider BNR tree** (b-accord, b-domain, bnri-cosmic, bnr-mirror) was **not searched** for an existing ceremony-manifest or designation concept. The recommendations in §10 and §13 are written as if none exists; that assumption is UNVERIFIED and should be checked before any implementation docket opens.
- **One seat in this assessment fetched nothing from goauthentik/authentik** (its assigned topic was "read OUR code, not authentik's"). Its characterisations of authentik were training knowledge and have been **excluded** from this document; every authentik claim above carries a source path from a seat that performed the fetch. L-VERIFY on the licence question is discharged by the seats that read `LICENSE` and `authentik/enterprise/LICENSE` directly, quoted verbatim in the License section.