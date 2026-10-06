# bsigner — the frozen contract

**FROZEN by founder order 2026-10-06** (the completion review's engineering
order, item 1: *"Freeze bSigner. No more feature cycles — its contract is
done."*). The organ is complete for the work it was built to do. This file is
the contract everything else may now depend on; **changing anything in the
FROZEN list below requires a founder ruling, recorded here with its date.**
Bug fixes that do not alter the surface are always in bounds.

## The frozen public surface

Commands (CLI, `crates/bsigner/src/main.rs`):

| command | what it is for |
|---|---|
| `keygen --alg <sig\|kem> [--keydir DIR]` | generate + persist a keyset; prints public info only |
| `sign --key-id ID --file PATH [--keydir DIR] [--out PATH]` | sign file bytes → `bheart.signature/1` envelope |
| `verify --key-id ID --file PATH --envelope PATH [--keydir DIR]` | verify an envelope against the named keyset |
| `list [--keydir DIR]` | key ids, kinds, algorithms — never secret material |
| `kemtest --key-id ID [--keydir DIR]` | encapsulate+decapsulate roundtrip receipt |
| `x402pay --key-id ID --offer PATH --policy PATH [--keydir DIR] [--out PATH]` | the pre-signature offer gate → ONE signed instruction, signed never submitted |
| `bpq-open --object PATH --rec-env VAR [--context CTX] [--out PATH]` | open a bpq1 sealed object; the recovery code comes from the environment, never argv |
| `bpq-verify --file PATH [--target FILE]` | verify a bpq1 card / binding / detached signature |
| `selftest` / `version` | exercise everything once / name the organ |

Wire formats:

- `bheart.signature/1` (`src/envelope.rs`) — the agility envelope: the
  signature algorithm id, the content hash AND its algorithm, the key id, the
  byte count of what was signed. Verifiers dispatch on the ids the envelope
  carries and refuse unknown ones, never default. **The envelope shape never
  changes**; migration = a new algorithm id in the registry.
- `bheart.keyset/1` (`src/keys.rs`) — JSON keyset files, base64url bodies,
  with the standing `law` field. The at-rest-encryption follow-up remains
  OPEN and documented in the keyset itself; it must not change the file's
  visible shape when it lands.
- Algorithm registry, signature side: `ml-dsa-44`, `ml-dsa-65`, `ml-dsa-87`;
  KEM side: `ml-kem-512`, `ml-kem-768`, `ml-kem-1024`; hash side: `sha3-256`.
  New ids are ADDED, never redefined, and an old build must refuse them.

Standing laws the freeze protects:

- **Signs, never submits.** Submission is the rail adapters' job. The organ
  has no network code at all.
- **Keys never leave, never printed** (`src/keys.rs`; held mechanically by
  `keygen_output_carries_no_seed`).
- **Independence law:** no banchor dependency, direct or transitive — the
  wallet works fully with the anchor off (the Cargo.toml absence is the fence).
- **Naming ruling (2026-09-03):** `bsigner` is THE signer name of the estate;
  `crates/btrezor` stays fenced ("this crate cannot sign") until it becomes a
  BACKEND of this organ behind the same interface — a backend swap is not a
  contract change.

## What the freeze does NOT close (open by design, named honestly)

1. **The hardware backend** — btrezor behind this interface, same commands,
   same envelopes. The naming ruling above already reserves the path.
2. **Rail-execution binding** — output-to-rail wiring lives in the consumers
   (the settle boundary's signed-authorization lane, the rail adapters), never
   in new organ commands. Rail payload signing stays the rail vaults' job:
   they sign with the chain's own curves; this organ is ML-DSA by design.

*Contract frozen 2026-10-06 by the founder's engineering order. The organ was
reviewed at ~4,000 source lines and 54 tests with no open stubs; the ruling
was "do not spend another cycle adding bSigner features," and this file is
that ruling made checkable.*
