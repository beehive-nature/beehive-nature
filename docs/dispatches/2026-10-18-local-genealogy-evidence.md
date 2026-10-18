# Skaists genealogy: restore the local evidence application

## Decision and implementation state

The founder's 2026-10-18 correction is the product requirement: a permanent
map to FamilySearch servers is insufficient. Skaists must retain and read
the evidence itself and scale through local storage and optional distributed
replication. The local working archive is primary. A public publication
projection cannot replace it.

This dispatch accompanies an implementation candidate prepared and tested by
Astra. It does not claim a merged commit, a desktop installation, a production
Autonomi upload, or a complete native evidence-store integration. Initial
inspection used `06f523c0bfd7a7203b55f38e2c99c0abe871f998`; the combined patch
also passes `git apply --check` against the relevant files from
`82f81b14ce1da5c4aaac2c8269d67a47f9f1a1da`.

## What the audit found

The local foundations remain in the repository. `tools/genealogy/model.mjs`
provides `skaists.lineage/2`; `gedcom.mjs` and `pipeline.mjs` provide local
import/export; `identity.mjs` preserves internal identities and provider
references. `preserve.mjs` and `preservation-runtime.json` preserve and restore
the interactive UI and its dependencies. These should be reused.

Two missing connections create the current dependence on provider links:

1. `person-panel-corpus.mjs` projects the provider person-tree URL into its
   record layer. Its loader does not read the retained source index or source
   records. The person panel therefore offers a provider reference instead of
   displaying the already-held documentary source material.
2. `preserve.mjs` prepares a public edition. `publicSourceRecords()` removes
   transcription values, and that edition includes image summaries rather
   than the private image files. Those are publication boundaries; they are
   unsuitable as the retention policy for the local working archive.

The original implementation is documented by commits `d8307f43`, `364e10f0`,
`42bfbd4` and `b82410d`; October's `e4b497b` expanded the offline runtime
dependencies. No reviewed history supports claiming that every local
component was deleted. The correction restores the missing product path.

## What this candidate changes

### A separate local working edition

`node tools/genealogy/preserve.mjs prepare-local <fresh-output> [local-input.json]`
creates `skaists.preservation-local/1`. It retains the frozen source values
and adds a separately declared local evidence directory. It needs no quote,
spending ceiling, signer, wallet, or remote storage service. Its optional
replication status contains no fabricated quote or completed upload.

Preparation uses a fresh sibling directory and renames only after success.
An invalid digest or identity crosswalk leaves no partial output blocking a
retry. Verification and restore hash files with a fixed buffer. Restore
validates before writing and checks copied bytes again, with private directory
and file modes on platforms supporting POSIX modes. Existing output is not
overwritten. Windows ACL behavior requires the implementation lane's host
verification; POSIX modes are not an ACL claim.

The existing public `prepare` operation remains separate and still projects
source values as before. Public preparation strips local reader activation.
Public approval and the public eternalization tar builder refuse the local
working schema. These restrictions apply to publication, never local reading.

### Per-person evidence and retained page bytes

`local-evidence-build.mjs` builds a manifest and bounded source shards keyed
by existing internal person IDs. Provider references are used once to
reconcile historical input keys, not as live identity dependencies. Missing,
ambiguous or explicitly contradictory crosswalks refuse association. The
builder never mints people or mutates frozen input files.

The local input format is `skaists.local-evidence-input/1` with `artifacts[]`
and an optional existing source-contract store. Each artifact names an
explicit source ID, a local file, its declared SHA-256, media type, and any
locator or acquisition note. Bytes are copied with a fixed buffer and checked
against the declared digest. One digest object can serve multiple citations.
URLs and explicit Windows network shares are refused as local file inputs.

The existing `skaists.source/1`, `skaists.claim/1` and
`skaists.source-binding/1` contract supplies independent documentary evidence.
Supporting, contradicting and mentioning bindings remain distinct. Unbound
sources and leads remain retained without entering a person's evidence list.
A local source cannot borrow an imported source ID to acquire its associations.
An ARK, source-record key and image digest are different identifiers; image
associations are never guessed from neighboring rows or similar names.

