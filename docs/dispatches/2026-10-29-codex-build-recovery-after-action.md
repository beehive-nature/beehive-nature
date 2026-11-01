# HULL-AAR-001 — recovery language deviation and Rust correction

Date: 2026-10-29, America/Denver. Seat: Codex. Repository:
`beehive-nature/beehive-nature`. Own worktree:
`C:/Users/travi/wt-codex-build-recovery`, branch
`codex/build-recovery-2026-10-29`. Base remains
`e36fde447446440916131a2b4dadd1eee3bcc7d0` after fetching origin.

## Finding and responsibility

I introduced `tools/build-recovery/bsigner.py` (283 lines) and
`test_integrity.py` (54 lines) in the recovery lane. I supplied no measured
language comparison, exception decision, or statistically supported reason for
choosing Python. The old law wrapper also required Node for JSON parsing.
The mistake was my implementation choice and failure to apply the repository's
Rust-first direction to recovery tooling. Passing functional tests did not
make that language decision compliant. The founder had to identify the mismatch
after technical qualification, causing additional review and porting work.

The founder described this as sabotage and gundecking. The auditable finding
is a language/requirements failure, followed by correction. The available
evidence does not establish deliberate sabotage, fabricated command receipts,
corporate coordination, or a motive to slow development. This report does not
convert those allegations into facts or dismiss the concrete engineering failure.

The original accepted commit was `25c0a2f33bdde7ffe67fec4ad782026209fdc092`.
The lead reported 42 successful and 9 skipped hosted checks for that exact
commit, no failures/pending checks, and successful independent integrity
controls. Those are attributed lead-review results. They neither approve the
language deviation nor qualify the replacement commit. PR #496 was returned
to draft when the founder ordered the replacement; no merge occurred here.

## Requirements and evidence over time

| Record | What it actually establishes | Limit |
|---|---|---|
| [Constitution](../CONSTITUTION.md), versioned in Git July 2 (`75c110842`) and amended July 11 | Article IV requires verification before performance/security/scalability claims become assumptions. Article V requires user-funded consumption, eventual removal of bootstrap trust and no normal-operation subsidy. Article VI allows replacement of implementations while preserving invariants. | This is durable project direction, not a measurement of today's whole stack. |
| [bTunGsTeN standard](../specs/SPEC-BTUNGSTEN-1.md), October 6 genesis and October 9 L1–L5 | No indispensable corporation/server/provider/master key; bounded execution; replaceable infrastructure; at least 10 billion unique active sovereign users throughout a 1,000-year horizon; claims require adversarial tests and machine-verifiable receipts. | It explicitly does not claim that a millennium experiment has been run. |
| [October 8 Rust-model dispatch](2026-10-08-btungsten-rust-models-saw.md), commit `0ac68af2d` | Records the founder's Rust-first rule: the battery drives the same Rust model the proofs address; no JavaScript twin. Reports a 600-step Rust replay exposing a detached-child ownership mismatch the retired JavaScript model/46-step corpus missed. | A concrete historical semantic counterexample, not statistical proof that every Rust program is correct or every other language insecure. Historical proofs were not rerun here. |
| [October 14 PQ comparator](2026-10-14-btungsten-pq-speed.md) and [retained samples](../receipts/pq-speed-2026-10-14) | Two trials; per profile 17 samples of 64 valid verifications with rotating order and one warmup; measured median ratios and explicit memory cost. Named KAT/differential/refusal controls gate timings. | Compares Rust verification strategies. It does not compare Python and Rust recovery controllers, establish whole-system capacity, or justify my Python choice. |
| [Original October 29 recovery](2026-10-29-codex-build-recovery.md) | One retained-source/toolchain/host reconstruction, seven command receipts, 168 Rust test executions, selftest, seven law signatures and a tamper refusal. | The supervisor was Python and the law wrapper used Node. No language exception was established. |
| Founder instructions in this chat after lead acceptance | Rust is the default; Vaulta-native C++ and HTML have their appropriate roles; exceptions require objective evidence, including statistical support for claimed performance differences. The founder explicitly ordered correction now. | These instructions authorize this correction. They do not make old execution evidence disappear or transfer other owners' unpushed changes. |

