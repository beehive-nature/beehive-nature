# x0x PQ cache follow-up — 2026-10-18

The x0x job in `.github/workflows/btungsten-pq.yml` repeated its crate path
on the right side of the Rust cache workspace mapping. The pinned action
resolves the workspace and then joins the right side to that directory.
The old mapping therefore targeted
`crates/btungsten-x0x-pq/crates/btungsten-x0x-pq/target`.
The correction is `crates/btungsten-x0x-pq -> target`, which targets the
crate's actual build directory.

The path semantics were checked against
[`CacheConfig.new()` at the pinned action revision](https://github.com/Swatinem/rust-cache/blob/6323deb102c322ba6fcbdcafc7e3dddab59af2b6/src/config.ts).
The action pin, main-only save policy, audit installation, all test/proof
commands and evidence uploads are unchanged. Registry or installed-tool
cache hits from the earlier mapping do not establish compiled-dependency
restoration. No cache-hit rate or build-speed improvement is claimed from
this source correction alone.

## Recovery and authorized sequence

The interrupted cloud chat left the patch uncommitted and unpublished.
Its attempt to refresh the worktree failed when the cloud proxy became
unreachable during a promisor-object fetch. This local continuation fetched
origin successfully and restored the exact one-line patch in its own
`wt-codex-pq-cache` worktree on branch `codex/pq-x0x-cache-path`, based on
main `6e7f01bcba46f5a753715ad6818165487c2b07dd`.

The founder's preserved instruction is: preserve PR #466 at `8ce097e0`,
finish its hosted checks, merge that head, verify the actual main merge,
then land this correction separately with its own CI. No additional review
round is requested. This continuation preserves that order.

## PR #466 qualification

[PR #466](https://github.com/beehive-nature/beehive-nature/pull/466) merged
head `8ce097e077dca8ce47ef2cdac47438fa85ee1889` as
`d472d198bf12b4d420fa828237b167d2b65d71cb`. The merge remains an ancestor of
the fetched main. A direct comparison of `crates/btungsten-x0x-pq/`,
`scripts/btungsten/x0x-pq-check.py` and `scripts/btungsten/pq-speed-check.py`
between the qualified head and actual merge is empty. All 20 hosted runs
on the original head were rechecked as completed successfully.

Post-merge workflow observations are tied to that actual merge:

| Workflow | Run | Result |
| --- | --- | --- |
| secret-scan | [39175451660](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451660) | success |
| BNROSE-RUST-001 | [39175451757](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451757) | success |
| bTunGsTeN PQ | [39175451733](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451733) | success |
| WB001 SAW proofs | [39175451803](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451803) | success |
| tests | [39175451703](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451703) | success |
| bTunGsTeN RB | [39175451686](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451686) | success |
| keychain-edge-lab | [39175451773](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451773) | success |
| keys-door | [39175451825](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451825) | success |
| WB002 WASM corpus | [39175451780](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451780) | success |
| WB002 SAW equivalence | [39175451836](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451836) | success |
| bTunGsTeN PQ SAW | [39175451742](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451742) | success |

The PQ SAW `saw` and `saw-ntt-dsa` jobs succeeded. The prepared-key proof
step and its immediate evidence upload succeeded; artifact
`prepared-key-wrapper-proof` (ID `12154886795`) was present and unexpired.
The final ML-KEM NTT job completed successfully at 2026-10-19 00:06:54 UTC
(October 18, 6:06:54 p.m. America/Denver). The workflow itself then completed
successfully, making all 11 code/proof workflows green before publication
of this follow-up.

Pages run [39175451312](https://github.com/beehive-nature/beehive-nature/actions/runs/39175451312)
was cancelled after a newer main commit superseded it. The subsequent
deployment on `b829cafc` was also superseded. Pages run
[39176379075](https://github.com/beehive-nature/beehive-nature/actions/runs/39176379075)
succeeded on descendant `6e7f01bc`. This is deployment-workflow evidence;
it is not a claim of a new browser or physical-device acceptance test.

## Local checks and remaining verification

- Reproduced the pinned action's `resolve(root)` / `join(root, target)`
  operations: the corrected path is the crate's target directory.
- `node scripts/lint-ci-shape.mjs`: 140/140 suite steps guarded. This
  existing check inspects `tests.yml`; it does not validate Rust cache paths.
- `git diff --check`: passed.
- The implementation, proof contracts, native controllers and source pins
  are untouched. Local solver and native batteries are not rerun for this
  cache-only change; the follow-up's hosted CI supplies its own results.

The correction's PR checks, actual merge SHA and post-merge checks remain
pending until separately observed. The proof scope and assumptions in
[`crates/btungsten-x0x-pq/proof/README.md`](../../crates/btungsten-x0x-pq/proof/README.md)
remain unchanged.
