DRAFT, not filed. Target: https://github.com/GaloisInc/swanky/issues (public).
Covers RB01 observation 5. Prepared and executed by Seat 3 (Claude Code); receipts in `RECEIPTS.md`.

# popsicle: `compress_and_hash_inputs` maps byte strings that differ only in trailing zero bytes to the same block

## Summary

`popsicle::utils::compress_and_hash_inputs` copies an input of at most 16 bytes
into a zeroed 16-byte block without recording its length. So `[0x01]` and
`[0x01, 0x00]` (or `"alice"` and `"alice\0\0\0"`) produce the same block, and
circuit PSI counts them as one element. `PrimaryKey` is `Vec<u8>`, so callers
can pass keys of different lengths, and the function's doc says it
compresses "an arbitrary vector".

For circuit PSI, the module's `PRIMARY_KEY_SIZE` constant ("The number of
bytes representing a set primary key", 8) reads as a key width, and the tests
build keys of that width. But it is not stated as an input requirement, and
nothing checks input keys against it (source reading). When every key has
one fixed width of at most 16 bytes, the zero-padded copy is injective, so
this collision cannot occur; we make no claim about the hash step that
follows the copy.

## Version

`dev` at `409d1ceb0831e2de11eb8da1b8f961f59a8b5276`; `rust-toolchain` 1.99.0;
the repo's `.cargo/config.toml` and `Cargo.lock` (`--locked`); release profile;
Linux 6.18 x86_64 (WSL2).

## Reproduction

Attached `repro_input_encoding.rs`, placed at `edge/popsicle/examples/`. The
program prints a short notice before it runs and has a 60 s watchdog.

```
cargo run --locked --release -p popsicle --example repro_input_encoding
```

## Expected

Distinct byte strings get distinct encodings, so A = {[01]} and B = {[01 00]}
have cardinality 0. If one width is intended, it should be stated as a
requirement and checked.

## Observed

Exit 0, notice lines omitted:

```
compress_and_hash_inputs([01]) == compress_and_hash_inputs([01, 00]): true
compress_and_hash_inputs([]) == compress_and_hash_inputs([00]): true
compress_and_hash_inputs([61, 6c, 69, 63, 65]) == compress_and_hash_inputs([61, 6c, 69, 63, 65, 00, 00, 00]): true
circuit PSI cardinality of A = {[01]}, B = {[01 00]}: 1 (byte-string answer 0)
```

The two earlier runs printed the same four lines.

## Where

- [`edge/popsicle/src/utils.rs#L11-L32`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/utils.rs#L11-L32),
  specifically the zero-padded copy at
  [`#L18-L20`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/utils.rs#L18-L20).
- `PRIMARY_KEY_SIZE`:
  [`edge/popsicle/src/psi/circuit_psi/mod.rs#L23-L24`](https://github.com/GaloisInc/swanky/blob/409d1ceb0831e2de11eb8da1b8f961f59a8b5276/edge/popsicle/src/psi/circuit_psi/mod.rs#L23-L24).
- Callers at this commit (source reading): `edge/popsicle/src/psi/psz.rs`
  lines 48, 88, 247; `edge/popsicle/src/psi/psty.rs` lines 91, 234; circuit
  PSI `edge/popsicle/src/psi/circuit_psi/base_psi/sender.rs` line 112 and
  `receiver.rs` lines 103, 111. Only circuit PSI was run end to end here.

## Suggested fix

Make the encoding depend on the input length. For example, hash every input
together with its length, or keep the direct copy for short inputs but write
the length into a reserved byte and hash everything of 16 bytes or more.
Alternatively, state and check that all keys share one width. Any change to
the encoding changes the protocol's values, so both parties must run the
same version.

---
These reproductions were written and run by an AI coding agent (Claude Code)
in WSL2 on one host, in three runs. Every result above comes from those runs
at the pinned commit.