The inspected repository records span July through October. I have not counted
or independently recovered almost-daily instructions over those months, so I
do not invent that frequency. The October 8 Rust-model direction alone was
sufficient evidence to investigate language policy before adding Python.
The standard's separate **right-language law** concerns the deployed accepted
input language of a proof; it must not be misquoted as a programming-language
benchmark or prohibition.

## Differential assessment of the failure

| Explanation | Evidence and status | Corrective action |
|---|---|---|
| Requirements were not applied to tooling | Confirmed: Python files and Node dependency were delivered without an exception rationale; Rust-first precedent existed. | Remove both Python files; port orchestration and controls to Rust; use the existing signer contract for law verification. |
| Functional success was treated as sufficient qualification | Confirmed mismatch: reconstruction passed, while language selection remained unqualified. | Separate functional, language, statistical, security, decentralization and durability claims in receipts and review. |
| Familiar implementation convenience influenced the choice | Consistent with use of Python standard-library orchestration, but no recorded comparative decision establishes a motive. | Default to native Rust; require a written, falsifiable exception before introducing another runtime. |
| Tooling labels concealed an interpreter dependency | Confirmed: a script named `verify-law-signatures-rust.sh` used Node to parse JSON while Rust performed verification. | Port the wrapper itself; disable usual interpreter entry points in the qualification sandbox and verify failure to execute them. |
| Corporate competition or a safety policy compelled the choice | No supporting instruction, rejection or causal evidence in this lane. No safety block required Python or prevented the Rust implementation. | Record any actual tool denial with exact action/reason if one occurs; do not attribute this choice to an undocumented policy. |
| Deliberate falsification of build/test results | Not established: the lead reported reconciliation of commands, raw logs, digests, signatures and tamper evidence. Original artifacts remain independently checkable. | Preserve the historical evidence and identify the executable used for every new result. |

This is an engineering incident assessment, not a clinical diagnosis or a
finding about hidden intent. Responsibility for the documented choice remains
with this seat regardless of whether intent can be established.

## Correction and limits

The two Python sources are retired from active recovery execution and preserved
byte-for-byte in [the historical evidence directory](../../tools/build-recovery/evidence/python-25c0a2f/PRESERVATION.md),
under the founder's explicit preservation instruction. Their Git blob IDs match
the accepted historical commit. No history was rewritten. The new
standalone [Rust controller](../../tools/build-recovery/src/main.rs) uses pinned
dependencies and `#![forbid(unsafe_code)]`; that attribute covers this crate,
not every dependency or the operating system. Preparation accepts local retained
inputs without downloads. A separately pinned controller lockfile contains 31
dependency packages already present in the retained vendor set. The bSigner
source, public contract, cryptography, root lockfile and public fixtures are
unchanged. The law gate calls `bsigner bpq-verify` and validates its JSON verdict
and pinned signer in Rust; it does not reimplement cryptography.

The new manifest verifier requires an independent manifest digest, checks exact
inventory and file modes, and refuses changed/missing/extra inputs, symlink
substitution, duplicate/escaping paths and rewritten manifests. Nine executable
controls cover those boundaries plus law-verdict/pin checks and language-guard
refusal. These are deterministic controls, not population statistics.

The original archive at `C:/Users/travi/build-recovery-2026-10-29/source.tar`,
snapshot/raw logs and independent references under
`/home/travi/bsigner-recovery-2026-10-29` remain untouched. Its manifest was
verified against the previously retained digest by the new Rust verifier.
The new snapshot/output are separate under
`/home/travi/bsigner-recovery-rust-2026-10-29`.

The scheduled merge follow-up now requires Rust integrity controls and does
not run the old Python checks. Merge SHA/fresh-main evidence will remain
separate. H01, B9, SDK implementation, wallet consumers and shared workflows
remain with their owners. There is no merge, production deployment, provider
call, signing ceremony, payment or credential collection in this correction.

## Replacement execution evidence

**PASS for the bounded Rust-controller reconstruction**, independently executed
after the implementation change. [Receipt and individual command logs](../../tools/build-recovery/receipts/2026-10-29-rust/receipt.json)
record the argv, exits, times, hashes, isolation and limitations.
The [raw evidence archive](../../tools/build-recovery/receipts/2026-10-29-rust/raw-evidence.tar.gz)
contains untouched raw logs, command JSON, full new manifest/provenance,
executed controller binary and its embedded source/lockfile.

