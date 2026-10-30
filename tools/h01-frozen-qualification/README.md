# H01 frozen-fixture qualification

This standalone Rust controller runs the actual `harness-sovereign` executable
from the merged H01 source against Agent 3's frozen 40-item manifest. The product
binary decides acceptance. The controller supplies only scripted loopback SSE,
disposable artifact mutations, independent expectations, and bounded process
capture. It does not implement a substitute signer or acceptance algorithm.

Build the controller with the pinned compiler and its own lockfile:

```text
cargo build --manifest-path tools/h01-frozen-qualification/Cargo.toml --locked --offline
```

Run with explicit absolute paths (the output directory must not exist):

```text
h01-frozen-qualification run --repo /absolute/repo --manifest /absolute/golden/manifest.json --out /absolute/new-evidence --toolchain /absolute/pinned/bin --cargo-home /absolute/cargo-cache --target /absolute/harness-target
```

The runner checks the reviewed source/tree and fixture bytes, captures the actual
Rust compiler version, and performs a locked offline harness build. It uses the
existing system OpenSSL headers and libraries explicitly. It clears inherited
child environments; the only vault/key values used for run generation are the
public test recovery vector and a dummy loopback credential. Verification children
receive neither. No remote backend or relay is configured.

Every control's public identity is retained outside its evidence directory during
the initial loopback health request, before any scripted model response. A and B
share session, order and manifest but have different generated identities. Both
verify under their own independent pins before whole-bundle substitution.

Controls cover direct completion, two-checkpoint failover, and genuine
three-checkpoint failover. Counterexamples omit each explicit expectation,
duplicate/mutate/reorder the two checkpoint copies consistently, corrupt the
interior signature, substitute B's bundle against A's pin, and reuse an occupied
session. Reordering is expected to fail at the earlier checkpoint-order stage;
it is not described as a demonstrated commitment-stage refusal.

## Exact public archives

`archives/*.json` uses the `h01-public-bundle-v1` wrapper. Each entry contains its
relative path, byte length, SHA-256 and base64 of the original machine bytes.
`archive.rs::paths` allows only named public run/session files and sandbox input.
Both `keys/` and `nostr-keys/` are excluded before reading archive inputs. Original
JSON/JSONL, signatures and transcripts are never annotated or reformatted during
archiving. The metadata's `PUBLIC-CONSTANT` classification applies to the public
wrapper, not to private material or signed machine artifacts.

Restore into a new directory, with no writes to existing evidence:

```text
h01-frozen-qualification restore --archive /absolute/archives/valid-three.json --dest /absolute/new-workdir
```

Then run the real verifier with `--verify-only --workdir`, the recorded explicit
`--session` and `--order-id demo-task`, the separately retained `--public-material`
pin, and the original external `--manifest`. Every control archive is restored
and verified during qualification; re-archiving must be byte-identical to its
original archive. The wrapper's digest checks establish transport integrity;
the actual verifier establishes the signed run's acceptance.

Command records preserve actual argv, exit code and exact stdout/stderr bytes in
base64, with digests and durations. They do not serialize environment values.
The occupied-session check compares the full original workdir's directories and
exact file bytes in memory, including generated private artifacts, then publishes
only digest metadata and the equality result. Temporary private trees are removed
on normal completion or handled errors. A forced process termination can require
local cleanup of the named private temporary directory; it is never a publication
input.

Resource bounds are explicit in `PROVENANCE.json`: process timeouts, output limits,
archive/file limits, and bounded loopback HTTP requests. The controller is an
offline test harness, not a production service. Results do not qualify live
providers, settlement, host/process-loss continuity, unique humanity, reproducible
builds, or 1,000-year durability.