`local-evidence.mjs` loads the selected person's shard on demand. It checks
actual byte length and digest before displaying it. Opening a retained page
checks its bytes again before creating a local object URL. Citations are
rendered as inert text, and assertions, relationships, locators, quotations
and conflict notes are readable without interpreting schema JSON. Navigating
away releases the object URL. A checksum verifies a copy; it does not settle
historical accuracy, identity, rights or independent corroboration.

The person panel is activated only in a local package copy of `blood.html`.
The normal public page and its treatment of living stubs remain intact.
There is no provider fallback when a local file is missing or corrupt. A
FamilySearch link remains optional provenance navigation.

### Local file custody is independent of remote payment shape

The existing bData shelf already stores actual bytes: IndexedDB Blobs in the
browser and independently hashed files plus an atomic registry in disk intake.
The candidate removes the Autonomi payment batch size as the local intake
limit. Disk intake defaults to 1 GiB per file, configurable through
`BDATA_INTAKE_MAX_BYTES`; malformed limits refuse startup. The browser has a
separate 512 MiB resource limit. Completion describes a kept local copy and
optional replication, without directing every local save into payment.

The remote payment limit remains 247,222,272 bytes. The existing AntPay and
Rust merkle-finalization refusals remain unchanged.

## Verification actually completed

| Check | Result |
|---|---|
| Local evidence builder | 8/8 pass |
| Preservation and restore, including existing public regressions | 22/22 pass |
| Local evidence reader | 6/6 pass |
| Local disk intake and unchanged payment refusal | 3/3 pass |
| Person-panel DOM component acceptance | pass; local-only injected transport |
| Actual frozen corpus through builder and reader | 809 people, 13,249 unique records, 13,589 associations, 49,342 unique evidence fields |
| Historical identity crosswalk | 503 direct IDs + 306 unique recorded provider crosswalks; no unmatched or ambiguous row |
| Actual independent page bytes | NEHGR 1874, pp. 210–211, retained and digest-checked locally |
| Source preservation | input hashes unchanged; assertions and date conflict unchanged |
| Latest relevant file baseline | combined patch applies cleanly at `82f81b14` |

The actual corpus test read every person shard with an injected filesystem
transport: 813 local reads and zero external requests, including the manifest,
a repeated person selection, and two page images. It checked each imported
citation and evidence array against its frozen input. The largest person
shard is 139,482 bytes and the manifest is 113,043 bytes. The graph itself has
11,041 persons at the inspected revision; it is distinct from the 809-person
source-evidence cohort and the historical 10,259-person graph count.

The independent Rockwood obituary is retained as a separate local source
mentioning Luther Rockwood, with its own page bytes and locator. It is not
represented as an image of the town register or the FamilySearch record.
The frozen 3 October 1872 citation and the obituary's 11 October date remain
in conflict. No relationship or date was silently corrected.

The intake regression streamed 247,222,273 actual bytes from a 64 KiB buffer,
restarted the local service, rehashed the stored file, and checked duplicate
recovery. The old implementation fails the same regression with HTTP 413.
The unchanged payer refuses the merkle plan with zero network, signer and
confirmation calls.

Chromium is absent in this environment. The person-panel check used LinkeDOM;
it is component acceptance, not browser rendering. The bData browser E2E was
extended but remains unrun here. Execute it on the implementation lane's
existing browser runner. No claim of full desktop qualification is made.

The local test runner initially returned sandbox EPERM for subprocess pipes;
those were environment failures, not accepted passes. The preservation tests
were then run with the permitted subprocess support and completed 22/22.

## Scalable Skaists architecture

The current patch is an immediately usable bridge into the surviving app.
The scalable native store should use existing Rust components rather than
turning the compatibility JSON package into a server database.

