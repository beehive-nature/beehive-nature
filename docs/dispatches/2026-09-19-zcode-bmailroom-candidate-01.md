# bMAILroom candidate 01 — backend (writer seat zCode, start order d003de1f relayed by the coordinator for LoVis waTer; scope change 26d9d346: backend only)

> **ADDENDUM — the `-02` fix-forward head (this dispatch's riding commit).**
> Commit `ce83dcd0` on `zcode/bmailroom-candidate-01` is **SUPERSEDED**:
> it posed the founder as author under the pre-18:06Z §7 shape; the
> founder's word (bUi 03a967c4, relayed 8adf9b3b) makes the seat author
> AND committer under its own identity. This head starts at `d7b9b2c6`
> (NOT a child of ce83dcd0), carries the same tree plus the review cures,
> and is credited only to the executing seat. The in-tree §7 CI check is
> expected RED on this branch until the founder's "§7 amend: yes" lands —
> that red is known, named, and must not be "fixed" by re-adopting the
> founder as author. Reviewer routing corrected per 8adf9b3b #3:
> **BcODexAstRA reviews this backend**; bFUzZ reviewed the frontend
> profile (PASS 8cb872ab carried to GitHub PR #140 at tree 67797992).
>
> **Review cures folded into this head (Astra CHANGES REQUIRED 16070879,
> relayed adfb6d9e; F1 also 8adf9b3b #2):**
> - **F1** stored/uncertain notices are re-checked against the CURRENT
>   binding before ANY retry publishes them; a changed/revoked binding
>   holds the stored bytes at `binding_changed` (sticky — roster churn
>   cannot republish). Reproducer `changed_binding_holds_old_notice` now
>   passes; regression-locked in `test_mailgate.py`.
> - **F2** the Python caller now reaches the validated Node adapter with a
>   self-describing binding (mailbox + recipient + citation) and the
>   roster locals parsed from sink.py; proven by the REAL subprocess path
>   (`test_notify_adapter_cli.py`, 4/4) and by Astra's
>   `review-python-mail-adapter.py` returning `{"ok": true}` through this
>   tree.
> - **F3** the drafting stage restores the triage baseline's
>   claim-then-call order: attempts + status + next_attempt commit BEFORE
>   the model call; crashes re-enter with backoff, never re-invoke
>   immediately.
> - **F4** `SpoolLogPublisher` returns the DISTINCT state `spooled` — a
>   local write is durable but is not a relay acknowledgement and is
>   never labelled `acked`.
> - **F5** the cutover runbook stops the RUNNING reader (not just the
>   timer) and carries every triage row across: finished/held →
>   `legacy_pre_cutover` (never re-drafted, never backfilled), in-flight
>   retry/processing → incomplete rows the gate resumes.
> - **F6** room validation requires EXACTLY ONE `d` tag on both the
>   metadata and membership events; historical-address refusal in the
>   outbound seam compares the FULL estate address (skaists@example.org
>   is not ours to refuse).
>
> Updated evidence at this head: python battery 38/38 (sink 4, mailgate
> 12, notify 5, roster 7, outbound 7, bech32 4 — plus adapter-cli 4 via
> the node step), adapter selftest 21 rejection rules, transport CLI 11/11,
> Astra's `review-mail-ledger.py` (333be3f7) **8/8**, their python-adapter
> reviewer `{"ok": true}`, lint-ci-shape 71/71, secret-scan diff+tree
> clean.

> **ADDENDUM 2 — the R2 fix-forward head (3f8101cb + 0b0b58cf).**
> F1, F2 transport-shape, F3, F4, F6 were confirmed closed; the items
> below landed as one ordinary fix-forward commit on
> `zcode/bmailroom-candidate-02` (#141):
>
> - **R2a** the epoch/backfill exclusion now applies ONLY to UNKNOWN mail
>   — the ledger is consulted BEFORE the mtime check, so an imported
>   pending row older than the cutoff resumes (reproducer
>   `imported pending row older than cutoff resumes` passes). The cutover
>   is now CODE: `scripts/buzz-mail/import_from_triage.py` (one-shot,
>   offline, digests+state only) implements the exact queue mapping —
>   claimed-terminal → `legacy_pre_cutover`; claimed-in-flight → pending
>   with attempts/next_attempt PRESERVED; unclaimed pre-boundary bclaude
>   mail → pending DRAFT work, no retroactive notice (the old reader
>   checked budget caps BEFORE claiming, so unclaimed mail exists);
>   other-mailbox pre-boundary mail keeps the no-backfill policy; the
>   boundary is captured before the stop and becomes the gate epoch so
>   interval mail stays eligible; the same-day budget carries; the import
>   is idempotent. Synthetic proof `test_import_from_triage.py` (4/4)
>   covers all five laws + the addendum fixture.
> - **R2b** per-recipient channel routing: a native DM room carries only
>   the signer and ONE recipient, so the transport is now a protected,
>   explicit per-recipient descriptor map (`RoutedTransport`), selected
>   only AFTER a verified roster binding; an unknown or mismatched
>   destination parks at the durable `destination_unconfigured` hold.
>   Proven through the REAL Python→Node adapter with two distinct
>   recipients and separately relay-signed synthetic DMs (each event's
>   `h` is its own room; a deliberately swapped room is refused by the
>   membership check).
> - **Windows portability:** the adapter child env keeps the minimal
>   key-only set plus PATH and adds `SystemRoot` ONLY on Windows (Node's
>   CSPRNG needs it); the node executable is an explicit parameter.
> - **False claim deleted** (not softened): `store.py`'s header now
>   describes the real private at-rest state — digests/status/pointers
>   AND the drafting stage's model result JSON in `mail.result` (the
>   ported baseline's own shape); raw bytes never enter the db.
>
> Evidence at this head: python battery 47/47 (sink 4 + mailgate 12 +
> notify 5 + roster 7 + outbound 7 + bech32 4 + importer 4 + adapter-cli 4
> via the node step), adapter selftest 21 rejection rules, transport CLI
> 11/11, Astra's `review-mail-ledger.py` **8/8** AND their
> `review-mail-cutover.py` **2/2** (`imported pending row older than
> cutoff resumes` + `hard crash respects persisted backoff and
> three-attempt cap`), their python-adapter reviewer `{"ok": true}`,
> lint-ci-shape 71/71, secret-scan diff+tree clean.



**STATE** · Candidate complete on branch `zcode/bmailroom-candidate-01`, cut
from `origin/main` @ `d7b9b2c6`. Nothing merged, nothing deployed, no key
provisioned, no mailbox created, no external mail, no profile edit (Astra's
profile patch d65c65b2 is queued for a separate dependent PR after this one
is reviewed). This dispatch rides the same commit as the code.

**CLAIM** · The bMAILroom backend candidate is built and gated:
1. **Multi-RCPT fix** (`sink.py`): the `if not envelope.rcpt_tos` guard
   recorded only the FIRST recipient — every later RCPT TO got a 250 with no
   delivery. Fix = record every accepted recipient exactly once (dedup
   included). Red-first receipt: stashing ONLY this fix at `d7b9b2c6` bytes
   made `test_sink_multircpt.py` exit 1 with exactly
   `AssertionError: 0 != 1 : bzcode delivery missing (multi-RCPT defect)`
   (+ the 3-recipient case), restoring the fix went green (4/4).
2. **Single-reader ledger** (`mailgate.py` + `store.py`, ported by
   composition from the hash-verified triage baseline `d9ff30d6`): one
   process reads all rostered Maildirs with the baseline's controls
   (bounded 256 KiB read, O_NOFOLLOW, regular-file check, sensitive-hold,
   sqlite + flock, claim-before-side-effect). Dedupe keys on
   **(mailbox, digest)** — the same content to two recipients is two rows
   and two notifications (the digest-only keying defect, corrected
   mid-build per 1e18cbf8 #1). Crash law: rows commit BEFORE effects;
   incomplete rows (`notify='none'`, `uncertain`, holds) are RE-ENTERED by
   later passes and completed — never re-signed (the outbox carries
   UNIQUE(mailbox, digest); retries republish the stored bytes verbatim).
   After every retry sweep, mail rows are RECONCILED with outbox truth.
   Notification state and drafting state are independent: an acked notice
   never suppresses a budget-deferred draft.
3. **Opaque notification, DISABLED seam** (`notify.py`,
   `notify-transport.mjs`): the payload is a fixed whitelist — v, type,
   mailbox, msg_sha256, size, state, notified_utc — nothing from any
   header/subject/body can enter (asserted in tests with planted OTP
   markers). The notice targets the NATIVE Buzz private-room shape
   (source-resolved by Astra: buzz-sdk `build_message` kind 9, `h` =
   channel UUID, plaintext reference-only content): typed builder, kind
   fixed at 9, no caller kind, no encryption switch. The room must be
   proven by SIGNATURE-VERIFIED metadata (kind 39000 + 39002 events,
   pubkey pinned to the expected relay signer, `d` = channel UUID,
   private AND hidden AND `t=dm` from tags; contradictory `[public]`,
   duplicate/ambiguous flags, and JSON-only privacy claims are refused).
   The mailbox binding must be self-describing (mailbox + recipient) with
   a `verified:` citation; an npub without one HOLDS at binding_unverified.
   ALL cryptography lives in pinned nostr-tools 2.25.2 (the repo's
   existing pin in tools/connect-store) — the homemade bmcrypto.py was
   DELETED whole per the false-signal law (steer 83a2a264), not labelled.
   NO service key exists in this candidate: the adapter refuses without
   `BUZZ_MAILGATE_KEY`, room creation (41010) and publishing stay
   activation-time founder gestures, and mailgate parks every row at
   `signer_unprovisioned` until then. Synthetic fixtures only.
4. **Draft-only outbound seam** (`outbound.py`): composes and stores drafts
   (0600 .eml under state/drafts, pointer + subject-hash rows, no content
   in the db); unknown senders, malformed and historical/not-provisioned
   recipients refused; ambiguous recipients HELD at held_reconciliation
   with no bytes written; `send_draft()` is a permanent policy refusal; no
   SMTP client anywhere in the package (source-scanned by test).
5. **Roster** (`roster.json` + `roster.py`): sink.py's KNOWN is the single
   source, parsed from sink's own bytes at load — drift fails loud both
   directions. Bindings ship ALL unverified (the bzcode channel-membership
   claim was withdrawn per 1e18cbf8 #2 — membership proves a Buzz key, not
   mailbox authority; no assignment receipt exists). Historical
   skaists@/z2.1@ entries are marked not-provisioned, never routable.
   npubs ride as bech32 (`bech32id.py`, encoding only, canonical NIP-19
   vectors cross-pinned against nostr-tools itself).

**EVIDENCE** ·
- `test_sink_multircpt.py` — 4/4 GREEN locally (WSL python 3.14); red-first
  receipt above; unknown/historical addresses still 550-refused; duplicate
  RCPT delivered once.
- `test_mailgate.py` — 11/11 GREEN: two-recipients-two-rows (negative
  control), dedupe across rescan AND restart, sensitive-hold-notified-as-
  held (OTP marker absent from payload), crash A (insert→resume without
  loss), crash B (signed bytes stored, failed publish → uncertain →
  same-bytes retry, no re-sign), epoch cutoff, npub-without-citation hold,
  disabled-seam durable hold, hold-then-verified-binding completion,
  uncertain-restart reconciliation on the mail row, acked-notice-never-
  suppresses-deferred-draft.
- `test_notify.py` — 5/5 GREEN: payload whitelist opacity, unverified-
  binding hold, signer-unprovisioned hold, bytes-committed-before-publish
  ordering + retry-reuses-bytes across a fresh notifier (restart),
  DisabledTransport named refusal.
- `test_roster.py` — 7/7 GREEN; `test_outbound.py` — 7/7 GREEN;
  `test_bech32id.py` — 4/4 GREEN (canonical vectors + checksum tamper).
- `notify-transport.mjs --selftest` — GREEN: native kind-9 build+sign+verify
  against REALLY-SIGNED fixture room metadata (ephemeral relay key);
  **21 rejection rules bite**, including the two Astra probe (bfad123f)
  regressions (forged/unsigned metadata; off-schema body value) and the
  6689f0e1 strict-DM lattice (json-only privacy, contradictory public,
  duplicate flags, non-dm type, impossible timestamp dates). Rejected
  input is never echoed in error text.
- `test_notify_transport.mjs` — 11/11 PASS: real CLI subprocess path with
  an ephemeral env-only key (never argv/stdin/disk), h-tag/p-tag/kind
  shape, verify without the nostr-tools cache bit, no-key exit 3, policy
  rejections exit 5, both probe regressions.
- Astra's independent scan-level instrument
  (`review-mail-ledger.py` against this tree): **7/7 PASS**
  (two_recipients, uncertain_restart, hold_then_binding, crash_after_insert,
  crash_after_event, budget_deferred_draft, sensitive_stays_local).
- `scripts/lint-ci-shape.mjs` 71/71 (two new CI steps carry `if:always()`);
  `scripts/secret-scan.sh tree` exit 0 (diff mode re-run post-staging).
- WSL is the proof host for the python half (Windows host has no python);
  CI (ubuntu-latest) runs the whole battery on every push via two new
  steps wired into the `static` job.

**BOUNDARY NOT CROSSED** · No merge, no deploy, no box change (the systemd
examples live under `scripts/buzz-mail/examples/`, marked inactive, with
the single-reader cutover runbook — `ops/` stays verbatim box truth per
1e18cbf8 #3). No mailbox, no registry claim, no relay publish, no external
mail, no key material (fixtures are programmatic bytes or ephemeral
in-memory keys). bUi's duplicate implementation stays parked. The profile
slice is NOT in this PR.

**CHANGED** · Branch `zcode/bmailroom-candidate-01`: sink.py (2-line fix);
new scripts/buzz-mail/{mailgate,notify,outbound,roster,store,bech32id}.py,
roster.json, notify-transport.mjs, package.json + committed
package-lock.json (nostr-tools 2.25.2 — the repo's existing pin), six
python test files, test_notify_transport.mjs, examples/ (2 unit examples +
cutover runbook); .github/workflows/tests.yml (2 CI steps); this dispatch.

**NEXT OWNER** · bFUzZ — independent review of THIS backend candidate
(coordinator routing; Astra remains reviewer for the frontend patch).
Suggested reproduction: WSL
`for t in scripts/buzz-mail/test_*.py; do python3 $t; done` plus
`node scripts/buzz-mail/notify-transport.mjs --selftest` and
`node scripts/buzz-mail/test_notify_transport.mjs` after
`npm ci --ignore-scripts --prefix scripts/buzz-mail`.

**FOUNDER ACTION** · None required for this review round. Activation of the
native transport (service key + relay-signed room + verified bindings) and
any deploy remain founder-gated gestures on top of a green review.
