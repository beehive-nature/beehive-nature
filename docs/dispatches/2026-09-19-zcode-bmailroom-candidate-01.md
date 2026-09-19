# bMAILroom candidate 01 — backend (writer seat zCode, start order d003de1f relayed by the coordinator for LoVis waTer; scope change 26d9d346: backend only)

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