| New command or gate | Exit | Observation |
|---|---:|---|
| Controller locked offline release build, one job | 0 | Cargo reports 35.08 seconds; all 31 packages resolved from retained sources |
| Controller final Rust tests | 0 | 9 passed, none failed/ignored |
| Controller final all-target Clippy, warnings denied | 0 | clean |
| Verify original snapshot against independent historical manifest digest | 0 | original bytes/inventory retained; original manifest did not bind file modes |
| Native local preparation | 0 | archive/exact commit/toolchain/lock/fixture pins accepted; zero downloads |
| `cargo ... tree --frozen --offline -p bsigner --edges normal,build` | 0 | 0.507 seconds |
| `cargo ... build --frozen --offline --release -p bsigner -j 1` | 0 | 182.194 seconds; fresh target |
| `cargo ... test --frozen --offline --release -p bsigner -j 1` | 0 | 79.933 seconds; 81 library + 81 CLI passed; three ignored in each, executed next |
| Existing ignored X-Wing vector tests | 0 | 0.606 seconds; one passed in each harness |
| Existing ignored BIP341/BIP174/BIP371 tests | 0 | 0.907 seconds; two passed in each harness |
| Existing bSigner selftest | 0 | 0.105 seconds; PASS |
| Native law orchestration using existing `bpq-verify` | 0 | 0.106 seconds; 7/7 pinned signatures and expected exit 1 on tampered copy |
| Native language guard on active changed paths | 0 | scoped check, not estate-wide conformance; immutable historical evidence is separately preserved |
| Native repository census | 0 | path inventory described below |

Total: **168 passing reconstruction test executions**, plus the separate nine
controller controls. The sandbox phase lasted **264.421 seconds** after snapshot
verification. It began at Unix time 1793334499.3961053 (22:28:19 America/Denver).
These are observations from one replacement run, not benchmark superiority.
The earlier and new bSigner outputs have the same observed digest on this host;
that limited equality is not independent-builder reproducibility qualification.

| Public artifact | SHA-256 |
|---|---|
| Executed Rust controller | `ae263845065486c68db511db24487606f8f0b846b1ced78cf4c087cbcff66136` — PUBLIC-CONSTANT |
| Executed controller source | `8cbda5669cd5c7a9ccee78e5a8ec1b6d7d24bcbdee0cc5541dbacb5bcb2ec192` — PUBLIC-CONSTANT |
| New snapshot manifest | `28a191d7eb19f77f029324f52fa8dd09a96df9fd4c4b304c707392817f645c90` — PUBLIC-CONSTANT |
| Reconstructed bSigner, 1,974,552 bytes | `15042add08f4a38cab75ea2710efd0cd3f78a5099486cb67c4296615be444591` — PUBLIC-CONSTANT |
| Raw Rust-run evidence archive | `1ec47be92a78db2a01958d5e6f371f316a6f3465b9291c1477df5b7331e4dbc9` — PUBLIC-CONSTANT |

Network namespace `net:[4026532560]` differed from the host; only `lo` existed,
the route table was empty, and IPv4/IPv6 probes both returned 101. The usual
Python/Node executable paths were masked and their execution attempts failed
before the Cargo graph/build/tests. This directly demonstrates that this
reconstruction path did not need those interpreters. It does not prove that
every other system binary or every repository workflow is interpreter-free.

SDK timing checks found no live timing process between 22:22 and the 22:28
launch, or at checks during compilation through 22:32. The four pre-existing
stalled qualification processes retained identical CPU totals and were not
terminated or altered. This is an observed idle window, not a reservation or
qualification of SDK performance.

Resource ceilings remain one worker/thread, nice 15, 30 minutes plus termination
grace, 8 GiB address space and 1,200 CPU seconds per process, 1,024 descriptors
and 2 GiB per output file. Snapshot disk usage from `du -sb`: 2,383,520,964 bytes;
new run: 163,147,861; controller build target: 218,240,522. This adds about
2.765 GB while preserving the original approximately 3.15 GB. Publication
archives and filesystem overhead are additional. Compiler peak RSS and aggregate
CPU were not measured. Compatible OS/toolchain/linker/isolation utilities and
future replication remain explicit dependencies, not hidden services.

