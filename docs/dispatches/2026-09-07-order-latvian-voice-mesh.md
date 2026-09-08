# Sprint order — Latvian voice on bMesh, recognition first

**Recipient:** Claude Code (Seat 3), `bclaude@agents.skaists.buzz`.
**Status:** prepared from the founder's supplied conversation and the existing repo;
execution is not claimed. Goal 1 of the two-goal sprint.

## Start from what exists

Fetch current main, inspect active work, and use an isolated worktree. The founder named
branch `latvian-voice-mesh`; use that name if available, or inspect/continue the existing
branch without resetting another seat's work.

Read [the existing voice receipt](2026-09-04-buzz-voice-lv.md),
[the service runbook](../../ops/voice-scribe/README.md) and
[the blind sense-check receipt](../receipts/RECEIPT_ROUNDTRIP_SENSE_2026-08-26.md).
The September 4 record already describes a real Latvian room transcript, forced language,
raw-audio cleanup, and large-v3-turbo q5_0 on four ARM cores. Its 11/11 UI pass and one
15.5-second clip are **not** a held-out WER measurement or a blind semantic acceptance.
Re-read the current Buzz fork/PR before extending it; those old commit/PR statuses are
historical receipts, not assertions of present deployment.

## Outcome and work

1. **Recognition is the priority.** A stranger speaks Latvian in a Buzz room and the
   resulting text preserves what was said. Model selection is the implementing seat's
   reversible decision, based on measured Latvian performance on the available mesh
   hardware. Compare the existing quantized turbo baseline against feasible alternatives
   including large-v3. A candidate list is not a claim of strongest WER in the world.
2. **Separate selection from acceptance.** Use a documented development set for tuning
   and an independent held-out set with reference transcripts for acceptance. Publish
   provenance, speaker/clip counts, normalization, WER `(S+D+I)/N`, errors, latency and
   peak memory for the chosen build and hardware. Do not tune on the held-out answers.
3. **Check the exact artifacts' terms before serving them.** Code, weights, quantization
   source, codecs and voices are separate entries. On 2026-09-07 the first-party
   [MMS ASR](https://huggingface.co/facebook/mms-1b-all) and
   [MMS Latvian TTS](https://huggingface.co/facebook/mms-tts-lav) cards label those weights
   CC-BY-NC-4.0. Language support alone does not establish permission for metered use;
   do not serve them commercially absent an applicable grant. Re-check exact revisions
   when implementing. The attached OmniVoice picture is not a new license verification.
4. **Serve ASR as a mesh resource: audio in, text out.** Compute and memory are supplied
   through BNR's mesh/resource interface, without a hosted speech API. Reuse the existing
   service where appropriate; merely renaming a VPS endpoint does not demonstrate mesh
   provisioning. Preserve authenticated requests and canonical-origin signing.
5. **Meter by seconds of accepted audio.** Derive duration from decoded media, not a
   caller's number. Tie the job, resource receipt, rate and settlement to the existing
   meter. Specify rounding, retry idempotency, failed-job charging and the spending
   ceiling; do not silently charge again for a retried request. Use existing economic
   primitives rather than inventing a second credit ledger.
6. **Provide Latvian TTS through the same resource boundary.** Preserve an already good
   voice if its artifacts and terms are established. Record the chosen meter unit and
   rate, include codec/voice provenance, and demonstrate text-to-audio on the mesh.
   Do not turn the speech-output lane into unrelated voice cloning work.
7. **Make language a shared room default.** It is available through the common Buzz
   room path for any speaker; do not add an administrator's per-room opt-in toggle.
   Existing join-material discovery still needs an honest unavailable state when a
   provider cannot fulfill the request. Avoid claiming every room was tested from one
   custom demonstration room.
8. **Refuse the unavailable language explicitly.** Pin Latvian for Latvian requests.
   Return a named, visible error when the model/resource is absent or unusable; never
   silently substitute English recognition. Test missing model, unsupported language,
   exhausted budget and provider outage. A refused voice job leaves other room activity
   usable and does not pretend to have produced a transcript.
9. **Tongue order: lv → th → ru → uk, Latvian first.** The pasted order stopped after
   “TONGUE ORDER”; this ordering is recovered from the September 4 dispatch and service
   README. This does not invent additional missing wording. Later tongues use the same
   adapter; the Latvian acceptance remains the first showcase gate.

## Acceptance that counts

Run the blind round-trip sense check on the held-out ASR output. A qualified Latvian
reader receives **only the transcript**, no audio, reference transcript or expected
meaning, and reports what it says. A separate comparison checks that reading against
the independently established source meaning. Name changed people, objects, actions,
numbers, negations and omitted meaning; separate those from style/register differences.
Report clips checked, wrong-sense count and clip IDs, plus WER and resource measurements.
For the showcase acceptance set, any changed-meaning clip remains an unresolved failure;
do not turn a favorable average or fluent TTS into an ASR pass. Absence of a qualified
blind reader is missing acceptance evidence, not permission to mark a pass.

## Provisioning, privacy and delivery

Reuse authorized mesh capacity; report CPU/RAM/storage needs and measured headroom before
claiming a model fits. No new vendor subscription or cloud-rule change is implied.
Follow current [AGENTS.md](../../AGENTS.md) for box access and keep any deployed `ops/`
files and the tree aligned. The quoted handoff says a “provisioning law” was attached,
but its complete text was not supplied or located; the preceding requirements are
implementation constraints derived from the founder's mesh-only order, not a fabricated
verbatim law.

Use the member's room privacy settings and authorized request path. Delete temporary
audio after success, timeout, cancellation and failure; verify cleanup. Do not place
raw speech or private transcripts in public billing/diagnostic receipts. Public test
evidence must use appropriately permitted material. Voice is not a credential.

Commit the measured model choice, WER and blind wrong-sense count, exact pins, changes,
checks and remaining failures. Include a reproducible test manifest and a dated dispatch.
Push the isolated branch and link the result. This order prepares the sprint; it does
not claim that any of these missing acceptance checks have already run.