| Responsibility | Existing seam and required extension |
|---|---|
| Canonical people and assertions | Preserve internal IDs and the source/claim/binding contract. New genuinely local identities must have a provider-neutral minting path; do not reissue existing IDs. |
| Local searchable index | `crates/adapter-store` supplies `EmbeddedStore`: atomic batches, get, prefix scans, integrity and compaction, with embedded SQLite/SurrealKV. Add bounded iteration; current prefix scans return a whole Vec. |
| Immutable page and document bytes | Reuse the digest shelf. Read a registered object by digest through native IPC or a scoped local capability; do not add an unauthenticated arbitrary-path HTTP reader. |
| Portable archive batches | Reuse `crates/bnr-archive` formats and verification. Its current builder reads whole files and retains all batches in memory; extend to a streaming writer/iterator before large archive qualification. |
| Distributed discovery and transfer | Optional x0x/b-index coordination and bounded transfer of requested objects. Peer outages must not disable locally retained evidence. A genealogy transport over these components is not implemented by this patch. |
| Durable replication | Optional Autonomi copies of selected objects and manifest roots, with exact-byte retrieval verification and bounded economics. `adapter-autonomi` is telemetry, not an implemented evidence put/get client; reuse the actual `tools/antd-bridge` boundary. |
| Public edition | Project the local archive under the conditions of each exact representation. A restriction on one acquisition or edition is not an architectural requirement to keep all underlying records on FamilySearch. |

Scale by content and working set: deduplicate identical page bytes across
citations, shard indexes and manifests, load only the selected people/pages,
and transfer changed objects rather than whole trees. Keep restore and
replication queues bounded. Publish a versioned root for a selected edition,
not a separate paid registration for every person or a single global hot
manifest that every contributor rewrites. Preserve concurrent assertions and
their provenance; there is no global last-writer-wins genealogy truth.

The present browser bounds are explicit: 1 MiB manifest, 4 MiB person shard,
64 MiB page viewer, 16 cached people, four concurrent reads and a 15-second
read timeout. Larger evidence may be retained but this viewer refuses it;
native streaming/viewer integration remains engineering work. This is
qualification at the measured corpus size, not a billion-record performance
claim or proof of indefinite network retention.

## Direct implementation disposition

The authorized genealogy owner applies this candidate in its own worktree,
using the existing hooks, identity rules and normal CI/landing path. Complete
the browser acceptance and local-machine restore against the resulting commit.
Bring the 314 already-held Windows image files into the vault through their
actual paths and explicit source associations; that import was not performed
from this environment. Reuse the banked acquisition and continue independent
custodian-source work. The FamilySearch automated sweep stays stopped.

The decisive host acceptance is to disconnect external services, restart,
search and traverse the graph, read retained transcriptions, open exact page
bytes, preserve conflicts, and export/restore. Reconnect only to synchronize
selected changes. Local use must remain complete while any remote publication
operation is unavailable.

Do not ask the founder to relay this patch, acknowledge these receipts,
reapprove the local restoration, or supply a key to make local evidence work.
Continue the authorized implementation and report its real result. A specific
unavailable capability blocks only its specific operation.

## Primary code references

- [Original local tooling](https://github.com/beehive-nature/beehive-nature/commit/364e10f07ffd17e92698f099f265b5dd3ab7ad48)
- [Current person projection](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/surfaces/person-panel-corpus.mjs)
- [Current public preservation](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/tools/genealogy/preserve.mjs)
- [Source/claim/binding contract](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/tools/genealogy/source-contract.mjs)
- [Embedded store](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/crates/adapter-store/src/lib.rs)
- [Archive batch builder](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/crates/bnr-archive/src/batch.rs)
- [Autonomi telemetry adapter](https://github.com/beehive-nature/beehive-nature/blob/06f523c0bfd7a7203b55f38e2c99c0abe871f998/crates/adapter-autonomi/src/lib.rs)