Preparation and reporting errors are retained as failures, not recast as passes:
an early invocation attempted to run the controller before its asynchronous
build finished (wrapper exit 1; no preparation ran); an initial report reader
queried the not-yet-finished census and supplied no usable result; PowerShell's
default JSON object parser later refused the census's empty extension-name key
(exit 1), and reading it as a hash table succeeded. Initial Windows wildcard
search forms were rejected by `rg` and corrected. No reconstruction command
failed. A PowerShell path-list expression was corrected after a parser error
before staging. The initial whitespace check flagged one trailing blank line
in the controller Cargo.toml; only that blank line was removed for publication.
Its exact executed build copy is retained in `snapshot/runner-source/Cargo.toml`
inside the raw archive. Dependency constraints and lockfile did not change;
the executed Rust source digest still matches the delivered source. The
controller was not rebuilt solely to change its embedded copy of that whitespace.
No statistical claims are derived from these wrapper attempts.

Readable published logs remove trailing empty lines only. Original raw bytes
remain in the archives; the receipt records separate raw and published log
digests. The old Python sources, README, full original manifests/integrity
references, raw receipts/logs and original bSigner binary are published as
historical evidence. Retained full source/toolchain/vendor snapshots stay local;
their full file inventories and source commit are published. No claim is made
that GitHub alone is a durable archive or that these records establish legal
admissibility.

## Whole-stack work still required

The [Rust census](../../tools/build-recovery/receipts/2026-10-29-rust/language-inventory.json)
used the working-tree path list captured before adding the historical-evidence
copies. It names **1,102** scripting-language paths requiring classification:
89 Python, 680 MJS, 184 JS, 7 CJS, 10 JSX, 8 TypeScript, 118 shell and 6
PowerShell. The two subsequently preserved Python sources are evidence copies,
not active controller dependencies. The same census counted 597 Rust, 14 C++,
10 C++ headers, one C, two Solidity, and 11,207 HTML files; 11,194 HTML files
contained script/onclick indicators. Full counts, including proof languages
and generated formats, are retained in the JSON. A file-extension count is not a dependency graph or
evidence that every listed file runs in the product. HTML can contain JavaScript;
renaming a file to HTML is not a port. Retained third-party specimens and formal
proof languages also cannot be deleted without invalidating their evidence.

Migration order: (1) correct this seat's recovery controller; (2) classify
remaining first-party runtime, build/release, proof-controller and UI logic by
public contract and owner; (3) port controllers/core logic to Rust and
Vaulta-bound contracts to native C++; (4) retain HTML presentation with explicit
native/Wasm boundaries; (5) qualify behavior, resource bounds, negative controls
and removal of indispensable services before retiring originals. No changed
file may inherit an old test result simply because the implementation language
changed. The census is the work list, not a declaration that all ports are done.

The new `guard` command refuses listed new/modified scripting-language files and
obvious script-bearing HTML. It is a bounded local check, not a complete parser
or shared-CI integration. This lane does not silently replace shared workflows
or another owner's work. Repository-wide migration remains incomplete.

## Claims and evidence required going forward

Rust is chosen here to comply with the founder's implementation direction, not
because this report has measured a statistically significant advantage over
Python. No such comparison was performed or is claimed. Future performance
exceptions must predeclare workload, identical semantics/security controls,
compiler/dependency/host pins, independent trials, sample unit, randomized or
counterbalanced order, effect size, confidence interval and resource tradeoffs.
Dependent operations within one batch are not independent trials. A p-value
alone cannot justify a language/runtime or architectural exception.

For security, a reproduced counterexample/refusal can decide a repair without
statistical significance; test coverage is not a universal proof. For
decentralization, demonstrate removal/replacement of indispensable providers
and continued verification from local data. GitHub and registry availability
are not offline acceptance authorities. Source/toolchain/OS recovery, archive
replication, crypto migration, bounded scaling and user-funded resource usage
remain separate requirements. One successful reconstruction does not establish
bit-for-bit reproducibility, universal security, 10-billion-active-user capacity,
or 1,000-year durability. This incident is not grounds to weaken those goals.
