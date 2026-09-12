# z1.d — Royal Review vertical slice: experimental record, local validation, Nostr twin, two-rail publish semantics

2026-09-12 · z1.d (zCode GLM 5.3, fresh contract+implementation session) · order 4 of the
[2026-09-12 zCode takeover docket](https://github.com/beehive-nature/beehive-nature/blob/e3373634/docs/dispatches/2026-09-12-zcode-takeover.md),
filed against issue #10. Astra leads scope, review, integration.

| | |
|---|---|
| Session/effort | Max for contract/auth design, Medium for implementation (as ordered) |
| Fetched base | `8d42da28` (origin/main at claim; the shared checkout at `C:\Users\travi\beehive-nature` was 85 commits STALE — worked from a fresh worktree `wt-z1d-royal-review`, branch `z1d/royal-review-2026-09-12`) |
| Owned paths | `crates/royalreview/**` (new), `dockets/lexicon/com.beehivenature.temp.royalReview.json` (new), one workspace-members line in root `Cargo.toml`, `Cargo.lock` (regenerated), this dispatch |
| NOT touched | Watch/3Speak, shared UI (`surfaces/`, register.js/tour.js/lang.js), `crates/atmirror` (reused as-is, zero edits), the receipt Lexicon (`com.beehivenature.receipt.json` byte-identical), estate.json, any PDS/relay/domain/deployment |
| Boundary kept | No public posting, no PDS/AppView deployment, no domain change, no campaign launch, no merge, no deploy. Every network boundary is a trait; the suite runs with zero sockets. |

## 1 · Week-1 draft recovery — verdict: DOES NOT EXIST as a recoverable artifact

The takeover docket asked to "recover Grok/Chief's actual Week-1 draft if available" and already
flagged that a bounded scan had not found it. This session searched harder before building:

- All four remote Grok branches (`grok/bnrose-social-slice-2026-09-07`, `grok/genesis-campaign-pack-2026-09-07`,
  `grok/kandi-gift-reliable-2026-09-07`, `codex/grok-choose-click-review-2026-09-07`, `codex/grok-value-docket-2026-09-07`)
  — every Bluesky/atproto hit is the INHERITED corpus (`crates/atmirror`, `crates/sense-atproto`,
  `dockets/SPEC_LEXICON-1.md`, `dockets/lexicon/*`), no Week-1 plan among them.
- All three Grok worktrees on disk (`wt-grok-bloom-pack`, `wt-grok-campaign-pack`, `wt-grok-social-slice`),
  including their untracked files and diffs vs main — campaign/creative material only
  (festival brief, genesis board, claim-27 docs); no Bluesky Week-1 draft.
- `docs/dispatches/` (both the stale checkout and the fresh base) for "week-1"/"royal review" — nothing;
  the one stash is an unrelated restore.

**Conclusion (recorded, not assumed):** the founder's pasted "Week-1" summary is direction, not a
recoverable draft. The best available Bluesky PLAN is the committed eco-adaptor-sweep §2
(`docs/dispatches/2026-09-12-eco-adaptor-sweep.md` @ `8d42da28`, the "ADOPT — one PDS + funnel
mirror, then feed generator" recommendation), which this slice sits UNDER: it implements the
docket's "first candidate" (a locally validated experimental Review record) rather than any
deployment step.

## 2 · Primary-documentation verification (read this session, cited)

| Assumption (from SPEC_LEXICON-1 / eco-sweep) | Current primary doc | Verdict |
|---|---|---|
| §9: "Experimental iterations… carry a `.temp.` segment until stable" | The [NSID spec](https://atproto.com/specs/nsid) has NO `.temp.` rule; the convention lives in the non-normative [Lexicon Style Guide](https://atproto.com/guides/lexicon-style-guide) ("Experimental schemas… can use variant NSIDs (eg, including .temp.…)"), and the reference implementation itself ships `com.atproto.temp.*` | **Stale-but-safe**: `.temp.` is style-guide-blessed practice, not spec law. Our NSID uses it; note also it implies control of `temp.beehivenature.com`, which the domain holder has automatically |
| A3: custom-NSID records accepted by "a stock PDS… without allow-listing" | The [Lexicon spec](https://atproto.com/specs/lexicon) now defines THREE record-validation modes: `validate=true` (fail-closed on unknown lexicon), `validate=false` (no validation), and default optimistic (validate-if-known, allow-unknown), with the response flagging which ran | **Needs nuance**: optimistic default still allows it, but a PDS may be configured fail-closed; the eventual publish call must set `validate` deliberately and read the response flag |
| strongRef = uri (at-uri) + cid | [strongRef lexicon](https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/repo/strongRef.json) | **Confirmed unchanged** — atmirror's `StrongRef` reused verbatim |
| Datetime: uppercase T, timezone required, ≤3 fractional digits, Z preferred | [Lexicon spec](https://atproto.com/specs/lexicon) datetime section (RFC 3339 ∩ ISO 8601) | **Confirmed**; leap-second 60 dropped at the intersection — our validator refuses it |
| TID record keys: 13-char base32-sortable | [TID spec](https://atproto.com/specs/tid): alphabet `234567abcdefghijklmnopqrstuvwxyz` (0/1/8/9 excluded) | **Implemented** (13 chars + alphabet). A first-character sub-range restriction beyond the alphabet is NOT enforced — UNVERIFIED which exact range the current spec/reference pins, so the validator stays at charset+length and the gap is ledgered here |
| Lexicon resolution via `_lexicon.<authority>` DNS TXT, non-hierarchical | [Lexicon spec](https://atproto.com/specs/lexicon) | **Confirmed still current** (matters for the eventual schema publication, not this slice) |

## 3 · What was built (the vertical slice)

**Contract candidate** — `dockets/lexicon/com.beehivenature.temp.royalReview.json`: an
EXPERIMENTAL record (`key: "tid"`) binding author (did) + subject (strongRef) + verdict
(`sound | sound-with-notes | unsound | unverified`, aligned with the crypto-language law) +
**storageRefs** (explicit storage references, sha256 REQUIRED — a review asserts verified bytes;
stricter than the receipt's mediaPointer, and the JSON says why) + optional `receipt` strongRef
to a validated receipt + createdAt (atproto datetime). One storage vocabulary (`ar`/`ant`)
shared with the receipt lexicon — no second source of truth.

**`crates/royalreview`** (new, ~1.1k lines with tests):

- `record` — the Review type, lexicon-exact serialization (camelCase, `$type`).
- `validate` — deterministic local validation. Refusals NAME the field and constraint.
  Includes the **fail-closed receipt cross-validation**: a receipt strongRef present without
  the fetched receipt record ⇒ refusal; with it, the reference must match the record's
  coordinates exactly, the collection must be `com.beehivenature.receipt`, and the record must
  parse and satisfy §5's binding law — **reusing `atmirror::receipt::Receipt` and its
  `binding_ok()`**, not a second parser. CID syntax reuses `atmirror::cid::Cid::parse_str`.
- `twin` — the Nostr twin: kind **30078** (NIP-78 app data; parameterized-replaceable per
  NIP-01 ⇒ structural duplicate prevention), d-tag = the client-minted TID (the identity shared
  by both rails), content = the canonical record JSON, created_at derived from the review (no
  ambient clock ⇒ same inputs mint the same event id, proven by test). The event id is
  computed LOCALLY (sha256 over the canonical `[0,pubkey,created_at,kind,tags,content]`).
- `orchestrator` — two-rail publication. Owned rail (Nostr) first, atproto mirror second and
  **not attempted while the owned rail is down** (mirror-by-law). Per-rail outcomes
  `Published/Already/Conflict/Failed/NotAttempted`; `TwinReport::both_published()` is derived
  structurally from the two outcomes and `summary()` names every non-landed rail —
  **there is no code path that reports both-successful when one failed** (property-tested
  across the outcome grid). Idempotency is two-layered like atmirror's State: ledgered state
  short-circuits after a confirming probe, and probe-before-write recovers the crash window
  between a landed write and the state save — including the lost-RESPONSE case (write landed,
  answer never arrived), which is tested on both rails. Same-rkey-different-content is
  `Conflict`/hard refusal — never an overwrite, on either rail.
- `fixtures` — in-memory sinks with explicit failure injection (fail-next, lose-response-after-store),
  the same standing as `atmirror::rail::testrail` (test support, never a production rail).

**Honest asymmetry (documented in the crate header, not hidden):** the Nostr event id is
computed and cross-checked locally; the atproto record CID is sink-reported and recorded
**UNVERIFIED-locally**, because atmirror ships a DAG-CBOR decoder but no generic encoder and a
wrong locally-computed CID would be worse than an honest UNVERIFIED. Atproto duplicate
detection uses record-value equality instead, which needs no CID computation.

## 4 · Tests (33, all deterministic, zero network)

`cargo test -p royalreview` — 14 unit + 11 orchestration + 8 validation-matrix, all passing
(`test result: ok` × 3 suites + doctests). The docket's named cases:

- **Partial success**: nostr lands / atproto fails → `PARTIAL` summary, `both_published()==false`;
  retry → nostr `Already` (still exactly ONE nostr write), atproto `Published`, now both-ok.
- **Retry without duplicate**: fresh, after-success, after-partial, and after LOST RESPONSES on
  each rail — every shape ends with exactly one real write per rail.
- **Duplicate prevention**: state short-circuit + probe recovery + kind-30078/d-tag
  replaceability + at-uri rkey identity; conflicting content under a taken rkey refused.
- **Never both-ok**: the outcome-grid property test asserts the flag and the summary agree with
  the truth for every reachable outcome pair.
- **Invalid inputs**: field-by-field corruption matrix, each refusal naming its field;
  fail-closed receipt paths (blind reference, coordinate mismatch, binding-law violation,
  wrong collection); deterministic datetime garbage (lowercase t/z, missing tz, 4-digit
  fraction, month 13, Feb 29 non-leap, leap second 60, pre-1970).

## 5 · Implemented vs remaining work (explicit, per the docket)

**Implemented:** contract JSON, record types, full local validation incl. receipt
cross-validation, twin event with locally computed id, two-rail orchestrator with
partial/retry/duplicate semantics, in-memory fixtures, 33-test suite.

**Remaining (in dependency order, none started):**

1. **Nostr signing + relay write** — BIP-340 schnorr signatures and a real `NostrSink` against
   the buzz relay (NIP-42 auth + canonical-origin signing law). Keys env-delivered, never
   printed — and never in URLs/exports/logs (the docket's token law, applied to nsecs too).
2. **Deliberate user publication via browser OAuth** — atproto OAuth client (PAR + DPoP), with
   denied/cancelled auth, expired sessions (the `SinkError::ExpiredSession` shape already
   exists for it), duplicate/retry and failed-write cases. User-initiated publish to a NAMED
   destination only; test fixtures still prove nothing about public delivery.
3. **Atproto CID verification** — either a vetted DAG-CBOR encoder for a local expected-CID, or
   a post-write getRecord round-trip check; closes the documented asymmetry.
4. **TID first-character range** — pin the exact current spec/reference restriction and tighten
   `validate_tid` (or strike the gap as moot).
5. **NSID promotion decision (Astra/founder)** — `.temp.` → stable `com.beehivenature.*` name
   (or drop), plus schema-publication ritual (`_lexicon` DNS TXT, §9 of SPEC_LEXICON-1) — only
   after the OAuth slice exists and Astra accepts the contract.
6. **Comment grapheme bound** — `maxGraphemes` needs a unicode-segmentation dependency
   (currently absent from the lock); maxLength-only for now, documented in the artifact.

**Coordination asked of Astra:** the verdict vocabulary (`#verdict` knownValues) and the
storageRef-sha256-required stance are contract decisions this seat made defensibly — flag
disagreements before the OAuth slice freezes them. No Royal Review UI or shared-corpus changes
were made from this seat.

## 6 · Reproduce

```bash
cd wt-z1d-royal-review
cargo test -p royalreview        # 33 tests, zero network
cargo fmt --all --check          # clean
cargo build --locked -p royalreview
```
